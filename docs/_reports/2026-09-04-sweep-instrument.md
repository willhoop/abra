# 2026-09-04 — `engine/sweep.js`: what the instruments do not check about themselves

Historical record of one pass. Not current state — `node engine/sweep.js` is.

## What was built

`engine/sweep.js`. Five derived sections, one line each by default, names behind `--verbose`,
`SWEEP_BREAK=<n>` to blank one section's input so its failure path can be shown red.
Exit **1** on a finding, **2** on a section that cannot derive, **0** only when both are clean.
Runs in ~3 s warm, ~10 s cold (the store scan in §5 reads ~800 MB).

It is deliberately not registered in `tests/run-all.js`.

## First real run — 2026-09-04, all five sections found a real instance

```
  1  CHECKS THAT NOTHING RUNS                  60
  2  CLAUSES BLIND TO THEIR OWN STALENESS       3   of 8
  3  PUBLISHED FIGURES OUT OF DATE             12
  4  COUNTERS THAT NOTHING READS              783   of 1048
  5  STORE ROWS WITH NO RAW LOG               614
```

### 1 — checks that nothing runs: 60

Not reimplemented. `tests/run-all.js --coverage` already computes the set; sweep spawns that
read-only entrypoint, parses the ANSWER, and cross-checks the names it recovered against the
runner's own declared count — a mismatch is `CANNOT DERIVE`, never a smaller number published
quietly. 59 of the 60 are the known red; **the 60th is `engine/sweep.js` itself**, which trips
`looksLikeACheck` the moment it was written. That is correct behaviour and it is owed a decision.

### 2 — clauses that cannot notice their own artifact is stale: 3 of 8

The release-pin vocabulary is read out of `stamp()` in `engine/engine_release.js` at run time
(plus the anchored `(^|_)release($|_)` form, because `all-mechanics-fire.json` pins under the older
short name and a stamp-only set falsely accused it). Population and policy are a name vocabulary and
say so; `--verbose` prints every unclassified top-level key of each clause artifact.

| clause | artifact | gap |
|---|---|---|
| game differential | `data/engine-diff.json` | **no release pin at all**; `pool` recorded and not read by `differentialClause()`; no policy pin |
| whole-game differential | `data/game-differential.json` | pins release AND `steering.policy` AND `steering.team_pool_digest` — but `wholeGameClause()` checks the policy and **never the pool digest** |
| mechanics / each one staged | `data/all-mechanics-fire.json` | release pinned and read; **no population pin** on a run that played games and is steered by a census that moves |

The other five are clean: three roster stages pin and check `engine_release`; the coverage clause and
the open-defect clause read the live tree each run and have nothing to be stale against.

### 3 — published figures out of date: 12

4 publications scanned (`web/quarantine-data.js`, `web/stadium.html`, `app/quarantine-data.js`,
`app/stadium.html`). A citation only counts where it sits in the same string as a figure — the first
version matched the withheld-artifact membership roll and reported 34 true-but-irrelevant rows per
page, which is the same drowning failure the file exists to fix.

- **4 stale by citation** — e.g. `app/*` published 2026-08-11 cites `data/roster.moves.json`,
  regenerated 24.0 days later.
- **4 contradicted** — a number published as coming from an artifact that no longer contains it:
  `app/*` publishes `0 of 150` off `data/engine-diff.json` (now 6000) and `427 tested` off
  `data/roster.moves.json`; `web/*` publishes `130` off `data/roster.abilities.json`.
- **4 pairs disagreeing** — both directories claim `web/build-quarantine.js` and hold
  `n_quarantined: 60` vs `47`, `n_artifacts: 234` vs `177`. The live gate agrees with neither
  publication's clause string (`3 of 8` / `1 of 6` against a live 1 of 8).
- **2 citations to `data/decision-impact.json`, which does not exist** — a figure with no source at
  all, rendered exactly like a sourced one.

### 4 — counters that nothing reads: 783 of 1048, in 16 of 46 counter objects

Derived from `NAME.prop++` / `+=` with comments AND string literals stripped, then one pass building
the set of every `.prop` read anywhere in the tree. Generous in the safe direction, so the number is
a floor.

