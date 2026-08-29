# What is the minimum threshold for search to be viable — and do we know it?

**2026-08-28, SEARCH.** Reading and arithmetic only. **No game was played, no rollout was run, no
artifact was written by this session.** Another agent was benchmarking the engine throughout
(`engine/bench_speed.js`, PIDs 18048 / 18788 / 4852 / 16816 / 12292 observed live at 19:05), and
nothing here touches the store, the pool or the simulator.

---

## THE ANSWER IN THREE LINES

1. **A bar exists, it is an ACCURACY bar, and Will asked a COMPUTE question.** The coordinator's
   reading is **CONFIRMED**. No compute bar exists anywhere in the repository.
2. **The accuracy bar is UNREADABLE TODAY, on both sides.** The challenger artifact and the
   threshold artifact it is compared against are both UNSAFE. The bar exists and its calibration
   cannot be quoted.
3. **The arithmetic demands 33–303 n=200-leaf-call equivalents per decision** (≈38 s to ≈347 s of
   single-core time at the measured throughput). **The shipped 20 s budget buys 17.5.** The
   friendliest defensible case is short by ~2x; the conservative case by ~17x.

---

## 1. DOES A STATED VIABILITY BAR EXIST?

### 1a. What the "declared threshold" block actually asserts

`docs/SEARCH.md:3664`, inside **R11** (2026-08-05):

> *"R1's threshold is PORYGON2's published +3.42 lift over the same baseline."*

| | |
|---|---|
| **What it is a bar on** | **LEAF ACCURACY.** Percentage-point lift in *position-judging accuracy* of the rollout leaf over the material baseline, on a fixed corpus of human positions. |
| **Who declared it** | SEARCH/MEASURE, adopting PORYGON2's published margin as the comparator. First read `PASS_ON_BASELINE` 2026-08-04; upgraded to `PASS_OUTRIGHT` in R11 on 2026-08-05 at release `3932186b59ef`. |
| **What it does NOT bar** | Anything about time, playouts, decisions per second, menu width, or whether the search selects the better *action*. |

The document says this itself, at `docs/SEARCH.md:3856-3860`, in the same section:

> *"a leaf that judges 4.6 points better than material may still rank 63 candidate cells
> identically. **R5 is the measurement that decides whether any of this buys a click**"* — and R5 is
> **SPEC, NOT RUN** (`docs/SEARCH.md:3502`).

**So the premise of the brief is verified, not refuted.** The one declared threshold is an accuracy
bar on a *judge*, and Will is asking about a *chooser* under a clock.

### 1b. The other "declared threshold" block is a memory bar, not a compute bar

`docs/SEARCH.md:3873` — the DUSK size gate. `SHIPPABLE ≤ 335,000 entries` / `SHIPPABLE_PACKED ≤
2,700,000`, derived from a 64 MB resident budget and GitHub's 50 MB per-file warning. It is a bar on
a **tablebase that would REPLACE search**, not on search. Verdict was TOO BIG. Not the answer.

### 1c. What the repository has instead of a compute bar

Three things, none of which is one, and the gap between them is exactly the hole:

| | what it is | where | direction |
|---|---|---|---|
| **A compute CEILING** | 55 s per decision, 420 s bank + 90 s first-turn grace — read out of the Showdown source, `docs/SEARCH.md:2855` | rules | *don't exceed* |
| **An accuracy FLOOR** | PORYGON2's +3.42 lift, on the leaf as a judge | R1 gate | *don't fall below* |
| **A per-decision RESOLUTION rule** | `tieBand = 1.5 × se(n=400)` = **3.75 pt at p=0.5** — below this, hand the turn to MAG | `engine/miltank.js:1349-1352` | *what to do when you can't tell* |

Nothing joins them. There is no statement anywhere of the form *"the search must resolve a gap of X
points with confidence Y at a menu width of K, and that costs Z seconds."* The tie band is the
closest thing to a declared indifference zone in the project — and it is declared **in code, as a
fallback rule, never as a viability requirement**, and it was never measured against anything.

### 1d. Independent confirmations that no such bar exists

- `node engine/where.js "search viability threshold"` → **`NOTHING IN tests/ NAMES THIS.`**
- `docs/ROADMAP.md`: no row states a compute or decision-resolution bar for search. The only
  "good enough" row, **#129**, is a usage-weighted ENGINE coverage standard (99.24% of real clicks
  land on a move with no known defect) and is explicitly about the simulator, not the search.
