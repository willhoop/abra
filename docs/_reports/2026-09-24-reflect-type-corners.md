# The two added-type corners of Reflect Type (2026-09-24, abra/regmc 0.109.0 and 0.110.0)

Brief: fix both corners filed in `docs/_reports/2026-09-24-reflect-type.md` §3 (base commit `b4ccb6da`, abra/regmc
0.105.0). Versions here are provisional; the coordinator renumbers.

## 1. Verdict

- **Corner 2, a second added type replaces the first: FIXED (0.109.0), both regulations.**
- **Corner 1, Reflect Type at a typeless target that carries an added type: FIXED (0.110.0), both regulations**,
  with the turn-boundary broadcast that writes the added type on its own line (§5).
- Filed, measured, not fixed: Burn Up on a body carrying an added type keeps it here and clears it there (§6).

## 2. The authority, read whole (both checkouts, Champions mod included)

| block | Reg M-B `pokemon-showdown` | Reg M-C `pokemon-showdown-mc` | Champions override |
|---|---|---|---|
| `Pokemon#setType` / `addType` / `getTypes` | `sim/pokemon.ts:2114-2151` | `sim/pokemon.ts:2109-2146` | none (sim file); the two ranges diff byte-identical |
| `reflecttype` | `data/moves.ts:14878-14909` | `data/moves.ts:14883-14914` | none in `data/mods/champions/moves.ts` |
| `trickortreat` / `forestscurse` | `data/moves.ts:19918` / `:6137` (`addType`) | `:19924` / `:6136` | `trickortreat: { inherit: true, isNonstandard: null }` in both mods; `forestscurse` not overridden |
| `burnup` | mainline | mainline | `isNonstandard: null` in both mods |
| `doubleshock` | mainline | mainline | Reg M-B mod: `isNonstandard: "Past"`; Reg M-C mod: a flags override only |

- `setType(newType)`: `this.types = newType; this.addedType = ''; this.knownType = true; this.apparentType =
  this.types.join('/')`. Every set CLEARS the added type, and `apparentType` never includes it.
- `addType(newType)`: `this.addedType = newType` — ONE slot. A second add overwrites the first.
- `getTypes(excludeAdded)`: runs the `Type` event over `this.types`; if that is empty pushes `Normal`; then
  appends `addedType` unless `excludeAdded`.
- Other writers of `addedType` in the non-mod tree: `transformInto` copies it (`sim/pokemon.ts:1302` / `:1296`),
  `setSpecies` resets it to `species.addedType || ''` (`:1400` / `:1394`; no legal species carries one, derived),
  terastallization clears it (`sim/battle-actions.ts:1948`; out of scope, the Champions mod's `canTerastallize`
  returns null). `Battle#nextTurn` (`sim/battle.ts:1709-1721` / `:1712-1724`) broadcasts `getTypes(true)` (the BASE
  list) as a `[silent]` typechange and then, if there is one, the added type as a `[silent]` typeadd.

## 3. Scope — legality, derived

`Dex.forFormat(<format>)` on each checkout, species filtered `exists && !isNonstandard && tier !== 'Illegal'`
(scratch script, reproduced by the command below). Learners are walked through the format's learnsets.

```
node -e "const {Dex}=require(process.env.SHOWDOWN_PATH+'/dist/sim');const D=Dex.forFormat(F);
  for (const m of ['trickortreat','forestscurse','reflecttype','burnup','doubleshock']) console.log(m, D.moves.get(m).isNonstandard)"
```

| source | Reg M-B | Reg M-C |
|---|---|---|
| Trick-or-Treat | legal (Gourgeist, four sizes) | legal (same) |
| Forest's Curse | legal (Trevenant) | legal (same) |
| Reflect Type | legal (Gengar, Starmie, Stunfisk, Stunfisk-Galar, two megas) | legal (same) |
| Burn Up | legal; mono-Fire learners Arcanine, Typhlosion | legal (same) |
| Double Shock | **`Past` — not in the format** | legal; one learner, Pawmot (Electric/Fighting) |
| a species with `addedType` | none | none |

