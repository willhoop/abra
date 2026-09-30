# ROTOM's top-meta ladder rotation — 2026-09-30 (abra/regmc 1.31.0)

**Verdict.** The new rotation, `solver/rotom/teams/ladder-rotation-top.json`, holds **5 teams rated 1478 to 1596**
(median 1505). Each team is an exact six that at least 3 players brought at or above a **floor of 1409**, which is the
99th percentile of rated bo3 sides. T1's six was brought by 7 players. Every species on these teams is on at least 3% of
the top teams, and no team under-performs the top baseline S − E. The arm `solver/rotom/arms/gen5-chomp-top.json` names
this rotation. No game was played, and the live chomp1 run was not touched.

**The old rotation was already top-rated.** Its problem was that it was not meta. Its teams were rated 1379 to 1549
(median 1462), which is the 98.3rd to 100th percentile. But each of its five sixes was used by only **one** player at the
floor, and two of those sixes carried a species that is on only 0.7% of the top teams: Hippowdon in L1 and Corviknight in
L5. A 1435 rating on this ladder is at the 99.4th percentile, not mid-ladder. The median rated side is 1119.

**The meta screen is noisy at its edge.** The first build read the store one hour before the second. In that hour one
family moved from 3 players and S − E −0.187 to 4 players and −0.037, and it replaced the 2-player six Basculegion /
Floette-Eternal / Garchomp / Incineroar / Rillaboom / Volcarona as the fifth team. The four strongest families did not
change. The committed rotation is a frozen snapshot: the arm points at the file, and the file does not move until someone
rebuilds it.

## 1. How the rotation was built and assigned (before this change)

- `solver/rotom/ladder.js` `assign(seed, k, armIds, teamIds)`: the team for series k is
  `teamIds[h32(seed|k|team) mod n]`, where h32 is the first 32 bits of a sha256. This is uniform over the rotation and
  depends only on (seed, k). `planDigest` hashes the first 5,000 assignments. The plan also records `rotation_file`,
  `rotation_sha256` and `team_ids`. A restart with a different plan is refused.
- Each series row carries `team` and `team_meta: { archetype: team.archetype.label, from_game, rating }`
  (`ladder.js`, unchanged).
- The rotation file came from `solver/rotom/build_ladder_teams.js`, reading GURU's `solver/out/meta/archetypes.json` and
  `games.clean.jsonl.gz` (2026-09-23). The builder took one team for each stable archetype, in order of share: the
  highest-rated open-sheet side assigned to that archetype that carries its defining species. It applied no test of how
  common the six was and no test of how it performed.
- `rotom.js` read `--rotation`, with `teams/ladder-rotation.json` as the default. The arms file had no say in it.

**The current rotation** (`ladder-rotation.json`, 5 teams). Min 1379, median 1462, max 1549. Percentiles and shares are
measured on the store described in §2.

| id | rating | pct | archetype | players with this six at the floor | species under 3% of top teams |
|---|---|---|---|---|---|
| L1 | 1435 | 99.4 | Incineroar / Rillaboom / Sneasler | 1 | Hippowdon 0.7% |
| L2 | 1549 | 100.0 | Indeedee-F / Sneasler / Gardevoir | 1 | — |
| L3 | 1467 | 99.7 | Kingambit / Rillaboom / Sneasler | 1 | — |
| L4 | 1462 | 99.7 | Rillaboom / Gholdengo / Arcanine-Hisui | 1 | — |
| L5 | 1379 | 98.3 | Tyranitar / Salamence / Excadrill | 1 | Corviknight 0.7% |

## 2. The source

The source is the **tracked bo3 store `data/games.gen9championsvgc2026regmcbo3.jsonl.gz`**, after merging `origin/main`
at `d98253ba`: 37,491 games from 2026-09-09 08:08 to 2026-09-30 00:20, sha256 `fe78202a8515…`, all open sheet.

I did not use the frozen pool `data/team-pool-frozen-regmc`. That pool was cut on 2026-09-21 and ends nine days earlier.
Its purpose is to make ENGINE measurements comparable across runs, and a team choice does not need that. A ladder team
should reflect the current top meta. Reproducibility comes from the store digest and the counts recorded in the rotation
file. `test-rotom-top-rotation.js` REBUILD re-derives the same teams while the store is unchanged. Once the hourly
ingest has moved the store, it prints NOT CHECKED, never a pass.

