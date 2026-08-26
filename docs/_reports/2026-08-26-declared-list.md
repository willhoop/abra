# One declared list, one door, two clauses — 2026-08-26 (MEASURE)

Instrument change only. **No engine byte was touched** (`git diff engine/medicham2-browser.js` empty
before and after). The only source file modified is `engine/quarantine.js`.

---

## VERDICT

**The mechanics clause went 9 of 16 to 8 of 16. Exactly one row left: `ability:supremeoverlord`
(112 teams / 13,116 open-sheet games). Nothing else moved.** The whole-game clause's return value is
byte-identical — same `why` string, 10 of 961 undeclared, 15 raw, 5 declared AUTHORITY-WRONG.

A declaration written tomorrow would be honoured by **both** cause-string clauses and by **neither**
of the five readers that carry no cause string. Both halves are asserted in the selftest and both are
named in the code's own header.

---

## THE BUG

`DECLARED_DIVERGENCE` had **one reader**: the loop inside `wholeGameClause`. So on one run, off one
declaration, on cause strings written by the same comparator in the same grammar:

| reader | Supreme Overlord `fallenundefined` |
|---|---|
| `wholeGameClause` (`engine/quarantine.js`) | **declared AUTHORITY-WRONG**, 5 games subtracted, printed with its reason |
| `tests/test-mechanics.js:15722` | **a live probe asserting we refuse the line deliberately** |
| `classifyMechanics` (`engine/quarantine.js:723`) | **counted it as a defect** — filtered on `!r.diverged \|\| r.deferred` and never looked at the list |

The mechanics artifact carries the cause on each row and it is the same grammar as the differential's:

```
data/all-mechanics-fire.json  rows.abilities[supremeoverlord].divergence.cause
  event missing from medicham2 :: |-end|p1a|fallenundefined <> |switch|p1a|charizard,l50|H/H

data/game-differential.json   classes[].causes[].cause   (5 rows)
  event missing from medicham2 :: |-end|p2b|fallenundefined <> |switch|p2b|garchomp,l50|H/H
  ... 4 more, same shape, different body
```

So this was not two artifacts that needed reconciling. It was **one grammar with one reader**.

---

## THE FIX

`declaredMatch(cause, ev, threw)` — one function holding the matching rule, the throw handling and
the `DECLARED_KINDS` whitelist. `wholeGameClause` and `classifyMechanics` both call it; neither knows
what is in the list. The whole-game clause's inline loop was **deleted**, not copied, so a second
implementation cannot exist.

Two things the fix does that are easy to skip:

1. **The `threw` sink is the caller's, not a module global.** `MATCHER_THREW` is shared module state.
   Had `classifyMechanics` pushed into it, a mechanics cause would have printed under the whole-game
   clause's heading — a smaller version of the bug being closed. The whole-game clause keeps passing
   `MATCHER_THREW` (its existing array, and the one the selftest push/pops); the mechanics clause
   passes its own and prints its own.

2. **The mechanics clause PRINTS what it subtracted, at zero as well as at one.** A gate that gets
   quieter without saying what it stopped counting is how a real defect hides. The `--reach` printer
   gained a `DECLARED` dump for the same reason — it showed all 16 diverging rows across four buckets
   before, and a row subtracted without being re-printed is the same failure one layer down.

### The evidence adaptation, and why it is narrowing rather than widening

The cause **string** grammar is identical on both sides, so the matching rule needed no loosening.
What differs is the **evidence** a matcher may ask for. `data/game-differential.json` carries
`first_divergences` (the raw line pair) and `order_probe` (speed read off the authority at the turn
boundary). `data/all-mechanics-fire.json` carries the raw pair on each row's `divergence` and **no
order probe at all**.

`mechanicsCauseEvidence` hands over the four keys that genuinely mean the same thing — `cause`,
`cls`, `showdown`, `medicham` — and invents nothing. `probes` is empty by construction, and
`causeEvidence`'s existing contract already says what that means: *a matcher that requires evidence
DECLINES on absence*, the safe direction, because an undeclared divergence holds the gate shut. A
future order-probe matcher will therefore **refuse** to subtract a mechanics row rather than subtract
it on evidence nobody measured. It builds **through** `causeEvidence` rather than beside it, so
"index the evidence by cause" still has one implementation.

### Where the declared check sits in the classification, and why

It is asked **first**, ahead of reach and decision impact. DECLARED does not say *this defect is
small*; it says *there is no defect*. Reach and decision impact both presuppose a defect and ask
whether it is worth fixing. Filing a declared row under "nobody plays it" would be a true statement
making a false claim, and it would go quiet the moment the mechanic became popular.

