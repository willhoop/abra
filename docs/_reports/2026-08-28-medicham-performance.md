# MEDICHAM performance — what the 385 MB is, where the 0.51 ms goes, and what compute we actually have

**2026-08-28, MEASURE.** Asked for: how to speed MEDICHAM up, give it more compute/memory, or use
what we have better. Escalated mid-task — the memory accounting first, the budget second, the profile
third.

**Everything measured here reads the FROZEN RELEASE `5f3f7141227c`**, verified intact
(`engine_release.js verify` → *"release 5f3f7141227c is intact"*), so an ENGINE agent editing
`engine/medicham2-browser.js` in the live tree cannot have moved under any of it. `switchRate` and
`maxTurns` were read from the LIVE `data/rollout-switch-census.json` (digest `b599f8d581b5`,
`switchRate 0.0998`, `maxTurns 14`) and passed **explicitly**, because a release does not freeze that
file and its fallback is a playout that cannot switch.

**This is not an accuracy claim.** MEDICHAM is quarantined for correctness and nothing here lifts it.

**The box was NOT quiet** — several agents were working throughout, and this run was BelowNormal.
So: **no absolute rate in this document is mine.** Every figure I publish is either a MEMORY number,
a PROFILE FRACTION, or a RATIO measured between arms interleaved inside one process against a stated
noise floor. Absolute throughput is quoted only from `data/medicham-speed.json`, which
`engine/provenance.js` reports `ok`.

---

## THE THREE ANSWERS

1. **The 385 MB is mostly benchmark harness.** A real MILTANK worker is **139 MB** — 41 MB of bare
   node, 20 MB of everything ABRA owns, and **74–88 MB of Showdown dex**. The other ~246 MB in the
   benchmark is the team pool (148 MB), `game_differential.js` (17 MB) and warm-up headroom (47 MB),
   none of which a live search loads. **A live battle's mutable state is 22.6 KB.**
2. **The memory-bandwidth / L3-thrash story is REFUTED, and it was mine to check.** A playout touches
   **zero** Showdown dex rows and about 35 `MC.mons` rows; the hot data working set is **well under
   1 MB per worker** against a 16 MB L3, and eight real workers would be **1.1 GB, not 3.1 GB**, on a
   14.3 GB box. Neither cache nor memory pressure can be the ceiling. **Shared-memory workers would
   not lift it** — and separately, worker threads turn out to share most of the read-only footprint
   anyway (measured: seven of them cost 123 MB total, not 620 MB), so the RAM saving is real and the
   CPU problem is untouched by it.
3. **The single highest-leverage change is not in the engine: MILTANK uses ONE of sixteen hardware
   threads.** There is no `worker_threads` and no `child_process` anywhere in `miltank.js`,
   `mag_bot.js` or `magnemite.js`. Behind that, the one code change with a measured multiplier is a
   **keyless cache in `engine/tags.js` — 1.18–1.76x, median ~1.34x, with byte-identical game outcomes
   in all four rounds** against a 1.054x noise floor.

---

## 1. WHAT THE 385 MB IS MADE OF

`scratch/memA.js`, `scratch/memB.js`, `node --expose-gc`, staged, `global.gc()` ×3 before every
reading. RSS in MB.

### 1a. The engine-ready worker — what MILTANK would actually hold

| stage | RSS | Δ RSS | heap used |
|---|---|---|---|
| bare node | 41.3 | — | 4.0 |
| `+ engine_release.open()` | 43.7 | +2.4 | 4.6 |
| `+ data/engine-data.js` (globalThis.MC) | 44.9 | +1.2 | 5.8 |
| `+ engine/medicham2-browser.js` (pulls `tags.js` → `data/tags.json`) | 59.8 | **+14.9** | 17.9 |
| `+ engine/board.js` | 60.4 | +0.6 | 18.6 |
| `+ engine/rollout_leaf.js` | 60.9 | +0.5 | 18.8 |
| `+ tags forced explicitly` | 60.9 | **+0.0** | 18.8 |
| `+ engine/champions_sim.js` required | 61.0 | +0.1 | 18.9 |
| **`+ Dex.forFormat` (lazy — one `species.get`)** | **135.0** | **+74.0** | 59.7 |
| `+ dex.all()` walked for species/moves/items/abilities | 148.7 | +13.7 | 66.5 |

