# ROTOM ladder mode — prepared, dry-run locally, not launched

2026-09-25 · SOLVER · branch `worktree-agent-a389a1eed5928626f` (based on `origin/main` `a085dd9f`, abra/regmc 1.0.0) ·
release `eaa5becc54eb` · no ladder game played, no public host contacted.

## Verdict

ROTOM can now play the `gen9championsvgc2026regmcbo3` ladder: login (challstr → assertion), `/utm` + `/search`, the full
series, repeat until the STOP file, the set count, a time cap, or 3 consecutive errors. It uses a pre-committed per-series
A/B arm and a rotation of 5 real top teams. **Local dry run, 10 series per client (20 series rows, 22 games), same client
code path: 0 timeouts, 0 invalid choices, 0 crashed sets, 0 uncaught. A 5 s socket drop and a process crash were both
recovered mid-series without a forfeit. The willhoop guard paused both clients for 63 s and then resumed them. Zero
outbound connections from either client or the supervisor. The local server's own 9 attempts to reach public hosts were
refused.** `test-rotom-ladder` GREEN 77/77, RED 73/77 on the deliberate break. `test-rotom` 86/86.

Launch command and stop/kill: `solver/rotom/LADDER.md`. **A public launch is Will's call.**

## 1. What was built

| File | Role |
|---|---|
| `solver/rotom/ladder.js` | The ladder loop as a pure `nextAction(snapshot)` plus a controller. It handles the guard, search/cancel, series start and end, rating lines, the series row, and the error halt. It sits behind a small interface, so `rotom.js` keeps the socket, the battles and the decisions. |
| `solver/rotom/rotom.js` | `--ladder` (+ `--public` or `--dry-run`), `--release` (the engine comes from `data/releases/<id>/` through `solver/arena/engine.js`), the arm's policy and caps per decision, a graceful first Ctrl+C, and 22 s in the finished room so the rating lines arrive. Challenges are rejected in ladder mode. |
| `solver/rotom/run_ladder.js` | The supervisor and watchdog: restarts on any non-final exit (final: 0, 2 refused, 3 lock held, 4 halted), `--stop`, and `--kill` by recorded pid (`taskkill /PID <pid> /T`). It also runs the dry-run harness: server + stand-in + two clients + a guard window + drills. |
| `solver/rotom/netguard.js` | Wraps `net.Socket.prototype.connect` and refuses every non-loopback host before DNS. It covers http, https, fetch and WebSocket. It is a preload for the server and all its forks, and is installed in-process by `--dry-run` clients and the supervisor. |
| `solver/rotom/login_stub.js` | A local `/api/login`. It signs `challenge,userid,2,date,host` with RSA-SHA1. The preload sets the local server's `loginserverpublickey`, so `users.ts validateToken` verifies it for real. |
| `solver/rotom/build_ladder_teams.js` → `teams/ladder-rotation.json` | 5 teams, one per stable archetype (GURU `archetypes.json`, in share order). Each is the highest-rated open-sheet bo3 side assigned to that archetype and carrying its defining species (`in_cluster ≥ 0.5`), one per player, own accounts and bots excluded. The spread comes from `build_assets.js`, and each team is validated by Showdown's TeamValidator (0 refused). The client re-validates at start-up and refuses on any failure, and it also refuses a rotation outside 3–5 teams. |
| `solver/rotom/arms/*.json` | `aa-miltank` (A/A placebo), `miltank-vs-prior` (pre-registered SPRT), `dryrun-fast` (search caps; refused on `--public`). |
| `solver/rotom/lock.js` | `readPasswordFile`: ladder mode reads `data/.showdown-pass` only. No env var, argv or log. |
| `solver/tests/test-rotom-ladder.js` | 77 checks: PLAN, RATING, GUARD, LOOP, CONTROLLER, RELEASE, NET, LOGIN, STARTUP, ROTATION, SOURCE. |

## 2. Safety, requirement by requirement

