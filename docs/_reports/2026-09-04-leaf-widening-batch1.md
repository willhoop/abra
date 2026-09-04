# Leaf widening, batch 1 — Throat Chop, Must Recharge, Flash Fire

2026-09-04 · ENGINE · light mode (no whole-game run, no roster, no census regeneration)

## Verdict

**CLASS, not instance.** Three leaves that a legal mechanic writes were reaching the board and
nothing was looking at them. All three are now compared, each shown RED first with a planted
difference and each carrying a control arm on an agreeing board that stayed silent.

`tests/probe_uncompared_leaves.js derive()` — the one producer of this split — moves:

| | before | after |
|---|---|---|
| leaves compared | 34 | **37** |
| leaves in neither list (the hole) | 42 | **39** |
| of the hole, can stand at a boundary | 22 | **19** |
| ceiling (compared + standing) | 56 | 56 |
| `status.js` "board leaves compared" | 34 of 56 | **37 of 56** |

No simulator byte moved. `engine/medicham2-browser.js` is untouched; the change is entirely in the
comparator, `engine/board_state.js`, plus the probe.

## What was wired, and the authority for each

Champions overrides **none** of the three. Derived, not remembered:
`grep -n "throatchop\|mustrecharge\|flashfire" data/mods/champions/{moves,conditions,abilities,scripts,items,rulesets,formats-data}.ts`
returns nothing — the three names appear only in `data/mods/champions/learnsets.ts`. Mainline is
therefore the authority and every line number below is mainline's.

Every usage count is read off that entity's own row in `data/tags.json`, never typed.

### volatile:throatchop — 5,577 uses (`move:throatchop`)

- Authority: `pokemon-showdown/data/moves.ts:19383-19430`. The condition declares `duration: 2`
  (`:19391`) and is applied by a 100%-chance secondary `onHit` calling `target.addVolatile('throatchop')`
  (`:19424-19427`). `onResidualOrder: 22`, `onEnd` announces `-end … [silent]`.
- Ours: `engine/medicham2-browser.js:33473` writes `tg._noSound = +blocksSoundMoves.turns`. That
  `turns` is **2**, DERIVED into `data/tags.json` from `dex.conditions.get(throatchop)` — printed and
  checked, not assumed. Ticked at `:7822` (residual walk) and `:36936` (foot of turn).
- Compared **as a clock on both sides**, because both engines hold one and they agreed exactly at
  every staged boundary: `_noSound = 1` against `throatchop(d1)` at the boundary that closes the
  applying turn, and `0` against absent one boundary later.
- Still not seen by this leaf: the residual **order**. `residualExpiryDeferred()` already names
  `throatchop@22` — this engine ticks at the foot of the turn instead. That gap is unchanged and
  is not claimed fixed.

### volatile:mustrecharge — 4,701 uses across 6 moves

Verified writer-by-writer out of `data/tags.json`: `hyperbeam` 4,576, `gigaimpact` 67,
`hydrocannon` 30, `blastburn` 11, `rockwrecker` 9, `frenzyplant` 8 — **4,701**.

- Authority: `pokemon-showdown/data/conditions.ts:364-378`, `duration: 2`, `onLockMove: 'recharge'`,
  and an `onBeforeMove` at priority 11 that removes it and refuses the turn.
- Ours: `engine/medicham2-browser.js:34724` sets the **boolean** `_recharge`, read back at `:24494`.
- Compared **as presence**, and the narrowing costs nothing *at this sampling point*: the authority's
  clock can only ever read 1 when a turn boundary is sampled (2 → residual of the applying turn → 1
  → removed by `onBeforeMove` on the next turn, before any further boundary). medicham2 cannot express
  a clock here at all, so comparing one would be this file's representation and not a rule
  disagreement.

### volatile:flashfire — 1,416 uses (`ability:flashfire`)

- Authority: `pokemon-showdown/data/abilities.ts:1331-1368`, read whole. `onTryHit` refuses a Fire
  move and `addVolatile('flashfire')`; the condition declares **no duration whatever** — `noCopy`, an
  `onStart`, two `onModify` hooks and an `onEnd`. `onEnd` on the ABILITY removes the volatile.