> The `+0.0` on the tag line is not a null result: it says `data/tags.json` was **already resident**,
> pulled in by `medicham2-browser.js`. It is inside that 14.9 MB, not additional to it.

**A real MILTANK worker is 139 MB** (repeated in a second process: 61.7 MB engine-ready-minus-dex,
139.0 MB with the lazy dex). Fully forcing the dex takes it to 149 MB. **The Showdown dex is 53–59%
of it. Everything ABRA owns is 19.6 MB — 14%.**

### 1b. What the benchmark added on top, and why it is not the search's problem

| stage | RSS | Δ RSS | is it a live worker's cost? |
|---|---|---|---|
| engine-ready + dex | 139.0 | — | **YES** |
| `+ team pool` (8,778 teams, `data/team-pool-frozen`) | 287.2 | **+148.2** | **no — harness** |
| `+ require('game_differential.js')` | 304.3 | **+17.1** | **no — harness** |
| `+ 4 built team pairs` | 305.8 | +1.5 | no — harness |
| after warming 1,500 playouts | 352.4 | **+46.6** | **yes** — JIT code 0.7 → 3.4 MB, plus GC headroom |
| after 400 more playouts | 358.9 | +6.5 | yes |

So the ~385 MB decomposes roughly as **139 MB real worker (36%) + 167 MB harness (43%) + ~47 MB
warm-up headroom (12%)**. **A warmed LIVE worker is about 186 MB, not 385.**

### 1c. Read-only versus mutable

| | size | read-only? |
|---|---|---|
| Showdown dex | 74–88 MB | **read-only** |
| `data/tags.json` + `MC` + compiled ABRA code | ~19.6 MB | **read-only** |
| bare node runtime | 41.3 MB | per-isolate, not a sharing candidate |
| **one live battle (`S`, both sides, field, bench)** | **22.6 KB**, 62 objects | mutable |
| JIT code space after warm-up | 3.4 MB | per-isolate |

**About 70% of a worker is read-only.** The genuinely per-battle mutable state is five orders of
magnitude smaller than the resident set.

---

## 2. HOW MUCH DOES ONE PLAYOUT ACTUALLY TOUCH?

Measured with a recording `Proxy` on `MC.mons` / `MC.moves` and a wrapper on `dex.species.get`, over
50 playouts on 4 pinned-pool pairs, and separately over one `rolloutWinProb` call.

| | runPlayout (50 playouts) | one leaf call, n=20 |
|---|---|---|
| distinct `MC.mons` rows read | **35** | 11 |
| distinct `MC.moves` rows read | 500 — **see the correction below** | 23 |
| distinct Showdown dex species | **0** | 11 |
| `dex.species.get` CALLS | — | **431** (≈21.5 per sample) |
| approx. bytes of MC rows touched | ~216 KB (overstated, below) | ~29 KB |

**CORRECTION I NEARLY PUBLISHED.** The "500 `MC.moves` rows" is **not** a per-playout scan. Tracing
the reads to a stack showed `stampMoveIds()` (`medicham2-browser.js:8354` in the release), which is
`if(_mvIdsStamped)return;` followed by one `for(const k in T)` over all 500 rows — **a one-time
initialisation that my Proxy happened to be installed for.** The 216 KB figure therefore *includes*
that one-time walk and overstates the steady-state touch. I am leaving both visible because the
first reading looked like a finding and was one of this project's standard failure shapes.

**Two conclusions that do survive:**

- **`runPlayout` never touches the Showdown dex.** All 21 `Dex.` references in
  `medicham2-browser.js` are in COMMENTS. The 74–88 MB dex is resident and **cold** during a playout.
  It is reached only through `buildSide` → `board.dmgMon` → `effective()`, i.e. leaf *seeding*.
- **The hot data working set is well under 1 MB per worker**: ~35 species rows, a small number of
  move rows, and a 22.6 KB battle state.

### THE L3 STORY IS REFUTED

