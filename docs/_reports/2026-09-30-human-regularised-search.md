# Human-regularised search (piKL) — phase A (2026-09-30, abra/regmc 1.34.0)

**Verdict.** The root solve can now pay a KL cost for straying from the human prior: SLOWKING solves
`x·A·y − λ·KL(x‖τ_me) + λ·KL(y‖τ_opp)` with τ = gen5's own DODUO on the candidate rows and columns. It is behind the spec
flag `kl` (λ, the one knob), off by default and on no arm. Offline, on 579 held-out human decisions with the same recorded
tables, it raises agreement with the human click at every λ up to 0.1. Top-1 goes from 0.216 to 0.268 at λ = 0.1, a gain of
+0.052 [0.021, 0.083]. That beats DODUO's own argmax over every legal joint (0.230). The cost is the worst case on the
search's own table: 0.004 / 0.012 / 0.035 win-probability points at λ 0.01 / 0.03 / 0.1. On the offered repeat-Protect
positions the repeat mass falls from 0.611 to 0.243 at λ 0.03. It levels off at DODUO's own mass (0.23) and goes no lower.
**On chomp1 game 1 turn 4 it does not fix the click at any λ up to 0.03.** The double Protect keeps 0.85 → 0.71 of the mix.
The argmax changes only at λ 0.1, where the mix costs 0.10 on that table. The table itself says the double Protect is the
maximin row. The problem there is the table, not the solve. Phase B (2 s screens at λ 0.01, 0.03 and 0.1) is
pre-registered and not run.

## 1. Where the prior enters, and why there

The search already computes the prior. MILTANK's step 1 (`solver/miltank/search.js` `prepareDecision`) scores every legal
joint of both sides with the ranking prior `PA.scoreJoints`. In a league agent this is the generation's DODUO over MAG
(`solver/mew/agent.js`), DODUO v2-gated when the spec gates. It keeps the top k1 / k2 as rows and columns. Only the ranks
were used, and the scores were thrown away. Two places could take them:

| option | what it does | why not / why |
|---|---|---|
| a prior-weighted mix at the root, `(1−w)·x* + w·τ` | blends the plain equilibrium with the prior | It moves mass onto a row whatever that row is worth. A row 0.3 worse gets the same `w·τ` as a row tied with the best. It cannot tell a near-tie (the case we want) from a real gap. It is also a second rule on top of the solve, which is what Will asked to remove. |
| **the KL-regularised equilibrium** (piKL: Jacob et al., ICML 2022) | each player maximises utility − λ·KL(own mix ‖ its anchor) | **Chosen.** The regularised best response is `x ∝ τ·exp((A·y)/λ)`. A row's mass leaves the prior's ratio only in proportion to its value gap over λ. A near-tie (gap ≪ λ) plays like the humans. A real gap (≫ λ) plays like the equilibrium. A flat table plays τ exactly, at any λ > 0. So this also subsumes 1.23.0's `flatEps` rule. The game stays zero-sum and strictly concave-convex, so the answer is unique and has a checkable gap. |

**Both sides are regularised, with the same λ.** This is piKL's form, and the column prior is the model of what a human
opponent does from my view. It is a mild exploit, not a safety device. Its cost is measured, not assumed. Every decision
reports `worst` = the plain table's value v* minus the worst column's payoff against the played mix. This is the most a
best-responding opponent could take on the search's own table. It is the number HYPNO's ε will cap later.

**λ is in win-probability points per nat.** Tables are win probabilities in [0, 1]. No λ is typed into any arm. It is chosen
by the measurements in §3 to §5 and screened in phase B.

**The anchor, exactly** (`search.js` `anchorOf`):
- τ = the prior's raw scores on the kept rows (columns), renormalised, then mixed with `TAU_MIX` = 1e-3 of uniform, so no
  candidate is unreachable. A reserved switch row the prior scores at the adapter's 1e-15 floor can still be played. It
  needs an edge of about λ·ln(m/TAU_MIX), for example 0.083 at λ 0.01 with 4 rows.
