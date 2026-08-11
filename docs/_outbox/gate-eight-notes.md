# gate-eight — the eight rows that held the MEDICHAM gate, and the two things that were not on the list

**2026-08-11. ENGINE.** Every figure here was measured in this session against release
`82250b3c3139`, which reads **0 of 24 files moved** from the tree it was cut from.

---

## THE VERDICT

`node engine/quarantine.js` → **GATE: OPEN — all six clauses pass.** First time.

Census **423 → 437 live / 437 probed / 0 missing / 0 threw / 0 hollow / 0 unarmed / 0 direct-call.**

---

## FOUR OF THE EIGHT WERE ALREADY FIXED AND STILL OPEN IN THE REGISTER

#117, #118, #119 and #126 were landed by the previous batch and never marked done. The gate reads the
register, so it went on counting them — a stale handoff one level up, with the same shape as the
fourteen `HANDOFF-*.md` files CLAUDE.md opens by retiring.

**Nothing was closed on trust.** Each was re-measured first:

| row | measured 2026-08-11 |
|---|---|
| #117 | swept all 500 moves through a real turn across all 37 action kinds — 0 fail to record `_lastMove` |
| #118 | `taunt`, `tailwind`, `trickroom`, `swordsdance`, `protect`, `recover`, `wideguard`, `quickguard`, `transform` all arm the lock; `choiceLockArmedOnStatus` = 9 |
| #119 | empty PP bar → Struggle for 50, 64 max-HP recoil, real `\|move\|p1a: garchomp\|struggle\|` line. Scarf lock onto a **Disabled** move at FULL PP → Struggle, `struggleFromDisabled` non-zero |
| #126 | Quick Guard: Quick Attack 38 → 0, Fake Out 38 → 0, Earthquake 55 → 55. Wide Guard is the mirror. **The arms cross**, which no name-match produces |

---

## #147 — THE GROUNDED AXIS. THE PREDICATE WAS NOT THE EXPENSIVE HALF.

RED first, with a two-sided control (a grounded body takes 167, a Flying one takes 0):

```
SMACK DOWN then earthquake      0   vol={}                 grounded=false
GRAVITY    then earthquake      0   field.gravity=undefined grounded=false
MAGNET RISE then earthquake   167   vol={"magnetrise":1}   grounded=true    <- should be 0
INGRAIN    then earthquake      0   vol={"ingrain":1}      grounded=false   <- should hit
ROOST      + earthquake         0   types ["Flying","Steel"]
```

GREEN after:

```
SMACK DOWN then earthquake    139   vol={"smackdown":1}    grounded=true
GRAVITY    then earthquake    148   field.gravity=3        grounded=true
MAGNET RISE then earthquake     0   vol={"magnetrise":1}   grounded=false
INGRAIN    then earthquake    138   vol={"ingrain":1}      grounded=true
ROOST      + earthquake       hits; types Fire/Flying again after the turn
```

**The middle step is the finding.** Wiring all five inputs into `isGrounded()` moved **nothing** —
Gravity read `field.gravity=3`, `grounded=true`, and Earthquake still dealt **0**. The Ground immunity
was being read off the type chart:

```
sim/pokemon.ts:2254
  const notImmune = type === 'Ground' ? this.isGrounded(negateImmunity)
                                      : negateImmunity || getImmunity(type, this);
```

Ground is the ONE type whose immunity does not come off the chart. `getEffectiveness` scores the Flying
row as **zero steps**, so a grounded Talonflame takes Earthquake at 2x off its Fire half.

**Consequence nobody had filed: Iron Ball on a Flying body was already wrong**, with no Gravity
anywhere. 113 uses.

Three sub-defects fell out that the row did not name:

1. **Gravity was routed down the Encore road.** It carries `sealsMoves` (it disables Fly, Bounce, High
   Jump Kick through `onDisableMove`) and that branch sat first in the classifier. The fix is the
   ORDER, and it is stated at the line rather than being an accident of where it was pasted.
