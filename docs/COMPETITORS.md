# Competitive landscape — public attempts at Pokémon battle AI

**Surveyed 2026-07-25.** Supersedes the 2026-07-23 version, which covered only the academic tier and
predated the NeurIPS 2025 results.

Honest positioning: this is an active field and several groups are ahead of ABRA on agents. This
document maps each public attempt against ABRA, states what we can take from it, and — because it
determines whether we may take anything at all — records the licence.

---

## 1. The two findings that should change what we build

**1.1 The strongest public battling agents are RL and MCTS, not LLMs.** The PokéAgent Challenge
(NeurIPS 2025) drew 100+ teams and 650+ participants. Track 1, competitive battling, was won by
**PA-Agent (RL)** and **Foul Play (MCTS)**; the LLM entry (August) took a Judges' Choice rather than
the win. The organisers' summary is blunt — *RL specialists dominated partially observable two-player
games*. The paper adds that Pokémon battling is "nearly orthogonal to standard LLM benchmarks."

*Consequence for ABRA:* the LLM route is not the play for decisions. Keep LLMs where PokéLLMon showed
they earn their place — explanation and knowledge retrieval, i.e. KADABRA's prose — and make the
decisions with search and learned policies.

**1.2 A public VGC doubles corpus EXISTS, in our exact regulation, under MIT.**

This is the correction that matters most, and it reverses an earlier draft of this document.

