# Open-sheet bo3 play is one classifier: the custom OTS + Bo3 rooms, every other custom room, our own accounts — 2026-10-01

MEASURE, abra/regmc 1.65.0. Streaming store reads, one custom-rule scan, one TeamValidator pass, one usage-model
regeneration and one human-dataset build to a scratch directory. No simulator, no games played, no gate run.

## Verdict

1. **Will's decision is implemented as one function.** `engine/quality.js` `customRuleRegime(format, rulesText)` and
   `isOpenSheetBo3(game[, rulesText])` answer "is this the game we play?": the bo3 format, or the bo1 format under
   custom rules that leave exactly Force Open Team Sheets + Best of = 3 and nothing else. The rule text is Showdown's
   own infobox from the raw log; the bases come from `data/regulations.json`. It is not an id list.
   `tests/test-open-sheet-bo3.js` checks it against Showdown's own rule table for all 33 (format, rule string) pairs
   the scan has seen: **33 of 33 agree**, GREEN 55/55, and **RED (8 failures) on a deliberate break** (the
   `!force` clause disabled), GREEN again after restoring.
2. **The 296 bo1-format OTS + Bo3 rooms** (283 on 09-30; the store grew): all 296 show sheets, all are **unrated**
   custom rooms, **78 are before 2026-09-14, and the Eject Button rule removes 2**. 294 enter the open-sheet
   population and 208 of them pass every quality rule.
3. **Every other custom room is now excluded** — 2,300 store games, against 98 under the 1.36.0 rule. Every rule
   string and its verdict is in §2.
4. **Our own accounts:** `medicham32` is in the bo3 store **115 times** (2026-09-25 to 09-30), passing the bot-name
   pattern and the behavioural rule. `willhoop` is in the bo1 store 8 times. Declared once, excluded everywhere: 123
   games, 88 of them by no other rule.
5. **The bad news in the scope change:** a bo1 game whose sheets were offered and accepted is bo1 play, so it leaves
   the open-sheet views. That is **2,068 games (606 clean)**, and it takes **all 14 clean games at ≥ 1500** with it.
   The open-sheet population at ≥ 1500 is now **0 clean games** (1 game in all). The bo3 store never had any.
6. **No other regulation is mixed in** (0 ids of another format in either store). **Legality** is the Reg M-C
   TeamValidator verdict, re-judged on the current stores. The **behavioural-bot rule** is applied (bo1 8,251 games
   flagged, bo3 0).

## 1. What was read

| file (main checkout, read-only) | bytes | sha256 (16) | games |
|---|---:|---|---:|
| `data/games.gen9championsvgc2026regmc.jsonl.gz` (bo1) | 47,887,567 | `8a50cf620f066f07` | 63,048 |
| `data/games.gen9championsvgc2026regmcbo3.jsonl.gz` (bo3) | 39,997,125 | `7c15d94eab4aea2f` | 39,541 |

The worktree's tracked copies are byte-identical (same git-sha1). The scan read 562 raw shards in the worktree,
102,590 raw logs, 0 store rows untestable. Census script: the scratchpad `census.js` (streams both files, calls
`engine/quality.js` for every verdict; nothing reimplemented).

**"Before" is defined as the 1.36.0 rules on the same current stores**: the custom rule excluding only rooms whose
rules alter legality or carry an entity token, the 09-30 legality verdict, and no own-account rule; and the pool
predicate's scope (`openSheet` and both sheets, minus the Eject rule) for "open-sheet".

## 2. Every custom rule string, its count and its verdict

Store games, joined (2,596 of 2,597 detected rooms; the other id is not in the store).

