# SOLVER-PLAN — the Reg M-C open-sheet ladder agent

**Version 0.3.0 · 2026-10-01 · status: PLAN (nothing here is built unless its row says "exists" or "v1 built")**

*(0.3.0 revises the plan to Will's decisions of 2026-10-01: one learned policy+value net trained by self-play and
searched several turns deep; local first, built to scale out; best-respond to the population; the ladder is the
scoreboard, with standing approval for up to 20 series a day. Nothing dated before 2026-10-01 is rewritten: a row
or a section that the new direction replaces is marked SUPERSEDED and left as it was. Full account:
`docs/_reports/2026-10-01-plan-revision.md`. 0.2.0 was dated 2026-09-24.)*

Every figure below cites the file it came from. No figure from a quarantined or withdrawn model is
used. Estimates are marked **[EST]**. Figures reported by another group and not reproduced here are
marked **[REPORTED]**. What landed is recorded once, as its entry in `CHANGELOG-REGMC.md`; `solver/LOG.md`
is the frozen narrative up to 2026-10-01 (abra/regmc 1.64.0) and gains no new lines.

---

## 1. One-screen summary

### 1.0 The direction from 2026-10-01 (Will)

| | |
|---|---|
| **Why it changed** | In the week to 2026-09-30, one model beat its baseline: CHOMP v1, SPRT H1 at 524 games, 0.561 [0.518, 0.603] (abra/regmc 1.25.0). Every other candidate was neutral or worse: PORYGON2 v1-r1, v1-r2 and v2 each failed gate (a) on human positions (1.26.0, 1.46.0, 1.47.0); piKL λ 0.03 was H0 against gen5 (1.50.0); PORYGON2 v2 as gen5's leaf was H0 at 1 s with 0.39× the leaves (1.50.0). On the ladder the search arm went 3–11 (gen5ab arm A) and 5–10 (chomp1), without the opponent's forfeits, although gen5 beat DODUO-greedy 0.710 offline (1.16.0, 1.17.0, 1.39.0). |
| **Architecture** | **One learned policy+value net, trained by self-play** (Expert Iteration: the search is the expert, the net the apprentice), **searched several turns deep** by a depth-limited public-belief search (the ReBeL / Student of Games family), with **DUSK** solving small endgames exactly. **PORYGON2 v3 is that net.** The current pipeline keeps playing until the net wins its SPRT (§2, §3 N7). |
| **Simulator** | **MEDICHAM stays the simulator for all of it** — self-play, the search, the facts the net reads as input, and DUSK. It is the only game the net is trained on and the only one the search looks ahead in, always from a frozen release. |
| **Compute** | **Local and small-scale first.** The loop is built so it scales out: self-play is CPU-bound (MEDICHAM is Node), so many-core CPU workers for self-play and a modest GPU for training. A **MEDICHAM speed pass** comes before any cloud spend or scale-up (§3 N3). Estimate and prices: §6a. **No spending without Will.** |
| **Exploitation** | **Best-respond to the POPULATION** (how players at the opponent's rating band behave), updated inside the series for games 2 and 3, **falling back to equilibrium where the habit model fails its held-out gate.** This replaces the 2026-09-23 default "equilibrium base + capped HYPNO dial, ε 0.5" (§2 HYPNO row, §9 Q5). |
| **Scoreboard** | **The ladder.** The per-series residual `S − E`, read **without the series the opponent forfeited**, and the settled rating ± SD over the last N series. Never the peak. **The arena is a sanity check only.** Standing approval: up to **20 series a day** with the existing auto-stops (§4). Nothing new goes on a ladder arm without an SPRT pass or Will's OK. |

### 1.1 As of 0.2.0 (2026-09-24) — SUPERSEDED where §1.0 says otherwise, kept as history

| | |
|---|---|
| **Goal** | Get high on the `gen9championsvgc2026regmcbo3` ladder with account `medicham32`, running on this laptop. |
| **Shape** | At team preview: CHOMP takes both open sheets and returns a mixed strategy over the 90 bring/lead options (PORYGON2-scored, solved by SLOWKING). Each turn: a belief over hidden info (XATU), then a pruned joint-action matrix game (SLOWKING inside the MILTANK harness), then an equilibrium mix, then a capped exploit dial (HYPNO). |
| **Engine** | MEDICHAM is the only old model kept. Every other model is rebuilt from scratch under its old name. |
| **Done** | Human dataset, MAG v0 (the human policy prior), the descriptive meta (GURU v0). **v1 built and merged to main 2026-09-24:** MAG, DODUO, XATU, SLOWKING, MILTANK (skeleton + worker pool + lean playouts), and the offline arena (abra/regmc 0.113.0–0.116.1). The MEDICHAM solver API is merged (abra/regmc 0.95.0). Every arena figure is PRE-GATE. |
| **Blocking** | **M0.** The Reg M-C MEDICHAM gate is not open (`solver/LOG.md`, 2026-09-24). |
| **Where it runs** | Solver code in `solver/`. Outputs in `solver/out/`, which git ignores. Heavy runs go through `tools/lownode.cmd`. |
| **How it's judged** | Offline SPRTs at equal wall-clock, then the per-series ladder residual `S − E`. Never the peak rating (§5). |
| **Needs Will** | §7 (a new division and version line) and §9 (open questions). |

**The prior art is PokaiTrainer.** It played Reg M-B bo3 with open sheets and a Bayesian matrix game. It
won 59–60% of 150 sets and settled at a 1350–1400 band [REPORTED, arXiv 2608.29197, via
`docs/_reports/2026-09-23-solver-research-turn-search.md` §2.1]. That band is the reference point, not a
target we have measured against.

---

## 2. Model registry

### 2.0 What the net subsumes and what stays (2026-10-01)

**Nothing is retired before the net wins its SPRT against the current champion at equal wall-clock (§3 N7).** Until
then every row below keeps playing exactly as registered, and a model's archive commit is the commit where the net's
replacement passes (§8). "Subsumed" names a role that moves into the net; it does not delete the model's history.

| Model | Under the 2026-10-01 plan | What carries the role instead | Evidence this week |
|---|---|---|---|
| **MEDICHAM** | **STAYS — the simulator for self-play, the search, the net's input facts and DUSK** | — | Reg M-C gate OPEN 10/10, re-run on `97451d5fbf40` (1.46.1) |
| **PORYGON2** | **CHANGES: v3 becomes the joint policy+value net** (new row below) | — | v1-r1, v1-r2, v2 failed gate (a) on human positions (1.26.0, 1.46.0, 1.47.0); v2-as-leaf H0 (1.50.0) |
| **MAG** | **SUBSUMED** (the per-slot scoring role, already moved into DODUO's net). MAG v2's engine-proved dead-click cut is a mask, not a model: it may stay as a mask on the net's policy if an ablation shows it helps | the net's policy head; optionally MAG v2 as a mask | — |
| **DODUO** | **SUBSUMED** (the joint prior that narrows the candidates) | the net's self-play policy head | gen5's DODUO is the τ for piKL; λ 0.03 H0 (1.50.0) |
| **GARY** | **SUBSUMED** (the human habit model) | the net's **human head**: P(joint action \| public state, rating band), trained on human bo1+bo3; before the net exists, a standalone population model (§3 N1) | — |
| **XATU** | **SPLIT.** The policy part — the likelihood of an observed action, which reweights the worlds — is SUBSUMED. The bring prior, the spread belief and the damage-range reweighting STAY | the net's policy heads as the action likelihood in the belief update | — |
| **SLOWKING** | **STAYS** — the solve at every node of the search (the root, each depth-limited subgame, the preview matrix) | — | its unit fixtures; CHOMP v1 solves with it (1.25.0) |
| **MILTANK** | **CHANGES:** from a one-ply matrix with a playout leaf to the harness of a several-turn public-belief search with the net's value at the leaf | — | 13 of 26 chomp1 losses need value + depth; root value +0.19 [0.06, 0.32] too high in [0.5, 0.9) (1.39.0) |
| **HYPNO** | **CHANGES:** a population best response with in-series updates, equilibrium where the gate fails (dated update in its row) | — | the 2026-09-23 report already said exploitability matters only as far as a human adapts within a bo3 |
| **DUSK** | **STAYS** — exact endgame values inside the search | — | — |
| **MEW / MACHAMP** | **CHANGE:** MEW becomes the actor fleet, MACHAMP the learner and the gate, of the Expert Iteration loop. Built to run on N workers on any machine | — | gen5 accepted (SPRT H1 at 1,268 games, 0.528 [0.501, 0.556] vs gen0); gen1–4 rejected (1.8.0) |
| **WOBBUFFET** | **DEMOTED** to a diagnostic. Exploitability is no longer the headline (ADR-003 update 2026-10-01) | — | — |
| **CHOMP** | **STAYS** — v1 is the preview solver. A later version may score its cells with the net's value, and must beat v1 by gate (a) first, as v2 had to | — | v1 H1 (1.25.0); v2 failed gate (a) vs v1 (1.45.0) |
| **ROTOM** | **STAYS** — the live client | — | world fixes 1.40.0–1.44.0 |
| **DITTO** | **STAYS** (to build) | — | — |
| **GURU, JOLTEON, KADABRA** | unchanged | — | — |
| **ALAKAZAM** | **CHANGES:** the assembled agent becomes ROTOM + CHOMP + the net + the search + the population response | — | — |

### 2.1 The registry (rows dated 2026-09-24 onward; a 2026-10-01 note leads each row whose role changes)

| Name | Role | Input → output | Depends on | Status | The test that proves it | Must beat |
|---|---|---|---|---|---|---|
| **MEDICHAM** | **2026-10-01: STAYS — the simulator for self-play, the search, the facts the net reads, and DUSK; always a frozen release.** Simulator + solver API | state, joint action, dice → next state; `clone`, `legalActions`, `step`, `isTerminal` | Showdown M-C checkout (the authority) | Engine exists. API is on branch `worktree-agent-a1ac483af936…`, unmerged | Reg M-C quarantine gate open; `tests/test-medicham-api.js` green in main; `probe_medicham_api_differential.js --part legal` at 0 disagreements | Showdown, at zero board divergence |
| **MAG** (= MAGNEMITE) | **2026-10-01: SUBSUMED by the net's policy head on the net's SPRT pass; the v2 dead-click cut may survive as a mask (§2.0).** **v2: the per-slot DEAD-CLICK GATE** (Will, 2026-09-25). No longer scores or ranks. Cuts a click MEDICHAM shows fails for its slot whatever the partner and the opponent do; a click futile only against the bodies now in (a switch rescues it) is SOFT: near-zero weight, not cut | position + side → a verdict per slot option: live / soft / dead / untested | MEDICHAM (frozen release), `solver/mag/probe.js` | **v2 built** (`solver/mag/gate.js`); v1 (the per-slot scorer, `solver/mag/infer.js`) is now DODUO's per-slot net | constructed boards, each RED on a break (`solver/tests/test-gates.js`); the human's own click survives on held-out Reg M-C decisions (`solver/doduo/eval_gates.js`, pre-registered bar 99.9%) | removes nothing a human clicked that the replay shows worked (every loss explained by its replay) |
| **DODUO** | **2026-10-01: SUBSUMED by the net's self-play policy head on the net's SPRT pass (§2.0).** Joint coordinator: scores the pair as one joint action (focus fire, redirect-then-attack, double switches). **v2 adds the PAIR gate**: cuts a joint only when one click has no effect beside THIS partner click and has one beside another (Helping Hand beside a non-attacker, two redirects, a support move on a partner that is leaving) | MAG v2's verdicts + DODUO v1's scores → gated, weighted joint scores (`solver/doduo/v2.js`, a drop-in prior adapter) | MAG | **v2 built** (`solver/doduo/`; scorer v1 in `solver/mag/`) | v1: joint recall@k on held-out players. v2: the gate tests and the survival run above; DODUO-greedy gated vs ungated and MILTANK gated vs ungated, SPRT on `eaa5becc54eb` | v1 beat v0 with no pair term: top-1 18.3% vs 21.3% (`solver/out/prior/ablation/prior-v0-nopair.metrics.json`, `prior-v0.metrics.json`). v2: must not lose to v1-greedy |
| **PORYGON2** | **2026-10-01: v3 becomes the joint policy+value net (next row).** Value net | state + world → P(win) | MEDICHAM (relational facts), MEW data | **v0 built** (`solver/porygon2/`; human outcomes; engine facts PRE-GATE). V0 passed: held-out log-loss 0.517 vs count-HP 0.577 and emb-only 0.536, CIs clear (`solver/porygon2/model/porygon2-v0.metrics.json`). V2 (arena) PRE-GATE only. **v2 designed, dataset built, not trained** (2026-09-30): public-state net with UNK tokens and both ratings as inputs, bo1 pretrain → bo3 fine-tune (`solver/porygon2/v2/DESIGN.md`, `preregistration.json`, manifests `manifest-bo1.json` / `manifest-bo3.json`). **Since (to 2026-09-30):** v1 on main, gate (c) vs gen5 0.516 [0.494, 0.538] INCONCLUSIVE; v1-r1 gate (c) H0 0.492 and gate (a) human −0.0032 [−0.0078, +0.0018] FAIL (1.26.0); v1-r2 gate (a) human −0.0044 [−0.0086, +0.0002] FAIL (1.46.0); v2 trained, gate (a) −0.0098 [−0.0202, +0.0002] FAIL (1.47.0); v2 as gen5's leaf, SPRT H0 0.480 [0.441, 0.520] at 0.39× the leaves (1.50.0) | V0/V1/V2 ladder (App. B) | count-HP logistic `[alive_diff, hp_diff]`, then the rollout leaf in the same search |
| **PORYGON2 v3 — THE NET** (added 2026-10-01) | **The joint policy+value net**, trained by self-play (Expert Iteration) and searched several turns deep. One trunk over the public state (UNK for the unrevealed, both ratings as inputs, as v2), with heads: **value** P(win); **self-play policy** over joint actions (the search's target; replaces DODUO); **human policy by rating band** (the population model; replaces GARY and XATU's action likelihood); the v2 auxiliary heads | public state + both sheets + ratings → P(win), π_self(joint), π_human(joint \| band) | MEDICHAM (frozen release) for every fact it reads and every game it learns from; MEW/MACHAMP; the human dataset | **Design in progress on another branch** (`solver/porygon2/v3/` on `worktree-agent-aadbc255e960b0c50`: `positions.js`, `deep.js`, `evalset.js` — a frozen held-out evaluation set of ladder, bo1 ≥1500 and bo3 ≥1300 positions, labelled by playing each root cell to the end, scored on ranking, calibration and cost; its `DESIGN.md` and `docs/_reports/2026-10-01-porygon2-v3.md` not landed when this row was written). This plan aligns with it and does not duplicate it | (a) on the v3 evaluation set: ranking regret and the [0.5, 0.9) overconfidence gap below gen5's, cost per evaluation measured; (b) the human head beats DODUO v1 on held-out human decisions; (c) the human-position gate (a) that v1-r1, v1-r2 and v2 failed; then **N7: SPRT vs the current champion at equal wall-clock** | gen5 (the current champion's net), at equal clock. v2 at depth 0 did not beat it: H0, 0.480 [0.441, 0.520], 0.39× the leaves (1.50.0) |
| **SLOWKING** | Per-turn simultaneous-move solver | payoff matrix → σ_me, σ_opp, v* | MILTANK cells | **v1 built** (`solver/slowking/`) | RPS → uniform; known 2×2 → LP answer; stability bound; constructed dominant-action fixtures | greedy one-turn baseline, and MAG with no search (P1) |
| **MILTANK** | **2026-10-01: CHANGES to the harness of a several-turn public-belief search, the net's value at its leaves, DUSK at small endgames (§3 N6).** Search harness: candidates, CRN playouts, successive halving, clock budget | state, clock → filled matrix | MEDICHAM API, DODUO, XATU | **v1 built** (`solver/miltank/`; PRE-GATE) | Pruner **joint** coverage on held-out human turns (threshold set before the run); timer-ON series with 0 timeouts | uniform cell allocation at the same wall-clock |
| **XATU** | **2026-10-01: SPLIT — the action likelihood that reweights worlds moves into the net's policy heads; the bring prior, the spread belief and the damage-range reweighting stay (§2.0).** Belief over the hidden back two + spreads | sheets, reveals, turn order, damage % → posterior over worlds | MEDICHAM `dmgRange`, store | **v1 built** (`solver/xatu/`) | Back-two log-loss vs the revealed back two; in self-play the true world is never at zero | store bring frequencies; a uniform spread prior |
| **GARY** | **2026-10-01: SUBSUMED.** The population model by rating band is built first as a standalone model (§3 N1) and then becomes the net's human head. Its per-bucket held-out gate is kept: it decides where HYPNO best-responds and where it falls back to equilibrium. Human habit model per situation bucket | bucket → h(joint action) | MAG/DODUO, store | To build | Per bucket, h must beat τ* on held-out log-loss, CI clear of zero | τ* (the equilibrium prediction) |
| **HYPNO** | Capped exploit dial (ε-safe LP + data-biased trust) | A, σ*, h, ε → σ_play | SLOWKING, GARY | To build | Worst case ≥ v* − ε on every logged decision; ε Pareto sweep | ε = 0 (pure equilibrium) |
| ↳ **HYPNO — dated update, 2026-10-01 (Will). The row above is SUPERSEDED as the default; it is kept as written.** | **Population best response.** A ladder bo3 is a one-off against a stranger (Will: *"its not poker where you play thousands of hands against the same people, its a bo3 series once"*). So HYPNO plays the **best response to h = the population model at the opponent's rating band** (GARY now, the net's human head later), **per situation bucket, only where that bucket passes its held-out gate**; elsewhere it plays the equilibrium σ\*. **Games 2 and 3** update h toward this opponent from game 1 (a Bayesian posterior over "follows the population" vs "plays ≈ τ\*", with decay, because a human may reverse a game-1 habit). The ε-safe LP stays implemented as an option for an A/B, **not the default**; the ε 0.5 start (§9 Q5) is superseded. In this project's vocabulary this is "greedy" = exploitative play (ADR-003) | A, σ\*, h_pop(band, bucket), the bucket's gate verdict, game-1 observations → σ_play | SLOWKING, GARY → the net's human head | To build (§3 N2) | Gate 1 (per bucket): h beats τ\* AND DODUO v1 on held-out log-loss, game-clustered CI clear of 0, else p = 0. Gate 2: the predicted gain xᵀAh − v\* exceeds the payoff matrix's own standard error. Offline sanity: BR beats equilibrium against a held-out human clone, and the loss against an equilibrium opponent is reported. **The test that counts:** the per-series ladder residual, BR arm vs equilibrium arm | the same agent at equilibrium (HYPNO off) |
| **DUSK** | Endgame tables | small late positions → exact value | MEDICHAM | To build | Exact agreement with deep search on constructed endgames | the search it replaces, at endgames |
| **MEW** | **2026-10-01: CHANGES to the actor fleet of the Expert Iteration loop, N workers on any machine (§3 N7, N8).** Self-play factory | release, agents, teams → stamped games | frozen MEDICHAM release | **v0 built** (`solver/mew/`): 1,721–1,943 games/hour on 4 workers, release `eaa5becc54eb` (`docs/_reports/2026-09-25-selfplay-v0.md`) | Games/hour measured; every record stamped with release id + weights digest; zero-counter check | — (infrastructure) |
| **MACHAMP** | **2026-10-01: CHANGES to the learner and the gate of the Expert Iteration loop for PORYGON2 v3, with a human anchor (§3 N7).** Training loop / league | MEW games → next checkpoint | MEW, PORYGON2, MAG/DODUO | **v0 built** (`solver/machamp/`): 5 generations gated. **gen5 accepted** by SPRT (elo1 +20, α = β = 0.05): H1 after 1,268 games, 0.528 [0.501, 0.556] against gen0. gen1–4 rejected | G1: generation n+1 beats n by SPRT on the same release | the previous checkpoint |
| **WOBBUFFET** | **2026-10-01: DEMOTED to a diagnostic; exploitability is no longer the headline (ADR-003 update).** Exploitability best-responder | frozen agent → an exploiter + its win rate | MACHAMP | To build | Finds the hole in a planted exploitable bot | exploiter win rate must not rise generation over generation |
| **DUSK** | Endgame solver (**not tables**: on-the-fly, per-game memo; Will's "endgame tables" row, redesigned on the measurement 2026-10-01) | an E2 position (both sides ≤ 2 alive) → a certified P(win) band + the root mix | MEDICHAM (frozen release, `medicham_api`), `solver/miltank/chance.js`, SLOWKING LP, MAG v2, DODUO, XATU | **Designed, not built** (`solver/dusk/DESIGN.md`, abra/regmc 1.54.0). E2 is reached in 44.0% of all bo3 games and 46.6% of ours; a table key that fixes the value repeats ≤ 1.0% of the time; our endgame conversion vs humans −3.7 wins / 88 [−10.8, +3.6] (`solver/dusk/endgames-summary.json`) | V-D1 brute-force agreement to 1e-9 on constructed 1v1/2v1 fixtures, RED on three breaks; V-D2/V-D3; V-D5 feasibility (DESIGN §4) | the search it replaces (gen5 MILTANK 4×4, depth 0) at E2 decisions, SPRT at equal wall-clock on real E2 starts (DESIGN §5, draft, not run) |
| **MEW** | Self-play factory | release, agents, teams → stamped games | frozen MEDICHAM release | **v0 built** (`solver/mew/`): 1,721–1,943 games/hour on 4 workers, release `eaa5becc54eb` (`docs/_reports/2026-09-25-selfplay-v0.md`) | Games/hour measured; every record stamped with release id + weights digest; zero-counter check | — (infrastructure) |
| **MACHAMP** | Training loop / league | MEW games → next checkpoint | MEW, PORYGON2, MAG/DODUO | **v0 built** (`solver/machamp/`): 5 generations gated. **gen5 accepted** by SPRT (elo1 +20, α = β = 0.05): H1 after 1,268 games, 0.528 [0.501, 0.556] against gen0. gen1–4 rejected | G1: generation n+1 beats n by SPRT on the same release | the previous checkpoint |
| **WOBBUFFET** | Exploitability best-responder | frozen agent → an exploiter + its win rate | MACHAMP | To build | Finds the hole in a planted exploitable bot | exploiter win rate must not rise generation over generation |
| **CHOMP** | **Team-preview solver**, rebuilt from scratch inside ABRA under `solver/chomp/`. The old CHOMP repo runs on stale mainline data and its bring choices tested at coin level, so it is reference only (Will, 2026-09-24) | both open sheets → a mixed strategy over the 90 bring/lead options | PORYGON2 (scores the cells), SLOWKING (solves the matrix game); JOLTEON optional pre-screen | **v1 built and promoted** (`solver/chomp/v1/`; ROTOM `--preview chomp`, not on a ladder arm). Beats the human-modal bring: SPRT H1 at 524 games, 0.561 [0.518, 0.603]; vs the humans' own bring (report-only) 0.470 [0.422, 0.519], no clear edge (`solver/results/2026-09-27-chomp-v1/`, release `eaa5becc54eb`). v1 vs v0 not tested. **v2** (`solver/chomp/v2/`, per-set spreads and field effects) fails gate (a) against v1: Δlog-loss −0.0004 [−0.0032, +0.0024] (`docs/_reports/2026-09-30-chomp-v2.md`). v0 fails its bar: vs the human bring 0.430 (0.363–0.499), SPRT H0 (`docs/_reports/2026-09-25-chomp-v0.md`) | Preview exploitability; H2H with the same in-battle agent on both sides | uniform, human-modal bring, greedy argmax |
| **JOLTEON** | CHOMP's **optional fast pre-screen** of the 90 × 90 preview cells. Dropped if PORYGON2 is fast enough to score every cell (Will, 2026-09-24) | my six, their six → a cheap Q(bring 4, lead 2) to prune CHOMP's matrix | PORYGON2/ALAKAZAM self-play | Optional; build only if CHOMP needs it | Pruning never drops CHOMP's support at the same wall-clock | CHOMP with no pre-screen |
| **GURU** | Meta analysis | store → usage, sets, archetypes, bring/lead, Bo3 adaptation | store only | **v0 exists (descriptive)** (`solver/meta/`) | `solver/tests/test-meta-lib.js` 29/29, `test-meta-artifacts.js` 21/21; the replicator test comes later | persistence (for usage forecasts) |
| **DITTO** | Team builder (PSRO + set library + spread optimiser) | population → teams | CHOMP, ALAKAZAM, GURU set library | To build | Rank agreement under two agent strengths (the pilot confound) | the most-used human teams, piloted by the same agent |
| **The live client** (ROTOM) | Ladder client | server protocol ↔ ALAKAZAM | ALAKAZAM | To build (§4) | Timer-ON local series: 0 timeouts, 0 bank forfeits, 0 lost series from a disconnect | `engine/mag_bot.js` behaviour, plus laddering |
| **ALAKAZAM** | **2026-10-01: CHANGES to ROTOM + CHOMP + the net + the search + the population response; replaces the pipeline arm only after the net's SPRT pass (§3 N7, N9).** The assembled agent | request → choice | everything above | To build | Offline SPRT ladder, then the ladder protocol (§5) | its previous version, on the per-series residual |
| **KADABRA** | Coach | ALAKAZAM decision logs → an explanation for Will | ALAKAZAM logs | To build | Every sentence traces to a logged decision (it may not author a number) | — |

---

## 3. Build milestones (dependency order)

### 3.0 The path from 2026-10-01: N0–N9

Each milestone names what it depends on, its exit test, and the finding from this week that put it there. A
milestone's test is pre-registered before its first game and read once at its bound. **Store-only work (N1) does not
touch MEDICHAM; N0 and N2 run on the current pipeline while the net is built (N3–N7).**

| N | What lands | Depends on | Exit test | Why it is here (measured this week) |
|---|---|---|---|---|
| **N0** | **The ladder scoreboard runs.** The current champion pipeline (gen5 search + CHOMP v1 preview + ROTOM with the 1.40–1.44 world fixes and the role spreads) plays capped batches under the standing approval: ≤ 20 series a day, the existing auto-stops | nothing | ≥ 100 rated series on one arm, played out; the record with and without the opponent's forfeits, the mean residual `S − E` ± SE and the settled rating ± SD, from `node solver/rotom/report.js ladder`; 0 self-quits, 0 timeouts, 0 uncounted fallbacks. This is the **baseline the net must beat on the ladder** | Arena wins did not transfer: gen5 beat DODUO-greedy 0.710 offline (1.16.0) and the search arm went 3–11 (gen5ab A) and 5–10 (chomp1) without forfeits (1.17.0, 1.39.0). The world fixes (1.40–1.44) and the role spreads (1.44.0) have played **no** ladder series yet |
| **N1** | **The population model** (GARY v1): P(opponent's joint action \| public state, rating band), fitted on Reg M-C open-sheet bo3 plus bo1 by band, `medicham32` excluded, voluntary switches split from replacements | the human dataset (store-only) | Per band and per bucket, held-out log-loss beats τ\* AND DODUO v1 (held-out top-1 0.230, `…human-regularised-search.md`), game-clustered CI clear of 0. A bucket that fails gets p = 0 (equilibrium) and is listed | piKL λ 0.03 moved the search toward human play (top-1 0.216 → 0.268 at λ 0.1) and did not add strength (H0, 1.50.0): **modelling humans is for predicting the opponent, not for playing like one** |
| **N2** | **HYPNO v1: population best response** in the current pipeline, with in-series updates for games 2–3 and the equilibrium fallback (§2 HYPNO dated update) | N1, N0 | Offline sanity: BR beats equilibrium against a held-out human clone; its loss against an equilibrium opponent is reported. **Then the ladder:** per-series seeded A/B, BR vs equilibrium, residual `S − E`, read once at a pre-registered bound | Will, 2026-10-01: a bo3 is a one-off. The 2026-09-23 report: exploitability matters only as far as a human adapts inside a bo3 |
| **N3** | **MEDICHAM speed pass** — owner **ENGINE** (deferred by Will; on the plan so it is not lost). **Comes before any cloud spend or self-play scale-up (N8)** | — (ENGINE, beside N1–N2) | Board-identical: the pinned differential and the three Reg M-C lattices at 0 board-material, the lean-mode test GREEN; a **measured** speed-up (paired same-process A/B, turns per CPU-second); then a gate re-run on a new release, OPEN 10/10 | ~80% of a playout is `battleTurn` and nobody has profiled inside it (`2026-09-24-playout-speed.md`); memoising `norm()` gave +8–17% (`2026-09-24-engine-turn-speed.md`); lean mode 1.18–1.35× per turn (`2026-09-24-lean-mode.md`). Self-play cost scales with it (§6a) |
| **N4** | **PORYGON2 v3 evaluation set and design** — **in progress on another branch**; this plan aligns with it | MEDICHAM release; the human dataset | The frozen held-out set built (ladder, bo1 ≥ 1500, bo3 ≥ 1300), its leakage test GREEN, the deep reference labelled with its noise ceiling, and gen5, v1 and v2 scored as baselines on ranking, calibration and cost. v3 `DESIGN.md` pre-registered | Three retrains failed gate (a) on humans (1.26.0, 1.46.0, 1.47.0); the ladder value is +0.19 [0.06, 0.32] too high in [0.5, 0.9) (1.39.0); v2's better log-loss did not pay at the leaf (1.50.0). A net needs a test that measures what the search uses |
| **N5** | **PORYGON2 v3 bootstrap: the joint policy+value net**, trained on human data (both policy heads + value) and the existing self-play corpora | N4 | On the v3 set: ranking regret and the [0.5, 0.9) overconfidence gap below gen5's, CIs clear; the human head beats DODUO v1; the human-position gate (a) passes; cost per evaluation measured and inside the budget the search needs | v2 reached 0.39× gen5's leaves at the same clock and lost the gain (1.50.0): **cost is part of the test** |
| **N6** | **Several-turn public-belief search** (MILTANK's harness): XATU's worlds as the belief, the net's policy for candidates and as the action likelihood, the net's value at the depth limit, SLOWKING at each node, **DUSK** exact at small endgames. Everything steps on MEDICHAM | N5 | On the v3 set: depth-2 regret below depth-0 regret, CI clear. Clock-safe under ROTOM's budget (0 timeouts; p99 under the 55 s turn cap minus margin). DUSK exact on its fixtures. **SPRT vs the current champion at equal wall-clock** (arena, sanity) | 13 of the 26 chomp1 losses (VISIBLE_KO 5, SPEED_CONTROL 5, SETUP 3) had the opponent's action in the table and a one-turn leaf that still valued the position 0.42–0.87 (1.39.0) |
| **N7** | **The Expert Iteration loop, local and small** (MEW actors + MACHAMP learner): self-play with the N6 search makes the policy target (the search's mix) and the value target; a human anchor keeps the human gate; each generation gated by SPRT against the last | N6 | **G1 twice:** two consecutive generations accepted by SPRT, each still passing the human-position gate (a); every record stamped with release, pool and weights digests; counters non-zero. **Then the net's SPRT vs the pipeline champion at equal wall-clock** — the pass that retires MAG, DODUO and GARY's roles | MACHAMP accepted 1 generation in 5 (1.8.0). Adding self-play data has not improved the human half in three refits (1.26.0, 1.46.0, 1.47.0), so the anchor is not optional |
| **N8** | **Scale-out** — **only after N3 and N7, and only with Will's OK on spend**: the same loop on rented many-core CPU for the actors and a modest GPU for the learner (§6a) | N3, N7, Will | A cloud generation reproduces a local one: same release id and pool digest, board-identical on a seeded sample of games (Linux vs this Windows machine), games per core-hour within the estimate's range, cost per generation measured against §6a | The loop has to show it can learn locally first (Will, 2026-10-01) |
| **N9** | **The net on the ladder.** ALAKAZAM = ROTOM + CHOMP v1 + the net + the search + HYPNO v1 replaces the pipeline arm | N7's SPRT pass (an arm needs an SPRT pass or Will's OK), N0's baseline | Per-series seeded A/B against the N0 pipeline, residual `S − E` without forfeit wins, read at its pre-registered bound. **Headline:** the settled rating over the last N ≥ 100 series ± SD. Never the peak | The ladder is the scoreboard (Will, 2026-10-01) |

**What the ladder can resolve at 20 series a day** [DERIVED from §5, `…humans-and-ladder.md` §3.3]: +100 Elo against a
residual of 0 needs ~100 series, **~5 days**; +50 Elo one-arm ~380 series, **~19 days**; +50 Elo as an A/B ~770 per arm,
**~77 days**. So the ladder settles large effects only. A small change is settled offline first, and reaches the ladder
only on an SPRT pass.

CHOMP, DITTO and KADABRA sit off this path: CHOMP v1 stays the preview solver; a CHOMP that scores its cells with the
net's value must beat v1 by gate (a) first, as v2 had to (1.45.0).

### 3.1 The 2026-09-24 milestones M0–M8 — SUPERSEDED 2026-10-01 by §3.0, kept as history

Where they ended: **M0** done (gate OPEN, `eaa5becc54eb`, re-run on `97451d5fbf40`). **M1** built (DODUO v1/v2, XATU
v1; GARY not built — now N1). **M2** built (SLOWKING + MILTANK). **M3** built (ROTOM, laddering, the clock). **M4**
CHOMP v1 built and H1 (1.25.0), the first ladder series played (1.17.0, 1.39.0). **M5** MEW/MACHAMP v0 built, gen5
accepted (1.8.0) — now N7. **M6** (DUSK, WOBBUFFET, per-world CFR) → N6, WOBBUFFET demoted. **M7** (HYPNO ε dial) →
N2 as a population best response. **M8** (CHOMP v1, DITTO) — CHOMP v1 done; DITTO open.

The **store-only** work (M1) does not depend on MEDICHAM and can run beside M0.

| M | What lands | Exit test | How it moves us up the ladder |
|---|---|---|---|
| **M0** | Reg M-C MEDICHAM gate open. The API merged: the 26 menu slots fixed, the mid-turn-choice callback (step 6), a fresh gate re-read | `quarantine.js --regulation regmc` open; `test-medicham-api.js` green in main; legal-action probe at 0 of N | Nothing downstream can be trusted until the game being searched is the real game |
| **M1** | DODUO split out of MAG v0. XATU bring posterior. GARY v0 buckets. MAG v1 intersected with `legalActions` | DODUO beats the no-pair v0; XATU beats store bring frequencies; GARY buckets pass their held-out gate or get p = 0 | A pruner and a belief that cover what humans actually click |
| **M2** | SLOWKING + MILTANK: a one-ply matrix, a truncated CRN rollout leaf, reserved switch and mega slots | Solver unit tests; joint coverage ≥ the pre-set bar; stability; SPRT vs greedy one-turn and vs MAG with no search | Search is where the strength comes from ("every search agent beats its own policy head" [REPORTED, PokaiTrainer]) |
| **M3** | Clock + the live client, on a **local** Showdown server. The offline arena | Timer-ON series: 0 timeouts, 0 bank forfeits, p99 latency under `X − margin`; a disconnect drill rejoins without forfeiting | Being able to play at all without throwing games to the clock |
| **M4** | CHOMP v0 in `solver/chomp/` (the 90 × 90 preview matrix scored by the rollout leaf or PORYGON2, solved by SLOWKING; JOLTEON pre-screen only if needed). ALAKAZAM v1. **The first ladder burn-in** at ε = 0, after the admin message | Preview H2H vs the human-modal bring; burn-in until the rating is above ~1300 and the residual is within ±1 SE of 0 [EST rule, `…humans-and-ladder.md` §3.4] | First real rating |
| **M5** | PORYGON2 on MEW self-play; the MACHAMP loop (Expert Iteration, league with a human-BC anchor) | V0 → V1 → V2 (App. B); G1 passes twice | A value net replaces the rollout turns, which buys wider matrices at the same clock |
| **M6** | XATU per-world opponent tables (linear CFR). WOBBUFFET. DUSK | Toy Bayesian game solved exactly; SPRT vs M5 at equal wall-clock; exploiter win rate not rising; DUSK exact on its fixtures | Removes the strategy-fusion error on the opponent side; closes endgames exactly |
| **M7** | HYPNO + GARY on the ladder | ε Pareto sweep offline; per-series randomised ladder A/B, ε = 0 vs ε* (§5) | Takes points from human habits, with the worst case bounded |
| **M8** | CHOMP v1 (PORYGON2 at M5 strength scores every cell; JOLTEON dropped if it is fast enough), DITTO, the GURU replicator test, KADABRA | CHOMP v1 beats v0; DITTO survives the pilot-confound check; replicator vs persistence | Better teams and brings: probably the largest single effect on rating [EST, `…humans-and-ladder.md` §3.4] |

---

## 4. ROTOM — the live client

It replaces `engine/mag_bot.js`. That file **only accepts challenges and never searches the ladder**
(`engine/mag_bot.js:34-36`). It logs in from `data/.showdown-pass` or `SHOWDOWN_PASS`, keeps one player
per room, reconnects with a 2 s → 60 s backoff, and waits up to 25 s at preview for the sheet.

| Requirement | Detail | Source |
|---|---|---|
| **Format** | `gen9championsvgc2026regmcbo3` only. Force Open Team Sheets, Best of 3. The bo1 ladder is closed-sheet and out of scope | `pokemon-showdown-mc/config/formats.ts:295-299` (via `…humans-and-ladder.md` §2.2) |
| **Account** | `medicham32`, disclosed to a Showdown admin **before the first ladder game**. No VPN | Will, 2026-09-23 |
| **Password** | Read from `data/.showdown-pass` (gitignored, checked) or `SHOWDOWN_PASS`. Never on the command line, never logged | `.gitignore`; `mag_bot.js:9-11` |
| **Laddering** | `/utm` the team, then `/search` the format. **One series at a time.** A daily series cap. A kill-switch file stops new searches after the current series | — |
| **Clock** | Preview 90 s; bank 420 s; grace 90 s; **55 s max per turn; no increment**. Parse `\|inactive\|` every request. Budget = `min(X − margin, (bank − reserve) / E[remaining requests])`, where `E[…]` comes from the store and is never typed. Replacements spend the same bank | `pokemon-showdown-mc/data/rulesets.ts:778-785` |
| **Warm-up** | Start the search workers at connect time and warm them during preview. V8 tier-up costs up to ~5.6× for about the first 4,000 playouts | `data/medicham-speed.json` `warm_state_effect` |
| **Series adaptation** | The rating updates **once per series**. Stay connected and never rename between games, or the series is forfeited. Carry game-1 observations into games 2–3 (XATU/GARY). Humans bring the same four again 61.0% of the time after a win and 29.7% after a loss | `room-battle-bestof.ts:214-219, 232-233`; `solver/out/meta/bo3.json` |
| **Disconnect safety** | On reconnect, rejoin every open battle room and re-read the last request before choosing. A watchdog restarts a crashed process and rejoins. The DC timer bank covers the gap | — |
| **Never forfeit by accident** | If the search throws or times out, play MAG's top legal action and **count it**. A zero-fallback run must be provable, not assumed | CLAUDE.md capability-counter rule |
| **Never two of Will's accounts at once** | A machine-wide lock file. The client refuses `/search` while Will's own accounts could be laddering the same format. Method to be confirmed (§9 Q9) | Showdown rule 4 ("gaming the system") |
| **Logging** | One artifact per series: series id, arm, ε, pre/post Elo of both players, S, E, HYPNO deviation count, clock used, engine release id, weights digests | `…humans-and-ladder.md` §3.4 |
| **Data hygiene** | `medicham32` is already on the own-account exclusion list of both the human dataset and the meta | `2026-09-23-human-dataset.md`; `2026-09-23-regmc-meta.md` §1.3 |
| **Owed elsewhere** | The claim in `mag_bot.js:34-36` that laddering breaks Showdown's rules is unsourced. No written rule forbids it; staff act at their discretion. That correction belongs to OPS, not this plan | `…humans-and-ladder.md` §2.1 |

**Dated update, 2026-10-01 (Will) — standing ladder approval, capped.** The coordinator may run ladder batches of **up
to 20 series a day** whenever a change lands, with the existing auto-stops (`solver/rotom/LADDER.md` §3: `--sets`,
`--max-hours`, `--max-errors` consecutive errors → exit 4 HALTED, a self-quit halts, STOP / KILL by recorded pid, the
two-account guard), without asking each time. **No launch beyond that cap**, and **nothing new goes on a ladder arm
without an SPRT pass or Will's OK.** SOLVER still prepares the arm, the flags and the command; the launch is the
coordinator's under this approval. Each batch reports its record **without the opponent's forfeit wins** and its
residual `S − E` ± SE. The *Logging* row's "HYPNO deviation count" becomes the count of decisions where the population
response differed from σ\*, and which buckets were trusted.

---

## 5. Evaluation harness

| Layer | What | Rule |
|---|---|---|
| **In-process arena** | Both agents play inside MEDICHAM through the API | Frozen release + census pin + `data/team-pool-frozen-regmc`; record `--games` and every flag |
| **Local-server arena** | Both agents play through the live client on a local `pokemon-showdown-mc` with the timer ON | Proves the client and the clock, not strength |
| **Baselines** | random legal · MAG argmax · MAG sampled · greedy one-turn · SLOWKING with the rollout leaf only | Each new model must beat the row named in §2 first |
| **Head-to-head** | SPRT at **equal wall-clock**, paired seeds, the same team pairs, clustered by game | Promotion only on a pass |
| **Exploitability** | Root exploitability computed on every decision (checkable). WOBBUFFET fine-tuned against the frozen agent | The exploiter's win rate must not rise across generations |
| **Ladder protocol** | One account. **The arm is drawn per series by a seeded coin, committed in advance.** Metric = mean residual `S − E` per arm, read by SPRT. One fixed team (or a fixed rotation) across both arms | Headline = mean rating over the last N ≥ 100 series ± SD. **Never the peak.** |

**What the ladder can resolve** [DERIVED, `…humans-and-ladder.md` §3.1, §3.3]:

| | |
|---|---|
| Rating noise at K = 40 | ≈ ±60 Elo stationary SD. The expected peak is about +120–150 above the true rating |
| +100 Elo | ~100 series (one arm, residual vs 0) |
| +50 Elo | ~380 series one arm · ~770 per arm A/B, about 2–3 weeks of continuous play [EST] |
| +25 Elo | ~1,500 one arm. **Settle it offline, not on the ladder** |

**Dated update, 2026-10-01 (Will): the ladder is the scoreboard; the arena is a sanity check.** A model still clears
its offline baseline by SPRT at equal wall-clock before it may go on an arm, but an arena win is not evidence of
ladder strength: gen5 beat DODUO-greedy 0.710 [0.615, 0.790] offline (1.16.0) and the search arm went 3–11 on the
ladder without the opponent's forfeits (1.17.0); chomp1 went 5–10 (1.39.0). The arena also restarted at 1.49.0 (real
per-set spreads), so earlier arena figures are not comparable with later ones. The **Exploitability** row above is
demoted to a diagnostic (ADR-003 update 2026-10-01): WOBBUFFET may report it, and no promotion reads it. At 20
series a day the resolution table above takes ~5 days for +100 Elo and ~19 days for +50 Elo on one arm (§3.0).

---

## 6. Laptop self-play plan

| Item | Plan |
|---|---|
| **Machine** | 16 cores, 13 GB, ~12 Claude processes resident (CLAUDE.md). **Every heavy run goes through `tools\lownode.cmd`** (BELOWNORMAL) |
| **Workers** | 8–10 long-lived Node workers [EST, `…learning.md` §6]. ~385 MB each when warm (`data/medicham-speed.json`). Parallelism is process-level only, never interleaved in one isolate (`2026-09-23-engine-interface-brief.md` §0) |
| **Schedule** | Overnight runs on a **frozen MEDICHAM release**. A self-play run never reads the live tree (the photograph rule) |
| **Throughput** | Unknown until MEW measures it at M5. Estimates run from ~100–300 games per worker-hour [EST, turn-search §4] to ~1,500–7,000 games/hour in total [EST, learning §6]. **The first MEW run replaces both** |
| **Training** | Train in Python, infer in hand-written Node. Only numpy is installed today (`2026-09-23-policy-prior-v0.md` §1). A JS-vs-Python parity test, shown red on a perturbation first (the MAG v0 pattern) |
| **Data keying** | Every record is stamped with the release id + weights digest. When the release moves, drop or down-weight older self-play data. Never mix it silently |
| **Storage** | Everything bulky goes in `solver/out/<kind>/<release-id>/`, sharded, and **git ignores it** (`.gitignore`: `out/`). The human dataset alone is 497.7 MB (`2026-09-23-human-dataset.md`) |
| **What git tracks** | Code, small model JSONs (MAG v0 is 196 KB), metrics files, manifests with sha256, test fixtures |
| **100 MB wall** | GitHub rejects any file over 100 MB. Before every commit that touches `solver/`, ask `git ls-files`, not the disk. Never track `games.jsonl`, tensors or self-play shards. State the growth budget in any change that adds a tracked artifact |

### 6a. Compute estimate for the net's loop (2026-10-01) — local first, priced for scale-out. **No spending.**

**Shape of the loop.** Actors (MEW) play self-play games with the search on a frozen MEDICHAM release, one Node
process per core, process-level parallelism only; the learner (MACHAMP) trains PORYGON2 v3 on a GPU in Python; a gate
plays the new net against the last by SPRT. Actors and learner run **asynchronously** (the actors keep playing on net
n while net n+1 trains), so a run is bounded by the slower of the two. Nothing in the loop assumes this machine: the
same worker runs on N cores anywhere, which is what lets it scale out later.

**Measured local rates** (release `eaa5becc54eb`, this machine, 3 workers, BelowNormal):

| Search budget per decision | Games per hour | Worker-seconds per game | Source |
|---|---:|---:|---|
| 1,000 ms (k 4×4, 1 reserved switch row) | 736–738 | 14.7 | `docs/_reports/2026-09-25-selfplay-v0.md` §10 (2 × 1,000 games) |
| ~104 ms (cheap labels) | 7,833 | 1.38 | `solver/out/selfplay/eaa5becc54eb/p2v1-c1/manifest.json` (10,000 games, 4,596 s) |
| Training PORYGON2 v2 (109,716 parameters), one CPU thread | — | ~5.3 ms per position-step | `solver/porygon2/v2/model/porygon2-v2-k1.stage{A,B}.metrics.json` (2,574 s + 1,970 s) |

**One generation [EST]:** 10,000 self-play games + ~1,000 gate games (the SPRTs this week stopped at 416–1,268 games:
1.8.0, 1.25.0, 1.50.0), self-play at 1 s a decision (the measured setting). That is **≈ 45 CPU worker-hours**
(4.2 at 0.1 s; ~135 at 3 s). Training: ~1.15 M positions (5 generations of replay at ~122 k decisions each, plus the
538,530 human positions of the v2 datasets) × 5 epochs ≈ 5.75 M position-steps: **~8.4 h on one local CPU thread at
v2's size, ~85 h for a net ten times larger [EST], ~0.25 h on one GPU [EST, range 0.1–1 h]**. The net's size is v3's
call (N4); PokaiTrainer's value net was 5.4 M parameters [REPORTED, `…turn-search.md` §2.1].

**Hours per generation:**

| Where | CPU self-play + gate | Training |
|---|---:|---:|
| **Local** (this machine, 3 workers measured; training 1 thread) | **~15 h** | **~8.4 h** (v2-sized) to ~85 h (10× net) |
| Cloud, 64 physical cores (AWS c7a.16xlarge) | **~0.7 h** | — |
| Cloud, 48 dedicated vCPU (Hetzner CCX63; assume 0.6 of a core per vCPU [EST]) | **~1.6 h** | — |
| Cloud, 96-core host with a GPU (Vast.ai, Threadripper PRO 7995WX + RTX 3090) | **~0.5 h** | **~0.25 h** on its GPU |
| Cloud GPU (one RTX 4090 / L4 / A10 class) | — | **~0.25 h** [EST] |
| **With the N3 speed pass, 2× / 4× engine** (Amdahl on the ~80% of a playout that is `battleTurn`) | **× 0.60 / × 0.40** | unchanged |

**Why this GPU class.** v2 is 0.11 M parameters and a v3 of a few million fits in a fraction of any 24 GB card; at
this size the GPU finishes a generation's training in minutes and then idles, so the cheapest marketplace RTX 4090
(or an L4 / A10 in a data centre) is enough. A bigger card buys nothing until the net is two orders larger. **The CPU
side is the bill**: a generation is ~45 worker-hours of Node and ~0.25 GPU-hours.

**Cost [prices as fetched 2026-10-01 04:44–04:51 UTC, USD, on-demand, before tax; receipt
`solver/results/2026-10-01-plan-revision/prices.json`].** A "first useful net" is the N7 exit (two accepted
generations and the SPRT pass over the pipeline); it needs **10 / 30 / 100 generations (low / likely / high) [EST]**:
MACHAMP accepted 1 generation of 5 (1.8.0), and three refits this week did not improve the human half.

| Option (price, URL) | per generation | first net: low / likely / high | with a 2× / 4× engine (likely) |
|---|---:|---:|---:|
| **CPU** — this machine | $0, ~15 h wall | $0; ~6 / ~19 / ~62 days of continuous running | ~11 / ~7 days |
| **CPU** — AWS c7a.16xlarge, 64 vCPU, $3.28448/h ([aws.amazon.com/ec2/pricing/on-demand](https://aws.amazon.com/ec2/pricing/on-demand/)) | $2.30 | $23 / $69 / $230 | $41 / $28 |
| **CPU** — Hetzner CCX63, 48 dedicated vCPU, $1.6138/h + IPv4 $0.0010/h ([hetzner.com/cloud](https://www.hetzner.com/cloud/general-purpose)) | $2.51 ($1.51 if a vCPU = a core) | $25 / $75 / $251 ($15 / $45 / $151) | $45 / $30 |
| **CPU + GPU** — Vast.ai 7995WX host (192 threads) + RTX 3090, $0.9363/h, one listing ([vast.ai/pricing](https://vast.ai/pricing)) | $0.44 | $4 / $13 / $44 | $8 / $5 |
| **CPU** — Vast.ai, median verified ≥ 64-thread host, $0.0125/thread-h (2 threads a worker) | $1.12 | $11 / $34 / $112 | $20 / $13 |
| **GPU** — RunPod RTX 4090, $0.34/h community, $0.74/h secure ([runpod.io/pricing](https://www.runpod.io/pricing)) | $0.09 / $0.19 | $0.85 / $2.55 / $8.50 (secure $1.85 / $5.55 / $18.50) | unchanged |
| **GPU** — Vast.ai RTX 4090, median $0.47/h of 57 verified offers (min $0.33) | $0.12 | $1.17 / $3.52 / $11.75 | unchanged |
| **GPU** — Lambda A10 24 GB, $1.29/h (no RTX 4090 listed) ([lambda.ai/service/gpu-cloud](https://lambda.ai/service/gpu-cloud)) | $0.32 | $3.23 / $9.68 / $32.25 | unchanged |

**What self-play needs on a rented box.** Node 24 (this machine runs v24.15.0); the repo at the run's commit; the frozen
release `data/releases/<id>/` (9.2 MB for `eaa5becc54eb`); `data/team-pool-frozen-regmc` (239 MB on disk); the Reg M-C
Showdown checkout that `solver/human/dex.js` loads through `SHOWDOWN_PATH` (`pokemon-showdown-mc`, 255 MB on disk); the net files; Python with a CUDA PyTorch
on the learner. **Data out** is small: self-play shards are ~35 MB per 10,000 games gzipped (`p2v1-c1`, 3 shards).
**Setup cost** [EST]: building one image and a dry-run generation at small scale, ~1–2 instance-hours, plus the
engineering below. **Untested, and N8's exit test:** MEDICHAM has only ever run on this Windows machine. A Linux
worker must be shown board-identical on a seeded sample before any of its games count, `tools/lownode.cmd` has no
Linux equivalent yet (`nice` is the analogue), and a flag that carries a Windows path (`data\\team-pool-frozen-regmc`)
must be portable. **What is not priced:** storage, egress, idle time between generations, spot or reserved discounts,
and the engineering hours.

---

## 7. Where the solver fits in the project — **PROPOSED, needs Will's OK**

These change `docs/DIVISIONS.md` and `CLAUDE.md`, so none of them is applied.

| Item | Proposal |
|---|---|
| **Division** | A new **SOLVER** division. It owns `solver/` and every model in §2 except MEDICHAM. Agent file `.claude/agents/solver.md` |
| **Graph** | `MEDICHAM (frozen release) ──► SOLVER ──► ladder`. It stays one-way: SOLVER never edits `engine/` and files engine bugs to ENGINE |
| **Restrictions** | SOLVER reads frozen releases only, never HEAD. **A ladder launch needs Will's OK** (it spends a real rating) |
| **Old divisions** | SEARCH (`miltank.js`) and the MAG seam are superseded when their replacements land. OPS keeps the store and ingest, and hands the live bot to SOLVER. **Will decides** (§9 Q2) |
| **Ledger** | `docs/SOLVER.md`, stamped by `status.js --write` like the other five. No PDF |
| **Version line** | `abra/solver`, with `CHANGELOG-SOLVER.md`, mirroring `abra/regmc` / `CHANGELOG-REGMC.md` (`docs/REGMC.md:4`). 0.x until ALAKAZAM clears M4, then 1.0.0 |
| **Running notes** | One entry per change in `CHANGELOG-REGMC.md`, with its `### Record` section, as for any other change (since 2026-10-01; `docs/RUNNING-NOTES.md` and `solver/LOG.md` are frozen archives). The working detail goes in `docs/SOLVER.md` and `docs/_reports/` |
| **Quarantine** | Every SOLVER figure that reads MEDICHAM waits for the Reg M-C gate. The store-only pieces (the human dataset, MAG v0, GURU v0) do not |
| **White paper story** | A new part, "From simulator to player": the Reg M-B models were retired rather than repaired; the rebuild runs on a verified simulator; every model has a pre-registered test and a named baseline; the headline is a settled ladder rating ± SD with the series count, never a peak |

---

## 8. Archive plan

**Rule.** An old implementation moves to the archive **in the commit where its replacement passes its
exit test**, not before. Each archived file gets a header naming its replacement and any figures it
retracts, the same as `docs/archive/`. Git history stays as it is; moving a file recovers no bytes and
loses nothing.

| Old (read from `engine/`, `data/`) | Replaced by | Archive when |
|---|---|---|
| `magnemite.js`, `data/policy-weights*.json` | MAG v1 + DODUO | M1 exit |
| `mag_bot.js` | the live client | M3 exit |
| `miltank.js`, `rollout_leaf.js`, `paired_h2h.js` | MILTANK | M2 exit |
| `slowking/`, `slowking.py`, `slowking_preview.py` | SLOWKING (turn) / CHOMP (preview) | M2 / M4 exit |
| `xatu.py`, `xatu_belief.py`, `xatu_context.py` | XATU | M1 exit |
| `pory.py`, `pory_nn.py`, `pory_baseline.py`, `porygon2.py`, `porygon2_separation_gate.py`, `board.js`, `position_features.js` | PORYGON2 | M5 exit |
| `mew.js`, `mew_farm.js` | MEW | M5 exit |
| `exploit.js`, `exploit_step_probe.js` | WOBBUFFET | M6 exit |
| `dusk_size_gate.js` | DUSK | M6 exit |
| `jolteon.py`, `data/jolteon-weights.json`, `chomp_ev.js`, `chomp-predict.js` | CHOMP (JOLTEON only as its optional pre-screen) | M4 exit |
| `guru.py`, `data/guru*.json` | GURU | now (v0 exists). Will's call |
| `ditto.js`, `ditto.py` | DITTO | M8 exit |
| `kadabra.js`, `docs/KADABRA-coach-spec.md` | KADABRA | M8 exit |

**Dated update, 2026-10-01.** The same rule covers the new solver models the net subsumes: MAG's scoring role,
DODUO, GARY and XATU's action likelihood move to `archive/` in the commit where the net passes its SPRT against the
pipeline champion (§3 N7) — not when v3 is designed, and not when it first trains.

**Two hazards to check first:**
- `board.js` and others are in `engine/engine_release.js` `SOURCES`. Moving one strands every release
  that names it. Run `engine_release.js compat` before archiving.
- Tests that pin old models: archive them with the model. Never leave a red one behind. Will holds the
  waivers.

---

## 9. Open questions for Will

| # | Question |
|---|---|
| Q1 | **Name the live client.** (MAG and MAGNEMITE are the same model, so MAGNEMITE is taken.) |
| Q2 | Approve §7: a SOLVER division, the `abra/solver` line + `CHANGELOG-SOLVER.md`, `docs/SOLVER.md`? Do SEARCH and the live-bot half of OPS retire into it? |
| Q3 | Who messages the Showdown admin, and when? The research also suggested "bot" in the name and profile. `medicham32` does not have it. Keep it anyway? |
| Q4 | The ladder team: one fixed team or a small rotation until DITTO exists? Who picks it? |
| Q5 | The starting exploit cap: ε = 0.5–1 win-prob point per decision [EST, `…humans-and-ladder.md` §1.3]. OK? |
| Q6 | Ladder hours and a daily series cap, so it never overlaps your own play. |
| Q7 | Install PyTorch (CPU) for PORYGON2 and JOLTEON, or stay numpy-only? |
| Q8 | Use the Reg M-B open-sheet corpus as pre-training only, labelled as a different regulation? |
| Q9 | The two-account lock: a lock file on this machine is enough if you ladder only from here. Do you ladder from other devices? |
| Q10 | The archive location: `engine/archive/` + `data/archive/`, or a top-level `archive/`? |

**Answers so far (Will, 2026-09-24).**
- Q4: no single fixed team. A team that's flawed would drag the win rate down on its own, so use a small rotation of real top ladder teams from GURU's set library (3–5 of them), randomised per series. Compare versions only on the same team mix.
- Q6: no daily cap; it can play most of the day. The two-account lock still applies.
- Q2: yes. Search is the core of the plan and is not going away; the SEARCH division is renamed SOLVER and takes on the nets and the live client. OPS keeps ingest and the store.
- Q1: the live client is **ROTOM** (checked legal in Reg M-C).
- The rest follow the coordinator's picks: Q3 keep `medicham32`, disclosed to staff by Will; Q5 exploit cap starts at 0.5 win-prob points per decision; Q7 install CPU PyTorch; Q8 Reg M-B open-sheet games as pre-training only, labelled; Q9 a lock file on this machine; Q10 a top-level `archive/`.

**Answers, 2026-10-01 (Will).** These supersede the 2026-09-24 answers where they overlap; those are left as written.
- **Architecture:** one learned policy+value net by self-play, searched several turns deep; PORYGON2 v3 is the net; the pipeline runs until the net wins its SPRT (§1.0, §3).
- **Compute:** decide later. Local and small first; a cloud proposal with a cost estimate only once the loop shows it can learn. Never spend without asking (§6a).
- **Q5 superseded:** no default ε cap. Best-respond to the population by rating band, in-series updates for games 2–3, equilibrium where the habit model fails its gate (§2 HYPNO dated update).
- **Q6 superseded:** standing approval for up to 20 series a day with the auto-stops; nothing beyond the cap; nothing new on an arm without an SPRT pass or Will's OK (§4).
- **MEDICHAM speed pass:** on the plan, owner ENGINE, deferred, placed before any cloud spend or scale-up (§3 N3).

**New open questions (2026-10-01).**

| # | Question |
|---|---|
| Q11 | Cloud spend: when N7 passes, which option from §6a, and what monthly ceiling? (Nothing is spent until he answers.) |
| Q12 | When does N3 (the MEDICHAM speed pass) start? It is deferred, and it gates N8. |
| Q13 | The ladder team mix for N0 and N9: the top-meta rotation (`ladder-rotation-top.json`, 1.31.0) or the default rotation? Both arms of an A/B must use the same mix (Q4). |

---

## Appendix A — sources

- `solver/LOG.md` (the state and the decisions)
- `docs/_reports/2026-09-23-solver-research-turn-search.md` (search, belief, clock, S0–S8)
- `docs/_reports/2026-09-23-solver-research-learning.md` (value net, self-play, the V/P/G/X/W/L test ladder)
- `docs/_reports/2026-09-23-solver-research-humans-and-ladder.md` (HYPNO, ladder rules, the rating-noise arithmetic)
- `docs/_reports/2026-09-23-solver-research-teams-and-meta.md` (preview 90 × 90, PSRO builder, meta)
- `docs/_reports/2026-09-23-human-dataset.md`, `-policy-prior-v0.md`, `-regmc-meta.md`, `-engine-interface-brief.md`
- `git show worktree-agent-a1ac483af93614de1:docs/_reports/2026-09-24-solver-engine-api.md`
- `docs/DIVISIONS.md`; `engine/mag_bot.js` (read only)
- Added 2026-10-01: `docs/_reports/2026-10-01-plan-revision.md` (this revision); `CHANGELOG-REGMC.md` 1.8.0, 1.16.0,
  1.17.0, 1.25.0, 1.26.0, 1.39.0–1.50.0; `docs/_reports/2026-09-30-ladder-loss-postmortem.md`,
  `-rotom-world-fixes.md`, `-arena-real-spreads.md`, `-sprt-pikl-and-v2.md`, `-porygon2-v2-train.md`,
  `-porygon2-deep-labels.md`, `-human-regularised-search.md`; `docs/_reports/2026-09-24-playout-speed.md`,
  `-engine-turn-speed.md`, `-lean-mode.md`; `solver/results/2026-10-01-plan-revision/prices.json`

## Appendix B — the value-net ladder (from `…learning.md` §8)

| Rung | Question | Must beat |
|---|---|---|
| V0 | Better than material? | count-HP logistic, paired log-loss per turn bucket, CI clear of the split-half floor |
| V1 | Does it know the engine's game? | the count-HP baseline, on MSE against MEDICHAM rollout values |
| V2 | Does it help the search? | the same search with the count-HP leaf, SPRT at equal wall-clock |
| P1 | Does search earn its cost? | the raw prior with no search |
| G1 | Is the next generation better? | the previous checkpoint |
| X | Is it exploitable? | the exploiter's win rate must not rise |
| W | Did it actually run? | counters for leaf evals served, prunes and fallbacks. A zero fails |

Turns 1–3 are always reported separately. PokaiTrainer's value net stayed optimistic early in the game
(Brier 0.22 on turns 1–3 against 0.10 from turn 8) [REPORTED].

## Appendix C — the per-turn pipeline (from `…turn-search.md` §3.1)

Team preview runs once per game, before the turn loop (Will, 2026-09-24):

```
both open sheets
 → CHOMP    90 bring/lead options per side (JOLTEON pre-screen only if PORYGON2 is too slow)
 → PORYGON2 score each cell of the 90 × 90 matrix
 → SLOWKING solve the matrix game → mixed strategy over the 90 options → sample the bring and lead
```

Then every turn:

```
request + |inactive| clock
 → XATU     worlds: back-two posterior (at most 6 once the leads are seen) × spread candidates
 → MEDICHAM legalActions per side, per world
 → MAG      v2: cut each slot's DEAD clicks (engine-proved, whatever partner and opponent do); weight SOFT ones near zero
 → DODUO    v2: cut the pairs futile only TOGETHER; score the rest; prune to k1 own / k2 opponent joints, switch + mega reserved
 → MILTANK  fill cells: clone, step with CRN dice, leaf (rollout → PORYGON2), successive halving
 → SLOWKING regret matching → σ*, v*
 → HYPNO    ε-safe response to GARY's h, with p(bucket) = p_max · n/(n+K)
 → sample from σ_play (never argmax) → log the counters
```

### The target pipeline under the 2026-10-01 plan (after N7; the pipeline above keeps playing until then)

Preview is unchanged (CHOMP v1). Then every turn:

```
request + |inactive| clock
 → XATU     worlds: back-two posterior × spread candidates; each world reweighted by the net's policy as the
            likelihood of the opponent's observed actions
 → MEDICHAM legalActions per side, per world (MAG v2's dead-click cut as a mask, only if its ablation says so)
 → THE NET  policy heads propose the candidates (self-play head for me, human head at the opponent's band for them)
 → SEARCH   several-turn public-belief search on MEDICHAM: SLOWKING at each node, the net's value at the depth
            limit, DUSK exact at small endgames
 → HYPNO    best response to the population model per trusted bucket, updated from earlier games of the series;
            σ* in every bucket that fails its gate
 → sample (never argmax) → log the counters (playouts, net evaluations, unfilled cells, fallbacks, timeouts,
            trusted buckets, deviations from σ*)
```

## Addendum — 2026-09-24 decisions (Will)
- **Reg M-B retired.** 7.0.0 stays its published record; the solver and the gate target Reg M-C only.
- **CHOMP may later ship as a standalone helper** (browser/client). It stays an *advisor* — sheets in, a
  bring/lead recommendation with win chances out — the same territory as a damage calc, which Showdown
  allows. Anything that clicks for the player stays on the disclosed bot account only.
- The official Champions game added a battle log and preview matchup hints; if the log is exportable it is a
  candidate data source and a second authority to check MEDICHAM against.
