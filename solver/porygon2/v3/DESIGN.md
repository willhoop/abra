# PORYGON2 v3 — a value net for search: design

**Status: PLAN.** Written 2026-10-01 by SOLVER after Will approved the v3 plan the same day. It is milestone N4 of `solver/PLAN.md` 0.3.0. It sets the order of work and
the bars. Steps A to C of that plan are built: this document, the harness (`solver/porygon2/v3/evalset.js`) and a
distilled student of v2 (`solver/porygon2/v3/student.py`). Their numbers are in `docs/_reports/2026-10-01-porygon2-v3.md`,
not here. Every bar was written before any net was scored (`solver/porygon2/v3/preregistration.json`). No game was played
for v3.

---

## Corrections to the brief, checked against the sources (2026-10-01)

Each source was read again for this document: the arXiv PDF or abstract, the KataGo methods page, Crossref for the
journal papers, and the English translation of the NNUE paper. Six claims in the outline were wrong or went further than
the source. Each is fixed where it is used below.

| # | The outline said | The source says | What changes |
|---|---|---|---|
| 1 | n-step bootstrapped value targets, citing **MuZero** | MuZero bootstraps n = 10 steps **in Atari**, and n = 5 in Reanalyze. "For board games, we bootstrap directly to the end of the game, equivalent to predicting the final outcome" (Schrittwieser et al. 2020, arXiv 1911.08265, appendix *Training*). | MuZero is not a precedent for n-step targets in a game like ours, which has a result and no rewards along the way. The precedents for bootstrapping are **TD(λ)** (Sutton 1988) and **TD-Gammon** (Tesauro 1995). |
| 2 | "KataGo's blending" of outcome and search value | KataGo trains its **main** value head on the game result. It adds **auxiliary** heads on exponentially weighted future MCTS values (horizons of about 6, 16 and 50 turns) and gives the main head a slightly lower weight (`KataGoMethods.md`, *Short-term Value and Score Targets*). | Our `y = 0.5 z + 0.5 v_deep` (v1, r2) is our own choice and has no KataGo precedent. v3 uses the KataGo form instead: the main head on z, short-horizon search values as auxiliary heads (§3). |
| 3 | Playout-cap randomisation "for cheap labels" | "Only turns with a full search are recorded for training"; the cheap fast searches exist to play **more games** for the value target (Wu 2019, arXiv 1902.10565, §3.1; p = 0.25 in the main run). | It gives cheap **moves** and expensive **labels**. §6 uses it that way. |
| 4 | The search-imitating policy head "reusable as the piKL prior" | piKL regularises the search toward an **imitation-learned human** policy (Jacob et al. 2022, arXiv 2112.07544, abstract). | A policy head that imitates our search is not a human anchor. If the search were anchored to it, the search would be pulled toward its own past output. It becomes MILTANK's candidate ranker (AlphaZero's use of the policy prior). The anchor stays a human-imitation policy: DODUO today, v3's human head once it subsumes DODUO (`solver/PLAN.md` 0.3.0). |
| 5 | "λ 0.03 is harmless (1.48.0 and 1.50.0)" | The 14 s screen passed at 0.525 [0.456, 0.593] (1.48.0). The SPRT stopped at H0 with 0.469 [0.421, 0.517] and a clock ratio of 0.976 (1.50.0). | "Harmless" is not shown. The SPRT shows λ 0.03 is not +20 Elo stronger, and its point estimate is below 0.5. The plan does not depend on it. |
| 6 | Quiescence "fixes" the depth-0 horizon behind the doomed and double Protect | `quiesce 'all'` exists, is OFF and is on no arm. On the probe positions it moved the played repeat-Protect mass from 0.611 to 0.200 (1.23.0). No game has measured it. | §5 makes it a **test**: a 14 s screen and an SPRT at equal clock. It is not counted as a fix. |

Two premises from the brief hold, but each needs a qualifier:

- **The +0.19 overconfidence is in the search's ROOT value, not only in the net.** The postmortem measured MILTANK's
  solved root value over 668 ladder decisions in 90 games: +0.191 [0.062, 0.318] for values in [0.5, 0.9), and
  +0.189 [0.070, 0.275] at turn 1 (`docs/_reports/2026-09-30-ladder-loss-postmortem.md` §5). Two things produce that
  value: gen5's net at depth 0, and a max over noisy rows. A maximum of noisy estimates is biased upward (Smith and Winkler
  2006, *Management Science* 52(3):311–322, "the optimizer's curse"). The harness therefore scores each net's **raw** value
  on the same ladder positions, so the two causes can be separated (§1b).
