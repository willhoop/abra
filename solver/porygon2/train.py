"""solver/porygon2/train.py -- PORYGON2 v0, the value net: P(p1 wins | both open sheets, the public state).

    python solver/porygon2/train.py [--data solver/out/porygon2] [--out solver/porygon2/model] [--threads 6]
                                    [--human <games.jsonl dir>] [--splithalf] [--seed 1]

Trains three models on the SAME positions and evaluates them on the SAME held-out positions:
  count-HP   logistic on [alive_diff, hp_diff] (PORY's reduced form), no intercept -- baseline (a)
  emb        the set-embedding Deep-Sets net with NO engine facts                    -- baseline (b)
  full       the same net PLUS the MEDICHAM damage-race facts (PRE-GATE)             -- PORYGON2 v0

THE SPLIT is MAG's and DODUO's (sha256("abra-prior-v0:" + player) mod 100, by player). A value label is a
property of the GAME, and the net is antisymmetric (P(p1) = 1 - P(p2 viewing the same board)), so one game
seen from its train player's side IS the same example as that game seen from its test player's side. So:
  train  = positions of games whose BOTH players are train players
  val    = positions viewed by a val player (early stopping only)
  test   = positions viewed by a test player; a game with two test players counts twice (both viewers)
Games mixing a train player with a held-out one are not trained on. The counts are written to the metrics.

ANTISYMMETRY BY CONSTRUCTION: logit = g(A, B) - g(B, A). The side encoder is a Deep Sets pool (sum, max,
actives-sum over the six sheet tokens), so the slot and sheet order cannot matter.

CIs are paired and clustered by GAME (positions of one game share a label): a bootstrap over games.

Outputs: <out>/porygon2-v0.json (full), <out>/porygon2-v0-emb.json (emb-only), <out>/porygon2-v0.metrics.json,
and solver/tests/fixtures/porygon2-agreement.json (raw positions + Python float64 logits, for the Node test).
Weights are stored as base64 little-endian float32 (exact, compact); Node decodes them.
"""
import argparse, base64, hashlib, json, math, os, sys, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='solver/out/porygon2')
ap.add_argument('--out', default='solver/porygon2/model')
ap.add_argument('--threads', type=int, default=6)
ap.add_argument('--human', default=r'C:\Users\willj\Projects\Pokemon\ABRA\solver\out\human')
ap.add_argument('--splithalf', action='store_true')
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--epochs', type=int, default=30)
ap.add_argument('--fixture', default='solver/tests/fixtures/porygon2-agreement.json')
ap.add_argument('--boot', type=int, default=2000)
args = ap.parse_args()

import torch
import torch.nn as nn
torch.set_num_threads(min(6, args.threads))
torch.manual_seed(args.seed); np.random.seed(args.seed)
T0 = time.time()

meta = json.load(open(os.path.join(args.data, 'meta.json'), encoding='utf8'))
N = meta['N']; nm = meta['names']
TN, SN, FN, KN = len(nm['tok_num']), len(nm['side']), len(nm['field']), len(nm['facts'])
def mm(name, dt, shape):
    return np.memmap(os.path.join(args.data, name), dtype=dt, mode='r', shape=shape)
tok_num = mm('tok_num.f32', '<f4', (N, 2, 6, TN)); tok_id = mm('tok_id.i32', '<i4', (N, 2, 6, 7))
side = mm('side.f32', '<f4', (N, 2, SN)); field = mm('field.f32', '<f4', (N, FN))
facts = mm('facts.f32', '<f4', (N, 2, KN)); base = mm('base.f32', '<f4', (N, 2)); M = np.array(mm('meta.i32', '<i4', (N, len(nm['meta']))))
col = {c: i for i, c in enumerate(nm['meta'])}
game, turn, y = M[:, col['game']], M[:, col['turn']], M[:, col['winner']].astype(np.float64)
s1, s2 = M[:, col['split_p1']], M[:, col['split_p2']]

