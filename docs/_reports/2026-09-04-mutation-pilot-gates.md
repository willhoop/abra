# Mutation testing, piloted against the gates — 2026-09-04 (MEASURE)

Historical findings record. Not current state, not maintained, superseded by whatever register rows
it feeds. Every figure below was measured on this machine on this date and the command is given.

## 1. How gates are actually invoked — confirmed, not assumed

`tests/run-all.js` builds one list (`testFiles` discovered by glob + a `GATES` array) and runs every
member through `spawnSync(process.execPath, [...node, D(rel), ...EXTRA[rel]])`, then classifies purely
on `r.status`:

- `0` → pass
- `2` → **SKIP**, not a failure ("I could not run", the `validate_selfplay.js` precedent)
- anything else → FAIL, with the last 14 lines of output kept

There is no test framework anywhere in the loop. `engine/quarantine.js` is invoked as
`node engine/quarantine.js --check` (the argument comes from the `EXTRA` table, and the runner prints
it under `--list` so the binding can be seen to have fired). `--check` itself begins by
`execFileSync`-ing `node <self> --selftest` and refuses to be believed if that is red
(`engine/quarantine.js:4429`).

**So Stryker's `command` runner consumes this directly. No migration of any kind is needed.** That was
verified rather than assumed: two hand-written mutants were injected into a scratch copy and both were
detected, at 16 KB of output each rather than a silent exit.

| hand mutant | result |
|---|---|
| `engine/quarantine.js:1083` `return true` → `return false` | exit 1, `157 passed, 2 failed` |
| `engine/quarantine.js:3147` `? 2 : 1` → `? 0 : 1` (clauseExit) | exit 1, `155 passed, 4 failed` |
| restored | exit 0, `159 passed, 0 failed` |

## 2. What was installed

`@stryker-mutator/core@10.0.0`, pinned exact (no caret), declared in `package.json` under
`devDependencies`. The repo has a bare `package.json` with one runtime dependency and no lockfile
beyond `node_modules/.package-lock.json`; nothing was restructured.

**`npm install` was NOT run against the repository, and that is deliberate.** `tests/run-all.js`
(pid 10972) was live for the whole of this session, and it runs `engine/validate_damage.js`, which
requires `@smogon/calc` out of `node_modules`. Reifying the dependency tree underneath a running suite
is the "nothing in frame may move" rule broken for the sake of a convenience. The pilot ran against an
install in the session scratchpad instead, reached with `--stryker <dir>` / `ABRA_STRYKER_HOME`. The
repo install is OWED and is one command.

## 3. Scope, and why this scope

Two new files, both new, nothing edited except `package.json`:

- `stryker.gates.conf.json` — settings only.
- `tools/mutate-gates.js` — the runner shim.

**The shim exists because three obvious things are dangerous here.**

1. **Stryker sandboxes the project directory. `data/` is 26 GB.** A run from the repo root would copy
   it. The shim builds an isolated tree instead: the transitive `require('./x.js')` closure of
   `engine/quarantine.js` (4 JS files), plus every `D('data', ...)` and `D('docs', ...)` path the
   sources actually name (11 artifacts + `docs/ROADMAP.md`), derived by regex at run time rather than
   typed. 35 files, ~4.5 MB.

2. **`quarantine.js --selftest` writes `data/decision-impact.json`, `unlink`s it, and restores it in a
   `finally` (~lines 3745-3800).** That is correct for one hand-run. Under mutation it runs 83+ times
   and a hanging mutant is killed by timeout — mid-block, after the unlink, before the finally.
   `data/decision-impact.json` is untracked, so that is unrecoverable. **This is the artifact hazard
   the brief asked about, it is real, and it is why the run is isolated.** Confirmed after the pilot:
   `data/decision-impact.json` is still absent and no `data/` file was modified by this work.

3. **A typed line range goes stale silently and in the flattering direction.** A `file.js:1080-1117`
   that has slid off its function mutates comment text and comes back at 100%. The shim derives each
   range from the function NAME (`^function NAME(` to the next column-0 `}`) and **exits 2** if a name
   does not resolve, rather than falling back to whole-file.

