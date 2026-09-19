# Force-fire A: forced games for the 21 DID-NOT-FIRE ability rows

ENGINE, 2026-09-19. Isolated worktree `agent-a6c1ac2a0a52bd987`. Light mode: the 21 rows, and 22 collateral rows as
a regression check. No full battery, no lattice and no quarantine run. **Release `4c9b0cc4a4da`** was re-cut in the
worktree; the tree was identical, so the id did not change. No engine byte changed. Census **955 live / 0 missing**,
unmoved. `test-mechanics.js` was not re-run, because `medicham2-browser.js` is untouched.

Will, 2026-09-19: *"why cant we stage games that force the ability to fire what the hell man"*.

> **UPDATED — Part 2 (at the end) supersedes the Part 1 verdict below.** After it: **21 of 21 FIRED, no board
> parting**, on release `47f37f5a30b5`. Ripen, Anticipation and Screen Cleaner are fixed in the engine. Census
> 955 → 960.

## Verdict

- **Before:** 0 of 21 FIRED. Every row read DID-NOT-FIRE, "the gauntlet never reached its trigger".
- **After:** **20 of 21 FIRED with a one-leaf A/B control and a compared board.**
- **Still not fired: Anticipation.** The forced fixture makes the authority announce it. medicham2 does not, so the
  row reads SHOWDOWN-ONLY. This is a narration gap that is already declared (see "Findings" below).
- **Fixed where:** in the CHOOSER, `engine/stage_planner.js`. No row is special-cased. The one instrument fix is in
  `engine/all_mechanics_fire.js`.
- **One board parts: Ripen.** This is a real engine defect. It was not fixed, because the fix is not small. See
  "Findings".

## How the battery chooses a fixture, and what was wrong

`runAbilities` → `runPlanned` asks `engine/stage_planner.js` first. A planner row counts only if it is FIRED (or
proven board-only). Anything else falls back to the legacy four-move gauntlet, which is where every one of the 21
ended up. The planner derives a trigger list from each handler (`triggersOf`), then builds a receiver, a partner
and a script from that list (`stageEntity`/`composeEntity`). For all 21, either the trigger list came out empty or
wrong, or the staging built the wrong condition.

**Before the change, the planner printed these fixtures.** Each one is useless for its row:

- Technician: Seed Bomb (80 BP).
- Guts, Marvel Scale and Poison Heal: nobody was statused.
- Swift Swim: no rain.
- Stall: the receiver was faster.
- Steadfast: the flinch came from a SLOWER Bite.
- Aroma Veil: Attract into a genderless partner.
- Healer: the partner was frozen, and it thawed on its own click at the bottom corner.
- Screen Cleaner: Aurora Veil on a clear sky, so it failed.
- Light Metal: Psycho Cut.
- Magician: the target held no item.
- Ripen: the heal-threshold berry fainted the control holder a turn early (script miss).

## What each new derivation matched (printed BEFORE wiring, over the whole format)

`triggersOf`, compared against the pre-change `--json` plan. There are 23 trigger changes, and each is listed here:

| shape (read off the handler / field) | matched |
|---|---|
| bare truth test `if (pokemon.status)` -> `holder-statused: any-acting` | guts, marvelscale, quickfeet |
| `effect.id === "<status>"` in the holder's onDamage | poisonheal (psn/tox), heatproof (brn: correct, Heatproof halves burn chip) |
| `onAfterSetStatus` that hands the status back to `source` | synchronize (brn/par/psn/tox; slp/frz read off its early returns). The first print also caught lumberry, so the shape was narrowed to the reflect-to-source form. Lum is unchanged. |
| a status condition's own `onBeforeMove` reads the ability (`enclosingCondition`) | earlybird (`slp`, data/conditions.ts:68) |
| `[...].includes(x.effectiveWeather())` | swiftswim, chlorophyll, flowergift, hydration, leafguard, orichalcumpulse, solarpower (all correct weather readers) |
| `basePowerAfterMultiplier <= N` | technician |
| unprefixed `onModifyWeight` | lightmetal, heavymetal |
| `onAfterMoveSecondarySelf` + `takeItem(` | magician |
| `lastItem` + `isBerry` on an empty hand | harvest |
| another body's `usedItemThisTurn` + `lastItem` | pickup |
| entry handler walking `foes().moveSlots` through `getEffectiveness` | anticipation |
| accuracy handler returning `true` (Any/Source/self), PRE gave no accuracy-roll | noguard |
| numeric `onFractionalPriority` (a field, not a handler) | stall (-0.1) |

