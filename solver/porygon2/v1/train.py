"""solver/porygon2/v1/train.py -- PORYGON2 v1, the value net on the full honest-information state.

    python solver/porygon2/v1/train.py --data <dir>[,<dir>...] --arch sets|attn --out <model.json> --metrics <metrics.json>
        [--labels <jsonl>[,<jsonl>...]] [--fixture <json>] [--threads 6] [--epochs 12] [--lr 1e-3] [--seed 1]

DATA. Every --data directory is a solver/porygon2/v1/build.js output (human or self-play), read through np.memmap. Rows are
visited in shuffled BLOCKS of contiguous rows (a block is read sequentially; the order of blocks and the rows inside a batch
are shuffled), because this machine has ~2 GB of free RAM and random 4 KB reads over 2 GB of tensors thrash.

TARGETS (pre-registered, solver/porygon2/v1/preregistration.json, before any v1 training run):
  human position                 y = z (the game's result)
  self-play, exact endgame label y = v_exact (a solved 1v1 / 2v1 position; labels file kind 'exact')
  self-play, deep label          y = 0.5 z + 0.5 v_deep (a long MILTANK search's root value; labels file kind 'deep')
  self-play, otherwise           y = 0.75 z + 0.25 v_root (the recorded 2-pass search root) if it exists, else z
SPLITS. Human: the MAG/DODUO player split (train = both players train; val / test = viewed by a val / test player, a game
with two such players counts twice). Self-play: the build's game split (80/10/10 by a hash of the game key).
SELECTION: the epoch with the lowest VALIDATION loss = human val log-loss (vs z) + self-play val loss (vs y), equally weighted.

EVALUATION (the gate, pre-registered): held-out TEST log-loss and Brier against the OUTCOME z, on human test positions and on
self-play test positions, paired against gen5's PORYGON2 on the SAME rows (build.js stored gen5's value per row), 95% CIs by a
bootstrap over games. By turn bucket; a 10-bin calibration table; and the count-HP logistic for scale.

ARCHITECTURES (both antisymmetric by construction: logit = g(A, B) - g(B, A)):
  sets   token MLP -> Deep Sets pools (weighted sum, max, actives sum) + side + field + v0 facts -> MLP head
  attn   token MLP -> + side identity -> one pre-LN self-attention block over 12 mon tokens + 2 side tokens + 1 field token
         (fainted tokens masked as keys) -> the same pools + the side and field tokens -> MLP head
The Node forward pass is solver/porygon2/v1/infer.js; solver/tests/test-porygon2-v1.js holds them together on --fixture.
"""
import argparse, base64, hashlib, json, math, os, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--data', required=True)
ap.add_argument('--arch', default='sets', choices=['sets', 'attn'])
ap.add_argument('--out', required=True)
ap.add_argument('--metrics', required=True)
ap.add_argument('--labels', default='')
ap.add_argument('--fixture', default='')
ap.add_argument('--threads', type=int, default=6)
ap.add_argument('--epochs', type=int, default=12)
ap.add_argument('--lr', type=float, default=1e-3)
ap.add_argument('--wd', type=float, default=1e-4)
ap.add_argument('--dropout', type=float, default=0.1)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--boot', type=int, default=2000)
ap.add_argument('--block', type=int, default=2048)
ap.add_argument('--bs', type=int, default=512)
ap.add_argument('--human-weight', type=float, default=1.0)
ap.add_argument('--max-rows', type=int, default=0, help='debug: cap rows per directory')
ap.add_argument('--name', default='PORYGON2 v1')
args = ap.parse_args()

import torch
import torch.nn as nn
torch.set_num_threads(min(6, args.threads)); torch.set_num_interop_threads(1)
torch.manual_seed(args.seed); np.random.seed(args.seed)
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
KINDS = ['species', 'item', 'ability', 'move', 'move', 'move', 'move']
DIMS = {'sets': dict(sp=16, it=8, ab=8, mv=12, t1=96, tok=64, head1=128, head2=64),
        'attn': dict(sp=16, it=8, ab=8, mv=12, t1=64, tok=32, ffn=64, heads=2, head1=96, head2=48)}[args.arch]


