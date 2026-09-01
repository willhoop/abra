# A terrain rewrites the move's target, and this engine had no target rewrite at all

2026-09-01. **Batch of one.** Expanding Force becomes `allAdjacentFoes` on Psychic Terrain when the
user is grounded. This engine reached ONE body and charged it FULL single-target damage; the
authority reaches TWO and charges each the spread 0.75.

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 821 / 821 / 0 | **822 / 822 / 0** |
| empirical board-parted | 80 of 961 | **78** |
| empirical protocol-diverged | 171 of 961 | **169** |
| distinct divergence causes | 149 | **147** (3 removed, 1 added) |
| end-state verdicts | 907 / 52 / 1 / 0 / 1 | **909 / 50 / 1 / 0 / 1** |
| damage differential, 6,000 comparisons, seed 20260804 | — | **0 disagreements**, all 16 arms |
| engine release | `cde6cb10daa7` | **`1c346ff23712`** |

Prediction written before the run:
`data/verification/2026-09-01-terrain-spread-target-prediction.json`.
Pins, both arms: `--games 1200` (yields 961), `--turns 12`, `--arm middle`, `--steering empirical`,
`--team-store data/team-pool-frozen` (pool `0d103fb9fa87`), `--census
data/verification/census-pin-9446a684709d.json`.

---

## THE DELTA IS KNOB-CONTROLLED ON THE SAME RELEASE, AND THE BEFORE-ARM IS BYTE-IDENTICAL

`MEDI_TERRAIN_TARGET_SINGLE=1` on release `1c346ff23712` reproduces the published baseline exactly:

```
punishkinds (published)   protocol 171  parted 80  causes 149  907/52/1/0/1
terrainspread-before      protocol 171  parted 80  causes 149  907/52/1/0/1   <- knob on
terrainspread  (after)    protocol 169  parted 78  causes 147  909/50/1/0/1
```

`first_divergences`, `classes` and `end_state` are **byte-identical strings** between the published
artifact and the knob before-arm. Every figure that moved is this fix and nothing else.

---

## 1. THE MEMBERSHIP IS DERIVED, AND THE FIELD-CONDITIONAL SHAPE HAS EXACTLY ONE LEGAL MEMBER

