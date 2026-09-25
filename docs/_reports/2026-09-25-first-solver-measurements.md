# First post-gate solver measurements (Reg M-C, release eaa5becc54eb)

2026-09-25. Artifacts: `solver/results/2026-09-25-first/*.json`. Runner: `solver/arena/arena.js` with `--release`.

## Verdict

- **Nothing I tested beats DODUO-greedy.** MILTANK with the heuristic leaf at the default depth scores
  **0.470 [0.402, 0.539] at 1 s** and **0.510 [0.441, 0.578] at 5 s** against it. Both CIs contain 0.5.
- **Every search-side contrast is null at n = 200.**
  - Depth 0 against depth 2 at 1 s: 0.540 [0.471, 0.608].
  - The PORYGON2 leaf against the heuristic leaf at depth 2: 0.560 [0.491, 0.627] at 1 s and 0.505 [0.436, 0.574] at 5 s.
- **The greedy round robin has an order.** DODUO beats the prior (0.580 [0.511, 0.646]) and MAG beats the prior
  (0.595 [0.526, 0.661]). DODUO against MAG is 0.555 [0.486, 0.622], which is not separated.
- **Ladder bot: DODUO-greedy** (MAG v1 + DODUO v1, joint argmax, no search). The reason is in §4.

## 1. Protocol (the same for every match)

| item | value |
|---|---|
| engine | frozen release `eaa5becc54eb` (cut 2026-09-24T20:12:54Z; this is the release the Reg M-C gate reads OPEN on). Every artifact carries `REL.stamp()`: `engine_release`, `source_digests` and `showdown_commit` `f10d6798`. The pool workers load the same release through `SOLVER_RELEASE`, and `solver/tests/test-arena-release.js` enforces it. |
| sheets | real Reg M-C open sheets with the humans' own brought four and leads, from `solver/out/human/games.jsonl` (manifest generated 2026-09-23T08:03Z). Whole-file digest `sample.pool_sha256` = **`9d07c522200de072`**; the team-pair id list `sample.ids_sha256` = **`ba106d1ad5487ac2`**. **The same 100 team pairs are used in every match.** |
| pairing | `--seed 1 --games 200`: 100 team pairs, each played twice on the same battle seed with the bots swapped between the sheets |
| common flags | `--k1 8 --k2 8 --cap 60`; MILTANK runs `--depth 2` (the default) unless a per-arm `--depth-x/--depth-y` is given, with `--workers 4` |
| priority | every match runs through `cmd.exe /c tools\lownode.cmd` (BELOWNORMAL) |
| CI | Wilson 95% on score = (W + D/2)/N, as computed by the arena. There were no draws, no capped games and no errors in any match. |
| code | arena/solver code is identical at HEAD `e4cc21dc` (the greedy matches and a1) and `a085dd9f` (the rest). `git diff e4cc21dc a085dd9f -- solver engine/medicham_api.js` is empty, and the engine comes from the release either way. |

The exact argv is in each artifact at `provenance.argv`, and the flags are at `flags`.

## 2. Results

| id | X vs Y | budget | X score | Wilson 95% | pairs both/split/lost | median playouts/decision (X; Y) | artifact |
|---|---|---|---|---|---|---|---|
| (a) | MILTANK heur d2 vs DODUO-greedy | 1 s | **0.470** (94–106) | 0.402–0.539 | 21/52/27 | 408 | `a1-miltank-vs-doduo-1s.json` |
| (a) | MILTANK heur d2 vs DODUO-greedy | 5 s | **0.510** (102–98) | 0.441–0.578 | 23/56/21 | 495 | `a5-miltank-vs-doduo-5s.json` |
| (b) | MILTANK heur **d0** vs heur d2 | 1 s | **0.540** (108–92) | 0.471–0.608 | 24/60/16 | 275; 118 | `b-heur-d0-vs-d2-1s.json` |
| (c) | MILTANK **PORYGON2** d2 vs heur d2 | 1 s | **0.560** (112–88) | 0.491–0.627 | 27/58/15 | 114; 129 | `c1-pory2-vs-heur-d2-1s.json` |
| (c) | MILTANK **PORYGON2** d2 vs heur d2 | 5 s | **0.505** (101–99) | 0.436–0.574 | 20/61/19 | 596; 671 | `c5-pory2-vs-heur-d2-5s.json` |
| (d) | DODUO-greedy vs MAG-greedy | — | **0.555** (111–89) | 0.486–0.622 | 24/63/13 | — | `d-doduo-vs-mag.json` |
| (d) | DODUO-greedy vs prior-v0-greedy | — | **0.580** (116–84) | 0.511–0.646 | 29/58/13 | — | `d-doduo-vs-prior.json` |
| (d) | MAG-greedy vs prior-v0-greedy | — | **0.595** (119–81) | 0.526–0.661 | 29/61/10 | — | `d-mag-vs-prior.json` |

