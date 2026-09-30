"""solver/chomp/v2/train.py -- CHOMP v2's cell scorer, and gate (a) against CHOMP v1 as shipped.

    python solver/chomp/v2/train.py [--rows solver/out/chomp/v2/rows.jsonl] [--out solver/chomp/v2/model] [--dev]

Pre-registered in solver/chomp/v2/preregistration.json. The family, optimiser, epochs, batch, L2, vocabulary rule and
seed are v1's (solver/chomp/v1/train.py); only the features differ.

CANDIDATES (selection on VAL log-loss, over candidate x arm x epoch):
    flat+field   rows' fa / fb   (v1's 22 at the table stat line + the field block)
    set+field    rows' sa / sb   (v1's 22 at the set spread + the field block)
ABLATIONS (VAL only, never read on TEST): set (sa[:22]), flat (v1a: v1's own features, refit).

THE BASELINE is v1 AS SHIPPED (solver/chomp/v1/model/chomp1.json): a NumPy forward pass of its exported weights on the
rows' v1a / v1b. Before any TEST row is scored, that pass must reproduce v1's recorded VAL log-loss to 1e-4.

GATE (a), read once on TEST: delta = LL(v2) - LL(v1) per row; 95% bootstrap CI over pairs (2,000, seed 1) on T1+T2
pooled; PASS iff the upper bound < 0. T3 (human) reported, not gated.

DELIBERATE BREAK (env CHOMP2_BREAK=shuffle): v2's TRAIN labels are shuffled (v1 untouched); gate (a) must FAIL.
"""
import json, os, sys, math, random, argparse, hashlib, time
import numpy as np
import torch

ap = argparse.ArgumentParser()
ap.add_argument('--rows', default='solver/out/chomp/v2/rows.jsonl')
ap.add_argument('--out', default='solver/chomp/v2/model')
ap.add_argument('--v1', default='solver/chomp/v1/model/chomp1.json')
ap.add_argument('--v1-metrics', default='solver/chomp/v1/model/chomp1.metrics.json')
ap.add_argument('--epochs', type=int, default=40)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--tag', default='chomp2')
ap.add_argument('--dev', action='store_true', help='fit and report VAL only; gate (a) is NOT read and no TEST row is scored')
args = ap.parse_args()
BREAK = os.environ.get('CHOMP2_BREAK', '')
torch.set_num_threads(2)

SRC = {'targeted': 0, 'selfplay': 1, 'human': 2}
rows = []
with open(args.rows, encoding='utf8') as f:
    for l in f:
        if l.strip():
            rows.append(json.loads(l))
print('rows', len(rows))
t0 = time.time()

cnt = {}
for r in rows:
    if r['split'] != 'train':
        continue
    for s in r['sp']['A'] + r['sp']['B']:
        cnt[s] = cnt.get(s, 0) + 1
vocab = ['<oov>'] + sorted([s for s, c in cnt.items() if c >= 10])
vix = {s: i for i, s in enumerate(vocab)}
V = len(vocab)
FEATS = {'flat+field': ('fa', 'fb', None), 'set+field': ('sa', 'sb', None), 'set': ('sa', 'sb', 22), 'flat': ('v1a', 'v1b', None)}
CANDIDATES = ['flat+field', 'set+field']
ABLATIONS = ['set', 'flat']


def split(rs, s):
    return [r for r in rs if r['split'] == s]


def tensors(sel, feat):
    ka, kb, cut = FEATS[feat]
    X = np.array([r[ka][:cut] for r in sel], dtype=np.float32)
    Y = np.array([r[kb][:cut] for r in sel], dtype=np.float32)
    ix = lambda key: np.array([[vix.get(s, 0) for s in r['sp'][key]] for r in sel], dtype=np.int64)
    src = np.array([SRC[r['src']] for r in sel], dtype=np.int64)
    y = np.array([float(r['y']) for r in sel], dtype=np.float32)
    return dict(X=torch.tensor(X), Y=torch.tensor(Y), iA=torch.tensor(ix('A')), iLA=torch.tensor(ix('LA')), iB=torch.tensor(ix('B')),
                iLB=torch.tensor(ix('LB')), src=torch.tensor(src), y=torch.tensor(y))


class Scorer(torch.nn.Module):
    def __init__(self, arch, mu, sd, G):
        super().__init__()
        self.arch = arch
        self.register_buffer('mu', torch.tensor(mu))
        self.register_buffer('sd', torch.tensor(sd))
        self.w = torch.nn.Parameter(torch.zeros(G))
        if arch == 'mlp':
            self.W = torch.nn.Linear(2 * G, 32)
            self.v = torch.nn.Parameter(torch.zeros(32))
        self.beta = torch.nn.Parameter(torch.zeros(V))
        self.lam = torch.nn.Parameter(torch.zeros(V))
        self.ltau = torch.nn.Parameter(torch.zeros(3))

    def s(self, x, y):
        out = x @ self.w
        if self.arch == 'mlp':
            out = out + torch.tanh(self.W(torch.cat([x, y], 1))) @ self.v
        return out

    def logit(self, d, tau_src=None):
        x = (d['X'] - self.mu) / self.sd
        y = (d['Y'] - self.mu) / self.sd
        mask = torch.ones(V); mask[0] = 0
        b, l = self.beta * mask, self.lam * mask
        sp = b[d['iA']].sum(1) + l[d['iLA']].sum(1) - b[d['iB']].sum(1) - l[d['iLB']].sum(1)
        z = self.s(x, y) - self.s(y, x) + sp
        lt = torch.cat([torch.zeros(1), self.ltau[1:]])
        src = d['src'] if tau_src is None else torch.full_like(d['src'], tau_src)
        return torch.exp(lt)[src] * z


