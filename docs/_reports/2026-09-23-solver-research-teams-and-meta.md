# Research: team-preview solver, team builder, meta analysis (Reg M-C, open sheets)

Date: 2026-09-23. Research only: no code run, no git, no existing file edited. Historical findings record
under `docs/_reports/`; not a living document, not current state.

Labels used below. **[DERIVED]** = arithmetic shown in the text, or read from a cited repo line.
**[EST]** = an engineering estimate with its assumptions stated; it is NOT a measurement and may not be
quoted as one. **[LIT]** = from a cited paper. No Pokémon, move, item or ability is named anywhere in
this file; every count of legal entities is left symbolic and must be derived from
`Dex.forFormat(<Reg M-C format>)` filtered by `exists && !isNonstandard && tier !== 'Illegal'`.

---

## 0. Verdict

1. **Preview solver: a 90×90 simultaneous matrix game per matchup, solved by double oracle over a
   learned cell evaluator, with rollouts only on the support.** Solving the LP is free. The whole cost
   is scoring cells. A full rollout matrix at useful precision takes hours per matchup, so the live path
   must be a learned Q(my 4 + lead 2, their 4 + lead 2) network. Rollouts are an offline or
   background refinement.
2. **Team builder: PSRO/double oracle over a population of teams. The best-response oracle is a
   surrogate-screened local search over edits to sets drawn from the human set library. The referee is
   the in-battle agent's FAST policy plus the preview solver, and the search agent only validates the
   finalists.** It is overnight-feasible on this laptop only under the fast policy [EST §2.6]. It is
   blocked by three things: the in-battle agent, the preview solver, and the MEDICHAM Reg M-C gate.
   Every payoff it produces is downstream of the simulator.
3. **Meta analysis: build the descriptive layer now, because it depends on the store and not on the
   simulator.** That layer is usage with cluster-robust intervals and a state-space trend, a set
   library, stable archetypes, human bring/lead frequencies, and Bo3 between-game adaptation. **Do not
   build a team-sheet winner predictor as a product.** Four prior models in this repo landed at or
   below a coin. The one predictive meta model worth building is a **replicator test**: does a matchup
   matrix predict next-period usage change better than persistence?
4. **Spreads are hidden even on open sheets** (`engine/coverage.js:906`: every stored sheet reads
   `evs: null`). The store therefore cannot supply SP spreads. The builder needs a spread optimiser,
   and the preview solver needs a spread belief.

---

## 1. (a) Team-preview solver

### 1.1 The game
- Each side has six Pokémon, visible on the open sheet. Each side picks 4 and orders them, and the
  first two lead. The choice is simultaneous. Options per side = C(6,4) × C(4,2) = 15 × 6 = **90**
  [DERIVED]. VGC-Bench reports the same 90 [LIT: Angliss et al.].
- The two back Pokémon are unordered at preview, because the in-battle policy decides switches. This
  holds only if the Reg M-C preview does not fix the back order. **Check the format's team-preview
  rule in the Showdown checkout before building. It is not asserted here.**
- One matchup is a 90×90 zero-sum matrix of 8,100 cells [DERIVED]. The value of each cell is
  P(win | both brings and leads, the in-battle agent on both sides, a belief over hidden spreads).
- Mega choice, and the "one mega per battle" rule, are in-battle decisions. They enter the cell only
  through the in-battle agent. If more than one mega-capable Pokémon can be brought, bringing both is a
  preview decision whose value the cell must price.
- Open sheets remove species/item/ability/move uncertainty. **SP spreads (and whatever else the
  sheet leaves null) are still hidden.** The cell value is therefore an expectation over K spread
  hypotheses per opponent Pokémon, drawn from a spread prior (§2.3).

### 1.2 Solving: trivial. Scoring: the whole problem.
- A 90×90 LP solves in milliseconds, so exact Nash is cheap once the cells exist. `nash.py`
  (SLOWKING) showed that the machinery is not the hard part. **Do not reuse it. Rewrite it; the LP is
  about 30 lines.**
