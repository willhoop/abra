# Scope unified: one implementation of "which mechanics exist in Reg M-B"

2026-09-11, MEASURE. No games played. Nothing committed.

## Verdict

- **`engine/legal_scope.js` owns scope.** `engine/stage_planner.js` and `engine/coverage.js` import it.
  `tests/test-stage-planner.js` clause `oneScope` fails when a second derivation comes back.
- **The gap between 845 and 847 was three rows, not two**: Battle Bond, Simple and Gluttony. The corrected
  answer is **845 of 964 in scope**. That is the same total as legal_scope's old figure, but two members
  changed places. The planner's fixtures do not change: **841 of 845** in-scope mechanics carry one.
- **Tests.** `tests/test-stage-planner.js` (full population) is GREEN: 15 clauses and 14 red demonstrations.
  - The new clause went red first, on the pre-change code, with 6 failures.
  - It goes red again on a planted second derivation: break `second-scope`, clean 0, broken 4.

## Why `legal_scope.js` owns it

- **It asks the authority, not a proxy.**
  - It puts every ability carrier to the TeamValidator.
  - It reads injected moves from the sim's own `getMoves` fallback.
  - It finds conferral through every sim method that writes an ability: `setAbility`, `skillSwap`,
    `formeChange` and `transformInto`.
- **The planner's proxies were weaker.**
  - It learned about Battle Bond's validator refusal only when a staging attempt failed.
  - It found Struggle by grepping two `.ts` files for the literal id.
  - It scanned for `setAbility("<literal>")` only.
- **It is small and fast.** One dependency (`champions_sim.js`), memoised, about 0.6 s.
  - The planner is 2,100 lines. It reads tags at git HEAD and the driver's source, and requires the
    preflight module.
  - Making coverage.js, and through it status.js, load the planner to get a denominator would tie the
    status tool to files ENGINE edits.
- **It already had the consumers.** coverage.js uses it, and ENGINE's in-flight `engine/tag_dex.js`
  already reads its `conferred` list.

**The richer refusal codes are kept.** They come from both files, and all are now in the module:

| code | in? | kind | rule |
|---|---|---|---|
| CARRIED | in | ability | a legal species carries it, and the validator accepts that species with it (a mega is put to the validator as its base holding the stone) |
| LEARNED | in | move | `getMovePool` of a legal species |
| INJECTED | in | move | `getMoves` fallback, cited `READ:dist/sim/pokemon.js:743` (Struggle) |
| CONFERRED | in | ability | no accepted carrier, but an in-scope source writes it; for a move, the validator accepts a learner holding that move |
| HELD | in | item | legal; a stone or `itemUser` item has a legal user |
| NO-LEGAL-CARRIER | out | all | none of the above |
| VALIDATOR-REFUSED | out | ability | every legal carrier is refused by the validator |
| NO-LEGAL-READER | out | ability, item | every handler only writes `abilityState.<k>`; no legal entity and no sim line reads `<k>`; something out of the regulation does |

## 845 against 847, row by row

This was proved as a set difference, not inferred from the totals. The planner's in-scope set was every row
not refused NO-LEGAL-CARRIER. legal_scope's was `inScopeIds`. **961 of 964 rows agreed.**

| row | legal_scope before | planner before | authority | right answer |
|---|---|---|---|---|
| `ability:battlebond` | OUT, validator refused | **IN**. VALIDATOR-REFUSED came from a failed staging attempt, so it was not one of the 117 NO-LEGAL-CARRIER and sat inside 847 | Greninja's `S` slot. `checkLegal` returns "Greninja (Greninja-Bond) does not exist in Gen 9." `greninjabond` and `greninjaash` are both `isNonstandard: 'Past'` and tier `Illegal`. There is no other carrier. | **OUT, VALIDATOR-REFUSED.** legal_scope was right. |
| `ability:simple` | **OUT**, reported as conferred and not admitted | IN, conferred, with a fixture | Simple Beam is legal. Its learners are `audino` and `audinomega`, and the validator accepts Audino with Simple Beam. `onHit` calls `setAbility('simple')`, and Simple's `onChangeBoost` acts. Pinned pool (6.9.0 row): 37 games declare the move, 19 click it. | **IN, CONFERRED.** The planner was right. |
| `ability:gluttony` | **IN**, carried | OUT, NO-LEGAL-READER, which is not among the 117, so it also sat inside 847 | `onStart` and `onDamage` only set `pokemon.abilityState.gluttony = true`. The readers are 14 pinch berries, all `Past`. Neutralizing Gas only *writes* `abilityState.gluttony = false`. No line in `dist/sim` reads it, and the Champions mod does not override it. | **OUT, NO-LEGAL-READER.** The planner was right. |

