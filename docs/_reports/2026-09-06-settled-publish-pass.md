# Settled-tree publish pass — 2026-09-06

Dated findings record. Not a living document, not maintained, not current state. `node engine/status.js`
is current state.

## What this pass was

The publish half of three sessions of engine work. Batches D and E landed in `docs/ENGINE.md` with the
CHANGELOG deliberately not bumped, because a documents agent held the living files at the time and
CLAUDE.md's single-writer rule says two agents that cannot see each other's edits produce a silent
later-write-wins. This pass ran on a settled tree with nothing else in frame.

## Every figure, re-read from its artifact

Nothing below was carried from the brief or from an earlier document. Where the brief and the artifact
could be compared, they agreed; the disagreements column is empty.

| quantity | artifact | field | reading |
|---|---|---|---|
| games | `data/game-differential.json` | `state.games` | 961 |
| boards never parted | `data/game-differential.json` | `state.games_board_never_diverged` | 920 |
| **board-material** | derived subtraction | 961 − 920 | **41** |
| **protocol first divergence** | `data/game-differential.json` | `diverged` | **108** |
| narration-only, raw | `data/game-differential.json` | `state.protocol_diverged_board_never_did` | 72 |
| **narration-only, published** | 72 less 1 declared | — | **71** across 70 causes |
| release | `data/game-differential.json` | `engine_release` | `14b62cd5aeec` |
| turn cap | `data/game-differential.json` | `turns_cap` | 20 |
| arm | `data/game-differential.json` | `pins.primary` | `middle` |
| steering | `data/game-differential.json` | `steering.policy` | `empirical-click/v1` |
| pool | `data/game-differential.json` | `pins` / run argv | `--team-store data/team-pool-frozen` |
| driver code stable | `data/game-differential.json` | `driver_code_stable` | true |
| turn boundaries | `data/game-differential.json` | `state.turn_boundaries_compared` / `_identical` | 10539 / 10409 |
| census | `data/mechanics-census.json` | `live` / `probed` / `missing` | 829 / 829 / 0 |
| damage differential | `data/engine-diff.json` | `compared` / `disagreed` | 6000 / 0, midpoint and sixteen band indices |
| protocol events | `data/protocol-events.json` | `emittedCount` / `notEmittedCount` | 44 / 50 |
| withheld artifacts | `engine/quarantine.js` | computed | 63 |
| gate | `node engine/status.js` | computed | 7 of 9 clauses pass |

**The one figure that is a subtraction and not a field is board-material.** `status.js` performs it and
prints both operands. This pass checked the operands, not the difference — a difference cannot be
audited against an artifact and an operand can.

**The batch-D comparison point.** `data/verification/longtail-D-anybucket.json` on release
`2a5fd78725e7`: `state.games` 961, `state.games_board_never_diverged` 915 (board-material 46),
`diverged` 111, `state.protocol_diverged_board_never_did` 70 (narration 69 after the declared row).

## The narration rise, 69 → 71

Not a regression, and it must never be published without the sentence that says so.

The narration clause counts games that diverge in NARRATION and never part a board. **Repairing a board
does not remove a game from the tally — it moves it out of the BOARD-MATERIAL column and into the
NARRATION one.** The game still diverges; it has simply stopped disagreeing about state.

| | board-material | narration | together |
|---|---|---|---|
| batch D, release `2a5fd78725e7` | 46 | 69 | **115** |
| now, release `14b62cd5aeec` | 41 | 71 | **112** |

Three games net. A count that rises for a good reason looks identical to a count that rises for a bad
one; only the sentence separates them.

## What `node engine/status.js --write` printed

Run last in the sequence, on a settled tree. No `<!-- GENERATED -->` block was hand-edited.

**WEB carries a generated block for the first time, and the first thing it reports is a drift.**

- `web/quarantine-data.js` built 2026-08-25 19:07 publishes **3 of 8 clauses failing, gate CLOSED**.
- The live gate says **1 of 8 GATING clauses fail** and is CLOSED — one, not three, because narration
  reports and does not gate.
- Published clause the gate no longer has: `whole-game differential / the same game on both engines`.
- Clauses the gate has and the bundle does not: the whole-game BOARD-MATERIAL clause and the whole-game
  NARRATION clause.
- Withheld set: 60 artifacts in the bundle against 63 today.
- **0 figures are RELEASED to the pages.** Every other slot carries no value at all, which is the
  withheld-not-annotated rule holding inside the bundle.
- `web/status-data.js` built 2026-08-10 21:32: 13 of 51 slots carry state `quarantined` and publish no
  value.
- `docs/WEB.md` itself is clean — no figure in it is sourced from an artifact the gate withholds.

The rebuild is `node web/build-quarantine.js && node web/build-status.js`. WEB is a paused division and
a publish is Will's call, so this is reported and not run.

## What was fixed here rather than reported

**`tests/test-roadmap-register.js` was RED on entry**, on one item a ledger schedules that the register
does not name: `#4 cited by docs/ENGINE.md`. It was not a scheduling gap. A batch-E sub-heading wrote a
within-batch step number in the `#N` shape that the register gate reads as a ROADMAP citation. The
heading now names the step in words. Gate reads 3 passed, 0 failed.

## What is red and was not chased

`tests/test-web-quarantine-loaders.js` and `tests/test-web-status.js` fail on stale `web/` build
products. They were demonstrated red at HEAD with this session's changes stashed, so they are
pre-existing and not caused by this pass. WEB is paused. They are reported, not filed as known.

## What is still withheld

- **Leaf calibration — this division's one number — was NOT run.** `data/winrate-backtest.json` is
  downstream of MEDICHAM and the gate is shut on the board-material clause. No reliability curve is
  published in 5.262.0 and none is implied by anything in it. It becomes runnable, not true, when the
  gate opens: `node engine/backtest_winrate.js`.
- **The MAG refit stays OWED, as a REFIT and not a restamp.** No fit was started and
  `data/policy-weights.json` was not touched. `feature_fixture --check` fires two gates, fixture
  identity and damage table; a restamp answers the first and SILENCES the second, writing over the
  evidence for the refit. The three inputs that moved after the fit are
  `engine/medicham2-browser.js`, `data/engine-data.js` and `data/abra-tags.js`.
- 63 artifacts are downstream of MEDICHAM and are withheld rather than captioned.

## Files touched

`CHANGELOG.md` (5.262.0); `docs/ABRA-whitepaper.md`, `docs/ABRA-deck-plain-english.md`,
`docs/ABRA-technical-docs.md`, `docs/SUMMARY.md`, `docs/MODELS.md`, `docs/DAMAGE-STAGES.md` (version
block plus header); `docs/ENGINE.md` (CHANGELOG pointers, the two owed sections marked discharged, the
`#N` reword); `docs/MEASURE.md` (this pass's section); the generated blocks in the five division
ledgers, written by `node engine/status.js --write`; the PDFs rebuilt from the markdown.

Batch accounts, not repeated here: `docs/_reports/2026-09-06-longtail-batch-D.md`,
`docs/_reports/2026-09-06-longtail-batch-E.md`,
`docs/_reports/2026-09-06-quarantine-classifier-fix.md`.
