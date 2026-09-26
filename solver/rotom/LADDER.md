# ROTOM ladder mode — launch runbook

For Will or the coordinator. **A public launch spends a real rating on `medicham32`. It is Will's call,
every time.** SOLVER prepares the run and hands over the command; it never starts one.

Format: `gen9championsvgc2026regmcbo3` (Force Open Team Sheets, Best of 3). Code: `solver/rotom/ladder.js`
(the loop and its safety), `solver/rotom/rotom.js --ladder` (the client), `solver/rotom/run_ladder.js`
(the supervisor, watchdog, stop and kill). Full account: `docs/_reports/2026-09-25-rotom-ladder-mode.md`.

## 1. Before every public launch

| Check | How |
|---|---|
| **willhoop is not on Showdown** — not laddering, not logged in anywhere | Log out of every tab and device. The client pauses while `willhoop` is connected at all (section 5), but a search in progress cannot be seen, so do not rely on the guard alone. |
| The password is in `data/.showdown-pass` | The file exists and holds one line. Ladder mode reads only this file, never an env var or argv, and never prints it. |
| The run is from the **main checkout**, not a worktree | `cd C:\Users\willj\Projects\Pokemon\ABRA` |
| The frozen release is on disk | `node engine/engine_release.js list` shows `eaa5becc54eb`. Ladder mode refuses any release cut before it (PRE-GATE). |
| No STOP or KILL file is left over | `dir solver\out\rotom\STOP solver\out\rotom\KILL` finds nothing. A fresh run refuses to start while one exists. |
| Tests green | `node solver/tests/test-rotom-ladder.js` and `node solver/tests/test-rotom.js` |
| The rotation is current | `solver/rotom/teams/ladder-rotation.json`: 5 teams, one per stable Reg M-C archetype, each passed Showdown's TeamValidator. The client re-validates every team at start-up and refuses to start on a failure. Rebuild with `node solver/rotom/build_ladder_teams.js` (then commit it) only between runs, because the plan digest includes the rotation. |

## 2. Start (public ladder)

One command, in a plain `cmd` window you leave open. Choose the arms file and a **new seed** for a new run.
The seed, arms file and rotation are committed to the run's state before the first search. A restart with
different ones is refused.

**Recommended first run: the A/A placebo, 10 series, with Will watching.** It checks the login, the search,
the rating capture and the per-arm bookkeeping on the real server before a real A/B spends series.

```cmd
cd C:\Users\willj\Projects\Pokemon\ABRA
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\aa-miltank.json --ladder-seed medicham32-aa-2026-09-25 --sets 10 --tag aa1 --priority normal
```

The A/B run, once the A/A reads clean (pre-registered in the arms file: SPRT on the mean per-series residual
`S − E`, H0 0 vs H1 +0.07, alpha = beta = 0.05, read once at a bound, burn-in below a 1300 rating):

```cmd
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\miltank-vs-prior.json --ladder-seed medicham32-ab1-2026-09-25 --sets 50 --tag ab1 --priority normal
```

The gen5 A/B (added 2026-09-26): arm A is the MACHAMP gen5 champion through ROTOM's `miltank-gen5` policy at 5 s, with
XATU's belief exactly as the honest arena measured it (`docs/_reports/2026-09-26-gen5-honest-and-ladder-prep.md`); arm B
is `prior`. Same pre-registered SPRT on the per-series residual. The paced send and the chosen-vs-applied check
(abra/regmc 1.14.0, below) apply to it as to every arm:

```cmd
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\gen5-vs-prior.json --ladder-seed medicham32-gen5ab-2026-09-26 --sets 50 --tag gen5ab --priority normal
```

**`--priority normal` (added 2026-09-25).** The clients start through `tools\lownode.cmd` at BELOW_NORMAL. A client that
searches must not be starved by other normal-priority work, so it raises its own decider to NORMAL. MILTANK's pool
workers stay BELOW_NORMAL. MILTANK bounds its own decision (budget + 0.5 s), but it cannot bound a process that the
OS does not run (`docs/_reports/2026-09-25-miltank-deadline.md`). The summary records `priority` and `priority_set`.