- **Missing or degenerate prior:** if a side's candidates carry less than `PRIOR_MIN` = 1e-9 of total prior mass (every
  joint unmatched), that side is anchored to uniform with the same λ. This is entropy regularisation. It is counted
  (`klPriorMissingMe` / `klPriorMissingOpp`, and `missMe` / `missOpp` per decision). The solver supports λ = 0 on one side,
  but that side converges at Hedge speed (below), so the search never asks for it.
- TAU_MIX and PRIOR_MIN are declared guards, not tuned knobs.
- `kl` absent or 0: the plain solve, bit for bit (test clause OFF).

## 2. The solver (`solver/slowking/matrix.js` `solveKL`)

Optimistic follow-the-regularised-leader: piKL-Hedge's FTRL form, with the optimistic step of Syrgkanis et al. 2015. At round
t each player plays `softmax(log τ + (U + u_last) / (λ·t + ETA0/√t))`. U is the cumulative utility and u_last is the last
round's utility. The answer is the t-weighted average. ETA0 = 0.03 only steadies the first rounds and decays. It is an
algorithm constant, not a knob: the equilibrium is unique, so ETA0 changes only the number of rounds to reach it.
- **The gap is a certificate.** `gap` = max_x f(x, y) − min_y f(x, y) uses the closed-form regularised best responses. It is
  computed from the returned pair after the solve, as `solveRM` does. `gapNash` is the plain gap on A.
- **Convergence, measured** (40 random 4–8 × 4–8 tables per λ, anchors skewed, both sides regularised, tol 1e-5): mean rounds
  to the tolerance 496 / 358 / 226 / 131 / 64 at λ 0.001 / 0.003 / 0.01 / 0.03 / 0.1, worst gap ≤ 9.99e-6. One side at λ = 0:
  about 2e-4 after 4,000 rounds. So a missing prior anchors to uniform instead.
- The first version used a constant stabiliser ETA0. It biased the mix toward τ by about 1/(λt): on a row-constant table the
  TV to the closed form was 3.4e-5 to 8.3e-5 after 4,000 rounds (the first red CLOSED clause). The decaying `ETA0/√t` shrinks
  this. The averaged iterate still carries the early rounds (5e-6 at λ 0.03), so CLOSED's bar is TV 1e-4.

In the search (`finishDecision`), with `kl` on, the plain solve runs first on the same table. It is a few ms and exists only for
the counters. Then the KL solve runs, and it has the rest of the budget. **One coin, drawn once**, samples both, so "the pick
changed" is a paired comparison and the coin stream of every later decision is unchanged.

**Counters** (MILTANK `COUNTERS`; per decision in `info.kl`; per agent in `mew/agent.js` `COUNTERS.kl[name]`; per arena row in
`ctr.kl`). They are `klDecisions`, `klPickChanged`, `klSum` (KL(x‖τ_me)) and `klTv` (TV to the plain mix). The Protect mass
counters are `protMass` / `protMass0`: the row mass on joints with a protect-family click (`solver/arena/protect_stats.js`
family), regularised / plain. `dblMass` / `dblMass0` are the same for both slots. The rest are `klWorstLoss`, `klGapMax` and the
two missing-prior counts.

**Wiring:** `kl` is a league-spec search extra (`mew/agent.js` `SEARCH_EXTRAS`), so it reaches the arena (`gate.js`,
`play.js`) and ROTOM's `miltank-gen5` (`policy.js` `gen5Opts`) with no other change. ROTOM's table tap also wraps `solveKL`.
`policy.js` passes `d.record` for the replay probes. **Proven on the live path:** the replay (§4) played ROTOM's policy with a
spec carrying `"kl": 0.03` on 3 coins. It got the same table as the plain run, and its mix equals the offline solve at 0.03 to 3
decimals on every coin.

## 3. Held-out human decisions (`solver/miltank/eval_kl_human.js`)

