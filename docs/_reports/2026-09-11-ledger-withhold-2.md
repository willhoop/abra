# The R4 verdict, the refit figures and SEARCH's sweep tables are withdrawn, and a sweep of both ledgers finds more — 2026-09-11

MEASURE. Historical findings record; not maintained. Nothing committed or pushed. No games played.
Edited: `docs/MEASURE.md` and `docs/SEARCH.md`, outside every `<!-- GENERATED -->` block. Nothing else in
the repository was changed.

## Verdict

1. **The three owed items are withdrawn.** Each one's generator chain was checked against
   `engine/quarantine.js` (below), not assumed.
   - The R4 verdict, including the verdict code.
   - The Stage D refit movement and corpora.
   - SEARCH's explore-sweep paragraphs.
2. **A sweep of both ledgers against the derived withheld set found more.** The finds in
   `docs/MEASURE.md` are withdrawn; the rest are reported below, not edited.
3. **641 numeric tokens withdrawn gross:** 529 in `docs/MEASURE.md`, 112 in `docs/SEARCH.md`. This is
   a count of digit runs in the old text that have no copy left in the replacement, so some are
   fragments or labels rather than whole figures.
4. **Tests, both green:**
   - `node tests/test-docs-quarantine.js`: all checks pass. 35 seeded offenders still stand and 15 no
     longer fire (13 because of this pass, 2 pre-existing in `docs/MODELS.md`).
   - `node tests/test-docs-current.js --staged`: 37 passed, 0 failed, judged on a scratch index of HEAD
     plus this change's three files.

## The gate when this was read

`engine/quarantine.js` `state()`: **CLOSED**, 64 artifacts withheld. At read time, while ENGINE was
live, 3 of 9 clauses were failing. The status block stamped 08:10 says 2 of 9. Either way the gate is
closed, and the withheld set did not change.

## The three named items: the generator chain, as `quarantine.js` states it

| item | artifact | `withhold(file).because` |
|---|---|---|
| R4 verdict (`docs/MEASURE.md` §2; `docs/SEARCH.md` quarantine note and R11 GARY) | `data/rollout-r4.json` | `engine/rollout_r4.js reads games.r4-decided.jsonl — a dump of games MEDICHAM played` |
| Stage D refit (`docs/MEASURE.md` §14), with the §13 refit and the corpus stamps in SEARCH R8 and R10 | `data/policy-weights.json` | `its generator engine/fit_policy.js is in the play layer (it reaches engine/medicham2-browser.js through require)` |
| SEARCH's sweep paragraphs (R11, and "The `--rollout-explore` default was re-earned") | `data/rollout-r1-explore-sweep.json`, `data/rollout-r1-explore1.json` | `engine/rollout_explore_sweep.js reads rollout-r1-explore1-rows.jsonl, rollout-r1-rows.jsonl — a dump of games MEDICHAM played`; `engine/rollout_r1_artifact.js reads rollout-r1-rows.jsonl — …` |

Each figure was also checked against its artifact. The R4 share, decisive pairs, LLR, bound and stopping
pair are all in `data/rollout-r4.json`. The R11 accuracies, the h60 leg and the release-boundary counts
are in the sweep artifact. `PASS_OUTRIGHT` and the lift interval are in `explore1`. The shipped Stage D
"after" weights and both corpus sizes are in `data/policy-weights.json`.

## The rule applied

- **Withheld:** every output of a withheld artifact's measurement, and that measurement's own sample
  size. That covers rates, shares, intervals, weights, SEs, norms, costs, counts of positions, pairs,
  decisions, vectors and rows, and the corpus a fit or backtest recorded.
- **A gate's verdict code is a figure.** `status.js` prints `QUARANTINED` in place of R4's `ACCEPT H1`
  and R1's `PASS_OUTRIGHT`, so both come out. Two headings asserted a withheld figure, and each was
  reworded: SEARCH R11 said "it PASSES OUTRIGHT", and MEASURE's speed section said "THE LEAF COSTS
  1.14–1.27 s". §14's heading lost its census count.
- **Kept:**
  - configuration (n=200, explore, horizon, caps, reps, bootstrap resamples, seeds);
  - identifiers, times and code facts;
  - direction words, following the precedent of `3bf103ca`;
  - figures that measure MEDICHAM rather than consume it. §0's fidelity arm stays: games that never
    part, the first-divergence depth, the depth-bin counts, the turn-metric spread and the
    reversed-order control. So does R4's corpus shape (5,248 lines / 2,624 games / 1,312 seed pairs),
    which is the harness design, not an outcome.

## Withdrawn, by section

