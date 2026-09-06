# The quarantine classifier was wrong in two directions, and the gate could not see the deck

2026-09-06, MEASURE. Files changed: `engine/quarantine.js`, `engine/docs_scan.js`,
`tests/test-docs-quarantine.js`, `docs/MEASURE.md`, and four documents carrying a stale figure
(`docs/ABRA-whitepaper.md`, `docs/GAME-DIFFERENTIAL-DESIGN.md`, `docs/MODELS.md`,
`docs/SUMMARY.md`). Nothing committed.

## Headline

| | before | after |
|---|---|---|
| quarantined-figure ratchet, keys that fire | 37 | **52** |
| ...of which real debt carried over from the 104 seed | 37 | **12** |
| ...of which found by the new uncited route | 0 | **40** |
| artifacts withheld by `engine/quarantine.js` | 72 | **63** |
| typed modules in `MEASURES_THE_ENGINE` | 2 | **2 (the residual; 4 more are derived)** |
| figure-lexer demonstration cases | 5/5 | **7/7** |
| `engine/quarantine.js --selftest` | 226 passed | **233 passed, 0 failed** |

`tests/test-docs-current.js` ends green and byte-identical to its pre-change output except the
lexer count: citation mismatches 54 (unchanged), untraceable 34 (unchanged).

## Defect 1 — the exemption list. DERIVED, not extended.

It was two modules and it needed to be seven. It is now two again, and they are the residual.

### 1a. The gate had quarantined itself off its own test fixtures

`requiresOf` ran `stripComments` and then matched `require('./x.js')`. It did not consider that a
require can also appear inside a STRING, and the selftest at the bottom of `engine/quarantine.js`
hands the classifier a synthetic source map whose values are source text:

```js
'engine/board.js': "const M=require('./medicham2-browser.js');",
```

Six such fixtures put **`engine/quarantine.js` itself in the play layer**, and the closure carried
seven more modules with it:

```
engine/quarantine.js  engine/status.js  engine/open_work.js  engine/register_reality.js
engine/docs_scan.js   engine/where.js   engine/orient.js     engine/sweep.js
```

Every one of those is a printer or an index. None computes a quantity from MEDICHAM. Their
artifacts — `data/open-work.json`, `data/register-reality.json`, `data/whole-game-baseline.json`,
`data/quarantine-stamp.json` — were withheld on the strength of the gate's own test data.

Fixed with `stringMask`, a line-local scanner. Two things it had to get right, both measured rather
than assumed:

- **`${}` re-opens code.** A first version marked everything after a backtick as string and dropped
  `${require('./champions_sim.js').FORMAT}` in `engine/feature_fixture.js` — a require that really
  executes. Caught by reading the drop list, not the count.
- **A line, not the whole file.** A regex literal containing a quote (`/['"]/` occurs in this repo)
  would otherwise flip the scanner's state for the remainder of the file. Resetting at each newline
  bounds the damage to one line.

Across all 212 sources the corrected mask drops exactly two files' worth: this file's six fixtures,
and one self-name inside a `console.log` in `engine/job_cost.js`. Nothing else.

### 1b. "Measures" vs "consumes" is not derivable — measured, not asserted

The old comment claimed this of two files (`game_differential.js` vs `backtest_winrate.js`). It
holds across all of them. The strongest structural signal available is *"does this module also
drive the OFFICIAL engine"*, since an instrument compares ours to Showdown's. **All 44 play-layer
modules that write an artifact are inside `engine/champions_sim.js`'s require closure** —
`fit_policy.js` and `backtest_winrate.js` exactly as much as `game_differential.js`. The signal is
dead. That is now a measurement in the file rather than a sentence.

### 1c. What CAN be derived is the class that matters, and it is the file's own stated reason

The header of `engine/quarantine.js` already says the instruments "are the ones that will say when
the quarantine can lift, so withholding them would blind the project to its own exit condition".
That is not a judgement about a module — it is a fact about the file: **an artifact the GATE READS
is an exit-condition input by construction.** Withholding it would have the gate decide MEDICHAM's
fate off a number it simultaneously refuses to print.

So `gateInputArtifacts()` reads the clauses' own `readJson(D('data', ...))` calls out of this file's
source, plus the two filenames the clauses compose rather than spell (taken from `ROSTER_STAGES` and
`REGISTER_REALITY.rowsFile`, so a rename moves both together). `instrumentsOfTheGate()` then walks
those inputs and everything they were built FROM through the provenance graph, and exempts the
play-layer generators it finds.

Derived today (28 artifacts in the closure, 4 generators):

```
engine/game_differential.js         <- data/game-differential.json
engine/tag_dex.js                   <- data/tags.json
engine/derive_protocol_events.js    <- data/protocol-events.json   (via the `from` walk)
engine/all_mechanics_fire.js        <- data/all-mechanics-fire.json
```

