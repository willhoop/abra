# rebuild_records.js under a superset archive — 2026-09-04

ENGINE. One file changed: `engine/rebuild_records.js`. Not committed. Nothing under `data/` was read
or written; no game was played; no test suite was run.

## What the guard was defending, and what it actually asked

`engine/rebuild_records.js` re-parses `<store>.raw-logs.jsonl` back into `<store>.jsonl` after a
parser fix. It writes to `<store>.jsonl.rebuilt` and swaps only if two checks pass. The first was:

```js
if (written !== nStore) { REFUSING to swap: rebuilt ${written} but the store had ${nStore} ... }
```

It is defending **loss**: no game may leave the store because somebody re-parsed it. That is the
right thing to defend. `written === nStore` was an exact test of it only while every archived log
produced exactly one store row — i.e. only while the archive and the store were the same set.

`durable-ingest.js`'s `archiveThenStore()` ended that. Pass A archives every fetched log; pass B
applies `rec.six.p1.length<4||rec.six.p2.length<4` when deciding a **row**. The archive is a strict
superset, permanently and on purpose.

Two things in this file were wrong the moment that landed:

1. **No completeness filter on rebuild.** It wrote a record for *every* archived log, so a rebuild
   would put half-parsed rows into the store that no ingest would ever write. `MODE=reparse` in
   `durable-ingest.js` applies the filter; this did not.
2. **The guard counted.** Under a superset `written > nStore` forever, so it refuses permanently —
   and it refuses **hardest in the case the tool exists for**: a parser fix that finally reads a
   previously-unreadable game *raises* `written`, and the count guard reads that success as a fault.

## The shape chosen, and why

**Both**: apply the completeness filter *and* re-ask the guard **by id**.

Filtering alone is not enough — it would make `written === nStore` true today, and the tool would
still refuse the day a parser fix recovers a game. Counting alone is not enough either: a count can
balance a drop against a gain (proved below, S2 and S6).

- `dropped = storeIds \ rebuiltIds` → **REFUSE**, naming the ids. This is the loss direction and it
  is strictly stronger than the count it replaces.
- `recovered = rebuiltIds \ storeIds` → **report loudly, allow**. A recovered game is the point.
- `badAfter > badBefore` → unchanged.
- Added **dedupe by id, first occurrence wins** — the same rule `durable-ingest.js`'s reparse uses,
  and necessary here for the same reason: an unreadable game is re-fetched and re-archived on every
  ingest, so the day it becomes readable an un-deduped rebuild emits one row per archived copy.
- `incomplete` and `dupLogs` are counted and printed. No silent skips, no silent catches.

The completeness predicate is **duplicated**, not shared, because `durable-ingest.js` does not export
it and I do not own that file. It is commented as a duplicated fact at the point of duplication. See
OWED.

## Proof

Harness: `<scratchpad>/prove_superset_guard.js`, synthetic fixtures only, BEFORE version taken from
`git show HEAD:engine/rebuild_records.js`. **The verdict read is whether `<store>.jsonl` was
replaced and what ids it then holds, not the exit code.**

| # | fixture | BEFORE (HEAD) | AFTER (fixed) |
|---|---|---|---|
| S1 | superset: 3 stored, archive holds those 3 + 1 unreadable (`six=2/2`) | **REFUSED** `rebuilt 4 but the store had 3` | **SWAPPED**, 3 rows `gA,gB,gC`, `six<4: 1` reported |
| S2 | shrink: gC's log missing from the archive, 1 unreadable present | **SWAPPED — and lost gC.** Store became `gA,gB,gUNREADABLE` | **REFUSED**, names `gC` |
| S3 | gC's log truncated + 1 unreadable | REFUSED (by count, wrong reason) | **REFUSED**, names `gC` |
| S4 | recovery: archive holds a 4th complete log | **REFUSED** — the tool's own purpose | **SWAPPED**, 4 rows, `RECOVERED: 1 (gRECOVERED)` |
| S5 | archive holds gA twice | REFUSED (by count) | **SWAPPED**, 3 rows, `skipped 1 duplicate` |
| S6 | gC's log truncated, nothing else; counts balance **3 == 3** | **SWAPPED.** Store became `gA:six=6/6 gB:six=6/6 gC:six=2/2` — silent corruption, exit 0 | **REFUSED**, names `gC`; store left `6/6 6/6 6/6` |

S2 and S6 are the controls that matter. They are not hypotheticals — the pre-change guard **swapped
in a store that had lost a game (S2) and a store containing a half-parsed row (S6)**, exit 0 both
times, because the totals matched. The new guard refuses both and says which id.

## mew_farm.js:391 — DIFFERENT CLASS, LEFT ALONE

