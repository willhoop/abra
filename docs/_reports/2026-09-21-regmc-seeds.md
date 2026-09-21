# Reg M-C: the terrain seeds fire, and the Grassy Terrain "heal order" card was a missing semi-invulnerable gate

**Date.** 2026-09-21. **Division.** ENGINE. **Line.** abra/regmc 0.16.0. **Status.** Findings record,
historical by construction; never cited as current state.

**No Reg M-C figure is published here.** The smoke is unpinned (no census pin, a release cut by the run,
`--games 100`). It says what parts, by kind, before and after on the same sample. Nothing else.

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a8b0fe9c983fce86c`, base `80c0ee54`, main `4ea10c15` merged in before the commit |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba`, selected by the regulation (`SHOWDOWN_PATH` unset) |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c` from a node argv launcher in a PRIVATE scratch subdirectory; shown to propagate exit code 3 before use |

---

## 0. The verdict

| | |
|---|---|
| **seeds** | New item tag `consumedOnTerrain {terrain, boosts, onEntry, switchInPriority}` (`engine/tag_dex.js`), derived from the handler. Engine: `seedSpend` / `seedTerrainChange` / `seedEntryPass` in `engine/medicham2-browser.js`, wired at both terrain-start sites and all three entry sites. |
| **Grassy heal** | The smoke's "heal order" card was **not an order**. The authority skips a semi-invulnerable body (`!pokemon.isSemiInvulnerable()`); this engine asked only `isGrounded`. Fixed at the heal. |
| **probe** | `tests/probe_regmc_terrain_seeds.js --regulation regmc`: exit 0 clean; exit 1 under each of `MEDI_SEED_UNCONSUMED`, `MEDI_SEED_NO_TERRAIN_CHANGE`, `MEDI_TERRAIN_HEAL_SEMIINV`, and against the pre-fix engine bytes (`--medi`, HEAD's file). |
| **census (Reg M-B)** | **Unchanged, deliberately.** A row `move/terrainPassiveHeal` "Grassy Terrain does not heal a body on a semi-invulnerable charge turn" (Gengar, Protect vs Phantom Force under Grassy Terrain) was written and run: 1005 probed / 1005 live / 0 missing clean, 1004 live / 1 missing under the knob with the write refused. It was then **removed**, because the census is Reg M-B's and one more row moves `1,004` in `docs/SUMMARY.md`, the deck and the technical docs, which the closed 7.0.0 line published (`tests/test-docs-current.js` failed on exactly that). Whether to add it is the coordinator's call. |
| **Reg M-B unmoved** | `data/tags.json` and `data/protocol-events.json` not in the diff. Damage differential `--n 6000 --seed 20260804`: base vs change differ ONLY on the launcher's own status line; the control seed `20260805` differs on 126 lines. M-B lattice `--games 1200`: **0 of 961 board-material** (§4). |
| **smoke** | Board-material **43/86 → 16/86** on the same pool digest `e1d4b0f81d40`. Seed first causes **30 → 0**, Grassy heal **1 → 0**. **Next largest: Rocky Helmet, 11 games.** |

## 1. The authority, read whole

Legality, derived (Validator in each checkout; `isNonstandard` in each format): all four seeds
(`electricseed`, `grassyseed`, `mistyseed`, `psychicseed`) are legal in `gen9championsvgc2026regmc`
and `isNonstandard: 'Past'` in `gen9championsvgc2026regmb`. The Champions mod (`data/mods/champions/items.ts`)
names none of them. So **no seed can reach a Reg M-B game**.

Each seed (M-C checkout `data/items.ts` electricseed :1799-1821, grassyseed :2595-2617, mistyseed :4200-4222,
psychicseed :4903-4925):

```
onSwitchInPriority: -1,
onStart(pokemon)         { if (!pokemon.ignoringItem() && this.field.isTerrain(T)) pokemon.useItem(); }
onTerrainChange(pokemon) { if (this.field.isTerrain(T)) pokemon.useItem(); }
boosts: { <stat>: 1 },
```

`Pokemon#useItem` (sim/pokemon.ts:1811-1849): `-enditem`, then `boost(item.boosts, …, item)` (an Item
effect: `-boost|X|stat|N|[from] item: NAME`, and a capped stat writes a bare `-boost|X|stat|0`,
sim/battle.ts:2063-2078), then `lastItem`, `item = ''`, `usedItemThisTurn`, `AfterUseItem`.

