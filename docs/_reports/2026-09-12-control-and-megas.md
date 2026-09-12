# The swap control was counting itself, and 39 greens were vacuous — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (**883 probed / 883 live / 0 missing**,
unmoved), team store `data/team-pool-frozen`. **No engine byte was modified and no release was cut.**
The only code file changed is `tests/roster.js`, which is **not** one of the 27 frozen `SOURCES` —
checked this pass by reading `ER.SOURCES` myself (`tests/roster.js not frozen`,
`engine/medicham2-browser.js FROZEN`), not inherited from the previous report.

**The pass was briefed to close ROADMAP #609 and then gain rows. It closed #609 and LOST 39 rows, and
that is the correct outcome.** The rows were never testing anything.

## Counts, before → after

| stage | before (artifacts at HEAD) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ | **148 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 177 MATCH / 16 CNS / 2 CNQ / 5 DEF | **138 MATCH / 55 CNS / 2 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 487 MATCH / 7 CNS / 3 DEF | **487 / 7 / 3 — UNMOVED** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE.** Red demonstrations **22 / 45 / 36
CAUGHT, ZERO NOT CAUGHT**; plant anchors **22 / 45 / 36 checked, none dead**. Items and moves are the
**controls** and neither moved by a single row, which is what says this change reaches only the
ability stage's swap control.

**Exactly 39 rows moved MATCH → COULD-NOT-STAGE, and they are exactly the 39 predicted from the
artifact BEFORE the code was touched** — same list, none added, none missed, zero rows rose, zero
other verdict changes.

## What was actually wrong (ROADMAP #609, now closed)

`controlOf` populated the `swap` record **only in the sheet-swap branch**. For a row whose control is
an in-play Skill Swap (`controlKind === 'abilityswap'`) it populated nothing, so `swapLeaf` returned 0
on its first line and **the swap-leaf correction was structurally dead for every swap-controlled row**
— on the subject's side as well as the swapper's. The ability stage printed `0 leaves DROPPED` and
nothing read it.

The row the existing probe was built around says it plainly:

```
leafguard, release 534442d71183
  --no-swap-control   COULD-NOT-STAGE          16 dropped    delta  0 leaves   <- correctly refused
  default (swap)      FIRED-AND-BOARDS-MATCH    0 dropped    delta 26 leaves   <- a vacuous green
```

Not one of those 26 leaves is Leaf Guard acting. They are the swapper's own `.ability` and party row,
`pp[1].skillswap`, `pp[1].focusenergy`, `vol.focusenergy`, and the carrier's own swap leaves.

**This is the Focus Sash defect on the ability axis, for the third time** — the control arm describing
itself and being counted as the entity's evidence.

### It was introduced by the fix for something else, and nothing could see it

