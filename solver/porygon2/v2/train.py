"""solver/porygon2/v2/train.py -- PORYGON2 v2 training: stage A (bo1 pretrain) and stage B (bo3 fine-tune with bo1 replay).

    python solver/porygon2/v2/train.py --stage A --out <dir> [--k 1] [--no-aux] [--no-rating] [--seed 1] [--threads 4]
    python solver/porygon2/v2/train.py --stage B --init <dir of A>/model.pt --out <dir> [--k 1] [--replay-share 0.25]
    python solver/porygon2/v2/train.py --stage B --init none --out <dir>            (the no-pretrain ablation)

Flags are the pre-registered schedule (solver/porygon2/v2/preregistration.json "schedule"); every flag is written into the
run's metrics. Data: solver/out/porygon2-v2/<fmt>/tensors/ (encode.js).

THE TEST SPLIT IS NOT READ HERE. Only TRAIN games are sampled and only VAL games are scored; a guard refuses any test row.
Gate (a) is solver/porygon2/v2/gate_a.py, read once.

SAMPLING (DESIGN §4). K fresh uniform positions per game per epoch (K = 0 means every position). Stage A: each train game
once per epoch, a game between players rated >= 100 apart twice (Maia-2's over-sampling). Stage B: an epoch is one pass
over the bo3 train games; every batch is 75% bo3 draws and 25% bo1 train draws (replay).

AUX WEIGHT (preregistration "loss_weights"). For the first 200 optimiser steps of stage A the auxiliary weight is set each
step so the auxiliary gradient on the shared encoder is 25% of the main head's (KataGo's 10-40%); after step 200 it is
frozen at 0.25 * mean|g_main| / mean|g_aux| over those steps and carried into stage B unchanged.

SELECTION. The epoch with the lowest VALIDATION log-loss against the outcome z over every position of the val games (A:
bo1 val; B: bo3 val). Printed per epoch beside the AlphaGo diagnostic (train - val log-loss, the train side on a fixed
sample of train positions).
"""
import argparse, ctypes, hashlib, json, os, sys, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--stage', required=True, choices=['A', 'B'])
ap.add_argument('--data', default='solver/out/porygon2-v2')
ap.add_argument('--out', required=True)
ap.add_argument('--init', default='')
ap.add_argument('--k', type=int, default=1, help='positions per game per epoch; 0 = every position')
ap.add_argument('--epochs', type=int, default=30)
ap.add_argument('--lr', type=float, default=None)
ap.add_argument('--wd', type=float, default=1e-4)
ap.add_argument('--dropout', type=float, default=0.1)
ap.add_argument('--bs', type=int, default=512)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--threads', type=int, default=4)
ap.add_argument('--replay-share', type=float, default=0.25)
ap.add_argument('--unequal-weight', type=int, default=2)
ap.add_argument('--no-aux', action='store_true')
ap.add_argument('--no-rating', action='store_true')
ap.add_argument('--aux-target', type=float, default=0.25)
ap.add_argument('--aux-warm', type=int, default=200)
ap.add_argument('--max-games', type=int, default=0, help='debug: cap train games')
args = ap.parse_args()
if args.lr is None: args.lr = 1e-3 if args.stage == 'A' else 3e-4

# BELOW_NORMAL, from inside the process (timed arena games keep priority; CLAUDE.md "lownode")
if os.name == 'nt':
    try: ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
    except Exception as e: print('could not lower priority:', e)

import torch
import torch.nn as nn
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import net as NT

torch.set_num_threads(args.threads); torch.set_num_interop_threads(1)
torch.manual_seed(args.seed); np.random.seed(args.seed)
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
os.makedirs(args.out, exist_ok=True)

bo1 = NT.Data(args.data, 'bo1'); bo3 = NT.Data(args.data, 'bo3')
if bo1.release != bo3.release: raise SystemExit(f'bo1 and bo3 tensors from different releases: {bo1.release} {bo3.release}')
init = None
if args.init and args.init != 'none':
    init = torch.load(args.init, map_location='cpu', weights_only=False)
    VOC = init['vocab']
else:
    VOC = NT.build_vocab([bo1, bo3])
for D in (bo1, bo3):
    for s in D.shards: s.remap_to(VOC)
