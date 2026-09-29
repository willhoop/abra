# CHOMP v1 on the ladder: the run is prepared, not launched (abra/regmc 1.30.0)

2026-09-30 (work done 2026-09-29). SOLVER. Historical findings record, not a living document. **No game was played on
the public server, and no local game was played.** One scripted preview was answered by the real client against a
local stand-in server (§3).

## 0. Verdict

- **Ready after one merge.** The launch as the CHOMP v1 report wrote it would NOT have played CHOMP.
  `solver/rotom/run_ladder.js` forwards a fixed list of flags to the ladder client, and `--preview` was not on it. So
  `run_ladder.js ... --preview chomp` would have played the rotation team's own human bring on every preview, and
  nothing would have reported it. This is fixed on this branch. **Merge it to main before the launch.**
- **The preview now lives in the arms file.** An arm may carry `"preview": "chomp"`. It is then in the plan digest and
  in every series row's `arm_config`, not only in a client flag. The run is `solver/rotom/arms/gen5-chomp.json`: one
  arm, gen5 at a fixed 5 s exactly as gen5ab arm A, with CHOMP v1 at preview.
- **Proof that CHOMP's choice is SENT.** New `solver/tests/test-rotom-chomp-live.js`: the real client plays that arms
  file against a scripted local server that sends a real Reg M-C preview. The client sends
  `/choose team 3416|3` to the battle room. The choice is legal. The decision record says CHOMP answered it (model
  `chomp1.json`, 518 ms, no fallback chain). The row carries `preview: "chomp"`. GREEN 13/13, RED on both breaks.
- **A 20-series run is a readiness run, not a strength test.** It shows that CHOMP picks are chosen and applied on
  the real server, with no self-quits. It cannot show that CHOMP helps (§5).

## 1. What was wrong, and what changed

| file | change |
|---|---|
| `solver/rotom/run_ladder.js` | `PASS` now also forwards `preview`, `preview-max-ms`, `adaptive-target-ms`. Before, all three were dropped with no warning. |
| `solver/rotom/rotom.js` | An arm's `preview` (`policy` or `chomp`) is validated at start-up, used at the decision (`PV`), and triggers the CHOMP warm-up. Every preview decision records `preview_mode`. The summary gains `preview_by` (which policy answered each preview). **A CHOMP preview is no longer counted as the fallback `used:chomp`.** Before, every CHOMP preview added one to the fallbacks, so a ladder row would have shown fallbacks on every series. CHOMP failing is still counted (`chomp:threw`, `chomp:illegal`), and so is the policy that answered instead. |
| `solver/rotom/arms/gen5-chomp.json` (new) | One arm A: `miltank-gen5`, `max_ms` 5000, `preview: "chomp"`, `preview_max_ms` 20000. Readiness bars are written in the file. `sprt: null`. |
| `solver/tests/test-rotom-chomp-live.js` (new) | §3. |
| `solver/rotom/LADDER.md` | The command, and what an arm's `preview` means. |

**Why a fixed 5 s and not the adaptive clock.** The adaptive clock landed as "not worse at 23% less time" (SPRT H0 at
748 games, 0.491 [0.455, 0.526]; `docs/_reports/2026-09-27-adaptive-clock.md`). That is not proven equal. With a fixed
5 s, this arm differs from gen5ab arm A (the 3–11 run) in one setting only, the preview. The adaptive version is one
field (`"adaptive": { "targetMs": 4500 }`) if Will prefers it; it would then differ in two.

Other code differences since gen5ab (2026-09-26), which also separate this run from the 3–11 one: ROTOM's world now
carries the consecutive-Protect counter (abra/regmc 1.20.0). The repeat-Protect fix is NOT deployed (flags off), and
weighted chance is off. The gen5 spec (`solver/machamp/league/gen5.json`) is unchanged.

## 2. Readiness checks (light; no server connection)

