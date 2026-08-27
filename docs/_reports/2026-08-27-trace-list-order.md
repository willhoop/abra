# Trace: is it the candidate LIST or the DIE? — 2026-08-27, ENGINE

**THE LISTS MATCH, ELEMENT BY ELEMENT. The brief's hypothesis is refuted.**

Over 60 pinned-pool boards, both engines' `possibleTargets` read at the moment of the draw:

```
THE LISTS, ELEMENT BY ELEMENT — 139 joined draw(s)
  identical list (same members, same order)   139
  MEMBERSHIP differs                          0
  ORDER differs, same members                 0
```

Zero membership differences, zero order differences, at every list length. Trace has never picked from
a different set of foes and has never picked from the same set in a different order. Every wrong copy
this engine has ever made is an **address** problem — the two engines name the same event differently,
so `nth` differs, so the shared die yields a different value, so an identical index expression indexes
a different body.

Instrument: `tests/probe_trace_list.js`. The medicham half reads the array `traceCopy` actually built,
through a new door (`traceListSink`) rather than re-deriving it; the authority half wraps
`Battle#sample` and claims the call only when `battle.effect.id === 'trace'`.

**The control was wrong first, and the wrong control was a finding of its own.** Version one played
each board twice in the same process — hooked, then unhooked — and reported *23 of 40 boards perturbed
by the hooks*. That number was the driver's coverage steering (`COV_CREDIT` is module state every game
mutates), not the hooks. The control is now a child process replaying the identical sweep in the
identical order from a fresh module state: **0 of 60 boards moved.**

---

## What was actually wrong — two spurious draws, both now fixed

Both are the same shape: **this engine consumed a die at an address where the authority consumes
none**, and under the middle arm's `seed|turn|cat|move|target|nth` addressing a spurious draw pushes
every later `any` draw of that turn onto the next `nth`.

### 1. Trace draws at list length 1 — ROADMAP #496

`PRNG#sample` (`sim/prng.ts:132`) is `items[this.random(items.length)]` and `PRNG#random` (`:91`)
calls `this.rng.next()` **unconditionally**. A one-element list still costs the authority a draw. This
engine's guard was `if (eligible.length > 1)`, because with one candidate the answer is forced — true,
and irrelevant to the address.

Measured before the fix: the authority sampled a one-element list **9 times** while this engine took
**57 dice for 66 copies**. Four of 57 two-candidate cells then drew a different index, every one on a
board with a Trace body on **both** sides — the only shape where a skipped draw and a real choice share
one address.

After: `traceChoiceDie` equals `traceCopied` (139/139), and the two lead-in cells agree.

Knob `MEDI_TRACE_SOLO_NODRAW=1` restores the skip; the red arm reports 2 draws parting, 9 copies with
no die, lists still identical.

### 2. Quick Claw rolled on actions the authority never runs the event for — ROADMAP #497

Found by instrumenting the actual whole-game divergence. On the `omit-spread` mirror-Gardevoir game,
turn 2:

```
20260813|2|any|-|-|0   <- battleTurn, the fractionalPriority loop, on a SWITCH action
20260813|2|any|-|-|1   <- traceCopy      (the authority's took |0|)
20260813|2|any|-|-|2   <- traceCopy      (the authority's took |1|)
```

`u(|0|) = 0.508` and `u(|1|) = 0.047`, so the first Gardevoir read 0.047 instead of 0.508 and indexed
the other foe. The **second** Gardevoir then traced the first one — which by then held the wrongly
copied ability — which is why both bodies read the same wrong ability and why it looked like a Trace
defect firing on both sides at once. One root, two symptoms.

`sim/battle-queue.ts:249` runs the FractionalPriority event inside the MOVE branch of `resolveAction`;
the `['switch','instaswitch']` branch beside it never reaches the line. This engine rolled for every
action kind, which its own source declared and deferred ("a separate change with a separate probe").

**A correction that had to be measured, not read.** The comment — and this agent's first version of
the fix — read `if (priority <= 0 && this.randomChance(1, 5))` in `data/items.ts` as the *move's*
priority. It is not. The call is `runEvent('FractionalPriority', action.pokemon, null, action.move, 0)`
and the handler's first parameter is the **relay var**, i.e. what an earlier handler returned. The
probe's HIGHPRI arm caught it: the authority takes a draw on a priority-1 move, with a no-claw control
on the same board taking none. So the gate is "is this a move action" and nothing else.

Instrument: `tests/probe_fractional_priority_draw.js`, four arms, all derived from the format —
SWITCH (0/0), HIGHPRI (1/1), NORMAL (1/1, the over-fire control), NOCLAW (0/0, the attribution
control). Knob `MEDI_FRACPRI_UNGATED_DRAW=1` parts SWITCH only.

---

