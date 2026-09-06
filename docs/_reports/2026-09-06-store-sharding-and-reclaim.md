# Store sharding, and the h2h reclaim that was refused — 2026-09-06

> ## READ THIS FIRST — THE CUTOVER IS HALF-COMMITTED AND THE COLLECTOR IS DOWN UNTIL IT IS FINISHED
>
> While this work was in progress another agent ran a wide `git add` and committed. **`18432bcb`
> swept in the staged half of this change** — the 20 shards are tracked and the three
> `data/games.*.jsonl.gz` are untracked at HEAD — but `.gitignore`,
> `.github/workflows/ingest.yml`, `build/compress-stores.js`, `docs/RUNNING-NOTES.md` and this
> report were not staged at that instant and are **staged now, uncommitted**.
>
> So HEAD carries the new transport and the OLD workflow. Verified against `git show HEAD:`, the
> ingest Action would reach `Restore the plain stores from the tracked .gz`, find no
> `data/games.ladder.jsonl.gz` in the checkout, and exit:
>
> ```
> ::error::data/games.ladder.jsonl.gz is missing from the checkout — refusing to run
> ```
>
> **It fails safe** — `set -eu`, step 3 of 14, before any pull, any commit and any push, so nothing
> is lost and nothing wrong is published. But the collector does not run until the five staged files
> are committed. Next scheduled run is 00:17 UTC.
>
> Nothing here needs re-doing. Commit the staged set.

MEASURE. Two jobs were approved: shard the parsed stores, and delete the quarantined h2h dumps.
**The first is done and proven byte-identical. The second is REFUSED on evidence** — the dumps are
read by a live instrument and two of them back figures published on the site and an open register
row assigned to MEASURE.

---

## 1. JOB 1 — the parsed stores are sharded

### 1.1 The verdict

`node build/compress-stores.js --verify-parsed` reassembles each store from its shards alone, into a
temp directory, and sha256s the result against the live plain file. Run after every edit in this
pass:

```
games.ladder.jsonl   IDENTICAL  12 shard(s) -> 76833 rows, 383723981 B, sha256 412858b71f21f14d
games.ots.jsonl      IDENTICAL   1 shard(s) ->  4167 rows,  31928037 B, sha256 cd21077a4578afa3
games.bo3.jsonl      IDENTICAL   7 shard(s) -> 25522 rows, 227347410 B, sha256 da8597c45bb8d096
```

Those three digests were also computed independently, before any code was written, straight off the
live files. They match. **The reassembly is byte-identical on all three stores, including the one
that is CRLF.**

### 1.2 What was measured about the stores first

Nothing was designed until the files had been read:

| store | bytes | rows | blank lines | rows with no `id` | duplicate ids | line ending | ends `\n` |
|---|---:|---:|---:|---:|---:|---|---|
| `games.ladder.jsonl` | 383,723,981 | 76,833 | 0 | 0 | 0 | LF | yes |
| `games.bo3.jsonl` | 227,347,410 | 25,522 | 0 | 0 | 0 | LF | yes |
| `games.ots.jsonl` | 31,928,037 | 4,167 | 0 | 0 | 0 | **CRLF on all 4,167 rows** | yes |

The CRLF store is why the shard path works on **Buffers** and never decodes a line. `--sync` and
`--restore-raw` split a utf8 string and re-join it, which survives only because a utf8 round trip
happens to be lossless for what those files hold. A byte-identity claim cannot rest on "happens to".
A line here **includes its own terminator, whatever that terminator is**, so reassembly is a
concatenation and cannot invent, drop or translate one. Ids are read through `latin1` — a 1:1
byte→char map that cannot throw and cannot substitute U+FFFD.

### 1.3 The shape

Exactly the shape the raw logs have used since 2026-09-04: write-once dated gzips under
`data/parsed/<store>/<YYYYMMDDTHHMM>-NN.jsonl.gz`, never rewritten, never compacted, filename order
chronological by construction, sequence number always present and zero-padded so a within-minute
collision cannot sort a later shard first.

The cap is on **source bytes** (`SHARD_BYTES = 32 MiB`), not on a row count, so a store whose rows
get fatter cannot walk a shard back toward the wall.

