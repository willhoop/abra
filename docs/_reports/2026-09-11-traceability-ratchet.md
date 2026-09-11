# The untraceable-figure check becomes a ratchet: a trace must be bound to its claim

2026-09-11 · MEASURE · Will's decision (the RATCHET, over "strict now" and "strict only where informative")
· measured at HEAD `eaf9848d` plus the working tree, which included the other MEASURE agent's staged
`data/quality-filter.json`, `CHANGELOG.md` (6.6.1) and quality files. No games were played.

## Verdict

- **Built.** A figure is traced only when the trace is bound to it:
  - an artifact its paragraph cites holds it at the document's own precision (field-scoped when cited as
    `data/x.json:field`, or leaf-exact when the sentence writes "`key.path` N"); or
  - the CHANGELOG entry its block names carries it. The block names the version in its own text, in a
    heading above it, or as the version opening the ledger paragraph it continues.

  A hit anywhere in `data/` or anywhere in `CHANGELOG.md` is **not** a trace.
- **Grandfathered: 2,258 figures across 24 of 25 living documents.** Written once by
  `node tests/test-docs-current.js --bootstrap-grandfather`, and after that it only shrinks.
- **All four plants behaved.** A control plant was also added. See §4.
- **`tests/test-docs-current.js`: 37/37**, up from 35/35 because of two added clauses: the bound-trace
  demonstration (16 cases) and the grandfather ratchet. No existing clause was weakened. The untraceable
  census still reads 22 across 4 documents, and citation mismatches still read 19.
- **The ~1,395 "coincidence-shaped" figure cannot be reproduced.** The classifier behind it is not on disk.
  My own measurement of the same question is in §3.

## 1. What was built

`engine/docs_scan.js`:

- **`untraceableCensus`** is rewritten. Classes are checked in this order:
  1. BOUND by paragraph;
  2. BOUND by entry;
  3. GRANDFATHERED (key in the list);
  4. UNTRACEABLE: the sentence cites nothing and the value matches nothing anywhere. This is the old
     meaning, unchanged, so `untraceable_by_doc` and `engine/major_readiness.js` read it as before;
  5. PREDATES: a dated block whose every cited artifact was regenerated after it. Reported, not gated;
  6. UNBOUND: fails the gate.

  The union of `data/` and the whole CHANGELOG now does exactly one job: it tells UNBOUND apart from
  UNTRACEABLE.
- **Grandfather key: `doc | sha1(logical sentence)[0..10] | figure as written`.** The logical sentence is
  the paragraph's lines joined, with blockquote markers dropped and each list item starting a new unit
  (`traceUnits`). Re-wrapping a paragraph keeps the key. Editing the sentence or the value drops it.
- **An entry match uses the document's rounding only (`entryHas`), with no ×100/÷100 bridge.** An entry is
  prose in the documents' own units. Of 3,836 entry binds, 20 relied on the bridge, and dropping it took the
  expected coincidental entry binds from ~429 to ~369 (§3).
- **Coherence changes, which are brief item 3:**
  - QUALIFIED sentences that cite an artifact are exempt from the citation rule's accusation, but no longer
    from needing a trace. 82 figures had been judged by nothing.
  - A sentence whose only citation is absent, unparsable or NOT_AN_ARTIFACT now goes to the census (2
    figures). Before, citing a file that is not there took a figure out of both rules.
  - A single `isArtifactRel` check now applies NOT_AN_ARTIFACT everywhere: the citation rule's judged set,
    the census's binding, quarantine route 1's "quotable witness", and route 2's uniqueness denominator
    (`uniqueOwners`). The last one matters now that the baseline holds 2,258 figures as written. The
    quarantine gate is open today, so this moves no count; `tests/test-docs-quarantine.js` still passes.
  - PREDATES parity: a dated block is excused in the census exactly when `citationMismatches` excuses it.
    It is checked after grandfathering and after the untraceable class.