So both corners are reachable in both regulations and both are in scope. Out of scope, stated: terastallization
(no Tera in Champions), Double Shock in Reg M-B (`Past`), and Double Shock as a way to EMPTY a base list in Reg M-C
(its only legal user is dual-typed, so it leaves `['???','Fighting']`, which is not typeless). Proof in the fixture
itself: each probe puts every body, ability and move to the format's `TeamValidator` first.

## 4. Corner 2 — a second added type replaces the first (0.109.0)

### The defect

`changesTargetType.adds` wrote `t.types=[...t.types,_ty]`. The authority writes one slot, so Trick-or-Treat then
Forest's Curse on a Snorlax is Normal/Grass there and Normal/Ghost/Grass here — and the Ghost's immunities stayed.

### The fix

`engine/medicham2-browser.js`: the added type rides on the types ARRAY as `types._added` (helpers `addedTypeOf`,
`baseTypesOf`, `withAddedType`, beside `transformOnto`). A property of the array is deliberate: every wholesale
`types=` write in the engine (nineteen sites: Soak, Protean, Mimicry, forme changes, Burn Up's spend, the switch-out
rebuild…) builds a NEW array, which carries no `_added`, and that is exactly `setType` clearing `addedType`. The
writes that must keep it carry it by hand, as the authority does: the second add (replaces), Roost's drop (the
`Type` event never touches `addedType`; an emptied base list reads Normal plus the added type) and Transform
(`this.addedType = pokemon.addedType`). Knob `MEDI_ADDED_TYPE_APPENDS=1` restores the append. Counter
`MEDSEEN.addedTypeReplaced`.

### Proof

`tests/probe_added_type_replaced.js` — two engines, whole board, fixture legality from the TeamValidator, the
authority's `addType` read from the checkout. Arms: RED 1 Trick-or-Treat then Forest's Curse; RED 2 the other
order; CONTROL Forest's Curse alone (one add, already agreeing).

| regulation | release | bytes | result |
|---|---|---|---|
| Reg M-B | `0996f70743f9` | base `b4ccb6da` | RED — RED 1 `p2a types` grass/normal vs ghost/grass/normal from boundary 2; RED 2 ghost/normal vs ghost/grass/normal; CONTROL agrees |
| Reg M-B | `ad7726f19a85` | fix | GREEN, exit 0 |
| Reg M-B | `ad7726f19a85` + `MEDI_ADDED_TYPE_APPENDS=1` | fix + knob | RED, 2 red-arm failures |
| Reg M-C | `321b4f63b586` | base | RED, the same two arms |
| Reg M-C | `d4b43852870d` | fix | GREEN, exit 0 |

Census row (`tests/test-mechanics.js`, `changesTargetType`, "a second added type REPLACES the first"): the outcome is
Sneasler's Close Combat into the Snorlax — Trick-or-Treat only 0 (immune), then Forest's Curse on top 272 (lands).

| regulation | live / missing / probed | under the knob |
|---|---|---|
| Reg M-B | 1008 / 0 / 1008 | 1007 / 1 / 1008 (the new row MISSING; the census refused to write) |
| Reg M-C | 1012 / 0 / 1012 | — |

The census artifacts were NOT committed (restored to the committed bytes after reading), as in 0.105.0: the Reg M-B
census is cited by the closed 7.0.0 record and republishing is MEASURE's, from main.

### Pinned differential

Flags: `--steering empirical --arm middle --end-state --games 300 --write --out <scratch>`. Reg M-B: `--census
data/verification/census-pin-833a997d7e42.json --team-store <main>/data/team-pool-frozen`. Reg M-C: `--regulation
regmc --census <main>/data/verification/census-pin-regmc-0d03e83f0e65.json --team-store
<main>/data/team-pool-frozen-regmc`. Board-material = `state.games − state.games_board_never_diverged`.

| regulation | release | games | protocol diverged | board-material |
|---|---|---|---|---|
| Reg M-B | `0996f70743f9` base | 260 | 1 | 0 |
| Reg M-B | `ad7726f19a85` fix | 260 | 1 | 0 |
| Reg M-C | `321b4f63b586` base | 259 | 0 | 0 |
| Reg M-C | `d4b43852870d` fix | 259 | 0 | 0 |

