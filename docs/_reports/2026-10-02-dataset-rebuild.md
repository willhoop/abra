# 2026-10-02 — SOLVER dataset rebuild after the 2026-10-01 store work

SOLVER, abra/regmc 1.76.0. Store-only: no game was played and no simulator was stepped. Every input was read
read-only from the **main checkout** (`C:/Users/willj/Projects/Pokemon/ABRA`, HEAD `b453f104`, last raw shard
`20261002T0152-00`). Each parsed store was named as its `.gz`. Outputs are in this worktree's `solver/out/` and are
not tracked. Each run went through `tools/lownode.cmd` (BelowNormal), one at a time, with
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` (`f10d6798`, the same commit GARY used). The
live ladder batch was not touched. The main checkout's `solver/out/` was not written.

Worktree: `C:/Users/willj/Projects/Pokemon/ABRA/.claude/worktrees/agent-a62cc3c298206828b` (below: `WT`).

## Verdict

- **Human dataset rebuilt: 42,235 games**, sha256 `7ef6b56b…`. That is 40,476 open-sheet bo3 games plus 1,759 bo1
  turn-play-only games. **GARY's dataset is reproduced byte for byte.** Rebuilt with today's code on GARY's 570 shards
  and GARY's bo1 store, the output is `b36bd0fe…`, identical. GARY's 41,138 games are a strict subset of today's
  42,235. All 1,097 new games come from the 8 shards written after GARY's build.
- **PORYGON2 v2 streams rebuilt and DEDUPED: bo1 45,064 games, bo3 42,380, overlap 0.** Without the dedupe, 851
  bo1-format games would have been in both streams. These are rooms where both players accepted the sheets and no
  custom rule was set. The brief's 991 was not reproduced on this store. Those games now stay in the bo3 (open-sheet)
  stream only. bo1 `crosscheck_vs_store_sets` moved as 1.70.0 predicted: items 97.6% → 100%, abilities 97.1% → 99.92%.
  The leak test is GREEN 222,895/222,895, and both deliberate breaks go RED.
- **GURU meta rebuilt at `WT/solver/out/meta/`: 41,641 kept games**, up from 28,274. **A GURU bug was found and
  fixed.** The quality row in `solver/meta/extract.js` did not carry the sheets. So every bo1 `Best of = 3` room
  where both players accepted the sheets was charged `quality:custom_ruleset`, which is 211 rooms that the open-sheet
  classifier admits. A new check in `test-meta-artifacts.js` is GREEN 22/22, and RED (211) on the unfixed run.
- **CHOMP's bo3 λ inputs move by at most 0.0052.** `same_four.lost` 0.2966 → 0.3018 is the largest move. The
  sample is about 1.5× larger. **`archetypes.json` changes k\* from 8 to 6.** The live bot does not read it, but
  ROTOM's team builders do at build time. The swap command is in §4.

## 1. The human dataset (`solver/human/build_dataset.js`)

**Code.** I added three flags; the default behaviour is unchanged.
- `--data-root <checkout>` reads another checkout's `data/`.
- `--bo1-store <file>` names the bo1 parsed store explicitly. It defaults to the `.gz` under the data root.
  `engine/quality.js` `storePath()` would prefer a plain file next to it.
- `--shards-from <manifest>` reads only the shards that an earlier manifest lists, so an earlier build can be
  reproduced.

The manifest records the data root, the shard filter, and the bo1 store's path, bytes and sha256.

Command:
```
node <launcher> solver/human/build_dataset.js --data-root C:/Users/willj/Projects/Pokemon/ABRA --out solver/out/human-20261002
```
(The launcher calls `cmd.exe /c tools\lownode.cmd <script> <args…>` through `spawnSync`, as `tools/lownode.cmd`
prescribes for calls from Bash.) The run took 132 s and exited 0.

| | 2026-09-23 (main `solver/out/human`, v1/DODUO v1) | 2026-10-01 (GARY, `…a9ced8b9…/solver/out/human-20261001`) | **2026-10-02 (this)** |
|---|---|---|---|
| shards read | 203 | 570 | **578** (289 bo3 + 289 bo1) |
| rows in | 28,283 | 42,888 | **44,087** |
| kept | 26,888 | 41,138 | **42,235** |
| open-sheet bo3 / turn-play-only | (no classifier) | 39,412 / 1,726 | **40,476 / 1,759** (199 bo3 by consent) |
| turns / side-turn decisions | 185,480 / 370,960 | 288,381 / 576,762 | **296,485 / 592,970** |
| accounts kept | 6,328 | 9,672 | **9,833** |
| `own_account` excluded | — | 160 | **245** |
| `games.jsonl` sha256 | `9d07c522…` | `b36bd0fe…` | **`7ef6b56b9e5fe0e2c1ef7b16d0dfa40a9527d5a8067f2582f61a173764c2a2a8`** (796,628,124 B) |
| `exclusions.jsonl` sha256 | | | `1db835974d5ff7225259ce026f135daba542f7e5927a85ab17ce5e0857bdc7f2` |
| extract cross-check (leads, brings) | | 41,138/41,138 | **42,235/42,235** |

**By rating band.** The band is set by the lower of the two pre-game ratings. A game is unrated when either rating is
missing. These are the PORYGON2 v2 bands.

| band | 09-23 | 10-01 (GARY) | **10-02** | Δ vs GARY |
|---|---|---|---|---|
| unrated | 2,510 | 5,477 | **5,629** | +152 |
| <1100 | 13,715 | 18,695 | **19,056** | +361 |
| 1100-1199 | 7,896 | 11,664 | **11,997** | +333 |
| 1200-1299 | 2,231 | 3,819 | **3,985** | +166 |
| 1300-1399 | 497 | 1,264 | **1,343** | +79 |
| 1400-1499 | 37 | 200 | **204** | +4 |
| 1500-1599 | 2 | 18 | **19** | +1 |
| ≥1600 | 0 | 1 | **2** | +1 |

**Does GARY's dataset match? Yes, byte for byte.** No file in GARY's builder chain changed between `7f86daf4` and
HEAD (`git diff --stat 7f86daf4 HEAD` over `solver/human`, `engine/quality.js`, `data/quality-filter.json`,
`engine/durable-ingest.js` and `data/regulations.json`). The only difference is the data. I ran
`--shards-from <GARY manifest> --bo1-store <GARY worktree's data/games.gen9championsvgc2026regmc.jsonl.gz>
--out solver/out/human-repro-gary` (180 s) and got `games.jsonl` sha256
`b36bd0fed69b946bc34fc4f9ab7ea2c8e0c884dde55362cf9ee33dfaa02daaea`, which is GARY's exactly. By game id, GARY ⊂
today: 41,138 shared, 0 dropped, 1,097 added. **GARY's fit does not need a rerun for data reasons.** Its EVAL could
grow by the new TEST-player games, but that is a choice, not a defect. The 85 extra `own_account` exclusions are games
our own accounts played in the new shards, and they are excluded as they must be.

What moved, apart from growth: nothing. The open-sheet classifier, the own-account rule and the re-parsed store were
all already in GARY's build.

Manifests: `solver/results/2026-10-02-dataset-rebuild/human-20261002.manifest.json` and
`human-repro-gary.manifest.json`.

## 2. PORYGON2 v2 streams (`solver/porygon2/v2/extract.js`)

**Decision: dedupe, in favour of the bo3 stream.** Why:
1. **One game, one stream.** Both streams split by player with the same salt, so a duplicated game is in the same
   split in both. That means there is no train/test leak across streams. But stage B draws it twice (the 75% bo3
   draw and the 25% bo1 replay), and it sits in both validation sets, so the two validation losses are not
   independent.
2. **It is an open-sheet position.** Both sheets were shown, so the position has no UNK in any sheet field. The bo1
   stream exists to teach the net closed-sheet play with UNK tokens. Will's turn-level rule (`isOpenSheetTurnPlay`,
   2026-10-01) puts these games in the open-sheet data.
3. **It removes a mixed signal.** The bo1 stream's `sheets_public` games were 768 of 41,989 on 2026-09-30. They are
   0 now.

**Code.** In bo1 mode, a game that `engine/quality.js` `isOpenSheetTurnPlay` admits is held out of the bo1 stream.
This is the same call the bo3 mode makes to promote it. The count is in
`funnel.bo1_open_sheet_turn_play_left_to_bo3_stream` and the ids are in `<out>/bo1/left-to-bo3.txt`.

Commands (54 s and 63 s):
```
node <launcher> solver/porygon2/v2/extract.js --fmt bo1 --root C:/Users/willj/Projects/Pokemon/ABRA
node <launcher> solver/porygon2/v2/extract.js --fmt bo3 --root C:/Users/willj/Projects/Pokemon/ABRA
```

**The overlap, measured by id.**
- 2,330 bo1 games are held out as open-sheet turn play. 2,266 of them are in the bo3 output. The other 64 fall to
  bo3's later filters (Illusion, Eject Button, no position).
- Of the 2,266, **851 carry no custom-rule infobox**. The old bo1 stream would also have kept those 851, so they are
  the double-counted games. The other 1,415 have a rule text, which the bo1 stream's `custom_rules` step always
  dropped: `Force Open Team Sheets` 903, OTS + Bo3 302, `Best of = 3` 203, other 7.
- After the dedupe, bo1 ∩ bo3 = **0** of 45,064 × 42,380.

| | bo1 2026-09-30 (k1 trained on) | **bo1 2026-10-02** | bo3 2026-09-30 (k1) | **bo3 2026-10-02** |
|---|---|---|---|---|
| kept games / positions | 41,989 / 286,770 | **45,064 / 307,845** | 36,232 / 251,760 | **42,380 / 296,830** |
| train / val / test games | 26,266 / 7,231 / 8,492 | **28,309 / 7,672 / 9,083** | 23,488 / 5,951 / 6,793 | **27,516 / 7,051 / 7,813** |
| both rated | 38,675 | **41,586** | 30,116 | **33,927** |
| sheets public | 768 | **0** | 36,232 | **42,380** |
| bo1-format rooms promoted (turn play / of them bo3) | — | — | — | **2,472 / 507** |
| gate-A eligible (v1-unseen), all / test | — | — | 8,942 / 1,526 | **13,565 / 2,291** |
| output sha256 | `deb2d205…` | **`b1db27cc3772fb9e6d802d75f507f9212f95a7e475805e01671c66a8e1b5a1d2`** | `8993a422…` | **`3b2a8b92103f351f91736cff869812787eed633cf08f3e7ae526d5760310e0ef`** |
| tracked manifest sha256 | blob `6294044d` @ `d53258e3` | **`bbbfd1d3…`** | blob `9ed8fd02` @ `d53258e3` | **`4bf29e7b…`** |

The 2026-09-30 bo3 stream had no classifier, so it promoted no bo1 rooms and the two streams did not overlap then.
The overlap first appears with the classifier, which is why the rebuild is where the dedupe belongs.

**By rating band (lower rating; games):**

| band | bo1 09-30 | **bo1 10-02** | bo3 09-30 | **bo3 10-02** |
|---|---|---|---|---|
| unrated | 3,314 | **3,478** | 6,116 | **8,453** |
| <1100 | 15,789 | **16,436** | 16,132 | **17,697** |
| 1100-1199 | 10,459 | **11,183** | 9,864 | **11,128** |
| 1200-1299 | 5,992 | **6,532** | 3,069 | **3,675** |
| 1300-1399 | 4,242 | **4,730** | 916 | **1,217** |
| 1400-1499 | 1,650 | **1,984** | 134 | **190** |
| 1500-1599 | 495 | **635** | 1 | **18** |
| ≥1600 | 48 | **86** | 0 | **2** |

**What else moved.**
- bo1 `crosscheck_vs_store_sets`: item 46,190/47,347 → **85,236/85,236**, ability 88,901/91,595 →
  **116,255/116,349**, and moves equal 98.5% → 98.8%. This is the 1.70.0 re-parse, as predicted. The reveal statistics
  (`reveal.js`) did not change, apart from the mix of games.
- bo1 exclusions moved from the raw-log `custom_rules` step (2,312) to quality's `custom_ruleset` (1,144 first) and
  `custom_rules` (51). This is `engine/quality.js` classifying custom rooms since 1.64.0/1.66.0, not a change here.
- bo3 unrated games rose by 2,337 (6,116 → 8,453). The cause was not separated here.

**The k1 model's data receipts are not lost.** Its stage A and stage B metrics stamp `deb2d205…` and `8993a422…`, and
the old manifests are at `d53258e3`. `preregistration.json` says: "A rebuilt dataset is a different dataset: the fit
stamps the sha256 it read."

**Leak test.** `solver/tests/test-porygon2-v2-extract.js` (400 games per format, through lownode) is **GREEN
222,895/222,895**, and both `PORY2V2_BREAK=leak` and `=late` go RED. reveal.js did not change, so this re-confirms
the extractor on today's checkout.

## 3. GURU meta (`solver/meta/extract.js` + `analyze.js`), to a new path

**Code.** I added `--data-root` and `--gz-only`. Receipts name each file relative to the data root.

**Bug fixed.** `qualityRow()` kept `id, date, p1, p2, six, forfeit, brought, turns`, but not the sheets. Since
1.66.0, `reasons()` keeps a sheet-rules-only custom room (`Best of = 3` alone) only when `bothSheetsShown(g)`, which
reads `g.sheets` or `g.sheetsShown`. So every bo1 consent bo3 room was charged `quality:custom_ruleset`. That was
**211 rooms on this store, every one of them a room that `isOpenSheetBo3()` admits.** The row now carries
`sheetsShown: Q.bothSheetsShown(o)`, as `solver/porygon2/v2/extract.js` already did.
`solver/tests/test-meta-artifacts.js` gained a check: no game may be charged a custom-rule reason first, because a
first-charged one has already passed `not_open_sheet_bo3`. It is GREEN 22/22 on the fixed run and **RED** on the
unfixed run ("211 games isOpenSheetBo3() admits were charged a custom-rule reason first"). The unfixed run is kept at
`WT/solver/out/meta-run1-nosheetsShown/`.

Commands (97 s + 219 s unfixed; then fixed):
```
node <launcher> solver/meta/extract.js --data-root C:/Users/willj/Projects/Pokemon/ABRA --gz-only
node <launcher> solver/meta/analyze.js
```

| | **live** (main `solver/out/meta`, 2026-09-23) | **new** (`WT/solver/out/meta`, 2026-10-02) |
|---|---|---|
| stores read | `.gz` **and** the plain `.jsonl` beside each | `.gz` only (66,313 bo1 + 41,615 bo3 rows) |
| distinct ids | 67,370 | 107,928 |
| kept (bo1 / bo3) | 28,274 (559 / 27,715) | **41,641 (522 / 41,119)** |
| first and last date | 2026-09-09 08:08 – 2026-09-23 06:38 | 2026-09-09 08:08 – 2026-10-02 01:51 |
| bo3 `behavioural_bot` (first) | 398 | **0** (quality.js's rule since 2026-09-30; the old copied rule flagged 15 accounts) |
| bo3 `own_account` | 0 | **245** |
| `games.clean.jsonl.gz` sha256 | `96353a78…` | **`82c9c93cc5dc475f90da2e27b787e289be787d5f63e8d4c5339d0c6244c17b7d`** |
| `manifest.json` sha256 | | `4f78bb8973991e0575efd71c95e0fd6611d0a9700eefd31e1fc61f4d7e592c0f` |
| `bo3.json` sha256 | `1b8d4a42…` | **`2d556d4993bbabf03698900464ccd2d1c1ccba84a26ea5db0745cbff3167a84c`** |
| `archetypes.json` k\* | 8 | **6** (the unfixed run, 211 fewer games, picked 8; the k choice is not stable) |
| `usage.json` / `sets.json` / `bringlead.json` / `archetypes.json` sha256 | | `c89f80e6…` / `eb46e9d6…` / `6b98521e…` / `dd23bd75…` |

The bo1 count fell from 559 to 522. The old rule kept any bo1 game with open sheets. Today's rule is open-sheet bo3
only: OTS + Bo3 rooms plus consent `Best of = 3` rooms.

**By rating band (kept games):**

| band | live | **new** |
|---|---|---|
| unrated | 4,584 | **7,531** |
| <1100 | 13,405 | **18,053** |
| 1100-1199 | 7,608 | **11,144** |
| 1200-1299 | 2,132 | **3,623** |
| 1300-1399 | 495 | **1,136** |
| 1400-1499 | 44 | **153** |
| 1500-1599 | 6 | **1** |

**What CHOMP reads.** `solver/chomp/v1/chomp1.js` `bo3Rates()` reads only `summary.by_previous_result`. The fixed
run and the unfixed run give the same `bo3.json` summary values, so the 211 consent rooms change no series rate.

| field | live | new | Δ |
|---|---|---|---|
| **same_four.won** | 0.6098 | 0.6089 | −0.0009 |
| **same_four.lost** | 0.2966 | 0.3018 | +0.0052 |
| **same_lead_pair.won** | 0.4711 | 0.4720 | +0.0009 |
| **same_lead_pair.lost** | 0.2230 | 0.2256 | +0.0026 |
| CHOMP `sl[won]` = min(1, lead/four) | 0.7725 | 0.7752 | +0.0027 |
| CHOMP `sl[lost]` | 0.7519 | 0.7475 | −0.0044 |
| n same_four (won / lost) | 8,820 / 11,268 | 13,114 / 16,731 | |
| n same_lead_pair (won / lost) | 14,494 / 14,494 | 21,541 / 21,541 | |
| all.same_four.rate | 0.4341 | 0.4367 | +0.0026 |
| baseline next-series game 1, same_four | 0.2052 | 0.1999 | −0.0053 |
| series linked | 13,036 | 19,322 | |

Each of CHOMP's four inputs moves by less than its old 95% Wilson half-width (the smallest of the four is 0.0068, on
same_lead_pair.lost). The λ = 0.5
mix itself is unchanged. The swap is a refresh, not a new model.

A copy of the new `bo3.json` and of `manifest.json` is tracked at `solver/results/2026-10-02-dataset-rebuild/`
(`meta-bo3.json`, `meta.manifest.json`).

## 4. Swap commands (for the coordinator, BETWEEN ladder batches only)

Only `solver/out/meta/bo3.json` is read live (`chomp1.js:28`, cached once per `create()`). Swap the whole set so that
`test-meta-artifacts.js` (each artifact's `input.sha256` = the extract's) stays consistent. Keep the old set.
`bo3.json` goes last, through a temporary file and a rename. Git Bash:

```bash
W=C:/Users/willj/Projects/Pokemon/ABRA/.claude/worktrees/agent-a62cc3c298206828b/solver/out/meta
M=C:/Users/willj/Projects/Pokemon/ABRA/solver/out/meta
mkdir -p C:/Users/willj/Projects/Pokemon/ABRA/solver/out/meta-20260923 && cp -p $M/* C:/Users/willj/Projects/Pokemon/ABRA/solver/out/meta-20260923/
for f in games.clean.jsonl.gz manifest.json usage.json sets.json archetypes.json bringlead.json; do cp $W/$f $M/$f; done
cp $W/bo3.json $M/bo3.json.tmp && mv -f $M/bo3.json.tmp $M/bo3.json
sha256sum $M/bo3.json   # expect 2d556d4993bbabf03698900464ccd2d1c1ccba84a26ea5db0745cbff3167a84c
```

Rollback: copy `meta-20260923/*` back the same way.

**Note on `archetypes.json` (k\* 8 → 6).** Nothing live reads it. `solver/rotom/build_ladder_teams.js` and
`build_top_rotation.js` read it when they are run. A team rotation rebuilt after the swap groups by 6 archetypes, not
8. If that is unwanted, leave `archetypes.json` out of the loop. `test-meta-artifacts` will then fail its "computed
from this extract" check for that one file. That is the correct signal.

**Copy the other two datasets into main under DATED names. Never over the old ones.** Main's `solver/out/human/`
is read as "v1's training data" by `solver/porygon2/v2/extract.js` (`v1_unseen`, gate A) and by
`test-porygon2-v3-evalset.js` LEAK. Overwriting it would change both answers. These copies are not read live and can
be made at any time:

```bash
cp -r C:/Users/willj/Projects/Pokemon/ABRA/.claude/worktrees/agent-a62cc3c298206828b/solver/out/human-20261002 C:/Users/willj/Projects/Pokemon/ABRA/solver/out/human-20261002
cp -r C:/Users/willj/Projects/Pokemon/ABRA/.claude/worktrees/agent-a62cc3c298206828b/solver/out/porygon2-v2 C:/Users/willj/Projects/Pokemon/ABRA/solver/out/porygon2-v2-20261002
```

If the worktree is removed before this copy, the outputs are gone. They are untracked, and rebuilding them costs
about 6 minutes with the commands above.

## 5. Tests run

- `solver/tests/test-porygon2-v2-extract.js`: GREEN 222,895/222,895. `leak` and `late` breaks RED.
- `solver/tests/test-meta-artifacts.js`: GREEN 22/22. The new check is RED on the unfixed run.
- `solver/tests/test-meta-lib.js`: GREEN 29/29, with SHOWDOWN_PATH set. Without it, from a worktree, the checkout is
  not found. That is the environment, not the code.
- `solver/tests/test-human-parse.js`: GREEN 24,605/24,605.
- `solver/tests/test-rotom-replays.js`: GREEN 41/41. HYGIENE still finds `isOwnAccount` in both builders.

## OWED, NOT RUN

1. **The swap in §4**, by the coordinator, between ladder batches. Then `node engine/status.js --write` from the main
   checkout. It was not run here, because it is not allowed from a worktree.
2. **PORYGON2 v2 retrain on the deduped streams.** Not run: this is a dataset rebuild only. k1 stays on its 09-30 data,
   and its gate and metrics stand as stamped. A retrain must re-encode the tensors (`encode.js`), and it must state
   whether gate A's v1-unseen set (now 13,565 games) is still the right comparison.
3. **GARY / DODUO refit on the 42,235-game dataset.** Not needed for correctness, because GARY's data reproduces
   exactly. It is optional growth: 1,097 more games.
4. **`archetypes.json` k\* instability** (8 on one run, 6 on the next, 211 games apart; ARI medians 0.47–0.72). This
   is GURU's archetype selection, owed by SOLVER. The team builders that read it should pin an archetype file by
   sha256, or the k grid should be fixed, before the next rotation rebuild.
5. **The brief's 991 overlapping games was not reproduced.** It measures 851 on this store, by the method in §2. If 991
   came from an earlier store or a different rule (for example, counting rooms with `Force Open Team Sheets` alone),
   the difference is unexplained here.
6. **Items 2–4 of the 1.70.0 report's OWED stand.** These are the `usage_regulation.js` ABRA-HEAP header,
   `reveal.js` Hospitality, `validate_store.js` `mirrorSets`, and provenance for the `-regmc` artifacts.
