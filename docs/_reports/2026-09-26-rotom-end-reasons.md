# ROTOM end reasons, the self-quit halt and rated-only records (2026-09-26, abra/regmc 1.17.0)

**Verdict.** ROTOM now records how every game and every series ended. It reads this from the protocol lines, and a
walkaway between games is included. Our own forfeit, timeout or walkaway is a ladder error and halts the ladder.
Every record and every mean is taken over rated series only, and it is reported with and without the series the
opponent handed us. The backfill over aa1, aa2 and gen5ab finds **0 of our own quits** in 63 series rows and 139
game logs.

Spec followed: `docs/_reports/2026-09-26-click-outcomes.md` §6, with one naming change that the brief asked for
(see *Vocabulary*).

## 1. What was built

| file | what |
|---|---|
| `solver/rotom/endings.js` (new) | `quitLine`, `gameEnd(lines, me)`, `seriesEnd(games, result, me, opts)`, `ladderRecord(rows, { rated: true })`. Pure functions. |
| `solver/rotom/rotom.js` | `endBattle` writes `end_reason`, `end_by`, `end_turn`, `at_preview`, `end_raw` on the game record, the `game_end` event and the series-book game. `handleBestof` logs series-room quit lines (`series_quit_line`). `settleSeriesEnd` runs 3 s after the series `|win|` and again when the ladder writes the row. `selfQuit` counts, logs `self_quit` and calls the ladder. The summary has `end_reasons` and `self_quits`. |
| `solver/rotom/ladder.js` | The row carries `end_reason`, `end_game`, `end_turn`, `at_preview`, `games_won`, `games_lost`, `any_forfeit_opp`, `walkaway`, `end_by`, `end_raw`, `games_end[]`. `onSelfQuit` records a ladder error `self_quit`, sets `halted`, cancels a running search and exits 4 once idle. One quit that is seen at the game and again on the row is counted once. |
| `solver/rotom/report.js` | New `ladder <run dir>` mode. `gamesReport` uses rated series only for the record, the game rate and the team counts, lists the unrated series, adds `without_quit_wins`, `end_reasons` and `self_quits`, and derives `end_reason` from `battle_log` when a record has none (`--root`). `aggregate` counts `self_quits` and also reads a client that made no decision. |
| `solver/rotom/run_ladder.js` | `ladder-report.json` has `record` per client (rated only, with and without the opponent's quits). The residual list carries `rated` and `end_reason`. The row reader skips `*.ends.jsonl`. |
| `solver/rotom/backfill_ends.js` (new) | Derives the fields for a finished run into NEW files. It refuses to overwrite them without `--force`. |
| `solver/rotom/LADDER.md` | §6: how to read the end reasons, and the self-quit halt. |

### Vocabulary

The game-level values are `normal`, `forfeit_opp`, `forfeit_me`, `timeout_opp`, `timeout_me`, `inactivity`, `tie` and
`unknown`. The series-level values are the same plus `walkaway_opp` and `walkaway_me`.

- `timeout_*` means the battle timer ran out for one side: `|-message|<name> lost due to inactivity.` The spec called
  this `inactivity_*`. The brief named it `timeout_*`, and it is still one server mechanism with one label.
- `inactivity` means every side timed out: `|-message|All players are inactive.` followed by a tie
  (`server/room-battle.ts` checkTimeout). This counts as our own quit too, because our side timed out.
- Forfeit lines: `forfeited.`, `forfeited by changing their name.` and `lost by having an inappropriate name.`
  (`room-battle.ts` forfeitPlayer and the rename paths).
- `lost the series due to inactivity.` is the series disconnect timer (`room-battle-bestof.ts`). When it lands in a
  game, it is `timeout_*`. When no game follows, it is a walkaway.
- ROTOM's own late decisions are a different thing, and they stay in `during_series.timeouts`.

**Self quit** means one of `forfeit_me`, `timeout_me`, `inactivity` or `walkaway_me`. **An opponent quit win** means
one of `forfeit_opp`, `timeout_opp` or `walkaway_opp`.

### Rules

- A quit line that comes after `|win|` does not decide that game.
- The deciding game's reason is the series' reason. A walkaway is when the winner has fewer games than it needs, the
  last game ended normally (or no game was played), and no game of ours is still live. In that case `end_game` is
  the next game number, `end_turn` is 0 and `at_preview` is true.
- If a series-room quit line arrives while a game we joined is still live, the series ended mid-game in that game.
  It is not a walkaway.
- `S` stays what the server scored. `ladderRecord` throws unless it is given `{ rated: true }`. An unrated row is
  listed in `unrated_excluded` and never counted.
- "Without quit wins" **drops** the series won by an opponent quit. It does not score them as losses.

## 2. The halt

A game-level self quit is caught in `endBattle`, at the game's own `|win|`, before the series ends. The ladder
halts: no new search, the open series is played out, and the client exits 4 (final for the supervisor). The row
check is a second layer: a row whose `end_reason` is a self quit halts too. That is the only place a walkaway of
ours can be seen. The halt is stored in `ladder-state-*.json` (`halted`, `self_quits`), so a restart stays halted.

## 3. Backfill (new files, originals untouched)

`node solver/rotom/backfill_ends.js <run dir>` read `ladder-series-medicham32.jsonl`, `series/medicham32/*.json` and
`games/medicham32/<room>.log` in each run. It wrote `ladder-series-medicham32.ends.jsonl` (each original row
unchanged, plus the end fields and `ends_backfilled`) and `games-ends-medicham32.jsonl` beside them. Every game log
was found. No log lacked a series-book entry. The winner read from each log agreed with the series book every time.

| run | series | series end reasons | games | game end reasons | self quits |
|---|---|---|---|---|---|
| aa1-2026-09-25T21-00-29-440Z | 10 | normal 7, forfeit_opp 3 | 22 | normal 19, forfeit_opp 3 | 0 |
| aa2-2026-09-25T23-54-09-059Z | 16 | normal 13, forfeit_opp 2, timeout_opp 1 | 41 | normal 37, forfeit_opp 3, timeout_opp 1 | 0 |
| gen5ab-2026-09-26T04-06-53-848Z | 37 | normal 26, forfeit_opp 7, timeout_opp 3, walkaway_opp 1 | 76 | normal 61, forfeit_opp 12, timeout_opp 3 | 0 |

`node solver/rotom/report.js ladder <run dir>`. **Rated series only.**

| run | arm | all | without quit wins | quit wins | mean S − E ± SD (all) | mean S − E ± SD (without) |
|---|---|---|---|---|---|---|
| aa1 | total | 5-5 | 2-5 | 3 (forfeit 3) | +0.0097 ± 0.5064 | −0.1874 ± 0.4809 |
| aa2 | total | 5-11 | 2-11 | 3 (forfeit 2, timeout 1) | −0.1341 ± 0.4605 | −0.2890 ± 0.3536 |
| gen5ab | A `miltank-gen5` | 8-11 | 3-11 | 5 (forfeit 3, timeout 1, walkaway 1) | −0.0587 ± 0.5410 | −0.2699 ± 0.4686 |
| gen5ab | B `prior` | 7-10 | 2-10 | 5 (forfeit 4, timeout 1) | −0.0768 ± 0.4793 | −0.2896 ± 0.4072 |
| gen5ab | total | 15-21 | 5-21 | 10 | −0.0672 ± 0.5056 | −0.2790 ± 0.4327 |

- gen5ab k30 (ttghh, arm A, `rated: false`, S 1, timeout_opp at turn 6) is excluded. The snapshot table in the
  click-outcomes report counted it: search "9-11 (incl. 1 unrated)" becomes 8-11 rated.
- gen5ab k8 (carlsaid) reads `walkaway_opp`, `end_game` 2, 0-1 in games.
- These figures match the click-outcomes snapshot for aa1 + aa2 (10-16, and 4-16 without). gen5ab has two more
  series than that snapshot (k36 and k37).
- **This is a description of how the series ended. It is not a counterfactual.** An opponent who forfeits early is
  often already losing, so "without" is a lower bound on the strength of play, not an estimate of it.
- These are not A/B verdicts. The A/B is read by its pre-registered SPRT, once, at a bound.

## 4. Tests, each shown RED on a deliberate break

`node solver/tests/test-rotom-endings.js`: **GREEN 59/59.** The breaks are applied to the module SOURCE at load, not
to the file on disk. The default run spawns each break and requires RED.

| break | what it removes | result |
|---|---|---|
| `quit` | quit lines are never read | RED 44/53 |
| `allnormal` | every quit reads `normal` (a counter that never fires) | RED 45/53 |
| `walkaway` | the walkaway branch | RED 47/53 |
| `rated` | the `rated` requirement and filter in `ladderRecord` | RED 47/53 |
| `halt` | `onSelfQuit` no longer sets `halted` | RED 49/53 |
| `gamesrated` | `gamesReport` rated filter | RED 49/53 |

Clauses: GAME (one constructed sequence for each game `end_reason`, plus rename, series inactivity forwarded into a
game, a quit after `|win|`, and a CRLF string), SERIES (2-0, 2-1, forfeit decider aa1 k3, series forfeited in g1
gen5ab k4, preview timeout decider gen5ab k9, **walkaway gen5ab k8**, our own walkaway, gen5ab k33, a walkaway before
any game, a series-room line naming who walked, a series forfeit while game 2 is live), RECORD (throws without
`rated: true`, **the unrated k30 win is excluded**, with and without quit wins, per arm, self quits), HALT (the real
ladder controller: an opponent forfeit or walkaway does not halt; our forfeit halts, exits 4 once idle, and is
counted once; our walkaway halts on the row and no search follows), GAMES (`gamesReport`: unrated excluded and
listed, a 1-0 series ended by the opponent's forfeit is a W, and `end_reason` is read from the battle log).

`node solver/tests/test-rotom-endings-live.js`: **GREEN 19/19.** This runs the real client (`rotom.js --ladder
--dry-run`) against a scripted websocket server, replaying the aa1 fixture logs under fresh ids:

- FORFEIT (aa1 k3 as played) gives row `forfeit_opp`, g2, t2, and game records `normal` then `forfeit_opp` by
  estrellitapor.
- WALKAWAY (k6 g1 lost, then `||a8592 forfeited.` with no g2) gives `walkaway_opp`, g2, at preview, end_by a8592, S 1.
- SELF (g1 cut at turn 5 plus `|-message|medicham32 forfeited.`) gives a game-level `self_quit` before `series_end`,
  a `ladder_halt`, a `self_quit` error, the row `forfeit_me` t5, no further search, and exit 4.
- The report over the run reads 2-1 all, 0-1 without, 1 self quit.

With `--break selfquit` (a temporary copy of `rotom.js` with the game-level call removed; the copy is deleted
afterwards), the run is **RED 15/19**. The row-level check still halted the ladder, but only after one more search
had gone out. That shows why the game-level layer is needed.

Other rotom tests, after the change: `test-rotom` 105/105, `test-rotom-ladder` 114/114, `test-rotom-replays` 41/41
(its fixture now carries rating lines on the deciding games), `test-rotom-applied` 31/31, `test-rotom-localnet` 4/4,
`test-rotom-private-series` 25/25 and `test-rotom-throttle` 33/33.

## 5. Found along the way, not fixed (not mine)

- **`test-rotom` GEN5 clause is load-sensitive.** On this worktree, while other agents were running, it went RED
  twice in a row: "miltank-gen5 searched (playouts 0, worlds 1)" at `budgetMs: 700`. On the third run it was GREEN
  105/105. A probe with the same budget found 51 playouts. The test's modules do not include any file this change
  touched (`clock`, `request`, `world`, `policy`, `lock`). This is a 700 ms decision under contention, and it is
  flagged for the owner of that clause.
- **`test-rotom-applied` needs `SHOWDOWN_PATH` inside a worktree.** `solver/dex` looks for `../pokemon-showdown-mc`
  relative to the checkout. With `SHOWDOWN_PATH` set it is GREEN 31/31.
- **Games mode can see a rated series as unrated.** A game record is written before the rating lines arrive when the
  series ended short (forfeit or walkaway), so `report.js games` counts 5 series as unrated where the ladder rows say
  1. This errs toward exclusion, never toward a false win. The ladder figure is `report.js ladder`, which reads the
  series rows. The CLI says this.
- To run the live tests, the gate release `data/releases/eaa5becc54eb` (gitignored) was copied into this worktree.
