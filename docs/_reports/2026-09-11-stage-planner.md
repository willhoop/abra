# Stage planner — a constructed fixture for every mechanic (2026-09-11)

ENGINE · planning instrument · **no game was played.** The only calls into Showdown are `TeamValidator`,
`getMovePool`, the type chart and the Champions mod's `statModify`. New files only:
`engine/stage_planner.js`, `tests/test-stage-planner.js`, and this report.

**Sources.** Every figure below comes from `node engine/stage_planner.js --json <scratch>/plan-final.json`,
run 2026-09-11 against tags `git:2dcdc329eee5:data/tags.json` (read with `git show HEAD:` so the planner
never takes a torn read), Showdown `20ad99f`, format `gen9championsvgc2026regmb`, filter
`x.exists && !x.isNonstandard && x.tier !== 'Illegal'`. The test figures come from
`node tests/test-stage-planner.js` (full population, GREEN, exit 0, 15.1 s). The harness seams are cited
at `git show HEAD:engine/all_mechanics_fire.js`, last touched at `f7ad7718`.

## Verdict

- **841 of 964 mechanics carry a validated fixture.** That is 496/500 moves, 197/316 abilities and
  148/148 items. Excluding the 117 with no legal carrier, **841 of the 847 in scope**.
- **123 are refused, and every refusal carries a machine-readable code:**

  | Code | Count | Which |
  |---|---:|---|
  | `NO-LEGAL-CARRIER` | 117 | 114 abilities, plus Power Shift, Soft-Boiled and Spore. The conferral check ran on every ability. |
  | `NEEDS-ENGINE-CAPABILITY` | 3 | Attract, Cute Charm, Rivalry (gender). A legal fixture exists for each and is attached as `wouldBe`. |
  | `VALIDATOR-REFUSED` | 1 | Battle Bond. The validator's words: *"Greninja (Greninja-Bond) does not exist in Gen 9."* |
  | `NO-LEGAL-READER` | 1 | Gluttony. Its 14 readers are all out of the regulation. |
  | `PLANNER-CANNOT-CONSTRUCT` | 1 | Imposter. Ditto's only move is Transform, so it has no inert click. This is the planner's gap, not a claim about the format. |

- **The two plans' known-hard cases are all constructed**, and each has a clause of its own (K1–K6):
  - Hospitality with a live partner hit before the carrier enters.
  - Prankster where the carrier is slower than the receiver (80 < 98 Speed) and uses Light Screen.
  - All five duration items with the holder clicking its own setter.
  - Lightning Rod and Volt Absorb with a legal Electric receiver.
  - All **75** mega stones evolving on turn 1, and all **14** mega-only abilities staged through their mega.
  - Simple staged by Simple Beam.
- **Of the 67 rows in the never-fired plan, 65 now have a fixture.** The other two are the ones that plan
  already called "not fixture work": Cute Charm (gender) and Gluttony (no legal reader).
- **Of the boards plan's 30 staging-gap abilities, 29 now have a fixture.** The exception is Imposter. The
  plan's 14 mega-only abilities are among the 29.
- **Every invariant is a clause, and every clause was shown red on a deliberately broken planner** before
  it was trusted. There are 13 clauses and 13 red demonstrations, all listed under §4.
- **Scoreboard (Will, 2026-08-23).** This moves the LAB (`all-mechanics-fire`, then the census) once it is
  integrated. The pinned pool should sit still, except where a newly fixtured common row (Prankster,
  Hospitality, Lightning Rod, Unburden, Light Clay) exposes an engine defect that then gets fixed.

## 1. Design

**The order is inverted.** The harness chooses bodies first and then asks whether the mechanic fired. The
planner reads what the mechanic **requires** and then builds a board that supplies exactly that.