TN, SN, FN, KN = bo1.TN, bo1.SN, bo1.FN, bo1.KN
model = NT.Net(VOC, TN, SN, FN, KN, drop=args.dropout)
aux_w = None
if init is not None:
    model.load_state_dict(init['state']); aux_w = init.get('aux_w')
nparams = sum(p.numel() for p in model.parameters())
log(f'stage {args.stage} params {nparams} release {bo1.release} vocab {({k: len(v) for k, v in VOC.items()})}')

rng = np.random.default_rng(args.seed)
tr1 = np.nonzero(bo1.g_split == 0)[0]; va1 = np.nonzero(bo1.g_split == 1)[0]
tr3 = np.nonzero(bo3.g_split == 0)[0]; va3 = np.nonzero(bo3.g_split == 1)[0]
if args.max_games: tr1 = tr1[:args.max_games]; tr3 = tr3[:args.max_games]
for D, g in ((bo1, tr1), (bo1, va1), (bo3, tr3), (bo3, va3)):
    assert not (D.g_split[g] == 2).any(), 'a TEST game reached the trainer'
log(f'games: bo1 train {len(tr1)} val {len(va1)} | bo3 train {len(tr3)} val {len(va3)}; unequal-rating bo1 train {int(bo1.g_unequal[tr1].sum())}')

opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
bce = nn.BCEWithLogitsLoss()
shared = [p for n, p in model.named_parameters() if not n.startswith(('h1', 'h2', 'a_'))]


def predict(D, games, bs=4096, no_rating=False, rows=None):
    model.eval(); out = []; Y = []
    sh, rw = D.rows_of(games, 0, rng) if rows is None else rows
    with torch.no_grad():
        for i in range(0, len(sh), bs):
            B, lab = D.batch(sh[i:i + bs], rw[i:i + bs], no_rating)
            out.append(model(B).double().numpy()); Y.append(lab['z'])
    return (np.concatenate(out), np.concatenate(Y)) if out else (np.zeros(0), np.zeros(0))


def val_ll(D, games):
    lg, y = predict(D, games, no_rating=args.no_rating)
    return float(NT.ll(lg, y).mean()), len(y)


# a fixed train sample for the AlphaGo train-minus-val diagnostic
diag_rng = np.random.default_rng(99)
TRD = bo1 if args.stage == 'A' else bo3
trg = tr1 if args.stage == 'A' else tr3
diag_rows = TRD.rows_of(diag_rng.choice(trg, size=min(4000, len(trg)), replace=False), 1, diag_rng)

gm_hist, ga_hist = [], []
step = 0
counters = {'positions_read': 0, 'positions_bo1': 0, 'positions_bo3': 0, 'unk_member_fields': 0, 'member_fields': 0}


def grad_norm(loss):
    gs = torch.autograd.grad(loss, shared, retain_graph=True, allow_unused=True)
    return float(torch.sqrt(sum((g ** 2).sum() for g in gs if g is not None)))


def train_step(batches):
    global step, aux_w
    model.train(); opt.zero_grad()
    Bs, labs = [], []
    for D, sh, rw in batches:
        B, lab = D.batch(sh, rw, args.no_rating); Bs.append(B); labs.append(lab)
        counters['positions_read'] += len(sh); counters['positions_' + D.fmt] += len(sh)
        ti = B['ti']; counters['member_fields'] += int(ti.numel()); counters['unk_member_fields'] += int((ti == 2).sum())
    B = {k: torch.cat([b[k] for b in Bs]) for k in Bs[0]}
    lab = {k: np.concatenate([l[k] for l in labs]) for k in labs[0]}
    logit, A = model(B, aux=True)
    main = bce(logit, torch.from_numpy(lab['z']).float())
    if args.no_aux:
        loss = main; aw = 0.0; parts = {}
    else:
        la, parts = NT.aux_loss(A, lab)
        if aux_w is None and step < args.aux_warm:
            gm, ga = grad_norm(main), grad_norm(la)
            gm_hist.append(gm); ga_hist.append(ga)
            aw = args.aux_target * np.mean(gm_hist) / max(1e-12, np.mean(ga_hist))
            if step == args.aux_warm - 1: aux_w = float(aw); log(f'aux weight frozen at {aux_w:.5f} (|g_main| {np.mean(gm_hist):.4g}, |g_aux| {np.mean(ga_hist):.4g}, {len(gm_hist)} steps)')
        else:
            aw = aux_w if aux_w is not None else 0.0
        loss = main + aw * la
    loss.backward(); opt.step(); step += 1
    return float(main), parts


