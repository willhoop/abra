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

Every new file lives in this run's directory and none of them measures throughput: `run_pass.sh`
schedules, `collate.js` reads the artifacts and prints the curve, `noise.js` prints the noise floor,
`prof_summary.js` / `prof_diff.js` read a `.cpuprofile`, `size_vs_speed.js` fits, `make_proto_pins.js`
writes the load-guard pins of §3, `nan_counter.js` names one broken counter. `instrumentation_rate.js`
is the one that runs the engine, and it is a SEPARATE question (a counter-write rate, §6) rather than
a point on this curve — it is reported apart for that reason. `t.js` and `t.log` in the same directory
are a two-line smoke test of the `cmd.exe` invocation, left in place rather than tidied away.

### The sample definition (every flag is part of it, not a budget)

```
--team-store data\team-pool-frozen   --pairs 20   --per-pair 5   --reps 2   --caps 60
```
= **100 games per arm per rep, 2 reps per process**, and **5 passes** over the release list, so
**10 timed legs per release, 470 in all**. Census `data/rollout-switch-census.json` digest `b599f8d581b5`,
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

---

## 4. THE CURVE

47 release points, chosen as **the first openable release of every day in the window plus a midday
one on any day with more than three releases** — deliberate spacing rather than a random sample, so
every day of engine work is bracketed. Figures are the median over CLEAN legs; `n` is how many
survived the filter.

`data/verification/speed-bisect-2026-09-08/curve.json` is the artifact and
`collate.js` in the same directory prints the table below from it.

**The shape of the answer: over the whole measurable window the engine is 2.19x slower, and no single
release step is larger than 11.2% against a 7.3% noise floor.** It is not one landing. It is 26 days
of small ones.

| instrument | 2026-08-12 | 2026-09-08 05:03 `cf8567c4db78` | ratio |
|---|---|---|---|
| the curve — normalised medicham ms/turn / same-process showdown ms/turn | **0.1345** (`6155acc0fb26`, 19:54) | **0.2942** | **2.19x** |
| `instrumentation_rate.js`, 400 playouts, uncontended, no Showdown arm | **0.3403 ms/turn** (`05e03b600fc7`, 23:23) | **0.7327 ms/turn** | **2.15x** |
| CPU profile, MEDICHAM-side self time, same 100-game sample | **891 ms** (`05e03b600fc7`) | **1,745 ms** | **1.96x** |
| mean turns per game | 10.78 | 10.14 | — |
| reached a result | 100% | 100% | — |

The two 2026-08-12 releases are 3.5 hours apart and read **0.1345 and 0.1390** normalised — a 3.3%
difference inside a 7.3% floor, so the three rows are anchored at the same place.

Three instruments that share nothing but the pool agree on **1.96-2.19x**. That is the number.

### Noise floor, measured before any of it was believed

`noise.js` in the run directory. Normalising by the same-process Showdown leg takes
**corr(log contention, log figure) from 0.848 to -0.124** — the normalisation is doing the work it
was put there to do. Within-release spread of the normalised figure at the chosen filter is
**7.3% median** — max/min over that release's own legs, so it WIDENS as legs are added; at four
passes it read 4.2%. The filter threshold, Showdown within 1.25x of its global minimum, was chosen by
a rule fixed in advance: the loosest cap whose median within-release spread stays under 10%, 10%
being the smallest step the curve is asked to resolve. **225 of 470 legs survive it and all 47
releases resolve**, so the loosest-cap clause has no work left to do; `noise.js` prints the sweep and
1.40 (9.7%) would also have qualified.

### The steps

Every step below is normalised and paired against the previous resolved point, so a "step" is the
whole interval between two releases and usually contains 2-20 simulator commits. **No step is
attributable to a single commit at this spacing, and that is a finding rather than a gap** — the
curve has no cliff to bisect into.

