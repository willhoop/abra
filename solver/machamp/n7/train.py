"""solver/machamp/n7/train.py -- the N7 learner: train the next policy+value net on one generation's self-play (PLAN N7).

    python solver/machamp/n7/train.py train  --data <dataset dir> --init <net.json> --out <dir> [--epochs 5] [--threads 4]
                                              [--anchor-data <v2 tensors root> --anchor-teacher <teacher cache>] [--no-anchor]
                                              --base-mag <mag.json> --base-doduo <doduo.json>
    python solver/machamp/n7/train.py export --out <dir>        (writes <dir>/net.json, <dir>/fixture.json)

THE NET. The PORYGON2 v3 student (solver/porygon2/v3/student.py Student: shared member MLP, mean+max pooling, side, field and
rating codes, a 64-unit head; antisymmetric logit = g(p1, p2) - g(p2, p1)) is the trunk and value head, warm-started from
--init (an exported v3-student file: the student itself, or the previous champion net). Added heads, all on the head's
64-unit hidden of one chair order:
  value    the outcome z (AlphaZero; DESIGN §3 main head, correction 2: nothing blended into it), BCE, ONE position per
           game per epoch (AlphaGo's overfitting, DESIGN §2)
  aux      material (9-way), final HP difference (MSE), turns left (5-way): the student's own auxiliary heads, on the
           game's real end (not distilled)
  sv       two short-horizon SEARCH values (lambda-returns at horizons 1 and 3 turns; KataGo's auxiliary form), BCE on the soft
           target, every position
  am       the answer-map summary (an OFFLINE auxiliary target, never an input: abra/regmc 1.58.0), MSE, positions that carry it
  policy   tilt-v1 (solver/machamp/n7/net.js): s_k = exp(beta) lp_k + theta . bits_k over the DODUO decision's valid cells, from
           the DECIDING chair's hidden; cross-entropy to the search's root mix (AlphaZero's pi). An L2 on (beta, theta)
           keeps it at DODUO (the human-fitted prior) where the data are thin.
THE HUMAN ANCHOR (PLAN N7: "a human anchor keeps the human gate"). With --anchor-data, every step also distils the v2 teacher
on human TRAIN positions exactly as the student was trained (soft-target BCE plus 0.25 x the pooled auxiliary heads; v2's
tensors and the teacher cache of solver/porygon2/v3/student.py teacher). TEST rows are never read. Without it the run must
say --no-anchor, and the manifest says so.

SELECTION. The epoch with the lowest VAL loss = z log-loss (every VAL position) + policy cross-entropy (every VAL decision).
A checkpoint every epoch (atomic), resumed after a kill. Per-decision VAL cross-entropies of the head AND of its DODUO base
are written (val_policy.jsonl) so the offline gate can bootstrap the difference by game. BELOW_NORMAL from inside.

DELIBERATE BREAK (env N7_TRAIN_BREAK=nosave): the checkpoint is not written, so a killed run restarts at epoch 0 --
test-n7-loop.js RESUME must go red.
"""
import argparse, base64, ctypes, gzip, hashlib, json, math, os, sys, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('cmd', choices=['train', 'export'])
ap.add_argument('--data', default='')
ap.add_argument('--init', default='')
ap.add_argument('--out', default='')
ap.add_argument('--anchor-data', default='')
ap.add_argument('--anchor-teacher', default='')
ap.add_argument('--no-anchor', action='store_true')
ap.add_argument('--base-mag', default='')
ap.add_argument('--base-doduo', default='')
ap.add_argument('--epochs', type=int, default=5)
ap.add_argument('--lr', type=float, default=1e-3)
ap.add_argument('--wd', type=float, default=1e-4)
ap.add_argument('--bs', type=int, default=256)
ap.add_argument('--w-z', type=float, default=1.0)
ap.add_argument('--w-aux', type=float, default=0.25)
ap.add_argument('--w-sv', type=float, default=0.5)
ap.add_argument('--w-am', type=float, default=0.25)
ap.add_argument('--w-pol', type=float, default=1.0)
ap.add_argument('--w-l2', type=float, default=1e-2)
ap.add_argument('--w-anchor', type=float, default=1.0)
ap.add_argument('--anchor-aux', type=float, default=0.25)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--threads', type=int, default=4)
ap.add_argument('--patience', type=int, default=2)
ap.add_argument('--max-steps', type=int, default=0, help='smoke: cap optimiser steps per epoch')
ap.add_argument('--fixture-rows', type=int, default=24)
args = ap.parse_args()

