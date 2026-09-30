# PORYGON2 v2 — the value net: design

**Status: DESIGN + DATASET. Nothing here is trained. No gate is run.** Written 2026-09-29/30 by SOLVER, before any v2 fit
and before any v2 game. The pre-registered gates are in `solver/porygon2/v2/preregistration.json`; this file explains
them. Dataset counts are in `solver/porygon2/v2/manifest-bo1.json` and `manifest-bo3.json` and are not restated here.

Decisions taken with Will on 2026-09-29 that this design implements, not re-opens:
pretrain on closed-sheet bo1, fine-tune on open-sheet bo3, both players' ratings as inputs, queried at high rating;
bo1 unrevealed information is UNKNOWN and never filled from a prior; each position shows only what was revealed by that
turn; self-play only from the strong search, if at all.

---

## 1. What v2 is for

PORYGON2 is the leaf value in MILTANK's per-turn matrix game (`solver/PLAN.md` §2, Appendix C): P(I win | position).
v1 (`solver/porygon2/v1/`) reads the full honest open-sheet state and trains on human outcomes plus self-play targets. Two
measured facts drive v2:

- v1's gate (c) against gen5 was INCONCLUSIVE at its 2,000-game budget, 0.516 [0.494, 0.538]
  (`CHANGELOG-REGMC.md` 1.26.0, `docs/_reports/2026-09-27-porygon2-v1.md`).
- More cheap self-play made it WORSE on human positions: v1-r1 against v1 on v1's own human test rows,
  +0.0045 [+0.0005, +0.0090] log-loss (`CHANGELOG-REGMC.md` 1.26.0). Gate (c) for r1: H0 after 868 games.

The open-sheet bo3 store, which is the game v2 is played in, holds essentially no high-rated play: 0 games with both
players rated at least 1500 and 89 with both at least 1400, of 25,238 clean games; the closed-sheet bo1 store holds 361
and 31 games with both players at least 1500 and 1600, of 29,537 clean (MEASURE,
`docs/_reports/2026-09-30-high-rated-regmc-counts.md` on branch `worktree-agent-a2fe7875c9565f705`). v2 therefore learns
what strong play is worth from bo1 and learns the open-sheet game from bo3.

## 2. The input is the PUBLIC state

A replay is a spectator's record. It shows both players the same way: six preview species a side, which members have
taken the field, displayed HP %, status, stat stages, volatiles, formes, the field and each side's conditions, and every
move, item and ability that some line of the log exposed. A player knew their own full set; the replay does not say it.

**v2 is a value over the public state, in training and in play.** At play time ROTOM feeds it the same public view (its
own unrevealed bring is withheld from the net exactly as the data withholds it), so the input distribution does not shift
between fitting and playing (the CLAUDE.md rule "fitting environment and playing environment must match"). Private
information reaches the decision through the search: XATU's worlds and MILTANK's playouts, not the net.

This follows the imperfect-information value literature, with one stated approximation:

- DeepStack's value network takes the public state (pot size, public cards) and **both players' ranges** and returns
  counterfactual values (Moravčík et al. 2017, arXiv 1701.01724, "Limited depth lookahead via intuition").
- ReBeL defines a **public belief state** — the public observations plus a common-knowledge belief distribution over
  each player's infostates — and learns a value function over it (Brown et al. 2020, arXiv 2007.13544, §4).
- Student of Games' counterfactual value-and-policy network is a function of a public belief state β = (s_pub, r), the
  public state and a range for each player (Schmid et al., arXiv 2112.03178, "Counterfactual Value-and-Policy Networks").

