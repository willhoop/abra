"""solver/chomp/v1/train.py -- CHOMP v1's cell scorer, and gate (a).

    python solver/chomp/v1/train.py [--rows solver/out/chomp/v1/rows.jsonl] [--out solver/chomp/v1/model]

THE MODEL (pre-registered, solver/chomp/v1/preregistration.json `scorer`):
    x = g(a|b), y = g(b|a)                      the engine matchup aggregates of solver/chomp/v1/features.js
    s(x, y) = w.x                                arm `lin`
    s(x, y) = w.x + v.tanh(W[x;y] + c)           arm `mlp` (32 hidden)
    sp      = sum_{A} beta[sp] + sum_{LA} lam[sp] - sum_{B} beta[sp] - sum_{LB} lam[sp]
    logit   = tau_src * (s(x, y) - s(y, x) + sp)             tau_targeted = 1; tau_selfplay, tau_human learned (> 0)
    P(p1 wins) = sigmoid(logit)
Antisymmetric by construction: swapping the chairs gives 1 - P, and a mirror cell gives exactly 1/2.
The table CHOMP solves uses tau_selfplay (the arena bot is gen5 MILTANK; the self-play corpus is its play).

THE BASELINE (gate (a)): the same family, the same selection rule, fitted and evaluated with every side's option
replaced by the human-prior MODAL option of its sheet -- it sees the sheets, but only through the modal bring.

SELECTION: each arm is trained on TRAIN rows; the epoch with the lowest VAL log-loss is kept; the arm with the lower
VAL log-loss goes forward. Then gate (a) is read ONCE on the TEST rows.

DELIBERATE BREAK (env CHOMP1_BREAK=shuffle): the SCORER's training labels are shuffled (the baseline's are not), so the
scorer learns nothing about the outcome; gate (a) must FAIL.
"""
import json, os, sys, math, random, argparse, hashlib, time
import numpy as np
import torch

ap = argparse.ArgumentParser()
ap.add_argument('--rows', default='solver/out/chomp/v1/rows.jsonl')
ap.add_argument('--out', default='solver/chomp/v1/model')
ap.add_argument('--epochs', type=int, default=40)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--tag', default='chomp1')
ap.add_argument('--dev', action='store_true', help='development: fit and report VAL only; gate (a) is NOT read and no TEST row is scored')
args = ap.parse_args()
BREAK = os.environ.get('CHOMP1_BREAK', '')
torch.manual_seed(args.seed); np.random.seed(args.seed); random.seed(args.seed)
torch.set_num_threads(2)

SRC = {'targeted': 0, 'selfplay': 1, 'human': 2}
rows = []
with open(args.rows, encoding='utf8') as f:
    for l in f:
        if l.strip():
            rows.append(json.loads(l))
print('rows', len(rows))
t0 = time.time()

# species vocabulary from TRAIN rows (>= 10 appearances in a four), else OOV (index 0, fixed at 0)
cnt = {}
for r in rows:
    if r['split'] != 'train':
        continue
    for s in r['sp']['A'] + r['sp']['B']:
        cnt[s] = cnt.get(s, 0) + 1
vocab = ['<oov>'] + sorted([s for s, c in cnt.items() if c >= 10])
vix = {s: i for i, s in enumerate(vocab)}
V = len(vocab)
G = len(rows[0]['ga'])


def tensors(sel, modal):
    ga = 'gma' if modal else 'ga'
    gb = 'gmb' if modal else 'gb'
    A, LA, B, LB = ('mA', 'mLA', 'mB', 'mLB') if modal else ('A', 'LA', 'B', 'LB')
    X = np.array([r[ga] for r in sel], dtype=np.float32)
    Y = np.array([r[gb] for r in sel], dtype=np.float32)
    iA = np.array([[vix.get(s, 0) for s in r['sp'][A]] for r in sel], dtype=np.int64)
    iLA = np.array([[vix.get(s, 0) for s in r['sp'][LA]] for r in sel], dtype=np.int64)
    iB = np.array([[vix.get(s, 0) for s in r['sp'][B]] for r in sel], dtype=np.int64)
    iLB = np.array([[vix.get(s, 0) for s in r['sp'][LB]] for r in sel], dtype=np.int64)
    src = np.array([SRC[r['src']] for r in sel], dtype=np.int64)
    y = np.array([float(r['y']) for r in sel], dtype=np.float32)
    return dict(X=torch.tensor(X), Y=torch.tensor(Y), iA=torch.tensor(iA), iLA=torch.tensor(iLA), iB=torch.tensor(iB),
                iLB=torch.tensor(iLB), src=torch.tensor(src), y=torch.tensor(y))


