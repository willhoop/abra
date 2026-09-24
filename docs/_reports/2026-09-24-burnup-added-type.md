# A type spend clears the added type: Burn Up and Double Shock (2026-09-24, abra/regmc 0.111.0)

Brief: fix the defect filed in `docs/_reports/2026-09-24-reflect-type-corners.md` §6. Base commit `1079f6f9`
(abra/regmc 0.110.0). The version is provisional; the coordinator renumbers.

## 1. Verdict

- **FIXED, both regulations.** Burn Up (legal in Reg M-B and Reg M-C) and Double Shock (Reg M-C only) used the same
  code path. One helper fixes both.
- Probe `tests/probe_spend_type_clears_added.js`: RED on the base bytes, GREEN on the fix, RED under the knob
  `MEDI_SPEND_TYPE_KEEPS_ADDED=1`. This is true in both regulations.
- Pinned differential: no new board divergence in either regulation.

## 2. The authority, read whole (both checkouts, Champions mod included)

| block | Reg M-B `pokemon-showdown` | Reg M-C `pokemon-showdown-mc` | Champions override |
|---|---|---|---|
| `burnup` | `data/moves.ts:2092-2117` | `:2092-2117` | `isNonstandard: null` only, in both mods |
| `doubleshock` | `data/moves.ts` `self.onHit` `:3961-3966` | `:3960-3965` | Reg M-B: `isNonstandard: "Past"`; Reg M-C: `flags` only |
| `setType` / `addType` / `getTypes` | `sim/pokemon.ts:2114-2151` | `:2109-2146` | none; the two ranges are byte-identical (diffed) |

The two handlers are the same apart from the type:

```
self: { onHit(pokemon) {
  pokemon.setType(pokemon.getTypes(true).map(type => type === "Fire" ? "???" : type));
  this.add('-start', pokemon, 'typechange', pokemon.getTypes().join('/'), '[from] move: Burn Up'); } }
```

- `getTypes(true)` runs the `Type` event over `this.types` and EXCLUDES `addedType`.
- `setType` writes `this.addedType = ''`. So after the spend the body has only the mapped base list. The spend line
  shows `getTypes()` AFTER that, so it names no added type either.
- The `onTryMove` gate uses `hasType('Fire')`, which reads `getTypes()` WITH the added type. The engine's refusal gate
  (`(m.types||[]).includes(requires)`) already matched it and is unchanged.

**Other type-removal effects.** These are all the `setType` / `addType` callers in `data/moves.ts`,
`data/abilities.ts` and `data/rulesets.ts`, in both checkouts. The Champions mod files have no callers.

- Only Burn Up and Double Shock REMOVE a type from the current list.
- Roost removes Flying through the `Type` event and never touches `addedType`. The engine already carries the added
  type by hand for Roost (0.109.0).
- Every other caller REPLACES the list with a fresh one: in moves, Camouflage, Conversion, Conversion 2, Magic
  Powder, Soak and Reflect Type; in abilities, Color Change, Libero, Mimicry and Protean; in rulesets,
  `proteanpalacemod`. Those names were read at the Reg M-B line numbers.

## 3. Scope, derived

Legality comes from the format on each checkout. The probe also puts every body, ability, item and move through the
format's `TeamValidator`.

- Burn Up: `isNonstandard null` in both formats.
- Double Shock: `"Past"` in Reg M-B, `null` in Reg M-C.
- The fixture passes in both formats: Arcanine / Burn Up, Pawmot / Double Shock (Reg M-C), Gourgeist /
  Trick-or-Treat, Trevenant / Forest's Curse.

## 4. The defect

The engine stores the added type as the last element of `types`, and names it in `types._added` (0.109.0).
`m.types.map(...)` builds a new array. The new array has no `_added` property, but it still holds the added element.
So the spend did not clear the added type. It turned it into a BASE type, and its immunities stayed.

The 0.109.0 comment said every `.map()` / `.filter()` write clears the added type the way `setType` does. That was
wrong for these two writes, and it is corrected in the file.

Audit: I checked every `types=` write in the engine. The two spend sites are the only ones that map or filter the
current list. Every other write builds a fresh array, or carries the added type on purpose (Roost's `_typeWas`
restore, the second add, Reflect Type, Transform).

## 5. The fix

`engine/medicham2-browser.js`: new helper `spentOwnTypes(m, removes, becomes)`, placed beside `baseTypesOf`.

- It maps `baseTypesOf(m)`, so the result is a fresh array with no added type.
- Both `spendsOwnType` sites call it: `_stepSelfPay`, and the `MEDI_SPEND_TYPE_AFTER_MOVE` site.
- Counter: `MEDSEEN.spendClearedAddedType`.
- Knob: `MEDI_SPEND_TYPE_KEEPS_ADDED=1` puts back the whole-list map and sets
  `MEDFAILS.spendTypeKeepsAddedRestored`. That flag is in the census's `DELIBERATE_BREAK` list, so a census run with
  the knob armed refuses to write (confirmed below).
- The spend line (`m.types.join('/')`) now reads `???` / `???/Fighting`, which matches the authority.