Run in this worktree, one at a time, at BELOW_NORMAL through a node launcher that sets its own priority
(`cmd.exe` is refused in this sandbox). `SHOWDOWN_PATH` set to the M-C checkout. Output read, not only exit codes.

| test | result |
|---|---|
| `solver/tests/test-rotom.js` | GREEN 105/105 |
| `solver/tests/test-rotom-ladder.js` | GREEN 114/114 |
| `solver/tests/test-chomp1.js` | GREEN 32/32, all 6 breaks RED |
| `solver/tests/test-rotom-applied.js` (chosen vs applied) | GREEN 31/31 |
| `solver/tests/test-rotom-throttle.js` (the paced send) | GREEN 33/33 |
| `solver/tests/test-rotom-endings.js` (end reasons, self-quit halt) | GREEN 59/59 |
| `solver/tests/test-rotom-private-series.js` (the `pw` rename) | GREEN 25/25 |
| `solver/tests/test-rotom-chomp-live.js` (new) | GREEN 13/13; `--break arm` RED 7/11, `--break pv` RED 8/11 |

Main-checkout pre-flight, read only: release `eaa5becc54eb` is on disk under `data/releases/`; `data/.showdown-pass`
exists and is not empty (not read); no `solver/out/rotom/STOP` or `KILL` is present.

**Not done: a full local dry run** (`run_ladder.js --dry-run --throttle`). It plays whole games, and this brief was to
play none. The throttle-on dry run after the send fix already showed 12 previews chosen and 12 applied with 0
mismatches (`docs/_reports/2026-09-26-gen5-honest-and-ladder-prep.md` §6). A CHOMP preview goes through the same
`send()` and the same `/choose team` string. The new test proves that the string is produced and sent. It does not
prove that a real server applied it. The live run's applied-vs-chosen counter is where that is read (§4).

## 3. The new test

`solver/tests/test-rotom-chomp-live.js`. It uses a scripted websocket server in the test process (127.0.0.1) and the
real `rotom.js --ladder --dry-run`. It plays the launch arms file itself, with a rotation of three copies of the
fixture's own team (regmc-pool T7), so the `/utm` team check agrees with the sheet.

| clause | what it checks | read |
|---|---|---|
| PREVIEW | the client sends `/choose team ....\|rqid` to the battle room; legal for the request | `team 3416`, rqid 3 |
| PREVIEW | decision `used: chomp`, `preview_mode: chomp`, arm A, policy `miltank-gen5`; `info.chomp`, a model, empty chain, choice = what was sent | model `chomp1.json`, "Primarina + Raichu / Rillaboom + Sneasler", p 1, 518 ms |
| ROW | the series row carries `arm_config.preview = chomp` | yes |
| SUMMARY | `preview_by = { chomp: 1 }`; no fallback key for the preview | `{}` |
| PASS | `run_ladder.js` forwards `preview`, `preview-max-ms`, `adaptive-target-ms` | yes |

Breaks (spawned by the default run, each must exit 1): `arm` (the arms file without `preview`) played the team's bring
(`used: miltank-gen5, mode: policy`); `pv` (a client that reads only the flag at the decision) played the bring with
`mode: chomp`. Both RED. The broken copy of `rotom.js` is deleted after the run.

## 4. How the result will be read

All by `node solver\rotom\report.js ladder <run dir>` and `ladder-report.json`. **Rated series only.**

1. **Record with and without the series the opponent handed us** (`forfeit_opp`, `timeout_opp`, `walkaway_opp`).
   Report both, and the mean residual `S − E` ± SD for both. Burn-in below 1300 is expected to be the whole run.
2. **The preview counters, per game and in total.** Every one must hold:
   - `summary-medicham32*.json` `preview_by`: `chomp` equals the number of preview decisions. Any other key is a
     CHOMP failure, and its cause is in `fallbacks` (`chomp:threw` / `chomp:illegal`).
   - `applied.by_kind.preview`: `chosen` = `applied` + `explained_diff`; `mismatch` 0; every row
     `during_series.preview_mismatch` 0. `node solver\rotom\report.js games <run dir>\games.jsonl --include-local`
     prints it per game.
   - The throttle: `throttle_notices` counted, and 0 dropped previews (a drop shows as a preview mismatch).
