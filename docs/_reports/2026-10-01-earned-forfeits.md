# Earned forfeits: an opponent quit while we are ahead on Pokémon is a real win (abra/regmc 1.70.0)

2026-10-01. SOLVER. Will: *"lets count forfeits where we are up in pokemon counts as real wins."*
Read-only on every run directory. No games were played.

## Verdict

The ladder record now has three readings. **EARNED FORFEITS COUNTED is the new headline.** It is
computed per game, rolled up to the series, and written by ROTOM at the end of each game and series
from now on. Past runs are classed from their own saved game logs when the report is read.

| run (rated series) | all | **earned forfeits counted** | all forfeits excluded | won series: clean / earned / unearned |
|---|---|---|---|---|
| gen5ab (arms A+B) | 15-21 | **10-21** (S−E −0.151 ± 0.496, n 31) | 4-21 | 4 / 6 / 5 |
| chomp1 | 10-10 | **9-10** (S−E −0.015 ± 0.486, n 19) | 5-10 | 5 / 4 / 1 |
| chomptop | 9-8 | **7-8** (S−E −0.014 ± 0.474, n 15) | 3-8 | 3 / 4 / 2 |
| chomptopfix | 12-8 | **12-8** (S−E +0.101 ± 0.477, n 20) | 6-8 | 6 / 6 / 0 |
| chomptour | not read: live, no series row yet (15:22 local) | | | |

Per arm for gen5ab. Arm A: all 8-11, earned 6-11, excluded 2-11. Arm B: all 7-10, earned 4-10, excluded 2-10.

