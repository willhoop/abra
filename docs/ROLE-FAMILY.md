# The Role Family — Roles, WAR, and Emergent Archetypes

**ABRA · Version 2.6.0 · 2026-07-24 · Will Hooper**

A single read-through of the newest work: why the old single-label archetypes were wrong, how the
role model fixes the data, what WAR measures, and what the emergent (NMF) archetypes actually found —
with every result stated against an honest baseline.

---

## 1. The problem this fixes

The earlier model gave each team exactly **one** archetype label (Sun *or* Tailwind *or* Trick Room).
That is a *multi-class* framing of a *multi-label* object: a real Champions team is Sun **and** Tailwind
**and** Fake Out at once. Forcing one label throws away most of what a team is, and it shatters the data
into archetype-by-archetype cells of only **11–18 games each** — which is exactly why those matchup
numbers were untrustworthy and the "rock-paper-scissors" cycle had error bars crossing 50%.

The literature is explicit about the right framing: multi-label classification (Tsoumakas & Katakis,
2007), team-as-a-mixture-of-latent-roles (topic models; Blei, Ng & Jordan, 2003), and the finding that
latent roles beat raw identity for outcome prediction in team sports (arXiv 2304.08272).

## 2. The role model

We define **26 functional roles** — speed control (Tailwind, Trick Room, speed drops), weather, terrain,
disruption (Fake Out, redirection, Taunt, Encore), status, debuff (Intimidate and stat drops), priority,
prankster, setup, healing, screens, walls, pivot, trapping, Perish, ally-support, item-disruption, and
physical / special attacker.

Two design rules keep it honest:

- **Roles are earned from data.** A species is credited with a role only once it has actually been
  observed performing it (at least twice) across the store. This is "all the roles a Pokémon could play,"
  learned rather than guessed.
- **Presence is binary; strength is learned, never typed.** A multi-effect move carries several *factual*
  roles (Matcha Gotcha = attack + heal + status; Body Press = wall + attack; Knock Off = attack + item
  strip; Fake Out = tempo, **not** an attacker). An earlier draft assigned fractional weights (0.6, 0.4…)
  by hand — those were removed, because a made-up number is asserted, not measured. The graded strength
  now comes out of the NMF (Section 4).

A team's role vector is built from the **team-preview six**, which are public in every closed-sheet game,
so the representation does not leak and is not censored by who won.

**Result — the pooling fix.** Every game now contributes to many role-pair cells, so the median matchup
cell rises from **n ≈ 15 to **n = 20** across 1,051 cells (measured 2026-07-25 on 1,061 quality-filtered games)** — the 7,971 figure published in v2.6.0 was retracted in 2.7.0 as an over-tagging artifact and has since gone 7,971 → 95 → ~50 → 20, each with a Wilson confidence interval. That is the
structural repair of the grid. But predicting the winner from preview roles still **ties a coin**
(held-out log-loss 0.694 vs 0.693) — so the role model *describes and attributes*; it does not predict.
The per-role logistic coefficients are read as **win-credit per role**, and KO-credit per species is
measured directly from the turn log.

## 3. WAR — Wins Above Replacement

To attribute wins to individual Pokémon while controlling for teammates and opponents, we borrow
basketball's **Regularized Adjusted Plus-Minus (RAPM)**. One row per game, label 1 if player-1 won,
features = the difference of the two teams' species-presence vectors at preview. A ridge-regularized
logistic regression gives each species an adjusted win contribution β; ridge shrinks rare species toward
zero so a three-game fluke cannot post a huge number. With replacement set at the 20th-percentile β and
the logistic slope of ¼ at a coin flip:

> **WAR = 0.25 × (β − β_replacement) × games appeared.**

