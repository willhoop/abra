# The `[fatigue]` tag, and a scout of the mechanics clause — 2026-08-27

DIAGNOSIS ONLY. Nothing under `engine/` was edited. No heavy run was launched: `game_differential.js`
was used only as the two-engine staging driver for one three-turn scripted board, and
`quarantine.js`, `all_mechanics_fire.js`, the roster stages and `status.js` were **not** run. Every
artifact figure below is read from `git show HEAD:` so nothing torn could be quoted.

Files touched by this pass: this report, and `tests/probe_fatigue_tag.js` (new, uncommitted).

---

## PART ONE — THE FATIGUE TAG

### 1. WHEN THE AUTHORITY ADDS `[fatigue]`, CITED

`data/conditions.ts:161-173`, the whole `confusion.onStart` block:

```
onStart(target, source, sourceEffect) {
  if (sourceEffect?.id === 'lockedmove') {
    this.add('-start', target, 'confusion', '[fatigue]');        // :167
  } else if (sourceEffect?.effectType === 'Ability') {
    this.add('-start', target, 'confusion', '[from] ability: ' + sourceEffect.name, `[of] ${source}`);
  } else {
    this.add('-start', target, 'confusion');
  }
  const min = sourceEffect?.id === 'axekick' ? 3 : 2;
  this.effectState.time = this.random(min, 6);
}
```

Three branches, one tag. `[fatigue]` is written **only** when the source effect is the `lockedmove`
condition itself.

**Champions does not override either condition.** `data/mods/champions/conditions.ts` is **57 lines**
and contains exactly three keys — `par`, `slp`, `frz`. Read in full, not sampled. So mainline is what
this format plays for both `confusion` and `lockedmove`.

**How the source effect gets there, since `lockedmove.onEnd` passes no arguments.**
`data/conditions.ts:277-280`:

```
onEnd(target) {
  if (this.effectState.trueDuration > 1) return;
  target.addVolatile('confusion');
}
```

and `sim/pokemon.ts:1983-1985` fills the blanks from the running event:

```
if (this.battle.event) {
  if (!source) source = this.battle.event.source;
  if (!sourceEffect) sourceEffect = this.battle.effect;
}
if (!source) source = this;
```

Inside the lock's own `End` singleEvent `battle.effect` **is** the `lockedmove` condition, so branch
one is taken. `source` stays null and then defaults to the target itself — which is also why
**Safeguard cannot refuse this confusion** (`data/moves.ts` safeguard `onTryAddVolatile` ends
`&& target !== source`). This engine already gets that right by accident of shape:
`sideBuffRefuses(t, src, …)` returns null on a null `src`, and the fatigue call site passes null.

### 2. CAN WE TELL THE TWO APART? YES — AND THE BRIEF'S PREMISE IS HALF WRONG

The information is **not** lost. `engine/medicham2-browser.js:32675` is the single fatigue site and it
is already gated on the lock's own `confuse` flag:

```
if(_lc.confuse){ MEDSEEN.lockExpiredConfused++; applyConfusion(x,null,field,false); }
```

`applyConfusion` has four other call sites (`:15960` generic volatile, `:29558` secondary,
`:29722` punish) and none of them is a lock. So the emit half is one parameter.

**BUT THE PROBE FOUND A SECOND DEFECT ON THE SAME LINE, AND IT IS NOT A FIELD.** The line is written
at the wrong **position** in the turn:

```
turn 2  authority  [ 6 of 13]  |-start|p1a|confusion|[fatigue]     <- immediately after the Outrage's -damage
turn 2  ours       [11 of 13]  |-start|p1a|confusion               <- at the foot of the turn, after every other body acted
```

**The authority fatigues inside the move, not at the residual.** `lockedmove.onAfterMove` is
`if (this.effectState.duration === 1) pokemon.removeVolatile('lockedmove')`, and `removeVolatile`
runs `onEnd`, which is the confusion. Traced over a two-turn run: `onStart` sets `trueDuration = 2`
and `duration = 2`; turn 1's residual decrements `duration` to 1 and `onResidual` decrements
`trueDuration` to 1; on turn 2 `onRestart` declines to re-arm (`trueDuration >= 2` is false), so
`onAfterMove` sees `duration === 1`, removes the volatile and confuses — **at move time**.

