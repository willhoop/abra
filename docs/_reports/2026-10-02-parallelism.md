# Parallelism: ROTOM's live search through the worker pool, the worker caps as a machine profile, and what this machine can actually deliver

SOLVER, 2026-10-02. Release `74972dd2db89` (the Reg M-C gate, OPEN 10 of 10, abra/regmc 1.77.4). Branch
`worktree-agent-a97f045dec8cd2192`.

## Verdict

**ADOPT `--search-workers 4` on the ladder: it is proven to run and not shown to lose; it is NOT shown to win.** Add it
to the `run_ladder.js` command (it is forwarded to the client) and run nothing else heavy beside it.

- **ROTOM's live decision now runs through MILTANK's worker pool** (`rotom.js --search-workers N`, forwarded by
  `run_ladder.js`). Every decision record carries `pool` (workers, passes and playouts per worker, idle workers, late
  workers), or `{ workers: 0, why }`. A dead or throwing pool is a counted fallback to the in-process search on what is
  left of the budget, and the pool is replaced off the clock. Pooled and in-process decisions are **bit-identical at a
  pass cap** (`solver/tests/test-search-pool.js`, red on two deliberate breaks).
- **Playouts per 14 s decision (ladbench, 8 paired positions, 14 s idle between decisions as on the ladder):
  in-process 9,142 → pool of 4: 26,395 (×2.89), min 23,487, no throttle in 8 decisions.** Pools of 8 and 14 reach
  ~30,000-43,000 on a cool CPU and then fall to ~3,200-4,800 when the CPU throttles (below).
- **THE MACHINE IS THE BOTTLENECK, NOT THE CODE.** Under sustained load on more than ~3 cores this laptop (Ryzen 7 7735HS,
  8 cores / 16 threads, on AC, "High performance" plan) drops to **12.5% of its nominal clock** for 30-90 s at a time:
  83 of 165 five-second samples during the throughput runs (50%). Total search throughput is therefore FLAT in the number
  of workers: at the 2 s arena clock, playouts per decision × workers = 3,178 / 3,026 / 3,246 / 2,913 at 3 / 6 / 10 / 14
  workers. More game workers buy games per hour (353 → 521 → 743 → 990) **only by cutting each decision's search**
  (1,048 → 507 → 324 → 208 playouts per decision).
- **Defaults chosen from that:** ladder `--search-workers 4` (average load ~2 cores at the ladder's duty cycle, under the
  sustained envelope); the timed SPRT / gate / self-play defaults STAY 3 / 4 / 4 on this machine. The caps are now a
  machine profile (`--machine dedicated|shared`, `solver/arena/cores.js`): `dedicated` allows up to 14 busy processes,
  `shared` keeps the old 3 / 4 / 4.
- **The pre-registered 2 s not-lose screen, pool 4 against in-process: PASS (not shown to lose), every capability bar
  green.** X 0.480 [0.412, 0.549], 200 games, 96-104; **942 against 320.6 playouts per searched decision (×2.94)**, clock
  ratio 0.986, 0 fallbacks, 1,694 of 1,694 searched decisions pooled, 0 idle workers. The point estimate is below 0.5:
  tripling the search at 2 s showed NO gain in this arena. It licenses the pooled path; it is not a strength claim.

## 1. What was wired

