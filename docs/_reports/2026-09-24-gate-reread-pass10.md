# Both MEDICHAM gates re-read after ENGINE pass 10: 2026-09-24 (abra/regmc 0.87.0)

Measurement only. No file under `engine/`, `tests/` or `tools/` moved during the pass (checked with `git status`
before every live-tree run). HEAD `cf59f23a` (abra/regmc 0.86.1). One release was cut per regulation, after the
pass-10 merge:

| | release | authority |
|---|---|---|
| Reg M-C | `ec377f6f8159` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` (`ABRA_REGULATION=regmc`) |
| Reg M-B | `7822a83cc49b` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit) |

Both ids had already been cut at 01:32Z by a game-differential run on the same tree. My cut appended a cut event
and did not change the id.

Every heavy run went through `tools\lownode.cmd`, one at a time. They were started by a node `spawnSync('cmd.exe',
['/c', 'tools\\lownode.cmd', ...])` argument vector. Each log ends with `##EXIT <code>`. Each artifact was checked for
its `generated` stamp, its `engine_release` and whether it parses.

## Resume check (after the rate-limit stop)

Every Reg M-C run had written its `##EXIT` line before the stop. Every artifact parses and carries `ec377f6f8159`.
None was torn, so nothing was re-run. **One instrument side effect was found and corrected.** `engine/register_reality.js`
runs `tests/test-mechanics.js` as one of its instruments, and that rewrote `data/mechanics-census-regmc.json` at
03:00Z. The pin is `53bfaafa023d` and the rewrite is `f270da1de0df`. The difference is one row's stochastic detail
string: Iron Head flinch 20.0% against 20.1%. Verdicts are identical, 1010/1010 live. I restored the pinned bytes so
that the live census equals the pin the lattices read. The Reg M-B register run did the same thing: census `27a90637b1b4`
was restored to pin `9250024640bf`.

## Pins and flags (every lattice)

`--steering empirical --arm middle --end-state --release <id> --census <pin> --team-store <pool> --games N --write --out <gate path>`

| reg | census pin | pool | `--games` |
|---|---|---|---|
| Reg M-C | `data/verification/census-pin-regmc-53bfaafa023d.json` (1010/1010 live, run_ok) | `data/team-pool-frozen-regmc` | 1200 (also `--dump-games 2000 --dump-out data/verification/gd-regmc-pass10-dump.json`), 1600, 1900 |
| Reg M-B | `data/verification/census-pin-9250024640bf.json` (1006/1006 live, run_ok) | `data/team-pool-frozen` | 1200, 1350, 1950 |

Reg M-C uses 1200/1600/1900 because `LATTICE_GAMES.regmc` in `engine/quarantine.js` declares them.

Other runs: `tests/test-engine-diff.js --n 6000 --seed 20260804`; `tests/roster.js --stage {items,abilities,moves}
--reds --write --release <id>`; `engine/all_mechanics_fire.js --release <id> --write`; `engine/register_reality.js`
under each regulation's environment. `register_reality.js` refuses a `--regulation` flag; the owed block's spelling
of that command does not run. The environment variable selects the regulation.

