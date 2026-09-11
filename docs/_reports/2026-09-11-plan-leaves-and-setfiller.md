# Plan — the board leaves the comparator does not read, and the set filler under a pin

2026-09-11 · ENGINE · **PLANNING ONLY.** This file is the only file written. No game played, no git run, nothing
edited. `engine/medicham2-browser.js` was read **at HEAD** (`git show HEAD:` → scratch copy) because the live
file is under edit, so every `medicham2 :NNNN` below is a HEAD line number (commit `a97115a3`). Data files were
read via `git show HEAD:`.

**Inputs this plan is read against** — `data/game-differential.json` at HEAD, generated 2026-09-11T03:16:02Z:
release `5973a4e3c768`, arms middle / top-tie-first / bottom-tie-first (primary `middle`, pins `9c31c43fab38`),
`state.games` 961, `games_board_never_diverged` 961 (**board-material 0**), `protocol_diverged_games` 1, turn cap
50, pool `0d103fb9fa87` from `data/team-pool-frozen` (8,778 teams, 1,968 picked), census pin `061db6abc2fd`
(839 rows). **The artifact does not record the `--games` flag it ran with** (searched: no argv field), so a
before/after must copy it from whoever ran it, not from the file. Showdown checkout read: `20ad99ffc9a5`.

**Pool carrier counts** used for every prediction below: derived in scratch over `data/team-pool-frozen` with
`diff_swarm.loadTeams`'s own dedupe key. It reproduced **8,778 teams** — the artifact's `team_pool_teams` —
so the counts describe the pool that was actually sampled. Teams carrying the move: Yawn 337, Ally Switch 123,
Psychic Noise 106, Curse 89 (a Ghost-type carrier 30), Wish 47, Outrage 44, Future Sight 13, Syrup Bomb 4,
Petal Dance 4, Raging Fury 3, Spirit Shackle 2, Uproar 2, Magnet Rise 1, Attract 1. Legal non-mega carriers
(dex walk, 271 species, filtered on legality): Power Shift **0**; the move Heal Block is `isNonstandard: "Past"`.

---

## Verdict

