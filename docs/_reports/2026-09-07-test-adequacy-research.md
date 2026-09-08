# Test adequacy research: what the literature calls "a test that cannot fail"

Research pass, 2026-09-07. Prompted by seven self-tests found green-but-asserting-nothing over
two days. Every claim below is cited. Where I read the source text directly, the citation is
marked **[read]**; where I have only a search-engine summary of the source, it is marked
**[secondary]** and should be treated as a pointer, not as a quotation. That distinction is
load-bearing — one WebFetch summary of Ball & Kupferman invented a detection method the paper
does not contain, and was caught only by extracting the PDF and reading it.

---

## 0. The short version

There is no single accepted name. There are **four separate literatures** that each describe part
of the problem, and only one of them gives a framework that covers all seven observed shapes:

| Literature | What it names | Covers which ABRA shapes |
|---|---|---|
| **RIPR / PIE fault-propagation model** | the *conditions* a test must meet to be able to fail at all | all seven, precisely |
| **Vacuity** (formal verification, imported into testing) | a pass that occurred *for the wrong reason* | 1, 3, 7 exactly |
| **Mutation testing** | the *measurement* — can this suite detect a seeded fault | the detector, not the name |
| **Test smells** | the *syntactic* symptom (assertionless test, etc.) | 4, 5 only, and weakly |

The most useful frame for ABRA is **RIPR + vacuity**, not mutation testing. Mutation testing is
the industrial-strength instrument for *finding* these, and it is expensive and noisy; vacuity
gives a cheaper structural answer that maps directly onto the `MEDI_*` restore knobs already in
the repo.

---

## 1. What is the established name and literature?

### 1.1 The framework that actually fits: RIPR

The precise statement of "why a test can be unable to fail" is the **RIPR model** — Reachability,
Infection, Propagation, Revealability — in Ammann and Offutt, *Introduction to Software Testing*
(Cambridge University Press; 1st ed. 2008, 2nd ed. 2017). Four conditions must ALL hold for a
test to detect a fault **[secondary]**:

1. **Reachability** — the test must execute the faulty location;
2. **Infection** — executing it must produce an incorrect program state;
3. **Propagation** — that incorrect state must reach an observable output;
4. **Revealability** — the *oracle* must look at the part of the output that is wrong.

RIPR evolved from the **PIE model** — Propagation, Infection, Execution — in Jeffrey M. Voas,
"PIE: A Dynamic Failure-Based Technique", *IEEE Transactions on Software Engineering* 18(8),
August 1992, pp. 717–727 **[secondary]**. Voas's original purpose was *testability estimation*:
statistically predicting "where faults can more easily hide in software". The R (Revealability)
was added later, explicitly because a run can pass when the final state is mostly infected but
the oracle happens to inspect the uninfected part.

**This is the right diagnostic vocabulary for the seven ABRA cases**, and it discriminates them
in a way "the test was broken" does not:

| Observed shape | RIPR clause that failed |
|---|---|
| 1. Both sides used a default spread nothing builds | **Infection** — the variable under test never changed state |
| 2. Test pinned the ordering divergence caused by the bug | none — this is an *oracle* fault, see §3 |
| 3. Staged move immune against every carrier | **Reachability** — the clause never executed |
| 4. Gate read a field off a changed shape, zero assertions | **Revealability** — oracle inspected nothing |
| 5. Regex could not match because of CRLF | **Revealability** — oracle inspected the wrong bytes |
| 6. Red plants anchored to a source string stopped applying | **no fault present** — the seeded defect silently vanished |
| 7. Plants in a rule where every member was un-stageable | **Reachability** — loop never keyed on them |

Shapes 6 and 7 are worth separating out: they are not failures of a test, they are failures of
the *instrument that validates the tests*. The literature has no crisp name for that; it is the
mutation-testing equivalent of a broken thermometer, and §4 is where it gets addressed.

### 1.2 Vacuity — the closest thing to a canonical name

The formal-verification community named this exact phenomenon, and the name is **vacuity**.

