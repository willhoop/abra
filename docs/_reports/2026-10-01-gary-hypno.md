# GARY v1 (the population habit model) and HYPNO v1 (the population best response) — 2026-10-01 (abra/regmc 1.71.0)

SOLVER, milestones N1 and N2 of `solver/PLAN.md` 0.3.0. Historical findings record, not maintained. Store-only for
GARY (no simulator, no game). HYPNO's offline check reads a FINISHED run's recorded roots; nothing was searched,
stepped or played for a measurement. Pre-registration: `solver/gary/preregistration.json` (written before the first
fit on the re-parsed data). Artifacts: `solver/gary/model/gary-v1*.json`.

## Verdict

- **GARY v1 beats DODUO v1 on held-out players, and 27 of its 48 (bucket × band) cells pass the gate.** Held-out
  log-loss 2.7148 against DODUO v1's 2.7359: Δ **−0.0211 [−0.0238, −0.0184]** nats, 37,576 TEST-player decisions in
  7,452 games. Every band passes on its own. The τ\* clause passes everywhere (GARY −2.67 against τ\* −6.46 mean log-p
  on the 579 recorded roots), so the verdict is the DODUO clause's. 21 cells fail and play equilibrium (p = 0); `single`
  fails in 5 of 6 bands and is worse than DODUO in two of them. 16 cells would survive a Bonferroni correction.
- **Most of the gain is a recalibration of DODUO, not a habit of a band.** A global-only tilt takes 0.0190 of the
  0.0211; the bucket and band levels add **−0.0020 [−0.0029, −0.0013]**. DODUO is over-confident on these newer games
  (scale −0.14) and under-predicts double Protect, switches, spread, status and priority moves; it over-predicts a
  repeat Protect. The bands' tilts differ from each other by less than 0.1 logit.
- **The in-series update predicts games 2-3 better, by a hair: ENABLED.** A per-opponent deviation from game 1 (σ 0.1,
  no decay) improves the held-out games 2-3 by **−0.0018 [−0.0026, −0.0011]** nats over 2,774 series.
- **HYPNO's offline gain is not shown.** On the search's own 579 recorded tables it deviates on 131 (22.6%) and
  predicts +1.26 points of win probability per decision. Against what the human actually clicked (308 covered roots) the
  raw gain is +0.59 [+0.02, +1.19] points, but **0.47 of that is selection bias** (the response is picked on the same
  noisy cells it is scored on); debiased **+0.13 [−0.48, +0.73]**. Against the table's equilibrium opponent it costs
  **−0.32 [−0.59, −0.12]** points per decision. Report-only: the ε-safe variant (ε 1 point) debiases to +0.26
  [+0.00, +0.60] at −0.02 against equilibrium.
- **HYPNO is wired into SLOWKING's solve beside piKL behind spec `hypno`, off by default, with counters; ROTOM carries
  the opponent's rating band and the in-series memory.** Tests GREEN with every deliberate break RED. The 2 s
  not-lose screen against gen5 is pre-registered and NOT RUN (command under *OWED, NOT RUN*).

## 1. Data: the re-parsed store, rebuilt

The store re-parse with the fixed set-attribution extractor landed on main as abra/regmc 1.70.0 (`7f86daf4`). This
branch was fast-forwarded to it before any fit, and the human dataset was rebuilt from it:

| | |
|---|---|
| builder | `solver/human/build_dataset.js --out solver/out/human-20261001` (store-only, BelowNormal, 217 s) |
| read | 570 raw shards, 42,888 rows (bo3 and the bo1 open-sheet turn-play rooms, `engine/quality.js` `isOpenSheetTurnPlay`) |
| kept | **41,138 games**: 39,412 open-sheet bo3 + 1,726 bo1 turn-play-only; 9,672 accounts; 288,381 turns |
| own accounts | 160 games excluded (`own_account`, `data/quality-filter.json` via `engine/quality.js` `isOwnAccount`) |
| output | `games.jsonl` 774,948,488 bytes, sha256 `b36bd0fed69b946b…` (untracked, `solver/out/`) |
| cross-check | durable-ingest `extract()` agrees on leads and brings in 41,138 of 41,138 |

