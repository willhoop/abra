# Staging the untested in-scope mechanics — ENGINE, 2026-09-12

Release `534442d71183`, census `data/mechanics-census.json` (883 rows, unmoved), team store
`data/team-pool-frozen`. **No engine byte was modified and no release was cut** — the only code file
changed is `tests/roster.js`, which is not one of the 27 frozen `SOURCES` in
`engine/engine_release.js` (checked, not assumed).

## Counts, before → after

| stage | before | after | artifact |
|---|---|---|---|
| **items** | 142 MATCH / **6 COULD-NOT-STAGE** | **148 MATCH / 0 COULD-NOT-STAGE** | `data/roster.items.json` |
| **abilities** | 139 MATCH / **43 CNS** / **13 CNQ** / 5 DEF | **173 MATCH / 19 CNS / 3 CNQ / 5 DEF** | `data/roster.abilities.json` |
| **moves** | 486 MATCH / 8 CNS / 3 DEF | **486 / 8 / 3 — UNMOVED** | `data/roster.moves.json` |

All three stages: **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE.** Plant anchors 22/22, 44/44, 36/36
apply exactly once with none dead. Red demonstrations all CAUGHT in every stage.

The moves row is a **control**: this pass added shared helpers and changed the ability control arm, and
the moves stage was re-run to show those edits reach no move rule. It did not move by a single row.

## Items — one mechanism, and it was this file's pin

All six refusals were `PRIMARY_ARM_ID = "top-tie-first"`, the corner where every sub-100% roll FAILS.
Five move to `bottom-tie-first` — the shipped inverse corner, where every sub-100 roll lands in BOTH
engines, so it is a different corner of the same die and not a loosened pin.

