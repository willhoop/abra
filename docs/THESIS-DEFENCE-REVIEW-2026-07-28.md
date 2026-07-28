# PhD Thesis Defence — ABRA

**Date:** 2026-07-28 · **Chair:** Dean, School of Engineering
**Verdict: MAJOR REVISIONS**

Supersedes `THESIS-DEFENCE-REVIEW-2026-07-27.md` (also MAJOR REVISIONS). The candidate
has done substantial work in the intervening day, and the verdict has not moved. That is
not because the work was idle — it is because the work that was done was *diagnostic*,
and diagnosis does not discharge a methodological defect. Several defects named in the
previous defence are still present, unaltered, in the same lines of code.

Every number in this review was produced by running something during the defence. Where
I quote a figure I could not reproduce, I say so.

---

## 1. The claim

**What the thesis asserts.** That competitive doubles Pokémon is a two-player zero-sum
imperfect-information game, that the modern poker-AI stack (CFR, depth-limited re-solving
with a learned leaf evaluator, public belief states) is therefore the correct toolbox,
and that an agent built on that stack can be made strong.

**Is it novel?** **No, and the thesis must stop implying otherwise.** The formal
observation that VGC is a two-player zero-sum imperfect-information game is not a
contribution; it is a categorisation, and an obvious one. Every algorithm named —
CFR, DeepStack's continual re-solving, ReBeL's public belief states, SM-MCTS, NMF, RAPM,
Benjamini-Hochberg — is imported unchanged.

**What is genuinely contributed** is narrower and the thesis undersells it:

1. **A validated damage oracle for an unusual format.** `engine/validate_damage.js` run
   during this defence: 31 scenarios against `@smogon/calc`, median absolute error 0.0%,
   97% within 2%, worst case 3%. This is real, checkable, and it is the foundation
   everything else stands on.
2. **A negative result on team-preview predictability**, obtained honestly and repeatedly:
   every preview-level model in the project sits at a coin.
3. **An empirical demonstration that imitation and winning are different objectives in
   the same feature space** — see §6. This is the most interesting thing in the thesis
   and it is currently buried in a code comment.

The thesis blurs (1)–(3) with the imported machinery and presents the whole as one
programme. **A doctoral thesis must state which parts are its own.** As written, an
examiner cannot tell.

---

## 2. The mathematics

### 2.1 The WAR ridge — FATAL AS WRITTEN

`engine/war.py:39`:

```python
RIDGE = 6.0             # L2 strength — strong, because most species are rare (honest shrinkage)
```

The regularisation parameter carrying every WAR number **is set by hand and justified by
a parenthetical intuition.** There is no cross-validation, no generalised cross-validation,
no evidence-maximisation, no held-out selection of any kind. I grepped the file: the three
matches for "held-out" are all in *reporting* the final log-loss, never in *choosing* λ.

This is fatal for a thesis, and I will say precisely why it is worse here than the generic
objection. **The project already knows how to do this correctly.** `engine/fit_policy.js`
selects its regularisation on held-out likelihood by sweeping a grid. The candidate applied
the right method in one model and a hand-tuned constant in another, and reported both with
the same confidence. That is not an oversight; it is an inconsistency the candidate is
obliged to notice.

`MIN_GAMES = 30` is likewise unmotivated.

**Required:** select λ by held-out log-loss over a grid, exactly as `fit_policy.js` does,
report the selected value and the sensitivity of the WAR ordering across the grid. If the
ordering is unstable in λ, WAR does not survive.

### 2.2 The NMF rank — UNJUSTIFIED, AND THE THESIS ADMITS IT

`engine/nmf_roles.py:154`: `ARCH_RANK = 6`, hard-coded.

`docs/MODELS.md` states: *"Rank and the human names are the only non-data choices;
rigorous rank/weighting selection by topic coherence (Mimno 2011) is the noted next
refinement."*

**"Next" is not a justification, and the candidate has now written "next" in two
successive defences.** Six interpretable archetypes is a post-hoc aesthetic judgement.
Reconstruction error is explicitly acknowledged as non-comparable across weightings, so
it cannot select rank either. The result is that a rank chosen because its output read
nicely is used to define archetypes that then carry downstream matchup claims.

**Required:** implement the coherence criterion, or a stability criterion (bootstrap the
factorisation and measure factor reproducibility across resamples), and report rank
selection as a curve. If rank 6 is not near-optimal, every archetype claim is withdrawn.

### 2.3 The noisy-OR — ASSUMPTION VIOLATED, MEASURED DURING THIS DEFENCE

`engine/roles.py:436` aggregates a team's role membership as `1 − Π(1 − pᵢ)`.

