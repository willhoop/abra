# Is the pool pin honoured? — and the re-measurement on release `57679ef9a4a3`

MEASURE, 2026-09-06. Sole agent. Nothing committed; every figure below is on disk.

---

## JOB 1 — THE POOL PIN IS HONOURED. YES. NOTHING IS WITHDRAWN.

**`--team-store data/team-pool-frozen` reads the frozen bytes, the artifact records the pin, and the
record describes what actually happened.** Three independent lines of evidence, all measured this
session, none of them a reading of the code alone.

### a. Traced to the bytes

`engine/diff_swarm.js#loadTeams` was driven directly with `{ storeDir: 'data/team-pool-frozen' }`
(probe: scratchpad `pool_probe.js`, written this session). The cache it wrote carries

```
key                        games.bo3.jsonl:109006606:1786563480340.2263|games.ots.jsonl:31928037:…
source_content_digests     games.bo3.jsonl 2fd61bf80133   games.ots.jsonl 535ee1cd9b0d
teams                      8778
```

and sha1 of the files on disk:

| | bytes | sha1(12) |
|---|---|---|
| `data/team-pool-frozen/games.bo3.jsonl` | 109,006,606 | **2fd61bf80133** |
| `data/games.bo3.jsonl` (live) | 227,347,410 | 1a47b971bc46 |
| `data/team-pool-frozen/games.ots.jsonl` | 31,928,037 | 535ee1cd9b0d |
| `data/games.ots.jsonl` (live) | 31,928,037 | 535ee1cd9b0d |

The pinned read's content digest is the frozen bo3, not the live one. The OTS half of the store has
not moved since 2026-08-12 and is byte-identical either way, which is why only bo3 discriminates.

### b. `data/diff-team-pool.json` is a derived cache, not an input — and the live-store contents were a
side effect of a *probe*, not of an unpinned differential

It is gitignored (`.gitignore:125`), single-slot, and keyed on the size+mtime of *the store it was
handed*. A pinned run whose key does not match MISSES loudly and rebuilds from the frozen bytes. No
run reads it as an input; `game_differential.js` derives `team_pool_digest` from the teams `buildSwarm`
actually returned, not from the cache header.

**Why it held 13,571 live teams when it was found.** The header said `generated
2026-09-06T16:51:34.733Z`. `data/releases/57679ef9a4a3/cuts.jsonl` records cuts at 16:51:31 and
16:51:45 for `tests/probe_leechseed_silent.js` and `tests/probe_bigroot_family.js`. Both `require`
`engine/game_differential.js`, and that module calls `SWARM.buildSwarm(...)` at **line 6450**, which is
**before** its `if (require.main !== module) return;` at **line 6733**. So requiring the differential
executes a team load as a side effect, reading `--team-store` off the *requiring process's* argv — a
probe that does not pass it rebuilds the cache from the LIVE store, at ~41 s a time.

That is the whole of it. It is a cache-thrash by a probe at 12:51 local, 47 minutes *after* the
published differential finished at 12:04. It is not evidence about the pinned run at all.

### c. The pin is in the artifact and it describes what happened

The 5.264.0/5.265.0 `data/game-differential.json` stamped:

```
steering.team_store_pinned_to   data\team-pool-frozen
steering.team_pool_teams        8778
steering.team_pool_picked       1968
steering.team_pool_digest       0d103fb9fa87
```

Replaying `buildSwarm(2400, {storeDir:'data/team-pool-frozen'})` this session reproduced **all four**
exactly. The digest is over the *picked team keys per configuration*, so it is a receipt for the
population and not merely for the path — a swapped frozen store would move it.

### d. The 777-versus-961 sample difference: REPRODUCED, and it is `--games`, not the cache

`team_pool_picked` is `per × configs`, `per = floor(--games × 2 / 9)`. Measured against the frozen
store (deterministic; the 1200 row was run twice and matched):

| `--games` | per | picked | raw pairs | pool digest |
|---:|---:|---:|---:|---|
| 800 | 177 | 1,345 | 668 | `626370cce3c5` |
| 900 | 200 | 1,506 | 752 | `727e09df8d69` |
| **960** | 213 | **1,597** | **794** | **`b2b61ec40281`** |
| 1000 | 222 | 1,660 | 829 | `ae3b8a803848` |
| **1200** | 266 | **1,968** | **983** | **`0d103fb9fa87`** |

Then run end-to-end on the frozen pool, release `d9e551ed0d5a`, census pin `9446a684709d`, arm
`middle`, empirical driver:

```
--games 960  ->  team pool b2b61ec40281 (1597 picked from 8778)  ->  777 games in the primary arm
--games 1200 ->  team pool 0d103fb9fa87 (1968 picked from 8778)  ->  961 games in the primary arm
```

