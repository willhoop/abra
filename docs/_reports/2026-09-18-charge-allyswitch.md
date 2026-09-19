# 2026-09-18 — the Electric bank on a shielded exit, and the Ally Switch counter on the bench

ENGINE division, LIGHT MODE (staged boards and single probes only; no differential, roster, quarantine
or all-mechanics-fire run). Worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a8f57731dcd193945`,
based on `bc270762`. Both leads came from `data/game-differential.g1950.json` (1,950-game lattice).

## Verdict

| lead | premise | fixed | probe | knob |
|---|---|---|---|---|
| Electric `charge` kept after a Protect | **TRUE**. The Protect is the cause. The thaw on the card is not. | yes | `tests/probe_electric_charge_paths.js` (14 arms) + census row | `MEDI_ELECTRIC_CHARGE_KEPT_ON_EARLY_EXIT=1` |
| `allyswitch` volatile on a benched body | **TRUE**. It is also a play defect, not only a board leaf. | yes | `tests/probe_bench_private_counters.js` (4 arms) + census row | `MEDI_ALLYSWITCH_SURVIVES_SWITCH=1` |

Census: **894 / 894 live → 896 / 896 live, 0 missing** (`data/mechanics-census.json`, generated
2026-09-19T02:35:27Z; `node engine/status.js` reads `896/896 probed mechanics live, 0 missing`).

## Lead 1 — the Electric bank

### The authority, read at the line

- `data/moves.ts:2264` `charge.condition`. The Champions mod does not override it: `data/mods/champions/moves.ts`
  and `conditions.ts` have no `charge` key. The volatile is removed in exactly two handlers, and both are gated on
  `move.type === 'Electric' && move.id !== 'charge'`:
  - `onAfterMove`: `runMove` raises it after `useMove` returns, whatever `useMove` returned
    (`sim/battle-actions.ts:311-312`). A hit, a miss, a Protect, an immunity, an absorption and an `onTry` failure all
    reach it.
  - `onMoveAborted`: raised only when `BeforeMove` refuses the move (`sim/battle-actions.ts:256-257`).
- Nothing else removes it except `clearVolatile`, on a switch or a faint.

### The card

`first_divergences[36]`, config `pair-redirect-priority`, turn 6. The sequence was: Bellibolt is frozen by a
Blizzard, Electromorphosis banks off the same hit, the freeze thaws at Bellibolt's `BeforeMove`, and its
Thunderbolt goes into Sinistcha's Protect. Showdown writes `|-end|p1a: Bellibolt|Charge|[silent]` and medicham2
writes nothing. The board parts on `p1.active[0].vol.charge  medicham 1  showdown 0`.

### Every road, one arm each (before the fix)

| arm | what differs | authority | medicham before |
|---|---|---|---|
| hit | Thunderbolt connects | 0 | 0 |
| **protected** | Thunderbolt into Protect | 0 | **1 — RED** |
| missed (top arm) | Zap Cannon misses | 0 | 0 |
| immune | Thunderbolt into Garchomp | 0 | 0 |
| absorbed | Thunderbolt into Volt Absorb | 0 | 0 |
| nonelectric | Mud Shot connects | 1 | 1 |
| status-electric | Thunder Wave connects | 0 | 0 |
| switch-out | pivot out, read on the bench, then return | 0 / 0 | 0 / 0 |
| **thaw-then-protected** | the card's own board | 0 | **1 — RED** |
| thaw-then-hit | the same thaw, with no Protect | 0 | 0 — **so the thaw is not the cause** |

The arms added after the diagnosis also go red under the knob, so they are the same defect: Supercell Slam into
Protect (the crash exit), and Discharge with **both** foes protected. Discharge with **one** foe protected
reaches the spend site and was always green.

### Cause

In the attack branch, the fully-shielded exit `if(_hadTargets&&!targets.length){ ... _crashOnFail(); continue; }`
leaves the action several thousand lines above WIRE 157's damaging spend site (`spendChargeOnMove(m, a.move.id, ...)`).
The 2026-09-12 marker, `ELEC_CHG_INFLIGHT`, covered the `onMoveAborted` road only. It was disarmed at the `|move|`
line, and its comment stated that everything below that line is paid "at its own two spend sites". That was true
only for the roads that REACH those sites.

### Fix: one shared place

- At the `|move|` line, the marker is no longer dropped. It is kept with `ran = true`.
- `spendChargeOnMove` disarms the marker for its body as its first line. Reaching the function IS reaching
  `AfterMove`, so the explicit sites stay the normal road, and a bank re-banked after that point cannot be taken
  by a later sweep.
- The existing sweep, `midAbortElectricCharge` (at the head of the next action and after the loop), now pays both
  roads through the same `spendChargeOnMove`. The counts are kept apart: `electricChargeAbortedAtGate` (abort) and
  `MEDSEEN.electricChargeSpentOnEarlyExit` (ran, then left early).
- The knob `MEDI_ELECTRIC_CHARGE_KEPT_ON_EARLY_EXIT=1` drops the marker at the `|move|` line, as before, and stamps
  `MEDFAILS.electricChargeKeptOnEarlyExitRestored`.

### Receipts

- `tests/probe_electric_charge_paths.js`: **PASS 14 arms**. The knob parts exactly
  `[crash-into-protect, protected, spread-all-protected, thaw-then-protected]`, which is the expected set. Every
  arm's leaf was checked against Showdown's own board, and every arm read the bank as non-zero at a previous
  boundary.
- `tests/probe_electric_charge_abort.js` (the 2026-09-12 file): **PASS 4 arms**, unchanged.
- A protocol check on the protected arm: `div null`. The `-end ... [silent]` falls at the same point in both
  streams.
- Census row `ability buffsHolderOnHit — an Electric move stopped by a Protect still spends the banked Charge`:
  LIVE on the clean run, and MISSING under the knob (the control reads 142, the test reads 142, and the flat
  reference reads 72).

## Lead 2 — `allyswitch` on the bench

### The authority

- `data/moves.ts:302` `allyswitch`. `onPrepareHit` adds the volatile. Its condition has `duration: 2` and
  `counterMax: 729`, and `onRestart` rolls `randomChance(1, counter)` and multiplies the counter by 3. The Champions
  mod does not override it.
- `Pokemon#clearVolatile()` sets `this.volatiles = {}` (`sim/pokemon.ts:1514`). The Champions copy at
  `data/mods/champions/scripts.ts:124` keeps that line and adds `timesAttacked = 0`. So the authority's benched
  body holds no `allyswitch`.

