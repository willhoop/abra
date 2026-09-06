# LONG-TAIL BATCH H — board-material **22 of 961 → 18 of 961**, protocol **91 → 89**, and the class of games that part a board with no protocol divergence anywhere is **EMPTY**

2026-09-06. ENGINE. Four fixes, four new probes, each shown RED on the published bytes before it was
trusted. Two measured passes on two releases, so every closed game is attributable to one fix.

This is a dated findings record. It is never maintained and never cited as current state — read
`node engine/status.js`.

---

## THE HEADLINE

| clause | before `ab22bc503717` | after `83874ed37e9e` | after `1fc8ed7adfd7` |
|---|---|---|---|
| whole-game **BOARD-MATERIAL** | **22 of 961** | **19 of 961** | **18 of 961** |
| whole-game PROTOCOL | 91 | 90 | **89** |
| whole-game NARRATION | 70 (71 raw less 1 declared) | 70 (71 raw) | **70** (71 raw less 1 declared) |
| board parted with **NO protocol divergence anywhere in the game** | **2** | **0** | **0** |
| turn boundaries IDENTICAL | 10,465 of 10,548 | 10,476 | **10,483 of 10,548** |
| games VOID under the middle arm | 5 | 4 | **4** |
| census | 830 / 830 / 0 | 830 / 830 / 0 | **830 / 830 / 0**, `run_ok` true |
| roster items / abilities / moves | 140 / 129 / 475, 0 DIFFER, 0 DID-NOT-FIRE | identical | **identical, 0 / 0 on all three** |
| roster `--reds` unapplied plants | **4 NOT CAUGHT** (moves stage, exit 1) | **0** | **0**, exit 0 |
| gate | 7 pass / 2 fail | 7 pass / 2 fail | **7 pass / 2 fail**, both measured disagreements |

**BOARD-MATERIAL IS NOT ZERO. The quarantine does not open.** 18 of 961 games still part a board.

### THE FULL SAMPLE LINE, BOTH PASSES

```
node engine/game_differential.js --steering empirical --release 83874ed37e9e --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write

node engine/game_differential.js --steering empirical --release 1fc8ed7adfd7 --arm middle \
     --end-state --state --census data/verification/census-pin-9446a684709d.json \
     --games 1200 --turns 20 --team-store data/team-pool-frozen --write
```

961 games played, `--games 1200` (**the swarm is SIZED from it, so it is part of the sample
definition and not a budget**), cap 20 turns, `middle` arm, `empirical-click/v1`, pool
`0d103fb9fa87` PINNED to `data/team-pool-frozen`, census pinned to
`data/verification/census-pin-9446a684709d.json`, showdown `20ad99ffc9a5`. 269.8 s and 236.0 s.
`driver_code_stable: true` for the whole of both runs, so nothing moved under either measurement.
The `ab22bc503717` figures are `git show HEAD:data/game-differential.json`, not a re-run.

---

## THE FOUR FIXES

### 1 — A WEATHER FORME COMES OFF A **CORPSE**, AND THE REVERT LIVED ONLY ON THE SWITCH ROAD

`tests/probe_weather_forme_faint.js`, knob `MEDI_WEATHER_FORME_SURVIVES_FAINT=1`.

`Pokemon#clearVolatile()` ends with `this.setSpecies(this.baseSpecies)` (sim/pokemon.ts:1565), and
`setSpecies` is `setType(species.types, true)` — so the name and the type list both go back in one
call. The authority reaches that function from **two** roads and this engine served one:

```
sim/battle.ts:2560   faintMessages()  ->  pokemon.clearVolatile(false)      <- NOT SERVED
the switch road      medicham2 switchOut                                    <- served since 2026-08-26
```

Measured: `omit-spread t7 ...bo3-2661455548`, `p2.party.castform.species` medi `castformrainy` /
sd `castform`, `.types` medi `water` / sd `normal`. A Castform died in the rain and wore Castform-Rainy
on the bench for the rest of the game. **It is one of the two games that part a board with no protocol
divergence anywhere**, so no artifact could name it and `--dump-games` cannot see it by construction.