## Reg M-C: CLOSED, 5 of 10 gating clauses fail

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at the midpoint, top, bottom and all 14 interior indices. Was 3/6000 on `485d0a6840ad`. Volleys are compared, not skipped (`skipped_multihit` 0, 132 volley rows). The Overdrive `SUBPASS` exit 1 is gone. |
| roster / items | PASS | 166/166, 0 DIFFER, 0 DID-NOT-FIRE, 0 refused fixtures (545 sets checked) |
| roster / abilities | **FAIL** | 0 DIFFER, 0 DID-NOT-FIRE, 207/214 tested. **3 COULD-NOT-STAGE: Effect Spore** (inert staging: Showdown's board is identical with and without it), **Natural Cure and Regenerator** (subject arm threw: `Can't pass: Your Gourgeist must make a move`). 3 ANNOUNCEMENT-ONLY accepted on receipts; 1 deferred by owner. |
| roster / moves | **FAIL** | 0 DIFFER, 0 DID-NOT-FIRE, 508/511 tested. **1 COULD-NOT-STAGE: Belch** (subject arm threw: `Can't pass: Your Milotic must make a move`). **1 red demonstration NOT CAUGHT: `move/needs-a-berry-already-eaten`** ("a threshold berry restores nothing when it is eaten"). The run exits 1 on that. Also: Reflect Type is on the usage shelf (0 clicks) with an **underlying FIRED-AND-BOARDS-DIFFER**. |
| coverage | PASS | all 269 moves above 25 clicks |
| board leaves | PASS | 0 uncompared (58 compared) |
| whole-game BOARD-MATERIAL | PASS | **0/955** (954 + 1 void), **0/1266**, **0/1497** |
| whole-game NARRATION | **FAIL (CANNOT-ANSWER)** | No `whole-game-baseline` exists for Reg M-C. Undeclared narration-only games: **6/955, 12/1266, 9/1497**. They were 64, 82 and 92 on `485d0a6840ad`. This clause GATES now (it is counted in the 10). |
| mechanics staged | **FAIL** | **Pixilate: boards part on turn 1.** Feraligatr HP: Showdown 924, MEDICHAM 894. 6006 teams / 24,832 games. **Refrigerate: FIRED ON A LIVE CONTROL, UNEARNED.** It also reads STATE: HP 926 against 930. `all-mechanics-fire-regmc`: 4869 games, 0 threw. |
| no open known engine defect | **FAIL (CANNOT-ANSWER)** | #310 and #442 name instruments that answered nothing usable under Reg M-C. `data/register-reality-regmc.json` now exists for the first time: 45 rows disagree with their own instrument, 14 markers were rejected and 21 instruments answered nothing. Most of the instruments are Reg M-B-era and were run under the Reg M-C environment. |

**The six Reg M-C narration games at `--games 1200`** (full dump, 6 of 6):
1. Leppa Berry `-enditem` against a `-heal … [from] revivalblessing`: ordering.
2. and 4. `-end … fallenundefined`. MEDICHAM is missing an event, and the name renders as `undefined`. This is probably
   the faint-line instrument question.
3. `-fail` names a different body.
5. Lightning Rod `-activate` missing before Electro Shot's `-prepare`.
6. Emergency Exit `-activate` against `faint`: ordering.

These match the pass-10 open list (Emergency Exit, Lightning Rod, the faint line). By class: emission 4, rule 1,
ordering 1.

## Reg M-B: CLOSED, 4 of 10 gating clauses fail

| clause | verdict | reading |
|---|---|---|
| game differential (damage) | PASS | 0/6000 at every index |
| roster / items | PASS | 148/148, 0 refused fixtures |
| roster / abilities | **FAIL** | 193/200. **The same 3 COULD-NOT-STAGE: Effect Spore, Natural Cure, Regenerator** (same causes). The seven proxy-throw rows of the previous pass are gone. |
| roster / moves | **FAIL** | 494/497. **Belch COULD-NOT-STAGE**. **`needs-a-berry-already-eaten` red demo NOT CAUGHT**. Reflect Type is shelved (11 clicks) with an underlying DIFFER. |
| coverage | PASS | 412 moves |
| board leaves | PASS | 56 compared |
| whole-game BOARD-MATERIAL | PASS | **0/961, 0/1069, 0/1497** |
| whole-game NARRATION | PASS | 0 undeclared on every lattice (raw 0, 1 and 2, each declared) |
| mechanics staged | **FAIL** | **Pixilate and Refrigerate part boards** (4025 and 10 teams of 13,116 games); Refrigerate is also unearned on a live control |
| no open known engine defect | **FAIL** | **#442 is open and its instrument is RED.** #442 is the "census committed claiming N while the engine gave N−1" row. `data/register-reality.json` was refreshed; it was dated 2026-09-12. |

## What blocks each gate, in plain words

- **Both regulations:** the -ate abilities (Pixilate, Refrigerate) deal the wrong damage. The roster cannot stage
  Natural Cure, Regenerator or Belch, because the fixture passes where the authority refuses a pass. Its staging for
  Effect Spore is inert. One move red demonstration (berry already eaten) no longer bites.
- **Reg M-C only:** a narration baseline has never been stamped. The register audit cannot answer #310 and #442
  under Reg M-C.
- **Reg M-B only:** #442's instrument is red.

## Not done, and why

- **`node engine/quarantine.js --regulation regmc --stamp-whole-game` was NOT run.** The code calls this stamp
  "the number that becomes the bar is one somebody chose", and the previous MEASURE pass left it as a decision.
  The narration clause now GATES. So the stamp would decide whether a gate clause can pass, and that is not a
  measurement. The counts are above: 6/12/9. **Will decides.**
- **Court Change under Reg M-B (fixture construction) and Heal Bell's control (give it a status)** are test-code
  changes and fall outside a measurement-only pass. They are still owed.
- **The Reg M-B 12,000-game held-out draw** was not re-run. It is not a gate clause. It is still owed.
- **Engine fixes:** none, by brief.

## Artifacts committed

The Reg M-C artifacts the gate reads, `data/register-reality-regmc.json`, both census pins,
`data/verification/gd-regmc-pass10-dump.json`, the Reg M-B lattices (`data/game-differential{,.g1350,.g1950}.json`),
`data/engine-diff.json`, `data/register-reality.json`, `data/engine-release.json`, the `published-samples` ratchets,
the two side effects of the register run (`data/forme-assert.json` and `data/provenance-stamp.json`) and the
status-stamped ledgers.

**The Reg M-B roster, census and staged-harness readings were NOT republished.** The living-docs gate refused the
first commit. `docs/SUMMARY.md`, `docs/ABRA-technical-docs.md` and the deck publish "196 of 200", "496 of 497",
"1,004 probed/live" and "4,632 games" out of `data/roster.{abilities,moves}.json`, `data/mechanics-census.json` and
`data/all-mechanics-fire.json`. This pass reads 193/200, 494/497, 1006/1006 and a new game count. Those documents
are the closed Reg M-B record (7.0.0), and folding new figures into them is a documentation pass, not part of a
measurement. So the published files stay at HEAD, and this pass's Reg M-B readings are kept at
`data/verification/{roster.items,roster.abilities,roster.moves,mechanics-census,all-mechanics-fire}-7822a83cc49b.json`.
The previous MEASURE pass did the same (`2026-09-23-gates-on-finished-engine.md`). **Owed: those four published
Reg M-B figures are superseded by these readings, and the fold-in or retraction is Will's call.** The Reg M-B gate
table above was read with the new artifacts in place (log `q1-regmb`), before they were parked.

`data/engine-release-regmc.json`, `data/*prev-regmc.json` and `data/roster-regmc.json` stay untracked, as before.
`solver/LOG.md` and `docs/SOLVER-PLAN.md` belong to another agent working in main. They are not committed.
