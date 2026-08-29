# Three scope lines added to `engine/coverage.js` — 2026-08-29, MEASURE

Historical findings record. Not maintained, not current state, superseded by whatever
`node engine/status.js` prints. No game was played to produce it.

## What was asked, and what landed

Three facts that are scope — things a clean verdict is not a claim about — existed and were in no
instrument. All three are now rows in `engine/coverage.js`, derived at run time from source or from
artifacts, never typed.

### The three lines, as they print now

```
  board leaves compared                   34 of 56
                                          56 is the CEILING, not the 80 leaves a legal mechanic can write: 4 are
                                          declared uncomparable, 18 carry a declared duration of 1 and are ended in
                                          the residual, and 2 are removed inside their own action (volatile:fling,
                                          volatile:sparklingaria) — none of those 24 can be standing when the board is
                                          read, so 80 is not a target. 22 uncompared leaves CAN stand at a boundary
                                          and are the whole of the widening work. The most-written of the permanently
                                          uncomparable: flinch (20 writers), protect (2 writers), quickguard (1
                                          writer), wideguard (1 writer). BS.snapshot has 1 call site in the driver
                                          (stateCheck, lines 3963, 4253) and 0 elsewhere.

  differential bodies on a REAL spread    0 of 17536
                                          an open team sheet does not carry a spread — every stored sheet reads `evs:
                                          null` — so game_differential.js ASSIGNS one from the body's slot index: 66
                                          points, a 32 cap, a descending Speed ladder [32, 22, 11, 0] by slot, the
                                          remainder to the higher attacking stat and then spilling to spd then def,
                                          and 0 into HP (deliberate: Showdown's Champions line adds the investment
                                          plus 75 for HP and medicham2's L50 line has no HP term, so HP points would
                                          diverge silently on every body). The NATURE is real — `--nature real`, 17440
                                          bodies built from the sheet's own and 96 fallen back to Serious — and BOTH
                                          ENGINES ARE HANDED THE SAME INVENTED SPREAD, so the run is internally
                                          consistent and its damage is NOT METAGAME DAMAGE. Nobody plays these
                                          spreads. A clean damage verdict here is a claim about this construction, not
                                          about what the ladder rolls.

  driver policies the gate quotes         1 of 2
                                          census-coverage-seeking/v1 (game-differential.json, 961 games): 17 reached a
                                          result (1.8%), 944 stopped at the turn cap, 0 truncated because medicham2's
                                          placement could not be mirrored to showdown (0.0%), 0 games whose BOARD
                                          diverged.  census-coverage-seeking/v1
                                          (verification/game-differential.coverage-control.json, 961 games): 17
                                          reached a result (1.8%), 944 stopped at the turn cap, 0 truncated ... (0.0%),
                                          0 games whose BOARD diverged.  empirical-click/v1
                                          (verification/game-differential.empirical.json, 961 games): 459 reached a
                                          result (47.8%), 454 stopped at the turn cap, 42 truncated because
                                          medicham2's placement could not be mirrored to showdown (4.4%, so the result
                                          rate above is a LOWER BOUND), 135 games whose BOARD diverged.  ALL 3 ON ONE
                                          SET OF PINS — release e129bca605e3, cap 12, pool 0d103fb9fa87, so the
                                          difference between them is the DRIVER and nothing else.  6 further artifacts
                                          in this family sit on other pins (oldest 16.4 days old) and are not shown.
                                          arms_comparable.js REFUSES the pair: the selection POLICY differs:
                                          census-coverage-seeking/v1 vs empirical-click/v1 — the scoring rule itself
                                          moved, so identical inputs would still select different samples.  TWO
                                          INSTRUMENTS, NOT A BEFORE/AFTER: a whole-game verdict is only about the
                                          policy it was taken under, and "board-material zero" under a
                                          coverage-seeking driver is a statement about games that do not end.
```

## Were the three claims right?

**All three were right. One number in the brief was low, and one needed a code change before it could
be true of the reader everyone actually uses.**

| claim as briefed | measured | verdict |
|---|---|---|
| 18 unread leaves carry a declared duration of 1 | 18 | correct |
| 2 more removed inside their own action | 2 — `volatile:fling`, `volatile:sparklingaria` | correct |
| the ceiling is 56 of 80, not 80 | 56 (34 compared + 22 standing) | correct |
| `BS.snapshot` has one caller, `stateCheck`, two lines | 1 call site, 2 `stateCheck` lines, 0 other callers in `engine/` or `tests/` | correct |
| the four highest-reach leaves in the hole are permanently uncomparable | **not verified here** — reach needs the 135 MB pool stream. By WRITER count the top of the hole is `flinch` (20), `protect` (2), and both are duration-1 | shape confirmed, reach not re-measured |
| spread: 66 points, 32 cap, ladder `[32,22,11,0]`, remainder to the higher attacking stat, spill to SpD then Def, nothing into HP | all six read off `engine/game_differential.js` at run time and all six match | correct |
| `evs: null` on all 22,909 sheet games | **not verified here** — see OWED | not checked |
| coverage-seeker 1.8% reaching a result, 0 diverging boards | 17/961 = 1.77%, 961/961 boards never diverged | correct |
| empirical 47.8%, 135 diverging boards | 459/961 = 47.76%, 961 − 826 = 135 | correct |
| 42 of 961 (4.4%) truncate on an unmirrorable forced switch | 42, summed over the 29 distinct `the boards parted …` end reasons | correct |
| `arms_comparable.js` refuses the pair on `policy` | it does; the refusal is now quoted from `compare()`, not paraphrased | correct |