# ------------------------------------------------------------------ data
class DS:
    def __init__(self, d):
        self.dir = d
        self.meta = json.load(open(os.path.join(d, 'meta.json'), encoding='utf8'))
        nm = self.meta['names']; N = self.meta['N']
        if args.max_rows: N = min(N, args.max_rows)
        self.N = N; self.nm = nm
        self.TN, self.SN, self.FN, self.KN = len(nm['tok']), len(nm['side']), len(nm['field']), len(nm['facts'])
        mm = lambda name, dt, shape: np.memmap(os.path.join(d, name), dtype=dt, mode='r', shape=shape)
        NN = self.meta['N']
        self.tok = mm('tok.f32', '<f4', (NN, 2, 6, self.TN)); self.ids = mm('ids.i32', '<i4', (NN, 2, 6, 7))
        self.mvw = mm('mvw.f32', '<f4', (NN, 2, 6, 4)); self.side = mm('side.f32', '<f4', (NN, 2, self.SN))
        self.field = mm('field.f32', '<f4', (NN, self.FN)); self.facts = mm('facts.f32', '<f4', (NN, 2, self.KN))
        self.base = np.array(mm('base.f32', '<f4', (NN, 2))[:N], dtype=np.float64)
        self.M = np.array(mm('meta.i32', '<i4', (NN, len(nm['meta'])))[:N])
        self.col = {c: i for i, c in enumerate(nm['meta'])}
        self.z = np.array(mm('z.f32', '<f4', (NN,))[:N], dtype=np.float64)
        self.vroot = np.array(mm('vroot.f32', '<f4', (NN,))[:N], dtype=np.float64)
        self.vgen5 = np.array(mm('vgen5.f32', '<f4', (NN,))[:N], dtype=np.float64)
        self.kind = self.meta['kind']
        self.games = self.meta['games']

    def remap_to(self, VOC):
        self.remap = {}
        for kind in ['species', 'item', 'ability', 'move']:
            glob = self.meta['vocab'][kind]
            r = np.zeros(len(glob), dtype=np.int64)
            for s, gi in glob.items(): r[gi] = VOC[kind].get(s, 0)
            self.remap[kind] = r

    def batch(self, idx):
        raw = np.asarray(self.ids[idx], dtype=np.int64)
        ti = np.empty_like(raw)
        for j, kind in enumerate(KINDS): ti[..., j] = self.remap[kind][raw[..., j]]
        return dict(tn=torch.from_numpy(np.asarray(self.tok[idx])), ti=torch.from_numpy(ti), mw=torch.from_numpy(np.asarray(self.mvw[idx])),
                    sd=torch.from_numpy(np.asarray(self.side[idx])), fd=torch.from_numpy(np.asarray(self.field[idx])),
                    fc=torch.from_numpy(np.asarray(self.facts[idx])))


dirs = [d for d in args.data.split(',') if d]
DSs = [DS(d) for d in dirs]
REL = {d.meta['engine_release'] for d in DSs}
if len(REL) != 1: raise SystemExit(f'data from more than one engine release: {REL}')
for d in DSs[1:]:
    if d.nm != DSs[0].nm: raise SystemExit('feature layout differs between ' + DSs[0].dir + ' and ' + d.dir)
NM = DSs[0].nm; TN, SN, FN, KN = DSs[0].TN, DSs[0].SN, DSs[0].FN, DSs[0].KN

# vocabulary: an id seen >= 3 times in TRAIN rows (any directory) gets a row, the rest map to <unk>
VOC = {}
for kind in ['species', 'item', 'ability', 'move']:
    cnt = {}
    for d in DSs:
        for s, n in d.meta['train_count'][kind].items(): cnt[s] = cnt.get(s, 0) + n
    keep = ['<unk>'] + sorted(s for s, n in cnt.items() if s != '<unk>' and n >= 3)
    VOC[kind] = {s: i for i, s in enumerate(keep)}
for d in DSs: d.remap_to(VOC)

# labels from the deep labeller / the endgame solver, keyed "<game key>|<t>" -> (kind, value in p1's frame)
LAB = {}
for f in [x for x in args.labels.split(',') if x]:
    for line in open(f, encoding='utf8'):
        if not line.strip(): continue
        o = json.loads(line)
        k = o['key'] + '|' + str(o['t'])
        if o.get('kind') == 'exact' or k not in LAB or LAB[k][0] != 'exact': LAB[k] = (o.get('kind', 'deep'), float(o['v']))

