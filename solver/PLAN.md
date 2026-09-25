# SOLVER-PLAN — the Reg M-C open-sheet ladder agent

**Version 0.2.0 · 2026-09-24 · status: PLAN (nothing here is built unless its row says "exists" or "v1 built")**

Every figure below cites the file it came from. No figure from a quarantined or withdrawn model is
used. Estimates are marked **[EST]**. Figures reported by another group and not reproduced here are
marked **[REPORTED]**. The running log is `solver/LOG.md`.

---

## 1. One-screen summary

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

| Name | Role | Input → output | Depends on | Status | The test that proves it | Must beat |
|---|---|---|---|---|---|---|
| **MEDICHAM** | Simulator + solver API | state, joint action, dice → next state; `clone`, `legalActions`, `step`, `isTerminal` | Showdown M-C checkout (the authority) | Engine exists. API is on branch `worktree-agent-a1ac483af936…`, unmerged | Reg M-C quarantine gate open; `tests/test-medicham-api.js` green in main; `probe_medicham_api_differential.js --part legal` at 0 disagreements | Showdown, at zero board divergence |
| **MAG** (= MAGNEMITE) | Per-slot action scorer: the human policy prior | public state + both sheets → scores for each slot's options | human dataset | **v1 built** (`solver/mag/`; v0 in `solver/prior/`) | P0: held-out-player joint recall and log-loss (`solver/tests/test-prior.js` 1062/1062) | species-frequency baseline. Already beaten: recall@16 83.1% vs 49.2% (`solver/prior/model/prior-v0.metrics.json`) |
| **DODUO** | Joint coordinator: makes both slots work together (focus fire, redirect-then-attack, double switches). Scores the pair as one joint action | MAG's per-slot scores + pair features → P(joint action) | MAG | **v1 built** (`solver/mag/`) | Joint recall@k on held-out players; switch-containing joints reported separately | v0 with no pair term: top-1 18.3% vs 21.3% with it (`solver/out/prior/ablation/prior-v0-nopair.metrics.json`, `prior-v0.metrics.json`) |
| **PORYGON2** | Value net | state + world → P(win) | MEDICHAM (relational facts), MEW data | **v0 built** (`solver/porygon2/`; human outcomes; engine facts PRE-GATE). V0 passed: held-out log-loss 0.517 vs count-HP 0.577 and emb-only 0.536, CIs clear (`solver/porygon2/model/porygon2-v0.metrics.json`). V2 (arena) PRE-GATE only | V0/V1/V2 ladder (App. B) | count-HP logistic `[alive_diff, hp_diff]`, then the rollout leaf in the same search |
| **SLOWKING** | Per-turn simultaneous-move solver | payoff matrix → σ_me, σ_opp, v* | MILTANK cells | **v1 built** (`solver/slowking/`) | RPS → uniform; known 2×2 → LP answer; stability bound; constructed dominant-action fixtures | greedy one-turn baseline, and MAG with no search (P1) |
| **MILTANK** | Search harness: candidates, CRN playouts, successive halving, clock budget | state, clock → filled matrix | MEDICHAM API, DODUO, XATU | **v1 built** (`solver/miltank/`; PRE-GATE) | Pruner **joint** coverage on held-out human turns (threshold set before the run); timer-ON series with 0 timeouts | uniform cell allocation at the same wall-clock |
| **XATU** | Belief over the hidden back two + spreads | sheets, reveals, turn order, damage % → posterior over worlds | MEDICHAM `dmgRange`, store | **v1 built** (`solver/xatu/`) | Back-two log-loss vs the revealed back two; in self-play the true world is never at zero | store bring frequencies; a uniform spread prior |
| **GARY** | Human habit model per situation bucket | bucket → h(joint action) | MAG/DODUO, store | To build | Per bucket, h must beat τ* on held-out log-loss, CI clear of zero | τ* (the equilibrium prediction) |
| **HYPNO** | Capped exploit dial (ε-safe LP + data-biased trust) | A, σ*, h, ε → σ_play | SLOWKING, GARY | To build | Worst case ≥ v* − ε on every logged decision; ε Pareto sweep | ε = 0 (pure equilibrium) |
| **DUSK** | Endgame tables | small late positions → exact value | MEDICHAM | To build | Exact agreement with deep search on constructed endgames | the search it replaces, at endgames |
| **MEW** | Self-play factory | release, agents, teams → stamped games | frozen MEDICHAM release | **v0 built** (`solver/mew/`): 1,721–1,943 games/hour on 4 workers, release `eaa5becc54eb` (`docs/_reports/2026-09-25-selfplay-v0.md`) | Games/hour measured; every record stamped with release id + weights digest; zero-counter check | — (infrastructure) |
| **MACHAMP** | Training loop / league | MEW games → next checkpoint | MEW, PORYGON2, MAG/DODUO | **v0 built** (`solver/machamp/`): 4 generations gated, 0 accepted. Round 1 beats-previous: 0.525, 0.520. Round 2 (full search): 0.430 (worse), 0.475 | G1: generation n+1 beats n by SPRT on the same release | the previous checkpoint |
| **WOBBUFFET** | Exploitability best-responder | frozen agent → an exploiter + its win rate | MACHAMP | To build | Finds the hole in a planted exploitable bot | exploiter win rate must not rise generation over generation |
| **CHOMP** | **Team-preview solver**, rebuilt from scratch inside ABRA under `solver/chomp/`. The old CHOMP repo runs on stale mainline data and its bring choices tested at coin level, so it is reference only (Will, 2026-09-24) | both open sheets → a mixed strategy over the 90 bring/lead options | PORYGON2 (scores the cells), SLOWKING (solves the matrix game); JOLTEON optional pre-screen | To build | Preview exploitability; H2H with the same in-battle agent on both sides | uniform, human-modal bring, greedy argmax |
| **JOLTEON** | CHOMP's **optional fast pre-screen** of the 90 × 90 preview cells. Dropped if PORYGON2 is fast enough to score every cell (Will, 2026-09-24) | my six, their six → a cheap Q(bring 4, lead 2) to prune CHOMP's matrix | PORYGON2/ALAKAZAM self-play | Optional; build only if CHOMP needs it | Pruning never drops CHOMP's support at the same wall-clock | CHOMP with no pre-screen |
| **GURU** | Meta analysis | store → usage, sets, archetypes, bring/lead, Bo3 adaptation | store only | **v0 exists (descriptive)** (`solver/meta/`) | `solver/tests/test-meta-lib.js` 29/29, `test-meta-artifacts.js` 21/21; the replicator test comes later | persistence (for usage forecasts) |
| **DITTO** | Team builder (PSRO + set library + spread optimiser) | population → teams | CHOMP, ALAKAZAM, GURU set library | To build | Rank agreement under two agent strengths (the pilot confound) | the most-used human teams, piloted by the same agent |
| **The live client** (ROTOM) | Ladder client | server protocol ↔ ALAKAZAM | ALAKAZAM | To build (§4) | Timer-ON local series: 0 timeouts, 0 bank forfeits, 0 lost series from a disconnect | `engine/mag_bot.js` behaviour, plus laddering |
| **ALAKAZAM** | The assembled agent | request → choice | everything above | To build | Offline SPRT ladder, then the ladder protocol (§5) | its previous version, on the per-series residual |
| **KADABRA** | Coach | ALAKAZAM decision logs → an explanation for Will | ALAKAZAM logs | To build | Every sentence traces to a logged decision (it may not author a number) | — |

---

## 3. Build milestones (dependency order)

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
| **Running notes** | One row per change in `docs/RUNNING-NOTES.md`, as for any other change. `solver/LOG.md` becomes the division's narrative log |
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
 → DODUO    prune to k1 own / k2 opponent joints, with switch + mega slots reserved
 → MILTANK  fill cells: clone, step with CRN dice, leaf (rollout → PORYGON2), successive halving
 → SLOWKING regret matching → σ*, v*
 → HYPNO    ε-safe response to GARY's h, with p(bucket) = p_max · n/(n+K)
 → sample from σ_play (never argmax) → log the counters
```

## Addendum — 2026-09-24 decisions (Will)
- **Reg M-B retired.** 7.0.0 stays its published record; the solver and the gate target Reg M-C only.
- **CHOMP may later ship as a standalone helper** (browser/client). It stays an *advisor* — sheets in, a
  bring/lead recommendation with win chances out — the same territory as a damage calc, which Showdown
  allows. Anything that clicks for the player stays on the disclosed bot account only.
- The official Champions game added a battle log and preview matchup hints; if the log is exportable it is a
  candidate data source and a second authority to check MEDICHAM against.
