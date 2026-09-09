# 2026-09-09 — five checks died of heap after the store recovery; declared, not tuned

Dated record. Not maintained; superseded by the register rows and the RUNNING-NOTES row it feeds.
Division: MEASURE.

## What happened

The store recovery (`docs/_reports/2026-09-09-fix-store-recovery.md`) grew `data/games.bo3.jsonl` from
25,522 to 32,801 rows (298 MB). Every script that reads a store whole at node's default old space now
dies with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap
out of memory`, exit 134. The clean `tests/run-all.js` pass reported five as `OUT OF HEAP, and no
ABRA-HEAP is declared`.

The mechanism already existed: a script declares `ABRA-HEAP: <MB>` in its own header, and
`tools/lownode.cmd` (`findstr`, line 60), `tests/run-all.js` (`spec()`, line 710) and
`.githooks/pre-commit` (line 316) each derive `--max-old-space-size` from that line. Nothing here is
new machinery; four scripts now carry the declaration and two bare-`node` spawns honour it.

## The five, measured

Every run below is `cmd //c "tools\lownode.cmd <script>"` from Git Bash, one process at a time, on the
working tree at commit `bf4ff432` plus the session's uncommitted edits. Outputs are in the session
scratchpad as `before-<name>.txt` / `after-<name>.txt`.

| script | exit before | FATAL before | exit after | FATAL after | verdict before → after | wall after |
|---|---|---|---|---|---|---|
| `tests/test-medicham-coverage.js` | 134 | yes (own process) | **0** | none | *(none — died in `<--- Last few GCs --->`)* → `COVERAGE RATCHET HELD — nothing went backwards against data/medicham-coverage.json` | 13 s |
| `tests/test-quality.js` | 134 | yes (own process) | **1** | none | *(none — died after `== behavioural bot detection ==`)* → `QUALITY FILTER TESTS: 31 passed, 1 failed` | 27 s |
| `tests/test-site-data-fresh.js` | 1 | yes — **in the child** | **1** | none | `SITE DATA FRESHNESS: 6 passed, 1 failed` → `SITE DATA FRESHNESS: 5 passed, 2 failed` (see below) | 82 s |
| `engine/selftest.js` | 134 | yes (own process) | **1** | none | *(none — died after `set generation`)* → `24 passed, 1 failed` | 38 s |
| `engine/provenance.js` | 134 | yes (own process) | **0** | none | *(none)* → `182 UNSAFE, 2 VOID (declared), 35 possibly stale, 36 ok, 0 missing` | 79 s |

The claim is **"no longer dies of heap"**, not "green". The three exit-1s are each check's own red:

- `test-quality.js`: `FAIL clean share is stable: 34.7% now vs 28.0% recorded (drift 6.8 pts,
  tolerance 3). Store has grown 67384 -> 92379.` — a drift clause reacting to the recovered store. Red
  before the recovery too; not touched.
- `selftest.js`: `FAIL every raw reader of the ladder store declares why -- 16 file(s) read the ladder
  store with neither a clean filter nor a RAW-STORE-OK declaration`. Red before the recovery too; not
  touched.
- `test-site-data-fresh.js`: its bundle-staleness clause (`data/abra-meta.js` 33.9 d, etc.) was red
  before and is red after. The **new** red is `FAIL every artifact the site's verdicts derive from is
  current -- 4 behind the corpus, worst data/chomp-ev.json: UNSAFE — older than the quality filter`.
  That clause reads `provText`, the captured stdout of its `provenance.js` child. Before this fix the
  child died and `provText` was empty, so the clause **passed vacuously**. It is now failing on its
  merits. This is the honest verdict appearing, not a regression, and it is the same shape as the
  `status.js --write` half below: a dead child read as silence, and silence read as clean.

### Why `test-site-data-fresh.js` carries no declaration

It exits 1, not 134, and prints its own summary line both before and after: **its process never ran
out of heap.** The FATAL in its stderr was written by its `execFileSync(process.execPath,
['engine/provenance.js'])` child (line 210), spawned with no flag, so the child died at the default
heap and its stderr was inherited. `run-all.js` classifies OUT OF HEAP from the combined output, so it
attributed the child's death to the test. A `ABRA-HEAP: 4096` line on the test would have been a
declaration the evidence does not support and would have left the child dying anyway. The fix is at
the spawn: it now reads `provenance.js`'s own declaration and passes `--max-old-space-size=<MB>`
**before** the script path (after it, node treats the flag as argv and it does nothing).

