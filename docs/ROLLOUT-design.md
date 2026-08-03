# The rollout leaf: judging a position by playing it out

**2026-08-03.** Written after MEDICHAM went from 89.2% to 96.7% click coverage in one session, which
is the only reason this is now buildable. Will's question started it: *"cant it just be all the same
calcs we already do"*.

---

## 1. The claim, and the number it rests on

Every search in `docs/LOOKAHEAD-design.md` maximises a leaf. That leaf is PORYGON3, and
`data/porygon3.json` scores it against its own baselines:

```
  coin                50.38%
  material sign       60.28%   <- "who has more bodies and HP"
  PORYGON3 (k=200)    63.70%
```

**The entire learned value function is worth 3.4 accuracy points over counting bodies.** A search that
maximises it is, to within 3.4 points, a search for "which move removes the most material next turn" —
which is what a greedy damage policy already does. That is the strongest available explanation for why
one step of foresight measures small once the clock artifact is removed (`+2.29`, not `+4.91` —
`engine/lookahead_clock_control.py`).

So the leaf is the constraint, not the search. This document is about replacing it.

**The replacement**: seed MEDICHAM from the real position and play it out. The answer is then a
measured win rate rather than a snapshot judgement, and it is produced by the same doubles engine that
already ships in ALAKAZAM's Future Sight.

---

## 2. Why this is buildable today and was not yesterday

`battleInit` never reset HP — it takes the Pokemon objects as handed over. MEDICHAM could always have
been seeded mid-game; nothing ever did it because `winProb2` builds fresh mons from names.

What was genuinely missing was coverage. On 2026-08-03 the engine turned an unmodelled click into a
**no-op turn**, which is not neutral noise: it biases against exactly the utility and multi-turn moves
that decide games. `engine/medicham_coverage.js` measured it and the session closed the gap:

| | |
| --- | ---: |
| start of session | 89.2% |
| Trick Room | +1.18 |
| heal family (Roost, Recover, Life Dew) | +0.80 |
| redirection (Rage Powder, Follow Me) | +1.78 |
| screens (Reflect, Light Screen, Aurora Veil) | +1.69 |
| switching — voluntary, pivot, faint | +2.12 |
| **now** | **96.7%** |

Plus the corrections Will supplied while it was being built: Aurora Veil needs snow; Brick Break,
Psychic Fangs and Raging Bull break screens; Light Clay extends them; Prankster's +1 (which was
modelled *nowhere*, so a Prankster screen went up *after* the attack it was meant to blunt).

**Still missing, and stated rather than buried**: Parting Shot's Atk/SpA drop (`statChangeInCode`, and
no artifact this engine reads carries the numbers), and the 3.3% tail of moves that remain no-ops.

---

## 3. The literature, including the result that argues against this design

### 3.1 Truncated rollouts are the right shape, and MEDICHAM already has one