The decisions and positions are those of `solver/doduo/eval_gates.js`: the TEST split, fully observed joints, `world.js` from
the public state, and the dataset's action walk for the Protect counter. The file is streamed once. A decision is kept when
sha256(seed:id:turn:side) mod 35 = 0 (seed 1): **580 picked of 20,501 eligible**, 579 evaluated, 1 unmatched, 0 errors, 0
forced, 0 fallbacks, 0 unfilled cells. The search is gen5's (k 4×4, 1 reserved switch row, depth 0, PORYGON2 gen5 leaf, the
plain back-line redraw) at **16 passes, no clock**: 256 playouts per decision. It runs once per decision and the root is
recorded. **Every λ is solved on the same tables.** λ = 0 is exactly the solve the search runs (`solveRM`, 4,000 iterations,
tol 1e-4). Release `eaa5becc54eb`, dataset sha256 `9d07c522…`, gen5 digests mag `65e76caf…` / doduo `abb0b88d…` / pory2
`cf8ad3f7…`. Artifact: `solver/results/2026-09-30-human-regularised/human-agreement.json`. The per-decision roots are in
`solver/out/pikl/human-s1/`.

- **Coverage:** the human joint is among the 4 candidate rows on **308 of 579 (53.2%)**. That is the ceiling on the search's
  top-1.
- **No-search reference:** DODUO's argmax over every legal joint agrees on **0.230**. Its mean log-probability of the human
  joint is −2.74.

| λ | top-1 | Δ top-1 vs λ 0 [95%] | p(human) | log-lik (floor 1e-4) | Δ log-lik [95%] | Protect mass | double | TV to plain | worst-case cost (mean / max) |
|---|---|---|---|---|---|---|---|---|---|
| 0 (gen5 as it plays) | 0.216 | | 0.215 | −6.459 | | 0.308 | 0.062 | 0 | 0 |
| 0.001 | 0.223 | +0.007 [−0.007, 0.021] | 0.217 | −6.309 | +0.150 [0.058, 0.255] | 0.306 | 0.063 | 0.064 | 0.0005 |
| 0.003 | 0.226 | +0.010 [−0.007, 0.028] | 0.220 | −6.114 | +0.346 [0.231, 0.472] | 0.305 | 0.064 | 0.093 | 0.0012 |
| 0.01 | 0.240 | +0.024 [0.005, 0.043] | 0.226 | −5.736 | +0.724 [0.565, 0.893] | 0.302 | 0.064 | 0.167 | 0.0042 |
| 0.03 | 0.252 | +0.036 [0.010, 0.060] | **0.233** | −5.289 | +1.170 [0.973, 1.387] | 0.295 | 0.063 | 0.273 | 0.0122 |
| 0.1 | **0.268** | +0.052 [0.021, 0.083] | 0.225 | −4.966 | +1.494 [1.245, 1.741] | 0.280 | 0.057 | 0.432 | 0.0352 |
| 0.3 | 0.257 | +0.041 [0.005, 0.076] | 0.209 | −4.923 | +1.537 [1.271, 1.799] | 0.272 | 0.053 | 0.535 | 0.0622 |
| ∞ (the anchor alone) | 0.230 | +0.014 [−0.026, 0.054] | 0.191 | −4.951 | +1.508 [1.234, 1.781] | 0.270 | 0.052 | 0.601 | 0.0878 |

The CIs are a paired bootstrap over decisions (2,000 resamples, seeded). The humans in the sample click a protect-family move
in 26.9% of joints and a double Protect in 4.8%.

Reading:
- **The combination beats both of its parts.** At λ 0.03–0.1 the search plus the prior agrees with the human more often than
  the plain search (0.216) and more often than the prior alone (0.230 over all legal, 0.230 on the rows). A mid λ picks the
  human's click from the rows where the table cannot separate them, and keeps the table where it can.
- **Top-1 peaks at λ 0.1 and p(human) at λ 0.03.** p(human) is the chance a sampled move agrees, and the search samples.
  Log-likelihood keeps improving up to 0.3. On it the anchor alone is as good, because the plain solve's pure strategies score
  the floor.
- **The Protect mass moves toward the human rate.** Protect-type goes 0.308 → 0.280 at 0.1 (humans 0.269). Double goes 0.062 →
  0.057 (humans 0.048). The move is small, because on most decisions the plain search is not over-protecting.