# per-row targets, weights, split masks
for d in DSs:
    c = d.col; N = d.N
    d.y = d.z.copy(); d.vdeep = np.full(N, np.nan); d.vexact = np.full(N, np.nan)
    d.w = np.ones(N)
    if d.kind == 'selfplay':
        g = d.M[:, c['game']]; t = d.M[:, c['t']]
        for i in range(N):
            k = d.games[g[i]] + '|' + str(t[i])
            if k in LAB:
                kind, v = LAB[k]
                if kind == 'exact': d.vexact[i] = v
                else: d.vdeep[i] = v
        has_root = ~np.isnan(d.vroot)
        d.y = np.where(has_root, 0.75 * d.z + 0.25 * np.nan_to_num(d.vroot), d.z)
        dm = ~np.isnan(d.vdeep); d.y[dm] = 0.5 * d.z[dm] + 0.5 * d.vdeep[dm]
        em = ~np.isnan(d.vexact); d.y[em] = d.vexact[em]
        s = d.M[:, c['split_p1']]
        d.train = np.where(s == 0)[0]; d.val = np.where(s == 1)[0]; d.test = np.where(s == 2)[0]
        d.val_w = np.ones(len(d.val)); d.test_w = np.ones(len(d.test))
    else:
        s1, s2 = d.M[:, c['split_p1']], d.M[:, c['split_p2']]
        d.train = np.where((s1 == 0) & (s2 == 0))[0]
        d.val = np.where((s1 == 1) | (s2 == 1))[0]; d.val_w = ((s1 == 1).astype(np.float64) + (s2 == 1))[d.val]
        d.test = np.where((s1 == 2) | (s2 == 2))[0]; d.test_w = ((s1 == 2).astype(np.float64) + (s2 == 2))[d.test]
        d.w[:] = args.human_weight
    log(f'{d.dir}: {d.kind} N {N} train {len(d.train)} val {len(d.val)} test {len(d.test)}'
        + (f' | deep {int((~np.isnan(d.vdeep)).sum())} exact {int((~np.isnan(d.vexact)).sum())} root {int((~np.isnan(d.vroot)).sum())}' if d.kind == 'selfplay' else ''))


# ------------------------------------------------------------------ the nets
class Common(nn.Module):
    def __init__(self, D):
        super().__init__()
        self.e_sp = nn.Embedding(len(VOC['species']), D['sp']); self.e_it = nn.Embedding(len(VOC['item']), D['it'])
        self.e_ab = nn.Embedding(len(VOC['ability']), D['ab']); self.e_mv = nn.Embedding(len(VOC['move']), D['mv'])
        for e in [self.e_sp, self.e_it, self.e_ab, self.e_mv]: nn.init.normal_(e.weight, std=0.1)
        tin = TN + D['sp'] + D['it'] + D['ab'] + D['mv']
        self.t1 = nn.Linear(tin, D['t1']); self.t2 = nn.Linear(D['t1'], D['tok'])
        self.drop = nn.Dropout(args.dropout)

    def tokens(self, B):
        dt = self.t1.weight.dtype
        ti = B['ti']
        mv = (self.e_mv(ti[..., 3:7]) * B['mw'].to(dt).unsqueeze(-1)).sum(-2) / 4
        x = torch.cat([B['tn'].to(dt), self.e_sp(ti[..., 0]), self.e_it(ti[..., 1]), self.e_ab(ti[..., 2]), mv], -1)
        return torch.relu(self.t2(torch.relu(self.t1(x))))          # [B,2,6,tok]


def pools(h, tn):
    w = tn[..., 1:2]; act = tn[..., 3:4]
    # weighted sum, max over the tokens with weight > 0 (a masked token contributes 0), actives sum
    return torch.cat([(w * h).sum(-2) / 4, (h * (w > 0).to(h.dtype)).max(-2).values, (act * h).sum(-2) / 2], -1)