- Ours: `engine/medicham2-browser.js:16158` (`absorbGift`) keys it in `_vol.flashfire` off the tag's
  own `typeImmunity.gain.volatile`, and ends it with the ability at `:19465`.
- Compared **as presence on both sides, collapsing nothing** — neither engine carries a duration.
  Both held it at **two consecutive boundaries** in the control arm, which is the falsifier for
  "can it be standing when the board is read".

## The red-first evidence

`tests/probe_leaf_widening.js`. The committed version (`63c55c9c`) already planted `throatchop` and
`mustrecharge`; this pass added a `flashfire` case with the same two arms, and it was shown red
before anything was wired.

### Before (verbatim, the three wired leaves)

```
  compared keys today: 23 per-body volatiles

  ---- volatile:throatchop
       in the comparator: no        declared in NOT_COMPARED: no
       b1  medi=1 sd=1   diffs=0
       CONTROL  PASS — no difference reported on this leaf
       RED      RED — the plant was INVISIBLE to the comparator (0 diffs, none on this leaf)
  ---- volatile:mustrecharge
       in the comparator: no        declared in NOT_COMPARED: no
       b1  medi=1 sd=1   diffs=0
       CONTROL  PASS — no difference reported on this leaf
       RED      RED — the plant was INVISIBLE to the comparator (0 diffs, none on this leaf)
  ---- volatile:flashfire
       in the comparator: no        declared in NOT_COMPARED: no
       b1  medi=1 sd=1   diffs=0
       b2  medi=1 sd=1   diffs=0
       CONTROL  PASS — no difference reported on this leaf
       RED      RED — the plant was INVISIBLE to the comparator (0 diffs, none on this leaf)

  3 leaf(s) NOT COMPARED — a planted difference on them reached the board and nothing looked.
  learnset lookups that threw during the fixture search: 0
  FAIL — 3 arm(s) did not hold.
```

(The committed file, before the `flashfire` case was added, read `2 leaf(s) NOT COMPARED` and
`FAIL — 2 arm(s) did not hold.` with `compared keys today: 23`.)

### After (verbatim)

```
  compared keys today: 26 per-body volatiles

  ---- volatile:throatchop
       authority  pokemon-showdown/data/moves.ts:19391-19420 (condition, duration 2)
       ours       engine/medicham2-browser.js:33473 `_noSound`
       carrier    Beedrill
       in the comparator: YES        declared in NOT_COMPARED: no
       b0  medi=0 sd=undefined   diffs=0
       b1  medi=1 sd=1   diffs=0
       b2  medi=0 sd=undefined   diffs=0
       raw medi   beedrill{} clefable{} snorlax{_noSound=1} clefable{}
       raw sd     beedrill{} clefable{stall(d1)} snorlax{throatchop(d1)} clefable{stall(d1)}
       CONTROL  PASS — no difference reported on this leaf
       RED      PASS — caught p2.active[0].vol.throatchop medi=0 sd=1
  ---- volatile:mustrecharge
       authority  pokemon-showdown/data/conditions.ts:364-378 (duration 2)
       ours       engine/medicham2-browser.js:34724 `_recharge`
       carrier    Venusaur
       in the comparator: YES        declared in NOT_COMPARED: no
       b0  medi=0 sd=undefined   diffs=0
       b1  medi=1 sd=1   diffs=0
       raw medi   venusaur{_recharge=true} clefable{} snorlax{} clefable{}
       raw sd     venusaur{mustrecharge(d1)} clefable{stall(d1)} snorlax{} clefable{stall(d1)}
       CONTROL  PASS — no difference reported on this leaf
       RED      PASS — caught p1.active[0].vol.mustrecharge medi=0 sd=1
  ---- volatile:flashfire
       authority  pokemon-showdown/data/abilities.ts:1331-1368 (condition, NO duration)
       ours       engine/medicham2-browser.js:16158 `_vol.flashfire`
       carrier    Ninetales
       in the comparator: YES        declared in NOT_COMPARED: no
       b0  medi=0 sd=0   diffs=0
       b1  medi=1 sd=1   diffs=0
       b2  medi=1 sd=1   diffs=0
       raw medi   ninetales{flashfire=1} clefable{} typhlosionhisui{} clefable{}
       raw sd     ninetales{flashfire} clefable{stall(d1)} typhlosionhisui{} clefable{stall(d1)}
       CONTROL  PASS — no difference reported on this leaf
       RED      PASS — caught p1.active[0].vol.flashfire medi=0 sd=1
  ---- volatile:unburden
       authority  pokemon-showdown/data/abilities.ts:5227-5249 (no duration; onEnd removes it)
       ours       NO NAMED STATE — recomputed in effSpeed from `_hadItem && !m.item` (:14770)
       carrier    Sceptile
       in the comparator: no        declared in NOT_COMPARED: no
       b0  medi="[0,0]" sd="[0,0]"   diffs=0
       b1  medi="[1,1]" sd="[1,0]"   diffs=0
       b2  medi="[1,1]" sd="[1,0]"   diffs=0
       raw medi   sceptile{_hadItem=true} venusaur{_hadItem=true} venusaur{} beedrill{}
       raw sd     sceptile{unburden} venusaur{} venusaur{} beedrill{}
       OBSERVE ONLY — no wiring is asserted for this leaf. See the header.

  learnset lookups that threw during the fixture search: 0
  PASS — every arm held.
```