## The measured result

| | before | after |
|---|---|---|
| board-material | 9 of 961 | **7 of 961** |
| whole-game (raw − declared) | 10 (15 − 5) | **9 (14 − 5)** |
| census | 765 live / 765 probed / 0 missing | unchanged |
| damage | 0/6000 at all sixteen corners | unchanged |
| roster items / abilities / moves | 139 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | unchanged |
| pin digest | `44bd49403231` | unchanged |
| census pin / team-pool digest | `9446a684709d` / `0d103fb9fa87` | unchanged |

Release `9dc79a4d459b`, arm `middle`, `--games 1200` (yields 961), `--turns 12`,
`--team-store data/team-pool-frozen`, `--census data/verification/census-pin-9446a684709d.json`,
`--state --end-state`.

**Two predictions and one of each.** Board-material 9 → 7 was predicted and landed. Whole-game was
predicted **not** to move (both target rows carry `protocol_diverged_at_turn: null`) and it moved
10 → 9 — the claw fix changed the dice of a game whose protocol had parted, which the prediction did
not allow for.

**`PIN_DIGEST` and `DICE_MODEL` deliberately did NOT move.** They identify the INSTRUMENT — which arm,
which pinning, which hash. This change is in the ENGINE, and the engine is identified by the release
id, which `engine/arms_comparable.js` explicitly expects to differ ("that is the thing under test").
Moving the pin would have made the before/after incomparable in exactly the way the rule exists to
prevent.

**Two rows closed and only one of them was diagnosed.** The `omit-weather` Scovillain boosts row
(`p2.scovillain.boosts` t2) also went, and it is not on this brief. The claw fix changes the `nth`
sequence of any turn where a claw holder acts, so that game's dice moved; whether that row was the same
root or merely re-rolled into agreement is **not** established here and must not be claimed.

---

## The one target row that did NOT close, and whose it is

`baseline t7 p2.gardevoir.ability medicham goodasgold / showdown innerfocus` — still open, and it is
**ROADMAP #478**, not Trace. Measured on the authority's own draw log for that game:

```
t7 sample([2]) eff=-      Side.randomFoe<-Battle.getRandomTarget<-BattleQueue.resolveAction
t7 sample([2]) eff=-      Side.randomFoe<-Battle.getRandomTarget<-Battle.getTarget
t7 sample([2]) eff=trace  Battle.onUpdate<-Battle.singleEvent<-Battle.onStart
t7 sample([2]) eff=-      Side.randomFoe<-Battle.getRandomTarget<-Battle.getTarget
t7 sample([2]) eff=-      Side.randomFoe<-Battle.getRandomTarget<-BattleActions.runMove
```

Two `getRandomTarget` draws land in `|7|any|-|-` ahead of Trace, so the authority's Trace takes
`nth = 2` and ours takes `nth = 0`. On turns 1, 3, 5 and 9 the random-target draws fall after Trace
and the two engines agree — which is why the same Gardevoir copies correctly four times and wrongly
twice in one game. `probe_trace_list.js` refuses every draw on a turn `getRandomTarget` touched, by
name, and reports the refused population (14 of 153 draws) rather than absorbing it.

---

## OWED, NOT RUN

- **The claw's EFFECT gate is still wrong and is now counted, not fixed** —
  `MEDFAILS.fracPriPriorityGateUnmodelled`. `_fpOk` refuses the nudge on a move whose printed priority
  is above 0; the authority's `priority <= 0` is a test on the relay var and it applies there too. The
  DIE now agrees on every move action; the OUTCOME does not. Filed as ROADMAP #498. **The population
  was not measured over the pinned pool in this session** — only the counter was added.
- **Mycelium Might's early return is not modelled** — `MEDFAILS.fracPriMyceliumDrawUnmodelled`, counted
  and never staged. `quickclaw` returns before the roll when the move is Status and the holder has it.
- **The claw's relay ORDER is not modelled.** The authority runs the ability handler (-1) before the
  item's (-2); this engine draws the item first. Under the relay reading that matters — a Quick Draw
  that already fired makes the relay positive and the claw does not roll at all.
- **The `omit-weather` Scovillain row was not diagnosed**, only observed to have gone. If it returns
  under a later dice change nobody will know why it left.
- **The whole-game prediction was wrong and the reason was not chased.** Which of the 15 raw
  divergences became 14 is recorded in the artifact but was not attributed to a mechanism here.
- **`probe_trace_list.js` runs a Trace-heavy pairing, not the swarm's.** It pairs carrier teams against
  each other deliberately so the mirror board is common; that is the right fixture for the question and
  it is **not** a usage-weighted sample of anything.
- **The differential was not re-run under `--baseline`.** The before artifact was copied by hand to the
  scratchpad; the comparability guard was not exercised.
