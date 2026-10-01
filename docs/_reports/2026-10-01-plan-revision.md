# The solver plan revised to Will's 2026-10-01 decisions (abra/regmc 1.53.0; `solver/PLAN.md` 0.3.0)

2026-10-01. SOLVER. Documents only: no code, no games, no spend. Prices were read from the providers' public pages and
their data endpoints, with no account.

## Verdict

- `solver/PLAN.md` is revised to Will's four decisions:
  - one self-play policy+value net, searched several turns deep;
  - compute local first, built to scale out;
  - best-respond to the population;
  - the ladder is the scoreboard, with standing approval for up to 20 series a day.
- Nothing dated before 2026-10-01 is rewritten. Superseded rows and sections are marked in place and kept.
- **MEDICHAM stays the simulator** for self-play, the search, the facts the net reads, and DUSK. It always runs from
  a frozen release.
- **The net (PORYGON2 v3) subsumes these roles:** MAG (scoring), DODUO, GARY, and XATU's action likelihood.
- **These stay:** MEDICHAM, ROTOM, SLOWKING's solve, DUSK, CHOMP, DITTO (and GURU, JOLTEON, KADABRA unchanged).
- **These change:** MILTANK becomes a several-turn public-belief search harness. MEW and MACHAMP become the Expert
  Iteration actors and learner. HYPNO becomes a population best response. WOBBUFFET is demoted to a diagnostic.
  ALAKAZAM is re-assembled around the net.
- Nothing is retired before the net wins its SPRT.
- **Milestones N0–N9** replace M0–M8, which are kept as history. N3 is the MEDICHAM speed pass. Its owner is ENGINE.
  It is deferred, and it sits before any cloud spend.
- **Compute [EST]:**
  - One generation is about 45 CPU worker-hours and about 0.25 GPU-hours. On this machine that is about 15 h of
    self-play and 8.4 h of CPU training at v2's size.
  - The likely first net (30 generations) costs $69 on AWS c7a, $75 on Hetzner CCX63 or $13 on one Vast.ai listing,
    plus $2.55–$9.68 of GPU, at prices fetched 2026-10-01.
  - **The CPU side is the bill.** A 2× or 4× engine multiplies it by 0.60 or 0.40.
- **The ADR-003 dated update** says that on Reg M-C the headline is the ladder rating and exploitability is a
  diagnostic. "Greedy" (exploitative) play against the population is the default.
- **Two things were not done:**
  - The memory file `one-off-bo3-best-respond-to-population.md` named in the brief **does not exist**: there are 0
    matches in the memory directory. Its content was taken from `solver-direction-2026-10-01.md` §3, which links to
    it.
  - `CLAUDE.md` was not edited. Its "The pipeline is the point" paragraph still names the capped dial, and it is listed
    as owed.

## 1. What changed in `solver/PLAN.md`

| Section | Change |
|---|---|
| Header | 0.2.0 → 0.3.0, with a dated note naming this revision |
| §1.0 (new) | The direction from 2026-10-01: why it changed, the architecture, the simulator, the compute, the exploitation and the scoreboard. The 0.2.0 summary becomes §1.1, labelled superseded where §1.0 differs |
| §2.0 (new) | Subsumed, stays and changes, per model, with this week's evidence |
| §2.1 rows | A dated lead note on MEDICHAM, MAG, DODUO, PORYGON2, MILTANK, XATU, GARY, MEW, MACHAMP, WOBBUFFET and ALAKAZAM. PORYGON2's status gets the r1, r2 and v2 results. A new row for **PORYGON2 v3, the net**. A new **HYPNO dated update** row sits under the old HYPNO row, which is marked superseded as the default and kept |
| §3.0 (new) | N0–N9, dependency-ordered, each with a dependency, an exit test and the measured reason. It also gives the ladder's resolution at 20 series a day |
| §3.1 | The M0–M8 table, retitled SUPERSEDED, with a one-line account of where each milestone ended |
| §4 | A dated update: the standing approval, the auto-stops, and what each batch reports |
| §5 | A dated update: the ladder is the scoreboard, the arena is a sanity check, exploitability is demoted, and the arena series restarted at 1.49.0 |
| §6a (new) | The compute estimate and the cost table (§4 below) |
| §8 | A dated note: the subsumed solver models archive at the net's SPRT pass |
| §9 | Will's 2026-10-01 answers (Q5 and Q6 superseded) and new questions Q11–Q13 |
| App. C | The target per-turn pipeline after N7 |
| App. A | Sources added |

