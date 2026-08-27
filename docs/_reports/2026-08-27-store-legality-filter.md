# 2026-08-27 — There is no legality filter anywhere, and the instrument that measures it is ignored

**Filed by the coordinator.** OPS is a read-only division and wrote nothing; these are its findings, with
the load-bearing claims re-verified independently before filing.

## VERDICT IN ONE PARAGRAPH

Will: *"some of the games in the store sneak in forbidden pokemon cause they played a game using custom
rules and its still tagged reg mb."* He is right, and the situation is worse than that sentence implies:
**there is no legality filter at ingest, none at analysis, and the one instrument that measures legality
writes a verdict file that no consumer reads.** Contamination is already sitting in `data/meta-usage.json`
— the model CHOMP consumes — and inside a frozen engine source.

## VERIFIED INDEPENDENTLY

- **`data/quality-filter.json` carries exactly five rules:** `exclude_bot_games`,
  `exclude_behavioural_bots`, `exclude_forfeits`, `min_turns`, `require_full_bring`. **No legality rule.**
- **`data/store-validation.json` is stamped 2026-08-07** — twenty days stale, covering roughly 66% of
  today's store.
- **The only files mentioning it are its own writer and a web data blob.** No consumer acts on it.
- **`engine/format_drift.js`, cited by `validate_store.js` as the thing that separates a contaminated
  game from a stale rulebook, DOES NOT EXIST.**

## WHY IT HAPPENS BY CONSTRUCTION

`engine/durable-ingest.js` derives the format from the replay's own tier line, so **a custom-rules game
is tagged as this regulation by construction.** Raw-at-ingest is correct by design and should stay — the
project's governing principle is *store raw, analyze on top*. The defect is that nothing downstream
filters.

**And the repo's own auditor encodes the blind spot.** `build/sync_orientation.js` defines "does this
file filter?" as a regex over `load_games|loadGames|isClean|cleanIds`. So **every `RAW-STORE-OK`
declaration in this repository is a statement about BOTS, never about legality.** "Clean" here has only
ever meant "no bot detected".

## THE MEASUREMENT, AND ITS TWO CAVEATS

**735 of 47,210 games = 1.557%** carry at least one set the official validator refuses. Of those, the
clean signal is **22 distinct out-of-format species across 77 occurrences** — and they clump into whole
teams from another regulation, exactly as described.

- **The rate is twenty days old.** The store is now larger by roughly a third.
- **735 is an upper bound.** Many "cannot learn X" rows are the **Illusion signature** that
  `engine/illusion.js` detects by this very legality contradiction. **The species rows are the safe
  subset to key on; the move rows are mixed.**

## WHAT INHERITS IT — AND WHY AN EDIT IS FUTILE

**The six-hourly ingest workflow regenerates and commits `meta-usage.json`, `bring-priors.json`,
`move-priors.observed.json`, `chomp-ev.json` and `live.js`. Anything on that list cannot be fixed by an
edit — it is overwritten within six hours.**

| artifact | contamination | fix |
|---|---|---|
| `data/move-priors.json` | five out-of-format species **inside a frozen engine source** | FILTER at the generator; promoting it mints a new engine release |
| `data/meta-usage.json` | **11 of 796 threat rows** — this is what CHOMP reads | FILTER |
| `data/bring-priors.json` | 21 of 339 species keys | FILTER |
| `data/regulation-usage.json` | the coverage GATE's own denominator | FILTER |
| `data/sheet-usage.json` | 14 of the 22 species | FILTER |
| `data/engine-data.js` | two rows | FILTER at its builder — a prior wholesale regeneration already undid a hand fix to this exact file |

**Measured clean:** `data/team-pool-frozen`, `data/archetypes.json`, `data/pokemon-roles.json`. **The
pinned pool being clean supports the rank-by-the-pinned-pool call.**

## ONE SUSPICION HALF-REFUTED

`engine/playstyle.js` does **not** inherit store contamination — it drops unmatched entries and publishes
them. Its six illegal names are **dead-list rot, flowing outward not inward.** Its real defect is one
line: its liveness audit checks existence and never legality, so an out-of-format species with usage
passes. One name there is ambiguous and needs a Dex call — routed to ENGINE.

## THE FIX, IN ONE PLACE

An `exclude_illegal_teams` rule in `data/quality-filter.json` plus a clause in `engine/quality.js` that
reads the flagged ids. **That is precisely the wiring `validate_store.js` already assumes exists.** One
filter, and most of the table above clears itself on the next scheduled run.

**Decide before it lands:** filtering on the whole verdict file would drop real Zoroark games that
`engine/illusion.js` exists to detect. **Key on the species-level reasons only.**

## OWED, NOT RUN

```bash
# the 1.557% is twenty days and ~24,000 games stale — refresh before acting on it
node engine/validate_store.js --selftest
node engine/validate_store.js --write

# and strike the stale backlog line: docs/OPS.md still asks an open question that the code answers.
# The external open-sheet archive was never a live ingest -- it is a manual importer, absent from the
# workflow, and the live open-sheet corpus is a separate store.
```
