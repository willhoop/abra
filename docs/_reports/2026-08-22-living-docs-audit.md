# Living-docs audit — the five in-scope documents, 2026-08-22 (MEASURE)

Scope: `docs/ABRA-whitepaper.md`, `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`,
`docs/SUMMARY.md`, `docs/MODELS.md`. Nothing outside it was touched. `docs/ENGINE.md`,
`docs/ROADMAP.md`, `CHANGELOG.md`, `engine/` and `tests/` were not edited. Nothing was committed.

Authority for what is withheld: one run of `node engine/status.js`, started 2026-08-22 19:01 local
and worked from thereafter. Artifacts were read directly, and their mtimes were checked against the
clock before reading (settled at 16:08–18:50 local against a 19:01 clock, so no torn reads).

---

## 0. THE BRIEF'S OWN FIGURES WERE ALREADY SUPERSEDED WHEN I RECEIVED THEM. NONE WAS WRITTEN IN.

The brief gave tonight's state as measured on release `39631097fcc7`. By the time `status.js` ran, the
live ENGINE agent had moved the tree to `59bb68aa89a9` and re-run two of the four instruments. The
brief's numbers and the artifacts on disk do not agree:

| quantity | brief | artifact on disk / `status.js` |
|---|---|---|
| whole-game differential | 95 of 961 diverged; 93 of 959 usable = 9.7% | `data/game-differential.json`: `games` 777, `diverged` 96, `engine_release` `59bb68aa89a9`; `status.js` reports 94 of 777 = 12.1% |
| census | 628 live / 0 missing | `data/mechanics-census.json`: `probed` 629, `live` 629, `missing` 0 |
| damage differential | 5 of 6000, `band_missing` 0, 14 interior indices | `data/engine-diff.json`: `compared` 6000, `agreed` 5995, `disagreed` 5, `band_missing` 0 — AGREES |
| roster items / abilities / moves | 2 / 0 / 5 DIFFER, 0 DID-NOT-FIRE | `status.js`: all three stages **WITHHELD** — "MEASURED AGAINST A DIFFERENT ENGINE — this artifact ran on release `39631097fcc7` and the tree is `59bb68aa89a9`" |
| gate | 2 of 8 clauses PASS | `status.js`: 7 of 8 clauses FAIL, i.e. 1 of 8 passes |

**So four of the six figures I was handed were stale by roughly two hours, and three of them are now
formally withheld rather than merely moved.** None of them went into any document. This is the
photograph rule arriving through a new door: the brief was a correct measurement of a release, and a
release is not the tree. Anything written from it would have been a claim about bytes that are no
longer there.

The damage differential is the one that reproduced, and it is the one figure from the brief that
appears in the corrected documents — read out of `data/engine-diff.json` rather than copied from the
brief.

## 0b. THE FIVE DOCUMENTS ARE UNDER AN OWNER-DECLARED PAUSE, AND THAT CHANGED WHAT "BRING IT TRUE" MEANS

All five carry a version pin in `data/docs-currency-baseline.json` at `3.98.0` with this reason:

> MEDICHAM SPRINT PAUSE — Will, 2026-08-10: *"WE PUT A PAUSE ON DOCS UNTIL MEDICHAM IS FUNCTIONAL,
> RATHER JUST HAVE NOTES TO A RUNNING LIST THAT WE CAN REFER TO WHEN FINALLY UPDATING THE DOCS."* …
> THIS PIN IS THE DEFERRAL MADE CHECKABLE, not a licence — bumping these headers without bringing the
> content current would turn the version into another asserted number.

The owed write-up goes to `docs/MEDICHAM-SPRINT-NOTES.md` (11,310 lines, last written 17:13 today),
and `.githooks/pre-commit` blocks any `engine/`- or `tests/`-touching commit that does not also touch
it. So the deferral is live and enforced.

**I did not do the deferred write-up and did not bump any header.** What the pause does not cover is a
document ASSERTING SOMETHING NOW KNOWN FALSE, or PRINTING A QUARANTINED FIGURE. Every edit below is
one of those two: a superseded figure corrected against its artifact, or a quarantined figure cut.
Nothing new was added as a result.

---

## 1. AUDIT — every superseded or untraceable figure found, per document, with its line

Line numbers are as-found, before editing.

### docs/ABRA-whitepaper.md

