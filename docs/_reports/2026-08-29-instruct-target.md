# The instructed repeat re-picked its target — ROADMAP #534, closed. 2026-08-29, ENGINE

Batch of one. The authority builds Instruct's second action with `targetLoc: target.lastMoveTargetLoc`
— **the slot the click already named**. This engine threw that away and ran `targetForMove`, a
best-damage heuristic, so the second swing landed on a different body.

---

## THE PREDICTION, WRITTEN BEFORE ANY RUN

| scoreboard | prediction | outcome |
|---|---|---|
| **Census** (lab) | **UNMOVED at 801 live / 801 probed / 0 missing.** No new tag is wired: `instructsTarget` and `targetClass` are both already LIVE, and this adds a reader for one of them. | **HELD** — 801 / 801 / 0 |
| **Pool** (empirical, 961 games) | **board-parted UNMOVED at 91.** The empirical driver aims at the first live foe, i.e. foe slot 0 — which is exactly where the old status fallback `live(_foes)[0]` already sent the repeat, so the status half of this defect **cannot appear in the pool at all**. The damaging half needs an Instruct AND a click whose aimed slot is not the one the damage heuristic prefers, on 306 sheet slots. | **MISSED** — 91 -> **90**, by one, in the improving direction |
| **Lab** | `probe_instruct_target.js` 14 arms / 0 failing; `probe_instruct_shield.js` 13 / 0 with its KNOWN-OPEN arm promoted to a counted control. | **HELD** — 14/0 and 13/0/0 |

---


Full account: `docs/_reports/2026-08-29-instruct-target.md`. Release `705ead2014b2` -> **`e8f7c7dba595`**.

**THE AUTHORITY, READ WHOLE RATHER THAN RECALLED.** Instruct queues

```
this.queue.prioritizeAction(this.queue.resolveAction({
  choice: 'move', pokemon: target, moveid: target.lastMove.id,
  targetLoc: target.lastMoveTargetLoc,                              data/moves.ts:9666-9671
}));
```

`lastMoveTargetLoc` is written by `Pokemon#moveUsed(move, targetLoc)` (`sim/pokemon.ts:919`), whose
ONE caller is `runMove` (`sim/battle-actions.ts:291`) and whose argument is `action.targetLoc` — the
signed relative slot the click named. It is the RAW CHOICE: `OverrideAction` (Encore) and the
`randomNormal` re-roll both change which body is hit and neither writes back.

**CHAMPIONS REWRITES NONE OF THE CHAIN, AND THE PROBE ASKS ON EVERY RUN** rather than trusting this
sentence: Instruct is not among the 259 overridden moves, and the mod's `scripts.ts` overrides
`init`, `statModify`, `calculatePP`, five `pokemon` members and five `actions` members — and NOT
`runMove`, `getTarget`, `getRandomTarget`, `resolveAction` or `moveUsed`. The probe exits 2 if that
ever stops being true, because the source reads above would then be the wrong rulebook.

### IT SHARES A DOOR WITH THE FIX TWO BATCHES AGO, AND ONLY HALF OF IT

The brief asked whether this goes through the same selector as the three default-target draws that
all started at `randomFoe()`. **It does not.** `defaultTargetOf` answers *"a move was used with NO
chosen target — what does its own class default to"*; this site answers *"a move was used WITH a
chosen target — where was it"*. Different authority functions (`getRandomTarget` against `getTarget`),
different engine functions, no shared code.

**What IS shared is the artifact both now read.** `defaultTargetOf` classifies by
`targetClass.target`; `aimTravelsByLoc` classifies by the same field for a different question. That
is one derived fact with two readers, which is the rule, rather than two derivations of one fact.

### THE SLOT-VS-BODY QUESTION IS ANSWERED BY THE AUTHORITY, AND IT HAS THREE CLAUSES

`Battle#getTarget` runs at RUN time — `runMove`'s first line — not when the action was built:

