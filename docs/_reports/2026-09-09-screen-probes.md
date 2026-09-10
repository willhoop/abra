# THE SCREENS HALF OF `ignoresScreensAndSubs` HAS AN INSTRUMENT, AND ALL FOUR SCREENS MATCH THE AUTHORITY

ENGINE, probes only. Historical by construction — every figure here is derived; re-derive rather than
quoting this file. `node tests/test-mechanics.js` and `SHOWDOWN_PATH=... node tests/probe_screens_infiltrator.js`
print the current state.

---

## 0. VERDICT

| row (census, `ability | ignoresScreensAndSubs`) | medicham2 | authority | verdict |
|---|---|---|---|
| Reflect costs a physical hit, Infiltrator lands the unscreened number | 43 → 29 → 43 | 36 → 24 → 36 | FIRED-AND-BOARDS-MATCH |
| Light Screen costs a special hit, Infiltrator lands the unscreened number | 87 → 58 → 87 | 51 → 34 → 51 | FIRED-AND-BOARDS-MATCH |
| Aurora Veil under snow costs a special hit, Infiltrator lands the unscreened number | 79 → 53 → 79 | 49 → 33 → 49 | FIRED-AND-BOARDS-MATCH |
| Safeguard refuses a Will-O-Wisp, Infiltrator burns through it | brn / – / brn | brn / – / brn | FIRED-AND-BOARDS-MATCH |
| Compound Eyes lands a 90% Skitter Smack on a roll that misses without it (`accuracyMod`) | 0 / 28 (0.85 bare: 27) | acc 90 → miss / acc 117 → 33 | FIRED-AND-BOARDS-MATCH |

Triples read control → screened → Infiltrator-through-the-standing-screen. In every damage row, on
BOTH engines, screened `=== battle.modify(control, [2732, 4096])` — the authority's own `modify`,
called, not retyped — and the Infiltrator arm equals the control exactly with the screen still up.

**No defect card.** Nothing here is a finding for the narration agent's batch. The engine already did
this; what it lacked was the instrument.

**Census: 830 → 835** (`probed`/`live` both), `missing 0`, `threw 0`, `hollow 0`, `run_ok true`,
ratchet floors unchanged (`unarmed 0`, `directCall 1`). `git diff data/mechanics-census.json`: 5 labels
added, 0 removed, 0 `live:false` introduced, 0 duplicate labels.

---

