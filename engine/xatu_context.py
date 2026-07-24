#!/usr/bin/env python3
"""xatu_context.py — the belief you can have BEFORE anything is revealed.

Why this exists
---------------
The belief-state tracker (xatu_belief.py) only sharpens once a Pokemon has shown you something. But
CHOMP has to decide at team preview, which is turn zero: nothing has been revealed, so a belief state
there is just the usage prior. That looked like a dead end for using better beliefs in the bring
decision — until you notice there IS information at preview, it just is not about the Pokemon itself.
It is about its FIVE TEAMMATES.

    "Basculegion is Swift Swim on a rain team and Adaptability otherwise."

That is a real, checkable claim: a set is chosen to fit a team. Pelipper on the roster makes Swift
Swim plausible; no rain setter makes it close to pointless. So the question this measures is:

    does knowing the other five Pokemon improve the prediction of THIS one's moves,
    before a single turn is played?

What is measured
----------------
For every Pokemon in every held-out game we predict its FIRST revealed move — the earliest moment we
could be asked, and the moment CHOMP actually cares about — comparing:

    usage prior  P(move | species)                     ... today's XATU
    context      P(move | species, teammate features)  ... conditioned on the other five

The context features are deliberately simple and interpretable, all computed from the six alone:
whether the team carries a rain / sun / sand / snow setter, a Trick Room setter, Tailwind, and
redirection. These are the things a set is actually built around.

Estimation is a shrinkage (empirical-Bayes) blend, not a fresh model: for each (species, context)
cell we blend that cell's observed move distribution toward the species' overall distribution, with
the weight set by how much data the cell has. A cell seen twice barely moves off the prior; a cell
seen hundreds of times is trusted. So a context can only help when there is evidence for it, and a
rare context cannot invent a signal.

Everything is fitted on TRAIN games and scored on held-out games, clustered by game.

    python3 engine/xatu_context.py
Writes data/xatu-context.json
"""
import json, os, math
import numpy as np
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
STORE = D("data", "games.ladder.jsonl")
ALPHA = 0.5     # Laplace on the species prior
K = 12.0        # shrinkage strength: a context cell needs ~K observations to be half-trusted

