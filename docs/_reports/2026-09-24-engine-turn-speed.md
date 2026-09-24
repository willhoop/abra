# Engine turn speed: where the CPU goes, what was fixed, and why the turn got dearer

**Date:** 2026-09-24. **Division:** ENGINE. **Line:** abra/regmc 0.108.1 (PATCH; the merge coordinator renumbers).
**Base:** `497b6cb1` (main). **Brief:** the playout-speed report (`playout-speed:docs/_reports/2026-09-24-playout-speed.md`).
It found that `engine/tags.js` `norm()` costs about 13% of a playout and that a turn costs about 3x the
2026-08-28 figure.

## Verdict

- **Landed, and behaviour-neutral:** `engine/tags.js` `norm()` and `_shadowId()` in the simulator are memoised,
  and each answers `''` at once for a falsy input. Both functions are pure. Any input that is not a string still
  takes the original expression.
  - Speed: paired in-process A/B on main-thread CPU. Over five runs, turns per CPU-second rose **+8% to +17%**
    over the whole run: Reg M-B +15%, +17% and +8%; Reg M-C +8% and +10%. The median per-block ratio was
    **1.09-1.17**. Both arms of each run played the same turns: 10,181 on M-B and 9,087 on M-C.
  - Identity: the same bytes per game **in both regulations**. The evidence is the pinned differential
    (per-game `MEDI_SAMPLE_DUMP` trajectory digests: 961 of 961 games on Reg M-B and 955 of 955 on Reg M-C, at `--games 1200`) and
    a 300-playout per-game harness that also hashes every counter. 16 probes per regulation printed the same output.
- **The turn is ~1.75x dearer in CPU than on 2026-08-28, not 3x.** A paired bisect over 20 releases shows the
  steps in §4. The playout-speed report's 3x compared an idle-machine figure against a run on a machine at 100%
  load. After this patch the ratio is ~1.55-1.6x.
- **What is left is in the simulator core, and each item moves a counter or needs an invalidation argument.**
  §5 lists the items as proposals. None was implemented.

## 1. Instruments (all in the session scratchpad, not committed)

| Script | What it does |
|---|---|
| `turnbench.js` | Fixed workload: 4 team pairs off `data/team-pool-frozen` (stride pick), cap 14, explore 1.0, switch rate 0.0998. Seeds are `ia*7919 + i*104729 + 13`, as in `engine/bench_speed.js`. Bodies are built by `game_differential.buildPair` out of a FIXED release (`f78b4633203d`), so only the simulator varies. Process CPU is summed around `battleInit` + `runPlayout`. |
| `pairbench.js` | **The instrument that works on this machine.** It loads several frozen releases into ONE process and plays the same playouts on each, in blocks of 2-4 playouts per pair. The engines take turns inside each block round, in a rotating order. Main-thread CPU (`process.threadCpuUsage`) is summed per engine, and it reports the per-block ratio against the first engine. Machine noise hits every engine within the same second, so it cancels in the ratio. |
| `identity.js` | Plays 12 pairs x 25 seeds, cap 30, through `runPlayout` with a `trace` sink. Per game it records sha256 of the full protocol trace, every body's end state and the field. At exit it hashes `MEDSEEN`, `MEDFAILS`, and the tags `hits()` and `asked()`. |
| `gdrun*.sh` | `engine/game_differential.js --steering empirical --arm middle --end-state --census <pin> --team-store <frozen pool> --release <id> --games N --write --out <scratch> --dump-games N`, with `MEDI_SAMPLE_DUMP` for the per-game trajectory digests. |
| `probes.sh` | Runs 16 probes and tests in both regulations with `--release`, with the live tree set to the matching bytes. |