The premise I was handed — *385 MB per worker thrashing a 16 MB L3* — does not survive either half.
The resident set is 139 MB, not 385, and the part a playout walks is under 1 MB. Eight workers would
put roughly **2 MB** of hot data against a **16 MB** L3. **Memory pressure is refuted too:** eight
real workers is **1.1 GB** on a box with 14.3 GB total and 4.1 GB free at the time of measurement.
The 1.73 GB free reading in the earlier 12-worker leg was a *harness* worker at 385 MB, not a search
worker at 139 MB.

**I do not have a replacement explanation for the scaling gap, and I am not going to invent one.**
The scaling measurement itself is `confidence: LOW` (one of six legs collapsed 7.3x), the box is 8
physical / 16 logical cores so anything above 4 workers is on SMT siblings, and the package ran at
86–95% of nominal under load. It needs an idle box — see OWED.

---

## 3. WOULD WORKER THREADS WITH SHARED IMMUTABLE DATA HELP? — MEASURED, NOT ASSUMED

`scratch/memG.js`. The parent loads the engine + the dex, then spawns N worker **threads** in the same
process, each of which loads the same engine + the same dex. If JS objects were shared, RSS would
barely move; if each isolate pays for its own, RSS grows by roughly one engine-ready worker each.

| after | process RSS | Δ | worker's own heap |
|---|---|---|---|
| parent bare | 49.1 | — | — |
| parent engine + dex ready | 141.0 | +91.9 | — |
| worker 1 | 240.5 | +99.5 | 71.6 |
| worker 2 | 258.0 | +17.5 | 71.5 |
| worker 3 | 260.3 | +2.3 | 71.7 |
| worker 4 | 262.0 | +1.7 | 71.7 |
| worker 5 | 262.8 | +0.8 | 71.5 |
| worker 6 | 264.3 | +1.5 | 71.5 |
| worker 7 | 233.8 | −30.5 (GC returned pages) | 71.5 |

**Both halves are true and they matter separately:**

- **Each worker DOES build its own object graph** — every one reports a ~71.5 MB own heap. Node
  worker threads are separate V8 isolates; you cannot hand them a shared JS object. "Shared immutable
  data" in the JS-object sense **is not available** and would require re-expressing the dex as a
  `SharedArrayBuffer` with binary accessors, which is a large rewrite of every dex read.
- **And yet the process only pays once.** Seven workers cost **123 MB** of additional RSS in total;
  the marginal cost of workers 3–7 was **1–2 MB each**. V8 shares read-only heap and string data
  across isolates in one process, and the OS shares the mapped source pages. Seven separate
  *processes* would be ~975 MB for the same work.

**SO: worker threads are a ~4x RAM win and I have NO evidence they are a CPU win.** Since RAM was
never the binding constraint (139 MB × 8 = 1.1 GB), **this is not the fix.** Scoped anyway, because
it was asked for:

| | |
|---|---|
| **cost to build** | ~1 day. A pool module, a leaf-sharding protocol (`n=200` splits into `k × n/k` and the results pool — the leaf is a mean of Bernoulli samples, so pooling is exact, not an approximation), seed discipline so a sharded leaf is reproducible, and a clock owner. |
| **what it buys** | RAM: 1.1 GB → ~0.3 GB at 8 workers. CPU: **unknown.** |
| **what it does NOT buy** | Anything from sharing the dex, because a playout does not read the dex. |
| **risk** | MEDIUM. Sharded RNG is the classic place a measurement quietly dies; `runPlayout` takes its `rng` as an argument, which helps. |

**Recommendation: do NOT build shared-memory workers to solve a cache problem that does not exist.**
If you go multi-worker, choose threads over processes for the RAM, and choose it for that reason.

---

## 4. THE PROFILE — WHERE 0.51 ms/TURN GOES

Two profiled arms, 400 playouts / 4,237 turns each, warmed 2,000 playouts first (V8 tier-up is a
5.6x effect and a cold profile is a profile of the interpreter). Sampling interval 200 µs, scoped to
the measured arm with an `inspector` session so load and warm-up are excluded. **Self time.**

| file | run C (`--max-semi-space-size=1`) | run D (default new space, 128 MB) |
|---|---|---|
| `medicham2-browser.js` | 64.42% | **68.92%** |
| **`tags.js`** | **19.55%** | **25.04%** |
| garbage collector | **10.74%** | **0.52%** |
| `rollout_leaf.js` | 4.12% | 4.32% |
| `pp.js` | 0.67% | 0.74% |

