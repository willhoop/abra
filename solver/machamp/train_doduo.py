"""solver/machamp/train_doduo.py -- MACHAMP: MAG/DODUO generation n+1, pulled toward the SEARCH's mix and back toward
the HUMAN clone.

    python solver/machamp/train_doduo.py --init-mag <mag json> --init-doduo <doduo json> --human solver/out/mag
        --selfplay <build_doduo.js dir> --out-dir <dir> --tag gen1 --metrics <json>
        [--anchor-mag solver/mag/model/mag-v1.json --anchor-doduo solver/mag/model/doduo-v1.json]
        [--beta 0.3] [--human-weight 1.0] [--epochs 3] [--lr 3e-4] [--threads 4]

THE MODEL AND ITS TENSORS ARE solver/mag/train.py's (imported, not copied): MagDoduo, batch(), to_t(), nll(),
import_model(), row_maps(), and the human tensors solver/mag/build_features.js wrote. The self-play tensors
(solver/machamp/build_doduo.js) have the same layout plus a soft target over DODUO's joint cells.

THE LOSS, per step:
    self-play batch:  tau = (1 - beta) * search_mix + beta * P_anchor        (P_anchor = the frozen HUMAN CLONE, DODUO v1,
                                                                             on the same cells)
                      CE(tau, DODUO) + CE(tau, MAG factorised)
    human batch:      NLL(human click | DODUO) + NLL(human click | MAG)      (solver/mag/train.py's own loss)
    loss = self-play + human_weight * human
Two pulls back to the human clone: the anchor inside the target (piKL's regulariser, on the self-play states) and
the human clicks themselves (on the human states). beta and human_weight are pre-registered
(solver/machamp/preregistration.json).

SELECTION: after each epoch, self-play VAL cross-entropy against the SEARCH mix alone, and the human VAL joint NLL.
Kept: the lowest self-play val CE among epochs whose human val NLL is within +0.05 nats of the init's; else the init.

REPORTED (diagnostic, not a gate -- the task gates PORYGON2 on human log-loss and the generation in the arena):
held-out HUMAN TEST joint log-loss and recall@16 of the new DODUO against v1 (the human clone), paired and clustered
by player (solver/mag/train.py summarise()).
"""
import argparse, hashlib, importlib.util, json, os, sys, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--init-mag', required=True); ap.add_argument('--init-doduo', required=True)
ap.add_argument('--anchor-mag', default='solver/mag/model/mag-v1.json'); ap.add_argument('--anchor-doduo', default='solver/mag/model/doduo-v1.json')
ap.add_argument('--human', default='solver/out/mag')
ap.add_argument('--selfplay', required=True)
ap.add_argument('--out-dir', required=True); ap.add_argument('--tag', required=True)
ap.add_argument('--metrics', required=True)
ap.add_argument('--beta', type=float, default=0.3)
ap.add_argument('--human-weight', type=float, default=1.0)
ap.add_argument('--epochs', type=int, default=3)
ap.add_argument('--lr', type=float, default=3e-4)
ap.add_argument('--batch', type=int, default=256)
ap.add_argument('--tol', type=float, default=0.05)
ap.add_argument('--tol-ref', choices=['init', 'anchor'], default='init', help="the human val NLL the tolerance is measured from: the init's (default) or the frozen human clone's (a warm start from a champion must not let the drift compound generation over generation)")
ap.add_argument('--threads', type=int, default=4)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--boot', type=int, default=1000)
ap.add_argument('--test-limit', type=int, default=0)
ap.add_argument('--fixture', default='', help='write a Node/Python agreement fixture (solver/mag/train.py write_fixture) for the EXPORTED files')
args = ap.parse_args()

# ---- import solver/mag/train.py as a module, with ITS argv (it parses at import and reads META from --data)
_argv = sys.argv
sys.argv = ['train.py', '--data', args.human, '--threads', str(min(4, args.threads)), '--boot', str(args.boot), '--seed', str(20260924)]
spec = importlib.util.spec_from_file_location('magtrain', os.path.join('solver', 'mag', 'train.py'))
MT = importlib.util.module_from_spec(spec); spec.loader.exec_module(MT)
sys.argv = _argv
torch = MT.torch
torch.set_num_threads(min(4, args.threads))
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
NEG = MT.NEG


