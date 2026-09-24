"""solver/mag/train.py -- MAG v1 (per-slot action scorer) + DODUO v1 (joint two-slot coordinator).

    python solver/mag/train.py [--data solver/out/mag] [--out solver/mag/model] [--epochs 12]
                               [--threads 6] [--boot 1000] [--fixture solver/tests/fixtures/mag-doduo-v1-agree.json]
    python solver/mag/train.py --eval-only      # re-evaluate the EXPORTED json files, write metrics

PyTorch (CPU). The features are NOT computed here: they are the tensors solver/mag/build_features.js
wrote through solver/mag/features.js (= solver/prior/features.js + species identities), the same
function Node inference calls.

MAG v1, per slot, per candidate i (weights shared by both slots):
    x_i   = [ norm(ctx) ; norm(cand_i) ; E_mv[move_i] ; E_sp[target_i] ; E_sp[me, ally, foeA, foeB] ;
              mean E_sp[my sheet] ; mean E_sp[their sheet] ; mean E_sp[their revealed-alive] ]
    h1_i  = relu(W1 x_i + b1)
    h2_i  = relu(W2 [h1_i ; mean_k h1_k] + b2)          the slot's other options are in view
    s_i   = w3 . h2_i + b3                              MAG's score: P_MAG(i) = softmax_i s_i
DODUO v1, over the VALID joint cells (i, j) of a two-slot decision:
    L_ij  = s_a_i + s_b_j + r_a . h2_a_i + r_b . h2_b_j + u(h2_a_i) . v(h2_b_j) + wp . pair_ij
            + q . relu(Pa h2_a_i + Pb h2_b_j + Pp pair_ij + bq)
    P     = softmax over the valid joint cells.   One-slot decision: L_i = s_i + r . h2_i.
MAG alone predicts the joint as the factorised product (L_ij = s_a_i + s_b_j). Both are trained at
once: loss = joint NLL (DODUO) + factorised NLL (MAG), each = -log sum_{label cells} P, exactly as v0
(a hidden partner / uncertain target widens the label set, never guessed).
"""
import argparse, json, os, sys, time, hashlib, shutil

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='solver/out/mag')
ap.add_argument('--out', default='solver/mag/model')
ap.add_argument('--v0', default='solver/prior/model/prior-v0.json')
ap.add_argument('--v0-nopair', default='')
ap.add_argument('--epochs', type=int, default=12)
ap.add_argument('--hidden', type=int, default=128)
ap.add_argument('--emb', type=int, default=16)
ap.add_argument('--rank', type=int, default=16)
ap.add_argument('--pairq', type=int, default=64)
ap.add_argument('--batch', type=int, default=512)
ap.add_argument('--lr', type=float, default=2e-3)
ap.add_argument('--wd', type=float, default=1e-5)
ap.add_argument('--min-move-count', type=int, default=30)
ap.add_argument('--min-species-count', type=int, default=50)
ap.add_argument('--threads', type=int, default=6)
ap.add_argument('--boot', type=int, default=1000)
ap.add_argument('--seed', type=int, default=20260924)
ap.add_argument('--limit-train', type=int, default=0)
ap.add_argument('--fixture', default='')
ap.add_argument('--eval-only', action='store_true')
ap.add_argument('--fixture-only', action='store_true', help='write --fixture from the EXPORTED json files, nothing else')
args = ap.parse_args()
for k in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS'):
    os.environ[k] = str(args.threads)
import numpy as np
import torch
import torch.nn as nn
torch.set_num_threads(args.threads)
torch.set_num_interop_threads(1)

T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
META = json.load(open(os.path.join(args.data, 'meta.json')))
CTX_F, CAND_F = len(META['ctx_names']), len(META['cand_names'])
NP_ = len(META['pair_names'])
SX = len(META['slot_x_names'])
JS = {n: i for i, n in enumerate(META['joint_status'])}
SS = {n: i for i, n in enumerate(META['slot_status'])}
TC_ALLY = 2
KS_JOINT = [1, 4, 8, 12, 16, 24, 32]
KS_SLOT = [1, 2, 4, 8]
NEG = -1e30


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def load(split):
    d = os.path.join(args.data, split)
    S = {}
    S['ctx'] = np.fromfile(os.path.join(d, 'ctx.f32'), np.float32).reshape(-1, CTX_F)
    S['cand'] = np.fromfile(os.path.join(d, 'cand.f32'), np.float32).reshape(-1, CAND_F)
    S['attr'] = np.fromfile(os.path.join(d, 'cand_attr.i32'), np.int32).reshape(-1, 7)
    S['lab'] = np.fromfile(os.path.join(d, 'cand_label.u8'), np.uint8)
    S['slot'] = np.fromfile(os.path.join(d, 'slot.i32'), np.int32).reshape(-1, 5)
    S['dec'] = np.fromfile(os.path.join(d, 'dec.i32'), np.int32).reshape(-1, 7)
    S['sx'] = np.fromfile(os.path.join(d, 'slot_x.i32'), np.int32).reshape(-1, SX)
    S['cx'] = np.fromfile(os.path.join(d, 'cand_x.i32'), np.int32)
    assert len(S['sx']) == len(S['slot']) and len(S['cx']) == len(S['cand'])
    return S