The `switchOut` block was **lifted into `revertWeatherFormeOnLeave` and both roads call it** — a
faint-road copy would be the FACTS-ARE-GLOBAL breach, two implementations of "which body does a
weather forme go back to". It sits in `noteFaint` **above** the `monRow(m.name)` type restore, for
the ordering reason that block already states: `setSpecies` IS `setType`, so the authority reverts
the name and then reads the types off the reverted row.

`revertTempFormeOnLeave`, already in `noteFaint`, could not serve this: it reads `_formeTempBase`,
which the weather sync never sets, so it returned false on every Castform that ever died.

Counters on the replay: `weatherFormeRevertedOnFaint +1`, `weatherFormeReverted +1`, and the control
`weatherRetyped +1` — Forecast still fires, so the green board arm is not an engine in which the
whole ability stopped working.

### 2 — PRESSURE IS PRICED OFF THE **TERRAIN-WIDENED** TARGET LIST, NOT OFF THE DEX'S STATIC WORD

`tests/probe_pressure_terrain_target.js`, knob `MEDI_PP_PRESSURE_STATIC_TARGET=1`.

`useMoveInner` resolves the target list **after** `ModifyMove`:

```
let baseTarget = move.target;
... singleEvent('ModifyMove', ...)                                    <- Expanding Force rewrites it
if (baseTarget !== move.target) target = getRandomTarget(...)         sim/battle-actions.ts:440-443
const { targets, pressureTargets } = pokemon.getMoveTargets(move, target);              :467
for (const source of pressureTargets) extraPP += runEvent('DeductPP', source, ...)      :471-482
```

`pressureScopeOf` reads `targetClass`, and **that tag carries Showdown's STATIC `move.target`
string — its own header in medicham2 says so.** Expanding Force is `normal` in the dex and
`allAdjacentFoes` at execution under Psychic Terrain, so the scope resolved to `aimed` and the list
was one body.

Measured: `baseline t6 ...bo3-2661571698`, a Meowstic's Expanding Force under Psychic Terrain into a
Houndoom and a **Pressure** Absol. `p1.pp[1].expandingforce` medi 1 spent / sd 2. **The other of the
two uncaused games** — the only line that differs is the `[spread]` field, which the semantic
normaliser collapses, so the game has no protocol divergence, no cause and no class.

The fix asks `terrainWidensToSpread(...)` — **the** function the effect road and the damage-span road
already ask — rather than a second table keyed on the move's name.

Counters: `ppPressureTerrainWidened +3`, with controls `ppPressureCharged +3` (Pressure still charges)
and `ppDeducted +33` (the PP wire is alive).

**A SECOND MEMBER WAS FOUND BY THE MEMBERSHIP DERIVATION AND IS NOT FIXED.** Every legal move whose
handlers assign `move.target` is derived on every probe run and printed; it is exactly two:
`expandingforce` and **`curse`**, whose `onModifyMove` sends a non-Ghost user's click to
`move.nonGhostTarget` — **away** from the foes. So a non-Ghost Curse into a Pressure foe is
**OVER-charged by 1 PP here**. It is not folded in: `terrainWidensToSpread` is a statement about a
TERRAIN and Curse's rewrite is about the user's TYPE, and one function answering two questions is how
the original bug got written. The probe **pins the family at two**, so a third member fails it rather
than being silently mispriced.

### 3 — `chainModify` IS NOT A FLOAT MULTIPLY, AND THE ACCURACY TABLE WAS ONE

`tests/probe_accuracy_modifier_chain.js`, knob `MEDI_ACC_MOD_FLOAT=1`.

`docs/ENGINE.md` carried this as an **owed and undiagnosed** card out of batch G: a `sleeppowder`
divergence at t15 where **both engines asked the same address** (`20260813|15|acc|sleeppowder|p11|0`,
nth 0), so the die was not the difference and *"the real cause is not yet known"*.

The cause is that Compound Eyes x1.3. Showdown accumulates every `ModifyAccuracy` handler into
`event.modifier` in 4096ths and applies it **once**, through `Battle#modify`, which truncates:

```
chainModify(n,d):  previousMod = tr(modifier*4096);  nextMod = tr(n*4096/d);
                   modifier = ((previousMod*nextMod + 2048) >> 12) / 4096      sim/battle.ts:2318-2327
modify(v, mod):    m = tr(mod*4096);  return tr((tr(v*m) + 2048 - 1) / 4096)   sim/battle.ts:2329-2340
runEvent tail:     if (typeof relayVar === 'number' && relayVar === Math.abs(Math.floor(relayVar)))
                     relayVar = this.modify(relayVar, this.event.modifier);    sim/battle.ts:929-933
hitStepAccuracy:   accuracy = runEvent('ModifyAccuracy', ...)  ... then the stages, then
                   randomChance(accuracy, 100)                       sim/battle-actions.ts:712-737
```

So the authority's post-modifier accuracy is **always an integer**. Sleep Powder at 75 under Compound
Eyes is **98** there and was **97.5** here, and the shared die landed in the gap.

**THE AUTHORITY'S 98 WAS INSTRUMENTED, NOT INFERRED.** `Battle#randomChance` was wrapped for the
replay of the accusing game and every `(n, 100)` call recorded. Sleep Powder reads **98 on turns 7, 8,
9, 12, 13, 14, 15, 16, 17, 19 and 20** — eleven calls, one value.

**THE NUMERATOR CANNOT BE RECOVERED FROM THE FLOAT, WHICH IS WHY `mult` COULD NOT SIMPLY BE PROMOTED.**
`tr(1.3*4096)` is 5324 and Compound Eyes writes **5325**; `tr(1.1*4096)` is 4505, Wide Lens writes
4505 and Victory Star writes **4506**. medicham2 already carries this exact lesson one section away,
at `MEDI_FALLEN_APPROX` for Supreme Overlord's power table.

Every `ACCMOD` row gained a `mod:[num,den]` pair — the handler's own `chainModify` argument, read off
`Dex.forFormat('gen9championsvgc2026regmb')`. **The probe re-derives all twelve from the live format
on every run and FAILS on a row that disagrees**, so the pair is checked rather than remembered:

```
item:widelens         onSourceModifyAccuracy  [4505, 4096]
item:zoomlens         onSourceModifyAccuracy  [4915, 4096]
item:brightpowder     onModifyAccuracy        [3686, 4096]
item:laxincense       onModifyAccuracy        [3686, 4096]   (BANNED here — dead row)
ability:compoundeyes  onSourceModifyAccuracy  [5325, 4096]
ability:hustle        onSourceModifyAccuracy  [3277, 4096]
ability:sandveil      onModifyAccuracy        [3277, 4096]
ability:snowcloak     onModifyAccuracy        [3277, 4096]
ability:tangledfeet   onModifyAccuracy        0.5  ->  nextMod tr(0.5*4096) = [2048, 4096]
ability:victorystar   onAnyModifyAccuracy     [4506, 4096]   (off — no legal carrier)
ability:wonderskin    onModifyAccuracy        NO chainModify — it `return 50`s, so it stays `setTo`
condition:gravity     onModifyAccuracy        [6840, 4096]
```

Arms: 28 (row x move) pairs through medicham2's **own** `hitChance`, against a reference
transcription of the two authority functions. Counters on the replay: `accModChained +32`,
`accModChainMoved +32`, and the control that matters — `accModChainDifferedFromFloat +18`. **A chain
installed and indistinguishable from what it replaced would pass every other arm.**

`MEDFAILS.accModNoChainPair` is the loud half: a row that fires with no `mod` pair still multiplies,
and says which row did it. It reads 0.

### 4 — MENTAL HERB IS AN `onUpdate` ITEM AND HAD ONLY EVER BEEN REACHED FROM THE MOVE THAT WROTE THE VOLATILE

`tests/probe_mental_herb_update.js`, knob `MEDI_MENTAL_HERB_MOVE_ONLY=1`. **Measured on its own
release, `1fc8ed7adfd7`, so its one game is attributable to it and not to the three above.**

`mentalHerbCures` was called from `applyMoveVolatile` and from `applyHealBlock` **and from nowhere
else**, so every road that writes one of the six volatiles straight into `_vol` left the item in the
pocket. WIRE 52 — Cursed Body — is such a road: `(m._vol=m._vol||{}).disable = ...`. That is the
FACTS-ARE-GLOBAL shape: state written past the one function that owns the reaction to it.

Measured: `omit-weather t14 ...bo3-2661171085`.

```
AUTHORITY  |-start|p2b: Farigiraf|Disable|Thunderbolt|[from] ability: Cursed Body|[of] p1a: Gengar
           |-enditem|p2b: Farigiraf|Mental Herb
           |-end|p2b: Farigiraf|Disable
THIS ENGINE the first line only
```