| interval | step | simulator commits in it |
|---|---|---|
| 2026-08-13 00:59 -> 06:03 | **+11.2%** | 2 |
| 2026-09-07 00:16 -> 17:57 | **+10.9%** | 4 |
| 2026-08-19 05:52 -> 22:21 | **+9.5%** | 2 |
| 2026-08-14 06:22 -> 2026-08-15 03:04 | +7.4% | 1 |
| 2026-08-12 23:23 -> 2026-08-13 00:59 | +5.9% | 2 |
| 2026-08-27 02:31 -> 16:53 | +5.2% | 15 |
| every other interval | between -6.8% and +5.6% | — |

**AND NOT ONE OF THEM CLEARS THE NOISE FLOOR BY MUCH.** The floor is 7.3% and the largest step is
11.2%. Three of the top six are inside it. **This curve has no cliff to bisect into**, and that is
the finding: further bisection would be resolving noise, not landings.

---

## 5. THE LEADING HYPOTHESIS IS REFUTED, AND THE PROFILE SAYS SO

**Hypothesis under test (Will's): the shared dice addressing — building `20260813|1|any|closecombat|p20|0`
on every draw — is string allocation in the hottest loop in the program.**

**REFUTED for the path that is being measured. It is 0.73% of MEDICHAM-side self time.**

The mechanism is in the source and the profile confirms it. `midEventDice()` — the factory that
builds an address, counts repeats in a `Map`, hashes it with FNV-1a + fmix32 and returns a value —
is constructed by **`game_differential.js` for the middle arm**. `rollout_leaf.runPlayout` hands
`rngStreams()` a plain `mulberry32` function, which takes the documented back-compatible path:

```js
/* THE BACK-COMPATIBLE PATH. One function, every stream is it. */
const f = (typeof src === 'function') ? src : (() => 0.5);
const o = { any: f, split: false, seed: null };
for (const k of RNG_STREAMS) o[k] = f;
```

No address is built, nothing is hashed, and `MID_NTH`/`MID_LOG` are never touched in a rollout. What
the play path DOES pay is the address FIELD WRITES, which are unconditional by deliberate design
(*"a mode flag would mean the instrumented engine and the shipped engine take different branches"*).
Measured, release `cf8567c4db78`, self time out of 1,745 ms MEDICHAM-side:

| | ms | share |
|---|---|---|
| `_midWriteActionAddr` | 5.2 | 0.30% |
| `midEventSlot` | 4.3 | 0.25% |
| `rngStreams` | 1.6 | 0.09% |
| `midAbortTwoTurn` | 1.6 | 0.09% |
| **dice addressing, total** | **12.7** | **0.73%** |
| `traceSweep` + `traceCopy` + `traceBind` (protocol trace) | 7.9 | 0.45% |

**The hypothesis was right about the mechanism and wrong about where it runs.** The expensive version
of the addressing exists and is paid by the DIFFERENTIAL, which is a measurement and is supposed to
be expensive. Stripping it from a play build would return under 1%.

### What the profile actually blames

`prof_diff.js`, same sample both sides (`--pairs 20 --per-pair 5 --reps 1 --caps 60`), MEDICHAM-side
self time **891 ms -> 1,745 ms**. The 854 ms of added self time, biggest first:

| added ms | x | % of the rise | where |
|---|---|---|---|
| 104.3 | 1.56 | 12.2% | `battleTurn` (the turn loop itself; a very large function, so this is a bucket not a line) |
| 68.4 | **3.42** | 8.0% | `effSpeed` |
| 56.9 | **2.40** | 6.7% | `tags.js norm` |
| 48.2 | 1.65 | 5.6% | `rollout_leaf runPlayout` |
| 47.8 | 3.54 | 5.6% | `(anonymous)` in medicham2 |
| 37.7 | NEW | 4.4% | `_updateEvent` |
| 32.3 | 2.37 | 3.8% | `dmgRangeOneHit` |
| 31.8 | 1.37 | 3.7% | `tags.js param` |
| 30.9 | NEW | 3.6% | `_walk` |
| 23.8 | 2.23 | 2.8% | `tags.js tagsFor` |
| 19.1 | NEW | 2.2% | `residualExpireAt` |
| 18.9 | NEW | 2.2% | `commitQueueSort` |
| 18.4 | **3.90** | 2.2% | `residualOrder` |
| the remaining ~215 functions | | ~44% | none above 1.5% each |

**There is no cliff.** The largest single contributor is 12.2% of the rise and is the turn loop
itself. The residual family (`_updateEvent`, `_walk`, `residualExpireAt`, `residualOrder`,
`residualFollowerRuns`, `residualClockTick`) adds **117.3 ms = 13.7%** of the rise between them, and
that is the residual walk stopping at handlers rather than at groups — one of the mechanisms named
in the brief, confirmed, and it is **mechanics**. `dmgRangeOneHit` at 2.37x is damage re-priced per
arrival — also named in the brief, also confirmed, also **mechanics**.

---

## 6. THE SPLIT WILL ASKED FOR — INSTRUMENTATION vs MECHANICS

Two things a profiler cannot see, so both are measured another way. `instrumentation_rate.js` runs
**400 playouts / 4,230 turns** on a frozen release, reads the exported counter objects before and
after, and prices one write with a micro-benchmark on the same object shapes. It is a **cost model
and an upper bound**, not an ablation, and it says so in its own output.

### Measured rates, per TURN, release `cf8567c4db78`

| | writes per turn |
|---|---|
| `MEDSEEN.*++` (829 sites, 776 keys) | **149.6** |
| `MEDFAILS.*++` (327 sites, 562 keys) | 0.15 |
| `tags.ASKED[tag]++` — one per `param()`/`has()` call | **1,454.1** |
| `tags.COUNT[tag]++` — one per hit | **1,490.9** |
| measured cost of one write on this box | 17.4 ns (plain object, 800 keys) / 17.0 ns (null-proto dict) |

**Modelled instrumentation: 52.7 microseconds per turn out of 733 — 7.2%.**

### The split

| bucket | what it is | measured share | recoverable? |
|---|---|---|---|
| **INSTRUMENTATION** | counter writes (`MEDSEEN`, `MEDFAILS`, `tags.ASKED`, `tags.COUNT`) | **7.2%** of play time (cost model, upper bound) | yes, and it is the whole of what a play build could strip |
| | dice address field writes + protocol trace | **1.2%** of MEDICHAM self time | yes, and it is trivially small |
| **MECHANICS** | `effSpeed` 3.4x, the residual family (+13.7% of the rise), `dmgRangeOneHit` 2.4x, `commitQueueSort`, `_shieldGate`, `noteFaint`, `restoreStatsAll`, `berryRefusedByFoe`, and ~200 others | **the remaining ~90%** | **no — this is the engine modelling the game** |
| **NEITHER — avoidable overhead** | `tags.js` lookup path | **15.7%** of MEDICHAM self time (273 of 1,745 ms) | see below |

**Total instrumentation is about 8-9% of play time.** Deleting every counter and every address write
from a play build would take 0.733 ms/turn to roughly 0.67 — about **1,490 turns/sec instead of
1,365**. It does not recover an 8.8x and it does not recover a 2x. **The loss is mechanics, and
mechanics is not recoverable.** That is the uncomfortable half of this answer and it is the answer.

### The one thing that is neither, and is the only real lever found

`engine/tags.js` costs **273 ms of 1,745 ms MEDICHAM-side self time — 15.7%** — and the engine makes
**1,454 `param()`/`has()` calls per turn**. Every one of them runs:

```js
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
```

on the entity id, **uncached**, then a linear `rec.tags.includes(tag)`, then two dictionary
increments. `norm` alone is 97.6 ms — **5.6% of all MEDICHAM self time** — spent lower-casing and
regex-stripping a few hundred distinct move and ability ids, over and over, for the whole run.

The call rate itself grew with the mechanics: **799.6 tag calls/turn on 2026-08-12 -> 1,454.1 today,
1.82x**, against a total slowdown of 2.15x. So tags is not a growing SHARE (17.4% -> 15.7%); it is a
constant tax that scales with how much of the game the engine models.

**This is a fact, not a proposal.** It is neither instrumentation nor irreducible mechanics: the
lookup is required, the string work per call is not. **DO NOT ACT ON THIS FROM THIS REPORT** — it is
an ENGINE change with a behaviour surface (`tags.js` is a frozen release SOURCE and `TAGS.norm` is
exported), it needs its own attributable change and its own before/after, and this pass explains
rather than fixes.

### An instrument that could not count, found in passing

On release `05e03b600fc7` (2026-08-12), `MEDSEEN.retaliateWhenLowered` becomes **NaN** during
ordinary play, which is why `instrumentation_rate.js` reports `null` for that release's MEDSEEN rate
rather than a number. It is finite on `cf8567c4db78`, so it was fixed at some point in the window.
Recorded because a counter that cannot count is the failure mode this project names first, and
because a `null` in a measurement is something to name, not to caption.

---

## 7. THE BLIND WINDOW, AND THE ONLY HONEST THING THAT CAN BE SAID ABOUT IT

2026-08-04 to 2026-08-12 cannot be measured (§2) and is where both disputed figures were taken (§0).
It is not nothing, though, because the measurable window turns out to have a very tight law in it.

`size_vs_speed.js`, over the **47 resolved releases**, regressing the normalised cost on the
simulator's **non-comment** byte count (medicham2-browser.js is ~68% comment lines, and comments cost
parse time, which every figure here excludes):

