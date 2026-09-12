# The last unstaged in-scope mechanics — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (883 rows, **883 live / 0 missing,
unmoved**), team store `data/team-pool-frozen`. **No engine byte was modified and no release was
cut.** The files changed are `tests/roster.js`, `tests/probe_volatile_leaves.js` and
`engine/board_state.js` — none of which is one of the 27 frozen `SOURCES` in
`engine/engine_release.js` (checked with `ER.SOURCES`, not assumed).

## Counts, before → after

| stage | before (as landed by the previous pass) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS | **148 MATCH / 0 CNS — UNMOVED** | `data/roster.items.json` |
| **abilities** | 173 MATCH / 19 CNS / 3 CNQ / 5 DEF | **176 MATCH / 16 CNS / 3 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 486 MATCH / 8 CNS / 3 DEF | **486 / 8 / 3 — UNMOVED** | `data/roster.moves.json` |

Three ability rows closed: `compoundeyes`, `lightmetal`, `cutecharm`. Items and moves are the
**controls** of this pass and moved zero rows at every step.

## Batch 1 — the delivery table was handing out a move that removes its own user

`compoundeyes` and `lightmetal` were carried as *"real instrument defects"*: the SUBJECT arm THREW
with `Can't pass: Your <body> must make a move (or switch)`. **They were one fixture defect, not two
instrument defects, and they were not in the driver at all.**

The refusal quotes the last 8 lines of narration, and the faint that installs the replacement body is
*further back than that* — so the trace showed the symptom and never the cause. Widening it
(`ROSTER_TRACE_LINES=60`) made it one line:

```
|move|p1a: Dragapult|uturn|p2a: Metagross
|switch|p1a: Corviknight|corviknight, L50|1038/1038|[from] uturn
|turn|3  |move|p2a: Metagross|ironhead|p1a: Corviknight      <- p1a is no longer Dragapult
```

`deliveryOf` refuses `m.forceSwitch` — the TARGET leaving — and **never refused `m.selfSwitch`**, the
USER leaving. Those are two halves of one clause and only one was written. Bug is 0.5 x 2 = **neutral**
on Steel/Psychic, so the derived "neutral contact hit" on Metagross *was* U-turn; the aggressor hit,
switched itself out, and turn 3 asked Corviknight for a move it does not have. `compoundeyes` is the
same move on the other side of the field, as Vivillon's own STAB contact click.

The file already states this principle, about a different mechanism, twelve lines below the hole:
*"A MOVE THAT DISABLES ITSELF CANNOT BE CLICKED TWICE, and every derived script that clicks a delivery
move on two turns would then hand Showdown a choice it rejects — a THROWN game, which is this file's
fixture being wrong rather than a finding."* And `move/self-switch`'s own `why` names this exact
hazard: *"it scripts a second click for a body that has already left, which Showdown rejects as an
illegal pass and throws."*

**Printed before it was trusted**, through the one predicate (the knob is flipped and `deliveryOf`
asked again — never a second copy of the test):

```
DELIVERY excludes 3 self-switch move(s): Flip Turn [Water Physical 60 selfSwitch=true],
  U-turn [Bug Physical 70 selfSwitch=true], Volt Switch [Electric Special 70 selfSwitch=true]
```

Exactly three, no over-match. `move/self-switch` reads `e.selfSwitch` off the entity and writes its own
script, and `ability/switchout` names `'uturn'` as a literal, so neither draws a pivot from this table.

**Measured, all three stages, against the artifacts at HEAD:** items 148 → 148 (**0 rows moved**),
abilities 173 → 175 (**exactly the 2 intended**), moves 486 → 486 (**0 rows moved**).
**Red again under the knob:** `ROSTER_ALLOW_SELFSWITCH_DELIVERY=1` returns `lightmetal` to
COULD-NOT-STAGE.

## Batch 2 — Cute Charm: two gaps stacked, and closing either alone proves nothing

### (1) The fixture could not declare a gender

Attract's condition gates on gender and `buildPair` wrote `gender: 'N'` on every body, so the coin
could come up and no board would move. That refusal was correct and it named what it was owed: *"a
fixture that can declare a gender."* The driver grew a `declaredGender` seam on 2026-09-11 and
medicham2 writes the matching `|switch|` details suffix, so the pair can now be declared.