| the loc now holds | the authority | here |
|---|---|---|
| a LIVE body, whoever it is | it is hit | reused (`instructAimReused`) |
| a fainted FOE | falls through to `getRandomTarget` | retargeted (`instructAimSlotVacated`) |
| a fainted ALLY | returned as-is; the move fails on it | **NOT expressed** — `playerAction` cannot price a click against a dead body. Counted on `instructAimFaintedOccupant`, unreachable from the driver's script format, and OWED |

The first two are `reaimToSlot`, which is this engine's reading of exactly that source and already
serves the thirteen sites that resolve a slot at execution. **Instruct becomes its fourteenth caller
rather than a second implementation** — the same shape as #532, one branch lower.

### THE READ IS GATED ON THE MOVE'S CLASS, AND THE MEMBERSHIP IS PRINTED

`resolveAction` fills a `targetLoc` for EVERY move, spread ones included, and `getMoveTargets` then
answers `allAdjacentFoes` from the field and never looks at the returned body. Spending the slot
there would move which body `playerAction` PRICES the action against and change nothing the authority
does — a behaviour change dressed as a fix. `aimTravelsByLoc` reads `targetClass.target` out of the
artifact, and the probe prints the whole split before it is trusted:

```
BY LOC  normal 339 | any 16 | adjacentAlly 4 | adjacentAllyOrSelf 1     -> 360 of 500 spend the loc
inert   self 60 | allAdjacentFoes 22 | all 17 | allAdjacent 16 | allySide 8
        randomNormal 6 | scripted 4 | foeSide 4 | allies 2 | allyTeam 1  -> 140 do not
```

`randomNormal` is out by the authority's own clause (`move.target !== 'randomNormal'`, `battle.ts:2461`).
`scripted` is out by a stated JUDGEMENT: `validTargetLoc` accepts it, but Counter and Mirror Coat are
built by `playerAction` as COUNTED rather than aimed, so a slot handed to them would move a priced
body for no modelled gain. Four moves, counted, and OWED.

### THE SECOND ROAD IS NOT IN THE ROW'S FILING AND IT IS THE WIDER ONE

`targetForMove` opens `if (!mv || !hasPower(mv)) return null` — its job is to RANK FOES BY DAMAGE — so
a single-target STATUS repeat got nothing back and fell to the literal `live(_foes)[0]`: **foe slot 0,
unconditionally, for 73 of the 355 legal single-target moves.** Derived and printed. A fix that only
reused the aim on the damaging road passes three of this file's five red arms.

### THE PROBE: 14 ARMS, 5 RED, 9 CONTROL, 0 FAILING

Every arm plays TWICE — clean and under `MEDI_INSTRUCT_NO_AIM_REUSE=1` — so a red arm *agrees clean
and PARTS under the knob* and a control agrees under both. Which slot the old road preferred is never
typed: the knob decides, so a damage heuristic that shifts later re-classifies an arm loudly instead
of silently making it vacuous.

| red arm | what it separates |
|---|---|
| `aim-slot0-damaging` | no shield on the board at all, so it cannot be read as more of #532 |
| `aim-slot1-damaging` | **the other direction** — Dark Pulse makes the heuristic prefer slot 0, so a fix that hard-coded "repeat at slot 0" passes every other red |
| `aim-slot0-into-shield` | the filed board's shape: the repeat eats a Protect that was never in its way |
| `aim-slot1-status` | the `live(_foes)[0]` road, a different line of code |
| `aim-slot1-status-shielded` | separates "went to the wrong body" from "did nothing" |

| control | the over-fire it rules out |
|---|---|
| `agree-slot1-damaging`, `agree-slot0-damaging` | **re-picking and reusing give the SAME answer**, one per slot. `instructAimReused` asserted at 1, so the arm proves the road was TAKEN rather than skipped |
| `agree-slot0-status` | the status fallback was already right when the aim WAS slot 0 |
| `aimed-slot-vacated` | the ROADMAP #223 fallback, staged by a same-turn faint — the only road to a vacated slot, because a switch resolves before every move |
| `spread-repeat`, `self-aim-repeat` | the two slotless classes |
| `aim-stale-across-turns` | turn 1 aims at slot 1, turn 2 at slot 0. A recording read without checking WHICH move it belongs to parts here |
| `no-last-move` | no repeat at all, so every new counter must read 0 |
| `shield-refuses-instruct` | #532 still answers first and this knob does not reach it |

