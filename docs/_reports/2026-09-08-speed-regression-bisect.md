# Where the 8.8x went — a bisection of MEDICHAM's throughput across 599 frozen releases

**MEASURE, 2026-09-08.** Will's call: *find out where the 8.8x went.* Written incrementally as the
runs completed, so the order below is the order the evidence arrived.

This is a THROUGHPUT report. It makes **no claim about correctness**, and nothing in it should be
read as an argument for or against any engine fix. It also **optimises nothing** — naming a cost is
not a licence to remove it.

---

## 0. THE FIRST THING FOUND, BEFORE ANY BENCHMARK RAN

**The 8.8x is a ratio between two numbers that were never measured the same way, and one of the two
has a same-day sibling that disagrees with it by 4x.**

`docs/_reports/2026-09-08-engine-speed-comparison.md` states the series as
13,041 -> ~1,800 -> 1,482 turns/sec. Reading the commits that produced the first figure:

| commit | when | MEDICHAM figure | battles/sec | **turns per battle** | how it was driven |
|---|---|---|---|---|---|
| `e29a26d9` | 2026-08-06 15:42 | **3,212 turns/sec** | 1,606 | **2.0** | release `4c73f9cafa4b`, "loops to completion" |
| `2fb0928a` | 2026-08-06 20:46 | **13,041 turns/sec** | 217 | **60.1** | four teams, 8-second runs, 60-turn cap |
| this run | 2026-09-08 | ~1,100-2,200 turns/sec | ~110-220 | **10.1-11.6** | 8,778-team pinned pool, cap 60, plays to a result in 100% of games |

Both August figures are from the **same day and the same engine**, and they differ by **4.06x**.
Neither has an artifact on disk — `git show --stat` on both commits shows no script was committed
(`e29a26d9` touches one line of `docs/ROADMAP.md`; `2fb0928a` touches documents only).

The turns-per-battle column is the tell. **60.1 means every battle ran to the cap** — the 2026-08-06
engine did not finish games, so the 13,041 figure is a rate over turns of an unfinished battle, most
of them late-game turns on an engine that had not yet learned to end one. **2.0 means battles were
ending on turn 2**, which is the opposite failure. Today's engine plays 10-11 turns and reaches a
result in **100%** of games. Those three populations of "a turn" are not the same amount of work,
and a ratio across them is not a slowdown measurement.

**So `8.8x` is not a measured quantity, and this report does not attempt to defend or reproduce it.**
What follows measures the thing that *can* be measured: the same benchmark, the same pool, the same
policy, run against every frozen engine snapshot that will still open.

---

## 1. METHOD

### The harness is reused unmodified

`data/verification/speed-2026-09-08/bench_two_engines.js` — **byte-identical to the run that produced
the 1,482 figure**, not a copy and not a variant. One process per release, invoked through
`tools\lownode.cmd` (BelowNormal). What it measures and what it excludes is its own header's claim
and is unchanged: the MEDICHAM figure is `runPlayout` only; `freshBodies` + `battleInit` are the
separate *construct* leg; process start, dex load, pool load, `buildPair`, `Teams.pack` and **any
protocol comparison** are outside every per-game figure.

The only new file is `collate.js` in this run's directory, which reads the artifacts and prints the
curve. It computes nothing the harness did not measure.

### The sample definition (every flag is part of it, not a budget)

```
--team-store data\team-pool-frozen   --pairs 20   --per-pair 5   --reps 2   --caps 60
```
= **100 games per arm per rep, 2 reps per process**, and 3 passes over the release list, so
**6 timed legs per release**. Census `data/rollout-switch-census.json` digest `b599f8d581b5`,
switchRate 0.0998, passed explicitly into both arms. `SHOWDOWN_PATH` set explicitly to the sibling
master checkout `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`.

**This is a smaller sample per point than the headline run** (which used `--pairs 40 --per-pair 10
--reps 9`) and it is deliberate: 47 release points at the headline sample would not have finished.
Absolute turns/sec here are therefore **not** directly comparable with the 1,482 headline; the
*curve* is the claim.

### Showdown is the control, and it is the reason this works

