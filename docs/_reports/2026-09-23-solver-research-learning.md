# Solver research — the learning side (value net, policy prior, self-play) on a laptop

**Date:** 2026-09-23. **Type:** research report, historical by construction (`docs/_reports/`), not a
living document. **Scope:** Reg M-C, open team sheets only, laptop only (16 cores, 13 GB, no GPU),
MEDICHAM (`engine/medicham2-browser.js`) kept, every other model rebuilt. **No script, node, python or
git command was run for this report** (another session is editing the engine); every repository figure
below is either quoted from a named file or a `grep -c` / `wc -l` on a local file, and is labelled.
**Every figure marked ESTIMATE is arithmetic, not a measurement.** No Pokémon, move, item or ability is
named anywhere in this file, by instruction.

---

## 0. Verdict

1. **Do not do AlphaZero-from-zero.** Do *BC-then-Expert-Iteration* — clone human open-sheet play first,
   then improve with search-generated targets. That is the recipe that won in both doubles VGC
   (VGC-Bench: behaviour-cloned self-play, "BCSP", was best at every team-set size) and singles
   (Metamon: imitation → offline RL → self-play fine-tune). It is also the only recipe whose sample
   cost fits a CPU.
2. **The value net's inputs must include the damage race computed by MEDICHAM**, not just material.
   The old PORY tied a two-feature `[alive_diff, hp_diff]` logistic because it *was* that logistic
   (§1). Representation, not sample size, is the binding constraint.
3. **Train on search-improved targets, not only on game outcome.** The root matrix solve yields a
   Nash mixture σ* (policy target) and a game value v* (value target) at every decision; blend v* with
   the final outcome z. Outcome-only labels on human games are the noise that capped PORY.
4. **Small nets, hand-rolled JS inference inside the search**, trained in PyTorch-CPU. A net of
   ~0.1–0.5 M parameters costs roughly one simulated turn per evaluation (ESTIMATE, §6) — that is the
   budget that keeps the matrix solve affordable. onnxruntime-node only if an entity-transformer
   variant earns its place, and then batched per matrix.
5. **League, not pure self-play**: current net + past checkpoints (prioritised by how often they beat
   us) + a frozen human-BC anchor + a periodic exploiter. This is the cheapest known guard against
   rock-paper-scissors cycling.