**The arithmetic:**
- 847 = 964 − 117 NO-LEGAL-CARRIER. It counted Battle Bond (wrong) and Simple (right). It also counted
  Gluttony, which the planner itself refused but under another code, so a correct answer was hidden inside a
  wrong total.
- legal_scope's 845 = 964 − 119. It was wrong on Simple and on Gluttony, and the two errors cancelled.
- Unified: 847 − Battle Bond − Gluttony = 845 = old 845 − Gluttony + Simple.

**Checked on the way, and unchanged:**
- Every one of the 497 in-scope moves has a learner that `champions_sim.canLearn` (the validator) accepts.
  0 exceptions.
- 0 moves are learned only by a mega or battle-only forme.
- 0 legal items carry `zMove` or `isPokeball`.

## What changed (working tree only)

- **`engine/legal_scope.js`**
  - `verdict(kind, id)` returns `{inScope, code, why, …}`.
  - CONFERRED is admitted. The switch is the one line `ADMIT_CONFERRED = true`, and the header cites
    tag-plan B6-b, "out of scope unless Will says so", with the evidence that has landed since: ENGINE's
    tag_dex admits Simple, and medicham2 applies its multiplier.
  - The NO-LEGAL-READER rule moved in from the planner.
  - `outOfScope()` carries the code. `IN_CODES` and `OUT_CODES` are exported.
  - **`conferred` keeps its shape.** Checked field for field against HEAD: identical. ENGINE's in-flight
    `tag_dex.js` reads the same data.
- **`engine/stage_planner.js`**
  - Requires the module and deletes `conferrals()`.
  - The scope block now reads `U.scope.verdict()`.
  - Deleted: its own NO-LEGAL-READER check, and its grep of `sim/pokemon.ts` / `sim/battle-actions.ts` for
    injected moves.
  - A mechanic in scope with no body to stage it on is now refused PLANNER-CANNOT-CONSTRUCT (the planner's
    gap), never NO-LEGAL-CARRIER.
  - New break `second-scope`. `summary.inScope` is printed.
- **`engine/coverage.js`**
  - Out-of-scope rows are listed by code.
  - The Simple note said "counted in no denominator". That is now false, and it now reads
    "IN SCOPE WITH NO LEGAL CARRIER (CONFERRED, counted)".
- **`tests/test-stage-planner.js`**
  - Clause 8, `oneScope`. It checks four things:
    - The rows the planner refuses as out of scope match legal_scope's out set and codes. It reads the code
      and "no staging attempt", not a flag the planner sets.
    - The planner builds no fixture for an out-of-scope mechanic.
    - The planner's printed count matches legal_scope's.
    - coverage.js's `legalScope()` returns the identical in-scope set.
  - The red demonstration `second-scope` was added, and `--quick` gains four rows: Battle Bond, Gluttony,
    Struggle and Spore.

## Evidence

- **Red first.** The new clause ran against the unchanged planner and unchanged legal_scope: FAIL, 6.
  - legal_scope had no `verdict()`.
  - Battle Bond: planner IN, legal_scope OUT.
  - Gluttony: planner OUT, legal_scope IN.
  - Simple: planner IN and legal_scope OUT, which is two failures (the scope mismatch, plus a fixture for an
    out-of-scope mechanic).
  - The planner printed no in-scope count.
- **Intermediate.** With legal_scope changed and the planner not yet changed: FAIL, 1 (Battle Bond,
  planner side). The fault is attributable to the planner alone.
- **After.** GREEN. `second-scope` breaks clean 0 / broken 4: Battle Bond and Gluttony, each as a scope
  mismatch plus a fixture for an out-of-scope mechanic.
  - Any planner break also skips the planner's own validator check (`if (!BRK)` in `buildOne`). That is
    why Battle Bond gets a fixture under the break. It is existing behaviour, not changed here.
- **Planner output.** 0 of 964 rows changed against the HEAD plan, compared by refusal code and by fixture
  bodies and turns. It now prints `in scope 845 (engine/legal_scope.js)`.
  - Battle Bond is now refused before staging instead of after.