1. **Population.** All legal moves, abilities and items come from `Dex.forFormat`, with mega and
   battle-only formes kept. A mega forme reaches the field as *base species + stone + `mega: true`*.
   A move-conferred ability counts as in scope: every legal move, ability and item handler is scanned for
   `setAbility("<literal>")`, and a move source counts only if it has a legal learner. That is how Simple,
   through Simple Beam's 2 learners, gets its fixture.
2. **Triggers, derived.** Derivation starts from `fixture_preflight.moveNeeds` / `boardNeeds` /
   `readByOthers`, which remain the one implementation. On top of those the planner reads eleven handler
   shapes PRE does not:
   - entry acting on something already present (`adjacentAllies` + `heal` / `clearBoosts` / `removeSideCondition`);
   - `isWeather` / `isTerrain`;
   - `hasType` on a partner;
   - `ally.hasAbility`;
   - `onDragOut`;
   - `delete move.flags.contact`;
   - `onDamage` that refuses non-move damage;
   - `onAlly*` item, status and boost guards;
   - priority handlers (which need a slower carrier);
   - `ignoreImmunity[...] = true`;
   - `abilityState.x` writes whose readers live elsewhere.

   Whose status a handler reads is resolved **by parameter position**, because authors name parameters
   freely. `Dex.forFormat` is the Champions mod dex, so the mod is read first. `modOverride` records the
   **81** entities whose handlers or fields differ from mainline.
3. **The fixture** is written in roles, not slots:

   | Role | Meaning |
   |---|---|
   | C | carrier |
   | CA | carrier's partner |
   | R | receiver / adversary |
   | RA | receiver's partner |
   | LP | a lead who hands C its slot when C has to *enter* |
   | pads | fill each sheet to the six bodies the validator demands |

   Rendering maps each role to a side and slot. It re-aims every click from whoever occupies each slot at
   that turn, so a switch-in is aimed at correctly. Every body declares 0 SP under Hardy. Speeds are
   computed with the Champions mod's own `statModify` (`D.data.Scripts.statModify`). Dice are derived
   from the authority, not typed: the gen-9 crit table is read from `sim/battle-actions.ts:1633`
   `[0,24,8,2,1]`, and accuracy uses `Battle#modify` rounding (`sim/battle.ts:2329`). The corner is
   chosen so that the threshold decides the outcome. **8 rows are staged at `top-tie-first`**: Wide Lens,
   Zoom Lens, Compound Eyes, Bright Powder, Tangled Feet, Scope Lens, Super Luck and Merciless. The rest
   are at `bottom-tie-first`.
4. **Masks.** `masksFor` counts the independent reasons a click cannot land:
   - the type chart;
   - an absorbing, blocking, bouncing or redirecting ability (read off the tag params);
   - powder into Grass;
   - Prankster into Dark;
   - a status the target cannot take (the authority's `getImmunity(status, types)` plus the ability's own refusal literal);
   - a shield click;
   - a sub-100 move at the top corner, unless it is sure-hit for that user type.

   **A fixture must count 0.** The carrier's own ability is excepted, and keyed on the ability rather than
   the role, so a control that swaps in an absorbing ability still has it counted.
5. **The control differs in exactly one leaf and is inert for exactly one reason.** The control's move is
   placed in the moveset from the start, so a click swap changes one script slot. A click, meaning its
   move and its aim, counts as one leaf. The choice runs in this order:
   1. Items: the item is removed.
   2. Moves: the format's inert move; else a self move whose own `onTry` fails for a healthy body; else Protect.
   3. Abilities: a legal alternative on the same species that would not act on this board.
   4. Otherwise, a trigger click is swapped for one that supplies none of the needs.
   5. Otherwise `NO-SINGLE-VARIABLE-CONTROL`, and the row is played board-only, as the boards plan's HB-1 specifies.

   Results: **803 fixtures have a one-leaf control** (C.click 498, C.item 148, C.ability 146, R.click 10,
   CA.click 1). **47 are board-only:**
   - 20 where every alternative ability acts on the board;
   - 12 mega formes;
   - 12 single-ability carriers;
   - 2 moves with no inert control click (Recycle, Transform);
   - 1 injected move (Struggle).
