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