def load_games():
    with open(STORE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line: continue
            try: yield json.loads(line)
            except Exception: continue

def split(gid):
    h = 0
    for ch in gid: h = (h*131 + ord(ch)) & 0xffffffff
    return "test" if h % 5 == 0 else "train"

# ---- team context, computed from the six only (public at preview) ----------------------
def load_roles():
    try:
        pr = json.load(open(D("data", "pokemon-roles.json"), encoding="utf-8"))
        return {sp: set((v.get("roles") or {}).keys()) for sp, v in pr["species"].items()}
    except Exception:
        return {}

ROLES_OF = load_roles()
CONTEXT_ROLES = ["weather_rain", "weather_sun", "weather_sand", "weather_snow",
                 "speed_trickroom", "speed_tailwind", "redirection"]

def team_context(six, me):
    """A short, readable tag for what the REST of the team provides."""
    tags = []
    for r in CONTEXT_ROLES:
        if any(r in ROLES_OF.get(m, ()) for m in six if m != me):
            tags.append(r)
    return "|".join(tags) if tags else "none"

def build():
    games = list(load_games())
    train = [g for g in games if split(g["id"]) == "train"]
    test  = [g for g in games if split(g["id"]) == "test"]

    def first_moves(g):
        """species -> its FIRST revealed move, per side, plus that side's six"""
        out = []
        seen = set()
        for t in (g.get("turns") or []):
            for e in t.get("ev", []):
                if e.get("t") != "m" or not e.get("mv") or not e.get("mon"): continue
                side = str(e.get("s", ""))[:2]
                key = (side, e["mon"])
                if key in seen: continue
                seen.add(key)
                six = (g.get("six") or {}).get(side, [])
                if six: out.append((e["mon"], e["mv"], six))
        return out

    # ---- fit on train ----
    sp_moves = defaultdict(Counter)                  # species -> move counts
    ctx_moves = defaultdict(lambda: defaultdict(Counter))   # species -> ctx -> move counts
    for g in train:
        for sp, mv, six in first_moves(g):
            sp_moves[sp][mv] += 1
            ctx_moves[sp][team_context(six, sp)][mv] += 1

    def prior_of(sp):
        c = sp_moves.get(sp)
        if not c: return None
        tot = sum(c.values()) + ALPHA*len(c)
        return {m: (c[m]+ALPHA)/tot for m in c}

    def context_of(sp, ctx):
        """shrink the context cell toward the species prior by how much evidence it has"""
        base = prior_of(sp)
        if base is None: return None
        cell = ctx_moves.get(sp, {}).get(ctx)
        if not cell: return base
        n = sum(cell.values())
        w = n / (n + K)                      # 0 = trust the prior, 1 = trust the cell
        out = {}
        for m in set(base) | set(cell):
            pc = cell.get(m, 0) / n if n else 0.0
            out[m] = (1-w)*base.get(m, ALPHA/ (sum(sp_moves[sp].values())+1)) + w*pc
        z = sum(out.values()) or 1.0
        return {m: v/z for m, v in out.items()}

    # ---- score on held-out first reveals ----
    n = 0; ce_prior = ce_ctx = 0.0; hit_prior = hit_ctx = 0
    per_game = defaultdict(list)
    ctx_seen = Counter()
    for g in test:
        for sp, mv, six in first_moves(g):
            pri = prior_of(sp)
            if pri is None: continue
            ctx = team_context(six, sp); ctx_seen[ctx] += 1
            cxd = context_of(sp, ctx) or pri
            pp = max(1e-12, pri.get(mv, 1e-12))
            pc = max(1e-12, cxd.get(mv, 1e-12))
            ce_prior += -math.log(pp); ce_ctx += -math.log(pc)
            if max(pri, key=pri.get) == mv: hit_prior += 1
            if max(cxd, key=cxd.get) == mv: hit_ctx += 1
            per_game[g["id"]].append((-math.log(pp)) - (-math.log(pc)))
            n += 1

    gids = list(per_game)
    gmean = np.array([np.mean(per_game[i]) for i in gids]) if gids else np.array([0.0])
    rs = np.random.default_rng(23)
    idx = rs.integers(0, len(gmean), size=(2000, len(gmean)))
    boot = np.sort(gmean[idx].mean(axis=1))
    delta = float(gmean.mean())
    ci = (round(float(boot[int(.025*len(boot))]), 4), round(float(boot[int(.975*len(boot))]), 4))

    out = dict(
        generated=__import__("datetime").date.today().isoformat(),
        n_games=len(games), n_train=len(train), n_test=len(test), n_first_reveals=n,
        question=("At team preview nothing has been revealed, so a belief STATE is just the prior. "
                  "But the other five Pokemon are public. Does knowing them improve the prediction "
                  "of this one's set?"),
        context_features=CONTEXT_ROLES,
        shrinkage_K=K,
        cross_entropy=dict(usage_prior=round(ce_prior/max(n,1), 4),
                           team_context=round(ce_ctx/max(n,1), 4)),
        top1_accuracy=dict(usage_prior=round(hit_prior/max(n,1), 4),
                           team_context=round(hit_ctx/max(n,1), 4)),
        improvement=dict(mean_log_loss_reduction=round(delta, 4),
                         ci95_clustered_by_game=ci,
                         significant=bool(ci[0] > 0),
                         reading=("Positive means teammates carry information about a set before "
                                  "anything is revealed. If the interval includes zero, team "
                                  "context does not help at preview and CHOMP cannot use it.")),
        most_common_contexts=[{"context": c, "n": k} for c, k in ctx_seen.most_common(10)],
        method=("Fitted on train games only; scored on each Pokemon's FIRST revealed move in "
                "held-out games. Context cells are shrunk toward the species prior by n/(n+K), so a "
                "thin context cannot manufacture a signal."),
    )
    json.dump(out, open(D("data", "xatu-context.json"), "w"), indent=1)

    ce = out["cross_entropy"]; acc = out["top1_accuracy"]
    print(f"xatu_context — {len(games)} games ({len(test)} held out), {n:,} first reveals")
    print(f"  cross-entropy   usage prior {ce['usage_prior']}   + team context {ce['team_context']}")
    print(f"  top-1 accuracy  usage prior {acc['usage_prior']:.1%}   + team context {acc['team_context']:.1%}")
    print(f"  improvement {delta:+.4f}  CI {ci}  -> {'SIGNIFICANT' if ci[0] > 0 else 'not established'}")
    print("  common contexts:", ", ".join(f"{c['context'][:28]}({c['n']})" for c in out["most_common_contexts"][:4]))
    return out

if __name__ == "__main__":
    build()