6. **Branches and sides.**
   - A tag named for two halves gets a fixture per half, with the halves read from its params. There is
     one such tag, `ignoresScreensAndSubs` (Infiltrator), and it gets 2/2: Reflect raised then a physical
     hit, and Substitute raised then a hit.
   - Handlers whose move needs conflict get one fixture each (Dry Skin's Water and Fire).
   - A veil that covers its own holder gets a `covers-self` branch.
   - An immunity bypass and an adversary effect split (Scrappy).
   - Every fixture is rendered near and far. **131** are also rendered at slot b, both sides, because
     their handlers read adjacency, allies or position. That makes **1,962 rendered variants and 1,359
     distinct teams**, every one validated.
   - The tags hold 594 param-shape branches. **5 are uncovered**, each tied to one of the refusals above.
7. **Plants** say what should make the row read DIFFER:
   - the control itself;
   - a `statePlant` on the observed leaf after the read turn (the harness's own `red()` mechanism), for 772 fixtures;
   - a protocol plant for the 78 whose effect writes no board leaf (70 `protocol-line`, 8 `protocol-order`);
   - an arm flip for the top-corner rows;
   - a candidate `MEDI_*` knob wherever one sits within 25 lines of a lookup of the entity's tag (544
     fixtures). These are found by proximity, so each is labelled a candidate.
8. **Honest refusal and loud fallbacks.**
   - A mechanic is refused as a format claim (`formatClaim: true`) only when every bearer failed for a
     format reason.
   - Any planner reason makes it `PLANNER-CANNOT-CONSTRUCT`.
   - A crash becomes `PLANNER-ERROR`, and the test fails on it.
   - **12 fixtures carry an `ASSUMED` line.** These are real-pool thresholds and lethal hits, because the
     planner runs no damage calculator: Berserk, Blaze, Overgrow, Ripen, Sturdy, Swarm, Torrent, Focus
     Band, Focus Sash, Oran Berry, Sitrus Berry and Struggle.

## 2. What this changes against the harness defaults (each derived, not chosen)

| Harness default | Planner |
|---|---|
| receiver always Feraligatr | 15 distinct receivers. 49 of 850 fixtures need one other than Feraligatr, which is still tried first so that rows working today keep their body. |
| partner always clicks Protect | 55 fixtures have a live partner that is never shielded on a turn it is aimed at. |
| accuracy and crit pinned | 8 rows at the corner where the modified threshold decides. |
| nobody clicks the setter | all 5 duration items: the holder clicks the setter on T1, and the game runs past the short clock. |
| ability rows get no board state | status, freeze by secondary, berries, HP thresholds, entry after setup, Intimidate adversaries. |
| every body genderless | the 3 gender rows get fixtures with declared genders, held back until the driver seam exists. |
| megas dropped, stones excused | 75 stones and 14 mega-only abilities. |

## 3. Findings about other files — reported, not fixed (the brief forbids edits)

1. **`engine/fixture_preflight.js` cannot see optional chaining.** Prankster's guard is
   `move?.category === "Status"`, and PRE's regex needs `move.category`, so **Prankster never got a
   Status-move need.** That matches the never-fired plan's cause, *"actor never clicks a Status move"*.
   The same blind spot hits Gale Wings, Pickpocket and Triage. The planner normalises `?.` before calling
   PRE and prints what that added: 4 entities.
2. **PRE reads an assignment as a requirement.** Parental Bond, Battle Bond and Skill Link write
   `move.multihit = …`, and Stench and King's Rock write `move.secondaries`. PRE also reads handlers gated
   on a move id that is not in the regulation (Anticipation gated on Hidden Power, Parental Bond on Secret
   Power, Sheer Force on the Z-version of Clangorous Soul). Eight needs were dropped, and each is printed.
3. **PRE's `statusesRead` does not say whose status.** Merciless reads the *target's*, and the first draft
   of this planner poisoned the Poison-type holder on the strength of it. PRE's `boardNeeds` also reads a
   mega stone's `onTakeItem` refusal as "item consumed", and it misses contact tested through
   `checkMoveMakesContact`, which is how Cute Charm and Rough Skin test it.
4. **The gender block is in the DRIVER, not in medicham2.** The never-fired plan said *"medicham2 has no
   gender"*. medicham2 has `genderOf` (`engine/medicham2-browser.js:20857`, read by Rivalry, Attract and
   Cute Charm). The pin is `engine/game_differential.js:3412`, which writes `gender: 'N'` on every body.