**Staging changes** (all derived, none keyed on a name):

- **`ACTING_STATUSES`**: a status whose condition has no `onBeforeMove`. **`STABLE_STATUSES`**: a status whose
  condition never calls `cureStatus`. Both are read off `Dex.forFormat(...).conditions`, so the Champions `par`,
  `slp` and `frz` overrides are the ones used.
- **The resist-berry consumption fixture is now built.** Before, it refused with "not built by this planner yet".
  The berry is eaten on the first hit of its type from full HP, so the fixture does not assume any damage number.
  The berry comes from the tag param `resistBerry`.
- **Ripen's `onSourceModifyDamage` is now recognised.** It splits to prefix `Source` and base `modifydamage`, so
  the bare-name test missed it.
- **Weight:** the move is chosen only if its own `basePowerCallback` returns a different power at the holder's
  weight and at the weight after the handler. Both come from calling the handler.
- **Veil trigger:** a volatile whose condition reads `.gender` is excluded.
- **Screens:** a screen tagged `failsWithoutWeather` is excluded.
- **Generic exchange:** it hits with the category that the holder's `onModifyAtk`/`SpA`/`Def`/`SpD` reads.
- **Flinch:** it must come first, by priority or by `statModify` Speed. The legacy arm has refused a slower flincher
  since 2026-08-12.
- **Stall:** the receiver must be strictly slower.
- **Magician:** R holds the quietest removable item.
- **Anticipation:** R carries, but does not click, a move that is super-effective on the holder.
- **Controls:** a bearer with a one-leaf control now beats the first bearer that stages. A cosmetic forme (the same
  types, stats and abilities) is no longer a second bearer. `stateNoise` does not count a cure-only handler on a
  board that inflicts no status.

**Instrument fix (`all_mechanics_fire.js` `abBoardMoved`).** Curious Medicine cleared its partner's +2 in both
engines, and the cross-engine board agreed. The row still read DID-NOT-FIRE. The reason: `sdStream` keeps only the
events that medicham2 claims, and `-clearboost` is not one of them, while medicham2 writes no line at all. For an
**ability swap only**, each engine's ON board is now compared with its own OFF board through
`board_state.compare`, boundary by boundary, with every `.ability` leaf masked (that leaf is the control variable).
Two things are recorded: `moved_by` on the row, and `summary.ab_board` with the rows that only a board moved. In
this run that is Curious Medicine alone, in 4 variants, in both engines.

## The 21 rows (final run, `final.json`, 21 rows / scratch `--out`)

Every FIRED row below was read line by line (`--dumplog`, the first ON/OFF difference per engine). The difference
is the ability's own mechanism, not the control's.