**The approximation:** v2 is given the public observation history (summarised as the current public state), not an
explicit belief vector. The belief is implicit — the human data's own distribution of hidden sets, conditioned on what
has been revealed and on the ratings. That is the black-box choice Metamon makes for the opponent (a sequence model that
learns to infer the opponent's team "implicitly"; Grigsby et al. 2025, arXiv 2504.04395, method section). An explicit XATU posterior as an
input is an arm for v3, not v2.

**Where v2 departs from Metamon on purpose.** Metamon reconstructs a first-person view by inferring every never-revealed
detail of the player's own team from usage statistics and back-filling it through the trajectory, and states the cost:
"inaccurate team inference can create inaccurate records of human decision-making" (arXiv 2504.04395, appendix on replay reconstruction). v2
back-fills nothing: an unrevealed field is the UNK token (Will, 2026-09-29: "if a mon doesnt have protect it could throw
things off").

### 2.1 Tokens

One token per preview member (6 a side, 12), one per side (2), one for the field, and two rating tokens. Per member:

| field | encoding | UNK possible |
|---|---|---|
| species (preview) | embedding, from the Reg M-C dex | never (the preview shows it) |
| forme now, mega | embedding / flag | only before the member is seen |
| brought | {yes, UNK} — never "no": a member never seen is not known unbrought | yes |
| HP %, status, stat stages, volatiles, position | numeric / one-hot, v1's definitions (`solver/porygon2/v1/features.js`) | HP and status UNK before first seen |
| moves | 4 slots: each a move embedding or the UNK embedding; the member's move vector = mean of the 4 slot vectors, plus the count of UNK slots | bo1 yes; bo3 never |
| item | `orig` and `now`, each an item embedding, NONE (knocked off / consumed) or UNK | bo1 yes; bo3 `now` tracks consumption |
| ability | `base` and `now`, each an ability embedding or UNK; `base` is DEDUCED (not guessed) when the species has exactly one ability in Reg M-C | bo1 yes |
| nature | embedding or UNK | bo1 always UNK |

A few closed-sheet rooms print both `|showteam|` sheets before the battle; their sets were then public to both players
from turn 1 and are carried as known (`sheets_public` on the game row; counted in the bo1 manifest).

UNK and NONE are different tokens. A learned UNK embedding per field kind, never a zero vector, so "unknown" cannot be
confused with "absent" (the exact failure behind Will's Protect example).

### 2.2 MEDICHAM facts, release-bound

The relational facts are MEDICHAM's, read through a frozen release (`--release`, stamped into every artifact), the same
facts CHOMP v1 reads (`solver/chomp/v1/features.js` `pairFacts`): for every ordered pair (my member i, their member j)
the best expected hit of i on j as a fraction of j's HP (`dmgRange` × `hitProb`, capped at 1), KO from full on the max
and on the min roll, a sure 2HKO, whether i moves first (`effSpeed`; a tie is 1/2), and a priority KO. v1's per-token
aggregates of those facts (`TFACT_NAMES` in `solver/porygon2/v1/features.js`) are carried over unchanged, recomputed on
the position's public state (HP, stages, field) as v1 does.

**With UNK fields, a fact is computed on what is known, and says so.**

- Moves: the facts range over the member's KNOWN moves only. A member with no known move has no outgoing facts; its
  token carries `unk_moves` (0–4) so the net can discount "threatens nothing" when it means "has shown nothing".
- Item UNK: the body carries no item. Ability UNK: the body carries **No Ability** (it exists in the Reg M-C dex,
  checked 2026-09-29: `D.abilities.get('noability').exists === true`). Each token carries `unk_item`, `unk_ability`.
- **Do not build these bodies with `solver/arena/teams.js` `buildBody`.** It silently fills an unknown ability with the
  species' first listed ability (`legal[0]`) — a prior-fill by construction. It is harmless for open sheets, which always
  name the ability, and wrong for bo1. v2 needs its own body builder that refuses to fill; the encode step owes it.
- Spreads: the table's flat spread, as v1 (spread-agnostic in training and play).

### 2.3 Ratings (Maia-2 conditioning)

Both pre-game ladder ratings are inputs, in the first-person frame: mine and my opponent's.

- Maia trained **nine separate models**, one per 100-point rating bin from 1100 to 1900, and each model's accuracy peaks
  near its own bin (McIlroy-Young et al. 2020, arXiv 2006.01855, introduction and results).
- Maia-2 replaced them with **one** model that encodes the active player's and the opponent's skill as embeddings over
  rating bins, E = [e(0,1000], e(1000,1100], …, e(2000,+∞)], injected into the attention queries, with a value head, and
  it over-samples games between players of different skill (Tang et al. 2024, arXiv 2409.20553, §3). It notes the
  earlier models "ignore opponent skill level".

v2 takes Maia-2's form, not Maia's: one net, two rating embeddings (100-point bins, an UNRATED bin for a null rating)
plus a continuous (r − 1300)/200 term each, added to the query of every attention block. **Query at high rating**: in
play, my rating input is the target band (pre-registered: 1600) and the opponent's is their displayed ladder rating. The
value then estimates P(win) under how strong players continue from here, which is closer to the equilibrium value the
search wants than the population average. The risk is extrapolation: bo3 has no game with both players at 1500+, so the
high-rating behaviour is carried almost entirely by bo1 pretraining. Gate (a) reads it by band (§6), and a rating
ablation is reported.

Unrated games (null rating) stay in, with the UNRATED embedding. Games between unequal ratings are over-sampled 2× in
stage A, as Maia-2 does.

### 2.4 Architecture

A pre-LN transformer encoder over the 17 tokens (12 member + 2 side + 1 field + 2 rating), 2 blocks, d = 48, 4 heads,
FFN 96; rating embeddings also enter every block's queries (§2.3); the value head reads the pooled member tokens of each
side and the field/side tokens, and is made antisymmetric by construction as v1's is (v(me, opp) = 1 − v(opp, me):
evaluate both chair orders and average the logits' difference). Order invariance over preview slots is by construction
(no positional encoding across member tokens). Size is bounded by the leaf-cost bar: median leaf cost at most 1.5× v1's
on the same positions (v1 attn arm: 1,883 µs total, 751 µs forward, `solver/porygon2/model/porygon2-v1.bench.json`).
Train in PyTorch (CPU), infer in hand-written Node, a JS-vs-Python parity test shown red on a perturbation first — the
v1 pattern.

## 3. Targets

**Main value target.**

- Human positions: the outcome z (1 win, 0 loss, 0.5 tie), in the first-person frame. A forfeit after play is kept as a
  decided game (`engine/quality.js`, rule 1.2.0: 86.8% of quitters were behind on material).
- bo3 positions that carry a deep search label: y = 0.5 z + 0.5 v_deep, v1's pre-registered blend
  (`solver/porygon2/v1/preregistration.json`, `selfplay_deep`), with v_deep from `solver/porygon2/v1/label.js` on the
  current release. bo1 positions get **no** search label: a search needs full sets, and filling them would be the prior
  the data rule forbids.

What the literature says about blending, checked:

- AlphaZero's search-improved target is the **policy** (the visit-count distribution π); the **value** is trained on
  the game outcome z by mean-squared error (Silver et al. 2017, arXiv 1712.01815: "minimise the error between the
  predicted outcome v_t and the game outcome z, and ... maximise the similarity of the policy vector p_t to the search
  probabilities π_t"). So AlphaZero is the citation for search-improved *policy* targets, not value targets.
- KataGo (methods notes, since run g170) trains auxiliary value heads on **exponentially weighted future MCTS values**,
  (1 − λ) Σ_{t' ≥ t} MCTS_value(t') λ^{t'−t}, at horizons of about 6, 16 and 50 turns, and reports slightly faster
  training and better main-head loss when the main head's weight is lowered and these are added
  (`lightvector/KataGo` `docs/KataGoMethods.md`, "Short-term Value and Score Targets"). That is the precedent for
  blending a search value into the value target.
- Expert Iteration labels positions with a Monte Carlo value estimate and notes that training a value function without
  severe overfitting "requires more than 10^5 independent samples" (Anthony et al. 2017, arXiv 1705.08439, §5.2).

**Auxiliary heads** (the KataGo ownership/score analogue). KataGo's auxiliary ownership and score targets gave a 1.65×
learning-efficiency factor in its ablation table and removing them "resulted in a noticeable drop in learning
efficiency"; the reason given is that the binary outcome is noisy and "a direct function of finer variables"
(Wu 2019, arXiv 1902.10565, §4.1, §5.2, Table 2). The finer variables of a Pokémon game:

| head | target (read after the game, never an input) | analogue |
|---|---|---|
| member survival | per member token: alive at the end (0/1) and HP % at the end; masked for a member never seen | ownership |
| material | final alive count difference (−4 … +4, categorical) and final HP-fraction difference | score |
| next KO | who faints next: me / opp / both in the same turn / nobody (4-way), and in how many turns (0, 1, 2, 3+) | short-term |
| horizon | turns remaining (0, 1, 2, 3–4, 5+) | short-term |

In a forfeited game the final board is the board at resignation; the member-survival and material heads are masked for
forfeits, the next-KO head is kept (a faint that happened is a fact). Loss weights: main 1.0; the auxiliary heads
together sized to 10–40% of the main head's gradient, KataGo's stated rule for its own auxiliary weights ("anywhere from
ten to forty percent as large as those from the main policy and value head terms", arXiv 1902.10565, appendix on loss coefficients).

## 4. Positions per game

AlphaGo's value network, trained on complete KGS games, **memorised outcomes**: test MSE 0.37 against 0.19 on training,
"because successive positions are strongly correlated ... but the regression target is shared for the entire game". A
new set of 30 million positions, "each sampled from a separate game", gave 0.226 train and 0.234 test (Silver et al.
2016, Nature 529, doi:10.1038/nature16961, "Reinforcement learning of value networks"). Expert Iteration does the same:
"select a single state from each game" (arXiv 1705.08439, §4.2 "Sampling the position set").

v2 stores **every** turn-start position (the dataset is a record, not a sample) and trains on **K = 1 position per game
per epoch**, a fresh uniform draw each epoch, weighted per game. The difference from AlphaGo is stated: across E epochs
one game contributes up to E positions, though never two in one epoch. The AlphaGo diagnostic is reported for every fit:
train-minus-validation log-loss per epoch. K = 2 and K = all are pre-registered ablations, chosen only if validation
log-loss prefers them.

## 5. Schedule: pretrain on bo1, fine-tune on bo3

| stage | data | what | stop |
|---|---|---|---|
| **A. pretrain** | bo1 TRAIN games | all heads; UNK fields as they fall; unequal-rating games 2×; K = 1 | lowest bo1 validation log-loss |
| **B. fine-tune** | bo3 TRAIN games, plus 25% of each batch replayed from bo1 | initialise from A; LR × 0.3; same heads | lowest bo3 validation log-loss |
| **C. search targets** (owed) | bo3 positions with deep labels; self-play ONLY from the strong search | y = 0.5 z + 0.5 v_deep | bo3 validation, then gate (a) |

The bo1 replay in stage B is there because bo3 has no high-rated games: fine-tuning on bo3 alone would leave the
high-rating embeddings unconstrained while the rest of the net moves. No self-play from cheap search is used at any stage
(v1-r1, §1). The split is the MAG/DODUO player split, lifted to the game (§6).

## 6. Evaluation (pre-registered, NOT RUN)

**The split.** By player, MAG/DODUO's salt (`abra-prior-v0`: 80/10/10), lifted to the game: a game is TEST if either
player is a test player, else VAL if either is a val player, else TRAIN. A value net gives the two chairs of one game
complementary labels, so a per-player split of positions would put one result on both sides of the line.

**Gate (a) — held-out human positions, by rating band.** v2 against v1 (the net in the champion league file at launch,
named by sha256 in the run) and against the count-HP logistic, paired on the same positions:

- The positions: bo3 TEST games that v1 never saw — read from a raw shard that is **not** in the human dataset's
  manifest (`solver/out/human/manifest.json`, `source.inputs`), recorded per game as `v1_unseen`. v1 trained on human
  positions from TRAIN players of that dataset, so most games in any v2 test set were in v1's training data; only the
  newer shards are fair to both.
- PASS iff the 95% upper bound (bootstrap over games, 2,000 resamples) of Δ = log-loss(v2) − log-loss(v1) against the
  outcome is < 0 on the pooled eligible positions, AND the point estimate of Δ is ≤ 0 in every min-rating band holding at
  least 200 eligible test games. Bands: < 1100, 1100–1199, 1200–1299, ≥ 1300 (merged: bo3 has too few games above
  1300 to split). Turns 1–3 are reported separately (Appendix B of `solver/PLAN.md`).
- Reported, not gating: Brier and ECE with 10-bin reliability; the bo1 test split by band, including ≥ 1500, as a
  diagnostic of the high-rating conditioning; each auxiliary head's own loss; the ablations (no pretrain, no auxiliary
  heads, no rating inputs, K = 2, K = all).

**Gate (c) — SPRT against v1 at equal wall-clock.** Only if (a) passes. MILTANK with v2 as the leaf against MILTANK with
v1, both with gen5's MAG and DODUO, k 4×4, one reserved switch row, depth 0, **1,000 ms per decision** (equal wall-clock,
so v2's leaf cost is paid in playouts), honest information (`--info honest`), TEST team pairs of
`data/team-pool-frozen-regmc`, release `eaa5becc54eb` or later (stamped), elo0 0, elo1 +20, α = β = 0.05, at most 2,000
games, battle seed 9301. PASS iff H1. **Read once, at the bound or the budget; no interim LLR.** Leaf-cost bar before
the SPRT: v2's median leaf cost at most 1.5× v1's on the same 300 positions (`solver/porygon2/v1/bench.js`).

**Capability counters (the W rung).** Every fit prints: positions read per stage, the share of member-fields that were
UNK, leaf evaluations served in the SPRT, fallbacks. A zero or a fallback is called out.

## 7. The dataset (built)

`solver/porygon2/v2/extract.js` (store-only) reads the parsed `.gz` store explicitly, applies `engine/quality.js`
`reasons()` with the behavioural-bot set, rebuilds every turn-start position from the raw log through
`solver/porygon2/v2/reveal.js`, and writes `solver/out/porygon2-v2/<fmt>/games.jsonl.gz` (gitignored) with a manifest
(inputs by sha256, outputs by sha256, code digests, every count). `solver/tests/test-porygon2-v2-extract.js` proves no
leak: a position at turn n is byte-identical to the one built from the log cut at the `|turn|n` line, and every revealed
field in it is named before that line; RED under two deliberate breaks.

## 8. Open questions

- The rating query value (1600) is pre-registered as a starting point; the band table from gate (a) may argue for a lower
  one if the ≥ 1300 band is where v2's edge lives.
- An explicit XATU posterior as an input (ReBeL/SoG proper) is v3.
- Whether to run stage C at all depends on the deep-label refit of v1 (`docs/_reports/2026-09-30-porygon2-deep-labels.md`
  when it lands): if search targets do not help v1, they are not the lever for v2 either.
