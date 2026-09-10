# 2026-09-09 — the 56 MB raw shard, the store behind its shards, two mojibake winners, one silent `-fail`

MEASURE. Store safety only; nothing here played a game. No commit was made; the coordinator commits.
This is a dated findings record, never maintained, superseded by the register rows it feeds.

Files changed: `build/compress-stores.js`, `engine/gate_fail_and_silent.js`. Files rewritten but
gitignored: `data/games.ladder.jsonl`, `data/games.bo3.jsonl`, `data/games.ots.jsonl` (via
`--restore-parsed`, byte-identical to the tracked shards). No tracked shard was touched; no new
shard was written.

---

## 1. The 56 MB raw shard and the cap

### Measurement

`data/raw/games.ladder/20260909T2052-00.jsonl.gz`, committed in `71771f0b`:

| | |
|---|---|
| gzipped | **58,753,177 B** (56.03 MiB) |
| source (gunzipped) | **411,333,183 B** (392.3 MiB) |
| rows | **76,741** logs |
| ratio | 14.3 % |
| mean row | 5,360 B |

That is not the 11,110 recovered games. It is the whole ladder raw archive: the 21 earlier dated
shards (2026-09-04 → 2026-09-09) held only the hourly increments since raw sharding began, so the
first `--raw` run over the full local `data/games.ladder.raw-logs.jsonl` found 76,741 ids no shard
had and wrote every one of them into ONE file.

### Does `--raw` apply any cap? No.

Read from `build/compress-stores.js` at HEAD: the parsed writer accumulates `chunk`/`chunkBytes`
and flushes at `SHARD_BYTES = 32 * 1024 * 1024` of SOURCE, writing `-00`, `-01`, …. The `--raw`
writer did `Buffer.from(fresh.join('\n') + '\n')` and one `writeFileSync` — no accumulator, no
constant, one shard per run regardless of size. `SHARD_BYTES` was also declared AFTER the `--raw`
block (a `const` in its temporal dead zone), so the raw path could not even have read it.

### Decision: the same 32 MiB of SOURCE, one constant for both writers

Not a compressed-size cap. Reasons:

- A compressed-size cap needs the bytes compressed before the cut point is known — a second pass or
  a streaming deflate with flush points — for no gain.
- gzip cannot expand text by more than ~0.03 %, so 32 MiB of source is a hard ceiling of ~33.6 MB
  compressed even if compression collapsed to nothing. That is already under the 50 MB warning.
- At the measured 14.3 % a full shard is ~4.6 MB.
- Two caps drift exactly as two lists do. One constant, hoisted above both writers, with the
  measurement in its comment.

Under this cap the same 76,741-log run would have written 13 shards (12 × 32 MiB + 1 × 8 MiB of
source), ~4.6 MB each.

### Red → green, on a scratch copy, no tracked shard touched

Synthetic archive: 8,000 rows of protocol-shaped JSON, 38,392,000 B (36.6 MiB) — over the cap.

**RED** — `git show HEAD:build/compress-stores.js` run in a scratch tree:

```
games.ladder.raw-logs.jsonl  +8000 log(s) -> raw\games.ladder\20260909T2246-00.jsonl.gz  36.6 MB -> 0.2 MB
1 raw shard(s) written.
```

One shard from 36.6 MiB of source. That is the defect.

**GREEN** — the patched file, same archive, fresh scratch tree:

```
games.ladder.raw-logs.jsonl  6992 log(s) -> raw\games.ladder\20260909T2250-00.jsonl.gz  32.0 MB -> 0.2 MB
games.ladder.raw-logs.jsonl  1008 log(s) -> raw\games.ladder\20260909T2250-01.jsonl.gz   4.6 MB -> 0.0 MB
games.ladder.raw-logs.jsonl  +8000 log(s) sharded into 2 shard(s), 36.6 MB of source -> 0.2 MB
```