- **Cost of a full rollout matrix [EST].** The number of games needed for a ±5-point 95% half-width at
  p≈0.5 is n = 1.96² × 0.25 / 0.05² ≈ **384** [DERIVED]. So 8,100 × 384 ≈ **3.1 M games per matchup**
  [DERIVED].
  - Under a *random* policy, MEDICHAM plays **134 whole games/sec/core**
    (`docs/ABRA-whitepaper.md:1888`, measured 2026-09-08). A real agent will be slower.
  - Assume a fast (no-search) policy at ~20 games/s/core on 12 usable cores ≈ 240 games/s [EST]. At
    that rate a full matrix takes **~3.6 h per matchup** [EST].
  - A full matrix is not live-feasible. It is barely feasible offline per matchup.

### 1.3 A four-tier cell scorer (cheapest first)
| tier | what | cost per cell | use |
|---|---|---|---|
| T0 | Static features from the calc: KO-threshold matrix (who takes which fraction of whom), speed order under the spread belief, spread-move exposure, redirect/priority/weather/terrain tags from `data/tags.json`-style tags (rebuilt for M-C), fed to a small boosted model | µs | pruning and a prior; interpretable |
| T1 | **Learned Q-net** over the 8 chosen sets plus 4 benched (sets embedded, cross-attention between sides, antisymmetric head) | all 8,100 in ≪1 s [EST] | **the live path** |
| T2 | Rollouts with the fast policy: common random numbers (the same seeds across cells), successive halving | 50–400 games | offline and background refinement on the support |
| T3 | Games with the search agent | expensive | validation of the final support only |

- **Train T1 on self-play outcomes from the agent, not on human outcomes.** CHOMP-EV measured the
  human bring decision at a coin ceiling: log-loss 0.6921 against 0.6931
  (`docs/MODELS.md:1739`). Human outcomes carry too little bring signal to fit 8,100-cell structure.
  They remain useful as an opponent-model prior (§1.5).
- **Structure worth exploiting.**
  - Dominated brings can be pruned by T0 before T1 runs.
  - The payoff is roughly bring-level plus lead-level. A factored network (a value for the bring pair,
    plus a lead adjustment) is a cheaper function class to learn and a regulariser.
  - Symmetry: swapping the two leads, or the two back Pokémon, gives the same cell, which cuts the
    number of distinct inputs.

### 1.4 Double oracle over the 90×90 (McMahan, Gordon & Blum 2003; the PSRO lineage)
1. Seed each side's restricted set with its top few strategies by T0/T1 and the human-modal bring.
2. Solve the restricted LP.
3. Best-respond over all 90 rows and all 90 columns using T1. Add a row or column only if its gain
   exceeds ε.
4. Verify the support with T2 using adaptive sampling. ResponseGraphUCB-style: sample the cells whose
   confidence interval straddles the comparison that decides the support [LIT: Rowland et al. 2019].
5. Stop when the best-response gain against the solved mixture has a CI below ε.
- **Budget [EST].** With a support of ~8×8 and ~60–200 verified cells at ~200 games each, that is
  12k–40k games, about 1–3 min at 240 games/s. Offline per matchup it is cheap. Live, only T1+LP fits.

### 1.5 The opponent model and the human anchor
- The Bo3 half of the frozen M-C pool is 23,473 games (`docs/REGMC.md:335`). For each team, it records
  which 4 were brought and which 2 led, against a known opposing six. That gives an empirical
  conditional P(bring, lead | my six, their six), available now.
- Use it two ways:
  1. As a **KL-regularised equilibrium**: Nash plus λ·KL(σ‖human prior). This is the piKL/"human
     regularised" idea: robust when λ is small, exploitative of human tendencies when λ is large.
  2. As an **exploitative best response** to the human prior. Report both.
- **Bo3 is a repeated game.** Games 2 and 3 reuse both sixes, and the loser often changes the bring.
  The store holds the between-game transitions (§3.4). A game-2/3 solver can condition the opponent
  prior on the game-1 bring and result.

### 1.6 How it is judged (stated in advance)
- **Exploitability** of the preview policy inside the 90×90 game, with a CI from cell uncertainty by
  Beta resampling. This is the SLOWKING method, and it was sound.
- **Head-to-head** with the same in-battle agent on both sides, paired seeds, SPRT, against: uniform,
  the greedy argmax of T1, the human-modal bring, and the old CHOMP-style coverage heuristic
  reimplemented as a baseline (not reused).
