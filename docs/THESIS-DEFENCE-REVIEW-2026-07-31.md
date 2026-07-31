# ABRA — thesis defence, 2026-07-31

**Re-defence.** The prior committee (2026-07-27) returned **MAJOR REVISIONS** on two grounds it
called fatal. This defence examines whether those revisions were made, and whether the work now
constitutes defensible research.

Every number below was produced by running something during this defence. No figure is taken from a
document; several are known stale.

---

## Verdict: **PASS WITH MINOR REVISIONS**

The two flaws the prior committee called fatal have been addressed — one completely, one
incompletely. The incomplete one is the single revision standing between this and an unqualified
pass, and it is narrow enough to be closed in a day.

What raises this above the prior verdict is not the fixes alone. It is that **this project's
epistemic practice is now better than most published work I review**: null results are foregrounded
rather than footnoted, failed models carry warning markers *in the summary table*, a known selection
bias is documented at the point of filtering with the exact phrasing required downstream, and the
project's own tooling caught two of its authors' errors during the reviews that preceded this one.

What holds it back is one specific act of **incomplete revision**, below.

---

## 1. The claim, and what kind of contribution it is

**This is a competent application of known methods to a new domain, not a novel method.** The thesis
must say so plainly, and largely does: RAPM from basketball, WAR from sabermetrics, NMF for soft
clustering, conditional logit (McFadden 1974), REINFORCE, CFR/ReBeL-lineage belief search. All
off-the-shelf. The prior committee said the same and the project did not contest it.

That is a legitimate doctoral contribution **provided the transfer is argued rather than asserted**,
and here the project is stronger than typical. The clearest example is the rank-selection script's
refusal of an obvious citation:

> *"Mimno et al. 2011 topic coherence is built for LDA over word co-occurrence and transfers
> awkwardly to a small dense team × role matrix. Stability asks the question this project actually
> needs answered."*

That is engagement with the literature, not decoration. It rejects a method **on grounds of the
transfer**, which is exactly what the prior committee demanded.

**The genuinely novel content is smaller than the project implies and should be stated as such:** the
measurement culture itself — paired seed-matched A/B with an explicit "arms indistinguishable"
refusal, the preflight gradient check, the derived-artifact audit. Those are contributions to
*research practice in this domain*, not to machine learning.

---

## 2. The mathematics

### 2.1 The WAR ridge — **FIXED, and the correction was large**

The prior committee: *"The WAR ridge parameter is chosen by hand. This is a fatal flaw."* It was
`RIDGE = 6.0`, typed.

It is now selected by a sweep minimising held-out log-loss, with a Spearman rank-stability check
across the sweep. Measured from the artifact:

| | value |
|---|---|
| selected by criterion | **200** |
| legacy hand-chosen | **6** |

**A 33× correction.** The old value is retained as `ridge_legacy` so the change is visible rather
than silently absorbed. This is the correct response to the finding and it is complete.

### 2.2 The NMF rank — **THE REVISION IS INCOMPLETE, and this is the blocking item**

The prior committee: *"The NMF rank is a literal. 'Next' is not a justification."*

The candidate built the criterion. `engine/nmf_rank.py` selects rank by **bootstrap factor
stability**, citing **Brunet et al. 2004 (consensus NMF)** — the correct citation for this method —
and comparing against a **null model**, which is more than the committee asked for. It was run on
2026-07-28. The artifact says:

| rank | stability | recon. err | null stability | **excess over null** |
|---|---|---|---|---|
| 4 — *most reproducible* | 0.9992 | 0.5271 | 0.9217 | **+0.0775** |
| **6 — SHIPPED** | 0.8148 | 0.4701 | 0.9218 | **−0.1070** |

**The shipped rank has negative excess over null.** Rank-6 factors are *less* reproducible across
bootstrap resamples than factors fitted to shuffled data. On the project's own criterion, the six
archetypes are not distinguishable from structure found in noise.

The criterion was built, run, and recorded honestly in the artifact — and **the shipped
configuration was not changed, and the disagreement does not appear in any living document.**
`docs/SUMMARY.md:68` still reads:

> **NMF** … ✅ Built … Role-level factorization → **6 clean archetypes (recon-err 0.53)**

It justifies the rank with **reconstruction error**, which `nmf_rank.py`'s own caveat states cannot
select a rank: *"falls monotonically with rank by construction and cannot select it; it is reported
beside stability, not instead of it."*

**This is not dishonesty** — the artifact is transparent and a reader who opens it sees everything.
It is an **incomplete revision**: the machinery the committee demanded was built and then not acted
on. For a thesis, a criterion that is run and then overridden without stated grounds is worse than no
criterion, because it converts a hand-chosen constant into an apparently-principled one.

### 2.3 Noisy-OR — the independence assumption

