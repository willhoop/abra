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

**Provenance.** The paper and competition pages were fetched directly. The **livestream transcript
could not be retrieved** by any tool available here — YouTube serves no captions to our fetcher and
the domain is blocked in the browser pane — so Will supplied it by hand. Talk content below is
quoted from that transcript. Speakers: **Aaron Trailer** (Microsoft research scientist; 15 years
VGC, Worlds top-8 2016), **Seth Karten** (PokéChamp), **Jake Grigsby** (Metamon, UT Austin),
**Joel Zhang** (Gemini Plays Pokémon).

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

Every other external result in this file is singles. This one is not.

**CORRECTION, 2026-08-04, same day this entry was written.** The first version of this paragraph said
Reg I "comes with a live leaderboard, a 4M-trajectory human dataset and 30 pre-trained agents."
**That is wrong, and the error is exactly the kind this file exists to prevent.** Will checked
`pokeagentchallenge.com/battling.html` directly. The dataset table states that
`metamon-raw-replays` covers *"All PokéAgent formats **(excl. VGC)**"* — so **Metamon excludes VGC
entirely**: the 4M parsed trajectories, the 18M self-play pile, the 200K teams and the 30 RL agents
are all singles. I read "the Battling Track supports Reg I" and "the Battling Track has a 4M
dataset" and joined two true sentences into a false one.

What actually exists for doubles:

| Asset | Covers VGC? |
|---|---|
| `metamon-raw-replays` (2.4M battles, 2014–2026) | **No** — "excl. VGC" |
| `metamon-parsed-replays` (4M+ trajectories) | **No** |
| `metamon-parsed-pile` (18M self-play) | **No** |
| `metamon-teams` (200K+) | **No** |
| 30 Metamon RL agents | **No** |
| `pokechamp` (2M battles, 39+ formats, 2024–2025) | **Yes** — "Gen 1–9 OU, VGC, etc." |

So the doubles resource is **one dataset**, not the whole stack, and the RL baselines almost
certainly do not play doubles at all.

**And Champions Reg M-B is not there in any form.** Only **Regulation I** is named — not M, not B,
not Champions. Beyond the regulation difference, Champions uses our own **66-point SP** stat system
with a 32 cap and auto-31 IVs, where standard VGC uses EVs and IVs, so even Reg I *teams* are not
directly usable here. Battle **logs** are closer, being genuine Gen 9 doubles, but nothing transfers
as a number.

The point survives in weakened form: `pokechamp`'s VGC slice is still the only place an ABRA
component could be scored against something other than itself.

That matters because of a limit this project already knows it has: every result here is bots
grading bots that **share our blind spots**. WOBBUFFET grades readability, R4 grades MILTANK against
MAG, and both compare two things built from the same 53 features on the same engine. An external
doubles benchmark is the first opportunity to be wrong in a way our own harness structurally cannot
detect — which is the failure mode CLAUDE.md opens with.

### Filed from this

| Item | Division | Status |
|---|---|---|
| Leaf quality outranks more search work — the flat curve is the binding constraint | MEASURE + SEARCH | filed 2026-08-04 |
| Evaluate the `pokechamp` dataset's VGC slice as an EXTERNAL scoreboard — every current result is bots grading bots that share our blind spots. NOT metamon: it excludes VGC | MEASURE | filed 2026-08-04, corrected same day |
| Their pipeline is human demonstrations **plus** self-play at 18M trajectories; MEW has 1,000 gated games | MEASURE | filed 2026-08-04 |
| Retrieve the actual talk transcript — this entry rests on the paper, not the stream | — | open |

---

### From the talks — four things that bear directly on open ABRA questions

#### 1. Metamon's spectator problem is OUR ingest problem, and it is the highest-value item here

Grigsby (Metamon) on building a training set from public replays:

> *"Players know more about their own team than they know about their opponents, and that's the
> basis of many of their decisions. Yet the replays are saved from a spectator point of view."*

Their fix reconstructs each player's **information state at the moment of the decision**, infers the
unknown remainder at the end from usage stats and similar replays by the same usernames, and then —
the part that matters — *"edit the trajectory as if you knew this information the whole time."* He
names the cost out loud: *"this does lead to errors… would they really have picked this move if
they had the team that we said they did?"*

**ABRA fits MAG on 146,910 decisions taken from public replays**, and this question has never been
asked here in these words: does `engine/board.js` reconstruct the state **as the player knew it that
turn**, or does it leak information revealed later in the same game? Fitting a policy on decisions
made with information the player did not have corrupts every weight, systematically and silently.

