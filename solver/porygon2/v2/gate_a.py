"""solver/porygon2/v2/gate_a.py -- PORYGON2 v2 gate (a), READ ONCE (solver/porygon2/v2/preregistration.json, gates.a_heldout
and addendum_2026_09_30).

    python solver/porygon2/v2/gate_a.py --model <B/model.pt> --v1-scores <score_v1.js jsonl> --out solver/porygon2/v2/gate-a.json
        [--ablation name=<model.pt> ...] [--boot 2000] [--seed 1]

The ONLY reader of the TEST split. Positions: every turn-start position of every bo3 TEST game with v1_unseen = true that
both v2 and v1 scored, paired on (game id, turn). PASS iff the 95% upper bound (bootstrap over games) of
log-loss(v2) - log-loss(v1) on the pooled positions is < 0 AND the point estimate is <= 0 in every min-rating band
(<1100, 1100-1199, 1200-1299, >=1300) holding >= 200 eligible games.
"""
import argparse, ctypes, hashlib, json, os, sys, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='solver/out/porygon2-v2')
ap.add_argument('--model', required=True)
ap.add_argument('--v1-scores', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--ablation', action='append', default=[])
ap.add_argument('--boot', type=int, default=2000)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--threads', type=int, default=4)
ap.add_argument('--min-band-games', type=int, default=200)
args = ap.parse_args()
if os.name == 'nt':
    try: ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
    except Exception as e: print('could not lower priority:', e)
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import net as NT
torch.set_num_threads(args.threads)
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
rng = np.random.default_rng(args.seed)
BANDS_GATE = ['<1100', '1100-1199', '1200-1299', '>=1300']
def gate_band(b): return '>=1300' if b in ('1300-1399', '1400-1499', '1500-1599', '>=1600') else b


def load(p):
    ck = torch.load(p, map_location='cpu', weights_only=False)
    m = NT.Net(ck['vocab'], ck['TN'], ck['SN'], ck['FN'], ck['KN'], drop=0.0); m.load_state_dict(ck['state']); m.eval()
    return m, ck


def scores(model, ck, D, games, no_rating=False, aux=False, bs=4096):
    for s in D.shards: s.remap_to(ck['vocab'])
    sh, rw = D.rows_of(games, 0, rng)
    out, Y, TURN, GI, AUX = [], [], [], [], []
    gidx = np.concatenate([np.full(D.g_n[g], g) for g in games]) if len(games) else np.zeros(0, int)
    with torch.no_grad():
        for i in range(0, len(sh), bs):
            B, lab = D.batch(sh[i:i + bs], rw[i:i + bs], no_rating)
            if aux:
                lg, A = model(B, aux=True); _, parts = NT.aux_loss(A, lab); AUX.append((len(lab['z']), parts))
            else: lg = model(B)
            out.append(lg.double().numpy()); Y.append(lab['z']); TURN.append(lab['turn'])
    auxm = None
    if aux and AUX:
        n = sum(a for a, _ in AUX); auxm = {k: sum(a * p[k] for a, p in AUX) / n for k in AUX[0][1]}
    return np.concatenate(out), np.concatenate(Y), np.concatenate(TURN), gidx, auxm


def clustered(vals, games_of_row, boot_rng, mask=None):
    m = np.ones(len(vals), bool) if mask is None else mask
    if not m.any(): return None
    ug, inv = np.unique(games_of_row[m], return_inverse=True)
    num = np.bincount(inv, weights=vals[m], minlength=len(ug)); den = np.bincount(inv, minlength=len(ug)).astype(np.float64)
    W = boot_rng.multinomial(len(ug), np.full(len(ug), 1 / len(ug)), size=args.boot).astype(np.float64)
    bs = (W @ num) / np.maximum(W @ den, 1e-12)
    lo, hi = np.percentile(bs, [2.5, 97.5])
    return {'mean': round(float(num.sum() / den.sum()), 6), 'ci95': [round(float(lo), 6), round(float(hi), 6)], 'positions': int(m.sum()), 'games': int(len(ug))}


def calib(p, y):
    bins = np.clip((p * 10).astype(int), 0, 9); rows = []
    for k in range(10):
        m = bins == k
        if m.any(): rows.append({'bin': k, 'n': int(m.sum()), 'pred': round(float(p[m].mean()), 4), 'won': round(float(y[m].mean()), 4)})
    ece = sum(r['n'] * abs(r['pred'] - r['won']) for r in rows) / max(1, sum(r['n'] for r in rows))
    return {'ece': round(float(ece), 5), 'bins': rows}


bo3 = NT.Data(args.data, 'bo3'); bo1 = NT.Data(args.data, 'bo1')
model, ck = load(args.model)
log('model', args.model, 'sha256', sha(args.model), 'flags', ck['flags'])

# ---------------------------------------------------------------- eligible bo3 test games, and v1's scores
elig = np.array([g for g in range(len(bo3.games)) if bo3.g_split[g] == 2 and bo3.games[g][3].get('v1_unseen') is True])
V1 = {}
for line in open(args.v1_scores, encoding='utf8'):
    if line.strip():
        o = json.loads(line); V1[(o['id'], int(o['turn']))] = o
v1meta = json.load(open(args.v1_scores + '.meta.json', encoding='utf8'))
lg2, y2, turn2, gi2, aux2 = scores(model, ck, bo3, elig, aux=True)
lg2u, _, _, _, _ = scores(model, ck, bo3, elig, no_rating=True)
ids = np.array([bo3.g_id[g] for g in gi2])
keys = list(zip(ids, turn2.astype(int)))
have = np.array([k in V1 for k in keys])
log(f'eligible games {len(elig)} positions {len(keys)}; paired with v1 {int(have.sum())}')
v1p = np.array([V1[k]['v1'] if h else np.nan for k, h in zip(keys, have)]); g5p = np.array([V1[k]['gen5'] if h else np.nan for k, h in zip(keys, have)])
zchk = np.array([V1[k]['z'] if h else np.nan for k, h in zip(keys, have)])
m = have & (y2 != 0.5)
mism = int(((zchk != y2) & m).sum())
if mism: raise SystemExit(f'{mism} paired positions disagree on the outcome between v2 and v1 data: the pairing is wrong')
lg2, lg2u, y, turn, gi = lg2[m], lg2u[m], y2[m], turn2[m], gi2[m]
cl = lambda p: np.clip(p, 1e-6, 1 - 1e-6)
lg1 = np.log(cl(v1p[m])) - np.log1p(-cl(v1p[m])); lg5 = np.log(cl(g5p[m])) - np.log1p(-cl(g5p[m]))
p2, p1v, p5 = 1 / (1 + np.exp(-lg2)), cl(v1p[m]), cl(g5p[m])
LL2, LL1, LL5, LL2u = NT.ll(lg2, y), NT.ll(lg1, y), NT.ll(lg5, y), NT.ll(lg2u, y)
BR2, BR1, BR5 = (p2 - y) ** 2, (p1v - y) ** 2, (p5 - y) ** 2

# count-HP logistic on bo3 TRAIN positions (base features, the material race), for scale
Xs, Ys = [], []
for s in bo3.shards:
    t = s.M[:, s.col['split']] == 0; Xs.append(s.base[t]); Ys.append(s.z[t])
Xb = torch.from_numpy(np.concatenate(Xs).astype(np.float64)); yb = torch.from_numpy(np.concatenate(Ys))
keep = yb != 0.5; Xb, yb = Xb[keep], yb[keep]
wb = torch.zeros(3, dtype=torch.float64, requires_grad=True)
o = torch.optim.LBFGS([wb], max_iter=200, line_search_fn='strong_wolfe')
def clo():
    o.zero_grad(); l = torch.nn.functional.binary_cross_entropy_with_logits(Xb @ wb[:2] + wb[2], yb); l.backward(); return l
o.step(clo)
sh, rw = bo3.rows_of(elig, 0, rng)
baseE = np.concatenate([bo3.shards[s].base[r][None] for s, r in zip(sh, rw)])[m]
lgc = baseE @ wb.detach().numpy()[:2] + float(wb[2]); LLc = NT.ll(lgc, y)

band_of_game = {g: gate_band(bo3.games[g][3]['band_min']) for g in elig}
bandrow = np.array([band_of_game[g] for g in gi])
B = lambda seed: np.random.default_rng(seed)
res = {'what': 'PORYGON2 v2 gate (a): held-out bo3 TEST positions from v1-unseen games, paired against v1 on (game id, turn)', 'read_once': True,
       'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'model': {'path': args.model.replace('\\', '/'), 'sha256': sha(args.model), 'flags': ck['flags']},
       'v1': v1meta['v1'], 'gen5': v1meta['gen5'], 'v1_scores': {'path': args.v1_scores.replace('\\', '/'), 'sha256': sha(args.v1_scores), 'counts': v1meta['counts']},
       'release': ck['release'], 'bo3_input_sha256': bo3.input_sha256, 'boot': args.boot, 'seed': args.seed,
       'coverage': {'eligible_games': int(len(elig)), 'eligible_positions': int(len(keys)), 'paired_positions': int(m.sum()), 'paired_games': int(len(np.unique(gi))),
                    'unpaired_positions': int((~have).sum()), 'tie_positions_dropped': int((have & (y2 == 0.5)).sum())}}
res['pooled'] = {
    'v2_logloss': clustered(LL2, gi, B(1)), 'v1_logloss': clustered(LL1, gi, B(1)), 'gen5_logloss': clustered(LL5, gi, B(1)), 'count_hp_logloss': clustered(LLc, gi, B(1)),
    'v2_minus_v1_logloss': clustered(LL2 - LL1, gi, B(1)), 'v2_minus_gen5_logloss': clustered(LL2 - LL5, gi, B(1)),
    'v2_brier': clustered(BR2, gi, B(1)), 'v1_brier': clustered(BR1, gi, B(1)), 'gen5_brier': clustered(BR5, gi, B(1)), 'v2_minus_v1_brier': clustered(BR2 - BR1, gi, B(1)),
    'v2_unrated_inputs_logloss': clustered(LL2u, gi, B(1)), 'v2_unrated_inputs_minus_v1_logloss': clustered(LL2u - LL1, gi, B(1))}
res['by_band'] = {}
for b in BANDS_GATE + ['unrated']:
    mk = bandrow == b
    ng = int(len(np.unique(gi[mk])))
    res['by_band'][b] = {'games': ng, 'gates': b in BANDS_GATE and ng >= args.min_band_games,
                         'v2_minus_v1_logloss': clustered(LL2 - LL1, gi, B(1), mk), 'v2_logloss': clustered(LL2, gi, B(1), mk), 'v1_logloss': clustered(LL1, gi, B(1), mk),
                         'gen5_logloss': clustered(LL5, gi, B(1), mk), 'v2_minus_v1_brier': clustered(BR2 - BR1, gi, B(1), mk)}
t13 = turn <= 3
res['turns_1_3'] = {'v2_minus_v1_logloss': clustered(LL2 - LL1, gi, B(1), t13), 'v2_logloss': clustered(LL2, gi, B(1), t13), 'v1_logloss': clustered(LL1, gi, B(1), t13)}
res['turns_4_plus'] = {'v2_minus_v1_logloss': clustered(LL2 - LL1, gi, B(1), ~t13)}
res['calibration'] = {'v2': calib(p2, y), 'v1': calib(p1v, y), 'gen5': calib(p5, y)}
res['aux_losses_eligible'] = aux2

# ---------------------------------------------------------------- the verdict, by the pre-registered rule
pooled = res['pooled']['v2_minus_v1_logloss']
bands_ok = all(r['v2_minus_v1_logloss']['mean'] <= 0 for b, r in res['by_band'].items() if r['gates'])
res['verdict'] = {'rule': 'PASS iff pooled 95% upper bound of logloss(v2) - logloss(v1) < 0 AND point estimate <= 0 in every gating band (>= 200 games)',
                  'pooled_upper': pooled['ci95'][1], 'pooled_ok': pooled['ci95'][1] < 0, 'gating_bands': [b for b, r in res['by_band'].items() if r['gates']],
                  'bands_ok': bands_ok, 'PASS': bool(pooled['ci95'][1] < 0 and bands_ok)}

# ---------------------------------------------------------------- bo1 TEST by band, v2 alone (diagnostic; v1 cannot read a closed sheet)
t1 = np.array([g for g in range(len(bo1.games)) if bo1.g_split[g] == 2])
lgb, yb1, tb1, gib, _ = scores(model, ck, bo1, t1)
mm = yb1 != 0.5; lgb, yb1, gib = lgb[mm], yb1[mm], gib[mm]
LLb = NT.ll(lgb, yb1)
bb = np.array([bo1.games[g][3]['band_min'] for g in gib])
rat = np.array([[np.nan if bo1.games[g][3]['rating']['p1'] is None else bo1.games[g][3]['rating']['p1'], np.nan if bo1.games[g][3]['rating']['p2'] is None else bo1.games[g][3]['rating']['p2']] for g in gib])
lo = np.nanmin(np.where(np.isnan(rat), np.inf, rat), 1)
res['bo1_test_v2'] = {'pooled': clustered(LLb, gib, B(2)), 'by_band': {b: clustered(LLb, gib, B(2), bb == b) for b in sorted(set(bb))},
                      'both_at_least_1500': clustered(LLb, gib, B(2), lo >= 1500), 'both_at_least_1600': clustered(LLb, gib, B(2), lo >= 1600),
                      'calibration': calib(1 / (1 + np.exp(-lgb)), yb1)}

# ---------------------------------------------------------------- ablations, same positions, reported only
res['ablations'] = {}
for a in args.ablation:
    name, p = a.split('=', 1)
    ma, cka = load(p)
    lga, ya, ta, ga, _ = scores(ma, cka, bo3, elig)
    lga = lga[m]
    res['ablations'][name] = {'model': {'path': p.replace('\\', '/'), 'sha256': sha(p)}, 'logloss': clustered(NT.ll(lga, y), gi, B(1)),
                              'minus_v1_logloss': clustered(NT.ll(lga, y) - LL1, gi, B(1)), 'minus_v2_logloss': clustered(NT.ll(lga, y) - LL2, gi, B(1))}
res['seconds'] = round(time.time() - T0)
json.dump(res, open(args.out, 'w', encoding='utf8'), indent=1)
log('pooled v2-v1', pooled, 'verdict', res['verdict'])
