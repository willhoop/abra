# THE SWITCH INDEX IS NOT THE BUG. THE TRAP IS EVALUATED ONE PHASE TOO LATE.

2026-08-25. MEASURE. Release `2ecd3bdc274b` for every measured leg — before, after and the control.

---

## 0. VERDICT

**The premise handed to me is REFUTED.** `engine/game_differential.js` does not address a switch by a
stale index. It resolves the index off the authority's own live `side.pokemon` array, by species,
immediately before `battle.choose`, and it is right **63,258 times out of 63,258 — 43,125 of them
against a party Showdown had already permuted.**

**Both remaining "a chosen switch the authority performs and medicham2 does not" games are ONE ENGINE
DEFECT**, reproduced and isolated in five arms:

> **medicham2 evaluates `preventsSwitch` at SWITCH-EXECUTION time. Showdown evaluates it at CHOICE
> time and never re-asks.** A Shadow Tag body that arrives on an earlier switch in the same turn
> therefore retro-cancels a switch this engine had already been told to make. Showdown does not do
> that; `Side.chooseSwitch` refuses when the request is built and nothing revisits it.

Gengar-Mega is the format's **only** legal `preventsSwitch` carrier (derived, not recalled), and it
switched in one action ahead of the leaving body in both corpus games.

**Zero of the 23 first divergences on this release are a switch-addressing artefact.** Every
board-material figure taken on this instrument since the switch machinery landed stands.

---

## 1. WHAT THE PREMISE WAS, AND WHY IT WAS WORTH TESTING

ENGINE handed it over with the anchor re-opened rather than recalled — `sim/battle-actions.ts:118-132`,
a switch **swaps party indices**, so `side.pokemon` is a moving index space and a cached index does not
name the same body twice. That is a correct reading of the authority and it is the right first suspect:
in this repo the ruler has been the culprit five times in two days, and the roster's worst run put
**162 of 169 accusations** on the instrument.

`0 refusals` was the stated tell. It is a real tell and it points the other way. Showdown **accepted
every choice** in both games and brought in **exactly the body the harness meant**; what it did not do
is match medicham2 afterwards.

---

## 2. THE TWO GAMES, REPLAYED WHOLE

`engine/replay_one.js`, release `2ecd3bdc274b`, `--team-store data/team-pool-frozen --games 1200
--arm middle --trace-choices`. Both reproduce the shape.

### 2.1 `pair-redirect-priority`, turn 11
`gen9championsvgc2026regmbbo3-2656847681 vs gen9championsvgc2026regmbbo3-2656808520`

```
  0132  ---- turn 11 ---------------------------------------------
  0133  both  P2b Gengar sends in (replacing Ninetales) Gengar-Mega, L50
>>>>>>  THE SPLIT — index 134.  classifier: event missing from medicham2
  0134  SD    P1a Krookodile sends in (replacing Floette) Krookodile, L50
        US    P1b Charizard becomes charizard-mega-y, L50
```

p1 sent `"switch 3, move 3 mega"`, p2 sent `"move 4, switch 3"`. **24 choices, 0 REFUSED.** Switch
actions sort on the OUTGOING body's speed, so Ninetales-Alola (169) leaves before Floette-Eternal
(137): Gengar-Mega is on the field when Floette's switch comes up. Showdown performs it anyway.
medicham2 hits `WIRE 92` and `continue`s.

### 2.2 `omit-protect`, turn 8
`gen9championsvgc2026regmbbo3-2656624602 vs gen9championsvgc2026regmbbo3-2657402800`

```
  0079  ---- turn 8 ----------------------------------------------
  0080  both  P1a Gengar sends in (replacing Metagross) Gengar-Mega, L50
>>>>>>  THE SPLIT — index 81.
  0081  SD    P2a Crabominable sends in (replacing Metagross) Crabominable, L50
        US    P1b Gholdengo can't move recharge
```

