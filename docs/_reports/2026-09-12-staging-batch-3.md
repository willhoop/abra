# Staging batch 3 — the delegation, the forme knob, and two withdrawals — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (883 rows, unmoved), team store
`data/team-pool-frozen`. **No engine byte was modified and no release was cut.** The only code file
changed is `tests/roster.js`, which is **not** one of the 27 frozen `SOURCES` — checked this pass by
reading `ER.SOURCES` (`roster.js frozen? false`, `medicham2 frozen? true`), not inherited from the
previous report.

## Counts, before → after

| stage | before (artifacts at HEAD) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ | **148 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 176 MATCH / 16 CNS / 3 CNQ / 5 DEF | **177 MATCH / 16 CNS / 2 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 486 MATCH / 8 CNS / 3 DEF | **487 MATCH / 7 CNS / 3 DEF** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE.** Plant anchors **22/22, 45/45, 36/36
apply exactly once**, none dead. Red demonstrations **22 / 45 / 36 CAUGHT, zero NOT CAUGHT** (the
eight `NOT CAUGHT` strings `grep` finds in the moves log are prose inside four ROADMAP #318 HELD rows,
quoting an older release — the reds block itself is clean).

**Items are the control arm of this pass** and did not move a single row, which is what says the
shared-helper edits (`carrierBody` gained one option) reach no item rule.

Two rows closed: **`slushrush`** (CONTROL-NOT-QUIET → FIRED-AND-BOARDS-MATCH) and **`aurawheel`**
(COULD-NOT-STAGE → FIRED-AND-BOARDS-MATCH). Two things were built, measured and **withdrawn**.

## Batch 1 — the delegation, which closed one row of the two it was aimed at

`magmaarmor` and `slushrush` were the two CONTROL-NOT-QUIET rows the brief called a measured-viable
route: both call `stageAbility` directly, so they never reached the in-play Skill Swap control that
`abilityScenario` already takes when an ALTERNATE carrier's own sheet control is live.

`stageAbilityQuiet` is that door — the same guard `abilityScenario` uses (ALTERNATE tier, sheet
control not in `QUIET_SET`, not `failskillswap`, `swapControlWorks()` green) plus the three things
`stageAbilitySwap` cannot carry (`o.a1`, `o.onBench`, `o.gender`). **It is opt-in per rule**: only the
two rules named call it, so every other rule in that block builds a byte-identical fixture, which is
what makes "nothing else moved" a measurement rather than an argument. **What it matched is PRINTED on
every run**, both when it fires and when it refuses.

Measured on the two rules alone before anything wider was run: all nine members came back
FIRED-AND-BOARDS-MATCH, 0 CONTROL-NOT-QUIET, and both rules still CAUGHT.

### And then the leaves were read, and half of it came back out

A green is not evidence until something says WHICH leaves carry it. Dumping `sd_delta` per row:

```
slushrush    REAL(non-bookkeeping)=18   p1.party.flareon.hp 0/52, .fainted true/false, p2…boosts.atk 0/-2
magmaarmor   REAL(non-bookkeeping)=6    p2.active[0].hp 508/532 … 436/484   — AND NO status LEAF AT ALL
immunity     REAL=12  …status /psn      insomnia  …status /slp      limber  …status /par
```

Magma Armor refuses **freeze**. A row whose entire delta is HP, on every turn, is not reading the
refusal — while the four rows of that same rule which keep their sheet control all show their status
leaf. The mechanism, derived from the format rather than guessed:

- `QUIET`'s predicate is `!Object.keys(a).some(k => /^on/.test(k) && typeof a[k] === 'function')`.
  **It cannot see a boolean.**
- Asked of Champions: `shellarmor` and `battlearmor` carry **`onCriticalHit = false`** — a data field,
  not a function. Both therefore sit in the quiet set, and `SWAPPER` lends **Shell Armor**.
- `ability/refuses-one-status` runs on `bottom-tie-first`, **where every crit lands**. So the control
  arm's holder blocks a crit the subject arm's holder takes, and the row measures the SWAPPER.

`ability/weather-speed` runs on `top-tie-first`, where no crit lands in either arm, so `slushrush` is
untouched by this and its 18 leaves are the KO and the Charm drop the rule is written to read.

**Withdrawn:** the delegation now refuses any rule asking for the bottom corner, with that measurement
as its printed reason. `magmaarmor` returns to CONTROL-NOT-QUIET — a declared gap, which is worth more
than a green measuring the control — and the other four rows of that rule return to their exact
pre-pass fixture. Re-measured after the withdrawal: that rule is 4 MATCH / 1 CNQ and still CAUGHT.

## Batch 2 — Opportunist: a rule was written, measured, and withdrawn entire

`onFoeAfterBoost` matches **exactly one** entity in this regulation (printed before wiring; Mirror Herb
carries the same mechanic as an ITEM and the format marks it `isNonstandard: 'Past'`). Opportunist also
registers `onResidual`, so `ability/residual` owned it and staged it as a body standing quietly for
three turns — **a board on which nobody boosts**, so the ability had nothing to copy and its whole
delta was the control's Speed Boost.

