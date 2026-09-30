# Reg M-C MEDICHAM gate re-run on release 97451d5fbf40: OPEN, 10 of 10, nothing moved (abra/regmc 1.46.1)

ENGINE, 2026-09-30. Main checkout, `ABRA_REGULATION=regmc`, `SHOWDOWN_PATH` unset (authority `pokemon-showdown-mc`).
Every step ran through `cmd.exe /c tools\lownode.cmd` from a `spawnSync` driver, one at a time; each log ends in
`##EXIT`. This pass measured and fixed nothing.

## 1. Why

abra/regmc 1.38.0 regenerated `data/tags-regmc.json` from the full .gz store. The field the simulator reads that moved
is the `uses` counts behind `sideGuardClickRate` (`engine/medicham2-browser.js`), Quick Guard's chooser click rate
0.0271 -> 0.0390. The gate artifacts were stamped on `4067de46a0ee`, which froze the old tags. So they described a
different engine.

## 2. Release

`node engine/engine_release.js cut "tags-regmc re-weighted from the .gz store (abra/regmc 1.38.0): gate re-run"` ->
**`97451d5fbf40`** (33 frozen files). Digest diff against `4067de46a0ee`, file by file:

| file | 4067de46a0ee | 97451d5fbf40 |
|---|---|---|
| `data/tags-regmc.json` | ac1a00fa40ee | 87cbb3889809 |
| `data/quality-filter.json` | 042524dd1df7 | c74b46002e2d |
| `engine/quality.js` | ebc37c7c9d05 | 9b168679e3e9 |
| `engine/regulation.js` | 827f5138ecf5 | c00dcf435c9d |

**The brief said only the tags moved. Three more frozen files moved.** `engine/medicham2-browser.js` and every other
engine file are byte-identical. `regulation.js` gained per-regulation names for `open-work`, `interaction-matrix`,
`provenance-stamp` and six engine-test artifacts (abra/regmc 1.29.1 and the 2026-09-29 state-printer fix); none is a
gate input. `quality.js` changed the store reader from "plain file wins" to "newer file wins" (1.36.0), which makes a
Reg M-C live-store read open the .gz. The lattices read the pinned pool, so they are not affected. The coverage clause
reads the store and still reads 269 of 269.

The release directory is force-tracked (`git add -f`, 35 paths), as `eaa5becc54eb` and `4067de46a0ee` are, so the gate
artifacts re-open from a clone (provenance RULE 5). Most blobs are shared with `4067de46a0ee`.

## 3. Pins and flags

- Census: `node tests/test-mechanics.js` -> `data/mechanics-census-regmc.json`, **1027 live / 0 missing / 1027 probed**,
  `run_ok: true`, 0 threw, 0 hollow. The only row change is the sampled detail line of one accuracy probe (Iron Head
  20.5% -> 20.1%, control 28.0% -> 26.7%, over 6000 turns). Pinned by content digest:
  `data/verification/census-pin-regmc-1b81d0d24513.json`. After register_reality the census was restored to the pin.
- Team store: `data/team-pool-frozen-regmc`.
- Lattices: `--steering empirical --arm middle --end-state --release 97451d5fbf40 --census
  data/verification/census-pin-regmc-1b81d0d24513.json --team-store data/team-pool-frozen-regmc --write --out <gate path>`,
  with **`--games 1200`** (+ `--dump-games 2000 --dump-out data/verification/gd-regmc-97451d5fbf40-dump.json`; nothing
  diverged, so no dump was written), **`--games 1600`** and **`--games 1900`**.
- **Lattice sizes.** The brief said 1200/1350/1950 "per the gate's own clause". The gate's clause is
  `LATTICE_GAMES` in `engine/quarantine.js`: 1200/1350/1950 is the **Reg M-B** row; the **Reg M-C** row is
  **1200/1600/1900**. Those are what ran, and what the gate reads.

## 4. Results, and comparison with the earlier readings

