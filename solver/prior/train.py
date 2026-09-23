"""solver/prior/train.py -- HUMAN POLICY PRIOR v0: P(joint action | public state, both open sheets).

    python solver/prior/train.py [--data solver/out/prior] [--out solver/prior/model] [--no-pair]
                                 [--epochs 6] [--threads 8] [--boot 1000]

numpy only (torch / sklearn are not installed on this machine; the model is small enough that a
hand-written forward and backward pass is shorter than an install). The features are NOT computed
here: they are read from the tensors solver/prior/build_features.js emitted through
solver/prior/features.js, the same function Node inference calls (one definition, two consumers).

Model (per side-turn decision, both slots at once):
    x      = [ norm(ctx_slot) ; norm(cand) ; E[move] ]
    h      = relu(W1 x + b1)                          per candidate, weights shared across slots
    s      = w2 . h            u = U h        v = V h
    L[i,j] = s_a[i] + s_b[j] + u_a[i] . v_b[j] + wp . pair(i, j)     over VALID (i, j) only
    P      = softmax over the joint cells.   A one-slot decision is L[i] = s_a[i].
Loss: -log sum_{cells in the label set} P  (a hidden partner or an uncertain target widens the
label set rather than being guessed).
"""
import argparse, json, os, sys, time, hashlib

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='solver/out/prior')
ap.add_argument('--out', default='solver/prior/model')
ap.add_argument('--tag', default='prior-v0')
ap.add_argument('--no-pair', action='store_true')
ap.add_argument('--epochs', type=int, default=6)
ap.add_argument('--hidden', type=int, default=64)
ap.add_argument('--rank', type=int, default=8)
ap.add_argument('--emb', type=int, default=8)
ap.add_argument('--batch', type=int, default=512)
ap.add_argument('--lr', type=float, default=3e-3)
ap.add_argument('--l2', type=float, default=1e-5)
ap.add_argument('--min-move-count', type=int, default=30)
ap.add_argument('--threads', type=int, default=8)
ap.add_argument('--boot', type=int, default=1000)
ap.add_argument('--seed', type=int, default=20260923)
ap.add_argument('--fixture', default='')
ap.add_argument('--gradcheck', action='store_true')
ap.add_argument('--eval-only', default='', help='re-evaluate an EXPORTED model json (checks the export too)')
args = ap.parse_args()
for k in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS'):
    os.environ[k] = str(args.threads)
import numpy as np

T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
META = json.load(open(os.path.join(args.data, 'meta.json')))
CTX_F, CAND_F = len(META['ctx_names']), len(META['cand_names'])
NP_ = len(META['pair_names'])
JS = {n: i for i, n in enumerate(META['joint_status'])}
SS = {n: i for i, n in enumerate(META['slot_status'])}
TC_FOE = (0, 1); TC_ALLY = 2
KS_JOINT = [1, 4, 8, 12, 16, 24, 32]
KS_SLOT = [1, 2, 4, 8]


def load(split):
    d = os.path.join(args.data, split)
    S = {}
    S['ctx'] = np.fromfile(os.path.join(d, 'ctx.f32'), np.float32).reshape(-1, CTX_F)
    S['cand'] = np.fromfile(os.path.join(d, 'cand.f32'), np.float32).reshape(-1, CAND_F)
    S['attr'] = np.fromfile(os.path.join(d, 'cand_attr.i32'), np.int32).reshape(-1, 7)
    S['lab'] = np.fromfile(os.path.join(d, 'cand_label.u8'), np.uint8)
    S['slot'] = np.fromfile(os.path.join(d, 'slot.i32'), np.int32).reshape(-1, 5)
    S['dec'] = np.fromfile(os.path.join(d, 'dec.i32'), np.int32).reshape(-1, 7)
    return S


# ------------------------------------------------------------------ batching (vectorised gather)
def gather(S, slot_ids, K):
    """slot_ids: [B] (-1 = empty). Returns X-parts, move ids, attrs, masks, labels for [B, K]."""
    present = slot_ids >= 0
    sid = np.where(present, slot_ids, 0)
    start = S['slot'][sid, 0]; n = np.where(present, S['slot'][sid, 1], 0)
    ar = np.arange(K)
    mask = ar[None, :] < n[:, None]
    idx = np.where(mask, start[:, None] + ar[None, :], 0)
    cand = S['cand'][idx]                         # [B,K,CAND_F]
    ctx = np.broadcast_to(S['ctx'][sid][:, None, :], (len(sid), K, CTX_F))
    attr = S['attr'][idx]                          # [B,K,7]
    lab = (S['lab'][idx] > 0) & mask
    return ctx, cand, attr, mask, lab, present