There is reason to think ABRA is partly protected — MAG is fitted on **open-sheet** games, so the
largest unknown is already declared. That narrows the exposure and does not close it: moves, items
and abilities are still revealed progressively, and `CLAUDE.md` already records that the sheet is a
lie mid-battle after a Knock Off. **Filed to MEASURE as an audit, assumed neither way.**

#### 2. Self-play outweighs human data roughly 10:1 in the pipeline that works

Grigsby: *"self-play data is the key to the success of this project really in the end… today the
best policies use self-generated to human battle ratios of like 10 to one."* Their order was
imitation → offline RL on the human set → self-play, and the improvement arrived at the third step.
Gen 1's best policy reaches **~83% GXE**, Gen 9's **~66%**, and today's best beats the paper's best
**80%** of the time.

**ABRA's ratio is inverted** — 1,000 gated MEW games against 6,890 usable human games, about
**0.15 : 1** where the working pipeline runs at **10 : 1**. MEW is built, gated and validated
(mirror symmetry 51.0%, CI [45.4, 56.6]). It is simply not being run at the volume the external
evidence says is the operative ingredient.

#### 3. Advantage-reweighted BC — the missing rung between MAG and MACHAMP

The most directly usable idea in the stream. Grigsby states the problem ABRA is stuck on:

> *"Which actions should we learn from?… you can imitate the winning player — Pokémon is random
> enough that the winning player may not have had the higher chances to win. You can imitate the
> highest ranked players, but they're often playing assuming that they're also playing against a
> highly ranked player, which is a different strategy."*

Their answer is a **tunable spectrum**, not a binary: a critic scores each action, the advantage
against the agent's current policy re-weights the imitation loss, and decisions that would make the
network worse are downweighted or ignored. Pure behaviour cloning at one end, RL-heavy at the other,
and you move along it as you come to trust the value estimates.

**ABRA has only the two endpoints.** MAG is pure behaviour cloning by conditional logit; MACHAMP is
a pure win-objective hill-climb, half-run and stale on a 17-feature vector against today's 56.
`MODELS.md` already records imitation as *"a ceiling, and it is measured."* This is the rung between
them, it reuses the fit that already exists, and it is far smaller than re-running MACHAMP.

One caution, in his words: offline RL *"tends to overestimate the value of decisions where you never
actually see the outcome."* It needs a critic worth trusting, and ABRA's leaf is currently flat at
**50.99%, p=0.47**. So it sits **behind** the leaf fix. That ordering is the point.

#### 4. Two of our design choices, arrived at independently by people with 4M trajectories

- **Seed-matched paired evaluation.** Karten, on grading PokéChamp: the same teams for both players
  the same number of times, mirrors excluded, *"so that for every game that they have an advantage,
  they also have a game where they have the same disadvantage."* That is R4's design — 1,312 seed
  pairs, both sides.
- **Discarding non-decisive games.** Grigsby: *"Pokémon is certainly random enough that the best
  player is often not the winner."* That is why R4 scores 535 **decisive** pairs and throws away the
  777 splits instead of counting them.

Not to be re-litigated.

### Three smaller, still real

- **PokéChamp's binding constraint is opponent prediction, not search depth.** Karten: the agent
  predicts the stronger player at *"almost double"* the accuracy of the opponent, and he names
  adapting to the current metagame as the limiting factor; the updated repo adds Bayesian opponent
  prediction. **This raises XATU's priority** — that is exactly XATU's job, and it currently scores
  +0.028 cross-entropy [0.024, 0.031] on the move slot alone, with items, abilities and EVs unscored.
- **Scaffolding beats the model.** Zhang: *"the scaffolding is more important than the model… a
  great model is not going to do anything if you don't give it the information that it needs."*
  Karten's ablation is the measured version — removing PokéChamp's scaffolding drops the win rate
  against the same opponent from **90% to 60%**, and one-step lookahead alone is about even with the
  heuristic bot. Same shape as ABRA's own result that how the policy is *used* beat everything it
  knows.
- **A Worlds top-8 player's definition of a good Pokémon is MAG's founding argument.** Trailer: *"a
  Pokémon is good if it's strong against the Pokémon on the other team."* MAG exists to *"decide a
  move by looking at the other side of the field, instead of by how popular the move is."*

### One hard constraint we had never written down

Trailer, on actual VGC play: **45 seconds maximum per decision**, on a 7-minute chess clock, in
**doubles**. That is MILTANK's real-time budget in a live game and it appears nowhere in
`docs/SEARCH.md`. R2 measured leaf cost at 477 boards over 200 games; nobody has checked that
against a 45-second wall. **Filed to SEARCH.**

