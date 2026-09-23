# Reg M-C engine pass 8: the 22 unstaged rows, Bounce and Jaw Lock, and the dead terrain anchor

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.64.0 to 0.69.0. **Status.** This is a findings
record. It is historical by construction and is never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a6a436685644b1e3c`, branch `worktree-agent-a6a436685644b1e3c`, base `3379450b` (0.63.0) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`, selected by `--regulation regmc` |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| baseline release | `aa7b45c6b8d2` (the 0.63.0 engine; re-cut here and it returned the same id) |
| final releases | Reg M-C `485d0a6840ad`, Reg M-B `89ac57f1f81b` (the 0.68.0 tree) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, argv form, from `data/_scratch-eng-p8/launch.js` (git-ignored) |

## Commits

| version | commit | what |
|---|---|---|
| 0.64.0 | `ba3eb70d` | roster fixtures for the 22 rows; the terrain anchor re-aimed; the `adjacentAllyOrSelf` ally aim in `scripted()` |
| 0.65.0 | `946ecd4b` | Stakeout: x2 only into a body that arrived this turn |
| 0.66.0 | `58314028` | Run Away frees its holder from a trap (Champions handler) |
| 0.67.0 | `b204e2f9` | Protean/Libero convert on a charge turn (both regulations) |
| 0.68.0 | `b85f25a9` | Jaw Lock traps both bodies |
| 0.69.0 | (this pass's last commit) | the lab re-measured on the 0.68.0 engine |

Each engine fix has a knob and a probe. Each probe is green on the clean engine and red under its knob. Each is also red
with the 0.63.0 engine bytes (`--medi data/releases/aa7b45c6b8d2/engine/medicham2-browser.js`). The M-B data files
`data/tags.json`, `data/protocol-events.json` and `data/move-effects.js` are byte-identical to `3379450b`.

---

## A. The 22 COULD-NOT-STAGE rows — 22 staged, 22 MATCH on the final engine

### Why each one could not stage
- **Fifteen had no shape rule.** These are Air Balloon, Binding Band, Eject Button, the four seeds, Normal Gem, Red Card,
  Rocky Helmet, Emergency Exit, Libero, Liquid Ooze, Rattled and Run Away. They fell to `item/held-and-nothing-more` or
  `ability/generic`. Those two rules only hold the entity, attack and get attacked, so the handler never met what it waits
  for. None of the fifteen is in Reg M-B: the ten items are `isNonstandard: 'Past'` there and the five abilities have no
  legal carrier. That is why no rule had ever been written for them.
- **Two were claimed by the wrong rule.** `ability/unconditional-stat-multiplier` took Stakeout (gated on
  `!defender.activeTurns`) and Grass Pelt (gated on `isTerrain('grassyterrain')`). It builds neither an arrival nor a
  terrain.
- **Five were parsing or fixture faults.**
  - **Leek.** `onModifyCritRatio.call({}, 1)` threw on `user.baseSpecies`, because the handler answers only for its
    `itemUser`.
  - **Terrain Extender.** "Electric/Grassy/Misty/Psychic Terrain" was read as one name.
  - **Punk Rock.** Its `sound` scope picked Snore, which fails unless its user is asleep.
  - **Harvest.** The hit was sized off the cast aggressor. That body is not legal in Reg M-C, and the learnset restaging
    swapped it after the sizing, so no hit was found in the band.
  - **Milk Drink.** Under Reg M-C it is `adjacentAllyOrSelf`, and `scripted()` aimed that class at the user's own slot,
    so the drinker healed itself at full HP.

### What was built (`tests/roster.js`, 0.64.0)
| row(s) | rule | the board it builds | break (plant) |
|---|---|---|---|
| Air Balloon | `item/pops-on-a-hit` | Ground move refused, non-Ground hit pops, Ground move lands | `AIR_BALLOON_UNPOPPED` |
| Rocky Helmet | `item/tolls-a-contact-attacker` | contact hit (toll), then non-contact hit (negative) | `ROCKY_HELMET_INERT` |
| Binding Band | `item/partial-trap-chip` | holder partially traps the foe; two residual chips | `TRAP_CHIP_ITEM_BLIND` |
| Eject Button, Red Card | `item/leaves-on-a-hit` | one plain hit, one turn | `RED_CARD_INERT`, `EJECT_BUTTON_INERT` |
| four seeds | `item/spent-when-its-terrain-starts` | foe raises the terrain the handler names | `SEED_UNCONSUMED` |
| Normal Gem | `item/type-gem` | holder throws the gem's type twice | `TYPE_GEM_INERT` |
| Leek | `item/crit-ratio` (fixed) | holder is an `itemUser` body | existing |
| Terrain Extender | `item/extends-a-duration` (fixed) | Electric Terrain from the holder | existing, plus the terrain half |
| Rattled | `ability/speeds-up-when-hit-by-a-type` | a named-type hit, then an unnamed one | `buffsHolderOnHit` read |
| Liquid Ooze | `ability/reverses-a-drain` | a drain into the carrier, then a plain hit | `OOZE_INERT` |
| Libero (and Protean) | `ability/takes-the-type-of-its-own-click` | two off-type clicks | `typeBecomesMoveType` read |
| Run Away | `ability/escapes-a-trap` | Block on turn 1, a switch ask on turn 2 (`switchProbe`, escape) | `RUN_AWAY_TRAPPED` (0.66.0) |
| Emergency Exit | `ability/leaves-at-half` | a hit sized 55–90% of natural HP | `EMERGENCY_EXIT_INERT` |
| Stakeout | `ability/doubles-into-a-fresh-arrival` | side A switches, the carrier hits the arrival, then hits it again | `STAKEOUT_UNCONDITIONAL` (0.65.0) |
| Grass Pelt | `ability/stat-multiplier-under-a-terrain` | the carrier raises Grassy Terrain, then a physical hit and a special hit; hpB 2 because the terrain heal outweighed the hit on an 8x pool | `TERRAIN_STATMULT_INERT` |
| Punk Rock | `ability/base-power-scoped` (fixed) | Hyper Voice (a spread fallback, only when no single-target click is inside the scope) | existing |
| Harvest | `ability/restores-a-spent-berry-by-chance` (fixed) | an aggressor searched for in the band | existing |
| Milk Drink | `move/heals-a-body-that-was-damaged-first` (fixed) | `{ ally: true }`, honoured by `scripted()` for `adjacentAllyOrSelf` | existing |

Every rule's membership was printed with `--rules` before it was believed. The new item rules sit directly above the
residue, so they claim only residue members; Metronome stays on the residue. The new ability rules sit above
`ability/generic`, and they move Protean from generic to `takes-the-type-of-its-own-click`, where it still reads MATCH.
Punk Rock's spread fallback moved no standing row: the pick for every other `base-power-scoped` member was checked
against the 0.63.0 artifact and is unchanged.

### Verdicts
On `aa7b45c6b8d2`, the 0.63.0 engine, 20 of the 22 read MATCH. **Stakeout read FIRED-AND-BOARDS-DIFFER.** On the
arrival the authority read 1009 of 1240 HP and this engine read 934: this engine doubled the settled hit too. **Run
Away read DID-NOT-FIRE.** The authority let the trapped holder go, and this engine kept it. Both are engine defects,
fixed in 0.65.0 and 0.66.0 (§D). On the final engine all 22 read MATCH (§E).

## B. Bounce and Jaw Lock — both engine defects, both fixed

- **Bounce (0.67.0, a shared rule).** The underlying DIFFER was `types`, Flying on the authority and Fire here. The
  learnset restaging had put a Libero Cinderace on the charge turn. The cause is in the authority:
  `twoturnmove.onStart` (data/conditions.ts :291-313; the Champions mod does not override it, in either checkout) ends
  with `this.runEvent('PrepareHit', attacker, defender, effect)` under the comment "Run side-effects normally associated
  with hitting (e.g., Protean, Libero)". So the holder converts on the spent charge turn. `runEvent('TryMove')` sits above
  the move's own `PrepareHit` (sim/battle-actions.ts :486 against :591), so no other road converts on that turn. The fix:
  `proteanConvert` now runs where `_ttmWrap` is added. The release turn does not convert again, because both abilities
  are once per entry. A weather-skipped charge gets no wrapper and converts at the hit, as before. Reg M-B has the same
  line and legal carriers (Greninja with Bounce, Dig and Dive; Meowscarada with Solar Beam), so the fix changes Reg M-B
  behaviour. The probe was run under both regulations.
- **Jaw Lock (0.68.0, Reg M-C only).** The underlying DIFFER: `vol.trapped` read 1 on both bodies on the authority and 0
  on both here, and the authority refused the target's switch while this engine allowed it. `jawlock.onHit` traps the
  source and the target (data/moves.ts; there is no mod row). medicham2's `trapsTarget` had two doors, the status click
  (`kind:'trapmove'`) and the secondary (Spirit Shackle), and a damaging move whose OWN `onHit` traps reached neither.
  The fix has two parts:
  - `tag_dex` writes `alsoUser: true`, only for that shape, so Block, Mean Look and Spirit Shackle rows are unchanged.
  - The attack path traps the source and then the target, each refusing a repeat or a Ghost silently.

  Measured on the authority: a Ghost that the hit KOs traps nobody, not even the source. This engine agrees, and the probe
  therefore searches for a Ghost that stands.
- Both rows read FIRED-AND-BOARDS-MATCH on `485d0a6840ad`. They leave the shelf, because the shelf holds only accusing
  rows.

## C. The terrain rule

The plant anchor was `field.terrain=_t;field.terrainT=5;if(TR)TR.terrainStart(_t,null,m);`. Terrain Extender
(`b2f7eacb`, 0.29.0) changed the duration to `terrainTurns(_t,m.item)`. The anchor then matched 0 times, and the stage
exited 1 on every release after that. **The code path is the same one**: the move branch of `a.kind==='terrain'`. The
anchor now reads `field.terrain=_t;field.terrainT=terrainTurns(_t,m.item);if(TR)TR.terrainStart(_t,null,m);`, which
matches once, because the ability branch splits the same text across two lines. The plant drops `field.terrain=_t;`.
`--rule move/needs-the-terrain-it-names --reds` reads **CAUGHT via steelroller → FIRED-AND-BOARDS-DIFFER on
party.hp, hp**. The rule's three rows were not deleted and read MATCH.

## D. The engine defects, with their probes

| version | defect | fix | probe (arms) | clean | knob | 0.63.0 bytes |
|---|---|---|---|---|---|---|
| 0.65.0 | Stakeout's tag had `onlyWhen: null`; the untyped `attackStat` branch (Hustle's) paid a permanent x2 on physical hits | `tag_dex`: `targetFreshlyArrived` + `onStat: 'any'` (Stakeout alone over both dexes); medicham2 reads `def._newlySwitched` | `probe_regmc_stakeout.js` (FRESH, LEAD, CONTROL) | green | `MEDI_STAKEOUT_UNCONDITIONAL` red | red |
| 0.66.0 | `escapesTrap` was item-only; Champions gives Run Away Shed Shell's handler | `tag_dex`: ability `escapesTrap` (Reg M-C Run Away alone); `switchTrapVerdict` reads it | `probe_regmc_run_away.js` (HARD, PARTIAL, CONTROL = authority refuses) | green | `MEDI_RUN_AWAY_TRAPPED` red | red |
| 0.67.0 | no conversion on a spent charge turn | `proteanConvert` at the wrapper | `probe_charge_turn_protean.js` (CHARGE, CONTROL), either regulation | green M-C and M-B | `MEDI_CHARGE_NO_PREPAREHIT` red in both | red in both |
| 0.68.0 | own-`onHit` trap on a damaging move unmodelled | `trapsTarget.alsoUser`; attack-path trap, source first | `probe_regmc_jaw_lock.js` (LOCK, GHOST, CONTROL, REFUSED) | green | `MEDI_JAW_LOCK_INERT` red | red |

