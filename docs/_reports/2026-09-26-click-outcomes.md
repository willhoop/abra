# Click outcomes: search vs DODUO vs humans, and how our series end (2026-09-26)

A read-only analysis. No simulation, no git, no solver code changed, and the live ladder process was not touched.

**Snapshot.** Taken 2026-09-26 at about 07:41Z, while `gen5ab` was still running. The run then held 35 series rows and 71 game logs. Figures for the live run describe that snapshot only.

**Script.** `<scratchpad>/clicks/analyze.js`. Its outputs are `result.json` and `series_cls.json` in the same folder.

## Sources

| group | what it is | games | series |
|---|---|---|---|
| **search (A)** | `gen5ab-2026-09-26T04-06-53-848Z`, arm A = `miltank-gen5`, 5 s | 41 | 20 (1 unrated: k30) |
| **DODUO (B)** | `gen5ab-…`, arm B = `prior` (MAG v1 + DODUO v1 greedy) | 30 | 15 |
| **DODUO (aa1+aa2)** | `aa1-2026-09-25T21-00-29-440Z` and `aa2-2026-09-25T23-54-09-059Z`. Both arms are `policy: prior`, so this is all DODUO. Includes 2 games of the orphaned aa2 series `…-2687988520`, which has no series row. | 63 | 26 rows |
| **humans** | raw Reg M-C bo3 logs from `data/raw/games.gen9championsvgc2026regmcbo3/*.jsonl.gz`, deduplicated by id, open-sheet only (`|showteam|` present), medicham32 excluded. **Both players count.** | 32,778 | – |

`solver/out/human/games.jsonl` was not used for outcomes. It holds a structured state and action per turn and **no** `-supereffective`/`-resisted`/`-immune`/`-crit`/`-miss` lines, so the raw logs were used as the brief allowed.

Every group is read from the battle-log protocol with the same parser. The move category and the protect family come from `Dex.forFormat('gen9championsvgc2026regmcbo3')` in `pokemon-showdown-mc` @ `f10d6798`. Protect family = the legal moves with `stallingMove` plus Wide Guard and Quick Guard. The stallingMove set comes out as Baneful Bunker, King's Shield, Protect, Spiky Shield, Detect and Endure. No type chart was computed; effectiveness is read only from the protocol lines.

## 1. Action type share (our side only; humans = both sides)

An action is one of the following, counted in the action phase (after `|turn|`, before `|upkeep|`):
- an own `|move|` line, excluding called moves (`[from]`, except `lockedmove`);
- a `|switch|` that comes before any move that turn, so it is a voluntary switch;
- a `|cant|`, meaning the action was prevented (flinch, paralysis, sleep, Taunt and the like).

"mega + move" is the move made by the mon that mega-evolved that turn. That move is not counted again in the other columns.

| group | actions | damaging | status | protect-family | switch | mega + move | cant (prevented) |
|---|---|---|---|---|---|---|---|
| search (A) | 503 | 43.1% | 10.5% | **21.7%** | **14.7%** | 6.6% | 3.4% |
| DODUO (B) | 298 | 55.0% | 9.1% | 19.8% | 6.7% | 7.4% | 2.0% |
| DODUO (aa1+aa2) | 764 | 49.0% | 9.9% | 19.6% | 12.2% | 6.7% | 2.6% |
| humans | 754,355 | 53.9% | 11.7% | **12.4%** | 11.6% | 6.6% | 3.8% |

"Other" is 0 in every group. The mega-turn move split (damaging/status/protect) is: search 28/3/2, B 19/1/2, aa 40/9/2, humans 36,568/8,271/5,118.

## 2. Damaging moves: outcome per opposing target

There is one outcome per (move execution, opposing target). The outcome is decided in this priority order:

1. `failed`: the user got `-fail` or `-notarget`, or the move executed with `[still]`/`[notarget]`.
2. `missed`: `-miss`.
3. `protected`: `-activate` of a protect-family move on the target.
4. `immune`: `-immune`, or an absorbing ability activating (Lightning Rod, Storm Drain and similar).
5. `blocked (other)`: Armor Tail, Dazzling or Queenly Majesty `cant … [of]`, or a Psychic Terrain `-activate`.
6. `SE`: `-supereffective`.
7. `NVE`: `-resisted`.
8. `neutral`: damage with no effectiveness line (a hit on a Substitute counts as a hit).