- **Mixing gain** (greedy − Nash) with a CI. SLOWKING's archetype-level gap CI included zero
  (`docs/MODELS.md:1637`). At the per-matchup level the gain is unknown, and that is a real
  experiment.
- **Never** judged on predicting human winners. That ceiling is measured (§4).

---

## 2. (b) Team builder

### 2.1 Combinatorics
- **Set** = (species, item, ability, 4 moves from the learnset, nature, SP spread). **Team** = 6 sets
  under species clause, item clause, legality (`isNonstandard`), and one mega *per battle*. Whether a
  team may carry more than one mega stone must be read from the format's rules, not assumed.
- **SP spreads alone [DERIVED].**
  - Assumptions: integer points, all 66 spent, 6 stats, cap 32 (umbrella `CLAUDE.md`).
  - Count by inclusion–exclusion: C(71,5) − 6·C(38,5) + 15·C(5,5) = 13,019,909 − 3,011,652 + 15 =
    **10,008,272 spreads per set, before nature**.
  - Most are equivalent. Only the stat breakpoints that change a speed order or a KO threshold matter.
    Derive them from the Champions stat formula in the calc, never from memory.
- **Symbolic team space.** Let S = legal species (derive it). The team space is on the order of
  C(S,6) × Π over slots of [items × abilities × C(|learnset|,4) × natures × spreads]. VGC-Bench puts
  the analogous mainline figure at ~10^139 [LIT].
- **The realised space is tiny by comparison.** The frozen M-C pool holds **11,608 distinct teams in
  24,832 games** (`docs/REGMC.md:334`). The practical search space is "near the human manifold":
  recombinations of human-proven sets and cores, plus local edits.

### 2.2 The set library from the human store (build now; no simulator needed)
1. Take the exact species/item/ability/move tuples from every open sheet. The sheet is observed data,
   so no inference is needed.
2. Canonicalise: sort the moves and normalise formes through one key function. The mega-key lesson
   applies (`docs/MODELS.md:1702`).
3. Merge near-duplicates per species by a move-set Jaccard threshold. Keep sets with support ≥ k
   **distinct players**, not games, because one heavy player repeats a set.
4. Legality-filter every entry against the Reg M-C dex. Log rejects, because the corpus can be
   contaminated (memory: custom-rule games).
5. Build a **core graph**: pairwise and triple co-occurrence lift (PMI) with cluster-bootstrap
   intervals. This proposes synergy edges, which an additive model cannot represent (§4).

### 2.3 Spreads: a separate inner optimiser
- The store cannot supply spreads (`engine/coverage.js:906`). Two options:
  - **(i) An optimiser (recommended first).** For a set in a team, choose a spread by a small integer
    program. Maximise a weighted count of benchmarks met, weighted by the current meta distribution:
    outspeed tiers, survive a threat's attack, reach a KO threshold. Use the damage calc only, which
    is cheap and exact. This is how human builders work.
  - **(ii) Inference.** A Bayesian inversion from observed damage percentages and turn order in
    replays gives a posterior over each human set's spread. It is real signal, but costly and
    noise-laden (rolls, crits, hidden modifiers). Defer it. It is the better spread *prior* for the
    preview solver's opponent belief, once it exists.

### 2.4 The outer loop: PSRO / double oracle over teams
- **Population.** Π = {teams}. Meta-game M[i,j] = P(team i beats team j), where both sides run preview
  Nash (§1) and then the in-battle agent. The game is symmetric and zero-sum, so M[j,i] = 1 − M[i,j].
- **Meta-solver.**
  - Nash by LP is exact and cheap at population ≤ a few hundred.
  - α-Rank [LIT: Omidshafiei et al. 2019] is unique and scales. Muller et al. 2020 proposed it as the
    PSRO meta-solver. It is useful as a second opinion when the Nash support is degenerate.
  - Report **Nash averaging** [LIT: Balduzzi et al. 2018] for ranking. It is invariant to redundant
    near-copy teams, which a population built by local edits will be full of.
