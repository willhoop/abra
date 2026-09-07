# LONG-TAIL BATCH L — ENGINE, 2026-09-07

Append-only working record. Written as the work happens.

## 0. THE BASELINE, RE-DERIVED BEFORE ANYTHING MOVED

Read off `data/game-differential.json`, generated `2026-09-07T16:51:10.775Z` (3 minutes before this
session opened; tree unchanged since release cut `2026-09-07T16:47:56.963Z`).

```
node engine/game_differential.js --steering empirical --release aa7b80f9a038 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

| clause | value |
|---|---|
| whole-game **BOARD-MATERIAL** (`state.games` 961 less `state.games_board_never_diverged` 950) | **11 of 961** |
| whole-game PROTOCOL | 80 |
| whole-game NARRATION | 68 (69 raw less 1 declared) |
| board parted before the protocol did | 0 |
| `mid_void.void_games` | 3 |

## 1. THREE OF THE ELEVEN ARE THE INSTRUMENT'S OWN VOID GAMES — REPORTED, NOT ACTED ON

A dump was re-taken on the CURRENT release so the cards match the bar:

```
node engine/game_differential.js --steering empirical --release aa7b80f9a038 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen \
     --dump-games 100 --dump-out data/verification/batchL/dump-baseline.json
```
`wrote ... (77 of 80 diverging games across 1 arm(s))` — the dump filters `r._mid_void`, so it holds
every non-void diverging game.

Matching the 11 `state.first_board_divergences` seeds against that dump:

| seed | in the dump? |
|---|---|
| `omit-protect ...2662758209` (Klefki burned here, clean there) | **NO** |
| `omit-intimidate ...2663804350` (Goodra, `poisontouch`) | yes |
| `omit-spread ...2657358877` (Arbok fainted here, alive there) | **NO** |
| `omit-spread ...2658645239` (Annihilape 6/118, Mudsdale 92/0) | **NO** |
| `omit-spread ...2662243229` | yes |
| `pair-protect-bust ...2653991758` (Mudsdale 14/175 vs 7/175) | yes |
| `pair-protect-bust ...2661266222` | yes |
| `pair-redirect-priority ...2654621676` | yes |
| `pair-redirect-priority ...2656366551` | yes |
| `pair-redirect-priority ...2661747717` | yes |
| `pair-speedctrl ...2654408616` | yes |

Every one of the 11 has `protocol_diverged_at_turn` non-null, so all 11 are inside the 80 diverged.
77 of those 80 are in the dump. The three absent ones are therefore exactly the three
`mid_void.void_games` — `by_reason.low-identity: 3 games, diverged 3`.

**This is a fact about the instrument and it is REPORTED, not fixed here.** `state`'s board clause
walks `results` unfiltered, while the divergence RATE beside it publishes
`diverged_among_usable: 77 / usable_games: 958`. The two disagree about whether a void game counts.
Removing them would drop the bar from 11 to 8 for a reason that is not an engine fix, and the void
reason itself (`unshared_address_field_rollup: {"target differs": 15}`) can be DOWNSTREAM of a real
board parting — so voiding them could equally be laundering a defect. Left standing, named here.

## 2. FIX ONE — LUM BERRY IS AN `onAfterSetStatus` ITEM AND THIS ENGINE ONLY EVER ATE IT AT `Update`

`tests/probe_cure_berry_on_set.js`, knob `MEDI_NO_CURE_ON_SET=1`.

### THE AUTHORITY

`Pokemon#setStatus` closes on `runEvent('AfterSetStatus', ...)`, and LUM BERRY is an `AfterSetStatus`
item — `data/items.ts:3541-3544`:

```
onAfterSetStatusPriority: -1,
onAfterSetStatus(status, pokemon) { pokemon.eatItem(); },
onUpdate(pokemon) { if (pokemon.status || pokemon.volatiles['confusion']) pokemon.eatItem(); },
```

