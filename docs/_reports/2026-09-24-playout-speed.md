# MILTANK playout speed: where the time goes, the pool, and the PRE-GATE re-run

**Date:** 2026-09-24. **Branch:** `playout-speed` (from `worktree-agent-a849abbf8c6348200`). **Status: PRE-GATE.**
MEDICHAM's Reg M-C gate is not open. The arena numbers are a harness shakedown, not a result about any bot.

## Verdict

- **The engine turn is the cost, not the solver.** About 80% of a playout is `battleTurn`. The solver's own
  overhead was about 8%: the per-playout `structuredClone` (6.8%) and the `API.makeRng` wrapper (1.4%).
  Prior inference and `legalActions` cost about 15 ms per decision, which is 1.5% of a 1 s budget. No trace
  sink was on. Nothing was set up again per call.
- **The "23 playouts per decision" was mostly machine load.** The old code, with the same flags on a quieter
  machine, gave a median of 87 per decision (4 games). All day the machine was 90–100% busy with other
  sessions' jobs (5 XATU `eval_spreads.js` workers, and one python process on about 5 cores).
- **Solver fixes landed, and the values are bit-identical.** Prepared worlds halve the copy (0.25 ms against
  0.51 ms). Unwrapped dice are 0.013 ms against 0.128 ms. That is about 4% of a playout. It is too small to
  resolve under this load (see A/B below), so I do not claim a single-process speedup.
- **Worker pool landed, and it is exact.** At a pass cap, the pooled matrix equals the serial one bit for bit.
  At a fixed clock it fills more passes. The pool also exposed a real defect: cut-short passes all started at
  cell (0,0), so four workers filled the same rows. The unfilled share was **34.8%**. Golden-ratio start
  offsets brought it to **6.3%**.
- **PRE-GATE arena, MILTANK against prior-greedy, 200 games.** At 1 s with 4 workers it scored 0.565
  (0.496–0.632), with a median of 72 playouts per decision against 23 before and 6.3% of cells unfilled. The
  1 s in-process control scored 0.590 (0.521–0.656), with a median of 50 and 5.9% unfilled. At **5 s with
  4 workers it scored 0.640 (0.571–0.703)**, with a median of 623 and 0.12% unfilled. It is a shakedown under
  a non-certified engine, not a strength claim.

## 1. Where the time goes (profile)

`node --cpu-prof solver/bench/playout_bench.js --games 3`: the MILTANK cell loop (sample a world, then
depth-1 playouts on a 6×6 matrix) run on fixed positions. The shares are of the whole run, and the loop is
92% of it.

