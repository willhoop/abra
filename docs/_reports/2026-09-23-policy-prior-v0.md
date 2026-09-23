# Human policy prior v0 — P(joint action | public state, both open sheets), Reg M-C

2026-09-23. Solver stack, piece 2. Historical findings record, not maintained. Research basis:
`2026-09-23-solver-research-learning.md` §3 and §9 (prior as the BC seed and the P0 test),
`-turn-search.md` §3.4 and S1 (the pruner, gated on JOINT coverage), `-humans-and-ladder.md` §1
(HYPNO's habit model). Dataset: `2026-09-23-human-dataset.md`.

## Verdict

**Built, tested, and it clears both baselines by a wide margin on held-out PLAYERS.** The human's
exact joint action is in the model's top 16 joint actions **83.1% [82.4, 83.6]** of the time
(two-slot decisions only: **81.7% [81.0, 82.3]**), against **44.3%** for per-species move frequency and
**49.2%** for the stronger frequency baseline. Joint log-loss **2.92** nats against **4.35 / 4.04**.
Every paired difference has a player-cluster 95% CI far from zero. Node reproduces the Python logits to
1.1e-14 on 37 held-out decisions; the test was shown RED on two deliberate breaks first. No simulator
was used; nothing written outside `solver/` except this file; no git run.

**Two limits that matter before anyone wires it in** (§6): the candidate set is "legal-looking", not the
engine's legal set, and **the switch candidates are the actor's BROUGHT four** — right for my own side,
hindsight for the opponent's. For the opponent the prior is a *per-bring-world* prior and must be
evaluated inside each world, as the turn-search design already does.

## 1. What the model is

Per side-turn decision, both slots at once:

```
x      = [ norm(slot context, 49) ; norm(candidate, 30) ; E[move] (8) ]      per candidate
h      = relu(W1 x + b1)                     64 hidden, shared across slots
s = w2·h      u = U h      v = V h           rank-8 pair factors
L[i,j] = s_a[i] + s_b[j] + u_a[i]·v_b[j] + wp·pair(i,j)      over VALID joint cells only
P      = softmax over the joint cells
```

- **Candidates** per slot (`solver/prior/features.js`): each sheet move × each target the move's
  Dex target type lets you choose (foe a / foe b / ally / self, only live occupied slots) × mega
  on/off when the mon holds its mega stone and the side has not mega'd; plus a switch to each benched,
  un-fainted mon. Invalid joint cells: both slots switching to the same mon, both mega-evolving.
  Mean 10.3 candidates per slot, max 26 (1,000-game trial).
- **Pair term** — DODUO's point, "score the PAIR": a low-rank bilinear interaction plus six named
  indicators (same foe targeted, both protect-class, both switch, same move, ally targeted, both
  spread). Ablation (§4) shows it earns its place.
- **Every game fact is read from `Dex.forFormat('gen9championsvgc2026regmcbo3')`** via
  `solver/human/dex.js`: move category, power, priority, accuracy, target type, `stallingMove`,
  species types and base Speed, type effectiveness and immunity, `megaStone`. Nothing typed.
- **Frequency features** (the old MOVE PRIORS idea, as inputs): log P(move | species), log P(target
  class | species, move), log P(mega | species, move), Laplace-smoothed, counted on TRAIN actors
  only, **leave-own-game-out** for train rows so a row never sees its own click.
- **Labels** handle the unobserved honestly rather than guessing: an uncertain target widens the label
  to every target of that move; a hidden slot (flinch, fainted first…) widens it to the whole slot, so
  the other slot is trained on its marginal; a locked slot is collapsed to one forced candidate.
  Loss = −log Σ P over the label cells.
- **Size**: 8,638 parameters (`solver/prior/model/prior-v0.json`, 196 KB) + the train frequency
  tables (`freq-v0.json`, 163 KB). Node forward pass: **0.53 ms per decision** including
  featurisation (2,000 decisions, one core).
- **Stack**: numpy 2.5.1 only. torch and sklearn are **not installed** here; an 8.6k-parameter net's
  forward and backward pass was shorter to write than an install is to approve. The backward pass
  was checked by finite differences before training: worst relative error 1.0e-8 over 39 entries
  (pair model), 8.5e-8 over 27 (no-pair).

## 2. Data and split

- **Dataset**: `solver/out/human/games.jsonl`, sha256 `9d07c522200de0723790cca734d441a001359f1cfe43a314dd141feaccf2b4c8`
  (checked against its manifest before reading), manifest sha256
  `990aafd022846fe684c8cd93253d771c3f5c9045ba58a31062a2ababd1061a64` (generated 2026-09-23T08:03:12Z),
  26,888 games. Both digests are stamped into the model JSON and the metrics file.
- **Split BY ACTING PLAYER**: `sha256("abra-prior-v0:" + toID(name)) mod 100` → <80 train, <90 val,
  else test. **4,892 / 603 / 620 players** (6,115 distinct IDs after `toID`); decisions 298,171 /
  34,898 / 37,816. A decision belongs to the player who made it; the opponent's sheet is an input.
- **Why player, not series or turn**: turns within a game share a team and a plan, and series and
  games of the same player share a team and habits — a turn or series split would score the model on
  players it has already memorised. The consumers need the opposite: the pruner and HYPNO face
  opponents we have never seen. Player is the strictest of the three and the one that answers that.
  (A copied team used by two players still crosses the split; that is the real ladder too.)

## 3. Results on the TEST players (620 players, 37,816 decisions)

CIs are 95% player-cluster bootstrap, 1,000 resamples; paired differences use the same resamples.
Source: `solver/prior/model/prior-v0.metrics.json` (evaluated from the EXPORTED json; identical to the
in-memory training run to 0.0).

**Joint action, exact decisions (n = 25,477)**

| | model | uniform | species freq | species freq+ |
|---|---|---|---|---|
| log-loss (nats) | **2.921** [2.893, 2.952] | 4.401 | 4.348 | 4.038 |
| top-1 | **21.3%** [20.7, 21.9] | 4.8% | 6.9% | 6.5% |
| recall@4 | **50.3%** [49.5, 51.1] | 13.6% | 21.0% | 21.2% |
| recall@8 | **66.5%** [65.8, 67.2] | 20.9% | 30.9% | 33.0% |
| recall@12 | **76.5%** [75.8, 77.2] | 26.6% | 38.0% | 41.7% |
| recall@16 | **83.1%** [82.4, 83.6] | 31.5% | 44.3% | 49.2% |
| recall@24 | 90.9% [90.5, 91.4] | 38.4% | 54.3% | 61.5% |
| recall@32 | 95.1% [94.7, 95.4] | 44.3% | 62.0% | 71.2% |

**Paired, model − species freq+ (the stronger baseline):** log-loss −1.117 [−1.156, −1.079];
recall@4 +29.1 pp [28.2, 29.9]; @8 +33.5 [32.5, 34.4]; @12 +34.8 [33.9, 35.7]; @16 +33.9 [33.0, 34.8].
Against species freq: log-loss −1.427 [−1.464, −1.387]; @16 +38.8 pp [37.9, 39.7].

**Two-slot decisions only (n = 23,588)** — the matrix game lives here: recall@4 46.6%, @8 63.8%,
@12 74.7%, **@16 81.7% [81.0, 82.3]**, @24 90.2%; log-loss 3.059.

**Per slot, exact slots (slot a n = 29,117, slot b n = 29,011)** — marginals of the joint model:

| | model a / b | species freq+ a / b |
|---|---|---|
| log-loss | 1.535 / 1.540 | 2.110 / 2.088 |
| top-1 | 42.0% / 41.6% | 21.9% / 22.0% |
| recall@2 | 64.4% / 64.0% | 37.9% / 38.8% |
| recall@4 | 87.1% / 87.3% | 64.5% / 65.0% |
| recall@8 | 99.2% / 99.4% | 94.0% / 94.7% |

**Per-slot overstates joint**, as `-turn-search.md` warns: @8 is 99% per slot and 66.5% joint.

**What the human's joint action contains** (model recall@16; freq+ beside it):

| contains | n | model @8 | model @16 | freq+ @16 |
|---|---|---|---|---|
| a switch | 6,289 | 52.0% | **74.8%** | 29.7% |
| no switch | 19,188 | 71.3% | 85.8% | 55.6% |
| a mega | 3,487 | 64.9% | 81.2% | 17.1% |
| a protect-class move | 6,079 | 65.0% | 84.0% | 60.8% |
| turn 1 | 4,330 | 58.8% | **76.0%** | 31.5% |
| later turns | 21,147 | 68.1% | 84.5% | 52.8% |

Switch-containing joints and turn 1 are the weak spots — **PokaiTrainer's reserved switch slots are
still warranted** on top of this prior. Mega is not a weak spot for the model.

## 4. Ablation: the pair term

Same features, `--no-pair` (`solver/out/prior/ablation/prior-v0-nopair.metrics.json`, untracked):
best val loss 2.689 vs 2.611; test joint log-loss 3.008 vs 2.921, recall@8 63.4% vs 66.5%, @16 81.5%
vs 83.1%, top-1 18.3% vs 21.3%. The CIs do not overlap at top-1 and @8. Per-slot numbers barely move
(slot a @1 40.8% vs 42.0%), so **the gain is coordination, which is exactly what a factorised policy
cannot represent**.

## 5. Exclusions (test split, counted, never guessed)

| joint status | decisions | in the joint metrics? |
|---|---|---|
| exact | 25,477 (67.4%) | yes |
| hidden slot | 9,421 (24.9%) | no — the chosen action is not in the log; the OTHER slot is still scored per-slot if exact |
| uncertain target | 2,910 (7.7%) | no — the log shows the target hit, not chosen |
| outside the candidate set | 8 | no — all are Transform (Ditto) / Struggle; would cost < 0.03 pp as misses |

Slot statuses: 58,128 exact, 10,941 hidden, 3,214 uncertain target, 114 locked (collapsed to one forced
candidate; the joint rank is then the partner's), 8 outside.

**The exact subset is not a random sample.** Hidden slots are mostly `fainted_before_acting` and
flinches — the slower mon in a losing position — and uncertain targets concentrate on Follow Me / Rage
Powder / Lightning Rod boards. Recall on those boards is unmeasured, not assumed equal.

## 6. Limits (read before wiring into the search)

1. **Legal-looking, not legal.** The candidate set ignores choice lock, Encore, Taunt, Disable,
   Imprison, PP and trapping (the features carry `my_choice`, `my_taunt`, `my_encore`, `repeat`, so the
   model learns them softly). The search must intersect with the engine's `legalActions`. That can only
   RAISE recall: an illegal candidate removed from the top-K frees a slot.
2. **Switch candidates are the actor's brought four (`brought_seen`).** Measured on 2,000 games:
   **48.3% of decisions** have a switch candidate to a mon not yet revealed at that turn, and **62.5% of
   human switches** go to one. Correct for predicting MY side (I know my bring). For the OPPONENT it is
   hindsight: the model is being told which unrevealed sheet mons were brought. So this is a prior
   **conditional on a bring world** — use it inside each world of the Bayesian matrix game
   (`-turn-search.md` §3.5), never across worlds. Games whose fourth mon never appeared are missing
   that mon as a switch candidate; it was never chosen, so no label is lost.
3. **HP is the replay percentage; spreads are unknown.** No damage calculation enters the features —
   no MEDICHAM (gate not open) and no hand-written damage math. Type effectiveness and base Speed are
   the only matchup facts. Adding MEDICHAM relational facts is the obvious v1 once the Reg M-C gate opens.
4. **No per-player habit model yet.** HYPNO needs `P(action | player, bucket)`; v0 is population-level.
   The player split is what makes a per-player head measurable later.
5. **Transformed Ditto** is outside the set (8 test slots). A transformed mon's moves are the target's
   sheet moves; one line in `features.js` when it matters.
6. **One training run, one seed.** Val loss was still falling 0.0006 at epoch 6; bigger H or more
   epochs probably help a little. The CIs cover player sampling, not training variance.
7. **Uncertain-target and hidden labels widen, they do not guess** — so the model learns the marginal
   on those turns. That is conservative, but it means Follow Me boards teach target choice nothing.

## 7. Verification

- `solver/tests/test-prior.js` (run via `tools\lownode.cmd`): **GREEN 1,062/1,062**.
  (1) pinned labels on a real game re-parsed from its tracked shard (`20260909T1850-00`, id
  `…-2678209493`): Tailwind, Fake Out into foe a, a flinch hidden, Electro Shot into foe b, a
  fainted-first hidden, the mega turn labelled mega; (2) invariants over every decision of that game;
  (3) agreement on 37 held-out decisions from 10 test games: Node features == the trainer's float32
  tensors exactly, logits to **1.07e-14**, same top-16 joint actions, probabilities sum to 1, and the
  fixture names the model's sha256 so a retrain without a new fixture is RED.
- **Shown RED on deliberate breaks before trusted**: (a) `both_stall` changed from AND to OR in
  `features.js` → 219 failures, worst logit diff 0.277, exit 1; (b) Showdown target loc 1↔2 swapped
  → label-vector and pinned failures, exit 1. Restored → GREEN.
- Gradient check (finite differences) PASS for both variants; eval re-run from the exported JSON
  reproduced the training run's metrics exactly.

## 8. Files

| path | what | track? |
|---|---|---|
| `solver/prior/features.js` | THE feature + candidate + label function (Node; trainer and inference both use it) | yes |
| `solver/prior/build_features.js` | player split, train freq tables, binary tensors → `solver/out/prior/` (~1 GB) | yes (output: never) |
| `solver/prior/train.py` | numpy model, training, baselines, bootstrap, export, fixture; `--gradcheck`, `--eval-only`, `--no-pair` | yes |
| `solver/prior/infer.js` | hand-written Node forward pass: `load().predict(row, t, side).top(K)` | yes |
| `solver/prior/model/prior-v0.json` | weights + normalisation + dataset digests + split rule | yes (196 KB) |
| `solver/prior/model/freq-v0.json` | train-actor frequency tables the features read | yes (163 KB) |
| `solver/prior/model/prior-v0.metrics.json` | every number in §3–5 | yes |
| `solver/tests/test-prior.js`, `solver/tests/fixtures/prior-v0-agree.json` | the test and its fixture (479 KB) | yes |

Reproduce:
```
cmd.exe /c tools\lownode.cmd solver/prior/build_features.js                 # ~3 min
python solver/prior/train.py --fixture solver/tests/fixtures/prior-v0-agree.json   # ~30 min, 6 threads
python solver/prior/train.py --no-pair --tag prior-v0-nopair --out solver/out/prior/ablation
cmd.exe /c tools\lownode.cmd solver/tests/test-prior.js
```
(Python was run at BelowNormal priority via `Start-Process`; peak ~1.3 GB per process.)

## 9. Owed

- Nothing committed; the other session owns git. The model, freq tables, metrics and fixture are small
  and meant to be tracked; `solver/out/` stays ignored.
- The opponent-side use needs the bring-world wrapper (§6.2) — the model is ready for it, the wrapper
  is search code.
- v1: MEDICHAM relational facts once the Reg M-C engine gate opens (features only; the architecture
  and the tests carry over), a per-player head for HYPNO, and Transform.
