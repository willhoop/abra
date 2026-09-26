# A Prankster status move refused by a Dark foe ends the move `false` (Reg M-C) — abra/regmc 1.21.0

ENGINE. Reg M-C only (`ABRA_REGULATION=regmc`, `SHOWDOWN_PATH` unset, checkout `pokemon-showdown-mc` `f10d679`).
Filed by SOLVER on release `eaa5becc54eb` (`docs/_reports/2026-09-26-tiered-gates.md`, `docs/ENGINE.md`).

## 1. The rule, read whole in the Reg M-C checkout

No Champions override touches any of it: `data/mods/champions/*.ts` names neither `prankster` nor any `hitStep*`.

| where | what it says |
|---|---|
| `data/abilities.ts` `prankster.onModifyPriority` | `move.category === 'Status'` sets `move.pranksterBoosted = true` and returns priority + 1 |
| `sim/battle-actions.ts` `hitStepTryImmunity` | after powder and the move's own `onTryImmunity`: `gen >= 7 && move.pranksterBoosted && pokemon.hasAbility('prankster') && !targets[i].isAlly(pokemon) && !dex.getImmunity('prankster', target)` writes a bare `-immune` (plus a `-hint`) and `hitResults[i] = false` |
| `data/typechart.ts` | Dark carries `prankster: 3` (immune); `Dex.getImmunity('prankster', ['Dark'])` is false |
| `trySpreadMoveHit` | `atLeastOneFailure ||= hitResults.some(v => v === false)`; result `!!targets.length`; only `!moveResult && !atLeastOneFailure` writes `null` |
| `useMove` | keeps the returned value as `moveThisTurnResult`; `nextTurn` rolls it into `moveLastTurnResult` |
| consumers | Stomping Tantrum and Temper Flare double on `moveLastTurnResult === false`; the Metronome item's streak reads it truthily |

