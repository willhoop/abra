# Withdrawing quarantined figures from the living documents — 2026-09-06

MEASURE. Documents only; no engine job, no differential, no census, no roster, no release cut, and
`node engine/status.js --write` was deliberately not run (an ENGINE agent was editing
`engine/medicham2-browser.js`, `engine/board_state.js` and `engine/game_differential.js` and
rewriting `data/game-differential.json` throughout — that artifact was last written at 05:44 while
this pass was running, so it was never read).

## The ratchet

| | figures firing |
|---|---|
| before | **104** across 14 documents, 72 artifacts withheld |
| after | **37** |
| cleared | **67** |

`node tests/test-docs-quarantine.js` is GREEN. The seeded census literal still reads 104 and now
prints 67 keys to delete; re-seeding it to 37 belongs to the owner of `tests/`, which this pass was
not permitted to edit.

## Per document

| document | before | after | note |
|---|---|---|---|
| `docs/ABRA-whitepaper.md` | 15 | 2 | both remaining are coincidence matches |
| `docs/MODELS.md` | 23 | 5 | all five coincidence |
| `docs/SUMMARY.md` | 8 | 0 | cleared |
| `docs/MEASURE.md` | 17 | 0 | cleared |
| `docs/MILTANK.md` | 2 | 0 | cleared |
| `docs/SEARCH.md` | 5 | 2 | both remaining are planned budgets, matched by accident |
| `docs/WEB.md` | 4 | 2 | both remaining are coincidence |
| `docs/PRIORITIES.md` | 1 | 0 | cleared |
| `docs/EXTERNAL-EVIDENCE.md` | 1 | 0 | cleared |
| `docs/GAME-DIFFERENTIAL-DESIGN.md` | 1 | 0 | cleared |
| `docs/ENGINE-COVERAGE-PLAN.md` | 1 | 0 | cleared |
| `docs/ABRA-technical-docs.md` | 2 | 2 | both coincidence; its REAL offenders were invisible, see below |
| `docs/ENGINE.md` | 5 | 5 | 3 coincidence, 2 classifier candidates; the file was being edited by ENGINE and was not touched |
| `docs/ROADMAP.md` | 19 | 19 | 15 are the census / register / rate-runner class, 4 are `feature-shift` |

## The shape of every removal

`engine/status.js`'s `sayHeld` shape, used verbatim: the figure is ABSENT; the artifact is named
together with WHY it is downstream of MEDICHAM; the condition is named (the gate opening, with
`node engine/status.js` given as the thing that says which clause fails); and the re-run command is
named. Where a paragraph's verdict was itself the withheld artifact's conclusion, the verdict went
with the figures and the paragraph says so — a withheld number whose direction is still stated in
words has not been withheld.

Withheld in this pass: the leaf/engine contrast (whitepaper, SUMMARY, MODELS, technical docs, deck,
GAME-DIFFERENTIAL-DESIGN), the leaf backtest reading (whitepaper, MEASURE, SEARCH, WEB), R1 and R4
(MILTANK, MEASURE, EXTERNAL-EVIDENCE), the leaf cost bench (MEASURE), the exploitability share and
its interval (MODELS, MEASURE, PRIORITIES, WEB), the exploit step probe (ENGINE-COVERAGE-PLAN), the
fit corpus and its split (whitepaper, MODELS, SUMMARY, MEASURE, deck, technical docs), the
click-censoring census, the joint fit, the sheet channel value, and the censoring-value paired
result.

## The finding this pass did not go looking for

**The deck and the technical docs were carrying the same withheld figures and the ratchet could not
see them.** The clause fires on a figure that shares a PARAGRAPH with a citation of the withheld
artifact. `docs/ABRA-deck-plain-english.md` writes in plain English and names artifacts nowhere near
its numbers, so it scored **zero** offenders while republishing the leaf comparison (it ran the leaf
over the contrast corpus "twice") and the censored-label counts. `docs/ABRA-technical-docs.md` did
the same in two change records. Both are withheld now — found by grepping the whitepaper's withheld
values across the other living documents, not by the gate.

The general point belongs to the instrument rather than to those two files: **a document that cites
nothing is invisible to a rule keyed on citations**, and the plain-English deck is the document most
likely to cite nothing. A second clause — figure-level, over the union of withheld artifacts, with no
citation requirement — would catch this class, at the cost of a much larger coincidence surface (see
below). That is a judgement for the owner of `tests/test-docs-quarantine.js`.

## The 37 that stand are the CLASSIFIER, not the documents

Withholding a legitimately quotable number is its own defect, so none of these was touched. Two
distinct causes, both measured rather than argued.

### 1. A coincidence engine inside `data/policy-weights.json`

`artifactNumbers` walks strings, and that artifact carries a `featureHashes.features` map of integer
HASHES. Six of them match a document figure by accident once the matcher's legitimate x100 and /100
rescaling is applied — the hashes of `benchRisk`, `tgtBulk`, `koFirst`, `switchSurvives1`, `pivots`
and `statusBites`. Two fitted floats do the same: one weight rescales onto a percentage that is
really the empirical-click driver's result-reach rate, and one unweighted column onto an
out-of-sample immune-move rate. The hash values are not written out here, because writing them out is
itself a republication — that was demonstrated when this very finding, written with the numbers in
it, tripped the gate three times.

