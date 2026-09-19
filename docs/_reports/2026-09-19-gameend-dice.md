# 2026-09-19 — game-end effects, a PP price, and the "dice, one engine only" leads

ENGINE division, LIGHT MODE (staged boards and single probes only; no differential, roster, quarantine
or all-mechanics-fire run). Worktree `.claude/worktrees/agent-ad2ae961a73089406`. Leads come from
release `482e8f5ca701`, `data/game-differential.g1350.json` / `.g1950.json`, and the merged-remeasure
dump cards (`mr/dump1350.json`, `mr/dump1950.json`, read, not executed).

## VERDICT

- The census went from **900 live of 900** to **907 live of 907**, with 0 missing and 0 hollow. That is 7 new
  rows. All 7 fail with the 7 restore knobs set and no other row fails (`data/mechanics-census.json`).
- There were 10 leads. **8 are fixed** and 1 is **diagnosed but not fixed** (Cursed Body against Triple Axel).
  The remaining lead, the burn, is one of the 8.
- Each fix has a two-engine probe. The probe was red before the fix, is green after it, and is red again
  under its knob.

## GROUP 1 — the game-end effects. PREMISE FALSE: this is three mechanisms, not one.

The three cases do not all fail the same way. In two of them the authority stops and this engine carried
on. In the third the authority carried on and this engine stopped.

| card | authority, read | engine was | fix | knob |
|---|---|---|---|---|
| burn chip on Sinistcha (1950, `...2634182062` t11) | `fieldEvent` runs `faintMessages(); if (this.ended) return;` after **every handler** (`sim/battle.ts:565-566`). | It stopped only at the next residual GROUP. Its own comment said the rest of the group could hit only the LOSING side. The Sinistcha is on the winning side. | Stop at the top of each body when `sideWiped && !faintQueueOwed()`. The weather group is excluded because it is one handler. | `MEDI_RESIDUAL_STOP_GROUP_ONLY=1` (existing knob, same meaning) |
| Life Orb chip on Slowking-Galar (1350, `...2662560687` t11) | `futuremove.onEnd` tolls the booker's Life Orb after every payout, then calls `checkWin()` (`data/conditions.ts:415-421`). | It never tolled on a payout. This is not a game-end rule. This was just the one pool game where the payout was also the last KO. | `payOrbToll()` is lifted out of the attack branch into one function. The payout calls it when the booker is active. Immune, missed and decisive payouts all toll (checked on the authority). | `MEDI_ORB_TOLL_SKIPS_PAYOUT=1` |
| Lum not eaten (1950, `...2661323469` t15) | `lockedmove.onAfterMove` → `onEnd` → confusion, inside `runMove`'s AfterMove (`sim/battle-actions.ts:311`). The berry is `onUpdate`, and the next Update comes after `faintMessages(); if (this.ended) return true;` (`sim/battle.ts:2832-2856`). | `applyConfusion` ate the berry inline. | At the at-move fatigue site, the cure waits for `_updateAll`, which sits below the win break. The two residual fatigue roads are unchanged and not measured. | `MEDI_FATIGUE_BERRY_INLINE=1` |

Probe `tests/probe_gameend_residuals.js`. Both engines use the same bodies and one pinned die of 0.1. Each
card has an arm and a control that differs in one thing: a bench body, no item, or a foe bench.

## GROUP 2 — PP `thunderbolt 2|1`. PREMISE TRUE, the cause is Pressure after a redirect.