- **The inversion is closed.** Citing no longer costs anything: without a citation, a figure still has to be
  bound. `docs/MODELS.md:2018` cites and is judged strictly. `:1576-1577` did pass on a global match; those
  figures are now grandfathered, and will need binding the day their sentences are edited.
- **`traceProof()` / `TRACE_CASES`** hold 16 synthetic cases, run through the shipping census with the
  artifact, the union, the CHANGELOG and the list injected. The grandfather cases seed their list through the
  bootstrap path.
- **`observe` hook** on the census, used for the measurements below, so they go through the shipping
  function rather than a copy.

`tests/test-docs-current.js`:

- **Clause 3b(d).** An absent list is RED. `--bootstrap-grandfather` writes it only when it is absent, and is
  REFUSED when it exists. It never adopts, not even into an empty list. The per-document count prints on
  every run.

`data/docs-currency-baseline.json`:

- Gains `known.untraced_grandfathered` (per-document arrays of `hash|figure`) and
  `known.untraced_grandfathered_bootstrap` (when it was written, the count, the command, the rule). Both
  were written by the command; nothing was typed.
- **Growth budget:** 29,580 → 91,895 bytes raw, and 10,060 → 26,318 gzipped. One-off; after this it only
  shrinks.

## 2. The per-document grandfather count (bootstrap, 2026-09-11)

| document | grandfathered |
|---|---|
| docs/MODELS.md | 613 |
| docs/ABRA-whitepaper.md | 391 |
| docs/DAMAGE-STAGES.md | 235 |
| docs/SUMMARY.md | 206 |
| docs/ABRA-technical-docs.md | 158 |
| docs/ABRA-deck-plain-english.md | 99 |
| docs/GAME-DIFFERENTIAL-DESIGN.md | 95 |
| docs/predictability-study.md | 65 |
| docs/ADR-002-showdown-is-the-authority.md | 58 |
| docs/MEW-whitepaper.md | 42 |
| docs/PRIOR-ART.md | 40 |
| docs/TAG-COVERAGE.md | 39 |
| docs/ARCHITECTURE.md | 37 |
| docs/ROLE-FAMILY.md | 31 |
| docs/CLICK-CENSORING-FIX.md | 27 |
| docs/COVERAGE-PLAN-REVIEW.md | 27 |
| docs/MEGA-FEATURES-SPEC.md | 25 |
| docs/ENGINE-COVERAGE-PLAN.md | 23 |
| docs/GLOSSARY.md | 13 |
| docs/SLOWKING-whitepaper.md | 13 |
| docs/ADR-003-exploitability-is-the-headline.md | 10 |
| docs/ARCHITECTURE-NOTES.md | 7 |
| docs/KADABRA-coach-spec.md | 2 |
| docs/SLOWKING-research-roadmap.md | 2 |
| **total** | **2,258** |

These are unique keys. Counted by occurrence, 2,330 figures sit in grandfathered sentences, because the same
sentence can repeat a figure.

## 3. How much a trace means: measured, not assumed

The method: for every figure, coverage = the fraction of values *of the same shape* (sign, integer digit
count, decimal places; sampled at most 3,000 per shape) that the same trace sets would also have accepted.
The sum of coverage is the expected number of passes that random digits would have scored.

The census scope is the 7,409 figures in uncited sentences, plus the 84 newly routed in §1: 7,493
occurrences.

| | figures | expected coincidental | in a trace set accepting ≥50% of their shape |
|---|---|---|---|
| **old rule** — any hit in `data/` (305 artifacts) or anywhere in CHANGELOG | 7,387 pass of 7,409 | **~6,750** | 5,975 at ≥99% ("could not have failed") |
| **new rule** — bound by a cited artifact | 1,325 | ~726 | 666 |
| **new rule** — bound by a named entry | 3,816 | ~369 | 47 |
| new rule — grandfathered (not traced, counted) | 2,258 keys | — | — |
| untraceable (unchanged class) | 22 | — | — |

