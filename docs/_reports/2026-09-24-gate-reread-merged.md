# Merge-pass debts cleared, and both MEDICHAM gates re-read on the merged engine: 2026-09-24 (abra/regmc 0.111.2 – 0.112.1)

ENGINE. Part 1 cleared what `docs/_reports/2026-09-24-merge-pass.md` §8 left owed, one commit each. Part 2 re-read both
gates on the merged engine by the pass-10 protocol (`docs/_reports/2026-09-24-gate-reread-pass10.md`).

## Part 1

| | item | result | commit |
|---|---|---|---|
| a | `node engine/tag_dex.js` exits 1 under Reg M-B, 12 tags "matched nothing" | **Fixed at the root.** The predicates are shared; the tag files are per regulation; `EXPECTED_EMPTY` is a Reg M-B list of names. So every tag written for Reg M-C whose members are `Past` in Reg M-B read as a bug. An empty tag is now re-run over the entities of its kind that EXIST and are OUT of this regulation's scope (the same scope verdict `collect` asks); a tag no entity here even has a handler for is checked against the sibling regulation's catalogue. Either way it is printed with the members it would have had. A tag that matches nothing anywhere still fails. Reg M-B: 11 by out-of-scope members (Revival Blessing, Court Change, Glaive Rush, 18 gems, 4 seeds, Rocky Helmet, Air Balloon, Red Card, Eject Button, Emergency Exit / Wimp Out, Liquid Ooze), 1 by the sibling catalogue (`escapesTrap` on abilities: Run Away carries `onTrapPokemon` only in Reg M-C's mod). Exit 1 -> 0. | `f4e9751b` 0.111.2 |
| a | regenerate both tag files | Every entity row's tags and params are identical to the hand-merged files (param KEY ORDER differs on 51 / 53 moves). Metadata moved: Reg M-B gains the 12 zero-member rows; both files' `bypassesSubstitute` / `allyBasePowerBoost` now name a consumer (were `null`); Reg M-C's `punishesAttacker` count 13 -> 14 and `condStatMult` 2 -> 3 (the member lists already held 14 and 3; the hand merge had not updated the counts). `sheet_entries` 316,656 -> 309,600 (Reg M-B) and 215,244 -> 205,836 (Reg M-C): store-side, OPS's to explain. The pre-commit bundle gate then required `data/abra-tags.js` rebuilt (`build/build_tags_js.js`), and the docs gate caught one restated figure (Ice Spinner 301 -> 299 sheet uses, `docs/REGULATION-ROTATION.md`), struck through. | same |
| a | Gravity row | `refusedByPseudoWeather` identical in both files: bounce, fly, flyingpress, highjumpkick, magnetrise, one `move: Gravity` line. That equals the legal `flags.gravity` moves of both formats, read from both checkouts. | — |
| b | Gravity knobs missing from the census `DELIBERATE_BREAK` | Added `gravityMenuOpenRestored`, `gravityChosenPlayedRestored`, `gravityClickedMovePlaysRestored`, `gravityCalledMovePlaysRestored`. Each knob armed alone stamps its key: 0 of 4 listed at HEAD, 4 of 4 after. | `8e7b6376` 0.111.3 |
| c | three probes default to the Reg M-B checkout | Mimicry, added-type, Reflect Type probes now require `engine/showdown_path.js`. Failure shown first: `--regulation regmc`, `SHOWDOWN_PATH` unset, release `318ccd937118` -> 3 of 3 CANNOT-ANSWER ("REFUSING to resolve format gen9championsvgc2026regmc"). After: 6 of 6 exit 0 (Reg M-C `318ccd937118`, Reg M-B `d9d69d58ef31`). | `98082734` 0.111.4 |
| d | `data/provenance-stamp.json` | **Not appropriate before the measurement.** Before Part 2, `status.js --write` changed nothing but `verified` 7 -> 3: the stamped gate artifacts pointed at releases the merged tree no longer matched. After Part 2 the same command reads `verified` 7 -> 11. That is a real gain on content digests, so it was committed after the measurement. | 0.112.1 |
| e | `probe_bounced_fail_names_bouncer --regulation regmc` ×5 | **5 of 5 exit 0.** Every assertion is green and the output is byte-identical across the five runs (it is deterministic). Logs: scratch `bounced-mc-{1..5}.log`. **The merge pass's "torn pointer by another process" reading is refuted.** When the probe gets no `--release`, it loads `engine/game_differential.js`, and that module CUTS a release from the live tree and rewrites the regulation pointer on every run, with the `why` string "game differential mode A". The three 13:29Z cut events on `b72450580e0e` all name `tests/probe_bounced_fail_names_bouncer.js` as their `by.entry`. That is the failing run and its two re-runs, cutting the SAME id. So the engine under the red run was the same bytes as the green ones. **The one red stays unexplained, and it was not reproduced in 8 runs.** A stale-bytes case would have exited 2 (the kit refuses when the release does not hold the live engine), not 1. | — |

Found and left alone: `data/engine-release-regmc.json.tmp8920` (untracked, 09:17 local), a leftover of an interrupted pointer write. It is not mine and it was not deleted.

## Part 2 — protocol

Releases were cut after 0.111.4 (`98082734`). Reg M-C **`78fb4a85b1a0`** already existed from the same tree, because the item (e) probe runs had cut it. My cut appended an event. Reg M-B is **`fb8073869b72`** (`SHOWDOWN_PATH` explicit). Every heavy run went through `cmd.exe /c tools\lownode.cmd`, one at a time, from a `spawnSync` driver, and each log ends in `##EXIT`. No file under `engine/`, `tests/` or `tools/` moved during the runs.

Order for each regulation: census (`tests/test-mechanics.js`) -> pin -> the three lattices -> `tests/test-engine-diff.js --n 6000 --seed 20260804` -> `tests/roster.js --stage {items,abilities,moves} --reds --write --release <id>` -> `engine/all_mechanics_fire.js --release <id> --write` -> `engine/register_reality.js` -> census restored to the pin -> `engine/quarantine.js`.

| reg | census pin | pool | `--games` |
|---|---|---|---|
| Reg M-C | `data/verification/census-pin-regmc-ccd979c30997.json` (1024 live / 0 missing / 1024 probed) | `data/team-pool-frozen-regmc` | 1200 (+ `--dump-games 2000 --dump-out data/verification/gd-regmc-merged-dump.json`), 1600, 1900 |
| Reg M-B | `data/verification/census-pin-8fe58c13659e.json` (1020 / 0 / 1020) | `data/team-pool-frozen` | 1200 (+ dump; nothing narration-only to dump), 1350, 1950 |

Lattice flags: `--steering empirical --arm middle --end-state --release <id> --census <pin> --team-store <pool> --games N --write --out <gate path>`.

Two incidents, both in my own driver and neither in the engine:
- The first Reg M-C lattice attempt exited 1 at argv, before any game was played. The pin path had been overwritten by a step-status object of the same name (`--census [object Object]`). I fixed the driver and re-ran all three lattices after the register step. They read the pin, not the live census, so the order does not change what they measured.
- `register_reality.js` re-runs `tests/test-mechanics.js`, which rewrote both censuses again: Reg M-C `a4f3f145cf49`, Reg M-B `0f182849ac12`. Both were restored to the pin bytes before `quarantine.js` read them, as in pass 10.

## Reg M-C: CLOSED, 1 of 10 gating clauses fails (was 5 of 10)

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at the midpoint, top, bottom and all 14 interior indices |
| roster / items | PASS | 166/166 |
| roster / abilities | PASS | 210/214 tested. **0 COULD-NOT-STAGE** (was 3: Effect Spore, Natural Cure, Regenerator). 3 ANNOUNCEMENT-ONLY accepted on receipts (Anticipation, Forewarn, Frisk). 1 deferred by owner (Illusion) |
| roster / moves | PASS | 510/511. **0 COULD-NOT-STAGE** (was 1: Belch). `needs-a-berry-already-eaten` is HELD with its rule (#318, pre-#318 bodies) and no longer fails the stage |
| coverage | PASS | 269 moves above 25 clicks |
| board leaves | PASS | 0 uncompared (58 compared) |
| whole-game BOARD-MATERIAL | PASS | **0/955, 0/1266, 0/1497** |
| whole-game NARRATION | **FAIL (CANNOT-ANSWER)** | No `whole-game-baseline` exists. Undeclared narration-only games: **3/955, 5/1266, 6/1497** (pass 10: 6, 12, 9). **No baseline was stamped; that is Will's call.** |
| mechanics staged | PASS | 0 diverge; every in-scope row proven. `all-mechanics-fire-regmc`: 4,867 games, 0 threw. Pixilate / Refrigerate are no longer listed |
| no open known engine defect | PASS | no open row names a RED instrument (205 verdicts read). #442 reads GREEN under Reg M-C (STALE ROW). `register-reality-regmc`: 51 rows disagree with their instrument, 14 markers rejected, 23 instruments answered nothing. These are register hygiene, and none of them holds this clause shut |

**The three Reg M-C narration games at `--games 1200`** (full dump, 3 of 3):
1. Leppa Berry `-enditem … [eat]` against `-heal … [from] revivalblessing`: ordering. This is the same game-shape as pass-10 item 1.
2. and 3. `-end|<side>|fallenundefined` missing from MEDICHAM (Showdown writes it, and the name renders as `undefined`). This is the pass-10 faint-line item.

Pass 10's Lightning Rod `-activate`, Emergency Exit ordering and bounced `-fail` games no longer appear in this lattice. By class, per quarantine: 1200 is emission 2, rule 1. 1600 is ordering 2, emission 2, rule 1. 1900 is rule 2, emission 2 and unparsed 2. The 2 unparsed are "medicham2 stopped emitting while showdown continued", which has no comparator grammar. Only the 1200 lattice was dumped.

## Reg M-B: CLOSED, 1 of 10 gating clauses fails (was 4 of 10)

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at every index |
| roster / items | PASS | 148/148 |
| roster / abilities | PASS | 196/200. **0 COULD-NOT-STAGE** (was 3). 3 ANNOUNCEMENT-ONLY on receipts, 1 deferred |
| roster / moves | PASS | 496/497. **0 COULD-NOT-STAGE** (was 1) |
| coverage | PASS | 412 moves |
| board leaves | PASS | 56 compared |
| whole-game BOARD-MATERIAL | PASS | **0/961, 0/1069, 0/1497** |
| whole-game NARRATION | PASS | 0 undeclared on every lattice (raw 0, 1, 2; each declared) |
| mechanics staged | PASS | 0 diverge. `all-mechanics-fire`: 4,632 games, 0 threw |
| no open known engine defect | **FAIL** | **#442's instrument (`tests/probe_census_reproduces.js`) is RED.** The committed Reg M-B census claims 1004, and the tree reproduces 1020/1020. That is UNDERCLAIM, the same stale-artifact reading as the 0.100.3 re-read. The row's own fix is to republish the Reg M-B census. |

## What blocks each gate, in plain words

- **Reg M-C:** nothing except a narration bar that has never been set. Boards agree everywhere. 3/5/6 games still differ in commentary only: the Revival Blessing / Leppa ordering, and Showdown's `-end … fallenundefined` line that MEDICHAM does not write. The clause cannot pass until Will stamps a baseline. Stamping one is his decision.
- **Reg M-B:** nothing except the committed census being older than the engine: 1004 published, 1020 reproduced. The engine is not wrong. The closed 7.0.0 record publishes 1,004. Republishing the census, or retracting the figure, is Will's call.

## Artifacts

Committed: Reg M-C's gate artifacts (`game-differential{,.g1600,.g1900}-regmc`, `engine-diff-regmc`, `roster.{items,abilities,moves}-regmc`, `all-mechanics-fire-regmc`, `mechanics-census-regmc` (= pin `ccd979c30997`), `register-reality-regmc`, `published-samples-regmc`). Reg M-B's lattices (`game-differential{,.g1350,.g1950}`), `engine-diff`, `register-reality`, `published-samples`, `forme-assert`, `engine-release.json`. Both census pins and `data/verification/gd-regmc-merged-dump.json`. The restamped ledgers.

**The Reg M-B roster and staged-harness artifacts were committed**, because their figures EQUAL the closed documents: 148/148, 196/200, 496/497 and 4,632 games. **The Reg M-B census was NOT republished.** It reads 1020 against the published 1,004. `data/mechanics-census.json` stays at HEAD, and this pass's reading is parked at `data/verification/mechanics-census-fb8073869b72.json`. Copies of all five Reg M-B readings are parked at `data/verification/*-fb8073869b72.json`. The Reg M-B gate table above was read with the 1020 census in place, before it was parked. **Still owed, and Will's call:** fold 1,020 into the Reg M-B documents, or leave #442 red.

Not committed and not mine: `solver/LOG.md`, `docs/SOLVER-PLAN.md`, `data/engine-release-regmc.json`, `data/engine-release-regmc.json.tmp8920`, `data/roster-regmc.json`, `data/roster.*.prev-regmc.json`.