**Origin.** Ilan Beer, Shoham Ben-David, Cindy Eisner and Yoav Rodeh, "Efficient detection of
vacuity in ACTL formulas", *CAV 1997*, LNCS 1254, pp. 279–290; extended as "Efficient Detection
of Vacuity in Temporal Model Checking", *Formal Methods in System Design* 18, 2001, pp. 141–163
**[secondary for the citation; the key quote is read second-hand from Ball & Kupferman, below]**.

The canonical example: the specification "every request is eventually followed by a grant" is
satisfied *vacuously* by a system in which requests are never sent. The pass is real; it means
nothing.

**The number that matters.** Beer et al., quoted verbatim inside Ball & Kupferman **[read]**:

> "our experience has shown that typically 20% of specifications pass vacuously during the first
> formal-verification runs of a new hardware design, and that vacuous passes always point to a
> real problem in either the design or its specification or environment"

That is an industrial base rate of **20%** vacuous passes on first run, from IBM hardware
verification. ABRA found seven in two days across ~40 probes; that is the same order of
magnitude, and the literature says it should be *expected*, not treated as a scandal.

**The formal definition** (Beer et al., as restated by Ball & Kupferman **[read]**): a subformula
ψ of specification ϕ *does not affect* ϕ in model M if M also satisfies every formula obtained by
modifying ψ arbitrarily. ϕ is satisfied vacuously in M if it has such a subformula.

Note what that definition *is*: it is **mutation of the specification**, not of the system. The
test is deemed vacuous if you can make the assertion strictly harder and it still passes.

**The import into testing.** Thomas Ball and Orna Kupferman, "Vacuity in Testing", *Tests and
Proofs (TAP) 2008*, LNCS 4966 **[read]**. This is the paper that matters most for ABRA. From the
abstract:

> "It is now time for model checking to pay back, and let testing enjoy the rich theory and
> applications of vacuity."

They define two kinds:

- **Strong vacuity** — independent of the test suite T; some element of the specification does
  not affect its satisfaction in the system at all. "Strong vacuity suggests that C and S should
  be re-examined: some behavior that the specifier expect cannot happen."
- **Weak vacuity** — depends on T; it concerns the role the elements of the specification played
  *in the fact that T passed*. "Weak vacuity suggest that either there is strong vacuity or that
  more tests are needed."

ABRA shape 3 (move immune against every carrier) is **strong** vacuity — the clause cannot fire
for any input. Shapes 1 and 7 are **weak** vacuity — the clause could fire, but nothing in the run
made it.

Their third setting is the one that matches ABRA's architecture: a terminating procedure P, and a
specification S that is a Boolean function fed both the input and P's output — which is exactly a
differential probe. Their definition **[read]**: for a branch b of S, let S_b be S with the
statement guarded by b replaced by `return(false)`. Branch b *does not affect* S in P and T if S
agrees with S_b on all inputs in T. **T passes S vacuously in P if some branch of S does not
affect its pass.**

And critically, Remark 3 **[read]** — the cheap version:

> "Since, however, S is deterministic, it is easy to combine the testing of T with a vacuity
> check: whenever a branch of S is taken, we mark it, and T passes S vacuously in P if we are
> done testing T and some branch is still not marked."

**That is coverage measured on the ORACLE, not on the code, and it costs one counter per clause.**
It is the single most actionable thing in this whole research pass. See §4.

They are explicit that this is *not* subsumed by code coverage: "there are cases in which all
elements of the system have been covered, and still some elements of the specification are not
covered, causing the test suite to pass vacuously."

### 1.3 Mutation testing

**Origin.** Richard A. DeMillo, Richard J. Lipton, Frederick G. Sayward, "Hints on Test Data
Selection: Help for the Practicing Programmer", *Computer* 11(4), 1978, pp. 34–41 **[secondary]**.
It introduced mutation analysis as a test-adequacy criterion stronger than code coverage, resting
on the **coupling effect** hypothesis: a test suite that detects simple faults will also detect
more complex ones.

**What it measures.** Seed a small artificial fault (a *mutant*); run the suite; if no test fails,
the mutant *survives* and is a concrete demonstration that the suite cannot detect that fault. The
*mutation score* is killed/total.

**The specific criticism that coverage is not adequacy.** Two papers, both read:

- Laura Inozemtseva and Reid Holmes, "Coverage Is Not Strongly Correlated with Test Suite
  Effectiveness", *ICSE 2014* (ACM Distinguished Paper) **[read]**. 31,000 test suites over five
  Java systems up to 724,000 SLOC. When suite size is *ignored*, Kendall τ between coverage and
  mutation-detection effectiveness runs 0.50–0.84 for four projects — but **−0.35 for HSQLDB**,
  which the authors explain plainly: "the suites with higher coverage contain test cases that run
  a lot of code but do not kill many mutants in that code." Their conclusion: coverage "should not
  be used as a quality target because it is not a good indicator of test suite effectiveness."
- Yucheng Zhang and Ali Mesbah, "Assertions Are Strongly Correlated with Test Suite
  Effectiveness", *FSE 2015* **[read]**. 6,700 test suites, 24,000 assertions, five Java projects.
  Kendall τ **0.88–0.91** between *assertion coverage* and mutation score, and 0.80–0.90 against
  the "explicit mutation score" (mutants killed by an assertion rather than by a crash). Their
  framing of the problem is ABRA's exact problem: "a test suite might achieve 100% coverage but be
  void of test assertions to actually check against the expected behaviour, and thus be
  ineffective." They also report that "the correlation between statement coverage and effectiveness
  decreases dramatically when assertion coverage is controlled for."

Assertion coverage is also called **checked coverage**, from David Schuler and Andreas Zeller,
"Assessing Oracle Quality with Checked Coverage", *ICST 2011* **[secondary, via Zhang & Mesbah's
description]** — the fraction of statements in the *backward dynamic slice of the assertions*.
That is: code that was executed AND whose result an assertion actually depends on. This is the
metric that would have caught ABRA shapes 1, 4 and 5.

### 1.4 Assertion-free tests and test smells

**Origin of the test-smell catalogue.** Arie van Deursen, Leon Moonen, Alex van den Bergh, Gerard
Kok, "Refactoring Test Code", *XP 2001*, pp. 92–95 **[secondary]**. Establishes that test code has
its own distinct set of bad smells and its own refactorings.

**The book-length catalogue.** Gerard Meszaros, *xUnit Test Patterns: Refactoring Test Code*,
Addison-Wesley, 2007 **[secondary]** — 18 test smells including Obscure Test, Conditional Test
Logic, Erratic Test, Fragile Test. (I could not reach xunitpatterns.com to confirm the exact
wording of the assertion-free entry; treat the specific smell name as unconfirmed.)

**Prevalence.** Gabriele Bavota, Abdallah Qusef, Rocco Oliveto, Andrea De Lucia, Dave Binkley,
"An Empirical Analysis of the Distribution of Unit Test Smells and Their Impact on Software
Maintenance", *ICSM 2012*, pp. 56–65 **[secondary]**. Across 18 projects, **82% of JUnit classes
carry at least one test smell**; Assertion Roulette appears in **62%**; Eager Test in ~35%.

**Honest assessment of this literature for ABRA's purposes: it is the weakest of the four.** Test
smells are defined *syntactically* — "this method contains no assertion statement". Six of ABRA's
seven cases had assertions. They were structurally fine and semantically empty. A test-smell
detector would have found none of them except possibly shape 4. Do not invest here.

---

## 2. Mutation testing at scale: what industry actually measured

Three papers, all from the same Google group, all read directly. This is the best industrial
evidence that exists.

### 2.1 Petrović & Ivanković, "State of Mutation Testing at Google", ICSE-SEIP 2018

Introduced diff-based probabilistic mutation analysis and the "arid line" suppression concept
**[secondary — I read the successor paper, not this one]**.

### 2.2 Petrović, Ivanković, Fraser, Just, "Practical Mutation Testing at Scale: A view from Google", arXiv:2102.11378, 2021 **[read]**

**Scale.** 776,740 changelists. **16,935,148 mutants generated**, of which **2,110,489 surfaced**
to developers — an 8:1 suppression ratio before anyone sees anything. 66,798 received explicit
developer feedback. Deployed to 24,000+ developers across 1,000+ projects. Google's repo is ~2
billion lines; 500,000,000 test executions/day gate 60,000 change submissions.