def load_mm(d, extra=False):
    """solver/mag/train.py load(), memmapped for the big per-candidate tables (RAM <= 3 GB)"""
    CTX_F, CAND_F, SX = MT.CTX_F, MT.CAND_F, MT.SX
    S = {}
    S['ctx'] = np.fromfile(os.path.join(d, 'ctx.f32'), np.float32).reshape(-1, CTX_F)
    nc = os.path.getsize(os.path.join(d, 'cand_label.u8'))
    S['cand'] = np.memmap(os.path.join(d, 'cand.f32'), np.float32, 'r', shape=(nc, CAND_F))
    S['attr'] = np.memmap(os.path.join(d, 'cand_attr.i32'), np.int32, 'r', shape=(nc, 7))
    S['lab'] = np.memmap(os.path.join(d, 'cand_label.u8'), np.uint8, 'r', shape=(nc,))
    S['slot'] = np.fromfile(os.path.join(d, 'slot.i32'), np.int32).reshape(-1, 5)
    S['dec'] = np.fromfile(os.path.join(d, 'dec.i32'), np.int32).reshape(-1, 7)
    S['sx'] = np.fromfile(os.path.join(d, 'slot_x.i32'), np.int32).reshape(-1, SX)
    S['cx'] = np.memmap(os.path.join(d, 'cand_x.i32'), np.int32, 'r', shape=(nc,))
    if extra:
        ti = np.fromfile(os.path.join(d, 'tgt.i32'), np.int32).reshape(-1, 3)
        tp = np.fromfile(os.path.join(d, 'tgt.f32'), np.float32)
        S['tgt_i'], S['tgt_p'] = ti, tp
        order = np.argsort(ti[:, 0], kind='stable')
        S['tgt_start'] = np.searchsorted(ti[order, 0], np.arange(len(S['dec']) + 1))
        S['tgt_order'] = order
        wf = os.path.join(d, 'w.f32')
        S['w'] = np.fromfile(wf, np.float32).astype(np.float64) if os.path.exists(wf) else np.ones(len(S['dec']))
        assert len(S['w']) == len(S['dec']), 'w.f32 does not hold one weight per decision: ' + d
    return S


def target(S, ids, K):
    t = np.zeros((len(ids), K, K), np.float32)
    for r, d in enumerate(ids):
        o = S['tgt_order'][S['tgt_start'][d]:S['tgt_start'][d + 1]]
        for q in o:
            _, a, b = S['tgt_i'][q]
            t[r, a, b] += S['tgt_p'][q]
    return torch.from_numpy(t)


SPM = json.load(open(os.path.join(args.selfplay, 'meta.json')))
assert SPM['move_vocab'] == MT.META['move_vocab'] and SPM['species_vocab'] == MT.META['species_vocab'], 'self-play tensors were indexed with another vocabulary than the human build'
SPtr, SPva = load_mm(os.path.join(args.selfplay, 'train'), True), load_mm(os.path.join(args.selfplay, 'val'), True)
# per-decision sample weights (build_doduo.js --weights), normalised to mean 1 on TRAIN so the self-play:human balance is unchanged
W_NORM = float(SPtr['w'].mean()) if len(SPtr['w']) else 1.0
SPtr['w'] = SPtr['w'] / W_NORM; SPva['w'] = SPva['w'] / W_NORM
WEIGHTED = bool(np.any(SPtr['w'] != 1.0))
HTR, HVA = load_mm(os.path.join(args.human, 'train')), load_mm(os.path.join(args.human, 'val'))


def informative(S):
    D = S['dec']
    st = lambda col: np.where(D[:, col] >= 0, S['slot'][np.maximum(D[:, col], 0), 2], -1)
    inf_ = lambda s: (s == MT.SS['exact']) | (s == MT.SS['uncertain_target'])
    return (D[:, 2] != MT.JS['outside']) & (inf_(st(0)) | inf_(st(1)))


h_tr = np.nonzero(informative(HTR))[0]
h_va = np.nonzero(informative(HVA))[0]
h_va = np.random.default_rng(3).choice(h_va, size=min(20000, len(h_va)), replace=False); h_va.sort()
log(f'self-play decisions train {len(SPtr["dec"])} val {len(SPva["dec"])} | human informative train {len(h_tr)} val(sub) {len(h_va)}')

model, M, Dj = MT.import_model(args.init_mag, args.init_doduo, dtype=torch.float32)
anchor, MA, _ = MT.import_model(args.anchor_mag, args.anchor_doduo, dtype=torch.float32)
assert MA['move_rows'] == M['move_rows'] and MA['species_rows'] == M['species_rows'], 'init and anchor must share embedding rows'
mrow, srow = MT.row_maps(M['move_rows'], M['species_rows'])
for p in anchor.parameters(): p.requires_grad_(False)
anchor.eval()


def ce(L, tau):
    B = L.shape[0]
    lp = torch.log_softmax(L.reshape(B, -1), 1)
    return -(tau.reshape(B, -1) * lp).sum(1)


