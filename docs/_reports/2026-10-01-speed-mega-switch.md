# Speed control, mega and switching: the ladder bot beside its opponents and the open-sheet humans (abra/regmc 1.55.0)

2026-10-01. SOLVER. Read only: no game was played and no ladder run was touched. The bot's games are read from the
main checkout's `solver/out/rotom/` room logs. The humans are read from the tracked raw-log shards, filtered through the
bo3 store and `engine/quality.js` `reasons()`.

**Will's framing (2026-10-01):** *"its okay if it doesnt line up with humans, maybe its best to not switch and not worry
about speed but i just want to have that info tracked."* The human figures here are context, not a target. A difference
is flagged only where the data shows it costs games.

## Verdict

- **Like with like, the bot does all three things at the human rate.** Each figure is observed over expected, where
  expected is the 1400+ human rate for the same species, move, turn and position, summed over the bot's own body-turns:
  - speed-control use: **0.88** [0.69, 1.12];
  - voluntary switch-outs: **1.06** [0.92, 1.22];
  - mega evolution: **0.98** [0.81, 1.18].
- **Mega is fine.** The bot megas on 94.1% of the games where it can (112 of 119). That is the same as its opponents
  (94.0%), the 1400+ humans (95.4%) and the human floor in `mega_rate.js` (94.88%). It megas on the first capable turn
  more often than strong humans (89% vs 72%), and from slot a more often (74% vs 61%). Neither difference costs games.
- **Two things do cost games.**
  1. **The opponent's speed control.** When the opponent used speed control, the bot won 33% (19 of 57); otherwise it
     won 55% (38 of 69). The difference is −0.22 [−0.39, −0.05]. Humans barely feel it: −0.03 at 1400+ and −0.01 at
     1200–1399. In the post-mortem's 5 SPEED_CONTROL losses, the four we brought held no speed control in 3, only
     Sneasler's Rock Tomb in a fourth, and Tailwind in the fifth. Our teams used Trick Room 3 times in 126 games; the
     opponents used it 31 times.
  2. **Voluntary switch-ins that are KO'd the same turn.** This is 15.4% of the bot's switch-ins (32 of 208), against
     8.1% for its opponents and 10.0% for 1400+ humans. Games with one are won 21% vs 53%, a gap of −0.32
     [−0.50, −0.14]. Humans show the same association, −0.21 at 1400+, so part of it is that losing positions breed
     bad switches. The rate gap is the bot's own. This is the post-mortem's VISIBLE_KO class.
- **Where the bot does not use speed control and the foe is faster, the problem is half coverage and half judgement.**
  This happened on 109 decisions:
  - on 50, no speed-control row was in the search's table (coverage: MAG/DODUO's narrowing);
  - on 59, the row was there but got 9% of the mix and was valued 0.06 below the row chosen (judgement).
- **For mega and switches, the table check finds judgement, not coverage.**
  - A mega the bot did not take was always in the table (27 of 27), valued level with the choice (−0.001).
  - Turns where strong humans switch at least 25% of the time: 85. The bot switched on 33. A switch row was in the
    table on 72 and absent on 13.
- **Standing tracking landed.** Every ROTOM game record now carries `tactics`, and the client summary carries the
  running totals. `node solver/rotom/report.js ladder <dir>` prints the counters beside the record, per arm and split
  won and lost. Every arena match row carries `tactics.x` and `tactics.y` (`solver/mew/play.js`), and the shard summary
  has them per agent. `solver/tests/test-tactics.js` is GREEN 28/28 and RED under `TACTICS_BREAK=blind`. The real
  client wrote `tactics` on both game records in `test-rotom-endings-live.js` (GREEN 20/20).

## 1. What was read

**Our games.** There are 224 finished games in 5 ladder runs, all on release `eaa5becc54eb`
(`measured.json` `inputs.per_run`).

| group | policy | games | runs |
|---|---|---|---|
| bot (search arm) | `miltank-gen5`, 5 s | **126** (57 won) | gen5ab arm A 41, chomp1 50, **chomptop 35** (still live; the 35 games finished when read, 07:21Z) |
| bot (prior arm) | `prior` (MAG+DODUO greedy) | 98 (41 won) | aa1 22, aa2 41, gen5ab arm B 35 |

