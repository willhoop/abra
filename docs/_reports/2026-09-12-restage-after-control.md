# Nine rows re-staged now that the control is honest — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (**883 probed / 883 live / 0 missing**,
unmoved), team store `data/team-pool-frozen`. **No engine byte was modified and no release was cut.**
The only code file changed is `tests/roster.js`, which is **not** one of the frozen `SOURCES`.

## Counts, before → after

| stage | before (artifacts at git HEAD) | after | artifact |
|---|---|---|---|
| **items** | 148 MATCH / 0 CNS / 0 CNQ / 0 DEF | **148 / 0 / 0 / 0 — UNMOVED** | `data/roster.items.json` |
| **abilities** | 138 MATCH / 55 CNS / 2 CNQ / 5 DEF | **147 MATCH / 46 CNS / 2 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 487 MATCH / 7 CNS / 0 CNQ / 3 DEF | **487 / 7 / 0 / 3 — UNMOVED** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE, 0 rows threw.** Plant anchors
**22 / 47 / 36 apply exactly once, none dead**; red demonstrations **0 `ok: false` in all three**.
Items and moves are the **controls** and neither moved a single row.

Nine rows closed, in three separately-measured batches:

| batch | rows | mechanism |
|---|---|---|
| 1 | `dragonize`, `filter`, `furcoat`, `megalauncher` | the any-tier carrier door |
| 2 | `noguard`, `compoundeyes`, `tangledfeet` | the pin makes an accuracy modifier an hp leaf |
| 3 | `keeneye`, `illuminate` | an evasion stage the holder does not see |

## THE BRIEF'S PREMISE WAS TESTED FIRST AND IT IS NOT WHAT THE 39 WERE OWED

The task was to re-stage the 55 COULD-NOT-STAGE rows "on a control that measures the SUBJECT". The
control is **already** honest, and that was measured rather than assumed before anything was built:

```
noguard, release 534442d71183
  ROSTER_SWAP_ARM_LEAVES_COUNT=1   FIRED-AND-BOARDS-MATCH    0 / 0 / 0 dropped   <- the pre-#609 green
  shipped bytes                    COULD-NOT-STAGE          16 + 36   dropped   <- sd_delta EMPTY
```

`swapLeaf` and `swapArmLeaf` can only remove `.ability` leaves whose two values are the exchange, the
swapper's own `pp[slot]` rows, and the inert click's volatile on that one slot. **No hp, status or
boost leaf can reach either function.** So the 39 rows are not rows whose evidence is being eaten —
they are rows on which the AUTHORITY's own board does not move. That is a statement about the
FIXTURE, and the only way out is a rule that stages the condition the ability actually reads. Nine of
them are now built; 41 remain and are listed at the end.

## Batch 1 — the carrier door (ROADMAP #610, closed)

`abilityCarrier` demands a legal, non-mega, buildable species that ALSO has a second sheet ability,
and refuses through `noCarrierWhy` — whose sentence names the REGULATION. Five abilities have no such
body, and for none of them is that a fact about the format: `carrierFor` has answered SUPPRESS and
MEGA since ROADMAP #138, `stageAbilitySwap` stages both, and three rules already reached that door.

**The ALTERNATE tier is tried first and unchanged**, which is the property that makes "nothing else
moved" a measurement rather than an argument. The predicate is asked of the body the ability actually
lives on — the **FORME** for a mega, because Aggron-Mega is Steel where Aggron is Steel/Rock and a
defensive scope sized off the base would be sized off a typing the ability never wears. Learnsets
agree across the pair (`checkCanLearn` walks `baseSpecies`), verified against the authority.

**What it matched, printed on the run and not inferred:**

```
TAKEN  aerilate      -> MEGA Pinsir -> Pinsir-Mega via Pinsirite      (types Bug -> Bug/Flying)
TAKEN  dragonize     -> MEGA Feraligatr -> Feraligatr-Mega via Feraligite
TAKEN  filter        -> MEGA Aggron -> Aggron-Mega via Aggronite      (types Steel/Rock -> Steel)
TAKEN  furcoat       -> SUPPRESS Furfrou     (its ONLY ability is the one under test)
TAKEN  megalauncher  -> SUPPRESS Clawitzer   (its ONLY ability is the one under test)
```

Exactly the five predicted, no over-match. `galewings` was never in this set — Talonflame is
ALTERNATE-tier with a second ability, and its refusal is the delivery table.

Also fixed in this batch: `ability/type-conversion` required its **top-ranked** defender to have an
unconverted-type negative, with no fallback to the next candidate. It now walks the ranked list, and
where the first candidate has a negative it stops on exactly the body it stopped on before — so only
a refusal can change.

## Batch 2 — the pin turns an accuracy modifier into an hp leaf