def pair_feats(pa, pb):
    """pa, pb: attrs [B,K,7] = (move, tc, stall, sw, to, spread, mega). Mirrors features.js pairFeat."""
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
    P, valid = pair_feats(A[2], B[2])
    ma = A[3].copy(); mb = B[3].copy()
    # an empty slot is one null candidate (score 0, no pair terms)
    ma[~A[5], 0] = True; mb[~B[5], 0] = True
    la = A[4].copy(); lb = B[4].copy()
    la[~A[5], 0] = True; lb[~B[5], 0] = True
    both = (A[5] & B[5])[:, None, None]
    valid = np.where(both, valid, True) & ma[:, :, None] & mb[:, None, :]
    P = P * both[..., None]
    lab = valid & la[:, :, None] & lb[:, None, :]
    return dict(A=A, B=B, P=P, valid=valid, lab=lab, K=K, D=D)


# ------------------------------------------------------------------ model
class Model:
    def __init__(s, n_moves_emb, mu, sd, rng, pair=True):
        s.mu, s.sd, s.pair = mu, sd, pair
        din = CTX_F + CAND_F + args.emb
        H, R = args.hidden, args.rank
        s.p = {
            'E': rng.normal(0, 0.1, (n_moves_emb, args.emb)).astype(np.float64),
            'W1': rng.normal(0, np.sqrt(2.0 / din), (H, din)),
            'b1': np.zeros(H),
            'w2': rng.normal(0, 0.1, H),
            'U': rng.normal(0, 0.05, (R, H)),
            'V': rng.normal(0, 0.05, (R, H)),
            'wp': np.zeros(NP_),
        }
        s.m = {k: np.zeros_like(v) for k, v in s.p.items()}
        s.v = {k: np.zeros_like(v) for k, v in s.p.items()}
        s.t = 0

    def slot_fwd(s, part, emb_row):
        ctx, cand, attr, mask, lab, present = part
        feat = np.concatenate([ctx, cand], -1)
        feat = (feat - s.mu) / s.sd
        rows = emb_row[attr[..., 0]]
        x = np.concatenate([feat, s.p['E'][rows]], -1)       # [B,K,din]
        z = x @ s.p['W1'].T + s.p['b1']
        h = np.maximum(z, 0)
        sc = h @ s.p['w2']
        u = h @ s.p['U'].T
        v = h @ s.p['V'].T
        pm = present[:, None]
        return dict(x=x, z=z, h=h, s=sc * pm, u=u * pm[..., None], v=v * pm[..., None], rows=rows, pm=pm)

    def joint(s, b, emb_row):
        fa = s.slot_fwd(b['A'], emb_row); fb = s.slot_fwd(b['B'], emb_row)
        L = fa['s'][:, :, None] + fb['s'][:, None, :]
        if s.pair:
            L = L + np.einsum('bir,bjr->bij', fa['u'], fb['v']) + b['P'] @ s.p['wp']
        L = np.where(b['valid'], L, -np.inf)
        return L, fa, fb

    def loss_grad(s, b, emb_row):
        L, fa, fb = s.joint(b, emb_row)
        Bn = L.shape[0]
        flat = L.reshape(Bn, -1)
        mx = flat.max(1, keepdims=True)
        e = np.exp(flat - mx)
        Z = e.sum(1)
        labf = b['lab'].reshape(Bn, -1)
        el = e * labf
        Zl = el.sum(1)
        Zl = np.maximum(Zl, 1e-300)
        loss = np.log(Z) - np.log(Zl)
        G = (e / Z[:, None] - el / Zl[:, None]).reshape(L.shape) / Bn    # dLoss/dL (mean)
        g = {k: np.zeros_like(v) for k, v in s.p.items()}
        ds_a = G.sum(2); ds_b = G.sum(1)
        if s.pair:
            du_a = np.einsum('bij,bjr->bir', G, fb['v']); dv_b = np.einsum('bij,bir->bjr', G, fa['u'])
            g['wp'] = np.einsum('bijp,bij->p', b['P'], G)
        for f, ds, dx_proj, key in ((fa, ds_a, du_a if s.pair else None, 'U'), (fb, ds_b, dv_b if s.pair else None, 'V')):
            ds = ds * f['pm']
            dh = ds[..., None] * s.p['w2']
            g['w2'] += np.einsum('bk,bkh->h', ds, f['h'])
            if s.pair:
                dp = dx_proj * f['pm'][..., None]
                dh = dh + dp @ s.p[key]
                g[key] += np.einsum('bkr,bkh->rh', dp, f['h'])
            dz = dh * (f['z'] > 0)
            g['W1'] += np.einsum('bkh,bkd->hd', dz, f['x'])
            g['b1'] += dz.sum((0, 1))
            dx = dz @ s.p['W1']
            demb = dx[..., CTX_F + CAND_F:]
            np.add.at(g['E'], f['rows'].reshape(-1), demb.reshape(-1, args.emb))
        for k in ('W1', 'U', 'V', 'E'):
            g[k] += args.l2 * s.p[k]
        return loss.mean(), g

    def adam(s, g, lr):
        s.t += 1
        for k in s.p:
            if not s.pair and k in ('U', 'V', 'wp'):
                continue
            s.m[k] = 0.9 * s.m[k] + 0.1 * g[k]
            s.v[k] = 0.999 * s.v[k] + 0.001 * g[k] ** 2
            mh = s.m[k] / (1 - 0.9 ** s.t); vh = s.v[k] / (1 - 0.999 ** s.t)
            s.p[k] -= lr * mh / (np.sqrt(vh) + 1e-8)


