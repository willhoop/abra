# Reg M-C interaction matrix: the off-gate, KO-timing and thrown rows (2026-09-29)

Source artifact: `data/interaction-matrix-regmc.json` in the main checkout, generated 2026-09-29T21:21Z,
Showdown `f10d6798`, `--full`: 2328 run, 1683 live, 1683 agree, 1 ko, 2 threw, 2 off-gate.

**Verdict: all four rows were the INSTRUMENT. Fixed at the instrument (abra/regmc 1.28.1). No file under
`engine/` changed, so no Reg M-C gate figure needs a re-run because of this.** The probe
`tests/probe_regmc_matrix_offgate.js` was RED on 6 arms before the fixes and GREEN after
(`ABRA_REGULATION=regmc`, checkout `pokemon-showdown-mc`). Only single pairs were run. The full matrix,
gate, differentials and roster were not.

The work paused once at Will's stop (WIP commit `45b1c1a8`, this file only) and resumed at his "back to work".

## Item 1 and item 3 are the same row

The single KO-TIMING row is `aurawheel -> weakarmor` (bucket `ko`). It is also one of the two off-gate rows.

## Aura Wheel -> Weak Armor: INSTRUMENT (pinned dice pick different damage rolls), fixed

Staging: Morpeko (Honey Gather, no item) clicks Aura Wheel into Skarmory, and Skarmory clicks Iron Defense.
- medicham2 KO'd Skarmory in BOTH arms (Weak Armor and the Honey Gather control). The authority left it
  on 2/140 HP (fraction 0.0143) in both arms. `mediWitness` was empty, so Weak Armor was not the cause.
- Turn order agrees. `alignStats` copies medicham2's stats onto the authority's bodies: Morpeko has 156
  Speed and Skarmory 126, so Aura Wheel lands before Iron Defense in both engines.
- The dice: under `pinDice` the authority's `prng.random` is `PIN_RANDOM`, so `randomizer`'s `random(16)`
  returns 8, which is the 92% roll (`sim/battle.ts` `randomizer`: `100 - this.random(16)`). The harness gave
  medicham2 `rng = () => 0.5`, and `damageRollIndex(0.5) = 15 - floor(8) = 7`, which is the 93% roll. So
  the damage was 138 against 140, into 140 HP. Every pinned hit in the matrix was one roll apart. `hurt`
  hides that, but a hit within one roll of the target's HP does not.
- Fix (`tests/test-game-diff.js` `runScript`): under `pinDice`, medicham2 gets a stream struct. `dmg` is
  `(2*(15-PIN_RANDOM(16))+1)/32`, the centre of the bucket that maps onto the authority's index (the same
  expression `tests/probe_hp_pair.js` uses). Every other stream stays 0.5, so no chance event moves.
  Unpinned runs keep the plain function. Only the matrix passes `pinDice`, so its state evaluator is the
  only reader. The damage evaluator's medicham2 side reads `dmgRange` and does not use this rng.
- After the fix, Skarmory is left on 0.0143 in both engines, in both arms, and the pair agrees (Def +1 /
  Spe +2 in the test arm).

## Gastro Acid -> Quick Claw: INSTRUMENT (projection read the wrong field), fixed

The symptom was `.B.active[0].ability`, medi `""` against showdown `"honeygather"`, the same in both arms.
medicham2 suppresses an ability by parking it (`abSuppress`: `_abParked` holds the identity, and `ability`
is emptied so that every reader sees the suppression). Its own comment names `abilityOn(m)` as the identity
read for the board's `ability` leaf. The authority keeps `pokemon.ability` and adds the `gastroacid`
volatile, and `projShowdown` reads that. `projMedi` read raw `m.ability`. It now reads
`_abParked ?? ability`. The probe also asserts that the medicham2 body really is still suppressed
(`ability ""`, parked `honeygather`), so the fix is a read and does not hide anything.
`engine/board_state.js` already compares Gastro Acid as volatile presence, so the gate never saw this.

## Curse -> Good as Gold, Curse -> Quick Claw (THREW): HARNESS (generator), fixed

The generator gave Curse to Venusaur, because the dex `target` is `normal`. The authority rewrites a
non-Ghost Curse's request target to `self` (`sim/pokemon.ts` `getMoveRequestData`, `case 'curse'`; the
Champions mod's `curse.onModifyMove` does the same at run time). `Side#choose` then rejects any target
location. The fix is `requestTarget(mv, sp)` / `aimsAtFoe` in `tests/interaction_matrix.js`, applied to
the defender-side user pick, the attacker-side user pick and the control-carrier pick. If no learner aims
the move at a foe, the case is dropped by name. Both cases now stage on Gengar and run. `curse ->
goodasgold` is live and agrees; `curse -> quickclaw` is inert and agrees.

The same two throws, and `aurawheel -> weakarmor` off-gate, are in the Reg M-B matrix of 2026-08-11. These
are not Reg M-C traps, so there is no `docs/REGULATION-ROTATION.md` row.

## Affected-pair re-check (not the full matrix)

All state and damage cases whose carrier is Curse or Gastro Acid, or whose reactor is Weak Armor: 177
cases. 176 agree. The remaining one is `gastroacid -> disguise`, a damage-evaluator case that returns no
verdict.

## Found in passing, not fixed

`ABRA_REGULATION=regmc node tests/test-game-diff.js` passes its scripted games, then exits on the
regulation write guard: it writes the fixed `data/game-diff.json`. That is the same class as 1.25.1's
`open_work.js`: `game-diff.json` needs declaring in `PER_REGULATION_ARTIFACTS`. It predates this change.

## OWED, NOT RUN

1. The full Reg M-C matrix re-run. The dmg pin moves every pinned state case's medicham2 damage by one
   roll, towards the authority, so the live and KO counts can move. Expected: `ko` 1 -> 0, `threw` 2 -> 0,
   `off_gate` 2 -> 0 (or 1 if the Weak Armor row now agrees).
   `ABRA_REGULATION=regmc tools\lownode.cmd tests\test-interaction-matrix.js --full`
   (then commit `data/interaction-matrix-regmc.json` and `ABRA_REGULATION=regmc node engine/open_work.js`).
2. `node engine/status.js --write` from the main checkout, after merge. It is not run from a worktree,
   because it writes missing untracked files as fact.
3. Declare `game-diff.json` per-regulation (see above), as its own change.
