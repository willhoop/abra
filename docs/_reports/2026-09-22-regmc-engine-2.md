# Reg M-C engine pass 2: the pinned board-material games, largest cause first

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.33.0 onward (0.40.0 onward is MEASURE's). **Status.**
Findings record, historical by construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a99fae50f915b34e9`, base `6cb275fb` (abra/regmc 0.32.0), main merged before each commit |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`, selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher (`data/_scratch-eng-a99f/run.js`, git-ignored) |

**The pinned Reg M-C differential**, every reading below (the command of `docs/_reports/2026-09-22-regmc-engine.md`):

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-98c69a4fee7f.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games 1200 --write --out <scratch> --dump-games 2000 --dump-out data/_scratch-eng-a99f-dump-<tag>.json
```

State bar = `state.games - state.games_board_never_diverged`. Materiality is decided by that instrument: a game is
board-material when a compared board leaf parts (`state.first_board_divergences`, all listed below the cap of 40); a
protocol line with no board leaf behind it is narration.

**The Reg M-B regression check**, every commit: `git diff --quiet HEAD` on `data/tags.json`, `data/protocol-events.json`,
`data/move-effects.js` (sha256 `c34d6465c3b6`, `4e2f810b338a`, `f35ecd91ba86`); `tests/test-engine-diff.js --n 6000 --seed
20260804` against the base engine bytes (`6cb275fb`, which is release `fa68d953e73f`'s simulator), with the control seed
`20260805` on the base bytes shown to differ (154 diff lines); the lattice `--steering empirical --arm middle --end-state
--census <HEAD's data/mechanics-census.json, a copy> --team-store <main>/data/team-pool-frozen --games 1200` on a Reg M-B
release cut from the commit's tree.

**Baseline**, release `fa68d953e73f` (0.32.0, this checkout's CRLF bytes; the earlier report's `7a7240f738d1` is the
same code): **18 of 954 board-material**, 1 void.

---

## 1. The species key and the U+2019 apostrophe (abra/regmc 0.33.0)

### The defect

`build/build_engine_data_regmc.js` keyed every row by the display name with each non-alphanumeric run collapsed to a
hyphen. The engine reads a key's segment before its first hyphen as the BASE species (`engine/medicham2-browser.js`,
`statMult.onlySpecies`: `String(body.name).split('-')[0]`, mirroring the authority's `baseSpecies.baseSpecies`). A scan
of every legal Reg M-C species (the builder now prints it on every run) found five base names with punctuation, all
keyed as if they had a forme:

| species (M-C dex name) | old key | new key |
|---|---|---|
| `Farfetch’d` (U+2019) | `farfetch-d` | `farfetchd` |
| `Sirfetch’d` (U+2019) | `sirfetch-d` | `sirfetchd` |
| `Mr. Mime` | `mr-mime` | `mrmime` |
| `Mr. Rime` | `mr-rime` | `mrrime` |
| `Kommo-o` | `kommo-o` | `kommoo` |

Reg M-B's table keys `mrrime` and `kommoo` unbroken. The artifact-audit question — does THIS artifact hold two keys that
normalise alike — answers 0 before and after (the builder's `TWO KEYS, ONE BODY` check). The regenerated table differs
from the old one by exactly those five renames: 0 content changes in `mons`, `moves`, `C` or `priors`.

Separately, the pinned games parted on their first `|switch|`: the authority writes `Sirfetch’d` with U+2019 (M-C
checkout `data/pokedex.ts` :16710, `name: "Sirfetch\u2019d"`; :2023 for `Farfetch\u2019d`), and `traceCanon` folded
only the ASCII `'`. So the protocol stream parted at line 3 of every game that brought one, and the game's first cause
was hidden behind a spelling. That is narration, and it is why these five read as a single family.

### Probe — `tests/probe_regmc_species_key.js --regulation regmc`

| clause | 0.32.0 (release `fa68d953e73f`, its engine bytes) | 0.33.0 (release `941e36906e6c`) | knob `MEDI_CANON_KEEPS_TYPO_APOSTROPHE=1` |
|---|---|---|---|
| every table key's base segment is its species' base id | RED (the five) | green | green (the knob is the engine half) |
| Farfetch'd + Mr. Mime lead: reduced `|switch|` lines agree, no protocol divergence | RED | green | RED |
| Kommo-o + Sirfetch'd lead: the same | RED | green | RED |
| Mr. Rime lead | green (the old key's hyphen folded) | green | green |
| boards identical at every boundary | green | green | green |
| exit | **1** | **0** | **1** |

11 staged sets, 0 illegal under the Reg M-C `TeamValidator`. The builder's own knob `ABRA_REGMC_KEY_WHOLE_NAME=1`
restores the old key rule.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.32.0 | `fa68d953e73f` | 18 / 954 | 1 |
| 0.33.0 | `941e36906e6c` | **18 / 954** | 1 |

The count did not move, and that was expected once the name was out of the way: the five games' board divergences were
real, only their causes were hidden. Unmasked, **four are a critical hit the authority rolls and this engine does not**
(a Farfetch'd Sky Attack, a Sirfetch'd First Impression, Close Combat and Meteor Assault; every one holds a Leek), and
one (`regmc-2680622216`) is a Scrappy `-fail` stat label, `atk` against `Attack`, which writes no board leaf: narration,
with the game's board part later (a Sitrus Berry on Pelipper, turn 1). That is §2.

### Reg M-B unmoved

Three Reg M-B files unchanged against HEAD. Damage differential seed `20260804`: identical to the base but for the
`wrote …` output-path line. Lattice: see the commit table in the last section.