Showdown's bytes do not change across any of these runs. Because the harness interleaves the two
arms inside one process, **`medicham ms/turn / showdown ms/turn` measured in the same process** is a
contention-normalised figure. It earned its keep immediately: the first process of pass 1 read
MEDICHAM at **669 turns/sec** where the next read **2,556** — a 3.8x raw gap between two adjacent
releases with three hours of engine work between them. Normalised they are **0.1401 and 0.1390**, a
0.8% difference. The raw number was the machine, not the engine.

### Cleanliness rule (stated before the numbers, taken from the headline run)

A leg is CLEAN if **both** arms are within 1.25x of that arm's minimum across all legs of this
bisect. Dirty legs are reported and excluded; they are contention spikes that caught one arm and not
the other.

### An ENGINE agent was live throughout, and the pin was verified rather than assumed

Verified once at the start, by content and not by argument: live `engine/medicham2-browser.js` is
`5a86b1d52bd5`; release `fb0058fb5702`'s copy is `2314528872e4`; release `345f4193d440`'s is
`af0a099fde75`. A release serves its own bytes. The harness additionally records
`engine/game_differential.js`'s digest before and after every process and flags a move; it read
`9c61584c1e4a` and was unchanged in every run collated here.

---

## 2. WHAT COULD NOT BE OPENED — 172 of 599 RELEASES ARE OUT OF REACH

| | count |
|---|---|
| releases under `data/releases/` | **599** (2026-08-04 22:54 -> 2026-09-08 05:03) |
| carry no engine bytes at all — manifest only, the "checksum era" | **4** (`5fc1f711a0e3`, `2bddcc69ca83`, `4c79682a3115`, `55c7a0f19c86`) |
| snapshot ROT — bytes present, digest disagrees with its own manifest | **1** (`63e0e063bfed`, 2026-08-14: has `0608fb84f841`, manifest says `a13b89d2689f`) |
| lack `spreadL50` and/or `rngStreams`, so today's `game_differential.js` refuses them | **172** (every release before 2026-08-12 19:54) |
| **openable by this harness** | **427** |

This is `docs/LESSONS.md` §12 arriving on schedule. The stranding is not damage to the snapshots —
they verify — it is the **reader** moving: `engine/game_differential.js` names `rngStreams` and
`spreadL50` in its `need` list and throws by name without them, which is the correct behaviour and
is also a hard floor on how far back this instrument can see.

**Consequence, stated plainly: the window 2026-08-04 -> 2026-08-12, which is where both disputed
historical figures were taken, cannot be measured by the instrument that produced today's figure.**

---

## 3. THE LIVE TREE MOVED UNDER THIS MEASUREMENT, AND IT WAS CAUGHT BY A THROW RATHER THAN BY LUCK

`data/protocol-events.json` was regenerated by the live ENGINE agent at **2026-09-08 05:36Z**, in the
middle of pass 1. It is **not** a release SOURCE; `engine/game_differential.js` reads it live, and
its load guard then refused every release whose `TRACE_EVENTS` claim differed from the new file's —
**25 of the 47 processes in pass 2 died at module load** with

```
data/protocol-events.json is the ALIGNMENT RULE and it was derived from a DIFFERENT simulator claim.
It recorded 44 emitted events (from engine/medicham2-browser.js 5a86b1d52bd5) and this run plays 40
```

Three things worth stating exactly:

1. **Pass 1 is unaffected in its numbers.** The file is the alignment rule for a protocol comparison
   and the benchmark performs none — neither engine's log is read. Its only power here is to refuse
   at load. Pass 1 ran oldest-release-first, so the 28 processes before 05:36Z read the old file and
   the 19 after read the new one; all 47 exited 0.
2. **This is the CLAUDE.md hazard arriving on time**: a release freezes 26 source files and does not
   freeze a live data file that a live helper module reads. The guard is the reason it surfaced as a
   throw instead of as a quiet difference between the first and second half of a curve.
3. **The fix used, and its limit.** `make_proto_pins.js` in this run's directory writes one copy of
   the live file per release with `emitted` replaced by that release's own claim, purely to let
   `game_differential.js` load. Every file is stamped `_synthetic` and says it is **not** an
   alignment rule. The control that it is inert is in §5.