**TWO DECLARATIONS WERE WRONG BEFORE THE ENGINE WAS, AND BOTH ARE RECORDED IN THE ARMS.** The
vacated arm declared `instructAimRepicked: 1` — `reaimToSlot` does the authority's retarget INSIDE
itself, so the old road is never reached. And it caught the classifier: the engine reported `reused`
on a board where the aimed body was visibly on the floor, because a live return says nothing about
WHICH body it is. The spread arm declared "a spread click records no slot" — it does record one, and
what makes the loc inert is the CLASS.

### THE POOL MOVED, AND THE MOVEMENT IS KNOB-CONTROLLED RATHER THAN DIFFED

| | baseline (`705ead2014b2`) | knob arm (`e8f7c7dba595`, revert) | fixed (`e8f7c7dba595`) |
|---|---|---|---|
| board-parted | 91 | **91** | **90** |
| protocol diverged | 205 | 205 | 205 |
| threw | 2 | 2 | **1** |
| turn boundaries identical | 10252/10565 | 10252/10565 | 10260/10566 |

The knob arm reproduces the baseline EXACTLY on the post-change tree, so the whole delta is this
change and nothing else. Identical pins throughout: census `9446a684709d`, pool `0d103fb9fa87`, 961
games, cap 12, arm `middle`, `--steering empirical`, `--end-state`, `baseline_comparability.ok: true`.

**Exactly one divergence cause removed and none added:**

```
unrelated event mismatch :: |-immune|p2a <> |-supereffective|p2b|1     1 game, gone
```

and the real board, dumped rather than inferred — turn 5 of a bo3 ladder game, config `pair-speedctrl`:

```
|move|p1a: Gengar|shadowball|p2a: Oranguru
|-immune|p2a: Oranguru                              <- Normal/Psychic takes no Ghost damage
|move|p2a: Oranguru|instruct|p1a: Gengar
|-singleturn|p1a: Gengar|move: Instruct|[of] p2a: Oranguru
|move|p1a: Gengar|shadowball|p2b: Sinistcha         <- OURS. showdown repeats it at p2a, immune again
```

**The heuristic will not aim at a body it cannot hurt, and the authority happily does.** That same
game also carried the run's SECOND THROW — a forced switch the mirror could not answer once the
boards had parted — and it is gone with the cause. One defect, three artifact rows.

### THE HAND LIST

