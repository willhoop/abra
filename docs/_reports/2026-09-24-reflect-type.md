# Reflect Type's hidden board mismatch: it was Mimicry (2026-09-24, abra/regmc 0.105.0)

Brief: fix the Reflect Type board mismatch reproduced in `docs/_reports/2026-09-24-roster-staging.md` (on branch
`worktree-agent-a7b76e60902ec6b30`, commit `0a8da341`; not an ancestor of this branch, read with `git show`).

## 1. Verdict

**The defect was not in Reflect Type. It was Mimicry**, the only ability of the roster's aggressor (Stunfisk-Galar).
The authority runs Mimicry as an EVENT (its holder's Start, and a terrain being set or cleared). MEDICHAM ran it as a
SYNC from seventeen call sites, including the head of every turn, every body's entry and every weather change. So a
Mimicry body whose typing another handler rewrote under an unchanged terrain was put back to its base typing one
boundary later (no terrain) or re-Electrified (standing Electric Terrain). The authority keeps the copy.

Fixed in `engine/medicham2-browser.js` `syncTerrainTypes`: each holder remembers the terrain it last answered
(`_terrainTypeSeen`), and a later call under the same terrain writes nothing. The memory is cleared where the
authority fires the event without the terrain moving: the lead pass, `runEntryPass` (the entrant), `abilityStarted`
(a mid-battle ability start), and `switchOut`. Knob `MEDI_MIMICRY_SYNC_EVERY_CALL=1` restores the every-call sync.
Counter `MEDSEEN.terrainTypeHeldByEvent`.

## 2. The authority, read whole (both checkouts, Champions mod included)

| block | Reg M-B `pokemon-showdown` | Reg M-C `pokemon-showdown-mc` | Champions override |
|---|---|---|---|
| `reflecttype` | `data/moves.ts:14878-14909` | `data/moves.ts:14883-14914` | none in `data/mods/champions/moves.ts` (either) |
| `mimicry` | `data/abilities.ts:2571-2603` | `data/abilities.ts:2581-2613` | none in `data/mods/champions/abilities.ts` (either) |

The two checkouts' blocks are byte-identical in body. So there is **no REGULATION-ROTATION row**: nothing here differs
between the regulations.

`reflecttype.onHit`:
- `source.species.num === 493 || 773` → fail. **Not reachable**: no legal species with num 493 or 773 in either
  format (derived, `exists && !isNonstandard && tier !== 'Illegal'`).
- `source.terastallized` → fail. **Tera is out of scope**: the Champions mod's `actions.canTerastallize` returns
  `null` (`data/mods/champions/scripts.ts:180-182`, both checkouts). Nothing terastallizes.
- `newBaseTypes = target.getTypes(true).filter(t => t !== '???')` — `getTypes(true)` EXCLUDES the added type.
  Empty → `['Normal']` if the target has an `addedType`, else fail.
- `source.setType(newBaseTypes); source.addedType = target.addedType;` — so the user ends with the target's base
  types PLUS the target's added type (and loses any added type of its own).
- `knownType` / `apparentType` hold-back (already modelled, `tests/probe_apparent_type_broadcast.js`).

`mimicry`: `onStart` = `singleEvent('TerrainChange', ...)` on the holder; `onTerrainChange` reads `field.terrain`
(Electric/Grassy/Misty/Psychic → one type, default → `pokemon.baseSpecies.types`), returns if the types already
match. No per-turn, weather or any-switch-in handler (the probe asserts the handler set from the checkout).

## 3. What the board holds afterwards, and what MEDICHAM does

| case | authority | MEDICHAM before | after |
|---|---|---|---|
| Mimicry user, no terrain, Reflect Type at Goodra-Hisui | dragon/steel, kept | ground/steel from the next boundary | kept |
| Mimicry user under standing Electric Terrain | dragon/steel, kept | electric from the next boundary | kept |
| Mimicry user, Reflect Type, THEN Electric Terrain | electric (TerrainChange) | electric | electric |
| Non-Mimicry user (Stunfisk, Static) | kept | kept | kept |
| Target with one added type (Trick-or-Treat / Forest's Curse) | base + added | the whole list, same result | unchanged |
| Target typeless (`???`) with an added type | Normal + added | the added type only | **unchanged — named gap** |

### Named gaps, NOT fixed here (no failing probe written; both are corner cases)

1. **Typeless target with an added type.** The authority copies `['Normal']` plus the added type; MEDICHAM has no
   `addedType` field (the added type is appended to `types`), so it copies the added type alone. Reachable in both
   regulations only as: a mono-Fire body Burn Ups (or, Reg M-C only, a mono-Electric body Double Shocks — Double Shock
   is `Past` in Reg M-B), is then Trick-or-Treated or Forest's Cursed, and is then Reflect Typed.
2. **A second added type replaces the first in the authority** (`Pokemon#addType` writes `this.addedType = newType`),
   while MEDICHAM's `changesTargetType.adds` branch appends (`t.types=[...t.types,_ty]`), so Trick-or-Treat then
   Forest's Curse leaves `[...base, Ghost, Grass]` here and `[...base, Grass]` there. This is a Trick-or-Treat /
   Forest's Curse defect, not a Reflect Type one; it is filed for ENGINE, not fixed in this commit.

Both need an `addedType` marker on the body and every wholesale `types=` write clearing it; that is a separate change.

## 4. Proof

### 4a. The roster reproduction, red → green, both regulations

`node tests/roster.js --stage moves --only reflecttype --release <id>` through a BELOWNORMAL launcher.

| regulation | release | engine bytes | verdict |
|---|---|---|---|
| Reg M-B | `07a490f0ee37` | HEAD | BELOW-USAGE-SHELF, underlying FIRED-AND-BOARDS-DIFFER: `p1a types` / `p1 party.types` dragon/steel vs ground/steel |
| Reg M-B | `3010f1e7f5dd` | fix | **FIRED-AND-BOARDS-MATCH** |
| Reg M-C | `36135edbaf7a` | HEAD | BELOW-USAGE-SHELF, underlying FIRED-AND-BOARDS-DIFFER, the same two leaves |
| Reg M-C | `4168135a562f` | fix | **FIRED-AND-BOARDS-MATCH** |

### 4b. The two-engine probe — `tests/probe_mimicry_terrain_event_only.js`

Four arms, each played in both engines with the whole board compared (`tests/staged_board.js`); fixture legality from
the format's TeamValidator. RED 1 (no terrain), RED 2 (Reflect Type under standing Electric Terrain), LIVE (terrain set
after the copy must still retype — the gate may not deafen the event), CONTROL (Stunfisk with Static: the copy holds in
both engines, so a red on RED 1 is charged to Mimicry and not to Reflect Type).

| regulation | release | result |
|---|---|---|
| Reg M-B | `07a490f0ee37` (HEAD) | RED — RED 1 and RED 2 part at boundaries 3-5 / 3-4; LIVE and CONTROL agree |
| Reg M-B | `3010f1e7f5dd` (fix) | GREEN, exit 0 |
| Reg M-B | `3010f1e7f5dd` + knob | RED, 2 red-arm failures |
| Reg M-C | `36135edbaf7a` (HEAD) | RED, the same two arms |
| Reg M-C | `4168135a562f` (fix) | GREEN, exit 0 |

### 4c. Census

New row `typeFollowsTerrain` — "Mimicry answers a terrain CHANGE, not every turn — a Reflect Type copy under an
unchanged terrain holds" (arms: no-ability control, Mimicry with no terrain change, Mimicry with Electric Terrain from
turn 3). MISSING under the knob (and the census refused to write), LIVE clean.

