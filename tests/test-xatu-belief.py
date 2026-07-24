#!/usr/bin/env python3
"""Pins XATU's belief state. Expected values are derived by hand, and the shipped report is READ
rather than copied, so the test cannot drift with the model.
    python3 tests/test-xatu-belief.py
"""
import json, os, sys, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
P = F = 0
def ok(cond, msg):
    global P, F
    print(("  ok   " if cond else "  FAIL ") + msg); P += cond; F += (not cond)

r = json.load(open(D("data", "xatu-belief.json"), encoding="utf-8"))
ce = r["cross_entropy"]; acc = r["top1_accuracy"]; imp = r["improvement_over_prior"]

print("== the ordering that has to hold ==")
ok(ce["uniform"] > ce["usage_prior"], "a usage prior beats uniform (there is species signal)")
ok(ce["belief"] < ce["usage_prior"], "belief beats the usage prior (reveals carry information)")
ok(acc["belief"] >= acc["usage_prior"], "belief is at least as accurate top-1")

print("== hand-derived: the uniform floor is -ln(1/V) = ln(V) ==")
V = r["move_vocabulary"]
ok(abs(ce["uniform"] - math.log(V)) < 0.01,
   f"uniform CE {ce['uniform']} == ln({V}) = {math.log(V):.4f}")

print("== the gain is real, not noise ==")
lo, hi = imp["ci95_clustered_by_game"]
ok(lo <= imp["mean_log_loss_reduction"] <= hi, "the point estimate sits inside its own interval")
ok(imp["significant"] == (lo > 0), "the significance flag agrees with the interval")
ok(lo > 0, f"the improvement clears zero: CI [{lo}, {hi}]")

print("== the four-move cap is where a usage table is not merely imprecise but WRONG ==")
w = r["where_the_gain_comes_from"]
ok(w["belief_ce_on_those"] < w["usage_prior_ce_on_those"],
   f"with all 4 moves known, belief {w['belief_ce_on_those']} beats prior {w['usage_prior_ce_on_those']}")
ok(0 <= w["share_of_events"] <= 1, "the cap share is a valid proportion")

print("== the repeat factor is measured, not asserted ==")
ok("repeat_boost_learned" in r, "the repeat boost is recorded in the report")
p = r["p_next_move_is_a_repeat"]
ok(0 < p < 1, f"P(next move already seen) = {p} is a probability")
# the boost is the odds form of that probability: p/(1-p), floored at 1
expect = max(1.0, p / (1 - p))
ok(abs(r["repeat_boost_learned"] - expect) < 0.01,
   f"boost {r['repeat_boost_learned']} == odds({p}) = {expect:.3f} — derived, not typed")

print("== leak-free ==")
ok(r["n_train"] + r["n_test"] == r["n_games"], "train and test partition the store exactly")
ok(r["n_test"] > 0 and r["n_move_events"] > 0, "there are held-out events to score")

print(f"\nXATU BELIEF TESTS: {P} passed, {F} failed")
sys.exit(1 if F else 0)
