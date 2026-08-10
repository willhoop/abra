# MEDICHAM SPRINT — running notes

**Version 3.96.0 · 2026-08-10**

**WHAT THIS FILE IS AND WHEN IT DIES.** Will, 2026-08-10: *"yes faster, lets just keep a running notes
list doc that we can then use to update the living docs upon completion of medicham."*

The living-docs rule normally moves the white paper, the deck, the technical docs, SUMMARY, MODELS, the
division ledger and CHANGELOG **in the same pass as the code**, with a version bump. For the duration
of the MEDICHAM gate sprint that pass is **deferred, deliberately and on the record** — each fix writes
one row here instead, and the whole batch is written up when the gate closes.

**THE DEFERRAL IS NOT A BYPASS.** `--no-verify` is still banned. The pre-commit gate still runs. What
changed is the target: a sprint commit must touch **this file**, so a fix that records nothing still
fails. The debt is visible and countable rather than silent, which is the whole difference between
this and the four-day drift that made the rule exist.

**WHEN THE GATE CLOSES:** every row below becomes CHANGELOG entries, ledger sections and headline
paragraphs, and this file is deleted. If the sprint is abandoned, the rows still have to be written up
— the debt does not expire because the sprint did.

---

## THE GATE, at sprint start (release `13bda114d649` + the flat-heal cut)

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / abilities  0 differ, 0 did-not-fire, 84 match
FAIL  deliberate roster / items      0 differ, 3 did-not-fire, 137 match
FAIL  deliberate roster / moves     23 differ, 24 did-not-fire, 362 match
```

Census **330 live / 330 probed / 0 missing**. Damage stages **1728/1728 exact**.

**Not counted by the gate and not passing either:** `COULD-NOT-STAGE` is **316 rows** — 217 abilities,
91 moves, 8 items. Each carries a written reason. They are *unmeasured*, not clean.

---

## ROWS CLOSED THIS SPRINT

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 1 | **Iron Ball** | 139 | `speedMult` matched `name === 'choicescarf'`. The CONSUMER worked and was starved. Derived from `onModifySpe` | DID-NOT-FIRE → MATCH |
| 2 | **Light Ball** | 41 | `statMult` matched four names, **all four banned here**, and nothing read the tag; `dmgRange` carried three matching permanently-false conditions. Derived, with the Pikachu lock carried | DID-NOT-FIRE → MATCH |
| 3 | **Oran Berry** | 1 | heals a **flat 10**, not a fraction; the regex read only `maxhp/N`. `restoresFlat` derived beside `restores`, deliberately NOT scaled by max HP | DID-NOT-FIRE → MATCH |
| 4 | **Big Root** | 53 | no tag at all. `healMultBySource` derived from `onTryHeal` — the SOURCE LIST is part of the fact and is carried, so it boosts drain and Leech Seed and nothing else | DID-NOT-FIRE → MATCH |
| 5 | **Shell Bell** | 44 | no tag at all. `healFromDamageDealt` derived; sits beside recoil because both are a fraction of damage ACTUALLY dealt. **Took two passes:** `Math.round` was one high every turn — the authority clamps <=1 to 1 and then TRUNCATES | DID-NOT-FIRE → DIFFER → MATCH |
| 6 | **Metronome** | 19 | **SHELVED BY WILL, not fixed.** Tag derived and correct; the consumer needs a per-body consecutive-use counter threaded through the turn loop and read in `dmgRange` — every move's damage path, for the smallest row in the queue | DID-NOT-FIRE → DEFERRED-BY-OWNER |

| 7 | **Counter, Mirror Coat, Metal Burst, Comeuppance** | 16 | **ENGINE FIXED AND VERIFIED — ROSTER ROW HAS NOT MOVED, CAUSE UNKNOWN.** See the open item below. | DID-NOT-FIRE → *unchanged* |
| 8 | **Cotton Spore, String Shot, Sweet Scent** (+ Teeter Dance, which was not a roster row) | — | the `affect` branch resolved ONE `_t`, so every spread STATUS move moved slot 0 and left slot 1 alone. Target list derived from `spreadFoes` / `spreadAll`, gauntlet run per body. **Roster not re-run by me** — `tests/roster.js` is Will's to run against a frozen tree | DID-NOT-FIRE → *awaiting the roster re-run* |

**ITEMS CLAUSE CLOSED: 6 open → 0. The gate is now 3 of 4 PASS.**

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / items      139 matched (1 deferred, still staged and printed)
PASS  deliberate roster / abilities  84 matched
FAIL  deliberate roster / moves      23 differ, 24 did-not-fire
```