**777 is reproduced exactly and deterministically.** The rapidspin pair was run at `--games 960`; the
published run at `--games 1200`. The pool cache is not implicated and the report that attributed it to
a cache rebuild was wrong on the mechanism (it was right that its own pair was valid against itself).

The 5.265.0 report's reading of `loadTeams` — key is size+mtime, a miss rebuilds deterministically, so
a rebuild changes elapsed time and not teams — was **correct**. It just did not have the missing
variable, which was never written into the report: the command.

### BLAST RADIUS: NONE. NOTHING IS WITHDRAWN.

The published `27 / 93 / 70` rested on a correctly pinned frozen pool of 8,778 teams. It has now also
been re-measured on the current tree and comes back identical (Job 2). No figure needs withholding on
pool-pin grounds.

**One thing that genuinely changes: `--games` is part of the sample definition, not a budget.** Two
runs on identical declared pins but different `--games` draw different strides and are not a
before/after. `arms_comparable.js` already refuses on `games` differing (`RUN_PARAMS`), so the guard
exists — but a report that records the pins and not the `--games` cannot be audited, and that is what
happened here. **Record the whole command.**

### Three defects found while answering this. NONE fixed — no release SOURCE was touched.

1. **`engine/game_differential.js` calls `buildSwarm` above its main guard** (6450 vs 6733). Requiring
   the module for `buildPair` / `ARM_BY_ID` costs ~41 s and rewrites `data/diff-team-pool.json` from
   whatever store the *caller's* argv names. Every probe that requires it without `--team-store`
   thrashes the cache. Cheap mitigation used here: pass `--team-store data/team-pool-frozen` to the
   roster and mechanics runs, which keeps the key stable and skips the rebuild. It changes nothing they
   measure (they do not use the swarm) and none of their artifacts stamp it.
2. **`engine/diff_swarm.js#writePoolCache` stamps `source_digests` from the fixed `POOL_SOURCES`
   literal**, which names the LIVE paths. A pinned cache therefore carries a live-store receipt in
   `source_digests` and the correct frozen one in `source_content_digests` — two digests of the same
   nominal file, in one header, disagreeing. Not load-bearing (nothing downstream reads
   `source_digests` on this file) and exactly the manufactured-receipt shape.
3. **`engine/game_differential.js` throws for any `--turns` below 3.** `identicalAtEndOfTurn` is
   `[1,2,3].map(...)` (line 7837) and `agreementByTurn` runs `1..MAXTURNS` (7858); the cross-check at
   7865 indexes the shorter array. `TypeError: Cannot read properties of undefined (reading
   'identical')` at 7866. Hit while trying a cheap `--turns 2` repro. No real run is affected (caps are
   12/20) and the crash is after the games are played, so the 777 count above was still read from a
   completed primary arm.

*(One non-finding, checked and dropped: `git show HEAD:data/game-differential.json` differed in bytes
from the on-disk copy. Same `generated`, same release, same 961/27/93/71, same pool digest — line-ending
normalisation, not a content difference.)*

---

## JOB 2 — MEASUREMENT RESTORED. 7 of 9 CLAUSES NOW ANSWER ON MEASURED COUNTS.

Release cut on the current tree: **`57679ef9a4a3`** — the same id status already named, cut 4 of
identical bytes, appended not overwritten.

### The prediction, written before the run

`data/verification/_prediction-remeasure-57679ef9a4a3.json`, `written_before_the_run: true`, no
tolerance band claimed.

| | predicted | measured | |
|---|---:|---:|---|
| games | 961 | **961** | HIT |
| board-material (`state.games` − `state.games_board_never_diverged`) | 27 | **27** | HIT |
| protocol diverged games | 93 | **93** | HIT |
| narration-only RAW (`by_cause_totals.games_narration_only`) | 71 | **71** | HIT |
| team pool digest | `0d103fb9fa87` | **`0d103fb9fa87`** | HIT |
| team pool teams / picked | 8778 / 1968 | **8778 / 1968** | HIT |

**Six of six. No misses.** Published narration is 70 (71 raw less 1 declared row) — unchanged.

The reason given in advance was the matched pinned pair across exactly these two releases reading
777/98/2-threw on both legs with byte-identical logs, plus Rapid Spin appearing 0 times on the frozen
pool's sheets. The named risk — that the 961-game draw is a *different* sample from the 777-game one
rather than a superset, so 184 unplayed teams could have surfaced an ordering difference — did not
materialise.

### The run

