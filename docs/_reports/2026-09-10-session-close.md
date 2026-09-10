# Session close — 2026-09-09 morning through 2026-09-10 early hours

Historical by construction. **Every figure here is derived; re-derive rather than quoting this file.**
`node engine/status.js` and `node engine/open_work.js` print the current state.

## What this session did, in one line

A full pre-6.0.0 review by nine read-only agents produced two dated deliverables and a ranked list;
the store turned out to be missing 15,862 games nobody knew were gone; the board-material headline
turned out to exclude its own three counterexamples; and by the end **BOARD-MATERIAL reads 0 of 961
with 0 void and NARRATION 6 of 961 across 7 causes** — the gate at 8 of 9 with narration alone red.

## The engine bytes moved after the last measurement

**The residual-trio fix (ROADMAP #563) landed in `75efb271` and NO gate artifact has been run against
it.** Every whole-game, damage, roster and census figure stands on release `489bea0577bc`;
`engine/status.js` withholds the whole-game clauses as MEASURED AGAINST A DIFFERENT ENGINE until the
chain below runs. The narration count of 6 of 961 is a claim about `489bea0577bc`.

## OWED, NOT RUN

### 1. The re-measure, which everything else waits on

```bash
# cut ONE release on the current tree, then run the chain in this order, checking each
# artifact's `generated` stamp moved. Predict first.
node engine/engine_release.js cut "residual handler-list sort"
# -> write the prediction to data/verification/_prediction-<date>-batch-AA.json BEFORE running
cmd /c tools\lownode.cmd tests\test-engine-diff.js --write
cmd /c tools\lownode.cmd tests\roster.js --stage all --write
cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release <id>
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release <id> --arm middle --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --write
node engine/status.js          # read-only; expect BOARD-MATERIAL 0 of 961, NARRATION 6 or lower
```

Expect the three residual-trio games to stop diverging. If they do, narration reads 3 of 961.

### 2. The last illegal fixture in the repository

```bash
# engine/game_differential.js:6186,6256,6325,6348 stages a body that cannot learn its move.
# Derive a legal carrier (95 exist) preserving the fixture's premise, then:
node tests/test-fixture-legality.js      # target 0 sets / 0 declarations
```

### 3. The stale bundle and the figure it orphans (ROADMAP #568)

```bash
# reproduce, identify the figure, retract or re-derive it, land the fresh bundle in ONE pass:
node build/build_browser_data.js          # regenerates data/board-data.js (Generated 2026-08-03)
node tests/test-docs-current.js           # docs/MODELS.md goes 29 -> 30 untraceable
git checkout -- data/board-data.js        # revert if not fixing in the same pass
```

### 4. Never-run measurements

```bash
# the corner arms have never been run on the whole game — a board that parts only at a corner
# is a tie-handling defect:
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release <id> --arm top-tie-first --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --out data/verification/game-differential-top-tie-first.json
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release <id> --arm bottom-tie-first --end-state --games 1200 --team-store data/team-pool-frozen --turns 50 --out data/verification/game-differential-bottom-tie-first.json

# the damage differential has NEVER applied a multi-hit move
# (data/engine-diff.json skipped_multihit 134, skipped_ability_multihit 17):
node -e "const j=require('./data/engine-diff.json');console.log(j.skipped_multihit, j.skipped_ability_multihit)"

# what share of real human clicks the engine can perform — artifact dated 2026-08-06:
cmd /c tools\lownode.cmd engine\medicham_coverage.js
```

### 5. Stale instruments

```bash
cmd /c tools\lownode.cmd tests\test-mutation-coverage.js --write   # artifact measured on 6fb9ebd3b704
node tests/test-board-browser.js                                   # browser copy disagrees with board.js
```

### 6. One review, not a run

`tests/probe_residual_trio_handlerless_body.js` lost a refusal clause from its header contract (the
fixture-discrimination check) to an agent that never reported. The knob control is the stronger
receipt and is wired and proven, but nobody has judged the removal.

## Red and unwaived, named

`test-board-browser`, `test-counter-init` (green as of batch Z — re-check), `test-fixture-legality`
(1 set, 1 declaration, both the differential's), `test-mutation-coverage`, `test-quality` (drift is
the 15,862 recovered games; the restamp rides a release cut), `test-workflow-paths` (sibling clause),
`engine/selftest.js` (4 illegitimate raw-store readers), `engine/conformance.js` (tree-wide stamps),
`engine/provenance.js` (red by construction until the re-run), `engine/sanity_check.py` (the two
U+FFFD `|win|` rows, ROADMAP #558), `engine/em_validation.js` (its own recorded negative verdict —
refused a waiver deliberately).

**Waived by Will, by name, 2026-09-09** ("yes web paused and mag paused all i care about is medicham
working"): the four web tests and three MAG-weight tests, in `data/test-waivers.json`, printed WAIVED
by the runner and not counted against the exit code.

## What was reverted rather than committed

`data/mechanics-census.json` — regenerated at 03:03Z by a killed chain with no report saying which
engine it ran on. A census of unknown provenance breaks the photograph rule.

`data/board-data.js` — see ROADMAP #568 above.

## Collection

Reg M-C is collected hourly in CI: **2,183 bo1 and 1,197 bo3 games on origin**, three successful
runs committed as `abra-bot`. GitHub skipped three scheduled slots (the collector's 01:07 and 02:07,
the ingest's 00:17); two manual dispatches covered the window and the workflow now carries a second
cron at `:37`. Reg M-B stays active; nothing about Reg M-C is simulated (ROADMAP #553).
