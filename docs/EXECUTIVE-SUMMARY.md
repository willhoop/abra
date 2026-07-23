# ABRA — Executive Summary

**Version 1.1 · Last updated 2026-07-22 · Will Hooper**

## In one line
ABRA is the live-data platform for competitive Pokémon Champions: it continuously collects real
ladder games and turns them into a durable dataset that feeds models of games and teams. The CHOMP
bring-4 engine is one small, early consumer — proof the pipe delivers, not the purpose.

## The problem
Choosing four of your six at team preview depends on what the opponent will bring. Public usage
sites are stale and averaged; damage calculators see one matchup at a time. Nothing turns the *live*
ladder into a model a decision engine can read and that improves as people play.

## What ABRA does
- **Ingests the ladder automatically.** Public replays, pulled in parallel at ~200 games/second;
  the ~5,000 recent public games ingest in under a minute. A scheduled cloud job keeps it current
  hourly, with no operator.
- **Stores raw, analyses on top.** Every game is saved with every fact — both teams, brings, leads,
  observed sets, result, both ratings, and a bot flag. Any question (high-ladder only, humans only,
  just my games) is a filter on that store, **never** a re-download. This is the property that means
  the model can change forever without re-pulling.
- **Produces a usage model** — team%, bring%, lead%, win% per species, at any rating cutoff — and
  writes it where CHOMP reads it.

## How it makes CHOMP smarter
CHOMP and ABRA are separate but connected. ABRA feeds CHOMP the ladder usage model as **advisory
intel** — what the opponent will probably bring and lead. The pick itself covers the opponent's
*whole six*: you cannot know which four they will bring, so CHOMP chooses the four that answer all
six, and ABRA's prediction informs the read rather than gambling the bet. Because CHOMP auto-updates
from its repository, a better ABRA model reaches the live plugin with no plugin change — the
"gets smarter over time" loop, closed and tested.

## Evidence
- Validated on **~5,000 real ladder games**. A high-ladder cut (humans, 1300+) surfaces the true
  meta — which threats are most used and how often each is brought and led — all as a filter over the
  same stored games, never a re-pull.
- The top of the model independently reproduces a hand-curated threat list built from a **separate
  ~141,000-battle dataset** — external corroboration that the pipeline is correct.
- The ABRA→CHOMP flow-back is pinned by an automated test on a real battle: CHOMP loads the model
  and focuses the pick on the opponent's likely four against the user's six.

## Honest limits
Revealed sets are partial (a Pokémon that never attacks reveals no moves). The model is descriptive,
not a win-probability oracle. Bot and low-ladder games differ from strong play — which is exactly why
they are tagged, so the consumer chooses the population.

## The model family (the named cast)
The simulator is decomposed into tiers, each a Pokémon whose *speed* signals the model's cost:

- **JOLTEON** — *Joint Odds, Ladder-Trained Expected-Outcome Network* (Tier 1, fastest): instant
  team-vs-team win probability. ~55% held-out vs ~49% coin flip; rarity-aware so rare picks aren't
  overrated. *Built.*
- **MEDICHAM** — *Matchup Evaluation, Damage-Informed CHOMP-Heuristic Approximate Moves* (Tier 2):
  short rollouts over CHOMP's exact damage. Rain beats sun 0.60, mirror 0.51. *Built.*
- **SLOWKING** — *Search over Learned Opponent-belief World, Knowledge-Intensive Nash Game-solver*
  (Tier 3, slowest/wisest): deep belief-search. *Scaffolded; honest research roadmap.*
- **DITTO** — *Double-oracle Iterative Team-Tuning Optimiser*: builds teams vs the live meta,
  usage-weighted so you get an answer to Basculegion, not Camerupt. *Built.*
- **KADABRA** — *Key Analysis of Decisions, Advice & Better Replay Annotation*: turn-by-turn coach
  that reconstructs each scene and flags high/low rolls. *v1 built.*
- **CHOMP** — the bring-4 / lead-2 engine you play with. *Built, separate-but-connected.*

## Data now captured per game
Beyond teams/brings/leads, the extractor now records a **per-turn stream** — move order (→ real
speed, Choice-Scarf detection) and exact damage % per move. 30,611 turns, 55,336 damaging hits. Raw
logs are archived, so any *new* field is a re-parse, never a re-pull (proven: format tags backfilled
onto 4,999 games with zero downloads).

## The flywheel (the reason ABRA exists)
1. **Collect** live ladder games — *built and running*.
2. **Simulate** — game models from the data (JOLTEON, MEDICHAM) — *v1 built*.
3. **Optimise teams** against real meta threats (DITTO), iterating on itself — *v1 built*.
4. **Play** the best teams; CHOMP handles bring-4 / lead-2 — *built*.
5. **Feed back** — every enemy team you face (incl. every game KADABRA reviews) is auto-added.

The loop closes: more games → better simulator → better teams → more wins → more games. The most
important early result is an *honest* one: DITTO can Goodhart JOLTEON (a "90%" team is really ~12%),
which MEDICHAM catches — the tiered design earning its keep.

## Status
v1.1 — the data platform is built and validated; Tiers 1–2 and the DITTO optimiser are built and
measured; Tier 3 (SLOWKING) is scaffolded research. An interactive site (ABRA WORLD) runs JOLTEON
live in the browser. CHOMP proves the pipe delivers.

**Read next:** [deck](ABRA-deck-plain-english.md) · [white paper](ABRA-whitepaper.md) ·
[simulator/ML white paper](ABRA-simulator-whitepaper.md) · [KADABRA spec](KADABRA-coach-spec.md)
