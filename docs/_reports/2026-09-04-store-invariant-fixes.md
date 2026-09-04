# Store invariant fixes S1–S4 — 2026-09-04

**The invariant made true:** the raw log is the ONLY source of truth. Everything else in the store is
a derived view that can be thrown away and rebuilt offline.

Files touched, and only these four:

| File | What changed |
|---|---|
| `engine/durable-ingest.js` | S1, S2 (`archiveThenStore()`), S4 (`get()` + counters + exit codes), reparse dedupe |
| `build/compress-stores.js` | S3 (`--raw`, `--restore-raw`) |
| `.github/workflows/ingest.yml` | S3 wiring, S4 loud failure, raw shrink guard |
| `.gitignore` | shard guard + a note that `data/raw/**/*.gz` is tracked ON PURPOSE |

No heavy job was run, nothing played a game, no real fetch touched Showdown, and
`data/games.*.jsonl` and the raw archives were not written. Verified at the end: their mtimes still
predate this session (`games.ladder.raw-logs.jsonl` 2026-09-03 22:43, 411,744,385 bytes).

---

## How each defect was demonstrated BEFORE the fix

A check that has never failed is not evidence, so every claim below was produced by running the
**real script bytes**, not a re-implementation.

The harness is a `--require` preload that replaces `https.get` with a canned local server and wraps
`fs.createWriteStream` so the ORDER of writes is recorded. No network. It feeds two games:

- `g-good-1` — six `|poke|` per side, so `extract()` produces a row;
- `g-bad-1` — three `|poke|` per side, so `rec.six.p1.length < 4` and the parser refuses the row.

### S1 — the log of an unparseable game was DELETED

    already stored: 0; new to fetch: 2
    appended 1 games.
    store ids:   g-good-1
    archive ids: g-good-1          <-- g-bad-1's LOG IS GONE

Two games were fetched. One produced a row. The other produced neither a row **nor an archived
log** — the filter at `durable-ingest.js:543` sat before `rawOut.write(...)`, so the one artifact a
future parser could have used was destroyed. Showdown's replay pool is a rolling ~1,250 per format;
nothing can re-fetch it.

### S2 — the row was written BEFORE the log

Instrumented write order on the same run:

    ROW  g-good-1  t.jsonl
    LOG  g-good-1  t.raw-logs.jsonl
    ROW-END
    LOG-END

Two independent unawaited streams, row first. A crash between them leaves an ORPHAN ROW — a stored
game whose log was never archived, which is the unrecoverable direction. (The other direction, a log
with no row, is repaired by a free offline reparse.)

### S4 — a dead endpoint and a quiet day were the same output

    STUB_MODE=deadsearch:  "appended 0 games. store now 0 total."   EXIT=0
    STUB_MODE=deadlogs:    "appended 0 games. store now 0 total."   EXIT=0

`get()` resolved `''` on HTTP error, on timeout AND on an empty body — three facts sharing one
value. Both total failures reported success with the same reassuring line a genuinely quiet hour
produces.

---

## The fixes, and the proof they hold

### S1 + S2 — `archiveThenStore()`, one exported helper, two passes

Pass A writes every log we hold and `await`s the stream **closed**. Pass B then derives rows from the
same in-memory strings and applies the filter there — so a game the parser cannot read costs a ROW,
never a LOG. There is no second read and no second fetch.

After the fix, same harness, same input:

    ingest counters: idsSeen=2 newIds=2 logsRequested=2 logsNull=0 archived=2 rows=1 unparsed=1
    store ids:   g-good-1
    archive ids: g-good-1, g-bad-1          <-- the previously destroyed log

    write order:  LOG g-good-1
                  LOG g-bad-1
                  LOG-END                    <-- archive stream CLOSED
                  ROW g-good-1
                  ROW-END

**The store is byte-identical to what the old loop produced** — `cmp` clean against the pre-fix
output. Only the archive gains rows.

It is ONE exported helper because `engine/next_regulation_ingest.js:196` spawns this script and
inherits `main()`; fixing the inline loop alone would have held the instance and not the class.
`engine/mew.js` was deliberately left alone — its logs are self-play and regenerable from a seed.

**Round trip proven:** fetch → superset archive → `MODE=reparse` → store `cmp`-identical to the
original. A reparse re-applies the identical filter, so the derived view is unchanged.

**One consequence found by running it, and closed.** An unparseable game never gets a store row, so
it is never in `have`, so it is re-fetched and re-archived on every run. That is correct — better to
hold the log twice than not at all — but the day a future parser learns to read it, an un-deduped
reparse would emit one store row per archived copy. `MODE=reparse` now dedupes by id, first
occurrence wins, the same rule the store and the reconcile loop already use. It is a **no-op on
today's archive** (76,431 logs, 76,431 ids) and a guarantee afterwards. Demonstrated: an archive
holding `g-bad-1` twice reparsed to a byte-identical store and printed
`skipped 1 duplicate archived log(s)`.

### S3 — write-once dated shards, not one `.gz`

