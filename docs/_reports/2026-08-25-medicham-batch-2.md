# MEDICHAM FINISH — BATCH 2. An item parked by Magic Room is not an item lost.

2026-08-25. ENGINE. Release `2ecd3bdc274b` for both measured legs.

---

## 1. THE BRIEF'S PREMISE, REFUSED

The brief said: *"Pick the ONE largest board-material class."* **There is no largest one.** At the
starting artifact (release `9cfe6b3b97a8`, 961 games, 24 parted) the materiality table read
`BOARD-MATERIAL 11 causes, 11 games` — **eleven causes, one game each.** Ranking them by comparator
class is meaningless and ranking them by count is a tie eleven ways.

Grouped by MECHANISM rather than by class, the largest groups are **two**:

| mechanism | games | board-material |
|---|---|---|
| a chosen SWITCH the authority performs and medicham2 does not | 2 | 2 |
| Protect / stall, later turns | 3 | 2 |
| flinch | 2 | 1 |
| an immunity we answer with a miss or damage | 2 | 1 |
| switch ORDER inside the switch phase | 2 | 1 |
| singles (throat chop end, telepathy wording, gravity, perish-faint vs upkeep, `-damage` on a different body, an extra faint) | 6+ | 5 |

The Protect/stall "pair" does not survive inspection: `pair-protect-bust` t9
`|-fail|p2b <> |-start|p1a|disable|protect` is **Disable's own failure condition**, not the stall
counter. So the honest largest mechanism group is TWO, and one of those two has the harness as a live
suspect.

**The pick was therefore made on what could be diagnosed to the bottom and proved in one pass**, not
on a count. It landed on the switch-ORDER game, and the mechanism underneath it turned out not to be
about switches at all.

---

## 2. THE DIAGNOSIS

### 2.1 What the divergence was

`ordering :: |switch|p1b|whimsicott,l50|H/H <> |switch|p1a|alakazam,l50|H/H`
config `omit-spread`, turn 2, BOARD-MATERIAL, seed
`gen9championsvgc2026regmbbo3-2659015200 vs gen9championsvgc2026regmbbo3-2659004938`.

Replayed with `engine/replay_one.js` and reproduced exactly. Turn 2, **all four bodies switch out**:

```
  0014  SD    P1b Whimsicott sends in (replacing Meowstic)
        US    P1a Alakazam   sends in (replacing Sneasler)
  0015  SD    P1a Alakazam   sends in (replacing Sneasler)
        US    P1b Whimsicott sends in (replacing Meowstic)
  0016  both  P2a Blaziken  ...    0017  both  P2b Gengar ...
```

### 2.2 What the authority's rule is, read rather than recalled

`sim/battle-queue.ts:174-197` — `switch: 103`, `megaEvo: 104`, `priorityChargeMove: 107`, move `200`.
`resolveAction` ends `this.battle.getActionSpeed(action)`, and `getActionSpeed` (sim/battle.ts) sets
`action.speed = action.pokemon.getActionSpeed()` for every action that has a pokemon — for a `switch`
that pokemon is the body **switching out**. `comparePriority` then sorts order ASC, priority DESC,
speed DESC.

### 2.3 The measurement that settled it

A scratch wrapper around `Battle.prototype.getActionSpeed`, run over that exact game inside the
differential's own driver at the pins:

```
  turn 0  team      Alakazam  speed=172   Meowstic  speed=160   Sneasler speed=151  Whimsicott 136
  turn 0  team      Blaziken  speed=132   Gengar    speed=167   Hatterene  54   Samurott-Hisui 115
  turn 1  switch    Alakazam  order=103 speed=172 target=Sneasler
  turn 1  megaEvo   Meowstic  order=104 speed=160
  turn 1  move      Meowstic  order=200 speed=182     <- Meowstic-M-Mega, AFTER evolving
```

So on turn 2 the outgoing speeds are **Meowstic-M-Mega 182, Sneasler 151, Samurott-Hisui 115,
Hatterene 54** and Showdown's order p1b, p1a, p2a, p2b is a clean descending sort. **medicham2's
Sneasler therefore had to be reading above 182.**

### 2.4 The cause

The Sneasler holds a **White Herb** and its declared ability is **Unburden**. Its partner Meowstic
put **Magic Room** up on turn 1.

