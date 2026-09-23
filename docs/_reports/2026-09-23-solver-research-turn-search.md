# In-battle decision system: research and one recommended architecture

**Date:** 2026-09-23. **Scope:** the in-battle turn decision only, meaning the joint two-slot action each
turn. Team preview and bring selection are out of scope. **Status:** research and design only. I ran no
code, took no measurements and changed no existing file. **Every cost figure below is an ESTIMATE**
computed from `data/medicham-speed.json`. None of them was measured by this report.

Decided context (Will, 2026-09-23): open team sheets, target Reg M-C, every model except MEDICHAM is
rebuilt from scratch, compute is this laptop only, the goal is ladder climb, and play is an equilibrium
base plus a capped exploit dial.

---

## 0. Verdict

**Build a depth-limited Bayesian-matrix-game search (the Student-of-Games / ReBeL family, in the
shape that PokaiTrainer has just shown works for VGC doubles).** It has these parts:

1. **Root.** A simultaneous matrix game between my pruned joint actions and the opponent's pruned
   joint actions, averaged over sampled opponent *worlds*. A world is one hidden back line plus one
   spread assignment. The game is solved by **regret matching**. The first version uses a single
   public opponent strategy. The later version keeps one opponent regret table per world.
2. **Leaf.** A **truncated random-policy rollout** in MEDICHAM. Every cell is scored with
   **common random numbers** by using the engine's existing event-addressed dice. A **per-world value
   network** trained on search targets replaces it later. The rollout is not the permanent leaf.
3. **Depth.** Stage 1 is one ply. Depth 2 or more comes only when a measurement says the rollout
   leaf is the limit. It uses **SM-MCTS with regret-matching selection**, which is Hannan-consistent
   and converges (Lisý et al. 2013). It does not use DUCT, which does not.
4. **Output.** The average root strategy, passed through a **Restricted Nash Response** (Johanson et
   al. 2007). The dial `p` is capped by a computed bound on root exploitability, not by a guess.
5. **Clock.** An anytime search that reads the real `|inactive|` clock. It spends
   `min(per-turn wall − margin, (bank − reserve) / expected remaining requests)`.

The alternative with no search at all (Metamon, DeepNash) is **rejected for this laptop and this
data**. §2.4 gives the reasons.

---

## 1. The problem, stated in terms of what drives the design

| Property | Consequence |
|---|---|
| Both players commit at the same time | The root is a **matrix game**. Its answer is an equilibrium *mix*, not an argmax. A deterministic best response can be exploited by construction (docs/LOOKAHEAD-design.md §3.2, docs/MILTANK.md §3.1). |
| Doubles: each side picks a PAIR | The joint action count is roughly the per-slot count squared. A legacy corpus measurement, `engine/truncation_curve.js` via docs/ROLLOUT-design.md:112, put the median at 8 candidates per slot, so about 64 joint actions per side and about 4,000 cells unpruned. Re-derive this figure for Reg M-C before relying on it. **Pruning is mandatory.** |
| Chance: damage rolls, accuracy, crits, speed ties, secondary effects | Cells are *noisy*. The noise between cells must be **paired** (common random numbers) or the matrix is mostly dice. A speed tie is a branch to plan both ways, not one die to sample (memory: a-speed-tie-is-a-branch-not-a-die). |
| Hidden info is *small* under open sheets | Moves, items and abilities are public. What stays hidden is **which 4 of 6 were brought**, which falls to **6 worlds** once both leads are seen (C(4,2) for the back two), plus **spreads** (not on the sheet), which drive speed order and damage. That is small enough to **enumerate worlds** rather than learn an abstraction. |
| Clock: 420 s bank, 55 s per-turn cap, no increment | Source: docs/MILTANK.md:414–424, which reads `data/rulesets.ts:778` and `room-battle.ts`. docs/REGMC.md:153 says the Reg M-C ruleset is identical, *timer included*. The unit of spend is a **request**, and a post-KO replacement draws on the same bank. |
| Simulator: MEDICHAM in JS | About 0.49–0.63 ms per simulated turn once warm. **Up to about 5.6× slower for about the first 4,000 playouts of a process** (tier-up). Scaling across processes is sub-linear and low-confidence (2.35× at 4 workers). All of this is in `data/medicham-speed.json`: `warm_state_effect`, `process_scaling`. |