| regulation | artifact at HEAD | after (this tree) |
|---|---|---|
| Reg M-B `data/mechanics-census.json` | 1004 live | 1007 live, 0 missing (1006 without the new row: the HEAD artifact was generated 2026-09-23 and predates two merged rows) |
| Reg M-C `data/mechanics-census-regmc.json` | 1010 live | 1011 live, 0 missing |

The knob is registered in `DELIBERATE_BREAK` (`tests/test-mechanics.js`) so a red demonstration cannot write the census.
**The regenerated census artifacts were NOT committed** — restored to HEAD after reading. The Reg M-B census's 1,004
is cited by the closed 7.0.0 record (`docs/SUMMARY.md`, the deck, the technical docs) and `tests/test-docs-current.js`
went red on the rewrite (figures a cited artifact does not contain). Republishing is MEASURE's, from main, as in pass 9.

### 4d. Neighbouring instruments on the fix (Reg M-B unless stated)

`tests/probe_apparent_type_broadcast.js` all pass; `tests/probe_transform_copied_start.js` (the transformed-Mimicry
Start) PASSED; `tests/test-forme-assert.js` exit 0; `tests/test-assert-mode.js` exit 0;
`tests/probe_misty_terrain_status.js` exit 0; `tests/probe_charge_release_chosen_slot.js` exit 0;
`tests/probe_regmc_terrain_seeds.js --regulation regmc` green, exit 0.

