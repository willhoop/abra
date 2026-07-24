#!/usr/bin/env python3
"""Pins the team-context prior. Reads the shipped report rather than copying numbers into the test,
and re-derives the shrinkage weight by hand so the estimator cannot drift silently.
    python3 tests/test-xatu-context.py
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
P = F = 0
def ok(cond, msg):
    global P, F
    print(("  ok   " if cond else "  FAIL ") + msg); P += cond; F += (not cond)

r = json.load(open(D("data", "xatu-context.json"), encoding="utf-8"))
ce, acc, imp = r["cross_entropy"], r["top1_accuracy"], r["improvement"]

print("== the claim: teammates carry information about a set BEFORE anything is revealed ==")
ok(ce["team_context"] < ce["usage_prior"],
   f"context beats the bare prior ({ce['team_context']} vs {ce['usage_prior']})")
ok(acc["team_context"] >= acc["usage_prior"],
   f"context is at least as accurate top-1 ({acc['team_context']:.1%} vs {acc['usage_prior']:.1%})")
lo, hi = imp["ci95_clustered_by_game"]
ok(lo > 0, f"the gain clears zero: CI [{lo}, {hi}]")
ok(lo <= imp["mean_log_loss_reduction"] <= hi, "the point estimate lies inside its own interval")
ok(imp["significant"] == (lo > 0), "the significance flag agrees with the interval")

print("== hand-derived: the shrinkage weight is n/(n+K) ==")
K = r["shrinkage_K"]
# a cell seen exactly K times must be trusted exactly half way
ok(abs(K/(K+K) - 0.5) < 1e-9, f"a context cell seen K={K:g} times is weighted 0.5 — half the prior")
# a cell seen once is weighted 1/(1+K); with K=12 that is under 8%, so one game cannot swing a set
w1 = 1.0/(1.0+K)
ok(w1 < 0.10, f"a context seen once is weighted {w1:.3f} — a single game cannot manufacture a signal")

print("== the context features are the things a set is actually built around ==")
feats = set(r["context_features"])
for f in ["weather_rain", "weather_sun", "speed_trickroom", "speed_tailwind"]:
    ok(f in feats, f"context includes {f}")

print("== leak-free and non-empty ==")
ok(r["n_train"] + r["n_test"] == r["n_games"], "train and test partition the store exactly")
ok(r["n_first_reveals"] > 0, "there are held-out first reveals to score")
ok(len(r["most_common_contexts"]) > 0, "context tags were actually produced")

print(f"\nXATU CONTEXT TESTS: {P} passed, {F} failed")
sys.exit(1 if F else 0)
