# ABRA
### Automated Battle Replay Analyzer

**Platform: Pokémon Showdown.** ABRA reads thousands of public **[Gen 9] Champions VGC (Reg M-B)**
replays from the Showdown replay API, models the ladder's real metagame, and feeds that model to
**[CHOMP](../CHOMP)** so the bring-4 / lead-2 engine reasons from what the ladder actually brings
instead of static guesses.

> **CHOMP and ABRA are separate but connected.** CHOMP is *only* the bring-6 → pick-4 → lead-2
> engine. ABRA is the meta-analysis brain that makes it smarter. Two projects, one loop.

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