**The file read is the `.gz`, named explicitly** (`build_top_rotation.js` `STORE_DEFAULT` = `data/games.<bo3 format>.jsonl.gz`,
and `--store` overrides it). The builder does not go through `engine/quality.js` `storePath()`. The coordinator warned
that `storePath()` prefers the plain `.jsonl`, and in the main checkout that file is a stale snapshot that stops at
2026-09-21. The worktree has no plain file. The builder takes only the hard exclusions of the corpus filter, by calling
`Q.reasons()` on the games it read itself. It excludes **759 games: 220 with a bot flag and 539 involving a behavioural
bot**, and the 8 behavioural-bot names are recorded in the rotation file. It keeps the filter's outcome rules (`short`,
`partial_bring`, `forfeit_no_action`) out, because rule 1 below decides outcomes itself.

**The rating distribution** covers 63,366 rated human open-sheet sides, excluding bots and our own accounts. Min 1000,
median 1119, q95 1317, **q99 1409**, q99.9 1505, max 1630.

**Reconciling with the OPS count the coordinator relayed.** OPS reported 3 clean games with either player at 1500+ and 15
with both at 1400+. On the `.gz` (37,491 games), the `engine/quality.js` clean filter (`reasons()`, all rules) gives
**49 clean games with either player at 1500+ (0 with both), and 422 with either at 1400+ (89 with both)**. Before any
filter the counts are 71, 1, 627 and 136. I cannot reproduce 3 and 15. They are consistent with a count taken on a smaller
or older file, which is the `storePath()` trap. Either way, the floor here is a quantile of sides (q0.99 = 1409), not a
count of games where both players clear it, and it leaves 648 sides and 87 players.

**Bo1 closed-sheet teams: not used.** The scope is open sheets only, and the brief drops incomplete sheets. A bo1 game
reveals roughly 36% of moves and 19% of items (OPS), so a bo1 six can almost never be recovered completely.

## 3. The rule, and why each bar is set where it is

| bar | value | why |
|---|---|---|
| floor | **1409 = q0.99** | Top 1%: 648 sides, 87 players, 148 distinct player-teams. q0.95 (1317) would include players only ~200 points above the median. q0.999 (1505) leaves too few sides to find a six that more than one player used (0 games have both players at 1500+). |
| meta: same exact six, distinct players at the floor | ≥ 2 | This is the test the old rotation lacked. One player's six is a brew, not a meta team. |
| decided side-games at the floor | ≥ 8 | Below 8 games, the S − E estimate is noise. |
| every species' share of top player-teams | ≥ 3% | Excludes tech picks such as Hippowdon (0.7%), Corviknight (0.7%) and Meowstic-F (1.4%). |
| family mean S − E at the floor | ≥ −0.049, the mean over **all** sides at the floor | A rating recorded before the game regresses to the mean, so every top-rated group runs below 0. At q0.99 the mean is −0.049, even though the win rate is above 0.5. Comparing with 0 would reward only lucky samples. **This is a screen against clear under-performers, not a proof of strength.** The family samples are 15 to 49 games, so the SE is about 0.07 to 0.13 (it moved one family across the bar in an hour; see the verdict). |
| near-identical | 5 or more shared species → skip | The second six would be a mirror of a team already kept. |
| variety | at most 1 per stable GURU archetype, 3 to 5 teams | Will, solver/PLAN.md Q4: "a small rotation … (3–5 of them)". `rotom.js` enforces 3 to 5 at start-up. |
| sheet | highest-rated side of the family at the floor; complete (6 sets, each with an item, an ability, a nature and 4 distinct moves); bring and leads seen; every entity passes `legal()`; passes `TeamValidator` | This is the brief's completeness and legality requirement. The legality filter is read from `Dex.forFormat`, not typed. |
| spread | `build_assets.js` spreadFor (32 HP / 32 attacking stat / 2 Spe) | The store holds no Stat Points. This is the same rule as every rotation before this one. See §6. |

Sides counted: human (not a bot, not a behavioural bot, not our own accounts), open sheet, both ratings known, a winner,
and not an instant forfeit (a forfeit with 1 turn or fewer). S = 1 for a win, and E = 1/(1+10^((R_opp−R)/400)). The
families are ranked by distinct players, then games, then S − E.

## 4. Result: every family that at least 2 players brought at the floor

