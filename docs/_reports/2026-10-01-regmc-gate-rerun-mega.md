# Reg M-C MEDICHAM gate re-run on release df172ccd2aaf: OPEN, 10 of 10, nothing moved (abra/regmc 1.57.0)

ENGINE, 2026-10-01. Main checkout, `ABRA_REGULATION=regmc`, `SHOWDOWN_PATH` unset (authority `pokemon-showdown-mc`,
`showdown f10d6798f2ba`). Every step ran through `cmd.exe /c tools\lownode.cmd` from a `spawnSync` driver, one at a
time; each log ends in `##EXIT`. This pass measured and fixed nothing. It was the only game-playing job; the ladder
was idle.

## 1. Why

abra/regmc 1.51.0 changed `engine/medicham2-browser.js`: a forme change recomputes the stat line from the set, with
HP Stat Points included (`setLineL50`; knobs `MEDI_MEGA_SPREAD_HP_BLIND`, `MEDI_FORME_SWAP_STAT_DELTA`;
`docs/_reports/2026-10-01-mega-hp-spread.md`). The gate artifacts were stamped on `97451d5fbf40`, which froze the old
simulator.

## 2. Release

`node engine/engine_release.js cut "forme change recomputes from the set, HP SP included (abra/regmc 1.51.0): gate re-run"`
-> **`df172ccd2aaf`** (33 frozen files). Digest diff against `97451d5fbf40`, every file:

| file | 97451d5fbf40 | df172ccd2aaf |
|---|---|---|
| `engine/medicham2-browser.js` | 33219d25bdf1 | bf5efb8fafee |

Nothing else differs. The release directory is force-tracked (`git add -f data/releases/df172ccd2aaf/`, 35 paths), as
`97451d5fbf40` is, so the gate artifacts re-open from a clone.

## 3. Pins and flags

- Census: `node tests/test-mechanics.js` -> `data/mechanics-census-regmc.json`, **1027 live / 0 missing / 1027
  probed**, `run_ok: true`, 0 hollow. Pinned by content digest: `data/verification/census-pin-regmc-9ad4bf9cc3a2.json`.
  register_reality rewrote the census mid-sequence; it was restored to the pin afterwards (`cmp` identical).
- Team store: `data/team-pool-frozen-regmc`.
- Lattices: `node engine/game_differential.js --steering empirical --arm middle --end-state --release df172ccd2aaf
  --census data/verification/census-pin-regmc-9ad4bf9cc3a2.json --team-store data/team-pool-frozen-regmc --write --out
  <gate path>`, with **`--games 1200`** (+ `--dump-games 2000 --dump-out
  data/verification/gd-regmc-df172ccd2aaf-dump.json`; nothing diverged, so no dump was written), **`--games 1600`**
  and **`--games 1900`** (the Reg M-C row of `LATTICE_GAMES`, `engine/quarantine.js`).
- The ingest bot committed two store shards during the run (08:48Z and 09:28Z). The lattices read the pinned pool, so
  they are not affected; the coverage clause reads the store and still reads 269 of 269.

## 4. Results

| step | exit | seconds | reading on df172ccd2aaf | on 97451d5fbf40 |
|---|---|---|---|---|
| census | 0 | 29 | 1027/0/1027 | 1027/0/1027 |
| lattice 1200 | 0 | 160 | 0 board / 0 narration of 955 (954 + 1 void) | same |
| lattice 1600 | 0 | 205 | 0 / 0 of 1266 | same |
| lattice 1900 | 0 | 248 | 0 / 0 of 1497 | same |
| engine diff `--n 6000 --seed 20260804` | 0 | 76 | 0/6000 at midpoint, top, bottom, idx01-idx14 | same |
| roster items | 0 | 26 | 166/166 | same |
| roster abilities | 0 | 55 | 210/214 (3 ANNOUNCEMENT-ONLY on receipts, Illusion closeted) | same |
| roster moves | 0 | 43 | 510/511 | same |
| all-mechanics-fire | 0 | 123 | 4,867 games, 0 threw, 0 diverge | same |
| register_reality | 1 | 1739 | 52 disagree, 14 markers rejected, 18 answered nothing | 52 / 14 / 18 |
| quarantine | 0 | 49 | **OPEN, 10 of 10** | OPEN, 10 of 10 |

