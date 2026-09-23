# Reg M-C engine pass 6: the seven 1950 cards

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.53.0 onward. **Status.** Findings record, historical by
construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-ad2484c69b7a6f0cd`, base `7d220591` (abra/regmc 0.53.0) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`, selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher in the session scratchpad |

**The pinned Reg M-C differential**, every reading below:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-f3b70bc0c47c.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games <1200|1350|1950> --write --out <scratch>
```

State bar = `state.games - state.games_board_never_diverged`. A fresh `--release` per engine change. A card is replayed
alone with `--only-game "<config> <seed tag>"` (a bare seed matched three configs) and `--only-game-out`.

**The Reg M-B check**, every commit: `data/tags.json`, `data/protocol-events.json`, `data/move-effects.js` byte-identical to
HEAD (`git diff --quiet`); lattice `--steering empirical --arm middle --end-state --census <copy of HEAD's
data/mechanics-census.json> --team-store <main>/data/team-pool-frozen --games N` on a Reg M-B release cut from the commit's
tree, `SHOWDOWN_PATH` the M-B checkout. 1200 after every fix; 1200/1350/1950 at the end. The tracked M-B pointer
`data/engine-release.json` is moved by each M-B cut and restored from HEAD before every commit.

---

## 0. The baseline (re-read on the current tree)

Release **`eec3a9b0e36a`** (cut from the 0.53.0 tree in this worktree; pass 5's `cd3eed0c5796` is the same engine on the
pre-merge tree). Artifacts generated 2026-09-22 22:57-23:00Z.

| `--games` | games | board-material | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 954 | **0** | 1 | 67 |
| 1350 | 1075 | **0** | 0 | 73 |
| 1950 | 1537 | **7** | 0 | 116 |

The same readings and the same seven cards as pass 5's §6.

---

## 1. Milk Drink heals the one body it is aimed at (abra/regmc 0.54.0)

### The card (1950, `pair-redirect-priority …bo3-2684290289`, turn 3)

```
|move|p2b: Gogoat|Milk Drink|p2b: Gogoat
showdown   |-heal|p2b: Gogoat|198/198
medicham2  |-heal|p2a: Toxapex|125/125   |-heal|p2b: Gogoat|198/198
```

### The authority, read whole

- `data/mods/champions/moves.ts` milkdrink :646-649: `inherit: true, target: "adjacentAllyOrSelf"`. The Reg M-B checkout's
  mod marks the move `isNonstandard: "Past"` (:636-639): an M-C-only row.
- `sim/battle-actions.ts` runMoveEffects :1201-1209 (the Champions `spreadMoveHit` calls it, `scripts.ts` :375):
  `if (moveData.heal && !target.fainted) { … const amount = target.baseMaxhp * moveData.heal[0] / moveData.heal[1]; …}`
  -- per TARGET. `adjacentAllyOrSelf` names one body; `allies` (Life Dew) resolves to both.

### The defect

`healParam` returned `allies: Array.isArray(healsAlly.heal)`: the tag's presence meant "heal both". `healsAlly` admits
five friendly classes (`engine/tag_dex.js` :4911-4922). Membership over both tag files, printed: Reg M-B `healpulse`
(`any`, `heal: true`), `lifedew` (`allies`, `[1,4]`); Reg M-C the same plus `milkdrink` (`adjacentAllyOrSelf`, `[1,2]`).

### Fix

`healParam` reads `targetClass`: `allies` spreads, any other class returns `aimed`. `playerAction` carries the click's
target for an aimed heal; the resolution heals the partner when the click named it and it stands (with Life Dew's per-body
TryHit refusal), else the user. `MEDSEEN.aimedHealOneBody`, `aimedHealOnPartner`. Knob `MEDI_AIMED_HEAL_SPREADS`. No tag
moved. **The partner road is not staged**: the scripted encoder (`engine/game_differential.js` `scripted`) aims every
`adjacentAllyOrSelf` click at its user (`target = -(i + 1)`).

### Probe -- `tests/probe_regmc_milk_drink_target.js --regulation regmc`

Cast derived: Gogoat (the one legal Milk Drink user; Sap Sipper, so the foe's moves are kept off Grass), Toxapex partner,
Garganacl's Power Gem into both; the DEW control is Goodra's Life Dew.

| arm | staged | authority |
|---|---|---|
| DRINK | t1/t2 both bodies hit, t3 Milk Drink | `-heal|p1a: Gogoat|198/198` alone |
| DEW | the same with Life Dew | `-heal` on both |

| run | exit | red |
|---|---|---|
| release `eec3a9b0e36a` + the 0.53.0 engine bytes | **1** | DRINK (the partner's `-heal`, boards) |
| clean, release `6397666428ff` | **0** | none; `aimedHealOneBody` 1 in DRINK, 0 in DEW |
| `MEDI_AIMED_HEAL_SPREADS=1` | **1** | DRINK |

7 staged sets, 0 illegal.

### Pinned Reg M-C differential (release `6397666428ff`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 67 |
| 1350 | 0 / 1075 | **0 / 1075** | 0 | 73 |
| 1950 | 7 / 1537 | **6 / 1537** | 0 | 116 → 115 |

Left: `…2684290289`. Joined: none.

### Reg M-B

Life Dew is Reg M-B's only pair-sized `healsAlly` member and it is `allies`, so Reg M-B behaviour is unchanged. Data files
byte-identical. Lattice 1200 on release `bcbe61fc53b9`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 2. A weather a mega evolution raises turns a standing Castform at once (abra/regmc 0.55.0)

### The card (1950, `omit-intimidate …bo3-2681789845`, turn 1)

```
|-weather|Snowscape|[from] ability: Snow Warning|[of] p2a: Froslass
showdown   |-formechange|p2b: Castform|Castform-Snowy|[msg]|[from] ability: Forecast
medicham2  |detailschange|p1a: Beedrill|beedrill-mega, L50        (no forme change)
... Castform's Blizzard: showdown Beedrill 95/140, Armarouge 139/160; here 110/140, 146/160 (a Normal-type Castform's)
```

### The authority, read whole

- `sim/field.ts` setWeather :39-88 (both checkouts): ends `this.battle.eachEvent('WeatherChange', sourceEffect)` -- every
  active body.
- `data/mods/champions/abilities.ts` forecast :1470-1500: `onWeatherChange` formeChanges a (not transformed) Castform off
  `effectiveWeather()`; `hail` and `snowscape` both give Castform-Snowy.
- A mega evolution runs the mega forme's ability Start inside the evolution, so the weather and the forme change both land
  above the next mega of the turn (the card shows exactly that order).

### The defect

`megaEvolveNow` calls `applyEntryEffects` (which sets the weather off `weatherSetter`) and resyncs the aura, the weather
suppression and the sleep refusal, but not the field-followers. The switch road (`applyEntryEffects` at a refill) ends in
`syncFieldTypes` over the actives; `abilityStarted` ends in it for the one body. The mega door was the gap.

### Fix

`syncFieldTypes(S.field, actives)` at the end of `megaEvolveNow`, after `recomputeWeatherSuppression` (for the entry road's
reason: `effWeatherOf` reads `field.wSup` first). Idempotent. `MEDSEEN.megaWeatherFormeSynced`. Knob
`MEDI_MEGA_WEATHER_NO_FORME_SYNC`. No tag moved.

### Probe -- `tests/probe_regmc_mega_weather_forecast.js --regulation regmc`

Cast derived: the legal megas whose forme ability sets weather (Charizard-Mega-Y, Tyranitar-Mega, Abomasnow-Mega,
Froslass-Mega); the first to stage is Charizard-Mega-Y (Drought) beside Castform. The probe does not stage the snow case
itself; the 1950 card is its measurement.

| arm | staged | authority |
|---|---|---|
| MEGA | t1 Charizard megas (Protect) beside Castform | `-weather|SunnyDay|[from] ability: Drought`, then `-formechange|p1b: Castform|Castform-Sunny` |
| PLAIN | the same, no mega | no weather, no forme change |

| run | exit | red |
|---|---|---|
| release `6397666428ff` + the 0.54.0 engine bytes | **1** | MEGA (line and boards: species, types) |
| clean, release `b272aada45c2` | **0** | none; one sync that retyped in MEGA, none in PLAIN |
| `MEDI_MEGA_WEATHER_NO_FORME_SYNC=1` | **1** | MEGA |

6 staged sets, 0 illegal.

### Pinned Reg M-C differential (release `b272aada45c2`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 67 |
| 1350 | 0 / 1075 | **0 / 1075** | 0 | 73 |
| 1950 | 6 / 1537 | **5 / 1537** | 0 | 115 → 114 |

Left: `…2681789845`. Joined: none.

### Reg M-B

Shared rule (Forecast and Charizard-Mega-Y / Tyranitar-Mega are Reg M-B legal; the same `setWeather`). Data files
byte-identical. Lattice 1200 on release `a1fbee64c5bf`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 3. Protean converts its user before Psychic Terrain refuses the priority move (abra/regmc 0.56.0)

### The card (1950, `omit-spread …bo3-2681855173`, turn 1)

```
|move|p2a: Greninja|Water Shuriken|p1a: Indeedee
showdown   |-start|p2a: Greninja|typechange|Water|[from] ability: Protean
           |-activate|p1a: Indeedee|move: Psychic Terrain