train_idx = np.where((s1 == 0) & (s2 == 0))[0]
val_idx = np.where((s1 == 1) | (s2 == 1))[0]
val_w = ((s1 == 1).astype(np.float64) + (s2 == 1))[val_idx]
test_idx = np.where((s1 == 2) | (s2 == 2))[0]
test_w = ((s1 == 2).astype(np.float64) + (s2 == 2))[test_idx]
print(f'positions {N}: train {len(train_idx)} val {len(val_idx)} test {len(test_idx)} (test views {int(test_w.sum())})', flush=True)

# ---- vocab: an id the TRAIN games never used maps to <unk> (0) --------------------------------------
KINDS = ['species', 'item', 'ability', 'move', 'move', 'move', 'move']
vocab_final, remap = {}, {}
for kind in ['species', 'item', 'ability', 'move']:
    glob = meta['vocab'][kind]; tc = meta['train_count'][kind]
    keep = ['<unk>'] + sorted(s for s in glob if s != '<unk>' and tc.get(s, 0) >= 3)
    vocab_final[kind] = {s: i for i, s in enumerate(keep)}
    r = np.zeros(len(glob), dtype=np.int64)
    for s, gi in glob.items(): r[gi] = vocab_final[kind].get(s, 0)
    remap[kind] = r
def ids_of(idx):
    raw = np.asarray(tok_id[idx], dtype=np.int64)
    out = np.empty_like(raw)
    for j, kind in enumerate(KINDS): out[..., j] = remap[kind][raw[..., j]]
    return out
def load(idx):
    return dict(tn=torch.from_numpy(np.asarray(tok_num[idx])), ti=torch.from_numpy(ids_of(idx)),
                sd=torch.from_numpy(np.asarray(side[idx])), fd=torch.from_numpy(np.asarray(field[idx])),
                fc=torch.from_numpy(np.asarray(facts[idx])), bs=torch.from_numpy(np.asarray(base[idx])),
                y=torch.from_numpy(y[idx]).float())

# ---- the net -----------------------------------------------------------------------------------------
DIMS = dict(sp=16, it=8, ab=8, mv=8, tok=48, head1=64, head2=32)
class Pory2(nn.Module):
    def __init__(self, facts_on):
        super().__init__()
        d = DIMS; self.facts_on = facts_on
        self.e_sp = nn.Embedding(len(vocab_final['species']), d['sp']); self.e_it = nn.Embedding(len(vocab_final['item']), d['it'])
        self.e_ab = nn.Embedding(len(vocab_final['ability']), d['ab']); self.e_mv = nn.Embedding(len(vocab_final['move']), d['mv'])
        tin = TN + d['sp'] + d['it'] + d['ab'] + d['mv']
        self.t1 = nn.Linear(tin, d['tok']); self.t2 = nn.Linear(d['tok'], d['tok'])
        sv = 3 * d['tok'] + SN
        hin = 2 * sv + FN + (2 * KN if facts_on else 0)
        self.h1 = nn.Linear(hin, d['head1']); self.h2 = nn.Linear(d['head1'], d['head2']); self.h3 = nn.Linear(d['head2'], 1)
        self.drop = nn.Dropout(0.1)
        for e in [self.e_sp, self.e_it, self.e_ab, self.e_mv]: nn.init.normal_(e.weight, std=0.1)
    def side_vec(self, tn, ti, sd):
        emb = torch.cat([self.e_sp(ti[..., 0]), self.e_it(ti[..., 1]), self.e_ab(ti[..., 2]), self.e_mv(ti[..., 3:7]).mean(-2)], -1)
        h = torch.relu(self.t2(torch.relu(self.t1(torch.cat([tn, emb], -1)))))
        w = tn[..., 1:2]; act = tn[..., 3:4]
        return torch.cat([(w * h).sum(-2) / 4, (h * (w > 0).to(h.dtype)).max(-2).values, (act * h).sum(-2) / 2, sd], -1)
    def g(self, a, b, fd, fa, fb):
        x = torch.cat([a, b, fd] + ([fa, fb] if self.facts_on else []), -1)
        return self.h3(self.drop(torch.relu(self.h2(self.drop(torch.relu(self.h1(x))))))).squeeze(-1)
    def forward(self, B):
        sv = self.side_vec(B['tn'].to(self.h1.weight.dtype), B['ti'], B['sd'].to(self.h1.weight.dtype))
        fd = B['fd'].to(self.h1.weight.dtype); fc = B['fc'].to(self.h1.weight.dtype)
        return self.g(sv[:, 0], sv[:, 1], fd, fc[:, 0], fc[:, 1]) - self.g(sv[:, 1], sv[:, 0], fd, fc[:, 1], fc[:, 0])

