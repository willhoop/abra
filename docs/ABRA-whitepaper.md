# From a Correct Simulator to a Ladder Player

### ABRA on Pokémon Champions VGC 2026 Reg M-C, open team sheets

**Version 1.0.0 · Last updated 2026-09-24**
**Line: abra/regmc** — `CHANGELOG-REGMC.md`.

**1.0.0 — THE SIMULATOR IS CERTIFIED ON REG M-C, SO THE SEARCH CAN BEGIN.** `node engine/quarantine.js
--regulation regmc` reads OPEN on every gating clause on release `eaa5becc54eb`. That was the
foundation. This paper is about what is built on it: a player that solves each turn of a Reg M-C
doubles battle as a simultaneous-move game, inside our own copy of the game, fast enough to play on the
Showdown ladder under the tournament clock. The finish line is a settled rating high on the
`gen9championsvgc2026regmcbo3` ladder, played by the account `medicham32`, which Showdown staff have
approved. **No solver result in this paper is a ladder result, and no strength figure is published.**
Every solver measurement so far is either OFFLINE (fitted and scored on recorded human games, with no
simulator in the path) or PRE-GATE (played inside a simulator that had not yet passed its gate). The
offline figures are given with their receipts. The PRE-GATE figures are withheld until they are re-run
on the certified release (§3.8).

**WHAT THIS EDITION REMOVED.** This paper was the Reg M-B white paper until 1.0.0. Reg M-B is retired
(Will, 2026-09-24). Its published record is the 7.0.0 edition, which stays exactly as it was written
and is read with `git show bfbf9cf9:docs/ABRA-whitepaper.md`. Every model figure that edition carried
outside the simulator had already been withdrawn at 7.0.0, and the models themselves are now being
rebuilt from scratch. So those figures are deleted here, not captioned. The Reg M-B simulator figures
appear once, in §5, as the OLD SERIES of the basis-change comparison, labelled as Reg M-B.

---

## Abstract

Pokémon VGC doubles is a two-player game with simultaneous moves, a large joint action space, heavy
chance and a small amount of hidden information. Under open team sheets the moves, items and abilities
of all six opposing Pokémon are public. What stays hidden is which four of the six were brought, and
the stat spreads, which decide speed order and damage. ABRA's plan is to search this game at decision
time rather than to learn a policy that plays without search. At each turn it builds a matrix game
between a pruned set of its own joint actions and the opponent's, averaged over the hidden worlds it
still believes possible. It fills each cell by playing the position forward inside MEDICHAM, its own
simulator, with shared dice across cells, and it solves the matrix for an equilibrium mix (SLOWKING).
Human-behaviour models narrow the candidates (MAG, DODUO) and fill in the hidden information (XATU). A
value network (PORYGON2), trained by a self-play loop (MEW, MACHAMP), later replaces the rollout at the
leaf. A capped exploit dial (HYPNO) moves off the equilibrium only as far as a computed bound allows,
and an exploiter (WOBBUFFET) measures how beatable each version is. Team preview is its own matrix game
(CHOMP). A live client (ROTOM) plays it on the ladder under Showdown's clock. The whole plan rests on
one fact, which this release establishes for Reg M-C: MEDICHAM plays the same game as the official
simulator, clause by clause, on every instrument the project owns.

---

## 1. The thesis: the engine is the foundation, the search is the point

A search is worth exactly what its model of the game is worth. A simulator that plays a slightly
different game produces confident answers about a game nobody is playing, and nothing in the search
itself can notice. That is why the project spent its first two regulations on MEDICHAM and published
nothing downstream of it until a gate certified it (§4). With the gate open on Reg M-C, the order of
work reverses: MEDICHAM is frozen as the foundation, and the effort goes to the search.

**Why search, not a policy that plays without it.** Three reasons, from the research record
(`docs/_reports/2026-09-23-solver-research-turn-search.md` §2.4):

1. Reg M-C went live on 2026-09-09. Its human corpus is orders of magnitude smaller than the corpora
   that trained the strongest no-search agents, which also play singles, not doubles.
2. The closest prior work, PokaiTrainer (Yu, arXiv 2608.29197), played this exact problem on Reg M-B
   with open sheets. It reports that search beat every raw policy head it trained, and that every
   search agent beat its own policy head [REPORTED, not reproduced].
3. A laptop can afford decision-time CPU search. It cannot afford the self-play volume that the
   no-search equilibrium methods need.

**The metric.** The headline is a settled ladder rating with its standard deviation and the number of
series behind it, read over the last N series with N at least one hundred. It is never the peak. A
peak is the maximum of a noisy walk and sits well above the true rating
(`docs/_reports/2026-09-23-solver-research-humans-and-ladder.md` §3.1). Offline, each model must beat a
named baseline in a pre-registered test before it may be promoted (§3). A strength claim between two
versions of the agent is a sequential probability ratio test (SPRT) at equal wall-clock, on paired
seeds and the same team pairs.

---

## 2. The search plan

Plan version 0.2.0 is `solver/PLAN.md`. The running log is `solver/LOG.md`. This section states the
design. §3 states what exists and what has been measured.

