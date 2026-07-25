#!/usr/bin/env python3
"""test-state-encoder.py — the rich state encoder must agree with PORY's own reconstruction.

WHY THIS TEST EXISTS
--------------------
engine/state_encoder.py exists so the value models can see more than material. It is compared
directly against engine/pory.py in engine/pory_nn.py, and that comparison is only meaningful if both
read the SAME game the same way. Two bugs in the first version made that false, and neither raised an
error — they produced plausible numbers:

  1. The active-slot test compared species keys against the position letters 'a'/'b', so the set was
     always empty. active_count, hp_active_mean and all eight slot*_active features were identically
     zero in every state. A tenth of the feature vector was dead and the model still trained happily.

  2. Alive counted REVEALED Pokemon rather than brought ones, so every game began at 2-2 and drifted
     up as Pokemon switched in. Bring-4 is common knowledge in VGC from team preview onward, and
     pory.py uses 4 - faints. The two encoders therefore disagreed about the single strongest feature
     in the model, which would have made every arm-vs-arm comparison in pory_nn.py meaningless.

Both are the same class of fault: silent, plausible, and fatal to a comparison. So this asserts
agreement rather than trusting it.
"""
import os, sys, json, itertools

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "engine"))

P = F = 0


def ok(cond, msg):
    global P, F
    print(("  ok   " if cond else "  FAIL ") + msg)
    if cond:
        P += 1
    else:
        F += 1


import importlib.util
from state_encoder import encode_log, FEATURE_NAMES, ENCODER_VERSION

spec = importlib.util.spec_from_file_location("pory", os.path.join(ROOT, "engine", "pory.py"))
pory = importlib.util.module_from_spec(spec)
sys.modules["pory"] = pory
try:
    spec.loader.exec_module(pory)
except SystemExit:
    pass                      # pory.py trains on import; we only want board_states
except Exception:
    pass

RAW = os.path.join(ROOT, "data", "games.ladder.raw-logs.jsonl")
IX = {n: i for i, n in enumerate(FEATURE_NAMES)}
N_GAMES = 300

if not os.path.exists(RAW):
    print("SKIP: no raw logs present")
    sys.exit(2)

rows = []
with open(RAW, encoding="utf-8") as fh:
    for line in itertools.islice(fh, N_GAMES):
        line = line.strip()
        if line:
            rows.append(json.loads(line))

print(f"== encoder v{ENCODER_VERSION}, {len(FEATURE_NAMES)} features, {len(rows)} games ==")

# ---- 1. agreement with pory.board_states on the material features --------------------------------
agree = dis = 0
for r in rows:
    mine = encode_log(r["log"])
    theirs = pory.board_states(r["log"])
    if not mine or not theirs:
        continue
    for i, (t, a1, a2, h1, h2) in enumerate(theirs):
        if 2 * i >= len(mine):
            break
        v = mine[2 * i][0]           # index 0 of each pair is the p1 perspective
        if abs(v[IX["me_alive"]] - a1) < 1e-6 and abs(v[IX["foe_alive"]] - a2) < 1e-6:
            agree += 1
        else:
            dis += 1
ok(dis == 0, f"alive counts match pory.board_states exactly ({agree} states, {dis} disagreements)")

# ---- 2. the bugs that were actually shipped -------------------------------------------------------
enc = [encode_log(r["log"]) for r in rows]
flat = [v for g in enc for v, _ in g]
ok(len(flat) > 0, f"{len(flat)} states encoded")

nz_active = sum(1 for v in flat if v[IX["me_active_count"]] > 0)
ok(nz_active > 0.9 * len(flat),
   f"active_count is populated in {100*nz_active/max(1,len(flat)):.1f}% of states "
   "(it was identically 0 — species keys were compared against 'a'/'b')")

first_turn = [g[0][0] for g in enc if g]
bad_open = [v for v in first_turn if v[IX["me_alive"]] != 4 or v[IX["foe_alive"]] != 4]
ok(len(bad_open) == 0,
   f"every game opens at 4 alive per side ({len(bad_open)} did not) — "
   "bring-4 is common knowledge, so alive is 4 minus faints, not the number revealed")

