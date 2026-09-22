# Reg M-C engine pass: the move-effects table per regulation, then the board-material causes by first cause

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.24.0 onward (0.23.0 is MEASURE's). **Status.** Findings
record, historical by construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a8c585075229ae818`, base `b22c86a2` (abra/regmc 0.22.0) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d679`, selected by the regulation (`SHOWDOWN_PATH` unset) |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher in a private scratch folder; exit codes propagated (read on every run) |

**The pinned Reg M-C differential**, every reading below (`docs/_reports/2026-09-21-regmc-census.md` §6):

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-98c69a4fee7f.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games 1200 --write --out <scratch> --dump-games 2000 --dump-out data/_scratch-eng-a8c5-dump-<tag>.json
```

The state bar is `state.games - state.games_board_never_diverged`. First causes are `end_state[0].summary.by_cause` rows
whose materiality is BOARD-MATERIAL (keyed on the first PROTOCOL divergence), and the full `--dump-games` output.

**The Reg M-B regression check**, every commit: sha256 of `data/tags.json`, `data/protocol-events.json`,
`data/move-effects.js` against HEAD; `tests/test-engine-diff.js --n 6000 --seed 20260804` against the base engine bytes
(`b22c86a2`), with the control seed `20260805` on the base bytes shown to differ first (128 diff lines); the lattice
`--steering empirical --arm middle --end-state --census <HEAD's census, a copy> --team-store <main>/data/team-pool-frozen
--games 1200` on a Reg M-B release cut from the commit's tree.

---

## 1. The move-effects rulebook per regulation (abra/regmc 0.24.0)

### The defect, measured before the fix

`data/move-effects.js` is read by `moveFxTable` (`engine/medicham2-browser.js`): a move's secondaries, its certain
boosts and its accuracy. It was generated for one format (`build/build_browser_data.js`) and was not in the
per-regulation map. A scan of the Reg M-C dex (legal filter `exists && !isNonstandard && tier !== 'Illegal'`): 515 legal
Reg M-C moves, 500 rows, all 500 rows legal in Reg M-C, **15 legal moves with no row**: doubleshock, meteorassault,
milkdrink, octolock, slash, snipeshot, courtchange, drumbeating, glaiverush, jawlock, overdrive, pyroball,
revivalblessing, shiftgear, zingzap.

### Probe first — `tests/probe_regmc_move_effects.js --regulation regmc`

The cast is derived: the new moves are the legal Reg M-C moves Reg M-B's file has no row for (read by its bytes); among
them, the 100% target-drop moves (Drum Beating only) and the certain self-boost status moves (Shift Gear only); the
bodies carry no boost-handling ability (read off each ability's handlers).

| arm | staged | authority | engine before | engine after |
|---|---|---|---|---|
| SECONDARY | Rillaboom's Drum Beating into Snorlax | `-unboost|p2a|spe|1` | no unboost; board `boosts.spe 0/-1` | match, boards 0 |
| BOOSTS | Toxtricity's Shift Gear | `-boost spe 2`, `-boost atk 1` | nothing at all; 4 board leaves | match, boards 0 |
| ROWS | every legal move has a row in the table the selected regulation reads | — | `data/move-effects.js`, 15 missing | `data/move-effects-regmc.js`, 0 missing |

The engine's own receipts: `MEDFAILS.accuracyUnknown` read 2 on the SECONDARY arm before and 0 after.

| run | exit | red |
|---|---|---|
| 0.22.0 engine bytes (release `c2cce00ddfc8`) | 1 | both arms (lines and boards), accuracy fallback, the table clause |
| clean | 0 | none |
| `MEDI_MOVE_EFFECTS_OWNER_TABLE=1` | 1 | both arms (lines and boards), accuracy fallback |

Every staged set passed the Reg M-C `TeamValidator` fixture check (10 sets, 0 illegal).

### The fix

- `engine/regulation.js`: `['moveEffects', 'data/move-effects.js']` in `REG_FILE_KEYS`, `moveEffects` on the entry,
  `MOVE_EFFECTS_FILE` exported. The engine's lazy require goes through the resolver, so no reader was edited.
- `data/regulations.json`: `runtime.regmc.moveEffects: "data/move-effects-regmc.js"`.
- `engine/engine_release.js`: the regulation's copy is a `REGULATION_SOURCES` member.
- `build/build_browser_data.js`: every output through `fileFor`; `data/mega-formes.js` is SKIPPED (printed) under a
  regulation with no copy of its own. Without the skip, a Reg M-C run would have written Reg M-C's stones over Reg M-B's
  `data/mega-formes.js`: the write guard only protects mapped files.
- `data/move-effects-regmc.js`: `node build/build_browser_data.js --regulation regmc`, 515 legal moves. Against Reg
  M-B's file: the 15 new rows and **one shared row differs, Curse (no `volatile` in the Reg M-C checkout)**.
- Knob `MEDI_MOVE_EFFECTS_OWNER_TABLE` in `moveFxTable`: reads `data/move-effects.js` by its bytes, around the resolver.
- `tests/test-regulation-table.js` (+4 files in an M-C cut, the move-effects copy served by `REL.path`) and
  `tests/test-regulation-artifacts.js` (`move-effects` leaves `NOT_YET`). Both were red on the change before the edit.

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.22.0 (the brief's reading) | `c2cce00ddfc8` | 78 / 941 | 14 | 5 |
| 0.24.0 | `ae521767a04f` | **78 / 941** | 14 | 5 |

`ae521767a04f` holds the 0.24.0 code with the engine file's line endings LF; `bc28b741a80a` is the same code with the
checkout's CRLF (see the trap below). The count did not move: no board-material game in this sample is headed by one
of the 15 moves' missing secondaries. Glaive Rush's missing volatile (a self effect, not a table row) does head games;
that is §4.

### Reg M-B unmoved

- sha256: `data/tags.json` `c34d6465c3b6…`, `data/protocol-events.json` `4e2f810b338a…`, `data/move-effects.js`
  `f35ecd91ba86…`, each equal to `git show HEAD:<file>`.
- Damage differential: base (`b22c86a2` engine, regulation and release files) vs 0.24.0, seed `20260804`: identical
  but for the `wrote …` output-path line. Control seed `20260805` on the base bytes: 128 differing lines.
- Lattice: release `66a1c8056926` (cut from this tree, Reg M-B), **0 of 961 board-material**, 0 void, 0 threw.

### A trap on the way

Python's text-mode read turns CRLF into LF, and the edit wrote the engine file back LF. The files unpinned in
`.gitattributes` check out CRLF, and a release id is a digest of the working-tree bytes, so the cut moved with no code
change and `tests/test-engine-release.js` failed its line-ending invariant. The files were converted back to the
checkout's CRLF and the release re-cut (`bc28b741a80a`). Runbook row appended.

---

## 2. The "Aura Guard card that only parts after earlier games": not engine state

The brief's first ask was to find a state leak between games. **There is none in the engine for this card; the
cross-game state is the differential DRIVER's.**

### Method

A scratch harness (`leak.js`, private scratch folder) replays the pinned run's schedule exactly as
`engine/replay_one.js` does (configurations in `SW.out` order, `floor(GAMES / configs)` pairs each, `driverReset()` at
the top), snapshots the driver (`driverSnap`: clicks, coverage credit, attempts, kinds, touched, first turns, credit
by turn) immediately before the target game, plays it, and writes the snapshot and both traces. A SECOND process then
plays the target with no game before it and the driver restored from that snapshot, and diffs its traces against the
first. A third arm, in the same second process, plays it with the driver at zero.

### Results, release `ae521767a04f`

| target | warm (in schedule) | fresh process, driver restored | driver at zero |
|---|---|---|---|
| `omit-spread …2681810796 vs …2681798959` (a Fake Out into Lucario-Mega-Z on turn 1) | parts at line 10, Lucario 136 vs 127, after 1,049 earlier games | **identical traces, 98 of 98 lines on both sides** | identical |
| `omit-spread …2678336611 vs …2678317676` (the game named in the 0.22.0 report's Aura Guard card) | parts at line 52 on a Baxcalibur, after 873 earlier games | **differs at line 9**, the mega line: warm `Salamence-Mega`, fresh `Lucario-Mega-Z` | same as fresh |

The second game's warm and fresh runs agree on every line before the mega line, and both engines' traces move
together there, so the input they were handed changed and neither engine did. The cause is in the driver:

```
engine/game_differential.js:3434   let MEGA_PREFER_B = false;   // alternates, so the driver does not mega out of the left slot every time
engine/game_differential.js:4978   const order = MEGA_PREFER_B ? [1, 0] : [0, 1];
engine/game_differential.js:4983   a.mega = true; megaChoices++; MEGA_PREFER_B = !MEGA_PREFER_B; break;
```

`MEGA_PREFER_B` flips on every mega across the whole run and is not in `driverSnap` / `driverRestore` (:6138-6149).
When a side holds two stones, which body megas depends on the parity of every mega before it. The 0.22.0 card "agreed
alone" because, played alone, the Lucario did not mega and there was no Aura Guard to get wrong. Restored or not, the
engine produced the same game from the same input.

**Filed, not changed:** the driver is MEASURE's instrument. Putting the flag in the snapshot would change which games
the primary arm's stones-removed controls hand back, i.e. the sample, and that is a decision about the instrument.

### The real defect

Section 3.

---

## 3. Aura Guard halves contact damage (abra/regmc 0.25.0)

### The authority, derived

`tests/probe_regmc_aura_guard.js` prints the population from the tag file and the handler from the dex: one ability
has a contact-only `damageReduce` in `data/tags-regmc.json`, `auraguard`, whose handler in the M-C checkout is
`onSourceModifyDamage(damage, source, target, move) { if (move.flags["contact"]) return this.chainModify(0.5); }`; its
only legal carrier is Lucario via Lucarionite Z. `data/tags.json` (Reg M-B) has no contact-only member, so the branch
cannot run under Reg M-B.

### The defect

`engine/medicham2-browser.js`'s `damageReduce` reader evaluates `superEffective`, `fullHP`, `special`, `physical` and
`sound`; any other condition is refused and counted (`MEDFAILS.damageReduceUnknown`), by design (WIRE 36). `contact`
was not among them, so Aura Guard was never applied.

### The fix

`:_w==='contact'?mvMakesContact(mv.id,att,mv)`. `mvMakesContact` with the attacker and the per-use move answers the
ACTIVE move's flag: the tag, plus Shell Side Arm's per-use flag, minus Long Reach's removal. Mold Breaker is already
handled (`defAb` is the ability left standing). Knob `MEDI_DAMAGE_REDUCE_CONTACT_UNKNOWN` restores the refusal.

### Probe

| arm | staged (turn 1: the holder megas behind Protect; turn 2: one hit) | authority | before | after |
|---|---|---|---|---|
| CONTACT | Charizard's Dragon Claw | 132/145 | 119/145 (not halved); board `hp 119/132` | match, boards 0 |
| NONCONTACT | Venusaur's Seed Bomb | 107/145 | 107/145 | match |
| BREAKER | Pinsir (Mold Breaker)'s Slash | 100/145 | 100/145 | match |

| run | exit | red |
|---|---|---|
| 0.24.0 engine bytes (release `bc28b741a80a`) | 1 | CONTACT (line and board), the counter clause |
| clean, release `37942009a577` | 0 | none |
| `MEDI_DAMAGE_REDUCE_CONTACT_UNKNOWN=1` | 1 | CONTACT (line and board) |

9 staged sets, 0 illegal under the Reg M-C `TeamValidator`.

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.24.0 | `ae521767a04f` | 78 / 941 | 14 | 5 |
| 0.25.0 | `37942009a577` | **56 / 952** | 3 | 4 |

The played count rose because 11 VOID games came back (VOID: the two dice streams stopped agreeing, which a damage
mismatch causes). Every Lucario damage-value card is gone. Remaining damage-value cards are on Baxcalibur (six,
after a Glaive Rush), a Golisopod, a Basculegion and two Infestation ticks.

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `79ba77f8744d`: **0 of 961**, 0 void, 0 threw.

---

## 4. Glaive Rush leaves its user exposed (abra/regmc 0.26.0)

### The authority, read whole

M-C checkout `data/moves.ts` glaiverush :6647-6678 (the Champions mod names it only in learnsets): `self: {
volatileStatus: 'glaiverush' }`; the condition's `onStart` writes `-singlemove … [silent]`, `onAccuracy()` returns true,
`onSourceModifyDamage()` returns `chainModify(2)`, and `onBeforeMove` (priority 100) removes it. `sim/battle-actions.ts`
:1317-1335 `selfDrops` applies `self` once per target still in the list after the damage step.

### Tag, membership printed before wiring

`exposesUser {volatile, damageTakenMult, alwaysHitBy, endsBeforeOwnMove, silentStart, from}` from the self volatile's
condition. Whole move dex:

```
pokemon-showdown-mc gen9championsvgc2026regmc   glaiverush[legal]
pokemon-showdown-mc gen9championsvgc2026regmb   glaiverush[legal]      (the M-C checkout reads the old format too)
pokemon-showdown    gen9championsvgc2026regmb   glaiverush[Past]
```

`data/tags-regmc.json` was regenerated with `node engine/tag_dex.js --regulation regmc`; a structural diff that ignores
usage and stamps showed 14 `linkage` blocks and `sheet_entries` moving with the worktree's stores and no rule change, so
only the new descriptor and the Glaive Rush row were SPLICED onto the committed file (its CRLF kept). Runbook row.

### Engine

Armed in `_stepSelfPay` beside the recharge, on the same clause (`!m.fainted && _reached > 0`). `exposedVolatiles()` maps
volatile to params off the tag. The damage chain multiplies by `damageTakenMult` beside `damageReduce` (x2 is exact in the
4096ths chain, so its position cannot move a number). `hitChance` returns a certain hit beside Lock-On. The BeforeMove
gate drops it at its top, above recharge. A switch clears it with every volatile.

### Board leaf

`engine/board_state.js` compares `vol.glaiverush` on both sides (presence). `tests/probe_uncompared_leaves.js
--regulation regmc` listed `volatile:glaiverush` and `volatile:octolock` before; after, only `volatile:octolock`.

### Probe — `tests/probe_regmc_glaive_rush.js --regulation regmc`

| arm | staged | authority (user's damage taken, turn 1 / turn 2) | 0.25.0 engine | after |
|---|---|---|---|---|
| EXPOSED | Baxcalibur Glaive Rushes Aggron; a slower Snorlax Seed Bombs Baxcalibur; turn 2 Baxcalibur moves first | 66 / 33 | 33 / 33; board `hp 157/124`, `vol.glaiverush 0/1` | match, boards 0 |
| CONTROL | the same with Dragon Claw | 33 / 33 | match | match |

| run | exit | red |
|---|---|---|
| 0.25.0 engine bytes (`--medi`) | 1 | EXPOSED (lines and boards) |
| clean, release `3c2625e09826` | 0 | none |
| `MEDI_SELF_EXPOSED_INERT=1` | 1 | EXPOSED (lines and boards) |

The dex check in the probe asserts every legal move whose self volatile raises the damage its user takes carries the
tag. 7 staged sets, 0 illegal.

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.25.0 | `37942009a577` | 56 / 952 | 3 | 4 |
| 0.26.0 | `3c2625e09826` | **43 / 953** | 2 | 4 |

Every Baxcalibur damage-value card is gone. (`84b4be6731ec` was cut from a syntactically broken intermediate and never
measured anything; it is an untracked worktree release.)

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `2227f14a9d2e` (whose board reader now compares `vol.glaiverush`): **0 of 961**, 0
void, 0 threw.

---

## 5. Octolock (abra/regmc 0.27.0)

### The authority, read whole

M-C checkout `data/moves.ts` octolock :12960-12994; the Champions mod (`data/mods/champions/moves.ts` :703-706) only
sets `isNonstandard: null`. The condition (read from the dist dex): no `duration`; `onStart` writes `-start ... move:
Octolock|[of] <source>`; `onResidual` (order 14) first ends it when `source && (!source.isActive || source.hp <= 0 ||
!source.activeTurns)`, writing `-end ... Octolock|[partiallytrapped]|[silent]`, and otherwise boosts `{def: -1, spd:
-1}`; `onTrapPokemon` traps while the source is active. `activeTurns` is incremented in `endTurn` (`sim/battle.ts:1765`)
and reset on switch-in (`sim/battle-actions.ts:137`).

### The defect, shown by the probe before the fix

The per-turn-boost residual (`perTurnBoostVolatiles`, the Syrup Bomb family) decrements `_vol[v]` as a clock. Octolock
has no clock (the generic volatile write stores a bare 1), so this engine wrote `-end|X|octolock` at the first residual
and dropped nothing; the authority dropped two stages every turn.

| arm | authority | 0.26.0 engine | after |
|---|---|---|---|
| LOCK (3 turns) | 6 `-unboost` | 0; `-end` at turn 1; boards part on `boosts.def/spd` every turn | match, boards 0 |
| RELEASE (user switches out on turn 3) | 4 `-unboost`, then `-end ... [partiallytrapped]|[silent]` at the residual | 0 | match, boards 0 |

### Tag, engine, board

`perTurnBoost` gains `residualSourceEnd {clauses: [isActive, hp, activeTurns], endArgs: ['[partiallytrapped]',
'[silent]']}` and `trapsWhileSourceActive: true`, both read off the handler text; a structural diff of the regenerated
tag file showed only the Octolock row changing (Syrup Bomb's row is identical), and that row was spliced. The residual
walk ticks a clockless member without decrementing and ends it with the tag's arguments when the source is gone
(`sourceOffField` for `isActive`/`hp`, `_newlySwitched` for `!activeTurns`, as the partial trap does); the `onUpdate`
sweep skips it; `switchTrapVerdict` refuses a switch while the source is active (`MEDSEEN.volTrapBlocked`; not probed,
because the staged harness can only offer choices the authority's request allows). `engine/board_state.js` compares
`vol.octolock`. `tests/probe_uncompared_leaves.js --regulation regmc` after: 84 leaves written, 58 compared, 4
declared, 22 in neither, and all 22 end before the boundary (20 have a one-turn duration, 2 end inside their own
action). The Reg M-C gate's board-leaves clause should now pass; it was not run from this worktree.

| run | exit | red |
|---|---|---|
| 0.26.0 engine bytes (`--medi`) | 1 | both arms (lines and boards) |
| clean, release `ac2bfd957f10` | 0 | none |
| `MEDI_PERTURN_BOOST_CLOCK_ALWAYS=1` | 1 | both arms (lines and boards) |

The first cast gave the locked foe Focus Energy as its idle click, and a second Focus Energy writes `-fail` (the kit's
known narration difference); the target's click is now a repeatable self boost of a stat the lock does not touch. The
`-start` line is compared without its `[of]` field (the differential's reducer folds it; narration, recorded).

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.26.0 | `3c2625e09826` | 43 / 953 | 2 | 4 |
| 0.27.0 | `ac2bfd957f10` | **43 / 953** | 2 | 4 |

Unmoved, as expected before the run: Octolock has 15 Reg M-C sheet uses (`data/tags-regmc.json` `uses`), and no
board-material game in this sample is headed by it. The lab moved; the pool did not.

### The remaining board-material games, by first BOARD divergence (0.26.0 run, 40 of 43 listed; the list caps at 40)

| family | games | what parts |
|---|---|---|
| Revival Blessing with no fainted ally: the authority `-fail`s, this engine pivots a bench body in | 9 | species/hp of the slot |
| Terrain lasting 8 turns in the authority and 5 here (`field.terrain_turns 5/8`) | 7 | field |
| Infestation chip larger in the authority | 3 | hp |
| Normal Gem spent on Fake Out | 2 | item, hp |
| White Herb timing | 2 | item, boosts |
| games whose first PROTOCOL divergence is the Sirfetch'd / Farfetch'd display name, so the board cause is hidden | 5 | various, later |
| one each: Grassy Terrain end, Seed Sower, Liquid Ooze, Double Shock's type ordering, Berserk, Trace's pick, rain upkeep, Psychic Fangs after the authority stopped, Psychic Terrain on a different body, two damage values (Golisopod, Basculegion) | 12 | various |

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `d276a79a2605`: **0 of 961**, 0 void, 0 threw.

---

## 6. Revival Blessing fails when nobody has fainted (abra/regmc 0.28.0)

### The authority, read whole

M-C checkout `data/moves.ts` revivalblessing :15110-15136 (the Champions mod names it only in learnsets): `onTryHit(source)
{ if (!source.side.pokemon.filter(ally => ally.fainted).length) return false; }`, `slotCondition: 'revivalblessing'`,
and `selfSwitch: true` under the comment "No this not a real switchout move / This is needed to trigger a switch
protocol to choose a fainted party member". The revival is in the simulator: `sim/battle.ts` :2781-2797 (`runAction` case
'revivalblessing': `sethp(maxhp / 2)`, `-heal ... [from] move: Revival Blessing`, an `instaswitch` when the body's
position is an active slot), `sim/side.ts` :925-985 (the request must name a fainted body: "Can't switch: You have to
pass to a fainted Pokémon").

### Tag, membership printed before wiring

`revivesFainted {slotCondition, failsWithoutFainted, hpFraction, instaswitchIfActiveSlot, from}`: a move with a
`slotCondition`, a `selfSwitch` and an `onTryHit` testing `.fainted`; the fraction from `Battle.prototype.runAction`.
Whole move dex: `pokemon-showdown-mc` Reg M-C `revivalblessing[legal]`, `pokemon-showdown` Reg M-B `revivalblessing[Past]`;
both runActions read `sethp(action.target.maxhp / 2)`. `pivotStatus` now skips a `reviveShape` move. Spliced into
`data/tags-regmc.json`: the Revival Blessing row and the `revivesFainted` / `pivotStatus` descriptors.

### Engine

`playerAction` returns `{kind:'switch', mv, revive:true}` for the tag (the kind is kept so every reader of a move-driven
switch still sees one). At the top of the switch branch: when the user's roster (`sf.team`) holds no fainted body,
`-fail|USER` and `continue`; otherwise `MEDFAILS.reviveUnmodelled` is counted and the old pivot road runs.

### Probe — `tests/probe_regmc_revival_blessing.js --regulation regmc`

| arm | staged | authority | 0.27.0 engine | after |
|---|---|---|---|---|
| FAIL | Pawmot clicks Revival Blessing with its whole team standing | `-fail|p1a: Pawmot`, stays in | `|switch|p1a: Snorlax ... [from] revivalblessing`; boards part on the slot's species, hp, types, ability | match, boards 0 |

| run | exit | red |
|---|---|---|
| 0.27.0 engine bytes (release `ac2bfd957f10`) | 1 | the tag clause, FAIL (lines and boards), the counter clause |
| clean, release `0bb19ac17b74` | 0 | none |
| `MEDI_REVIVE_AS_PIVOT=1` | 1 | FAIL (lines and boards) |

REVIVE (a fainted ally exists) is NOT STAGED: the harness answers the authority's request by mirroring this engine's
slot, and `mirrorForcedSwitch` (`engine/game_differential.js`) looks only for a live bench body, so a revival request
has no expression. The pinned run's refused choices are exactly that: `Can't switch: You have to pass to a fainted
Pokémon`, 7 at 0.24.0 and 6 at 0.28.0. **Filed for MEASURE:** the mirror needs a revival branch (the request's
`reviving` field) before the engine's revive road can be shown right or wrong.

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.27.0 | `ac2bfd957f10` | 43 / 953 | 2 | 4 |
| 0.28.0 | `0bb19ac17b74` | **33 / 954** | 1 | 4 |

Every "Revival Blessing with no fainted ally" game is gone. First BOARD divergences on this run (33 listed): the
terrain clock `5/8` in 10, Normal Gem 3, White Herb 2, Infestation chip 2, and singles.

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `e397d32dc184`: **0 of 961**, 0 void, 0 threw.

---

## 7. Terrain Extender (abra/regmc 0.29.0)

### The authority, read whole

Every terrain condition in the M-C checkout's `data/moves.ts` (electricterrain :4511, grassyterrain :7687, mistyterrain
:12165, psychicterrain :14109): `durationCallback(source, effect) { if (source?.hasItem('terrainextender')) return 8;
return 5; }` — the setter's item, whether it clicked the move or walked in with a Surge ability. The M-C tag file
already carried `extendsDuration {extends: [the four terrains], toTurns: 8, insteadOf: 5}` on `terrainextender` (80
sheet uses); nothing consumed it for a terrain. `data/tags.json` (Reg M-B) has no terrain extender row (`Past`).

### The fix

`terrainTurns(terrain, item)` beside `weatherTurns`, reading the item's tag through `terrainId`; both writers (the
`kind:'terrain'` branch and the entry ability) call it with the setter's item. Knob `MEDI_TERRAIN_FIVE_ALWAYS`.

### Probe — `tests/probe_regmc_terrain_extender.js --regulation regmc`

| arm | staged | 0.28.0 engine | after |
|---|---|---|---|
| MOVE | Ampharos @ Terrain Extender clicks Electric Terrain | `field.terrain_turns` 4/7, 3/6, 2/5 at the boundaries | match, boards 0 |
| ABILITY | Rillaboom (Grassy Surge) @ Terrain Extender leads | `field.terrain_turns` 5/8 at turn 0, then 4/7, 3/6 | match, boards 0 |
| CONTROL | the MOVE arm with no item | match | match |

| run | exit | red |
|---|---|---|
| 0.28.0 engine bytes (`--medi`) | 1 | MOVE and ABILITY boards |
| clean, release `2ed8f7966fdf` | 0 | none |
| `MEDI_TERRAIN_FIVE_ALWAYS=1` | 1 | MOVE and ABILITY boards |

The move road's `-fieldstart` carries `[of] <user>` here and nothing on the authority (its `[from]`/`[of]` pair is
written only for an ability effect); the differential's reducer folds `[of]`, so the probe compares the line without it
(narration, recorded).

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.28.0 | `0bb19ac17b74` | 33 / 954 | 1 | 4 |
| 0.29.0 | `2ed8f7966fdf` | **25 / 954** | 1 | 4 |

First BOARD divergences on this run (all 25 listed): Infestation chip (Binding Band) 3, Normal Gem 3, White Herb 3,
games whose first protocol divergence is the Sirfetch'd / Farfetch'd name 5, and one each of Grassy Terrain's end, Seed
Sower, Liquid Ooze, Berserk, Trace's pick, rain upkeep, Psychic Fangs after the authority stopped, a switch after the
authority stopped, Psychic Terrain on a different body, and two damage values.

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `f5e8a0f68e2b`: **0 of 961**, 0 void, 0 threw.

---

## 8. The 17 census rows LIVE under Reg M-B and MISSING under Reg M-C: all staging gaps

Read from `data/mechanics-census-regmc.json` (each row's `detail`) and from each probe's pass condition in
`tests/test-mechanics.js`. **No row is an engine gap.** Every one asserts a Reg M-B fact about the FIXTURE — a stat, a
damage number, a move a body was built with, a key spelling, or an authority line the Reg M-C checkout no longer writes —
and the Reg M-C table (`data/engine-data-regmc.js`) builds the same species differently.

| # | row | why it is MISSING under Reg M-C | class |
|---|---|---|---|
| 1 | item/megaStone | pass condition hard-codes the Reg M-B build's SpA (`gengar,cursedbody,200`); the M-C build reads 220, and the stone-holder is still built base-forme and evolves on the choice (`gengar-mega,shadowtag,260`) | staging: typed M-B stat |
| 2 | ability/speedCond (Quick Feet) | hard-codes Speeds 192 / 205 / 288; the M-C build reads 175 / 187 / 262 = 175 x 1.5, and the order flips exactly as it must | staging: typed M-B stats |
| 3 | move/forbidsStatusMoves (use) | the untaunted foe must click a status move and clicks Moonblast: the arm cannot show a refusal | staging: fixture choice |
| 4 | move/forbidsStatusMoves (menu) | 0 status clicks in 40 draws untaunted, so there is nothing for Taunt to remove | staging: fixture choice |
| 5 | ability/disablesAttacker (Cursed Body) | `sealed="earthquake"` is written, but the free pick is Draco Meteor in both arms | staging: fixture choice |
| 6 | move/spreadFoes | hard-codes the Reg M-B authority's index-7 damage (64 / 52) | staging: typed M-B damage |
| 7 | item/survivesFromFull (Focus Sash) | the hit leaves 33 HP with no item under the M-C build, so the Sash has nothing to do | staging: fixture damage |
| 8 | move/sealsMoves (Disable) | the free choice is Flamethrower in both arms, never the disabled move | staging: fixture choice |
| 9 | move/drain (spread) | the probe's own NOT STAGED: both damages are 14, so per-body and lumped rounding agree | staging: fixture damage |
| 10 | ability/priorityModFlying (Gale Wings) | 0 damage taken before acting in every arm, the control included: nothing hits the M-C build's Talonflame before it acts, with or without the ability | staging: fixture speed |
| 11 | item/healsAtThreshold (Sitrus) | the no-item control survives both hits (24 HP), so the berry's timing cannot decide anything | staging: fixture damage |
| 12 | ability/hitsTwice (Parental Bond) | hard-codes the Reg M-B authority's 42; the M-C build's blank is 38 | staging: typed M-B damage |
| 13 | ability/clearsScreensOnEntry (Screen Cleaner) | the screens read 4 and 4 without the ability and 0 and 0 with it, exactly right; the pass condition wants the slot-0 key `mrrime` and the M-C table keys the species `mr-rime` | staging: key spelling (a table finding, below) |
| 14 | ability/speedCond (Slush Rush) | hard-codes Speeds 70 / 140; the M-C Beartic is 104 and outspeeds the foe without snow | staging: typed M-B stats |
| 15 | ability/protectsAllyFromStatus (Aroma Veil) | the no-ability control's Encore on the ally does not land: the fixture sets the ally's last move to Twin Beam, which is in the M-B build's Farigiraf set and not the M-C build's (`psychic, thunderbolt, protect, trickroom`) | staging: fixture moveset |
| 16 | move/weatherSetter (sand order) | hard-codes Speeds 205 / 101 / 80 | staging: typed M-B stats |
| 17 | ability/punishesAttacker (Spicy Spray) | asserts the bare `-immune` line; the M-C checkout's handler is `onDamagingHit(...) { source.trySetStatus("brn", target); }` and writes no line (M-B's wrote one), the M-C tag file's `attackerImmune` is null, and this engine writes nothing: it matches the M-C authority | staging: asserts the M-B authority |

**What would fix them** is test work, not engine work: derive each expected value from the build and the authority on
the run (as the Reg M-C staged probes do), or gate the row on the regulation. Reg M-B is closed at 7.0.0 and its census
rows are not to be moved, so this is recorded, not done here.

**One table finding on the way, not fixed:** the M-C table keys species with punctuation by a hyphenated id (`mr-rime`,
`sirfetch-d`, `farfetch-d`) where the Reg M-B table uses the bare id. That is also why this engine writes `sirfetch-d`
as the species field of a `|switch|` line, which heads five board-material games at 0.29.0 (their board causes are
later and hidden behind it). It belongs to `build/build_engine_data_regmc.js`.

---

## 9. Binding Band (abra/regmc 0.30.0)

### The authority, read whole

`partiallytrapped` (M-C checkout, read from the dist dex): `durationCallback(target, source) { if
(source?.hasItem("gripclaw")) return 8; return this.random(5, 7); }`; `onStart(pokemon, source) { ...;
this.effectState.boundDivisor = source.hasItem("bindingband") ? 6 : 8; }`; `onResidual` ends the trap when the source is
gone and otherwise `this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor)`. The `partialTrap` tag on every
trapping move already carries `chipItem {item: bindingband, chipPerTurn: 1/6}` and `durationItem {item: gripclaw,
duration: 8}`, in both tag files. Binding Band is legal in Reg M-C; Grip Claw is `Past` in both.

### The fix

At the trap's landing (`engine/medicham2-browser.js`, the partial-trap block), `frac` and `turns` come from the item
fields when the trapper holds the named item, and a `div` is kept; the two tick sites compute `floor(maxhp / div)` when
there is one, and the old `floor(maxhp * frac)` otherwise, so an eighth (exact in binary) is untouched. Knob
`MEDI_TRAP_CHIP_ITEM_BLIND`.

### Probe — `tests/probe_regmc_binding_band.js --regulation regmc`

| arm | staged | authority | 0.29.0 engine | after |
|---|---|---|---|---|
| BAND | Ariados @ Binding Band, Infestation into Kingambit (175 HP) | 131, then 102 (29 a tick) | 139, then 118 (21 a tick) | match, boards 0 |
| CONTROL | no item | 139, then 118 | match | match |

| run | exit | red |
|---|---|---|
| 0.29.0 engine bytes (release `2ed8f7966fdf`) | 1 | BAND (lines and boards) |
| clean, release `fa4072a17835` | 0 | none |
| `MEDI_TRAP_CHIP_ITEM_BLIND=1` | 1 | BAND (lines and boards) |

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.29.0 | `2ed8f7966fdf` | 25 / 954 | 1 | 4 |
| 0.30.0 | `fa4072a17835` | **22 / 954** | 1 | 4 |

The three Infestation-chip games are gone.

The measured release `fa4072a17835` and the committed bytes (`2c2119c13dcc`) differ only in a comment: a sentence
claiming the float product is one short on a multiple of six was checked (every multiple of six to 400 agrees) and
removed before commit.

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `8abdc33a57a2`: **0 of 961**, 0 void, 0 threw.

---

## 10. Normal Gem (abra/regmc 0.31.0)

### The authority, read whole

M-C checkout `data/items.ts` normalgem (the Champions mod does not name it): `onSourceTryPrimaryHit(target, source, move)
{ if (target === source || move.category === "Status" || move.flags["pledgecombo"]) return; if (move.type === "Normal"
&& source.useItem()) { source.addVolatile("gem"); } }`. `data/conditions.ts` gem: `duration: 1`, `onBasePowerPriority:
14`, `onBasePower() { return this.chainModify([5325, 4096]); }`. `TryPrimaryHit` is raised per target in
`tryPrimaryHitEvent` (`sim/battle-actions.ts` :1138-1146), inside `spreadMoveHit`, after the accuracy steps and before
`getSpreadDamage`. In the pinned games the gem was on a Sneasler's and a Dragonite's Fake Out / Extreme Speed, and
`useItem` granted Unburden (the `vol.unburden 0/1` leaf).

### Tag, membership printed before wiring

`typeGem {type, mod, volatile, skipsSelfTarget, skipsStatus, from}`. Whole item dex: the M-C checkout, 18 gems, the
only legal one `normalgem`; the M-B checkout, 18 gems, none legal. The engine's tag file for Reg M-C was regenerated and
only the Normal Gem row and the descriptor spliced in (the item was `untagged`).

### Engine

`typeGemSpend(m, tg, moveId, mvObj, field)` at the top of `_stepDamage`, once per use; the active move type is
`effMoveType`. The boost is `m._gemBoost {mv, mod}`, read in the base-power relay after every other member, and dropped
at the holder's next BeforeMove gate.

### Probe — `tests/probe_regmc_type_gem.js --regulation regmc`

| arm | staged | authority | 0.30.0 engine | after |
|---|---|---|---|---|
| GEM | Kingambit @ Normal Gem, Slash into Baxcalibur | `-enditem ... [from] gem|[move] Slash`, 91/190 | no `-enditem`, 114/190 | match, boards 0 |
| OFFTYPE | the same holder's Night Slash | no spend, 90/190 | match | match |
| CONTROL | Slash with no item | 114/190 | match | match |

| run | exit | red |
|---|---|---|
| 0.30.0 engine bytes (`--medi`) | 1 | GEM (lines and boards) |
| clean, release `5664c1b395a2` | 0 | none |
| `MEDI_TYPE_GEM_INERT=1` | 1 | GEM (lines and boards) |

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.30.0 | `fa4072a17835` | 22 / 954 | 1 | 4 |
| 0.31.0 | `5664c1b395a2` | **19 / 954** | 1 | 4 |

The three Normal Gem games are gone.

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `879b7cf1227d`: **0 of 961**, 0 void, 0 threw.

---

## 11. White Herb before the owed switches (abra/regmc 0.32.0)

### The authority, read whole

`whiteherb` (M-C checkout, read from the dist dex): `onStart` restores every negative stage and spends the item; it is
raised from `onAnySwitchIn`, `onAnyAfterMega`, `onAnyAfterMove` and `onResidual`. `AfterMove` is raised inside `useMove`;
`runAction`'s tail (`sim/battle.ts` :2820-2907) then drags every `forceSwitchFlag` body (Red Card), runs
`faintMessages`, `Update`, and requests the `switchFlag` switches (Eject Button, Emergency Exit, a pivot).

### The defect, and the pinned game it came from

`omit-spread …2680875688`, turn 4: Sneasler's Close Combat into a Rillaboom holding Eject Button. Authority:
`-enditem|Rillaboom|Eject Button`, `-enditem|Sneasler|White Herb`, `-clearnegativeboost`, then Incineroar switches in and
Intimidates (Sneasler -1 Atk, kept). This engine: the switch and the Intimidate first, then the herb, which cleared the
Intimidate drop too (board `boosts.atk 0/-1`).

### The fix

`restoreStatsAll(actA, actB)` (the herb's one reader) at the top of the end-of-action block, when a Red Card drag or an
owed Eject Button / Emergency Exit switch is pending. Those doors are M-C-only (Red Card and Eject Button are `Past` in
Reg M-B; Emergency Exit has no Reg M-B carrier), so every Reg M-B road keeps its post-action pass. Knob
`MEDI_HERB_AFTER_OWED_SWITCH`.

### Probe — `tests/probe_regmc_white_herb_before_switch.js --regulation regmc`

| arm | staged | authority | 0.31.0 engine | after |
|---|---|---|---|---|
| EJECT | Snorlax @ White Herb, Superpower into Sylveon @ Eject Button; Arbok (Intimidate) replaces it | herb, then switch, then Intimidate (Atk -1 stays) | switch, Intimidate, then herb (Atk 0); board `boosts.atk 0/-1` | match, boards 0 |
| CONTROL | the same with no Eject Button | the herb clears the self-drop | match | match |

| run | exit | red |
|---|---|---|
| 0.31.0 engine bytes (release `5664c1b395a2`) | 1 | EJECT (lines and boards) |
| clean, release `7a7240f738d1` | 0 | none |
| `MEDI_HERB_AFTER_OWED_SWITCH=1` | 1 | EJECT (lines and boards) |

### Pinned Reg M-C differential

| engine | release | state bar | void | threw |
|---|---|---|---|---|
| 0.31.0 | `5664c1b395a2` | 19 / 954 | 1 | 4 |
| 0.32.0 | `7a7240f738d1` | **18 / 954** | 1 | 4 |

The two other White Herb games stand: in both, the authority's last lines are the herb's `-enditem` and
`-clearnegativeboost`, and this engine emits nothing further (both engines "ended the battle"). A reading of that, not
probed: the move that ends the battle raises `AfterMove` (and so the herb) before `faintMessages` decides the winner,
and this engine breaks out of the turn on the wiped side before its post-action pass. Staging it needs a side wiped by
one move in the four-body harness.

### Reg M-B unmoved

sha256 of the three Reg M-B files unchanged; damage differential seed `20260804` identical to the base but for the
output-path line; lattice on release `5ca8aaa41c6c`: **0 of 961**, 0 void, 0 threw.

---

## 12. Where it stands, and what is left

### The pinned Reg M-C differential, commit by commit (state bar = `state.games - state.games_board_never_diverged`)

| commit | mechanic | release | board-material | void | threw |
|---|---|---|---|---|---|
| base `b22c86a2` (0.22.0) | — | `c2cce00ddfc8` | 78 / 941 | 14 | 5 |
| 0.24.0 `768ea2fd` | move-effects table per regulation | `ae521767a04f` | 78 / 941 | 14 | 5 |
| 0.25.0 `ae58e6ba` | Aura Guard (contact damage cut) | `37942009a577` | 56 / 952 | 3 | 4 |
| 0.26.0 `eb7798b8` | Glaive Rush (exposed user; leaf compared) | `3c2625e09826` | 43 / 953 | 2 | 4 |
| 0.27.0 `a0e42ba5` | Octolock (clockless drop; leaf compared) | `ac2bfd957f10` | 43 / 953 | 2 | 4 |
| 0.28.0 `cb42bc64` | Revival Blessing fails without a fainted ally | `0bb19ac17b74` | 33 / 954 | 1 | 4 |
| 0.29.0 `b2f7eacb` | Terrain Extender | `2ed8f7966fdf` | 25 / 954 | 1 | 4 |
| 0.30.0 `96fa8b46` | Binding Band | `fa4072a17835` | 22 / 954 | 1 | 4 |
| 0.31.0 `b294c417` | Normal Gem | `5664c1b395a2` | 19 / 954 | 1 | 4 |
| 0.32.0 | White Herb before the owed switches | `7a7240f738d1` | **18 / 954** | 1 | 4 |

Every run: `--games 1200`, `--steering empirical --arm middle --end-state`, census pin
`census-pin-regmc-98c69a4fee7f`, team store `data/team-pool-frozen-regmc` (the main tree's), Reg M-C checkout
`f10d679`. Faint-HP writing (`0fnt` on one side), 14 at the brief, reads 0 from 0.26.0 on: those games were Aura Guard
and Glaive Rush damage.

### What is left: the 18, by first BOARD divergence (0.32.0 run, all 18 listed)

| family | games |
|---|---|
| first protocol divergence is the Sirfetch'd / Farfetch'd display name (M-C table key `sirfetch-d`); the board cause is later and hidden | 5 |
| White Herb spent by the authority on the battle's last move, not here | 2 |
| a switch or a move after the authority stopped emitting (rain upkeep, Psychic Fangs, a switch) | 3 |
| a damage value (Golisopod, Basculegion) | 2 |
| Grassy Terrain's end not written here | 1 |
| Seed Sower's terrain not set here | 1 |
| Liquid Ooze not applied here | 1 |
| Berserk boosting here and not in the authority | 1 |
| Trace copying a different ability | 1 |
| Psychic Terrain's `-activate` on a different body | 1 |

THREW stays at 4, and the refused-choice counter reads 6: the Revival Blessing revive road the harness cannot mirror.

### Reg M-B, every commit

`data/tags.json` `c34d6465c3b6…`, `data/protocol-events.json` `4e2f810b338a…`, `data/move-effects.js` `f35ecd91ba86…`:
byte-identical to HEAD at every commit. `tests/test-engine-diff.js --n 6000 --seed 20260804`: identical to the base but
for the `wrote …` line at every commit (control seed `20260805` on the base: 128 differing lines). Lattice `--games
1200`: 0 of 961, 0 void, 0 threw, on releases `66a1c8056926`, `79ba77f8744d`, `2227f14a9d2e`, `d276a79a2605`,
`e397d32dc184`, `f5e8a0f68e2b`, `8abdc33a57a2`, `879b7cf1227d`, `5ca8aaa41c6c`. No Reg M-B census or roster row was added.

### Filed for other divisions

- **MEASURE:** `MEGA_PREFER_B` (`engine/game_differential.js` :3434) is outside `driverSnap`, so a game replayed alone
  or with the counters restored can take a different mega (§2). `mirrorForcedSwitch` cannot answer a revival request
  (§6). The census rows' typed Reg M-B values (§8).
- **ENGINE, next pass:** the M-C table's hyphenated species keys (`build/build_engine_data_regmc.js`), then the list
  above.

### Scratch left in the worktree (mine, untracked)

`data/verification/_eng-a8c5-ediff-*.json` (the damage-differential outputs), `data/_scratch-eng-a8c5-dump-*.json`
(git-ignored), and the releases cut here under `data/releases/` (untracked in a worktree), including `84b4be6731ec`, cut
from a syntactically broken intermediate and never used for a measurement.