**Rows** (`solver/gary/extract.js`, manifest `solver/out/gary/regmc-20261001/manifest.json`): one per side-turn
decision whose joint is fully observed (`jointStatus` 'exact'), DODUO v1's log-probability of every valid joint cell, the
cells' class masks and the human's cell. **SKIPPED** = a train player's decision in a game DODUO v1 was trained on
(the 2026-09-23 dataset, sha256 `9d07c522…`): 298,226. **FIT** = 150,030 rows (val players, and train players' games
after 2026-09-23). **EVAL** = 37,576 rows, every TEST player (`sha256("abra-prior-v0:"+player) mod 100 >= 90`): neither
DODUO nor GARY ever fitted them. Not 'exact': hidden 69,355, uncertain target 21,398, outside 114, all locked 63.
Faint replacements are a separate decision and are not rows. DODUO v1's own top-1 on EVAL is **0.2517** (its published
TEST figure was 25.4% on the 2026-09-23 test games; this EVAL adds the later games).

**A correction to the brief's baseline.** The N1 row cites "DODUO v1 (held-out top-1 0.230, `…human-regularised-search.md`)".
That 0.230 is **gen5's** self-play DODUO over all legal joints on the 579 roots, not DODUO v1. DODUO v1, the human-fitted
model, is the baseline here (0.2517 top-1 on EVAL; on the roots its mean log-p of the human joint is −2.686 against gen5's
−2.742).

## 2. GARY's design, and why

**Form.** `s_k = (1 + a)·lp_k + θ·bits_k`, `p = softmax(s)` over DODUO v1's valid cells, where `lp` is DODUO v1's
log-probability and `bits` are 14 joint-action classes (`solver/gary/situation.js`: any / double stall, any / double
switch, mega, both slots on one foe, spread, a non-stall status move, an ally target, a repeated Protect, priority, a
repeated move, a move into an immunity, a super-effective attack). `(a, θ)` is the sum of four levels — global, bucket,
band, cell — each L2-penalised toward zero, fitted by Newton on the exact Hessian (945 parameters). λ for the three lower
levels by 5-fold player CV on FIT: {3, 10, 30, 100, 300, 1000} → 2.71478, 2.71429, 2.71376, 2.71327, **2.71310**, 2.71331;
**λ = 300**.

**Why a tilt of DODUO and not a counted table per bucket.** A joint action is species-specific (it names the moves on
this sheet), so a bucket's raw click counts cannot transfer between teams; DODUO v1 already models the full public state
and the sheet. What it does not have is a rating input or any notion of who is playing. A low-dimensional tilt per
(situation, band) is exactly "how this population departs from the average human DODUO learned", it nests DODUO
(`a = θ = 0`), so the gate against DODUO asks precisely whether that departure is real, and it is small enough to fit and
to gate per cell.

**Why buckets for the context of the tilt, not a learned context.** The bucket is the unit of HYPNO's trust decision:
each cell is either exploited (p = 1) or played at equilibrium (p = 0), and that verdict needs a named, auditable set of
situations with enough held-out decisions to put a CI on. The eight buckets are the situations where human play changes
shape (the lead turn, a one-slot board, material ahead / even / behind, with and without Trick Room or a Tailwind up);
they were fixed in the pre-registration before any fit. The bands are the bo3 ladder's rating at game start (< 1100,
1100–1199, 1200–1299, ≥ 1300; 1400+ held 284 of 53,776 player-games in the 2026-09-23 data, so it is pooled), `unrated`,
and `bo1` (a bo1-format game's rating is a different ladder's).

## 3. GARY's results

**Overall and by band, EVAL rows** (`solver/gary/model/gary-v1.fit-metrics.json`; Δ = GARY − DODUO, nats; 95% CI by
bootstrap over games):