- **coverage.js.** Both lines print "740 of 845", before and after. The numerator did not move, because
  neither Simple nor Gluttony fired in the harness.
  - New text: `abilities 116 (NO-LEGAL-CARRIER 114, VALIDATOR-REFUSED 1 battlebond, NO-LEGAL-READER 1 gluttony)`.
  - The harness's two remaining disagreements are named: it marks Simple unreachable, and it stages Gluttony.
- **Tag coverage, tags held fixed.**

  | tags | old scope | new scope | membership |
  |---|---|---|---|
  | HEAD | 275/294 consumer, 287/294 probe | **274/293, 286/293** | `lowersBerryThreshold` leaves |
  | ENGINE's working tree (has the Simple row) | 275/294, 287/294 | 275/294, 287/294 | `amplifiesBoosts` joins and `lowersBerryThreshold` leaves |

  So what `status.js` prints depends on which `tags.json` is committed.
- **Timing.** The full test took 98.7 s, with three of my other processes competing for CPU. The planner
  alone takes 15.9 s; `--quick` takes 1.4 s.

## Other scope deciders still in the tree (not touched)

Lines are from the working tree at the time of writing. `all_mechanics_fire.js` and `roster.js` are clean
against HEAD. `tag_dex.js` is mid-edit by ENGINE, so HEAD lines are given in brackets. Each should read
`const SCOPE = require('./legal_scope.js').derive()` once and ask `SCOPE.verdict(kind, id)`.

**`engine/all_mechanics_fire.js`**
- `:337-338` `LEGAL_SPECIES` drops megas and battle-only formes. Keep it as the list of sheet bodies for
  staging, and stop reading scope from it.
- `:1716-1720` A move with no `CARRIERS` (from `:351-356`) is marked unreachable. Change it to:
  - `SCOPE.verdict('move', mv)`;
  - INJECTED goes to `runStruggle`;
  - out-of-scope becomes `unreachable` with `sv.code + ' — ' + sv.why`.
- `:2456-2465` Ability scope comes from `AB_CARRIERS` (`:364-369`) and `MEGA_AB_CARRIERS` (`:410-414`).
  Replace it with `SCOPE.verdict('ability', ab)`. This is where Battle Bond and Gluttony go out:
  - Gluttony is staged today and reads DID-NOT-FIRE.
  - A CONFERRED verdict needs a runner. `stage_planner.js` `stageConferred` is the recipe: the partner
    beams the subject, and the subject self-boosts. Until then Simple stays "NO LEGAL CARRIER" here.
- `:2768-2773` The relabel on the validator message "does not exist in Gen 9" goes dead once `:2456`
  asks scope first.
- `:3469-3470` `runStone` unreachable: use `SCOPE.verdict('item', di.id)`.
- `:3543-3547` The `zMove` / `isPokeball` excuse is a scope decision with 0 legal rows today. Replace it
  with the verdict.

**`tests/roster.js`**
- `:914-918` `CARRIERS` walks `dex.species.all()` with `exists && !isNonstandard` and no tier check, which
  admits tier-`Illegal` species (10 of them, per `2026-09-11-coverage-counters.md`). Add the legal filter.
  Scope questions go to `SCOPE`.
- `:945` `carrierFor` picks which carrier and should stay. When it returns null, the reason is
  `SCOPE.verdict('ability', id).code`.
- `:3764`, `:3985`, `:7349`, `:7439`, `:7517`: `cannot('no legal species in this format carries it')`
  becomes `cannot(v.code + ': ' + v.why)`, where `v` is `SCOPE.verdict('ability', id)`.

**`engine/tag_dex.js`**
- `:9725-9731` [HEAD `:9725`] `LEGAL_CARRIED` has no validator, so Battle Bond counts as carried.
- `:9748-9761` `CONFERRED` is ENGINE's in-flight block. It reads `conferred`, then re-applies an
  admission rule of its own (a move source with `holders > 0`) instead of reading the verdict.
- `:9765-9767` [HEAD `:9735`] and `:9790` [HEAD `:9758`] are the filter and the dropped-tag loop.
- Replace all four with a verdict read. **ENGINE must choose what `tags.json` describes:**
  - What can be on a body: `v.inScope || v.code === 'NO-LEGAL-READER'`. This keeps Gluttony's row, which a
    sheet can declare, and drops Battle Bond.
  - What can act: `v.inScope`. This drops both, and the `lowersBerryThreshold` tag disappears.
  - Either is one expression over the one verdict.

