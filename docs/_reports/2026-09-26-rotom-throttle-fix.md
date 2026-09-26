# ROTOM: the message throttle, the orphaned live series, and chosen-vs-applied for every decision

Date: 2026-09-26. SOLVER. Line `abra/regmc` 1.14.0. Historical findings record, not maintained. The defect account is
`docs/_reports/2026-09-26-orphaned-series-k16.md`; this is the fix.

## Verdict

1. **Fixed: the throttle no longer drops our choices.** `send()` now goes through a paced queue
   (`solver/rotom/sendq.js`) that mirrors the server's own queue (one message per 650 ms, the server's backlog of ours
   kept at one), with battle choices and the timer first. A `message-throttle-notice` is counted and the open choice is
   re-sent. On a local server with the throttle turned ON, the 5-series dry run had **0 notices, 0 preview
   mismatches (26 of 26 applied) and 0 mismatches in 787 checks** (below).
2. **Fixed: an alive series we are in is never orphaned.** "Alive, and we are in it" is life: the watch re-sends the
   timer and the open choice and keeps waiting. Orphaning is left to rooms that are gone or probes that go unanswered.
3. **Fixed: an orphan can no longer run beside the next series.** A live battle of an orphaned series stays tracked and
   played; `openSeries()` counts every live battle, so **no search goes out while any battle we are in is live**. An
   orphan that speaks again is taken back and gets its row. Nothing is ever forfeited.
4. **New: chosen vs applied for every decision** (`solver/rotom/applied.js`). Preview bring and leads, each move and
   target, mega, switches, forced switches, the team and the timer are checked against what the server reported. A
   difference the log explains is counted as explained; anything else is a MISMATCH: an event, a ladder error, a
   series-row column, a per-game block in `games.jsonl`, and after `--max-mismatches` (default 3) the ladder halts.
   The check runs after our choice is on the wire: **0 ms of decision time; 0.8–0.9 ms per turn** of idle time.
5. **aa1 and aa2, re-read offline:** only the preview was hurt. **0 of 1,401 non-preview checks** (467 aa1 + 934 aa2)
   were mismatches; every throttle notice in both runs fell before turn 1. Previews defaulted by the server: 3 of 22
   aa1 games, 14 of 41 aa2 games.

## What changed