- **The worst-case cost rises with λ:** 0.004 at 0.01, 0.012 at 0.03, 0.035 at 0.1, 0.088 for the anchor alone. This is a
  bound on the search's own depth-0 table. It is not a measured loss in games. Phase B measures that.
- **Caveat on the positions:** the opponent's back line and spreads come from `world.js` as `eval_gates.js` builds them. The
  search redraws every unrevealed body, but it is the non-honest arena path (plain redraw, not XATU). The Protect counter is
  the dataset walk, not the exact log. Every λ sees the same tables, so these affect the level and not the comparison.

## 4. chomp1 game 1 turn 4, replayed (`solver/tests/probe_kl_replay.js`)

The position is rebuilt exactly as `probe_dp_replay.js` rebuilds it (branch `worktree-agent-a2a32a231fd34cc17`, 1.31.0). The
search is ROTOM's `miltank-gen5` at 96 passes with no clock, on coins 4000–4002. The three coins give nearly the same table
(plain value 0.822 on each, as live; the mixes below differ by at most 0.003 across coins). Rows (request choices): `move 3 mega, switch 4` / `move 3 mega, move 4` /
`move 3 mega, move 3 2` / `move 4 mega, move 4`. Columns: `psychic 1, aquajet 2` / `trickroom, protect` / `psychic 1,
protect` / `psychic 1, hypervoice`. Anchor (gen5 DODUO on the rows): [0.121, 0.377, 0.297, **0.205**]. The prior puts 0.21 on
the double Protect itself and 0.79 on joints with a Protect. Artifact:
`solver/results/2026-09-30-human-regularised/replay-chomp1-g1-t4.json`.

| λ | mix (coin 4000) | double Protect | argmax | worst-case cost on this table |
|---|---|---|---|---|
| 0 | [0, 0.148, 0, 0.851] | 0.851 | double Protect (mega) | 0.001 |
| 0.001 | [0, 0.148, 0, 0.852] | 0.852 | double Protect | 0.000 |
| 0.003 | [0, 0.145, 0, 0.855] | 0.855 | double Protect | 0.000 |
| 0.01 | [0.001, 0.153, 0, 0.847] | 0.847 | double Protect | 0.000 |
| 0.03 | [0.056, 0.231, 0.004, 0.709] | 0.709 | double Protect | 0.025 |
| 0.1 | [0.135, 0.389, 0.091, 0.386] | 0.386 | `move 3 mega, move 4` (Substitute + mega, Hippowdon Protect) | 0.102 |
| 0.3 | [0.131, 0.396, 0.226, 0.247] | 0.247 | `move 3 mega, move 4` | 0.163 |
| ∞ | [0.121, 0.377, 0.297, 0.205] | 0.205 | `move 3 mega, move 4` | 0.189 |

**The regularisation does not remove this click at any λ the human data favours.** The reason is in the table. The
double-Protect row is 0.847 / 0.814 / 0.847 / 0.847 across the columns, the maximin row by a wide margin. The other rows fall to
0.68, 0.68 and 0.41 against `psychic 1, hypervoice`. And against the Trick Room column the double Protect scores 0.814, only 0.05
below the best row. **So the depth-0 leaf barely charges for letting Trick Room go up.** That is a horizon fault in the cells,
the same shape as the repeat-Protect finding in 1.23.0. A solve-side prior can only trade against a table that is wrong. To
flip it here costs 0.10 of the table's own worst case. The human prior itself is not against Protect here (0.79 of its mass is
on Protect-containing joints). It is against the *double*.

## 5. The offered repeat-Protect positions (`solver/tests/probe_kl_repeat.js`)

These are `probe_protect_passes.js`'s positions and walk: seed 7, 40 positions, TEST pairs walked by the human clone. The search
is gen5's `base` variant at 48 passes on coin 99 + n. The root is recorded once and each λ is solved on it. **13 of 40 offer a
repeat row. At λ 0 the repeat mass is 0.611, exactly 1.23.0's reading**, so the probe reproduces. Artifact:
`solver/results/2026-09-30-human-regularised/repeat-protect.json`.