`play()` opens the seam **per scenario** — only when a body actually declares M/F — so every other
fixture in the file plays the byte-identical game. Both bodies are checked against the format:
Showdown's constructor is `genders[set.gender] || this.species.gender || sample(['M','F'])`, so a
declared gender *would* be honoured even on a species the regulation fixes — which is exactly why the
rule refuses unless both read `species.gender === ''`. Carrier Milotic F against a male Dragapult.

### (2) The leaf it writes was not compared

With the gender declared the row staged and the coin came up — and it read CONTROL-NOT-QUIET with
**zero** leaves surviving both controls. `diffs: []`, and both engines reported the *identical*
numbers, so there was no engine disagreement; the only moving leaves were Marvel Scale's.

The cause was a declared gap, not a mystery. `engine/board_state.js` held `volatile:attract` in
NOT_COMPARED, with an honest reason — *"wiring a leaf whose two shapes have never been SEEN is how a
comparator starts manufacturing divergences"* — and a `next` line asking for **exactly the fixture
above**. So the order was: build the fixture, SEE both shapes, then wire.
`tests/probe_volatile_leaves.js` (given the gendered pair) reads:

```
attract   Venusaur   yes attract=1 attract=1   yes  stall(d1) attract stall(d1) attract   -> BOTH
```

Bare presence on both sides, no duration on either, so nothing is collapsed. Wired.

**Result:** `cutecharm` COULD-NOT-STAGE → **FIRED-AND-BOARDS-MATCH** with `leaves_kept: 2` — the
attract leaf survives BOTH controls in BOTH engines, while the four Marvel Scale HP leaves are
correctly dropped as the control's. The green is the entity's, not the control's.

**Blast radius is one fixture by construction:** attract cannot exist without a declared gender, and
`declaredGender` is opt-in to the staging harness, so no game in the pinned pool can grow this leaf.
**Measured:** items 148 → 148 (0 moved), abilities 175 → 176 (**exactly one row**), moves 486 → 486
(0 moved).

## The accusation I nearly filed, and did not

The same probe reported `uproar SHOWDOWN ONLY` and `curse SHOWDOWN ONLY` — which reads as this engine
dropping the Uproar lock and writing no Curse. **Both were the probe.** It reads each body's `_vol`
map plus a hand-written list of the fields medicham2 keeps elsewhere, and that list omitted the
rampage lock `_mtLock` (which carries `vol: 'uproar'`, and which `board_state.js` has compared as a
clock the whole time) and Curse's Ghost-branch chip `_ptDmg` (ROADMAP #175 — a Condition here, not a
`_vol` entry).

This is the identical trap `_healBlock` is already named in that reader for. Both fields are now read
and the value slice widened to 40 characters, because the discriminator is *inside* the value —
`_mtLock` is shared with Outrage and Petal Dance, so `vol:"uproar"` is what tells them apart. Both
rows now read **BOTH**. Recorded as ROADMAP #606 rather than dropped quietly: a wrong accusation
retracted in silence is how the next one gets believed.

**Consequence, recorded rather than hidden.** `board_state.js`'s NOT_COMPARED row for yawn / curse /
heal block is restated: **all three read BOTH today** and are unwired for **blast radius alone** —
unlike attract they land in ordinary play, so wiring them changes what every pooled game compares.
That is its own measured batch with its own before/after, not a rider on this one.

## What is still unstaged, and the MEASURED reason

**Items: none.**

**Abilities — 3 CONTROL-NOT-QUIET, unchanged:**
- `magmaarmor` (`ability/refuses-one-status`) and `slushrush` (`ability/weather-speed`) — both call
  `stageAbility` directly. The route is a guarded delegation to `stageAbilitySwap`, and this pass
  CHECKED it further than the last one: neither rule passes `a1` nor `onBench` (what that builder
  overwrites), and **both run on CORNER arms**, where every die is a constant — so the prepended setup
  turn shifts no coin, which is the objection that would have killed it. **Not done**, because
  `stageAbility` is the builder for every rule in that block, so the guard has to be measured against a
  full `--reds` ability run to prove no red demonstration goes NOT CAUGHT. That is a batch, not a rider.