# ------------------------------------------------------------------ batching (v0's gather + the extras)
def gather(S, slot_ids, K):
    present = slot_ids >= 0
    sid = np.where(present, slot_ids, 0)
    start = S['slot'][sid, 0]; n = np.where(present, S['slot'][sid, 1], 0)
    ar = np.arange(K)
    mask = ar[None, :] < n[:, None]
    idx = np.where(mask, start[:, None] + ar[None, :], 0)
    return dict(ctx=S['ctx'][sid], cand=S['cand'][idx], attr=S['attr'][idx], mask=mask,
                lab=(S['lab'][idx] > 0) & mask, present=present, sx=S['sx'][sid], cx=S['cx'][idx])


def pair_feats(pa, pb):
    """Mirrors solver/prior/features.js pairFeat / pairValid (the v0 definition, unchanged)."""
    ma, tca, sta, swa, toa, spa, mga = [pa[..., i][:, :, None] for i in range(7)]
    mb, tcb, stb, swb, tob, spb, mgb = [pb[..., i][:, None, :] for i in range(7)]
    foe_a = (tca == 0) | (tca == 1); foe_b = (tcb == 0) | (tcb == 1)
    P = np.stack([
        (swa == 0) & (swb == 0) & foe_a & foe_b & (tca == tcb),
        (sta == 1) & (stb == 1),
        (swa == 1) & (swb == 1),
        (swa == 0) & (swb == 0) & (ma == mb) & (ma != 2),
        (tca == TC_ALLY) | (tcb == TC_ALLY),
        (spa == 1) & (spb == 1),
    ], -1).astype(np.float32)
    valid = ~(((swa == 1) & (swb == 1) & (toa == tob)) | ((mga == 1) & (mgb == 1)))
    return P, valid


def batch(S, dec_ids):
    D = S['dec'][dec_ids]
    sa, sb = D[:, 0], D[:, 1]
    na = np.where(sa >= 0, S['slot'][np.maximum(sa, 0), 1], 1)
    nb = np.where(sb >= 0, S['slot'][np.maximum(sb, 0), 1], 1)
    K = int(max(na.max(), nb.max()))
    A = gather(S, sa, K); B = gather(S, sb, K)
    P, valid = pair_feats(A['attr'], B['attr'])
    ma = A['mask'].copy(); mb = B['mask'].copy()
    ma[~A['present'], 0] = True; mb[~B['present'], 0] = True          # an empty slot = one null candidate
    la = A['lab'].copy(); lb = B['lab'].copy()
    la[~A['present'], 0] = True; lb[~B['present'], 0] = True
    both = (A['present'] & B['present'])[:, None, None]
    valid = np.where(both, valid, True) & ma[:, :, None] & mb[:, None, :]
    P = P * both[..., None]
    lab = valid & la[:, :, None] & lb[:, None, :]
    return dict(A=A, B=B, P=P, valid=valid, lab=lab, K=K, D=D, both=both[:, 0, 0])


def v0_view(b):
    """the tuple layout the v0 evaluator expects: (ctx, cand, attr, mask, lab, present)"""
    return {k: (None, None, b[k]['attr'], b[k]['mask'], b[k]['lab'], b[k]['present']) for k in ('A', 'B')}