| rows | format | rules | classifier | 1.36.0 excluded? | now |
|---:|---|---|---|---|---|
| 1221 | bo1 | `Best of = 3` | not_open_sheet | no | excluded |
| 891 | bo1 | `Force Open Team Sheets` | not_bo3 | no | excluded |
| 296 | bo1 | `Force Open Team Sheets, Best of = 3` | open_sheet_bo3 | no | **kept** |
| 21 | bo1 | `!Obtainable` | other_rules | yes | excluded |
| 21 | bo1 | `Best of = 3, !Open Team Sheets` | not_open_sheet | no | excluded |
| 19 | bo1 | `Best of = 3, !OpenTeamSheets` | not_open_sheet | no | excluded |
| 15 | bo1 | `+past, ! Obtainable Moves` | other_rules | yes | excluded |
| 14 | bo1 | `Camomons Mod, !Team Preview, Team Type Preview, !Open Team Sheets, Best of = 3` | other_rules | no | excluded |
| 11 | bo1 | `-Basculegion-M, OHKO Clause, Evasion Moves Clause, …` (14 rules) | other_rules | yes | excluded |
| 11 | bo3 | `natdex mod, !obtainable moves` | other_rules | yes | excluded |
| 10 | bo1 | `-Basculegion-M, Evasion Moves Clause, OHKO Clause, …` (14 rules) | other_rules | yes | excluded |
| 8 | bo1 | `Best Of = 3` | not_open_sheet | no | excluded |
| 7 | bo1 | `force open team sheets, !open team sheets` | not_bo3 | no | excluded |
| 5 | bo1 | `-Basculegion, Evasion Moves Clause, OHKO Clause, …` (14 rules) | other_rules | yes | excluded |
| 5 | bo1 | `!open team sheets` | not_open_sheet | no | excluded |
| 5 | bo1 | `! Open Team Sheets, Best of = 3` | not_open_sheet | no | excluded |
| 5 | bo1 | `Camomons Mod, !Team Preview, Team Type Preview, !Open Team Sheets` | other_rules | no | excluded |
| 4 | bo1 | `+heatran` | other_rules | yes | excluded |
| 4 | bo3 | `natdex mod, !obtainable moves, !force open team sheets` | other_rules | yes | excluded |
| 3 | bo1 | `-all moves, +air slash, …` (27 rules) | other_rules | yes | excluded |
| 3 | bo1 | `+nonexistent, +unreleased, +airslash, !ObtainableMoves` | other_rules | yes | excluded |
| 3 | bo1 | `+nonexistent` | other_rules | yes | excluded |
| 3 | bo1 | `+past, Best Of = 3, ! Obtainable Moves` | other_rules | yes | excluded |
| 3 | bo1 | `!Open Team Sheets, Best Of = 3` | not_open_sheet | no | excluded |
| 2 | bo1 | `Force Open Team Sheets, +Metagross + Heavy Slam` | other_rules | yes | excluded |
| 2 | bo1 | `Best of = 3, +past, ! Obtainable Moves` | other_rules | yes | excluded |
| 1 | bo1 | `-Basculegion, OHKO Clause, Evasion Moves Clause, …` (14 rules) | other_rules | yes | excluded |
| 1 | bo1 | `bestof = 3, Evasion Abilities Clause, Evasion Items Clause, Evasion Moves Clause, OHKO Clause` | other_rules | no | excluded |
| 1 | bo1 | `force open team sheets, !open team sheets, max move count=7` | other_rules | no | excluded |
| 1 | bo1 | `Best of = 5` | not_open_sheet | no | excluded |