- **The runs are pinned** (`analyze.js --runs`, recorded as `inputs.runs_pin`). `chomptopfix-2026-10-01T07-18-26-877Z`
  started at 07:18Z while this ran, on the 1.52.0 world fixes, and is left out. `--runs all` includes it.
- The opponents' mean rating is 1119.
- A game counts when its room log has a `|win|` or `|tie|`.
- 30 of the 126 search-arm games ended in a forfeit. Most were the opponent's (`docs/_reports/2026-09-30-ladder-loss-postmortem.md`).

**Humans.**
- The input is 281 tracked raw shards, `data/raw/games.gen9championsvgc2026regmcbo3/` (20260909T1850 to
  20261001T0226). Every id is in the bo3 store `data/games.gen9championsvgc2026regmcbo3.jsonl.gz` (sha256 `7c15d94eab4a…`).
- `quality.reasons()` excluded 12,313 games. Most were `partial_bring` (12,117), then `short` (2,677). The behavioural-bot
  accounts came from both stores, as in `solver/meta/extract.js`.
- 82 games with our own accounts were dropped, and 1 game with no sheets.
- **27,143 games were used.** Each side is banded by that player's own rating at game start: **1400+** has 588 sides
  (mean 1445), **1200–1399** has 10,073, and **under 1200** has 37,551. The 1400+ band is where the top data is, and
  it is thin.

**One reader for all three groups.** `solver/arena/tactics.js` `fromLog()` reads every group: the bot from its own
room logs, the opponents from the other side of the same logs, and the humans from the raw logs. A check that the
bot's rows decode correctly through our sheet's move order: 1,276 of 1,277 decoded choices match the move the log shows
the slot used.

## 2. Definitions (derived, never listed)

`TAC.derive()` reads `Dex.forFormat('gen9championsvgc2026regmcbo3')` and keeps legal entities only.

**Speed-control moves (34).**
- trickroom: `trickroom`.
- tailwind: `tailwind`.
- self_boost (13): `agility`, `aquastep`, `aurawheel`, `clangoroussoul`, `dragondance`, `flamecharge`, `noretreat`,
  `quiverdance`, `rapidspin`, `rockpolish`, `shellsmash`, `shiftgear`, `tidyup`, `trailblaze`.
- foe_drop (12): `bulldoze`, `cottonspore`, `drumbeating`, `electroweb`, `icywind`, `lowsweep`, `mudshot`, `pounce`,
  `rocktomb`, `scaryface`, `stringshot`, `toxicthread`.
- paralysis (5): `glare`, `nuzzle`, `stunspore`, `thunderwave`, `zapcannon`.
- speed_swap: `speedswap`.
- An effect counts only if it is certain (100%). Body Slam's 30% paralysis and Ancient Power's 10% boost are out.
- A weather or terrain move (`raindance`, `sunnyday`, `sandstorm`, `snowscape`, `chillyreception`, the terrains)
  counts only for a side whose six hold an ability whose `onModifySpe` reads that weather or terrain.

**Speed abilities (19)** are folded into the Speed estimate, not counted as uses. The weather and terrain each one
reads, and its factor, are parsed from the ability's own handler:
- weather: `swiftswim` (rain), `chlorophyll` (sun), `sandrush` (sand), `slushrush` (snow);
- terrain: `surgesurfer`;
- status: `quickfeet`;
- item lost: `unburden`;
- boosters: `speedboost`, `steamengine`, `weakarmor`, `rattled`, `motordrive`, and others.

The priority abilities are listed and not counted: `prankster`, `galewings`, `triage`, `quickdraw`, `myceliummight`,
`stall`.

**The factors** are parsed from the format too: Choice Scarf ×1.5, Iron Ball ×0.5, paralysis ×0.5, Tailwind ×2.

**"Mattered" vs "wasted".** At the moment of use:
- **mattered**: some foe acts before some live ally beyond any spread. Under the field's current order (Trick Room
  reverses it), the foe's Speed at 0 SP beats the ally's at 32 SP.
