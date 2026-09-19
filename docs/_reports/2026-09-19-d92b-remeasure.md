# 6.63.0 re-measured on `d92bdfb50d88` — 2026-09-19, ENGINE (measure only)

A findings record, not a living document. Superseded by the register rows it feeds; not cited as current
state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.

---

## 0. VERDICT

- **GATE: `CLOSED — 2 of 10 GATING clauses fail`** (the ten-clause gate MEASURE landed as 6.64.0, read after it
  finished; the same reading came from the file mid-edit). HEAD's nine-clause `quarantine.js`, run from
  committed bytes for comparison, reads `CLOSED — 1 of 9`.
- **Fail 1, `deliberate roster / items`: a dead red anchor, not a divergence.** 148 of 148 FIRED-AND-BOARDS-MATCH.
  The plant `item/resist-berry` (`tests/roster.js:6621`) patches
  `if(_rb&&_rb.onType===mvT&&...)MODMUL((_rb.mult||0.5));`, which 6.63.0's Ripen fix rewrote into
  `const _rbEats=!!(...)` (`engine/medicham2-browser.js:15736`). It matched 0 times; the stage exits 1. Same
  shape as the Harvest anchor on `4c9b0cc4a4da`.
- **Fail 2, `mechanics`: 9 in-scope rows unproven under the new PROOF bar.** Abilities: **Natural Cure**
  (DID-NOT-FIRE). Moves "NOT RESOLVED ON MEDICHAM": **Ally Switch, Destiny Bond, Guard Swap, Life Dew, Power
  Swap, Sleep Talk, Topsy-Turvy, Wish**. Excused: Copycat (owner deferral) and Illusion (closet).
- **Whole game: board-material 0 / 0 / 0, undeclared narration 0 / 0 / 0, threw 0 / 0 / 0** at `--games`
  1200 / 1350 / 1950. The only protocol divergences are the three declared Supreme Overlord `fallenundefined`
  rows, in the same games at the same indices as before. **No game parts.** The driver digest moved, so these
  figures are **not comparable** to any earlier lattice artifact.
- **A real engine divergence that no clause reads:** the Hyper Cutter row's CONTROL arm (the same Crabominable
  with Anger Point, hit by a critical Chilling Water) parts the board: Attack **+6 ours, +5 authority**. Section 3.

## 1. PINS

