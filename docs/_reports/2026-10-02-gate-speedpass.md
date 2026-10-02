# Reg M-C MEDICHAM gate on release 74972dd2db89 (speed pass 1.77.1-1.77.3): OPEN, 10 of 10, nothing moved (abra/regmc 1.77.4)

ENGINE, 2026-10-02. Main checkout, `ABRA_REGULATION=regmc`, `SHOWDOWN_PATH` unset (authority `pokemon-showdown-mc`,
`showdown f10d6798f2ba`). Every gate step ran through `cmd.exe /c tools\lownode.cmd` from a `spawnSync` driver
(scratchpad `gate1002.js`, written this pass), one at a time; each log ends in `##EXIT`. This pass measured and fixed
nothing. It was the only game-playing job on the machine; the ladder was idle.

## 1. Why

abra/regmc 1.77.1-1.77.3 changed `engine/medicham2-browser.js` (`volSeqSync`, `sideWiped`) and
`engine/medicham_api.js` (`legalActions`' counter snapshot/restore). Each batch was byte-identical on a 5,624-turn
digest check, but no gate verdict existed for the new bytes. The first attempt was stopped by Will before
register_reality and quarantine (`docs/_reports/2026-10-02-medicham-speed-pass.md`).

## 2. Release

`git pull --ff-only` brought only two ingest-bot store commits (no engine file). Then
`node engine/engine_release.js cut "gate re-run over HEAD after speed pass 1.77.1-1.77.3"` answered
**THIS TREE WAS ALREADY FROZEN** — id **`74972dd2db89`**, cut 12 of the same bytes (first cut 2026-10-02T07:19:07Z,
the stopped run's). So HEAD's frozen files equal that release byte for byte, and it was reused.

Digest differences against the previous gate release `df172ccd2aaf` (read from the lattice artifacts'
`source_digests`): `engine/medicham2-browser.js` bf5efb8fafee -> 95e441775d9e, `engine/medicham_api.js`
f0264a11558b -> 5c1626e424b2, `engine/quality.js` 9b168679e3e9 -> e492d84b4c4f, `data/quality-filter.json`
c74b46002e2d -> 00381a9dc7ce (the last two are OPS work since 1.57.0). The release directory is force-tracked
(`git add -f data/releases/74972dd2db89/`, 35 paths), as `df172ccd2aaf` is.

## 3. Pins and flags

- Census: `node tests/test-mechanics.js` -> `data/mechanics-census-regmc.json`, **1027 live / 0 missing / 1027
  probed**, 0 hollow. Pinned by content digest: **`data/verification/census-pin-regmc-9bda05fa4930.json`**.
  register_reality rewrote the census mid-sequence; it was restored from the pin afterwards.
- Team store: `data/team-pool-frozen-regmc`.
- Lattices: `node engine/game_differential.js --steering empirical --arm middle --end-state --release 74972dd2db89
  --census data/verification/census-pin-regmc-9bda05fa4930.json --team-store data/team-pool-frozen-regmc --write --out
  <gate path>` with `--games 1200` (+ `--dump-games 2000 --dump-out data/verification/gd-regmc-74972dd2db89-dump.json`;
  nothing diverged, no dump written), `--games 1600`, `--games 1900`.
- Engine diff `tests/test-engine-diff.js --n 6000 --seed 20260804`; roster `tests/roster.js --stage {items,abilities,moves}
  --reds --write`; `engine/all_mechanics_fire.js --kind all --write`; `engine/register_reality.js`;
  `engine/quarantine.js --regulation regmc`.

## 4. Results

| step | exit | seconds | reading on 74972dd2db89 | on df172ccd2aaf |
|---|---|---|---|---|
| census | 0 | 26 | 1027/0/1027 | 1027/0/1027 |
| lattice 1200 | 0 | 234 | 0 board / 0 narration of 955 (954 + 1 void) | same |
| lattice 1600 | 0 | 199 | 0 / 0 of 1266 | same |
| lattice 1900 | 0 | 328 | 0 / 0 of 1497 | same |
| engine diff | 0 | 77 | 0/6000 at midpoint, top, bottom, idx01-idx14 | same |
| roster items | 0 | 25 | 166/166 | same |
| roster abilities | 0 | 53 | 210/214 (3 ANNOUNCEMENT-ONLY on receipts, Illusion closeted) | same |
| roster moves | 0 | 42 | 510/511 | same |
| all-mechanics-fire | 0 | 65 | 4,867 games, 0 threw, 0 diverge | same |
| register_reality | 1 | 1722 | 53 disagree, 14 markers rejected, 18 answered nothing | 52 / 14 / 18 |
| quarantine | 0 | 21 | **OPEN, 10 of 10** | OPEN, 10 of 10 |

Every stamp moved: each gate artifact's `generated` and `engine_release` now read 2026-10-02 and `74972dd2db89`.

**What moved: nothing.** A field-by-field diff of every gate artifact against HEAD (the `df172ccd2aaf` versions):
the three lattices change 17 fields each, the engine diff 8, each roster file 9, all-mechanics-fire 16 — all stamps
(`generated`, `elapsed_s`, release id/cut/cut count, census pin path and digests, `source_digests`, the usage source's
date) plus timings in all-mechanics-fire (moves stage 70.4 s -> 26.4 s). Pools (3c60452ad2c5 / 2d8e6931a914 /
ede5538f9153), game counts, divergence counts and every class table are identical. The census changed only its stamp
and one sampled-probe detail line (Iron Head 19.7% -> 19.6% over 6000 turns; the stopped run read 20.3%); live,
missing and probed are unchanged.

**register_reality's one new disagreement is not the engine.** Row #471 (closed; "THE STORE CARRIES 71 SPECIES THIS
REGULATION DOES NOT CONTAIN") went CONFIRMED -> PREMATURE CLOSE because `tests/test-quality.js` now exits 1: its
clause "every rule has a funnel stage" reads 10 rules against 9 stages (`exclude_own_accounts` in
`data/quality-filter.json` has no funnel stage). That is the store quality filter, OPS's file, changed since 1.57.0.
It does not gate. Not fixed here.

## 5. Gate, clause by clause (`node engine/quarantine.js --regulation regmc`)

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at midpoint, top, bottom and idx01-idx14 |
| roster / items | PASS | 166/166 |
| roster / abilities | PASS | 210/214; ANNOUNCEMENT-ONLY on receipts: Anticipation, Forewarn, Frisk |
| roster / moves | PASS | 510/511 |
| coverage | PASS | all 269 moves above 25 clicks measured |
| board leaves | PASS | 0 uncompared (58 compared) |
| whole-game BOARD-MATERIAL | PASS | 0/955, 0/1266, 0/1497 |
| whole-game NARRATION | PASS | 0/955, 0/1266, 0/1497 |
| mechanics staged | PASS | 0 diverge |
| no open known engine defect | PASS | 205 verdicts read |

## 6. SOLVER-facing tests on the same tree (Reg M-C, lownode)

| test | exit | seconds | reading |
|---|---|---|---|
| `solver/tests/test-lean-mode.js --release 74972dd2db89 --census <pin> --team-store data/team-pool-frozen-regmc` | 0 | ~520 | lattice: hooked run's sample byte-identical over 955 games; 22,289 lean turns, 22,289 agree, 0 disagree, 0 untranslated. human: 300 games, 2,921 turns, equal after every turn with dice counts, 300/300 same winner. Red arm `MEDI_LEAN_BREAK=1` red on both (102 / 609 turns differ). VERDICT-GREEN |
| `solver/tests/test-miltank.js` | 0 | 25 | 3992/3992, its breaks red |
| `solver/tests/test-body-parity.js` | 0 | 3 | 8/8, its break red |
| `solver/tests/test-playout-speed.js` | 0 | 53 | 1051/1051, its breaks red |

`test-lean-mode.js` first ran without arguments and exited 2 (CANNOT-ANSWER: `--release` is required); the run in the
table is the one with the release, census and pool pinned.

## 7. Side effects handled

- `data/forme-assert-regmc.json` rewritten by the register sweep (stamp); reverted. Census restored from the pin.
- `data/engine-release-regmc.json`, `data/roster-regmc.json` and the three `roster.*.prev-regmc.json` are tracked now
  (they were untracked at 1.57.0); they moved with the run and are committed with the artifacts.
- `node engine/status.js --write` restamped `docs/{ENGINE,MEASURE,OPS,SOLVER,WEB}.md`. It prints WEB's bundle DRIFTED
  (web paused, waived) and a provenance ratchet trip on `_diag*` files; neither is ENGINE's and neither was touched.
- Left alone, not mine: `data/verification/census-pin-regmc-c759d0a8eb23.json` (the stopped run's pin, untracked).
- Scratchpad: `gate1002.js`, `fd1002.js`, `g1002-*.log`, `g1002-*.txt`. None is in the repository.

## OWED, NOT RUN

- **OPS:** `tests/test-quality.js` is red on "every rule has a funnel stage" (10 rules, 9 stages; `exclude_own_accounts`
  has no stage), which flips register row #471 to PREMATURE CLOSE. Run in a plain shell it also ran out of heap at the
  default limit. Not gating; not ENGINE's file.
- Carried from 1.57.0, unchanged: the lattices give every body 0 HP Stat Points; `tests/test-nature-differential.js`
  part 7 needs a Reg M-C baseline release; register_reality hygiene (now 53 / 14 / 18).
- Speed-pass follow-ups listed in `docs/_reports/2026-10-02-medicham-speed-pass.md` (residual walk, `battleTurnBody`
  split, SOLVER's leaf cost, parallelism) are untouched.