`MEDFAILS` 209 of 241 and `MEDSEEN` 544 of 644 are the bulk, and the class is wider than the brief's
one instance: `engine/effect_kind.js FAILS` (2 of 2), `engine/game_differential.js STANDING_FAILS`
(2 of 2), `engine/position_features.js STATS` (1 of 1), `engine/magnemite.js VOL_DUR_COUNTERS`,
`engine/rollout_leaf.js` × 3, `engine/all_mechanics_fire.js` × 3, and four probe skip-counters.

**Every one of the 16 is exported or dumped in bulk, and not one has a named reader.** That
distinction is the point: bulk exposure is what makes a counter read as instrumented in review.
Controlled — the three `MEDFAILS` counters that DO have a named reader (`traceBodyOffField`,
`accEvaSeparateRestored`, `targetSideFoeOnlyRestored`) are correctly excluded, and the bulk predicate
was shown to return false on a synthetic never-exposed object before it was trusted (the first version
matched the object's own `const NAME = {` and read TRUE for everything).

Worked example of the class: `MEDFAILS.encoreAction` is incremented at two `catch (e) {}` sites in
`engine/medicham2-browser.js` (14507, 23945) and read by nothing — a swallowed exception whose only
record is a counter with no reader.

### 5 — store rows with no raw log: 614

Store list derived from the `durable-ingest.js <path>` invocations in `.github/workflows/ingest.yml`;
the raw-archive suffix read out of durable-ingest's own `const RAW=` line, so a changed naming rule
fails loudly instead of comparing two files that were never a pair.

- `data/games.bo3.jsonl` — **614 of 25,350** stored rows have no raw log (archive holds 24,736).
- `data/games.ladder.jsonl` — **0 of 76,431** (archive holds 76,432).

The extraction was validated against a full `JSON.parse` of every line of the bo3 store: 25,350 lines,
25,350 id-prefix matches, 25,350 unique parsed ids — exact agreement.

**This does not reproduce the 6,661 figure in the brief.** Measured today, on the two stores CI
actually ingests, the number is 614 and all of it is bo3. Either that figure was taken over a
different store set or at a different time; it is not what the durable-ingest reparse guard would
compute against this tree now.

## What could NOT be made to derive

Nothing — all five sections derive, and all five `CANNOT DERIVE` paths were demonstrated red with
`SWEEP_BREAK=1..5` (exit 2, section named). Three honest weaknesses are declared in the file's own
headers rather than hidden:

1. **§2's population and policy vocabulary is a name list.** The release half is derived from
   `stamp()`; the other two are not derivable from anything in the tree, so a pool pinned under a name
   outside the vocabulary IS MISSED. Mitigation is partial: `--verbose` names every unclassified key.
2. **§1 inherits `looksLikeACheck`'s blind spot** — deliberately, since widening belongs in
   run-all.js, not in a second copy here.
3. **§5 duplicates six lines of arithmetic.** The orphan set difference lives inside `main()` in
   `engine/durable-ingest.js`, is not exported, and this pass was not permitted to edit that file.

## OWED, NOT RUN

```
node engine/sweep.js --verbose
MODE=backfill node engine/durable-ingest.js data/games.bo3.jsonl
node web/build-quarantine.js
```

- **`engine/sweep.js` is now the 60th unaccounted check in `tests/run-all.js`.** It needs either a
  `GATES` entry or a `PENDING_WIRE` reason. Deliberately not done here — wiring is a separate call,
  and a gate that is red on the day it is written is "known failure" in a new costume.
- **Export the orphan count from `engine/durable-ingest.js`** and delete the loop in §5, so the two
  cannot disagree. OPS owns that file.
- **`data/engine-diff.json` carries no release pin.** Until it does, the clause reading `0 of 6000`
  cannot notice it is answering about bytes that no longer exist. ENGINE/MEASURE.
- **`data/all-mechanics-fire.json` records no population.** It is steered by a census that moves.
- **`wholeGameClause()` should check `steering.team_pool_digest`**, not only `steering.policy`. The
  artifact already records it.
- **`web/` and `app/` quarantine bundles are stale, contradicted and mutually inconsistent.** WEB is
  paused; this is filed, not fixed.
- **614 bo3 rows have no raw log — do NOT reparse that store** until the backfill above has run.