2. **A damaging move's PRIMARY volatile reached no applier.** The secondary loop was the only road, so
   Smack Down landed 50 damage and left the target flying. Population printed before wiring: **8**
   damaging moves, of which 7 are the partial-trap family that `_trap` already owns — so
   `partiallytrapped` is refused inside `applyMoveVolatile` beside `substitute` and `confusion`, at the
   OWNER, and the new block stays a generic artifact read.
3. **`isGrounded` had to take the ATTACKER.** Without it a Mold Breaker's Earthquake into a Levitate
   body was priced 0 again — **the census caught it inside a minute, 423 → 421**, on the
   `ignoresDefenderAbility` row.

**Roost is a TYPE DELETION, not a clause in `isGrounded`.** That is how the authority grounds it, and it
makes Earthquake, Stealth Rock and the Ground immunity agree for free; a `roost` clause would have
grounded the body and left it still resisting Ground — two different answers to the same question. The
`-singleturn` sits BELOW the `-heal`, read off a real battle:

```
|move|p1a: Talonflame|Roost|p1a: Talonflame
|-heal|p1a: Talonflame|115/153
|-singleturn|p1a: Talonflame|move: Roost
```

---

## #123 — TWO LISTS, AND THE ROW WAS WRONG AS WRITTEN

The row said Earthquake *"MISSES a digging target"*. It hits for **double**, and the engine dealt 0 —
the counter-play was impossible rather than free. The row is corrected in place.

| state | PIERCE | of those, DOUBLE | via |
|---|---|---|---|
| Dig | earthquake, magnitude | both | damage |
| Dive | surf, whirlpool | both | damage |
| Fly | gust, twister, skyuppercut, thunder, hurricane, smackdown, thousandarrows | **only** gust, twister | damage |
| Bounce | the same seven | **only** gust, twister | **basePower** |
| Phantom Force | none (`onInvulnerability: false`) | — | — |

Measured (charger SLOWER, and handed its charge move again on turn 2 — see below):

```
charge         move        control  charging  ratio
dig            earthquake     23       46      2.00
dig            ironhead       51        0      0.00
dive           surf           29       57      1.97
fly            hurricane      94       94      1.00
fly            smackdown      16       16      1.00
bounce         ironhead       51        0      0.00
phantomforce   earthquake     23        0      0.00
invulnPierced 6   invulnDoubled 4
```

**`invulnPierced` and `invulnDoubled` are counted apart on purpose. Equal counts over a varied sample
would BE the wrong rule.**

**THE PROBE WAS WRONG TWICE BEFORE THE ENGINE WAS**, and both are staging, not logic:

- the charger must be **slower**, or it releases its move and drops `_invuln` before the attack lands;
- the charger must be handed its charge move **again** on turn 2 — the engine cancels a charge for any
  body given a non-attack action, so a `{kind:'pass'}` there silently un-digs it. With that wrong,
  **every row read ratio 1.00 with the wiring fully in place**, which is exactly the "identical results
  across a varied knob" signature, pointing at the probe rather than the engine.

---

## #125 — THE COUNTER FIRST, AND THE LIST WILL IS OWED

`MEDFAILS.unmodelledClick`, `unmodelledClickFirst`, `unmodelledClickBy` (a per-move **histogram**, not a
tally). A bare `{kind:'pass'}` a caller built carries no `mv` and is not counted — counting it read 21
on a sweep with no target supplied, all of them damaging moves degrading, none a defect.

```
    89  transform          12  speedswap        0  guardsplit
    72  entrainment         8  spite            0  healbell
    69  worryseed           3  recycle          0  lockon
    35  roleplay            1  fairylock        0  powersplit
    17  simplebeam          1  magneticflux     0  teatime
   307  TOTAL over 15 moves
```

**15 moves, 307 clicks — not the 32 / 1,702 the row was filed with.** `tests/test-unmodelled-clicks.js`
prints it, writes `data/unmodelled-clicks.json`, and **ratchets the SET**: it may shrink and may never
grow.

---

## #128 — THE BERRY-ABILITY FAMILY

