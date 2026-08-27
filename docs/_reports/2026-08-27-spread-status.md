# Spread STATUS moves run the step list, not the gauntlet — ROADMAP #448

**ENGINE, 2026-08-27.** Release `ee4e537b7255` (cut for this change). Probe:
`tests/probe_spread_status_steps.js`.

## Headline

| | before | after |
|---|---|---|
| **mechanics clause** | **8 of 16** | **5 of 12** |
| whole-game clause (`games − declared`) | 9 of 961 | 9 of 961 |
| board-material (`games − games_board_never_diverged`) | 1 of 961 | 1 of 961 |
| census (`data/mechanics-census.json`) | 754 live / 754 probed / 0 missing | 754 / 754 / 0 |
| roster items / abilities / moves | 0 DIFFER, 0 DID-NOT-FIRE | 0 DIFFER, 0 DID-NOT-FIRE |
| damage differential | 0/6000 at 16 corners | 0/300 at 16 corners (confirmation run) |

**The prediction was stated before the run and it held.** #448 was measured on 2026-08-26 as
announcement-only with **zero games in the pinned pool**, so the mechanics clause was expected to move
and the pool was expected to sit still. It did both. The pool is not a hole here; it is a fact about
the metagame — nobody in the frozen 961 clicks Cotton Spore.

## The defect