| ledger · section | gross | what |
|---|---|---|
| MEASURE §0 leaf/engine contrast | 112 | Brier and log-loss deltas, CI, floor and MDE; McNemar counts, z, p, r, \|Δp\|; Brier vs coin; discrimination and its floor; ECE, MCE and the reliability bins; the Spearman tables and Δ-rho; the per-bin Brier and the never-parted bin's accuracy; the leaf-call cost (R2 type); the scored-position count |
| MEASURE §0b | 4 | the exploitability run's accepted steps and final step scale |
| MEASURE §2 R4 **(named)** | 12 | share, decisive pairs, stopping pair, LLR, bound, split-half spreads, the sd |
| MEASURE §4 R2/R3 | 42 | R2 board count, leaf cost and affordability table, the corrected 200x ratio and its operands; R3 rate, counts, Wilson interval, the doc's floors (R3 divergence), the switch headline |
| MEASURE §5a | 4 | the backtest's corpus size and the derived counts |
| MEASURE §5e | 4 | the served MAG standard errors and weights |
| MEASURE §5f | 6 | R1 and R4 split-half floors |
| MEASURE §10 | 1 | the live leaf's R1 accuracy |
| MEASURE §13 first refit | 51 | corpus, decisions and split; the A/B/C table; the paired-difference table; floor; weights past 2 SE, SE, norms |
| MEASURE §13b joint refit, sheet channels | 52 | corpus and turn counts, fitEnvironment slots, held-out logL/top-1, menu-miss rate; the sheet-channel table and floor; the joint `turnsDropped` rate and counts |
| MEASURE §14 **(Stage D named)** | 110 (Stage D 19) | censoring-value table and sample; the blockquote re-run; EM recovery and bias; census class table; classifier recall and precision; the fit-corpus raw-log coverage; the EM validation table; Stage D norm, count, before → after table and the two corpora; the confound's corpus sizes; the class floors; the old `turnsDropped` |
| MEASURE §16 blockquote, §17, §17b, §17a | 97 | feature/engine contrast vectors, calls and exposure table; the censoring re-run table, floors, census shares and recall; the pinned-sample and corpus counts |
| MEASURE speed section (2026-08-28) | 32 | heading leaf cost; bench rates, scaling ratios and noise figures, all from `data/_bench-*.json` |
| MEASURE "Reading a stamp", "Running the backtest" | 2 | R1's published figure; the legacy arm's run-to-run floor |
| SEARCH quarantine note, R11 GARY | 5 | the R4 share and decisive pairs |
| SEARCH R8, R10 | 14 | refit corpus stamps; F1's quoted weights and SEs |
| SEARCH explore default re-earned **(named)** | 36 | the 2026-08-04 sweep table, paired interval, published-vs-measured, playout wipeout/cap/turn figures |
| SEARCH R11 **(named)** | 57 | both verdict tables, the gate threshold and verdict, the h60 leg, the release-boundary table, the self-check rate, the misalignment cost, the quoted verdict, the "4.6 points" |

A top entry in `docs/MEASURE.md`, directly under the GENERATED block, records this pass without figures.

### Three figures the test charged on the first run, and why they stay

After the first application, the quarantine test failed on three **new** keys: `10,000` twice (bootstrap
resamples) and `1,200` (the EM validation's games). All three are configuration. They became chargeable
only because this pass had written the withheld artifact's filename into those paragraphs (§13b sheet
channels, §14 censoring value, §14 Stage C), and each artifact does carry its config. The three added
filenames were taken back out of those paragraphs, so each paragraph is back to its pre-pass citation of
the generator. The withholding sentence stays in each. No figure was hidden to make the test pass. The
ratchet was not grown either: it may only shrink.

## Further finds, reported and not edited