medicham2  |-activate|p1a: Indeedee|move: psychicterrain         (Greninja stays Water/Dark)
```

### The authority, read whole

- `sim/battle-actions.ts` trySpreadMoveHit :549-612 (the Champions `scripts.ts` does not override it): `singleEvent('Try')`
  then `singleEvent('PrepareHit')` and `runEvent('PrepareHit')` (:590-592), and only then the step list; step 1 is
  `hitStepTryHitEvent`.
- `data/abilities.ts` protean :3497-3507 (not in the Champions mod): `onPrepareHit` sets the type and writes the `-start`.
- `data/moves.ts` psychicterrain.condition.onTryHit :14114-14128: a `TryHit` handler.

### The defect

The attack path's terrain gate (NARRATION 2026-09-10, moved to the `TryHit` position for Sucker Punch's `Try`) still sits
above target resolution, and the attack path's `proteanConvert` is below it, at the `PrepareHit` position for every
other road. A priority move the terrain refused `continue`d past the conversion.

### Fix

In the gate's refusal branch, `proteanConvert(m, move)` before the terrain's line (a refusal there always names a target,
so the authority's `targets.length` test has passed; `proteanConvert` carries the once-per-switch-in and move guards).
`MEDSEEN.proteanBeforeTerrainBar`. Knob `MEDI_TERRAIN_BAR_BEFORE_PREPAREHIT`. No tag moved.

### Probe -- `tests/probe_regmc_protean_before_terrain.js --regulation regmc`

Cast derived: the legal `PrepareHit` type-changers (Libero, Protean) and their carriers (Greninja, Cinderace,
Meowscarada); Greninja's Water Shuriken, Galarian Slowking's Psychic Terrain, Toxapex the grounded target. Greninja starts
on the bench and switches in on turn 1, so turn 2's move is its first of the stint (a first draft let it Protect on turn
1, which spent the once-per-switch-in conversion on Protect and tested nothing -- caught on its own output).

| arm | staged | authority |
|---|---|---|
| TERRAIN | t1 Greninja in, Psychic Terrain up; t2 Water Shuriken into Toxapex | `-start|p1a: Greninja|typechange|Water`, then `-activate|p2a: Toxapex|move: Psychic Terrain` |
| OPEN | t1 Protect in place of the terrain | the conversion and the hits |

| run | exit | red |
|---|---|---|
| release `b272aada45c2` + the 0.55.0 engine bytes | **1** | TERRAIN (line and boards: Greninja's types) |
| clean, release `f2e0e5560692` | **0** | none; one conversion per arm, the TERRAIN one ahead of the refusal |
| `MEDI_TERRAIN_BAR_BEFORE_PREPAREHIT=1` | **1** | TERRAIN |

6 staged sets, 0 illegal. Seen in passing, not asserted: this engine writes `-fieldstart|move: Psychic Terrain|[of] p1b:
Slowking` where the authority (a move-set terrain) writes no `[of]` -- narration, no board.

### Pinned Reg M-C differential (release `f2e0e5560692`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 67 |
| 1350 | 0 / 1075 | **0 / 1075** | 0 | 73 |
| 1950 | 5 / 1537 | **4 / 1537** | 0 | 114 → 113 |

Left: `…2681855173`. Joined: none.

### Reg M-B

Shared rule. Data files byte-identical. Lattice 1200 on release `bc918a21928d`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 4. Double Shock and Burn Up spend their user's type above the contact tolls (abra/regmc 0.57.0)

### The card (1950, `omit-spread …bo3-2678871998`, turn 8)

```
|move|p1a: Pawmot|Double Shock|p2b: Indeedee          (Indeedee's Follow Me)
|-damage|p2b: Indeedee|0 fnt
showdown   |-start|p1a: Pawmot|typechange|???/Fighting|[from] move: Double Shock
           |-damage|p1a: Pawmot|0 fnt|[from] item: Rocky Helmet|[of] p2b: Indeedee
           |faint|p2b: Indeedee   |faint|p1a: Pawmot                     -> the corpse reads Electric/Fighting
medicham2  |-damage|p1a: Pawmot|0 fnt|[from] item: Rocky Helmet ...  |faint| |faint|
           |-start|p1a: Pawmot|typechange|???/Fighting                    -> the corpse reads ???/Fighting
```

### The authority, read whole

- `data/moves.ts` doubleshock :3945-3969: `self: { onHit(pokemon) { pokemon.setType(...'???'...); this.add('-start', ...) } }`;
  the Champions mod adds only a `punch` flag (`data/mods/champions/moves.ts` :254-257). Burn Up is the same shape.
- `data/mods/champions/scripts.ts` spreadMoveHit :315-426 (the same in the Reg M-B checkout): step 3 `runMoveEffects`,
  step 4 `selfDrops` (the `self` block), step 5 secondaries, THEN `runEvent('DamagingHit')` -- the tolls. The faints are
  written later by `faintMessages`, whose `clearVolatile` rebuilds the corpse's types.

### The defect

The engine paid the spend at the bottom of the attack branch (ROADMAP #210, "a `self: { onHit }` -- it runs only when the
move actually CONNECTED"): right gate, wrong position, below `_stepDamagingHit*` and `_stepFaint`. The faint's type rebuild
(`typesRestoredOnFaint`) had already run, so the late spend stuck to the corpse.

### Fix

The spend moved into `_stepSelfPay` (the step-list slot the file already names as `selfDrops`), with the same gate
(`connected`, the type still held) and the same line. `MEDSEEN.ownTypeSpentAtSelfDrops`. Knob `MEDI_SPEND_TYPE_AFTER_MOVE`
(the old site runs only under it). No tag moved.

### Probe -- `tests/probe_regmc_spend_type_before_toll.js --regulation regmc`

Cast derived: the legal moves whose `self.onHit` sets the user's type (Burn Up, Double Shock -- only Double Shock makes
contact, so Burn Up meets no contact toll: a first draft staged Burn Up and saw no toll at all); its one legal user, Pawmot;
the contact-toll abilities (Iron Barbs, Rough Skin) and item (Rocky Helmet); Sharpedo (Rough Skin) @ Rocky Helmet. The
FAINTS arm finds the lowering by playing it: the first of Sharpedo's plain moves that leaves Pawmot inside the two tolls'
reach (Night Slash twice, 145 → 31).

| arm | staged | authority |
|---|---|---|
| FAINTS | t1-t2 Night Slash ×2 into Pawmot; t3 Double Shock KOs Sharpedo | `typechange|???/Fighting`, Rough Skin 13/145, Rocky Helmet `0 fnt`, `faint` ×2 |
| STANDS | Sharpedo idles (Agility) instead | the same order; Pawmot survives at 103/145 |

| run | exit | red |
|---|---|---|
| release `f2e0e5560692` + the 0.56.0 engine bytes | **1** | FAINTS (line order and boards: `pawmot.types`), STANDS (line order) |
| clean, release `1d5008367277` | **0** | none; one spend per arm, each at `selfDrops` |
| `MEDI_SPEND_TYPE_AFTER_MOVE=1` | **1** | FAINTS, STANDS |

7 staged sets, 0 illegal. `tests/probe_regmc_typeless_stab.js` (pass 4's Double Shock / Burn Up probe) stays green on the
new bytes. Seen in passing: with Focus Energy as the foe's idle, the authority writes `-fail` on its second use and this
engine writes nothing -- narration, no board; the probe idles on a self boost instead.

### Pinned Reg M-C differential (release `1d5008367277`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 67 → 64 |
| 1350 | 0 / 1075 | **0 / 1075** | 0 | 73 → 72 |
| 1950 | 4 / 1537 | **3 / 1537** | 0 | 113 → 99 |

Left: `…2678871998`. Joined: none. The protocol-only counts fell in all three lattices: the same line order on users that
survive the toll.

### Reg M-B

Shared rule (Double Shock and Burn Up are Reg M-B legal). Data files byte-identical. Lattice 1200 on release
`1ad6fd553b23`: **0 of 961**, 0 void, 0 protocol-diverged.
