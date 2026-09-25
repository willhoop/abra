"""solver/machamp/train_pory2.py -- MACHAMP: PORYGON2 generation n+1 from generation n, on human data plus self-play.

    python solver/machamp/train_pory2.py --init <porygon2 json> --human <human tensors dir> --selfplay <self-play tensors dir>
        --out <model json> --metrics <metrics json> [--ref solver/porygon2/model/porygon2-v0.json] [--threads 4]
        [--epochs 6] [--lr 5e-4] [--human-ratio 1.0] [--seed 1] [--fixture <json>]

WARM START. The net is loaded from --init (the current champion's PORYGON2, same dims, same vocabulary) and trained
further. The vocabulary is --init's: a human or self-play id string the champion never had maps to <unk> (row 0),
exactly as at inference (solver/porygon2/infer.js), so the exported file keeps the shape the Node forward pass reads.

DATA. Every epoch = every self-play TRAIN position once (target = the blended lambda*v + (1-lambda)*z that
build_pory2.js wrote) + --human-ratio times as many HUMAN train positions (target = the game's outcome), drawn
fresh each epoch. The human rows are MAG/DODUO's player split, both players train (solver/porygon2/train.py's rule).
Loss: binary cross-entropy with soft targets on the antisymmetric logit.

SELECTION (pre-registered in solver/machamp/preregistration.json). After each epoch: human VAL log-loss and self-play
VAL loss. The kept epoch is the one with the lowest self-play val loss among the epochs whose human val log-loss is
within +0.002 of --init's; if none qualifies, the epoch with the lowest human val log-loss (epoch -1 = --init itself
is a candidate, so the loop can return the champion unchanged).

EVALUATION. Held-out HUMAN TEST positions (a test player's view; a game with two test players counts twice), the same
rows for --ref (PORYGON2 v0) and the new net, paired and clustered by game (bootstrap over games) -- the gate is
"new - v0 log-loss, 95% upper bound <= +0.004". Also the self-play val MSE against the search value v (V1's question:
does it know the engine's game?), for the new net, --init, --ref and the count-HP logistic.

The CODE OF THE NET is solver/porygon2/train.py's Pory2 (copied, with the dims read from the model file); the
parity with the Node forward pass is proved by solver/tests/test-machamp.js on --fixture.
"""
import argparse, base64, hashlib, json, os, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--init', required=True)
ap.add_argument('--ref', default='solver/porygon2/model/porygon2-v0.json')
ap.add_argument('--human', required=True)
ap.add_argument('--selfplay', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--metrics', required=True)
ap.add_argument('--fixture', default='')
ap.add_argument('--name', default='PORYGON2 gen')
ap.add_argument('--threads', type=int, default=4)
ap.add_argument('--epochs', type=int, default=6)
ap.add_argument('--lr', type=float, default=5e-4)
ap.add_argument('--wd', type=float, default=1e-4)
ap.add_argument('--human-ratio', type=float, default=1.0)
ap.add_argument('--tol', type=float, default=0.002)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--boot', type=int, default=2000)
args = ap.parse_args()

import torch
import torch.nn as nn
torch.set_num_threads(min(4, args.threads)); torch.set_num_interop_threads(1)
torch.manual_seed(args.seed); np.random.seed(args.seed)
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()


# ------------------------------------------------------------------ the net (solver/porygon2/train.py Pory2, dims from the file)
def decode(w):
    a = np.frombuffer(base64.b64decode(w['f32_b64']), dtype='<f4').reshape(w['shape'])
    return torch.from_numpy(a.copy())


class Pory2(nn.Module):
    def __init__(self, J):
        super().__init__()
        d = J['dims']; nm = J['names']; self.facts_on = J['facts_on']
        TN, SN, FN, KN = len(nm['tok_num']), len(nm['side']), len(nm['field']), len(nm['facts'])
        V = J['vocab']
        self.e_sp = nn.Embedding(len(V['species']), d['sp']); self.e_it = nn.Embedding(len(V['item']), d['it'])
        self.e_ab = nn.Embedding(len(V['ability']), d['ab']); self.e_mv = nn.Embedding(len(V['move']), d['mv'])
        tin = TN + d['sp'] + d['it'] + d['ab'] + d['mv']
        self.t1 = nn.Linear(tin, d['tok']); self.t2 = nn.Linear(d['tok'], d['tok'])
        sv = 3 * d['tok'] + SN
        hin = 2 * sv + FN + (2 * KN if self.facts_on else 0)
        self.h1 = nn.Linear(hin, d['head1']); self.h2 = nn.Linear(d['head1'], d['head2']); self.h3 = nn.Linear(d['head2'], 1)
        self.drop = nn.Dropout(0.1)
        self.load_state_dict({k: decode(w) for k, w in J['weights'].items()})

    def side_vec(self, tn, ti, sd):
        emb = torch.cat([self.e_sp(ti[..., 0]), self.e_it(ti[..., 1]), self.e_ab(ti[..., 2]), self.e_mv(ti[..., 3:7]).mean(-2)], -1)
        h = torch.relu(self.t2(torch.relu(self.t1(torch.cat([tn, emb], -1)))))
        w = tn[..., 1:2]; act = tn[..., 3:4]
        return torch.cat([(w * h).sum(-2) / 4, (h * (w > 0).to(h.dtype)).max(-2).values, (act * h).sum(-2) / 2, sd], -1)

    def g(self, a, b, fd, fa, fb):
        x = torch.cat([a, b, fd] + ([fa, fb] if self.facts_on else []), -1)
        return self.h3(self.drop(torch.relu(self.h2(self.drop(torch.relu(self.h1(x))))))).squeeze(-1)

    def forward(self, B):
        dt = self.h1.weight.dtype
        sv = self.side_vec(B['tn'].to(dt), B['ti'], B['sd'].to(dt))
        fd = B['fd'].to(dt); fc = B['fc'].to(dt)
        return self.g(sv[:, 0], sv[:, 1], fd, fc[:, 0], fc[:, 1]) - self.g(sv[:, 1], sv[:, 0], fd, fc[:, 1], fc[:, 0])


J_init = json.load(open(args.init, encoding='utf8'))
J_ref = json.load(open(args.ref, encoding='utf8'))
assert J_init['dims'] == J_ref['dims'] and J_init['vocab'] == J_ref['vocab'] and J_init['names'] == J_ref['names'], 'init and ref must share dims, names and vocabulary'
VOC = J_init['vocab']
KINDS = ['species', 'item', 'ability', 'move', 'move', 'move', 'move']


# ------------------------------------------------------------------ data (memmapped, ids remapped by STRING into the model's vocabulary)
class Tensors:
    def __init__(self, d, extra=()):
        self.meta = json.load(open(os.path.join(d, 'meta.json'), encoding='utf8'))
        N = self.meta['N']; nm = self.meta['names']
        assert nm['tok_num'] == J_init['names']['tok_num'] and nm['facts'] == J_init['names']['facts'] and nm['side'] == J_init['names']['side'] and nm['field'] == J_init['names']['field'], 'feature layout differs from the model: ' + d
        TN, SN, FN, KN = len(nm['tok_num']), len(nm['side']), len(nm['field']), len(nm['facts'])
        mm = lambda name, dt, shape: np.memmap(os.path.join(d, name), dtype=dt, mode='r', shape=shape)
        self.N = N
        self.tok_num = mm('tok_num.f32', '<f4', (N, 2, 6, TN)); self.tok_id = mm('tok_id.i32', '<i4', (N, 2, 6, 7))
        self.side = mm('side.f32', '<f4', (N, 2, SN)); self.field = mm('field.f32', '<f4', (N, FN))
        self.facts = mm('facts.f32', '<f4', (N, 2, KN)); self.base = mm('base.f32', '<f4', (N, 2))
        self.M = np.array(mm('meta.i32', '<i4', (N, len(nm['meta']))))
        self.col = {c: i for i, c in enumerate(nm['meta'])}
        for e in extra:
            setattr(self, e, np.array(mm(e + '.f32', '<f4', (N,))).astype(np.float64))
        self.remap = {}
        for kind in ['species', 'item', 'ability', 'move']:
            glob = self.meta['vocab'][kind]
            r = np.zeros(len(glob), dtype=np.int64)
            for s, gi in glob.items():
                r[gi] = VOC[kind].get(s, 0)
            self.remap[kind] = r

    def batch(self, idx, y):
        idx = np.sort(idx) if False else idx
        raw = np.asarray(self.tok_id[idx], dtype=np.int64)
        ti = np.empty_like(raw)
        for j, kind in enumerate(KINDS):
            ti[..., j] = self.remap[kind][raw[..., j]]
        return dict(tn=torch.from_numpy(np.asarray(self.tok_num[idx])), ti=torch.from_numpy(ti),
                    sd=torch.from_numpy(np.asarray(self.side[idx])), fd=torch.from_numpy(np.asarray(self.field[idx])),
                    fc=torch.from_numpy(np.asarray(self.facts[idx])), y=torch.from_numpy(np.asarray(y, dtype=np.float32)))


H = Tensors(args.human)
hc = H.col
hy = H.M[:, hc['winner']].astype(np.float64)
s1, s2 = H.M[:, hc['split_p1']], H.M[:, hc['split_p2']]
h_train = np.where((s1 == 0) & (s2 == 0))[0]
h_val = np.where((s1 == 1) | (s2 == 1))[0]; h_val_w = ((s1 == 1).astype(np.float64) + (s2 == 1))[h_val]
h_test = np.where((s1 == 2) | (s2 == 2))[0]; h_test_w = ((s1 == 2).astype(np.float64) + (s2 == 2))[h_test]
SP = Tensors(args.selfplay, extra=('z', 'v', 'target'))
sc = SP.col
sp_val_mask = SP.M[:, sc['split']] == 1
sp_train = np.where(~sp_val_mask)[0]; sp_val = np.where(sp_val_mask)[0]
log(f'human: train {len(h_train)} val {len(h_val)} test {len(h_test)} | self-play: train {len(sp_train)} val {len(sp_val)} (with v: {int((~np.isnan(SP.v)).sum())})')
if H.meta.get('engine_release') != SP.meta.get('engine_release'):
    raise SystemExit(f"human tensors were encoded on release {H.meta.get('engine_release')}, self-play on {SP.meta.get('engine_release')}: refusing to mix engines")


def predict(model, T, idx, bs=4096):
    model.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(idx), bs):
            out.append(model(T.batch(idx[i:i + bs], np.zeros(len(idx[i:i + bs])))).double())
    return torch.cat(out).numpy() if out else np.zeros(0)