`Field#setTerrain` (sim/field.ts:130-157) ends `this.battle.eachEvent('TerrainChange', sourceEffect)`:
every active body, speed-sorted on the cached `pokemon.speed`, at the instant the terrain starts.
`TryTerrain` has no handler anywhere in the M-C data.

`setItem` (sim/pokemon.ts:1868-1889) raises the new item's `Start`, so a seed GIVEN under its terrain is
also spent. **Not modelled in this pass**; counted in `MEDFAILS.seedGainedUnderTerrain` so it cannot be
silent. Zero in every arm and in the smoke.

Grassy Terrain (M-C `data/moves.ts` :7711-7718; identical in the M-B checkout; no Champions override):
`onResidualOrder: 5, onResidualSubOrder: 2, onResidual(pokemon) { if (pokemon.isGrounded() && !pokemon.isSemiInvulnerable()) this.heal(…) }`.

## 2. What was built

**Tag.** `consumedOnTerrain`: an item whose `onTerrainChange` calls `useItem()` and reads one
`isTerrain('<id>')`, with a non-empty `boosts`. **Membership printed before wiring**, whole dex, both
checkouts: exactly the four seeds; none legal under M-B. Only `data/tags-regmc.json` was regenerated
(its diff: the tag descriptor, the four seed rows, `generated`). `data/tags.json` was not touched.

**Engine.**
- `seedSpend(m, field, road)`: tag read, terrain match, `-enditem`, the boost through `invSign` (Contrary /
  Simple) and the clamp with `TR.bst(…, '[from] item: <id>', zero=true)`, then `recordItemUsed` (lastItem,
  usedItemThisTurn, Unburden) and `passItemFromAlly` (Symbiosis). The hand empties in the same call, so it
  cannot fire twice and Knock Off reads an empty hand.