Gunzipped: `-00` = 33,554,608 B / 6,992 rows, `-01` = 4,837,392 B / 1,008 rows. Both ≤ cap (+ one
row of overshoot, exactly as the parsed writer flushes at `>=`).

**Restore is a set, and it is also byte-identical here.** Plain archive moved aside so the union
could not help, `--restore-raw` from the two shards alone:

```
sha256 original  f3738baafed278041541cf428104601562089c4f0598b4e2ee9f7a6f3105f1bb
sha256 restored  f3738baafed278041541cf428104601562089c4f0598b4e2ee9f7a6f3105f1bb
```

**Real tree, patched code, `--raw` under lownode (heap 5120 MB):**

```
games.ladder.raw-logs.jsonl                        up to date (84832 logs across 23 shard(s))
games.bo3.raw-logs.jsonl                           up to date (29824 logs across 23 shard(s))
games.gen9championsvgc2026regmabo3.raw-logs.jsonl  up to date (51 logs across 1 shard(s))
games.gen9championsvgc2026regmc.raw-logs.jsonl     up to date (1412 logs across 2 shard(s))
games.gen9championsvgc2026regmcbo3.raw-logs.jsonl  up to date (727 logs across 2 shard(s))
0 raw shard(s) written.
```

No new raw shard. `git status` shows nothing under `data/raw/`.

**The 56 MB shard stays.** History is permanent; re-cutting it would add 13 new blobs and recover
nothing. It is under the 100 MB wall and above the 50 MB warning, and that is the whole of its cost.

### Growth budget at ~176 games/h bo1 (Reg M-C)

Using the measured mean raw row of 5,360 B and 14.3 %:

| | source | gzipped |
|---|---|---|
| per hourly run (176 logs) | 0.94 MB | ~135 KB → **1 shard/run, 24 shards/day** |
| per day (4,224 logs) | 22.6 MB | ~3.2 MB |
| a run reaches the cap only at ≥ 6,260 logs in one run | = 35.6 h of backlog | the shard is then ~4.6 MB |
| theoretical worst case, zero compression | 32 MiB | 33.6 MB |

**No single shard is ever near 50 MB under the cap.** The ceiling is ~33.6 MB and only if gzip
achieved nothing on text; the realistic maximum is ~4.6–4.8 MB. The only quantity that grows without
bound is the shard COUNT — ~8,760/year/store in one directory at hourly cadence — which is a
directory-size and tree-object cost, not a per-file wall.

---

## 2. `tests/test-workflow-paths.js` — the local plain store was BEHIND

`node build/compress-stores.js --check` (lownode):

```
games.ladder.jsonl   REFUSING TO SHARD — the tracked shards hold MORE records than the local store: 92431 vs 92379.
```

The shrink guard, not the stale clause: the recovery and the Reg M-C pulls landed in the tracked
shards and the local plain file had not been reconciled. So `--restore-parsed`, then `--verify-parsed`:

```
games.ladder.jsonl   27 shard(s) -> 92431 rows  459.1 MB
games.ots.jsonl       1 shard(s) ->  4167 rows   30.4 MB
games.bo3.jsonl      21 shard(s) -> 32810 rows  284.6 MB

games.ladder.jsonl   IDENTICAL  27 shard(s) -> 92431 rows, 481449982 B, sha256 473cd94e4e130baf
games.ots.jsonl      IDENTICAL   1 shard(s) ->  4167 rows,  31928037 B, sha256 cd21077a4578afa3
games.bo3.jsonl      IDENTICAL  21 shard(s) -> 32810 rows, 298393976 B, sha256 79cef9b5cfda0173
```

No local-only rows were reported, so nothing needed sharding and **no new parsed shard was written**.

```
WORKFLOW PATHS: 6 passed, 0 failed     (was 5 passed, 1 failed)
```

