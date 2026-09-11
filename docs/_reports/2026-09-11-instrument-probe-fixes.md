# 2026-09-11 — Instrument-side fixes for the owed-instrument probes (MEASURE)

This is a historical record (see CLAUDE.md on `docs/_reports/`). It is not maintained and it is not current state.

**Scope:** the 16 RED rows in `docs/_reports/2026-09-11-owed-instruments.md`. I took only the rows whose fix lies wholly outside ENGINE's forbidden list for tonight.
**Played:** no games. **Cut:** no release. **Committed:** nothing. **Probes:** none of the 20 new `tests/probe_*.js` were edited.
**Reverts:** proved without moving the live tree:
- A scratch preload (reproduced at the end of this file) serves the HEAD bytes of a named file to both the compiler and `readFileSync`.
- The mutation-harness fixes carry knobs instead.

## Verdict

| Row | The fix lives in | Result | Probe: before → after → fix reverted |
|---|---|---|---|
| #323 | `tests/mutation_harness.js`, plus a regrade of `data/mutation-coverage.json` | **FIXED** | RED (33 of 36) → **GREEN** (0 of 36) → RED under `MUT_SIBLINGS_UNEXAMINED=1` |
| #325 | `tests/mutation_harness.js`, plus the same regrade | **FIXED** | RED (counter absent; 17 citations scored) → **GREEN** (`provenanceParamsSkipped` 17; 0 scored) → RED under `MUT_PROVENANCE_SCORED=1` |
| #349 | `engine/divergence_report.js` | **FIXED** | RED → **GREEN** → RED on HEAD bytes |
| #350 | `engine/quarantine.js` | **FIXED** | RED (both cells) → **GREEN** → RED (both cells) on HEAD bytes |
| #380 (2) | `engine/quarantine.js` | **FIXED** | cell RED → ok → RED on HEAD bytes |
| #380 (3) | new `engine/exit_codes.js`, adopted by `engine/register_reality.js` and `engine/wire_ladder.js` | **PART.** The `tests/run-all.js` adoption is owed to ENGINE, and the probe's regex is too narrow (see *Probe defects*). | RED → RED |
| #399 | `engine/divergence_cards.js` | **FIXED** | RED (both arms) → **GREEN** → RED (both arms) on HEAD bytes |
| #524 | `tests/probe_hazard_recap_fail.js`, `probe_protect_stage_order.js`, `probe_sound_lock_restart.js`, `probe_trap_timing.js` | **FIXED** | RED (7 sites in 4 files) → **GREEN** (0 sites; 23 converted in 12 files) → RED on HEAD bytes; `--plant` RED |
| #348 | nowhere in `tools/lownode.cmd` | **NOT FIXABLE IN THE WRAPPER.** The bytes are destroyed before cmd.exe starts (see below). | RED, unchanged |
| #318 | `tests/roster.js` | left for ENGINE (forbidden file) | — |
| #375 | `engine/game_differential.js` | left for ENGINE (forbidden file) | — |
| #412 | `engine/position_features.js:249` | left for ENGINE (see below) | — |
| #425 | `engine/all_mechanics_fire.js` | left for ENGINE (forbidden file) | — |
| #467 | `engine/game_differential.js` | left for ENGINE (forbidden file) | — |
| #511 | `engine/medicham2-browser.js` | left for ENGINE (forbidden file) | — |
| #529 | `engine/tag_dex.js` | left for ENGINE (forbidden file) | — |
| #535 | `engine/medicham2-browser.js` | left for ENGINE (forbidden file) | — |

## Per row

### #524: seven exit-zero COULD-NOT-STAGE paths
Each site now prints `ABRA-EXIT 2 CANNOT-ANSWER` and exits 2. The sites are:
- `probe_hazard_recap_fail.js:108`
- `probe_protect_stage_order.js:107`
- `probe_sound_lock_restart.js:106`, `:187` and `:196`
- `probe_trap_timing.js:115` and `:149`

Before any of the seven was touched, I checked the per-arm `if (!r.staged)` paths in those four files. None of them reaches exit 0: the unstaged arm pushes `NOT STAGED` into `bad` and the file exits 1. So the seven sites were the whole set.

In the first draft, a two-line comment pushed the exit beyond the scanner's four-line lookahead. Four sites then read as "neither a site nor converted", so the verdict was green but the census counted 19 instead of 23. I tightened the four sites, and the census now counts all 23.

