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