`lastItem` and `ateBerry` appeared **zero times** in the simulator. The close is a **single consumption
site**: `m.item=''` appears twelve times in that file and only the three that are a berry being EATEN
route through `consumeBerry`. A berry Knocked Off or Tricked away is not one you ate — which is exactly
the distinction Harvest and Cheek Pouch turn on. Unblocks Recycle (#71).

A 170 HP body started at 76, everything else blank (the row's own hazard: a berry at half heals 25%,
identical to Life Dew / Hospitality / Aqua Ring):

```
control  none            118  ->  118  ->  118
cheekpouch              170                        +1/3 of max, on top
ripen                   160                        +84, exactly double
cudchew                 118  ->  160  ->  160      the second helping, a turn later
cudchew  NO item         76  ->   76  ->   76      the control that fixes the baseline
harvest  rain, losing roll   item ""
harvest  rain, winning roll  item "sitrusberry"
harvest  SUN, SAME losing roll  item "sitrusberry"   <- the sky overrides the die
control  SUN, no ability      item ""
pickup   the ally ends the turn holding "sitrusberry"
```

**Cud Chew took two passes and the first one is the lesson.** It put the berry back and let the pinch
updater find it — which re-runs the **trigger**. A body healed above half by its own first Sitrus then
chewed a berry that did nothing, and `cudChewReEaten` still said the mechanic fired. The authority calls
`singleEvent('Eat')` directly: the **effect**, not the trigger. Before that split it also chewed
forever (43 → 85 → 85 → 127), because the re-eat runs through `consumeBerry` and `consumeBerry` re-arms
the counter — the authority closes it the same way, with its `delete effectState.berry` BELOW the
`runEvent('EatItem')`.

**GLUTTONY IS A MEASURED NULL.** Its number lives on the BERRY, not on the ability (`healsAtThreshold
.triggersBelowWithAbility`, derived from each berry's own `onUpdate`), and **no berry in this format
carries it**: the only two pinch berries above the usage floor are Sitrus and Oran and both already
trigger at 1/2. `MEDSEEN.gluttonyRaisedThreshold` = 0 **by regulation, not by breakage**. Its probe
therefore asserts the reading is HARMLESS — a Gluttony holder eats at exactly the same point as a plain
one — rather than asserting a change that cannot happen.

---

## THE TWO THINGS THAT WERE NOT ON THE LIST

**1. The gate clause was the last thing in the way.** With all eight rows closed it still counted five:
it scanned the first 600 characters of PROSE, case-sensitively, for `closed 20\d\d`. Four rows headed
`— CLOSED 2026-08-11` in capitals went on counting, and **#148 counted itself**, because it quotes the
breakage vocabulary while explaining the detector. #148's own text predicted this: *"a defect register
whose enforcement depends on word choice is a structural weakness"*.

The clause reads the row's **status cell** now. Printed before wiring, over all 119 rows: it newly
clears **16**, every one stamped `closed 20xx-xx-xx`, `DONE 2026-08-10` or `page closed 2026-08-10` in
that cell; it clears nothing reading `open — …`, `in progress`, `scoping` or prose; **`PART DONE` is
refused**. Shown RED on a planted row carrying a number no register holds before it was
trusted, and the prose scan is kept beside it rather than replaced.

**2. The report contradicted itself the moment the gate opened.** `GATE: OPEN — nothing is withheld`,
then four lines down `47 of 179 artifacts … are WITHHELD`. Nobody had ever read this page in that state.
Open, those 47 are **re-runnable and stale** — measured under an engine that has since changed — and the
heading now says so and points at ROADMAP #57.

---

## WHAT I DID NOT DO

- No fit, no self-play, no rollout. Single-process throughout.
- `engine/board.js`, `engine/magnemite.js`, `engine/engine-data.js` untouched.
- `engine/all_mechanics_fire.js`, `engine/faces.js`, `engine/million_targets.js` untouched — another
  division holds them.
- `data/policy-weights.json` and everything downstream: untouched, and now **re-runnable rather than
  released**. ROADMAP #57 is the list.