| File | Change |
|---|---|
| `solver/miltank/pool.js` | `fill(job, hooks)`: `hooks.onPass(vs)` sees the run of complete passes 0..k in pass order (the adaptive clock's stop through the pool; a true return resolves at once, counted `adaptResolves`); the result carries `byWorker` = passes and playouts per worker; `alive()` / `why()`. |
| `solver/miltank/pool_worker.js` | `job.world = { kind:'xatu', back, oppP, sheets }`: the worker plays XATU's honest sampler (`solver/xatu/worlds.js rollout`) with the spread prior rebuilt from the sheets. A worker exits when its parent disconnects. Break `MILTANK_POOL_BREAK=noworld`. |
| `solver/miltank/search.js` | `decideAsync` honours `onPass`, forwards `world`, takes `onJob` (a read-only tap), and puts `info.pool` on every pooled decision. |
| `solver/rotom/policy.js` | `gen5Move` with `d.pool`: the pooled decision (`gen5MovePooled`), the payoff table read from the search's own root record (a module tap left on across an await could catch another decision's solve), the counted fallback, `d.onPoolDead`. A pooled forced switch scores its candidates in the pool. `COUNTERS.pool`. Breaks `ROTOM_POOL_BREAK=nocount|throw`. |
| `solver/rotom/rotom.js` | `--search-workers N` (default 0 = in-process, as before); the pool is forked and WARMED with a pooled gen5 search (every worker must play) before connecting; `decide()` is async; a decision whose request was superseded or whose game ended during the fill is never sent (counted `pool.stale`) and the new request is decided afresh; `unhandledRejection` is caught and counted like `uncaughtException`; `pool` on every decision record and in the summary. |
| `solver/rotom/run_ladder.js` | forwards `--search-workers` (until now a client flag given to the supervisor silently never reached the client, as `--preview` once did). |
| `solver/mew/agent.js`, `solver/mew/play.js` | `spec.pool = N`: the arena agent fills its cells in a pool (honest information only), counted in `COUNTERS.pool[name]` and on every match line (`ctr.pool`). This is the screen's pooled arm. |
| `solver/arena/cores.js` (new) | the worker cap as a machine profile; `sprt.js`, `gate.js`, `mew/run.js` use it and record `machine` and `cores` in their artifacts. A pooled spec counts its pool processes per game worker. |
| `solver/bench/ladbench.js` (new) | playouts per live decision against pool size, paired positions, RSS, free memory, machine CPU; `--gap-ms` for the ladder's duty cycle. |
| `solver/bench/throughput.js` (new) | games per hour at N workers through the real drivers (`gate.js` match, `mew/run.js` self-play), sampling RSS, free memory and CPU. |
| `solver/tests/test-search-pool.js` (new) | IDENTITY, COUNTER, ADAPT, SWITCH, AGENT, FALLBACK; red under `MILTANK_POOL_BREAK=noworld` (IDENTITY) and `ROTOM_POOL_BREAK=nocount` (FALLBACK). |

## 2. Root-parallel playouts are the same estimator: CRN and seeds

- **One decision, one coin, same order in both paths.** `search.js begin()` draws `baseSeed = floor(coin()·1e9)` before
  any cell; the solve draws the mix-sample `u` after the fill. In-process and pooled consume the coin identically.
- **Pass p is a pure function of (job, p)** (`cells.js`): its world is drawn from the stream seeded `baseSeed + p·104729 + 1`,
  and every cell of the pass plays its dice from `baseSeed + p·104729`. That is the COMMON RANDOM NUMBERS design: within a
  pass every (row, column) cell sees the same world and the same dice, so a difference between two cells is the action.
  Nothing in a pass reads the clock except to stop, and nothing reads process state.
- **Workers stride, they never overlap.** Worker w plays passes w, w+N, w+2N, … (break `stride` proves a repeat is
  caught). The parent accumulates IN PASS ORDER, so the floating-point additions are the serial loop's own sequence; with
  a pass cap the matrix, value, pick and table are bit-identical (asserted: two ROTOM fixtures at 7 passes on 3 workers,
  and the arena agent at 5 passes on 2 workers).
- **The worker's world is the parent's world.** ROTOM's and the arena's gen5 sampler is XATU's (`XW.rollout(hb)`, the
  back pair from the posterior, every opponent spread from the spread belief). `hb.spreads` is `XW.spreadPrior(sheets)`
  and v1 feeds it no observations, so it is a pure function of the two sheets; the worker rebuilds it from the sheets and
  is handed `back` and `oppP` as plain data. IDENTITY goes red when the worker ignores `job.world`.