| line | figure as stated | what the artifact says | disposition |
|---|---|---|---|
| 724 | "validated … on **31 meta scenarios**: within 5% on 100% of scenarios, median error 0%, **worst 3%**" — cites `data/damage-validation.json` on line 725 | `scenarios` 36, `compared` 36, verdict *"within 5% on 100% of 36 compared scenarios (worst 0%)"*. No median, no 2% band | CORRECTED |
| 781–786 | "**149/150** endpoint agreement is compatible with every interior roll being off by one or two … This is a limitation of the measurement" | `data/engine-diff.json`: `compared` 6000, `disagreed` 5, `band_missing` 0. The instrument now sweeps the interior indices; the limitation is closed | CORRECTED — recorded as a dated closure, prior text left standing above it |
| 968–976 | R1 "*68.18% against material's 65.26%, +2.91 [1.79, 4.04]*" → "+0.456, 95% CI [−0.717, +1.630] — UNDECIDED"; R3 "publishes **72.9%** over 70 decisions" | `status.js`: R1 and R3 both QUARANTINED, "the figure is withheld, not annotated" | WITHHELD — verdicts (PASS→UNDECIDED, missing control) kept, rates and intervals cut |
| 1548 | "an immutable snapshot … of **the twelve files** whose content can change a reported number" | `engine/engine_release.js` `SOURCES` holds **26** entries | CORRECTED — count removed, pointed at the declaration |
| 1100–1102 | "`data/mechanics-census.json` moved 167 → **181 live of 186 probed**"; "interaction matrix … 1,012 live … 999 agree, **98.7%**"; "the Showdown damage differential **stands at 1/150**" | census 629/629/0; matrix `live` 1642 `agree` 1642 `agreement_pct` 100; differential 5/6000 | LEFT — dated release section (3.40.0), narrating what that release measured. Flagged: "stands at" is present tense inside a historical block |
| 1152–1153 | "The census rose 211 → 216 live of 219 probed; the damage differential did not move" | same as above | LEFT — dated release narrative |
| 799, 806, 831, 835, 1175 | 21 figures the gate already records as "figures a cited artifact does not contain" (XATU, PORY, quality-filter, SLOWKING, click-censoring blocks) | see `data/docs-currency-baseline.json` → `known.citation_mismatches` | LEFT — pre-existing debt, not tonight's topic, and none is downstream of MEDICHAM |

### docs/SUMMARY.md

| line | figure as stated | what the artifact says | disposition |
|---|---|---|---|
| 568 | the **MEDICHAM row of `## The components at a glance`**, a CURRENT-STATE table: "within 5% … on **31 scenarios**"; "disagrees with the OFFICIAL Champions engine by **31.1 points** of win probability"; "**Mechanics census 231 live of 232 probed, 1 missing**"; "interaction matrix **98.8% — 1,624 of 1,643**"; "`off_gate` **53**"; "**2,300** staged from a theoretical **8,795**, i.e. **26.2%** coverage"; "field axis **156/156**"; "damage differential **1/150**"; "collision ratchet **2 / 151**"; "DEAD-tag ratchet **61 → 38**"; "mutation tier **163 class-A operators over 56 rows**" | damage-validation 36/36 worst 0%; census 629/629/0; matrix `live` 1642, `agree` 1642, `agreement_pct` 100, `off_gate` 12, `emitted` 2250, `theoretical` 7103, `staged_pct_of_theoretical` 31.7; engine-diff 5/6000; mutation-coverage `operators` 1563 / `live` 565 / `defectCandidates` 403 over 292 tags. The 31.1-point win-probability gap is a rollout figure and traces to no artifact | **ALL CUT**. The cell is a current-state table and every count in it had moved. Replaced with the two commands that print the state |
| 546–558 | the R1/R2/R3 audit table: "+2.91 [1.79, 4.04], PASSED" → "**+0.456 [−0.717, +1.630]**"; "**5.83 ms** median"; "**72.9%** over 70 decisions" | all three QUARANTINED per `status.js` | WITHHELD — the verdict column and the point of the table (a gate that does not stamp its configuration cannot be audited) kept |
| 667–668 | "36 scenarios, 100% within 5% …, **97% within 2%, median error 0%, worst 3%**" citing `data/damage-validation.json` at 2026-08-05 | the 2026-08-08 artifact reports worst **0%** and states no median and no 2% band | CORRECTED — and the two prior corrections of this same line are both kept |
| 708 | "engine release `5fc1f711a0e3`, **12 files frozen**" | `SOURCES` holds 26; the id is a digest of a tree that has moved many times | CORRECTED |
| 709 | "**0** artifacts verified by content, **92** by mtime alone" | `data/provenance-stamp.json`: `verified` 3, `mtime_only` 172 | CORRECTED — pointed at the fields rather than restating counts that move on every run |
| 716 | click censoring: "**1,475 of 270,022** recorded actions were never clicks"; "**3,526** redirected attacks (**1.3180%**)"; "paired on **48,274** held-out decisions … **−0.002613 [−0.003650, −0.001672]**" | `status.js`: "click censoring: QUARANTINED — the figure is withheld, not annotated" | WITHHELD — the qualitative finding (forced actions were fitted as human choices; redirection now enters as a candidate set) kept |
| 629 | "## The data, as of 2026-07-25" | — | LEFT — a self-dating heading, which is the correct form |