**Measured on the real archive, not estimated.** A 64 MB sample of
`data/games.ladder.raw-logs.jsonl` gzipped at level 9:

    67,108,864 plain -> 9,380,448 gz  =  13.98%

That confirms the ~14.3% figure and refines it. Projected across both human archives:

| Archive | Plain | Projected single `.gz` |
|---|---|---|
| `games.ladder.raw-logs.jsonl` | 411.7 MB | 54.9 MB |
| `games.bo3.raw-logs.jsonl` | 173.2 MB | 23.1 MB |
| **total** | **585 MB** | **78.0 MB** |

The case is **stronger than the brief assumed**: a single tracked `.gz` is not ~65 days from GitHub's
hard 100 MB per-file limit, it is already at **78% of it on day one**. And gzip cannot append — a
single blob is rewritten whole every run, so a six-hourly cadence adds a fresh ~78 MB object to the
pack every time.

So `build/compress-stores.js` gained:

- `--raw` — appends only rows not already in a shard to `data/raw/<store>/<YYYYMMDDTHHMM>-NN.jsonl.gz`.
- `--restore-raw` — replays shards in filename order back to the plain path.

**A shard is never rewritten and never deleted. No compaction.**

`RAW_STORES` is **derived** from `STORES` (`s.replace(/\.jsonl$/,'') + '.raw-logs.jsonl'` — the same
rule `durable-ingest.js` uses) rather than typed beside it. A second hand-maintained list of three
is the ban-list-of-four shape: it agrees today and goes stale silently the day a fourth store lands.

Proven in a sandbox running the real script bytes against a synthetic `data/`:

| Case | Result |
|---|---|
| first `--raw` | 5 ladder + 2 bo3 logs sharded |
| second `--raw`, nothing appended | `up to date` — **no shard written** |
| append 3 logs, `--raw` | a new shard holding **only the 3** |
| `--restore-raw` onto a deleted plain file | **`cmp`-identical** to the original plain archive |
| `--restore-raw` with a local-only row present | `8 log(s) + 1 local-only = 9` — nothing lost |
| `--restore-raw` twice | idempotent, still 9 |

**A real ordering bug was caught and fixed during this test.** The first implementation named the
first shard `<stamp>.jsonl.gz` and a same-minute collision `<stamp>-2.jsonl.gz`. `-` (0x2D) sorts
before `.` (0x2E), so the SECOND shard sorted FIRST and `--restore-raw` would have replayed an
append-only archive out of order. Every shard now carries a zero-padded sequence
(`-00`, `-01`, …) so filename order IS chronological order.

**`.gitignore`:** confirmed with `git check-ignore -v` that no existing pattern catches
`data/raw/games.ladder/20260904T1200-00.jsonl.gz` (exit 1, no match). Added `data/raw/**/*.jsonl` so
a stray UNCOMPRESSED file cannot be committed — verified it fires on `data/raw/games.ladder/stray.jsonl`
and still leaves the `.gz` tracked.

### S4 — a zero-gain run fails loudly

`get()` now resolves `null` when the request did not complete and the body otherwise. Callers that
only asked "is there a body" are unaffected (`null` and `''` are both falsy), but the run can now
count the difference. Counters printed every run: `idsSeen` (before dedupe), `newIds`,
`logsRequested`, `logsNull`, plus `archived`, `rows`, `unparsed`, `searchPagesOk/Failed`.

The discriminator is a fact about the endpoint: the public replay pool is a rolling ~1,250 per
format, so a live format always fills page one.

| Condition | Meaning | Exit |
|---|---|---|
| `idsSeen === 0` | the search failed — it cannot be a quiet ladder | **1** |
| `logsNull / logsRequested > 0.5` | the log endpoint is failing | **1** |
| `idsSeen > 0 && newIds === 0` | genuinely nothing new, said out loud | 0 |

After the fix, same harness:

    deadsearch: "ZERO-GAIN: the search endpoint offered NO ids ..."          EXIT=1
    deadlogs:   "ZERO-GAIN: 2 of 2 log requests did not complete (>50%)..."  EXIT=1
    quiet day:  idsSeen=2 newIds=1 ... "appended 0 games"                    EXIT=0

**The workflow keeps `continue-on-error: true` on both pull steps** — the no-paging-the-owner rule
stands. They gained `id:` (`pull_ladder`, `pull_bo3`) so their real `outcome` is readable, and the
existing shrink-guard step (already `set -eu`) is where it becomes loud.

**The guard was executed, not just written.** Its script was extracted from the YAML and run in a
sandbox:

| Case | Result |
|---|---|
| healthy, both pulls succeeded | EXIT=0 |
| `pull_ladder.outcome = failure` | `::error::the ladder pull reported a BROKEN ENDPOINT` — **EXIT=1** |
| raw archive 120 → 80 logs | `::error::...SHRANK... cannot be re-fetched` — **EXIT=1** |

The workflow also gained a monotonicity claim on the RAW archive itself, for the same reason the
parsed stores have one: it is append-only, deduped by id, and a lost log is unrecoverable.