`swapForQuiet` (the previous pass, ROADMAP #138/#607) moved rows onto the in-play swap control to get
them out of CONTROL-NOT-QUIET. Every row it moved had the correction silently switched off by that
move. **`tests/probe_control_self_name.js` was RED 3 of 7 clauses before this pass began** and is
**not registered in `tests/run-all.js`**, which is why a red probe guarding exactly this defect was
invisible. Registering it is owed; `run-all.js` is not this division's file, so it is reported rather
than edited.

### The fix

Both halves of the exchange are now armed in `controlOf` and dropped in `armDelta`, **conditioned on
the VALUES and never on the path** — a blanket ignore of `.ability` would delete Trace's real copy for
ever, which is what probe clause C exists to refuse:

- **the carrier's side** — `swap.species` / `swap.controls`, so the existing `swapLeaf` drops the
  `with=<ability under test> without=<lent ability>` pair;
- **the swapper's own slot** (`swapArmLeaf`, new) — the ability it handed over, on its slot and its
  party row, plus the click the control arm spends where the subject arm idles (`pp.skillswap`,
  `pp.<inert>`, `vol.<inert>`), bounded to that one slot.

Counted separately and printed every run, so a zero on either is visible:
`control_arm_bookkeeping_dropped` reads **2,808** on the ability stage and **0** on items and moves.

**The cost is stated:** an entity that drained the swapper's PP, or put the inert click's volatile on
it, would be masked on those leaves alone. Nothing in this file stages either, and the alternative is
the 39.

### Red before, green after, red again under its knob

- **Before:** `probe_control_self_name.js` **RED, 3 of 7** (clause A0/A1/A2, Leaf Guard green on 16
  ability leaves with the counter at 0).
- **After:** **GREEN, 7 of 7**, with clauses B (Contrary keeps its green on 26 real leaves) and C
  (Trace keeps its copy, 24 real rewrites kept) intact.
- **Red again:** `ROSTER_SWAP_ARM_LEAVES_COUNT=1` restores the whole pre-#609 state and `leafguard`
  returns to FIRED-AND-BOARDS-MATCH on 26 leaves with `0 / 0 / 0`. The knob deliberately disarms
  **both** halves; gating only the new one would have left a restored run still refusing the row, and
  the demonstration would have been measuring a third thing.

### The classifier was validated against an independent oracle before it was believed

The 39 were predicted by classifying each swap-controlled row's stored `sd_delta` into bookkeeping and
real. `--no-swap-control` is an independent oracle — it reverts to the sheet control, where the
correction has always worked — and it agreed **7 of 7**:

| predicted | rows | oracle verdict | real leaves |
|---|---|---|---|
| vacuous | `aftermath`, `moxie` | CONTROL-NOT-QUIET | 0 |
| vacuous | `unaware`, `sniper`, `leafguard` | COULD-NOT-STAGE | 0 |
| real | `roughskin`, `protean`, `weakarmor` | FIRED-AND-BOARDS-MATCH | 6, 6, 16 |

and the post-fix run reproduced the predicted real-leaf counts exactly (`slushrush` 25, `roughskin` 6,
`weakarmor` 16, `sandrush` 25).

### THE 39 ARE STAGING ROWS, NOT LOST MECHANICS

`aftermath, analytic, angerpoint, berserk, cheekpouch, compoundeyes, corrosion, damp, earlybird,
goodasgold, heavymetal, illuminate, infiltrator, justified, keeneye, leafguard, lightmetal, longreach,
magician, merciless, minus, moxie, noguard, pickpocket, plus, quickfeet, receiver, rivalry, sandforce,
skilllink, sniper, stalwart, steadfast, stickyhold, surgesurfer, symbiosis, synchronize, tangledfeet,
unaware`

**The census is UNMOVED at 883 live / 0 missing.** A roster row falling to COULD-NOT-STAGE says that
row's FIXTURE was inert, not that the mechanic regressed — and nine of the 39 (`angerpoint`,
`berserk`, `cheekpouch`, `goodasgold`, `minus`, `plus`, `receiver`, `symbiosis`, `synchronize`) are
independently named in the census artifact. **Damp is the clearest case:** CLAUDE.md records it proven
at exact zero by `selfKOAlwaysAboveTheHit` with a knob-cleared control, and that evidence is untouched
by this pass. What these rows lost is a roster fixture that demonstrated anything.

## ROADMAP #608 — REFINED AND DELIBERATELY NOT FIXED

The row says the quiet set cannot see `onCriticalHit = false`. True, and the root cause is sharper:
**one fact with two implementations that disagree.**

- The **move** stage already owns the honest derivation — `moveQuietAbilities(arm)` is arm-aware and
  strict (no `on*` key of ANY type), minus `QUIET_EXCLUDE` and minus `MOVE_FIELD_ACTORS`. That table
  names `earlybird`, `dancer` and `corrosion` as live-through-a-field, and an independent scan of the
  authority's own source agrees exactly: `battle-actions.js:283` `hasAbility("dancer")`,
  `pokemon.js:1257` `hasAbility("corrosion")` inside `setStatus`, `conditions.js:88`
  `hasAbility("earlybird")`. Line 2789 of the file states the lesson outright.
- The **ability** stage's `QUIET` is a second implementation using the function-only predicate, with
  no arm and no field actors. That is the CLAUDE.md rule this repository is organised around.