### 2.1 The game as the searcher sees it

| Property | What it forces on the design |
|---|---|
| Both players commit at the same time | The root is a matrix game. Its answer is an equilibrium MIX, not an argmax. A deterministic best response is exploitable by construction. |
| Each side chooses a PAIR of actions | The joint action count is roughly the per-slot count squared. Pruning is mandatory, and it must be measured by JOINT coverage, because per-slot coverage overstates it. |
| Damage rolls, accuracy, critical hits, secondary effects, speed ties | Cell values are noisy. The noise between cells must be paired (common random numbers), or the matrix measures dice rather than actions. A speed tie is a branch to plan both ways, not one die to sample. |
| Hidden information is small under open sheets | What stays hidden is which four of six were brought — `C(6,4)` worlds at preview, `C(4,2)` once both leads are seen — plus the spreads. That is small enough to enumerate worlds rather than learn an abstraction. |
| A chess clock with a per-turn cap | The search must be anytime: stoppable at any moment with a solvable matrix. §2.10 gives the clock. |

### 2.2 The pipeline

Team preview runs once per game, before the first turn:

```
both open sheets
 → CHOMP     every bring-and-lead option per side: C(6,4) × C(4,2) of them
 → PORYGON2  score each cell of the preview matrix (the rollout leaf until PORYGON2 exists)
 → SLOWKING  solve the preview game → a mixed strategy → sample the bring and the lead
```

Then every turn:

```
request + |inactive| clock line
 → XATU      worlds: the back-two posterior × spread candidates, reweighted by what has been seen
 → MEDICHAM  legalActions per side, per world (the engine's own menu, never a hand-built one)
 → MAG/DODUO prune to k1 own and k2 opponent joint actions, with switch and mega slots reserved
 → MILTANK   fill cells: clone the state, step one turn with shared dice, score the leaf
             (truncated rollout now, PORYGON2 later); spend playouts by successive halving
 → SLOWKING  regret matching on the belief-averaged matrix → σ_me, σ_opp, value v*
 → HYPNO     move toward GARY's model of human habit, never further than the ε cap allows
 → sample from σ_play (never argmax) → log every counter
```

The per-turn pipeline follows `docs/_reports/2026-09-23-solver-research-turn-search.md` §3.1. Each
name is a model with one job, one input and one output (§3.1 registry).

### 2.3 SLOWKING — the per-turn equilibrium

For a pruned own set A, a pruned opponent set B and a belief β over worlds w, the cell value is

  M[a][b] = Σ_w β(w) · E[ leaf( step(S_w, a, b) ) ],

where S_w is the current state completed with world w, `step` is one MEDICHAM turn under shared dice,
and the expectation is over playouts. SLOWKING solves max over σ_me of min over σ_opp of σ_meᵀ M σ_opp
by regret matching plus (RM+, Tammelin 2014), which has an average-strategy exploitability bound of
order Δ(√m + √n)/√T for an m × n matrix with payoff range Δ after T iterations. It also carries an
exact linear-programming solve, used to check RM+ on small matrices. Solving costs microseconds against
the cost of filling cells, so the matrix is always solved; only the cells are budgeted.

Two later stages are planned and not built. **Per-world opponent tables**: the opponent knows its own
world, so a single public opponent strategy under-models it (the strategy-fusion error of Long et al.
2010, which runs against the opponent here, not against us). The fix is one opponent regret table per
world, solved by alternating-update linear CFR, as PokaiTrainer does. **Depth two**: simultaneous-move
MCTS below the root with regret-matching selection, which converges (Lisý et al. 2013). It is built
only if a measurement shows that the leaf, not the width, limits play.

### 2.4 MILTANK — filling the matrix under a clock

MILTANK is the harness around SLOWKING. It asks DODUO for the candidate joints, asks XATU for the
worlds, forks the engine's own state through the MEDICHAM API (never a lossy re-seed from a feature
board, which is what broke the Reg M-B harness), and fills cells:

- **Common random numbers.** The i-th playout of every cell draws the same event-addressed dice, so a
  difference between two cells measures the actions, not the luck.
- **Successive halving over MY rows** spends the playout budget where it can still change the answer.
  It never halves over the opponent's columns, because the equilibrium needs those columns filled.
- **Reserved slots.** A share of each shortlist is kept for switch-containing and mega-spending joints,
  because a cheap screen always under-rates them.
- **Anytime.** Cells are filled in priority order. At the deadline the partial matrix is solved, an
  unfilled cell takes the prior's value, and the count of unfilled cells is logged.
- **Fallback that is counted.** If the search throws or runs out of time, the client plays MAG's top
  legal action and increments a counter. A run with zero fallbacks has to be shown, not assumed.

### 2.5 MAG and DODUO — the human policy prior that prunes the tree

MAG scores each slot's options from the public state and both sheets. DODUO scores the PAIR as one
joint action, so that a focus-fire, a redirect-then-attack or a double switch is valued as the
coordinated choice it is. Both are fitted on human Reg M-C open-sheet games only — no simulator is in
the path — and are split by player, so the test players were never seen in training. The pruner's gate
is joint coverage on held-out human turns, with its threshold set before the run.