`learnset lookups that threw during the fixture search: 0` on both runs, so the carrier pool was the
whole format and a COULD-NOT-STAGE would have been a statement about the mechanic rather than about
the search. No arm reported one.

## A reporting defect found in the probe itself, and fixed

The committed probe's RED line printed `d.a` / `d.b`. `board_state.js`'s `walk` pushes
`{ path, medicham, showdown }` — there is no `a` or `b` — so the first green run read

```
       RED      PASS — caught p2.active[0].vol.throatchop undefined<>undefined
```

A receipt that proves nothing is the shape CLAUDE.md calls "a capability that cannot prove it ran".
Corrected in the same pass; the arms now print `medi=0 sd=1`, which is the actual planted difference.

## Unburden — NOT wired, and the reason is measured rather than argued

The observe arm stands and it is the reason the fifth-largest leaf in the hole is being left alone.
Two bodies lose an item to a Knock Off in the same turn; slot 0 carries Unburden and slot 1 does not:

```
       b1  medi="[1,1]" sd="[1,0]"
       raw medi   sceptile{_hadItem=true} venusaur{_hadItem=true}
       raw sd     sceptile{unburden} venusaur{}
```

medicham2 holds **no state under that name**. The doubling is recomputed inside `effSpeed` from
`_hadItem && !m.item` (`engine/medicham2-browser.js:14770`), which is true for **every body that lost
an item whatever its ability**, where the authority's volatile is added only by Unburden's own
`onAfterUseItem` / `onTakeItem` (`data/abilities.ts:5229-5234`). Wiring a presence comparison between
those two shapes would part **every board on which anybody's Focus Sash broke** — an instrument
defect wearing an engine finding's clothes.

**This is also an engine defect to file, and it is not the comparator's.** If `effSpeed` really does
gate only on `_hadItem && !m.item`, then in this engine every body that loses an item gets Unburden's
speed doubling. That is a decision-changing error on a leaf nothing compares, it is out of scope for
a comparator pass, and it belongs on the register rather than in this batch.

## Does the mechanism generalise?

**Partly, and the split is the useful part of this answer.**

*Generalises.* The comparator-side work is a two-line addition per leaf — one field in `mediBody`,
one in `sdBody` — and `SD_VOLATILE_KEYS` picks the key up automatically because it is derived from
`String(sdBody)`. Any leaf where **both engines hold state under a readable field** is this cheap.
Of the 19 that remain standing at a boundary, `probe_uncompared_leaves.js` marks three as already
present in medicham2's `_vol` table under the authority's own spelling — `lockon`, `minimize`,
`noretreat` — and those are the next cheapest by construction.

*Does not generalise.* The **fixture** is bespoke every time, and that is where the cost is. Each of
the three here needed its own script written against the authority's own refusals: Throat Chop needed
two turns to show the clock lapse; Must Recharge needed a **one-turn** script because `onLockMove`
replaces the whole request and both a scripted `protect` and a scripted `hyperbeam` fall through to a
`pass` that Showdown rejects outright; Flash Fire needed its carrier to attack the **foe's shielding
partner**, because a Protect on the carrier refuses the Fire move and there is then nothing to absorb,
and because an attack into the Fire user could knock it out before it throws.