The primary arm lands every 100-accuracy move and misses everything below it, in both engines. Three
abilities sat in `ability/generic` reading INERT for want of that: the generic staging throws one
100-accuracy move, which no accuracy modifier in this format can move across the line either way.

Nothing is named. The **multiplier** is the literal argument of the handler's own `chainModify` (or
`Infinity` where it returns `true`); the **direction** is the handler PREFIX. That last point is
load-bearing and is read off the handler rather than the artifact: `data/abra-tags.js` records the
scope BACKWARDS on every carrier, and medicham2's own `ACCMOD` block says so.

**The second click is the direction test.** The foe throws a sub-100 click back at the carrier, which
`onAnyAccuracy` must ALSO land (No Guard does not care which end of the move it is on) and
`onSourceModifyAccuracy` must still MISS. An engine applying the multiplier to the wrong end agrees on
turn 1 and parts on turn 2.

Where the handler gates on a volatile (Tangled Feet reads `target.volatiles['confusion']`) the
volatile is put up by a derived 100-accuracy setter and the AUTHORITY's own board is asked whether it
landed, through `precondition` — a modifier whose gate never opened reads INERT and means nothing.

## Batch 3 — an evasion stage the holder does not see

Keen Eye and Illuminate are one mechanic under two names. Their `onTryBoost` half is genuinely
uncreatable here (`ability/stat-drop-reaction` measured it: every single-target accuracy drop in this
format is `isNonstandard: 'Past'`) and that rule deliberately returns `null` rather than refusing
them, precisely so the other half stays reachable. The other half is
`onModifyMove(move) { move.ignoreEvasion = true; }` and it is stageable.

Two exclusions, both rules rather than coincidences:

- **The raiser must write no volatile.** This format offers two self-targeting evasion raisers, and
  the bigger one — Minimize — installs a volatile that six moves in this format CANNOT MISS
  (`punishesMinimize`, ROADMAP #466, wired in `hitChance` above the stage arithmetic). A fixture built
  on it would be decided by whichever click the delivery table picked.
- **No carrier whose own alternate writes the same field.** Watchog holds Keen Eye AND Illuminate, so
  a sheet control drawn from the other would cancel the subject exactly and the row would read INERT
  for a reason about the pairing. The swap control avoids it today; the guard refuses it regardless.

## THE LEAVES WERE READ BEFORE THE COUNT WAS BELIEVED

This is the test ROADMAP #609 existed for, applied to every row this pass claims:

```
dragonize     3   p1.active[0].hp
filter        6   p2.party.aggron.hp, p2.active[0].hp
furcoat       4   p2.party.furfrou.hp, p2.active[0].hp
megalauncher  3   p1.active[0].hp
noguard      10   p1.party.samurott.hp, p1.active[0].hp, p2.party.machamp.hp, p2.active[0].hp
compoundeyes  6   p1.party.torkoal.hp, p1.active[0].hp
tangledfeet   6   p2.party.mrrime.hp, p2.active[0].hp
keeneye       4   p1.party.meowscarada.hp, p1.active[0].hp
illuminate    4   p1.party.meowscarada.hp, p1.active[0].hp
```

**Not one `.ability`, `.pp` or `.vol` leaf in any of them.** The correction is live beside these rows
and its counters prove it ran: **5,264 self-describing dropped, 3,140 control-arm bookkeeping
dropped, 60 REAL ability rewrites KEPT** — the last being what stops the fix deleting Trace's copy.
`tests/probe_control_self_name.js` reads **GREEN 7 of 7**, exit 0, with clauses B (Contrary keeps 26
real leaves) and C (Trace keeps its 6 real rewrites) both reached and both passing.

Both new rules demonstrate their own mechanic: `ability/accuracy-decides-the-hit` is CAUGHT via
`compoundeyes -> DID-NOT-FIRE` and `ability/ignores-evasion` via `illuminate -> DID-NOT-FIRE`, each
from a member that was GREEN against the clean source, so neither flip is a WEAK one.

## A REGRESSION I SHIPPED, CAUGHT BY THE RUN, INSIDE THE PASS

The new sentence appended to `noCarrierWhy` read `ANY_TIER_WHY[e.id]`. `e` is the name every RULE
uses for its entity; **that function's parameter is `ab`**. It threw `e is not defined` for every
caller that reached it, and the run reported `galewings` as *"the shape rule threw"*. Blast radius was
measured rather than assumed — **exactly one row**, against 0 threw at HEAD — fixed, and the final
artifact reads 0 threw. Recorded here rather than quietly corrected: a regression found by the
instrument is the instrument working, and hiding it teaches nobody.

## What is still unstaged, and the measured reason

**Items: none. Moves: 7 COULD-NOT-STAGE, unchanged and re-read** — `focusenergy` IS the control click,
`struggle` is disabled while any move is usable, `extremespeed`/`iceshard`/`jetpunch` keep the MEASURED
`wideAbility` refutation, `upperhand` reads a target's priority intent, `ragingbull` is forme-keyed
with no flip ability.

**Abilities — 2 CONTROL-NOT-QUIET, unchanged:** `magmaarmor` and `opportunist`. Both were left alone
deliberately: #608's fix is a change to the quiet set, and making it in the same pass as a nine-row
move would leave neither attributable.

**Abilities — 46 COULD-NOT-STAGE:**

- **41 read `THE STAGING IS INERT`** — the authority's own board is identical with and without the
  entity, so the fixture stages nothing and a green would be vacuous. Each is winnable fixture work:
  `aftermath, analytic, angerpoint, berserk, cheekpouch, cloudnine, corrosion, cudchew, damp,
  earlybird, frisk, goodasgold, heavymetal, hydration, infiltrator, justified, klutz, leafguard,
  lightmetal, longreach, magician, merciless, minus, moxie, pickpocket, plus, quickfeet, receiver,
  rivalry, sandforce, screencleaner, skilllink, sniper, stalwart, steadfast, stickyhold,
  supremeoverlord, surgesurfer, symbiosis, synchronize, unaware`.
- **`aerilate`** — a carrier exists now, and the rule gets as far as the DEFENDER: no unconverted-type
  delivery move exists against either body the Normal→Flying conversion is worth anything on
  (Torterra, Falinks), so the rule has no on-board negative. The format runs out, not the ranking.
- **`galewings`** — not a control problem. `ability/priority-mod` needs a faster foe its Flying click
  kills outright; the DELIVERY TABLE hands it Drill Peck, which Talonflame does not learn, and Brave
  Bird — which it does — is refused by `deliveryOf` on `m.recoil`. Owed: a learnset-aware delivery
  pick for that rule.
- **`zerotohero`** — closed by the REGULATION, and the row carries the measurement rather than an
  argument. Derived at run time: `flags.failskillswap` AND `flags.cantsuppress` are both set, cited to
  `Battle#skillSwap` (`sim/battle.ts:1316`) and Gastro Acid's own `onTryHit` (`data/moves.ts:6437`),
  and its only carriers (Palafin, Palafin-Hero) hold it in ability slot 0 with nothing beside it. All
  three control shapes are shut; there is no cleverer fixture waiting to be built.
- **`ripen`** — its boost hook fires only for a berry's own boost, so nothing a foe clicks reaches it.
- **`simple`** — in scope as CONFERRED with no sheet body; this roster has no conferral rule.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 147 of 200 tested. 2 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist
    PASS  deliberate roster / moves      clean: 487 of 497 tested
```

`engine/quarantine.js` exit 0, all nine clauses PASS. Board-material **0 of 961** with 10,705 of
10,705 turn boundaries identical, narration **zero undeclared across 961**, game differential **0 of
6000** at the midpoint and at both corners and all fourteen interior indices.

## Releases cut

**None.** No engine byte changed. Files touched: `tests/roster.js`, the three roster artifacts (plus
`data/roster.json`, the convenience copy, and `data/roster.abilities.prev.json`), `docs/ENGINE.md`,
`docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md` and this report. `engine/board.js`,
`engine/magnemite.js` and `data/engine-data.js` were **not** touched.

`engine/status.js --write` was **NOT** run. It restamps the generated blocks of all five division
ledgers, four of which are already modified in this working tree by other work, and the brief scoped
this pass to `docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md` and `CHANGELOG.md`. Nothing
inside a `<!-- GENERATED -->` block was hand-edited.

Unrelated and NOT from this pass: `engine/status.js` prints `FEATURE SEMANTICS CHECK FAILED` for
`data/policy-weights.json`. It is pre-existing and belongs to MEASURE.

**`tests/test-docs-current.js` EXITS 1, ON A CLAUSE THAT IS NOT THIS PASS'S, AND THAT WAS CHECKED
RATHER THAN ASSERTED.** 36 of 37 clauses pass; the failure is 3b(d), *"figures bound to no trace
(grandfathered): no new entries (baseline 1902, now 1877)"*. Every NEW entry in that block sits in
`docs/ABRA-technical-docs.md` (10) or `docs/MODELS.md` (2 of the 12 printed, 22 in total) — **zero
lines in the block name `docs/ENGINE.md`, `docs/ROADMAP.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`
or `docs/_reports/`**, which is the whole of what this pass edited. Both named documents were already
modified in this working tree before this pass began, by the HELD 7.0.0 release, and this pass was
instructed not to touch them. The count is also BELOW its baseline (1877 against 1902) with 47 entries
retired, so the ratchet is tightening; it fails on membership, not on volume. Flagged here because the
pre-commit hook runs this gate, and a red nobody named is how "one of the two known failures" started.