- **8 leaves are genuinely wireable. 7 are reader-only and 1 (Magnet Rise's clock) needs an engine change first.**
  The 7:
  - three NEW leaf ids: `volatile:yawn`, `volatile:healblock` and `volatile:curse`;
  - four deepenings of leaves that are already compared: Syrup Bomb presence → clock, the Ally Switch ladder
    counter, and the Future Sight and Wish countdowns.
- **Five declared reasons are stale or wrong:**
  - **Syrup Bomb is NOT a bare 1.** It is a ticked counter at HEAD.
  - **Attract cannot land in any differential game.** The harness builds every body `gender: 'N'`. It is
    declared for a fixture reason, but the real reason is the harness.
  - **The rampage count cannot disagree in any arm.** Both engines play a 2-turn rampage by construction. It hides
    a medicham2 gap: `turnsMax: 3` is never read.
  - **Trapper is derivable by a join**, but it is redundant with the victim's leaf.
  - **Unburden holds, with one road the row does not name.**
- **Power Shift confirmed** (0 carriers). **Ability trapping confirmed** (no stored flag).
- **One likely engine defect, found by reading and still to be probed:** a second Psychic Noise on a target that is
  already heal-blocked RESETS medicham2's clock, where the authority's does not refresh.
- **Set filler: the premise is REFUTED for the differential. It never calls the filler.** The real holes are next
  door:
  - `champions_sim.js` is loaded LIVE by the differential, and the steering receipt calls it snapshot-served.
  - Every caller that DOES fill (self-play, H2H, the live bot) reads code and store live.
  - Under a release the filler silently reads **zero** observed sets and **zero** gear rows. Measured today, below.

---

## A. The eight declared-uncompared rows, one by one

| row | authority stores | medicham2 stores (HEAD) | verdict | kind of fix |
|---|---|---|---|---|
| Yawn | `volatiles.yawn`, `duration: 2`, `onResidualOrder: 23`, sleep in `onEnd` (moves.ts:21125-21152) | `m._yawn = delay+1` = 2 (:32986), ticked at order 23 through `RESIDUAL_CLOCK_READER` (:8975-8976, tick :9312-9315) | **WIREABLE, clock** | reader + fixture |
| Heal Block | `volatiles.healblock`; `durationCallback` → **2 for Psychic Noise**; order 20; `onRestart` for Psychic Noise **returns without refreshing** (moves.ts:8276-8340) | `m._healBlock = blocksHealing.turns` (tag: 2) (:21576-21585), ticked at order 20 (:9298) | **WIREABLE, clock** | reader + fixture; **probable engine defect** (E2) |
| Curse (Ghost) | `volatiles.curse` on the target, no duration, chip at order 12 (moves.ts:3266-3303) | `t._ptDmg = {per, by}` (:33556), the only writer; `curse: m=>!!m._ptDmg` (:9970) | **WIREABLE, presence** | reader + fixture |
| Attract | `volatiles.attract`, refused unless M/F pair (moves.ts:706-745) | `_vol.attract` via `applyAttract`, gender gate `genderOf` (:20722-20740) | **NOT WIREABLE in the pool, and the declared reason is wrong** | declare the correct reason |
| Magnet Rise clock | `duration: 5`, order 18 (moves.ts:10856-10886) | generic write `_vol[vol] = _tn` = **1** (:21458); it is in neither `durationVolatiles()` (:6008-6027) nor `perTurnBoostVolatiles()` (:6081); **no tick anywhere** (HEAD's own note :8913-8916: "a volatile that never ends … a MISSING TICK") | **ENGINE GAP** | engine, then reader |
| Syrup Bomb clock | `duration: 4`, order 14, ends when its source leaves (moves.ts:18755-18782; Champions changes accuracy only, mod :1010-1013) | `_vol.syrupbomb = perTurnBoost.duration` (tag: 4) (:21454-21458), **decremented in the `volBoost` residual** (:44334-44337), source-leaves road at :27540-27585 | **WIREABLE, clock — the "bare 1" in the declared row is STALE** | reader |
| Two-turn move identity | `volatiles.twoturnmove.effectState.move` (conditions.ts ~295) | `_charging` (move id) / `_ttmWrap` | wireable, low value | optional; not batched |
| Rampage count | `trueDuration = this.random(2, 4)` (conditions.ts:253-285) | `_mtLock.left = locksIntoMove.turns` (:42928, :42958); tag `turns: 2, turnsMax: 3` | **ASKS NOTHING under current dice**; hides an engine gap | flag (E3) |
| Ally Switch ladder | `volatiles.allyswitch.counter`: 3 on start, ×3 on success to `counterMax` 729, volatile deleted on failure (moves.ts:302-352) | `_aswCount`: `_first`, ×`_grow` capped, 0 on failure (:33127-33132) and on expiry (:44839) | **WIREABLE, counter** | reader |
| Future Sight countdown | slot `futuremove.endingTurn = (turn-1)+2`, removed at order 3 when `getOverflowedTurnCount() >= endingTurn` (conditions.ts:379-392) | `sf.slot[i] = {when:'futureHit', turns: ticks\|\|3}` (:31288), `--turns<=0 → due` (:43227) | **WIREABLE, derived countdown** | reader |
| Wish countdown | slot `wish.startingTurn = getOverflowedTurnCount()`, removed at order 4 when `> startingTurn` (moves.ts:20919-20930) | `{when:'endOfNextTurn', turns: 2}` (:34218), same tick | **WIREABLE, derived countdown** | reader |
| Trapper mark | `trapper` on the source, the linked status of `trapped` (moves.ts:17625; conditions.ts:208-221) | victim holds `_trapHard = {by, mv}` (:31193, :40554); both ends cleared when the source leaves (:24249-24272) | wireable as a JOIN; redundant | declare the correct reason |
| Unburden | volatile added on item use/take **while holding the ability**, removed when the ability ends (abilities.ts:5227-5249; no Champions override) | no activation field; `_hadItem` (:23789, :25514) is item HISTORY; the doubling is gated at speed time | **CONFIRMED NOT WIREABLE** (refined) | none; widen the OBSERVE arm |
| Power Shift | — | — | **CONFIRMED**: 0 legal carriers (derived) | none |
| Ability trapping | `pokemon.trapped`, computed at request | evaluated at switch time (`preventsSwitch`, 5 refs), no flag | **CONFIRMED** | none |

### The reasons that change, stated precisely

**Attract.** The row blames the probe's fixture: "the staged pair did not have opposite genders". That is true,
but it is not the binding reason. `engine/game_differential.js:3408-3412` declares `gender: 'N'` to the authority
for every body, and the differential says so itself: "gender is N on both sides, so Attract / Rivalry / Cute Charm
are not exercised" (:9095). medicham2's `genderOf` reads anything that is not M or F as N. So `attractCompatible`
refuses on both sides by construction. A leaf would compare 0 with 0 forever: a green test asking nothing. The
pool has 1 carrier team in 8,778. **It is wireable only in a directed fixture that declares genders on both
engines.** That means a gender passthrough in `buildPair`, which is a harness change. Un-neutralising gender for
the pool is a sample decision, because it changes Rivalry, Cute Charm and the `|switch|` details line, so it
belongs to MEASURE.

**Syrup Bomb.** The row says "medicham2 writes a bare 1". That was true when it was written and is stale at HEAD.
The ROADMAP #308 `perTurnBoost` source writes the condition's duration, and the `volBoost` step decrements it.
board_state's own comment records the authority's value at the boundary as 3. **The clock is comparable today
from the reader alone.**

**Rampage count.** The row says comparing `trueDuration` with `left` "would read 2 against 1 on every three-turn
rampage". **No three-turn rampage exists in any arm.**
- The authority's length is a RANGE draw.
- The artifact's dice model says "the RANGE form random(m,n) outside the damage machinery is pinned to m", so
  `random(2,4)` is always 2.
- medicham2 arms `left` from the tag's `turns` (2) and, on this static read, **never reads `turnsMax: 3`**.

So the leaf would compare 1 with 1 at the only boundary where the lock is up, and cannot disagree. **Hidden
underneath it:** medicham2 appears to play every rampage as two turns, while the real authority plays half of
them as three. The pin hides this. E3 below.

**Trapper.** The row says medicham2 has "no field on the source at all". That is true, but the source's mark is
derivable by a JOIN over state medicham2 does hold: a body is a trapper iff some body's `_trapHard.by` is it.
That is a lookup, not a rule. It adds nothing the victim's `trapped` leaf does not already carry, because both
engines clear both ends when the source leaves. Carriers: 1 legal species, 2 pool teams. **Keep it declared, and
change the reason to "derivable, redundant".**

**Unburden.** The conclusion holds: there is no field that holds the ACTIVATION. The row's "there is no state" is
one step too strong. medicham2 does hold `_hadItem`, which is the item's history. The two rules diverge on one
road the OBSERVE arm should stage: **a body that loses its item before it acquires the ability**.
- The authority grants no volatile, because the item was not lost while the ability was held.
- medicham2's gate (`speedOnItemLoss && _hadItem && !m.item`) doubles.

The effect that transfers the ability must be derived from the ability-copy/transfer tags, not named here.

**Power Shift.** Confirmed by derivation: the move is legal (`isNonstandard: null`) and has 0 legal non-mega
carriers.

### Would wiring part boards that agree today? The prediction, and the bound behind it

HEAD's pins read **961/961 boards agreeing**, with **1** protocol-diverged game. Its card is `|upkeep <> |faint|p1a`
at turn 12 in config `omit-spread`, a Perish Song faint ordering that none of these leaves touches.

- **Announced leaves: yawn, healblock, curse, magnetrise, syrupbomb.** A state disagreement on any of them also
  produces a `-start`/`-end` difference. None of their names appears in `data/protocol-events.json`'s declared
  skip list (checked at HEAD). **They are therefore bounded at ≤1 new board-material game, and predicted 0.**
- **Silent leaves: the Ally Switch counter and the Future Sight / Wish countdowns.** No protocol line carries the
  value, so the bound does not hold. **Predicted 0 anyway**, because each disagreement becomes board-material one
  step later on a leaf that is already compared: slot positions after the next Ally Switch, and HP when the
  Wish/Future Sight lands.
  - The exception is a game the 50-turn cap cuts between the disagreement and its consequence. If a new parting
    appears, look first at picked games whose teams carry Ally Switch (123 pool teams), Wish (47) or Future
    Sight (13), with the event in the last one or two turns.
  - These leaves may move `median_turn_of_first_board_divergence` earlier without moving the count.
- **Leaf ceiling** (`tests/probe_uncompared_leaves.js`, and the coverage line in `engine/status.js`): **+3**
  (yawn, healblock, curse). The clock and countdown deepenings do not add leaf ids.

---

## A. Batches

**Reader-only batches need NO release cut.** `engine/board_state.js` is the live reader and not an engine SOURCE,
so the before-arm and after-arm run on the SAME `--release`, census and pool. Only the reader differs, and the
steering driver digest changes as expected. Engine batches need a cut.

### A0 — declared-row text corrections (reader, zero behaviour)
- **Files:** `engine/board_state.js` (`NOT_COMPARED` rows: Attract, Syrup Bomb half of the durations row, trapper,
  rampage, Unburden refinement).
- **Verify:** no game needed. The existing key-set and `not_compared` tests.
- **Prediction:** the artifact's `state` is unchanged. The `not_compared` text changes.
- **Red:** none needed. A text-only change is judged by review, not by a red.

### A1 — three new leaves: yawn (clock), healblock (clock), curse (presence)
- **Files:**
  - `tests/probe_volatile_leaves.js`, fixtures:
    - **Yawn:** give the target an explicit legal ability that is not sleep-refusing, DERIVED by filtering the
      target species' abilities against the sleep-refusal tags and printing the pick. Refuse the fixture if the
      on-field ally carries an ally-volatile-veil tag (`allyRefusesVolatile` family). Today the target's ability
      is `''`, and the declared row says that is what refused it.
    - **Heal Block:** add a second arm with Psychic Noise on the same target on turns 1 and 2.
    - **Curse:** already has `userType: 'Ghost'`. Keep it.
    - Print `_ptDmg` beside every other writer of the `perTurnHP` shape (Salt Cure's tag has the same
      `effect: damage, on: target`) BEFORE wiring, to prove the curse leaf does not over-match.
  - `engine/board_state.js`:
    - `mediBody.vol`: `yawn: num(m._yawn)`, `healblock: num(m._healBlock)`, `curse: m._ptDmg ? 1 : 0`.
    - `sdBody.vol`: `yawn: dur(v.yawn)`, `healblock: dur(v.healblock)`, `curse: v.curse ? 1 : 0`.
    - Delete the `NOT_COMPARED` row. `SD_VOLATILE_KEYS` is derived from `sdBody`'s source, so re-run its test.
- **Verify:** needs games.
  - First the directed probe (short 2-turn games).
  - Then one pinned differential per arm, same release, before and after (a game-playing heavy run, through
    `tools/lownode.cmd`).
- **Prediction:**
  - The probe reads BOTH for all three, equal at every boundary: yawn 1/1 at b0; healblock 1/1 at b0; curse 1/1.
  - **The Psychic Noise ×2 arm is predicted to DIFFER:**
    - After the turn-2 residual, medicham2 1 against authority 0 (volatile gone), plus an `-end|move: Heal Block`
      line medicham2 writes a turn late.
    - The cause: `applyHealBlock` overwrites `_healBlock` unconditionally (:21581).
    - The repeat guard at :21333 tests `who._vol[vol]`, which this owned volatile never writes. So a repeat falls
      through to the overwrite.
    - The authority's `onRestart` for Psychic Noise returns without touching `duration`.
    - This is a static read. If the probe confirms it, it becomes E2.
  - Pinned differential: board-material stays **0/961**, and compared leaves +3.
- **Red:**
  - **Healblock, no edit needed:** `MEDI_HEALBLOCK_CLOCK_LONG=1` (an existing knob) writes turns+1. The new leaf
    must part the directed board at b0 (2 against 1) under the knob and hold without it.
  - **Yawn and curse:** a deliberate reader break (`num(m._yawn)+1`, or curse read as always 0) must part the
    directed board at b0. Revert, then run green.

### A2 — clocks and counters on leaves already compared: Syrup Bomb clock, Ally Switch counter
- **Files:**
  - `engine/board_state.js`:
    - `syrupbomb: num(vol.syrupbomb)` against `dur(v.syrupbomb)`.
    - A new `allyswitch_count`: `num(m._aswCount)` against `v.allyswitch ? num(v.allyswitch.counter) : 0`. Keep
      the existing `allyswitch` two-turn clock leaf as it is.
  - `tests/probe_volatile_leaves.js`: add an Ally Switch candidate (self-target, needs a partner on field) and
    print both counters over three consecutive clicks.
- **Verify:** games (probe, then a pinned differential).
- **Prediction:**
  - Syrup Bomb: 3/3 at b0, then 2/2 and 1/1.
  - Ally Switch: 3/3 after the first click; after a successful second click 9/9; after a failed one 0/0.
  - Pool: 0 new games (see the bound above; this is the silent batch).
- **Red:** a reader break (the counter read as `_aswCount/3`) parts the directed board at the first boundary.

### A3 — Future Sight and Wish countdowns (reader, derived)
- **Files:**
  - `engine/board_state.js`: `mediSlots` adds `futuremove_left` / `wish_left` from `rec.turns`, and `readShowdown`
    derives the same quantities from `slotC.futuremove.endingTurn` / `slotC.wish.startingTurn` and
    `battle.getOverflowedTurnCount()`.
  - A directed arm, in `tests/probe_volatile_leaves.js` or a new `tests/probe_slot_countdown.js`.
- **THE MAP IS MEASURED, NOT WRITTEN FROM THIS PAGE.** Reading the handlers gives the shape: Future Sight lands on
  the third residual counting the applying turn, and Wish on the second. medicham2's `turns` 3 and 2 agree with
  that. The OFFSET, however, depends on whether the snapshot is taken before or after `nextTurn()` increments
  `battle.turn`.
  - Print the raw `endingTurn`, `startingTurn`, `battle.turn`, `getOverflowedTurnCount()` and medicham2 `turns`
    at every boundary, on TWO stagings: the move used on turn 1, and on turn 3.
  - Fit the affine map on the first staging and require it to hold on the second. One point cannot pin an
    offset.
- **Verify:** games (directed, then a pinned differential).
- **Prediction:** Future Sight 2/2 then 1/1; Wish 1/1. Pool 0 new games. First-divergence turns could only move
  earlier.
- **Red:** stage the move on a later turn with the offset deliberately dropped from the map. It must part the
  second staging.

### E1 — Magnet Rise gets its clock (ENGINE edit; the one leaf that needs one)
- **Probe first, watched RED:**
  - New `tests/probe_magnetrise_clock.js`: Magnet Rise, then five idle turns; print both sides at every boundary.
  - **Predicted at HEAD:** authority `magnetrise(d4)` … `d1`, then gone; medicham2 `1` at every boundary and
    never gone.
  - Presence, which is already compared, parts at the boundary after the fifth residual. A `-end|Magnet Rise` line
    is also missing, and a Ground move landing afterwards parts HP.
- **Fix:**
  - Write the condition's `duration` at apply and tick it at the artifact's order for `magnetrise` (18) through
    `RESIDUAL_CLOCK_READER`.
  - Where the 5 comes from is an open point: it must come from the artifact.
    - If no tag param carries the magnetrise condition's duration today, the change lands in `engine/tag_dex.js`
      and a regenerated `data/tags.json` (a frozen SOURCE).
    - If it needs `data/engine-data.js`, **stop and route to MEASURE.** That file is off limits to ENGINE.
  - A loud knob, `MEDI_MAGNETRISE_NO_CLOCK=1`, restores the old behaviour and stamps a `MEDFAILS` counter.
- **Then the reader (separate commit):** `magnetrise: num(vol.magnetrise)` against `dur(v.magnetrise)`.
- **Files:** `engine/medicham2-browser.js`; possibly `engine/tag_dex.js` and `data/tags.json`;
  `engine/board_state.js` (second commit); `tests/probe_magnetrise_clock.js`.
- **Verify:** games. The probe, `node tests/test-mechanics.js` (census), `node engine/status.js`, then a cut and a
  pinned differential.
- **Prediction:**
  - The lab moves: the Magnet Rise census/roster rows.
  - **The pool sits still.** 1 carrier team in 8,778 (said before the run, per the scoreboard rule).
  - Board-material stays 0/961 unless that one team's game keeps a Magnet Rise body in for 5+ turns.

### E2 — Psychic Noise must not refresh an existing Heal Block (ENGINE edit, only if A1's ×2 arm is red)
- **Fix:** in `applyHealBlock`, when `_h0 > 0`, keep the running clock instead of overwriting it. Take the refresh
  rule from the restart table or tag, not from the move's name.
- **Knob:** `MEDI_HEALBLOCK_REFRESH=1`.
- **Files:** `engine/medicham2-browser.js`; the A1 probe arm is the red.
- **Verify:** the probe, the census, then a cut and a pinned differential.
- **Prediction:** pool 0 (HEAD shows no Heal Block protocol difference; 106 carrier teams); the directed arm goes
  red → green.

### E3 — rampage length (flag only; not scheduled)
- **Static read:** medicham2 always arms `turns` (2) and never reads `turnsMax` (3). The authority draws 2 or 3.
  Every current arm pins the draw to 2, so no instrument can see this.
- **Needs:** an arm that frees `random(2,4)` for the `lockedmove` draw. That is a dice-model change to the
  instrument (`engine/game_differential.js`), so it has to be routed under `docs/DIVISIONS.md` before anyone
  builds it. Then a probe that prints `trueDuration` against `_mtLock.left`.

---

## B. The set filler under a pin

### Findings (evidence first)

**B-F1 — the differential never executes the set filler. The premise is refuted for that instrument.**
- set_priors is reached only through `CS.packTeam` → `SP.fillSet` (`engine/champions_sim.js:301-305`, :364).
- `engine/game_differential.js` uses CS only for `sim()`, `FORMAT`, `PINNED_COMMIT`, `actualCommit`,
  `getRuleTable`, `moveCarriers` and `canLearn` (lines 545, 551, 2507, 3521, 4091, 6278, 6374, 6589, 7773).
- Bodies are built by `buildPair` (:3307) straight from the pool's open sheets.
- `engine/diff_swarm.js` requires no set_priors.
- `steering.driver_code.frozen_excluded` lists `engine/set_priors.js` only because
  `steering.js:138` derives it from the STATIC require closure: it is reachable, not executed.
- **So board-material 0/961, the protocol count and the census-steered coverage do not depend on the live store
  through the filler.**

**B-F2 — the real hole beside it: `champions_sim.js` is loaded LIVE and the receipt says otherwise.**
- `engine/game_differential.js:433` is `require('./champions_sim.js')`, not `REL.require`.
- `engine/steering.js:149-150` describes `frozen_excluded` as "served from the snapshot and stamped separately".
  That is false for `champions_sim.js` and for everything it pulls in.
- Today `champions_sim.js` is live = release `5e5d21bf1fb1`, so nothing moved. Three of its companions have
  already drifted from release `5973a4e3c768`, harmless only because B-F1 holds:

  | file | release | live |
  |---|---|---|
  | `engine/set_priors.js` | `f8a81445ee3a` | `027b711d3f29` |
  | `engine/quality.js` | `e8a3b0a14884` | `c6de8fb66ea3` |
  | `data/quality-filter.json` | `36812acec7f8` | `4e3ee1cc5f40` |

- The receipt cannot tell any of this.
- Separately, `driver_inputs` stamps `data/rollout-switch-census.json` as "read_from: live tree (not an engine
  SOURCE)". It has been a SOURCE since 2026-09-08, so the label is stale. The digest is identical today.

**B-F3 — every caller that DOES fill reads code and store live.**
- **The callers:**
  - `CS.packTeam`: `engine/mew.js:420-421` (self-play), `engine/play.js:375-376`, `engine/mag_bot.js:313`,
    `engine/showdown_bot.js:110` (the live bot), `engine/build_lab.js:229-283`, `engine/validate_selfplay.js`.
  - Direct calls: `engine/selftest.js`, `engine/stab_audit.js`, `tests/test-set-realism.js`.
- **All of them `require` champions_sim/set_priors live.** None goes through a release, so "pinned" was never on
  the table for them.
- **What they read at fill time (the brief named the first two; the third is the largest):**

  | reader | store it opens |
  |---|---|
  | `observedSets()` | `data/games.bo3.jsonl` (**32,857 lines today, 13,214 in the frozen pool**) and `games.ots.jsonl` (4,167 both) |
  | `coocc()` | the clean ladder store, through `quality.loadGames()` with the default path, which applies the LIVE `quality-filter.json` |
  | `gearPriors()` | the whole ladder store, `clean: false` — the item/ability distribution |

  `movePriors()` reads `data/move-priors.json`.

**B-F4 — under a release the filler reads NOTHING and says only one line about it. Measured today, no game
played.**
- `REL.require('engine/set_priors.js')` from `5973a4e3c768` gave **movePriors 345 species, observedSets 0,
  gearPriors 0**. The only signal was one stderr line from the snapshot's `quality.js`: "cannot stat
  …releases/5973a4e3c768/data/games.ladder.jsonl … store caching disabled".
- The snapshot resolves `__dirname/../data/` to `data/releases/<id>/data/`, which holds 14 data files and no
  store. The three `catch {}` blocks (set_priors.js:191, :308, :369) swallow the rest.
- `fillSet` still returned an item and an ability for the one species tried, a mega forme, whose stone and
  ability the forme forces. So what is proven is that the tables are empty, **not** that fills lose their items.
- It is latent. Three callers already `REL.require` champions_sim (`rollout_r1.js:70`,
  `leaf_position_contrast.js:101`, `bench_speed.js:98`), and none calls `packTeam` today. The first one that does
  gets marginals-only fills with no error.

### The design

**set_priors stops opening game stores at play time. It reads ONE derived, digest-stamped table,
`data/set-priors.json`, which `engine/engine_release.js` carries as a SOURCE. `--team-store` stays the SAMPLE pin
and does not feed the filler. A missing table is loud.**

**Why not "read the frozen pool under `--team-store`":**
- (1) The one instrument that takes the flag never fills (B-F1), so it would change nothing where the flag
  exists.
- (2) The pool holds bo3 and ots only. `coocc` and `gearPriors` read the LADDER store, so pointing them at the pool
  CHANGES their corpus, which is a basis change, instead of freezing it.
- (3) It welds the sample knob to the filler knob, and a before/after must be able to vary one without the other.
- (4) The callers that do fill (mew, H2H) take no `--team-store` at all.

**The table:**
- `{generated, built_from: {path: sha12Content}, filter_digest, observed: {species: {"m1.m2.m3.m4": n}}, cooc:
  {species: {solo, pair}}, gear: {species: {itemDist, abilityDist}}}`
- Keys are sorted, so an identical corpus gives an identical digest and an identical release id (releases already
  dedupe on content).
- It MATERIALISES the three in-memory objects the functions build today. Given the same corpus, fills are
  byte-identical, and that is the proof obligation.

**Runtime:**
- `observedSets` / `coocc` / `gearPriors` read the table at `path.join(__dirname, '..', 'data', 'set-priors.json')`.
  In a snapshot that resolves to the frozen copy, which is exactly how `move-priors.json` already works.
- A missing or unparseable table:
  - increments `SP.fails.tableMissing` and prints one stderr line;
  - makes `SP.provenance()` return `{table_digest: null}`, which any stamping caller must refuse.
- The three silent `catch {}` blocks become counted.
- `ABRA_SET_PRIORS_LIVE=1` keeps the old live read for a paired arm and stamps `live_store: true`.

**The release:**
- Add `'data/set-priors.json'` to `SOURCES`. That is the sixth growth. The header must say again that
  `requireClosure` cannot see an `fs` read.
- Adding a SOURCE strands nothing, by `census()`'s rule (runnability is judged on what callers `REL.require`,
  measured at the 2026-09-08 growth). Re-check it before and after.