| λ | mean mix mass on repeat rows (offered, 13) | argmax a repeat |
|---|---|---|
| 0 | 0.611 | 8/13 |
| 0.001 | 0.501 | 7/13 |
| 0.003 | 0.448 | 7/13 |
| 0.01 | 0.336 | 6/13 |
| 0.03 | 0.243 | 3/13 |
| 0.1 | 0.227 | 3/13 |
| 0.3 | 0.225 | 4/13 |
| ∞ (anchor) | 0.230 | 4/13 |

The repeat mass falls to the anchor's own level by λ 0.03 and stays there. **The floor is DODUO's over-ranking of the repeat:**
gen5 DODUO puts 0.23 of its row mass on repeats in these positions. Humans re-click about 3%. So the regularised search is only
as good as its prior. Here that is gen5's DODUO, trained on self-play, which 1.20.0 already found over-ranks the repeat. The
human-fitted DODUO v1 as the anchor is a separate question, not run (see OWED).

## 6. Tests

`solver/tests/test-miltank-kl.js`: **52/52 GREEN**, release `eaa5becc54eb`, 4 fixture positions, 6 passes.
- The SOLVER clauses need no engine: FLAT, CLOSED, LIMITS, GAP and INPUT.
- The SEARCH clauses run on gen5 k 4×4: OFF, FIRES, ANCHOR, COUNT, MISSING and AGENT. See the file header.
- **RED on both deliberate breaks, required and seen.** `MILTANK_BREAK=klignored` (λ read as 0 in the solve) fails FIRES,
  ANCHOR and MISSING, 43/52. `SLOWKING_BREAK=klsign` (the anchor with the wrong sign) fails FLAT, CLOSED, LIMITS, GAP and
  ANCHOR, 41/52.
- CLOSED was red on the first run: the constant stabiliser's bias, §2. The algorithm was fixed, then the bar was set at 1e-4
  from the measured residual. The CLOSED bar was not simply loosened to make the first version pass.

Regressions: `test-slowking.js` 1,559/1,559 GREEN, with all 5 required breaks red. A first run under a 115 s `timeout` killed
the `noavg` child mid-run and printed a false "STAYED GREEN (blind)". A standalone run of that child fails CONV as required.
With `--no-red` (their breaks do not touch the new code): `test-miltank` 3,414/3,414, `test-playout-speed` 1,184/1,184,
`test-rotom` 105/105, `test-arena` 15/15, `test-machamp` 86/86, all GREEN.

## 7. Pins, flags, what was not touched

The pins are release `eaa5becc54eb` and `--info` n/a, because no arena game was played. The replay uses ROTOM's honest world
path. The team store is `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc` (absolute, because a worktree has no
`games.bo3.jsonl`). The human dataset is the main checkout's `solver/out/human/games.jsonl`, read only and streamed. The live
chomp1 log was read only. Nothing touched the main checkout or the live ladder run. The heavy runs used a below-normal preload
(`os.setPriority` BELOW_NORMAL), because the worktree harness refuses `cmd /c tools\lownode.cmd`. There were at most 4
processes.

**Not done, and owed:** `node engine/status.js --write` must run from the main checkout, and it is not run from a worktree.
The live ladder run is in the main checkout, so the ledgers are not restamped. Also owed: `node
solver/tests/test-rotom-world-stall.js` and any other test with a relative store path, from the main checkout after merge.

## 8. Code

- `solver/slowking/matrix.js`: `solveKL`, `gapKL`, `klDiv`, `ETA0`, and the break `klsign`.
- `solver/miltank/search.js`: `o.kl`, `anchorOf`, `TAU_MIX`, `PRIOR_MIN`, the counters, `rec.tauRow`/`tauCol`/`x0`, and the
  break `klignored`.
- `solver/mew/agent.js`: `kl` in `SEARCH_EXTRAS`, and `COUNTERS.kl[name]`.
- `solver/mew/play.js`: `ctr.kl` on every row.
- `solver/rotom/policy.js`: the tap wraps `solveKL`, and `d.record`.
- `solver/miltank/eval_kl_human.js`, `solver/tests/probe_kl_replay.js`, `solver/tests/probe_kl_repeat.js` and
  `solver/tests/test-miltank-kl.js` are new.