5. **`sim/battle-actions.ts` holds three crit tables.** The first one, `:1627`, is gen ≤ 5. Gen 9's is
   `:1633`. The first draft of this planner read the wrong table.
6. **`engine/legal_scope.js`**, untracked and MEASURE's, derives the same scope and conferral facts. Under
   FACTS ARE GLOBAL, one of the two should import the other once it is committed. I did not depend on an
   untracked file.

## 4. The test — `tests/test-stage-planner.js`

**No game is played.** A fresh `TeamValidator` re-validates every emitted team, and every other clause is
recomputed from the rendered teams and scripts, not from the planner's own verdict fields.

| Clause | Asserts | Shown red by |
|---|---|---|
| validate | every team, fixture and control, on every side and slot, including the would-be fixtures | `illegal-team` (40 Speed SP, validator skipped): 8 failures |
| oneLeaf | control = fixture ± 1 leaf | `control-two-vars` (nature also changed): 4 |
| oneReason | fixture has 0 unmet conditions and 0 masks; control fails exactly 1 | `control-two-reasons`: 10 |
| coverage | every legal entity, derived by the test itself, has a fixture or a known code; no crash; NO-LEGAL-CARRIER records the conferral check | `omit-mechanic`: 1 |
| halves | a fixture per named half | `one-half`: 1 |
| sides | near and far; slot b for Ally/Foe/Any handlers | `no-mirror`: 1 |
| arm | a driver-defined arm; threshold rows at top | a planted wrong arm: 1 |
| K1 Hospitality | live partner, never shielded, hit before the carrier enters | `protect-ally`: 2 |
| K2 Prankster | Status click, carrier slower (the test's own `statModify` call) | `prankster-fast` (window inverted): 1 |
| K3 duration items | the holder clicks its extended setter on T1, and the game outlasts the short clock | `no-setter`: 4 |
| K4 receiver | a legal Electric receiver that is not Feraligatr | `feraligatr-only`: 2 |
| K5 megas | every stone evolves its own base on T1; every mega-only ability staged through its mega | `no-mega`: 3 |
| K6 Simple | Simple Beam aimed at the subject | `no-conferral`: 1 |

**Every red demonstration also runs the same subset unbroken, and that run must pass.**

## 5. Integration plan for `engine/all_mechanics_fire.js`

Run this **after the live harness batches land.** HEAD already carries `megaE` carrier handling at
`:2474`, so re-read every seam before editing. Line numbers are HEAD `f7ad7718`.

| # | Seam | Change |
|---|---|---|
| 1 | `:337` `LEGAL_SPECIES`, `:364` `AB_CARRIERS` | Stop deciding scope here. Take the row set, the bearer (including `via: 'mega'`) and refusals from `SP.plan().mechanics`. |
| 2 | `:484` `bodyOf`, `:521` `sheetOf`, `:1275` `stageBodies` | When a plan row has a fixture, build both sheets straight from `variant.teams`. They are already six bodies and validated. |
| 3 | `:1294` `playScenario`, `:1383` `arm: ARM` | Pass `spec.script = variant.script`, `arm: GD.ARM_BY_ID.get(fixture.arm)`, and `hpBoost = fixture.hpPool === 'x1' ? 1 : HP_BOOST` (`:469`). |
| 4 | `:2291` `abLadder` / `:2452` `runAbilities` / `:3535` `runItems` / the move arm | Play `variant.control` under the same arm. FIRED requires the fixture to part at `fixture.readAfter` on `fixture.observe` while the control does not. Rows with `controlRefusal` take HB-1's `FIRED-UNCONTROLLED` path, with proof read off the authority log. |
| 5 | `:2276` `KNOWN_STAGE_VERBS`, `:2094` `gauntletScript`, `:3280` `statePlanScript`, `:2037` `pickForNeed` | Not used for planned rows. The planner's turns are explicit, which ends the four silent verbs the never-fired plan found (finding 4). |
| 6 | `:2678` `allyIsLive: false` | Read it from `fixture.live`. |
| 7 | `:4141` stone exemption | Remove it. The 75 stone fixtures expect `scriptMegaRefused = 1` in the control arm only. |
| 8 | `:3750` `red()` | Iterate `fixture.plants`: `statePlant` via the existing mechanism, an arm flip, and each candidate knob in a child process under its `MEDI_*` switch. |
| 9 | `engine/game_differential.js:3392` `spreadFor(picked.length, sp)` | **Blocking for 13 speed-window fixtures** (Prankster, Gale Wings, Quick Draw, Quick Feet, Unburden, Choice Scarf, Iron Ball, Quick Claw, Swift Swim, Slush Rush, Sand Rush, Chlorophyll, Surge Surfer). Add an opt-in `declaredSpread` that honours the sheet's `evs` and `nature`, so every other caller stays byte-identical. |
| 10 | `engine/game_differential.js:3412` `gender: 'N'` | Add an opt-in declared gender for both engines. medicham2's `genderOf` already reads it. This unblocks Attract, Cute Charm and Rivalry. |
| 11 | artifact stamp | Record the planner's `meta` (tags source and digest, validator counts, crit citation) in `all-mechanics-fire.json`. |
| 12 | `engine/coverage.js` (MEASURE) | The denominator becomes `in-scope = exist − NO-LEGAL-CARRIER − NO-LEGAL-READER` (847 today). Route this to MEASURE. |

Seams 9 and 10 are outside the harness. They belong to whoever holds `engine/game_differential.js`.
Neither touches `board.js`, `magnemite.js` or `engine-data.js`, so no refit is implied.

## OWED, NOT RUN

```bash
# 0. Re-plan and re-test after the live ENGINE agent commits (the tags source and the harness move under it).
cd C:/Users/willj/Projects/Pokemon/ABRA
cmd.exe //c "tools\\lownode.cmd engine\\stage_planner.js --show-derivations"
cmd.exe //c "tools\\lownode.cmd tests\\test-stage-planner.js"
```

```bash
# 1. Register the test with the gate runner (an EXISTING file, so not edited here), then run the gates.
#    Add tests/test-stage-planner.js to tests/run-all.js; also give it a docs/ENGINE.md instrument row.
node tests/run-all.js
```

```bash
# 2. Integrate (section 5), one seam per batch, each shown RED first by its planner break mode, then:
node engine/engine_release.js cut "stage planner integration"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/all_mechanics_fire.js --kind abilities --only hospitality,prankster,lightningrod --dumplog --release <id> --out <scratch>/amf-plan.json
# the 12 ASSUMED rows: confirm the threshold or lethal hit off the authority log before counting them
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/all_mechanics_fire.js --kind abilities --only blaze,overgrow,swarm,torrent,berserk,sturdy,ripen --dumplog --release <id> --out <scratch>/amf-assumed.json
```

```bash
# 3. After a --write run lands: the census, then status, in that order.
node tests/test-mechanics.js
node engine/coverage.js
node engine/status.js
```
