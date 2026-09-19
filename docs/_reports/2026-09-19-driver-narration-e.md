# Driver refusals and narration E — 2026-09-19, ENGINE (light mode)

A findings record, not a living document. Superseded by the register rows it feeds; not cited as current
state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-ab10e94cf199a504e`.

---

## 0. VERDICT

| # | lead | verdict | proof |
|---|---|---|---|
| 1 | the empirical driver clicks a move the authority refuses | **FIXED — two mechanisms, both in the driver** | `tests/probe_driver_refused_click.js` ALL PASS; each knob red on its own case only. All four thrown games play to the end on `fa39105e430a` with **no protocol divergence and every board held** |
| 2 | Coaching `-fail` after `[notarget]` | **ALREADY FIXED at 6.57.0 (narration A). The lead was stale.** | The Perish game replays clean on `4c9b0cc4a4da`; under `MEDI_COACHING_NOALLY_SILENT=1` it parts at exactly the reported line (idx 76). `tests/probe_narration_e.js` arm `coaching` PASS on both releases; census row already live |
| 3 | Tidy Up line order and missing `-activate` | **FIXED** | `tests/probe_narration_e.js` arm `tidyup`: PASS on `fa39105e430a`, RED on `4c9b0cc4a4da` (idx 29); new census row, red under its knob |
| 4 | refused stat drop at −6 | **FIXED — and an existing census row had pinned the defect** | Authority measured directly. `tests/probe_narration_e.js` arm `floor`: PASS on `fa39105e430a`, RED on `4c9b0cc4a4da` (idx 78); new census row, red under its knob |

- **Census 955 → 957 live, 0 missing, 0 hollow, 0 threw** (`data/mechanics-census.json`, worktree). Under
  `MEDI_TIDYUP_BOOST_FIRST=1`: 956 / 1 missing (its own row), refused to write. Under `MEDI_FLOOR_DROP_REFUSED=1`:
  955 / 2 missing (its own row and the corrected clamp row), refused to write.
- **Release:** `fa39105e430a` (worktree; medicham2 + tags). The pre-fix release `4c9b0cc4a4da` was re-cut in the
  worktree first and came back as the same id.
- **No ROADMAP rows filed.** Nothing is left unfixed.

## 1. PINS AND FLAGS

| pin | value |
|---|---|
| pre-fix release | `4c9b0cc4a4da` (identical tree, re-cut in the worktree) |
| fix release | `fa39105e430a` |
| team store | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` (main tree, absolute). Pool digests reproduced: g1200 `0d103fb9fa87` |
| flags for every replay | `--steering empirical --arm middle --end-state --turns 50 --games {1200,1350,1950}` (each game at its own lattice's size), no warm-up; scratchpad `replay_threw.js` = `pairsFor` + `playGame` |
| census | not pinned (empirical steering credits the census only) |

## 2. ITEM 1 — THE DRIVER

### What the four games were

Read from `errors` in `data/game-differential{,.g1350,.g1950}.json` (main tree, all on `4c9b0cc4a4da`):

| lattice | config | seed (second team) | refusal |
|---|---|---|---|
| 1200 | omit-weather | `…2663516978` | `Can't move: Floette's Protect is disabled` |
| 1350 | pair-redirect-priority | `…2659544719` | `Can't move: Sinistcha's Matcha Gotcha is disabled` |
| 1950 | omit-weather | `…2653845078` | `Can't move: Altaria's Protect is disabled` |
| 1950 | pair-protect-bust | `…2661594821` | `Can't move: Mr. Rime's Protect is disabled` |

### Which refusals apply — derived, not listed

The driver already read `activeRequest.active[i].moves[k].disabled`. That flag carries Disable, Taunt, Encore,
Torment, a Choice lock and PP (`getMoves` sets `disabled = true` at `pp <= 0`,
`sim/pokemon.ts:1026-1028`). None of those can throw. Only two gaps remained:

1. **A hidden disable.** `disableMove(id, true)` sets `disabled: 'hidden'`. The one legal source is Imprison
   (`data/moves.ts` `imprison.condition.onFoeDisableMove`; grep of `data/*.ts` and the Champions mod finds no other
   `disableMove(…, true)`). `getMoveRequestData` builds entries with `getMoves(lockedMove, isLastActive)`
   (`sim/pokemon.ts:1101`) and `getMoves` turns `'hidden'` into `!restrictData` (`:1031`), so in doubles **slot b's**
   request shows the move enabled and raises `maybeDisabled`. `side.chooseMove` validates against unrestricted
   `getMoves()` (`sim/side.ts:625`, `:727-743`) and refuses. Floette, Sinistcha and Mr. Rime: on replay the fixed
   driver's counter reports the slot's `disabledSource` as Imprison in each game, and the Floette game's log shows
   `|-start|p2b: Farigiraf|move: Imprison` in turn 6, the turn before the refused choice.
2. **The fallback.** Altaria, Encored into Helping Hand (`|-start|p2b: Altaria|Encore` at t10), ally fainted, nothing
   on the bench. Every move but Helping Hand was `disabled` in the request, and Helping Hand was dropped by the driver
   for want of a LIVE ally. With no candidate, the WIRE 7 fallback sent `move 1` = Protect.

### The fix (`engine/game_differential.js`)

- `hiddenDisabled(p, act, mv)`: when the request carries `maybeDisabled`, drop a move whose
  `pokemon.getMoveData(id).disabled` is truthy. That is the authority's own correction path — `updateDisabledRequest`
  (`sim/side.ts:852-868`) makes exactly this read when it re-issues a request after a refusal. It does not CALL
  `updateDisabledRequest`, which clears `pokemon.maybeDisabled` on the live battle. A human who clicks the imprisoned
  move is refused and re-chooses from the rest; the driver now samples from the same rest. Counted
  (`hidden_disabled_filtered`, printed and in the artifact). Knob `MEDI_DRIVER_HIDDEN_DISABLE_UNREAD=1`.
- The fallback: when the only enabled moves were dropped for want of a live body, send the first of them at the empty
  slot (`validTargetLoc` is by location, `sim/battle.ts:2396-2425`); medicham2 gets the same move with no aim, since
  the named slot holds no body (an aim there would count as an AIM miss that is not one). `move 1` stands only when
  the request holds no enabled real move (the recharge pseudo-move). Counted (`only_move_at_empty_slot`). Knob
  `MEDI_DRIVER_FALLBACK_FIRST_SLOT=1`.

### Proof

`tests/probe_driver_refused_click.js` (constructed fixtures, the coverage chooser told to PREFER Protect so the old
read WOULD click it):

| run | A: Imprison, slot b | A control: no Imprison | B: Encore + empty ally slot | B control: ally alive |
|---|---|---|---|---|
| fixed | picks Moonblast, ACCEPTED | picks Protect, ACCEPTED | Helping Hand at `-1`, ACCEPTED | ACCEPTED |
| `MEDI_DRIVER_HIDDEN_DISABLE_UNREAD=1` | **picks Protect, REFUSED** `Floette's Protect is disabled` | ACCEPTED | ACCEPTED | ACCEPTED |
| `MEDI_DRIVER_FALLBACK_FIRST_SLOT=1` | ACCEPTED | ACCEPTED | **`move 1`, REFUSED** `Altaria's Protect is disabled` | ACCEPTED |

The fixture asserts the gap is real before asserting anything else: the request offers Protect with `maybeDisabled`.

### Replays

| game | on `4c9b0cc4a4da`, old driver | on `fa39105e430a`, new driver |
|---|---|---|
| g1200 omit-weather `…2663516978` | THREW t6 (reproduced; the choice string was `move 3 1, move 1` where the artifact's was `move 4, move 1` — no warm-up, so the same refusal, not a byte-identical click) | **19 turns, both engines ended the battle, no protocol divergence, boards 20/20** |
| g1350 pair-redirect-priority `…2659544719` | THREW t6 (reproduced) | **12 turns, ended, no divergence, 13/13** |
| g1950 omit-weather `…2653845078` | THREW t10 (reproduced) | **11 turns, ended, no divergence, 12/12** |
| g1950 pair-protect-bust `…2661594821` | THREW t12 (reproduced) | **23 turns, ended, no divergence, 24/24** |

**None of the four diverges once it plays on.** Choice refusals 0 in every replay.

### What the driver change invalidates

- **The three lattice artifacts** — `data/game-differential.json`, `.g1350.json`, `.g1950.json` — must be re-run.
  Driver code digest **`3f21624ad50d` → `c1c3591c1ec4`** (12 files; `engine/game_differential.js` `afdb016a7836` →
  `47259c18b63f`), so `engine/steering.js comparable()` will REFUSE any old/new pair as "the INSTRUMENT differs".
  That is correct: the four games that threw now play 11–23 turns each, and every game in which a slot-b body faces a
  foe's Imprison can sample differently (a removed candidate can move the empirical pick even when it was not the one
  drawn). **How many non-thrown games move is NOT MEASURED.**
- **`PIN_DIGEST` does not move** (`de38d17e15a2`, re-derived with the new driver); the mode string is unchanged.
- The quarantine gate reads those three artifacts, so its whole-game clauses are owed the same re-run.
- Nothing else reads `chooseAction`'s candidates. The roster and `all_mechanics_fire` script their clicks.

## 3. ITEM 2 — COACHING (ALREADY FIXED)

The lead came from the tie-order worktree (`b3d9f0954198`), which did not carry narration A. Narration A's
`MEDI_COACHING_NOALLY_SILENT` fix (6.57.0) is on `4c9b0cc4a4da`. Replay of g1950 baseline `…2634548064 vs
…2635534454`, no warm-up:

- `4c9b0cc4a4da`: both engines write `|move|p1b: Sneasler|Coaching|…|[notarget]` then `|-fail|p1b: Sneasler`; no
  divergence, 8/8 boards, both ended.
- same, `MEDI_COACHING_NOALLY_SILENT=1`: parts at **76**, `SD |-fail|p1b: Sneasler <> US |-start|p2b: Gengar|perish1`
  — exactly the reported line. The instrument can see the difference; the engine is right.

Coverage already existed: census row "Coaching with no partner standing fails with [notarget] and -fail" and
`tests/probe_narration_a.js`. `tests/probe_narration_e.js` adds a two-engine arm anyway (red: Coaching with the
partner fainted in a two-body game; control: partner standing) so the lead closes on a receipt.

## 4. ITEM 3 — TIDY UP

**Authority** (`data/moves.ts` `tidyup.onHit`, no Champions override): remove every Substitute
(`getAllActive`), then hazards off `[pokemon.side, ...foeSidesWithConditions()]` with a bare `-sideend`, then
`if (success) this.add('-activate', pokemon, 'move: Tidy Up')`, then `this.boost({atk: 1, spe: 1}, …)`.

**Ours:** the `statcode` branch boosted, then called `sweepField`, and never wrote the `-activate`.

**Fix.** `engine/tag_dex.js` derives two handler facts into `removesHazards`: `activatesOnSweep` (an `-activate`
naming the move) and `sweepBeforeOwnBoost` (`removeSideCondition` before `this.boost(`). **Printed before wiring:
they match `tidyup` and nothing else** (Defog, Mortal Spin, Rapid Spin all false). The branch now sweeps first when
`sweepBeforeOwnBoost`, and writes `-activate|<user>|move: <tag record name>` when the sweep removed anything and
`activatesOnSweep`; a record with no name is counted in `MEDFAILS.sweepActivateNoName`, not defaulted. Knob
`MEDI_TIDYUP_BOOST_FIRST=1`.

**`data/tags.json` was spliced, not regenerated** (same procedure as narration D): the worktree has no store, so a
full `tag_dex.js` run (through `tools/lownode.cmd`, exit 0) zeroes usage. Its params were diffed against HEAD: exactly
one row differs (`tidyup`), and only by the two new keys. Those keys were carried onto HEAD's bytes; `data/abra-tags.js`
rebuilt by `build/build_tags_js.js`. +3/−1 lines each.

**Proof.** `tests/probe_narration_e.js` `tidyup` (Maushold; own-side rocks, foe-side rocks, partner's doll): clean
agrees to the end, 4/4 boards; knob parts at 29 (`SD |-end|p1b: Aggron|Substitute <> US |-boost|p1a: Maushold|atk|1`),
board held. Control (nothing to sweep) agrees clean and under the knob. On `4c9b0cc4a4da` the red arm parts at the
same line clean. Census row "Tidy Up writes its sweep, then `-activate|move: Tidy Up`, and only then its boosts":
indices `[-1,-1,2]` / `[2,4,5]`; under the knob `[4,-1,2]`.

No lattice game carries Tidy Up (narration D, §5), so no lattice replay applies.

## 5. ITEM 4 — THE FLOOR

**Authority read first** (`sim/battle.ts:2017-2082`, Champions' `scripts.ts` does not override `boost`):
`ChangeBoost` → `getCappedBoost` → `TryBoost` → per-stat loop. At −6 a drop is capped to 0 BEFORE any refuser sees
it, and every refuser tests `boost[stat] < 0`, so none speaks. The loop's `msg` is `-unboost` because
`target.boosts[stat] === -6`, and it writes the zero line for a primary move and for an ability effect that is
secondary or self.

**Measured on the authority** (scratchpad `auth_floor.js`, Incineroar's Intimidate into Clear Body Metagross):

```
stage  0: |-fail|p2a: Metagross|unboost|[from] ability: Clear Body|[of] p2a: Metagross
stage -6: |-unboost|p2a: Metagross|atk|0
```

**Fix.** `statDropRefusal` returns no refusal for a real drop (`invSign(target, src) > 0` — Contrary turns a drop
into a raise in `ChangeBoost`, which is never capped at −6) into a stat already at −6. The callers then apply a
zero change and write their existing zero line. Mirror Armor's own `reflectSkipsAtFloor` guard is the same fact for
one ability and stays. Counted `MEDSEEN.floorDropReachesNoRefuser`. Knob `MEDI_FLOOR_DROP_REFUSED=1`.

**An existing census row pinned the defect.** "a stat change CLAMPED at the cap is still announced, magnitude 0"
had a negative arm that stood Clear Body and Inner Focus bodies at −6 and asserted two `-fail` lines ("the refusal has
to BEAT the clamp"). The authority says the clamp beats the refusal. The arm now asks both stages: at 0, two `-fail`
lines; at −6, two `-unboost|atk|0` lines. It went red first with the fix in (956 live / 1 missing), which is how it
was found.

**Proof.** `tests/probe_narration_e.js` `floor` (Garganacl, Clear Body, driven to −6 Speed by six of its own Curses —
a self drop no refuser answers — then Camerupt's Scary Face): clean agrees, 8/8 boards; knob parts at 78
(`SD |-unboost|p1a: Garganacl|spe|0 <> US |-fail|p1a: Garganacl|unboost|[from] ability: clearbody|…`), board held.
Control (same drop at Speed 0) agrees clean and under the knob. RED on `4c9b0cc4a4da` at the same line. New census
row "a drop into a stat already at -6 reaches no refuser" (Charm into Clear Body): `[1,0,0]` at 0, `[0,1,-6]` at −6.

No lattice game is known to reach this; none replayed.

## 6. OTHER CHECKS RUN

All on `fa39105e430a` unless stated: `tests/probe_narration_d.js` PASS 14 arms; `tests/probe_defog_target_side.js`
all checks passed; `tests/probe_ability_zero_boost_line.js` green; `tests/test-tag-wire.js` 104 passed;
`node engine/status.js` (read-only) prints `957/957 probed mechanics live, 0 missing`.

## 7. FILES CHANGED (worktree)

- `engine/game_differential.js` — `hiddenDisabled`, the empty-slot fallback, two knobs, two counters printed and in
  the artifact, two exports (`hiddenDisableCount`, `onlyEmptySlotCount`, plus `choiceRefusedCount`).
- `engine/medicham2-browser.js` — Tidy Up order and `-activate`; the floor guard; knobs `MEDI_TIDYUP_BOOST_FIRST`,
  `MEDI_FLOOR_DROP_REFUSED`, each stamped at load.
- `engine/tag_dex.js` — `removesHazards.activatesOnSweep`, `.sweepBeforeOwnBoost`.
- `data/tags.json`, `data/abra-tags.js` — the `tidyup` row gains the two keys (spliced).
- `tests/test-mechanics.js` — two new rows; the clamp row's negative arm corrected; two knob stamps in
  `DELIBERATE_BREAK`.
- `data/mechanics-census.json` — regenerated, 957 / 0.
- New: `tests/probe_driver_refused_click.js`, `tests/probe_narration_e.js`.
- `docs/ENGINE.md` — one section and its hand list, above the 6.59.0 section, outside the generated block.
- This report.
- **Restored to HEAD bytes:** `data/engine-release.json`, `data/releases/4c9b0cc4a4da/{cuts.jsonl,release.json}`
  (my re-cut appended to them), `data/provenance-stamp.json` (a read-only `status.js` run rewrote it from the
  worktree, which lacks some main-tree files).
- **Left in the worktree, ignored:** `data/releases/fa39105e430a/`, `data/diff-team-pool.json` (the pool cache the
  replays rebuilt).
- **Not touched:** `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `docs/ROADMAP.md`, `board.js`, `magnemite.js`,
  `engine-data.js`. No git write command. Every process I started ended on its own; none was killed.

## PROPOSED NOTES ROW

```
- **What changed.** ENGINE, worktree release `fa39105e430a`. (1) **The empirical driver no longer clicks a move the authority refuses.** Imprison disables with `disabled: 'hidden'`, which the last active body's request shows as enabled with `maybeDisabled` (`sim/pokemon.ts:1031, 1101`); `chooseAction` now drops a move whose `getMoveData(id).disabled` is set under `maybeDisabled`, the read `updateDisabledRequest` makes (`sim/side.ts:852-868`) (`MEDI_DRIVER_HIDDEN_DISABLE_UNREAD`). The last-resort fallback sends the one enabled move at an empty slot instead of `move 1` (`MEDI_DRIVER_FALLBACK_FIRST_SLOT`). The four games that THREW on `4c9b0cc4a4da` (g1200 `…2663516978`, g1350 `…2659544719`, g1950 `…2653845078` and `…2661594821`) now play 19 / 12 / 11 / 23 turns to the end with no protocol divergence and every board held (`tests/probe_driver_refused_click.js`). (2) **Tidy Up** sweeps, writes `-activate|…|move: Tidy Up`, then boosts; new tag params `removesHazards.sweepBeforeOwnBoost` / `.activatesOnSweep`, matching Tidy Up alone (`MEDI_TIDYUP_BOOST_FIRST`). (3) **A drop into a stat at −6 reaches no refuser**: the authority caps before TryBoost (`sim/battle.ts:2029-2031`) and writes `-unboost|…|0`; measured on the authority with Intimidate into Clear Body. The census row on clamped announcements had pinned the old behaviour and is corrected (`MEDI_FLOOR_DROP_REFUSED`). (4) **Coaching's `-fail` after `[notarget]` was already fixed at 6.57.0**; the lead came from a worktree without narration A. Probe `tests/probe_narration_e.js` (6 arms, PASS on `fa39105e430a`, the Tidy Up and floor reds RED on `4c9b0cc4a4da`). Census **955 → 957 live, 0 missing** (`data/mechanics-census.json`).
- **Supersedes.** Nothing published yet. The three lattice figures on `4c9b0cc4a4da` stay true of the OLD driver; they cannot be paired with a run on the new one (driver code `3f21624ad50d` → `c1c3591c1ec4`; `PIN_DIGEST` `de38d17e15a2` unmoved).
- **Basis.** unchanged — the lattices answer the same question; the four thrown games stop being truncated and the re-run is a back-cast.
- **Owed to the next major.** Technical docs mechanics list (four new knobs). OWED, NOT RUN: the three lattices, the roster stages and `all_mechanics_fire` on a release carrying this driver. Report: `docs/_reports/2026-09-19-driver-narration-e.md`.
```

## OWED, NOT RUN

1. **The three lattices** (`--games 1200 / 1350 / 1950`, `--steering empirical --arm middle --end-state`, pinned
   store) on a release carrying this driver and engine. The old artifacts are not comparable with the new ones. The
   prediction to write down first: board-material 0 / 0 / 0; threw 0 / 0 / 0 (was 1 / 1 / 2); undeclared narration
   0 / 0 / 0; games may move beyond the four because the Imprison filter changes sampling wherever a slot-b body faces
   an Imprison. Held weakly: nothing measured says how many.
2. **The roster stages and `all_mechanics_fire`** on the new release, then `engine/quarantine.js`. The medicham2 change
   touches `statDropRefusal` (every refusal site) and the `statcode` branch; the ability stage's refusal plants aim at
   those lines and could be stranded (the Harvest lesson from 6.60.0). **Check every red plant is still CAUGHT.**
3. `tests/test-wiring.js` and any test that plays real games through the driver were not run (light mode).
4. **A full `tag_dex.js` regeneration on the main tree** (it has the store), to confirm it writes the same two keys on
   the `tidyup` row and nothing else.
5. The version, the CHANGELOG entry, the notes row and `status.js --write` are the coordinator's.