**The number that should govern ABRA's decision.** Naive mutation testing was unusable not because
of compute but because of *noise*:

> "developers at Google initially classified **85% of reported mutants as unproductive**"

An *unproductive* mutant is one that is either trivially equivalent to the original, or killable
but where writing the test would not improve the suite. Six years of hand-curated suppression
rules moved productivity from **15% → 80%** (three heuristics alone: logging statements, time
expressions, config flags), then to **89%** with further refinement. There are **100+ arid-node
rules** and fuzzy-name suppression for **200+ function families**.

**Cost of the suppression, measured.** Median mutants per changelist after arid-node suppression
and one-per-line selection: **7**, versus **820** for traditional mutagenesis — two orders of
magnitude. 99th percentile is 43. Overall **87.5% of generated mutants are killed** by the
existing suite.

**Developer verdict.** 82% of surfaced-with-feedback mutants marked "Please fix" (productive);
rising 80% → 89% over the programme's life. Productivity varies by language: C++ 87.2%, Python
70.6%.

**Their own warning about the fix, which is directly relevant to ABRA shape 2.** On unproductive
mutants:

> "it is conceivable that these tests, if written and added, would even have a negative impact
> because their change-detector nature (specifically testing the current implementation rather
> than the specification) violates testing best practices and causes brittle tests and false
> alarms."

**Chasing a mutant can manufacture exactly the pinned-bug test that is ABRA's shape 2.**

**On mutation score as a metric**, they abandoned it outright: it was "infeasibly expensive to
compute the absolute mutation score for the codebase at any given fixed point", and separately
they "were also unable to find a good way to surface it to the developers in an actionable way,
as it is neither concrete nor actionable, and it does not guide testing."

### 2.3 Petrović, Ivanković, Fraser, Just, "Does mutation testing improve testing practices?", ICSE 2021 (arXiv:2103.07189) **[read]**

Longitudinal, ~15 million mutants over six years, treatment group (sees mutants) vs control group
(sees only coverage).

- **RQ1** — developers exposed to mutation testing write more tests. Spearman r = .82, p < .001 on
  the downsampled robustness check.
- **RQ2** — the tests are good ones: mutant survivability falls with exposure, beyond the mutants
  written for.
- **Control against the obvious confound**: did they just write tests to raise coverage? No —
  coverage was "largely stable over time"; correlation with exposure was r_s = 0.02 for the
  coverage dataset and a *weak negative* r_s = 0.17 for the mutant dataset. "they wrote tests to
  kill the reported mutants."
- **RQ3, fault coupling** — 1765 high-priority bug-fix changes examined. Had mutation testing been
  running on the fault-introducing change, it would have reported a live mutant that the
  fault-fixing change's tests kill. Caveat stated in the paper: mutation testing was actually
  enabled for only **10.8%** of bug-fixing changes in the dataset.
- **RQ4** — mutants on a line "share a majority fate", which is what licenses one-mutant-per-line.

### 2.4 Facebook / Meta

Beller et al., "What It Would Take to Use Mutation Testing in Industry — A Study at Facebook",
ICSE-SEIP 2021 (arXiv:2010.13464) **[secondary]**. 15,000+ mutants; **more than half survive
Facebook's test suite**. 26 developers in the case study: all but two found the reported test
holes interesting, but only roughly half said they would actually write or modify a test. Their
conclusion is a caution, not an endorsement: "it remains a practical challenge how we can include
such external information to increase the true actionability rate."

### 2.5 Reading the industrial evidence honestly

The evidence says mutation testing **works at scale only after a large, ongoing, hand-curated
suppression effort**, and that the raw technique is 85% noise. Google's payoff came from six years
of building the *filter*, not from running the mutants. Anyone proposing "let's add mutation
testing" to a small codebase is proposing the 15%-productive version unless they also propose the
filter.

---

## 3. Tests that pin a bug, and tests that silently stop exercising their target

### 3.1 Pinning current behaviour — this HAS a name, two of them