# ------------------------------------------------------------------ the model
class MagDoduo(nn.Module):
    def __init__(s, n_mv, n_sp, mu, sd):
        super().__init__()
        E, H = args.emb, args.hidden
        s.register_buffer('mu', torch.tensor(mu, dtype=torch.float32))
        s.register_buffer('sd', torch.tensor(sd, dtype=torch.float32))
        s.E_mv = nn.Embedding(n_mv, E)
        s.E_sp = nn.Embedding(n_sp, E, padding_idx=0)                  # row 0 = no species (pad), row 1 = rare
        din = CTX_F + CAND_F + E + E + 4 * E + 3 * E
        s.l1 = nn.Linear(din, H); s.l2 = nn.Linear(2 * H, H); s.s = nn.Linear(H, 1)
        # DODUO
        R, Q = args.rank, args.pairq
        s.ra = nn.Linear(H, 1, bias=False); s.rb = nn.Linear(H, 1, bias=False)
        s.U = nn.Linear(H, R, bias=False); s.V = nn.Linear(H, R, bias=False)
        s.wp = nn.Linear(NP_, 1, bias=False)
        s.Pa = nn.Linear(H, Q, bias=False); s.Pb = nn.Linear(H, Q, bias=True); s.Pp = nn.Linear(NP_, Q, bias=False)
        s.q = nn.Linear(Q, 1, bias=False)
        nn.init.zeros_(s.ra.weight); nn.init.zeros_(s.rb.weight); nn.init.zeros_(s.wp.weight); nn.init.zeros_(s.q.weight)
        nn.init.normal_(s.U.weight, 0, 0.05); nn.init.normal_(s.V.weight, 0, 0.05)

    def slot(s, T, mrow, srow):
        """T: tensors of one slot position: ctx [B,C], cand [B,K,F], mv [B,K], cx [B,K], sx [B,SX], mask [B,K]"""
        Bn, K = T['mask'].shape
        feat = (torch.cat([T['ctx'][:, None, :].expand(Bn, K, CTX_F), T['cand']], -1) - s.mu) / s.sd
        e_mv = s.E_mv(mrow[T['mv']])
        e_tx = s.E_sp(srow[T['cx']])
        sxr = srow[T['sx']]                                             # [B,SX]
        e_sx = s.E_sp(sxr)                                              # [B,SX,E]
        ident = e_sx[:, :4].reshape(Bn, -1)
        bags = []
        for lo in (4, 10, 16):
            m = (sxr[:, lo:lo + 6] > 0).float()[..., None]
            bags.append((e_sx[:, lo:lo + 6] * m).sum(1) / m.sum(1).clamp(min=1.0))
        slotv = torch.cat([ident] + bags, -1)[:, None, :].expand(Bn, K, -1)
        x = torch.cat([feat, e_mv, e_tx, slotv], -1)
        h1 = torch.relu(s.l1(x))
        mk = T['mask'].float()[..., None]
        pool = (h1 * mk).sum(1, keepdim=True) / mk.sum(1, keepdim=True).clamp(min=1.0)
        h2 = torch.relu(s.l2(torch.cat([h1, pool.expand_as(h1)], -1)))
        sc = s.s(h2)[..., 0]
        pm = T['present'].float()[:, None]
        return sc * pm, h2 * pm[..., None]

    def forward(s, TA, TB, P, valid, both, mrow, srow):
        sa, ha = s.slot(TA, mrow, srow); sb, hb = s.slot(TB, mrow, srow)
        Lmag = sa[:, :, None] + sb[:, None, :]
        bo = both.float()[:, None, None]
        pa = TA['present'].float()[:, None]; pb = TB['present'].float()[:, None]
        un = (s.ra(ha)[..., 0] * pa)[:, :, None] + (s.rb(hb)[..., 0] * pb)[:, None, :]
        bil = torch.einsum('bir,bjr->bij', s.U(ha), s.V(hb))
        z = torch.relu(s.Pa(ha)[:, :, None, :] + s.Pb(hb)[:, None, :, :] + s.Pp(P))
        pair = bil + s.wp(P)[..., 0] + s.q(z)[..., 0]
        Ljoint = Lmag + un + pair * bo
        Lmag = Lmag.masked_fill(~valid, NEG); Ljoint = Ljoint.masked_fill(~valid, NEG)
        return Ljoint, Lmag


def to_t(b, dtype=torch.float32):
    out = []
    for k in ('A', 'B'):
        g = b[k]
        out.append(dict(ctx=torch.from_numpy(np.ascontiguousarray(g['ctx'])).to(dtype),
                        cand=torch.from_numpy(np.ascontiguousarray(g['cand'])).to(dtype),
                        mv=torch.from_numpy(g['attr'][..., 0].astype(np.int64)),
                        cx=torch.from_numpy(g['cx'].astype(np.int64)),
                        sx=torch.from_numpy(g['sx'].astype(np.int64)),
                        mask=torch.from_numpy(g['mask']), present=torch.from_numpy(g['present'])))
    return out[0], out[1], torch.from_numpy(b['P']).to(dtype), torch.from_numpy(b['valid']), torch.from_numpy(b['both'])


def nll(L, lab):
    Bn = L.shape[0]
    flat = L.reshape(Bn, -1); labf = lab.reshape(Bn, -1)
    return torch.logsumexp(flat, 1) - torch.logsumexp(flat.masked_fill(~labf, NEG), 1)