### 2.6 XATU — the belief over what is hidden

XATU keeps a posterior over the opponent's back two and over each body's spread. The back-two prior is
the store's bring frequencies for that sheet, updated deterministically on every reveal. The spread
posterior is reweighted each turn by the likelihood MEDICHAM's own transition assigns to what was seen:
turn order is a near-hard constraint away from speed ties, and an observed damage percentage is checked
against the roll range from the engine's exported `dmgRange`. The same function prices damage on both
sides of that comparison, because a fact computed twice diverges. The belief prefers what it has
OBSERVED to what the sheet DECLARED: a removed or consumed item is tracked per body.

### 2.7 PORYGON2, MEW and MACHAMP — the value network and the loop that trains it

A truncated random rollout is the first leaf because it needs nothing trained. PORYGON2 replaces it: a
network v_θ(public state, world) trained on search targets from self-play, mixed with game outcomes.
MEW is the self-play factory: it plays games on a frozen MEDICHAM release and stamps every record with
the release id and the weights digest, so that data from a moved engine is dropped or down-weighted,
never mixed silently. MACHAMP is the training loop: expert iteration, with a league that keeps a
human-behaviour anchor so self-play does not drift into a game humans do not play. Training is in
Python, inference in hand-written Node, and a JavaScript-against-Python parity test must go red on a
perturbation before it is trusted.

PORYGON2 is promoted only up a ladder of tests, each against a named baseline (`solver/PLAN.md`
Appendix B):

| Rung | Question | Must beat |
|---|---|---|
| V0 | Better than material? | a logistic model on the difference in bodies alive and in HP |
| V1 | Does it know the engine's game? | the same baseline, against MEDICHAM rollout values |
| V2 | Does it help the search? | the same search with the material leaf, by SPRT at equal wall-clock |
| G1 | Is the next generation better? | the previous checkpoint, by SPRT on the same release |
| W | Did it run? | counters for leaf evaluations, prunes and fallbacks — a zero fails |

Turns one to three are always reported separately: the closest prior work found its value network
stayed optimistic early in the game [REPORTED].

### 2.8 HYPNO and GARY — a capped exploit dial

An equilibrium mix cannot lose much to anyone, and it also does not take points from predictable
opponents. HYPNO trades a bounded amount of the first property for some of the second. GARY models what
humans actually click in a given situation bucket. HYPNO then plays an ε-safe response to GARY's model:
the worst case of the played mix must stay within ε of the equilibrium value v* on every decision, the
Restricted Nash Response construction of Johanson, Zinkevich and Bowling (2007). The trust placed in a
bucket grows with its data, p(bucket) = p_max · n/(n + K). The starting cap is half a win-probability
point per decision (Will, 2026-09-24). A GARY bucket that does not beat the equilibrium prediction on
held-out games gets p = 0.

### 2.9 WOBBUFFET and DUSK — measuring the holes, closing the endgames

WOBBUFFET is trained against a frozen version of the agent to find what beats it. Its win rate must
not rise from one generation to the next; if it does, the new version is more exploitable even if it
beats the old one head to head. DUSK computes exact values for small late-game positions, so the search
does not estimate what can be solved.

### 2.10 The clock