### docs/MODELS.md

| line | figure as stated | what the artifact says | disposition |
|---|---|---|---|
| 866–884 | interaction matrix stated as current beside the artifact's name: "theoretical cross product of **8,795** … **2,300** emitted … (**26.2%**) … **1,634** LIVE … matches on **98.8%** … (1,614/1,634)", under the heading "THE AGREEMENT FIGURE HAS FALLEN TWICE AND THE SIMULATOR DID NOT CHANGE EITHER TIME. **100.0% → 99.6% → 98.8%**" | `theoretical` 7103, `emitted` 2250, `staged_pct_of_theoretical` 31.7, `live` 1642, `agree` 1642, `agreement_pct` **100**, `part` 0, `off_gate` 12 | CORRECTED. The heading was the sharper error: the series has since gone back UP, so a paragraph explaining a fall was standing over a rise. Both reasons for the two falls are kept — they are true and they explain the current number too |
| 895–911 | the whole "Win% backtest — RE-MEASURED 2026-08-04" block: Brier **+0.0502 [0.0371, 0.0628]** over 1,378 games; preview leaf **+0.0740 [0.0668, 0.0813]** over 6,886; reliability **53.6% / 53.8%**; names the winner on **50.99%** of 1,314 decisive calls (CI 48.3–53.7, p=0.47); preview **53.22%** of 6,700; **1.9 points** above its split-half floor; **25.6%** in the extreme buckets | `status.js`: "leaf calibration: QUARANTINED — the figure is withheld, not annotated. `data/winrate-backtest.json` is downstream of MEDICHAM" | **WITHHELD.** This is MEASURE's own number and the single worst instance in the set — a full reliability curve printed as current fact out of a quarantined artifact. Configuration facts (which leaf, which settings) kept, because they are read from code |
| 909 (orig.) | damage: "matches the calc to the integer on **18/22** meta scenarios … within 5% on 100% of scenarios, median error 0% (**worst 3%**)" citing `data/damage-validation.json` | 36 compared, worst 0%; no 22-scenario stage and no median in the file | CORRECTED |
| 1176 (orig.) | "within 5% on 100% of **31 tested scenarios**" citing the same file | 36 | CORRECTED |
| 1481–1495 | MILTANK R4: "**55.5%** of **535 decisive pairs**, 95% CI **[51.3, 59.7]**, over **2,624 games / 1,312 seed pairs**. SPRT accepted H1 (p=0.55) … after **522** decisive pairs", under a **`Standing: PRE-CHANGE`** caption | `status.js`: R4 QUARANTINED; every R4 game file also `PRE-CHANGE` | **WITHHELD.** The `PRE-CHANGE` line is exactly the caption CLAUDE.md forbids. The four things "that number is not" are kept and strengthened — the SPRT-bound bias and the missing A/A floor are MEASURE rules and do not need the value |
| 1487 | "Earlier rungs: R2 leaf cost (**477 boards over 200 games**), R3 divergence from MAG **72.9%** over 70 decisions" | R2 and R3 QUARANTINED | WITHHELD |
| 1510–1527 | R1: "**9,201 positions, 68.18%** against material's **65.26%**, **+2.91 [1.79, 4.04]**" → "**65.72%** … **+0.46**, CI **[-0.72, +1.63]**"; R3's "**72.9%** is 100 × (70 − 19) / 70" | all QUARANTINED | WITHHELD — verdict UNDECIDED and the reproduces-only-as-arithmetic finding both kept |
| 1863 | "current release `5fc1f711a0e3` over **12 files** including the weights" | `SOURCES` holds 26 | CORRECTED |
| 809 | "`data/mechanics-census.json` reads **231 live of 232 probed, 1 missing, 0 hollow**" | 629/629/0/0 | LEFT — the line is explicitly headed "MECHANICS STATE, 2026-08-06 (3.56.0)", which self-dates it |
| 1057 | "the mechanics census reads **102 live of 144 probed, 42 missing**" | as above | LEFT — inside a dated 2026-08-04 blockquote about a drift audit |
| 1370 | "`data/policy-weights.json` reads **8,942 games / 232,815 usable decisions of 241,927 seen**" | the weights are QUARANTINED per `status.js`, but these are corpus counts about the FIT rather than a result measured through MEDICHAM | LEFT — flagged below as a judgement call, not an oversight |
| 602, 694, 1117, 1271, 1285, 1347, 1356, 1710, 1732, 1782 | 43 figures the gate already records as citation mismatches | `known.citation_mismatches` | LEFT — pre-existing debt, none downstream of MEDICHAM |

