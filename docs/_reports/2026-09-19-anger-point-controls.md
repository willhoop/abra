# Anger Point's event order, control-arm partings, quiet controls — 2026-09-19, ENGINE (light mode)

A findings record, not a living document. It is not cited as current state. `node engine/status.js` holds the
current state.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-aa119ff3457ff2c8e`. The run was light
mode: named staged-game rows and single probes only. No battery, no lattice and no `quarantine.js` were run.

---

## 0. VERDICT

1. **Fixed.** Anger Point is now paid at the `Hit` event, above the same hit's self drops and secondaries. A
   critical Chilling Water into Anger Point reads **+5** on both engines. We read +6 before the fix. Census
   **967 → 968 live, 0 missing**.
2. **The instrument blind spot is closed on the row.** The new row field is `control_arm_parted`. The new summary
   count is **`summary.control_arm_partings.board_material`**. On the old engine it catches Hyper Cutter
   (BOARD-MATERIAL) and Magma Armor (announcement-only). On the new release it reads 0 of 8.
3. **A live control is weaker proof, and it has already manufactured two FIRED verdicts** (Frisk and Stalwart). The
   planner now prefers a control that is quiet on its own board. Quiet ability-swap controls went from
   **139 → 145 of 156**. Six rows changed and no row lost its control.

Release: **`ccabb2b6e953`**, cut in this worktree. The only engine sources that differ from `d92bdfb50d88` are
`engine/medicham2-browser.js`, `data/tags.json` and `data/abra-tags.js`. `data/engine-release.json` was restored
byte-for-byte afterwards.

## 1. THE ENGINE DEFECT (item 1)

### What the authority does (read, not recalled)

- Anger Point is `onHit` (`data/abilities.ts:131-137`): `if (!target.hp) return; if (... crit) this.boost({atk: 12}, target, target)`.
  The Champions mod does not override it (`data/mods/champions/abilities.ts` holds no `angerpoint`).
- The Champions mod overrides `spreadMoveHit` (`data/mods/champions/scripts.ts:315-425`), and the override numbers
  its own steps:
  - `spreadDamage` at `:369`
  - "3. onHit event happens here", `runMoveEffects`, at `:375`
  - `selfDrops` at `:385`
  - `secondaries` at `:388`
  - `runEvent('DamagingHit')` at `:410`
- Inside `runMoveEffects` the move's own `singleEvent('Hit')` comes first, at `sim/battle-actions.ts:1279`. The
  `runEvent('Hit', target, source, move)` follows at `:1283`.
- `Battle#boost` (`sim/battle.ts:2047-2049`) writes Anger Point's `-setboost|…|atk|<stage>|[from] ability: Anger
  Point`. Every other ability writes a bare `|-ability|BODY|Name|boost`, and then `-boost` or `-unboost` lines with no
  `[from]` (`:2065-2069`).

So on a crit Chilling Water the authority maxes Attack first and then applies the secondary's -1: **+5**.

### What we did

`buffsHolderOnHit` was derived from `onDamagingHit || onHit` (`engine/tag_dex.js`). Every member was paid in the
`DamagingHit` steps, which run below `_stepEffects` (step 5). The -1 landed first and the +12 clamped the stage back
to **+6**.

### Fix

- **`engine/tag_dex.js:8509`:** a new field, `buffsHolderOnHit.event`, derived from which handler writes the payload.
  Printed before wiring: it matched `angerpoint=Hit`, and `electromorphosis`, `justified`, `stamina` and `weakarmor`
  as `DamagingHit`. No member was ambiguous.
- **`data/tags.json`, `data/abra-tags.js`:** the worktree has no store, so a full `tag_dex` regeneration would zero
  every usage count. It was run to scratch, and then **only the `event` field** was written into the committed file,
  by a script that refused any other difference in those five params. The diff is 5 added lines.
  `build/build_tags_js.js --check` passes.
- **`engine/medicham2-browser.js`:**
  - `_stepHitEvent` (`:45745`) is placed in `_STEPS` between `_stepApply` and `_stepSelfPay` (`:46164`).
  - `_buffEventOf` (`:45731`) reads the tag. A missing `event` is counted in `MEDFAILS.buffOnHitEventUnknown` and keeps
    the old position.
  - An interior volley arrival pays a `Hit`-event buff above that arrival's `_bondArrivalEffects` (`:42748`).
  - The `MEDI_DH_STEPS_SPLIT` layout guard is at `:45525`.
  - A crit Clear Smog into Anger Point now clears first and then maxes, which is the authority's
    move-`onHit`-then-ability order (`_hitEventClear`, guard at `:44087`). Checked: from -2/-2 the result is
    `[6, 0]`, with one clear per row. The result is the same under the knob.
- **Knob:** `MEDI_HIT_BUFF_AT_DAMAGING_HIT=1` (`:16236`) is stamped at load in `MEDFAILS.hitBuffAtDamagingHitRestored`,
  and it is listed in `DELIBERATE_BREAK`.

### Proof

| instrument | clean | under the knob |
|---|---|---|
| census row `buffsHolderOnHit` "Anger Point maxes Attack BEFORE the same hit's secondary drop" (`tests/test-mechanics.js:30270`) | LIVE: test 5, crit-only 6, drop-only -1 | **MISSING**, 967/968, census REFUSED to write |
| census row, before the fix (engine at HEAD) | **MISSING** (test 6), 967 live / 1 missing | n/a |
| `tests/probe_hit_event_buff_order.js`: 221 pairs, two engines, arm `bottom-tie-first`, ×6 pool, boards and streams | **PASS**: 0 clean partings of either kind | 37 of 37 exercised Anger Point pairs PART (5 of them part a BOARD: Breaking Swipe, Chilling Water, Lunge, Play Rough, Trop Kick); 71 exercised controls outside the `Hit` event HOLD |
| the same probe, before the fix (`--only angerpoint`) | **FAIL**: every Anger Point pair parts on the clean load, `-setboost` against `-unboost` | n/a |

**The class, derived by the probe on every run.** Legal abilities whose `onHit`, `onDamagingHit` or
`onAfterMoveSecondary` handler calls `boost(`:

- Anger Point (`onHit`)
- Stamina, Justified, Weak Armor and Gooey (`onDamagingHit`)
- Berserk (`onAfterMoveSecondary`)

Excluded, with the reason read off the handler:

- Lightning Rod, Motor Drive and Sap Sipper (`onTryHit`): they absorb the move, so no secondary runs.
- Competitive and Defiant (`onAfterEachBoost`): they are triggered by the secondary itself.
- Battle Bond, Eelevate and Moxie (`onSourceAfterFaint`).

Rattled, Steam Engine, Water Compaction, Thermal Exchange, Anger Shell and Cotton Down have **0 legal carriers**.

The move class: **40** legal damaging moves with a stat-changing secondary on the target. Of 240 pairs, 221 were
staged and 19 were not. The 19 name their reason: Bitter Malice, Night Daze and Lumina Crash have no legal learner
with a quiet ability, and Berserk has no Sleep Talk carrier that takes a Ghost hit.

**What was exercised, per the authority's own log.** A pair counts only when both the ability and the secondary
acted:

| ability | exercised |
|---|---|
| Anger Point | 37 of 37 |
| Stamina | 37 |
| Weak Armor | 18 |
| Gooey | 14 |
| Justified | 2 |
| Berserk | 0 |

Justified needs a Dark hit, Weak Armor a physical one and Gooey contact. Berserk's half-HP trigger cannot be crossed
at ×6, and its position is held by the existing census rows `boostsAtHPThreshold` ("Berserk fires on the hit that
CROSSES half", "...announces BELOW the hit count"). A pair that was not exercised is reported and **never** counted
as a pass.

**Neighbouring probes, all green on the new tree:** `probe_damaginghit_walk`, `probe_damaginghit_order`,
`probe_bond_secondary_order`, `probe_protean_contrary` (42 arms) and `probe_multihit_reaction_per_arrival`.

**Scoreboard expectation, stated.** Anger Point has 27 sheet uses (`data/tags.json`). The pinned pool should not
move, and the lab moved.

## 2. THE INSTRUMENT BLIND SPOT (item 2)

`engine/all_mechanics_fire.js`:

- **Row field `control_arm_parted`** (`noteControlParting`, `:4630`). It is set when any control arm of the row
  (every planner variant, or the ladder's own control game) reads anything other than NO-DIVERGENCE or NOT-STAGED.
  Its contents:
  - `board_material`: true when any control arm reads STATE
  - `verdicts`: the verdicts seen
  - `where`: `branch/layout=verdict` for each control arm that parted
  - `control`
  - `first_state_diffs`
- **Summary `summary.control_arm_partings`** (`:5302`). Its fields are `rows_with_control_arm`, `parted`,
  `board_material`, `announcement_only`, `not_asked`, `by_kind{moves,abilities,items}` and `rows[]`. The same numbers
  are printed as `CONTROL-ARM PARTINGS — …`.
- **The field MEASURE wires: `summary.control_arm_partings.board_material`** (a count; the bar is 0). The per-row form
  is `rows[kind][i].control_arm_parted.board_material === true`. `not_asked` is kept apart for a CANNOT-ANSWER
  reading. `engine/quarantine.js` was not edited.
- Move rows: `row.planned[]` now carries `control_board`, so a battery run can surface a move's control arm.

### Rows whose CONTROL arm parts

| source | row | control | verdict |
|---|---|---|---|
| published main-tree `data/all-mechanics-fire.json` (release `d92bdfb50d88`, generated 16:31:26Z, mtime checked against the clock, no writer live) | **ability Hyper Cutter** | Anger Point | **STATE** on near-a and far-a: `boosts.atk` us 6, sd 5 |
| same | ability Magma Armor | Anger Point | ANNOUNCEMENT-ONLY on near-a and far-a |
| same | all 148 items | item removed | NO-DIVERGENCE |
| same | moves | — | **CANNOT ANSWER**: the published artifact records no move control-arm verdict |
| named re-run, `d92bdfb50d88`, old chooser (red demonstration of the field) | Hyper Cutter / Magma Armor | Anger Point | `control_arm_partings`: 2 of 8 parted, 1 BOARD-MATERIAL, 1 announcement-only |
| named re-run, `ccabb2b6e953`, old chooser (engine fix isolated) | all 8 | unchanged controls, Anger Point included | **0 of 8** |
| named re-run, `ccabb2b6e953`, new chooser | all 8 | see §3 | **0 of 8** |

Named rows: `angerpoint, frisk, hypercutter, magmaarmor, solidrock, stalwart, swarm, unaware` (abilities). The flags
were `--release <id> --kind abilities --only <those> --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen
--write --out <scratch>`. Each run played 91 games with 0 threw. No main-tree artifact was written.

## 3. QUIET CONTROLS (item 3)

**Is a live control weaker proof? Yes, and it is not hypothetical.** FIRED means both engines' games moved between
the arms. When the control ability acts on its own board, that movement can be the control's alone, and the
carrier's handler may never have run. The gate's PROOF clause reads "the subject moved the board on BOTH engines and
the control did not" (`engine/quarantine.js:959`). That is false for a live control.

The receipts below come from the authority's own log of the control game. They were read with the same
`abilityActedOn` reader the board-only rows use. On the 8 named rows with the old chooser, **5 controls acted in
their own game**:

- Frisk's Cursed Body
- Hyper Cutter's, Magma Armor's and Solid Rock's Anger Point
- Stalwart's Stamina

Two of those rows lose their planner FIRED once the control is quiet:

- **Frisk** reads **DID-NOT-FIRE** against Insomnia. The fixture holds no item for Frisk to reveal, so the old FIRED
  was Cursed Body disabling on the hit. Frisk is owner-deferred (`tests/roster.js` DEFERRED, Will 2026-09-18), so the
  gate excuses it.
- **Stalwart's** planner fixture reads DID-NOT-FIRE against Sturdy. It falls back to the ladder, which reads FIRED
  against Stamina, and Stamina is itself live. The verdict is unchanged; the credit is still unearned.

**The published `control_not_quiet` (154) is a population test.** It flags a control whenever that ability's OWN
row moved a game anywhere. So Iron Fist counts as "not quiet" on a board with no punching move. It over-counts, and
it cannot tell a control that acted from one that could not.

**The chooser change** (`engine/stage_planner.js`):

- `loudOnBoard` (`:2262`) checks every handler of the alternative that writes (a leaf rule, `chainModify` or a
  returned number) and runs when the carrier is struck or strikes. The handler is **loud** if that event happens on
  this board and its gate is met. The gates are read from the handler's own text:
  - a move need
  - `move.type ===`
  - the stat its event name reads (Atk means Physical, SpA means Special)
  - contact
  - weather or terrain from the board's clicks
  - `!target.hp &&` on a ×6 pool
  - a crit on the `bottom-tie-first` arm, which lands every crit
- It over-matched twice before it was trusted, and both were caught by printing what it matched. First it read
  Blaze, Torrent, Overgrow, Plus, Thick Fat, Water Bubble and Rough Skin as loud without their gates. Then it read
  Anger Point's `if (!target.hp) return;` early exit as a faint gate, which hid Anger Point itself.
- `preferQuiet` (`:2306`): among the alternatives the existing chain already accepts, a quiet one is taken. Where
  none is quiet, the old first choice stands. **It is a preference, never a gate**: 196 controlled rows before, 196
  after.
- `fixture.control` now carries `quiet`, `loud`, `first_passing`, `first_passing_quiet` and `passing`. The rows carry
  them as `planner.control.*`.
- Knob: `STAGE_PLANNER_FIRST_PASSING_CONTROL=1` (`:2258`). It reproduces all **137 of 137** published planner
  ability-swap controls.
- `tests/test-stage-planner.js` is **GREEN**, every red demonstration included.

**Counts.** These come from planning all 316 ability mechanics. The planner plays no games.

| chooser | ability-swap controls | quiet on own board | loud |
|---|---|---|---|
| old (first passing) | 156 | **139** | 17 |
| new (prefer quiet) | 156 | **145** | 11 |

The six rows that changed:

| row | old control | new control |
|---|---|---|
| Frisk | Cursed Body | Insomnia |
| Hyper Cutter | Anger Point | Iron Fist |
| Solid Rock | Anger Point | Magma Armor |
| Stalwart | Stamina | Sturdy |
| Swarm | Sniper | Insomnia |
| Unaware | Cute Charm | Magic Guard |

The 11 still loud have no quiet legal alternative on their board. They are Damp, Gale Wings, Hydration, Infiltrator,
Insomnia, Magma Armor, Minus, Plus, Poison Touch, Shell Armor and Tough Claws. Their controls are Electromorphosis,
Flame Body, Gooey, Static, Poison Point and Sniper, each on a contact or crit hit.

**Empirical, named rows only.** In the control game's own log:

- old chooser: 5 of 8 controls acted
- new chooser: 1 of 8 (Magma Armor's Anger Point, with no alternative)

The artifact now carries these per row as `control_acted`, and in the summary as
`summary.abilities.control_quiet_on_board.{quiet, loud, acted_in_control_game, receipt_read}`.

## 4. FILES CHANGED (all in the worktree, nothing committed)

- `engine/medicham2-browser.js`: `_stepHitEvent`, `_buffEventOf`, `_hitEventClear`, the interior-arrival order, the
  knob, and 3 counters.
- `engine/tag_dex.js`: `buffsHolderOnHit.event`.
- `data/tags.json`, `data/abra-tags.js`: only the `event` field on 5 members.
- `engine/all_mechanics_fire.js`: `noteControlParting`, `control_arm_parted`, `summary.control_arm_partings`,
  `control_acted`, `summary.abilities.control_quiet_on_board`, and `planned[].control_board`.
- `engine/stage_planner.js`: `loudOnBoard`, `preferQuiet`, the `FIRST_PASSING_CONTROL` knob, and the control stamp.
- `tests/test-mechanics.js`: one census row, plus the knob in `DELIBERATE_BREAK`.
- `tests/probe_hit_event_buff_order.js`: new.
- `data/mechanics-census.json`: regenerated, 968/968.
- `docs/ENGINE.md`: the new section, the hand list, and the owns list.
- **Not mine, seen:** `tests/probe_protean_contrary.js` has no `_live_release` preload. It cut `ccabb2b6e953` into this
  worktree's `data/releases/` and repointed `data/engine-release.json`. The pointer was restored from a pre-run copy.
  The release directory is gitignored and was left in place.
- **Processes:** every process I started ended on its own, and none was killed.

## PROPOSED NOTES ROW

```
### <<VER>> — 2026-09-19 — Anger Point is paid at the Hit event; control-arm partings are a row finding; the planner prefers a quiet control

**What changed.** MEDICHAM paid Anger Point (`onHit`, data/abilities.ts:131-137) with the `DamagingHit` family, below the
same hit's secondary, so a crit Chilling Water left Attack at +6 where the authority leaves +5 (the Champions
`spreadMoveHit` runs `runMoveEffects` at scripts.ts:375, the secondaries at :388, `DamagingHit` at :410). It is now
paid at a `_stepHitEvent` step, read off a derived tag field `buffsHolderOnHit.event` (Anger Point = Hit; the other
four = DamagingHit). Knob `MEDI_HIT_BUFF_AT_DAMAGING_HIT=1`. `engine/all_mechanics_fire.js` records a parted control
arm on the row (`control_arm_parted`) and counts it (`summary.control_arm_partings.board_material`); the Hyper Cutter
control-arm divergence on d92bdfb50d88 was read by no clause. `engine/stage_planner.js` prefers a control that is
quiet on its own board (knob `STAGE_PLANNER_FIRST_PASSING_CONTROL=1`).
**Figures.** Census 967 → 968 live / 0 missing (data/mechanics-census.json). tests/probe_hit_event_buff_order.js: 221
pairs, PASS clean; 37 Anger Point pairs red under the knob, 71 controls held. Quiet ability-swap controls 139 → 145 of
156 (planner, no games); 196 controlled rows before and after. Named rows on worktree release ccabb2b6e953: 0 of 8
control arms part (2 of 8 on d92bdfb50d88, 1 board-material). Light mode: no battery, lattice or gate run.
**Supersedes.** Nothing published. Two planner FIRED verdicts (Frisk, Stalwart) were earned by a live control; Frisk
reads DID-NOT-FIRE against a quiet one (owner-deferred), Stalwart falls back to a ladder FIRED whose control is live.
**Basis.** unchanged
**Owes.** docs/ABRA-technical-docs.md (the staged-game battery's control arm and the new summary field) at the next major.
```

## OWED, NOT RUN

1. **The full staged-game battery on `ccabb2b6e953`**, pinned (`--release ccabb2b6e953 --team-store
   data/team-pool-frozen`, census pin). It is the only way to populate `summary.control_arm_partings` for all
   moves, abilities and items. Moves are CANNOT ANSWER on the published artifact. It also shows how many other FIRED
   rows change under the quiet-control chooser. Expect Frisk to read DID-NOT-FIRE (owner-deferred, excused) and
   Stalwart to fall back to a ladder FIRED.
2. **MEASURE:** wire `summary.control_arm_partings.board_material` (bar 0) into the gate, with `not_asked` as
   CANNOT-ANSWER. A second clause question: should a FIRED row whose `control_acted` is non-empty (or whose
   `planner.control.quiet === false`) count as PROVEN? Today it does. `engine/quarantine.js` was not touched.
3. **The ladder's own control chooser** (the legacy path) was not changed. Stalwart's fallback control is Stamina,
   and it acts on the hit. The same `loudOnBoard` preference could be applied there.
4. **The lattices and `quarantine.js`** on the new engine bytes. Anger Point is 27 sheet uses; the expectation is that
   the pinned pool does not move.
5. **Berserk against a same-hit secondary** was never exercised (the ×6 pool cannot cross half). Its position is held
   by the `boostsAtHPThreshold` census rows, not by this probe.
6. **`tests/probe_protean_contrary.js` cuts into the real release store** when run without `--release`. It should
   preload `tests/_live_release.js` like its neighbours.
7. **`data/tags.json` was patched, not regenerated**, because the worktree has no store. The next `tag_dex` run on the
   main tree reproduces the same `event` values. They were derived by the same code, and the patch refused any other
   difference.
8. CHANGELOG, RUNNING-NOTES and `status.js --write` belong to the coordinator (the proposed row is above).