- **wasted**: every ally already acts first beyond any spread.
- **close**: neither.

**Switches.**
- **voluntary**: chosen at the turn's start, into a slot whose body had not fainted.
- **forced**: a faint replacement.
- **pivot**: after the slot's own `selfSwitch` move.
- What met the switch-in that turn is read from the log: KO'd, every hit resisted or immune, super-effective, neutral,
  or unhit.
- **preserved_scored**: a body switched out voluntarily that later came back and KO'd a foe inside its own move.

## 3. The table (all groups, all games)

| metric | bot (search) | its opponents | humans 1400+ | humans 1200–1399 |
|---|---|---|---|---|
| sides (games) | 126 | 126 | 588 | 10,073 |
| speed control available (games) | 56.4% | 77.8% | 74.2% | 75.2% |
| speed-control uses / game | 0.55 | 0.56 | 0.71 | 0.70 |
| uses / available turn | 0.216 | 0.158 | 0.201 | 0.197 |
| first use, turn p50 | 1 | 1 | 2 | 2 |
| uses that mattered / wasted | 42% / 19% | 75% / 4% | 61% / 7% | 58% / 7% |
| our Trick Room / Tailwind uses | 3 / 19 | 31 / 18 | 70 / 143 | 1,167 / 2,027 |
| faced the foe's Trick Room (games) | 28 (22%) | 0 | 52 (9%) | 1,057 (10%) |
| mega when capable | **94.1%** (112/119) | 94.0% (109/116) | 95.4% (540/566) | 96.1% |
| mega on the first capable turn | 89% | 84% | 72% | 74% |
| mega slot a / b | 83 / 29 | 62 / 47 | 331 / 209 | 5,481 / 3,626 |
| voluntary switches / game | **1.65** | 1.28 | 1.66 | 1.73 |
| voluntary switches / turn | 0.226 | 0.175 | 0.209 | 0.215 |
| forced replacements / game | 1.51 | 1.40 | 1.69 | 1.72 |
| pivots / game | 0.13 | 0.13 | 0.22 | 0.30 |
| double switches / game | 0.024 | 0.032 | 0.053 | 0.046 |
| switch-in KO'd that turn | **15.4%** | 8.1% | 10.0% | 10.3% |
| switch-in took only resisted/immune hits | 24.5% | 19.9% | 21.2% | 22.4% |
| switched out, later scored a KO | 18% | 23% | 28% | 29% |

The prior arm (98 games):
- speed control: 1.16 uses per game, 41% mattered;
- mega 96.7%;
- 1.16 voluntary switches per game, like with like 0.75 [0.62, 0.90]: it switches less than humans;
- switch-in KO'd 22.8%.

### Like with like (observed / expected, the 1400+ reference)

- Expected sums the human rate of the same act in the same stratum over the bot's own body-turns. The strata are:
  - speed control: species × move × the order at turn start × turn 1 / 2–3 / 4+;
  - switch-out: species × turn × HP above or below 50%;
  - mega: the mega species.
- A stratum with fewer than 20 human opportunities at 1400+ falls back to 1200+, then to all bands. How often each
  fallback was used is in `measured.json` `oe_*.by_band`.
- The interval treats the observed count as Poisson.

| | bot (search) | its opponents | bot (prior) |
|---|---|---|---|
| speed control | 0.88 [0.69, 1.12] (69 vs 78.2) | 0.92 [0.71, 1.16] | 1.10 [0.91, 1.32] |
| switch-out | 1.06 [0.92, 1.22] (208 vs 195.9) | **0.84** [0.71, 0.98] | **0.75** [0.62, 0.90] |
| mega | 0.98 [0.81, 1.18] (112 vs 114) | 0.99 | 1.03 [0.83, 1.26] |

**Speed control, by move, like with like.** These are use rates per opportunity, split by the order at turn start:
foe faster (mattered), close, or already faster (wasted).