- **The union's coverage.** 900 of 900 three-digit integers and 7,273 of 9,000 four-digit integers are in the
  union of 305 artifacts. The brief's figures were 7,274 of 9,000 against 306 artifacts, taken at a different
  HEAD. The two agree to within one.
- **Of the 5,975 old-rule figures that could not have failed**, 4,386 are now bound and 1,589 are
  grandfathered.
- **Entry binding means something.** About 10% of entry binds are expected by chance, and only 47 sit in a
  weak trace set.
- **Paragraph binding is the weak point.** More than half of its binds are expected by chance. The worst
  artifact is `data/game-differential.json`, which carries 560 of the 1,325 paragraph binds and holds a turn
  index for every turn. This is the citation rule's own weakness, inherited rather than added. A field
  citation is the fix available to any author.
- **The ~1,395 "coincidence-shaped" figures.** The classifier behind that figure (CITED / PLAUSIBLE /
  COINCIDENCE, at HEAD `4e56f637`) is not on disk, so I cannot say how many of those exact figures the bound
  rule sees. What I can say, from the table above: every figure whose only trace was a digit match is now
  either bound or grandfathered, and none is traced by the digit match. The bound rule still admits about
  1,095 expected coincidental binds, 726 by paragraph and 369 by entry, where the old rule admitted about
  6,750.
- **Why the scope differs from the brief's 7,842.** Mine is 7,409 under the old scope at HEAD `eaf9848d`,
  against the brief's 7,842 at `4e56f637`. I cannot reconcile the two without the census script that
  produced the brief's figure.

## 4. The plants: every one in a real living document, removed byte-identical

All plants went into `docs/KADABRA-coach-spec.md`: a living document, clean in git, with a last heading that
names no version. Each plant, its gate run and its restore ran in one command. After every run the document
was byte-identical to its backup (sha1 `aec26deabca1`), `git status` showed it clean, and the baseline sha1
was unchanged.

**Green run** (two bound plants):

| plant | expected | result |
|---|---|---|
| P2: `The planted source is \`data/tags.json:sheet_entries\`. The planted census read 316,656 sheet entries.` (the field holds 316656) | green | **green.** Paragraph-bound count 1,325 → 1,326 |
| P4 control: `## Planted named entry … (6.4.1)` then `The planted coverage counter read 10,524.` (10,524 is stated only in entry 6.4.1 and is in no artifact) | green | **green.** Entry-bound count 3,816 → 3,817 |

The gate read `DOC CURRENCY TESTS: 37 passed, 0 failed`, with no ratchet movement.

