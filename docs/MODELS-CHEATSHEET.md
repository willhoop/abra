# ABRA — the cast, on one card

**Version 1.0 · 2026-07-22 · Will Hooper**

> Every model is a Pokémon, and every name is an acronym. For the **three battle-playing tiers only**
> — JOLTEON → MEDICHAM → SLOWKING — the Pokémon's **speed** signals the model's **cost** (fast =
> cheap/shallow, slow = expensive/deep). The other models (ABRA, DITTO, KADABRA, CHOMP) do different
> jobs and don't sit on that speed scale.

## What each one does

| Model | Pokémon | What it does | Cost tier | Status |
|---|---|---|---|---|
| **ABRA** | Abra | collects, stores, and models the live ladder | — (the platform) | Built |
| **JOLTEON** | Jolteon | instant team-vs-team win probability | ⚡ fastest / cheapest | Built |
| **MEDICHAM** | Medicham | short exact-damage rollouts; vets teams | mid | Built |
| **SLOWKING** | Slowking | deep belief-search (equilibrium play) | slowest / deepest | Research |
| **DITTO** | Ditto | builds teams vs the live meta | — (uses JOLTEON) | Built |
| **KADABRA** | Kadabra | turn-by-turn coach on your replays | — (uses CHOMP+ABRA) | Built |
| **CHOMP** | Garchomp | the bring-4 / lead-2 engine you play with | — (exact damage) | Built |

Only JOLTEON → MEDICHAM → SLOWKING form the fast-to-slow "cost tier" scale; the rest do their own jobs.

**The acronyms.** ABRA — Automated Battle Replay Analyzer. JOLTEON — Joint Odds, Ladder-Trained
Expected-Outcome Network. MEDICHAM — Matchup Evaluation, Damage-Informed CHOMP-Heuristic Approximate
Moves. SLOWKING — Search over Learned Opponent-belief World, Knowledge-Intensive Nash Game-solver.
DITTO — Double-oracle Iterative Team-Tuning Optimiser. KADABRA — Key Analysis of Decisions, Advice &
Better Replay Annotation.

**The cost tiers.** JOLTEON: microseconds (one forward pass). MEDICHAM: milliseconds (a few
rollouts). SLOWKING: seconds (belief search). DITTO uses JOLTEON as its evaluator; KADABRA uses CHOMP
+ ABRA.

## The supporting data models

| Piece | What it produces |
|---|---|
| **durable-ingest** | every game's teams, brings, leads, revealed sets, result, ratings, bot flag, plus a per-turn stream (move order → speed, damage % per move) |
| **dynamics** | observed speed (who-moves-first, Scarf hints) and observed damage distributions per move |
| **analyze** (meta-usage) | team% / bring% / lead% / win% per species at any rating cutoff — what CHOMP reads |

## The one honest lesson

DITTO can **Goodhart** JOLTEON — build a team JOLTEON scores at 90% that is really ~12%. MEDICHAM's
grounded rollouts catch it. That's why there's a fast guesser *and* a slower checker: **Tier-1
proposes, Tier-2 vets.** Their disagreement flags both hype (JOLTEON-high, MEDICHAM-low) and hidden
gems (JOLTEON-low, MEDICHAM-high).

## Who feeds whom (quick read)

- **ABRA → everything.** The store + dynamics + usage feed all models.
- **JOLTEON → DITTO.** Fast evaluator for the team search.
- **MEDICHAM → DITTO, KADABRA.** Grounded rollouts vet teams and answer "what if".
- **SLOWKING → KADABRA.** Deep lines (roadmap).
- **ABRA → CHOMP.** Usage as advisory intel; CHOMP auto-updates, so a smarter ABRA reaches your plugin with no reinstall.
- **KADABRA → ABRA.** Every reviewed game is appended back to the store (the flywheel from the coaching seat).

See the interaction chart: `architecture-diagram.svg`.
