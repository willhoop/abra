# Two open-sheet answers: turn play for turn-level models, bo3 for series uses, and the consent bo3 room — 2026-10-01

MEASURE, abra/regmc 1.66.0 (number to be confirmed at merge; built on the 1.64.0 classifier branch, `f18711ec`).
Streaming store reads, one custom-rule scan, one usage-model regeneration. No simulator, no games played, no gate run,
the frozen pool untouched. Every process ran at BelowNormal priority.

## Verdict

1. **Two answers, one classifier.** `engine/quality.js` now gives `isOpenSheetTurnPlay(g)` beside `isOpenSheetBo3(g)`,
   both from `openSheetRegime(g, rulesText)`: the room's rule text (unchanged parser, `customRuleRegime()`) plus whether
   the game itself shows both sheets (`bothSheetsShown(g)`: the stored `sheets.p1` and `sheets.p2`, or `sheetsShown` from
   a caller holding only the raw log). No id list. `isOpenSheetBo3` implies `isOpenSheetTurnPlay`.
2. **Decision 1 (bo1 games where both accepted sheets count for turn-level models):** on the same stores, open-sheet
   turn play is **41,935 games, 28,713 clean**, against 39,852 / 27,332 under the 1.64.0 rule (+2,083 / +1,381).
   **Clean open-sheet games rated 1500+ for turn-level models: 0 → 14** (18 games in all). For series uses it stays **0**.
3. **Decision 2 (bo1 `Best of = 3` rooms where both accepted sheets are open-sheet bo3):** **205 rooms, 147 clean, all
   unrated**, 2026-09-09 17:47 to 2026-10-01 07:26. Open-sheet bo3: 40,057 / 27,479 against 39,852 / 27,332. The usage
   model `data/meta-usage-regmc.json` reads **27,479 usable** (27,106 at 1.64.0; the difference mixes store growth with
   the 147).
4. **The custom-rule charge now asks the game.** A room whose rules touch only the sheets and the series length
   (`Best of = 3`, `Force Open Team Sheets`, `force open team sheets, !open team sheets`) is no longer excluded by its
   text: `reasons()` charges `custom_ruleset` only when the game did not show both sheets. A room under any other rule
   (a clause, a ban, a mod, `max move count`, `+Metagross + Heavy Slam`) is still excluded, sheets or not. The scan
   artifact publishes the three classes (`ids`, `ids_open_sheet_bo3`, `ids_sheet_rules_only`); `quality.py` mirrors it.
   JS and Python charge the same games: **bo1 1,187, bo3 15**.
5. **Tests.** `tests/test-open-sheet-turn-play.js` GREEN 27/27; RED 4 failures with the consent path disabled, RED 2
   failures with the sheet test removed from the custom-rule charge; GREEN again after restoring (byte-identical, `cmp`).
   `tests/test-open-sheet-bo3.js` GREEN 55/55 (one assertion updated: a sheets-offered room is now decided by its sheets,
   and with none shown it is still excluded).
6. **One call made here that Will may want to reverse:** the 880 bo1 rooms under `Force Open Team Sheets` alone (one
   game, sheets forced) are counted as turn play and are clean under the custom-rule rule. They are in the 2,068 the
   decision named, and their only rule is the one that shows the sheets. The decision's "606 clean" was computed with
   them charged as custom rooms; uncharged, the bo1 turn-play addition is 1,234 clean. Reversing it is one line in
   `openSheetRegime()` (require `offer` rather than `force || offer` for a bo1 room) and one fixture.

## 1. What was read

| file (main checkout, read-only) | bytes | sha256 (16) | unique games |
|---|---:|---|---:|
| `C:/Users/willj/Projects/Pokemon/ABRA/data/games.gen9championsvgc2026regmc.jsonl.gz` (bo1) | 48,502,089 | `489cfa4de54b82b3` | 63,862 |
| `C:/Users/willj/Projects/Pokemon/ABRA/data/games.gen9championsvgc2026regmcbo3.jsonl.gz` (bo3) | 40,362,272 | `f04f8a86fe409808` | 39,908 |

The worktree's tracked copies are byte-identical (same sha256), and both checkouts hold 283 raw shards per format.
The custom-rule scan (`engine/scan_custom_rulesets.js --regulation regmc`) read the worktree's raw shards: 103,771 raw
logs, 0 store ids untestable, 2,608 detected rooms joined to the store: 120 `ids` (other rules), 296
`ids_open_sheet_bo3`, 2,193 `ids_sheet_rules_only`, **0 split disagreements** with the read-time classifier.

