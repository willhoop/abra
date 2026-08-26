# THE REMAINING MEDICHAM DIVERGENCES, GROUPED BY MECHANISM — 2026-08-25

**READ-ONLY DIAGNOSIS.** Nothing was played, nothing was fixed, no artifact was written except this
file. A second ENGINE agent was live in `engine/game_differential.js` and the simulator throughout.

**EVERY ARTIFACT HERE WAS READ WITH `git show HEAD:<file>`** into a scratch copy, never off the
working tree, because the live copies were moving under me — `data/game-differential.json` on disk
was stamped `21:20` local while I worked at `21:37`, and its committed twin (commit `47189c1c`,
`20:48`) is a settled read. Files read this way:
`data/game-differential.json`, `data/all-mechanics-fire.json`, `data/mechanics-census.json`,
`data/click-counts.json`, `data/sheet-usage.json`, `data/divergence-turns.json`.
Source files (`engine/medicham2-browser.js`, `engine/quarantine.js`, the Showdown checkout,
`data/tags.json`, `docs/ROADMAP.md`) were read from the tree — they are code and register, not
measurements, and every claim taken off them is cited to a line.

---

## 0. THREE THINGS THAT MUST BE SAID BEFORE ANY RANKING

### 0a. THE BRIEF'S "THREE PROTECT/DETECT ROWS ARE EXACT TIES, FILE THEM NOT A DEFECT" IS STALE — THAT READING WAS WITHDRAWN

ROADMAP **#376** carried exactly that reading and it was **withdrawn on 2026-08-24 by MEASURE**, in
the row's own text: Showdown's shuffle is replaced by a **no-op in every shipped arm**
(`pinShuffle`, `game_differential.js:1085`), medicham2's tied-group key has had its own named `tie`
stream since 2026-08-20, and the middle arm neutralises it with `o.tie = () => 0`
(`game_differential.js:1182`). **Under this harness both tie devices are pinned, so a tie MUST
resolve identically and a cause that still diverges is a real turn-order defect.** The withdrawal is
written into `engine/quarantine.js` as a comment where the declaration would have gone and asserted
in the selftest at gap 0 and gap 40, so re-adding it goes RED. Will then ruled (2026-08-24) that the
harness spread ladder stays as-is, so the manufactured ties keep their weight.

**And on this run the question is moot anyway: `order_probe` is `[]` — EMPTY.** The probe only fires
when both reduced lines are `|move|` (`game_differential.js:3157`), and **none of the current 22
causes is a `|move| <> |move|` pair.** So *nothing in this run measured an exact tie*, and no row
below may be filed as one. If somebody wants that verdict for a specific row, it has to be measured,
not inherited.

### 0b. EVERY BOARD-MATERIAL FIGURE BELOW IS A CLAIM ABOUT THE FIRST TWELVE TURNS

`turns_cap: 12` in the artifact. `docs/_reports/2026-08-25-turn-cap.md` §5 measured the same release,
same pins, same pool, same 961 games at three caps:

| | cap 12 | cap 16 | cap 30 |
|---|---|---|---|
| protocol PARTED | 28 | 40 | **80** |
| board-material | 10 causes / 10 games | 17 / 19 | **41 causes / 43 games** |

(That table is the pre-trap-fix run; the shape, not the integers, is what transfers.) **Board-material
goes 10 → 41 on the same mechanics.** So "8 board-material" is not a count of the defects that exist;
it is a count of the ones that surface before turn 13. Nothing below should be read as "only 8 things
are wrong with the board."

### 0c. TWO OF THE 17 ARE ALREADY RULED A DON'T-CARE AND ARE COUNTED ON PURPOSE

`ordering :: |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind` is **2 games — the single largest
cause in the whole set** — and ROADMAP **#355** reads *"DEFERRED BY DECISION (Will, 2026-08-24:
'tailwind coming out in the wrong order doesnt matter, put it into the closet with that note and move
on')"*. It is still in the 17 **by design**: `quarantine.js`'s `DECLARED_KINDS` admits only
`INCOMPARABLE` and `AUTHORITY-WRONG`, and it has an explicit guard that *"stops a DEFERRED row — 'a
real defect we chose not to fix yet' — from being subtracted and opening the gate."*

**So the gate cannot reach zero on tailwind without a decision from Will**, not without engine work.
That is a question, not a bug, and it belongs to MEASURE (it owns the clause). Nobody should spend
engine time on those two games.

---

## 1. WHAT THE TWO SCOREBOARDS SAY, READ OFF THE COMMITTED ARTIFACTS

### The pool — `data/game-differential.json`, release `d38d117e68e9`, generated `2026-08-26T00:14:52Z`

