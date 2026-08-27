# Three small state reads — 2026-08-27, ENGINE (DIAGNOSIS ONLY, NOTHING APPLIED)

Brief: three board-material games from `data/game-differential.json`'s
`state.first_board_divergences`, grouped only because all three are small state reads.

**They are three separate defects with three separate roots.** No shared cause. One of them is the
instrument, two of them are the engine, and the engine ones are in different functions on different
paths.

All three were REPRODUCED on staged boards under the differential's own `middle` arm, with the exact
leaf path and the exact value shape the artifact reports. The probe is
`C:\Users\willj\Projects\Pokemon\ABRA\tests\probe_state_trio.js` (diagnostic, asserts nothing, exit 0).

```
A-arm t2   p2.active[0].vol.confusion    medicham 2      showdown 4      (artifact: 2 vs 5)
A-control  p2.active[0].vol.confusion    IDENTICAL — same mechanic, other door
B-arm      p2.party.diggersby.status     medicham "par"  showdown ""     (artifact: identical)
B-control  no `sec` draw either side     IDENTICAL
C-faint    p1.party.meowscarada.types    medicham "ice"  showdown "dark/grass"  (artifact: identical)
C-arm / C-uturn / C-control              IDENTICAL — the switch paths are clean
```

## A NOTE ON LINE NUMBERS, BECAUSE THE FILE IS MOVING UNDER THIS REPORT

`engine/medicham2-browser.js` was **modified twice while this diagnosis was being written** — it grew
about 18 KB between 15:07 and 15:38 and `git status` shows it dirty. Another agent holds the
simulator. Every site below is therefore cited by its **EXPRESSION** and the line numbers are a
snapshot taken at 15:38 that will be wrong shortly. The staged reproductions were run against the live
tree as it stood between roughly 15:20 and 15:30.

Snapshot, 15:38:

| site | line |
|---|---|
| `const CONFUSION_TURNS_MIN` | 15178 |
| `out.types=_row.t.slice(); MEDSEEN.typesRestoredOnSwitchOut` | 18620 |
| `function queueFaint` | 18871 |
| `if(m._ttmWrap){m._ttmWrap=null` | 18881 |
| `if(_secDraw()*100>=(_fmt!=null?_fmt:_generic)) continue;` | 29298 |
| `const _tt=...'trapsTarget'` / `const _rp=...'removesPP'` | 29657 / 29675 |
| `if(_ps&&_ps.p&&Array.isArray(_ps.oneOf)` | 29693 |
| `engine/game_differential.js` `if (n !== undefined && cat === 'any' && !MID_RANGE_LIVE)` | 1151 |

---

## A — CONFUSION COUNTER

### THE AUTHORITY IS COUNTING THE SAME THING WE ARE. THE UNITS ARE NOT THE PROBLEM.

`data/conditions.ts:174` (mainline; **the Champions mod does not override the `confusion` condition** —
`data/mods/champions/conditions.ts` overrides `par`, `slp` and `frz` only, and its `confusion:` entry
in `moves.ts:139` is the banned MOVE Confusion, not the volatile):

```
onStart(target, source, sourceEffect) {
  ...
  const min = sourceEffect?.id === 'axekick' ? 3 : 2;
  this.effectState.time = this.random(min, 6);       // conditions.ts:174
},
onBeforeMove(pokemon) {
  pokemon.volatiles['confusion'].time--;             // conditions.ts:180
  if (!pokemon.volatiles['confusion'].time) { pokemon.removeVolatile('confusion'); return; }
```

`time` is **attempts remaining plus one**: it is decremented at the TOP of each move attempt and the
volatile ends when it reaches 0, so `time = N` buys `N - 1` confused attempts. `random(2,6)` is
uniform over {2,3,4,5}.

medicham2 holds the identical quantity in the identical units —
`confusionBeforeMove` is `if(--m._vol.confusion<=0){delete ...; return false;}`, character for
character the authority's decrement-then-test. `board_state.js` reads `v.confusion.time` on one side
and `vol.confusion` on the other, so the leaf is comparing like with like.