Top self-time functions, run D:

```
18.41%  battleTurn            medicham2-browser.js:20290
11.31%  norm                  tags.js:65        <-- String().toLowerCase().replace(/[^a-z0-9]/g,'')
 9.89%  param                 tags.js:106
 4.06%  effSpeed              medicham2-browser.js:13519
 3.78%  runPlayout            rollout_leaf.js:805
 3.52%  dmgRangeOneHit        medicham2-browser.js:9880
 2.78%  residualOrder         medicham2-browser.js:7395
 2.51%  tagsFor               tags.js:70
 1.92%  _updateEvent          medicham2-browser.js:21200
 1.74%  accModRow             medicham2-browser.js:8547
 1.47%  residualExpireAt      medicham2-browser.js:7765
 1.33%  has                   tags.js:116
```

### 4a. GC — REFUTED as a cost, and one flag made it 20x worse

**Garbage collection is 0.52% of self time under default settings.** Allocation pressure is not the
problem and it is not the explanation for the scaling gap either.

**`--max-semi-space-size=1` raised GC from 0.52% to 10.74%.** That is a measured negative result for
a flag that gets cargo-culted. Do not shrink the semi-space.

**An instrument failed here and I am naming it.** `perf_hooks` `PerformanceObserver({entryTypes:['gc']})`
reported **zero** GC events in *both* runs — including the one where the CPU profiler saw 10.74% of
samples in the collector. The observer is not to be trusted on this node build; every GC figure above
comes from the profiler. The two conditions are their own control: an instrument that reads zero where
another reads 10.7% has been shown unable to see the thing it measures.

### 4b. Narration — already free, no win available

`runPlayout` pays **nothing** for protocol lines. `traceBind()` sets the module-level `TR` to `null`
unless a caller passes `opts.trace` with a `.push`, and every one of the 462 emit sites is behind a
falsy test. No trace or protocol function appears anywhere in the top 35 by self time in either
profile. **The free win was already taken; there is nothing to reclaim.**

### 4c. The tag layer is 25% of the loop, and the call volume says why

Instrumented over 100 playouts / 1,023 turns by wrapping the `engine/tags.js` exports:

| | |
|---|---|
| `param` + `has` calls | **1,320,738** |
| turns | 1,023 |
| **calls per turn** | **1,291** |
| distinct `(kind, id, tag)` triples | 7,121 |
| **calls per distinct answer** | **185.5** |

Each call does, in `tags.js`: a regex `norm()` over the id, a dictionary lookup, a **linear
`rec.tags.includes(tag)` scan**, and two writes into `Object.create(null)` counter dictionaries.
1.32 million times, for 7,121 distinct answers.

*(This is a lower bound: it counts callers that reach the module through the exports object. A file-local
alias captured at require time would be invisible to the wrapper.)*

---

## 5. THE FIX WITH A MEASURED MULTIPLIER — AND THE ONE THAT WAS 2x SLOWER

Both attempts were installed **over the module exports inside a scratch process**. **No engine file
was edited.** Arms run interleaved **A B A B** on identical seeds, and each round compares an OUTCOME
DIGEST (turns, wins, draws, and a rolling hash of per-playout result) — if the digests differ the
cache changed the game and the timing means nothing.

### ATTEMPT 1 — a memo keyed on a concatenated string: **0.58x. SLOWER. RETAINED AS A REFUTATION.**

```
round 0: baseline 3062.5 ms, memo 5282.7 ms, 0.580x, outcomes identical
round 1: baseline 2646.0 ms, memo 5341.8 ms, 0.495x, outcomes identical
round 2: baseline 2216.6 ms, memo 4866.1 ms, 0.456x, outcomes identical
round 3: baseline 2438.9 ms, memo 3314.9 ms, 0.736x, outcomes identical
```

Two causes, and both are the lesson: it **built a `kind\0id\0tag` key string on every one of 1.3
million calls** — allocating more than the regex it removed — and it **swapped the function object
between arms**, which makes the call site polymorphic. *Caching is not automatically faster than
computing when the cache key costs more than the computation.*

### ATTEMPT 2 — keyless, one permanent wrapper: **median ~1.34x, outcomes identical**

