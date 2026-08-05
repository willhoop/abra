# Thesis Defence Review — ABRA

**Date:** 2026-07-27 · **Verdict: MAJOR REVISIONS**

Every figure below was produced by running something on 2026-07-27. No number in this review was taken
from a document in this repository, because several are known stale — including, as it turns out, the
provenance block of the file whose stated purpose is to be the single answer to "which games did that
number come from".

---

## 1. The claim

The thesis asserts that a board-aware linear model of human move choice, fitted on open-team-sheet
replays, (a) predicts human clicks better than a behaviour clone, (b) plays better than its predecessor
and than random, and (c) that team-preview composition carries a small but real signal about who wins.

**This is a competent application of known methods to a new dataset. It is not a methodological
contribution, and the thesis must say so in those words.** Conditional logit on hand-designed features,
ridge-regularised plus-minus, NMF for soft clustering, and noisy-OR aggregation are all off-the-shelf.
What is new is the dataset and the domain encoding — the feature set for VGC doubles, the treatment of a
switch as a candidate competing with a move, the dead-move family. That is a legitimate contribution and
it is not nothing. It is also not novel method, and the documents currently blur the two by presenting
each borrowed technique with its sabermetrics or basketball provenance in a way that reads as inheriting
that literature's validation.

The strongest genuinely novel element is the treatment of **choice-set knowledge as the licensing
condition for the fit** — the argument that only open-sheet games let you condition on what the player
could have clicked. That is a real methodological point about replay data and it is under-sold relative
to the borrowed machinery.

---

## 2. The mathematics

### 2.1 The bootstrap is invalid, and a headline result reverses. This is the central finding.

`engine/chomp_ev.js` computes every confidence interval it publishes with a clustered bootstrap over
games. The generator driving it was:

```js
seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
```

That recurrence is correct in C, where the arithmetic is 32-bit. JavaScript has no integers: a mid-range
state times 1103515245 is about 1.4 × 10^18, past `Number.MAX_SAFE_INTEGER` (9.0 × 10^15). The product
loses its **low** bits to floating-point rounding, and the low bits are precisely what the mask and
`Math.floor(rnd() * n)` consume. Measured over 200,000 draws:

| | measured | should be |
|---|---|---|
| mean | **0.4954** | 0.5 |
| χ² over 10 equal bins | **159.5** (9 df) | < 16.9 at 5% |
| distinct values in 200,000 draws | **16,403** | ~200,000 |

χ² = 159.5 on 9 degrees of freedom rejects uniformity at p < 10⁻²⁸. The generator also cycles with an
effective period around sixteen thousand. Every interval this file emitted came out of it.

**The consequence is not academic.** The headline was reported as

> `p_winner_more_aligned: 0.5129`, `ci95: [0.5021, 0.5395]`

That interval is asymmetric by a factor of 2.5 around a proportion near 0.5 — impossible for a
well-behaved bootstrap at n = 2,124, and the tell that led me to the generator. The Wilson interval,
computed independently:

```
p = 0.5129, n = 2124  ->  95% Wilson CI [0.4916, 0.5341]   contains 0.5
```

Replacing the generator with mulberry32 (all arithmetic through `Math.imul`, never leaving 32-bit range;
mean 0.49984, χ² 13.2, 199,989 distinct) and re-running the file unchanged otherwise:

| | p | ci95 | verdict printed by the file's own logic |
|---|---|---|---|
| broken generator | 0.5129 | [0.5021, 0.5395] | *"CI clear of 0.5 — CHOMP's bring direction is the winning direction."* |
| working generator | 0.5132 | **[0.493, 0.533]** | *"suggestive, not significant."* |

The verdict string is gated on `signCI[0] > 0.5`. **The broken generator is the only reason this project
ever claimed a significant CHOMP bring effect.** The correct branch was already written and sitting in
the same ternary expression.

The same file's proper score behaves likewise: CHOMP-alignment log-loss **0.6923, CI [0.6905, 0.694]**
against a coin's ln 2 = 0.6931. The interval contains the coin. CHOMP's win-probability model is not
distinguishable from a coin flip on this evidence.

**Fixed and verified** in both files carrying the recurrence (`engine/chomp_ev.js`,
`build/build_mew_bundle.js`), with `tests/test-prng.js` (7 checks) asserting mean, uniformity, period and
refusing the constant structurally. Verified to fail on the pre-fix code (3 failures) and pass on the
fix.