| store | shards | largest shard | total on disk |
|---|---:|---:|---:|
| `games.ladder` | 12 | 3.9 MB | 43.7 MB |
| `games.bo3` | 7 | 3.1 MB | 20.4 MB |
| `games.ots` | 1 | 3.2 MB | 3.2 MB |

Sharding all three took 2m00s. The single `games.ots` shard turned out to be **byte-identical to the
old `games.ots.jsonl.gz`** — same bytes, same gzip level — so git recorded that one as a rename and
it costs zero new objects.

### 1.4 The guards, each shown red before being trusted

Run in a sandbox that executes a **copy of the real file** (`__dirname/../data` pointed at a temp
tree seeded with real rows), not a reimplementation:

| claim | demonstration | result |
|---|---|---|
| incremental append lands in a NEW shard, same minute | appended 20 rows, re-ran | `20260906T1957-01.jsonl.gz`, sorts after `-00` |
| reassembly stays identical after an append | `--verify-parsed` on the 120-row store | IDENTICAL |
| a fresh clone reproduces the store exactly | deleted all three plain stores, `--restore-parsed`, sha256 | MATCH on all three, incl. the CRLF one |
| a second run is a no-op | re-ran with no new rows | `up to date`, no shard written |
| local store BEHIND the shards is refused | truncated the store to 50 rows | `REFUSING TO SHARD — 120 vs 50`, exit 1 |
| a restore is never a deletion | added 5 local-only rows, restored | `125 rows (incl. 5 local-only)` |
| a store caught mid-append is refused | appended a byte with no newline | `REFUSING — the store does not end in a newline`, exit 1 |
| **the verify can actually fail** | dropped one row from a shard | `DIFFERS — store 232343 B … reassembly 224591 B`, `DO NOT UNTRACK ANYTHING`, exit 1 |

The last row is the one that matters. A cutover check that has never been seen red is a check that
asserted nothing.

### 1.5 Files changed

| file | what |
|---|---|
| `build/compress-stores.js` | `--parsed` is now the default run; `--restore-parsed`, `--verify-parsed`; `--sync` delegates to the same reassembly instead of reading the retired `.gz` |
| `.github/workflows/ingest.yml` | restore step, reconcile step, and the staging list |
| `.gitignore` | `data/parsed/**/*.jsonl` (stray plain only); the three monoliths named and ignored |
| `tests/test-workflow-paths.js` | the currency clause's wording; the call is unchanged |

**The ingest path IS changed, and here is exactly what and why.** Left alone it would recreate the
monolith on the next hourly run.

- The restore step no longer `gunzip -c`s three `.gz` files; it runs `--restore-parsed`. It now
  **refuses on an EMPTY shard directory**, which is the dangerous case — `--restore-parsed` would
  print "nothing to restore" and exit 0, the ingest would build a store from that run's fetch alone,
  and only the shrink guard would stand between that and a published corpus of ~300 games.
- `add_artifacts()` no longer names `data/games.*.jsonl.gz`. Naming an ignored path is `git add`
  exit 1 under `bash -e`, which is the exact bug that killed this workflow for 24 days. A
  `data/parsed/*/*.jsonl.gz` glob block was added beside the raw-shard block, with the same
  unmatched-glob discipline.
- The reconcile loop's three `gunzip -c` lines became one `--restore-parsed`. That is strictly safer
  than what it replaces: it **unions** origin's shards with whatever the plain file already holds,
  origin's rows first, so it cannot be a deletion even if the `cp`/`cat` pair around it were removed.
- `node build/compress-stores.js` at both call sites is unchanged as text and now writes shards.

Verified: the workflow YAML parses (14 steps), `tests/test-workflow-paths.js` is green (5 passed, 0
failed), `git check-ignore` confirms the shards are trackable, a stray plain shard is ignored, the
three monoliths match their new ignore rules once untracked, and
`data/games.gen9championsvgc2026regmabo3.jsonl.gz` — the next-regulation collector's store, a
separate mechanism — is still trackable. That last one is why the ignore rule names three paths
instead of globbing `data/games.*.jsonl.gz`.

### 1.6 What was NOT changed, and why

`engine/quality.js` and `engine/quality.py` fall back to `<store>.jsonl.gz` when the plain store is
absent. The prior scoping report listed both among "six files, none of them an analysis path". They
were spared:

- **`engine/quality.js` is a FROZEN ENGINE SOURCE.** It is in `SOURCES` in
  `engine/engine_release.js`. Editing it moves every future release id, and another agent is running
  differentials against a release right now. CLAUDE.md's photograph rule is explicit that nothing in
  frame may move, "including files the measuring agent never opens".
- A fact must not split across two implementations, so `quality.py` stays with it.

The fallback is not silently wrong after the cutover — with no `.gz` present it returns the plain
path and the read throws `ENOENT` under the name the caller asked for. The fresh-clone path is
`node build/compress-stores.js --restore-parsed`, which is what the workflow's first step does.

**Five files, not six.**

### 1.7 A claim of mine that was retracted mid-pass

The first draft of the header, the workflow comment and the `.gitignore` block all argued: *gzip has
no append, so the whole blob is rewritten every six hours and the pack gains a fresh ~54 MB object
four times a day.* The first clause is true and the conclusion is **false**. Measured over the real
history:

| path | distinct blobs | raw total | **on disk, packed** |
|---|---:|---:|---:|
| `data/games.ladder.jsonl.gz` | 59 | 2,650.8 MB | **91.5 MB** |
| `data/games.bo3.jsonl.gz` | 59 | 1,192.9 MB | **43.0 MB** |
| `data/games.ots.jsonl.gz` | 2 | 6.8 MB | **3.4 MB** |

~1.55 MB of pack per ladder version, not 54 MB. Git deltas these well *because* the store is
append-only: two gzip runs at the same settings share a long identical deflate prefix, so
consecutive blobs differ mostly at the tail. The three hold **137.9 MB of a 524.28 MiB pack (26%)**,
and untracking them recovers none of it.

All three comment blocks now carry the measurement and the retraction. **The deadline is the whole
argument and it is untouched:** a hard 100 MB per-file wall on ~2026-10-17 that rejects the ingest
Action's own push. Shards are also ~6.5x cheaper per run (~0.35 MB against ~2.28 MB); that is a
nice-to-have, not the reason.

### 1.8 The index

Staged, **not committed** — the publisher commits.

- `git add data/parsed` first, then `git rm --cached` the three monoliths, so the index is never in
  a state where a sweeping commit could take the removal without the replacement.
- The three `.gz` files are **left on disk**. Nothing was deleted.

---

## 2. JOB 2 — the h2h dumps are SPARED. Every one of them.

### 2.1 What is there

37 files matching `data/games.h2h-*.jsonl`, **21,609,861,713 B = 20.13 GiB = 21.61 GB**, largest
`data/games.h2h-tags2.jsonl` at 5.271 GiB. All untracked, all gitignored. (The brief's 20.78 GB and
this differ by glob or by unit; the number above is the exact byte sum of the exact glob.)

### 2.2 Why they are not dead

**`build/build_status.js` reads them from the filesystem on every run, and `data/status.js` — which
the site renders — publishes figures derived from their line counts.**

`mew()` lists `data/` and filters `/^games\.(selfplay|h2h)[^/]*\.jsonl$/` excluding raw-logs, then
publishes the **largest corpus's record count** as MEW's headline. Measured on the current tree:

```
build_status.js mew() filter matches 32 corpora on disk right now
  of which games.h2h-*: 26
  of which games.selfplay*: 6
```

`data/status.js` currently says, for MEW:

> `"metric": "586,816 self-play games generated on the official engine"`
> `"evidence": "data/games.h2h-tags2.jsonl: record count (largest of 32 corpora)"`

and for DODUO:

> `"metric": "trained to WIN and lost to the same weights fitted to imitate: 45.7% of decisive pairs [45.1, 46.3]"`
> `"evidence": "data/games.h2h-joint-trained.jsonl: 194,514 paired games via engine/paired_h2h.js"`

Both counts were re-measured tonight by streaming the files:

```
   194514 data/games.h2h-joint-trained.jsonl
   586816 data/games.h2h-tags2.jsonl
```

**Exact.** The provenance is live, not stale.

### 2.3 The three consequences of deleting them

1. **DODUO's verdict silently flips from a measured LOSS to "built".** `build_status.js:176` branches
   on `exists('data/games.h2h-joint-trained.jsonl')`: present → `status: 'null'`, "trained to WIN and
   lost"; absent → `status: 'built'`, "N coordination features, fitted". The file is the only
   evidence of that loss on disk. This is the project's signature failure — a capability absent while
   everything reports success — and the comment two functions down in that same file says so, about
   the same mechanism, in the incident that caused it to be written.