- **AlphaZero's value target is the outcome z.** It is not a search value. The search-improved target is the policy π
  (Silver et al. 2017, arXiv 1712.01815, "minimise the error between the predicted outcome v_t and the game outcome z").
  The v2 design already made this correction. It still holds.

Checked and correct as stated: AlphaGo memorised outcomes when it trained on every position of a game, with test MSE 0.37
against training MSE 0.19. With 30 million positions, one per game, it reached 0.226 and 0.234 (Silver et al. 2016,
*Nature* 529, "Reinforcement learning of value networks"). Expert Iteration "select[s] a single state from each game".
It says a value function needs "more than 10^5 independent samples" to train without severe overfitting (Anthony et al.
2017, arXiv 1705.08439, §4.2, §5.2). Maia trained **nine** separate models, one per rating bin from 1100 to 1900
(McIlroy-Young et al. 2020, arXiv 2006.01855). Maia-2 uses one model. Skill embeddings for the player to move and the
opponent are added to the attention queries. Games between unequal ratings are over-sampled, and the model has a value
head (Tang et al. 2024, arXiv 2409.20553, §3). For DeepStack (arXiv 1701.01724), ReBeL (arXiv 2007.13544) and Student of
Games (arXiv 2112.03178) as precedents for public-state values, see `solver/porygon2/v2/DESIGN.md` §2. Their titles,
authors and years were checked again. Hinton, Vinyals and Dean 2015 (arXiv 1503.02531) distil a cumbersome model into one
"much easier to deploy" by training on its soft targets. NNUE (Nasu 2018, the WCSC28 appeal document, English
translation by D. Klein) sized its network "such that the amount of positions which can be evaluated per time unit is
equal to" the old linear evaluation. That is the precedent for a cost bar on a learned evaluator. Shannon (1950, *Phil.
Mag.* 41(314)) is the source for quiescence: an evaluation "can only be applied in relatively quiescent positions".
Crossref confirms Sutton (1988, *Machine Learning* 3:9–44) and Tesauro (1995, *CACM* 38(3):58–68).

---

## 0. The goal

The goal is the highest search strength at the ladder clock for a fixed amount of thinking time. Offline accuracy counts
only as far as it predicts that.

The evidence for this goal is the first v2 SPRT. With v2 as gen5's leaf against gen5's own net, at an equal 1 s clock,
the result was **H0, 0.480 [0.441, 0.520]** (612 games, clock ratio 1.009; abra/regmc 1.50.0,
`docs/_reports/2026-09-30-sprt-pikl-and-v2.md`). Offline, v2 was the better net: −0.0127 [−0.0202, −0.0048] log-loss
against gen5 on human positions (1.47.0). But at the same clock it reached **0.39×** the leaf evaluations. A better
value that costs 2.6 evaluations did not pay for itself. NNUE was sized by the same reasoning (Nasu 2018, §2): a faster
evaluation searches deeper, so cost and precision are judged together.

## 1. The test comes first

v3 is judged on the harness before it plays a game (`solver/porygon2/v3/evalset.js`; bars in `preregistration.json`).

**The frozen set.** Every source is held out from every net that is scored on it. `test-porygon2-v3-evalset.js` checks
this (LEAK).
- `ladder`: medicham32's finished Reg M-C ladder games, from four ROTOM runs. No net trained on them, because every
  human dataset excludes the account. A run that is still being written is never read.
- `bo1hi`: bo1 games from v2's TEST split with both players rated 1500 or more. This is the only strong play in the store:
  bo3 has no game with both players at 1500 or more (`docs/_reports/2026-09-30-high-rated-regmc-counts.md`). A bo1 log
  does not show whole sets, so each set is **completed** from the open-sheet population (`positions.js`). The world is
  then plausible, not true. The fill count is recorded for every position.
- `bo3hi`: bo3 TEST games that v1 never saw, with both players at 1300 or more. These are used for calibration only.

Every turn-start position is kept. Each is the world ROTOM would build (`solver/rotom/world.js`), serialised on release
`eaa5becc54eb`. The manifest records every input's sha256 and the output's sha256.

