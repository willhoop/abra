# Two not-lose screens: the PORYGON2 v3 student at 14 s, and 8 opponent columns against 4 at 2 s

2026-10-01. SOLVER. Will approved the games ("play games, I'm not using my PC"). Release `df172ccd2aaf`. Pre-registered in
abra/regmc 1.67.0 (commit `de24ab8d`, pushed before the first screen game) and read once each in 1.68.0.

## Verdict

| screen | verdict | X score [Wilson 95%] | games | clock ratio x/y | fallbacks x / y | playouts per decision x / y (floor) |
|---|---|---|---:|---:|---:|---|
| 1. v3 student as gen5's leaf vs gen5's net, 14 s | **PASS** | **0.520 [0.451, 0.588]** (104–96) | 200 | 1.003 | 0 / 0 | 1,833.9 / 1,938.6 (636) |
| 2. 8 opponent columns vs 4, gen5, 2 s | **PASS** (upper bound only) | **0.460 [0.392, 0.529]** (92–108) | 200 | 1.024 | 0 / 0 | 403.9 / 382.4 (161) |

- **Every capability bar was met in both screens, so neither is VOID.**
- **Screen 1 capability:** the student served 2,571,854 leaf evaluations with 0 errors (`ctr.leaf_by_model`,
  `ctr.leaf_own`); gen5's net served 2,666,382 on the Y arm.
- **The student bought fewer playouts, not more.** At equal clock it played 0.95× gen5's playouts per decision. Its
  0.91× offline cost implied about 1.1×.
- **Screen 2 leans the wrong way.** It passes because the upper bound reaches 0.529. The point estimate is 0.460. X
  covered more of the opponent's play: 0.877 against 0.841 with targets, and 0.904 against 0.875 by move id. But it
  filled each cell with 12.8 playouts against 24.0.
- **Arena coverage is not ladder coverage.** In the arena the opponent is the same prior-driven search, so 4 columns
  already hold its joint 84% of the time. On the ladder, against humans, it was 57.7% (1.52.0). This screen cannot say
  what 8 columns do against humans.
- A PASS licenses an SPRT, and neither SPRT is pre-registered. Neither change goes on a ladder arm.

## 1. Pre-registration (committed before the first game)

`solver/results/2026-10-01-screens/preregistration.json`, applied once by `read.js`.

- Both screens: release `df172ccd2aaf`, `--info honest`, `--spreads role-v1`, team store
  `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`, 100 TEST pairs, `--pair-seed 1`, 200 games,
  `--cap 50`, 4 workers, `tools\lownode.cmd`. Rule: notlose, the Wilson 95% upper bound of X's score is at least 0.5.
- VOID bars, per arm: prior fallbacks at most 5% of non-forced decisions; playouts per searched decision at least the
  floor; clock ratio x/y at most 1.10; at least 190 games scored; and the screen's own capability clause.
- **Why `df172ccd2aaf`, not `eaa5becc54eb`:** it is the newest gate-passing release (OPEN 10/10, 1.57.0). Both arms of a
  screen play the same release in one run, so no figure is compared across releases.