| Inclusive | What |
|---|---|
| 83.3% | `API.stepInPlace` |
| 76.0% | `battleTurn` (the engine) |
| 13.0% | `engine/tags.js` `param` (inside the turn). `norm()` runs `toLowerCase().replace(/[^a-z0-9]/g,'')` on **every** tag lookup |
| 7.1% | `toActs` → `playerAction` (building the engine's action map) |
| 6.8% | `API.clone` (structuredClone of the world, once per playout) |
| 2.1% | playout policy (`randomJoint` / `slotSupport`) |
| ~1.4% | `API.makeRng` (closures plus draw counters, built per playout) |

Each candidate from the brief, checked:

| Candidate | Finding |
|---|---|
| structuredClone per playout | 6.8%. Fixed: serialise the world once per pass, and deserialise per playout. |
| playout-policy prior inference | Not in the playout. The policy is uniform over `slotSupport`, which is 2%. The prior runs twice per decision (4.6 ms). |
| legalActions per step | Not in the playout. It runs twice per decision (9.7 ms). |
| rebuilding bodies | Bodies are cached per sheet row. The key is now the row's content, so pool workers (who get fresh copies) hit the cache. |
| trace sinks left on | None. `API.clone` drops `_trace`, and the arena sets none. |
| per-call setup | None per decision. Pool workers load once and are pinged before the first clock starts. |

The world is small: about 10 KB serialised. The copy is not the problem. The turn is.

## 2. What changed (solver/ only; the engine and `medicham_api.js` are untouched)

| File | Change |
|---|---|
| `solver/miltank/cells.js` (new) | One pass of the cell fill. The serial search and every worker run this code. Pass p is a pure function of (job, p). |
| `solver/miltank/rollout.js` | `prepare(W)` does one `v8.serialize`, and `copy()` deserialises. `dice()` uses `M.rngStreams({seed})` directly. The body cache is keyed by content. New breaks: `prepare`, `rng`. |
| `solver/miltank/search.js` | `decide` is split into prepare, fill and finish. `decideAsync(…, {pool})` fills through the pool. Coins are drawn in the same order. |
| `solver/miltank/pool.js`, `pool_worker.js` (new) | N forked workers, with `serialization:'advanced'` so S's cycles survive. Worker w plays passes w, w+N, and so on. The parent adds the passes **in pass order**, so float sums match the serial loop exactly. Workers set BELOW_NORMAL. Break: `stride`. |
| `solver/arena/*` | `--workers N`. `run` is async. The worker counters are in the artifact. |
| `solver/bench/*` (new) | `playout_bench.js` (fixed positions and seeds; value sha; wall, process and main-thread CPU), `ab_compare.js` (interleaved before/after through lownode), `pool_scaling.js`, `arena_summary.js`. |

**The coverage fix (commit `d441b52a`).** Pass p starts at cell ⌊frac(p·φ)·mn⌋ and wraps. Pass 0 is unchanged. A
cell's value does not depend on the order in which it is played, so full passes are identical. Only the cells
that a cut-short pass reaches move.

## 3. Identity — proven, not assumed

`solver/tests/test-playout-speed.js`: 1,184/1,184 checks on 17 positions from 3 real Reg M-C team pairs.

| Clause | Checks | Break that must turn it red | Shown red |
|---|---|---|---|
| CLONE | The digest of a prepared copy equals the digest of `API.clone` on 34 worlds | `MILTANK_BREAK=prepare` | yes |
| IDENT | 1,088 playouts (depth 1 and 2) equal the pre-change playout, which is reproduced verbatim from `562dc055` | `MILTANK_BREAK=rng` | yes |
| COVER | 8 cut-short passes reach 8 distinct cells, and each value equals the full-pass value | `MILTANK_POOL_BREAK=rotate` | yes |
| POOL | 3 workers with a cap of 5 passes equal the serial matrix bit for bit on 5 matrices, and `decideAsync` equals `decide` on 6 decisions | `MILTANK_POOL_BREAK=stride` | yes |

Still green after the change: `test-miltank` 3,414/3,414 (5 breaks red), `test-arena` 15/15 (1 break red).

Bench identity: `values_sha 951ecf8d01c9ff85` and `decide_sha ed053d3c43cc77b7` are the same for the old and
new code (games 6, passes 3, k 6, depth 1). All 8 interleaved A/B runs gave `5b36fb531d25f87f` /
`c08e37c8609bd6da`. All 10 scaling runs, from serial to 8 workers, gave `4213f8094c42c5a1`.

## 4. Speed measurements — and why most of them cannot be read

**A/B, before (`562dc055`) against after, interleaved, each run through `cmd.exe /c tools\lownode.cmd`.**
Settings: games 3, passes 4, 2,448 playouts per run. Artifact: `solver/out/bench/ab.json`.

| rep | before: wall /s · main-thread CPU /s | after: wall /s · CPU /s |
|---|---|---|
| 0 | 70.8 · 80.1 | 159.9 · 163.5 |
| 1 | 45.1 · 51.2 | 137.7 · 140.9 |
| 2 | 129.1 · 131.8 | 69.8 · 76.9 |
| 3 | 39.7 · 56.3 | 15.1 · 30.5 |

The paired CPU ratios were 2.04, 2.75, 0.58 and 0.54. **That is noise, not signal.** Even main-thread CPU time
moved 5× between identical runs on a machine that was 100% busy. Hyperthread siblings and frequency both
move CPU time. The micro-measured saving (about 0.37 ms of about 9 ms) is the honest figure: **about 4%, not
resolved by the A/B.**

**Pool scaling at 1/2/4/8 workers, through lownode.** Settings: games 3, passes 8, 4,896 playouts. Two reps,
the second in reverse order. Artifact: `solver/out/bench/scaling.json`.

| workers | rep 0 wall /s | rep 1 wall /s | playouts per worker-CPU-s (rep 0 / rep 1) | machine busy |
|---|---|---|---|---|
| 0 (in-process) | 44.4 | 27.9 | 65.5 / 49.8 | 100% |
| 1 | 82.3 | 43.8 | 106.4 / 88.0 | 100% |
| 2 | 27.4 | 145.8 | 38.2 / 100.4 | 100% |
| 4 | **218.2** | 32.0 | 103.3 / 33.8 | 100% |
| 8 | 33.3 | **216.4** | 25.0 / 89.3 | 100% |

The same configuration swung 5–7× between reps. The machine was 99.5–100% busy for every row, because other
sessions' jobs were running at the same BELOWNORMAL priority. So **wall-clock scaling was not measurable
today.** What can be read:
- A playout costs about **10 ms of CPU** (about 90–106 playouts per worker-CPU-second in every run that was
  not starved), and that cost does not grow with the number of workers. There is no IPC or serialisation
  tax that shows.
- The best wall figures were 218 and 216 per second at 4 and 8 workers, against a best of 125 per second
  serial earlier in the day. Wall throughput is whatever share of cores the OS grants.
- Pool start-up (fork plus engine load) took 0.5–15 s, depending on load. It is paid once per run.

The old figure of 150–190 playouts per second in `data/medicham-speed.json` (2026-08-28) was 0.6–1.8 ms per
turn with the old `runPlayout`. Today a turn costs about 4–5 ms. **The engine turn has become about 3× more
expensive since then.** That is ENGINE's territory, and it is the real lever.

## 5. PRE-GATE arena — MILTANK against prior-greedy, 200 games

The flags are part of the sample: `--games 200 --k1 6 --k2 6 --depth 1 --cap 60 --seed 1`, reserve_switch 2,
paired seating (100 team pairs), and the same seeded stride of real Reg M-C sheets as the 2026-09-24 shakedown.
The live tree, not a frozen release (acceptable only because nothing here is a result). All runs went through
lownode on a machine at about 100% load.

| Run | Score (Wilson 95%) | W–L | pairs both/split/lost | playouts/decision p50 · mean · p95 | unfilled | decision ms p50 · p95 · max | over budget |
|---|---|---|---|---|---|---|---|
| Before (`562dc055`, 1 s, in-process; from the earlier report) | 0.530 (0.461–0.598) | 106–94 | 28/50/22 | 23 · ≈55 · ≈170 | 28–29% | – · 1,062 · 1,874 | 1 |
| 1 s, 4 workers, **no rotation** (`ab8e010d`) | 0.540 (0.471–0.608) | 108–92 | 27/54/19 | 68 · 179 · 625 | **34.8%** | 1,081 · 1,789 · 23,374 | 134 |
| **1 s, 4 workers** (`d441b52a`) | **0.565 (0.496–0.632)** | 113–87 | 30/53/17 | **72 · 206 · 833** | **6.3%** | 1,071 · 1,478 · 7,483 | 60 |
| **5 s, 4 workers** (`d441b52a`) | **0.640 (0.571–0.703)** | 128–72 | 39/50/11 | 623 · 1,927 · 7,222 | 0.12% | 5,034 · 5,146 · 12,280 | 4 |
| 1 s, in-process control (`d441b52a`) | 0.590 (0.521–0.656) | 118–82 | 32/54/14 | 50 · 160 · 588 | 5.9% | 1,007 · 1,031 · 3,683 | 4 |

All runs: 0 errors, 0 capped, SLOWKING gap ≤ 2.2e-4, no zero-counter warnings.

**Reading.** Most of the coverage gain at 1 s comes from the ROTATION, not the pool. The in-process control on the
same code fills 94.1% of cells at a median of 50 playouts. The 4-worker pool fills 93.7% at a median of 72. So
on this saturated machine, 4 workers bought about 1.4× the playouts and roughly 15× the over-budget
decisions. At 5 s the matrix is effectively full (0.12% unfilled, median 623 playouts, 20 passes), and the
score is **0.640 (0.571–0.703)**, the first interval in this series that excludes 0.5. **It is still PRE-GATE**:
the engine is not certified, the leaf is the crude HP heuristic, the opponent is a greedy prior, spreads are
flat, and the run used the live tree. So it says that more search beats no search in THIS simulator. It says
nothing about Showdown. All three 1 s intervals overlap one another and contain or touch 0.5. The decisions ran over
budget more often (60 of 1,507 over 1.5× + 50 ms, against 1). The parent waits for the slowest worker to
finish its current playout, and at BELOWNORMAL on a saturated machine a worker can be descheduled for seconds.
Artifacts: `solver/out/arena/miltank-vs-prior-g200-s1-b*-w*.json` (gitignored).

## 6. Owed / proposed

- **ENGINE (proposal, not done: engine files are out of scope here).** `engine/tags.js` `norm()` runs a regex on
  every `param`/`has` lookup. That is about 13% of a playout, inclusive. Memoising `norm(id)` in a `Map` keeps
  every counter and every answer the same. Separately, per-turn upkeep is large, and the inclusive shares overlap:
  `_updateEvent` 13.7%, `volSeqSyncAll` 7.7%, `residualOrder` 6.9% and `residualShadowVolPresent` 4.7%. The turn is about 3× dearer than on 2026-08-28.
- **`engine/medicham_api.js` (proposal).** A `prepare(S)` / `copyOf(prepared)` pair would give every caller the
  cheap copy that `rollout.js` now makes privately. This is optional, and nothing needs it yet.
- **Re-measure the scaling on a quiet machine.** The pool is exact. Only its speed curve is unmeasured.
  `node solver/bench/pool_scaling.js --reps 3` is the command.
- **Over-budget tail under the pool.** A worker could check the clock inside a long playout, or the parent could
  stop waiting at the deadline and drop late passes. The second option costs exact reproducibility only under
  a clock.