### 2.2 The WAR ridge parameter is chosen by hand. This is a fatal flaw for a thesis.

`engine/war.py`:

```python
MIN_GAMES = 30          # a species must appear on >= this many sixes to get a WAR
RIDGE = 6.0             # L2 strength — strong, because most species are rare (honest shrinkage)
```

There is no cross-validation, no generalised cross-validation, no marginal-likelihood or evidence
maximisation, and no sensitivity analysis. The comment is a rationale for *why shrinkage is desirable*,
not a criterion that selects 6.0 rather than 3.0 or 20.0. A regularisation parameter chosen because it
felt appropriately strong determines every WAR ordering the thesis reports, and the direction of that
influence is exactly where it hurts: ridge shrinks rare species hardest, so the *ranking* of the tail is
a function of an unjustified constant.

The file partially concedes this — it labels the output "exploratory ordering" — but a thesis cannot
report a quantity as a result and defend it as exploratory when challenged. Either it is a result and λ
is selected by a criterion, or it is exploratory and it must not appear in a results table.

**What makes this worse is that the project already knows how to do it.** `engine/fit_policy.js`
selects its ridge parameter properly:

```
regularisation selected on held-out data: lambda = 0
```

by grid search over {0, 1e-5, 1e-4, 1e-3, 1e-2} maximising held-out log-likelihood. So the correct
practice exists in the codebase, twenty files away, and was not applied to WAR.

### 2.3 The NMF rank is a literal. "Next" is not a justification.

`engine/nmf_roles.py`:

```python
RANK = int(sys.argv[1]) if len(sys.argv) > 1 else 10
...
ARCH_RANK = 6
```

Rank 10 by default, rank 6 for archetypes, both typed. No reconstruction-error elbow, no topic-coherence
computation, no stability selection across seeds, no held-out perplexity. The documents name Mimno et
al. (2011) topic coherence as "next"; the code contains no coherence function. **A named criterion that
is never computed is a decorative citation** — it signals awareness of the standard without meeting it,
which is worse for a thesis than not citing it, because it implies the check was done.

The claim rests on this. "Emergent roles" is a claim about structure recovered from data; if the number
of roles is chosen by hand, the structure is partly imposed. Rank selection is not a detail here, it is
the result.

### 2.4 The noisy-OR independence assumption does not hold, and the direction of the error is knowable

`engine/roles.py`:

```python
rs[r] = 1.0 - (1.0 - rs.get(r, 0.0)) * (1.0 - p)   # noisy-OR across the six
```

`1 − Π(1 − pᵢ)` is P(at least one of the six plays role r) **if and only if** the events "member i plays
role r" are mutually independent conditional on the team. In VGC team construction they are not, and
they fail in both directions:

- **Anti-correlated by design.** Teams are built to *cover* roles. A team that already has a Trick Room
  setter does not usually bring a second; a team with one redirector rarely brings two. Conditional on
  member 1 filling role r, member 2 is *less* likely to.
- **Positively correlated by archetype.** Sand teams stack sand abusers; rain teams stack swimmers.
  Conditional on one member being a weather abuser, the next is *more* likely to be.

Where anti-correlation dominates — which is the common case for the specialist roles this model cares
about — noisy-OR **systematically overstates** P(team has role r), because it multiplies out
probabilities that in reality exclude each other. The `PRESENT_AT = 0.50` threshold is then applied to an
inflated quantity, and it is itself a hand-set constant. Two hand-set constants and a violated
independence assumption stand between the data and every role-prevalence figure.

This is fixable without abandoning the approach: estimate P(team has role r) **directly from observed
sixes** rather than aggregating per-species probabilities. The open-sheet corpora hold 37,903 complete
sets across 232 species and roughly 6,400 complete team compositions — enough to measure the joint
directly, exactly as the set sampler was corrected to do (see the architecture review, F9). The
aggregation is unnecessary, not merely unjustified.

### 2.5 What checks out

Not padding — these were checked and are correct, and a defence should say which criticisms do not land:

- **Wilson intervals.** The implementations in `fit_policy.js` and `validate_selfplay.js` use the correct
  score-interval form with continuity term, `(p + z²/2n)/(1 + z²/n) ± z√(p(1−p)/n + z²/4n²)/(1 + z²/n)`.
  I re-derived the CHOMP headline independently and got [0.4916, 0.5341]; the corrected bootstrap
  returned [0.493, 0.533]. Agreement to 0.002 is what a healthy bootstrap should give.
- **A coin's log-loss.** Quoted throughout as 0.6931. ln 2 = 0.69314718. Correct.
- **The percentile bootstrap structure.** Resampling *games* rather than decisions is the right
  clustering unit, B = 2000 is adequate, and taking the 2.5/97.5 percentiles is the correct percentile
  method. The method was right; only the generator was broken.
- **Held-out split by game, not by decision.** Decisions within a game share teams and board, so
  splitting by decision would leak. The code splits on a hash of the game id. Correct, and the comment
  explains why.

---

## 3. Statistical validity

### 3.1 The regularisation parameter is selected on the set reported as held out

`fit_policy.js` picks λ by maximising log-likelihood on `test`, then reports the same `test` numbers as
the held-out result. There is no third split. The reported held-out figures are therefore selection
targets, and are optimistically biased.

**In practice the bias here is small, and honesty requires saying so.** The grid has five candidates and
the selected value is λ = 0 — the unregularised endpoint, meaning no shrinkage was chosen at all — and
in-sample log-likelihood (−1.7566) is *worse* than held-out (−1.7524). A model that does not overfit at
47 features on 67,506 training decisions has little room for selection optimism. The methodology is
nonetheless wrong and must be corrected to train/validation/test before these numbers appear in a
results chapter.

The inverted train/test gap is itself unexamined and should be. Held-out beating in-sample usually means
the split is not exchangeable — for instance if held-out games have systematically fewer candidates per
decision, making them easier. Nobody has checked.

### 3.2 There is no untouched holdout anywhere in this project

The split is `hash(game_id) % 5`, deterministic and stable across every refit. Dozens of refits have
been run during development, each reporting accuracy on the same 15,330 decisions, with feature
decisions taken in between on the basis of those reports. That is textbook validation-set usage. **No
genuinely held-out set exists**, and the thesis cannot claim one. The fix is cheap and must be done
before submission: reserve a third slice by hash, never look at it, and report it once.

### 3.3 No multiplicity correction exists anywhere, and it matters

Nothing in this project corrects for multiple comparisons. I measured the scale of the problem on a
concrete case — species-level bring-rate differences between games the quality filter keeps and games it
drops, 84 species with ≥ 60 appearances:

- **15 of 84** reach |z| > 1.96.
- Under the null, 84 tests at α = 0.05 give an expected 4.2. Observing 15 is a global effect (binomial
  z ≈ 5.4).
- Bonferroni at α = 0.05 requires |z| > 3.43. **The largest observed is |z| = 2.9.** Not one species
  survives correction.

The honest statement is therefore: *the filter demonstrably biases bring rates in aggregate, and no
individual species' difference is established.* Neither half of that sentence appears in any document.
The same discipline has to be applied to the 47 fitted weights, of which several are reported as
"materially moved" on single-comparison intervals.

### 3.4 The quality filter conditions on an outcome-correlated variable — quantified

`require_full_bring` demands that both players' `brought` has four entries. `brought` is what the replay
*revealed*, so this conditions on the game lasting long enough to reveal it.

**The project already identifies this.** `data/quality-filter.json` carries a `known_limitation` field
stating it precisely: *"This conditions on game length, so the filtered set skews toward longer games. A
bring statistic computed here is 'the bring, among games long enough to show it', which is not the same
as 'the bring'. State it that way."* That is exactly right and it deserves credit.

**Nobody measured it.** Isolating the rule — taking games that pass every other rule, then splitting on
full bring:

| | n | mean turns | median |
|---|---|---|---|
| full bring (**kept**) | 2,245 | **8.4** | 8 |
| partial bring (**dropped**) | 487 | **5.8** | 6 |

Difference 2.6 turns, Welch t = **23.5**. The skew is not marginal; it is overwhelming.

Direction of the induced bias, from the species comparison in §3.3: fast offensive Pokémon
(Volcarona, Mimikyu, Oranguru) are over-represented among the *dropped* short games, while bulkier and
support Pokémon (Incineroar 3.84% vs 2.89%, Grimmsnarl, Basculegion) are over-represented among the
*kept* long games. That is exactly the mechanism you would predict, which is corroborating.

