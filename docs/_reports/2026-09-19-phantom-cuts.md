# The phantom cuts on `d92bdfb50d88`. 2026-09-19, MEASURE

**Verdict.** The writer was a `node -e` load of `tests/roster.js`, run twice, followed by three bare loads of
the driver. None of these was a measurement. Two driver defects turned those loads into release cuts:

- an argv offset under `node -e`;
- no memory of an earlier cut when the driver was re-loaded.

Both are fixed, and a child process now inherits the pin. **Nothing was corrupted.** The release bytes, the
id, the first freeze and every artifact pin are unchanged. Only a counter that no gate reads moved.

## 1. The record

The cut log is `data/releases/d92bdfb50d88/cuts.jsonl`. It holds 206 events: the first freeze
(16:04:45.355Z, "merged 6.63.0 …") and 205 more. All 205 read `game differential mode A — the comparison
driver, ROADMAP #68 step two`. That string is written only by `engine/game_differential.js:422`, in the old
code. The events carry no caller field, only `at`, `why` and `showdown_commit`. So attribution came from
timing:

| burst | events | from | to | spacing |
|---|---|---|---|---|
| 1 | **101** | 16:24:36.685Z | 16:24:53.894Z | 155 to 207 ms |
| 2 | **101** | 16:25:01.490Z | 16:25:20.333Z | 169 to 232 ms |
| 3 | 1 | 16:25:33.520Z | | |
| 4 | 1 | 16:25:47.571Z | | |
| 5 | 1 | 16:26:19.329Z | | |

A spacing of about 170 ms is a loop inside one process. An in-process cut of this tree measured 84 to 85 ms
warm. The rest of each step is the driver re-loading. It cannot be a series of separate processes, because a
fresh process takes about 6.4 s to load the driver.

**No artifact in the repository was written between 16:22 and 16:28Z** except `data/engine-release.json`,
at 16:26:19.5. The file scan excluded `.git`, `node_modules` and `data/releases`. So the writer produced no
artifact. It was an inspection command, not a run.

The re-measure session's scratchpad holds `req.js`. It was saved at **16:25:33.276Z**, **244 ms before
burst 3**. It requires `engine/game_differential.js` with no pin, then `tests/roster.js`, then
`engine/legal_scope.js`. So bursts 3 to 5 match that script. It was not executed here: rule, not mine. Its
load pattern was copied into my own file and measured, and it gives exactly **1 cut**. The three lattices,
the staged-game battery and the three roster stages all passed `--release`, as the re-measure report said.
That report was right about its runs and did not look at its ad-hoc commands.

## 2. The reproduction: one light command

A preload written this session wraps `cut` and `open`, sends every cut to a throwaway store, counts it and
records the stack. No game is played.

```
node -r <scratch>/pc/cutcount.js -e "const R=require('./tests/roster.js')"
```

| code | cuts | real `d92bdfb50d88/cuts.jsonl` |
|---|---|---|
| old | **101** | 206 → 206 (untouched, redirected) |
| fixed | **0** | 206 → 206 |

**101 is exactly the size of bursts 1 and 2.** Every recorded stack is `game_differential.js:422`, with
`process.argv.slice(1)` = `["--release","d92bdfb50d88","--state"]`. So the pin was present, one slot below
where the driver looked.

### The mechanism

1. Under `node -e` or `node -p` there is no script. `process.argv` is `[node, ...userArgs]`, so the user's
   arguments start at index 1. Measured: `node -e … -- --release X` gives `argv.slice(1)` =
   `["--release","X"]`. `node -` (stdin) keeps a `-` placeholder at index 1, so its arguments start at 2.
2. `tests/roster.js:188` pins the driver with `process.argv.push('--release', REL.id)`. The same idiom is in
   about 60 probes. `engine/game_differential.js:53` read `process.argv.slice(2)`, which drops the pushed
   `--release` and leaves a bare id. `flag('--release')` returned null, and the driver cut.
3. It cut on every load. `tests/staged_board.js` `harness()` drops the driver from `require.cache` and
   re-requires it once per patched simulator. The cut sits at module scope, and nothing remembered that this
   process had already cut.