**(a) Ranking agreement with a deep search.** At each labelled position, MILTANK's root is built as it is in play: gen5's
DODUO ranking, 4 × 4 candidates, one reserved switch row and honest worlds. **Each cell is then played to the end** by
gen5's prior on both sides, with common random numbers (`deep.js`). The reference contains no value net. MILTANK's own
leaf is gen5's net, so a reference built on it would score gen5 as agreeing with itself. A net is asked the question it
answers in play: its depth-0 value of the same successor boards, on the same worlds and dice. The metrics are Kendall
τ-b and top-1 agreement of the row values under the reference's equilibrium column mix, the reference **regret** of the
net's own matrix solution in win-probability points, and τ over all cells. The reference's split-half reliability is
reported with every figure: the reference against itself, even-numbered playouts against odd. It measures how noisy the
reference is, and it is not an upper bound on a net's agreement with the full label. Every figure is also given on the
informative positions, where the deep rows are not all equal. The reference has a stated limit. It is "what
happens when two copies of gen5's prior play this out", which is a human-like continuation and not the game value. A
reference built from a stronger player is owed in §6.

**(b) Calibration by rating band.** This is measured against the game result: log-loss, Brier score, ECE and a reliability
table, by source and by min-rating band. It also measures the **gap on values in [0.5, 0.9)**, which is the window of the
postmortem's +0.19, with a game-clustered CI. v3 must close that gap on the ladder positions **at the root of the search**,
not just in the raw net. So the harness figure is necessary, and the ladder re-read of the postmortem table is the final
check. The first reading changes where the work goes (report §2.3). gen5's raw net is already +0.183 [0.100, 0.272] too
high on **our** ladder positions. It is calibrated on strong human positions (bo1 rated 1500 or more: −0.013). So the
gap sits on the positions our agent plays, and better calibration on human data will not close it.

**(c) Cost per evaluation.** Every net is timed in the same process, interleaved round-robin, on the same successor
boards. The figure is the ratio to gen5's net, because the absolute time moves with machine load.

**(d) Then games.** A 14 s not-lose screen (200 games, the same 100 TEST pairs, pair seed 1, role-v1 spreads), then an
SPRT at equal wall clock against the current arm. Read once, at the bound.

**What stops.** Gating on human-outcome log-loss in sub-1200 bo3 stops. v2's gate (a) was −0.0098 [−0.0202, +0.0002]
pooled, and only the two bands below 1200 held enough games to gate (`solver/porygon2/v2/gate-a.json`). That measured how
well a net predicts weak human play. It did not measure how well a net ranks moves for our search.

## 2. Data