**Measured before wiring it: no row below the reach shelf matches any declaration**, so the ordering
moves nothing today. It is first for the reason above, not for the count.

---

## THE MEASUREMENT

Both artifacts were frozen to a scratchpad copy before the change and MD5-compared after, so the
before/after is on identical bytes (`data/all-mechanics-fire.json` md5 `bffdbe7a…`, unchanged
throughout; both files 60 minutes old at read time and untouched by the concurrent ENGINE run).

HEAD's `engine/quarantine.js` was loaded in-process via `git show HEAD:` and a `Module._compile`, so
BEFORE and AFTER ran side by side against the same frozen inputs in one process.

```
WHOLE-GAME  HEAD : ok=false diverged=15 games=961 declared=5 undeclared=10 decision_cleared=0
                   by_kind={"INCOMPARABLE":0,"AUTHORITY-WRONG":5} threw=0 whyLen=1971
WHOLE-GAME  NOW  : ok=false diverged=15 games=961 declared=5 undeclared=10 decision_cleared=0
                   by_kind={"INCOMPARABLE":0,"AUTHORITY-WRONG":5} threw=0 whyLen=1971
WG `why` string identical : true

MECHANICS   HEAD : counted 9  declared 0  shelf 7  unknown 0  excused 0  rowsSeen 16
MECHANICS   NOW  : counted 8  declared 1  shelf 7  unknown 0  excused 0  rowsSeen 16
LEFT the counted set   : [ 'ability:supremeoverlord' ]
JOINED the counted set : []
shelf list identical   : true
```

**Predicted before the run: 9 -> 8, one row leaving, `ability:supremeoverlord`.** That is what
happened. Nothing else left; nothing joined.

### The row that left, named

```
ability:supremeoverlord   112 teams  in 13,116 open-sheet games   85.39/10k games   shelf 6 teams
  AUTHORITY-WRONG: Supreme Overlord `fallenundefined`
  cause: event missing from medicham2 :: |-end|p1a|fallenundefined <> |switch|p1a|charizard,l50|H/H
```

It is the **most-played** row of the sixteen, which is the point: the reach filter would never have
removed it, and it was holding the clause shut on the strength of a Showdown typo on a `[silent]`
line no player sees.

### The counted 8 that remain

```
move:shellsidearm  101 clicks   move:switcheroo   85 clicks   move:smackdown  59 clicks
ability:berserk     56 teams    move:stringshot   46 clicks   ability:sandforce 34 teams
move:teeterdance    33 clicks   move:cottonspore  31 clicks
```

### No row was lost in the subtraction

`declared 1 + counted 8 + shelved 7 + unknown 0 + cleared 0 = 16 = rowsSeen = summary.diverged`.
The artifact's own headline stays 16 and the subtraction prints beneath it — a filter may only ever
subtract from a number a reader can still see.

### Nothing else moved

| clause | before | after |
|---|---|---|
| whole-game differential | 10 of 961 | **10 of 961** |
| board-material | 2 of 961 | **2 of 961** (no engine byte; whole-game return byte-identical) |
| census | 750 live / 753 probed / 3 missing | **750 / 753 / 3** |
| game differential (damage) | PASS, 0 of 6000 at every corner | unchanged |
| deliberate roster / items, abilities, moves | PASS | unchanged |
| coverage | PASS, 412 moves above 25 clicks | unchanged |
| open defect | FAIL, #218 | unchanged |
| mechanics | **9 of 16** | **8 of 16** |

---

## RED FIRST, AND THE INSTRUMENT CHECKED BEFORE IT WAS BELIEVED

Nine assertions added to `node engine/quarantine.js --selftest`; **100 passed before, 109 pass now,
0 failed.** They are driven by pushing a **synthetic** declaration and popping it — not by asserting
anything about Supreme Overlord, because a gate built from an instance catches that instance and not
the class.

The **first** assertion runs with nothing declared and requires **both** synthetic mechanics to
COUNT. A probe reading "0 counted" because its fixture staged nothing would pass every assertion
below it while measuring nothing.

Shown red on a deliberate break — `const dec = declaredMatch(...)` replaced by `const dec = null`,
compiled to a throwaway copy and run:

```
QUARANTINE SELFTEST: 105 passed, 4 failed
  ok   INSTRUMENT CHECK — with NOTHING declared, BOTH synthetic mechanics COUNT
  FAIL ONE DOOR — a declaration written TODAY is honoured by the MECHANICS clause
         got {"declared":[],"counted":["declaredmech","nearmissmech"]}
  FAIL RED — and the NEAR MISS still counts
  ok   ONE DOOR — the SAME declaration ... is honoured by the WHOLE-GAME clause too
  FAIL ...and the mechanics clause NAMES it, in its OWN throw list
  FAIL RED — a matcher that THROWS leaves every mechanic UNDECLARED and is NAMED
```

The whole-game assertion stays **green** under that break, which is the discrimination that matters:
the test can tell the two readers apart.

Also asserted: a **near miss** of the same cause shape still counts; a `kind: DEFERRED` row does not
open the mechanics clause either and is **named** in the mechanics clause's own throw list while
`MATCHER_THREW` stays untouched; a matcher that **throws** leaves every mechanic undeclared and prints
beside the count it inflates; and withdrawing the declaration makes **both** clauses count it again.

---

## WOULD A SECOND DECLARATION ADDED TOMORROW BE HONOURED BY BOTH CLAUSES?

**By the two that read a cause string, yes — asserted, not assumed.** The selftest pushes a
declaration that does not exist in the shipping list, feeds the same cause string to
`classifyMechanics` and to `wholeGameClause`, and requires both to subtract it; then pops it and
requires both to count it again.

**By five other readers, no**, and that is written into the code's header rather than implied:

- **`differentialClause`** (`data/engine-diff.json`) — damage-table rows carry attacker / move /
  defender and two numbers, not a `|line <> |line` cause. There is no string for a matcher to read,
  so a damage-roll declaration would need its own evidence shape and is **silently ignored** today.
- **the three `rosterStage` clauses** — they compare our two engines to each other, so "the authority
  is wrong" cannot arise; their exemption axis is `DEFERRED-BY-OWNER` and is separate on purpose. An
  INCOMPARABLE row could in principle apply and would be ignored.
- **`orderProbeClause`** — its rows **do** carry `cause`, and it counts every unequal-speed /
  same-priority pair whether or not the cause is declared. **This is the nearest thing to the next
  instance of this bug.** Inert today: this run probed 0 pairs and no live declaration is an ordering
  row.
- **`coverageClause`** asks whether an instrument measures a mechanic, not whether it agrees;
  **`openDefectClause`** reads register sentences. Neither has a cause string; both are out of scope.
- **`engine/all_mechanics_fire.js`** writes `summary[k].diverged` knowing nothing about declarations,
  and that is deliberate — the headline must stay visible.

---

## NOTED, NOT FIXED IN THIS BATCH

- **`SHOWDOWN-ONLY` is a verdict no clause reads.** `classifyMechanics` filters on `diverged` /
  `deferred` and never looks at `verdict`, so the eight SHOWDOWN-ONLY ability rows are handled
  correctly **by accident**. Recorded in the header of the new door. Out of scope here.
- **`counts_against_the_gate`** (`engine/all_mechanics_fire.js:3334`) was not touched, not read and
  not repurposed. It is written once, always `false`, read by zero lines outside that file, and it
  marks Will's closet.
- **`data/decision-impact.json` is still absent**, so nothing is excused on decision impact and every
  played divergence counts. That is the correct refusal-by-default and is unchanged.
- **`MATCHER_THREW` is module-level state that never resets between calls** in a long-lived process.
  Pre-existing; the selftest works around it with `length = before`. Not made worse — the new sink is
  per-call — and not fixed here.

---

## OWED, NOT RUN

- **The differential and `all_mechanics_fire.js` were NOT re-run.** ENGINE holds the play layer and
  is running the whole-game differential. Every number above is computed from the artifacts as they
  stood at 2026-08-26 17:11 (release `667278050dcf`), MD5-frozen before the change and unchanged
  after.
- **`orderProbeClause` is not wired to the declared list.** It carries a cause string and is the one
  reader that could plausibly need it. It is inert today (0 pairs probed, no ordering declaration) and
  is left alone rather than wired speculatively — a door built for a caller that does not exist is a
  matching rule nobody has checked against a real row.
- **`differentialClause` cannot express a declaration at all.** If a damage-roll row ever needs one it
  requires a second evidence shape, designed against a real row rather than in advance.
- **`SHOWDOWN-ONLY` unread by every clause** — correct today by accident, owed a decision.
- **The eight remaining counted mechanics are untouched.** They are ENGINE's, not MEASURE's; this
  change only stops a ninth being counted that was never a defect.
- **No refit was started and none is proposed here.** `REFIT OWED` still stands on the weights, and
  the feature-fixture gate is still red on both the fixture-identity and damage-table clauses.