```
node engine/game_differential.js --steering empirical --release 57679ef9a4a3 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

961 games, 1 arm, 183.4 s, showdown `20ad99ffc9a5`. Driver code `3119d079dfa5` over 11 files,
unchanged across the whole run. Pool line printed
`team pool 0d103fb9fa87 (1968 teams picked from a corpus of 8778 — PINNED to data/team-pool-frozen)`
with no cache MISS.

### The other artifacts the release mismatch had staled

All re-run on `--release 57679ef9a4a3`, all exit 0:

| artifact | result |
|---|---|
| `data/roster.items.json` | **0** FIRED-AND-BOARDS-DIFFER, **0** DID-NOT-FIRE; 140 of 148 tested |
| `data/roster.abilities.json` | **0 / 0**; 129 of 202 tested, 45 unattributable (control arm is itself a live ability) |
| `data/roster.moves.json` | **0 / 0**; 475 of 500 tested |
| `data/all-mechanics-fire.json` | 1,313 games, 0 threw; moves 495 resolved, abilities 104 fired, items 64 fired |
| `data/engine-diff.json` | 6,000 compared, **0 disagreed**, seed 20260804, clean at every one of the 16 roll indices |

### `engine/arms_comparable.js`, verbatim

`node engine/arms_comparable.js <5.264.0 copy> data/game-differential.json`:

```
ARE THESE TWO ARMS COMPARABLE?
  before  …/game-differential.5264-d9e551ed0d5a.json
          release d9e551ed0d5a   steering 9446a684709d   961 games
  after   data/game-differential.json
          release 57679ef9a4a3   steering 9446a684709d   961 games

  COMPARABLE. Both arms selected their sample the same way, so a difference between
  their numbers is the change under test.

  WHAT THIS CHECK CANNOT SEE:
    - the driver is CHECKED for this pair (steering.driver_code, both arms) — but only its local static `require` closure. A computed require path or a dynamic import is still invisible.
    - data/protocol-events.json — the DECLARED SKIP LIST. It decides which Showdown lines are removed before alignment, so a change to it moves every class count in the table. Not stamped.
    - the Showdown checkout beyond its commit hash — an uncommitted edit in SHOWDOWN_PATH is invisible to `showdown_commit`.

EXIT=0
```

**It did not refuse.** The before-arm is a byte copy of the on-disk 5.264.0 artifact taken before my
run overwrote it (also recoverable as `git show HEAD:data/game-differential.json`).

### `node engine/status.js`, read-only — 9 clauses

| | clause | verdict |
|---|---|---|
| 1 | game differential | **PASS** — 0 of 6000 at every roll index |
| 2 | deliberate roster / items | **PASS** — clean, 140 of 148 |
| 3 | deliberate roster / abilities | **PASS** — clean, 129 of 202 |
| 4 | deliberate roster / moves | **PASS** — clean, 475 of 500 |
| 5 | coverage / every used mechanic measured | **PASS** — all 412 moves above 25 clicks |
| 6 | whole-game / **BOARD-MATERIAL** | **FAIL — 27 of 961 = 2.8%** |
| 7 | whole-game / NARRATION (reports, does not gate) | **FAIL — 70 of 961 = 7.3%**, 69 causes |
| 8 | mechanics staged and compared | **PASS** |
| 9 | no open known engine defect | **PASS** |

**Seven pass, two fail, and both failures are measured disagreements on the current bytes.** Before
this pass, seven of nine failed on the release mismatch alone and no whole-game count could be
published anywhere.

Of the 27 board-material games, **5 are UNCAUSED** — the board parts and the protocol never diverges,
so there is nothing to grep: turn 6 `…bo3-2661571698` `p1.pp[1].expandingforce`; turn 7
`…bo3-2660414382` `p1.active[1].stall`; turn 9 `…bo3-2635949496` `p1.active[0].stall`; turn 16
`…bo3-2655675221` `p2.active[1].stall`; turn 7 `…bo3-2661455548` `p2.party.castform.species` +
`.types`. 10,452 of 10,541 turn boundaries compared were identical — **that is not this clause's
denominator** and always reads greener.

Still-outstanding pre-existing status noise, untouched: the FEATURE SEMANTICS CHECK on
`data/policy-weights.json` (fixture identity + damage table gates fired — a refit/restamp question,
not this pass's), and 18 `docs_scan` lines for `data/*.js` files that are JS and not JSON.

---

## What is on disk and NOT committed

`data/game-differential.json`, `data/engine-diff.json`, `data/all-mechanics-fire.json`,
`data/roster.{items,abilities,moves}.json` (+ their `.prev.json` and `data/roster.json`),
`data/engine-release.json`, `data/provenance-stamp.json`, `data/published-samples.json`, and the new
`data/verification/_prediction-remeasure-57679ef9a4a3.json`.

**No release SOURCE was edited.** `engine/medicham2-browser.js` was not touched. `engine/status.js
--write` was NOT run.

`data/diff-team-pool.json` is currently the FROZEN pool (`key …109006606…`, digest `f807cbc40299`,
8,778 teams). A copy of the live-store cache as it was found is in this session's scratchpad; nothing
was deleted.
