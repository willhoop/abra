# MEDICHAM SPRINT — running notes

**Version 3.98.0 · 2026-08-10**

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
| 9 | **Guard Swap, Power Swap, Psych Up, Topsy-Turvy, Acupressure** (WIRE 151) | 99 | all five resolved to `{kind:'pass'}` — a whole no-op turn — because both doors out of `statChangeInCode` demand a LITERAL boost table and all five carry `{procedural:true}`. Belly Drum and Strength Sap, the only two members WITH `boosts`+`on`, were the only two that worked. Fixed at the DERIVATION: `statChangeInCode` gained an **`op` descriptor beside `boosts`, never inside it** (`exchange` / `copy` / `invert` / `randomOne`, each with its stat subset), read out of each handler's own shape; one engine primitive `applyStatOp` consumes all four. `data/tags.json` + `data/abra-tags.js` regenerated: **0 entities removed, 0 added, 5 changed**. **Roster not re-run by me** | DID-NOT-FIRE → *awaiting the roster re-run* |

Census, out of `data/mechanics-census.json`: **364 live, 364 probed, 0 missing, 0 threw, 0 hollow,
0 unarmed, 0 directCall**. The before-state, the damage-stage gate and every other figure for this row
are in `docs/ENGINE.md`'s WIRE 151 section, each beside the measurement it came from.

**WIRE 151, the parts a one-line row cannot carry** (full section in `docs/ENGINE.md`):
- the first `randomOne` shape rule **over-matched** — a bare `this.sample(` claimed Sleep Talk,
  Metronome, Assist and Conversion 2, which pick a MOVE. Tightened to require a `.boosts[…] < N`
  ceiling AND a `this.boost(` call; final membership over 954 moves is six, the fifth being Heart Swap
  (`isNonstandard: 'Past'`, unplayable here). Printed before wiring, per docs/LESSONS.md 4;
- **two stale comments retracted in place with measurements**, both claiming evasion is *"a stat this
  engine has no slot for"*: a real Defog click moves the target's `eva` 0 → −1, and a Supersweet Syrup
  switch-in puts BOTH foes at `eva` −1. All seven slots exist. It matters — Psych Up copies accuracy
  and evasion, Topsy-Turvy inverts them, Acupressure can draw them;
- **one pre-existing defect fixed because this wire would have extended it**: the `affect` branch's
  Protect gate was a bare `if(_t.protect)` with no `ignoresProtect` clause, so it also blocked
  **Tearful Look**, which goes straight through a Protect in the authority. Measured before/after with
  Charm as the control (still blocked, correctly);
- blast radius: every move in `data/tags.json` × 6 scenarios × 2 real turns, whole-board digest —
  **879,848 cells, 126 differ, 5 moves, 0 THREW on both arms**. The throw count is printed beside the
  diff count because WIRE 150's first sweep read "0 differ" over 3,000 cells that had all thrown;
- **a release was cut that I did not intend**: `tests/test-nature-differential.js` requires
  `engine/game_differential.js`, whose line 126 auto-cuts when `REL_ID` is unpinned. Release
  `ea58415e1cd8` was cut over the mid-work tree and `data/engine-release.json`'s `current` moved from
  `cb831e50eafb`. **Left exactly as written, nothing reverted or deleted** — see ENGINE.md.

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

## WIRE 147 — THE DAMAGE WAS ONE ROLL MULTIPLIED BY N. FOUR ROWS, ONE ROOT CAUSE, TWO OF THEM 2x. 2026-08-10.

Census **350 → 354 live, 354 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Four new
probes, each watched RED on its own before a line of the engine changed. Damage stages **1728/1728
exact**, unchanged. **No release was cut and neither `tests/roster.js` nor `engine/game_differential.js`
was run** — `game_differential.js:126` AUTO-CUTS when no release is pinned, which would swap the
pointer under another agent's measurement; the pointer is still `f727f7fdee4f`, mtime unmoved.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 29 | **Triple Axel** | 753 | `basePowerCallback` is `20 * move.hit` — 20/40/60. We applied a flat 20 three times, so the move dealt **exactly half**: 8+8+8 = 24 against the authority's 8+16+23 = 47. The tag said `variablePower {computed:true, note:"idiom not yet derivable"}` and, because `MEDFAILS.variablePowerUnknown` is gated on a truthy `kind`, it was **not even counted** | *engine fixed; roster NOT re-run by me* |
| 30 | **Dragon Darts** | 126 | `smartTarget: true`. One packet cannot be aimed at two bodies, so both darts hit the aimed foe and the partner took **zero**: goodra −72 / torterra 0 against −36 / −34. `smartTarget` appeared in this engine only in two comments and in no tag at all | *engine fixed; roster NOT re-run by me* |
| 31 | **Beat Up** | 320 | `mvBP = _hits ? _sum : …` summed every ally's base power into ONE packet. The formula's `+2` is paid per packet, so four hits lost three of them: 24 against 28 | *engine fixed; roster NOT re-run by me* |
| 32 | **Fickle Beam** | 38 | `mvBP = floor(mvBP * (1 + p*(mult-1)))` — 80 × 1.3 = **104 base power, a number the move never has**. It is 80 or 160. Measured sd 42 / ours 54, and 42 × 1.3 = 54.6 | *engine fixed; roster NOT re-run by me* |

**IT IS THE 3.90.0 BUG IN A SECOND PLACE.** *"The multi-hit count was the MEAN, and the pin never lands
on a middle."* Fickle Beam is that sentence word for word in the conditional-power path, and the comment
above the line stated the averaging as a deliberate choice. The fix is the shape ROADMAP #103 already
chose for the hit count and not a second shape: `hit.condPower` arrives from the battle loop, drawn off
the same rng that draws the count, the damage index and the crit; a PURE call keeps the expectation,
because that is the right object for a price, and the two halves are counted separately
(`conditionalPowerRolled` / `conditionalPowerPriced`) so a run with games in it that never rolls one is
readable as the lost draw it would be.

