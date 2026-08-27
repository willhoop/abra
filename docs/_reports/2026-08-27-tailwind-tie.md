# The two Tailwind rows — fixed, and the brief's premise refuted. 2026-08-27

## The question that was asked first: does this reverse any part of today's Trace fix?

**No. Nothing in `engine/game_differential.js` was touched, `DICE_MODEL` is still `split/v3`, and
`PIN_DIGEST` is still `44bd49403231` — read off the new artifact, not remembered.** The two fixes
reach different doors:

- the Trace fix pinned the **range form** of `pinRandom` (`random(m, n)`, the queue insertion index)
  in the middle arm;
- Tailwind's order is decided by `pinShuffle`, which was **already a no-op in every shipped arm** and
  still is.

No die was added, removed or re-pointed, and the fix consumed no shared address. That is why the pin
digest is unmoved and why a run before and a run after this change table together.

## The premise was half right, and the wrong half was the one that decides the fix

The brief derived, correctly, that the two Tailwinds are a **true tie**: both carry
`onSideResidualOrder: 26` and `onSideResidualSubOrder: 5`; the holder is a `Side`, which has no
`getStat`, so `resolvePriority` never sets `speed`; and `effectOrder` — the creation counter that
*would* separate them — is filled **only** for `SwitchIn` and `RedirectTarget`
(`sim/battle.ts:993-999`, whose own TODO says exactly that). All five keys of `comparePriority`
match. Confirmed by reading the whole block, as asked.

It then concluded *"the fix is to match a DRAW, not to find an ordering rule."* **That is the half
that is wrong, and it is refuted by the arm's own header:** `pinShuffle` is a no-op in every shipped
arm, so under measurement the authority **never re-orders a tied group** and keeps whatever
permutation its selection sort produced. Nothing is drawn on either side. The answer is deterministic
and it is the **swaps**.

### What actually decides it, dumped from the authority rather than argued

`fieldEvent` builds **one flat list** — field handlers, then for each side its side conditions and
then each active body's own handlers (`sim/battle.ts:490-505`) — so p1's Tailwind sits near the head
and p2's a whole side later. `speedSort` is a selection sort that **swaps**: pulling the fastest
handler forward into position 0 sends whatever stood at position 0 to the index that handler came
from. The authority's own list, captured on the staged board with the fastest body on p2:

```
[0] tailwind@p1   o=26 s=0 sub=5
[1] leftovers@p1a o=5  s=238
[2] protect@p1b   o=-  s=344
[3] stall@p1b     o=-  s=344
[4] leftovers@p1b o=5  s=344
[5] tailwind@p2   o=26 s=0 sub=5
...
[9] leftovers@p2b o=5  s=344        <- the fastest, and it is BEHIND p2's Tailwind
```

Placing it swaps positions 0 and 9, and p1's Tailwind lands at 9 — **behind its own partner at 5**.
When the group is finally placed it comes out `p2, p1`. No comparator can produce that permutation.

That is `docs/_reports/2026-08-24-residual-order.md` §5's finding, re-derived here from the
authority's list rather than inferred from a four-arm sweep.

## The fix — the authority's list, rebuilt as a shadow

`engine/medicham2-browser.js`, a new block above `residualExpireAt`:

- `residualShadowBuild` emits entries in the authority's **collection order**, one per live walk
  participant, carrying only what `comparePriority` reads: order (`null` becomes the authority's own
  `4294967296`), subOrder, and holder speed (0 for a Side or the Field).
- Membership is `data/residual-order.json`'s — the **population** of 90 (effect, site) pairs produced
  by calling `Battle#resolvePriority` — with a presence reader attached to each row. Rows this engine
  has no reader for are named in `MEDFAILS.residualShadowUnread` rather than counted absent.
- `residualShadowSort` is `Battle#speedSort`, and it resolves a genuinely tied group off the **same
  `tie` stream** `residualOrder` uses: the identity under a pinned die, a uniform permutation under
  real dice.
- It is built **once per residual phase**, at the same moment the authority builds its own — right
  after `_RES_TIE_GEN++`, above the weather chip — and only when two clocks can actually tie.

