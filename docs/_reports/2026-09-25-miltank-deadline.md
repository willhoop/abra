# MILTANK's decision deadline is now hard (Reg M-C, release eaa5becc54eb)

2026-09-25. SOLVER. Code: `solver/miltank/{search,cells,pool,pool_worker,rollout}.js`, `solver/rotom/policy.js`.
Instruments: `solver/bench/deadline_bench.js`, `solver/bench/cpu_burner.js`, `solver/tests/test-miltank-deadline.js`.
Artifacts: `solver/results/2026-09-25-deadline/` (copied from `solver/out/deadline/`).

## Verdict

- **Fixed.** On 2,000 real Reg M-C positions per arm, under artificial CPU load, every MILTANK decision returned
  within budget + 500 ms: see the table in §3. Before the fix the same load produced decisions of 7.0 s at a 1 s
  budget and 11.6 s at a 5 s budget (the deliberate-break arms), and 17.2 s in the first reproduction.
- **Cause.** The pool path waited for EVERY worker (`Promise.all`), and a worker read its clock only after each
  playout. The workers run at BELOW_NORMAL priority. When normal-priority work holds their core, a worker gets
  almost no CPU, and one such worker held the whole decision. That is the 28 s and 39 s of the arena.
- **Second cause, serial path (ROTOM's path).** A major V8 garbage collection inside a decision stops the
  decider for 1.1 to 1.6 s on a loaded core. No clock check can interrupt it. The fix is a full GC between
  decisions, off the clock (`collectIdle`). ROTOM does not call it yet (owed, §6).
- **The price is fallbacks.** On a contended core the search often has too little time to fill its table. Then
  the move is the ranking prior's top joint (DODUO in ROTOM). The fallback is counted in every decision. At 1 s
  under this load it happened on 65% of pool decisions and 30% of serial decisions. At 5 s it happened on 26% and
  0.1%. **The strength effect of that fallback is not measured.**
- **One arm passed narrowly.** Serial at 5 s had a max of 5,426 ms against a bound of 5,500 ms, because one
  engine step cannot be cut short (§3).
- **The limit that stays.** Nothing in MILTANK can bound a decider process that the OS does not run. ROTOM's
  clients start through `tools\lownode.cmd`, which is BELOW_NORMAL. On the ladder the deciding process must not be
  starved by normal-priority work (§6).

## 1. Diagnosis

The candidates in the brief, each checked against a measurement:

| candidate | finding | evidence |
|---|---|---|
| one playout or batch that cannot be interrupted | **Yes, pool path.** The parent waited for every worker; a worker checked the clock only AFTER a playout, and started its first pass whatever the time. | old-code reproduction: 40 decisions at 1 s, one worker, load on its core: **max 17,236 ms**, 14 of 40 over the bound, and the whole overshoot sat in the fill phase (fill max 17,212 ms) |
| worker round-trips | **Yes, as the carrier.** Under load a worker picked up a job up to 8.5 s after that job's deadline. Its first slice ended 9.4 s past the deadline. | worker trace (temporary instrumentation, removed): `recv 3 lag_to_deadline -8488`, `slice 2 … cpu 1875 to_deadline -9441` |
| world building | **Once per worker, at start-up.** A worker's first world build loads the Reg M-C dex tables: 1,875 ms of main-thread CPU in its first slice. It is now paid at pool start-up (`warm()` at ping). The per-pass world draw is 0-5 ms. | worker trace; `max_world_ms` per decision in the serial artifacts |
| XATU / belief step | Not on the arena's path. In ROTOM it replaces `sampleWorld`, the same per-pass world step, which the deadline now covers. | code (`solver/rotom/policy.js` `xatuRollout`) |
| SLOWKING solve | **No.** Solve max 16 ms in the old-code reproduction. Under load it reached 237 ms in the serial lane, so it is now capped by the time left (`timeMs`). | `phases_ms.solve` |
| GC pauses | **Yes, serial path.** Of the 2 over-bound decisions in 1,000 serial decisions, the gc observer put a single major-GC pause of **1,624 ms** and **1,114 ms** inside the slowest playout. Single-threaded GC did not help (max pause 992 ms). A full GC between decisions did. | scratch diagnostic `diag_serial.js`; arms `serial-b1000-n400-{lazy,stgc,ctl15,idlegc}` |
| one huge `legalActions` expansion | **No.** The prepare phase (legal sets and prior scoring) has p99 76 ms in the pool lane and 512 ms in the serial lane. The serial lane's figure is its share of a loaded core, and it is inside the bound. | `phases_ms.prepare` |

The arena itself says the same thing. At 1 s with the lane alone (a1) the max was 1,035 ms. The tails appeared only
when the machine was loaded (a5, c1, c5). In a5, DODUO-greedy, which runs in the parent with no search, also took
5,158 ms once, so the parent itself was being starved too.

## 2. The fix

1. **An absolute deadline, reserved at the end.** The fill stops at `t0 + budget − reserve`. The reserve is 3% of
   the budget, clamped to 20-150 ms, and is kept for the solve and the pick. No pass STARTS after that time. This
   holds in the serial loop (`cells.fillSerial`) and in every worker, including the first pass.
2. **The parent does not wait for the pool.** Workers play a pass in 40 ms slices and send the pass after every
   slice. A timer resolves the fill at the deadline (+10 ms grace) with what has arrived. Workers still out get a
   cancel and are counted (`lateWorkers`, `deadlineResolves`, `lateMessages`). The first streaming version sent a
   pass only at its end, so a pass that ran over the deadline was lost whole. Slicing fixed that.
3. **An in-flight playout is abandoned** halfway through the reserve. The clock is read between the playout's
   random turns and before the leaf. Past it the playout returns NaN and the cell stays unplayed
   (`rollout.COUNTERS.aborted`: 952 in the 1 s serial arm). One engine step still cannot be interrupted.
4. **The solve is capped** by what is left of the budget (SLOWKING's existing `timeMs`).
5. **Fallback when the table is too empty.** The fallback fires when a candidate row has no playout at all, or when
   fewer than `minFill` = 25% of the cells are filled. The move is then the ranking prior's top legal joint.
   MILTANK already scored every legal joint with that prior, so the fallback costs nothing. In ROTOM that prior is
   DODUO. The fallback is counted (`fallbackEmpty`, `fallbackSparse`) and named in `info.fallback`. **The 25% is a
   policy choice. Its strength was not measured.**
6. **A pass walks its cells diagonally** (step K = the smallest integer ≥ n+1 that is coprime to m·n). A pass cut
   short therefore touches nearly every row. The row-major walk filled the top rows and left the bottom rows EMPTY,
   and those rows would now force a fallback. A full pass is the same set of playouts. The values do not move:
   `test-playout-speed` IDENT, POOL and COVER stay green.
7. **`collectIdle()`** (search.js) runs a full GC off the clock. It exposes `gc` at run time, so no launch flag is
   needed. The serial arms call it between decisions, as ROTOM should between requests.
8. **ROTOM's forced-switch search** gave each candidate at least 150 ms, so J candidates could spend J×150 ms
   against a smaller budget. Each candidate now gets an equal share, and the search is skipped when a share is
   under 150 ms.

Deliberate break: `MILTANK_DEADLINE_BREAK=1` puts back the parent waiting for every worker, the first pass always
starting, and no reserve, abort or fallback.

## 3. The measurement

`solver/bench/deadline_bench.js`, frozen release `eaa5becc54eb`, through `tools\lownode.cmd`. Positions: the humans'
own Reg M-C open sheets, brings and leads (`solver/out/human/games.jsonl`, the arena's seeded loader, `--seed 1`),
played forward by the human prior's argmax. There are 2,000 positions from 291 team pairs, `pos_sha`
`33d88ad3c8ecb507`, identical for all four full arms. `k1 = k2 = 8`, depth 2, heuristic leaf, deciding side
alternating.

**Load.** Each lane is confined to ONE logical core (lane A core 15, lane B core 14). A burner process runs on that
core in episodes: starve (NORMAL priority, 35%), fair (BELOW_NORMAL, the workers' own class, 45%) and idle (20%).
The episode log is in each artifact. The pool lane's decider floats to all cores, as ROTOM's process would. The
serial lane's decider IS the compute, so it stays pinned beside the burner. This bench added two cores of load to
the machine. Every flag, the code digests and HEAD are in each artifact.

| arm | budget | n | p50 | p99 | max | over budget+500 | fallbacks | median playouts | artifact |
|---|---|---|---|---|---|---|---|---|---|
| **pool (arena path), fixed** | 1 s | 2000 | 985 | 997 | **1,004** | **0** | 1,296 (65%) | 5 | `pool-b1000-n2000-final.json` |
| **pool, fixed** | 5 s | 2000 | 4,867 | 4,879 | **4,906** | **0** | 516 (26%) | 50 | `pool-b5000-n2000-final.json` |
| **serial (ROTOM path) + collectIdle, fixed** | 1 s | 2000 | 986 | 1,151 | **1,268** | **0** | 594 (30%) | 42 | `serial-b1000-n2000-final.json` |
| **serial + collectIdle, fixed** | 5 s | 2000 | 4,869 | 5,127 | **5,426** | **0** | 2 (0.1%) | 185 | `serial-b5000-n2000-final.json` |
| pool, **BREAK** | 1 s | 300 | 1,071 | 5,676 | **7,035** | **73** | 0 | 16 | `pool-b1000-n300-final-BREAK.json` |
| pool, **BREAK** | 5 s | 100 | 5,132 | 11,569 | **11,569** | **31** | 0 | 52 | `pool-b5000-n100-final-BREAK.json` |

The same code was used in every row (digests in `code`; `search.js` `e69b18ed8393`, `pool.js` `d81c87056c22`,
`cells.js` `5fdb93e4e7ea`). The break arms differ only by `MILTANK_DEADLINE_BREAK=1`, and they ran FIRST.

**The serial 5 s arm passed with a 74 ms margin.** Its max decision was 5,426 ms against a 5,500 ms bound. That
decision overran its fill deadline by 576 ms because of one playout of 663 ms. The fill checks the clock between
engine steps, so a single step, or a GC inside one, cannot be cut short. The arm is GREEN, but it is not
comfortable. Its `collectIdle` cost p50 1,028 ms and max 2,734 ms between decisions, and 241 playouts were
abandoned at the abort line. At 5 s the pool arm's phases were prepare max 107 ms, fill max 4,876 ms and solve max
43 ms.

Phases, 1 s arms (ms, p99 / max). Pool: prepare 76/86, fill 989/998, solve 2/7. Serial: prepare 512/723,
fill 1,047/1,191, solve 88/237. The serial decider's `collectIdle` took p50 633 ms, p99 2,415 ms and max
2,934 ms on the loaded core, between decisions and off the clock. The pool decider's largest GC pause was 33 ms.

**An instrument defect, found in these artifacts.** The bench attributes GC pauses to decisions by time. It does
this with `performance.timeOrigin + startTime` against `Date.now()`, and those two clocks drift apart over an
hour. So in the long arms, `gc_ms` and `gc_max` per decision are NOT reliable. For example, decision 215 of the
serial 1 s arm shows a 990 ms "in-decision" pause, but its slowest playout took 136 ms and its whole fill 994 ms.
That pause is its own 982 ms idle GC, placed at the wrong time. The latency figures do not depend on this.
The GC evidence in the next subsection comes from the scratch diagnostic. That diagnostic ran for 17 minutes, and
it measured each pause inside the worst playout's own wall window, which stays consistent (wall 1,830 ms, GC
1,624 ms, CPU 376 ms). The committed bench reads both sides from `performance.now()` (§6).

### The serial path before `collectIdle` (why it is there)

| arm (serial, 1 s, same load) | n | max | over | decider GC max pause |
|---|---|---|---|---|
| all 2,000 positions held in memory (first bench version) | 2000 | 2,351 | 2 | not observed (the loop never yielded) |
| positions streamed per game | 400 | 1,557 | 3 | 1,080 ms |
| same, core 15 (control) | 400 | 2,469 | 2 | 1,290 ms |
| same, `--single-threaded-gc` | 400 | 1,995 | 1 | 992 ms |
| **same, `collectIdle` between decisions** | 400 | **1,274** | **0** | (the idle GCs) |
| **same, `collectIdle`, 5 s** | 100 | **5,198** | **0** | (the idle GCs) |

The scratch diagnostic with a gc observer (1,000 decisions) put a single major GC of 1,624 ms and one of 1,114 ms
inside the two over-bound decisions. Scavenges reached 327 ms. The idle GC itself costs p50 289 ms at 1 s and
788 ms at 5 s on the loaded core, with a max of about 2.5 s. **That cost lands between decisions.** In ROTOM that
time is on the server's clock if the next request is already waiting (§6).

## 4. The test

`solver/tests/test-miltank-deadline.js` is the small, repeatable form (about 6 minutes, one core). It runs the bench
at a 500 ms budget under the same burner (starve 50%, idle 20%) and reads the artifacts back.
- **BOUND.** Pool lane and serial lane (+ collectIdle): max ≤ 1,000 ms, no errors.
- **COUNTED.** Fallbacks in `info` equal MILTANK's counters. The pool's deadline timer fired, and at least one
  fallback happened under load, so the machinery was exercised, not idle.
- **SEARCH.** With no load, at 1.5 s, both lanes solve at least 80% of decisions from the table, with a median of
  at least 16 playouts. This clause guards against a deadline that "passes" by never searching.
- **RED first.** Before the test was trusted, `MILTANK_DEADLINE_BREAK=1` was run on BOUND: pool max 5,481 ms, 7 of
  20 over, RED. The test re-runs that break itself on every run and requires RED.

Run before the full measurement: `16/16 checks`. BOUND pool max 504 ms, BOUND serial max 760 ms, SEARCH pool 100%
solved (median 231 playouts), SEARCH serial 100% solved (median 201 playouts), and the break RED (pool max
5,481 ms). Final run, on the committed code: `16/16 checks`. BOUND pool max 506 ms, BOUND serial max 675 ms,
SEARCH pool 100% (median 271), SEARCH serial 100% (median 204), and `RED MILTANK_DEADLINE_BREAK=1 -> BOUND: fails
as required` (pool max 5,508 ms, 9 of 20 over).

Other tests after the change: `test-playout-speed` 1184/1184 and all four of its breaks RED, `test-miltank`
3414/3414 and five breaks RED, `test-arena-release` 17/17 (ARENA_TEST_RELEASE=eaa5becc54eb) with its break RED,
`test-rotom` 86/86, `test-arena` 15/15 with its break RED, and `test-porygon2` 423/423. `test-lean-mode` was not run: it needs `--release` and plays a 1,200-game lattice. Its subject, the engine's lean boards, is untouched here, and `test-playout-speed` IDENT pins every playout value against the pre-change playout.

## 5. What this does and does not say

- It says the deadline holds on this machine, under this load, for these positions. It holds at 1 s and 5 s, for
  both paths, with the margin in the table.
- It does NOT say MILTANK plays better or worse. The fallback share is large under load. The diagonal walk and the
  25% fill rule change which cells a clock-cut table holds. **Neither was re-measured for strength.** The 1.4.0
  arena figures were played on the old code. They stand as figures about that code and are not superseded. They
  are also not a measurement of this code.
- The load is harsher than the arena's in one way: a single worker is pinned to one core beside a normal-priority
  burner. That is why the pool lane falls back 65% of the time at 1 s. Four workers on 16 cores see less of it.

## 6. Owed

1. **ROTOM should call `MT.collectIdle()` after it sends a MILTANK choice.** It must also subtract the time since
   the request ARRIVED from its budget, or a GC that is still running when the next request lands is unseen clock
   spend. ROTOM does not do either yet. DODUO-greedy is the ladder bot today, so no live path is exposed.
2. **Decider priority on the ladder.** ROTOM's clients run BELOW_NORMAL (`run_ladder.js` → `lownode.cmd`). A
   normal-priority CPU hog on the machine would starve the decider, and nothing in MILTANK can bound that. A
   search-based ladder run needs the client at NORMAL, with only the pool workers BELOW_NORMAL.
3. **Strength of the fallback rule** (`minFill`, the empty-row rule) against the old impute-the-mean behaviour, in
   the arena at the ladder budget. This needs an SPRT at equal wall-clock.
4. **The arena at 5 s should be re-run** on this code. Its 28-39 s decisions are the defect fixed here, so those
   games played some turns at 6-8× the stated budget.
5. **Done after the artifacts: the bench's GC clock.** `deadline_bench.js` now puts both the GC entry and the
   decision window on `performance.now()`. The artifacts above carry the earlier bench digest `6ab7f150b4ad`, and
   the fix changes only their `gc_ms` and `gc_max` fields. A 100-decision re-check on the fixed bench (serial, 1 s,
   same load, collectIdle) put the largest GC pause INSIDE a decision at 44 ms, with max latency 1,145 ms. The
   1,945 ms pause in that run was the idle GC. The test was re-run on the fixed bench: 16/16, RED under the break
   (pool max 5,508 ms).
6. **The serial margin at 5 s is 74 ms** (§3). A decision that has to hold on a loaded core would be safer with a
   reserve that scales with the measured cost of one playout, rather than a flat 3% of the budget.