### Cause

medicham2 keeps this volatile OUTSIDE `_vol`, as `_aswDur`/`_aswCount` on the body. `switchOut`'s wholesale
`out._vol = {}` cannot reach those fields, and nothing else in `switchOut` cleared them. The foot-of-turn tick
(`if(m&&m._aswDur>0&&--m._aswDur<=0)m._aswCount=0`) walks `actA`/`actB` only. So the counter stayed at 1 on the
bench for as long as the body stayed there. The card is `p1.party.runerigus.vol.allyswitch medicham 1 showdown 0`,
in 2 games, with no protocol line.

**This is a play defect, not only a board leaf.** A body that returns as a FAINT REPLACEMENT arrives after that
turn's tick. Its first Ally Switch then rolls 1-in-3 against the carried counter, where the authority starts a
fresh one and swaps without a roll.

### Arms (before the fix)

| arm | arm type | result |
|---|---|---|
| bench-leaf | Alakazam Ally Switches, then switches out | **RED**: `party.alakazam.vol.allyswitch 1 / 0` |
| standing | the same body stays | 1/1, then 0/0. The leaf can see a non-zero. |
| second-use (top arm) | two consecutive Ally Switches | both engines lose the 1-in-3. The counter is live on the field. |
| return-by-faint (top arm) | switch out, the replacement uses Memento, Alakazam returns as the faint replacement and clicks Ally Switch | **RED**: the authority swapped (slot 0), the engine refused (slot 1) |

### Fix: one shared place