**What differs is that medicham2 does not DRAW.** `applyConfusion` writes
`(t._vol=t._vol||{}).confusion = CONFUSION_TURNS_MIN` — a constant 2 — and counts it
(`MEDSEEN.confusionMinDuration`, 5 over this probe's run). That narrowing is declared at length in the
engine, and its stated justification is:

> *"Showdown's RANGE form of `random` is what the differential pins, and every arm in
> `engine/game_differential.js` pins it to the BOTTOM (`return m;`), so the authority always draws 2
> under measurement."*

**That premise is FALSE for the middle arm as of today.** ROADMAP #491 landed the range-form pin this
morning and narrowed it to one category:

```js
// engine/game_differential.js:1151
if (n !== undefined && cat === 'any' && !MID_RANGE_LIVE) { MID_RANGE_PINNED++; return m; }
```

`MIDW.cat` is `sec` for the whole of `BattleActions#secondaries`, and a secondary applies its
volatile through `this.moveHit(target, source, move, secondary, ...)` **inside that method**
(`sim/battle-actions.ts:1336-1351`). So a confusion arriving by a SECONDARY takes a live
`2 + floor(u * 4)` and a confusion arriving by a STATUS MOVE is pinned to 2.

### MEASURED, WITH THE KNOB VARIED

One Golurk (No Guard — so no accuracy roll can end an arm), the same target, the same board, the
same mechanic through two doors, and the secondary door clicked on four different turns:

```
A-arm    t1  showdown  1|sec|dynamicpunch|p20|0   1|sec|dynamicpunch|p20|1 <RANGE 2..5>   -> 2   AGREES
A-arm t2 t2  showdown  2|sec|dynamicpunch|p20|1 <RANGE 2..5>                              -> 4   PARTS
A-arm t3 t3  showdown  3|sec|dynamicpunch|p20|1 <RANGE 2..5>                              -> 4   PARTS
A-arm t4 t4  showdown  4|sec|dynamicpunch|p20|1 <RANGE 2..5>                              -> 4   PARTS
A-control    showdown  1|any|confuseray|p20|0   <RANGE 2..5>                              -> 2   AGREES
medicham2 in EVERY arm, secondary and status alike:                                          2
```

**Identical output across a varied knob is the finding, and here it is on OUR side.** The authority's
value moves with the address; medicham2's does not move at all, because it never asks. Turn 1 agreeing
by luck is why one staged turn was not enough to see this.

### AND THE PINNED-POOL GAME CANNOT BE ANYTHING ELSE

The four sheets of `2654113586 vs 2654066472` contain exactly **one** confusion source, derived rather
than eyeballed:

```
2654066472 p1 pelipper -> hurricane [SECONDARY 30%]
2654066472 p2 pelipper -> hurricane [SECONDARY 30%]
```

No Confuse Ray, no Swagger, no Flatter, no Sweet Kiss, no Teeter Dance anywhere in that game. The
authority's `random(2,6)` in that game was necessarily drawn under `MIDW.cat === 'sec'`, unpinned. Its
5 is a legal value of the live draw and is not reachable under the pin.

**Newly VISIBLE, not newly broken, and not a die that was fixed today.** The confusion constant has
been a constant since the confusion wire; before ROADMAP #491 the middle arm did not pin the range
form at ALL, so this leaf parted then too. #491 fixed the `any` half and left the `sec` half.

### BLAST RADIUS, DERIVED

Legal moves in the format whose SECONDARY starts a range-drawn duration — the whole population the
missing pin can reach:

```
Axe Kick -> confusion @30%   Dynamic Punch -> confusion @100%
Hurricane -> confusion @30%  Water Pulse -> confusion @20%
```

Four moves, all confusion. Nothing else in this regulation starts a `random(m,n)` duration from inside
`hitStepAccuracy`, `secondaries` or `getDamage`.

### A SECOND, SMALLER FINDING: THE INSTRUMENT'S OWN RECEIPT IS BLIND TO THIS

`range_form_pinned` / `range_form_live_draws` are published in every artifact *"because a fix that
silently stops firing looks exactly like one that works."* A `sec` range draw increments **neither** —
it falls straight past both counters into `midDraw`. This probe's run printed
`range form: pinned 2  live 0  knob false` on a run that took four live `sec` range draws. The counter
cannot see the case it exists to police.

### THE PATCH, NOT APPLIED

**`engine/game_differential.js`, function `makeArm`'s `pinRandom`, line 1151.** One predicate:

```js
-      if (n !== undefined && cat === 'any' && !MID_RANGE_LIVE) { MID_RANGE_PINNED++; return m; }
-      if (n !== undefined && cat === 'any') MID_RANGE_LIVE_DRAWS++;
+      if (n !== undefined && MIDW.cat !== 'dmg' && !MID_RANGE_LIVE) { MID_RANGE_PINNED++; return m; }
+      if (n !== undefined && MIDW.cat !== 'dmg') MID_RANGE_LIVE_DRAWS++;
```

This is the arm's own rule applied where it was missed, and it is what #491's own comment already
says the predicate MEANS: *"The range form outside the damage machinery is a tie or a duration the
other engine does not draw."* `acc` and `sec` are not the damage machinery. `dmg` is left alone
because line 1147 deliberately re-labels a two-argument random under `dmg` as `crit`, and that
mapping is a separate claim I did not test.

Two things this patch owes before it is trusted:
- **Print what the widened predicate matches before wiring it.** The four moves above are the derived
  population, but the count of pinned draws per run must be printed and compared — a pin that starts
  swallowing an `acc` draw would look exactly like this fix working.
- **The pin makes both engines read the MINIMUM, so it is only correct while medicham2's constant IS
  the minimum.** It is for confusion (`CONFUSION_TURNS_MIN = 2` = `random(2,6)`'s bottom). The partial
  trap's `turns:(_tn?+_tn[0]:4)` is a different constant against `conditions.ts:227`'s `random(5,7)`
  and was NOT checked here.

**WHAT THIS PATCH DOES NOT FIX, STATED.** medicham2 still gives every confusion the minimum duration.
Against real dice confusion lasts 3.5 attempts and this engine gives it the floor, so a search under-values
landing one. That is a declared, counted narrowing (`MEDSEEN.confusionMinDuration`) and it belongs to
the lab — the roster and the census — not to the pinned pool, whose gate this patch is about.

---

## B — STATUS APPLIED

### THE AUTHORITY DID NOT REFUSE IT. NOTHING COULD HAVE.

Derived, printed by the probe before the run:

```
B fixture — how many things could refuse `par` on Diggersby (Normal/Ground, ability Huge Power): NONE
[no Safeguard, no Misty Terrain, no prior status in the script]
```

Diggersby is Normal/Ground (not Electric), its declared ability in that game is Huge Power (no
`onSetStatus`, no `onImmunity`, no `onTryAddVolatile`), the game's field carries no Safeguard and no
Misty Terrain, and both engines agree it had no prior status. **The cell qualifies for exactly zero
refusal reasons, so it cannot be green for the wrong one.**

### CHAMPIONS OVERRIDES DIRE CLAW, AND WE READ THAT RIGHT

`data/mods/champions/moves.ts` (NOT `data/moves.ts`, which says 50):

```
direclaw: { inherit: true, flags: { contact:1, protect:1, mirror:1, metronome:1, slicing:1 },
  secondary: { chance: 30, onHit(target, source) {
      const status = this.sample(['psn', 'par', 'slp']);
      if (target.status) { ... return; }
      target.trySetStatus(status, source); } }, ... }
```

`data/tags.json` carries `proceduralStatus {p: 0.3, oneOf:[psn,par,slp]}`. **The chance is correct and
is not the defect.**

### THE DEFECT IS A DRAW COUNT. medicham2 SPENDS THREE `sec` DRAWS WHERE THE AUTHORITY SPENDS ONE.

Staged, one turn, Sneasler (Unburden, the pool's own set) clicking Dire Claw at Diggersby:

```
showdown  1|acc|direclaw|p20|0  1|crit|direclaw|p20|0  1|dmg|direclaw|p20|0  1|sec|direclaw|p20|0
medicham  1|acc|direclaw|p20|0  1|dmg|direclaw|p20|0   1|crit|direclaw|p20|0
          1|sec|direclaw|p20|0  1|sec|direclaw|p20|1   1|sec|direclaw|p20|2

sec draws:  showdown 1   medicham 3
BOARD PARTED at turn 1
    p2.party.diggersby.status   medicham "par"   showdown ""
    p2.active[0].status         medicham "par"   showdown ""
```

The authority takes ONE draw (`secondaryRoll = this.battle.random(100)`, `battle-actions.ts:1343`),
fails the 30%, and stops. medicham2 takes THREE. Control arm: Earthquake on the same two bodies takes
zero `sec` draws on both sides, so the counts above are Dire Claw's and not a standing offset.

**Why three.** `data/move-effects.js` records Dire Claw's secondary as `{ "chance": 30 }` — the
authority's row with its `onHit` stripped, because a rulebook cannot express a handler. So:

1. the generic secondary loop (`if(_secDraw()*100>=(_fmt!=null?_fmt:_generic)) continue;`) rolls the 30% for that inert row,
   applies nothing whatever the outcome, and **has spent `nth 0`**;
2. the `proceduralStatus` tag block (`... && _secDraw() < +_ps.p`) rolls the SAME 30% again —
   now at `nth 1`;
3. it passes, so the three-way pick takes `nth 2`.

The engine's own comment at the `proceduralStatus` block asserts *"Same two draws, same order, same
names."* It is two draws in the authority and **three** here, and the first one is invisible from the
tag block that believes it is taking `nth 0`.

**IT IS AN ADDRESS DEFECT, NOT A RATE DEFECT, AND THAT IS WHY NOTHING ELSE CAN SEE IT.** The generic
loop does not short-circuit, so the status is decided by the second draw alone and the marginal rate
is still 30%. What is wrong is WHICH VALUE: medicham2's 30% roll reads the number the authority spends
on `this.sample`, and the authority's chance value is spent on nothing. Two independent coins on a 30%
event disagree `2 × 0.3 × 0.7 = 42%` of the time — the same fingerprint as the Protect/stall die of
ROADMAP #220. A rate check, a census probe and a seeded harness all pass.

### CORROBORATED ON THE POOL'S OWN TEAMS

`--replay` plays the artifact's two teams as one isolated pair. It does not reproduce the driver's
exact game (the driver carries state between games; see OWED), but two of its eight combinations part
at **turn 6** on the **same leaf**, both times behind a Dire Claw:

```
2662482898/p2 vs 2662443716/p2 [stones]    turn 6  p2.party.mrrime.status ["par" vs ""]
2662482898/p2 vs 2662443716/p2 [nostones]  turn 6  p2.party.lycanrocmidnight.status ["par" vs ""]
```

Neither victim can refuse paralysis either (Mr. Rime is Ice/Psychic with Screen Cleaner;
Lycanroc-Midnight is Rock with No Guard).

### THE POPULATION, PRINTED BEFORE ANY WIRING

Every legal move whose rulebook secondary row is inert (no status, no volatile, no boosts, no flinch)
and therefore spends a `sec` draw for nothing:

```
throatchop       chance 100  tags=-                 uses 5285
direclaw         chance 30   tags=proceduralStatus  uses 5118   <-- BREAKS
alluringvoice    chance 100  tags=-                 uses 248
stoneaxe         chance 100  tags=-                 uses 156
burningjealousy  chance 100  tags=-                 uses 92
ceaselessedge    chance 100  tags=-                 uses 77
triattack        chance 20   tags=proceduralStatus  uses 7      <-- BREAKS
eeriespell       chance 100  tags=removesPP         uses 5
spiritshackle    chance 100  tags=trapsTarget       uses 3
```

Only the two with a sub-100 chance AND a second drawing consumer break: **Dire Claw (5,118 uses) and
Tri Attack (7)**. The seven 100% rows spend exactly one draw each, which is exactly what the authority
spends, so they line up by accident and must keep lining up after any fix.

### THE PATCH, NOT APPLIED

**`engine/medicham2-browser.js`, the secondaries step. One authority secondary row = one chance draw.**

The honest shape is to fold `proceduralStatus` into the generic loop as that row's `onHit`, mirroring
`secondaries()` → `moveHit` → `onHit` exactly. The minimal version that lands the same board:

- at the generic loop (`if(_secDraw()*100>=...) continue;`), record the outcome of the roll for an
  inert row on the row itself,
  e.g. `s._fired = true/false`, instead of discarding it;
- at the `proceduralStatus` block (`_ps&&_ps.p&&...`), **delete the `_secDraw() < +_ps.p`** and gate on the
  recorded outcome of the matching inert row. The pick's `_R.sec()` then lands on `nth 1`, which is
  where the authority's `this.sample` lands.

Do the same for the `trapsTarget` and `removesPP` blocks directly above it so all three tag blocks read one
rule; they take no draw today, so a 100% row still always fires and nothing about them moves.

Two things the fix must check rather than assume:
- **the seven 100% rows must still take exactly one `sec` draw.** Skipping the inert row's draw
  outright would shift them the other way and is the over-fire failure here.
- **`_secFired(tg)` moves `MID_TGT`.** Today the generic loop can fire on an inert row and move the
  address for the block below; after the fix only one fire may happen per row. On a single-target move
  this is invisible (both addresses are the same slot) — it is a spread that would show it, and no
  spread move carries `proceduralStatus`, so this is a note rather than a hazard.

---

## C — TYPES

### THE BRIEF'S LEADING HYPOTHESIS IS REFUTED. THE SWITCH PATHS ARE CLEAN.

The brief asked whether the effect "should have reverted on switch-out or at end of turn". It reverts
on switch-out already, and I staged three separate exits to prove it rather than reading the code and
stopping:

```
C-arm      Protean, Triple Axel, then a VOLUNTARY SWITCH   boards IDENTICAL at every boundary
C-uturn    Protean, U-turn (a SELF-SWITCH pivot)           boards IDENTICAL at every boundary
C-control  Protean, body STAYS IN (both hold pure Ice)     boards IDENTICAL at every boundary
```

Inside `switchOut`, and it is general rather than Protean-specific:

```js
{const _row=monRow(out.name);
 if(_row&&Array.isArray(_row.t)&&out.types&&out.types.join('/')!==_row.t.join('/')){
   out.types=_row.t.slice(); MEDSEEN.typesRestoredOnSwitchOut++;
 }}
```

The C-control arm is what makes the other two mean anything: it proves Protean really fires and really
leaves the body pure Ice, so "identical" in the switch arms is a restore and not a conversion that
never happened. `MEDSEEN.proteanConverted = 4` over the file.

### THE REAL PATH IS THE FAINT, AND IT DOES NOT GO THROUGH `switchOut`

The first version of this arm shielded Meowscarada on the turns the Earthquake came, the attack never
reached it, and the arm reported IDENTICAL having staged nothing. With the body actually exposed
(Knock Off — Dark, and Protean is once per switch-in, so the body stays Ice while it stands):

```
C-faint   |-start|p1a: Meowscarada|typechange|Ice|[from] ability: protean
          |faint|p1a: Meowscarada
          BOARD PARTED at turn 3
              p1.party.meowscarada.types   medicham "ice"   showdown "dark/grass"
```

The artifact's leaf, its values, its shape.

### THE AUTHORITY'S RULE, CITED

`sim/battle.ts:2560`, inside `faintMessages()` draining the faint queue:

```
pokemon.clearVolatile(false);
pokemon.fainted = true;
```

`sim/pokemon.ts:1514` `clearVolatile(includeSwitchFlags = true)` ends at **`sim/pokemon.ts:1565`**:

```
this.setSpecies(this.baseSpecies);
```

and `setSpecies` is `this.setType(species.types, true)`. **A corpse wears its base types**, and it does
so through the SAME call that reverts them on a switch — which is why medicham2 gets one path right
and the other wrong: the type restore lives in `switchOut`, and a faint never goes there.

It is protocol-silent on both sides (`clearVolatile` calls `setSpecies` directly; only `formeChange`
reaches `this.battle.add('-formechange', ...)`), which is exactly why this game shows
`protocol_diverged_at_turn: null` with a parted board.

The artifact's row also carries `p1.active[0].types`, which my arm did not reproduce because the
replacement had already arrived by the boundary. That is consistent, not contradictory: a fainted body
stays in `side.active[i]` until it is replaced, and the artifact's game parted at **turn 12 — the
differential's cap** — so the corpse was still in the slot when the last board was taken.

### THE PATCH, NOT APPLIED

**`engine/medicham2-browser.js`, function `queueFaint`, immediately after `noteFaint(m)` and beside
the existing `_ttmWrap` clear.** That line is already there for this reason and cites this authority:

```js
  /* 2026-08-26 -- THE TWO-TURN CLOCK DIES WITH THE BODY. `faintMessages()` calls
   * `pokemon.clearVolatile(false)` (sim/battle.ts), so a corpse holds no `twoturnmove` ... */
  if(m._ttmWrap){m._ttmWrap=null;MEDSEEN.chargeWrapClearedOnFaint++;}
+ /* AND THE TYPE LIST DIES WITH IT, on the same line's authority: `clearVolatile` ends
+  * `setSpecies(this.baseSpecies)` (sim/pokemon.ts:1565), which is `setType(species.types, true)`. */
+ {const _row=monRow(m.name);
+  if(_row&&Array.isArray(_row.t)&&m.types&&m.types.join('/')!==_row.t.join('/')){
+    m.types=_row.t.slice(); MEDSEEN.typesRestoredOnFaint++; }}
```

`queueFaint` is the one state transition all 27 faint sites share, so one line covers every road in.

Why `monRow(m.name)` and not a stashed base, which is the same argument the `switchOut` block already
makes: it reads the body's CURRENT name, so a mega that faints reads its mega row and nothing changes —
matching the authority, where a mega rewrote `baseSpecies` and `clearVolatile` therefore does not
revert it. Ordering is load-bearing and is already correct: `noteFaint` → `faintHousekeeping` →
`imposterRevert` runs first, so a transformed body is back on its own name before the type read.

**TWO NEIGHBOURS THIS DOES NOT FIX, AND THEY ARE ON THE SAME LINE OF THE SAME AUTHORITY FUNCTION.**
`clearVolatile` also does `this.ability = this.baseAbility` and `setSpecies` reverts a non-permanent
forme. `switchOut` handles both (`abRestoreOnLeave`, the `_formeTempBase` block); `queueFaint` handles
neither. **There is no failing probe on either, so they are named here and not claimed** — a corpse
wearing a Traced ability and a corpse under a Hunger Switch forme are both compared by `benchRow` and
both would be found by a probe of exactly this shape.

---

## OWED, NOT RUN

- **The exact pool games were NOT replayed.** `--replay` reconstructs each pair from
  `data/team-pool-frozen` and plays it alone; the driver carries state across games
  (`driverSnap`/`driverRestore`, the census steering that decides what gets clicked), so an isolated
  pair does not reproduce the driver's trajectory. Eight of the twenty-four combinations B reproduced
  anyway; A and C did not, and both were reproduced on staged boards instead. **A driver-faithful
  replay needs a `--only-pair` entry point in `game_differential.js` that I did not build and could
  not run.**
- **No heavy run.** No `game_differential.js` driver run, no roster stage, no `all_mechanics_fire.js`,
  no `quarantine.js`, no `status.js` — per the brief. So **no before/after board-material figure is
  claimed here**, and none of the three patches has been applied or measured.
- **A's widened predicate was not swept.** The four confusion moves are the derived population, but
  the count of range draws the widened pin would newly swallow per run was not measured, and the
  partial trap's constant (`_tn[0]` against `conditions.ts:227`'s `random(5,7)`) was not checked
  against the pin's bottom.
- **`MIDW.cat === 'dmg'` two-argument randoms were not investigated.** Line 1147 re-labels them
  `crit`; whether any such draw exists in the pinned checkout is unverified, which is why the proposed
  predicate excludes `dmg` rather than pinning everything.
- **B's `_secFired` address movement on a spread was not staged.** No `proceduralStatus` move is a
  spread today, so the case is unreachable; it is a note, not a measurement.
- **C's faint-path ability restore and forme revert were not probed.** Named above, unclaimed.
- **`data/_pair-pilot.json` and `data/medicham-represented-clicks.json` are untracked in the tree and
  are not mine.** Reported, left alone.
- **ONE SIDE EFFECT I CAUSED, DECLARED.** `tests/_live_release.js` calls `cut()` at require time, so
  the probe runs appended cut EVENTS and `data/engine-release.json` now reads `cuts: 32` against
  HEAD's 26, with `latest_cut`/`pointer_written` moved. `current` is UNCHANGED (`9dc79a4d459b`) —
  a re-cut over an identical tree appends by design. Every probe in `tests/` that uses
  `_live_release.js` does the same; naming it because I was told to write to two files and this is
  a third that moved.
- **NOT COMMITTED.** Four other agents are live and the tree carries their work
  (`engine/medicham2-browser.js` and nine `data/` files are dirty and not mine). The two files this
  session wrote are new and unstaged; publishing is the coordinator's.

## FILES

- `C:\Users\willj\Projects\Pokemon\ABRA\tests\probe_state_trio.js` — new, diagnostic only.
  `node tests/probe_state_trio.js` runs eleven staged arms in seconds; `--trace` dumps the medicham
  stream per arm; `--replay` plays the three pool pairs.
- Nothing else was written. `engine/medicham2-browser.js` and `engine/game_differential.js` are
  UNCHANGED.
