# 2026-09-18 — ROADMAP #80 (Knock Off berry disposition) and ROADMAP #9 (`pranksterBlocked` target)

ENGINE division, isolated worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a9f3a9b17d0cc6d65`.
Light mode: staged boards and single probes only. No `game_differential` run, no roster stage, no
`quarantine.js`, no `all_mechanics_fire`. `SHOWDOWN_PATH` was set explicitly to the main tree's checkout
`C:/Users/willj/Projects/Pokemon/pokemon-showdown`, because `engine/showdown_path.js` looks for a sibling checkout
and the worktree has no sibling.

## Verdict

| row | premise | engine change | proof |
|---|---|---|---|
| #80 | **STALE.** The disposition matches, and so do all four consumers | none for #80 itself | `tests/probe_item_disposition.js` (`ko-colbur`: `colburberry/ate` on both); `tests/probe_knockoff_berry_consumers.js` 8/8 MATCH, every control moves the authority |
| #80, found on the way | **REAL, a different defect**: Harvest gave back a NON-berry | Harvest gate reads `isBerry` of `_lastItem` | `tests/probe_harvest_nonberry.js` RED → GREEN; knob `MEDI_HARVEST_GATES_ON_ATEBERRY=1` restores RED; new census row |
| #9 | **LATENT, as the row says.** No played route is wrong | `pranksterBlocked` refuses nothing whose target is `all`/`foeSide`/`allySide`/`allyTeam` | `tests/probe_prankster_target.js`: 24 played arms GREEN before and after; DIRECT arm 17/17 wrong → 0/17; knob `MEDI_PRANKSTER_TARGET_BLIND=1` restores RED |

Census: **886 live / 0 missing → 887 live / 0 missing** (`data/mechanics-census.json`, generated
2026-09-19T00:05:11Z). The one new row is "Harvest gives back only a BERRY — a spent White Herb stays
spent" (tag `restoresBerryAtResidual`). Under `MEDI_HARVEST_GATES_ON_ATEBERRY=1` that row reads MISSING
(886/1). The census was regenerated clean afterwards.

## ROADMAP #80

### The authority

- Colbur Berry is the legal berry with `onSourceModifyDamage` and `naturalGift.type === 'Dark'`. It was
  derived, not named: 18 resist berries are legal.
- It is eaten inside the damage calculation (`eatItem`, `sim/pokemon.ts:1805` `lastItem`, `:1809`
  `ateBerry`). Knock Off's `onAfterHit` `takeItem` then finds nothing.
- Consumers, read from source:
  - **Recycle**: `if (pokemon.item || !pokemon.lastItem) return false` (data/moves.ts `recycle`).
  - **Belch**: `onTry(source) { return source.ateBerry; }` (data/moves.ts `belch`). The Champions mod
    (data/mods/champions/moves.ts:52-58) removes `onDisableMove` only, so Belch is selectable and fails at `onTry`.
  - **Harvest**: `this.dex.items.get(pokemon.lastItem).isBerry` (data/abilities.ts `harvest`). No Champions override.
  - **Cud Chew**: `onEatItem` records the berry and re-eats it at the next residual (data/abilities.ts:732-760).
  - **Unburden**: fires on `onTakeItem` and on `onAfterUseItem`. The disposition cannot change it, so it has no arm.

### Legal carriers (derived through `CS.abilityCarriers`, `CS.moveCarriers` and the validator)

- Harvest: Trevenant.
- Cud Chew: Tauros-Paldea (three formes) and Farigiraf.
- Unburden: Sceptile, Liepard, Slurpuff, Hawlucha and Sneasler.
- Recycle: 12 learners.
- Belch: 16 learners.
- Natural Gift is `Past`.

Every consumer has a legal carrier, so each one got a probe arm.

### `tests/probe_knockoff_berry_consumers.js` (new)

- **Fixture.** The attacker is Sableye, derived as the first legal non-mega Knock Off learner that is
  Dark-typed and whose ability sets no weather. Each consumer body is the first legal non-mega carrier
  that Knock Off hits super-effectively.
- **Arms.** Each consumer plays two arms: with the berry, and with Leftovers as the control.

```
  recycle   berry   colburberry     colburberry     MATCH
  recycle   inert   -               -               MATCH
  belch     berry   allowed(miss)   allowed(miss)   MATCH
  belch     inert   refused         refused         MATCH
  harvest   berry   colburberry     colburberry     MATCH
  harvest   inert   -               -               MATCH
  cudchew   berry   cud×1           cud×1           MATCH
  cudchew   inert   cud×0           cud×0           MATCH