`derive_protocol_events.js` is the reason the `from` walk exists: nothing in the gate reads
`data/protocol-events.json`, but the gate's first clause is built from it.

Still typed, with reasons, because the gate does not read them:

```
engine/million_run.js        the rate runner — MEDICHAM's dice against data/million-targets.json
engine/medicham_coverage.js  the click-coverage probe — human clicks against MEDICHAM's predicates
```

### 1d. The side-effect check, which is the important one

A classifier loosened too far unquarantines the whole family. It did not.

**72 → 63 withheld. Exactly nine artifacts moved, and every one is an instrument:**

```
all-mechanics-fire.json          the mechanics census
million-run.json  -staged  -150k the rate runner
register-reality.json            the register audit
open-work.json                   the register copy
medicham-represented-clicks.json the click-coverage probe
whole-game-baseline.json  quarantine-stamp.json    the gate's own
```

**Nothing downstream moved.** `policy-weights.json`, `winrate-backtest.json`, `rollout-r1.json`,
`rollout-r4.json`, `exploitability.json`, `leaf-engine-contrast.json`, `feature-shift.json`,
`feature-engine-contrast.json` and the rest are all still withheld. The exemption lands on the
GENERATOR and never on that artifact's readers — asserted in the selftest with a control that a
consumer sitting beside an exempted instrument stays quarantined.

### 1e. The loud half

`classify()` now returns `gateInputsWithheld`: a gate input that comes out QUARANTINED anyway. It
cannot arise from the derivation (which exempts the generator) but it CAN arise transitively, when a
gate input is built from something quarantined. That is a defect in either the clause or the
artifact, and `--check` fails on it by name. It is empty today, and it was shown RED on a synthetic
graph first — the fixture had to be one the `from` walk genuinely cannot rescue, because a first
attempt used a fixture that the (correct) upstream exemption cleared, and a red arm a correct fix
turns green is testing the wrong thing.

Seven selftest arms added; `--selftest` is 233 passed, 0 failed.

## Defect 2 — the coincidence engine, closed by ROLE

`data/policy-weights.json` publishes 58 content digests as hex strings. The string walk in
`artifactNumbers` cut digit runs out of them, and the index rescales every entry by x100 and /100,
so each hash was three chances to collide.

The exclusion is derived from the characters, not from a list of field names: **a digit run glued to
a letter is part of a token, not a measurement.** It is the same rule `engine/quarantine.js` already
states about filenames — *"A SUBSTRING IS NOT A FILENAME… the character before the match must not
continue the name"* — and it generalises past hashes to release ids, `turn19`, `v2` and
`gen9championsvgc2026regmb` without naming any of them. A leading `.` counts as glue for the same
reason (in `v1.2.3` the regex has already taken `1.2`).

Cost, measured: **10,569 of 117,316 reachable numbers across `data/` (9.0%)**. Neither the citation
ratchet (54) nor the untraceable ratchet (34) gained a single offender, so no published figure in
this repository was tracing through a glued digit run.

### It unmasked four stale figures a git SHA had been covering for

Four living documents restate `data/protocol-events.json` as `emittedCount 38, notEmittedCount 56`.
The artifact reads **44 / 50**, and has since 2026-08-26 (confirmed against `git show HEAD:` as well
as the working tree). The `56` was passing the citation check on a collision with a digit run inside
`showdown_pinned_commit`. `docs/GAME-DIFFERENTIAL-DESIGN.md` also said the engine emits
`36 protocol event types` against an `emitted[]` of 44. All corrected.

`docs/SUMMARY.md` stated `58 features` in a table cell citing the withheld `data/policy-weights.json`
and the row already declares every figure in it withheld; 58 is nowhere in that artifact as a value,
only as the CARDINALITY of the hash map. Withheld rather than re-sourced. (Teaching
`artifactNumbers` to emit container cardinalities was considered and rejected — it would add every
array length in `data/` to the match space, which is the coincidence engine rebuilt.)

### A second false positive was masked by the first

`docs/DAMAGE-STAGES.md` says a result *"still stands from 02:49"*. The figure lexer read `49` as a
stated claim against `data/engine-diff.json`, an artifact that contains no 49 at any sign — it only
ever passed on a hash collision. A wall-clock time is the same class as the ISO date the lexer
already stripped, so `HH:MM(:SS)` is now stripped with the hour and minute **range-checked**, so a
ratio survives. Both directions are in `LEXING_CASES` (`a-wall-clock-time-is-not-a-figure`,
`a-ratio-is-not-a-clock`), which runs on every gate execution: 7/7.

## Defect 3 — the deck. FIXED, and the deck is clean.