**A caveat that limits my own estimate**, and which must be stated: the dropped set has incomplete
brings by construction, so its denominator counts only revealed slots. Species revealed late are
under-counted there. The comparison is contaminated by the very censoring it measures, so the *direction*
is interpretable and the *magnitude* is a lower bound at best. Doing this properly needs a
censoring-aware estimator — inverse-probability weighting on P(reveal all four | game length), or a
survival treatment of reveal time. That analysis does not exist and is required.

### 3.5 The provenance block is stale by a factor of two

`data/quality-filter.json` records `store_size: 8356`, `clean: 1061`, measured 2026-07-25. Measured now:

```
collected 17,075 -> after bot filter 6,143 -> behavioural bots 4,302 -> forfeits 2,751
-> min turns 2,732 -> full bring 2,245        USABLE 2,245 of 17,075 (13.1%)
```

The store has doubled and the clean count has doubled. This is a hand-maintained number in the file
whose stated purpose is *"so 'which games did that number come from' has one answer"* — and the one
answer is out of date. The clean *share* is stable (12.7% → 13.1%), which is the thing the file was
really asserting, so nothing downstream is wrong; but a thesis cannot ship a provenance record that
disagrees with the data it describes.

### 3.6 The behaviour clone is badly calibrated and nobody says so

From the fit run:

| model | log-likelihood / decision | top-1 |
|---|---|---|
| uniform over candidates | −1.9582 | 21.0% |
| behaviour clone alone | **−2.6220** | 23.4% |
| board-aware fit | −1.7524 | 30.9% |

The behaviour clone — the model the previous bot actually used — ranks *better* than uniform on top-1
accuracy while scoring *substantially worse* than uniform on log-likelihood. That is the signature of
severe overconfidence: it puts high probability on its favourite and is wrong often enough that the
proper score punishes it below a model that knows nothing. This is an interesting and reportable result
about behaviour cloning in this domain, and it is currently just three numbers printed next to each
other with no comment.

---

## 4. The null results

**This section is where the thesis is strongest, and the credit is unqualified.** The null results are
not buried. `docs/ABRA-whitepaper.md` puts one in its opening framing at line 20 — *"near-impossible in
this format — even a player-Elo model ties a coin. ABRA therefore does not sell..."* — and returns to it
in the conclusion at line 287. The role-level winner prediction is reported as log-loss 0.7122 against a
coin's 0.6931, i.e. **worse than a coin**, and described as "ties a coin", which is if anything generous
to itself in wording while being accurate about significance. `docs/archive/HANDOFF-2026-07-27.md` §7 leads with
"the honest headline" and reports that the largest measured improvement all session was not a feature at
all. The retraction discipline is real: prior conclusions are struck through with reasons rather than
edited away, and CHANGELOG 3.1.2 retracts a root-cause diagnosis explicitly.

Two things now need to move into that column:

1. **The CHOMP bring effect is a null result** as of §2.1. The claim "CHOMP's bring direction is the
   winning direction" must be withdrawn and restated as suggestive-not-significant, and every document
   quoting `CI [0.5021, 0.5395]` updated to `[0.493, 0.533]`.
2. **The popularity-drop result was an artifact** and has already been retracted this session
   (CHANGELOG 3.23.0): dropping move popularity makes held-out top-1 *worse*, 30.9% → 28.7%, not better.

A thesis that has to convert two positives into nulls during its own defence has a problem with its
verification, not with its honesty. The honesty norms here are genuinely above what I usually see. The
verification machinery is what failed.

---

## 5. Literature

- **RAPM / plus-minus.** `war.py` cites the basketball provenance and states the confound it solves
  (teammate collinearity). The transfer argument is made, not merely asserted: species co-occurrence in
  a six is structurally the same confound as lineup co-occurrence. This citation earns its place.
- **Mimno et al. (2011), topic coherence.** **Decorative.** Named repeatedly as the next step for NMF
  rank selection; no coherence is ever computed. Either compute it or drop the reference.
- **NMF.** No citation to Lee & Seung (1999) for the multiplicative update rule that `fit_nmf`
  implements, despite implementing it. The method is used correctly and uncredited — the opposite failure
  from the one above, and also a defect.
- **Noisy-OR.** Used without citation to Pearl (1988), and without stating the independence assumption
  it requires. §2.4.