The Reg M-C Bo3 format is `[Gen 9 Champions] VGC 2026 Reg M-C (Bo3)`, whose ruleset is `Flat Rules`,
`VGC Timer`, `Force Open Team Sheets` and `Best of = 3` (`pokemon-showdown-mc/config/formats.ts:295-299`,
checkout `f10d679`). The timer rule reads, verbatim (`pokemon-showdown-mc/data/rulesets.ts:778-785`; the
Champions mod's own timer line is commented out):

```
vgctimer: {
    desc: "VGC's timer: 90 second Team Preview, 7 minutes Your Time, 1 minute per turn",
    ruleset: [
        'Timer Starting = 420', 'Timer Grace = 90',
        'Timer Add Per Turn = 0', 'Timer Max Per Turn = 55', 'Timer Max First Turn = 90',
        'Timeout Auto Choose', 'DC Timer Bank',
    ],
```

So each player has a bank of `Timer Starting = 420` seconds with no increment, and no single request
may take more than `Timer Max Per Turn = 55` seconds. The unit of spend is a REQUEST, and a
replacement after a knock-out draws on the same bank. The client parses the `|inactive|` line on every
request and budgets

  budget = min( X − margin, (bank − reserve) / E[remaining requests] ),

where X is the time left this turn and E[remaining requests] is read from the store as a function of
turn number and bodies left — never typed. The reserve is asymmetric on purpose: an expired turn
concedes one server-chosen move, but an empty bank forfeits the game. The search workers are started
at connect time and warmed during team preview, because a fresh Node process runs MEDICHAM several
times slower until the JIT tiers up (`warm_state_effect` in the speed record the research report cites).

### 2.11 ROTOM — the live client

ROTOM replaces `engine/mag_bot.js`, which only accepted challenges and never searched the ladder. It
plays `gen9championsvgc2026regmcbo3` only — the bo1 ladder is closed-sheet and out of scope. It reads
its password from a git-ignored file or the environment, never the command line. It plays one series
at a time, rotates a small set of real top ladder teams per series (Will, 2026-09-24), and stops on a
kill-switch file. It stays connected through a Bo3 series, because the rating updates once per series
and a rename forfeits it, and it carries game-one observations into games two and three. It rejoins
every open room after a disconnect and re-reads the last request before choosing. A machine-wide lock
refuses a ladder search while one of Will's own accounts could be laddering the same format. It logs
one record per series: arm, ε, both players' ratings before and after, score and expected score, the
number of HYPNO deviations, clock used, the engine release and the weights digests.

### 2.12 How a version is judged

| Layer | What | Rule |
|---|---|---|
| In-process arena | Both agents play inside MEDICHAM through the API | A frozen release, a census pin and the frozen Reg M-C pool; `--games` and every flag recorded |
| Local-server arena | Both agents play through ROTOM on a local Reg M-C server, timer on | Proves the client and the clock, not strength: zero timeouts, zero bank forfeits |
| Head-to-head | SPRT at equal wall-clock, paired seeds, the same team pairs | Promotion only on a pass |
| Exploitability | Root exploitability logged on every decision; WOBBUFFET against the frozen agent | The exploiter's win rate must not rise |
| Ladder | One account; the arm is drawn per series by a seeded coin committed in advance; the metric is the mean per-series residual S − E | Headline: mean rating over the last N series ± SD, N at least one hundred. Never the peak |

Rating noise on the ladder is large: the research report derives the stationary spread of a rating
under the ladder's update rule and the number of series needed to resolve a given gain
(`docs/_reports/2026-09-23-solver-research-humans-and-ladder.md` §3.1 to §3.3). The practical conclusion:
a large gain can be read on the ladder in weeks, and a small one must be settled offline.

### 2.13 Milestones

| M | What lands | Exit test | Status |
|---|---|---|---|
| M0 | Reg M-C MEDICHAM gate open; the solver API merged | the gate reads OPEN; the API's legality probe agrees with the authority | **Gate OPEN at 1.0.0.** The API is merged. The mid-turn choice callback (a faint replacement or pivot switch-in asked, not pre-decided) is not built |
| M1 | DODUO split from MAG; XATU bring posterior; GARY buckets; MAG intersected with `legalActions` | DODUO beats the no-pair model; XATU beats store bring frequencies | MAG, DODUO and XATU v1 built offline; GARY not built |
| M2 | SLOWKING + MILTANK: one-ply matrix, rollout leaf, reserved slots | solver unit tests; joint coverage over the pre-set bar; SPRT against greedy one-turn and against MAG with no search | built; strength not measured on the certified release |
| M3 | Clock and ROTOM on a local server; the offline arena | timer-on series with zero timeouts and zero bank forfeits; a disconnect drill | arena built; ROTOM not built |
| M4 | CHOMP v0; ALAKAZAM v1; the first ladder burn-in at ε = 0 | preview head-to-head against the human-modal bring; the per-series residual within one SE of zero | not started |
| M5 | PORYGON2 on MEW self-play; the MACHAMP loop | V0 → V1 → V2; G1 passes twice | not started |
| M6 | Per-world opponent tables; WOBBUFFET; DUSK | a toy Bayesian game solved exactly; SPRT at equal wall-clock; exploiter win rate not rising | not started |
| M7 | HYPNO + GARY on the ladder | ε Pareto sweep offline; per-series randomised ladder A/B | not started |
| M8 | CHOMP v1, DITTO (team builder), the GURU replicator test, KADABRA (coach) | CHOMP v1 beats v0; DITTO survives the pilot-confound check | not started |

---

## 3. What exists, and what has been measured

### 3.1 The model registry

Every model except MEDICHAM is new code under `solver/`, written from scratch for Reg M-C and open
sheets. The old Pokémon names are kept for the roles `solver/PLAN.md` §2 gives them. SEARCH becomes the
SOLVER division, which owns `solver/` and every model below except MEDICHAM.

| Model | Role | Status on 2026-09-24 |
|---|---|---|
| **MEDICHAM** | The simulator and its solver API | **Certified on Reg M-C (1.0.0).** The only old model kept |
| **MAG** | Per-slot action scorer: the human policy prior | v1 built, offline |
| **DODUO** | Joint coordinator: scores the pair as one action | v1 built, offline |
| **XATU** | Belief over the back two and the spreads | v1 built, offline |
| **SLOWKING** | Per-turn simultaneous-move solver | v1 built; unit-tested |
| **MILTANK** | Search harness: candidates, shared-dice playouts, halving, clock | v1 built; strength PRE-GATE, withheld |
| **PORYGON2** | Value network | to build |
| **MEW** | Self-play factory on a frozen release | to build |
| **MACHAMP** | Training loop and league | to build |
| **GARY** | Human habit per situation bucket | to build |
| **HYPNO** | Capped exploit dial | to build |
| **WOBBUFFET** | Exploitability best-responder | to build |
| **DUSK** | Endgame tables | to build |
| **CHOMP** | Team-preview solver, rebuilt inside ABRA under `solver/chomp/` | to build. The old CHOMP repository runs on stale mainline data and is reference only |
| **JOLTEON** | Optional fast pre-screen for CHOMP's preview matrix | built only if PORYGON2 is too slow to score every cell |
| **ROTOM** | The live ladder client | to build |
| **ALAKAZAM** | The assembled agent | to build |
| **GURU** | Descriptive meta: usage, sets, archetypes, bring and lead, Bo3 adaptation | v0 exists, descriptive |
| **DITTO** | Team builder | to build |
| **KADABRA** | Coach: explains ALAKAZAM's logged decisions | to build |

### 3.2 The human dataset and the descriptive meta — OFFLINE

The human-play dataset parses the Reg M-C Bo3 store into turns and side-turn decisions with the full
joint action where it is visible, excluding named and behavioural bots, custom-rule rooms, the Illusion
exclusion and games played before the Eject Button authority fix (`docs/_reports/2026-09-23-human-dataset.md`).
None of Will's accounts is in it, and `medicham32` is on the exclusion list of both the dataset and the
meta. The descriptive meta (GURU v0) finds that games cluster strongly by player, so every interval it
reports is clustered by player; its archetypes did not meet their pre-set stability bar and are treated
as rough (`docs/_reports/2026-09-23-regmc-meta.md`). Neither reads MEDICHAM, so neither is quarantined.

### 3.3 MAG v1 and DODUO v1 — OFFLINE (abra/regmc 0.113.0)

Fitted and scored on human games only, split by player. On the held-out test players (25,477 exact
joint actions), DODUO's joint log-loss is 2.730, 95% CI 2.699–2.761, against 2.921 for the v0 prior it
replaces (CHANGELOG-REGMC 0.113.0, read from `solver/mag/model/mag-doduo-v1.metrics.json`). The Node
forward pass matches Python to 2.1e-14, and `solver/tests/test-mag-doduo.js` passes 3,826 checks after
going red on deliberate breaks first. The weakest slices remain switch turns and turn one
(`docs/_reports/2026-09-24-mag-doduo-v1.md`). This measures how well the models PREDICT humans. It says
nothing yet about how well they PRUNE for a search; that is the joint-coverage gate of M1.

### 3.4 XATU v1 — OFFLINE (abra/regmc 0.114.0)

On 10,942 held-out sides, XATU's turn-one log-loss on the true back pair is 1.348 against 1.792 for a
uniform belief, and the true bring is never ruled out — zero of 10,942 (CHANGELOG-REGMC 0.114.0,
`docs/_reports/2026-09-24-xatu-v1.md`). Spread narrowing is weak: most candidate values survive a game.
That is the part of XATU that reads MEDICHAM's damage function, and it is the part to improve.

### 3.5 SLOWKING v1 and the MILTANK v1 skeleton — built (abra/regmc 0.115.0)

`solver/tests/test-slowking.js` passes 1,559 checks: rock-paper-scissors solves to uniform, known small
games solve to their linear-programming answer, RM+ stays under its proven bound, and dominant actions
are found in constructed fixtures. `test-miltank.js` passes 3,414 and `test-arena.js` 15, each shown red
on deliberate breaks first (CHANGELOG-REGMC 0.115.0).

### 3.6 Playouts: a worker pool (abra/regmc 0.116.0)

A worker-process pool fills MILTANK's cells bit-identically to the serial path at a pass cap. Before
cut-short passes were started at golden-ratio offsets, the pool left 34.8% of cells empty at a one-second
budget (CHANGELOG-REGMC 0.116.0). `test-playout-speed.js` passes 1,184 checks. About four-fifths of a
playout is the engine's own turn, so the engine's speed is the search's speed
(`docs/_reports/2026-09-24-playout-speed.md`).

### 3.7 Lean playouts (abra/regmc 0.116.1)

A lean battle mode runs the same turn with no protocol text, no counters and tag answers from a table.
It is proven board-identical to a full battle on every game of the Reg M-C `--games 1200` lattice (955
games, 22,283 turns) and on 300 human-sheet games (2,518 turns), and the test goes red on a deliberate
break. Per MILTANK playout it is 1.25x to 1.33x faster in paired blocks of main-thread CPU, with the cell
values hashed equal (CHANGELOG-REGMC 0.116.1, `docs/_reports/2026-09-24-lean-mode.md`).

### 3.8 The arena shakedowns — PRE-GATE, figures WITHHELD

MILTANK has played shakedown matches in the offline arena against a greedy player that takes the
prior's top joint action (`docs/_reports/2026-09-24-slowking-miltank-arena.md`,
`docs/_reports/2026-09-24-playout-speed.md`). **Their win rates are not printed here.** They were played
inside a MEDICHAM that had not passed its Reg M-C gate, and the arena reads the live engine tree rather
than a frozen release. Under this project's quarantine rule a figure downstream of an uncertified
simulator is withheld, not captioned — the gate opening makes it RE-RUNNABLE, not true. The
shakedowns did establish two engineering facts that do not depend on the simulator being right: the
first harness was starved of playouts at a one-second budget, and cheaper playouts (§3.6, §3.7) came
before any strength claim. **Owed before a strength figure is published:** the arena pinned to a frozen
release at or after `eaa5becc54eb`, a census pin and the frozen pool, re-run at equal wall-clock, and
read by SPRT.