| step | exit | seconds | reading on 97451d5fbf40 | on 4067de46a0ee / eaa5becc54eb |
|---|---|---|---|---|
| census | 0 | 202 | 1027/0/1027 | 1027 (4067) / 1024 (eaa5) |
| lattice 1200 | 0 | 1754 | 0 board / 0 narration of 955 (954 + 1 void); 10,550/10,550 boundaries identical | same, identical boundary count |
| lattice 1600 | 0 | 1540 | 0 / 0 of 1266; 13,883/13,883 | same |
| lattice 1900 | 0 | 1334 | 0 / 0 of 1497; 16,521/16,521 | same |
| engine diff `--n 6000 --seed 20260804` | 0 | 212 | 0/6000 at midpoint, top, bottom, idx01-idx14 | same |
| roster items | 0 | 33 | 166/166 | same |
| roster abilities | 0 | 174 | 210/214 (3 ANNOUNCEMENT-ONLY on receipts, Illusion closeted) | same |
| roster moves | 0 | 45 | 510/511 | same |
| all-mechanics-fire | 0 | 187 | 4,867 games, 0 threw, 0 diverge | same |
| register_reality | 1 | 2034 | 52 disagree, 14 markers rejected, 18 answered nothing | 52 / 14 / 19 (eaa5) |
| quarantine | 0 | 74 | **OPEN, 10 of 10** | OPEN, 10 of 10 |

The three lattices drew the same pools as before (`team_pool_digest` 3c60452ad2c5, 2d8e6931a914, ede5538f9153) and the
same number of games and compared boundaries. **Nothing moved.** That is the expected result: the lattices play a
store-derived driver, and Quick Guard's click rate is read by the chooser, not by the driver.

The 1200 lattice printed one forced switch as UNMIRRORABLE. It is in the one void game; the gate reads "none of the 1
void game(s) parted a board before going low-identity". Same as before.

register_reality exits 1 on register hygiene. That is not a gate clause, and it was 1 on eaa5becc54eb too.

## 5. Gate, clause by clause (`node engine/quarantine.js --regulation regmc`)

Ten clauses gate. All pass.

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at midpoint, top, bottom and idx01-idx14, seed 20260804 |
| roster / items | PASS | 166/166 |
| roster / abilities | PASS | 210/214; ANNOUNCEMENT-ONLY on receipts: Anticipation, Forewarn, Frisk |
| roster / moves | PASS | 510/511 |
| coverage | PASS | all 269 moves above 25 clicks measured |
| board leaves | PASS | 0 uncompared (58 compared) |
| whole-game BOARD-MATERIAL | PASS | 0/955, 0/1266, 0/1497 |
| whole-game NARRATION | PASS | 0/955, 0/1266, 0/1497 undeclared |
| mechanics staged | PASS | 0 diverge; 3 shelved by the owner (Illusion closet: Illusion, Bitter Malice, Night Daze) |
| no open known engine defect | PASS | 205 verdicts read; #442 is a STALE ROW (instrument green) |

## 6. Side effects handled

- `data/forme-assert-regmc.json` was rewritten by the register sweep (a one-line stamp). It is not a gate artifact and
  was reverted.
- `node engine/status.js --write` (Reg M-C) restamped `docs/{ENGINE,MEASURE,OPS,SOLVER,WEB}.md`. WEB's block still
  prints the site bundle as DRIFTED; web is paused and that red is waived.
- Untracked files found in main and left alone (not mine): `data/engine-release-regmc.json`, `data/roster-regmc.json`,
  `data/roster.{abilities,items,moves}.prev-regmc.json`.
- The session scratchpad is shared with earlier sessions. This pass wrote `run.js`, `chain.js` and `*.log` there; if a
  file of the same name existed from an earlier session it was overwritten. None is in the repository.

## OWED, NOT RUN

- **SOLVER:** a playout or arena figure measured on `eaa5becc54eb` or `4067de46a0ee` stays on that release. Quick
  Guard's chooser click rate differs on `97451d5fbf40`, so a SOLVER figure re-measured here is a new measurement, not
  a restatement.
- The whole-game narration baseline (`data/whole-game-baseline-regmc.json`) was not re-stamped. It is at rate 0 on
  `eaa5becc54eb`; a baseline only ratchets down, and zero is its floor.
- register_reality's hygiene (52 / 14 / 18) is not addressed here. It does not gate.