---

## ENCORE, DIAGNOSED — the lock is applied at SELECTION; Showdown applies it at EXECUTION

Diagnosed by `@measure` against frozen release `a59b885861cd`. **Not yet fixed** — `@engine` owned the
file. Will: *"fix encore when the other agent is done."*

**THE MECHANISM.** The Encore in this scenario lands **mid-turn**: p1a is faster and Encores p2a AFTER
both sides' actions were collected. Our `mk()` runs for all four bodies before the queue is sorted, and
at that instant `mon._lock` is still null — Encore is written later, at move resolution. So the WIRE 24
rewrite evaluates **once per turn, at the wrong instant**, and never fires.

```
SHOWDOWN turn 2                              MEDICHAM turn 2 (frozen)
  |-start|p2a|Encore                           |-start|p2a|move: encore      <- volatile IS set
  |move|p2a|Dragon Pulse|p1b Corviknight       |move|p2a|dragonclaw|p1a      <- SELECTED move, unchanged
  |-damage|p1b  (-36)                          |-damage|p1a  (-55)
  |move|p2b|Dragon Claw|p1a  (-39)             |move|p2b|dragonclaw|p1a  (-39)
```

**THE CONTROL IS THE SHARPEST STATEMENT OF IT.** The roster's control arm replaces the Encore click
with the inert click, and its turn-2 board is **bit-identical to our subject arm**. Landing the Encore
changed nothing whatsoever in our engine.

**AUTHORITY** — `sim/battle-actions.ts:223-234`, inside `runMove`, i.e. PER ACTION AT EXECUTION:

```ts
const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
if (changedMove && changedMove !== true) {
    baseMove = this.dex.getActiveMove(changedMove);
    baseMove.priority = priority;                          // the bracket we already fixed
    target = this.battle.getRandomTarget(pokemon, baseMove);   // <- and the target is RE-ROLLED
}
```

Only reachable when the Encore lands after the victim's choice was locked in — on any later turn
`onDisableMove` removes the other moves from the request, so the chosen move already equals the encored
one. **A fast Encore into a slower foe is the whole of the reachable set, and it is common.**

**THE PRECEDENT IS IN THIS FILE.** `WIRE 119 — "TAUNT AT EXECUTION TIME"` gave Taunt BOTH halves: a
menu filter in `chooseAction` and a second check in the dispatch loop for the mid-turn case. **Encore
only ever got the first half.**

**TWO HALVES ARE NEEDED** and the row stays red after either alone:
  1. Re-evaluate the lock in the per-action dispatch loop, ABOVE the confusion / paralysis / recharge /
     Throat Chop / Taunt gates — those are `BeforeMove` handlers and `OverrideAction` fires first.
     `_selMv` STAYS at collection time; the priority-bracket fix depends on it.
  2. `targetForMove` picks the **highest-damage** live foe; Showdown's `getRandomTarget` picks a
     **uniformly random** adjacent one. Different functions.

**RULED OUT, measured:** not damage (Torterra's identical unencored Dragon Claw deals 39 in BOTH
engines), not the volatile or its counter, not `targetForMove` mis-aiming (that code never executed),
not the fixture (control agrees leaf-for-leaf), not the harness (it reproduced the published verdict
and HP values exactly).

**INCIDENTAL, reported not acted on:** we emit no `|-fail|` for the turn-1 Encore that correctly
refuses. Boards agree so the state comparator is silent, but the PROTOCOL arm of
`game_differential.js` would see it.