`switchOut` now clears `_aswDur`/`_aswCount` beside the Metronome counter clear, and counts
`MEDSEEN.allySwitchClearedOnSwitch`. `switchOut` is the one door for voluntary switches, drags and pivots. The knob
`MEDI_ALLYSWITCH_SURVIVES_SWITCH=1` leaves the fields in place and stamps `MEDFAILS.allySwitchSurvivesSwitchRestored`.

### Receipts

- `tests/probe_bench_private_counters.js`: **PASS 4 arms**. The knob parts exactly `[bench-leaf, return-by-faint]`.
  After the fix, the return arm reads slot 0/0 at turn 4: the swap succeeds in both engines.
- Census row `move privateStallCounter — the Ally Switch counter does not ride the bench, so a returning body swaps
  at any roll`: LIVE clean. MISSING under the knob (bench counter 1, and the returned body stands in slot 1).
- Neighbours rerun green: `tests/test-switch-carry.js` (27 PASS, 0 FAIL) and `tests/probe_fail_names_the_move.js`
  (green, every arm agrees).
- First fixture was Clefable, which was illegal. My prevo-walk `learns()` passed it, and the driver's validator
  refused it: *"Clefable can't learn Ally Switch."* I swapped to Alakazam and changed the probe to read the
  species' own row, so it reads what the validator reads.

### The class: every volatile that survives a switch here but not in the authority

Every entry in `_vol` is wiped wholesale by `switchOut`, so the class that can survive is the volatile-backing
fields outside `_vol`. I derived the list by walking every `x._field =` write in `medicham2-browser.js`
(148 fields) and removing the ones `switchOut` touches (105 remain). Then I read each remainder against the two
places the engine itself names an authority volatile: `board_state.js`'s `vol` projection, and
`RESIDUAL_SHADOW_VOL`.

| field | authority volatile | survives a switch here | observable | action |
|---|---|---|---|---|
| `_aswDur` / `_aswCount` | `allyswitch` | yes | **board leaf + a refused swap** | **fixed** |
| `_helpingHand` | `helpinghand` (duration 1) | yes | no. The turn-top reset (the `m.protect=false;...;m._helpingHand=false` line) clears it on every active body before any reader. The one reader is the attacker's own damage call, and a body cannot return and attack in the same turn. It is not on the board. | reported, not changed (no failing probe) |
| `_attractedBy` | companion to `attract` | yes | no. `_vol.attract` is wiped, and `attractBeforeMove` returns early without it. | none |
| `_critVolTypeAtStart` | companion to `dragoncheer` | yes | no. It is read only under the `_vol` crit volatile, which is wiped, and it is overwritten on re-application. | none |

Every other board-compared field outside `_vol` is already cleared in `switchOut`: `_sub`, `_seededBy`, `_perish`,
`_trap`, `_ttmWrap`/`_charging`, `_trapHard`, `_mtLock`, `_lock`/`_lockT`, `_noSound`, `_recharge` and `_metroN`.
The `RESIDUAL_SHADOW_VOL` fields are cleared too: `_ptDmg`, `_healBlock`, `_yawn`, `_typeWas`, `tookProtectTurns`,
`_flinch`, `_redirect` and `protect`.