class Sets(Common):
    def __init__(self, D):
        super().__init__(D)
        hin = 2 * (3 * D['tok'] + SN) + FN + 2 * KN
        self.h1 = nn.Linear(hin, D['head1']); self.h2 = nn.Linear(D['head1'], D['head2']); self.h3 = nn.Linear(D['head2'], 1)

    def g(self, a, b, fd, fa, fb):
        x = torch.cat([a, b, fd, fa, fb], -1)
        return self.h3(self.drop(torch.relu(self.h2(self.drop(torch.relu(self.h1(x))))))).squeeze(-1)

    def forward(self, B):
        dt = self.t1.weight.dtype
        h = self.tokens(B); tn = B['tn'].to(dt)
        sv = torch.cat([pools(h, tn), B['sd'].to(dt)], -1)   # [B,2,3tok+SN]
        fd = B['fd'].to(dt); fc = B['fc'].to(dt)
        return self.g(sv[:, 0], sv[:, 1], fd, fc[:, 0], fc[:, 1]) - self.g(sv[:, 1], sv[:, 0], fd, fc[:, 1], fc[:, 0])


class Attn(Common):
    def __init__(self, D):
        super().__init__(D)
        d = D['tok']; self.H = D['heads']; self.d = d
        self.s_me = nn.Parameter(torch.randn(d) * 0.1); self.s_op = nn.Parameter(torch.randn(d) * 0.1)
        self.sp = nn.Linear(SN, d); self.fp = nn.Linear(FN + 2 * KN, d)
        self.ln1 = nn.LayerNorm(d); self.qkv = nn.Linear(d, 3 * d); self.o = nn.Linear(d, d)
        self.ln2 = nn.LayerNorm(d); self.f1 = nn.Linear(d, D['ffn']); self.f2 = nn.Linear(D['ffn'], d)
        hin = 2 * 3 * d + 3 * d
        self.h1 = nn.Linear(hin, D['head1']); self.h2 = nn.Linear(D['head1'], D['head2']); self.h3 = nn.Linear(D['head2'], 1)

    def g(self, hA, hB, tA, tB, sA, sB, fd, fa, fb):
        # hA/hB [B,6,d] token codes; tA/tB [B,6,TN]; sA/sB [B,SN]; fd [B,FN]
        Bn = hA.shape[0]; d = self.d; H = self.H; dh = d // H
        x = torch.cat([hA + self.s_me, hB + self.s_op, (self.sp(sA) + self.s_me).unsqueeze(1), (self.sp(sB) + self.s_op).unsqueeze(1),
                       self.fp(torch.cat([fd, fa, fb], -1)).unsqueeze(1)], 1)          # [B,15,d]
        keep = torch.cat([tA[..., 1] > 0, tB[..., 1] > 0, torch.ones(Bn, 3, dtype=torch.bool)], 1)   # [B,15]
        y = self.ln1(x)
        q, k, v = self.qkv(y).split(d, -1)
        q = q.view(Bn, 15, H, dh).transpose(1, 2); k = k.view(Bn, 15, H, dh).transpose(1, 2); v = v.view(Bn, 15, H, dh).transpose(1, 2)
        att = (q @ k.transpose(-1, -2)) / math.sqrt(dh)
        att = att.masked_fill(~keep[:, None, None, :], -1e9)
        a = torch.softmax(att, -1) @ v                                             # [B,H,15,dh]
        x = x + self.o(a.transpose(1, 2).reshape(Bn, 15, d))
        x = x + self.f2(torch.relu(self.f1(self.ln2(x))))
        pa = pools(x[:, 0:6], tA); pb = pools(x[:, 6:12], tB)
        z = torch.cat([pa, pb, x[:, 12], x[:, 13], x[:, 14]], -1)
        return self.h3(self.drop(torch.relu(self.h2(self.drop(torch.relu(self.h1(z))))))).squeeze(-1)

    def forward(self, B):
        dt = self.t1.weight.dtype
        h = self.tokens(B); tn = B['tn'].to(dt); sd = B['sd'].to(dt); fd = B['fd'].to(dt); fc = B['fc'].to(dt)
        return (self.g(h[:, 0], h[:, 1], tn[:, 0], tn[:, 1], sd[:, 0], sd[:, 1], fd, fc[:, 0], fc[:, 1])
                - self.g(h[:, 1], h[:, 0], tn[:, 1], tn[:, 0], sd[:, 1], sd[:, 0], fd, fc[:, 1], fc[:, 0]))


