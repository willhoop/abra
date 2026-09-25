# ROTOM: a saved replay of every game, joined to our reasoning

2026-09-25 · branch `worktree-agent-aaad843e454853440` (rebased on `origin/main` `a085dd9f`) · SOLVER · local server only.

## Verdict

ROTOM now saves a replay at the end of every game, retries on failure, and writes one record per game to
`solver/out/rotom/games.jsonl`. Each record links the replay URL, our copy of the battle log and that game's
decision log (candidates, payoff table, mix, time, bank). Local test, 3 bo3 sets on `localhost:8791`: **8 of 8 games
saved, 16 of 16 records (one per client per game), all on the first attempt. There were 0 timeouts, 0 invalid choices
and 0 crashed sets.** No request reached a public server.

**Finding: the existing local harness already contacted play.pokemonshowdown.com.** The checkout's `config/config.js`
sets `loginserver = 'http://play.pokemonshowdown.com/'`, and `server/loginserver.ts` sends `invalidatecss` there each
time the server starts. With no `replaysdb`, `/savereplay` would upload every test game to the same address
(`rooms.ts:2112`). The harness now redirects both requests to a local stand-in (see §3).

## 1. The command and the response, from the server source (pokemon-showdown-mc `f10d679`)

| What | Source |
|---|---|
| `/savereplay` (alias `/uploadreplay`), sent in the battle room, with no argument (`silent`/`forpunishment` suppress the reply) | `server/chat-commands/core.ts:1149-1158` |
| Replay id = the room id without `battle-`; a `…pw` room drops its password segment | `server/rooms.ts:2138-2143` |
| Success = a popup on **our connection only**: `\|popup\|\|html\|<p>Your replay has been uploaded! It's available at:</p><p> <a … href="https://<routes.replays>/<fullid>" …>` | `rooms.ts:2096-2100, 2128-2134`; `users.ts:299-301` |
| `fullid` = id; `<serverid>-<id>` off the main server; `<id>-<password>pw` for a hidden room | `rooms.ts:2084`, `replays.ts:127` |
| Failure = `\|popup\|Your replay could not be saved: <e>` or `…is not a registered server.`, or `\|error\|` in the room | `rooms.ts:2102, 2126`; `core.ts:1152` |
| If the replay was saved during the game, the server uploads it again at the end, silently | `room-battle.ts:869-875` |
| Rating after a rated series: `\|raw\|NAME's rating: A &rarr; <strong>B</strong>`, posted once in the room of the deciding game | `ladders-remote.ts:93`, `ladders-local.ts:263`, `room-battle-bestof.ts:465-467` |
| Rating before: the 5th field of `\|player\|` | protocol |

A popup carries no room id. A success is matched to its game by the replay id in the URL. A failure is charged to the
oldest save still in flight. The pokemon-showdown **client** source is not checked out on this machine, so the server
source was the only authority used.

## 2. What was built (`solver/rotom/`, `solver/tests/`)

