# Repeat Protect: why the search mixes it in, what was tried, and why it is not deployed (2026-09-27)

SOLVER. Engine release `eaa5becc54eb`, `--team-store data/team-pool-frozen-regmc` (`games.bo3.jsonl` sha256 `a68263bb…`,
173 TEST pairs), honest information. The code that played every game below is commit `66aaa4eb` (the fix behind spec flags,
default off). Every artifact is in `solver/results/2026-09-27-protect-repeat/`. The previous account is
`docs/_reports/2026-09-26-protect-overuse.md`.

## Verdict

1. **The cause is the depth-0 horizon, not noise and not the die.** On the 13 probe positions where DODUO offers a repeat
   Protect, the stall die is sampled at the engine's odds (0.34 at counter 1). The per-cell SE is small (median 0.0024
   at 96 passes). The two halves of the passes give the same mix (0.626 and 0.607). Scored on its FAILED playouts only,
   the repeat row keeps 0.054 of its 0.609 mass, so all of its value is the success branch. In the positions where it
   took the mix, the shielded body was alive at the leaf and dead one turn later to the same column in 671 of 898
   success branches. The leaf credits a delayed KO. Two smaller mechanisms ride on it. In a position already lost
   inside the horizon, every row is about 0, and a Protect that delays the loss by 1e-4 takes the whole mix. And three
   times the ONE reserved mega row was the prior's top mega joint, which carried the repeat Protect in with the mega.
2. **The fix works on the table and fails in the game.** Quiescence (every playout plays one more turn before the leaf),
   plus a flat table played by the prior, plus a mega row that repeats no Protect, cuts the played repeat mass on the
   probe positions from 0.611 to 0.200. But at the league's 1 s budget in the arena it **loses strength**: SPRT against
   current gen5 (elo0 0, elo1 +20, α = β = 0.05) stopped at **H0 after 194 games, 0.418 [0.350, 0.488]**. The upper
   bound is below 0.5, so a loss is shown. It also does not move the arena Protect rates at 1 s: in the same 194 games the
   fix fails 10.4% of its Protects and gen5 11.7%, with consecutive shares 15.3% and 15.5%.
3. **Not deployed.** By the pre-registered deploy rule, `solver/machamp/league/gen5.json` is unchanged and the three
   options stay off. ROTOM and MACHAMP play exactly what they played before. Against DODUO-greedy at 1 s, on the same
   pairs and seeds as gen5's 0.660, the fix scored 0.615 [0.546, 0.680]. At 5 s it scored 0.685 [0.618, 0.745], against
   gen5-5s's 0.695. At 5 s its Protect fail rate was 7.1%, against gen5-5s's 13.4% on the same pairs and seeds. The
   DODUO-greedy arm, the same bot in both runs, also moved, from 10.9% to 8.4%. So the 5 s drop is suggestive and is not
   shown. No 5 s strength SPRT was run: it takes about 17 hours, and the command is below.
4. **DODUO: the counter is already a feature, so no retrain.** `stall_repeat` (the body's last move was a stalling move)
   agrees with the engine's counter on 440 of 443 counter-carrying positions for v1 and 498 of 503 for gen5 (the misses
   are the side guards, which feed the counter and are not stalling moves). The brief's retrain was conditional on the
   counter being missing. DODUO-greedy still re-clicks on 12.1% (v1) and 15.5% (gen5) of its own counter positions,
   against 6.0% on held-out human positions. The feature is there. The positions differ: DODUO's own Protect states
   carry their reasons into the next turn.

## The candidates, measured

`solver/tests/probe_protect_cells.js` refills the table of every offered position with an instrumented copy of
MILTANK's pass (the same world draw, the same CRN seed per pass, the same lean playout), 96 passes
(`probe-cells-96.txt`, `probe-cells-96.json`):