if os.name == 'nt':
    try: ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
    except Exception as e: print('could not lower priority:', e)

import torch
import torch.nn as nn
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'porygon2', 'v2'))
import net as NT

torch.set_num_threads(args.threads); torch.set_num_interop_threads(1)
torch.manual_seed(args.seed); np.random.seed(args.seed)
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()
BREAK = os.environ.get('N7_TRAIN_BREAK', '')
CLASS_NAMES = ['stall_any', 'stall_double', 'switch_any', 'switch_double', 'mega', 'focus_same_foe', 'spread_any',
               'status_any', 'ally_target', 'stall_repeat_any', 'priority_any', 'repeat_move_any', 'immune_any', 'se_any']   # solver/gary/situation.js
NB = len(CLASS_NAMES)
KINDS = ['species', 'species', 'item', 'item', 'ability', 'ability', 'move', 'move', 'move', 'move']


def dec_w(w):
    return torch.from_numpy(np.frombuffer(base64.b64decode(w['f32_b64']), dtype='<f4').reshape(w['shape']).copy())


class Net(nn.Module):
    """the v3 student (solver/porygon2/v3/student.py Student, parameter names unchanged) + the N7 heads"""
    def __init__(self, VOC, TN, SN, FN, KN, D=NT.DIMS, h=32):
        super().__init__()
        self.h = h
        self.e_sp = nn.Embedding(len(VOC['species']), D['sp']); self.e_it = nn.Embedding(len(VOC['item']), D['it'])
        self.e_ab = nn.Embedding(len(VOC['ability']), D['ab']); self.e_mv = nn.Embedding(len(VOC['move']), D['mv'])
        tin = TN + 2 * D['sp'] + 2 * D['it'] + 2 * D['ab'] + D['mv']
        self.m1 = nn.Linear(tin, 48); self.m2 = nn.Linear(48, h)
        self.sp = nn.Linear(SN + KN, 16); self.fp = nn.Linear(FN, 16)
        self.e_rb = nn.Embedding(NT.NBINS, 8)
        self.r_c = nn.Parameter(torch.zeros(8))
        zin = 4 * h + 16 + 16 + 16 + 8 + 8 + 2
        self.h1 = nn.Linear(zin, 64); self.h2 = nn.Linear(64, 1)
        self.a_mat = nn.Linear(64, 9); self.a_hpd = nn.Linear(64, 1); self.a_nks = nn.Linear(64, 4); self.a_nkd = nn.Linear(64, 4); self.a_tl = nn.Linear(64, 5)
        self.a_sv = nn.Linear(64, 2); self.a_am = nn.Linear(64, 4)
        self.p = nn.Linear(64, 1 + NB)
        nn.init.zeros_(self.p.weight); nn.init.zeros_(self.p.bias)          # beta = theta = 0: DODUO exactly

    def members(self, B):
        ti = B['ti']
        mv = self.e_mv(ti[..., 6:10]).mean(-2)
        x = torch.cat([B['tn'], self.e_sp(ti[..., 0]), self.e_sp(ti[..., 1]), self.e_it(ti[..., 2]), self.e_it(ti[..., 3]),
                       self.e_ab(ti[..., 4]), self.e_ab(ti[..., 5]), mv], -1)
        return torch.relu(self.m2(torch.relu(self.m1(x))))

    def g(self, P, side, fd, B, a, b, bins, cont):
        ra = self.e_rb(bins[:, a]) + cont[:, a:a + 1] * self.r_c; rb = self.e_rb(bins[:, b]) + cont[:, b:b + 1] * self.r_c
        bs = B['bs'] if a == 0 else -B['bs']
        z = torch.cat([P[:, a], P[:, b], side[:, a], side[:, b], fd, ra, rb, bs], -1)
        hid = torch.relu(self.h1(z))
        return self.h2(hid).squeeze(-1), hid

    def forward(self, B):
        H = self.members(B)
        P = torch.cat([H.mean(2), H.max(2).values], -1)
        side = torch.relu(self.sp(torch.cat([B['sd'], B['fc']], -1)))
        fd = torch.relu(self.fp(B['fd']))
        bins, cont = NT.rating_parts(B['rt'])
        v12, h12 = self.g(P, side, fd, B, 0, 1, bins, cont)
        v21, h21 = self.g(P, side, fd, B, 1, 0, bins, cont)
        return v12 - v21, h12, h21


