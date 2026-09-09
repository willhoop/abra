# Pre-6.0.0 forensic review — the append-only stores and the pinned authority

Date: 2026-09-09. Read-only. Every figure below was produced by the command quoted beside it, run
against the working tree at `d6789951` (HEAD, `git log -1`) and the Showdown checkout one directory up.
No engine script was run. No handoff document was read as fact. This file is a dated findings record and
is not maintained; the register rows it feeds supersede it.

Conventions. "lines/ids" is `awk` over the blob: total lines, then distinct `"id"` values. "driver active"
means a non-comment `merge=union` line in `.gitattributes` **at that commit** — the comment block that
explains the ban also contains the string, and a naive `grep -c` counts it (that mistake was made and
corrected during this review). "replay" means a commit whose committer date is later than its author date,
which is what `git rebase` produces.

---

## Q1 — data integrity of the append-only stores

### 1a. The incidents, numbered, from history

Method: `git log --all --full-history --format='%h %ad %p %s' -- data/games.ladder.jsonl` for the
commit list, `git cat-file -s <h>:<path>` for sizes, `git show <h>:<path> | awk '{...}'` for lines and
distinct ids, `git show <h>:.gitattributes | grep -vE '^\s*#' | grep -c merge=union` for the driver, and
`git log -1 --format='%p a=%ad c=%cd'` to tell a replay from an original.

The ladder store has 101 commits across all refs (`git log --all --format=%h -- data/games.ladder.jsonl | wc -l`);
only **one** is a merge commit (`git log --all --merges -- data/games.ladder.jsonl`: `1d70e0f6`). The
`merge=union` driver existed from `10116302` (07-24 15:03) to `b6ea2dc9` (07-24 20:32), 5.5 hours.