**The hole was real and it is now sized.** `docs/ABRA-deck-plain-english.md` carries 753 figures
across 354 paragraphs and names an artifact in **14** of them. 96% of the document written for the
least technical reader was outside a rule keyed on citations.

**Dropping the citation requirement is not the fix, and that was measured before it was rejected.**
Scoring every distinctive figure against every withheld artifact gives the deck 40 hits and
`docs/ABRA-technical-docs.md` 70. `1,500` occurs in sixteen withheld artifacts and `6,000` in
twenty-three, because those are round run sizes that appear everywhere. That is the coincidence
engine of Defect 2 rebuilt one rule over.

**The evidence is uniqueness of attribution.** A figure is charged on the uncited route only when,
across every artifact in `data/`, exactly ONE contains it — so there is no other source it could
have come from — and that artifact is withheld. Two owners is a coincidence with a witness, not a
source. This is the same bar `untraceableCensus` uses one rule over.

**And the owner must be a PUBLISHED source** — an artifact some live document actually cites.
Without that clause the `_bench` and `_diag` scratch runs became the unique owner of ordinary
four-digit figures and accused six documents of republishing a bench number they had never heard of.
The scratch files stay in the denominator, where they make attribution stricter; they are not
allowed to be the accuser. **75 hits before that clause, 54 after, and all 21 removed were scratch
artifacts.**

**What it finds: 50 republications carrying no citation at all** — the MAG weights' per-click figure
in four documents, the leaf backtest's sample size in three, the censoring census, the feature
contrast, the exploitability step probe.

**`docs/ABRA-deck-plain-english.md` scores ZERO** under the rule that can now see it. That is a
result rather than a silence, and it is the opposite of what the earlier report predicted — the
withdrawal pass had already cleaned the deck.

## The ratchet, re-seeded, with the split stated

Seeded 104 on 2026-09-06. Of those:

```
67  FIXED by the withdrawal pass
18  THE CLASSIFIER WAS WRONG   (defect 1)
 7  THE FIGURE NEVER CAME FROM THAT ARTIFACT   (defect 2)
12  REAL
```

plus **40** newly visible on the uncited route = **52 seeded**.

A ratchet seeded on false positives protects nothing: 92 permitted keys were 92 places a genuine
republication could land and be waved through by a line that was already in the list.

## Gate state at hand-back

Green: `tests/test-docs-quarantine.js`, `tests/test-docs-current.js` (24/24),
`engine/quarantine.js --selftest` (233/0), `tests/test-no-silent-failure.js` (0 new),
`tests/test-closet-scope.js`, `tests/test-provenance-discovery.js`,
`tests/test-register-cell-parse.js`, `tests/test-web-figures.js`, `tests/test-web-quarantine.js`,
`tests/test-divergence-composition.js`.

**Two RED, both pre-existing and both WEB build products, neither caused by this pass:**

- `tests/test-web-quarantine-loaders.js` — the committed `web/quarantine-data.js` and the block
  stamped inside `web/stadium.html` withhold a different set from the builder. **Demonstrated: the
  identical two FAIL lines appear with `engine/quarantine.js` and `engine/docs_scan.js` stashed to
  HEAD.** The committed file carries 60 rows against a set that was 72 before this pass and is 63
  after, so it was already stale by 12. The documented fix is `node web/build-quarantine.js`, which
  was NOT run — `web/` is paused and is not this division's.
- `tests/test-web-status.js` — `data/status.js` was last written **2026-08-06**, a month stale, and
  the failing comparisons are census and interaction-matrix counts (`423` vs `829`, `1643` vs
  `1642`) against files this pass never touched. It is regenerated by `node engine/status.js
  --write`, which this pass was told not to run.

Neither is filed as a known failure: both are named here with the evidence that they are older than
this pass, and both are owed to WEB / to whoever next runs `status.js --write`.

`data/open-work.json` was rewritten as a side effect of running `node engine/open_work.js` to check
that the register copy still builds after `engine/quarantine.js` left the play layer. It did.

## What was deliberately not done

- **`node engine/status.js --write` was not run.** An ENGINE agent was live in
  `engine/medicham2-browser.js`, `engine/board_state.js`, `engine/game_differential.js` and
  `docs/ENGINE.md` throughout. Every division's generated block is one pass behind.
- **No differential, no release cut, no commit.**
- **`CHANGELOG.md` was not touched.** Four documents' figures moved (protocol-events 38/56 → 44/50,
  36 → 44 event types, and one withheld count), so a CHANGELOG entry and a version bump are owed by
  whoever publishes.
- **`data/docs-currency-baseline.json` was not raised.** The extractor fix briefly took citation
  mismatches 54 → 60; all six were resolved at the document rather than absorbed, per the precedent
  in that file's own header (#285: a discovery is not a regression, and the recorded counts were not
  raised to match).