**The adaptive clock (added 2026-09-27, `solver/rotom/adaptive.js`).** An arm may carry `"adaptive": { "targetMs": 4500 }`
(or the client `--adaptive-target-ms 4500`). A searching move is then planned around that mean: it stops early when one
candidate beats the others beyond noise, runs to the soft line when nothing is close, and runs up to twice the target when
two candidates are within noise, paid for by the time the clear decisions saved in the same game. The bank the server
reports still binds it: a decision may take at most two fair shares of the bank left after 30 s and 1 s per expected
request, and never more than the turn less 8 s. Under that line the move is `prior`, counted. With neither set, the budget is
the clock's fixed share as before. The arena measurement and the SPRT against a fixed 5 s are in
`docs/_reports/2026-09-27-adaptive-clock.md`. No arms file uses it yet: switching arm A to it is a new pre-registration.

Optional flags: `--max-hours H` (no new search after H hours), `--max-errors N` (default 3),
`--max-mismatches N` (default 3; see below), `--send-gap-ms MS` (default 650),
`--guard willhoop[,other]`, `--guard-mode online|battle` (default `online`), `--out <dir>` (resume a run).

**Every message is paced, and every choice is checked (2026-09-26, abra/regmc 1.14.0; `docs/_reports/2026-09-26-rotom-throttle-fix.md`).**
Showdown processes one message per 600 ms per account and queues five; the next one is DROPPED with a notice. In aa2
that dropped the game-1 team preview in 14 of 17 series. The client now sends at most one message per 650 ms, battle
choices and the timer first (`solver/rotom/sendq.js`); a throttle notice is counted and the open choice re-sent. After
every turn the client reads what the server actually did (`|move|`, `|switch|`, `|-mega|`, `|cant|`, the next request) and
compares it with what it chose (`solver/rotom/applied.js`): preview bring and leads, each move and target, mega,
switches, forced switches, the timer. A difference the log explains (flinch, sleep, a faint, a redirection, an Encore,
a target already down) is counted as explained; anything else is a MISMATCH: an `applied_mismatch` event, a ladder
error, a column in the series row (`during_series.applied_mismatch`, `preview_mismatch`), and after `--max-mismatches`
of them the ladder HALTS (the open series is played out; exit 4). The check runs after the choice is sent, never inside
the decision budget. `node solver\rotom\report.js games <run dir>\games.jsonl --include-local` prints it per game.