**`engine/champions_sim.js` (not in the brief's list; found here)**
- `:853-865` `unreachable(kind, id)` is a fifth scope decider: tier filter, no validator, no conferral, no
  reader rule.
  - It is wrong on all three rows: it says Battle Bond is reachable, Simple unreachable and Gluttony
    reachable.
  - It has **0 callers** in `engine/`, `tests/` and `build/`.
  - It cannot simply call `legal_scope.js`, because legal_scope requires champions_sim and that would be a
    circular require. Delete it, or move it into legal_scope.
- `abilityCarriers` / `moveCarriers` (`:799`, `:843`) answer *which bodies*, not scope. Their callers
  (`engine/fixture_legality.js:541,547` and nine probes) use them to pick bodies or count carriers, and
  that is correct.

**Inside `stage_planner.js`, left on purpose:** `triggersOf` still computes `read-by-others`
legal and illegal readers (`:435-442`). It is a staging trigger and decides no scope. The `learners` and
`bearers` maps choose which body to stage on, not whether the mechanic exists.

## Notes-row text (for the coordinator; `docs/RUNNING-NOTES.md` was not written)

This is MINOR: a published figure (847) moves, and the basis does not.

```
## [6.10.0] — 2026-09-11 — which mechanics exist in the regulation is decided in one place, and the planner's 847 was wrong on three rows in two directions

- **What changed.** `engine/legal_scope.js` is the one implementation of scope. `verdict(kind, id)` returns in or out of scope with a code: CARRIED, LEARNED, INJECTED, CONFERRED or HELD; or NO-LEGAL-CARRIER, VALIDATOR-REFUSED or NO-LEGAL-READER. `engine/stage_planner.js` imports it and deletes its own carrier-list scope and its conferral scan. `engine/coverage.js` lists out-of-scope rows by code. `tests/test-stage-planner.js` clause `oneScope` fails when the planner or coverage.js returns a different in-scope set.
- **Measured.** The two derivations disagreed on three rows, not two. Battle Bond is out: its only carrier, Greninja, is refused by the TeamValidator, and the planner had counted it in. Simple is in: Simple Beam is legal and the validator accepts Audino holding it, but legal_scope had left it out. Gluttony is out: its handlers only set a flag, and the only readers are 14 berries that are `Past`, but legal_scope had it in. 845 of 964 mechanics are in scope. That is the same total as legal_scope's old figure with two rows swapped. The planner's fixtures are unchanged at 841 of 845. The clause was red on the pre-change code (6 failures) and is shown red on a planted second derivation. Detail: `docs/_reports/2026-09-11-scope-unified.md`.
- **Supersedes.** ~~841 of the 847 mechanics with a legal carrier~~ (6.9.1 row and CHANGELOG 6.9.1): now 841 of 845 in scope. The coverage denominator stays 845, and its membership changed (Gluttony out, Simple in).
- **Basis.** unchanged.
- **Owed to the next major.** None. Owed as work: `engine/all_mechanics_fire.js`, `tests/roster.js`, `engine/tag_dex.js` and `champions_sim.unreachable()` still decide scope their own way. The lines are in the report.
```

## OWED, NOT RUN

**`status.js --write` has not been run.** It restamps all five ledgers, and ENGINE holds them. The
coverage lines it prints will change text (out-of-scope rows by code, Simple counted), and the tag lines move
with whichever `tags.json` gets committed. Run it after ENGINE lands, in the same commit as the notes row:

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
node engine/status.js --write
```

Re-verify what was run here:

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
node engine/legal_scope.js                                    # IN SCOPE 845 of 964; codes; Simple ADMITTED
node tests/test-stage-planner.js --quick                      # ~1.5 s
cmd.exe //c "tools\\lownode.cmd tests\\test-stage-planner.js" # full population + 14 red demonstrations
node engine/stage_planner.js | head -2                        # in scope 845 (engine/legal_scope.js)
node engine/coverage.js | grep -A6 "staged mechanics that fired"
```

ENGINE's next pass adopts the module at the lines listed above. Then the harness should stop staging
Gluttony, and it needs a conferred runner for Simple:

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
cmd.exe //c "tools\\lownode.cmd engine\\tag_dex.js"
node engine/coverage.js | grep -A8 "staged mechanics that fired"   # the harness-disagreement sentence should be gone
```

Scratch, this session only: `scope_diff.js`, `authority_probe.js`, `reader_probe.js`,
`move_rule_probe.js`, `plan_head.json`, `plan_new.json`, `legal_scope_head.js`, `tags_head.json`,
`coverage_before.txt`, `coverage_after.txt`, `red1_prechange.txt` and `test_after.txt`. No file was deleted.