| row | carrier vs control | forced trigger | mechanism seen (both engines unless noted) | board |
|---|---|---|---|---|
| anticipation | Hatterene vs Healer | R carries Shadow Claw (SE) | SD `-ability\|Hatterene\|Anticipation`; **ME silent** | SHOWDOWN-ONLY → legacy DID-NOT-FIRE |
| aromaveil | Aromatisse vs Healer | R Taunt → partner | `-block … ability: Aroma Veil` | NO-DIVERGENCE |
| curiousmedicine | Slowking-Galar vs Regenerator | partner Swords Dance, C enters | partner's +2 cleared (board-only in both engines) | NO-DIVERGENCE |
| earlybird | Houndoom vs Unnerve | R Sing → C | T2: ON `-curestatus slp` and Facade; OFF `cant slp` | NO-DIVERGENCE |
| guts | Heracross vs Moxie | R Flamethrower burns C | C's High Horsepower: 146 vs 48 damage | NO-DIVERGENCE |
| harvest | Trevenant vs Frisk | Colbur Berry eaten off Lash Out, sun | `-item Colbur Berry [from] ability: Harvest` | NO-DIVERGENCE |
| healer | Aromatisse vs Aroma Veil | R Body Slam paralyses partner | `-activate … ability: Healer`, cure | NO-DIVERGENCE |
| lightmetal | Metagross vs Clear Body | R Heavy Slam (Mudsdale) | damage 22 vs 11 | NO-DIVERGENCE |
| magician | Delphox vs Blaze | R holds Damp Rock | `-item Damp Rock [from] ability: Magician` | NO-DIVERGENCE |
| marvelscale | Milotic vs Competitive | burned, R X-Scissor (physical) | damage taken 126 vs 149 | NO-DIVERGENCE |
| noguard | Golurk vs Klutz | top corner, High Horsepower (95) | ON hits, OFF `[miss]` | NO-DIVERGENCE |
| pickup | Dedenne vs Cheek Pouch | C's Seed Bomb makes R eat Rindo | `-item Rindo Berry [from] ability: Pickup` | NO-DIVERGENCE |
| poisonheal | Gliscor vs Hyper Cutter | R Poison Jab | `-heal [from] ability: Poison Heal` vs psn chip | NO-DIVERGENCE |
| quickfeet | Jolteon vs Volt Absorb | burned; Dragapult in the x1.5 window | turn order flips | NO-DIVERGENCE |
| ripen | Appletun vs Gluttony | Haban Berry eaten off Dragon Claw | `-activate … Ripen`; **HP parts** | **STATE** |
| screencleaner | Mr. Rime vs Ice Body | R Reflect, C enters | Reflect removed; **line order differs** | ANNOUNCEMENT-ONLY |
| stall | Sableye vs Keen Eye | R slower (Appletun) | turn order flips | NO-DIVERGENCE |
| steadfast | Gallade vs Sharpness | faster R Bite (Aerodactyl) | `+1 spe` from Steadfast | NO-DIVERGENCE |
| swiftswim | Basculegion vs Mold Breaker | partner Rain Dance; Aerodactyl in the x2 window | turn order flips | NO-DIVERGENCE |
| synchronize | Alakazam vs Magic Guard | R Body Slam paralyses C | `-activate … Synchronize`, R paralysed | NO-DIVERGENCE |
| technician | Maushold vs Cheek Pouch | Bullet Seed (<= 60 BP) | damage 34 vs 24 | NO-DIVERGENCE |

**Controls.** `control_not_quiet` marks 3 rows:

- Aroma Veil (control Healer) and Healer (control Aroma Veil) use each other as controls. The dumps show the other
  one inert on each board: no status is staged in the Aroma Veil game, and no volatile move in the Healer game.
- Anticipation (control Healer) is inert for the same reason.

The flag is the file's coarse derived test, and the line-level read settles it.

## Findings

1. **RIPEN'S SECOND RESIST-BERRY HALVE IS MISSING. This is a board defect.**
   - The authority: `data/abilities.ts:3859-3864` has `onEatItem`, which sets `abilityState.berryWeaken`.
     `:3848-3853` has `onSourceModifyDamagePriority -1`, which spends it for a second `chainModify(0.5)`.
   - The Champions mod carries no `ripen` key.
   - Measured, x6 pool: Haban Berry Appletun takes **29 in the authority and 58 in medicham2** (1081 vs 1052 of
     1110).
   - medicham2's own resist-berry site says "RIPEN'S SECOND HALVE IS STILL OWED … filed, not smuggled in". **No
     open ROADMAP row exists.** ROADMAP #128 is closed, so the defect is unregistered.
   - **Not fixed.** The fix needs a tag param (Ripen's `damageReduce` carries `onlyWhen: null`, and the engine
     correctly refuses to default it on), which means a `tag_dex.js` regeneration. That is not "small".
   - After the next full battery, this row enters the mechanics clause as a diverged ability row, subject to its
     usage shelf. Ripen shows 3 uses.