**The blast radius is bounded by construction.** `residualExpireAt` still sorts its jobs by the
published subOrder **first**; the shadow rank is only ever the second key, and `Array.prototype.sort`
is stable, so a class the shadow cannot rank comes out exactly as it did before. A wrong shadow list
can only re-order two clocks that already tie — which is the thing that was wrong — and can never
move a clock out of its published stage.

### A Champions override found on the way, and it was found by the instrument

The first version applied mainline's Trick Room transform, `10000 - speed`
(`sim/pokemon.ts:641-649`). **Champions overrides `getActionSpeed`** —
`data/mods/champions/scripts.ts:44-54`, commented *"Remove Trick Room underflow"* — to a bare
`-speed`, with the `trunc` gone as well.

Both orderings agree **among bodies**, so all six board arms were green either way. It was caught
only by holding the rebuilt list against the authority's real one: **5 of 36 phases** disagreed on
the speed key, `-142` against `9858`. Fixed, and the comparison went to **36/36**.

**The difference is not cosmetic and only looks that way because of a gap in the table.** Under
`-speed` every body is negative and a Side is 0, so under Trick Room **in this format** every side
and field clock runs *above* every body of the same order — the reverse of the normal case, and the
reverse of what `residualExpireAt` does. Nothing reads it today because orders 26 and 27 carry no
per-body step at all in `data/residual-order.json`. Recorded in the engine, not fixed: a later
regulation that puts a body handler at 26 or 27 makes it live.

## The probe — `tests/probe_residual_shadow.js`

Red first. Under `MEDI_RESIDUAL_SHADOW_OFF=1` the `lefto-fast-p2` arm prints exactly the pool's row:

```
DIFFERS lefto-fast-p2   sd [2,1]  me [1,2]
   {"sd":"|-sideend|p2:|tailwind","me":"|-sideend|p1:|tailwind", ...}
```

- **Everything is derived** from `Dex.forFormat('gen9championsvgc2026regmb')`, filtered
  (`exists && !isNonstandard && tier !== 'Illegal'`), and printed: 271 legal species walked, 20
  Tailwind learners, 70 Reflect users, 40 Trick Room users. The two carriers come from the **middle**
  of the learner list so neither is itself the knob.
- **The fixture proves it stages the collision** — both Tailwinds must end, in both engines, on one
  turn — and **refuses to pass if the authority gives one answer on all four arms**. It gives two.
- **The first version of this file was wrong before the engine was**, in the way this repo keeps
  paying for: it read the engine module off disk while `game_differential` played the **frozen
  release's** copy, and reported `0 residual phases` while every arm was green. The comment on that
  line says so.
- **A fixture bug found by the same run:** `s.id` has no dash (`aerodactylmega`), so the obvious
  mega-forme regex matched nothing and the first board carried a mega forme as a team member. Filtered
  on `forme` instead.

Clean:

```
AGREES  bare                 sd [p1:tailwind p2:tailwind]
AGREES  lefto-fast-p1        sd [p1:tailwind p2:tailwind]
AGREES  nolefto-fast-p2      sd [p1:tailwind p2:tailwind]
AGREES  lefto-fast-p2        sd [p2:tailwind p1:tailwind]
AGREES  screens-both-sides   sd [p1:tailwind p2:tailwind p1:reflect p2:reflect]
AGREES  trick-room-up        sd [p2:tailwind p1:tailwind]

THE REBUILT LIST vs THE AUTHORITY'S, 36 residual phases:
  same length                            36/36
  same (order,subOrder,speed) multiset   36/36

UNDER REAL DICE the tied pair comes out B-first 204/400 (51.0%).
```

The last line is the other half, and it is the half a hardcoded "side B first" would fail: it drives
the **shipped** sort (`residualShadowSortForTest`) with a real die, so there is no second
implementation to disagree with.

## The census row

`move/sideBuff — two Tailwinds ending on one turn come out in the order the authority's selection
sort leaves them`. Two arms, the knob being which side carries the fastest body; they answer
**opposite** orders. Under `MEDI_RESIDUAL_SHADOW_OFF=1` both answer `p1,p2` and the row reads
**MISSING**, demonstrated before the row was trusted.