| where | figure(s) | artifact | why left |
|---|---|---|---|
| `docs/MEASURE.md` "ROADMAP #68" (replay differential) | 3,000 games, 5.47%, 5.36%, 159, 36.4% and the mechanic table | `data/replay-differential*.json` — **withheld** | It measures MEDICHAM against recorded games, so it is an instrument. It looks like the class the 2026-09-06 re-seed found wrongly withheld. **This is a question about the classifier, not the ledger.** |
| `docs/SEARCH.md` R9, R10 | 0.21/0.202 pt, 4.77, 0.45, the budget and family tables, 960,000 (a seeded key) | `data/exploit-step-probe*.json` — **withheld** | A climber on a planted objective: "no games". Same classifier question. |
| `docs/SEARCH.md` R8 | mirror control 49.7% [46.2, 53.2] n=782, 47.0/47.5%, 63.2% (retracted), 55.8/45.8% (struck), 27.7%, 1 of 24, 0.0168 | `data/exploitability.json` (void, **withheld**) | SEARCH's ledger, outside the named paragraph. The same step counts came out of `docs/MEASURE.md` §0b. |
| `docs/SEARCH.md` R20 | 32 of 58, 6 of 18, 1.576% of 51,399 (seeded keys), 41.67% of 300 | `data/feature-shift.json` — **withheld** | SEARCH's call. The census calls these real offenders. |
| `docs/SEARCH.md` #283 | seven callbacks carrying 9,163 uses, and the per-move counts | `data/seed-source-audit.json` — **withheld** | An audit of callback behaviour; likely an instrument. |
| `docs/SEARCH.md` R12 | 52 `\|cant\|nopp` lines, 0 Struggles | `data/pp-board-probe.json` — **withheld** | SEARCH itself calls the probe "a receipt that a state is representable, not a leaf value". |
| `docs/MEASURE.md` §11, §13a | feature-movement counts (1,768 / 892 / 14 of 58; 37,460 / 16,177 / 20 of 58) | **none cited** | Not read from a withheld artifact, although they are the same class as `feature-shift.json`. Out of this brief's criterion. |
| `docs/MEASURE.md` §5c, §5d, §13b (PORY), §18 | PORY and PORY-NN figures; the PORYGON2 separation gate | `pory-eval.json`, `pory-nn.json`, `porygon2-separation-gate.json` — **NOT withheld** | CLAUDE.md's quarantine list names PORYGON2, but `quarantine.js` withholds none of these files. The previous pass withdrew PORY2's "points over counting" on the strength of CLAUDE.md. This is a disagreement between the two, for the coordinator. |
| (classifier) | — | `data/policy-weights-pre-censoring.json` — **NOT withheld** | The Stage D incumbent MAG vector was fitted through the same simulator. No figure from it is left in the ledgers after this pass, but the gate would not stop one. |

## Scratch and safety

- The real index and the real `.git` were never written. The staged run used a scratch `GIT_INDEX_FILE`
  and a scratch `GIT_OBJECT_DIRECTORY`, with the real objects as a read-only alternate.
- Edits were applied by an anchored patch: each hunk had a unique start prefix and an asserted span
  length, and a dry run went first. Both ledgers were clean against HEAD beforehand.
- No process was killed. One read-only repo-wide grep of mine ran in the background and completed on its
  own.

## OWED, NOT RUN

Record and commit. Not done, on instruction. The notes row and the CHANGELOG text are in the verdict
returned to the coordinator.

```bash
git add docs/MEASURE.md docs/SEARCH.md docs/_reports/2026-09-11-ledger-withhold-2.md docs/RUNNING-NOTES.md CHANGELOG.md
git commit
```

Restamp the ledgers. Not run, because it rewrites generated blocks in `docs/ENGINE.md`, which ENGINE owns
tonight:

```bash
node engine/status.js --write
```

Shrink the quarantine ratchet by the 15 keys that no longer fire. `tests/test-docs-quarantine.js`
BASELINE may only shrink, and this pass did not edit the test:

```bash
node tests/test-docs-quarantine.js | grep -A16 'DELETE these lines'
```

The classifier questions, derived rather than typed:

```bash
node -e "const Q=require('./engine/quarantine.js');const s=Q.state();for(const f of ['data/replay-differential.json','data/exploit-step-probe.json','data/seed-source-audit.json','data/pp-board-probe.json','data/policy-weights-pre-censoring.json','data/pory-nn.json','data/porygon2-separation-gate.json'])console.log(f,JSON.stringify(s.withhold(f)))"
```

SEARCH's remaining finds, for SEARCH:

```bash
grep -nE '49\.7%|63\.2%|27\.7%|1 of 24|0\.0168' docs/SEARCH.md     # R8, void exploitability
grep -nE '1\.576%|51,399|41\.67%' docs/SEARCH.md                   # R20, feature shift
grep -n '9,163' docs/SEARCH.md                                     # seed-source audit
grep -n 'cant|nopp' docs/SEARCH.md                                 # R12, PP board probe
```

The withheld figures return only when the gate opens and each artifact is re-run. The refit is expensive:
**ask Will before starting it.**

```bash
node engine/quarantine.js                     # must read OPEN first
node engine/rollout_r4.js
node engine/rollout_explore_sweep.js
node engine/leaf_engine_contrast.js
node engine/rollout_r2.js && node engine/rollout_r3.js
node --max-old-space-size=4096 engine/fit_policy.js && node --max-old-space-size=4096 engine/fit_joint.js
node engine/click_census.js && node engine/censoring_value.js     # censoring_value needs WEIGHTS_OLD (MEASURE §16)
node engine/feature_engine_contrast.js
```
