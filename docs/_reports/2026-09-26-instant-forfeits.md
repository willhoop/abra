# Instant forfeits on the Reg M-C bo3 open-sheet ladder — is anyone harvesting sheets?

Date: 2026-09-26. Read-only analysis. Historical findings record, not maintained.

## Verdict

**No evidence of a sheet-harvesting population.** Instant forfeits are rare (0.62% of games), spread
thinly (172 accounts, 153 of them exactly once), and the one account a Bonferroni binomial test flags
(ToastedArt) plays and wins normally (86 of 154 played games, 56%). The pattern fits **dodging a bad
matchup at team preview**, and rating-floor players quitting, not harvesting. Harvesting cannot be
excluded for accounts whose replays are not public: 5 of medicham32's 10 opponents are absent from the
public store, including the one that forfeited instantly.

## Data and definitions

- Source: the raw store `data/raw/games.gen9championsvgc2026regmcbo3/`, 231 shards
  (`20260909T1850-00` to `20260925T2250-00`), 32,658 unique games. It is used instead of
  `solver/out/human/games.jsonl` because the dataset drops no-action games and was built 2026-09-23 08:03Z.
- Dropped: 6 custom-rule games and 7 games with own accounts (medicham32, willhoop, MAG, MAG2). The
  remaining 32,645 games all have a result. Named and behavioural bots are **kept**, so this is the
  whole ladder.
- A forfeit is `|-message|<name> forfeited.`. Inactivity (`lost due to inactivity`) is counted
  separately.
- **Instant forfeit (tier A, the primary definition):** a forfeit with no `|move|` in the log and no
  turn after turn 1. So the game was forfeited at team preview, or at the turn-1 decision after only
  the leads were seen.
- **Tier B (wider):** a forfeit where the last `|turn|` is 1 or lower. This includes 368 games where
  turn 1 **resolved**, often with a KO, and the player quit at the replacement prompt. Those are
  ordinary concessions, not "instant". Tier B is reported only because it is what "turn ≤ 1" gives
  if you count naively.
- Scripts and intermediates: the session scratchpad `iff/` (`scan.js`, `an.js`, `anA.js`, `an2A.js`).

## 1. How often

| end of game | games |
|---|---|
| normal | 19,333 |
| forfeit | 12,735 |
| inactivity | 577 |

| forfeit phase | forfeit | inactivity |
|---|---|---|
| team preview (no `|start|`) | 151 | 115 |
| turn 1, nothing resolved | 51 | — |
| turn 1 resolved, quit before turn 2 | 368 | — |
| later | 12,165 | 405 |

- **Tier A: 202 of 32,645 games = 0.62%.** Counting inactivity at the same phase too gives 362 (1.11%).
- Tier B: 570 (1.75%).
- All 151 preview forfeits carry both `|showteam|` lines. **Forfeiting at preview does reveal the
  opponent's full open sheet.** The mechanism for harvesting exists.
- Median time from the first timestamp to the forfeit is 0 s (p90 57 s). Most forfeits happen
  immediately.
- By game number: game 1 0.78% (111/14,189), game 2 0.61% (78/12,886), game 3 0.23% (13/5,570).
- 184 of 202 were rated games.
- No clear trend by day: between 6 and 21 per day.

## 2. Per player (≥ 10 games)