class Scorer(torch.nn.Module):
    def __init__(self, arch, mu, sd):
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
        self.ltau = torch.nn.Parameter(torch.zeros(3))   # tau = exp(ltau); targeted's is held at 1

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
        lt = self.ltau.clone(); lt = torch.cat([torch.zeros(1), lt[1:]])
        src = d['src'] if tau_src is None else torch.full_like(d['src'], tau_src)
        return torch.exp(lt)[src] * z


def ll(model, d):
    with torch.no_grad():
        z = model.logit(d)
        return torch.nn.functional.binary_cross_entropy_with_logits(z, d['y'], reduction='none').numpy()


def fit(arch, tr, va, label, modal=False):
    X = tr['X'].numpy()
    mu = X.mean(0); sd = X.std(0) + 1e-3
    m = Scorer(arch, mu, sd)
    opt = torch.optim.Adam(m.parameters(), lr=3e-3)
    n = len(tr['y'])
    yt = tr['y'].clone()
    if BREAK == 'shuffle' and not modal:
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
            z = m.logit(d)
            loss = torch.nn.functional.binary_cross_entropy_with_logits(z, yt[ix])
            reg = 1e-4 * (m.beta.pow(2).sum() + m.lam.pow(2).sum()) + 1e-4 * m.w.pow(2).sum()
            if arch == 'mlp':
                reg = reg + 1e-4 * (m.W.weight.pow(2).sum() + m.v.pow(2).sum())
            opt.zero_grad(); (loss + reg).backward(); opt.step()
        v = float(ll(m, va).mean())
        hist.append(v)
        if v < best[0]:
            best = (v, {k: t.detach().clone() for k, t in m.state_dict().items()}, ep)
    m.load_state_dict(best[1])
    print(f'  {label} {arch}: best val LL {best[0]:.5f} at epoch {best[2]}  ({time.time() - t0:.0f}s)')
    return m, best[0], best[2], hist


def split(rs, s):
    return [r for r in rs if r['split'] == s]


def run(modal):
    tr, va = tensors(split(rows, 'train'), modal), tensors(split(rows, 'val'), modal)
    arms = {}
    for arch in ['lin', 'mlp']:
        arms[arch] = fit(arch, tr, va, 'baseline' if modal else 'scorer', modal)
    pick = min(arms, key=lambda a: arms[a][1])
    return pick, arms


sc_arch, sc_arms = run(False)
bl_arch, bl_arms = run(True)
SC, BL = sc_arms[sc_arch][0], bl_arms[bl_arch][0]

if args.dev:
    print('DEV run: VAL only', {k: v[1] for k, v in sc_arms.items()}, {k: v[1] for k, v in bl_arms.items()})
# ---- gate (a), read once on TEST (never in a --dev run: TEST rows are not scored) ----
te = split(rows, 'val' if args.dev else 'test')
sets = {'T1': [r for r in te if r['src'] == 'targeted'], 'T2': [r for r in te if r['src'] == 'selfplay'], 'T3': [r for r in te if r['src'] == 'human']}


def delta_block(rs):
    if not rs:
        return None
    a = ll(SC, tensors(rs, False)); b = ll(BL, tensors(rs, True))
    return a, b, [r['pair'] for r in rs]


def boot(a, b, pairs, B=2000, seed=1):
    d = a - b
    keys = sorted(set(pairs)); ki = {k: i for i, k in enumerate(keys)}
    idx = np.array([ki[p] for p in pairs])
    sums = np.bincount(idx, weights=d, minlength=len(keys)); cnts = np.bincount(idx, minlength=len(keys))
    rng = np.random.default_rng(seed)
    bs = []
    for _ in range(B):
        s = rng.integers(0, len(keys), len(keys))
        bs.append(sums[s].sum() / cnts[s].sum())
    return float(d.mean()), [float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))]


