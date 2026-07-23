# CLAUDE.md — ABRA

Project-specific context. Universal rules are inherited from the Pokémon umbrella and the global
instructions; only what is specific to ABRA is here.

## What ABRA is
The Automated Battle Replay Analyzer. It ingests public Champions Reg M-B replays from Pokémon
Showdown, models the ladder meta, and feeds `data/meta-usage.json` to CHOMP. **Separate but
connected to CHOMP** — CHOMP is only the pick-4/lead-2 engine; ABRA is the meta brain.

## The one principle that governs the data
**Store raw, analyze on top.** Every game is stored durably with every fact we might ever want,
plus rating and bot tags. All filtering/analysis runs on the store. Changing how we segment games
is a re-filter, never a re-pull. Never design an analysis that forces re-fetching replays.

## Where things are
- `engine/durable-ingest.js` — the pull+store (source of truth for the schema; `extract()` exported).
- `engine/analyze.js` — views + writes the model CHOMP reads.
- `data/games.ladder.jsonl` — the append-only store. `data/meta-usage.json` — the CHOMP-facing model.
- `tests/test-parse.js` — pins the extractor.

## The CHOMP loop
ABRA produces `meta-usage.json`; CHOMP reads it to infer real leads/sets. When ABRA improves, CHOMP
gets smarter without a plugin change.