- The phase-B specs and the pre-registration are in `solver/results/2026-09-30-human-regularised/`.

## OWED, NOT RUN

Phase B is pre-registered in `solver/results/2026-09-30-human-regularised/preregistration.json`, written before any game. It
has three 2 s screens, each gen5+KL (X) against gen5 (Y), on ROTOM's adaptive clock at target 2 s (credit0 667 ms). They use the
same 100 TEST pairs, pair seed 1, and 200 games each. **Bars, read once at 200 games:** gate.js `notlose` (Wilson 95% upper
bound of X ≥ 0.5) **and** the clock ratio `decision_ms.x.mean / decision_ms.y.mean` ≤ 1.10. X's `ctr.kl[<name>].decisions`
must be > 0 with `missMe` = 0, or the run is VOID. Also read, and not a bar: the Protect share and fail rate from
`protect_read.js`, stated in advance to be at or below Y's.

Run from the main checkout in PowerShell, after this branch is merged and when the game slot is free, one at a time:

```
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/gate.js --release eaa5becc54eb --x solver/results/2026-09-30-human-regularised/screen-2s-kl01.json --y solver/results/2026-09-30-human-regularised/screen-2s-off.json --pairs 100 --pair-seed 1 --seed 29501 --workers 4 --cap 50 --rule notlose --info honest --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/pikl/screen-2s-kl01.json
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/gate.js --release eaa5becc54eb --x solver/results/2026-09-30-human-regularised/screen-2s-kl03.json --y solver/results/2026-09-30-human-regularised/screen-2s-off.json --pairs 100 --pair-seed 1 --seed 29502 --workers 4 --cap 50 --rule notlose --info honest --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/pikl/screen-2s-kl03.json
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/gate.js --release eaa5becc54eb --x solver/results/2026-09-30-human-regularised/screen-2s-kl1.json --y solver/results/2026-09-30-human-regularised/screen-2s-off.json --pairs 100 --pair-seed 1 --seed 29503 --workers 4 --cap 50 --rule notlose --info honest --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/pikl/screen-2s-kl1.json
```

Read each once, at the end:

```
node solver/arena/protect_read.js solver/out/pikl/screen-2s-kl01.json
node -e "const r=require('./solver/out/pikl/screen-2s-kl01.json');console.log(JSON.stringify({result:r.result,pass:r.pass,ratio:r.decision_ms.x.mean/r.decision_ms.y.mean,warnings:r.warnings}))"
```

Use the same pair for `kl03` and `kl1`. The capability counter is the last row's `ctr.kl` in each
`solver/out/pikl/screen-2s-<tag>.shards/shard-*.jsonl`.

**Only if at least one 2 s screen passes:** pick the passing λ with the highest X score (a tie goes to the smaller λ). Write
`solver/results/2026-09-30-human-regularised/screen-14s-kl<tag>.json` as `screen-14s-off.json` plus `"kl": <λ>` and name
`gen5-kl<tag>-adaptive-14s`. Then run:

```
$env:ABRA_REGULATION='regmc'; cmd /c tools\lownode.cmd solver/machamp/gate.js --release eaa5becc54eb --x solver/results/2026-09-30-human-regularised/screen-14s-kl<tag>.json --y solver/results/2026-09-30-human-regularised/screen-14s-off.json --pairs 100 --pair-seed 1 --seed 29504 --workers 4 --cap 50 --rule notlose --info honest --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/pikl/screen-14s.json
```

That takes about 2.3 h (the 14 s lookahead screen took 8,174 s), with the same bars. **No SPRT without Will's OK.**

Also owed, not pre-registered:
- The same offline sweep with the **human-fitted** DODUO v1 (`solver/mag/model/doduo-v1.json`) as the anchor in place of
  gen5's self-play DODUO. §5 shows that the anchor's own repeat-Protect over-rank is the floor.
- The turn-4 horizon fault (§4) belongs to the leaf/cells line (1.23.0 quiescence), not to this flag.
- `node engine/status.js --write` from the main checkout, and `test-rotom-world-stall.js` from the main checkout after the merge.