**Leaves it:**
- ~~*"THE INSTRUCTED REPEAT RE-PICKS ITS TARGET INSTEAD OF REUSING THE ORIGINAL ONE"*~~ — **landed.**
  It was a REGISTER row (#534) rather than a hand-list line, filed by the batch before this one and
  carried in `probe_instruct_shield.js` as a declared `KNOWN-OPEN` arm. The row is closed, the arm is
  promoted to a counted control, and `tests/probe_instruct_target.js` carries the mechanic.

**Joins it:**
- **A FAINTED ALLY AT THE STORED LOC IS RETURNED BY THE AUTHORITY AND WE RE-PICK.** One clause of
  `getTarget`, counted on `MEDSEEN.instructAimFaintedOccupant`, unreachable from the driver's script
  format (which cannot aim at an ally at all), and therefore not shown red today.
- **`scripted` IS EXCLUDED FROM `aimTravelsByLoc` BY JUDGEMENT.** `validTargetLoc` accepts it; this
  engine's Counter and Mirror Coat are counted rather than aimed. Four legal moves, counted on
  `instructAimClassNotByLoc` together with the genuinely inert classes, so the counter cannot
  separate them today.

**Carried forward unchanged** from the hand lists below: the target-class exemption that cannot be
shown red (`chillyreception`), and the `benchRisk` refit that `clickFragility` owes MEASURE.

### OWED, NOT RUN

The `## OWED, NOT RUN` block of `docs/_reports/2026-08-29-instruct-target.md`.


## WHY THE PREDICTION MISSED

The reasoning behind "unmoved" was that the empirical driver aims at the first live foe, so the
aimed slot is always slot 0 and the two roads agree. **That is true of the CLICK the driver makes and
false of the board it produces**, because a body can leave and be replaced: on the game that moved,
the Oranguru had switched IN to slot 0 on the same turn, and the Gengar's Shadow Ball — aimed at slot
0 as the driver always aims — met a Normal/Psychic body that is IMMUNE to it. `targetForMove` scores
an immune foe at zero and therefore prefers the other slot every time, so the two roads part on a
board the prediction assumed they could not. **The under-sampling argument was right about the aim
and wrong about the matchup.**

## OWED, NOT RUN

- **THE ALLY AXIS, ENTIRELY.** `getTarget` reads one signed `targetLoc` and `getAtLoc` picks the side
  off the sign, so an ally-aimed repeat is the same rule; the engine handles it ungated, through the
  same `reaimToSlot` call. **Nothing here measures it** — the driver's script format resolves a
  `normal` move to `foes[t]` on both sides, so an ally aim is inexpressible and every arm aims at a
  foe. The fainted-ally clause of `getTarget` is on the same door and is a known non-expression.
- **`scripted` (Counter, Mirror Coat, Metal Burst, Comeuppance) is excluded from `aimTravelsByLoc` by
  judgement**, not by the authority: `validTargetLoc` accepts it. Four legal moves.
- **THE ENCORE / `randomNormal` CORNER IS IMPLEMENTED AND NOT PROBED.** `aimT`/`aimA` are frozen at
  the collection site precisely so that Encore's execution-time override and WIRE 144's re-roll do
  not rewrite the recorded aim, which is what the authority does (`moveUsed` takes
  `action.targetLoc`, never the re-resolved body). No arm stages Encore-then-Instruct on one body in
  one turn.
- **`tests/run-all.js` was not run.** The affected instruments were run individually:
  `probe_instruct_target` 14/0, `probe_instruct_shield` 13/0/0, `probe_shield_refusal_line` 13/0,
  `probe_shield_rearm` 11/11 clear, `test-resolution-order` 26 arms / 1 KNOWN-OPEN / 0 failing,
  `test-engine-diff` `disagreed 0`, `test-engine-consistency` all passed, `test-mechanics` 801/801/0,
  `test-docs-current` 23/0, `test-roadmap-register` 3/0, `test-target-provenance` PASS.
- **`engine/register_reality.js` was not run** — it writes `data/register-reality.json`
  unconditionally with no `--out`, which the brief forbids. #534's green marker has therefore not
  been seen by the `no open, known engine defect` clause.
- **The quarantine gate is 5 of 8 clauses failing, unchanged.** All five were failing before this
  batch; none of them is this work.
- **`data/verification/engine-diff.suite.json` was NOT rewritten this time** — the engine
  differential was given its own `--out data/verification/engine-diff.instructaim534.json`.
  `data/game-differential.json` is untouched (mtime 2026-08-28 23:14).
- **A real release WAS cut** — `e8f7c7dba595`, 26 files, into `data/releases/`. That moves
  `data/engine-release.json`. It is deliberate: the shim route the previous batch used stamps an id
  that lives only in a temp directory, and `tests/_live_release.js`'s own header says a number
  produced that way must not be published. The pool figures here are reproducible from a named
  release.
- **The `.pdf` companions were not rebuilt.** `docs/*.pdf` are already weeks stale (newest
  2026-08-04) and nothing gates their freshness — pre-existing, and owed by the living-docs rule.
- **Debris, reported and left**: `data/verification/divergence-turns.empirical.json`,
  `data/verification/gd-empirical-cards.json` and
  `docs/_reports/2026-08-29-empirical-divergence-cards.md` were untracked at the start of this
  session and are not mine. Left alone.