The role model aggregates per-species role evidence by noisy-OR, which requires the sources to be
**conditionally independent given the latent role**. They are not: teammates are chosen jointly, and
`smogon-priors.json` ships an explicit `teammates` field measuring exactly that dependence. The
assumption is violated in a known direction — correlated sources make noisy-OR **overconfident**.

The project does not claim otherwise anywhere I found, but it does not state the violation either.
**Minor revision: state it, and note the direction of the resulting bias.**

### 2.4 Wilson intervals and the paired design — correct

Checked arithmetically. The overnight head-to-head reports 48.1% on 3,363 decisive pairs with a 95%
interval of [46.5, 49.8]. Wilson at n=3,363, p̂=0.481 gives a half-width of ≈1.69 points, so
[46.4, 49.8]. **The reported interval is correct to rounding.**

The paired design is the right one and the *discarded splits* are the reason: 6,365 of 9,728 pairs
(65.4%) split one-each, meaning the team decided the game rather than the policy. An unpaired win
rate over those games would be almost pure team noise. Discarding them is correct and the project
does it by default.

---

## 3. Statistical validity

### 3.1 The headline negative result is sound

**Self-play training lost: 48.1% [46.5, 49.8].** The interval excludes 50 on both ends. This is a
real, well-powered negative result on 9,728 paired games, and it **contradicts an earlier reported
55.9% self-play win**. Both cannot describe the same system; the configurations differ (53 features
without switching vs 56 with).

**Required revision:** the thesis must reconcile these two numbers explicitly or withdraw the earlier
one. Two self-play results in opposite directions, both reported, with no stated reason for the
disagreement, is the kind of thing that unravels a defence.

### 3.2 Multiplicity — **the weakest statistical point, and it is not corrected anywhere**

This project runs many paired experiments and reports the ones that separate. I found **no
multiplicity correction anywhere in the repository** — no Bonferroni, no Benjamini–Hochberg, no
family-wise statement.

For the headline positives this matters less than it might, because the effects are large relative to
their intervals (greedy at 79.7% of decisive pairs is not a multiplicity artefact). For the **feature
weights**, it matters a great deal: 56 weights are reported with individual 95% intervals, and at
α=0.05 roughly **2.8 of them would clear zero by chance alone**. The three new features (+2.220,
+1.128, +0.983) survive any correction comfortably; several of the small ones would not.

**Required revision:** state the family, apply a correction to the per-feature intervals, and mark
which features survive it. This is a half-day of work and it is the difference between "56 measured
weights" and "56 weights, of which k are individually defensible".

### 3.3 The full-bring filter conditions on an outcome-correlated variable — **acknowledged correctly**

The rule requires all four brought Pokémon to be revealed. Measured directly:

| | games | mean turns | median |
|---|---|---|---|
| full bring (kept) | 19,589 | **7.4** | 7 |
| dropped | 8,713 | **4.3** | 4 |

**The filter keeps games 1.71× longer on average.** This is real selection bias in any bring
statistic.

**The candidate found this before I did**, and `data/quality-filter.json` states it at the point of
filtering with the correct epistemics:

> *"This conditions on game length, so the filtered set skews toward longer games. A bring statistic
> computed here is 'the bring, among games long enough to show it', which is not the same as 'the
> bring'. **State it that way.**"*

That is exemplary. **The minor failing is compliance:** the required phrasing appears in
`ORIENTATION.md` and a prior review, but not in `SUMMARY.md` or the white paper where bring
statistics are actually reported.

### 3.4 Held-out integrity — sound, with one caveat

Splits are **by game**, not by decision, with the reason stated (decisions within a game are
correlated). The realism report is explicitly held back from fitting — *"it stops being evidence the
moment it becomes the objective"*. Both correct.

**Caveat I could not resolve:** the held-out set has been re-used across many refits during
development. Each refit is a fresh split by hash, so it is not the *same* held-out set — but the
corpus is, and the developer has seen its results many times. This is unavoidable in a project of
this shape and should be **stated as a limitation** rather than left implicit.

---

## 4. Null results — **exemplary, and the strongest part of this thesis**

This is where the work most clearly exceeds the standard. Nulls are not footnoted; they are the
headline. `SUMMARY.md` line 25, in the opening section:

> **"Four experiments added knowledge to the model. All four measured a null. Two experiments changed
> what the model is optimising for. Both were large wins."**

And the nulls are *defended*: an overdispersion test across teams reads ~1.00 against 1.169 for a
known real effect, ruling out the obvious confound (a real effect hidden by team heterogeneity).
Failed models carry warning markers **in the summary table**, not in an appendix:

- **GURU** — ⚠️ *"0 statistically-decisive matchups… scores 0.735 vs a coin 0.693 — worse than a coin"*
- **PORY** — ⚠️ *"loses to a two-feature baseline… Report the gain over MATERIAL, not over a coin"*

PORY is the sharpest case: the project built `pory_baseline.py` specifically to attack its own
headline result, found it beaten by `alive_diff + hp_diff`, and **wrote that into the summary**. That
is research integrity of a kind I rarely see defended.