961 games, **22 parted**, 0 threw, cap 12, arm `middle`, pool `data/team-pool-frozen` digest
`0d103fb9fa87`, census pinned to `9446a684709d` (**`matches_live: false`** — the steering census is 643
rows against a live 706; that is a correct pin, and it means the SAMPLE is selected by an older
census).

| | causes | games |
|---|---|---|
| BOARD-MATERIAL | 8 | 8 |
| NARRATION-ONLY | 13 | 14 |
| — of which declared (Supreme Overlord `fallenundefined`) | 5 | 5 |
| **undeclared, the gate's 17** | **16** | **17** |

`by_shape`: RULE 10, EMISSION 8, ORDERING 4. `DIFFERENT-END-STATE` 11 of 961, of which **5 are in
games whose protocol NEVER parted** — those five are invisible to every cause string in this report
and are a separate population nobody has carded.

### The lab — `data/all-mechanics-fire.json`, same release, generated `2026-08-26T00:19:04Z`

1,287 games, 0 threw. Diverging rows: **moves 13, abilities 3, items 1 = 17** (excluding 4 shelved by
the owner's closet: `forewarn`, `metronome` + 2). The gate's clause is **10 of 17 played and
uncleared** — the other 7 fall below the usage shelf or are cleared on decision impact.

Reach, derived from `data/click-counts.json` and `data/sheet-usage.json` (moves = clicks in both human
stores, abilities/items = teams):

| diverging row | reach | above the 25-click move shelf? |
|---|---|---|
| `bittermalice` | 519 clicks | yes |
| `shellsidearm` | 101 | yes |
| `switcheroo` | 85 | yes |
| `smackdown` | 59 | yes |
| `nightdaze` | 54 | yes |
| `stringshot` | 46 | yes |
| `teeterdance` | 33 | yes |
| `cottonspore` | 31 | yes |
| `attract` | 30 | yes |
| `recycle` | 22 | no |
| `gastroacid` | 11 | no |
| `reflecttype` | 11 | no |
| `sweetscent` | 1 | no |
| `corrosivegas` | 1 | no |
| `healbell` | 0 | no |
| ability `berserk` | 56 teams | — |
| ability `sandforce` | 34 teams | — |
| ability `supremeoverlord` | 112 teams | the declared `fallenundefined` family |
| item `leppaberry` | 1 team | no |

**The census is 706 probed / 706 live / 0 missing.** It cannot go up on any fix below unless somebody
writes a NEW probe row. Saying "the census will move" about any of this without writing a probe first
is wrong by construction.

---

## 2. THE MECHANISMS, RANKED BY WHAT CAN BE DIAGNOSED TO THE BOTTOM

**Not ranked by count.** Seven of the eight board-material causes are one game each; ranking by count
produces a flat list and no decision. Ranked by *how far a person can drive it before hitting a wall*,
and each entry says where the wall is.

---

### M1. A SPREAD MOVE'S SECONDARY FIRES ON ONE ENGINE AND NOT THE OTHER

**In plain words:** a move that hits two bodies rolls its side-effect — a flinch, a burn — separately
for each. On two of these games our engine applied that side-effect where the authority did not.

**Count: 2 of the 8 board-material games. This is the only mechanism with more than one board-material
game, and the artifact cannot see that — it files them as two causes of one game each,** because
their cause strings are unrelated. This is the card-review method's whole point.

| game | move | what the authority did | what we did |
|---|---|---|---|
| turn 8, `unrelated event mismatch :: \|move\|p2a\|psychicfangs <> \|cant\|p2a\|flinch` | Aerodactyl Rock Slide, spread onto Metagross + Volcarona (Volcarona faints) | Metagross **moves** — Psychic Fangs | Metagross **flinched** |
| turn 9, `extra event emitted by medicham2 :: \|faint\|p2b <> \|-status\|p2a\|brn` | Sinistcha Matcha Gotcha, spread onto Excadrill + Falinks (Falinks faints) | no burn | **burned Excadrill** |

Both moves carry a per-target secondary (Rock Slide 30% flinch, Matcha Gotcha 20% burn) and in both
the *other* target of the same spread **fainted on that hit**.

**Board-material: MEASURED, both.** `materiality: BOARD-MATERIAL`, `board_parted_same_turn: 1` on each,
first board divergence turns 8 and 9. The flinch one ends `DIFFERENT-END-STATE`.

**Present in the engine?** Yes — spread secondaries are wired and the per-target accuracy roll landed
in ROADMAP #294/#295. This is not a missing mechanic.

**Why it is top of the list: the instrument that answers it already exists and costs nothing to run.**
The middle arm's die is addressed `seed|turn|cat|move|target|nth` (`game_differential.js:735, :815`)
— **the target slot is IN the address**, so a draw on Excadrill cannot be shifted by anything that
happened to Falinks. Two engines drawing different values at the same address is either a different
address or a different gate, and `tests/test-middle-identity.js` is built to diff exactly that, per
category, over real games. **Run it before touching a line of the simulator.**

**Not yet ruled out, and it is the alternative hypothesis:** the authority may not be *drawing at all*
for the surviving body (a suppressed secondary, Shield Dust, a status already present), in which case
the address is irrelevant and the gate is the defect.

**Which scoreboard:** the POOL. Rock Slide is 18,122 clicks and Matcha Gotcha 8,182, so this is real
usage. The roster stages one move at a time against one body and structurally cannot see a two-target
secondary; the census probes the TAG, which is correct here. **Expect the pool to move and the lab to
sit still.**

---

### M2. THE PROTECT COUNTER IS A CLICK-COUNTER HERE AND A TIMED VOLATILE ON THE AUTHORITY

**In plain words:** consecutive Protects get less likely. On the authority the counter is a volatile
that expires on its own two-turn clock; here it is a number that only resets when the body clicks
something else. A body that *could not act* — asleep, flinched — therefore keeps its penalty here and
loses it there.

**Count: 1 board-material game.** `unrelated event mismatch :: |-singleturn|p2a|protect <> |-fail|p2a`,
turn 6. The line immediately before it is `|-curestatus|p2a: Clefable|slp|[msg]` — **Clefable had just
woken up.** Showdown's Protect succeeds; ours fails.

**Board-material: MEASURED.** `BOARD-MATERIAL`, board parted, `SAME-END-STATE` within 12 turns.

**Present in the engine?** Yes, and derived properly: `stallCounterChecks` reads `counter = 3`,
`counter *= 3` and `counterMax: 729` off `data/conditions.ts` rather than typing them
(`medicham2-browser.js:18279-18284`). **The number is right. The LIFETIME is the gap.**

**The authority's rule, read at the line** (`data/conditions.ts`, `stall`, no Champions override):

```
stall: { duration: 2, counterMax: 729,
  onStart()  { this.effectState.counter = 3; },
  onStallMove(pokemon) { const success = this.randomChance(1, counter);
                         if (!success) delete pokemon.volatiles['stall']; return success; },
  onRestart() { ... this.effectState.duration = 2; } }
```

`duration: 2` decrements on the volatile's own end-of-turn clock whether or not the holder acted. Ours
resets at `medicham2-browser.js:17782` — `else it.mon.tookProtectTurns = 0` — in the branch reached by
a body that CLICKED a non-stalling move. **A sleeping body clicks nothing.**

**Why it is high: the hypothesis is one arm away from proof and the instrument exists.**
`tests/test-volatile-duration.js` asks exactly this question — *does a duration-bearing volatile carry
the number Showdown carries, at every turn boundary* — and the `stall` volatile is not in its family
today. The arm: raise a Protect, put the body to sleep for two turns, wake it, click Protect; assert
the authority succeeds and assert our `tookProtectTurns` reads 0. Control: the same board with the
body awake and clicking a non-stalling move, where both engines must agree.

**Which scoreboard:** the POOL. Protect is 134,710 clicks. The roster's Protect scenario is already
known to be the weak instrument here (card review §F2). **Expect the pool to move; the lab and census
to sit still unless a new census row is written for the expiry.**

---

### M3. TWO MECHANICS WHOSE FAILURE CONDITION IS NOT DERIVED AT ALL, SO WE DO THE THING AND THE AUTHORITY REFUSES IT

**In plain words:** Showdown checks whether a move is allowed to work before it works. For these, the
check lives in a handler, `tag_dex` did not pick it up, and `data/tags.json` carries no condition — so
we always succeed.

This is the C1/C3 shape from the card review, and it now has two clean members plus one member that is
already derived and simply not honoured.

**(a) SMACK DOWN grounds a body that is already on the ground.** Lab row, `smackdown` / Annihilape,
59 clicks: `extra event emitted by medicham2 :: |move|p2a|agility <> |-start|p2a|smackdown`. The
authority (`data/moves.ts`, `smackdown.condition.onStart`, no Champions override):

```
let applies = false;
if (pokemon.hasType('Flying') || pokemon.hasAbility(['levitate','eelevate'])) applies = true;
... magnetrise / telekinesis / fly / bounce ...
if (!applies) return false;
this.add('-start', pokemon, 'Smack Down');
```

The staged target is a Feraligatr — Water, no Levitate — so `applies` is false and there is **no
`-start` and no volatile**. `data/tags.json` gives `smackdown` only
`statusInflict: [{volatile:"smackdown", chance:100, to:"target"}]` with **no condition**, so we apply
it unconditionally. **The derivation gap is upstream of the engine**: the fix is a tag, then the
engine reads it.

**(b) DISABLE has two refusal conditions in the authority and none here.** Board-material game
(`unrelated event mismatch :: |-fail|p2b <> |-start|p1a|disable|protect`, turn 9,
`DIFFERENT-END-STATE`) *and* a lab reach of 1,799 clicks. The authority refuses twice:
`onTryHit(target)` returns false if `!target.lastMove` or the last move was Struggle/Z/Max; and
`condition.onStart` returns false if `!pokemon.lastMove` **or the last move is out of PP**.
`data/tags.json` gives `disable` `sealsMoves`, `locksTarget`, `volatileAnnounce` — **no failure
condition of any kind**.

**Which clause fired in that game is NOT determined by this artifact and I am not guessing it.** The
card is needed. What *is* determined is that neither clause exists on our side.

**(c) ENDEAVOR's immunity gate IS derived and the engine does not read it.** Narration game
(`unrelated event mismatch :: |-immune|p1a <> |-damage|p1a|H/Hpsn`) — Whimsicott Endeavor into an
Aerodactyl at equal HP; the authority prints `-immune`, we print a zero-damage `-damage`.
`data/tags.json` **already carries it**, fully machine-readable:

```
endeavor.params.immunityGate = { hook:"onTryImmunity",
  condition:{ pass:"hpCompare", left:"user", op:"<", right:"target" },
  readable:true, step:3,
  blocksBefore:["hitStepAccuracy","hitStepBreakProtect","hitStepStealBoosts","hitStepMoveHitLoop"],
  from:"DERIVED:BattleActions.prototype.hitStepTryImmunity + ..." }
```

So ROADMAP #337's derivation half is DONE. **What is missing is the consumer**, which is exactly what
`tests/test-immunity-gate.js` says it structurally cannot see: *"whether MEDICHAM honours the tag: it
loads no part of the simulator."* `switcheroo` and `trick` carry the same `immunityGate` (Sticky Hold)
and are in the same position.

**Board-material: (a) is a volatile that should not be there — `board_state.js` compares volatiles, so
this is state, measured by the lab. (b) is MEASURED board-material by the pool. (c) is MEASURED
narration in the one game it appeared in, and only because the HP happened not to move — the
positive arm (user HP > target HP blocking a real item swap through Trick/Switcheroo) is board-material
and nothing staged it.**

**Why it is high: all three are read off the authority's own source in one sitting and each has a
declared positive arm.** The card review already wrote the discipline for (c): stage user HP `>`,
`=` and `<` and assert all three, or you ship an Endeavor that never works.

**Which scoreboard:** LAB for (a), both for (b), LAB for (c) — the pool holds one Endeavor game and
243 clicks total. Say so before the run.

---

### M4. TWO OF THE TEN "DIVERGING MECHANICS" ARE NOT MECHANICS — THE ROSTER STAGED THEM ON A ZOROARK

**In plain words:** the lab picked Zoroark to demonstrate Night Daze and Zoroark-Hisui for Bitter
Malice. Zoroark's only ability is Illusion, which makes it *announce itself as a different Pokémon on
the way in*. Both rows diverge on the **switch-in line, at protocol index 0** — the move never
resolved.

```
bittermalice / nightdaze:  at: 0,  cls: "switch: a different body"
  showdown  |switch|p1a: Blastoise|Blastoise, L50|780/780
  medicham  |switch|p1a: Zoroark|zoroark-hisui, L50|780/780
```

**Reach: 519 + 54 clicks. That is the largest single reach in the counted set, and it is measuring
Illusion.** Illusion is **449 teams** — larger than anything else here.

**This is a real gap AND a wrongly-attributed one at the same time**, and both halves matter:
- `engine/game_differential.js:5097-5122` has an explicit **closet** — `closetRejects(team)` — that
  keeps Illusion carriers out of the pool, on ROADMAP #160 and Will's *"we banned zoroark remember"*.
- `tests/roster.js` has **no such filter** and stages them anyway.
- Zoroark **is legal in this regulation** (derived: `isNonstandard: null`, ability list `{0: Illusion}`),
  so this is not a legality question. It is one instrument closeting a mechanic and another instrument
  accusing two moves for its absence.

**Board-material: NOT MEASURED. The pool has zero of these games by construction** (the closet removed
them), so nothing in the whole-game run says whether Illusion changes a board. It obviously does — a
body pretending to be another body is the thing every read is made against.

**Why it is here rather than higher: it is a DECISION, not a diagnosis.** Either Illusion gets modelled
(a real piece of work with 449 teams behind it, and the pool closet then lifts), or the roster inherits
the differential's closet and these two rows stop being counted. **Do not "fix Night Daze."** Ask Will
which. My read: the reach argues for modelling it, and the ROADMAP #160 closet argues it was ruled out
once already — that ruling needs re-confirming, not re-deriving.

---

### M5. A SPREAD *STATUS* MOVE RESOLVES ONE BODY AT A TIME HERE AND ONE STEP AT A TIME ON THE AUTHORITY

**In plain words:** when a move hits two bodies, Showdown does step one for both, then step two for
both. We finish the first body completely, then start the second. So a Protect on the second body is
announced *after* the first body's effect has already landed.

**Count: 5 of the 17 lab rows — the largest mechanism group in the lab by a distance.** Every one has
the same shape:

| row | reach | showdown | medicham2 |
|---|---|---|---|
| `cottonspore` | 31 | `-activate p2b Charizard move: Protect` | `-unboost p2a spe 2` |
| `stringshot` | 46 | same | `-unboost p2a spe 2` |
| `sweetscent` | 1 | same | `-unboost p2a evasion 2` |
| `teeterdance` | 33 | same | `-start p2a confusion` |
| `corrosivegas` | 1 | same | `-enditem p2a sitrusberry` |

**The authority, cited** (`sim/battle-actions.ts:550-577`, `trySpreadMoveHit`): `moveSteps` is an array
of eight steps, and **each step takes `targets: Pokemon[]` and loops it internally** —
`hitStepInvulnerabilityEvent` (:621), `hitStepTryHitEvent` (:643, where Protect's `-activate` is
written), `hitStepTypeImmunity` (:654), `hitStepTryImmunity` (:666), `hitStepAccuracy` (:690). Step-major
over targets, unambiguously.

**Our side is step-major for DAMAGING moves and target-major for STATUS moves, and that split is the
defect.** `medicham2-browser.js:26933` is the damaging driver and it is correct:

```js
for(const _step of _STEPS) for(const R of _rows){ if(R.out)continue; MID_TGT=midEventSlot(R.tg); _step(R); }
```

— its own comment says *"step outside, target inside"* (WIRE 10). But the status dispatcher is a
separate branchy path outside that driver, and each branch has its own `for (const t of _tl)` running
the whole gauntlet per body: the `affect` branch at **:20028/:20044**, `trickitem` at **:21244/:21245**,
and the same shape at :20391, :20528, :21725, :22046, :22641. The `affect` branch's own comment states
the model it was built on — *"EVERY TARGET RUNS THE WHOLE GAUNTLET ON ITS OWN. Showdown resolves each
body through its own TryHit"* — which is **half right**: the per-body independence is correct, the
interleaving is not.

**Board-material: NARRATION as measured, and I am saying so as a limit rather than a verdict.** No
board-material row in the pool is attributed to this. The bodies affected and the effects applied are
the same on both sides in every one of the five; only the interleaving differs. **The case where it
would stop being narration is one nobody has staged**: an effect on target A that changes whether
target B's gate passes (an ability swap, an item removal, a faint) resolving on the wrong side of B's
check. That is an argument, not a measurement, and it is not claimed here.

**Why it is mid-list despite being the biggest group: the fix is a restructure, not an edit.** Nine
call sites, each with its own gauntlet, and the damaging driver already shows what the shape should be.
It is the highest-count item and the highest-cost one, and it should not be attempted the same night
as anything else.

**Which scoreboard:** the LAB, five rows at once. The pool should be expected to sit still — say so
before the run, because it will otherwise read as a failed fix.

---

### M6. THE SHIELD ANSWERS ABOVE STEP 0 HERE AND AT STEP 1 ON THE AUTHORITY

**In plain words:** a body in the air is missed before Protect is even asked. We ask Protect first.

**Count: 1 narration game.** `ordering :: |-miss|p1b|p2b <> |-activate|p2a|protect`, turn 10 —
Garchomp's Earthquake into a Protecting Milotic and a Houndstone the authority missed.

The authority's `-miss` here comes from **step 0**, `hitStepInvulnerabilityEvent` (`:621`), which runs
*before* `hitStepTryHitEvent` (`:643`) where Protect writes `-activate`. Our Protect block is hoisted
**above the entire `_STEPS` driver** (`medicham2-browser.js:23726-23800`, ROADMAP #81 WIRE 1) and its
own comment labels itself "STEP 1" while sitting above step 0 (`_stepInvuln`, which is index 0 of
`_STEPS` at :26905).

**Board-material: NARRATION-ONLY, measured** (`board_never_parted: 1`). Both engines block and miss
the same bodies.

**Why it is on the list at all: it is a one-position move with a hard citation, and the hoist is
load-bearing for other things** — the Spiky Shield contact toll and the `_pierceP` walk-through both
hang off it, so it is not a two-line change. Cheap to diagnose, not cheap to move.

---

### M7. `-hitcount` AND THE FAINT SIT BETWEEN THE DAMAGE AND THE AFTER-MOVE ABILITIES, AND HERE THEY DO NOT

**In plain words:** Berserk raises Special Attack when its holder drops below half. On a multi-hit move
the authority announces the hit count first and boosts after; we boost first.

**Count: 1 lab row** — `abilities/berserk`, Drampa, **56 teams**.
`ordering :: |-hitcount|p1a|2 <> |-boost|p1a|spa|1`.

**The authority, cited** (`sim/battle-actions.ts:974-1006`, `hitStepMoveHitLoop` tail):

```
this.battle.faintMessages(false, false, !pokemon.hp);
if (move.multihit && ...) this.battle.add('-hitcount', targets[0], hit - 1);
if (move.totalDamage) this.applyRecoilDamage(...);
...
this.battle.eachEvent('Update');
this.afterMoveSecondaryEvent(targetsCopy.filter(...), pokemon, move);
```

Berserk is `onAfterMoveSecondary` (`data/abilities.ts`, no Champions override), so it runs in
`afterMoveSecondaryEvent` — **below `-hitcount` and below `faintMessages`.**

Our `_STEPS` (`medicham2-browser.js:26905`) runs `..., _stepAfterHit, _stepAfterHitField, _stepUpdate,
_stepFaint, _stepDrainFaints, _stepHitCount`. **`_stepAfterHit` is four positions too early.**

**Board-material: NOT MEASURED as board-material — it is an emission-order row in the lab and does not
appear in the pool.** The boost lands either way and lands on the same body.

**The trap in fixing it, named so nobody swaps two array entries and calls it done:** the authority has
**two** distinct after-hit families and they sit on opposite sides of `-hitcount`. `onAfterHit` /
`onAfterMoveSecondarySelf` run *inside* `spreadMoveHit`, before the count; `onAfterMoveSecondary` runs
after it. If `_stepAfterHit` carries both, moving it wholesale trades one wrong order for another.
**Split, do not swap** — and this is precisely the kind of arm `tests/test-resolution-order.js` already
takes (twelve staged arms, each played clean and under a named surgical revert).

---

### M8. AN ANNOUNCEMENT WHOSE LABEL IS THE HANDLER'S, NOT THE MOVE'S OR THE ABILITY'S

**In plain words:** three separate rows where the effect is right and the words are wrong, all for the
same reason: we build the label from the raw id and the authority writes a fixed string that its own
handler carries.

| row | reach | authority writes | we write |
|---|---|---|---|
| `switcheroo` (lab) | 85 clicks | `-activate \|move: Trick\|[of] TARGET` | `-activate \|move: switcheroo` |
| `telepathy` (pool, board-material flag) | 238 teams | `-activate \|ability: Telepathy` | `-immune \|[from] ability: telepathy` |
| `suctioncups` (card review §E3, still open) | 1,340 brings | `Suction Cups` | `suctioncups` |

**Switcheroo is not an inference — the authority's handler literally writes `'move: Trick'`**
(`data/moves.ts`, `switcheroo.onHit`: `this.add('-activate', source, 'move: Trick', ...)`), and ours
writes `TR.act(m,'move: '+a.mv)` at `medicham2-browser.js:21257`. One line, one string, and the label
must come from the artifact rather than be typed here.

**Telepathy is the `null`-vs-`false` family** (card review §E3), derived from the ability itself
(`data/abilities.ts`, no Champions override):

```
telepathy: { onTryHit(target, source, move) {
  if (target !== source && target.isAlly(source) && move.category !== 'Status') {
    this.add('-activate', target, 'ability: Telepathy');
    return null; } } }
```

`return null` means *handled, say nothing more*; the handler's own line is `-activate`, not `-immune`.
ROADMAP **#360** already holds this.

**Board-material: the labels are narration. BUT the Telepathy row is flagged BOARD-MATERIAL with
`board_parted_later: 1` — the protocol parts at turn 5 and the board at turn 6, and NOTHING IN THIS
ARTIFACT ATTRIBUTES THE TURN-6 BOARD DIFFERENCE TO THE LABEL.** It may be a second, unrelated defect
downstream. Do not fix the label and claim the board.

**Why it is last of the tractable set: it is the cheapest work here and it buys the least.** Switcheroo
alone is 85 clicks of pure narration. Worth doing in a batch with M3's tag work; not worth an evening.

---

## 3. THE ROWS I COULD NOT DIAGNOSE, AND WHY — THESE NEED CARDS

**These are the honest end of the list. Each names a specific card to dump.**

### C1. Zap Cannon into Golurk — the highest-value single card in the set

`unrelated event mismatch :: |-immune|p1a <> |-miss|p2b|p1a`, turn 10, **board-material,
`DIFFERENT-END-STATE`, board parts at turn 12.** Golurk is Ground/Ghost and Electric cannot touch
Ground; the authority prints `-immune` and never rolls. We rolled accuracy and missed.

**The obvious hypothesis — "we test type immunity after accuracy" — is REFUTED by reading the code.**
`_STEPS` is `[_stepInvuln, _stepTryHit, _stepTypeImm, _stepTryImm, _stepAccuracy, ...]`
(`medicham2-browser.js:26905`), the authority's exact order, and `_stepTypeImm` refuses on
`typeEffAgainst(...) === 0` and sets `R.out` before accuracy is ever reached. **So the two engines
disagree about Golurk's TYPES or about Zap Cannon's effective type — which is a bigger defect than an
ordering one and cannot be assumed.**

**And this row is NEW.** `quarantine.js`'s withdrawn Moody declaration records that when the Moody
address leak was fixed, *"two now part on a DIFFERENT cause — `|-immune|p1a <> |-miss|p2b|p1a` and
`|switch|p1a|krookodile <> |detailschange|p1b|charizardmegay`"*, and that **the declaration was
sheltering two real defects that nothing could see while it stood.** This is one of the two.

### C2. Phantom Force's release deals no damage here

`unrelated event mismatch :: |-supereffective|p1a|1 <> |move|p1a|gravity`, turn 7, **board-material,
`DIFFERENT-END-STATE`.** Both engines emit `|move|p2b: Dragapult|Phantom Force|p1a: Metagross|[from]
lockedmove`; the authority then lands it and we go straight to the next body's move. **A committed
two-turn move produced no damage line at all.** Sits next to ROADMAP **#400**, whose status-move half is
closed and whose second-turn-lock half is open with the site unconfirmed.

### C3. Incineroar is immune to something on turn 1 and we say nothing

`event missing from medicham2 :: |-immune|p1b <> |cant|p2a|flinch`, turn 1, narration-only. Context is
a Scovillain that just mega-evolved and an Incineroar Fake Out. **What Incineroar is immune to is not
recoverable from the cause string** — the `-immune` carries no attribution after normalisation. Card it
or leave it.

### C4. Torment applied twice

`unrelated event mismatch :: |-fail|p1a <> |-start|p2a|torment`, turn 12, narration. Torment's
`condition.onStart` only refuses on Dynamax, so the authority's `-fail` is almost certainly
`addVolatile` refusing a volatile already present (no `onRestart`) — **the same `-fail`-vs-silent family
as Encore and Yawn, which is already half-fixed.** Reach: **3 clicks.** Bottom of every list; recorded
so it is not rediscovered.

### C5. Five games end in a different board and never part in the protocol

`of_the_games_whose_protocol_never_parted: { DIFFERENT-END-STATE: 5 }`. **No cause string exists for
these and no card can be dumped from `first_divergences`, because they have no first divergence.** They
are a population this whole report cannot see, and they are 5 games against the 8 board-material ones
it can. Naming them is all I can do from here.

---

## 4. ALREADY-KNOWN AND UNCHANGED, LISTED SO THE SET IS COMPLETE

- **`fallenundefined` ×5** — declared `AUTHORITY-WRONG`, Supreme Overlord, 112 teams. Left alone as
  briefed.
- **Eager faint** (`ordering :: |upkeep <> |faint|p1b`, a Glimmora on `perish0`) — ROADMAP **#331**,
  open, unprobed. Narration in this instance; card review §A3 argues it shifts every line after it, so
  its true count is probably larger than its cause count.
- **Simultaneous replacement order** (`|switch|p1a|staraptor <> |switch|p2a|incineroar` after a double
  KO) — ROADMAP **#353**, open, no verdict filed. Narration here.
- **Throat Chop's expiry unannounced** — card review §E6, the volatile-counter family. Narration here;
  the cap-30 run says this family is **genuinely late-only** (4 rows at turn 13+), so cap 12
  systematically under-counts it.
- **Sand Force** (`-damage field 3`, 34 teams) and **Shell Side Arm** (`-damage field 3`, 101 clicks) —
  both damage-magnitude rows, both in the lab, neither in the pool.

**Shell Side Arm deserves its own line because the mechanic is absent from the TAGGER, not just the
engine.** The authority picks Physical or Special by comparing two fully-computed damage numbers and
**breaks an exact tie with `this.randomChance(1, 2)`** (`data/moves.ts`, `shellsidearm.onModifyMove`, no
Champions override). `data/tags.json` carries `dualPurpose: {"atFoe": "90 BP attack", "atAlly":
"different effect"}` — **a prose quantity, exactly the Life Orb `"1/10 max HP"` shape from card review
§C2.** Nothing downstream can derive a category from that. The observed 99 vs 88 is consistent with the
authority flipping to Physical and us staying Special, which is the only direction the rule allows
(`physical > special` selects the larger). **This one is a `tag_dex` job before it is an engine job, and
it carries a die that has to be addressed on both sides.**

---

## 5. WHAT I WOULD DO, IN ORDER

1. **M1** — run `test-middle-identity.js` first and read the address diff. No fix, no risk, and it
   either hands you the defect or eliminates the biggest hypothesis. Two board-material games.
2. **M2** — one arm in `test-volatile-duration.js` for the `stall` volatile's clock. One
   board-material game, 134,710 clicks behind it.
3. **M3** — Smack Down's and Disable's failure conditions into `tag_dex`, then Endeavor's existing
   `immunityGate` into the engine, with the positive arm staged. Two lab rows, one board-material game,
   and it closes the derivation half of #337.
4. **C1** — dump the card. It is board-material, it ends in a different board, and the cheap explanation
   is already refuted.
5. **M4** — ask Will about Illusion. Do not fix Night Daze.
6. **M5** — the status-move restructure, alone, in its own batch, with a release either side.
7. **M7 / M8 / M6** — the ordering and label batch, cheapest last.

**And say the scoreboard before each one**, because four of these should move the lab and not the pool,
two should move the pool and not the lab, and none of them moves the census unless a probe is written
for it. The census is 706/706 with 0 missing; there is no headroom in it that a fix alone can occupy.

---

## OWED, NOT RUN

Nothing below was executed. Every command is written against the pins the committed artifacts already
carry (release `d38d117e68e9`, census pin `9446a684709d`, pool `data/team-pool-frozen`) so that a result
is comparable with the figures in this report. **Re-cut or re-pin first if the tree has moved** — the
other ENGINE agent was editing the simulator while this was written, so `d38d117e68e9` may already be
stale, and `node engine/engine_release.js list` says how far.

```bash
# 0. Confirm the tree still is the release these figures describe. If it is not, STOP and re-pin.
node engine/engine_release.js list

# 1. M1 — the shared-die ADDRESS diff, per category, over real games. Run this before any edit.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node tests/test-middle-identity.js

# 2. C1/C2/C3 — dump cards at a size that can be read by hand, then render.
#    --dump-games takes a COUNT and only writes ALONGSIDE --write. Both cost a wasted run.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/game_differential.js --games 961 --release d38d117e68e9 \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --end-state --dump-games 200 --dump-out data/divergence-turns.json --write
node engine/divergence_cards.js --in data/divergence-turns.json --out divergences.html
node engine/explain_divergence.js --all

# 3. The turn-cap caveat in section 0b, re-measured on THIS release rather than inherited.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/game_differential.js --games 961 --release d38d117e68e9 \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state --turns 30

# 4. The exact membership of the gate's "10 of 17", printed rather than inferred from reach.
node engine/quarantine.js --reach

# 5. The speed-agreement block, which is CONSOLE-ONLY and reaches no artifact
#    (game_differential.js:6067-6113). It is the fact under every `ordering` row and nothing
#    publishes it. Capture the stdout of any differential run and read the block headed
#    "SPEED AGREEMENT (getActionSpeed vs effSpeed ...)".

# 6. M2's probe, once written — the stall volatile's own clock.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node tests/test-volatile-duration.js

# 7. After ANY simulator edit: the census must regenerate and must not go down.
node tests/test-mechanics.js
node engine/status.js
```

**Two things in that list are decisions, not runs, and no command produces them:**
- **Illusion (M4)** — model it, or teach `tests/roster.js` the closet `engine/game_differential.js`
  already has. Will ruled once (ROADMAP #160); the ruling needs re-confirming against 449 teams.
- **Tailwind (§0c)** — ROADMAP #355 is DEFERRED by Will and is counted anyway, by design. The gate
  cannot reach zero without either engine work he has already declined or a decision that a DEFERRED
  row may be subtracted. That is MEASURE's clause, not ENGINE's.
