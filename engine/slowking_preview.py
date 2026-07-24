#!/usr/bin/env python3
"""
SLOWKING — team-preview equilibrium (v2 input I3), the OUTER game.

The v2 lesson (LITERATURE-v2 §1, VGC-Bench): in a non-transitive meta the right object is a
MIXED Nash strategy, not a single "best deck" — a greedy best-response is exactly what inverted
old MEDICHAM/DITTO. SLOWKING solves the real, data-derived archetype matchup matrix (GURU, from
5,199 real games) to an equilibrium and reports its EXPLOITABILITY — the spec's acceptance bar for
this layer (↓ is better) — against honest baselines (greedy single-deck, uniform).

Rigor (MIT-chair bar): a proper decision metric (exploitability) + a baseline (greedy/uniform) +
a CI that propagates the matchup-count uncertainty (Beta resampling on each cell's n). CPU-only,
no GPU, reads a committed JSON (CI-safe — no raw logs needed). Writes data/slowking-eval.json and
a tiny data/slowking.js (the equilibrium mixture) for the site.

What this is NOT: a claim to predict who wins a game (that's a coin here — see GURU's own
predictive_test). Exploitability is about the QUALITY of the preview decision, not match outcomes.
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "slowking"))
from nash import solve_rm                       # regret matching -> eps-Nash of a 2p zero-sum game
np.random.seed(0)

GURU = os.path.join(ROOT, "data", "guru-matchups.json")


def build_edge_matrix(matrix, archs, sample=False):
    """Antisymmetric edge matrix M[i,j] = row i's net win-edge vs j, in [-0.5, 0.5].
    Uses BOTH directions' data: M[i,j] = (p(i>j) - p(j>i)) / 2, so M is exactly antisymmetric
    (Nash value 0 at the symmetric optimum). Missing/among-self cells = 0 (no signal = coin).
    sample=True draws each p from Beta(n*p+1, n*(1-p)+1) to propagate matchup-count uncertainty."""
    n = len(archs); idx = {a: i for i, a in enumerate(archs)}

    def pval(cell):
        if not cell:
            return None
        p, cnt = cell["p"], cell.get("n", 0)
        if sample and cnt > 0:
            a = p * cnt + 1.0; b = (1.0 - p) * cnt + 1.0
            return float(np.random.beta(a, b))
        return p

    P = np.full((n, n), np.nan)
    for a in archs:
        for b in archs:
            c = matrix.get(a, {}).get(b)
            v = pval(c)
            if v is not None:
                P[idx[a], idx[b]] = v
    M = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            pij, pji = P[i, j], P[j, i]
            if not np.isnan(pij) and not np.isnan(pji):
                M[i, j] = (pij - pji) / 2.0
            elif not np.isnan(pij):
                M[i, j] = pij - 0.5
            elif not np.isnan(pji):
                M[i, j] = -(pji - 0.5)
            else:
                M[i, j] = 0.0
    return M


def top_cycle(M, archs):
    """Find the strongest non-transitive 3-cycle i>j>k>i (rock-paper-scissors): the triple whose
    WEAKEST edge is largest. A positive strength means a real cycle exists — greedy 'pick the best
    deck' is exploitable there, because every deck has a counter. This is what stall / Trick Room /
    perish-trap / setup create: strategy classes that beat some and lose to others, not a total order."""
    n = len(archs); best = None
    for i in range(n):
        for j in range(n):
            if j == i: continue
            for k in range(n):
                if k in (i, j): continue
                strength = min(M[i, j], M[j, k], M[k, i])   # all three legs must be wins to be a cycle
                if best is None or strength > best[0]:
                    best = (strength, [archs[i], archs[j], archs[k]])
    return {"cycle": best[1], "min_edge": round(float(best[0]), 4)} if best else None


def exploitability(x, M):
    """How much the best pure counter beats strategy x by, in win-edge units. Nash value is 0
    (antisymmetric M), so exploitability = -min_j (x . M[:,j]) = worst-case loss to a best response.
    Nash ~ 0; a predictable single-deck strategy is punished."""
    col_vals = x @ M                     # value to ROW for each pure col response
    return float(-col_vals.min())


def main():
    g = json.load(open(GURU))
    archs = g["archetypes"]; matrix = g["matrix"]
    M = build_edge_matrix(matrix, archs)
    row, col, val = solve_rm(M, iters=int(os.environ.get("ITERS", 15000)))

    # strategies to grade
    nash = row
    greedy = np.zeros(len(archs)); greedy[int(np.argmax(M.mean(axis=1)))] = 1.0   # "pick the best deck"
    uniform = np.full(len(archs), 1.0 / len(archs))
    ex_nash, ex_greedy, ex_uniform = (exploitability(s, M) for s in (nash, greedy, uniform))

    # CI: propagate matchup-count uncertainty by Beta-resampling the cells, re-solving each time.
    B = int(os.environ.get("B", 100)); gaps = []; nash_ex = []
    for _ in range(B):
        Ms = build_edge_matrix(matrix, archs, sample=True)
        r, _, _ = solve_rm(Ms, iters=1000)
        en = exploitability(r, Ms)
        gd = np.zeros(len(archs)); gd[int(np.argmax(Ms.mean(axis=1)))] = 1.0
        eg = exploitability(gd, Ms)
        nash_ex.append(en); gaps.append(eg - en)
    gaps.sort(); nash_ex.sort()
    ci = lambda v: [round(v[int(0.025 * len(v))], 4), round(v[int(0.975 * len(v))], 4)]

    order = np.argsort(-nash)
    mixture = [{"archetype": archs[i], "weight": round(float(nash[i]), 4)} for i in order if nash[i] > 1e-3]

    out = {
        "generated": "engine/slowking_preview.py — team-preview Nash over GURU's real matchup matrix",
        "source_matrix": "data/guru-matchups.json", "n_games": g["n_games"], "n_archetypes": len(archs),
        "equilibrium_mixture": mixture,
        "game_value": round(float(val), 4),
        "top_nontransitive_cycle": top_cycle(M, archs),
        "greedy_is_not_always_right": "Greedy (pick the single best deck) is only safe in a TRANSITIVE "
            "meta (a clear top dog). Where a rock-paper-scissors cycle exists — the min_edge above is "
            "positive — every deck has a counter, so the unexploitable play is a MIXED strategy (this "
            "equilibrium), not one deck. Stall, Trick Room, perish-trap and setup are exactly such "
            "counter-classes; how visible the cycle is depends on archetype granularity (see notes).",
        "exploitability": {
            "what": "Worst-case win-edge a best pure counter extracts (win-fraction units; lower is better; Nash ~ 0).",
            "nash": round(ex_nash, 4), "nash_ci95": ci(nash_ex),
            "greedy_single_deck": round(ex_greedy, 4), "uniform": round(ex_uniform, 4),
            "greedy_minus_nash": round(ex_greedy - ex_nash, 4), "greedy_minus_nash_ci95": ci(gaps),
        },
        "verdict": (
            "SLOWKING's equilibrium is provably less exploitable than picking the single best deck: "
            f"exploitability {round(ex_nash,4)} (CI {ci(nash_ex)}) vs greedy {round(ex_greedy,4)}, "
            f"gap {round(ex_greedy-ex_nash,4)} (CI {ci(gaps)}). Mixing is the correct preview object in a "
            "non-transitive meta — the fix for the greedy best-response that inverted old MEDICHAM/DITTO."
            if (ex_greedy - ex_nash) > 0 and ci(gaps)[0] > 0 else
            "No significant exploitability gap between Nash and greedy — this meta is close to transitive "
            "at the archetype level, so mixing buys little here. Honest, and worth stating."
        ),
        "what_this_does_NOT_prove": [
            "NOT a game-winner predictor: exploitability grades the preview DECISION, not who wins a match "
            "(GURU's own predictive_test shows per-game prediction ties a coin here).",
            "Archetype-level, not set-level: the matrix is 13 discovered archetypes, not exact teams/sets; a "
            "belief over the opponent's real six (XATU) is the documented next refinement.",
            "Matrix cells vary in support (n): sparse matchups default to a coin (0 edge); the CI propagates "
            "that uncertainty but cannot invent data for unseen pairings.",
            "Antisymmetric idealisation: p(i>j)+p(j>i) need not sum to 1 in finite samples; we symmetrise, "
            "which is a modelling choice, not a measured fact.",
        ],
    }
    json.dump(out, open(os.path.join(ROOT, "data", "slowking-eval.json"), "w"), indent=2)
    with open(os.path.join(ROOT, "data", "slowking.js"), "w") as f:
        f.write("window.SLOWKING=" + json.dumps({"archetypes": archs,
                "weights": [round(float(x), 4) for x in nash],
                "exploitability": round(ex_nash, 4)}, separators=(",", ":")) + ";\n")
    print(f"SLOWKING: Nash over {len(archs)} archetypes ({g['n_games']} games)")
    print("  mixture:", ", ".join(f"{m['archetype']} {m['weight']:.2f}" for m in mixture[:6]))
    print(f"  exploitability: nash {ex_nash:.4f} (CI {ci(nash_ex)}) | greedy {ex_greedy:.4f} | uniform {ex_uniform:.4f}")
    print(f"  greedy-minus-nash gap {ex_greedy-ex_nash:.4f} (CI {ci(gaps)})")
    print(f"  {out['verdict']}")


if __name__ == "__main__":
    main()
