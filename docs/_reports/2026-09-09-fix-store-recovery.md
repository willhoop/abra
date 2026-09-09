# Store recovery — the 11,110 ladder and 4,752 bo3 games dropped at the sharding cutover are back in the tracked store

Date: 2026-09-09. ENGINE. Every figure below is the output of the command beside it, run against the
working tree at `d6789951` (HEAD, `git log -1`). Nothing is committed; the new shards are untracked
files under `data/parsed/`. This is a dated findings record and is not maintained.

Conventions. "ids" is `grep -oE '"id":"[^"]*"' | sort -u | wc -l` over the plain bytes; "lines" is
`wc -l`; "CR bytes" is `od -An -tx1 -v | grep -c '^0d$'`, because the MSYS `grep`/`awk` on this machine
strip a trailing `\r` on read and reported 0 CR lines on a file `od` showed to hold 5. `comm` is over
the sorted unique id lists.

---

## 1. Verdict

- **Recovered.** ladder 81,269 -> **92,379** ids, bo3 28,049 -> **32,801**, ots unchanged at 4,167.
  `comm -23` of d2a418a5's ids against all on-disk shards: **0 / 0 / 0**. `--verify-parsed` IDENTICAL
  on all three stores. Five new shards; **no existing shard changed** (`git diff --stat HEAD -- data/parsed`
  is empty).
- **ots lost nothing** (§3). Its shard and d2a418a5's monolith decompress to the same sha256.
- **Two defects found on the way, both fixed, both shown red first:** `engine/dedupe_store.py` wrote
  CRLF on Windows (§5), and `build/compress-stores.js --check` compared to the local file only — it now
  asserts the tracked store carries every id `HEAD~1` tracked (§8), red on a one-row break and red on a
  faithful replay of the 2026-09-06 cutover.
- **`sanity_check.py` went 95/1 -> 94/2.** The new red is a `brought` of six on one recovered game that
  the tracked store already held at d2a418a5 — the recovery surfaced an existing ingest defect, it did
  not create one (§7).

---

## 2. Step 0 — the tree

`git status --short` at the start: only untracked `docs/` files, no modified tracked file. HEAD
`d6789951`, not the `bf4ff432` the session snapshot named — one commit had landed since.

**By the end, other agents had modified fourteen tracked files** (`CLAUDE.md`, `docs/*.md`,
`data/docs-currency-baseline.json`, `.github/workflows/smogon-stats.yml`) and added
`data/smogon-priors.observed.json` and two review documents. None of those are mine and none were
touched. Mine are exactly: `build/compress-stores.js` (M), `engine/dedupe_store.py` (M), and the five
`?? data/parsed/**/20260909T1708-*.jsonl.gz`.

## 3. Step 1 — the third store

```
git show d2a418a5:data/games.ots.jsonl.gz | gzip -dc | grep -oE '"id":"[^"]*"' | sort -u   -> 4167
data/parsed/games.ots/*.jsonl.gz, same pipeline                                            -> 4167
comm -23 -> 0     comm -13 -> 0
```

The gz blob at d2a418a5 (`cd631357…`) is not byte-identical to the shard (`403b9981…`) — different gzip
run — but both decompress to sha256 `cd21077a4578afa3`, which is also the local plain file and the
on-disk retired `.gz`. **ots lost no games and was not recovered.**

## 4. Step 2 — restore the local plain stores to HEAD's shards

| | lines | ids | CR bytes |
|---|---:|---:|---:|
| ladder before (`mtime Sep 4 01:30`) | 76,833 | 76,833 | 0 |
| bo3 before | 25,522 | 25,522 | 0 |
| **ladder after `--restore-parsed`** | **81,269** | **81,269** | 0 |
| **bo3 after** | **28,049** | **28,049** | 0 |

`node build/compress-stores.js --restore-parsed`: `22 shard(s) -> 81269 rows`, `17 shard(s) -> 28049 rows`,
ots `1 shard(s) -> 4167 rows`. The local file was a strict subset of the shards (0 local-only on both).

## 5. Step 3 — append the d2a418a5 monoliths and dedupe

**First, `dedupe_store.py` was shown to corrupt line endings on this machine.** Probe: 5 real bo3 rows
plus a duplicate of the first, in the scratchpad.