---

## Verification performed

- `node --check` on both JS files — clean.
- `node tests/test-parse.js` — **42 passed, 0 failed**. `extract()` is untouched.
- The workflow YAML parses (`js-yaml`, installed in the scratchpad): 14 steps, both pull steps still
  `continue-on-error: true`, the shrink guard is not.
- `bash -n` on all 12 `run:` blocks — every one parses.
- `git status` — exactly the four owned files are modified.

Note on a hazard this repo has paid for: `cmd.exe /c "tools\lownode.cmd tests\test-parse.js"`
dropped into an interactive shell and produced no test output while returning `EXIT=0`. The exit
code was not evidence; the empty output was. `test-parse.js` is a single hand-written log, not a
heavy run, so it was run directly.

---

## CLASS or INSTANCE — honestly

**S1 — CLASS for the two doors that exist, INSTANCE against a third nobody has built.**
The ordering and the filter placement now live in one exported helper, and both callers
(`ingest.yml` twice, `next_regulation_ingest.js` by spawn) route through `main()` and inherit it. A
second filter added later inside `archiveThenStore` pass B is structurally incapable of deleting a
log. But **nothing forces a NEW ingest script to call the helper** — a third door written from
scratch could reintroduce it, and no test would say so.

**S2 — same, and for the same reason.** Additionally the `await`ed close means the ordering is a
real happens-before, not two streams that happen to be written in order.

**S3 — CLASS.** Sharding is a mechanism, not a list: which archives get sharded is DERIVED from
`STORES`, the shard/plain comparison is by id so it cannot drift, and the "never rewrite" property is
enforced by the filename search rather than by remembering. Adding a fourth store gets shards for
free.

**S4 — CLASS at the primitive, INSTANCE at the policy.** `get()` can no longer conflate "the request
failed" with "the answer was empty" for ANY caller, present or future — that is the class. The two
exit-code thresholds are specific to these two endpoints and would not catch a third silent-zero path
(for example a store write that fails after a successful fetch).

---

## OWED

1. **THE ONE-OFF HISTORY IMPORT WAS NOT PERFORMED — Will's call, as briefed.** `data/raw/` does not
   exist in the repo. The existing 585 MB of plain archive (76,431 ladder logs) is still local-only
   and still one disk failure from gone. When it is done it must be **CHUNKED into many shards, not
   one**: a single import shard would be a 78 MB object in the pack. `--raw` as written would produce
   exactly that one blob, so the import needs a chunked driver or a manual split.

2. **`engine/rebuild_records.js:117` IS BROKEN BY THE SUPERSET ARCHIVE. Verified at the line, not
   relayed.** It writes a record for EVERY archived log — `extract()` never returns falsy and no
   `six < 4` filter is applied — then refuses:
   `if (written !== nStore) { REFUSING to swap ...; process.exit(1) }`. Once the archive holds logs
   the store does not, `written > nStore` permanently and the tool cannot run. Its
   `missingMeta` warning also now reports the intended state as a fault. **I do not own that file.**

3. **`engine/mew_farm.js:391`** asserts `rawKept === kept` ("records and logs stay exactly in step").
   Not triggered today — `engine/mew.js` was deliberately left alone — but it is the assertion that
   will fire if the archive-anyway rule is ever propagated to the self-play path.

4. **`engine/sweep.js` section 5** still describes the OLD drift direction and will print
   `archive holds N` exceeding the store's row count, which reads as a defect. Its regex that parses
   `const RAW=` out of `durable-ingest.js` was checked and **still matches** — no degradation.

5. **`data/raw-log-census.json`** asserts the old subset relation as fact
   (`raw_archive_games: 46587`, `games_with_no_raw_log: 6191`). `data/conformance-baseline.json`
   records that no generator writes it, so nothing auto-fails; the file is simply now wrong.

6. **`engine/refresh-site-data.py:45`** collects raw rows BEFORE the clean-id filter and bundles the
   last 40 onto the site. Under a superset archive, replays the parser could not read can now reach
   the site's bundled-replay list. Same code in `engine/refresh-site-data.NOARCH.py` and
   `engine/_refresh_noarch.py`.

7. **`engine/next_regulation_ingest.js` will now report a failure for a newly-shipped format that has
   zero replays yet** — `idsSeen === 0` is indistinguishable from a dead search for a format nobody
   has laddered in. The step is `continue-on-error`, so nothing breaks, but it is noise. Whether that
   path wants an opt-out is the coordinator's call; I do not own the file.

8. **`--restore-raw` on CI decompresses the whole shard set every run** (78 MB gz → 585 MB plain once
   the import lands). It is wired as briefed and it earns its cost by giving the shrink guard a
   baseline, but it is the obvious thing to tune if the job gets slow.

9. **Nothing structurally forces a future ingest path through `archiveThenStore()`** — see S1's
   INSTANCE caveat above.

10. **Not committed.** All four files are modified on disk only; the coordinator publishes.
