# Fix-rows wave 3 — record-keeping for MINOR 5.278.0 (2026-09-10, MEASURE)

Historical findings record; never maintained, never cited as current state; superseded by the register rows it feeds.
**No commit was made. Nothing played a game.** Not run: `node engine/status.js --write`, `tests/run-all.js`, any
differential — a heavy chain follows this commit and restamps the generated blocks.

## Landed

Every figure was read from its artifact before it was written. `data/game-differential.json` release `489bea0577bc`,
generated 2026-09-10T02:18:06Z: `state.games` 961, `state.games_board_never_diverged` 961, `state.games_void_excluded` 0,
`mid_void.diverged_among_usable` 7, `first_divergences` 7 of 7 → NARRATION 6 of 961 after the closeted perish row, 7 causes.
`data/engine-diff.json` 6000 / 6000 / 0; `data/roster.{items,abilities,moves}.json` 142 / 139 / 487 tested, 0 differ;
`data/all-mechanics-fire.json` 1313 games; `data/mechanics-census.json` 835 / 835 / 0 — all stamped `489bea0577bc`.
`data/moves.ts:16166-16177` is Shed Tail's `onTryHit` with the three refusal arms as the batch Z report states.
`node tests/test-fixture-legality.js` re-run: 2 FAILED, the one survivor (`engine/game_differential.js:6186,6256,6325,6348`,
Incineroar Knock Off), 632 files / 2367 declarations / 753 distinct sets.

| file | what |
|---|---|
| `docs/RUNNING-NOTES.md` | three `[5.278.0]` rows — batch Z (ENGINE), fixture legality batch 2 (MEASURE), the residual trio derivation (ENGINE; fix not applied). Supersedes `~~9 of 961, 10 causes~~` and `~~7d66b526659e~~`; retracts the `~~65/75 not a tie~~` reading. |
| `CHANGELOG.md` | `## [5.278.0] — 2026-09-10` opened: Added / Changed / Fixed / Notes; MINOR; notes that the residual-trio fix and its re-measure follow in the same release, that the loop-nesting plan is REFUTED and the resolution-order "KNOWN-OPEN arm" receipt does not exist. |
| `docs/ROADMAP.md` | #563 residual trio (ENGINE defect, mechanism derived, fix site `residualOrder`, verified by the two probes, open); #564 Shed Tail `[weak]` bare (ENGINE, open); #565 raw-learnset legality walk — 37 files measured (report said 34 by arithmetic), plus the differential's Incineroar survivor as a sibling (MEASURE, open); #566 `--dump-out` absolute path (MEASURE instrument, open); #567 pool pairing moved three times under identical flags (MEASURE, observed not explained, open). #557 / #559 untouched — no report says anything about them; #559 was already closed. Nothing closed. |
| `docs/ENGINE.md` | one dated section above batch Z's (which the batch Z agent had already written): the trio derivation, the 117/117 receipt, the false header sentence, which scoreboard the fix should move. |
| `docs/MEASURE.md` | one dated section: fixture legality batch 2, the three-control attribution of the one red probe, the fake-green `cmd /c` shape, and the three instrument notes (`--dump-out`, dump cards carry no Speeds, pool pairing drift). |

Discrepancy recorded rather than smoothed: the fixture report's "34 files still walk raw learnsets" was 47 − 13; the tree at
this pass reads 37 (`grep -l "e.learnset && e.learnset\[id\]" tests/*.js`), none calling `canLearn` — 36 at HEAD plus
`tests/probe_substitute_family.js`, new tonight. The rows carry 37.

## Gates

- `node tests/test-docs-current.js` — **35 passed, 0 failed**; backlog 75 of 100; top 5.278.0 read as a minor bump against
  the rows' declarations. No same-day re-measurement red appeared against `data/game-differential.json`, so no baseline key
  was added; `data/docs-currency-baseline.json` was not touched by this pass (its uncommitted diff is the batch Z agent's
  ratchet tightening).
- `node tests/test-docs-quarantine.js` — all checks passed.
- `node tests/test-roadmap-register.js` — **3 passed, 0 failed**; 533 items.

## OWED, NOT RUN

- The commit — sole publisher's. `git add -f data/releases/489bea0577bc` if the artifacts are to cite an openable snapshot.
- `node engine/status.js --write` after the heavy chain, so the generated blocks agree with the prose.
- The residual-trio fix at `residualOrder` and its re-measure (#563; expect narration 6 → 3 of 961, board-material unchanged).
- The Shed Tail `-fail` line (#564). The `--dump-out` one-liner (#566). The pool-pairing diagnosis (#567).
- `tests/test-mechanics.js` `DELIBERATE_BREAK` naming `subAbsorbAtApplyRestored`; the census digest stamp on
  `data/all-mechanics-fire.json`; the `probe_default_target_side` near-side counter card (ENGINE).
- The Incineroar Knock Off survivor in `engine/game_differential.js` (four sites; the damage-interior figure must be re-derived).
