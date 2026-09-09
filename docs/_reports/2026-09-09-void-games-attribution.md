# The three void games, attributed — 2026-09-09 (ROADMAP #551)

ENGINE division. Historical findings record, per CLAUDE.md `docs/_reports/` rule: never maintained, never cited as
current state, superseded by the register rows it feeds.

## The verdict

| game (config, pool pair) | parted | verdict | receipt |
|---|---|---|---|
| `omit-protect` …2662758209 vs …2662995339 | protocol t4, board t4 | **ENGINE DEFECT — FIXED.** Misty Terrain's `onSetStatus` was absent. | turn 4 authority `-damage Klefki 58/132` and no burn; this engine `-status Klefki brn`. Turn 5 authority `-activate Typhlosion move: Misty Terrain`; this engine `-status Typhlosion par`. |
| `omit-spread` …2657358877 vs …2657413811 | protocol t5, board t6 | **INSTRUMENT.** One die, two addresses. `engine/game_differential.js:1623-1631`. | turn 6, the only `any`-bucket draw on each side: authority `20260813\|6\|any\|-\|p20\|0`, this engine `20260813\|6\|any\|-\|-\|0`. Farigiraf's Quick Claw fired here and not there. |
| `omit-spread` …2658645239 vs …2658775286 | protocol t3, board t3 | **ENGINE DEFECT — FIXED.** A charge move remembered the RE-AIMED body's slot, not the CHOSEN slot. | turn 3 authority `move Annihilape Phantom Force p2a: Mudsdale [from] lockedmove` → `-damage Mudsdale 0 fnt`; this engine `phantomforce p2b: Liepard` → `-resisted Liepard`. |

So the 6.0.0 sentence is: **BOARD-MATERIAL 0 of 958 usable, 3 voided — of which 2 were the engine (both closed this
batch, probes red-then-green) and 1 is the instrument (edit named, owed to MEASURE).**

## How each game was replayed (the sample definition)

The artifact `data/game-differential.json` was produced on release `b730e44f3314` with `--games 1200 --steering
empirical --arm middle --turns 50 --team-store data/team-pool-frozen --end-state`. `--dump-games` cannot show a void
game by construction (`DUMP_POOL` filters `!r._mid_void`), so each game was replayed through the same driver with
the same flags: `G.pairsFor(cfg)` under `--games 1200` rebuilds the identical stride (`per = 266`), and
`G.playGame(pr.a, pr.b, cfg, pr.tag, { arm: PRIMARY_ARM, driverSeed: cfg + '|' + pr.tag })` is the call the run's
`playOne` makes. Under `--steering coverage` (the default) the replay was a DIFFERENT GAME (12 turns, no divergence)
— the census steers the sample there and the census had moved; under `--steering empirical` every replay reproduced
the artifact's parting turn exactly (t4, t6, t3) before anything else was read. The replay driver is
`<scratchpad>/replay_void.js`; it is session scratch, not repository code.

**Release `b730e44f3314` does not open in this tree** — `open()` reports MODIFIED on 20+ snapshot files
(`engine/board.js`, `champions_sim.js`, `data/tags.json`, …). Its directory is STAGED (`A data/releases/b730e44f3314/*`)
by somebody this wave, and the working copies are CRLF; I did not touch it and did not re-cut. The pre-fix control
used instead is the harness's red-demonstration path: `SB.harness(src)` compiles `git show HEAD:engine/medicham2-browser.js`
under the OPENABLE current release `b0f5c159c46e`, whose other 26 files are byte-identical to the live tree
(`engine_release.js list`: 0 of 27 moved). The fixed control is the same release's own simulator, which IS the live
bytes. `b0f5c159c46e` was cut at 18:49 by an unpinned differential run (not mine) and already held the killed agent's
partial edit — it is the pointer's `current` now; reported, not touched.

## 0. The killed agent's diff — kept whole, its probe rewritten, its missing probe written

`git diff engine/medicham2-browser.js` held four hunks and I kept all four, each verified independently of its comments:

1. **`MEDSEEN.mistyRefusedStatus / mistyRefusalAnnounced`** (`:1780`) and **`chargeSlotFromChosen /
   chargeSlotChosenDiffersFromReaimed`** (`:2734`) — counter declarations. Kept; both probes assert them.
