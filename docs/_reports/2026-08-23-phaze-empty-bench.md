# A phaze move into an empty bench — the differential, both doors

ENGINE, 2026-08-23. Light mode: staged boards only. No `quarantine.js`, no `status.js`, no
`game_differential.js` sweep, no `all_mechanics_fire.js`, no `roster.js`, no test batch.

Probe: **`tests/probe_phaze_empty_bench.js`** (new, this pass).
Run: `SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_phaze_empty_bench.js`

---

## 0. Which scoreboard, said before the run

**The LAB.** A phaze into an empty bench needs three of a side's four bodies dead with two still
standing. The pinned pool of real ladder games is not expected to move, and no claim is made that it
does — no usage figure was derived for the empty-bench case and none is asserted.

The second finding below (a type-immune target still being dragged) is a different matter and could
plausibly reach the pool, but that was **not measured** here and is on the OWED list.

---

## 1. Legality — which moves were tested

Read from the running format, not recalled:

```
SHOWDOWN_PATH=... node -e "... Dex.forFormat('gen9championsvgc2026regmb') ..."
roar        exists true  isNonstandard null  Status    bp 0   pri -6  forceSwitch true  sound
whirlwind   exists true  isNonstandard null  Status    bp 0   pri -6  forceSwitch true  wind
dragontail  exists true  isNonstandard null  Physical  bp 60  pri -6  forceSwitch true  contact
circlethrow exists true  isNonstandard null  Physical  bp 60  pri -6  forceSwitch true  contact
```

All four are **legal in Reg M-B** (`isNonstandard: null`). Champions overrides none of them —
`data/mods/champions/moves.ts` has no `roar`, `whirlwind`, `dragontail` or `circlethrow` key.

**Tested: `roar` (the status door) and `dragontail` (the damaging door).** Whirlwind and Circle Throw
were NOT staged; they are the same `move/forcesSwitch` tag, the same two branches and the same code
path, but that is an argument, not a measurement, and it is recorded as such.

`data/tags.json` already carries `forcesSwitch` on all four, so `grep` finding nothing about "empty
bench" in `medicham2-browser.js` was never evidence — the engine matches on tag shape.

---

## 2. What the AUTHORITY does — derived from the source, whole blocks read

The empty-bench check is **not at the `DragOut` site**. It is `this.battle.canSwitch(target.side)`,
and it is asked in two different places, which is why the two doors answer differently.

```
sim/battle.ts:1563   canSwitch(side) { return this.possibleSwitches(side).length; }
sim/battle.ts:1571   possibleSwitches walks side.pokemon from index side.active.length upward,
                     skipping only the fainted -> THE BENCH ONLY.
```

So in this doubles format "nothing in the back" means **both benched slots fainted while two bodies
are still standing**. `side.pokemonLeft` is 2, not 0.

### Door A — step 6 of `spreadMoveHit` (both halves reach it)

```
sim/battle-actions.ts:1104  if (moveData.forceSwitch) damage = this.forceSwitch(damage, targets, ...)
sim/battle-actions.ts:1353  for (const [i, target] of targets.entries()) {
                              if (target && target.hp > 0 && source.hp > 0 &&
                                  this.battle.canSwitch(target.side)) {
                                const hitResult = this.battle.runEvent('DragOut', target, source, move);
                                if (hitResult) { target.forceSwitchFlag = true; }
                                else if (hitResult === false && move.category === 'Status') {
                                  this.battle.add('-fail', source);
                                  this.battle.attrLastMove('[still]'); damage[i] = false; }
                              } }
```

An empty bench skips the **whole body**: no `DragOut` event, no flag, and **no `-fail`** — the
`-fail` there lives on the `hitResult === false` arm, which is never reached. **Suction Cups'
`-activate` therefore cannot fire either**, because it is `onDragOut` and the event never runs.

### Door B — `runMoveEffects`, and this is where the two doors part

