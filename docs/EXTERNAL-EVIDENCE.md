# EXTERNAL EVIDENCE — results from outside this project that bear on the roadmap

Everything else in `docs/` is something ABRA measured. This file is the opposite: results other
people got, what they imply here, and — the part that matters — **what does not transfer**.

The rule for this file is the rule for the whole project. An external result is a **prior**, never a
finding. It can raise or lower the priority of an experiment. It can never stand in for one, and no
number from here is ever quoted as ABRA's.

---

## PokeTransformer / `Nebraskinator/ps-ppo` — a search-free agent's ceiling (added 2026-08-04)

**Source:** author's writeup, r/reinforcementlearning; repository `Nebraskinator/ps-ppo`.
**Their format:** Gen 9 **Random Battles**, singles, on the public ladder.

**What they built.** A pure neural agent with **no search at inference** — one forward pass, action
sampled. State is a sequence of discrete embeddings (1 field token + 12 Pokémon tokens) through a
transformer, with bespoke subnets encoding moves, abilities and species. Their stated reason for the
architecture: flattening 12 Pokémon, their moves and the field into a 1D array **destroys the
semantic geometry of the state space**. Training was imitation first — cross-entropy against
`poke-env`'s `SimpleHeuristicsPlayer` — then distributed **PPO** self-play.

**Their result, and the number that matters to us:**

| Agent class | Ladder ELO |
|---|---|
| Their search-free network | ~1900 (top 25%) |
| Engine-assisted search (Foul Play, PokéChamp, Wang — Expectimax / MCTS) | 2300+ |

### What does NOT transfer, stated first so the rest is read correctly

**Their game is not our game, and the differences all sit on the axes we care about.**

- **Singles, not doubles.** Every coordination question DODUO exists for is absent. Their 12-token
  state has one active per side; ours has two, and the interaction between them is where the
  measured effects live.
- **Random Battles, so there is no team building and no team preview.** DITTO, SLOWKING's preview
  Nash and half of what MILTANK does have no counterpart. Their agent never makes the decisions our
  hardest models exist to make.
- **Random sets, so the belief problem is different in kind.** XATU narrows a metagame-shaped prior
  toward a real opponent's real choices. In Random Battles the set distribution is close to uniform
  and known, so belief is inference over a fixed generator rather than over a person.
- **ELO numbers do not transfer at all.** Different ladder, different population, different format.
  1900 and 2300 are facts about their environment. Quoting either as a target here would be the
  category error this file exists to prevent.

### What does transfer, and it is worth a lot

**1. Search beats a search-free policy by a wide margin in Pokémon specifically.** That is the
headline, it is measured on a real ladder against a real population, and it is *independent
corroboration of R4*. ABRA measured MILTANK over MAG greedy at **55.5% of 535 decisive pairs**
(`data/rollout-r4.json`). Two very different environments, two very different methods, same
direction. It also matches this project's own internal pattern: four feature additions to MAG
produced four measured nulls, while two changes to how the policy is **used** were worth +12 points
raw and 79.7% of decisive pairs.

Read together, these say the same thing three times: **the return on search is currently larger than
the return on knowledge.** That is a priority argument, not a proof, and it is the strongest one we
have.

**2. Their imitation target was a heuristic bot, not humans.** They cloned
`SimpleHeuristicsPlayer` purely to get legal, sane behaviour, then let PPO do the real work. ABRA
clones **humans**, and `docs/MODELS.md` already records that as a ceiling — the objective is to
predict a click, not to win. The external pipeline treats imitation as a *bootstrap* and not as the
objective. MACHAMP is the component that would close that gap here, and it is half-run on a
17-feature vector against today's 56.

**3. PPO, not a hand-rolled trust region.** `engine/train_policy.js` does REINFORCE with a trust
region we wrote ourselves. PPO's clipped surrogate is the better-behaved version of exactly that
idea, it is standard, and swapping it is a bounded change to one file. **Filed to MEASURE**, since
it changes how MAG's weights are produced.

### The one place this could fool us — read this before citing the nulls again

The architecture claim and ABRA's null results are **about different things**, and it would be easy
to use one to dismiss the other.

ABRA's four feature nulls were measured on a **linear conditional logit** (`engine/fit_policy.js`,
McFadden). A linear model cannot exploit interaction structure *no matter how good its features are*
— the geometry the transformer post is talking about is precisely what a linear model throws away
by construction.

So:

> **"More features did not help a linear model" is NOT evidence that "a nonlinear model would not
> help."** Only the first has been tested here. The second is untested and is currently being
> treated as settled.

That gap is now on the roadmap rather than assumed away. It does not outrank search — the external
result and R4 both say search first — but it is a real open question and it had been closed by
accident.

### Filed from this

| Item | Division | Status |
|---|---|---|
| Assess PPO clipping in place of the hand-rolled trust region in `train_policy.js` | MEASURE | filed 2026-08-04 |
| "Linear nulls ≠ nonlinear nulls" — the untested claim above | MEASURE | filed 2026-08-04 |
| Does the external search-vs-network gap change MILTANK's priority | SEARCH | in progress 2026-08-04 |

