# Two not-lose screens: the PORYGON2 v3 student at 14 s, and 8 opponent columns against 4 at 2 s

2026-10-01. SOLVER. Will approved the games ("play games, I'm not using my PC"). Release `df172ccd2aaf`.

## Verdict

PENDING: written at pre-registration (abra/regmc 1.67.0), before the first screen game. The results are added after both
screens read, in a later commit.

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

### Code added for the screens

- `solver/mew/play.js` `ARMS`: per-arm counters. `RUN` summed both agents of a shard.
- `solver/arena/col_coverage.js`: the coverage rule. `target` compares each slot's move id and target, or a switch to the
  same body. `move` compares move ids only. An empty slot matches anything.
- `solver/miltank/search.js`: the columns are returned as non-enumerable `info._cols`; `solver/mew/agent.js` keeps them
  across the adaptive clock's copy.
- `solver/tests/test-col-coverage.js`: GREEN 13/13; RED under `COLCOV_BREAK=notarget` (UNIT) and `MEW_BREAK=dropcols`
  (LIVE).
- `k2` already existed as a spec option, and every existing spec sets it to 4. So screen 2 is a spec, not a new flag.

### Tests run on this branch before the screens

- `solver/tests/test-machamp.js --no-red`: GREEN 121/121.
- `solver/tests/test-miltank.js --no-red`: **RED on SWAP** (3660/3734). An identity body swap changes the digest on the
  live tree. The clause reads `rollout.swapBody` and `API.digest` on the live engine, and no file this change touches.
  Not fixed here. See OWED.
- `solver/tests/test-adaptive-clock.js`: CANNOT ANSWER in a worktree (it needs `eaa5becc54eb` with the pool locally).
- `solver/tests/test-porygon2-v3-student.js`: not run here; it needs that branch's `solver/out/p2v3/evalset`.

## OWED, NOT RUN

- The screens themselves (this file is the pre-registration copy).
