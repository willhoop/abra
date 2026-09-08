# Where a real MILTANK decision spends its time — 2026-09-08 (SEARCH)

**Status: COMPLETE.**

## The question

Before anyone optimises the simulator, is the decision actually simulator-bound? If a decision's
time goes into board evaluation, feature construction, the policy or the opponent model rather than
into playing turns, a 10x faster simulator buys almost nothing.

## Pins (stated before the run, per CLAUDE.md)

| pin | value |
|---|---|
| engine release | `cf8567c4db78` (cut 2026-09-08T05:03:55Z, first-cut reason: "batch P fix 1: fieldEvent('Residual') pays the faint queue after a SURVIVING perish handler…") |
| frozen bytes | `engine/medicham2-browser.js` `5a86b1d52bd5`, `engine/board.js` `c85a3b756c98`, `engine/rollout_leaf.js` `1c4ba432e563` |
| NOT frozen (live, clean at run time) | `engine/miltank.js`, `engine/magnemite.js`, `engine/mew.js` — none is in `SOURCES`; all three verified clean in `git status` before the run |
| **artifact** | **`data/search-decision-profile.json`** — the figures below are derived into it |
| search config | shipped `DEFAULTS`: `n=200`, `budgetMs=20000`, `explore=1.0`, `foePolicy=uniform`, `turns` from `data/rollout-switch-census.json`, `previewN=40`, `previewMs=15000`, `defer=true`, `clock=false` |

**Why the release matters here.** Two other agents are live in this tree tonight, one of them editing
`engine/medicham2-browser.js`. The snapshot is a copy, so their edits cannot reach this run.

## How it was driven — say exactly what was profiled

`profile_decision.js` (scratchpad, not committed) does four things:

1. Opens release `cf8567c4db78` and serves `engine/medicham2-browser.js`, `tags.js`, `pp.js`,
   `mc_key.js`, `lookup.js`, `champions_sim.js`, `set_priors.js`, `smogon_priors.js`,
   `position_features.js` and `data/engine-data.js` from the **snapshot**, aliased onto the live
   paths so live callers get frozen bytes. `board.js` and `rollout_leaf.js` are compiled from the
   **snapshot's bytes under their LIVE filenames** (argmax_paired.js's technique) — see the defect
   note below for why that is load-bearing.
2. Installs MILTANK on a `magnemite` player inside a real `BattleStream` game (`engine/mew.js`'s
   own `playOne`), with `MT.DEFAULTS` — the shipped config, read from the file, never retyped.
3. Wraps the engine seam functions the leaf reaches by property access
   (`MEDI.battleInit/battleTurn/battleOver/battleResult/playerAction`, `B.dmgMon`,
   `B.choiceLockOn`) with nesting-guarded `hrtime.bigint()` timers.
4. Starts a V8 CPU profile at the **top of one decision** and stops it at that decision's bottom —
   one profile per decision, so the opponent's turn and the Showdown battle in between are not
   folded into the number.

**Team pool.** Pinned to 24 distinct sixes taken by stride from `data/team-pool-frozen/games.ots.jsonl`
(4,167 lines, 2,275 distinct sixes; the frozen copy's own digests are in that directory's `FROZEN.md`).
`pool.json` sha256(12) `194667d1e28e`. **This pool filters on COMPLETENESS, not quality** — it is not
a strength claim and nothing here depends on the teams being good.
Matchup profiled: `blaziken, metagross, garchomp, sinistcha, floetteeternal, gyarados`
vs `gardevoir, scizor, pelipper, sableye, raichu, basculegionf`, seed 20260908, mega p=1, open sheets.

**Resolved config as it actually ran:** `n=200 budgetMs=20000 explore=1.0 foe=uniform turns=14
switchRate=0.0998 previewN=40 previewMs=15000 defer=true clock=false`. Note `turns=14`, not the 60
`docs/MILTANK.md`'s flag table still shows — 60 is the fallback, and the census-derived cap is what
ships.

### Two things that had to be got right first, both of which produced a plausible wrong answer