- **Old snapshots cannot be repaired**, which is the `rollout-switch-census` precedent. Callers that pack under a
  release declare `need: ['provenance']`, so an old set_priors is refused by name at second zero.

**Growth budget:** `data/releases/<id>/` is tracked, so each DISTINCT table adds one blob to history. The table's
size is not known until it is built. **State the measured bytes in the notes row.** Rebuild it on demand
(`--build-table`), never hourly.

**Receipts that must record it:**
- the release manifest (automatic, via SOURCES);
- every artifact that fills, via `REL.stamp()` plus `set_priors: SP.provenance()` = `{table_digest, built_from,
  read_from: 'release <id>' | 'live tree'}`: mew/self-play, H2H, build_lab;
- `engine/provenance.js`'s input list, for any artifact that names the table.

**Behaviour change for OPS:** the live bot (`showdown_bot.js`, `mag_bot.js`) would fill from the table instead of
the hourly store. **Route this to OPS before landing.** The alternative is OPS rebuilding the table on a cadence
it owns. This plan does not decide it.

**Which corpus the first table is built from:** the LIVE store at build time, stamped. That freezes what the code
does today and makes it visible, rather than changing it. Building it from the frozen pool plus a ladder snapshot
is a second, deliberate step, and it would move the figures listed below.

