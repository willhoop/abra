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