No artifact has warnings: every capability counter fired, including the PORYGON2 leaf in (c) and the greedy adapters in (d).

Decision time, as mean / p95 / max in ms:

| match | X | Y |
|---|---|---|
| a1 | 1010 / 1017 / 1035 | DODUO 11 / 18 / 27 |
| a5 | 5088 / 5183 / **28,075** | DODUO 71 / 155 / 5158 |
| b | 1020 / 1045 / 1618 | 1037 / 1076 / 1405 |
| c1 | 1042 / 1090 / **6186** | 1036 / 1079 / 1450 |
| c5 | 5082 / 5162 / **39,422** | 5066 / 5140 / **28,306** |
| greedy | 5–6 ms mean, 48 ms max | |

## 3. What the numbers do and do not say

- **(a) Search buys nothing measurable over DODUO-greedy yet.** From 1 s to 5 s the point estimate moves
  0.470 → 0.510, and the intervals overlap almost entirely. The paired view agrees: team pairs MILTANK took
  both games of rose from 21 to 23, and pairs it lost both of fell from 27 to 21. The 5 s median fills only
  **495 playouts against 408 at 1 s** (the means are 1292 against 641). So five times the clock bought
  roughly 1.2–2× the compute. The cause is load on the machine: CPU was measured at 100% with 19 node
  processes during the second lane, and DODUO's own greedy decisions took 71 ms in a5 against 11 ms in a1
  and 5 ms alone. **The budget in these matches is wall-clock, so "5 s" is a statement about this machine
  under this load, not about MILTANK at 5 s of CPU.**
- **(b) The random extra turns do not help, and may hurt.** Depth 0 against depth 2 scores 0.540. That does
  not reach significance at n = 200, but the direction agrees with the PORYGON2 report's confounded
  0.605 (PORYGON2 d0 vs heuristic d2). Depth 0 also fills about 2.3× the playouts at the same clock (275 vs 118 median).
- **(c) The PORYGON2 leaf does not separate from the heuristic leaf at depth 2**, at either budget. At 1 s
  it runs at roughly the same playout count (114 vs 129), so the leaf's cost is not the explanation. Its
  unfilled-cell share was higher (6.9% vs 3.4% at 1 s) and near zero at 5 s. A +5-point effect needs
  about 1,500 games per arm (the PORYGON2 report's estimate), and none of these matches can see one.
- **(d) Greedy round robin.** The ordering is DODUO ≈ MAG > prior v0. MAG alone beats the prior by at
  least as much as DODUO does, so on these 100 pairs the joint coordinator's gain over factorised MAG is
  not separated (0.555, CI 0.486–0.622).
- **Clock tails.** MILTANK at a 5 s budget produced single decisions of 28 s and 39 s, and one of 6.2 s at
  1 s. MILTANK does not bound its own worst case against a wall clock while the machine is saturated.
  ROTOM's clock (`solver/rotom/clock.js`) caps the budget, but the overshoot comes after the budget expires.

## 4. The ladder choice

**DODUO-greedy.** The rule was: *the configuration that best beats DODUO-greedy at a budget that fits the clock
(≤ 20 s per decision average).* No configuration tested beats it. The best point estimate is MILTANK heuristic
d2 at 5 s (0.510), and its CI is centred on a tie. MILTANK costs 100–1000× the decision time, and it shows 28–39 s
tails under load. So the configuration that is at least as strong as every alternative, with no clock risk,
is DODUO-greedy itself (ROTOM's `prior` policy). This choice is **provisional, by default of evidence.** It is
not a demonstrated superiority of DODUO over search.

## 5. Owed

- The two directions (b) and (c) point toward should be measured against DODUO-greedy, since that is the bar:
  MILTANK at depth 0, with the heuristic and the PORYGON2 leaves, at 5 s. Use 2 × 400+ games, or an SPRT,
  on an otherwise idle machine, or with a CPU-time budget, so that "5 s" means the same compute across matches.
- A playout-count budget option in the arena, so that budget contrasts are not at the mercy of machine load.
- A hard wall-clock ceiling on a MILTANK decision. The 28–39 s tails would forfeit turns on the ladder clock.
- The first 5 s attempts (a5, c5) were killed at games 160 and 100 by a session restart. They wrote no
  artifact, and both were re-run from scratch. Their partial logs are not results and are not quoted.
