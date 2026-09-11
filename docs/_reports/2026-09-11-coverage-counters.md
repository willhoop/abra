# The coverage counters two planning passes found wrong (2026-09-11, MEASURE)

No games were played. Nothing ENGINE holds was edited (`engine/medicham2-browser.js`, `engine/tag_dex.js`,
`data/tags.json`, the `all_mechanics_fire.js` artifacts, `tests/test-mechanics.js`). Every "before" and
"after" below is computed on the SAME HEAD artifacts, read with `git show HEAD:<file>` into the session
scratchpad.

**Pins.** HEAD moved during the session, from `a97115a3` (the plans' commit) to `ea437935`. All three
artifacts changed between the two commits, but every figure the plans published reproduces at `ea437935`:

- `data/all-mechanics-fire.json`: generated 2026-09-11T03:18:26Z, release `5973a4e3c768`, arm
  `bottom-tie-first`.
- `data/tags.json`: generated 2026-09-11T02:34:19Z.
- `data/mechanics-census.json`: generated 2026-09-11T03:52:31Z.

The dex is `gen9championsvgc2026regmb` through `engine/champions_sim.js` `dexFor`. The pinned pool is
`data/team-pool-frozen`: 17,381 games and 208,224 sheet slots. A live run of `node engine/coverage.js`
afterwards printed the same four numbers, with no being-written warning.

## Verdict

| counter | before (HEAD code) | after (this pass) | what was wrong |
|---|---|---|---|
| boards line | **739 of 964** | **663 of 845** ("fired mechanics with a board compared") | It counted a board on 76 rows whose mechanic never acted. Its denominator also held 119 mechanics no legal body can reach. |
| fired line | 663 of 760 | **663 of 845** | Its scope came from the harness's own flags, which drop every mega forme. That excluded 14 abilities, all 75 stones and Struggle, although they are in scope. |
| tags with an engine consumer | 281 of 303 | **275 of 294** | It judged a tag by its FIRST row only. `preventsStatDrop` flips to consumed and `survivesFromFull` to unconsumed. 9 tags have no in-scope carrier and leave the denominator, 6 of which had counted as consumed. |
| tags with a census probe | 287 of 303 | **287 of 294** | Same scope. The 9 out-of-scope tags are not counted either way. |
| harness NO-LOOKUP list (`tests/mutation_harness.js`) | 33 tag names | **26** | The lazy regex stopped at the first `)`. 7 tags are found, including `modifiesWeight`, and none is lost. |

**Scope is now one function.** `engine/legal_scope.js` gives 845 in scope and 119 out:
- moves: 497 of 500 in scope. The 3 out are powershift, softboiled and spore.
- abilities: 200 of 316 in scope, 116 out.
- items: 148 of 148 in scope.

**Out of scope is not the same as cannot occur, for exactly one ability.** Of the 116, only **Simple** is
reachable: the legal move Simple Beam writes it (2 legal learners). In the pinned pool, Simple Beam is
declared on **37 sheets in 37 games** and clicked **27 times in 19 games**, out of 17,381. No sheet
declares Simple. The engine declares it does not double a Simple body's boosts
(`medicham2-browser.js` near :19040, per the tags plan).

## 1. The boards and fired lines (`engine/coverage.js`)

**RED first. HEAD's coverage.js was run on the HEAD artifacts:**

```
OLD staged mechanics that fired              663 of 760
OLD mechanics with a board compared          739 of 964   (moves 496/500, abilities 170/316, items 73/148)
```

**The rows it got wrong (printed by the scratch demo on the same artifacts):**

The boards numerator counted these, although the mechanic never fired:

| row | board | verdict |
|---|---|---|
| ability prankster | yes | DID-NOT-FIRE |
| ability hospitality | yes | DID-NOT-FIRE |
| item lightclay | yes | DID-NOT-FIRE |
| move attract | yes | CANNOT-FIRE-IN-THIS-FIXTURE |

The denominator scope was wrong both ways:

| row | harness flag | new scope | why |
|---|---|---|---|
| ability fairyaura | unreachable | IN | Floette-Mega carries it |
| item floettite | out_of_scope | IN | its mega forme is legal |
| move struggle | unreachable | IN | the sim injects it |
| move spore | — | OUT | no legal learner |
| ability battlebond | — | OUT | the TeamValidator refuses Greninja's S slot |
| ability simple | — | OUT | no legal species carries it |

**After, on the same artifacts:**

```
NEW staged mechanics that fired              663 of 845
    moves 495/497, abilities 104/200, items 64/148. 119 out of scope — moves 3 (powershift, softboiled,
    spore), abilities 116. The harness marks 90 of these in-scope rows unreachable or out of scope and never
    stages them (struggle, aerilate, dragonize, eelevate, electricsurge, fairyaura, +84 more). It stages 1
    this scope rules out (battlebond).
NEW fired mechanics with a board compared    663 of 845
    76 more rows carry a board on a mechanic that did not fire and are NOT counted (abilities DID-NOT-FIRE
    58, items DID-NOT-FIRE 9, abilities SHOWDOWN-ONLY 8, moves CANNOT-FIRE-IN-THIS-FIXTURE 1).
    Simple is carried by no legal species but simplebeam (2 legal learners) writes it onto a body.
```

**The two lines now print the same numbers, and should.** Every fired row carries a board, so 0 fired
without one. The boards line stays separate because a fired row without a board would open a gap
there, and that gap is its whole job.

**The 90 rows the harness wrongly flags are exactly** 14 abilities only a mega carries, plus 75 stones,
plus Struggle. Nothing else.

**A drift check.** The per-row fired count is compared with the artifact's `summary`: moves `resolved`,
abilities and items `fired`. It is printed if they differ, and it reads clean today. The counter also
prints any artifact row that is not legal in the dex being read, and any in-scope mechanic with no row.
Both are 0 today.

**The scope rule, as implemented in `engine/legal_scope.js`. Every part is read off the format:**

- **Species:** `x.exists && !x.isNonstandard && x.tier !== 'Illegal'` gives 347. That includes 76 mega
  formes and 7 other battle-only formes.
- **Ability:** a legal species carries it AND the TeamValidator accepts that carrier.
  - A mega is submitted as its base species holding the stone. The base is read off the stone's own
    `megaStone` map.
  - A battle-only forme is submitted as its `battleOnly` base.
  - The first attempt submitted megas as themselves. The validator refused all 14 ("Feraligatr-Mega
    transforms in-battle with Feraligite, please fix its item"), and 14 abilities fell out of scope. That
    is this counter's defect arriving by a different door, and it was caught because the result printed
    186 against an expected 200.
  - The only refusal left is `greninja/battlebond slot S: Greninja (Greninja-Bond) does not exist in Gen 9.`
- **Move:** a legal species learns it (`dex.species.getMovePool`), or the sim injects it. The injected set
  is parsed from the `getMoves` fallback, `READ:dist/sim/pokemon.js:743`. That yields struggle. It also
  yields `fight`, which is not a legal move and is filtered out.
- **Item:** legal. A mega stone needs a legal mega forme, and an `itemUser` item needs a legal user.
  148 of 148 pass.

**Cost.** One `derive()` takes about 0.7 s per process, and it loads the dex and one TeamValidator.
`engine/status.js` now pays that through `coverage.js`. If scope cannot be derived, both lines print
NOT DERIVED with the reason. They do not fall back to the harness's flags.

## 2. The first-row consumer check (`engine/coverage.js` `tagCoverage`)

**RED first. HEAD code on the HEAD artifacts:** `281 of 303`. `preventsStatDrop` is in `noConsumer`:
true. `survivesFromFull`: false.

Multi-row tags at HEAD, shown as (kind, legal members, whether a consumer is set):

| tag | move row | item row | ability row |
|---|---|---|---|
| critRatioUp | 14, consumed | 1, consumed | 2, consumed |
| accuracyMod | 5, consumed | 3, consumed | 5, consumed |
| flattensTypeMatchup | — | 1, consumed | 1, consumed |
| **survivesFromFull** | — | 2, consumed | **1 (Sturdy), NO consumer** |
| **preventsStatDrop** | — | **0 legal (Clear Amulet), NO consumer** | 12, consumed |
| fractionalPriority | — | 1, consumed | 2, consumed |

The first-row rule got both bolded tags wrong, in opposite directions.

**After:** `275 of 294`. `preventsStatDrop` is now consumed. `survivesFromFull` is now unconsumed,
because Sturdy's row really has `consumedBy: null`.

**9 tags are out of scope, with no in-scope carrier:** ignoresAbility, blocksSecondary, blocksPowder,
skipsChargeTurn, auraBreak, amplifiesBoosts, allyBasePowerBoost, secondaryChanceMult and
boostsNotVeryEffective. Six of them had counted as consumed.

The arithmetic is 281, less 6 now out of scope, plus 1 and minus 1 for the two flips, which gives 275.

A row's membership is read from the per-entity blocks of `tags.json` and scoped by `legal_scope.js`. Two
rows have a stale `n` against their blocks, and the blocks are what is used:
- `fixedDamage` (move): `n` 15, 13 members.
- `convertsMoveType` (ability): `n` 10, 5 members.

**Not fixed, because it is ENGINE's file: `engine/tag_dex.js` writes `consumedBy` by grepping for a hint
string.** I ran `engine/tag_lookups.js` over HEAD's `medicham2-browser.js` and `board.js`. **17 of the 19
in-scope "no consumer" tags are named in a real TAGS lookup:** formeTypedMove, restoresOwnLastItem,
firstTurnOnly, lowersUser, boostsTarget, punishesMinimize, survivesFromFull, resistBerry,
damageMultOnRepeat, statMult, critDamageUp, hitsTwice, boostsOnKO, ignoresStatStages, modifiesWeight,
preventsSwitch and condStatMult.

The other 2 are named by no lookup: needsUntrackedState and readsOwnItem. The tags plan calls both
vestigial.

This matches the tags plan's 17 detector misses and 2 vestigial tags exactly. When `tag_dex.js` calls
`tag_lookups.sourceConsumers` instead of its grep (the plan's batch B1), this line should read
**292 of 294**. That figure is a prediction, not a measurement.

## 3. The harness lookup regex (`tests/mutation_harness.js` → `engine/tag_lookups.js`)

The regex was `/TAGS\.(?:param|has|withTag|reactorsTo)\(([^;]{0,220}?)\)/g`. Its lazy `?` stops at the
first `)`. The detector now lives in `engine/tag_lookups.js`, and the harness requires it:
- Each argument list is scanned to its balanced close.
- Strings, template literals, regex literals and comments are skipped.
- A tag is a literal at the call's own argument level.
- An unclosed call is printed to stderr, never dropped.

The unit check did not require the harness, because requiring it opens a release. It extracted HEAD's
function text instead. Results on HEAD's `medicham2-browser.js`:

- Old detector: **273** names. New detector: **280** names, from 575 calls, with 0 unclosed and **0 lost**.
- **7 newly matched**: absorbMakesClickSure, copiesFoeBoosts, deductsExtraPP, immuneToMoveClass,
  modifiesWeight, refusesForcedSwitch and refusesItemLoss.
- Each was checked to be a CODE line, not a comment: m2:6503, 6876, 8677, 10255, 18871, 18906, 31386,
  36744 and 42820.
- Every one is a lookup whose id argument is itself a call: `(m.ability||'').replace(...)` or
  `suppressedAbility(...)`.
- The plan named only `modifiesWeight`, so the miss was 7 times wider than reported.

**Synthetic cases.** All six hold under the new detector:

| case | OLD result | NEW result |
|---|---|---|
| the Heavy Metal line | [] | [modifiesWeight] |
| a nested call with its own literals | [x, y] (an over-match) | [realTag] |
| `)` inside a string | [] | [afterParenString] |
| `)` inside a regex | [] | [afterParenRegex] |
| a ternary at the call's own level | [tagA, tagB] | [tagA, tagB] |
| division is not a regex | [afterDivision] | [afterDivision] |

The harness's full sweep was NOT run, as the brief required.

## 4. Conferred abilities: the scoping flaw, reported and not fixed

**Derivation.** First, the simulator methods that write an ability were read out of the compiled sim:
every method in `dist/sim/{pokemon,battle,battle-actions}.js` whose body assigns `.ability =` or calls
`.setAbility(`. That gives: clearAbility, clearVolatile, formeChange, getSwitchRequestData, setAbility,
skillSwap and transformInto.
- `getSwitchRequestData` and `clearVolatile` are over-matches: one writes a request object, the other
  restores the base ability. They are harmless, because no handler calls either, and they are printed
  rather than hidden.

Then every handler of every in-scope move, carried ability and legal item was scanned for a call to one
of those methods. A literal argument is an ability that gets conferred. A non-literal argument is a copy,
which confers only an ability already on a body.

The brief's names, used as a CHECK that the derivation does not under-match:

| source | derived result |
|---|---|
| Simple Beam | `setAbility("simple")`. **No legal carrier.** |
| Worry Seed | `setAbility("insomnia")`. Insomnia has 7 legal carriers. |
| Entrainment, Role Play | copy |
| Skill Swap, Wandering Spirit | copy via `skillSwap`. A scan for `setAbility(` alone misses both. |
| Trace, Receiver | copy |
| Transform, Imposter | copy via `transformInto` |
| Doodle | `isNonstandard: 'Past'`, so not a source |
| Mummy | literal, carried by 1 legal species |
| Zero to Hero | `formeChange("Palafin-Hero")`, carried |
| Lingering Aroma, Power of Alchemy | no legal carrier, so they cannot act |

**The list, with pinned-pool counts (17,381 games, 208,224 sheet slots):**

| ability | written by | legal learners | sheets declaring the move | games declaring | clicks | games clicked | sheets declaring the ability |
|---|---|---|---|---|---|---|---|
| Simple | Simple Beam | 2 | 37 | 37 | 27 | 19 | 0 |

**Out of 116 "out of scope" abilities, 1 is reachable in play.** The count is derived and printed on
every `coverage.js` run, in the boards note.

Whether Simple enters the denominator is Will's call. `inScope` deliberately does not count it.

**Where scope is decided today.** Lines are from the working tree, which is clean against HEAD
`ea437935`.

**`engine/all_mechanics_fire.js` (the artifact's scope):**
- `:330` `LEGAL_SPECIES` drops `isMega` and `battleOnly`.
- `:344` `CARRIERS` scopes moves by learners only, so Struggle is flagged at `:1608`.
- `:357` `AB_CARRIERS`, from that species list, flags 14 mega abilities NO LEGAL CARRIER at `:2209`.
- `:3007` flags every stone `out_of_scope`, and `:3504` excuses them.
- No validator is consulted, so Battle Bond is attempted and fails.

**`tests/roster.js`:**
- `:914` `CARRIERS` is `exists && !isNonstandard` with **no tier check**.
- That admits 10 species the format marks tier `Illegal`, and 9 abilities carried only by them: Serene
  Grace, Shields Down, Gulp Missile, Ice Face, the four Embody Aspect formes and Tera Shell.
- Under the roster's rule 106 abilities have no carrier. Under the filter, 115 have none.
- `:909` `MEGA_OF` and `:945` `carrierFor` do handle megas correctly (the MEGA tier).
- `:3764` and four more sites say "no legal species in this format carries it".

**`engine/tag_dex.js`:**
- `:9725` `LEGAL_CARRIED` uses the tier filter with megas in. It covers abilities only.
- No validator, so Battle Bond counts as carried. No conferral, so Simple has no record and
  `amplifiesBoosts` is out of scope.

**`engine/coverage.js`:** now calls `engine/legal_scope.js` through `legalScope()`.

**One place.** `engine/legal_scope.js` exports `derive()`, which returns `inScope`, `why`,
`outOfScope`, `conferred`, `refused` and `injected`. ENGINE can require it in the three files above,
and the four answers become one. If Will admits conferred abilities, that is one line there.

## Files

**Changed:**
- `engine/coverage.js`: adds `boardRows`, `tagCoverageOf` and `legalScope`, which are exported. The two
  staged lines and the two tag lines are rewritten.
- `engine/status.js`: its two tag-coverage lines now use the in-scope denominator.
- `tests/mutation_harness.js`: `sourceConsumers` now requires the module.

**New:** `engine/tag_lookups.js` and `engine/legal_scope.js`.

**Scratch, this session only:** `probe_scope.js`, `probe_tags.js`, `probe_conferred.js`,
`check_lookups.js` and `demo_coverage.js`.

No file was deleted.

**No test pins the old wording.** A grep of `tests/` for the status tag-coverage strings and
coverage.js labels found none.

## OWED, NOT RUN

`status.js` spawns `provenance.js`, which reads the whole store, so it was not run beside live agents.
`--write` restamps all five ledgers. `docs/ENGINE.md:145`, inside the GENERATED block, still says
"287 of 303 tags carry a probe", so it has to land in the SAME commit as the notes row that supersedes
that figure.

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
cmd.exe //c "tools\\lownode.cmd engine\\status.js" | grep -n "tag coverage\|in-scope tags carry a probe"
node engine/status.js --write
```

The red-first demonstrations, replayable. They need the HEAD dumps: see the first lines of
`scratchpad/demo_coverage.js`, and re-dump with `git show HEAD:<file>` if the scratchpad is gone.

```bash
SP=C:/Users/willj/AppData/Local/Temp/claude/C--Users-willj-Projects-Pokemon-ABRA/4af1c0ef-5c10-47e8-8fca-e2cf744fece1/scratchpad
node $SP/demo_coverage.js      # OLD 739/964, 663/760, 281/303, 287/303 -> NEW 663/845, 663/845, 275/294, 287/294
node $SP/check_lookups.js      # OLD 273 names -> NEW 280, modifiesWeight false -> true, 6 synthetic cases
node engine/legal_scope.js     # the scope, the one validator refusal, the conferred list
```

ENGINE's, after its live agent lands. Point `tag_dex.js` at `engine/tag_lookups.js` (the plan's B1) and
point the three scope sites at `engine/legal_scope.js`. The consumer line should then read 292 of 294.

```bash
export SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
cmd.exe //c "tools\\lownode.cmd engine\\tag_dex.js"
node engine/coverage.js | grep -A2 "tags with an engine consumer"
```

The harness's first real run on the new detector should print the membership. Expect 7 more tags
consumed than before. **Do not use `--gate-only` for this.** It returns at `tests/mutation_harness.js:1337`,
before `sourceConsumers` is called at `:1358`, so it never shows the new detector. The command is
`--no-write` alone. That is the full mutation sweep: it mutates and runs the engine. It is heavy, and it
waits for the live ENGINE agent to land, like everything else here.

```bash
cmd.exe //c "tools\\lownode.cmd tests\\mutation_harness.js --no-write"
```
