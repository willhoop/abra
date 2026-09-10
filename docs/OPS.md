# OPS — the live bot and the store

**Owns:** `engine/mag_bot.js`, `engine/showdown_bot.js`, the Showdown connection, OTS ingest,
replay publication, the team pool, `data/live-games/`.

**Its one number:** usable share of the store, and battles recorded.

**May not:** block any other division. This is the one place where an interruption costs a real
game rather than a re-run.

<!-- GENERATED: engine/status.js -->

```
OPS — the live bot and the store
  store: 92540 games, 32162 usable (34.8%), 27605 teams   (live.js 2026-09-10)
  live-games/: 34 battles recorded
  data/games.ladder.jsonl      last written 2026-09-09 18:46
  data/games.bo3.jsonl         last written 2026-09-09 18:46  <- the Force-OTS format, collected hourly
  data/games.ots.jsonl         last written 2026-09-09 18:46  <- FROZEN external import, complete; date is an import, not a heartbeat
```

_stamped 2026-09-10 04:41_

<!-- /GENERATED -->

## THE RAW SHARD WRITER IS CAPPED, TWO STORE ROWS CARRY A SPLIT CHARACTER IN THEIR `|win|` LINE, AND THE HOURLY COLLECTOR HAS NOT YET RUN ON CI. 2026-09-09, CHANGELOG 5.277.0