- **`--policy random` gives Showdown's `RandomPlayerAI`, and MILTANK installed on that searches
  nothing.** It closes over magnemite's `chooseMove`/`_candsFor`/`board`; without them every
  decision falls straight back. The first run reported **sub-millisecond decisions** and looked like
  a finding. `--policy score` is the correct arm.
- **Loading `rollout_leaf.js` from the snapshot PATH silently disabled switching in every playout.**
  `census()` reads `data/rollout-switch-census.json` against its own `__dirname`, and that file is
  not in the release `SOURCES`, so the snapshot copy read ENOENT, took the documented fallback
  (`switchRate: 0`, horizon 60) and printed one stderr line. See DEFECT 1 below.

## THE SPLIT — one real in-game decision (move 3), 21,321 ms wall

Doubles turns come in pairs of `chooseMove` calls: the **first** runs the whole pair search, the
**second** returns the cached pick. Measured: 19,647 ms / 173 ms / 21,321 ms / 239 ms for calls
1–4. So a "decision" is the odd-numbered call, and the run below profiles call 3.

**Wall-clock seam timers** (`hrtime`, nesting-guarded, non-overlapping):

| where | ms | % of the decision | calls |
|---|---:|---:|---:|
| `MEDI.battleTurn` — playing turns | 16,841 | **79.0%** | 19,638 |
| `MEDI.playerAction` — building the explore pick's action | 1,802 | 8.4% | 62,920 |
| `B.dmgMon` — building the playout's bodies | 533 | 2.5% | 21,398 |
| `MEDI.battleInit` — seeding the battle | 44 | 0.2% | 2,672 |
| `B.choiceLockOn` | 30 | 0.1% | 18,704 |
| `MEDI.battleOver` | 29 | 0.1% | 19,638 |
| `MEDI.battleResult` | 6 | 0.0% | 2,672 |
| **everything else** | 2,035 | **9.5%** | |

**CPU profile, self time** (33,620 samples at 200 µs; self time partitions the wall clock exactly
once, which is why it and not inclusive time is the split):

| category | ms | % raw | % net of the instrument |
|---|---:|---:|---:|
| `medicham2-browser.js` — the simulator | 13,722 | 64.5% | **67.7%** |
| `tags.js` — the tag lookup layer | 5,321 | 25.0% | **26.3%** |
| `board.js` — body/feature construction | 371 | 1.7% | 1.8% |
| `rollout_leaf.js` — seed + playout control | 359 | 1.7% | 1.8% |
| garbage collector | 157 | 0.7% | 0.8% |
| `pp.js` | 137 | 0.6% | 0.7% |
| `mc_key.js` | 58 | 0.3% | 0.3% |
| Showdown `dist/sim` (the real game, not the decision) | 43 | 0.2% | 0.2% |
| `miltank.js` — candidate enumeration, halving, budget | 5 | 0.0% | 0.0% |
| `magnemite.js` (MAG) | **0** | **0.0%** | **0.0%** |
| `position_features.js` | **0** | **0.0%** | **0.0%** |
| *the instrument itself* (`profile_decision.js` wrappers + `node:inspector`) | 1,014 | 4.8% | — |

**This one table is read out of `run2.log` and is NOT in the artifact.** Run 3 overwrote
`decision-move3.cpuprofile` with its own control profile, so the artifact carries the four CONTROL
decisions instead. It is kept because it is the only decision measured with BOTH instruments at once,
and it is what says they agree: the seam timer puts `battleTurn` at 79.0% and the profile puts
`medicham2` self time at 67.7% with another 26.3% in the tag layer the simulator calls from inside
`battleTurn` — the same decision seen twice.

**Inclusive time for the frames that name the phases** (these NEST — never add them up):

| frame | % of decision, min–max over the four control profiles |
|---|---:|
| `leafAfterActions` — the leaf, entered from `miltank.js:546` | **99.3 – 99.5%** |
| `battleTurn` | 69.4 – 78.8% |
| `runPlayout` | 42.9 – 74.9% |
| `applySideState` — per-playout side-condition seeding | 4.2 – 10.0% |
| `chooseAction` — the greedy in-playout policy | 5.2 – 9.4% |
| `playerAction` | 5.0 – 8.2% |
| `buildSide` | 2.5 – 5.7% |
| `dmgMon` | 2.0 – 4.5% |
| `battleInit` | 0.1 – 0.2% |

