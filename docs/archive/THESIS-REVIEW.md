# Committee Review — "ABRA: A Live-Data Model Family for Pokémon Champions VGC"

**Reviewer:** Chair, Department of Statistics (acting as external examiner)
**Verdict:** *Major revisions. The engineering is impressive; the statistics are not yet defensible. Two of the five models are, as currently formulated, unsound and should be rebuilt rather than patched. The candidate has confused "a number that comes out" with "a number that means something." Below is what I would say across the table at the defense.*

---

## 0. The one sentence that should worry you

Nowhere in this project does a single probability get evaluated with a **proper scoring rule**, reported with a **confidence interval**, or compared against an **honest baseline**. You are shipping point estimates of probabilities to users as if they were exact. That is the cardinal sin, and it is committed by every model here. Everything else is detail.

Proper scoring rules (log-loss, Brier) are the *minimum* standard for evaluating probabilistic forecasts; accuracy is not a proper scoring rule and rewards overconfidence ([Brier score](https://en.wikipedia.org/wiki/Brier_score); [superior scoring rules survey](https://arxiv.org/abs/2407.17697)). Until every model reports calibration and sharpness, "56% accurate" tells me nothing about whether the numbers on the website are trustworthy.

---

## 1. JOLTEON — the win-probability model

**What it is:** a Bradley-Terry-style logistic on team composition: team strength = Σ per-species learned abilities `w`, plus hand-set speed, "firepower," and (as of tonight) a type-coverage term, pushed through a sigmoid.

### The fatal flaw: additivity cannot represent the metagame

VGC is defined by **non-transitivity** — rain beats sun beats Trick Room beats hyperoffense beats rain. A model whose output is a **monotone function of a sum of per-species scalars imposes a total order on teams**, and a total order provably cannot contain a 3-cycle (A>B>C>A). You have built a device that is structurally incapable of representing the single most important feature of the domain it models. This is not a tuning problem; it is a model-class problem.

The right literature is the non-transitive-rating line: Balduzzi et al.'s *Nash averaging / "Re-evaluating Evaluation,"* and Chen & Joachims on modeling intransitivity. The fix is a **low-rank antisymmetric interaction term**: strength(A vs B) = f(A) − f(B) + ⟨u(A), v(B)⟩ − ⟨u(B), v(A)⟩, where the bilinear part captures cyclic matchup structure that the additive part cannot. Standard Bradley-Terry is the special case where that term is zero — and you have assumed it away.

### Secondary sins
- **The coverage coefficient (0.55) and the recency half-life (τ=30d) and the rarity constant (K=300) are hand-set.** Three free parameters pulled from the air, none learned, none cross-validated. A committee will ask "why 0.55?" and "how sensitive is anything to it?" and you have no answer.
- **Independence is violated.** Bradley-Terry assumes independent comparisons; ladder games share players, teams recur, ratings drift ([BT limitations](https://arxiv.org/pdf/1701.08055)). Your L2 "shrinkage" is not a hierarchical prior — it is a regularizer you are interpreting as if it were Bayesian. Either write down the actual hierarchical model (species abilities ~ N(0, τ²), τ estimated) or stop using Bayesian language.
- **~55–56% held-out accuracy is not obviously above baseline.** The higher-*rated player* already wins ~55% (your own predictability finding). So is JOLTEON adding information beyond a player-rating prior, or is it laundering it? You must show JOLTEON beats: (i) a coin flip, (ii) a usage-only prior, (iii) the player-Elo model — on **log-loss**, not accuracy. If it does not beat the Elo baseline in log-loss, it is not a team model, it is a worse thermometer.

**Disposition: keep as a fast baseline, but demote its claims.** Rebuild the scoring model with an interaction term if you want it to be a *model* rather than a ranking. Non-negotiable: report log-loss, Brier, and a reliability diagram against the three baselines.

---

## 2. MEDICHAM — the rollout model

You rewrote this tonight from a 1-v-1 chain (which collapsed to 0%/100% — good that it's gone) to a real doubles rollout. Better. Still not defensible as-is.

### The policy is the ceiling, and the ceiling is biased
A rollout estimates the expected outcome **under the rollout policy**, full stop. Your policy is a greedy/behavior-clone hybrid. Two consequences the committee will hammer:

1. **Behavior cloning has compounding error / covariate shift.** The clone's move frequencies were fit on states from real games, but the rollout wanders into off-distribution states where the clone is undefined, and error scales *quadratically* in the horizon in the worst case ([three regimes of covariate shift](https://arxiv.org/pdf/2102.02872); DAgger). Precisely in the deep, weird board states that decide games, your policy is least reliable. So your win rate is most wrong exactly where it matters most.
2. **The estimate inherits the policy's blind spots.** Your clone can't wield disruption well, so it **systematically over-credits speed-control cores** (Tailwind runaways). That is a bias, not noise — averaging more rollouts will not remove it.

### The engine is unvalidated
The damage formula is hand-reimplemented and **has never been checked against the reference** `@smogon/calc` or the real sim. Rounding order is approximated; most moves default to 100% accuracy; redirection, terrain, most items/abilities, and ally-hit spread are missing. Every one is a bias of unknown sign and size. You cannot call a rollout "grounded" when its ground is unverified.

### No Monte Carlo error
400 rollouts gives a standard error near ±2.5%. You display "38%" as if it were exact. Show the interval.

**Disposition: scrap the hand-rolled engine as the source of truth.** You have the open-source Showdown Champions engine — *use it.* Make it the scorer; validate the browser approximation against it and label the browser version as an approximation with a stated error band. For the policy, either (a) a shallow search (ISMCTS handles simultaneous moves — see the Hannan-consistent SM-MCTS work, [arXiv 1804.09045](https://arxiv.org/pdf/1804.09045)) or (b) DAgger-correct the clone against the real engine. And print a confidence interval every time.

---

## 3. DITTO — the team optimizer

This is the one that would end a defense badly, because it is **mis-named in a way that reveals a conceptual gap.**

### It is not a double oracle
DITTO is coordinate-ascent hill-climbing over species, scored by a fixed usage-weighted gauntlet, with a MEDICHAM re-check. **Double oracle / PSRO is a specific thing**: you maintain a population, build the empirical payoff matrix, solve for a **meta-Nash equilibrium**, and best-respond *to that equilibrium*, iterating ([PSRO / Lanctot et al.](https://arxiv.org/pdf/1711.00832); [Team PSRO](https://arxiv.org/pdf/2207.06541)). DITTO does none of this. There is no opponent best-response, no equilibrium, no population. Calling greedy ascent "Double-oracle Iterative Team-Tuning" will get you asked to define double oracle at the board, and the acronym will unravel.

### It optimizes against a surrogate it can fool — by construction
You optimize a team against **JOLTEON** (Section 1: structurally flawed), then re-check with **MEDICHAM** (Section 2: biased). This is textbook Goodhart: maximize a proxy and you maximize proxy error. Your own logs show JOLTEON 90% / MEDICHAM 12% disagreements — that is not a feature you should celebrate, it is your optimizer walking straight into the surrogate's blind spot. The re-check catches *some* of it, but you are re-checking with a second flawed instrument.

### The field doesn't fight back
Team-building is a **game**: your best team depends on the field, which reacts to what wins. Optimizing against a *static* usage-weighted sample of random 4-mon draws overfits to a meta snapshot and ignores the adversary. Plus you score 6-vs-4 (size bias, flagged in your own code), the gauntlet "teams" are random draws not real teams, hill-climbing has no restarts (local optima), and the item pass runs 90 rollouts per candidate (SE enormous) over only two items the engine even models.

**Disposition: rebuild.** If you want the name, earn it — real double oracle with real-engine payoffs and a meta-Nash solve, reporting the equilibrium *mixture* of teams, not a single "best team" (there usually isn't one in a cyclic meta). If that's too heavy for v1, then at minimum: score with the real engine, make the opponent adaptive (best-respond to your candidate), and stop using the words "double oracle."

---

## 4. The predictability study — "how often does the better play win?"

The finding is interesting. The validation is **circular**, and I will not let it pass.

You observe the higher-rated player wins ~55%, observe JOLTEON predicts at ~55%, and conclude "so we got it right." **No.** Matching a *marginal* win rate is not evidence of correct *conditional* prediction. Two forecasters can both average 55% while one is perfectly calibrated and the other is pure noise with the right mean. This is a base-rate fallacy dressed as validation. The only way to substantiate "we predict as well as the skill gap allows" is a **per-game proper-scoring comparison with calibration**, against the player-rating model — not aligning two averages.

Do it properly: the "how often does the best team win" literature ([Lopez, Matthews, Baumer](https://arxiv.org/pdf/1701.05976)) decomposes skill vs. luck with an explicit Bayesian/regression model and gives the randomness of each sport a standard error. Replicate that framework for Champions; report the skill/luck split with intervals. Also verify the ratings are the **pre-game** values (using post-game rating is leakage that would silently inflate everything).

---

## 5. SLOWKING and CHOMP — briefly

- **SLOWKING:** an honest scaffold plus a literature-aware whitepaper invoking ReBeL / Player-of-Games belief search over the (correctly, now-known-to-be-open) engine. Fine *as a proposal.* There is no working solver, so do not let the website imply there is one. "Promising thesis chapter 3," not "result."
- **CHOMP/ORB:** a decision tool (bring-4/lead-2 by exact damage). Reasonable utility, but it takes a **max over your brings against a static opponent** — that is not a game solution, it is a best response to a dummy. Bring selection under a simultaneously-choosing opponent is a matrix game; solve the small minimax, don't greedily maximize coverage. And "exact damage" is only as exact as the unvalidated engine (Section 2).

---

## 6. Cross-cutting deficiencies (fix these regardless of model)

1. **No proper scoring, anywhere.** Log-loss + Brier + reliability diagrams, or it doesn't ship.
2. **No confidence intervals, anywhere.** Every rollout %, every win rate, every "team rating" needs a bootstrap or MC interval. Stop rendering probabilities as if exact.
3. **No baselines.** Coin flip, usage prior, player-Elo. A model that can't beat these is not a model.
4. **Ground truth unused.** The real engine exists; validate against it. This dissolves half the objections in Sections 2–3.
5. **Data provenance.** Ladder self-selection (uploaders), dedup, and open-sheet-regime mixing all threaten the "real data" claim. Document the sampling frame and its biases, or caveat every population number.

---

## 7. Prioritized remediation plan (what I'd tell the candidate to do, in order)

1. **Evaluation harness first (cheap, decisive).** Held-out log-loss / Brier / reliability for JOLTEON vs. {coin, usage, Elo} with bootstrap CIs. This tells you which models are real before you spend another night on them. *(Starting tonight — see `engine/eval_harness.py`.)*
2. **Ground truth.** Finish `sim/` wiring; validate the damage engine vs `@smogon/calc`; make the real engine MEDICHAM's and DITTO's scorer.
3. **MEDICHAM:** confidence intervals now; DAgger/search policy next; label the browser engine an approximation with an error band.
4. **JOLTEON:** add the low-rank non-transitive term; learn the coverage weight; write the actual hierarchical prior.
5. **DITTO:** rebuild as real double oracle / PSRO with real-engine payoffs and a meta-Nash mixture — or rename it honestly.
6. **Predictability:** replace aggregate-matching with a per-game skill/luck decomposition and calibration.

The vision is genuinely strong and the open-engine finding is the key that unlocks most of this. But right now the website hands people probabilities that have never been scored, calibrated, or bounded. Fix the evaluation layer and the rest becomes tractable. Fail to, and every number here is decoration.

*— submitted for revision.*

## Sources
- [Brier score](https://en.wikipedia.org/wiki/Brier_score) · [Superior scoring rules for probabilistic evaluation](https://arxiv.org/abs/2407.17697)
- [Bradley-Terry-Élő models / limitations](https://arxiv.org/pdf/1701.08055)
- [How often does the best team win? (skill vs luck)](https://arxiv.org/pdf/1701.05976)
- [Feedback in Imitation Learning: Three Regimes of Covariate Shift](https://arxiv.org/pdf/2102.02872)
- [SM-MCTS / Hannan consistency in simultaneous-move games](https://arxiv.org/pdf/1804.09045)
- [A Unified Game-Theoretic Approach to MARL (PSRO)](https://arxiv.org/pdf/1711.00832) · [Team PSRO](https://arxiv.org/pdf/2207.06541)