Noisy-OR requires the six members' role indicators to be **conditionally independent
given the team**. Teambuilding is the deliberate construction of complementary roles, so
the assumption is suspect on its face. The thesis nowhere states it.

I tested it. Mean Pearson correlation between the role-vectors of two Pokémon:

| pairing | mean r | n |
|---|---|---|
| **teammates** | **0.0839** | 30,040 |
| random pairs | 0.1093 | 30,730 |
| difference | **−0.0254** | |

**Teammates are less role-correlated than chance.** Independence is violated, and in a
determinate direction: for negatively associated indicators
P(A∪B) = P(A)+P(B)−P(A∩B) > P(A)+P(B)−P(A)P(B), so the true probability that a team
holds a role **exceeds** the noisy-OR estimate. **Noisy-OR systematically under-counts
role presence**, and that under-count is then thresholded by another hand-set constant,
`PRESENT_AT = 0.50` (`roles.py:371`).

That two hand-set constants and a violated assumption sit in series behind the finding
"preview roles tie a coin" does not mean the finding is wrong — but it does mean the
thesis cannot currently distinguish "roles carry no signal" from "this estimator loses it."

**Required:** quantify the bias (a simple simulation with the measured correlation
suffices), or replace noisy-OR with a model that does not assume independence.

### 2.4 The Wilson intervals — CORRECT

I reimplemented the Wilson score interval from the textbook definition and compared
against the project's inline formula on four cases including small-n edge cases:

| w / n | project | reference | match |
|---|---|---|---|
| 654 / 1368 | [45.17, 50.46] | [45.17, 50.46] | ✅ |
| 571 / 1176 | [45.71, 51.41] | [45.71, 51.41] | ✅ |
| 11 / 22 | [30.72, 69.28] | [30.72, 69.28] | ✅ |
| 1 / 10 | [1.79, 40.42] | [1.79, 40.42] | ✅ |

**The arithmetic is exact.** Credit where due; this is more than most theses can say.

### 2.5 The MACHAMP promotion gate — correct, but underpowered by design

The champion/challenger ladder promotes only when a Wilson interval clears 50%. Live
during this defence, generation 2 produced a challenger at 56.0%, confirmed at 55.3% over
n=293, and was **correctly refused**: that interval is [49.6, 60.9] and does not clear 50%.

The gate is right. The **power** is wrong. At 300 games per match:

- a true 55% edge needs **370** games to clear 50%
- a true 52% edge needs **2,380**

The run is configured at 300. **The experiment can only detect improvements larger than
those it is most likely to produce.** A null from this design is uninformative, and the
thesis must not report one as evidence that outcome-optimisation fails.

**Live confirmation of exactly this, observed during the defence.** Three generations
completed while I wrote, and every one regressed on its confirmation run:

| generation | best of 5 candidates | confirmation | outcome |
|---|---|---|---|
| 1 | 45.4% | 50.3% | did not replicate |
| 2 | 56.0% | 55.3% | did not replicate |
| 3 | 52.2% | **47.8%** | did not replicate |

This is the selection-of-the-maximum problem in its purest form, and the project's own
`engine/brood.js` predicted it in writing: *"picking the best of eight such candidates does
not find the best one, it finds the LUCKIEST one."* At n≈300 the standard error on a win
rate is about 2.9 points, so the maximum of five draws is inflated by roughly that much
before any real effect is present. Generation 3's eight-point regression is not an anomaly;
it is the expected behaviour of this design.

**The candidate built the correct guard and then ran the experiment at a sample size the
guard makes useless.** The confirmation gate is doing its job — refusing everything — but a
procedure that can only ever refuse is not a search.

### 2.5a Correction to this section, made before the defence closed

I prescribed "≥2,400 games per match" above. **That prescription was wrong, and the
project's own instrument shows why.** I computed it assuming the effect to be detected is
about 2 points. It is not. `engine/brood.js` — which exists precisely to measure this and
had never been used to set MACHAMP's parameters — was run during the defence: 8 candidates,
each judged twice on independent seeds, 400 games per look.

| | |
|---|---|
| observed spread between candidates | 8.3 points |
| of which noise | **0.9 points** |
| of which real | **8.2 points** |
| **reliability** | **99%** |

The candidates genuinely differ by an order of magnitude more than the measurement error.
Resolving an 8.2-point spread needs **about 286 games**, not 2,400. **The binding constraint
is exploration width, not statistical power**, and brood's recommendation is 10 candidates
per generation against the 5 that were run.