# ------------------------------------------------------------------ baselines (independent of features.js counts)
def fit_counts(S):
    """species x action-key counts from TRAIN slot labels (exact + uncertain_target)."""
    act, full = {}, {}
    sl = S['slot']
    ok = (sl[:, 2] == SS['exact']) | (sl[:, 2] == SS['uncertain_target'])
    for r in np.nonzero(ok)[0]:
        st, n, status, sp = sl[r, 0], sl[r, 1], sl[r, 2], sl[r, 3]
        li = st + np.nonzero(S['lab'][st:st + n])[0]
        a = S['attr'][li[0]]
        key = int(a[0])                        # move id; SWITCH = 1
        act[(sp, key)] = act.get((sp, key), 0) + 1
        if status == SS['exact']:
            fk = (sp, key, int(a[1]), int(a[6]))
            full[fk] = full.get(fk, 0) + 1
    return act, full


def baseline_joint(S, b, kind, counts, sp_a, sp_b):
    def slot(part, sp):
        ctx, cand, attr, mask, lab, present = part
        Bn, K = mask.shape
        sc = np.zeros((Bn, K))
        if kind == 'uniform':
            return np.where(mask, 0.0, -np.inf)
        act, full = counts
        for bi in range(Bn):
            if not present[bi]:
                continue
            keys = attr[bi, :, 0]
            nk = {}
            for k in range(K):
                if mask[bi, k]:
                    nk[keys[k]] = nk.get(keys[k], 0) + 1
            tot = sum(act.get((sp[bi], kk), 0) for kk in nk) + len(nk)
            for k in range(K):
                if not mask[bi, k]:
                    continue
                pk = (act.get((sp[bi], keys[k]), 0) + 1) / tot / nk[keys[k]]      # MOVE PRIORS: split evenly over targets/mega
                if kind == 'freq+':
                    # the (target, mega) split learned per species+move, backing off to even
                    variants = [kk for kk in range(K) if mask[bi, kk] and keys[kk] == keys[k]]
                    num = full.get((sp[bi], keys[k], attr[bi, k, 1], attr[bi, k, 6]), 0) + 0.5
                    den = sum(full.get((sp[bi], keys[k], attr[bi, kk, 1], attr[bi, kk, 6]), 0) + 0.5 for kk in variants)
                    pk = (act.get((sp[bi], keys[k]), 0) + 1) / tot * num / den
                sc[bi, k] = np.log(pk)
        return np.where(mask, sc, -np.inf)
    sa = slot(b['A'], sp_a); sb = slot(b['B'], sp_b)
    sa = np.where(b['A'][5][:, None], sa, np.where(np.arange(sa.shape[1])[None] == 0, 0.0, -np.inf))
    sb = np.where(b['B'][5][:, None], sb, np.where(np.arange(sb.shape[1])[None] == 0, 0.0, -np.inf))
    L = sa[:, :, None] + sb[:, None, :]
    return np.where(b['valid'], L, -np.inf)