2. **Screen Cleaner narration order.**
   - The authority writes `-activate … ability: Screen Cleaner` before the first `-sideend`
     (`data/abilities.ts:4096`). medicham2 writes it after the sweep.
   - The boards agree (ANNOUNCEMENT-ONLY). The row now reads `diverged: true`.
3. **Anticipation announcement.** medicham2 refuses it out loud (`MEDFAILS.entryAnnounceUnmodelled`). The authority
   writes it at `data/abilities.ts:185`. This is unchanged and known. The fixture now reaches it.

## Collateral, run against the published artifact of the same release

Outside the 21, 24 mechanics got a new planner fixture. Two of them, flowergift and orichalcumpulse, are out of
scope and produce no row, so 22 rows were run.

- No row regressed.
- Eight rows moved from FIRED-UNCONTROLLED to FIRED with a control: angerpoint, cudchew, drought, sandspit,
  sandstream, sweetveil, waterabsorb, weakarmor.
- Seven rows moved from legacy-fallback to the planner and are still FIRED: blaze, chlorophyll, heavymetal,
  hugepower, rivalry, sniper, solarpower.
- The rest (gooey, heatproof, hydration, leafguard, minus, moxie, sheerforce) keep the stage and verdict they had.
- The planner as a whole: board-only fixtures **48 → 31**, A/B fixtures **805 → 822**, refusals unchanged
  (NO-LEGAL-CARRIER 117, VALIDATOR-REFUSED 1, NO-LEGAL-READER 1, PLANNER-CANNOT-CONSTRUCT 1).

## Red demonstrations

- **The pre-change baseline** (`baseline.json`, same release, same 21 rows): 0 of 21 FIRED.
- **`--ab-lines-only`** (new flag, announced loudly): Curious Medicine reads **DID-NOT-FIRE**, against FIRED without
  it. The run also prints "THE A/B BOARD COMPARED NOTHING". The knob moves the outcome.
- **The self-swap plant** now runs with `abilitySwap: true`. It is still CAUGHT as DID-NOT-FIRE, so the board half
  cannot manufacture a FIRED out of two identical games.
- **`tests/test-stage-planner.js`: GREEN.** 14 clauses and 14 red demonstrations, full population, 108 s.

## Files changed (worktree)

- `engine/stage_planner.js`: the chooser.
- `engine/all_mechanics_fire.js`: `abBoardMoved`, `abRow(..., opts)`, `AB_BOARD`, `--ab-lines-only`, and the self-swap
  plant.
- `docs/ENGINE.md`: section and hand list.
- `data/engine-release.json` and `data/releases/4c9b0cc4a4da/{cuts.jsonl,release.json}`: touched by the cut and
  **restored** afterwards.
- No `--only` flag was added (it already existed). A full run is changed on purpose: the chooser and the A/B board
  half both apply to every ability row.

## Part 1 notes row (SUPERSEDED by the row at the end of Part 2)