---

## 4. The foundation: MEDICHAM certified on Reg M-C (abra/regmc 1.0.0)

### 4.1 What the gate requires

`engine/quarantine.js --regulation regmc` reads only Reg M-C artifacts (`data/<name>-regmc.json`) and
the frozen pool `data/team-pool-frozen-regmc`. A missing, stale or duplicate artifact reads
CANNOT-ANSWER, never a pass. The whole-game clause plays three team lattices, because `--games` selects
WHICH teams play, not how many of the same: a zero on one lattice is a fact about that lattice. For
each lattice ℓ the gating quantity is

  B_ℓ = `state.games` − `state.games_board_never_diverged`,

and the gate is open only when every B_ℓ is zero, no game threw, the undeclared narration-only count
N_ℓ is zero on every lattice, and every other clause passes. The bar is the BOARD — commentary may
differ, boards may not — and narration is a second gate of its own (Will, 2026-08-22).

### 4.2 The reading

Release `eaa5becc54eb`, census pin `123aa264f88d`, pool `data/team-pool-frozen-regmc`, lattices
`--games 1200`, `--games 1600` and `--games 1900`, flags `--steering empirical --arm middle --end-state`. Account:
`docs/_reports/2026-09-24-regmc-gate-final.md`.

| Clause | Reading on `eaa5becc54eb` |
|---|---|
| Damage differential | 0 disagreements of 6000 at the midpoint, the top, the bottom and all 14 interior roll indices, seed 20260804 (`data/engine-diff-regmc.json`) |
| Roster, items | 166 of 166 boards match; the red demonstrations bite, 28 of 28 (`data/roster.items-regmc.json`) |
| Roster, abilities | 210 boards match of 214 in scope (`data/roster.abilities-regmc.json`) |
| Roster, moves | 510 boards match of 511 in scope (`data/roster.moves-regmc.json`) |
| Whole game, lattice 1200 | 955 games, 954 compared and 1 void, no board parts (`data/game-differential-regmc.json`) |
| Whole game, lattice 1600 | 1266 games, no board parts (`data/game-differential.g1600-regmc.json`) |
| Whole game, lattice 1900 | 1497 games, no board parts (`data/game-differential.g1900-regmc.json`) |
| Narration | zero undeclared on every lattice; the baseline is stamped at zero on the 955-game lattice (`data/whole-game-baseline-regmc.json`) |
| Staged mechanics | 4867 games, none threw, none diverged (`data/all-mechanics-fire-regmc.json`) |
| Census | 1024 rows live of 1024 probed (`data/mechanics-census-regmc.json`) |
| Open defects | no open register row names a RED instrument; 205 verdicts read (`data/register-reality-regmc.json`) |