Two rules apply on top of the order:
- A crit is flagged on top of the outcome and is expressed as a share of landed hits.
- If a move was redirected, the declared target with no lines is dropped when another opposing target has lines.

Excluded from the table: charge turns (`-prepare`; humans 8,111, ours 0) and moves whose only targets were allies (humans 306).

| group | targets | failed | missed | protected | blocked (other) | **immune** | NVE | neutral | **SE** | crit (of landed) |
|---|---|---|---|---|---|---|---|---|---|---|
| search (A) | 282 | 1.8% | 1.4% | 14.5% | 1.8% | **2.8%** | 11.3% | 50.0% | **16.3%** | 3.7% (8/219) |
| DODUO (B) | 228 | 0.0% | 1.3% | 12.7% | 1.8% | **3.5%** | 17.1% | 44.3% | **19.3%** | 3.3% (6/184) |
| DODUO (aa1+aa2) | 477 | 0.4% | 1.9% | 15.5% | 0.8% | **5.7%** | 13.0% | 44.0% | 18.7% | 2.8% (10/361) |
| humans | 516,211 | 0.9% | 1.8% | 15.9% | 0.5% | **1.3%** | 15.2% | 40.6% | **23.9%** | 4.3% (17,790/411,357) |

Unresolved targets are 0 for all our groups and 77 (0.01%) for humans: Future Sight, some Zap Cannon.

## 3. Status moves (not protect-family): share that failed or was blocked

A status move counts as failed when the user got `-fail`, or when every opposing target it named was protected, immune, missed, blocked or `-fail`ed. A self-target or ally-target status move counts as failed only on its own `-fail`. A Taunt-prevented click is a `cant` and is counted in §1, not here.

| group | status moves | failed/blocked | breakdown |
|---|---|---|---|
| search (A) | 56 | 3 (5.4%) | fail 3 |
| DODUO (B) | 28 | 0 (0.0%) | – |
| DODUO (aa1+aa2) | 85 | 6 (7.1%) | fail 4, protected 1, immune 1 |
| humans | 96,389 | 4,652 (4.8%) | fail 1,285, protected 2,044, immune 513, missed 616, blocked 194 |

## 4. Protect family: share that failed

"Consecutive" means the same slot used a protect-family move that **succeeded** on the previous turn.

| group | protects | **failed** | consecutive (share of protects) | consecutive that failed |
|---|---|---|---|---|
| search (A) | 111 | **20 (18.0%)** | 28 (25.2%) | 20 (71%) |
| DODUO (B) | 61 | **9 (14.8%)** | 13 (21.3%) | 9 (69%) |
| DODUO (aa1+aa2) | 152 | **14 (9.2%)** | 19 (12.5%) | 14 (74%) |
| humans | 98,331 | **3,526 (3.6%)** | 5,224 (5.3%) | 3,128 (60%) |

Every failed protect in our runs was a consecutive one. The humans have 398 other failures, mostly a last-mover protect.

**This is the clearest behavioural defect in the data.** The search double-protects 4.8x as often as a human does and loses 18% of its protects to it, against 3.6% for a human. DODUO does it too, which points at the shared input (MAG/DODUO scoring Protect without the consecutive-use penalty), not at the search alone. That is a hypothesis for the owner of the protect decision. It is not a measured cause.

## 5. Forfeits

### (a) How many, whose, and on which turn

**Games.** 134 of our games; 22 of them ended by opponent forfeit or opponent inactivity. **We never forfeited and never lost on inactivity, and none of our 36 series losses involved a forfeit.**

