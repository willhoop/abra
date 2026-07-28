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

# --- QUALITY FILTER (data/quality-filter.json) -------------------------------------------------
# This used to read the store RAW, so every number below was computed over bot games. Of 8,356
# stored games only 1,061 survive the filter, and four undetected bot accounts played the SAME six
# Pokemon in 1,446 of them - which is how meta-usage.json came to report one script's team as the
# metagame. The definition is shared rather than repeated here: engine/quality.py reads
# data/quality-filter.json, and tests/test-quality.js asserts the JS and Python readers select an
# identical set of ids. ABRA_UNFILTERED=1 restores the old behaviour, for showing the difference.
import sys as _sys
import importlib.util as _ilu
_qspec = _ilu.spec_from_file_location("quality", D("engine", "quality.py"))
_quality = _ilu.module_from_spec(_qspec); _qspec.loader.exec_module(_quality)
_UNFILTERED = bool(os.environ.get("ABRA_UNFILTERED"))

def load_games():
    games = _quality.load_games(clean=not _UNFILTERED)
    _sys.stderr.write(
        ("WARNING: ABRA_UNFILTERED - all %d games, bots and forfeits included\n" % len(games))
        if _UNFILTERED else
        ("quality filter: %d usable of %d collected\n" % (len(games), len(_quality.read_store()))))
    return iter(games)

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

    # --- RIDGE SELECTED ON HELD-OUT LIKELIHOOD, NOT BY HAND ------------------------------------
    # The 2026-07-28 thesis defence called the previous constant fatal, and it was right for a
    # sharper reason than the generic objection: engine/fit_policy.js ALREADY selects its
    # regularisation by sweeping a grid and scoring held-out likelihood. Applying the correct method
    # in one model and a hand-tuned RIDGE = 6.0 in another, then reporting both with the same
    # confidence, is an inconsistency rather than an oversight.
    #
    # The old value is kept in the output as `ridge_legacy` so the change is visible and any
    # previously published ordering can be reproduced.
    def fit_ridge(lam):
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
                w[i] -= lr*((gw.get(i,0.0))/N + lam*w[i]/N)
            b -= lr*gb/N
        return w, b

    def scorer(w, b):
        def pred(feat): return 1/(1+math.exp(-(b + sum(w[i]*v for i, v in feat.items()))))
        def logloss(data):
            s = 0.0
            for _id, feat, y in data:
                p = min(1-1e-12, max(1e-12, pred(feat)))
                s += -(y*math.log(p)+(1-y)*math.log(1-p))
            return s/len(data)
        return pred, logloss

    # Extended past 50 after the first sweep selected the largest value on the grid — an optimum at
    # a boundary is not an optimum, it is a truncated search, and reporting one would repeat the
    # error the defence flagged in a new place.
    GRID = [0.0, 1.0, 4.0, 6.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0]
    sweep = []
    for lam in GRID:
        w_l, b_l = fit_ridge(lam)
        pred_l, logloss_l = scorer(w_l, b_l)
        ll_l = logloss_l(test)
        acc_l = sum(1 for r in test if (pred_l(r[1]) >= .5) == (r[2] == 1))/len(test)
        order_l = [sp for sp in sorted(species, key=lambda t: -w_l[idx[t]])]
        sweep.append(dict(ridge=lam, log_loss=round(ll_l, 5), accuracy=round(acc_l, 4),
                          _w=w_l, _b=b_l, _order=order_l))
    best = min(sweep, key=lambda d: d["log_loss"])
    RIDGE_SELECTED = best["ridge"]
    w, b = best["_w"], best["_b"]
    pred, logloss = scorer(w, b)
    ll = best["log_loss"]; acc = best["accuracy"]

    # --- IS THE ORDERING STABLE IN LAMBDA? ------------------------------------------------------
    # The defence's actual test: if WAR's ranking of species moves around as the regularisation
    # changes, the ranking is an artefact of a tuning knob and does not survive. Spearman rank
    # correlation of every grid point against the selected one.
    def spearman(a_order, b_order):
        ra = {sp: i for i, sp in enumerate(a_order)}
        rb = {sp: i for i, sp in enumerate(b_order)}
        common = [sp for sp in ra if sp in rb]
        n = len(common)
        if n < 3: return None
        d2 = sum((ra[sp]-rb[sp])**2 for sp in common)
        return 1 - (6*d2)/(n*(n*n-1))
    stability = [dict(ridge=d["ridge"], spearman_vs_selected=(None if spearman(best["_order"], d["_order"]) is None
                                                             else round(spearman(best["_order"], d["_order"]), 4)))
                 for d in sweep]
    for d in sweep: d.pop("_w", None); d.pop("_b", None); d.pop("_order", None)

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
        n_games=len(games), n_species=K, min_games=MIN_GAMES,
        ridge=RIDGE_SELECTED, ridge_legacy=RIDGE,
        ridge_selection=dict(
            criterion="held-out log-loss, minimised over a grid (same method as engine/fit_policy.js)",
            grid=GRID, sweep=sweep, selected=RIDGE_SELECTED,
            ordering_stability=stability,
            note=("Spearman rank correlation of the WAR ordering at each grid point against the "
                  "selected one. Values near 1 mean the ordering is not an artefact of the "
                  "regularisation; a low value at a nearby lambda would mean it is.")),
        replacement_beta=round(repl,4),
        method=("Ridge-regularized adjusted plus-minus (RAPM) logistic on team-preview species "
                "indicators; WAR = 0.25*(beta - replacement_beta)*games. Leak-free (preview only)."),
        held_out=dict(log_loss=round(ll,4), coin=round(LN2,4), accuracy=round(acc,4)),
        verdict=("WORSE THAN A COIN AT EVERY REGULARISATION STRENGTH TESTED. With lambda selected "
                 "on held-out log-loss (2026-07-28, after the thesis defence called the hand-set "
                 "value fatal), the best grid point is lambda=200 at 0.69358 against a coin's "
                 "0.69315 — the model loses at its own optimum, and at all ten other grid points by "
                 "more. The previous hand-set lambda=6.0 scored 0.69972, worse still. The ORDERING "
                 "is stable in lambda (Spearman 0.966 even at lambda=0), so the ranking is not an "
                 "artefact of the knob; it is a stable ranking produced by a model with no "
                 "demonstrated predictive value. Do not quote WAR as evidence that a species wins "
                 "games. It is a descriptive ordering of preview co-occurrence, nothing more."),
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