- Population rate p0 = 202 / 65,290 player-games = **0.309%** (the forfeiter's side only).
- 1,691 accounts have ≥ 10 games. The test is a one-sided exact binomial P(X ≥ k | n, p0), with
  Bonferroni at family α = 0.01, so an account is flagged when **p < 5.9e-6**.
- 81 of these accounts have any instant forfeit, and 14 have two or more.
- **Flagged: 1.**

| account | games | instant forfeits | p | games played (not instant) | won |
|---|---|---|---|---|---|
| ToastedArt | 169 | 10 (5.9%) | 2.1e-10 | 154 | 86 (56%) |

The next account is IMizztherage (4 of 95, p = 2.3e-4), then veganboyz (3 of 82). Neither is
significant after correction, and both win 57–60% of the games they play.

Concentration: the 202 forfeits come from 172 accounts. 153 accounts forfeited once, 16 twice, one
3 times, one 4 times and one 10 times. The top 10 accounts hold 31 of the 202.

Burner-shaped accounts are those where instant forfeits make up ≥ 50% of the account's games. There
are 45 of them, holding 49 forfeits, and 21 are one-game accounts. The only ones with ≥ 2 instant
forfeits are Matagais3000 (2/3), CinderJayOSC (2/2), OscarBK21 (2/4) and 13579abcd (2/2). This is
too small a tail to be a harvesting operation, and it is indistinguishable from new players quitting.

Rating: 29% of instant forfeiters with a rating were at ≤ 1000, against 8.3% of all rated
player-games. **At the 1000 floor a forfeit costs nothing** (estrellitapor went 1000 → 1000 after
forfeiting to us). That makes the floor the cheap place to harvest, but also the place where new and
tilted players sit.

## 3. Game 1 then leave, or a whole series at preview?

Population, tier A:
- After an instant forfeit in game 1, game 2 exists in the store for only **17 of 111** series. After a
  game 1 that ends normally it exists for 7,531 of 8,273 (91%). After a later forfeit it exists for
  4,488 of 5,611. So an instant game-1 forfeit almost always ends the series.
- medicham32's own logs show the same thing: `series_end` arrived 2 s after estrellitapor's preview
  forfeit.
- An instant forfeit in game 2 comes from the **game-1 loser** in 62 of 75 series. That is conceding
  a lost series, not harvesting.

ToastedArt, 10 instant forfeits:
- 8 were game 1 followed by no game 2, 1 was game 1 followed by a game 2, and 1 was in game 2.
- 8 were at preview and 2 at the turn-1 decision.
- All 9 series involved consisted only of instant forfeits. They played 9 distinct opponents,
  median opponent rating 1128 against their own 1092.

**So the flagged account forfeits the whole series at preview against specific opponents, then plays
its other ~89 series normally.** That is matchup dodging.

Harvest-then-rematch check: 16 of 202 forfeiters later played the same opponent normally in another
series (7.9%). The baseline is 1,938 of 32,652 games (5.9%) between pairs that met in more than one
series. The difference is not meaningful at this n.

## 4. Do flagged accounts win when they play?

Yes. ToastedArt wins 56% of 154 played games, which is at or above the population norm. A harvester
would rarely play. No account with ≥ 10 games combines a high instant rate with little real play.

## 5. medicham32's opponents

Source: `solver/out/rotom/aa1-2026-09-25T21-00-29-440Z/`, read only.

- 10 opponent series with a finished game (k = 1…11, not counting two search errors, plus the in-progress
  krenkrenkren series). 21 games in total.
- **1 instant forfeit, 1 series of 10.** estrellitapor, series k = 11
  (`game-bestof3-…-2687942465-…pw`), started 23:45:16Z. The only game had `|teampreview|4`, both
  `|showteam|` lines, then `estrellitapor forfeited.`. Game time 0 s, series over about 7 s after it
  started. Their rating went 1000 → 1000, so it cost them nothing.
- Context: estrellitapor had already played us in series k = 3 at 21:13Z (1085 → 1059). They lost
  0–2 and forfeited game 2 on turn 2. We brought team L4 then and L1 this time, so L1's sheet was new
  to them. **Dodge, rematch-avoidance and harvest all fit this case.** One event cannot separate them.
- With p0 = 0.62% per game, P(≥ 1 in 21 games) ≈ 12%. One is not anomalous.
- Coverage gap: estrellitapor, Raphou Patate, a8592, TrashPandaCJ and krenkrenkren are **not in the
  public store at all**. estrellitapor's rooms carry the private `-…pw` suffix, and the raw store
  holds 0 such ids. **Accounts that hide replays are invisible to this whole analysis**, and a
  deliberate harvester has every reason to hide them. The public-store answer is therefore a lower
  bound on harvesting.

## Should instant forfeits be excluded from bring/lead statistics?

- **Tier A (no action): yes, exclude from everything.** A preview forfeit has no bring and no lead.
  At the turn-1 decision, the forfeiter's leads were not chosen to be played. The only thing tier A
  legitimately feeds is sheet usage, and even there a harvesting account's sheet may be a throwaway.
- **Tier B (turn 1 resolved, then quit): keep the leads for both sides.** Both leads and turn-1
  actions were real decisions. Exclude tier B from win rates and from bring (the bring is never fully
  revealed).

What happens now:
- `solver/out/human/games.jsonl` (built 2026-09-23T08:03Z) keeps **none** of tier A. 173 are dropped
  as `no_action` and 8 by earlier filters (4 illusion, 2 pre-Eject-Button, 1 named bot, 1 behavioural
  bot). The other 21 were uploaded after the build. It **keeps 305 tier-B games**
  (`end: 'forfeit'`, `turns_played: 1`), which matches the recommendation.
- `solver/meta/analyze.js`: win rates require `acted && turns >= 3`, and bring rates need a full
  bring. Preview forfeits have no leads, so they drop out of lead rates on their own. Turn-1 decision
  forfeits (51) do contribute leads through `hasLead`. That is a minor leak of about 0.2% of games,
  and a filter on `acted` for lead rates would close it.

## Limits

- Only public replays are covered. Hidden-replay accounts, including 5 of our 10 opponents, are not
  seen.
- The store's series coverage is incomplete: 12,105 of 14,189 game-1 series have a game 2 in the
  store. The game-1-then-leave figure compares against that same baseline.
- Intent cannot be observed. "Harvest" and "dodge" produce the same log. The distinguishing signal
  is whether the account ever plays, and every account with volume does.