| candidate | measure | result | verdict |
|---|---|---|---|
| too few playouts per cell | per-cell SE of the mean | median 0.0024, max 0.0114 (mean over positions) | not the cause at 48–96 passes |
| | mix from passes 0,2,4… vs 1,3,5… | 0.626 vs 0.607 | stable |
| the stall die not sampled in the cell | Protect success over repeat-row playouts | 0.374 (0.34 without the one Wide Guard position, which never rolls; engine 1/3) | sampled |
| depth-0 leaf credits "no damage this turn" | mix mass with the repeat row scored on its failed playouts only | 0.054 (vs 0.609) | the value is the success branch |
| | success branches alive at the leaf, dead one turn later to the same column | 671 of 898 in the six high-mass positions (716 of 1,996 over all 13) | **the horizon effect** |
| payoff-table bias from shared pairs | repeat rows per table | 1.08 of 4 | not a duplication effect |
| | the reserved mega row | 3 of 13 tables: the only mega row repeats the Protect | **a bundling effect** |

## What was built

All three are options of `solver/miltank/search.js`, carried by a league spec (`solver/mew/agent.js searchExtras`) and by
ROTOM's `miltank-gen5` options (`solver/rotom/policy.js gen5Opts`). All are off unless the spec sets them.

- **`quiesce`** (`solver/miltank/rollout.js` QUIESCENCE). After the stepped turn, one extension turn before the leaf. Each
  side repeats its non-protect moves. A slot that protected takes DODUO's best non-protect move for that slot at the root
  (`fb`, read off the scores step 1 already computed). Anything else draws a non-protect move from the slot's menu.
  Mode `'held'` extends only playouts in which a protect held. It was built first and REJECTED before any game: it scores
  a protect row one turn deeper than its neighbours, and on one position it moved the repeat mass up, 0.913 → 0.991
  (`probe-variants-detail.txt`). Mode `'all'` extends every playout, so every cell has one horizon. Counters:
  `rollout.quietHeld`, `rollout.quiesced`, `search.quiesceDecisions`.
- **`flatEps`**. When every played cell is within `flatEps` of every other, the ranking prior's top joint is played (counted
  `flatPrior`). The solve still runs, so the root record is kept.
- **`reserveNoRepeat`**. The reserved mega row is the prior's best mega joint that repeats no stall-rolling move (dex
  `stallingMove`), when one exists (counted `megaUnbundled`).

Probe (`solver/tests/probe_protect_passes.js`, 40 positions, 48 passes; mass PLAYED on repeat rows when offered):

| variant | offered | mass | sampled |
|---|---|---|---|
| base (gen5, PORYGON2 leaf) | 13 | 0.611 | 8/13 |
| heuristic leaf | 13 | 0.641 | 8/13 |
| quiesce `'held'` | 13 | 0.421 | 5/13 |
| quiesce `'all'` | 13 | 0.378 | 5/13 |
| quiesce `'all'`, heuristic leaf | 13 | 0.381 | 4/13 |
| **shipped options** (`'all'` + flatEps 0.001 + reserveNoRepeat) | 10 | **0.200** | 2/10 |
| same, heuristic leaf | 10 | 0.292 | 3/10 |

Per position carrying the counter, the played repeat mass goes 0.199 → 0.050. One position (a Scald + Protect row,
value 0.44) keeps 0.99 under PORYGON2 and drops to 0.002 under the heuristic leaf. There, the net itself prefers the repeat.

**The cost.** At 1 s on the true battle, interleaved: 172.6 → 133.3 playouts per decision (`probe-cost.txt`). In the honest
arena (G), the fix's playouts p50 were 22–24 and 7–9% of cells were unfilled. gen5 on the same pairs (P-after): 28–29 and 3%.

## The arena

Pre-registered before the first game (`preregistration.json`; the 5 s addendum `preregistration-5s.json` was written after
G and during S, before any 5 s game, with the bars unchanged). All runs: `--release eaa5becc54eb --workers 3 --cap 50
--info honest --team-store data/team-pool-frozen-regmc`.

| run | flags | result |
|---|---|---|
| G, fix vs DODUO-greedy, 1 s | `gate.js --pairs 100 --pair-seed 1 --seed 26100 --rule notlose` | **0.615 [0.546, 0.680]**, PASS (notlose); gen5 on the same pairs and seeds 0.660 [0.592, 0.722] |
| S, fix vs gen5, 1 s | `sprt.js --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 26270` | **H0 at pair 96 (194 games), 0.418 [0.350, 0.488]**, LLR −2.96 (bound −2.94), 81–113 |
| G5, fix vs DODUO-greedy, 5 s | G's flags, `gen5-quiesce-5s.json` | **0.685 [0.618, 0.745]**, PASS (notlose); gen5-5s on the same pairs and seeds 0.695 [0.628, 0.755] |