The field counts PP SPENT. p2's Farigiraf clicked Thunderbolt. p1 had a Pressure Weavile beside a Lightning
Rod Manectric (from the pinned pool's sheets). The authority charges Pressure off the targets that remain
after `RedirectTarget` (`getMoveTargets` → `pressureTargets`, `sim/battle-actions.ts:466-482`). The engine
priced the attack at the PP site, off the aimed slot. The attack branch redirects hundreds of lines further
down. Non-attack clicks were already correct, because they are redirected above the PP site (the control arm).
The fix calls `redirectDrawnTo` at the PP site in quiet mode, behind the same gates as the attack branch:
single-target, not widened, target alive, and not charging. The charging test is now one shared function,
`chargeStateOf()`. Probe `tests/probe_pp_pressure_redirect.js` gives rod+Pressure 1/1, Static+Pressure 2/2,
rod+Pickpocket 1/1 and a status-move control 1/1. The rod+Pressure arm read 2/1 before the fix, which is the
card's exact value. Knob `MEDI_PP_PRESSURE_PRE_REDIRECT=1`.

## GROUP 3 — dice. The address question comes first, and it was answered by staging each event.

The diagnostic staged each event in both engines under the middle arm and printed every die address that
only one engine drew. Of the 5 leads, 3 were ADDRESS defects in the engine, 1 was a RULE defect, and 1 is both.

- **Trevenant's sleep (1350)**: ADDRESS. p1's Audino carries **Healer** and Yawn. Champions' Healer throws
  its die only for a statused ally: `allyActive.status && this.randomChance(1, 2)`
  (`data/mods/champions/abilities.ts:46-57`). Shed Skin works the same way. The engine threw the die every
  residual at `any|-|-`. That is also the address of the sleep-length `sample([2,3,3])`, so the sleep length
  read the wrong `nth`. The staged board reproduced it exactly: the foe slept on the authority and not here.
  Fix: throw the die per statused recipient only. Knob `MEDI_CURE_ROLL_UNGATED=1`.
- **Poison Touch on the flinched Scovillain (1950)**: ADDRESS. Flinch is irrelevant. The target was a
  **Spicy Spray** mega, whose handler throws no die. The engine threw `rng()` against a cumulative chance of
  1, at the same `any|fakeout|p20` address, so Poison Touch read `nth 1` here and `nth 0` there. It was
  reproduced exactly (Scovillain 92 psn against 109). Fix: no die when the punish chances sum to 1. Knob
  `MEDI_REACTION_DIE_ALWAYS=1`.
- **Sinistcha's full paralysis (1950)**: ADDRESS. The click was **Life Dew** (`allies`). `runMove` resolves
  `getTarget` to a RANDOM FOE and calls `setActiveMove` before `BeforeMove` (`sim/battle-actions.ts:223,
  244, 253`). Only `useMoveInner` puts an `allies` move back on the user (`:418`). The engine named the user
  from the start, so the paralysis die read `p20` here and `p10/p11` there, never the same. Fix:
  `it._runMoveTgt` carries the drawn foe to the runMove-position address writes. The `|move|` line and the
  useMoveInner write still name the user. Knob `MEDI_ALLIES_ADDR_AT_USER=1`.
- **Darkest Lariat misses (1950)**: RULE. The move half of `ignoreEvasion` was a gap that `hitChance` itself
  named. `ignoresBoosts.evasion` is now derived in `tag_dex.js` and read in `hitChance`. The target was the
  twice-Minimized Sandaconda. Probe `tests/probe_ignore_evasion_move.js`. Knob `MEDI_MOVE_EVASION_COUNTED=1`.
- **Cursed Body against Triple Axel (1950)**: BOTH, and **NOT FIXED**. RULE: Cursed Body (and Poison Touch)
  pay once per move. The authority raises `DamagingHit` per arrival, so it rolls up to 3 times and stops
  once the attacker is disabled. ADDRESS: `rollHitsOf` draws the multiaccuracy dice for arrivals 2..n before
  the first hit. The authority draws each one inside the hit loop, between the arrivals' reaction dice, on
  the same `any|tripleaxel|p20`. The measured orders are: authority `[CB1, MA2, CB2, MA3, CB3]`, engine
  `[MA2, MA3, CB]`. Fixing the rule alone does not clear this game. The address half needs one of two
  things. The first is its own middle-arm category for the hit loop's body draws, which would be
  `game_differential.js`, a new RNG stream key, and a `PIN_DIGEST` move. The second is a lazy per-arrival
  multiaccuracy draw inside the engine's packet loop. Either one is a separate pass.

Probe `tests/probe_unshared_reaction_dice.js` stages arms A, B and C. Each arm has a control on which both
engines throw the die: Healer beside a paralysed ally, Static, and single-target Shadow Ball. The probe
asserts three things: zero unshared addresses in scope, the die was thrown on both engines, and the boards
agree at every boundary.

## WHICH SCOREBOARD THIS SHOULD MOVE — said before any run, and nothing was run

- **Lab:** the census moved from 900 to 907 (measured).
- **Pinned pool:** 8 cards should clear. At `--games 1350`: Slowking and Trevenant. At `--games 1950`: Lum,
  burn, PP, paralysis, Poison Touch and Lariat. The Cursed Body card should stay. **Not measured**, because
  light mode does not allow it.

## FILES CHANGED

- `engine/medicham2-browser.js`: the per-body residual stop; `payOrbToll()` and the payout toll; the fatigue
  cure moved to Update; `chargeStateOf()` and the redirected Pressure price; the per-recipient cure die; no
  die for a certain punish; the `allies` runMove address; the move half of `ignoreEvasion`. It also adds 7
  knobs, with MEDFAILS stamps and MEDSEEN counters for each.
- `engine/tag_dex.js`: `ignoresBoosts` now derives `evasion` from `move.ignoreEvasion`.
- `data/tags.json`: **SPLICED, not regenerated.** This worktree has no store, and a trial regeneration zeroed
  every usage count, so it was reverted. Two params were added (`darkestlariat`, `sacredsword`). The set is
  derived from the format, and a no-op round trip was checked byte for byte first.
- `data/abra-tags.js`: rebuilt by `build/build_tags_js.js`. `--check` passes.
- `data/mechanics-census.json`: regenerated. 7 rows were added and no row was lost. One other row moved:
  `formatSecondaryChance` reads Rock Slide at 28.6→27.0. That row uses `Math.random` at N=6000, so the move
  is sampling noise.
- `tests/test-mechanics.js`: 7 new rows.
- New probes: `tests/probe_gameend_residuals.js`, `tests/probe_pp_pressure_redirect.js`,
  `tests/probe_unshared_reaction_dice.js`, `tests/probe_ignore_evasion_move.js`.
- `docs/ENGINE.md`: a new section and its hand list.

## REGRESSION CHECKS RUN (all on the final tree)

These are green: `test-resolution-order` (26 arms), `test-engine-consistency`, `test-no-silent-failure`,
`test-tag-consumed`, `test-tag-params-derived`, `test-tag-signature`, `test-engine-diff` (150/150 agree),
`test-future-sight`, and 35 neighbouring probes. The probes cover residual, Life Orb, fatigue, rampage,
Future Sight, redirect, PP, every `*_address` probe, DamagingHit order, multihit update, spread status and
the named-target die.

Three reds were seen. **None of them is from this pass:**
- `tests/test-tag-wire.js` "20 turns of contact drags the attacker to -6 speed (got 0)". It is **also red
  with HEAD's engine swapped in**, which points to 6.50.0's Gooey drop road. It is owed by that change.
- `probe_bond_secondary_order` and `probe_substitute_roll_address` were red under `tests/_live_release.js`.
  Both are **green when pinned to this tree's own cut** (`6c3f77b376a1`, local store).
- `probe_pressure_terrain_target`'s re-run children fail on the missing pool, which is a worktree artefact.
  Its main arms passed.

## INSTRUMENT HAZARDS FOUND ON THE WAY (not fixed, reported)

1. **`tests/_live_release.js` uses ONE temp store (`%TEMP%/abra-live-release-store`) for every worktree.**
   A probe that calls `ER.open()` with no id reads whichever agent cut most recently. During this pass that
   was `b6df12898e33`, cut by another agent's `probe_bounce_reflectable_class.js`. So it reads another tree's
   counters. Both reds above had this cause.
2. During a batch of "live" probe runs, `data/engine-release.json` moved and a release (`eedb31c19b2d`, "game
   differential mode A") was cut into the worktree's real `data/releases`. The probe that did this was not
   identified. The pointer was restored and the release directory, which is gitignored, was left in place.
3. `probe_residual_stop_body.js` and `probe_pressure_terrain_target.js` hard-code `data/team-pool-frozen`.
   Those probes cannot run in a worktree unless the pool is redirected. Here it was read from the main tree
   through a scratch wrapper and not copied.
4. `tag_dex.js` in a worktree reads no store and writes usage counts of zero. The tags must be spliced, or
   regenerated on the main tree.

## PROPOSED NOTES ROW

| 2026-09-19 | ENGINE: 8 whole-game leads fixed on release 482e8f5ca701. (1) A residual that wipes a side stops at that handler, so the winner's burn no longer ticks. (2) The Future Sight payout tolls the booker's Life Orb. (3) A game-winning lock-in fatigue leaves the Lum uneaten. (4) Pressure is charged off the body a redirect drew the attack to. (5) Healer and Shed Skin throw their die only for a statused recipient. (6) Spicy Spray throws no die. (7) An `allies` move's BeforeMove dice are addressed at the foe that `getTarget` drew. (8) Darkest Lariat and Sacred Sword ignore evasion (`ignoresBoosts.evasion`). Census 900 → 907 live, 0 missing (`data/mechanics-census.json`). Cursed Body against Triple Axel is diagnosed (per-arrival rule plus the multiaccuracy dice order) and not fixed. The pinned-pool lattices were not re-run. **Supersedes.** Nothing published. **Basis.** unchanged. Owes: ENGINE.md (done), the whitepaper engine-status paragraph at the next major. |

## OWED, NOT RUN

- The three lattices (`--games 1200/1350/1950`) on a release that holds these bytes. The expectation is that
  8 board-material games clear and the Cursed Body game stays. That run belongs to MEASURE or the coordinator.
- Cursed Body and Poison Touch per arrival, together with the multiaccuracy address, as one pass. The
  instrument half touches `game_differential.js` and moves `PIN_DIGEST`.
- Effect Spore's `runStatusImmunity('powder')` gate before its die. A Grass or Overcoat attacker gets a die
  here and none on the authority. This was read, not probed.
- The two residual lock-in fatigue roads still cure inline. They are not measured.
- `tag_dex.js` regenerated on the main tree, to confirm that the splice matches a real run.
- The `_live_release.js` shared-store hazard (item 1 above) and the unidentified pointer-moving probe (item 2).
- `tests/test-tag-wire.js` Gooey row, which is red on HEAD and owed by 6.50.0.