- `opportunist` — `ability/residual`; excluded on purpose, for the reason the previous pass measured.

**Abilities — 16 COULD-NOT-STAGE:** the six mega-only carriers (`aerilate`, `dragonize`, `filter`,
`furcoat`, `megalauncher`, `galewings`), `zerotohero` (closed by the regulation: `failskillswap` AND
`cantsuppress`, sole ability on its carriers), `simple` (in scope as CONFERRED, no sheet body),
`ripen` (its hook fires only for a berry's own boost, so nothing a foe clicks reaches it), and the
inert-staging group (`cloudnine`, `cudchew`, `frisk`, `hydration`, `klutz`, `screencleaner`,
`supremeoverlord`) whose reference board is identical with and without the entity.

**Moves — 8 COULD-NOT-STAGE, unchanged.** The previous pass's refusals were re-read and stand:
`focusenergy` IS the control click; `struggle` is disabled while any move is usable; `extremespeed` /
`iceshard` / `jetpunch` have no legal learner whose abilities the fixture may hold (the `wideAbility`
fix was measured and REFUTED); `upperhand` reads a target's priority intent; `ragingbull` is
forme-keyed across separate species. **`aurawheel` is the one with a route** — Hunger Switch flips
Morpeko's forme at the end of every turn, so two consecutive clicks by one body are the two branches
on one board, the same shape as the rule's weather arm. Morpeko is legal (`isNonstandard: null`) and
buildable (`mcKey` resolves). **Not attempted**: it needs a new arm in `move/type-changing`, and a
half-written rule is worse than a declared gap.

## The red demonstrations, and a count I nearly misread

**22 of 22 items, 45 of 45 abilities, 36 of 36 moves CAUGHT. Zero NOT CAUGHT in this run.** Anchors
apply exactly once in all three stages, and every written artifact carries a full `reds` array with
**0 entries at `ok: false`** — so `--reds` genuinely took effect (the file's own header warns that
`--write` without it silently stamps `reds: []`).

The ability rule count moved **44 → 45**, and that is a gain rather than drift: Cute Charm's rule
staged no member at all before this pass, so it had nothing to break and no red demonstration. It can
now express its own mechanic.

**`grep -c "NOT CAUGHT"` on the moves stage returns 8, and all 36 of its reds are `ok: true`.** The
eight are PROSE inside four ROADMAP #318 HELD rows (`belch`, `bugbite`, `pluck`, `recycle`), quoting a
measurement taken on a DIFFERENT AND OLDER release, `b42b81899631`, to explain why those rows are held
on their pre-#318 bodies. A count without its lines would have been reported as eight regressions.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 176 of 200 tested. 3 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist, slushrush
    PASS  deliberate roster / moves      clean: 486 of 497 tested
```

The abilities clause reads **176 of 200** against 173 before this pass, and the three rows in neither
column are exactly the three CONTROL-NOT-QUIET rows named above.

### One caveat I introduced, stated rather than left to be found

The gate's `no open, known engine defect` clause prints **STALE VERDICTS** —
`data/register-reality.json` was generated at 22:23 and `docs/ROADMAP.md` last changed at 23:46, which
is my own three-row edit. The clause still PASSES, and the three new rows are all **closed**, so none
of them can add a breakage claim to it; the note is that the verdict set predates them rather than
contradicts them. `node engine/register_reality.js` was started to refresh it and was **still running
at the end of this pass** — it is a long job, and it is hygiene for a caveat inside a passing clause,
not a blocker on anything measured here.

Unrelated and NOT from this pass: `engine/status.js` prints `FEATURE SEMANTICS CHECK FAILED` for
`data/policy-weights.json`. That file is dated 2026-08-28 and `data/engine-data.js` 2026-08-31, both
two weeks older than this session, and neither is modified in the working tree. It is a pre-existing
refit signal and belongs to MEASURE.

## Releases cut

**None.** No engine byte changed. The seven files touched are `tests/roster.js`,
`tests/probe_volatile_leaves.js`, `engine/board_state.js`, `docs/ENGINE.md`, `docs/ROADMAP.md`,
`docs/RUNNING-NOTES.md` and `CHANGELOG.md`. `engine/board.js`, `engine/magnemite.js` and
`data/engine-data.js` were not touched.