# ------------------------------------------------------------------ v0, re-implemented from its exported json (the comparator)
def v0_scorer(path, meta_inv_vocab):
    J = json.load(open(path))
    p = {k: torch.tensor(np.array(v, dtype=np.float64)) for k, v in J['params'].items()}
    mu, sd = torch.tensor(J['mu']), torch.tensor(J['sd'])
    row = torch.tensor([J['emb_rows'].get(meta_inv_vocab[i], 0) if meta_inv_vocab[i] != '<pad>' else 0 for i in range(len(meta_inv_vocab))])

    def slot(g):
        Bn, K = g['mask'].shape
        ctx = torch.from_numpy(g['ctx']).double()[:, None, :].expand(Bn, K, CTX_F)
        feat = (torch.cat([ctx, torch.from_numpy(g['cand']).double()], -1) - mu) / sd
        x = torch.cat([feat, p['E'][row[torch.from_numpy(g['attr'][..., 0].astype(np.int64))]]], -1)
        h = torch.relu(x @ p['W1'].T + p['b1'])
        pm = torch.from_numpy(g['present']).double()[:, None]
        return (h @ p['w2']) * pm, (h @ p['U'].T) * pm[..., None], (h @ p['V'].T) * pm[..., None]

    def score(b):
        with torch.no_grad():
            sa, ua, _ = slot(b['A']); sb, _, vb = slot(b['B'])
            L = sa[:, :, None] + sb[:, None, :]
            if J['pair']:
                L = L + torch.einsum('bir,bjr->bij', ua, vb) + torch.from_numpy(b['P']).double() @ p['wp']
            return np.where(b['valid'], L.numpy(), -np.inf)
    return score, sha(path)


# ------------------------------------------------------------------ evaluation (v0's per-decision metrics, unchanged)
def eval_logits(L, b, S):
    Bn, K, _ = L.shape
    flat = L.reshape(Bn, -1)
    mx = flat.max(1, keepdims=True)
    lp = flat - mx - np.log(np.exp(flat - mx).sum(1, keepdims=True))
    D = b['D']; js = D[:, 2]
    exact_joint = js == JS['exact']
    labf = b['lab'].reshape(Bn, -1)
    out = {}
    lab_lp = np.where(labf, lp, -np.inf).max(1)
    out['joint_ll'] = np.where(exact_joint, -lab_lp, np.nan)
    order = np.argsort(-lp, 1, kind='stable')
    rank = np.full(Bn, 10 ** 6)
    li = labf.argmax(1)
    for bi in np.nonzero(exact_joint)[0]:
        rank[bi] = int(np.nonzero(order[bi] == li[bi])[0][0]) + 1
    for k in KS_JOINT:
        out[f'joint_r{k}'] = np.where(exact_joint, (rank <= k).astype(float), np.nan)
    out['joint_outside'] = (js == JS['outside']).astype(float)
    A, B = b['A'], b['B']
    la, lb = A['lab'].argmax(1), B['lab'].argmax(1)
    ar = np.arange(Bn)
    atA, atB = A['attr'][ar, la], B['attr'][ar, lb]
    pa, pb = A['present'], B['present']
    has = lambda col: ((pa & (atA[:, col] == 1)) | (pb & (atB[:, col] == 1)))
    for name, flag in (('switch', has(3)), ('mega', has(6)), ('stall', has(2)), ('turn1', D[:, 4] == 0)):
        out[f'flag_{name}'] = np.where(exact_joint, flag.astype(float), np.nan)
    out['two_slot'] = ((D[:, 0] >= 0) & (D[:, 1] >= 0)).astype(float)
    P = np.exp(lp.reshape(Bn, K, K))
    for side_i, (part, marg) in enumerate(((A, P.sum(2)), (B, P.sum(1)))):
        sid = D[:, side_i]
        present = sid >= 0
        status = np.where(present, S['slot'][np.maximum(sid, 0), 2], -1)
        ex = present & (status == SS['exact'])
        lab = part['lab']
        pl = np.where(ex, (marg * lab).sum(1), np.nan)
        out[f's{side_i}_ll'] = np.where(ex, -np.log(np.maximum(pl, 1e-300)), np.nan)
        lm = np.where(part['mask'], marg, -1)
        orders = np.argsort(-lm, 1, kind='stable')
        lidx = lab.argmax(1)
        r = np.array([int(np.nonzero(orders[i] == lidx[i])[0][0]) + 1 if ex[i] else 10 ** 6 for i in range(Bn)])
        for k in KS_SLOT:
            out[f's{side_i}_r{k}'] = np.where(ex, (r <= k).astype(float), np.nan)
    return out


def run_eval(S, scorers, bs=512):
    n = len(S['dec'])
    acc = {k: None for k in scorers}
    for i in range(0, n, bs):
        b = batch(S, np.arange(i, min(n, i + bs)))
        for name, fn in scorers.items():
            o = eval_logits(fn(b), b, S)
            acc[name] = o if acc[name] is None else {k: np.concatenate([acc[name][k], o[k]]) for k in o}
    return acc