Observation, not acted on: the ladder PARSED store carries 92,431 rows and the ladder RAW shards
carry 84,832 logs. 7,599 parsed rows have no raw log in the archive — presumably part of the
recovery, which came from the tracked parsed monolith rather than from raw logs. The raw log is the
declared source of truth, so this gap is worth a row of its own (see OWED).

---

## 3. `engine/sanity_check.py` — the two winners that are neither player

Scan of `data/games.ladder.jsonl` (92,379 rows at the time; the same two after the restore):

| id | date | `winner` | `p1.name` | `p2.name` |
|---|---|---|---|---|
| `gen9championsvgc2026regmb-2662690089` | 2026-08-10 12:55 | `blackred123永雏���菲侠` | `blackred123永雏塔菲侠` | `MadMax_1704` |
| `gen9championsvgc2026regmb-2672145722` | 2026-08-28 23:32 | `It��sJustKen VGC` | `It’sJustKen VGC` | `mythofoxical` |

The raw lines, from `data/games.ladder.raw-logs.jsonl` (lines 45,950 and 64,598), hex-dumped:

```
|player|p1|blackred123永雏塔菲侠|iono-masters|1484     ... e6b0b8 e99b8f e5a194 e88fb2 e4bea0 ...
|win|blackred123永雏���菲侠                            ... e6b0b8 e99b8f efbfbd efbfbd efbfbd e88fb2 e4bea0
|raw|blackred123永雏塔菲侠's rating: 1484 &rarr; ...    (clean again)

|player|p1|It’sJustKen VGC|170|                          ... 4974 e28099 73 ...
|win|It��sJustKen VGC                                    ... 4974 efbfbd efbfbd 73 ...
```

`efbfbd` is U+FFFD. It sits ONLY in the `|win|` line; the `|player|`, `|j|` and `|raw|` lines around
it carry the correct bytes. 塔 (`e5 a1 94`) became three U+FFFD and ’ (`e2 80 99`) became two — the
exact signature of a multi-byte sequence split across two HTTP chunks and decoded chunk-by-chunk.

**Cause: the fetch, not the extractor, and it is already fixed.** `engine/durable-ingest.js:43-62`
records that MEASURE found this on 2026-08-28 chasing this same clause — `x.on('data', c => d += c)`
called `Buffer#toString` per chunk — and that `x.setEncoding('utf8')` was added. The header names
these two ids as the measured blast radius. The extractor (`|win|(.*)` at line 477) read the line it
was given correctly; the line was already wrong when it reached the raw store.

**Not a bad row to mark, and not deletable — a re-fetch heals it.** Fetched today:

```
replay.pokemonshowdown.com/gen9championsvgc2026regmb-2662690089.json  |win|blackred123永雏塔菲侠   (0 U+FFFD in the log)
replay.pokemonshowdown.com/gen9championsvgc2026regmb-2672145722.json  |win|It’sJustKen VGC          (0 U+FFFD in the log)
```

Showdown serves both replays clean. The store is append-only and deduped by id, so a normal ingest
will skip them as present; healing them is a deliberate two-row replace of BOTH the parsed row and
the raw log, by whoever owns `durable-ingest.js` (OPS/ENGINE). The header also records 194 raw logs
carrying 496 U+FFFD in nicknames/usernames from the same defect; those do not trip this clause but
are the same repair. Card:

> **CARD (OPS/ENGINE, durable-ingest owner).** Two ladder rows have `winner` ≠ either player because
> the pre-2026-08-28 fetch decoded HTTP chunks separately and split a multi-byte character in the
> `|win|` line. Ids `gen9championsvgc2026regmb-2662690089`, `gen9championsvgc2026regmb-2672145722`.
> Showdown serves both clean today. Fix = re-fetch and replace the two parsed rows and the two raw
> logs (a raw shard is write-once, so the corrected raw log is a NEW shard and `--restore-raw`'s
> first-occurrence-wins must be reconsidered for a correction — or the correction lands in the
> plain archive and the old shard is left as history). Do not delete rows. `sanity_check.py`
> `store shape: the winner is always one of the two players` goes 2 → 0 on that repair and on
> nothing else.

