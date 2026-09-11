# Withdrawals, second pass: the 3.40.0 corpus counts and the step probe — 2026-09-11

MEASURE. A historical findings record; it is not maintained. Nothing was committed, no git command was run, no game
was played, and no differential, roster or census was run. ENGINE was live throughout: it rewrote
`data/roster.items.json`, `data/roster.abilities.json` and `data/roster.moves.json` at 15:43–15:45Z and
`data/game-differential.json` at 15:57:07Z. None of ENGINE's files was touched.

## Verdict

1. **Both owed items are withdrawn.** The 3.40.0 fit-corpus counts are out of the white paper (two places), the
   technical docs and `docs/ENGINE-COVERAGE-PLAN.md`. Every `exploit-step-probe` output figure is out of SEARCH R9
   and R10. What was measured, the configuration and the design reasoning stay.
2. **The ratchet shrank by 7, derived by running it.** The 4 commented pre-censoring keys are gone, and so are 3
   more that stopped firing: the white paper's MAG decision count, which shared the rewritten sentence, and the
   probe's cheapest-split budget in SEARCH and in `docs/COVERAGE-PLAN-REVIEW.md`. 37 → 30 keys stand, 0 dead.
   Nothing was added.
3. **`tests/test-docs-quarantine.js`: green.** **`tests/test-docs-current.js`: RED, 35 passed and 2 failed, and none
   of the failing entries is on a line this pass edited.** Both clauses fail on figures whose artifacts ENGINE
   regenerated on disk during the pass (see Verification). My own 3b(d) regressions (4, in
   COVERAGE-PLAN-REVIEW) were found and fixed.
4. **Scope went slightly past the brief, on the same two artifacts only.** The same step-probe figures stood in the
   white paper's coverage-plan paragraph and in `docs/COVERAGE-PLAN-REVIEW.md` §6 (a seeded key). Both were
   withdrawn. Other withheld artifacts' figures found on the way are listed as owed below, not touched.

## The withheld set, derived

`cmd /c tools\lownode.cmd engine\quarantine.js`, 2026-09-11 ~15:52Z: `GATE: CLOSED — 2 of 8 GATING clauses fail`,
69 artifacts withheld. Among them: `data/exploit-step-probe.json`, `data/exploit-step-probe-reparam.json`,
`data/policy-weights-pre-censoring.json` (no discoverable writer; key twin of the MAG vector),
`data/policy-weights.json`, `data/policy-weights-joint.json`, `data/exploitability.json`,
`data/exploitability-holdout.json`.

Checked against the pre-censoring artifact: `corpus` = games 8,856 / decisions 231,722 / train 185,560 /
test 46,162, and `1772` occurs in it. `99.67` / `0.9967` occur in no policy artifact; it is the fit's reach-counter
share, which the MODELS pass already withdrew, and it sat in every sentence rewritten here.

## What came out, per file

| file | withdrawn | kept |
|---|---|---|
| `docs/ABRA-whitepaper.md` ~2282 | 232,815 / 241,927 / 1,336 (MAG vector), 231,722 (pre-censoring), 99.67% | that MAG was refitted on four channels with a point-of-use counter; that the counts are withheld |
| `docs/ABRA-whitepaper.md` ~2298 | the probe's step worth and resolution | that the probe cancelled the 58-dimension re-run; the 4–8 reparameterisation |
| `docs/ABRA-whitepaper.md` ~2615 | 46,162 held-out decisions, 1,772 games (pre-censoring); the bootstrap count, which lost its grandfathering when the sentence was rewritten | the paired design; the table below it (see owed) |
| `docs/ABRA-technical-docs.md` 3.40.0 record | 99.67%, 231,722 | that a counter proves the channels reached the board |
| `docs/ENGINE-COVERAGE-PLAN.md` status bullet | 231,722, 99.67% | `fitEnvironment` stamped; the counter exists |
| `docs/COVERAGE-PLAN-REVIEW.md` §6 | 0.202, 4.77, 0.0% ± 0.1, −1.5%, ~960,000, 4 parameters; then d=58, 220, 24×220, which lost their grandfathering in the rewrite | what the probe measured, bullet by bullet, and the amended endgame |
| `docs/SEARCH.md` R8 box | the probe's 0.0% ± 0.1; the 7,100 budget in that rewritten sentence | the instruction not to run the 58-dim re-run |
| `docs/SEARCH.md` R8 re-run steps | — | one wording fix: the selection floor is withheld with the *probe* artifact, not the void one |
| `docs/SEARCH.md` R9 | step worth (0.21 pt), both resolutions and the ratio table; the pre-restart rates; the target sweep's cells; the whole acceptance/distance table (12 cells, 3 z-scores); the void run's 1-of-24 and the toy's 2.4/24; −1.5%; the ~0 values at 5,280; both noiseless ceilings; the budget sweep table and its 960,000 split; the dimension sweep's cells; the selection-floor table; the void run's 55.8% and the retracted 63.2% | a notice naming both routes and the re-run command; every configuration (d, rounds, games, runs, targets, dimensions, shapes); the four changes to the climber; the readings; the two walls' argument; the untested sparse-mask caveat; everything from "What `exploit.js` now does" down, unchanged |
| `docs/SEARCH.md` R10 | 0.202 / 4.77 / 0.45; "about 4"; the 20-cell family table; the "two-thirds" paraphrase; F1, F2 and F3 resolutions | configuration (pMax 0.75, the 3.5-pt confirm floor, the 7.2% sparse cap, both of which are arithmetic); the families' definitions; the implementation cost; the recommendation, unchanged |
| `tests/test-docs-quarantine.js` | 7 baseline keys; the "four made visible" block | a dated note saying which 7 went and why |