## The numbers

All re-measured on release **`6afa148cbeb1`** (cut on this tree), arm `middle`, `--games 1200`
(a pair budget; the pool holds 961), `--turns 12`, `--team-store data/team-pool-frozen`,
`--census data/verification/census-pin-9446a684709d.json`, `--state --end-state`.

**`data/game-differential.json`'s mtime was `2026-08-27 11:49:41` and was still that at 12:37 when
the release was cut — stable, no other agent was writing it, so no wait was needed.**

### Said before the run

Whole-game **13 → 11**; board-material **unmoved at 10**; pin digest unmoved. *Which scoreboard:*
**the pool**, because the two rows are pool rows — and the lab as well, because a census row was
added. Board-material was predicted not to move: a `-sideend` reorder writes no board leaf.

### Measured

| | before (`549cdbdd8060`) | now (`6afa148cbeb1`) |
|---|---|---|
| raw diverged | 18 | **16** |
| whole-game (raw less declared) | 13 of 961 | **11 of 961** |
| **board-material** (`games − games_board_never_diverged`) | 10 of 961 | **10 of 961** |
| parted before the protocol did | 4 | **4** |
| pin digest | `44bd49403231` | **`44bd49403231`** |
| census | 764 live / 764 probed / 0 missing | **765 / 765 / 0** |

**Both Tailwind rows are gone from `first_divergences`** — grepped, not assumed; no row in the
sixteen mentions Tailwind.

### Must not move — did not

```
damage differential   0 of 6000, seed 20260804, and 0 of 6000 at EVERY one of the sixteen
                      corners of the damage roll
roster / items        139 FIRED-AND-BOARDS-MATCH, 0 DIFFER, 0 DID-NOT-FIRE
roster / abilities    129 FIRED-AND-BOARDS-MATCH, 0 DIFFER, 0 DID-NOT-FIRE
roster / moves        475 FIRED-AND-BOARDS-MATCH, 0 DIFFER, 0 DID-NOT-FIRE
all_mechanics_fire    1289 games, 0 threw; moves STATE 5, abilities STATE 1, items STATE 1
tests/test-speed-tie.js, test-volatile-duration.js, test-engine-consistency.js   all PASS
```

The gate clause count fell from **6 of 8 failing to 3 of 8** — the three roster clauses were failing
only because their artifacts had been measured against an older release and are now re-run.

## OWED, NOT RUN

- **The list fidelity is measured on 36 staged phases, not on the pinned pool.** The pool's own
  residual lists were never dumped and compared, because `game_differential` does not expose the
  team pool as a list a probe can draw from. The evidence that the wider membership table is right is
  indirect: the run did not gain a divergence, `MEDFAILS.residualShadowUnranked` is not raised, and
  the roster is clean. A direct pool-wide list comparison is the honest next instrument.
- **Seven artifact volatile rows have no reader in this engine** and are printed on every probe run:
  `magnetrise, beakblast, chillyreception, counter, electrify, focuspunch, mirrorcoat`. Each is one
  list entry this engine cannot see, and a missing entry shifts every index after it. `magnetrise` is
  already a registered open defect (`magnetrise@18`, no clock).
- **Two approximations are declared in the engine and were not measured apart.** (1) The authority
  walks `pokemon.volatiles` in insertion order; the shadow emits them in the artifact's row order.
  (2) Tailwind is a field counter here and a side condition there, so it is emitted after the `sf.sc`
  keys rather than at its own insertion point. The `screens-both-sides` arm exercises the second and
  agrees; neither has a probe of its own.
- **The Trick Room side-vs-body inversion under Champions' `-speed`** is recorded in the engine and
  NOT fixed. It is unreachable today because no residual order holds both a per-body step and a
  side/field clock. No register row.
- **The remaining sixteen rows were not touched**, including the second `pair-protect-bust`
  board-material game, the `fallenundefined` family and the random-target row — all out of scope by
  the brief.
