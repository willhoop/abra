# The Reg M-C stores are re-parsed with the fixed set-attribution extractor

2026-10-01, MEASURE, abra/regmc 1.70.0. This runs item 1 and part of item 2 of *OWED, NOT RUN* in
`docs/_reports/2026-10-01-store-set-attribution.md` (abra/regmc 1.63.0). It was run in the main checkout, on main at
`dc2ed04e`, at BelowNormal priority through `tools/lownode.cmd`. No game was played and no simulator was read. The frozen
pool `data/team-pool-frozen-regmc/` was not read and was not written. Receipts are in `2026-10-01-store-reparse/`.

## Verdict

- **Rows changed.** bo1: 52,631 of 64,797 rows (81.2%). bo3: 27,609 of 40,452 rows (68.3%). Each run exited 0 with
  `lost_ids: 0`, 0 duplicate ids, 0 rows carried without a raw log and 0 rows the extractor refused. The dry run and the
  `--write` run gave the same counts.
- **The check after the swap** (`engine/store_sets_check.js`, 1-in-10 sample, `SHOWDOWN_PATH` set to the Reg M-C
  checkout):
  - `stored_differs_from_fresh` is 0 on bo1 (6,418 rows) and 0 on bo3 (4,055 rows).
  - Stored bo1: moves 100%, items 100%, abilities 99.92% over 39,065 non-mirror members. There are 0 misses and 12
    wrong values. All 12 are the Hospitality rows from §4 of the 1.63.0 report, where the reference is wrong.
  - Stored bo3: 100% on all three over 24,179 members, with 0 wrong and 0 missed.
  - Before the re-parse, stored bo1 was 99.69% / 98.97% / 97.54%, with 539 wrong values and 6,616 misses (1.63.0, on
    the store as it was then).
- **Downstream.**
  - `data/store-validation-regmc.json` moved as expected.
  - `data/meta-usage-regmc.json` did **not** move because of the re-parse: it is byte-identical apart from its stamps
    when it is built from the store before and after the re-parse (§3). The restamp moves it only by the collector's
    new rows (54,958 → 55,724 sampled teams).
  - The two SOLVER extracts were **not** re-run (§4).

## 1. The re-parse

Commands, from the main checkout, each through `tools/lownode.cmd`:

```
engine/reparse_store.js --store data/games.gen9championsvgc2026regmc.jsonl.gz    --raw data/raw/games.gen9championsvgc2026regmc    --raw-plain data/games.gen9championsvgc2026regmc.raw-logs.jsonl    [--write]
engine/reparse_store.js --store data/games.gen9championsvgc2026regmcbo3.jsonl.gz --raw data/raw/games.gen9championsvgc2026regmcbo3 --raw-plain data/games.gen9championsvgc2026regmcbo3.raw-logs.jsonl [--write]
```

| store | rows | changed | `sets` | `mirrorSets` added | `turns` | lost | raw files |
|---|---|---|---|---|---|---|---|
| bo1 | 64,797 | 52,631 | 52,542 | 16,874 | 816 | 0 | 286 |
| bo3 | 40,452 | 27,609 | 27,577 | 26,820 | 76 | 0 | 286 |

**`turns` changed, and that is cause 6 (Ally Switch), not an unknown.** The 1.63.0 report predicted it in §6 (81 bo1
rows and 18 bo3 rows on its sample). On the full stores, every row whose `turns` changed has an Ally Switch that did not
fail: 816 of 816 bo1 rows and 76 of 76 bo3 rows. Only 12 bo1 rows and 4 bo3 rows with an Ally Switch kept their `turns`
unchanged. The event-level diff is all `mon` / `tgt` relabelling after a `|swap|`. The leading kinds on bo1 are
`hp.mon` 1,378, `f.mon` 848 and `b.mon` 477, and then move targets. Example: `gen9championsvgc2026regmc-2678184190`
T4, the Dragon Pulse into p2b was credited to Annihilape and is now credited to Farigiraf. That is the same game cause
6 is pinned on in `tests/test-parse.js`.

**Swap and reconcile.**

- Before the swap: `git fetch`, and origin/main was still `dc2ed04e`. The collector's last store commit was `e3d50d02`
  (16:45Z). No collector commit landed during the run.
- `next_regulation_ingest.js --reconcile` puts the `.gz` rows first and then the plain file's rows, and the first
  occurrence of an id wins. Before running it, I counted the plain-file ids that are absent from the re-parsed `.gz`.
  Both stores had 0. So reconcile could not bring an old-parser row back. It rebuilt the ignored plain files from the
  new `.gz`: 33,743 → 64,797 and 24,028 → 40,452.
- Reconcile also rewrote `games.gen9championsvgc2026regmabo3.jsonl.gz` (51 rows). Its decompressed content was
  identical to HEAD's, so I restored the tracked file to HEAD and did not commit a blob with no change.

**Growth budget.**

- bo1 `.gz`: 49,243,082 → 50,099,756 bytes (blob `b51988ae`).
- bo3 `.gz`: 40,932,874 → 42,368,411 bytes (blob `ba82bde3`).
- The new blobs total about 92.5 MB, and gzip gives git nearly nothing to delta, so expect about that much in the pack.
- The largest single tracked file is now 50.1 MB, well under the 100 MB wall.

## 2. `data/store-validation-regmc.json` (regenerated first)

