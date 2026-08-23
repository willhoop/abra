# The announce-failure class — one rule, one instrument, and half of it was never narration

ENGINE, 2026-08-23. Light mode: staged boards and single probes only. No `quarantine.js`, no
`status.js`, no `game_differential.js`, no `all_mechanics_fire.js`, no `roster.js`, no
`test-engine-diff.js`, no test batch.

Historical record. Not maintained, not current state, superseded by the register rows it feeds.

---

## 0. VERDICT IN ONE PARAGRAPH

The general mechanism is **`combineResults`' type ranking**: the authority writes `|-fail|MOVER` at
twelve sites and every one is guarded by a **strict `=== false`**, while `number` outranks `boolean`
in the priority list — so *a move announces exactly when its combined result is boolean `false`*, and
any damage dealt suppresses it. That is the whole class, not a phaze quirk. The thing that had blocked
the class at every previous attempt was real and is now built: `mvFail` writes a protocol line **and**
`_mvRes`, and nothing compared the second. `engine/move_result_state.js` does, and **it caught two
live state defects on its first run, on arms whose boards were identical and one of whose protocol was
byte-identical** — both deciding Stomping Tantrum's base power on the following turn. One ordering fix
(`canSwitch` asked above `DragOut`, per the authority) closed three symptoms across two sites:
`5 FAILED (8 arms)` -> `ALL CLAUSES HELD`, red on demand under two separate knobs. **The class is NOT
closed.** One mechanism of it is, and it is proven; four register rows remain and are triaged below.

---

## 1. WHICH SCOREBOARD, SAID BEFORE THE RUN

**THE LAB.** An empty bench needs three of a side's four bodies dead with two still standing, and
Malamar is the format's only legal Suction Cups carrier. **The pinned pool is not expected to move and
no claim that it does is made** — no usage figure is asserted anywhere in this report for the
empty-bench case. The BOARD is expected to be **identical on every arm before and after**: this is a
narration-plus-state fix, and an arm whose board moved would be a red flag rather than a success.

The one member of the class that IS board-material in the pool sense — #371 — turned out to be already
landed (§5), so nothing here predicts a pool movement.

---

## 2. THE GENERAL RULE, DERIVED FROM THE SOURCE

The brief asked for the refusal sites to be *derived*, not taken from the list of ones we happened to
have noticed. `grep "'-fail'" sim/battle-actions.ts` returns exactly twelve:

```
:463   attrLastMove('[notarget]');  add('-fail', pokemon)        no target at all
:512   attrLastMove('[notarget]');  add('-fail', pokemon)        targets list came back empty
:595   add('-fail', pokemon); attrLastMove('[still]')            Try / PrepareHit returned false      (spread)
:646   add('-fail', pokemon); attrLastMove('[still]')            hitStepTryHitEvent, all-false
:831   add('-fail', pokemon); attrLastMove('[still]')            Try / PrepareHit returned false      (field/side)
:850   add('-fail', pokemon); attrLastMove('[still]')            TryHitField / TryHitSide returned false
:1048  add('-fail', pokemon); attrLastMove('[still]')            moveHit's singleEvent TryHit
:1175  add('-fail', source);  attrLastMove('[still]')            damage calculation interrupted
:1203  add('-fail', target, 'heal'); attrLastMove('[still]')     a heal at full HP  (named on the TARGET)
:1213  add('-fail', source);  attrLastMove('[still]')            heal interrupted
:1306  add('-fail', source);  attrLastMove('[still]')            runMoveEffects: the move did nothing
:1362  add('-fail', source);  attrLastMove('[still]')            forceSwitch: DragOut returned false, Status only
```

**Three things fall out that a list of noticed cases could not give:**

1. **Every guard is `=== false`, never falsy.** `undefined`, `null` and `''` (`NOT_FAIL`) all mean
   *do not announce*, and they mean three different things to `moveThisTurnResult`.
2. **Every site pairs the `-fail` with an `attrLastMove`** — `[still]` in ten, `[notarget]` in two.
   There is no site anywhere that writes a bare `-fail` with the `|move|` line left intact.
3. **What decides which value arrives is one function**, `combineResults` (`:1561`):

```ts
const resultsPriorities = ['undefined', NOT_FAILURE /*string*/, NULL /*object*/, 'boolean', 'number'];
if (resultsPriorities.indexOf(typeof left) > resultsPriorities.indexOf(typeof right)) return left;
```

**A NUMBER OUTRANKS A BOOLEAN.** So the rule of the class, in one sentence:

> A move announces `|-fail|` exactly when its combined result is boolean `false` — nothing dealt
> damage, nothing returned `NOT_FAIL` or `null`, and something returned `false`.

The brief asked whether the asymmetry today's phaze work found is the general rule. **It is.** It is
not a property of `forceSwitch`; it is a property of `runMoveEffects`' tail at `:1303`, which every
move passes through. `tests/probe_announce_failure.js` asserts it **on the authority in both
directions**, so an engine that announced always would fail exactly as one that announced never.

### 2b. A SECOND FINDING THAT RETIRES A WHOLE LINE OF ENQUIRY

Point 2 above looks like a large open defect: `mvFail(mon)` is `{ mon._mvRes = false; TR.fail(mon); }`
with **no `attrStill`**, and about **70 of this engine's ~84 `mvFail` call sites** do not wrap it in
one (11 do). That reads as ~70 sites writing a `-fail` the authority would never write bare.

**It is invisible to the whole-game differential by design, and the differential is right.**
`engine/game_differential.js`'s `move-target-field` equivalence is

```js
fn: f => (f[1] === 'move' ? f.slice(0, 4) : f)
```

which drops field 4 **and everything after it, including `[still]`**. The rule is argued at length in
that file (Showdown names one nominal target plus `[spread]`, we name our own user) and it is not a
silencer being abused — but a consequence is that this entire asymmetry has no instrument counting it
and no known cost. **Recorded here so the next session does not spend an evening on it.** It is not
claimed harmless; it is claimed unmeasured, and it is on the hand list as such.

This is also why `tests/probe_fail_and_silent.js` reads 6 staged / 0 parted on the live tree: its
field-repeat family genuinely agrees.

---

## 3. THE BLOCKER — BUILT FIRST, AS THE BRIEF REQUIRED

Every deferral of this class cited the same missing instrument, in these words:

```
engine/medicham2-browser.js:17525   "`_mvRes` IS LEFT EXACTLY AS IT WAS ... What the authority does to
                                     `moveThisTurnResult` on a `null` drag -- which is what Stomping
                                     Tantrum reads next turn -- was NOT staged in this pass, and the
                                     2026-08-12 retraction is what happens when a state change rides
                                     in on a narration fix."
engine/medicham2-browser.js:8875    "`NOT_FAIL`'s effect on `moveThisTurnResult` was NOT staged in
                                     this pass -- the field is cleared at the turn boundary, so it
                                     cannot be read off a finished battle the way a protocol line can."
docs/_reports/2026-08-23-phaze-empty-bench.md §4
                                    "the boards agreeing does not prove `_mvRes` agrees. So this was
                                     NOT fixed in this pass."
```

**`engine/move_result_state.js`** is that instrument.

- It reads `moveThisTurnResult` / `moveLastTurnResult` off the authority's active bodies and
  `_mvRes` / `_mvResLast` off medicham2's, **at the same turn boundary `engine/board_state.js`
  already uses**. Both engines roll the live value into the previous-turn field at that exact instant
  — `sim/battle.ts:1671-1672` and `engine/medicham2-browser.js:24630` — so `last` is the live value on
  both sides there. `this` is read too and reported apart: a non-`undefined` `this` at a boundary
  means one engine did not roll, which is a different defect from the two disagreeing.
- **The four values are never collapsed.** `true` / `false` / `null` / `undefined`. Three of the
  field's four consumers test `=== false` only (`data/moves.ts:18048`, `:19184`, `data/items.ts:4010`)
  — but `data/abilities.ts:5176` tests `!== undefined`, so a null/undefined collapse would silence
  exactly that one. A value outside the four is encoded as `UNEXPECTED(...)` rather than folded into
  the nearest, because a silent default here is the shape CLAUDE.md opens with.
- `--selftest`, 18 clauses, **every one driven through the shipping functions** rather than a
  restatement of them. It includes all six pairwise "x is not mistaken for y" demonstrations, an
  index-parallel-failure clause (two different bodies in one slot is reported apart from a value
  difference and never as agreement), and a species-spelling clause so `morpeko-hangry` vs
  `morpekohangry` is not misalignment.
- **It is NOT wired into `engine/board_state.js`.** Promoting it to a compared board field changes
  what every whole-game run counts, and light mode cannot size that. On the OWED list; the reason is
  written into the file's header rather than left as an absence.

### WHAT IT FOUND, IMMEDIATELY

Two state divergences that **nothing in this repository could see**, on arms whose boards were
identical:

