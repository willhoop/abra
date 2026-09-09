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
latent roles beat raw identity for outcome prediction in team sports (arXiv 2304.08272 — cited as
motivation; no method from it is used here).

## 2. The role model

We define **52 functional roles** (`data/pokemon-roles.json:roles`, 52 keys; 47 credited to at least one
species above `rate_floor` 0.05, 40 at `present_at` 0.5; the "26" typed here until 2026-09-09 was stale) — grouped as speed control (Tailwind, Trick Room, speed drops), weather, terrain,
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
basketball's **Regularized Adjusted Plus-Minus (RAPM)** (Rosenbaum 2004, Sill 2010). One row per game, label 1 if player-1 won,
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
we refused to type by hand (Label Distribution Learning, Geng 2016, is cited as motivation — nothing here
implements LDL).

Two cuts:

- **Team × move usage** (weighted by real in-battle usage, which down-weights the closed-sheet censoring
  bias) recovers **offensive cores** but is dominated by attacking moves — reconstruction error **0.8348**
  (`data/nmf-roles.json:reconstruction_error_ratio`, 64,179 team-docs × 375 moves).
- **Team × role** at **rank 4** — the rank is read from `data/nmf-rank-selection.json:most_reproducible.rank` by
  `engine/nmf_roles.py` since 2026-09-09 (it was hand-set to 6 before, and the script now fails if the artifact
  is absent). Reconstruction error **0.738** (`data/nmf-roles.json:archetype_recon_error`, regenerated
  2026-09-09 over 63,882 team-sides × 52 roles; `store.sha256` cde0fa05d517…,
  `archetype_rank_source.sha256` f1354dd83974…). The ~~0.682~~ at rank 6 is superseded and not
  comparable. On the project's own criterion, `data/nmf-rank-selection.json` (2026-07-28, `bootstrap_pairs` 6, `iters` 300, `matrix` 7,330 × 46) scores rank 4 at `stability` 0.9992 against a shuffled `null_stability` of 0.9217 (`excess_over_null` **+0.0775**, the maximum over ranks 2–12); the previously shipped rank 6 scored **-0.107** (0.8148 vs 0.9218). The four below are composed by the data and
  **named** by a human:

| # | Archetype (human name) | Composition (`top_roles`, share of the factor) | Share (`prevalence`) |
|---|---|---|---|
| A1 | Physical + priority offense | Physical attacker 39% · Priority attacker 22% · Setup / sweeper 6% · Tailwind (speed up) 6% | 27.1% |
| A2 | Bulky support + rain | Bulky wall / support 23% · Special attacker 15% · Rain setter 10% · Redirection 6% | 25.7% |
| A3 | Spread offense | Spread attacker (both foes) 54% · Special attacker 8% · Tailwind (speed up) 6% · Sand setter 4% | 25.2% |
| A4 | Intimidate + Fake Out control | Debuff (Intimidate / drops) 42% · Fake Out (tempo) 26% · Pivot 8% · Setup / sweeper 3% | 22.1% |

The Intimidate + Fake Out control core (A4) and the bulky-support core (A2, with rain and redirection loading on
it) are the non-obvious structure the move-level cut could not surface. The only human choice left is the
**names**; the rank is read from the selection artifact and everything else is from 63,882 team-sides across
the store. The selection artifact is the weak link: 2026-07-28, 6 bootstrap pairs (the defence asks ≥ 50),
no cophenetic correlation — `python engine/nmf_rank.py 50` is owed.

## 5. Honest limits

- Preview composition does not separate from a coin. Role-level winner prediction ties it; WAR loses to
  it (`data/war.json` verdict; ~~"WAR only edges it"~~ withdrawn 2026-09-09). The game is decided in play, not at preview — consistent with ABRA's central finding.
- Role tags are a **censored lower bound** on capability: closed sheets reveal only the moves that were
  actually clicked.
- NMF factors are soft, and at the move level attacker roles dominate. Reconstruction error is **not**
  comparable across different weightings and cannot select a rank (`engine/nmf_rank.py`); the criterion this
  project actually ran — bootstrap factor stability — now SETS the shipped rank (4, §4), but from a
  6-pair selection on a 2026-07-28 store, so the rank is read rather than defended until
  `python engine/nmf_rank.py 50` is run.
  ~~Topic coherence (Mimno et al., 2011) is the noted next refinement~~ — deleted 2026-09-09: not run, and
  *next* is not a justification.

## Sources

Tsoumakas & Katakis 2007 (multi-label) · Blei, Ng & Jordan 2003 (LDA) · Lee & Seung 1999 (NMF) ·
Geng 2016 (Label Distribution Learning — motivation) · Mimno et al. 2011 (topic coherence — not run) ·
Rosenbaum 2004, *Measuring How NBA Players Help Their Teams Win*, 82games.com, and Sill 2010, *Improved NBA
Adjusted +/- Using Regularization and Out-of-Sample Testing*, MIT SSAC (RAPM) · Pearl 1988, *Probabilistic
Reasoning in Intelligent Systems*, Morgan Kaufmann (noisy-OR, `engine/roles.py` `team_roles`) · latent roles
in team sports (arXiv 2304.08272 — motivation).