history = []; best = (1e9, None, -1)
for ep in range(args.epochs):
    t = time.time(); tot = 0.0; nb = 0; parts_tot = {}
    if args.stage == 'A':
        games = np.concatenate([tr1] + [tr1[bo1.g_unequal[tr1]]] * (args.unequal_weight - 1))
        sh, rw = bo1.rows_of(games, args.k, rng)
        perm = rng.permutation(len(sh))
        for s in range(0, len(perm), args.bs):
            j = perm[s:s + args.bs]
            l, parts = train_step([(bo1, sh[j], rw[j])]); tot += l; nb += 1
            for k, v in parts.items(): parts_tot[k] = parts_tot.get(k, 0) + v
    else:
        n3 = int(round(args.bs * (1 - args.replay_share))); n1 = args.bs - n3
        sh3, rw3 = bo3.rows_of(tr3, args.k, rng)
        perm = rng.permutation(len(sh3))
        for s in range(0, len(perm), n3):
            j = perm[s:s + n3]
            batches = [(bo3, sh3[j], rw3[j])]
            if n1 > 0:
                g1 = rng.choice(tr1, size=n1, replace=True)
                s1, r1 = bo1.rows_of(g1, 1, rng); batches.append((bo1, s1, r1))
            l, parts = train_step(batches); tot += l; nb += 1
            for k, v in parts.items(): parts_tot[k] = parts_tot.get(k, 0) + v
    sched.step()
    v1l, n1v = val_ll(bo1, va1); v3l, n3v = val_ll(bo3, va3)
    lgd, yd = predict(TRD, None, rows=diag_rows, no_rating=args.no_rating); trd = float(NT.ll(lgd, yd).mean())
    sel = v1l if args.stage == 'A' else v3l
    rec = {'epoch': ep, 'train_loss': tot / max(1, nb), 'steps': nb, 'val_bo1': v1l, 'val_bo3': v3l, 'train_sample_ll': trd,
           'train_minus_val': trd - sel, 'aux': {k: v / max(1, nb) for k, v in parts_tot.items()}, 'aux_w': aux_w, 'seconds': round(time.time() - t, 1)}
    history.append(rec)
    log(f'epoch {ep}: train {rec["train_loss"]:.5f} val bo1 {v1l:.5f} bo3 {v3l:.5f} | train-sample {trd:.5f} (train-val {trd - sel:+.5f}) {rec["seconds"]}s')
    if sel < best[0]: best = (sel, {k: v.clone() for k, v in model.state_dict().items()}, ep)

model.load_state_dict(best[1])
log('selected epoch', best[2], 'val', round(best[0], 5))
ck = {'state': model.state_dict(), 'vocab': VOC, 'aux_w': aux_w, 'dims': NT.DIMS, 'TN': TN, 'SN': SN, 'FN': FN, 'KN': KN,
      'names': bo1.nm, 'release': bo1.release, 'flags': vars(args)}
mp = os.path.join(args.out, 'model.pt'); torch.save(ck, mp)
sha = hashlib.sha256(open(mp, 'rb').read()).hexdigest()
metrics = {'what': 'PORYGON2 v2 stage ' + args.stage, 'flags': vars(args), 'params': nparams, 'release': bo1.release,
           'inputs': {'bo1': bo1.input_sha256, 'bo3': bo3.input_sha256}, 'games': {'bo1_train': int(len(tr1)), 'bo1_val': int(len(va1)), 'bo3_train': int(len(tr3)), 'bo3_val': int(len(va3))},
           'aux_w': aux_w, 'aux_warm_steps': len(gm_hist), 'selected_epoch': best[2], 'selected_val': best[0], 'history': history,
           'counters': dict(counters, unk_share=counters['unk_member_fields'] / max(1, counters['member_fields'])),
           'model': {'path': mp.replace('\\', '/'), 'sha256': sha}, 'seconds': round(time.time() - T0), 'torch': torch.__version__}
json.dump(metrics, open(os.path.join(args.out, 'metrics.json'), 'w', encoding='utf8'), indent=1)
log('wrote', mp, 'positions read', counters['positions_read'], 'UNK share of member fields', round(metrics['counters']['unk_share'], 4))
if counters['positions_read'] == 0: raise SystemExit('ZERO positions read: the trainer did not train')