`data/mods/champions/items.ts` overrides no berry — `grep onAfterSetStatus` there returns nothing — so
that is this format's Lum Berry and not mainline's. **Every other cure berry carries `onUpdate`
ALONE** (Cheri, Pecha, Rawst, Aspear, Chesto), and the authority raises `Update` at the END of an
action (`sim/battle.ts:2858`) and after each hit of the hit loop (`sim/battle-actions.ts:967`) — both
of which are **after** `spreadMoveHit` has run `runEvent('DamagingHit', ...)`
(`sim/battle-actions.ts:1121`).

So the two schedules are different moments and the difference is a whole status: a same-action
reaction that wants to set a SECOND status finds a Lum holder already cured in the authority and
still statused in an engine that waits for the Update. **Poison Touch is that reaction.**

### THE POOL GAME, `omit-intimidate ...bo3-2663804350` TURN 3

```
showdown   |-status|p2a: Goodra|par   |-enditem|p2a: Goodra|lumberry|[eat]
           |-curestatus|p2a: Goodra|par|[msg]
           |-status|p2a: Goodra|psn|[from] ability: Poison Touch|[of] p1a: Sneasler
           |-damage|p2a: Goodra|57/165 psn|[from] psn
medicham   |-status|p2a: Goodra|par   |upkeep
```
parting `p2.party.goodra.status  medi "" / sd "psn"` and `.hp  medi 77 / sd 57`.

### THE PROBE, AND WHAT IT PROVES

The fixture is **swept, not chosen** — Poison Jab's secondary is 30% and Poison Touch is 30%, so most
contexts show nothing at all, and a context where the AUTHORITY never poisons is indistinguishable
from a dead wire. The file sweeps derived targets x lead-in turns until the authority emits BOTH the
secondary `-status` and a `[from] ability: Poison Touch` line, prints how many it tried, and refuses
to run if it finds none. It selected on the first context: `Slowbro [Regenerator] clicking amnesia,
0 lead-in turns`, Sneasler Poison Jab.

Three arms, RED first under the knob:

| arm | `--red` | clean |
|---|---|---|
| **LUM** | board **PARTED at t1** — `p2.party.slowbro.hp medi 98 sd 77`, `.status medi "" sd "psn"` | identical, and this engine emits the `[from] ability:` line too |
| **CONTROL, no item** | identical at every boundary | identical |
| **CONTROL, PECHA** (cures psn/tox, `onUpdate` ONLY) | identical at every boundary | identical |

The Pecha arm is the knob cleared explicitly: it IS a cure berry and it DOES cure, and it must still
hold — the authority refuses the second poison there too, because the berry has not been eaten when
`DamagingHit` runs. Without it the fix could have been "berries cure early", which is a different and
wrong rule.

Receipts: `MEDFAILS.cureOnSetSkipped = 1` on `--red` (**the clause under test was reached**),
`MEDSEEN.berryCuredOnSet` moved by exactly **1** across the three clean arms and it was the LUM arm.

### THE WIRE

- `engine/tag_dex.js` — `curesStatus` now carries `onSet` (and `onSetPriority`), derived from the
  presence of `it.onAfterSetStatus`. **Membership printed before it was wired:**
  `aspearberry(false) cheriberry(false) chestoberry(false) lumberry(true) pechaberry(false)
  rawstberry(false)` — one match, and the probe refuses to run if that stops being true.
- `engine/medicham2-browser.js` — `berryStatusCureNow` is the shared `onEat` half (one fact, two
  schedules); `berryCureOnSet` is the new road, gated on `onSet`, honouring the same Unnerve refusal
  as every other un-forced `eatItem()`; called at the foot of `applyStatus`, **below** Synchronize
  because Lum declares `onAfterSetStatusPriority: -1` and Synchronize declares none (0).
- Dice: **no die is drawn on this road**, so the pin is unmoved.

Census after the fix: **830 / 830 / 0**, unchanged. `tests/test-tag-params-derived.js` PASS.

### THE MEASUREMENT — FIX 1 ALONE

Release cut **`ac6b6880dc52`**. Full sample line, flags included:

```
node engine/game_differential.js --steering empirical --release ac6b6880dc52 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```
961 games played from `--games 1200`, cap 20, `middle`, `empirical-click/v1`, pool PINNED to
`data/team-pool-frozen`, census pin `9446a684709d`, pins digest `de38d17e15a2`.