| Requirement | How | Evidence |
|---|---|---|
| Two-account lock | Machine-wide `abra-live-public.lock` (O_EXCL). Before every search, and every 60 s while searching, the client sends `/crq userdetails willhoop`. `rooms:false` means offline. In `online` mode (the default) it pauses while willhoop is connected at all. No answer within 15 s counts as not clear. | Dry run: willhoop online 06:30:53–06:31:53 → both clients `guard_pause` on login and `guard_clear` at the next re-check (63 s paused). Unit: fail-closed, cancel-while-searching. |
| willhoop online/laddering | `userdetails` shows whether the account is **connected**, and lists its battles unless it set `hideBattlesFromTrainerCard` (`pokemon-showdown-mc server/chat-commands/core.ts` `crqHandlers.userdetails`). **A pending ladder search is visible to nobody.** | The gap is documented in LADDER.md §5, and the rule is "log willhoop out before a launch". If he is the opponent anyway, the incident is logged, the series is played out, and the ladder stops. |
| Stop after N consecutive errors | Errors: login refused or failed, a search refused by popup, a watchdog restart, 3 unanswered guard queries, a series with an invalid choice, a timeout or a caught crash. A clean series resets the count. At N (default 3) the client HALTS: no search, exit 4 once idle, never mid-series, and no restart. | Unit (3 errors → halt → exit 4). Dry run: the crash drill counted 1 error, and the next clean series reset it to 0. |
| Never forfeit | No `/forfeit` anywhere (source check). A crash → the watchdog restarts → it rejoins from `\|updatesearch\|` and plays on. A socket drop → reconnect with backoff → assertion login → rejoin. | Dry run: A `drop@2.1.3` (5 s): reconnected, logged in again, the series finished (row k=2). B `crash@4.1.2`: restart #1 in 3 s, `resumed` series k=4 finished (row `counters_partial: true`). |
| Clock budget | Unchanged `clock.js` (420/90/55/90, E[remaining requests] from the store). An arm may cap it further (`max_ms`). The supervisor's `--max-hours` sets a session cap. | 0 timeouts, 0 sent-late in the dry run. |
| Kill switch | Graceful: `--stop` writes `solver/out/rotom/STOP`, or press Ctrl+C once. Hard: `--kill --out <dir>` or a KILL file, or Ctrl+C twice. It kills only the pids in `pids.json`. | Unit (STOP idle/searching/mid-series). A start with a leftover STOP/KILL is refused. |
| Password | File only, and the value is never logged. `CRED.pass` appears exactly twice (the empty check and the POST body; source check). A dry run sends a placeholder and does not read the file. | Stub: `pass_field_seen` counted, value never stored. |
| Frozen release | Ladder mode refuses without `--release`, and refuses a release first cut before `eaa5becc54eb` (PRE-GATE). Every series row carries `REL.stamp()`. | Unit + STARTUP. |
| Logged per series | `ladder-series-<name>.jsonl`: k, arm + full config, team (+ archetype, source game), opponent, both ratings before/after, S, E, S−E, games, fallbacks/invalid/timeouts/decisions during that series, plan seed+digest, release stamp. | 20 rows, all `rated: true`. |

**A/B assignment.** `assign(seed, k)` = sha256(`seed|k|arm`) mod 2 over the sorted arm ids, and team = sha256(`seed|k|team`)
mod 5. The plan (seed, arms file + sha256, rotation + sha256, a digest of the first 5,000 assignments) is written to
`ladder-state-<name>.json` before the first search. A restart with another seed, arms or rotation is refused
(`PLAN_MISMATCH`). Over 4,000 series, arm A takes 1880–2120 (unit).

## 3. The dry run (`dry10`)

`node solver/rotom/run_ladder.js --dry-run --tag dry10 --sets 10 --port 8795 --release eaa5becc54eb --arms solver/rotom/arms/dryrun-fast.json --ladder-seed dry10-2026-09-25 --guard-window 0:60 --drill-a drop@2.1.3:5 --drill-b crash@4.1.2 --timeout-min 180`
→ `solver/out/rotom/dry10-2026-09-25T06-30-13-350Z/ladder-report.json` (git-ignored). Wall 574 s. pokemon-showdown-mc `f10d679`.

| | Client A (`rotomdry10a`) | Client B (`rotomdry10b`, seed `…-b`) |
|---|---|---|
| Series / games | 10 / 22 | 10 / 22 |
| Arms (A = miltank 1.5 s cap, B = prior) | A 3, B 7 | A 6, B 4 |
| Teams played | L1 2, L2 1, L3 2, L4 1, L5 4 | L1 2, L2 5, L4 2, L5 1 |
| Decisions (miltank / prior / heuristic) | 105 / 141 / 0 | 176 / 74 / 1 |
| Timeouts / invalid / crashed sets / uncaught | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Guard checks / pauses | 5 / 1 | 6 / 1 |
| Drill | socket drop 5 s at set 2 g1 t3 → recovered | process crash at set 4 g1 t2 → watchdog restart → resumed |
| Login-stub assertions | 2 (start + after the drop) | 2 (start + after the restart) |
| Outbound non-loopback attempts | **0** | **0** |