### The milestones (`solver/PLAN.md` §3.0)

| N | What | Exit test |
|---|---|---|
| N0 | The ladder scoreboard runs: the current pipeline plays capped batches | ≥ 100 rated series on one arm; the record with and without forfeits, the residual ± SE and the settled rating ± SD; 0 self-quits, 0 timeouts. This is the ladder baseline |
| N1 | The population model by rating band (GARY v1), store-only | Per band and bucket, it beats τ\* and DODUO v1 on held-out log-loss, CI clear. A bucket that fails gets p = 0 |
| N2 | HYPNO v1: a population best response with in-series updates and the equilibrium fallback | Offline sanity against a human clone, then a ladder A/B against equilibrium on the residual |
| N3 | The MEDICHAM speed pass (ENGINE; deferred; before any cloud spend) | Board-identical on the differential, the three lattices and the lean test; a measured speed-up; a gate re-run on the new release |
| N4 | The PORYGON2 v3 evaluation set and design (in progress on another branch) | The frozen set, its leakage test GREEN, the deep labels with their noise ceiling, and gen5, v1 and v2 scored |
| N5 | The v3 bootstrap: the joint policy+value net | On the v3 set, regret and the [0.5, 0.9) overconfidence below gen5's; the human head beats DODUO v1; gate (a) passes; the cost is within budget |
| N6 | A several-turn public-belief search, with DUSK, on MEDICHAM | Depth-2 regret below depth-0; clock-safe; DUSK exact; an SPRT against the champion (sanity) |
| N7 | The Expert Iteration loop, local and small | G1 twice, each generation passing the human gate; then **the net's SPRT against the pipeline**, which retires the subsumed roles |
| N8 | Scale-out (only after N3 and N7, and with Will's OK on spend) | A cloud generation reproduces a local one, board-identical on Linux; the cost is measured against §6a |
| N9 | The net on the ladder | A per-series A/B against the N0 pipeline, then the settled rating over the last N ≥ 100 series ± SD |

## 2. The measured findings each change rests on

| Finding | Source | Where it lands |
|---|---|---|
| CHOMP v1 H1 against the human-modal bring: 524 games, 0.561 [0.518, 0.603]. Against the humans' own bring 0.470 [0.422, 0.519], report-only | 1.25.0; `2026-09-27-chomp-v1.md` | CHOMP stays; §1.0 |
| CHOMP v2 failed gate (a) against v1: −0.0004 [−0.0032, +0.0024] | 1.45.0 | A net-scored CHOMP must beat v1 first |
| v1-r1 failed gate (a) on humans (−0.0032 [−0.0078, +0.0018]) and was H0 at gate (c) (0.492) | 1.26.0 | N4, N5, N7's human anchor |
| v1-r2 failed gate (a) on humans (−0.0044 [−0.0086, +0.0002]) | 1.46.0 | same |
| v2 failed gate (a) (−0.0098 [−0.0202, +0.0002]) | 1.47.0 | same |
| piKL λ 0.03 against gen5 at 14 s: H0, 416 games, 0.469 [0.421, 0.517] | 1.50.0 | N1: model humans to predict them, not to play like them |
| v2 as gen5's leaf at 1 s: H0, 612 games, 0.480 [0.441, 0.520], with 0.39× the leaves | 1.50.0 | N5: cost is part of the test |
| Ladder post-mortem: 26 chomp1 losses; 13 of them (VISIBLE_KO, SPEED_CONTROL, SETUP) addressable by value plus depth; root value +0.19 [0.06, 0.32] too high in [0.5, 0.9) | 1.39.0 | N4, N6 |
| ROTOM world fixes: Perish and the volatiles, ability changes, hazards in `sf.hz`, field clocks, fast species' Speed | 1.40.0–1.44.0 | N0: no ladder series has been played on them yet |
| The arena now plays real per-set spreads, and the arena series restarted | 1.49.0 | §5: arena figures before and after are not comparable |
| Arena wins did not transfer: gen5 beat DODUO-greedy 0.710 [0.615, 0.790] offline, but went 3–11 on the ladder (gen5ab arm A) without forfeits; chomp1 went 5–10 | 1.16.0, 1.17.0, 1.39.0 | §1.0, §5, ADR-003 update |
| MACHAMP accepted gen5 (1,268 games, 0.528 [0.501, 0.556]); gen1–4 were rejected | 1.8.0 | the N7 generation estimate |
| About 80% of a playout is `battleTurn`; memoisation +8–17%; lean mode 1.18–1.35× | `2026-09-24-playout-speed.md`, `-engine-turn-speed.md`, `-lean-mode.md` | N3; the speed-up scaling in §6a |

## 3. HYPNO and GARY under a population best response

- **Default.** For each bucket the population model at the opponent's band passes, HYPNO plays the best response to
  that model: x maximises xᵀAh.
- **Fallback.** For each bucket it fails, HYPNO plays σ\*. Each bucket is gated twice:
  - **gate 1:** h beats τ\* and DODUO v1 on held-out log-loss, with a game-clustered CI;
  - **gate 2:** the predicted gain exceeds the payoff matrix's own standard error.
- **Games 2 and 3.** A Bayesian posterior over "follows the population" and "plays ≈ τ\*", built from the earlier games'
  actions, with decay.
- **Literature roles** (all from `2026-09-23-solver-research-humans-and-ladder.md` §1.1):
  - DBR is the per-bucket trust.
  - Ganzfried & Sun 2016 is the in-series update.
  - McCracken–Bowling ε-safe and Ganzfried–Sandholm safe exploitation stay available as an A/B option, not the
    default.
  - Milec et al.'s depth-limited caution still applies.
- **GARY.** It is built first as a standalone model (N1), then becomes the net's human head. Its per-bucket gate
  survives and decides where HYPNO trusts the population.

## 4. Compute and cost (`solver/PLAN.md` §6a)

**Measured local rates:**
- 1 s per decision on 3 workers: 736–738 games/h, 14.7 worker-seconds a game.
- ~0.1 s per decision: 7,833 games/h, 1.38 worker-seconds a game.
- v2 training: ~5.3 ms per position-step on one thread. This is (2,574 s + 1,970 s) over ~0.86 M position-steps.

**A generation [EST]:**
- Games: 10,000 self-play games plus ~1,000 gate games at 1 s a decision, which is 44.8 worker-hours.
- Training set: ~1.15 M positions × 5 epochs = 5.75 M steps. That is 8.4 h on one local thread at v2's size, ~85 h
  for a 10× net, and ~0.25 h on one GPU.
- The **GPU class** is a single RTX 4090 / L4 / A10, because v2 is 0.11 M parameters and a few-million-parameter v3
  uses a fraction of a 24 GB card.

**Generations to a first useful net [EST]:** 10 / 30 / 100 (low / likely / high). The basis is MACHAMP's 1-in-5
acceptance and the three refits that did not improve the human half.

**Hours per generation:**

| Where | CPU self-play + gate | Training |
|---|---:|---:|
| This machine (3 workers; 1 training thread) | ~15 h | ~8.4 h (v2 size) to ~85 h (10×) |
| AWS c7a.16xlarge (64 cores) | ~0.7 h | — |
| Hetzner CCX63 (48 vCPU at 0.6 of a core [EST]) | ~1.6 h | — |
| Vast.ai 7995WX host (96 cores + RTX 3090) | ~0.5 h | ~0.25 h |
| One cloud GPU (RTX 4090 class) | — | ~0.25 h |
| N3 speed pass, 2× / 4× (Amdahl on 80%) | × 0.60 / × 0.40 | unchanged |

**Cost.** USD, on-demand, before tax, as fetched 2026-10-01 04:44–04:51 UTC. The receipt is
`solver/results/2026-10-01-plan-revision/prices.json`.

| Option | $/h | per generation | first net, low / likely / high | likely, with a 2× / 4× engine |
|---|---:|---:|---:|---:|
| This machine | 0 | $0 (~15 h) | $0 (~6 / ~19 / ~62 days) | ~11 / ~7 days |
| AWS c7a.16xlarge, us-east-1 ([on-demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/)) | 3.28448 | $2.30 | $23 / $69 / $230 | $41 / $28 |
| Hetzner CCX63 + IPv4 ([hetzner.com/cloud](https://www.hetzner.com/cloud/general-purpose)) | 1.6138 + 0.0010 | $2.51 ($1.51 if a vCPU = a core) | $25 / $75 / $251 | $45 / $30 |
| Vast.ai 7995WX + RTX 3090, one listing ([vast.ai/pricing](https://vast.ai/pricing)) | 0.9363 | $0.44 | $4 / $13 / $44 | $8 / $5 |
| Vast.ai, median ≥ 64-thread host | 0.0125 per thread | $1.12 | $11 / $34 / $112 | $20 / $13 |
| GPU: RunPod RTX 4090, community / secure ([runpod.io/pricing](https://www.runpod.io/pricing)) | 0.34 / 0.74 | $0.09 / $0.19 | $0.85 / $2.55 / $8.50 (secure $1.85 / $5.55 / $18.50) | unchanged |
| GPU: Vast.ai RTX 4090, median of 57 (min 0.33) | 0.47 | $0.12 | $1.17 / $3.52 / $11.75 | unchanged |
| GPU: Lambda A10 ([lambda.ai/service/gpu-cloud](https://lambda.ai/service/gpu-cloud)) | 1.29 | $0.32 | $3.23 / $9.68 / $32.25 | unchanged |

**How the prices were read:**
- **RunPod:** the schema.org offers embedded in the pricing page.
- **Vast.ai:** the public offer search at `console.vast.ai/api/v0/bundles/`, filtered to verified, on-demand,
  rentable offers. This is the search behind the pricing page, which renders its prices client-side.
- **Lambda:** the 1× table on the page.
- **Hetzner:** `live_data_prices.json`, the page's own price data. Product keys CLOUD_120 (CCX63) and CLOUD_21 (IPv4)
  were read from the page.
- **AWS:** the meteredUnitMaps JSON behind the on-demand pricing page.
- **Two assumptions are flagged in the receipt:**
  - c7a's one-vCPU-per-core is from memory, not re-read.
  - The Hetzner vCPU efficiency is an estimate.

**Setup a rented box needs:**
- Node 24, the repo at the run's commit, and the frozen release (9.2 MB).
- `data/team-pool-frozen-regmc` (239 MB on disk) and `pokemon-showdown-mc` (255 MB on disk) through `SHOWDOWN_PATH`.
- The net files, and CUDA PyTorch on the learner.
- Output is ~35 MB of gzipped shards per 10,000 games.
- **Linux has never run MEDICHAM.** N8's exit test is a board-identical seeded sample. `tools/lownode.cmd` has no
  Linux twin, and a Windows-path flag must be made portable.
- **Not priced:** storage, egress, idle time, spot or reserved discounts, and engineering hours.

## 5. Alignment with PORYGON2 v3 (another branch)

- **What is on disk.** Only `solver/porygon2/v3/positions.js`, `deep.js` and `evalset.js`, in worktree
  `agent-aadbc255e960b0c50`.
- **What they build.** A frozen held-out evaluation set:
  - sources: ladder games, bo1 games with both players ≥ 1500, and bo3 games with both players ≥ 1300;
  - labels: a reference that plays every root cell to the end with gen5's prior;
  - scores: ranking (τ-b, top-1, regret), calibration (including the [0.5, 0.9) gap) and cost.
- **What has not landed.** `DESIGN.md` and `docs/_reports/2026-10-01-porygon2-v3.md`.
- **How the plan uses it.** It cites that work as N4, and its N5 and N6 exit tests are stated on that set. **It
  defines no v3 architecture of its own** beyond the heads the decision requires: value, self-play policy and human
  policy by band. If v3's design differs, the design governs and this row is updated.

## OWED, NOT RUN

- **No code, no games, no spend.** Every N milestone is unbuilt, except N0's pipeline and N4's work on another branch.
  No ladder series was prepared in this pass.
- **Not checked from a clean tree:** `node engine/status.js --write`. It must be run from the main checkout after
  merge, never from a worktree.
- **Owed to the next major:**
  - white paper §2.8 (HYPNO and GARY), line 114 (the pipeline), and lines 288 and 313 (the milestone and registry
    tables);
  - the same passages in the deck, the technical docs, `docs/SUMMARY.md` and `docs/MODELS.md`.
- **Owed to Will:**
  - `CLAUDE.md`'s "The pipeline is the point" paragraph and "A ladder launch needs Will's OK" both predate the standing
    approval and the population best response;
  - `docs/DIVISIONS.md` line 24 names "GARY/HYPNO" in the SOLVER box.
  - This pass did not edit either file.
- **Missing memory file:** `one-off-bo3-best-respond-to-population.md` is referenced by `solver-direction-2026-10-01.md`
  and does not exist.
- **Estimates to replace with measurements:**
  - games per generation, generations to a first net, and v3's size and training time (N4, N5);
  - the Hetzner vCPU efficiency and c7a's cores, by a one-hour benchmark on each box before any spend;
  - the Amdahl factor once the net's evaluation cost is a share of a decision (v2 already cut the leaves to 0.39×).
- **Open questions for Will:** Q11 (the cloud option and a ceiling), Q12 (when N3 starts) and Q13 (the team mix for N0
  and N9), in `solver/PLAN.md` §9.
