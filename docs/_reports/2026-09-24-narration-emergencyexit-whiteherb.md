# 2026-09-24 — Reg M-C narration: Emergency Exit / Berserk timing, and White Herb

ENGINE, isolated worktree `agent-a6d4345444712c79f`, branched from `cf59f23a`. Two mechanics, one commit each:
`abra/regmc 0.88.0` (recoil faint) and `0.89.0` (White Herb). Versions may be renumbered at merge.

## 1. Emergency Exit / Berserk against a recoil KO — `0.88.0`

**Pool case.** Reg M-C pass-10 dump (`data/verification/gd-regmc-pass10-dump.json`, release `ec377f6f8159`),
`omit-spread …bo3-2682655109 vs …2682620646`, turn 5: Rillaboom's Wood Hammer takes Golisopod to 33/150 and the recoil
kills Rillaboom.

    showdown   -damage Rillaboom 0 fnt [from] Recoil | -activate Golisopod ability: Emergency Exit | faint Rillaboom
    medicham   -damage Rillaboom 0 fnt [from] Recoil | faint Rillaboom | -activate Golisopod ability: Emergency Exit

**Authority, read whole (both checkouts; the Champions `hitStepMoveHitLoop` is identical in both).**
`data/mods/champions/scripts.ts`: `faintMessages(false, false, !pokemon.hp)` at :547 drains the TARGETS' faints; the
recoil is paid at :554 (`applyRecoilDamage` → `battle.damage` → `Pokemon#faint()`, which only queues); `eachEvent
('Update')` :575; `afterMoveSecondaryEvent` :577 (Berserk's `onAfterMoveSecondary`); the Emergency Exit door :587
(`runEvent('EmergencyExit', targets[i], pokemon)`, whose Champions handler at `data/mods/champions/abilities.ts:22-29`
writes the `-activate`). The next drain is `runMove`'s `this.battle.faintMessages()` at `sim/battle-actions.ts:347`,
after `AfterMove`. So both answers print ABOVE the recoil victim's `|faint|`.

**Engine.** The recoil block wrote `faintLineOut(m)` inline. Now it calls `queueFaint(m,'recoil')` (hp, `fainted` and
the kill order written exactly where they were) and `drainFaints('moveTail')` runs after the AfterMove herb block and
before the Red Card drag and the eject switches (those are `runAction`'s). Side effect, which is the authority's own
rule: during the second in-move Update the corpse's `_faintOut === false`, so `sourceOffField` treats it as still
active, as `isActive` is in the authority until `faintMessages`. Counters `MEDSEEN.recoilFaintDeferred`,
`MEDSEEN.faintDrainMoveTail`; knob `MEDI_RECOIL_FAINT_INLINE` (stamps `MEDFAILS.recoilFaintInlineRestored`).

**Probe** `tests/probe_recoil_faint_below_after_move_secondary.js` (`anyRegulation`). Holders by tag
(`boostsAtHPThreshold`, `switchesOutAtHalf`); turn 1 chips the attacker, turn 2 its sure recoil move crosses the holder
over half and the recoil kills it. CONTROL is the same cast with no chip. Casts found:

| regulation | arm | cast |
|---|---|---|
| M-C | BERSERK | Drampa [Berserk] ← Kangaskhan Double-Edge, chipped by Baxcalibur Dragon Claw |
| M-C | EMERGENCY EXIT | Golisopod ← Emboar Wild Charge, chipped by Baxcalibur Dragon Claw |
| M-B | BERSERK | Drampa [Berserk] ← Kangaskhan Double-Edge, chipped by Archaludon Dragon Claw ×2 |
| M-B | EMERGENCY EXIT | no legal carrier in Reg M-B — not staged |

Red on the pre-fix bytes (release `ec377f6f8159` M-C: 4 reds; `7822a83cc49b` M-B: 2 reds; first divergence
`|-ability|p1a: Drampa|Berserk|boost` vs `|faint|p2a: Kangaskhan`, and `-activate … Emergency Exit` vs `|faint|p2a:
Emboar`). Green after in both. Red again under `MEDI_RECOIL_FAINT_INLINE=1`. CONTROL arms agree before and after.

## 2. White Herb against a pivot's switch — `0.89.0`

**Pool case** (triage group I, `…2682994376` t2): the authority spends the herb before the Parting Shot switch,
MEDICHAM after it. That game is not in the pass-10 dump (6 rows) and was not replayed; the probe constructs it.

**Authority, read whole.** Reg M-B checkout `data/mods/champions/items.ts:1023-1037` overrides `whiteherb` so that
`onAnyAfterMove` does `this.queue.insertChoice({choice:'event', event:'WhiteHerb', order: 99 /* before switches */})`.
The Reg M-C checkout's `data/mods/champions/items.ts` has NO whiteherb entry, so `data/items.ts:7658-7705` stands:
`onAnyAfterMove() { onStart… }` restores inside `runMove`'s `runEvent('AfterMove', …)`, before `runAction` answers the
pivot's `switchFlag` with the switch request. The mainline `whiteherb` block is identical in the two checkouts; the
whole difference is the mod override. `engine/tag_dex.js` already derives it: `restoresStats.afterMoveImmediate` is
written only for the non-queued shape (`data/tags-regmc.json` has it, `data/tags.json` does not).

**Engine.** `pivotHerbSweep` (the Reg M-B queued road, between the entrant's `|switch|` and its SwitchIn) ran in both
regulations. `pivotFrom(mvId, fn, who)` now first calls `herbBeforePivotSwitch(who)`, which restores every active
holder whose tag carries `afterMoveImmediate`; all four `pivotFrom` call sites pass the leaving body. Under Reg M-B no
holder has the param, so nothing changes there. Counter `MEDSEEN.herbBeforePivotSwitch`; knob
`MEDI_HERB_IMMEDIATE_AFTER_PIVOT` (stamps `MEDFAILS.herbImmediateAfterPivotRestored`).

**Probe** `tests/probe_herb_before_pivot_switch.js` (`anyRegulation`): Incineroar's Parting Shot into a White Herb
Baxcalibur (Reg M-C; Reg M-B derives its own cast), Archaludon comes in; CONTROL without the herb.

    Reg M-C showdown   -unboost atk | -unboost spa | -enditem White Herb | -clearnegativeboost | switch Archaludon
    pre-fix medicham   -unboost atk | -unboost spa | switch Archaludon | -enditem White Herb | …

Reg M-C: red on release `a1dd33b2d616` (0.88.0 bytes) and under the knob; green after, counters `{early:1, entry:0}`.
Reg M-B: green before and after, counters `{early:0, entry:1}` (the queued road). Boards identical in every arm.

**`tests/probe_narration_b_line_order.js` `herb` arm** stages the Reg M-B override and read FIXTURE FAILED under Reg M-C
before this change (it was the one problem in its Reg M-C run). It now prints NOT APPLICABLE where the regulation's tag
has `afterMoveImmediate`. Reg M-B: all 16 arms still PASS.

**Not claimed.** The triage's third White Herb row (mirror-Incineroar tie, turn 0, `…2681884715`) is a speed-tie
question (group G), not this mechanism.

## 3. Board-material check — pinned `game_differential`, base vs fix

Flags: `--steering empirical --arm middle --end-state --games 300 --write --out <scratch>`. Reg M-C: census pin
`data/verification/census-pin-regmc-f3b70bc0c47c.json`, `--team-store` main's `data/team-pool-frozen-regmc`
(pool `25903b43fc7b`). Reg M-B: `census-pin-c716f46ab0a7.json`, main's `data/team-pool-frozen` (pool `3f9ce5a4f431`).
Driver code `64a2dc4f5568`, unchanged across every run. Bar = `state.games − state.games_board_never_diverged`.

| reg | release | engine | games | board-material | protocol-diverged |
|---|---|---|---|---|---|
| M-C | `ec377f6f8159` | base (main) | 259 | 0 | 0 |
| M-C | `a1dd33b2d616` | 0.88.0 | 259 | 0 | 0 |
| M-C | `924597092811` | 0.89.0 | 259 | 0 | 0 |
| M-B | `7822a83cc49b` | base (main) | 260 | 1 | 2 |
| M-B | `4662992b5cc1` | 0.88.0 | 260 | 1 | 2 |
| M-B | `1d13b44973d2` | 0.89.0 | 260 | 1 | 2 |

The Reg M-B first divergences are the same two games at the same turns in all three runs. No board-material change
was introduced. This small lattice contains neither mechanism, so it shows no regression, not the improvement; the
probes show the improvement. The lattice re-read at 1200/1350/1950 is owed from main on fresh releases.

## 4. Found, not fixed — routed

- **Board-material, Reg M-B, pre-existing on main's engine:** `omit-spread …bo3-2659015200 vs …2659155127` t3 at
  `--games 300`: Ariados's Knock Off into a not-yet-mega Alakazam. MEDICHAM writes `-enditem … alakazite [from] move:
  knockoff` and empties the item; the authority keeps it (`p1.party.alakazam.item` / `p1.active[0].item`: `""` vs
  `alakazite`). A mega stone on its own species is not removable. ENGINE, next pass. Not on the gate's 1200/1350/1950
  lattices as far as this run can say.
- **Instrument:** `engine/game_differential.js` joins `--dump-out` onto the repo root even when it is absolute
  (`ENOENT … agent-…\C:\Users\…`), so a dump to an absolute path crashes after the artifact is written (exit 1). MEASURE.
- **`tests/probe_midturn_herb_resort.js`** is a Reg M-B probe (its control child arms `MEDI_PIVOT_HERB_AFTER_ENTRY`).
  Under `--regulation regmc` it was red before this change (6 reds with the pre-fix herb) and is red after (2 reds: its
  control child can no longer restore the old order, because the Reg M-C herb no longer takes that road). Reg M-B:
  green. It needs the same NOT APPLICABLE gate as the `herb` arm, or a Reg M-C variant.
- **`tests/probe_narration_b_line_order.js --regulation regmc`** under any knob reports the leaked-knob stamp; that is
  its design, not a defect.
- **`tests/probe_berserk_switcheroo.js`** exits 1 in both regulations before and after; it is a diagnostic whose RED
  PLANT lines are expected.

## 5. Probes run on the final engine (release M-B `1d13b44973d2`, M-C `924597092811`)

Green in both regulations: `probe_herb_before_pivot_switch`, `probe_recoil_faint_below_after_move_secondary`,
`probe_narration_b_line_order`, `probe_partingshot_conditional`, `probe_partingshot_mirrorarmor`,
`probe_reopen_partings`, `probe_mental_herb_order`, `probe_unburden_herb_paths`, `probe_refill_entry_herb`,
`probe_second_update_pass`, `probe_faint_before_source_gone_end`, `probe_syrupbomb_source_faint`,
`probe_residual_faint_flush`, `probe_afterfaint_boundary` (the last five run on the 0.88.0 engine).
Green in Reg M-C: `probe_regmc_white_herb_before_switch`, `probe_regmc_white_herb_at_win`,
`probe_regmc_emergency_exit`. `probe_midturn_herb_resort`: see §4.

## 6. Census

`node tests/test-mechanics.js` on the 0.89.0 engine, both regulations, compared with the census committed at
`cf59f23a`: Reg M-B live 1004 → 1006, missing 0 → 0; Reg M-C live 1006 → 1010, missing 0 → 0; **no row went from live
to not-live** in either. The gain is the pass-9 rows (Guard Dog, Rattled, the Intimidate refusal label, the Stone Axe
hazard on a fainted user) that pass 9 left for MEASURE to republish, not these two fixes, which add no census row (both
are narration order, carried by probes). The regenerated files were restored to HEAD and are not in either commit, so
the republish stays MEASURE's from main.

## 7. Owed from main (not run here)

- `node engine/status.js --write` was NOT run in the worktree (it writes missing untracked files as fact from a
  worktree).
- The census republish (§6) and the gate re-read on fresh releases, per `docs/_reports/2026-09-23-engine-pass10.md`
  "OWED, NOT RUN". The three lattices should show the Emergency Exit row of the pass-10 dump gone.
