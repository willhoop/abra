# ABRA — the cast, on one card

**Version 1.0 · 2026-07-22 · Will Hooper**

> Every model is a Pokémon. The Pokémon's **speed** tells you the model's **cost**: fast Pokémon =
> cheap/fast model, slow Pokémon = expensive/deep model. Every name is an acronym.

## What each one does

| Model | Pokémon (speed) | Acronym | In one line | Cost | Status |
|---|---|---|---|---|---|
| **ABRA** | Abra | **A**utomated **B**attle **R**eplay **A**nalyzer | Collects live ladder games, stores them raw forever, models them. The platform everything sits on. | — | Built |
| **JOLTEON** | Jolteon (fastest) | **J**oint **O**dds, **L**adder-**T**rained **E**xpected-**O**utcome **N**etwork | Instant win probability between two teams, before any move. ~55% vs 49% coin flip. | ⚡ microseconds | Built |
| **MEDICHAM** | Medicham (medium) | **M**atchup **E**valuation, **D**amage-**I**nformed **C**HOMP-**H**euristic **A**pproximate **M**oves | Plays a matchup out a few turns with CHOMP's exact damage; averages many rollouts. | 🥋 milliseconds | Built |
| **SLOWKING** | Slowking (slow, wise) | **S**earch over **L**earned **O**pponent-belief **W**orld, **K**nowledge-**I**ntensive **N**ash **G**ame-solver | Deep, equilibrium-aware search over what the opponent might be hiding. | 📚 seconds | Scaffold (research) |
| **DITTO** | Ditto | **D**ouble-oracle **I**terative **T**eam-**T**uning **O**ptimiser | Builds teams that beat the live meta; guarantees an answer to common threats, ignores rare ones. | uses JOLTEON | Built |
| **KADABRA** | Kadabra | **K**ey **A**nalysis of **D**ecisions, **A**dvice & **B**etter **R**eplay **A**nnotation | Turn-by-turn coach: rebuilds each scene, flags high/low rolls, names the better play. | uses CHOMP+ABRA | v1 built |
| **CHOMP** | Garchomp | (the bring-4 / lead-2 engine) | The Showdown userscript you actually play with: picks your 4 and your lead by exact damage. | — | Built (separate) |

## The supporting data models

| Piece | What it produces |
|---|---|
| **durable-ingest** | The store: every game's teams, brings, leads, revealed sets, result, ratings, bot flag, **and a per-turn stream** (move order → speed, damage % per move). Raw logs archived → any new field is a re-parse, never a re-pull. |
| **dynamics** | Observed **speed** (who-moves-first, Choice-Scarf hints) for 186 species, and observed **damage** distributions for 1,170 (attacker, move) pairs. |
| **analyze** (meta-usage) | Team % / bring % / lead % / win % per species at any rating cutoff. What CHOMP reads. |

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
