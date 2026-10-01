# The parsed store's `sets`: nine attribution causes, fixed in the extractor, re-parse owed

2026-10-01, MEASURE, abra/regmc 1.52.0. Store-only work: no game was played and no simulator was read. The main
checkout's stores were read in place and not changed. The receipts are in `2026-10-01-store-set-attribution/`
(`check-bo1.json`, `check-bo3.json`).

## Verdict

- On a 1-in-10 sample of the Reg M-C bo1 store (6,247 of 63,048 rows, 5,950 compared games), the **stored** `sets`
  agree with the reference reveal on moves for 99.69%, on items for 98.97% and on abilities for 97.54% of
  37,964 non-mirror brought members. There are 539 WRONG values: 161 items, 318 abilities and 60 moves. There are
  6,616 MISSES, where the log names a value and `sets` holds null: 4,615 items, 1,933 abilities and 68 moves. A further
  5,865 members (13.4%) are mirror species, whose one store entry merges two Pokemon.
- After the fix, a **fresh** extract of the same logs agrees on 100% of moves and items and on 99.93% of abilities
  across all 43,829 brought members, mirrors included. Of the 17,709 compared abilities, 12 disagree, and in all 12 the
  reference is wrong, not the extractor (§4).
- In the bo3 store (1-in-5 sample, 7,951 of 39,541 rows), the declared sheets already made items and abilities exact.
  The stored defects were 26 extra moves and the mirror merge, which affected 11,936 of 59,231 members (20.2%). Both
  are 0 after the fix.
- A re-parse is **owed and was not run**. It is about 25 CPU-minutes with flat memory. It rewrites two tracked `.gz`
  blobs that the hourly collector also commits, and it must come after this branch merges. See *OWED, NOT RUN*.

## 1. The instrument

`engine/store_sets_check.js` reads the parsed `.gz` and the raw shards explicitly, by path. For each sampled game it
runs:

- the **reference**: `solver/porygon2/v2/reveal.js` `extract()`, called as is. No third parser was written.
- the **stored row**: what consumers read today.
- a **fresh** `engine/durable-ingest.js` `extract()` of the same log: what a re-parse would write.

The unit is one brought member. Moves are compared as a set over every store key whose base forme is the member's.
Item is the store's item against the reveal's original item. Ability is the base key's ability against the reveal's
base ability. The classifier reads the log only to say why the two parsers differ. It never decides what a set is.

The ingest cannot call `reveal.js`. That file reads the Reg M-C dex from a Showdown checkout, and CI has none. So the
two stay two implementations, and this check is what stops them diverging silently. Stored row = fresh extract on all
5,950 bo1 games before the fix, so the stored rows are this parser's output, not an older one's.

My rates differ from PORYGON2 v2's figures (98.49 / 97.55 / 97.31). Their crosscheck ran on the quality-kept subset
and joined only mega keys to a member. This check joins every battle forme and counts misses apart from wrong values.

## 2. Causes, counted, and the batch that fixed each

Fresh-extract tallies after each batch, on the same bo1 sample. Each batch is one cause. The figures are `wrong` (a
value the log contradicts) and `miss` (log names it, store null). "Rows" is the number of sampled rows whose `sets`
now differ from the store.

