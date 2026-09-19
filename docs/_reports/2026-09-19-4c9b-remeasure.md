# 6.59.0 re-measured on `4c9b0cc4a4da` — 2026-09-19, ENGINE (measure only)

A findings record, not a living document. Superseded by the register rows it feeds; not cited as current
state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.

---

## PREDICTION — written before any lattice was launched

Sources: `docs/_reports/2026-09-19-1a65-remeasure.md` §4 (the whole population on `1a6550ea5ec6`),
`docs/_reports/2026-09-19-narration-c.md` (OWED 1) and `docs/_reports/2026-09-19-narration-d.md` (OWED).

The eight undeclared games on `1a6550ea5ec6`, and what 6.59.0 claims for each:

| lattice | seed (first) | idx | mechanism | fixed by | predicted |
|---|---|---|---|---|---|
| 1350 | `…2659123487` | 6 | Forewarn `-activate` | narration C | LEAVE |
| 1350 | `…2657893729` | 38 | Forewarn `-activate` (and the Harvest coin under it) | narration C | LEAVE |
| 1950 | `…2634615536` | 4 | Forewarn `-activate` | narration C | LEAVE |
| 1950 | `…2662362231` | 105 | Chilly Reception `-fail` | narration C | LEAVE |
| 1950 | `…2661874022` | 52 | Sleep Powder into a sleeper under Misty Terrain | narration C | LEAVE |
| 1950 | `…2659871951` | 79 | Mortal Spin `[from]`/`[of]` | narration D | LEAVE |
| 1950 | `…2662767282` | 119 | Magician extra `-enditem` | narration D | LEAVE |
| 1950 | `…2662455751` | 145 | Parting Shot into Hyper Cutter order | narration D | LEAVE |

**Predicted: board-material 0 / 0 / 0; undeclared narration 0 / 0 / 0; raw narration 0 / 1 / 2** (the three
declared Supreme Overlord `fallenundefined` rows stay: g1350 `…2661010853`, g1950 `…2663628673`,
`…2656799052`).

Each report predicted only its own half (C: 0 / 0 / 3; D: 0 / 2 / 3); the union is 0 / 0 / 0. Each fix was
replayed alone on its own worktree release, never on the merged tree, so this is the first time they meet.

**Risks, held honestly.**
- **The Harvest coin is a die.** Every game with a Harvest body now draws one more residual `any` per turn.
  Any lattice game with a Harvest body can part or JOIN somewhere new, on the board as well as the protocol.
- **Forewarn now draws its die.** Every Forewarn game's die stream shifts from the switch-in on.
- **The partial drop-refusal order** changes line order on every partial refusal (narration D fix 1), and the
  **Magician corpse fix is board-changing** (narration D fix 4).
- A fixed game can part again on its next divergence (the 1a65 run saw one of 26 do so), so undeclared
  narration 0 / 0 / 0 is a floor, not a promise.
- Predicted joins: none, held weakly — lower confidence than last run because two die paths moved.

---

## 0. VERDICT

- **GATE: `CLOSED — 1 of 9 GATING clauses fail`.** It does NOT read open.
- **The one failing clause is `deliberate roster / abilities`, and it fails on the instrument, not on a
  divergence.** 194 MATCH, 6 DEFERRED-BY-OWNER, 0 DIFFER, 0 DID-NOT-FIRE, 0 COULD-NOT-STAGE. The red plant for
  `ability/restores-a-spent-berry-by-chance` (Harvest) is a DEAD ANCHOR: it matched 0 times on `4c9b0cc4a4da`.
  Its patch targets `if(_sun||rng()<(+_hv.chance||0.5)){`, and 6.59.0's Harvest coin fix rewrote that line into
  `_hvCoin=_hvSkyOk()||rng()<(+_hv.chance||0.5);` and `if(_hvCoin){` (`engine/medicham2-browser.js` ~47994–48001).
  The roster prints "Every row this rule produced is UNPROVEN until it is re-aimed. This stage cannot report
  clean." The Harvest row itself reads FIRED-AND-BOARDS-MATCH. The abilities stage exited 1 for this reason.