### B batches

**B1 — the table (ENGINE; `engine/set_priors.js` is a SOURCE, so it needs a new release)**
- **Files:** `engine/set_priors.js` (`--build-table`, the table reader, `provenance()`, loud misses);
  `engine/engine_release.js` (SOURCES +1); `data/set-priors.json` (generated); a new
  `tests/test-set-priors-table.js`; `engine/mew.js`, `engine/build_lab.js` and the H2H stampers (add the
  provenance row).
- **Verify:** NO game needed for correctness. The equivalence test draws `fillSet` for every species × N seeds:
  once from the table built off corpus X, once live off corpus X, compared byte for byte. It loads the ladder store
  once, so run it through `lownode`. The gate prediction below needs one pinned differential per side (games,
  heavy).
- **Red:**
  - (a) Build the table from a DIFFERENT corpus (`--from data/team-pool-frozen`). The equivalence test must report
    the mismatch.
  - (b) The B-F4 call above is today's standing red: 0 and 0 from a snapshot. After B1, a snapshot cut WITH the
    table reads non-zero, and one cut WITHOUT it is refused by name rather than read as empty.

**B2 — make the receipt observed, not asserted (instrument; `engine/steering.js`)**
- **Change:** split `frozen_excluded` into `served_from_release` and `loaded_live`, with digests.
  - Derive both from `require.cache` at stamp time instead of from the static closure. What a run actually loaded
    is an observation; the closure is a declaration. That is CLAUDE.md's "prefer observed over declared".
  - Correct `driver_inputs`' `rollout-switch-census` label.
  - `engine/game_differential.js:433` may then move `champions_sim.js` to `REL.require`, but that is optional once
    the receipt tells the truth.