### #380: one exit classifier
`engine/exit_codes.js` (new, 163 lines) exports:
- `classifyExit(status, text, {legacy})`: register_reality's classifier, moved with no change in behaviour. `register_reality --selftest` passes 84/84 through the thin wrapper that keeps its `RR_CANNOT_ANSWER_AS_RED` knob.
- `runnerOutcome(status, text)`: the same classification, plus a PASS/FAIL/SKIP policy for the "not a verdict" case, for a suite runner.
- `declaration(code, kind)`, `KIND` and `DECLARATION`.

`runnerOutcome` keeps run-all's current reading on exit 0, exit 1 and an undeclared exit 2. It also keeps an undeclared 134 (out of heap) as FAIL. It changes three cases, and in each case the two readers used to disagree:

| Case | run-all before | Now |
|---|---|---|
| `exit 2` + `ABRA-EXIT 2 VERDICT-RED` | SKIP | FAIL |
| `exit 0` + `ABRA-EXIT 0 CANNOT-ANSWER` | PASS | FAIL |
| `exit 4` + `ABRA-EXIT 4 CANNOT-ANSWER` | FAIL | SKIP |

The last row is register_reality's reading of the same exit. The module's `--selftest` passes 11/11, and it asserts that the runner never contradicts the classifier on a verdict for any exit code 0–5 under any declaration.

`engine/wire_ladder.js` now:
- declares its own exits through `EXIT.declaration`;
- classifies a failed child through `EXIT.classifyExit`, so the refusal says which kind of non-green it was.

Its accept rule is unchanged: only a green child becomes a rung. `game_differential.js` exits 1 on a VOID run after it has written the artifact, so a red child's artifact must never be used.

Half (2) is in `engine/quarantine.js` `openDefectClause`. An open row whose instrument was asked and answered nothing usable (`unrunnable`) now makes the clause `ok: false, cannot_answer: true`, unless a measured red is already present. A rejected marker or an unmarked row does not hold the clause, because nothing was run for either.