Of the four abilities in scope and not matched, three are announcement-only on receipts and one is
Illusion, the declared exclusion. The move not matched is deferred by its owner (CHANGELOG-REGMC 1.0.0).
Coverage: every move above 25 clicks is measured.

**What the gate does not include, stated.** Reg M-B's certification was followed by a wide held-out
draw, an instrument the gate does not run, which on Reg M-B had caught what the lattices could not
(§5). **No held-out draw has been run on Reg M-C.** It is owed, and it is the first measurement to make
on `eaa5becc54eb`.

### 4.3 How it got here: the Reg M-C line from 0.1.0 to 1.0.0

This is the fold-in of every running-notes row on the `abra/regmc` line. The row-by-row record is
`docs/RUNNING-NOTES.md` and `CHANGELOG-REGMC.md`.

- **A second authority (0.1.0).** A second Showdown checkout, `pokemon-showdown-mc` at `f10d679`, so that
  pulling Reg M-C can never move the bytes Reg M-B's figures rest on. The delta against the pinned Reg
  M-B authority: species +35, moves +15, items +18, abilities +0, nothing removed — 41 new mechanics
  (15 abilities, 14 moves, 12 held items), not 35 species. Two moves legal in both regulations had their
  PP cut, and one item was unbanned: changes no added-or-removed list reveals.
- **The regulation is a flag (0.10.0 – 0.17.0).** One resolver selects the checkout, the species table,
  the census and the gate. The gate answers per regulation from 0.17.0.
- **The new mechanics, each tagged from its handler (0.16.0 – 0.43.0).** Each item and ability new to
  Reg M-C gets a tag derived from its Showdown handler, a probe, and a census row.
- **The lab and the pool (0.3.0 – 0.79.0).** The frozen Reg M-C team pool, a per-regulation census and
  roster, and every refused roster fixture rebuilt legal rather than scoped out.
