# Withdrawals, third pass: the void run's step count, the joint layer, the 3.36.0 refit, and a sweep — 2026-09-11

MEASURE. A historical findings record; it is not maintained. Nothing was committed, no git command was run, no game
was played, and no differential, roster or census was run. No quarantined artifact was re-run. None of ENGINE's files
(`engine/medicham2-browser.js`, `tests/roster.js`, `engine/stage_planner.js`, `engine/legal_scope.js`,
`engine/quarantine.js`, `docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `data/roster*.json`)
was touched.

## Verdict

1. **All three briefed items are withdrawn.** These are gone from every place the brief named:
   - the void run's mirror control and step count;
   - the joint layer's turn count and reach share;
   - the white paper's 3.36.0 paired-refit table, with its noise floor, its weight-movement counts and its verdict.
2. **The sweep found more, and it is withdrawn too.** The largest item is the **leaf backtest**: MEASURE's own withheld
   number was still printed in full in the white paper (~1647), with 6,886 games, both Brier gaps, the bucket rates and
   50.99% of 1,314. The paragraph right after it says none of that is carried. The deck restated the same reliability
   curve in plain words and drew a verdict from it. Also withdrawn:
   - the 3.41.0 channel-value table;
   - the multiplicity counts (WP, SUMMARY);
   - the planted-weights EM table;
   - the censoring refit's weight movement and the censoring value (MODELS);
   - the 2026-08-02 joint refit's corpus, table, stability and fire-rate figures (MODELS);
   - the joint weights re-derived from commit-pinned blobs of the joint weights file (WP, MODELS);
   - the policy-weights corpus counts in two MODELS drift notes;
   - the MAG vector count in a MODELS heading.
3. **`tests/test-docs-quarantine.js`: green.** 30 → 26 keys stand, 0 are dead. It printed exactly 4 under "DELETE these
   lines" and those 4 were removed. Nothing was added.
4. **`tests/test-docs-current.js`: 36 passed, 1 failed, the same as before any edit.** The one failing entry is
   `docs/TAG-COVERAGE.md:14  6,829` (3b(d)), which was red before this pass began and is on a line this pass did not
   touch. Grandfathered unbound figures fell 2207 → 2026. One regression of mine, at `docs/MODELS.md:1259  34`, was
   found and fixed (see Verification).
5. **PDFs:** 7 rebuilt, 0 failed. `build/build_pdfs.js --check` then reported "every document has a current PDF".

## The withheld set, derived

`cmd /c tools\lownode.cmd engine\quarantine.js`, run this pass: `GATE: CLOSED — 3 of 8 GATING clauses fail`,
**69 of 258 artifacts WITHHELD**. Each figure was checked against the artifact bytes with `engine/docs_scan.js`'s own
`artifactHas`, which applies the same rounding and ×100 rule the gate uses:

| figure(s) | artifact | held? | matches bytes? |
|---|---|---|---|
| mirror 49.7% [46.2, 53.2], n=782 | `data/exploitability-holdout.json` (`mirror.rate` 0.4974, n 782) | yes | yes |
| "1 of 24" | `data/exploitability.json` (`rounds` 24; 1 `accepted: true`, 23 false) | yes | yes |
| 0.0168 step scale; "10 of 18" at 17 features | none (`exploitability-mag.json` reads 2 of 14; `-machamp` 3 of 14) | lineage held | no: void and retracted runs |
| 95,886 | `data/policy-weights-joint.json` (`corpus.pairs`, `matching.kept`) | yes | yes |
| 99.7% reach | same file, `fitEnvironment.reached_board` (202,343 / 202,918) | yes | yes (derived) |
| 44,982; the 3.41.0 table | `data/sheet-channel-value.json` | yes | 44,982 yes; C−A logL 0.005087 and top-1 0.173 yes |
| leaf backtest (WP ~1647): all 18 figures | `data/winrate-backtest.json` | yes | **all 18 yes** |
| 48,274 / 1,851 | `data/censoring-value.json` | yes | yes |
| 81,515 / 66,236 | `data/redirect-audit.json` (`fixedJoint.kept`, `joint.kept`), `data/collinearity-joint.json` | yes | yes |
| VIF / fire rates / +1.605 | `data/collinearity-joint.json` (`fireRate.*` 0.00004, 0.00043, 0.00056) | yes | fire rates yes |
| multiplicity 56 / 2.8 / 53 / 53 / 49 | `data/weight-multiplicity.json` (now 58 / 2.9 / 52 / 52 / 48) | yes | **no**: the doc predates the artifact |
| EM table, 97.4%, −0.0030 | `data/partial-label-em.json` (re-run 2026-08-26; `em_recovered_fraction` 0.931) | yes | **no** |
| −1.0502 → −1.6281, 0.8030, 9 of 58 | the MAG vectors (`policy-weights.json`, pre-censoring twin) | yes | no (older bytes) |
| −5.054 / −3.989 / −3.372; −4.986 → +0.863 etc; 63,305 | commit-pinned blobs `c1566ee1`, `b030ca03`, `fc7e76ce`, `52645850` of the joint weights file | yes (the file) | pinned bytes, per the docs' own re-derivation notes |
| 3.36.0 table, 0.192, 0.216, 1 of 58 | **no artifact** (`docs/_reports/2026-09-10-untraceable-sweep.md`) | n/a | compares two withheld MAG vectors |

**Item 3's judgement.** The 3.36.0 table fails both tests the brief set. It rests on withheld inputs, because it
compares two MAG weight vectors. And it rests on nothing, because the scoring script was not kept and 5 of its 8 cells
escaped the census only by a ×100 collision. So it is withdrawn, together with the verdict ("a refit that bought
nothing") that it was the only evidence for. The heading was renamed to match. The SUMMARY row and the MODELS bullet
that restated the verdict went with it.

A figure that cites a withheld artifact but no longer matches its bytes is also withdrawn: the multiplicity counts,
the EM table and the censoring-refit movement. That is not quotable twice over. It is sourced from the withheld
artifact, and it does not agree with it.

## How the sweep was done

`quarantinedFigures` has two routes: a figure in the same paragraph as a withheld citation, or a figure that
exactly one artifact in `data/` carries. Neither route saw most of what was withdrawn here. Two scratch sweeps built
on the same helpers (`figuresInText`, `isDistinctive`, `artifactHas`, `paragraphs`, `citationsIn`) filled the gap:

- **every-owner-withheld**: the figure occurs in data/ only in withheld artifacts, however many. This caught 95,886,
  which has two owners, and 66,236. 11 hits before, 3 after, and those 3 are the 14.757% coincidence.
- **section route**: the figure is carried by a withheld artifact that is cited anywhere in the same heading
  section. This is how WP ~1647 was found: its figures are one paragraph above the citation. 83 candidates before,
  67 after, every one judged by hand.

Figures judged and **left**, each a digit coincidence with a withheld artifact or a measurement of MEDICHAM rather
than something that consumes it:

| figure | where | why |
|---|---|---|
| `14.757%` | WP 234, tech 193, MODELS 73 | the human protect-click rate from the store. It collides with MAG `weights[55]` = 0.14757 |
| `49.3%` | WP 419, tech 358, MODELS 182, SUMMARY 384 | 474 of 961 from the game differential |
| 68.58%, 23.4%, 16,830, 5,808, 7,234, 9,230, −25.8%, 10,009 (corpus), 5,438, 2,635, 1,613 | various | driver rule, code comment, store counts, arithmetic |
| 6.52% (MODELS choice lock), 44.4 / 19.7 / 16.4 / 87.2 / 97.2 (click-match causes) | MODELS | match only coincidentally, or not at all |
| 97.4% of games | WP 1244 etc. | turn-1 board agreement, not the EM figure |

## What came out, per file

| file | withdrawn | kept |
|---|---|---|
| `docs/ABRA-whitepaper.md` ~1647 | the whole leaf re-measurement: n, Brier gaps, CIs, buckets, decisive calls, preview rate, noise-floor margin, and its verdict | what was measured, against which leaves, with what comparisons |
| WP ~1913 | multiplicity 56, 2.8, 53, 53, 49 and the "not an artefact" verdict | the family definition, the two corrections named, the generator |
| WP ~2016–2029 | −5.054 (pinned blob), +0.863 (pinned blob), 66.7% and 65.9% (no artifact; they shared the rewritten sentence) | the sign and the commits; the untouched 42.0% and 14.94% sentences |
| WP ~2285 | the 0.192-point noise floor | the frozen release, and that a noise floor exists |
| WP ~2370 | the EM table, 97.4%, −0.0030, 0.2600 | the design (planted weights, three seeds, two regimes) and the re-run command |
| WP ~2394 | 58 / 9 past 2 SE, −1.0502 → −1.6281, the observed direction | the mechanism's prediction |
| WP ~2575 (3.41.0) | 95,886, 99.7%, 44,982, the 10,000 resamples, the 3-row table, 0.331, 20 cuts, the reading | the A/B/C design, the three contrasts, the release id, the self-voided first attempt |
| WP ~2600 (3.36.0) | the heading's verdict, the table, 0.192, "a quarter of that floor", 1 of 58, 0.216, "did not get one" | the design; why the fix was worth making |
| WP ~2694 | 63.2% [56.6, 69.3], 17 / 58 / 25 (they shared the sentence), the mirror 49.7% [46.2, 53.2] n=782, 47.5% n=217, 1 of 24, 10 of 18, and "retires the concern" | no exploitability figure; the retraction's reasons in words; the step-rule finding |
| `docs/ABRA-technical-docs.md` 3.41.0 record | 95,886, 99.7%, 44,982, and the verdict | that the fit uses four channels and that the value was measured |
| `docs/SUMMARY.md` WOBBUFFET row | struck 63.2% / 47.5%, 17 / 58 / 25, 1 of 24 | the void run, the timing, the pointer to SEARCH §R8 |
| SUMMARY multiplicity | as the WP | as the WP |
| SUMMARY 3.39.0 table | 63.2%; mirror 49.7% and its verdict; the MAG refit row (+0.048, −0.074, 0.192, the verdict); 50.47% and 99.75% (they shared the sentence) | the row labels and what each row is about |
| `docs/MODELS.md` DODUO 2026-08-02 refit | 7,454, 81,515, 66,236, struck 24,997, 66,520, 14,995, the log-lik / top-1 table, the gain split, nine of eighteen, 15,279, none of 74, 12.0%, VIF 2.2 / 1.7, +1.605, 0.00% / 0.04% / 0.06%, the three weight values and 14.5% / 5.9% (pinned c1566ee1), −4.986 → +0.863 etc. and 63,305 (pinned) | what was compared, what the audit looked for, the wiring-bug paragraph, the pinned commits |
| MODELS WOBBUFFET | 1 of 24, 10 of 18, 17-feature, 0.0168, round ~10, 58 | the finding about the tool; the provenance-timing sentence (see below) |
| MODELS MAG method notes (two) | 53 / 6,091 / 146,910 / 117,824 / 29,086; 8,414 / 220,613 / 176,580 / 44,033; 198,157 / 7,507; 228,084 | that the ledger drifted from the artifact, and how |
| MODELS 3.42.0 | 1,336 (heading), 0.8030, 9 of 58, −1.0502 → −1.6281, 48,274, 1,851, 10,009, 47,195, 1,809, every effect and CI, −0.008, 97.4% | the classes measured, the mechanism, the re-run commands |
| MODELS closing bullets | the 3.36.0 verdict; 14 of 58 and 10.72% (shared the sentence); 50.47% | that the weather defect was real; that the fit lacks two channels |
| `docs/ABRA-deck-plain-english.md` | the 3.69.0 slide's "the answer is no"; the reliability curve (6%–94% against 44%–59%, "94% sure" → 59%) and "they bought nothing"; the mirror 49.7% and "confirms our testing setup"; 99.7% of decisions | what each measurement asked |
| `docs/PRIORITIES.md` ~174 and row 18 | 1 of 24; "58 dimensions"; struck 63.2% [56.6, 69.3] | the void run, the timing facts, the next step |
| `docs/EXTERNAL-EVIDENCE.md` ~450 | struck 63.2% / 47.5% / "forty minutes"; 1 of 24 | the 17-feature and 25-wire-fix reasons (this file is not in the 3b(d) set) |
| `tests/test-docs-quarantine.js` | 4 baseline keys (WP and tech 44,982; MODELS 48,274 and 81,515) | a dated note saying which 4 went, and why the remaining 14.757% / 49.3% keys are collisions |

**Collateral, forced by clause 3b(d) and named here so it is not a surprise in the diff.** Grandfathering is keyed
on the sentence's hash, so a rewritten sentence that keeps an unbound figure turns red. Where a withheld figure shared
a sentence with an untraceable, non-withheld figure, both came out:
- 17 / 58 / 25 in the WP and SUMMARY retraction sentences;
- 66.7% / 65.9% in WP ~2029;
- 99.75% in SUMMARY;
- 14 of 58 and 10.72% in the MODELS bullet.

In MODELS ~1257, my rewrite split one grandfathered sentence into two, which left "34 minutes older" unbound. It now
reads "more than half an hour older", so the fact stays and the number goes.

## Owed, found on the way, not touched

- **`docs/ROADMAP.md` (ENGINE's file), "1 of 24"**: line 73 (`> afterwards — and its hill-climb accepted **1 of 24**
  steps, so it was uninformative regardless.`) and line 533 (`simulator moved twice more; separately its hill-climb
  accepted 1 of 24 steps, so ...`).
- **Leaf backtest outside the five living documents**: `docs/EXTERNAL-EVIDENCE.md` 207 (n=6,886), 211, 335, 498 (50.99%,
  p=0.47); `docs/PRIORITIES.md` 97 and 246 (53.22%, 50.99%). This is MEASURE's one number, withheld, and still printed.
  It was outside this brief's sweep, which named the five documents, so it is owed next.
- **Model head-to-heads that trace to no artifact**. These are quarantined by CLAUDE.md, because they read rollouts,
  but the classifier cannot see them:
  - DODUO 42.0% [39.9, 44.3] and its cuts: WP 2013, MODELS 1112–1122, tech 1982, SUMMARY ~1314;
  - "harness fair at 49.3%": MODELS 1112;
  - the corrected vector's 66.7% / 65.9%: MODELS 1145. CLAUDE.md's MEASURE brief records a 66.7% that "became 44%",
    so it may be an interim SPRT read;
  - MACHAMP's reconciled 55.9% / 48.1% [46.5, 49.8] over 9,728: WP 2010, MODELS 1230, SUMMARY 1308.
    `data/ladder.json` matches 48.1% only;
  - MAG's 600 seed-matched battles: MODELS 1976.

  Each needs the same judgement as the 3.36.0 table.
- **WP ~2630 weather / sheet-gap table**: 1,768 (0.75%), 892 (2.78%) and 238 (19.83%) trace to no artifact. The prose
  above them says "Exact counts withdrawn 2026-08-06" while the table still prints them. The blockquote at WP 2640
  still carries struck `16,177 (50.47%)`. Left alone: a row edit would unbind the row's other figures.
- **The 2026-07-23 leaf reading** ("log-loss ≈ 1.2 … ~44% … inverted"): WP 1654 and MODELS 1427, kept as "a prior
  conclusion". It comes from the same instrument family as the withheld backtest.
- `data/leaf-comparison.json` (no writer; declares itself an ad-hoc MEASURE analysis) is neither cleared nor withheld,
  and carries the same 6,886-game table.

## Verification (final bytes)

| check | result |
|---|---|
| `engine/quarantine.js` | GATE CLOSED, 3 of 8 gating clauses fail, 69 of 258 withheld |
| `tests/test-docs-quarantine.js`, before | 30 stand, 30 fire, green |
| after edits | green; printed exactly 4 under "DELETE these lines"; no new hit |
| after key removal (final) | **all checks passed; 26 stand, 26 fire, 0 no longer do** |
| `tests/test-docs-current.js`, before any edit | 36 passed, 1 failed: 3b(d) `docs/TAG-COVERAGE.md:14 6,829` (2207 → 2208) |
| after edits, first run | 36 passed, 1 failed, but NEW adds `docs/MODELS.md:1259 34`, which is mine (the sentence split above) |
| after the fix (final) | **36 passed, 1 failed; the only NEW entry is `docs/TAG-COVERAGE.md:14 6,829`**, not on a line this pass edited. Grandfathered 2207 → 2026 (MODELS 585 → 520, WP 382 → 293, SUMMARY 206 → 187, deck 99 → 92, tech 156 → 155) |
| `data/docs-currency-baseline.json` | not written (a red run writes nothing) |
| sweeps, after | every-owner route: 3 hits, all the 14.757% collision. Section route: 67. The one new entry, MODELS `22.0%` (a DODUO cut beside a newly added citation), is a candidate only; the test's route 1 does not charge it |
| `build/build_pdfs.js` | `--check` before: exactly the 7 edited documents stale. Build: 7 built, 0 failed. `--check` after: every document has a current PDF |

**How the coordinator should judge the commit:** the pre-commit hook runs `test-docs-current.js --staged`, which
reads the index. These edits are unstaged, so that run was not possible here.

## Not run, on instruction

`node engine/status.js --write` would restamp generated blocks in `docs/ENGINE.md`, which ENGINE owns during this
pass. The RUNNING-NOTES row and the CHANGELOG entry are in the verdict returned to the coordinator.