The run took about a tenth of the wall time the `97451d5fbf40` run took (1754 s -> 160 s for lattice 1200). The
machine was idle this time. The artifacts carry the same game counts and the same pools, so this is speed, not a
smaller sample.

**What moved: nothing.** A field-by-field diff of the three lattice artifacts against the `97451d5fbf40` versions in
HEAD shows 12 changed fields each, and all 12 are stamps: `generated`, `elapsed_s`, the release id and its cut time,
the census pin path and digests, and the simulator digest. Pools (`team_pool_digest` 3c60452ad2c5 / 2d8e6931a914 /
ede5538f9153), game counts, divergence counts, speed-agreement readings and every class table are identical.

**The expectation, stated in advance, held, and here is why.** `spreadFor` in `engine/game_differential.js` sets
`hp: 0` on every body (its header explains this was because the old level-50 line had no HP term). So no lattice body
carries HP Stat Points, and the 1.51.0 fix cannot change a lattice board. No Palafin-Hero body under a non-neutral
nature parted either. The fix is proved by `tests/probe_mega_spread_stat.js` (162/162, per the 1.51.0 report), not by
the pool.

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

## 6. Step 9 of the 1.51.0 OWED list: `tests/test-nature-differential.js`

Run on the main checkout under Reg M-C. Parts 1 to 6 are green, including part 4 (the nature survives a mega mid-turn,
both engines and the authority agree before and after). **Part 7 fails, and not for the reason the 1.51.0 report
gave.** Its baseline, release `6b5447db1738`, was cut for Reg M-B's `data/engine-data.js`; under `regmc` the release
loader refuses it by name ("A release is a photograph of the engine FOR one regulation"). So part 7 cannot run on Reg
M-C on any release, real or temporary. This is a harness limit, not an engine result. Not fixed here (no fixing while
measuring).

## 7. Side effects handled

- `data/forme-assert-regmc.json` was rewritten by the register sweep (a one-line stamp). Not a gate artifact; reverted.
- `data/published-samples-regmc.json` moved its engine-diff high-water timestamp (sample 6000 unchanged). Committed, as
  in 1.46.1.
- `node engine/status.js --write` (Reg M-C) restamped `docs/{ENGINE,MEASURE,OPS,SOLVER,WEB}.md`, run a second time after
  the release was staged so the ENGINE block no longer reads "untracked release". It prints two things that are not
  ENGINE's and were not touched: WEB's bundle DRIFTED (web is paused, red waived), and `feature_fixture --check`
  firing on the fixture identity and damage table gates (MAG's refit inputs; MEASURE).
- Untracked files found in main and left alone (not mine): `data/engine-release-regmc.json`, `data/roster-regmc.json`,
  `data/roster.{abilities,items,moves}.prev-regmc.json`.
- Scratchpad: this pass wrote `gate1001.js`, `nat1001.js`, `st1001.js` and `g1001-*.log` there. None is in the repository.

## OWED, NOT RUN

- **The lattices are blind to HP Stat Points.** `spreadFor` gives every body `hp: 0`, a choice its own header ties to
  an HP term medicham2 did not have. Whether to put HP points into the spread now is a sample-definition change (it
  moves the lattices), so it is a decision for the owner of the differential, not a fix to make inside a gate run.
- `tests/test-nature-differential.js` part 7 needs a Reg M-C baseline release; the Reg M-B one cannot be opened under
  `regmc`.
- **SOLVER:** stamp `_sp` in `applySpread` (1.51.0 report, section 9), then re-measure any arena figure that megas or
  plays Palafin. A SOLVER figure measured on `97451d5fbf40` stays on that release.
- register_reality's hygiene (52 / 14 / 18) is not addressed here. It does not gate.
