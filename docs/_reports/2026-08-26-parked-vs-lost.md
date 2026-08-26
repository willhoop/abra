# PARKED IS NOT LOST — the item model, 2026-08-26 (ENGINE)

Release cut for this batch: **`e04350588de1`** (an interim release `94d30febf3f2` was cut and measured
against first; both runs are kept below, because the attribution depends on the difference).

Register row: ROADMAP **#462 CLOSED**. CHANGELOG 5.145.0. Ledger section: `docs/ENGINE.md`.

---

## 1. THE ROOT

`engine/medicham2-browser.js` implements Magic Room and Klutz as a **swap** (WIRE 133): `itemRoomHide`
moves `m.item` into `_roomItem` so every effect reader sees an empty hand. The header promised the
mitigation — *"the parked slot is cleared with it (`itemRoomForget`) so the two cannot come apart"* —
and **`itemRoomForget` had two occurrences in the file: the declaration and that sentence.** Every
strip site wrote `m.item = ''`, which inside a suppression lands on an already-empty slot.

So a suppressed item **could not be taken**, and came back when the suppression ended.

## 2. THE AUTHORITY, PLAYED

`gen9championsvgc2026regmb`, one real `Battle` per arm, read off `pokemon.item`, `getActionSpeed()`,
`volatiles.choicelock` and `getMoveRequestData().moves`.

**Magic Room.** Incineroar @ Choice Scarf locked into Swords Dance on t1, Magic Room on t2, eight
turns, foe's t3 click the only difference:

| foe t3 | t3 item | t3 spe | t3 lock | t6 item | t6 spe | t6 lock | t6 menu |
|---|---|---|---|---|---|---|---|
| KNOCK OFF | – | 80 | – | – | **80** | – | free |
| PROTECT | choicescarf | 80 | swordsdance | choicescarf | **120** | swordsdance | LOCKED |

`choicelock.onDisableMove`'s first clause is `!pokemon.getItem().isChoice`, tested **above** the
`ignoringItem()` suspend — a loss inside the room takes the DESTROY road.

**Klutz.** Lopunny @ Choice Scarf / Klutz, Worry Seed removing the ability on t3:

| foe t2 | t2 item | t3 ability | t3 spe | t3 lock | t3 menu |
|---|---|---|---|---|---|
| KNOCK OFF | – | insomnia | **125** | – | free |
| PROTECT | choicescarf | insomnia | **187** | swordsdance | LOCKED |

**Klutz is NOT the same mechanic as Magic Room.** No `choicelock` is ever armed while Klutz is on,
because the item's `onModifyMove` cannot run. Magic Room can be raised over an already-armed lock.

**Acrobatics.** `basePowerCallback(pokemon,target,move){ if (!pokemon.item) ... }` —
`data/moves.ts:121-124`, no Champions override, the RAW field. Gliscor into Snorlax, first
`|-damage|p2b` line: **123 / 112** empty-handed, **57 / 52** holding. The room moves neither.

## 3. THIS ENGINE, BEFORE

```
MAGIC ROOM + KO   clicks [sd,sd,ko,ko,ko,ko,sd,sd]  spe [150,100,100,100,100,150,150,150]  item choicescarf
MAGIC ROOM ONLY   clicks [sd,sd,ko,ko,ko,ko,sd,sd]  spe [150,100,100,100,100,150,150,150]  item choicescarf
KLUTZ + KO        spe [165,165,247,247]  item choicescarf
KLUTZ ONLY        spe [165,165,247,247]  item choicescarf
ACROBATICS        leftovers no room 39   leftovers ROOM 76   (empty-handed 76 either way)
```

Byte-identical across the knob in both pairs. The trace carried
`|move|p2a: klefki|knockoff|p1a: incineroar` with **no `|-enditem|`**. The no-room control emitted the
`-enditem` and dropped the multiplier, so the fixture was sound.

## 4. WHAT LANDED

| | asks | callers |
|---|---|---|
| `itemOn(m)` | what item is ON this body (`pokemon.item` / `getItem().id`, survives suppression) | Knock Off, Thief, Covet, Corrosive Gas, Bug Bite, Pluck, Trick, Switcheroo, Pickpocket, Magician, Symbiosis, Harvest, Pickup, Acrobatics, the board leaf |
| `m.item` | what it can USE right now | every effect reader — Focus Sash, berries, Life Orb, the ×1.5, Fling, the herbs |
| `_hadItem` | what it started with (boolean) | Unburden |

- `itemLose(m)` — **the one door an item leaves by.** Reads identity, empties slot AND park, returns
  what it took, so the RETURN is the gate. `itemRoomForget` finally has its caller.
- `itemGive(m,id)` — the one it arrives by. Refuses a hand full in the IDENTITY sense (the authority's
  `setItem`) and parks on arrival into a standing suppression.
- ~159 raw `.item` reads deliberately NOT converted; the accessor header names what walks past it.
- `engine/board_state.js` `mediBody.item` -> `id(m.item || m._roomItem || '')`, matching `sdBody`'s
  `p.item`.

