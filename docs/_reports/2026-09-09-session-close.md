# Session close — 2026-09-08 evening through 2026-09-09 midday

Historical by construction. **Every figure here is derived; re-derive rather than quoting this file.**
`node engine/status.js` and `node engine/major_readiness.js` print the current state.

## What this session did, in one line

**Board-material held at 0 of 958 for eleven consecutive batches while narration went 52 → 12 of 961**,
two board defects were found and fixed, one red test was returned to green with all six of its anchors
re-aimed, and the 6.0.0 scope stopped being assembled by hand.

## OWED — commands, not prose

**Three reports in this session carried no `OWED` heading, so `engine/orient.js` could not collect
them**: `2026-09-08-narration-batch-R.md`, `2026-09-09-narration-batch-U.md`, `2026-09-09-batch-V.md`.
Their open items are consolidated here rather than back-dated into those files.

### Board-material work, which outranks the narration tail

```bash
# 1. THE SCREENS HALF OF `ignoresScreensAndSubs` HAS NO PROBE AT ALL.
#    The tag is named for screens AND subs. Nine live census rows stage the SUBS half
#    (paired: a substitute refuses X, and the ability does X through it). ZERO rows pair the
#    ability with Reflect, Light Screen, Aurora Veil, Safeguard or Mist — all five checked.
#    A bypassed screen is a doubled damage roll, so this is BOARD-MATERIAL, unlike most of the
#    narration tail. Expect the lab to move and the pool to sit still.
#    Add the probes, then:
tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release <id>
```

### The narration tail — 13 causes, and 7 of them are two clusters

```bash
# 2. THE SUBSTITUTE FAMILY (4 causes) HAS A PLAN FOR THE FIRST TIME IN FIVE BATCHES.
#    NOT a step-list problem, which is what four batches believed. A step-0 doll slot IS
#    constructible and probably costs no dice, but fixes ARRIVAL 1 ONLY: this engine's arrival
#    loop lives INSIDE `_stepApply` while the authority's is OUTSIDE `spreadMoveHit`.
#    THE FIX: make the arrival loop the OUTER loop over the `_stepDamage` … `_stepAfterHitField`
#    segment — the same segment already looked up dynamically for `smartTarget`.
#    ONE NAMED TRAP: `_stepUpdate`.
#    THE RECEIPT: `test-resolution-order`'s declared KNOWN-OPEN arm closes.
#    Most dangerous edit available; check board-material between stages, not at the end.

# 3. SPICY SPRAY IS UNBLOCKED. It was deferred on a dice argument, and batch X proved the
#    premise false: `DamagingHit` sorts by `compareLeftToRightOrder` (order, priority, target
#    INDEX — deterministic, no die), NOT by `speedSort` as the engine's own comment claims.
#    Correct that comment and the `electromorphosis` one beside it in the same pass.

# 4. THE RESIDUAL TRIO — brn<>brn, psn<>psn, leftovers<>leftovers. SIX batches, two deliberate
#    fixtures, and a Speed read: 70/70, 60/60, 65/75. Two ties and one that is NOT, so it is not
#    one mechanism. UNEXPLAINED, and correctly given no clean bill. Skip unless genuinely new idea.

# 5. Left with derivations rather than guesses, by batches U/V/X:
#    - Trick's `-fail` — blocked on a mega-stone guard coarser than the authority's; tightening
#      it moves a board
#    - the perish `|upkeep|` drain — a miss inside an existing model, next step named
#    - post-KO switch order — the authority's sort key is the FAINTED body's Speed, not the
#      arriving one's
#    - `kind === 'boostally'`'s silent shield
```

### Instrument and hygiene debt

```bash
# 6. A RELEASE RE-CUT IS OWED. Releases cut between 02:54 and 03:55 froze a NEW data/tags.json
#    beside the OLD data/abra-tags.js. Both are frozen SOURCES. Under node this changed nothing
#    (`engine/tags.js:56` requires tags.json; the browser copy is only read on the browser path),
#    so measurements from that window stand — but 6.0.0 must not rest on an inconsistent snapshot.
tools\lownode.cmd engine\engine_release.js cut "tags.json and abra-tags.js back in agreement"

# 7. A PROBE THAT LOADS engine/game_differential.js WITHOUT --release CUTS A RELEASE AS A SIDE
#    EFFECT. Batch T created 17 stray release directories this way; `tests/probe_trap_timing.js`
#    refuses outright, the `staged_board` harness does not. data/releases is gitignored, so this
#    is disk growth rather than repository growth. Not fixed.

# 8. THE 14 CONTROL-NOT-QUIET ABILITIES — the roster's real debt, where the control arm is itself
#    a live ability so the delta cannot be charged to the entity. Lab work; the pool will not move.

# 9. NEVER RUN. The npm oracle switch (approved and proven safe: legal sets identical, 3 tier
#    labels differ). `data/register-reality.json` regeneration. The M-C leftovers:
#    `engine/names.js megaTable()` holds 74 entries against 76 legal formes; the oracle pin goes
#    null under npm because of a caret range in sim/package.json.
```

### 6.0.0

```bash
tools\lownode.cmd engine\major_readiness.js     # the whole scope, derived
```

**It says NOT READY while the gate is shut, and it will not offer a third state.** When it opens:
the re-run is **25 commands, and 18 must NOT run** — two of them (`engine/fit_policy.js`,
`engine/fit_joint.js`) write the vector Will reserved for a refit sequenced after 6.0.0. Plan:
`docs/_reports/2026-09-09-quarantine-rerun-plan.md`.

## RED AND UNWAIVED

**Nothing.** `tests/test-resolution-order.js` was red at 10 of 26 when this session found it and is
now **0 of 26, exit 0**, with all six stale PLANT anchors re-aimed and reading CAUGHT — none retired,
because every one still described reachable behaviour.

Carried openly from before this session, unchanged and not re-checked here:
`tests/test-docs-quarantine`, `tests/test-pinch-family` (1 of 61), `tests/test-quality` (1 of 31), and
`status.js`'s FEATURE SEMANTICS on the MAG weights — which is quarantined by the owner's sequencing,
not broken.

## THE ONE THING THE NEXT SESSION SHOULD NOT BELIEVE

**`BOARD-MATERIAL 0 of 958` does not mean no board difference occurred.** It means none *survived to a
compared boundary*. Measured this session: about **1 in 10** narration cards is a board difference
erased within the turn — a rate that was first published as 1 in 6 and **retracted** when the ten-line
`--dump-games` window turned out to have faked one of the two survivors.

It is also measured on a pool of REAL LADDER TEAMS, so it is silent on any mechanic nobody brought.
The census and the roster are the only instruments that cover that tail, and this session found a
tag whose *name* supplied coverage its probe did not.