2. **`mTerrainRefusesStatusOn(t)`** (`:19802`) and the refusal block in `applyStatus` (`:19900`). Authority read
   line-for-line: `data/moves.ts:12173-12179` is exactly the block quoted in the code; `data/mods/champions/{moves,
   conditions,scripts}.ts` contain zero `mistyterrain`. Kept. The announce rule (`(effect as Move).status || effect.id
   === 'yawn'`) is implemented as `inflicts*.via === 'primary'`, and the probe shows Thunder Wave announcing and the
   Scorching Sands secondary silent, matching the authority's own log for the pool game.
3. **The charge-slot memory** (`:34101-34104`): remembers `it.tgtSlot` (the slot as chosen) instead of `indexOf(a.target)`.
   Verified structurally: the dispatch re-aim at `:27974` does `it.a.target = _aimed` before the charge block runs, so
   `a.target` there is the re-aimed body — the killed agent's claim that its own earlier comment was false is correct.
   Authority: `sim/battle-actions.ts:291 pokemon.moveUsed(move, targetLoc)` — runMove's own argument, never
   reassigned in `:225-291`; `sim/pokemon.ts:919`; `data/conditions.ts:295-308`; `sim/side.ts:675-684`. Kept.
4. **Knobs** `MEDI_MISTY_STATUS_UNREFUSED` and `MEDI_CHARGE_REMEMBERS_REAIMED` (`:24622-24630`). Kept; both restore
   the pool game's exact parting (verified by replay, below).

**Its probe `tests/probe_misty_terrain_status.js` could not stage and could not have passed**, so I rewrote the arms:
turn 3 passed the entrant (`null`), which Showdown rejects ("Can't pass: Your Avalugg must make a move"); its CONTROL
asked one body to take a paralysis on turn 2 and a burn on turn 3 (a statused body cannot take a second status, so
`sdS.length === 2` was unreachable); and its AIRBORNE arm fired Scorching Sands — a Ground move — at a Flying type,
which is immune. The rewrite is two turns (both p1 leads switch to the two entrants; Thunder Wave at slot 0, a burn
secondary at slot 1), every cast fixed by its own control on the authority's log, the pool game's Scorching Sands as
its own arm, and a DERIVED non-Ground burn carrier (Scald was chosen this run; Infernal Parade topped the list and has
no legal quiet-ability user, which the first run found by refusing). The authority section and the derivation were
sound and are kept. **The second probe it announced (`tests/probe_charge_release_chosen_slot.js`) did not exist**; written.

## 1. `omit-protect` …2662758209 — ENGINE, closed