Walked over `Dex.forFormat('gen9championsvgc2026regmb').moves.all()`, filtered
`exists && !isNonstandard && tier !== 'Illegal'`, then carrier-checked through
`champions_sim.moveCarriers` (the validator's own `checkCanLearn`). The legal moves whose
`onModifyMove` assigns `move.target`:

| move | carriers | rewrite | in this batch? |
|---|---|---|---|
| **Expanding Force** | **38** | `move.target = 'allAdjacentFoes'` when `field.isTerrain('psychicterrain') && source.isGrounded()` | **YES** |
| Curse | 124 | `move.target = move.nonGhostTarget` / `'randomNormal'`, off the USER'S TYPE | no — not field-conditional, a different shape, and still unmodelled |

Tera Starstorm is mainline's third member and has **zero carriers** here. So the field-conditional
target-rewrite shape has **one** legal member, and the enumeration matched the scope's reading for
once — but only because the scope named one move; the *shape* is two and the second is unfiled work.

**Champions does not override it.** `grep -n expandingforce data/mods/champions/moves.ts` returns
nothing; the handler is read whole from `data/moves.ts:4944-4965`.

---

## 2. THE GATE IS THE USER'S FEET, AND `isSemiInvulnerable()` DOES NOT BELONG IN IT

```js
onModifyMove(move, source, target) {
    if (this.field.isTerrain('psychicterrain') && source.isGrounded()) {
        move.target = 'allAdjacentFoes';
    }
},
```

`source.isGrounded()` — the USER. The engine's own comment at the `terrainScaled` site records that
the two members disagree about whose feet matter; this is the one that reads the user's.

**And the semi-invulnerable clause is ABSENT.** Neither clause of `expandingforce.onModifyMove` nor
of its `onBasePower` mentions `isSemiInvulnerable()`. The scope's observation — that every terrain
handler pairs `isGrounded()` with `!isSemiInvulnerable()` — is about the terrain **CONDITION's** own
handlers (`onSetStatus`, `onTryHit`, `onResidual`). This handler lives on the **MOVE** and pairs it
with nothing. Adding the clause here would have been an over-narrowing invented in this file. It is
deliberately absent and the answer to the brief's question is **NO**.

---

## 3. RED FIRST, AND THE MEASUREMENT REFUTED THE SCOPE'S OWN UNPROVEN CLAIM

The scope named *"Expanding Force hits one target under Psychic Terrain"* as its most load-bearing
unproven claim. Measured on the unmodified engine, before a byte moved — Chimecho into Garchomp +
Garchomp, both foes unfaintable, `rng` 0.5:

```
grounded user + psychic terrain, 2 foes : {"f1":148,"f2":0}
grounded user + NO terrain,      2 foes : {"f1":76, "f2":0}
AIRBORNE user + psychic terrain, 2 foes : {"f1":114,"f2":0}
grounded user + psychic terrain, 1 foe  : {"f1":148}
grounded user + ELECTRIC terrain,2 foes : {"f1":76, "f2":0}
```

**Both halves red, and they are two separate facts.** The partner lost **0** in every arm — the
target list never widened. And the aimed body lost the same **148** whether its partner was standing
or not — the spread reduction was never paid. After the fix, the same board reads
`{"f1":111,"f2":111}` with two foes and `{"f1":148}` with one, which is `targets.length > 1` — the
authority's own gate on `move.spreadHit` (`battle-actions.ts:551`).

**A defect this measurement exposed and this batch did NOT fix.** The airborne arm reads **114**, not
76: `76 x 1.5 = 114`, the move's own `terrainScaled` x1.5 firing with **no grounded gate** — the
scope's item 2. The terrain CONDITION's Psychic `x5325/4096` IS correctly gated (`148 = 114 x 1.3`
only on the grounded arm). Item 2 is a separate batch; my airborne control asserts `f2 == 0`, not
`f1`, so the two do not interfere.

**A probe error caught before it became a finding.** The first version of the staging put a
**Tyranitar** in the partner slot. Psychic does nothing to Dark, so a correctly widened move read 0
on the partner and the fix looked like it had not landed. The probe now stages the same species in
both foe slots and says so in its header.

---

## 4. WHAT MOVED IN THE ENGINE

Three call sites and one helper, all in `engine/medicham2-browser.js`.

**`TERRAIN_TARGET_REWRITE` + `terrainWidensToSpread(id, att, field)`**, beside `SPREAD`. `SPREAD` is
a set of names fixed at load; Showdown's target is not. Typed as a **literal** per the ROADMAP #92
precedent — no tag carries a target REWRITE (`targetClass.target` is Showdown's STATIC
`move.target` string and is correct as it stands), and routing through `tag_dex` first would have
blocked the fix on a regeneration.

**The executor** (`battleTurn`, immediately below `const mv = a.move.mv`), which is where the
authority answers it: `onModifyMove` runs inside `useMove`, not when the action was chosen, so a
Psychic Terrain that went up earlier **this turn** from a faster body still widens the move.
Re-derived rather than or-ed in —

```js
a.move.spread = SPREAD.has(a.move.id) || _w;
```

— so an action object reused on a later turn with the terrain gone falls back to the dex answer. A
bare `a.move.spread = true` would have been a one-way latch. **One assignment and not nine locals:**
nine sites below read `a.move.spread` (the priority gate's aim, the target list, the redirection
gate, the ally-hit test, the smart-target test, `_spreadHit`, three guard-class reads) and "is this a
spread move" is one fact.

**Two pricing sites in `playerActionPrimary`** — the targetless-spread aim and the `{kind:'attack'}`
return — so a caller that never reaches `battleTurn` does not value a widened Expanding Force at full
single-target damage.

### Two counters, because it is two consequences

`MEDSEEN.terrainTargetWidened` and `MEDSEEN.terrainTargetWidenedSpreadReduced`. A run where the first
moves and the second never does, over boards with a live partner, is **two bodies taking
single-target damage** — strictly worse than the bug it replaces. Proved to move independently:

```
start           {"widened":0,"reduced":0}
after 2-foe     {"widened":1,"reduced":1}     both rise
after 1-foe     {"widened":2,"reduced":1}     widened rises, reduced does NOT
after clear     {"widened":2,"reduced":1}     neither rises
under the knob  {"widened":0,"reduced":0}     terrainTargetSingleRestored = 1
```

---

## 5. THE PROBE — RED FIRST, AND THE TWO HALVES ARE TWO ASSERTIONS

`tests/test-mechanics.js`, `move | targetClass`, *"Expanding Force becomes a spread move on Psychic
Terrain for a grounded user, and every body it reaches pays the spread reduction"*.

- **HALF 1, the target list.** `test.f2 > 0` and the partner's loss is 0 in all three controls.
- **HALF 2, the reduction.** Asserted **separately**, against the same board with only the partner
  removed: `test.f1 < solo.f1` and inside `[floor(0.70 solo), ceil(0.80 solo)]`, and
  `test.f1 === test.f2`. A fix that widened the list and skipped the reduction passes half 1 and
  **fails here**.

**Over-fire controls that did not move**: no terrain (`f2 = 0`), Electric Terrain (`f2 = 0` — a fix
keyed on "any terrain" fails this), airborne user with Levitate set explicitly (`f2 = 0` — a fix that
forgot the user's feet fails this). The ability is set explicitly on **both** grounding arms, so
neither side rests on what `buildMon` supplies.

Under `MEDI_TERRAIN_TARGET_SINGLE=1` the row reads

```
MISSING  targetClass  ... partner's HP loss: Psychic Terrain 0, no terrain 0, Electric Terrain 0,
airborne user 0; aimed body lost 148 with a live partner and 148 with the partner down
```

and the census **refuses to write** (`MEDFAILS.terrainTargetSingleRestored`, registered in
`DELIBERATE_BREAK`). Without the knob it is LIVE at `111 / 0 / 0 / 0` and `111` against `148`.

Census after: **822 live, 0 missing, 822 probed, 0 hollow, 0 threw, 0 unarmed.**

---

## 6. THE POOL MOVED, AND MY PREDICTION SAID IT WOULD NOT — A NAMED MISS

**I predicted the pool would SIT STILL and I was wrong.** The scope predicted it would move and was
right. The prediction file carries the arithmetic I used and it is worth keeping, because the
reasoning was not silly and the conclusion was still wrong:

> 147 is a count of REAL HUMAN CLICKS in the 17,381-game store. The differential does not replay
> those clicks — `--steering empirical` DRAWS each action from `P(move | species)`. An Expanding
> Force carrier and a Psychic Terrain setter are both in the six in 399 of 17,381 games (2.30%);
> over 961 that is ~22, both brought ~10, the setter actually clicking Psychic Terrain inside 12
> turns ~2.6, the carrier then clicking Expanding Force inside the 5-turn window ~0.8.

The product is right and the point estimate was **0-1 games**. The pool delivered **2**, which is
inside my stated band `[78, 80]` but not at my point. The lesson is not the arithmetic — it is that
a 0.8-game expectation is not a prediction of zero, and I wrote the headline as "SITS STILL" when the
band underneath it said otherwise.

### The three removed causes name both halves separately

```
REMOVED  event missing from medicham2 :: |-damage|p2b|H/H <> |faint|p2a
REMOVED  event missing from medicham2 :: |-immune|p2b <> |-supereffective|p2a|1
REMOVED  -damage field 3 :: |-damage|p1a|H/H  [archaludon 84/165 vs 57/165]
ADDED    event missing from medicham2 :: |-fail|p2b <> |-fieldend|psychicterrain
```

Left is Showdown, right is medicham2. The first two are the **target list**: the authority resolving
the SECOND foe (`p2b`) — damaging one, and finding the other immune — where medicham2 was still on
`p2a`. The third is the **spread reduction**, and it is exact: `165 - 84 = 81` against
`165 - 57 = 108`, and `81 / 108 = 0.750`. So the pool confirms the two halves **independently**, on
different games, which is more than the lab probe can do.

The added cause is the standing "same game running further" shape — the game that used to part on the
missing second body now reaches `|-fieldend|psychicterrain`, and its `first_divergences` row changed
in place from `|-damage|p2b|H/H <> |faint|p2a` to `|-fail|p2b <> |-fieldend|psychicterrain`.

---

## 7. THE PREDICTIONS, SCORED

| # | claim | predicted | measured | |
|---|---|---|---|---|
| P0 | both halves RED at HEAD | partner 0, no reduction | partner 0, 148 vs 148 | HIT |
| membership | legal field-conditional target-rewrite moves | 1 (Expanding Force, 38 carriers) | 1 | HIT |
| semi-invuln | does the clause belong | NO | NO | HIT |
| P1 | both halves asserted separately | yes | yes | HIT |
| P2 | over-fire controls do not move | 4 arms unmoved | 4 arms unmoved | HIT |
| P3 | census | **822** (band 822-823) | 822 | HIT, point |
| P4 | board-parted | **80** (band 78-80) | **78** | MISS, in band |
| P5 | protocol | **171** (band 169-171) | **169** | MISS, in band |
| P6 | causes | **149** (band 147-151) | **147** | MISS, in band |
| P7 | end-state | 907/52/1/0/1 | 909/50/1/0/1 | MISS, in stated band |
| P8 | void / usable | void 9 unchanged | void 9 unchanged | HIT |
| P9 | knob restores the before-arm exactly | byte-identical | byte-identical | HIT |
| P10 | which scoreboard | LAB moves, POOL still | LAB moved, **POOL ALSO MOVED** | MISS |
| P11 | two counters move independently | yes | yes | HIT |

**Eight hits, five misses — and all five misses are the same miss**, made once and propagated: I said
the pool would not move. Every one is in the direction of a better engine and inside its own stated
band.

---

## OWED, NOT RUN

- **Item 2 of the scope's plan is still open and this pass measured it more precisely.** The
  `terrainScaled` x1.5 fires with **no grounded gate** on all three members (Expanding Force and
  Misty Explosion should read the USER's feet, Rising Voltage the TARGET's). Measured here: an
  airborne Chimecho's Expanding Force reads 114 where the authority reads 76. The rewrite I landed IS
  gated, so the move now widens correctly and boosts incorrectly on the same board — which is the
  right way round (the boost was already wrong; the target list is now right) but it is a live
  inconsistency and belongs in the next batch.
- **Curse's target rewrite is the second member of the shape and is unmodelled.** 124 carriers.
  `move.target = move.nonGhostTarget` on a non-Ghost user, `'randomNormal'` on an ally-aimed Ghost.
  Not measured, not filed against a register row by this pass.
- **The three roster stages were not re-run** and are now stale against `1c346ff23712`. They were
  already stale (`e129bca605e3`) and already WITHHELD by the gate before this pass began; this makes
  them staler, not newly wrong.
- **`data/engine-diff.json` is not restamped.** The 6,000-comparison run went to
  `data/verification/engine-diff.terrainspread.json` via `--out`, per ROADMAP #257 — the published
  artifact belongs to the gate.
- **The interaction matrix and `all_mechanics_fire.js` were not re-run.** No tag was added or changed
  and `data/tags.json` is untouched.
- **The `tag_dex` enrichment is unfiled work, not landed work.** A `targetClass.rewritesTo` param (or
  `terrainScaled.subject`) would let the engine stop naming `expandingforce`. It is a regeneration and
  was deliberately not attempted.
- **Inherited reds, none of them mine and none worsened**: `side_selection_census` (82 undeclared
  against a floor of 81 — this pass added no side-selecting ternary), `probe_red_demo`,
  `probe_upkeep_lines`, `test-pinch-family`, `run-all --coverage`, and the
  `FEATURE SEMANTICS CHECK FAILED` banner at the top of `status.js`, which is MEASURE's.
- **`tests/test-engine-diff.js` exits 3 without `--out`** and that is the documented ROADMAP #257
  publish guard refusing a 150-row run against a 6,000-row published artifact, not a red engine. Run
  it as `--n 6000 --out data/verification/<name>.json`. My first (default `--n 150`) invocation was
  refused as designed and the guard rewrote `data/verification/engine-diff.n150.json` with that
  150-row run — a tracked file, modified by the guard doing its job. It is not a published figure and
  nothing quotes it; recorded here so its mtime is not a surprise.
- **`tests/test-resolution-order.js` cannot run at this machine's default heap and it is not this
  pass.** Node auto-sized the old-space limit to **2,240 MB** here (13 GB box, ~12 resident Claude
  processes) and the test OOMs at ~2,050 MB while rebuilding its 12,951-team pool cache. The arm run
  under `MEDI_TERRAIN_TARGET_SINGLE=1` — which restores HEAD's engine behaviour exactly — OOMs
  identically, so the failure is not attributable to this fix. With `--max-old-space-size=3400` it
  **PASSES: 26 arms staged, 0 failing**, all four orderings agreeing with the authority and each shown
  red under its own surgical revert.