**And there is a second, subtler half.** `critsLand().armourShared` measures *"do both engines
implement the armour identically"* — the right question for the move stage, where the body carries the
armour in BOTH arms so it cancels. It is the **wrong** question for an ability CONTROL, where the
armour is in the control arm only and a landing crit makes it a live damage modifier. On this release
`critsLand()` reads *"a crit DOES land, on bottom-tie-first only"* with `armourShared` **true**, so a
naive unification would re-admit the crit armour on exactly the corner where it contaminates.

**Not fixed this pass, on purpose.** A 39-row move must be attributable to one cause. The fix is a
`quietAsControl(ability, arm)` distinct from `moveQuietAbilities(arm)`, and it is measured to be
low-risk: all five rows whose control is Shell/Battle Armor (`defiant`, `drought`, `gooey`,
`sapsipper`, `whitesmoke`) are on `top-tie-first`, where no crit lands, so an arm-aware predicate
keeps their greens.

### `magmaarmor` cannot be closed, and the format is why

Asked of the format: **Magma Armor has exactly ONE legal carrier, Camerupt**, and both of its
alternates are live on the corner the rule needs — Solid Rock (`onSourceModifyDamage`) and Anger Point
(`onHit`, +6 Attack on a crit, maximally live precisely where every crit lands). The rule must run on
`bottom-tie-first` because this format writes FREEZE only as a 10% secondary. There is no better body
and no lendable quiet ability with a legal carrier on that arm, so the row stays CONTROL-NOT-QUIET as
a declared gap. **No green was manufactured for it.**

## The mega-only six — still not attempted, with a much stronger reason

`aerilate`, `dragonize`, `filter`, `furcoat`, `megalauncher`, `galewings` were deferred last pass
because the Skill Swap control could not be trusted. **This pass measured exactly how untrustworthy it
was: it was manufacturing vacuous greens for 39 rows.** Attempting six more rows on it would have
added six more. Now that #609 is closed the route is open for a following pass, and the honest
expectation is stated: with the correction armed, a mega row only counts if it moves a leaf that is
not the exchange.

Two of the six are also mislabelled as "mega-only" and that is recorded for whoever takes them:
`furcoat`'s carrier is **Furfrou** and `megalauncher`'s includes **Clawitzer** — both legal
non-mega species whose only ability is the one under test (SUPPRESS tier, not MEGA), and `galewings`
is refused by the DELIVERY TABLE (no carrier learns Drill Peck; Brave Bird is refused by `deliveryOf`),
which is not a control problem at all.

## The remaining gaps, unchanged and re-read rather than assumed

**Items: none.** **Abilities — 2 CONTROL-NOT-QUIET:** `magmaarmor` (above) and `opportunist`, which is
owed a fixture in which the copy demonstrably lands. **Moves — 7 COULD-NOT-STAGE:** `focusenergy` IS
the control click; `struggle` is disabled while any move is usable; `extremespeed` / `iceshard` /
`jetpunch` keep the MEASURED `wideAbility` refutation; `upperhand` reads a target's priority intent;
`ragingbull` is forme-keyed with no flip ability, measured.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 138 of 200 tested. 2 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist
    PASS  deliberate roster / moves      clean: 487 of 497 tested
```

`engine/quarantine.js` exit 0, all nine clauses PASS, board-material 0 of 961, narration zero
undeclared across 961, game differential 0 of 6000 at the midpoint, both corners and all fourteen
interior indices.

*(`data/quarantine-stamp.json` on disk is dated 2026-09-10 and reads `gate_open: false`. It predates
this run and is not evidence about it; the block above is from the run performed this pass.)*

## Releases cut

**None.** No engine byte changed. Files touched: `tests/roster.js`, `docs/ENGINE.md`,
`docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md` and this report.
`engine/board.js`, `engine/magnemite.js` and `data/engine-data.js` were not touched.

## Owed

1. **Register `tests/probe_control_self_name.js` in `tests/run-all.js`.** It was red for a day and
   nothing said so. Not this division's file.
2. **ROADMAP #608** — `quietAsControl(ability, arm)`, with the `armourShared` distinction above.
3. **The 39 rows are now honest COULD-NOT-STAGE and most are winnable.** Each needs a fixture in which
   its ability does something the board can see; that is fixture work, one rule at a time.
4. **The mega-only six**, now that the control is corrected.