```js
if (rawKept !== kept) { WARNING: ${kept} records but ${rawKept} logs — these must match. }
```

Not the same defect, and not fixed:

- Its logs are **self-play**, generated locally and regenerable from a seed. There is no fetch, no
  public replay pool, and nothing to preserve against a future parser.
- There is **no completeness filter anywhere in that path** — no `six<4` rule — so the superset
  relation cannot arise there.
- The raw merge is filtered through the **same `seen` id set** as the record merge, so equality is a
  construction invariant, not an inherited assumption. If it breaks, a worker's log sidecar is
  genuinely missing, which is a real defect worth a warning.
- It is a **warning**, not a refusal. It cannot wedge anything.

**One adjacent, pre-existing asymmetry noted and NOT fixed** (it is not my file and it is not this
defect): the record loop drops a duplicate id (`if (seen.has(id)) { dupes++; continue; }`) while the
raw loop keeps it (`if (!seen.has(id)) continue;` — a dupe's id *is* in `seen`). So duplicate ids
across shards make `rawKept > kept` and fire that warning legitimately. Reported, left standing.

## The ripple — what actually reads the archive⊆store relation

Checked every raw-log consumer under `engine/`, `build/`, `.github/`. **`rebuild_records.js` was the
only hard failure.** The reason the blast radius is small: nearly every consumer joins
**store-driven** — it builds a map of store ids and does `const m = meta.get(r.id); if (!m) return;`
— so an extra archived log simply finds no partner and is skipped, which is correct behaviour under a
superset.

Verified safe (store-driven join or byte-level, no relation asserted): `build/strong_player_baseline.js`
(`meta.get(r.id)` guard at the log loop), `engine/click_census.js`, `build/build_ability_blocks.js`,
`engine/forced_switch_audit.js`, `engine/conditional_audit.js`, `engine/bring_priors.js`,
`engine/chomp_ev.js`, `engine/dusk_size_gate.js`, `build/compress-stores.js` (treats the raw file
independently, compares bytes, no store/raw count relation).

Cosmetic / now-wrong, not fixed here:

- **`engine/sweep.js:666`** prints `N of S stored rows have no raw log (archive holds R)`. Direction
  is store→archive so it does not misfire, but the parenthetical `archive holds R` will now exceed
  the store's row count, which reads as a defect to anyone scanning it. Its regex that parses
  `const RAW=` out of `durable-ingest.js` still matches.
- **`data/raw-log-census.json`** states the old world as fact (`raw_archive_games: 46587`,
  `store.games_with_no_raw_log: 6191`, and a `note` claiming reparse "refuses rather than dropping
  them"). It is dated 2026-08-10 against a 76,431-log archive, so it is stale on its own numbers
  before the relation change. **No generator writes it** — `engine/provenance.js` already classifies
  its `by: "ROADMAP #134 — ..."` as an unresolved declaration, so nothing auto-fails and nothing will
  ever correct it. It is a hand-written snapshot that is now wrong in its relation as well as its
  counts. Not fixed: I do not own `data/`.

## CLASS or INSTANCE

**INSTANCE**, honestly. The fix corrects `rebuild_records.js` and nothing structurally prevents a
second reader from assuming archive == store, spelled differently, through another door. The two
things that would make it CLASS are in OWED below.

Two partial mitigations that did land: the guard is now a **set containment** test rather than a
count, which is the general shape (it would also catch an id swapped for another id, which counting
never could); and the failure is now **named by id**, so a future instance reports *which game* is at
risk rather than a pair of totals a reader has to interpret.

## OWED

1. **The completeness rule is duplicated.** `rec.six.p1.length<4||rec.six.p2.length<4` now lives in
   three places: twice in `engine/durable-ingest.js` and once as `complete()` in
   `engine/rebuild_records.js`. That is a FACT with three implementations, which CLAUDE.md forbids.
   The fix is to hoist it into `durable-ingest.js` and export it, and have all three call it —
   `durable-ingest.js` is not mine to edit.
2. **Nothing enforces the superset relation.** No test asserts that a rebuild refuses on loss and
   accepts on a superset; the proof above is a scratchpad harness, not a gate. Whether that becomes
   a test is not my call to make unilaterally (`no-bloat-just-fix-it`), so it is stated rather than
   built.
3. **`data/raw-log-census.json` is wrong and unowned** — stale counts plus a `note` asserting the old
   relation, with no generator to correct it. It needs either a generator or deletion by whoever owns
   `data/`.
4. **`engine/sweep.js` section 5 prose** still describes the old drift direction.
5. **Not committed.** `engine/rebuild_records.js` is modified on disk only.