---

## 2. Literature and prior Pokémon AI: what each piece tells us

### 2.1 Pokémon-specific

| Work | What it does | What we take from it |
|---|---|---|
| **PokaiTrainer** (Yu, arXiv [2608.29197](https://arxiv.org/abs/2608.29197), 2026-08-29) | **VGC 2026 Reg M-B doubles, open sheets, spreads hidden.** This is our problem exactly. It adapts Student of Games. Each decision is solved as a **Bayesian matrix game** with alternating-update linear CFR: one regret table for the agent and **one per world for the opponent**. Worlds are brings (at most 15 at preview, 6 or fewer once leads are seen). Spreads are a mixture over about 3 candidates per species, reweighted by the likelihood the engine assigns to the observed outcome. Pruning is top-k₁ own and top-k₂ opponent joints, **with reserved shortlist slots for switch-containing joints and for gimmick-spending joints**. The leaf is a value network only (5.4M-parameter transformer: behaviour cloning on 122,804 replays, then self-play). Their Rust engine runs about 0.08 ms per turn. Reported results: 59–60% of 150 ladder bo3 sets, peak 1492, stable band 1350–1400, GXE 71.9–73.7%. | **This is the closest prior work and the report's template.** Four findings apply directly. (a) *"greedy beats every raw policy head we ever trained … while every search agent beats its own policy head"*: search carries the strength. (b) Opponent shortlist coverage at k₂=16 was **64% of realised joint actions**, against **97% per-slot marginal**, so joint coverage is the number to measure. (c) *Width alone* hurt, because it spread CFR too thin. (d) The value net's early-game optimism persisted (Brier 0.22 on turns 1–3 against 0.10 from turn 8). Caveat: these figures were read through a summarising fetch of the HTML paper and are **reported, not reproduced**. Re-read the PDF before citing any of them in a living document. |
| **Foul Play** ([post](https://pmariglia.github.io/posts/foul-play/), [repo](https://github.com/pmariglia/foul-play)) | Singles. **DUCT MCTS** on a custom Rust engine, guided by a **custom eval rather than rollouts**. Handles hidden info by **sampling several full battle states weighted by set likelihood**, which is determinisation. Damage rolls are grouped by whether they KO. Won the Gen 9 OU track of the PokéAgent Challenge with "root-parallelised MCTS" ([2603.15563](https://arxiv.org/html/2603.15563v1)). Its author says set prediction is "as important as, if not more important than" search. | Determinised search plus a good belief wins at the top level of *singles*. Two things carry over to us: **KO-bucketing of chance**, and **root parallelism**, which fits our process-level workers. DUCT does not carry over, because it is not convergent and matters more when the opponent can exploit a pure policy. |
| **PokéChamp** ([2503.04094](https://arxiv.org/pdf/2503.04094)) | Singles. Minimax in which an LLM does action sampling, opponent modelling and value estimation. Projected 1300–1500 Elo. | The *shape* (prior → search → value) is right. An LLM does not fit this laptop's clock or compute. Not adopted. |
| **PokéLLMon** (Hu et al. 2024) | Singles LLM agent with retrieval. Human parity in singles. | Superseded by search and RL entrants (PokéAgent: *"all top-performing submissions employed RL or search-based methods"*). Not adopted. |
| **Metamon** ([2504.04395](https://arxiv.org/abs/2504.04395)) | Singles. Offline RL sequence model, no search. 5M+ reconstructed human trajectories plus 20M+ self-play. Top 10% of active players. | This is the strongest case *against* search. §2.4 explains why it does not transfer to us. |
| **VGC-Bench** ([2506.10326](https://arxiv.org/abs/2506.10326)) | Doubles. Baselines are heuristics, LLMs, behaviour cloning, and self-play / fictitious play / double-oracle RL. Single-team mirror agents beat a professional. With more teams, the best single-team agent is **more exploitable** and generalises worse. | The warning that matters: a strength claim must name its team distribution. A per-turn *equilibrium search* sidesteps part of this, because it re-solves for the teams actually on the board rather than memorising a policy per team. |
| **Other Reg M-B ladder bots** (e.g. [philmantatsky/VGC-Pokemon-Showdown-AI](https://github.com/philmantatsky/VGC-Pokemon-Showdown-AI)) | README: exact-simulation search over "all eight hidden worlds", an 8 s live budget (p50 7.82 s, p90 8.09 s), 55–45 over the first 100 ladder games, and background pondering **removed** because *"only four of 189 ladder jobs matched the observed continuation."* | An anecdote, self-reported. It supports world enumeration and a fixed live budget, and it says **not** to invest in pondering. |

### 2.2 Game-theoretic search

| Work | Relevance |
|---|---|
| **SM-MCTS convergence**: Lisý, Kovařík, Lanctot, Bošanský, NIPS 2013 ([1310.8613](https://arxiv.org/abs/1310.8613)); Kovařík et al. ([1804.09045](https://arxiv.org/pdf/1804.09045)) | If node selection is ε-Hannan-consistent (**regret matching, Exp3**), SM-MCTS converges to an approximate Nash equilibrium. **DUCT has no such guarantee** (Lanctot et al. CIG 2014, cited in docs/LOOKAHEAD-design.md:80). **Decision: regret matching.** |
| **ReBeL** (Brown et al. 2020) / **DeepStack** / **Libratus** | Depth-limited re-solving over public belief states, with a leaf value per belief. This is the chassis. The legacy `engine/slowking/README.md` wrote it down correctly. What it lacked was an engine adapter and a leaf. |
| **Student of Games** (Schmid et al., Sci. Adv. 2023, [2112.03178](https://arxiv.org/abs/2112.03178)) | Growing-tree CFR, which grows the search tree non-uniformly toward relevant states, plus **sound self-play**, which trains value and policy on search outputs. PokaiTrainer is SoG applied to VGC. |
| **DeepNash / R-NaD** (Perolat et al., Science 2022, [2206.15378](https://arxiv.org/abs/2206.15378)) | Reaches an approximate equilibrium with **no search at test time**, but only after very large self-play training. Not affordable here. |
| **Gumbel MuZero** (Danihelka et al., ICLR 2022) | Sampling without replacement plus **Sequential Halving** at the root, which improves the policy with *few* simulations. It is a single-agent, max-based rule, so it is **not** the root solver of a simultaneous game. It *is* the right rule for the one remaining argmax-shaped job: spreading a small rollout budget across cells, the way MILTANK's successive halving already does (docs/MILTANK.md §3.3). |
| **PIMC / strategy fusion** (Long, Sturtevant, Buro, Furtak, AAAI 2010, [pdf](https://webdocs.cs.ualberta.ca/~nathanst/papers/pimc.pdf)) | Averaging over determinised worlds assumes a player can act differently in worlds they cannot tell apart. For **us** as the searcher that error is small, because our information set is fixed at the root. For the **opponent** it runs the other way: they *do* know their world. So a single public opponent strategy under-models them. That is the exact reason for PokaiTrainer's per-world opponent tables, and it is Stage 5 below. |
| **Restricted Nash Response** (Johanson, Zinkevich, Bowling, NIPS 2007, [pdf](https://poker.cs.ualberta.ca/publications/NIPS07-rnash.pdf)); data-biased variant (Johanson & Bowling, AISTATS 2009) | The canonical **capped exploit dial**. The opponent is forced to play the model with probability `p` and plays freely otherwise. `p=0` is Nash and `p=1` is a pure best response. At the root it is one extra matrix solve. |
| **Rollout-policy lessons** (docs/ROLLOUT-design.md §3.2, docs/MILTANK.md §3.2) | A stronger playout policy can make search *worse*, and low-variance (deterministic) playouts saturate. The legacy explore sweep supporting "random playouts win" is **quarantined** (docs/MILTANK.md:104–131). Treat the claim as a hypothesis to re-measure on the new stack, not as a result. |

### 2.3 What the legacy ABRA designs got right and wrong (learn, do not reuse)

- **Right:** the root is a matrix game solved by regret matching (LOOKAHEAD §3.2). Pruning is mandatory and must be measured by coverage (LOOKAHEAD §4.3). A max over noisy arms is biased upward, which is why MILTANK once clicked a healing move at full HP (MILTANK §3.3). The clock is one drawn bank read from `|inactive|` (MILTANK:412–446).
- **Wrong or incomplete:** MILTANK computed a best response to a *fixed* opponent policy, which is not an equilibrium (MILTANK §3.1). Its leaf was re-seeded from a Board, and that seed carried at least four state-loss bugs (dead bodies, a removed item, terrain dialect, weather: MILTANK §3.6–3.10). SLOWKING's engine adapter was never built. Pruning leaned on the quarantined MAG/joint weights. The new system must **fork the engine's own state** rather than re-seed it from a lossy Board, and must take its prior from the store, not from a fitted model on the quarantine list.

### 2.4 Why search rather than a Metamon-style policy

- Metamon plays **singles** with **5M+ human trajectories**. Our target, open-sheet Reg M-C doubles, is a new regulation (live since 2026-09-09), and its human corpus is orders of magnitude smaller.
- PokaiTrainer's ablation is *in our format*: a policy head alone loses to greedy search, and search over its own head always wins.
- A laptop can afford decision-time CPU search. It cannot afford the self-play volume DeepNash or Metamon need.
- Search re-solves for the actual teams on the board, which answers VGC-Bench's generalisation warning directly.

---

## 3. The recommended architecture in detail

### 3.1 Per-request pipeline

```
request (|request| + |inactive| clock)
  └─ belief update         bring posterior (≤6 worlds after leads) × spread posterior (few candidates/species)
  └─ world sample          W worlds, stratified by posterior mass (W≈6–12)
  └─ enumerate legal       my joints A, opponent joints B (per world: switch targets differ)
  └─ prune                 k₁ own, k₂ opponent, with reserved slots (switch-containing, mega-spending, self-protect)
  └─ evaluate cells        for each (a,b,world): fork S_world, step one turn with CRN dice, truncated rollout → value
                           allocate playouts by successive halving over MY rows (Gumbel-style), never over opp cols
  └─ solve                 regret matching on the belief-averaged matrix → σ_me, σ_opp, value v*
  └─ exploit dial          RNR with p ≤ p_max(δ) → σ_play
  └─ act                   sample from σ_play (never argmax; mixing is the point)
  └─ log                   counters: cells, worlds, playouts, fallbacks, time used, p chosen, root exploitability
```

### 3.2 Search algorithm

- **Stage 1 (ship first): a one-ply Bayesian matrix game.** Cell value
  `M[a][b] = Σ_w β(w) · E[ leaf(step(S_w, a, b_w)) ]`. Regret matching (Hart & Mas-Colell) to about
  1e-3 exploitability of the *estimated* matrix. That costs microseconds against the cell cost.
- **Stage 5: per-world opponent tables.** The opponent gets σ_opp^w per world, and I get one σ_me.
  This is the correct Bayesian game and removes the strategy-fusion error on the opponent side
  (§2.2). Solve with alternating-update linear CFR, as PokaiTrainer does.
- **Stage 6: depth-2 SM-MCTS with regret-matching selection** below the root, only if Stage 1's
  measured limit is the leaf. Chance nodes are keyed by a **public-outcome signature**: faint set,
  HP in coarse buckets, status and field changes. That is the Foul Play KO-bucket idea generalised.
  Children per chance node are capped, and outcomes beyond the cap go straight to leaf evaluation.

### 3.3 Leaf evaluation

- **v1: a truncated rollout.** Random or high-explore policy on both sides, turn cap as measured,
  graded `battleResult` at the horizon. **Common random numbers across cells**: the i-th playout of
  every cell uses the same dice addresses (`midEventDice` / `rngStreams` are already exported,
  `engine/medicham2-browser.js:54716–54722`). Cell differences then measure the action, not the dice.
  This is the cheapest variance reduction available and it is already built.
- **v2: a per-world value net** `v_θ(public state, world)`. It is trained on (a) root values from
  Stage-1 and Stage-5 searches in self-play (SoG "sound self-play"), and (b) outcomes, λ-mixed as in
  PokaiTrainer. Keep it small enough for CPU inference in Node (an MLP or a tiny transformer).
  **Accept it only if** it beats the rollout leaf on held-out positions *in every turn bucket*.
  PokaiTrainer's early-game optimism is the known failure, so check turns 1–3 separately.
- **The leaf is not quoted from the legacy R1 numbers.** Those are quarantined. The new leaf gets its
  own calibration artifact, measured on a frozen release.

### 3.4 Action pruning

- Enumerate the full legal set from the engine. Never hand-build it.
- **Prior (v1): store-derived, not model-derived.** Use empirical human click frequencies from the
  open-sheet bo3 store, conditioned on coarse public features, blended with a one-turn screen: each
  candidate against the opponent's uniform or prior mix at small n with CRN. This keeps a fitted
  model out of the path, in line with memory `empirical-driver-is-store-derived`.
- **Reserved slots** (PokaiTrainer): a share of k₂ for switch-containing joints and a share for
  mega-spending joints, so the pruner cannot quietly delete the actions a greedy screen always
  under-rates. Apply the same reservation to my own side.
- **Starting shape (to be tuned by measurement, not fixed):** k₁ = 8–12 and k₂ = 12–16.
- **The gate is joint coverage on held-out human turns** (§5, S1). PokaiTrainer reported 64% joint
  coverage at k₂=16 against 97% per slot. **Per-slot coverage overstates joint coverage** and must not
  be reported alone.

### 3.5 Belief handling

- **Bring:** 15 worlds at preview, 6 or fewer once both leads are public. The prior is the store's
  bring frequencies for the sheet, or the leads-conditional frequencies. Update deterministically on
  every reveal (switch-in, forced replacement).
- **Spreads:** a small candidate set per species, drawn from the store's inferred spreads. Reweight by
  likelihood each turn:
  - **Turn order** is a near-hard constraint (after priority, speed modifiers and trick-room-class
    field effects), except on speed ties.
  - **Observed damage %** is checked against the roll range from the exported `dmgRange`, with the
    same fact function used on both sides of the comparison (CLAUDE.md: facts are global).
  - The general form is PokaiTrainer's: reweight each candidate by the probability that MEDICHAM's
    own transition assigns to the observed public outcome.
- **Prefer OBSERVED over DECLARED.** The sheet's item is invalidated by removal or consumption events
  (CLAUDE.md, Knock-Off lesson). The belief carries observed item state per body.
- **Worlds per decision:** sample W stratified by mass and always keep the MAP world. W is a
  cost lever (§4).

### 3.6 Time management

- Parse `|inactive|Time left: X sec this turn | Y sec total | Z sec grace` on every request. The real
  bank is `Y + Z` (MILTANK:433–436). Budget for this request:
  `min(X − margin, (bank − reserve) / E[remaining requests])`.
- Derive `E[remaining requests]` **from the store** as a function of the turn number and bodies left.
  Never type it.
- Keep the reserve asymmetric. An expired turn concedes one server-chosen move. An empty bank forfeits
  the game (MILTANK:440–445).
- **Anytime:** the matrix is always solvable. Cells are filled in priority order (prior mass × my-row
  halving), so a deadline hit solves a partial matrix. Unfilled cells get the prior-screen value,
  **and the counter records it**.
- **Warm the workers at connect time**, not at first request. Tier-up is about 5.6× over about the
  first 4,000 playouts (`warm_state_effect.cause_1_tier_up`), which is worth roughly 20+ s of CPU.
  Run a dummy warm-up search per worker while the opponent picks at preview. Keep workers resident
  across games.
- **No pondering by default.** The reported continuation-match rate elsewhere was 4 of 189. Measure
  it before investing.

### 3.7 What the engine must expose (the contract ENGINE owes SEARCH)

| API | Why | Notes from reading the current code |
|---|---|---|
| `clone(S)` → an independent deep copy | Forking the *real* state, not re-seeding from a Board. The legacy re-seed path lost the dead, items, terrain and weather (MILTANK §3.6–3.10). | No clone is exported today (export list at `medicham2-browser.js:54713+`). `battleTurn(S, …)` mutates `S` in place (`:32005`). |
| Re-entrancy of module globals | `battleTurn` writes module-level globals (`MID_S`, `MID_TURN`, `MED_RNG`, `MED_TIE_RNG`, `ACTION_PROMOTED`, `_FAINT_EPOCH_ACTIVE`: `:32017–32026`). | Safe for **sequential** stepping within one process. **Unsafe** for any nested or interleaved use. Parallelism must be **process-level workers**, never async interleaving in one isolate. State that in the contract. |
| `legalActions(S, side)` → per-slot options with targets, switches, mega flag, forced-replacement requests, trap verdicts | Pruning must start from the true legal set. | `switchTrapVerdict` is already exported. Needs a **differential test against Showdown's `|request|`**. |
| `stepJoint(S, actA, actB, dice)` | One simultaneous turn with seedable per-event dice. | `battleTurn(S, rng, actsForA, actsForB)` plus `midEventDice` is most of this already. |
| `playouts(S, actA, actB, n, {policy, cap, seedBase})` → summed results | Batch API. Removes per-call overhead and lets a worker return one message per cell. | `rolloutWinProb` does this today, from a Board. It needs a from-`S` variant. |
| `publicSignature(S)` and `stateDigest(S)` | Chance-node keys, belief likelihoods, and the clone round-trip test. | New. |
| `seedFromPublic(publicState, world)` | Build `S_w` for each sampled world at the root. | Builds on the existing `buildMonFromSet` / `battleInit(…, {seeded:true})`. |

---

## 4. Costs (ESTIMATES from `data/medicham-speed.json`, not measurements)

Inputs used, all read from the artifact:
- `sim_ms_per_turn` warm, about **0.49–0.63 ms**. I plan at **0.6 ms**, per the artifact's own
  "plan against the LOW end" throughput rule.
- Cap-14 playout at about **5.2–5.9 ms**, which implies about 10 turns per truncated playout.
- Cold first arm up to **2.9 ms per turn**.
- 4 workers at **2.35×** aggregate. The artifact calls this LOW confidence and says to "plan against
  ONE worker".
- Worker RSS about **385 MB** warm.
- Clone cost is **unknown**. It is not measured anywhere, so every figure below excludes it.

**Simulated turns per decision (1 worker / 4 workers at 2.35×):**

| budget | 1 worker | 4 workers (upside) |
|---:|---:|---:|
| 5 s | ~8,300 | ~19,600 |
| 10 s | ~16,700 | ~39,000 |
| 20 s | ~33,000 | ~78,000 |

**Stage-1 matrix cost** = cells × W × n × (1 step + rollout turns) × 0.6 ms:

| k₁×k₂ | W | n/cell | rollout turns | sim-turns | 1-worker time |
|---|---:|---:|---:|---:|---:|
| 8×12 = 96 | 1 (PIMC, world sampled per playout) | 16 | ~6 | ~10,800 | **~6.5 s** |
| 8×12 = 96 | 1 | 16 | ~10 (cap 14) | ~16,900 | ~10 s |
| 12×16 = 192 | 1 | 16 | ~6 | ~21,500 | ~13 s |
| 8×12 = 96 | 6 (per-world, Stage 5) | 8 | ~6 | ~32,300 | ~19 s |

**Reading:**
- Stage 1 fits a **5–15 s** per-request budget on one worker only with **short rollouts**
  (~6 turns) and **successive halving**. Screen all cells at small n, then re-test the top rows at a
  larger n, as MILTANK did.
- Per-world opponent tables (Stage 5) are about **W× more expensive** and are the main reason the
  value net (Stage 7) exists. A value net removes the rollout turns from every cell.
- For comparison, PokaiTrainer's engine is about **0.08 ms per turn** (reported), roughly **6–8×
  faster** than MEDICHAM's warm range, and it uses a GPU value net. Expect fewer cells and worlds
  than theirs at the same wall-clock.
- **Memory:** 4 workers × 385 MB ≈ 1.5 GB. That fits 13 GB shared, but run through `tools/lownode.cmd`.
- **Self-play for the value net (rough):** a cheap-search game at about 1 s per decision, with the
  decisions per game taken from the store (not typed here), costs one worker-minute or less per game.
  That is on the order of **~100–300 games per worker-hour**. It is sufficient for a small net over
  days, not hours. This is an estimate only. Measure it at S7.

---

## 5. Staged build, and the test that proves each stage

Rules for every stage:
- Every measurement runs on a **frozen engine release**, a **census pin** and `--team-store
  data/team-pool-frozen`. The Reg M-C equivalents apply once they exist.
- Every capability emits a **counter**, and **a zero is red**.
- Every H2H is an **SPRT read as it goes**, at **equal wall-clock**, not equal iterations.

| Stage | Build | The test that proves it |
|---|---|---|
| **S0: engine contract** | `clone`, `stepJoint` with dice, `legalActions`, `playouts`-from-S, `publicSignature`, `stateDigest`, and warm worker pool. | (a) **Clone round-trip:** step the original and the clone with the same dice. `stateDigest` must be equal after 1, 5 and 20 turns across the pinned pool. **Show it RED** by deliberately dropping one volatile. (b) **Legal-set differential** against Showdown's `|request|` on store positions: zero mismatches, with any exclusion declared. (c) Throughput bench per the artifact's own protocol: one cap per process, first arm, ≥6 reps, interleaved repeats. Clone cost is measured here for the first time. |
| **S1: pruner** | Store-derived prior, one-turn CRN screen, reserved slots. | **Joint coverage** of the human's realised joint action on held-out open-sheet bo3 turns, for my side and the opponent's, at each k. Report per-slot beside it, never alone. The threshold is fixed *before* the run. |
| **S2: one-ply matrix + rollout leaf + RM** | The §3.1 pipeline at W=1 (PIMC). | (a) **Solver unit tests:** rock-paper-scissors → uniform; a known 2×2 → the LP solution; exploitability ≈ 0. (b) **Stability:** two independent solves of the same position with fresh dice give a policy total-variation distance and value difference below a pre-stated bound. (c) **Constructed fixtures** with a known dominant joint action, such as a guaranteed double KO: σ must put ≥ a stated mass on it. Construct the fixture, don't find it. (d) SPRT against a greedy one-turn baseline. |
| **S3: clock** | `|inactive|` parse, budget formula, anytime fill, worker warm-up at connect. | A replayed or self-play series **with the timer ON**: zero turn timeouts, zero bank forfeits, p99 decision latency under `X − margin`, and the clock-note counter non-zero. MILTANK's was 0. |
| **S4: belief** | Bring posterior, spread posterior via turn-order and `dmgRange` likelihood, observed-item tracking. | (a) **Self-play, where truth is known:** log-loss and calibration of the bring and spread posteriors by turn. (b) **Human store:** log-loss of the predicted back two against the revealed back two. (c) A consistency check that the true world never falls to zero posterior. SPRT S4 vs S2. |
| **S5: per-world opponent tables** | Bayesian matrix game solved by linear CFR, with σ_opp^w per world. | Unit test on a toy Bayesian game with a known equilibrium. SPRT vs S4 at equal wall-clock. **Expect a small or no gain until the leaf is cheaper.** Say so before the run. |
| **S6: exploit dial** | RNR at the root. Choose the largest `p ≤ p_max` such that the computed root exploitability of σ_play is at most δ below v*. | (a) The exploitability bound holds on every logged decision (it is computed, so it is checkable). (b) SPRT vs S5 against a store-driven human-like opponent (gain). (c) SPRT vs S5 against an adversary that best-responds to σ_play (loss bounded by δ). |
| **S7: value net** | A per-world value net on search targets plus λ-mixed outcomes, CPU inference. | Held-out Brier and log-loss vs the rollout leaf **in every turn bucket**, with turns 1–3 separately, before any H2H. Then SPRT at equal wall-clock. |
| **S8: depth-2 SM-MCTS (only if S7 shows the leaf is the limit)** | Regret-matching selection with public-signature chance buckets. | SPRT vs the best of S5 to S7 at equal wall-clock. |

**Ladder climb is the last reading, not a gate.** Ladder results are noisy and non-stationary, so gate
on SPRTs against fixed opponents and report the ladder as a series.

---

## 6. Risks, written down first

- **MEDICHAM's Reg M-C correctness bounds everything.** The search maximises the simulator's game.
  Every figure from this system is downstream of MEDICHAM and falls under its gate.
- **Rollout bias.** A random playout judges positions and *does not punish wasted turns*. It may
  under-price tempo and self-protection (the legacy caveat at MILTANK:133–137 is one measurement).
  The value net is the fix, and S2's fixtures are the check.
- **Joint-coverage ceiling.** A search cannot value a joint action it pruned. If S1 coverage is low,
  every later stage is capped.
- **Noisy-matrix equilibria.** Regret matching on an estimated matrix gives an equilibrium *of the
  noise* when n is small. S2(b) stability is the guard, and CRN is the cheapest fix.
- **Cost.** Stage 5 and deeper search are not affordable on rollouts at this engine speed. That is a
  plan dependency on S7, not a surprise.

---

## Sources

- PokaiTrainer: https://arxiv.org/abs/2608.29197 · html https://arxiv.org/html/2608.29197
- Foul Play: https://pmariglia.github.io/posts/foul-play/ · https://github.com/pmariglia/foul-play
- PokéAgent Challenge: https://arxiv.org/html/2603.15563v1
- PokéChamp: https://arxiv.org/pdf/2503.04094
- Metamon: https://arxiv.org/abs/2504.04395
- VGC-Bench: https://arxiv.org/abs/2506.10326
- Reg M-B search bot README: https://github.com/philmantatsky/VGC-Pokemon-Showdown-AI
- Lisý et al. 2013: https://arxiv.org/abs/1310.8613 · Kovařík et al.: https://arxiv.org/pdf/1804.09045
- Lanctot et al. CIG 2014: https://www.mlanctot.info/files/papers/cig14-smmctsggp.pdf
- Student of Games: https://arxiv.org/abs/2112.03178
- DeepNash / R-NaD: https://arxiv.org/abs/2206.15378
- Gumbel MuZero: https://iclr.cc/virtual/2022/poster/6418
- PIMC / strategy fusion: https://webdocs.cs.ualberta.ca/~nathanst/papers/pimc.pdf
- Restricted Nash Response: https://poker.cs.ualberta.ca/publications/NIPS07-rnash.pdf
- ReBeL: https://arxiv.org/pdf/2007.13544 · DeepStack: https://arxiv.org/pdf/1701.01724
- Internal: `data/medicham-speed.json`, docs/LOOKAHEAD-design.md, docs/ROLLOUT-design.md,
  docs/MILTANK.md, docs/LITERATURE-v2.md, engine/slowking/README.md, docs/REGMC.md:153,
  `engine/medicham2-browser.js` (exports `:54713+`, `battleTurn` `:32005`).