The run directory is `solver\out\rotom\<tag>-<timestamp>\`. Its first lines name it.

## 3. Stop

| What you want | Command | What happens |
|---|---|---|
| **Stop after this series** (normal) | `node solver\rotom\run_ladder.js --stop` | Writes `solver\out\rotom\STOP`. A search in progress is cancelled. An open series is played to the end. No new search. The client exits 0. **Delete the file before the next start:** `del solver\out\rotom\STOP` |
| Stop after this series, from the keyboard | `Ctrl+C` once in the run window | The same as STOP. |
| **Stop NOW** (emergency: staff asked, Will must play now) | `node solver\rotom\run_ladder.js --kill --out solver\out\rotom\<run dir>` | Kills the supervisor, client and their children **by the pids the run recorded** (`pids.json`), never by image name. **An open game is left to the server's timer and will likely be lost.** This is the only way ROTOM ever loses a game it did not play. Equivalent: create `solver\out\rotom\KILL`, or press Ctrl+C twice. |

The ladder also stops by itself when it reaches `--sets`, when `--max-hours` passes, or after
`--max-errors` consecutive errors (it then exits with code 4, "HALTED", and is not restarted).

## 4. Resume after a crash

The supervisor restarts a crashed client (up to 5 times). The client logs in again, rejoins the open series,
and plays on. It never forfeits. If the supervisor itself died, rerun the **same** command with
`--out solver\out\rotom\<run dir>` added. The same seed, arms and rotation are required.

**A hung client heals itself too (2026-09-25, after the aa1 hangs).** Nobody restarts the bot, so two layers:

- **In the client, every wait is bounded.** An open series that sends nothing for 150 s is probed with
  `/crq roominfo`. **If the room answers "alive, and we are in it", the series is never orphaned** (2026-09-26: aa2 k=16
  was, and its games went on untracked beside the next series): the client re-sends the timer and the open choice and
  keeps waiting; the server's timer bounds the game. If the room is gone, or the probes go unanswered, the series is
  **orphaned**: it is logged, counted as a ladder error (3 in a row halt the run) and gets no row; a battle of it that is
  still live stays tracked and played, and **no search goes out while any battle the client is in is live**. An orphan
  that speaks again is taken back and gets its row. Nothing is ever forfeited. A search older than
  20 min is cancelled and re-sent. An open socket that is not logged in after 90 s is dropped and logged in again.
- **In the supervisor, a watchdog** (`solver/rotom/watchdog.js`). If a client makes no progress (no search, decision,
  game message or guard answer) for `--hang-min` minutes (default 10) **and no game is open**, the supervisor kills
  that client by its pid, writes an incident to `<run dir>\supervisor-incidents.jsonl`, and relaunches it through the
  crash-resume path. It never fires with a game open. `--hang-min 0` turns it off. `--max-hang-restarts` (default 20)
  caps it.
- **Private series.** A series whose opponent hides the room is renamed `<id>-<31 chars>pw`, and the server lists both
  ids. The client now treats the old id as the same series, never a new one. That phantom series was the cause of both
  aa1 hangs (`docs/_reports/2026-09-25-rotom-series-hang.md`).

## 5. What the two-account guard can and cannot see

- **A machine-wide lock**: two ABRA clients can never be on the public server at once from this machine.
- **Before every search, and every 60 s while searching**, the client asks the server
  `/crq userdetails willhoop`. The server says whether the account is connected, and lists its battles
  unless it hides them from its trainer card. In `online` mode (the default) the client pauses while
  `willhoop` is connected at all and resumes when it is gone. No answer within 15 s counts as "not clear".
- **The gap: a ladder search in progress is invisible to everyone.** If willhoop searches from another
  device while the bot searches, the server could pair them. The guard lowers that risk to "willhoop
  connected but not seen". It does not remove it. **Rule: log willhoop out before a launch.**
- If the opponent is ever a guarded account, the incident is logged, the series is played out normally
  (a forfeit to yourself is exactly the rule 4 violation), and the ladder stops after it.

## 6. Read a run (no permission needed)

- `ladder-series-medicham32.jsonl`: one row per series with `k`, arm and arm config, team, opponent, both
  ratings before and after, `S`, `E`, `residual`, the fallback, invalid and timeout counts during that series,
  the release stamp and the plan digest.
- `ladder-report.json`: the totals, rows by arm and team, the guard pauses and incidents, and `record`: the rated
  record per client with and without the opponent's quits.
- **How each series ended**: every row carries `end_reason` (normal, forfeit_opp, timeout_opp, walkaway_opp, …) and
  `games_end[]` (`solver/rotom/endings.js`). `node solver\rotom\report.js ladder <run dir>` prints the record
  **rated series only**, with and without the series the opponent handed us, per arm. A run recorded before
  abra/regmc 1.17.0 is read from `ladder-series-medicham32.ends.jsonl` (`node solver\rotom\backfill_ends.js <run dir>`).
- **Our own forfeit, timeout or walkaway (`forfeit_me`, `timeout_me`, `inactivity`, `walkaway_me`) must be 0.** One
  halts the ladder (`self_quit` event, `ladder_halt`, exit 4) and is a client bug to find before any restart.
- The headline is the **mean rating over the last N ≥ 100 series ± SD**, never the peak. The A/B is read by
  the pre-registered SPRT **once, at a bound**. Series below a 1300 pre-series rating are burn-in.

## 7. Dry run (local, needs no permission)

The same client code path against a local `pokemon-showdown-mc`: the same challstr → assertion login (against
a local stand-in whose key the local server verifies), `/utm` + `/search`, the rotation, the arms and the guard.
Every process in the run (supervisor, both clients, the server and each process it forks) refuses every
non-loopback connection (`solver/rotom/netguard.js`), and `ladder-report.json` counts what was blocked.

```cmd
node solver\rotom\run_ladder.js --dry-run --release eaa5becc54eb --arms solver\rotom\arms\dryrun-fast.json --ladder-seed dry-1 --sets 10 --guard-window 0:60 --tag dry10
```

`--guard-window a:b` puts a local `willhoop` online from second a to second b, so both clients must pause
and then resume. `--hide-a` / `--hide-b` make that side send `/hidenext` before each search, so every series is a
PRIVATE room (the aa1 hang shape). `--drill-a hang@S` makes client A stop moving after S sets, so the supervisor
watchdog must restart it (use a short `--hang-min`, e.g. 1.5). `dryrun-fast.json` caps the search for speed and is refused on `--public`.
`--throttle` turns the server's message throttle ON (a `--no-security` server has it off, which is why no local run
ever saw the aa2 drops); `ladder-report.json` `server_throttle` proves it, and `games.applied` must read 0 mismatches.
