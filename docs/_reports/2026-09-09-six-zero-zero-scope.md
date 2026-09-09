# What 6.0.0 actually costs — scoped 2026-09-09, before the gate opened

**THIS IS DATED EVIDENCE, NOT CURRENT STATE.** Every number here is derived, so re-derive it on the
day rather than quoting this file. The commands are in each section. `docs/_reports/` is historical
by construction and is never cited as current state.

Scoped while narration batch S was running, so that the 6.0.0 pass is a worklist rather than a
surprise. The gate was **1 of 9 failing** at the time (narration, 33 of 961; board-material 0 of 958).

## The four jobs, measured

| job | size | command that derives it |
|---|---|---|
| figures resting on a withheld artifact | **72**, across 64 withheld artifacts | `node engine/docs_scan.js --quarantine` |
| figures nothing can trace | **33**, across 5 documents | same |
| running-notes rows owed to the major | **42 of 100** | `node engine/docs_scan.js --owed` |
| PDFs to rebuild | **11**, from 71 markdown sources, 7 excluded | `node build/build_pdfs.js` |

## Where the 72 live

`docs/MODELS.md` and `docs/ABRA-whitepaper.md` carry the bulk, with `docs/SUMMARY.md` behind them.
`docs/ENGINE.md`, `docs/SEARCH.md` and `docs/ABRA-technical-docs.md` are single-digit each. The
division ledgers are working documents and get no PDF, but they still carry figures and still owe the
rewrite.

## Where the 72 come FROM, which is the part that decides the plan

| withheld artifact | figures resting on it |
|---|---|
| `data/search-decision-profile.json` | 20 |
| `data/policy-weights.json` | 8 |
| `data/feature-shift.json` | 4 |
| `data/sheet-channel-value.json` | 2 |
| `data/leaf-position-contrast.json` | 2 |
| `data/feature-engine-contrast.json` | 2 |
| `data/exploitability.json` | 1 |
| `data/exploit-step-probe.json` | 1 |

## THE FINDING: NOT EVERY WITHHELD FIGURE BECOMES QUOTABLE AT 6.0.0, AND THE DOCUMENT MUST SAY WHICH

Will sequenced the MAG refit **after** 6.0.0 (2026-09-09: *"yes skip mag it comes after 6.0.0"*), and
`data/policy-weights.json` is not re-run before then. So **the 8 figures resting on the weights stay
withheld through the major**, along with anything downstream of them.

That is correct rather than a gap, and it has one hard consequence:

- **6.0.0 ships saying which numbers are absent and why.** A caption is not a quarantine — this
  repository has proved twice that a warning printed beside a number gets skimmed past (`PRE-CHANGE`,
  "one of the two known failures"). The figure comes OUT; the sentence explaining its absence goes in.
- **The re-run in step 6 must not be reported as "the quarantine lifted".** It lifts for the artifacts
  that are re-run. `engine/status.js` computes the rest, and it is read rather than remembered.

## The back-cast obligation, which is what makes this a MAJOR and not a MINOR

ESS *Guidelines on Revision Policy* Item 3.4, which this repository already keeps: a major revision
ships with the reasons for the revisions, their impact, and **a comparison between the new and the old
series**. So each of the 72 rewrites carries the old value beside the new one, not the new one alone.
`engine/arms_comparable.js` answers COMPARABLE for one artifact at a time and is the closest thing to
an automatic check; everywhere else the comparison is written.

## The 33 untraceable figures are a separate job and a harder one

`docs/MODELS.md` 13, `docs/ABRA-whitepaper.md` 10, `docs/SLOWKING-whitepaper.md` 7,
`docs/ROLE-FAMILY.md` 2, `docs/ARCHITECTURE.md` 1.

These are not withheld — they are figures with no artifact behind them at all. Re-running the
quarantine does nothing for them. Each one is either re-derived from a run, cited to a source line, or
deleted. **A major release should not carry a number nothing can trace**, and this is the pass where
that gets decided rather than carried forward again.

## What this does NOT include

The narration clause itself, the roster's 14 control-not-quiet abilities, and the ability rows with no
legal carrier — all engine work, all upstream of this, all tracked in `docs/RUNNING-NOTES.md`.

---

# CORRECTION, same night, ~2 hours later. BOTH HEADLINE NUMBERS WERE TOO HIGH, AND ONE OF THEM WAS AN INSTRUMENT.

The two hardest-looking jobs above were the two that had not been split by document. Splitting
them is what showed that neither is what it looked like. **Nothing above is edited — a dated
record is not rewritten to agree with today.**

## 1. `33 untraceable figures` was 33 only because a bibliography counted as unsourced claims

**10 of the 33 were reference entries** — `arXiv:2007.13544`, `DOI:10.1126/sciadv.adg3256` and five
more in one bibliography, plus `arXiv 2304.08272` cited in two other documents. A references block
is the one place a document is MOST traceable, and clearing any of them would have meant deleting a
citation to satisfy a gate.

Fixed at the lexer (5.269.1), with the control case that keeps it honest: a real figure standing
beside a citation is still read.

**~~33 across 5 documents~~ → 23 across 3.** `docs/SLOWKING-whitepaper.md` and `docs/ROLE-FAMILY.md`
leave the census entirely.

**And 7 of the remaining 23 need no action at 6.0.0** — they are figures quoted inside their own
WITHDRAWN/CORRECTED notice in `docs/MODELS.md` and `docs/ABRA-whitepaper.md`, which is the record
working as designed. So the real decision list is about **16**, not 33.

