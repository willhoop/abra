# ROTOM ladder hang after a private series — cause, fix, self-healing (2026-09-25)

**Verdict.** Both aa1 hangs (after series k=3 and k=6) had one cause. When an opponent hides the room, the server
renames the bo3 room to `<id>-<31 chars>pw`, and `|updatesearch|` lists the old id and the new one. ROTOM joined
both. The old id no longer existed, so the server answered `>OLD` / `|noinit|nonexistent|`. `rotom.js handleBestof()`
created a series record for **any** line in a `game-bestof` room, that `noinit` included. The ladder controller took
the record as the next series (k=4, then k=7) and consumed that pre-committed index. That series could never end,
`openSeries()` stayed at 1, and `nextAction()` returned `wait: series in progress` forever. There was no search, no
error and no disconnect. Fixed at the root. Every wait in the loop now has a bound, and the supervisor restarts a
client that is alive but not moving.

## 1. The evidence

Run `solver/out/rotom/aa1-2026-09-25T21-00-29-440Z`, `events-medicham32.jsonl` (read only):

| | k=3 (first hang) | k=6 (second hang) |
|---|---|---|
| `join_from_updatesearch` old bo3 id | `…2687880999` at …817430 | `…2687898010` at …148901 |
| `join_from_updatesearch` new id (1 ms later) | `…2687880999-3u647…pw` | `…2687898010-na7wk…pw` |
| `ladder_series_start` real series | k=3 on the `pw` id | k=6 on the `pw` id |
| `ladder_series_start` **phantom** | **k=4** on the old id, +3.3 s | **k=7** on the old id, +0.6 s |
| `battle_join` for the old battle ids | yes (`…2687881000`, `…2687883027`) | yes (`…2687898011`, `…2687900677`) |
| SERIES OVER, row written, rating lines | 21:19:18, row k=3 | 22:01:24, row k=6 |
| next SEARCH | none for 20 min (Will killed it) | none |

Every public series (k=1, 2, 5) was followed by a SEARCH within 2–16 s.

**The server does this.** `pokemon-showdown-mc/server/rooms.ts` `setPrivacy()` → `rename(title, `${roomid}-${password}pw`, true)`.
`noAlias = true`, so the old id resolves to nothing. `users.ts` answers a join of a missing room with
`|noinit|nonexistent|`. In the local dry run below, the real server produced the same frames: the old and new
ids in one `updatesearch`, then `noinit|nonexistent` for the old bo3 id and each old battle id. The fixed client
logged them as `noinit_ignored`, 8 per client.

**The alternatives checked:**
- *The game record lands after SERIES OVER.* It does, but it did the same in public k=1 and k=2, and those
  searched on. The record step does not gate the loop. Not the cause.
- *A promise on the rating lines with no timeout.* There is none. `onSeriesEnd` sets a 20 s `setTimeout`, and the
  rating lines arrived anyway: `LADDER ROW k=3 … E=0.436` was written. Not the cause.
- *A room-id-keyed wait that never matches.* Close, but inverted. Nothing waited on the suffixed id. The loop waited
  on a record **created** from the unsuffixed id, which could never receive a `|win|`.

**Consequences for the aa1 data.** Plan indices k=4 and k=7 were consumed by phantoms. They have no row, and no game
was played under them. The assignment is a pure function of (seed, k), so skipping an index cannot bias the A/B.
The rows for k=3 and k=6 are valid. The phantom series-book files
(`series/medicham32/game-bestof3-…-2687880999.json`, `…-2687898010.json`) are left in place: they are not mine to
delete.

## 2. The fix (`solver/rotom/rotom.js`, `ladder.js`)

- **Root cause.** A `noinit` or `deinit` line in a bo3 or battle room never creates a record
  (`onRoomNoinit`). `noinit|rename|NEW` moves the record (bo3 room, team, series book, ladder record, battles).
  `nonexistent` for a series we hold marks the series gone. `ladder.canonRoom()` strips the `-<pw>pw` suffix. A
  second id for an open series is an **alias**, never a new k (`onSeriesStart`). `updatesearch` no longer joins the
  pre-rename id of a room we already hold.
- **A race found on the way.** `updatesearch` reports "not searching" and lists the new game a moment before the room
  speaks. A tick in that gap sent a second `/search`. Now a newly listed bo3 id holds the next search for up to 20 s
  (`MATCH_JOIN_MS`).
