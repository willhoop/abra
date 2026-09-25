# ROTOM merge: replay saving + ladder mode, and a local server with zero public traffic

2026-09-25 · SOLVER · branch from `origin/main` `a085dd9f` · abra/regmc 1.1.0 (replays), 1.2.0 (ladder, renumbered
from 1.1.0), 1.3.0 (this merge).

## Verdict

Both branches are merged into one client. Ladder mode now calls the replay-save and `games.jsonl` hooks instead of
keeping its own copy. The local test server used to make **9 public connection attempts at start-up**. It now makes
**0**: `solver/tests/test-rotom-localnet.js` is GREEN 4/4, and was **RED on a deliberate break** (the local config
left out: 9 attempts, exit 1). A 3-series local ladder dry run played 7 games. It saved 14 of 14 replays and wrote
14 records, with 0 timeouts, 0 invalid choices and 0 public attempts in any of the 13 guarded processes. No public
ladder game was played.

## 1. The merge (`solver/rotom/rotom.js`, 5 conflict hunks)

- Both sets of flags were kept. The ladder guards now run **before** the own-account refusal, so a non-ladder
  account on `--public` gets the more specific refusal (`test-rotom-ladder` STARTUP expects it).
- **One room-hold.** The replay saver's `finalizeWhenReady` holds the room. In ladder mode it keeps the finished
  room for up to 22 s after `|win|` so the series' rating lines arrive. Before this, the finished-room branch
  returned early, so a rating line posted after the game ended never reached `LADDER.onRaw`. That branch now
  forwards the line.
- **One rating parser**: `ladder.parseRatingLine`, which decodes HTML entities and accepts decimals. `replay.js`
  re-exports it.
- `|player|` records the rating-before for the games record and also feeds `LADDER.onPlayer`. `|popup|` goes to the
  replay saver first. Ladder mode handles `queryresponse` and `nametaken`.
- Each game's record carries `ladder: { arm, dry_run, release }` when it was played in ladder mode.
- `run_ladder.js --dry-run` passes `--local-replays --games-file <out>/games.jsonl` to its clients.
  `ladder-report.json` gains `games` (from `report.gamesReport`) and `netguard.totals`.

## 2. The traffic hole

The first run used a stack-logging socket guard (scratch) in a stock local `pokemon-showdown-mc` (`f10d679`),
10 processes:

| Host | Count | Source | Config switch |
|---|---|---|---|
| `play.pokemonshowdown.com:80` | 1 | `server/loginserver.ts:195` `invalidatecss` at load (skipped only by `nofswriting`) | `Config.loginserver` |
| `pokemonshowdown.com:443` | 6 | `server/chat-plugins/seasons.ts:147` `getLadderTop`, from `rollTimer()` at module load and hourly: `https://${Config.routes.root}/ladder/...` | `Config.routes.root` |
| `check.torproject.org:443` | 2 | `server/ip-tools.ts:651` `void IPTools.updateTorRanges()` at module load; URL hard-coded at `:632` | **none** |
| (on demand) `/savereplay` | — | through the login server when there is no `replaysdb` | `Config.loginserver`, `Config.routes.replays` |

`Config.noNetRequests` exists (`lib/net.ts` `getStream`). It cannot be used here, because it also turns off the
login-server requests that local replay saving needs.

**Fix.** `solver/rotom/local_server_preload.js` is the harness's local config. It patches the checkout's
`config/config.js` exports in memory when they load. The checkout's file is never edited. The patch sets
`loginserver` to the local stand-in, `routes.root` to the stand-in's host and `routes.replays` to `<stand-in>/replay`.
The Tor fetch has no switch, so the preload wraps `lib/net`'s `NetStream.prototype.makeRequest` and refuses **that
host by name** before any socket opens (logged as `net_refused`). Any other public host still reaches the socket
guard and turns the test red. That is deliberate: a new, unswitched request must be seen, not absorbed.