## 1. THE FOUR SCREENS, DERIVED

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node -e "
const fs=require('fs');const {Dex}=require(process.env.SHOWDOWN_PATH+'/dist/sim');
const D=Dex.forFormat('gen9championsvgc2026regmb');
const legal=x=>x.exists&&!x.isNonstandard&&x.tier!=='Illegal';
const src=fs.readFileSync(process.env.SHOWDOWN_PATH+'/data/moves.ts','utf8');
const block=id=>{const i=src.indexOf('\n\t'+id+': {');return i<0?'':src.slice(i,src.indexOf('\n\t},',i));};
const fam=D.moves.all().filter(m=>m.sideCondition&&/infiltrates/.test(block(m.id)));
console.log(fam.map(m=>m.id+':'+m.isNonstandard));   // mist:Past auroraveil:null lightscreen:null reflect:null safeguard:null
console.log(fam.filter(legal).map(m=>m.id));           // [ 'auroraveil', 'lightscreen', 'reflect', 'safeguard' ]
"
```

**Five side conditions read `infiltrates`; Mist is `isNonstandard: 'Past'`; the regulation has FOUR.**
The session-close report's "all five checked" counted Mist. Champions overrides none of the four moves,
nor `infiltrator`, nor `compoundeyes` (`data/mods/champions/moves.ts` and `abilities.ts` grepped for
the keys; asserted every run by the probe).

### The authority's lines

| screen | file:line | clause the ability defeats |
|---|---|---|
| Aurora Veil | `data/moves.ts:857` | `if (!target.getMoveHitData(move).crit && !move.infiltrates) { if (this.activePerHalf > 1) return this.chainModify([2732, 4096]); return this.chainModify(0.5); }` |
| Light Screen | `data/moves.ts:10338` | same clause, word for word |
| Reflect | `data/moves.ts:14857` | same clause, word for word |
| Safeguard | `data/moves.ts:15592` (`onSetStatus`), `:15603` (`onTryAddVolatile`) | `if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;` |
| the ability | `data/abilities.ts:2123` | `infiltrator.onModifyMove(move) { move.infiltrates = true; }` |

The three damage screens sit inside `runEvent('ModifyDamage')`, whose last line is
`modify(relayVar, modifier)`, so the screened number is exactly `modify(unscreened, [2732, 4096])` in
doubles. That is the equality both engines are held to.

### The carriers, derived from the Champions learnsets

```bash
# legal Infiltrator carriers (Dex.forFormat, filtered legal, abilities include 'Infiltrator'):
#   spiritomb whimsicott chandelure chandeluremega meowstic meowsticf malamar noivern dragapult
# legal Compound Eyes carriers: vivillon and its 19 pattern formes (one learnset)
# learnset walk: D.data.Learnsets[id].learnset, following prevo / baseSpecies
```

| row | attacker (Infiltrator carrier) | click | target | screen click | neutral control click |
|---|---|---|---|---|---|
| Reflect | Dragapult | Facade (Normal 70, no secondary) | Clefable | Reflect | Work Up |
| Light Screen | Chandelure | Hex | Clefable | Light Screen | Work Up |
| Aurora Veil | Chandelure | Hex | Ninetales-Alola, under snow | Aurora Veil | Nasty Plot |
| Safeguard | Chandelure | Will-O-Wisp (85) | Clefable | Safeguard | Work Up |
| Compound Eyes | Vivillon | Skitter Smack (90) | Garchomp | — | Swords Dance |

Every body, ability and click is checked legal by `tests/probe_screens_infiltrator.js` on every run
(28 derived facts), and every attack is checked NOT type-immune into its target.

**The instrument was wrong before the engine was, once.** The first Reflect fixture was Dragon Claw
into that Clefable and read 0 in every arm. `Dex.getImmunity('Dragon', ['Fairy'])` is `false` — Fairy
is IMMUNE to Dragon, typed from memory as a resist. The row said MISSING about a screen it never
reached; it is recorded in the row's own comment. The probe also asserted the authority's weather id
as `snow` (this engine's internal id) where the authority's is `snowscape`; it now derives it from
`dex.moves.get('snowscape').weather`. Neither error touched the engine.

---

## 2. HOW THE ROWS ARE SHAPED

Exactly `dollArms` with a screen where the doll was (`screenArms`, registered in `REALTURN` with its
reason, as the header requires). Three arms, two real turns each through `battleTurn`:

- **control** — the foe clicks a neutral self-targeting move (Work Up / Nasty Plot raise the TARGET's
  own offence and cannot move the damage it takes), so both arms spend the same number of turns;
- **test** — the foe clicks the screen;
- **inf** — the foe clicks the screen AND the mover carries Infiltrator (assigned directly, so the arms
  differ in one field).

`works`: control landed; screen up and cost the hit (`scr.dmg < ctrl.dmg`, `scr.dmg > 0`); Infiltrator
through the STANDING screen for exactly the unscreened number. Safeguard reads status instead.
Aurora Veil's arms set snow on the field first (it fails outside snow on both engines) and aim a
SPECIAL move so snow's Ice-type Defense boost never enters.

The authority half pins `battle.prng.random` to a constant fraction (0.5; 0.95 for the Compound Eyes
arms — the census row's own roll) so the arms differ in the screen only, and reads `p2.active[0].hp`,
`.status` and `p2.sideConditions[screen]`. Absolute damage is not compared across engines (`bare()`
builds a usage spread; the authority team is 84-EV Serious) — each engine is held to its own
`modify(control)` equality, which is the mechanic.

### Compound Eyes

`compoundeyes.onSourceModifyAccuracy → chainModify([5325, 4096])` lands inside
`runEvent('ModifyAccuracy')` at `sim/battle-actions.ts:713`, BEFORE the one clamped stage at `:714-727`
(re-opened: `boost = clampIntRange(boosts.accuracy, -6, 6)`, then `clampIntRange(boost - evasion, -6, 6)`,
then `trunc`). Both stages are zero on this board, so the roll is the printed 90 and the ability and
nothing else. The authority handed `randomChance` **90** bare and **117** with the ability
(`modify(90,[5325,4096]) = 117`); the 0.95 die misses one and lands the other. Vivillon is the only
legal Compound Eyes line; Skitter Smack is its printed-under-100 damaging move without a recharge turn.

---

## 3. THE TWO-HALVES SWEEP

**A. Tags whose NAME carries a conjunction** — derived: `/(And|Or)(?=[A-Z]|$)/` over the 309 tag rows
(`data/tags.json` as on disk at 22:5x; another agent has it modified in the working tree):

| tag | halves | census rows per half (before / after this wave) |
|---|---|---|
| `ignoresScreensAndSubs` | `ignoresScreens` / `ignoresSubstitute` | **0 / 1 → 4 / 1** (the nine doll rows file under the MOVE tags they stage) |

**One tag. It is the one this wave closed.**

**B. Structural pass — tags whose PARAMS carry two or more boolean halves**, with rows per half counted
by a keyword derived from the param key (last camelCase word, a small synonym table for
substitute/screens/status/volatile). **This is a heuristic and is reported as one**: a half at zero
means no row's label or detail mentions the word, not that no row exercises it. 56 tags qualified;
the ones with a zero half, by rows on the tag:

| tag | rows | halves (rows) | zero half |
|---|---|---|---|
| `punishesAttacker` | 14 | onFaintOnly 4, boostsSecondary 0, dealsDamageTaken 0 | boostsSecondary, dealsDamageTaken |
| `variablePower` | 11 | computed 0, perAlly 1, invert 0 | computed, invert |
| `takesTargetItem` | 7 | removes 1, consumesAndGainsEffect 1, swaps 4 | — |
| `trapsTarget` | 7 | endsWithSource 0, viaSecondary 1 | endsWithSource |
| `pivotStatus` | 7 | selfSwitch 4, conditional 0 | conditional |
| `preventsStatDrop` | 7 | onlyGrassTypes 1, protectsAllies 0, reflects 2, reflectSkipsAtFloor 0, reflectNeedsLivingSource 2 | protectsAllies, reflectSkipsAtFloor |
| `changesTargetType` | 5 | adds 1, refuseIfHasType 4, replaces 0, refuseIfExactType 4, writesToSelf 0, copiesTargetTypes 4 | replaces, writesToSelf |
| `fixedDamage` | 4 | ignoresStatsAndSTAB 4, retaliates 0, excludesAlly 0 | retaliates, excludesAlly |
| `formeOnHit` | 4 | sameStats 0, sameTypes 0 | both |
| `piercesProtect` | 4 | bypassesProtect 2, appliesOnlyWhenBlocked 0 | appliesOnlyWhenBlocked |
| `removesHazards` | 4 | … refusedBySheerForce 0 | refusedBySheerForce |
| `shieldsUser` | 4 | bypassable 0, blocksStatus 1 | bypassable |
| `targetClass` | 4 | chooseable 0, mustPressure 1 | chooseable |
| `drain` | 4 | perTarget 2, unusual 0 | unusual |
| `boostsAtHPThreshold` | 3 | onCrossingOnly 1, defersHealingBerry 0 | defersHealingBerry |
| `protectsAllyFromStatus` | 3 | coversSelf 2, onlyGrassTypes 1, needsSource 0, notFromSelf 2 | needsSource |
| `lowersUser` | 3 | lowersSpeed 0, alsoRaises 0 | both |
| `forcesBerryEat` | 2 | requiresBerry 2, gatedOnBoost 1, onlyBerryHolders 0, failStill 2 | onlyBerryHolders |
| `flingsOwnItem` | 2 | powerFromItem 2, consumes 0, failsIfItemRefusesTake 0, failsIfNotFlingable 0 | three |
| `boostsWhenLowered` | 2 | retaliates 0, perStatLowered 1, needsSource 0, notFromAlly 1 | retaliates, needsSource |
| `transformsOnEntry` | 2 | diagonal 2, copiesBoosts 0 | copiesBoosts |
| `flattensTypeMatchup` | 2 | skipsStatus 0, bailsOnImmunity 1 | skipsStatus |
| `refusesAllyDamage` | 2 | refuses 0, notSelf 0 | both |
| `fractionalPriority` | 2 | excludesStatus 1, unconditional 0 | unconditional |
| `curesStatus` | 2 | cures 2, onSet 0 | onSet |
| `resistBerry` | 2 | oneShot 0, requiresSuperEffective 1 | oneShot |
| `restoresPP` | 2 | prefersEmptySlot 2, eatsWhenASlotEmpties 0 | eatsWhenASlotEmpties |
| `boostsUser`, `secondaryStatEffect`, `lowersTarget`, `boostsAlliesWithAbility`, `restoresOwnLastItem`, `formeCycleResidual`, `refusesIndirectDamage`, `stealsItem`, `copiesFoeBoosts`, `doublesBerryEffect`, `ignoresRedirection`, `addsOwnSecondary`, `reflectsStatusToSource` | 1 each | one or more halves at 0 | see `scratch sweep.js` output |
| **`refusesCopy`** | **0** | notrace, noentrain, noreceiver, failroleplay, failskillswap, cantsuppress | **the whole tag has no census row** |

**Count: 1 name-conjunction tag (closed this wave); 41 param-halves tags with at least one zero half
under the keyword heuristic, of which `refusesCopy` has NO census row at all.** Not probed this wave,
per the brief. The right next step is not 41 probes — it is to decide which of those param keys are
HALVES (a behaviour the engine must do) and which are QUALIFIERS (a condition on the one behaviour),
and that is a tag-spec question for `docs/TAGS.md` before it is a probe question.

---

## 4. WHAT MOVED IN `data/mechanics-census.json` BESIDES THE FIVE ROWS

Four header fields (`generated`, `probed`, `live`, `armed`) and the `detail` strings of five
pre-existing rows — the four rate rows (`Iron Head 20.3% → 20.6%`, `Moonblast 10.4% → 9.4%`,
`Fiery Dance 45.3% → 49.8%`, Freeze-Dry's control) and the frozen-pivot row's counter reading. Those
rows draw dice the census does not seed, and their detail moves on every run; their `live` flags did
not. This is prior behaviour of the instrument and not a change made here; it is noted because a
`--stat` of `59 insertions, 9 deletions` would otherwise read as rows removed. None were.

---

## 5. PROPOSED, NOT WRITTEN

**RUNNING-NOTES row.**
> `ignoresScreensAndSubs` — the SCREENS half gains four paired census rows (Reflect, Light Screen,
> Aurora Veil, Safeguard × Infiltrator) and Compound Eyes gains its first to-hit row; census 830 → 835
> live (`data/mechanics-census.json`), all five FIRED-AND-BOARDS-MATCH against the official simulator
> (`tests/probe_screens_infiltrator.js`, 15/15). **Supersedes.** Nothing — no published figure moves.
> **Basis.** unchanged. Owes: nothing to the living documents; a row to `docs/ENGINE.md`'s hand list.

**CHANGELOG bullet (Added, PATCH — no published figure moves).**
> Four paired census rows for the screens half of `ignoresScreensAndSubs` and one for Compound Eyes'
> to-hit roll, each with an official-simulator arm (`tests/probe_screens_infiltrator.js`). The
> regulation has FOUR screens — Mist is `Past` — derived, not typed.

**ROADMAP row.**
> *A tag whose NAME states two halves must carry a probe on each.* `ignoresScreensAndSubs` was named
> for screens and subs and carried nine rows on subs and none on screens — a board-material multiplier
> with no instrument for the tag's whole life. Closed for that tag 2026-09-09. Open: the param-halves
> sweep in `docs/_reports/2026-09-09-screen-probes.md` §3 names 41 tags with a half no row mentions
> and one (`refusesCopy`) with no row at all; decide half-vs-qualifier in `docs/TAGS.md`, then probe
> the halves.

---

## OWED, NOT RUN

```bash
# The roster / all-mechanics run against the GROWN census belongs to the narration agent's
# end-of-batch chain, which is editing the engine now. Not run here.
tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release <id>

# ENGINE.md hand list and the generated blocks — after the above, by whoever closes the batch.
node engine/status.js --write

# NOTHING IS COMMITTED. tests/test-mechanics.js, tests/probe_screens_infiltrator.js,
# data/mechanics-census.json and this report are on disk only. The pre-commit hook requires the
# RUNNING-NOTES row and CHANGELOG bullet proposed in §5, which this brief said not to write.
git add tests/test-mechanics.js tests/probe_screens_infiltrator.js data/mechanics-census.json docs/_reports/2026-09-09-screen-probes.md
```