Census: a scratch script that streams both stores and calls `engine/quality.js` for every verdict (`reasons()`,
`behaviouralBots()` per store, `openSheetRegime()`) and `engine/regmc_pool_predicate.js` `keep()` (both sheets, minus
the Eject Button rule). Nothing reimplemented. **"Before" is the 1.64.0 rule expressed with the same primitives on the
same stores and the same scan:** `custom_ruleset` for every scanned room that is not open-sheet bo3 by its text, and
open-sheet = the rule-text verdict alone (no consent path, no turn class; turn-level consumers read the bo3 class).

Band = the lower-rated player's rating; a game with either rating missing is `unrated`. Clean = no `quality.js`
reason. Every row below is also inside the pool predicate (both sheets shown, Eject rule applied), as in the 1.64.0
report.

## 2. Open-sheet bo3 (series-level uses), by rating band

| band | before, all | before, clean | after, all | after, clean |
|---|---:|---:|---:|---:|
| < 1100 | 17,457 | 11,661 | 17,457 | 11,661 |
| 1100–1299 | 14,171 | 9,826 | 14,171 | 9,826 |
| 1300–1499 | 1,205 | 825 | 1,205 | 825 |
| ≥ 1500 | 1 | 0 | 1 | **0** |
| unrated | 7,018 | 5,020 | 7,223 | 5,167 |
| **total** | **39,852** | **27,332** | **40,057** | **27,479** |

The whole change is the 205 consent rooms (147 clean), every one unrated: a custom room is never rated.

## 3. Open-sheet turn play (turn-level models), by rating band

| band | before, all | before, clean | after, all | after, clean |
|---|---:|---:|---:|---:|
| < 1100 | 17,457 | 11,661 | 17,757 | 11,844 |
| 1100–1299 | 14,171 | 9,826 | 14,511 | 10,007 |
| 1300–1499 | 1,205 | 825 | 1,338 | 904 |
| ≥ 1500 | 1 | 0 | 18 | **14** |
| unrated | 7,018 | 5,020 | 8,311 | 5,944 |
| **total** | **39,852** | **27,332** | **41,935** | **28,713** |

The bo1 turn-play games that are not series (1,878 games, 1,234 clean), by band: < 1100 300 / 183, 1100–1299 340 / 181,
1300–1499 133 / 79, **≥ 1500 17 / 14**, unrated 1,088 / 777. Every rated game in the addition is a bo1 ladder game:
its rating is the bo1 ladder's, not the bo3 ladder's.

## 4. The bo1 games with both sheets shown that are not open-sheet bo3

| rules | games | verdict | clean |
|---|---:|---|---:|
| none (offered and accepted) | 991 | turn play | 615 |
| `Force Open Team Sheets` | 880 | turn play | 616 |
| `force open team sheets, !open team sheets` | 7 | turn play | 3 |
| none, Eject Button before 2026-09-14 | 8 | out (pool rule) | — |
| `Force Open Team Sheets`, Eject Button before 2026-09-14 | 12 | out (pool rule) | — |
| `Force Open Team Sheets, +Metagross + Heavy Slam` | 2 | out (changes play) | — |
| `force open team sheets, !open team sheets, max move count=7` | 1 | out (changes play) | — |

With the 205 consent rooms this is the decision's 2,068 (on the 1.64.0 store) at 2,106 on today's.

## 5. Which consumer uses which answer

**Turn-level → `isOpenSheetTurnPlay`:**

| consumer | change |
|---|---|
| `solver/human/build_dataset.js` (the human decision dataset) | admits open-sheet turn play; every kept game carries `game.open_sheet_bo3` and `game.open_sheet_bo3_by_consent`; manifest counts `open_sheet_bo3`, `open_sheet_turn_play_only`, `open_sheet_bo3_by_consent`. A custom rule other than a sheet or best-of rule still excludes the room |
| everything that reads the human dataset at the turn level, unchanged and now fed the wider set: `solver/mag/build_features.js` (MAG), `solver/prior/build_features.js` (the human prior), `solver/doduo/eval_gates.js` (DODUO), `solver/miltank/eval_kl_human.js`, `solver/arena/mega_rate.js`, `solver/arena/mega_timing.js`, GARY (N1, to build on this dataset), the ROTOM clock table in `solver/rotom/build_assets.js` | none needed |
| `solver/porygon2/v2/extract.js --fmt bo3` (PORYGON2 v2 open-sheet stream) | promotes every bo1 turn-play game, not only the bo3 rooms; each row carries `open_sheet_bo3`; slim rows carry `sheetsShown` so `reasons()` can judge a sheet-rules-only room |

