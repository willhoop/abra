# ABRA v2 — Literature Study & Model Redesign

A hard read of the relevant field (imperfect-information game solving, the poker-AI canon, and the
Pokémon-specific literature), reconciled with what we proved empirically, and turned into a design
for **genuinely useful** models. Written 2026-07-23.

---

## 0. The empirical facts we must design around (our own results)

1. **Predicting a game's winner from team sheets is near-impossible in this format.** On 600+ held-out
   real Champions games, even **player-Elo ≈ a coin** (log-loss 0.687 vs 0.693). JOLTEON (additive
   Bradley-Terry) ties a coin; MEDICHAM's win% is *below* chance because its cloned policy is
   systematically biased (backs fast/offensive teams that lose more). → **Do not build win-predictors.**
2. **The damage layer is exact.** MEDICHAM's damage matches `@smogon/calc` within 5% on 100% of tests.
   "Will this KO?" is a *winnable* prediction. → **Build on validated damage.**
3. **The behaviour-clone has modest fidelity** (top-1 36%, top-3 72% on held-out human moves). Usable
   as an opponent prior, not as truth.
4. **The value is in decisions, not predictions.** Because sheets don't determine games, the leverage
   is in the choices — bring/lead and in-battle moves — which is exactly where skill and variance live.

Design consequence: **stop predicting outcomes; support decisions.** Everything below serves that.

---

## 1. Imperfect-information game solving — the poker-AI canon