```
sim/battle-actions.ts:1190  let didAnything = damage.reduce(this.combineResults);
sim/battle-actions.ts:1260  if (moveData.forceSwitch) {
                              hitResult = !!this.battle.canSwitch(target.side);
                              didSomething = this.combineResults(didSomething, hitResult); }
sim/battle-actions.ts:1303  if (!didAnything && didAnything !== 0 && !moveData.self && !moveData.selfdestruct)
                              if (!isSelf && !isSecondary)
                                if (didAnything === false) { this.battle.add('-fail', source);
                                                             this.battle.attrLastMove('[still]'); }
```

`combineResults` (`sim/battle-actions.ts`, the priority list
`['undefined', 'string', 'object', 'boolean', 'number']`) decides the split:

| door | `damage[i]` entering `runMoveEffects` | `didAnything` after the forceSwitch clause | announced |
|---|---|---|---|
| **STATUS** (Roar) | `undefined` — `getDamage` returns undefined for a Status move | `combineResults(undefined, false)` = **`false`** | **`-fail` on the MOVER + `[still]`** |
| **DAMAGING** (Dragon Tail) | a **number** | `number` outranks `boolean`, so the number is kept | **nothing** |

**So the authority's own answer is asymmetric, and that asymmetry is the whole question.** A Roar
into an empty bench announces a failure; a Dragon Tail into an empty bench deals its damage and says
nothing at all.

---

## 3. The fixture — constructed, not found

A bench cannot be attacked, so the empty bench is reached the way a real game reaches it: the two
front bodies kill themselves with **Memento** (`selfdestruct: 'ifHit'`, `data/moves.ts`; Champions
does not override it), the two benched bodies come up as their replacements, and the back is then
empty with two bodies alive.

Three arms, differing in **one click on turn 1**:

| arm | turn-1 p2 clicks | bench before the phaze |
|---|---|---|
| BENCH 2 | idle, idle | 2 |
| BENCH 1 | Memento, idle | 1 (the near-miss case the brief asked for) |
| BENCH 0 | Memento, Memento | 0 |

and every arm is played through **both doors**.

**The knob is asserted in the AUTHORITY's own count** (`possibleSwitches` re-implemented from
`sim/battle.ts:1571`), and it reads `2, 1, 0` on both doors. Identical output across a varied knob
would mean the fixture is unwired, not that the depth does not matter.

Cast, every carriage claim from `champions_sim.canLearn` (TeamValidator) and printed on every run:
Tyranitar (Unnerve — not Sand Stream, which would chip every body), Ninetales + Spiritomb (the
Memento pair), Weavile (Pickpocket — not Pressure, which takes two PP and PP is a compared board
leaf) + Garchomp (Sand Veil — not Rough Skin, which would put contact damage on the phazer), Clefable
(Magic Guard — Cute Charm is gender-gated and the rig is genderless).

### The fixture was wrong twice first, and both were caught by the probe rather than reasoned away

1. **p1 clicked Protect on turn 1.** Memento carries `flags.protect`, so it was refused and nobody
   fainted — all three arms read bench 2 and the probe said `THE KNOB MOVED ... it is [2, 2, 2]`.
2. **The first Memento pair were Whimsicott (Grass/Fairy) and Gardevoir (Psychic/Fairy).** Dragon
   Tail is a DRAGON move, so the type chart refused it in every arm and the damaging door measured
   nothing about the bench at all. That accident is finding 2 below.

Both are claims about the fixture, never about the mechanic.

---

## 4. FINDING 1 — the empty bench. BOARD: agree. NARRATION: one divergence.

### BOARD — the bar. **No divergence, either door, at any bench depth.**

| door | bench 2 | bench 1 | bench 0 |
|---|---|---|---|
| Roar | identical | identical | identical |
| Dragon Tail | identical | identical | identical |

and the controls clear: at bench 2 **both engines stage a real `|drag|`** on both doors, so
"identical" is not agreement about a move that never fired. At bench 0 the two engines **agree on
whether a drag happened** (neither drags) on both doors.