def ll(logit, yy):
    return np.logaddexp(0, logit) - yy * logit


def wmean(v, w):
    return float((v * w).sum() / w.sum())


def evaluate_val(model):
    lh = wmean(ll(predict(model, H, h_val), hy[h_val]), h_val_w)
    ls = float(ll(predict(model, SP, sp_val), SP.target[sp_val]).mean()) if len(sp_val) else float('nan')
    return lh, ls


def model_copy(J):
    m = Pory2(J); m.eval(); return m


model = model_copy(J_init)
lh0, ls0 = evaluate_val(model)
log(f'init: human val {lh0:.5f}  self-play val {ls0:.5f}')
history = [{'epoch': -1, 'human_val_logloss': lh0, 'selfplay_val_loss': ls0}]
states = {-1: {k: v.clone() for k, v in model.state_dict().items()}}
opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
lossf = nn.BCEWithLogitsLoss()
rng = np.random.default_rng(args.seed)
BS = 1024
for ep in range(args.epochs):
    model.train(); t = time.time()
    sp_perm = rng.permutation(sp_train)
    nh = int(round(args.human_ratio * len(sp_train)))
    h_pick = rng.choice(h_train, size=min(nh, len(h_train)), replace=False)
    # interleave: each step one self-play batch and one human batch of proportional size
    nsteps = max(1, int(np.ceil(len(sp_perm) / BS)))
    hb = int(np.ceil(len(h_pick) / nsteps))
    tot = 0.0
    for s in range(nsteps):
        a = sp_perm[s * BS:(s + 1) * BS]; b = h_pick[s * hb:(s + 1) * hb]
        opt.zero_grad()
        loss = 0.0
        if len(a):
            B = SP.batch(np.sort(a), SP.target[np.sort(a)]); loss = loss + lossf(model(B), B['y']) * len(a)
        if len(b):
            B = H.batch(np.sort(b), hy[np.sort(b)]); loss = loss + lossf(model(B), B['y']) * len(b)
        loss = loss / max(1, len(a) + len(b))
        loss.backward(); opt.step(); tot += loss.item()
    lh, ls = evaluate_val(model)
    history.append({'epoch': ep, 'train_loss': tot / nsteps, 'human_val_logloss': lh, 'selfplay_val_loss': ls, 'seconds': time.time() - t})
    states[ep] = {k: v.clone() for k, v in model.state_dict().items()}
    log(f'epoch {ep}: train {tot / nsteps:.5f}  human val {lh:.5f}  self-play val {ls:.5f}  {time.time() - t:.0f}s')