`p2.party.farigiraf.item` medi `mentalherb` / sd `""`, `vol.disable` medi 3 / sd 0. **The engine's own
counters named the missing half before anything was edited:** `volDurationApplied +1` (the Disable
landed) beside `herbSpentBeforeEnd +0` (the herb never fired) on the same replay.

The sweep is in `_updateEvent`, **beside the berries, which are `onUpdate` items too** — not at the
Cursed Body site, which would fix the one road that happened to be measured and leave the next one.
Membership is the item's own `curesVolatile.cures`, re-derived against the handler's list by the
probe. The eager call inside `applyMoveVolatile` **stays**: it is the same function, and by the time
the sweep runs the volatile and item are already gone, so the Taunt/Encore road's order — the herb
spent above Champions' queued-action relocation — is untouched.

---

## ATTRIBUTION — FOUR GAMES CLOSED, **ZERO OPENED**, ACROSS BOTH PASSES

Diffed on `state.first_board_divergences`, before against after:

| pass | closed | opened |
|---|---|---|
| `ab22bc503717` → `83874ed37e9e` | `baseline …2661571698` (Expanding Force PP), `omit-spread …2661455548` (Castform), `omit-spread …2661122292` (Sleep Powder) | **none** |
| `83874ed37e9e` → `1fc8ed7adfd7` | `omit-weather …2661171085` (Mental Herb) | **none** |

Each of the four is the game its own probe names, and each probe replays that game and asserts the
board. Three of the four now run **clean to the cap** — `protocol_div=null board_div=null` — rather
than merely parting later.

---

## THE PREDICTION RECORD — **ELEVEN HITS AT THE POINT ESTIMATE, ZERO MISSES**

Written to `data/verification/_prediction-2026-09-06-longtail-batch-H.json` and
`…-batch-H2.json` **before** either run.

| claim | predicted | measured |
|---|---|---|
| board-material, pass 1 | 19 (band 17–24) | **19** |
| uncaused board partings, pass 1 | 0 (band 0–0) | **0** |
| protocol, pass 1 | 90 (band 86–94) | **90** |
| narration level, pass 1 | 70 (band 67–74) | **70** |
| census, pass 1 | 830 / 830 / 0 | **830 / 830 / 0** |
| roster, pass 1 | 140 / 129 / 475, 0 DIFFER | **as predicted** |
| engine-diff, pass 1 | 0 of 6000, seed 20260804 | **0 of 6000** |
| board-material, pass 2 | 18 (band 17–20) | **18** |
| protocol, pass 2 | 89 (band 88–91) | **89** |
| narration level, pass 2 | 70 (band 70–71) | **70** |
| uncaused, pass 2 | 0 | **0** |

**THE NAMED RISK DID NOT MATERIALISE AND IT WAS A REAL RISK.** The accuracy chain rounds differently
from the float in **both** directions — 75 x 1.3 was 97.5 and is 98, 75 x 1.1 was 82.5 and is 82 — on
every move carrying a modifier, in every game. That is why the pass-1 band went up to 24 rather than
being pinned at 19. Zero games opened.

**THE PREDICTED TRANSFER DID NOT HAPPEN EITHER, AND THAT WAS ALSO WRITTEN DOWN.** Pass 2's prediction
said the Mental Herb game might survive as a board-clean protocol divergence and move into narration,
which would have read 90 / 71 instead of 89 / 70. It ran clean to the cap.

---

## AN INSTRUMENT DEFECT FOUND, MEASURED AND FIXED: **FOUR RED DEMONSTRATIONS HAD BEEN BLIND**

Not an engine fix, and not caused by this pass. `tests/roster.js --stage moves --reds` exits 1 with
**four rules reporting *"the anchor matched 0 time(s)"*** — `move/boosts-self`,
`move/needs-a-stat-stage-to-act-on`, `move/needs-a-berry-already-eaten` and `move/status-inflict`.
An unapplied plant reads exactly like a comparator that found nothing, so those four rules' greens
were vacuous.

**It reproduces identically on `ab22bc503717`, the published engine** — same four rules, same exit
code — which is how it was established that this pass did not cause it. It is invisible unless
`--reds` is passed, and batch G's roster run reported `0 / 0 on all three` without it.