- `docs/SEARCH.md` "Done looks like" (`:3604`) states a *procedural* bar only — a gated,
  artifact-backed SPRT verdict against a named release, flags recorded per arm. It names no number.

**VERDICT ON PART 1: the bar Will is asking for does not exist. The premise of the brief is correct.**

---

## 2. IS THE EXISTING BAR QUOTABLE TODAY?

**No — and it fails on BOTH sides of the comparison.** Read from `node engine/provenance.js` and
`node engine/status.js`, this session (status stamped 2026-08-28 19:01; provenance run 19:03):

| artifact | role in the R1 gate | provenance |
|---|---|---|
| `data/rollout-r1-explore1.json` | the challenger — the leaf's measured accuracy | **UNSAFE** |
| `data/porygon2.json` (and `porygon2-curve`, `-species`, `-separation-gate`, `-open`, `porygon2c`) | the threshold — the +3.42 lift the gate is read against | **UNSAFE** |

So the sentence *"the lower bound clears it (3.473 > 3.42)"* rests on two withheld numbers. Under
CLAUDE.md a withheld figure is **absent, not annotated**, so **the R1 gate verdict may not be
quoted at all** — not as `PASS_OUTRIGHT`, not with a caveat.

`status.js` withholds all four SEARCH gates:

```
R1 leaf accuracy   WITHHELD   data/rollout-r1-explore1.json UNSAFE
R2 leaf cost       WITHHELD   data/rollout-cost.json        UNSAFE
R3 divergence      WITHHELD   data/rollout-r3.json          UNSAFE
R4 does it win     WITHHELD   data/rollout-r4.json          UNSAFE
```

and every R4 shard on disk is stamped `PRE-CHANGE` against a newest engine source of
`data/abra-tags.js 2026-08-28 15:46`.

**Three further artifacts I wanted and cannot use**, checked and reported rather than assumed:

- `data/argmax-paired.json`, `-n12`, `-n100` — **UNSAFE.** This is the run whose *unpaired* control
  is the direct empirical measurement of how much of MILTANK's argmax is dice. It is exactly the
  number that would anchor §3 empirically and it is withheld.
- `data/rollout-switch-census.json` — **UNSAFE.** Its human-game-length figures are therefore not
  quotable. *Its configuration values* (`maxTurns 14`, `switchRate 0.0998`) are still what MILTANK
  ships, and using them as parameters is not the same as quoting them as measurements — that
  distinction is why MEASURE's speed number survives.
- `data/miltank-timing-r6.json` — provenance reports **no traceable generator**: *"NO file in
  engine/build/tests names this artifact at all."* R6 also declares itself `PRE-CHANGE` in its own
  section. Its per-decision wall-clock distribution is therefore not load-bearing here and I have
  not built anything on it.

**Provenance-`ok` and usable:** `data/medicham-speed.json`, `data/_bench-headline.json`,
`data/_bench-headline2.json`, `data/_bench-normal.json`, `data/_bench-scaling.json`. Those are the
only measurements in this report.

**VERDICT ON PART 2: the bar exists and its calibration is unreadable.** That is the honest answer
and it is not a soft one — it means the *only* declared threshold this division has cannot currently
be shown to be met or missed.

---

## 3. WHAT WOULD THE COMPUTE BAR ACTUALLY BE?

### 3.0 First: the measured inputs, re-read rather than taken from the brief

Two independent benchmark legs, both provenance-`ok`, engine release `5f3f7141227c`, team pool
pinned to `data/team-pool-frozen`, one warm process, turn-0 4v4 board, cap 14, n=200:

| | `_bench-headline.json` | `_bench-headline2.json` |
|---|---|---|
| ms per n=200 leaf call | **1,144.47** | **1,146.04** |
| playouts/sec | **174.8** | **174.5** |
| ms/turn | 0.607 | 0.608 |
| truncated at cap 14 | 13.8% | 13.8% |

**MEASURED: 175 playouts/sec; 1,145 ms per n=200 leaf call.** The full-sweep artifact
`data/medicham-speed.json` reads 157.5 playouts/sec on its own leaf arm — that leg ran alongside the
scaling arm and is slower; the two dedicated legs agree with each other to 0.2%. Take 175 as the
planning rate and 157 as the contended floor. The stated noise floor is 2.5%.

**A 20,000 ms budget therefore buys 3,496 playouts = 17.5 n=200-leaf-call equivalents.** The brief's
"~16" comes from `data/medicham-speed.json`'s slower leg (15.8). The honest range is **15.8–17.5**;
I use **17.5** below because it is the friendlier number and the conclusion survives it.