# ---- 3. no feature is dead across the whole sample -------------------------------------------------
dead = []
for name, i in IX.items():
    if all(abs(v[i]) < 1e-12 for v in flat):
        dead.append(name)
# types and weathers legitimately stay 0 if that condition never occurred in 300 games
allowed = [d for d in dead if d.startswith(("me_activetype_", "foe_activetype_", "weather_", "terrain_",
                                            "me_status_", "foe_status_"))]
unexpected = [d for d in dead if d not in allowed]
ok(len(unexpected) == 0,
   f"no unexpected all-zero feature ({len(dead)} zero overall, {len(allowed)} legitimately rare)"
   + (f" — dead: {', '.join(unexpected[:6])}" if unexpected else ""))

# ---- 4. perspective symmetry ------------------------------------------------------------------------
sym_ok = True
for g in enc[:50]:
    for i in range(0, len(g) - 1, 2):
        a, b = g[i][0], g[i + 1][0]
        # alive_diff must be exactly negated between the two perspectives
        if abs(a[IX["alive_diff"]] + b[IX["alive_diff"]]) > 1e-6:
            sym_ok = False
            break
ok(sym_ok, "the two perspectives are antisymmetric in alive_diff (a property of the game)")

labels = [y for g in enc for _, y in g]
ok(abs(sum(labels) / max(1, len(labels)) - 0.5) < 1e-9,
   f"labels are exactly balanced at {sum(labels)/max(1,len(labels)):.4f} — both perspectives are emitted")

# ---- 5. history must not leak the present into the past ----------------------------------------
# The lag features are appended AFTER a turn is encoded. If that order is ever reversed, lag1
# becomes a copy of the current value: the model would score brilliantly and be reading its own
# answer back. A perfect correlation between hp_diff and hp_diff_lag1 is the signature.
pairs = [(r[IX["hp_diff"]], r[IX["hp_diff_lag1"]]) for g in enc for r, _ in g]
mid = [p for p in pairs if abs(p[0]) > 1e-9]          # ignore the flat opening turns
identical = sum(1 for a, b in mid if abs(a - b) < 1e-12)
frac = identical / max(1, len(mid))
ok(frac < 0.98,
   f"hp_diff_lag1 is not a copy of hp_diff ({100*frac:.1f}% identical over {len(mid)} states) — "
   "if this hits 100% the history is leaking the current turn and every score is inflated")

# ---- 6. belief features stay in range ----------------------------------------------------------
# top_p and entropy are normalised probabilities; coverage is prior mass. All must sit in [0,1] or
# the priors file is being misread.
bad = []
for nm in ("me_belief_top_p", "me_belief_entropy", "me_prior_coverage",
           "foe_belief_top_p", "foe_belief_entropy", "foe_prior_coverage"):
    vals = [r[IX[nm]] for g in enc for r, _ in g]
    if min(vals) < -1e-9 or max(vals) > 1.0 + 1e-9:
        bad.append(f"{nm} [{min(vals):.3f},{max(vals):.3f}]")
ok(not bad, "belief features are all within [0,1]" + (f" — out of range: {', '.join(bad)}" if bad else ""))

# ---- 7. belief actually moves as information is revealed ---------------------------------------
# prior_coverage should RISE over a game: every move used narrows what remains unknown. If it is
# flat, the revealed-move tracking is not wired to the belief calculation.
rose = 0
tried = 0
for g in enc:
    if len(g) < 8:
        continue
    early = g[0][0][IX["foe_prior_coverage"]]
    late = g[-2][0][IX["foe_prior_coverage"]]
    tried += 1
    if late > early:
        rose += 1
ok(tried and rose / tried > 0.7,
   f"foe_prior_coverage rises over the game in {100*rose/max(1,tried):.0f}% of games — "
   "revealed moves are narrowing the belief")

print(f"\nSTATE ENCODER TESTS: {P} passed, {F} failed")
sys.exit(1 if F else 0)