def ll(model, d):
    with torch.no_grad():
        z = model.logit(d)
        return torch.nn.functional.binary_cross_entropy_with_logits(z, d['y'], reduction='none').numpy()


def fit(arch, feat, tr, va, shuffle):
    torch.manual_seed(args.seed); np.random.seed(args.seed); random.seed(args.seed)
    X = tr['X'].numpy()
    mu = X.mean(0); sd = X.std(0) + 1e-3
    G = X.shape[1]
    m = Scorer(arch, mu, sd, G)
    opt = torch.optim.Adam(m.parameters(), lr=3e-3)
    n = len(tr['y'])
    yt = tr['y'].clone()
    if shuffle:
        g = torch.Generator().manual_seed(7)
        yt = yt[torch.randperm(n, generator=g)]
    best = (1e9, None, -1)
    hist = []
    for ep in range(args.epochs):
        perm = torch.randperm(n)
        m.train()
        for k in range(0, n, 512):
            ix = perm[k:k + 512]
            d = {kk: vv[ix] for kk, vv in tr.items()}
            loss = torch.nn.functional.binary_cross_entropy_with_logits(m.logit(d), yt[ix])
            reg = 1e-4 * (m.beta.pow(2).sum() + m.lam.pow(2).sum()) + 1e-4 * m.w.pow(2).sum()
            if arch == 'mlp':
                reg = reg + 1e-4 * (m.W.weight.pow(2).sum() + m.v.pow(2).sum())
            opt.zero_grad(); (loss + reg).backward(); opt.step()
        v = float(ll(m, va).mean())
        hist.append(v)
        if v < best[0]:
            best = (v, {k: t.detach().clone() for k, t in m.state_dict().items()}, ep)
    m.load_state_dict(best[1])
    print(f'  {feat:11s} {arch}: best VAL LL {best[0]:.5f} at epoch {best[2]}  ({time.time() - t0:.0f}s)', flush=True)
    return m, best[0], best[2], hist


# ---- v1 as shipped, in NumPy ----
V1 = json.load(open(args.v1))
V1M = json.load(open(args.v1_metrics))
v1vix = {s: i for i, s in enumerate(V1['vocab'])}


def v1_ll(sel):
    mu, sd, w = np.array(V1['mu']), np.array(V1['sd']), np.array(V1['w'])
    beta, lam = np.array(V1['beta']), np.array(V1['lam'])
    tau = np.array([V1['tau']['targeted'], V1['tau']['selfplay'], V1['tau']['human']])
    mlp = V1['arch'] == 'chomp1-mlp'
    out = np.empty(len(sel))
    for n, r in enumerate(sel):
        x = (np.array(r['v1a']) - mu) / sd
        y = (np.array(r['v1b']) - mu) / sd
        def s(p, q):
            o = w @ p
            if mlp:
                o += np.tanh(np.array(V1['W']) @ np.concatenate([p, q]) + np.array(V1['c'])) @ np.array(V1['v'])
            return o
        ix = lambda key: [v1vix.get(q, 0) for q in r['sp'][key]]
        spv = beta[ix('A')].sum() + lam[ix('LA')].sum() - beta[ix('B')].sum() - lam[ix('LB')].sum()
        z = tau[SRC[r['src']]] * (s(x, y) - s(y, x) + spv)
        yy = float(r['y'])
        out[n] = max(z, 0) - z * yy + math.log1p(math.exp(-abs(z)))
    return out


val_rows = split(rows, 'val')
v1_val = float(v1_ll(val_rows).mean())
v1_rec = V1M['val_ll']['scorer'][V1M['scorer_arch']]
print(f'v1 as shipped: VAL LL {v1_val:.6f} (recorded {v1_rec:.6f})')
if abs(v1_val - v1_rec) > 1e-4:
    print('STOP: the v1 forward pass does not reproduce v1\'s recorded VAL log-loss')
    if not args.dev:
        sys.exit(4)

tr_rows = split(rows, 'train')
fits = {}
for feat in CANDIDATES + ABLATIONS:
    tr, va = tensors(tr_rows, feat), tensors(val_rows, feat)
    for arch in ['lin', 'mlp']:
        fits[(feat, arch)] = fit(arch, feat, tr, va, BREAK == 'shuffle' and feat in CANDIDATES)
