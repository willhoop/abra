# SLOWKING — belief-based search for Champions VGC

**Search over Learned Opponent-belief World, Knowledge-Intensive Nash Game-solver.**

The goal, stated plainly: *given a live position, tell you the move (or mix of moves) that maximizes your win probability, and tell you that probability.* This is the same problem superhuman poker AIs solve, and SLOWKING is built directly on their lineage.

## The poker → Pokémon thesis

Poker and Pokémon are both **two-player, zero-sum, imperfect-information** games. The entire modern poker-AI stack is therefore the right toolbox; we adapt it rather than invent from scratch.

| Poker AI | What it contributes | How SLOWKING uses it |
|---|---|---|
| **CFR / MCCFR** (Zinkevich 2007) | Regret minimization → Nash in 2p zero-sum | `nash.py`, `ismcts.py` use regret matching; verified to recover exact equilibria (RPS, 2×2). |
| **DeepStack** (Moravčík 2017) | Depth-limited **continual re-solving** + a counterfactual **value network** at the leaf | `solver.py` re-solves a depth-limited subgame each turn; leaf value = engine rollout now, learned net later. |
| **Libratus** (Brown & Sandholm 2017) | **Safe + nested subgame solving** | continual re-solving as play descends; the belief is re-anchored each turn. |
| **ReBeL** (Brown 2020) | Search over **public belief states**; value+policy nets trained by **self-play RL**; converges to Nash | the core architecture: the search unit is (public board + belief), `belief.py`; training plan below. |
| **Player of Games** (Schmid 2021) | Unifies perfect- & imperfect-info search | north star for one engine across preview + battle. |

### Where the analogy holds — and where it breaks (this matters)

- **Holds:** hidden private information (their hand ↔ their bring + sets), the need to *mix* to stay unexploitable, belief updating from observed actions, value at equilibrium as the object of interest.
- **Breaks — simultaneity:** poker is sequential; a Pokémon turn is **simultaneous** (both choose at once). So we cannot use vanilla sequential CFR at a node — we use **simultaneous-move regret matching**, which is Hannan-consistent and converges to the stage-game Nash ([SM-MCTS analysis](https://arxiv.org/pdf/1804.09045)). This is why `ismcts.py` recovers the asymmetric 2×2 equilibrium and not just uniform.
- **Breaks — action space & horizon:** poker has ~3 actions and a few betting rounds; a doubles turn has (move × target) × (switches) per mon, over ~15–20 turns. Far larger. This forces **action abstraction** and a **depth limit with a value function** — exactly why the DeepStack/ReBeL value net isn't optional here, it's load-bearing.
- **Breaks — chance:** poker's chance is a card deal you must model; **our chance is the open Showdown engine** (damage rolls, crits, misses, speed ties). We don't model dynamics at all — we *call the exact simulator*. This is the single biggest advantage the open-engine finding buys us, and it removes the largest source of modelling error.

## Architecture (the ReBeL recipe, adapted)

1. **Public Belief State (PBS).** The unit of search = (observable board) + (belief over each player's hidden info). `belief.Belief` maintains the private-info distribution (which 4 of 6 they bring, item/ability/4th move), seeded from ABRA's ladder priors and updated by a Bayesian filter as moves/items are revealed.
2. **Continual re-solving.** Each decision re-solves a fresh depth-limited subgame from the current PBS (`solver.turn_decision`) instead of trusting a stale blueprint. Play → observe → update belief → re-solve.
3. **Depth limit + leaf evaluator.** Cap search depth; evaluate leaf PBSs with a value function. **v1 leaf = MEDICHAM / real-engine rollout.** **v2 leaf = a trained counterfactual-value network** (the DeepStack/ReBeL upgrade).
4. **Two solve points.** Team preview = a one-shot simultaneous **matrix game over the 15 brings**, solved to an equilibrium *mix* by `nash.py`. In-battle = imperfect-info subgame solved by `ismcts.py`.

Output at every decision: a probability distribution over your legal choices **and** the equilibrium win-probability value.

## Module map & status

| File | Role | Status |
|---|---|---|
| `nash.py` | 2p zero-sum equilibrium (regret matching + LP) | **built + verified** (RPS→uniform, 2×2 matches LP, exploitability≈0) |
| `belief.py` | PBS opponent-info model + Bayesian filter | **built + verified** (bring distribution, observation updates, sampling) |
| `ismcts.py` | Information-Set MCTS, simultaneous-move regret matching | **built + verified** (recovers asymmetric Nash) |
| `game.py` | game interface + `ChampionsGame` adapter to the open engine | interface **built**; engine adapter is a **documented stub** (needs `sim/`, task #31) |
| `solver.py` | orchestrator: team-preview Nash + in-battle re-solve | **built + verified** (returns a bring mix + value) |

## What's real vs. what's next (no overclaiming)

**Real today:** the equilibrium math, the belief model, and the search are implemented and unit-tested; the team-preview solver already returns unexploitable bring mixes with win-probability values against a supplied payoff function.

**Next, in order:**
1. **Wire `ChampionsGame` to the open Showdown engine** (`sim/`, task #31) so the leaf evaluator and the in-battle game are the *real* dynamics, not a stub.
2. **Self-play data** (the "more games" unlock): generate games with the engine to (a) grow the dataset bias-free and (b) train the value+policy networks.
3. **Train the counterfactual value network** on self-play (ReBeL) so search is depth-limited and fast instead of rollout-bound.
4. **Calibrate & validate** the output win-probabilities with proper scoring (see `eval_harness.py`) against held-out human games.

Until steps 1–3 land, SLOWKING is a **correct, tested solver waiting for its engine and value net** — a strong research chassis, not yet a finished superhuman bot. That distinction is deliberate and honest.

## Sources
- [ReBeL: Combining Deep RL and Search for Imperfect-Information Games](https://arxiv.org/pdf/2007.13544)
- [DeepStack: Expert-Level AI in Heads-Up No-Limit Poker](https://arxiv.org/pdf/1701.01724)
- [Libratus: Superhuman AI for heads-up no-limit poker](https://www.science.org/doi/10.1126/science.aao1733)
- [Hannan consistency / SM-MCTS in simultaneous-move games](https://arxiv.org/pdf/1804.09045)
- [PSRO / unified game-theoretic MARL](https://arxiv.org/pdf/1711.00832)