Two separate causes:

1. **LINE ENDINGS, FOR THE FOURTH TIME IN THIS REPOSITORY.** `engine/medicham2-browser.js` is **CRLF
   on disk — all 41,819 lines**, in the working tree and in every frozen release copy, because
   `core.autocrlf` is `true` here. An anchor written in `tests/roster.js` carries a bare `\n`, so any
   anchor spanning two lines can never be found. **Two of the four carry a comment saying they were
   re-aimed for exactly this on 2026-09-04, on the finding that the engine "is LF in this working
   tree"** — true of that checkout, false of this one. Fixed **at the read** (`mediSource()`, one
   function, three callers) and not in the anchors, exactly as `docs_scan.js`'s `stripCR` was, because
   an anchor tuned to one checkout's line endings is a coin flip on the next. Checked rather than
   assumed: no anchor in the file contains a carriage return — the only three CRs in `tests/roster.js`
   are inside comments.
2. **A SIGNATURE CHANGE FROM 5.267.0.** `move/status-inflict`'s anchor named
   `function applyStatus(t,st,src,eff,why){`; batch G's sleep-timer fix gave `applyStatus` a sixth
   parameter (`dstream`), so the anchor has matched zero times ever since. That is the **second** time
   in six weeks a signature change blinded this one rule, so it has been re-aimed **off the parameter
   list entirely** — it now names the declaration's opening and plants a stub in front of it, and a
   seventh parameter arrives without touching the line.

After both: `--reds` on all three stages, **0 NOT CAUGHT, exit 0**, and the `deliberate roster /
moves` gate clause is green again.

---

## WHAT IS OWED, NAMED AND NOT FIXED

- **`omit-weather t3 …bo3-2658828809` is a DICE-ADDRESS collision, not a missing Cursed Body wire, and
  that is MEASURED.** The whole-game `any` address logs are `sd=5 me=5 shared=4`, and the one
  unshared pair is `ONLY SD 20260813|3|any|hypervoice|p11|0` against `ONLY ME
  20260813|3|any|hypervoice|p10|0` — **the same turn, the same category, the same move, a different
  SLOT**. Both engines drew one die for Cursed Body's `randomChance(3, 10)` off a Hyper Voice that hit
  two bodies, and addressed it to different targets, so they got different numbers and one Disable
  landed. `volDurationApplied +0` on the replay. It is the same family as the freeze card and the
  repair is in the address, not in WIRE 52 — filed, not guessed at.
- **A non-Ghost Curse into a Pressure foe is OVER-charged by 1 PP.** Derived, printed on every run of
  `tests/probe_pressure_terrain_target.js`, and deliberately not folded into the terrain answer. See
  fix 2.
- **The remaining 18, bucketed on `state.first_board_divergences`** (the list the bar actually reads,
  not `by_cause`): eleven are HP-only or HP-plus-faint (damage magnitude or a turn order that changes
  who is alive), three are a STATUS one engine applied and the other did not (`brn` twice ours, `psn`
  once theirs — the last is a `poisontouch` card), one is a type-resist berry this engine does not
  eat (`p1.party.grimmsnarl.item` `roseliberry` / `""`), one is the Cursed Body address above, one is
  a mega that happened here and not there (`p1.active[1].species` `incineroar` / `raichumegay`), and
  one is a bare PP leaf (`p1.pp[0].hypervoice` medi 3 spent / sd 2).
- **Champions' `-end` label for Disable.** This engine writes `|-end|p2b: Farigiraf|move: disable`
  where the authority writes `|-end|p2b: Farigiraf|Disable`. The normaliser collapses it, so it costs
  nothing today; it belongs to the narration gate.
- `data/game-differential.json`, `data/engine-diff.json`, the three roster stages,
  `data/all-mechanics-fire.json` and `data/mechanics-census.json` were all re-run on the final release
  `1fc8ed7adfd7` rather than left reading `MEASURED AGAINST A DIFFERENT ENGINE`.

**Not touched:** `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js`,
`engine/game_differential.js`, `engine/diff_swarm.js`, `engine/steering.js`. No fit and no self-play
run. `engine/status.js --write` was NOT run and no `<!-- GENERATED -->` block was hand-edited.