`solver/rotom/local_server.js` is now the one start-up path. It starts the login stand-in on port+1 (and the
assertion stub for ladder dry runs), and preloads `netguard.js` + the local config into every server process through
`tools\lownode.cmd`. `stop()` kills only its own server tree, by pid. `run_local.js` and `run_ladder.js` use it; the
duplicate start-up code in `run_ladder.js` was removed.

## 3. The test (`solver/tests/test-rotom-localnet.js`)

The test starts a real server, logs a guest in, fetches the replay route, waits 45 s, and then reads every
`netguard-*.jsonl` file. It requires:

- 0 blocked non-loopback attempts;
- the guard running in 5 or more server processes;
- the config applied in at least 1 process;
- the Tor fetch seen and refused by name.

The last three conditions prove that the zero was actually looked for.

| Run | Result |
|---|---|
| `--break` (local config left out) | **RED 1/2, exit 1**: `check.torproject.org` ×2, `play.pokemonshowdown.com` ×1, `pokemonshowdown.com` ×6 |
| default | **GREEN 4/4**: 0 attempts, guard in 10 processes, config in 10, Tor refused ×2 |
| `--run` on the 3-series dry run | **GREEN 4/4**: 0 attempts across 13 processes (server 10, clients 2, supervisor 1) |

## 4. Tests run (all through `tools\lownode.cmd`)

| Test | Result |
|---|---|
| `solver/tests/test-rotom.js` | GREEN 86/86 |
| `solver/tests/test-rotom-ladder.js` | GREEN 77/77 (after the release copy and the guard reorder, below) |
| `solver/tests/test-rotom-replays.js` | GREEN 41/41 (the preload clause now expects `routes.root` re-pointed) |
| `solver/tests/test-rotom-localnet.js` | GREEN 4/4; RED on `--break` |
| `tests/test-docs-current.js` | 39 passed, 0 failed |

On the first run of `test-rotom-ladder`, 2 STARTUP clauses were RED because release `eaa5becc54eb` was not on disk
in this worktree (`data/releases/` is gitignored). The release was copied from the main checkout (read only).
After that, 1 clause was RED, from the guard order described in §1. It was fixed.

**Dry run.** `run_ladder.js --dry-run --tag merge3 --sets 3 --port 8797 --release eaa5becc54eb --arms
solver/rotom/arms/dryrun-fast.json --ladder-seed merge3-2026-09-25 --timeout-min 90`. Results:

- 208 s; 3 of 3 series finished, 7 games;
- 0 timeouts, 0 invalid choices, 0 crashed sets, 0 restarts;
- 6 series rows (one per client per series), all rated;
- replays: 14 saved, 0 failed, 0 skipped. Both clients saved each game, so there are 7 replay files; the stand-in
  counted `addreplay` ×14 and `invalidatecss` ×1;
- 14 `games.jsonl` records: 14 with the `ladder` field, 6 with `rating_after` (the deciding games).

Output: `solver/out/rotom/merge3-2026-09-25T07-10-54-439Z/`. It is a harness check. The capped arms make it not a
strength figure.

## 5. Versioning

Main's top version was 1.0.0. Ladder mode had claimed 1.1.0. The versions are now in merge order: **1.1.0** replay
saving (its CHANGELOG and RUNNING-NOTES rows were owed and are now written), **1.2.0** ladder mode (renumbered), and
**1.3.0** this merge and the traffic fix. Every row says `Basis. unchanged`, and no figure is superseded.

## 6. Left in place / owed

- Scratch probe files are in the session scratchpad, not the repo.
- `data/releases/eaa5becc54eb/` was copied into this worktree (gitignored).
- `node engine/status.js --write` must run from the main checkout. It was not run from this worktree, because another
  agent is measuring there.
- `pokemon-showdown-mc/config/ladders/gen9championsvgc2026regmcbo3.tsv` now also holds the `rotommerge3*` names
  (a local ladder file, gitignored in the checkout).