def build_from_json(J):
    nm = J['names']
    m = Net(J['vocab'], len(nm['tok']), len(nm['side']), len(nm['field']), len(nm['facts']), h=J['hidden'])
    sd = m.state_dict()
    for k, w in J['weights'].items():
        if k not in sd: raise SystemExit('n7/train: init weight ' + k + ' is not in the net')
        t = dec_w(w)
        if tuple(t.shape) != tuple(sd[k].shape): raise SystemExit(f'n7/train: init weight {k} shape {tuple(t.shape)} != {tuple(sd[k].shape)}')
        sd[k] = t
    pol = J.get('policy')
    if pol:
        if pol['class_names'] != CLASS_NAMES: raise SystemExit('n7/train: the init policy head has different class bits')
        for k, w in pol['weights'].items(): sd[k] = dec_w(w)
    m.load_state_dict(sd)
    return m


# ------------------------------------------------------------------ the self-play dataset
def load_rows(d):
    man = json.load(open(os.path.join(d, 'manifest.json')))
    f = os.path.join(d, man['output']['file'])
    if sha(f) != man['output']['sha256']: raise SystemExit('n7/train: ' + f + ' does not hash to its manifest')
    rows = [json.loads(l) for l in gzip.open(f, 'rt', encoding='utf8') if l.strip()]
    return man, rows


def tensorise(rows, VOC, nm, dt=np.float32):
    N = len(rows); TN, SN, FN, KN = len(nm['tok']), len(nm['side']), len(nm['field']), len(nm['facts'])
    tn = np.zeros((N, 2, 6, TN), dt); ti = np.ones((N, 2, 6, 10), np.int64); sd = np.zeros((N, 2, SN), dt)
    fc = np.zeros((N, 2, KN), dt); fd = np.zeros((N, FN), dt); bs = np.zeros((N, 2), dt); rt = np.zeros((N, 2), dt)
    oov = 0
    for i, r in enumerate(rows):
        X = r['X']
        for k, s in enumerate(['p1', 'p2']):
            tn[i, k] = np.asarray(X['tok'][s], dt)
            for t in range(6):
                for j in range(10):
                    v = VOC[KINDS[j]].get(X['ids'][s][t][j])
                    if v is None: v = 1; oov += 1
                    ti[i, k, t, j] = v
            sd[i, k] = X['side'][s]; fc[i, k] = X['facts'][s]
        fd[i] = X['field']; bs[i] = X['base']
        rt[i] = [np.nan if v is None else v for v in X['rating']]
    B = dict(tn=torch.from_numpy(tn), ti=torch.from_numpy(ti), sd=torch.from_numpy(sd), fd=torch.from_numpy(fd), fc=torch.from_numpy(fc),
             bs=torch.from_numpy(bs), rt=torch.from_numpy(rt))
    lab = dict(z=torch.tensor([float(r['z']) for r in rows]),
               has_aux=torch.tensor([1.0 if r.get('aux') else 0.0 for r in rows]),
               mat=torch.tensor([int(r['aux']['mat']) if r.get('aux') else 4 for r in rows]),
               hpd=torch.tensor([float(r['aux']['hpd']) if r.get('aux') else 0.0 for r in rows]),
               tl=torch.tensor([int(r['aux']['tl']) if r.get('aux') else 0 for r in rows]),
               sv=torch.tensor([r['sv'] for r in rows], dtype=torch.float32),
               has_am=torch.tensor([1.0 if r.get('am') else 0.0 for r in rows]),
               am=torch.tensor([r['am'] if r.get('am') else [0, 0, 0, 0] for r in rows], dtype=torch.float32))
    dec = []          # (row index, chair 0/1, lp, bits, target dense)
    for i, r in enumerate(rows):
        for d in r['dec']:
            K = d['K']; t = np.zeros(K, np.float32)
            for k, v in d['t'].items(): t[int(k)] = v
            bits = np.array([[(b >> q) & 1 for q in range(NB)] for b in d['bits']], np.float32)
            dec.append((i, 0 if d['side'] == 'A' else 1, np.asarray(d['lp'], np.float32), bits, t))
    return B, lab, dec, oov