`node engine/validate_store.js --regulation regmc --write`. The old artifact was stamped 06:59Z on a smaller store
(39,541 bo3 and 63,048 bo1 rows), so this is not a pure before/after. Where the growth confounds a figure, the movement
is attributed by id.

| store, ruler | before | after |
|---|---|---|
| bo1 REVEALED | 2,331 / 62,649 judged (3.7207%); move 722, ability 10, item 14, species 43 | 2,226 / 64,392 judged (3.457%); move 588, ability 0, item 15, species 43 |
| bo1 DECLARED | 74 / 2,390 judged (3.0962%) | 74 / 2,439 judged (3.034%) |
| bo3 REVEALED | 1,018 / 39,541 judged (2.5745%); move 103, ability 2, item 14, species 15 | 1,036 / 40,452 judged (2.561%); move 112, ability 0, item 20, species 23 |
| bo3 DECLARED | 928 / 39,537 judged (2.3472%) | 937 / 40,440 judged (2.317%) |

- The re-parse caused the bo1 move flags to fall (722 → 588 on a larger store) and the ability flags to go to 0 in
  both stores. These are the called and transformed moves, and the replaced abilities, that are no longer credited to
  the holder.
- Every new species-flagged id is a game the collector added after 06:59Z. The re-parse made exactly 2 old games newly
  item-flagged: bo3 `-2690752097` and bo1 `-2689301267`. Their items are now read from other lines.
- The DECLARED rulers judge the sheets, which the re-parse does not touch, and they move only with the store's growth.

## 3. `data/meta-usage-regmc.json` (restamped)

`tools/lownode.cmd --max-old-space-size=4096 engine/analyze.js --regulation regmc`.

- **At the default heap it died at exit 134** (`Reached heap limit`). It is not a verdict. The new rows carry
  `mirrorSets`, and the run needs more than node's default old space. With 4 GB it ran in 23.5 s. `engine/usage_regulation.js`
  has no `ABRA-HEAP` header, so the wrapper cannot derive the 4 GB itself. This is OWED.

**Isolation.** A scratch harness (`mu_head.js`, scratchpad only, which writes nowhere in the tree) ran
`usage_regulation.main()` with the two store paths served from `HEAD`'s blobs, the pre-re-parse bytes:

- HEAD stores + the new validation, against the re-parsed stores + the new validation: **identical apart from
  `generated`, `generated_at`, `source_digests` and `provenance`.** The re-parse moved no figure in it. The artifact
  reads `sheets`, `six` and `brought`, never `sets`.
- HEAD stores + the old validation, against HEAD stores + the new validation: **identical.** The validation
  regeneration moved no figure either.
- The committed artifact before this pass (14:58Z) differs only by store growth: 54,958 → 55,724 sampled teams, from the
  collector's 16:23Z and 16:45Z rows.

## 4. The SOLVER extracts were not re-run, and why

The 1.63.0 report also lists PORYGON2 v2 `extract.js` (bo1, bo3) and `solver/meta/extract.js`. I did not run either.

- **`solver/meta/`.** The live ladder run (pid 3732 `run_ladder.js`, child 17112 `rotom.js`, arm `gen5-chomp-tour`,
  CHOMP preview) reads `solver/out/meta/bo3.json` at run time (`solver/chomp/v1/chomp1.js:28`). Regenerating that
  directory under a live run moves a file in the run's frame. `extract.js` writes only `games.clean.jsonl.gz` and
  `manifest.json`, but the stage exists to feed `analyze.js`, which writes `bo3.json`. Its outputs date from
  2026-09-23, so they are already 8 days of store growth behind. This is SOLVER's restamp after the ladder run ends.
- **PORYGON2 v2.** The tracked `solver/porygon2/v2/manifest-bo{1,3}.json` record the dataset that the k1 model was
  trained on (2026-09-30). A re-extract now would mix two changes in one manifest: the parser fix (the report expects
  only `crosscheck_vs_store_sets` to move, to about 100%) and a day of store growth. It would also overwrite the
  receipt of a trained model's data. Whether to rebuild that dataset is SOLVER's decision. The parser fix gives no
  reason for it: positions come from the raw logs through `reveal.js`, not from `sets`.

## OWED, NOT RUN

1. **SOLVER: PORYGON2 v2 `extract.js --fmt bo1|bo3` and `solver/meta/extract.js` (+ `analyze.js`).** Run them after the
   live ladder run (pid 3732) stops, because `chomp1.js` reads `solver/out/meta/bo3.json`. Expect only
   `crosscheck_vs_store_sets` and store-growth counts to move. Say so if anything else does.
2. **`engine/usage_regulation.js` needs an `ABRA-HEAP` header** (4096 measured sufficient). Without it,
   `tools/lownode.cmd engine/analyze.js --regulation regmc` dies at exit 134 on the re-parsed stores. The cause is
   `analyze.js`'s require of `usage_regulation.js`: the wrapper derives the heap from the first script only, so the
   header belongs in `engine/analyze.js` or the dispatch has to pass it.
3. Items 3–6 of the 1.63.0 report's OWED stand unchanged:
   - `reveal.js` Hospitality (SOLVER);
   - `validate_store.js` should judge `mirrorSets[sp][side]`;
   - consumers of `sets` should join forme keys and compare by `toID`;
   - `engine/provenance.js` does not see the Reg M-C stores as inputs of the `-regmc` artifacts.
4. **The frozen pool keeps the old parser's `sets` by design.** A re-cut is a new pool, and that is Will's call.
