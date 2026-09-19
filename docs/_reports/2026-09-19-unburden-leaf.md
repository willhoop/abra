# 2026-09-19 — Unburden: held as state, compared on the board, red under every break

ENGINE division, isolated worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a4c94fe09cbc9f077`.
LIGHT MODE: staged boards, single probes, 12 pool-team games. No lattice, no roster stage, no quarantine, no
all_mechanics_fire. Release cut in this worktree: **`22fc779a0806`** (pointer `data/engine-release.json` restored
to `4c9b0cc4a4da` afterwards).

Will, 2026-09-19: *"we need unburden to fire its a common one. i know the chat/log wont announce it but we need to
track it and in open team sheets we know if a mon is unburden or not and if its held item was consumed"*.

## Verdict

- **Why it was uncomparable:** medicham2 held NO state for it. `engine/board_state.js` `NOT_COMPARED` said so
  (*"THE ENGINE HOLDS NO STATE UNDER THIS NAME"*): `effSpeed` recomputed the doubling from `_hadItem && !m.item`
  and the current ability. A comparator could only have recomputed the rule itself. The row's own `wrong_if` was
  "medicham2 ever grows a named field for it".
- **Now compared:** yes. `vol.unburden` (presence) on both engines, active and bench. The row is deleted.
- **Red demo parts:** yes, on all 10 staged roads, and the clean runs are silent.
- **One real divergence found and closed:** an Unburden body that walked in empty-handed, took an item mid-stint
  and then lost it never doubled here. Authority 344, ours 172 (pre-change release `4c9b0cc4a4da`).
- **Pool:** 4,121 of 17,381 frozen-pool games carry Unburden on an open sheet; 2,845 brought it. The store records
  item ends only from 2026-08-10 (744 bo3 games); inside that window 85 of 161 brought-carrier games show the
  carrier's item ending. 12 of those games' teams played on `22fc779a0806`: 5 granted, 0 leaf diffs, 0 board diffs.
- **Census:** 955 → **956 live / 0 missing**.

## 1. The authority, read (Champions mod first)

`data/mods/champions/` has no `unburden` key in any of its eight files (`grep -n -i unburden` returns nothing), so
mainline runs.

| what | where |
|---|---|
| `onAfterUseItem` → `pokemon.addVolatile('unburden')` (holder only) | data/abilities.ts:5228-5231 |
| `onTakeItem` → `pokemon.addVolatile('unburden')` | data/abilities.ts:5232-5234 |
| `onEnd` → `pokemon.removeVolatile('unburden')` | data/abilities.ts:5235-5237 |
| condition `onModifySpe`: `if (!pokemon.item && !pokemon.ignoringAbility()) chainModify(2)` | data/abilities.ts:5238-5244 |
| `eatItem` raises `AfterUseItem` | sim/pokemon.ts:1810 |
| `useItem` raises `AfterUseItem` | sim/pokemon.ts:1850 |
| `takeItem` raises `TakeItem` before the slot empties | sim/pokemon.ts:1861 |
| Fling's condition raises `AfterUseItem` | data/moves.ts:5780 |
| ability End on setAbility | sim/pokemon.ts:1928 |
| switch-out: ability End at :103, THEN `copyVolatileFrom` at :114, THEN `clearVolatile` | sim/battle-actions.ts:103-117 |
| Champions `clearVolatile` empties `volatiles` | data/mods/champions/scripts.ts:124 |
| Gastro Acid's `onStart` runs the ability End | data/moves.ts:6451 |
| `Dex.conditions.getByID('unburden').noCopy` | `false` (read at run time) |

**Readable at a turn boundary:** yes. `pokemon.volatiles.unburden` stands from the grant until the ability ends or
the body leaves.

**Two consequences that the brief assumed the other way, both decided by the authority:**
- **Regaining an item does NOT end the volatile.** Nothing removes it on `setItem`. It only stops the doubling. A
  Trick swap grants it to an Unburden holder in the same action it receives an item.
- **Baton Pass does NOT carry it off an Unburden holder,** although `noCopy` is false: the ability End runs first.
  My first implementation carried it; the probe's `baton` arm parted on the recipient (medicham 1, showdown 0).

## 2. What changed

**engine/medicham2-browser.js**
- `_ubVol` (the grant-time multiplier) is granted by `ubGrant(m, road)` at the three loss doors:
  `consumeBerry` (eat), `recordItemUsed` (use; the Fling caller passes `'fling'`), `itemLose` (take). The ability
  is read AT the loss, which is when the authority's handler runs.
- Ends in `ubAbilityRewrite` only when the OUTGOING ability owns it; `ubClearOnLeave` from `switchOut` and
  `bringIn`; `battleInit` stamps 0; `capturePassedState` refuses to carry it off an Unburden holder.
- `effSpeed` reads `ubMult(m)` = `_ubVol && !itemOn(m)`. `itemOn` is the identity read, so a Magic Room-parked item
  still blocks it. The old predicate is `ubLegacyMult`, selected by `MEDI_ROOM_ITEM_IS_LOST`,
  `MEDI_UNBURDEN_FROM_CURRENT_ABILITY` and `MEDI_UNBURDEN_BREAK=legacy-read`. The existing knobs keep working.
- Counters: `unburdenGranted` (+ per road), `unburdenEndedByAbility`, `unburdenClearedOnSwitch`,
  `unburdenPassedByBaton` (expected 0), `unburdenLegacyDisagrees` (+ first example): the reads where the retired
  predicate would have answered differently.
- Knob `MEDI_UNBURDEN_BREAK=<mode>`: `no-eat | no-use | no-fling | no-take | survives-switch | ends-on-regain |
  survives-ability-end | baton-carries | legacy-read`. An unknown mode THROWS at load. Stamp
  `MEDFAILS.unburdenBreakKnob`.

**engine/board_state.js** — `vol.unburden` in `mediBody` (`m._ubVol ? 1 : 0`) and `sdBody`
(`v.unburden ? 1 : 0`). The NOT_COMPARED row is deleted and a note is left in its place.
`tests/probe_uncompared_leaves.js` now reads 80 written / 56 compared / 4 declared (`curse`, `healblock`,
`powershift`, `yawn`).

**The consequence (Speed)** is already compared at every boundary by the driver's `speedAgree` (getActionSpeed
against effSpeed, ROADMAP #290). That comparison is not a board leaf. The `item` leaf was already compared, and
presence plus item covers the whole condition except `ignoringAbility()`.

## 3. Proof — `tests/probe_unburden_leaf.js`

`node tests/probe_unburden_leaf.js --release 22fc779a0806` → **PASS, 10 arms, exit 0**. Every fixture is validated
by the format's TeamValidator. Carriers are derived: the legal Unburden bodies are Sceptile, Liepard, Slurpuff,
Hawlucha and Sneasler. Each arm requires the AUTHORITY to hold the volatile at some boundary, or to drop it for the
`dropped` arms.

| arm | road | clean | knob | knob result |
|---|---|---|---|---|
| eat | Glare → Lum Berry eaten | 0 leaf diffs, 0 board, 0 speed | no-eat | b1 medicham 0 / showdown 1 |
| use | Close Combat → White Herb | same | no-use | b1 0/1 |
| fling | Fling Focus Sash | same | no-fling | b1 0/1 |
| take | Knock Off | same | no-take | b1 0/1 |
| trick | Liepard Tricks for a Sitrus (volatile while HOLDING) | same | no-take | b1 0/1 |
| switch | knocked off, switched out (bench) | same | survives-switch | b2 `party.sneasler` 1/0 |
| regain | knocked off, Thiefs a Leftovers (volatile survives) | same | ends-on-regain | b2 0/1 |
| ability-end | knocked off, Worry Seeded | same | survives-ability-end | b2 1/0 |
| acquired | walks in empty, Thief, knocked off | same | legacy-read | leaf 0 diffs; **Speed 344 vs 172** |
| baton | Hawlucha knocked off, Baton Pass | same | baton-carries | b2 recipient 1/0 |

**Before, on `4c9b0cc4a4da`:** `--only take` shows clean leaf diff b1 medicham 0 / showdown 1 (the old engine held
nothing), and the knob does not load. `--only acquired` shows the leaf parting and **2 Speed disagreements, 344 vs
172**. That is the real divergence.

## 4. Other instruments run (worktree, live tree or the cut release)

- `tests/test-mechanics.js`: **956 live / 0 missing / 956 probed**, directCall 1 (unchanged). Three rows emptied the
  hand with `m.item = ''`, which grants nothing now. Each now loses the item through a real turn: a 999-Atk Dragon
  Claw popping a Sash, or a Knock Off. Each asserts its fixture. New row: *"an item STOLEN mid-stint and then knocked
  off still procs Unburden"*. On the pre-fix read it gives test `165,165,165` (MISSING); fixed, it gives
  `165,165,330`. Measured in scratch under `MEDI_UNBURDEN_BREAK=legacy-read`; the census was not rewritten under the
  knob.
- `tests/probe_leaf_widening.js`: PASS. The unburden arm now clears `_ubVol` (and `_hadItem` for old releases), and
  its residual line reads the comparator: "COMPARED".
- `tests/probe_unburden_herb_paths.js`: ALL CLAUSES HELD.
- `tests/probe_unburden_acquired.js --release 22fc779a0806` (ROADMAP #535, Skill Swap acquisition): GREEN, 7 of 7.
- `tests/probe_room_unburden.js`: speed AGREE on all four arms, old and new release. **Probe defect fixed:** it
  priced the release's bodies with the LIVE `effSpeed` (line 38). On the old release that printed "SPEED DIFFERS
  172/344" for arm C, which doubled correctly. It now uses `G.REL.require`.
- `tests/probe_red_demo.js`: its `speedOnItemLoss` arm is re-aimed the same way and is OK. The file is **RED at HEAD
  already**, byte-identical counts at HEAD and here (199 demonstrations, 3 HOLLOW, 6 COULD NOT BE APPLIED, 3 not in
  format; WIRE 129 FAIL, WIRE 3/6/8 stale). Measured by running HEAD's two files and restoring mine; sha256 was
  checked on restore. Not introduced here and not fixed here.
- `tests/roster.js`: the `ability/speed-on-item-loss` red plant's anchor would have matched zero times. It is
  re-aimed at `if(_ubm)_mods.push(_ubm);}`, which occurs once. The roster stage was not run (light mode).
- `tests/probe_leaf_name_map.js`: the DECLARED address for `volatile:unburden` is updated to `_ubVol`.
- `node engine/status.js` (read-only): census 956/956. Every gate artifact now reads MEASURED AGAINST A DIFFERENT
  ENGINE (`4c9b0cc4a4da` vs `22fc779a0806`), as it must after an engine change. The run rewrote
  `data/provenance-stamp.json` because the worktree lacks `_scratch-bench-smoke.json`. That change is restored.

## 5. Pool exposure (main tree `data/team-pool-frozen`, read-only)

| | ots | bo3 |
|---|---|---|
| games | 4,167 | 13,214 |
| an Unburden body on an open sheet | 1,191 | 2,930 |
| … and brought | 751 | 2,094 |
| games recording ANY item end (`ei`, engine/durable-ingest.js:411) | 0 | 744 (from 2026-08-10) |
| inside that window: brought carrier / its item ended | — | 161 / **85** |
| how it ended (bo3) | — | White Herb 70, Focus Sash 14, Knock Off 1, berry eaten 1 |

Carriers on sheet: Sneasler 4,290, Sceptile 97, Hawlucha 29, Liepard 3, Slurpuff 2. Items: White Herb 3,409,
Focus Sash 837. The store's event coverage makes 85 a floor, not a rate for the whole pool. A proxy: 1,740 bo3 and
453 OTS games show a Sneasler Close Combat.

**Pool-team play on `22fc779a0806`** (`--pool …/team-pool-frozen --pool-max 12`): 12 games. These are the TEAMS
of real games, played by the driver's own chooser; the store keeps effects, not choices. Results:
- **5** games where the authority granted `unburden`.
- **0** `vol.unburden` diffs, **0** other board diffs, **0** Speed rows on Unburden bodies.
- Engine receipts: `unburdenGranted 5` (all `use`), `unburdenClearedOnSwitch 3`, `unburdenLegacyDisagrees 0`.

So on these pool teams the fix moved no Speed. What it adds is sight: a wrong Unburden state would now part the
board.

## 6. Observed during the first pass (both FIXED in §7)

- **Gastro Acid suppressed nothing.** Scratch: Sneasler knocked off (330), then Gastro Acid → effSpeed still 330,
  `_ubVol` 2, `_vol.gastroacid` present.
- **Magic Room hp part.** `probe_room_unburden.js` arms A/B parted on `hp` (authority 99, ours 118) on both
  releases, the Pressure control included. It was Knock Off's ×1.5 (§7.2).
- `tests/probe_leaf_widening.js` prints `3 illegal — 3 NOT baselined` fixtures (Alakazam: Recycle, Power Trick,
  Gravity) in other arms — pre-existing, not touched.

## 7. Follow-up, same session (coordinator: close Gastro Acid, the Magic Room HP difference, and `probe_red_demo.js`)

Release **`af6ed10008b8`** (cut in this worktree; pointer restored to `4c9b0cc4a4da`). Census **956 → 959 live /
0 missing / 0 hollow**, directCall unchanged at 1.

### 7.1 Gastro Acid — the ENGINE was wrong

- **Authority:** `Pokemon#ignoringAbility` returns true on `volatiles['gastroacid']` (sim/pokemon.ts:870), after
  `cantsuppress` answers (:869); the condition's `onStart` writes `-endability` and fires the ability's End
  (data/moves.ts:6448-6452). No Champions key. **Legal learners, derived:** Arbok, Victreebel, Victreebel-Mega,
  Snorlax, Serperior, Eelektross, Eelektross-Mega (7).