| | n | games | GARY | DODUO v1 | Δ [95% CI] | GARY top-1 |
|---|---|---|---|---|---|---|
| **all** | 37,576 | 7,452 | 2.7148 | 2.7359 | **−0.0211 [−0.0238, −0.0184]** | 0.253 (DODUO 0.252) |
| < 1100 | 12,625 | 2,627 | 2.7595 | 2.7860 | −0.0266 [−0.0333, −0.0209] | 0.246 |
| 1100 | 12,610 | 2,576 | 2.6782 | 2.6937 | −0.0156 [−0.0192, −0.0117] | 0.260 |
| 1200 | 4,709 | 969 | 2.6910 | 2.7071 | −0.0162 [−0.0218, −0.0105] | 0.249 |
| 1300+ | 2,133 | 401 | 2.8210 | 2.8540 | −0.0329 [−0.0430, −0.0235] | 0.237 |
| unrated | 3,437 | 651 | 2.6703 | 2.6931 | −0.0228 [−0.0319, −0.0139] | 0.262 |
| bo1 | 2,062 | 388 | 2.6841 | 2.7020 | −0.0179 [−0.0308, −0.0058] | 0.264 |

**By bucket:** lead −0.0181 [−0.0234, −0.0131]; **single −0.0059 [−0.0157, +0.0037] (fails)**; even −0.0200; even_sc
−0.0266; ahead −0.0192; ahead_sc −0.0245; behind −0.0281; behind_sc −0.0314 (all others' CIs clear zero).

**The 48 cells and their verdicts** (DODUO clause on EVAL; τ\* clause on the roots, every cell PASS — see below).
p = 1 (27): lead|<1100, lead|1100, lead|1300+, lead|bo1, single|<1100, even|<1100, even|1100, even|1200, even|1300+,
even|unrated, even_sc|<1100, even_sc|1100, even_sc|1200, even_sc|unrated, ahead|<1100, ahead|1100, ahead_sc|<1100,
ahead_sc|unrated, behind|<1100, behind|1100, behind|1200, behind|1300+, behind|unrated, behind|bo1, behind_sc|<1100,
behind_sc|1100, behind_sc|1200. **p = 0 (21):** lead|1200 (+0.0012 [−0.0132, +0.0155]), lead|unrated, single|1100,
single|1200, single|1300+, **single|unrated (+0.0235 [+0.0001, +0.0464]: GARY is worse)**, **single|bo1 (+0.0359
[+0.0012, +0.0666]: worse)**, even|bo1, even_sc|1300+, even_sc|bo1, ahead|1200, ahead|1300+, ahead|unrated, ahead|bo1,
ahead_sc|1100, ahead_sc|1200, ahead_sc|1300+, ahead_sc|bo1, behind_sc|1300+, behind_sc|unrated, behind_sc|bo1. Every
cell's n, Δ and CI: `gary-v1.fit-metrics.json` `cells`. Bonferroni over 48 (approximate, by widening each CI): 16 pass.

**At medicham32's band (1200, its last recorded series sat at 1269–1292):** even, even_sc, behind and behind_sc pass;
lead, single, ahead and ahead_sc play equilibrium.

**τ\* clause** (`gary-v1.gate-metrics.json`). On the 579 recorded roots (TEST players, gen5's search at 16 passes,
release `eaa5becc54eb`; byte-identical copy tracked in `solver/results/2026-10-01-gary-hypno/roots-human-s1/`), every
root's human key was rebuilt from the dataset's own action (579 of 579) and the human's row maps to DODUO's label cell
(308 of 308 covered). Mean log p of the human joint: GARY −2.665, DODUO v1 −2.686, gen5's DODUO −2.742, **τ\* −6.459**
(floored 1e-4; τ\* is the equilibrium row mix, 0 outside the four rows). Global Δ −3.79 [−4.06, −3.52]; every bucket's
pooled CI clears zero (the smallest, behind_sc, n 29: −2.63 [−3.93, −1.37]). The 11 cells with ≥ 20 roots of their own
all clear zero. **So the τ\* clause never binds; τ\* is not a competitive predictor of human clicks.**

**Ablation, report-only (not pre-registered).** The same fit with every level below global frozen at zero: EVAL 2.71686.
So DODUO → global tilt is −0.0190, and global → full GARY is **−0.0020 [−0.0029, −0.0013]**: < 1100 −0.0028, 1100
−0.0020, 1200 −0.0019 [−0.0041, +0.0003], 1300+ −0.0048, unrated +0.0000, bo1 +0.0015. The population-by-band signal is
real and small; most of what GARY knows that DODUO does not is a correction of DODUO on games it never saw.

**What the population does, against DODUO** (global level, logits per class): scale −0.15 (DODUO over-confident);
double stall +0.41, any switch +0.23, double switch +0.15, spread +0.26, status +0.18, priority +0.17, super-effective
+0.06; a **repeated Protect −0.20**; mega −0.07. The bands move these by ≲ 0.1 (e.g. < 1100: super-effective +0.17;
1300+: both-on-one-foe +0.11, priority +0.09).

## 4. The in-series update (`solver/gary/eval_series.js`, `gary-v1.series-metrics.json`)

A series is (bo3 series id, player): 16,210, of which 12,727 have ≥ 2 games. For game g ≥ 2, the opponent's decisions in
earlier games give a MAP deviation δ (15 numbers) under N(0, σ²I), older games weighted γ per game back
(`solver/hypno/series.js`). Grid on FIT series (68,350 later-game decisions): σ 0.05/0.1/0.2/0.4/0.8 × γ 0.5/1 →
best **σ 0.1, γ 1** (−0.00211; σ ≥ 0.4 hurts: +0.016, +0.21). **EVAL: −0.00184 [−0.00260, −0.00109] over 2,774 series,
18,532 decisions → ENABLED.** Game 2 −0.0015 [−0.0023, −0.0007], game 3 −0.0026 [−0.0042, −0.0009]. Real, and about
a tenth of the population model's own gain; no decay was preferred (γ 1 over 0.5).

The research's second posterior, `w` = P(follows GARY) against "plays the table's equilibrium", has its prior fitted on
the roots: **w0 = 0.931** (the maximum-likelihood mixture of GARY and τ\*). Its update needs the live search's table at
every opponent decision, so it is implemented and unit-tested but has no offline test, and ROTOM does not feed it yet:
in play w stays w0.

## 5. HYPNO v1, and the safety bound under the one-off premise

**The rule** (`solver/hypno/hypno.js` `respond`), at each root after SLOWKING's solve (plain or piKL):
1. GARY's cell failed its gate → σ\* (`untrusted`).
2. GARY's mass on the table's opponent columns < 0.25 of its total → σ\* (`coverage`): the table cannot price the rest.
3. `h_eff = w·h + (1−w)·y*` with h = GARY renormalised over the columns (the DBBR form: a deviation from equilibrium,
   weighted by belief); BR = argmax_i (A·h_eff)_i.
4. Predicted gain `(A h_eff)_BR − x*·A·h_eff` ≤ 1 × its standard error (each cell's variance bounded by A(1−A)/n, cells
   independent) → σ\* (`belowSE`). Else play the pure best response (or, with `eps`, the ε-safe point on the σ\* → BR
   segment).

**Re-deriving the bound.** At a root, our table A, our equilibrium x\* with value v\*. A one-off stranger (Will:
*"its a bo3 series once"*) does not know our x when they choose, so their action q is not a function of it; drawn from the
population at their band, our expected payoff is E[x·A·q] = x·A·h_true, linear in the population mean. So:
- **The Bayes-optimal play is the best response to h_true**, and its edge over x\* is `Δ_true = max_i (A h_true)_i −
  x*·A·h_true ≥ 0`. The worst-case cost `v* − min_j (x_BR·A)_j` that McCracken & Bowling's ε-safety (2004) and
  Ganzfried & Sandholm's safe exploitation (EC 2012; TEAC 2015) guard against is the loss to an opponent who **best-
  responds to x_BR**; that needs them to know x_BR, which a stranger in a one-off does not. In a single interaction
  Ganzfried–Sandholm safety permits no deviation beyond the "gifts" already received, which is the right criterion
  against an adaptive adversary and the wrong one here. The Bayesian criterion (Ganzfried & Sun 2016, Bayesian
  opponent exploitation) is the right one.
- **What remains is model error and table error.** With h in place of h_true:
  `(e_BR − x*)·A·h_true = Δ_pred − (e_BR − x*)·A·(h − h_true) ≥ Δ_pred − ‖(e_BR − x*)·A‖_∞ · ‖h − h_true‖₁`.
  The deviation pays in expectation iff the predicted gain exceeds the model's error on the columns times the table's
  spread. ‖h − h_true‖₁ is not observable per decision, so it is bounded empirically, as DBR (Johanson & Bowling 2009)
  bounds trust by data: the **cell gate** admits only cells where h is closer to the truth (held-out log-loss) than
  DODUO and τ\*; the **realised gain on held-out humans** (§6) measures E[(e_BR − x*)·A·q] including the model error.
  Table error (16-25 playouts a cell) inflates Δ_pred by a winner's curse; the **SE gate** is the guard and §6 measures
  the bias directly.
- **Why some cap remains, and which.** (i) In games 2–3 the opponent has seen game 1; a pure best response that repeats
  in a recognisable situation can be countered. That exposure is the worst-case cost above, but only to the extent a
  human adapts inside a bo3 (the 2026-09-23 report's own conclusion). (ii) Our account's replays are public, so a
  stranger could in principle study us; not modelled. (iii) The columns hold the ladder opponent's actual joint only
  57.7% of the time (1.52.0), so h is renormalised over a partial set: the coverage guard. The default therefore carries
  **no ε cap**, the three gates above, and the ε-safe segment as an A/B option (RNR-style dial, Johanson, Zinkevich &
  Bowling 2007). The 2 s screen against gen5 (§8) measures the cost when the opponent is not the population.

**Wiring.** Spec extra `hypno` (`solver/mew/agent.js` `SEARCH_EXTRAS`) → `solver/miltank/search.js`: at candidate time
`solver/hypno/live.js` scores every legal opponent joint with GARY through the same prior adapter DODUO uses, at the band
`spec.hypno.band`, else the opponent's rating (`oppRating`), else `unrated` (counted); after the solve, `respond`; the
same coin samples both mixes, so "pick changed" is paired. Counters: `hypnoDecisions`, `hypnoPlayed`, `hypnoUntrusted`,
`hypnoCoverage`, `hypnoBelowSE`, `hypnoNoGain`, `hypnoPickChanged`, `hypnoMass` (TV to σ\*), `hypnoWorst` /
`hypnoWorstMax` (the worst-case cost on the table), `hypnoGainPred`, `hypnoBandMissing`, `hypnoCells`,
`hypnoTrustedCells`; per agent in `COUNTERS.hypno[name]` and per match line in `ctr.hypno` (`solver/mew/play.js`).
**ROTOM:** `d.oppRating` from the `|player|` line; an arm may carry `"hypno": {...}`; at each game's end
`solver/rotom/policy.js` `observeGame` feeds the opponent's fully observed decisions into that bo3's series memory
(`solver/hypno/series_live.js`, the same `solver/gary/cells.js` the training rows came from), and games 2–3 read it.
No arm carries `hypno` and the default is off.

## 6. HYPNO's offline check (`solver/hypno/eval_offline.js`, `gary-v1.hypno-offline.json`)

The 579 roots, re-oriented so WE are the column side (our table `1 − Aᵀ`), the human the opponent, σ\* our plain solve
(solveRM 4,000 iterations, tol 1e-4, the search's own). Gains in win probability per decision; CIs by bootstrap over
games; "realised" only where the human's joint is a table row (308 roots, 298 games); selection bias by a parametric
bootstrap (200 noisy redraws of each table at A(1−A)/n per cell, the response re-made on the redraw and scored on it vs
on the recorded table).

| variant | deviates | predicted | realised (raw) | selection bias | **realised, debiased** | vs equilibrium opp. | worst case mean / max |
|---|---|---|---|---|---|---|---|
| **HYPNO as shipped** (gates, w0 0.931) | 131 / 579 | +0.0126 | +0.0059 [+0.0002, +0.0119] | 0.0047 | **+0.0013 [−0.0048, +0.0073]** | −0.0032 [−0.0059, −0.0012] | 0.0122 / 0.624 |
| same, w = 1 | 138 | +0.0144 | +0.0063 [+0.0005, +0.0123] | 0.0048 | +0.0015 [−0.0047, +0.0076] | −0.0037 | 0.0136 / 0.624 |
| GARY, every gate off | 496 | +0.0253 | +0.0137 [+0.0057, +0.0224] | 0.0088 | +0.0049 [−0.0033, +0.0136] | −0.0096 [−0.0135, −0.0063] | 0.0336 / 0.624 |
| DODUO v1 as the model (SE + coverage gates) | 156 | +0.0177 | +0.0073 [+0.0018, +0.0135] | 0.0062 | +0.0010 [−0.0050, +0.0075] | −0.0036 | 0.0135 / 0.624 |
| DODUO v1, every gate off | 496 | +0.0261 | +0.0133 [+0.0056, +0.0219] | 0.0087 | +0.0046 [−0.0033, +0.0135] | −0.0087 | 0.0323 / 0.624 |
| HYPNO, ε 0.01 (report-only) | 131 | +0.0044 | +0.0040 [+0.0015, +0.0074] | 0.0014 | +0.0026 [+0.0000, +0.0060] | −0.0002 | 0.0013 / 0.010 |

Refusals for HYPNO as shipped: belowSE 269, untrusted 97, noGain 57, coverage 25.

**Prediction, "how often does HYPNO's opponent model beat the alternatives":** over all cells, GARY gives the human's
actual joint a higher probability than τ\* on **427 of 579** roots (73.7%) and than DODUO v1 on **273 of 579** (47.2%;
it wins on mean log-p, −2.665 against −2.686, by being much better on fewer roots). Conditioned on the four table rows
(308 covered): above τ\* on 174, above DODUO on 128; mean log-p −1.185 / −1.188 / −4.039.

**Reading.**
- **No variant shows a gain once the winner's curse is removed**, except the ε 0.01 point, whose lower bound touches
  zero; it was one of six variants and is not the default, so it is a lead, not a finding. 308 covered roots cannot
  resolve a gain under one point; the preregistration said so before the run (no pass bar).
- The selection bias is **35–80% of the raw realised gain**: a best response computed on 16-playout cells mostly finds
  noise. The SE gate halves the bias's size and removes most of the deviations, and what is left is not distinguishable
  from zero.
- The cost against an equilibrium opponent is measurable (−0.32 points per decision for HYPNO; −0.96 for the raw best
  response). That is what the 2 s screen will see in games.
- GARY and DODUO v1 make almost the same deviations and the same money: the band-specific part of GARY (−0.002 nats)
  is too small to change a best response on a 4×4 table.

## 7. Tests

| test | result | deliberate breaks (each RED on the named clause) |
|---|---|---|
| `solver/tests/test-gary.js` (store-only: BAND, BUCKET, CLASS on 19,422 cells read independently from the keys and the dex, NEST, TILT, FIT recovery, GATE consistency, ROOTS) | **GREEN 78,432 / 78,432** | `GARY_BREAK=material` BUCKET; `focus` CLASS; `doduo` TILT; `gradsign` FIT |
| `solver/tests/test-hypno.js` (RULE: GATES, BR on 50 random tables, EPS, MIX; SERIES: DELTA, WPOST; SEARCH on release `df172ccd2aaf`: OFF, FIRES, PLAYS, UNTRUST, AGENT; SERIESLIVE through ROTOM's policy) | **GREEN 461 / 461** | `HYPNO_BREAK=nogate` GATES; `argmin` BR; `seriesleak` WPOST; `deltaoff` SERIESLIVE (and DELTA); `MILTANK_BREAK=hypnoignored` FIRES |

Regressions on the touched files, GREEN: `test-miltank-kl` 52/52 (`--no-red`), `test-machamp` 103/103 (`--no-red`,
release `df172ccd2aaf`), `test-col-coverage` 13/13, `test-rotom` 105/105, `test-rotom-ladder` 161/161. The refactor of
`extract.js` onto `solver/gary/cells.js` reproduces the full run's rows exactly (593 of 593 on a 400-game re-extract).

## 8. Pins, flags, and what was not touched

- Dataset `solver/out/human-20261001/games.jsonl` sha256 `b36bd0fe…`, built on `7f86daf4` (abra/regmc 1.70.0).
  DODUO v1 `solver/mag/model/doduo-v1.json` (sha256 stamped in the model). GARY model sha256 `66e2e51f…`.
- Roots: `solver/results/2026-10-01-gary-hypno/roots-human-s1/` (release `eaa5becc54eb`, dataset `9d07c522…`, 16 passes).
- Flags: extract `--workers 3`; fit `--folds 5 --grid 3,10,30,100,300,1000`; gate `MIN_N 20`, floor 1e-4; series grid as
  §4; offline `--debias 200`. Seeds: bootstrap 1, CV fold salt `gary-cv`.
- **No game was played.** The search ran only inside `test-hypno.js`'s 4 fixture positions (6 passes each) and
  `test-machamp`/`test-col-coverage`'s tiny fixture games. Every heavy step ran at BelowNormal; the worktree harness
  refused `cmd /c tools\lownode.cmd`, so the scripts lower their own priority (`os.setPriority`) as 1.34.0's did.
- No `engine/` file was touched. No engine bug was found.

## OWED, NOT RUN

1. **The 2 s not-lose screen, HYPNO vs the same agent at equilibrium** — pre-registered in
   `solver/results/2026-10-01-gary-hypno/screen-preregistration.json` (release `df172ccd2aaf`, seed 34001, 100 TEST
   pairs, 200 games, band 1200, read once by `read.js`). Run from the main checkout after merge, on a quiet machine:
   ```
   cmd.exe /c tools\lownode.cmd solver/machamp/gate.js --release df172ccd2aaf --x solver/results/2026-10-01-gary-hypno/screen-2s-hypno.json --y solver/results/2026-10-01-gary-hypno/screen-2s-plain.json --pairs 100 --pair-seed 1 --seed 34001 --workers 4 --cap 50 --rule notlose --info honest --spreads role-v1 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/screens/screen-hypno-2s.json
   node solver/results/2026-10-01-gary-hypno/read.js --result solver/out/screens/screen-hypno-2s.json --out solver/results/2026-10-01-gary-hypno/screen-hypno-2s.read.json
   ```
2. **The ladder A/B that counts** (PLAN N2: per-series seeded, an arm with `"hypno": { "model": "solver/gary/model/gary-v1.json" }`
   against the same arm without, residual `S − E` without forfeit wins, read once at a pre-registered bound). Needs the
   screen's PASS, its own pre-registration and Will's OK. Not prepared beyond the arm field.
3. **The `w` posterior in play.** `series.js` `observeTable` needs, at each opponent decision, our recorded table and their
   actual column; ROTOM records the table but nothing joins it to the next turn's action yet. Until then w = w0 = 0.931.
4. **HYPNO on the ladder's own tables** (the 636 chomp1 + gen5ab decisions with an observed opponent action,
   1.52.0): the opponent's `switch k` columns need ROTOM's world team order mapped to their sheet; not done, so the
   offline check is on human-vs-human roots only.
5. **More roots.** 308 covered decisions cannot resolve a sub-point gain. A larger recorded-root set (the same
   `eval_kl_human.js` at more decisions) is a search run, so it waits for a quiet machine.
6. `node engine/status.js --write` from the main checkout after the merge (not run from a worktree).
7. `docs/MODELS.md` and the white paper (next major): GARY v1 and HYPNO v1 rows; the τ\* clause never binds; most of GARY
   is a DODUO recalibration.