ok = [h for h in history if h['human_val_logloss'] <= lh0 + args.tol]
pick = min(ok, key=lambda h: h['selfplay_val_loss']) if ok else min(history, key=lambda h: h['human_val_logloss'])
log('selected epoch', pick['epoch'], '(-1 = the init net unchanged)')
model.load_state_dict(states[pick['epoch']]); model.eval()

# ------------------------------------------------------------------ evaluation: human TEST, paired vs --ref and --init, clustered by game
ref = model_copy(J_ref); init = model_copy(J_init)
yt = hy[h_test]; gt = H.M[h_test, hc['game']]; tt = H.M[h_test, hc['turn']]
L = {'new': predict(model, H, h_test), 'ref_v0': predict(ref, H, h_test), 'init': predict(init, H, h_test)}
ug, ginv = np.unique(gt, return_inverse=True)
BOOT = np.random.default_rng(12345).multinomial(len(ug), np.full(len(ug), 1 / len(ug)), size=args.boot).astype(np.float64)


def clustered(vals, mask=None):
    w = h_test_w if mask is None else h_test_w * mask
    num = np.bincount(ginv, weights=vals * w, minlength=len(ug)); den = np.bincount(ginv, weights=w, minlength=len(ug))
    bs = (BOOT @ num) / np.maximum(BOOT @ den, 1e-12)
    lo, hi = np.percentile(bs, [2.5, 97.5])
    return {'mean': round(float(num.sum() / den.sum()), 6), 'ci95': [round(float(lo), 6), round(float(hi), 6)], 'n_views': float(w.sum()), 'n_games': int((den > 0).sum())}