The tag rows were patched into `data/tags-regmc.json` surgically: the stakeout row; the runaway row and its catalogue
entry; the jawlock row. A full `tag_dex --regulation regmc` regeneration also moves every usage figure (sheet_entries
215,244 → 237,504, from the live store), so it was used only to read the new rows. The regenerated file differs from the
committed one structurally in exactly those rows, plus one pre-existing drift that was not touched: the
`allyBasePowerBoost` catalogue entry reads `consumedBy: null, used: false` in the committed file, and the regenerator
now reads it as consumed. That drift is metadata only. Reported, not fixed.

Regression checks on the final tree, all green: all 43 `tests/probe_regmc_*.js` under Reg M-C; `probe_charge_abort`,
`probe_charge_boost_contrary`, `probe_charge_release`, `probe_charge_release_chosen_slot`, `probe_electric_charge_abort`,
`probe_electric_charge_paths`, `probe_partial_trap_source_returns`, `probe_trap_duration`, `probe_trap_timing`,
`test-charge`, `test-damage-stages` and `test-precharge-order` under Reg M-C; and `probe_charge_abort`,
`probe_charge_release`, `probe_partial_trap_source_returns`, `probe_protean_contrary`, `probe_trap_duration`,
`probe_trap_timing` and `test-damage-stages` under Reg M-B.