- **Fix, one shared place:** `abSuppress` PARKS the ability (`m._abParked`, `m.ability = ''`) — Magic Room's item
  mechanism applied to abilities — so every `m.ability` reader sees none at once, `ubGrant` and the Unburden leaf
  included; the End runs at suppression (Flash Fire's gift, Unburden's volatile via `ubAbilityEnd`). `abilityOn(m)`
  is the identity: the board's `ability` leaf, and the copy sources (Skill Swap, Trace, Role Play/Entrainment,
  Mummy/Wandering Spirit). A rewrite (`abRewrite`), a mega or a transform on a parked body writes the park;
  `switchOut` unparks above `abRestoreOnLeave`; `bringIn` unparks as a counted fallback.
- **Tag:** new DERIVED move tag `suppressesAbility` (engine/tag_dex.js, read off `ignoringAbility`'s source) —
  `gastroacid` alone. `data/tags.json` was SPLICED (one entity + one row; `uses` taken from the entity's own
  store-derived field; the no-store run changed the shape of `gastroacid` and nothing else).
- **Narration:** `-endability` emitted and CLAIMED; its declared-not-emitted reason is deleted from
  engine/derive_protocol_events.js and data/protocol-events.json regenerated (both gates pass).
  `tests/test-protocol-trace.js` gains a Gastro Acid board so PART 1 sees it fire (ALL PASSED).
- **Proof:** `tests/probe_gastro_acid.js --release af6ed10008b8` PASS 3/3. **Before the fix** both red arms parted
  (`unburden-end`: leaf medicham 1 / showdown 0 + 2 Speed rows; `rough-skin`: Arbok hp 119 / 135), and ours wrote
  `-start … move: gastroacid` where the authority wrote `-endability`. After: 0 diffs, identical lines. Under
  `MEDI_GASTRO_SUPPRESSES_NOTHING=1` both red arms part again; the `switch-restores` control stays silent.
- **Census rows:** "Gastro Acid stops the target's Rough Skin chipping a contact attacker" (Protect 17, Gastro Acid 0)
  and "Gastro Acid ends Unburden" (165,330,330 vs 165,330,165) — both MISSING under the knob (scratch).
- **Probe re-aimed, not the engine:** `tests/probe_ability_flag_refusal.js` compared our live slot (`""`) with the
  authority's identity (`intimidate`); it now reads the identity — all checks pass.

### 7.2 The Magic Room HP difference — the ENGINE was wrong

- **Cause:** Knock Off's `onBasePower` reads `target.getItem()` (data/moves.ts:9971-9977) and Poltergeist's `onTry`
  reads `target.item` — the identity, untouched by `ignoringItem()`. Our three `readsTargetItem` / `targetHasItem`
  readers asked the slot the room/Klutz park empties. 56 / 37 = ×1.5. No Champions override.
- **Fix:** `targetItemOf` (identity via `itemOn`) at all three sites — the base-power branch, Poltergeist's refusal,
  its `-activate` item name. Knob `MEDI_TARGET_ITEM_READS_SLOT=1`.
- **Proof:** `tests/probe_room_target_item.js --release af6ed10008b8` PASS 4/4. Before the fix (and under the knob):
  `knockoff-room` Clefable 150 / 140, `knockoff-klutz` Audino 139 / 120, `poltergeist-room` 170 / 47 (we refused
  the click); the `knockoff-noroom` control agrees throughout. `probe_room_unburden.js` now AGREEs on speed,
  protocol and board in all four arms.
- **Census row:** "Knock Off keeps its x1.5 against an item Magic Room is suppressing" (no room 25 = room 25;
  empty hand lower).

### 7.3 `tests/probe_red_demo.js` — the PROBE was wrong, all five rows

At HEAD: 199 demonstrations, 3 HOLLOW, 6 COULD NOT BE APPLIED, exit 1 (measured by running HEAD's engine and demo
bytes, then restoring mine with sha256 checked).
- **WIRE 129 Wide Lens (HOLLOW):** its reversal renamed `ACCMOD` keys, which only `MEDI_ACCMOD_BY_NAME=1` reads since
  2026-09-18 (the row comes off the `accuracyMod` tag). Re-aimed at the tag lookup for those two items.
- **WIRE 6 ×2 (threw):** "no legal move degrades to `{kind:pass}` any more" — now a derived N/A (ROADMAP #256's
  pattern) that re-arms itself the day one does.
- **WIRE 3, WIRE 8 ×3 (stale anchors):** re-aimed at the veil `else if`, the expiry closure's `return false;`, and
  the charge boost's zero-announcement flag.
- **Now:** 197 demonstrations, **0 HOLLOW, 0 COULD NOT BE APPLIED**, 5 N/A, `ABRA-EXIT 0`.

### 7.4 Also run, green

`probe_unburden_leaf` (10/10), `probe_room_unburden`, `probe_unburden_herb_paths`, `test-engine-consistency`,
`test-effective-identity`, `test-switch-carry`, `probe_leaf_widening`; pool mode on `af6ed10008b8`: 12 games, 5
granted, 0 leaf / 0 board diffs. `tests/staged_board.js`: the two break anchors this pass moved (mawile mega
ability, Knock Off stone refusal) re-aimed and CAUGHT.

### 7.5 Found red at HEAD, NOT fixed here

**`tests/staged_board.js --reds` — 11 of 25 breaks not demonstrated, dead anchors** (flinch, Stealth Rock entry,
`applyStatus`, `survivesFromFull`, Disguise, `reaimToSlot` ×2, `now=foes[...]`, `formeCycleResidual`, an item-slot
write, sand chip). Every one matches **0 times in HEAD's engine too** — not caused by this pass. The file is in
run-all's pending list, so nothing reported it.

## PROPOSED NOTES ROW

```
## [<<VER>>] — 2026-09-19 — Unburden is held as state and compared on the board; Gastro Acid suppresses the ability; Knock Off and Poltergeist read the target's item identity under Magic Room and Klutz; probe_red_demo is green
- **What changed.** `engine/medicham2-browser.js`: (1) the authority's `unburden` volatile is `_ubVol`, granted at the eat / use / fling / take loss doors off the ability held at the loss, ended by its End and by leaving the field, never carried by Baton Pass off its holder (sim/battle-actions.ts:103 before :114); `effSpeed` reads it. (2) Gastro Acid PARKS the target's ability (`abSuppress`, `_abParked`) so every ability reader honours it, fires the ability's End, writes `-endability`; read off the new derived tag `suppressesAbility` (engine/tag_dex.js; `data/tags.json` spliced, one entity). (3) `targetItemOf`: Knock Off's x1.5 and Poltergeist read the target's item identity, as `getItem()` does. `engine/board_state.js`: `vol.unburden` compared; the `ability` leaf reads the identity. New probes `probe_unburden_leaf.js`, `probe_gastro_acid.js`, `probe_room_target_item.js` (knobs `MEDI_UNBURDEN_BREAK`, `MEDI_GASTRO_SUPPRESSES_NOTHING`, `MEDI_TARGET_ITEM_READS_SLOT`). `-endability` claimed (data/protocol-events.json regenerated). `tests/probe_red_demo.js` re-aimed (five rows; the probe was wrong, not the engine).
- **Measured.** Census 955 → 959 live / 0 missing (`data/mechanics-census.json`). On release `af6ed10008b8`: probe_unburden_leaf 10/10, probe_gastro_acid 3/3, probe_room_target_item 4/4, each red under its knob. Pre-change `4c9b0cc4a4da`: Speed 344 vs 172 (stolen item then lost); Rough Skin chip 119 vs 135 after Gastro Acid; Knock Off under Magic Room 150 vs 140. probe_red_demo: 3 HOLLOW / 6 COULD NOT BE APPLIED → 0 / 0. Pool teams (12 games): 0 leaf / 0 board diffs. NO LATTICE FIGURE — not run.
- **Basis.** unchanged — the board comparison gains a leaf and the engine is corrected; the bar and its question are the same.
- **Supersedes.** Nothing published. The gate's OPEN reading on `4c9b0cc4a4da` does not transfer to `af6ed10008b8` and must be re-measured.
- **Owed to the next major.** docs/ABRA-technical-docs.md (board leaves list, ability suppression); the 7.0.0 draft's gate figures if this lands before it publishes.
```

## OWED, NOT RUN

- **The three lattices** (`--games` 1200 / 1350 / 1950, pinned pool, census pin) on `af6ed10008b8`, the three roster
  stages with `--reds`, `data/engine-diff.json`, `engine/quarantine.js`. The gate read OPEN on `4c9b0cc4a4da`;
  engine bytes changed three ways and the board compares one more leaf, so **the OPEN reading does not carry
  over.** The 7.0.0 draft rests on it.
- **Census steering may move the samples:** a new leaf changes `creditTurn`'s families and the census gained three
  rows. Not measured.
- **`tests/staged_board.js --reds`:** 11 dead anchors, red at HEAD (§7.5).
- **`data/tags.json` owes a full, store-backed `node engine/tag_dex.js` in the main tree** — the worktree splice is
  exact for the one entity but a full regeneration is the artifact's own check.
- `node engine/status.js --write` and the CHANGELOG / RUNNING-NOTES row: not run / not written, per the brief.
- No git commit or push (per the brief).