LL = {k: ll(v, yt) for k, v in L.items()}
BR = {k: (1 / (1 + np.exp(-v)) - yt) ** 2 for k, v in L.items()}
BUCKETS = [('1', 1, 1), ('2', 2, 2), ('3', 3, 3), ('4-5', 4, 5), ('6-8', 6, 8), ('9+', 9, 999)]
test = {k: {'logloss': clustered(LL[k]), 'brier': clustered(BR[k])} for k in L}
test['paired'] = {'new_minus_ref_v0': {'logloss': clustered(LL['new'] - LL['ref_v0']), 'brier': clustered(BR['new'] - BR['ref_v0'])},
                  'new_minus_init': {'logloss': clustered(LL['new'] - LL['init']), 'brier': clustered(BR['new'] - BR['init'])}}
by_turn = {b: {'new_minus_ref_v0_logloss': clustered(LL['new'] - LL['ref_v0'], ((tt >= lo) & (tt <= hi)).astype(np.float64))} for b, lo, hi in BUCKETS}

# V1's question on self-play VAL positions that carry a search value: MSE of P(p1 wins) against v
vmask = sp_val[~np.isnan(SP.v[sp_val])]
v1 = {}
if len(vmask):
    vt = SP.v[vmask]
    for k, m in (('new', model), ('init', init), ('ref_v0', ref)):
        p = 1 / (1 + np.exp(-predict(m, SP, vmask)))
        v1[k] = round(float(((p - vt) ** 2).mean()), 6)
    # count-HP logistic, refitted on the self-play TRAIN positions with a v (the baseline the V1 rung names)
    trv = sp_train[~np.isnan(SP.v[sp_train])]
    Xb = torch.from_numpy(np.asarray(SP.base[trv], dtype=np.float64)); yb = torch.from_numpy(SP.v[trv])
    wb = torch.zeros(2, dtype=torch.float64, requires_grad=True)
    o = torch.optim.LBFGS([wb], max_iter=200, line_search_fn='strong_wolfe')
    def clo():
        o.zero_grad(); l = nn.functional.binary_cross_entropy_with_logits(Xb @ wb, yb); l.backward(); return l
    o.step(clo)
    pb = torch.sigmoid(torch.from_numpy(np.asarray(SP.base[vmask], dtype=np.float64)) @ wb).detach().numpy()
    v1['count_hp'] = round(float(((pb - vt) ** 2).mean()), 6)
    v1['n_positions'] = int(len(vmask))

# ------------------------------------------------------------------ export (the v0 file format: solver/porygon2/infer.js reads it)
def b64(t):
    return base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode('ascii')


Jn = {k: J_init[k] for k in ('feature_version', 'facts_on', 'dims', 'names', 'vocab')}
Jn.update({'model': args.name, 'status': 'Reg M-C, frozen release ' + str(SP.meta.get('engine_release')) + ' (post-gate)',
           'weights': {k: {'shape': list(v.shape), 'f32_b64': b64(v)} for k, v in model.state_dict().items()},
           'init': {'path': args.init.replace('\\', '/'), 'sha256': sha(args.init)},
           'dataset_sha256': J_init.get('dataset_sha256'), 'engine_release': SP.meta.get('engine_release'),
           'selfplay_sources': SP.meta['sources'], 'trained': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'torch': torch.__version__,
           'forward': J_init.get('forward')})
