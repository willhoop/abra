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

**ITEMS CLAUSE CLOSED: 6 open → 0. The gate is now 3 of 4 PASS.**

```
PASS  game differential              0 of 150 disagree
PASS  deliberate roster / items      139 matched (1 deferred, still staged and printed)
PASS  deliberate roster / abilities  84 matched
FAIL  deliberate roster / moves      23 differ, 24 did-not-fire
```

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

### DIAGNOSED, NOT FIXED — spread STATUS moves reach only ONE foe (3 rows)

Cotton Spore, String Shot and Sweet Scent are `allAdjacentFoes`. Measured:

```
  cottonspore  foe0 sp=-2   foe1 sp= 0      <- both should move
  stringshot   foe0 sp=-2   foe1 sp= 0
  sweetscent   foe0 eva=-2  foe1 eva= 0
```

That is exactly why all three read DID-NOT-FIRE: the roster's SECOND body never moves. The `affect`
branch resolves a single `_t` and would need restructuring into a loop over the target list — a
change to a `100-line branch that I am not making this deep into a session. Filed with the
measurement so the next pass starts from evidence.

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
