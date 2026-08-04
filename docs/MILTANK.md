# MILTANK — the search player

*Named for the classic Rollout user. `engine/rollout_leaf.js` is the mechanism; MILTANK is the
player that uses it.*

---

## 1. What it is, and why it is not MAG

ABRA has two players and until 2026-08-03 only one of them had a name.

**MAG** (`engine/magnemite.js`) is a fitted linear policy over `board.js` features, trained to
predict **what a human clicks**. It is an imitator. Given a position it scores every legal option
against a weight vector fitted on 60,000 corpus decisions and takes the best — one step, no
lookahead, no notion of what happens next.

**MILTANK** decides by **playing the position out**. It forces a candidate pair of clicks, lets the
game run to a conclusion, and takes the line that wins most. It has no fitted weights of its own and
no opinion about what a person would do. It can therefore prefer a move that appears nowhere in the
corpus, and it routinely does.

They are not rivals and MILTANK is not a replacement. The shipped arrangement is:

> MILTANK searches. When the search **cannot separate its options** — the finalists fall inside one
> standard error, or the position is already decided — it hands the decision back to MAG.

That fallback is the point rather than a hedge. An argmax over estimates that overlap is a coin flip
wearing a search's clothes, and a fitted human prior is a better tiebreak than dice. **Imitation is
the floor; search is the ceiling.**

---

## 2. Where MILTANK decides

| Decision | Before | Now |
|---|---|---|
| Which 4 to bring, which 2 to lead | `return 'default'` — packed order | 90 brings enumerated and played out |
| Both clicks each turn | MAG's argmax | successive halving over every legal pair |
| Post-KO replacement | one-step heuristic | each candidate played out |

The preview one matters most. Showdown's `RandomPlayerAI.chooseTeamPreview` returns the literal
string `default`, `magnemite` never overrode it, so **every game ever played against this bot had
its lead decided by where a Pokémon happened to sit in a team string** — on what `prior_player.js`
itself calls *"the single largest branch in the game"*.

---

## 3. The academic position, and where MILTANK sits in it

### 3.1 This is a simultaneous-move game, and MILTANK does not solve it

Pokémon is not turn-based. Both players commit without seeing the other, which puts it in the
**simultaneous-move** class where a deterministic best response is exploitable by construction — the
matrix game at each node can have no pure equilibrium.