## 2. `72 figures resting on a withheld artifact` is right, and most of them are not in a document that gets rewritten

The 72 is correct as a count. It was misleading as a **workload**, because it had not been split:

| where the 72 actually are | count | does 6.0.0 rewrite it? |
|---|---|---|
| `docs/RUNNING-NOTES.md`, `docs/ROADMAP.md` | 26 | **no** — declared residuals; rows are folded in, not rewritten |
| division ledgers (`MEASURE` 15, `ENGINE` 6, `SEARCH` 6, `OPS` 1) | 28 | they owe currency, but they get no PDF and no fold-in |
| **the living set** — `ABRA-whitepaper` 4, `ABRA-technical-docs` 3, `MODELS` 6 | **13** | **yes** |
| dated reviews and side documents | 5 | mostly no |

**So the living-document rewrite is ~13 figures, not 72.** `docs/ABRA-deck-plain-english.md` and
`docs/SUMMARY.md` carry ZERO figures resting on a withheld artifact.

## What this does not change

The MAG finding stands and is still the load-bearing one: `data/policy-weights.json` is not re-run
before 6.0.0, so the figures resting on it stay withheld through the major and the documents must say
which numbers are absent and why. The back-cast obligation stands. The 42 owed notes rows stand.

**The lesson is the one this repository keeps re-learning: a count is evidence of what exists, never
of how much work it is.** Both headline numbers survived contact with a `--json` split for about two
hours.

---

# SECOND CORRECTION, same night. `~13` UNDERSTATED THE LIVING-DOCUMENT REWRITE, BECAUSE IT COUNTED ONE OF THREE CATEGORIES.

The correction above is right about what it measured and wrong as a total. "Figures resting on a
withheld artifact" is **one** of three ways a figure in a living document needs attention at a major,
and it is the smallest of the three. Stated here rather than left standing, because it is a number
somebody would plan against.

## The three categories, and they are different questions

| | count | what it means | can it be fixed before the re-run? |
|---|---|---|---|
| resting on a **withheld** artifact | **13** | the artifact exists but is quarantined | **no** — waits for step 6 |
| **stale citation** — cited to an artifact that no longer holds that value | **61 keys, 84 lines** | the artifact was re-run and moved under the sentence | yes |
| **untraceable** — no artifact behind it at all | **~16** (23 less the 7 inside their own withdrawal notice) | nothing to re-run | yes, by deriving, citing or deleting |

**All 84 stale-citation lines are in the living set**: `docs/MODELS.md` 41, `docs/ABRA-whitepaper.md`
20, `docs/SUMMARY.md` 19, `docs/ABRA-technical-docs.md` 3, `docs/ABRA-deck-plain-english.md` 1. So the
earlier line that the deck and SUMMARY "carry ZERO" is true **only** of the withheld category, and
misleading if read as a total. SUMMARY carries 19 stale citations and the deck carries 1.

Examples, and they are exactly the shape you would expect from an engine that has been fixed for a
month: `934` cited to `data/game-differential.json`, which now holds **961**. `818` cited to
`data/mechanics-census.json`, which now holds **830**.

## THESE ARE ACCEPTED, NOT UNKNOWN — AND ACCEPTED IS NOT DONE

**Zero of the 84 are new.** All map onto the 61 keys in `data/docs-currency-baseline.json`, each
carrying a written reason, which is why `tests/test-docs-current.js` passes 33 of 33. The gate is
correct.

But a baseline is a statement that a mismatch is *understood*, not that it is *resolved*. At a major
the documents are rewritten, and a figure whose artifact moved under it is precisely what the rewrite
is for. **Carrying 61 accepted mismatches through a major would be the caption-is-not-a-quarantine
failure in a third costume.**

## So the honest size of the 6.0.0 living-document pass

Roughly **85–90 figure-level edits**, before counting the 42 notes rows that fold in. Bounded, and
about a day of writing — not the ~13 the correction above implies and not the 72 the original section
implies. **Three counts existed, each was correct about its own question, and none of them was the
workload.**

---

# PROVENANCE IS NOT A 6.0.0 BLOCKER, AND THE HEADLINE COUNT SAYS OTHERWISE

`engine/status.js` prints **182 UNSAFE** artifacts, which reads as 182 things to fix before a major
can rest on them. Bucketed by reason it is one condition and four cases:

| reason | count |
|---|---|
| `OLDER THAN THE QUALITY FILTER — computed under different rules about what counts` | **178** |
| `older than its input regulations.json` | 1 |
| `not store-derived: it records which artifacts are downstream` | 1 |
| `COMPUTED FROM DIFFERENT CONTENT` — `engine/medicham2-browser.js`, `engine/next_regulation.js` | 2 |

**The 178 are one systemic fact, not 178 findings**: they predate a change in what counts as a
quality-filtered game, and most are quarantined anyway. Step 6 re-runs them and they get fresh
stamps — the count falls out of the re-run rather than needing its own project.

**The 2 `COMPUTED FROM DIFFERENT CONTENT` rows are tonight's own edits** — the simulator under batch S,
and `next_regulation.js` under the rotation-checklist fix. Correct behaviour, not a defect: the check
compares CONTENT rather than mtime, which is the whole reason it was rewritten.

**15 of the 182 are scratch files** with a leading underscore (`_void-final.json`, `_turncap-cap30.json`
and so on). They are working artifacts and are counted beside published ones, which is a third
instance of tonight's pattern — a count that is correct and is not a workload.