- **Board-material 0 of 961 / 0 of 1069 / 0 of 1497** and **undeclared narration 0 / 0 / 0**. Both whole-game
  clauses PASS (`ZERO ON EVERY LATTICE`). This is the first time the NARRATION clause has passed.
- **Predicted vs actual: exact on every value.** All eight targeted games LEFT. **No game joined**, board or
  protocol, on any lattice, despite the two die changes.

## 1. PINS

| pin | value |
|---|---|
| release | `4c9b0cc4a4da`, cut 2026-09-19T12:55:13Z, HEAD `2c83fa6d` (6.59.0). `engine_release.js list`: `0 of 27 files have moved since`. All 29 files under `data/releases/4c9b0cc4a4da/` are tracked |
| census | `data/mechanics-census.json` at HEAD, generated 12:54:58Z, **955 live** / 955 probed / 0 missing. `steering.input_digest` **`1298f25115e3`** in all three artifacts. The last run used `ef0eefdb9f2d` (947 live), so this is not a strict census-pinned before/after; under `--steering empirical` the census is credited only |
| team store | `--team-store data/team-pool-frozen`, pools `0d103fb9fa87` / `7e7a37ded7fc` / `a5ce76242f8d` — same as the last run |
| flags | `--release 4c9b0cc4a4da --team-store data/team-pool-frozen --steering empirical --arm middle --end-state --games {1200,1350,1950} --write --out <canonical path> --dump-games 400 --dump-out data/_4c9b_dump_g<N>.json` (a RELATIVE path; the dump wrote cleanly inside the `--write` run this time), cap 50 (`TURNS_DEFAULT`) |
| mode | `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`, driver code `3f21624ad50d` stable, 0 void, showdown `20ad99ffc9a5` |
| launcher | `spawn(ComSpec, ['/c', 'tools\\lownode.cmd', ...argv])` from a launcher in the session scratchpad, as the last run did. The first launch failed at spawn (`cmd.exe ENOENT`, and a shell heredoc had stripped the backslash): nothing ran and no artifact was touched. It was rewritten and re-launched |

## 2. RESULTS

| `--games` | games | board-material (was) | narration undeclared (raw) (was) | protocol-diverged (was) | boundaries identical | threw (driver choice rejections, same games as before) | generated | wall |
|---|---|---|---|---|---|---|---|---|
| 1200 | 961 | **0** (0) | **0** (0) (0) | 0 (0) | 10705/10705 | 1 | 13:12:42Z | 397 s |
| 1350 | 1069 | **0** (0) | **0** (1) (2) | 1 (3) | 11842/11842 | 1 | 13:13:02Z | 416 s |
| 1950 | 1497 | **0** (0) | **0** (2) (6) | 2 (8) | 16713/16713 | 2 | 13:14:19Z | 491 s |

Board-material is `state.games − state.games_board_never_diverged`. Narration is quarantine's NARRATION clause.
Left / stayed / joined compare `first_divergences` and `state.first_board_divergences` (0 / 1 / 2 and 0 / 0 / 0
entries, under both caps, so the whole population) against `git show HEAD:` of the three artifacts (the
`1a6550ea5ec6` run).