Same shape from the other side: p1's Gengar-Mega arrives on the outgoing-speed tie (126 vs 126,
resolved p1-first on both engines), and p2a's Metagross is then held back by this engine only.
**20 choices, 0 REFUSED.**

---

## 3. THE ENGINE DEFECT, ISOLATED — `tests/probe_trap_timing.js`

New probe. Not a gate, not in `run-all.js`. The corpus games cannot be summoned on demand, so the
shape is **constructed**: one measured turn, everything Protects, no damage and no die. The trapper is
derived from `data/tags.json` × the format (`preventsSwitch` → Gengar-Mega / Shadow Tag), and the probe
says COULD-NOT-STAGE rather than passing quietly if a later regulation removes it.

```
  A TEST     trapper ARRIVES this turn     expect PARTS              -> PARTS at reduced index 6
      trapBlockedSwitch +1   shedShellEscapedTrap +0
        SD  |switch|p1a: Milotic|Milotic, L50|170/170
        US  |move|p2a: Corviknight|protect|p2a: Corviknight
  B CONTROL  entrant carries no trap       expect AGREES             -> AGREES        (+0 / +0)
  C CONTROL  victim holds a Shed Shell     expect AGREES             -> AGREES        (+0 / +1)
  D CONTROL  victim is a Ghost             expect AGREES             -> AGREES        (+0 / +0)
  E POSITIVE trapper ALREADY on field      expect AUTHORITY REFUSES  -> THREW:
        p1 choice rejected p1 "switch 3, move 1": Can't switch: The active Pokémon is trapped
```

Every control moves exactly one thing away from A — the entrant's ability, the victim's item, the
victim's type — and all three land on AGREE, so the fixture is not immune for two reasons. **Arm E is
the mechanism rather than the symptom**: the same trapper, the same victim, the same switch, moved one
phase earlier, and the authority itself says no *in its own words*. A "fix" that simply deleted the
trap from the switch branch would turn A green and leave E unexplained.

### What ENGINE has to change, and what it must NOT

The refusal belongs at the moment the action is CHOSEN, not the moment it RESOLVES. All three refusal
branches in that block sit on the same footing — `preventsSwitch` (WIRE 92), `_trapHard`
(`moveTrapBlockedSwitch`) and Fairy Lock — but only the ABILITY branch can have its condition change
mid-turn, because only an ability can walk onto the field between the choice and the execution. **The
exemptions must survive**: Ghost, Shed Shell (`escapesTrap`) and the Shadow-Tag-mirror rule are what
arms C and D hold down, and arm E is what stops the trap being deleted outright.

### The count this should move, said BEFORE the run

Two rows leave the parted list: `omit-protect t8 |switch|p2a|crabominable` and
`pair-redirect-priority t11 |switch|p1a|krookodile`. That is **23 → 21 raw, gate 18 → 16 of 961,
board-material 10 causes → 8**. The honest range is 21–22 / 16–17 / 8–9: the `omit-protect` game
carries a second, later disagreement in the same config and may simply re-part at a later turn once
turn 8 stops stopping it. If MORE than two leave, that is a finding and it must be named.

---

## 4. THE INSTRUMENT, CLEARED — AND HOW

Reading the code is not evidence. `engine/game_differential.js` now audits its own switch addressing
on every switch it sends, and the audit is in the artifact rather than only on stdout, because the
question it answers is asked of runs that are already over.

`str()` resolves `j` off the LIVE `side.pokemon` and then checks it against `Side.chooseSwitch`'s own
rule — the slot holds the intended species, and it is a bench slot (`slot >= active.length`, the line
Showdown refuses on). The party is recorded as permuted-or-not so the **denominator is visible**: a
run that never met a permuted party would prove nothing and would look identical to a clean one.