**One red probe that predates this pass:** `tests/probe_protean_contrary.js --regulation regmc` exits 1 on `lead
itemboost: NOT STAGED`. It reads identically on the baseline release `aa7b45c6b8d2`, so it is not caused by this pass.
Under Reg M-B it is green. It is an M-B probe that was never adapted to the M-C dex (the lead derives a stat-raising item
list). Not fixed here, and it is named in OWED.

## E. The lab on the final engine (abra/regmc 0.69.0)

### Reg M-C roster, `--reds --write --release 485d0a6840ad`, all three stages exit 0
| stage (generated) | in scope | MATCH | DIFFER | DID-NOT-FIRE | COULD-NOT-STAGE | shelf | other |
|---|---|---|---|---|---|---|---|
| items (03:20:20Z) | 166 | **166** | 0 | 0 | **0** (was 12) | 0 | — |
| abilities (03:21:04Z) | 214 | **210** | 0 | 0 | **0** (was 9) | 0 | ANNOUNCEMENT-ONLY 3, DEFERRED-BY-OWNER 1 (Illusion) |
| moves (03:20:52Z) | 511 | **510** | 0 | 0 | **0** (was 1) | **0** (was 2) | DEFERRED-BY-OWNER 1 (Copycat) |

No rule failed its red demonstration in any stage, and no plant anchor is dead. Fixture legality, report-only and not
baselined: items 17 (unchanged), abilities 80 (was 82), moves 47 (unchanged).

