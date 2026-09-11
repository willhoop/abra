# 2026-09-11 — ENGINE: the gate's last clause (#318) and the reds on b42/e368

Historical findings record (see CLAUDE.md, `docs/_reports/` is never maintained). Release cut: **`9ec2ab9ad0ef`**.

## Verdict

- **#318 closed.** `node tests/probe_roster_learnset_refusals.js --release 9ec2ab9ad0ef` → **GREEN, 0 refused
  pairs** (43 on `b42b81899631`; 420 under `ROSTER_LEARNSET_UNREPAIRED=1`, RED).
- **Engine defect found and fixed by the legal fixture:** a sleep the residual walk sets (Yawn) was never offered to
  its `onUpdate` cure (Chesto Berry) before the turn ended. `MEDI_WALK_STATUS_UNCURED=1` restores it.
- **Red tests fixed:** `tests/test-mutation-coverage.js` (instrument), `tests/probe_arrival_drift_zero.js`
  (instrument: declared parting had closed), `tests/probe_upkeep_lines.js` (instrument tie fixed; engine gap filed
  as #601 with declared arms).
- **Cost, stated:** two ability rows narrow — Sand Rush and Stench read COULD-NOT-STAGE on their only legal
  stagings; the Stench rule's one red demonstration goes with it (43 of 43, was 44 of 44).
- **Gate:** see the GATE section at the end.

## 1. #318 — by rule, not by row

`tests/roster.js` now asks `learnsLegally` (the TeamValidator judge `fixtureAudit` uses) before a rule picks a move
for a named body or a body for a move. New helpers in the block above `restageLegal`: `learnableOfType`,
`learnerBody` (quiet CANDIDATES first; a `wide` tier using the restaging pass's own `wideAbility` judgement),
`throwerFor`, `sleepClick` (derived: the in-scope status move whose condition sets sleep when it ends — Yawn),
`dropCoverSplit`. Thrower-aware variants: `neutralHit2(…, by)`, `neutralContactOn(…, by)`, `lethalMove(…, by)`
(table moves first, so an already-legal pick is kept), `hitInBand` (same), `chipFor(…, byId)`,
`boostSettersFor`. `STATUS_MOVE`, and the absorbs-a-type candidates, take only in-scope moves
(`engine/legal_scope.js`). Module-load derivations (KILLABLE/KILLABLE2 via a derived `KILL_ATT`, HALVER) are
learnset-aware; the judge's caches moved above them to avoid a temporal dead zone.

Rules changed: item/status-cure, item/species-locked-stat, item/resist-berry (KO flip re-sized for the actual
thrower), item/drain-scaled, item/super-effective-power, item/hp-floor (every hit from the body it was sized
for, one per turn), ability/stat-drop-reaction, ability/aids-its-ally, ability/blocks-priority (PRIORITY_HITS),
ability/absorbs-a-type, ability/type-conversion, ability/no-recoil, ability/base-power-scoped,
ability/adds-its-own-secondary-by-chance, ability/refuses-indirect-damage, ability/priority-mod, weather-speed and
speed-on-item-loss (via `speedFlipFoe`: the foe's drop must lower the stat the holder's KO uses),
move/needs-a-stat-stage-to-act-on, move/needs-a-berry-already-eaten, the-user-faints…, move/heal, protect-family,
and `abilityScenario`. The restaging pass stages an entity whose only legal learners are in the owner's closet
on that learner (Bitter Malice, Night Daze — both still FIRED-AND-BOARDS-MATCH). The knob now also makes
`learnsLegally` answer yes, so it restores the pre-#318 fixtures.

Roster on `9ec2ab9ad0ef` (`--reds --write`), against `b42b81899631`:

| stage | b42 | 9ec2 | DIFFER / DID-NOT-FIRE | reds |
|---|---|---|---|---|
| items | 142 MATCH, 6 CNS | 142 MATCH, 6 CNS | 0 / 0 | 18 of 18 |
| abilities | 139 MATCH, 43 CNS, 13 CNQ, 5 DEF | 137 MATCH, 45 CNS, 13 CNQ, 5 DEF | 0 / 0 | 43 of 43 (was 44) |
| moves | 486 MATCH, 8 CNS, 3 DEF | 486 MATCH, 8 CNS, 3 DEF | 0 / 0 | 36 of 36 |

The two narrowed rows:
- **Sand Rush.** No Sand Rush carrier learns a KO on a foe in its window except Excadrill (X-Scissor); that board
  reads INERT with either a Charm or a Fake Tears foe. Not diagnosed further — a claim about the fixture.
- **Stench.** Garbodor is its only legal carrier. Its legal secondary-free clicks give no die under 0.10 inside the
  PP-bounded window (the previous exception, an illegal Dragon Claw, was one of the 43 pairs). A 16-turn window
  found Seed Bomb at turn 16 but ran the victim's click out of PP; the window is now bounded by both clicks' PP.

Intermediate regressions caught and cleared before the final runs: chestoberry DIFFER (→ engine fix),
Overcoat/Parental Bond/Unburden/Tough Claws/Good as Gold/Stance Change/protect-family ×6/Focus Sash lost staging
(→ wide thrower tier, resisted-before-SE fallback, stat-matched drop, either-category negative, KILL_ATT).

## 2. The three reds

- **test-mutation-coverage.** Gate green on `7da11c1d4d10`, red from `c66976713feb` (bisected). That release added
  `noteFaint()`, stamping `_fEpoch/_faintSeq` from a process-global counter; the harness projection read them, so
  every mutant differed from the reference. Excluded from `MON_SKIP`; `MUTATION_PROJECT_ORDER_STAMPS=1` → red
  (LIVE/LIVE). 6 passed, 0 failed.
- **probe_arrival_drift_zero.** CTRL-D's declared crit parting (authority 1, us 0) had closed: both draw it on
  b42, HP series identical [130,69,41,13]. Now a red arm (`part:true, moves:true`); clean green, `--red` green
  (parts [130,84,56,28]).
- **probe_upkeep_lines.** Bare board and White Herb parted AFTER the window at a replacement Intimidate between two
  95-speed Arcanines on opposite sides (fixture tie) — p2's bench is now two more distinct-speed bodies. Hunger
  Switch and uproar part at the follower's own line on a body perish zeroed (authority runs later residual
  handlers until `faintMessages`; we set `fainted` at `queueFaint`) — filed **#601**, declared arms assert the exact
  parting. 49 arms, 0 not as expected, exit 0.

## 3. register_reality exit

Not reproduced from the file: every full-run path already ended `process.exit(1)` on a disagreement. All verdict
paths now go through `exitWithVerdict`, which prints `EXIT.declaration(code, kind)` (stderr for `--json`), sets
`process.exitCode` and exits. Selftest 84 of 84. Rows it named that are mine: #318 (closed here); #440 and #541
(markers pinned `aefcb93baf14`, which declared CANNOT-ANSWER) re-pinned to `9ec2ab9ad0ef`, where both instruments
answer GREEN — this is what held the open-defect clause at CANNOT ANSWER once #318 closed.

## 4. Supreme Overlord declaration — KEPT, cause shown

First withdrawn on the "MATCHED NOTHING IN THIS RUN" print. The next gate run then failed the MECHANICS clause:
`1 of 5 DIVERGING MECHANICS ARE PLAYED AND UNCLEARED … ability:supremeoverlord (112 teams/13,116 open-sheet games)`.
One declared list feeds two clauses; the print counted only the whole-game clause (961 games, none of which switch
a Supreme Overlord out with nothing fainted) while `data/all-mechanics-fire.json` carries the diverged
ability:supremeoverlord row whose cause is `fallenundefined`. The declaration is restored, and
`declaredRegisterLine` now counts mechanics-clause matches (`mechanicsCovered`), printing "LOAD-BEARING IN THE
MECHANICS CLAUSE" instead of MATCHED NOTHING. The CLASH selftest still pushes its own declaration.

## 5. Focus Band fixture

`tests/probe_volley_collapse.js` route 3b (`bottom-tie-first`, frail targets first, natural HP): Heracross Bullet Seed
into a Focus Band Sharpedo, the band answering the second arrival. Clean: all 7 rows green (activate 1/1, HP 1/1).
`MEDI_HITCOUNT_DROP_ON_COLLAPSE=1`: activate 1/0, hitcount 2/null, HP 1/59, fainted false/true — RED.

## 6. ROADMAP step count

Lines 73 and 533 withdrawn (sentence kept). Line 1370's "11 of 24" is a different probe and stays.

## Census

`data/mechanics-census.json` 883 live, 0 missing (unchanged).

## Releases cut

- `9ec2ab9ad0ef`

## GATE

`node engine/quarantine.js` (run by ENGINE after the six gating artifacts were re-measured on `9ec2ab9ad0ef` and a
full `engine/register_reality.js` run republished `data/register-reality.json`):

    GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld

All nine gating clauses PASS: game differential clean at every corner (0 of 6000 each, seed 20260804); roster items
142 of 148, abilities 137 of 200, moves 486 of 497 clean; coverage 412 of 412 moves above 25 clicks; board-material
0 of 961 games; narration 0 undeclared (1 raw, 1 declared); mechanics 0 uncleared (5 diverge, 1 declared, 4 below
the reach shelf); no open row backed by a RED instrument (183 verdicts read).

Two intermediate gate runs are recorded so the path is visible: after the release cut every gating artifact read
MEASURED AGAINST A DIFFERENT ENGINE (7 of 8 failing) and the open-defect clause read CANNOT ANSWER on #440/#541;
after re-measurement the mechanics clause failed on the withdrawn Supreme Overlord declaration (1 of 9), which was
then restored with its cause shown.

**Per CLAUDE.md the gate opening is the archetypal MAJOR.** This row is written as 6.24.0 as briefed; the version
and the major's document fold-in are the coordinator's call.