## 6. Proof

### Probe

`tests/probe_spend_type_clears_added.js` plays each arm in both engines and compares the whole board at every turn
boundary. It also compares every `typechange` / `typeadd` line for the spender (the spend line and the broadcast).

Arms:
- **RED 1:** Trick-or-Treat, then Burn Up.
- **RED 2:** Forest's Curse, then Burn Up.
- **RED 3:** Trick-or-Treat, then Double Shock. Reg M-C only; in Reg M-B it is skipped, and the probe prints the
  derived reason.
- **CONTROL 1:** Burn Up with nothing added.
- **CONTROL 2:** Burn Up, then Trick-or-Treat (an add after the spend must still stand).

| regulation | release | bytes | result |
|---|---|---|---|
| Reg M-B | `8a5bcd3a2fe0` | base `1079f6f9` | RED: RED 1 `p2a types` sd "" / me "/ghost" from boundary 2, spend line `???` vs `???/ghost`; RED 2 "" / "/grass"; controls agree |
| Reg M-B | `05d94c04b0b1` | fix | GREEN, exit 0 |
| Reg M-B | `05d94c04b0b1` + knob | fix + knob | RED, 4 red-arm failures |
| Reg M-C | `eff34d26faec` | base | RED: the same two arms, plus RED 3 `p2a types` "/fighting" vs "/fighting/ghost", spend line `???/fighting` vs `???/fighting/ghost` |
| Reg M-C | `720f9963856a` | fix | GREEN, exit 0 |
| Reg M-C | `720f9963856a` + knob | fix + knob | RED, 6 red-arm failures |

The probe's `[from] move:` field is compared as an id. Showdown writes `Trick-or-Treat` and this engine writes
`trickortreat` in that field. Both were already like that before this change, and the change does not touch it.

### Census

New row in `tests/test-mechanics.js`: `spendsOwnType`, "a type spend (Burn Up / Double Shock) clears the added
type". The outcome is Sneasler's Close Combat into Arcanine:
- Trick-or-Treat only: Fire/Ghost, 0 damage (immune).
- Trick-or-Treat, then Burn Up: `???`, 163 damage (it lands).

| regulation | live / missing / probed | under the knob |
|---|---|---|
| Reg M-B | 1010 / 0 / 1010 (0.110.0 tree: 1009) | 1009 / 1 / 1010. The census REFUSED to write |
| Reg M-C | 1014 / 0 / 1014 (0.110.0 tree: 1013) | not run |

I restored the census artifacts to the committed bytes after reading them, as in 0.109.0 and 0.110.0. Republishing is
MEASURE's job, from main.

One thing went wrong on the way. The first knob run was made before I added the knob's flag to
`DELIBERATE_BREAK`, so it wrote `data/mechanics-census.json`. I restored that file from git. After the flag was
registered, the knob run refused to write.

### Pinned differential

The flags and pins match 0.109.0 / 0.110.0:
- Flags: `--steering empirical --arm middle --end-state --games 300 --write --out <scratch>`.
- Reg M-B: `--census data/verification/census-pin-833a997d7e42.json --team-store <main>/data/team-pool-frozen`.
- Reg M-C: `--regulation regmc --census <main>/data/verification/census-pin-regmc-0d03e83f0e65.json --team-store
  <main>/data/team-pool-frozen-regmc`.
- Board-material = `state.games − state.games_board_never_diverged`.

| regulation | release | games | protocol diverged | board-material |
|---|---|---|---|---|
| Reg M-B | `05d94c04b0b1` fix | 260 | 1 | 0 |
| Reg M-C | `720f9963856a` fix | 259 | 0 | 0 |

These are the same figures as the 0.110.0 fix. The one Reg M-B protocol divergence is the same declared Supreme
Overlord `fallenundefined` line on Kingambit. **No new board divergence.** This is a rare mechanic, so as predicted
the lab moved and the pool did not.

### Roster and neighbours

- Roster, `node tests/roster.js --stage moves --only …`:
  - Reg M-B `05d94c04b0b1` (burnup, trickortreat, forestscurse): 3 FIRED-AND-BOARDS-MATCH, 0 DIFFER, 0 DID-NOT-FIRE,
    0 COULD-NOT-STAGE.
  - Reg M-C `720f9963856a` (the same, plus doubleshock): 4 MATCH, 0 / 0 / 0.
- Neighbour probes on both fix releases, all exit 0: `probe_added_type_replaced`,
  `probe_reflect_type_typeless_added`, `probe_apparent_type_broadcast`, `probe_spend_type_fail_named`, and in Reg M-C
  `probe_regmc_spend_type_before_toll`.

## 7. Housekeeping

- The heavy runs (release cuts, census, differentials, roster) went through `cmd.exe /c tools\lownode.cmd`, called
  with an argument vector from a scratch node launcher. The exit code was propagated.
- These files are not committed: `data/engine-release.json` and `data/engine-release-regmc.json` (the cuts rewrote
  or created them), and the releases under `data/releases/`. They are receipts for this report only.
- I did NOT run `node engine/status.js --write`, because from a worktree it writes missing untracked files as fact.
