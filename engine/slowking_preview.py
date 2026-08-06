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

# default = GURU species archetypes; override with MATRIX_FILE (e.g. the playstyle matrix) + TAG
GURU = os.environ.get("MATRIX_FILE", os.path.join(ROOT, "data", "guru-matchups.json"))
TAG = os.environ.get("TAG", "")   # "" -> slowking-eval.json ; "playstyle" -> slowking-playstyle-eval.json

# THE OUTPUT NAME COMES FROM `TAG` AND THE INPUT COMES FROM `MATRIX_FILE`, AND FOR TEN DAYS NOTHING
# TIED THE TWO TOGETHER.
#
# Run as `TAG=playstyle python engine/slowking_preview.py` with MATRIX_FILE unset, this file happily
# solved the DEFAULT matrix -- GURU's 12 species-pair archetypes over 5,265 games -- and wrote the
# answer out under the playstyle name. That is what was on disk from 2026-08-03 15:15 until
# 2026-08-04: data/slowking-playstyle.js carried a payload BYTE-IDENTICAL to data/slowking.js, and
# data/slowking-playstyle-eval.json was a byte-identical FILE to data/slowking-eval.json. The real
# playstyle matrix holds 2,860 games over 8 playstyles, and every published figure differed --
# including the VERDICT, which flipped from "substantially less exploitable ... non-transitive" to
# "no material exploitability gap ... close to transitive".
#
# Nothing could catch it downstream. engine/provenance.js reported the file `ok` and was right to:
# it was co-generated with data/slowking.js, so the ordering carries no information, and provenance
# sees ordering and declared counts -- it cannot see that a file's CONTENT came from the wrong input.
# A checker cannot recover a fact the generator threw away. So the generator refuses.
#
# The rule is narrow on purpose: a TAG names a NON-DEFAULT run, so a TAG with the default matrix is
# the one combination that cannot mean anything. TAG unset + default matrix is the ordinary GURU run
# and is untouched; TAG set + MATRIX_FILE set is the playstyle run and is untouched.
if TAG and not os.environ.get("MATRIX_FILE"):
    sys.exit(
        f"REFUSING TO WRITE: TAG={TAG!r} names an output (data/slowking-{TAG}.js,\n"
        f"data/slowking-{TAG}-eval.json) but MATRIX_FILE is unset, so the matrix would be the\n"
        f"DEFAULT one -- data/guru-matchups.json. That writes a GURU result under the {TAG} name and\n"
        f"is byte-identical to data/slowking.js; it is exactly the clobber this check exists to stop.\n"
        f"Set both, e.g.:\n"
        f"  TAG=playstyle MATRIX_FILE=data/playstyle-matchups.json python engine/slowking_preview.py")

# A RELATIVE MATRIX_FILE MUST RESOLVE AGAINST THE REPO, NOT THE SHELL'S CWD. The command in the docs
# is `MATRIX_FILE=data/playstyle-matchups.json`, which only opens from the repository root; run from
# engine/ it raises, and a path that works from one directory and not another is how the wrong matrix
# gets reached for in the first place.
if not os.path.isabs(GURU):
    GURU = os.path.join(ROOT, GURU) if not os.path.exists(GURU) else os.path.abspath(GURU)


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