- **Sabermetric WAR.** The name is borrowed for a quantity that is not WAR — no replacement level is
  defined anywhere. "Wins above replacement" without a replacement baseline is a borrowed brand, and a
  committee will ask what replacement means here. Either define it or rename the statistic.
- **Wilson (1927), McNemar (1947).** `paired_h2h.js` correctly identifies its own test as McNemar's and
  explains why decisive pairs are the honest denominator. Correct and well-reasoned.

---

## 6. Construct validity

**The central problem is stated by the thesis itself and then not resolved.** The model is fitted to
*human clicks* and evaluated on *wins*. Those are different objectives, and `archive/HANDOFF-2026-07-27.md` §7
says so plainly: "fitting to human clicks and winning games are different objectives, and this model is
fitted to the first one." Good. But the results chapter then reports win rates as evidence of model
quality, which re-blurs exactly what that sentence separates.

Concretely:

- **MAG beats a random-clicking opponent on 90.8% of decisive pairs** (4,823 pairs, CI [89.6, 91.8],
  re-run clean on 2026-07-27). This is a floor, not a measure of skill. A random opponent establishes
  that the model is not broken. It says nothing about play against humans, and the thesis has **no
  measurement of MAG against a human opponent at all** beyond one person playing it for ten minutes —
  which, to be fair, is how both of the session's real bugs were found.
- **The win-probability model is validated against the project's own simulator.** That establishes
  internal consistency. Accuracy against real games is a separate claim requiring real games, and the
  CHOMP log-loss result (§2.1) is the closest thing to it — and it does not beat a coin.
- **`mean_align_delta_win_minus_lose: 0.0117`.** Even had the interval cleared 0.5, an effect this small
  on a constructed alignment scale needs an argument that the scale is meaningful. None is given.

---

## 7. Reproducibility

Could an independent researcher reproduce every number? **No, and the gaps are specific:**

1. **The bootstrap was seeded, so it was reproducibly wrong.** Determinism is not correctness. This is
   the sharpest reproducibility lesson in the project: a fixed seed made a broken generator produce the
   same wrong interval every time, which reads as stability.
2. **`requirements.txt` pins numpy and nothing else.** The documented PDF toolchain (`build/omnibus.py`,
   weasyprint) cannot be installed on the author's own machine — it imports but cannot load its native
   libraries. `build/md_to_pdf.js` exists solely to work around this and says so in its header. So the
   documented build path has never been a reproducible dependency.
3. **A published experiment had no runner in the repository.** The no-popularity greedy cell was
   reported, retracted, and re-run — and nothing in the repo produced `data/h2h-nopop-greedy.jsonl`. Only
   readers exist. I had to reconstruct the invocation from `mew.js` flags. An experiment whose command
   exists only in a shell history is not reproducible.
4. **The self-play harness does not stamp its own configuration.** `paired_h2h.js` printed "SWITCH
   SETTING NOT RECORDED (run predates the flag)" about a run created minutes earlier. Provenance for
   that dimension is unrecoverable from the artifact.
5. **3,849 ladder games predate raw-log archiving** and cannot be reparsed, so any figure that depends on
   a parser improvement is computed on a corpus that is permanently heterogeneous.
6. **`SHOWDOWN_PATH` pins a Showdown commit.** This is done well and is worth naming: the simulator
   dependency is version-pinned where most projects of this kind leave it floating.

---

## What I could not evaluate and why

- **I did not re-run WAR, NMF, or the role model.** They consume `data/pokemon-roles.json` and
  `data/xatu-context-sets.json`, both of which the project's own handoff marks UNSAFE because they were
  built on the unfiltered store. Re-running them would produce numbers from known-contaminated inputs,
  and I would not be able to separate a method problem from an input problem. **Every quantitative claim
  in §2.2, §2.3 and §2.4 is therefore about the code and the choice of constants, which I read directly —
  not about the output values, which I did not verify.** Those inputs must be regenerated on clean data
  before the mathematics can be assessed on its results.
- **I did not verify the WAR clustered bootstrap** for the same reason.
- **Topic coherence was not computed.** I am criticising its absence, not reporting its value.
- **MEW's 200,004-game corpus was not audited.** It is gitignored and I did not regenerate it.
- **Whether the test split was literally inspected during development** cannot be established from the
  repository — there are no analysis logs, only committed results. I infer repeated inspection from the
  deterministic split plus the number of refits in the changelog. It is an inference, not a measurement.