| verdict | players | games | win | S − E | six (and why skipped) |
|---|---|---|---|---|---|
| **T1** | 7 | 25 | 0.68 | +0.068 | Aerodactyl, Charizard, Farigiraf, Garchomp, Kingambit, Sylveon |
| **T2** | 4 | 15 | 0.667 | −0.037 | Arcanine-Hisui, Gholdengo, Raichu, Rillaboom, Salamence, Sneasler |
| **T3** | 3 | 49 | 0.735 | +0.153 | Dragonite, Floette-Eternal, Gholdengo, Incineroar, Rillaboom, Sneasler |
| **T4** | 3 | 20 | 0.50 | −0.015 | Arcanine-Hisui, Froslass, Kingambit, Raichu, Rillaboom, Sneasler |
| **T5** | 3 | 19 | 0.579 | −0.042 | Froslass, Garchomp, Kingambit, Rillaboom, Sneasler, Volcarona |
| skip | 3 | 11 | 0.364 | −0.313 | Arcanine-Hisui, Gholdengo, Raichu, Rillaboom, Staraptor, Sylveon (S − E; archetype taken; full) |
| skip | 3 | 9 | 0.333 | −0.237 | Archaludon, Charizard, Grimmsnarl, Pelipper, Swampert, Venusaur (S − E; full) |
| skip | 3 | 4 | 0.25 | −0.311 | Garchomp, Gholdengo, Incineroar, Raichu, Rillaboom, Volcarona (games; S − E; full) |
| skip | 2 | 23 | 0.609 | −0.055 | Floette-Eternal, Gholdengo, Incineroar, Rillaboom, Salamence, Sneasler (S − E; near-identical to T3; archetype taken) |
| skip | 2 | 18 | 0.50 | −0.124 | Archaludon, Charizard, Farigiraf, Golisopod, Grimmsnarl, Politoed (S − E) |
| skip | 2 | 10 | 0.60 | +0.056 | Basculegion, Floette-Eternal, Garchomp, Incineroar, Rillaboom, Volcarona (rotation full; T5 in the build an hour earlier) |
| skip | 2 | 4 | 0.25 | −0.287 | Charizard, Indeedee, Kingambit, Kommo-o, Meowstic-F, Sneasler (games; Meowstic-F 1.4%; S − E) |
| skip | 2 | 2 | 1.00 | +0.573 | Basculegion, Charizard, Floette-Eternal, Garchomp, Incineroar, Whimsicott (games) |

**The rotation.** Each team is the sheet of the highest-rated pilot of its six. The label is GURU's where GURU assigns
the six to a stable archetype. Otherwise the label is the six itself, listed most-used first, because three names
collided for T4 and T5.

| id | rating | pilot | game | archetype label | bring (sheet indices, leads first) |
|---|---|---|---|---|---|
| T1 | 1596 | nessie123 | …2688791113 (09-27) | Kingambit / Garchomp / Charizard / Farigiraf / Sylveon / Aerodactyl | 4,2,0,1 |
| T2 | 1478 | marcosdeltasena31 | …2687403922 (09-25) | Rillaboom / Gholdengo / Arcanine-Hisui (GURU 3) | 0,5,4,2 |
| T3 | 1534 | emmagrande | …2687201627 (09-24) | Incineroar / Rillaboom / Sneasler (GURU 0) | 4,5,1,0 |
| T4 | 1498 | cabezafracassata | …2689308610 (09-28) | Rillaboom / Sneasler / Kingambit / Raichu / Arcanine-Hisui / Froslass | 4,2,3,5 |
| T5 | 1505 | mmjej | …2685861544 (09-22) | Rillaboom / Sneasler / Kingambit / Garchomp / Volcarona / Froslass | 2,4,1,5 |

**Top archetypes in the rotation:** the Garchomp / Charizard sun six (T1, 7 players); Rillaboom / Gholdengo /
Arcanine-Hisui (T2); Incineroar / Rillaboom / Sneasler with Floette and Gholdengo (T3); and Rillaboom / Kingambit /
Sneasler with Froslass (T4, T5). Rillaboom is on 4 of the 5 teams. That is the top meta (Rillaboom is on 51.4% of top
teams), not a failure of variety. T4 and T5 share 4 species, which is under the near-identical bar of 5.

## 5. What changed in code

- `solver/rotom/build_top_rotation.js` (new). It exports `build`, `checkRotation`, `readStore`, `sidesOf`, `rowOf`, `RULE`
  and `HARD_EXCLUDE`. Every family considered is written into the output as `families_considered`, including the skips
  and the reason for each skip.