| arm | authority | ours | consequence next turn |
|---|---|---|---|
| Roar / empty bench / plain target | `moveLastTurnResult = false` | **`true`** | Stomping Tantrum does not double where the authority doubles |
| Roar / bench 1 / **Suction Cups** target — **narration byte-identical** | `moveLastTurnResult = true` | **`false`** | it doubles where the authority does not |

**The second row is the one that decides how this class should be read.** The board agreed, the
protocol agreed byte for byte, and the state was wrong *in the opposite direction*. Calling that
member "narration-only" would have been wrong, and the deferrals that refused to guess were right to.

---

## 4. WHAT LANDED — ONE ORDERING, TWO SITES, THREE SYMPTOMS

`canSwitch(target.side)` is a **conjunct above** `runEvent('DragOut', ...)`:

```ts
sim/battle-actions.ts:1353
  for (const [i, target] of targets.entries()) {
    if (target && target.hp > 0 && source.hp > 0 && this.battle.canSwitch(target.side)) {
      const hitResult = this.battle.runEvent('DragOut', target, source, move);
```

An empty back therefore skips the **whole body**: no DragOut event runs, so **an `onDragOut` ability
is never consulted and its `-activate` is never written**. This engine asked the ability first, in both
doors.

**The fix is one reader, not two guards.** New `canDragIn(bench)` — `sim/battle.ts:1563`/`:1571`
quoted at it — asked before the refusals in the status branch and before them in the damaging loop.
The two branches sit ~5,900 lines apart in one file, which is exactly the situation CLAUDE.md's
one-implementation-per-fact rule is about.

The announcement then follows the derived rule rather than a per-site decision:

| door | what the authority does with an empty back | what we now do |
|---|---|---|
| **STATUS** (Roar) | `damage[i]` is `undefined`; `combineResults(undefined,false)` = `false`; `:1303` fires | `TR.attrStill(); mvFail(m)` — `-fail` + `[still]` + `_mvRes = false` |
| **DAMAGING** (Dragon Tail) | `damage[i]` is a number and outranks the `false`; nothing is announced | skip silently; `_mvRes` left as the step driver set it (`true`) |

And at the surviving Suction Cups gate, `mvFailSilent` becomes the new **`mvOkSilent`**: `:1260` asks
`hitResult = !!this.battle.canSwitch(target.side)`, which is **true** when the bench is not empty, so
the move is recorded a success. The ability is not consulted there at all.

`mvOkSilent` is a separate function from `mvFailSilent` for the same reason `mvFailSilent` is separate
from `mvFail`: **a call site must not be able to silently swap "the move failed" for "the move
worked".**

### RED FIRST, CONTROL CLEARED, THEN GREEN

`SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_announce_failure.js`

```
BEFORE   5 FAILED (8 arms)
  RESULT     roar/bench0/plain    p1a tyranitar .last  sd=false  me=true
  RESULT     roar/bench1/cups     p1a tyranitar .last  sd=true   me=false   (board + narration identical)
  NARRATION  roar/bench0/plain    sd [... -fail|tyranitar]        me [... (nothing)]
  NARRATION  roar/bench0/cups     sd [... -fail|tyranitar]        me [... -activate|malamar]
  NARRATION  dtail/bench0/cups    sd [... -damage|malamar]        me [... -damage|malamar -activate|malamar]

AFTER    ALL CLAUSES HELD (8 arms)
  every BOARD, RESULT, NARRATION and `-fail`-multiset clause green on all eight arms
```

**The controls clear explicitly, in the fixture's own terms and in the authority's own numbers:**

- the bench knob reads **2 / 1 / 0** in `possibleSwitches` across the arms, both doors, both families
  — identical depths would mean the fixture is unwired, not that the depth does not matter;
- **bench 1 is a legal drag both engines perform**, so "nobody moved" cannot be the fixture failing to
  click;
- **the authority DOES write Suction Cups' `-activate` at bench 1** and does not at bench 0, which is
  what makes the bench-0 arms a statement about the bench rather than about the ability being absent;
- the Suction Cups arms assert that Malamar actually reached the aimed slot, rather than assuming the
  replacement landed there.

### RED ON DEMAND — TWO KNOBS, NOT ONE

```
MEDI_DRAG_ABILITY_FIRST=1    -> 5 FAILED (8 arms)   restores the ORDERING
MEDI_DRAG_REFUSAL_FAILS=1    -> 1 FAILED (8 arms)   restores the STATE write at the Suction Cups gate
```

Two knobs because they are two independent defects found in one pass, and a knob that restored both
could not say which half a red arm was about — which is the only reason a restore knob exists.
Counters `MEDFAILS.dragAbilityFirstRestored` and `MEDFAILS.dragRefusalFailsRestored`.