**THE CAP (#556, closed by MEASURE).** `build/compress-stores.js --raw` now shards at `SHARD_BYTES` (32 MiB of source) like the parsed writer; the one uncapped write, `data/raw/games.ladder/20260909T2052-00.jsonl.gz` at 58,753,177 B (56.03 MiB, 76,741 logs, commit `71771f0b`), stays — under the 100 MB wall, over the 50 MB warning, permanent. Budget at 176 games/h: one ~135 KB shard per hourly run, 24 a day, in one directory per store; that is a tree-object cost, not a per-file wall. Account: `docs/_reports/2026-09-09-raw-shard-cap.md`.

**THE TWO ROWS (#558, open, OPS).** `gen9championsvgc2026regmb-2662690089` and `gen9championsvgc2026regmb-2672145722` have `winner` equal to neither player: U+FFFD sits ONLY in the `|win|` line — a multi-byte character split across two HTTP chunks and decoded chunk by chunk, the fetch defect `engine/durable-ingest.js` fixed on 2026-08-28 with `setEncoding('utf8')`. Showdown serves both replays clean today. The repair is a re-fetch that replaces both the parsed row and the raw log (a raw shard is write-once, so the corrected raw log is a new shard, or the correction lands in the plain archive); do not delete rows. `engine/sanity_check.py`'s winner clause goes 2 → 0 on that repair and on nothing else. The same defect left 194 raw logs / 496 U+FFFD in nicknames — the same repair, wider.

**THE HOURLY COLLECTOR ON CI.** `gh run list --workflow next-regulation.yml` at 23:11Z on 2026-09-09 lists NO run: the workflow has not fired since it was committed in `71771f0b` (22:32Z). The last `ingest` run, id `34404028238`, completed `success` at 20:56Z — before that commit, so no CI run has yet gunzipped the 56 MB shard; locally the step was given `--max-old-space-size=5120` and the default heap was not measured. Watch the first hourly run for `coverage:` and `GAP:` on both steps, and for an exit 134 on the raw step.

**ALSO.** The local `data/games.ladder.jsonl` was reconciled 92,379 → 92,431 rows via `--restore-parsed` — the OPS OWES item in the block below is closed by that; `tests/test-workflow-paths.js` 6/0. 7,599 ladder rows have no raw log in the archive (92,431 parsed vs 84,832 raw) — owed a register row and a count of ids, not filed here. `node engine/status.js --write` was NOT run.


## REG M-C IS COLLECTED HOURLY INTO ITS OWN STORES, THE INGEST SAYS WHEN THE SEARCH WINDOW OUTRUNS THE STORE, AND WILL'S OWN GAME IS IN IT. NOTHING IS SIMULATED. 2026-09-09, CHANGELOG 5.276.0

**THE STORES.** `data/games.gen9championsvgc2026regmc.jsonl.gz` 1,412 rows and
`data/games.gen9championsvgc2026regmcbo3.jsonl.gz` 727 rows at 20:52Z (`gzip -dc | wc -l`); raw logs
shard under `data/raw/games.gen9championsvgc2026regm*/` via `--raw`. Will's game
`gen9championsvgc2026regmc-2678209853` (p1 `willhoop`, 2026-09-09 18:31) is in the bo1 store. Reg M-B
stays `active` in `data/next-regulation.json`; both Reg M-C ids read `candidate [replay]` and the
detector says "collectable, NOT simulatable" — the pinned Showdown checkout does not carry the format,
and its move and item changes are #553, sequenced after the Reg M-B gate opens.

**THE WORKFLOW.** `.github/workflows/next-regulation.yml` runs hourly for every `candidate` format, in
the same `ingest` concurrency group as the six-hourly ingest, so the two never race. The run's coverage
lines read 176 games/h (bo1) and 61 games/h (bo3) against a 7.1 h bo1 search window: an hourly pull
holds the window, a six-hourly one does not. The first SCHEDULED run is not observed — the path is
proven locally only; watch the first Actions log for `coverage:` on both steps and for `GAP:`.

**THE GAP DETECTOR.** `engine/durable-ingest.js` prints a coverage line every run and `GAP:` when no
offered id is held and the window's oldest game is newer than the store's newest (`--strict-gap` /
`STRICT_GAP=1` for exit 1). Account: `docs/_reports/2026-09-09-regmc-hourly-collection.md`.

**OPS OWES.** `tests/test-workflow-paths.js`'s shard-currency clause is red because the LOCAL
`games.ladder.jsonl` (92,379 rows) is behind the tracked shards (92,400) — the 11:28Z CI ingest landed
on origin, not this disk; `node build/compress-stores.js --restore-parsed` rewrites the store and was
not run in this pass. `node engine/status.js --write` was NOT run; the block above is stamped to an
earlier pass.


## THE SHARDING CUTOVER DROPPED 11,110 LADDER AND 4,752 BO3 GAMES FROM THE TRACKED STORE AND TWO GUARDS LOOKED PAST IT; RECOVERED. THE SMOGON CRON STOPS REWRITING A FROZEN SOURCE. 2026-09-09, CHANGELOG 5.275.0

**THE STORE.** `18432bcb` (2026-09-06) sharded the LOCAL plain file, two weeks behind origin, 51 minutes
after `d2a418a5` had committed 88,346 ladder and 31,286 bo3 ids. `--verify-parsed` proved the shards
identical to the wrong file; the runner's shrink guard measures `wc -l` against a store restored FROM
the shards, so a short shard set was the new floor. Recovered into five write-once shards
(`data/parsed/games.{ladder,bo3}/20260909T1708-*`): ladder 81,269 -> 92,379 ids, bo3 28,049 -> 32,801,
ots 4,167 unchanged; `comm -23` of the monolith ids against all shards 0 / 0 / 0; no existing shard
changed. `build/compress-stores.js --check` now asserts the shards carry every id git tracked at
`HEAD~1`, shown red on a replay of the cutover. Register row #550. Account:
`docs/_reports/2026-09-09-fix-store-recovery.md`.

**THE CRON.** `.github/workflows/smogon-stats.yml` staged `data/smogon-priors.json` — a release SOURCE —
on the 4th and 11th, and the only bytes that moved were the `generated` date: three engine digests
minted for nothing. It now writes `data/smogon-priors.observed.json` and restores the frozen file;
promotion is a hand run of `node engine/smogon_priors.js`. Account: `docs/_reports/2026-09-09-fix-smogon-cron.md`.

**OPS OWES, in this order:** `git add` the five shards and the observed twin by name — the twin is
untracked and the collector's `git add` exits 128 without it; wire `--check` into `ingest.yml` after
its shard step (on a `fetch-depth: 1` checkout it throws on `HEAD~1`, which is the loud answer);
`engine/sanity_check.py` is 94/2 and both reds are parser defects the store now exhibits — a `brought`
of six on `gen9championsvgc2026regmb-2676161109` and two non-ASCII `winner` mismatches — and it reads
the local ladder file only.
## TWO STORE DEFECTS THIS LEDGER HELD AS PROSE ARE NOW REGISTER ROWS, AND NEITHER HAS AN INSTRUMENT. 2026-09-04, CHANGELOG 5.246.0

**NOTHING IN THE STORE MOVED IN THIS PASS.** No ingest, no bot session, no publication, no re-parse.
What changed is where two of this ledger's own findings live. The 5.244.0 section below says of the
`data/games.selfplay.jsonl` duplicate ids and of the raw-log census artifact that they were *"named so
it cannot look closed"* — and at the time they were named only in this document. They are now filed as
ROADMAP #536 and #540, both `INSTRUMENT OWED`: nothing in the tree decides either, and the rows say so
rather than citing a probe that does not exist. That section stands as written and is superseded from
here rather than rewritten.

**THE POINT IS THE MECHANISM, NOT THE BOOKKEEPING.** A defect recorded only in a dated ledger section
is a defect nobody can enumerate, which is the same failure as the fourteen typed handoffs. Six such
defects were filed this pass (register `497 → 503` rows, `251 → 257` open); five of the six carry no
`VERIFIED BY`, which is the honest state of them.

**`node engine/status.js --write` is still OWED**, so the `<!-- GENERATED -->` block above still
carries its 2026-09-01 store figures and must not be read as today's.

## AN OUTSIDE USAGE TABLE IS ARCHIVED AS A COMPARISON SET THAT FEEDS NOTHING, AND THE STORE'S CONTAMINATION IS RE-MEASURED RATHER THAN RE-DISCOVERED — 2026-09-04, CHANGELOG 5.245.0

**THE INGEST ALREADY EXISTED AND ITS CRON WAS DUE TO FIRE TODAY, SO IT WAS RUN RATHER THAN DUPLICATED.**
`engine/fetch_smogon_stats.js` pulled Smogon's August 2026 statistics: **310 species, 1,269,250 bo1
battles, zero illegal entries.** The Champions SP fingerprint was checked rather than assumed —
**66/32, zero violations** — because the header carries no format name and a filename proves nothing.

**IT IS A COMPARISON SET. IT FEEDS NOTHING.** No model, no prior, no filter and no view reads it. It
exists to be diffed against our own store, which is the only thing an outside table is safe for here:
it is a different population collected under different rules, and the moment it feeds a decision it
becomes an unstamped input to everything downstream.

**OUR STORE HOLDS 85 SPECIES THAT ARE `isNonstandard: 'Past'`** — the known contamination, measured
again rather than recalled. **Species Smogon has seen that we never have: 0.**

**AND THE FIRST JOIN WAS WRONG IN A WAY THAT LOOKED LIKE A FINDING.** A naive join said 71, including
Charizard-Mega-Y at rank 6 with **26.52%** usage — a species we obviously do see. `durable-ingest.js`
collapses megas to their base forme in `six`, so the seen-set has to be `six ∪ sets`; that was
control-tested both ways before the corrected number was written down. **bo1 and bo3 are different
metagames and the same species proves it: 26.52% in one, 50.46% in the other.** Nothing that pools
the two stores is measuring one population.

**WHAT THIS DIVISION DID NOT DO.** No store was rewritten, no re-parse was run, no live game was
played, and `data/meta-usage.json` was not regenerated. The store figures in the `<!-- GENERATED -->`
block above are from the last `status.js --write` and are one pass behind; that run is OWED.

## THE RAW LOG IS THE SOURCE OF TRUTH AND THE STORE IS A DERIVED VIEW — 2026-09-04, CHANGELOG 5.244.0

**THE INVERSION BEHIND A DOZEN STORE REWORKS.** The REGENERABLE artifact was durable and the
IRREPLACEABLE one was gitignored. Everything below follows from putting that the right way round:
the store can be rebuilt from the raw log; nothing can rebuild the raw log.

- **S1 — the filter ran before the archive write.** `engine/durable-ingest.js:543` continued on the
  completeness check BEFORE the log was archived, so a game the CURRENT parser could not read had its
  raw log **deleted** — destroying the one artifact a FUTURE parser could have used. That is the
  invariant broken at its source, not downstream of it.
- **S2 — the row was written before the log**, on independent streams, so a crash left an **orphan
  row**: the wrong direction. Two passes now, through one exported `archiveThenStore()`, with store
  output verified byte-identical.
- **S3 — the archive is now write-once dated shards**, not one blob. Caught mid-test before it
  shipped: a `-2` collision suffix sorts BEFORE `.jsonl`, which replays an append-only archive out of
  order.
- **S4 — `get()` resolved an empty string on HTTP error, on timeout AND on an empty body.** Three
  facts, one value, which is why a dead API and a quiet day were indistinguishable. It returns null on
  failure now, with the discriminator derived from the endpoint rather than assumed.

**A PUBLISHED ESTIMATE IS REVERSED.** The single-blob archive was described as roughly **65 days**
from trouble. Measured, compression is **13.98%** and a single blob is **78 MB across both archives
today — already 78% of the 100 MB limit.** The estimate was wrong; the shard design is what the
measurement implies, not a preference.

**AND THE GUARD THAT PROTECTS A REBUILD ASSUMED THE OLD EQUALITY.** `engine/rebuild_records.js:117`
compared COUNTS. Now that the archive is a SUPERSET by design it would have refused every valid
rebuild — **and it was already letting a bad one through**: with a truncated log the counts balanced
**3 == 3** and it swapped in a corrupted store at exit 0, while another arm lost a game outright. It
now filters on completeness and re-asks the guard **by id**, naming any game that would be lost.
Strictly stronger than what it replaced.

**RECOVERED: 7,275 raw logs across both stores — 6,661 ladder, 614 bo3, 0 unavailable, 0 without a
timestamp.** Both archives are complete supersets, `MODE=reparse` is unblocked, and the store-orphan
section of `engine/sweep.js` is clean. **This is the first time a re-parse is safe to run**, which is
the whole point of the ordering fixes above: a re-parse under S1 would have deleted every log the
current parser cannot read.

**THE SHAPE ALL OF THIS ARRIVED IN.** `engine/durable-ingest.js:464` already explained the archive
drift in a comment, and that comment already said *"RUN THIS BEFORE ANY REPARSE"*. Nothing was
unknown; nothing read it. That is this session's single finding, and OPS is where it cost the most,
because the thing at risk was the only artifact in the project that cannot be regenerated.

**NOT FIXED, ROUTED, AND NAMED SO IT CANNOT LOOK CLOSED.** `data/games.selfplay.jsonl` holds **89
duplicate ids**. The raw-log census artifact still asserts the old subset relation and has no
generator to correct it. Neither was touched.

**WHAT WAS NOT RUN.** No ingest, no bot session and no publication was performed by this pass, and
`node engine/status.js --write` was not run — so the `<!-- GENERATED -->` block above still carries
its 2026-09-01 store figures and must not be read as today's. Full accounts: eleven reports under
`docs/_reports/2026-09-04-*.md`.
## Standing state

MAGABRA is **locked** on Showdown (`!magabra`): it can battle and save replays, it **cannot chat**.
`--trash` is wired and silently dropped by the server — that is the lock, not a code bug.

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` is required for anything that
touches the simulator.

The password is in `data/.showdown-pass` (gitignored). **Never type it into a command.**

## The rules that are not negotiable

- **NEVER restart the live bot mid-battle.** It forfeits Will's game. There is no urgency that
  outranks this.
- **OTS only.** Non-OTS games are thrown out; OTS games are recorded and the replay auto-published.
- **Never `git add -A` or `git add -u`.** The ingest churns `archetypes.json`, `kad-replays.js`,
  `live.js` and `conformance.json` on every run, so a broad add sweeps generated noise into the
  commit. Add files by name.
- **6 processes maximum**, and ask before running wide while Will is at the keyboard. RAM is the
  real cap, not cores.

## Store contamination — measured 2026-08-27, NOT acted on

Full account: `docs/_reports/2026-08-27-contamination-refresh.md`.

`data/store-validation.json` was refreshed against the current ladder store (**67,384 games**,
591,457 revealed sets); the previous reading was 2026-08-07 over 47,210. **The headline is an UPPER
BOUND and must not be used as a filter key** — it splits into two unlike things:

| class | games | rate | what it is |
|---|---|---|---|
| headline (any illegal set) | 1,252 | 1.858% | upper bound, do not filter on this |
| **species** | **76** | **0.113%** | contamination — a team from another regulation |
| move-only | 1,175 | 1.744% | mostly the **Illusion signature**; 1,020 of them have a Zoroark line on the same side |

A second, independent walk — every key in `sets`/`six`/`brought`/`lead` against
`Dex.forFormat(...)` — returns **the same 76 games**. Two rulers, one number.

**No filter has been added and no artifact was changed.** The filter is Will's decision; this is the
costing for it.

## Reading the record

The head-to-head against Will sits around 15-4. **Do not read that as strength.** He plays
unfamiliar teams deliberately. It is a measurement of his experiment, not of the bot.

## Done looks like

- Usable share of the store trending up, not just total games.
- Every OTS game recorded with its replay published.
- Zero mid-battle restarts.

## Backlog

- The team pool's base filter is completeness, not quality — that item is owned by
  [SEARCH.md](SEARCH.md) because it changes what gets measured, not how the bot runs.
- ~~`data/games.ots.jsonl` has not been written since July. Confirm whether OTS ingest is still
  landing in it or has moved to the ladder store.~~ **ANSWERED AND STRUCK 2026-08-27.** The code
  answers it, and the generated block above already said so — this line contradicted its own page.
  `engine/ingest_ots.js` is a **manual importer**: it takes `logs_*.json` files as arguments and
  prints a usage line with none. It appears **nowhere in `.github/workflows/`** (`grep -rn
  ingest_ots .github/` returns nothing), so no scheduled run has ever written it and none was
  missed. It also **refuses** `--out data/games.ladder.jsonl` by name, so the ingest cannot have
  "moved to the ladder store" — the two corpora are different information AND incentive regimes and
  the importer will not pool them. The premise was stale as well: the file was last written
  **2026-08-21 22:35**, not July.