def summarise(res, players, boot, seed, ref=None, mask=None):
    """Point estimate + player-cluster bootstrap 95% CI; with ref, the PAIRED difference res - ref on
    the same resampled players. mask restricts both to a subset of decisions."""
    up, inv = np.unique(players, return_inverse=True)
    G = len(up)
    W = np.random.default_rng(seed).multinomial(G, np.ones(G) / G, size=boot).astype(np.float64)
    keys = [k for k in res if k.startswith('joint_') and not k.endswith('outside') or k.startswith('s0_') or k.startswith('s1_')]
    out = {}

    def sums(v):
        v = v if mask is None else np.where(mask, v, np.nan)
        m = ~np.isnan(v)
        return np.bincount(inv[m], weights=v[m], minlength=G), np.bincount(inv[m], minlength=G).astype(float)
    for k in keys:
        s, c = sums(res[k])
        bs_ = (W @ s) / np.maximum(W @ c, 1)
        row = {'est': s.sum() / max(c.sum(), 1), 'lo': float(np.percentile(bs_, 2.5)), 'hi': float(np.percentile(bs_, 97.5)), 'n': int(c.sum())}
        if ref is not None:
            s2, c2 = sums(ref[k])
            d = bs_ - (W @ s2) / np.maximum(W @ c2, 1)
            row['ref'] = s2.sum() / max(c2.sum(), 1)
            row['diff'] = row['est'] - row['ref']
            row['diff_lo'] = float(np.percentile(d, 2.5)); row['diff_hi'] = float(np.percentile(d, 97.5))
        out[k] = row
    return out


# ------------------------------------------------------------------ export / import
def export(model, mrow_names, srow_names, history, mu, sd):
    os.makedirs(args.out, exist_ok=True)
    P = {k: v.detach().double().numpy().tolist() for k, v in model.state_dict().items() if k not in ('mu', 'sd')}
    common = {'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'generator': 'solver/mag/train.py',
              'torch': torch.__version__, 'numpy': np.__version__,
              'dataset': META['dataset'], 'split': META['split'], 'feature_version': 'v1.0', 'v0_feature_version': META['v0_feature_version']}
    freq_src = os.path.join(args.data, 'freq.json')
    freq_v0 = os.path.join('solver', 'prior', 'model', 'freq-v0.json')
    if sha(freq_src) == sha(freq_v0):
        freq_ref = {'path': freq_v0, 'sha256': sha(freq_v0), 'note': 'the builder regenerated the train-actor tables byte-identical to v0'}
    else:
        dst = os.path.join(args.out, 'freq-v1.json'); shutil.copyfile(freq_src, dst)
        freq_ref = {'path': dst.replace('\\', '/'), 'sha256': sha(dst)}
    mag_keys = ['E_mv.weight', 'E_sp.weight', 'l1.weight', 'l1.bias', 'l2.weight', 'l2.bias', 's.weight', 's.bias']
    mag = {'name': 'mag-v1', 'kind': 'MAG v1: per-slot action scorer (human policy prior, per slot)', **common,
           'hyper': {k: getattr(args, k) for k in ('hidden', 'emb', 'batch', 'lr', 'wd', 'epochs', 'min_move_count', 'min_species_count', 'seed')},
           'ctx_names': META['ctx_names'], 'cand_names': META['cand_names'], 'slot_x_names': META['slot_x_names'],
           'mu': np.asarray(mu, np.float64).tolist(), 'sd': np.asarray(sd, np.float64).tolist(),
           'move_rows': {n: i for i, n in enumerate(mrow_names)}, 'species_rows': {n: i for i, n in enumerate(srow_names)},
           'freq': freq_ref, 'params': {k: P[k] for k in mag_keys}, 'val_history': history}
    mpath = os.path.join(args.out, 'mag-v1.json')
    json.dump(mag, open(mpath, 'w'))
    dod = {'name': 'doduo-v1', 'kind': 'DODUO v1: joint two-slot coordinator over MAG v1', **common,
           'mag': {'path': mpath.replace('\\', '/'), 'sha256': sha(mpath)},
           'hyper': {k: getattr(args, k) for k in ('rank', 'pairq')}, 'pair_names': META['pair_names'],
           'params': {k: P[k] for k in P if k not in mag_keys}, 'val_history': history}
    dpath = os.path.join(args.out, 'doduo-v1.json')
    json.dump(dod, open(dpath, 'w'))
    return mpath, dpath