The one Reg M-B protocol divergence is the same game on both (`…bo3-2655708295 vs …bo3-2656203256`, turn 10,
`|-end|p2b: Kingambit|fallenundefined|[silent]`), the pre-existing declared Supreme Overlord line. **No new board
divergence.** As predicted for a rare mechanic, the pool does not move and the lab does.

### Neighbours on the corner-2 tree (live tree, exit codes)

`probe_apparent_type_broadcast.js` (M-B, M-C) 0; `probe_transform_copied_start.js` 0; `probe_transform_faint_revert.js`
0; `probe_typechange_shield_before_bounce.js` (M-B, M-C) 0; `probe_spend_type_fail_named.js` (M-B, M-C) 0;
`probe_regmc_spend_type_before_toll.js --regulation regmc` 0; `test-imposter-transform-line.js` 0.

## 5. Corner 1 — Reflect Type at a typeless target that carries an added type (0.110.0)

### The defect

The typecopy branch copied `t.types` less `???` as the new base list. The authority copies `getTypes(true)` — which
EXCLUDES the added type — less `???`, reads an empty result as `['Normal']` when the target has an added type, and
sets `source.addedType = target.addedType`. So a mono-Fire Arcanine that Burned Up (`['???']`) and was then
Trick-or-Treated copies as **Normal + Ghost** there and as **Ghost** here. The two differ on the board (`p1b types`)
and on every Ghost / Normal / Fighting interaction after it (a Normal/Ghost body is immune to Shadow Ball).

A second, narration-only half sits in the same place: `Battle#nextTurn` broadcasts `getTypes(true)` (the base list
only) and then a `[silent]` typeadd for the added type. This engine broadcast the whole list as one typechange, so ANY
Reflect Type at a foe carrying an added type (CONTROL 2 below: a Trick-or-Treated Milotic) parted the protocol stream
while the boards agreed. It is fixed in the same commit because it is the same missing slot.

### The fix

`engine/medicham2-browser.js`, the `typecopy` branch: the target's base list (`baseTypesOf`) and its added slot
(`addedTypeOf`) are read separately; an empty base list with an added type reads Normal
(`MEDSEEN.typeCopyNormalForTypeless`); the user is written `withAddedType(base, added)` (`MEDSEEN.addedTypeCopied`);
the user's held-back `apparentType` is its old BASE list, as `setType` writes it. The broadcast sweep writes the base
list and then the typeadd (`MEDSEEN.addedTypeBroadcast`). The three stale comments saying "`addedType` HAS NO MEMBER
IN THIS ENGINE" are corrected. Knob `MEDI_REFLECT_TYPE_FOLDS_ADDED=1` restores both halves.

### Proof