- **Files:** `engine/steering.js`; optionally `engine/game_differential.js`.
- **Verify:** one short differential (small `--games`) to see the new block. The full pinned run belongs to
  whoever takes the next measurement.
- **Red:** in a temp tree where `champions_sim.js` differs by one byte, the stamp must show
  `loaded_live[champions_sim] ≠ release digest`.

### Which published figures could move when B lands — predicted, so the next run reads as a before/after
- **Gate figures: NONE.** That covers board-material 0/961, every `state.*` figure, `protocol_diverged_games` 1,
  the census, the roster, all-mechanics-fire and the damage differential.
  - This is falsifiable. The same pins (release, `--census`, `--team-store`, `--turns 50` and the same `--games`)
    before and after B1 must reproduce `state` exactly: the same `team_pool_digest` and the same first-divergence
    list.
  - **If anything in `state` moves, the filler WAS on the path and B-F1 is wrong.** That is the whole reason to
    run it.
  - B2 moves no figure; only the steering block changes shape.
- **Figures that DO move are all withheld or internal:**
  - the self-play / MEW / H2H re-runs (the quarantine re-run list; withheld, not published). Their fills stop
    tracking a bo3 store that has grown 13,214 → 32,857 lines since the pool froze;
  - the STAB-gap figures in `set_priors.js:277-279` / `engine/stab_audit.js` / `tests/test-set-realism.js`, but
    only if the table is built from a different corpus than theirs. Those figures are dated 2026-07-27 and are
    already not reproducible from today's live store;
  - the live bot's fills (the OPS decision above).