| move | bot: mattered / close / wasted | humans 1400+ |
|---|---|---|
| Tailwind | 24% (41) / 28% (32) / 0% (35) | 21% / 14% / 2% |
| Zap Cannon | 16% / 35% / 33% | 28% / 36% / 34% |
| Quiver Dance | 22% / 38% / 28% | 23% / 38% / 21% |
| Trick Room | 15% (13) / 6% (17) / – | 24% / 4% / 0% |

- **The bot's "wasted" share comes from the same place as the humans'.** Zap Cannon is an attack whose paralysis is
  certain, and Quiver Dance is setup. Humans "waste" those too.
- **Tailwind is used as humans use it.** It is never used when already faster.
- **The gap is Trick Room, and it is team composition, not play.** Our brought fours had 30 Trick Room opportunities in
  126 games. Humans at 1400+ had 511 in 588.

## 4. Won vs lost (bot search arm)

| | won (57) | lost (69) | humans 1400+ won / lost |
|---|---|---|---|
| speed-control uses / game | 0.46 | 0.62 | 0.67 / 0.76 |
| mega when capable | 90% (46/51) | 97% (66/68) | 95% / 96% |
| voluntary switches / game | 1.60 | 1.70 | 1.69 / 1.63 |
| switch-in KO'd | **8.8%** | **20.5%** | 6.6% / 14.0% |
| switch-in only resisted / immune | 35% | 16% | 22% / 20% |
| faced foe Trick Room / Tailwind (games) | 11 / 5 | 17 / 12 | |

Five of the seven capable-but-never megas came in won games, mostly ones the opponent forfeited early.

## 5. Does it cost games? (win-rate difference, yes − no, 95% interval)

| condition | bot (search) | humans 1400+ | humans 1200–1399 |
|---|---|---|---|
| we used speed control | −0.06 [−0.24, 0.13] | −0.02 | **+0.03** [0.01, 0.05] |
| **the opponent used speed control** | **−0.22 [−0.39, −0.05]** | −0.03 [−0.11, 0.05] | −0.01 [−0.03, 0.01] |
| the opponent set Trick Room or Tailwind | −0.12 [−0.30, 0.06] | −0.03 | −0.02 |
| capable side megaed | −0.30 [−0.65, 0.04] (n = 7 never) | −0.05 | **−0.13** |
| switched voluntarily at least once | +0.08 [−0.15, 0.30] | +0.03 | **+0.09** |
| **a switch-in was KO'd that turn** | **−0.32 [−0.50, −0.14]** | −0.21 [−0.31, −0.10] | −0.11 |
| a switch-in took only resisted / immune hits | **+0.27** [0.09, 0.44] | +0.05 | +0.08 |

- These are associations, not effects. A losing position breeds desperate switches, and a strong team also carries
  Trick Room.
- **The opponent-speed-control row is the one that separates the bot from humans.** Humans of every band are indifferent
  to the foe's speed control; the bot loses 22 points.
- The switch-in-KO row is shared with humans, but the bot walks into it half again as often.
- The mega row's −0.30 rests on 7 never-megaed games, 5 of them early forfeits. It is noise.

### The post-mortem's five SPEED_CONTROL losses (`measured.json` `loss_postmortem_speed_control`)

