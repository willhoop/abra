# Plan — what MEDICHAM needs before Showdown can be dropped

Written 2026-08-28 by the coordinator. **This is a plan, not a measurement.** Every figure in it was
read from an artifact this session. Re-derive before acting on any of it —
`node engine/status.js`, `node engine/open_work.js`, `node tests/probe_uncompared_leaves.js`.

## THE BAR

Showdown becomes optional when the comparator has checked everything that can change a board and found
nothing. It is not optional today, and the reason is not that the engine is wrong — it is that the
instrument reads less than half the board.

Read this session, 2026-08-28:

| | |
|---|---|
| gate | 8 of 8 PASS, OPEN (verified by re-running `engine/quarantine.js`) |
| census | 780 probed / 780 live / 0 missing |
| board comparator | **33 of 80 leaves compared**, 4 declared uncomparable, 43 read by nothing |
| damage differential | 0 of 6000 — with `skipped_multihit` **134**, so it has never run a volley |
| mechanics never fired in the harness | **67** |

## CORRECTION TO A NUMBER GIVEN VERBALLY

Will was told the target was "widen from 33 to 80". That is wrong, and the probe already says so.
Of the 43 uncompared leaves, **18 carry a declared duration of 1** and are ended in the residual
(`sim/battle.ts:1097-1115`), so they cannot be standing when the comparator reads a turn boundary —
comparing them would compare two empties every turn. Plus the 4 already declared uncomparable.

**The honest target is 33 -> 58.** The 25 are the leaves with a clock of 2+ turns or no clock at all.

**THIS IS AN ASSUMPTION TO TEST, NOT A CONCLUSION.** It rests on the comparator only ever reading at a
turn boundary. Phase 1 must verify that before anything is scoped around it. If any read happens
mid-turn, some of the 18 become comparable and the target moves.

## PHASE 0 — IN FLIGHT

| | |
|---|---|
| Metronome item consumer | ENGINE, dispatched. Will's instruction, asked for weeks ago and never landed. |
| multi-hit above 2 hits | ENGINE, scoping. |
| the Metronome owner shelf in `tests/roster.js:1263` | ENGINE, comes out once the consumer lands. |

Nothing below starts until Phase 0 reports. Both touch the engine, and every engine edit moves the
release id and re-stales every measurement in flight.

## PHASE 1 — THE NAME MAP (derive it; do not guess)

**Nothing can be widened until we know what our engine calls each leaf.** Of the 43 uncompared, the
probe reports our engine holds only **3** under Showdown's own volatile name — `lockon`, `minimize`,
`noretreat`. The other 40 are implemented under internal names (`_mtLock` for the rampage lock,
`_reached` for recharge, and so on). That is a naming mismatch in the INSTRUMENT, not a gap in the
engine, and it is why the probe cannot see them.

Deliverable: a derived table, leaf -> our address, for all 43, computed at run time so it cannot rot —
the same reason `status.js` and `where.js` exist. Plus the boundary check above.

Owner: ENGINE. Plays no game, so it is safe beside other work.

## PHASE 1 RESULT — MEASURED 2026-08-28, AND IT CORRECTS THIS PLAN TWICE

`tests/probe_leaf_name_map.js` (new, derives at run time, shells out to
`probe_uncompared_leaves.js --json` so the two cannot disagree about what the hole is).
Full account: `docs/_reports/2026-08-28-leaf-name-map.md`.

**The target is 33 -> 56, not 33 -> 58.** The plan said 58 by subtracting only the 18 duration-1
leaves. Two more are removed inside their own action and can never stand at a boundary either —
`fling` (`condition.onUpdate`) and `sparklingaria` (`onAfterMove`). 18 + 2 + 23 = 43.

**The boundary claim HELD.** `BS.snapshot` is called once in the repo, from `stateCheck`, from two
lines (`:3803` leads, `:4090` post-residual / post-forced-switch). No other file calls it. Inverse
test passes: 0 of the 33 already-compared leaves are duration-1.