| pin | value |
|---|---|
| release | `d92bdfb50d88`, first cut 2026-09-19T16:04:45Z, HEAD `65db4006` (6.63.0; the brief's `beda25a9` is the same commit before the 16:00 ingest rebase). `engine_release.js list`: `0 of 27 files have moved since` |
| census | `data/mechanics-census.json` = HEAD blob `b837cc2d`, **967 live / 967 probed / 0 missing**, `run_ok: true`. `steering.input_digest` **`9a62d9593f12`** in all three lattices (checked equal to `sha12Content` of the file). The last run used `1298f25115e3` (955 live), so this is not a census-pinned before/after; under `--steering empirical` the census is credited only |
| team store | `--team-store data/team-pool-frozen`, pools `0d103fb9fa87` / `7e7a37ded7fc` / `a5ce76242f8d`, the same as the last run |
| driver | `steering.driver_code.digest` **`d0ef2b6bf52e`** (was `3f21624ad50d` on `4c9b0cc4a4da`). **MOVED: no earlier lattice artifact is comparable**, and every figure below is stated beside this |
| flags | `--release d92bdfb50d88 --team-store data/team-pool-frozen --steering empirical --arm middle --end-state --games {1200,1350,1950} --write --out <canonical path> --dump-games 400 --dump-out data/_d92b_dump_g<N>.json` (relative), cap 50 (`turns_cap`) |
| mode | `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`, `driver_code_stable: true`, showdown `20ad99ffc9a5` |
| launcher | a scratchpad node script: `spawn(ComSpec, ['/c', 'tools\\lownode.cmd', ...argv])`. There is no PowerShell tool in this session, so this is the argv route `tools/lownode.cmd`'s header documents. The first launch failed at spawn (the heredoc stripped the backslashes: `toolslownode.cmd`, cwd ENOENT). Nothing ran and no artifact was touched |

## 2. LATTICES

| `--games` | games | board-material | narration undeclared (raw) | protocol-diverged | threw | boundaries identical | generated | wall |
|---|---|---|---|---|---|---|---|---|
| 1200 | 961 | **0** | **0** (0) | 0 | **0** | 10716 / 10716 | 16:28:13Z | 422 s |
| 1350 | 1069 | **0** | **0** (1) | 1 | **0** | 11856 / 11856 | 16:28:33Z | 440 s |
| 1950 | 1497 | **0** | **0** (2) | 2 | **0** | 16725 / 16725 | 16:30:51Z | 576 s |

Board-material is `state.games − state.games_board_never_diverged`. Narration is quarantine's NARRATION clause.
`threw` and `errors[]` are 0 and `[]` on all three. On `4c9b0cc4a4da` (the old driver) the threw count was 1 / 1 / 2
and the boundaries were 10705 / 11842 / 16713. The games that threw now play further: +11 / +14 / +12 boundaries,
all identical. That comparison crosses the driver change, so it describes the change and is not a like-for-like
delta.

**Every protocol divergence, from the full `--dump-games` output** (1 of 1 and 2 of 2 diverging games; the dumps
were moved to the session scratchpad):

| lattice | config | seed (first) | agreed lines | authority | ours | mechanism |
|---|---|---|---|---|---|---|
| 1350 | pair-speedctrl | `…2661010853` | 70 | `\|-end\|p1b: Kingambit\|fallenundefined\|[silent]` | `\|-damage\|p2b: Garchomp\|35/183\|[from] item: Life Orb` | declared Supreme Overlord `fallenundefined` |
| 1950 | omit-weather | `…2663628673` | 34 | `\|-end\|p1a: Kingambit\|fallenundefined\|[silent]` | `\|switch\|p1a: Delphox\|…` | the same |
| 1950 | pair-redirect-priority | `…2656799052` | 23 | `\|-end\|p2a: Kingambit\|fallenundefined\|[silent]` | `\|switch\|p2a: Sableye\|…` | the same |

All three end the battle on both engines with the board held. They are the same three games at the same indices
as on `4c9b0cc4a4da`. **No game joined and none left.** No board divergence exists to bucket.

## 3. THE STAGED-GAME BATTERY (`data/all-mechanics-fire.json`)

`--release d92bdfb50d88 --kind all --team-store data/team-pool-frozen --write`, generated 16:31:26Z, **4654 games,
0 threw**, 0 sheets unassembled, every red demonstration CAUGHT (`red_ok: true`). The last run played 4700 on a
different fixture set, so the game count is not a delta.

| kind | in scope | verdicts |
|---|---|---|
| abilities | 200 | **FIRED 198**, FIRED-UNCONTROLLED 0, UNPROVEN-UNCONTROLLED **1**, DID-NOT-FIRE **1**, SHOWDOWN-ONLY 0, MEDICHAM-ONLY 0 (was 141 / 20 / 12 / 21 / 6 / 0) |
| moves | 497 | resolved 497 of 497 on the authority; `medicham_resolved: false` on 9; diverged 0 unshelved; 2 shelved and diverging (Bitter Malice, Night Daze: Illusion carriers); board STATE 1 (Axe Kick) |
| items | 148 | **FIRED 148**, all boards NO-DIVERGENCE |

**In-scope abilities not FIRED against a control:**
- **Illusion**: UNPROVEN-UNCONTROLLED. Closeted by Will (ROADMAP #160), as expected.
- **Natural Cure**: **DID-NOT-FIRE**, refined CANNOT-FIRE-IN-THIS-FIXTURE (`status-present`). **This is a blind spot
  and it is a regression of the merge.** The ledger's hand list says Natural Cure read FIRED on the planner on the
  worktree release `d8526fc9ba28` (a `switch-out` trigger: a statused Altaria leaves on turn 2). On the merged
  `d92bdfb50d88` the planner refuses the fixture with `PLANNER-CANNOT-CONSTRUCT: C is asked for two trigger clicks
  on one turn`. The legacy fallback then plays a healthy Altaria against Cloud Nine, and the only movement is the
  control's own announcement.

Will's roster deferrals (Anticipation, Forewarn, Frisk, Pickup, Stall) all read **FIRED** in this battery; the
overlap table lists them as "only this instrument reaches".

**Not a miss, but read it before quoting "198 FIRED against a control":** 153 of the 198 FIRED rows carry
`control_not_quiet: true`. That means the control ability is itself live in that run. The artifact's own note says
*"the pair cannot say which of the two moved the game. A third arm would settle it; this pass did not run one."*
It was 128 of 141 on `4c9b0cc4a4da`. The new PROOF clause counts these rows as proven.

**Rows whose board parted:**
- **move Axe Kick**: STATE on turn 1 with no line difference. `p2a feraligatr vol.confusion`: authority 2, ours 1
  (off by one). The same as the last run. Quarantine puts it below the reach shelf.
- **Hyper Cutter's CONTROL arm**: **STATE** in both layouts (near-a, far-a). `p1.active[0].boosts.atk` and the
  party row read **ours +6, authority +5**. The body is Crabominable with Anger Point and the receiver clicks
  Chilling Water. The Hyper Cutter arm itself agrees (0 / 0). It reproduced on a two-row `--only` run to scratch.
  - **Mechanism, inferred and not traced to our line:** the authority raises the `Hit` event (ability `onHit`, so
    Anger Point's `boost({atk: 12})` at `data/abilities.ts:131-137`, which the Champions mod does not override)
    inside `runMoveEffects` (`sim/battle-actions.ts:1086`, event at `:1283`). It runs `secondaries()` after that,
    at `:1099`, so a crit Chilling Water leaves +6 − 1 = **+5**. Ours reads +6, which means our secondary drop
    lands before Anger Point maxes the stage.
  - **No gate clause reads it.** The mechanics clause reads the subject arm's `board`, not `board_control_arm`.
    Anger Point's own row uses Dragon Claw, which has no secondary, and reads clean.
- **Magma Armor's CONTROL arm** (the same Anger Point, on Camerupt, with Ice Beam) reads ANNOUNCEMENT-ONLY: the
  protocol parts on turn 1 and the board holds. It is probably the same ordering, seen as a line order. Not traced.

## 4. ROSTER, DAMAGE, COVERAGE

| artifact | before (HEAD) | after | reading |
|---|---|---|---|
| `data/roster.items.json` | 13:15:59Z `4c9b0cc4a4da` | 16:32:33Z `d92bdfb50d88` | 148 MATCH, 0 DIFFER / DID-NOT-FIRE / COULD-NOT-STAGE. Anchors **21 of 22**: `item/resist-berry` DEAD. 21 CAUGHT. **Exit 1** |
| `data/roster.abilities.json` | 13:39:11Z | 16:33:14Z | 194 MATCH, 6 DEFERRED-BY-OWNER, 0 DIFFER / DID-NOT-FIRE / COULD-NOT-STAGE. Anchors 63 of 63, 63 CAUGHT. Exit 0 |
| `data/roster.moves.json` | 13:17:09Z | 16:35:28Z | 494 MATCH, 3 DEFERRED-BY-OWNER. Anchors 37 of 37, 37 CAUGHT. Exit 0 |
| `data/engine-diff.json` | 13:21:02Z | 16:39:48Z `d92bdfb50d88` | `--n 6000`, seed 20260804: 0 of 6000 at the midpoint, top, bottom and idx01–idx14. **Published.** 1 dropped by exception: the same Dragon Darts authority throw |

**`node engine/coverage.js`** (the artifacts were minutes old and no writer was live):

| row | value (was, on `4c9b0cc4a4da`) |
|---|---|
| board leaves compared | **56** (55); 0 uncompared leaves can stand at a boundary |
| uncomparable leaves with a firing writer | **23 of 24** (23 of 25); the one missing is `volatile:powershift` |
| move leaves whose EFFECT was exercised | 7 of 11 (7 of 11) |
| staged mechanics that fired | **843 of 845** (786): moves 497/497, abilities 198/200, items 148/148 |
| fired mechanics with a board compared | **843 of 845** (786) |
| tags with an engine consumer | 299 of 301 (297 of 299) |
| turn boundaries compared | 10716 (10705) |
| entities exercised in a real game | 859 of 899 (852 of 887) |
| differential bodies on a REAL spread | 0 of 17536 |

## 5. THE GATE, CLAUSE BY CLAUSE

`node engine/quarantine.js` (working copy, MEASURE's 6.64.0, blob `171bb698`), exit 0, run twice with the same
reading, the second after MEASURE reported it had finished:

| clause | reading |
|---|---|
| game differential (damage) | PASS: 0 of 6000 at the midpoint and every index |
| deliberate roster / items | **FAIL**: "148 of 148 tested, 1 red demonstration(s) did not behave as their rule predicted" (the dead resist-berry anchor) |
| deliberate roster / abilities | PASS: 194 of 200 |
| deliberate roster / moves | PASS: 494 of 497 |
| coverage / every used mechanic is measured | PASS: all 412 moves above 25 clicks |
| board leaves / nothing uncompared at a boundary (new) | PASS: 0 standing, 56 compared, 1 `BS.snapshot` call site |
| whole-game BOARD-MATERIAL | PASS: `ZERO ON EVERY LATTICE`, 0/961, 0/1069, 0/1497, 0 threw |
| whole-game NARRATION | PASS: `ZERO ON EVERY LATTICE` |
| mechanics / each staged and compared | **FAIL**: "9 unproven": moves not resolved on MEDICHAM [8] `allyswitch, destinybond, guardswap, lifedew, powerswap, sleeptalk, topsyturvy, wish`; abilities DID-NOT-FIRE [1] `naturalcure`. Excused: `copycat` (owner), `illusion` (closet). Axe Kick is below the reach shelf |
| no open, known engine defect | PASS: 194 verdicts read |

**Suspect the instrument on the eight moves before the engine.** Every one has `resolved: true` (authority),
`diverged: false` and board NO-DIVERGENCE. Seven carry `medicham_why: "the move executed and produced no
consequence line at all"` and Life Dew carries `-fail heal`. So the two streams agreed up to where they were
compared, and ours was judged "not resolved". That is consistent with the MEDICHAM-side resolution reader being
blind to these shapes. The same nine (with Copycat) read `medicham_resolved: false` in HEAD's `4c9b0cc4a4da`
artifact. Not verified in this pass.

## 6. FILES CHANGED

- **Code:** none.
- **Data, written by the runs:** `data/game-differential{,.g1350,.g1950}.json`; `data/all-mechanics-fire.json`;
  `data/roster.{items,abilities,moves}{,.prev}.json` and `data/roster.json`; `data/engine-diff.json`;
  `data/published-samples.json`.
- **Docs:** `CHANGELOG.md` (6.65.0, above MEASURE's 6.64.0); `docs/RUNNING-NOTES.md` (one row, above 6.64.0);
  `docs/ENGINE.md` (one section, and its hand list); the ledgers restamped by `status.js --write`; this report.
- **White paper: not edited.** No figure in it is superseded. Its whole-game figures are dated to `cbd510bc2b13`
  (6.0.0), and its roster line cites `1a6550ea5ec6`; the counts are unchanged. **The held documents** (deck,
  technical docs, MODELS, SUMMARY): I scanned their INDEX text. Every whole-game or gate figure there is inside a
  dated block, so nothing needed replacing and neither the index nor the working copy was touched.
- **Not mine, seen and left in place:** `data/releases/d92bdfb50d88/cuts.jsonl` gained **205** appended cut
  events and `data/engine-release.json` now reads `cuts: 206`. All 205 read `game differential mode A — the
  comparison driver` and are stamped 16:24:36Z–16:26:19Z. `engine/game_differential.js:422` cuts only when no
  `--release` is given, and all three of my lattices passed `--release`. The first cut and `why` are unchanged, and
  the tree is identical. The source is probably another process that loaded `game_differential.js` with no
  `--release` (it spawns no workers), but I did not identify it.
- **Processes:** every process I started ended on its own. None was killed.

## OWED, NOT RUN

1. **Re-aim `item/resist-berry` in `tests/roster.js`** (rule at `:6621`) at the Ripen fix's line, for example
   `const _rbEats=!!(` at `engine/medicham2-browser.js:15736`. Then run `tests/roster.js --stage items --reds
   --write --release d92bdfb50d88` and `engine/quarantine.js`. `tests/roster.js` is not an engine SOURCE, so no cut
   is needed.
2. **Natural Cure's planner fixture was lost in the merge.** Find why `engine/stage_planner.js` now asks C for two
   trigger clicks on one turn (the `switch-out` trigger from the showdown-only pass), and re-run
   `--kind abilities --only naturalcure`.
3. **The eight "not resolved on MEDICHAM" moves.** Trace the MEDICHAM-side resolution reader in
   `engine/all_mechanics_fire.js` against one row (Wish or Sleep Talk) before accusing the engine. If the reader
   is at fault it is an instrument fix. If not, each is an engine gap.
4. **Anger Point against a same-hit secondary stat drop** (+6 ours, +5 authority, Chilling Water). This is a real
   board divergence. Write a probe that fails first (Anger Point body, a crit Chilling Water, read Attack), then fix
   the order. It is a tail mechanic, so expect the lab to move and the pinned pool to sit still. **And a gate
   question for MEASURE:** `board_control_arm` partings are read by no clause.
5. **`control_not_quiet` on 153 of 198 FIRED ability rows.** Whether a live control should count as proof is a
   MEASURE call on the new PROOF bar.
6. **The 205 foreign cut events** on `d92bdfb50d88`: identify the writer. It does no harm to a measurement (append
   only, same tree), but it moves two tracked files.
7. **Not claimed:** a census-pinned or driver-pinned before/after. Both the census (`1298f25115e3` →
   `9a62d9593f12`) and the driver (`3f21624ad50d` → `d0ef2b6bf52e`) moved.
8. **The version and the gate decision are the coordinator's.** I wrote 6.65.0 with **Basis.** unchanged.
