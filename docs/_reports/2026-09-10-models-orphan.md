# The orphaned figure in `docs/MODELS.md` — identified, re-derived, and it was never orphaned by anything in this repository's control

**2026-09-10, MEASURE.** One clause of `tests/test-docs-current.js` was red and `.githooks/pre-commit`
runs it, so nothing could be committed. This is the account. The verdict is at the top; the derivation
and the two things it turned up on the way are below it.

---

## 1. The verdict

| | |
|---|---|
| **The figure** | `7,381` — the `n_games` of the PORY run that produced the retracted coefficients, `docs/MODELS.md:1466` |
| **What orphaned it** | commit `dd09c24b`, *ingest: new ladder games 2026-09-10T04:50Z* — the six-hourly ingest rewrote `data/meta-usage.json` |
| **Why that mattered** | the figure's ONLY trace under `data/` was `raichu`'s usage count `"n": 7381` in that file. It reads `7385` now. The usage count never made the claim; the trace was arithmetic coincidence |
| **Resolution** | **RE-DERIVED, not retracted.** The claim is true and is verifiable from the commit it names |
| **Count afterwards** | `docs/MODELS.md` **29** untraceable figures, equal to the ratchet. `tests/test-docs-current.js`: **35 passed, 0 failed** |
| **The ratchet** | **NOT raised.** `data/docs-currency-baseline.json` was not hand-edited (see §6 for the one write it did receive, which is the gate's own) |

**It is inherited and it is not ROADMAP #568.** The prior session's close report predicted a 29 → 30
from regenerating `data/board-data.js`; that bundle is reverted and is not what fired. #568 is real
and its figure is now named without regenerating anything — see §5.

---

## 2. Identifying the figure

The shape was printed before it was queried, per the brief.

```
node engine/docs_scan.js --quarantine --json
  → top keys: changelog_top, docs_scanned, versioned, unversioned, archive, lexing_proof,
    retraction_proof, retraction_registry, retraction_violations, citation_mismatches,
    quarantined_figures, untraceable
  → untraceable: { total, per, where }
  → where: an object keyed by document path; each value an array of { line, value, text }
```

`untraceable.where["docs/MODELS.md"]` held 30 rows / 28 distinct values (`24,997` and `1.544` appear
twice each). Differenced against `data.known.untraceable_figures` in
`data/docs-currency-baseline.json` — which is de-duplicated by value and keyed `"<doc>|<value>"` —
exactly one entry was new and none had retired:

```
NEW:   docs/MODELS.md|7,381
GONE:  (none)
```

The gate names it too, and that is the check that matters rather than my diff:
`tests/test-docs-current.js` prints `FIGURES THAT ARE NEWLY UNTRACEABLE SINCE THE BASELINE:` followed
by the single line `docs/MODELS.md|7,381`.

## 3. What orphaned it, and when

`untraceableCensus()` treats a figure as traced if it appears in the number union of any `data/*.json`
or `data/*.js` file (excluding the two `NOT_AN_ARTIFACT` self-reference files) or in `CHANGELOG.md`.
Rebuilt that union file by file: **no artifact under `data/` contains `7381` today.**

Walking the recent commits for any top-level artifact holding a value that indexes to `7381`
(`a`, `a*100` or `a/100`, at the document's own decimal place) turned up one file that had it and
lost it:

```
8a229726:data/meta-usage.json:130    "n": 7381        ← raichu
8a229726:data/meta-usage.json:2287   "n": 7381
```

Proven rather than inferred, with the census's own predicate on both blobs:

```
old meta-usage has 7381: true
current meta-usage has 7381: false
```

The rewrite is commit `dd09c24b`, the 04:50Z ingest. `raichu` now reads
`{"sp":"raichu","teamRate":0.1148,"bringRate":0.659,"leadRate":0.455,"winRate":0.498,"n":7385}` —
four more ladder games with a Raichu on the team, and a published figure lost its only source.

**This is the failure shape the brief warned about, arriving from the other side.** The census counted
`231` as traced because it sat inside a 308 KB census; here it counted `7,381` as traced because a
species usage count happened to equal it. The gate did not regress on 2026-09-10 — **it stopped being
wrong**, and the thing it had been wrong about was in its favour.

## 4. Re-derivation

The sentence in `docs/MODELS.md:1466` reads:

> 1.256 / 1.544 is commit `44e0fb0` (2026-07-24, `n_games` 7,381) — the run the retraction was
> written against, and the last one fitted on the **unfiltered store, bot games included**.

Both halves of that check out against the named commit:

```
git show 44e0fb0:data/pory-eval.json
  n_games   7381
  weights   [-0, 0.86626, 0.48742, 0.41143, -0.41143, -0]
  feat_std  [1.0008, 0.31577, 1.0536, 1.0536, 0.32952]
```

Reducing by the same route the artifact's own `reduced_form` block documents — `alive_diff` picks up
`w[1]/std[0] + w[3]/std[2]`, because `my_alive` and `foe_alive` are exactly antisymmetric and fold in;
`hp_diff` is `w[2]/std[1]`:

```
alive_diff  0.86626/1.0008 + 0.41143/1.0536 = 1.2561
hp_diff     0.48742/0.31577                 = 1.5436
```

**1.256 / 1.544.** The commit named by the sentence is the run that produced the coefficients the
sentence attributes to it, and its `n_games` is 7,381. The figure is not stale, not wrong and not a
candidate for retraction.

**How the trace was made durable.** The re-derivation is recorded in `CHANGELOG.md` under 5.279.0,
with the command that reads it back. That is not a workaround of the gate, it is the gate's stated
design for exactly this case — `changelogHas()` in `engine/docs_scan.js` carries the reasoning in
place: *"a figure recorded in CHANGELOG.md is TRACEABLE. It is not a weaker trace than an artifact, it
is a different one — the artifact says what is true now, the changelog says what was true and when. It
cannot launder an invented number either, because writing a figure into the changelog is itself a
recorded claim under a version and a date."* A superseded `n_games` from a July run is the archetypal
case: no artifact will ever hold it again, because `data/pory-eval.json` holds what the LAST run
produced.

**The precedent was checked before choosing.** `data/docs-currency-baseline.json` already carries
`docs/MODELS.md|15,279`, a hand-raised entry for the same shape ("COINCIDENCE BROKE ... it was scoring
as traceable on an arithmetic collision"). That figure could not be re-derived — it is a MAG/joint
figure, `data/policy-weights.json` is quarantined, and Will sequenced the MAG refit after 6.0.0. This
one CAN be re-derived, so it was, and the ratchet was left alone.

## 5. Two things found on the way, neither of them fixed here

**(a) `docs/MODELS.md:1466` states a safeguard the artifact does not have.** The block ends: *"`data/
pory-eval.json` now carries a `reduced_form` block derived from its own weights, plus the per-run
history, so this cannot drift again."* The file carries `reduced_form`. **There is no per-run history
in it** — the keys are `generated, n_games, n_states, train_states, test_states, population_ceiling,
population_ceiling_note, log_loss, paired_vs_material_two_feature, brier, accuracy, ece, reliability,
weights, feat_mean, feat_std, features, verdict, withdrawn_verdict, reduced_form`. So the drift guard
that paragraph promises is the commit hash, not the artifact. The dated block was **not rewritten** —
CLAUDE.md forbids editing a dated claim in place — a marker was added beneath it saying so. **This is
UNREGISTERED: no ROADMAP row covers it.** The fix would be a per-run history block that
`engine/pory.py` appends rather than one typed in by hand, and PORY is Will's model.

**(b) ROADMAP #568's figure is named, without regenerating the bundle.** Rebuilding
`allArtifactNumbers()`'s union with `data/board-data.js` EXCLUDED and re-running the census predicate
over `docs/MODELS.md` gives exactly two figures traced by that bundle alone: `14.233%` (line 59) and
`9,759` (line 2202). `14.233` is in `CHANGELOG.md` and is therefore exempt permanently. **So
regenerating `data/board-data.js` orphans `9,759` at `docs/MODELS.md:2202`, and nothing else in that
document.** The row is updated with this and with the command that confirms it. Nothing was
regenerated to derive it; the prediction is falsifiable in one run.

Both (a) and (b) sit under the same head as tonight's figure: `docs/MODELS.md:2202` is a paragraph of
STORE COUNTS — five of its six figures are already untraceable and the sixth hangs on a month-old
bundle. Store counts drift hourly and no artifact claims them, so every one of them is one ingest away
from being what `7,381` was tonight.

## 6. What moved on disk

| File | What |
|---|---|
| `docs/MODELS.md` | one `>` marker added under the dated block: the provenance re-derivation, the coincidence that had been the trace, and the missing per-run history. The dated paragraph is untouched |
| `CHANGELOG.md` | one bullet under the existing unreleased `[5.279.0]` — the re-derivation, with `7,381` and the command that reads it back |
| `docs/RUNNING-NOTES.md` | one row, `[5.279.0]`, `Basis. unchanged`, `Supersedes. Nothing` |
| `docs/ROADMAP.md` | #568 gains the named candidate figure and the note that it is NOT what failed the gate tonight |
| `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md` | `node engine/status.js --write` — stamps only; the generated blocks' values were already current |
| `data/docs-currency-baseline.json` | **written by the gate, not by hand.** A green run of `tests/test-docs-current.js` tightens the ratchet monotonically; it moved `docs/ABRA-whitepaper.md` 12 → 11 and dropped `docs/ABRA-whitepaper.md\|16,177`. `docs/MODELS.md` stayed at 29 and NOTHING was added. That whitepaper figure was already traced before this session's first edit |

Nothing under `engine/` was touched, nothing played a game, and no release was cut or opened.

**Two shapes to avoid if you write in this area** — both were hit and corrected during this pass, and
both are the documentation gate reading a sentence exactly as it is written:

- **An inline code span split across two lines stops being a code span.** `` `git show\n  44e0fb0:data/pory-eval.json` ``
  in `docs/RUNNING-NOTES.md` was lexed as the figure `44` attributed to `data/pory-eval.json`, and the
  citation clause went red on it. Keep a backticked command on one line.
- **A path in the same SENTENCE as a figure is a citation, and the figure is then judged against the
  file at that path TODAY.** Writing "`git show 44e0fb0:data/pory-eval.json` records `n_games` 7,381"
  reads as a claim that the LIVE artifact holds 7,381, which it does not (it holds 5883). Split it:
  state the figure against the commit, and put the command in its own sentence.

## 7. Verification

```
tests/test-docs-current.js      35 passed, 0 failed
  ok  no living document gained untraceable figures (56 across 6 documents)
  ok  figures a cited artifact does not contain: no new entries (baseline 45, now 45)
  ok  the backlog owed to the next major is under the cap (83 of 100)
tests/test-roadmap-register.js  3 passed, 0 failed
tests/test-artifact-rerunnable.js  ALL GREEN — 6 checks
```

Those are the three gates `.githooks/pre-commit` runs. The commit block is cleared.

**Not committed and not pushed** — the tree is held by the coordinator, which has unrelated
uncommitted work in it.

---

## OWED, NOT RUN

```bash
# 1. Confirm the ROADMAP #568 prediction, and land the fresh bundle in the SAME pass as the fix.
#    Expect: docs/MODELS.md 29 -> 30, and the named figure to be 9,759 at docs/MODELS.md:2202.
node build/build_browser_data.js
node tests/test-docs-current.js
```

```bash
# 2. Decide 9,759 the same way 7,381 was decided: re-derive it or retract it. It is a store count in
#    the GURU/meta paragraph, so start by asking which artifact is supposed to make that claim.
sed -n '2202p' docs/MODELS.md
node engine/docs_scan.js --quarantine --json
```

```bash
# 3. WILL'S CALL, PORY IS HIS MODEL. data/pory-eval.json claims a per-run history in docs/MODELS.md
#    and does not have one. Either engine/pory.py appends a run history (so a superseded n_games is
#    traced by the artifact that produced it, not by a commit hash), or the sentence comes out.
#    Do NOT hand-write a history block into the artifact.
node -e "console.log(Object.keys(require('./data/pory-eval.json')).join(' '))"
```

```bash
# 4. RECOMMENDATION FOR WILL, NOT DONE HERE. The census cannot see this repository's strongest
#    citation form. CLAUDE.md: "this project traces a figure back to the run that produced it BY
#    COMMIT HASH" — and engine/docs_scan.js has no clause for `<sha>:<path>`. Every superseded figure
#    in every dated correction block is therefore traced by luck until somebody writes it into the
#    CHANGELOG. A `git show <sha>:<path>` citation, verified by resolving the blob, would retire a
#    whole class of these. It is a change to a GATE and it is not made while the gate is the thing
#    unblocking the repository.
grep -n "changelogHas\|NOT_AN_ARTIFACT" engine/docs_scan.js
```