| 2026-09-19 | **FORCE-FIRE A — 20 OF THE 21 DID-NOT-FIRE ABILITY ROWS NOW FIRE WITH A ONE-LEAF CONTROL.** The chooser (`engine/stage_planner.js`) reads 13 more trigger shapes off the handlers (weight, stolen item, eaten berry, picked-up item, a foe's super-effective move, an always-hit accuracy handler, a numeric fractional priority, the list-first weather test, the `basePowerAfterMultiplier` ceiling, and four status shapes). It builds the resist-berry fixture, prefers a bearer that has a control, and drops cosmetic formes from the bearer window. The ability A/B in `engine/all_mechanics_fire.js` also compares each engine's own ON/OFF boards (`abBoardMoved`; `--ab-lines-only` is the red), which is what shows Curious Medicine. Run alone on release `4c9b0cc4a4da`: **0 → 20 of 21 FIRED**. Anticipation reads SHOWDOWN-ONLY (declared `entryAnnounceUnmodelled`). 22 collateral rows were re-run and none regressed; 8 rose from FIRED-UNCONTROLLED to FIRED. **A board defect was found and is not fixed: Ripen's second resist-berry halve** (`data/abilities.ts:3848-3864`; 29 vs 58 HP), which has no register row. Narration: Screen Cleaner's `-activate` comes after its `-sideend`. No engine byte changed; census 955 live, unmoved. Artifact: none published. The scratch run is in `docs/_reports/2026-09-19-force-fire-a.md`. **Supersedes.** Nothing published; the full battery is owed before `data/all-mechanics-fire.json` moves. **Basis.** unchanged — the A/B still asks "does removing the ability change the game in both engines", and now sees a change that only a board shows. **Owes.** `docs/ABRA-technical-docs.md` (the battery's fixture chooser and the A/B definition). |

## Part 1 owed list (superseded by the one at the end)

- **The full battery on this code.** It republishes `data/all-mechanics-fire.json` and moves every ability row
  through the new chooser and the A/B board half:

  `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown tools\lownode.cmd engine\all_mechanics_fire.js --release <id> --kind all --team-store data/team-pool-frozen --write`

- **Then** `node engine/quarantine.js`. Ripen (STATE) and Screen Cleaner (protocol) will enter the mechanics clause
  as diverged ability rows, subject to its usage shelf.
- **A ROADMAP row for Ripen's second halve**, and its fix: a `tag_dex.js` param for `berryWeaken`, the second
  `MODMUL` at the priority -1 stage, a `MEDI_*` knob, and a probe that is red under the knob.

---

# Part 2: the three engine gaps closed (the coordinator's follow-up, same day, one at a time)

**Release `47f37f5a30b5`** was cut in the worktree after the three fixes (27 files frozen). `data/engine-release.json`
was restored afterwards. Census: **955 → 960 live / 0 missing / 0 hollow, `run_ok: true`**. The direct-call ratchet
is unchanged at 1: the new probes spend real turns through `ripenHit(`, which was registered in `REALTURN`.

## The 21 rows again (`final2.json`, release `47f37f5a30b5`, `--kind abilities --only <the 21>`)

**21 of 21 FIRED with a one-leaf control.** Every board is `NO-DIVERGENCE` and no row diverged, on any variant. The
three rows that had not agreed on `4c9b0cc4a4da`:

| row | before | now |
|---|---|---|
| anticipation | SHOWDOWN-ONLY → legacy DID-NOT-FIRE | FIRED, planner, NO-DIVERGENCE |
| ripen | FIRED, board **STATE** (1081 vs 1052 of 1110) | FIRED, NO-DIVERGENCE |
| screencleaner | FIRED, ANNOUNCEMENT-ONLY, diverged (`-activate` after `-sideend`) | FIRED, NO-DIVERGENCE |

The other 18 rows read as in Part 1: FIRED, NO-DIVERGENCE.

## 1. Ripen: the second halve, and its class

**Authority:** `data/abilities.ts:3832-3866`, with no Champions `ripen` key.

- `onEatItem` (`:3859-3864`) *assigns* `berryWeaken = weakenBerries.includes(item.name)`.
- `onSourceModifyDamage`, priority -1 (`:3848-3854`), spends the flag for `chainModify(0.5)`. Priority -1 means it
  runs after the berry's own handler in the same relay.

**Derived tag param.** `doublesBerryEffect.resistWeaken = { mult: 0.5, berries: [18 ids], flag: 'berryWeaken',
priority: -1 }`. `engine/tag_dex.js` reads it off the two handlers: the flag must be written by the eat and read by
the damage handler, and the list is the handler's own array literal. Membership printed: ripen alone.

**Engine.**

- `runEatItemEvent` assigns `_berryWeaken`. It is an assignment, so a berry off the list disarms it.
- `dmgRangeOneHit` multiplies once when the flag is stored, or when the listed resist berry this hit eats is present.
- The battle loop spends the flag (`ripenWeakenPriced`). It clears it again after the fresh eat, which is the
  authority's clear inside the same relay.

**Class, every road Ripen touches, each derived:**

- **Resist-berry eat.** Fixed; census row.
- **A resist berry flung at the Ripen body.** Fling's own hit is priced before its eat, so the flag arms for the NEXT
  hit. Fixed by the same arming; census row. The Fling arm reads 112 → 56, and 112 with no fling.
- **Leftovers under Ripen** (`:3833-3837`). `onTryHeal` writes `-activate|ability: Ripen` for Leftovers and Berry
  Juice. TryHeal is raised before `Battle#heal`'s full-HP return (`sim/battle.ts:2268` against `:2272`), so it
  announces at full HP too. medicham2 was silent. Fixed through a second derived param,
  `doublesBerryEffect.announcesHealFrom`; census row, with arms at full HP and at half HP.
- **Heal doubling** (Sitrus and Oran) and **Leppa's PP doubling** (`data/items.ts:3366`): already live,
  `berryEffectMult`.
- **Not a road in this format:**
  - `onChangeBoost`: no legal berry boosts; every legal berry's `onEat` is a heal, a cure, PP, or empty.
  - Jaboca and Rowap (`data/items.ts:3095`, `:5391`): not legal.
  - Stuff Cheeks, Bug Bite and Pluck: neither Appletun nor Flapple learns them.
- **Not checked:**
  - Leftovers plus Ripen under Heal Block. The engine is silent; the order of the two authority `onTryHeal` handlers
    was not read.
  - A multi-hit move into a Ripen resist berry. The engine prices the berry across the whole volley; that
    simplification predates this pass.

**Knob:** `MEDI_RIPEN_NO_RESIST_WEAKEN=1`. Under it:

- The three census rows go MISSING. The resist arm reads 56 against 56, where 28 is correct.
- The staged-game row returns to board **STATE** (1081 vs 1052) and diverges on `-damage`.

## 2. Anticipation: the announcement

**Authority:** `data/abilities.ts:174-190`.

- It walks the live foes' `moveSlots` and skips Status moves.
- On the first move for which `getImmunity(type) && getEffectiveness(type) > 0`, or which is `move.ohko`, it writes
  `this.add('-ability', pokemon, 'Anticipation')` and returns.
- **No die**: there is no `random` and no `sample`. This is unlike Forewarn (6.59.0), whose `this.sample` draws at the
  lead-in address, so there is no address to match here.

**Tag.** `announcesOnEntry.shudders = { skipsCategory: 'Status', superEffective: true, immunityGates: true, ohko: true,
firstOnly: true }`, derived. Membership: anticipation alone.

**Engine: `anticipationAnnounce`.**

- The type test is `mcEff(type, holder.types) > 1`. That is the chart product, and it equals the authority's
  immunity-plus-log-sum test: an immune type gives 0, and SE into resist gives 1.
- The category is read from the tag `statusCategory`; the OHKO from the tag `ohko`.

**Census row:**

- Controls, with 0 lines each: no ability; a neutral move plus Dragon into Fairy (immune).
- Tests, with 1 line each: Shadow Claw (SE); Sheer Cold (OHKO). All bodies and moves are legal and in the learnsets.

**Knob:** `MEDI_ANTICIPATION_SILENT=1`. Under it the census row goes MISSING, and the staged-game row returns to
DID-NOT-FIRE.

**Will's ruling on the roster is unchanged.** `tests/roster.js` still has DEFERRED-BY-OWNER, and that file was not
touched.

## 3. Screen Cleaner: the order

**Authority:** `data/abilities.ts:4094-4099`. The `activated` latch writes `-activate` inside the loop, above the first
`side.removeSideCondition`. The engine now writes it before the first removal, once, and only when a screen falls.

- **Board:** unchanged.
- **Census row:** `[-activate index, first -sideend index, count]`. Without the ability it reads `[-1,-1,0]`; with
  Screen Cleaner it reads `[2,3,1]`.
- **Knob:** `MEDI_SCREENCLEAN_ACTIVATE_LAST=1`. Under it the census row goes MISSING, and the staged-game row
  diverges again on `ordering`.

## Checks run

- `tests/test-mechanics.js`: clean run 960 live, and each knob moves only its own rows.
- `tests/test-tag-params-derived.js`: PASS.
- `tests/test-tag-consumed.js`: 7 of 7. It rewrote `data/tag-consumption.json` with unrelated churn, because HEAD's
  copy was stale, so that file was reverted.
- `tests/test-tag-signature.js`: 5 of 5.
- `tests/test-tag-wire.js`: 104 checks.
- `tests/test-engine-release.js`: 80 of 80.
- `tests/test-stage-planner.js`: GREEN in Part 1. The planner did not change in Part 2.

## Files changed in Part 2

- `engine/medicham2-browser.js`: 3 knobs, 4 counters, `runEatItemEvent` arming, the second halve in
  `dmgRangeOneHit`, `ripenWeakenPriced` and the loop spend, the Leftovers announcement, `anticipationAnnounce`, and
  the Screen Cleaner order.
- `engine/tag_dex.js`: `resistWeaken`, `announcesHealFrom`, `shudders`.
- `data/tags.json`: the ripen and anticipation rows only.
- `data/abra-tags.js`: rebuilt.
- `tests/test-mechanics.js`: 5 rows, plus `ripenHit` in `REALTURN`.
- `data/mechanics-census.json`: regenerated.
- `docs/ENGINE.md`.

## PROPOSED NOTES ROW

| 2026-09-19 | **FORCE-FIRE A — ALL 21 DID-NOT-FIRE ABILITY ROWS NOW FIRE WITH A ONE-LEAF CONTROL AND NO BOARD PARTING, AND THE THREE ENGINE GAPS THE FORCED GAMES EXPOSED ARE CLOSED.** The chooser (`engine/stage_planner.js`) reads 13 more trigger shapes off the handlers. It builds the resist-berry fixture, prefers a bearer that has a control, and drops cosmetic formes from the bearer window. The ability A/B (`engine/all_mechanics_fire.js`) also compares each engine's own ON/OFF boards (`abBoardMoved`; `--ab-lines-only` is the red). Engine: **Ripen's second resist-berry halve** (`data/abilities.ts:3848-3864`; a board fix, 58 → 29 HP, matching the authority; armed on every eat road, including a flung berry) and its Leftovers `-activate` (`:3833-3837`), with knob `MEDI_RIPEN_NO_RESIST_WEAKEN`; **Anticipation's `-ability`** (`:174-190`, no die), with knob `MEDI_ANTICIPATION_SILENT`; **Screen Cleaner's `-activate` before its `-sideend`** (`:4094-4099`), with knob `MEDI_SCREENCLEAN_ACTIVATE_LAST`. The new tag params `doublesBerryEffect.resistWeaken` and `.announcesHealFrom`, and `announcesOnEntry.shudders`, are derived in `engine/tag_dex.js`. Census **955 → 960 live / 0 missing** (`data/mechanics-census.json`), and each knob turns its own rows MISSING. The 21 rows, run alone on worktree release `47f37f5a30b5`: **0 → 21 FIRED, 21 NO-DIVERGENCE**. 22 collateral rows were re-run on `4c9b0cc4a4da` and none regressed; 8 rose from FIRED-UNCONTROLLED to FIRED. Nothing published: the full battery and the lattices are owed. **Supersedes.** Nothing published. **Basis.** unchanged — the A/B still asks "does removing the ability change the game in both engines", and the engine now answers it the authority's way on three more mechanics. **Owes.** `docs/ABRA-technical-docs.md` (the fixture chooser and the A/B definition). |

## OWED, NOT RUN

- **The full battery on this code**, on a release cut in the main tree:

  `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown tools\lownode.cmd engine\all_mechanics_fire.js --release <id> --kind all --team-store data/team-pool-frozen --write`

- **The three lattices and `node engine/quarantine.js`.** Engine bytes changed. The Ripen fix is board-material but
  sits at the obscure tail (Ripen: 3 uses). Screen Cleaner and Anticipation are narration. Expect the lab to move and
  the pinned pool to sit still.
- **The deliberate roster abilities stage.** The Ripen, Anticipation and Screen Cleaner roster rows should be
  re-read on the new release.
- **The 22 collateral rows on `47f37f5a30b5`.** They were run on `4c9b0cc4a4da` (chooser only). Part 2 changed only
  Ripen, Anticipation, Screen Cleaner and the Leftovers path under Ripen, none of which those rows carry.
