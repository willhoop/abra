# SLOWKING v1, MILTANK v1 search skeleton, offline arena

**Date:** 2026-09-24. **Status: PRE-GATE.** MEDICHAM's Reg M-C gate is not open. Every arena number below
is a shakedown of the harness. It is not a result about any bot, and must not be quoted as one.

## Verdict

- **SLOWKING v1 works.** RM+ and an exact LP solver agree on 200 random games. RM+ stays under the
  theorem's regret bound on 90 runs. Every clause was shown RED on a deliberate break.
- **MILTANK v1 runs end to end.** Over 400 games it made 2,657 searched decisions with 0 errors and 0
  capped games. Its parts have tests: the playout policy is a subset of `legalActions`, the world swap
  is exact, CRN holds, the prior reads the right body, and the search does not see the hidden back line.
- **At 1 s per decision, MILTANK does not beat the prior's argmax.** Score 0.530, Wilson 95% CI
  0.461–0.598, over 200 games. The search is starved: the median decision ran **23 playouts for 36
  cells**, and **28% of cells got no playout at all**. Against random it scores 0.940, the same as the
  prior's argmax (0.945). The search adds nothing that shows at this budget.
- **One real bug was found and fixed:** the engine reorders `sf.team` on a switch. Keying bodies by team
  index made the prior score the wrong body's moves. Bodies now carry `_solverSheet`, and the ALIGN
  clause pins this.

## What landed (branch `worktree-agent-a849abbf8c6348200`)