The residual road is still reachable and is still correct: if the body was **prevented from moving**
on its last locked turn (flinch, full paralysis), `onAfterMove` never runs, `residualEvent`
decrements `duration` to 0 and calls `handler.end` — the fatigue then lands at the residual, which is
exactly where this engine puts it today. So `engine/medicham2-browser.js`'s WIRE 144 comment at
:32645-32667 ("`lockedmove.onEnd` … i.e. fatigue ONLY when the lock ran its full length") is right
about the *condition* and wrong about the *position*: it models only the branch where the body did
not move. That comment must be corrected in the same pass.

**UPROAR MUST NOT MOVE, AND A NAME-BLIND FIX WOULD MOVE IT.** `data/moves.ts` uproar.condition has
`duration: 3`, an `onResidual`, an `onEnd` that writes `|-end|…|Uproar` — and **no `onAfterMove` and
no `onRestart`**. Its expiry genuinely is the residual. The discriminator is therefore the
condition's own `onAfterMove`, and it was **printed over the format before being proposed**:

```
move            volatile        onAfterMove onLockMove onRestart
blastburn       mustrecharge    false       true       false
frenzyplant     mustrecharge    false       true       false
gigaimpact      mustrecharge    false       true       false
hydrocannon     mustrecharge    false       true       false
hyperbeam       mustrecharge    false       true       false
outrage         lockedmove      TRUE        true       true
petaldance      lockedmove      TRUE        true       true
ragingfury      lockedmove      TRUE        true       true
rockwrecker     mustrecharge    false       true       false
roost           roost           false       false      false
thrash          lockedmove      TRUE        true       true
uproar          uproar          false       true       false
```

Exactly the four. No over-match — the six `mustrecharge` moves and Uproar, which is what
`onLockMove` alone would have caught, are all excluded.

### 3. THE PROBE

`tests/probe_fatigue_tag.js` — new, **RED, 3 failing clauses**, exit 1:

```
SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_fatigue_tag.js
```

- Two arms, one knob: the **same** Goodra with the **same** ability clicks Outrage (arm) or Dragon
  Claw (control). The authority's own state moves across the knob — confusion volatile `1` on the
  arm, `null` on the control — asserted before anything else is read, so an unwired fixture reports
  itself.
- **The cell qualifies for exactly ONE reason, derived from the format and printed**:
  `confusion sources in this cast, DERIVED from the format: 1  [move:outrage (via lockedmove.onEnd)]`.
  Every cast move and ability is asked whether it can inflict confusion, directly or through a
  self-volatile's `onEnd`; the file refuses to run if the answer is not 1.
- No expectation is typed. Showdown's stream is the expectation, compared as a sequence.
- The confusion line is **also pulled out alone with its index**, because a missing field and a
  misplaced line are two defects with two different patches and a sequence diff reports them as one
  red.

Green clauses that matter: **boards identical at every boundary on both arms**, and the confusion
volatile agrees in state (`2` then `1` on both engines). This is narration.

Red clauses: turn-2 narration sequence; the line's fields; the line's position.

### THE PATCH, NOT APPLIED

Three edits, all in `engine/medicham2-browser.js`, plus one derived tag param.

**(a) `data/tags.json` / the `locksIntoMove` derivation** — add a param derived from the condition,
never from a name:

```
expiresAtMove: !!DX.conditions.get(<self.volatileStatus>).onAfterMove
```

True for the four lock-in moves, false for Uproar (printed above).

**(b) `applyConfusion` carries the tag — `engine/medicham2-browser.js:15263` and `:15277`**

```
function applyConfusion(t,src,field,viaSecondary,viaFatigue){
...
  if(TR)TR.vstart(t,'confusion',viaFatigue?'[fatigue]':'');
```

`TR.push` is `parts.filter(x=>x!=null&&x!=='')` (`:3179`), so `''` leaves all four existing callers
byte-identical. Then `:32675` becomes `applyConfusion(x,null,field,false,true)`.

**(c) The move-time expiry — a new block beside the lock-arming site at `:31402`**, which is where
this engine already applies the move's `self` effects and already emits Uproar's `-start`, i.e. the
`onAfterMove` position:

```
/* `lockedmove.onAfterMove` — `if (this.effectState.duration === 1) removeVolatile('lockedmove')`,
 * and removeVolatile runs onEnd, which is the fatigue. Gated on the condition's own onAfterMove
 * (tag param `expiresAtMove`) so Uproar, whose expiry IS the residual, is untouched. */
if(m._mtLock && m._mtLock.expiresAtMove && m._mtLock.move===a.move.id && m._mtLock.left<=1){
  const _lc=m._mtLock; m._mtLock=null; MEDSEEN.lockExpired++;
  refreshSleepBlock(actA,actB,sfA,sfB);
  if(_lc.confuse){ MEDSEEN.lockExpiredConfused++; applyConfusion(m,null,field,false,true); }
}
```

`left` is the number of forced turns still owed **including this one** and is ticked at the residual,
so `left <= 1` is exactly "this was the last one". The residual block at `:32682` keeps its branch
untouched — it is the correct road for a body that never moved — and only gains the fifth argument.
The WIRE 144 header comment at `:32645` needs the `onAfterMove` road added to its account.

**PREDICTED SCOREBOARD.** Whole-game is 6 of 961 and this closes **one** of them
(`…2635122796 vs …2634861011`), so 6 -> 5. Board-material is 0 and **must stay 0** — the probe
asserts boards identical on both arms, and a board that moves here is a different finding. The
mechanics clause is 5 of 12 and must not move: no lock-in move is among the twelve. Census may gain a
row for the new probe.

**ONE RISK, NAMED.** Moving the expiry earlier clears `_mtLock` mid-turn, which is also what
`refreshSleepBlock` reads for Uproar's field-wide sleep refusal. The gate above keeps Uproar out of
the new branch, so nothing about the sleep block changes — but it is the one coupling in the patch
and should be asserted, not assumed.

---

## PART TWO — THE MECHANICS CLAUSE

Read from `git show HEAD:data/all-mechanics-fire.json` (generated 2026-08-27T22:28:17Z, release
`a4b2832e0a0f`, arm `bottom-tie-first`, 1,289 games played, 0 threw).

**THE ARITHMETIC REPRODUCES THE GATE EXACTLY, WITHOUT RUNNING IT.** 12 diverging non-deferred rows;
1 subtracted by the single applicable declaration (`fallenundefined`); 6 below the reach shelf;
0 cleared on decision impact (`data/decision-impact.json` does not exist in this tree, so nothing can
be); **5 counted**. The shelf is `REACH_SHELF_CLICKS = 25` clicks in 64,846 stored games, carried to
13,116 open-sheet games as 5.06 -> **6 teams**, read off `data/click-counts.json` and
`data/sheet-usage.json`.

### THE TWELVE, BY NAME

| mechanic | what parts | reach | verdict |
|---|---|---|---|
| **Shell Side Arm deals 88 where the authority deals 99** | `-damage` 872/960 vs 861/960 | 101 clicks | **COUNTS** |
| **Smack Down starts its volatile on a body that is not airborne** | an extra `\|-start\|…\|move: smackdown` | 59 clicks | **COUNTS** |
| **Switcheroo's activate line names Switcheroo, not Trick, and drops `[of]`** | `-activate` field 3 | 85 clicks | **COUNTS** |
| **Berserk's `+1 SpA` is written before the `-hitcount` line** | ordering | 56 teams | **COUNTS** |
| **Sand Force boosts only Rock; the authority boosts Rock, Ground and Steel** | `-damage` 718/960 vs 702/960 | 34 teams | **COUNTS** |
| Supreme Overlord's `fallenundefined` | `-end` missing | 112 teams | declared AUTHORITY-WRONG |
| Recycle: the authority announces Ripen before the berry | `-activate` missing | 22 clicks | below shelf |
| Reflect Type: the `typechange` start line is missing | `-start` missing | 11 clicks | below shelf |
| Gastro Acid writes a `-start` where the authority writes `-endability` | extra event | 11 clicks | below shelf |
| Corrosive Gas: our `-enditem` lands before the foe's Protect `-activate` | ordering | 1 click | below shelf |
| Heal Bell's `-activate` is missing | event missing | 0 clicks | below shelf |
| Leppa Berry's activate line drops the move name and `[consumed]` | `-activate` field 4 | 1 team | below shelf |