Tesauro's rollout work established that trials need not be played to completion: stop after a few
steps and substitute an estimate of the position reached. That costs less CPU **and has lower variance
per trial**, because a real-valued estimate replaces an integer outcome reached through many random
steps ([Monte Carlo Rollouts in RL](https://www.emergentmind.com/topics/monte-carlo-rollouts);
[Tesauro & Galperin, On-line Policy Improvement using Monte-Carlo Search](https://arxiv.org/pdf/2501.05407)).
Full Monte Carlo is low bias and high variance; bootstrapping trades variance for bias; truncation is
the compromise, and an intermediate λ beats both endpoints
([bias-variance in RL](https://www.endtoend.ai/blog/bias-variance-tradeoff-in-reinforcement-learning/)).

`battleOver` already stops at `S.turn>=20` and `battleResult` already returns a graded readout —
bodies first, then summed HP fraction, 0.5 for a dead tie. That is a truncated rollout with a material
estimate at the horizon, and it was there before this document.

### 3.2 A STRONGER rollout policy does not reliably make the search stronger

The most useful counter-intuitive result in the area: *the strength of a rollout policy as a
standalone player is not a good predictor of its strength inside a Monte-Carlo search*. Objectively
stronger rollouts frequently make UCT **worse**, and heavy rollouts help only when they avoid becoming
low-variance ([An Analysis of Monte Carlo Tree Search](https://cs.brown.edu/people/gdk/pubs/analysis_mcts.pdf);
[MCTS-Minimax hybrids](https://dke.maastrichtuniversity.nl/m.winands/documents/mcts-minimax_hybrids_final.pdf)).

This is a live risk here and it is cheap to get wrong: the obvious "improvement" after this ships is to
make `chooseAction` play better inside the rollout. **That may reduce accuracy, and it must be
measured rather than assumed.** It also means MAG is not automatically the right rollout policy just
because it is our best player.

### 3.3 The strongest comparable bot decided rollouts were NOT worth it

[**Foul Play**](https://pmariglia.github.io/posts/foul-play/) is a competitive Showdown bot on a custom
Rust engine (`poke-engine`). It reaches **Top 100 in Gen9 OU (80% GXE)**, **#1 in Gen9
RandomBattleBlitz (84%)** and **71–88% GXE across formats** — and it runs MCTS **"guided by a custom
evaluation function rather than rollouts."** It also abandoned expectiminimax because search beyond
about five turns timed out, and it groups the 32 damage rolls by whether they cause a faint rather than
branching on each.

**BUT IT PLAYS SINGLES, AND WE PLAY DOUBLES.** Every format quoted — Gen9 OU, Gen4 RandomBattle, Gen9
RandomBattleBlitz — is 1v1. Will asked and the answer changes how much the result transfers:

- A singles side picks ONE action from ~9. A doubles side picks a PAIR, so the joint action space is
  that squared, and the matrix is squared again across both sides. `engine/truncation_curve.js`
  measured a median of 8 candidates per slot in our corpus, so unpruned is ~64 joint actions per side
  against Foul Play's ~9.
- "Depth 10 or more" is therefore a much cheaper claim in their game than in ours. Their own
  expectiminimax gave out past ~5 turns *in singles*.
- Redirection, spread damage, Wide Guard, Follow Me and partner interactions do not exist in singles at
  all, and those are precisely the mechanics a static evaluation function struggles to score and a
  playout gets for free.

So it is real evidence that a static eval can carry a strong bot, and weak evidence about what wins in
doubles. Recorded rather than in a footnote. Two honest readings:

- **Against us**: a good static eval plus deep DUCT search beats shallow rollouts, and our effort is
  better spent on the eval and the search than on the playout.
- **For us**: Foul Play *has* a good custom evaluation function. We do not — ours is worth 3.4 points
  over counting bodies. Rollouts are the cheapest way to get a better leaf *when you do not already
  have one*, which is precisely our position.

Both readings agree on the measurement in §5, which is why that is the gate.

### 3.4 Simultaneous moves, unchanged from LOOKAHEAD-design §3.2

Both players commit blind, so the root is a matrix game. DUCT is what Foul Play uses and what the
literature recommends; regret matching converges and `engine/slowking/nash.py:solve_rm` already
implements it. **None of that is in scope here.** This document is only about the leaf.

### 3.5 The field's own warning still stands

`docs/LITERATURE-v2.md` §2: Metamon (arXiv 2504.04395) reaches top-10% of human players with offline RL
and **no search at all**. The [PokéAgent Challenge](https://www.wispaper.ai/en/user-blog/pokeagent-challenge-competitive-long-context-learning-scale-20260320/eng)
(22M+ trajectories) finds specialised RL and search still beat generalist LLMs. Neither route needs a
rollout leaf.

---

## 4. The design

### 4.1 One function

```
    rolloutWinProb(board, side, N)  ->  P(side wins)
```

**Seed.** Every Pokemon on both sides — active and benched — becomes a MEDICHAM mon via the existing
`mc_key.js` resolver and `buildMon`, then has its live state written onto it: current HP, status,
stat stages, item. The bench matters now that switching exists; before this session it would have been
decorative.

**Do not re-apply entry effects.** `battleInit` runs `applyEntryEffects` and Intimidate on the actives,
which is correct when a battle starts and wrong for a mid-game seed — the Intimidate already happened
in the real game and applying it again would drop the foe's Attack a second time. A seeded init skips
it.

**Roll out.** `battleTurn` to `battleOver`, N times, count wins. `chooseAction` is the playout policy
on both sides.

**Report.** Wins / N. And, because a rollout estimate without an interval invites reading noise as
signal (the same argument `champions_sim.winProb` already makes), a Wilson interval on the same call.

### 4.2 What N has to be

A rollout is a Bernoulli sample, so the standard error at p≈0.5 is `0.5/sqrt(N)`. N=20 gives ±11
points, N=100 gives ±5, N=400 gives ±2.5. The leaf being replaced is 63.7% accurate, so an estimator
whose own noise is ±11 points is not obviously an improvement. **N is a measured parameter, not a
guess**, and §5 measures accuracy as a function of it.

**MEASURED 2026-08-03, and it contradicts the paragraph above.** `engine/rollout_r1.js` with
`N_LIST=10,40,160` scores every budget on the SAME 4,487 positions in one replay, so the comparison is
paired and cannot be confounded with which positions each budget happened to see:

```
  ROLLOUT n=10     64.03%   Brier 0.2739
  ROLLOUT n=40     64.68%   Brier 0.2657
  ROLLOUT n=160    64.48%   Brier 0.2645
```

**Accuracy is FLAT in N.** Sixteen times the compute moves it by less than half a point, and not
monotonically. Brier improves a little — that is the variance reduction arriving where it should, in
the calibration rather than in the verdict — but the gate does not move.

So the leaf is **bias-limited, not variance-limited**, and this settles two things at once:

- **"Run more rollouts" is dead as a lever.** Whatever is wrong is wrong in the engine or in
  `chooseAction`, and more samples of a biased estimator converge on the bias.
- **The leaf is cheap.** n=10 is as accurate as n=160, so the per-leaf cost budget in §4.3 is an order
  of magnitude smaller than assumed. If R1 ever passes, affordability is not the obstacle.

It also sharpens §3.2's warning into the live question: the playout policy is the suspect, and the
literature says making it *stronger* is not reliably the fix.

### 4.3 Cost, against the budget already established

`data/lookahead-cost.json` puts a Showdown fork at ~4.6 ms. A MEDICHAM turn is far cheaper — no
protocol, no serialization — but a rollout is up to 20 of them, and a leaf costs N rollouts. Cost per
leaf is therefore `N x 20 x (cost of a MEDICHAM turn)` and must be measured before any search quotes a
matrix size. This is the same discipline as G2, and G2's first cost figure was wrong because the
instrument was broken, so it is measured here on many boards rather than one.

---

## 5. Gates

**R1 — the rollout is a better JUDGE than PORYGON3.** No search, no matrix, no equilibrium. Take clean
human games with known winners, seed MEDICHAM at each turn, roll out, and ask whether the win rate
predicts the actual winner better than the k-NN does. Same positions, same labels, and the material
baseline recomputed on the same sample so the comparison is not against a published number from a
different set.

    if rollout accuracy <= 63.7%   ->  the leaf does not improve, and the whole idea dies for the
                                       price of an afternoon. This is the cheap null and it is the
                                       reason R1 exists before anything else.
    if rollout accuracy >  63.7%   ->  the leaf improves, and every search built on it inherits that.

**R2 — it is affordable.** Cost per leaf across many boards, at the N that R1 says is needed.

**R3 — the pick changes.** `engine/lookahead_divergence.js` already enumerates a side's legal joint
actions exhaustively. Swap PORYGON3 for the rollout leaf and measure how often the choice differs from
MAG's. A search that picks the same move cannot win more games than MAG, whatever the theory says.

**R4 — it wins.** SPRT against the shipped greedy player, read as it goes.

---

## 6. What would make this fail, written down first

- **Foul Play chose the other branch** (§3.3), with a strong ladder record behind the choice.
- **A stronger playout is not reliably better** (§3.2), so the obvious follow-up work may be negative.
- **3.3% of clicks are still no-ops** and the bias is one-directional: unmodelled utility moves look
  worthless. Parting Shot's debuff is missing while its switch is modelled — half a move, and the half
  that decides where it is played.
- **`chooseAction` is not a strong player.** A rollout inherits whatever its policy is, and if that
  policy never switches voluntarily, positions whose answer is a switch are still misjudged.
- **Variance.** At small N the leaf is noisier than the model it replaces (§4.2).
- **MEDICHAM is not Showdown.** ADR-001 pins Showdown as the real engine for a reason; every rollout is
  a simplification, and `data/damage-validation.json` bounds how good the damage half is.

---

## 7. What this does not claim

It does not claim the search will win, or that rollouts beat a good static evaluation — the best
documented bot in this game says otherwise. It claims one thing, and R1 measures it: **our leaf is
worth 3.4 points over counting bodies, and a rollout through an engine that now represents 96.7% of
real clicks may be worth more.**