- **Best-response oracle.** A local search over team edits scored against the meta-mixture σ.
  - The edits: swap a set from the library, swap one move, swap the item, swap the ability, and
    re-optimise the spread.
  - Score: Σ_j σ_j M[cand, j].
  - Search as simulated annealing or MAP-Elites with behaviour descriptors (speed profile, weather
    or terrain use, mega slot) to keep diversity. That is DSA-ME's deep surrogate plus MAP-Elites in
    Hearthstone [LIT: Zhang et al. GECCO 2022].
- **Two targets, reported separately.**
  - A best response to the *empirical ladder*, i.e. the recency-weighted human team distribution from
    the store. This is exploitative: "what beats what people bring now".
  - The *Nash of the population*. This is robust: "what cannot be punished".
  - The gap between the two answers is itself a meta-analysis output.
- **The literature says populations are required, not optional.** Real games have a spinning-top
  geometry: a transitive axis with a wide cyclic band at middle strength [LIT: Czarnecki et al.
  2020]. A single hill-climb converges into one cycle.

### 2.5 Surrogate screen (the DITTO lesson is the design constraint)
- **Model.** f(A,B) → P(A beats B). Architecture:
  - encode each set (embedding over species/item/ability/moves plus a spread summary)
  - pool with a permutation-invariant encoder (Deep Sets / Set Transformer) with **cross-attention
    between teams**
  - antisymmetric head σ(g(A,B) − g(B,A))
  - plus a low-rank cyclic term: blade-chest [LIT: Chen & Joachims 2016] or mElo [LIT: Balduzzi et
    al. 2018], so that non-transitivity is representable.
- **Train on simulator outcomes produced by the loop itself.** Refit each PSRO iteration (active
  learning). Do **not** train on human outcomes: see the JOLTEON/GURU ceiling in §4.
- **The screen must not decide what the referee ever sees.** This is DITTO's second defect
  (`docs/MODELS.md:1484`). Send a fixed fraction (e.g. 10–20% [EST]) of verification budget to
  candidates drawn by exploration (random library recombinations, MAP-Elites niches), not by the
  surrogate's top-k. Track the surrogate's rank correlation against verified results on that slice.
- **Score the bring, not the six.** DITTO's fifth defect was scoring the six. The referee already
  does this, because every game goes through the preview solver. The surrogate must learn the same
  target, not a six-averaged proxy.