def make():
    return (Sets if args.arch == 'sets' else Attn)(DIMS)


# ------------------------------------------------------------------ training
def predict(model, d, idx, bs=4096):
    model.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(idx), bs):
            j = idx[i:i + bs]
            out.append(model(d.batch(j)).double())
    return torch.cat(out).numpy() if out else np.zeros(0)


def ll(logit, yy):
    return np.logaddexp(0, logit) - yy * logit


def val_loss(model):
    tot = {}
    for d in DSs:
        if not len(d.val): continue
        p = predict(model, d, d.val)
        yv = d.z[d.val] if d.kind == 'human' else d.y[d.val]
        tot[d.kind] = tot.get(d.kind, []) + [(float((ll(p, yv) * d.val_w).sum()), float(d.val_w.sum()))]
    out = {k: sum(a for a, _ in v) / sum(b for _, b in v) for k, v in tot.items()}
    out['combined'] = sum(out.values()) / len(out)
    return out


model = make()
nparams = sum(p.numel() for p in model.parameters())
log(f'arch {args.arch} dims {DIMS} params {nparams}')
opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
lossw = nn.BCEWithLogitsLoss(reduction='none')
rng = np.random.default_rng(args.seed)
history = []; best = (1e9, None, -1)
blocks = []
for di, d in enumerate(DSs):
    tr = d.train
    for i in range(0, len(tr), args.block): blocks.append((di, tr[i:i + args.block]))
log(f'train blocks {len(blocks)} rows {sum(len(b) for _, b in blocks)}')
for ep in range(args.epochs):
    model.train(); t = time.time(); tot = 0.0; nb = 0
    order = rng.permutation(len(blocks))
    # interleave several blocks so a batch mixes sources; each group of 4 blocks is read then shuffled row-wise
    for gi in range(0, len(order), 4):
        grp = [blocks[k] for k in order[gi:gi + 4]]
        rows = [(di, r) for di, rr in grp for r in rr]
        perm = rng.permutation(len(rows))
        for s in range(0, len(perm), args.bs):
            sel = [rows[p] for p in perm[s:s + args.bs]]
            opt.zero_grad(); loss = 0.0; n = 0
            for di in set(x[0] for x in sel):
                d = DSs[di]
                idx = np.sort(np.array([r for dd, r in sel if dd == di]))
                B = d.batch(idx)
                y = torch.from_numpy(d.y[idx]).float(); wv = torch.from_numpy(d.w[idx]).float()
                loss = loss + (lossw(model(B), y) * wv).sum(); n += len(idx)
            loss = loss / n
            loss.backward(); opt.step(); tot += loss.item(); nb += 1
    sched.step()
    vl = val_loss(model)
    history.append({'epoch': ep, 'train_loss': tot / max(1, nb), 'val': vl, 'seconds': round(time.time() - t, 1)})
    log(f'epoch {ep}: train {tot / max(1, nb):.5f} val {json.dumps({k: round(v, 5) for k, v in vl.items()})} {time.time() - t:.0f}s')
    if vl['combined'] < best[0]: best = (vl['combined'], {k: v.clone() for k, v in model.state_dict().items()}, ep)
model.load_state_dict(best[1]); model.eval()
log('selected epoch', best[2])

# ------------------------------------------------------------------ evaluation vs gen5 on the same rows, clustered by game
BUCKETS = [('1', 1, 1), ('2', 2, 2), ('3', 3, 3), ('4-5', 4, 5), ('6-8', 6, 8), ('9+', 9, 9999)]