**The faithfulness check is the load-bearing part.** The shim runs `--selftest` in the real repo and in
the isolated tree and refuses to start Stryker unless the verdict LINE and the exit code match, and it
checks output size as well as exit code. Both trees: `QUARANTINE SELFTEST: 159 passed, 0 failed`,
exit 0. A support file missed by the derivation shows up there as a changed count, not as a clean score.

Target: the five smallest functions in `quarantine.js` whose output is a **verdict** rather than a
report — the closed-detector (`roadmapRowIsClosed`, `roadmapRowStatusCell`, `notADefectSuppresses`,
`roadmapRowSaysBroken`) and the exit-code map (`clauseExit`). 68 lines, 83 mutants. The closed-detector
is exported to `engine/open_work.js` so the gate and the work list cannot disagree; `clauseExit` is the
0/1/2 that `engine/register_reality.js` reads to decide whether a register row is closed.

## 4. THE HARNESS ITSELF WAS UNSTABLE, AND IN THE FLATTERING DIRECTION

This has to come before the score, because it invalidates the first number this pilot produced.

At `concurrency: 2`, four runs of the **same 83 mutants** gave **77.11%, 75.90%, 68.67%, 73.49%**, and
the survivor SET moved, not just the wall clock. Three of those runs were against one **pinned** tree
with byte-identical inputs, so it is not the store moving underneath. The unmutated selftest is
deterministic: 15 runs, 15 × `159 passed, 0 failed`.

At `concurrency: 1`, three consecutive runs on the pinned tree are **identical**: 68.67%, 57 killed,
26 survived, same 26 survivors by line and column.

The mutants that flipped are lines **1083, 1100, 1116** — the load-bearing ones. And the direction is
the bad one: **parallel runs report mutants as KILLED that in fact survive**, i.e. they report the
checkers as better checked than they are. That is the exact failure class this exercise was brought in
to find, arriving inside the tool brought in to find it. `concurrency: 1` is set in the config with
that measurement written beside it.

**Every number below is the concurrency-1 number.**

## 5. The score

```
node tools/mutate-gates.js --stryker <install> --tree <pinned tree>
```

| function | mutants | killed | survived | score |
|---|---|---|---|---|
| `roadmapRowIsClosed` (1080-1117) | 26 | 15 | **11** | 57.7% |
| `roadmapRowStatusCell` (1176-1179) | 9 | 5 | **4** | 55.6% |
| `notADefectSuppresses` (1207-1211) | 6 | 4 | **2** | 66.7% |
| `roadmapRowSaysBroken` (1212-1227) | 31 | 22 | **9** | 71.0% |
| `clauseExit` (3144-3148) | 11 | 11 | 0 | **100.0%** |
| **all** | **83** | **57** | **26** | **68.67%** |

0 timeouts, 0 errors, 0 uncovered. `clauseExit` is fully covered — its selftest is doing real work.

## 6. THE SURVIVORS, RANKED BY WHAT THEY DO TO THE REAL REGISTER

A survivor is a line the gate executes and nothing checks. That is a claim about the test, not yet a
claim about consequence, so each survivor was applied to a copy of the shipping function and run over
all **498 rows of `docs/ROADMAP.md`** (base: 246 closed, 129 saysBroken), counting how many real
verdicts move. **11 of the 26 move nothing** — they live in the `NOT_A_DEFECT` receipt, which the file
itself documents as display rather than verdict. The rest are below.

### 6.1 `roadmapRowIsClosed` can be replaced with `return true` and all 159 assertions still pass

Line 1116, `ConditionalExpression` → `true`. The prose fallback

```js
return /—\s*DONE|DONE,|RETRACTED|GUARDED,/.test(head) || /closed 20\d\d/i.test(head);
```

becomes unconditional, so **every row that reaches the fallback is CLOSED**. Measured: **98 of the 498
register rows flip open → closed.** Verified by hand outside Stryker — patch the line, run the gate:

```
QUARANTINE SELFTEST: 159 passed, 0 failed          exit 0
```

`openDefectClause` would see those 98 rows vanish, and `engine/open_work.js` shares this detector, so
the work list would lose them too. This is the gate's own version of `8 of 8 PASS` being false.

### 6.2 The date token is unchecked in both directions — 33 rows

Line 1116, `/closed 20\d\d/i` → `/closed 20\D\d/i` or `/closed 20\d\D/i`. **33 rows flip closed →
open** (#170, #321, #448, #466, #474, #481-#526). This is the token the file's own comment says was the
expensive bug — "#220 said CLOSED in its own first line, read as OPEN … it was inflating the MEDICHAM
gate with a defect that had been fixed the day before". The repair is there; nothing asserts it.

### 6.3 The 600-character head window is tested in one of the two functions that share it — 21 rows

Line 1101, `const head = l.slice(0, 600)` → `l`. **21 rows flip open → closed** (#167, #172, #196,
#204, #254, #255, #256, #259, #279, #282, #293, #294, #299, #302, #303, #304, #308, #465, #513, #514,
#531).

The code comment at line 1223 says it outright: *"THE HEAD, NOT THE ROW — see REPAIR 1 above. The 600
is `roadmapRowIsClosed`'s number, deliberately the same one: two detectors reading the same table must
not disagree."* The selftest asserts the window in `roadmapRowSaysBroken` (#266, killed) and **not** in
`roadmapRowIsClosed` (survived). One fact, two readers, one of them tested — the FACTS-ARE-GLOBAL rule
broken in the test coverage rather than in the code.

### 6.4 The `$` anchor on the closed-cell clause — 6 rows, all engine-defect rows

Line 1083, the trailing `$` deleted from
`/\|\s*(closed|done|page closed)\b[^|]*\|\s*$/i`. Without it, a `CLOSED 2026-08-11` sitting in a
**middle** narrative cell closes the row. **6 rows flip open → closed**: #167 (Sitrus Berry threshold),
#172 (Heat Wave hits your own partner), #196, #282, #293, #294 (the spread-accuracy roll — the defect
CLAUDE.md calls the largest real one in the engine). Each of those six carries a middle cell literally
beginning `| CLOSED 2026-08-1x — …`.

### 6.5 A test arm that cannot fail when the thing it names is deleted

Line 1100, the `^` deleted from `/^\s*\(?open\b/i`. **1 row flips** (#474, closed → open). What matters
is why it survived. The selftest carries this, at line 3468:

```js
ok('RED - `open` must be the START of the cell, not a word buried in it: a closed row that '
  + 'mentions an open question is still closed',
  roadmapRowIsClosed(row(92, 'A THING - DONE.** x', 'closed; one open question remains')) === true);
```

The fixture's cell is `closed; one open question remains`. That cell matches the clause at **line
1083**, which returns `true` before line 1100 is ever reached. Proven:

```
1083 (closed-cell, returns TRUE first) matches : true
1100 (open-cell anchor) would have said        : false
1100 WITHOUT the ^ anchor would have said      : true
```

**The assertion named after the anchor cannot fail when the anchor is removed.** It is a real arm, it
reads as coverage, and it tests the clause above the one it names. Nothing but mutation was going to
find that.

### 6.6 Whitespace tolerance is load-bearing on a real row — 1 row

Line 1083, `\s*` → `\s`. **#241 flips closed → open**, because its cell is written `|closed 2026-08-25`
with no space after the pipe. The register is a hand-written markdown table; its parser's tolerance is
exercised by exactly one row today and asserted by nothing.

### 6.7 The 11 that move nothing

`roadmapRowStatusCell`'s whitespace variants and its `''` fallback, `notADefectSuppresses`'s strip and
window, and the whole `NOT_A_DEFECT` receipt block (1215-1217: the row-number extraction, the `[, '?']`
fallback, the dedupe guard, the 90-character truncation). Every one is real uncovered code and none of
them moves a verdict on today's register. They are worth naming and not worth a test each — the file's
own header already rates the receipt a display correction.

## 7. Cost, and whether this is viable

| | |
|---|---|
| Stryker phase, 83 mutants, concurrency 1 | 12-27 s (25 s on the final run) |
| End-to-end on a reused tree | **27.8 s** |
| End-to-end on a fresh tree | 19 s - 118 s, dominated by machine load, not by Stryker |
| Unmutated `--selftest` | 0.29 s warm, 2.6 s cold |
| Install | ~17 s, 165 packages |

**Verdict: viable to run routinely, and it should be.** At 68 lines and 28 seconds this is cheaper than
several checks already in `tests/run-all.js`. The honest caveats:

- **It does not belong in `run-all.js` as it stands**, for the reason `generated_audit.js` needs
  `--no-rebuild`: the suite must not have a child rewriting artifacts, and mutation runs the gate
  hundreds of times. The shim's isolation answers that, but the suite would then be spawning Stryker,
  which spawns sandboxes. Run it on demand, or on a pre-push hook for `engine/quarantine.js`.
- **It scales with the target, not with the repo.** 68 lines → 83 mutants → 28 s. The whole clause
  layer of `quarantine.js` (~2,900 lines) would be roughly 40x that, i.e. 15-20 minutes — still
  affordable on demand, not affordable per commit.
- **Do not raise `concurrency` without re-measuring stability.** §4.
- **The tree must be pinned to compare two scores.** The support set includes
  `data/game-differential.json` and `data/mechanics-census.json`, which OPS and ENGINE rewrite while
  this runs. `--tree <dir>` reuses a tree; without it, two runs an hour apart are two samples, exactly
  as the team pool is.

**The pilot is not a negative result.** 83 mutants on 68 lines found one mutant that closes 98 register
rows with a green suite, one shared fact tested in one of its two readers, and one assertion that
cannot fail when the thing named in its own message is deleted. All three are the classes this
repository already has a written record of paying for, and none of them was going to be found by
reading.

## 8. What was NOT done

- `node engine/status.js --write` was **not** run: this brief forbids editing anything under `docs/`
  except this file, and `--write` restamps the generated blocks in the division ledgers.
- Nothing was committed.
- No `data/` file was written; `data/decision-impact.json` remains absent, as it was at the start.
- Debris left deliberately, not deleted: the isolated trees under
  `C:\Users\willj\AppData\Local\Temp\abra-mutate-*` and the scratchpad probes. They are mine and they
  are outside the repo; they are named here rather than removed.

---

# OWED

1. **`npm install` in the repository.** `package.json` declares `@stryker-mutator/core@10.0.0`;
   `node_modules` does not have it, because `tests/run-all.js` was live. One command once the suite is
   idle. Until then `tools/mutate-gates.js` needs `--stryker <dir>` and says so.
2. **Line 1116 of `engine/quarantine.js` — the prose fallback — has no assertion that it can return
   false.** 98 register rows, a green suite. This is the one to fix first, and it belongs to whoever
   owns the closed-detector.
3. **The 600-character head window needs an assertion in `roadmapRowIsClosed`**, not only in
   `roadmapRowSaysBroken`. One fact, two readers, one test.
4. **The selftest arm at `engine/quarantine.js:3468` needs a fixture that reaches line 1100.** Its cell
   must not also satisfy the closed-cell clause at 1083 — e.g. a status cell of
   `still open on the switch-in journal` rather than `closed; one open question remains`.
5. **`data/decision-impact.json`'s write/unlink inside `--selftest` is a standing hazard** for anything
   that runs the gate repeatedly or under a kill-timer. It is correct for one hand-run and unsafe for a
   loop. Not fixed here; MEASURE is not editing the file it is measuring.
6. **A stability re-measurement is owed before `concurrency` is raised**, by anyone tempted.
7. **Widen the target set once the above land** — `differentialClause`, `rosterStage`,
   `orderProbeClause` and `wholeGameClause` are the next verdict functions, and `--targets` already
   takes them by name.