- **`item/survives-by-chance`** (Focus Band) — new rule, bottom arm.
- **`item/adds-flinch-by-chance`** (King's Rock) — new rule, bottom arm. Venusaur hits Blastoise
  first; the foe's click never lands. The holder's hit is derived NOT to kill, because a flinch on a
  corpse is refused by both engines (`kingsRockRollSkippedOnKO`; the authority's `addVolatile` bails
  on `!this.hp`), and to carry no flinch of its own, because King's Rock declines to stack.
- **`item/priority-by-chance`** (Quick Claw) — new rule, bottom arm. Clefable holds it and is the
  SLOWER (112 against 117); each body kills the other, so the ORDER decides who is standing.
- **`item/status-cure`** extended (Aspear, Rawst) — the **secondary road**. Derived: this regulation
  has **no outright frz carrier at any accuracy** and only Will-O-Wisp at 85 for brn, so
  `STATUS_MOVE` is empty for both. A SECONDARY writes them, and secondaries fire on the bottom
  corner: frz by Ice Beam onto Kangaskhan, brn by Infernal Parade onto Goodra-Hisui. Members that
  already had a 100-accuracy outright carrier keep it and keep the primary arm.
- **`item/crit-ratio`** (Scope Lens) — rewritten, and it stays on the PRIMARY arm with **no die on
  either side**. The old reason ("the pin never lets a crit land") was true of BOTH corners, so it was
  never a fact about the arm; the way out is the RATIO. Read off the format: `critMult` is
  `[0,24,8,2,1]` clamped at 4, a delivery move carries `critRatio: 1`, Focus Energy answers
  `onModifyCritRatio(1) -> 3` and Scope Lens `-> 2`. The holder clicks Focus Energy then attacks:
  without the item, stage 3 = `randomChance(1,2)`, which the top pin FAILS; with it, stage 4 =
  `randomChance(1,1)`, which crits every time and no pin can stop.

### The Focus Band fixture killed its own survivor, and a probe proved it

Focus Band stayed COULD-NOT-STAGE after the arm move, reading *"THE STAGING IS INERT."* Three
hypotheses about the arm were wrong; the probe settled it. A constructed control (Close Combat into
Weavile) showed the authority **does** activate the item on the bottom corner, so the corner lands the
10% roll. Replaying the roster's own derived fixture then showed the mechanism:

```
|-activate|p2a: Whimsicott|item: Focus Band     the band DID fire
|-damage|p2a: Whimsicott|1/135                  and left it on 1 HP
|-status|p2a: Whimsicott|psn
|-damage|p2a: Whimsicott|0 fnt|[from] psn       and the poison killed it at the residual
```

The derived hit was **Poison Jab**, whose 30% secondary fires on this corner, so BOTH authority boards
ended the turn with the holder fainted and the inert gate fired. The mechanic was wired the whole
time; the fixture was killing its own survivor. `chanceSurvivalFixture()` now derives a hit that
writes **no status and no volatile** — stated structurally, not as a typed list of status names — and
searches every delivery move the attacker LEARNS, because `DELIVERY` holds only the top-base-power
move per type and those nearly all carry a secondary. Result: Rhyperior → Earth Power (1.6x, no
secondary) → Aggron.

## Abilities — a quiet control for a carrier that has none

Thirteen rows read CONTROL-NOT-QUIET: the control arm swaps in the carrier's OTHER ability, that
ability is itself live, and (subject MINUS a live control) cannot say which moved the board. For all
thirteen the second control ran and **disagreed**, so every leaf was dropped.

Derived before wiring, because the cheap fix is a different carrier and `carrierFor` already ranks a
quiet-control carrier first: this format holds **only 8 quiet abilities**, and **none of the 13** has
any legal carrier with a quiet alternate. There is no better body. Gastro Acid suppression is
measured dead in this simulator, so **Skill Swap** is the only route — and **0 of 13** are flagged
`failskillswap`, so the authority performs the exchange for every one.

`abilityScenario` now takes the in-play swap control when an ALTERNATE carrier's own control is not
in the quiet set. It is narrow: a row that already had a quiet control keeps its exact fixture, and if
the swap proof fails an ALTERNATE row falls through to its ordinary control rather than being refused.

### The red demonstration caught a regression I introduced

The first cut applied the swap control to every staging kind. The counts got **better** — 181 MATCH,
12 CNS, 2 CNQ — while the instrument got **weaker**: `ability/entry` and `ability/residual` went
**NOT CAUGHT**, against `ok: true` for all 44 rules in the pre-change artifact at git HEAD. Their
plants moved no board, so every green underneath them was vacuous.

The cause is the swap control's **prepended setup turn**. `entry` reads boundary 0 as the carrier's
first entry; `residual` starts the carrier on the bench and switches it in mid-turn so boundary 1 is
its entry turn. A prepended turn moves both, and `ability/residual`'s own break text says it "can only
be caught by a staging that has a mid-turn entrant in it". Those two kinds now keep their original
script byte for byte.

**The price, stated:** 181 → 173 MATCH, 12 → 19 CNS, 2 → 3 CNQ. A row that cannot attribute its delta
is a declared gap; a green whose rule cannot express its own mechanic is a lie. Final state is
**44/44 CAUGHT**.

## What is still unstaged, and the MEASURED reason

**Items: none.**

**Abilities — 3 CONTROL-NOT-QUIET:**
- `opportunist` — residual kind, deliberately excluded above to keep the red demonstration sound.
- `magmaarmor`, `slushrush` — these call `stageAbility` directly rather than `abilityScenario`. The
  route is a guarded delegation to `stageAbilitySwap`; checked and viable — neither rule passes `a1`
  nor `onBench`, which is what the swap builder overwrites and ignores. **Not done this pass**, kept
  separate so a bad result stays attributable.

**Abilities — 19 COULD-NOT-STAGE**, the load-bearing ones:
- `aerilate`, `dragonize`, `filter`, `furcoat`, `megalauncher`, `galewings` — no legal carrier that is
  buildable AND has a second ability; most are mega-only formes. A fact about the regulation.
- `cutecharm` — **REPORTED, NOT FIXED, and it is not mine to fix.** The volatile is gender-gated and
  `game_differential.js#buildPair` writes `gender: 'N'` on both sides by design. The coin can come up
  and no board will move. It is owed a fixture that can declare a gender; that file is owned by
  another agent this pass.
- `compoundeyes`, `lightmetal` — the SUBJECT arm THREW (`Can't pass: Your <body> must make a move`).
  Real instrument defects, still open.
- `simple` — in scope as CONFERRED (`engine/legal_scope.js`); no legal species carries it as a sheet
  body and this roster has no conferral rule. A staging gap of the instrument, not of the format.
- `zerotohero` — closed by the regulation: `failskillswap` AND `cantsuppress`, sole carriers hold it
  in slot 0 with nothing beside it. All three control shapes are shut.

**Moves — 8 COULD-NOT-STAGE:**
- `focusenergy` — it IS the control arm's inert click, so subject and control are the same script and
  the delta is empty by construction. Permanent and honest.
- `struggle` — Showdown disables it for any body that still has a usable move, and every staged body
  carries at least the inert click.
- `aurawheel`, `ragingbull` — type keyed on the user's FORME, and the formes are different species.
- `extremespeed`, `iceshard`, `jetpunch` — every legal buildable learner carries only abilities the
  fixture may not hold. **The obvious fix was measured and refused**: `wideAbility` would lend
  Dragonite **Multiscale**, Mamoswine **Thick Fat**, Ninetales-Alola **Snow Warning** and Glalie
  **Ice Body** — a damage modifier, a damage modifier, a weather setter and a residual heal. Every one
  breaks this fixture's own premise that the foe kills the user outright, so it would have produced
  green rows measuring the wrong thing. It needs a narrower filter than `wideAbility`; Jet Punch's sole
  user (Palafin, one ability, Zero to Hero) probably stays refused whatever happens.
- `upperhand` — the staging is inert; it reads whether the target is about to use a priority attack.

## The gate, run at the end of this pass

```
  GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld
    PASS  deliberate roster / items      clean: 148 of 148 tested
    PASS  deliberate roster / abilities  clean: 173 of 200 tested. 3 row(s) count in NEITHER column — the control arm is itself a live ability: magmaarmor, opportunist, slushrush
    PASS  deliberate roster / moves      clean: 486 of 497 tested
```

All nine clauses PASS. Board-material 0 of 961, narration zero undeclared across 961, game differential
0 of 6000 at the midpoint and at both corners and all fourteen interior indices.

## Releases cut

**None.** No engine byte changed.