# ------------------------------------------------------------------ evaluation
def eval_logits(L, b, S):
    """Per-decision metrics from a joint logit matrix. Returns dict of per-decision arrays (nan = excluded)."""
    Bn, K, _ = L.shape
    flat = L.reshape(Bn, -1)
    mx = flat.max(1, keepdims=True)
    lp = flat - mx - np.log(np.exp(flat - mx).sum(1, keepdims=True))        # log P over cells
    D = b['D']
    js = D[:, 2]
    exact_joint = js == JS['exact']
    labf = b['lab'].reshape(Bn, -1)
    out = {}
    # joint: exact decisions have exactly one label cell
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
    # what the human's joint action CONTAINS (exact decisions only) -- the reserved-slot question
    la, lb = b['A'][4].argmax(1), b['B'][4].argmax(1)
    ar = np.arange(Bn)
    atA, atB = b['A'][2][ar, la], b['B'][2][ar, lb]
    pa, pb = b['A'][5], b['B'][5]
    has = lambda col: ((pa & (atA[:, col] == 1)) | (pb & (atB[:, col] == 1)))
    for name, flag in (('switch', has(3)), ('mega', has(6)), ('stall', has(2)), ('turn1', D[:, 4] == 0)):
        out[f'flag_{name}'] = np.where(exact_joint, flag.astype(float), np.nan)
    two = (D[:, 0] >= 0) & (D[:, 1] >= 0)
    out['two_slot'] = two.astype(float)
    # per slot marginals
    P = np.exp(lp.reshape(Bn, K, K))
    for side_i, (part, marg) in enumerate(((b['A'], P.sum(2)), (b['B'], P.sum(1)))):
        sid = D[:, side_i]
        present = sid >= 0
        status = np.where(present, S['slot'][np.maximum(sid, 0), 2], -1)
        ex = present & (status == SS['exact'])
        lab = part[4]
        pl = np.where(ex, (marg * lab).sum(1), np.nan)
        out[f's{side_i}_ll'] = np.where(ex, -np.log(np.maximum(pl, 1e-300)), np.nan)
        lm = np.where(part[3], marg, -1)
        orders = np.argsort(-lm, 1, kind='stable')
        lidx = lab.argmax(1)
        r = np.array([int(np.nonzero(orders[i] == lidx[i])[0][0]) + 1 if ex[i] else 10 ** 6 for i in range(Bn)])
        for k in KS_SLOT:
            out[f's{side_i}_r{k}'] = np.where(ex, (r <= k).astype(float), np.nan)
        out[f's{side_i}_outside'] = (present & (status == SS['outside'])).astype(float)
    return out


def run_eval(S, scorer, bs=2048):
    n = len(S['dec'])
    acc = None
    for i in range(0, n, bs):
        ids = np.arange(i, min(n, i + bs))
        b = batch(S, ids)
        L = scorer(b)
        o = eval_logits(L, b, S)
        acc = o if acc is None else {k: np.concatenate([acc[k], o[k]]) for k in o}
    return acc


def summarise(res, players, boot, rng, ref=None):
    """Point estimates + player-cluster bootstrap 95% CI. With ref, also paired difference res - ref."""
    up, inv = np.unique(players, return_inverse=True)
    G = len(up)
    keys = [k for k in res if not k.endswith('outside') and k != 'two_slot' and not k.startswith('flag_')]
    W = rng.multinomial(G, np.ones(G) / G, size=boot).astype(np.float64)         # [boot, G] cluster weights
    out = {}

    def cluster_sums(vals):
        m = ~np.isnan(vals)
        s = np.bincount(inv[m], weights=vals[m], minlength=G)
        c = np.bincount(inv[m], minlength=G).astype(float)
        return s, c
    for k in keys:
        s, c = cluster_sums(res[k])
        est = s.sum() / max(c.sum(), 1)
        bs_ = (W @ s) / np.maximum(W @ c, 1)
        row = {'est': est, 'lo': float(np.percentile(bs_, 2.5)), 'hi': float(np.percentile(bs_, 97.5)), 'n': int(c.sum())}
        if ref is not None:
            s2, c2 = cluster_sums(ref[k])
            d = (W @ s) / np.maximum(W @ c, 1) - (W @ s2) / np.maximum(W @ c2, 1)
            row['diff'] = est - s2.sum() / max(c2.sum(), 1)
            row['diff_lo'] = float(np.percentile(d, 2.5)); row['diff_hi'] = float(np.percentile(d, 97.5))
        out[k] = row
    return out


