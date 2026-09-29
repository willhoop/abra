# PORYGON2 v1-r1 — v1 retrained on the enlarged self-play corpus; gate (c) re-run (2026-09-29)

**Verdict. More data did not make a stronger player. Gate (c) SPRT: H0 after 868 games, 427–441 = 0.492
[0.459, 0.525], LLR −3.06 (bounds ±2.94), Elo ≈ −6. Gate (a) FAILS too. The human half is −0.0032
[−0.0078, +0.0018], and the interval crosses 0. Not landed. `solver/machamp/league/gen5.json` is unchanged and gen5's
PORYGON2 stays the champion's value net.**

- **Retrain.** The same v1 recipe (`attn`, v1's flags exactly, seed 1). The only change is the data: 76,051 more
  self-play positions from `p2v1-c1` (10,000 games). Training rows went from 204,433 to 265,423.
- **Gate (a): FAIL (human half).** Self-play −0.0166 [−0.0214, −0.0112] (13,759 positions, 1,804 games) passes. Human
  −0.0032 [−0.0078, +0.0018] (37,829 views, 5,220 games) does not.
- **Against v1 on v1's own test rows** (`compare.js`, paired, by game), r1 is **worse on humans**: +0.0045
  [+0.0005, +0.0090]. It is better on self-play: −0.0079 [−0.0136, −0.0022]. The extra self-play pulled the net toward
  self-play positions and away from human ones.
- **Gate (c): H0**, as above. v1's run on identical parameters and seed was INCONCLUSIVE at the 2,000-game budget:
  0.516 [0.494, 0.538].
- **Nothing is red.** `test-porygon2-v1` passed 25/25 on r1, and each of the 5 deliberate breaks turned it RED.
  The arena ran 0 errors and 0 capped games. The fallbacks are counted in §4.

Pre-registered in `solver/porygon2/v1/preregistration-r1.json`, commit `efcff771`. The commit came before the c1 build,
before any r1 fit and before any r1 game.

## 1. Pins

| pin | value |
|---|---|
| engine release | `eaa5becc54eb`. `engine_release.js verify` said intact. The snapshot was copied from main's `data/releases/` (untracked, gitignored). |
| team store | main's `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`. `games.bo3.jsonl` sha256 `a68263bb568d461a…`, `games.ots.jsonl` `4dcc2aa61562…`, `pool-receipt.json` `456927f0a4f8…`. The SPRT read main's path. `test-porygon2-v1` reads a hard-coded worktree path, so byte-identical copies were placed there; the sha256s match. |
| corpus `p2v1-c0` | 3,603 games, seed 1001. Manifest sha256 `7b9569f5…`. Shards `e230d5ca…`, `bf7e6da6…`, `f494f13d…`. |
| corpus `p2v1-c1` | 10,000 games, seed 2001, same league file (sha256 `424a70a2…`). 0 errors, 1 capped. The 2-pass cap held: 31.94 playouts per decision. Manifest sha256 `de336bb2…`. Shards `9f867ba0…`, `82c2ad29…`, `f9235d8e…`. Copied from main's `solver/out/`, and all three shard sha256s were re-verified. **13,603 games in total, as the 1.24.2 notes row states.** |
| reused builds | human `s0` and the ten earlier self-play builds, read by absolute path from worktree `agent-a0e24792bde666457`'s `solver/out/p2v1/`. They were not rebuilt. |
| labels | Unchanged: v1's 5,466 labels. c1 was not deep-labelled, so its rows use `y = 0.75 z + 0.25 v_root`. |

## 2. The c1 build

`build.js --shard i --shards 3` gave 3 builds, 3,334 + 3,333 + 3,333 games and **76,051 positions**. There were 0 replay
mismatches, 0 missing joints and 0 errors, and 76,036 positions carry a play-time root. Wall time was 11.5 min. Receipts
are in `solver/results/2026-09-29-porygon2-v1-r1/build-c1-s*.summary.json`.

## 3. Training and gate (a)

`train.py --arch attn --epochs 12 --threads 3 --seed 1` with v1's flags otherwise, argv in `train-argv.json`.
137 blocks, 265,423 training rows, and 20 min wall time. **Validation selected epoch 4** (v1 selected 7). Combined
validation loss was 0.47592.

| test set | r1 log-loss | gen5 | r1 − gen5 (95% CI, by game) | Brier diff | ECE r1 / gen5 |
|---|---|---|---|---|---|
| human (37,829 views, 5,220 games) | 0.5113 | 0.5145 | **−0.0032 [−0.0078, +0.0018]** | −0.0015 [−0.0032, +0.0003] | 0.0142 / 0.0065 |
| self-play (13,759, 1,804 games) | 0.4109 | 0.4275 | **−0.0166 [−0.0214, −0.0112]** | −0.0059 [−0.0078, −0.0039] | 0.0142 / 0.0208 |

The self-play test set now includes c1's 10% test split, so it is **not** the set v1 was read on. The pre-registered
paired comparison on v1's own rows (`solver/porygon2/v1/compare.js`, the Node forward pass, 2,000 bootstraps by game)
follows:

| rows | v1 | r1 | r1 − v1 |
|---|---|---|---|
| human test (37,829 views) | 0.506853 | 0.511328 | **+0.0045 [+0.0005, +0.0090]** (Brier +0.0021 [+0.0006, +0.0037]) |
| v1's self-play test (6,221, 798 games) | 0.406809 | 0.398885 | **−0.0079 [−0.0136, −0.0022]** (Brier −0.0033 [−0.0054, −0.0011]) |

compare.js was checked before it was trusted. It reproduces train.py's v1 figures exactly: 0.506853 human and 0.406809
self-play, on 37,829 and 6,221 views. Scored against itself, it returns a difference of 0 with a [0, 0] interval.

By turn, r1 − gen5 on humans: turns 1–2 straddle 0, turns 3 and 4–5 are below 0, and turns 6–8 and 9+ straddle 0.
Self-play is below 0 in every bucket.

## 4. Gate (c): the arena

`solver/machamp/sprt.js --release eaa5becc54eb --x solver/porygon2/v1/gen5-p2v1r1.json --y solver/machamp/league/gen5.json
--elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 9101 --workers 3 --team-store <main>/data/team-pool-frozen-regmc
--info honest`. Both arms use gen5's MAG and DODUO with MILTANK k 4×4, 1 reserved switch row, depth 0 and 1,000 ms per
decision. The run started 08:12Z and ended 09:39Z. The result was read once, after the stop.

| | |
|---|---|
| verdict | **H0: X is not stronger** |
| stop | pair 433 (434 pairs, **868 games**). 12 games were played past the stop and are not counted. 0 pairs were excluded for errors. |
| score | 427–441 = **0.492 [0.459, 0.525]** (Wilson, at a data-dependent stop, so slightly optimistic). Elo ≈ −5.6. |
| LLR | −3.06 against a lower bound of −2.94 |

**Counters**, both arms, all 880 games played, read from the workers' cumulative `ctr` on their last records:
- **Decisions.** 16,014 in total: 15,994 searched and 20 forced, all through the honest view with the XATU back line.
  0 back-line errors.
- **Playouts and cells.** 4,430,653 playouts, **277 per searched decision**; v1's run averaged 125. 1.03% of cells were
  left unfilled.
- **Fallbacks.** **74 fallback decisions (0.46%)**: 35 too sparse, and **39 with zero playouts**. 0 search throws.
  0 errors and 0 capped games.
- **Equal wall-clock held.** Decision ms p50 / p99 / max: 944 / 1,516 / 2,245 for r1, 943 / 1,520 / 2,269 for gen5.

The 39 zero-playout decisions are few but not zero. v1's run had 35 of them. Both arms took them through the same code
path, so they cannot favour one side.

## 5. Reading

v1 on 3,603 new games gave +11 Elo, inconclusive. r1 on 13,603 gave −6, and H0 was accepted. The better self-play
predictor did not play better. Two causes fit the data, and neither was measured:

1. The cheap corpus is omniscient 2-pass self-play of one champion against itself and a clone. Adding more of it moves
   the net toward that distribution. The human half of gate (a) got worse against v1, and the arena is honest play
   between two searches.
2. A depth-0 search reads the leaf one turn ahead and averages about 277 playouts per decision. A value-net
   improvement of about 0.01 nats is too small to change clicks. v1's own report said the same.

v1 itself is still not a proven stronger player: its run was INCONCLUSIVE. Doubling its SPRT budget is the only open
question left on this line, and it is listed below. Deep-labelling c1 is the other. Neither is recommended over work on
the search.

## 6. What landed on main

The v1 branch merged, carrying the code, v1's model and v1's report (`docs/_reports/2026-09-27-porygon2-v1.md`). This
run adds `preregistration-r1.json`, `gen5-p2v1r1.json`, `compare.js`, the r1 model and metrics
(`solver/porygon2/model/porygon2-v1r1*.json`) and `solver/results/2026-09-29-porygon2-v1-r1/`. **There is no model
switch.** Nothing in the league, in ROTOM or in `gen5.json` names v1 or r1. `solver/porygon2/leaf.js` routes a v1 file
to v1 only when a spec names one. `solver/mew/agent.js` keeps both main's `searchExtras` and the branch's `maxPasses`
(merge conflict resolved).

## OWED, NOT RUN

```
# 1. v1 (not r1) gate (c) to a decision: the same SPRT, a fresh seed, a larger budget (pre-register first)
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/porygon2/v1/gen5-p2v1.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 4000 --seed 9103 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --info honest --out solver/out/p2v1r/sprt/v1-vs-gen5-4000.json

# 2. Deep-label c1, then refit (the pre-registered target for a labelled position; about 3 h on 3 workers)
node solver/porygon2/v1/label.js --release eaa5becc54eb --selfplay solver/out/selfplay/eaa5becc54eb/p2v1-c1 --out solver/out/p2v1r/labels-c1 --workers 3 --per-game 1 --k 6 --passes 8 --chance 3 --exact-depth 2 --seed 1 --deadline <ISO>
```
Every heavy run goes through `cmd.exe /c tools\lownode.cmd` (from Bash: a node `spawnSync('cmd.exe', ['/c','tools\\lownode.cmd', …])`
argv, as this run did).