**Characterization tests.** Michael Feathers, *Working Effectively with Legacy Code*,
Prentice Hall, 2004 **[secondary]**. A characterization test documents what the code *actually
does*, not what it *should* do, so that refactoring can proceed safely. The literature is explicit
that this is deliberate: characterization tests "reveal existing behavior, whereas TDD/BDD tests
specify behavior." **This is ABRA shape 2 done on purpose and correctly labelled.** The failure in
ABRA is not that such a test exists — it is that a characterization test was filed among the
specification tests and read as evidence of correctness.

**Change-detector tests.** Alex Eagle, "Testing on the Toilet: Change-Detector Tests Considered
Harmful", Google Testing Blog, 27 January 2015 **[read via fetch]**. The argument: a test that
mocks its dependencies and asserts that specific methods were called with specific parameters
fails whenever the code is refactored even though nothing broke, and — the half that matters here
— **can keep passing when the logic actually breaks**, because everything it touches is a mock.
The recommendation is to assert on behaviour and outcomes, not implementation. Google's own
mutation-testing paper (§2.2) independently names change-detector tests as a *hazard created by*
chasing mutants.

**So: the two names are `characterization test` (neutral, deliberate) and `change-detector test`
(pejorative, accidental). ABRA shape 2 is a change-detector test.**

### 3.2 A test that silently stops exercising its target — this is a genuine gap

I searched for this specifically and found **no dedicated literature**. What exists is adjacent
and partial:

- **Test-smell evolution.** "The secret life of test smells — an empirical study on test smell
  evolution and maintenance", *Empirical Software Engineering* 2021 **[secondary; I could not
  retrieve the article past the Springer paywall redirect, so I am not quoting numbers from it]**.
  Concerns smells appearing and persisting, not clauses ceasing to fire.
- **Obsolete tests.** "Is This a Bug or an Obsolete Test?", ECOOP 2013 **[secondary]** — addresses
  the *opposite* case, where a test goes red and you must decide whether the code or the test is
  wrong. A test that goes silently green is out of scope.
- **Ball & Kupferman's weak vacuity** (§1.2) is the closest formal fit, and it is a snapshot
  notion, not a longitudinal one.

**Verdict on Q3, second half: the literature does not settle this.** ABRA shapes 6 and 7 — a
seeded defect anchored to a source-code string that silently stops applying when the line is
edited — are, as far as this search reaches, **not named anywhere**. That is a real result and it
has a design consequence: nothing off the shelf will catch it, so the fix must be structural
(§4.2), not a search for a tool.

---

## 4. What the sources recommend for design

Split as the brief asked: infrastructure vs discipline.

### 4.1 Requires new infrastructure — mostly NOT worth it here

| Approach | Source | Verdict for ABRA |
|---|---|---|
| Full mutation testing | DeMillo 1978; PIT | **No.** 85% unproductive without a six-year filter (§2.2). |
| Diff-based mutation with arid-node suppression | Petrović 2021 **[read]** | **No.** The value is the 100+ suppression rules, which do not transfer. |
| Checked / assertion coverage via dynamic slicing | Schuler & Zeller 2011; Zhang & Mesbah 2015 **[read]** | **No** as built (JavaSlicer-class tooling), **yes** in cheap form — see 4.2. |
| Infection & propagation analysis (Reneri) | Vera-Pérez, Danglot, Monperrus, Baudry, arXiv:1909.04770, 2019 **[fetched abstract]** | **No**, but see its finding below. |

The Reneri finding is worth carrying even though the tool is not: across **312 undetected
transformations in 15 projects**, **63% of cases were ones where the existing tests DO infect the
program state** — the mutant survived because the *oracle did not observe*, not because coverage
was missing. That is the RIPR **Revealability** clause failing, and it is the majority case. It is
direct empirical support for ABRA's diagnosis: the probes reached the code; the assertions were
looking elsewhere.

### 4.2 A discipline over tests you already have — this is the answer

**(a) Mark the oracle clause when it fires. Fail the run if any clause never fired.**

This is Ball & Kupferman Remark 3, quoted verbatim in §1.2: for a deterministic specification,
"whenever a branch of S is taken, we mark it, and T passes S vacuously in P if we are done testing
T and some branch is still not marked."