| clause | before `aa7b80f9a038` | after `ac6b6880dc52` |
|---|---|---|
| whole-game **BOARD-MATERIAL** | **11 of 961** | **10 of 961** |
| whole-game PROTOCOL | 80 | **79** |
| whole-game NARRATION | 68 (69 raw less 1 declared) | **68** (69 raw less 1 declared) |
| board parted before the protocol did | 0 | **0** |
| `mid_void.void_games` | 3 | **3** |
| census | 830 / 830 / 0 | **830 / 830 / 0** |

Predictions: **P1 HIT** (11 -> 10, the Goodra game left and nothing took its place — not a transfer),
**P2 HIT** (80 -> 79), **P3 HIT** (no new board-material game), P4 pending the roster re-run.
Narration did not move, which was not predicted either way.

## 3. FIX TWO — A CONFUSED BODY HITS ITSELF 33 TIMES IN 100, AND THIS ENGINE ASKED FOR ONE IN THREE

`tests/probe_confusion_selfhit_chance.js`, knob `MEDI_CONFUSION_THIRD=1`.

### HOW IT WAS FOUND, AND WHY THE CARD COULD NOT HAVE SAID IT

The dump card for `pair-redirect-priority ...bo3-2656366551` reads
`unrelated event mismatch :: |move|p1a|moonblast <> |-damage|p1a|H/H|[from]confusion` — a class name
about the COMPARATOR. What it is is a `|-activate|...|confusion` that both engines emit and then
disagree about:

```
showdown   |-activate|p1a: Clefable|confusion   |move|p1a: Clefable|Moonblast|p2a: Maushold
           |-damage|p2a: Maushold|0 fnt   |faint|p2a: Maushold
medicham   |-activate|p1a: Clefable|confusion   |-damage|p1a: Clefable|70/170|[from] confusion
```

### THE AUTHORITY, IN TWO LINES

```
data/conditions.ts  confusion.onBeforeMove:   if (!this.randomChance(33, 100)) return;
sim/prng.ts:115     randomChance(n, d)     :  return this.random(d) < n;
```

`random(100)` is `floor(u * 100)`, so the authority self-hits exactly when `u < 0.33`. This engine
asked `rng() < 1/3` = 0.33333…, **a third of a percentage point of the die wider**.
`data/mods/champions/conditions.ts` does not mention confusion, so 33/100 is the format's own number.

**That is a rounding error everywhere except where it matters most.** The middle arm hands BOTH
engines the same `u` for the same address, so a `u` in `[0.33, 0.33333)` is not a slightly different
probability — it is one engine hurting itself and the other clicking its move.

### THE PROBE

- **A. the authority, derived** — the handler source is read out of the format and the `33, 100` is
  matched in it, so a Showdown change fails this file rather than drifting past it.
- **B. the worked example** — the pool game is replayed out of the PINNED pool (census pin included:
  without it the empirical driver plays a different match under the same name, which is how the first
  replay attempt read `protoDiv=null` and looked like a fix). Clean it runs **10 turns, no protocol
  divergence and no board divergence**; under `--red` it parts at **t5** on the leaves the artifact
  records (`p2.party.maushold.fainted`, `p1.pp[0].moonblast`).
- **C. the silent control** — 24 derived targets, one staged Confuse Ray each, `-activate|confusion`
  raised **24** times. The authority self-hits **19** and this engine self-hits **19**, on BOTH arms.
  A control that moved here would mean the change was to the mechanic and not to its boundary.
  *(The first version of this control counted Showdown's `|split|` public copy as well and read
  "authority 38, medicham 19" — a fault in the RULER that would have been reported as an engine
  self-hitting half as often as the authority. Corrected before it was trusted.)*

Receipt: `MEDFAILS.confusionThirdRestored = 1` under `--red`, 0 clean.
Dice: the same number of draws at the same addresses — only the threshold moves — so the pin is
unchanged.

### THE MEASUREMENT — FIX 2 ALONE