| post-mortem game | the opponent's move | our brought four's speed control | the opponent's speed control in a searched column? |
|---|---|---|---|
| 6 (theson1909 g3) | Farigiraf Trick Room t3, mattered | **none** | yes, `trickroom, …` at t3 |
| 7 (AngryGator g1, Will's case) | Farigiraf Trick Room t4, mattered | **none** | yes, at t1 and t4 |
| 8 (malvasio g1) | Farigiraf Trick Room t1, mattered | Sneasler's Rock Tomb only | yes, at t1 |
| 15 (shinyscizor89 g3) | Trick Room t1, mega Salamence Tailwind t5, both mattered | **none** | Trick Room yes; Tailwind not in the columns |
| 17 (bruinbroker01 g2) | Whimsicott Tailwind t3, mattered | Salamence Tailwind, set on t1 | no |

- In four of the five, our four had no Trick Room or Tailwind of its own.
- In four of the five (6, 7, 8, 15), the search saw Trick Room coming in its columns and still valued the position at
  0.63–0.85. That is the post-mortem's horizon finding: a one-turn leaf does not charge for Trick Room turns.

## 6. The table check: judgement or coverage?

This covers the 919 searched move decisions of the search arm. 2 had no row list and were skipped.

| situation | decisions | option in the table | option absent | when present: mix on it / value vs chosen |
|---|---|---|---|---|
| foe faster, speed control on the field, not used | 109 (71 in losses) | 59 | **50 (coverage)** | 0.093 / −0.063 |
| … and humans in that stratum use it ≥ 30% | 19 | 14 | 5 | |
| mega ready, not taken | 27 (18 in losses) | **27** | 0 | 0.095 / −0.001 |
| humans in that stratum switch ≥ 25%, bot did not | 52 of 85 | 72 of 85 had a switch row | 13 | |

- Over all 919 decisions, a switch row was in the table on 625. The mix on switch rows averaged 0.22, and the bot
  switched on 210.
- **Speed control is split.** Half the time the narrowing dropped the speed-control row. The other half, the search
  ranked it lower.
- **Mega and switching are judgement calls.** The option was nearly always on the table.

## 7. Examples

1. **Switched into a KO every column predicted (VISIBLE_KO).** theson1909 g2, turn 3: Kingambit out, Gengar into slot b,
   KO'd. https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690119994
2. **Double switch into Heat Wave.** Turn 2: Gardevoir out, Archaludon into slot a, KO'd by Delphox's Heat Wave; the
   other switch-in, Basculegion, resisted it. Lost.
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690149705
3. **A good pivot.** Turn 2: Arcanine-Hisui out, Gholdengo into Incineroar's Fake Out (immune). Arcanine came back on
   turn 5 into a resisted Dire Claw and KO'd Incineroar on turn 8. Won.
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690108496-nvj1pegmmx4q0t0p91byy9wv1qj3f08pw
4. **The opponent's Trick Room with nothing to answer it.** AngryGator g1, turn 4 (Will's case): double Protect while
   Farigiraf set Trick Room. Our four had no speed control.
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690121468-je1ca9h7t1ieywx0ohi326o4gihs7lfpw
5. **Tailwind in the table, not taken, the foe faster (judgement).** Turns 1 and 2: Salamence's Tailwind row was valued
   0.38 and 0.32, against 0.46 and 0.44 for the rows played. Lost.
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690146981-p1kcd17hr43vi1q4fp9uct8q36yqbygpw
6. **Tailwind not in the table at all (coverage).** Turns 1–3: Salamence carried Tailwind and the foe was faster, but no
   candidate row held it. Lost.
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690157657-j0lwxbefp3tsdfy40broshgl3r5le9ypw
7. **A mega held for four turns (judgement, roughly level values).** Turns 1–4: the best mega row sat 0.06, 0.03 and
   0.06 below the choice on turns 1, 2 and 4, and 0.01 above it on turn 3. Lost. https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690128111
8. **Tailwind while already faster.** Mega Dragonite, turn 5. Lost.
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690830687-rhmy6avgrll3xpgspth403bltuxi52lpw

## 8. The standing counters (what landed)

- **`solver/arena/tactics.js`.** One definition, two readers:
  - `fromLog(text, { me })` reads a battle log (ROTOM, replays, raw human logs);
  - `game(API)` reads the arena's engine state, before and after each step.
  - Where they differ is stated in its header. The arena knows the exact `effSpeed`, so its "close" class is only a
    tie. It prices a switch-in against the foe's chosen moves with MEDICHAM's `dmgRange` and the Dex type chart. It
    has no KO attribution (`preserved_scored` is null).
- **ROTOM** (`solver/rotom/rotom.js`).
  - Every game record has `tactics: { mine, opp }`.
  - The client summary has `tactics` totals and an `errors` count. A failure is a `tactics_error` event, never silent.
- **`node solver/rotom/report.js ladder <dir>`** prints, per arm, our counters for all, won and lost games and the
  opponents' counters. They are read from the run's own room logs (`tacticsOfRun`), so runs played before this change
  are counted the same way. The chomp1 output is shown in §9.