def batches(D, idx, bs, shuffle, rng=None):
    order = rng.permutation(len(idx)) if shuffle else np.arange(len(idx))
    for i in range(0, len(order), bs):
        j = torch.from_numpy(order[i:i + bs])
        yield {k: v[j] for k, v in D.items()}

def predict(model, D):
    model.eval(); out = []
    with torch.no_grad():
        n = len(D['y'])
        for i in range(0, n, 4096):
            out.append(model({k: v[i:i + 4096] for k, v in D.items()}).double())
    return torch.cat(out).numpy()

def logloss(logit, yy, w):
    l = np.logaddexp(0, logit) - yy * logit
    return float((l * w).sum() / w.sum())

def train_net(facts_on, Dtr, Dva, tag, seed):
    torch.manual_seed(seed); rng = np.random.default_rng(seed)
    model = Pory2(facts_on)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    best, best_state, bad = 1e9, None, 0
    lossf = nn.BCEWithLogitsLoss()
    for ep in range(args.epochs):
        model.train(); t = time.time(); tot = 0; nb = 0
        for B in batches(Dtr, np.arange(len(Dtr['y'])), 1024, True, rng):
            opt.zero_grad(); loss = lossf(model(B), B['y']); loss.backward(); opt.step(); tot += loss.item(); nb += 1
        vl = logloss(predict(model, Dva), Dva['y'].double().numpy(), val_w)
        print(f'  [{tag}] epoch {ep} train {tot / nb:.4f} val {vl:.4f} {time.time() - t:.0f}s', flush=True)
        if vl < best - 1e-5: best, bad = vl, 0; best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= 4: break
    model.load_state_dict(best_state)
    return model, best

Dtr, Dva, Dte = load(train_idx), load(val_idx), load(test_idx)
print(f'loaded {time.time() - T0:.0f}s', flush=True)

# ---- (a) count-HP logistic -------------------------------------------------------------------------
Xb = Dtr['bs'].double(); yb = Dtr['y'].double()
wb = torch.zeros(2, dtype=torch.float64, requires_grad=True)
optb = torch.optim.LBFGS([wb], max_iter=200, line_search_fn='strong_wolfe')
def closure():
    optb.zero_grad(); l = nn.functional.binary_cross_entropy_with_logits(Xb @ wb, yb); l.backward(); return l
optb.step(closure)
wbase = wb.detach().numpy().copy()
print('count-HP logistic weights [alive_diff, hp_diff]:', wbase, flush=True)

full, full_val = train_net(True, Dtr, Dva, 'full', args.seed)
emb, emb_val = train_net(False, Dtr, Dva, 'emb', args.seed)

yt = Dte['y'].double().numpy(); gt = game[test_idx]; tt = turn[test_idx]
L = {
    'count_hp': Dte['bs'].double().numpy() @ wbase,
    'emb': predict(emb, Dte),
    'full': predict(full, Dte),
}
def per_pos(logit):
    p = 1 / (1 + np.exp(-logit))
    return np.logaddexp(0, logit) - yt * logit, (p - yt) ** 2
PP = {k: per_pos(v) for k, v in L.items()}