### One name collision, recorded so nobody trips on it (PokeTransformer entry)

The post names **Foul Play** as a high-performing search bot. ABRA separately found that **Foul
Play the move** is unimplemented — `data/abra-tags.js` carries
`foulplay: {swapsStat: {offensiveFrom: "target"}}` and `engine/medicham2-browser.js` never reads
`swapsStat`, so it attacks with the wrong Pokémon's Attack. Unrelated things. Do not merge them in a
future summary.

---

## The PokéAgent Challenge — NeurIPS 2025 (added 2026-08-04)

**Source:** arXiv 2603.15563; competition site `pokeagent.github.io`; RL baselines
`UT-Austin-RPL/metamon`. Will pointed at the launch livestream
(`youtube.com/live/CaXM2hr_n2A`, "Research Talks & Hackathon Launch", 1:25:45).

**Provenance caveat, stated because it matters.** The spoken talk transcript could **not** be
retrieved — YouTube does not serve captions to our fetcher. Everything below is read from the
**paper and competition pages**, not from the talk. If a claim here is ever contradicted by
something said in that stream, the stream wins and this entry is wrong.

### What it is

A NeurIPS competition with two tracks. The one that concerns us is the **Battling Track**:
two-player Pokémon Showdown battles, partial observability, stochastic transitions. It ran
Jul–Dec 2025, 100+ teams, 150+ submissions.

Scale, for calibration against ours:

| | PokéAgent | ABRA |
|---|---|---|
| Human battle trajectories | 4M+ | 6,890 usable of 38,186 stored |
| Self-play trajectories | 18M synthetic | 1,000 gated (MEW) |
| Teams | 200K+ extracted | 6,965 |

**Baselines.** `PokéChamp` — *depth-limited minimax search with LLM-based position evaluation*.
`Metamon` — 30 RL agents from compact RNNs up to 200M-parameter Transformers, trained on human
demonstrations **and** self-play.

### The finding that matters most to us

> **"RL and search methods outperform LLM approaches."** In battling, **"the top participants all
> used RL or MCTS rather than LLM reasoning."** The cross-track pattern was *"LLMs as priors, RL as
> refinement."*

This is now the **third independent line** pointing the same way, from three unrelated sources:

1. R4, measured here: MILTANK (search) over MAG greedy, **55.5% of 535 decisive pairs**.
2. PokeTransformer, above: search-free ceiling ~1900 ELO against 2300+ for engine-assisted search.
3. This competition: every top battling submission used search or RL, not a single-pass reasoner.

Three environments, three methods, one direction. That is about as strong as a prior gets without
being a measurement, and it says **search is where the return is**.

### The sharper point — PokéChamp's shape is MILTANK's shape, and our version is broken

PokéChamp is *depth-limited search plus a learned position evaluator*. That is structurally what
MILTANK is: a search whose quality is bounded by the leaf it calls.

Tonight's calibration measured our leaf, properly, at n=6,886:

- reliability curve is a **flat line at ~0.52** — predicted spans 0.06→0.94, observed never leaves
  0.46→0.57, ECE 0.181;
- the **in-game leaf, which makes every move, discriminates at 50.99%, p=0.47** — indistinguishable
  from a coin.

So the external evidence says *the leaf is the component that decides how good a search agent is*,
and ours is the component we have just measured as uninformative. **This raises the leaf above more
search work in priority.** A better search over a coin-flip evaluator is a better-organised coin
flip. `docs/SEARCH.md` reads "a search is worth exactly what its model is worth"; this is that
sentence with an outside number attached.

### The concretely useful thing nobody should miss

The Battling Track's supported formats include **Gen9 VGC Regulation I** — a **doubles VGC** format,
with baselines and datasets published for it.

Every other external result in this file is singles. This one is not. It is the closest public
benchmark to what ABRA actually plays, and it comes with a live leaderboard, a 4M-trajectory human
dataset and 30 pre-trained agents. **Champions Reg M-B is not Reg I** — different regulation,
different legality, our own 66-point SP stat system, one mega per battle, four banned items — so
nothing transfers as a number. But the *shape* is right, and it is the only place an ABRA component
could be scored against something other than itself.

That matters because of a limit this project already knows it has: every result here is bots
grading bots that **share our blind spots**. WOBBUFFET grades readability, R4 grades MILTANK against
MAG, and both compare two things built from the same 53 features on the same engine. An external
doubles benchmark is the first opportunity to be wrong in a way our own harness structurally cannot
detect — which is the failure mode CLAUDE.md opens with.

### Filed from this

| Item | Division | Status |
|---|---|---|
| Leaf quality outranks more search work — the flat curve is the binding constraint | MEASURE + SEARCH | filed 2026-08-04 |
| Evaluate `metamon` / Gen9 VGC Reg I as an EXTERNAL scoreboard, since every current result is bots grading bots that share our blind spots | MEASURE | filed 2026-08-04 |
| Their pipeline is human demonstrations **plus** self-play at 18M trajectories; MEW has 1,000 gated games | MEASURE | filed 2026-08-04 |
| Retrieve the actual talk transcript — this entry rests on the paper, not the stream | — | open |