def sub(B, idx):
    return {k: v[idx] for k, v in B.items()}


def policy_ce(model_out, dec_list, beta_theta_by_dec):
    """cross-entropy of the head and of the DODUO base on a list of decisions; returns (ce_head per dec, ce_base per dec, l2)"""
    ce, ceb, l2 = [], [], []
    for (lp, bits, t), e in zip(dec_list, beta_theta_by_dec):
        lpt = torch.from_numpy(lp); bt = torch.from_numpy(bits); tt = torch.from_numpy(t)
        s = torch.exp(e[0]) * lpt + bt @ e[1:]
        ce.append(-(tt * torch.log_softmax(s, -1)).sum())
        ceb.append(-(tt * torch.log_softmax(lpt, -1)).sum())
        l2.append((e ** 2).mean())
    return torch.stack(ce), torch.stack(ceb), torch.stack(l2)


# ------------------------------------------------------------------ the human anchor (solver/porygon2/v3/student.py)
class Anchor:
    def __init__(self, root, cache, VOC, rng):
        self.D = {f: NT.Data(root, f) for f in ('bo1', 'bo3')}
        self.TC = {}
        for f, Df in self.D.items():
            for s in Df.shards: s.remap_to(VOC)
            self.TC[f] = []
            for S in Df.shards:
                d = os.path.join(cache, f, os.path.basename(S.dir))
                self.TC[f].append({k: np.load(os.path.join(d, k + '.npy')) for k in ('logit', 'hpd', 'mat', 'nks', 'nkd', 'tl')})
        self.tr, self.va = [], []
        for f, Df in self.D.items():
            for si, S in enumerate(Df.shards):
                sp = S.M[:, S.col['split']]
                self.tr += [(f, si, int(x)) for x in np.nonzero(sp == 0)[0]]
                v = np.nonzero(sp == 1)[0]
                self.va += [(f, si, int(x)) for x in np.random.default_rng(1234).choice(v, size=min(len(v), 3000), replace=False)]
        for f, si, r in self.tr[:1000]:
            assert self.D[f].shards[si].M[r, self.D[f].shards[si].col['split']] != 2, 'a TEST row reached the anchor'
        self.rng = rng
        self.manifest = json.load(open(os.path.join(cache, 'manifest.json')))

    def assemble(self, items):
        by = {}
        for k, (f, si, r) in enumerate(items): by.setdefault((f, si), []).append((k, r))
        Bs, Ts, order = [], [], []
        for (f, si), lst in by.items():
            idx = np.array([x[0] for x in lst]); rr = np.array([x[1] for x in lst])
            B, _ = self.D[f].batch(np.full(len(rr), si), rr)
            Bs.append(B); order.append(idx)
            T = self.TC[f][si]; Ts.append({k: T[k][rr] for k in T})
        idx = np.concatenate(order); inv = np.empty(len(idx), np.int64); inv[idx] = np.arange(len(idx))
        B = {k: torch.cat([b[k] for b in Bs])[inv] for k in Bs[0]}
        T = {k: torch.from_numpy(np.concatenate([t[k] for t in Ts])[inv]) for k in Ts[0]}
        return B, T

    def batch(self, n):
        return self.assemble([self.tr[j] for j in self.rng.integers(0, len(self.tr), n)])