```
log(normalised cost) = 0.945 * log(non-comment bytes) + c        R^2 = 0.934,  n = 47
```

**Cost grows very nearly in proportion to how much code the simulator has.** A slope of 1.0 would be
exact proportionality; 0.945 says the engine is very slightly sublinear in its own size. Over the
window: code **1.879x**, cost **2.19x**.

| | non-comment code | file |
|---|---|---|
| `4c73f9cafa4b` 2026-08-06 — the release ADR-002 measured | **106 KB** | 348 KB |
| `6155acc0fb26` 2026-08-12 19:54 — the first openable one | **305 KB** | 1,388 KB |
| `cf8567c4db78` 2026-09-08 05:03 — current | **574 KB** | 3,150 KB |

Applying the fitted law across the blind window (**an extrapolation, and labelled as one — it is not
a measurement and must never be quoted as one**): 2.889x more code implies **2.73x** slower, so the
whole 2026-08-06 -> 2026-09-08 span implies **6.0x**, not 8.8x.

Two things follow, and only these two:

1. **The direction of the 8.8x claim survives and its magnitude does not.** A ~6x loss over 33 days
   is real and large. The extra ~1.5x in the published figure is what you get from comparing a
   60-turn capped run against a 10-turn run that plays to a result.
2. **Nothing in the blind window is a candidate cliff either.** Under this law the pre-window loss is
   the same phenomenon as the post-window one — code arriving — and the law was fitted on 47 points
   with R^2 0.934, not on the endpoints.