This also explains the four failed generations more precisely than "underpowered". Generation
2's best-of-5 confirmed at 55.3%, CI [49.6, 60.9] — it missed by a hair and would have cleared
at 400 games. Meanwhile brood's own son 0 scored 64.1% and replicated at 62.0%. **A candidate
that good exists in the perturbation neighbourhood; MACHAMP's five draws never contained one.**

I let this correction stand in the text rather than editing the prescription silently, because
a defence that quietly revises its own arithmetic is doing the thing it criticises. The
substantive criticism survives — the experiment as run could not answer the question — but my
proposed remedy was the wrong one, and the right one was measurable with a tool already in
the repository.

**One further result, incidental to the parameter question and more important than it.** Brood's
sons are random perturbations of MAG's shipped, imitation-fitted weights. Son 0 beat the shipped
weights **64.1% and again 62.0%**. A *random perturbation* of the thesis's move-selection model
beats that model roughly five times in eight. This is independent corroboration of WOBBUFFET's
63.2% by an entirely separate route, and it is the §6 construct-validity failure demonstrated a
second time: **the shipped weights are not merely unvalidated for strength, they are measurably
suboptimal for it.**

---

## 3. Statistical validity

### 3.1 The held-out set is not held out — conceded, still used

The split is `hash(game) % 5`, deterministic, and the project's own file states it has
been "inspected across many refits, so it is a validation set in practice rather than a
virgin holdout."

**A conceded flaw is still a flaw.** Every held-out figure in the thesis — top-1 30.37%,
log-loss −1.7694, PORYGON2's 63.6% — is a validation-set number reported in the register
of a test-set number. **Required:** carve a true holdout, never inspect it, and re-report
the headline figures once.

### 3.2 The quality filter conditions on an outcome-correlated variable — QUANTIFIED

`require_full_bring` demands all four brought Pokémon be revealed, which conditions on
game length. I isolated its effect on the open-sheet corpus (games clean on every *other*
rule):

| | games | mean turns |
|---|---|---|
| kept | 2,860 | **8.09** |
| dropped by this rule alone | 1,005 | **5.13** |

It removes **26.0%** of otherwise-usable games and the removed games are three turns
shorter. The bring distributions differ by a **total variation distance of 5.8%**, and the
shift is directional:

| species | kept | dropped | shift |
|---|---|---|---|
| Garchomp | 7.13% | 5.81% | **−1.32** |
| Basculegion | 5.65% | 4.58% | −1.07 |
| Incineroar | 5.85% | 5.05% | −0.80 |
| Staraptor | 3.96% | 4.58% | **+0.62** |
| Whimsicott | 4.48% | 4.92% | +0.44 |
| Grimmsnarl | 3.47% | 3.82% | +0.35 |

**Fast offence is over-represented among the discarded games.** Games that end quickly are
disproportionately games won by fast offensive teams, and the filter throws them away. The
bring statistics therefore under-count precisely the archetype that wins fastest.

The config file documents the conditioning in prose. **It nowhere quantifies it, and no
downstream bring statistic is corrected for it.** CHOMP's 51.3% is computed on this biased
sample. **Required:** inverse-probability weighting by game length, or report every bring
statistic as conditional on games long enough to reveal a bring, in the text, every time.

### 3.3 Multiplicity — properly handled where it was looked for

Benjamini-Hochberg is genuinely implemented, not merely cited, in `engine/counters.py`
and `engine/build_lab.js`, both with candid comments recording that an earlier version
manufactured five spurious "significant" counters. This is exactly right and the candidate
deserves credit.

**But the correction is local.** It controls FDR *within* a family of tests the candidate
chose to run together. There is no accounting for the **project-level** garden of forking
paths: JOLTEON, CHOMP, roles, WAR, NMF archetypes, the playstyle cycle, PORY, PORYGON2,
DITTO and MEDICHAM's win-probability were all developed and evaluated against overlapping
data. The playstyle cycle was withdrawn only after someone noticed ~17 spurious cycles are
expected across 990 candidate triples — which is the same failure at a level BH does not
reach.

**Required:** an explicit register of every hypothesis tested against this corpus, with
dates. It will not permit a formal correction, but it will let a reader calibrate.

---

## 4. The null results — THE THESIS'S STRONGEST SUIT

This section is where the work is most clearly doctoral, and I want that on the record
because the rest of this review is severe.

The nulls are not buried. They are foregrounded, with intervals, and several were found
by the candidate deliberately attacking his own claims:

- the non-transitive playstyle cycle: **withdrawn**, on a multiplicity argument the
  candidate constructed against himself
- CHOMP at 51.3% [49.4, 53.2] — reported as a coin, and reported as *losing* to the
  trivial "bring your four most-used" baseline
