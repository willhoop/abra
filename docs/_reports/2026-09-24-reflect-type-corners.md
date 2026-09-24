# The two added-type corners of Reflect Type (2026-09-24, abra/regmc 0.96.0 and 0.97.0)

Brief: fix both corners filed in `docs/_reports/2026-09-24-reflect-type.md` §3 (base commit `b4ccb6da`, abra/regmc
0.95.0). Versions here are provisional; the coordinator renumbers.

## 1. Verdict

- **Corner 2, a second added type replaces the first: FIXED (0.96.0), both regulations.**
- **Corner 1, Reflect Type at a typeless target that carries an added type: see §4 (0.97.0).**

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

## 4. Corner 2 — a second added type replaces the first (0.96.0)

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

The census artifacts were NOT committed (restored to the committed bytes after reading), as in 0.95.0: the Reg M-B
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