### THE PRECONDITION IS A PER-HIT LOOP, AND IT IS ENTERED ONLY WHERE THE BASE POWER IS A FUNCTION OF THE HIT INDEX

`dmgRange` is now a wrapper over `dmgRangeOneHit`. `hitPlanOf` decides, **from the artifact**, whether a
move's base power depends on the hit number — today `variablePower {kind:'perHitEscalates'}` (Triple
Axel) and `variablePower {kind:'alliesBaseAtk', perAlly:true}` (Beat Up), and nothing else. Every other
move, **multi-hit included**, takes exactly one trip through `dmgRangeOneHit` with the identical `_hits`
scalar the old line multiplied by, so its arithmetic is byte-for-byte what it was. That is what "single-
hit damage is unchanged by construction" means here, and it is the reason the wire is safe to land in the
damage path at all.

**THE PINNED CORNER, STATED.** `min` is every hit at the 85% randomizer and `max` every hit at 100% —
exactly what a pin produces in the authority, which draws a randomizer per hit and gives every one of
them the same corner. **What this does NOT reproduce is the interior:** the battle loop still draws one
index across the summed range, so N independent mid-rolls are modelled as one. That is unchanged from
before this wire and it is a range-versus-sample question the loop owns, not the calculator.

**THE COUNT IS NOT RE-DERIVED AS A MEAN.** `hitPlanOf` takes `hit.hits` whenever a caller has drawn one,
and only falls back to `expectedHitsOf` for a price. The weight vector it builds for that price —
`P(at least hit h)`, so `[1, 0.9, 0.81]` for Triple Axel — **sums to exactly `expectedHitsOf`**, and the
sum is CHECKED rather than asserted in prose: `MEDFAILS.hitWeightsDisagree` fires if it ever does not
(0 over 1,500 real turns across the whole 500-move corpus). It can: `expectedHitsOf` discards the 2-5
mean for a move that also carries `multiAccuracy`, and no move in this format carries both.

### THE FOUR PROBES, ALL SHOWN RED INDIVIDUALLY FIRST

Each compares the move against **separate arms of itself at fixed base powers**, so the assertion is an
exact integer identity and nothing else in the turn has to be held equal.

| tag | what it proves | what it read RED |
|---|---|---|
| `variablePower` | Triple Axel equals `d(20) + d(40) + d(60)` and not `3 × d(20)` | flat 360 where escalating is 688 |
| `smartTarget` | one dart each — the aimed body takes exactly what a SINGLE dart does, the partner takes a second one, **and with the partner already fainted both go back into the aimed body** | `[132, 0]` where one dart is `[132, 0]` and the move must be `[132, 66]` |
| `variablePower` | four identical eligible allies deal **exactly 4×** what one does | 96 where four packets are 100 |
| `conditionalPower` | equals a flat 160 BP copy at the corner where `random(10)` draws 0 and a flat 80 BP copy where it draws 9 | `[320, 252]` — an averaged 1.3x lands between the two arms at BOTH corners |

The Triple Axel probe uses ONE corner and says why: at the top pin the move **misses outright**
(`|move|p1a: Weavile|Triple Axel|p2a: Garchomp|[miss]`, read out of the authority), so a two-corner probe
would be reading a miss and calling it a hit count.

### THE AUTHORITY WAS READ DIRECTLY, NOT INFERRED

A pinned `new Battle('gen9doublescustomgame')` for all four idioms at both corners. It confirms every
line of this wire: Triple Axel escalating, Dragon Darts writing `|-anim|` at the second dart with damage
on **both** bodies, Beat Up emitting **four separate `|-damage|` steps** and `|-hitcount| 4`, and Fickle
Beam printing `[anim] Fickle Beam All Out` + `|-activate|` at one corner and nothing at the other.

**AND THE FIRST VERSION OF THAT HARNESS WAS WRONG IN THE FLATTERING DIRECTION.** It overrode
`battle.random`, and `Battle#randomChance` calls `this.prng.randomChance(...)` **directly**
(sim/battle.ts:352) — so every chance event stayed unpinned and Fickle Beam appeared never to double at
either corner, which would have read as "the tag's `p` is wrong". The pin belongs on the PRNG.

### UNCHANGED BY CONSTRUCTION *AND* MEASURED

Every move in `data/tags.json` (500), four turns each — mid roll, both pin corners, and one with no
target — digested as the **whole board** (both sides' HP, status, boosts, item, ability, faint, sub,
volatiles, types, plus the full field). The "before" arm is the **frozen release `f727f7fdee4f`**, loaded
through `engine_release.open(id)` so it serves the pre-wire bytes; opening does not touch the pointer.

**2,000 cells. 11 differ. Four moves: `tripleaxel`, `dragondarts`, `beatup`, `ficklebeam`.** Nothing else
in the corpus moved by a single HP.

### COUNTERS, WITH A CONTROL

`perHitDamageLoop`, `perHitBasePower`, `smartTargetSplit`, `conditionalPowerRolled`,
`conditionalPowerPriced` — all **0** after a control turn of Dragon Claw and Rock Blast, all non-zero
after the four. `MEDFAILS.hitWeightsDisagree` 0 and `MEDFAILS.beatUpAllyNoBaseAtk` 0 over the whole
corpus. `MEDFAILS.variablePowerUnknown` reads 7, first `lashout:userStatsLoweredThisTurn` — pre-existing
and unrelated.

### TWO CORRECTIONS MADE BESIDE THE FOUR, BOTH STATED RATHER THAN ABSORBED

- **BEAT UP'S ELIGIBILITY FILTER WAS WRONG AND IS THE AUTHORITY'S NOW.** Showdown filters
  `ally === pokemon || !ally.fainted && !ally.status` — the `ally === pokemon` short-circuits, so **the
  user is always in the list**; a burned Weavile still throws its own punch. This engine applied the
  fainted and status tests to every member including the user. There were **three** copies of that
  filter (base power, hit count, reaction count) and they are now one function, `beatUpAllies`. No probe
  covers the statused-user case; it is reported here rather than claimed.
