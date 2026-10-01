# Two SPRTs: piKL λ 0.03 vs gen5 at 14 s, and PORYGON2 v2 as gen5's leaf (2026-09-30, abra/regmc 1.50.0)

SOLVER. Approved by Will on 2026-09-30 ("1 2"). Branch `worktree-agent-a53483ec982dfb1a1`, run on main `5eca2c42`
(1.48.0). main was merged only after both runs had stopped. The runs went back to back as the only game-playing job, 3
workers at BelowNormal through `tools\lownode.cmd`.

## Verdict

- **SPRT 1, piKL λ 0.03 vs plain gen5 at the 14 s adaptive clock: H0.** It stopped at 416 games (208 pairs), 195–221.
  The score is **0.469 [0.421, 0.517]**, and the LLR −2.980 crossed the lower bound of −2.944. The clock ratio is
  **0.976**. Capability held: 3,893 KL decisions, missMe 0, 0 errors and 0 fallbacks. The Protect fail rate is
  **9.8% vs 15.8%**, so the Protect gain from the screen reproduced while the strength did not.
- **SPRT 2, gen5 with PORYGON2 v2 as its leaf vs gen5 on its own net, at equal clock (1 s): H0.** It stopped at 612
  games (306 pairs), 294–318. The score is **0.480 [0.441, 0.520]**, and the LLR −3.062 crossed −2.944. The clock
  ratio is **1.009**. The leaf counter proves v2 ran: **485,334 v2 evaluations**, equal to its call count, with 0
  errors. gen5's net served 1,253,403. At equal clock v2 gets 0.39× the leaf calls.
- **This SPRT ran outside v2's original pre-registration, by Will's decision.** Gate (a) had failed:
  v2 − v1 = −0.0098 [−0.0202, +0.0002].
- Neither result is on any arm, and neither changes one.
- **Spread mode.** Both ran on the arena as it stood before 1.49.0 (honest: XATU-random spreads in the true battle).
  They are comparable with the phase B screens and NOT with any arena figure after 1.49.0's `role-v1` change.

## Protocol (pre-registered, committed and pushed before the first game)

