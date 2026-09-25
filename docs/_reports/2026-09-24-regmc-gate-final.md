# Reg M-C gate, final re-read on the merged engine: OPEN, 10 of 10 (abra/regmc 0.120.0 – 0.125.0)

ENGINE. Reg M-B is retired (Will, 2026-09-24); nothing here was run under Reg M-B.

## 1. Merge

Branch `worktree-agent-ac013915325ecdea1` (`f96ea904..1af11418`: White Herb speed order, the spent flinch in the
residual handler list, Emergency Exit on residual damage) merged into main as `5ddd6496`, renumbered
0.116.0–0.119.0 → **0.120.0–0.123.0** (the branch's references to its own 0.115.0 → main's 0.119.0). Conflicts were
the version headers and the three top-of-file logs; `engine/medicham2-browser.js` auto-merged, syntax clean.

On the merged tree, `--regulation regmc`, each probe exits 0 green and exits 1 with its knob armed:

| probe | knob | green | knob armed |
|---|---|---|---|
| `tests/probe_regmc_white_herb_speed_order.js` | `MEDI_HERB_SIDE_ORDER` | 0 | 1 (`-enditem` order diverges) |
| `tests/probe_regmc_flinch_residual_list.js` | `MEDI_FLINCH_GONE_AT_RESIDUAL` | 0 | 1 (Leftovers `-heal` order diverges) |
| `tests/probe_regmc_emergency_exit_residual.js` | `MEDI_EMERGENCY_EXIT_NO_RESIDUAL` | 0 | 1 (`-activate` Emergency Exit missing) |

## 2. Protocol

Release **`eaa5becc54eb`** (cut on the merged tree; re-cut after the session loss below and it returned the same id,
so every artifact below measured the same engine bytes). Authority `pokemon-showdown-mc` `f10d679`, selected by
`ABRA_REGULATION=regmc` with `SHOWDOWN_PATH` unset. Every heavy run went through `cmd.exe /c tools\lownode.cmd`, one
at a time, from a `spawnSync` driver; each log ends in `##EXIT`.

Order: census → pin → lattices 1200 (+ `--dump-games 2000 --dump-out data/verification/gd-regmc-final-dump.json`),
1600, 1900 → `tests/test-engine-diff.js --n 6000 --seed 20260804` → `tests/roster.js --stage {items,abilities,moves}
--reds --write --release eaa5becc54eb` → `engine/all_mechanics_fire.js --release eaa5becc54eb --write` →
`engine/register_reality.js` → census restored to the pin → `engine/quarantine.js`.

Lattice flags: `--steering empirical --arm middle --end-state --release eaa5becc54eb --census
data/verification/census-pin-regmc-123aa264f88d.json --team-store data/team-pool-frozen-regmc --games N --write --out
<gate path>`.

Census: **1024 live / 0 missing / 1024 probed**, `run_ok`. Pin `census-pin-regmc-123aa264f88d.json`.

## 3. Three things found, and what was done

1. **Roster/items exited 1 with 166/166 green.** The red demonstration for `item/restores-lowered-stats` refused to
   plant: its anchor (`const _rs=TAGS.param('item',m.item,'restoresStats');`) matched twice, because 0.120.0's
   `restoreStatsOwed` repeats that line. Instrument, not engine. Re-aimed at `restoreStatsUpdate`'s own negative-stage
   scan (0.124.0, `tests/roster.js`). Re-run: 28 of 28 anchors apply once, the rule is CAUGHT (DID-NOT-FIRE on
   `party.item`, `boosts.atk`), 166/166, exit 0.
2. **"No open known engine defect" failed on #442.** `tests/probe_census_reproduces.js` under Reg M-C: the committed
   census still carried the Supreme Overlord row under its pre-0.118.1 label ("…refuses the authority
   fallenundefined"), so HEAD did not reproduce it. Every other row and every count matched. Republished the
   regenerated census (0.124.0). On the re-run #442 reads exit 0 (STALE ROW), and the clause passes.
3. **The session died during the register step** (~23:21Z–00:40Z). No process survived. All earlier artifacts had
   written their `##EXIT` and parse with release `eaa5becc54eb`; the register artifact was the pre-fix one and the
   live census had been rewritten by the register's own census instrument. Re-cut (same id), re-ran register →
   restore → quarantine. `data/docs-currency-baseline.json` was rewritten both times as a side effect of the register
   sweep (a ratchet shrink on `docs/TAG-COVERAGE.md`); it is not this pass's and was reverted.

## 4. Narration baseline

The three lattices read **0/955, 0/1266, 0/1497** undeclared narration-only, and `diverged` is 0 on all three
(`planted_divergence_proof_ok: true`). Per the brief, stamped at zero:
`ABRA_REGULATION=regmc node engine/quarantine.js --stamp-whole-game` → `data/whole-game-baseline-regmc.json`,
`rate 0`, `0 of 955`, release `eaa5becc54eb`, mode `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`.
A baseline only ratchets down, so zero is the strictest bar it can hold.

## 5. Reg M-C gate: OPEN, 10 of 10

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at midpoint, top, bottom and idx01–idx14 |
| roster / items | PASS | 166/166, 0 DIFFER, 0 DID-NOT-FIRE, 28/28 reds caught |
| roster / abilities | PASS | 210/214 tested; 3 ANNOUNCEMENT-ONLY on receipts (Anticipation, Forewarn, Frisk); 1 deferred (Illusion) |
| roster / moves | PASS | 510/511 |
| coverage | PASS | all 269 moves above 25 clicks measured |
| board leaves | PASS | 0 uncompared (58 compared) |
| whole-game BOARD-MATERIAL | PASS | 0/955 (954 + 1 void), 0/1266, 0/1497 |
| whole-game NARRATION | PASS | 0/955, 0/1266, 0/1497 undeclared; baseline stamped at 0 |
| mechanics staged | PASS | 0 diverge; `all-mechanics-fire-regmc` 4,867 games, 0 threw |
| no open known engine defect | PASS | no open row names a RED instrument (205 verdicts read) |

Not gating, reported: `register_reality.js` exits 1 on register hygiene — 52 rows disagree with their instrument,
14 markers rejected (placeholders), 19 instruments answered nothing. None holds the gate. The quarantine now lists 69
downstream artifacts as RE-RUNNABLE, not current.

## 6. Not published

The gate opening is a MAJOR (the archetypal basis change). Per the brief, 1.0.0 is **drafted, not published**: the
CHANGELOG-REGMC entry and RUNNING-NOTES row are on branch `draft/regmc-1.0.0`, pushed, not merged. Main carries the
measurement as 0.125.0 (MINOR).

## Artifacts

Committed on main: `data/game-differential{,.g1600,.g1900}-regmc.json`, `data/engine-diff-regmc.json`,
`data/roster.{items,abilities,moves}-regmc.json`, `data/all-mechanics-fire-regmc.json`,
`data/mechanics-census-regmc.json` (= pin), `data/register-reality-regmc.json`, `data/published-samples-regmc.json`,
`data/whole-game-baseline-regmc.json`, `data/verification/census-pin-regmc-123aa264f88d.json`,
restamped ledgers. No dump file was written at 1200: nothing diverged, so there was nothing to dump.

Found and left alone (not mine): `data/engine-release-regmc.json`, `data/engine-release-regmc.json.tmp8920`,
`data/roster-regmc.json`, `data/roster.*.prev-regmc.json`.