- **The censoring-aware bring estimate (§3.4)** I could not compute, because it needs a model of
  P(reveal all four | length) that does not exist. I have quantified the length skew and the direction of
  the species bias, and I have said explicitly that my magnitude estimate is contaminated.
- **Nothing was evaluated against a human opponent.** No such data exists in the repository.

---

## Verdict: MAJOR REVISIONS

Not a fail. The infrastructure discipline is real, the retraction culture is genuinely better than most
submitted work, the null results are foregrounded rather than buried, and the choice-set argument that
licenses the fit is a real contribution. A candidate who reports "the biggest improvement all session was
not a feature, it was taking the argmax" is doing science.

But two headline results reversed under examination **during the defence**, one of them because a random
number generator was broken in a way that four checks would have caught, and the parameters governing
three of the four models are hand-set constants with no selection criterion. That is not a presentation
problem. The verification layer is not yet at doctoral standard, and until it is, no number in the thesis
can be relied upon — including the ones that happen to be right.

### Precisely what must be done to reach a pass

1. **Select the WAR ridge parameter by a criterion.** K-fold cross-validation over a λ grid on
   held-out log-likelihood, reporting the selected λ, the CV curve, and a sensitivity table of the top-20
   WAR ordering at λ ∈ {λ*/4, λ*/2, λ*, 2λ*, 4λ*}. If the ordering is unstable across that range, say so
   and withdraw the ranking as a result.
2. **Select the NMF rank by a criterion, and compute the one already cited.** Reconstruction error
   versus rank with an elbow analysis; topic coherence per Mimno et al. (2011) actually implemented; and
   stability selection — refit at each rank across ≥ 20 seeds and report mean pairwise cluster agreement.
   Choose the rank that the criteria support and report all three curves. Cite Lee & Seung (1999) for the
   update rule.
3. **Replace noisy-OR with a direct estimate.** Measure P(team has role r) from observed sixes in the
   open-sheet corpora (~6,400 complete compositions available). Report the discrepancy against the
   noisy-OR figure — that discrepancy is itself a publishable measurement of how much the independence
   assumption costs. Derive `PRESENT_AT` from the data or remove the threshold.
4. **Introduce a third split and never look at it.** Train / validation / test by game hash. Tune λ on
   validation, report once on test. Re-report every headline held-out figure from the untouched slice.
   Separately, diagnose why held-out log-likelihood currently exceeds in-sample.
5. **Apply a multiplicity correction wherever more than one comparison is reported.** Benjamini–Hochberg
   across the 47 fitted weights and across any per-species table. State the number of comparisons made
   before each reported effect. Re-report which weights remain "materially moved" after correction.
6. **Quantify the full-bring selection bias with a censoring-aware estimator.** Inverse-probability
   weighting on P(all four revealed | length), or a survival treatment of reveal time. Report every bring
   statistic both raw and corrected, and if they differ, the corrected one is the result.
7. **Regenerate `pokemon-roles.json` and `xatu-context-sets.json` on clean data**, then re-run everything
   downstream. Until then §2.2–§2.4 cannot be assessed on their outputs at all.
8. **Withdraw the CHOMP bring claim** in every location, replacing `CI [0.5021, 0.5395]` with
   `[0.493, 0.533]` and the verdict with "suggestive, not significant". State in the results chapter that
   the CHOMP win-probability model does not beat a coin: log-loss 0.6923, CI [0.6905, 0.694], against
   ln 2 = 0.6931.
9. **Measure MAG against human opponents.** A random-bot floor of 90.8% is not an evaluation. Even 200
   ladder games with a pre-registered stopping rule would convert the central claim from internally
   consistent to externally validated.
10. **Commit a runner for every published experiment**, and stamp each run's full configuration into its
    output records. An experiment reproducible only from shell history is not reproducible.
11. **State in the introduction that the contribution is domain encoding and dataset, not method.** Then
    argue the choice-set point properly, because it is the genuinely novel idea and it is currently
    buried under borrowed machinery.

Items 1, 2, 3, 4, 5 and 8 are the barrier. Items 9 and 11 are what would make this a thesis rather than
a well-engineered system with a results appendix.
