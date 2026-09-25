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
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\aa-miltank.json --ladder-seed medicham32-aa-2026-09-25 --sets 10 --tag aa1
```

The A/B run, once the A/A reads clean (pre-registered in the arms file: SPRT on the mean per-series residual
`S − E`, H0 0 vs H1 +0.07, alpha = beta = 0.05, read once at a bound, burn-in below a 1300 rating):

```cmd
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\miltank-vs-prior.json --ladder-seed medicham32-ab1-2026-09-25 --sets 50 --tag ab1
```

Optional flags: `--max-hours H` (no new search after H hours), `--max-errors N` (default 3),
`--guard willhoop[,other]`, `--guard-mode online|battle` (default `online`), `--out <dir>` (resume a run).

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
- `ladder-report.json`: the totals, rows by arm and team, the guard pauses and incidents.
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
and then resume. `dryrun-fast.json` caps the search for speed and is refused on `--public`.
