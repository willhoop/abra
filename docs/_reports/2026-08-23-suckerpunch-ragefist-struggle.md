# Sucker Punch's queue clause, Rage Fist's times-hit counter, and Struggle's typelessness

2026-08-23 · ENGINE · three defects, three batches of one, each RED first with its control cleared.

Census **643 → 646 live, 0 missing**. Damage differential at `--n 6000 --seed 20260804`:
**7 of 6000 → 0 of 6000**, all seventeen arms. Whole-game board-material, middle arm, engine only:
**27 → 21** (re-baseline, not a delta — see §5).

---

## 0. The three knobs, and what each restores

| knob | what it puts back | receipt |
|---|---|---|
| `MEDI_SUCKER_QUEUE_BLIND=1` | the whole-turn `acts.find` — a target that has already moved reads as "about to attack" | `MEDFAILS.suckerQueueBlindRestored` |
| `MEDI_DMG_OWNTYPE_BLIND=1` | `dmgRangeOneHit` pricing a move at its PRINTED type — Struggle Normal again | `MEDFAILS.dmgOwnTypeBlindRestored` |
| *(none for Rage Fist)* | it is an ADDITION, not a changed branch: with the counter absent there is nothing to restore that `_timesAttacked === 0` does not already produce, and every fixture body starts at 0 | `MEDSEEN.timesHitCounted`, `MEDSEEN.timesHitPowerRead` |

New counters, all shown non-zero on real turns (`MEDSEEN.suckerRefusedAlreadyMovedTarget 1`,
`timesHitCounted 5`, `timesHitPowerRead 2`, `ownTypeAlwaysPriced 3`, `MEDFAILS.timesHitSubstituteUncounted 0`).

---

## 1. SUCKER PUNCH — the first clause of the `if`, and it is a QUEUE question

**The authority, read whole.** `data/moves.ts:18399-18404` (Champions does **not** override `suckerpunch`):

```js
onTry(source, target) {
  const action = this.queue.willMove(target);
  const move = action?.choice === 'move' ? action.move : null;
  if (!move || (move.category === 'Status' && move.id !== 'mefirst') || target.volatiles['mustrecharge'])
    return false;
}
```

`willMove` (`sim/battle-queue.ts:319-327`) returns `null` when the body is fainted **or when nothing
is left in `this.list` for it** — and `this.list` is the REMAINING queue. `engine/medicham2-browser.js`
asked `acts.find(x => x.mon === _tgt)` over the whole turn's action list, which still holds actions
that have executed.

**#60 and #180 were the other two clauses, and this is the answer to the brief's question.** The right
fix is **the shared reader, not the remaining clause**. `queueWillMove` now sits beside `unresolved`
in `battleTurn` and mirrors `BattleQueue.willMove` line for line; every clause of that `if` reads it.
Two reasons it had to be the reader:

- **Both members of the tag call the same authority function.** `upperhand`'s `onTry`
  (`data/moves.ts:20190`) opens on `this.queue.willMove(target)` too. So does the tag's own membership
  rule — `engine/tag_dex.js` derives `failsIfTargetNotAttacking` from the regex `/willMove\(\s*target\s*\)/`.
  A third member printed later reads the queue **by construction** and gets this without an edit.
- **`unresolved` already IS `this.list`.** WIRE 118 built it and the flinch gate, Zoom Lens and
  Payback all read it. A private set here would have been a fourth answer to one question
  (CLAUDE.md, facts are global).

**RED first, control cleared.** Kingambit clicks Sucker Punch at Dragonite; the ONLY thing varied is
Dragonite's priority. Both arms have the target ATTACKING, so neither of the two existing probes can
see this.

```
                         before      after       knob restored
extremespeed (+2)          85          0             85          <- must be 0
dragonclaw   (+0)          85         85             85          <- must be > 0
```

Identical arms before the fix — the unwired-knob signature.

**Fake Out is deliberately NOT the fast move**, and this was the instrument-before-the-engine trap:
Fake Out flinches, so a flinched Kingambit deals 0 whether or not the queue is read and the probe
would have gone green on a broken engine. Extreme Speed carries no secondary.

**The authority was asked this exact board rather than quoted.** Official simulator, format
`gen9championsvgc2026regmb`, same four bodies:

```
Extreme Speed arm:  |move|p2a: Dragonite|Extreme Speed|p1a: Kingambit
                    |move|p1a: Kingambit|Sucker Punch||[still]
                    |-fail|p1a: Kingambit
Dragon Claw arm:    |move|p1a: Kingambit|Sucker Punch|p2a: Dragonite
                    |-damage|p2a: Dragonite|139/166
```