- **Engine passes against the lattices (0.40.0 – 0.94.0).** Each fix a defect the differential or a
  staged mechanic found, most in both regulations. After pass ten the gate read CLOSED on five of 10
  clauses with boards already at zero (0.87.0).
- **The solver API and the move menu (0.95.0 – 0.100.0).** `engine/medicham_api.js` exposes clone, an
  RNG handle, `legalActions`, a non-mutating `step` and a terminal test. `legalActions` agreed with
  the authority on 5,526 of 5,552 slots; the 26 were the engine's own move menu, and three menu fixes
  brought the disagreement to zero at `--games 45` (0.96.0 – 0.98.0).
- **The last reds (0.101.0 – 0.112.0).** Roster staging restored, register instruments that answer
  under Reg M-C, and a merge pass after which each gate failed on one clause (0.112.0).
- **The solver lands (0.113.0 – 0.116.1)** — §3.3 to §3.7.
- **Narration to zero (0.117.0 – 0.123.0).** The last commentary differences were closed one by one
  until the three lattices read zero undeclared.
- **The gate (0.124.0 – 1.0.0).** An item-roster red demonstration re-aimed and the census republished
  (0.124.0); the full re-read OPEN (0.125.0); declared as this release.

---

## 5. The basis change: from Reg M-B to Reg M-C (abra/regmc 1.0.0)

### 5.1 Why this is a major revision

A major version here is a change of BASIS: the question a published number answers changes, so an old
and a new figure cannot be linked by a sentence of the form "X became Y". This follows the ESS
*Guidelines on Revision Policy* (Eurostat, 2013, `KS-RA-13-016`), which separate a routine revision from
a major one — "a change in the concepts, definitions and/or classifications used to produce the
series" (Item 3.0) — and require the major one to ship with its reasons, its impact, and "a comparison
between the 'new' and the 'old' series" (Item 3.4). Two things change at once here:

1. **The regulation.** Every figure now answers a question about Reg M-C, on the Reg M-C authority,
   over a Reg M-C pool. Reg M-B is retired (Will, 2026-09-24) and its line is CLOSED at 7.0.0.
2. **What may be published.** The gate opening lifts the quarantine on the Reg M-C line: the
   downstream artifacts become RE-RUNNABLE on `eaa5becc54eb`, and nothing measured before that release
   may be quoted until it is re-run (CHANGELOG-REGMC 1.0.0).

### 5.2 Old series against new series

The simulator's certification is the one series that exists on both lines. The old series is Reg M-B
at 7.0.0, release `0d7b1d9db6d1`, on the pinned Reg M-B authority. The new series is Reg M-C at 1.0.0,
release `eaa5becc54eb`, on `pokemon-showdown-mc`. Each old figure is read from the artifact that commit
wrote.

| Clause | Reg M-B, 7.0.0 (old) | Reg M-C, 1.0.0 (new) | Linkable? |
|---|---|---|---|
| Damage differential | 0 of 6000 (`bfbf9cf9:data/engine-diff.json`) | 0 of 6000 (`14c36f21:data/engine-diff-regmc.json`) | Yes: the same design and seed; each is zero on its own authority |
| Roster, items | 148 of 148 in scope (`bfbf9cf9:data/roster.items.json`) | 166 of 166 (`14c36f21:data/roster.items-regmc.json`) | No: the in-scope set grew with the regulation |
| Roster, abilities | 196 of 200 in scope (`bfbf9cf9:data/roster.abilities.json`) | 210 of 214 (`14c36f21:data/roster.abilities-regmc.json`) | No: a different in-scope set |
| Roster, moves | 496 of 497 in scope (`bfbf9cf9:data/roster.moves.json`) | 510 of 511 (`14c36f21:data/roster.moves-regmc.json`) | No: a different in-scope set |
| Whole game, lattice A | 961 games, 0 parted (`bfbf9cf9:data/game-differential.json`, `--games 1200`) | 955 games, 0 parted (`14c36f21:data/game-differential-regmc.json`) | No: a different pool, so different teams |
| Whole game, lattice B | 1069 games, 0 parted (`bfbf9cf9:data/game-differential.g1350.json`, `--games 1350`) | 1266 games, 0 parted (`14c36f21:data/game-differential.g1600-regmc.json`) | No |
| Whole game, lattice C | 1497 games, 0 parted (`bfbf9cf9:data/game-differential.g1950.json`, `--games 1950`) | 1497 games, 0 parted (`14c36f21:data/game-differential.g1900-regmc.json`) | No: the equal count is a coincidence of two different lattices |
| Staged mechanics | 4632 games, 0 threw (`bfbf9cf9:data/all-mechanics-fire.json`) | 4867 games, 0 threw (`14c36f21:data/all-mechanics-fire-regmc.json`) | No: a different census drives the staging |
| Wide held-out draw | no board parted (the readout below) | **not run** | — |

The Reg M-B held-out draw is written under `data/verification/`, where no gate run can overwrite it,
so it is quoted as the readout the 7.0.0 edition quoted (CHANGELOG.md 6.83.0):

```
Reg M-B held-out draw, release 0d7b1d9db6d1, --games 12000, pool digest e398641bda45
state.games                               7182
state.games_board_never_diverged          7182   -> board-material 0
```

