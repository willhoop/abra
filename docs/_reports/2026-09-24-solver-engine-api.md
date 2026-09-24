# Solver-facing MEDICHAM API: the additive steps

Historical findings record; not maintained, superseded by the register rows it feeds.

**Date.** 2026-09-24. **Division.** ENGINE. **Line.** abra/regmc 0.95.0. **Brief.**
`docs/_reports/2026-09-23-engine-interface-brief.md`.

## Verdict

- **Landed:** `engine/medicham_api.js`. It covers the brief's steps 2, 3 and 4, and the additive half of step 5.
  - `clone` is structuredClone without the trace sink.
  - `makeRng` gives fixed-seed dice that can be forked. `makeEventDice` gives the engine's addressed dice.
  - `legalActions(S, side)` returns per-slot options and the joint set as Showdown choice strings.
  - `step` builds a new state and never touches its input. `stepInPlace` is its in-place twin.
  - `isTerminal` and `winner` read the wipe only. `atHorizon` and `horizonScore` are named separately.
  - `digest` returns a canonical state hash.
- **The two cross-battle leaks are fixed opt-in, which makes the fix provably neutral.** A battle carries its own
  event-dice repeat map and the three trace fields only if the API built it (`S._scope`). Every other battle takes the
  old code path.
- **Not done: the mid-turn-choice callback (step 6).** Replacements and pivots are still pre-committed.
  - A joint array may carry `.replaceWith = <team index>`, and an option may carry `pivotTo`.
  - Both write the fields the engine already reads. No acceptance test exercises either one.
- **No published figure moves.** The differential is byte-identical at `--games 1200` (details below).
- **Found:** `legalActions` disagrees with the authority on 26 of 5,552 slots. All 26 are **ENGINE menu defects** that
  the API reads faithfully (§4). They are left open because a fix changes what the engine's own chooser plays.

## 1. What changed

| File | Change |
|---|---|
| `engine/medicham_api.js` (new) | The wrapper. `bind(M)` takes a release's engine module. A release without the new exports is refused by name. The default export loads `regulation.js`, then the table, then the live engine. |
| `engine/medicham2-browser.js` | `MID_NTH`/`MID_LOG` change from `const` to `let`. Adds `battleScopeNew` and `battleScopeRun`. `battleTurn`'s first line runs the turn inside `S._scope` when one is set. Exports `selectableMoves`, `mustStruggle`, `sideWiped`, `battleScope*`, `moveTargetClass`, `moveTagParam`. |
| `engine/engine_release.js` | `engine/medicham_api.js` is added to `SOURCES`. |
| `tests/test-medicham-api.js` (new, in the suite) | T1, PURE, T2 and END, with red children. |
| `tests/medicham_api_fixtures.js` (new) | Teams from the regulation's frozen pool, and a seeded pick over the joint set. |
| `tests/medicham_api_diffhook.js` (new) | A `node -r` preload that puts the API inside `game_differential.js`. The instrument's bytes are not edited. |
| `tests/probe_medicham_api_differential.js` (new, on demand, heavy) | T3 (`--part legal`) and T4 (`--part step`). |

**Two things the brief proposed were not taken, because each changes what an existing caller sees:**

- An unconditional move of `MID_NTH` onto `S`.
- Resetting the trace fields in `traceBind`. `_mvLine` legitimately carries across turns of one battle.

The `_IN_TURN` re-entrancy throw is also not in the engine. A nested caller may exist, and the brief does not audit it.
The guard lives in the API instead: `stepInPlace` throws if a step is already running.

**Release loader.** No caller's `need:` list was touched. Running
`engine_release.js compat engine/medicham2-browser.js selectableMoves … moveTagParam` shows two releases can serve the
API (`ffc3504d2fd8`, `9cfd07674cc9`); the base `ec377f6f8159` lacks the exports. Adding a SOURCE moves the
differential's `driver_code` stamp (`64a2dc4f5568` to `dea7bd773a94`), because `engine_release.js` is in the
instrument's closure. A before/after pair that spans this commit therefore reads as two different instruments.

## 2. T1, PURE, T2, END (`tests/test-medicham-api.js`)

**Run.** Reg M-C pool `data/team-pool-frozen-regmc`, 12 team pairs, `--games 12`.

- **T1.** 89 positions, 29 after a mega evolution and 6 with a charging body.
  - Clone and original were played to the end on forks of the same dice. They parted at 0 turns.
  - The original was unchanged after its clone was played out: 0 moved.
  - `step(P)` equals `stepInPlace(clone(P))`: 0 differ.
- **PURE.** `step()` moved 0 inputs and `legalActions()` moved 0.
- **T2.** 8 battles were played alone, round-robin and tree-shaped. 0 of 16 comparisons differ on seeded dice, and 0 of
  16 with **every battle on one event-dice seed**. That second arm is the `MID_NTH` leak.
  - A legacy unscoped battle plays identically with API battles stepped between its turns.
  - A finished battle's winner does not change when other battles are built after it.