`not_open_sheet` = sheets offered (bo1's base `Open Team Sheets`) or removed, not forced. `not_bo3` = sheets forced,
one game. The smogtours rooms are counted under the format they were played in. The per-string table is also in
the artifact: `data/custom-ruleset-ids-regmc.json` `verdict_by_format_and_rules`.

**For Will, one call left visible:** `Best of = 3` alone in the bo1 format (1,221 rooms; 202 of them had sheets
offered and accepted by both players) is a bo3 series with open sheets by consent rather than by rule. Showdown's
rule table says it is not the bo3 format's game, and Will's rule ("only the OTS + Bo3 set") excludes it. It is
excluded. If he wants consent-OTS bo3 counted, it is a one-line change in `customRuleRegime()` and the oracle test.

## 3. Per rule, per store (collected → clean)

Games flagged by each rule (a game can carry several), on the current stores.

| rule | bo1 (63,048) | bo3 (39,541) |
|---|---:|---:|
| named bot | 6,637 | 228 |
| behavioural bot | 8,251 | 0 |
| forfeit before any action | 400 | 238 |
| under 3 turns | 5,326 | 2,677 |
| partial bring | 21,768 | 12,117 |
| illegal team (Reg M-C TeamValidator; 09-30 verdict → re-judged) | 35 → 43 | 13 → 15 |
| custom ruleset (1.36.0 rule → now) | 83 → 2,285 | 15 → 15 |
| own account (new) | 8 | 115 |
| another regulation's id | 0 | 0 |
| **clean, 1.36.0 rules → now** | **31,615 → 30,021** | **27,227 → 27,145** |

The bo3 drop of 82 is our own account alone (`medicham32` games no other rule removes). The bo1 drop is the custom
rule.

## 4. The open-sheet population, by rating band

Lower-rated player's band. "Before" = the pool predicate's scope (bo1 games with sheets shown, plus bo3) under the
1.36.0 rules. "After" = `isOpenSheetBo3()` plus the pool predicate (both sheets, minus the Eject rule) under the
current rules. Clean = passes every `quality.js` rule.

| band | before, all | before, clean | after, all | after, clean |
|---|---:|---:|---:|---:|
| < 1100 | 17,619 | 11,833 | 17,321 | 11,576 |
| 1100–1299 | 14,339 | 9,910 | 14,005 | 9,726 |
| 1300–1499 | 1,303 | 882 | 1,172 | 805 |
| ≥ 1500 | 18 | 14 | 1 | **0** |
| unrated | 8,285 | 5,917 | 6,986 | 4,999 |
| **total** | **41,564** | **28,556** | **39,485** | **27,106** |

Against the bo3 store alone (what the human dataset and the PORYGON2 v2 bo3 set read before): 39,202 all / 26,980
clean before, 39,485 / 27,106 after. **The promotion adds 294 games (208 clean), all unrated**; it adds nothing to
any rated band.

What leaves (bo1, sheets shown, not open-sheet bo3; 2,068 games, 606 clean under the current rules):

| why | games |
|---|---:|
| no custom rule: sheets offered and accepted | 977 |
| `Force Open Team Sheets` alone (one game) | 879 |
| `Best of = 3` alone (sheets by consent) | 202 |
| `force open team sheets, !open team sheets` | 7 |
| `Force Open Team Sheets, +Metagross + Heavy Slam` | 2 |
| `force open team sheets, !open team sheets, max move count=7` | 1 |

**The usage model** (`data/meta-usage-regmc.json`, regenerated): usable games 27,063 → **27,106**. The old file
was counted on the 09-30 store, so this mixes store growth with the rule change; the split above is the clean
isolation. Top-10 by team rate: Garchomp enters at 9 (0.1797), Arcanine-Hisui leaves (0.168); the largest team-rate
moves are Garchomp +1.20 pp, Salamence −0.94, Incineroar +0.91 (store growth included).

## 5. The 296 OTS + Bo3 rooms

| | |
|---|---:|
| rooms | 296 |
| first / last | 2026-09-10 16:50 / 2026-09-30 17:33 |
| `openSheet` true, both sheets present | 296 / 296 |
| rated | 0 |
| before 2026-09-14 | 78 |
| removed by the Eject Button rule | 2 |
| kept by the pool predicate | 294 |
| clean (every quality rule) | 208 (86 partial bring, 13 short, 1 forfeit before action) |

**Human dataset** (`solver/human/build_dataset.js`, built to the scratchpad, not to `solver/out`): it read 63,049
bo1 raw rows, held the 296 rooms, and kept **290** (2 Eject Button, 3 Illusion on a sheet, 1 no action). Whole
dataset: 38,363 kept of 39,837 unique games; 115 excluded as `own_account`.

## 6. Consumers

**Changed (each calls the one classifier; four typed own-account lists removed):**

| file | change |
|---|---|
| `engine/quality.js` | `customRuleRegime`, `isOpenSheetBo3`, `customRulesOf`, `formatOfId`, `ownAccounts`, `isOwnAccount`; per-regulation custom verdicts classified at read time; `own_account` reason and funnel step |
| `engine/quality.py` | `own_account` reason and funnel step (its custom-rule set is the scan's `ids`, which the scan now splits with the JS classifier) |
| `engine/scan_custom_rulesets.js` | splits `ids` / `ids_open_sheet_bo3` with the classifier; publishes `verdict_by_format_and_rules` |
| `data/quality-filter.json` 1.7.0 | `rules.exclude_own_accounts` (medicham32, willhoop, MAG, each with evidence) |
| `engine/usage_regulation.js` | adds `isOpenSheetBo3` after the pool predicate; funnel counts `excluded_not_open_sheet_bo3` |
| `solver/human/build_dataset.js` | reads bo1 raw shards; keeps only open-sheet bo3 rooms; custom rule and own account via `quality.js`; bo1 rooms judged by the bo1 store's bot set |
| `solver/porygon2/v2/extract.js` | `--fmt bo3` also reads the bo1 store and raw logs for those rooms; custom rule and own account via `quality.js`. `--fmt bo1` (the closed-sheet stream) keeps excluding every custom room |
| `solver/meta/extract.js` | new reason `not_open_sheet_bo3`; custom rule and own account via `quality.js`; every row carries `open_sheet_bo3` |
| `solver/rotom/build_top_rotation.js` | own account via `quality.js` (still per side: the opponent's side is a human team); `isOpenSheetBo3` on the bo3 store. The bo1 rooms are not read: all are unrated and the rotation rule needs both ratings |
| `solver/chomp/data.js` | keeps a human-dataset game whose custom rules are the open-sheet bo3 set |

**Deliberately left alone:**

- **`engine/cut_regmc_pool.js`, `engine/regmc_pool_predicate.js` and `data/team-pool-frozen-regmc`.** Measurements
  pin the pool. It is not re-cut. **If it were re-cut today** under the new rule: the bo3 half (23,473 rows) is
  unchanged, all open-sheet bo3; the `ots` half (1,359 rows) would keep 197 and lose **1,162** (587 sheets offered not
  forced, 573 sheets forced in one game, 2 other rules); 0 own-account games and 0 illegal games are in it.
- `engine/regulation_stores.js` (steering inputs counted over the frozen pool, by design).
- `solver/chomp/v2/build_spreads.js` (reads the frozen pool), `solver/arena/build_spreads.js` (a pinned historical
  store blob), `solver/xatu/*` and `solver/doduo/loss_replays.js` (raw logs as fixtures and our own losses, not a
  human-play dataset), `engine/validate_store.js` (judges every stored game; it is the verdict, not a dataset).

## 7. Legality, regulations, the bot rule

- **Legality.** `data/store-validation-regmc.json` was re-judged on the current stores (bo3 39,541 of 39,541, bo1
  62,649 revealed and 2,390 declared). 58 ids are keyed (species or declared banned item, either ruler). On the
  declared bo3 ruler, every move complaint co-occurs with a species or item complaint (move-only 0) and there are 0
  ability complaints, so on open sheets the species/item key also covers moves and abilities. Move-only rejections
  on the revealed ruler stay unkeyed on purpose (the Illusion rule in `quality.js`). The human and PORYGON2 datasets
  also drop any illegal species, item, ability or move on a sheet themselves.
- **Other regulations.** 0 ids of another format in either store (only `gen9championsvgc2026regmc[bo3]` and their
  `smogtours-` rooms).
- **Behavioural bots.** Applied with the 1.36.0 tempo clause: bo1 8,251 games flagged, bo3 0.

## OWED, NOT RUN

- **SOLVER: re-run `solver/human/build_dataset.js`, `solver/porygon2/v2/extract.js --fmt bo3` and
  `solver/meta/extract.js` on the main checkout.** Their outputs in `solver/out/` still hold the old population.
  The human dataset was built here only to a scratch directory to prove the bo1 rooms flow through.
- **`node engine/status.js --write` from the main checkout after merge.** From a worktree it writes missing
  untracked files as fact.
- **`tests/test-quality.js` was not run**: it needs the Reg M-B `data/games.ladder.jsonl`, which this worktree does
  not hold. Python's selection is identical by construction (it reads the scan's `ids`, which the JS classifier
  wrote), not by a run.
- **`solver/tests/test-meta-artifacts.js` cannot run here**: it reads `solver/out/meta/manifest.json`, which the
  worktree does not have.
- **Will's call, if he wants it:** whether bo1 `Best of = 3` rooms with sheets offered and accepted (202 games) count.
- **The frozen pool's `ots` half carries 1,162 games that are no longer the game we play.** Not re-cut; a re-cut is
  a new pool and a new measurement series, and that is Will's call.
- **Re-run the scan and the validator as the stores grow.** Both are snapshots of the stores above.