[`cameronangliss/vgc-battle-logs`](https://huggingface.co/datasets/cameronangliss/vgc-battle-logs)
— **88,905 battle logs**, ~177,810 trajectories, ~1.47M transitions, **630 MB**, **MIT licensed**,
covering **four Gen 9 Champions formats including Regs M-A and M-B**. That is ABRA's format.

And the part that matters more than the size: it is **filtered for Open Team Sheets**. Complete sets
are visible. ABRA's single largest data weakness is that a closed-sheet replay reveals a mean of 1.38
of four moves, 69.7% no item, 75.5% no ability — and ADR-001 records twice that *whatever fills that
gap dominates any result*. This corpus does not have the gap.

*Consequence for ABRA — three uses, in order of value:*

1. **Ground truth for set reconstruction.** `engine/set_priors.js` currently guesses the missing 2.6
   moves from usage priors and has never been checked against a real set, because we had none. OTS
   games give real complete sets to validate against. This converts our biggest unquantified
   assumption into a measurable error rate.
2. **10× the data**, in-format, for anything that does not depend on hidden information — matchup
   structure, team construction, damage, policy training.
3. **Raw Showdown logs**, so `extract()` parses them with no new code.

*The honest caveat:* OTS is a **different information regime** from ABRA's closed-sheet Bo1 ladder.
XATU's entire subject is what is hidden and how belief narrows on reveal — a question that does not
exist when both sheets are open. So this corpus supplements the ladder store for engine and policy
work; it cannot replace it for belief work, and the two must not be pooled without saying which is
which.

**Foul Play, the Track 1 co-winner, is still singles-only** and cannot play our format. But
"nobody has a doubles agent" was wrong: VGC-Bench's PSRO and BC agents play doubles, and they are
cross-evaluated. ABRA is behind on agents in doubles, not ahead.

---

## 2. The projects

### 2.1 PokéAgent Challenge (NeurIPS 2025) — [arXiv:2603.15563](https://arxiv.org/abs/2603.15563)

The current centre of gravity. Two tracks (competitive battling, RPG speedrunning), a live
leaderboard, and — the part that matters most to us — **a released dataset of 20M+ battle
trajectories** with heuristic, RL and LLM baselines.

**FORMAT, CHECKED — and it changes the recommendation.** Track 1 runs **Gen 1 OU and Gen 9 OU**,
both **singles**. The 20M is 4M human replays plus 18M self-play, spanning generations but **not
doubles or VGC**. The paper carries **CC BY-NC-SA 4.0**; the dataset's own terms are not stated in
the paper and must be read from the HuggingFace repo before any use. NC would matter if ABRA ever
becomes commercial.

**What ABRA can take:** less than it first appears. This is not a drop-in fix for our sample size,
because it is the wrong format. It is a plausible **pre-training** corpus — learn Pokémon-general
representations from singles, fine-tune on Reg M-B doubles — but singles→doubles transfer is
unproven and doubles adds a partner, spread damage, redirection and a 4-of-6 bring. Treat it as an
experiment with an acceptance bar, not as a solution.

### 2.2 Foul Play — [github.com/pmariglia/foul-play](https://github.com/pmariglia/foul-play) · **GPL-3.0**

Track 1 co-winner. Root-parallelised **Monte Carlo Tree Search** over `poke-engine`, a bespoke Rust
battle engine, guided by a **hand-written evaluation function rather than rollouts**.

That last detail is the interesting one. Foul Play does not roll out to terminal; it searches and
evaluates at the leaf — the DeepStack/AlphaBeta shape, and precisely the architecture SLOWKING and
ALAKAZAM are specified to have. Someone has now won a competition with it in this domain.

**What ABRA can take:** the architectural confirmation, and the design lesson that a good leaf
evaluator beats deep rollouts. ABRA already has the leaf evaluator — PORY.

**LICENCE WARNING.** Foul Play is **GPL-3.0**, which is viral. ABRA is MIT. Copying Foul Play code,
or linking `poke-engine`, would force ABRA to become GPL. **Read it for ideas; do not vendor it.**
This is the one project in this survey with a licence that constrains us.

### 2.3 VGC-Bench — [github.com/cameronangliss/VGC-Bench](https://github.com/cameronangliss/VGC-Bench) · **MIT** · [arXiv:2506.10326](https://arxiv.org/abs/2506.10326)

The closest neighbour: **doubles VGC**, on poke-env, with four PSRO variants (pure self-play,
fictitious play, double oracle, exploitation), behaviour cloning, an LLM wrapper, and three poke-env
heuristics. Ships a scraping pipeline rather than logs. Cross-evaluated across 1 / 4 / 16 / 64 team
settings.

**Their headline result, and it changes MEW's priority:** the strongest agent is **BCSP — self-play
initialised with behaviour cloning.** Not pure self-play, not pure imitation. Clone first, then
improve by self-play.

**What ABRA can take:** three things, and it is MIT so we actually may.
1. **The BCSP sequence.** MEW currently runs random self-play. Random is correct for plumbing and for
   matchup structure, but VGC-Bench says it is not what wins. The behaviour-cloned policy is the
   deliverable, not the upgrade.
2. **The PSRO implementations** — DITTO's rebuild has been "to do" for two versions and is
   implemented here, in our format, under a licence we can use.
3. **Their BC pipeline**, which turns logs into state-action trajectories. That is SLOWKING Paper 1 /
   `engine/game-spec.js`.

**Their known weakness, which is ours to avoid:** the LLM baseline is evaluated on **20 battles**
against 200 for every other agent. That comparison cannot support a conclusion — the same
underpowered-claim problem ABRA gated against on 2026-07-25 (`engine/eval_harness.py`).

**Their open problem:** as team diversity grows, the best single-team agent becomes more exploitable
and generalises worse. Team space is ~10^139. Exploitability vs generalisation is unsolved.

### 2.4 Metamon — [arXiv:2504.04395](https://arxiv.org/abs/2504.04395)

Offline RL with transformers on **5M human trajectories + 20M self-play**, reaching the top decile of
human players in singles, model-free, **with no search at all**.

**What ABRA can take:** the mixture ratio. Roughly 4:1 self-play to human. And the sobering lesson
that a large enough learned policy may not need search — which means ALAKAZAM's search layer must be
measured against the no-search policy and kept only if it earns its cost.

### 2.5 PokéChamp (ICML 2025) — minimax LLM agent

Expert-level minimax agent over the open engine, ~1500 Elo, no learned dynamics, no equilibrium
guarantee. A domain proof and a baseline.

### 2.6 PokéLLMon — [arXiv:2402.01118](https://arxiv.org/abs/2402.01118)

First LLM agent at human parity in randoms, via state→text prompting and retrieval-augmented
generation. Superseded on strength by RL, but its RAG-of-knowledge layer is the right model for
KADABRA's explanations.

### 2.7 poke-env — [github.com/hsahovic/poke-env](https://github.com/hsahovic/poke-env) · **MIT**

The infrastructure layer. Python library for scripted agents, self-play and RL against a local
Showdown server; subclass `Player`, override `choose_move`. Everything above is built on it.

**What ABRA can take:** it is the standard harness and it is MIT. ABRA currently drives the simulator
directly through `BattleStream` in `engine/champions_sim.js`, which works and is verified. poke-env
would matter if we want to reuse VGC-Bench's agents, since those are written against it.

*Open question:* whether poke-env's doubles support is complete for our format. VGC-Bench is built on
it and does doubles, which is suggestive but not confirmation.

### 2.8 The hobbyist bot lineage — absent from the previous survey

A decade of open-source Showdown bots that solved practical problems before the academics arrived:
**Technical Machine** (David Stone), **pmariglia/showdown** (the ancestor of Foul Play), **MariBot**,
and forks such as **jfiacco/showdown** and **Agetian/showdown-battlebot**. **PsyMew** is a recent
Foul Play fork that swaps the decision engine for an LLM pipeline (Gemini or Claude).

**What ABRA can take:** mostly operational rather than algorithmic — protocol handling, reconnection,
team validation, ladder etiquette. Technical Machine's deliberate non-determinism (it varies between
good options so opponents cannot read it) is a small, real idea that anticipates the
mixed-strategy argument by years.