Illustrative, Roar / bench 0, `sd pokemonLeft 2`:

```
after turn 1: p2 active  sd [weavile@145, garchomp@183]   me [weavile@145, garchomp@183]
              p2 bench   sd []                            me []
after turn 2: p2 active  sd [weavile@145, garchomp@183]   me [weavile@145, garchomp@183]
```

### NARRATION — one divergence, in the STATUS door only

```
ROAR / BENCH 0
  showdown  ... |move|p1a: Tyranitar|Roar||[still]   |-fail|p1a: Tyranitar
  medicham  ... |move|p1a: Tyranitar|roar|p2a: Weavile        (and nothing after it)

DRAGON TAIL / BENCH 0
  showdown  ... |move|p1a: Tyranitar|Dragon Tail|p2a: Weavile   |-damage|p2a: Weavile|127/145
  medicham  ... |move|p1a: Tyranitar|dragontail|p2a: Weavile    |-damage|p2a: Weavile|127/145
  -> AGREE, and it agrees for the RIGHT reason: the authority is silent here by derivation.
```

Two parts to the one divergence: the **missing `-fail`**, and the missing **`[still]`**, which blanks
field 4 of the preceding `|move|` line in the authority's own stream.

**Why medicham2 is silent.** `medicham2-browser.js`, the `kind==='phaze'` branch: the drag runs
`switchOut(_foes, _i, _fb, _own, _fsf, field, _lb.length ? _lb[...] : null)` and `switchOut` opens
with `if (!_live(bench).length) return null;`. The refusal is real and the board is right — but it
happens **inside** the switch helper, below the `else mvFail(m)` arm, so nothing announces it.

### One caveat that stops this being called narration-only