**41 of 43 MAPPED, 1 ABSENT, 1 NO-STATE.** The coordinator's reading was right — `ours_vol: false`
means we spell it differently. Internal names are wider than assumed: `_recharge`, `_preTurn`,
`_took`, `_lock`, `_metroN`, `_flingBP`, `_hadItem`, `_aswDur`, `_noSound`, `_typeWas`, `_redirect`,
`field.sgA`, `field.magicRoom`, `sf.slot[i].when`, plus a generic `_vol[<authority name>]` table the
parent probe's grep structurally could not see.

**ONE GENUINE ABSENCE, AND IT IS NOT IN ANY GROUP BELOW: `volatile:flashfire`.** `absorbGift` drops
the gift and counts it (`MEDFAILS.absorbGiftUnmodelled`, `medicham2-browser.js:14838`). It does NOT
contradict the census — there is no census row for it, and it is a stated remainder in ROADMAP #432.
What is new is its reach: **1,177 pool games, 5th of the 23 comparable leaves.** It needs the ENGINE
fix BEFORE its leaf is wired, or the batch's divergences are unattributable.

**THE GROUP ORDER DID NOT SURVIVE THE POOL.** Reach measured over `data/team-pool-frozen`:

| leaf | pool games | plan said | should be |
|---|---|---|---|
| `choicelock` | 9,488 | group 2 | **group 1, first** |
| `throatchop` | 5,023 | group 5 | early |
| `unburden` | 4,121 | group 5 | early |
| `mustrecharge` | 3,696 | group 1 | holds |
| `lockedmove` | 102 | group 1 | demote |
| `gravity` / `wonderroom` / `magicroom` | 119 / 15 / 5 | group 4 | bottom |
| `lockon` / `powertrick` / `powershift` | 0 | group 5 | last, or never |

**AND THE FOUR BIGGEST LEAVES IN THE HOLE CAN NEVER BE COMPARED AT ALL** — `protect` 17,344,
`flinch` 14,366, `ragepowder` 9,690, `helpinghand` 6,334 are all duration-1. That is a real limit on
what widening the comparator can ever prove, and it belongs in the coverage reporting rather than
being discovered later by somebody reading the probe.

**REVISED PHASE 2 ORDER:** flashfire (engine fix first) -> `choicelock` -> `throatchop` + `unburden`
-> `mustrecharge` -> the delayed effects (`wish`, `futuremove`, `healingwish`) -> `lockedmove` and the
rest -> the field rooms and the zero-reach leaves last.

**Two rules over-matched before they were wired**, both caught by printing the matched set rather
than trusting the rule: the tag route produced 5 false mappings including handing `flashfire` an
address it does not have, and the within-action rule initially caught `lockedmove`'s CONDITIONAL
`removeVolatile`. Both guards and both matched sets now print on every run.

## PHASE 2 — WIDEN THE COMPARATOR, IN ORDERED GROUPS

**Not all at once.** Adding 25 leaves in one pass would light up an unattributable flood, which is the
failure the small-batch rule exists to prevent. Order by decision impact, highest first:

1. **the multi-turn lockouts** — `mustrecharge` (6 writers), `lockedmove` (4). If these are wrong the
   engine believes a body can act when it cannot. Decision-changing, not narration.
2. **`choicelock`** — Choice Scarf. Wrong here and the engine believes a body has moves it does not.
3. **the delayed effects** — `wish`, `futuremove`, `healingwish`. They land turns later, so an error is
   invisible on the turn it is made.
4. **the field rooms** — `gravity`, `magicroom`, `wonderroom`. Long clocks, whole-turn consequences.
5. **the rest** — `unburden` `flashfire` `gastroacid` `smackdown` `powertrick` `powershift` `stockpile`
   `minimize` `noretreat` `lockon` `throatchop` `allyswitch` `dragoncheer` `sparklingaria` `fling`
   `metronome`.