4. Under `node -e` the driver cannot finish loading anyway. `steering.driverCode` throws "no entry file"
   at `game_differential.js:~2823`, because there is no script to digest. That is about 2,400 lines after
   the cut, so each load cut first and then threw. This explains why the burst wrote nothing.

A third route was found in the source. It was not part of this incident, and it is fixed too. Probes that
re-spawn themselves pass `process.execArgv` and not the user's `--release`, as in
`probe_fractional_priority_draw.js:231`. The child therefore cut.

### It is chronic

Across the store there are 677 releases and 7,753 cut events. **6,778** of those events carry the driver's
`why`, and **5** releases hold more than 150 each:

- `f30bf025ae28`: 1,305
- `705d2c7e86e8`: 304
- `b42b81899631`: 228
- `d92bdfb50d88`: 205
- `d38d117e68e9`: 157

Explicit probe freezes ("… — freeze the tree under test") account for about 60 events in total.

## 3. The fix

**`engine/game_differential.js`:**

- **The argv offset.** `EVAL_ARGV` is true when `process.execArgv` holds `-e`, `--eval`, `-p`, `--print`,
  `-pe`, `-ep` or `--eval=`/`--print=`. Arguments are then read from index 1, and otherwise from index 2.
  A script run is unchanged.
- **The pin is resolved once per process tree.** The order is: an explicit `--release`, then
  `globalThis.__abraGdReleasePin` (this process already resolved one), then `ABRA_RELEASE_PIN` (a parent
  did), and only then a cut. After `open`, the id is written to both. An inherited pin is announced on
  stderr. If an inherited id cannot be opened, the driver refuses and names `ABRA_RELEASE_PIN`. That can
  happen when a `_live_release.js` parent's throwaway id reaches a child with no preload. Before the fix,
  that child silently cut into the **real** store.
- `ER.open(REL_ID || CUT.id)`. It no longer opens the pointer after a cut and trusts that the pointer is
  the new cut.

**`engine/engine_release.js`:** each cut event carries `by: {pid, entry}`. `entry` is the script path
relative to the repository, or `(node -e)`.

**What does not change:** a run as a script with `--release` gets the same argv, the same release and the
same bytes. Every spawner checked passes an explicit `--release` to its children, so the inherited pin
never overrides one:

- `wire_ladder.js:304`
- `leaf_engine_contrast.js:473,513`
- `bench_speed.js:490`

## 4. The test, red then green

`tests/test-release-pin-no-cut.js`. Every cut goes to a temporary store, and the test checks that the real
store's event log for the pin gained no line.

| arm | assertion | old code | fixed |
|---|---|---|---|
| A | `node -e` pinned with `-- --release <pin>`, driver loaded twice: 0 cuts | **FAIL, 2 cuts** | ok, 0 |
| B | pinned parent script, child spawned with no `--release`: 0 cuts in the child | **FAIL, 1 cut** | ok, 0 |
| B | the child holds the parent's id | ok (it cut the identical tree) | ok, by inheritance |
| C | control: unpinned, loaded twice, exactly 1 cut | **FAIL, 2 cuts** | ok, 1 |
| C | the event names its writer (`by.pid`, `by.entry`) | (added with the fix) | ok |
| all | the real store is not written | ok, 206 → 206 | ok, 206 → 206 |

Old code: `FAIL — 3 assertion(s)`, exit 1. Fixed code: `PASS`, 10 of 10, exit 0.

Other checks on the fixed code:

- `tests/test-engine-release.js`: 80 passed, 0 failed.
- `tests/test-no-silent-failure.js`: no new entries.

## 5. Corruption verdict: none

- **Bytes.** `node engine/engine_release.js verify d92bdfb50d88` reports `release d92bdfb50d88 is intact`.
- **Manifest.** `release.json` at commit `65db4006` (the first commit of this release) has the same `id`,
  `cut` (16:04:45.355Z), `why`, `files` and `provides` as the working copy. **Only `cuts[]` differs**
  (1 → 206). That is consistent with how `cut()` works: it refuses when the digests of an existing id
  disagree.