- **`tests/test-mechanics.js`'s `reactorPerHit` PROBE WAS GREEN ON A FALSEHOOD.** It asserted Weak Armor
  `-2 / +4` off Dragon Darts against a Milotic standing beside a **healthy partner**, and Showdown lands
  one dart there. The reaction count read the move's total while the damage step had already split. Both
  are fixed; the arm now stages **both** ways and reads the PARTNER's stages too, because "each body
  once" and "nobody at all" are otherwise the same number on the aimed body.
- **`multiAccuracy`'s probe needed a new denominator, not a new claim.** Its ratio compared Triple Axel's
  price against `3 × its first hit`; with the hits at 20/40/60 that reads ~4.98 and looks like a 66%
  OVERPRICE on a probe whose whole subject is a discount. It now compares against
  `d(20) + d(40) + d(60)`, where the 1 + p + p² discount shows as ×0.87.

### `data/tags.json` WAS REGENERATED, AND HERE IS THE DIFF

Two derivations were added to `engine/tag_dex.js` and the artifact regenerated. **A CONTROL
REGENERATION WAS RUN FIRST** with no changes at all: 0 entities removed, 0 added, **0 changed** — so
ROADMAP #65's blocker (the corpus had shrunk 29% and five entities dropped out) is **gone**, and this is
the measurement that says so rather than a decision that it felt safe.

Against the pre-session artifact: **0 entities removed, 0 added, three hundred and seven changed — and
all but two of those are the `uses` COUNT ONLY.** `data/tags.json`'s own `sheet_entries` field moved by about six hundred between the
control run and the real one: the ingest is live and appended sides while I worked, and the current
value is the one in the artifact rather than any number typed here. Nothing consumes `uses`. The
**two semantic changes are the two intended ones**, and the tag CATALOGUE gained exactly `move|smartTarget`:

```
moves dragondarts  tags ["multiHit"] -> ["multiHit","smartTarget"]
                   + smartTarget {splitsAcrossPartner:true, spreadReduced:false, hits:2}
moves tripleaxel   variablePower {computed:true, note:"idiom not yet derivable"}
                -> variablePower {kind:"perHitEscalates", per:20}
```

Membership for both was **measured over the format before the pattern was typed**: exactly three moves
in `data/moves.ts` read `move.hit` in a `basePowerCallback` and two (Fury Cutter, Triple Kick) are
`isNonstandard: 'Past'`; `smartTarget` is declared exactly once. Fury Cutter would not match the pattern
in any case — its escalation is a volatile multiplier and `move.hit` appears only in its RESET test.
`data/abra-tags.js` was rebuilt from the same artifact.

### WHAT IS NOT CLOSED, SAID PLAINLY

- **A PURE PRICE FOR DRAGON DARTS STILL SAYS TWO HITS INTO THE AIMED BODY.** `dmgRange` is handed two
  bodies and cannot know a partner is standing there, so `playerAction`'s pre-computed `d`, `bestMoveVs`
  and every rollout leaf still price the move as 2 × 50 BP on the target and 0 on the partner. The TURN
  is right; the PRICE overstates the aimed body and understates the board. It is the same shape as the
  `auraBoost` finding (a fact that needs the field, not the pair) and it is filed, not hidden.
- **`|-hitcount|` IS STILL NOT EMITTED**, and its declaration in `engine/derive_protocol_events.js` was
  rewritten rather than left stale: the HP still moves once for the summed part of the family, so a count
  beside a single `-damage` would be an invented number. Dragon Darts would emit nothing there in any
  case — `if (move.multihit && typeof move.smartTarget !== 'boolean')` skips every smartTarget move.
- **NO ROSTER ROW IS CLAIMED CLOSED.** I did not run `tests/roster.js` and I did not run the differential.
  The four rows above say *engine fixed* and nothing more.

### TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S

`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is **unaffected by this wire, and this
time that is a measurement rather than a counter read**: the per-hit loop DOES execute during
`engine/feature_fixture.js`'s build (`perHitDamageLoop` 2, `perHitBasePower` 6), so the counter argument
WIRE 146 used would have been wrong here. A full sandbox of the frozen release's 23 files was built and
its fixture hashed against the live tree: **0 of 58 fixture features moved.** REFIT OWED, and it is
MEASURE's. `tests/test-no-silent-failure.js` is red at **21** new silent catches — the same 21 WIRE 146
reported, none in `engine/medicham2-browser.js`; this wire added no `catch` at all.

## WIRE 146 — `playerAction` IS A FIRST-MATCH CASCADE, SO A MOVE WITH TWO EFFECTS LOST ONE. 2026-08-10.

Census **346 → 350 live, 350 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call**, on four
new probes, each watched RED on its own before a line of the engine changed.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| 25 | **Chilly Reception** | 38 | `pivotStatus` claimed the click ~140 lines above the weather branch, so the sky was never set. Was `""/0`, is `snow/4` at the same boundary the authority reads `snow/4` | *engine fixed; roster NOT re-run by me* |
| 26 | **Swagger, Flatter** | 71, 0 | `boostsTarget` claimed the click and `boostally` applies a boost table and nothing else — the confusion never happened. **Routed** to `affect`, which applies both halves *and* throws Swagger's 85 accuracy die, asks Own Tempo, Safeguard, Substitute and Protect, and runs the boost through Contrary | *engine fixed; the roster's `vol.confusion` COUNTER may still differ — see below* |
| 27 | **Howl** | 50 | dex target is `allies` = `Pokemon#alliesAndSelf`, i.e. user AND partner. The branch resolved ONE body, so the click landed on `active[1]` and the user got nothing. Derived from the move's own target, not its name | *engine fixed; roster NOT re-run by me* |
| 28 | **No Retreat** | 90 | the `noretreat` volatile was never written. **HALF-FIXED, and the half that is missing is the one the roster row measures** — see below | *NOT CLOSED* |