| run | k | arm | game | turn | how |
|---|---|---|---|---|---|
| aa1 | 3 | A (DODUO) | g2 | 2 | opp forfeit |
| aa1 | 11 | B (DODUO) | g1 | 0 (preview) | opp forfeit |
| aa1 | 12 | A (DODUO) | g2 | 6 | opp forfeit |
| aa2 | 2 | B (DODUO) | g2 / g3 | 6 / 6 | opp forfeit / opp inactivity |
| aa2 | 8 | B (DODUO) | g2 | 0 (preview) | opp forfeit |
| aa2 | 13 | B (DODUO) | g2 | 3 | opp forfeit |
| gen5ab | 1 | B | g1 | 7 | opp forfeit (we then lost g2 and g3, so the series was lost) |
| gen5ab | 4 | A | g1 | 4 | opp forfeit |
| gen5ab | 5 | A | g2 | 2 | opp forfeit |
| gen5ab | 9 | B | g2 | 0 (preview) | opp inactivity |
| gen5ab | 13 | B | g1 | 0 (preview) | opp forfeit |
| gen5ab | 14 | B | g2 | 9 | opp forfeit |
| gen5ab | 16 | A | g2 | 3 | opp forfeit (the series was lost 1–2) |
| gen5ab | 21 | A | g2 / g3 | 7 / 12 | opp forfeit / opp inactivity |
| gen5ab | 22 | A | g1 / g2 | 2 / 3 | opp forfeit ×2 |
| gen5ab | 25 | B | g1 | 4 | opp forfeit |
| gen5ab | 30 | A | g1 | 6 | opp inactivity (**unrated** series) |
| gen5ab | 31 | B | g1 | 11 | opp forfeit |
| gen5ab | 33 | A | g1 | 6 | opp forfeit (g2 was then won normally) |

**A walkaway with no forfeit line anywhere.** In gen5ab k8 (arm A, vs carlsaid) we **lost** g1 at turn 6. The series then ended as a win for us 10 s after our `confirmready`, and no game 2 log exists. The opponent left the series between games. The only record of it is `series_end` plus the rating lines in `events-medicham32.jsonl`, so no game-log parser can see it. This is the case the spec in §6 has to cover.

Humans, for scale: 12,759 of 32,778 open-sheet bo3 games (38.9%) end in a `forfeited.` message, 151 of them at preview.

### Series WINS that came from an opponent forfeit (the deciding event)

| run | k | arm | games | deciding game / turn | preview or mid-game |
|---|---|---|---|---|---|
| gen5ab | 4 | **search** | g1 W FF | g1 / t4 | mid-game; series forfeited |
| gen5ab | 5 | **search** | W, W FF | g2 / t2 | mid-game |
| gen5ab | 8 | **search** | g1 **L**, then walkaway | between games (after g1) | preview of g2, no log |
| gen5ab | 21 | **search** | L, W FF, W inact. | g3 / t12 | mid-game (inactivity) |
| gen5ab | 22 | **search** | W FF, W FF | g2 / t3 | mid-game |
| gen5ab | 30 | **search** | g1 W inact. | g1 / t6 | mid-game (**unrated**) |
| gen5ab | 9 | DODUO (B) | L, W inact. | g2 / t0 | **preview** |
| gen5ab | 13 | DODUO (B) | g1 W FF | g1 / t0 | **preview** |
| gen5ab | 14 | DODUO (B) | W, W FF | g2 / t9 | mid-game |
| gen5ab | 25 | DODUO (B) | g1 W FF | g1 / t4 | mid-game; series forfeited |
| gen5ab | 31 | DODUO (B) | g1 W FF | g1 / t11 | mid-game; series forfeited |
| aa1 | 3 | DODUO | W, W FF | g2 / t2 | mid-game |
| aa1 | 11 | DODUO | g1 W FF | g1 / t0 | **preview** |
| aa1 | 12 | DODUO | W, W FF | g2 / t6 | mid-game |
| aa2 | 2 | DODUO | L, W FF, W inact. | g3 / t6 | mid-game (inactivity) |
| aa2 | 8 | DODUO | W, W FF | g2 / t0 | **preview** |
| aa2 | 13 | DODUO | W, W FF | g2 / t3 | mid-game |

Not counted as a forfeit win: gen5ab k33 (search). Its g1 was an opponent forfeit, but the deciding g2 was won normally.

**Series record per arm, with and without forfeit-decided wins:**

| group | record | forfeit-decided wins | record without them |
|---|---|---|---|
| search (A) | 9–11 (incl. 1 unrated) | 6 | **3–11** |
| DODUO (B) | 6–9 | 5 | **1–9** |
| DODUO (aa1+aa2) | 10–16 | 6 | **4–16** |

**17 of our 25 series wins were decided by the opponent quitting.** Only 8 wins came from a normally finished deciding game: search 3 (k12, k33, k35), gen5ab-B 1 (k28), aa 4. This is a description of how the series ended. It is not a counterfactual: an opponent who forfeits at turn 2–6 is often already losing.

### (b) Are forfeits scored like any other win or loss?