def sp_losses(S, ids, net, beta):
    b = MT.batch(S, ids); TA, TB, P, valid, both = MT.to_t(b)
    Lj, Lm = net(TA, TB, P, valid, both, mrow, srow)
    ts = target(S, ids, b['K'])
    ts = ts * torch.from_numpy(b['valid']).float()
    ts = ts / ts.reshape(len(ids), -1).sum(1).clamp(min=1e-9)[:, None, None]
    if beta > 0:
        with torch.no_grad():
            La, _ = anchor(TA, TB, P, valid, both, mrow, srow)
            pa = torch.softmax(La.reshape(len(ids), -1), 1).reshape(La.shape)
        tau = (1 - beta) * ts + beta * pa
    else:
        tau = ts
    return ce(Lj, tau), ce(Lm, tau)


def human_losses(S, ids, net):
    b = MT.batch(S, ids); TA, TB, P, valid, both = MT.to_t(b)
    Lj, Lm = net(TA, TB, P, valid, both, mrow, srow)
    lab = torch.from_numpy(b['lab'])
    return MT.nll(Lj, lab), MT.nll(Lm, lab)


def val_metrics(net):
    net.eval(); tot = n = 0.0; hj = hn = 0.0
    with torch.no_grad():
        ids = np.arange(len(SPva['dec']))
        for i in range(0, len(ids), 512):
            wv = torch.from_numpy(SPva['w'][ids[i:i + 512]]).to(torch.float32)
            lj, _ = sp_losses(SPva, ids[i:i + 512], net, 0.0); tot += (lj * wv).sum().item(); n += wv.sum().item()
        for i in range(0, len(h_va), 1024):
            lj, _ = human_losses(HVA, h_va[i:i + 1024], net); hj += lj.sum().item(); hn += len(lj)
    net.train()
    return tot / max(n, 1), hj / max(hn, 1)


torch.manual_seed(args.seed); rng = np.random.default_rng(args.seed)
sp0, hv0 = val_metrics(model)
log(f'init: self-play val CE {sp0:.4f}  human val NLL {hv0:.4f}  (self-play weighted: {WEIGHTED})')
hv_ref = hv0
if args.tol_ref == 'anchor':
    _, hv_ref = val_metrics(anchor)
    anchor.eval()   # val_metrics() leaves its net in train mode; the anchor must stay in eval
    log(f'anchor (human clone) human val NLL {hv_ref:.4f}: the selection tolerance is measured from it')
history = [{'epoch': -1, 'selfplay_val_ce': sp0, 'human_val_nll': hv0}]
states = {-1: {k: v.clone() for k, v in model.state_dict().items()}}
opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr, weight_decay=1e-5)
model.train()
for ep in range(args.epochs):
    t = time.time(); perm = rng.permutation(len(SPtr['dec']))
    hp = rng.choice(h_tr, size=len(perm), replace=len(perm) > len(h_tr))
    rs = rh = 0.0; steps = 0
    for i in range(0, len(perm), args.batch):
        a = np.sort(perm[i:i + args.batch]); h = np.sort(hp[i:i + args.batch])
        lj, lm = sp_losses(SPtr, a, model, args.beta)
        wa = torch.from_numpy(SPtr['w'][a]).to(lj.dtype)
        hj, hm = human_losses(HTR, h, model)
        loss = ((lj * wa).mean() + (lm * wa).mean()) + args.human_weight * (hj.mean() + hm.mean())
        opt.zero_grad(); loss.backward(); opt.step()
        rs += lj.mean().item(); rh += hj.mean().item(); steps += 1
    spv, hv = val_metrics(model)
    history.append({'epoch': ep, 'train_selfplay_ce': rs / steps, 'train_human_nll': rh / steps, 'selfplay_val_ce': spv, 'human_val_nll': hv, 'seconds': time.time() - t})
    states[ep] = {k: v.clone() for k, v in model.state_dict().items()}
    log(f'epoch {ep}: train sp CE {rs / steps:.4f} human NLL {rh / steps:.4f} | val sp CE {spv:.4f} human NLL {hv:.4f}  {time.time() - t:.0f}s')

ok = [h for h in history if h['human_val_nll'] <= hv_ref + args.tol]
pick = min(ok, key=lambda h: h['selfplay_val_ce']) if ok else history[0]
log('selected epoch', pick['epoch'])
model.load_state_dict(states[pick['epoch']]); model.eval()