### docs/ABRA-deck-plain-english.md

| line | figure as stated | what the artifact says | disposition |
|---|---|---|---|
| 546–548 (orig. 545) | "the honest figure is **4 disagreements in 400**" | `data/engine-diff.json`: 5 of 6000, and the instrument now sweeps the whole roll band rather than the two ends, so the old score is not comparable | CORRECTED — cut rather than restated, because the two runs are not the same question |
| 549–553 | "when it says it's **94%** to win, it wins **54%**; when it says **6%**, it also wins **54%**", on **6,886** games, against a prior reading on **350** games | leaf calibration QUARANTINED | **WITHHELD** — rewritten in plain English so a reader is told the figures are set aside and why. The two non-numeric points (the old sample was far too small; the version measured was not the one the bot uses) both stand |
| 566–573 | "'The new search picks a different move **73%** of the time'" | R3 QUARANTINED | WITHHELD — the missing-control finding kept |
| 574–576 | "'A leaf costs **5.83 milliseconds**'" | R2 QUARANTINED | WITHHELD — the wrong-thing-measured finding kept |
| 512–514 | PORY "beats a coin flip mid-game … it's *calibrated* — when it says 70% it's really about 70%", with the retraction on a different slide | `data/pory-eval.json`: `ece` 0.0138 and the reliability table support the calibration; the artifact's own verdict ends *"and neither of those is evidence of a learned value function"* | CORRECTED — the calibration claim is TRUE and was standing without the sentence that makes it readable. The retraction was pulled onto the same slide |

Nothing else in the deck stated a figure from a quarantined artifact. Its other numbers (usage counts,
click counts) are corpus facts and are upstream of the simulator.

### docs/ABRA-technical-docs.md

| line | figure as stated | what the artifact says | disposition |
|---|---|---|---|
| 1093–1095 | "**Twelve files** are in a release: …" followed by a typed list of twelve | `engine/engine_release.js` `SOURCES` holds **26** | **CORRECTED — the worst of the non-quarantine errors.** This is a Diátaxis HOW-TO. A reader following it would cut a release believing twelve files were frozen and that fourteen more were not, which is the exact failure that stranded 168 of 200 releases |
| 1108 | "Read the **twelve** digests in the output" | as above | CORRECTED |
| 131 | "the census is 326 live of 326 probed"; "The 150-row …" | 629/629 | LEFT — dated release narrative |
| 317 | "The mechanic census reads **310 live of 310 probed**, and `missing` is zero for the first time" | 629/629/0 | LEFT — dated release narrative; "for the first time" is what dates it |
| 190–196 | "**34 of 114 artifacts** are downstream and are no longer printed" | `status.js`: **58** artifacts are downstream, of 229 | LEFT — dated 3.79.0 release entry recording what that release found; flagged as a figure a reader could mistake for current |

---

## 2. COUNTS

| document | superseded / untraceable found | corrected | WITHHELD rather than updated | left as dated history |
|---|---|---|---|---|
| `docs/ABRA-whitepaper.md` | 7 sites | 3 | 2 (R1, R3) | 2 |
| `docs/SUMMARY.md` | 7 sites | 4 | 2 (R1/R2/R3 table, click censoring) | 1 |
| `docs/MODELS.md` | 13 sites | 4 | 5 (leaf calibration, R1, R2, R3, R4) | 4 |
| `docs/ABRA-deck-plain-english.md` | 5 sites | 2 | 3 (leaf calibration, R2, R3) | 0 |
| `docs/ABRA-technical-docs.md` | 5 sites | 2 | 0 | 3 |
| **total** | **37 sites** | **15** | **12** | **10** |