### 4e. The pinned differential

Flags (the sample definition): `--steering empirical --arm middle --end-state --games 300 --write --out <scratch>`.
Reg M-B: `--census data/verification/census-pin-833a997d7e42.json --team-store <main>/data/team-pool-frozen`.
Reg M-C: `--regulation regmc --census <main>/data/verification/census-pin-regmc-0d03e83f0e65.json --team-store
<main>/data/team-pool-frozen-regmc`. Board-material read as `state.games − state.games_board_never_diverged`.

| regulation | release | what | games | protocol diverged | board-material |
|---|---|---|---|---|---|
| Reg M-B | `07a490f0ee37` | base | 260 | 1 | 0 |
| Reg M-B | `3010f1e7f5dd` | fix | 260 | 1 | 0 |
| Reg M-C | `36135edbaf7a` | base | 259 | 0 | 0 |
| Reg M-C | `4168135a562f` | fix | 259 | 0 | 0 |

The one Reg M-B protocol divergence is the same game on both releases (`…bo3-2655708295 vs …bo3-2656203256`, turn 10,
`medicham2 stopped emitting while showdown continued :: |-end|p…`) — the pre-existing row the 0.94.0 report calls the
declared Supreme Overlord `fallenundefined` line; untouched. **No new board divergence in either regulation.** The pool
holds no Mimicry game, so, as predicted, it does not move.

### 4f. The full roster moves stage

`node tests/roster.js --stage moves --release <fix>` (no `--write`: the published artifacts are not this branch's to
move, and this branch lacks the other branch's 0.88.0-0.90.0 fixture repairs).

| regulation | release | DIFFER | DID-NOT-FIRE | SHELF | MATCH | COULD-NOT-STAGE | DEFERRED | in scope |
|---|---|---|---|---|---|---|---|---|
| Reg M-B | `3010f1e7f5dd` | 0 | 0 | **0** (was 1: Reflect Type) | 495 | 1 | 1 | 497 |
| Reg M-C | `4168135a562f` | 0 | 0 | **0** (was 1: Reflect Type) | 509 | 1 | 1 | 511 |

Reflect Type reads FIRED-AND-BOARDS-MATCH and leaves the usage shelf in both. The one COULD-NOT-STAGE is Belch
(`Can't pass: Your Milotic must make a move`), the fixture fault fixed on the other branch in 0.90.0 — pre-existing
here, not this change. Both stages exit 0.

## 5. Which scoreboard

Rare mechanic: Mimicry has one legal carrier (Stunfisk-Galar) in both regulations and Reflect Type has 11 clicks in
the Reg M-B store. Expected: the lab (roster row, census) moves, the pool does not. That is what happened.

## 6. Owed / not done here

- `node engine/status.js --write` NOT run (from a worktree it writes missing untracked files as fact). Coordinator at
  merge.
- Not committed: `data/engine-release.json` (rewritten by the cuts), `data/engine-release-regmc.json` (created by the
  Reg M-C cut), `data/forme-assert.json` (rewritten by the `tests/test-forme-assert.js` neighbour run). The releases `07a490f0ee37`, `3010f1e7f5dd`, `36135edbaf7a`, `4168135a562f` live in this worktree's
  `data/releases/` and are receipts for this report only.
- The heavy runs used a scratch BELOWNORMAL launcher (`os.setPriority` + child `node`), because this agent's sandbox
  refuses `cmd.exe`; the exit code is propagated.
- This branch does not carry `0a8da341`'s roster fixes (0.88.0-0.90.0 on the other branch); the full-stage figures in
  4f are read on this branch's `tests/roster.js`.