| File | What |
|---|---|
| `engine/medicham_api.js` + tests | Cherry-picked from `76691522` (clone / legalActions / step). Not modified. |
| `solver/slowking/matrix.js` | Zero-sum matrix solver. `solveRM` (RM+; alternating/linear by default, simultaneous/uniform for the proven bound), `solveLP` (dense simplex with Bland's rule; the row strategy is read from the dual), `exploitability` (gap = max_i (Ay)_i − min_j (xᵀA)_j, recomputed from x and y), `sample`, `rmBound`. |
| `solver/miltank/prior_adapter.js` | MEDICHAM state → the dataset schema, so prior v0 can score it. Built per viewer: the opponent's unrevealed back line is not in `brought_seen`. Maps prior candidates back to `legalActions` options. |
| `solver/miltank/rollout.js` | Playout policy (the engine's own menu functions, without the ~2 ms restore that `legalActions` pays). Heuristic leaf. Uniform-belief world sampling. Seeded playout. |
| `solver/miltank/search.js` | MILTANK v1: rank joints by the prior with reserved switch and mega slots, fill cells with CRN playouts round-robin until the budget runs out, solve with SLOWKING (`solver:'lp'` is available), and SAMPLE from the row mix. |
| `solver/arena/{arena,bots,teams,env}.js` | The arena. Bots: `random`, `prior` (greedy), `miltank`. Real sheets, paired seating, Wilson CI, per-decision time, counters, provenance. |
| `solver/tests/test-{slowking,miltank,arena}.js` | Each one re-runs itself under its deliberate breaks and exits 3 if a clause stays green. |

## Tests (all GREEN; every break shown RED)

| Test | Checks | Breaks, each required to turn its clause red |
|---|---|---|
| `test-slowking.js` | 1,559/1,559 | colsign → RM, CONV · noavg → CONV · lpdual → LP, KNOWN |
| `test-miltank.js` | 3,414/3,414 (73 positions, 10 real team pairs) | support → SUPPORT · swapstamp → SWAP · crn → CRN · peek → NOLEAK · teamindex → ALIGN |
| `test-arena.js` | 15/15 | seat → SEAT |

`solver/tests/test-prior.js` is still GREEN (1,062/1,062), but only when `SHOWDOWN_PATH` is set. Run from
a worktree, `solver/human/dex.js` looks only one directory up and cannot find the checkout. This is a
pre-existing issue and is not fixed here. `solver/arena/env.js` sets the variable for the new code.

**SLOWKING measured.** On 200 random games up to 12×16: the worst LP gap was 1.6e-15, and the LP value
matched the brute-force certificate to 1e-9. RM+ reached gap ≤ 1e-3 on every game, and its value matched
the LP's to within 1e-3. **Convergence:** simultaneous RM+ with the uniform average obeyed
gap(T) ≤ Δ(√m+√n)/√T at T = 100, 1,000 and 10,000 on all 30 games. The smallest margin was 2.5e-2. The
gap fell on every game. This is the bound from Hart & Mas-Colell / Tammelin et al., checked on real
runs; it is not assumed.

## Arena shakedown (PRE-GATE)

Pins: HEAD `43053310` plus the uncommitted solver files of this branch, which are now committed. Engine
sha `d50aadc6…`, api `6bfb5ff8…`, `engine-data-regmc.js` `a6ad04e9…`, prior `2e87c31a…`. Dataset
manifest generated 2026-09-23T08:03Z: 26,888 rows scanned, 18,810 eligible (both bring_complete). Games
are a seeded stride of 125. These runs used the **live tree, not a frozen release**. That is acceptable
only because nothing here is a result.

Flags (they are part of the sample): `--games 200 --budget 1000 --k1 6 --k2 6 --depth 1 --cap 60`,
reserve_switch 2. Seeds were 1 (MILTANK vs prior), 2 (MILTANK vs random) and 3 (prior vs random). Seating
was paired: 100 team pairs, each played twice with the bots swapped. The two MILTANK matches ran at the
same time, alongside other load.

| Match | Score (x) | Wilson 95% | Team pairs x won both / split / lost both | x decision ms mean / p95 / max |
|---|---|---|---|---|
| MILTANK vs prior-greedy | **0.530** (106–94) | 0.461–0.598 | 28 / 50 / 22 | 1,021 / 1,062 / 1,874 |
| MILTANK vs random | 0.940 (188–12) | 0.898–0.965 | 88 / 12 / 0 | 1,023 / 1,067 / 1,472 |
| prior-greedy vs random (baseline) | 0.945 (189–11) | 0.904–0.969 | 89 / 11 / 0 | 5.9 / 10 / 34 |

MILTANK's search, per decision, over the 2,657 searched decisions of both matches:
- **Cells:** 36.
- **Playouts:** median 23, mean ≈55, p95 ≈170.
- **Passes:** median 1.
- **Unfilled cells:** 28–29%.
- **SLOWKING gap:** mean 5e-5, max 1.03e-4.
- **Mix support:** about 2.6 actions.
- **Counters:** reserved switch slots 7,458. Reserved mega 794. Worlds 5,429. Bodies swapped 3,346.
  One decision was over budget (1,874 ms). No zero counters.

Games are short (5.8–7.3 turns on average), and no game hit the cap. The random opponent wipes quickly.

**Reading.** The solver is not the constraint: SLOWKING's gap is about 1e-4 on every decision. The
constraint is cell fill. Under this load a playout cost about 20–40 ms, against about 5.5 ms measured
alone in a warm process. At that cost, 1 s buys less than one pass over a 6×6 matrix. Unfilled cells are
filled with the matrix mean and counted, so the mix is often chosen on one noisy sample per cell. The
heuristic leaf after one random turn is also crude. No strength claim follows from these numbers in
either direction.

## Owed / next

- **Cheaper cells come before strength.** Options: successive halving over my rows (research report
  §3.2); a larger budget; worker processes; skipping `API.clone` on the world when W already is a clone.
  Then re-run this same arena at equal wall-clock.
- **World sampling is the stand-in for XATU.** It draws uniformly from the unrevealed sheet rows. Spreads
  are the engine table's flat line for every body on both sides, so this arena has no spread uncertainty
  at all.
- **Mid-turn choices** (faint replacement, pivot target) use the engine's default for every bot. The API
  does not yet expose them.
- **Some candidates cannot be scored by the prior.** Options aimed at an empty slot, and some mega
  options the prior's `megaAvailable` rejects, get no prior mass. They are counted (`optionsUnmatched`)
  and reached only through the reserved mega slot.
- **`solver/human/dex.js` checkout lookup fails from worktrees.** This is pre-existing, and it makes
  `test-prior.js` exit with an error unless `SHOWDOWN_PATH` is set.
- **Per-game artifacts** are in `solver/out/arena/*.json`. That folder is gitignored, so these files are
  not tracked.