**Three corrections to the brief's summary of MEASURE's figures**, all in the direction of *more*
cost, not less:

- **"~5.5 ms per whole game at cap 60"** is a *uniform-random* playout, not a game. Its mean length
  is 10.75 turns. That is the right number for a rollout and the wrong one for "a game".
- **"~0.5 ms per simulated turn"** is the cap-60 playout-arm figure. The **leaf** path measures
  **0.607 ms/turn** on both headline legs, because the leaf pays `buildSide` ×2 per sample.
- **MEASURE's §5 "K⁴ cells → K=2 → 16 cells affordable, K=3 → 81 not affordable" describes
  `engine/truncation_curve.js:128-132`, which is a full simultaneous-move MATRIX search, and
  `engine/miltank.js` does not run one.** The shipped picker enumerates **our** joint pairs only
  (`oa.length × ob.length` = K² cells) and plays the opponent by `foePolicy`. At the corpus median
  of 8 options a slot — miltank.js's own comment, `:1076-1077` — that is **64 cells, already**. The
  "K=3 is unaffordable" framing understates the situation: the shipped width is the one that does
  not fit.

### 3.1 The estimator's noise — MEASURED shape, ASSUMED p

A leaf value is a Bernoulli mean over n playouts, so `SE = sqrt(p(1−p)/n)`. p=0.5 is the worst case
and is what MILTANK's own code clamps to (`Math.max(p(1−p), 0.0025)`).

| n | where it is used | SE at p=0.5 | SE of a *difference* between two candidates on independent dice |
|---|---|---|---|
| 19 | mew.js H2H screen at `--miltank-n 60` | 11.5 pt | 16.2 pt |
| 40 | R3/R17 sampling axis | 7.9 pt | 11.2 pt |
| 63 | shipped screen at a 64-cell menu | 6.3 pt | 8.9 pt |
| 200 | shipped `n` | 3.5 pt | 5.0 pt |
| 400 | shipped finals (`ROLLOUT_N × 2`) | **2.5 pt** | **3.5 pt** |

**Marked ASSUMED:** p≈0.5. Away from 0.5 the SE is smaller, so these are ceilings — but the leaf's
own saturation is the reason p is often *not* near 0.5, and how often is a calibration question that
is WITHHELD.

**One structural caveat, MEASURED:** 13.8% of leaf playouts truncate at cap 14 and are scored on HP
material rather than a result. So roughly one sample in seven is not a Bernoulli draw from the
outcome at all. That makes the SE above an *underestimate* of the true estimator noise by an unknown
amount. Cap 60 removes it for 4.6% more time (1,197 ms vs 1,144 ms per leaf call) — and **the live
bot already runs cap 60** (`mag_bot.js:154`), while the H2H harness runs cap 14.

### 3.2 The bar has to be a TRIPLE, not a pair

The brief proposes a pair — smallest gap worth resolving, and leaf calls to resolve it across K
candidates. **Challenge: it is a triple**, and the third element is what makes the arithmetic bite:

> **(δ\*, PCS\*, K)** — the smallest true win-probability gap the search is required to resolve, the
> probability with which it must resolve it, and the menu width it must do so at.

Confidence cannot be left implicit, because the whole difficulty is that PCS is a *steep* function
of δ. Stating "resolve 5-point gaps" without saying "how often" permits both a 25% answer and a 90%
answer, and those differ by a factor of ~10 in cost. All three are currently undeclared.

### 3.3 The arithmetic

Standard fixed-budget best-arm identification under the **least-favourable configuration**: one arm
truly better by δ, the other K−1 tied exactly. Estimates ~ N(·, σ_n²), σ_n = sqrt(p(1−p)/n).

```
PCS(Δ, K) = ∫ φ(u) · Φ(Δ + u)^(K−1) du        with Δ = δ / σ_n
n         = p(1−p) · Δ² / δ²
```

Solving for Δ at each K (computed numerically; the K=2 case checks against the closed form
Δ = √2·z_{PCS}, giving 1.812 at PCS=0.90 — exact):

| K candidates | Δ at PCS 0.80 | **Δ at PCS 0.90** | Δ at PCS 0.95 |
|---|---|---|---|
| 2 | 1.190 | **1.812** | 2.326 |
| 4 | 1.893 | **2.452** | 2.916 |
| 8 | 2.340 | **2.869** | 3.310 |
| 16 | 2.691 | **3.202** | 3.628 |
| 64 | 3.257 | **3.747** | 4.155 |
| 90 | 3.380 | **3.866** | 4.271 |