```
before:  6 lines, 0 CR bytes, sha 5fa6b3b5ee8219cc      expected 5 unique rows (LF): sha ab35798ec6682875
after (committed dedupe_store.py):  5 lines, 5 CR bytes (od), sha 0ca101716c2ed2ba   <- RED: +5 bytes, one \r per row
after (fixed):                      5 lines, 0 CR bytes,      sha ab35798ec6682875   <- GREEN, byte-identical
```

Cause: `os.fdopen(fd, 'w', encoding='utf-8')` — Python text mode writes `os.linesep`, CRLF on Windows.
Fix, one keyword: `newline='\n'`, with a three-line comment. The script reads every id via
`json.loads`, keeps the FIRST occurrence, preserves order, rewrites atomically — so with the shard
rows appended first, every id that both copies hold keeps its tracked shard bytes. Had the real run
gone ahead unfixed, the recovered 15,862 rows would have been published CRLF and `--verify-parsed`
would have failed. Not run on the real stores until the probe was green; the run was gated on the
probe's sha inside one script.

```
git show d2a418a5:data/games.ladder.jsonl.gz | gzip -dc >> data/games.ladder.jsonl
git show d2a418a5:data/games.bo3.jsonl.gz    | gzip -dc >> data/games.bo3.jsonl
```

| | lines | ids |
|---|---:|---:|
| ladder after append | 169,615 | 92,379 |
| bo3 after append | 59,335 | 32,801 |
| **ladder after dedupe** | **92,379** | **92,379** — `169615 lines -> 92379 unique (77236 duplicates, 0 unparseable)` |
| **bo3 after dedupe** | **32,801** | **32,801** — `59335 lines -> 32801 unique (26534 duplicates, 0 unparseable)` |

Reconciliation with the coordinator's `comm`: 88,346 (d2a418a5) + 4,033 (shard-only) = **92,379**;
31,286 + 1,515 = **32,801**. The duplicate counts are the overlaps: 81,269 − 77,236 = 4,033 and
28,049 − 26,534 = 1,515. **No difference from expectation.** Both stores end in `0a`, 0 CR bytes.

## 6. Steps 4 and 5 — cut the shards, verify, prove the gap closed

`node build/compress-stores.js`:

| shard | rows | bytes | sha256 (16) | `date` span |
|---|---:|---:|---|---|
| `data/parsed/games.ladder/20260909T1708-00.jsonl.gz` | 5,287 | 3,978,028 | `fb97869b197fef1b` | 2026-08-22 02:28 -> 2026-09-01 05:04 |
| `data/parsed/games.ladder/20260909T1708-01.jsonl.gz` | 5,414 | 3,917,531 | `78b782df9556dc2e` | 2026-09-01 04:06 -> 2026-09-06 04:39 |
| `data/parsed/games.ladder/20260909T1708-02.jsonl.gz` | 409 | 303,602 | `9b5a345244ef1c5b` | 2026-09-05 20:22 -> 2026-09-06 07:38 |
| `data/parsed/games.bo3/20260909T1708-00.jsonl.gz` | 3,457 | 3,196,657 | `725225994a0be05b` | 2026-08-22 02:38 -> 2026-09-04 20:44 |
| `data/parsed/games.bo3/20260909T1708-01.jsonl.gz` | 1,295 | 1,214,695 | `d2967b9fd110639e` | 2026-09-04 16:22 -> 2026-09-05 14:03 |

`+11110 row(s) sharded (66.5 MB of source)`, `+4752 row(s) sharded (44.3 MB of source)`, ots `up to date`.
Three ladder shards rather than one because the 32 MiB source cap split 66.5 MB; the brief's "one new
shard per store" was an estimate and the cap is the rule.

```
--verify-parsed:  games.ladder.jsonl  IDENTICAL  25 shard(s) -> 92379 rows, 481072929 B, sha256 cde0fa05d5177469
                  games.ots.jsonl     IDENTICAL   1 shard(s) ->  4167 rows,  31928037 B, sha256 cd21077a4578afa3
                  games.bo3.jsonl     IDENTICAL  19 shard(s) -> 32801 rows, 298313305 B, sha256 072c4c61ed23bea3
--check:          up to date on all three, exit 0        (on the committed script; re-run on the patched one in §8)
git diff --stat HEAD -- data/parsed   -> empty           (no existing shard changed)
```

Step 5, d2a418a5 ids against ALL on-disk shard ids:

| store | d2a418a5 ids | all-shard ids | all-shard rows | **`comm -23`** |
|---|---:|---:|---:|---:|
| ladder | 88,346 | 92,379 | 92,379 | **0** |
| bo3 | 31,286 | 32,801 | 32,801 | **0** |
| ots | 4,167 | 4,167 | 4,167 | **0** |