# ---- export in solver/mag/train.py's format (solver/mag/infer.js reads it); the frequency table is the init's
def export():
    os.makedirs(args.out_dir, exist_ok=True)
    P = {k: v.detach().double().numpy().tolist() for k, v in model.state_dict().items() if k not in ('mu', 'sd')}
    mag_keys = ['E_mv.weight', 'E_sp.weight', 'l1.weight', 'l1.bias', 'l2.weight', 'l2.bias', 's.weight', 's.bias']
    common = {'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'generator': 'solver/machamp/train_doduo.py', 'torch': torch.__version__,
              'dataset': M['dataset'], 'split': M['split'], 'feature_version': M['feature_version'], 'v0_feature_version': M['v0_feature_version'],
              'init': {'mag': {'path': args.init_mag, 'sha256': sha(args.init_mag)}, 'doduo': {'path': args.init_doduo, 'sha256': sha(args.init_doduo)}},
              'selfplay': {'dir': args.selfplay, 'sources': SPM['sources']}, 'machamp': {'beta': args.beta, 'human_weight': args.human_weight, 'lr': args.lr, 'tol_ref': args.tol_ref, 'selfplay_weighted': WEIGHTED, 'selected_epoch': pick['epoch']}}
    mag = dict(M); mag.update(common); mag.update({'name': 'mag-' + args.tag, 'params': {k: P[k] for k in mag_keys}, 'val_history': history})
    mpath = os.path.join(args.out_dir, 'mag-' + args.tag + '.json'); json.dump(mag, open(mpath, 'w'))
    dod = dict(Dj); dod.update(common); dod.update({'name': 'doduo-' + args.tag, 'mag': {'path': mpath.replace('\\', '/'), 'sha256': sha(mpath)},
                                                   'params': {k: P[k] for k in P if k not in mag_keys}, 'val_history': history})
    dpath = os.path.join(args.out_dir, 'doduo-' + args.tag + '.json'); json.dump(dod, open(dpath, 'w'))
    return mpath, dpath


mpath, dpath = export()
log('exported', mpath, dpath)

# ---- held-out HUMAN TEST: the new DODUO vs v1 (the human clone), paired, clustered by player
TE = load_mm(os.path.join(args.human, 'test'))
te_ids = np.arange(len(TE['dec'])) if not args.test_limit else np.arange(min(args.test_limit, len(TE['dec'])))
new64, _, _ = MT.import_model(mpath, dpath)
v164, _, _ = MT.import_model(args.anchor_mag, args.anchor_doduo)


def scorer(net):
    def f(b):
        with torch.no_grad():
            Lj, _ = net(*MT.to_t(b, torch.float64), mrow, srow)
        return np.where(b['valid'], Lj.numpy(), -np.inf)
    return f


acc = {'new': None, 'v1': None}
for i in range(0, len(te_ids), 512):
    b = MT.batch(TE, te_ids[i:i + 512])
    for name, fn in (('new', scorer(new64)), ('v1', scorer(v164))):
        o = MT.eval_logits(fn(b), b, TE)
        acc[name] = o if acc[name] is None else {k: np.concatenate([acc[name][k], o[k]]) for k in o}
players = TE['dec'][te_ids, 6]
summ = MT.summarise(acc['new'], players, args.boot, 20260925, ref=acc['v1'])
keep = {k: summ[k] for k in ('joint_ll', 'joint_r1', 'joint_r4', 'joint_r8', 'joint_r16') if k in summ}
metrics = {'tag': args.tag, 'models': {'mag': {'path': mpath.replace('\\', '/'), 'sha256': sha(mpath)}, 'doduo': {'path': dpath.replace('\\', '/'), 'sha256': sha(dpath)}},
           'init': {'mag': sha(args.init_mag), 'doduo': sha(args.init_doduo)}, 'anchor_human_clone': {'mag': sha(args.anchor_mag), 'doduo': sha(args.anchor_doduo)},
           'selfplay_tensors': {'dir': args.selfplay, 'sizes': SPM['sizes'], 'counts': SPM['counts']}, 'flags': vars(args),
           'history': history, 'selected_epoch': pick['epoch'], 'tol_ref': {'kind': args.tol_ref, 'human_val_nll': hv_ref},
           'selfplay_weights': {'weighted': WEIGHTED, 'train_mean_raw': W_NORM},
           'human_test_vs_v1': {'what': 'held-out human TEST decisions, exact joints; diff = new - v1 (the human clone); 95% player-cluster bootstrap', **keep},
           'seconds': round(time.time() - T0)}
json.dump(metrics, open(args.metrics, 'w'), indent=1)
if args.fixture:
    MT.args.fixture = args.fixture
    MT.write_fixture(TE, new64, json.load(open(mpath)), json.load(open(dpath)), mpath, dpath, mrow, srow)
log('human test joint ll new', round(keep['joint_ll']['est'], 4), 'v1', round(keep['joint_ll']['ref'], 4), 'diff CI', [round(keep['joint_ll']['diff_lo'], 4), round(keep['joint_ll']['diff_hi'], 4)])