def anchor_loss(model, B, T, aux_w):
    logit, h12, _ = model(B)
    main = nn.functional.binary_cross_entropy_with_logits(logit, torch.sigmoid(T['logit']))
    la = 0.0
    for k, head in (('mat', model.a_mat), ('nks', model.a_nks), ('nkd', model.a_nkd), ('tl', model.a_tl)):
        la = la - (T[k] * torch.log_softmax(head(h12), -1)).sum(-1).mean()
    la = la + ((model.a_hpd(h12).squeeze(-1) - T['hpd']) ** 2).mean()
    return main + aux_w * la, main, logit


# ------------------------------------------------------------------ train
def train():
    os.makedirs(args.out, exist_ok=True)
    J = json.load(open(args.init, encoding='utf8'))
    if J.get('arch') != 'v3-student': raise SystemExit('n7/train: --init must be a v3-student file')
    model = build_from_json(J)
    init_model = build_from_json(J); init_model.eval()
    VOC, nm = J['vocab'], J['names']
    man, rows = load_rows(args.data)
    B, lab, dec, oov = tensorise(rows, VOC, nm)
    split = np.array([r['split'] for r in rows]); gid = [r['gid'] for r in rows]
    tr_idx = np.nonzero(split == 'train')[0]; va_idx = np.nonzero(split == 'val')[0]
    games_tr = {}
    for i in tr_idx: games_tr.setdefault(gid[i], []).append(i)
    dec_tr = [d for d in dec if split[d[0]] == 'train']; dec_va = [d for d in dec if split[d[0]] == 'val']
    if not len(tr_idx) or not dec_tr: raise SystemExit('n7/train: no training positions or decisions')
    rng = np.random.default_rng(args.seed)
    anchor = None
    if args.anchor_data:
        anchor = Anchor(args.anchor_data, args.anchor_teacher, VOC, np.random.default_rng(args.seed + 1))
    elif not args.no_anchor:
        raise SystemExit('n7/train: no --anchor-data: say --no-anchor to train without the human anchor (the manifest records it)')
    log(f'positions train {len(tr_idx)} val {len(va_idx)}; decisions train {len(dec_tr)} val {len(dec_va)}; games train {len(games_tr)}; oov ids {oov}; anchor {"on" if anchor else "OFF"}')
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
    bce = nn.functional.binary_cross_entropy_with_logits

    def pos_losses(idx, zmask):
        Bb = sub(B, torch.as_tensor(idx)); L = {k: v[idx] for k, v in lab.items()}
        logit, h12, h21 = model(Bb)
        zl = bce(logit, L['z'], reduction='none')
        lz = (zl * zmask).sum() / max(1.0, float(zmask.sum()))
        ha = L['has_aux']
        laux = ((nn.functional.cross_entropy(model.a_mat(h12), L['mat'], reduction='none') + nn.functional.cross_entropy(model.a_tl(h12), L['tl'], reduction='none')
                 + (model.a_hpd(h12).squeeze(-1) - L['hpd']) ** 2) * ha).sum() / max(1.0, float(ha.sum()))
        lsv = bce(model.a_sv(h12), L['sv'])
        hm = L['has_am']
        lam = (((model.a_am(h12) - L['am']) ** 2).mean(-1) * hm).sum() / max(1.0, float(hm.sum()))
        return lz, laux, lsv, lam, logit, h12, h21

    def dec_losses(dl):
        if not dl: return torch.zeros(()), torch.zeros(()), torch.zeros(()), None, None
        ri = sorted({d[0] for d in dl}); pos = {r: k for k, r in enumerate(ri)}
        _, _, _, _, _, h12, h21 = pos_losses(np.array(ri), torch.zeros(len(ri)))
        es = [model.p(h12[pos[d[0]]] if d[1] == 0 else h21[pos[d[0]]]) for d in dl]
        ce, ceb, l2 = policy_ce(None, [(d[2], d[3], d[4]) for d in dl], es)
        return ce.mean(), ceb.mean(), l2.mean(), ce, ceb

    CK = os.path.join(args.out, 'ckpt.pt')
    history, best, start = [], (1e18, None, -1), 0
    if os.path.exists(CK):
        C = torch.load(CK, map_location='cpu', weights_only=False)
        if C.get('data_sha256') != man['output']['sha256'] or C.get('init_sha256') != sha(args.init):
            raise SystemExit('n7/train: the checkpoint in ' + args.out + ' was made from a different dataset or init; refusing to resume onto it')
        model.load_state_dict(C['model']); opt.load_state_dict(C['opt']); sched.load_state_dict(C['sched'])
        rng.bit_generator.state = C['rng']; history = C['history']; best = C['best']; start = C['epoch'] + 1
        if anchor and C.get('anchor_rng'): anchor.rng.bit_generator.state = C['anchor_rng']
        log(f'RESUMED after epoch {C["epoch"]}')

    def evaluate():
        model.eval()
        with torch.no_grad():
            out = {}
            if len(va_idx):
                zm = torch.ones(len(va_idx))
                lz, laux, lsv, lam, logit, _, _ = pos_losses(va_idx, zm)
                Bv = sub(B, torch.as_tensor(va_idx))
                l0, _, _ = init_model(Bv)
                out.update(val_z_ll=float(lz), val_z_ll_init=float(bce(l0, lab['z'][va_idx])), val_aux=float(laux), val_sv=float(lsv), val_am=float(lam), val_positions=int(len(va_idx)))
            if dec_va:
                ce, ceb, l2, cev, cebv = dec_losses(dec_va)
                out.update(val_pol_ce=float(ce), val_pol_ce_base=float(ceb), val_decisions=len(dec_va))
            if anchor:
                Ba, Ta = anchor.assemble(anchor.va)
                _, main, lg = anchor_loss(model, Ba, Ta, 0.0)
                _, main0, _ = anchor_loss(init_model, Ba, Ta, 0.0)
                out.update(anchor_val_distill=float(main), anchor_val_distill_init=float(main0), anchor_val_rows=len(anchor.va))
        out['select'] = out.get('val_z_ll', 0.0) + out.get('val_pol_ce', 0.0)
        return out

    for ep in range(start, args.epochs):
        t0 = time.time(); model.train()
        # ONE position per training game carries the outcome loss this epoch (DESIGN §2)
        zpick = set(int(rng.choice(v)) for v in games_tr.values())
        perm = rng.permutation(tr_idx); dperm = rng.permutation(len(dec_tr))
        nsteps = max(1, math.ceil(len(perm) / args.bs))
        if args.max_steps: nsteps = min(nsteps, args.max_steps)
        dbs = max(1, math.ceil(len(dec_tr) / nsteps))
        tot = {k: 0.0 for k in ('z', 'aux', 'sv', 'am', 'pol', 'l2', 'anchor')}
        for st in range(nsteps):
            idx = perm[st * args.bs:(st + 1) * args.bs]
            if not len(idx): idx = perm[:args.bs]
            zm = torch.tensor([1.0 if int(i) in zpick else 0.0 for i in idx])
            opt.zero_grad()
            lz, laux, lsv, lam, _, _, _ = pos_losses(idx, zm)
            dl = [dec_tr[j] for j in dperm[st * dbs:(st + 1) * dbs]]
            lp, _, l2, _, _ = dec_losses(dl)
            loss = args.w_z * lz + args.w_aux * laux + args.w_sv * lsv + args.w_am * lam + args.w_pol * lp + args.w_l2 * l2
            la = torch.zeros(())
            if anchor:
                Ba, Ta = anchor.batch(args.bs)
                la, _, _ = anchor_loss(model, Ba, Ta, args.anchor_aux)
                loss = loss + args.w_anchor * la
            loss.backward(); opt.step()
            for k, v in (("z", lz), ("aux", laux), ("sv", lsv), ("am", lam), ("pol", lp), ("l2", l2), ("anchor", la)): tot[k] += float(v.detach()) if torch.is_tensor(v) else float(v)
        sched.step()
        ev = evaluate()
        rec = dict(epoch=ep, steps=nsteps, seconds=round(time.time() - t0, 1), train={k: v / nsteps for k, v in tot.items()}, **ev)
        history.append(rec)
        log(f'epoch {ep}: ' + json.dumps({k: (round(v, 5) if isinstance(v, float) else v) for k, v in rec.items() if k != 'train'}) + ' train ' + json.dumps({k: round(v, 5) for k, v in rec['train'].items()}))
        if ev['select'] < best[0]: best = (ev['select'], {k: v.clone() for k, v in model.state_dict().items()}, ep)
        if BREAK != 'nosave':
            C = {'epoch': ep, 'model': model.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'rng': rng.bit_generator.state, 'history': history, 'best': best,
                 'data_sha256': man['output']['sha256'], 'init_sha256': sha(args.init), 'anchor_rng': anchor.rng.bit_generator.state if anchor else None}
            torch.save(C, CK + '.tmp'); os.replace(CK + '.tmp', CK)
        if args.patience and ep - best[2] >= args.patience: log('no val improvement: stop'); break
    model.load_state_dict(best[1]); model.eval()
    # per-decision VAL cross-entropies, head and base, for the offline gate's game-clustered bootstrap
    with torch.no_grad():
        vp = []
        if dec_va:
            _, _, _, ce, ceb = dec_losses(dec_va)
            for d, a, b in zip(dec_va, ce.tolist(), ceb.tolist()): vp.append({'gid': gid[d[0]], 'ce': a, 'ce_base': b})
    with open(os.path.join(args.out, 'val_policy.jsonl'), 'w') as f:
        for v in vp: f.write(json.dumps(v) + '\n')
    mp = os.path.join(args.out, 'model.pt')
    torch.save({'state': model.state_dict(), 'init': J, 'names': nm, 'flags': vars(args)}, mp + '.tmp'); os.replace(mp + '.tmp', mp)
    metrics = {'what': 'N7 learner (solver/machamp/n7/train.py)', 'flags': vars(args), 'params': sum(p.numel() for p in model.parameters()),
               'value_params_exported': sum(v.numel() for k, v in model.state_dict().items() if not k.startswith(('a_', 'p.'))),
               'init': {'path': args.init.replace('\\', '/'), 'sha256': sha(args.init)},
               'data': {'dir': args.data.replace('\\', '/'), 'sha256': man['output']['sha256'], 'counts': man['counts']},
               'anchor': {'on': bool(anchor), 'data': args.anchor_data or None, 'teacher_cache': anchor.manifest if anchor else None},
               'positions': {'train': int(len(tr_idx)), 'val': int(len(va_idx))}, 'decisions': {'train': len(dec_tr), 'val': len(dec_va)}, 'oov_ids': oov,
               'selected_epoch': best[2], 'history': history, 'model': {'path': mp.replace('\\', '/'), 'sha256': sha(mp)}, 'seconds': round(time.time() - T0), 'torch': torch.__version__}
    json.dump(metrics, open(os.path.join(args.out, 'metrics.json'), 'w'), indent=1)
    log('selected epoch', best[2])


