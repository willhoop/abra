# 2026-09-10 — ROADMAP #558, the two ladder winners that are neither player: REPAIR REFUSED

MEASURE. Historical findings record (`docs/_reports/`), not maintained, not current state.

## Verdict

**Refused. Nothing in the store was written.** The two replays re-fetch clean and the corrected rows
are ready. The repository's store tooling, however, cannot express a CORRECTION. Every route through
`build/compress-stores.js` either keeps the corrupt copy or breaks the hourly ingest. That was shown on
a scratch copy running the unmodified tool, not argued from the code. The register's stated fix ("the
corrected raw log goes into a NEW shard, reconciled with `--restore-raw`") does not reconcile: `--raw`
will not write that shard, and `--restore-raw` discards it if it is placed by hand.

A second finding changes the definition of done. **`engine/sanity_check.py` cannot go green on this
repair.** It fails two clauses, and #558 owns only one of them. The other is
`gen9championsvgc2026regmb-2676161109` (`brought` = 6 on both sides), which ROADMAP #550 carries as
still open. Expected after a completed #558 repair: `95 passed, 1 failed`.

## Baselines (taken before anything, and re-taken at the end: identical)

| | before | after |
|---|---|---|
| HEAD | `1b009d54` | `1b009d54` |
| `data/games.ladder.jsonl` | 92,594 lines, 482,549,325 B, mtime 2026-09-10 22:14:07 | same bytes, same mtime |
| `data/parsed/games.ladder/` | 31 shards, 92,594 rows, 92,594 distinct ids | unchanged |
| `data/raw/games.ladder/` (the tracked raw store) | 27 shards, 84,995 logs, 84,995 distinct ids | unchanged |
| `data/games.ladder.raw-logs.jsonl` (local plain, untracked) | 77,235 lines, mtime 2026-09-04 | unchanged |
| `node build/compress-stores.js --check` | exit 0, "every store row is carried by a shard." (ladder 92,594 / ots 4,167 / bo3 32,857) | exit 0 (run by the workflow-paths test) |
| `node tests/test-workflow-paths.js` | — | 6 passed, 0 failed |
| `python engine/sanity_check.py` | 94 passed, 2 failed | 94 passed, 2 failed |
| `node engine/validate_store.js` | exit 0 (ladder 92,594 lines judged) | not re-run: nothing was written |

The plain raw archive on this laptop is 7,760 logs behind the tracked raw shards. That is local state
and not part of this repair; `--restore-raw` is a union and would reconcile it.

## Where the corrupt copies live

| id | parsed shard (line) | plain store line | raw shard (line) | plain raw line |
|---|---|---|---|---|
| `…-2662690089` | `parsed/games.ladder/20260906T1954-06.jsonl.gz` (5,528) | 51,739 | `raw/games.ladder/20260909T2052-00.jsonl.gz` (45,549) | 45,950 |
| `…-2672145722` | `parsed/games.ladder/20260906T1954-10.jsonl.gz` (1,552) | 70,857 | `raw/games.ladder/20260909T2052-00.jsonl.gz` (64,197) | 64,598 |

Each copy is corrupt in all four places (3 and 2 U+FFFD, respectively). No clean copy of either
game exists anywhere in the repository.

## The re-fetch (two requests to replay.pokemonshowdown.com, `setEncoding('utf8')` as the ingest does)

| id | HTTP | U+FFFD in body | `|player|` p1 / p2 | `|win|` | winner ∈ players | `uploadtime` stored / fetched |
|---|---|---|---|---|---|---|
| `…-2662690089` | 200 | 0 | `blackred123永雏塔菲侠` / `MadMax_1704` | `blackred123永雏塔菲侠` | yes | 1786366510 / 1786366510 |
| `…-2672145722` | 200 | 0 | `It’sJustKen VGC` / `mythofoxical` | `It’sJustKen VGC` | yes | 1787959949 / 1787959949 |

**Stored raw log compared with fetched log: exactly one line differs in each, the `|win|` line** (L169
and L171). Every other protocol line is byte-identical. That confirms the chunk-split diagnosis and
rules out Showdown having changed the replay.

Receipts, so a later re-fetch can be checked rather than trusted:

```
…-2662690089  sha256(fetched log)    64fda03cfca8b32adc16f2f2db80a46eba77826b2924f52e11de5c46ef51fb04
              sha256(corrected row)  7f67ba5683f3893b96889e55794dcd939cd8a04462dad9e9f254ae900fdd8284
…-2672145722  sha256(fetched log)    0119e8cd4b935c14ff212499b92b5377596aba3a0b8c53e78bce7af6fcd382ce
              sha256(corrected row)  2eb81b40eae8d1718b44622df6077f69fc81c45090ff86e87dde24bb4344da18
```

"Corrected row" means `extract(id, uploadtime, log)` from `engine/durable-ingest.js` at the working tree
of 2026-09-10 22:30 EDT, `JSON.stringify`'d. A later parser change changes that hash legitimately.

### The two rows are not the same kind of correction

- `…-2672145722`: `extract(stored raw log)` is **byte-identical** to the stored row, so the parser has
  not moved for this game. The corrected row differs in **`winner` only**.
- `…-2662690089`: `extract(stored raw log)` **differs** from the stored row, which lacks `preTurn`
  and has a different `turns`. **The stored row was written by an older parser.** So the tooling's
  corrected row changes `winner` AND adds `preTurn` AND rewrites `turns`. That is correct: the store
  is a derived view, and this is what a reparse would produce. But it is not a one-field repair, and
  the notes row should say so. Patching `winner` alone would mean hand-writing a row, which the brief
  rules out.

Separately, the store is of mixed parser vintage. At least this row predates `preTurn`. That is not
#558's to fix; it is the reason `MODE=reparse` exists.

## Why it was refused: the tooling behaviour, shown on a scratch copy

An unmodified byte-copy of `build/compress-stores.js` was run against a scratch `data/` built from
the two real parsed shards above and the two real raw lines. The corrected rows came from `extract()` over the
verified fetches. Nothing under the repository was written.

```
PARSED 1 — correction placed in the PLAIN store only (both lines replaced in place)
  default run          exit 0   games.ladder.jsonl up to date (12259 rows across 2 shard(s))   <- no shard written
  --verify-parsed      exit 1   DIFFERS — store sha 4866e0b4…, reassembly sha 376f3518…
  --restore-parsed     exit 0   plain after restore: 2662690089=CORRUPT 2672145722=CORRUPT     <- CI runs this first, every hour

PARSED 2 — correction as a NEW parsed shard, sorted after the corrupt one
  --restore-parsed     exit 0   plain after restore: both CORRUPT                              <- first occurrence wins
  default run          exit 1   REFUSING TO SHARD — the tracked shards hold MORE records than the local store: 12261 vs 12259.

RAW 3 — correction placed in the plain raw archive only
  --raw                exit 0   up to date (2 logs across 1 shard(s))                          <- no shard written
  --restore-raw        exit 0   plain raw after restore: both CORRUPT                          <- the correction is overwritten

RAW 4 — correction as a NEW raw shard, sorted after the corrupt one
  --restore-raw        exit 0   plain raw after restore: both CORRUPT
```

What each case means for the real store:

1. **A plain-file-only fix is invisible to git and gets reverted.** The default run shards only ids the
   shards lack, so the corrected row never leaves this laptop. `.github/workflows/ingest.yml` runs
   `--restore-parsed` and `--restore-raw` at the start of every run, and the next local restore puts
   the corrupt row back. **Worse, it reads GREEN while it is wrong.** `--check` compares ids and row
   counts, never content, so it would print "every store row is carried by a shard". The same holds
   for `tests/test-workflow-paths.js`, which calls it. Only `--verify-parsed` compares bytes, and it
   exits 1.
2. **A correction shard for the PARSED store would stop the collector.** `shardedRows()` counts
   duplicate-id lines as rows, so two correction rows make the shards hold 2 more "records" than the
   deduped plain store. The shrink guard then refuses every later `node build/compress-stores.js`,
   including the one `ingest.yml` runs after each ingest. That is a hard stop of the hourly Action,
   and it still leaves the corrupt row winning. **This is the most dangerous option on the table and
   it looks like the obvious one.**
3. **The raw side ignores a correction silently.** No shrink guard fires, and the corrupt log keeps
   winning.

The register row anticipated case 3/4 ("first-occurrence-wins must be reconsidered"). Its fallback,
"the correction lands in the plain archive with the old shard left as history", is case 3, and it
does not hold either: `--restore-raw` REWRITES the plain archive from the shards.