| | knob OFF (the instrument) | `MEDI_SWITCH_BY_INITIAL_INDEX=1` (the control) |
|---|---|---|
| switch indices sent | **63,258** | 11,570 |
| …against an ALREADY-PERMUTED party | **43,125** | 5,223 |
| **MISADDRESSED** | **0** | **4,932** |
| choices Showdown REFUSED | 0 | **1,796** — first: `p2 "switch 1, move 4": Can't switch: You can't switch to an active Pokémon` |
| games THREW | 0 | **901 of 961** |
| medicham switch lookups MISSED | 3 | 55 |
| DIVERGED | 23 of 961 | 27 of 961 |

The control resolves the index against the party order snapshotted at the first choice of the game —
precisely the cached-index bug the premise described. It goes RED and it takes the whole run down with
it. **The probe has been red. It reads 0.**

---

## 5. A SECOND INSTRUMENT DEFECT, FOUND ON THE WAY, MEASURED AND FIXED

`switch lookups that MISSED: medicham 3` — a counter whose own caption says **MUST READ 0**. It was
unactionable, so it now names the body and the game.

```
  floetteeternal x1, incineroar x1, metagross x1
    baseline     t7   ...2635328192 vs ...2635033305  [stones removed]  wanted floetteeternal  bench[?/incineroar]
    baseline     t12  ...2634782171 vs ...2635176997  [stones removed]  wanted incineroar      bench[]
    omit-protect t9   ...2656624602 vs ...2657402800                    wanted metagross       bench[?/crabominable]
```

**None of the three is a first divergence.** Two are in the stones-removed CONTROL leg; the third is
in the `omit-protect` game whose board had already parted at **t8** — the trap defect above, which
left Metagross standing on our side and benched on Showdown's, so at t9 the body genuinely is not on
our bench. They are consequences, not causes.

**But `?` is the finding.** `_switchKey` printed as absent on every body. Measured directly:

```js
GD.freshBodies(GD.buildPair([...])).map(b => b._switchKey)   // [ undefined, undefined, undefined, undefined ]
```

`buildPair` stamps `_switchKey` on the body it builds; `playGame` then rebuilds every side through
`freshBodies`, which reads the **spec** and never saw it. So the key has been undefined on all eight
bodies of every game this instrument has ever played, and the medicham-side lookup has always fallen
through to `id(x.name)` — the mutable display state the comment above it says it must not use, because
Disguise, Zero to Hero and Hunger Switch all rename a body mid-game. CLAUDE.md already names this
cause ("`game_differential.js`'s `freshBodies` dropping `_switchKey`", Morpeko); it was still live
tonight. A dead safety net looks exactly like a working one.

Fixed by carrying the key on the spec — one source, two readers. **Predicted before the run**:
misses stay 3, diverged stays 23, because all three are bodies genuinely absent from our bench rather
than name mismatches. **Measured**: misses 3, diverged 23, `bench[incineroar/incineroar]` where it read
`bench[?/incineroar]`. Exactly as predicted; the net is alive again and it currently catches nothing.

---

## 6. THE MEASUREMENT — PINS AND IDENTITY

One release, one census pin, one frozen pool, one budget, for all three legs.

```
--release 2ecd3bdc274b  --games 1200 (a PAIR budget -> 961 played)  --arm middle  cap 12
--team-store data/team-pool-frozen
--census data/verification/census-pin-9446a684709d.json
--end-state
```