def evaluate(kind):
    parts = [d for d in DSs if d.kind == kind and len(d.test)]
    if not parts: return None
    L, G5, Y, W, GAME, TURN, BASE = [], [], [], [], [], [], []
    off = 0
    for d in parts:
        L.append(predict(model, d, d.test)); G5.append(d.vgen5[d.test]); Y.append(d.z[d.test]); W.append(d.test_w)
        GAME.append(d.M[d.test, d.col['game']] + off); TURN.append(d.M[d.test, d.col['turn']]); BASE.append(d.base[d.test]); off += len(d.games)
    lg = np.concatenate(L); g5 = np.clip(np.concatenate(G5), 1e-6, 1 - 1e-6); y = np.concatenate(Y); w = np.concatenate(W)
    game = np.concatenate(GAME); turn = np.concatenate(TURN)
    lg5 = np.log(g5) - np.log1p(-g5)
    ug, ginv = np.unique(game, return_inverse=True)
    boot = np.random.default_rng(12345).multinomial(len(ug), np.full(len(ug), 1 / len(ug)), size=args.boot).astype(np.float64)

    def clustered(vals, mask=None):
        ww = w if mask is None else w * mask
        num = np.bincount(ginv, weights=vals * ww, minlength=len(ug)); den = np.bincount(ginv, weights=ww, minlength=len(ug))
        if den.sum() == 0: return None
        bs = (boot @ num) / np.maximum(boot @ den, 1e-12)
        lo, hi = np.percentile(bs, [2.5, 97.5])
        return {'mean': round(float(num.sum() / den.sum()), 6), 'ci95': [round(float(lo), 6), round(float(hi), 6)], 'n_views': float(ww.sum()), 'n_games': int((den > 0).sum())}
    p1 = 1 / (1 + np.exp(-lg))
    LLv, LL5 = ll(lg, y), ll(lg5, y)
    BRv, BR5 = (p1 - y) ** 2, (g5 - y) ** 2
    out = {'v1': {'logloss': clustered(LLv), 'brier': clustered(BRv)}, 'gen5': {'logloss': clustered(LL5), 'brier': clustered(BR5)},
           'v1_minus_gen5': {'logloss': clustered(LLv - LL5), 'brier': clustered(BRv - BR5)}, 'by_turn': {}, 'calibration': {}}
    for b, lo, hi in BUCKETS:
        m = ((turn >= lo) & (turn <= hi)).astype(np.float64)
        out['by_turn'][b] = {'v1_logloss': clustered(LLv, m), 'gen5_logloss': clustered(LL5, m), 'v1_minus_gen5_logloss': clustered(LLv - LL5, m),
                             'v1_brier': clustered(BRv, m), 'gen5_brier': clustered(BR5, m)}
    for name, p in (('v1', p1), ('gen5', g5)):
        bins = np.clip((p * 10).astype(int), 0, 9); rows = []
        for k in range(10):
            m = bins == k
            if m.any(): rows.append({'bin': k, 'n_views': float(w[m].sum()), 'pred': round(float((p[m] * w[m]).sum() / w[m].sum()), 4), 'won': round(float((y[m] * w[m]).sum() / w[m].sum()), 4)})
        ece = sum(r['n_views'] * abs(r['pred'] - r['won']) for r in rows) / max(1e-9, sum(r['n_views'] for r in rows))
        out['calibration'][name] = {'bins': rows, 'ece': round(float(ece), 5)}
    return out


# count-HP logistic for scale (refit on human + self-play TRAIN rows with the outcome), evaluated on the same test rows
def count_hp():
    Xs, Ys = [], []
    for d in DSs:
        Xs.append(d.base[d.train]); Ys.append(d.z[d.train])
    Xb = torch.from_numpy(np.concatenate(Xs)); yb = torch.from_numpy(np.concatenate(Ys))
    wb = torch.zeros(2, dtype=torch.float64, requires_grad=True)
    o = torch.optim.LBFGS([wb], max_iter=200, line_search_fn='strong_wolfe')
    def clo():
        o.zero_grad(); l = nn.functional.binary_cross_entropy_with_logits(Xb @ wb, yb); l.backward(); return l
    o.step(clo)
    res = {'weights': [round(float(x), 4) for x in wb.detach().numpy()]}
    for kind in ('human', 'selfplay'):
        parts = [d for d in DSs if d.kind == kind and len(d.test)]
        if not parts: continue
        lg = np.concatenate([d.base[d.test] @ wb.detach().numpy() for d in parts]); y = np.concatenate([d.z[d.test] for d in parts]); w = np.concatenate([d.test_w for d in parts])
        res[kind + '_test_logloss'] = round(float((ll(lg, y) * w).sum() / w.sum()), 6)
    return res