- PORYGON2's learning curve: **flat**, 8× data moved accuracy −0.2 points, which killed
  the candidate's own overnight plan
- weighting the k-NN distance: made it worse, reported plainly
- the variance lever: inconclusive at p = 0.481, and explicitly *not* reported as weak
  support
- the mechanics batch: three independent measurements agreeing it did not help, including
  a head-to-head at 47.8% [45.2, 50.5] against its own predecessor
- the collinearity diagnosis: **the candidate's own published explanation, tested and
  overturned during the period under review.** Deleting the kill block does not restore
  `koTarget`'s sign; the absorber is `tgtHurt` at r = 0.524. Redundancy, not rivalry.

Overturning your own headline diagnosis and writing it up is the single most creditable
act in this thesis. Most candidates never do it once.

---

## 5. Literature

**Correctly engaged.** ReBeL, DeepStack, Libratus, CFR, SM-MCTS and the PIMC critique
(Long et al. 2010) are cited with a real argument about *why* they transfer — in
particular §4 of `POKER-TO-POKEMON.md`, which is candid that the current search is
Information-Set MCTS with root determinization, a **documented rung below** ReBeL, and
names strategy fusion as the specific defect. That is honest scholarship.

**Decorative.** Two citations do no work:

- **RAPM (basketball).** Invoked to license ridge-regularised plus-minus, but the
  transfer argument is asserted, not made. RAPM's justification depends on lineup
  co-occurrence structure with thousands of possessions per player; here it is ~30 games
  per species minimum. The disanalogy is larger than the analogy and is not discussed.
- **Mimno et al. 2011 (topic coherence).** Cited as what *would* justify the NMF rank, in
  a document where the rank is hard-coded. **A citation to the method you did not use is
  decorative by construction.**

- **Lee & Seung 1999** and **Geng 2016** (label distribution learning) are correctly
  cited for what is actually implemented.

---

## 6. Construct validity — THE CENTRAL FAILURE

The examiner was asked to be adversarial here, and the evidence is unambiguous.

**MAG's headline metric is top-1 agreement with human clicks: 30.37% held-out.** The
thesis presents this as the measure of the move-selection model.

**It is not a valid operationalisation of playing strength, and the thesis's own data
proves it.** From `data/exploitability.json`, read during this defence — the same 17
features, the same feature space, one vector fitted to imitate human clicks and one
hill-climbed to win games:

| feature | fitted to **imitate** | optimised to **win** | ratio |
|---|---|---|---|
| `tgtHurt` (the only kill proxy available at 17 features) | **+0.313** | **+2.751** | **8.8×** |

The win-optimised vector was found by a crude forty-minute search and **beat MAG 63.2%**
[56.6, 69.3], against a mirror control of 47.5%. It was not a counter exploiting a
weakness; it was drawn from the same features and was simply a better player.

Three consequences the thesis must confront:

1. **Improving top-1 does not improve strength.** Measured this period: the mechanics
   batch improved the *accuracy* of the inputs to the kill features and moved head-to-head
   win rate to 47.8% [45.2, 50.5] — if anything downward. Accuracy of a feature multiplied
   by a coefficient the objective has driven to zero is zero.
2. **The imitation target is itself unvalidated.** MAG is fitted to the average clean
   ladder player. No evidence is offered that this population plays well. "Agreement with
   an unvalidated reference" is not a strength metric at any level of agreement.
3. **PORYGON2 has the same defect one layer down.** It is trained on MAG self-play and
   validated against *human* games. That cross-domain design is genuinely good — it is the
   right way to detect distribution shift, and I credit it. But its 63.6% is agreement with
   *outcomes of games between two copies of a model of uncertain strength*.

**Required for a pass:** report a strength metric that does not reference human clicks.
The infrastructure exists and is half-run — MACHAMP for improvement, WOBBUFFET for
exploitability. Until one completes on the current feature set, **the thesis has no
validated measure of how well its agent plays.** That is the gap.

---

## 7. Reproducibility

**Good, and materially better than the previous defence.**

- The simulator is pinned to a commit; the damage engine is validated against an external
  oracle and re-validated after every change.
- The clean-game definition lives in one JSON consumed by both language implementations,
  and a test asserts the two select **identical** game IDs by hash. That cross-check
  caught a real drift this period.
- `requirements.txt` pins the Python environment.
- Artifacts carry `generated` timestamps and provenance strings.

**Where an independent researcher would fail:**

1. **The ladder store is not public.** Every human-data number is unreproducible outside
   this machine. The thesis must state this as a limitation of the work, not a detail.
