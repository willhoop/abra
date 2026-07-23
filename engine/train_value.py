#!/usr/bin/env python3
"""ABRA · train_value.py — the LEARNING core of the flywheel.

This is the first genuinely *learned* in-battle component: a value function
V(state) -> P(you win from here), trained on real game trajectories. It is the
leaf evaluator SLOWKING needs (so depth-limited search doesn't have to roll all
the way to the end) and, crucially, it is the thing that turns "a solver" into a
"learning system": self-play produces trajectories -> we train V on them -> V makes
search stronger -> stronger self-play -> better trajectories -> retrain V ... (the
flywheel). Today it trains on stored ladder games; point it at self-play output to
spin the wheel.

We reconstruct per-turn board state from the stored events (each move carries dmg%
and ko), featurize it from p1's perspective, and regress the eventual game outcome.

  run:  python engine/train_value.py            [data/games.ladder.jsonl ...]
"""
import sys, os, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
idn = lambda s: ''.join(c for c in (s or '').lower() if c.isalnum())

def side_of(mon, p1set, p2set, actor_side):
    m = idn(mon)
    inp1, inp2 = m in p1set, m in p2set
    if inp1 and not inp2: return 'p1'
    if inp2 and not inp1: return 'p2'
    if inp1 and inp2:     return 'p2' if actor_side == 'p1' else 'p1'  # mirror: assume foe target
    return None

def trajectory(g):
    """Yield (features, y) for each mid-game state of game g, p1 perspective."""
    six1 = set(idn(x) for x in (g.get('brought', {}).get('p1') or g['six']['p1']))
    six2 = set(idn(x) for x in (g.get('brought', {}).get('p2') or g['six']['p2']))
    if not six1 or not six2: return
    hp = {'p1': {m: 100.0 for m in six1}, 'p2': {m: 100.0 for m in six2}}
    y = 1 if idn(g['winner']) == idn(g['p1']['name']) else 0
    turns = g.get('turns') or []
    T = len(turns)
    for ti, tn in enumerate(turns):
        for ev in (tn.get('ev') or []):
            t = ev.get('t'); actor = (ev.get('s') or '')[:2]
            if t == 'm':
                tgt = ev.get('tgt'); dmg = ev.get('dmg') or 0; ko = ev.get('ko')
                sd = side_of(tgt, six1, six2, actor) if tgt else None
                if sd and idn(tgt) in hp[sd]:
                    hp[sd][idn(tgt)] = max(0.0, hp[sd][idn(tgt)] - dmg)
                    if ko: hp[sd][idn(tgt)] = 0.0
            elif t == 'f':
                mon = idn(ev.get('mon') or ''); sd = actor
                if sd in hp and mon in hp[sd]: hp[sd][mon] = 0.0
        # snapshot AFTER this turn (skip the very last, it's ~decided)
        if ti >= T - 1: break
        a1 = sum(1 for v in hp['p1'].values() if v > 0); a2 = sum(1 for v in hp['p2'].values() if v > 0)
        h1 = sum(hp['p1'].values()) / 100.0; h2 = sum(hp['p2'].values()) / 100.0
        feats = [a1 - a2, h1 - h2, a1, a2, (ti + 1) / 10.0, 1.0]  # last is bias
        yield feats, y

def load_games(paths):
    seen = set(); games = []
    for p in paths:
        if not os.path.exists(p): continue
        for line in open(p, encoding='utf-8'):
            if not line.strip(): continue
            g = json.loads(line); gid = g.get('id')
            if gid in seen or not g.get('winner'): continue
            seen.add(gid)
            if g['p1'].get('bot') or g['p2'].get('bot'): continue
            if not (g.get('turns')): continue
            games.append(g)
    games.sort(key=lambda g: g.get('date', ''))
    return games

def fit_logistic(X, Y, l2=1.0, iters=4000, lr=0.1):
    w = np.zeros(X.shape[1]); n = len(Y)
    for _ in range(iters):
        p = 1 / (1 + np.exp(-(X @ w)))
        w -= lr * (X.T @ (p - Y) / n + l2 * w / n)
    return w

def metrics(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return (np.mean((p >= 0.5) == y),
            np.mean((p - y) ** 2),
            -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))

def main():
    paths = sys.argv[1:] or [os.path.join(HERE, '../data/games.ladder.jsonl'),
                             os.path.join(HERE, '../data/games.selfplay.jsonl')]
    games = load_games(paths)
    cut = int(len(games) * 0.8); tr, te = games[:cut], games[cut:]
    def build(gs):
        X, Y = [], []
        for g in gs:
            for f, y in trajectory(g): X.append(f); Y.append(y)
        return np.array(X, float), np.array(Y, float)
    Xtr, Ytr = build(tr); Xte, Yte = build(te)
    # normalize non-bias features (helps GD)
    mu = Xtr[:, :-1].mean(0); sd = Xtr[:, :-1].std(0) + 1e-9
    Xtr[:, :-1] = (Xtr[:, :-1] - mu) / sd; Xte[:, :-1] = (Xte[:, :-1] - mu) / sd
    w = fit_logistic(Xtr, Ytr)
    pte = 1 / (1 + np.exp(-(Xte @ w)))
    # baselines on the same states
    p_coin = np.full(len(Yte), 0.5)
    aliveDiff_raw = Xte[:, 0] * sd[0] + mu[0]
    p_alive = np.clip(0.5 + 0.15 * aliveDiff_raw, .02, .98)  # "more mons alive ~ winning" heuristic
    a_v, b_v, ll_v = metrics(pte, Yte)
    print(f"in-battle VALUE FUNCTION V(state) -> P(win)   ({len(games)} games, {len(Ytr)} train states, {len(Yte)} test states)")
    print(f"{'model':<34}{'acc':>7}{'Brier':>9}{'log-loss':>10}")
    for name, p in [('coin (0.5)', p_coin), ('alive-count heuristic', p_alive), ('LEARNED value net', pte)]:
        a, b, l = metrics(p, Yte)
        print(f"{name:<34}{a:>7.3f}{b:>9.3f}{l:>10.3f}")
    # calibration
    print("\ncalibration of the learned value net:")
    for lo in np.arange(0, 1, 0.2):
        m = (pte >= lo) & (pte < lo + 0.2)
        if m.sum(): print(f"  [{lo:.1f},{lo+0.2:.1f})  n={int(m.sum()):>5}  mean pred {pte[m].mean():.2f}  obs {Yte[m].mean():.2f}")
    print(f"\nlearned weights (aliveDiff, hpDiff, p1_alive, p2_alive, turn, bias):\n  {np.round(w,2)}")
    print("\nContrast with JOLTEON (pre-game, log-loss ~0.69 ~ a coin): a mid-battle state is")
    print("massively more predictive than a team sheet. THIS is the object SLOWKING searches with,")
    print("and the object self-play will keep improving. Point this at games.selfplay.jsonl to spin the flywheel.")
    json.dump({'w': [float(x) for x in w], 'mu': [float(x) for x in mu], 'sd': [float(x) for x in sd],
               'test_logloss': float(ll_v), 'test_brier': float(b_v)},
              open(os.path.join(HERE, '../data/value-net.json'), 'w'), indent=2)
    print("\nsaved -> data/value-net.json")

if __name__ == '__main__':
    main()
