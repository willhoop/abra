# ABRA
### Automated Battle Replay Analyzer

**Platform: Pokémon Showdown.** ABRA is the **live-data platform** for competitive Pokémon Champions
(Reg M-B). It continuously collects real battle replays from the Showdown API and turns them into a
durable, growing dataset — the foundation for **modelling games and teams**: a simulator that learns
from how the ladder actually plays.

> **ABRA is the platform; CHOMP is one small consumer of it.** ABRA's job is to gather live battle
> data and feed the models built on top — team modelling, matchup/game simulation, meta analysis.
> The **[CHOMP](../CHOMP)** bring-4 engine is the first, smallest thing that reads ABRA's output; it
> is a minor downstream use, not the point.

## The mission
Collect the ladder's real games as they are played, keep every fact, and feed a simulator that models
**what wins** — both at the team-building level (which six beats the meta) and the game level (how a
given matchup tends to play out). The data platform is built and running; the models on top are the
roadmap. CHOMP is proof the pipe delivers.

## What it does
- **Pulls replays automatically** — the whole ladder (any players), paginated, ~200 logs/sec. The
  full ~5,000 recent public replays ingest in about half a minute.
- **One durable store, many views.** Every game is stored raw and tagged (both teams, brings, leads,
  observed moves/items/abilities, result, both ratings, bot flag). Any cut — high-ladder only,
  humans only, just your games — is a *filter*, never a re-pull.
- **Usage model** — team%, bring%, lead% and win% per species, at any rating cutoff.
- **Personal split** — filter to your Showdown name(s) for your own record and worst matchups.
- **Feeds CHOMP** — writes `data/meta-usage.json`, the shared model CHOMP reads.

## How to use it
```
node engine/durable-ingest.js data/games.ladder.jsonl   # pull + append (only new games)
node engine/analyze.js       data/games.ladder.jsonl    # build views + write data/meta-usage.json
```
`PAGES=30` pulls ~1,500 games; raise it toward 100 (~5,000) for the full recent ladder.
`ME="willhoop,youralias"` sets which names count as *yours*.

## No accounts. Multi-user by design.
The ladder meta is universal — everyone shares it. "Your games" is just a username filter, so anyone
points ABRA at their own Showdown name and gets their own analysis. Renaming on Showdown? Add the new
name to `ME`; old history still counts.

## Repo layout
```
engine/   durable-ingest.js (pull+store), meta-ingest.js (quick meta), analyze.js (views)
data/     games.ladder.jsonl (the durable store), meta-usage.json (the model CHOMP reads)
tests/    test-parse.js — hand-derived checks on the replay extractor
docs/     white paper, plain-English deck, technical documentation
```

## Honest limitations
Observed sets are what a replay *revealed* (a Pokémon that never attacked reveals no moves), so set
inference is partial. Usage is descriptive, not predictive. Low-ladder and bot games differ from
high-ladder — hence the rating/bot tags, so you choose the population you trust.