**Red run** (the brief's three reds, plus a control):

```
FAIL no living document gained untraceable figures (23 across 5 documents):
       docs/KADABRA-coach-spec.md: 1 untraceable figures (document was not in the baseline)
         docs/KADABRA-coach-spec.md    316,657   The planted source is `data/tags.json:sheet_entries`. The planted census read 316,657 shee
FAIL figures bound to no trace (grandfathered): no new entries (baseline 2258, now 2260)
       NEW:
       docs/KADABRA-coach-spec.md:54  17 — its only trace is a digit match that is not bound to the claim
       docs/KADABRA-coach-spec.md:107  437 — its only trace is a digit match that is not bound to the claim
       docs/KADABRA-coach-spec.md:113  10,524 — its only trace is a digit match that is not bound to the claim
       ratchet tightened: 1 entry retired
DOC CURRENCY TESTS: 35 passed, 2 failed
```

- **P1, a new unbound figure.** `The planted sweep scored 437 games.` The value is in the union, so the old
  rule would have passed it. **RED.**
- **P3, a grandfathered figure with its value edited.** Line 54, `pKO across 16 rolls` → `17`. **RED.** The old
  key `351ffc66e0|16` retired, and 17 has to be bound.
- **P4, a figure whose only trace is a CHANGELOG line in an entry the block does not name.** `10,524` under a
  heading naming 6.4.0; the figure is in 6.4.1. **RED.** The old rule would have passed it through
  `changelogHas`.
- **P2 control, the field-bound sentence with 316,657.** **RED.** This shows the field binding is not
  vacuous.
- **Sentence edited, value kept.** Proven by the `editing-the-sentence-loses-grandfathering` case in
  `traceProof`, not by a real plant.
- **A timing caveat.** The plants above ran before the final predates reorder (§5). The re-run on the final
  code is in §6.

## 5. One mistake, and how it was undone

The first predates build ran its check *before* the untraceable class. A green gate run then moved 9 of the 22
untraceable figures into PREDATES, and the monotone ratchet **wrote the baseline**, lowering the untraceable
floor to 13. That changed the meaning of an old class, which was not intended. I did two things:

1. **Moved the predates check after the untraceable class.** A comment beside the code records why.
2. **Restored the baseline to the exact bytes the bootstrap command had written.** I reconstructed it from the
   pre-bootstrap copy (the two untraceable keys) and the recorded bootstrap stamps, and copied it back only
   after its sha1 matched the post-bootstrap hash `5ce2a5a5260d…`. The bad intermediate is kept in the session
   scratchpad.

A plain run after the fix reads 22 across 4 and 37/37, with no ratchet movement.

## 6. Final runs, on the final code

- **Red plants re-run on the final code.** Same outcome: `35 passed, 2 failed`, with the same three NEW
  entries (17, 437, 10,524), the same untraceable 316,657, and `1 entry retired`. The document was restored
  byte-identical and the baseline sha1 was unchanged.
- **Green plants were not re-run.** Binding is checked before either of the two classes the reorder moved,
  so the reorder cannot reach a bound figure. That follows from the order of the code, not from an
  assumption.
- **Plain gate, final.** `DOC CURRENCY TESTS: 37 passed, 0 failed`. Untraceable 22 across 4; bound-trace
  demonstration 16/16; grandfathered 2,258, `no new entries (baseline 2258, now 2258)`; no ratchet movement.
  The baseline is the bootstrap's bytes (sha1 `5ce2a5a5260d…`).
- **`tests/test-docs-quarantine.js`:** all checks passed. **Existing proofs:** citation 20/20, lexing 10/10,
  retraction 7/7.
- **`node engine/status.js --write`:** stamped docs/ENGINE.md, MEASURE.md, SEARCH.md, OPS.md and WEB.md. The
  same run rewrote `data/provenance-stamp.json` through provenance.js's own ratchet. I did not edit that file;
  whether it goes into the commit is the coordinator's call.

## 7. Risks the coordinator should know

- **The three files must be committed together:** `engine/docs_scan.js`, `tests/test-docs-current.js` and
  `data/docs-currency-baseline.json`.
  - With the baseline but not the code, the old test replaces `known` wholesale on its next green write and
    **deletes the grandfather list**. The new code then reads the list as missing: RED.
  - **The other MEASURE agent's commit runs my uncommitted gate.** Its pre-commit hook runs
    `tests/test-docs-current.js` from the working tree. Their staged set touches no living document, so it
    should pass. But if the gate's ratchet moves during their run, the hook stages the baseline, which
    carries my list, into their commit.
- **Six figures are bound through `data/quality-filter.json`,** the file the other agent is editing:
  `docs/ABRA-whitepaper.md:1903,1905` and `docs/SUMMARY.md:1354,1356` (4.3, 18,908, 26,142). They were bound
  against the staged version. If a later change moves those values, the figures go red, because they were
  bound rather than grandfathered. That is the rule working, but the red will appear on whoever commits next.
- **Treadmill exposure is the citation rule's, now on uncited sentences too.** An undated paragraph whose
  cited artifact regenerates can lose its binding and go red with no document edit. A dated one is excused as
  predates. The largest exposure is `data/game-differential.json`, which carries 560 paragraph binds; binds
  per artifact are printed by the `observe` measurement.
- **Every edit to a sentence holding a grandfathered figure is now red until that figure is bound.** That
  includes a typo fix. This is the design Will chose. Expect it to surface first in the 6.0.0 fold-in of
  `docs/MODELS.md` (613) and the white paper (391).

## 8. Rows for the coordinator to apply

**`docs/RUNNING-NOTES.md`.** Proposed as a PATCH: no published figure moved. The version is the
coordinator's call; the other agent has 6.6.1 staged.

```
## [6.6.2] — 2026-09-11 — the untraceable-figure check is a ratchet: a figure is traced only by a trace bound to it, 2,258 grandfathered
- **What changed.** `engine/docs_scan.js` `untraceableCensus`: a figure is traced only by an artifact its paragraph cites that holds it (field-scoped for `data/x.json:field`) or by the CHANGELOG entry its block names; a hit anywhere in `data/` or `CHANGELOG.md` is no longer a trace. QUALIFIED sentences and sentences citing only a missing file or a copy of a document now need a trace too. `tests/test-docs-current.js` clause 3b(d) ratchets `known.untraced_grandfathered`, written once by `node tests/test-docs-current.js --bootstrap-grandfather`; it may only shrink.
- **Measured.** 2,258 figures grandfathered across 24 living documents; 1,325 bound through a cited artifact and 3,816 through a named entry; the untraceable census unchanged at 22 across 4 — `data/docs-currency-baseline.json`. Gate 37 of 37. Detail: `docs/_reports/2026-09-11-traceability-ratchet.md`.
- **Basis.** unchanged.
- **Supersedes.** Nothing.
- **Owed to the next major.** none — no published figure moved. Binding the grandfathered figures is separate work.
```

**`CHANGELOG.md`:**

```
## [6.6.2] — 2026-09-11
### Changed
- The untraceable-figure check is a ratchet (Will's decision). A figure in a living document is traced only by an artifact its own paragraph cites that holds it, or by the CHANGELOG entry its block names. A value that merely occurs somewhere in `data/` or somewhere in this file is no longer a trace: that union holds all 900 three-digit integers and 7,273 of 9,000 four-digit ones, so for most figures the old check could not fail. The 2,258 figures that were green under the old rule and are bound to nothing are grandfathered in `data/docs-currency-baseline.json`, written once and only ever shrunk; a new or edited figure must be bound. `tests/test-docs-current.js` gains clause 3b(d) and now runs 37 checks.
### Fixed
- Citing a source no longer costs a figure anything: dropping the citation no longer lets it pass on a digit match. Sentences the citation rule skips as qualified, or whose only citation is a missing file or a copy of a document, were judged by nothing (84 figures) and now need a trace.
- `data/open-work.json` and `data/docs-currency-baseline.json` can no longer vouch for a figure in the citation rule or in either route of the quarantine clause.
```

**`docs/ROADMAP.md` (proposed rows; format them to the register):**

- *Bind the grandfathered figures.* 2,258 across 24 documents. The count prints on every run of
  `tests/test-docs-current.js`, and it closes when the count reaches zero.
- *Paragraph binding against a large artifact is mostly coincidence.* About 726 of 1,325 binds are expected by
  chance, and `data/game-differential.json` alone carries 560. Decide whether a citation of an artifact above
  a coverage bar must name a field to bind. This is Will's call, because it changes the rule he chose.

## OWED, NOT RUN

Apply the rows in §8 and commit the three code/data files together:

```bash
git add engine/docs_scan.js tests/test-docs-current.js data/docs-currency-baseline.json docs/MEASURE.md docs/_reports/2026-09-11-traceability-ratchet.md
```

Once the other MEASURE agent's `data/quality-filter.json` settles, confirm the six bindings through it still
hold:

```bash
node tests/test-docs-current.js
```

See the grandfathered and unbound figures, per document, for the burn-down:

```bash
node engine/docs_scan.js
```

Re-measure how much a binding means after any rule change. The census exposes `observe`; my coverage script
was session scratch and is not in the repository.

```bash
node -e "const S=require('./engine/docs_scan.js'); const n={}; S.untraceableCensus(S.livingDocs(),{observe:x=>n[x.cls]=(n[x.cls]||0)+1}); console.log(n)"
```