Tables whose cells were all withheld became sentences, following the MODELS precedent: a table of withheld cells
leaves its configuration labels as unbound figures under `tests/test-docs-current.js` clause 3b(d).

## Verification (final bytes)

| check | result |
|---|---|
| `tests/test-docs-quarantine.js`, before | 37 stand, 37 fire, green |
| after edits, before key removal | 30 fire; printed exactly 7 under "DELETE these lines"; no new hit |
| after key removal (final) | **all checks passed; 30 stand, 30 fire, 0 no longer do** |
| `tests/test-docs-current.js`, before any edit | **already RED**: 36 passed, 1 failed. 3b(b) 18 → 20, white paper :1713 `142` and :1714 `486` against the roster files ENGINE regenerated at 15:43–15:45Z |
| after edits, first run | 35 passed, 2 failed. 3b(b) now 22, adding `961` at white paper :11 and SUMMARY :14 (`state.games_board_never_diverged` reads 959 on disk; ENGINE rewrote the artifact at 15:57:07Z, between my runs). 3b(d) had 5 new entries: 4 mine (COVERAGE-PLAN-REVIEW :109 `58`, `220`; :111 `24`, `220`) and technical docs :13 `961` (same ENGINE cause) |
| after fixing COVERAGE-PLAN-REVIEW (final) | **35 passed, 2 failed.** 3b(b): the same four ENGINE-artifact entries. 3b(d): only technical docs :13 `961`. Grandfathered 2228 → 2208 (retired by rewritten sentences). **No failing entry is on a line this pass edited.** |
| `data/docs-currency-baseline.json` | byte-identical to its pre-session copy; a red run writes nothing |
| `build/build_pdfs.js` | `--check` before: every PDF current. After: technical docs, white paper, ENGINE-COVERAGE-PLAN, COVERAGE-PLAN-REVIEW rebuilt (the last one twice); 0 failed |

**How the coordinator should judge the commit:** the pre-commit hook runs `test-docs-current.js --staged`, which
reads the committed bytes of ENGINE's artifacts, not the ones on disk. That is the run that decides whether these
edits are clean. It was not run here: it reads the index, and these edits are unstaged.

## Owed, found on the way, not touched

- **White paper ~2698–2704**: the exploitability paragraph still states the mirror control (49.7% [46.2, 53.2],
  n=782) and "1 of 24" (void run). Both are held (`exploitability-holdout`, `exploitability`). The same mirror
  control is in **`docs/SUMMARY.md` ~1499**.
- **`docs/MODELS.md` ~1263**: "1 of 24" and the 0.0168 step scale (void run).
- **`docs/PRIORITIES.md` ~176, ~224; `docs/EXTERNAL-EVIDENCE.md` ~455**: "1 of 24". **`docs/ROADMAP.md` ~73, ~533**:
  the same (ENGINE's file).
- **Joint layer**: 95,886 turns and 99.7% channel reach in the white paper ~2579–2580 and the technical docs ~1556;
  `data/policy-weights-joint.json` is withheld.
- **White paper ~2618–2627**: the 3.36.0 paired-refit table, the noise floor and the weight-move counts. They are MAG
  results, but they trace to no artifact (the scoring script was not kept, per
  `docs/_reports/2026-09-10-untraceable-sweep.md`). So the classifier cannot see them, and the decision is a
  judgement, not a derivation.
- The PORYGON2 / PORY-NN pattern the prior report listed (`63.59%`, `0.612`, `73,368`) no longer occurs in the white
  paper, SUMMARY or the technical docs.
- Cosmetic: the white paper's rewritten sentence left one source line over 100 characters (~2288). Rendering is
  unaffected.

## Not run, on instruction

`node engine/status.js --write` would rewrite generated blocks in `docs/ENGINE.md`, which ENGINE owns this pass.
The RUNNING-NOTES row and the CHANGELOG entry are in the verdict returned to the coordinator.
