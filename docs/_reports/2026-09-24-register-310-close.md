# ROADMAP #310 closed: every engine `battleInit` hands the lead-in a stream. 2026-09-24 (abra/regmc 0.92.0, provisional)

ENGINE. Worktree `worktree-agent-aace036dabfd3b91c` off `3dc5ea54` (abra/regmc 0.91.0). The brief named `9af27acd` (0.87.1,
the #310/#442 MEASURE pass) as the base; that commit is not an ancestor of this branch and the merge was refused by the
sandbox, so its `tests/probe_rollout_trace_stream.js`, `tests/probe_census_reproduces.js`, `docs/ROADMAP.md` and
`docs/_reports/2026-09-24-register-310-442.md` were brought over by content (the ROADMAP is identical at `7c9f7534` and
`3dc5ea54`, so nothing else of this branch's register is lost). Its CHANGELOG, RUNNING-NOTES, MEASURE.md, REGMC.md and
REGULATION-ROTATION.md rows were NOT brought over: they belong to 0.87.1 and arrive with that commit's own merge.

Every heavy run went through `tools\lownode.cmd` (via `spawnSync('cmd.exe', ['/c', 'tools\\lownode.cmd', ...])`).

## Verdict

| | Reg M-B | Reg M-C |
|---|---|---|
| probe on the pre-fix bytes | **RED** (release `03eee67c9898`): PREVIEW `traceChoiceNoDie` +3, BATTLE +1, 10 unseeded sites | **RED** (release `463239c06c83`, cut from the pre-fix engine files): PREVIEW and BATTLE fail, static clause fails |
| probe after | **GREEN**, release `f78b4633203d` | **GREEN**, release `c8c113f0df05` (the named M-B release falls back, printed) |
| `--plant-caller` | RED (1 planted unseeded site) | (static clause is regulation-independent) |

The row is closed with the marker `node tests/probe_rollout_trace_stream.js --release f78b4633203d`.

## The call sites, and what each one got

The instrument's own list (from the 0.87.1 report) was eight sites. The new static clause found **two more** that the
list had missed, because the list was grepped outside `medicham2-browser.js` and read `{ seeded: SEEDED }` as seeded:

| site | stream | why that stream |
|---|---|---|
| `engine/bench_speed.js` `freshState` | `{ seed: <the playout seed> }` | a separate LCG, so the turn stream (`mulberry(seed)`) is untouched |
| `engine/game_differential.js` `mediSpan` | `{ seed: STAGE_LEAD_SEED }` (20260924) | single-hit staging outside the game loop: no arm stream exists |
| `engine/game_differential.js` `oneHitDamage` | the same | the same |
| `engine/million_run.js` `playGame` | `{ seed: leadSeed(g, 0) }` | keyed on (SEED, game index): the pinned red proof replays game g with only the turn dice changed |
| `engine/million_run.js` `stagedPlay` | `{ seed: leadSeed(trial, fixture+1) }` | a fresh stream per (fixture, trial), matching the arm's own dice rule |
| `engine/replay_differential.js` `reachableEffects` | `() => p`, the pin | the sweep asks what is REACHABLE per pin; the lead-in now sits in the same corner as the turn |
| `engine/replay_differential.js` lead-weather board | `{ seed: FNV-1a(game.id) }` | the same game draws the same on a re-run |
| `engine/speed_vs_pokeenv.js` | `{ seed: 20260811 + g }` | the game seed; the turn stream is a separate mulberry |
| **found:** `engine/medicham2-browser.js` `battle()` | the caller's `rng` | a one-call game has one stream |
| **found:** `engine/rollout_leaf.js` `rolloutWinProb` | the playout `rng`, **only when `seeded:false`** | the preview road (`engine/miltank.js`) runs the lead pass; the seeded road runs none and is untouched |

The static clause accepts `rng` in the options object, or a literal `seeded: true` (a seeded board runs no lead pass, so
it has nothing to draw at init: `backtest_winrate.js:247`, `immunity_sweep.js:397`, `pp_board_probe.js:108`,
`rollout_leaf.js:1401`). Comments are stripped before the scan; three planted sources must classify correctly or the
probe answers CANNOT-ANSWER.

## No published output moves

Method: the same release before and after, so the only thing that differs is the driver file. The HEAD driver was
restored by content for the "before" run and the edited driver put back for the "after" run (the differential's own
driver-code guard caught the first attempt, where the edit landed mid-run, and withheld its figures; that run was
discarded and repeated).

| caller | run | before | after |
|---|---|---|---|
| `game_differential.js`, Reg M-B | release `03eee67c9898`, census pin = the live census (`833a997d7e42`), `--team-store data/team-pool-frozen` (main checkout), coverage steering, `--games 45 --write --out <scratch>` | artifact | **byte-identical** except `generated`, `elapsed_s` and the driver-code digest |
| `game_differential.js`, Reg M-C | release `c8c113f0df05`, `--census data/verification/census-pin-regmc-0d03e83f0e65.json`, `--team-store data/team-pool-frozen-regmc`, `--steering empirical --arm middle --end-state --games 45` (38 played) | artifact | **byte-identical** except the same three |
| `replay_differential.js` | release `03eee67c9898`, `--games 150`, store = first 4,000 lines of the main checkout's `games.ladder.jsonl` | artifact + freezes | **identical** except `generated`, `seconds` |
| `million_run.js` self-play | `--release 03eee67c9898 --games 40` | log | **identical** except a file age |
| `million_run.js --staged` | `--trials 30` | log | **identical** except a file age and wall time |
| `bench_speed.js --worker 300 --cap 20` | release `03eee67c9898` | 3,351 turns | 3,351 turns |
| `speed_vs_pokeenv.js --games 40 --anyway` | pointer release | 440 turns (arm C) | 440 turns |

The staged blocks the differential edit touches (`knock_off_roadmap_80`, `damage_interior`) are present in both
artifacts: Knock Off arms 192/284/142 in each engine, both regulations.

**Identical output is not the knob being unwired.** Counters, read with a `-r` preload that prints MEDICHAM's
`MEDSEEN`/`MEDFAILS` at exit (the HEAD driver run from a temporary copy that was deleted afterwards):

| caller | `entryOrderTieNoDie` | `traceChoiceNoDie` | `traceChoiceDie` |
|---|---|---|---|
| `replay_differential.js`, 150 games | 974 → **0** | 3 → **0** | 0 → 3 |
| `million_run.js`, 40 games | 14 → **0** | 0 → 0 | 0 → 0 |
| `speed_vs_pokeenv` shape, 40 mirror inits | 80 → **0** | 0 → 0 | 0 → 0 |

So the streams are reached, and in these samples the draws changed nothing the artifacts read. One part of that is by
construction: the replay sweep draws its ties off a constant pin, and equal keys keep the old order. Why the three Trace
draws and the self-play and benchmark ties moved no output was not measured; the claim here is only that they did not.

**Why the published artifacts were not regenerated.** `data/million-run.json` (2026-08-11, release `84f466e7e0d2`),
`data/million-run-staged.json` (2026-08-12), `data/replay-differential*.json` (2026-08-11), `data/speed-vs-pokeenv.json`
(2026-08-11) and the `_bench-*.json` files were all written on releases six weeks old; none reproduces on the current
engine for reasons that have nothing to do with #310, and `million_run.js` refuses to write an artifact on this tree
before and after the change (its flinch instrument check and its wrong-declaration red proof). The before/after pairs
above are the evidence; the artifacts are left as they are.

## The engine change, and the census

`medicham2-browser.js` changed only in `battle()`, which no census probe, differential or roster calls; `rollout_leaf.js`
changed only on `seeded:false`, which only `engine/miltank.js` (quarantined) passes. `tests/test-battle-api.js` (8),
`tests/test-rollout-effects.js` (38), `tests/test-tag-wire.js` (104) and `tests/probe_bracket_counters.js` pass. The
census regeneration is in the next section.

## Census

`tests/test-mechanics.js` re-run in both regulations on the final tree (exit 0 both):

| | committed before | regenerated | `node engine/status.js` |
|---|---|---|---|
| Reg M-B | 1004 / 1004 live | **1006 / 1006 live, 0 missing** | 1006/1006 |
| Reg M-C | 1010 / 1010 live | **1010 / 1010 live, 0 missing** | 1010/1010 |

Nothing went down. The Reg M-B +2 is NOT this change: the 0.87.1 report regenerated 1006 on `7c9f7534`, before any of
it, and named the committed 1004 a stale census (#442's `UNDERCLAIM ONLY`).

**The regenerated Reg M-B census is NOT committed.** `tests/test-docs-current.js` failed on it (2 of 39): the 7.0.0
documents (`docs/SUMMARY.md:68`, the deck, the technical docs) cite `1,004` against `data/mechanics-census.json`, and
the Reg M-B line is closed at 7.0.0, so moving that file moves a published figure. It is restored to the committed
bytes, which leaves #442's Reg M-B reading exactly where MEASURE left it. The Reg M-C census is committed regenerated
(same 1010/1010; `generated` and probe details move). Gate after the restore: 39 passed, 0 failed.

`node engine/status.js --write` was NOT run from this worktree: it writes missing untracked files as fact from a
worktree (a recorded lesson). The coordinator should run it on main after the merge.

## Housekeeping, reported not acted on

- The session scratchpad is shared. `low.js` in its root was written by this session and then **overwritten by another
  session** (now an in-process BELOWNORMAL launcher). Everything after that point used `scratchpad/s310/`. Nothing of
  the other session's was deleted.
- `data/engine-release-regmc.json` is a new untracked pointer in this worktree (the M-C cuts); it is not committed.
  `data/engine-release.json` was restored to its pre-cut bytes.
- Release `f78b4633203d` (the marker's) is force-added so the register can run the marker; `03eee67c9898`,
  `c8c113f0df05` and `463239c06c83` stay untracked.