**THE FIX IS THE SHAPE, NOT THE FIVE PAIRS.** `playerAction` now runs the cascade unchanged and then
COMPOSES: `KIND_APPLIES` states, in the vocabulary of EFFECTS, what each action kind actually applies,
and anything the move carries that its kind does not apply becomes a rider on the action, executed at
ONE site above the kind dispatch. Two effect classes have appliers (`weather`, `statusInflict`); a
third class arriving is **counted and named** (`MEDFAILS.composedEffectUnexpressed`, 0 over the whole
500-move corpus) rather than dropped.

**THE TABLE IS DELIBERATE AND THE DERIVED VERSION IS THE TRAP.** "The residual is every effect-bearing
tag the claiming branch did not read" over-matches *silently*: **Yawn** carries `delayedSleep` AND a
`statusInflict` volatile describing the same sleep, so a tag-subtraction rule writes a second
`_vol.yawn` on every Yawn in the format. Two tags, one effect. Membership was printed over all 500
moves before a rider ever executed — **five riders exist**: chillyreception (weather), noretreat,
minimize, charge (user volatile) and **shedtail**, whose substitute rider is refused inside
`applyMoveVolatile` because `grantSubstitute` owns that volatile. Its board digest is identical.

**TWO FACTS WERE EXTRACTED RATHER THAN COPIED**, because the rider needed a second caller and CLAUDE.md
forbids two implementations of one fact: `applyMoveVolatile` (the ~100 lines of Mental Herb, the
no-restart rule, Encore's lock and Disable's `_sealed`, lifted verbatim out of the `affect` branch —
the block was the last statement in that loop, so every `continue` is exactly a `return`) and
`applyMoveWeather` (the sky, the turns and the rocks, lifted out of the `weather` branch).