| File | Change |
|---|---|
| `solver/rotom/sendq.js` (new) | The paced queue. Classes: 0 = `/choose` `/undo` `/confirmready` `/timer` `/trn`; 1 = room traffic; 2 = lobby. A frame is written only while the predicted server backlog of ours is ≤ `ahead` (0). A lower-class frame that has waited 4 s may go once between two choices. Frames still queued at a disconnect are counted (`cleared`). |
| `solver/rotom/rotom.js` | `send()` = `SENDQ.send()`, `--send-gap-ms` (650). Throttle notices handled (`onThrottle`): counted, the open choice re-sent (≤ 3 per request), idempotent frames re-sent, a dropped `/utm`/`/search` re-runs the search step. A resend the server already had ("too late", "nothing to choose", "Can't undo") is counted as redundant, never as invalid. One `/join` in flight per room. A stale battle the server no longer lists is dropped (logged). The series watch repairs an alive series (`repairSeries`). `orphanSeries` keeps live battles, leaves finished ones; `unorphanSeries`. `openSeries()` counts live battles outside any open series. Chosen-vs-applied: `closePending` at each `|turn|`, the next request attached as the second witness, `runVerify` after the choice is sent / on a wait request / at game end, `recordVerdict`. The team check (the sheet the server shows vs the series' `/utm`). The decision log field `sent` became `queued`. Summary: `applied`, `preview`, `throttle`, `send_queue`, `applied_cost`. The ladder's `exitClean` waits (bounded, as `checkDone`) for a game record whose replay save is still in flight. |
| `solver/rotom/applied.js` (new) | The verifier. Pure functions over (request, choice, the turn's public lines, the next request). Explanations are read from lines only. The redirect move and ability sets are derived from the format, filtered to the regulation. |
| `solver/rotom/applied_audit.js` (new) | The same check offline over a finished run, reconstructing each request from the open sheet and the server's switch rule. |
| `solver/rotom/ladder.js` | `stallAction` never orphans a series that answered alive within a probe cycle. `onMismatch` (error at once, halt at `--max-mismatches`), `onSeriesResume`, `redoSearch`. Series rows gain `applied_checks`, `applied_mismatch`, `preview_mismatch`, `throttle_notices`; a row with a mismatch is never "clean". |
| `solver/rotom/local_server_preload.js`, `local_server.js`, `run_ladder.js` | `--throttle`: the local server's message throttle ON (`--no-security` turns it off, which is why no local run ever saw the aa2 drops). `ladder-report.json` `server_throttle` proves it. `--max-mismatches` and `--send-gap-ms` passed through. The dry-run server pid is now recorded in `pids.json` (it was `null`, so `--kill` could not name it). |
| `solver/rotom/report.js` | Per-game and total chosen-vs-applied in `games` mode; throttle and queue counters per client. |
| `solver/rotom/LADDER.md` | §2 pacing and checks, §4 the new orphan rule, §7 `--throttle`. |

## Tests

| Test | Result |
|---|---|
| `solver/tests/test-rotom-throttle.js` (new) | **GREEN 33/33.** Part A replays the k=16 burst on simulated time through `solver/tests/throttle_model.js` (a line-for-line port of `users.ts` `chat`/`processChatQueue`): unpaced, the server drops the battle's `/timer on` and `/choose` (the run's two notices); paced, 0 drops. Part B runs the real client against a scripted server that puts every frame through the model and plays every game on the checkout's own simulator (`BattleStream`, `RandomPlayerAI`): K16 (the silent preview, alive probes), NOTICE (a dropped `/choose` must be re-sent), CONTROL (the deliberate break: the server applies a different team order; the verifier must say MISMATCH), RATE (0 mismatches outside the planted one). |
| the same test on the **pre-fix client** (`ROTOM_TEST_CLIENT` = `git show HEAD:solver/rotom/rotom.js`) | **RED 9/19.** "the server applied OUR pick: applied nothing — the server default, chosen 2143; dropped: ["/choose team 2143\|1"]", the alive series orphaned ("silent 9 s through 2 … probes"), a `/search` while its battle was live, no preview check, no record. |
| `solver/tests/test-rotom-applied.js` (new) | **GREEN 31/31**: every verdict, the three shapes the first dry run taught (spread, charge turn, `[from] lockedmove`), and the BREAK clauses (a different move, target, body, a missing or unasked mega, a defaulted preview, an unacknowledged timer) must read MISMATCH. |
| `solver/tests/test-rotom-private-series.js` | **GREEN 25/25.** SILENT rewritten: a room that answers alive with us in it is NOT orphaned, no search until it ends (was: orphaned). New UNANSWERED: unanswered probes are orphaned. |
| `solver/tests/test-rotom-ladder.js` | **GREEN 114/114** (+8: the alive rule, the resume row, onMismatch, the halt). |
| `test-rotom` 86/86, `test-rotom-replays` 41/41, `test-rotom-localnet` 4/4 | GREEN. |

**The real server throttles as the model says.** A local server started with `throttle: true`: 9 messages at once →
6 processed, 3 notices. The same without it: 9 processed, 0 notices (scratch probe, this session).

## The 5-series local dry run, throttle ON

`node solver/rotom/run_ladder.js --dry-run --throttle --release eaa5becc54eb --arms solver/rotom/arms/dryrun-fast.json
--ladder-seed throttle-fix-2026-09-26 --sets 5 --port 8795 --tag drythr --out solver/out/rotom/dry-throttle-2026-09-26`
(two clients, both on this code; `dryrun-fast` arms: A = MILTANK capped at 1.5 s, B = prior).

| | result (`ladder-report.json`) |
|---|---|
| server throttle ON | yes: 2 server processes logged `throttle_on` (`server_throttle`) |
| series / rows / rated | 5 / 10 / 10; wall 331 s; 13 games |
| **throttle notices** | **0** (both clients) |
| **preview mismatches** | **0**: 26 of 26 previews applied (13 per client) |
| chosen vs applied, all kinds | 787 checks in 26 game records: applied 721, explained 66, **MISMATCH 0**, unverifiable 0 |
| by kind (checks/applied/explained/mismatch) | team 26/26/0/0 · preview 26/26/0/0 · move 370/330/40/0 · target 205/179/26/0 · mega 26/26/0/0 · switch 62/62/0/0 · forced 46/46/0/0 · timer 26/26/0/0 |
| explained by | faint 25, no target printed 8, cant 13, target already empty 13, target fainted 2, redirected 3, the game ended 2 |
| invalid / timeouts / crashed sets / uncaught | 0 / 0 / 0 / 0 |
| orphans / ladder errors / halts | 0 / 0 / none |
| replays / game records | 26 saved / 26 (the previous attempt left 1 record pending at the ladder's exit; `exitClean` now waits for it, bounded) |
| public connects blocked | 0 |
| send queue (A / B) | 239 / 236 frames; server backlog of ours never above 1; 0 cleared. Wait by class, mean (max): choices+timer 209 ms (3.4 s) / 237 ms (3.5 s); room traffic 2.5 s (6.6 s) / 2.0 s (5.9 s); lobby 0.5 s (1.3 s) / 0.3 s (1.3 s) |

**Three earlier attempts, kept on disk, not results:** `…-attempt1-verifier-false-positives` halted on 3 mismatches
that were the VERIFIER, not the server: a move turned spread by Psychic Terrain, a charge turn that prints no target,
and a `[from] lockedmove` second turn. Each is now a unit clause. `…-attempt2-sendq-v1` (0 mismatches, 0 notices in 750
checks over 25 records) ran the first queue, which let a choice wait up to 5.5 s behind aged lobby frames; the queue was
rewritten (mirror of the server's backlog, aging bounded to one frame between two choices). `…-attempt3-last-record-pending`
(0 mismatches in 740 checks) exited with its last game's record still pending; `exitClean` now waits for it.

## aa1 and aa2, offline (read only)

`node solver/rotom/applied_audit.js <run dir>` over `solver/out/rotom/aa1-2026-09-25T21-00-29-440Z` and
`aa2-2026-09-25T23-54-09-059Z` (the main checkout's run directories, nothing written there).

| | aa1 | aa2 |
|---|---|---|
| games | 22 | 41 |
| throttle notices before turn 1 / after | 7 (4 games) / **0** | 23 (14 games) / **0** |
| previews the server defaulted (slots 1–4, leads 1+2) | 3 | 14 |
| preview checks: applied / mismatch / unverifiable | 18 / 3 / 1 | 26 / 14 / 1 |
| **non-preview checks: applied / explained / MISMATCH** | 412 / 55 / **0** of 467 | 846 / 88 / **0** of 934 |
| non-preview checks by kind (aa2) | | move 509, target 252, switch 63, mega 38, forced 72 |

So the throttle hit the preview window only; no later choice in either run was lost. Explained differences (both
runs): faints 83, `|cant|` 20, a target already down 13, redirection 9, the game ending 9, spread 6, no target
printed 3, and one aa2 switch.

Limits of the offline check, stated: the requests are reconstructed (the chosen order when the log's leads are the
chosen leads, the default when they are slots 1+2), not read; there is no second witness; and **the timer cannot be
audited offline** because our game logs do not keep `|inactive|` lines (rotom.js returns before storing them). The k=16
report found the timer dropped with the preview in throttled games; from 1.14.0 the live check covers it.

The first offline pass read 23 and 15 non-preview "mismatches". They were the audit's own reconstruction: a body with
no nickname is named by its base species in the protocol, so a regional forme's sheet name never matched its log name
and every later position was off by one. Fixed in the audit; the live client reads the request and never had it.

## Cost of the check (Will's constraint: zero added decision latency)

The check never runs inside `decide()`. At a `|turn|` it only records where the turn's lines start and end (O(1)); the
next request is attached when it arrives (O(1)); the verification itself runs in a `setImmediate` after our choice is
written, on a wait request, or at game end. Measured in `summary-*.json` `applied_cost` over the final dry run: client
A 128 runs, **0.89 ms mean**, 14.5 ms max, 114 ms in total over 13 games; client B 128 runs, **0.78 ms mean**, 7.0 ms
max. Added decision latency: **0** by construction (no code on the decision path; `decide()` only pushes one record).
The redirect sets are derived from the format once at start-up, not on the first turn that needs them.

## Owed / open

- **k=16 of aa2 still needs its hand-recorded row or an exclusion** (the k=16 report's "Owed"). Not done here; the run
  directory belongs to the main checkout.
- A public ladder run is Will's call. Nothing here launched one.
- A class-0 frame (a choice, the timer, a confirm) waited up to 3.5 s in the dry run (mean 0.2 s). Which frame is not recorded; a game start queues
  two timers, a confirm and the preview together, the likely source. Watch `send_queue.wait_ms[0]`
  on the first public run. The queue's class-1 waits (joins, leaves, saves) run to several seconds when a series ends and the next begins; they
  hold nothing that matters for the clock. Watch `send_queue.wait_ms` on the first public run.