| # | when (local) | commit | store: parent -> this (lines/ids) | driver active | commit shape | verdict on "union did it" |
|---|---|---|---|---|---|---|
| 1 | 07-24 03:31 | `b66aaecb` | 6539/6539 -> **6645/6639** (+6 dup) | no (12 h before it existed) | single-parent `auto:`; its parent `2f645bed` is a replay (c=03:30) | UNSUPPORTED. Not in the CHANGELOG. |
| 2 | 07-24 15:01 | `e59c3bda` | 6645/6639 -> **7449/7042** (+403 ids, +804 lines = 401 new dup lines) | **no** — `10116302` added it two minutes later, titled "fix: ingest Action push race" | single-parent `auto:`, author = committer | UNSUPPORTED. CHANGELOG 3.0.2 and `.gitattributes` say "from git"; the driver did not yet exist and no merge or rebase commit is involved. |
| 3 | 07-24 15:43 | `072e00d2`, `34532938` | `f12ca301` 7449/7042 -> **14188/7142** (+7046 dup); bo3 3.53 MB -> 5.26 MB, 1492/897 at `1d70e0f6` | **yes** | **replays** (a=03:02/03:05, c=15:43) of two commits rebased onto `f12ca301` | SUPPORTED for `merge=union`-on-rebase. **The merge `1d70e0f6` that CHANGELOG 2.10.0 blamed ("merge -X ours") added exactly 169 lines** (14192 -> 14361, = `895e3c28`'s ingest block) and duplicated nothing. `-X ours` picks a side; it cannot concatenate. |
| 4 | 07-24 18:04 | `71de227c` | `7594fd47` 7716/7716 -> **7948/7547** (+401 dup lines, **-169 ids**) | yes | single-parent original (a=c) | PARTIALLY SUPPORTED. Driver present, but no reconciliation commit exists and the store **lost 169 distinct games** while gaining 401 duplicate lines — the working-tree file was replaced by a different copy, not merged. `push-all.bat` at the time ran `git merge -X ours` (`git show 10116302:push-all.bat`, line 14), which cannot produce this. Mechanism not recoverable from history. This is the "401" that 3.0.2 found. |
| 5 | 07-24 20:12 | `8917698d`, `608288de`; tag `backup-rebase-head-20260724` = `4aba0225` | originals 7948/7547 and 7547/7547 -> replays **16540/8000** and **16139/8000** | yes | 45-commit rebase (every replay c=20:12), stopped at 43 (`4aba0225` 20:18, 16139/8000); the last two carry c=20:21 | SUPPORTED. This is 3.1.2's "16,139 -> 8,000" exactly, and the detached-HEAD-mid-rebase is real: tags `backup-main-20260724` (`dba43794`, 7547/7547) and `backup-rebase-head-20260724` bracket it. Deduped at `d46f90b2` (20:26, 8000/8000); driver removed at `b6ea2dc9` (20:32). |
| 6 | 07-24 21:07 | `ceaf5c1b` | `8678e505` 8356/8356 -> **8757/8356** (+401 dup) | **no** (removed 35 min earlier) | single-parent original | UNSUPPORTED. Not in the CHANGELOG. Repaired at `243bd7e8` (21:10, 8356/8356). The 3.3.0 line "8,757 unique games, 0 duplicates … the `merge=union` removal is holding" is TRUE of `dbdda0b6` (07-25 00:01, 8757/8757) — the same number, a different store, a coincidence. |
| 7 | 07-24 16:03 -> 07-26 | bo3 store | 595 duplicate ids from #3 (`1d70e0f6` 1492/897) persisted through **every** ladder dedupe — 2.10.0, 3.0.2, 3.1.2, `009af264` — until `72066189` (1923/1923) | — | — | Consequence of #3, not a new cause. `dedupe_store.py` was hardcoded to the ladder path (CHANGELOG line 27487). The bo3 store was ~40% duplicate lines for ~2.3 days and nothing said so. |
| 8 | 07-26 12:42 | `6d1a3627` | `f548c5e5` 14447/14447 -> **14931/14794** (+137 dup) | **no** | single-parent original (a=c); `009af264` "dedupe after rebase (137)" follows | UNSUPPORTED. CHANGELOG 3.23.0 already recorded this as the counter-example; confirmed. bo3 at the same commit: 2241/1646 -> 2430/1835, its 595 still untouched. |
| 9 | 07-29 -> 08-21 | (no commits) | `git log --all --format=%ad --date=short --grep='^ingest' \| sort \| uniq -c`: 07-28 has 10 ingest commits, **08-22 is the next day with any** | — | — | Not a duplication. A **24-day hole** in the tracked store, closed by `6ecc96de` "Rescue the store: the only complete copy was on one laptop" (gz 10,553,283 -> 36,225,662 B in one commit). |
| 10 | **09-06 16:25** | **`18432bcb`** | tracked gz at `d2a418a5` (09-06 15:34Z): **88,346 ids** -> shards cut from the local plain file: **76,833 ids** | — | the sharding cutover | **NEW, UNRECORDED, OPEN.** See 1a-bis. |

Not reproduced: CHANGELOG 3.23.0's "a fifth event at depth 14: a commit published a store of 0 lines".
A scan of every commit of all four store paths across all refs found no zero-byte blob
(`for p in …; do git log --all --full-history --format=%h -- $p | while read h; do git cat-file -s …`),
and the depth-14 ancestor of the commit that wrote 3.23.0 (`40ad1fe0` -> `51857c37`) holds
70,278,317 / 17,138,942 / 31,923,870 bytes for ladder / bo3 / ots. The claim's target could not be identified.

Also visible but not a corruption: `7594fd47` -> `71de227c` is the one **shrink in distinct ids** on the
ladder store (7716 -> 7547) in the whole history; the gz era (08-21 -> 09-06, 59 commits) is strictly
monotone in bytes.

#### 1a-bis. The sharding cutover dropped 11,110 ladder games and 4,752 bo3 games from the tracked store

Measured (all `gzip -dc … | grep -oE '"id":"[^"]*"' | sort` then `comm`):

| copy | ladder rows / ids | bo3 rows / ids |
|---|---|---|
| local plain `data/games.ladder.jsonl` (mtime **Sep 4 01:30**, `ls -l`) | 76,833 / 76,833 | 25,522 / 25,522 |
| untracked `data/games.ladder.jsonl.gz` on disk (mtime Sep 6 12:04; 54,323,899 B = blob at `d2a418a5` byte for byte) | **88,346 / 88,346** | **31,286 / 31,286** |
| tracked shards `data/parsed/games.ladder/*.jsonl.gz` at HEAD (22 files, through `20260909T1128`) | 81,269 / 81,269 | 28,049 / 28,049 |

- gz-only (in the last tracked monolith, in no shard): **11,110** ladder, **4,752** bo3.
  shard-only (re-pulled or new since cutover): 4,033 ladder, 1,515 bo3.
  Local plain file ⊂ shards and ⊂ gz on both stores (0 and 0).
- The 11,110 carry `"date"` values from **2026-08-22 to 2026-09-06** — the local plain store had been
  diverging from origin's tracked copy for two weeks, not two days, when it was promoted to the truth.
- `docs/RUNNING-NOTES.md` line 573 row and `docs/_reports/2026-09-06-store-sharding-and-reclaim.md`
  lines 41-56 verified the shards **against the live local file** ("IDENTICAL 12 shard(s) -> 76833 rows")
  and declared "Supersedes. Nothing. No published figure changed value." The comparison that would have
  caught it — shards vs the tracked `.gz` they replaced — was never made. `18432bcb` deleted the monoliths
  (`git show --stat 18432bcb`: `data/games.ladder.jsonl.gz | Bin 54323899 -> 0`) 51 minutes after the runner
  had committed 88,346 games into it (`d2a418a5`, author `abra-bot`, 15:34 +0000; cutover 16:25 -0400).
- Recoverable. History is permanent: `git show d2a418a5:data/games.ladder.jsonl.gz` and
  `git show d2a418a5:data/games.bo3.jsonl.gz` hold every one of them. **3,510 of the 11,110** also have raw
  logs in the tracked `data/raw/games.ladder/2026090[4-6]*` shards (4,006 ids there; `comm -12`); the
  remaining 7,600 exist only as parsed rows.
- The workflow's shrink guard could not see it: its baseline is `wc -l` of the store **restored from shards**
  (`ingest.yml`, "Refuse to proceed if a store shrank"), so a shard set that starts short is the new floor.

### 1b. Does the stated cause hold?

Per incident, above. In aggregate: **six** duplication events on the ladder store. The union driver was
active for three (#3, #4, #5) and a rebase replay is visible for two (#3, #5). **Three** (#2, #6, #8)
occurred with **no driver**, and all four unexplained ones (#1, #2, #4, #6) plus #8 are single-parent,
author-equals-committer commits with no reconciliation in history — so `.gitattributes`' sentence
"Duplicates have only ever entered this repository through git reconciliation" is not demonstrable from
the repository. CHANGELOG 2.10.0's `merge -X ours` diagnosis is UNSUPPORTED (the one merge commit
duplicated nothing); 3.1.2's re-diagnosis is SUPPORTED for #3 and #5 and over-general for the rest.
3.0.2's ordering ("this happened once before, 7,040") is backwards: the first 401 (#2) preceded the 7,046 (#3).

### 1c. What detects corruption today

| check | what it asserts | what it does NOT cover |
|---|---|---|
| `.github/workflows/ingest.yml` "Refuse to proceed if a store shrank" | `wc -l` now >= `wc -l` of the shard-restored base, ladder and bo3; zero-gain and STALE-LADDER exits from `durable-ingest.js` | ids, parse validity, the local machine, and any loss already inside the shards (1a-bis) |
| `engine/durable-ingest.js` lines 642-663 | reads every stored id into a Set before appending; reparse path dedupes (632-638) | does not validate the existing store; no gz/shard agreement |
| `build/compress-stores.js --check` / `--verify-parsed` | shards not behind the local store (row count); reassembly sha256-equal to the local plain file | compares to the LOCAL file only, never to the previously tracked form; a local store with more rows but missing ids passes |
| `engine/sanity_check.py` lines 137-160 (gate, `tests/run-all.js:94`) | full-file duplicate-id and bad-JSON scan of the **ladder** store | bo3, ots, selfplay; and it reads the local plain file, which is 4,436 ids behind HEAD's shards today |
| `engine/validate_selfplay.js` line 184 (gate; exit 2 = SKIP) | `no duplicate ids` on the selfplay store — currently RED on 89 | nothing else |
| `engine/validate_store.js` (gate) | TeamValidator legality; counts unreadable lines (643) | uniqueness |
| `tests/test-parse.js` | pins `extract()` on two fixture logs | the store |
| `engine/dedupe_store.py` | repair tool (called by `quality.js/.py`, `build/publish.sh`, `build/sync.sh`) | not a check |

No check anywhere asserts: tracked-store ⊇ previously-tracked-store; local plain store == HEAD shards;
bo3 id uniqueness; gz/shard integrity except when `--verify-parsed` is run by hand.

### 1d. What else could corrupt the stores undetected — ranked

1. **Promoting a diverged local copy (happened, 1a-bis).** Any path that writes shards from
   `data/games.*.jsonl` on this machine without first `--restore-parsed` from origin. The local file is
   already 4,436 ids behind (76,833 vs 81,269) and every local reader — `quality.js`, `sanity_check.py`,
   `analyze.js` — reads it.
2. **Concurrent ingest.** Runner-vs-runner is serialised (`concurrency: group: ingest`,
   `cancel-in-progress: false`). Runner-vs-local is reconciled on the runner by `reset --hard origin/main`,
   restore, append, dedupe (ingest.yml push loop) — sound, but a local shard pushed first with the same ids
   yields duplicate ids across shards that only `--restore-parsed`'s first-occurrence-wins hides.
3. **Selfplay 89 duplicate ids (ROADMAP #536).** Confirmed on disk: `awk` over `data/games.selfplay.jsonl`
   = 3,090 lines, 3,001 ids, 89 dup. Untracked file; every id-keyed reader drops one of each pair.
4. **A torn shard.** Written by `compress-stores.js`; a killed run leaves a truncated gzip that
   `--restore-parsed` would throw on (loud). The workflow's empty-directory guard does not check integrity.
5. **Rebase replaying an ingest commit.** Shards are write-once new files; a replay re-adds the same blob.
   The plain paths carry `merge=jsonl-store` (`git check-attr -a`), which is now a dead attribute because
   those paths are untracked. Low.
6. **CRLF.** `core.autocrlf=true`; stores have no `eol` attribute (`git check-attr -a` shows only `merge`).
   Irrelevant today: the plain stores are untracked and shards are binary. The ots store is CRLF on all
   4,167 rows (`compress-stores.js` line 65) and is carried as bytes. Low.

### 1e. The 100 MB wall

- `git ls-files -s data/games.ladder.jsonl.gz` -> empty: **untracked since `18432bcb` (2026-09-06)**.
  Last tracked blob `d2a418a5`: `git cat-file -s` = **54,323,899 B**; `ls -l` on disk = 54,323,899 B.
- Growth, last 14 gz commits `bbcc4dbe` (09-03 11:20Z, 50,626,144) -> `d2a418a5` (09-06 15:34Z,
  54,323,899): 3,697,755 B / 3.176 d = **1.164 MB/day**. Whole gz era `6ecc96de` (36,225,662) -> `d2a418a5`:
  18,098,237 B / 15.55 d = 1.164 MB/day. The monolith would have crossed 100,000,000 B on
  **2026-10-15** (39.2 days after 09-06). CLAUDE.md's 10-17 at 1.12 MB/day is within noise.
- Moot. Sharding landed: `data/parsed/games.{ladder,bo3,ots}/` 40 files, 76,160,856 B total; largest
  shard 4,047,741 B (`git ls-tree -r -l HEAD data/parsed | sort -k4 -n | tail -1`), cap 32 MiB of source
  (`SHARD_BYTES`). Raw shards `data/raw/` 40 files, 9,961,339 B, since 09-04 (CHANGELOG 5.244.0).
  The parsed sharding has a RUNNING-NOTES row (line 573, `[Unreleased]`) and **no CHANGELOG entry** yet
  (top is 5.274.0; `grep -n shard CHANGELOG.md` finds only 5.244.0's raw shards). Per-file wall gone; the
  pack still grows ~1.2 MB/day in new blobs.

---

## Q2 — the pinned third-party simulator

### 2a. Which commit

Resolution: `engine/showdown_path.js` — `SHOWDOWN_PATH` if set, else `CANDIDATES[0]` = `../pokemon-showdown`.
No `.env` exists (`ls -a | grep -i env`), `package.json` has no `SHOWDOWN`. Resolves to
`C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

- `git -C ../pokemon-showdown log -1 --format='%H %ad %s' --date=iso`:
  **`20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` 2026-07-22 12:31:13 -0700 "Stop hardcoding grays"**, branch `master`.
- Not a tagged release: `git tag --points-at HEAD` empty; `git describe --tags --always` -> `20ad99f`; the
  repo holds 1 tag.
- Drift, no fetch performed: `rev-list --count HEAD..origin/master` = **72** behind `ecac20e` (2026-08-30);
  `origin/master..HEAD` = 0. `FETCH_HEAD` mtime 2026-08-31 00:45, so true drift is >= 72.
- `git reflog`: cloned 2026-07-24 21:40 at `20ad99f`; every later entry is `reset: moving to HEAD` — the
  checkout has never moved. `dist/` (ignored, `.gitignore:51`) was built 2026-08-03 15:57 from that same
  HEAD; `data/mods/champions/conditions.ts` and `dist/data/mods/champions/conditions.js` both carry
  `randomChance(1, 8)`.

### 2b. Is the hash stamped?

**Yes, and read from git rather than typed.** `engine/champions_sim.js:85` `PINNED_COMMIT`;
`actualCommit()` (line 231-239) runs `git -C <checkout> rev-parse HEAD`; `verify()` returns
`actual_commit` and `commit_matches`. `engine/engine_release.js:353,598-620` writes `showdown_commit`
into `release.json` and every `cuts.jsonl` event: **636 of 636** releases carry it
(`grep -l '"showdown' data/releases/*/*.json | wc -l`), all `20ad99ff…`. The gate artifacts
(`game-differential.json`, `all-mechanics-fire.json`) carry a release id rather than the hash directly
(their `"showdown"` keys are protocol lines). The hash also appears in `docs/ABRA-whitepaper.md`,
`docs/ABRA-technical-docs.md`, `docs/ADR-002-showdown-is-the-authority.md`, CHANGELOG, and 36 reports.

So "matches Showdown" claims are reproducible **as claims about `20ad99f`**. Two gaps:
`commit_matches` has **zero consumers** (`grep -rn commit_matches engine tests build` outside
`champions_sim.js` -> 0), and `engine_release.js:608` only `console.error`s when a tree is re-cut against
a different commit. A moved checkout would be stamped honestly and refused by nothing.

### 2c. Locally modified?

`git -C ../pokemon-showdown status --short` -> empty (0 modified, 0 untracked); `git diff --stat` -> empty.
**Not modified.** `dist/` is a build product of the same HEAD and is ignored.

### 2d. What moves when it moves

Line-number citations of the form `<file>.ts:<n>` (`grep -rhoE '\b[a-z-]+\.ts:[0-9]+'`):
**engine 1,266; tests 965; docs 2,104; build 0.** By target: `battle-actions.ts` 995, `battle.ts` 965,
`moves.ts` 697, `pokemon.ts` 435, `abilities.ts` 369, `scripts.ts` 323, `conditions.ts` 199, `items.ts` 96,
`battle-queue.ts` 85. Heaviest carriers: `engine/medicham2-browser.js` 1,048, `tests/test-mechanics.js` 351,
`engine/tag_dex.js` 82.

Nothing verifies that a cited line still says what the citation claims. `tests/test-target-provenance.js`
checks only that the cited **file** exists (lines 73-80) and labels READ rows "checked by hand, not
self-correcting" (line 121). `tests/probe_red_demo.js`'s anchors are content matches into **our**
simulator (`MEDI_PATH`, lines 97-99), not into Showdown. 13 files open a Showdown `.ts` at run time
(`grep -rlaE "readFileSync\([^)]*(SHOWDOWN|showdown)[^)]*\.ts"`) and assert content, e.g.
`tests/probe_fairy_aura.js:248` and `engine/switchin_order.js:76` read the mod's `abilities.ts` to
confirm an override exists — content checks, not line checks. **Every one of the 4,335 citations is valid
exactly as long as the checkout stays at `20ad99f`**, which nothing enforces (2b).

### 2e. The Champions mod

`ls ../pokemon-showdown/data/mods/champions/`: `abilities.ts conditions.ts formats-data.ts items.ts
learnsets.ts moves.ts rulesets.ts scripts.ts` — the eight CLAUDE.md names.

Code that reads a mainline `data/*.ts` path (`grep -rnaE "['\"\`/](data/)?(abilities|moves|…)\.ts" engine
tests build | grep -v mods/champions`): two code-level readers, both layered correctly —
`engine/derive_protocol_events.js:105-107` scans `sim/*`, then `data/*`, then `data/mods/champions/*`,
tagging each; `engine/fixture_preflight.js:1089-1094` builds a search corpus of both sets. Everything else
is comment-level (385 in `medicham2-browser.js`, 158 in `test-mechanics.js`), usually annotated "no
Champions override". No reader was found that takes a value from mainline where the mod overrides it.

---

## OWED, NOT RUN

Restore the 11,110 + 4,752 games to the tracked shards (ENGINE/OPS owner; run on a clean tree, then
`--verify-parsed`, then commit the new shards only):

```bash
cd /c/Users/willj/Projects/Pokemon/ABRA && git status --short          # must be clean first
node build/compress-stores.js --restore-parsed                          # bring the local plain stores up to HEAD's shards
git show d2a418a5:data/games.ladder.jsonl.gz | gzip -dc >> data/games.ladder.jsonl
git show d2a418a5:data/games.bo3.jsonl.gz    | gzip -dc >> data/games.bo3.jsonl
python engine/dedupe_store.py --write data/games.ladder.jsonl
python engine/dedupe_store.py --write data/games.bo3.jsonl
node build/compress-stores.js                                           # cuts one new shard per store with the recovered rows
node build/compress-stores.js --verify-parsed
python engine/sanity_check.py
```

Prove the recovery closed the gap (expect 0 and 0):

```bash
S=/tmp/x; mkdir -p $S
git show d2a418a5:data/games.ladder.jsonl.gz | gzip -dc | grep -oE '"id":"[^"]*"' | sort > $S/gz.ids
for f in data/parsed/games.ladder/*.jsonl.gz; do gzip -dc "$f"; done | grep -oE '"id":"[^"]*"' | sort > $S/shard.ids
comm -23 $S/gz.ids $S/shard.ids | wc -l
```

Add the missing comparison to the cutover check so it cannot recur (MEASURE): `compress-stores.js --check`
should also assert `ids(HEAD shards) ⊇ ids(previous tracked shards)`, i.e. compare against
`git show HEAD~1` not the local file.

Record the incident: a `docs/RUNNING-NOTES.md` row superseding "Supersedes. Nothing." on the 09-06 sharding
row, a CHANGELOG entry for the sharding itself (none exists), and a ROADMAP row for the 11,110/4,752.

Consume the pin (ENGINE): make something fail when `champions_sim.verify().commit_matches === false`,
and add a `--fail-on-drift` to `engine_release.js cut`. Commands to re-check the checkout at any time:

```bash
git -C ../pokemon-showdown log -1 --format='%H %ad' --date=iso
git -C ../pokemon-showdown status --short
git -C ../pokemon-showdown rev-list --count HEAD..origin/master      # 72 as of the 2026-08-31 fetch; do not fetch without deciding to move the pin
```

Close #536 (OPS): `python engine/dedupe_store.py --write data/games.selfplay.jsonl` is NOT the fix — the
ids collide across two batches with different content; renumber one batch, then
`node engine/validate_selfplay.js`.