- **END.** At turn 20 with both sides standing, `battleOver` is true and `isTerminal` is false. Stepping at the horizon
  throws.
- **Red, run every time:**
  - `MEDI_API_SHALLOW_CLONE=1` fails T1: 6 games parted and threw.
  - `MEDI_API_STEP_IN_PLACE=1` fails PURE: 60 of 60 moved.
  - `MEDI_API_SHARED_SCRATCH=1` fails T2's shared-seed arm: 16 of 16 differ.
- The Reg M-B pool (`data/team-pool-frozen`) is green too.
- Without a pool on disk the test declares `ABRA-EXIT 2 CANNOT-ANSWER`, which is what a worktree gets.

## 3. T4: `step()` inside the differential

**Flags.** `--regulation regmc --steering empirical --arm middle --end-state`, census pin
`data/verification/census-pin-regmc-f3b70bc0c47c.json`, team store `data/team-pool-frozen-regmc`, release
`9cfd07674cc9`, baseline `ec377f6f8159` (a cut of base commit `cf59f23a` before any edit), `--games 1200`: 955 games.

| Arm | Result |
|---|---|
| base release vs new release | Per-game fingerprint byte-identical over 955 games. The artifact differs only in the stamps. Two base-only fields name the release. |
| every turn through `API.stepInPlace` | byte-identical |
| shadow step: every real turn also played on `API.clone(S)` by `stepInPlace`, on a replay of the real turn's dice | The game is byte-identical. **22,283 of 22,283 shadow turns** equal the real turn on digest, protocol and dice consumed. 32 of those turns are on untraced battles. |

- The same result holds at `--games 45`: 38 games and 1,442 shadow turns.
- **Red** (`--games 45`): `MEDI_API_CLONE_DROP=_vol` makes 31 of 1,336 shadow turns differ.

**Why the shadow and not play-on-the-copy.** The first version played the game on the copy and moved its state back.
It parted 38 of 38 games. The reason was the harness: the differential's trace hook reads `S.actA[slot]` live while a
`|switch|` line is written. **Finding for the record:** narration writes state. `_chipFrom` is reset to null only on a
traced turn, so a traced copy of an untraced battle differs by that key.

## 4. T3: `legalActions` against the authority

**Run.** The same pins, `--games 45`, `--state`, so every probed turn stands on agreeing boards.

- 1,388 turns and 5,552 slots were compared. 40 were forced, 296 offered mega, 3,678 offered switches and 1 was
  Struggle. 9 were hidden-trapped and 4 hidden-disabled.
- The probe does not move the game: the sample is byte-identical.
- **5,526 agree and 26 disagree.** Every one is the engine offering a move the authority disables:

| Cause | Slots | Evidence |
|---|---|---|
| **Fake Out** after the user used Parting Shot and stayed in | 20 | The authority has `activeMoveActions:1`. MEDICHAM has `_mvActs:0`, and both record `lastMove partingshot`. The Champions mod disables Fake Out on `activeMoveActions` (`data/mods/champions/moves.ts:352`). |
| **Imprison's menu half** | 4 | The authority has `disabled:'hidden'`, source Imprison. This is already declared in the engine above `illegalMoveNow` ("the MENU half — NOT wired"). |
| **Heal Block's menu half** (from Psychic Noise) | 2 | The authority disables Leech Life with source Heal Block. The engine refuses it only at execution. |

- **Red:** `MEDI_API_MEGA_ALWAYS=1` produces 4,888 disagreeing slots.
- **Owed (ENGINE):** fix these three in `moveDisabledBy`. The Fake Out one needs its own diagnosis first: why is
  `_mvActs` zeroed after a Parting Shot that did not switch? Each fix changes the engine's own chooser, so each is a
  MINOR with the differential re-run. `probe_medicham_api_differential.js --part legal` is the failing probe that
  closes them.
- The probe is on demand, not in the suite. It is red by design until those fixes land.

## 5. Commands

```
ABRA_REGULATION=regmc node tests/test-medicham-api.js [--team-store <pool dir>]
SHOWDOWN_PATH=<pokemon-showdown-mc> cmd.exe /c tools\lownode.cmd tests\probe_medicham_api_differential.js --regulation regmc \
  --release 9cfd07674cc9 --baseline-release ec377f6f8159 --games 1200 --part step \
  --census data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store <main>/data/team-pool-frozen-regmc
```

The releases `ec377f6f8159`, `ffc3504d2fd8` and `9cfd07674cc9` were cut in the worktree under `data/releases/`, which
is not tracked. The coordinator will need to re-cut for any measurement in main.