Turn 3: Clefable `-fieldstart move: Misty Terrain`. Turn 4: Klefki (Steel/Fairy, grounded) switches in; Typhlosion's
Scorching Sands hits; authority `|-damage|p1a: Klefki|58/132` with NO status; this engine adds `|-status|p1a: Klefki|brn`
and then the burn chip (`15/132`). Turn 5: Klefki's Thunder Wave — authority `|-activate|p2a: Typhlosion|move: Misty
Terrain`; this engine `|-status|p2a: Typhlosion|par`. Board at t4: `klefki.hp 15 vs 23`, `status brn vs —`. The 7-turn
game ended with "slot 1 holds typhlosion, which showdown has FAINTED".

Authority: `data/moves.ts:12173-12179` (above). No Champions override.

- **Pre-fix replay** (HEAD bytes): parts t4, 7 turns — identical to the artifact.
- **Fixed replay** (live bytes): 10 turns, both engines end the battle, boards identical at all 11 boundaries,
  `mistyRefusedStatus=3 mistyRefusalAnnounced=1`.
- **Knob replay** (`MEDI_MISTY_STATUS_UNREFUSED=1`, live bytes): parts t4 with the identical leaf list. The knob is wired.
- **Probe** `tests/probe_misty_terrain_status.js`: six arms, cast derived (Clefable / Alakazam / Slowbro → Bastiodon +
  Snorlax; Charizard for the Sands arms; Dragonite + Skarmory airborne). Live bytes: **green, 27/27**. Knob: inverted
  assertions hold (TERRAIN and SANDS part, controls do not move). **HEAD bytes (`--medi`): RED, 8 cells** — TERRAIN and
  SANDS line-match, boards, refused-count and announce-count. `terrainStatusFieldUnknown` did not move on any arm.

## 2. `omit-spread` …2657358877 — INSTRUMENT (edit owed to MEASURE), plus one engine narration miss

Turn 5 residual, authority: `-end|p2a: Morpeko|move: Future Sight`, `-immune|p2a: Morpeko` (Dark), then `-sideend|p1:
A|Reflect`. This engine: only `-sideend reflect`. **Boards identical at t5** (Morpeko 41/133 both). Turn 6: this engine
`|-activate|p2b: Farigiraf|item: quickclaw` and Psychic KOs Arbok before its Stockpile; authority: no Quick Claw,
Stockpile first, Arbok 9/135 → Sitrus 42. Board parts at t6 (`arbok.hp 0 vs 34`).

Address logs (`G.midAddresses()` after the replay): turn 6, exactly one `any` draw each side —

    authority   20260813|6|any|-|p20|0
    this engine 20260813|6|any|-|-|0

Same die (Quick Claw's `randomChance(1,5)` inside `runEvent('FractionalPriority')`, `sim/battle-queue.ts:249`), two
addresses, two independent values. Why the authority's carries `p20`: `Battle#clearActiveMove` (`sim/battle.ts:376-384`)
nulls `activeTarget` only `if (this.activeMove)`, while Future Sight's residual hit reaches `hitStepAccuracy` /
`spreadMoveHit` (`sim/battle-actions.ts:693`, `:1154`), which write `this.battle.activeTarget = target` with no active
move — so Morpeko stays in `activeTarget` from t5's residual into t6's queue sort. The driver's `midDraw`
(`engine/game_differential.js:1623-1631`) reads `tg = b.activeTarget` and folds it in regardless of `activeMove`.

**Edit owed (MEASURE owns the file; not applied):** at `engine/game_differential.js:1623`, address the target only when a
move is active — `const mv = b && b.activeMove, tg = mv ? (b && b.activeTarget) : null;` — so a between-action die reads
`any|-|-|nth` on both sides, which is what this engine already writes. The t5 `any` counts (authority 1, this engine 2)
and the by-cause `sd_only 1 / me_only 2` are consistent with exactly this.

**Engine finding recorded, not fixed (batches of one):** this engine drew `crit|futuresight|p20|0` and `dmg|futuresight|p20|0`
into a Dark type the authority never rolled for (immunity precedes `getDamage` there), and wrote neither
`-end|…|Future Sight` nor `-immune`. Board-identical; it is a die-order/narration gap and it contributes unshared
addresses to the `low-identity` void rule. Owed a probe. Hand list.

## 3. `omit-spread` …2658645239 — ENGINE, closed

Turn 2: Annihilape chooses Phantom Force at Slowbro (p2a). Incineroar's Flare Blitz KOs Slowbro first. Authority
`|move|p1a: Annihilape|Phantom Force||[still]` / `-prepare`; this engine `|move|p1a: Annihilape|phantomforce|p2b: Liepard`
(the dispatch re-aim moved the aim). Mudsdale refills p2a. Turn 3: authority releases at p2a — `-damage|p2a: Mudsdale|0
fnt`; this engine at p2b — `-resisted|p2b: Liepard|1`, `68/139`, and Mudsdale then hits back. Board at t3:
`mudsdale.hp 92 vs 0`, `liepard.hp 68 vs 139`, `annihilape.hp 6 vs 118`.

- **Pre-fix replay**: parts t3, 3 turns — identical to the artifact. **Fixed replay**: 8 turns, both end, boards identical
  at all 9 boundaries, `chargeSlotFromChosen=3 chargeSlotChosenDiffersFromReaimed=1 chargeReleasedAtRememberedSlot=3`.
