#!/usr/bin/env python3
"""Tests for SLOWKING preview-Nash. (1) a hand-derived unit test of the Nash solver on
Rock-Paper-Scissors (the answer is uniform, value 0 — known by hand); (2) invariants on the
SHIPPED data/slowking-eval.json so the test cannot drift from the artifact. Run in CI.
    python3 tests/test-slowking.py"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "engine", "slowking"))
from nash import solve_rm

fails = 0
def ok(c, m):
    global fails
    print(("ok  " if c else "FAIL ") + m)
    if not c: fails += 1

# (1) RPS: payoff [[0,-1,1],[1,0,-1],[-1,1,0]] — Nash is uniform (1/3 each), value 0. Hand-derived.
RPS = np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]], float)
r, c, v = solve_rm(RPS, iters=20000)
ok(all(abs(x - 1/3) < 0.03 for x in r), f"RPS Nash is ~uniform: {[round(x,3) for x in r]}")
ok(abs(v) < 0.02, f"RPS game value ~0: {round(v,4)}")

# (2) shipped artifact invariants — check every SLOWKING eval that exists (species + playstyle)
def check_eval(F, label):
    d = json.load(open(F))
    w = sum(m["weight"] for m in d["equilibrium_mixture"])
    ok(abs(w - 1.0) < 0.02, f"[{label}] equilibrium mixture sums to 1 (got {round(w,3)})")
    ex = d["exploitability"]
    ok(ex["nash"] >= -1e-6, f"[{label}] nash exploitability >= 0 ({ex['nash']})")
    ok(ex["nash"] <= ex["uniform"] + 1e-3, f"[{label}] Nash <= uniform (mixing over the RIGHT decks helps)")
    ok(ex["nash"] <= ex["greedy_single_deck"] + 1e-3, f"[{label}] Nash <= greedy single-deck")
    ok(d.get("top_nontransitive_cycle") is not None and len(d["top_nontransitive_cycle"]["cycle"]) == 3,
       f"[{label}] reports a 3-archetype non-transitive cycle")
    ok(isinstance(d.get("what_this_does_NOT_prove"), list) and len(d["what_this_does_NOT_prove"]) >= 3,
       f'[{label}] has "what this does NOT prove" (>=3 items)')
    # verdict must not over-claim: only claim a significant gap if the CI lower bound is > 0
    claims = "provably less exploitable" in d["verdict"]
    sig = ex["greedy_minus_nash_ci95"][0] > 0
    ok(claims == sig, f"[{label}] verdict matches whether the greedy-vs-Nash gap CI clears 0")
    return ex

sp = os.path.join(ROOT, "data", "slowking-eval.json")
if not os.path.exists(sp):
    print("slowking-eval.json missing — run engine/slowking_preview.py"); sys.exit(1)
check_eval(sp, "species")
pf = os.path.join(ROOT, "data", "slowking-playstyle-eval.json")
if os.path.exists(pf):
    ex_pf = check_eval(pf, "playstyle")
    # Honest finding: at the playstyle level the POINT gap is materially positive (a directional cycle),
    # but on small per-matchup samples the 95% CI is wide and can cross 0 — so we check the point gap,
    # NOT statistical significance, and the site copy calls it "suggestive, not settled".
    ok(ex_pf["greedy_minus_nash"] > 0.05,
       "[playstyle] greedy-vs-Nash point gap is materially positive (directional cycle; CIs wide on small n)")

if fails:
    print(f"\ntest-slowking: {fails} FAILED"); sys.exit(1)
print("\ntest-slowking: all pass")