---

## DECISIONS TAKEN BY WILL DURING THE SPRINT — record, not recollection

**THE SITE IS A VISUALISATION, NOT A CONSTRAINT.** *"the website really was just for fun and for me to
visualize all the progress on the project, now that we have an outline im more concerned about speed
and functionality."* This REVERSES a standing assumption — that ABRA WORLD needing to run the real
engine live is a design constraint on `medicham2-browser.js`. It is not. Speed and functionality win.

**THE BROWSER WRAPPER STAYS, FOR NOW.** *"so can we get medicham up to full functionality without
changing the browser"* — yes, and measured: every row closed tonight was fixed INSIDE the wrapper.
The 22 remaining move rows are tag derivations, consumers and branch logic; none needs
`module.exports`. Full gate green does not require touching it.

*What the wrapper actually costs, so the decision is revisited on evidence rather than feel:*
  - **ROADMAP #114 is caused by it** — `root.MEDI_SPREAD` instead of `module.exports`, a symbol that
    never existed on any build, so every spread move was priced as single-target. That is a ONE-LINE
    export fix, not a conversion.
  - `MC` is a global rather than an import, which is why a frozen release is **23 files** instead of a
    module graph.
  - Every artifact read is dual-pathed with a **silent-degradation branch** for the browser, and
    silent degradation is this project's signature failure mode.
  - Measured: exactly ONE page actually loads the engine — `web/tower.html`. `index`, `models` and
    `app/index` mention it in prose with no script tag. The cost is paid for one page.

*Revisit in September alongside the regulation change, when releases are being re-cut anyway. Doing it
mid-sprint would invalidate every frozen release and every probe's setup, and destroy the one thing
that has made this sprint work: being able to attribute a regression to a single change.*

**AND REMOVING IT WOULD NOT MAKE ANYTHING FASTER.** The UMD closure costs nothing at runtime. If speed
is the goal the two right items are already filed and neither has been started: **#61** (*"MEDICHAM is
half the speed the project thinks it is, and nothing watches"*) and **#76** (*"SPEED IS A BUDGET, NOT A
VIBE"*). There is no benchmark, so every speed claim in this repo is currently a vibe.

---

## THE boosts-target SIX — ONE CLOSED, THREE DIAGNOSED, TWO WERE NEVER BROKEN

I expected one shared cause across six rows. **There were two causes and they split the group
differently than the verdicts did** — measuring first is what stopped a wrong fix.

### CLOSED — Toxic Thread (6 uses): a status move that ALSO changes a stat

`playerAction` routed anything with `fx.status` to `kind:'status'`, which applies the status and
nothing else. Toxic Thread poisons AND drops Speed by two, and measured in a real turn **it did
neither** — because `affect`, six lines further down, is the branch that carries `sc` and `si`
together, and the status line got there first. The guard is now narrow: a status move with no stat
change still takes the shorter path.

Verified both halves land and no pure-status move regressed:

```
  toxicthread  status psn   spe -2      <- was: neither
  thunderwave  status par   spe  0
  willowisp    status brn   spe  0
  toxic        status tox   spe  0
  spore        status slp   spe  0
```

**Roster moves 23 -> 22 differ / 362 -> 363 match. Exactly one verdict changed.**

### CLOSED — spread STATUS moves reached only ONE foe (3 rows). Diagnosed 2026-08-10, fixed the same day.

Cotton Spore, String Shot and Sweet Scent are `allAdjacentFoes`. Measured before anything changed:

```
  cottonspore  foe0 sp=-2   foe1 sp= 0      <- both should move
  stringshot   foe0 sp=-2   foe1 sp= 0
  sweetscent   foe0 eva=-2  foe1 eva= 0
```

That is exactly why all three read DID-NOT-FIRE: the roster's SECOND body never moves, so the delta
against the control arm is empty and a HALF-wired move produces the same receipt as an unwired one.