Cost: one counter per assertion clause; no new run, no new framework, no new gate object. It
catches shapes 3, 4, 5 and 7 outright — every case where a clause never executed. Ball & Kupferman
prove the check is no harder than the testing itself (NLOGSPACE for the monitor setting;
trivially combined with the test run in the deterministic setting).

**ABRA already has this rule and has not applied it to oracles.** CLAUDE.md states "A capability
that cannot prove it ran is assumed broken. Every capability emits a counter, the run prints it,
and a zero is called out." That was written about *engine capabilities* after the 2026-07-28
findings. The literature says it is equally the right answer for *assertion clauses*, and the
existing counter machinery is the instrument to reuse.

**(b) Prove the probe reaches its rule by flipping the knob. One mutant, hand-chosen.**

This is what vacuity's formal definition *is*: modify the thing under test to be strictly harder
and confirm the pass disappears (Beer et al.'s "does not affect"; Ball & Kupferman's `S_b`
`return(false)` substitution). It is also mutation testing with a sample size of one and a 100%
productive mutant, because a human chose it.

ABRA's ~40 probes mostly already carry a `MEDI_*` restore knob. Flipping the knob and asserting
the probe goes red **is the vacuity check**, executed on the exact fault that matters rather than
on a random syntactic mutation. This sidesteps every cost the industrial evidence complains about:
no equivalent-mutant problem (the knob is known non-equivalent), no unproductive mutants (there is
exactly one, and it is the mechanic under test), no compute blowup.

The repo has already validated this pattern empirically — CLAUDE.md records the Damp case, where
"a knob-cleared control (the same Swampert carrying Torrent instead of Damp) moving the counter
0 → 1" is what made the zero meaningful. That is a positive control, and it is the discipline the
literature endorses.

**(c) Never anchor a seeded defect to a source-code string.**

No literature to cite; this is the gap identified in §3.2. The structural fix is that a red plant
must be keyed to something that *cannot silently stop matching* — the same tag/param identity the
engine dispatches on, so that a plant which no longer applies is a hard error rather than a
no-match. This is a structural fix that makes the defect impossible, which is the class Will's
constraint prefers.

**(d) Assert on behaviour, not on the current implementation.**

Eagle 2015 **[read]**; reinforced by Petrović 2021 **[read]**, which names change-detector tests as
an active hazard. For ABRA specifically: a differential probe should assert on *board state*, which
is the specification, and not on the protocol line ordering, which is the implementation. The repo
already draws this line ("commentary may differ; boards may not"), and shape 2 is what happens when
a probe is written on the wrong side of it.

**(e) Where there is no reference implementation to differ against, the oracle problem is the
binding constraint, not the test design.** Earl Barr, Mark Harman, Phil McMinn, Muzammil Shahbaz,
Shin Yoo, "The Oracle Problem in Software Testing: A Survey", *IEEE TSE* 41(5), May 2015,
pp. 507–525 **[secondary]**. ABRA is fortunate here: differential testing against Showdown is a
*pseudo-oracle*, the strongest practical option — see William M. McKeeman, "Differential Testing
for Software", *Digital Technical Journal* 10(1), 1998, pp. 100–107 **[secondary]**, which is the
canonical citation for the technique ABRA is built on.

---

## 5. Where the evidence does NOT support the obvious answer

The brief asked for this explicitly. Four places.

### 5.1 Mutation score is a much weaker proxy for real defects than usually claimed, and the two best studies disagree

This is a genuine, unresolved disagreement in the literature and it should not be smoothed over.

- **Just, Jalali, Inozemtseva, Ernst, Holmes, Fraser, "Are mutants a valid substitute for real
  faults in software testing?", FSE 2014** **[secondary]**. 357 real faults across five Java
  projects, ~321,000 SLOC. Reported a statistically significant correlation between mutant
  detection and real fault detection "independently of code coverage"; the widely-quoted figure is
  **73%**. This paper is the reason the field trusts mutants as fault proxies.