## What a correction needs (a design for whoever takes the fix; not implemented)

This amends the store's one precedence rule, first occurrence wins. It therefore needs a yes from
the coordinator (and Will, if he wants it), not a quiet edit to a tool whose last rewrite lost 15,862
games.

- **Hash-bound correction files in a subdirectory**: `data/parsed/<store>/corrections/<stamp>-NN.jsonl.gz`
  and `data/raw/<store>/corrections/…`. Each line is
  `{"id", "supersedes_sha256": <sha256 of the exact shard line it replaces>, "why", "line": <the corrected line>}`.
  They are write-once, like every shard.
- **Substitute in place, at the original position.** `reassembleParsed` (restore and verify) and
  `--restore-raw` swap the line whose id and sha256 both match. **Refuse** if a correction names an
  id that is absent from the shards, or a hash that matches no line. A correction is tied to the
  bytes it replaces and cannot drift onto a later row.
- **Row counts do not change.** `shardedRows`/`shardedIds` must not count the correction files, so
  the shrink guard and `--check` are unaffected. `trackedIds` (`git ls-tree -r`) WILL see them; the
  ids are the same, so the set is unchanged, but that should be asserted, not assumed.
- Today's `shardsIn()` lists only `*.jsonl.gz` directly under the store directory, so a
  `corrections/` subdirectory is invisible to the current code. Check before relying on that:
  `ingest.yml`'s `git add` loops and every other reader of `data/parsed/` and `data/raw/`. A grep for
  shard readers outside `compress-stores.js` found `engine/quality.js`, `engine/quality.py` and
  `engine/next_regulation_ingest.js`; all three read the retired monolith or plain files, not the
  shards.
- The same mechanism then covers the wider damage recorded in the `durable-ingest.js` header: 194 raw
  logs with 496 U+FFFD in nicknames and usernames.

## Register corrections for the coordinator

- ROADMAP #550 describes the two bad winners as "parser, not store". #558 and this re-fetch show they
  are neither. They come from the **fetch** (chunk-split decode) and sit in the **store**, and the
  parser read them correctly.
- #558's `VERIFIED BY` should read `the winner clause 2 → 0`, not `sanity_check` green. The brought-6
  clause belongs to #550.

## OWED, NOT RUN

1. Decide the correction mechanism above: coordinator/Will. It amends first-occurrence-wins. Owner
   per the register: OPS (the `durable-ingest.js` / store-tool owner).
2. Once `build/compress-stores.js` can apply a hash-bound correction, re-take the baselines:

```bash
node build/compress-stores.js --check
wc -l data/games.ladder.jsonl
python engine/sanity_check.py
```

3. Re-fetch both replays and check them against the receipts in this report (fetched-log sha256 must match):

```bash
node -e "
const https=require('https'),crypto=require('crypto');
const get=u=>new Promise(r=>https.get(u,x=>{let d='';x.setEncoding('utf8');x.on('data',c=>d+=c);x.on('end',()=>r(d));}));
(async()=>{for(const id of ['gen9championsvgc2026regmb-2662690089','gen9championsvgc2026regmb-2672145722']){
  const j=JSON.parse(await get('https://replay.pokemonshowdown.com/'+id+'.json'));
  console.log(id, crypto.createHash('sha256').update(j.log).digest('hex'), (j.log.match(/�/g)||[]).length+' U+FFFD');}})();"
# expect 64fda03c…fb04 and 0119e8cd…82ce, 0 U+FFFD each
```

4. Write the corrections with the new mechanism (the flag does not exist yet; name it when it does),
   then reconcile and prove it:

```bash
node build/compress-stores.js --restore-parsed
node build/compress-stores.js --restore-raw
node build/compress-stores.js --verify-parsed     # must be IDENTICAL — the only check that sees content
node build/compress-stores.js --check             # must still be clean; row counts unchanged
wc -l data/games.ladder.jsonl                     # must equal the baseline (92,594 on 2026-09-10 + any rows ingested since)
python engine/sanity_check.py                     # winner clause 2 -> 0; expect 95 passed, 1 failed (#550's brought-6)
node engine/validate_store.js
node tests/test-workflow-paths.js
node engine/status.js --write
```

5. Not run tonight on purpose. `node engine/status.js --write` restamps ledgers and data artifacts
   the ENGINE agent holds tonight, and nothing changed state this pass.