**Result — WITHDRAWN.** The species model appeared to beat a coin at held-out log-loss 0.6875 vs 0.6931, a figure **withdrawn 2026-07-25** — that figure was measured on the UNFILTERED store. The clean-store figure this paragraph then carried (~~0.7048 against a coin's 0.6931, accuracy 0.502, "and beats the rating baseline (0.6905)"~~) is withdrawn 2026-09-09: `data/war.json` (2026-07-28; n_games 3,663; λ = 200 selected on held-out log-loss) reads **0.6936 against a coin's 0.6931, accuracy 0.504**, verdict *"WORSE THAN A COIN AT EVERY REGULARISATION STRENGTH TESTED"*, and it contains no rating baseline at all. The apparent signal was four bot accounts playing one team in 1,446 games.
**WAR does not beat a coin; which specific species you bring at preview carries no demonstrated signal.**
Leaders: Basculegion, Kingambit, Sylveon; trailers negative
(Maushold, Raichu) — a descriptive ordering of preview co-occurrence, ridge-shrunk, not evidence that a species wins games: an exploratory
ordering, not settled wins.

## 4. Emergent archetypes (NMF)

Rather than hand-declaring roles, we let them fall out of the data with **Non-negative Matrix
Factorization** (Lee & Seung, *Nature* 1999): approximate the big table as X ≈ W·H with everything
non-negative, so each team is a **blend** of latent roles and each role is a recipe over features. Because
nothing is negative, a team reads as "60% Intimidate control + 30% Tailwind offense," never as one minus
another. A move's loading on a role is **learned**, which is the principled source of the graded strength
we refused to type by hand (Label Distribution Learning; Geng, 2016).

Two cuts:

- **Team × move usage** (weighted by real in-battle usage, which down-weights the closed-sheet censoring
  bias) recovers **offensive cores** but is dominated by attacking moves — reconstruction error 0.79.
- **Team × role** at the shipped rank 6 — reconstruction error **0.682** (`data/nmf-roles.json:archetype_recon_error`, 2026-08-04; ~~0.53~~ withdrawn 2026-09-09, an earlier run's value). On the project's own criterion the shipped rank scores **−0.107** excess over a shuffled null (`data/nmf-rank-selection.json`; rank 4 is the most reproducible at +0.0775), so the six below are named, not defended:

| # | Archetype | Composition (top roles) | Share |
|---|---|---|---|
| A1 | Intimidate control | Debuff/Intimidate 56% · Fake Out 19% · Pivot 5% | 20% |
| A2 | Physical offense | Physical attacker 83% · Pivot 5% · Item disruption 5% | 19% |
| A3 | Special offense + sustain | Special attacker 81% · Status 7% · Healing 5% | 18% |
| A4 | Bulky wall + support | Wall 49% · Screens 9% · Redirection 8% · Healing 5% | 17% |
| A5 | Tailwind offense | Tailwind 85% · Encore 9% | 15% |
| A6 | Priority offense | Priority 89% · Setup 4% · Fake Out 3% | 11% |

The support/redirection core (A4) — the interesting, non-obvious structure — separates out cleanly here,
which the move-level cut could not surface. The only human choices are the **rank** (six) and the
**names**; everything else is from ~13,000 team-sides across the store.

## 5. Honest limits

- Preview composition does not separate from a coin. Role-level winner prediction ties it; WAR loses to
  it (`data/war.json` verdict; ~~"WAR only edges it"~~ withdrawn 2026-09-09). The game is decided in play, not at preview — consistent with ABRA's central finding.
- Role tags are a **censored lower bound** on capability: closed sheets reveal only the moves that were
  actually clicked.
- NMF factors are soft, and at the move level attacker roles dominate. Reconstruction error is **not**
  comparable across different weightings and cannot select a rank (`engine/nmf_rank.py`); the criterion this
  project actually ran — bootstrap factor stability — puts the shipped rank 6 below the null (§4).
  ~~Topic coherence (Mimno et al., 2011) is the noted next refinement~~ — deleted 2026-09-09: not run, and
  *next* is not a justification.

## Sources

Tsoumakas & Katakis 2007 (multi-label) · Blei, Ng & Jordan 2003 (LDA) · Lee & Seung 1999 (NMF) ·
Geng 2016 (Label Distribution Learning) · Mimno et al. 2011 (topic coherence) · Rosenbaum-style RAPM
(basketball adjusted plus-minus) · latent roles in team sports (arXiv 2304.08272).