- **Papadakis, Shin, Yoo, Bae, "Are Mutation Scores Correlated with Real Fault Detection? A Large
  Scale Empirical Study on the Relationship Between Mutants and Real Faults", ICSE 2018**
  **[read]**. 420 real faults, C *and* Java (CoREBench + Defects4J), and it **controls for test
  suite size**, which Just et al. did not. Result: uncontrolled correlations replicate Just's
  (they say so explicitly, "consistent with those reported by the work of Just et al."), but
  **"These correlations become relatively weak (approximately within the range 0.05 to 0.20) when
  the suite size is controlled."** Their conclusion: "using mutants as substitutes of real faults
  (as performed in most of the software testing experiments) can be problematic."

The mechanism they identify is damning for mutation score as a *metric*: only **~1% of mutants**
have behavioural similarity above 0.5 to a real fault. "irrelevant mutants cause the weak
correlations."

**But the same paper rescues mutation testing as a *practice*:** at the highest mutation-score
levels, fault detection improves significantly — average improvement for the top-ranked 25% and
10% of suites was **8% and 11% (Defects4J)** and **18% and 46% (CoREBench)**. Their own summary:
"mutants provide good guidance for improving the fault detection of test suites, but their
correlation with fault detection are weak."

**Read together: use mutants to find holes; do not use mutation score as a number.** Google reached
the same place independently and for a different reason (§2.2 — they could not compute it or
surface it usefully).

### 5.2 The same confound bites the coverage literature, and one project went negative

Inozemtseva & Holmes **[read]** found Kendall τ = **−0.35** for HSQLDB between coverage and
normalized effectiveness. Papadakis **[read]** catalogues the wider disagreement: Gopinath et al.
report size does *not* improve the regression; Inozemtseva & Holmes report it dominates; Andrews
et al. and Namin & Kakarla, on the *same program and fault set*, reached **opposite conclusions**
about mutant/fault correlation. Papadakis's own words: "it should be obvious that there is much of
controversy on the finding of previous studies".

Anyone quoting a single coverage-effectiveness correlation as settled science is quoting one arm
of an unsettled literature.

### 5.3 The equivalent-mutant problem is undecidable and will not be engineered away

Determining mutant equivalence is undecidable (Budd & Angluin, 1982) **[secondary]**. Practical
consequence: some fraction of surviving mutants can never be killed, they inflate the denominator,
and someone must burn time deciding. Google's answer was not to solve it but to *avoid generating*
those mutants via 100+ hand-written rules — which is an admission that the general problem is not
solvable at reasonable cost.

**This is the strongest argument for ABRA's knob-flip approach over generated mutation**: a
`MEDI_*` restore knob is *known* to be non-equivalent by construction, so the undecidable question
never arises.

### 5.4 Test smells are a dead end for this specific failure

Stated in §1.4 and repeated here because it is the most likely wrong turn. 82% of JUnit classes
carry a smell (Bavota 2012) **[secondary]** — a signal that fires on four fifths of everything is
not a detector. Six of ABRA's seven cases had well-formed assertions and would pass every smell
detector in the literature.

---

## 6. Recommendation under the stated constraint

Will, 2026-08-23: *"lets fix them all, but i dont want unnecessary bloat or you adding gates or
tests on gates or tests that fail, just simple bulletproof fixes"*.

The literature supports that constraint rather than fighting it. Ranked:

**1. Reuse the existing counter machinery on oracle clauses.** Ball & Kupferman Remark 3. Every
assertion clause marks itself when it fires; a clause that never fired in a full run is a zero,
and the repo already has the rule that "a capability that cannot prove it ran is assumed broken."
This is not a new gate — it is the existing zero-counter rule pointed at a new set of objects.
Catches shapes 3, 4, 5, 7.

**2. Flip the `MEDI_*` knob on every probe that has one; assert the probe goes red.** This IS the
vacuity check under its formal definition, and it is mutation testing with n=1 and a
human-chosen, guaranteed-non-equivalent mutant. It costs one extra run per probe and inherits none
of the 85%-unproductive problem. Catches shapes 1, 6, 7 and would have caught 3. The repo has
already proved the pattern works (the Damp 0 → 1 control).

