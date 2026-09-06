# Repo cleanup — the 100 MB wall, what history actually costs, and what to stop doing

2026-09-06, MEASURE. Read-mostly pass. **No differential, no census, no roster, no release cut, no
`status.js --write`, no commit, no history rewrite, no force-push.** One write to the repository:
`git gc` (§4). Nothing was deleted.

Three agents were live throughout. `engine/medicham2-browser.js`, `engine/board_state.js`,
`engine/game_differential.js`, `engine/diff_swarm.js`, `CLAUDE.md`, `tests/test-docs-current.js`,
`docs/ENGINE.md` and `docs/MEASURE.md` were not touched.

---

## 0. THE ONE-PARAGRAPH VERSION

The store's `.gz` hits GitHub's hard per-file limit in **41–45 days**. That is real and it kills the
ingest Action when it lands, and the fix is a pattern this repository already built and is already
running on the raw logs. But it is **not** where `.git` went. Post-`gc`, PDFs are **238.7 MB of
502.0 MB of history — 47.6%** — and `docs/ENGINE.pdf` alone is **108.4 MB across ten rebuilds**, the
largest single path in the repository. A version bump costs **15–26 MB of permanent history**, and
**ten bumps landed on 2026-09-06 alone**. The documentation rule change now in flight is worth more
per day than a full history rewrite would recover once.

---

## 1. THE 100 MB WALL — `data/games.ladder.jsonl.gz`

### 1.1 The measurement

Size of the tracked blob at every commit that touched it (`git cat-file -s` on the blob at each
commit, not a guess from the working tree):

| window | from | to | rate |
|---|---|---|---:|
| last 3.5 days | 50,456,453 (09-03 04:38Z) | 54,323,899 (09-06 15:34Z) | **1,119,700 B/day** |
| last 7.4 days | 46,370,795 (08-30 05:29Z) | 54,323,899 | **1,071,900 B/day** |
| last 16 days | 36,225,662 (08-21) | 54,323,899 | **1,131,100 B/day** |

The three agree to within 6%. Take **1.07–1.13 MB/day**, central **1.12 MB/day**. Current size
**54,323,899 bytes = 51.8 MiB**.

### 1.2 The date

| limit | headroom | days | date |
|---|---:|---:|---|
| 100 MB decimal (100,000,000) | 45,676,101 B | **40.8** | **2026-10-17** |
| 100 MiB (104,857,600) — GitHub's documented hard block | 50,533,701 B | **45.1** | **2026-10-21** |

**41 to 45 days.** GitHub's warn threshold (50 MiB) was crossed on ~2026-09-05 and every push is
already producing it.

### 1.3 What the wall actually breaks

Not just a manual push. `.github/workflows/ingest.yml` commits the regenerated `.gz` itself
(`node build/compress-stores.js` at line 255, then the commit step). When the file crosses the
limit, **the collector's own push is rejected and ingest stops** — and it stops the way things stop
in this project, by continuing to report success on every step before the push. `.gitignore` records
that this exact failure was 38 hours away on 2026-07-28 and was met with gzip; gzip has now been
spent.

### 1.4 The options

**Nothing here changes what any analysis reads.** All 60+ files that name `games.ladder.jsonl` read
the **plain** `.jsonl`. The `.gz` exists only as git transport — written by
`build/compress-stores.js`, restored by `gunzip -c` in the workflow (ingest.yml:48, 338–340) and as
a fresh-clone fallback in `engine/quality.js` / `quality.py`. So the representation git carries can
change without touching the store, the schema, or one line of analysis code. "Store raw, analyze on
top" is not merely respected — it is not engaged.

| option | recovers | risk | verdict |
|---|---|---|---|
| **A. Shard the parsed stores, exactly as the raw logs already are** | wall removed permanently; no file ever exceeds ~0.5 MB | low — the code exists and has run since 2026-09-04 | **RECOMMENDED** |
| B. Rotate into `data/archive/` by period | wall removed; but a hand-cut boundary and a bespoke reassembly | medium — a new restore path to get wrong | second best |
| C. Git LFS | wall removed | LFS bandwidth quota, a second auth path in the Action, every clone needs the extension; a quota stall looks exactly like a broken ingest | no |
| D. Drop from the repo, document a rebuild | ~51 MB of tip, ~87 MB of history | **the only copy of the parsed store becomes one laptop.** `.gitignore` already records why that is unacceptable: Showdown's replay pool is a rolling ~1,250 per format and a lost log cannot be re-fetched by anyone | **no** |

