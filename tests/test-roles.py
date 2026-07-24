#!/usr/bin/env python3
"""Pins the ROLE tagger and reads the shipped role reports so the tests cannot silently drift.
Expected role tags are derived BY HAND here, not captured from output.
    python3 tests/test-roles.py
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "engine"))
import roles as R

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
P = F = 0
def ok(cond, msg):
    global P, F
    print(("  ok   " if cond else "  FAIL ") + msg); P += cond; F += (not cond)

print("== tagger: hand-derived role sets ==")
# Incineroar: Fake Out + Parting Shot + Flare Blitz + Knock Off, Intimidate.
# By hand: fakeout (Fake Out); pivot + debuff (Parting Shot); debuff + intimidate covered by debuff(ability);
# phys_attacker (Flare Blitz + Knock Off = 2 physical). No special moves -> no spec_attacker.
inc = R.signal_roles(["Fake Out","Parting Shot","Flare Blitz","Knock Off"], "Intimidate", "Sitrus Berry")
for r in ("fakeout","pivot","debuff","phys_attacker"):
    ok(r in inc, f"Incineroar has {r}")
ok("spec_attacker" not in inc, "Incineroar is not a special attacker")

# Torkoal-style: Sunny Day (weather) + Heat Wave + Weather Ball (2 special) + Protect.
tor = R.signal_roles(["Sunny Day","Heat Wave","Weather Ball","Protect"], "Drought", "Charcoal")
# Weather is split by TYPE now (2026-07-24): a generic "weather" tag could not answer whether a
# Swift Swim mon has a RAIN setter or a dead ability, so setter and abuser both name the weather.
ok("weather_sun" in tor, "SUN setter tagged specifically (Sunny Day / Drought), not generic weather")
ok("weather_rain" not in tor and "weather_sand" not in tor, "sun setter is not tagged as rain or sand")
ok("spec_attacker" in tor, "special attacker tagged (Heat Wave + Weather Ball)")
ok("phys_attacker" not in tor, "not a physical attacker")

# One special move alone must NOT earn special-attacker (threshold is >= 2).
ok("spec_attacker" not in R.signal_roles(["Heat Wave","Protect","Tailwind"], None, None),
   "single special move does not earn special attacker")
ok("speed_tailwind" in R.signal_roles(["Tailwind"], None, None), "Tailwind tagged")
ok("speed_trickroom" in R.signal_roles(["Trick Room"], None, None), "Trick Room tagged")

print("== wilson interval brackets the point estimate ==")
p, lo, hi = R.wilson(30, 100)
ok(abs(p-0.30) < 1e-9 and lo < p < hi and 0 <= lo and hi <= 1, f"wilson(30,100)={p:.2f} in [{lo:.3f},{hi:.3f}]")
ok(R.wilson(0,0) == (0.0, 0.0, 1.0), "wilson(0,0) is the empty [0,1]")

print("== shipped reports: read, don't copy (cannot drift) ==")
mm = json.load(open(D("data","role-matchups.json")))
bad = cells = 0
for a, row in mm["matrix"].items():
    for b, c in row.items():
        cells += 1
        if not (0 <= c["p"] <= 1 and c["lo"]-1e-9 <= c["p"] <= c["hi"]+1e-9 and c["n"] >= 0): bad += 1
ok(bad == 0 and cells > 0, f"role-matchups: all {cells} cells valid ({bad} bad)")
# pooling claim must hold: median role-pair cell is far larger than the old 11-18 archetype cells
ns = sorted(c["n"] for row in mm["matrix"].values() for c in row.values())
med = ns[len(ns)//2]
# NOTE (2026-07-24): this bar was 100 when species role tags were binary with a flat count>=2 rule.
# That rule over-tagged (a team carried 19.6 of 26 roles on average, incl. flukes like Basculegion
# "debuff" at 2/3566), which inflated every cell. Credible tags (Wilson lower bound on the per-set
# rate) give 4.3 roles per team and a HONEST median cell. Still >> the old single-label n~15.
# Bar lowered again 50 -> 35 on 2026-07-24 as the taxonomy grew 27 -> 39 roles. This is the real
# fragmentation trade-off and it is worth watching: more roles means more cells, so each cell holds
# fewer games. The median has moved 7,971 (over-tagged) -> 95 (credible, 27 roles) -> ~50 (39 roles).
# It is still far above the old single-label archetype cells (n=11-18), but the trend is the cost of
# a finer taxonomy and should stop the role count from growing without a reason.
ok(med > 35, f"pooling holds: median role-pair cell n={med} >> old single-label n~15")

ev = json.load(open(D("data","roles-eval.json")))
ll = ev["log_loss"]
ok(abs(ll["coin"] - 0.6931) < 1e-3, "coin baseline is ln2")
ok(ll["roles"] > ll["coin"] - 0.02, "roles ~ coin (honest: preview roles barely separate)")

war = json.load(open(D("data","war.json")))
ok(war["held_out"]["log_loss"] < war["held_out"]["coin"] + 1e-9,
   f"WAR model log-loss {war['held_out']['log_loss']} <= coin {war['held_out']['coin']}")
ok(len(war["leaders"]) > 0 and war["leaders"][0]["war"] > war["trailers"][-1]["war"],
   "WAR ordering: leaders above trailers")

print(f"\nROLES TESTS: {P} passed, {F} failed")
sys.exit(1 if F else 0)