**3. One structural fix, not a check: stop anchoring red plants to source strings.** Key them to
the tag/param identity the engine dispatches on, so a plant that no longer applies is a hard error.
This is the only recommendation with no literature behind it, because §3.2 found none — and it is
the one that makes the defect *impossible* rather than *detected*, which is the class the
constraint asks for.

**4. Re-file, do not delete, shape 2.** A test that pins current behaviour is a *characterization
test* (Feathers 2004) and is legitimate — as long as it is not counted as evidence of correctness.
Assert on board state, not protocol ordering; the repo's own "commentary may differ; boards may
not" rule is the right line and shape 2 was written on the wrong side of it.

**Explicitly NOT recommended:** adopting a mutation-testing framework, computing a mutation score,
adopting a test-smell detector, or building checked-coverage slicing. Each is either 85% noise
without a multi-year filter (§2.2), a metric two of the best studies say is weakly correlated with
what it claims to measure (§5.1), a detector that fires on 82% of everything (§5.4), or
infrastructure whose cheap form is already recommendation 1.

---

## Sources

Read directly (PDF extracted and read in this session):

- Petrović, Ivanković, Fraser, Just. *Practical Mutation Testing at Scale: A view from Google.* arXiv:2102.11378, 2021.
- Petrović, Ivanković, Fraser, Just. *Does mutation testing improve testing practices?* ICSE 2021. arXiv:2103.07189.
- Inozemtseva, Holmes. *Coverage Is Not Strongly Correlated with Test Suite Effectiveness.* ICSE 2014.
- Zhang, Mesbah. *Assertions Are Strongly Correlated with Test Suite Effectiveness.* FSE 2015.
- Papadakis, Shin, Yoo, Bae. *Are Mutation Scores Correlated with Real Fault Detection?* ICSE 2018.
- Ball, Kupferman. *Vacuity in Testing.* TAP 2008, LNCS 4966. (Contains the Beer et al. 20% quote.)
- Eagle. *Testing on the Toilet: Change-Detector Tests Considered Harmful.* Google Testing Blog, 2015-01-27.

Secondary (search-engine summary only — verify before quoting):

- DeMillo, Lipton, Sayward. *Hints on Test Data Selection.* Computer 11(4), 1978, 34–41.
- Beer, Ben-David, Eisner, Rodeh. *Efficient Detection of Vacuity in Temporal Model Checking.* FMSD 18, 2001, 141–163 (CAV 1997).
- Voas. *PIE: A Dynamic Failure-Based Technique.* IEEE TSE 18(8), 1992, 717–727.
- Ammann, Offutt. *Introduction to Software Testing.* Cambridge UP, 2008/2017. (RIPR.)
- Just, Jalali, Inozemtseva, Ernst, Holmes, Fraser. *Are mutants a valid substitute for real faults in software testing?* FSE 2014.
- Beller et al. *What It Would Take to Use Mutation Testing in Industry — A Study at Facebook.* ICSE-SEIP 2021. arXiv:2010.13464.
- van Deursen, Moonen, van den Bergh, Kok. *Refactoring Test Code.* XP 2001, 92–95.
- Meszaros. *xUnit Test Patterns: Refactoring Test Code.* Addison-Wesley, 2007.
- Bavota, Qusef, Oliveto, De Lucia, Binkley. *An Empirical Analysis of the Distribution of Unit Test Smells and Their Impact on Software Maintenance.* ICSM 2012, 56–65.
- Feathers. *Working Effectively with Legacy Code.* Prentice Hall, 2004. (Characterization tests.)
- Schuler, Zeller. *Assessing Oracle Quality with Checked Coverage.* ICST 2011.
- Vera-Pérez, Danglot, Monperrus, Baudry. *Suggestions on Test Suite Improvements with Automatic Infection and Propagation Analysis.* arXiv:1909.04770, 2019.
- Barr, Harman, McMinn, Shahbaz, Yoo. *The Oracle Problem in Software Testing: A Survey.* IEEE TSE 41(5), 2015, 507–525.
- McKeeman. *Differential Testing for Software.* Digital Technical Journal 10(1), 1998, 100–107.
- Budd, Angluin, 1982 (undecidability of mutant equivalence).