| predicted | actual |
|---|---|
| g1350 Forewarn `…2659123487` idx 6 LEAVE | **LEFT** |
| g1350 Forewarn `…2657893729` idx 38 LEAVE | **LEFT** |
| g1950 Forewarn `…2634615536` idx 4 LEAVE | **LEFT** |
| g1950 Chilly Reception `…2662362231` idx 105 LEAVE | **LEFT** |
| g1950 Sleep Powder / Misty `…2661874022` idx 52 LEAVE | **LEFT** |
| g1950 Mortal Spin `…2659871951` idx 79 LEAVE | **LEFT** |
| g1950 Magician `…2662767282` idx 119 LEAVE | **LEFT** |
| g1950 Hyper Cutter order `…2662455751` idx 145 LEAVE | **LEFT** |
| declared Supreme Overlord ×3 STAY | **STAYED**, same index (g1350 `…2661010853` idx 70; g1950 `…2663628673` idx 34, `…2656799052` idx 23) |
| board 0 / 0 / 0, no joins | **0 / 0 / 0, no joins** on either list |

## 3. ROSTER, DAMAGE, AMF, GATE, COVERAGE

| artifact | before | after | reading |
|---|---|---|---|
| `data/roster.items.json` | 11:26:21Z | 13:15:59Z | 148 MATCH, 0 DIFFER / DID-NOT-FIRE / COULD-NOT-STAGE; anchors 22/22, 22 CAUGHT. Exit 0 |
| `data/roster.abilities.json` | 11:27:45Z | 13:16:35Z | 194 MATCH, 6 DEFERRED-BY-OWNER; anchors **62 of 63**, 62 CAUGHT, 1 DEAD (Harvest). **Exit 1** |
| `data/roster.moves.json` | 11:30:00Z | 13:17:09Z | 494 MATCH, 3 DEFERRED-BY-OWNER; anchors 37/37, 37 CAUGHT. Exit 0 |
| `data/engine-diff.json` | 11:44:19Z | 13:21:02Z | `--n 6000`, seed 20260804: 0 of 6000 at the midpoint, top, bottom and idx01–idx14. Published, exit 0. Dropped by exception: 1, the same Dragon Darts authority throw |
| `data/all-mechanics-fire.json` | 11:35:10Z | 13:18:26Z | 4700 games (was 4702), 0 threw, every red plant caught. Moves: Axe Kick STATE, as before. Abilities: fired 140 → 141, SHOWDOWN-ONLY 7 → 6, owner-shelved diverging 2 → 1. The one changed row is **Forewarn: SHOWDOWN-ONLY, diverged → FIRED, agreed** |

**`node engine/quarantine.js`** (through `tools\lownode.cmd`, exit 0): **`GATE: CLOSED — 1 of 9 GATING clauses fail`**.

| clause | reading |
|---|---|
| game differential (damage) | PASS — 0 of 6000 at every index |
| deliberate roster / items | PASS — 148 of 148 |
| deliberate roster / abilities | **FAIL — "0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE — 194 of 200 tested, 1 red demonstration(s) did not behave as their rule predicted"** (the dead Harvest anchor) |
| deliberate roster / moves | PASS — 494 of 497 |
| coverage / every used mechanic is measured | PASS — all 412 moves above 25 clicks |
| whole-game BOARD-MATERIAL | PASS — `ZERO ON EVERY LATTICE`: 0/961, 0/1069, 0/1497 |
| whole-game NARRATION | **PASS — `ZERO ON EVERY LATTICE`** (1350: 1 raw, 1 declared; 1950: 2 raw, 2 declared) |
| mechanics / each staged and compared | PASS — 2 diverge, 1 declared, 1 below the reach shelf, 0 left |
| no open, known engine defect | PASS — 194 verdicts read |

**`node engine/coverage.js`** (no torn-read warning; the artifacts were 8–9 minutes old when it read them):

| row | value (was) |
|---|---|
| board leaves compared | 55 (55) |
| uncomparable leaves with a firing writer | 23 of 25 (23 of 25) |
| move leaves whose EFFECT was exercised | 7 of 11 (7 of 11) |
| staged mechanics that fired | **786 of 845** (785): abilities 141 of 200 |
| fired mechanics with a board compared | **786 of 845** (785) |
| tags with an engine consumer | 297 of 299 |
| tags with a census probe | 299 |
| turn boundaries compared | 10705 |
| entities exercised in a real game | **852 of 887** (844 of 879) |
| differential bodies on a REAL spread | 0 of 17536 |