- **Probe** `tests/probe_charge_release_chosen_slot.js`: the one legal single-target charge move that breaks protection
  is derived (Phantom Force, of dig/dive/electroshot/meteorbeam/phantomforce/solarbeam/solarblade); cast derived
  (Sableye + Meowscarada/Foul Play vs Delphox / Avalugg, bench Steelix, Aggron); the fixture is proven off the
  authority's turn 1 (aimed body fainted before `-prepare`, never moved, slot refilled). Arms: RED (release strikes slot
  a's NEW occupant Steelix), FOE-ALIVE (Delphox lives, both release at it), SLOT-B (aim slot b, slot a empties, release
  still at Avalugg). Live bytes: **green, 18/18**. Knob: inverted assertions hold. **HEAD bytes: RED, 4 cells** — RED-arm
  same-body, boards, `chargeSlotChosenDiffersFromReaimed +1`, `chargeSlotFromChosen`.

## 4. Census and gate

`tests/test-mechanics.js` re-run after the edits: **830/830 probed mechanics live, 0 missing** (HEAD: 830/830). It did not
go down. `engine/status.js`: the board-material and mechanics clauses read `MEASURED AGAINST A DIFFERENT ENGINE` — the
artifacts are on `b730e44f3314` and the engine moved; that is the expected state until the re-run below.

## 5. Observed in the tree, left alone

- `data/releases/b730e44f3314/**` is STAGED and fails `verify()`; `data/releases/b0f5c159c46e` (cut 18:49, unpinned
  run) holds the killed agent's bytes and is `current`. Neither is mine.
- ~40 files modified by other divisions this wave (`engine/quarantine.js`, `engine/game_differential.js`,
  `engine/engine_release.js`, `.github/workflows/ingest.yml`, `docs/ABRA-whitepaper.md`, …). Not touched.
- `data/mechanics-census.json` was regenerated at 20:49 by somebody else before my 21:13 run; both read 830/830.
- Rest under Misty Terrain: the authority sets the sleep FIRST and heals only on success (`rest.onHit`), so a
  grounded Rest under the terrain fails and does not heal. `applyStatus` now refuses it here too; whether this
  engine's Rest path (tag `healsSelf`, no explicit Rest site) then withholds the heal was NOT probed. Hand list.

## 6. Proposed RUNNING-NOTES row and CHANGELOG bullets (NOT written into the pages)

RUNNING-NOTES row — **What changed.** The three `low-identity` void games on `b730e44f3314` are attributed: two engine
defects closed (Misty Terrain's `onSetStatus` was absent; a charge move remembered the re-aimed slot instead of the
chosen one) with `tests/probe_misty_terrain_status.js` and `tests/probe_charge_release_chosen_slot.js` red on HEAD bytes
and green on the fix; one instrument defect named for MEASURE (`game_differential.js:1623`, a stale `activeTarget`
addressed into a between-action die). **Figure.** Census 830/830 → 830/830 (`data/mechanics-census.json`). Board-material
NOT re-measured. **Supersedes.** Nothing published; the 6.0.0 sentence gains "of which 2 were the engine, 1 the
instrument". **Basis.** unchanged. **Owes.** the full-differential re-run below; MEASURE's one-line edit.

CHANGELOG (MINOR) — Fixed: Misty Terrain refuses every status on a grounded body, announcing only a top-level-`status`
move or Yawn (`data/moves.ts:12173-12179`). Fixed: a charge move's release slot is the slot as CHOSEN
(`sim/battle-actions.ts:291`, `data/conditions.ts:298`), not the body the charge turn was re-aimed onto. Added: the two
probes and knobs `MEDI_MISTY_STATUS_UNREFUSED`, `MEDI_CHARGE_REMEMBERS_REAIMED`. Notes: void game 2 is the instrument
(ROADMAP #551 → MEASURE).

## OWED, NOT RUN

- The full differential on the fixed engine, pinned, so the three games are re-counted rather than assumed:
  `cmd /c tools\lownode.cmd engine\game_differential.js --games 1200 --steering empirical --arm middle --turns 50
  --team-store data/team-pool-frozen --end-state --census <pin> --release <a release cut over THIS tree> --write`
  (no release was cut this batch; `b0f5c159c46e` equals the tree today but was cut by an unpinned run).
- MEASURE: `engine/game_differential.js:1623` edit above, then the same re-run — game 2 should leave the void set.
- ENGINE, hand list: Future Sight into an immune target (dice drawn before immunity; `-end`/`-immune` unwritten); Rest
  under Misty Terrain (heal must be withheld when the sleep is refused).