He also gives the reason SLOWKING is worth having and the reason it is hard, in one breath:
*"calculating optimal moves is often impossible… opponent modeling is a huge part of human play as a
shortcut to challenging mental calculations."* And on why comparing this to rock-paper-scissors is
not a joke: *"rock paper scissors is only trivial because its Nash equilibrium is really easy to
calculate. Optimality in Pokémon is prohibitively expensive."*

---

## A practitioner's three challenges — and where ABRA has already measured them (added 2026-08-04)

**Source:** a comment on the same thread, supplied by Will. A competitive player's objections to
building this at all. Recorded because each one turns out to correspond to a number this project has
already produced — two of them confirm what we measured, and the third identifies a live risk in the
current build that nobody here has re-measured in three feature generations.

### Their challenge 1 — "there are a lot of parameters", and the details go very deep

> *"Is fake out active, does their attack make contact, is there the possibility of Farigiraf switch
> in, can they tera ghost, can they side skill swap intimidate to lower your attack again."*

**They are describing the census, exactly.** ABRA tracks this as a countable list rather than a
vibe: `data/abra-tags.js` holds **176 tags**, of which **53 are probed and 123 are not**, and the
mechanics census stands at **42 of 54 live, 12 missing**. Their instinct that it is bottomless is
right, and it is bounded and measured rather than infinite.

Their stated minimum — full battle log, both team sheets under OTS, field state, remaining HP — is
what ABRA already does: **OTS only**, non-OTS games discarded. Their "speed tiers and damage calcs
are a good start" is `engine/medicham2-browser.js`, validated against the Smogon calculator to
**within 5% on 100% of tested scenarios, median error 0%**.

Where they are more right than they know: tonight's differential work found **Foul Play attacking
with the wrong Pokémon's Attack** (734 uses, 1.55× too high), **Disguise unmodelled**, and
**Bulletproof, Soundproof and Overcoat unwired**. Their point that the long tail of small details is
the hard part is correct, and it is currently costing us real accuracy.

### Their challenge 2 — the dataset is insufficient even in principle

> *"Even if you have the log of every battle played across the world, I don't think you'd have a
> sufficient dataset… the core of the game is vastly different every time, and concepts of the early
> game don't translate to the late game."*

**This is measured here, and the number is worse than intuition suggests.** 1,124 clean games can
only detect an edge of about **4.2 accuracy points** over a coin; a 2-point effect needs roughly
**4,900**; human replays arrive at about **330 clean games per day**. Every preview-level null in
this project sits inside that blind spot. Their objection is not pessimism — it is the reason
`engine/mew.js` exists.

And their own proposed way out is the thing that is already built: *"if you can find a super
computer that can fight itself on Pokémon Showdown a million times a minute, perhaps it's
possible."* That is MEW — self-play inside the **official** pinned Showdown engine, on real
six-Pokémon teams sampled from the clean store, with logs passing through the same `extract()` as a
downloaded replay. It runs at 1,000 gated games. See item 2 above: the working external ratio is
10:1 self-play to human and ours is 0.15:1.

Their late-game point stands and is **not** answered by volume. Their example — *"stalling a
tailwind because your scarf Urshifu in the back can clean up once it has speed advantage"* — is a
plan that pays off many turns later, and it is precisely what MILTANK's rollout should price and
what a one-ply policy structurally cannot. It is also what tonight's leaf calibration says we cannot
currently value: a flat reliability curve means the leaf does not distinguish a winning endgame from
a losing one.

### Their challenge 3 — RNG and human variance blunt RL, and determinism gets you exploited

This is the sharpest of the three and it lands on a real, open, unmeasured risk here.

> *"The same turn 1 play will win one match and lose you the other, even against the same player
> with the same team and the same leads."*

**Quantified.** R4 ran 1,312 seed pairs — the identical matchup from both sides — and **777 of them,
59.2%, came back 1-1 splits.** That is their claim as a measurement: in a clear majority of
identical matchups the outcome flipped on variance alone. It is exactly why only the **535 decisive
pairs** are scored, and why an SPRT is used rather than a fixed-n win rate.

> *"It needs to have an element of unpredictability… otherwise you end up with the Nuzlocke Bot
> issue of it being exploitable."*

**Also measured, and this is the uncomfortable part.** WOBBUFFET — a counter hill-climbed over MAG's
own feature weights — beat MAG **63.2%, 95% CI [56.6, 69.3]**, with a mirror control at 47.5%,
found in forty minutes. Their prediction is correct and ABRA has the number for it.