def gradcheck(model, S, emb_row, rng):
    ids = rng.choice(len(S['dec']), 24, replace=False)
    ids = ids[S['dec'][ids, 2] != JS['outside']]
    for k in model.p:
        model.p[k] = model.p[k] + rng.normal(0, 0.05, model.p[k].shape)   # move off the zero init
    b = batch(S, ids)
    _, g = model.loss_grad(b, emb_row)
    worst = 0.0; checked = 0
    for k, P in model.p.items():
        for _ in range(6):
            i = tuple(rng.integers(0, n) for n in P.shape)
            old = P[i]; eps = 1e-5
            P[i] = old + eps; lp, _ = model.loss_grad(b, emb_row)
            P[i] = old - eps; lm, _ = model.loss_grad(b, emb_row)
            P[i] = old
            num = (lp - lm) / (2 * eps) + args.l2 * old * (k in ('W1', 'U', 'V', 'E'))
            rel = abs(num - g[k][i]) / max(1e-7, abs(num) + abs(g[k][i]))
            if abs(num) + abs(g[k][i]) > 1e-6:
                worst = max(worst, rel); checked += 1
                print(f'  {k}{i}: numeric {num:+.6e} analytic {g[k][i]:+.6e} rel {rel:.1e}')
    print('GRADCHECK', checked, 'entries, worst relative error', worst, 'PASS' if (worst < 1e-4 and checked >= 10) else 'FAIL')


# ------------------------------------------------------------------ main
def main():
    rng = np.random.default_rng(args.seed)
    log('loading', args.data)
    TR, VA, TE = load('train'), load('val'), load('test')
    log('train decisions', len(TR['dec']), 'cands', len(TR['cand']), '| val', len(VA['dec']), '| test', len(TE['dec']))

    # normalisation from train
    feat_ctx = TR['ctx'].astype(np.float64); feat_cand = TR['cand'].astype(np.float64)
    mu = np.concatenate([feat_ctx.mean(0), feat_cand.mean(0)])
    sd = np.concatenate([feat_ctx.std(0), feat_cand.std(0)])
    sd = np.where(sd < 1e-6, 1.0, sd)
    del feat_ctx, feat_cand

    # move embedding rows: moves with >= min count train labels get a row; the rest share UNK (row 0)
    inv_vocab = {v: k for k, v in META['move_vocab'].items()}
    cnt = META['move_train_count']
    emb_row = np.zeros(len(inv_vocab), np.int64)
    emb_names = ['<unk>']
    for idx in range(len(inv_vocab)):
        name = inv_vocab[idx]
        c = cnt.get(name, 0) if name not in ('SWITCH', 'LOCKED') else 10 ** 9
        if name != '<pad>' and c >= args.min_move_count:
            emb_row[idx] = len(emb_names); emb_names.append(name)
    log('embedding rows', len(emb_names))

    model = Model(len(emb_names), mu, sd, rng, pair=not args.no_pair)
    if args.eval_only:
        J = json.load(open(args.eval_only))
        model.pair = J['pair']; model.mu = np.array(J['mu']); model.sd = np.array(J['sd'])
        model.p = {k: np.array(v, dtype=np.float64) for k, v in J['params'].items()}
        emb_row = np.array([J['emb_rows'].get(inv_vocab[i], 0) if inv_vocab[i] != '<pad>' else 0 for i in range(len(inv_vocab))], np.int64)
        history = J.get('val_history', [])
        mu, sd = model.mu, model.sd
        evaluate(model, emb_row, TR, TE, args.eval_only, history, mu, sd, emb_names, export=False)
        return
    if args.gradcheck:
        gradcheck(model, TR, emb_row, rng); return

    # trainable decisions: not 'outside', and at least one slot actually informative
    def informative(S):
        D = S['dec']
        st = lambda col: np.where(D[:, col] >= 0, S['slot'][np.maximum(D[:, col], 0), 2], -1)
        a, b = st(0), st(1)
        inf_ = lambda s: (s == SS['exact']) | (s == SS['uncertain_target'])
        return (D[:, 2] != JS['outside']) & (inf_(a) | inf_(b))
    tr_ids = np.nonzero(informative(TR))[0]
    va_ids = np.nonzero(informative(VA))[0]
    log('trainable', len(tr_ids), 'val', len(va_ids))

    def val_loss(ids, bs=4096):
        tot = 0.0
        for i in range(0, len(ids), bs):
            b = batch(VA, ids[i:i + bs]); L, _, _ = model.joint(b, emb_row)
            Bn = L.shape[0]; flat = L.reshape(Bn, -1); labf = b['lab'].reshape(Bn, -1)
            mx = flat.max(1, keepdims=True)
            lz = np.log(np.exp(flat - mx).sum(1)); ll = np.log((np.exp(flat - mx) * labf).sum(1))
            tot += (lz - ll).sum()
        return tot / len(ids)

    best, best_p, history = np.inf, None, []
    steps_per_epoch = int(np.ceil(len(tr_ids) / args.batch))
    total = steps_per_epoch * args.epochs
    step = 0
    for ep in range(args.epochs):
        perm = rng.permutation(tr_ids)
        run = 0.0
        for i in range(0, len(perm), args.batch):
            b = batch(TR, perm[i:i + args.batch])
            loss, g = model.loss_grad(b, emb_row)
            lr = args.lr * 0.5 * (1 + np.cos(np.pi * step / total))               # cosine decay
            model.adam(g, lr); step += 1
            run += loss
            if step % 200 == 0:
                log(f'ep {ep} step {step}/{total} train {run / 200:.4f}'); run = 0.0
        vl = val_loss(va_ids)
        history.append({'epoch': ep, 'val_loss': vl})
        log(f'epoch {ep} val loss {vl:.4f}')
        if vl < best:
            best = vl; best_p = {k: v.copy() for k, v in model.p.items()}
    model.p = best_p
    evaluate(model, emb_row, TR, TE, None, history, mu, sd, emb_names, export=True)