**Which moves.** Every move whose `category` is `Status` when the user has Prankster — the flag is set at priority
time. A move whose target is `all`, `foeSide`, `allySide` or `allyTeam` goes to `tryMoveHit`, never reaches the step,
and is never refused (already modelled, ROADMAP #9, `tests/probe_prankster_target.js`).

**Which targets.** Foes only: `isAlly` is true of the user itself and of its partner. Per target: a spread status move
at a Dark and a non-Dark foe is refused by the Dark one and lands on the other, and the move result is `true`; at two
Dark foes it is `false`.

**Called moves.** `useMoveInner`: `if (this.battle.activeMove) { move.priority = …; if (!move.hasBounced)
move.pranksterBoosted = this.battle.activeMove.pranksterBoosted; }`. The step asks the flag, not the category, so a
Prankster Sleep Talk or Copycat that calls a DAMAGING move into a Dark foe is refused. Measured: the authority refused a
called Foul Play into Persian-Alola; MEDICHAM dealt 15 (board-material).

**Encore.** `runMove` captures `baseMove.pranksterBoosted` before `OverrideAction` and writes it onto the replacement,
so an Encored Prankster body keeps the boost of the move it CHOSE. Not staged here (see §5).

**Redirection.** Follow Me / Rage Powder / Lightning Rod pick the target before `trySpreadMoveHit`, so the clause is
asked of the body the move arrives at. Derived for Reg M-C: no legal Dark body learns Follow Me or Rage Powder, and no
legal Lightning Rod or Storm Drain carrier is Dark — a move cannot be redirected INTO a Dark body. The reachable case,
AWAY from one (a Prankster Thunder Wave at Persian-Alola lands on a Follow Me Maushold), agrees in both engines.

**Magic Bounce.** It answers at step 1 (`hitStepTryHitEvent`), two steps above the Prankster arm, and the bounced copy
carries `pranksterBoosted = false`. So a Dark Prankster user's Taunt or Thunder Wave into a Magic Bounce body comes
back and LANDS on the Dark user. Both engines agree on the effect; the clicker's result is `false` in the authority
(Magic Bounce's `return null` becomes `false`) and was `true` here — fixed with the siblings. The engine comment that
said a bounced Prankster move "is still refused by a Dark type here" was stale; it is annotated.

## 2. The defect and the fix

**Board-material, measured both engines** (`tests/probe_prankster_dark_result.js`, arm `outcome`): Grimmsnarl
(Prankster) Taunt into Persian-Alola, refused; next turn Stomping Tantrum into it. Persian-Alola took 488 HP in the
authority and 523 here; move result `false` / `true`.

MEDICHAM's battle loop writes a default `true` once the move is used (`if(_mid)m._mvRes=true`), and no Prankster
refusal site overwrote it. Fixed:

- `pranksterRefusedResult(m)` / `pranksterRefuse(m, t)` beside `pranksterBlocked`; every single-target site uses it.
- `tryHitRefusal`'s Prankster record carries the mover; `announceTryHitRefusal` writes the result for it. Every caller
  that announces such a record is single-target (the multi-target callers aim at allies or `all`, which the clause
  never refuses).
- The `affect` branch's rows: `R.pk`; the result is `false` only when every row is out.
- Leech Seed: its Prankster refusal was a silent conjunct (no `-immune`, result `true`); now asked above the die.
- Called moves: the damaging branch's `_stepTryImm` asks `pranksterBlocked(m, tg, <caller>)` for an action carrying
  `_calledBy`, unless the called move's target class never reaches the step.

**Siblings, found by the probe's own control arms** (same field, same step list, no Prankster): measured on the
authority first, then fixed in the `affect` and major-status branches — Good as Gold, the absorbers, the move-class
door, powder, the type chart, `onTryImmunity`, a miss, an empty-handed Trick/Switcheroo and a Magic Bounce left `true`
(authority `false`); a shield left `true` (authority `null`, the `#509` residual SOLVER re-filed on 2026-09-25).

Knobs, each shown red on exactly its own arms and census rows:

| knob | probe arms red | census |
|---|---|---|
| `MEDI_PRANKSTER_RESULT_TRUE` | 34 (32 single-target sweeps — Attract's gender clause refuses first, so it is a sibling —, the all-Dark spread, the outcome) | `priorityMod` "…refuses FAILS the move…" MISSING, 1026/1027 |
| `MEDI_PRANKSTER_CALLED_BLIND` | 1 (`called-sleeptalk`) | `priorityMod` "…Sleep Talk's CALLED damaging move…" MISSING |
| `MEDI_STATUS_REFUSAL_RESULT_TRUE` | 16 (6 siblings, 2 bounce, 8 controls) | `refusesStatusMoves` "…Good as Gold…" MISSING |

Each knob run refused to write the census (`DELIBERATE_BREAK`).

## 3. Why the gate missed it, and what closes the gap

- `engine/board_state.js` does not compare the move result. `engine/move_result_state.js` says so in its own header:
  promoting it "changes what every whole-game run counts". So the lattices and the roster compare boards, and the
  result reaches a board only through Stomping Tantrum, Temper Flare or the Metronome item on the NEXT turn by the SAME
  body. None of the three lattices contained that sequence after a refused Prankster click.
- Every existing Prankster row (census × 4, roster, `probe_prankster_target.js`) read the EFFECT or the LINE, and both
  were right. The field was right nowhere and asked nowhere.

Closed by:

- `tests/probe_prankster_dark_result.js` — two engines, every foe-aimed status move a legal carrier learns (34, over
  Sableye, Liepard, Whimsicott, Meowstic, Klefki, Grimmsnarl), each with a non-Dark and a no-Prankster control; the
  all-Dark spread arm; the outcome; the called move; redirection; Magic Bounce; six siblings. Every arm reads the move
  result through `engine/move_result_state.js` AND the boards, and an arm whose authority did not stage what it claims
  is UNREADABLE, never green. Final: 0 RED, 1 UNREADABLE (a same-gender Attract control, gender-refused in both engines).
- Three census rows that read the OUTCOME (Stomping Tantrum's damage), not the field: census 1024 → 1027 live, 0
  missing.
- Not done, and not ENGINE's call alone: comparing the move result as a board leaf would make every lattice and roster
  run see this class. It changes what every whole-game run counts, which is MEASURE's.

## 4. The Reg M-C gate clauses this touches, on a fresh release

Release **`4067de46a0ee`** (cut on the fixed tree). Census pin `data/verification/census-pin-regmc-f534f1592eda.json`
(1027 rows). Team store `data/team-pool-frozen-regmc` (hard-linked from the main tree; both files match
`pool-receipt.json`). Lattice flags: `--steering empirical --arm middle --end-state --release 4067de46a0ee --census
<pin> --team-store data/team-pool-frozen-regmc --games N --write --out <gate path>`. Roster: `tests/roster.js --stage
<s> --reds --write --release 4067de46a0ee`. All runs at below-normal priority, one at a time.

**GATE: OPEN, 10 of 10** (`ABRA_REGULATION=regmc node engine/quarantine.js`, run on the release's own tree):

| clause | reading on `4067de46a0ee` | on `eaa5becc54eb` (2026-09-24) |
|---|---|---|
| game differential (damage) | 0 of 6000 at midpoint, top, bottom, idx01–idx14 | same |
| roster / items | 166 of 166, 0 DIFFER, 0 DID-NOT-FIRE, reds caught | same |
| roster / abilities | 210 of 214; 3 ANNOUNCEMENT-ONLY on receipts; 1 deferred (Illusion) | same |
| roster / moves | 510 of 511 | same |
| coverage | all 269 moves above 25 clicks measured | same |
| board leaves | 0 uncompared (58 compared) | same |
| whole-game BOARD-MATERIAL | 0 of 955 / 1266 / 1497 | same |
| whole-game NARRATION | 0 of 955 / 1266 / 1497 | same |
| mechanics staged | 0 diverge, 4,867 games, 0 threw | same |
| no open known engine defect | clean, 205 verdicts read | same |

The brief named the lattices and the roster. On the first quarantine read those passed and the damage differential and
the mechanics-staged clauses FAILED as "measured against a different engine" — their artifacts were on
`eaa5becc54eb`. Both were re-run on `4067de46a0ee` (`tests/test-engine-diff.js --n 6000 --seed 20260804`;
`engine/all_mechanics_fire.js --release 4067de46a0ee --write`) and the gate re-read. The census was not rewritten by any
step: live and pin both hash to `f534f1592eda` after the run.

**Which scoreboard, said before the runs.** The fix changes a field no board carries unless the same body clicks
Stomping Tantrum, Temper Flare or holds a Metronome after a refused status click. Expected: the lab (census, probe)
moves and the pool does not. It did not: 0 → 0 on every lattice, the same game counts (955 / 1266 / 1497) as on
`eaa5becc54eb`.

Two things went wrong on the way and neither touched a published figure:

1. The below-normal wrapper first ran scripts through `require()`, so every `require.main === module` guard was false
   and the lattice and roster mains did not run (exit 0 in 14–27 s, nothing written). Switched to `Module.runMain`.
2. The frozen pool's `*.jsonl` are gitignored, so the worktree held only the receipt. The first real lattice runs
   played 0 games, exited 1, and had already overwritten the three published lattice artifacts with empty ones. They
   were restored from git before anything read them, the two stores were hard-linked from the main tree (both sha256
   match `pool-receipt.json`), and the lattices re-run. Logged as a row in `docs/REGULATION-ROTATION.md`.

## 5. Owed

- **SOLVER — a red test this fix caused, in a file ENGINE may not edit.** `solver/tests/test-gates.js` exits **3
  (BLIND)**: its ENCORE clause demonstrates the `purposeresult` break on a Prankster Encore into a Dark body, which
  reads "live" on the move result only because the result was wrong. With the result right, the break's answer is
  "dead" too, so it stays green. Under `MEDI_PRANKSTER_RESULT_TRUE=1` the suite is exit 0 again (42/42, every break
  red), so the fix is the whole cause. The break needs a case where the move result and the purpose still disagree on
  the fixed engine. Also: SOLVER's workaround that skips shielded worlds (`#509`) is no longer needed for the `affect`
  and major-status branches.
- **MEASURE — the structural gap.** The move result is still not a compared board leaf. Promoting it would make every
  lattice and roster see this whole class; it changes what every whole-game run counts.
- **ENGINE, not measured, filed:** the sibling results on the other status branches (trap, curse, typecopy, soak,
  spite, yawn — the Prankster road through them is green); an Encore that swaps a Prankster body's chosen status move
  for a damaging one (keeps the boost) or the reverse (does not).
- **Not mine, left alone:** `data/engine-release-regmc.json`, `data/roster-regmc.json`, `data/roster.*.prev-regmc.json`
  are written by the release cut and the roster and are untracked on main too; not added.
