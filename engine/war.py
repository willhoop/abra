#!/usr/bin/env python3
"""war.py — WAR for Pokemon (Wins Above Replacement), the honest way.

The sports method this borrows
------------------------------
Baseball's WAR asks: how many wins does this player add over a freely-available "replacement-level"
player? You cannot read that off a box score because teammates and schedule confound it. Basketball
solves the same confound with Regularized Adjusted Plus-Minus (RAPM): a ridge-regularized regression
of outcome on who-was-on-the-floor, which isolates each player's marginal effect while controlling
for everyone else on both sides. We do exactly that here.

Model
-----
One row per game (leak-free — team-preview six only, not in-game choices):
    y = 1 if p1 won
    x_s = [species s on p1's six] - [species s on p2's six]   in {-1, 0, +1}
Ridge logistic regression -> beta_s = species s's adjusted win contribution, holding teammates and
opponents fixed. Ridge (L2) shrinks rare species toward 0 so a 3-game fluke can't post a huge WAR.

Replacement level and the wins conversion
-----------------------------------------
Replacement beta = the 20th-percentile beta among qualified species (a below-average, freely-available
mon). Near p=0.5 the logistic slope is 1/4, so one unit of beta is ~0.25 win-probability. Thus
    WAR_s = 0.25 * (beta_s - beta_replacement) * (games s appeared on a six).
WAR is reported ONLY with the model's held-out log-loss beside it: if preview composition barely beats
a coin (it does, barely), WAR magnitudes are small and uncertain — stated plainly, not hidden.

Pure standard library. Deterministic. Read-only on the store.
    python3 engine/war.py
"""
import json, os, math, random
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
STORE = D("data", "games.ladder.jsonl")
LN2 = math.log(2)
MIN_GAMES = 30          # a species must appear on >= this many sixes to get a WAR
RIDGE = 6.0             # L2 strength — strong, because most species are rare (honest shrinkage)

def load_games():
    with open(STORE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: yield json.loads(line)
            except Exception: continue

def build():
    games = [g for g in load_games() if g.get("winner") in
             (g.get("p1",{}).get("name"), g.get("p2",{}).get("name"))]
    appear = Counter()
    for g in games:
        for s in set(g.get("six",{}).get("p1",[])) | set(g.get("six",{}).get("p2",[])):
            appear[s] += 1
    species = sorted([s for s, c in appear.items() if c >= MIN_GAMES])
    idx = {s: i for i, s in enumerate(species)}
    K = len(species)

    # rows: (id, sparse feature dict {i:+/-1}, y)
    rows = []
    for g in games:
        p1n = g["p1"]["name"]
        y = 1 if g["winner"] == p1n else 0
        s1 = set(g.get("six",{}).get("p1",[])); s2 = set(g.get("six",{}).get("p2",[]))
        feat = {}
        for s in s1:
            if s in idx: feat[idx[s]] = feat.get(idx[s],0) + 1
        for s in s2:
            if s in idx: feat[idx[s]] = feat.get(idx[s],0) - 1
        rows.append((g["id"], feat, y))

    def split(idkey):
        h = 0
        for ch in idkey: h = (h*131 + ord(ch)) & 0xffffffff
        return h % 5 == 0     # True => test (20%)
    train = [r for r in rows if not split(r[0])]
    test  = [r for r in rows if split(r[0])]

    # ridge logistic via gradient descent (sparse)
    w = [0.0]*K; b = 0.0
    N = len(train); lr = 0.3; iters = 300
    for _ in range(iters):
        gw = defaultdict(float); gb = 0.0
        for _id, feat, y in train:
            z = b + sum(w[i]*v for i, v in feat.items())
            p = 1/(1+math.exp(-z)); e = p - y
            for i, v in feat.items(): gw[i] += e*v
            gb += e
        for i in range(K):
            w[i] -= lr*((gw.get(i,0.0))/N + RIDGE*w[i]/N)
        b -= lr*gb/N

    def pred(feat): return 1/(1+math.exp(-(b + sum(w[i]*v for i, v in feat.items()))))
    def logloss(data):
        s = 0.0
        for _id, feat, y in data:
            p = min(1-1e-12, max(1e-12, pred(feat)))
            s += -(y*math.log(p)+(1-y)*math.log(1-p))
        return s/len(data)
    ll = logloss(test); acc = sum(1 for r in test if (pred(r[1])>=.5)==(r[2]==1))/len(test)

    betas = sorted(w)
    repl = betas[int(0.20*len(betas))]          # 20th-percentile beta = replacement level
    war = []
    for s in species:
        bs = w[idx[s]]
        wr = 0.25*(bs - repl)*appear[s]
        war.append(dict(species=s, games=appear[s], beta=round(bs,4),
                        war=round(wr,2), war_per_game=round(0.25*(bs-repl),4)))
    war.sort(key=lambda d: -d["war"])

    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        n_games=len(games), n_species=K, min_games=MIN_GAMES, ridge=RIDGE,
        replacement_beta=round(repl,4),
        method=("Ridge-regularized adjusted plus-minus (RAPM) logistic on team-preview species "
                "indicators; WAR = 0.25*(beta - replacement_beta)*games. Leak-free (preview only)."),
        held_out=dict(log_loss=round(ll,4), coin=round(LN2,4), accuracy=round(acc,4)),
        caveat=("Preview composition barely separates from a coin, so WAR magnitudes are small and "
                "uncertain; ridge shrinks rare species toward zero. Treat as exploratory ordering, "
                "not settled wins. It sharpens as more games arrive."),
        leaders=war[:30], trailers=war[-15:],
    )
    json.dump(out, open(D("data","war.json"),"w"), indent=1)

    print(f"war.py — {len(games)} games, {K} species (>= {MIN_GAMES} appearances)")
    print(f"  held-out log-loss {ll:.4f} vs coin {LN2:.4f}  acc={acc:.3f}  (replacement beta {repl:+.3f})")
    print("  WAR leaders:", ", ".join(f"{d['species']} {d['war']}" for d in war[:8]))
    print("  WAR trailers:", ", ".join(f"{d['species']} {d['war']}" for d in war[-5:]))
    return out

if __name__ == "__main__":
    build()