```

The probe was wrong three times before it was right. Each error was caught by printing the traces.

1. Showdown refuses `pass` for a body that can move. The turn-1 click is now a derived self-boost.
2. It read a Belch **miss** (the die is shared, and the miss is identical on both engines) as a
   refusal. The fate of the Belch is now read from the protocol line after `|move|…|belch|`.
3. Its Cud Chew regex required `Cud Chew` with a space, but medicham2 writes the id `cudchew`. Folded.

### A different defect, found while checking Harvest

medicham2's Harvest gate was `m._lastItem && m._ateBerry`. `_ateBerry` means "has EVER eaten a berry"
and is never cleared. So a body that ate once, then spent a non-berry, got the non-berry back. The
authority checks `lastItem.isBerry`.

- **Reachability.** Trevenant, the only carrier, learns Trick and Thief (validator), so it can come to hold a White Herb. White Herb is legal and not a berry.
- **Staging** (`tests/probe_harvest_nonberry.js`):
  - Turn 1: Knock Off eats the Colbur, and a Drought sun gives it straight back.
  - Turn 2: Trevenant Tricks the Colbur away for Sableye's White Herb.
  - Turn 3: Venusaur's Scary Face spends the Herb.
- **Before:** medicham2 still holds `whiteherb`, and the authority's slot is empty. There are 2 Harvest lines against 1.
- **After:** the slot is empty on both engines. Knob `MEDI_HARVEST_GATES_ON_ATEBERRY=1` makes it RED again.
- **Control.** The turn-1 restore is the same Harvest on the same body, and it fires on both engines.
- **Fix.** `engine/medicham2-browser.js`, Harvest residual: `TAGS.has('item', m._lastItem, 'isBerry')`.
  The comment directly above had always claimed this check.

## ROADMAP #9

### The authority

- `data/abilities.ts` `prankster`: `onModifyPriority` sets `pranksterBoosted` for `category === 'Status'`.
  No Champions override.
- `sim/battle-actions.ts:676-677` (`hitStepTryImmunity`): the refusal is **per target**, and only for
  `!targets[i].isAlly(pokemon)`, and only when `!dex.getImmunity('prankster', target)`. The Dark immunity
  was asked of the dex (`getImmunity('prankster', ['Dark'])` is false), not recalled.
- `sim/battle-actions.ts:505-518`: `all`, `foeSide`, `allySide` and `allyTeam` go to `tryMoveHit` and never
  reach that step.

### `tests/probe_prankster_target.js` (new)

Every body and move is derived:

- Prankster user: Whimsicott. Its non-Prankster control ability is Infiltrator.
- Dark body: Houndoom, with Early Bird.
- Plain body: Blastoise.
- Dark Prankster: Sableye.

Every arm is played in both engines and read three ways:

- the differential's board comparison;
- the `|-immune|` count on each stream;
- the authority's effect at boundary 1.

| arm | expect | medi/sd refusals | result |
|---|---|---|---|
| foe-dark (Charm → Dark foe) | refused | 1/1 | GREEN |
| foe-nondark (control: the type) | lands, atk −2 | 0/0 | GREEN |
| foe-dark-noprank (control: the ability) | lands | 0/0 | GREEN |
| ally-dark (Charm → Dark ally) | lands | 0/0 | GREEN |
| spread (Cotton Spore, Dark + non-Dark foe) | Dark refused, other −2 | 1/1 | GREEN |
| spread-noprank (control) | both land | 0/0 | GREEN |
| self-dark (Sableye Bulk Up) | lands | 0/0 | GREEN |
| 17 field moves (every `all`/`allySide`/`foeSide` status move any legal Prankster carrier learns) | lands | 0/0 each | GREEN ×17 |
| DIRECT: `pranksterBlocked(Whimsicott, Dark foe, <move>)` | Charm true; 0 of 17 field moves refused | before **17 of 17 refused**; after 0 of 17 | GREEN |

- **The instrument can see a wrong engine.** Under the pre-existing `MEDI_PRANKSTER_SIDE_BLIND=1`, `ally-dark` goes RED (`p1b boosts.atk medicham 0 / showdown −2`).
- **Why `self-dark` stays green under that knob.** A self-targeted boost routes to `kind:'setup'`, which never asks the function. ROADMAP #255 recorded that.
- **Quick Guard.** It is a one-turn side condition, so it is read from its `-singleturn` start line.
- **Fix.** Inside `pranksterBlocked`, a move whose `moveFx(...).target` is in `{all, foeSide, allySide, allyTeam}` returns `false`.
  - This changes no played outcome. Every played arm agreed before the change.
  - It closes the function-level hazard: the day a field-move branch calls the shared refusal per body, as Perish Song's branch already does for Good as Gold, a Prankster Trick Room at a Dark foe would be refused.
  - Knob: `MEDI_PRANKSTER_TARGET_BLIND=1`.
- **No census row was added.** A direct-call probe would raise the ratcheted "call the mechanic DIRECTLY" count (1, may never rise), and no real-turn probe can see a latent defect.

## Files changed (worktree)

- `engine/medicham2-browser.js`: two knobs, the Harvest gate and the `pranksterBlocked` target clause.
- `tests/test-mechanics.js`: one census probe (Harvest, non-berry).
- `tests/probe_knockoff_berry_consumers.js`, `tests/probe_harvest_nonberry.js`, `tests/probe_prankster_target.js`: new.
- `data/verification/probe-knockoff-berry-consumers.json`, `data/verification/probe-prankster-target.json`: new.
- `data/verification/probe-item-disposition.json`: re-run, timestamp only.
- `data/mechanics-census.json`: regenerated, 887/887.
- `docs/ENGINE.md`: new top section and hand list. #80 and #9 leave it.
- **Not mine, moved as side effects. Do not merge blindly:**
  - `data/engine-release.json`: loading `game_differential.js` from the probes auto-cut release `c30081f41b5d` in this worktree.
  - `data/provenance-stamp.json`: moved by `node engine/status.js`.

## PROPOSED NOTES ROW

> **ENGINE — Knock Off's berry disposition (ROADMAP #80) is stale. Harvest restored a non-berry (fixed).
> `pranksterBlocked` is now target-aware (ROADMAP #9, latent, hardened).**
>
> - **#80.** `tests/probe_item_disposition.js` `ko-colbur` already reads `colburberry/ate` on both
>   engines. The new `tests/probe_knockoff_berry_consumers.js` tests the four consumers' OUTCOMES
>   (Recycle, Belch, Harvest, Cud Chew) after a berry-eating Knock Off, each with a Leftovers control that
>   moves the authority: 8/8 MATCH (`data/verification/probe-knockoff-berry-consumers.json`). Nothing to fix.
> - **Harvest.** Harvest gated on `_ateBerry` ("ever ate a berry") where the authority reads
>   `lastItem.isBerry` (data/abilities.ts `harvest`). A Trevenant that ate a Colbur, Tricked for a White
>   Herb and spent it got the Herb back. `tests/probe_harvest_nonberry.js` RED → GREEN. Knob
>   `MEDI_HARVEST_GATES_ON_ATEBERRY=1`.
> - **#9.** `pranksterBlocked` returned "refused" for all 17 `all`/`allySide`/`foeSide` status moves that a
>   legal Prankster carrier learns, when asked about a Dark foe. The authority routes those through
>   `tryMoveHit` (`sim/battle-actions.ts:505-518`) and never reaches the clause at `:676-677`. No played
>   route asked the function, so all 24 played arms of `tests/probe_prankster_target.js` agreed before and
>   after (`data/verification/probe-prankster-target.json`). Knob `MEDI_PRANKSTER_TARGET_BLIND=1`.
> - **Census 886 → 887 live / 0 missing** (`data/mechanics-census.json`).
> - **Supersedes.** Nothing published.
> - **Owed.** The engine bytes moved, so a release cut and the four gate artifacts' re-run are owed
>   (not run: light mode).
> - **Fold-in.** `docs/ABRA-technical-docs.md` (mechanics list) at the next major.
>
> **Basis.** unchanged

## PROPOSED ROADMAP STATUS CELLS

- **#80**: `CLOSED 2026-09-18 — STALE. Disposition matches (tests/probe_item_disposition.js ko-colbur,
  colburberry/ate both engines). Consumers checked by outcome, tests/probe_knockoff_berry_consumers.js 8/8
  MATCH with Leftovers controls. The check found a DIFFERENT defect, Harvest restoring a non-berry (gate
  on _ateBerry instead of lastItem.isBerry), FIXED: tests/probe_harvest_nonberry.js, knob
  MEDI_HARVEST_GATES_ON_ATEBERRY=1, census 886 → 887. docs/_reports/2026-09-18-knockoff-prankster.md`
- **#9**: `CLOSED 2026-09-18 — hardened. pranksterBlocked refuses nothing whose target is
  all/foeSide/allySide/allyTeam (sim/battle-actions.ts:505-518). Latent confirmed: 24 played arms of
  tests/probe_prankster_target.js agree before and after; the DIRECT arm read 17/17 field moves refused
  before, 0/17 after. Knob MEDI_PRANKSTER_TARGET_BLIND=1.`

## OWED, NOT RUN

- **Release cut and re-run of the four gate artifacts.**
  - What: `game_differential` (three lattices), roster (three stages), `all_mechanics_fire`, `test-engine-diff`.
  - Why it is owed: `engine/medicham2-browser.js` changed.
  - Why it was not run: forbidden in light mode.
  - Current state: `node engine/status.js` in this worktree already prints the mechanics clause as "MEASURED AGAINST A DIFFERENT ENGINE". That is the expected consequence, and it is not a new defect.
- **Which scoreboard should move.** These are rare mechanics:
  - Harvest has one carrier.
  - The Prankster change moves no played outcome.
  - Expect the lab to move (census +1) and the pinned pool not to. This is stated before the run.
- **`tests/test-fixture-legality.js` is RED, and not from this work.** Four string literals in
  `tests/probe_heal_bell_party.js` (`"par"`, `"brn"`) and `tests/probe_reopen_partings.js` (`"F"`, `"M"`)
  are flagged as naming nothing in the format. Neither file was touched here. The literals are status and
  gender codes, which suggests the instrument's literal scan needs an allowlist rather than an engine
  change. Routed to the coordinator. Not fixed here.
- **Not measured: the Harvest and Pickup interaction.** Pickup reads `_lastItem` and `_usedItemThisTurn` from an adjacent body, and it was not touched or probed.

## ADDENDUM — `tests/test-fixture-legality.js` red on `par` / `brn` / `F` / `M`: THE TEST WAS WRONG

**Verdict: the probes are correct, and the fix is in the instrument.** No fixture changed, so neither
probe's verdict could move, and neither probe was edited.

**What the flagged literals are, per the authority:**

- **`par` and `brn`** are fixture-row starting statuses. `tests/probe_heal_bell_party.js` uses rows of the
  form `[species, ability, status]`.
  - `data/conditions.ts` defines both with `effectType: 'Status'`.
  - `Dex.forFormat('gen9championsvgc2026regmb').conditions.get('par')` returns `exists: true`,
    `effectType: 'Status'`, id `par`. The same holds for `brn`, `slp`, `psn`, `tox` and `frz`.
- **`F` and `M`** are genders passed to `buildPair`'s gender seam in `tests/probe_reopen_partings.js`.
  - `sim/global-types.ts:28` gives `type GenderName = 'M' | 'F' | 'N' | ''`.
  - `PokemonSet.gender` has that type (`sim/global-types.ts:53`).

**The defect.** `engine/fixture_legality.js`'s `roleOf` only recognised species, ability, item and move.
Any other scalar in a set declaration was reported as "names nothing in this format".

**Fix.** `roleOf` now also returns:

- **`status`**, when `dex.conditions.get(s)` exists with `effectType === 'Status'` and the exact id.
- **`gender`**, when the literal is exactly `M`, `F` or `N`. The match is case-sensitive.

Nothing is typed as a list of statuses. Status membership comes from the dex.

**Result.**

- `tests/test-fixture-legality.js` went from `1 FAILED` to `ALL GREEN`.
- 863 distinct sets and 15 verdicts, unchanged. Neither new role counts as a set component, so no new sets are admitted.

**Proof that it still catches a bad code.** I temporarily planted `tests/zz_planted_stray_literal.js`. It
was created and deleted by this agent. It held rows with `parx`, `Q`, `m`, `par` and `F`.

- The gate went back to `1 FAILED`.
- It named `"parx"` (line 4), `"Q"` (line 5) and `"m"` (line 6).
- It accepted `par` and `F`.

**Not added: a species-level gender check.** An `F` on a male-only species is not flagged by this role. Neither probe
stages a fixed-gender species.

File changed: `engine/fixture_legality.js`. This instrument is outside ENGINE's owned list but is not
one of the forbidden files.

**Proposed notes-row line:**

> **Instrument.** `engine/fixture_legality.js` now recognises fixture statuses (dex
> `effectType: 'Status'`) and genders (`GenderName`, `sim/global-types.ts:28`). `test-fixture-legality`
> 1 FAILED → ALL GREEN. A planted `parx` / `Q` / `m` still fails. **Supersedes.** Nothing. **Basis.** unchanged

## ADDENDUM 2 — a declared gender is now checked against the species

**The authority.** Two facts about Showdown decide what this check must do.

- The validator will not catch a wrong gender. Under this format's `obtainablemisc` (the rule table
  says `true`), it silently rewrites `set.gender = species.gender || set.gender`
  (sim/team-validator.ts:654-657). `checkLegal` is also never handed a gender.
- A fixture is played, not validated. The battle takes the declared gender first:
  `genders[set.gender] || this.species.gender || ...` (sim/pokemon.ts:339-340). So an `F` on a
  male-only species plays a female body that the game cannot contain. Cute Charm, Attract and Rivalry
  all read that gender.

**The fix, in `engine/fixture_legality.js`.**

- The three matchers now carry a `gender` field on each set: helper calls, bracketed rows, and object
  literals with `gender:`.
- The distinct-set key includes the gender.
- `sweep()` refuses a gender the species cannot have. The allowed genders come from the dex, not a
  typed list:
  - a fixed `species.gender` (`M`, `F` or `N`) allows only that gender;
  - otherwise, each of `M` and `F` whose `genderRatio` share is above zero is allowed.
- The refusal goes through the existing findings ratchet as a PAIRING verdict. So a new one fails by
  name, and a deliberate one must be baselined.

**The plant.** I made a temporary file, `tests/zz_planted_gender.js`, and deleted it after the run.
Its bodies were derived as the first legal non-mega species of each kind that learns Protect.

| row | result |
|---|---|
| Tauros (male-only) declared `F` | caught: "Tauros is declared female, but in this format it can only be male." |
| Kangaskhan (female-only) declared `M` | caught |
| Starmie (genderless) declared `M` | caught: "…it can only be genderless." |
| Tauros declared `M` (control) | not flagged |

The gate read `1 FAILED` while the plant was in place.

**The real fixtures.** The gate is ALL GREEN, with the plant removed and the run repeated: 863 distinct
sets and 15 verdicts, unchanged. **The check catches no existing fixture, so there is no new finding.**
Four real sets declare a gender, all in `tests/probe_reopen_partings.js`, and all four are legal:

- Feraligatr `F` (line 183)
- Milotic `F` (line 183)
- Clefable `M` (lines 187 and 189)

**A blind spot I found and did not fix.** The line-184 fixture, `const P = S('Corviknight', …, 'M')`, is
not scanned at all. Matcher (A) skips any helper call preceded by `= ` because it treats it as the
helper's own definition. That rule is older than this change and affects every `const X = helper(...)`
fixture in the repo, not just gender. Corviknight has a 50/50 ratio in the dex, so this particular row
would pass anyway.

**Proposed notes-row line:**

> **Instrument.** `engine/fixture_legality.js` checks a declared gender against the species, reading
> `species.gender` and `genderRatio` from the dex. A planted F on Tauros, M on Kangaskhan and M on
> Starmie each fail by name; M on Tauros passes. The real fixture set is unchanged and green (863 / 15),
> and the 4 gender-declaring sets are legal.
> **Supersedes.** Nothing. **Basis.** unchanged

## ADDENDUM 3 — fixtures the source scan could not see: the runtime check, and a real finding

**Two changes.**

1. **The static scan had a bug.** `engine/fixture_legality.js` matcher (A) skipped every helper call whose
   result was assigned (`const P = S(...)`). It read the `=` before the call as "the definition", but a
   definition never puts `=` directly before `helper(`. Now only a `function helper(` declaration and a
   method call (`x.helper(`) are skipped.
   - Measured against a before/after snapshot of the scan: **+22 set declarations**, 2,589 → 2,611, and
     **+9 distinct sets**, 863 → 872, across 4 files.
   - **0 illegal.** The gate is still ALL GREEN.
2. **The runtime check is the real fix.** A list of source spellings misses the next spelling, so the
   check now also runs on what probes actually build. `engine/game_differential.js` `buildPair` is the
   one constructor every staged two-engine fixture goes through, and it now puts each body to
   `fixture_legality.checkSet`.
   - `checkSet` is the same verdict function the static sweep now uses, so the two cannot disagree.
   - It applies only when the caller, read off the stack, is a file under `tests/`. Pool and swarm
     teams go through the same constructor and are a different question.
   - It reports rather than throws. Each distinct set is reported once, loudly, with the building
     `file:line` and whether it is baselined.
   - Its state is process-global, because some probes re-require the module once per arm.
   - It prints an exit receipt: `N distinct set(s) checked, M illegal`.
   - `GD_FIXTURE_CHECK=0` turns it off.
   - `tests/test-fixture-runtime-check.js` (new) builds three sets from under `tests/`: a derived
     illegal learnset pair (Venusaur with Apple Acid), a derived impossible gender (Tauros declared F),
     and a legal control. The test is GREEN. With the hook call deliberately removed it reads
     `3 FAILED`, and the hook was restored afterwards.

**How much was unchecked.**

- The source scan counts **1,946 construction sites with no literal set** (1,808 before the skip fix
  exposed more calls). Those sites were outside every check, and they are what the runtime check covers.
- **209 test files** build through `buildPair`.
- In light mode I ran **9** of them, and they checked **185 distinct sets** at runtime:

| probe | runtime sets checked | illegal |
|---|---|---|
| probe_reopen_partings | 40 | 0 |
| probe_corner_mechanisms | 45 | 0 |
| probe_kingsrock_volley | 14 | 0 |
| probe_partingshot_conditional | 22 | **18** |
| probe_item_disposition | 15 | 0 |
| probe_knockoff_berry_consumers | 13 | 0 |
| probe_harvest_nonberry | 6 | 0 |
| probe_prankster_target | 30 | 0 |
| probe_heal_bell_party | builds through `M.buildMon`, not `buildPair`, so outside this hook | — |

### REAL FINDING — `tests/probe_partingshot_conditional.js` plays 18 illegal bodies (16 not baselined)

**The cause.** `const FILL = ['Protect', 'Iron Defense', 'Amnesia']` (line 156) is appended to every
body through `mon(species, ability, FILL)`. The static scan takes moves only from array literals, and
`FILL` is an identifier, so these sets were invisible to it.

**What the validator refuses, all at `:299` / `:301`:**

- **Iron Defense** on Milotic, Clefable, Garchomp, Weavile, Gliscor, Malamar, Florges and Jolteon.
  Incineroar and Snorlax are also refused, but those two are already baselined.
- **Amnesia** on Garganacl, Toxapex and Corviknight.

**The rows are genuinely clicked.** Showdown does not check learnsets in battle
(`clicks not on request 0`). The scripts' `ID` and `AM` turns are those very moves, so the verdicts
rest on bodies this format cannot field.

**Current verdict: `all 19 arms clear`, exit 0 (re-run twice this session).**

**NOT FIXED, deliberately.** The self-boost clicks are the arms' knob and control turns, and the
scripts assign them per slot rather than per species. A legal repair means deriving, per body, a
self-boost that raises only Def or SpD (never the Atk or SpA that Parting Shot drops) and re-scripting
the arms. That could move the verdict, so it belongs to whoever owns the probe, with the probe re-run.

**Proposed register row:** "probe_partingshot_conditional stages 16 unbaselined illegal learnset pairs
through `FILL` (Iron Defense / Amnesia); verdict 'all 19 arms clear' rests on them; re-derive per-body
self-boosts and re-run."

**Files changed in this addendum:**

- `engine/fixture_legality.js`: `checkSet` exported, gender moved into it, assigned-call skip fixed.
- `engine/game_differential.js`: runtime hook, `fixtureIllegal()` export, two SEAM counters.
- `tests/test-fixture-runtime-check.js`: new.

`engine/game_differential.js` is not a release SOURCE (ROADMAP #109), so the frozen engine did not move.

**OWED, NOT RUN:**

- **The full runtime sweep.** Running all 209 `buildPair` test files with the hook on is a heavy batch
  and outside light mode. That run is the only population count; the 9-probe sample above is not one.
- **The `M.buildMon` door.** Census and heal-bell style fixtures build through it and are not hooked.
  It is a second constructor and would need the same `checkSet` call.

**Proposed notes-row line:**

> **Instrument.** Fixture legality is now checked on what probes BUILD (`buildPair`, callers under
> `tests/`, `fixture_legality.checkSet`) as well as on what source declares. The static assigned-call
> skip is fixed (+22 declarations, all legal). **Finding:** `tests/probe_partingshot_conditional.js`
> plays 18 illegal bodies (16 unbaselined) through a `FILL` identifier the source scan could not read.
> Not fixed; registered.
> **Supersedes.** Nothing. **Basis.** unchanged

## ADDENDUM 4 — `probe_partingshot_conditional.js` filler repaired, and the hook shown not to change the differential

**Verdict: it did not move.** Before and after the fix, all 19 arms clear and the probe exits 0.

### The filler

- **What was wrong.** `FILL = ['Protect', 'Iron Defense', 'Amnesia']` put an illegal move on 18 bodies.
- **What replaced it.** `FILL` is now `['Protect', <inert filler>]`, derived per species from the format:
  - a legal status move with `target: 'self'` whose `onTry` **returns** `source.status === 'slp'`;
  - each body takes the first candidate it learns (validator `canLearn`);
  - a body that learns none stops the run by name;
  - because the scripts click one move id in every slot, all bodies must share the same filler, and
    that is asserted.
- **Derived membership: Sleep Talk alone.** It is legal on all 16 of the probe's bodies, and the
  Champions mod has no `sleeptalk` override.
- **Why it is inert.** It fails at `onTry` for any awake body. That is before `onHit`, so there is no
  `this.sample` die and no stat, field or side write (`data/moves.ts` sleeptalk). Nothing in the
  fixture can sleep.
- **My first derivation was wrong.** It matched `status === 'slp'` anywhere in `onTry` and admitted
  **Rest**, whose `onTry` is the opposite (it fails when asleep, then heals and sleeps the user).
  Printing the membership caught it, and the rule was tightened to the `return` form.
- `ID` and `AM` both map to the filler. The two names are kept so the scripts read unchanged.
- The runtime check now reads `22 distinct set(s) checked, 0 illegal`; it read `18 illegal`.

### Inertness, proved by measurement

This follows the same method as the Magnet Rise control: vary only the filler and compare everything
the arms read. I diffed the before run (the illegal self-boosts) against the after run (Sleep Talk),
arm by arm. The compared lines were:

- who stands in p1a on Showdown, on medicham, and on medicham under the knob;
- the target's atk/spa on both engines;
- the boards-differ counts, clean and under the knob;
- the cancel, except and unreadable counters, the MEDFAILS stamps and clicks-not-on-request;
- every `>>` verdict line.

**Result: 19 of 19 arms identical on every one of those lines.**

The only change is the number of leaves compared:

| arm length | before | after |
|---|---|---|
| 2-turn arms | 1,654 / 1,656 | 1,642 / 1,644 |
| 5-turn arms | 3,318 | 3,294 |

That is a constant 4 leaves fewer per boundary, with one fewer move slot per body. I did not itemise
which 4 leaves they are. So the self-boosts were not carrying any verdict. They produced def/spd
leaves that both engines already agreed on.

### The runtime hook cannot change differential output

**No throw.**

- The checker's `require`, the baseline read and `checkSet` are each inside `try`/`catch`, and each
  failure is announced on stderr.
- It returns before doing anything unless the caller, read off the stack, is a file under `tests/`.
  The pool, the swarm and `engine/` callers are untouched.

**No RNG and no mutation.**

- It reads the sheet into a fresh object and never writes to the sheet or to `picked`.
- `checkSet` goes to the TeamValidator, which does not touch battle dice.
- **Measured.** One directed game (derived legal bodies, 3 boundaries) was hashed over medicham's full
  trace, the authority's log with the wall-clock `|t:|` lines removed, and every board's diffs and
  leaf count. I ran it twice with `GD_FIXTURE_CHECK=0` and twice with the hook on. The "on" runs
  validated 8 sets before the game. **All four hashes were `4c1c0d2205e81d52`.**
- The first attempt at this hashed the `|t:|` lines and gave four different hashes, even between two
  identical "off" runs. That was the clock, not the hook.

**Cost.**

- `buildPair` on already-seen sets: 25.6–27.4 µs with the hook off, 78.8–81.6 µs with it on. That is
  about **+53 µs per call**, and a game makes two calls.
- A directed game (build + play) took 20.2–25.5 ms in both settings. The difference is inside
  run-to-run noise (off 23.5 / 20.2 ms, on 25.5 / 21.2 ms).
- Only the first sight of a distinct set pays for a validator call, and only for callers under
  `tests/`. The pool path pays one stack capture, measured at about 20 µs raw.

**Other hardening:**

- The hook's state is process-global, so a probe that re-requires the module does not duplicate its
  output.
- `require('./fixture_legality.js')` can no longer throw into a game.
- The bench file (`tests/zz_hook_bench.js`) was created and deleted by this agent.

### Gates, re-run after all of this

- `test-fixture-legality`: ALL GREEN.
- `test-fixture-runtime-check`: ALL GREEN.

**Proposed notes-row line:**

> **Fixture.** `tests/probe_partingshot_conditional.js` no longer plays 18 illegal bodies. Its filler
> is derived per species (a self-targeted status move whose `onTry` returns the user's sleep test;
> membership = Sleep Talk), and it is shown inert: 19/19 arms are identical on every measured line
> before and after. The verdict is unchanged ("all 19 arms clear").
> The `buildPair` fixture hook was shown to leave a directed game's trace, log and boards
> byte-identical on and off (hash `4c1c0d2205e81d52`), at about +53 µs per `buildPair` call.
> **Supersedes.** Nothing. **Basis.** unchanged