One fallback, counted and not silent: B series k=9, one move where no MEDICHAM joint mapped onto the request. MILTANK and
prior both threw, and the request heuristic played a legal move. This is the known v0 world gap (`2026-09-24-rotom-v0.md`
§6).

**Zero public traffic.** Each process runs the guard: 1 supervisor, 1 + 2 client processes, and 10 server processes (main,
sockets, room-battle, verifier, team-validator, friends, artemis ×2, battlesearch …). Refused, all from the local server,
none from our code: `check.torproject.org:443` ×2 (the server's Tor exit list), `play.pokemonshowdown.com:80` ×1
(`invalidatecss` to the login server), and **`pokemonshowdown.com:443` ×6 at start-up**. The replay branch's harness
redirects only the login server and the replay route, so **an unguarded local server still makes the Tor and
`pokemonshowdown.com` requests.** That is a finding for the merge (§5).

The rating lines were captured in all 20 rows. E ranged 0.38–0.62 as the local ratings moved. **No residual or rating here
is a result**: the arms are capped for speed and the two clients play each other.

## 4. What the dry run does NOT prove

- The public login server's real response shape (the stub mirrors `engine/mag_bot.js`'s parse: `]` + JSON, `assertion`).
- Public matchmaking latency, and the public `ladders-remote` rating line (the same text per the replay report,
  `ladders-remote.ts:93`).
- Whether a public `/crq userdetails` is rate-limited at one query per minute (it is a standard client query).

The recommended first public run is the A/A placebo with Will watching (LADDER.md §2).

## 5. Merge notes (for the coordinator)

- **The rebase onto the replay branch was not done.** A `git reset --hard` and then a `git merge --ff-only` onto
  `worktree-agent-aaad843e454853440` were both refused by the permission classifier. I did the other option: the dry run
  sends zero public traffic, proved by the NET test and by the guard logs. The two branches both edit `solver/rotom/rotom.js`
  and `run_local.js`-style harness code. My rotom.js changes are small hooks: the engine load, the guards, the `LADDER.*`
  calls in `handle`, `handleBestof`, `handleBattle` and `decide`, `exitClean`, SIGINT, and the leave delay. Expect textual
  conflicts in `handleBattle`/`endBattle` (both branches hold the finished room for the rating line).
- **Unify at merge.** Use one rating-line parser: `replay.js`'s or `ladder.parseRatingLine`, not both. Keep one room-hold
  after `|win|`: the replay saver's, which already waits up to 15 s for a rated series' rating. In ladder mode, call the
  replay save and the `games.jsonl` record from their code. Nothing here writes replays or `games.jsonl`.
- **Load both preloads in the dry run**: theirs (`local_server_preload.js`, which re-points the login server and replays at the
  stand-in) and `netguard.js` (which refuses the rest). Put the guard into `run_local.js` too, because of the Tor and
  `pokemonshowdown.com` calls above.
- `rotom.js`'s crash drill now exits **70**, not 3 (3 is "lock held", final for the supervisor). `run_local.js` restarts
  any non-zero code, so it is unaffected. The v0 report's "exits (code 3)" describes the old code.

## 6. Owed / left in place

- `node engine/status.js --write` must be run from the main checkout at merge. It was not run from this worktree.
- **A file I created outside the repo:** `pokemon-showdown-mc/config/ladders/gen9championsvgc2026regmcbo3.tsv` (390 B,
  gitignored in the checkout). It is the local ladder's ratings for the dry-run names. It is harmless and was left in place.
- I copied `data/releases/eaa5becc54eb/` into this worktree (gitignored) so the worktree could open the release.
- `solver/out/rotom/run-2026-09-25T06-23-00-809Z/` is an empty run dir that `test-rotom.js`'s GUARD case creates. It was left in place.
- Not built: HYPNO, so there is no ε arm yet. An arm is only `{policy, max_ms, preview_max_ms}` for now. The worker pool
  is not wired into the live client (v0).