test = {'human': evaluate('human'), 'selfplay': evaluate('selfplay')}
chp = count_hp()
for k in ('human', 'selfplay'):
    if test[k]: log(k, 'test log-loss v1', test[k]['v1']['logloss']['mean'], 'gen5', test[k]['gen5']['logloss']['mean'], 'diff', test[k]['v1_minus_gen5']['logloss'])

# ------------------------------------------------------------------ export
def b64(t):
    return base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode('ascii')


J = {'model': args.name, 'arch': 'v1-' + args.arch, 'feature_version': DSs[0].meta['feature_version'], 'dims': DIMS,
     'names': {'tok': NM['tok'], 'side': NM['side'], 'field': NM['field'], 'facts': NM['facts']}, 'vocab': VOC,
     'weights': {k: {'shape': list(v.shape), 'f32_b64': b64(v)} for k, v in model.state_dict().items()},
     'engine_release': list(REL)[0], 'trained': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'torch': torch.__version__,
     'data': [{'dir': d.dir.replace('\\', '/'), 'kind': d.kind, 'N': d.N, 'sources': d.meta['sources'][:50]} for d in DSs]}
s = json.dumps(J, separators=(',', ':'))
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
open(args.out, 'w', encoding='utf8').write(s)
out_sha = hashlib.sha256(s.encode('utf8')).hexdigest()

metrics = {'model': args.name, 'arch': args.arch, 'params': nparams, 'out': {'path': args.out.replace('\\', '/'), 'sha256': out_sha},
           'engine_release': list(REL)[0], 'flags': vars(args), 'history': history, 'selected_epoch': best[2],
           'data': [{'dir': d.dir.replace('\\', '/'), 'kind': d.kind, 'N': d.N, 'train': int(len(d.train)), 'val': int(len(d.val)), 'test': int(len(d.test)),
                     'deep_labels': int((~np.isnan(d.vdeep)).sum()), 'exact_labels': int((~np.isnan(d.vexact)).sum()), 'root_values': int((~np.isnan(d.vroot)).sum()) if d.kind == 'selfplay' else 0} for d in DSs],
           'labels_files': [x for x in args.labels.split(',') if x], 'test': test, 'count_hp': chp, 'seconds': round(time.time() - T0)}
json.dump(metrics, open(args.metrics, 'w', encoding='utf8'), indent=1)
log('wrote', args.out, args.metrics)

# ------------------------------------------------------------------ parity fixture: raw rows + float64 logits of the EXPORTED weights
if args.fixture:
    Jr = json.loads(s)
    m64 = make().double()
    m64.load_state_dict({k: torch.from_numpy(np.frombuffer(base64.b64decode(w['f32_b64']), dtype='<f4').reshape(w['shape']).copy()).double() for k, w in Jr['weights'].items()})
    m64.eval()
    rows = []
    for d in DSs:
        pool = d.test if len(d.test) else d.train
        pick = np.sort(np.random.default_rng(7).choice(pool, min(12, len(pool)), replace=False))
        inv = {k: {v: s2 for s2, v in d.meta['vocab'][k].items()} for k in d.meta['vocab']}
        with torch.no_grad():
            lf = m64(d.batch(pick)).numpy()
        for r, i in enumerate(pick):
            tid = np.asarray(d.ids[i])
            rows.append({'src': d.dir.replace('\\', '/'), 'row': int(i), 'python_logit': float(lf[r]), 'x': {
                'tok': {sd: np.asarray(d.tok[i][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])},
                'ids': {sd: [[inv[KINDS[j]][int(tid[k, t, j])] for j in range(7)] for t in range(6)] for k, sd in enumerate(['p1', 'p2'])},
                'mvw': {sd: np.asarray(d.mvw[i][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])},
                'side': {sd: np.asarray(d.side[i][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])},
                'field': np.asarray(d.field[i]).astype(float).tolist(),
                'facts': {sd: np.asarray(d.facts[i][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])}}})
    json.dump({'what': 'PORYGON2 v1 Node/Python agreement: raw encoded rows and the float64 logits of the exported weights',
               'model': {'path': args.out.replace('\\', '/'), 'sha256': out_sha}, 'rows': rows}, open(args.fixture, 'w', encoding='utf8'))
    log('fixture', args.fixture, len(rows), 'rows')