### THE COUNTERS FIRE — READ, NOT ASSUMED

Read by walking `require.cache` for the snapshot's copy of the engine (the trap
`docs/_reports/2026-08-22-formes.md` §5 records: reading them off `require('./engine/...')` after a
harness run returns a different object whose counters never move). After one probe run:

```
forcedSwitchNoBenchStatus   2      (roar/bench0 x2)
forcedSwitchNoBenchDamaging 2      (dragontail/bench0 x2)
mvOkSilentNoLine            1      (roar/bench1/cups — the state fix)
mvFailSilentNoLine          0      (its only call site moved)
forcedSwitchRefused         2      (the two bench-1 cups arms, unchanged)
```

The snapshot's bytes were verified equal to the live tree's by content, not by id.

### NO EXISTING PROBE REGRESSED

| probe | verdict on the live tree after the change |
|---|---|
| `tests/probe_drag_body.js` (ROADMAP #340/#341) | every clause held, both doors |
| `tests/probe_phaze_empty_bench.js` | every BOARD clause, **and every NARRATION clause including the four Suction Cups arms its own report had RED this morning** |
| `tests/probe_fail_and_silent.js` (ROADMAP #241(3)) | 6 staged, 0 parted |
| `engine/move_result_state.js --selftest` | 18 passed, 0 failed |
| `tests/test-docs-current.js` | 22 passed, 0 failed |
| `tests/test-roadmap-register.js` | 3 passed, 0 failed |
| `tests/test-artifact-rerunnable.js` | all green, 5 checks |

`tests/probe_phaze_empty_bench.js` going green on arms another agent measured RED four hours ago is
the strongest single piece of evidence here, because that probe is not mine and its arms were written
against the old behaviour.

---

## 5. BOARD-MATERIAL vs NARRATION — THE WHOLE CLASS, TRIAGED

The brief asked for #371 to be triaged first because *"SHOWDOWN REFUSES A MOVE AND WE EXECUTE IT"* is
board-material in every member. **It does not block this class: both of its board-material sub-causes
are already at HEAD.**

| member | board-material or narration | state |
|---|---|---|
| **#371(a)** a stalling move that is not a shield never reaches the stall gate | **board-material** (the stall counter and the Endure volatile) | **landed**, commit `f36427f`, explicitly unmeasured |
| **#371(b)** a trapping move re-applied to an already-trapped body | **board-material** (the refusal; the duplicate `-activate` is narration) | **landed** — `trapAlreadyHeld(t) -> mvFail(m)` with `MEDSEEN.trapRefusedRepeat` is at HEAD |
| **#371(c)** four refusals with `mentions: []` and no context | **no verdict** | **UNATTRIBUTABLE BY CONSTRUCTION** — #375 (the instrument's dump cap) owns it |
| empty-bench phaze `-fail` + `[still]` | **STATE**, not narration — the mover's result was `true` where the authority holds `false` | **landed this pass** |
| Suction Cups `-activate` with an empty back, both doors | narration | **landed this pass** |
| `_mvRes` after a legal `onDragOut` refusal | **STATE** — `false` where the authority holds `true` | **landed this pass**, found by the new instrument |
| **#345** volatile counter expiry unannounced | **board-material IF the expiry turn is off by one** (Infestation blocks switching, Perish Song's last tick kills); narration if the turn is right | unprobed |
| **#352** `-weather ... [upkeep]` | the `wSup` gate is **narration** (Cloud Nine is its only carrier and none of the five games has one); **the leading alternative — a sky already gone on our side — is board-material** | unprobed |
| **#359** Poltergeist names the item it throws | **narration** (emission only; the refusal half is not claimed either way by the row) | unprobed |
| **#360** Telepathy `-activate` vs our `-immune` | **narration** (the row's own words: the right board, the wrong line type) | unprobed |

**Nothing in the remaining four is #371-shaped.** #352 has a board-material *alternative* that its own
row says is unattributed, and it is the right next thing to probe.

---

## 6. THE GATE'S OWN LIMIT, WRITTEN INTO THE GATE

The brief: *the gate you write must catch a NEW silent failure spelled differently; if it cannot, say
so in the gate's own header.*

**CAN.** The predicate compares the two engines' `|-fail|` lines **as a multiset**, and the turn's
event stream as a sequence. It is spelled without naming a move, an ability or a failure reason, so a
refusal added tomorrow under any name — writing no line where the authority writes one, or one where
the authority writes none — trips it. There is no list of known-silent moves anywhere in the file.
Demonstrated: under `MEDI_DRAG_ABILITY_FIRST=1` the multiset clause alone goes red on two arms.

**CANNOT.** The predicate is general; **the corpus is eight arms on one mechanism.** A silent failure
in a mechanism no arm stages is invisible here, exactly as it is invisible to
`engine/gate_fail_and_silent.js` when the differential's sample does not reach it. The two instruments
have the same shape of hole in different places — **that one is limited by its SAMPLE, this one by its
FIXTURES, and neither by its predicate.** Widening the corpus is the only thing that widens either.
This paragraph is in the probe's header, not only here.

`engine/gate_fail_and_silent.js` **was run** (it is light) and returns **CANNOT ANSWER, exit 2**: the
published `data/game-differential.json` ran on release `c66976713feb` and the tree is elsewhere. That
is MEASURE's refusal working as designed, not a defect — and it means **no whole-game count for this
class can be quoted from this session, and none is.**

---

## 7. WHAT WAS DELIBERATELY NOT DONE

- **No census regeneration**, so **the live mechanics count did not move and no movement is claimed.**
  `tests/test-mechanics.js` is a batch and light mode forbade it. Inspected by hand, the phaze census
  rows exercise bench depths this change does not touch — **but inspection is not a run**, and it is
  on OWED first.
- **`engine/board_state.js` was NOT edited.** Adding a compared field changes what every whole-game
  run counts, and light mode cannot size the blast radius. The new comparator is standalone and
  nothing in a release's `SOURCES` requires it, so no release is affected by its existence.
- **`engine/game_differential.js` was NOT edited**, though §2b names its `move-target-field` rule as
  the reason a whole asymmetry is uncounted. That rule is argued and correct on its own terms;
  changing it is a MEASURE-owned decision about what the instrument counts.
- **`board.js`, `magnemite.js` and `engine-data.js` were not touched.** No fit, no self-play, no
  roster, no differential, no `docs/ROADMAP.md` edit, no commit, no push.
- **#359 and #360 were not landed**, though both are small and derived. The brief's batch rule is to
  do the board-material one, prove it, and OWE the rest rather than half-landing several — and neither
  could have been proven this session, because the census cannot be regenerated to confirm nothing
  went down.

---

## 8. OWED, NOT RUN — AS COMMANDS

```
node tests/test-mechanics.js
node engine/status.js
node engine/status.js --write
node engine/gate_fail_and_silent.js                    (re-run once a fresh differential exists)
tools\lownode.cmd engine\quarantine.js
SHOWDOWN_PATH=... node engine/game_differential.js --release <fresh id> --census data/gate-census.pin.json --team-store data/team-pool-frozen --state
SHOWDOWN_PATH=... node tests/roster.js

git add engine/medicham2-browser.js engine/move_result_state.js tests/probe_announce_failure.js \
        docs/ENGINE.md docs/MEDICHAM-SPRINT-NOTES.md CHANGELOG.md data/docs-currency-baseline.json \
        docs/_reports/2026-08-23-announce-failure-class.md
```

Specifically owed, and why:

1. **`node tests/test-mechanics.js`** — the census must be regenerated after an engine change and the
   live count confirmed not to have gone down. **Nothing in this session may be read as a census
   result.**
2. **`node engine/status.js --write`** — the GENERATED block in `docs/ENGINE.md` is now two restamps
   behind (this pass and the phaze pass before it).
3. **A whole-game differential on the pinned pool**, which is also what makes
   `engine/gate_fail_and_silent.js` able to answer at all. Expectation stated before the run: the lab
   moved and **the pool is not expected to move**; a flat pool reading is the predicted outcome here,
   not an anomaly to be explained afterwards.
4. **Promote `engine/move_result_state.js` into `engine/board_state.js`** — as a compared field, or as
   a declared `NOT_COMPARED` entry with this report as its reason. Today it is compared by one probe
   and by nothing at scale, which is the same absence this pass was built to end, one level up.
5. **The commit.** Not made: another agent had in-flight edits to `.claude/skills/`, and MEASURE's
   work on `engine/register_reality.js` and `engine/gate_fail_and_silent.js` is in the same tree,
   which the pre-commit hook reads whole. All three pre-commit gates were run by hand and are green
   (`test-docs-current` 22/0, `test-roadmap-register` 3/0, `test-artifact-rerunnable` all green), and
   the MEDICHAM sprint row is written so the sprint clause will not block.
6. **#345, #352, #359, #360** — triaged in §5, none probed. #352's board-material alternative is the
   strongest next candidate.
7. **Whirlwind and Circle Throw are still not staged** on either door. Same tag, same branches — an
   argument, not a measurement.