6. **Every net must beat the count-HP baseline, paired and game-clustered, before it may beat
   anything else**, then beat the same search using the count-HP leaf head-to-head, then beat its
   predecessor. A net that never makes a live decision has not been built (PORYGON2's charge).

---

## 1. What the old models teach — why PORY only tied material

Read from `docs/MODELS.md` (PORY retraction note ~line 1505–1515; PORYGON2 §2316; learning core §1699;
MAG §1904; DODUO §1094) and `engine/position_features.js` / `engine/board.js` headers.

**PORY (retracted).** Its fitted weights reduce to `sigmoid(0.9809*alive_diff + 1.4093*hp_diff)`
(`data/pory-eval.json:reduced_form`, as quoted in MODELS.md), and against a logistic on
`[alive_diff, hp_diff]` alone the paired log-loss difference is +0.000001, CI [−0.000026, +0.000029]
over 1,177 held-out games (MODELS.md, 2026-08-05 restamp). `turn` was structurally pinned to zero.
Why it tied, in order of weight:

| Cause | Mechanism | What the rebuild does instead |
|---|---|---|
| **Representation was material** | Its features were counts and HP means. A model cannot learn what it cannot see: who wins the *damage race*, who moves first, what the declared sets threaten. | Engine-derived relational features (§3): per-pair best-hit %HP, turns-to-clear, effective speed order, from the declared sheet. `position_features.js` already started this. |
| **Targets were raw outcomes of human games** | A mid-game position's label is one coin-flip of the rest of a human game. Most label variance is future play, not the position. | Search-improved targets v* blended with z (§4), plus many more labelled positions per game from self-play. |
| **Data bugs hid signal** | The learning-core value net discarded every forme-changed body's events (fixed 2026-08-04; MODELS.md §1699) — a fifth of all damage silently unapplied; `hpDiff` was attenuated toward zero. | A wiring/coverage counter on the state reconstruction (every damaging event applied, per game) before any fit. |
| **Unverified "beats material" claims** | PORYGON2 published point estimates with no CI, no paired test, no split-half floor (MODELS.md §2316). Its figures are withdrawn and are not quoted here. | The test ladder in §8 — paired, clustered, with a noise floor, from day one. |
| **Never in a live decision** | PORYGON2 and DODUO were "fitted, saved, quoted … and never once in a live decision" (CLAUDE.md). | A capability counter: the live bot logs how many leaf evaluations the net served; zero fails the wiring test. |

**MAG / DODUO lessons that survive their withdrawn figures** (no MAG/DODUO number is quoted):
- MAG was a conditional logit on hand features of (move, target) pairs, fitted to human clicks.
  Right idea for a *prior*; the rebuild keeps "fit a prior to open-sheet human clicks" and replaces
  the linear head with a small net over the same engine facts.
- **DODUO's point stands: score the PAIR.** A factorised per-slot policy cannot represent
  coordination. The prior must output a distribution over *joint* actions (or per-slot logits plus a
  pair-interaction term), because the matrix solve's rows are joint actions.
- **Fitting and playing environments must match** (CLAUDE.md: MAG fitted with the sheet visible,
  played without). Open sheets on both sides, always, in training, evaluation and live play.
- **One definition, two consumers** (`board.js` S12): the feature function the trainer reads must be
  the exact function the search calls. Train from a dataset emitted *by Node through MEDICHAM*, never a
  Python re-implementation of any game fact.

---

## 2. What the problem actually is, with open sheets

A Showdown open team sheet reveals species, item, ability, moves and nature, **not the stat spread**
(`docs/DAMAGE-STAGES.md:723`). So once the battle starts the residual hidden information is small:
the spreads, and which of the opponent's six were brought until each appears. What remains is a
**simultaneous-move stochastic game with near-perfect information**. Consequences:

- Public-belief-state machinery (ReBeL, Student of Games) is **not needed** in battle. A per-node
  matrix-game solve with a learned leaf (the SM-MCTS / DeepStack-leaf shape) is the right family.
- Spreads: sample a few spread hypotheses from a prior (determinization), or feed expected stats.
  Strategy-fusion error is small when the hidden variable is a spread rather than a move set.
- Team preview (bring 4 of 6, lead 2) is a separate one-shot matrix game over the same value net
  evaluated at turn 0 — the same V serves it.

---

## 3. State encoding

**Recommendation: a hybrid — learned entity embeddings + engine-computed relational facts, pooled by
a permutation-invariant set encoder (Deep Sets), with a small transformer as a later ablation.**

Entities (from the acting side's point of view, symmetric by construction as `position_features.js`
already insists):
- **12 Pokémon tokens** (my 4 brought + their up-to-4 brought; unrevealed opposing slots as a
  "possible-bring" token averaged over their remaining sheet). Each token =
  `[species id-embedding ⊕ descriptive features]`. Descriptive = base stats, types (multi-hot),
  current HP fraction, status, stat stages, active/bench/fainted, mega state, the four declared moves
  as move-embeddings pooled, item/ability embeddings.
  **Why both id and descriptive:** Reg M-C is new (collected since 2026-09-09) and regulations rotate;
  a pure id-embedding has nothing to say about a species with few games. Descriptive features let the
  net back off to "what it is" when "who it is" is unseen. This is the same lesson VGC-Bench applies
  with learned embeddings for moves, items and abilities.
- **Relational facts from MEDICHAM (the part PORY never had):** for each (attacker active, defender
  active) pair, best expected damage as %HP of the defender's current HP and KO probability, both
  directions; effective speed order of the four actives; turns-to-clear for each side. These are
  exactly `iKillNext`, `theyKillNext`, `raceEdge` in `position_features.js`, generalised to a 4×4
  matrix. Computing them costs engine calls, so they are computed **once per state**, not per action.
- **Field token:** weather, terrain, room effects, screens, side conditions, their turn counters,
  turn number.

Architecture: token MLP → mean/max pool per side (Deep Sets) → concat with field and relational block
→ 2 × 256 MLP → heads. Value head: scalar (tanh or sigmoid). Policy head: per-slot action logits
(move × target, switch-to-k, mega flag) + a pair-interaction bilinear term → joint logits, masked to
legal joint actions.

**Why not text tokens (Metamon) or a 12-token transformer (VGC-Bench) first?** Both work, but both
were trained on GPU clusters (VGC-Bench: 8 A40s; Metamon: 15M–200M-parameter transformers). The
Deep-Sets MLP is the size that trains on this laptop in minutes (§6) and runs inside a JS search at
~1 sim-turn per eval. Promote a transformer only if it beats the MLP on the §8 ladder at equal
inference budget.

---

## 4. Training targets

| Head | Gen 0 (human) | Gen ≥1 (self-play with search) |
|---|---|---|
| Value | Outcome z of the human game, from each player's view, on every turn state | **Blend** `y = λ·z + (1−λ)·v*`, v* = the root matrix game value found by search. Start λ≈0.7, anneal toward ≈0.3 as V improves (ESTIMATE of a sensible schedule; tune on §8). Optionally TD(λ) across consecutive turns of one game. |
| Policy | Human open-sheet click, joint (both slots) — cross-entropy | **σ*, the root Nash mixture** (KL target), plus a small KL anchor toward the human-BC policy (piKL-style) so the prior stays human-legible and does not collapse onto an exploitable pure strategy |
| Auxiliary (cheap, helps small data) | HP fractions next turn, who faints next turn, turns remaining | same |

Why this blend: outcome-only targets are unbiased but high-variance (PORY's ceiling); search targets
are low-variance but biased by the current V. KataGo and Leela-family practice is to mix, and
Metamon's ablation found that *critic accuracy* mattered more than which offline-RL variant was used.
Auxiliary targets are KataGo's largest single efficiency lever and cost nothing here, because MEDICHAM
emits them.

**Simultaneous moves change the policy target.** In a sequential game AlphaZero uses visit counts.
Here the root is a matrix; the policy target is the equilibrium mixture of that matrix (with a
temperature / entropy floor for exploration). Train the prior for *both* sides from the same matrix —
every self-play decision yields two policy examples.

---

## 5. Self-play loop design

**Shape: Expert Iteration** (Anthony et al. 2017): apprentice net → expert = matrix search using the
net → net imitates expert → repeat. AlphaZero is the special case; Gumbel AlphaZero is the variant for
**tiny simulation budgets**, which is our regime.

Per decision:
1. Prior π proposes top-k joint actions per side (k ≈ 8–16, ESTIMATE; tune). For exploration during
   training, pick the candidate set by **Gumbel-top-k sampling** from π's logits (Danihelka et al.
   2022) instead of plain top-k, so rarely-preferred joint actions still get evaluated and the
   policy-improvement guarantee holds with few evaluations.
2. For each (row, column) cell: one MEDICHAM turn from the current state (1–4 chance seeds), then V at
   the resulting state. Solve the k×k matrix (fictitious play / regret matching, a few hundred
   iterations on a ≤16×16 matrix is microseconds).
3. Sample the move from σ* (with temperature early in the game), record (s, σ*_me, σ*_opp, v*), play.
4. At game end, attach z to every record. Tag every record with the **engine release id and the
   weights digest** (photograph rule — a self-play dataset from a moved engine is a different
   question).

**Playout-cap randomisation (KataGo):** most decisions use the cheap k; a random 20–25% use a larger k
and only those produce policy targets. Cheap decisions still produce value targets. Standard trick,
large throughput gain.

**League (avoiding cycling)** — AlphaStar's league / prioritised fictitious self-play and PSRO are the
references; VGC-Bench ran self-play, fictitious play and double oracle in doubles. Opponent mix per
generation (ESTIMATE of a starting split):
- ~50% current net (self-play),
- ~20% past checkpoints, sampled in proportion to how often they still beat the current net (PFSP),
- ~15% frozen human-BC policy (the anchor: the ladder is humans),
- ~15% an **exploiter** — a copy fine-tuned for a few generations only against the frozen current
  net; if it wins, its games are the most informative in the buffer, and its win rate is the
  exploitability probe in §8.

**Teams:** sample real Reg M-C open sheets from the store, weighted by usage, so the self-play team
distribution is the ladder's. VGC-Bench's warning applies: more team diversity lowers per-team
strength but is what generalises; the ladder is diverse, so train diverse.

**Engine churn:** the engine is still being corrected. Human-trained components (Gen 0) do not depend
on MEDICHAM's correctness except through relational features; self-play components do. Keep the
buffer keyed by release; when the release moves, drop or down-weight older self-play data rather than
mixing it silently.

---

## 6. Compute and data volume on this laptop — all ESTIMATES

Inputs (quoted): MEDICHAM sim ms per turn at cap 6 ranges **0.5957–1.791 ms** across runs
(`data/medicham-speed.json:playout.sim_ms_per_turn["6"]`, engine release `5f3f7141227c`, Reg M-B, a
timing artifact that makes no accuracy claim); a 200-playout leaf call at cap 14 is **~1.1–1.3 s**
(`warm_state_effect.what_to_trust`). V8 tier-up needs ~4,000 playouts before steady state — self-play
workers must be long-lived processes.

**Search cost per decision (ESTIMATE):** k=12 per side → 144 cells × (1 sim turn ≈ 1 ms + 1 value
eval ≈ 0.2–0.5 ms + relational features ≈ a few sim-equivalents, amortised) ≈ **0.3–1 s per decision
per core**. That is already cheaper than *one* current rollout leaf call — the learned V replaces
200 playouts.

**Self-play throughput (ESTIMATE):** a game of ~10–15 turns (turn length NOT measured here) × 2 sides
× 0.3–1 s ≈ 6–30 s per game per core. With ~12 worker processes at below-normal priority via
`tools/lownode.cmd`: **~1,500–7,000 games/hour**, i.e. ~15k–70k games per overnight run. Memory: one
Node process per worker at a few hundred MB — 12 workers is near the 13 GB ceiling; plan 8–10.

**Human seed data (quoted, local file counts, before the clean filter):**
`data/games.gen9championsvgc2026regmcbo3.jsonl` holds **24,028 rows, all `"openSheet":true`, 158
`"bot":true`**; `data/games.gen9championsvgc2026regmc.jsonl` holds 33,743 rows of which **1,400**
are open-sheet (grep counts on the files as of their 2026-09-21 mtime; the tracked store is sharded
and may differ — re-derive before quoting). The Reg M-B open-sheet corpus (`data/games.bo3.jsonl`,
33,332 rows) is usable **as pre-training only**, flagged as a different regulation.
Positions: rows × turns × 2 viewpoints ≈ 24k × ~12 × 2 ≈ **~0.5 M labelled positions** (ESTIMATE).

**How much is enough (ESTIMATE, by analogy, not measured):** Metamon trained 15M–200M-parameter
transformers on ~38M timesteps. A 0.1–0.5M-parameter net needs ~10× fewer examples than parameters
× a modest factor — **~1–5 M positions** is the right order for the final value net: Gen 0 human
(~0.5 M) + 3–6 self-play generations of ~20k–50k games each. The learning curve decides: if held-out
loss is flat from ¼ to all of the data (the PORYGON2-shaped symptom), the bottleneck is the
representation and more games will not help.

**Training cost (ESTIMATE):** a 300k-parameter MLP ≈ 1–2 MFLOP forward+backward per example;
5 M examples × 10 epochs ≈ 10^14 FLOP ≈ **10–40 minutes** of PyTorch-CPU at 50–150 GFLOP/s. A
12-token, 4-layer, d=128 transformer is ~10–30× that — a few hours. Store positions as compact
integer ids + float16 features (~200–400 B each) → 5 M positions ≈ 1–2 GB, fits in RAM.

---

## 7. Stack: JS vs Python, and inference inside a Node search

**Train in Python (PyTorch, CPU).** Generate data in Node (the only place game facts may be computed),
write it as a binary/NPZ-style file, train in Python, export weights.

**Infer in Node, hand-rolled, for the MLP/Deep-Sets net.** Export weights to a flat Float32 file; the
forward pass is a few `Float32Array` matmuls (~100 lines). Reasons:
- zero native dependency, no N-API marshalling per call, deterministic, and **the weights file can be
  one of the frozen release SOURCES** (`engine/engine_release.js`) so a measurement photographs the
  net with the engine;
- a 200k-MAC forward pass in plain V8 is ~0.1–0.5 ms (ESTIMATE) — the same order as one sim turn,
  which is the budget. Batch all cells of one matrix into one call to amortise.
- **Parity test:** the JS forward pass must match PyTorch on a fixed set of inputs to ~1e-5; shown red
  on a deliberate weight perturbation before trusting it.

**onnxruntime-node** only if a transformer variant wins §8: it brings multi-threaded SIMD kernels but a
per-call overhead (tens of µs, ESTIMATE — no reliable public benchmark found) and a native binary.
Use it batched per matrix, one intra-op thread per worker (workers already occupy the cores).
**tfjs-node**: heavier and slower-moving than ONNX Runtime; no reason to prefer it.

---

## 8. Baselines and tests — the ladder every net climbs

Each rung is **paired** (identical states or identical team pairings), **clustered by game** for CIs,
reports a **split-half noise floor**, and pins the engine release, the census and the team pool.

| Rung | Question | Comparator | Pass rule |
|---|---|---|---|
| V0 | Is the value net above material? | **Count-HP baseline: logistic on `[alive_diff, hp_diff]`** (PORY's reduced form), refitted on the same training split; plus coin | Paired log-loss on held-out human open-sheet Reg M-C positions, CI excludes zero *and* effect > split-half floor. Also calibration (reliability) and a per-turn-bucket breakdown (early game is where material says least). |
| V1 | Does it know the engine's game? | MC value from many MEDICHAM playouts under the BC policy, on sampled self-play positions | Lower MSE than the count-HP baseline against the rollout value, paired. |
| V2 | Does it help the search? | **Same matrix search, same budget, count-HP leaf** | Head-to-head SPRT on a frozen release, pinned pool. This is the rung that matters; V0/V1 are necessary, not sufficient. |
| P0 | Is the prior better than "what this species usually clicks"? | Species-frequency prior; then the previous prior | Held-out joint-action log-likelihood and top-1 on human clicks, paired. |
| P1 | Does search earn its cost? | Raw prior, no search (Metamon's lesson: a strong policy may not need search) | H2H SPRT; if search does not win, the budget goes elsewhere. |
| G1 | Is generation n+1 better than n? | Previous checkpoint | H2H SPRT, same release. Promotion only on pass. |
| X | Is it exploitable? | Exploiter fine-tuned against the frozen net for a fixed budget | Exploiter's win rate must not rise generation over generation. |
| W | Did it actually run? | — | Live and self-play counters: leaf evals served by the net, fraction of decisions where the prior pruned, fallbacks. Zero or a fallback-dominated count fails. |
| L | Does it climb? | Ladder rating | Only after all of the above, with a stated game count and CI. The ladder is the goal, the offline rungs are how not to waste ladder games. |

**Traps pre-registered:** a baseline evaluated on different states than the net (asks nothing);
a turn feature pinned to zero (PORY); a state reconstruction that silently drops events (the
forme-change bug); a "beats material" read off point estimates (PORYGON2).

---

## 9. Build order

1. Node dataset emitter: human Reg M-C open-sheet game → per-turn state tensors + relational facts
   via MEDICHAM + joint clicks + outcome; event-coverage counter.
2. Count-HP baseline + V0/P0 harness (paired, clustered, split-half).
3. Gen 0: BC prior + outcome-trained V; must pass V0, P0.
4. JS forward pass + parity test; wire into the matrix search; W counters; pass V2 against count-HP.
5. Self-play workers under `tools/lownode.cmd`, Gumbel candidate sampling, playout-cap randomisation,
   blended targets; league with past checkpoints + BC anchor.
6. Iterate generations behind G1; add the exploiter (X) once G1 passes twice.
7. Only then: transformer ablation, depth-2 search at endgames, ladder.

---

## 10. Prior work surveyed

| Work | What it is | What we take |
|---|---|---|
| **VGC-Bench** (Angliss et al., arXiv:2506.10326, MIT) | Doubles VGC; 12-Pokémon observation, move/item/ability embeddings, 3-layer transformer, joint 107² slot actions, PPO; SP / FP / DO / BC variants; 8×A40 | **BC-initialised self-play (BCSP) is best at every team-set size**; diversity trades single-team strength for generalisation; BC-initialised agents were near-fully exploitable by a BC-initialised exploiter — hence the exploiter rung |
| **Metamon** (arXiv:2504.04395) | Singles, offline RL with 15M/50M/200M transformers, ~475k reconstructed human battles (~38M timesteps), self-play fine-tune; top-10% ladder | Imitation → RL → self-play order; **critic accuracy mattered more than the RL variant**; long-horizon value helped over pure BC; check search vs no-search |
| **PokéChamp** (Karten et al., ICML 2025) | LLM supplies action sampling, opponent model and value inside minimax; singles, projected ~1300–1500 Elo | Architecture confirmation (sample → opponent model → value → minimax); LLM calls are not laptop-affordable at search scale |
| **PokéAgent Challenge** (arXiv:2603.15563) | NeurIPS 2025, singles; RL and MCTS entries beat LLM entries; 20M+ trajectories | Decisions via search + learned nets, not LLMs |
| **Foul Play** (GPL-3.0 — read, never vendor) | MCTS with a hand-written evaluation instead of rollouts | A good leaf evaluator beats deep rollouts |
| **Public Reg M-B bots** (e.g. `philmantatsky/VGC-Pokemon-Showdown-AI`, MIT, self-reported) | PPO transformer, fictitious-play league incl. a human-imitation model cloned from ~14,000 top games; exact simultaneous-turn search with a calibrated win evaluator at the leaf; self-reported 55–45 over first 100 ladder games, peak 1365 | Same design direction, same format family; self-reported numbers, unverified |
| **Expert Iteration** (Anthony, Tian, Barber, NeurIPS 2017) | Apprentice/expert loop | The loop |
| **AlphaZero** (Silver et al., Science 2018); **Gumbel AlphaZero/MuZero** (Danihelka et al., ICLR 2022) | Search-improved policy/value targets; Gumbel-top-k + sequential halving guarantees policy improvement with few simulations | Few-evaluation regime, candidate sampling |
| **KataGo** (Wu, arXiv:1902.10565) | Playout-cap randomisation, auxiliary targets, efficiency on modest hardware | Both tricks |
| **SM-MCTS** (Lanctot, Lisý, Winands 2013) | Search in simultaneous-move games | Matrix-at-node shape |
| **DeepStack** (Moravčík et al., Science 2017); **ReBeL** (Brown et al., NeurIPS 2020); **Student of Games** (Schmid et al., Sci. Adv. 2023) | Depth-limited solving with a learned value | The leaf-value idea; full belief-state machinery unnecessary with open sheets |
| **DeepNash** (Perolat et al., Science 2022) | Model-free equilibrium learning in a large imperfect-info game | Fallback if search-based targets stall |
| **piKL / DiL-piKL** (Jacob et al. ICML 2022; Bakhtin et al. 2022, Diplomacy — simultaneous moves with humans) | KL-regularise search toward a human-imitation policy | The BC anchor in the policy target — strong *and* human-compatible, which is what a ladder rewards |
| **AlphaStar league** (Vinyals et al., Nature 2019); **PSRO** (Lanctot et al., NeurIPS 2017) | League with PFSP and exploiters; population best responses | League composition, exploiter rung |
| **Deep Sets** (Zaheer et al., NeurIPS 2017) | Permutation-invariant set encoder | Bench/slot invariance |

## Sources

- [VGC-Bench, arXiv:2506.10326 (HTML)](https://arxiv.org/html/2506.10326) · [code](https://github.com/cameronangliss/VGC-Bench)
- [Metamon, arXiv:2504.04395 (HTML)](https://arxiv.org/html/2504.04395)
- [PokéChamp, arXiv:2503.04094](https://arxiv.org/pdf/2503.04094) · [ICML 2025 poster](https://icml.cc/virtual/2025/poster/45207)
- [PokéAgent Challenge, arXiv:2603.15563](https://arxiv.org/abs/2603.15563)
- [philmantatsky/VGC-Pokemon-Showdown-AI](https://github.com/philmantatsky/VGC-Pokemon-Showdown-AI) · [Nolelle/pokemon-vgc-ai](https://github.com/Nolelle/pokemon-vgc-ai)
- [Policy improvement by planning with Gumbel, ICLR 2022](https://iclr.cc/virtual/2022/poster/6418)
- In-repo: `docs/COMPETITORS.md`, `docs/POKER-TO-POKEMON.md`, `docs/MODELS.md`,
  `engine/position_features.js`, `engine/board.js`, `data/medicham-speed.json`, `docs/DAMAGE-STAGES.md`.
- Classic references in §10 cited from the literature, not re-fetched for this report.