**Multiple comparisons cost less than they feel like they should.** From K=2 to K=64 the required
standardised gap only doubles (1.81 → 3.75) — but n scales with **Δ²**, so the *cost* rises 4.3x per
arm and 137x in total. Ranking is expensive because there are more arms, not because each is harder.

**Uniform allocation, PCS target 0.90, at the measured 175 playouts/sec:**

| δ (pt) | K=2 | K=4 | K=8 | K=16 | K=64 |
|---|---|---|---|---|---|
| **2.0** | 23 s | 86 s | 236 s | 587 s | 3,214 s |
| **3.75** | 7 s | 25 s | 67 s | 167 s | 914 s |
| **5.0** | 4 s | 14 s | **38 s** | 94 s | 514 s |
| **10.0** | 1 s | 4 s | 9 s | 24 s | 129 s |

**Two-stage (MILTANK's actual shape — screen K, keep top 8, re-test at n_f), PCS 0.90 split as
0.95 retention × 0.947 final:**

| δ (pt) | K=16 | K=64 | K=90 |
|---|---|---|---|
| 2.0 | 477 s | 2,169 s | 3,292 s |
| 3.75 | 136 s | **617 s** | 937 s |
| 5.0 | 77 s | **347 s** | 527 s |
| 10.0 | 19 s | 87 s | 132 s |

Successive halving is a real saving (at δ=5, K=64: 347 s against 514 s uniform) and it is not a
rescue.

### 3.4 What δ should be — and the honest answer that no artifact says

**δ is the input nothing in this repository measures.** There is no artifact holding the
distribution of *true* win-probability gaps between MILTANK's top candidates. The two instruments
that would speak to it — R3 divergence and R17's paired argmax sweep — are both **UNSAFE**, and R5,
which is designed to produce exactly this, is **SPEC, NOT RUN**.

So δ is given as a free parameter above, and the only anchor I will offer is a *specification*, not
a measurement:

> **MILTANK's own shipped indifference zone is 3.75 points** — `tieBand = 1.5 × se(n=400)` at
> p=0.5, `engine/miltank.js:1349-1352`. The player already declares, in code, that a gap below that
> is not worth acting on.

That anchor is honest and it is weak: nobody measured it, it is a fallback rule rather than a
requirement, and §4b below shows it is not even self-consistent.

**MARKED ASSUMED, EVERY ONE:** δ; PCS\*; the least-favourable configuration; p=0.5; independence of
estimates across candidates; and that a leaf estimate is Bernoulli (13.8% of samples are not).

---

## 4. WHERE DOES THE SHIPPED BUDGET LAND?

### 4a. The shipped picker is running at 48% of its own specification

Read from `engine/miltank.js` (specification), costed at the measured 175 playouts/sec, at the
corpus-median 64-cell menu the file's own comment names:

```
SCREEN_N = max(12, round(200/3))                = 67
screenN  = max(8, min(67, round(67 * 60 / 64))) = 63
screen   = 64 cells × 63 playouts               = 4,032 playouts = 23.1 s
finals   = 8 × 400 playouts                     = 3,200 playouts = 18.3 s
                                          TOTAL = 7,232 playouts = 41.4 s
20,000 ms delivers                              = 3,496 playouts = 20.0 s   (48.3%)
```

Three consequences, all derived, none requiring a game:

- **The finalist round alone is 18.3 s — 92% of the whole budget** before a single cell is screened.
  The shipped budget is very nearly *one finalist round and nothing else*.
- **`SCREEN_BUDGET` = 40% of 20 s = 8 s = 1,398 playouts = 22 of 64 cells.** The remaining 42 cells
  hit `if (Date.now() - tStart > SCREEN_BUDGET) { screenCut++; continue; }` and are **never
  evaluated**.
- **The screen loop is `for (const ia of oa) for (const ib of ob)` — menu order, not quality order.**
  So the truncation is *systematic*, not random: slot-0 candidates roughly 4 through 8 are cut
  entirely, whatever they are. This is the same failure the 40/60 split was introduced to fix
  (`docs/SEARCH.md` quotes the live log: `72 opts, 20873ms, finals 1/8` — *"Fake Out was on the menu
  and was never compared to anything"*). The split reduced it; the arithmetic says it did not
  remove it.

**P(the search picks the truly-best cell), 64-cell menu, least-favourable configuration:**

| true gap δ | A: shipped spec, unbounded budget | B: shipped, under the real 20 s | C: `mew.js` H2H defaults (n=60) |
|---|---|---|---|
| 2.0 pt | 0.065 | 0.049 | 0.036 |
| **3.75 pt** (its own tie band) | **0.158** | **0.097** | **0.067** |
| 5.0 pt | 0.252 | 0.138 | 0.098 |
| 10.0 pt | 0.648 | 0.268 | 0.293 |
| 15.0 pt | 0.882 | 0.325 | 0.523 |
| 20.0 pt | 0.975 | **0.343** | 0.707 |
| *chance (1/64)* | *0.016* | *0.016* | *0.016* |

**Column B saturates at ~0.34 and no gap size beats it**, because 65% of the menu is never looked
at. A cell that is 20 points better than everything else is found about a third of the time.

The least-favourable configuration is deliberately pessimistic — real menus contain many cells that
are obviously bad and easy to reject. The optimistic bound, **K_eff = 8 genuine contenders reaching
the finals at n=400**: δ=3.75 → 0.553, δ=5 → 0.711, δ=10 → 0.986, against chance 0.125. **PCS 0.90
arrives at δ ≈ 7.2 pt.** The truth lies between the two columns and **nothing in the repository
measures where** — that is R5, unrun.

### 4b. FILED, NOT FIXED — two defects in `engine/miltank.js`

MILTANK is Will's file and is under overhaul. These are observations with locations, not patches.

**(i) The late UNDECIDED test is calibrated against the wrong statistic, and defers ~3.5% of the
time it should defer 100%.**

`engine/miltank.js:1345-1355` compares the **range over the finalists** to a band built from the
**single-arm SE**:

```js
const spread   = Math.max(...fv) - Math.min(...fv);
const se       = Math.sqrt(Math.max(bestVal * (1 - bestVal), 0.0025) / (ROLLOUT_N * 2));
const tieBand  = ceiling ? Math.max(1.5 * se, 0.05) : 1.5 * se;
if (DEFER && fv.length > 1 && spread < tieBand) { /* defer to MAG */ }
```

Under a pure null — all finalists truly equal — the range of K iid estimates has mean ≈ 2.847σ at
K=8 (the standard d₂ constant; reproduced numerically here). Computing the range CDF:

| K finalists | E[range]/σ | **P(range < 1.5σ) = P(this rule fires)** |
|---|---|---|
| 2 | 1.128 | 0.711 |
| 3 | 1.693 | 0.461 |
| 5 | 2.326 | 0.173 |
| **8** | **2.847** | **0.035** |

**At the shipped `FINAL_K = 8`, a genuine 8-way tie is declared RESOLVED 96.5% of the time**, and
the argmax over pure dice is clicked.

The file already contains the correct constant, forty lines above, in the **early**-defer estimator
(`:1286`, `:1302`): *"K estimates of ONE true value span roughly 2.8 sigma, so subtract that
expected pure-dice range from the observed screen spread."* **The early rule uses 2.8σ; the late
rule uses 1.5σ on the same statistic.** They are inconsistent with each other, and the late one is
the one that always runs (`EARLY_DEFER` is default OFF).

This is a *specification* finding, derived from the code and standard order statistics. It does not
depend on any withheld artifact.

**(ii) The move picker is the one MILTANK search that does NOT use common random numbers — and the
file documents twice why that is wrong.**

| search | seed | CRN? |
|---|---|---|
| team preview | `previewSeed` (`:748`, `:759`) | **yes** |
| post-KO replacement | `replSeed` (`:878`) | **yes** |
| **in-game move picker** | `seed: (Date.now() & 0xffff) * 7919 + ia * 31 + ib + salt` (**`:1234`**) | **no — `ia` and `ib` are mixed in, so every candidate gets independent dice** |

The two comments that fixed the other two say exactly what the third is still doing:

> `:864-877` — *"The seed used to vary per candidate, so the difference between two replacements was
> buried in independent noise — and the replacement search then deferred to MAG on EVERY decision of
> a live game… Five of five, so the post-KO search I built was never once used… Sharing the seed
> cancels the variance the candidates have in common (the same opponent draws, the same crit rolls)…
> Standard variance reduction, and free."*

Under CRN, `Var(X₁ − X₂) = 2σ²(1 − ρ)`, so the required n scales by (1 − ρ): ρ=0.5 halves it, ρ=0.75
quarters it. **ρ for the move picker is UNMEASURED** — but every number in §3.3 and §4a divides by
(1 − ρ), which puts this lever in the same size class as the parallelism the box will not give.

**(iii) Not a defect, but a fitting/playing mismatch worth a row.** The live bot and the harness that
measures it are different players:

| | `mag_bot.js` (live) | `mew.js` (every H2H) |
|---|---|---|
| `n` | 200 (`:144`) | **60** (`:185`) |
| `turns` | **60** (`:154`) | census-derived **14** |
| `previewN` / `previewMs` | `PREVIEW_N` / `PREVIEW_MS` | **12** / **4000** (hardcoded, `:551`) |
| `budgetMs` | 20000 (default) | 20000 (not passed) |

An H2H therefore measures a player with **1/3 the samples and 1/4 the horizon** of the one that
plays. CLAUDE.md's own rule: *"Fitting environment and playing environment must match."*
`mew.js` exposes no `--miltank-budget-ms`, no `--miltank-turns` and no `--miltank-explore`.

### 4c. The levers, ranked by what they buy per unit of risk

| rank | lever | what it buys | risk | evidence status |
|---|---|---|---|---|
| **1** | **Common random numbers in the move picker** (§4b ii) | divides every requirement by (1 − ρ); 2x at ρ=0.5, 4x at ρ=0.75 | **near zero** — same change already made twice in the same file, both times with a documented before/after | ρ is unmeasured; the mechanism is not in doubt |
| **2** | **Make the engine faster** (ROADMAP #130) | multiplies every row of §3.3 directly, changes nothing the search believes | **zero decision risk**, real correctness risk that #130 already gates three ways | The Showdown dex is 386 of 475 ms startup and 71 of 132 MB working set — MEASURED, and MEASURE's own hypothesis for why parallelism is dead |
| **3** | **Fix the tie band to 2.8σ** (§4b i) | does not buy compute; buys *honesty* — the search stops committing to dice and hands ~96% of true ties back to MAG | changes what is clicked on every near-tie turn, so it needs its own SPRT arm | derived here; the correct constant is already in the file |
| **4** | **Narrow the candidate set** | the biggest raw win: 64→16 cells is 5.5x at δ=5 pt (89,920 → 16,416 playouts) | **the only lever whose cost is already quantified, and it is large.** `miltank.js:1074-1077`: at K=3 per slot the pair a human clicked falls outside the window **52%** of the time | that 52% is a CODE-STATED figure from `engine/truncation_curve.js`; I did not re-derive it — see OWED |
| **5** | **Shorten the horizon** | almost nothing. cap 6 is 4.17 ms/playout against cap 14's 5.17 — **1.24x** — and ms/turn gets *worse* (0.703 vs 0.512) because turn 1 is expensive and leaf seeding (0.55 ms, 9.7%) is flat in the horizon | severe: cap 6 truncates **94.2%** of playouts, so the leaf becomes an HP-material counter | all MEASURED |
| **6** | **More processes** | **1.31x at 8 workers**, against a CPU-bound control at 6.61x on the same box | none | MEASURED, and it is dead |
| **—** | **A better-than-uniform playout policy** | **not a compute lever and must not be sold as one.** It changes the estimand, not the estimator's noise. A lower-variance playout carries *less* information per sample, which is settled here and in the literature | — | this is what `--miltank-foe prior` is for |

### 4d. The binding constraint is the BANK, and it sits almost exactly on the friendly requirement

The per-turn wall is 55 s, so `budgetMs` could in principle rise from 20 s to ~40 s. But the bank is
420 s for the whole game, and a real game costs on the order of 10 requests:

```
420 s bank / ~10 requests  ≈  42 s per decision — the absolute ceiling
friendliest defensible requirement (δ=5 pt, K_eff=8, PCS 0.90)  ≈  38 s
```

**They coincide within 10%.** So the honest compute statement is:

> **Even spending the entire game bank on every decision, MILTANK reaches 90% selection accuracy only
> in the friendliest case — 8 genuine contenders and a 5-point true gap — with no headroom at all.
> Every conservative assumption (a wider live menu, a smaller gap, a higher confidence target,
> truncated playouts, an uncalibrated leaf) breaks it.**

**MARKED ASSUMED: ~10 requests per game.** Its source (`data/miltank-timing-r6.json`) has no
traceable generator and is `PRE-CHANGE`; re-deriving it from the store is one command and is in
OWED. The conclusion is not sensitive to it — at 15 requests the ceiling falls to 28 s and the gap
opens rather than closes.

---

## 5. THE EMPIRICAL VERSION: WHAT RUN WOULD ANSWER IT, AND WHAT IT COSTS

**NOT LAUNCHED. NOT PREPARED FOR LAUNCH.** The arithmetic below is the reason: this run is
substantially larger than the division's rule of thumb, and Will should see the size before anyone
proposes a command.

### The run

A paired SPRT H2H through `engine/mew.js`. Arm 1 (challenger) MILTANK, arm 2 MAG at
`data/policy-weights.json`, on a **freshly cut named release** — the tree has 27 uncommitted files
and even the 10:15 release today reads *"1 of 26 files have moved since"*.

### Its size, at `sprt.js` defaults

H0: p=0.50, H1: p=0.55, α=β=0.05. Wald boundaries A = −B = ln(0.95/0.05) = 2.944.
Per decisive pair, z = ln(0.55/0.50) = +0.0953 on a win, ln(0.45/0.50) = −0.1054 on a loss.

```
E[N | H0] = [(1−α)B + αA] / E[z|H0] = (−2.650) / (−0.005025) ≈ 527 decisive pairs
E[N | H1] = [βB + (1−β)A] / E[z|H1] = ( 2.650) / ( 0.005009) ≈ 529 decisive pairs
```

**~530 decisive pairs.** A pair is 2 games and 1-1 splits are discarded, so at an (unmeasured) tie
rate of ~50% that is **~1,100 pairs ≈ 2,200 games.**

**`docs/SEARCH.md`'s "roughly 420 games" is an early-crossing figure for a large effect and should
not be used to plan this run.** Stating that plainly because the brief quotes it as the sizing rule.

### Its wall-clock, at the measured throughput

| | per decision | per game (~10 decisions + preview) | 2,200 games |
|---|---|---|---|
| at `mew.js` defaults (n=60, turns=14): 2,176 playouts = 12.4 s | 12.4 s | ~128 s | **~78 h** |
| at the LIVE player (n=200, turns=60, budget-truncated at 20 s) | 20.0 s | ~204 s | **~125 h** |

Only the MILTANK arm pays this; MAG's side is effectively free. **And parallelism is measured dead
at 1.31x for 8 workers**, so 6 shards buy roughly 1.3x, not 6x: **~60 h wall at harness defaults,
~96 h at live settings.**

**This is the finding that should reach Will before any command does.** The H2H that answers his
question is a multi-day run at the current engine speed, on a box where sharding does not help.

### Four ways to make it affordable, in order of preference

1. **Run it on R5's disagreement set, not on random games.** `docs/SEARCH.md:3502` already specifies
   this: *"the disagreement set is the sample the H2H should then run on — those positions and only
   those are where the two players differ, which is a far cheaper and far sharper H2H."* R5 itself is
   ~1.3–5.0 h and is the correct next run.
2. **Raise `--p1` to 0.60.** E[N] falls from ~530 to ~130 decisive pairs — a 4x cut. Legitimate: it
   states a larger minimum effect worth shipping, which is a decision, not a shortcut.
3. **Land CRN first (§4b ii).** If ρ is even 0.5, the challenger arm is a materially stronger player
   for the same cost, which raises the effect size and shortens the SPRT.
4. **Do the engine-speed pass first (ROADMAP #130).** Every hour above scales inversely with it.

### What it must pin (three things, not one)

`--release <fresh id>`, `--team-store data/team-pool-frozen`, and the census digest. Plus every arm's
flags recorded **in the run**, and the flag defaults corrected first, or the run measures a player
that does not ship (§4b iii).

---

## 6. THE THING THAT LIMITS ALL OF THIS AND IS NOT SEARCH'S BUG

Every number in §3 and §4 is about **whether the search can find the argmax of the leaf**. None of
them is about whether the argmax of the leaf is the right click. Leaf calibration is **WITHHELD**
(`data/winrate-backtest.json` UNSAFE) and it belongs to MEASURE.

So a compute bar met in full still buys nothing if δ — the true gap the leaf reports — is not the
true gap in the game. **Stating it here rather than at the end of a null run**, which is what
`docs/SEARCH.md` open item 4 asks for: *"If the leaf is uncalibrated, a better search is a
better-aimed error."*

---

## 7. WHAT I OBSERVED AND DID NOT TOUCH

- `engine/bench_speed.js` — **new and uncommitted**, MEASURE's, live this session. Left alone.
- `data/_bench-*.json` (5 files) and `data/_scratch-bench-smoke.json` — MEASURE's working output.
  Reported, left in place, nothing deleted.
- I started one process of my own, `node -e` **PID 3140** at 19:05:03, an over-sized numeric
  integration. It exceeded its tool timeout and ran in the background beside MEASURE's benchmark.
  **I attempted to terminate it by PID twice (`Stop-Process -Id 3140`, `taskkill /PID 3140`) and both
  were denied by the permission system.** It completed on its own at ~19:12 with correct output.
  **Flagging it because MEASURE's scaling arm was running concurrently and this process took a core
  at normal priority for ~7 minutes.** If MEASURE's scaling leg overlapped that window, it was
  contended and should be re-read.

---

## OWED, NOT RUN

Exact commands. **None of these were run.** Nothing above depends on them, and none of them may be
launched without Will's say-so.

**1. Cut a fresh release before anything else.** Every SEARCH run below is void without it; the tree
has 27 uncommitted files.

```bash
node engine/engine_release.js cut "search viability baseline — post-MEDICHAM-gate"
node engine/engine_release.js list | head -3      # take the id it prints
```

**2. Re-derive the 52% truncation cost, because lever #4 is ranked on it and I did not re-run it.**
Pure store analysis, plays no game.

```bash
tools\lownode.cmd engine\truncation_curve.js
```

**3. Re-derive requests-per-game from the store, because `data/miltank-timing-r6.json` has no
traceable generator.** Plays no game.

```bash
tools\lownode.cmd engine\miltank.js --horizon data/games.bo3.jsonl
```

**4. R5 — the action-ranking backtest. THE MEASUREMENT THAT MAKES δ REAL.** This is the run that
converts every "ASSUMED" in §3.4 into a measured distribution, and its disagreement set is the
cheap H2H sample. Spec at `docs/SEARCH.md:3502`. Four shards, ~1.3–5.0 h.

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  SHARD=<0..3> SHARDS=4 N_DECISIONS=500 ROLLOUT_N=200 EXPLORE=1.0 MAXTURNS=60 \
  node --max-old-space-size=4096 engine/rollout_r5.js --out data/.r5-shards/r5-s<0..3>.jsonl
# then, once, at the end:
cat data/.r5-shards/r5-s*.jsonl > data/.r5-all.jsonl
```

**5. Regenerate the four withheld SEARCH gates so the accuracy bar becomes readable again.** In this
order; each is what `status.js` names as its own unblocking command.

```bash
tools\lownode.cmd engine\rollout_r2.js            # leaf cost — re-run FIRST; §3.0 says every
                                                  # affordability claim in SEARCH.md rests on it
tools\lownode.cmd engine\rollout_r1_artifact.js   # leaf accuracy — the R1 gate
tools\lownode.cmd engine\rollout_r3.js            # divergence
tools\lownode.cmd engine\rollout_r4.js            # does it win
```

**6. Measure ρ, the CRN correlation in the move picker.** This is the input that decides whether
lever #1 is worth 2x or 4x. There is no instrument for it; it needs one — score the same candidate
pair twice at a shared seed and twice at independent seeds over ~200 corpus boards and report the
correlation of the differences. **NOT IMPLEMENTED.**

**7. The H2H itself — DO NOT PREPARE A COMMAND UNTIL §5 IS AGREED.** At current engine speed it is
~60–96 h wall with sharding. Read it once, at the bound:

```bash
cat data/.mew-shards/*.jsonl > data/games.h2h-miltank-vs-mag.jsonl
node engine/sprt.js data/games.h2h-miltank-vs-mag.jsonl --p1 0.60
```

---

## Register

Nothing here closes a register row. **Four rows are owed and none exists:**

- the late UNDECIDED tie band is calibrated against the single-arm SE, not the range over K
  (`engine/miltank.js:1345-1355`) — SEARCH;
- the in-game move picker does not use common random numbers, while preview and post-KO do
  (`engine/miltank.js:1234`) — SEARCH;
- `mew.js` measures a player with 1/3 the samples and 1/4 the horizon of the live bot, and exposes
  no `--miltank-budget-ms` / `--miltank-turns` / `--miltank-explore` — MEASURE owns `mew.js`;
- **no compute or decision-resolution bar is declared for search anywhere** — this report is the
  argument that (δ\*, PCS\*, K) should be declared, and Will declares it, not an agent.