pick = min([(f, a) for f in CANDIDATES for a in ['lin', 'mlp']], key=lambda k: fits[k][1])
SC = fits[pick][0]
print('selected', pick, 'VAL LL', fits[pick][1])
val_table = {f + '/' + a: {'val_ll': float(fits[(f, a)][1]), 'best_epoch': int(fits[(f, a)][2]), 'role': 'candidate' if f in CANDIDATES else 'ablation (VAL only)'}
             for (f, a) in fits}


def boot(d, pairs, B=2000, seed=1):
    keys = sorted(set(pairs)); ki = {k: i for i, k in enumerate(keys)}
    idx = np.array([ki[p] for p in pairs])
    sums = np.bincount(idx, weights=d, minlength=len(keys)); cnts = np.bincount(idx, minlength=len(keys))
    rng = np.random.default_rng(seed)
    bs = []
    for _ in range(B):
        s = rng.integers(0, len(keys), len(keys))
        bs.append(sums[s].sum() / cnts[s].sum())
    return float(d.mean()), [float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))]


res, verdict = {}, 'DEV-NOT-READ'
if not args.dev:
    te = split(rows, 'test')
    sets = {'T1': [r for r in te if r['src'] == 'targeted'], 'T2': [r for r in te if r['src'] == 'selfplay'], 'T3': [r for r in te if r['src'] == 'human']}
    pool = ([], [])
    for k, rs in sets.items():
        a = ll(SC, tensors(rs, pick[0])); b = v1_ll(rs); p = [r['pair'] for r in rs]
        m, ci = boot(a - b, p)
        res[k] = {'n': len(rs), 'pairs': len(set(p)), 'll_v2': float(a.mean()), 'll_v1': float(b.mean()), 'delta': m, 'ci95': ci}
        if k in ('T1', 'T2'):
            pool[0].extend(a - b); pool[1].extend(p)
    m, ci = boot(np.array(pool[0]), pool[1])
    res['T1+T2'] = {'n': len(pool[0]), 'pairs': len(set(pool[1])), 'delta': m, 'ci95': ci}
    verdict = 'PASS' if ci[1] < 0 else 'FAIL'
print('gate (a):', json.dumps(res, indent=1), verdict)

os.makedirs(args.out, exist_ok=True)
feat, arch = pick
G = SC.w.shape[0]
sd_ = SC.state_dict()
model = {'arch': 'chomp2-' + arch, 'features': feat, 'g_dim': G, 'vocab': vocab, 'mu': SC.mu.tolist(), 'sd': SC.sd.tolist(), 'w': SC.w.detach().tolist(),
         'beta': (SC.beta.detach() * (torch.arange(V) > 0)).tolist(), 'lam': (SC.lam.detach() * (torch.arange(V) > 0)).tolist(),
         'tau': {'targeted': 1.0, 'selfplay': float(torch.exp(SC.ltau[1].detach())), 'human': float(torch.exp(SC.ltau[2].detach()))}}
if arch == 'mlp':
    model['W'] = SC.W.weight.detach().tolist(); model['c'] = SC.W.bias.detach().tolist(); model['v'] = SC.v.detach().tolist()
model['meta'] = {'rows_file': args.rows, 'rows_sha256': hashlib.sha256(open(args.rows, 'rb').read()).hexdigest(), 'seed': args.seed, 'epochs': args.epochs,
                 'break': BREAK or None, 'val_ll': float(fits[pick][1]), 'best_epoch': int(fits[pick][2])}
fx = val_rows[::max(1, len(val_rows) // 20)][:20]
ka, kb, _ = FEATS[feat]
with torch.no_grad():
    zf = SC.logit(tensors(fx, feat), tau_src=SRC['selfplay']).tolist()
model['fixtures'] = [{'ga': r[ka], 'gb': r[kb], 'sp': {k: r['sp'][k] for k in ('A', 'LA', 'B', 'LB')}, 'logit': z} for r, z in zip(fx, zf)]
counts = {}
for r in rows:
    counts.setdefault(r['src'], {}).setdefault(r['split'], 0)
    counts[r['src']][r['split']] += 1
metrics = {'selected': {'features': feat, 'arch': arch}, 'val': val_table, 'v1_val_ll': {'numpy_pass': v1_val, 'recorded': v1_rec},
           'gate_a': res, 'gate_a_verdict': verdict, 'gate_a_rule': 'CI upper of delta = LL(v2) - LL(v1 as shipped) on T1+T2 pooled < 0',
           'counts': counts, 'vocab': V, 'tau': model['tau'], 'break': BREAK or None, 'dev': bool(args.dev),
           'lin_weights': {k: [float(x) for x in fits[(k, 'lin')][0].w.detach().tolist()] for k in CANDIDATES}}
tag = args.tag + ('-BREAK-' + BREAK if BREAK else '') + ('-dev' if args.dev else '')
json.dump(model, open(os.path.join(args.out, tag + '.json'), 'w'))
json.dump(metrics, open(os.path.join(args.out, tag + '.metrics.json'), 'w'), indent=1)
print('wrote', os.path.join(args.out, tag + '.json'), verdict)
sys.exit(0 if verdict in ('PASS', 'DEV-NOT-READ') else 3)