- **Floors** from quiet references on this release, gen5 against itself, 20 games each:

  | clock | arm A | arm B | floor (half the lower) | fallbacks |
  |---|---:|---:|---:|---:|
  | 2 s | 364.2 | 323.2 | 161 | 0 |
  | 14 s | 1,293.8 | 1,272.2 | 636 | 0 |

  Two foreign node processes (2.2–2.8 GB, not this agent's) were seen just after the 14 s reference ended. That can only
  lower the references, and so the floors.
- **The reader was shown to VOID on a starved input:** the 1-pair smoke run (600 ms clock, about 200 playouts per decision)
  read VOID on the 636 floor, and the 20-game 2 s reference read VOID as a cols8 screen (4 columns only).

### The commands (as run, through `cmd.exe /c tools\lownode.cmd`, `ABRA_REGULATION=regmc`)

```
solver/machamp/gate.js --release df172ccd2aaf --x solver/porygon2/v3/screen-14s-student.json --y solver/results/2026-09-30-human-regularised/screen-14s-off.json --pairs 100 --pair-seed 1 --seed 31001 --workers 4 --cap 50 --rule notlose --info honest --spreads role-v1 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/screens/screen1-student-14s.json
solver/machamp/gate.js --release df172ccd2aaf --x solver/results/2026-10-01-screens/screen2-k2x8-2s.json --y solver/results/2026-09-30-human-regularised/screen-2s-off.json --pairs 100 --pair-seed 1 --seed 32001 --workers 4 --cap 50 --rule notlose --info honest --spreads role-v1 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/screens/screen2-k2x8-2s.json
```

## 2. Screen 1: the v3 student as gen5's leaf, 14 s

`solver/results/2026-10-01-screens/screen1-student-14s.read.json` (result `screen1-student-14s.result.json`).

- 15:06–17:10 UTC, 7,428 s. 200 games, 0 errors, 0 capped, 0 unbuildable.
- X `gen5-p2v3s-adaptive-14s` (leaf digest `1b4ae59fcff530a2`), Y `gen5-adaptive-14s` (leaf `cf8ad3f7bd0d4a33`). Both use
  MAG `65e76caf2423b28b` and DODUO `abb0b88dd573b728`. Pool digest `792daded918f…`, ids `d0197de47a82c273`.
- Score 104–96, 0.520 [0.451, 0.588]. Pairs: both 21, split 62, lost both 17.
- Decision ms, mean: X 8,601, Y 8,572 (ratio 1.003). p50 2,003 / 1,845, p99 27,715 / 27,717.
- Per arm: 1,587 decisions, 1 forced, 1,586 searched, 0 fallbacks of any kind. Cells 25,320 each (4 × 4).
- Columns held the opponent's joint with targets 0.835 (X) and 0.830 (Y).
- Leaf: `porygon2-v3-student.json` 2,571,854 evaluations, 0 errors, 0 fallbacks; `porygon2-gen5.json` 2,666,382.
- **The student arm played 1,833.9 playouts per decision against gen5's 1,938.6 (0.946×).** Offline the student cost
  0.91× gen5's net per evaluation (`docs/_reports/2026-10-01-porygon2-v3.md`). In the search the leaf is one part of a
  playout, and the student's encoder is v2's (`solver/porygon2/v2/features.js`), so the whole playout did not get
  cheaper. Not traced further.

## 3. Screen 2: 8 opponent columns against 4, 2 s

`solver/results/2026-10-01-screens/screen2-k2x8-2s.read.json` (result `screen2-k2x8-2s.result.json`).

- 17:10–17:35 UTC, 1,479 s. 200 games, 0 errors.
- Score 92–108, 0.460 [0.392, 0.529]. Pairs: both 15, split 62, lost both 23.
- Decision ms, mean: X 1,794, Y 1,751 (ratio 1.024).

| | X (k2 8) | Y (k2 4) |
|---|---:|---:|
| non-forced decisions | 1,607 | 1,612 |
| fallbacks (any kind) | 0 | 0 |
| playouts per searched decision | 403.9 | 382.4 |
| columns used, mean | 7.92 | 3.99 |
| column histogram | 8: 1,553; 7: 9; 6: 37; 5: 1; 4: 1; 3: 5; 1: 1 | 4: 1,600; 3: 6; 1: 6 |
| playouts per cell | 12.8 | 24.0 |
| coverage, move and target | **0.877** (1,410 / 1,607) | **0.841** (1,356 / 1,612) |
| coverage, move id only | 0.904 | 0.875 |

- Coverage is counted on every searched decision against the joint the opponent then played. A slot with no action
  matches anything. A switch matches on the body (`ident`) for "target" and on any switch for "move". The mega flag is
  not compared. The rule is in `solver/arena/col_coverage.js`.
- The opponent's own choice was forced on almost none of these decisions, so the non-forced coverage is the same to
  three places.

## 4. The machine

- Each screen ran 4 workers through `tools\lownode.cmd`. My pids: screen 1 launch 11392, workers 24400, 19396, 22628,
  1160; screen 2 launch 27924, workers 25836, 21768, 19088, 28044.
- From 15:37 to 17:35 a sampler logged every node and python process each minute (`solver/out/screens/machine-sampler.log`).
  Each worker gained about 60 s of CPU per minute. No other process gained CPU in that window.
- Before 15:37 a foreign 2.2 GB node process (pid 21768 at that time, not this agent's) ran for about 70 s of CPU in screen
  1's first half hour. The bars say it did not starve the run.

## 5. Code added for the screens (1.67.0)

- `solver/mew/play.js` `ARMS`: per-arm counters. `RUN` summed both agents of a shard.
- `solver/machamp/gate.js` sums `ARMS` into `arms`, with derived shares.
- `solver/arena/col_coverage.js`: the coverage rule.
- `solver/miltank/search.js`: the columns are returned as non-enumerable `info._cols`. `solver/mew/agent.js` keeps them
  across the adaptive clock's copy.
- `solver/tests/test-col-coverage.js`: GREEN 13/13, also after merging main. RED under `COLCOV_BREAK=notarget` (UNIT) and
  `MEW_BREAK=dropcols` (LIVE).
- `k2` already existed as a spec option, and every existing spec sets it to 4. So screen 2 is a spec, not a new flag.

## 6. Tests run on this branch

- `solver/tests/test-machamp.js --no-red`: GREEN 121/121 (before the merge).
- `solver/tests/test-col-coverage.js`: GREEN 13/13 before and after the merge, RED on both breaks.
- **`solver/tests/test-miltank.js --no-red`: RED on SWAP (3660/3734).** An identity body swap changes the digest on the
  live tree. A probe (`R.body(sheet row)` against the `T.buildTeam` body) shows why. The team body carries the sheet's
  nature and a Stat Point spread, for example Basculegion Adamant with HP 201 and Attack 180. The rollout's fresh body has
  no nature and the flat line: HP 195 and Attack 200. It also lacks `_hadItem`, `_ubVol` and `_boostSnap`. So the
  clause compares two builders that stopped agreeing when the team builder began dressing natures and spreads. It reads
  no file this change touches. **Not fixed here.** Whether `R.body` should dress the nature changes what an omniscient
  playout plays, which is outside these screens.
- `solver/tests/test-adaptive-clock.js`: CANNOT ANSWER in a worktree; it needs `eaa5becc54eb` with the pool locally.
- `solver/tests/test-porygon2-v3-student.js`: not run here; it needs that branch's `solver/out/p2v3/evalset`.

## 7. Housekeeping

- The student's files were taken from branch `worktree-agent-aadbc255e960b0c50`. They are byte-identical to main now
  that branch has merged.
- **One file overwritten in the shared scratchpad:** `launch.js` in the session scratchpad existed before this agent
  wrote it, and this agent overwrote it. It cannot be restored. Every other file this agent wrote is under
  `scratchpad/screens-a523/`.

## OWED, NOT RUN

1. **No SPRT for either change.** Screen 1 licenses the student's SPRT against gen5 at 14 s. The command is in
   `docs/_reports/2026-10-01-porygon2-v3.md` OWED item 1; re-pin it to `df172ccd2aaf`. Screen 2 licenses an 8-column
   SPRT, but its point estimate (0.460) leans the wrong way. Each needs its own pre-registration and Will's OK.
2. **Why the student played 0.95× gen5's playouts and not about 1.1×.** Profile one playout on each leaf: the encoder
   against the forward pass.
3. **8 columns against humans.** The arena cannot measure ladder coverage. A replay of the ladder logs with k2 8 can,
   with `solver/results/2026-10-01-search-blind-spots/doduo_probe.js` (top-8 holds 71.1% of human joints). Also owed:
   8 columns at the 14 s ladder clock, where a cell gets about 5× the playouts.
4. **`solver/tests/test-miltank.js` SWAP is RED** (section 6). This is SOLVER's own test. The decision is whether
   `rollout.body` should dress the sheet's nature and spread, or whether the clause should build both sides the same way.
5. `node engine/status.js --write` from the main checkout after merge. Not run here, because this is a worktree.