- `engine/medicham2-browser.js:itemRoomHide` — `if(m.item&&m._roomItem==null){m._roomItem=m.item;m.item='';}`
  Magic Room and Klutz share one predicate (`itemSuppressed`), and the way this engine makes every
  item read return nothing is to **empty the slot**.
- `engine/medicham2-browser.js:effSpeed` — `if(m._hadItem&&!m.item){ ...speedOnItemLoss... }`
  This is the stand-in for the authority's `unburden` VOLATILE, and it reads **the same slot**.

So a SUPPRESSED item is indistinguishable from a LOST one, and Unburden fires.

Measured on a bare board (`node -e`, `battleInit` + a real Magic Room turn):

```
  unburden + magicroom   held 165  after 330    item ''  _roomItem focussash  _hadItem true
  none     + magicroom   held 165  after 165
  unburden, no room      held 165  after 165
```

### 2.5 The authority, asked directly

```
  before  spe 140  item focussash  volatiles (none)
  after MR spe 140  item focussash  magicroom true  volatiles stall
```

Sneasler @ Focus Sash, Magic Room up, in `champions_sim`. **140 → 140, the item still in the slot,
and no `unburden` volatile.** `data/mods/champions/abilities.ts` has no `unburden` key, so mainline's
is what this format runs: added only by `onAfterUseItem` / `onTakeItem`, and its condition needs
`!pokemon.item`.

**This is not a speed tie.** The two engines compute different SPEEDS (151 vs 302 in the pool game,
172 vs 344 on the probe board), which is a rule, not a coin flip. `speed_gap` is large and
`same_priority` is irrelevant.

---

## 3. RED FIRST — `tests/probe_room_unburden.js`

New. Two engines, one staged board, everything derived from the format (carrier = the fastest legal
Unburden body that learns Protect and a damaging move → Sneasler; roomer = the first legal Magic Room
learner → Alakazam; foe = the SLOWEST legal body still strictly faster than the carrier that learns
Protect and Knock Off → Meowscarada, base 123 against 120, so ONE doubling flips the order and nothing
else can).

Turn 1 varies per arm; turn 2 is the measurement — both fast bodies click a damaging move, so the
`|move|` order IS the speed comparison, and the carrier does not Protect (a +4 shield would hide it).

| arm | knob OFF (fixed) | knob ON (`MEDI_ROOM_ITEM_IS_LOST=1`) |
|---|---|---|
| **A** Magic Room + the item + Unburden | speed AGREE, protocol AGREE | **speed PARTS** — 344 against 172 |
| **B** CONTROL: identical, ability `Pressure` | speed AGREE | speed AGREE |
| **C** CONTROL: identical, NO Magic Room | speed AGREE | speed AGREE |
| **D** POSITIVE: no room, item KNOCKED OFF turn 1 | speed AGREE (both 344) | speed AGREE |

Under the knob **only arm A moves.** D is the positive that stops a "fix" which simply deletes the
mechanic.

**A residue the probe reports rather than hides:** arms A and B both part on the `item` **board leaf**
(`p1.party.sneasler.item sd="focussash" we=""`), before the fix and after. That is `itemRoomHide`
emptying the slot, it is the standing *"Magic Room parks the item"* hand-list item, and it is a
refactor of every item reader — not this line. The probe prints the speed verdict, the protocol
verdict and the parting board leaves as three separate columns for exactly this reason: one number
would let the residue mask the fix, or the fix take credit for the residue.

**The first version of this probe was wrong**, in the house pattern. It compared the two `|move|`
lists and reported `ORDER: AGREE` on an arm that had already parted — `playGame` STOPS at the first
divergent line, so two truncated streams compare equal. It now reads the comparator's own verdict
(`r.div`, `r.stateDiv`) plus the speed leaf.

---

## 4. THE FIX

`engine/medicham2-browser.js`, `effSpeed`:

```js
if(m._hadItem&&!m.item&&(ROOM_ITEM_IS_LOST||m._roomItem==null)){
  if(m._roomItem!=null)MEDFAILS.roomItemIsLostRestored=1;
  const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)_mods.push(+_ub.speedMult);}
```

`_roomItem` is the witness rather than `itemSuppressed(m,field)` — the latter is the same fact one
level up, but it bumps `MEDSEEN.itemSuppressedByAbility` and `effSpeed` is called several times per
action, so asking it here would turn a diagnostic counter into a speed-read counter.