### 1.5 The recommendation, in detail — option A

`build/compress-stores.js` already implements write-once dated shards for the raw logs
(`--raw` / `--restore-raw`, `data/raw/<store>/<YYYYMMDDTHHMM>-NN.jsonl.gz`, 20 shards / 5.3 MB in
the tree today). Its own header states the arithmetic that applies verbatim to the parsed stores:

> *"gzip has no append: a single .gz is REWRITTEN WHOLE every run. At a six-hourly cadence that is a
> fresh ~80 MB blob in the pack every time … and git history is not something you can vacuum
> afterwards."*

That reasoning was applied to the raw logs on 2026-09-04 and **not** to the parsed stores, which are
still the monolithic single-member `.gz` the comment warns against. (Confirmed: the tracked file is
one gzip member, so every ingest recompresses all 380 MB from scratch.)

Properties that make it the right call and not merely the convenient one:

- **A shard is never rewritten and never compacted** — the header's own invariant. Git stores each
  exactly once. The 100 MB limit becomes unreachable by construction, not by a margin.
- **Deduped by `id` on both write and restore**, unioned with whatever the laptop already holds, so
  a restore *cannot be a deletion*. Idempotent.
- **Filename order is chronological order**, with a zero-padded sequence number specifically so a
  collision inside one minute cannot replay the archive out of order.
- **The plain `.jsonl` is byte-identical.** Not a re-filter. Not a re-pull. Nothing downstream moves.

Scope of the change: `build/compress-stores.js` (extend the existing shard path from `RAW_STORES` to
`STORES`), `.github/workflows/ingest.yml` (the restore step, ~4 lines), the `.gz` fallback in
`engine/quality.js` and `engine/quality.py`, `.gitignore`, `tests/test-workflow-paths.js`. **Six
files, none of them an analysis path.**

**Risk, stated plainly.** The dangerous half is the cutover: sealing the current 54 MB into shards
and untracking the monolith must produce a restore that is provably identical to the current plain
store. That is checkable before anything is untracked — restore into a temp path and compare line
count and sha256 against `data/games.ladder.jsonl`. Until that comparison is green, nothing is
removed. The monolithic `.gz` should stay tracked through at least one full ingest cycle after the
shards start, so there is a period where both work.

> **NOT EXECUTED. The store is OPS's and this needs Will's decision.** Nothing in §1 was changed.

---

## 2. `data/games.r4-decided.jsonl` — SPARED, AND THE PREMISE IS WRONG

42.9 MB tracked uncompressed. Compressing it was the obvious item and it is the wrong one.

**What it costs in `.git`: 4.1 MB.** Not 42.9. The file was written once (2026-08-04 00:41) and has
never been rewritten, so git holds exactly one zlib-compressed copy at the same ~9% ratio gzip would
achieve. Compressing it saves **≈0 bytes of history** and 40.8 MB of a working checkout.

**What it would cost to compress:**

- `engine/rollout_r4.js:57` — `const CORPUS = argv.find(a => !a.startsWith('--')) || 'data/games.r4-decided.jsonl';` — a plain-path default with no `.gz` fallback.
- `engine/status.js:970–972` mtimes it and prints `node engine/sprt.js data/games.r4-decided.jsonl` as a runnable command. That command would stop working.
- `data/rollout-r4.json:5` names it as `"corpus"`, and `rollout_r4.js` pins its provenance on a **line count** (`5,248 lines`, checked in three places in that file against a published "5,248 games").
- `data/dusk-size-gate.json:12` names it as *"the largest file currently tracked in `data/`"* — the stated basis for that gate's 50 MB budget.