- **Under a clock** the pooled fill is the same estimator with more samples: the set of passes some worker started
  before the deadline, each an independent (world, dice) draw. What differs: up to N passes may be cut short at the
  deadline instead of one, so per-cell counts are less equal; each cut pass still walks its cells in the coprime-step,
  golden-ratio-start order, so a cut pass covers rows and columns evenly. The adaptive stop reads only complete passes
  0..k, in order, so its paired per-pass statistic is the serial one.

## 3. Why the caps were 3 and 4

`git log -S` finds the sprt.js check born in `02156176` (2026-09-25, "MACHAMP round 3 set-up … SPRT gate;
pre-registration r3"): no reason in the code or the message, but `solver/machamp/preregistration-r3.json` fixes "3
workers" as a parameter, and `mew/run.js` (`4ee7aa8d`) carries the stated one: **"at most 4 workers on this machine (other
agents share it)"**. Both reasons are real and are respected: the old values are the `shared` profile and stay the
defaults on this machine. The measurement below adds a third, harder reason the authors did not name: this machine
cannot sustain more than ~3 cores' worth of search.

## 4. Measurements (release `74972dd2db89`, BELOW_NORMAL, nothing else heavy running)

### 4a. Playouts per live decision — `solver/bench/ladbench.js`

ROTOM's gen5 decision (gen5 MAG/DODUO candidates, PORYGON2 leaf, k 4×4, depth 0, 1 reserved switch row, XATU's honest
sampler) at a FIXED 14 s budget (no adaptive stop: capacity, not policy). Positions: real Reg M-C human sheets
(`teams.js loadGames` n 40 seed 1), turns 1 and 3, the deciding side's honest view; the same positions and coins at every
pool size.

Back to back (100% duty; `solver/out/parallelism/ladbench-74972dd2db89-b14000.json`, 10 positions):

| pool | playouts / decision (mean) | p50 | min | late workers | RSS total MB | free MB (min) | machine CPU |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 (in-process) | 9,078 | 9,145 | 7,298 | – | 1,104 | 5,329 | 10% |
| 1 | 9,266 | 9,384 | 8,013 | 3 | 1,515 | 5,213 | 8% |
| 2 | 11,440 | 14,262 | 5,580 | 0 | 1,111 | 5,512 | 16% |
| 4 | 16,593 | 24,668 | 3,762 | 7 | 1,447 | 4,146 | 34% |
| 8 | 9,081 | 3,830 | 2,511 | 37 | 2,498 | 3,118 | 80% |
| 12 | 8,313 | 4,406 | 3,633 | 73 | 3,937 | 1,374 | 96% |
| 14 | 13,155 | 7,799 | 1,797 | 63 | 4,164 | 199 | 98% |

The per-decision columns are BIMODAL in time, not in position: a run of fast decisions (pool 4: 24,668-29,447; pool 8:
27,654-35,113) and a run of slow ones (~3,500-4,500 whatever the pool size). The worker CPU time per playout rose from
1.4 ms (pool 1) to 7.4-11.3 ms (pools 8-12): the workers were running, at a fraction of the clock.

**The throttle, measured directly** (`\Processor Information(_Total)\% Processor Performance`, 2 s samples, a pool of 8
back to back): 122% at the start (boost) sliding to 77% over ~50 s, then **12.5% flat for ~35 s**, then back to ~100%
when the load ended. During the throughput runs (5 s samples, 14 min): **83 of 165 samples at 12.5%, mean 44%**. The
machine is on AC, battery 95%, plan "High performance": this is the firmware's thermal or power protection, not a
software setting this repository controls.

With 14 s idle between decisions (the ladder's duty: the opponent thinks while we wait;
`…-b14000-gap14000.json`, 8 positions; in-process on the same 8 positions: 9,142):

| pool | playouts / decision (mean) | p50 | min | ×in-process | late | RSS MB | per decision |
|---:|---:|---:|---:|---:|---:|---:|---|
| 4 | **26,395** | 26,458 | 23,487 | **2.89** | 0 | 1,750 | 28,300 27,101 23,972 26,458 23,487 25,799 24,726 31,319 |
| 8 | 19,286 | 29,645 | 3,242 | 2.11 | 16 | 2,864 | 29,928 29,645 3,242 4,151 4,052 4,833 35,523 42,913 |
| 14 | 16,959 | 24,752 | 3,484 | 1.86 | 38 | 4,537 | 27,994 27,796 24,752 28,407 3,484 3,911 3,809 15,519 |