## 7. Step 6 — `sanity_check.py`

| | result | store-shape lines |
|---|---|---|
| before (local file, 76,833 rows) | **95 passed, 1 failed** | `FAIL store shape: the winner is always one of the two players (2 bad)` |
| after (92,379 rows) | **94 passed, 2 failed** | same 2 bad winners, **plus** `FAIL store shape: nobody brings more than four ({0: 1506, 2: 12006, 3: 24151, 4: 147093, 6: 2})` |

**Worse by one clause, and the cause is a record the tracked store already held.** The two `6`s are
one game, `gen9championsvgc2026regmb-2676161109` (2026-09-05 18:45), `brought` of length 6 on BOTH
sides. Membership, tested in Python against the id sets: in the d2a418a5 monolith **yes**, in HEAD's
shards no, in the cutover shards (= the old local file) no. So it was tracked at d2a418a5, lost at the
cutover with the other 11,109, and is tracked again now — the recovery restored what git had, and
`sanity_check.py` reads the local file, which had never seen it. The two bad-winner games
(`…-2662690089`, 2026-08-10; `…-2672145722`, 2026-08-28) are in every copy and are the baseline red;
both have a non-ASCII player name and the `winner` field differs from `p1.name` by encoding, which is
an ingest question, not a store one. Neither row was filtered: the store is raw and the parser defect
is OPS' to fix. Everything else in §6 of the check is green on all 92,379 rows: 0 duplicate ids, 0 bad
JSON, 0 missing fields, `brought ⊆ six`, `lead ⊆ brought`.

## 8. Step 7 — the check that would have caught this

`build/compress-stores.js --check` compared the on-disk shards to the LOCAL plain file, and the local
file was the thing that was wrong. It now also reads the ids git tracked at `HEAD~1` — both forms,
`data/parsed/<store>/*.jsonl.gz` AND the retired `data/<store>.jsonl.gz`, so a cutover between forms is
inside the claim — and fails if any is absent from the shards on disk. It reads git, never the local
file, and it THROWS when `HEAD~1` cannot be read (shallow clone) rather than passing quietly.

Diff: `build/compress-stores.js | 63 ++++----`, 45 insertions, 18 deletions — the 18 are
`shardedCount()` and its comment, which existed only because a 2026-09-06 measurement put the id-set
build at 58 s. Re-measured today on the same code (`scratch/bench.js`): **ladder 2.2 s, bo3 1.4 s,
gunzip alone 0.8 / 0.5 s; `git show` of all 45 tracked blobs 2.2 s.** An `indexOf` variant agreed with
the regex on all 125,180 lines and saved 15%; not worth a diff. `--check` builds the id set it needs.
No new flag, no new file, no knob.

