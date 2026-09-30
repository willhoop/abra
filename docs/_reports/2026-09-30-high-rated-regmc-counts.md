# Reg M-C store counts by rating, on the full stores — 2026-09-30

MEASURE. A streaming count with no simulator, no games played and no gate run. The counts are in
`data/verification/2026-09-30-high-rated-regmc-counts.json`, and the counting script is embedded in that file.

## Verdict

- **The OPS snapshot figures are close, but they do not reproduce exactly.** Re-counted on the same plain
  files with the stated definition, every figure comes out 1–5% higher. bo3 clean is 16,517, not 16,119.
  bo1 clean is 19,870, not 18,890. The bo1 reveal rates come out higher: 1.69 moves, not 1.43. OPS had
  no Bash and recorded no method, so I could not isolate the gap. Every definition variant I tried
  (turn n=3 against length ≥ 3, forfeits, null ratings, sheets, six-of-six) moves the count by 0 or by
  the wrong amount.
- **The full stores hold 55–75% more games than the snapshot, and the high bands grow faster than
  that.** bo1 lower ≥ 1500 goes from 89 to 383 (4.3×). bo3 higher ≥ 1500 goes from 3 to 47.
  **bo3 lower ≥ 1500 is still 0.**
- **Selection bias, not staleness, is why top-ladder play is missing.** On the full stores, 81% of the
  94 bo3 players rated ≥ 1500 and 57% of the 500 bo1 players rated ≥ 1500 have **zero** uploaded games.
  On the snapshot the same shares were 85% and 67%. Eight more days of collection moved them by 4 and
  10 points.
- **The behavioural-bot rule matters at the top of bo1.** Four accounts with one team each played
  1,286–1,729 games in 6–9 days (SC-Control, SC-SME, Scorecard-Pokemon, kevdan42) and reached ratings
  up to 1658. Excluding them takes bo1 higher ≥ 1300 from 8,789 to 6,617.
- **The bo3 store holds 17,464 series** (37,165 games, 30-minute gap rule). 13,694 of them reach a
  2-win result in the store. 489 have a lower player rated ≥ 1300, and **1 has one rated ≥ 1500**.

## Which files were read