## `engine/status.js` — the worse half, fixed the same way

`status.js` line 219 spawned `provenance.js` bare, identically. The child died with no stdout;
`status.js` caught it, recorded "provenance did not speak", and `--write` restamped every ledger with
`provenance: NOT DERIVED` and exited 0 — a status tool reporting nothing wrong about a tool that had
crashed. The spawn now derives the child's `ABRA-HEAP` line with the same regex `run-all.js` uses and
passes the flag first. `fs` was already in scope at line 33.

Proof: `cmd //c "tools\lownode.cmd engine/status.js --write"` — exit 0, 64 s, 837 lines, zero FATAL
lines, and the diagnostics block reads `provenance: 182 unsafe, 2 void (declared), 35 possibly stale,
36 ok, 0 missing`. No ledger under `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md` contains
`provenance: NOT DERIVED` after the write.

## Edits, in full

- `tests/test-medicham-coverage.js`, `tests/test-quality.js`, `engine/selftest.js`,
  `engine/provenance.js` — a bare ` * ABRA-HEAP: 4096` header line, reason on the lines below it (bare
  because lownode's `for /f ... call :setheap %%h` receives the rest of the line as arguments, and the
  wrapper's own comment warns that a paren or comma there is where cmd's parser chokes). 4096 is what
  the record-keeping agent proved for `provenance.js`; **nothing was tuned** and no smaller value was
  tried.
- `tests/test-site-data-fresh.js` line ~210 and `engine/status.js` line ~219 — the two spawns above.
- No assertion changed in any file.
- `docs/ROADMAP.md` #551 (board-parted void games; ENGINE) and #552 (`test-docs-current.js` blind to
  a wrong headline; MEASURE), after #550, three cells, `VERIFIED BY: nothing yet` stated on both.
  `tests/test-roadmap-register.js` 3/0.
- `docs/RUNNING-NOTES.md` one row under `[5.275.0]`, newest-first; `**Basis.** unchanged`,
  `**Supersedes.** Nothing.`
- `CHANGELOG.md` one bullet under the existing `## [5.275.0]` `### Fixed`.
- `node tests/test-docs-current.js` — 33 passed, 0 failed, run before and again after the
  `status.js --write` restamp.

## Facts verified for the two register rows, not copied from the brief

- `data/game-differential.json`: `release b730e44f3314`; `state.games` 958; `state.games_board_never_diverged`
  958; `mid_void.void_games` 3; `mid_void.by_reason` `{"shared-addresses-agree":958,"low-identity":3}`;
  `mid_void.void_game_tags[]` = `omit-protect` (protocol 4, board 4), `omit-spread` (protocol 5, board 6),
  `omit-spread` (protocol 3, board 3), all `why: low-identity`. Read with `node -e` on the file at rest.
- `engine/docs_scan.js`: `function artifactHas(nums, f)` is at line 496; `const QUALIFIED = /retract|…|prior|former|prev…/`
  is at line 626. Read with `sed -n`.

## OWED, NOT RUN

- **`tests/run-all.js` was NOT re-run** (about ten minutes). The five per-script results above are the
  evidence; the suite-level OUT OF HEAP lines are expected to clear, and the five will appear as
  0 / 1 / 1 / 1 / 0 under the suite's own accounting. The coordinator has said it will not re-run it
  either, so the suite's post-fix state is **unmeasured**.
- Nothing that plays a game was run.
- `test-site-data-fresh.js` 5/2: the newly-visible "artifacts current" red is real and is provenance's
  (chomp-ev.json UNSAFE); it belongs to the re-run list, not to this fix.
- #551 per-game attribution (engine vs instrument) — owed to ENGINE; until it lands, BOARD-MATERIAL
  0 of 958 on `b730e44f3314` is a count after the counterexamples left the denominator and should be
  read as such.
- #552 fix to `docs_scan.js` — owed to MEASURE; the 27 → 41 mutation must be shown RED before the
  untraceable-figures clause is trusted again.