**Pool 4 never throttled; 8 and 14 did, at the same duty cycle.** A cool 14-worker pool is no faster than a cool 4- or
8-worker pool (~28,000 against ~26,000-30,000): the 8 physical cores and the package's power budget cap a burst before the
thread count matters. Every decision held its clock (13.70-13.72 s mean, one decision of 140 over budget + 500 ms, at
pool 14 back to back; 0 fallbacks anywhere). A pool worker's working set is 265-410 MB.

### 4b. Games per hour — `solver/bench/throughput.js`

Match mode through `gate.js` (the engine `sprt.js` and every screen use: `play.js --mode match`), gen5 against itself
at the adaptive 2 s clock (`solver/results/2026-10-01-screens/ref-2s-{a,b}.json`), honest, observed-v1, 2 pairs per
worker, seed 34001 (`solver/out/parallelism/throughput-match-74972dd2db89.json`):

| workers | games | wall s | games / h | playouts / searched decision (A / B) | Σ over workers | decision ms (x) | peak RSS MB | free MB (min) | fallback share |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 12 | 122 | 353 | 1,048.5 / 1,070.2 | 3,178 | 1,581 | 1,662 | 5,307 | 0 / 0 |
| 6 | 24 | 166 | 521 | 507.5 / 501.3 | 3,026 | 1,723 | 3,332 | 3,740 | 0 / 0 |
| 10 | 40 | 194 | 743 | 324.5 / 324.7 | 3,246 | 1,661 | 5,063 | 2,223 | 0 / 0 |
| 14 | 56 | 204 | 990 | 210.4 / 205.7 | 2,913 | 1,615 | 6,898 | 840 | 0.0022 / 0 |

At a fixed clock, games per hour scale with workers and the search per decision falls in proportion: **the search
throughput of the whole machine is ~3,000 playouts per 2 s whatever the worker count.** A timed SPRT at 14 workers would
measure a gen5 that searches a fifth as much as the one the ladder plays, and 14 workers left 840 MB free. Self-play
under pass caps (PCR) is bound by the same total, so more workers cannot buy more games per hour there either: NOT
MEASURED (the screen had the machine; see §6).

### 4c. Defaults chosen

- **Ladder: `--search-workers 4`.** ×2.89 playouts per decision at the ladder's duty cycle, no throttle, +650 MB.
- **SPRT / gate / self-play on this machine: unchanged, 3 / 4 / 4** (`cores.js` `DEDICATED_DEFAULT` = the shared values).
  More workers do not add search on this machine, they divide it. The cap is lifted (dedicated: 14) for a run that
  names `--workers` explicitly, and for a machine whose sustained throughput scales (a cloud host): re-run
  `throughput.js` there and change `DEDICATED_DEFAULT` from its numbers.
- **What would move the numbers is the cooling, not the code.** If Will can make the throttle go away (a cooling pad,
  cleaned vents, the vendor's performance fan mode), re-run the two benches: the code already scales to 14.

## 5. The screen (pre-registered, `solver/results/2026-10-02-pool-screen/preregistration.json`, committed `22af8ac2`
before its first game)

Release `74972dd2db89`; X `x-pool4-2s.json` (gen5 at the adaptive 2 s clock, `pool: 4`), Y `screen-2s-off.json` (the
same, in-process); 100 TEST pairs, pair-seed 1, seed 33001, 3 game shards, cap 50, honest, observed-v1, the frozen Reg M-C
team store; `--machine dedicated` (3 × 4 = 12 pool processes, inside the cap of 14). Read once by `read.js`:
`solver/results/2026-10-02-pool-screen/screen-pool4-2s.read.json` (the gate result beside it as `.result.json`).