| stage | data | why |
|---|---|---|
| pretrain | bo1 public-information positions, rated 1300 or more weighted up, both ratings as inputs (Maia-2's form, §0 table), unrevealed fields as UNK (v2 §2) | the only strong human play in Reg M-C (§1) |
| fine-tune | bo3 open-sheet positions | the game ROTOM plays: open sheets, bo3 |
| search targets | positions from **the strong search at the ladder clock** with role-v1 spreads, and our own ladder games | cheap self-play made v1 worse on humans: r1 against v1 was +0.0045 [+0.0005, +0.0090] on human positions, and its gate (c) was H0 at 0.492 (1.26.0). ExIt and AlphaZero learn from the **expert**, which means the search, not the apprentice |
| never | the frozen evaluation set; any game from before release `eaa5becc54eb` | — |

Outcome-labelled positions are sampled **one per game per epoch**. AlphaGo memorised outcomes when every position of a
game shared one label (0.37 test against 0.19 training), and v2 saw the same thing: training on every position reached
−0.17 train-minus-val by epoch 4, against −0.04 for K = 1 (`docs/_reports/2026-09-30-porygon2-v2-train.md` §2).
Positions whose targets **differ per position** (deep-search values, distillation targets) are not limited in this way.
Each such position has its own label.

## 3. Targets

- **Main head: the outcome z.** This follows AlphaZero, AlphaGo and KataGo, and correction 2 above. Nothing is blended
  into it.
- **Short-horizon search heads (KataGo's form).** These are exponentially weighted future root values of the strong
  search, (1 − λ) Σ_{t' ≥ t} V_search(t') λ^{t'−t}, at two horizons of about 1 and 3 turns, which is the length of our
  games. Their use is measured: r2's deep labels improved self-play log-loss against gen5 by −0.0131 [−0.0178, −0.0084]
  (1.46.0), so a search value carries signal. As a main target it hurt human positions (+0.0033 [+0.00004, +0.0068]
  against v1). An auxiliary head keeps the first effect without the second. TD(λ) (Sutton 1988) and TD-Gammon (Tesauro
  1995) are the precedents for learning from successive predictions. MuZero is not (correction 1).
- **Auxiliary heads** (KataGo's ownership and score, Wu 2019 §4.1: 1.65× learning efficiency in its ablation): survival
  and final HP per member, material, the next KO (side and delay), turns left. v2 already has these heads. v3 adds the
  answer-map head (§4.3).
- **Two policy heads.** `solver/PLAN.md` 0.3.0 makes v3 the joint policy+value net that subsumes MAG and DODUO.
  - **The search head** learns the search's root mix (AlphaZero's π). It ranks MILTANK's candidates and is judged by the
    pruner's coverage test.
  - **The human head** imitates human clicks by rating band, as DODUO does. It is the population model and the piKL
    anchor. The search head is **not** the anchor (correction 4).

## 4. Model

### 4.1 Teacher

A transformer over 12 member tokens, 2 side tokens, the field and 2 rating tokens (v2's architecture,
`solver/porygon2/v2/DESIGN.md` §2.4), with MEDICHAM's per-pair facts on the live board; the answer map is one of its targets (§4.3). It is
trained offline at any cost. It is never a leaf.

### 4.2 Student

The student is a fast net **held to gen5's cost or less**. It is distilled from the teacher's value and auxiliary
outputs on the teacher's own inputs (Hinton et al. 2015), and it is sized the way NNUE was: to the evaluation rate of
the evaluator it replaces. Step C distils **v2** into a student: shared member MLPs with mean and max pooling, no
attention, 39,892 parameters, antisymmetric by construction like v2 (`student.py`). It tests two things: whether a
student keeps the teacher's ranking, and whether its cost meets the bar. Its numbers and its pass or fail against the
pre-registered rule are in the report.

The cost is set by the **features**, not by the network. In the bench, every net's encode costs about the same as
gen5's. v2's 2.6× comes from its attention forward pass, and the student's forward pass costs about what gen5's does
(report §3). So every input the teacher adds is a cost the student pays, and a new input is timed in microseconds
before it goes in.

### 4.3 The live answer map (Will, 2026-10-01): an auxiliary target, not an input

**Will's reasoning.** Players think "Sylveon is my only answer to Garchomp, so I keep it alive until it can KO". When
Garchomp is down to a third of its HP, any of my Pokémon can KO it, and Sylveon stops being special. So the map must be
computed **from the current board**, never from a species chart.

**What it is, and the one implementation.** For each live pair (my i, their j), the map gives P(i beats j): the chance
that i KOs j before j KOs i in a one-on-one exchange, played by MEDICHAM from the live board. Current HP, stat stages,
field and speed control, priority, items still to trigger, damage rolls, accuracy, crits and speed ties all come from
the engine. Per threat it gives the expected answers left. Per member it gives the threats that member alone answers.
The implementation is the other agent's `answer_map.js` (`solver/results/2026-10-01-lost-last-answer/`, branch
`worktree-agent-a720967c64f3016c7`, abra/regmc 1.55.0). **v3 lands no second implementation.** A cheaper fact-based
prototype was built and timed in this branch and is not landed (report §4).

**What the evidence says.** The map is a strong signal on its own. A threat with fewer than 0.5 expected answers left
won the game for the opponent 82.9% of the time. But it adds nothing to the search's own root value in a held-out
comparison: log-loss −0.0045 [−0.0187, +0.0063] over 863 decisions in 119 games. It also costs about 3 s of CPU per
position (`docs/_reports/2026-10-01-lost-last-answer.md`). As an input at a leaf that is called hundreds of thousands of
times per SPRT, it would cost the search far more than it adds.

**So it is an OFFLINE target, paid for once at training time** (the coordinator's instruction, 2026-10-01):
- **Auxiliary head.** The teacher learns to predict expected answers left per threat and sole-answer counts per member,
  computed by `answer_map.js` on its training positions. This is KataGo's ownership head, a per-location target for
  credit assignment (Wu 2019 §4.1). The student distils it like the teacher's other auxiliary outputs, and pays nothing
  for it at play time.
- **Label.** The 1,131 mapped ladder positions in that agent's results are a diagnostic set: does the teacher's
  answers-left head agree with the engine's duels on them?
- **Not an input, and not in the student's features.** This is withdrawn from this design's first draft. See the
  amendment in `preregistration.json`.

**Literature.** I found no published value net for Pokémon or a comparable game that predicts a pairwise "answer"
quantity on the live state. The closest precedents are in KataGo: the ownership head (above), and its game-specific
inputs, such as ladder status, a small tactical read computed for the net. In KataGo's ablation, removing those inputs
together with two minor end-of-game optimisations cost about 1.55× the training time (Wu 2019 §4.2, Table 2). The answer
map, used as a target, is the ownership-head analogue. No claim is made beyond that.

## 5. Search integration: evaluate quiet positions

A depth-0 leaf scores a board in the middle of an exchange. That is the case Shannon described for chess: an evaluation
applies only in quiescent positions, so forcing sequences are played out first. MILTANK's version is `quiesce 'all'`
(1.23.0), one extension turn for every cell, and it already exists. It targets the doomed and double Protect. On the
probe it cut the played repeat mass from 0.611 to 0.200, and the 1.32.0 gate data puts human double Protect at 3.15% of
decisions. The extra half-turn costs playouts, and a cheap student is what pays for it. So the order is: student → the
cost of `quiesce 'all'` with the student as the leaf → a 14 s screen and an SPRT against the same agent without
quiescence. It is not counted as a fix until then (correction 6).

## 6. The loop

net → self-play from the **strong** search at the ladder clock → deeper labels → retrain. Every generation passes the
harness (§1) and then an SPRT against the previous generation (MACHAMP G1).

- **Playout-cap randomisation** (Wu 2019 §3.1, correction 3): most moves use a short search so more games are played.
  A random 25% get the full search and become the training samples, and the outcome target is recorded on those turns
  only.
- **A stronger reference** for test (a) comes from the loop: once a generation's search passes its SPRT, it plays the
  reference cells out in place of gen5's prior. The set itself stays frozen, so every relabel is reported against the old
  reference as well, because a change of reference changes the question.

## 7. What we stop doing

- **Gating on human-outcome log-loss below 1200.** It measured something else (§1).
- **Cheap self-play as a value target.** r1 was worse on human positions and H0 in games (1.26.0).
- **Measuring accuracy without cost.** v2 was the better net offline and lost the SPRT at 0.39× the leaves (§0).
- **Trusting an unaudited live world.** In every ROTOM world the entry hazards were written into `sf.sc`, where the
  engine never reads them (1.42.0). A net is only as good as the board it is given, and the set's positions come from the
  same world builder, so its audits are the set's audits.
- **Blending a search value into the main target without a precedent** (correction 2). It becomes an auxiliary head.

## Sources

Anthony, Tian, Barber 2017, arXiv 1705.08439 · Brown et al. 2020, arXiv 2007.13544 · Grigsby et al. 2025, arXiv
2504.04395 (v2 §2) · Hinton, Vinyals, Dean 2015, arXiv 1503.02531 · Jacob et al. 2022, arXiv 2112.07544 · KataGo,
`lightvector/KataGo` `docs/KataGoMethods.md` · McIlroy-Young et al. 2020, arXiv 2006.01855 · Moravčík et al. 2017, arXiv
1701.01724 · Nasu 2018, *Efficiently Updatable Neural-Network-based Evaluation Functions for Computer Shogi*, WCSC28
(English translation, `asdfjkl/nnue`) · Schmid et al. 2021, arXiv 2112.03178 · Schrittwieser et al. 2020, arXiv
1911.08265 · Shannon 1950, *Phil. Mag.* 41(314) · Silver et al. 2016, *Nature* 529 · Silver et al. 2017, arXiv
1712.01815 · Smith and Winkler 2006, *Management Science* 52(3):311–322 · Sutton 1988, *Machine Learning* 3:9–44 · Tang et
al. 2024, arXiv 2409.20553 · Tesauro 1995, *CACM* 38(3):58–68 · Wu 2019, arXiv 1902.10565.