- Seeded RNG everywhere (DITTO's fourth defect).

### 2.6 Laptop budget [EST — assumptions stated]
- Machine: 16 cores / 13 GB (`CLAUDE.md`). Plan for ~12 cores at BELOWNORMAL via `tools/lownode.cmd`.
- **Fast policy ≈ 240 games/s aggregate** (as in §1.2), about **0.86 M games/hour**. A search agent at
  ~10 s/game gives ~1.2 games/s, about **4.3k games/hour**. Both rates are guesses to be replaced by a
  measurement once the agent exists.
- **One PSRO iteration** (population 64, support ~8):
  - Surrogate-score 10k edits: seconds.
  - Verify the top 50 plus 10 exploration candidates against the support at 200 games each:
    60 × 8 × 200 = **96k games ≈ 7 min**.
  - Fill the new row of M against 64 at 384 games: 24.6k games ≈ 2 min.
  - Adaptive sampling per Rowland et al. cuts cell cost where the ranking is already decided.
- **20 iterations ≈ 3 h, overnight-feasible with margin.** The full 64×64 matrix at ±5 pt costs
  64·63/2 × 384 ≈ 0.77 M games ≈ 1 h, once.
- **Final validation with the search agent** on the top ~5 teams × support 8 × 200 games = 8k games
  ≈ 2 h.
- Under the search agent alone, the loop is **not** laptop-feasible: ~96k games per iteration ≈ 22 h.
  This is why the fast/search split is load-bearing.

### 2.7 The risk that decides whether any of it means anything
- **Pilot confound.** A team's measured value is its value *as piloted by this agent*. VGC-Bench's
  core finding is that agents degrade as team diversity grows: strong in single-team mirrors, much
  weaker across 30 teams [LIT: Angliss et al.]. The builder will favour teams the agent happens to
  pilot well.
- **Mitigations:**
  1. Evaluate the final ranking under two agent strengths (fast versus search) and report the rank
     correlation. If it is low, the ranking is about the agent, not the team.
  2. Measure play fidelity per archetype against human decisions in the store.
  3. Say it in every result.
- **Quarantine.** Every M[i,j] is downstream of MEDICHAM. Nothing here may be quoted until
  `quarantine.js --regulation regmc` is open, per the umbrella rule.

---

## 3. (c) Meta analysis from the Reg M-C store

### 3.1 Descriptive (build now; store-derived, not quarantined)
1. **Usage with honest intervals.**
   - Units: species, set, item-on-species, core (pair/triple), mega choice.
   - Report the share by **distinct player** alongside the share by game. Cluster-bootstrap by player,
     and by series for Bo3, because games are not independent. Wilson intervals on raw game counts
     overstate precision.
   - Diversity: Hill numbers (exp-entropy "effective number of species").
2. **Usage dynamics.**
   - A local-level state-space model on logit usage (Kalman smoother), or a Dirichlet-multinomial with
     exponential forgetting.
   - Changepoint detection for event shocks: tournament results, regulation start.
   - The dynamic Bradley–Terry / Glicko state-space literature gives the machinery [LIT: Glickman
     1999; Duffield et al. 2024].
3. **The set library and core graph** (§2.2) are published as meta objects in their own right.
4. **Archetypes, learned and stability-checked.**
   - Method: topic models (teams as documents, sets as words) or clustering on set embeddings.
   - Choose k by **bootstrap stability** (the adjusted Rand index across resamples), not by
     silhouette. An archetype that does not reappear under resampling is not an archetype.
   - GURU hand-fixed 12 and `archetypes.py` ran k-means with no stability check.
5. **Matchup matrices with intervals, done properly.**
   - Model the logit P(i beats j) hierarchically: strength_i − strength_j + an antisymmetric low-rank
     cyclic term + a **player-skill covariate**. The rating is in the store if ingest keeps it.
     Archetype choice correlates with skill, so the raw cell rates are confounded.
   - Use partial pooling. Report posterior intervals. Apply an FDR correction to any "A beats B"
     claim.
   - **Power [DERIVED].** Detecting 55% vs 50% at 80% power, two-sided α=0.05, needs n ≈
     ((1.96+0.84)² × 0.25)/0.05² ≈ **784 games per cell**. At GURU's 5,265 games over 66 pairs, almost
     no cell was powered, and 0 survived FDR (`docs/MODELS.md:1546`). **Expect the same null at 24.8k
     games unless the archetypes are coarse.** Say the null first.
6. **Bring/lead behaviour.** Empirical P(bring, lead | six, opposing six). This is the preview
   solver's opponent prior (§1.5) and a direct validation set for T1's human-regularised mode.
7. **Bo3 adaptation.** The bring changes between games conditional on the previous result. This is
   unique to the Bo3 store, and cheap to extract.

### 3.2 Predictive
- **Worth building: the replicator test.**
  - Hypothesis: the usage share x_i moves as Δx_i ∝ x_i((Mx)_i − xᵀMx) (replicator dynamics, Taylor &
    Jonker 1978). M is the matchup matrix: human-derived first, simulator-derived after the gate.
  - Falsifiable test: does it predict next-period usage change better than **persistence** (no
    change) and a momentum baseline, on held-out periods, with a paired CI on the error?
  - A null is informative. It would say that usage is driven by imitation of top players, not by
    matchup fitness. This is the one predictive meta claim that is both useful and testable.
- **Usage forecasting.** Persistence is the baseline to beat, and it will be hard. Report skill scores
  against it, never raw accuracy.
- **Not worth building as a product: pre-game win probability from sheets.** The measured ceiling is
  in §4. If one is fitted, it is a calibrated baseline with a skill covariate, reported as log-loss
  with a paired CI against a coin and a usage prior, and never shown to a user as a matchup verdict.

---

## 4. What the old models teach (no code reused)

| model | what went wrong / what it measured | design rule carried forward |
|---|---|---|
| JOLTEON | Additive species strengths; no pairwise term (`docs/MODELS.md:1278`). Log-loss tied a coin on the raw store (0.699 vs 0.693, `:1270`), with a bot-contaminated corpus. | Surrogates need interaction and cyclic capacity. Train on clean or self-play data. No win-prob claim from sheets. |
| DITTO | Objective ~94% additive. The screen decided what the referee saw. `coverage()` did not measure coverage. Unseeded RNG. Scored six not four. The referee was the wrong engine (`:1481–1495`). | §2.5 rules one for one. |
| GURU | 12 hand archetypes, 144 cells. 6 cells "decisive" uncorrected and 0 after FDR. Worse than a coin predictively (0.7124, `:1555`). A key typo produced a correct-looking null. | Corrections travel with the number. Power first. Derived-key checks. The null is the headline. |
| SLOWKING preview | Nash over GURU. Greedy−Nash CI included 0. The cycle was the best of 1,320 triples, with `supported:false`. The artifact name disagreed with its input matrix (`:1637–1662`). | A mixing gain needs a CI. A searched-for cycle needs a selection correction. Artifact names are derived from inputs. |
| CHOMP | Greedy damage coverage, not a matrix game. The bring decision measured at a coin versus human outcomes (`:1739`). | The preview solver is a matrix game, judged by exploitability and H2H, not by predicting human winners. |

---

## 5. Order of work (each step gated on the one before)
1. **Now, with no simulator dependency:** the set library, the core graph, usage with cluster
   intervals and the state-space trend, stable archetypes, bring/lead frequencies, and Bo3
   transitions. OPS/MEASURE territory, read from the frozen M-C pool.
2. **After the in-battle agent exists and the M-C gate is open:** the preview solver (T0 → T1 trained
   on agent self-play → the double-oracle loop), judged per §1.6.
3. **Then:** the spread optimiser, then team-builder PSRO under the fast policy with search-agent
   validation, and the pilot-confound check.
4. **Then:** the replicator test with a simulator-derived M, compared against the human-derived M.

## 6. What this report could not do
- It could not measure the in-battle agent's speed, because the agent does not exist. Every budget
  above scales linearly with it.
- It did not derive S, the learnset sizes, the nature count or the stat formula for Reg M-C. That
  requires running node against the dex, which was forbidden this session.
- It did not confirm whether the Reg M-C preview fixes the back order, or whether a team may carry
  more than one mega stone. Both must be read from the format.

## Sources
- Angliss et al., VGC-Bench — https://arxiv.org/abs/2506.10326 (html v2: https://arxiv.org/html/2506.10326v2)
- Lanctot et al. 2017 (PSRO); Bighashdel et al., *Policy Space Response Oracles: A Survey*, IJCAI 2024 — https://arxiv.org/abs/2403.02227
- Wellman et al., *Empirical Game-Theoretic Analysis: A Survey* — https://arxiv.org/pdf/2403.04018
- Omidshafiei et al. 2019, α-Rank (Sci. Rep.); Muller et al. 2020 (α-PSRO)
- Rowland et al. 2019, *Multiagent Evaluation under Incomplete Information* — https://arxiv.org/abs/1909.09849
- Balduzzi et al. 2018, *Re-evaluating Evaluation* — http://papers.neurips.cc/paper/7588-re-evaluating-evaluation.pdf
- Czarnecki et al. 2020, *Real World Games Look Like Spinning Tops* — https://papers.nips.cc/paper/2020/hash/ca172e964907a97d5ebd876bfdd4adbd-Abstract.html
- Chen & Joachims 2016, blade-chest — https://www.cs.cornell.edu/people/tj/publications/chen_joachims_16a.pdf
- Reis et al., *An Adversarial Approach for Automated Pokémon Team Building and Metagame Balance*, IEEE ToG 2024 — https://ieeexplore.ieee.org/document/10115492/
- Zhang et al., *Deep Surrogate Assisted MAP-Elites for Automated Hearthstone Deckbuilding*, GECCO 2022 — https://dl.acm.org/doi/10.1145/3512290.3528718
- *Evolving the Hearthstone Meta* — https://arxiv.org/pdf/1907.01623
- PokéAgent Challenge (200K+ teams inferred from replays) — https://arxiv.org/html/2603.15563v1
- Glickman 1999 — https://www.glicko.net/research/glicko.pdf ; Duffield et al., state-space skill rating — https://arxiv.org/html/2308.02414
- McMahan, Gordon & Blum 2003 (double oracle); Taylor & Jonker 1978 (replicator dynamics) — standard references, not re-fetched this session.