**And here is the live tension nobody has resolved.** ABRA separately measured that taking the
**best** move instead of sampling from the fitted distribution is worth **+12 points raw and 79.7%
of decisive pairs**. That is a large, real gain — and it makes the policy *more deterministic*,
which is precisely the direction this commenter warns leads to exploitability. `MODELS.md` already
states the principle: *"a policy can improve on average and stay exactly as exploitable; those are
different numbers and only one of them has been moving."*

So we shipped a change that improves average strength and plausibly worsens readability, and the
readability number is **three feature generations stale** (17 features then, 53 now). We do not know
the current exploitability of the build we are running. **This raises WOBBUFFET from a backlog item
to the open question this comment has correctly identified.** `engine/exploit.js --target
<weights.json>` is the instrument and it exists.

---

## A second comment — the proposed architecture is ABRA's, with one idea we do not have

**Source:** a second comment on the same thread, supplied by Will.

They propose: an AI that scores **board-state quality** the way a chess engine does; a simulator
enumerating *"every possible multiverse of how the turn can play out"*; the state-scorer applied to
each; a second stage choosing the play **with consideration for what the opponent is likely to
choose**; and *"perhaps another AI can try to trim things down to a more manageable size."*

**That is MILTANK, component for component**, arrived at independently by a competitive player:

| Their proposal | ABRA |
|---|---|
| board-state quality AI | the leaf — `rollout_leaf.js` / `chooseTeamPreview`, and `engine/position_features.js` |
| simulate every multiverse of the turn | `engine/medicham2-browser.js` Monte-Carlo rollout |
| second stage picks the play | `engine/miltank.js` |
| with consideration for the opponent | the opponent model; SLOWKING's equilibrium at preview |
| another AI trims it down | top-K pruning, already implemented in `engine/fit_joint.js` |

Worth saying plainly: the architecture is not the open problem. **Both of its stated challenges are
where we actually are.** They name compute as the constraint — R2 measured leaf cost at 477 boards
over 200 games, against Trailer's hard 45-second live budget. And they name the state-scorer as the
component everything rests on, which is the one we measured tonight as **flat: 50.99%, p=0.47**.

### The one idea here that ABRA does not implement

> *"A common mindset for top players is to not pick what can get you in the best position, but pick
> the option that has the least ways it can go badly."*

**MILTANK does not do this.** It takes an argmax over the **mean** rollout value — expected value,
which by construction is indifferent between a line that wins 60% of the time flatly and a line that
wins 90% of the time unless one thing happens, in which case it loses on the spot. Those are the
same number and a strong human treats them as completely different plays.

The rollouts already contain everything needed to tell them apart: MILTANK draws a **distribution**
of outcomes per candidate action and then throws all of it away except the first moment. Selecting
on a lower quantile (say the 25th percentile of rollout value) instead of the mean, or on
minimax-regret, is a change to the **selection rule only** — no new model, no refit, and it can be
scored on the same paired-SPRT harness R4 already used.

It also connects to challenge 3 in the previous entry. Downside-aware selection is not the same as
randomising, but both push away from the brittle, maximally-exploitable line that a pure argmax
walks into. And it is the kind of change this project has repeatedly found to be worth more than new
features: *how the policy is used* beat every change to what it knows, twice.

**Filed to SEARCH as a real experiment**, not a note. It is cheap, it is testable on existing
machinery, and it comes from a domain expert describing how good players actually decide.

### Filed from the talks and the comments

| Item | Division | Status |
|---|---|---|
| **Audit whether `board.js` reconstructs the player's information state at decision time, or leaks later-revealed info into the fit** | MEASURE | filed 2026-08-04 |
| **Re-measure exploitability on the CURRENT 53-feature greedy build** — average strength went up, readability is unmeasured since 17 features | MEASURE | filed 2026-08-04 |
| Advantage-reweighted BC as the rung between MAG and MACHAMP — **behind** the leaf fix, which needs a trustworthy critic | MEASURE | filed 2026-08-04 |
| Self-play volume — the working ratio is 10:1 self-play to human; ABRA runs 0.15:1 | MEASURE | filed 2026-08-04 |
| Opponent prediction is the external binding constraint — raises XATU beyond the move slot | ENGINE | filed 2026-08-04 |
| MILTANK has a hard **45-second** per-decision budget in real VGC; unstated in SEARCH.md, unchecked against R2's leaf cost | SEARCH | filed 2026-08-04 |
| Multi-turn plans (their Tailwind-stall / Scarf-Urshifu example) are what a flat leaf cannot value — a concrete test case for the leaf fix | SEARCH | filed 2026-08-04 |