Per-kind `Map` on the raw id string, a `Set` of tags on the cached entry, no key construction on a
hit, counters preserved so the arm pays the real bookkeeping. One permanent indirection installed
*before* any consumer captured it, so both arms see one function object.

```
round 0: baseline 2574.8 ms, fast 2015.1 ms, 1.278x, outcomes identical
round 1: baseline 2425.9 ms, fast 2050.0 ms, 1.183x, outcomes identical
round 2: baseline 3141.1 ms, fast 1781.8 ms, 1.763x, outcomes identical
round 3: baseline 2728.0 ms, fast 1949.7 ms, 1.399x, outcomes identical
noise floor (same arm twice, same seeds): 1.054x
```

**Median ≈ 1.34x, range 1.18–1.76x, against a 1.054x noise floor.** Every round cleared the floor and
every round produced a byte-identical game. The wide spread is the busy box; the interleave is what
makes the ratio meaningful and the floor is what says the effect is real.

**Two things ENGINE must handle if it lands this** (it is `engine/tags.js`, ENGINE's file, filed not
fixed): the `ASKED` / `COUNT` counters are read by `tests/test-wiring.js` and must keep incrementing
per CALL, not per miss; and the cache must be invalidated if `data/tags.json` is ever regenerated
inside a live process.

---

## 6. THE COMPUTE BUDGET — WHAT WE HAVE PER DECISION

Absolute rates from `data/medicham-speed.json` (provenance `ok`, release `5f3f7141227c`): one leaf
call at MILTANK's shipped settings (`n=200`, `explore=1.0`, uniform, `maxTurns=14`) costs
**1,144–1,270 ms** on one core.

### 6a. The clock is BANK-limited, not turn-limited — and 20 s is already the right number