Four more rows diverge and are **shelved by the owner** (`deferred`), so they never reach the
clause at all: Bitter Malice and Night Daze (both an Illusion body switching in), Forewarn, and
Metronome (the item).

### THE FIVE: ENGINE, INSTRUMENT, OR DECLARED?

All five are **the engine**. None is a declared case, and none is the instrument — but the
instrument is understating two of them, which matters more than a misclassification would.

**1. Sand Force boosts only Rock.** `data/tags.json` carries
`damageBoost {mult: 1.3, onType: "Rock", inWeather: ["sand"]}`. The authority
(`data/abilities.ts` sandforce, not overridden by Champions) is
`if (move.type === 'Rock' || move.type === 'Ground' || move.type === 'Steel')`. The staged move is
Ground (`sandforce type=Rock|Ground|Steel -> actor:bulldoze`, the artifact's own trigger row), so we
apply no boost at all. The arithmetic agrees: earlier turns are byte-identical and the parting hit is
~69 against ~53, a ratio of 1.30. **`onType` is a scalar in a tag whose only multi-type member is
this one** — I walked every `damageBoost` param in `data/tags.json` and the other six carry one type
each, so this is contained and not systemic. Board-material in the lab: `verdict: STATE`, HP leaf
658 (us) vs 642 (them).

**2. Shell Side Arm always uses its declared category.** The authority's `onModifyMove` computes both
damage estimates and flips to Physical when physical wins, **also setting `move.flags.contact = 1`**.
`data/tags.json` has no category-choice tag for it at all — its tags are `pp`, `dualPurpose`,
`targetClass`, `inflictsPoison`, `formatSecondaryCount`, `statusInflict` — so we always use the
declared Special. We deal less than the authority, which is the direction "pick the larger" predicts.
Board-material in the lab: `verdict: STATE`, HP 752 vs 741. **There is a die inside this one**: on an
exact tie the authority takes `randomChance(1, 2)`, which we do not take at all, so a naive fix
introduces an unshared address — the class that has cost this project three retractions.

**3. Smack Down applies its volatile unconditionally.** `data/moves.ts` smackdown.condition.onStart
sets `applies` only for a Flying type, Levitate or Eelevate, or a body in Fly / Bounce / Magnet Rise
/ Telekinesis, and clears it for Iron Ball, Ingrain or Gravity — `if (!applies) return false;`, so
against a grounded target **no volatile and no line**. Our tag is
`statusInflict {volatile: "smackdown", chance: 100}` with no gate. **THE INSTRUMENT IS UNDERSTATING
THIS ONE**: the row's board verdict is `ANNOUNCEMENT-ONLY`, but it also carries
`core_leaf_unchecked: true` and `uncomparable_leaves: ["volatile:smackdown"]` — the comparator cannot
see the very leaf the defect writes. We are carrying a grounding volatile the authority never wrote,
and no instrument in this repo has looked at it. (Gastro Acid, below the shelf, has the identical
shape on `volatile:gastroacid`.)

**4. Switcheroo's activate line.** `data/moves.ts` switcheroo shares Trick's `onHit` verbatim and
hard-codes `this.add('-activate', source, 'move: Trick', '[of] ' + target)`. We write
`move: switcheroo` and no `[of]`. **This is already blocked**: ROADMAP #490's declared remainder says
Trick's `-activate` is wrong in this engine and that "`corrosivegas` and `switcheroo` ride the same
branch and are blocked behind it". Narration; boards agreed at every boundary.

**5. Berserk boosts before `-hitcount`.** `data/mods/champions/scripts.ts:550` writes
`-hitcount` at the **end** of the multi-hit loop, above `applyRecoilDamage`; Berserk's boost is in
`onAfterMoveSecondary`, which runs later. We emit the boost first. **Champions DOES override
`berserk`** (`data/mods/champions/abilities.ts:8`) — but only its `onDamage` guard, dropping
mainline's Sheer Force clause; `onAfterMoveSecondary` is inherited. Narration; boards agreed.
**INSTRUMENT NOTE**: this row's board walk carries `end_reason: "THREW"` on **both** the arm and the
control, so the "boards agreed" evidence is truncated rather than complete. Worth a look before this
one is called narration-only for good.

### DO THEY APPEAR IN THE PINNED POOL?

All five appear, and all five are rare enough that the pool could not have found them. Counted by a
single streaming pass over `data/team-pool-frozen/{games.bo3,games.ots}.jsonl` — 17,381 stored games,
matching the id string anywhere in the record, which **over-counts** (a sheet listing a move it never
clicks still matches):

| mechanic | games in the pinned pool | share |
|---|---|---|
| Berserk | 91 | 0.52% |
| Smack Down | 39 | 0.22% |
| Shell Side Arm | 24 | 0.14% |
| Sand Force | 19 | 0.11% |
| Switcheroo | 10 | 0.06% |

The differential samples 961 of those 17,381 games, so the expected number of sampled games *mentioning*
each is between 0.6 and 5, and the number where the mechanic actually fires is smaller again. **This is
the reason the pool sat still while the lab saw all five** — it is a fact about the metagame, exactly as
Will's 2026-08-23 ranking says, not a hole in the pool. It also means: **when these are fixed, predict the
lab moves and the pool does not, and say so before the run.**

### RANKED BY COST TO CLOSE

1. **Sand Force** — one derivation change (`onType` scalar -> array) and its reader. Sole multi-type
   member, so nothing else can over-match. Board-material in the lab, so the roster and the census
   both move.
2. **Berserk's `-hitcount` order** — one emit position; the authority's is unambiguous and cited.
   Narration. Costs one probe and a look at why both board walks threw.
3. **Leppa Berry's activate line** *(below the shelf, so it does not move the clause)* — two fields
   on one line, `moveSlot.move` and `[consumed]`, and our PP restoration already agrees. The cheapest
   real fix on the whole list; worth landing beside anything else in this family.
4. **Smack Down's airborne gate** — needs a derived tag for the condition's `onStart` refusal
   (Flying / Levitate / Eelevate / Fly / Bounce / Magnet Rise / Telekinesis, negated by Iron Ball /
   Ingrain / Gravity) and a label-casing fix. Moderate. **Closing it fully also needs the board
   comparator to stop declaring `volatile:smackdown` uncomparable, and that is not ENGINE's file.**
5. **Switcheroo** — two fields, but blocked behind the declared Trick `-activate` remainder. Cheap
   once Trick is settled, and Trick, Switcheroo and Corrosive Gas should land together since they
   ride one branch.
6. **Shell Side Arm** — most expensive by a distance: a new derived tag for damage-based category
   selection, a stat read at move time, a `flags.contact` flip, and a `randomChance(1, 2)` tie die
   that needs a shared address on both sides before it is taken. Board-material, so it is worth the
   cost — but it is a batch of its own.

---

## OWED, NOT RUN

- `tests/probe_fatigue_tag.js` is **uncommitted**. Two other agents are live; it was left on disk
  deliberately rather than committed into their working tree. It is red, exit 1, 3 failing clauses.
- **No gate was run.** The "5 of 12" split above is re-derived from the artifact plus
  `data/click-counts.json`, `data/sheet-usage.json` and the one applicable declaration, and it
  reproduces the gate's headline exactly — but `engine/quarantine.js` was not executed, so this is a
  reconstruction and not a reading.
- **Shell Side Arm's mechanism is inferred, not staged.** That the authority flipped to Physical is
  the only candidate given the tag list carries no category-choice tag and the direction is right,
  but no fixture was played to confirm which category each engine used. Owed before the fix.
- **Berserk's board evidence is truncated** — `end_reason: "THREW"` on both arms of that row. Whether
  it is narration-only rests on a walk that did not finish.
- **The `volatile:smackdown` and `volatile:gastroacid` leaves are uncomparable to the board
  comparator.** Neither row's `ANNOUNCEMENT-ONLY` verdict has been earned; both need the comparator
  extended before they can be called narration.
- **`tgt` and the whole-game clause were not touched**, nor the two Protect refusal rows, the three
  `|upkeep` rows, the five `fallenundefined` rows, Healer / Shed Skin, or #500 / #498 / #504 / #505.