## 5. RED FIRST, AND EACH KNOB MOVES ONLY ITS OWN

| knob | rows that go MISSING |
|---|---|
| `MEDI_ROOM_ITEM_SURVIVES_LOSS=1` | the Magic Room row **and** the Klutz row, and nothing else (749 -> 747) |
| `MEDI_EMPTY_HAND_IS_THE_SLOT=1` | the Acrobatics row only |

**Paths proved REACHED, not present** (this file already holds two proofs it contains dead code —
`canMegaNow` declared twice, `itemRoomForget` with no caller):

| staged board | `itemLostThroughDoor` | `itemLostWhileSuppressed` | `itemGivenThroughDoor` |
|---|---|---|---|
| plain Knock Off, no room | 1 | 0 | 0 |
| Knock Off inside a room | 1 | **1** | 0 |
| Trick inside a room | 2 | **2** | **2** |

The Trick case ends with each body's item in the OTHER body's `_roomItem` — the gain door parking on
arrival.

**THE ACROBATICS PROBE WAS WRONG BEFORE THE ENGINE WAS.** Its first version put the row's own EQUALITY
assertion in `arms: {control, test}`, so the two arms agreed by design; `test-mechanics.js` flagged it
HOLLOW and exited 1. The pair is now the knob that must MOVE the number — empty-handed against
holding, both inside the room.

## 6. THE NUMBERS

| quantity | before | after | predicted |
|---|---|---|---|
| census live / probed / missing | 746 / 749 / 3 | **749 / 752 / 3** | 748/751 then 749/752 |
| turn-1 boards identical (pinned pool) | 960 / 961 | **961 / 961** | rise |
| board never diverged | 957 / 961 | **958 / 961** | 958 |
| turn boundaries identical | 12428 / 12449 | **12432 / 12449** | rise |
| whole-game clause | 10 of 961 | **10 of 961** | unmoved |
| raw diverged, primary arm | 15 of 961 | **15 of 961** | unmoved |
| `test-engine-diff --n 6000` | 0 of 6000 | **0 of 6000**, 16 corners | unmoved |
| roster items / abilities / moves | 0 / 0 | **0 DIFFER / 0 DID-NOT-FIRE**, 139 / 129 / 475 | unmoved |
| `all_mechanics_fire` STATE items/ab/moves | 1 / 2 / 5 | 1 / 1 / 5 | not predicted — census steering moved |

**THE ATTRIBUTION, RECORDED RATHER THAN SMOOTHED.** Three differential runs:

1. **engine fix only**, release `94d30febf3f2`, `board_state.js` untouched → **957/961, unmoved**, and
   the sole turn-1 board-material game still reads *"Meowstic clicks Magic Room, and mega evolves"*
   with four items empty on our side.
2. **engine fix + the leaf**, same release → **958/961**, turn-1 100.0%, the item leaves drop from
   `party.item` 2 games / 5 leaves + `active[].item` 1 game / 4 leaves to `party.item` 1 game / 1 leaf.
3. **published `--write`** on the final release `e04350588de1` → identical to (2).

Run (1) is kept because *"the engine fix closed the board-material game"* would have been a false
attribution. It did not; the RULER did.

**PINNED THREE WAYS**, and the artifact reports `COMPARABLE — same selection policy, census
9446a684709d, team pool 0d103fb9fa87`:

```
--games 1200 --census data/verification/census-pin-9446a684709d.json \
  --team-store data/team-pool-frozen --end-state --release e04350588de1 --write
```

## 7. STILL OPEN, FILED RATHER THAN CLAIMED

- **Recycle's gate reads the slot.** `onHit(pokemon) { if (pokemon.item || !pokemon.lastItem) return
  false; ... }` is an identity read; this engine's `refusesIfHolding` branch asks `!m.item`, so a body
  holding a PARKED item can Recycle here and cannot there. Found by the same sweep that found
  Acrobatics. **No probe fails on it yet**, so it was not fixed.
- **`itemRoomSync` runs at the top of a turn**, so an item un-suppressed mid-turn comes back one turn
  after the authority hands it back. Measured on the Klutz board; both arms of that census row are
  read at turn 4, after the sync in both engines, so no probe rests on it.

## 8. NOTES FOR THE ROUTER

- **`engine/board_state.js` is not on ENGINE's Owns list and this batch edited it.** The change is one
  expression and its argument is that the two engines were being asked different questions; it is
  called out here rather than assumed to be in scope.
- `tests/test-middle-identity.js` is RED and **was RED at HEAD before this batch** — verified by
  stashing the two changed engine files and re-running. Not this batch's.
- `tests/staged_board.js` 24 of 25, unchanged. `tests/test-resolution-order.js` PASSES at
  `--max-old-space-size=6144` (26 arms, 1 declared KNOWN-OPEN, 0 failing); #446 is the default heap.
- `.scratch_eng/`, `stash@{0}` and several pre-modified `data/*.json` belong to another session.
  **Reported, left, nothing executed in any of them.**