| | BEFORE (ENGINE's, `HEAD`) | AFTER (this pass) |
|---|---|---|
| `generated` | 2026-08-25T21:51:25.432Z | **2026-08-25T22:37:01.443Z** |
| games | 961 | 961 |
| DIVERGED | 23 | **23** |
| gate clause | 18 of 961 = 1.9% | **18 of 961 = 1.9%** |
| `first_divergences` | 23 rows | **23 rows, byte-identical row for row** |
| `planted_divergence_proof_ok` | true | **true** |

**Nothing moved, and that is the result.** Everything landed here is instrumentation and a dead key
restored; if the pool had moved, the instrumentation would have been changing the game and the run
would be void.

Gates run green after the change: `test-game-differential` (all passed),
`test-forced-switch-mirror`, `test-forced-switch`, `test-game-diff`, `test-end-state`,
`test-middle-identity`, `test-roster-arm-pin`, `test-encore-fail-silent`, `test-docs-current`
(23 passed, 0 failed).

**AND THE REPO IS NOT GREEN, WHICH IS SAID RATHER THAN FILED.** `tests/run-all.js` reports **29 of
163 checks failing** on this tree. That is the standing state and it is not this pass's. The four
failing checks that actually load `engine/game_differential.js` were each re-run against `HEAD` with
this change stashed, one at a time and by name — a batch loop mangled the first attempt and reported
`MODULE_NOT_FOUND` as `exit 1`, which is a void baseline and was thrown away rather than quoted:

| check | at HEAD | with this change |
|---|---|---|
| `tests/test-assert-mode.js` | exit 1 | exit 1 — unrelated, pre-existing |
| `tests/test-engine-diff.js` | exit 1 | exit 1 — unrelated, pre-existing |
| `tests/test-pin-arms.js` | exit 1 | exit 1 — unrelated, pre-existing |
| `tests/test-switch-back-renamed.js` | **exit 0** | **exit 0** |

`test-switch-back-renamed` is the one this pass had to touch. Its PART 1 asserted **the defect** —
*"the stamp is written by buildPair and dropped by freshBodies"* — so the fix made it fail. It now
asserts the fixed state, and asserts more than "something is stamped": both readers must produce a
key AND the two lists must be equal. **Its arm count is unchanged at 3 of 4, before and after**,
because the `hungerswitch` arm was already passing through the `id(x.name)` fallback. That is
precisely why a dead key looked like a live one for as long as it did.

---

## 7. WHAT THIS DOES AND DOES NOT LICENSE

- It clears **switch addressing**, at 63,258 sends with 43,125 against a permuted party, on **this**
  release, **this** pool, at **cap 12**. Every board-material figure is a claim about the first twelve
  turns; parted goes 28 → 80 between cap 12 and cap 30, and nothing here says anything about longer
  games.
- It does **not** clear the harness generally. It cleared one hypothesis with a control and found a
  second live instrument defect in the same block while doing it. That is the ratio to expect.
- The trap defect is **ENGINE's**, and `tests/probe_trap_timing.js` is red on arm A until it lands.
  It is a probe and not a gate, deliberately: it is not registered in `run-all.js`, so nothing in this
  repo is shipping red.

---

## OWED, NOT RUN

```bash
# THE FIX ITSELF — ENGINE. Move `preventsSwitch` to choice time; keep Ghost, Shed Shell and the
# Shadow-Tag mirror; keep arm E refusing. Then re-measure at these exact pins.
node tests/probe_trap_timing.js --release 2ecd3bdc274b

# the before/after leg, matched budget or it is not a before/after
node engine/game_differential.js --games 1200 --arm middle --release 2ecd3bdc274b \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state --write

# the positive control for the addressing audit — must stay able to go RED
MEDI_SWITCH_BY_INITIAL_INDEX=1 node engine/game_differential.js --games 1200 --arm middle \
  --release 2ecd3bdc274b --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state

# not re-run on this release by this pass
node tests/run-all.js
node tests/interaction_matrix.js
node tests/mutation_harness.js
node engine/quarantine.js

# does the SAME choice-time-vs-execution-time gap exist for the other two refusal branches?
# `_trapHard` (Block / Mean Look) and Fairy Lock share the block but cannot arrive mid-turn by a
# switch. Neither was probed. Stage a mid-turn application and read it rather than reasoning about it.
node tests/probe_trap_timing.js --release 2ecd3bdc274b   # after adding move-trap arms

# the switch-addressing audit at a LONGER cap, which is the only place it has not been asked
node engine/game_differential.js --games 1200 --arm middle --release 2ecd3bdc274b \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state --turns 30

# reported, not touched: data/provenance-stamp.json moved `verified 3 -> 2` under an earlier
# session. A content-verified artifact aged out of the ratchet and nobody said which.
node engine/provenance.js
```