So it is a code change to a **quarantined** R4 reader (`status.js` prints every R4 run as
`PRE-CHANGE`), for zero history benefit, that invalidates a runnable command and a size-gate premise.

**SPARED.** `data/games.r4-baseline.jsonl` (4.5 MB) spared for the same reason.

**Nothing else tracked is worth compressing either.** The remaining uncompressed tracked heavyweights
— `data/_r220-dump-pre.json` / `-post.json` (10.3 MB), `data/leaf-position-contrast-rows-6b0e4117d964.jsonl`
(3.1 MB) — are each named by `data/provenance-stamp.json` and by `docs/ENGINE.md` / `docs/MEASURE.md`,
both of which are owned by live agents. Spared, uninspected further.

---

## 3. THE 36 DEAD ARTIFACTS — RE-VERIFIED, ALL 36 SPARED

`docs/_reports/2026-09-06-comparability-backfill-triage.md` §6c proposes 36 files in
`data/verification/` for deletion, 23.9 MB. I re-derived the citation check independently rather than
taking it on trust: 3,394 files scanned across `engine/ tests/ build/ web/ app/ tools/ docs/ data/
.github/ .claude/` plus the top level, matching the **exact basename including `.json`** and
requiring the match not be a prefix of a longer token. Living-document set from
`engine/docs_scan.js` `livingDocs()` (25 docs), plus the five division ledgers, `CHANGELOG.md`,
`CLAUDE.md` and `docs/ROADMAP.md`. The triage report itself was excluded from the corpus.

### 3.1 Result of the four checks

| check | result |
|---|---|
| cited by a living document | **0 of 36** |
| cited by `engine/status.js`, `provenance.js`, `quarantine.js`, `open_work.js` | **0 of 36** |
| cited by any file in `tests/` | **0 of 36** |
| cited by a register row in `docs/ROADMAP.md` | **0 of 36** |
| **cited by another artifact under `data/`** *(a fifth check the triage did not run)* | **4 of 36** |

The four the triage missed:

| artifact | cited by | as |
|---|---|---|
| `data/verification/gd-endstate-AFTER.json` | `data/verification/gd-endstate-309.json:22977` | `"artifact": "…"` |
| `data/verification/game-differential.punishkinds.json` | `data/verification/2026-09-01-terrain-spread-target-prediction.json:46` | *"the one piece of direct evidence pointing the other way"* |
| `data/verification/game-differential.eterrain-before.json` | `data/verification/game-differential.eterrain.json:33200` | `"artifact": "…"` (before/after pair) |
| `data/verification/leaf-widening-batch2.json` | `data/verification/2026-09-05-leaf-widening-batch2-prediction.json:16` | `"out": "…"` (prediction/receipt pair) |

The last one is the instructive miss: `leaf-widening-batch2` is cited by name in
`docs/ABRA-whitepaper.md`, `docs/ABRA-technical-docs.md`, `docs/ENGINE.md` and `CHANGELOG.md` — but
those cite `docs/_reports/2026-09-05-leaf-widening-batch2.md`, the **report**, not the artifact. A
loose stem match calls that a live citation and it is not one; an exact match with `.json` gets it
right. Both directions of that error are present in this set, so the check has to be exact.

### 3.2 Why all 36 are spared anyway

**Deleting a tracked file recovers zero bytes of `.git`.** History is immutable. And measured:
**the whole of `data/verification/` — 203 files, 96 MB in the working tree — costs 4.9 MB of packed
history**, because these JSONs are highly repetitive and delta almost perfectly. The 36 proposed
files are worth roughly **1.2 MB of `.git` and nothing that a deletion can reach.** The entire prize
is 23.9 MB off a working checkout.

Against that: **an agent wrote `data/verification/_prediction-2026-09-06-stall-residual-foot.json`
into that directory one minute before my scan** (15:22 local; scan at 15:23). Nine of the 36 are less
than 40 hours old and belong to work that is plausibly still in flight. Deleting into a directory a
live agent is writing to, to recover nothing from `.git`, is not a trade worth making.