A rule that stages the condition it actually reads — a foe clicking a pure all-positive self-boost —
produced **FIRED-AND-BOARDS-MATCH** and its rule read **NOT CAUGHT**. The red demonstration was the only
thing that could have caught it, and the leaves say why:

```
sd_delta = 20 leaves, NOT ONE OF THEM A BOOST:
  p1.active[1].ability shellarmor/opportunist   (+ its party row)  <- the SWAPPER describing itself
  p2.active[0].ability opportunist/shellarmor   (+ its party row)
  p1.pp[1].skillswap, p1.pp[1].focusenergy, p1.active[1].vol.focusenergy
us_delta = 0        subject_diffs = 0
```

Neither engine copied anything. The two engines agreed about a board on which the ability never acted,
and breaking the copy could not move what was never there. **The rule is withdrawn**; Opportunist stays
with `ability/residual` and stays CONTROL-NOT-QUIET, which is a declared gap rather than a false green.
It is not owed a better control — it is owed a fixture in which the copy demonstrably happens.

**The 20 leaves are a finding larger than this row, and it is recorded rather than fixed here:** a Skill
Swap control arm moves the swapper's own `.ability`, its PP and its volatile **by construction**, on the
side the swap-leaf correction does not cover (that stage prints `0 leaves DROPPED`). So the INERT gate
cannot fire for any swap-controlled row. That is the Focus Sash defect — the control arm describing
itself — on the ability axis. Every swap-controlled green in this pass was checked against it by hand;
the 13 rows landed by the previous pass have **not** been re-checked and are named as owed work.

## Batch 3 — Aura Wheel, and the forme knob is now derived instead of named

The old refusal named Morpeko **by hand** as "the one with a knob". `formeFlipStaging` derives all four
parts from the format:

| part | derived from |
|---|---|
| the table | the move's own `onModifyType`, already parsed into `<forme> -> <type>` |
| the flip | an ability whose own `onResidual` calls `formeChange` and whose source names one of those formes |
| the user | a legal (`exists && !isNonstandard && tier !== 'Illegal'`), buildable species carrying that ability, legally learning the move, whose own name is **not** the keyed forme |
| the defender | immune to the PRINTED type and **not** immune to what it converts into (`carrierBody` gained `notImmuneTo`; both halves, or the reading is 0 on both turns) |

Printed on every run: `Hunger Switch flips Morpeko into Morpeko-Hangry at the end of every turn, so
click 1 is Electric and click 2 is Dark; defender Rhyperior is immune to Electric and not to Dark`.
`getImmunity('Electric', ['Ground'])` is `false` and `getImmunity('Dark', ['Ground'])` is `true`, read
off the dex, so turn 1 must deal nothing and turn 2 must deal damage — a **categorical** reading, not a
damage number. Result: FIRED-AND-BOARDS-MATCH.

**Raging Bull is the control and still refuses**, now with a measured reason instead of a typed one:
*"no legal ability in this format flips any of the formes its table names (Tauros-Paldea-Combat,
Tauros-Paldea-Blaze, Tauros-Paldea-Aqua) from its own onResidual"*.

## What is still unstaged, and the MEASURED reason

**Items: none.**

**Abilities — 2 CONTROL-NOT-QUIET:** `magmaarmor` and `opportunist`, both above, both with a
measurement under them rather than a shape argument.

**Abilities — 16 COULD-NOT-STAGE, not attempted this pass and stated as such:** the six mega-only
carriers (`aerilate`, `dragonize`, `filter`, `furcoat`, `megalauncher`, `galewings`), `zerotohero`
(`failskillswap` AND `cantsuppress`, sole ability on its carriers), `simple` (in scope as CONFERRED,
no sheet body), `ripen`, and the inert-staging group (`cloudnine`, `cudchew`, `frisk`, `hydration`,
`klutz`, `screencleaner`, `supremeoverlord`). The suggested Skill-Swap route for the mega-only six is
**exactly the control this pass has just shown can manufacture a green out of its own bookkeeping**, so
taking it before the swap-leaf correction covers the swapper's side would be building on the defect
this pass found. That ordering is the reason they are not attempted, not budget.

**Moves — 7 COULD-NOT-STAGE.** `focusenergy` IS the control click; `struggle` is disabled while any
move is usable; `extremespeed` / `iceshard` / `jetpunch` keep the previous pass's MEASURED refusal
(`wideAbility` would lend the carrier a wide ability and break the fixture's premise); `upperhand`
reads a target's priority intent; `ragingbull` is forme-keyed across separate species with no flip
ability, now measured.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 177 of 200 tested. 2 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist
    PASS  deliberate roster / moves      clean: 487 of 497 tested
```

`engine/quarantine.js` exit 0.

## Releases cut

**None.** No engine byte changed. The files touched are `tests/roster.js`, `docs/ENGINE.md`,
`docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md` and this report. `engine/board.js`,
`engine/magnemite.js` and `data/engine-data.js` were not touched.