def evaluate(model, emb_row, TR, TE, mpath, history, mu, sd, emb_names, export):
    # ---- evaluation on TEST (the held-out players), model vs baselines
    counts = fit_counts(TR)
    sp_of = lambda S, b, col: np.where(b['D'][:, col] >= 0, S['slot'][np.maximum(b['D'][:, col], 0), 3], 0)
    scorers = {
        'model': lambda b: model.joint(b, emb_row)[0],
        'uniform': lambda b: baseline_joint(TE, b, 'uniform', counts, None, None),
        'species_freq': lambda b: baseline_joint(TE, b, 'freq', counts, sp_of(TE, b, 0), sp_of(TE, b, 1)),
        'species_freq_plus': lambda b: baseline_joint(TE, b, 'freq+', counts, sp_of(TE, b, 0), sp_of(TE, b, 1)),
    }
    results = {}
    for name, fn in scorers.items():
        log('eval', name)
        results[name] = run_eval(TE, fn)
    players = TE['dec'][:, 6]
    summary = {}
    for name in scorers:
        summary[name] = summarise(results[name], players, args.boot, np.random.default_rng(args.seed + 1),
                                  ref=None if name == 'model' else None)
    paired = {name: summarise(results['model'], players, args.boot, np.random.default_rng(args.seed + 1), ref=results[name])
              for name in scorers if name != 'model'}
    # joint recall restricted to two-slot decisions (the number the matrix game actually lives on)
    two = results['model']['two_slot'] > 0
    two_slot = {}
    for name in scorers:
        r = {k: np.where(two, v, np.nan) for k, v in results[name].items() if k.startswith('joint')}
        two_slot[name] = summarise(r, players, args.boot, np.random.default_rng(args.seed + 1))

    # exclusion accounting on test
    D = TE['dec']
    excl = {'test_decisions': int(len(D)), 'joint_status': {n: int((D[:, 2] == i).sum()) for n, i in JS.items()},
            'slot_status': {n: int((TE['slot'][:, 2] == i).sum()) for n, i in SS.items()},
            'test_players': int(len(np.unique(players))), 'two_slot_decisions': int(two.sum())}

    # recall conditional on what the human's joint action contains
    by_content = {}
    for name in scorers:
        by_content[name] = {}
        for flag in ('switch', 'mega', 'stall', 'turn1'):
            f = results['model'][f'flag_{flag}']
            for val in (1.0, 0.0):
                r = {k: np.where(f == val, v, np.nan) for k, v in results[name].items() if k.startswith('joint_r')}
                by_content[name][f'{flag}={int(val)}'] = summarise(r, players, args.boot, np.random.default_rng(args.seed + 1))

    # ---- export
    os.makedirs(args.out, exist_ok=True)
    tolist = lambda a: np.asarray(a, dtype=np.float64).tolist()   # full precision: Node must reproduce these logits
    model_json = {
        'name': args.tag, 'kind': 'human policy prior', 'feature_version': META['feature_version'],
        'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'generator': 'solver/prior/train.py',
        'dataset': META['dataset'], 'split': META['split'],
        'hyper': {k: getattr(args, k) for k in ('hidden', 'rank', 'emb', 'batch', 'lr', 'l2', 'epochs', 'min_move_count', 'seed')},
        'pair': not args.no_pair,
        'ctx_names': META['ctx_names'], 'cand_names': META['cand_names'], 'pair_names': META['pair_names'],
        'mu': tolist(mu), 'sd': tolist(sd),
        'emb_rows': {n: i for i, n in enumerate(emb_names)},
        'params': {k: tolist(v) for k, v in model.p.items()},
        'val_history': history,
    }
    if export:
        mpath = os.path.join(args.out, f'{args.tag}.json')
        json.dump(model_json, open(mpath, 'w'))
        # the TRAIN-actor frequency tables the freq_* features read at inference time travel with the model
        import shutil
        shutil.copyfile(os.path.join(args.data, 'freq.json'), os.path.join(args.out, args.tag.replace('prior', 'freq') + '.json'))
    metrics = {'model': args.tag, 'model_json_sha256': hashlib.sha256(open(mpath, 'rb').read()).hexdigest(),
               'dataset': META['dataset'], 'split_players': META['split']['players'], 'exclusions': excl,
               'summary': summary, 'paired_vs_model': paired, 'two_slot_joint': two_slot, 'by_content': by_content,
               'evaluated_from': 'exported json' if not export else 'in-memory weights', 'val_history': history,
               'seconds': time.time() - T0}
    json.dump(metrics, open(os.path.join(args.out, f'{args.tag}.metrics.json'), 'w'), indent=1)
    log('wrote', mpath)

    # ---- agreement fixture: python logits for fixed test decisions (Node recomputes them)
    if args.fixture:
        ids = np.nonzero(TE['dec'][:, 2] == JS['exact'])[0]
        games_needed = []
        pick = []
        for i in ids:
            gi = int(TE['dec'][i, 3])
            if gi not in games_needed:
                if len(games_needed) >= 10 or len(pick) >= 60:
                    continue
                games_needed.append(gi)
            pick.append(int(i))
        pick = np.array(pick[:60])
        b = batch(TE, pick)
        L, _, _ = model.joint(b, emb_row)
        fx = []
        for j, i in enumerate(pick):
            d = TE['dec'][i]
            na = TE['slot'][d[0], 1] if d[0] >= 0 else 1
            nb = TE['slot'][d[1], 1] if d[1] >= 0 else 1
            Lj = L[j, :na, :nb]
            feats = []
            for col in (0, 1):
                if d[col] < 0:
                    feats.append(None); continue
                st, n = TE['slot'][d[col], 0], TE['slot'][d[col], 1]
                feats.append({'ctx': TE['ctx'][d[col]].astype(float).tolist(),
                              'cand': TE['cand'][st:st + n].astype(float).tolist(),
                              'label': TE['lab'][st:st + n].astype(int).tolist()})
            fx.append({'game': int(d[3]), 'turn': int(d[4]), 'side': ['p1', 'p2'][int(d[5])], 'features': feats,
                       'logits': [[None if not np.isfinite(x) else float(x) for x in row] for row in Lj]})
        # embed the parsed game rows so the Node test is self-contained (games.jsonl is an untracked build output)
        rows, want = {}, set(games_needed)
        with open(META['dataset']['games_jsonl'], 'r', encoding='utf8') as fh:
            gi = 0
            for line in fh:
                if not line.strip():
                    continue
                if gi in want:
                    rows[gi] = json.loads(line)
                    if len(rows) == len(want):
                        break
                gi += 1
        json.dump({'model': os.path.basename(mpath), 'model_json_sha256': metrics['model_json_sha256'],
                   'decisions': fx, 'rows': {str(k): v for k, v in rows.items()}}, open(args.fixture, 'w'))
        log('fixture', args.fixture, len(fx), 'decisions from games', games_needed)


if __name__ == '__main__':
    main()
