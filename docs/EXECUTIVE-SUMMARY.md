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
- Validated on **1,501 real ladder games** (2,292 human teams). The high-ladder cut (humans, 1300+)
  reveals distinct signal — top threats near 50% usage, win rates that separate (Kingambit 62%,
  Incineroar 65%).
- The top of the model independently reproduces a hand-curated threat list built from a **separate
  ~141,000-battle dataset** — external corroboration that the pipeline is correct.
- The ABRA→CHOMP flow-back is pinned by an automated test on a real battle: CHOMP loads the model
  and focuses the pick on the opponent's likely four against the user's six.

## Honest limits
Revealed sets are partial (a Pokémon that never attacks reveals no moves). The model is descriptive,
not a win-probability oracle. Bot and low-ladder games differ from strong play — which is exactly why
they are tagged, so the consumer chooses the population.

## The flywheel (the reason ABRA exists)
1. **Collect** live ladder games — *built and running*.
2. **Simulate** — a near-perfect game model from the data — *next*.
3. **Optimise teams** against real meta threats, iterating on itself — *next*.
4. **Play** the best teams; CHOMP handles bring-4 / lead-2 — *built*.
5. **Feed back** — every enemy team you face is auto-added, so playing grows the data.

The loop closes: more games → better simulator → better teams → more wins → more games. ABRA is
stage 1, done. Stages 2–3 are the point of the project and the next work.

## Status
v1.0 — the data platform is built, validated on 1,501 real games, and wired to grow itself hourly.
The simulator and self-iterating team optimiser are the roadmap; CHOMP proves the pipe delivers.

**Read next:** [white paper](ABRA-whitepaper.md) · [deck](ABRA-deck-plain-english.md) ·
[technical docs](ABRA-technical-docs.md)
