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

### FIXED — WIRE 143, both halves, 2026-08-10

| # | row | uses | what it was | verdict move |
|---|---|---|---|---|
| 9 | **Encore** | 6,102 | the `onOverrideAction` half had never been wired. `mk()` reads `_lock` before the queue is sorted, and a mid-turn Encore is written after that — so on the ONE turn the override is reachable, `_lock` is still null. Half 2: the target is re-rolled UNIFORMLY (`getRandomTarget` → `side.randomFoe()` → `sample(foes())`), and `targetForMove` picks the hardest hit | FIRED-AND-BOARDS-DIFFER → **awaiting Will's roster re-run** |

Census **333 → 335 live, 335 probed, 0 missing, 0 threw**, on two new probes:
`an Encore landing MID-TURN overrides the action its victim already chose` and
`the encored move's target is RE-ROLLED, not aimed at the best foe`. Both shown RED first.

**THE ROW STAYS RED AFTER EITHER HALF ALONE, AND IT WAS SHOWN.** With half 1 landed and the target
taken from `targetForMove`, the census reads **334 live / 1 missing** — the re-roll probe goes red on
its own while the override probe stays green.

**THE BRACKET DID NOT MOVE, AND IT IS SAFE BY CONSTRUCTION.** `_pri` is frozen above the loop and
`turnOrderKey` reads it without recomputing, so `_selMv` stays a collection-time field and finding #2
above is untouched. Measured on the reachable case (Prankster Whimsicott 116 Encores a Garchomp 102
that clicked Quick Attack, Dragapult 142 behind them): Garchomp executes the ENCORED X-Scissor and
still moves before the 142, which is `baseMove.priority = priority` exactly.

**THE RE-ROLL TAKES THE ENGINE'S OWN SEEDED `rng`, NEVER `Math.random()`,** and draws only when an
override actually fires — so the differential and the roster draw the sequence they drew before.

**NOT CLAIMED: the roster verdict.** `tests/roster.js` was not run — it is Will's to run against a
frozen tree. The row's state is unknown, not closed.

**FOUND AND NOT FIXED:** an Encore into a **status** move still cannot be honoured through the WIRE 24
selection path, because `targetForMove` opens `if(!mv||!hasPower(mv))return null`. The new
execution-time path goes through `playerAction` and does not have that limitation, so the two paths
now disagree about status moves. It is a change to the Choice-lock rewrite that every Choice holder
rides, and it needs a probe of its own.

---

## THE LOCK-IN FIVE — WIRE 144, 2026-08-10. TWO CAUSES ON ONE ROW, AND ONE OF THEM IS NOT IN THIS DIVISION.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 10 | **Outrage, Petal Dance, Raging Fury, Thrash, Uproar** | 101 | TWO independent causes stacked on one `move/plain-attack` row, either of which alone produces the same silent nothing. (a) all five are `target: "randomNormal"`, the request names no target, and `playerAction`'s attack branch is gated on `&& target` — so the click degraded to `{kind:'pass'}`, a NO-OP TURN, both turns. (b) there was no lock at all: turn 2 was a free choice and the user never fatigued | DID-NOT-FIRE → **awaiting Will's roster re-run, AND SEE THE DRIVER CAVEAT BELOW** |

Census **335 → 342 live, 342 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.**
Seven new probes, **all seven shown RED first** by cutting the six new branches to `if(false&&…)`:
under the cut the census reads **335 live / 7 missing**, and each red for its own reason — the
targetless Outrage dealt **0** and aimed at `p1a` (itself), the die returned `p2a` at both rng values,
turn 2 played Dragon Claw, confusion read `[0,0]`, Outrage ran **1** turn and Uproar ran **1**, the
locked body switched out, and the Spore landed on a body an Uproar should have shielded.

### THE ROW MAY NOT MOVE, AND THAT IS NOT EVIDENCE ABOUT THE ENGINE

`engine/game_differential.js` — the driver `tests/roster.js` runs through — resolves a medicham target
from Showdown's target type and handles five kinds (`normal`, `any`, `adjacentFoe`, `adjacentAlly`,
`adjacentAllyOrSelf`). `randomNormal` matches none, so `foeSlot` stays null and
`M.playerAction(mon, 'outrage', null, field)` is called with no target. Diagnosed in parallel by
`@measure`; **deliberately not fixed here** — it is the shared instrument, it is outside ENGINE, and a
competing repair would collide. The same root cause covers Counter / Comeuppance / Metal Burst
(`target: "scripted"`), i.e. **8 of the 20 DID-NOT-FIRE rows**.