| File | Role |
|---|---|
| `replay.js` | `ReplaySaver`: one state machine per room. Send, wait for the popup (20 s), retry after 2/5/10 s, give up after 4 tries; `done()` is called exactly once. A socket that is down counts as a failed attempt. After a reconnect the saver sends `/join` before the next try. The saver never throws into the client. Also holds the popup and rating-line parsers. |
| `rotom.js` | At `\|win\|`/`\|tie\|`: writes our copy of the room log, starts the save and holds the finished room until the save resolves (plus ≥3 s, and up to 15 s for a rated series' rating line). Then it appends the record and leaves the room. The next game is a different room, so it never waits. Every decision is also written to `<out>/games/<client>/<room>.decisions.jsonl` with `bank_before_s`/`bank_after_s`. Pending records are kept in the run state, so a restarted process saves them again (`resume_pending_game`). The client waits for records still in flight before it exits. On a public server it refuses to run under a name that is not on both own-account lists. |
| `policy.js` | The payoff table for each MILTANK decision: the candidate rows (as request choices), the opponent columns, the matrix, the solved mix, row means, value, gap and pick. These are read through a record-only tap on `cells.fillSerial` and `slowking/matrix.solveRM/LP` (`search.js` returns only the chosen joint, and `solver/miltank/` is outside this brief). |
| `local_login.js`, `local_server_preload.js` | The local login-server stand-in (answers `addreplay`, writes the log, serves `/replay/<id>.log`), and a `--require` preload that points `Config.loginserver` and `routes.replays` at it. The preload does nothing without `ROTOM_LOGIN_MOCK` and refuses a non-loopback URL. |
| `run_local.js` | Starts the stand-in and loads the preload through `NODE_OPTIONS`. Passes `--local-replays` and a per-run `--games-file`. Writes `games-report.json`. If it reuses a server that was already running, the clients skip saves and record the skip, because that server cannot be shown to point at the stand-in. |
| `report.js games` | Record by series, game and series win rate with 95% Wilson CI, per-team results, clock used, the bank-left distribution, replay coverage, and a replay link for each loss. Local records are excluded unless `--include-local`. |
| `solver/tests/test-rotom-replays.js` | 41/41 GREEN (initially RED 40/41 on its own over-strict hygiene regex, which was fixed). `test-rotom.js` still 86/86. |

Record fields: `format, series, game, room, client, policy, server, local, me, players, opponent, our_team,
sheets{p1,p2}` (packed, as `|showteam|`), `preview_choice, leads, brought, result{winner,mine,tie,turns}, rated,
rating_before, rating_after, clock{used_s,bank_left_s}, replay{status,url,id,attempts,ms,error},
decisions{n,log,run_log}, battle_log, provenance`.

## 3. Local test (run `rp3`)

`node solver/rotom/run_local.js --tag rp3 --sets 3 --port 8791 --a miltank --b prior --a-args "--max-ms 1000 --preview-max-ms 3000"`.
Output is in `solver/out/rotom/rp3-2026-09-25T05-43-47-273Z/`, which git ignores.

- **3 sets / 8 games; 16 records; 16 saved, 0 failed, 0 skipped, 0 retried.** Every record's decision log and battle log
  exist. The server log shows the preload in all three server processes. The stand-in received `invalidatecss` ×1 and
  `addreplay` ×16, with 8 distinct replay files: each client uploads, and the second upload overwrites the first under
  the same id.
- **How the local server handles a replay:** with the stand-in, the upload goes through the login-server path, and the
  popup URL reads `https://127.0.0.1:8792/replay/<id>`. The stand-in serves the replay over **http** at that path, so
  change the scheme to open it. The `https` is hard-coded in `rooms.ts:2131`. Without the stand-in, a local server would
  post the replay to play.pokemonshowdown.com. That was not run, by design.
- For the miltank client, 9 of 12 decisions in the first game carry a full table (the rest are forced, preview or
  single-joint decisions).
- **bank_left = 420 s in every game.** This is consistent with v0's finding that the server charges the bank in 10 s
  ticks: every decision here was under 10 s. It is not a bug. It does mean the bank-left distribution only becomes
  informative under a real (uncapped) search.
- Not exercised live: a failed or retried save, a reconnect mid-save, and a restart with a pending record. The unit tests
  cover the saver's retry, give-up, reconnect-join and single-`done` behaviour. The restart path is untested.
- Pre-gate: the run used the live tree, not a frozen release. The win rates above are harness output, not results, and
  are not quoted.

## 4. Data hygiene (read-only checks)

- `solver/human/build_dataset.js:34,140` and `solver/meta/extract.js:29,153` both list `medicham32` in `OWN` and exclude
  the game as `own_account`. `solver/meta/analyze.js` reads only extract's cleaned output. Asserted in the test.
- The ingest stores our games like any other game. `engine/next_regulation_ingest.js` runs
  `engine/durable-ingest.js` with `FORMATS=gen9championsvgc2026regmcbo3` into
  `data/games.gen9championsvgc2026regmcbo3.jsonl.gz` (`next-regulation.json` lists the bo3 id as a hit). durable-ingest
  lists `search.json?format=` and has no name filter. Its `isBot` pattern does not match `medicham32` (asserted).
  Caveat: `search.json` lists **public** replays only. If an opponent's hidden-battle preference makes the bo3 room
  hidden (`room-battle-bestof.ts:123-150`), the replay is saved with a password, the ingest never sees it, and only our
  `battle_log` copy keeps the game. The main ladder bo3 pull (`ingest.yml:149`) still follows `regulations.json` active =
  `regmb`, so Reg M-C bo3 comes only through the next-regulation collector until that flip.

## 5. Owed

- The retry and restart paths still need a live drill (for example, kill the stand-in mid-run).
- The miltank table records unfilled cells at the matrix mean (`search.js` behaviour). `info.unfilled` says how many.
- No CHANGELOG, notes row or version bump was made: the brief limits this work to `solver/rotom`, `solver/tests` and
  this report. Those are owed by whoever merges it.