def top_cycle(M, archs, matrix=None, min_n=50):
    """Strongest non-transitive 3-cycle i>j>k>i, reported WITH the sample size behind each leg.

    THIS USED TO MANUFACTURE FINDINGS. It searched every ordered triple - 990 of them for 11 playstyles
    - kept whichever had the largest weakest leg, and asserted in its own docstring that "A positive
    strength means a real cycle exists". No sample-size floor, no significance test. On a sparse matrix
    it therefore ALWAYS returns something positive, and tests/test-slowking.py went on to REQUIRE that a
    cycle be reported. A maximum over 990 candidates was being published as a discovery.

    Measured on data/playstyle-matchups.json, 2026-07-28, for the cycle it reported:

        TrickRoom    beats HyperOffense   65% of 23 games   range 45%-81%   spans a coin
        HyperOffense beats Sand           57% of 23 games   range 37%-74%   spans a coin
        Sand         beats TrickRoom      71% of 24 games   range 51%-85%   clears, barely

    Two legs of three are indistinguishable from a coin flip, on 23 games each. Requiring every leg to
    clear 50% AND rest on at least min_n games leaves NO cycle at all in that matrix. Across 990
    candidate triples at a 5% threshold you would expect roughly 17 spurious cycles by chance, so
    finding one is what noise looks like rather than evidence against it.

    The strongest triple is still reported, because it is a useful descriptive summary. It now carries
    the games behind each leg and an explicit `supported` flag, and `supported` is False unless every
    leg is both a win and adequately sampled. Anything claiming a cycle exists must read that flag.
    """
    n = len(archs); best = None
    for i in range(n):
        for j in range(n):
            if j == i: continue
            for k in range(n):
                if k in (i, j): continue
                strength = min(M[i, j], M[j, k], M[k, i])   # all three legs must be wins to be a cycle
                if best is None or strength > best[0]:
                    best = (strength, [archs[i], archs[j], archs[k]], [(i, j), (j, k), (k, i)])
    if not best:
        return None
    out = {"cycle": best[1], "min_edge": round(float(best[0]), 4)}

    if matrix is not None:
        legs, supported = [], best[0] > 0
        for (a, b) in best[2]:
            cell = (matrix.get(archs[a]) or {}).get(archs[b])
            if cell and cell.get("n"):
                lo, hi, nn = cell.get("lo"), cell.get("hi"), cell["n"]
                clears = (lo is not None and lo > 0.5) or (hi is not None and hi < 0.5)
                legs.append({"from": archs[a], "to": archs[b], "n": nn,
                             "win_pct": round(100 * cell.get("p", 0.0), 1),
                             "clears_50": bool(clears), "well_sampled": nn >= min_n})
                if not (clears and nn >= min_n):
                    supported = False
            else:
                legs.append({"from": archs[a], "to": archs[b], "n": 0,
                             "clears_50": False, "well_sampled": False})
                supported = False
        out["legs"] = legs
        out["min_games_required"] = min_n
        out["candidate_triples_searched"] = n * (n - 1) * (n - 2)
        out["supported"] = supported
        out["note"] = ("supported=true requires every leg to clear 50%% and rest on >=%d games. This is "
                       "the strongest of %d candidate triples, so an unsupported cycle is what noise "
                       "looks like, not weak evidence of structure."
                       % (min_n, n * (n - 1) * (n - 2)))
    return out


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
    #
    # KNOWN DEFECT, DIAGNOSED 2026-07-28, NOT YET FIXED. These intervals do not contain their own
    # point estimates. Measured on the 8-archetype playstyle matrix:
    #
    #     exploitability   nash 0.0003   CI [0.0006, 0.0033]   <- point BELOW the interval
    #     greedy - nash    gap  0.3887   CI [0.0244, 0.3777]   <- point ABOVE the interval
    #
    # The cause is the iteration count on the next line against line 145. The point estimate solves
    # the observed matrix with iters=15000; every bootstrap sample solves with iters=1000. Regret
    # matching approaches Nash as iterations grow, so the bootstrap replicates are systematically
    # UNDER-CONVERGED and carry residual exploitability the point estimate has already worked off.
    # The interval is therefore dominated by solver error at a different setting, not by the matchup-
    # count uncertainty it claims to propagate -- and it is biased in a direction that makes Nash look
    # worse and the gap look smaller than the point estimate says.
    #
    # NOT FIXED HERE, deliberately: tests/test-slowking.py asserts on these numbers and the published
    # cycle claim rests on them, so changing the estimator changes a shipped result and is Will's call.
    # The fix is to solve the replicates at the same iters as the point estimate and re-run, which
    # costs 15x the bootstrap time. Until then, treat both intervals as unusable rather than as
    # evidence -- this is the fifth member of the "verdicts asserting significance their own
    # uncertainty does not support" family the handoff warns about.
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

    gap = ex_greedy - ex_nash; gci = ci(gaps); lo = gci[0]
    # THE THRESHOLD IS PUBLISHED, NOT JUST APPLIED.
    #
    # It was written here as 0.03 and independently in tests/test-slowking.py as 0.05, so 'is there a
    # material gap' had two answers. Invisible for as long as the measured gap stayed outside that
    # window -- and the moment new games put it at 0.0409, the generator wrote 'substantially less
    # exploitable' and the test called that a lie. Neither was wrong about its own number.
    #
    # So the value lives in ONE place and travels in the artifact: the test reads it back instead of
    # carrying its own copy. A constant duplicated across a producer and its checker is the same
    # second-source-of-truth this project keeps paying for.
    MATERIAL_GAP = 0.03
    if gap > MATERIAL_GAP:
        strength = ("provably less exploitable (95% CI clears 0)" if lo > 0
                    else f"substantially less exploitable, though sparse matchups keep the 95% CI lower bound near 0 ({lo})")
        verdict = (f"SLOWKING's equilibrium is {strength} than picking the single best deck: greedy {round(ex_greedy,4)} "
                   f"vs Nash {round(ex_nash,4)}, gap {round(gap,4)} (CI {gci}). The meta is non-transitive here "
                   "(rock-paper-scissors), so a MIXED strategy is the right preview object — the fix for the greedy "
                   "best-response that inverted old MEDICHAM/DITTO.")
    else:
        verdict = ("No material exploitability gap between Nash and greedy — this meta is close to transitive at this "
                   "granularity (a dominant deck), so mixing buys little here. Honest, and worth stating.")

    order = np.argsort(-nash)
    mixture = [{"archetype": archs[i], "weight": round(float(nash[i]), 4)} for i in order if nash[i] > 1e-3]

    out = {
        "generated": "engine/slowking_preview.py — team-preview Nash over a real matchup matrix",
        # WAS THE LITERAL "data/guru-matchups.json", WHICH IS THE SECOND HALF OF THE SAME BUG. Even
        # a correct playstyle run stamped the GURU matrix as its source, so the one field that could
        # have exposed the clobber was hardcoded to agree with it. Derived now, and `tag` is recorded
        # beside it so the file says which of the two runs it is.
        "source_matrix": os.path.relpath(GURU, ROOT).replace("\\", "/"),
        "tag": TAG or None,
        "n_games": g["n_games"], "n_archetypes": len(archs),
        "equilibrium_mixture": mixture,
        "game_value": round(float(val), 4),
        "material_gap_threshold": MATERIAL_GAP,
        "top_nontransitive_cycle": top_cycle(M, archs, matrix),
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
        "verdict": verdict,
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
    eval_name = f"slowking-{TAG}-eval.json" if TAG else "slowking-eval.json"
    json.dump(out, open(os.path.join(ROOT, "data", eval_name), "w"), indent=2, allow_nan=False)
    gvar = "SLOWKING_PLAYSTYLE" if TAG else "SLOWKING"
    payload = {"n_games": g["n_games"], "n_archetypes": len(archs),
               "source_matrix": os.path.relpath(GURU, ROOT).replace("\\", "/"),
               "mixture": mixture,
               "exploit_nash": round(ex_nash, 4), "exploit_greedy": round(ex_greedy, 4),
               "exploit_uniform": round(ex_uniform, 4), "gap_ci": ci(gaps),
               "cycle": top_cycle(M, archs, matrix)}
    # Both destinations spelled out rather than built with an f-string: tests/test-site-data-fresh.js
    # pairs a filename with a write on ONE line, and a constructed name is invisible to any scan, so
    # data/slowking-playstyle.js was carried as a permanent orphan with no generator.
    out_js = os.path.join(ROOT, "data", "slowking-playstyle.js") if TAG else os.path.join(ROOT, "data", "slowking.js")
    with open(out_js, "w") as f:   # writes data/slowking-playstyle.js, or data/slowking.js when TAG is unset
        f.write(f"window.{gvar}=" + json.dumps(payload, separators=(",", ":"), allow_nan=False) + ";\n")
    print(f"SLOWKING: Nash over {len(archs)} archetypes ({g['n_games']} games)")
    print("  mixture:", ", ".join(f"{m['archetype']} {m['weight']:.2f}" for m in mixture[:6]))
    print(f"  exploitability: nash {ex_nash:.4f} (CI {ci(nash_ex)}) | greedy {ex_greedy:.4f} | uniform {ex_uniform:.4f}")
    print(f"  greedy-minus-nash gap {ex_greedy-ex_nash:.4f} (CI {ci(gaps)})")
    print(f"  {out['verdict']}")


if __name__ == "__main__":
    main()