Per group: add to `engine/board_state.js`, re-run the whole-game differential under a pinned release,
attribute every new divergence to the group that produced it, fix or file, then move on.

**EXPECT THE GATE TO REOPEN.** That is the point of the exercise and it is success, not regression. A
widened comparator that finds nothing was worth running; one that finds something was worth more.
Neither outcome is a reason to narrow it again.

State which scoreboard each group should move BEFORE running it — the pinned pool answers *does this
matter*, the roster and census answer *is this correct*. A rare leaf moving the lab and not the pool is
the expected result, not an anomaly.

## PHASE 3 — THE MECHANICS WITH NO CONSUMER

Batches of one, so a bad result is attributable.

| | |
|---|---|
| Sand Force + Hustle | ROADMAP #312 — **one shared consumer** (base power + type + weather). Land together and measure both; #312 is explicit that landing them apart makes a bad result unattributable. |
| Shell Side Arm | #312. `onModifyMove` recomputes physical vs special off RAW stats and flips category. No tag exists for this shape, so a tag may have to be derived first. |
| Trick vs Sticky Hold | #327. `immunityGate` unread; Sticky Hold has **0 uses in 198,840 sheet entries**. |
| the Minimize punisher | #327. `punishesMinimize` on Heavy Slam and Body Slam. Reach is Minimize's **32 sheet entries**, not Heavy Slam's 467 — rank by the mechanic's reach, never the carrier's. |

Each gets a `MEDI_*` knob restoring the defect, so the test that catches it can be shown RED first.

## PHASE 4 — MULTI-HIT ABOVE TWO

Scoped in Phase 0. Two separable halves: teach the damage differential to run the volley loop
(`skipped_multihit` 134 -> 0, or explained in the headline rather than in a field nobody reads), and
reach hit counts 3/4/5 in the roster, which today pins every multi-hit row to 2.

## PHASE 5 — THE 67 THAT HAVE NEVER FIRED

Currently a harness gap, correctly not counted against the gate. It is also 67 mechanics with no
evidence in either direction.

Fixtures first, and this repo has paid twice for getting fixtures wrong: a `COULD-NOT-STAGE` verdict is
a claim about the fixture and never about the mechanic, and a cell immune for two reasons proves
nothing. Expect most to be staging problems and a few to be real.

## PHASE 6 — THE CLEAN RUN, AND THE DECISION

One pinned release. All three pins — `--release`, a census pin,
`--team-store data/team-pool-frozen`. Prove the samples are identical rather than assuming: same
protocol classes, same first-divergence list, same coverage block.

Then Will's question is answerable as a measurement rather than a guess: with the comparator reading 58
leaves instead of 33, does anything still part?

## WHAT THIS PLAN DOES NOT COVER

- **The quarantined re-runs (ROADMAP #57).** R1-R4, leaf calibration, click censoring. Deliberately not
  scheduled — most die when Will reworks MILTANK and MAG, and re-running them first is work thrown away.
- **MAG and MILTANK.** Will's, and paused. Not dispatched at.
- **Narration.** Will's ruling of 2026-08-22 stands: board-material is the bar, and narration is a
  separate gate afterwards so the work is not silently abandoned. Nothing here changes that.

## STANDING RULES FOR EVERY PHASE

- One agent may play a game at a time. Everything else parallelises.
- Batches of one on engine fixes.
- Every engine edit moves the release id and re-stales every in-flight measurement.
- Living docs and CHANGELOG in the same pass, then `node engine/status.js --write`.
- Read output SIZE and the artifact `generated` stamp. Never the exit code.

## OWED, NOT RUN

State, re-derived at the start of any session picking this up:

```
node engine/status.js
node engine/open_work.js
node tests/probe_uncompared_leaves.js
```

Phase 1, not yet dispatched — the name map and the boundary check:

```
node tests/probe_uncompared_leaves.js --json
node engine/where.js --gates
node engine/where.js --artifacts
```