The literature offers several MCTS variants for this setting: **Decoupled UCT (DUCT)**, sequential
UCT, Exp3, and regret matching
([Lanctot et al., CIG 2014](https://www.mlanctot.info/files/papers/cig14-smmctsggp.pdf);
[Tak, Lanctot & Winands](https://dke.maastrichtuniversity.nl/m.winands/documents/wcg13-smmcts.pdf)).
DUCT lets each player pick from their own statistics without modelling the other. It is known **not
to converge to an optimal strategy even in a single-state game** — and it still performs best
empirically across their test set.

**MILTANK is weaker than all of these and the docs should say so.** It computes a *best response to
a fixed opponent policy*: the opponent plays `chooseAction` during the stepped turn, identically for
every candidate. That makes the comparison across candidates like-for-like, which is what the
measurement needs, but it is not an equilibrium and it is exploitable by anyone who models it.

It is the right first cut for one stated reason: if a best response does not diverge from MAG, a
mixture over the same cells will not either. `data/rollout-r3.json` records 72.9% divergence on 70
decisions, so it does diverge, and the equilibrium version is worth building.

### 3.2 The playout is fully random, and that is deliberate

The single most counter-intuitive result in this literature is that **a stronger playout policy can
make the search worse**. Policies that maximise MCTS performance as playouts are *weak* at playing
the game
([Are Strong Policies Also Good Playout Policies?, AIIDE](https://ojs.aaai.org/index.php/AIIDE/article/view/7423);
[An Analysis of Monte Carlo Tree Search](https://cs.brown.edu/people/gdk/pubs/analysis_mcts.pdf)).
What matters is how a policy *ranks* actions relative to each other, and **low-variance policies are
dangerous** — a deterministic greedy playout replays the same line from one position, so N samples
carry barely more information than one.

ABRA measured exactly this pathology before reading the literature. `chooseAction` is deterministic
greedy; 53% of positions landed in the 0–10% or 90–100% bin and those bins were wrong by 22–29
points, and accuracy was **flat in N**. R1 then found a fully random playout judges a position at
**68.18%** against **64.42%** for the greedy one.

**That comparison was withdrawn on 2026-08-04 as UNCHECKABLE.** The 68.18% was never written to an
artifact — `engine/rollout_r1.js` printed it — and the one committed row dump turns out to hold the
*greedy* column, so the figure could not be recomputed from anything in the repository.
`data/rollout-r1.json` records what survived, the greedy arm, at **65.72% against material's 65.26%,
+0.46 [-0.72, +1.63] — UNDECIDED**.

**It was re-run the same day and it reproduces.** `data/rollout-r1-explore-sweep.json`, from a
three-arm sweep over the identical 9,201 positions:

| explore | accuracy | Brier | log-loss | ECE | saturated |
|---|---|---|---|---|---|
| 0 (greedy) | 65.72% | 0.259 | 1.822 | 0.196 | 50.7% |
| 0.5 | 67.58% | 0.222 | 1.028 | — | — |
| **1.0** | **67.97%** | **0.213** | **0.863** | **0.104** | **29.4%** |
| material | 65.27% | 0.213 | 0.612 | 0.050 | — |

Paired: **+2.25 points, 95% CI [1.31, 3.19]** for 1.0 over greedy, monotone in explore, and it holds
at the live 60-turn horizon (67.46% against 64.21% on a second sample). The published 68.18% lands at
67.97% and the published +2.91 over material at +2.71 [1.60, 3.82].

So the retraction was right about the provenance and the claim survives it. **`--rollout-explore` =
1.0 stands, and it now stands on an artifact.** Two corrections that came with it: the "64.42% for
greedy" quoted in `rollout_leaf.js:147` and `mag_bot.js:145` does *not* reproduce — greedy is 65.7%
on both the committed dump and a fresh run — so those comments overstate the gap and should cite the
sweep artifact instead. And the saturation story is confirmed rather than merely argued: the greedy
playout puts **half** its positions in the two extreme bins and explore=1.0 puts under a third,
halving the calibration error. A deterministic playout replays one line, exactly as §3.2 claims.

**Caveat, measured 2026-08-03:** that result is about *judging a position*. Judging and *choosing an
action* are different jobs, and a random opponent never punishes a wasted turn. A direct test on 40
corpus positions found Protect scoring −4.3pt at explore 1.0 and −5.2pt at 0.0 — i.e. the randomness
is **not** obviously overpricing tempo. That is one measurement on one mechanic and it should not be
read as settling the question.

### 3.3 The picker is a fixed-budget best-arm identification problem

A turn offers up to ~90 legal pairs. Estimating each and taking the max is **not** the same as
finding the best one: the max over K noisy estimates is biased upward by roughly the spread of the
noise, so the winner is disproportionately the arm that got lucky. At n=120 a win rate near 0.7
carries a standard error around 4 points, and the max over 63 such arms is inflated by ~2 SE of pure
dice — larger than most real differences between two reasonable clicks.

The symptom was visible in play: **the bot clicked Recover at full HP**, a move MEDICHAM correctly
heals 0 with. It was not choosing Recover; it was choosing whichever arm rolled well.

This is textbook **fixed-budget best-arm identification**, and the standard remedy is **successive
halving**: spend the budget where it discriminates, not uniformly
([sequential halving / fixed-budget BAI](https://arxiv.org/html/2106.04763)). MILTANK screens every
pair at `N/3`, keeps the top 8, and re-tests those at `2N` **with fresh seeds** — so an arm that
advanced on lucky dice has to roll them twice. It is also cheaper than the flat version it replaced:
`63×40 + 8×240` beats `63×120`.

### 3.4 On-line policy improvement

The whole shape — take a base policy, improve it at decision time by rolling out — is Tesauro and
Galperin's on-line policy improvement
([arXiv:2501.05407](https://arxiv.org/pdf/2501.05407)). MAG is the base policy; MILTANK is the
improvement operator. That framing predicts the fallback behaviour: where the rollout has no signal,
the improved policy should return the base policy, which is what the noise-floor check does.

### 3.5 What the field says about the domain

[VGC-Bench](https://arxiv.org/abs/2506.10326) puts the team-configuration space at **~10^139**,
larger than Chess, Go, Poker, StarCraft or Dota, and ships 700,000 human battle logs with heuristic,
LLM, behaviour-cloning and multi-agent-RL baselines. Two findings bear directly on ABRA:

1. In **single-team mirror matches** their methods beat a professional VGC competitor. Strength in a
   narrow team distribution is achievable; that is roughly MILTANK's situation, playing a fixed pool
   of 230 open-sheet teams.
2. The agent that is best on **one** team is **more exploitable and generalises worse** across teams.
   This is a warning aimed squarely at ABRA: a bot tuned against the 230-team pool should not be
   assumed to hold up outside it, and any strength claim has to name the team distribution it was
   measured on.

---

## 4. Open team sheets are what make the preview search possible

MILTANK's bring/lead search is only meaningful because `|showteam|` hands over **the opponent's
entire team with full sets**. A fitted bring prior can say *"Whimsicott leads 53% of the time"* —
a fact about the population, not about this game. The sheet is information no usage prior can encode.

The opponent's own bring is **marginalised, not assumed**: each playout samples one of their 15
possible fours. Fixing a guess would optimise against one opponent out of fifteen and call it a plan.

**Known weakness:** that sample is *uniform*. A real opponent is not equally likely to bring every
four. Weighting it by `bring_priors` or by which four best answers MILTANK's own team is unbuilt.

---

## 5. What MILTANK is not

- **Not an equilibrium.** Best response to a fixed policy (§3.1). Exploitable by design.
- **Not a tree search.** One step of forced actions, then a playout. No selection, no backprop, no
  tree. Calling it MCTS would overclaim.
- **Not measured to be stronger than MAG.** R1 (leaf accuracy), R2 (cost), R3 (divergence) all pass.
  **R4 — the SPRT against shipped greedy — has never been run.** Every claim in this document is
  about mechanism, not about winning more games. As of 2026-08-03 the bot's record against its
  author is 0–8.

---

## 6. Files

| File | Role |
|---|---|
| `engine/rollout_leaf.js` | `rolloutWinProb`, `rolloutAfterActions` — the leaf |
| `engine/mag_bot.js` | MILTANK's three decision points; `--miltank` (`--rollout` aliases it) |
| `engine/medicham2-browser.js` | the doubles engine the playouts run in |
| `engine/rollout_r1/r2/r3.js` | the gates |
| `docs/ROLLOUT-design.md` | the original design note |

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--miltank` | off | use the search player |
| `--rollout-n` | 200 | playouts per candidate at the final stage |
| `--rollout-explore` | 1.0 | playout randomness. Re-earned 2026-08-04, `data/rollout-r1-explore-sweep.json`: +2.25 [1.31, 3.19] over greedy as a JUDGE. Not measured as a PLAYER — `mew.js` has no `--miltank-explore` |
| `--rollout-turns` | 60 | horizon before a playout is scored |
| `--preview-n` | 40 | playouts per candidate bring |
| `--preview-ms` | 15000 | preview deadline; whatever was scored by then is reported |

---

## Sources

- [Monte Carlo Tree Search Variants for Simultaneous Move Games — Lanctot et al., CIG 2014](https://www.mlanctot.info/files/papers/cig14-smmctsggp.pdf)
- [MCTS in Simultaneous Move Games — Tak, Lanctot & Winands](https://dke.maastrichtuniversity.nl/m.winands/documents/wcg13-smmcts.pdf)
- [Are Strong Policies Also Good Playout Policies? — AIIDE](https://ojs.aaai.org/index.php/AIIDE/article/view/7423)
- [An Analysis of Monte Carlo Tree Search](https://cs.brown.edu/people/gdk/pubs/analysis_mcts.pdf)
- [Fixed-Budget Best-Arm Identification in Structured Bandits](https://arxiv.org/html/2106.04763)
- [On-line Policy Improvement using Monte-Carlo Search — Tesauro & Galperin](https://arxiv.org/pdf/2501.05407)
- [VGC-Bench: Towards Mastering Diverse Team Strategies in Competitive Pokémon](https://arxiv.org/abs/2506.10326)