**SPARED: all 36.** 32 pass all four of the brief's checks and are safe to remove *later*; 4 are
cited by another artifact and should not be removed at all without pairing them with their partner.
The list is §6c of the triage report; the four exceptions are named above. This is a one-command
follow-up for whoever owns `data/verification/` once the ENGINE and MEASURE agents are done, and it
buys 23.9 MB of working tree.

**DELETED: nothing, anywhere in this pass.**

---

## 4. `git gc` — 1037.1 MiB → 525.1 MiB

Plain `git gc`. No `--aggressive`, no `--prune=now`, so unreachable loose objects keep their
two-week grace period. Exit 0.

| | before | after |
|---|---:|---:|
| `.git` on disk | **1,087,480,549 B = 1037.1 MiB** | **550,653,839 B = 525.1 MiB** |
| loose objects | 429 / 321.36 MiB | **0 / 0** |
| packs | 4 | 2 |
| size-pack | 714.23 MiB | 524.28 MiB |

**Recovered: 512.0 MiB, 49.4%.**

**This is larger than it should have been and I will not dress it up as a win.** The brief expected
modest gains and that expectation was right in principle — history is immutable and `gc` cannot
delete a byte of it. What happened is that the repository was **badly fragmented**: 321 MiB of loose
objects had never been packed, and the remaining content sat in four separate packs, so blobs that
delta against each other could not, because delta chains do not cross a pack boundary. Repacking
into two packs let the store's `.gz` versions delta against each other for the first time. Nothing
was deleted; the same content is simply stored properly.

The corollary is that **this does not recur.** A second `gc` recovers approximately nothing. The
512 MiB was a one-time debt, not a recurring lever.

**It also invalidated my own earlier figures**, which is worth recording because the pre-`gc` numbers
were badly misleading. Every figure in §5 and §6 below is post-`gc` and settled.

| path | pre-`gc` history | post-`gc` history |
|---|---:|---:|
| `data/games.ladder.jsonl.gz` | 281.9 MB | **87.2 MB** |
| `data/games.bo3.jsonl.gz` | 133.7 MB | **41.0 MB** |
| all `.pdf` | 263.4 MB | **238.7 MB** |
| all blobs | 857.8 MB | **502.0 MB** |

---

## 5. HISTORY REWRITE — COSTED, NOT PLANNED. **THIS IS WILL'S DECISION.**

Not run. No `filter-repo`, no BFG, no `filter-branch`, no force-push.

### 5.1 What is actually in the 525 MiB

Post-`gc`, by path, and split into **the tip you must keep** versus **the history a rewrite could
drop**:

| path | total history | tip alone | droppable |
|---|---:|---:|---:|
| `docs/ENGINE.pdf` (10 versions) | 108.4 MB | 13 MB | **95 MB** |
| **all `docs/**/*.pdf`** (105 files, 147 versions) | **238.7 MB** | **39.8 MB** | **199 MB** |
| `data/games.ladder.jsonl.gz` (59 versions) | 87.2 MB | 51 MB | 36 MB |
| `data/games.bo3.jsonl.gz` (59 versions) | 41.0 MB | 25 MB | 16 MB |
| `data/games.ladder.jsonl` (101 versions, now untracked) | 46.1 MB | 0 | **46.1 MB** |
| `data/games.bo3.jsonl` (now untracked) | 10.4 MB | 0 | **10.4 MB** |
| all `.md` | 7.6 MB | — | small |
| **all blobs** | **502.0 MB** | | |

**Correction to the brief's premise.** The brief says history is dominated by ~30 versions of
`data/games.ladder.jsonl` at 70–85 MB each. Those versions exist, but they cost **46.1 MB in total**,
not ~2 GB: append-only text deltas near-perfectly. Likewise the store's `.gz` is far cheaper than it
looks — 58 historical versions cost **36 MB**, about 0.6 MB each, because the tip blob (51 MB) is
almost the whole of its 87.2 MB. **The stores are not the history problem. The PDFs are.**

### 5.2 What a rewrite would recover

Dropping all PDF history except the tip, all store `.gz` history except the tip, and the two
now-untracked plain `.jsonl` stores entirely:

**≈ 300 MB. `.git` would go from 525 MiB to roughly 225 MiB.**