2. **MEW's headline number changes** to whatever the largest surviving corpus holds.
3. **The published string "(largest of 32 corpora)" changes**, and it is a count over exactly these
   files — so *every one of the 26* is load-bearing for it, not just the largest.

### 2.4 And an open register row names two of them by path

`docs/ROADMAP.md` **#154, open, owner MEASURE**:

> Related: `data/games.h2h-joint-trained.jsonl` and `data/games.h2h-tags2.jsonl` have NO ROW at all,
> so DODUO's and MEW's evidence lines resolve to *unclassified* — the site withholds them on the
> ground that unclassified is not cleared, and **that withholding expires by itself the day either
> file gets a row that clears.**

Deleting them makes that resolution permanently impossible. An untracked file is unrecoverable.

### 2.5 The 11 `.raw-logs` variants, considered separately and also spared

They are excluded by the `mew()` filter, so §2.3 does not reach them. They total 492,812,769 B =
0.46 GiB — **2.3% of the 20.13 GiB**, which does not pay for the risk. And CLAUDE.md holds that the
raw protocol log is the source of truth and the parsed view is the disposable one; deleting the raw
half while keeping the parsed half inverts that. Spared.

### 2.6 What would unblock the reclaim

The dumps are void as GAMES — that part of the brief is right, and ROADMAP #57 owns the re-run. What
is not void is their **existence and their line counts**, which a live instrument reads. So:

1. Re-home MEW's and DODUO's figures into a stamped artifact that carries the counts, rather than
   `readdirSync` + `wc -l` at render time — 586,816 and 194,514 are already measured above and in
   this report;
2. give `games.h2h-tags2.jsonl` and `games.h2h-joint-trained.jsonl` register rows, closing #154;
3. then all 37 are deletable and the reclaim is ~20.1 GiB.

Steps 1 and 2 touch `build/build_status.js` and `data/status.js`, and #154 says explicitly that
**WEB may not touch either** and that neither builder may be deleted on the current reasoning. It is
a MEASURE decision, not a tidy-up, and it was not taken tonight.

**Reclaimed: 0 bytes. Spared: all 37 files, 20.13 GiB.**

---

## 3. What the tree and `.git` measure afterwards

| | before | after my `git add` | at the end of the session |
|---|---:|---:|---:|
| `.git` | 526 MB | **591 MB** | 594 MB |
| pack (`size-pack`) | 524.28 MiB | 524.28 MiB — unmoved | 524.28 MiB — unmoved |
| loose objects | 621.88 KiB | 64.68 MiB | 67.84 MiB |
| working tree, excl. `.git` | 26 GB | 26 GB | 26 GB |

The third column is after another agent's commit `18432bcb` landed on top; the ~3 MB between the
last two columns is theirs, not this change's.

**`.git` moved, by +65 MB, and it is entirely the 19 new shard blobs** written by `git add`
(`games.ots`'s single shard was byte-identical to the old `.gz`, so git recorded a rename and it
cost nothing). The pack is untouched. This is the expected direction and it is a one-off: from here
each ingest run adds ~0.35 MB instead of ~2.28 MB, and no file can approach 100 MB.

**Untracking the three monoliths recovered zero bytes of history**, as §1.7 measures — 137.9 MB of
the pack stays exactly where it is. History cannot be vacuumed. The saving is entirely future.

The working tree did not move, because nothing was deleted: the three retired `.gz` files (84.4 MB)
are still on disk and so are all 37 h2h dumps.

---

## 4. Left in place, reported not touched

- `data/games.ladder.jsonl.gz`, `data/games.bo3.jsonl.gz`, `data/games.ots.jsonl.gz` — 84,435,866 B,
  untracked, no longer written. `build/compress-stores.js` names them on every run so a stale copy
  cannot be mistaken for the current archive; `engine/quality.js` would still read one if the plain
  store went missing, which is the hazard the notice exists for.
- All 37 `data/games.h2h-*.jsonl`, per §2.
- Not inspected and not touched, because live agents hold them: `engine/medicham2-browser.js`,
  `docs/ENGINE.md`, `CLAUDE.md`, `tests/test-docs-current.js`, `build/build_pdfs.js`, and the probe
  files under `tests/`.