Learnsets derived, not recalled: Kingambit is one of 37 legal Sucker Punch carriers; Dragonite is one
of 4 legal Extreme Speed carriers and learns Dragon Claw.

**Probe:** `tests/test-mechanics.js` — `move/failsIfTargetNotAttacking`, *"Sucker Punch ALSO fails
into a target that has ALREADY MOVED this turn (the queue clause)"*.

**Class, not instance.** The gate catches a second member spelled differently, because the reader is
shared and the tag's membership is a regex over the authority's own handler text. What it does **not**
catch is a move that asks the queue through some other expression — `willAct()`, or a
`basePowerCallback` reading `queue` (Payback does exactly that, and is served elsewhere).

---

## 2. RAGE FIST — IT IS THE EXISTING ROW, NOT A SECOND DEFECT

**The brief asked, and the answer is: this is ROADMAP #357.** That row, filed 2026-08-22 by MEASURE,
says in terms *"RAGE FIST IS PERMANENTLY 50 BASE POWER HERE BECAUSE THE TIMES-HIT COUNTER DOES NOT
EXIST, AND THE TAG SAYS SO ITSELF"*, cites the same mainline callback and the same Champions override,
and names the same board (Annihilape into Avalugg-Hisui). **The board-materiality report's "NEW — not
among the 31 mechanisms of the prior grouping" is correct about the GROUPING and wrong as a claim
about the register.** No duplicate row is proposed; #357 should be closed.