| run | where | result |
|---|---|---|
| **green** | real tree, `HEAD~1 = bf4ff432` | `carries every id HEAD~1 tracked (81269 / 4167 / 28049)`, up to date, **exit 0, 8.7 s** |
| **red — deliberate break** | scratchpad copy of all 45 shards, one row (`…-2653451938`) dropped from a copy of `20260906T1954-00`, plain files restored from those copies, git pointed at the real repo via `GIT_DIR`/`GIT_WORK_TREE` | `games.ladder.jsonl LOST 1 id(s) that HEAD~1 tracked (81269 then, 92378 in the shards now)`, **exit 1**; real tree untouched |
| **red — the real incident** | `git worktree add --detach <scratch>/wt 18432bcb`; patched script copied in; `--restore-parsed` there (76,833 / 4,167 / 25,522); `--check` with `HEAD~1 = 0601a600`, which tracks the monoliths (`git rev-parse 0601a600:data/games.ladder.jsonl.gz` = `978898e3…` = d2a418a5's blob) | `games.ladder.jsonl LOST 11513 id(s) (88346 then, 76833 …)`, `games.bo3.jsonl LOST 5764 id(s) (31286 then, 25522 …)`, ots clean, **exit 1**. Worktree removed and pruned afterwards. |

11,513 and 5,764 are the losses AT the cutover (88,346 − 76,833; 31,286 − 25,522); the later ingests
re-pulled 403 ladder and 1,012 bo3 of them from the rolling replay pool, leaving today's 11,110 / 4,752.
The one existing caller, `tests/test-workflow-paths.js`, still passes: `5 passed, 0 failed`, 9.3 s.

**Where it does NOT run.** `--check` is called by that test only. `.github/workflows/ingest.yml`
never calls it, and its own shrink guard is `wc -l` against the shard-restored base — so a shard set
that starts short is the new floor there. Wiring `--check` into the runner after its shard step is
owed (§11); on a `fetch-depth: 1` checkout it would throw on `HEAD~1`, which is the loud answer.

## 9. Proposed `docs/RUNNING-NOTES.md` row (not written — another agent owns the file this pass)

```
## [Unreleased] — 2026-09-09 — the sharding cutover dropped 11,110 ladder and 4,752 bo3 games from the tracked store; recovered from history, and `--check` now reads what git tracked

- **What changed.** Five write-once shards under `data/parsed/` carry every id that `d2a418a5`
  (2026-09-06 15:34Z, the last tracked monoliths) held and the cutover `18432bcb` did not:
  `games.ladder/20260909T1708-{00,01,02}` (11,110 rows, 66.5 MB of source) and
  `games.bo3/20260909T1708-{00,01}` (4,752 rows, 44.3 MB). No existing shard changed. ots lost
  nothing. `build/compress-stores.js --check` now also asserts the shards carry every id tracked at
  `HEAD~1`, in either tracked form, and `engine/dedupe_store.py` writes LF on Windows
  (`newline='\n'`) — it wrote CRLF, measured on a 5-row probe.
- **Measured.** Tracked ids ladder 81,269 -> 92,379, bo3 28,049 -> 32,801, ots 4,167.
  `comm -23` of d2a418a5's ids against all shards: 0 / 0 / 0. `--verify-parsed` IDENTICAL:
  `cde0fa05d5177469` (ladder, 92,379 rows, 481,072,929 B), `072c4c61ed23bea3` (bo3, 32,801 rows,
  298,313,305 B), `cd21077a4578afa3` (ots, unchanged). The new `--check` clause: green on the tree in
  8.7 s; red on a one-row break; red on a worktree at `18432bcb` (`LOST 11513` / `LOST 5764`).
  `engine/sanity_check.py` 95/1 -> 94/2: the added red is `brought` = 6 on
  `gen9championsvgc2026regmb-2676161109`, a record d2a418a5 already tracked.
  `docs/_reports/2026-09-09-fix-store-recovery.md`.
- **Supersedes.** The 2026-09-06 sharding row's "Supersedes. Nothing. No published figure changed
  value." That row verified the shards against the live local file (`IDENTICAL 12 shard(s) -> 76833
  rows`) and not against the tracked `.gz` they replaced; the tracked corpus shrank by 11,110 ladder
  and 4,752 bo3 games at that commit and no check said so. Every count published off the tracked
  store between `18432bcb` and this row is short by up to that many games.
- **Basis.** unchanged.
- **Owed to the next major.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md`, where the corpus
  size and the materialisation path are stated, carry the new counts and the `HEAD~1` clause.
```

## 10. Proposed `CHANGELOG.md` entry (not written) and `docs/ROADMAP.md` row (not written)

`### Fixed`, under the next version:

```
- **THE SHARDING CUTOVER DROPPED 15,862 GAMES FROM THE TRACKED STORE AND EVERY CHECK WAS GREEN.**
  `18432bcb` (2026-09-06 16:25 -0400) sharded the LOCAL plain file, two weeks behind origin, 51
  minutes after `d2a418a5` had committed 88,346 ladder and 31,286 bo3 ids to the monoliths;
  `--verify-parsed` proved the shards identical to the wrong file. Recovered from `d2a418a5`
  into five new write-once shards: ladder 81,269 -> 92,379 ids, bo3 28,049 -> 32,801, ots
  unchanged at 4,167; `comm -23` of the monolith ids against all shards 0 / 0 / 0; no existing
  shard changed. `build/compress-stores.js --check` now asserts the shards carry every id git
  tracked at `HEAD~1` in either form — red on a one-row break, red on a worktree at `18432bcb`
  (`LOST 11513` ladder, `LOST 5764` bo3), green on the tree in 8.7 s. `engine/dedupe_store.py`
  wrote CRLF on Windows (Python text mode, `os.linesep`), measured on a 5-row probe and fixed with
  `newline='\n'` before it touched the store. `docs/_reports/2026-09-09-fix-store-recovery.md`.
```

ROADMAP row, DEFECT, owner OPS/MEASURE, in the register's `| # | item | … |` shape, next free id after
#549:

```
| #550 | **THE TRACKED STORE LOST 11,110 LADDER AND 4,752 BO3 GAMES AT THE SHARDING CUTOVER `18432bcb`, AND TWO GUARDS LOOKED STRAIGHT PAST IT.** DEFECT, store. FILED 2026-09-09 BY ENGINE, MEASURED (`docs/_reports/2026-09-09-pre-600-store-and-authority.md` §1a-bis) AND FIXED THE SAME DAY (`docs/_reports/2026-09-09-fix-store-recovery.md`). The guards that missed it: **(1)** `build/compress-stores.js --verify-parsed` / `--check`, which compared the shards to the LOCAL plain file (`IDENTICAL 12 shard(s) -> 76833 rows`) and never to the tracked `.gz` they replaced; **(2)** `.github/workflows/ingest.yml` "Refuse to proceed if a store shrank", whose baseline is `wc -l` of the store restored FROM THE SHARDS, so a short shard set is the new floor. Recovered from `d2a418a5` (88,346 / 31,286 ids) into `data/parsed/games.{ladder,bo3}/20260909T1708-*`; `comm -23` 0 / 0 / 0. `--check` now asserts ids(shards) ⊇ ids tracked at `HEAD~1`, shown red on a replay of the cutover. STILL OPEN: wire `--check` into the runner after its shard step (it is called by `tests/test-workflow-paths.js` only); the runner's shrink guard still measures against itself; one recovered record (`gen9championsvgc2026regmb-2676161109`, `brought` = 6 both sides) and two pre-existing bad-winner records (`…-2662690089`, `…-2672145722`, non-ASCII names) keep `engine/sanity_check.py` red — parser, not store. | 
```

## 11. OWED, NOT RUN

- **Commit and push** the five shards plus the two code files, by name — nothing here is committed.
  `git add data/parsed/games.ladder/20260909T1708-00.jsonl.gz … build/compress-stores.js engine/dedupe_store.py`.
  The pre-commit hook will require the RUNNING-NOTES row (§9); the CHANGELOG bullet and the ROADMAP row
  (§10) go in the same pass. Fourteen tracked files modified by other agents are in the tree — add by
  name, never `-A`/`-u`.
- **Wire `--check` into `ingest.yml`** after `node build/compress-stores.js` and before the push. On
  the runner's shallow checkout it throws on `HEAD~1`; either deepen the fetch for that step or accept
  the throw as the answer. Not done here: the workflow is OPS' file and the brief said `--check`.
- **The runner's shrink guard measures against itself.** Its `wc -l` baseline is the shard-restored
  store; that is the guard that could not see this. The `HEAD~1` clause is the replacement, once wired.
- **`engine/sanity_check.py` stays red on 2 clauses**, both parser defects the store now exhibits
  (§7): a `brought` of 6 on both sides of one game, and `winner` not equal to either `p1.name` /
  `p2.name` under non-ASCII names. OPS. The check also reads the LOCAL ladder file only and skips bo3
  and ots — the pre-600 report already says so.
- **`dedupe_store.py`'s read side** still passes CRLF through `strip()`, so a CRLF store (ots is CRLF
  on all 4,167 rows) comes out LF on any platform. Not exercised here — ots was not deduped — and not
  changed, because it is a behaviour on the runner as well and the ots store's line endings are a
  separate decision.
- **The 58 s claim** in `compress-stores.js`'s old comment could not be reproduced (2.2 s today on the
  same code); the comment now records both measurements rather than an explanation.
- **`data/team-pool-frozen` needs nothing.** It is a deliberate 2026-08-12 snapshot (`FROZEN.md`,
  tracked; `games.bo3.jsonl` 13,214 rows and `games.ots.jsonl`, untracked) taken so the differential's
  sample cannot move; it predates the loss window (2026-08-22 -> 09-06) and is read by
  `engine/diff_swarm.js` and four others by path. Untouched.
- **3,510 of the 11,110** recovered ladder games also have raw logs under `data/raw/games.ladder/`
  (pre-600 report); the remaining 7,600 exist only as parsed rows. Nothing to do unless a reparse is
  ever attempted — then those 7,600 cannot be rebuilt and must be carried forward as-is.
- **Scratch left in the session scratchpad** (`rec/`: id lists, `bench.js`, `break.js`, `patch_guard.py`,
  the sandbox `sb/` with ~840 MB of restored plain files). Safe to delete; nothing in the repo points at it.