### #350: the marker debt and verdict staleness
- Each open row now carries `marked`, tested with `REGISTER_REALITY.marker`. That is the same regex `register_reality.js` now reads through `Q.REGISTER_REALITY.marker`, so the two files cannot come to recognise different rows.
- `registerEvidence` gains a sixth bucket, `unverified`: a row that names an instrument with no verdict yet. It gets its own sentence, and `debt` keeps only the rows that name nothing.
- The clause now dates `data/register-reality.json` against the mtime of `docs/ROADMAP.md`. It publishes `verdicts_stale` and a `STALE VERDICTS` line, and it prints rather than fails, so that the clause does not trip on every register edit (#148).
- `test-no-silent-failure` caught a new swallowed `statSync` catch in my first draft. It now prints `CANNOT DATE THE VERDICTS` instead.
- The selftest's six-bucket disjoint/total arm, and a new red arm for marked versus unmarked rows, pass: 240/0.

**Live clause after the change:** ok true, withRed 0, debt 35, unverified 0, unrunnable 0, verdicts not stale. **No gate state moved.**

### #349: the side of the ranking key
`engine/divergence_report.js` still ranks by the differential's `max_uses`, and recomputes nothing. Every worklist row now prints its key entity together with the line that named it: `[showdown]`, `[ours]`, `[both]` or `[unplaced]`. It also counts the causes keyed only by our line.

The side is read off the cause string. The differential writes that string as `<class> :: <showdown line> <> <medicham line>` (`engine/game_differential.js:5637`, `cause: cls + ' :: ' + ga + ' <> ' + gb`), and `ga` is Showdown's head. `--write` carries `key` and `keySide` on each row. On the real artifact today: 0 of 1 causes are keyed by our line only.

### #399: a stale card dump
By default, `engine/divergence_cards.js` now refuses with `ABRA-EXIT 2 CANNOT-ANSWER` when the dump's `engine_release` is not the differential's. It also refuses when either side names no release, or when the differential cannot be read. In each case it prints the re-dump command.

`--allow-stale` renders under a STALE banner that names both releases. `--differential <path>` overrides which artifact the dump is compared against.

**This bites today.** The dump is on `791c9fd873f3` and the differential on `13257c8bc397`. `node engine/divergence_cards.js` now exits 2 and writes no page. With `--allow-stale` it renders 80 cards under the banner.

### #323 and #325: the mutation harness, and a regrade that plays no game
**#323.** The class-A branch of `classify()` now examines the carrier's specific sibling tags. It uses the same >25%-of-kind exclusion, derived from the artifact.
- When a sibling is read by the simulator, the row names it and says the fact is UNDECIDED.
- "Nothing in the simulator implements this fact" is kept only where no sibling is read (3 rows).
- The class is unchanged. The evidence gains `siblingTagsRead`, `siblingTagsNotRead` and `siblingTagsGenericExcluded`.

**#325.** `paramOps` skips a `from`/`note`/`cite`/`via`/`what` param only when all three of these hold:
- its value is citation-shaped (`note` and `cite` always count);
- `paramReadSites` finds no dereference, because a param the engine reads is a fact;
- the pre-fix knob is not set.

Each skip is counted in `provenanceParamsSkipped`, per row and in the summary.

**`--regrade --release=<artifact's id>`** re-runs only the TRIAGE, with today's code, over the written artifact. It refuses on any of four conditions:
- the release differs;
- the calibration fails;
- its own recount of the artifact's operators disagrees with the artifact's summary (it did not disagree);
- any class moves.

On `6fb9ebd3b704` it skipped 17 provenance params, regraded 654 operators and rewrote 133 `defectWhy` strings; 0 classes moved. The knob `MUT_SIBLINGS_UNEXAMINED=1` rewrote 0 strings, which shows the pre-fix sentence is reproduced byte for byte.

**`data/mutation-coverage.json` was rewritten by that regrade.** The sweep itself (2026-08-22) and every LIVE / READ-AND-IGNORED verdict are unchanged. The artifact carries a `regraded` block with the harness digest `8bcd2d93641d`.

| Summary field | HEAD | Now |
|---|---:|---:|
| operators | 1,563 | 1,546 |
| LIVE | 565 | 565 |
| READ-AND-IGNORED | 998 | 981 |
| class A operators (rows) | 148 (36) | 146 (36) |
| class B | 190 | 182 |
| class C | 99 | 96 |
| class D | 230 | 230 |
| provenanceParamsSkipped | absent | 17 |

**The next full sweep will record a NEW SCOPE for the class-A ceiling.** The ceiling scope hashes the classifier source, which I edited. This is the harness's designed behaviour. The regrade leaves the ratchet exactly as the sweep wrote it, and says so.

`test-mutation-coverage.js` was not run, because its first half plays the planted-stub gate. I checked its artifact assertions statically: release present, ratchet not broken, 0 regressions, calibration 4 of 4 ok, `tagsSwept` 292.

### #348: why it is not fixed
- `bash -c 'cmd //c "echo [--why \"a vs b\"]"'` prints `[--why \"a vs b\"]`. The CRT-escaped `\"` reaches cmd.exe before any batch file runs.
- The wrapper cannot tell MSYS's `\"` from the `\"` libuv writes for a literal quote on ROUTE A. Rewriting it would break ROUTE A, which is green today.
- The path arm's conversion also happens in bash, before cmd.exe. In this session's Bash tool it did not fire at all (`[C:/Users/willj/x.json]` came through intact); the probe's node-spawned bash converted it. So that arm depends on the environment, not on the wrapper.
- ROUTE C (separate words) is green on all four arms.

**Recommendation:** re-scope the row to the calling convention. Document ROUTE C in the wrapper's USAGE and in CLAUDE.md's lownode section, and have the probe stop asking the wrapper to repair ROUTE B.

### #412: why it was left
The fix is one line in `engine/position_features.js`: resolve the defender through `effAbility`, as `board.js` does. I left it for four reasons:
1. That file is a frozen-release SOURCE and a feature FUNCTION. Changing it is a feature-function change and belongs with a release cut.
2. The probe refuses (CANNOT-ANSWER) unless the live file is byte-identical to the pinned release. It cannot go green without a new cut, and the release slot is ENGINE's tonight.
3. The probe also refuses if the `RUNTIME_ALLOWED` entry is deleted. The fix must therefore leave that entry in place until the probe is re-pointed.
4. Its exposure is zero, per the probe itself.

## Probe defects found (not edited)
- **#380 cell (3):** the regex `/require\([^)]*register_reality[^)]*\)/` hard-codes the old owner.
  - With the owed run-all diff applied (served through the preload), the cell stays RED.
  - Widened to `(register_reality|exit_codes)`, it matches.
  - ENGINE should widen it when registering the probe.
- **#349:** the probe prints its `cell: ... no side is printed beside the key` detail even when the check passes. This is cosmetic, but a green run shows a sentence that is false.
- **#348:** ROUTE B asks the wrapper to undo bytes that were destroyed before it ran.
- **#412:** the probe cannot read green after a fix without a re-cut, and it requires the allowlist entry it exists to retire.

## The owed `tests/run-all.js` adoption (ENGINE)
It was built with three replacements and parses (`node --check`):

```diff
 'use strict';
+const EXIT = require('../engine/exit_codes.js');   /* one exit classifier — ROADMAP #380 (3): classifyExit + runnerOutcome */
@@
-  if (r.status === 0) {
+  const EXO = EXIT.runnerOutcome(r.status, (r.stdout || '') + '\n' + (r.stderr || ''));
+  if (EXO.outcome === 'PASS') {
@@
-  else if (r.status === 2) {
+  else if (EXO.outcome === 'SKIP') {
```

## Side effects
- `data/mutation-coverage.json` was rewritten by `--regrade`. No game was played.
- `data/job-costs.jsonl` gained 3 lines, from the harness's `job_cost.track` on each of the three regrade loads. They are real cost records, and I left them.
- `engine/exit_codes.js` is new and untracked.
- Nothing in the forbidden list was touched.
- None of my files is in `game_differential.js`'s driver closure (checked with `requireClosure`), so an ENGINE ladder cannot see my edits as instrument drift.
- I did **not** run `status.js --write`, because it stamps `docs/ENGINE.md`.

## Verification
- `node tests/test-docs-current.js`: 37 passed, 0 failed.
- `node tests/test-no-silent-failure.js --in <the 11 changed files>`: 0 found.
- `node engine/quarantine.js --selftest`: 240/0.
- `node engine/register_reality.js --selftest`: 84/0.
- `node engine/exit_codes.js --selftest`: 11/0.
- `node engine/register_reality.js --list`: listed 155 marked rows. The artifact's mtime was unchanged.

## For the applier

### Notes-row text

```text
## [<version>] — 2026-09-11 — the owed probes, instrument half: seven rows green on measurement, #380 owes its run-all line
- **What changed.** Instrument fixes only; engine untouched, no game played. #524: the seven exit-zero COULD-NOT-STAGE paths in four probes now declare `ABRA-EXIT 2 CANNOT-ANSWER`. #380: `engine/exit_codes.js` is the one exit classifier (moved from register_reality.js, behaviour unchanged, plus `runnerOutcome` for suite runners); register_reality.js and wire_ladder.js read through it; an open row whose instrument answered nothing now holds the open-defect clause as CANNOT-ANSWER. #350: the clause splits rows that NAME an instrument with no verdict (`unverified`) from rows that name none (`debt`), and dates its verdicts against docs/ROADMAP.md. #349: the divergence worklist names which line its ranking key came from. #399: the card renderer refuses a dump from another release (`--allow-stale` to override). #323/#325: the mutation harness examines sibling tags before saying "nothing implements this fact", skips and counts provenance params, and gains `--regrade`, which re-runs the triage over a written sweep without playing. Detail: `docs/_reports/2026-09-11-instrument-probe-fixes.md`.
- **Measured.** Probes RED -> GREEN -> RED-on-revert: #323, #325, #349, #350, #380 (2), #399, #524. #380 (3) stays RED until tests/run-all.js adopts the module and the probe's regex accepts it. data/mutation-coverage.json regraded on release 6fb9ebd3b704 (sweep of 2026-08-22, verdicts untouched): 17 provenance params skipped, 133 defectWhy strings rewritten, 0 classes moved.
- **Supersedes.** Nothing published in a living document. data/mutation-coverage.json's summary moved: operators 1,563 -> 1,546, READ-AND-IGNORED 998 -> 981, class A operators 148 -> 146 (rows 36 unchanged), class B 190 -> 182, class C 99 -> 96.
- **Basis.** unchanged.
- **Owed to the next major.** none.
```

### ROADMAP status cells

```text
#323  closed 2026-09-11 — the class-A sentence now names read sibling tags as UNDECIDED (tests/mutation_harness.js); data/mutation-coverage.json regraded, 0 classes moved. VERIFIED BY: `node tests/probe_mutation_classA_sibling.js`
#325  closed 2026-09-11 — provenance params skipped and counted (provenanceParamsSkipped 17 on 6fb9ebd3b704). VERIFIED BY: `node tests/probe_mutation_provenance_params.js`
#349  closed 2026-09-11 — the worklist prints the ranking key's side ([showdown]/[ours]/[both]/[unplaced]). VERIFIED BY: `node tests/probe_divergence_rank_side.js`
#350  closed 2026-09-11 — `unverified` split from `debt`; STALE VERDICTS dated against docs/ROADMAP.md. VERIFIED BY: `node tests/probe_open_defect_marker_debt.js`
#380  open — (2) fixed 2026-09-11 (refusal holds the clause as CANNOT-ANSWER); (3) engine/exit_codes.js built and adopted by register_reality.js and wire_ladder.js; tests/run-all.js adoption OWED (diff in docs/_reports/2026-09-11-instrument-probe-fixes.md) and the probe's regex must accept exit_codes. VERIFIED BY: `node tests/probe_open_defect_refusal_holds.js`
#399  closed 2026-09-11 — the renderer refuses a dump from another release; --allow-stale renders under a banner. VERIFIED BY: `node tests/probe_divergence_cards_stale.js`
#524  closed 2026-09-11 — 0 exit-zero refusal sites (23 converted in 12 files). VERIFIED BY: `node tests/probe_couldnotstage_exit_zero.js`
#348  open — NOT fixable in tools/lownode.cmd: the Git Bash one-string route mangles `\"` and drive paths before cmd.exe starts. Re-scope to the calling convention (separate words, ROUTE C, green on every arm) and drop ROUTE B from the probe.
```

## OWED, NOT RUN

ENGINE adopts the shared classifier in `tests/run-all.js` (the diff above), and widens the #380 probe's regex to `(register_reality|exit_codes)`. Then:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/exit_codes.js --selftest
node tests/probe_open_defect_refusal_holds.js
node tests/run-all.js --list
```

The full mutation-coverage test. Its first half plays the planted-stub gate (about 65 s of staged battles):
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
cmd //c "tools\\lownode.cmd tests\\test-mutation-coverage.js"
```

The next full mutation sweep. It plays games, and it will record a NEW SCOPE for the class-A ceiling:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
cmd //c "tools\\lownode.cmd tests\\mutation_harness.js"
node tests/probe_mutation_classA_sibling.js
node tests/probe_mutation_provenance_params.js
```

After ENGINE lands, run the register pass and the generated-block stamp. I did not run the stamp, because `status.js --write` writes `docs/ENGINE.md`:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/register_reality.js
node engine/open_work.js
node engine/status.js --write
```

The card page. It stays refused until the dump is retaken on the differential's release. This plays games, so it belongs to whoever holds the slot; take `--games` from the pinned run's recorded flags:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node engine/game_differential.js --release <id> --games <n> --team-store data/team-pool-frozen --dump-games 60 --dump-out data/divergence-turns.json --write
node engine/divergence_cards.js
```

#412, once ENGINE moves `position_features.js` onto `effAbility` and cuts a release:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
node tests/probe_priority_bar_effective_ability.js --release <REL>
```

The `wire_ladder.js` catch change was syntax-checked only. The next real ladder run exercises it, and that run plays games.

To reproduce the revert demonstrations, save the preload below as `sub.js`, then run for example:
```bash
cd /c/Users/willj/Projects/Pokemon/ABRA
git show HEAD:engine/divergence_cards.js > /tmp/divergence_cards.js
ABRA_SUB_MAP='{"divergence_cards.js":"/tmp/divergence_cards.js"}' NODE_OPTIONS="--require $PWD/sub.js" node tests/probe_divergence_cards_stale.js
MUT_SIBLINGS_UNEXAMINED=1 node tests/mutation_harness.js --regrade --release=6fb9ebd3b704 --regrade-out=/tmp/mc_knob.json && node tests/probe_mutation_classA_sibling.js --artifact /tmp/mc_knob.json
```

```js
/* sub.js — serve HEAD bytes for the basenames in ABRA_SUB_MAP, to the compiler and to readFileSync */
const M = require('module'), fs = require('fs'), path = require('path');
const map = JSON.parse(process.env.ABRA_SUB_MAP || '{}');
const realRead = fs.readFileSync;
fs.readFileSync = function (p, ...rest) { const alt = (typeof p === 'string') ? map[path.basename(p)] : null; return realRead.call(fs, alt || p, ...rest); };
const orig = M.prototype._compile;
M.prototype._compile = function (content, filename) { const alt = map[path.basename(filename)]; if (alt) content = realRead.call(fs, alt, 'utf8'); return orig.call(this, content, filename); };
```