---

## 4. `engine/gate_fail_and_silent.js` — exit 1, one cause, and a pin nothing could reach

Run before any change:

```
artifact  data/game-differential.json   generated 2026-09-09T21:46:58.736Z   release b0f5c159c46e
sample    pinned: census 2e3953f1f882 / pool 631d4ea60a80 / 995 games
          this run: census 098de5770623 / pool 0d103fb9fa87 / 961 games   -> A DIFFERENT SAMPLE
LIVE   1 cause(s) over 1 game(s)
       1  event missing from medicham2 :: |-fail|p2a <> |move|p2b|rockslide
exit 1
```

Exit 1 is VERDICT-RED, not exit 2. The gate can answer; it answers that the class is not empty.

### Classification

**(a) The one cause — ENGINE defect, narration-only. Card, not fixed here.**

`first_divergences[9]`: config `pair-protect-bust`, seed
`gen9championsvgc2026regmbbo3-2654619049 vs gen9championsvgc2026regmbbo3-2654751965`, turn 4,
48 agreed lines then:

```
showdown_before:  |move|p1b: Hydreigon|Dark Pulse|p2a: Rotom
                  |-damage|p2a: Rotom|59/125
                  |move|p2a: Rotom|Trick||[still]
showdown:         |-fail|p2a: Rotom
medicham:         |move|p2b: Garchomp|rockslide|p1a: Metagross
```

Showdown has Rotom-Heat's Trick fail with an empty target slot and `[still]`, then announces
`-fail`. This engine agrees the Trick line and says nothing about the failure — the next thing it
emits is the next move. `end_state.by_cause[9]`: `board_never_parted: 1`, `SAME-END-STATE: 1`,
`materiality: NARRATION-ONLY`. Not the instrument: the comparator lined a real authority `-fail`
against our next line, which is exactly the class definition. Not a stale expectation: the class is
meant to be zero.

> **CARD (ENGINE / narration).** Trick fails on the authority (`|move|p2a: Rotom|Trick||[still]`
> then `|-fail|p2a: Rotom`, Rotom-Heat at 59/125 after Dark Pulse, turn 4, config
> `pair-protect-bust`, seeds above, release `b0f5c159c46e`, artifact generated
> 2026-09-09T21:46:58Z). medicham2 emits no `-fail`. Board never parted; same end state. Which Trick
> failure condition fired is ENGINE's to read from the format, not typed here. `--dump-games` on the
> pinned run reproduces it.

**(b) The pin — stale expectation on the INSTRUMENT. Fixed.**

`PIN = 30` was stamped to `census 2e3953f1f882 / pool 631d4ea60a80 / 995 games` — a LIVE-pool
sample from 2026-08-18 that no run can reproduce since the differential moved to
`data/team-pool-frozen` and a pinned census. Every run since has printed `A DIFFERENT SAMPLE`, so the
REGRESSION branch (exit 3) was unreachable: a pin nothing can ever exceed is not a ratchet. Re-seeded
to the reproducible sample, with the decision dated and owned in `PIN_NOTE`:

```
PIN = 1;  SAMPLE = { census: '098de5770623', pool: '0d103fb9fa87', games: 961 }
```

After: `--selftest` 23 passed, 0 failed. Live run: `SAME SAMPLE, a movement is attributable`,
`LIVE 1 cause(s) over 1 game(s)`, exit 1. The verdict did not move — it must not; the class is not
empty — but a second cause on the pinned sample is now exit 3 REGRESSION by name instead of being
folded into the same red. NOT a before/after against 30: the population and the engine both moved.

**(c) Exit 2.** Not what this run means. Exit 2 would mean the artifact could not be read, has no
`classes`, or was measured against other bytes than `data/engine-release.json` names. The artifact
is on `b0f5c159c46e` and so is the tree.