---

## 5. Literature

Citations checked, not counted. **Brunet et al. 2004** for consensus-NMF stability — correct and
correctly applied. **McFadden 1974** for conditional logit — correct. **Mimno et al. 2011** — cited
in order to be *rejected*, with a stated reason about the transfer. The CFR → DeepStack → Libratus →
ReBeL lineage for simultaneous-move belief search is the right genealogy.

**No decorative citation found.** I looked specifically for a method named without engagement and did
not find one. Stated as a negative finding.

---

## 6. Construct validity — better than the brief anticipated

The brief warns: *"a win-probability model validated only against its own simulator has established
internal consistency, not accuracy."* That warning is apt in general and **does not apply here**.

- **Damage** is validated against `@smogon/calc`, an independent MIT-licensed implementation, and
  separately the *official simulator's* damage is validated against the same external arbiter. Two
  independent externals.
- **Win probability** was validated against **held-out human games** — and **it failed**: below
  chance on decisive calls, systematically inverted. The project reported that, diagnosed the cause
  (the policy backs fast offensive teams; those teams lose more), and **demoted the model** from
  predictor to matchup heuristic.

Validating a construct externally, finding it fails, reporting it, and demoting the claim is the
correct scientific sequence. It is done here.

**The remaining construct gap is real and unaddressed:** every head-to-head number in this thesis is
*bot versus bot*. The roadmap says so — *"no model in this project has yet been shown to play VGC
well against anything other than a worse version of itself."* Self-play win rates measure relative
improvement, not competence. **The thesis must not claim competence, and mostly does not.**

---

## 7. Reproducibility

An independent researcher **could** reproduce most of this: the filter is a versioned JSON with a
changelog of rule changes, the test list is derived rather than typed, the simulator is pinned to an
explicit commit (and, as of today, that pin is *verified* rather than asserted), and generators are
named in most artifacts.

**They could not reproduce:**

- Anything downstream of the **31 artifacts** `provenance.js --strict` marks UNSAFE — computed under
  superseded filter rules. Whether they are *wrong* is unprovable from disk.
- The **ladder store itself**, which is gitignored (100 MB GitHub limit) and tracked compressed. A
  reader gets the `.gz`; whether it matches the numbers in the documents at a given commit is not
  checkable without decompressing and re-running.
- Only **36% of artifacts name the script that produced them**, and only **4% (3 of 70)** record
  which filter they used — on a project whose central discipline is the clean/raw distinction.

---

## What I could not evaluate, and why

- **Whether rank 4 is *right***, only that rank 6 is below null on the project's own criterion. I did
  not re-run the NMF; the artifact's own numbers are sufficient to establish the disagreement and
  insufficient to establish the alternative.
- **Whether the 31 UNSAFE artifacts changed materially** under the current filter. Requires
  re-running 31 generators; two prior reviews reached the same wall.
- **The `validate_damage_sim` discrepancy** — 2 of 36 scenarios where the simulator's maximum damage
  is exactly double the calculator's with matching minima. This is a live, unresolved correctness
  question and it sits underneath every number in the thesis. I could not diagnose it and will not
  speculate.
- **How many comparisons preceded each reported result.** There is no experiment registry, so the
  multiplicity burden cannot be computed — only bounded by the 56 reported weights. **The absence of
  a registry is itself the finding.**
- **Whether the earlier 55.9% self-play result would replicate.** It was measured on a different
  configuration that no longer exists.

---

## Required for an unqualified pass

Four items, all specific:

1. **Resolve the NMF rank.** Either ship rank 4, or state in `SUMMARY.md` and the white paper that
   rank 6 is shipped *despite* scoring below the null on bootstrap stability, with the reason.
   Remove "recon-err 0.53" as a justification — the project's own script says it cannot serve as one.
2. **Apply a multiplicity correction** to the 56 per-feature intervals and mark which survive.
   Name the family.
3. **Reconcile 48.1% against 55.9%**, or withdraw the earlier figure. Two self-play results in
   opposite directions cannot both stand unexplained.
4. **Honour the bring-statistic phrasing** the filter itself mandates, in the documents where bring
   statistics are reported.

Items 1 and 4 are hours. Item 2 is a half-day. Item 3 may be a paragraph or may require a re-run.
None is a research problem; all are reporting discipline.

**The prior committee's fatal flaws are cleared.** What remains is a candidate who built the right
instrument, ran it, got an answer they did not adopt, and did not tell the reader. That is a minor
revision — but it is exactly the kind that becomes a fatal one if it is left standing after two
committees have now asked.

---

*Defended 2026-07-31 against commit `9479487`. PDF built with `build/md_to_pdf.js`; `build/omnibus.py`
renders via weasyprint, which is not on this machine's path — the documented reason `md_to_pdf.js`
exists.*