For orientation, the middle point of the published series lands where this curve puts it:
`data/medicham-speed.json` (2026-08-28, release `5f3f7141227c`) reads **1,596-2,044 turns/sec** at
cap 60; this bisect reads **1,513 turns/sec** for `345f4193d440` (2026-08-28 00:11) on a smaller,
more contended sample. Consistent, and not the same measurement.

---

## 8. VERDICT

**The engine is 2.19x slower than it was on 2026-08-12 (47 resolved release points, noise floor 7.3%,
three independent instruments agreeing at 1.96-2.19x), and roughly 6.0x slower than on 2026-08-06 by
extrapolation. It is not 8.8x, and the 8.8x was never a like-for-like ratio.**

**There is no step to find.** The largest interval step is **+11.2%** across two commits, against a
**7.3%** noise floor — three of the six biggest steps are inside the floor. The profile is equally
flat: the biggest single contributor to the rise is the turn loop itself at 12.2%, and about 44% of
the rise is spread over ~200 functions none of which reaches 1.5%. The engine did not fall off a
cliff; it accreted, at a rate of very nearly one unit of cost per unit of code (slope 0.945,
R^2 0.934).

**The instrumentation-versus-mechanics split, in turns/sec:**

| | today | with that cost removed | recoverable |
|---|---|---|---|
| play throughput, release `cf8567c4db78`, uncontended, 400 playouts | **1,365 turns/sec** (0.733 ms/turn) | — | — |
| minus all counter writes (`MEDSEEN`, `MEDFAILS`, `tags.ASKED`, `tags.COUNT`) — 7.2%, cost model | | ~1,470 turns/sec | **+7.7%** |
| minus the dice address writes and the protocol trace — 1.2% | | ~1,385 turns/sec | **+1.2%** |
| **both, an upper bound on a stripped play build** | | **~1,490 turns/sec** | **+9%** |
| everything else | | — | **not recoverable — it is the game being modelled** |