ug, ginv = np.unique(gt, return_inverse=True)
brng = np.random.default_rng(12345)
BOOT = brng.multinomial(len(ug), np.full(len(ug), 1 / len(ug)), size=args.boot).astype(np.float64)  # [boot, games]
def clustered(vals, mask=None):
    """weighted mean of a per-position value and its 95% game-bootstrap interval"""
    w = test_w if mask is None else test_w * mask
    num = np.bincount(ginv, weights=vals * w, minlength=len(ug)); den = np.bincount(ginv, weights=w, minlength=len(ug))
    est = num.sum() / den.sum()
    bs = (BOOT @ num) / np.maximum(BOOT @ den, 1e-12)
    lo, hi = np.percentile(bs, [2.5, 97.5])
    return {'mean': round(float(est), 5), 'ci95': [round(float(lo), 5), round(float(hi), 5)], 'n_positions': int((w > 0).sum()), 'n_views': float(w.sum()), 'n_games': int((den > 0).sum())}

BUCKETS = [('1', 1, 1), ('2', 2, 2), ('3', 3, 3), ('4-5', 4, 5), ('6-8', 6, 8), ('9+', 9, 999)]
def report(mask=None):
    r = {}
    for k in L: r[k] = {'logloss': clustered(PP[k][0], mask), 'brier': clustered(PP[k][1], mask)}
    pairs = [('full', 'count_hp'), ('full', 'emb'), ('emb', 'count_hp')]
    r['paired'] = {f'{a}_minus_{b}': {'logloss': clustered(PP[a][0] - PP[b][0], mask), 'brier': clustered(PP[a][1] - PP[b][1], mask)} for a, b in pairs}
    return r

metrics = {
    'status': 'PRE-GATE -- the engine facts are MEDICHAM Reg M-C answers and the Reg M-C gate is NOT open',
    'model': 'PORYGON2 v0', 'feature_version': meta['feature_version'], 'torch': torch.__version__,
    'dataset': meta['dataset'], 'engine_sha_at_build': meta['engine_sha'], 'split': meta['split'],
    'positions': {'total': int(N), 'train': int(len(train_idx)), 'val': int(len(val_idx)), 'test': int(len(test_idx)), 'test_views': int(test_w.sum()),
                  'train_games': int(len(np.unique(game[train_idx]))), 'test_games': int(len(ug)),
                  'excluded_mixed_train_heldout_games': int(len(np.unique(game[((s1 == 0) ^ (s2 == 0))])))},
    'count_hp_weights': {'alive_diff': float(wbase[0]), 'hp_diff': float(wbase[1])},
    'val_logloss': {'full': full_val, 'emb': emb_val},
    'test': report(),
    'by_turn': {b: report(((tt >= lo) & (tt <= hi)).astype(np.float64)) for b, lo, hi in BUCKETS},
    'bootstrap': {'resamples': args.boot, 'unit': 'game', 'seed': 12345},
    'dims': DIMS, 'params': {'full': sum(p.numel() for p in full.parameters()), 'emb': sum(p.numel() for p in emb.parameters())},
}
# calibration of the full net: 10 equal-width bins of P(p1 wins) on the test views
pf = 1 / (1 + np.exp(-L['full']))
cal = []
for i in range(10):
    m = (pf >= i / 10) & (pf < (i + 1) / 10 if i < 9 else pf <= 1)
    if m.any(): cal.append({'bin': [i / 10, (i + 1) / 10], 'n_views': float(test_w[m].sum()), 'mean_p': round(float((pf[m] * test_w[m]).sum() / test_w[m].sum()), 4), 'win_rate': round(float((yt[m] * test_w[m]).sum() / test_w[m].sum()), 4)})
metrics['calibration_full'] = cal

# ---- split-half floor: two full nets on disjoint halves of the TRAIN games ----------------------------
if args.splithalf:
    half = (game[train_idx] % 2) == 0
    hs = []
    for h in [half, ~half]:
        Dh = {k: v[torch.from_numpy(np.where(h)[0])] for k, v in Dtr.items()}
        m_, _ = train_net(True, Dh, Dva, 'half', args.seed + 7)
        hs.append(per_pos(predict(m_, Dte))[0])
    d = clustered(hs[0] - hs[1])
    metrics['split_half_floor'] = {'what': 'paired test log-loss difference between two full nets trained on disjoint halves of the train games',
                                   'half_a_minus_half_b': d, 'abs_floor': abs(d['mean'])}