`battleTurn` exceeds `runPlayout` because `rolloutAfterActions` runs the forced first turn itself
before handing the rest to `runPlayout`.

## It reproduces — four decisions, three runs, and a control that removes the instrument

`NO_SEAM=1` reruns the identical driver with **every wrapper removed**, so the ~4% the wrappers cost
is gone rather than corrected for. The split does not move.

**These are the artifact's figures** (`data/search-decision-profile.json`), with the instrument —
the wrappers and `node:inspector` writing the previous profile out — removed from the denominator
rather than carried in it.

| decision (control run) | net ms | samples | medicham2 | tags.js | rollout_leaf | board.js | miltank | magnemite (MAG) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| move 3 | 24,358 | 38,699 | 66.6% | 24.6% | 5.4% | 1.6% | 0.0% | **0.0%** |
| move 5 | 20,047 | 31,448 | 65.3% | 25.5% | 5.5% | 2.1% | 0.1% | **0.0%** |
| move 6 | 43,713 | 42,510 | 66.3% | 25.7% | 3.7% | 1.7% | 1.2% | **0.0%** |
| move 7 | 26,980 | 25,514 | 60.1% | 27.1% | 5.3% | 3.0% | 2.9% | **0.0%** |

**medicham2 + tags.js is 87.2% to 92.0% of every one of them.** Move 7 carries 3,376 ms of
`node:inspector post` — the profiler writing the previous 42 MB profile — which is why its net is
well below its 30,357 ms wall.

**Seam timers, every decision of a 9-decision run with the profiler OFF** (`run4.log`):

| decision | wall ms | leaf calls | playouts | `battleTurn` calls | turns/playout | battleTurn % | playerAction % | dmgMon % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| preview | 15,258 | 45 | 1,800 | 14,062 | 7.81 | 83.7 | 10.8 | 1.8 |
| move 1 | 26,859 | 15 | 1,607 | 13,790 | 8.58 | 81.8 | 8.6 | 1.9 |
| move 2 | 39,717 | 3 | 534 | 4,371 | 8.19 | 81.6 | 9.3 | 1.8 |
| move 3 | 42,773 | 3 | 534 | 4,531 | 8.48 | 82.1 | 8.8 | 1.9 |
| post-KO switch | 35,351 | 2 | 800 | 6,698 | 8.37 | 81.0 | 9.2 | 1.9 |
| move 5 | 21,475 | 22 | 3,139 | 25,986 | 8.28 | 81.0 | 8.7 | 2.4 |
| move 7 | 22,237 | 23 | 3,206 | 25,401 | 7.92 | 80.9 | 8.6 | 2.4 |
| move 9 | 21,526 | 39 | 5,277 | 20,887 | 3.96 | 77.2 | 7.4 | 4.1 |

**The proportions are stable to about a point across every decision in the file. The absolute
throughput is not** — per `battleTurn` cost ran 0.669 ms (move 5) to 7.747 ms (move 3), an 11.6x spread.
The slow decisions are **contiguous in wall-clock time** (moves 1, 2, 3 and the switch, consecutively),
which is what machine contention looks like and not what a position class looks like: two other
agents were live in this tree. **I did not isolate it, and I am not claiming a cause.** It is the
reason this report leads with ratios — a profile's proportions survive contention and its absolute
numbers do not.

## ANSWER 1 — YES, THE DECISION IS ENGINE-BOUND. IT IS NOT CLOSE.

- **The leaf is 99.3–99.5% of the decision** (`leafAfterActions`, inclusive).
- **The simulator plus its lookup layer is 87.2–92.0%** of self time: `medicham2-browser.js`
  60.1–66.6%, `tags.js` 24.6–27.1%.
- **Playing turns is 81%** of the decision by the independent wall-clock timer (`MEDI.battleTurn`),
  and another 9% is `MEDI.playerAction` — also simulator code — building the explore pick's action.
- **`magnemite.js` — MAG, the policy — is 0 ms.** It is consulted only on a defer, and a defer costs
  nothing because it happens *after* the search. `position_features.js` is also 0 ms.