`mvFail` also writes `m._mvRes`, which is this engine's `moveThisTurnResult` and is what Stomping
Tantrum reads next turn. `board_state.js` does not compare it, so **the boards agreeing does not
prove `_mvRes` agrees.** This is the exact hazard the file already records at the Suction Cups site
(*"what the authority does to `moveThisTurnResult` on a `null` drag ... was NOT staged in this pass,
and the 2026-08-12 retraction is what happens when a state change rides in on a narration fix"*).

**So this was NOT fixed in this pass**, and that is the reason.

---

## 5. FINDING 2 — LANDED. A refusal removed the target and the damaging phaze dragged it anyway.

**This is board-material and it is fixed.** It was found by the fixture being wrong, which is the
only reason it was looked at.

### The defect

`medicham2-browser.js`, the damaging half of `forcesSwitch`:

```js
for(const tg of targets){                       // <- the list as it stood BEFORE the step list
  if(!tg||tg.fainted||tg.curHP<=0)continue;
```

`targets` at that point has only had the **Protect** filter applied. The authority, by contrast, has
been zeroing its array all the way down:

```
:1063  a hit a SUBSTITUTE ate becomes  targets[i] = null
:1080  for (const i of targets.keys()) if (damage[i] === false) targets[i] = false;
:1353  forceSwitch walks targets.entries() and `if (target && target.hp > 0 ...)` skips both
```

So a body the type chart refused, the accuracy die missed, an absorbing ability ate, a move-class
immunity blocked, or a Substitute took, is **not in the array** when the drag is attempted here — and
was still in ours.

Measured on the staged board **before a byte moved**, Tyranitar's Dragon Tail into a pure-Fairy
Clefable with a **full** bench:

```
showdown  |move|p1a: Tyranitar|Dragon Tail|p2a: Clefable   |-immune|p2a: Clefable
medicham  |move|p1a: Tyranitar|dragontail|p2a: Clefable    |-immune|p2a: Clefable
          |drag|p2a: Weavile|weavile, L50|145/145

board diffs at that boundary:
  p2.active[0].species   medicham "weavile"  showdown "clefable"
  p2.active[0].hp/maxhp  145/145             170/170
  p2.active[0].types     dark/ice            fairy
  p2.active[0].ability   pickpocket          magicguard
  p2.party.clefable.boosts.spa/spd  0 / 0    1 / 1     <- its Calm Mind was wiped by our switch-out
```

A different Pokemon is standing in the slot from that turn on, **and** the refused body lost its
boosts to a switch that never happened.

### The fix, and the class it is written as

The loop now walks the **survivor set** the step driver itself walks:

```js
for(const R of _rows){
  const tg=R.tg;
  if(R.out){MEDSEEN.forcedSwitchTargetRemoved++;continue;}
  if(!tg||tg.fainted||tg.curHP<=0)continue;
```

`R.out` is set at **six** sites in this engine — type immunity, move-class immunity, invulnerability,
an absorbing ability, the accuracy miss, and the substitute. A guard written as `if (immune) continue`
would have closed exactly the one case that was staged and left the other five open; reading the same
flag `for(const _step of _STEPS)for(const R of _rows){if(R.out)continue;...}` reads means **a seventh
refusal added later is honoured with no edit here.** That is the answer to "would a gate written from
this instance catch a second one spelled differently": the *fix* is class-shaped. The *probe* is not —
it stages the type-immunity member only, and the other five are named in the code comment and on the
OWED list rather than claimed.

New counter `MEDSEEN.forcedSwitchTargetRemoved`, because a guard that fires silently and a guard that
was never reached look identical from outside.

**The status door is untouched.** Roar never enters the step list; its branch carries its own
`tryHitRefusal`, `shieldRefuses` and `moveClassBlocked`.

### RED then GREEN, with the control cleared explicitly

```
BEFORE   IMMUNE  (Fairy)      sd dragged=false   me dragged=true    board identical: NO
         CONTROL (Ninetales)  sd dragged=true    me dragged=true    board identical: YES
AFTER    IMMUNE  (Fairy)      sd dragged=false   me dragged=false   board identical: YES
         CONTROL (Ninetales)  sd dragged=true    me dragged=true    board identical: YES
```

The control is the **same click on the same board** at a non-immune target, so "nobody moved" cannot
be the fixture failing to click.

**No existing probe regressed.** `tests/probe_drag_body.js` — the Suction-Cups-through-both-doors
probe from ROADMAP #341 — is green on the live tree after the change (every clause held, both doors
`AGREE`). Its first run in this session was accidentally opened against an OLD scratch snapshot
(`fda4b805651e`, a pre-#341 release sitting in the shared temp store) and showed the pre-#341
behaviour; re-run against a fresh cut of the live tree it is clean. **That is worth recording: the
shared `_live_release` scratch store carries other sessions' snapshots, and naming one silently
measures somebody else's bytes.**

---

## 6. FINDING 3 — MEASURED, NOT FIXED. Suction Cups announces itself with an empty bench.

`docs/ENGINE.md`'s hand list has carried this since 2026-08-22 as a measured-but-unfixed note. It now
has a probe and a knob-cleared control, and it is the **same root as finding 1**: the authority asks
`canSwitch` *first* and this engine asks the ability first.

```
ROAR / BENCH 1  (control — the refusal is CORRECT here)
  showdown  ... |-activate|p2a: Malamar|ability: Suction Cups
  medicham  ... |-activate|p2a: Malamar|ability: Suction Cups          -> byte-identical

ROAR / BENCH 0
  showdown  ... |move|p1a: Tyranitar|Roar||[still]   |-fail|p1a: Tyranitar
  medicham  ... |move|p1a: Tyranitar|roar|p2a: Malamar   |-activate|p2a: Malamar|ability: Suction Cups

DRAGON TAIL / BENCH 1  (control)
  showdown  ... |-damage|p2a: Malamar|141/161  |-activate|p2a: Malamar|ability: Suction Cups
  medicham  ... |-damage|p2a: Malamar|141/161  |-activate|p2a: Malamar|ability: Suction Cups

DRAGON TAIL / BENCH 0
  showdown  ... |-damage|p2a: Malamar|147/161                          (and nothing after it)
  medicham  ... |-damage|p2a: Malamar|147/161  |-activate|p2a: Malamar|ability: Suction Cups
```

**Boards identical in all four arms.** The control moving from byte-identical (bench 1) to divergent
(bench 0) on *both* doors is what makes this a statement about the bench rather than about the
ability.

Malamar is the only legal Suction Cups carrier in Reg M-B and is brought 1,340 times across the two
human stores (figure carried from ROADMAP #341, not re-derived here).

**Not fixed, and the reason is the same `_mvRes` caveat as finding 1** — the correct fix hoists an
empty-bench gate above the refusal checks in both branches, and whether it should also write
`m._mvRes` is a STATE question that has not been staged.

---

## 7. Is any of this already registered?

- **Finding 1 (the empty-bench `-fail`)** — no row. `grep` over `docs/ROADMAP.md` for the empty bench
  returns only #227 and #229, which are about `battleInit` slicing its own bench in a *fixture*.
- **Finding 2 (a refused target still dragged)** — no row. #341 is the adjacent case (Suction Cups
  through the damaging door) and is CLOSED; this is the same branch and a different refusal class.
  **The brief asked whether the empty-bench check and the Suction Cups check share a site: they do
  not.** Suction Cups is an `onDragOut` refusal read from `data/tags.json` inside each branch; the
  empty bench is `canSwitch`, which the authority asks *above* `DragOut` in both doors. They are one
  ORDERING problem, not one site.
- **Finding 3** — on `docs/ENGINE.md`'s hand list, no ROADMAP row.
- **#340** (bench order) and **#365** (the differential mirroring a forced switch by species name) are
  both untouched by this pass. #340 is green on the live tree (`probe_drag_body.js`).

---

## 8. OWED, NOT RUN — as commands

Light mode forbade all of these. None of them was run and no figure from any of them is claimed.

```
node tests/test-mechanics.js
node engine/status.js
node engine/status.js --write
tools\lownode.cmd engine\quarantine.js
tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804
SHOWDOWN_PATH=... node engine/game_differential.js --release <fresh id> --team-store data/team-pool-frozen --state
SHOWDOWN_PATH=... node tests/roster.js
```

Specifically owed and why:

1. **`node tests/test-mechanics.js`** — the census must be regenerated after an engine change and the
   live count confirmed not to have gone down. Inspected by hand, none of the six existing
   `forcesSwitch` / `refusesForcedSwitch` / `phazeDragIsADie` / `soundSealBlocksEveryKind` probes
   stages an immune, missed, or substituted target, so none should be affected — **but inspection is
   not a run.**
2. **`node engine/status.js --write`** — the GENERATED block in `docs/ENGINE.md` is one restamp behind.
3. **A whole-game differential on the pinned pool**, to say whether finding 2 moves the pool. The
   expectation stated before any run: an immune/missed damaging phaze is uncommon, so the lab should
   move and the pool may not. **No usage figure is asserted.**
4. **The commit.** Not made: another agent had in-flight edits to `CLAUDE.md`,
   `data/open-work.json`, `engine/gate_fail_and_silent.js` and `engine/register_reality.js` in the
   same tree, and the pre-commit hook reads the whole tree. Files to add **by name**:
   ```
   git add engine/medicham2-browser.js tests/probe_phaze_empty_bench.js docs/ENGINE.md CHANGELOG.md docs/_reports/2026-08-23-phaze-empty-bench.md
   ```
5. **Whirlwind and Circle Throw** were not staged. Same tag, same branches — an argument, not a
   measurement.
6. **The other five `R.out` members** (miss, invulnerability, absorbing ability, move-class immunity,
   substitute) are covered by the fix's shape and are not each probed.