### 5.3 What it would break

- **Every commit hash in the repository changes.** Measured: **271 distinct hex tokens in tracked
  markdown resolve to real commits today** (1,108 unique hex tokens scanned; the other 831 are
  release ids and digests). Every one of those citations — in `CHANGELOG.md`, the white paper, the
  ledgers, `docs/_reports/` — becomes a dangling reference to an object that no longer exists. This
  repository's documents cite commit hashes as evidence, and a rewrite converts that evidence into
  unverifiable strings. There is no fixup pass that is safe: a rewritten hash cannot be
  distinguished from a typo.
- **Every existing clone is invalidated**, including any CI cache and any subagent worktree under
  `.claude/worktrees/`.
- **It requires a force-push to `main`**, on a repository whose CLAUDE.md records reaching a detached
  HEAD 43 commits into a 45-commit rebase.
- **The ingest Action must be stopped for the duration**, or it commits onto the old history and the
  force-push destroys those games.
- **`data/releases/` reasoning is unaffected** (release ids are content digests, not commit hashes),
  but `data/provenance-stamp.json` and any artifact recording a commit would need re-checking.

### 5.4 The honest comparison

A rewrite recovers ~300 MB **once**, at the cost of 271 broken evidence citations and a force-push.
§6 stops ~200 MB **per day** at the current cadence, breaks nothing, and needs no coordination.

**Recommendation: do not rewrite. Do §6 instead.** Revisit only if `.git` becomes an operational
problem after §1 and §6 are in place — and if it does, the target is `docs/ENGINE.pdf`, not the
store.

---

## 6. WHAT STOPS FUTURE GROWTH — THE LARGEST LEVER IN THIS REPORT

§4 recovered past growth once. This is the recurring number.

### 6.1 A version bump costs 15–26 MB of permanent history

Packed cost of the PDFs written by each of the last twelve PDF-rebuilding commits:

| date | history added | PDFs rebuilt |
|---|---:|---:|
| 2026-09-06 | **25.9 MB** | 12 |
| 2026-09-06 | 21.5 MB | 13 |
| 2026-09-06 | 21.4 MB | 11 |
| 2026-09-06 | 21.2 MB | 13 |
| 2026-09-06 | 22.5 MB | 12 |
| 2026-09-06 | 6.4 MB | 14 |
| 2026-09-06 | 16.4 MB | 7 |
| 2026-09-06 | 5.0 MB | 7 |
| 2026-09-06 | 4.8 MB | 25 |
| 2026-09-06 | 20.7 MB | 11 |
| 2026-08-28 | 15.7 MB | 10 |
| 2026-08-06 | 0.1 MB | 1 |

**Ten of those landed on 2026-09-06 alone: ≈166 MB of permanent history in one day.** For comparison,
the two game stores add **≈7.6 MB/day** combined (ladder 0.6 MB × ~3.5 ingest commits, bo3 0.7 MB ×
~3.5). **PDF rebuilds cost roughly twenty times what the ladder collector costs.**

### 6.2 Where it goes — the most recent bump, `d7ed4b75`

| | packed |
|---|---:|
| `docs/ENGINE.pdf` | **13.86 MB** |
| `docs/ROADMAP.pdf` | 3.90 MB |
| `docs/MEASURE.pdf` | 2.41 MB |
| `docs/ABRA-WhitePaper.pdf` | 1.32 MB |
| `docs/ABRA-technical-docs.pdf` | 1.27 MB |
| `docs/MODELS.pdf` | 1.05 MB |
| the other six | 1.47 MB |
| **total** | **25.9 MB** |

**`docs/ENGINE.pdf` is 54% of a bump on its own.** It is 28.8 MB in the tree because `docs/ENGINE.md`
is 2.9 MB of append-only markdown that is never archived. `docs/MEASURE.md` is on the same trajectory
at 576 KB. PDFs do not delta — each rebuild is a fresh, effectively incompressible blob.

### 6.3 What the rule change in flight is worth

Full PDF set on major releases only, with a notes page in between:

- **~21 MB per bump avoided** (median of the table above), **~13.9 MB of it from `ENGINE.pdf` alone**.
- At 2026-09-06's cadence of ten bumps: **~210 MB/day**.
- At a more typical two or three bumps a day: **~40–60 MB/day**.

**Either figure exceeds what a full history rewrite recovers, within a week or two.** This is the
single highest-value item in the report and it costs nothing but a rule.

### 6.4 Two cheaper additions, in order of value

1. **Keep `docs/ENGINE.pdf` out of the routine bump specifically**, even when other PDFs are built.
   13.9 MB per bump, one file, no rule change needed beyond the one already in flight.
2. **`data/verification/` is not a growth problem** and should not be treated as one: 96 MB in the
   tree, **4.9 MB in all of history**. An arm every 30 minutes costs ~25 KB of history. Leave it
   alone.

---

## 7. REPORTED AND LEFT — NOT DELETED, NOT TOUCHED

Per CLAUDE.md: an untracked file is unrecoverable, so it is reported, never removed.

### 7.1 The biggest item on this disk is not in git at all

**The working tree is 27 GB. `data/` is 26 GB. `data/*.jsonl` alone is 22.3 GB — untracked and
gitignored.**

| family | on disk | dates |
|---|---:|---|
| `data/games.h2h-*.jsonl` (+ their `.raw-logs`) | **20.78 GB** | 2026-07-29 → 2026-08-14 |
| `data/games.*raw-logs.jsonl` (ladder/bo3 archives) | 0.56 GB | live |
| `data/games.selfplay*.jsonl` | 0.25 GB | 2026-07-28 → 08-19 |
| `data/games.r4*.jsonl` | 0.10 GB | 2026-08 |
| everything else | 0.61 GB | |

Largest single files: `games.h2h-tags2.jsonl` **5.27 GB**, `games.h2h-refit.jsonl` **2.63 GB**,
`games.h2h-joint-trained.jsonl` **1.56 GB**, then five more over 1 GB each.

`.gitignore` already classifies this family as *"Large, regenerable from the seed recorded in every
record, and not a durable store"* and records a 2026-07-31 audit finding 23.7 GB of it. It is
20.78 GB now, all of it from head-to-head runs that are themselves quarantined
(`status.js` prints every R4/H2H result as `PRE-CHANGE`).

**This is ~40× the entire `.git` saving, and it is one `rm` away — which is exactly why it is not
mine to run.** These are untracked: a wrong call is permanent. They belong to SEARCH. **Reported,
left in place.** If Will wants the disk back, this is the item, and the safe order is: confirm with
SEARCH that no arm table still reads one, then delete the `h2h` family only.

### 7.2 Other debris, reported and left

- **`tmpprobe/`** — 46 files, 4.1 MB, untracked and gitignored. Left untouched per the brief.
- **`data/games.ladder.jsonl.bak`** — untracked, 4.1 MB in history from when it was tracked. Left.
- **`data/games.h2h-clickmatch.jsonl`, `…-greedylever*`, `…-switchlever*`** and ~20 similar — all
  inside the 20.78 GB above.
- **`docs/MEASURE.md` is 576 KB and `docs/ENGINE.md` is 2.9 MB** of append-only prose. Both are owned
  by live agents and were not touched. They are the *cause* of §6.2 and archiving their closed
  sections is the durable fix, but that is an ENGINE/MEASURE call, not a cleanup call.

---

## 8. WHAT THIS PASS DID NOT DO

- **Deleted nothing.** Not one file, tracked or untracked.
- **No history rewrite**, no force-push, no `filter-repo`.
- **No store change.** §1 is a proposal awaiting Will.
- **No commit.** The working tree is as I found it apart from `git gc`, which changes no file.
- **`data/winrate-backtest.json` and leaf calibration are not in this report.** The standing MEASURE
  brief is untouched by anything here; the gate is still shut on the board-material clause.
- **No noise floor was measured for any figure above.** The sizes are exact byte counts, not
  estimates, so a noise floor does not apply — but the *rate* projections in §1.2 and §6.3 are
  extrapolations from three overlapping windows and should be re-read from the artifact, not from
  this file, once a week has passed.