- **Feature/body construction is 1.6–3.0%** (`board.js`, essentially all of it `dmgMon` inside
  `buildSide`).
- **MILTANK's own control layer — candidate enumeration, expressibility filtering, successive
  halving, the budget check — is 0.0–2.9%.**
- **Seeding the battle is 0.1–0.7%** (`MEDI.battleInit`, 9.5 µs a call on the least contended decision).

There is no second bottleneck hiding behind the simulator. Every category outside the engine sums to
under 13%, and most of that is `rollout_leaf.js` doing per-playout seeding.

**So Amdahl does not bite for a long way.** The serial, non-parallelisable part of a decision — the
menu build, the expressibility filter, the halving bookkeeping — is under 3%, and the 534–5,277
playouts of a decision are independent by construction. A thread pool over playouts has a ceiling
near 50x, so a 10x thread win is nowhere near it. Whether the separately-bisected 8.8x throughput
regression is recoverable is ENGINE's number and not mine; **if it is, 10x threads x 8.8x recovery x
1.9x truncation is ~167x and the 130x target is reachable. If it is not, the same stack is ~19x.**

## ANSWER 1b — A CORRECTION TO THE PREMISE: THE DECISION ALREADY RUNS THOUSANDS OF ROLLOUTS

The brief's framing — "a 20-second budget buys about 15 leaf calls, and Will wants thousands" — is
right about **leaf calls** and wrong about **rollouts**, and the two are a factor of ~130 apart on
their own.

Measured, shipped config, per single decision: **534 to 5,277 playouts**, typically **~3,200**, in
**15 to 45 leaf calls**. A leaf call is one candidate CELL evaluated; a playout is one game played
out. **The thousands of rollouts already exist.** What does not exist is coverage of the menu:

| decision | legal pairs on the menu | cells actually evaluated |
|---|---:|---:|
| move 5 | 35 | 22 |
| move 7 | 35 | 23 |
| move 9 | 35 | 39 (screen + finals) |
| move 2 | **30** | **3** |
| move 3 | **30** | **3** |
| post-KO switch | 5 candidates | **2** |

On the slow decisions the screen — whose only job is to shortlist, and which gets 40% of the budget —
covered **2 of 30 pairs** before its allowance ran out, and MILTANK then chose between two arbitrary
cells and one finalist. `screenN` is computed from the menu WIDTH (`max(8, min(SCREEN_N, round(SCREEN_N*60/nPairs)))`)
and never from the observed cost of a playout, so when a position gets 10x more expensive per turn
the screen does not shrink its sample — it simply stops covering the menu.

**That is a search-side allocation defect and no amount of engine speed removes it.** A 10x faster
engine turns "2 of 30" into "20 of 30" on that position and leaves the failure mode intact one
position further out.

## ANSWER 2 — THE ROLLOUT-LENGTH LEVER IS WORTH ~1.9x AT DEPTH 4, NOT 3x

**Measured mean playout length: 8.28 turns** (7.81 to 8.58 across every mid-game decision in the run;
3.96 on move 9, where the game was nearly over). The horizon is **14**, census-derived
(`data/rollout-switch-census.json` → `DEFAULTS.turns`), **not the 60 the flag table in
`docs/MILTANK.md` still prints** — 60 is the documented fallback.

Cost decomposition on move 5 (21,475 ms, 3,139 playouts, 25,986 turns):