`Battle.actions.trySpreadMoveHit` (`sim/battle-actions.ts:550-577`) declares `moveSteps` as **data**
and runs each STEP across the whole target array before the next step begins. medicham2's DAMAGING
branch has been shaped that way since ROADMAP #81 WIRE 10 — `for (const _step of _STEPS) for (const R
of _rows)`. **The `a.kind === 'affect'` branch was never converted**; its own header said *"EVERY
TARGET RUNS THE WHOLE GAUNTLET ON ITS OWN"*. So a Protect on the second foe was announced after the
first foe's effect had already landed:

```
SHOWDOWN  |-activate|p2b: Charizard|move: Protect   then  |-unboost|p2a: Feraligatr|spe|2
MEDICHAM  |-unboost|p2a: Feraligatr|spe|2           then  |-activate|p2b: Charizard|move: Protect
```

That is one branch of a conversion that was done once and not finished.

## What landed

The loop was **transposed and nothing else**. The per-target sequence is byte-for-byte the sequence
this branch already ran, cut at the authority's own step boundaries into six closures over a row
`{tg, out}` — `_asGone`, `_asTryHit`, `_asTypeImm`, `_asTryImm`, `_asAccuracy`, `_asEffects` — driven
by `for (const _step of _ASTEPS) for (const R of _aRows)`. Each former `continue` became
`R.out = true; return;`, which ends that body's pass and is skipped by every later step — the
authority's `targets[i] = false`.

Twelve `continue`s were converted and six were deliberately left alone (the inner `for (const _e of
…)` effect loops). The list is in the transformation script's `EXIT` array and every one was anchored
by line and asserted to substitute exactly once.

**Knob:** `MEDI_SPREAD_STATUS_PER_TARGET=1` restores the old nesting. `MEDSEEN.spreadStatusStepOuter`
and `MEDSEEN.spreadStatusPerTargetRestored` count which nesting each `affect` move took.

## Two things NOT done, named rather than left to be rediscovered

1. **Corrosive Gas is the fifth row of the group and is NOT closed.** `playerAction` classifies it
   `trickitem`, so it never arrives in the `affect` branch at all — the engine's own header already
   said so. It still reads `-enditem before -activate`. It is 1 click in 64,846 stored games and is
   REACH-excluded from the clause, so it did not affect the count either way. It is a separate change
   at a different site.
2. **Substitute stays in the TryHit group**, where this branch has always asked it, and not in the hit
   loop where the authority asks it (`onTryPrimaryHit`, *below* accuracy). That is a second divergence
   about a different step, nothing measures it today, and moving it inside a change whose whole claim
   is that it is a transposition would make that claim false.

## The probe

`tests/probe_spread_status_steps.js`, six arms, no typed expectation — both engines play the same
script under the differential's own pin on the `bottom-tie-first` corner and the two protocol streams
are compared line for line. Every arm is played twice, clean and under the knob.

| arm | kind | clean | under the knob |
|---|---|---|---|
| `cottonspore-red` (`allAdjacentFoes`, `spe -2`, foe B behind Protect) | red | agrees | **parts** |
| `stringshot-red` (the same, 95% accuracy so `hitStepAccuracy` is a live step) | red | agrees | **parts** |
| `teeterdance-red` (`allAdjacent` — my own partner FIRST, then the foes) | red | agrees | **parts** |
| `cottonspore-nobody-shields` (identical board, Charizard clicks Swords Dance) | control | agrees | agrees |
| `single-target-into-the-shield` (Eerie Impulse at the Protecting body) | control | agrees | agrees |
| `single-target-unshielded` (Eerie Impulse at the body that is not) | control | agrees | agrees |

**Red first, and it was red.** Before the fix all three red arms read `PARTS CLEAN` on exactly the
divergence the census records, and all three controls held — so the probe distinguishes the mechanism
from the fixture.

**The knob is not trusted, it is measured.** A knob read by a module the driver never loaded changes
nothing and produces a green run that staged nothing; that has happened here before. Every arm asserts
`spreadStatusStepOuter` / `spreadStatusPerTargetRestored` as an exact per-game delta off
`globalThis.MEDSEEN` — the object the bytes the driver actually ran increment — and reads
`clean 1/0, knob 0/1` on all six. An arm whose counters do not move fails whatever the streams say.

**One instrument failure, caught by that clause.** The counters were first declared inside `MEDFAILS`
instead of `MEDSEEN`, so `MEDSEEN.spreadStatusStepOuter++` produced `NaN` on an undefined field. All
six arms already read `RED PROVEN` / `CONTROL HELD` at that point — the protocol verdict was correct
and the run still failed, which is the counter clause doing its job.

## What was re-run

| | |
|---|---|
| `tests/test-mechanics.js` | 754 live, 0 missing, 754 probed, 0 threw — **unmoved, never down** |
| release cut | `ee4e537b7255`, 26 files frozen |
| `tests/roster.js --stage {items,abilities,moves} --write` | 0 DIFFER, 0 DID-NOT-FIRE; 139 / 129 / 475 match — identical to the previous release, re-stamped |
| `engine/all_mechanics_fire.js --kind all --write` | 1,289 games, 0 threw, 0 sheets unassembled. Moves diverging **14 → 10**; abilities 4, items 2 unchanged |
| `engine/game_differential.js --games 1200 --arm middle --turns 12 --team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json --state --end-state --write` | 961 games, 14 raw diverged, board never diverged 960/961 — **unmoved** |
| `tests/test-engine-diff.js --n 300 --seed 20260804` | 0 of 300 at all sixteen corners. Publish refused (smaller sample) as designed; written to `data/verification/engine-diff.n300.json` |

The diverging move set went from
`bittermalice corrosivegas cottonspore gastroacid healbell nightdaze recycle reflecttype shellsidearm smackdown stringshot sweetscent switcheroo teeterdance`
to
`bittermalice corrosivegas gastroacid healbell nightdaze recycle reflecttype shellsidearm smackdown switcheroo`.

## OWED, NOT RUN

- `tests/interaction_matrix.js`, `engine/wire_ladder.js`, `engine/tag_dex.js` — not run, as in the
  preceding batches; all three are WITHHELD by provenance for reasons that predate this change.
- `tests/run-all.js`, `tests/staged_board.js`, `tests/bench-medicham.js --record` — not run.
- The **full 6,000-row** `tests/test-engine-diff.js` — not re-run. The change is entirely inside the
  status-move branch of `battleTurn`; `test-engine-diff.js` drives the damage function directly and
  never enters that branch. The 300-row confirmation is the evidence, not a substitute for the
  published 6,000.
- `tests/test-resolution-order.js` and `tests/test-middle-identity.js` — named RED at HEAD in an
  earlier brief; not run and not this batch's.

## Left alone, reported

- `.scratch_eng/`, `.scratch_eng_diffrun.cmd` and `stash@{0}` are another session's. Nothing in them
  was read, executed or deleted.
- `data/{archetypes,conformance,damage-validation,forme-assert,game-diff,job-costs,kad-replays,live,
  open-work,partial-label-em,provenance-stamp,published-samples,register-reality,regulation-usage,
  rulebook-collision,switch-back-renamed}.json` were already modified in the working tree before this
  batch started. None was staged.