- **Arena** (`solver/mew/play.js`).
  - Every match row has `tactics.x` and `tactics.y`, and every self-play record has `tactics`.
  - The shard summary has `tactics.by_agent`.
  - Smoke: 1 pair, human-clone against itself, on `eaa5becc54eb`. Each side had 1–4 speed-control uses, a turn-1 mega,
    and 2 forced replacements. The greedy clone made 0 voluntary switches.
- **Tests.**
  - `solver/tests/test-tactics.js` is GREEN 28/28. Its clauses are DERIVE, LOG (exact counts on a constructed log),
    ENGINE (a staged game on `eaa5becc54eb`: an immune switch-in, a slot-b mega, Icy Wind, the foe's Trick Room),
    REPORT and ROTOM (wiring). Under `TACTICS_BREAK=blind` it is RED: DERIVE, LOG, REPORT and ENGINE all fail.
  - `solver/tests/test-rotom-endings-live.js` gained a check that the real client's game records carry `tactics`.
    It is GREEN 20/20.
  - `test-rotom-endings.js` (59/59) and `test-rotom-replays.js` (41/41) are still green.

## 9. `report.js ladder` on chomp1 (trimmed; the speed line now ends with the uses by move)

```
tactics: 50 finished games read from the run's own room logs (0 unfinished left out)
arm A ours tactics over 50 games:
  speed control  available in 24/50 games, used 18 (0.36/game, 0.2/available turn, in 46% of games it was available), first use turn p50 1; mattered 9, wasted 1, close 8, ...
  mega           capable 45/50 games (a stone brought in 47), megaed 45 (100%), never 0; turn p50 1, delay p50 0, slot a/b 39/6
  switches       voluntary 71 (1.42/game, 0.1924/turn), forced 76, pivots 13, other 0, double 2; into: KO 6, resist/immune 25, SE 3, neutral 12, unhit 25; switched out and later scored a KO 16
```

## Files

- `solver/arena/tactics.js`: the counters.
- `solver/results/2026-10-01-speed-mega-switch/analyze.js`: this analysis. The human pass is cached in
  `solver/out/speed-mega-switch/`, keyed by every byte it reads.
- `solver/results/2026-10-01-speed-mega-switch/measured.json`: every figure above.
- `solver/rotom/rotom.js`, `solver/rotom/report.js`, `solver/mew/play.js`: the wiring.
- `solver/tests/test-tactics.js`, `solver/tests/test-rotom-endings-live.js`: the tests.

## OWED, NOT RUN

- **No ladder run and no arena run was launched.** The counters start filling on the next ROTOM run, which is Will's
  call, and in the next arena or SPRT run.
- **The 1400+ band is thin**: 588 sides. Its strata fall back to 1200+ on 120 of 357 speed-control opportunities and
  205 of 1,710 switch body-turns. A larger 1400+ sample needs more weeks of the store.
- **The speed estimate is a range, not a stat.** Spreads are hidden, so "mattered" and "wasted" are claimed only beyond
  the 0–32 SP spread. 39% of the bot's uses and 32% of the 1400+ humans' fall in "close". Protosynthesis, Quark Drive
  and Slow Start are listed but not folded into the estimate.
- **The cost rows are associations.** No causal claim is made. An SPRT on an arm that changes one behaviour is the only
  test of an effect. Two candidates follow, both team- or leaf-side, and neither is proposed here:
  - a rotation slot that answers Trick Room;
  - a leaf that charges for the foe's Trick Room turns. The post-mortem already names PORYGON2 v2 with depth.
- **The speed-control coverage gap (50 of 109)** is MAG/DODUO's narrowing. Whether a reserved speed-control row, like
  the reserved switch row, would change anything is untested.
- **The switch-into-KO rate (15.4% vs 10.0%)** rests on 32 events. The post-mortem's VISIBLE_KO fix (depth in the leaf)
  is what would move it, and it is not measured here.
- `test-tactics.js` is not registered in any runner. Solver tests run standalone.