And the classification itself does not generalise: `unburden` proves that a leaf can look wireable on
every derived column and still be unwireable, because one engine holds a **different quantity** under
the same name. Each remaining leaf needs its raw state printed on both engines before a line is
written — which is the rule `board_state.js` already states and this batch followed.

## The scoreboard, called in advance

| instrument | prediction | status |
|---|---|---|
| census `live` (the lab, `data/mechanics-census.json`) | **UNCHANGED at 829.** No simulator byte moved in this pass, so a movement here would be a bug in the pass, not a gain | measured: 829, unchanged (census NOT regenerated — see OWED) |
| `status.js` "board leaves compared" | **34 of 56 → 37 of 56** | measured, confirmed |
| `all-mechanics-fire` "mechanics with a board compared" (739 of 964) and "uncomparable leaves w/ a firing writer" (23 of 24) | should **rise** / the three leaves should **leave** the uncomparable set | deferred — `all_mechanics_fire.js` is banned in light mode and owned by another agent this session |
| pinned pool **board-material** divergence, release `8ad06030e129` (published: **77 of 961**) | should **RISE, or stay flat. It cannot fall.** These are common mechanics — 5,577 + 4,701 + 1,416 uses — so the pool is the right scoreboard and it should move. A fall would mean this pass took eyes away rather than adding them | deferred — see OWED |
| pinned pool **protocol first-divergence** (published: **168**) | **UNCHANGED.** This pass touches no narration | deferred |

Naming the two pool quantities separately is deliberate: **board-material and protocol
first-divergence are different numbers** and this report means board-material wherever it says the
count should rise.

## Checks run in this pass

Light mode was honoured: no `game_differential.js`, no `roster.js`, no `all_mechanics_fire.js`, no
`quarantine.js`, no `run-all.js`, no fit, no self-play, no census regeneration.

- `tests/probe_leaf_widening.js` — FAIL (3 arms) → PASS (every arm), verbatim above
- `tests/probe_uncompared_leaves.js` — 34 → 37 compared, 42 → 39 hole, 22 → 19 standing
- `tests/probe_volatile_leaves.js` — unchanged, 7 s
- `tests/staged_status_counters.js`, `tests/test-assert-mode.js`, `tests/test-volatile-duration.js` —
  all green on the live arm (`release THREW` on the staged-status rows is the aged-out-release
  stranding CLAUDE.md §12 describes and predates this pass)
- `engine/status.js` (via `tools/lownode.cmd`) — `mechanics` gate still PASS, coverage line moved

`engine/board_state.js` is **not** one of the 26 frozen release SOURCES — checked, not assumed:
`require('./engine/engine_release.js').SOURCES` contains `engine/board.js` and does not contain
`engine/board_state.js`. So a measurement opened against release `8ad06030e129` reads the **widened**
comparator, which is what makes the deferred command below meaningful.

## OWED

Not run here. Light mode forbids it and the published 77 must not move under an unmeasured change,
so the output goes to its own file and **never over `data/game-differential.json`**:

```
cmd /c tools\lownode.cmd engine\game_differential.js --release 8ad06030e129 --arm middle --end-state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --steering empirical --out data/verification/leaf-widening-batch1.json
```

Also owed:

- **`node tests/test-mechanics.js` to regenerate the census.** Deliberately not run: it rewrites
  `data/mechanics-census.json`, which steers `all_mechanics_fire.js` — and another agent owns that
  file this session. Rewriting the census under a live run is the photograph rule broken. The count
  quoted above (829 live) is the artifact as it stood, not a re-derivation.
- **`node engine/all_mechanics_fire.js`**, for the two lab figures in the scoreboard table.
- **`node engine/status.js --write`**, to restamp the `<!-- GENERATED -->` blocks.
- **A register row for the Unburden speed doubling** in `effSpeed` (`medicham2-browser.js:14770`)
  applying to every body that lost an item, regardless of ability. Filed here, not fixed.
- The remaining **19** standing-at-a-boundary leaves. Next cheapest by construction: `lockon`,
  `minimize`, `noretreat` — the three the derivation already finds in medicham2's `_vol` table under
  the authority's own spelling. Each still needs its raw state printed on both engines first.
