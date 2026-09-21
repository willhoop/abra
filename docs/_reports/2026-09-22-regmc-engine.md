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