- **Pointer.** In `data/engine-release.json`, `current`, `cut` and `why` are unchanged. `cuts`,
  `latest_cut`, `latest_why` and `pointer_written` moved. Commit `49ec0cb7` published that diff together
  with the 205 lines.
- **Artifact stamps.** All five artifacts stamp `engine_release d92bdfb50d88` and
  `engine_release_cut 2026-09-19T16:04:45.355Z`. `engine_release_cuts` is **1** on
  `data/game-differential{,.g1350,.g1950}.json`, which was stamped at 16:21, before the bursts. It is
  **206** on `data/all-mechanics-fire.json` and `data/engine-diff.json`. That counter is read by no gate
  and no provenance check. `engine/wire_ladder.js:417` strips it as volatile. **No pin moved, and no figure
  moved.**
- **The latent hazard, which did not happen.** The live tree hashed to `d92bdfb50d88` throughout, and still
  does: the test's own pin is that id. Had it moved, each of those loads would have cut a new release and
  repointed `data/engine-release.json` under the running lattices. In a roster `-e` session, the patched
  simulator would have been placed under the pointer release's path while the driver loaded a different
  snapshot. Every red demonstration in that session would then have been silently un-planted.

## 6. Files

- `engine/game_differential.js`: the argv offset, the resolved-once pin and the inherited pin.
- `engine/engine_release.js`: `by` on the cut event.
- `tests/test-release-pin-no-cut.js`: new.
- `CHANGELOG.md` 6.65.1, `docs/RUNNING-NOTES.md` (one row), `docs/MEASURE.md` (one section), and this
  report.

Not touched: the held drafts (deck, technical docs, `MODELS.md`, `SUMMARY.md` and their PDFs, and
`docs/_reports/2026-09-19-700-draft/`). `status.js --write` was not run. No git command was run.

## OWED, NOT RUN

1. **The driver-code digest moves.** `engine/game_differential.js` and `engine/engine_release.js` are both in
   the driver's require closure, so `steering.driver_code.digest` changes. The change does not alter a pinned
   script run. The next lattice will still read as NOT COMPARABLE to the 6.65.0 lattices on the driver axis.
   `engine/arms_comparable.js` cannot see that the change is neutral. Re-measure on the next engine release
   anyway. Do not re-run the lattices only to restamp.
2. **Merge risk.** The ENGINE agents in worktrees may also edit `engine/game_differential.js`. This patch has
   two hunks, the `argv` line (~53) and the release block (~411–445). Rebase with care.
3. **`tests/test-docs-current.js` is RED, 35 passed and 2 failed, and not from this change.** Both clauses
   (figures a cited artifact does not contain, 18 → 29; figures bound to no trace, "NEW" entries) list only
   lines in the held drafts that are modified in the working tree: the deck, technical docs, `MODELS.md` and
   `SUMMARY.md`. Neither lists a line of `RUNNING-NOTES.md` or `MEASURE.md`. They have to be cleared before a
   commit that includes those drafts. That is the coordinator's call.
4. **The driver cannot be loaded under `node -e` at all.** `steering.driverCode` throws "no entry file", so
   `node -e "require('./tests/roster.js')"` dies after its loads. That is not a cut hazard any more. It is
   why the burst wrote nothing, and why an inline roster inspection has to be a script file.
5. **The past events stay.** The 205 lines on `d92bdfb50d88`, and the 6,778 across the store, are an
   append-only history and are not rewritten. A reader of `cuts[]` should know that before 6.65.1 a count
   above 1 does not mean somebody froze the tree again on purpose.
6. **`tests/staged_board.js` still opens the pointer when no `--release` is given.** Unlike
   `tests/roster.js`, it does not push its id into argv. Its claim, "cannot end up holding two different
   releases", now holds only because the driver cuts the live tree and the pointer normally equals it. If the
   tree moves after the last cut, a bare `node tests/staged_board.js` still patches one release and plays
   another. Not changed here: it is ENGINE's harness, and it matters only for an unpinned run over a moved
   tree.