**Impact.** Only the damage differential links, and it reads zero on both. Every other old figure
answered a question about a different regulation over a different pool, and the right sentence about
it is "that answered a question we no longer ask" — not "it became". No model figure from the Reg M-B
line survives into this edition: they were withdrawn at 7.0.0, and the models are rebuilt.

---

## 6. Mathematics

**Matrix game.** For payoff matrix M (m × n), the value is v* = max_σ min_τ σᵀ M τ over mixed
strategies σ ∈ Δ_m, τ ∈ Δ_n. The exploitability of a pair (σ, τ) is
max_τ' σᵀ M τ' subtracted from max_σ' σ'ᵀ M τ, i.e. how much each side could gain by deviating.

**Regret matching plus.** Each player keeps cumulative regrets R_t(a) = max(0, R_{t−1}(a) + u_t(a) − ū_t)
and plays in proportion to them; the average strategy's exploitability after T iterations is bounded
by a term of order Δ(√m + √n)/√T.

**Common random numbers.** For two cells a, a′ scored with the same dice ω_i,
Var[f(a, ω) − f(a′, ω)] = Var f(a) + Var f(a′) − 2 Cov(f(a), f(a′)). The covariance is large when the
actions differ in a few decisions and share most of the luck, so the difference is far less noisy than
with independent dice.

**Belief update.** For a world w and an observation o, β′(w) ∝ β(w) · P_MEDICHAM(o | S_w, actions),
with turn order treated as a near-hard constraint away from speed ties.

**Restricted Nash Response.** The opponent is forced to play the model h with probability p and plays
freely otherwise; p = 0 is the equilibrium and p = 1 a pure best response to h. HYPNO chooses the
largest p whose worst case stays within ε of v*.

**Ladder residual.** For series s with the Elo expected score `E_s = 1/(1 + 10^((R_opp − R_me)/400))`
and result S_s, the per-arm metric is the mean of S_s − E_s, read by SPRT; it is insensitive to where on the
ladder each series was played.

**Sequential probability ratio test.** For hypotheses H0: θ = θ0 and H1: θ = θ1 with error rates α
and β, stop when the log-likelihood ratio leaves [log(β/(1 − α)), log((1 − β)/α)].

---

## 7. Limitations

- **No solver strength figure exists on the certified release.** Everything in §3 is either offline or
  withheld. The first strength claim will be an arena SPRT on a frozen release.
- **No wide held-out draw on Reg M-C** (§4.2). The lattices are a sample; Reg M-B showed a held-out
  draw can see what they cannot.
- **Illusion is declared out of scope**, and closed team sheets are out of scope entirely.
- **The mid-turn choice callback is not built.** Until it is, a faint replacement or a pivot's
  switch-in inside a playout is pre-decided rather than searched.
- **XATU's spread belief is weak** (§3.4), so speed-order and damage uncertainty stay wide.
- **The prior art is reported, not reproduced.** PokaiTrainer's figures were read through a summary of
  the paper and are not used as targets.
- **Self-play throughput is unknown** until MEW measures it; the estimates in the research reports span
  more than an order of magnitude.
- **The ladder is noisy.** Small gains cannot be resolved there in any reasonable time and must be
  settled offline.

---

## 8. References

- Brown, N., Bakhtin, A., Lerer, A., Gong, Q. (2020). Combining deep reinforcement learning and search for imperfect-information games (ReBeL). NeurIPS.
- Eurostat (2013). *ESS Guidelines on Revision Policy for PEEIs*, `KS-RA-13-016`.
- Hart, S., Mas-Colell, A. (2000). A simple adaptive procedure leading to correlated equilibrium. *Econometrica*.
- Johanson, M., Zinkevich, M., Bowling, M. (2007). Computing robust counter-strategies. NIPS.
- Lisý, V., Kovařík, V., Lanctot, M., Bošanský, B. (2013). Convergence of Monte Carlo tree search in simultaneous move games. NIPS.
- Long, J., Sturtevant, N., Buro, M., Furtak, T. (2010). Understanding the success of perfect information Monte Carlo sampling in game tree search. AAAI.
- Schmid, M. et al. (2023). Student of Games. *Science Advances*.
- Tammelin, O. (2014). Solving large imperfect information games using CFR+. arXiv:1407.5042.
- Wald, A. (1945). Sequential tests of statistical hypotheses. *Annals of Mathematical Statistics*.
- Yu (2026). PokaiTrainer. arXiv:2608.29197 [REPORTED, via `docs/_reports/2026-09-23-solver-research-turn-search.md` §2.1].
- Semantic Versioning 2.0.0; Keep a Changelog 1.1.0.
- Project sources: `solver/PLAN.md`, `solver/LOG.md`, `CHANGELOG-REGMC.md`, `docs/RUNNING-NOTES.md`,
  `docs/REGMC.md`, and the reports under `docs/_reports/` named in each section.

The plain-English version of this paper is [the deck](ABRA-deck-plain-english.md). The commands are in
[the technical documentation](ABRA-technical-docs.md).