Releases cut for this work (in the worktree's `data/releases/`, **not committed**):

| | Reg M-B | Reg M-C |
|---|---|---|
| base (`497b6cb1`) | `b655c9ea18dc` | `8e22abe0ab8d` |
| patch 1 (`norm` memo only) | `f7d820b97d5a` | `b5c5b82a6917` |
| patch 2 (landed) | `7c328242ee84` | `b4ec559cd625` |

Census pins: `data/verification/census-pin-833a997d7e42.json` (M-B) and
`data/verification/census-pin-regmc-f3b70bc0c47c.json` (M-C). Frozen pools: `<main>/data/team-pool-frozen` and
`<main>/data/team-pool-frozen-regmc` (the worktree does not carry the pool files).

### Why wall time and even separate-process CPU time cannot be read here

- Sequential interleaved runs of the same engine, through lownode, `turnbench`, 6 rounds x 3 reps. CPU time moved
  from 75 to 1,160 turns per CPU-second **for the same engine and the same work** (`ab-mb.json`). The 2026-08-28
  report's "sporadic collapse" is real, and it hits CPU time as well as wall time.
- Eight engines run concurrently: every figure fell ~5-10x, and the order between engines was noise
  (`bisect1.json`).
- `pairbench` fixes this. The absolute ms per turn still moves between runs (0.76 to 6.6 ms), but the ratios
  agree to a few percent across runs taken hours apart and under very different load (§4).

## 2. Where a turn's CPU goes (profile, `--cpu-prof`, `turnbench` 800 playouts / 8,453 turns, Reg M-B)

Shares are inclusive of `runPlayout`. Base = HEAD `497b6cb1`; patch = `7c328242ee84`.

| Function | base | patch | note |
|---|---|---|---|
| `battleTurn` (self) | 16.5% | 17.9% | one very large function; self time is spread through it |
| `_walk` (the per-row step walk) | 17.4% | 16.5% | the move pipeline |
| `_updateEvent` (each Update pass) | 15.7% | 16.1% | it contains `volSeqSyncAll` and `sdEachEventOrder` |
| `tags.param` | 12.6% | 10.1% | ~1,690 tag lookups per turn (5,021,453 `asked` over 2,975 turns in the identity run) |
| `volSeqSyncAll` | 9.2% | 9.6% | every volatile row x every active body x every Update pass |
| `effSpeed` | 9.1% | 9.0% | 4.5% from `residualOrder`, 3.2% from `sdActionSpeed` |
| `tags.norm` | 6.5% | 3.1% | the regex is gone. The remainder is the Map lookup and the call itself. |
| `RegExp [^a-z0-9]` | 2.7% | 0.6% | |
| `residualOrder` | 6.4% | 6.3% | one sort per residual order group, and `effSpeed` for every body each time |
| `residualShadowVolPresent` | 6.4% | 5.9% | |
| `dmgRange` | 8.4% | 6.9% | |
| `playerAction` (explore pick) | 7.1% | 6.1% | |

The playout-speed report's "13% in `param`" is reproduced (12.6%). About half of it was the regex; the rest is
call volume, which is a caller question (see §5).

## 3. Identity — proven, not assumed

| Check | Reg M-B | Reg M-C |
|---|---|---|
| `identity.js`, 300 playouts, per-game digest | 300/300 equal (`3d8ceb5b76b9a5ce`, 2,975 turns) | 300/300 equal (`18a0da334dcfec4e`, 2,879 turns) |
| same, counters (`MEDSEEN`, `MEDFAILS`, tags `hits`/`asked`) | equal (`ed833712317be69a`) | equal (`52621b45b90e44a4`) |
| **control:** the same harness with `MEDI_VOL_ARTIFACT_ORDER=1` | 300/300 DIFFER, counters differ | – |
| differential `--games 300`, whole artifact | 260 games, equal except release id and simulator digest | 259 games, equal except release id and simulator digest |
| differential `--games 1200`, `MEDI_SAMPLE_DUMP` per game | **961/961 rows equal** (trajectory digest, turns, lines, board result); artifact equal except the same two fields; 0 diverged on either arm | **955/955 rows equal**; artifact equal except the same two fields; 3 diverged games (1 board-material) on BOTH arms, and their `--dump-games` cards are equal line for line |
| 16 probes/tests, masked log diff | equal except the two lines below | equal except the line below |

The three log lines that differ are the environment, not the patch:
- `probe_residual_shadow` "UNDER REAL DICE … B-first N/400": this line draws from `Math.random`
  (`tests/probe_residual_shadow.js:316`). Two runs of the SAME release gave 201 and 191.
- `probe_residual_stop_body` (M-B): a pool-cache MISS on one run. The worktree does not carry
  `data/team-pool-frozen/*.jsonl`, so this probe is red (exit 1) on base and patch alike, with the same verdict lines.
- `test-tag-wire` (M-C): exits 1 on base and patch alike, and the only differing line is the crashed child's `pid`.

Tests run green on the patched tree: `test-tag-consumed` 7/7, `test-tag-wire` 104 checks (M-B),
`test-board-browser` 14/14. Unit check: the new `norm` equals the old expression on 17 inputs of every type,
including falsy values, numbers, objects with a `toString`, and non-ASCII.

## 4. Why the turn got dearer — paired bisect

`pairbench`: ratio of turns per main-thread-CPU-second against the first engine in the window (median of the
per-block ratios, two runs each). Turn counts differ slightly between releases (3,321-3,403) because the
releases play different games; the ratio is per turn.

| Release | cut (UTC) | vs 08-28 (run 1 / run 2) | step |
|---|---|---|---|
| `5f3f7141227c` | 08-28 09:51 | 1 / 1 | the `data/medicham-speed.json` release |
| `791c9fd873f3` | 09-07 02:23 | 0.85-0.90 (four runs) | **-12%**, 46 simulator commits, no release between to split them |
| `cf8567c4db78` … `489bea0577bc` | 09-08 – 09-10 02:07 | 0.84-0.93 | flat |
| `5a7bd8a8178a` | 09-10 02:59 | 0.73-0.78 | **-13%**: residual handler-list sort, ROADMAP #563 (`0ec9c45a`) |
| `534442d71183`, `bc8d7cf849dd` | 09-11, 09-12 | 0.70-0.76 | flat |
| `ffc11ac41a26` … `a1c7dcd5696b` | 09-18 – 09-19 05:50 | x1.00 against `bc8d` | flat |
| `1a6550ea5ec6` | 09-19 11:11 | x0.85-0.87 against `bc8d` | **-14%**: `volSeqSync` (the volatile insertion clock) and `sdEachEventOrder` (the Update speed-sort), both in `c78183e4` |
| `d92bdfb50d88` … `834713ccb303` | 09-19 – 09-20 | x0.81-0.87 against `bc8d` | about -5% |
| `f78b4633203d`, `b655c9ea18dc` (HEAD) | 09-24 | 0.556-0.585 | about -5% |
| `7c328242ee84` (this patch) | – | 0.631 / 0.645 | **+8-14% recovered** |

The product of the steps comes to ~0.58, which is consistent with HEAD at 0.566-0.585. **The turn is ~1.75x
dearer, not 3x.** The rest of the playout-speed report's 3x came from comparing a 2026-08-28 figure taken on an
idle machine against today's figure on a machine at 100% load.

## 5. Proposals — hot spots that would need a behaviour-affecting change (NOT implemented)

Each proposal below either changes a published counter, or needs an argument that no state changes between two
readings. The brief allows only provably neutral changes, and none of these is one yet.

1. **`volSeqSync` on every Update pass (~9.6%).** It walks every artifact volatile row for every active body and
   calls a presence closure for each. Two options: resolve the per-row reader once at load (neutral, but a
   simulator-core edit that the merge coordinator's conflict surface argues against today), or sync only on the
   events that can add or drop a volatile. The second changes when `MEDSEEN.volSeqStamped` counts, and it needs a
   proof that nothing between two syncs is missed.
2. **`sdEachEventOrder` calls `effSpeed` for a diagnostic.** The live speed is computed only to bump
   `MEDSEEN.updateSortCachedDiffersLive`. That is ~3% of a turn. Dropping it, or gating it behind a knob, stops the
   counter.
3. **`residualOrder` re-derives `effSpeed` per order group (~4.5%).** Speed can change inside the residual phase
   (a Speed-changing residual, a faint), so a cache needs an invalidation rule. Showdown's own `speedSort` reads the
   cached `pokemon.speed` that `updateSpeed` refreshes, and matching that would be a mechanic change with a probe,
   not a speed patch.
4. **~1,690 tag lookups per turn.** `param` and `has` increment `ASKED` and `COUNT` on every call, and those
   counters are the tag-coverage instrument. Hoisting lookups out of per-row loops (for example the same
   `speedMult` item param read for every `effSpeed` call) changes the counts. A per-record cache in `tags.js` is
   unsafe, because probes `require('data/tags.json')` directly, get the same object, and may edit it in place.
5. **`battleTurn` self (~18%) and `_walk` (~17%).** These are spread through the move pipeline and have no single
   fix. The next useful step is a line-level profile (`--cpu-prof` with `positionTicks`) of `battleTurn`.

## 6. What was not done

- `node engine/status.js --write` was not run. In a worktree it writes the missing untracked files (the frozen
  pools) as fact. The coordinator stamps the ledgers on main.
- No census regeneration: no mechanic moved, and the counter-hash identity shows no census row can.
- The six releases cut here sit uncommitted in the worktree's `data/releases/`, and `data/engine-release.json` and
  `data/engine-release-regmc.json` were restored and removed, so the branch carries none of them.