**THE FIX IS A LOOP, AND THE GATES INSIDE IT ARE UNTOUCHED.** The `affect` branch resolved one `_t`;
it now builds a target LIST off the tag — `spreadFoes` (both foes, ally safe) and `spreadAll` (the
partner too, and FIRST, which is Showdown's own `adjacentAllies()`-before-`adjacentFoes()` order) —
and runs the existing ~100-line gauntlet per body. Not one gate was removed or reordered; their
`continue`s now end that BODY's pass instead of the whole move, which for a single-target click is no
change at all because the loop runs exactly once. What stays once per move: `m._lastMove`, the
`mvFail` for a move that found nobody, a user-directed `si` effect (Showdown's own `move.selfDropped`
exists for that), and `userFaints` — Memento's user dies once, now gated on a `_landed` count instead
of on straight-line flow.

**THE SINGLE-TARGET CONTROL IS THE WHOLE RISK AND IT WAS MEASURED AS A DIFF, NOT ASSERTED.** 22
single-target status moves were run through a real turn against the pre-change engine and the
post-change engine, printing every stat stage, status and volatile of all three non-acting bodies.
The two runs differ on **exactly the four spread moves and nothing else**:

```
  thunderwave willowisp toxic spore charm faketears growl leer screech tickle scaryface
  confuseray taunt encore strengthsap memento partingshot nuzzle glare sleeppowder
  stunspore poisonpowder                                    <- byte-identical, before vs after

  cottonspore  ally UNCHANGED   foe0 sp -2    foe1 sp -2     <- was foe1 UNCHANGED
  stringshot   ally UNCHANGED   foe0 sp -2    foe1 sp -2     <- was foe1 UNCHANGED
  sweetscent   ally UNCHANGED   foe0 eva -2   foe1 eva -2    <- was foe1 UNCHANGED
  teeterdance  ally confusion   foe0 confusion foe1 confusion <- was ally + foe1 UNCHANGED
```

**A FOURTH MOVE CAME WITH IT AND IT IS NOT ONE OF THE THREE ROWS.** Teeter Dance is `allAdjacent` and
so is the `spreadAll` member of this branch; it confused slot 0 only. Membership was printed over the
whole move table before the loop was written: `spreadFoes` reaches `affect` as cottonspore, stringshot
and sweetscent; `spreadAll` as teeterdance alone. Corrosive Gas is `allAdjacent` too and `playerAction`
classifies it `trickitem`, so it never arrives here — named rather than left to be rediscovered.

**A SECOND CONSEQUENCE, NOT LOOKED FOR.** A driver reading Showdown's request is handed **no target**
for `allAdjacentFoes`, so `tgtSlot` was -1, `reaimToSlot` returned null and the branch took `mvFail` —
the whole turn spent doing nothing:

```
  BEFORE: targetless cottonspore -> foe0 0   foe1 0
  AFTER:  targetless cottonspore -> foe0 -2  foe1 -2
```

Same shape as ROADMAP #81 WIRE 9, which closed this for the DAMAGING half of the family and never
touched the status half.

Census **330 → 333 live, 0 missing, 0 threw**, on three new probes.

### NEVER BROKEN — Flatter and Swagger

Both apply the foe's boost correctly in a real turn (+1 SpA, +2 Atk). An early probe of mine reported
them boosting the ALLY; that probe had not set the side stamp, so `_isFoe` was false. Probe artifact,
not a defect — the fifth of the day.

---

## ENCORE — THREE FINDINGS, ALL FROM WILL, TWO OF THEM ENGINE FIXES

*(Will, 2026-08-10: "we need to fix encore", then "there are some crazy encore shenanigans".)*

**Encore itself was never broken.** The row is FIRED-AND-BOARDS-DIFFER, not DID-NOT-FIRE, and there is
**no `vol.encore` disagreement at all** — only HP. Verified directly: handed Dragon Claw on turns 3 and
4, the encored body used **Dragon Pulse** both times; it FAILS on turn 1 against a body with no last
move (Will's switch-in case); duration is 3, matching Showdown.

*My first probe said the lock was broken and the probe was wrong* — I clicked Encore once, on the turn
it cannot land. Fourth broken probe of the day.

### 1. ENCORE INTO GIGATON HAMMER LEAVES YOU WITH STRUGGLE — measured, not inferred

`medicham2` carried this as an explicit **unmeasured inference**: *"The code implies every move ends up
disabled and the Pokemon Struggles. That is an inference from reading two handlers, NOT something
measured, and it is flagged here as needing a live test rather than stated as fact."*

Now measured against the authority:

```
turn 1  Tinkaton uses Gigaton Hammer.  Oranguru Encores it.
        Tinkaton may select: Struggle          <- every move gone
turn 3  Tinkaton STRUGGLES.  Encore expires.
```

The inference was **correct**. Will's counter-hypothesis — that `cantusetwice` only blocks SELECTION so
an Encore would let it hammer twice — does not hold: the authority has **both** guards, `battle.js`
disables it for selection and `battle-actions.js` catches it again at execution. 249 uses.

*(The first attempt at this was contaminated: Gengar has CURSED BODY, which disabled the Hammer on
contact. The finding would have been the fixture's. Same shape as the Thick Fat lesson.)*

### 2. THE PRIORITY BRACKET BELONGS TO THE MOVE YOU SELECTED — **ENGINE FIX**

Will: *"if you use a prio move but get encored into something you still get prio on it ... its obscure
look it up."* He is right, and `sim/battle-actions.js` is explicit:

```js
let baseMove = this.dex.getActiveMove(moveOrMoveName);
const priority = baseMove.priority;             // <-- read from the SELECTED move
const pranksterBoosted = baseMove.pranksterBoosted;
if (baseMove.id !== "struggle" && ...) {
  const changedMove = this.battle.runEvent("OverrideAction", ...);   // <-- Encore swaps HERE
  if (changedMove && changedMove !== true) baseMove = ...changedMove;
}
```

Priority is captured **one line before** the override may run. So an Encored body moves in the bracket
of what its player picked and executes what Encore forces — and `pranksterBoosted` is captured on the
same line, so a Prankster boost carries too.

**This engine had it backwards.** `_pri` was computed from `acts` AFTER the WIRE 24 lock rewrite, so the
LOCK decided the bracket. WIRE 118's comment claimed the bracket is frozen *"exactly as Showdown
resolves an action's priority when it is queued"* — true for every action except a locked one, and
false precisely there. `_selMv` now carries the pre-override choice and `actionPriority` reads it.

**Shown red on the frozen pre-fix release:**

```
  PRE-FIX  9c04f767ba8c   gengarLost = 0    <- died before acting: took the LOCKED bracket
  POST-FIX live tree      gengarLost = 70   <- kept Quick Attack's +1, got the forced move off
```

### 3. THE `failencore` SET — 6,221 uses Encore cannot lock

Encore, Copycat, Sleep Talk, Transform, +1. Not yet checked against our engine.

### AND THE ROW STILL DOES NOT MOVE

Roster moves unchanged at 23 differ / 24 did-not-fire. Both fixes above are real and independently
verified; **neither closes the Encore row**, because the roster's scenario has both sides clicking the
same neutral 0-priority move — there is no bracket mismatch in it to exercise. The residual is still
the 106/36 versus 161/0 damage split, still undiagnosed, and still not guessed at.

---

## OPEN — WORK DONE, ROW NOT CLOSED

**THE RETALIATION FAMILY (Counter, Mirror Coat, Metal Burst, Comeuppance — 16 uses).** The engine
change is real, complete and MEASURED CORRECT; the roster verdict did not move and I do not yet know
why. Recorded as-is rather than reported as a fix.

*What landed, in four layers:*
- `tag_dex`: the `fixedDamage` tag now carries `retaliates`, `mult` and `category`, derived from the
  condition — x2 physical for Counter, x2 special for Mirror Coat, x1.5 any for Metal Burst and
  Comeuppance. It carried none of those before, which is why `dmgRange`'s own comment could say the
  moves were "one branch away" and still not build the branch: there was nothing to multiply by.
- `medicham2`: `_took` records the LAST qualifying hit per category on the body, beside `_hitBy`.
  Last, not sum — Showdown OVERWRITES `effectState.damage` on each hit and `getLastDamagedBy` is
  singular, so two Rock Slides leave Counter reading the second one.
- `dmgRange`: the branch, plus an explicit `return 0` when nothing qualifies. That return matters —
  falling through runs the ordinary formula at base power 0, which floors at **1**, and Mirror Coat
  after a physical hit read 1 instead of 0.
- `hasPower`: **an exclusion that had EXPIRED.** It deliberately rejected these four, with a comment
  that was correct when written — *"Counter and Mirror Coat need turn state and would otherwise be
  admitted here only to return zero one branch later."* True while the turn state did not exist. It
  does now, and leaving the gate alone made the new branch UNREACHABLE. Same shape this project keeps
  hitting: a guard written against a real limitation, kept past the limitation.

*Verified by direct measurement:*

```
  counter     took {phys:95}  -> 190   (2 x 95)          ok
  mirrorcoat  took {phys:95}  ->   0   (no special hit)  ok
  mirrorcoat  took {spec:80}  -> 160   (2 x 80)          ok
  metalburst  took {phys:95}  -> 142   (1.5 x 95)        ok
  comeuppance took {spec:80}  -> 120   (1.5 x 80)        ok
  counter     took nothing    ->   0                     ok

  and in a real turn: Kangaskhan Body Slams for 86, Counter answers for 172.
```

*What is NOT resolved:* the roster still reads DID-NOT-FIRE for all three of its rows. Showdown deals
70 in that scenario and we deal 0. The engine demonstrably does the right thing when hand-staged, so
the gap is in how the roster's script and ours line up on that particular turn — **not diagnosed, not
guessed at.** Next step is to dump the roster's own script for the row rather than reconstruct it.

*A harness of mine was wrong on the way, and it wasted time:* a two-turn probe reported 0 damage and
sent me hunting the engine, when a clean single-turn probe of the same mechanic reported the correct
172. The probe was broken, not the engine — `docs/LESSONS.md` §5, for the third time today.

---

## FINDINGS THAT ARE NOT FIXES

- **THE CLOSET IS NEW MACHINERY AND NEEDS WRITING UP.** `DECLARED` quietens a *difference*; it cannot
  shelve an *absence*, which is what DID-NOT-FIRE is. `DEFERRED` in `tests/roster.js` shelves an ENTITY
  by name, with the owner's quote and the date. A deferred row is **still staged, still played against
  the authority, and still printed every run** — it just stops holding the gate. Deleting the entity
  instead would have made the shelf invisible. **And the shelf is checked:** if the row would now pass
  on its own, `would_pass_now` fires and `engine/quarantine.js` FAILS the stage with *"take the shelf
  down"*. Same discipline as the DECLARED staleness check that once retracted its own author's
  declaration.
- **THREE MORE NAME-HARDCODES OF THE SAME SHAPE, filed and not fixed.** `passiveHeal` matches
  `name === 'leftovers'`; `blocksSecondary` and `blocksPowder` match Covert Cloak and Safety Goggles,
  **both banned in this format**. Same defect as `speedMult` and `statMult` — a producer that can only
  name one member.
- **Three Fling facts checked at Will's prompt and all three were already correct**, so none is queue
  work: Light Ball flings for **paralysis**, Iron Ball for 130 BP and **no flinch**, King's Rock for
  **flinch** (96 uses, the only legal item here whose Fling carries a volatile).

---

## STANDING CAVEAT ON EVERY "USES" FIGURE BELOW

ROADMAP #70. Measured 2026-08-10 on Iron Ball: `tags.json` says 139, `g.sheets` (populated on 1.7% of
sides) says 15, `g.sets` says 0. **The queue is ORDERED by these numbers.** Every usage figure in this
file inherits that uncertainty and is quoted from `tags.json` unless stated otherwise.