3. **Safety:** `self_quits` 0 (one halts the run, exit 4), `timeouts` 0, `invalid` 0, 0 ladder errors, 0 orphans. gen5
   move decisions searched; prior fallbacks stated with their count.
4. **Where the time went:** preview `decision_ms` (CHOMP was 518 ms on the fixture; the budget is min(clock, 20 s)).

## 5. What a comparison to the last ladder run needs

The last run is gen5ab (2026-09-26): arm A `miltank-gen5` went **8-11 rated, 3-11 without quit wins**, mean residual
without quit wins −0.27 ± 0.47 (`docs/_reports/2026-09-26-rotom-end-reasons.md` §3). 5 of its 19 rated series were
quit wins, so 20 new series will give about 14 played-out series.

- **Record.** Against 3-11, a Fisher exact test (two-sided, p < 0.05) needs 10 wins of 14 played-out series, 12 of 20,
  18 of 30, or 27 of 50 (computed for this report). A 20-series run can only detect a very large change.
- **Residual.** The baseline has only 14 played-out series, so its own standard error (0.47 / √14 ≈ 0.13) sets a floor.
  Even with unlimited new series, a residual difference smaller than about 0.25 cannot be separated from it.
- **The pre-registered effect** (+0.07 residual, σ 0.5, α = β = 0.05) needs about 770 series per arm
  (`solver/rotom/arms/gen5-vs-prior.json`). Only a **concurrent** A/B can reach that: CHOMP against the team's own
  bring, same gen5 clock, assigned per series. That is now two arms that differ only in `preview`. It is not prepared
  here, because it is a new pre-registration.
- **Confounds** between this run and gen5ab: the preview (intended), the Protect counter in ROTOM's world, the opponent
  pool on a different day, and the account's rating. Any difference between the two runs cannot be attributed to CHOMP
  alone.

## OWED, NOT RUN

**Before the launch:** merge this branch to main; then, in the main checkout, `node solver/tests/test-rotom-chomp-live.js`
and the LADDER.md §1 checks (willhoop logged out everywhere; no STOP or KILL file).

**The launch, for Will.** It spends a real rating, so it is his call. Run it from the main checkout in a plain `cmd`
window. Recommended: **20 series, about 2 to 3 hours** (gen5ab took 3.7 h for 37 series and aa2 took 2.3 h for 16,
queue time included). It stops at 20 series, at 4 hours (no new search after that), after 3 consecutive ladder
errors, after 3 unexplained chosen-vs-applied mismatches, or at the first self-quit.

```cmd
cd C:\Users\willj\Projects\Pokemon\ABRA
node solver\rotom\run_ladder.js --public --name medicham32 --release eaa5becc54eb --arms solver\rotom\arms\gen5-chomp.json --ladder-seed medicham32-chomp1-2026-09-30 --sets 20 --tag chomp1 --priority normal --max-hours 4
```

Stop after the current series: `node solver\rotom\run_ladder.js --stop` (then `del solver\out\rotom\STOP` before the
next start). Emergency stop: `node solver\rotom\run_ladder.js --kill --out solver\out\rotom\<run dir>`.

**Read it (no permission needed):**

```cmd
node solver\rotom\report.js ladder solver\out\rotom\chomp1-<timestamp>
node solver\rotom\report.js games solver\out\rotom\chomp1-<timestamp>\games.jsonl --include-local
```

**Also owed:** a concurrent CHOMP A/B arms file (arm A `preview: "chomp"`, arm B `preview: "policy"`, same gen5 clock),
pre-registered before its first series; and `node engine/status.js --write` from the main checkout after the merge.