| # | cause (stored count on the sample) | fix in `extract()` | effect | rows |
|---|---|---|---|---|
| 1 | `\|cant\|` names the refused move: **67** moves missed; `cant\|X\|ability: A`: 178 abilities missed | credit the move to the mover (`[of]` when present: Armor Tail/Dazzling/Queenly Majesty name the USER there, `data/abilities.ts:225, 874, 3726`); the ability to the holder | move miss 68 → 1; ability miss 1,933 → 1,757 | 287 |
| 2 | called moves credited to the caller: **11** Magic Bounce, 1 Copycat; **16** Struggle | own line, `[from]lockedmove`, Round, Sleep Talk only (reveal.js's rule); never Struggle | move extra 60 → 30 | 317 |
| 3 | a transformed body's moves: **25** | `-transform` marks the slot until it leaves | move extra 30 → 0 | 337 |
| 4 | an item handed over credited as brought: **151** (Trick 133, Switcheroo 7, Pickpocket 5, Magician 4, Thief 2) | not credited; the receiver's later item lines are not its own either (`itemGot`); first item seen wins | item wrong 161 → 9 | 418 |
| 5 | a replaced ability credited as own: **Trace 246**, Simple Beam 16, Skill Swap 14 + 5, Entrainment 11, Worry Seed 2, Role Play 1, Receiver 1, plus 11 follow-on announcements of a copy | `-ability\|X\|NEW\|OLD\|[from] …` (`sim/pokemon.ts:1934`): OLD is X's; for Trace/Role Play/Entrainment/Doodle NEW is the `[of]` body's; X is replaced until it leaves; Skill Swap marks both | ability wrong 318 → 5; ability miss 1,757 → 1,567 | 850 |
| 6 | Ally Switch never moved the slot map: **9** items, **4** abilities on the partner | `\|swap\|` (`sim/battle.ts:1595`) swaps every slot-keyed state | item wrong 9 → 0; ability wrong 5 → 0 | 868 |
| 7 | an item named only on another line: **2,864** on `-damage` (Life Orb), **1,707** on `-heal` (Leftovers), 19 `-activate` | `[from] item: I` → the line's body (the `[of]` body on `-damage`) | item miss 4,603 → 0 | — |
| 8 | an ability named only on another line: 1,565 left after batch 5 (`-damage` Rough Skin, `-heal`, `-fail`, `-item` Frisk, `-start`, `-activate`, `-status`, `-immune`, `-transform` Imposter …) | `[from] ability: A` → the `[of]` body when the line has one, else the line's body; Pickpocket/Magician are the line's body; on `-heal` an absorb heal is the healed body's (§3) | ability miss 1,565 → 0; ability wrong 0 → 12 (§4) | 4,623 |
| 9 | a mirror species is one entry: **5,865** bo1 / **11,936** bo3 members; a bo3 mirror merged two sheets into one set of up to 8 moves | `sets` is kept PER SIDE internally. The mirrored entry is unchanged in shape and gains `mirror: true`; the new top-level `mirrorSets[species] = {p1, p2}` holds each side's own set. Additive, no key a reader uses is renamed | mirror members compared 0 → 5,865 at 100% moves/items | 4,961 |

Batches 7 and 8 were measured in one run. They touch disjoint fields (items, abilities), so the attribution by field
holds.

**A finding that is not a cause and was left alone.** `moves_split_across_keys`: 8,373 stored members, 22% of them,
have moves under both the base key and a mega or battle-forme key, by design (`sets[charizardmegay]` holds the moves
used after mega evolution). A reader of `sets[base]` alone sees part of a moveset. The check joins the keys. Readers
that do not join them under-count megas. This is a consumer convention and is OWED below.

**A finding about spelling, also left alone.** Declared sheets are packed Showdown ids (`LifeOrb`, `SitrusBerry`).
Observed lines are display names (`Life Orb`). Both spellings sit in the bo3 `sets` (bo3 sample, item entries:
`LifeOrb` 8,412 against `Life Orb` 21). Normalising them needs the dex, which the ingest cannot read. Readers must
`toID`. OWED.

## 3. The holder rule in batch 8 was derived, not typed

For each line carrying `[from] ability: A` with an `[of]` body different from the line's own, both bodies were read
against the Reg M-C dex (`solver/human/dex.js`) over the bo1 sample and every bo3 game. Where exactly one of the two can
hold A, it is the `[of]` body on **100,109 of 100,173** lines (99.94%). By command, the `[of]` body is the holder on
`-fieldstart` 55,827, `-weather` 35,571, `-damage` 3,725, `-heal` 2,331, `-status` 1,775, `-item` 717, `-start` 143
and `-clearboost` 20. The line's own body is the holder on 64 lines: `-heal` 32, `-item` 30 (Pickpocket/Magician) and
`-damage` 2. With no `[of]`, the line's own body holds A on **4,780 of 4,821** (99.15%).

`-heal` is the one command where the two disagree. Showdown writes the heal's source in `[of]` (`sim/battle.ts:2295`).
That is the holder for Hospitality (`data/abilities.ts:1878`) and the attacker for an absorb ability
(`data/abilities.ts:1101, 1136, 5343`). Without a dex the protocol separates them: an absorb heal answers the `[of]`
body's move on the previous line, or comes from a foe, and Hospitality follows a switch-in. On the sample this took
ability misses from 11 to 0 and wrong values from 17 to 12.

## 4. What still disagrees, and whose error it is

12 bo1 members: 9 Sinistcha and 3 Sinistcha-Masterpiece, all Hospitality, all with reveal `<UNK>`. Example
`gen9championsvgc2026regmc-2678249700`, line 115:
`|-heal|p1a: RuneriGoat|41/100|[from] ability: Hospitality|[of] p1b: Sinistcha`. The store credits Sinistcha, and the
dex says Sinistcha holds Hospitality. **The reference is wrong here.** `reveal.js` `abilityOK()` accepts any ability
for a body whose own ability was replaced. Here the Runerigus had a replaced ability, so both bodies pass, and `-heal`
is not in reveal's `[of]` list, so it picks the healed body. This is SOLVER's file. It is reported in OWED, not edited.

## 5. Pinned cases, each shown RED on its own break

`tests/test-parse.js` has gone from 42 to 66 checks: nine `CAUSE n` blocks. The line carrying each cause is copied from
a real Reg M-C replay:

- cause 1: `…-2678185870` l.188
- cause 2: `…-2677963350` l.161
- cause 3: `…-2679024360` l.77
- cause 4: `…-2678110480` l.188–191
- cause 5: `…-2678077610`; Skill Swap `…-2678742300` l.59; Entrainment `…-2678170250` l.45
- cause 6: `…-2678184190` l.81, 102
- cause 7: `…-2678199900` l.65
- cause 8: `…-2678184190` l.53, `…-2678249700` l.115, `…-2678082440` l.72

The lines around each cause are hand-written in the same protocol shapes.

Each break reverts ONE fix in a temporary copy of the extractor and runs the test against it. The worktree's files were
never edited. Result (intact: 66 passed, exit 0):

| break | exit | own checks RED | other checks RED |
|---|---|---|---|
| 1 cant credit off | 1 | 2 | 0 |
| 2 calledBy/Struggle off | 1 | 2 | 0 |
| 3 transform flag off | 1 | 1 | 0 |
| 4 received-item rule off | 1 | 1 | 0 |
| 5 replaced-ability rule off | 1 | 4 | 0 |
| 6 swap off | 1 | 2 | 0 |
| 7 other-line item off | 1 | 2 | 0 |
| 8 other-line ability off | 1 | 5 | 0 |
| 9 one shared map (the old shape) | 1 | 4 | 0 |

The other tests that call the extractor:

- `tests/test-click-censoring.js`: GREEN.
- `solver/tests/test-rotom-replays.js`: 41/41.
- `tests/test-next-regulation.js`: GREEN. It was RED only when I ran it with `SHOWDOWN_PATH` pointed at the Reg M-C
  checkout. It reads the local format list, and it is GREEN without the override.

## 6. What a re-parse changes (sampled, fresh vs stored)

- **bo1** (6,247 rows sampled): 5,181 rows (83%) change.
  - `sets` changes in 5,174 rows, `mirrorSets` is added to 1,700, and `turns` changes in 81 (the `mon`/`tgt` after an
    Ally Switch).
  - Known items over all set entries go from 20,771 to 25,816, and known abilities from 19,454 to 22,148.
  - Largest item moves: Life Orb **90 → 2,764**, Leftovers **272 → 2,189**, and Choice Scarf **133 → 59** (Trick
    receivers removed).
  - Largest ability moves: Trace 24 → 406, Rough Skin 11 → 392, Hospitality 46 → 361, Intimidate 4,442 → 4,375
    (Traced copies removed).
- **bo3** (7,951 rows): 5,512 rows (69%) change.
  - `sets` changes in 5,500 rows, `mirrorSets` is added to 5,352, and `turns` changes in 18.
  - Known items go from 98,699 to 98,724.

**Item usage counted from `sets` under-counted every item that does not announce itself.** Life Orb was 30× under on
bo1. Any figure built from `sets` items on the bo1 store is affected. The declared-sheet counts (`sheet-usage`,
`usage_regulation`'s set table) read `sheets` and are not affected.

Cost, measured: the test store (600 rows cut from the bo1 store) ran through `engine/reparse_store.js --write` in
78 s. Almost all of that was streaming the 282 raw shards. The sampled impact run took 12 ms per row on bo1 and
30 ms per row on bo3. That includes reading and parsing the stored row and the comparison, so the extract alone is less. Full stores: bo1 about 7–13 min, bo3 about 15–20 min, one core each. Memory is
ids and byte offsets only, plus a temporary file in the OS temp directory of about the plain store's size (218 MB bo1,
242 MB bo3).

## 7. Downstream, and the order

**Order:**

1. Merge this branch to main, so the hourly collector parses new rows with the fixed extractor.
2. Re-parse both `.gz` stores and swap them in, then reconcile.
3. Regenerate the artifacts below.

**Moves after a re-parse:**

- `data/store-validation-regmc.json`. Its REVEALED ruler judges `g.sets`. Traced abilities, Trick items and bounced
  moves stop being judged as the holder's. `validate_store.js` should read `mirrorSets` for a mirrored key; until it
  does, a mirrored entry is judged on the merged set, as today.

**Digest-stale, figures expected unchanged** (each stamps the store's sha256, so provenance calls it stale):

- `data/meta-usage-regmc.json` (`engine/usage_regulation.js` reads `sheets`, `six`, `brought`).
- The PORYGON2 v2 datasets and `solver/porygon2/v2/manifest-bo{1,3}.json`. Positions come from the raw logs and are
  identical. The `crosscheck_vs_store_sets` block moves to about 100%.
- `solver/meta` `games.clean`. `mega.from` changes only where a mega followed an Ally Switch.

**Not affected:**

- **The frozen pool `data/team-pool-frozen-regmc/` must not change, and the re-parse cannot change it.**
  `reparse_store.js` writes only `<store>.jsonl.gz.reparsed` beside the store it was given.
- Everything counted from the pool: `sheet-usage-regmc`, `click-counts-regmc`, `move-priors-regmc`,
  `rollout-switch-census-regmc`.
- CHOMP v2's tables and spreads (pool and `sheets`).
- The arena spreads (`sheets`; population pinned by git blob `27825c32`).

**Pool rows keep the old parser's `sets` by design.** A future re-cut (`engine/cut_regmc_pool.js`) is a new pool,
Will's call.

`engine/provenance.js --graph` does not see the Reg M-C store as an input of any `-regmc` artifact. Every `from` list is
empty of `games.*regmc*`, because those generators build the path at run time. So it will not flag these on its own.
The list above was derived by reading which generators open the live `.gz` and which fields they read.

## OWED, NOT RUN

1. **Re-parse the two Reg M-C stores.** Run this after this branch merges, and between two hourly collector commits.
   Run from the main checkout, at below-normal priority. The first pair is the dry run, which writes nothing beside
   the store:

   ```cmd
   tools\lownode.cmd engine\reparse_store.js --store data\games.gen9championsvgc2026regmc.jsonl.gz --raw data\raw\games.gen9championsvgc2026regmc --raw-plain data\games.gen9championsvgc2026regmc.raw-logs.jsonl
   tools\lownode.cmd engine\reparse_store.js --store data\games.gen9championsvgc2026regmcbo3.jsonl.gz --raw data\raw\games.gen9championsvgc2026regmcbo3 --raw-plain data\games.gen9championsvgc2026regmcbo3.raw-logs.jsonl
   ```

   Then the same two with `--write`. Each must exit 0 with `lost_ids: 0`. Then swap and reconcile:

   ```cmd
   move /Y data\games.gen9championsvgc2026regmc.jsonl.gz.reparsed data\games.gen9championsvgc2026regmc.jsonl.gz
   move /Y data\games.gen9championsvgc2026regmcbo3.jsonl.gz.reparsed data\games.gen9championsvgc2026regmcbo3.jsonl.gz
   node engine\next_regulation_ingest.js --reconcile
   ```

   Re-check before committing:

   ```cmd
   node engine\store_sets_check.js --fmt bo1 --every 10
   ```

   Expect `stored_differs_from_fresh` 0 (`SHOWDOWN_PATH` set to the Reg M-C checkout).

   **Growth budget:** the two blobs are rewritten whole, about 48 MB + 40 MB. Because 69–83% of rows change mid-line,
   expect most of that in the pack. Both stay far under the 100 MB per-file wall. Not run here for three reasons: it
   writes tracked files in the main checkout, it races the collector's hourly commit of the same blobs, and RAM was
   tight with other jobs live.
2. **Then regenerate**, in this order: `node engine/validate_store.js --regulation regmc --write`;
   `node engine/analyze.js --regulation regmc` (meta-usage restamp); PORYGON2 v2 `extract.js` for bo1 and bo3 (SOLVER);
   `solver/meta/extract.js` (SOLVER).
3. **SOLVER: `solver/porygon2/v2/reveal.js` Hospitality.** `abilityOK()` accepts any ability for a body whose own
   ability was replaced, and `-heal` defaults to the healed body. On the sample this misses 12 Hospitality holders. It
   is SOLVER's file, so it was not edited here.
4. **`engine/validate_store.js` should judge `mirrorSets[sp][side]`** for a mirrored key, not the merged entry.
5. **Consumers of `sets` should join a member's forme keys** (base + mega/battle forme). 22% of bo1 members are split.
   They should also compare names by `toID`, because declared sheets use packed ids.
6. **`engine/provenance.js` does not see the Reg M-C stores as inputs** of the `-regmc` artifacts (§7).
7. **`node engine/status.js --write` was not run.** It writes from the tree it runs in, and from a worktree it records
   missing untracked files as fact. Run it from main after the merge.