# ---- export ------------------------------------------------------------------------------------------
def b64(t): return base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode('ascii')
def export(model, path, facts_on):
    sd = model.state_dict()
    W = {k: {'shape': list(v.shape), 'f32_b64': b64(v)} for k, v in sd.items()}
    J = {'model': 'PORYGON2 v0' + ('' if facts_on else ' (embeddings only, no engine facts)'),
         'status': 'PRE-GATE' if facts_on else 'store-only inputs', 'feature_version': meta['feature_version'],
         'facts_on': facts_on, 'dims': DIMS, 'names': {k: nm[k] for k in ['tok_num', 'tok_id', 'side', 'field', 'facts']},
         'vocab': vocab_final, 'weights': W, 'dataset_sha256': meta['dataset']['games_sha256'], 'engine_sha_at_build': meta['engine_sha'],
         'trained': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'torch': torch.__version__,
         'forward': 'logit = g(side p1, side p2) - g(side p2, side p1); P(p1 wins) = sigmoid(logit); see solver/porygon2/infer.js'}
    s = json.dumps(J, separators=(',', ':'))
    open(path, 'w', encoding='utf8').write(s)
    return hashlib.sha256(s.encode('utf8')).hexdigest()
os.makedirs(args.out, exist_ok=True)
metrics['models'] = {'full': {'path': 'solver/porygon2/model/porygon2-v0.json', 'sha256': export(full, os.path.join(args.out, 'porygon2-v0.json'), True)},
                     'emb': {'path': 'solver/porygon2/model/porygon2-v0-emb.json', 'sha256': export(emb, os.path.join(args.out, 'porygon2-v0-emb.json'), False)}}

# ---- agreement fixture: raw positions from the dataset + Python float64 logits -------------------------
pick = np.sort(np.random.default_rng(7).choice(test_idx, 24, replace=False))
full64 = Pory2(True).double(); full64.load_state_dict({k: v.double() for k, v in full.state_dict().items()}); full64.eval()
emb64 = Pory2(False).double(); emb64.load_state_dict({k: v.double() for k, v in emb.state_dict().items()}); emb64.eval()
Dp = load(pick)
with torch.no_grad():
    lf = full64(Dp).numpy(); le = emb64(Dp).numpy()
want = {}
for k, i in enumerate(pick): want.setdefault(int(game[i]), []).append((int(turn[i]), k))
fx = []
with open(os.path.join(args.human, 'games.jsonl'), encoding='utf8') as f:
    for gi, line in enumerate(f):
        if gi in want:
            row = json.loads(line)
            for tn_, k in want[gi]:
                t = next(t for t in row['turns'] if t['n'] == tn_)
                fx.append({'game_id': row['game']['id'], 'turn': tn_, 'sheets': row['game']['sheets'], 'state': t['state'],
                           'python_logit_full': float(lf[k]), 'python_logit_emb': float(le[k]), 'winner': row['game']['winner']})
        if gi > max(want): break
os.makedirs(os.path.dirname(args.fixture), exist_ok=True)
json.dump({'what': 'PORYGON2 v0 Node/Python agreement: raw public positions, the Python float64 logits of the exported weights',
           'model_sha256': metrics['models'], 'positions': fx}, open(args.fixture, 'w', encoding='utf8'))
metrics['seconds'] = round(time.time() - T0)
json.dump(metrics, open(os.path.join(args.out, 'porygon2-v0.metrics.json'), 'w', encoding='utf8'), indent=1)
print(json.dumps({k: metrics[k] for k in ['positions', 'count_hp_weights', 'val_logloss']}, indent=1))
print(json.dumps(metrics['test'], indent=1))
print('done', metrics['seconds'], 's')