The document figures involved belong to sources that are NOT withheld:

| figure | where | what it really is |
|---|---|---|
| `6,000` | whitepaper, technical docs | the damage differential, zero of six thousand |
| `49.3%` | whitepaper, technical docs, MODELS | the empirical-click driver reaching a result, from `data/game-differential.json` |
| `42.0%` | MODELS | DODUO's unpaired win rate over 1,934 games |
| `2.92%` | MODELS | an immune-move rate from a 600-battle out-of-sample run |
| `23.4%` | MODELS | humans double-targeting, measured at `engine/board.js:377` |
| `5,500` / `1,600` | SEARCH | a PLANNED budget, arithmetic stated in the document itself |
| `16.9%` / `84.3%` | WEB | a corpus-drift share and a coverage share of other artifacts |
| `1596` / `1200` / `6,000` | ENGINE | a census count and two command-line arguments |
| `26,232` | MODELS | teams in the frozen pool, matched against a string inside `all-mechanics-fire.json` |

This is the "registry that fires on every occurrence of a small integer" failure `engine/docs_scan.js`
already records in its own header, arriving through a hash table. The fix is in the matcher, not in
the documents: `featureHashes` is a lookup table, not a measurement, and a hash has no business in
the number set an artifact is judged to "contain".

### 2. Instruments that MEASURE MEDICHAM rather than consume it

`engine/quarantine.js` already has the exemption mechanism — `MEASURES_THE_ENGINE` — and it holds
exactly two modules: `engine/game_differential.js` and `engine/derive_protocol_events.js`. Everything
else is withheld on pure `require` reachability. So these are withheld today:

| artifact | generator | what it actually measures |
|---|---|---|
| `data/all-mechanics-fire.json` | `engine/all_mechanics_fire.js` | THE CENSUS — CLAUDE.md names it as NOT quarantined, in as many words |
| `data/million-run.json`, `-staged` | `engine/million_run.js` | plays MEDICHAM at volume and tallies what the dice DID against `data/million-targets.json` |
| `data/register-reality.json` | `engine/register_reality.js` | audits ROADMAP rows against the instruments that back them |
| `data/open-work.json` | `engine/open_work.js` | a COPY of a document; `docs_scan.js` already refuses to treat it as an artifact in its own census |
| `data/medicham-represented-clicks.json` | `engine/medicham_coverage.js` | what fraction of real human clicks MEDICHAM can represent at all |

Fifteen of `docs/ROADMAP.md`'s nineteen are this class. The fix is an entry in `MEASURES_THE_ENGINE`
per artifact, carrying the same one-sentence justification the two existing entries carry. That is an
ENGINE/MEASURE code change and is owed; it was not made here because `engine/` was out of scope for
this pass and the simulator was moving.

**Less certain, and flagged rather than claimed:** `data/feature-shift.json` (4 keys in ROADMAP) and
`data/feature-engine-contrast.json` (2 keys in ENGINE) are instruments that compare the FEATURE layer
across two engines — the same shape as the differential, but features are genuinely downstream of the
simulator in the invalidation graph. They are left withheld. Somebody should rule on them
deliberately rather than by omission.

## Gates

| gate | reading |
|---|---|
| `node tests/test-docs-quarantine.js` | GREEN — 37 known offenders stand, 0 new, 67 reported gone |
| `node tests/test-docs-current.js` | GREEN — 24 passed, 0 failed; version rule at 5.261.0 (25 versioned, 19 pinned); untraceable 35 to 34 |
| `node tests/test-roadmap-register.js` | GREEN — 3 passed, 0 failed |
| `node build/build_pdfs.js --check` | 14 of 15 rebuilt; `ENGINE.pdf` left stale ON PURPOSE |

Three notes on the gate runs:

- **`data/docs-currency-baseline.json` was rewritten by `tests/test-docs-current.js` itself**, not by
  hand: the untraceable ratchet TIGHTENED by one when a figure left `docs/ABRA-technical-docs.md`.
  The test stages it and says so. It is a shrink, and it is the only file under `data/` this pass
  touched.
- **`docs/ENGINE.md` and `docs/ENGINE.pdf` were left alone.** ENGINE.md gained 208 lines at 06:01
  from the other agent while this pass ran. Its five quarantine keys are 3 coincidence and 2
  classifier candidates, so nothing was owed there anyway, and rebuilding its PDF would have
  photographed a document mid-edit.
- **The PDFs were built through `build/md_to_pdf.js` per file**, which is the same tool
  `build/build_pdfs.js` shells out to, because the driver has no filter and would have rebuilt
  `ENGINE.pdf` with it. `--check` now reports exactly that one file stale.

## Owed

1. The two classifier repairs above — the `featureHashes` exclusion in `engine/docs_scan.js`, and the
   `MEASURES_THE_ENGINE` entries in `engine/quarantine.js`. Both are outside a documents pass.
2. `node engine/status.js --write`, once the ENGINE agent is done. Every division ledger's generated
   block is one pass behind.
3. Re-seeding the census literal in `tests/test-docs-quarantine.js` from 104 to 37.
4. A ruling on `feature-shift` and `feature-engine-contrast`.
5. A decision on whether the quarantine clause should also run WITHOUT the citation requirement, on
   the evidence of the deck.