**Series-level → `isOpenSheetBo3`** (the consent rooms are now in):

| consumer | change |
|---|---|
| `engine/usage_regulation.js` → `data/meta-usage-regmc.json` (CHOMP's usage prior) | none in code (store rows carry sheets); regenerated: usable 27,479 |
| `solver/meta/extract.js` (GURU: bo3 rates, bring/lead, set library) | passes `sheetsShown`; `custom_ruleset` now charged only for rules that change play (the series judgement is `not_open_sheet_bo3`) |
| `solver/chomp/data.js` (CHOMP, its bo3 λ rates via `solver/out/meta/bo3.json`) | drops `open_sheet_bo3 === false`; a custom room is kept when `isOpenSheetBo3(g)` (consent included) |
| `solver/rotom/build_top_rotation.js` (rotation selection by series) | none: it reads the bo3 store only, and the bo1 rooms are unrated |
| `solver/rotom/build_assets.js` team candidates | `open_sheet_bo3 !== false` |
| `solver/xatu/eval_bring.js` (bring, a preview decision) | drops `open_sheet_bo3 === false` |
| `solver/arena/teams.js` and `solver/mew/pairs.js` (the sheet pools played in the arena and in self-play) | drop `open_sheet_bo3 === false`, so the pools are what they were; they already skip every custom room |

**Left alone, deliberately:** `engine/cut_regmc_pool.js`, `engine/regmc_pool_predicate.js` and
`data/team-pool-frozen-regmc` (measurements pin the pool); `solver/porygon2/v2/extract.js --fmt bo1` (the bo1 stream: see
OWED); `solver/xatu/eval_spreads.js`, `solver/xatu/selfplay.js`, `solver/doduo/loss_replays.js`, `solver/dusk/*` (raw-log
fixtures or the stores by format, not the open-sheet population).

## 6. Code

- `engine/quality.js`: `sheetRulesOnly()`, `bothSheetsShown()`, `openSheetRegime()`, `isOpenSheetTurnPlay()`;
  `isOpenSheetBo3()` now goes through `openSheetRegime()`; `customRuleset()` sorts each scanned room into `ids`,
  `allowed` or `conditional`; `reasons()` charges a `conditional` room only when the game did not show both sheets.
- `engine/quality.py`: `conditional` from `ids_sheet_rules_only`, `both_sheets_shown()`, the same charge.
- `engine/scan_custom_rulesets.js`: writes `ids_sheet_rules_only`; `data/custom-ruleset-ids-regmc.json` re-scanned.
- `customRuleRegime()` is unchanged, so the Showdown-oracle test still checks the rule-text parser as it was.

## OWED, NOT RUN

- **SOLVER: rebuild `solver/out/human` (`solver/human/build_dataset.js`), `solver/porygon2/v2/extract.js --fmt bo3` and
  `solver/meta/extract.js` on the main checkout.** Their outputs still hold the 1.64.0 population. Not built here: a
  SOLVER agent is playing screens, and these builds hold every raw shard in memory.
- **SOLVER's call: the PORYGON2 v2 bo1 stream (`--fmt bo1`) already holds the 991 no-rule bo1 games with sheets
  accepted** (it excludes every custom room, so not the 880 forced ones). Once the bo3 stream is rebuilt, those games
  are in both streams. If v2 trains the two streams as one population, drop them from the bo1 stream.
- **Will's call, if he wants it:** whether the 880 `Force Open Team Sheets`-only bo1 rooms count (§ Verdict 6).
- **`node engine/status.js --write` from the main checkout after merge.** From a worktree it writes missing untracked
  files as fact.
- **`tests/test-quality.js` was not run**: it needs the Reg M-B `data/games.ladder.jsonl`, which this worktree does not
  hold. JS and Python agree on the custom-rule charge on both Reg M-C stores (bo1 1,187, bo3 15), by a run.
- **The legality verdict (`data/store-validation-regmc.json`) was not re-run.** The usage regeneration printed
  `[corpus only]` illegal entities from bo3 games newer than the verdict; they are excluded by the dataset builders'
  own entity checks, not by the store verdict.
- **The frozen pool's `ots` half** was cut under the pre-1.64.0 scope. Not re-cut; a re-cut is a new measurement series
  and is Will's call.
- **Re-run the scan as the stores grow.** It is a snapshot of the stores above.