def import_model(mpath, dpath, dtype=torch.float64):
    M = json.load(open(mpath)); Dj = json.load(open(dpath))
    assert Dj['mag']['sha256'] == sha(mpath), 'DODUO was trained over a different MAG file'
    model = MagDoduo(len(M['move_rows']), len(M['species_rows']), M['mu'], M['sd'])
    sd_ = {k: torch.tensor(np.array(v)) for k, v in {**M['params'], **Dj['params']}.items()}
    sd_['mu'] = torch.tensor(M['mu']); sd_['sd'] = torch.tensor(M['sd'])
    model.load_state_dict(sd_)
    return model.to(dtype).eval(), M, Dj


def row_maps(M_move_rows, M_species_rows):
    inv_mv = {v: k for k, v in META['move_vocab'].items()}
    inv_sp = {v: k for k, v in META['species_vocab'].items()}
    mrow = torch.tensor([M_move_rows.get(inv_mv[i], 0) if inv_mv[i] != '<pad>' else 0 for i in range(len(inv_mv))])
    # species vocab id 0 is '<unk>' = no species (pad row 0); a species with no row of its own is row 1 (rare)
    srow = torch.tensor([0 if i == 0 else M_species_rows.get(inv_sp[i], 1) for i in range(len(inv_sp))])
    return mrow, srow