| | X (pool 4) | Y (in-process) |
|---|---:|---:|
| score | **0.480 [0.412, 0.549]** (96 W, 104 L) | |
| playouts per searched decision | **942.0** | 320.6 |
| decision ms (mean / p50 / p99) | 1,714.5 / 1,369 / 3,780 | 1,738.6 / 1,668 / 3,774 |
| prior-fallback share | 0 | 0 |

Paired: X took both games of 11 pairs, split 74, lost both of 15. Bars: games 200 ≥ 190; fallback shares 0 ≤ 0.05;
playouts 942 and 320.6 ≥ 161; clock ratio 0.986 ≤ 1.10; pooled 1,694 of 1,694 searched decisions; idle-worker share 0;
each pool slot delivered ~400,000 playouts (402,080 / 399,838 / 397,497 / 396,319); agent fallbacks 0; Y never pooled.
**VERDICT: PASS** (the Wilson upper bound 0.549 ≥ 0.5). Wall 2,008 s.

Read plainly: at an equal 2 s clock the pooled arm searched ×2.94 as much and did not do better (0.480). This screen
says the pooled path is safe to play; it does NOT say that more playouts at this depth-0, k 4×4 search buy strength.
The ladder recommendation rests on the identity proof, the capability bars and this not-lose result, not on an expected
rating gain.

One detail the bars did not need: the FIRST pooled decision of each shard took ~14 s (14,025 / 14,121 / 14,031 ms) —
the arena agent forks its pool on first use, inside the clock. Every other X decision was ≤ 5.5 s. ROTOM forks and warms
its pool before it connects, so the ladder never pays this inside a decision.

## 6. Tests

All GREEN after the screen, on the live tree (`solver/out/parallelism/tests.log`):

| test | result |
|---|---|
| `solver/tests/test-search-pool.js` (new) | 30 / 30; RED under `MILTANK_POOL_BREAK=noworld` (IDENTITY) and `ROTOM_POOL_BREAK=nocount` (FALLBACK), as it must be |
| `solver/tests/test-rotom.js` | 105 / 105 |
| `solver/tests/test-rotom-ladder.js` | 161 / 161 |
| `solver/tests/test-miltank.js` | 3,992 / 3,992, its breaks red |
| `solver/tests/test-machamp.js` | green, every deliberate break red |
| `solver/tests/test-playout-speed.js` | 1,051 / 1,051 (POOL: 5 matrices and 5 decisions bit-identical on 3 workers), its four breaks red |

**End to end, a local dry run** (`run_ladder.js --dry-run`, release `74972dd2db89`, one series, both clients
miltank-gen5 at a 3 s cap, `--search-workers 2`; arms file `solver/out/parallelism/dryrun-gen5-pool.json`, LOCAL only):
both pools warmed in ~1.1 s before connecting; 28 + 28 move decisions and 8 + 6 forced-switch scorings pooled; every
decision row carries `pool` (e.g. `passes_by_worker [62, 61]`, `playouts_by_worker [983, 968]`, 0 idle); pool fallback
0, deaths 0, stale 0, crashes 0, timeouts 0, applied mismatches 0 of 190 checks; 0 non-loopback connections.

## OWED, NOT RUN

- **Self-play games per hour at 3 / 6 / 10 / 14 workers** (`throughput.js --kind selfplay`, the N7 league shape in
  `solver/out/parallelism/league-n7g1-shape.json`, the gen-1 PCR caps). Expected flat from §4b; not measured, the screen
  held the machine.
- **A long ladder-duty run of pool 4** (an hour of decisions at the ladder's real gaps, with the processor-performance
  counter) — 8 decisions is 4 minutes, and the throttle is a thermal state.
- **An equal-clock SPRT of pooled against in-process at the 14 s ladder clock.** The screen is a not-lose screen at 2 s,
  not a strength claim.
- **The processor-performance counter in every timed artifact.** A timed run on this machine can lose half its clock to
  the throttle with no counter saying so; the arena's capability bars catch it only through playouts per decision.
- **`DEDICATED_DEFAULT` re-measured on any other host** before any cloud spend (`solver/PLAN.md` §6a prices assume
  per-core scaling this laptop does not have).