`tests/probe_reflect_type_typeless_added.js` — two engines, whole board plus the broadcast lines for the user, fixture
legality from the TeamValidator, the authority's `reflecttype.onHit` read from the checkout. Arms: RED (Burn Up into
its own Milotic, Trick-or-Treat, Reflect Type); CONTROL 1 (no add — the copy FAILS in both engines, so RED's Normal
is the added type's doing); CONTROL 2 (Trick-or-Treat on the non-typeless Milotic, Reflect Type at it).

| regulation | release | bytes | result |
|---|---|---|---|
| Reg M-B | `0996f70743f9` | base | RED — board `p1b types` ghost/normal vs ghost (boundaries 3-4); broadcast parts on RED and CONTROL 2 |
| Reg M-B | `ad7726f19a85` | 0.109.0 | RED, the same three failures (corner 2 does not close corner 1) |
| Reg M-B | `52ae91d50129` | fix | GREEN, exit 0 (all three arms, boards and broadcast) |
| Reg M-B | `52ae91d50129` + `MEDI_REFLECT_TYPE_FOLDS_ADDED=1` | fix + knob | RED, 2 red-arm failures |
| Reg M-C | `321b4f63b586` | base | RED, the same three failures |
| Reg M-C | `d4b43852870d` | 0.109.0 | RED, the same three failures |
| Reg M-C | `28c6364d97a8` | fix | GREEN, exit 0 |

The RED arm's broadcast after the fix, both engines: `|-start|p1b|typechange|normal|[silent]`,
`|-start|p1b|typeadd|ghost|[silent]`.

Census row (`changesTargetType`, "Reflect Type at a typeless target with an added type copies NORMAL plus the added
type"): Stunfisk Reflect Types a Trick-or-Treated Arcanine, then takes Gengar's Shadow Ball. No Burn Up: Fire/Ghost,
168 dealt. Burn Up first: Normal/Ghost, 0 dealt.

| regulation | live / missing / probed | under the knob |
|---|---|---|
| Reg M-B | 1009 / 0 / 1009 | 1008 / 1 / 1009 (the new row MISSING; the census refused to write) |
| Reg M-C | 1013 / 0 / 1013 | — |

Artifacts not committed, as for 0.109.0.

### Pinned differential (same flags and pins as §4)

| regulation | release | games | protocol diverged | board-material |
|---|---|---|---|---|
| Reg M-B | `52ae91d50129` fix | 260 | 1 | 0 |
| Reg M-C | `28c6364d97a8` fix | 259 | 0 | 0 |

The Reg M-B protocol divergence is the same declared `fallenundefined` game as on the base. **No new board
divergence in either regulation.**

### Roster, the four touched moves, on the fix

`node tests/roster.js --stage moves --only reflecttype,trickortreat,forestscurse,burnup --release <fix>`: Reg M-B
`52ae91d50129` and Reg M-C `28c6364d97a8` both 4 FIRED-AND-BOARDS-MATCH, 0 DIFFER, 0 DID-NOT-FIRE, 0 COULD-NOT-STAGE.

### Neighbours on the final tree

The §4 set, re-run on the corner-1 tree: all exit 0. Also `probe_added_type_replaced.js` and
`probe_mimicry_terrain_event_only.js` GREEN on `52ae91d50129` and `28c6364d97a8`.

## 6. Scoreboard, owed, not done

- **Scoreboard.** Rare mechanics (the pool holds no added-type game): the lab moved (two census rows, two probes red
  → green), the pool did not, as predicted.
- **Census, regenerated on this tree.** Reg M-B: 1007 live on the base tree (0.105.0's report; also the 0.109.0 tree
  under its knob, 1007 + 1 missing) → 1009 live, 0 missing. Reg M-C: 1011 (0.105.0's report) → 1013 live, 0 missing. The committed
  artifacts still read 1004 / 1010 and were not republished (MEASURE's, from main).
- **FILED, NOT FIXED, MEASURED: Burn Up on a body that carries an added type.** The authority's
  `setType(getTypes(true).map(Fire → ???))` clears the added type, so a Trick-or-Treated Arcanine that Burns Up is
  `['???']`; this engine maps the whole list and keeps the Ghost. Measured with a scratch variant of the corner-1 probe
  on `52ae91d50129` (Trick-or-Treat turn 1, Burn Up turn 2): `p2a types` sd "" / me "/ghost" from boundary 2.
  Reachable in both regulations. Outside the two filed corners, so not fixed; with `baseTypesOf` it is a one-line
  change at the two `spendsOwnType` sites.
- **Handled, unprobed.** A pure-Flying body that roosts while carrying an added type now reads Normal + the added type
  (the authority's empty-list rule), but no pure-Flying species is legal in either format (derived), so it cannot be
  staged.
- `node engine/status.js --write` NOT run (from a worktree it writes missing untracked files as fact). Not committed:
  `data/engine-release.json` and `data/engine-release-regmc.json` (rewritten / created by the cuts). Releases
  `0996f70743f9`, `ad7726f19a85`, `52ae91d50129` (Reg M-B) and `321b4f63b586`, `d4b43852870d`, `28c6364d97a8`
  (Reg M-C) live in this worktree's `data/releases/` and are receipts for this report only.
- Heavy runs went through `cmd.exe /c tools\lownode.cmd` (argument vector from a scratch node launcher; exit code
  propagated).