Read out of `engine/miltank.js:40-79` (which reads it out of Showdown's `data/rulesets.ts:778`):
**55 s per request, 420 s bank, 90 s first-turn grace that is clamped away on the second timed
request.** Requests per game, measured there over 30,396 non-forfeit ladder games: **p50 9, p90 13,
p95 15, p99 19, only 0.58% exceed 21.**

So `(420 − 45 reserve) / 19 ≈ 19.7 s`. **`budgetMs: 20000` is the bank-safe p99 number, not an
arbitrary one.** There is no free lever in the clock while the timer is on. When the timer is OFF the
bank does not tick at all (`nextTick` is only scheduled by `nextRequest`), so the constraint
disappears entirely — which is the case in most of Will's own games.

### 6b. The budget, with each line marked

| | leaf calls per 20 s decision | status |
|---|---|---|
| **FLOOR — today, as shipped: one process, ONE core of sixteen** | **15.8 – 17.5** | **MEASURED** (`data/medicham-speed.json`) |
| + keyless tag cache | 18.6 – 30.8 (median ~21–23) | measured ratio × measured base — **composed** |
| + 4 processes (2.35x, `confidence: LOW`) | 37 – 41 | composed, and the 2.35x is LOW confidence |
| **BEST WITH TODAY'S ARCHITECTURE: 4 workers + tag cache** | **≈ 50 – 55** | **PROJECTION from measured parts** |
| IF 8 threads scaled like the CPU-bound control (6.61x) | ≈ 140 – 155 | **PROJECTION, unmeasured, optimistic** |

Against `docs/_reports/2026-08-28-search-viability-threshold.md`, which needs **33–303**
n=200-leaf-call equivalents per decision:

- **Today we are short by 2x on the friendliest case and by 17x on the conservative one.**
- **4 workers + the tag cache clears the friendly case (33) with margin** and is still ~6x short of
  the conservative one.
- Nothing on this box gets to 303 by tuning. That gap is a search-design problem, not a compute one.

**Design against 15–17 leaf calls until a worker pool actually exists and has been measured.** An
over-optimistic budget is worse than a conservative one, and the 2.35x it rests on is a
LOW-confidence figure from a run where one of six legs collapsed 7.3x.

---

## 7. RANKED — every candidate, its multiplier, its cost, its risk

| # | change | multiplier | measured or estimated | cost | risk |
|---|---|---|---|---|---|
| **1** | **Use more than one core.** `miltank.js` / `mag_bot.js` / `magnemite.js` contain no `worker_threads` and no `child_process`. The leaf is a mean of Bernoulli samples, so `n=200` shards exactly across k workers. | **2.35x at 4** | MEASURED, **confidence LOW**, and not by me | ~1 day: pool, shard protocol, seed discipline, clock owner | MEDIUM — sharded RNG is where measurements die |
| **2** | **Keyless cache in `engine/tags.js`** (per-kind Map on the raw id, `Set` of tags, no key construction). | **1.18 – 1.76x, median ~1.34x** | **MEASURED**, outcomes byte-identical, floor 1.054x | ~20 lines, ENGINE's file | LOW — must preserve `ASKED`/`COUNT` and invalidate on a tags regeneration |
| 3 | **Hoist leaf seeding.** `buildSide` runs per sample; one n=200 leaf call makes ≈4,300 `dex.species.get` calls resolving **11** distinct species. Memoise `effective(mon,dex)` per board. | ≤1.10x | ESTIMATED — ceiling is the published ~9% seeding share; the 4,300-vs-11 ratio is measured | LOW | MEDIUM — bodies must still be FRESH per sample or every playout starts where the last ended |
| 4 | Keep the worker pool ALIVE. 475 ms to engine-ready ≈ 83 playouts, and tier-up needs ~4,000 playouts for a 5.6x effect. | avoids a ~5x penalty | published measurement | free — a design rule | LOW. **A per-decision fork would be catastrophic.** |
| 5 | Turn cap 14 → 10. | ~1.09x | published artifact, not mine | free | **Accuracy is not mine and not measured. Recommend NOT doing it for a 9% gain.** |
| 6 | Worker THREADS instead of processes. | RAM 4x; CPU **unknown** | RAM MEASURED (§3) | inside #1 | LOW — but it solves a constraint we do not have |
| 7 | Node flags. | **none found** | MEASURED | — | `--max-semi-space-size=1` made GC 20x worse. Do not shrink it. |
| 8 | Suppress narration in playouts. | **1.00x** | MEASURED — already free | — | — |
| 9 | Shared immutable data via `SharedArrayBuffer`. | **~1.00x** | REFUTED — a playout reads zero dex rows | very high | Do not build. |

**RECOMMENDATION: do #2 first, then #1.**

#2 is twenty lines in one file, its outcome control passed in every round, and it pays back
immediately whether or not a worker pool ever exists. #1 is the bigger number and the bigger
commitment, and it should be built against a scaling curve measured on an idle box rather than
against the LOW-confidence 2.35x. Together they are a projected **3.1x — 50–55 leaf calls per 20 s
decision**, which is the first configuration that clears the friendly end of the search's own
requirement.

---

## 8. WHAT WAS RULED OUT, AND WITH WHAT CONTROL

| hypothesis | verdict | the control |
|---|---|---|
| 385 MB per worker thrashes a 16 MB L3 | **REFUTED** | worker is 139 MB, not 385; playout touches 0 dex rows and <1 MB of data |
| Memory pressure caps the worker count | **REFUTED** | 8 real workers = 1.1 GB on a 14.3 GB box; the 385 MB that produced the fear was 43% harness |
| GC / allocation pressure is a material cost | **REFUTED** | 0.52% of self time at default settings; the `=1` arm proves the profiler could have seen it |
| Playouts pay for narration nobody reads | **REFUTED** | `TR === null` without an `opts.trace` sink; absent from the top 35 in both profiles |
| A memo over the tag layer is an easy win | **REFUTED as first written** — 0.58x | the concatenated key allocated more than the regex it replaced |
| A *keyless* cache over the tag layer is a win | **CONFIRMED** — 1.18–1.76x | interleaved A B A B, identical outcome digests, 1.054x noise floor |
| Startup cost matters per decision | **REFUTED for the shipped design** | MILTANK spawns nothing; it is a worker-pool design rule, not a cost today |
| Sharing immutable data across workers would lift the ceiling | **REFUTED** | the shared candidate is never read on the hot path |
| Worker threads each pay for the whole dex | **REFUTED** | 7 workers cost 123 MB total; marginal worker 1–2 MB |

**What I could NOT rule out, and will not guess at:** the gap between MEDICHAM's 2.35x at 4 workers
and the CPU-bound control's 3.69x. Cache and memory pressure are both out. What remains is SMT (8
physical cores, 16 threads), clock throttling (86–95% of nominal under load), the sporadic 7.3x
collapse the earlier report documents, or the measurement itself. **It needs an idle box.**