---

## 3. Mapped against ABRA

| Capability | Best public work | ABRA | Verdict |
|---|---|---|---|
| Singles battling agent | Foul Play (MCTS), PA-Agent (RL) | none | **Behind. Not our format** |
| Doubles/VGC agent | VGC-Bench (benchmark) | ALAKAZAM (spec only) | **Both early. Genuinely open** |
| Battle engine correctness | poke-engine (Foul Play, GPL) | official Champions mod, verified 31/31 vs `@smogon/calc` | **Level, and ours is the authority** |
| Training data volume | PokéAgent 20M+, Metamon 5.3M — **both singles** | 1,061 clean games, **doubles** | **No public doubles corpus exists. Keep collecting; MEW is necessary** |
| Belief-state / equilibrium search | **Ihara et al. 2018** compared determinization vs information sets for Pokémon and found IS-MCTS better; belief-MCTS is a mature literature | SLOWKING/ALAKAZAM (spec, unbuilt) | **Not first. Not even close.** The narrow claim that survives is PBS re-solving in *doubles*, and that is a gap of degree, not of kind |
| Mid-game value function | implicit in RL agents | **PORY, calibrated, log-loss 0.567 vs 0.693** | **Comparable, and ours is explicit and measured** |
| Evaluation honesty | weak — VGC-Bench's LLM at n=20 | proper scores, CIs, baselines, power gate | **Ahead. This is the real differentiator** |
| Team building | VGC-Bench PSRO | DITTO (needs rebuild) | **Behind. Adopt their PSRO** |

---

## 4. What to adopt, what to build

**Adopt (MIT, no obstacle):**
- VGC-Bench's PSRO implementations for the DITTO rebuild.
- VGC-Bench's BC pipeline instead of writing `game-spec.js` from scratch.
- poke-env if and when we need their agents to run.

**Do NOT treat as a data fix:**
- PokéAgent's 20M and Metamon's 5.3M are **singles only**. Neither closes ABRA's power problem,
  because neither is the format we study. Useful as a pre-training experiment; not a substitute for
  collecting Reg M-B doubles.

**Read but do not vendor (GPL-3.0):**
- Foul Play and poke-engine. Ideas only. Vendoring would relicense ABRA.

**Keep building — nobody else is:**
- Belief-state search in doubles VGC.
- The measured-evaluation discipline. On the evidence of this survey it is ABRA's strongest and least
  contested claim.

**Stop building:**
- Anything that duplicates a scraper, a harness or a PSRO loop that exists under MIT.

---

## 5. Licences, in one place