res = {}
pool = ([], [], [])
for k, rs in (sets.items() if not args.dev else []):
    blk = delta_block(rs)
    if blk is None:
        res[k] = None; continue
    a, b, p = blk
    m, ci = boot(a, b, p)
    res[k] = {'n': len(rs), 'pairs': len(set(p)), 'll_scorer': float(a.mean()), 'll_baseline': float(b.mean()), 'delta': m, 'ci95': ci,
              'brier_scorer': None}
    if k in ('T1', 'T2'):
        pool[0].extend(a); pool[1].extend(b); pool[2].extend(p)
if args.dev:
    verdict, ci = 'DEV-NOT-READ', [None, None]
else:
    m, ci = boot(np.array(pool[0]), np.array(pool[1]), pool[2])
    res['T1+T2'] = {'n': len(pool[0]), 'pairs': len(set(pool[2])), 'delta': m, 'ci95': ci}
    verdict = 'PASS' if ci[1] < 0 else 'FAIL'
print('gate (a):', json.dumps(res, indent=1), verdict)

# ---- bring signal inside a table: spread of the cells under one sheet pair, on T1 pairs ----
os.makedirs(args.out, exist_ok=True)


def export(m, arch):
    sd = m.state_dict()
    o = {'arch': 'chomp1-' + arch, 'g_dim': G, 'vocab': vocab, 'mu': m.mu.tolist(), 'sd': m.sd.tolist(), 'w': m.w.detach().tolist(),
         'beta': (m.beta.detach() * (torch.arange(V) > 0)).tolist(), 'lam': (m.lam.detach() * (torch.arange(V) > 0)).tolist(),
         'tau': {'targeted': 1.0, 'selfplay': float(torch.exp(m.ltau[1])), 'human': float(torch.exp(m.ltau[2]))}}
    if arch == 'mlp':
        o['W'] = m.W.weight.detach().tolist(); o['c'] = m.W.bias.detach().tolist(); o['v'] = m.v.detach().tolist()
    return o


model = export(SC, sc_arch)
model['meta'] = {'rows_file': args.rows, 'rows_sha256': hashlib.sha256(open(args.rows, 'rb').read()).hexdigest(), 'seed': args.seed,
                 'epochs': args.epochs, 'break': BREAK or None,
                 'val_ll': {k: float(v[1]) for k, v in sc_arms.items()}, 'best_epoch': {k: int(v[2]) for k, v in sc_arms.items()}}
base = export(BL, bl_arch)
counts = {}
for r in rows:
    counts.setdefault(r['src'], {}).setdefault(r['split'], 0)
    counts[r['src']][r['split']] += 1
metrics = {'scorer_arch': sc_arch, 'baseline_arch': bl_arch, 'val_ll': {'scorer': {k: float(v[1]) for k, v in sc_arms.items()}, 'baseline': {k: float(v[1]) for k, v in bl_arms.items()}},
           'val_hist': {'scorer': {k: v[3] for k, v in sc_arms.items()}, 'baseline': {k: v[3] for k, v in bl_arms.items()}},
           'gate_a': res, 'gate_a_verdict': verdict, 'gate_a_rule': 'CI upper of delta on T1+T2 pooled < 0', 'counts': counts, 'vocab': V,
           'tau': model['tau'], 'break': BREAK or None}
# PARITY FIXTURES: 20 TEST rows with the Python logit at the selfplay temperature (solver/tests/test-chomp1.js PARITY)
fx = te[::max(1, len(te) // 20)][:20]
with torch.no_grad():
    zf = SC.logit(tensors(fx, False), tau_src=SRC['selfplay']).tolist()
model['fixtures'] = [{'ga': r['ga'], 'gb': r['gb'], 'sp': {k: r['sp'][k] for k in ('A', 'LA', 'B', 'LB')}, 'logit': z} for r, z in zip(fx, zf)]
tag = args.tag + ('-BREAK-' + BREAK if BREAK else '')
json.dump(model, open(os.path.join(args.out, tag + '.json'), 'w'))
json.dump(base, open(os.path.join(args.out, tag + '-baseline.json'), 'w'))
json.dump(metrics, open(os.path.join(args.out, tag + '.metrics.json'), 'w'), indent=1)
print('wrote', os.path.join(args.out, tag + '.json'), verdict)
sys.exit(0 if verdict in ('PASS', 'DEV-NOT-READ') else 3)