**UNCHANGED-BY-CONSTRUCTION, AND THEN MEASURED ANYWAY.** The attack path returns from the composer on
its first line. A single-effect move gets no `also` field, and the executor is gated on that field. The
proof is empirical as well: **all 500 moves in `data/tags.json`, three digests each** — the action
object, the whole board after a real turn with a target, and the same with NO target. After the
extraction alone: **byte-identical on all 1,500**. After the whole wire: **seven moves differ and they
are the seven named above** (plus shedtail's action object, board unchanged).

**WHAT IS NOT CLOSED, AND IT IS THE ROW WITH THE LOUDEST NUMBER.** No Retreat's roster row reads
`sd +1 / ours +2` on the SECOND click. That is a *second application*: Showdown's `onTry` returns false
against the mark and the whole move fails, boosts included. This wire writes the mark; it does **not**
add the veto, because **no artifact this engine reads carries it** — `data/tags.json` has
`boostsUser {readFrom:"m.self.boosts"}` and `statusInflict {volatile:"noretreat", to:"user"}`, and
neither says "fails if the user already has it". A blanket "a user-directed volatile refuses a repeat"
rule was **printed and rejected**: it catches `minimize` and `charge`, both of which Showdown lets you
re-click. The fix is a `tag_dex` derivation off `onTry`, and I did not regenerate `data/tags.json`
because another agent is running `tests/roster.js` and `engine/game_differential.js`, which read it —
that is the photograph rule, not a preference.

**AND THE CONFUSION COUNTER IS A PRE-EXISTING APPROXIMATION, NOT THIS WIRE'S.** `board_state.js`
compares `vol.confusion` as a NUMBER: ours is `CONFUSION_TURNS_MIN = 2` always, Showdown's is
`this.random(2,6)` decremented. So a Swagger/Flatter row can still read FIRED-AND-BOARDS-DIFFER on the
counter while the mechanic is live. That is `MEDSEEN.confusionMinDuration`, declared long before this
wire, and it is the same for Confuse Ray and Teeter Dance.

**`minimize` and `charge` are invisible to the roster either way** — `board_state.js` compares a fixed
list of eight volatiles and neither is on it. The census probes are the only evidence for them.

**TWO PRE-EXISTING REDS, MEASURED RATHER THAN ASSUMED TO BE SOMEBODY ELSE'S.**
`FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is unaffected: after
`engine/feature_fixture.js` builds and hashes every fixture feature, all four of this wire's counters
read **0**, so no branch it added executes on that board. REFIT OWED, and it is MEASURE's.
`tests/test-no-silent-failure.js` is red at **21** new silent catches against its baseline; **none is
in `engine/medicham2-browser.js` or `tests/test-mechanics.js`** — this wire added no `catch` at all,
and the 21st against WIRE 145's 20 is in `tests/roster.js`, which another agent is holding.

---

## ROADMAP #126 — QUICK GUARD BLOCKED NOTHING, AND THE TWO GUARDS CARRY BYTE-IDENTICAL TAGS. 2026-08-10.

Will: *"have quick guard block all prio moves and test it against some prio moves not that hard"*,
then *"its like armor tail"*. The second sentence is the diagnosis, and it turned a mechanic into a
wiring job.

### THE BOARD, MEASURED BEFORE ANYTHING WAS TOUCHED

A +1 priority attack into a defender, one source of refusal varied and nothing else, on the frozen
release. **Five of the six sources were already correct**, and all five already resolve through one
function (`priorityRefusedAbove`):

```
CONTROL  no guard          25   landed
Armor Tail                  0   REFUSED
Dazzling                    0   REFUSED
Queenly Majesty             0   REFUSED
Psychic Terrain             0   REFUSED
Wide Guard                 25   landed     <- CORRECT: it stops SPREAD, not priority
Quick Guard                25   LANDED     <- the only broken source
```

### THE CAUSE IS A NAME MATCH, WHICH IS THE THING THIS REPO FORBIDS

`quickguard` and `wideguard` carry **byte-identical tag lists** — `priority, neverMisses,
oneTurnGuard, statusCategory`. Three sites told them apart by spelling instead:

| site | what it said | what it cost |
|---|---|---|
| `playerActionPrimary` | `if(id==='wideguard')` | Quick Guard fell through the whole cascade to `{kind:'pass'}` — **927 corpus clicks bought a wasted turn** |
| `buildMon`'s usable filter | `id==='wideguard'` | a sheet's Quick Guard was **deleted from the body** before the turn loop saw it |
| the field | `wgA:false, wgB:false` | a boolean pair whose **NAME was the only record of what it guarded against** |

**`engine/tag_dex.js` DID NOT CHANGE AND DID NOT NEED TO.** `data/tags.json` has carried
`oneTurnGuard.blocks` — `"priority moves"` / `"spread moves"` — derived from each move's own
`condition.onTryHit` since the tag was written. Nothing read it. **`data/tags.json` and
`data/abra-tags.js` were NOT regenerated by this wire**, so there is no diff to report.

**MEMBERSHIP PRINTED BEFORE WIRING (LESSONS §4).** Exactly **two** of 500 moves carry `oneTurnGuard`
and they are these two; Crafty Shield and Mat Block are `isNonstandard: 'Past'` and absent from the
artifact entirely. `ignoresProtect` — the bypass rule — carries **14**: `afteryou block curse
decorate feint futuresight meanlook phantomforce psychup roleplay roar tearfullook transform
whirlwind`. All 14 genuinely lack `flags.protect` upstream, so all 14 genuinely bypass.

### THE AUTHORITY, CLAUSE BY CLAUSE (`data/moves.ts`, `quickguard.condition.onTryHit`)

- `if (move.priority <= 0.1) return;` — the **final** priority, so a Prankster-boosted status move
  (0 → +1) is refused and Quick Claw is not priority at all. The caller therefore adds the same
  `+_pk` Prankster term the ability bar already adds.
- `if (this.checkMoveBypassesProtect(...)) return;` — the move must carry `flags.protect`. Our
  `ignoresProtect` tag is derived from exactly that flag's absence, so it is the same test.
- `return this.NOT_FAIL;` — a blocked move is **not** a failed move, so `_mvRes` is left alone and
  Stomping Tantrum is not fed by a Quick Guard.

### WHERE IT LANDED, AND WHY THERE

Beside the ability bar at **WIRE 85's gate, above the kind dispatch** — because *"its like armor
tail"* is literally true: same question, same Prankster term, same side, same "only a move aimed at
the other side" scope. Putting it inside the attack branch would have missed every
Prankster-boosted status move, which is more than half of what Quick Guard is for.

It does **not** fold into `priorityRefusedAbove`'s return value, deliberately. That function answers
"above what priority is a move refused" as a single number over abilities and terrain; a side guard
has its own announcement and its own bypass rule, and folding it in would lose both. **Two sources,
one gate.**

Spread is **excluded at that gate on purpose** and handled per body downstream, because ROADMAP #81
WIRE 9 is the fix that made Wide Guard emit one `-activate` line per shielded body — answering the
spread case at a whole-action gate would collapse those two lines back into one.

### THE THREE PROBES, EACH SHOWN RED FIRST, EACH WITH A THIRD ARM

A two-arm probe here passes on an engine that makes **every** guard block **everything**, which is
the obvious wrong fix. So each carries a cross-control:

| probe | red → green | the third arm that stops the wrong fix |
|---|---|---|
| Quick Guard blocks a +1 priority move | Bullet Punch at the PARTNER: 28 → **0** | **Wide Guard on the same board still reads 28** |
| Quick Guard refuses a Prankster-boosted status move | Prankster Thunder Wave: `par` → **`none`** | the **same** Thunder Wave with **no Prankster** through the **same** Quick Guard still reads `par` |
| Feint goes through Quick Guard (`ignoresProtect`) | — | Bullet Punch behind the same guard reads **0** while Feint reads **29**, equal to its unguarded 29 |

**MY FIRST PROBE OF THIS WAS BROKEN AND IT IS THE INSTRUCTIVE PART.** It used **Sucker Punch**,
which fails unless the target is attacking — the defender was passing, so every arm **including the
control** read 0 and the board looked like universal refusal. The probes use an *unconditional*
priority move and **always print the control landing**.

**WIDE GUARD DID NOT REGRESS.** Both of its existing probes are green on the new code —
`ally took 92 without → 0 behind Wide Guard`, and `2 -activate lines, one per body, 0 damage`.

### COUNTERS

`MEDSEEN.sideGuardBlocked` — one counter for the whole family, because the guard that refused is
re-derived from the artifact and a per-name counter would put the forbidden name straight back.
Forced staging reads **2** (one Wide Guard block, one Quick Guard block).
`MEDFAILS.guardClassUnknown` — the artifact named a `blocks` class this engine has no predicate for.
**0**, and it is what stops a Crafty Shield arriving one day and quietly guarding nothing.

### FOUND AND DELIBERATELY NOT FIXED — reported, not absorbed

- **`chooseAction` STILL NAME-MATCHES `wideguard`, SO A ROLLOUT WILL NEVER CLICK QUICK GUARD.**
  Measured: 40 self-play games, 326 turns, bodies handed both guards — `sideGuardBlocked` **0**. The
  mechanic is live through `playerAction`, which is what the live bot, the differential and every
  probe use; the internal heuristic chooser cannot select it. Wiring it is a **play** change with no
  correctness probe available, so it is filed rather than smuggled in.
- **A SIDE GUARD DOES NOT FAIL WHEN ITS USER HOLDS THE LAST ACTION.** Both conditions carry
  `onTry() { return !!this.queue.willAct(); }`. WIRE 119 implements exactly this for `kind:'protect'`
  and has **never** implemented it for `kind:'wideguard'` — a pre-existing Wide Guard gap, not this
  wire's, and it needs its own failing probe.
- **THE STALL COUNTER, AND WHICH BEHAVIOUR WAS ASSUMED.** ROADMAP #59 says our tags collapse three
  protection-counter behaviours into two. The authority: a side guard **never** rolls a consecutive-use
  die (neither condition calls `runEvent('StallMove')`) but **does** `addVolatile('stall')`, which makes
  a *later Protect* fail. **Assumed here: the first half only** — consecutive Quick Guards do not roll,
  which matches the authority. The engine's pre-pass **resets** `tookProtectTurns` to 0 where the
  authority advances it; that line is left byte-identical, so this wire changes nothing about Protect.
- **WIDE GUARD DOES NOT STOP SPREAD *STATUS* MOVES.** The authority's condition has no category test
  — `if (move.target !== 'allAdjacent' && move.target !== 'allAdjacentFoes') return;` — so Cotton
  Spore and String Shot are blocked upstream and are not here, because the spread block sits inside
  the attack branch. The same derivation would close it. **Not taken on without its own failing probe.**
- **THE `ABRA_TAGS_OFF=1` CONTROL ARM NOW LOSES WIDE GUARD TOO.** The classifier asks the tag, and the
  OFF stub answers null for everything, so under that switch neither guard is built. That is the
  stated purpose of the switch — revert to pre-artifact behaviour — but it is a *change* to that arm
  and is named here rather than discovered later.

### ONE TEST WAS RE-AIMED, AND THE REASON IS THE FINDING

`tests/probe_red_demo.js` used **Quick Guard as its example of a `{kind:'pass'}` click** ("a move the
engine models NOTHING for"). Quick Guard is no longer one, so the reverted arm kept announcing it and
the demonstration stopped flipping. Re-aimed onto `psychup`, which that case already asserted beside
it. The Wide Guard reversal was re-anchored onto the rewritten lines; the CLAIM is unchanged.

**PRE-EXISTING REDS IN THAT FILE, MEASURED NOT ASSUMED: 5, and this wire added 0.** Two are STALE
reversals whose anchor (`let d=dmgRange(m,tg,mv,field,_spreadHit,isCrit);`) is **absent from release
snapshot `bfefdb697454` as well as from HEAD** — so they pre-date today. The other three
(`multiAccuracy` Triple Axel, `sealsMoves` Disable, `setsWeather` Sandstorm) contain no reference to
any guard. `tests/test-no-silent-failure.js` is red at 22 new silent catches; **none is in
`engine/medicham2-browser.js` or `tests/test-mechanics.js`** — this wire added no `catch` at all.

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

---

## WIRE 149 — THE CHOOSER CAN CLICK QUICK GUARD. 2026-08-10.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| — | **Quick Guard, in `chooseAction`** | 927 tag / **601 store** | WIRE 148 made the mechanic WORK through `playerAction` — the live bot, the differential and every probe. `chooseAction`, the heuristic chooser that drives every **rollout** and every self-play game, still matched `me.moves.includes('wideguard')` **by name**, so MILTANK could never imagine clicking it | not a roster row — **a PLAY change**, measured as a rate, not a correctness claim |

Will, 2026-08-10: *"its gotta be able to click it man"*.

**THIS IS NOT A CORRECTNESS CLAIM AND THE PROBE SAYS SO.** Nothing here compares the engine to
Showdown. The authority has no policy, so no probe can show that its player would have clicked Quick
Guard on a given turn. What is asserted is behaviour at a **rate**.

### RED, REPRODUCED BEFORE ANYTHING WAS TOUCHED

200 self-play games / 1,176 turns, every side-A body handed **both** guards, foes usage-weighted with
their own movesets: **Quick Guard 0 clicks, Wide Guard 270.** `tests/test-side-guard-chooser.js` run
against a temporarily restored HEAD chooser is **5 FAILED, Quick Guard 0 of 1,500 games**; the file
was restored and its SHA-256 verified identical afterwards.

### WHAT IS DERIVED, AND FROM WHAT — NO SECOND NAME IN A NAME LIST

| question | source |
|---|---|
| which moves are guards | `TAGS.has('move', id, 'oneTurnGuard')` — **exactly 2 of 500**, printed by the probe |
| what each one refuses | `oneTurnGuard.blocks` through **`GUARD_PRED`, the same table the turn loop refuses with**, so the chooser cannot come to believe a guard stops something execution lets through |
| how often it clicks | the guard's own `uses` off the tag record, scaled against the most-used member. Wide Guard is the max, so it keeps **0.35 exactly**; Quick Guard gets 0.35 × 927/3997 = **0.0812** |
| is it worth a turn | per class, in the same table (`worth`) — see below |

The threat scan is Wide Guard's own, generalised: `live.some(fo => fo.moves.some(…))` became "does a
**live** foe hold a move of the class I refuse". Reading `live` is what answers CLAUDE.md's Focus-Sash
caution — a foe whose only priority user has **fainted** is not on `live` and stops being a threat,
with no bookkeeping to go stale. **The move list of the body on the field IS the open sheet** where one
was set; no species prior and no `meta-usage.json` read.

### THE THREE FILTERS THAT STOP IT FIRING ON THREE BOARDS IN FOUR

Without them "a foe holds a priority move" is true of **99.3%** of usage-weighted foe pairs, because
**Protect is +4**. Each filter is taken from the execution path rather than invented:

- **aimed at the other side.** The execution gate is `a.target && _pf.indexOf(a.target)>=0`; at
  selection time there is no action, so the move's own `target` is asked instead. Of the **29** moves
  above +0.1 in this format, only **17** are foe-facing — the other 12 are Protect, Detect, Endure,
  King's Shield, Spiky Shield, Baneful Bunker, Ally Switch, Follow Me, Rage Powder, Helping Hand and
  the two guards. Base rate **99.3% → 50.5%**. Two target sets cover all 14 strings across 500 moves;
  a fifteenth is counted (`MEDFAILS.guardTargetClassUnknown`, **0**).
- **it cannot be used this turn.** Fake Out is the most-used priority move in the corpus (16,761) and
  is legal only on its user's entry turn. Routed through **one** predicate — the rule had three copies
  by name and this wire needed a fourth reader, so all four now call `firstTurnOnlyRefused`.
- **it would fail anyway.** `needsTargetToAttack` — Sucker Punch (9,178) and Upper Hand (89) fail
  unless the target attacks, and a body raising a guard is not attacking. Read off the **tag**.

### THE SITUATIONAL HALF, AND WHY IT IS PER CLASS

Knowing the foe HAS priority is necessary and nowhere near sufficient. `worth` lives in the same class
row as `test`, so a class cannot have one and not the other:

- **spread → `true`**, which is a statement of Wide Guard's CURRENT behaviour, not a claim that no test
  would improve it. Its click count is a baseline other measurements rest on; moving it here was
  refused deliberately.
- **priority → the threat must cost something**: it FINISHES a body on my side (`max roll >= curHP`,
  through `dmgRange`), or it carries **`flinches`**, which takes the turn away at any HP — Fake Out,
  and the entry-turn gate has already refused it if it cannot be used.

`live.length>1` is kept and applied to **both**, so the branch has no name in it and the Wide Guard arm
is untouched.

### WIDE GUARD DID NOT REGRESS, AND IT IS A SET COMPARISON RATHER THAN A PROMISE

Its trigger set through the new derivation against the old bare `SPREAD.has(id)`, over all 500 moves:
**0 lost, 0 gained.** Its rate is 0.35 to the bit. Its own two census probes are green, and
`tests/test-priority-block.js`, `test-engine-consistency`, `test-medicham`, `test-rollout-effects`,
`test-speed-multipliers` and `test-tag-wire` all pass.

### THE RATE — THE NUMBER THIS WIRE IS ACTUALLY JUDGED ON

Measured on `data/games.ladder.jsonl` -- every side of all 51,445 stored games:

```
HUMANS      Quick Guard   601 clicks     Wide Guard  6,460      ratio 0.093
TRIGGER     of the 482 sides that clicked Quick Guard, the OPPOSING side used one of the 17
            foe-facing priority moves in 63.3% of those games, against 37.5% over all sides -- 1.69x
```

One self-play run, 1,500 games, each body holding ONE guard assigned 50/50 and keeping three real
attacks (the turn count is printed by the probe and is not quoted here):

```
QUICK GUARD  48 clicks     WIDE GUARD  988 clicks     ratio 0.049
counters     sideGuardChosenVsPriority 50   sideGuardChosenVsSpread 998   sideGuardBlocked 308
```

**0.049 against a human 0.093 — roughly 2x CONSERVATIVE, and that is stated rather than tuned away.**
Nothing here was fitted to the target: the rate came out of the artifact and the situational half out
of the execution path. Moving it onto 0.093 would mean picking a constant to hit a number. The
direction is the safe one — CLAUDE.md's mega lesson is that a healthy counter at the wrong rate is
still a defect, and the failure it warns about is spamming.

**TWO ARTIFACTS DISAGREE ABOUT THESE MOVES BY 2.5x AND THE ENGINE CAN ONLY READ ONE.** `tags.json`
`uses` says 927:3,997 = 0.232; the store says 601:6,460 = 0.093. ROADMAP #70's standing caveat covers
exactly this. The store is the harder fact and is not readable at runtime, so the derived rate carries
the tag figure's 2.5x overstatement — which happens to offset part of the conservative situational
half. Both numbers are printed by the probe on every run so the gap cannot go quiet.

### FOUND WHILE THERE

- **`tests/test-tag-consumed.js` IS RED AT HEAD AND GREEN WITH THIS WIRE.** Measured three runs each
  way: HEAD exits 1 with *"1 tag(s) newly have NO consumer: `flinches`"*; this tree exits 0. The
  consumer it gained is `worth`'s flinch clause. Reported rather than claimed — a chooser heuristic is
  a thin consumer for a mechanic tag, and the real question is why the flinch path stopped asking.
- **`data/engine-data.js` CARRIES NO QUICK GUARD SET AT ALL** — 0 of 318 species; Wide Guard is on 8,
  and `MC.priors` has 14 Wide Guard rows and 0 Quick Guard rows. **Even a correct chooser cannot click
  a move no modelled body holds**, so self-play has to hand it out. That artifact is not this
  division's to edit; filed here with the count.
- **THE OTHER TWO WIRE 148 GAPS ARE NOT FIXED BY THIS DERIVATION, checked rather than assumed.** The
  `onTry()`/last-action failure is execution-time and untouched. Wide Guard's spread-**status** hole is
  in the attack branch and untouched — and note the chooser now *selects* Wide Guard against Cotton
  Spore, String Shot, Sweet Scent and Teeter Dance (they carry `spreadFoes`, so `GUARD_PRED` says it
  refuses them) while the turn loop does **not** block them. That disagreement was equally true of the
  old `SPREAD.has(id)` trigger, so it is pre-existing and unchanged; it is named here because this wire
  is the reason someone will read that line next.
- **`MEDSEEN.sideGuardBlocked` COULD HAVE BEEN CORRUPTED BY ITS OWN FIX.** The chooser asks the refusal
  question thousands of times a game HYPOTHETICALLY. `guardRefusalOf` was split out carrying **no
  counter** for exactly that reason, and the probe asserts the counter is still 0 after a full
  membership sweep.

### NEW SURFACE

`tests/test-side-guard-chooser.js` — three sections: membership, a deterministic 10-arm board where
**every control prints a real alternative click**, and the 1,500-game rate.
Counters: `MEDSEEN.sideGuardChosenVsPriority`, `MEDSEEN.sideGuardChosenVsSpread`;
`MEDFAILS.guardTargetClassUnknown`, `MEDFAILS.sideGuardRateNoUses`. Exported for the probe:
`foeThreatensGuardClass`, `sideGuardClickRate`, `guardMoveAimedAtFoes`.

Census **357 live / 357 probed / 0 missing / 0 threw — unchanged**, which is correct: this wire adds
no mechanic, it makes an existing one reachable by the search.

---

## WIRE 150 — THE HEAL TRUNCATED WHERE THE AUTHORITY ROUNDS. 2026-08-10.

Census **357 → 359 live, 359 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Two new
probes, each watched RED on its own before a line of the engine changed. Damage stages **1728/1728
exact**, unchanged. **No release was cut**, and neither `tests/roster.js` nor anything reaching
`engine/game_differential.js` was run.

| # | row(s) | uses | what it was | verdict move |
|---|---|---|---|---|
| — | **Roost, Recover, Slack Off, Soft-Boiled, Life Dew** — the whole fraction-heal family | **6,398** (2,800 lifedew · 2,672 roost · 803 recover · 123 slackoff · 0 softboiled) | `Math.floor(x.st.hp*_hp.fr[0]/_hp.fr[1])` where `battle-actions.js:1015` is `(gen < 5 ? Math.floor : Math.round)(baseMaxhp * heal[0] / heal[1])`. Gen 9 **rounds**. Torkoal 145 healed 72 against 73; Torterra 170 Life Dew healed 42 against 43, **paid twice** because it heals the partner too | *engine fixed; roster NOT re-run by me* |

```
- return Math.floor(x.st.hp*_hp.fr[0]/_hp.fr[1]);
+ return Math.round(x.st.hp*_hp.fr[0]/_hp.fr[1]);
```

**IT IS `Math.round`, NOT THE `md4096` ONE LINE ABOVE IT.** The two arms of `_size` mirror two
different authority paths. The weather family is `this.heal(this.modify(pokemon.maxhp, factor))` on a
float factor, and `modify` **is** the 4096ths chain — `md4096` is right there. The fraction arm has no
`modify` in it: a plain round over an **exact integer pair** off the move. Spending `md4096` here
would push `[1,2]` through a float and a 4096ths truncation the authority never applies, which is the
lossy-float trap WIRE 4's note is about (5448/4096, not 1.33). They happen to agree at `[1,2]` and
`[1,4]` — that is a coincidence of powers of two, not the same function.

### WHY IT SURVIVED EVERY EXISTING HEAL PROBE

The old fixture inflated max HP **fourfold**, so every fraction divided **exactly** and floor and round
could not disagree; and it chipped with the smallest neutral hit, so the heal **overshot and clamped to
full**. Two blindfolds at once — the right answer and the wrong answer were the same number. The
surviving `healsSelf` probe asserts `test[0] > 0`, and a truncation is still > 0. So both new probes
require **maxhp × heal[0] / heal[1] NOT whole** and a **chip deeper than the heal**.

### THE TWO PROBES — THE CONTROL IS THE POINT, AND THE NUMBERS ARE THE AUTHORITY'S

Staged in a real `gen9championsvgc2026regmb` `Battle`, chipped to a tenth and clicked:
Torkoal 145 Recover **14 → 87** (gained 73); Torterra 170 Life Dew **17 → 60** (gained 43).

| tag | control arm | test arm |
|---|---|---|
| `move\|healsSelf` | Torterra **170,85** — 170/2 is whole, floor and round agree, this arm **cannot move** | Torkoal **145,73**; a truncating engine reads 72 |
| `move\|healsAlly` | Torkoal **145,36,36** — 145/4 = 36.25 rounds **DOWN**, so a **ceiling** is caught here | Torterra **170,43,43**; a truncating engine reads 42 on **both** bodies |

The only varied knob is the **parity of max HP**. Max HP is returned beside the gain so the probe fails
loudly if `buildMon` ever hands back a different body.

### THE DIGEST SWEEP — 981,756 CELLS, 30 DIFFER, 5 MOVES

Every move in `data/tags.json` (500), six scenarios each (mid roll, both pin corners, aimed and with no
target), two turns apiece so residuals and clocks land, digested as the whole board — every primitive
on all four active bodies and all four benched ones, plus the field and both side conditions. BEFORE is
the current file with **this one character reverted**, compiled under the real medicham path so its
relative requires resolve identically.

**Five moves moved: `recover`, `roost`, `slackoff`, `softboiled`, `lifedew`. Nothing else in the corpus
moved by a single HP.** Life Dew contributes one cell per scenario rather than two, because Torkoal's
145/4 rounds down — the control, visible in the sweep itself.

**THE FIRST RUN OF THAT SWEEP PRINTED `0 cells differ` OVER 3,000 CELLS, EVERY ONE OF WHICH HAD THROWN.**
A circular reference in the digest turned every scenario into a one-cell `THREW` row, and the two arms
agreed perfectly about nothing. It was caught only because the throw count is printed beside the diff
count. That is this project's signature failure appearing inside the instrument built to prevent it.

### NO SECOND ROUNDING — THE CALLERS, NAMED

`_size`'s only caller is `amt`: `curHP = Math.min(st.hp, curHP + _size(x))`, a **clamp**, not a
rounding. `_hp.fr` is read at exactly one site; `healParam`'s other caller, `playerAction`, uses it only
to decide `kind:'heal'`. `board.js`'s `healValue` reads the same `[num,den]` but as a fractional feature
in 0..1, never an integer HP count.

### EVERY OTHER `Math.floor` HEAL WAS CHECKED AND MUST STAY A FLOOR

`Battle#heal` does `damage = this.trunc(damage)`, so `pokemon.heal(baseMaxhp / N)` truncates: healing
berries, Hospitality, `healsOnSwitchOut`, the absorb-ability gains, Grassy Terrain, `passiveHeal`.
**Pollen Puff is the sharpest case** — its handler is literally
`this.heal(Math.floor(target.baseMaxhp * 0.5))`, so the `allyheal` branch flooring **is** the authority
and a blanket floor → round would have broken it. Drain already rounds and Shell Bell already
clamps-then-truncates, each with its own note.

### A RED THAT IS NOT MINE, MEASURED RATHER THAN ASSUMED

`node engine/status.js` prints **FEATURE SEMANTICS CHECK FAILED** against `data/policy-weights.json`
for eight features. `engine/feature_fixture.js`'s `hashes()` was computed over the AFTER bytes and the
BEFORE bytes: **all 58 identical, 0 moved by this wire.** REFIT OWED against the damage-path wires;
it belongs to MEASURE. Reported, not filed.