---

## Proposed rows (NOT written — the coordinator writes them)

**RUNNING-NOTES row.**
> `build/compress-stores.js --raw` now caps a raw shard at `SHARD_BYTES` (32 MiB of source) and
> splits into `-00`, `-01`, … exactly as the parsed writer does; before, one run wrote one shard of
> any size, and `data/raw/games.ladder/20260909T2052-00.jsonl.gz` (71771f0b) is 58,753,177 B from
> 411,333,183 B / 76,741 logs — over GitHub's 50 MB warning, under the 100 MB wall, kept. Shown red
> (HEAD: 1 shard from 36.6 MiB) then green (2 shards, 32.00 + 4.61 MiB; `--restore-raw` from the
> shards alone sha256-identical). Real tree: 0 new shards, every raw store up to date. Growth budget
> at 176 games/h: 24 shards/day, ~135 KB each; worst case 33.6 MB. `engine/gate_fail_and_silent.js`
> pin re-seeded 30 → 1 on the pinned sample (`098de5770623` / `0d103fb9fa87` / 961) so exit 3 is
> reachable again; verdict unchanged at LIVE. `--restore-parsed` reconciled the local ladder store
> 92,379 → 92,431; `test-workflow-paths` 5/1 → 6/0. **Supersedes.** Nothing. **Basis.** unchanged.
> Account: `docs/_reports/2026-09-09-raw-shard-cap.md`.

**CHANGELOG bullet (Fixed).**
> `build/compress-stores.js --raw` caps a raw shard at the same 32 MiB of source as the parsed
> writer and splits into numbered shards; the 56 MB single-shard write of 2026-09-09 cannot recur.
> `engine/gate_fail_and_silent.js` pin re-seeded to the reproducible pinned sample.

**ROADMAP row.**
> **Raw shards cap at `SHARD_BYTES`.** DEFECT: `--raw` wrote one shard per run of unbounded size;
> the first full-archive run produced a 56.03 MB blob (71771f0b). FIX: shared `SHARD_BYTES`, chunked
> writer. VERIFIED BY: scratch red→green in `docs/_reports/2026-09-09-raw-shard-cap.md`; a synthetic
> archive over the cap yields ≥ 2 shards and restores sha256-identical. STATUS: fixed, uncommitted.

---

## OWED, NOT RUN

- **The two mojibake rows** — re-fetch and replace (OPS/ENGINE card above). `sanity_check.py` stays
  red at 2 until then. Nothing was deleted or marked.
- **The Trick `-fail` narration** — ENGINE card above. The gate stays exit 1 until the class is empty.
- **The first CI pass through the 56 MB shard.** `ingest.yml` runs `--restore-raw` before ingest and
  `--raw` after, and both gunzip every ladder raw shard to a 411 MB UTF-8 string and split it. No
  CI run has executed since 71771f0b. Locally this run was given `--max-old-space-size=5120`; the
  default heap was not measured. If the runner OOMs the raw step, the shape is exit 134 in a
  workflow, not a data loss — but it is worth watching the next hourly run. The durable fix is the
  Buffer-streaming path the parsed writer already uses (`linesOf`/`idOfBuf`), applied to `--raw`
  and `--restore-raw`.
- **7,599 ladder rows with no raw log** (92,431 parsed vs 84,832 raw). The raw log is the declared
  source of truth; a row without one cannot be reparsed. Owed a register row and a count of which ids.
- **194 raw logs / 496 U+FFFD in nicknames** from the same fetch defect, recorded in the
  `durable-ingest.js` header — the same re-fetch repair, wider.
- `node engine/status.js --write`, `tests/run-all.js`, a full `sanity_check.py` re-run, any
  differential — not run, per the brief.
- Not mine, left in place: `tests/probe_screens_infiltrator.js` (untracked) and the modified
  roster / medicham2 / test files in `git status` are another division's live work.