## 4. NARRATION BY MECHANISM

Undeclared narration is zero on every lattice, so there is nothing to bucket. The whole dump population is three
cards. All three are the declared Supreme Overlord row: the authority's
`-end|<side>: Kingambit|fallenundefined|[silent]` is missing from ours.

| lattice | config | seed (first) | first div. index | ours at that line |
|---|---|---|---|---|
| 1350 | pair-speedctrl | `…2661010853` | 70 | `-damage\|p2b: Garchomp\|35/183\|[from] item: Life Orb` |
| 1950 | omit-weather | `…2663628673` | 34 | `switch\|p1a: Delphox` |
| 1950 | pair-redirect-priority | `…2656799052` | 23 | `switch\|p2a: Sableye` |

All three games play to the end of the battle on both engines, with the board held. No game diverged at g1200, so
no dump was written for it.

## 5. FILES CHANGED

- **Code:** none.
- **Data, written by the runs:** `data/game-differential{,.g1350,.g1950}.json`;
  `data/roster.{items,abilities,moves}{,.prev}.json` and `data/roster.json`; `data/engine-diff.json`;
  `data/all-mechanics-fire.json`; `data/provenance-stamp.json` and `data/published-samples.json`.
- **Docs:** `CHANGELOG.md` (6.60.0); `docs/RUNNING-NOTES.md` (one row); `docs/ENGINE.md` (one section); the five
  ledgers, restamped by `status.js --write`; this report.
- **White paper: not edited.** No figure in it is superseded. Its whole-game sentence (0 of 961, narration 0 of
  961, 10,705 of 10,705) and its roster counts are unchanged. Its roster citation (`1a6550ea5ec6`, 6.58.0) is still
  a true citation of where those counts were measured.
- **Not touched:** the held 7.0.0 documents and their PDFs, `docs/_reports/2026-09-19-700-draft/` and
  `docs/_reports/2026-09-11-*`. I ran no git command that writes. My two dumps were moved from `data/` to the
  session scratchpad.
- **Processes:** every process I started ended on its own. None was killed.

## OWED, NOT RUN

1. **Re-aim the Harvest red plant in `tests/roster.js`** (rule `ability/restores-a-spent-berry-by-chance`, patch
   near line 8194) at the new coin, for example the `if(_hvCoin){` restore branch. Then run
   `tests/roster.js --stage abilities --reds --write --release 4c9b0cc4a4da` and `engine/quarantine.js`.
   `tests/roster.js` is not an engine SOURCE, so no cut is needed. **If that plant is CAUGHT, every one of the nine
   clauses would read PASS on this release.** That is not claimed and was not run, because the brief was
   measure-only. The narration-c pass did not run the roster, which is why the dead anchor was not seen then.
2. **`tests/test-docs-current.js` reads 35 passed, 2 failed.** Every NEW entry is in a held 7.0.0 draft (the deck,
   the technical docs, MODELS and SUMMARY). One is new since the last run: MODELS.md:17 and SUMMARY.md:19 cite AMF
   **4,702** games, and the artifact now reads 4700. The drafts owe that figure.
3. **The version and the gate decision are the coordinator's.** I wrote 6.60.0 with **Basis.** unchanged, and the
   gate reads CLOSED.
4. **Not measured (a question for MEASURE):** each of the three declared games stops being compared at its first
   protocol line, which is the declared one. This run cannot see whether anything undeclared follows a declared
   line in those games.
5. **Not claimed:** a census-pinned before/after. The census moved from `ef0eefdb9f2d` to `1298f25115e3`.
6. **Seen, not touched:** `status.js` still prints the MAG `FEATURE SEMANTICS CHECK FAILED` (fixture identity,
   damage table). It belongs to MEASURE and was already there.