**The engine half is nonetheless real and is now correct:** a targetless `randomNormal` click lands,
which it did not before, so the driver repair and this wire are both required and neither is
sufficient.

### THE FELT NUMBER IS NOT THE INTERNAL COUNTER — HERE THEY ARE THREE DIFFERENT NUMBERS

`lockedmove` (`data/conditions.ts:253`) declares `duration: 2` and that is **not** how long it lasts:

| handler | line | what it does |
|---|---|---|
| `onStart` | `trueDuration = this.random(2, 4)` | 2 or 3 — **the real length** |
| `onRestart` | `if (trueDuration >= 2) duration = 2` | the 2 is a re-armable window, not a length |
| `onResidual` | `trueDuration--` | ticks with the turn, whatever the body did |
| `onAfterMove` | `if (duration === 1) removeVolatile(…)` | |
| `onEnd` | `if (trueDuration > 1) return; addVolatile('confusion')` | fatigue **only on a full run** |

So the forced-turn count equals `trueDuration`, and the declared `duration: 2` is a coincidence at the
low end of the range. `uproar` has no `trueDuration` at all: `duration: 3`, decremented in the residual
**of the turn it lands**, so it is three turns and there the declared number *is* the answer.

**THE CONVENTION USED, AND WHY: the MINIMUM of the range, 2.** Every arm in
`engine/game_differential.js` pins Showdown's RANGE form of `random` to the **bottom** (`return m;`),
so the authority draws 2 under measurement; medicham2's `rng` is a single scalar and a
`min + floor(rng()*span)` would read 3 under the top-corner arm and part from it. This is the identical
decision `CONFUSION_TURNS_MIN` already states. **It is corroborated rather than assumed:**
`data/roster.moves.json` recorded Showdown's own board on this exact staging *before a line was
written* — `p1.active[0].vol.confusion = 2` at **turn 2** — which is a 2-turn Outrage followed by a
fatigue counter of 2. The probe asserts that number.

### THE TAG OVER-MATCHED, AND IT WAS PRINTED BEFORE IT WAS WIRED

`m.self.volatileStatus && condition.onLockMove` catches **eleven** moves in this format, not five —
the six `mustrecharge` moves answer `onLockMove` too, because a recharge turn is also a locked menu.
The discriminator is mechanical, not a name: `mustrecharge` additionally carries an `onBeforeMove` that
announces `cant` and returns null — it **refuses** the action — where the lock-in family carries none
and lets the forced move run. Final membership, printed: `locksIntoMove` = the five exactly;
`randomTarget` = those five **plus Struggle**, which is right and is why it is a separate tag.

`data/tags.json` was regenerated and **diffed against its predecessor: 0 entities removed, 0 added, 6
changed** (the five plus Struggle). ROADMAP #65's hazard is gone — `tag_dex` reads `scope:'all'` — and
this run confirms it: Serene Grace, Tinted Lens, Curious Medicine, Steely Spirit and Leppa Berry are
all still present.

### WHAT THE FIVE NOW DO, AND EACH LINE IS THE AUTHORITY'S