2. **Stale artifacts still ship.** `data/policy-weights-joint.json` carries 46 features
   against the code's 48 and silently refuses to load. `data/ladder.json` and
   `data/exploitability.json` are 17-feature artifacts whose numbers are still quoted in
   living documents.
3. **A regenerated document is not a corrected one.** The mechanics-coverage document was
   twice reported as fixed while carrying identical numbers, because the "fix" was inert
   (`\b` inside a JavaScript template literal is a backspace character). Both figures it
   published — 22.37% and 59.41% — were regex artifacts. It has since been rebuilt as a
   behavioural experiment (swap the ability, re-run the real code, see if any output
   moves), now reporting 35 of 192 abilities responsive. **The rebuild is correct
   methodology.** That two published figures were artifacts of a pattern is a reproducibility
   failure of exactly the kind this section exists to catch.

---

## What I could not evaluate and why

- **MACHAMP's outcome.** The decisive experiment for §6 was executing throughout this
  defence and had completed 2 of 6 generations. I report its interim behaviour (the
  promotion gate correctly refusing a 55.3% challenger at n=293) and its power deficit,
  but **I cannot report whether outcome-optimisation improves the current agent.** The
  central question of the thesis is open.
- **XATU's +0.0324.** Described as the only clearly positive model. I did not re-run it,
  and it predates the corpus change. Unverified here.
- **Whether the population MAG imitates plays well.** No external rating anchor exists in
  the data. This is the root of §6 and it cannot be settled with the archived data alone.
- **MAG against a human.** Never measured, not once, in the project's history. The single
  most informative missing experiment.
- **The deliverable format.** The brief specified `build/omnibus.py`. On inspection that
  tool is a **manifest-driven multi-document compiler** (`python omnibus.py manifest.json`),
  not a single-file Markdown converter, and it carries its own weasyprint→LibreOffice
  fallback. It is the wrong instrument for a single review document. I used
  `build/md_to_pdf.js`.

  I record this because I nearly repeated a secondhand claim. The project's handoff states
  omnibus "needs weasyprint, which cannot load on this machine"; I was about to cite that
  as my reason. Checking the file showed the real reason is the interface, and that a
  LibreOffice fallback exists. **In a review whose central complaint is that figures are
  quoted from documents rather than produced by running something, I was one paragraph from
  doing exactly that.** The discipline is harder to keep than it looks, which is some
  mitigation for the candidate.

---

## Verdict: MAJOR REVISIONS

Not a fail. The candidate has built a validated engine, an honest data pipeline that
audits itself, and a body of null results reported with a rigour most theses reserve for
their positive findings. Overturning his own published diagnosis mid-review is doctoral
behaviour.

But three defects are disqualifying as the work stands:

1. **Hyperparameters that carry results are set by hand** — `RIDGE = 6.0`,
   `ARCH_RANK = 6`, `PRESENT_AT = 0.50` — in a project that demonstrably knows how to
   select them properly elsewhere.
2. **The central metric is not a measure of the thing claimed.** Top-1 agreement with
   human clicks is the headline number for the agent, and the thesis's own data shows an
   8.8× divergence between imitation and winning in the same feature space. There is
   currently **no validated measure of playing strength anywhere in the thesis.**
3. **A quantified, uncorrected selection bias** sits under every bring statistic —
   26% of games removed, 3 turns shorter, 5.8% distributional shift, directionally
   against fast offence.

### To reach a pass

1. Select `RIDGE` by held-out log-loss over a grid; report the curve and the stability of
   the WAR ordering across it. Withdraw WAR if unstable.
2. Select the NMF rank by topic coherence (Mimno) or bootstrap factor stability; report
   the selection curve. Withdraw the archetype claims if rank 6 is not near-optimal.
3. State the noisy-OR independence assumption in the text, and either quantify its bias
   using the measured −0.0254 correlation or replace the aggregator.
4. Carve a genuine holdout, never inspect it, and re-report top-1, log-loss and PORYGON2
   once against it.
5. Correct the bring statistics for the length-conditioning bias by inverse-probability
   weighting, or condition every such statistic explicitly in the text.
6. **Complete MACHAMP at adequate power** — at minimum 2,400 games per match if a 52%
   edge is to be detectable — and report a strength metric that does not reference human
   clicks. Re-run WOBBUFFET on the same feature set so improvement and exploitability are
   measured against each other.
7. Separate, in the thesis text, the imported machinery from the three genuine
   contributions of §1.
8. Retire or refit every stale artifact, and remove 17-feature figures from all living
   documents.

Items 1–5 are analysis the candidate can complete in days. Item 6 is the thesis. Until it
is done, this work has built an apparatus for answering its central question and has not
answered it.
