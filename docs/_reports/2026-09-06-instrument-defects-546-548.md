# Three instrument defects, red first then green — ROADMAP #546, #547, #548

MEASURE, 2026-09-06. Tree at `d7ed4b75` (5.266.0) when the work started.
Files touched: `engine/game_differential.js`, `engine/diff_swarm.js`, and the three register rows.

**Verdict: all three were real. All three are fixed. None was refuted.**

---

## THE WINDOW IN WHICH THE INSTRUMENT MOVED

`engine/game_differential.js` and `engine/diff_swarm.js` are both inside `steering.driver_code`, so
any edit to either voids a whole-game differential in flight. The edits were made as one batch and
those two files have not been touched since.

| | UTC |
|---|---|
| last run against the PRE-edit instrument (the #548 red) finished | **2026-09-06T18:56:28Z** |
| first edit | **~2026-09-06T18:57Z** |
| last edit — `engine/game_differential.js` mtime | **2026-09-06T18:59:25Z** |
| last edit — `engine/diff_swarm.js` mtime | **2026-09-06T19:00:10Z** |
| `node --check` clean on both | **2026-09-06T19:00:15Z** |

**Anything a differential started before 18:56:28Z is unaffected; anything started after 19:00:10Z is
on the new instrument. A run spanning 18:57–19:00 is void and must be re-taken.** The driver-code
digest moved `3119d079dfa5` → `228006b5faca`, and `arms_comparable` names both files (below).

**The engine release did NOT move.** `data/engine-release.json` still reads `57679ef9a4a3`; the runs
below appended cuts to the same id over an unchanged tree (`cuts` 4 → 15). That is the expected
result: these two files are the INSTRUMENT and are not among the frozen sources.

---

## #546 — `buildSwarm` ran at require time

### The defect

`engine/game_differential.js:6450` was

```js
const SW = SWARM.buildSwarm(Math.max((UNTIL_COVERED ? MAX_GAMES : GAMES) * 2, 18),
                            TEAM_STORE ? { storeDir: TEAM_STORE } : null);
```

at module scope, with the module's own guard 283 lines below at `:6733`. So `require`ing the file —
which about fifty probes and instruments do, for `playGame`, `buildPair`, `pairsFor`, `ARM_BY_ID` —
built a team swarm. That is not a slow import, it is a WRITE: with no `--team-store` on the requiring
process's argv the build runs against the LIVE store, misses the size+mtime key a pinned run left in
`data/diff-team-pool.json`, and rewrites that single-slot gitignored cache with the live teams.

### RED

The probe intercepts `diff_swarm.buildSwarm` and `loadTeams` before requiring, so it proves the call
without reading 110 MB or writing anything.

```
=== #546 PROBE =========================================================
  buildSwarm calls DURING require(): 1   <-- SIDE EFFECT AT REQUIRE TIME
  its args                         : [{"n":90,"opts":null}]
  require() wall time              : 2.9 s
```

`opts: null` is the load-bearing half — the requiring process carried no pin, so the build was aimed
at the live store. Independently, the pool cache on disk at that moment carried the FROZEN key
(`games.bo3.jsonl:109006606:…`, the 109,006,606-byte frozen file) while the live file is
227,347,410 bytes: the key would have missed and the cache would have been overwritten.

### The fix

The build is memoised behind `swarm()` and the digest block moved inside it (it DESCRIBES the swarm,
so it cannot run before there is one). `SW` stays an exported property via

```js
Object.defineProperty(module.exports, 'SW', { get: swarm, enumerable: true, configurable: true });
```

so `tests/probe_bench_plants.js`, `probe_drag_exposure.js`, `probe_endstate_by_cause.js`,
`probe_random_target_address.js` and `engine/replay_one.js` keep reading `G.SW.out` unchanged. The
three in-file readers now call `swarm()`. `baselineGuard()` moved below the main guard, preceded by an
explicit `swarm()` so the console output stays in the order it has always been in — the guard reads
`STEER_STAMP.team_pool_digest`, which only exists once the swarm is built.

### GREEN

```
  buildSwarm calls DURING require(): 0   <-- clean
  its args                         : []
  require() wall time              : 0.8 s
  after require, touching G.SW     : SW.out is an array (0 configs)
  buildSwarm calls AFTER touching  : 1   <-- built lazily, on demand
```

### What this does NOT fix, stated rather than implied

`data/diff-team-pool.json` is still **one slot shared by the pinned and the live pool**, and a test
that genuinely USES the swarm without a pin still evicts a pinned one. That happened during this
session's own gate batch: `tests/test-arm-steering.js` rebuilt the cache from the live store at
19:06:12Z (13,571 teams, `store_dir: null`). It is not a regression — before the fix a bare `require`
did the same — and it is self-healing, because a pinned run misses the key and rebuilds in ~41 s. The
cache was restored to the frozen pool (8,778 teams, `pool_digest f807cbc40299`) at 19:11:48Z. **Filed
as an observation, not fixed here**: a per-store cache slot would end it, and that is a change to the
cache contract rather than a bug fix.

---

## #547 — the receipt named the wrong store

### The defect

`engine/diff_swarm.js:329`, inside `writePoolCache(key, teams, storeDir)`, wrote
`source_digests: RS.sourceDigests(POOL_SOURCES)` where `POOL_SOURCES` was the flat literal
`['engine/diff_swarm.js', 'data/games.bo3.jsonl', 'data/games.ots.jsonl']`. The parameter naming the
store actually read was in scope and unused.

### RED — measured on the artifact as found, not staged

`data/diff-team-pool.json`, generated `2026-09-06T17:32:40.421Z` by a run pinned to
`data/team-pool-frozen`:

```
  key            : games.bo3.jsonl:109006606:1786563480340.2263|games.ots.jsonl:31928037:1786563480363.0254
  source_digests[data/games.bo3.jsonl] = da8597c45bb8
  sha12(LIVE   data/games.bo3.jsonl)   = da8597c45bb8   size 227347410
  sha12(FROZEN data/team-pool-frozen/games.bo3.jsonl) = 5e10d7ba991f   size 109006606
```

The key says the teams came from the 109 MB frozen store. The receipt names the 227 MB live store and
carries its content digest. **The pin was honoured and the stamp said otherwise.**

This is the one that most needed a demonstrated red, because a green test proves nothing about it:
`engine/provenance.js` verifies each key by re-digesting the file that key names, so this receipt
**verified**. It was internally consistent and describing a file the run never opened. The only reason
it was ever caught is that somebody hashed the frozen file by hand.

### The fix

`poolSources(storeDir)` derives the two store entries from `storeDir`, repo-relative so
`run_stamp.sha12` (and therefore provenance) resolves them exactly as it resolves every other source
key. A store outside the repository is named by its absolute path and says so rather than being
renamed to something inside it. `store_dir` is written beside the digests in words, because "was a pin
in force at all" is the question a pool-pin audit is actually asking. The now-unused `POOL_SOURCES`
literal was removed rather than left as a second, parallel truth.

### GREEN, with the sample proven not to have moved

Same command, same pin, `--rebuild-pool` so the stamp under test is the one this run wrote:

| | BEFORE (pre-fix, on disk) | AFTER (post-fix, pinned) |
|---|---|---|
| `store_dir` | *(absent)* | `"data/team-pool-frozen"` |
| `key` | `…:109006606:…` | `…:109006606:…` — identical |
| `source_digests` store entries | `data/games.bo3.jsonl: da8597c45bb8` | `data/team-pool-frozen/games.bo3.jsonl: 5e10d7ba991f` |
| teams | 8778 | 8778 |
| `pool_digest` | `f807cbc40299` | `f807cbc40299` |

`5e10d7ba991f` is the by-hand sha256 of the frozen file computed in the RED above. **The sample is
byte-for-byte the same pool; only the receipt changed.** Every key in the new block re-digests to the
value stamped:

```
  verifies  engine/diff_swarm.js                         1c50526141d6
  verifies  data/team-pool-frozen/games.bo3.jsonl        5e10d7ba991f
  verifies  data/team-pool-frozen/games.ots.jsonl        cd21077a4578
```

An unpinned build was also checked and writes `store_dir: null` with the live paths, which is correct.
(`games.ots.jsonl` digests the same in both because the live and frozen copies of that file are
byte-identical at 31,928,037 bytes — not a bug, and worth knowing before it is read as one.)

---

## #548 — `--turns` below 3 threw after the games were played

### The defect

`:75` `const MAXTURNS = +flag('--turns', 20)` accepted anything. `:7837`
`const identicalAtEndOfTurn = [1, 2, 3].map(earlyRate)` was a fixed three, `:7857` built
`agreementByTurn` over `1..MAXTURNS`, and `:7865` zipped the two **by array index**.

### RED

`node engine/game_differential.js --games 2 --turns 2 --state --config baseline --team-store data/team-pool-frozen`

```
engine\game_differential.js:7866
    turn: e.turn, from_kept_boards: e.identical, from_the_counters: agreementByTurn[i].identical,
TypeError: Cannot read properties of undefined (reading 'identical')
```

Exit 1, **after every game had been played** — the whole run thrown away for a flag the parser had
already accepted.

### The fix — it works now, and what is refused is refused loudly

- The ladder is `[1, 2, 3].filter(n => n <= MAXTURNS)`, and a truncated ladder publishes
  `ladder_truncated_by_the_cap` rather than quietly returning fewer rungs. A missing rung is ABSENT,
  not zero, and a reader comparing two artifacts must not be able to mistake "we did not look" for
  "the board held".
- The cross-check joins on the TURN NUMBER, not the index. A rung with no partner reports `unpaired`
  and fails the check; it is not skipped, because a silently dropped rung is a cross-check that agrees
  with itself.
- `--turns` is validated at parse time, before a single game is played. Anything that is not a whole
  number ≥ 1 is REFUSED with exit 2. **It is not clamped** — a run that quietly promoted `--turns 0`
  to `--turns 1` would publish a `turns_cap` nobody could reproduce.

### GREEN

```
--turns 2   exit 0   "the turn-1..3 ladder was cut to turn 2 by --turns 2; turns 3 were never played and are ABSENT, not zero."
--turns 1   exit 0   "…cut to turn 1 by --turns 1; turns 2 and 3 were never played and are ABSENT, not zero."
--turns 0   exit 2   REFUSING TO RUN
--turns -1  exit 2   REFUSING TO RUN
--turns 2.5 exit 2   REFUSING TO RUN
--turns abc exit 2   REFUSING TO RUN
--turns 20  exit 0   ladder_truncated_by_the_cap = null, 3 rungs, unchanged
```

### The old behaviour, restored on the same data — the third arm

The only quantity #548 could have moved at a normal cap is the cross-check. Both joins were computed
over the same post-fix artifact at the default cap of 20 (`--games 12`, pinned):

```
OLD index-join : [{"turn":1,...,7,7,true},{"turn":2,...,7,7,true},{"turn":3,...,7,7,true}]
NEW turn-join  : [{"turn":1,...,7,7,true},{"turn":2,...,7,7,true},{"turn":3,...,7,7,true}]
IDENTICAL?     : YES — at a cap of 3 or more the two joins agree row for row
```

At `MAXTURNS ≥ 3` the ladder is `[1,2,3]` and `byTurn.get(n)` returns `agreementByTurn[n-1]`, so the
two are the same function. No published figure moves.

---

## `arms_comparable`, asked and reported VERBATIM

Pair: `git show HEAD:data/game-differential.json` (the published 961-game artifact, pre-edit
instrument) against a small post-edit pinned run. **Its verdict, in full:**

```
ARE THESE TWO ARMS COMPARABLE?
  before  …/gd-HEAD.json
          release 57679ef9a4a3   steering 9446a684709d   961 games
  after   …/gd-after-small.json
          release 57679ef9a4a3   steering 67fdee37c614   8 games

  NOTE: both arms name the SAME engine release. This is a REPEAT, not a before/after.

  NOT COMPARABLE — shown to differ:
    - the selection POLICY differs: empirical-click/v1 vs census-coverage-seeking/v1 — the scoring rule itself moved, so identical inputs would still select different samples
    - the BEHAVIOUR TABLES differ: data/move-priors.json@e667fe8ab457, data/rollout-switch-census.json@b599f8d581b5 vs . Under empirical-click/v1 these select the sample, so the two arms played different games for a reason unrelated to the change under test.
    - the INSTRUMENT differs: driver code 3119d079dfa5 vs 228006b5faca. 2 file(s) moved between the arms — engine/diff_swarm.js, engine/game_differential.js. The code that reads the tables selects the sample just as much as the tables do; on 2026-09-05 one such edit moved a whole-game run from 138 to 167 divergences under pins that were otherwise byte-identical.
    - the steering INPUT differs: data/mechanics-census.json is 9446a684709d in the before-arm and 67fdee37c614 in the after-arm (643 vs 830 rows, generated 2026-08-23T09:53:56.393Z vs 2026-09-06T16:37:19.436Z). The two arms played DIFFERENT GAMES for a reason unrelated to the change under test.
    - the TEAM POOL differs: 0d103fb9fa87 vs 6de2a8cdd6b1 (8778 vs 8778 distinct teams in the corpus, 1968 vs 18 picked). The game store moved between the arms, so they played different teams — the other half of the sample.
    - `games` differs: 961 vs 8 — a different number of games is a different sample
    - `mode` differs: A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real vs A/middle/pins:9c31c43fab38/credit:observed-effect/v1/nature:real — Mode A and Mode B are different instruments

  DO NOT PUBLISH THIS AS A BEFORE/AFTER.
  A difference between these two arms is partly the input; re-run the arm that moved.

  WHAT THIS CHECK CANNOT SEE:
    - the driver is CHECKED for this pair (steering.driver_code, both arms) — but only its local static `require` closure. A computed require path or a dynamic import is still invisible.
    - data/protocol-events.json — the DECLARED SKIP LIST. It decides which Showdown lines are removed before alignment, so a change to it moves every class count in the table. Not stamped.
    - the Showdown checkout beyond its commit hash — an uncommitted edit in SHOWDOWN_PATH is invisible to `showdown_commit`.
```

Exit 1. **It is right, and the load-bearing line is the third one.** The small run was 8 games at the
default coverage steering and the published one was 961 at `empirical-click/v1`, so most of the other
lines are the two runs being different runs rather than anything about this change. The line that
would still fire between two otherwise identical arms is `the INSTRUMENT differs`, and it names both
files. **No whole-game before/after may be published across 18:56–19:00Z.** The evidence that nothing
else moved is not this check — it is the two paired demonstrations above: `pool_digest` unchanged
across #547, and the index-join equal to the turn-join across #548.

## Sanity gates run after the batch

```
tests/test-no-silent-failure.js     exit 0   no NEW silent failures
tests/test-coverage-stop.js         exit 0   ALL GREEN
tests/test-end-state.js             exit 0   ALL GREEN
tests/test-arm-steering.js          exit 0   all steering-guard demonstrations passed (needs SHOWDOWN_PATH)
tests/test-provenance-discovery.js  exit 0   all clear
tests/test-artifact-keys.js         exit 1   5 passed, 1 failed
```

**`tests/test-artifact-keys.js` is RED and it is not this work.** Its failure is
`UNDECLARED: million-run-150k.json:engine_counters, million-run.json:engine_counters` — `engine/million_run.js`
and its two artifacts, none of which was touched here, and it is already carried as an open register
row about that file. Reported, not filed as a second row, and explicitly not called a known failure:
it is red, it belongs to `million_run.js`, and it was red before this session started.

## Everything else this session left on disk

- `data/diff-team-pool.json` — rewritten three times (untracked, gitignored, self-healing). Left
  holding the **frozen pinned pool**: 8,778 teams, `pool_digest f807cbc40299`, `store_dir
  "data/team-pool-frozen"`, correct receipt.
- `data/engine-release.json` — `cuts` 4 → 15 on the SAME id `57679ef9a4a3`, from this session's runs
  re-cutting an unchanged tree. By design; `cut`/`why` are untouched.
- `data/game-differential.json` — **not written.** No run here used `--write` against it; the small
  post-fix artifact went to the scratchpad via `--out`.
