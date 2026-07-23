# ABRA — Technical Documentation

**Version 1.0 · Last updated 2026-07-22**

*Written in ASD-STE100 Simplified Technical English. Sentences are short. The voice is active.
Organised by the Diátaxis model.*

---

# PART 1 — TUTORIAL

## 1.1 Pull the ladder and build the model
1. Open a terminal in the ABRA folder.
2. Run `node engine/durable-ingest.js data/games.ladder.jsonl`. This pulls new public replays and
   appends them to the store. It never re-fetches a stored game.
3. Run `node engine/analyze.js data/games.ladder.jsonl`. This prints the meta and writes
   `data/meta-usage.json`.

The model is now current. CHOMP reads `data/meta-usage.json` at its next build.

---

# PART 2 — HOW-TO

## 2.1 Pull more games
Set `PAGES`. Each page is ~51 replays. `PAGES=100` pulls the full ~5,000 recent public games.
```
PAGES=100 CONC=20 node engine/durable-ingest.js data/games.ladder.jsonl
```

## 2.2 Change who counts as "you"
Set `ME` to a comma-separated list of your Showdown names.
```
ME="willhoop,mynewname" node engine/analyze.js data/games.ladder.jsonl
```

## 2.3 Look at a different population
`analyze.js` filters at read time. Edit the `usage(...)` calls to change `minRating` or `humansOnly`.
No re-pull is needed — the store already holds every game raw.

## 2.4 Collect games continuously
The scheduled workflow `.github/workflows/ingest.yml` runs hourly, pulls new games, rebuilds the
model, and commits it. Enable Actions once on the repository; then it runs itself.

---

# PART 3 — REFERENCE

## 3.1 Folder structure
| Path | Contents |
|---|---|
| `engine/durable-ingest.js` | Pull + store. Exports `extract(id, uploadtime, text)`. Source of the record schema. |
| `engine/analyze.js` | Views over the store; writes `data/meta-usage.json`. |
| `engine/meta-ingest.js` | A quick one-shot meta build (no durable store). |
| `data/games.ladder.jsonl` | The durable, append-only store — one JSON record per game. |
| `data/meta-usage.json` | The model CHOMP reads. |
| `tests/test-parse.js` | Hand-derived checks on the extractor. |

## 3.2 The record schema
See white paper §3. One JSON object per line: `id`, `date`, `p1`/`p2` `{name, rating, bot}`,
`six`, `brought`, `lead`, `sets`, `winner`.

## 3.3 The usage fields
`teamRate`, `bringRate`, `leadRate`, `winRate` per species. See white paper §6 for the formulas.

## 3.4 Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `PAGES` | 10 (ingest) | replay list pages to request |
| `CONC` | 16 | parallel log fetches |
| `ME` | willhoop | names that count as "you" |

---

# PART 4 — EXPLANATION

## 4.1 Why store raw and analyse on top
Deciding the population at fetch time forces a re-fetch when the question changes. Storing every fact
once makes every later question a filter. This is the property that stops us re-pulling. See white
paper §5.

## 4.2 Why ABRA is separate from CHOMP
CHOMP is the bring-4 / lead-2 engine. ABRA is the meta brain. Keeping them separate lets each ship,
test, and version on its own. They connect through one file, `meta-usage.json`.

## 4.3 Why ABRA is a prior, not the answer
The opponent brings the four that beat *your* six, not their ladder-average four. That is a matchup
question, and CHOMP's damage engine answers it. ABRA supplies the prior for when the matchup cannot
decide. See white paper §7.

---

**Companion documents.** [White paper](ABRA-whitepaper.md) ·
[Deck](ABRA-deck-plain-english.md) · [Executive summary](EXECUTIVE-SUMMARY.md) ·
[Changelog](../CHANGELOG.md)