(#283 and #287 are NOT this row and never were — those are `board.js`'s `movePower` stub and the seed
audit. #283's own text already refuses Rage Fist by name, for `board.js`, which is not mine to change.)

**The authority.** `data/moves.ts` ragefist: `basePowerCallback(pokemon) { return Math.min(350, 50 + 50 * pokemon.timesAttacked); }`.
Champions **does** override the entry (`data/mods/champions/moves.ts:787-791`, `inherit: true`) to
restate the rule — *"X cannot be greater than 6 and resets to 0 when the user leaves the field"* — and
implements the reset in its own `clearVolatile` (`data/mods/champions/scripts.ts:169`, `this.timesAttacked = 0;`).
Mainline never resets it. The increment is `data/mods/champions/scripts.ts:563-568`:
`if (typeof moveDamage[i] === 'number') target.timesAttacked += move.smartTarget ? 1 : hit - 1;`
for every target that is not the user.

**Three pieces landed:**

1. **The tag gained a `kind`.** `engine/tag_dex.js` now derives
   `variablePower {kind:'userTimesHit', cap:350, base:50, per:50}` off the callback's own arithmetic.
   It sat under `{computed:true, note:'idiom not yet derivable'}` — one of the twelve kindless members
   — so no branch of the consumer applied AND the unknown-kind counter (gated on a truthy `kind`) did
   not report it. **Membership printed before wiring**: `timesAttacked` appears in exactly ONE
   `basePowerCallback` in the whole dex and in no other move handler of any kind. Exactly one row of
   `data/tags.json` changed.
2. **The state.** `_timesAttacked` incremented at the one damage site, in ARRIVALS (`_landed`, the
   same number `-hitcount` reports) and not in clicks, gated on `m !== tg`. `_landed` was hoisted out
   of the packet branch so the hit count has one reader, not two.
3. **The reset.** `out._timesAttacked = 0` in `switchOut`, which is the Champions-only half.

**RED first, three arms.** Annihilape clicks Rage Fist at Garchomp; the only thing varied is how many
Dragon Claws it ate first.

```
                       before                 after
0 hits                 51                     51   (timesAttacked 0)
2 hits                 51                     150  (timesAttacked 2)
2 hits then a pivot    51                     51   (timesAttacked 0)
```

**The pivot arm is not decoration.** An engine that copied MAINLINE would pass the first two arms and
fail only this one.

**The authority was asked the same three arms** (setup turns spent on Bulk Up so the counter is the
only thing moving): `timesAttacked` 0 / 2 / 0, Rage Fist dealing 37 / 183 / 36.

**Probe:** `tests/test-mechanics.js` — `move/variablePower`, *"Rage Fist grows with the hits its user
has taken, and resets on a pivot"*.

**Declared remainder, counted rather than argued away.** A hit absorbed by a SUBSTITUTE reaches the
authority with a numeric `moveDamage[i]` and therefore counts there; this engine routes a sub-eaten
hit away from the counter site, so it does not count here. `MEDFAILS.timesHitSubstituteUncounted` is
bumped on that road.

**`needsUntrackedState {needs:"times hit -- NOT TRACKED"}` was LEFT IN PLACE and is now half-stale.**
That tag's own param says *"power depends on state the board does not track"* — and `board.js` still
does not track it (#283 refuses it by name). It has no consumer under `engine/` outside `tag_dex.js`.
Changing it is a claim about `board.js`, which is not this division's file. **Reported, not touched.**

---

## 3. STRUGGLE — IN SCOPE, AND THE ARTIFACT WAS NEVER WRONG

**The brief's warning does not apply.** `data/engine-data.js` carries `t:"Normal"` for Struggle, and
that is **correct**: it is the dex's printed `type`. The `???` arrives from the move's own
`onModifyMove` at use time (`move.type = '???'`), and `???` has no row in the type chart — x1 against
everything, STAB against nothing. Champions does not override the entry. **No generated artifact was
edited and none needed to be.**

**The defect is one line in `engine/medicham2-browser.js`, and its own header had already named it.**
`effMoveType` has honoured `setsOwnTypeAlways` since ROADMAP #144. `dmgRangeOneHit` opens
`let mvT = mv.t` and re-does the type resolution itself — which `formeMoveType`'s header calls out in
terms: *"THE HONEST FIX IS TO MAKE `dmgRangeOneHit` CALL `effMoveType`, AND IT IS NOT DONE HERE."*
The gates moved and the damage did not, one move over.

**One cause, two symptoms, and both were in the residual seven:**

| symptom | rows | authority | before | after |
|---|---|---|---|---|
| unearned x1.5 STAB | 6 | `ditto struggle -> clawitzer` 11-14 | 16-21 | **11-14** |
| a Normal→Ghost immunity the game does not have | 1 | `gallade struggle -> gengar` 51-60 | 0-0 | **51-60** |

**Class, not instance, measured.** Ten moves in the whole dex assign a literal `move.type` inside
`onModifyMove`/`onPrepareHit`/`onModifyType`. Five are `isNonstandard: 'Past'`. Of the five legal ones
four are CONDITIONAL (Aura Wheel and Raging Bull on the forme, Weather Ball and Terrain Pulse on the
field) and already carry their own tags and their own reads in this function. **Exactly one is
unconditional and it is Struggle.** The type is read off `setsOwnTypeAlways.type`, never off a name,
so a second unconditional member printed later is picked up with no edit.

**Probe:** `tests/test-mechanics.js` — `move/setsOwnTypeAlways`, *"Struggle is typeless — no STAB out
of a Normal body, and it lands on a Ghost"*. Four arms over two boards; the control is the same move
with its id changed so every tag lookup misses, which IS the pre-fix engine.

---

## 4. The damage differential, before → after

`SHOWDOWN_PATH=... tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804`

```
before   7 of 6000 disagree at the midpoint, and 7 in EVERY one of the sixteen other arms
         (top, bottom, idx01..idx14) — all seven Struggle
after    0 of 6000, midpoint and all sixteen arms
         compared 6000, agreed 6000, disagreed 0
         134 not comparable (multihit 134, non-finite 0, threw 0)
```

Accuracy conformance 0, accuracy-modifier conformance 0, substitute-bypass conformance 0 — unchanged.

---

## 5. The whole-game run — a RE-BASELINE, said first

**The pins.** Release **`0faabe2a3f1b`** (cut from this tree; `engine_release.js list` reads
`0 of 26 files have moved since`), `--team-store data/team-pool-frozen`, census pinned to
`data/verification/census-pin-9446a684709d.json`, `--games 1200 --end-state --write`, yielding **961**
games. Showdown commit `20ad99ffc9a5`.

**Both the engine AND the release moved, so this is not a delta against 27.** Say it before the number,
not after.

```
                     middle      top-tie-first   bottom-tie-first
parted                  73             61              75
BOARD-MATERIAL          30             19              20
NARRATION-ONLY          43             42              55
UNKNOWN                  0              0               0
minus INSTRUMENT        -9             -1              -2
  Moody                  8              0               0
  ??:<body> off-field    1              1               2
---------------------------------------------------------------
ENGINE BOARD-MATERIAL   21             18              18
```

Prior run, same instrument, older engine and release: middle **27**, top 23, bottom 23.

**Moody is the instrument and the arms say so, not the argument** — 8 in `middle` and **zero in either
corner**, which is what an unshared `sample()` looks like and is not what a rule defect looks like.
**7 of the 8 are CARDED `[from] ability: moody` in the dump**; the eighth
(`|-boost|p1a|spa|2 <> |-boost|p1a|spd|2`, 1 game) fell outside the 200-game dump and is grouped by
shape, which is stated rather than hidden.

**Sucker Punch, Rage Fist and Struggle appear in ZERO divergence causes across all three arms.** The
only `suckerpunch` string left in the run is inside a WORKED EXAMPLE where both engines agree.

**Scoreboard, stated before the run and held:**

- **Sucker Punch — board-material with KOs, so the pool should move.** It did: the four-game cause is
  gone from all three arms.
- **Struggle — should clear the damage differential and may not move the pool.** Exactly that: 7 → 0
  on the differential, and Struggle never appears in the pool's causes (it needs a body out of PP,
  which a 12-turn cap rarely produces).
- **Rage Fist — 1,042 corpus clicks, one carrier.** Gone from the causes; the census carries the
  three-arm proof including the pivot reset, which the pool cannot stage.

**The run's planted-state proof still does not pass** — the same pre-existing, fixture-shaped failure
the previous pass reported (`NOT CAUGHT` on magnetrise / focusenergy / saltcure / syrupbomb, `NOT
APPLIED` on six bench plants). Direction is one-way: an uncaught plant is UNDER-sensitivity, which can
only over-call NARRATION. **So 21 is a lower bound, exactly as 27 was.**

---

## 6. `tests/run-all.js` — nothing new is red

`127 passed, 33 failed, 2 skipped`. Two failures were checked in detail rather than waved through:

- **`tests/test-engine-diff.js` exit 3** is `publish_guard`'s PUBLISH REFUSED: run-all invokes it at
  the default `--n 150` and `data/engine-diff.json` holds 6000. Correct behaviour, and pre-existing.
- **`engine/validate_damage.js`** is red on ONE scenario (`Charizard heatwave -> Pelipper`, −50%).
  Re-run with `MEDI_SUCKER_QUEUE_BLIND=1 MEDI_DMG_OWNTYPE_BLIND=1` — i.e. this tree with both damage-
  and turn-path changes reverted — it prints the **identical** aggregate (`within-5% 92%, worst 50%`).
  Not mine.
- `tests/test-effective-identity.js` counts raw `.ability` / `.baseStats` reads per file against a
  baseline. Measured on HEAD's bytes versus mine: `medicham2-browser.js` 281→281, `tag_dex.js` 19→19,
  `test-mechanics.js` 419→419. **Not mine.**

A HEAD worktree was cut as a control and is **not a usable baseline** — it has no `node_modules` and
no `data/games.selfplay.jsonl`, so 15 checks fail or skip there for environmental reasons. That is
recorded so nobody re-derives it.

---

## 7. OWED, NOT RUN

```
tools\lownode.cmd engine\quarantine.js         # NOT run — the roster stages are minutes each and the
                                               #   three roster artifacts are already WITHHELD as
                                               #   MEASURED-AGAINST-A-DIFFERENT-ENGINE (they name
                                               #   release c36782953dee; the tree is 0faabe2a3f1b)
SHOWDOWN_PATH=... node tests/roster.js --stage {items,abilities,moves} --write   # NOT run
node engine/wire_ladder.js                     # NOT run — status.js already calls data/wire-ladder.json
                                               #   UNSAFE on content drift, pre-existing
node tests/interaction_matrix.js               # NOT run — the matrix artifact is 2026-08-11
```

- **The roster is now two releases stale and this pass made it three.** Every roster figure in
  `status.js` is WITHHELD until it is re-run. That is the state it was already in, not a new debt.
- **The narration gate still does not exist.** This run produces 43 narration games (middle) and
  nothing ratchets them.
- **`switch lookups that MISSED: medicham 6`** (must read 0) and `forced_switch_unmirrorable 12`,
  both arising after two boards have parted. Unchanged in kind from the previous run (was 16).
- **`MEDFAILS.traceBodyOffField = 10`** — the `??:` identifier. Pre-existing, ROADMAP #224.
- **A git worktree was created at**
  `<scratchpad>/base` **and removed.** No repo file was deleted.

---

## 8. PROPOSED REGISTER ROWS (not written — `docs/ROADMAP.md` is not this division's to edit)

**CLOSE #357** — *"CLOSED 2026-08-23 by ENGINE. `variablePower` gained the derived kind
`userTimesHit {cap:350, base:50, per:50}`, read off the callback's own arithmetic in
`engine/tag_dex.js` (membership printed first: `timesAttacked` occurs in exactly ONE
`basePowerCallback` in the whole dex and in no other move handler). `_timesAttacked` is incremented
per ARRIVAL at the one damage site — `hit - 1`, the number `-hitcount` reports — gated on
`pokemon !== target`, and CLEARED in `switchOut`, which is the Champions-only half
(`data/mods/champions/scripts.ts:169`). Shown red first with three arms: 51 / 51 / 51 before against
51 / 150 / 51 after (0 hits, 2 hits, 2 hits then a pivot), and the authority asked the same three arms
reads `timesAttacked` 0 / 2 / 0. The PIVOT arm is what separates this from mainline, which never
resets. Probe: `tests/test-mechanics.js` `move/variablePower` — 'Rage Fist grows with the hits its
user has taken, and resets on a pivot'. DECLARED REMAINDER: a Substitute-absorbed hit counts in the
authority and not here — `MEDFAILS.timesHitSubstituteUncounted`. NOT TOUCHED: the move keeps
`needsUntrackedState`, which is a claim about `board.js` and #283 still refuses it there by name."*

**NEW ROW — Sucker Punch's queue clause** — *"SUCKER PUNCH LANDED ON A TARGET THAT HAD ALREADY MOVED.
CLOSED 2026-08-23 by ENGINE, and closed as a SHARED READER rather than as a third clause.
`data/moves.ts:18399` opens `this.queue.willMove(target)` and `sim/battle-queue.ts:319-327` walks the
REMAINING queue; `engine/medicham2-browser.js` asked `acts.find(...)` over the whole turn's action
list. `queueWillMove` now mirrors `BattleQueue.willMove` beside `unresolved` in `battleTurn`, and
every clause of that `if` reads it — #60 (priority), #180 (mustrecharge) and this one. Both members of
`failsIfTargetNotAttacking` call the same authority function and the tag's own membership rule is the
regex `/willMove\(\s*target\s*\)/`, so a third member printed later is covered without an edit.
Shown red with a knob-cleared control: 85 / 85 across the arms before, 0 / 85 after, and
`MEDI_SUCKER_QUEUE_BLIND=1` puts it back. The authority was asked the exact board and prints
`|-fail|p1a: Kingambit`. Four whole-game divergences on release `3d9df7ce4996` in all three arms with
two KOs; ZERO on release `0faabe2a3f1b`. Probe: `tests/test-mechanics.js`
`move/failsIfTargetNotAttacking` — 'Sucker Punch ALSO fails into a target that has ALREADY MOVED this
turn (the queue clause)'."*

**AMEND #144 (or a new row if #144 is closed)** — *"STRUGGLE WAS PRICED AT ITS PRINTED TYPE BY THE
DAMAGE PATH, WHICH IS THE HALF #144 NEVER REACHED. `effMoveType` has honoured `setsOwnTypeAlways`
since #144; `dmgRangeOneHit` opened `let mvT = mv.t` and never asked — the duplication
`formeMoveType`'s own header names. ALL SEVEN residual rows of `tests/test-engine-diff.js
--n 6000 --seed 20260804`, in two shapes: six unearned x1.5 STAB (`ditto struggle -> clawitzer`,
Showdown 11-14 against 16-21) and one Normal→Ghost immunity the authority does not have
(`gallade struggle -> gengar`, Showdown 51-60 against 0-0). Fixed in the engine; `data/engine-data.js`
carries `t:"Normal"` and is CORRECT — that is the dex's printed type and the `???` arrives from the
move's own `onModifyMove` at use time. Differential 7 of 6000 → 0 of 6000 across all seventeen arms.
Knob `MEDI_DMG_OWNTYPE_BLIND=1`. Membership measured over the whole dex: of ten moves assigning a
literal `move.type`, five are Past and four of the five legal ones are conditional with their own
tags — exactly one is unconditional and it is Struggle. Probe: `tests/test-mechanics.js`
`move/setsOwnTypeAlways`."*

**UPDATE the board-materiality figure** — *"RE-MEASURED 2026-08-23 on release `0faabe2a3f1b` with the
same three pins: 73 parted of 961 (middle), 30 board-material, 43 narration-only, 0 unknown; minus 9
instrument (Moody 8, off-field body 1) = 21 ENGINE BOARD-MATERIAL, in 28 causes. Per arm: middle 21,
top-tie-first 18, bottom-tie-first 18. RE-BASELINE and not a delta against 27 — the engine and the
release both moved. Still a LOWER BOUND: the planted-state proof has not passed."*