**Yes.** In every forfeit-decided win `S = 1`, and `rating_me` before/after equals the server's `rating_line` for us (checked: 60 of 60 rated rows across the three runs, 0 mismatches). The effective K = Δ/(S − E) is the same for both kinds of rated win:

| rated series | n | mean K | range |
|---|---|---|---|
| wins, normal | 8 | 62.5 | 50.5–80.0 |
| wins, forfeit-decided | 16 | 61.7 | 49.5–74.0 |
| losses (all normal) | 36 | 41.6 | 0.0–51.4 |

Two points on this table:
- The gap between wins and losses is present with or without forfeits. It is the server's rating-band behaviour near 1000: aa1 k1 went 1000 → 1000 on a loss. It is not specific to forfeits.
- One row needs a fix. **gen5ab k30 (ttghh) is `rated: false` but is written with `S = 1` and `rating_me: null`.** Any mean over S, or any W–L count that does not filter on `rated`, will count an unrated win. It must be excluded from the ladder figure. It is not a forfeit problem, but it was found here.

## 6. SPEC: end-of-game and end-of-series fields for ROTOM (spec only; not implemented)

**Per game** (on the `game_record` / `game_end` event and on each entry of `series/<id>.json` `games[]`):

| field | type | values / how derived |
|---|---|---|
| `end_reason` | enum | `normal` means `|win|` with no forfeit or inactivity message in the game. `forfeit_opp` / `forfeit_me` come from `|-message|<name> forfeited.`. `inactivity_opp` / `inactivity_me` come from `|-message|<name> lost due to inactivity.` or the matching `|inactive|` line. `tie` comes from `|tie|`. `unknown` means the room closed with no `|win|`. |
| `end_by` | string or null | the name in the forfeit or inactivity message |
| `end_turn` | int | the last `|turn|N` seen; 0 if none |
| `at_preview` | bool | `end_turn === 0` (no `|turn|` line was ever sent) |
| `end_raw` | string | the verbatim protocol line that decided `end_reason`, for audit |

`timeout` and `inactivity` are one server mechanism (the battle timer). Record them as `inactivity_*`. Do not add a separate `timeout`, which would let one event carry two labels. ROTOM's own decision timeouts are a separate thing and are already counted in `during_series.timeouts`.

**Per series** (on the `ladder-series-*.jsonl` row and `series/<id>.json`):

| field | type | values / how derived |
|---|---|---|
| `end_reason` | enum | `normal`: the winner won 2 games that ended `normal`. `forfeit_opp` / `forfeit_me`: the deciding game ended by forfeit. `inactivity_opp` / `inactivity_me`: the same for inactivity. `walkaway_opp` / `walkaway_me`: `series_end` arrived with the winner holding fewer than 2 game wins **and** the last game ended `normal` (gen5ab k8), or with no game for the next `gnum`. |
| `end_game` | int | the gnum of the deciding game, or the gnum of the game that never started (for a walkaway) |
| `end_turn` | int | the `end_turn` of the deciding game; 0 for a walkaway |
| `at_preview` | bool | true if the series ended at a team preview, including every walkaway |
| `games_won` / `games_lost` | int | counted from `games[]`, so a series that ended short is visible without re-parsing |
| `any_forfeit_opp` | bool | true if any game in the series was forfeited by the opponent, even when the decider was normal (k33) |

**Scoring rule, unchanged.** `S` stays what the server scored (a forfeit is a win or a loss). The new fields let the settled figure be reported **both** with and without forfeit-decided series. The ladder number must also filter `rated === true`, because of k30.

**Tests owed with the change:**
- A fixture per `end_reason` value, made from these real logs: k22 g2 (forfeit mid-game), k13 g1 (preview forfeit), k9 g2 (preview inactivity), k8 (walkaway).
- Proof that a counter which never fires would be caught: a run where every game reads `normal` must fail against the k22 fixture.

## Caveats

- The samples are small: 20, 15 and 26 series; 282, 228 and 477 damaging targets. The protect and immunity gaps are large next to that noise. Differences of 2–3 points in the effectiveness shares are not.
- gen5ab was live during the read. The last series row read was k35.
- For humans, one game contributes both players' clicks, and the population includes games that bots played against each other. medicham32 games are excluded; other bots are not identified.
- Voluntary switches are "before the first move of the turn". A forced switch that lands before the first move of the turn would be miscounted as voluntary. It could only inflate `switch` slightly, and it was not audited.