Protect counters (`solver/arena/protect_stats.js`, read by `protect_read.js`; S counts only the 194 counted games):

| run | arm | share | fail | consec / protects | consec failed |
|---|---|---|---|---|---|
| G | fix | 16.3% | 7.9% | 10.6% | 58.2% |
| G | DODUO-greedy | 13.8% | 7.2% | 8.8% | 73.7% |
| P-after (2026-09-26, same pairs and seeds) | gen5 | 15.8% | 10.4% | 13.9% | 60.5% |
| P-after | DODUO-greedy | 16.8% | 10.1% | 16.0% | 55.6% |
| S | fix | 17.2% | 10.4% | 15.3% | 60.9% |
| S | gen5 | 16.3% | 11.7% | 15.5% | 64.3% |
| G5 | fix | 15.5% | 7.1% | 9.8% | 58.3% |
| G5 | DODUO-greedy | 14.3% | 8.4% | 11.8% | 65.4% |
| P5-after (same pairs and seeds) | gen5-5s | 16.7% | 13.4% | 15.3% | 71.6% |
| P5-after | DODUO-greedy | 16.0% | 10.9% | 16.4% | 56.3% |
| humans, live ladder | | 12.4% | 3.6% | 5.3% | 60% |

**The DODUO-greedy arm is the noise gauge.** The same bot on the same pairs and seeds moved from 16.8% to 13.8% share and
from 10.1% to 7.2% fail between P-after and G, only because the games went elsewhere. So G against P-after cannot
separate the fix's arms. S can: both arms play the same 97 pairs, and there the fix's Protect rates sit with gen5's.

**Bars** (pre-registered):
- fail ≤ 7.2% in G: 7.9%, **FAIL**. S: fix below gen5 (10.4% vs 11.7%), met, but inside the noise gauge above.
- consecutive share ≤ 7.0% in G: 10.6%, **FAIL**.
- share ≤ 15.5% in G: 16.3%, **FAIL**.
- strength: S accepted **H0**, and the upper bound 0.488 < 0.5 **shows a loss**.
- vs DODUO-greedy: G PASS (notlose), 0.615.
- G5 (5 s): fail 7.1% ≤ 7.2%, **PASS**. Consecutive share 9.8% > 7.0%, **FAIL**. Share 15.51% > 15.5%, **FAIL** by 0.01
  point. Score 0.685, PASS (notlose). Against the gauge, the fix's fail rate fell 6.3 points from P5-after and
  DODUO-greedy's fell 2.5. The fix's consecutive share fell 5.5 points and DODUO-greedy's fell 4.6.
- deploy rule: S showed a loss at 1 s, so **not deployed**. The 5 s arm is the live budget, and its strength is not measured.

## Why the table fix does not reach the game at 1 s

At 1 s the honest arena fills each of 16 cells about 1.4 times. The repeat mass is a property of the table's
EXPECTATION: in the 2026-09-26 probe it rose with passes, 0.123 at 2 passes and 0.199 at 48 over all 40 positions. At
1.4 passes, noise and the ranking prior decide the pick, and the fix can do little. What it does do is charge every
playout a second engine step, about 23% of the playouts. The extension turn's policy is crude ("carry on with the plan"),
and it changes every cell's value, not only the Protect rows. The 2026-09-25 measurement, depth 0 beating random depth 2
at 1 s, is the same lesson: a cheap second turn costs more than it tells.

## DODUO, measured

`solver/tests/probe_doduo_arena_protect.js`, DODUO-greedy against itself, 120 TEST-pair games each
(`probe-doduo-arena-*.txt`):

| model | slot-decisions with a family move offered | stall_repeat vs counter ≥ 1 | counter 0: mass / argmax | counter 1: mass / argmax (held) | counter 2: argmax |
|---|---|---|---|---|---|
| v1 (human clone) | 2,445 | 440 both, 14 feature only, 3 counter only | 0.216 / 0.217 | 0.129 / 0.121 (17 of 52 held) | 9 of 14 |
| gen5 | 2,543 | 498 both, 23 feature only, 5 counter only | 0.228 / 0.241 | 0.139 / 0.155 (22 of 75 held) | 13 of 18 |