| file (main checkout `C:\Users\willj\Projects\Pokemon\ABRA\data\`) | bytes | mtime (UTC) | games | date range |
|---|---:|---|---:|---|
| `games.gen9championsvgc2026regmcbo3.jsonl` (plain snapshot) | 242,005,636 | 2026-09-21 07:02 | 24,028 | 09-09 08:08 → 09-21 05:25 |
| `games.gen9championsvgc2026regmcbo3.jsonl.gz` | 37,565,665 | 2026-09-29 21:18 | 37,165 | 09-09 08:08 → 09-29 21:02 |
| `games.gen9championsvgc2026regmc.jsonl` (plain snapshot) | 218,080,470 | 2026-09-21 07:02 | 33,743 | 09-09 08:13 → 09-21 05:25 |
| `games.gen9championsvgc2026regmc.jsonl.gz` | 44,940,799 | 2026-09-29 21:18 | 59,196 | 09-09 08:13 → 09-29 21:02 |

The `.gz` paths were passed to the counter explicitly. `engine/quality.js` `storePath()` prefers the
plain file when both exist, so on this machine `loadGames()` would silently serve the 09-21 snapshot.
No duplicate ids and no parse errors in any file. The main-checkout `.gz` blobs are `7f11d555` (bo1) and
`525160ab` (bo3). `origin/main` at `dbe59fb6` already carries newer blobs (00:47Z on 09-30), so this is
a count of the files as they stood on disk at 21:18Z on 09-29.

## Two definitions of "clean"

- **OPS**: both `bot:false`, `brought` 4 + 4, `turns.length ≥ 3`. Requiring a turn with `n === 3`
  selects the identical set in all four files.
- **quality**: `engine/quality.js` `reasons()` returns nothing. This includes `behaviouralBots()`,
  computed over the same file (≥ 50 games and exactly one distinct team). The rule finds 4 accounts
  in the bo3 snapshot and 7 in the full bo3 store, and 7 in the bo1 snapshot and 14 in the full bo1
  store. **Two of the quality rules do nothing on Reg M-C.** `exclude_illegal_teams` and
  `exclude_custom_ruleset` key on Reg M-B ladder id sets (`data/store-validation.json`,
  `data/custom-ruleset-ids.json`), so they remove 0 Reg M-C games. Their tally is empty in every run.

Ratings are `p1.rating` / `p2.rating` as stored, which is the pre-game ladder rating. Null counts as
0. "Lower" is the minimum of the two players and "higher" is the maximum.

## The table

### bo3 (open sheets)

| | OPS figure | snapshot, OPS def | snapshot, quality | **full .gz, OPS def** | **full .gz, quality** |
|---|---:|---:|---:|---:|---:|
| clean games | 16,119 | 16,517 | 16,342 | **25,553** | **25,238** |
| lower ≥ 1300 | 232 | 236 | 213 | **724** | **715** |
| lower ≥ 1400 | 15 | 17 | 9 | **90** | **89** |
| lower ≥ 1500 | 0 | 0 | 0 | **0** | **0** |
| lower ≥ 1600 | 0 | 0 | 0 | **0** | **0** |
| higher ≥ 1300 | 964 | 975 | 914 | **2,162** | **2,112** |
| higher ≥ 1400 | 104 | 107 | 85 | **420** | **416** |
| higher ≥ 1500 | 3 | 3 | 2 | **47** | **47** |
| higher ≥ 1600 | — | 2 | 2 | **6** | **6** |
| Choice Scarf, share of teams | 24.5% | 24.8% (8,186/33,034) | 24.4% | **24.5%** (12,536/51,106) | **24.2%** |
| Choice Scarf, own rating ≥ 1300 | 29.9% | 31.5% (1,211 teams) | 28.0% | **29.1%** (2,886 teams) | **28.6%** |

### bo1 (closed sheets)

| | OPS figure | snapshot, OPS def | snapshot, quality | **full .gz, OPS def** | **full .gz, quality** |
|---|---:|---:|---:|---:|---:|
| clean games | 18,890 | 19,870 | 18,694 | **34,717** | **29,537** |
| lower ≥ 1300 | 2,032 | 2,059 | 2,028 | **5,701** | **4,311** |
| lower ≥ 1400 | 555 | 561 | 548 | **1,680** | **1,450** |
| lower ≥ 1500 | 87 | 89 | 86 | **383** | **361** |
| lower ≥ 1600 | 2 | 2 | 2 | **32** | **31** |
| higher ≥ 1300 | 3,333 | 3,372 | 3,322 | **8,789** | **6,617** |
| higher ≥ 1400 | 1,217 | 1,233 | 1,214 | **3,512** | **2,829** |
| higher ≥ 1500 | 284 | 286 | 280 | **1,002** | **889** |
| higher ≥ 1600 | 32 | 33 | 33 | **209** | **201** |
| moves revealed by game end (of 4) | 1.43 (36%) | 1.685 (42.1%) | 1.695 | **1.672 (41.8%)** | **1.692 (42.3%)** |
| item revealed, non-mega entries | 19.1% | 25.5% | 26.1% | **24.9%** | **25.9%** |
| ability revealed | 34.9% | 36.0% | 36.5% | **36.2%** | **36.4%** |

The reveal rates are computed per `sets` entry. A base forme and its mega are separate entries.
Moves are counted distinct and capped at 4. Items are counted over non-mega entries and abilities over
all entries. The bo1 `sets` object is keyed by species for both players together, so a mirror species
shares one entry. That affects my count and OPS's alike. My reveal rates are 6–7 points above OPS on
moves and items, which is a larger gap than the game-count gap can explain. OPS's per-entry rule was
different, and I cannot say how. **Quote these rates from this file's rule, not from OPS's.**

## The behavioural-bot rule at the top of bo1

The 14 accounts the rule flags in the full bo1 store, by maximum rating (all have `bot:false`, so the
name rule catches none of them):

| account | games | max rating | active days | on the live top 500 |
|---|---:|---:|---:|---|
| SC-Control | 1,286 | 1658 | 7 | no |
| Novicebest | 77 | 1636 | 14 | **#294, 1617** |
| SC-SME | 1,408 | 1561 | 7 | no |
| Scorecard-Pokemon | 1,729 | 1537 | 9 | no |
| underabridgevgc | 62 | 1503 | 3 | no |
| kevdan42 | 1,328 | 1486 | 6 | no |
| stupid春bigㄟ | 76 | 1454 | 7 | no |
| Tulpeon, HospitalityCheck, Thornlace48812, cosmonaut.009, monfish, Crituvyn72957, AI_Paku | 54–1,299 | ≤ 1325 | | no |

Four accounts that each played more than 1,280 games in under ten days with one team are bots on any
reading. Together they are most of the 8,001 games the rule removes. The rule also flags accounts that
look human. Novicebest played 77 games over 14 days and sits at #294 on the live ladder. In bo3,
Afmoad (60 games, one team) sits at #110. At the 50-game threshold, one team is weak evidence against
a human who kept one team for a whole week of bo3. This is a false-positive risk in
`data/quality-filter.json`. I report it here and did not change the rule.

## Ladder overlap — upload selection against staleness

Live ladders fetched at 2026-09-30 00:43Z from `pokemonshowdown.com/ladder/<format>.json`, 500 listed
per format. The bands use the `elo` field, and they match the brief exactly: bo3 top 1708, 94 ≥ 1500,
9 ≥ 1600, 1 ≥ 1700; bo1 top 1797, 500 ≥ 1500, 400 ≥ 1600, 56 ≥ 1700. Store names are matched to the
ladder by userid (lowercase alphanumeric). "Appearances" counts one per player per game, so a game
between two listed players counts twice.

| band | players | in snapshot | zero uploads (snapshot) | **in full .gz** | **zero uploads (full)** | appearances held, full (clean) | ladder W+L |
|---|---:|---:|---:|---:|---:|---:|---:|
| bo3 ≥ 1500 | 94 | 14 | 85.1% | **18** | **80.9%** | 499 (362) | 10,234 |
| bo3 ≥ 1600 | 9 | 3 | 66.7% | **3** | **66.7%** | 82 (50) | 1,225 |
| bo3 ≥ 1700 | 1 | 0 | 100% | **0** | **100%** | 0 | 171 |
| bo3 top 500 | 500 | 119 | 76.2% | **142** | **71.6%** | 4,128 (2,765) | 45,316 |
| bo1 ≥ 1500 (= top 500) | 500 | 163 | 67.4% | **213** | **57.4%** | 2,560 (1,587) | 99,548 |
| bo1 ≥ 1600 | 400 | 123 | 69.3% | **158** | **60.5%** | 1,968 (1,211) | 79,896 |
| bo1 ≥ 1700 | 56 | 15 | 73.2% | **18** | **67.9%** | 281 (183) | 14,240 |

The full stores are 55% (bo3) and 75% (bo1) larger than the snapshot. The share of top players with
no games at all falls by only 4 points in bo3 and 10 in bo1. Our appearances cover about 4.9% of the
bo3 ≥ 1500 players' ladder W+L, and about 2.6% of bo1's. **Most of the top of the ladder does not
upload, so a fresher store cannot fix this.** It will not close by collecting longer. Only a source
that does not depend on the player choosing to save the replay can close it. The W+L column is the
ladder's own count. I did not verify whether a bo3 ladder W/L counts games or series. If it counts
series, the coverage figure for bo3 is understated by a factor of about 2–2.5.

## bo3 series

The rows carry no bestof room id, so series are reconstructed. Games are grouped by unordered player
pair and sorted by battle number. A new series starts when the gap from the previous game exceeds the
window, or when the current series already has 3 games or a player with 2 wins.

| store | window | series | 1 game | 2 games | 3 games | reach 2 wins | all games clean | any game clean | max lower ≥ 1300 | ≥ 1500 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| snapshot | 30 min | 11,320 | 2,227 | 5,478 | 3,615 | 8,845 | 5,292 | 9,416 | 165 | 0 |
| **full .gz** | 15 min | 17,500 | 3,448 | 8,439 | 5,613 | 13,664 | 8,128 | 14,598 | 490 | 1 |
| **full .gz** | **30 min** | **17,464** | **3,391** | **8,445** | **5,628** | **13,694** | **8,097** | **14,573** | **489** | **1** |
| **full .gz** | 60 min | 17,455 | 3,377 | 8,446 | 5,632 | 13,698 | 8,090 | 14,572 | 489 | 1 |

The count holds across the window: 15 to 60 minutes moves it by 45 series out of 17,500, so the
reconstruction is not sensitive to the choice. "Max lower" is the highest lower-player rating in any
game of the series. The 3,391 single-game series are series of which the store holds one game. That
is an upload artefact or an early forfeit. It does not mean a bo3 was played as a bo1.

## OWED, NOT RUN

- **Reconcile the OPS method.** The 398-game (bo3) and 980-game (bo1) gaps, and the lower reveal rates,
  need OPS's actual rule. OPS recorded none and had no executable path. Ask OPS for the rule, or retire
  its figures in favour of this file.
- **The behavioural-bot false positives.** Novicebest (bo1 #294) and Afmoad (bo3 #110) are flagged by a
  50-game / one-team threshold that was fitted on Reg M-B bo1. It needs a measured pass under Reg M-C,
  especially for bo3, where keeping one team for a week is normal. The rule was not changed here.
- **`exclude_illegal_teams` and `exclude_custom_ruleset` are Reg M-B only.** No Reg M-C verdict exists
  (`validate_store.js` and `scan_custom_rulesets.js` have not been run on the M-C stores), so the
  "quality" column is a floor on contamination, not a census.
- **`quality.js` `storePath()` prefers a stale plain file.** On this machine it would serve the 09-21
  snapshot of both Reg M-C stores to every caller. Route to OPS.
- **bo3 ladder W/L unit** (games or series) was not checked. The bo3 coverage share depends on it.
- **Recount at a pinned blob.** `origin/main` already holds newer `.gz` blobs than the ones counted here.