**Will's leading hypothesis is refuted.** The shared dice addressing is 0.73% of MEDICHAM self time
in the play path, because the expensive half of it — the address string, the repeat map, the hash —
is built by `game_differential.js` for the middle arm and never runs inside `runPlayout`. The other
three candidates in the brief are confirmed and are all **mechanics**: the residual walk restructure
is 13.7% of the rise, `dmgRangeOneHit` (damage re-priced per arrival) is 2.37x, and `effSpeed` is
3.42x.

**One lever exists and it is in neither bucket.** `engine/tags.js` is 15.7% of MEDICHAM self time at
**1,454 lookups per turn**, and `norm()` — an uncached `toLowerCase()` plus regex strip, run on every
one of them — is 5.6% of the whole engine on its own. That is not instrumentation and it is not the
game; it is the same few hundred strings being renormalised for the length of the run. **Filed, not
fixed**: it is ENGINE's file, it is a frozen release SOURCE, and it needs its own attributable change
with its own before and after.

**The honest summary is the uncomfortable one.** Roughly 9% of the loss can be bought back by
stripping instrumentation, and about 16% more is a caching question in one file. The remaining
three-quarters is the engine playing more of the game than it used to, and there is nothing to
recover there.

---

## 9. ARTIFACTS AND HOW TO REPRODUCE

```
data/verification/speed-bisect-2026-09-08/
  candidates.txt                 the 47 release ids, in cut order
  run_pass.sh                    the scheduler (one process per release; passes alternate direction)
  r-<id>-p<pass>.json/.log       every run, unedited
  collate.js  curve.json         the curve
  noise.js                       the noise floor and the filter-threshold sweep
  prof/                          two .cpuprofile files and their runs
  prof_summary.js  prof_diff.js  self time by function, and differenced
  instrumentation_rate.js        counter write rate + cost model
  instrumentation-rate-<id>.json
  size_vs_speed.js  size-vs-speed.json
  make_proto_pins.js  proto/     the load-guard pins (see §3) — NOT alignment rules
  nan_counter.js                 names the counter that goes NaN on 05e03b600fc7
```

```bash
export SHOWDOWN_PATH='C:\Users\willj\Projects\Pokemon\pokemon-showdown'
bash data/verification/speed-bisect-2026-09-08/run_pass.sh 1        # forward
bash data/verification/speed-bisect-2026-09-08/run_pass.sh 2 rev    # reverse
node data/verification/speed-bisect-2026-09-08/noise.js
node data/verification/speed-bisect-2026-09-08/collate.js
node data/verification/speed-bisect-2026-09-08/size_vs_speed.js
```

**Every flag is part of the sample definition, not a budget** — `--pairs 20 --per-pair 5 --reps 2
--caps 60`, five passes / 470 timed legs, `--team-store data\team-pool-frozen`, census `b599f8d581b5`. A run at other
values is a different question wearing the same file names.

**Machine:** 16 cores, node v24.15.0, Windows 11, BelowNormal priority via `tools\lownode.cmd`, with
a live ENGINE agent and other divisions running throughout — which is why the Showdown control and
the cleanliness filter exist and why 52% of legs were refused. Nothing here transfers to another box
without re-measuring.

**This report optimises nothing and proposes nothing.** Every cost named here is a measurement.