- `solver/rotom/teams/ladder-rotation-top.json` (new). Its fields: `rule` (floor, the quantile, counts, baseline, the
  quality-filter exclusions), the `source` digests, and for each team `family` (players, games, win rate, S − E, and each
  species' share at the floor).
- `solver/rotom/arms/gen5-chomp-top.json` (new). It is `gen5-chomp.json` with arm A byte-identical, plus
  `"rotation": "solver/rotom/teams/ladder-rotation-top.json"`. `gen5-chomp.json` is not changed, so the live chomp1
  run's plan stays valid.
- `solver/rotom/rotom.js`. In ladder mode, the arms file's `rotation` is the rotation. A `--rotation` that contradicts it
  exits 2, and so does a named rotation that does not exist. An arms file without the key behaves as before. The plan
  digest already includes the rotation file and sha, and every series row already carries `team_meta` with the rating
  and archetype label. So the run's record names the teams it played.
- `solver/tests/test-rotom-ladder.js`. ROTATION validates every rotation that an arms file names, not just the default,
  and checks that each team carries the `team_meta` fields. It has three new STARTUP refusals: a contradicting
  `--rotation`, a repeating `--rotation` that passes (and then hits the pre-gate refusal), and a missing rotation.
- `solver/tests/test-rotom-top-rotation.js` (new).

## 6. Tests

| test | result |
|---|---|
| `solver/tests/test-rotom-top-rotation.js` | **GREEN 10/10** (CHECK, CONTROL ×4, ARM ×3, REBUILD on the unchanged store) |
| … `--break floor` (T1 copy re-rated 1200) | **RED 9/10, exit 1**: "TX rating 1200 is below the floor 1409 \| TX store rating 1596 != recorded 1200" |
| … `--break illegal` (a nonstandard item, derived from the dex: Ability Shield) | **RED 9/10, exit 1**: "TeamValidator: Kingambit's item Ability Shield does not exist in Gen 9 \| … is not legal" |
| … `--break offmeta` (a species at 0.5%) | **RED 9/10, exit 1** |
| `solver/tests/test-rotom-ladder.js` | **GREEN 142/142** (was 114) |
| `solver/tests/test-rotom-chomp-live.js` | **GREEN 13/13** (its `--break pv` self-check RED as required) |
| `solver/tests/test-rotom.js`, `test-rotom-throttle.js` | **GREEN 105/105, 33/33**. In a worktree the throttle test needs `SHOWDOWN_PATH` set, because `../pokemon-showdown-mc` is not a sibling of `.claude/worktrees/…`. This is environmental and existed before this change. |
| `tests/test-docs-current.js` | 39 passed, 0 failed |

The tests were re-run on the final build (after the merge). No games were played.

**Weaknesses, stated.**
1. **The spread is derived, not the pilot's.** The store has no Stat Points, so every set is 32 HP / 32 attacking stat /
   2 Spe. T3's Choice Scarf Gholdengo and T5's Choice Scarf Garchomp therefore run almost no Speed investment. The old
   rotation had the same limitation, and this change neither causes nor fixes it. It is owed to whoever rebuilds
   `spreadFor` (for example, a speed tier read from the store's turn order).
2. **The success screen is weak and noisy at its edge** (the swap described in the verdict). It removes clear under-performers and does not
   rank strength.
3. **GURU's archetypes were fitted over all ratings (2026-09-23).** At the floor they assign fewer than half of the
   sides, so 3 of the 5 teams carry the six as their label rather than a GURU archetype.

## OWED, NOT RUN

The next ladder run with the new arm. It is Will's call, run from the **main checkout** after chomp1 has ended and this
branch is merged. Use a new seed and a new tag. Do not pool its residuals with chomp1's, because the rotation is part of
the arm.

```cmd
cd C:\Users\willj\Projects\Pokemon\ABRA
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\gen5-chomp-top.json --ladder-seed medicham32-chomptop-2026-09-30 --sets 20 --tag chomptop --priority normal --max-hours 4
```

Before the run: `node solver/tests/test-rotom-top-rotation.js` and `node solver/tests/test-rotom-ladder.js` must be green
on main, and `dir solver\out\rotom\STOP solver\out\rotom\KILL` must find nothing. The start-up line must print
`rotation T1,T2,T3,T4,T5`. The readiness bars are those of `gen5-chomp.json`. There is no SPRT, because it is one arm.
The headline stays the settled rating over N ≥ 100 series, never the peak. Once the store has moved, REBUILD prints NOT
CHECKED. That is expected, and the rotation file is still the one the arm plays.