- **A `randomNormal` click with no named target lands.** `playerAction` prices it against the
  hardest-hit foe (a valuation, not a decision — the same rule ROADMAP #81 WIRE 9 uses for spreads).
- **The target is re-rolled UNIFORMLY at execution, whatever the player named.** `sim/battle.ts:2461`
  gates the chosen-target branch off for randomNormal, so it always falls to `getRandomTarget` →
  `side.randomFoe()` → `sample(this.foes())`. Drawn from the engine's **own seeded `rng`** — the stream
  already threaded through the turn for accuracy, crit and damage — never `Math.random()`, and only
  when one of the six is actually executing. It does not double-draw over an Encore override, which has
  already applied the same rule.
- **Turn 2 repeats the move, binding a caller-supplied action** (the WIRE 24 rule).
- **A locked body is TRAPPED.** `Pokemon#getMoveRequestData` sets `this.trapped = true` the moment
  `getLockedMove()` answers. This is a **harder** lock than the Choice one, which deliberately leaves
  the switch legal — reading one off the other would have made switching out of an Outrage free.
- **The clock ticks in the residual, in the authority's own order:** decrement, then expiry, then the
  sleep clause. So a body flinched on its last locked turn still fatigues, and a body put to sleep with
  a turn still to run is *calmed* — `delete volatiles[…]`, not `removeVolatile`, so `onEnd` never runs
  and there is no confusion.
- **The lock leaves with the body**, with no fatigue (`clearVolatile`).
- **Uproar wakes every sleeper on the field, both sides**, including its own partner, and **refuses
  sleep while it runs**. Both read off handlers (`wakesSleepers`, `blocksSleep`), never off the name.

### FOUND AND DELIBERATELY NOT FIXED

- **Uproar's Throat Chop clause.** `uproar.onResidual` removes the volatile if the holder carries
  `throatchop`, and it also declines to lock after a Struggle. Neither is modelled. Uproar is 3 corpus
  uses and both need their own shape rule; stated rather than smuggled in.
- **Encore over a lock-in.** The WIRE 143 execution override would rewrite a locked action. In the
  authority a locked body's request offers one move and Encore's `OverrideAction` still runs, so the
  interaction is genuinely ambiguous. Not staged, not guessed at.
- **`tests/test-no-silent-failure.js` is RED, and it was red before this pass.** 20 NEW silent catch
  blocks against the 2026-08-06 baseline, in `champions_sim`, `diff_swarm`, `explain_divergence`,
  `leaf_engine_contrast`, `provenance`, `quarantine`, `tag_dex:332` (`partialTrapShape`), `roster` and
  `test-web-quarantine` — **none of them mine.** The one I did add was caught by it and made to speak
  before this was written, taking the count 21 → 20. Reported, not filed: it needs an owner.
- **`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is also pre-existing.** Measured
  rather than assumed: with all six WIRE 144 branches cut to `if(false&&…)` the eight changed digests
  are **bit-identical**, so this wire moves no fixture-board feature. It is a REFIT OWED and belongs to
  MEASURE.

### THE ARTIFACT REGENERATION HAD THREE SIDE-EFFECTS, EACH CHECKED

Regenerating `data/tags.json` re-reads the game store, which OPS appends to continuously
(`sheet_entries` 137,148 → 138,084 during this pass). That moves every usage count, and three prose
figures citing the artifact went stale — `tests/test-docs-current.js` **went red on it and was fixed
in this session, not filed**. Confirmed it was the cause rather than a coincidence by swapping the old
`tags.json` back in: 21/21 passed, and 20/1 with the new one.

- `docs/TAG-COVERAGE.md` — four usage figures re-read to today's artifact: `resistBerry` **13,232**,
  `passiveHeal` **8,495**, `blocksBerries` **2,326**, `punishesAttacker` **11,819**. Values only; the
  entity counts and the 3.40.0 snapshot table are untouched. **The superseded readings are deliberately
  NOT restated here** — quoting them beside the citation made the same check red a second time, which
  is the check doing exactly its job. They are in the file's own history.
- `docs/GAME-DIFFERENTIAL-DESIGN.md` — the *99%-of-usage coverage bar* sentence was split into its own
  paragraph. It states a THRESHOLD from `tests/test-medicham-coverage.js`, and standing in a block that
  cited `data/tags.json` made the check read it as a figure attributed to that artifact. The check was
  right about the attribution; the number was never wrong.
- `data/abra-tags.js` — the browser copy, rebuilt from `tags.json` by `build/build_tags_js.js`. It was
  **already one regeneration behind before this pass** (17:09 against 20:56) and now matches. Stated
  because it is a WEB-consumed artifact that this pass moved.

---

## WIRE 145 — A LOCK INTO A STATUS MOVE STRUGGLED. ONE GUARD, TWO CALL SITES, FAILING IN OPPOSITE
## DIRECTIONS. 2026-08-10.

Census **342 → 346 live, 346 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, all four shown RED on the unmodified tree first. Defect measured by the router before dispatch;
the fix and the probes are this pass. **No engine release cut and `tests/roster.js` not run** — a
read-only agent was mid-diagnosis and `engine_release.open()` with no id reads a POINTER, so a cut would
have swapped the release under a live measurement.

### THE ROW

`_lock` is honoured in three places. Locked into an ATTACK all three agreed. Locked into a STATUS move:

| where | locked into an attack | locked into a **status move** |
|---|---|---|
| `chooseAction` | correct | returned `{kind:'struggle'}` |
| `mk()` WIRE 24 forced action | correct | lock silently ignored, kept the caller's own click |
| WIRE 143 execution override | correct | correct |

**ONE CAUSE.** Both broken sites resolved the lock through `targetForMove`, which opens
`if(!mv||!hasPower(mv))return null` because its job is to **rank foes by damage**. All **175 legal
status moves in this format have base power 0**, so "this move cannot be used" and "this move has no
damage to rank" arrived at the two callers as the same null. A guard doing a job it was never scoped
for — the fourth instance of that shape this sprint.

**AND IT WAS WORSE THAN A NO-OP DAMAGE NUMBER.** `{kind:'struggle'}` matches **no branch** in the
dispatch loop (`if(a.kind!=='attack')continue`), so a status-locked body emitted no `|move|` line at
all and the whole turn vanished. Measured on the live tree before a line changed, both foes passing:

```
lock=knockoff   -> |move|p1a|knockoff|p2b    foe -22   <- normal
lock=taunt      -> (no line at all)          foe   0
lock=tailwind   -> (no line at all)          foe   0   twA still 0
lock=trickroom  -> (no line at all)          foe   0   tr  still 0
handed dragonclaw while locked into taunt -> |move|p1a|dragonclaw|p2a  foe -46   <- lock ignored
```

**WHY IT IS WORTH MORE THAN A GATE ROW** (Will's framing, and it is the correct one): Encore exists to
lock a body into a move that is **useless when repeated** — Protect, Trick Room, Tailwind, a Taunt
already landed. The victim is supposed to burn turns. This engine handed it a fresh attack instead, so
Encore was not mis-simulated, it was **INVERTED**: clicking it *helped* the victim, and anything fitted
against that learns Encore is bad.

### THE FIX IS A RE-ROUTE AND IT IS KEPT THAT SIZE

`lockedAction(me,id,live,field,rng)` — one function, called by both broken sites.

- **The attack path is byte-for-byte unchanged.** `hasPower` is asked *here*, as a classification, and a
  damaging lock still goes to `targetForMove` (best foe by damage) and draws no rng. The Choice holders
  that ride that line every turn are the control this fix must not move, and they do not move.
- **The status path builds through `playerAction`** — the same builder a normal click uses, which
  already returns `{kind:'affect', mv:'taunt'}` correctly and always did. The lock simply never called it.
- **The repeat semantics were already correct and were not rebuilt.** Trick Room's second click ends the
  room; Tailwind's counter ticks rather than refreshing. The only broken thing was that the locked move
  never reached them.

**WHAT DOES A LOCKED STATUS MOVE TARGET? A uniform draw over the LIVING foes, from the engine's own
seeded `rng`.** Stated explicitly because it is a decision: (1) it is the rule this file already
implements twice — `chooseAction`'s Encore branch and WIRE 143's `getRandomTarget` re-roll — so this is
a **third caller of one rule, not a third rule**; (2) the ranker cannot answer, a status move having no
damage to rank; (3) `Math.random()` is never reached and the draw happens **only when a status lock
resolves**, which before this wire never happened — so every existing seeded probe, the differential and
the roster draw the identical sequence they drew before.

**ONE MORE CHANGE, AND IT IS DELIBERATE.** The WIRE 24 skip test was
`!(_a.kind==='attack'&&_a.move.id===mon._lock)` and is now `actionMoveId(_a)!==mon._lock`. A status
action carries its id in `mv`, not `move.id`, so the old shape could not see that a handed action was
*already* the locked move and would rebuild it and draw a die for nothing. Side effect, checked rather
than discovered later: a body Choice-locked into **Pollen Puff** and handed an ally-aimed `allyheal` now
keeps the ally aim instead of being re-pointed at a foe, which is what the authority allows.

### THE FOUR PROBES, ALL SHOWN RED FIRST

| tag | what it proves | its control |
|---|---|---|
| `sealsMoves` | a lock into a status move PLAYS it, not Struggle (`chooseAction`, nothing handed in) | a lock into **Knock Off** on the same board — and a third arm, the identical Taunt hand-clicked with **no lock**, so a red can never mean "this engine cannot Taunt" |
| `choiceLock` | the lock binds a **caller-supplied** action into a status move (`mk()`) | Dragon Claw handed in on every arm; a Knock Off lock rewrites it, and with no lock at all it stays Dragon Claw |
| `locksTarget` | **the payoff** — locked into Trick Room the victim re-clicks it and the room it just set comes **DOWN** | the identical two clicks (Trick Room, then Dragon Claw) with the lock absent: the room stands, tr 4 → 3, and the Dragon Claw lands |
| `sealsMoves` | the target is a uniform die | the same lock, only the seeded rng varied — 0.1 → p2a, 0.9 → p2b. Guard: an ordinary hand-clicked Taunt named at p2a hits p2a at **both** values, so nothing else was re-aimed |

Red readings before the fix: `NONE` / `dragonclaw` / `dragonclaw`+tr 3 / `NONE` at both die values.

### COUNTERS

`MEDSEEN.lockedIntoStatusMove` (fires; reads exactly 2 after two staged status locks, 0 after an attack
lock and 0 with no lock) and `MEDFAILS.lockStatusUnbuilt`, which exists because a lock into a status
move this engine has no branch for still SPENDS the turn — a body cannot escape a lock by holding an
unmodelled move — and "the mechanic ran" must not arrive at the same counter as "the mechanic ran into
something we do not model".

### FOUND AND DELIBERATELY NOT FIXED — reported, not absorbed

- **STRUGGLE IS NOT IMPLEMENTED AT ALL, and the earlier reading of "Struggle does no recoil" is a
  correction rather than a confirmation.** Measured with `{kind:'struggle'}` handed straight to the
  acting body, both foes passing: **0 to the foe, 0 to the user, and no `|move|` line** — the whole turn
  is `|turn|1` `|upkeep`. There is no `a.kind==='struggle'` branch anywhere; all three sites that return
  it (no living foes, the lock fallback, the chooser's final fallback) produce a silent no-op turn.
  Showdown's Struggle is typeless 50 BP physical, never misses, ignores type immunity, hits a random
  adjacent foe and costs the USER 1/4 of max HP (270 on the probe body). That is a family — a new action
  kind, a typeless damage path and a recoil that is a fraction of MAX HP rather than of damage dealt —
  plus the selection rule (every move out of PP) which this engine has no PP to express. Not fixed
  inside a re-route.
- **THE CHOICE LOCK STILL DOES NOT ARM ON A STATUS MOVE, and this re-route does not close it.** Measured
  on a Choice Scarf holder: `knockoff` → `_lock=knockoff, _lockT=Infinity`; `taunt`, `tailwind`,
  `trickroom`, `swordsdance` → `_lock=undefined`. The arming line sits **below**
  `if(a.kind!=='attack')continue`, so only attacks reach it. This wire honours a lock that exists; it
  does not arm one. Closing it needs a single "the move was committed" site shared by the ~30 status
  kinds — otherwise it is 30 copies of one fact, which is the shape CLAUDE.md forbids. **Its own wire,
  with its own probe.** Choice Scarf is legal here and Scarf+Trick is a real set, so the holder is
  currently free to switch moves after a status click. **A usage figure is deliberately not quoted
  here** — the brief that dispatched this row carried one the store had already moved past, which is the
  standing caveat at the foot of this file; read the live figure out of the tag artifact instead.
- **THIRTEEN MOVES EXECUTE AND NEVER RECORD `_lastMove` — measured over the whole 500-move table, not
  grepped.** Every kind was clicked through a real turn and checked for the record:

  ```
  heal       8/8   lifedew, moonlight, morningsun, recover, roost (+3)
  switch     2/2   chillyreception, partingshot
  tail       1/1   tailwind
  trickroom  1/1   trickroom
  wideguard  1/1   wideguard
  ...and 27 other kinds record it on all 500 (attack 324, affect 39, setup 22, status 14, ...)
  ```

  **CONSEQUENCE, AND IT IS THE REASON THIS IS FILED LOUDLY:** `volNeedsLastMove` correctly refuses
  Encore and Disable against a target that has never moved, so **Encore can never lock a body into Trick
  Room, Tailwind, Wide Guard or a recovery move** — which is most of the list Encore exists to punish.
  The Trick Room payoff proved above is therefore reachable today only through a lock that is set
  directly (which is what both of the engine's own writers do), not through a live Encore. Five one-line
  writes would close it, but they are read by Instruct as well as by Encore and Disable, so it gets its
  own wire and its own probe rather than riding in on this one.
- **`tests/test-no-silent-failure.js` is RED and was red before this pass** — the same **20** new silent
  catch blocks against the 2026-08-06 baseline that WIRE 144 recorded, **none of them mine**; the one
  `catch` this wire adds increments `MEDFAILS.lockStatusUnbuilt` and the count did not move. Reported,
  not filed.
- **`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is pre-existing and is not this
  wire.** Proved rather than assumed, the same way WIRE 143 proved it: both new counters read **0** after
  `engine/feature_fixture.js` builds and hashes every fixture feature, so neither branch executes on that
  board. REFIT OWED, and it belongs to MEASURE.

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