Source: `node solver/rotom/report.js ladder <run dir>` (worktree code, run directories in the main
checkout's `solver/out/rotom/`), and `node solver/rotom/backfill_ends.js <run dir> --earned` for each
game's count.

## The rule

### Per game

`solver/rotom/endings.js` `gameEnd` now walks a board count beside the end reason:

- **Our side** is the `|player|pN|<name>|` line whose name is ours.
- **Brought** is the last `|teamsize|pN|<n>` line. The server sends it once the preview picks are in
  (4 in this format, as measured in every log read). This count includes the bench.
- **Left** is brought minus that side's `|faint|pN…:` lines up to the quit line.
- The **snapshot** is taken at the quit line that decided the game: `|-message|<name> forfeited.`,
  the rename forfeit, or the battle timer (`lost due to inactivity`).

The rule for an opponent quit (`forfeit_opp` or `timeout_opp`):

| at the quit line | `earned` | `earned_why` |
|---|---|---|
| turn ≥ 1 and left_me > left_opp | **true** | `ahead` |
| turn ≥ 1 and left_me = left_opp | false | `level` |
| turn ≥ 1 and left_me < left_opp | false | `behind` |
| turn 0: at team preview, or leads sent but no turn played | false | `preview` |
| no `\|teamsize\|` for both sides at turn ≥ 1 | false | `no_count` (never guessed) |

Every other game has `earned: null`. A timeout by the opponent's battle timer follows the same rule
as the button. Both are the opponent handing the game over, and the old record already treated them
the same. They are split by `end_reason` if Will wants them apart. In the four runs, three of the 46
opponent-quit games (45 rated) were timeouts (all in gen5ab): k9 g2 at preview, k21 g3 behind, and k30 g1 ahead
(unrated).

**A forfeit at team preview or at turn 0 is never earned.** No turn has been played, so nobody can be
ahead. This is true even when `|teamsize|` has arrived and the count reads 4-4.

### Per series (only a series we WON is classed)

`endings.js` `seriesWinClass` / `seriesEnd.win_class`:

- `clean`: no game of the series was an opponent quit.
- `earned`: every opponent-quit game in the series was earned.
- `unearned`: any opponent-quit game was unearned. **A walkaway** (`walkaway_opp`, the opponent left
  between games) is always unearned. It happens at the next game's preview, so there is no board to be
  ahead on.
- A **lost** series is not reclassified (`null`). It stays a loss in every reading. An earned forfeit
  win inside a lost series changes nothing.

**A series that ends by forfeit in game 3** is classed by game 3's own count. If game 1 or game 2 was
also an opponent quit, that game must be earned too. Examples:

- chomptopfix k1: 2-1, g3 forfeited at turn 6 with 4 left against 1. The series is earned.
- chomptop k14: g3 forfeited at turn 2 with 3 left against 2. The series is earned.

**A forfeit that lands mid-game from the series room** (`||X forfeited.` while a game is live, the
`liveGnum` path) is classed from the live game's lines as they stand. ROTOM passes `liveLines` for this.

Per Will's wording, an opponent quit in **any** game of the series counts, not only in the deciding
game. A won series with an unearned game 1 and a normal deciding game is therefore `unearned`. The old
rule kept that series, because it only looked at the deciding end. gen5ab has none of these; the one
case of that shape is k33, and its g1 forfeit was earned.

### The three readings (`endings.js` `ladderRecord`, rated only, unchanged filter)

- `all`: every rated series.
- **`earned_counted`** (headline): drops a won series classed `unearned`, and keeps `clean` and `earned`.
- `any_forfeit_excluded`: drops every won series an opponent quit touched, and keeps `clean` only.
- `without_quit_wins` (legacy, kept): drops a won series whose deciding end was an opponent quit. It
  differs from `any_forfeit_excluded` only on a series with an earlier quit game and a normal decider.
  gen5ab k33 is the only such case: legacy 5-21, any-forfeit 4-21. The other three runs agree.

A dropped series is never scored as a loss. The residual `S − E` and the mean S are taken over the
series each reading keeps.

## Where it is written

- **At write time, from now on.** `solver/rotom/rotom.js` `endBattle` puts `earned`, `earned_why`,
  `quit_turn`, `left_me` and `left_opp` into the game's `endF`. That goes into the series book, the
  `game_end` event and the per-game ledger record. `settleSeriesEnd` carries them into `games_end` and
  passes `liveLines`. `solver/rotom/ladder.js` writes `win_class` and `quit_games` on every series row.
- **Past runs, read-only.** `solver/rotom/backfill_ends.js` `classifyRun(dir)` re-derives every game's
  count from `games/<client>/<room>.log` and classes every row. It writes nothing.
  `node solver/rotom/backfill_ends.js <run> --earned` prints the per-game table. `report.js ladder`
  calls `classifyRun` for any row written before `win_class` existed (all 94 rows of the four runs here).
- A row with no `win_class` and no earned fields in `games_end` is classed `unearned` if any opponent
  quit touched it. It is never guessed earned. The count of such rows is `win_class_missing`.

## Per-game evidence (every opponent-quit game, rated unless marked)

From `backfill_ends.js --earned`. "left" is ours-theirs at the quit line.

- **gen5ab**: 15 quit games (14 rated) and one walkaway (k8).
  - Earned: k1 g1 t7 2-1 (lost series), k4 g1 t4 4-2, k5 g2 t2 4-3, k16 g2 t3 4-3 (lost series),
    k21 g2 t7 3-2, k22 g1 t2 4-3, k22 g2 t3 4-3, k25 g1 t4 3-2, k31 g1 t11 2-1, k33 g1 t6 3-2,
    k30 g1 t6 4-1 (UNRATED, excluded).
  - Unearned: k9 g2 timeout at preview, k13 g1 at preview, k14 g2 t9 **2-3 behind**, k21 g3 timeout
    t12 **1-2 behind**.
  - k21 is a series won 2-1 with an earned g2 forfeit and an unearned g3 timeout, so the series is unearned.
- **chomp1**: 13 quit games. 11 earned.
  - Unearned: k12 g1 t6 3-3 level (lost series), and k18 g2 at preview. The k18 g1 forfeit was earned
    (4-3), and the series is unearned because of g2.
- **chomptop**: 10 quit games. 8 earned.
  - Unearned: k5 g1 t5 3-3 level, and k10 g2 t3 4-4 level. Both are in won series, so both series are
    unearned.
- **chomptopfix**: 8 quit games, all earned (2-1 to 4-1, turns 3 to 15).

Hand check of one count (gen5ab k14 g2). We are p2. The log shows `|teamsize|` 4/4, faints
`p2a: Raichu` and `p2a: Rillaboom` (ours) and `p1b: Indeedee` (theirs), then `|turn|9` and
`Pokecip forfeited.` That leaves us 2 and them 3. The opponent quit while ahead, so the forfeit is
unearned. This matches the instrument.

## Tests

- `solver/tests/test-rotom-earned-forfeits.js`: **GREEN 32/32**.
  - GAME: an earned forfeit (4 v 2, t3), an unearned forfeit (level 3-3), one behind (2-3, with us on
    p2), a preview forfeit (no teamsize, t0), a turn-0 forfeit with teamsize 4-4 (still preview), an
    earned timeout, a normal game (null), and no_count.
  - SERIES: an earned g3 forfeit decider, a level g3 decider, a g1 earned + g3 preview series, an earned
    g1 with a normal decider, a preview g1 with a normal decider (unearned), 2-0 clean, the walkaway, a
    lost series (null), and a mid-game series forfeit classed from live lines (earned at 4 v 3, and
    unearned at preview).
  - RECORD: the three readings plus legacy, and a won quit row without fields is never guessed earned.
  - RUN: a constructed run directory classed by `report.js ladderReport`, with nothing written into it.
  - BREAKS: `ahead` (d ≥ 0), `preview` (turn check removed), `faint` (faints not counted), `series`
    (every → some), `walkaway` (both walkaway guards removed), `record` (headline drops nothing). Each
    goes RED as a child process. `walkaway` first came back GREEN with only the explicit line removed,
    because the fallback guard also catches it. The break now removes both guards, and it goes RED.
- `solver/tests/test-rotom-endings.js`: GREEN 59/59. The `quit` break's anchor was updated because the
  line moved.
- `solver/tests/test-rotom-ladder.js`: GREEN 161/161.
- `solver/tests/test-rotom-replays.js` was **RED 37/41 on main before this change**. Its HYGIENE clause
  still regex-read `const OWN = new Set([...])` from `solver/human/build_dataset.js` and
  `solver/meta/extract.js`. Both have read `engine/quality.js` `isOwnAccount` since 1.65.0 (the same
  stale check that 1.69.0 fixed in ROTOM). The clause now asks `isOwnAccount('medicham32')` and checks
  that both files call it on the own_account exclusion line.

## OWED, NOT RUN

- **chomptour** is not in the table. It was live at 15:22 local with no series row written, and it was
  not touched. Read it once it finishes:
  `node solver/rotom/report.js ladder solver/out/rotom/chomptour-2026-10-01T19-14-27-538Z`.
- **The live write path has not been exercised on a real server.** `rotom.js` and `ladder.js` now
  write `earned`, `win_class` and `quit_games`, but `test-rotom-endings-live.js` (local server) was not
  run in this pass, and it does not yet assert the new fields. The next live ladder row is the first
  real proof. Until then, a missing `win_class` on a new row falls back to the log derivation in
  `report.js`.
- `report.js games` (the per-game ledger summary, `games.jsonl`) still gives only the legacy
  "without quit wins" series rate. The three readings are in `report.js ladder` (series rows) only.
- `docs/MODELS.md` (ROTOM) and the white paper's ladder headline definition owe the fold-in at the next
  major. `docs/SOLVER.md` needs a restamp by `node engine/status.js --write` from the main checkout after
  the merge.
- The version is 1.70.0 because that is the next free number on origin/main at the time of writing. If
  another branch takes 1.70.0 first, the coordinator renumbers this one at merge.