`MEDFAILS.roomItemIsLostRestored` is written **inside the branch**, so it reads 1 only when the knob
actually changed an answer. Verified: 0 with the knob off, 1 with it on and a parked item in play.

New census probe, `tests/test-mechanics.js`, `ability/speedOnItemLoss` — *"an item PARKED by Magic
Room is not an item LOST"*. Three arms plus a staged-fixture assertion (`magicRoom > 0`, `!me.item`,
`me._roomItem` truthy) so an arm that never staged the room cannot pass for the wrong reason, and a
genuine-loss arm on the same body so an engine that never doubles cannot pass either.

---

## 5. THE MEASUREMENT

**One release, one driver, one census pin, one varied env knob.**
Release `2ecd3bdc274b` (identical bytes both legs — the knob is an env var, not a source change).
`--games 1200` (a PAIR budget → 961 games played), `--arm middle`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
`--end-state`, turn cap 12. The AFTER leg carried `--write`; the artifact's `generated` moved to
`2026-08-25T21:51:25.432Z`.

| | knob ON (defect restored) | knob OFF (fixed) |
|---|---|---|
| census probed / live / missing | 706 / 705 / **1** | **706 / 706 / 0** |
| protocol PARTED | 24 of 961 | **23 of 961** |
| board-material | 11 causes / 11 games | **10 causes / 10 games** |
| narration-only | 12 causes / 13 games | 12 causes / 13 games |
| shape RULE | 10 | 10 |
| shape EMISSION | 9 | 9 |
| shape ORDERING | 5 | **4** |
| DIFFERENT-END-STATE | 12 | 12 |
| games whose board NEVER diverged | 942/961 | 943/961 |
| `SPEED AGREEMENT` disagreeing readings | 34 in 10 games | **32 in 9 games** |
| status gate clause | 19 of 961 = 2.0% | **18 of 961 = 1.9%** |

The gate figure is raw parted less the 5 declared `fallenundefined` rows.

**Exactly one cause left the list**, and it is the one this pass aimed at. The 23 remaining causes are
the previous 24 minus `omit-spread :: |switch|p1b|whimsicott <> |switch|p1a|alakazam`, row for row —
checked by diffing the two `first_divergences` lists.

**Which scoreboard, said before the run:** Magic Room is rare and Unburden rarer, so the LAB was
expected to gain a row and the POOL to move by the single game the mechanism was found in. Both
happened and nothing else did.

### Corroborating runs, all on `2ecd3bdc274b`

| run | result |
|---|---|
| `tests/test-mechanics.js` | 706 live, 0 missing, 706 probed |
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | **0 of 6000 at all 16 corners** |
| `tests/roster.js --stage items --write` | 0 DIFFER, 0 DID-NOT-FIRE, 139 MATCH (identical to the previous release) |
| `tests/roster.js --stage abilities --write` | 0 / 0, 130 MATCH (identical) |
| `tests/roster.js --stage moves --write` | 0 / 0, 475 MATCH (identical) |
| `engine/all_mechanics_fire.js --kind all --write` | **8 STATE rows** — unchanged (moves 5, abilities 2, items 1) |
| `tests/test-engine-consistency.js` | all checks passed |
| `tests/test-bracket-regain.js` | 3 passed, 0 failed |
| `tests/test-resolution-order.js` | PASS, 26 arms, 1 declared KNOWN-OPEN, 0 failing |
| `tests/test-volatile-duration.js` | all 4 scenarios identical to the official engine |
| `tests/test-game-diff.js` | all scenarios AGREE |

`all_mechanics_fire`'s `klutz` STATE row — *"boards parted at turn 1, WITH NO LINE DIFFERENCE AT
ALL"* — is the `item`-leaf residue arriving from the second instrument, unchanged and correctly not
claimed as fixed.

---

## 6. WHAT IS LEFT, NAMED

The 23 remaining causes, 5 of them the declared Supreme Overlord family:

```
baseline               t2   -damage: a different body :: |-damage|p2a <> |-damage|p2b          BOARD
baseline               t4   ordering :: |upkeep <> |faint|p1b                                   narration
baseline               t5   |-activate|p2a|telepathy <> |-immune|p2a|[from]telepathy            BOARD
baseline               t5   |-immune|p1a <> |-damage|p1a|H/Hpsn        (Endeavor onTryImmunity)  narration
baseline               t6   |-end|p1a|throatchop <> |upkeep                                     narration
baseline               t8   |move|p2a|psychicfangs <> |cant|p2a|flinch                          BOARD
omit-intimidate  x3    t2   fallenundefined                                    DECLARED — do not touch
omit-protect           t2   fallenundefined                                    DECLARED — do not touch
omit-protect           t8   |switch|p2a|crabominable <> |cant|p1b|recharge                      BOARD
omit-protect           t9   |faint|p2b <> |-status|p2a|brn                                      BOARD
pair-protect-bust      t6   |-singleturn|p2a|protect <> |-fail|p2a                              BOARD
pair-protect-bust      t7   ordering :: |switch|p1a|staraptor <> |switch|p2a|incineroar         narration
pair-protect-bust      t7   |-supereffective|p1a|1 <> |move|p1a|gravity                         BOARD
pair-protect-bust      t9   |-fail|p2b <> |-start|p1a|disable|protect                           BOARD
pair-protect-bust      t10  ordering :: |-miss|p1b|p2b <> |-activate|p2a|protect                narration
pair-protect-bust      t10  |-immune|p1a <> |-miss|p2b|p1a   (Zap Cannon at a Ground/Ghost)     BOARD
pair-redirect-priority t1   |-immune|p1b <> |cant|p2a|flinch                                    narration
pair-redirect-priority t11  |switch|p1a|krookodile <> |detailschange|p1b|charizardmegay         BOARD
pair-speedctrl         t2   fallenundefined                                    DECLARED — do not touch
pair-speedctrl    x2   t5   ordering :: |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind        narration
```

### The one that is half-diagnosed and NOT mine to finish

`pair-redirect-priority` t11. `--trace-choices` shows **24 choices, 0 REFUSED**, and turn 11 p1 sent
`"switch 3, move 3 mega"`. Showdown accepted it and brought Krookodile in; medicham2 megaed the
Charizard and **never switched p1a at all** — Floette neither switched nor moved. The same shape
appears at `omit-protect` t8, where Showdown performs a second switch and this engine goes straight to
a `|cant|recharge`.

`game_differential.js` translates the driver's chosen body into Showdown's `switch N` index, and
Showdown REORDERS `side.pokemon` on every switch while medicham2 keeps its own bench order. **That
makes the harness a live suspect**, and ENGINE may not edit it. If it is the instrument, the row is
MEASURE's.

---

## OWED, NOT RUN

```bash
# gates this pass did not run — every one of them can see a turn-order change
node tests/test-end-state.js
node tests/test-encore-fail-silent.js
node tests/test-roster-arm-pin.js
node tests/test-middle-identity.js
node tests/run-all.js

# the two undiagnosed board-material "missing switch" games, replayed whole
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js \
  --release 2ecd3bdc274b --team-store data/team-pool-frozen --games 1200 --arm middle \
  --config omit-protect --trace-choices \
  --seed "gen9championsvgc2026regmbbo3-2656624602 vs gen9championsvgc2026regmbbo3-2657402800"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js \
  --release 2ecd3bdc274b --team-store data/team-pool-frozen --games 1200 --arm middle \
  --config pair-redirect-priority --trace-choices \
  --seed "gen9championsvgc2026regmbbo3-2656847681 vs gen9championsvgc2026regmbbo3-2656808520"

# does the harness's `switch N` index survive Showdown reordering side.pokemon?  MEASURE, not ENGINE.
node engine/where.js game_differential

# neither re-run on this release
node tests/interaction_matrix.js
node tests/mutation_harness.js
node engine/quarantine.js

# a POOL-SCALE reading of the knob's own counter. game_differential.js surfaces no MEDFAILS, so
# MEDFAILS.roomItemIsLostRestored has only ever been read on a staged board.
MEDI_ROOM_ITEM_IS_LOST=1 node engine/game_differential.js --games 1200 --arm middle \
  --release 2ecd3bdc274b --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state

# the item-parking refactor, if it is ever taken: every reader of m.item that should read through
# itemSuppressed(m, field) instead of a slot this engine empties.
grep -n "\.item\b" engine/medicham2-browser.js
```
