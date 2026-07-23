# Competitive landscape & how ABRA refines it

Honest positioning: competitive-Pokémon AI is an active field. We are not first, and several groups are ahead of us on parts of this. This document studies their methods and states exactly where ABRA refines, complements, or should simply *adopt* their work.

## The competitors

### 1. VGC-Bench (Angliss et al., 2025) — the state of the art, and our closest neighbor
- **What it is:** a benchmark + agents for VGC doubles, on `poke-env`. Ships **~700k human battle logs**, standardized evaluation, and baselines spanning heuristics, LLMs, behavior cloning, and **multi-agent RL with empirical game theory — self-play, fictitious play, and double oracle (4 PSRO variants)**. ([paper](https://arxiv.org/abs/2506.10326), [code](https://github.com/cameronangliss/vgc-bench))
- **Their key result / open problem:** in a *single-team* mirror they beat a professional. But as the **team set grows, the best single-team agent gets more *exploitable* and generalizes worse** — team space is ~10^139, and the optimal strategy depends heavily on both teams. **Generalization-vs-exploitability is the unsolved core.**
- **How ABRA refines / complements:**
  - They apply game theory at the **team-strategy** level (PSRO over policies). SLOWKING targets the **in-battle** level — ReBeL/DeepStack **continual re-solving over a public belief state**, which I could not find done for VGC. That's the genuinely additive piece.
  - Their exploitability problem is a *Nash* problem. Our `nash.py` + `solver.team_preview` compute the **equilibrium team/bring mixture** directly; reporting the *mixture* (not one team) is the principled answer to "any single team is exploitable."
  - **Adopt, don't rebuild:** their 700k dataset (behavior-clone prior, offline pretraining) and `poke-env` (RL harness). Reinventing these would be wasteful.

### 2. "Human-Level Competitive Pokémon via Scalable Offline RL with Transformers" (2025)
- **What it is:** offline RL (transformer policy) trained on large human replay corpora, reaching human-level in **singles**.
- **Refine:** extend to **doubles + hidden-info belief search**; use their offline-RL policy as the **behavior-clone prior** that seeds MEDICHAM/SLOWKING, then improve it online with self-play (offline pretrain → online flywheel is the standard, powerful recipe).

### 3. PokéLLMon (2024) — the LLM agent
- **What it is:** an LLM battle agent using in-context RL + knowledge-augmented generation; human-parity in randoms.
- **Refine:** LLMs are strong at *knowledge and explanation*, weak at *exact game-solving under a turn timer*. Right division of labor: **LLM powers KADABRA** (replay coaching, natural-language "why") and knowledge priors; **game-theoretic search makes the decisions**. Don't ask an LLM to compute a Nash mix.

### 4. `poke-env`, `reuniclusVGC` (DQN), heuristic bots
- The infrastructure layer and simple baselines. **Adopt `poke-env`** as the agent harness; treat DQN/heuristics as the floor our search must clear.

## Where ABRA is actually differentiated (be honest, it's a short list)
1. **In-battle belief search (ReBeL-style) for VGC** — the piece the field hasn't published. This is our real research bet.
2. **Equilibrium team *mixtures*** as the direct answer to VGC-Bench's exploitability finding.
3. **Evaluation honesty as a feature** — proper scoring, calibration, and confidence intervals shown to the user (and in our own docs, including publishing where a model only ties a coin). The field reports win-rates against baselines; almost nobody surfaces calibration to *players*.
4. **The open Champions engine + self-play flywheel** giving exact dynamics and unlimited unbiased data.
5. **A consumer product**, not a benchmark — win-prob, rollout, team-opt, coach, calc, in one place.

## Concrete refinements to their methods (the to-do that matters)
- **VGC-Bench PSRO → belief-conditioned best-response + continual re-solving.** Their best-response is to a static mixture; make it re-solve against the *belief* each turn, and report **exploitability with CIs**, not just head-to-head win-rate.
- **Behavior cloning → DAgger against the open engine.** Both their BC agents and our MEDICHAM policy suffer covariate shift; correct it on-policy with the real simulator as the expert-labeler.
- **Offline → online.** Pretrain the policy/value nets on the 700k human logs (their data), then run the self-play flywheel (our engine + `train_value.py`) on top. Offline gives a strong prior cheaply; online removes the human selection bias.
- **Team generalization.** Instead of one policy per team, condition the policy/value on a **team embedding** and train across many teams (they show this trades peak strength for generalization) — then let the equilibrium layer handle exploitability.

## The one-sentence position
> VGC-Bench solved "can an RL agent beat a pro on a fixed team" and exposed that broad, unexploitable play is the hard part; ABRA's bet is that **in-battle belief search plus equilibrium team mixtures** — the poker-AI playbook they didn't fully port — is the way to close that gap, delivered as an honestly-evaluated product rather than a benchmark.

## Sources
- [VGC-Bench](https://arxiv.org/abs/2506.10326) · [code](https://github.com/cameronangliss/vgc-bench)
- [Human-Level Competitive Pokémon via Offline RL with Transformers](https://arxiv.org/html/2504.04395v1)
- [PokéLLMon](https://arxiv.org/abs/2402.01118) · [poke-env](https://github.com/hsahovic/poke-env)
- [ReBeL](https://arxiv.org/pdf/2007.13544) · [DeepStack](https://arxiv.org/pdf/1701.01724) · [PSRO](https://arxiv.org/pdf/1711.00832)