# ------------------------------------------------------------------ main
def main():
    torch.manual_seed(args.seed)
    rng = np.random.default_rng(args.seed)
    log('torch', torch.__version__, 'threads', torch.get_num_threads(), '| data', args.data, META['dataset']['games_sha256'][:12])
    if args.fixture_only:
        TE = load('test')
        mpath, dpath = os.path.join(args.out, 'mag-v1.json'), os.path.join(args.out, 'doduo-v1.json')
        model, M, Dj = import_model(mpath, dpath)
        mrow, srow = row_maps(M['move_rows'], M['species_rows'])
        write_fixture(TE, model, M, Dj, mpath, dpath, mrow, srow)
        return
    if args.eval_only:
        TE, TR_slot = load('test'), None
        evaluate(TE, os.path.join(args.out, 'mag-v1.json'), os.path.join(args.out, 'doduo-v1.json'))
        return
    TR, VA = load('train'), load('val')
    log('train decisions', len(TR['dec']), 'cands', len(TR['cand']), '| val', len(VA['dec']))

    # normalisation from TRAIN (chunked float64, the 5.9M x 30 cand table is 700 MB as float32)
    def mstd(a):
        s = np.zeros(a.shape[1]); s2 = np.zeros(a.shape[1])
        for i in range(0, len(a), 1 << 20):
            c = a[i:i + (1 << 20)].astype(np.float64); s += c.sum(0); s2 += (c * c).sum(0)
        m = s / len(a); return m, np.sqrt(np.maximum(s2 / len(a) - m * m, 0))
    m1, s1 = mstd(TR['ctx']); m2, s2 = mstd(TR['cand'])
    mu = np.concatenate([m1, m2]); sd = np.concatenate([s1, s2]); sd = np.where(sd < 1e-6, 1.0, sd)
    mu = mu.astype(np.float32).astype(np.float64); sd = sd.astype(np.float32).astype(np.float64)   # the float32 values torch uses ARE the exported ones

    # embedding rows: moves as v0 (>= min train labels, else the shared UNK row 0); species by TRAIN occurrence
    inv_mv = {v: k for k, v in META['move_vocab'].items()}
    cnt = META['move_train_count']
    mrow_names = ['<unk>']
    for i in range(len(inv_mv)):
        n = inv_mv[i]
        c = cnt.get(n, 0) if n not in ('SWITCH', 'LOCKED') else 10 ** 9
        if n != '<pad>' and c >= args.min_move_count:
            mrow_names.append(n)
    inv_sp = {v: k for k, v in META['species_vocab'].items()}
    spc = np.bincount(TR['sx'].ravel(), minlength=len(inv_sp))
    srow_names = ['', '<rare>'] + [inv_sp[i] for i in range(1, len(inv_sp)) if spc[i] >= args.min_species_count]
    mrow, srow = row_maps({n: i for i, n in enumerate(mrow_names)}, {n: i for i, n in enumerate(srow_names)})
    log('move rows', len(mrow_names), 'species rows', len(srow_names))

    model = MagDoduo(len(mrow_names), len(srow_names), mu, sd)
    log('parameters', sum(p.numel() for p in model.parameters()))
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)

    def informative(S):
        D = S['dec']
        st = lambda col: np.where(D[:, col] >= 0, S['slot'][np.maximum(D[:, col], 0), 2], -1)
        inf_ = lambda s: (s == SS['exact']) | (s == SS['uncertain_target'])
        return (D[:, 2] != JS['outside']) & (inf_(st(0)) | inf_(st(1)))
    tr_ids = np.nonzero(informative(TR))[0]
    if args.limit_train:
        tr_ids = tr_ids[:args.limit_train]
    va_ids = np.nonzero(informative(VA))[0]
    log('trainable', len(tr_ids), 'val', len(va_ids))

    def val_loss():
        model.eval(); tj = tm = 0.0
        with torch.no_grad():
            for i in range(0, len(va_ids), 1024):
                b = batch(VA, va_ids[i:i + 1024]); TA, TB, P, valid, both = to_t(b)
                Lj, Lm = model(TA, TB, P, valid, both, mrow, srow)
                lab = torch.from_numpy(b['lab'])
                tj += nll(Lj, lab).sum().item(); tm += nll(Lm, lab).sum().item()
        model.train(); return tj / len(va_ids), tm / len(va_ids)

    steps = int(np.ceil(len(tr_ids) / args.batch)) * args.epochs
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.05)
    best, best_state, history, step = np.inf, None, [], 0
    for ep in range(args.epochs):
        perm = rng.permutation(tr_ids)
        rj = rm = 0.0
        for i in range(0, len(perm), args.batch):
            b = batch(TR, perm[i:i + args.batch]); TA, TB, P, valid, both = to_t(b)
            Lj, Lm = model(TA, TB, P, valid, both, mrow, srow)
            lab = torch.from_numpy(b['lab'])
            lj = nll(Lj, lab).mean(); lm = nll(Lm, lab).mean()
            opt.zero_grad(); (lj + lm).backward(); opt.step(); sched.step(); step += 1
            rj += lj.item(); rm += lm.item()
            if step % 200 == 0:
                log(f'ep {ep} step {step}/{steps} joint {rj / 200:.4f} mag {rm / 200:.4f}'); rj = rm = 0.0
        vj, vm = val_loss()
        history.append({'epoch': ep, 'val_joint': vj, 'val_mag_factorised': vm})
        log(f'epoch {ep} val joint {vj:.4f}  mag-factorised {vm:.4f}')
        if vj < best:
            best = vj; best_state = {k: v.clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    mpath, dpath = export(model, mrow_names, srow_names, history, mu, sd)
    log('exported', mpath, dpath)
    del TR, VA
    TE = load('test')
    # the export is the model: re-import it in float64 and hold it to the in-memory float32 weights
    m64, _, _ = import_model(mpath, dpath)
    b = batch(TE, np.arange(0, 512))
    with torch.no_grad():
        l32 = model(*to_t(b), mrow, srow)[0].numpy(); l64 = m64(*to_t(b, torch.float64), mrow.clone(), srow.clone())[0].numpy()
    v = b['valid']
    worst = float(np.abs(l32[v] - l64[v]).max())
    log('export check: float32 in-memory vs float64 from json, worst |dlogit|', worst)
    assert worst < 1e-3, 'exported model does not reproduce the trained one'
    evaluate(TE, mpath, dpath)


def evaluate(TE, mpath, dpath):
    model, M, Dj = import_model(mpath, dpath)
    mrow, srow = row_maps(M['move_rows'], M['species_rows'])
    inv_mv = {v: k for k, v in META['move_vocab'].items()}
    v0fn, v0sha = v0_scorer(args.v0, inv_mv)

    def v1(which):
        def f(b):
            with torch.no_grad():
                Lj, Lm = model(*to_t(b, torch.float64), mrow, srow)
            L = (Lj if which == 'joint' else Lm).numpy()
            return np.where(b['valid'], L, -np.inf)
        return f
    scorers = {'doduo_v1': v1('joint'), 'mag_v1': v1('mag'), 'prior_v0': v0fn}
    if args.v0_nopair:
        scorers['prior_v0_nopair'] = v0_scorer(args.v0_nopair, inv_mv)[0]
    log('eval on TEST players', len(TE['dec']), 'decisions:', list(scorers))
    R = run_eval(TE, scorers)
    players = TE['dec'][:, 6]
    ref = R['prior_v0']
    subsets = {'all': None, 'two_slot': R['doduo_v1']['two_slot'] > 0,
               'switch': R['doduo_v1']['flag_switch'] == 1, 'no_switch': R['doduo_v1']['flag_switch'] == 0,
               'turn1': R['doduo_v1']['flag_turn1'] == 1, 'later_turns': R['doduo_v1']['flag_turn1'] == 0,
               'mega': R['doduo_v1']['flag_mega'] == 1, 'stall': R['doduo_v1']['flag_stall'] == 1}
    out = {}
    for sub, m in subsets.items():
        out[sub] = {name: summarise(R[name], players, args.boot, args.seed + 1, ref=None if name == 'prior_v0' else ref, mask=m) for name in scorers}
    # DODUO's own question: does the coordinator add anything over MAG alone? (paired, same players)
    doduo_vs_mag = {sub: summarise(R['doduo_v1'], players, args.boot, args.seed + 1, ref=R['mag_v1'], mask=m) for sub, m in subsets.items()}
    D = TE['dec']
    metrics = {'models': {'mag_v1': {'path': mpath.replace('\\', '/'), 'sha256': sha(mpath)}, 'doduo_v1': {'path': dpath.replace('\\', '/'), 'sha256': sha(dpath)},
                          'prior_v0': {'path': args.v0, 'sha256': v0sha}},
               'evaluated_from': 'the exported json files, float64', 'torch': torch.__version__,
               'dataset': META['dataset'], 'split': META['split'],
               'test': {'decisions': int(len(D)), 'players': int(len(np.unique(players))),
                        'joint_status': {n: int((D[:, 2] == i).sum()) for n, i in JS.items()}},
               'ci': f'95% player-cluster bootstrap, {args.boot} resamples; paired differences use the same resamples; diff = model - prior_v0',
               'by_subset': out, 'doduo_vs_mag_alone': doduo_vs_mag, 'seconds': time.time() - T0}
    json.dump(metrics, open(os.path.join(args.out, 'mag-doduo-v1.metrics.json'), 'w'), indent=1)
    a = out['all']
    for name in scorers:
        r = a[name]
        log(f"{name:16s} ll {r['joint_ll']['est']:.3f}  r4 {r['joint_r4']['est']:.3f} r8 {r['joint_r8']['est']:.3f} r12 {r['joint_r12']['est']:.3f} r16 {r['joint_r16']['est']:.3f}")
    if args.fixture:
        write_fixture(TE, model, M, Dj, mpath, dpath, mrow, srow)


def write_fixture(TE, model, M, Dj, mpath, dpath, mrow, srow):
    # 12 test games spread across the split; EVERY decision of those games (every joint status,
    # one-slot and two-slot), capped at 90: the Node path must agree on every kind of decision
    gid = TE['dec'][:, 3]
    ug = np.unique(gid)
    games = [int(g) for g in ug[np.linspace(0, len(ug) - 1, 12).astype(int)]]
    pick = np.nonzero(np.isin(gid, games))[0][:90]
    games = sorted(set(int(g) for g in gid[pick]))
    b = batch(TE, pick)
    with torch.no_grad():
        Lj, Lm = model(*to_t(b, torch.float64), mrow, srow)
    Lj, Lm = Lj.numpy(), Lm.numpy()
    fx = []
    for j, i in enumerate(pick):
        d = TE['dec'][i]
        na = TE['slot'][d[0], 1] if d[0] >= 0 else 1
        nb = TE['slot'][d[1], 1] if d[1] >= 0 else 1
        feats = []
        for col in (0, 1):
            if d[col] < 0:
                feats.append(None); continue
            st, n = TE['slot'][d[col], 0], TE['slot'][d[col], 1]
            feats.append({'ctx': TE['ctx'][d[col]].astype(float).tolist(), 'cand': TE['cand'][st:st + n].astype(float).tolist(),
                          'sx': TE['sx'][d[col]].tolist(), 'cx': TE['cx'][st:st + n].tolist(),
                          'label': TE['lab'][st:st + n].astype(int).tolist()})
        cell = lambda x, ok: None if not ok else float(x)
        fx.append({'game': int(d[3]), 'turn': int(d[4]), 'side': ['p1', 'p2'][int(d[5])], 'joint_status': META['joint_status'][int(d[2])],
                   'features': feats,
                   'joint': [[cell(Lj[j, a, c], b['valid'][j, a, c]) for c in range(nb)] for a in range(na)],
                   'mag': [[cell(Lm[j, a, c], b['valid'][j, a, c]) for c in range(nb)] for a in range(na)]})
    rows, want = {}, set(games)
    with open(META['dataset']['read_from'], 'r', encoding='utf8') as fh:
        gi = 0
        for line in fh:
            if not line.strip():
                continue
            if gi in want:
                rows[gi] = json.loads(line)
                if len(rows) == len(want):
                    break
            gi += 1
    inv_sp = {v: k for k, v in META['species_vocab'].items()}
    json.dump({'mag_sha256': sha(mpath), 'doduo_sha256': sha(dpath), 'dataset_games_sha256': META['dataset']['games_sha256'],
               'species_vocab': [inv_sp[i] for i in range(len(inv_sp))],
               'decisions': fx, 'rows': {str(k): v for k, v in rows.items()}}, open(args.fixture, 'w'))
    log('fixture', args.fixture, len(fx), 'decisions from', len(games), 'games')


if __name__ == '__main__':
    main()