s = json.dumps(Jn, separators=(',', ':'))
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
open(args.out, 'w', encoding='utf8').write(s)
out_sha = hashlib.sha256(s.encode('utf8')).hexdigest()

gate = test['paired']['new_minus_ref_v0']['logloss']
metrics = {'model': args.name, 'out': {'path': args.out.replace('\\', '/'), 'sha256': out_sha},
           'init': {'path': args.init.replace('\\', '/'), 'sha256': sha(args.init)}, 'ref': {'path': args.ref.replace('\\', '/'), 'sha256': sha(args.ref)},
           'engine_release': SP.meta.get('engine_release'), 'human_tensors': {'dir': args.human, 'dataset': H.meta.get('dataset'), 'engine_release': H.meta.get('engine_release')},
           'selfplay_tensors': {'dir': args.selfplay, 'counts': SP.meta['counts'], 'lambda': SP.meta['lambda'], 'sources': SP.meta['sources']},
           'positions': {'human_train': int(len(h_train)), 'human_val': int(len(h_val)), 'human_test': int(len(h_test)), 'human_test_views': float(h_test_w.sum()),
                         'selfplay_train': int(len(sp_train)), 'selfplay_val': int(len(sp_val))},
           'flags': vars(args), 'history': history, 'selected_epoch': pick['epoch'],
           'test': test, 'by_turn': by_turn, 'v1_selfplay_val_mse_vs_search_value': v1,
           'gate_nonworse_vs_v0': {'rule': 'PASS iff the 95% upper bound of (new - v0) held-out human log-loss <= +0.004 (the v0 split-half floor)',
                                   'diff': gate['mean'], 'ci95': gate['ci95'], 'pass': bool(gate['ci95'][1] <= 0.004)},
           'seconds': round(time.time() - T0)}
json.dump(metrics, open(args.metrics, 'w', encoding='utf8'), indent=1)
log('test log-loss new', test['new']['logloss']['mean'], 'v0', test['ref_v0']['logloss']['mean'], 'diff', gate['mean'], gate['ci95'], 'PASS' if metrics['gate_nonworse_vs_v0']['pass'] else 'FAIL')
log('V1 self-play val MSE vs search value', v1)

# ------------------------------------------------------------------ parity fixture: self-play val positions + float64 logits of the EXPORTED weights
def raw_x(i):
    # the encoded position exactly as features.js encode() wrote it (id STRINGS, not the model's rows)
    inv = {k: {v: s for s, v in SP.meta['vocab'][k].items()} for k in SP.meta['vocab']}
    tid = np.asarray(SP.tok_id[i])
    sides = ['p1', 'p2']
    return {'tokNum': {sd: np.asarray(SP.tok_num[i][k]).astype(float).tolist() for k, sd in enumerate(sides)},
            'tokId': {sd: [[inv[KINDS[j]][int(tid[k, t, j])] for j in range(7)] for t in range(6)] for k, sd in enumerate(sides)},
            'side': {sd: np.asarray(SP.side[i][k]).astype(float).tolist() for k, sd in enumerate(sides)},
            'field': np.asarray(SP.field[i]).astype(float).tolist(),
            'facts': {sd: np.asarray(SP.facts[i][k]).astype(float).tolist() for k, sd in enumerate(sides)}}


if args.fixture:
    m64 = Pory2(json.loads(s)).double(); m64.eval()
    pickp = np.sort(np.random.default_rng(7).choice(sp_val if len(sp_val) else sp_train, 16, replace=False))
    with torch.no_grad():
        lf = m64(SP.batch(pickp, np.zeros(len(pickp)))).numpy()
    json.dump({'what': 'MACHAMP PORYGON2 Node/Python agreement: self-play positions (build_pory2.js row index) and the float64 logits of the exported weights',
               'model': {'path': args.out.replace('\\', '/'), 'sha256': out_sha}, 'selfplay_tensors': args.selfplay,
               'rows': [int(i) for i in pickp], 'game': [int(SP.M[i, sc['game']]) for i in pickp], 'turn': [int(SP.M[i, sc['turn']]) for i in pickp],
               'x': [raw_x(i) for i in pickp], 'python_logit': [float(x) for x in lf]}, open(args.fixture, 'w', encoding='utf8'))
    log('fixture', args.fixture)