**The next shape, outside the volatile class:** `_cud` (Cud Chew's pending berry) is ability state that survives a
switch here. The authority re-initialises `abilityState` on switch-in (`sim/battle-actions.ts:142`), so a Farigiraf
that eats a berry and leaves before the residual forgets it. medicham2 keeps `_cud` on the bench, and its residual
would re-eat the berry after the body returns. I read this at the source and **did not probe it**.

## Files changed (worktree)

- `engine/medicham2-browser.js`: 2 knobs; the marker carried past `|move|`; the disarm in `spendChargeOnMove`; the
  two-road sweep counters; the `switchOut` clear.
- `tests/test-mechanics.js`: 2 census probes. The 2 knob stamps were also added to `DELIBERATE_BREAK`. Before that,
  **the first knob demonstration WROTE the census** (894 of 895). It was regenerated clean afterwards. The prior
  `electricChargeSurvivesAbortRestored` stamp is still NOT in that list, and is owed below.
- `tests/probe_electric_charge_paths.js` (new) and `tests/probe_bench_private_counters.js` (new).
- `data/mechanics-census.json`: regenerated, 896/896.
- `docs/ENGINE.md`: a new section, the hand list, and the two probes added to Owns.
- Side effects of running existing tests, **not mine to commit**: `data/engine-release.json` (the pointer moved to
  `ef6bc67540aa`, a worktree-local release cut by `test-switch-carry.js`'s driver load) and
  `data/provenance-stamp.json` (`status.js` shrank the ratchet by `_scratch-bench-smoke.json`, a file this worktree
  does not have). Neither was reverted. The coordinator decides.

## PROPOSED NOTES ROW

**2026-09-18 — ENGINE: the Electric bank is spent by an Electric move that a Protect stopped, and the Ally Switch
counter no longer rides the bench.** Two leads from the g1950 lattice. Both premises were confirmed against the
authority, and both were fixed at one place each. (1) `charge.condition.onAfterMove` runs after `useMove`, whatever
it returned (`sim/battle-actions.ts:311-312`). medicham2's fully-shielded `continue` jumped past the damaging spend
site. The 2026-09-12 gate marker now stays armed past the `|move|` line and is paid by the same sweep.
`tests/probe_electric_charge_paths.js` has 14 arms, and `MEDI_ELECTRIC_CHARGE_KEPT_ON_EARLY_EXIT=1` parts the 4
early-exit arms. The thaw on the card was not the cause. (2) `switchOut` did not clear `_aswDur`/`_aswCount`, the
Ally Switch volatile kept outside `_vol`, so a returning faint replacement lost its guaranteed first swap to a 1-in-3.
`tests/probe_bench_private_counters.js` has 4 arms, and `MEDI_ALLYSWITCH_SURVIVES_SWITCH=1` parts the 2 red arms.
Census **894 → 896 live / 0 missing** (`data/mechanics-census.json`). The class audit found no other observable
survivor. **Supersedes.** Nothing published: the lattice counts carrying these 3 games are re-run owed, not yet
re-measured. **Basis.** unchanged. **Owes.** ENGINE ledger (done in the worktree); a release cut and the four
invalidated artifacts; whitepaper and technical-docs fold-in at the next major.

## OWED, NOT RUN

- **Release cut + re-runs (LIGHT MODE forbade them):** cut a release on these bytes. Re-run `tests/test-engine-diff.js`,
  the three roster stages, `engine/all_mechanics_fire.js --kind all --write`, and the three lattices
  (`--games 1200 / 1350 / 1950`, pinned). Expectation, stated before the run: the g1950 lattice should lose the
  `vol.charge` game and the two `party.vol.allyswitch` games, **if those games' first board divergence was that
  leaf**. Charge was first on its card. The allyswitch cards were first on at least one (runerigus, turn 3).
- `electricChargeSurvivesAbortRestored` and `chargeWrapSurvivesAbortRestored` (2026-09-12/05 knobs) are not in
  `tests/test-mechanics.js`'s `DELIBERATE_BREAK`. A knob run under either would write the census. I did not add
  them because they are not this pass's knobs. It is one line.
- **Cud Chew `_cud` across a switch.** Read at the source, not probed. The next lead of the same shape.
- **A called move and the Electric bank.** Unprobed, and I have not checked it against the authority. `runMove`
  raises `AfterMove` with the OUTER move (Sleep Talk, Metronome) after `useMove` restores `activeMove`. If that is
  right, a Sleep-Talk'd Thunderbolt takes the doubling and does NOT spend the bank there. medicham2's damaging spend
  site uses `a.move.id` and may spend it. This existed before this pass, and this pass did not change it.
- `_helpingHand` survives a switch on the bench. It is inert today, per the argument above. If a mid-turn return
  that also acts is ever modelled (Dancer), it becomes observable.
- `docs/RUNNING-NOTES.md`, `CHANGELOG.md` and `status.js --write`: coordinator-owned per the brief. The row text is
  above.
- No git commit, per the brief.