A "site" is one contiguous claim, which may carry several figures — the SUMMARY MEDICHAM cell alone
held eleven distinct counts, all cut.

**Not corrected, on purpose, and named so it is a decision rather than an omission:** the 65 figures
already recorded in `data/docs-currency-baseline.json` under `known.citation_mismatches` (43 in
MODELS, 21 in the white paper, 6 in SUMMARY) and the 37 under `known.untraceable_by_doc`. None is
downstream of MEDICHAM; they are model-section debt from the July fits and they are a separate job.
`docs/MODELS.md:1370`'s corpus counts for `data/policy-weights.json` were left because a corpus size
is a fact about the store, which is upstream of the simulator — but the WEIGHTS themselves are
quarantined, so if that judgement is wrong the line is the place to look.

---

## 3. WHAT THE GATE CANNOT SEE, MEASURED

`node tests/test-docs-current.js` was **GREEN before I started** (21 passed, 0 failed) and is green
now. It did not catch a single item in section 1. Two reasons, both worth recording:

1. **The `3b(b)` clause matches a figure against ANY number anywhere in the cited artifact.** The
   SUMMARY MEDICHAM cell named `data/mechanics-census.json` and stated "231 live of 232 probed"
   against an artifact reading 629/629 — and did not fire, because 231 and 232 occur somewhere inside
   a 308 KB file. This is the failure the brief already named for `docs/MODELS.md` and `0.6981`: a
   number matching something, somewhere, is not a citation.
2. **Nothing in the gate knows about the quarantine.** `status.js` computes the withheld set and
   `test-docs-current.js` never asks it. Twelve quarantined figures were sitting in five documents,
   green.

Both are ENGINE/MEASURE tooling items rather than document fixes, and neither was touched tonight.
The second one is the cheaper and the larger: a clause that fails when a living document states a
figure from an artifact `engine/quarantine.js` lists as withheld would have caught every one of the
twelve, and would keep catching them.

## 4. PDFs

**PDF NOT REBUILT, TOOLCHAIN ABSENT.** The documented chain is pandoc → HTML → weasyprint.
`weasyprint` is present at
`C:\Users\willj\AppData\Local\Programs\Python\Python312\Scripts\weasyprint`. **`pandoc` is not
installed** — not on `PATH`, not in `C:\Program Files\Pandoc`, not in `%LOCALAPPDATA%\Pandoc`, and
`where.exe pandoc` returns "Could not find files for the given pattern(s)". `wkhtmltopdf` is also
absent, so there is no substitute front end.

So `docs/ABRA-WhitePaper.pdf`, `docs/ABRA-deck-plain-english.pdf` and
`docs/ABRA-technical-docs.pdf` (all stamped 2026-08-06 20:42) are now **older than the `.md` files
beside them**. That is a real gap and it is stated rather than papered over: a stale PDF beside a
corrected `.md` is exactly the two-places-disagree failure. Install pandoc and rebuild before any of
these three are published or sent anywhere.

## 5. FINAL GATE STATE

```
node tests/test-docs-current.js
DOC CURRENCY TESTS: 21 passed, 0 failed
```

Clause by clause, after the edits:

| clause | result |
|---|---|
| 1. retracted numbers not restated as fact | 10 ok / 0 fail (107 documents scanned, archive included) |
| 1b. non-transitivity claim tracks the SLOWKING artifact | ok (artifact says cycle `supported=false`) |
| 2. version-headed docs track the CHANGELOG | ok — 25 versioned, 25 pinned, top now `5.74.0`; the five in scope stay pinned at `3.98.0` under the sprint pause |
| 2b. unversioned docs declared | ok — baseline 56, now 56 |
| 3. archived docs declare a replacement | ok — baseline 25, now 25 |
| 3c. archive index generated and current | ok |
| 3b(a). retracted figures restated | ok — baseline 10, now 10 |
| 3b(b). figures a cited artifact does not contain | ok — **baseline 66, now 65; one entry retired, none added** |
| 3b(c). untraceable census | ok — 37 across 7 documents, unchanged |

**No entry was added to `data/docs-currency-baseline.json` by hand.** The only writes to that file are
the two the test made itself on its own green runs: the timestamp, the `changelog_top_at_baseline`
moving `5.71.0 → 5.73.0`, and the one retired citation mismatch. A ratchet that tightens on a green
run is the designed behaviour; nothing was adopted, no count was raised, and no red clause was turned
green.