| | SPRT 1 | SPRT 2 |
|---|---|---|
| pre-registration | `solver/results/2026-09-30-sprt-pikl-v2/preregistration-sprt1-pikl.json` (commit `7dafdf51`) | `preregistration-sprt2-p2v2.json` (commit `2b3e120d`) |
| X | `screen-14s-kl03.json` (gen5 + `kl` 0.03, adaptive 14 000 / 4 667) | `solver/porygon2/v2/gen5-p2v2.json` (gen5, `pory2` = `porygon2-v2-k1.json`, sha256 `d5409446cb6f…`, rating query [1600, 1600]) |
| Y | `screen-14s-off.json` (the 14 s screen's Y) | `solver/machamp/league/gen5.json` (net `porygon2-gen5.json`, `cf8ad3f7bd0d…`) |
| clock | adaptive, target 14 s (the ladder's) | budgetMs 1000 for both arms (gen5 as is; the clock in v2's own gate (c) command). This is **not** the ladder clock. |
| seed | 30001 (new) | 30002 (new) |

- **Common to both:**
  - release `eaa5becc54eb`. The gate also passes on `97451d5fbf40`; `eaa5becc54eb` was kept for comparability with the screens.
  - store `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`, TEST pairs, pair-seed 1, `--info honest`.
  - SPRT settings: elo0 0, elo1 20, α = β = 0.05, max 2,000 games, `--cap 50`, `--workers 3` (the sprt.js maximum).
- **Reading:**
  - Each run was read once, after `sprt.js` stopped, with `sprt_read.js` and `protect_read.js`.
  - SPRT 1's KL counters and SPRT 2's leaf counters come from each worker's last shard line.
  - Reads are in `solver/results/2026-09-30-sprt-pikl-v2/sprt{1,2}-*.json`. Shards are under `solver/out/sprt-pikl-v2/`.

## Results

| | SPRT 1 (piKL 0.03, 14 s) | SPRT 2 (v2 leaf, 1 s) |
|---|---|---|
| verdict | **H0** | **H0** |
| games / pairs used | 416 / 208 | 612 / 306 |
| W–L | 195–221 | 294–318 |
| score [Wilson 95%, conditional on the stop] | 0.469 [0.421, 0.517] | 0.480 [0.441, 0.520] |
| pairs both / split / lost | 32 / 131 / 45 | 54 / 186 / 66 |
| LLR at stop / bounds | −2.980 / ±2.944 | −3.062 / ±2.944 |
| Elo point estimate | −21.7 | −13.6 |
| errored pairs | 0 | 0 |
| played past the stop, not counted | 12 games | 14 games |
| decision ms mean X / Y | 8,764 / 8,977 | 952 / 944 |
| **clock ratio** (≤ 1.10) | **0.976** | **1.009** |
| X decision p99 / max | 27,720 / 29,102 ms | 996 / 1,267 ms |
| ladder clock breaches (per-turn 55 s, bank 420 s) | 0 / 0 | 0 / 0 |
| agent fallbacks / MILTANK prior fallbacks | 0 / 0 of 7,789 searched | 0 / 6 of 11,759 searched (arm not separable) |
| wall | 23,104 s | 3,763 s |

**SPRT 1, the KL solve in play** (`ctr.kl`, over every game the workers played):
- 3,893 decisions, missMe 0, missOpp 0.
- The pick changed on 37.6% of decisions. Mean TV to the plain mix 0.340; mean worst-case cost 0.0122.
- Mean Protect mass 0.249 against 0.275 for the plain mix.
- These match the 14 s screen: 37.0%, 0.338, 0.0129.

**SPRT 2, the leaf counter** (new, `ctr.leaf_by_model` and `ctr.leaf_own`):
- `porygon2-v2-k1.json`: 485,334 calls; its own evals 485,334, errors 0.
- `porygon2-gen5.json`: 1,253,403 calls.
- At the same 1 s budget the v2 arm evaluates **0.39×** as many leaves as gen5.

**Protect** (`protect_read`, counted pairs):

| | share X / Y | fail rate X / Y | consecutive share X / Y | double share X / Y |
|---|---|---|---|---|
| SPRT 1 | 15.5% / 18.7% | **9.8% / 15.8%** | 11.6% / 20.6% | 4.8% / 5.8% |
| SPRT 2 | 18.5% / 18.8% | 15.7% / 14.9% | 20.0% / 19.0% | 5.0% / 5.7% |

## Reading

- **piKL λ 0.03 is not stronger than gen5 at the ladder clock.** H0 was accepted at 416 games, and the point estimate is
  on the losing side. It still reproduces its Protect effect: the fail rate drops from 15.8% to 9.8%, and repeat Protect
  roughly halves. That effect is a behavioural one and does not show up as strength. Combined with the screens, the
  honest summary is "plays more human-like Protects at no measurable gain, and possibly a small cost". Whether to put it
  on a ladder arm is Will's call. This SPRT gives no strength reason to.
- **PORYGON2 v2 as gen5's leaf is not stronger than gen5's own net at equal clock.** v2 had a better offline log-loss
  than gen5's net (−0.0127), but in play it is slower per evaluation. Within the same 1 s, the search reached only
  0.39× as many leaves (playout plus leaf cost, not the leaf alone), and the better value did not pay for the lost
  playouts at 1 s. This test does not show whether v2 would win at
  14 s, where the playout count matters less. Nothing here re-opens gate (a).
- **Both H0s are "not stronger by 20 Elo at α = β = 0.05"**, not a proven loss. Both intervals still include 0.5.

## What was built

- `solver/miltank/rollout.js`:
  - `COUNTERS.leafByModel` counts PORYGON2 leaf calls by model file name.
  - `leafOwn()` returns each loaded leaf's own counters.
  - `leafPory2` sums every arm in a worker, so on its own it could not prove which net served.
- `solver/mew/play.js` writes both counters on every shard line as `ctr.leaf_by_model` and `ctr.leaf_own`.
  - This was merged with 1.49.0's `spreads` counter on the same line.
- `solver/porygon2/v2/gen5-p2v2.json` is the X arm. It is a league spec, not a ladder arm.
- `solver/tests/test-porygon2-v2-arena.js`:
  - Plays one seat-swapped pair with the two arms and asserts that v2 calls equal v2's own evals, are above 0, have 0
    errors, and that gen5's net served calls too.
  - Result: **GREEN 8/8**, and **RED under `MILTANK_BREAK=leaf`** (5 FAILs).
  - Re-run GREEN after merging main.
- The existing parity test `solver/tests/test-porygon2-v2.js --leaf` is GREEN 32/32 (Node vs Python 8.9e-16) and RED
  under `PORY2V2_INFER_BREAK=rating`.

## OWED, NOT RUN

- **Any ladder arm with `"kl": 0.03` or with v2 as leaf.** It is Will's call, and neither SPRT supports one on strength.
- **v2 at the 14 s ladder clock**, if Will wants the remaining question answered. It needs a new pre-registration.
  It would take about 6 to 30 h.
- **A cheaper v2 forward pass**, for example by caching the per-member token facts within a decision. Equal-clock
  strength is what limits it here.
- **Re-run under `role-v1` spreads (1.49.0).** Neither figure is comparable with arena figures after that change.
- `node engine/status.js --write` from the main checkout after merge. It was not run here because this is a worktree.