Release cut **`f8266a5c48b7`**.

```
node engine/game_differential.js --steering empirical --release f8266a5c48b7 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

| clause | before `ac6b6880dc52` | after `f8266a5c48b7` |
|---|---|---|
| whole-game **BOARD-MATERIAL** | **10 of 961** | **9 of 961** |
| whole-game PROTOCOL | 79 | **78** |
| whole-game NARRATION | 68 | **68** |
| `mid_void.void_games` | 3 | **3** |

Predictions **P1 HIT** (10 -> 9, no transfer) and **P2 HIT** (79 -> 78). P3 pending the roster re-run.

## 4. FIX THREE — THE RESIDUAL WALK STOPS AT A BODY, NOT AT A GROUP, AND THE OLD COMMENT SAID SO

`tests/probe_residual_stop_body.js`, knob `MEDI_RESIDUAL_STOP_GROUP_ONLY=1`.

### THE AUTHORITY'S PAIR OF LINES

```
a duration EXPIRY:   handler.end.call(...); if (this.ended) return; continue;   sim/battle.ts:516-524
every other handler: this.faintMessages(); if (this.ended) return;              sim/battle.ts:565-566
```

An expiry that kills a side's last body does NOT end the battle at its own line — `Pokemon#faint`
only QUEUES — and the VERY NEXT handler drains the queue, ends the battle and stops the whole walk.

### THE APPROXIMATION THAT WAS DECLARED, AND THE MEASUREMENT THAT REFUTES IT

The group loop's header called the group granularity *"a DECLARED approximation rather than a claim"*
and argued the cost away: *"within one group the difference is whether a second body on the LOSING
side also takes its own chip after the side is already dead — which cannot change the outcome and
cannot bring anybody in"*. **The second body can be on the WINNING side, and then the difference is
whether it lives.**

`pair-redirect-priority ...bo3-2661747717` turn 6, three perish clocks at order 24, speed order
Gengar(0) / Basculegion(3) / Annihilape(0):

```
showdown   |-start|p2b: Gengar|perish0   |-start|p1a: Basculegion|perish3
           |faint|p2b: Gengar   |win|A                 <- ANNIHILAPE NEVER TICKS
medicham   ... |-start|p1b: Annihilape|perish0  |faint|p2b: Gengar  |faint|p1b: Annihilape
```

Instrumented on the AUTHORITY at that boundary: `battle.ended === true` while Annihilape still holds
`perishsong {duration: 1}`. `p1.party.annihilape.fainted medi true / sd false`.

### THE WIRE