| Project | Licence | May we use the code? |
|---|---|---|
| VGC-Bench | **MIT** | Yes |
| poke-env | **MIT** | Yes |
| Foul Play / poke-engine | **GPL-3.0** | **No** — viral, ABRA is MIT. Ideas only |
| PokéAgent dataset | paper **CC BY-NC-SA 4.0**, dataset terms unstated | Read HuggingFace terms first; NC would block commercial use |
| Metamon | **MIT** (code); dataset terms unstated | Code yes. Data is singles only, terms unread |
| Pokémon Showdown / champions mod | **MIT** — verified from LICENSE, "The MIT License (MIT)" | Yes. Already used, pinned at `20ad99f`. Vendoring `data/mods/champions/` is permitted provided the copyright notice travels with it (ADR-001 migration step 1) |
| `@smogon/calc` | MIT | Yes. Already a dependency; it is the damage ground truth |

All of the above were read from the LICENSE file itself, not from a badge or an abstract.

ABRA is MIT. Any GPL code entering this repository would change that for the whole project, which is
a decision to be made deliberately and not by accident in a pull request. In practice the rule is
simple: **everything ABRA actually depends on is MIT, and the single GPL project in the field
(Foul Play / poke-engine) is one we only read.**

---

## 5b. Can ABRA enter anything?

Checked 2026-07-25.

**NeurIPS 2026** runs 6–12 December in Sydney, with satellites in Atlanta and Paris.

| Route | Deadline | Status |
|---|---|---|
| Propose a competition | 15 May 2026 (accept 15 June) | **Closed** |
| Propose a workshop | 6 June 2026 | **Closed** |
| Enter an accepted 2026 competition | varies | **Open in principle** — the accepted list is not published in the newsletter and must be read from the official competition page |
| MLRC 2026 → TMLR | 30 September 2026 | **Open** |
| arXiv preprint | none | **Always open** |

**The catch, and it is the important part: the PokéAgent Challenge is not VGC.** Its battling track is
Gen 1 OU and Gen 9 OU — singles. ABRA cannot enter its doubles work into a singles competition, and
converting ABRA to singles would discard the one thing that makes it distinct.

So the realistic routes are (a) a paper rather than a competition, and (b) proposing a **VGC doubles**
competition for NeurIPS 2027, where the pitch writes itself: the 2025 battling winner cannot play the
format, and no public doubles corpus exists.

---

## 6. Engine-design lineage

How the strongest engines in *other* games generate data and evaluate positions — Stockfish NNUE
(billions of positions at modest depth), Leela Chess Zero (self-play with policy temperature ≈ 2.25
for deliberate diversity), KataGo (sample efficiency as a first-class target), AlphaZero (and why its
no-metagame assumption does not transfer) — is treated in **`docs/MEW-whitepaper.md` §2**, where it
informs MEW's design directly.

---

## 7. Position, in one sentence

The field has settled that RL and search beat LLMs at battling, and the strongest public agent cannot
play doubles at all — so ABRA's bet remains **belief-state search in VGC doubles, evaluated honestly**,
built on adopted MIT infrastructure — but on data we collect ourselves, because every public corpus
is singles and no public VGC doubles dataset exists.

## Sources

- PokéAgent Challenge — [arXiv:2603.15563](https://arxiv.org/abs/2603.15563) · [pokeagent.github.io](https://pokeagent.github.io/) · [results summary](https://www.inf.uni-hamburg.de/en/inst/basecamp/projects/archive/2025/41-pokeagent-challenge.html)
- Foul Play — [github.com/pmariglia/foul-play](https://github.com/pmariglia/foul-play) (GPL-3.0) · [design notes](https://pmariglia.github.io/posts/foul-play/)
- VGC-Bench — [github.com/cameronangliss/VGC-Bench](https://github.com/cameronangliss/VGC-Bench) (MIT) · [arXiv:2506.10326](https://arxiv.org/abs/2506.10326)
- Metamon — [arXiv:2504.04395](https://arxiv.org/abs/2504.04395)
- PokéLLMon — [arXiv:2402.01118](https://arxiv.org/abs/2402.01118)
- poke-env — [github.com/hsahovic/poke-env](https://github.com/hsahovic/poke-env) (MIT)
- PsyMew — [Smogon thread](https://www.smogon.com/forums/threads/psymew-open-source-ai-battle-bot-project.3781351/)