**The one number that was low: the brief said `33 of 80`, then `34 of 80`.** It is 34 compared today.
Nothing was wrong — it moved.

**And 135 is not the same quantity as the 128 in `docs/MEASURE.md`.** 135 is
`games − state.games_board_never_diverged`, i.e. every game whose board parted at all. 128 is the
board-MATERIAL subset. The row is labelled "games whose BOARD diverged" for that reason; do not read it
as a board-material count.

## The defect this pass found on its own

**`selfRemovesWithinAction` had two producers and they disagreed on the ceiling — 58 against 56.**

`tests/probe_uncompared_leaves.js` `derive()` — the function `engine/status.js` and `engine/coverage.js`
call — subtracted only the duration-1 leaves, giving 58. `tests/probe_leaf_name_map.js` additionally
subtracted the two removed inside their own action, giving 56 and printing *"the plan says 34 -> 58"* as
though the plan were the thing that was wrong. A coverage line built on `derive()` would have published
58 while the probe published 56.

Fixed by moving the rule (and the `BS.snapshot` call-site derivation it rests on) into
`probe_uncompared_leaves.js`, which now exports `ceiling`, `hole_duration1`,
`self_removed_within_action`, `self_remove_guarded_by_declared_clock` and `boundaryCallSites()`. The
name-map probe calls them; its printed boundary section is unchanged, including the `lockedmove` rescue
by the declared-clock guard.

## How each line degrades

Shown red on a deliberate break before being trusted — `fs.readFileSync` stubbed to throw for
`engine/game_differential.js`:

- `differential bodies on a REAL spread` -> `NOT DERIVED  … spreadFor() did not parse … unreadable: DELIBERATE BREAK`
- `board leaves compared` -> keeps `34 of 56` and appends *"THE BOUNDARY CALL SITES COULD NOT BE COUNTED
  (…), so the CEILING PRINTED ABOVE rests on an unchecked claim"*
- `driver policies the gate quotes` -> every ending class reads `NOT DERIVED` rather than 0; the board
  divergence count survives because it comes from the artifact, not the source

`COVFAILS` gained `driverSource` and `armDir`, both printed in the failed-reads block. No bare catch was
added; `tests/test-no-silent-failure.js` reports **0 NEW**.

## Why these derivations are not prose-parsing

`coverage.js`'s header says nothing here parses prose, and the ending classes are strings. They are
matched by anchoring on the **code** around each literal in `engine/game_differential.js` —
`endReason = battle.ended && M.battleOver(S) ? '…'`, `endReason = END_STATE ? '…'`,
`if (mirrorImpossible) { … endReason = '…'`. Reword a message and the derivation follows it; restructure
the code and it prints `NOT DERIVED`. The same discipline covers the spread: `SP_BUDGET`, `SP_CAP`,
`SPE_LADDER`, the spill list and the `hp:` field are read from source, and a partial parse refuses
rather than describing half a spread from this file's guess.

## Reads, and what was avoided

An ENGINE agent held the machine and was rewriting `data/verification/game-differential.empirical.json`.
Every artifact inspected during this work was read through `git show HEAD:<path>` into the scratchpad,
not from the live tree. The line numbers `stateCheck` reports moved from `3882, 4169` to `3963, 4253`
between two runs an hour apart, which is that agent editing the driver — and is the argument for
deriving them rather than writing them down.

`engine/coverage.js` itself reads the live artifacts, which is correct: it already carries the
`beingWritten` guard (mtime under 60 s) and prints the torn-read warning. Checked at the end of this
pass: the live `data/verification/game-differential.empirical.json` is byte-identical to `HEAD`
(md5 `2b751a7f516480817dbf294805de6545` both ways), so the numbers in the row above do not depend on
which copy was read.

## OWED, NOT RUN

- **`evs: null` on all 22,909 sheet games — NOT VERIFIED.** Confirming it needs a stream of
  `data/games.bo3.jsonl` + `data/games.ots.jsonl` (~135 MB), which is too expensive for a reporter
  `status.js` calls on every run and was not run here. The row rests instead on the artifact's own
  `declared_gaps.spreads_absent` and on `spreadFor()` existing at all. If the count matters, it should be
  stamped into the differential artifact by the driver, not scanned by the reporter.
- **Pool reach for the permanently uncomparable leaves — NOT DERIVED in the row.** The brief's
  `protect` 17,344 / `flinch` 14,366 / `ragepowder` 9,690 / `helpinghand` 6,334 came from
  `tests/probe_leaf_name_map.js --pool`. The coverage row prints WRITER counts instead and says so;
  `--pool` streams 135 MB and must not run inside `status.js`.
- **`node engine/status.js --write` — NOT RUN.** ENGINE was mid-run on the differential and a `--write`
  restamps generated blocks in every ledger from artifacts that were moving. `node engine/status.js`
  was run read-only and exits 0 with the three rows in place.
- **No commit, no push.** Working tree carries `engine/coverage.js`,
  `tests/probe_uncompared_leaves.js`, `tests/probe_leaf_name_map.js`, `docs/MEASURE.md`,
  `CHANGELOG.md` (5.211.0) and this file.
- **The empirical arm's 42 truncations are being fixed by ENGINE right now.** The row derives the
  number, so it will follow that fix down without an edit — but any figure quoted from
  `data/verification/game-differential.empirical.json` before that lands is a lower bound and must say so.
- **Debris seen, not touched:** `data/verification/gd-empirical-cards.json` is the same SIZE as
  `game-differential.empirical.json` (both 882,298 bytes) and is NOT the same bytes — md5
  `47fa9607…` against `2b751a7f…`. It is a near-copy of the same run, not a duplicate. Reported and
  left exactly where it is.