---

## 9. SIDE EFFECTS AND DEBRIS — REPORTED, NOT CLEANED

- **`data/diff-team-pool.json` was rewritten by my runs** (12,058 teams, digest `b0bef6620efb`,
  20:03:48). Cause: `require('engine/game_differential.js')` loads the **LIVE** store at module
  scope, while my `loadTeams` pinned the FROZEN store — and `diff_swarm.js` keeps **one** cache file
  keyed by store, so alternating between the two makes every run a MISS and a ~41 s rebuild. No data
  is lost (the cache is derived and self-keying), but **two agents alternating frozen and live pools
  will each pay 41 s and thrash each other's cache.** Worth a register row; not mine to fix.
- **A release-pinned run cannot find Showdown unless `SHOWDOWN_PATH` is set.**
  `data/releases/<id>/engine/showdown_path.js` resolves the sibling checkout relative to its own
  `__dirname`, which under a release is `data/releases/<id>/`, so it looks for
  `data/releases/pokemon-showdown` and falls back to `/tmp/ps`. It **throws loudly** rather than
  degrading silently, which is the right failure — but every release-pinned command needs the env var
  in front of it. Same class as the census gap already documented.
- **`perf_hooks` GC observer is unreliable on node v24.15.0** — see §4a.
- **Nothing was deleted.** New files are all in the session scratchpad, none in the repo:
  `memmap.js` (superseded), `memA.js`, `memB.js`, `memC.js`, `memD.js`, `memE.js`, `memF.js`,
  `memG.js` and their `.out.json` / `.err.txt`.
- **No engine file was edited, nothing was committed, nothing was pushed.**

---

## OWED, NOT RUN

None of these were run and nothing above depends on them. All need `SHOWDOWN_PATH` and a **quiet
box** — verify idle first, or the run is worthless.

```bash
export SHOWDOWN_PATH=/c/Users/willj/Projects/Pokemon/pokemon-showdown
powershell -NoProfile -Command "[math]::Round((Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples[0].CookedValue,1)"
node -e "console.log((require('os').freemem()/1e9).toFixed(2),'GB free')"   # want <10% CPU, >10 GB free
```

**1. Repeat the tag-cache ratio on an idle box.** The multiplier that gates recommendation #2. Four
interleaved rounds gave 1.18–1.76x on a busy box; this is the number ENGINE should be given.

```bash
cmd /c tools\lownode.cmd <scratch>\memF.js --release <ID> --playouts 600 --rounds 6 \
  --out <scratch>\memF-idle.json
# read: OUTCOMES_IDENTICAL must be true, and speedup_median against noise_floor_same_arm_twice
```

**2. A trustworthy process-scaling curve, at 1/2/4/6/8, three interleaved legs per count.** This is
the number recommendation #1 rests on and it is currently `confidence: LOW`. The command is already
written in `docs/_reports/2026-08-28-medicham-speed.md` OWED §1 — run that one, not a new one.

**3. Do worker THREADS scale in CPU the way processes do?** §3 measured only RAM. Needs a bench mode
that runs the playout loop inside `worker_threads` rather than `child_process`. **NOT IMPLEMENTED** —
`engine/bench_speed.js` has `--workers` on processes only.

**4. Leaf-seeding hoist, measured rather than estimated (#3 in the ranking).** Needs an arm that
memoises `effective(mon, dex)` per board across the n samples and compares leaf ms with an outcome
digest, exactly as `memF.js` does for tags. **NOT IMPLEMENTED.**

**5. Re-measure everything here after the engine lands.** Every figure is stamped to release
`5f3f7141227c`. The profile fractions are the most portable and the ratios the least — a change
inside `battleTurn` moves the denominator.

---

## Register

Nothing here closes a register row. Two candidates if they are kept: the `engine/tags.js` cache
(a defect with a measured multiplier, ENGINE's file) and the `diff-team-pool.json` cache thrash
between frozen and live stores. The scratch instruments are session files and are not proposed as
repo artifacts.