- **Every wait is bounded, with a logged recovery:**

| wait | bound | recovery |
|---|---|---|
| an open series | 150 s silent in its room and all of its battles | `/crq roominfo` probe (always answered); gone, or silent through 3 probes → **orphaned**: `ladder_series_orphan` event, `S.orphans`, a ladder **error** (3 in a row halt), no row, search on |
| rating lines | 20 s (unchanged) | row written without them |
| guard answer | 15 s (unchanged) | fail closed |
| a search in the queue | 20 min | cancel and search again |
| logged out on an open socket | 90 s | drop the socket, and the reconnect path logs in (a ladder error) |
| the login POST | 30 s (`AbortSignal.timeout`) | the failure path |

- **Counters.** The client summary gains `rooms: { renames, ignored_noinit, skipped_old_ids, probes, orphans }`, and
  the ladder state gains `orphans`. A zero or a fallback is visible.

## 3. The supervisor watchdog (`solver/rotom/watchdog.js`, `run_ladder.js`)

No human restarts the bot. The supervisor tails the client's own files: progress events, decisions and the
guard-answer time in `ladder-state` (an idle, searching or paused loop asks the guard every 60 s). If none of these
moves for `--hang-min` (default 10) **and no game is open**, the supervisor kills that client **by its pid**, writes
`supervisor-incidents.jsonl`, and relaunches it through the crash-resume path. A game is open when it has a
`battle_join`, no `game_end`, and activity within 30 min. The watchdog never fires with a game open.
`--hang-min 0` turns it off. `--max-hang-restarts` (default 20) caps it separately from the crash cap of 5.

## 4. Tests

| test | result |
|---|---|
| `solver/tests/test-rotom-private-series.js` (new) — the real `rotom.js` against a scripted local websocket server that replays **both** aa1 sequences: the exact old/new series and battle ids, `noinit|nonexistent` at the run's delays (3.3 s, 0.6 s), all four recorded game logs (`solver/tests/fixtures/rotom/aa1-private/`), the series `|win|`, the rating lines in the deciding game's room, and each last game's record landing **after** SERIES OVER (3.0 s); then a series whose room is gone and one that is silent | **GREEN 23/23** on the fix. **RED on the old code** (`ROTOM_TEST_CLIENT=` a copy of HEAD's `rotom.js`+`ladder.js`): phantom `k=2` on the old id, *"no /search within 60 s: the loop is stuck"*, 4 FAIL |
| `solver/tests/test-rotom-ladder.js` (+PRIVATE, STALL, BOUNDS, alias/rename/orphan controller, WATCHDOG) | GREEN 106/106 |
| `solver/tests/test-rotom.js` | GREEN 86/86 |
| `solver/tests/test-rotom-replays.js`, `test-rotom-localnet.js` | GREEN 41/41, 4/4 |

**The local dry run.** `run_ladder.js --dry-run --release eaa5becc54eb --arms solver/rotom/arms/dryrun-fast.json
--ladder-seed dry-private-hang-1 --sets 3 --hide-b --drill-a hang@1 --hang-min 1.5 --port 8797`, output
`solver/out/rotom/drypriv-2026-09-25/`. It used the real local `pokemon-showdown-mc`. Side B sends `/hidenext`, so
**every series was a private room** (`…-241-…pw` to `…-249-…pw`). Client A hung on purpose after set 1. The
watchdog found it after 91 s with no game open, killed pid 20328 and relaunched it. A resumed, and both clients
finished 3 series each: **6 rows, 0 orphans, 0 public connects blocked**, both exit 0. There were no phantoms:
`noinit_ignored` 8 per client, and no `ladder_series_start` on an old id.

## 5. What is owed

- **The running aa1 client runs the old code.** It can hang again after any private series. With this change, a
  restart (Will's call) picks up the fix through `--out <run dir>`. The same seed and arms keep the plan digest.
- Orphans are counted as errors. If a real server ever made healthy series look silent for 150 s × 3 probes, three
  in a row would halt the run (exit 4). That is safe, but a halt needs a person. The bound is a named constant
  (`SERIES_IDLE_MS`) and a flag (`--series-idle-ms`) if the public server proves slower.