---

## Side findings — reported, not touched
- `data/protocol-events.json` declares `swap` not-emitted because "Ally Switch is not modelled." medicham2 models
  the ladder (:33127-33132) and the swap. The reason string is stale, and the `swap` narration gap is real.
- HEAD's differential artifact does not record its `--games` value. That is CLAUDE.md's `--games` trap, arriving
  in the file that is supposed to prevent it.
- The `not_compared` Yawn/Heal Block text gives a fixture explanation (a refusing ability) that differs from
  `probe_volatile_leaves.js`'s own 2026-08-18 note (only the last boundary was read). Re-run the probe before
  believing either.

---

## OWED, NOT RUN

Environment for all of the below:

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
cd C:/Users/willj/Projects/Pokemon/ABRA
```

Before any A batch — the ceiling and what each engine holds today (the probe plays short directed games):

```bash
node tests/probe_uncompared_leaves.js
node engine/coverage.js
cmd.exe //c "tools\\lownode.cmd tests\\probe_volatile_leaves.js"
```

A1's knob red for Heal Block (an existing knob; must part the new leaf at b0 and hold without it):

```bash
MEDI_HEALBLOCK_CLOCK_LONG=1 cmd.exe //c "tools\\lownode.cmd tests\\probe_volatile_leaves.js"
```

Reader-only batches (A0-A3): before and after on the SAME release, census and pool, with only `board_state.js`
changed. `--games` MUST equal the before-arm's; HEAD's artifact does not record it.

```bash
cmd.exe //c "tools\\lownode.cmd engine\\game_differential.js --release 5973a4e3c768 --census data/mechanics-census.json --team-store data/team-pool-frozen --turns 50 --games <before-arm value> --write"
node engine/status.js
```

E1 (ENGINE order: probe first, watched red, then the fix, then the census):

```bash
node tests/probe_magnetrise_clock.js
node tests/test-mechanics.js
node engine/status.js
node engine/engine_release.js cut "Magnet Rise gets its clock"
cmd.exe //c "tools\\lownode.cmd engine\\game_differential.js --release <new-id> --census data/mechanics-census.json --team-store data/team-pool-frozen --turns 50 --games <before-arm value> --write"
```

B: today's standing red (measured 2026-09-11: `0 0`), then the equivalence test and the stranding check around the
SOURCES growth:

```bash
node -e "const R=require('./engine/engine_release.js').open('5973a4e3c768');const SP=R.require('engine/set_priors.js');console.log(Object.keys(SP.observedSets()).length,Object.keys(SP.gearPriors()).length)"
cmd.exe //c "tools\\lownode.cmd engine\\set_priors.js --build-table"
cmd.exe //c "tools\\lownode.cmd tests\\test-set-priors-table.js"
node engine/engine_release.js census
```

B's predicted no-move check: two pinned differentials on releases that differ only by set_priors and the table;
`state` must be identical:

```bash
cmd.exe //c "tools\\lownode.cmd engine\\game_differential.js --release <before-B1-id> --census data/mechanics-census.json --team-store data/team-pool-frozen --turns 50 --games <N> --out data/_gd-before-B1.json"
cmd.exe //c "tools\\lownode.cmd engine\\game_differential.js --release <after-B1-id> --census data/mechanics-census.json --team-store data/team-pool-frozen --turns 50 --games <N> --out data/_gd-after-B1.json"
```

Finishing obligations for whichever batch lands (not this plan):

```bash
node engine/status.js --write
node engine/open_work.js
```

Also owed per landed batch: a `docs/RUNNING-NOTES.md` row, a `docs/ENGINE.md` hand-list update (rows turned into
probes leave it), and a CHANGELOG entry.

**The census pin path above is an assumption.** The artifact reads `input_read_from: data/mechanics-census.json`
with `pinned: true` and digest `061db6abc2fd`. If the before-arm used a pinned COPY, pass that copy's path, and
check the digest matches before comparing.