A per-body stop at the close of the residual body loop, gated on `!_expiryQueuedFaint` — **that
asymmetry is the whole fix**: stopping on the expiry's own line would lose Basculegion's `perish3`,
which the authority does emit, i.e. a second defect wearing the first one's name. The weather group
is excluded because `sandstorm.onFieldResidual` is ONE authority handler with no drain between its
bodies (the engine's own comment already derives that). The group-top check stays.

### THE PROBE, AND WHAT IT DOES NOT STAGE

- **A** derives the family: `perishsong@24` is the ONLY legal move whose residual expiry faints.
- **B** replays the pool game: clean, 6 turns, no protocol and no board divergence, and
  `MEDSEEN.turnEndedSideWipedMidGroup = 1` proves the new stop fired; `--red` parts at t6 on
  `p1.party.annihilape.fainted` with `MEDFAILS.residualStopGroupOnlyRestored = 1`.
- **C** stages the same expiry family on a board where nobody runs out of bodies — 4 faints, boards
  identical on BOTH arms. That is the arm that says the change is a STOP and not a new rule.
- **There is NO staged ordinary-wipe arm, and the reason is in the file.** Wiping a side needs four
  bodies removed, `buildPair` refuses a side of fewer than four, and the only chip slow enough to
  script outruns the filler's Protect PP. Two drafts of that arm failed on the FIXTURE — the first
  carried a **Flame Orb, which is `isNonstandard: 'Past'` in this regulation** and read as an engine
  that never burns its holder. **The over-fire control for the ordinary wipe is the 961-game pinned
  measurement below**: if the new stop fires where the authority keeps walking, BOARD-MATERIAL goes UP.

### THE MEASUREMENT — FIX 3, AND THE FIRST VERSION WAS AN OVER-FIRE

**v1, release `276822231c52` — the prediction MISSED and the fix was NOT shipped.**

```
node engine/game_differential.js --steering empirical --release 276822231c52 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

| clause | before `f8266a5c48b7` | v1 `276822231c52` |
|---|---|---|
| whole-game **BOARD-MATERIAL** | 9 of 961 | **10 of 961 — UP** |
| whole-game PROTOCOL | 78 | 78 |
| whole-game NARRATION | 68 | 67 |

The target game left and **two others entered**: `omit-spread ...bo3-2654567638` t7 and
`omit-spread ...bo3-2661861148` t6, both parting on `p1.screens.special medi 4 / sd 3` — a Light
Screen turn the authority spends and this engine threw away.

**The cause, and it is the granularity again.** `residualOrder` walks EVERY live body for EVERY
group, so most iterations have no handler to run — and the authority has nothing there to call
`faintMessages()` after. `...2661861148` t6 is the clean example: ONE body carries a perish clock, it
expires and wipes p1, and the next handler the AUTHORITY has is the SIDE CONDITION at order 26, which
decrements before `faintMessages()` ends the battle. v1 stopped on the very next body-slot instead.

**v2, release `3f9830acc467`.** The stop is scoped three ways, all of them the authority's:
`_grpExpiryFaint` (an expiry in THIS group has already queued a faint), `_ranExpiryHandler` (this
body actually ran that handler) and `!_expiryQueuedFaint` (never on the expiry's own line).

| clause | before `f8266a5c48b7` | after `3f9830acc467` |
|---|---|---|
| whole-game **BOARD-MATERIAL** | 9 of 961 | **8 of 961** |
| whole-game PROTOCOL | 78 | **77** |
| whole-game NARRATION | 68 | **68** |
| `mid_void.void_games` | 3 | **3** |

**P1v2 HIT, P2v2 HIT, P3v2 HIT** (no game entered). The two v1 casualties are now carried as
CONTROLS inside the probe and must hold on both arms.

**What is still owed, declared rather than claimed closed:** the authority runs
`faintMessages(); if (this.ended) return;` after EVERY handler, and this reproduces it only for the
group holding a fainting duration expiry. `perishsong@24` is the only legal move whose residual
expiry faints (derived on every probe run), so that is the only group where an expiry can end a
battle — but an ORDINARY chip that wipes a side part-way through a group still lets the rest of that
group run here, and the group-top check catches it one group later.

## 5. WHERE THE BATCH LANDED

| clause | start `aa7b80f9a038` | end `3f9830acc467` |
|---|---|---|
| whole-game **BOARD-MATERIAL** | **11 of 961** | **8 of 961** |
| whole-game PROTOCOL | 80 | **77** |
| whole-game NARRATION | 68 (69 raw less 1 declared) | **68** |
| board parted before the protocol did | 0 | **0** |
| `mid_void.void_games` | 3 | **3** |
| census | 830 / 830 / 0 | **830 / 830 / 0** |
| roster items / abilities / moves | 140 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | **identical, 0 / 0 on all three**, re-run on `3f9830acc467` |
| game differential (`data/engine-diff.json`) | 0 of 6000, seed 20260804 | **0 of 6000**, re-run on `3f9830acc467` |

**BOARD-MATERIAL IS NOT ZERO. The quarantine does not open.**

The eight that remain, with what is known about each:

| game | what it is |
|---|---|
| `omit-protect ...2662758209` t4 | **VOID GAME** (instrument) — a Klefki burned here and clean there |
| `omit-spread ...2657358877` t6 | **VOID GAME** (instrument) |
| `omit-spread ...2658645239` t3 | **VOID GAME** (instrument) |
| `omit-spread ...2662243229` t11 | **LAST RESORT.** The authority prints `|-fail|p1a: Kangaskhan`; this engine lands the move. Last Resort fails until the user has used every other move it knows. NOT reproducible in the standalone replayer (that one game replays clean out of the pinned pool while the artifact records it), so it is named and NOT fixed here. |
| `pair-protect-bust ...2653991758` t7 | **A STAT CHANGE BETWEEN THE ARRIVALS OF A VOLLEY IS INVISIBLE TO THE LATER ARRIVALS.** Staged and reproduced from scratch: Aerodactyl Dual Wingbeat into a Stamina Mudsdale — hit 1 deals 34 and raises Def +1; the authority's hit 2 deals **22**, this engine's deals **34**, byte-identical to hit 1. `dmgRange` prices the whole volley once, before any arrival lands. Structural; not attempted in this batch. |
| `pair-protect-bust ...2661266222` t6 | first protocol split is an extra `|-hitcount|p1: Ditto|1` on a Parental Bond click that only landed one hit (the authority's `!(move.hit === 1 && parentalbond)` clause); the BOARD parts a turn later on something else |
| `pair-redirect-priority ...2654621676` t8 | first protocol split is a missing `|-fail|` on a **Leech Seed re-aimed at an already-seeded body**; staged standalone, this engine correctly REFUSES the volatile and only the `-fail` line is missing, so the board cause at t8 is still unidentified |
| `pair-speedctrl ...2654408616` t5 | **QUICK DRAW** — `|-activate|p1b: Slowbro|ability: Quick Draw` in the authority and not here, so the body is flinched by a Rock Slide it should have moved before |

### THE THREE VOID GAMES ARE STILL IN THE BAR — REPORTED, NOT ACTED ON

Unchanged from section 1: `state`'s board clause walks `results` unfiltered while the rate beside it
publishes `diverged_among_usable: 74 / usable_games: 958`. **Three of the eight are games the
instrument itself declares void.** Removing them would read 5 of 961, and that is a change to the
RULER and belongs to whoever owns the clause, not to a batch of engine fixes.

## 6. WHAT THIS BATCH TOUCHED

**Engine and derivation**
- `engine/tag_dex.js` — `curesStatus` gains `onSet` / `onSetPriority`, derived from `onAfterSetStatus`.
- `engine/medicham2-browser.js` — `berryStatusCureNow` (the shared `onEat` half), `berryCureOnSet`,
  the call at the foot of `applyStatus`; the confusion self-hit threshold; the per-handler residual
  stop at the close of the residual body loop.
- `data/tags.json`, `data/abra-tags.js` — regenerated (`node engine/tag_dex.js`, then
  `node build/build_tags_js.js`).

**Probes (all shown RED under their own knob before being trusted)**
- `tests/probe_cure_berry_on_set.js` — `MEDI_NO_CURE_ON_SET=1`
- `tests/probe_confusion_selfhit_chance.js` — `MEDI_CONFUSION_THIRD=1`
- `tests/probe_residual_stop_body.js` — `MEDI_RESIDUAL_STOP_GROUP_ONLY=1`

**Predictions, written before each run**
- `data/verification/_prediction-2026-09-07-batchL-fix1.json` — all hit
- `data/verification/_prediction-2026-09-07-batchL-fix2.json` — all hit
- `data/verification/_prediction-2026-09-07-batchL-fix3.json` — **v1 P2 and P3 MISSED and the miss is
  recorded in the file**; v2 all hit

**Dumps kept for the next batch** — `data/verification/batchL/dump-{baseline,fix1,fix2,fix3,fix3v2}.json`.
`dump-fix3.json` is the v1 over-fire and is kept deliberately: it is the evidence for the two games
that entered.

**Artifacts re-run on the final release `3f9830acc467`** — `data/game-differential.json`,
`data/roster.{items,abilities,moves}.json`, `data/engine-diff.json`, `data/all-mechanics-fire.json`,
`data/mechanics-census.json`. `node engine/status.js` reads **2 of 9 gate clauses failing**
(BOARD-MATERIAL and NARRATION), the same two as at the start of the batch.

**Not run, and not owed by this batch:** any fit, any self-play, `engine/status.js --write`, the
CHANGELOG and the version bump.