On held-out human positions (2026-09-26, `probe_doduo_protect.js`), v1's argmax repeats on 6.0% and the humans on 5.3%.
The feature is present and nearly exact. What it lacks is the counter's magnitude: at counter 2 (a 1-in-9 chance), both
nets re-click on most of a handful of decisions (n = 14 and 18). That is a real gap. It is 0.6–0.7% of the decisions, and
the brief's retrain was conditional on the counter being absent, so DODUO was not retrained.

## Tests

- `solver/tests/test-miltank-quiesce.js`: GREEN 1195/1195. It is RED under `MILTANK_BREAK=quiesce` (EXTEND and EFFECT),
  `MILTANK_BREAK=flat` (FLAT) and `MILTANK_BREAK=megabundle` (MEGA). EFFECT on 5 fixture positions at 16 passes: 0.587 →
  0.200. POOL: the worker pool's matrix equals the serial fill bit for bit with the options on. AGENT: the spec flag
  reaches the search, and gen5 without it does not run quiescence.
- Unchanged suites on the changed code (before the merge): `test-miltank` 3414/3414 (5 breaks RED),
  `test-playout-speed` 1184/1184 (4 breaks RED), `test-miltank-deadline` 16/16 (RED under the break), `test-arena`
  15/15, `test-honest-info` 1954/1954, `test-machamp` 97/97, `test-rotom` 105/105.

## Pins, flags, counters

- Release `eaa5becc54eb`. Pool `data/team-pool-frozen-regmc` (TEST pairs; `games.bo3.jsonl` sha256 `a68263bb…`).
- G: 0 errors, 0 capped, 0 fallbacks, 0 warnings. `rollout_quiesced` 81,231 extensions, PORYGON2 leaf 57,968 evaluations.
  X mean decision 963 ms, p99 1,083, max 1,554.
- S: 200 games played, 194 counted (6 past the stop, not counted), 0 errored pairs, 1,205 s wall.
- G5: 0 errors, 0 capped, 0 fallbacks, 0 warnings. 423,911 extensions and 295,235 PORYGON2 evaluations. Playouts p50 per
  decision 120–141, and 0% of cells unfilled (P5-after, gen5-5s: 156–159). Decision time mean 4,728 ms and p99 4,897 ms.
  **4 of 1,663 decisions ran past budget + 500 ms: 9,053, 6,712, 6,617 and 5,770 ms.** P5-after's maximum was 5,273 ms.
  A playout checks the abort instant before the extension turn and again before the leaf, so the extension adds no
  uninterruptible work past the deadline beyond the one step that was already possible. The machine was running two other
  agents' SPRTs at the time. This is reported, not explained: if these flags are ever deployed, the clock owner should see it.
- **A shared machine.** Two other agents' SPRTs (PORYGON2 v1, and the adaptive clock) ran with 3 workers each through G and
  S. In S both arms share each worker and its load. At 1 s, load is fewer playouts for both arms, and the fix, which
  pays per playout, is hit harder.
- Harness note: the first G launch through a scratch below-normal wrapper `require()`d the script. `gate.js` runs only
  under `require.main === module`, so it did nothing and exited 0. The wrapper was rewritten to spawn the script. No game
  was lost; the relaunch is the G above.

## What is owed

- **The live budget is 5 s**, where the arena fills ~10 passes and the cost is a smaller share. G5 above is the first
  read there. A strength SPRT at 5 s (fix vs gen5-5s) is about 5× the 1 s wall time. The prepared command, for Will or
  the next session:
  `node solver/machamp/sprt.js --release eaa5becc54eb --x solver/results/2026-09-27-protect-repeat/gen5-quiesce-5s.json
  --y solver/results/2026-09-26-champ-vs-doduo/gen5-5s.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000
  --seed 26271 --workers 3 --cap 50 --info honest --team-store data/team-pool-frozen-regmc --out <solver/out/…>`
- **The leaf.** The horizon effect is the leaf not knowing that a shielded, threatened body is still threatened. The
  cheaper cure is in PORYGON2 (the PORYGON2 v1 work, not touched here): a counter-aware or threat-aware leaf fixes the
  table without a second step per playout.
- **DODUO's counter magnitude** (counter 2+) is a feature gap, small in volume. It belongs in the next DODUO retrain, not
  in its own.
