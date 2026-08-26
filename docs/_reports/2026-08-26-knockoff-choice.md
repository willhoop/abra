# Knock Off vs the Choice Scarf — both halves, and the road nobody was watching

Will's fixture, 2026-08-26: *"test when choice scarf is knocked off if we allow a mon to click other
moves"*.

## THE ANSWER

**Half one — the menu. NO, we did not, on the road that matters.** The re-read of the item existed and
was correct, but it fired only as a SIDE EFFECT of building a menu. `chooseAction` builds one; a
**caller-supplied action does not**. So a body handed a click — every rollout candidate, every scripted
differential game, every MILTANK evaluation — was bound by a Choice Scarf that had been Knocked Off
turns earlier. Fixed.

**Half two — the ×1.5. YES, already correct.** `effSpeed` reads the item live off the slot, so the
multiplier died with the item before this batch. Now probed, and shown red on a deliberate break
(caching the multiplier on the body) which **no other instrument in the repository caught** — the
6,000-row differential and the other 745 census rows were all blind to it.

**A third case, which is not "the item left" at all.** `choicelock` has TWO escapes with opposite
lifetimes. This engine had one.

## THE AUTHORITY, PLAYED RATHER THAN RECALLED

`data/conditions.ts:324`, `choicelock`, no Champions override:

```js
onDisableMove(pokemon) {
  if (!pokemon.getItem().isChoice || !pokemon.hasMove(this.effectState.move)) {
    pokemon.removeVolatile('choicelock'); return;      // DESTROY
  }
  if (pokemon.ignoringItem() || pokemon.volatiles['dynamax']) return;   // SUSPEND
  ...
}
onBeforeMove(pokemon, target, move) {
  if (!pokemon.getItem().isChoice) { pokemon.removeVolatile('choicelock'); return; }
  ...                                                   // NOTE: no hasMove clause here
}
```

### Run 1 — Knock Off, one real `Battle` in `gen9championsvgc2026regmb`

The p1 request read straight off `activeRequest.active[0]`:

| | menu | item | spe | volatiles |
|---|---|---|---|---|
| before the Knock Off | `struggle` (lock + a Disable) | choicescarf | **120** | choicelock/disable |
| after the Knock Off | `swordsdance(DIS),knockoff,protect,fakeout(DIS)` | (none) | **80** | disable |

The action already chosen for the knock turn is not re-opened — the freeing appears in the request
issued at the END of that turn.

### Run 2 — Magic Room, the same board, eight turns

| turn | menu | item | spe | room | `volatiles.choicelock.move` |
|---|---|---|---|---|---|
| t2 | `swordsdance` alone | choicescarf | 120 | – | swordsdance |
| t3–t6 | `swordsdance,knockoff,protect` | choicescarf | 80 | 4→1 | **swordsdance** |
| t7 | `swordsdance` alone | choicescarf | 120 | – | **swordsdance** |

The body is **re-locked into the move it clicked seven turns ago**, having spent the room clicking
Knock Off. The volatile was never removed; only the disabling was skipped.

`ignoringItem()` is reachable two ways in Reg M-B — Magic Room (31 legal carriers) and Klutz (Lopunny,
Audino, Golurk). Embargo is `isNonstandard: 'Past'` and cannot.

## WHAT THIS ENGINE DID, MEASURED BEFORE A LINE CHANGED

One board, every click handed in, the foe's turn-2 click the only difference:

```
SUPPRESSED   ["swordsdance" x8]                     spe [120,80,80,80,80,120,120,120]  room [0,4,3,2,1,0,0,0]
LOST (KO)    ["swordsdance" x8]                     spe [120,80,80,80,80, 80, 80, 80]
NO ITEM ctrl ["swordsdance","swordsdance","knockoff" x6]
```

**The knocked arm and the untouched arm are byte-identical.** That is the unwired-knob signature, and
it was: the handed-in Knock Off was refused for six turns after the Scarf was gone, while a body that
had never HELD a Scarf played it. The `NO ITEM` control is what says the click is buildable on this
board at all.

The chooser road was, separately, correct — and correct **by accident**, because `mustStruggle` builds
a menu on the way past and `lockMenuMove` clears a dead lock as a side effect of that build.

## WHAT LANDED

Three edits in `engine/medicham2-browser.js`, one mechanism.

1. **`lockStillBinds` split out of `lockMenuMove`.** The item re-read is shared, because the authority
   runs it in BOTH handlers; `hasMove` stays in `lockMenuMove` alone, because `onDisableMove` tests it
   and `onBeforeMove` does not. Collapsing the two cost five census rows the first time this was written
   as one function and the split is what restored them.
2. **`getItem()`, not the slot.** `itemRoomHide` parks a suppressed item in `_roomItem`; the read is now
   `m.item || m._roomItem`, so a parked item is still HELD. A lost item destroys the lock
   (`choiceLockDroppedWithItem`); an ignored one suspends it (`choiceLockSuspendedWhileIgnored`).
3. **The collect site calls the predicate instead of reading the field.** `mk()`'s lock rewrite read
   `mon._lock` raw. It now asks `lockStillBinds(mon)`, and counts
   `choiceLockRereadOnHandedAction` when the re-read frees a handed-in click. `chooseAction`'s lock
   fallback was moved to the same predicate — required, not cosmetic: once a lock can be SUSPENDED
   without being cleared, a raw read there would force the locked move inside the room, which is the
   opposite of the authority.