# ------------------------------------------------------------------ export
def export():
    ck = torch.load(os.path.join(args.out, 'model.pt'), map_location='cpu', weights_only=False)
    J0 = ck['init']; nm = ck['names']; fl = ck['flags']
    m = Net(J0['vocab'], len(nm['tok']), len(nm['side']), len(nm['field']), len(nm['facts']), h=J0['hidden']); m.load_state_dict(ck['state']); m.eval()
    b64 = lambda t: base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode('ascii')
    sd = m.state_dict()
    met = json.load(open(os.path.join(args.out, 'metrics.json')))
    J = {'model': 'N7 policy+value net (solver/machamp/n7/train.py): the PORYGON2 v3 student trunk, value on z, the tilt-v1 policy head', 'arch': 'v3-student',
         'feature_version': J0.get('feature_version'), 'hidden': J0['hidden'], 'release': J0.get('release'), 'names': J0['names'], 'vocab': J0['vocab'],
         'rating_edges': J0['rating_edges'], 'exported': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'torch': torch.__version__,
         'weights': {k: {'shape': list(v.shape), 'f32_b64': b64(v)} for k, v in sd.items() if not k.startswith(('a_', 'p.'))},
         'policy': {'arch': 'tilt-v1', 'class_names': CLASS_NAMES,
                    'base_prior': {'mag': sha(fl['base_mag']), 'doduo': sha(fl['base_doduo'])} if fl.get('base_mag') else None,
                    'weights': {k: {'shape': list(sd[k].shape), 'f32_b64': b64(sd[k])} for k in ('p.weight', 'p.bias')}},
         'n7': {'init': met['init'], 'data': {'sha256': met['data']['sha256']}, 'anchor': met['anchor']['on'], 'selected_epoch': met['selected_epoch'],
                'source_checkpoint': {'sha256': sha(os.path.join(args.out, 'model.pt'))}}}
    if J['policy']['base_prior'] is None: raise SystemExit('n7/train export: --base-mag / --base-doduo were not given at train time; the head would be unpinned')
    s = json.dumps(J, separators=(',', ':'))
    outf = os.path.join(args.out, 'net.json')
    open(outf + '.tmp', 'w', encoding='utf8').write(s); os.replace(outf + '.tmp', outf)
    digest = hashlib.sha256(s.encode('utf8')).hexdigest()
    print('wrote', outf, len(s), 'bytes sha256', digest)
    # the fixture: float64 forward of the EXPORTED (float32-rounded) weights on VAL rows (train rows if no VAL)
    m64 = Net(J0['vocab'], len(nm['tok']), len(nm['side']), len(nm['field']), len(nm['facts']), h=J0['hidden']).double()
    sd64 = m64.state_dict()
    Jr = json.loads(s)
    for k, w in Jr['weights'].items(): sd64[k] = dec_w(w).double()
    for k, w in Jr['policy']['weights'].items(): sd64[k] = dec_w(w).double()
    m64.load_state_dict(sd64); m64.eval()
    _, rows = load_rows(fl['data'])
    pick = [r for r in rows if r['split'] == 'val'] or rows
    pick = pick[:args.fixture_rows]
    B, _, _, _ = tensorise(pick, J0['vocab'], nm, np.float64)      # float64 inputs: the Node forward reads the JSON numbers as doubles
    Bd = {k: (v.double() if v.dtype.is_floating_point else v) for k, v in B.items()}
    with torch.no_grad():
        lg, h12, h21 = m64(Bd)
        ta, tb = m64.p(h12), m64.p(h21)
    fx = {'what': 'N7 net Node/Python agreement: encoded rows and the float64 outputs of the EXPORTED weights', 'model': {'path': outf.replace('\\', '/'), 'sha256': digest},
          'rows': [{'gid': r['gid'], 't': r['t'], 'x': r['X'], 'python_logit': float(lg[i]), 'python_tilt_A': ta[i].tolist(), 'python_tilt_B': tb[i].tolist()} for i, r in enumerate(pick)]}
    json.dump(fx, open(os.path.join(args.out, 'fixture.json'), 'w', encoding='utf8'))
    print('fixture', len(pick), 'rows')


{'train': train, 'export': export}[args.cmd]()