- `seedTerrainChange(field, actA, actB)`: called after the `-fieldstart` at BOTH terrain-start sites (the
  ability in `applyEntryEffects`, via the body's side back-reference; the move). Order is `sdEachEventOrder`,
  the engine's existing `eachEvent` sort. A board with no holder returns before touching anything.
- `seedEntryPass`: the item's own `onStart` at priority -1, after the whole ability walk and before White
  Herb's -2 pass, at the lead wave and the refill wave (rank order from the same `entrySpeedSort` records),
  and after a single `bringIn`.
- Grassy heal: `_semi = m._invuln && m._charging && TAGS.has('move', m._charging, 'semiInvulnerable')`, the
  same predicate Misty and Electric Terrain's refusals already ask.

## 3. The probe — `tests/probe_regmc_terrain_seeds.js`

Staged through `tests/staged_board.js`; both engines play the same scripted turns; SHOWDOWN IS THE ANSWER.
Every body is derived from the M-C dex (quiet-ability filter printed). It refuses (exit 2) if the newest
Reg M-C release does not hold the live engine bytes.

| arm | what it stages | authority fixture | this engine |
|---|---|---|---|
| STANDING | Grassy Terrain (move) up; a Grassy Seed holder switches in | one `-enditem` on entry | match, boards 0 |
| STANDING-CTL | same, holding the Psychic Seed | nothing spent | match, boards 0 |
| CHANGE | both holders on the field as the move sets the terrain; the faster on p2 | p2a then p1b (speed, not slot); turn-2 Knock Offs remove nothing | match, boards 0 |
| WAVE | lead wave: Grassy Surge + Grassy Seed vs Psychic Surge + Psychic Seed | both seeds spent, each inside its setter | match, boards 0 |
| SEMIINV-CTL | Grassy Surge; a hit, grounded body attacks | healed | match, boards 0 |
| SEMIINV | same body on Phantom Force's charge turn | NOT healed | match, boards 0 |

| run | exit | red arms |
|---|---|---|
| clean | 0 | none |
| `MEDI_SEED_UNCONSUMED=1` | 1 | STANDING, CHANGE, WAVE |
| `MEDI_SEED_NO_TERRAIN_CHANGE=1` | 1 | CHANGE, WAVE (STANDING stays green: the entry road alone is right there) |
| `MEDI_TERRAIN_HEAL_SEMIINV=1` | 1 | SEMIINV |
| `--medi` HEAD's engine (pre-fix bytes) | 1 | STANDING, CHANGE, WAVE, SEMIINV |

Clean-run counters: STANDING entry 1 / change 0; CHANGE change 2; WAVE change 2; SEMIINV skipped 1, control 0;
`seedGainedUnderTerrain` and `seedTerrainChangeNoSide` 0 in every arm.

The probe compares `-enditem`/`-boost`/`-unboost`/`-heal`/`-item` exactly and requires the driver's own
first-protocol-divergence to be NONE. `-fieldstart` is printed and not compared: a move-set terrain carries
`[of] <user>` here and not on the authority, a difference the driver already declares (its divergence reads
NONE over it). Not this mechanic; recorded, not fixed.

## 4. Reg M-B unmoved

- `data/tags.json`, `data/protocol-events.json`: absent from `git diff`.
- Damage differential `tests/test-engine-diff.js --n 6000 --seed 20260804`, base (before any edit) vs after:
  150 lines each, differing only on the launcher's own last line. Control run first: seed `20260805` differs
  from the base on 126 lines.
- **Both changes are gated on facts Reg M-B cannot produce except one.** No seed is legal there. The Grassy
  heal gate IS reachable (Grassy Terrain and Phantom Force are both legal under M-B), so the M-B lattice was
  run: `--steering empirical --arm middle --end-state --census <HEAD's census> --team-store <main tree>/data/team-pool-frozen --games 1200`,
  release cut by the run (`decca52d943f`), pool digest `0d103fb9fa87`. Result: **0 of 961 board-material**,
  961/961 boards never diverged, 0 protocol-diverged, 0 VOID. Whether that lattice ever puts a Phantom Force
  charge under Grassy Terrain was NOT counted, so this shows that nothing moved, not that the fix was
  exercised there; the census row is where the M-B half of the fix is proven.

## 5. The smoke, before and after, same sample

Command (both arms): `node engine/game_differential.js --regulation regmc --games 100 --team-store
C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --steering empirical --arm middle --end-state
--dump-games 200 --write --out <scratch> --dump-out data/_scratch-*.json`. Pool digest `e1d4b0f81d40` both arms
(it reproduces 0.15.0's corrected reading exactly); 87 played, 1 VOID both arms.

| | before (release `22190552653d`) | after (release `3027c2a1cf4b`) |
|---|---|---|
| protocol-diverged | 50 of 87 | 23 of 87 |
| **board-material** (`state.games` − never-diverged) | **43 / 86** | **16 / 86** |

First protocol divergence of the dumped non-void games (my own bucketer over `--dump-games`, which is the
full population, not the capped lists):

| cause | before | after |
|---|---|---|
| terrain seed not spent | **30** | **0** |
| Rocky Helmet chip | 7 | **11** |
| Air Balloon | 3 | 3 |
| Double Shock `-fail` field | 2 | 3 |
| Inner Focus stat name (`atk` vs `attack`) | 2 | 2 |
| Emergency Exit | 1 | 1 |
| Red Card / Eject Button | 1 | 1 |
| Grassy Terrain heal | **1** | **0** |
| a damage value | 1 | 0 |
| the fallen counter (`-end …fallenundefined`) | 1 | 1 |
| **total dumped** | 49 | 22 |

**Next largest cause: Rocky Helmet, 11 of 22 dumped games.** It was banned under Reg M-B and has no tag and
no engine code. Then Air Balloon and the Double Shock `-fail` field, 3 each.

## 6. Found on the way, not fixed

1. **The shared session scratchpad bit.** The scratchpad directory this session was given already held ~1,000
   files from other sessions, including a `low.js`, `before.log`, `ctx.js`, `legal.js`, `ediff-base.txt` and
   `tags-regmc.before.json` that my first writes landed on top of (`low.js` was then rewritten again by another
   process mid-session). I moved to a private subdirectory (`seeds-a8b0/`) and re-verified my baselines by
   timestamp. **If another session owned any of those six names, its copy was overwritten.** Nothing was deleted.
2. The move-set `-fieldstart` carries `[of] <user>` here and not on the authority (§3). Declared by the driver.
3. The seed GAIN door (Trick / Recycle / Symbiosis giving a seed under its terrain) is counted, not modelled.
4. `tags-regmc.json` was derived before main's 19:20 store update was merged; its usage counts are from the
   earlier store. Not regenerated after the merge, deliberately (one mechanic per pass).
5. No Reg M-C census or roster exists. The seeds therefore have a probe and no census row; the M-B census
   cannot carry them (no member is legal there). Owed when a Reg M-C census exists.