Champions is a **two-player zero-sum imperfect-information game with simultaneous moves** (both players
choose each turn without seeing the other's choice; sets are partially hidden). This is the exact class
poker research solved. The lineage and what each contributes:

- **CFR / Counterfactual Regret Minimization** (Zinkevich et al. 2007) and **MCCFR** (Lanctot et al.
  2009): the workhorse for computing ε-Nash in extensive-form imperfect-info games by minimizing
  per-infoset regret; sampling variants make it scale. *Lesson:* the right solution concept here is a
  **mixed Nash strategy**, not a single "best" line — which is precisely why a greedy best-response
  engine (old MEDICHAM/DITTO) develops a directional bias.
- **DeepStack** (Moravčík et al., *Science* 2017): **continual re-solving** with **depth-limited search**
  and a **counterfactual value network** at the leaves — solve only the subgame you're in, using a
  learned value function instead of searching to the end. *Lesson:* we can't search a 20-turn doubles
  game to terminal; we do **depth-limited search with a learned/validated leaf evaluator.**
- **Libratus** (Brown & Sandholm, *Science* 2018): **nested safe subgame solving** + self-improvement.
  Beat top human pros at heads-up no-limit. *Lesson:* re-solve subgames *safely* (don't become
  exploitable by re-solving); track the opponent's range.
- **ReBeL — Recursive Belief-based Learning** (Brown et al., NeurIPS 2020): unifies RL + search over
  **Public Belief States (PBS)** — the state is the common-knowledge distribution over hidden info; a
  value/policy net trained by self-play guides depth-limited search over PBS. Provably converges to Nash
  in 2p0s. *Lesson:* **this is the target architecture for ALAKAZAM** — track a public belief over the
  opponent's hidden sets, search a few turns over that belief, use a learned value at the leaf.
- **Player of Games** (Schmid et al. 2021) & **Student of Games** (2023): one algorithm (growing-tree
  CFR + search + learned values) that is sound across *both* perfect- and imperfect-info games. *Lesson:*
  a single principled search stack can cover team-preview (SLOWKING) and in-battle (ALAKAZAM).
- **Simultaneous-move games:** each Champions turn is a **matrix game** solved by **regret matching /
  LP** to a mixed equilibrium. We already have this (`engine/slowking/nash.py`, RPS-verified). *Lesson:*
  solve each turn as a stage game; this removes the speed-bias inversion that greedy selection caused.

**Net:** the poker canon says build a **belief-state, depth-limited search with a learned leaf, solving
each simultaneous turn as a matrix game.** That is ALAKAZAM. It never predicts "who wins the game" — it
outputs the equilibrium move and its value *at the current position*, which is the tractable question.

---

## 2. The Pokémon-specific state of the art (2024–2025) — this is the key section

The field moved fast and it directly informs us:

- **VGC-Bench** (Angliss et al., arXiv 2506.10326, June 2025) — the benchmark closest to us: **doubles
  VGC**, a **700k+ human-battle-log** dataset, and baselines spanning **heuristics, LLMs, behaviour
  cloning, and multi-agent RL with empirical game-theoretic methods (self-play, fictitious play,
  double-oracle / PSRO).** Findings that matter: the VGC configuration space is ~**10^139** (larger than
  chess/Go/poker/StarCraft/Dota); in a **single-team mirror** setting RL can **beat a pro**, but as team
  diversity grows the best single-team method **generalizes worse and is more exploitable** — the
  central tension is **exploitability vs generalization across teams.** *Lesson:* the **PSRO /
  double-oracle** framing (grow a population, best-respond, re-solve the meta-Nash) is the credible path
  for the *strategic* layer (SLOWKING), and single-team specialists are strong but brittle.
- **Metamon** (UT-Austin-RPL, "Human-Level Competitive Pokémon via Scalable Offline RL with
  Transformers," arXiv 2504.04395, RLC 2025): **offline RL on 5M+ reconstructed human trajectories +
  20M+ self-play**, a **black-box sequence model that adapts to the opponent from the trajectory with
  NO explicit search**, reaching **top-10% of active human players** — and **outperforming the LLM agent
  and a strong heuristic search engine.** *Lesson:* **you may not need search at all.** A large
  imitation/offline-RL sequence model trained on human replays + self-play is the current SOTA and it
  fits *our data pipeline exactly* (we already collect replays daily).
- **PokéChamp** (2025): a strong open-source battler; with Metamon, both are baselines for the
  **PokéAgent Challenge (NeurIPS 2025)** — an active competition on exactly this problem.
- **PokéLLMon** (Hu et al. 2024): first LLM agent at human parity in singles, via state→text prompting +
  **retrieval-augmented generation** from a knowledge DB. *Lesson:* LLMs are viable but Metamon shows
  trained policies beat them; RAG-of-knowledge is a useful *explanation* layer, not the core.

**The decisive takeaway:** the two credible architectures are (A) **belief-state search** (ReBeL, our
SLOWKING chassis) and (B) **offline-RL/imitation sequence models on human + self-play data** (Metamon).
Metamon shows (B) already reaches top-10% *without search*. We have the **data** (replays) for (B) and
the **validated simulator** for (A). The genuinely useful design **combines them.**

---

## 3. Non-transitivity & rating (for any descriptive layer)

Our meta is rock-paper-scissors; an additive model *cannot* represent it (that's JOLTEON's proven flaw).
If we keep any team-rating, use an **intransitivity-capable class**: **blade-chest / low-rank bilinear**
(Chen & Joachims, "Modeling Intransitivity in Matchup and Comparison Data," WSDM 2016) or **disc /
Nash-averaging** (Balduzzi et al., "Re-evaluating Evaluation," NeurIPS 2018 — evaluate agents by their
support in the Nash of the payoff matrix, which is robust to redundant/cyclic strategies). *Lesson:*
rate teams by **Nash-averaging over the matchup matrix**, not a scalar Elo — and present it as
structure (the cycles), not a false #1.

---

## 4. The v2 model family — pivot, don't retire

Almost nothing is thrown away; the pieces become **components of a decision stack.** Shared foundation:
the **validated damage engine** + an **opponent belief model** + a **learned value/policy net trained on
our replays + self-play.**

| v1 model | v2 fate | what it becomes |
|---|---|---|
| **Damage engine** (MEDICHAM's core) | **KEEP — the foundation** | validated simulator + fast leaf evaluator for search; powers everything |
| **CHOMP** (bring-4/lead-2) | **PIVOT + prove** | frame bring/lead as a **matrix game** (minimax over a *belief* of opponent sets), emit expected-value + a calibrated edge; **backtest that CHOMP's brings beat humans'** (a winnable test) |
| **JOLTEON** (win-predictor) | **RETIRE as predictor** | demoted to a fast **candidate shortlister / usage prior** only; no win-% claims |
| **MEDICHAM win%** | **PIVOT** | not an oracle; a **de-biased matchup value** (solve the stage game, don't greedily best-respond) used *inside* search, never shown as P(win-the-game) |
| **DITTO** (team optimizer) | **PIVOT** | from "maximize the (backwards) win%" to **PSRO/double-oracle team-building**: grow a population, best-respond to the meta-Nash, using **coverage + validated damage** as the objective |
| **SLOWKING** | **BUILD (outer game)** | team-preview **Nash**: bring/lead mixed strategy + equilibrium value, via matrix-game solve over the belief |
| **KADABRA → ALAKAZAM** | **BUILD (inner game, final boss)** | the ReBeL-shaped in-battle engine (below) |

### ALAKAZAM — the final boss (honest definition)
Given a **live position**, output the **win-%-optimal move and its value**, by:
1. **Belief:** maintain a distribution over the opponent's hidden sets/next move (Bayesian filter updated
   by observed moves + observed damage; seeded by usage priors — our behaviour-clone). This is the PBS.
2. **Search:** depth-limited lookahead over the **validated damage engine**, solving **each turn as a
   matrix game** (regret matching) rather than a single best line (kills strategy fusion + the speed
   bias).
3. **Leaf value:** a **learned value net trained on our replays + self-play** (the Metamon lesson) — or,
   as a fast v1, the current HP-based value net.
4. **Output:** the equilibrium move mix, the expected win-% *delta* of each option, and a plain-English
   reason (RAG-of-knowledge, PokéLLMon-style) — this is the coach KADABRA always wanted to be.

What ALAKAZAM **predicts** (all tractable, unlike game-winner): the opponent's likely move, whether a
line KOs, and the value of each decision. It does **not** claim to predict who wins the match from preview.

### The pragmatic build order (data-first, per Metamon)
Because Metamon shows a trained policy reaches top-10% *without* search, the fastest path to *useful* is:
- **Phase 1 (learning, uses our data now):** train an **imitation / offline-RL policy + value** on the
  replays we already collect (grow with the daily pull + self-play). Evaluate by **top-k move-match and
  action-value**, and by **ladder/self-play win-rate vs the behaviour-clone and heuristic baselines** —
  proper metrics, CIs, honest baselines. This alone is a genuinely useful in-battle assistant.
- **Phase 2 (search refinement):** wrap the learned value in **depth-limited matrix-game search** over
  the validated engine for tactical exactness (guaranteed-KO lines, Protect/Wide Guard reads) — the
  ReBeL layer. Measure the lift over Phase 1; keep it only if it earns its cost.
- **Phase 3 (strategic):** SLOWKING team-preview Nash + PSRO team-building (DITTO pivot), evaluated by
  exploitability and head-to-head vs the meta.

Every phase ships an honest metric with a CI and a baseline (the review's bar), persisted to JSON, run in CI.

---

## 5. Honest risks & ceilings (so we don't over-promise again)

- **The game-winner ceiling is real and permanent** (Elo ≈ coin). ALAKAZAM/SLOWKING are judged on
  **decision quality and self-play/ladder win-rate**, never on match-outcome prediction.
- **Simulator fidelity is the GIGO risk for the search path.** Our damage is validated; the *policy* and
  *engine coverage* (all abilities/moves) are not fully. The learning path (Phase 1) partly sidesteps
  this by learning from real outcomes rather than simulating them.
- **Compute:** search is heavy — belongs in a **Web Worker / WASM / small backend**, not the main
  thread (the DITTO freeze lesson). The learned policy is cheap at inference — another reason to lead
  with Phase 1.
- **Exploitability vs generalization** (VGC-Bench): specialists beat generalists but are brittle; PSRO
  balances this for the strategic layer.

---

## 5b. Cross-domain inspiration — other games & fields that solved pieces of our problem

Widening the lens beyond poker/Pokémon; each of these cracked something we need.

- **Stratego → DeepNash / R-NaD** (DeepMind, *Science* 2022): expert play on a game with **hidden piece
  identities** (our hidden sets) and a 10^535 tree, **model-free, NO search**, via **Regularized Nash
  Dynamics** that converges to a robust ε-Nash instead of cycling. *Lesson:* we may not need a perfect
  simulator+search for ALAKAZAM — an **R-NaD self-play policy** can be robustly unexploitable on its own.
  Strong evidence for the learning-first (Phase 1) path, and R-NaD specifically handles hidden info.
- **StarCraft II → AlphaStar** (DeepMind 2019): grandmaster via a **league** (PSRO-like) — a growing
  pool of agents, best-responses, and a **Nash mixture** to stay robust; and crucially **"scouting"** =
  actively spending actions to *reduce belief uncertainty*. *Lessons:* (1) build the strategic layer
  (SLOWKING/DITTO) as a **league / PSRO with Nash-mixture selection** (also VGC-Bench's recommendation);
  (2) **information-gathering has value** — ALAKAZAM should reward moves that reveal the opponent's set
  (Protect to scout, forcing reveals), not just immediate damage.
- **Diplomacy → CICERO / piKL** (Meta, *Science* 2022): tournament-winning play by **human-regularized
  RL** — maximize expected value **while staying KL-close to a behaviour-clone "anchor" policy.** Pure RL
  drifts into weird, exploitable, non-human lines; anchoring to human data keeps it strong *and*
  human-realistic. *Lesson (important):* **ALAKAZAM should be EV-maximizing but KL-anchored to our
  behaviour-clone.** This is likely the direct cure for MEDICHAM's inversion — the greedy, un-anchored
  best-response drifted into a biased corner; a piKL-style anchor keeps the policy near real play.
- **Sports analytics → xG / EPV / EPA / WPA:** an entire mature field that abandoned predicting rare,
  noisy **outcomes** in favor of **expected-value of decisions** — expected goals (shot quality),
  expected possession value, expected points added. xG is *more consistent than actual goals* precisely
  because it smooths variance. *Lesson (framing):* this is our thesis, validated by a real discipline.
  **CHOMP = "xG for team preview"** (expected value of a bring), **ALAKAZAM = "EPV per move."** Judge and
  present everything as expected value with calibration, never as an outcome oracle — and it's a great
  public analogy for why "can't predict the winner" ≠ "useless."
- **Fighting games / RPS mind-games:** simultaneous-move mixups where the *only* unexploitable play is a
  **mixed strategy** — being deterministic is being exploitable. *Lesson:* per-turn decisions (Protect
  vs attack vs switch) must be **mixed** (regret matching), and "predictability" is itself a measurable
  weakness we can coach.
- **Card-game drafting (MTG / Hearthstone):** the origin of the word **"metagame"** and of non-transitive
  deck-matchup matrices; drafting is sequential expected-value under uncertainty. *Lesson:* DITTO's
  team-building is a **draft/EV** problem, and the meta is rated by **Nash-averaging**, not a scalar.
- **Chess engines → NNUE** (efficiently-updatable neural evaluation): a small, fast, incrementally-updated
  neural leaf-eval that made search dramatically stronger. *Lesson:* the ALAKAZAM **leaf value net**
  should be small and fast (updatable as HP/board changes), so search stays cheap.
- **Quant finance / betting → Kelly & calibration:** you can't predict one event, but a **calibrated
  edge** compounded with proper **bet-sizing (Kelly)** wins long-run. *Lesson:* CHOMP/ALAKAZAM should
  emit a **calibrated edge**, and confidence must be honest (reliability-tested), not theatrical.

**Synthesis of the cross-domain read:** the convergent recipe across Stratego, StarCraft, Diplomacy, and
poker is — **learn a policy/value by self-play from human data, keep it near human play (KL-anchor),
select strategies by a Nash mixture for robustness, and (optionally) add depth-limited search for
tactical exactness.** And sports analytics tells us how to *evaluate and present* it: expected value,
calibrated, never outcome-prediction. That is exactly ALAKAZAM (inner) + SLOWKING (outer).

## 6. One-paragraph thesis

Stop predicting who wins — that's the format's irreducible ceiling and even Elo can't beat it. Build a
**decision stack** on the one thing we validated (exact damage): a learned in-battle policy/value from
our own human + self-play replays (Metamon-style, the current SOTA), refined by belief-state
depth-limited matrix-game search (ReBeL-style) for tactical exactness, with a team-preview Nash and
PSRO team-builder on top. That is ALAKAZAM (inner game) and SLOWKING (outer game), and every claim is
judged by decision quality and self-play win-rate with CIs and baselines — not by an impossible oracle.

---

## Sources
- VGC-Bench — https://arxiv.org/abs/2506.10326 · code https://github.com/cameronangliss/vgc-bench
- Metamon (Human-Level Competitive Pokémon via Offline RL + Transformers) — https://arxiv.org/abs/2504.04395 · https://metamon.tech/ · https://github.com/UT-Austin-RPL/metamon
- PokéAgent Challenge (NeurIPS 2025) — https://pokeagent.github.io/track1.html
- PokéLLMon — https://poke-llm-on.github.io/
- ReBeL (Brown et al. 2020) — recursive belief-based learning (RL+search over public belief states)
- DeepStack (Moravčík et al. 2017) · Libratus (Brown & Sandholm 2018) · Player of Games (Schmid et al. 2021)
- CFR (Zinkevich 2007) · MCCFR (Lanctot 2009)
- Chen & Joachims, Modeling Intransitivity (WSDM 2016) · Balduzzi et al., Re-evaluating Evaluation (NeurIPS 2018)
- DeepNash / R-NaD (Stratego, Science 2022) — https://arxiv.org/abs/2206.15378
- AlphaStar (StarCraft II, league/PSRO) — https://deepmind.google/blog/alphastar-mastering-the-real-time-strategy-game-starcraft-ii/
- Pipeline PSRO — https://arxiv.org/abs/2006.08555
- CICERO / piKL (Diplomacy, human-regularized RL) — https://arxiv.org/abs/2210.05492 · KL-regularized search https://arxiv.org/abs/2112.07544
- Search in Imperfect Information Games (survey) — https://arxiv.org/abs/2111.05884
- Sports analytics methodology (expected-value over outcomes) — https://link.springer.com/article/10.1007/s10994-024-06585-0