| | per playout | share |
|---|---:|---:|
| per-TURN work (`battleTurn` + `playerAction` + the leaf's own pick loop) | 8.28 turns x 0.741 ms | **91.0%** |
| per-PLAYOUT fixed work (`buildSide`/`dmgMon`, `battleInit`, `applySideState`, `battleResult`) | 0.608 ms | **9.0%** |

So truncating at depth T multiplies throughput by `1 / (0.090 + 0.910 * T / 8.28)`:

| truncate at | rollouts per second, relative |
|---|---:|
| 4 turns | **1.89x** |
| 3 turns | **2.38x** |
| 2 turns | 3.23x |

**Not 3x, and the reason is worth keeping:** the playout is already short. The census-derived horizon
of 14 and a uniformly-random doubles playout together produce a mean of 8.28 turns, so depth 4 is a
2.1x cut in turns, and 9.0% of a playout is setup that truncation does not touch.

**THE ACCURACY COST IS NOT MEASURED AND I AM NOT ESTIMATING IT.** What is measured is the mechanism
it would engage: `medicham2-browser.js battleResult` scores an unfinished playout by living-body
count first and, on a tie, by summed normalised HP. So depth-3/4 truncation converts the leaf from
*"who wins this game"* into *"who is ahead on material after four turns"* on nearly every sample.
That is a change of the leaf's character, not a rounding, and it is exactly the calibration question
the brief flags as MEASURE's: **a null result on a truncated leaf may be about the leaf, not the
search.** The experiment that would price it is R1's shape — the same positions, judged at horizon 14
and at horizon 4, scored against the realised outcome — and it needs the quarantine gate open,
because R1 leaf accuracy is a withheld figure today.

## ANSWER 3 — STRUCTURAL WASTE, FOUND AND NOT FIXED

Reported, not touched. A fix is a separate, attributable change.

### W1. `applySideState` rescans the whole move tag table FOUR TIMES PER PLAYOUT — ~5–6% of every decision

`engine/rollout_leaf.js:1024` calls `TAGSMOD.withTag('move', 'hazard')`, `'halvesDamage'`,
`'sideBuff'` and `'groundsField'`, and `tags.js withTag` is
`Object.keys(T).filter(id => (T[id].tags||[]).includes(tag))` — a **full scan of the ~500-move table
with a per-row array scan**, with no memo. It runs **once per playout**, i.e. 2,672–5,277 times per
decision, and **its answer is a constant of the process**.

Measured by nearest-caller attribution of `tags.js` self time: **3.9% to 9.0%** of every decision is
tag-layer time whose nearest caller outside `tags.js` is `rollout_leaf.js:1024 applySideState`.
Inclusive `applySideState` is **4.2% to 10.0%** of every decision.

Nothing about the board's side conditions changes between the playouts of one decision.

### W2. `tags.norm` is not memoised — 8–10% of every decision

`const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')`, called by `tagsFor` on
**every** `param()` and `has()`. Self time across the four control decisions: **8.7% to 10.3%** of
the whole decision. The inputs are a few dozen distinct move/ability/item ids repeated millions of
times.

Add `param` (5.6–6.2%), `tagsFor` (3.1–4.3%), `withTag` (2.1–5.8%) and `has`, and **the tag lookup
layer is 24.6–27.1% of every MILTANK decision** — roughly a third of what the simulator costs, spent
almost entirely on string normalisation and linear `includes` scans over a table that never changes.

Callers inside the simulator, by share of the decision: `effSpeed` ~3.6%, `dmgRangeOneHit` ~3%,
`battleTurn` 1.7–1.8%, `suppressesWeather` 1.4–1.6%, then a long tail (`accModRow`, `critChance`,
`berryRefusedByFoe`, `auraStateOf`, `tracksTargetOf`, `suppressedAbility`, `berryPinchUpdate`,
`berryPPUpdate`).

**This is the cheapest large number in the whole profile** and it is not a mechanics change: the tag
table is loaded once and is immutable except through the declared `__setDB` test seam.

### W3. `B.dmgMon` rebuilds every body on every playout — 1.8–4.1%

`buildSide` calls `B.dmgMon` once per body per playout (25,134 calls in one decision; 42,238 on move 9).
The comment above it is correct that fresh bodies are required — MEDICHAM mutates what it is handed —
but *fresh* and *rebuilt from the board* are different requirements. Inclusive `buildSide` is 2.5–5.7%.
Smaller than W1 and W2 and listed for completeness.

### W4. `MEDI.battleInit` is already free — 0.1–0.2%, 16 µs a call

Named explicitly because "cache the seed" is the obvious first optimisation and **it is worth
nothing**: 9.5 µs a call, 0.1–0.7% of a decision. The expensive part of seeding is `applySideState` (W1) and `dmgMon`
(W3), neither of which is inside `battleInit`.


## DEFECTS TRIPPED OVER. FILED, NOT FIXED.

### DEFECT 1 — a frozen release CANNOT serve `rollout_leaf.census()`, and it fails quietly into a different player

`engine/rollout_leaf.js census()` reads `data/rollout-switch-census.json` against its **own
`__dirname`**. That file is **not in `engine/engine_release.js SOURCES`**, so a measurement that loads
`rollout_leaf.js` from a snapshot path gets ENOENT, takes the documented fallback — **`switchRate: 0`
(the playout cannot switch at all) and horizon 60 instead of 14** — prints one stderr line, and runs a
materially different player while reporting success.

Measured here, first attempt: the run printed
`rollout_leaf: data/rollout-switch-census.json unavailable ... THE PLAYOUT CANNOT SWITCH` and
`search config ... turns=60`, versus `switchRate=0.0998 ... turns=14` once the module was compiled
from the snapshot's bytes under its live filename.

This is the same shape as the `mc_key.js`, `move-effects.js` and `pp.js` growths CLAUDE.md records —
a valid digest set that is not a runnable engine — except that this one does not throw. **It is
exactly the failure mode this project is named after: the capability is absent and everything reports
success.** Owner: MEASURE (`engine_release.js` `SOURCES`). Two candidate fixes, both theirs: add the
census to `SOURCES`, or have `census()` resolve against the live tree the way `quality.js`
deliberately does.

Everything downstream: any pinned run that loaded `rollout_leaf.js` out of a release directory was a
switchless playout at horizon 60. I did not audit which ones.

### DEFECT 2 — `evalPair` seeds from `Date.now()`, so a MILTANK decision cannot be replayed

`engine/miltank.js`, in `chooseMove`:

    seed: (Date.now() & 0xffff) * 7919 + ia * 31 + ib + salt,

Two runs of the identical position, identical release, identical teams and identical battle seed
produce different playout dice and can produce a different click. Observed directly: run 2 and run 3
of this driver — same seed, same teams, same release — diverged at move 1 (`hammerarm` vs `ironhead`)
and played different games from there.

The battle seed, the player PRNG seeds and the team draw are all derived and reproducible
(`engine/mew.js` argues exactly this: a claim of the form "this switch won the game" is unfalsifiable
if the game cannot be replayed). The search's own dice are not. Owner: SEARCH — this file. **Not
fixed in this pass**, because changing the seed changes what is clicked and needs its own arm.

### DEFECT 3 — `budgetMs` overran to 2.1x on four of eight decisions

`budgetMs` is 20,000. Measured wall clock: **26,859 / 39,717 / 42,773 / 35,351 ms** on four
consecutive decisions, against 21,475 / 22,237 / 21,526 on the rest. The mechanism is already
documented in `miltank.js reduce()` — the budget is tested *between* finalists, so the last finalist
runs to completion past it — and `miltank.js` also records a live decision that took 33,589 ms. This
is the measured size of it under the shipped config: **one finalist at `n = 2 x 200 = 400` playouts
costs ~24 s on a slow position.**

Showdown's `Timer Max Per Turn` for this format is 55 s. A 42.8 s decision is inside that and a
44.6 s one is close to it, off a 420 s bank that buys 21 requests. The adaptive rule
(`MILTANK_CLOCK=1`) exists, is default-off, and only ever lowers the *configured* budget — it does
not bound the last finalist either.

### NOT A DEFECT, but read the line carefully — `MILTANK release: OFF_RELEASE`

The run prints `OFF_RELEASE — 1 of 26 frozen files have moved since release cf8567c4db78 was cut —
this process is NOT running that release: engine/medicham2-browser.js`. That is **correct about the
live tree and wrong about this process**: ENGINE is editing the live simulator right now, and this
process serves the snapshot's bytes. The stamp answers *"does the working tree match the manifest"*,
which is not *"which bytes did this process execute"*. The driver asserts the latter directly — it
throws unless `require.cache` resolves medicham2 out of `data/releases/`.

## RANKED LIST — what would actually buy rollouts

Ranked by (measured share) x (confidence it is recoverable).

| # | lever | owner | measured size | what it buys |
|---|---|---|---|---|
| 1 | **Memoise the tag layer** — cache `norm()`, index `tags` as a Set, memoise `withTag(kind,tag)` | ENGINE | **24.6-27.1% of every decision**; `norm` alone 8.7-10.3%, `withTag` 2.1-5.8% | up to **~1.35x** if the layer went to zero; realistically ~1.25x. No mechanics change — the table is immutable outside the `__setDB` test seam |
| 2 | **Hoist `applySideState`'s four table scans out of the per-playout loop** | SEARCH (`rollout_leaf.js`) | **4.2-10.0% of every decision**, 534-5,277 identical recomputations | ~1.06x alone; overlaps lever 1, so measure once after both |
| 3 | **Parallelise playouts across threads** | ENGINE / SEARCH | serial fraction of a decision is **under 3%**; 534-5,277 independent playouts | near-linear; Amdahl ceiling ~50x, so 8-10x on 16 cores is realistic and is NOT limited by the search |
| 4 | **Recover the 8.8x throughput regression** | ENGINE (bisection in flight — their number, not mine) | if real, it is 88% of the engine's cost, and the engine is 90% of the decision | up to ~8x. The single biggest item **if it lands** |
| 5 | **Make `screenN` adaptive to measured playout cost** | SEARCH | on slow positions the screen covered **2 of 30 pairs**; on fast ones 22 of 35 | buys no rollouts, buys the thing rollouts are for. Cheapest real improvement in choice quality here |
| 6 | **Truncate the playout at depth 3-4** | SEARCH, gated on MEASURE | mean playout **8.28 turns**; 91% of cost is per-turn | **1.89x at depth 4, 2.38x at depth 3** — and it turns the leaf into a material comparator, so it is not free |
| 7 | **Bound the last finalist, not only the gaps between finalists** | SEARCH | 2.1x budget overrun on 4 of 8 decisions | buys no rollouts; removes a live-game clock hazard |
| 8 | **Clone the playout bodies instead of rebuilding through `dmgMon`** | SEARCH | 1.8-4.1% by the seam, 2.5-5.7% inclusive | ~1.04x. Listed so it is not mistaken for a big one |
| — | **Cache the battle seed / `battleInit`** | — | **0.1-0.7%** | **nothing.** Named because it is the obvious first idea and it is worth zero |
| — | **Anything in MAG, the features, or the opponent model** | — | **0.0%** | **nothing.** `magnemite.js` and `position_features.js` never appear in the profile |

**Stacked, honestly:** levers 1+2 (~1.3x) x lever 3 (~9x) x lever 6 (~1.9x) = **~22x** with no
regression recovery, and **~190x** with lever 4 if ENGINE's 8.8x is real. The 130x the brief names is
reachable, and **lever 4 is the load-bearing term** — everything else together is ~22x.

## WHAT THIS RUN DOES NOT SAY

- **It is not a strength claim.** No SPRT was run and no arm was compared. The pool filters on
  completeness, not quality.
- **The absolute throughput here is contended** — two other agents were live and `battleTurn` cost
  varied 11.6x within one run. Every conclusion above is a RATIO, which is the part that survived the
  control and the reruns.
- **One matchup.** The proportions were stable across a preview decision, a post-KO replacement and
  seven move decisions of one game; they were not measured across teams.
- **`data/policy-weights.json` is stale** — the run printed the feature-semantics warning (damage
  table regenerated 318 -> 322 species, fixture scenarios 10 -> 12). MAG owes a REFIT; that is
  MEASURE's and it does not touch this result, because MAG costs 0 ms.
- **No quarantined figure is quoted.** R1/R2/R3/R4 remain withheld; nothing here reads them.

## ARTIFACTS

Scratchpad, not committed —
`C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\72879879-cc78-43c3-bf5d-01280add6e63\scratchpad\search-profile-2026-09-08\`:
`profile_decision.js` (driver), `build_pool2.js`, `analyse.js`, `analyse2.js`,
`pool.json` (sha256(12) `194667d1e28e`), `run2.log`, `run3.log`, `run4.log`, `decisions.json`,
`decision-move{2..7}.cpuprofile`.
