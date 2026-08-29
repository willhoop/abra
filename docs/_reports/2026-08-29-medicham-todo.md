# MEDICHAM — the to-do list and the plan to finish

Written 2026-08-29 by the coordinator, from artifacts read this session. **Re-derive before acting:**
`node engine/coverage.js`, `node engine/status.js`, `node engine/open_work.js`. An ENGINE agent is
live as this is written, so the census count in particular is moving.

## THE DEFINITION OF DONE

`node engine/coverage.js` prints nine derived counts. **MEDICHAM is finished when the right-hand
numbers are met and the empirical arm's board-material count is zero.** No judgement call, no
argument, one command.

| count | now | done at | notes |
|---|---|---|---|
| board leaves compared | **34 of 56** | 56 | 56 is the CEILING; the other 24 of 80 can never be standing when the board is read |
| staged mechanics that fired | **663 of 760** | 760 | 97 have never executed in the harness |
| mechanics with a board compared | **739 of 964** | 964 | a row with no board is a mechanic whose EFFECT nothing compared |
| tags with an engine consumer | **269 of 300** | 300 | 31 tags no line of the engine reads |
| tags with a census probe | **285 of 300** | 300 | |
| moves the damage diff can compare | **486 of 500** | 500 | 14 multi-hit, skipped by construction |
| ranged mechanics fully staged | **0 of 8** | 8 | the arms reach the ENDS of a range, never the interior |
| bodies on a REAL spread | **0 of 17,536** | — | scope, not a target: sheets carry no SP, so spreads are invented. See below |
| driver policies the gate quotes | **1 of 2** | 2 | the gate certifies on the arm where games do not end |

Plus the one that is not in `coverage.js` because it is the gate's own subject:

| | now | done at |
|---|---|---|
| empirical arm, board-material games | **117 of 961** | 0 |

## THE WORK, IN ORDER

### 1. The cards — the main body of the job

`docs/_reports/2026-08-29-empirical-divergence-cards.md` groups the divergences into 36 mechanism
families. Will reviews the rendered cards (`engine/divergence_cards.js` against
`data/verification/divergence-turns.empirical-after.json`) and the queue is worked in **batches of
one**, each with a `MEDI_*` knob shown RED before the fix is trusted.

Done: **A1/A2 the forced-switch mirror** — settled as the HARNESS, board-material 135 -> 117.

In flight: **B1 weight-based base power**, 12 games, the biggest genuine engine group.

Queued, largest first: **C1** Parting Shot ignores Follow Me / Rage Powder (7 games, and it explains
a 30-game `boosts.atk` leaf family) · **B3** multi-hit stops after fewer hits (7) · **D1** Innards Out
has no implementation at all (6) · **F1** Encore relocates the encored body's action (3, explains an
11-game `stall` family) · **#531** Parting Shot's pivot is unconditional where the authority gates it
on the drop landing · then the long tail of 1-2 game cards.

### 2. Widen the comparator, 34 -> 56

**22 leaves left**, not 46. Ordered by measured pool reach, not by intuition — the original order did
not survive contact with the data. `choicelock` (9,488 pool games) is done and lit up nothing.
Next: `throatchop` (5,023), `unburden` (4,121), `mustrecharge` (3,696), then the delayed effects
(`wish`, `futuremove`, `healingwish`), then `lockedmove` (102) and the field rooms (119 / 15 / 5), and
`lockon` / `powertrick` / `powershift` (zero reach) last or never.

One leaf at a time, re-run, attribute. **Expect the gate to reopen** — that is the instrument working.

### 3. Point the gate at the empirical arm

**Currently the gate certifies on `census-coverage-seeking/v1`, where 98% of games never end.** Until
that changes we keep issuing a clean sheet for the wrong scoreboard. Deliberately held until the cards
are worked, so the gate does not sit red with 117 unattributed divergences behind it — that is the
"one of the two known failures" state this project has a rule against.

**Both arms ship.** 48 legal moves are clicked ZERO times in 21,726 real games, so the empirical
driver cannot replace the coverage-seeker.

### 4. The named tail — all diagnosed, none started

- **Sand Force + Hustle** — ROADMAP #312, ONE shared consumer (base power + type + weather). Land
  together; #312 is explicit that landing them apart makes a bad result unattributable.
- **Shell Side Arm** — #312. Recomputes physical vs special off RAW stats and flips category. No tag
  carries this shape, so a tag may need deriving first.
- **Trick vs Sticky Hold** and the **Minimize punisher** — #327.
- **Multi-hit interior**, counts 3 and 4 on 8 moves. The arms reach 2 and 5; nothing reaches between.
- **97 mechanics that have never fired.** Fixtures first — a `COULD-NOT-STAGE` verdict is a claim
  about the fixture and never about the mechanic.

### 5. Two instrument gaps

- **27 games still truncate** on an unmirrorable placement (down from 42). 19 are genuinely parted
  boards, the rest are downstream of other carded defects.
- **The winner rule is reachable for the first time** and reads 0 of 99 differing boards over 459
  resolved games. One sample, not a proof. ROADMAP #362's simultaneous-double-wipe defect is exactly
  what this would catch.

### 6. Then the clean run, and the decision

One pinned release, all three pins, samples proved identical rather than assumed. If the empirical
arm's board-material is zero and `coverage.js` is complete, Showdown becomes optional as a
**measurement**, not a guess.

## WHAT WILL NEVER BE COVERED, AND MUST BE SAID RATHER THAN DISCOVERED LATER

- **24 of the 80 leaves can never be compared.** They are gone before the board is read — including
  the four highest-reach ones in the hole (`protect` 17,344 pool games, `flinch` 14,366,
  `ragepowder` 9,690, `helpinghand` 6,334).
- **No body in the differential runs a real spread.** Sheets carry nature and `evs: null`, so
  `spreadFor()` invents one — 66 points, 32 cap, a Speed ladder, nothing into HP. Both engines get the
  SAME invented spread, so every divergence is still a rule; but the damage figures are internally
  consistent and are **not metagame damage**.
- **The differential never compares who wins** except through the new end-state leaf.

## NOT ON THIS LIST, DELIBERATELY

- **The quarantined re-runs** (ROADMAP #57) — R1-R4, leaf calibration, click censoring. Most die when
  Will reworks MILTANK and MAG; re-running them first is work thrown away.
- **MAG, MILTANK and PORY.** Will's, paused, and under his standing instruction of 2026-08-29 their
  output may not be quoted or built on at all.
- **Narration.** Will's 2026-08-22 ruling stands: board-material is the bar, narration is its own gate
  afterwards so the work is not silently abandoned.

## OWED, NOT RUN

```
node engine/coverage.js
node engine/status.js
node engine/open_work.js
node engine/divergence_cards.js --in data/verification/divergence-turns.empirical-after.json --out divergences-empirical-after.html
```