Two knobs, each red on its own row and on nothing else:

| knob | row that goes MISSING |
|---|---|
| `MEDI_LOCK_STALE_ON_HANDED_ACTION=1` | *a Knock Off frees a HANDED-IN action* (+ the suppression row, which also hands its clicks in) |
| `MEDI_SUPPRESSED_ITEM_IS_LOST=1` | *a SUPPRESSED Choice item suspends the lock* only |

The already-green speed row was shown red by a deliberate break (caching `speedMult` on the body and
replaying it once the slot empties); the engine was restored and verified to carry zero occurrences of
the break marker.

## THE THREE PROBES

All in `tests/test-mechanics.js`, all through `koRun(` — declared in the direct-call paragraph and
added to `REALTURN`, because every click is handed in on both sides and that is the whole point of the
row.

| probe | tag | what its control is for |
|---|---|---|
| *a Knock Off frees a HANDED-IN action, not only a chosen one* | `item/choiceLock` | `kept` (same Scarf, foe clicks Dragon Claw) must stay BOUND; `bare2` (never held a Scarf) must CLICK, or a red is a broken fixture rather than a lock |
| *the Choice Scarf x1.5 dies with the item, on the turn after it leaves* | `item/speedMult` | 100 < 120 < 150 — the foe sits inside the window, so the arm can only pass if the multiplier is gone |
| *a SUPPRESSED Choice item suspends the lock; only a LOST one destroys it* | `item/choiceLock` | the Knock Off arm is the OTHER escape: it must stay free at t7 where the room arm is dragged back |

The same-turn boundary is asserted inside probe 1 rather than as a fourth row: turn 2 is the locked
Swords Dance in BOTH arms, because Knock Off resolves after the hit.

## NUMBERS

| | before | after |
|---|---|---|
| census live / probed / missing | 743 / 746 / 3 | **746 / 749 / 3** |
| `tests/test-engine-diff.js --n 6000` | 0 of 6000, sixteen corners | **0 of 6000, sixteen corners** |
| roster items / abilities / moves (DIFFER, DID-NOT-FIRE) | — | **0, 0 on all three** (139/148, 129/202, 475/500 tested) |
| release | `93a51075e83f` | **`a98b43a5f384`** |

The 3 MISSING rows are unchanged and are the three narration rows (#456 Telepathy, #457 Psych Up,
#458 Spicy Spray).

### Which scoreboard this should move, said before the run — AND THE PREDICTION WAS WRONG

The pinned pool replays RECORDED HUMAN CLICKS, which are handed-in actions — the exact road that was
broken — and Choice Scarf is on 11,384 sheets with Knock Off at 1,640+ uses. **So the pool was predicted
to move**, unlike the last four fixes. The suppression half was predicted to show only in the lab: Magic
Room plus a Choice Scarf on one body is not a pool event.

**It did not move at all.** 961 games, 15 diverged on both releases; every key of
`data/game-differential.json` is identical between the two runs except the `engine_release` stamp inside
one worked example. Same `first_divergences`, same `classes`, same `end_state` across all three arms,
same `families`, same `mid_void`, `games_board_never_diverged` 957 both times. The whole-game clause
stays at **10 of 961** and board-material at **4 of 961**.

**THE FIRST TWO ATTEMPTS WERE REFUSED BY THE ARTIFACT'S OWN GUARD, AND THE REFUSAL WAS RIGHT.** Run
without `--census` and `--team-store` the numbers read 976 games / 45 diverged — not a worse answer, a
different question: the live store had grown 8,778 → 11,493 distinct teams since the baseline and the
census pin defaulted to the freshly regenerated live census. `--baseline` caught both and exited before
playing a game. The published configuration is `--census
data/verification/census-pin-9446a684709d.json --team-store data/team-pool-frozen --end-state`.

**The one remaining turn-1 board-material game in the pool is a Magic Room game** — *"Meowstic clicks
Magic Room, and mega evolves"*, four items reading empty on our side against White Herb, Meowsticite,
Focus Sash and Twisted Spoon. That is ROADMAP #462's mechanism below, now with a seed.

## REPORTED, NOT FIXED

**`itemRoomForget` IS DEAD CODE AND ITS ABSENCE HAS A PRICE.** `engine/medicham2-browser.js:15522`
states that a Knock Off landing inside Magic Room clears the parked slot "with it
(`itemRoomForget`)". The function is declared at 15539 and **is called from nowhere in the file.**

Measured, same board, foe raises Magic Room on t1 and Knock Offs on t2:

| | t2 | t3–t5 | t6 (room down) |
|---|---|---|---|
| the authority | item gone | spe 80 | item **(none)**, spe **80** |
| this engine | slot already empty, strip no-ops | spe 80 | item **choicescarf**, spe **120** |

**The Choice Scarf comes back and the ×1.5 with it** — CLAUDE.md's named cost of an untracked Knock
Off, arriving through a door the item model leaves open. It is the same open item the hand list
already carries as *"MAGIC ROOM PARKS THE ITEM BY EMPTYING THE SLOT"*, now with a measured consequence
rather than a shape. Not fixed here: every strip site in the file reads `m.item`, so seeing through the
park is a refactor of a dozen sites, not a clause.

Note the interaction, stated rather than left to be discovered: with that defect standing, a Knock Off
inside a room leaves `_roomItem` set, so the new suspension clause keeps the lock alive across it. That
is the item model's divergence propagating, not a new one — this engine believes the item came back,
so it believes the lock came back.