### Census, run on the live tree (the bytes of `485d0a6840ad`)
- Reg M-C `data/mechanics-census-regmc.json`: **1006 / 1006 live**, run_ok, 0 missing, threw or hollow
  (2026-09-23T03:20:53Z).
- Reg M-B `data/mechanics-census.json`: **1004 / 1004 live**, run_ok, 0 missing, threw or hollow (2026-09-23T03:20:51Z).
- Both diffs are sampled-detail text only. No row changed status, and live did not go down.

### Lattices
Pins for Reg M-C: `--regulation regmc --steering empirical --arm middle --end-state --census
data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`.
Pins for Reg M-B: the same flags with `--census` set to a copy of HEAD's `data/mechanics-census.json` taken before the
regeneration, and `--team-store …/data/team-pool-frozen`. The bar is `state.games − state.games_board_never_diverged`.

| | 1200 | 1350 | 1950 |
|---|---|---|---|
| Reg M-C, `485d0a6840ad` | **0 / 954** (void 1, protocol-only 64) | **0 / 1075** (72) | **0 / 1537** (96) |
| Reg M-B, `89ac57f1f81b` | **0 / 961** (0) | **0 / 1069** (1) | **0 / 1497** (2) |

## Housekeeping
- `data/engine-release.json` is the tracked Reg M-B pointer. The M-B cuts moved it, and it was restored from HEAD before
  the last commit. `data/engine-release-regmc.json` is untracked, as it was at the start.
- Left untracked and not committed: `data/roster.{items,abilities,moves}.prev-regmc.json` and `data/roster-regmc.json`.
  These are the roster's own backup and convenience copies.
- Scratch is under `data/_scratch-eng-p8/` (git-ignored). No file was deleted.

---

## OWED, NOT RUN

Run these from the MAIN checkout after the merge. None of them was run in this worktree, and `status.js --write` must not
run from a worktree:

```
node engine/status.js --write
node engine/quarantine.js --regulation regmc
```

The Reg M-B held-out draw is owed, on top of pass 7's. 0.67.0 changes a path Reg M-B runs: Protean on a charge turn.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/engine_release.js cut "abra/regmc 0.69.0, Reg M-B held-out"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown tools\lownode.cmd engine/game_differential.js --steering empirical --arm middle --end-state --census <copy of data/mechanics-census.json> --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen --release <id> --games 12000 --write --out <scratch>
```

Also owed:
- `tests/probe_protean_contrary.js` under Reg M-C: the `itemboost` lead reads NOT STAGED. This predates the pass.
- The `allyBasePowerBoost` catalogue drift in `data/tags-regmc.json` (`consumedBy`/`used`). It is metadata only.
