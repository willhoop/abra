# Reg M-C engine pass 4: the last four pinned board-material games

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.44.0 onward. **Status.** Findings record, historical by
construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a4f8af6cc4d0a155a`, base `b5943965` (abra/regmc 0.44.0) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc`, selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher (`data/_scratch-eng-a4f8/run.js`, git-ignored) |

**The pinned Reg M-C differential**, every reading below:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-f3b70bc0c47c.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games 1200 --write --out <scratch> --dump-games 2000 --dump-out <scratch dump>
```

`--games 1200`, arm `middle`, steering `empirical`, `--end-state`, census pin `f3b70bc0c47c`, pool = the MAIN checkout's
`data/team-pool-frozen-regmc`. State bar = `state.games - state.games_board_never_diverged`. A fresh `--release` per
engine change.

**The Reg M-B check**, every commit: `git diff --quiet HEAD` on `data/protocol-events.json` and `data/move-effects.js`
(and on `data/tags.json`, except the Ice Spinner rows allowed for §1); lattices `--steering empirical --arm middle
--end-state --census <copy of HEAD's data/mechanics-census.json> --team-store <main>/data/team-pool-frozen --games N`
on a Reg M-B release cut from the commit's tree, `SHOWDOWN_PATH` the M-B checkout.

---

## 0. The baseline

Release **`1f475312c778`** (a re-cut of the 0.44.0 tree gives the 0.44.0 id). Artifact generated
`2026-09-22T19:39:53Z`: **4 of 954** board-material, 1 void. Confirmed.

| game | first board divergence |
|---|---|
| `baseline …bo3-2678759068` | turn 9, `field.terrain grassy/''`, `field.terrain_turns 3/0`, Sinistcha-Masterpiece HP 116/107 |
| `omit-weather …-2680535928` | turn 9, `p2.pp[1].expandingforce 2/3` |
| `omit-intimidate …bo3-2681842922` | turn 1, `gardevoir.ability drought/chlorophyll` |
| `pair-protect-bust …bo3-2680957904` | turn 7, `kingambit.hp 23/36` |

---

## 1. Ice Spinner (abra/regmc 0.45.0)

### The authority, read whole

- M-C checkout `data/moves.ts` icespinner :9417-9437 (the Champions mod names it only in learnsets):
  `onAfterHit(target, source) { this.field.clearTerrain(); }`,
  `onAfterSubDamage(damage, target, source) { if (source.hp) this.field.clearTerrain(); }`. The Reg M-B checkout
  carries the identical pair.
- `sim/battle-actions.ts` :1113-1127 (spreadMoveHit): `DamagingHit` first, then
  `if (moveData.onAfterHit && pokemon.hp) for (const t of damagedTargets) singleEvent('AfterHit', …)` -- above
  `faintMessages`, so a user a contact toll just knocked out clears nothing.
- `sim/field.ts` clearTerrain :159-167: no-op with no terrain; else the terrain's `FieldEnd` (`-fieldend|move: <T>`),
  `terrain = ''`, `eachEvent('TerrainChange')`.

### The defect

No tag carried it. `failsWithoutTerrain` (Steel Roller, WIRE 88) matches `isTerrain("")` in `onTry` and reads the
clear off `onHit`/`onAfterSubDamage`; Ice Spinner has no `onTry`. The engine left the terrain standing: the baseline
game parted at turn 9 on `field.terrain grassy/''` and the residual Grassy heal it then paid.

### Tag, membership printed before wiring (`data/_scratch-eng-a4f8/member-ice.js`)

Every legal move whose handlers call `clearTerrain()`, both checkouts:

```
regmc defog      Status   onHit                       (removesHazards.clearsTerrain)
regmc icespinner Physical onAfterHit,onAfterSubDamage (no tag)       learners 21
regmc steelroller Physical onHit,onAfterSubDamage     (failsWithoutTerrain.clears)
regmb defog / icespinner (learners 20) / steelroller  the same
```

`clearsTerrainAfterHit` reads `onAfterHit` only: `{ throughSubstitute, subNeedsUserHP, onlyOnConnect: true }`. Ice
Spinner alone matches, in both regulations.

### The tag files -- the only rows that moved

Both tag files regenerated to scratch (Reg M-B with `SHOWDOWN_PATH` the M-B checkout; the worktree has no store, so its
usage counts read 0 and were not taken), structural diff (tags + params per entity, descriptors less usage):

```
moves icespinner   + clearsTerrainAfterHit {"throughSubstitute":true,"subNeedsUserHP":true,"onlyOnConnect":true}
descriptor move:clearsTerrainAfterHit ADDED
(churn not taken: the allyBasePowerBoost descriptor's prose; in Reg M-B, the descriptors of ten tags with no Reg M-B member (revivesFainted … reversesHeal) the
 committed Reg M-B file does not carry; generated / sheet_entries / linkage)
```

Spliced by `data/_scratch-eng-a4f8/splice.js`: the row's `tags`/`params` only (its `uses` stays the committed 301 in
Reg M-B, 160 in Reg M-C) and the descriptor with `n`/`uses`/`examples` recomputed from the committed rows. Re-diffed
against the committed files: exactly the two lines above, in each. `git diff --stat`: 19 lines each in `data/tags.json`,
`data/tags-regmc.json`, `data/abra-tags.js` (rebuilt; `--check` passes). `data/protocol-events.json` and
`data/move-effects.js` byte-identical.

### Engine

`_afterHitField` (the step holding the other two `onAfterHit` families): when the move carries the tag, the hit
connected, the user has not fainted and (`throughSubstitute` or no Substitute ate it) -- clear the terrain the way
Steel Roller's clear does (`terrain=''`, `terrainT=0`, `TR.terrainEnd`, `syncFieldTypes`). `MEDSEEN.terrainClearedAfterHit`
/ `terrainClearAfterHitNoTerrain`. Knob `MEDI_AFTERHIT_TERRAIN_INERT`.

### Probe -- `tests/probe_regmc_ice_spinner.js --regulation regmc`

Cast derived on the run: Hisuian Goodra (Ice Spinner), Stunfisk (Electric Terrain on turn 1), Corviknight (target; takes
Ice neutrally or resisted, learns Substitute).

| arm | staged | authority |
|---|---|---|
| CLEAR | t1 Electric Terrain; t2 Ice Spinner | `-damage|p2a: Corviknight|129/173`, then `-fieldend|move: Electric Terrain` |
| SUB | the same, Corviknight behind a Substitute made on t1 | `-end|…|Substitute`, then `-fieldend` |
| NONE | no terrain | no `-fieldend` |
| CONTROL | t2 Dragon Claw in place of Ice Spinner | terrain stays |

The probe compares `-fieldend` lines: the terrain move's `-fieldstart` carries `[of] <setter>` here and not on the
authority, a spelling the driver's alignment folds (each arm reads no protocol divergence) and not this mechanic.

| run | exit | red |
|---|---|---|
| release `1f475312c778` + the 0.44.0 engine bytes | **1** | CLEAR, SUB (lines and boards) |
| clean, release `d0e34207d250` | **0** | none; counters: one clear in CLEAR and SUB, a no-terrain answer in NONE, none in CONTROL |
| `MEDI_AFTERHIT_TERRAIN_INERT=1` | **1** | CLEAR, SUB (lines and boards) |

7 staged sets, 0 illegal under the Reg M-C `TeamValidator`.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.44.0 | `1f475312c778` | 4 / 954 | 1 |
| 0.45.0 | `d0e34207d250` | **3 / 954** | 1 |

Left: `…2678759068`. Joined: none.

### Reg M-B

Release `a193df3c8301`:

| `--games` | games | board-material | void | protocol-only |
|---|---|---|---|---|
| 1200 | 961 | **0** | 0 | 0 |
| 1350 | 1069 | **0** | 0 | 1 |
| 1950 | 1497 | **0** | 0 | 2 |

The three protocol-only divergences are one class: the authority's `-end|<Kingambit>|fallenundefined|[silent]` where
this engine writes its next line (a Supreme Overlord volatile ending silently). No game in either dump contains Ice
Spinner. 1350 and 1950 had no Reg M-B reading before this pass, so "unmoved" is not claimed for their protocol column;
the board column is zero.

---

## 2. `--only-game`: replaying one game (abra/regmc 0.45.1, instrument)

### What it does

`node engine/game_differential.js <pins> --only-game <selector> [--only-game-out <file>]`. The selector is a substring of
`<config> <seed tag>` or `#<n>`; it must match exactly one game of the arm (exit 2 otherwise, listing the matches). The
fixed-count loop is walked as usual; every game before the selected one is PLAYED; the selected one is played with a
boundary hook and a capture of both engines' middle-arm dice addresses (taken before `midGameVoid` clears them); then
the run dumps and exits -- before the report, the `--write` block and `--dump-games`. Dump: both streams split at
`|turn|`, both boards and `diffs` at every boundary, first protocol / board divergence, `mid_void`, the raw medicham2
trace and `trace_digest` (the same digest `MEDI_SAMPLE_DUMP` writes). `--until-covered` is refused.

### Why the prior games are played (measured, not assumed)

The first cut skipped them. Game #293 (`omit-weather …-2680535928`) then replayed with `trace 52894578ae03` against the
full run's `0cf9b007b711` (`MEDI_SAMPLE_DUMP`); a `MEDI_TRACE_DUMP` run located the split at medicham2 trace line 38:
Tyrantrum's Psychic Fangs in the full run, Fire Fang in the replay. The empirical driver's `empiricalPick` returns
`coveragePick(moves)` when `EMP.rowFor` finds no prior row or `EMP.drawMove` returns nothing, and `coveragePick` sorts on
`want` and `clicks` -- `COV_CREDIT` and `CLICKS`, which `driverReset` clears per ARM, not per game. So a game's clicks
depend on the games before it. **For MEASURE:** under `--steering empirical` the games of a run are not independent,
so the same pair played at a different position in the order (for instance under a different `--games`) can be a
different game.

### Receipts

| replay | index | `trace_digest` replay | full run (`MEDI_SAMPLE_DUMP`) |
|---|---|---|---|
| `…2680535928` | #293 | `0cf9b007b711` | `0cf9b007b711` |
| `…2681842922` | #368 | `e668bbd18ba5` | `e668bbd18ba5` |
| `…2680957904` | #630 | `f1e685fd8783` | `f1e685fd8783` |

Identity without the flag (release `d0e34207d250`, same pins, final instrument bytes): `state` identical,
`first_divergences` identical; top-level fields that differ: `generated`, `elapsed_s`, `steering` (only
`steering.driver_code`, the digest of the driver file itself); the `--dump-games` file differs only in `generated` and
`by` (its own output path). Checked twice, on the intermediate and the final bytes.

---

## 3. Grass Pelt -- the "Dire Claw damage difference" (abra/regmc 0.46.0)

### The replay (`--only-game 2680535928`, release `d0e34207d250`, game #293)

Boards identical through turn 8. Board at the turn-8 boundary, both engines: field `grassy`, 4 turns left (Rillaboom's
Grassy Surge with a Terrain Extender); Gogoat 198/198, ability Grass Pelt, no item, no boosts; Sneasler 30/155, ability
Unburden, no item, `def -1 / spd -1`. Turn 9: Sneasler's Dire Claw (super effective) into Gogoat --
`-damage|p1b: Gogoat|46/198` on the authority (152), `0 fnt` here. The board parts on Armarouge's Expanding Force PP,
which the authority spends on the Gogoat still standing.

### The authority, read whole

`data/abilities.ts` grasspelt :1697-1706: `onModifyDefPriority: 6`, `onModifyDef(pokemon) { if
(this.field.isTerrain('grassyterrain')) return this.chainModify(1.5); }`, `flags: { breakable: 1 }`. Not in the Champions
mod. `isTerrain` with no target reads `effectiveTerrain` (`runEvent('TryTerrain')`; no legal `onTryTerrain` in either
checkout), so grounding is not asked. Dire Claw's Champions override (`data/mods/champions/moves.ts` :215) changes only
flags (adds `slicing`) and the secondary chance (30).

### The defect

`condStatMult` (`engine/tag_dex.js`) admitted `when: 'always'` and `when: 'statused'` and refused everything else; its
own comment named Grass Pelt as the refusal ("a real gap and it is left open rather than guessed at"). No Reg M-B species
carries Grass Pelt, so the refusal was free there. The engine's reader (`dmgRangeOneHit`, WIRE 112) already named Grass
Pelt as "the condition this engine will meet next".

### Membership, printed before wiring (`data/_scratch-eng-a4f8/member-pelt.js`)

```
regmc furcoat     onModifyDef  carriers=persianalola,furfrou | return this.chainModify(2)
regmc grasspelt   onModifyDef  carriers=gogoat              | if (this.field.isTerrain("grassyterrain")) return this.chainModify(1.5)
regmc marvelscale onModifyDef  carriers=milotic             | if (pokemon.status) { return this.chainModify(1.5); }
regmb furcoat / grasspelt (carriers=none) / marvelscale      the same handlers
```

The new branch admits a handler whose ONE `if` is `this.field.isTerrain("<id>")` around the `chainModify`: Grass Pelt
alone. Tag files regenerated to scratch and diffed: Reg M-C, one row (`grasspelt` gains `condStatMult {stat: def, mult:
1.5, when: terrain, terrain: grassyterrain}`), spliced alone; Reg M-B, no rule change (no row is written for an ability
with no legal carrier). `data/tags.json`, `data/abra-tags.js`, `data/protocol-events.json`, `data/move-effects.js`
byte-identical.

### Engine

The `condStatMult` reader: `when: 'terrain'` -> `terrainId(field.terrain) === terrainId(p.terrain)`; paid through the
same `DCH` spend (`MEDSEEN.terrainStatMultPaid`). Mold Breaker still reads `defAb`. Knob `MEDI_TERRAIN_STATMULT_INERT`.

### Probe -- `tests/probe_regmc_grass_pelt.js --regulation regmc`

Cast derived: Gogoat (the only holder), Torterra (Grassy Terrain, t1), Garchomp (Shadow Claw physical, Power Gem
special; both plain, neither Grass). The holder's turn-2 click is Growth (no idle move in its learnset; a self boost that
touches neither defence).

| arm | staged | authority (Gogoat HP after the hit) |
|---|---|---|
| PELT | Grassy Terrain t1, Shadow Claw t2 | 139/198 |
| BARE | no terrain | 109/198 |
| SPECIAL | PELT with Power Gem | 153/198 (no multiplier on a special hit) |
| CONTROL | PELT, Gogoat on Sap Sipper | 109/198 |

| run | exit | red |
|---|---|---|
| release `d0e34207d250` + the 0.45.1 engine bytes | **1** | PELT (lines and boards) |
| clean, release `e16663e89997` | **0** | none; the multiplier paid in PELT only |
| `MEDI_TERRAIN_STATMULT_INERT=1` | **1** | PELT (lines and boards) |

8 staged sets, 0 illegal.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.45.1 | `d0e34207d250` | 3 / 954 | 1 |
| 0.46.0 | `e16663e89997` | **2 / 954** | 1 |

Left: `…2680535928`. Joined: none.

### Reg M-B

No behaviour can change (no carrier). Lattice 1200 on release `b6bcecf24b41`: 0 of 961, 0 void, 0 protocol.

---

## 4. `???` never takes STAB -- the "Kingambit HP gap after Double Shock" (abra/regmc 0.47.0)

### The replay (`--only-game 2680957904`, release `d0e34207d250`, game #630)

- Turn 2: Pawmot's Double Shock lands; `-start|p2b: Pawmot|typechange|???/Fighting|[from] move: doubleshock` (both).
- Turn 3: Pawmot's second Double Shock fails. Authority `-fail|p2b: Pawmot|move: Double Shock`, here `-fail|p2b: Pawmot`:
  the first PROTOCOL divergence, narration (no board leaf moves; boards identical through turn 6).
- Turn 4: Ditto enters and Imposter-transforms into Pawmot, copying `???/Fighting`.
- Turns 6-7: Ditto has no usable move and Struggles. Turn 7 into Kingambit (76/175 before):
  authority `-damage|p2a: Kingambit|49/175` (27), here `36/175` (40). Weather Ball then takes 13 on both. Board parts:
  `kingambit.hp 23/36`.

40/27 is the STAB ratio within rounding, so the question was which engine gives STAB to what.

### The authority, read whole

- `data/moves.ts` struggle :18211-18232: `onModifyMove(move, pokemon, target) { move.type = '???'; this.add('-activate',
  pokemon, 'move: Struggle'); }`, `struggleRecoil: true`, `target: "randomNormal"`; the Champions mod does not name it.
- `data/mods/champions/scripts.ts` :228-233 (Champions' own `modifyDamage`): `// The "???" type never gets STAB ... if
  (type !== '???') { let stab = 1; const isSTAB = move.forceSTAB || pokemon.hasType(type) || ...`. `sim/battle-actions.ts`
  :1757-1762 and the Reg M-B checkout's copy carry the same guard.

### The defect

`dmgRangeOneHit`'s one STAB line: `const stab = att.types.includes(mvT) ? … : 1`. `mvT` is `???` for Struggle
(`setsOwnTypeAlways`, ROADMAP #144 made that the priced type), and the user's types include `???` after
`spendsOwnType` or a Transform of such a body. Under the kit's pinned arm the SPENT arm reads 170→125 here against
170→140 on the authority -- the same x1.5.

### Fix

`const _typeless = mvT === '???' && !TYPELESS_STAB;` and the STAB branch requires `!_typeless`
(`MEDSEEN.typelessStabRefused` counts a refusal that mattered). The literal is the type name the authority tests, cited
above. No tag moved. Knob `MEDI_TYPELESS_STAB`.

### Probe -- `tests/probe_regmc_typeless_stab.js --regulation regmc`

Cast derived: the only mono-typed spender-learner in the regulation is Typhlosion (Burn Up); its turn-1 Burn Up goes
into its OWN partner (`ally: true`, a partner that resists Fire: Garganacl) so no foe is weakened; Galarian Slowking
Disables it on turn 2; turn 3 Typhlosion Struggles into Slowking at full HP.

| arm | authority | medicham2 (0.46.0 bytes / knob) | medicham2 (0.47.0) |
|---|---|---|---|
| SPENT (user `???`) | Slowking 170→140 | 170→125 | 170→140 |
| CONTROL (user Fire, never spent; Sunny Day its one move) | 170→140 | 170→140 | 170→140 |

SPENT's protocol parts first on turn 2 on the same `-fail|…|move: <Move>` attribute the Kingambit game carries; the probe
prints the protocol divergence and asserts the `-damage` lines and the boards.

| run | exit | red |
|---|---|---|
| release `e16663e89997` + the 0.46.0 engine bytes | **1** | SPENT (damage line and boards) |
| clean, release `d307909e1c39` | **0** | none; STAB refused in SPENT only |
| `MEDI_TYPELESS_STAB=1` | **1** | SPENT (damage line and boards) |

7 staged sets, 0 illegal.

### Pinned Reg M-C differential

| engine | release | state bar | void |
|---|---|---|---|
| 0.46.0 | `e16663e89997` | 2 / 954 | 1 |
| 0.47.0 | `d307909e1c39` | **1 / 954** | 1 |

Left: `…2680957904` (it stays in the dump as protocol-only, `-fail field 3`). Joined: none.

### Reg M-B

Shared rule; Burn Up is Reg M-B legal (Double Shock is `Past`). The four Reg M-B data files byte-identical; lattice 1200
on release `440b846e2aff`: 0 of 961, 0 void, 0 protocol.

---

## 5. The eject-door entrant's dice address -- the "Trace picks a different foe" card (abra/regmc 0.48.0)

### The replay (`--only-game 2681842922`, release `d0e34207d250`, game #368)

Turn 1: Venusaur's Leaf Storm takes Golisopod 150→16; `-activate|p1a: Golisopod|ability: Emergency Exit`; Venusaur's
Life Orb recoil; `|switch|p1a: Gardevoir`; then Trace. Up to that line the two streams agree. Gardevoir's foes are
Charizard-Mega-Y (Drought) and Venusaur (Chlorophyll); both engines' eligible lists are those two, in that order.
The captured dice addresses of turn 1, category `any` (the Trace pick is the only `any` draw of the turn on either side):

```
showdown   20260813|1|any|-|-|0              0.9706  -> index 1 -> Venusaur  -> Chlorophyll
medicham2  20260813|1|any|leafstorm|p10|0    0.2559  -> index 0 -> Charizard -> Drought
```

One die, two addresses. The authority drew with no active move; this engine drew with Leaf Storm still named.

### Classification

Not a rule difference in the pick: both engines draw one uniform index into the same list, and `traceCopy` already rolls
the authority's die, a draw even for a one-element list (its 2026-08-27 header). It is the address, i.e. which action the entry belongs to. That is the
exact class of 2026-09-20's pivot-entry fix (`pivotFrom`: "A PIVOT'S ENTRY IS A SEPARATE ACTION IN THE AUTHORITY, SO ITS
DRAWS CARRY NO MOVE"), which ENGINE made and which the middle arm's shared-die contract requires; it is fixed here the same
way rather than declared an instrument artifact, because the address is emitted by the engine and the authority's
sequencing (a new action) is a fact about the game.

### The authority, read whole

- `data/mods/champions/abilities.ts` emergencyexit :22-29: `onEmergencyExit(target) { if (!this.canSwitch(...) ||
  target.forceSwitchFlag || target.switchFlag) return; target.switchFlag = true; this.add('-activate', target, 'ability:
  Emergency Exit'); }`.
- `data/mods/champions/items.ts` ejectbutton :266-281: `onAfterMoveSecondary` ... `target.switchFlag = true; if
  (!target.useItem()) target.switchFlag = false;`.
- `sim/battle.ts` :2877-2911 (the tail of `runAction`): with any `switchFlag` raised, `BeforeSwitchOut`, then
  `makeRequest('switch'); return true;` -- the answer is a new `switch` action, after the move's action (and its
  `clearActiveMove`) has finished.

### Fix

`midAddrOwnAction()` -- save `MID_MOVE`/`MID_TGT`, set both to `-`, report whether they were stale, restore on demand --
lifted verbatim out of `pivotFrom` (which now calls it; its behaviour and counters are unchanged) and asked by the eject
door around its `switchOut` (`MEDSEEN.ejectEntryAddrCleared`). Red Card's drag is untouched: `pivotFrom`'s own header
records that a dragged entrant runs inside `moveHit`, where the authority's active move IS set. Knob
`MEDI_EJECT_ENTRY_MOVE_ADDR`.

### Probe -- `tests/probe_regmc_eject_entry_address.js --regulation regmc` (middle arm)

Cast derived: Gardevoir (the only Trace holder), Golisopod (the only Emergency Exit holder), Avalugg @ Eject Button,
Corviknight (U-turn, the control), foes Galarian Slowking (Curious Medicine; Power Gem is the hit) and Toxapex
(Merciless).

| arm | authority turn-1 `any` | medicham2 0.47.0 / knob | medicham2 0.48.0 |
|---|---|---|---|
| EE | `1|any|-|-|0` | `1|any|powergem|p10|0`, boards part | `1|any|-|-|0`, boards agree |
| EB | `1|any|-|-|0` | `1|any|powergem|p10|0`, boards part | `1|any|-|-|0`, boards agree |
| PIVOT (control) | `1|any|-|-|0` | `1|any|-|-|0` | `1|any|-|-|0` |

| run | exit | red |
|---|---|---|
| release `d307909e1c39` + the 0.47.0 engine bytes | **1** | EE, EB (address and boards); PIVOT green |
| clean, release `4868967b4a91` | **0** | none; one stale address cleared in EE and in EB, the pivot road's own counter in PIVOT |
| `MEDI_EJECT_ENTRY_MOVE_ADDR=1` | **1** | EE, EB; PIVOT green |

29 staged sets across the cast search, 0 illegal.

### Pinned Reg M-C differential

| engine | release | state bar | void | protocol-only |
|---|---|---|---|---|
| 0.47.0 | `d307909e1c39` | 1 / 954 | 1 | 71 |
| 0.48.0 | `4868967b4a91` | **0 / 954** | 1 | 70 |

Left: `…2681842922`. Joined: none.

### Reg M-B

No carrier of either door (Eject Button `Past`, no Emergency Exit species); the pivot road is the same code. The four
Reg M-B data files byte-identical.

---

## 6. Where the line stands after this pass

### The four cards

| card | cause | commit | pinned M-C 1200 after |
|---|---|---|---|
| Ice Spinner not clearing terrain | no tag for `onAfterHit` `clearTerrain()` (both regulations) | 0.45.0 | 3 / 954 |
| Dire Claw damage difference | Grass Pelt's terrain-gated Def x1.5 refused by `condStatMult` (M-C only) | 0.46.0 | 2 / 954 |
| Kingambit HP gap after Double Shock | STAB given to a `???` Struggle from a `???` body (both regulations) | 0.47.0 | 1 / 954 |
| Trace copying a different foe | eject-door entrant's dice addressed to the move (M-C only; `pivotFrom`'s class) | 0.48.0 | **0 / 954** |

None was an exact speed tie, an instrument artifact or narration-by-measurement. The Trace card came closest: its
difference is a shared-die address, not a rule, and it is fixed on the precedent of `pivotFrom` (§5, "Classification").

### Reg M-B on the final tree (release `8cf0c6f5bc19`, `SHOWDOWN_PATH` the M-B checkout)

| `--games` | games | board-material | void | protocol-only |
|---|---|---|---|---|
| 1200 | 961 | **0** | 0 | 0 |
| 1350 | 1069 | **0** | 0 | 1 |
| 1950 | 1497 | **0** | 0 | 2 |

The same games and the same class (Kingambit's silent `-end …|fallenundefined`) as the post-Ice-Spinner readings in §1.
`data/tags.json` and `data/abra-tags.js` differ from the base only by the Ice Spinner row and descriptor;
`data/protocol-events.json` and `data/move-effects.js` byte-identical across the pass.

### The other two Reg M-C gate lattices (release `4868967b4a91`, same pins) -- first readings, NOT zero

| `--games` | games | board-material | void | protocol-only |
|---|---|---|---|---|
| 1200 | 954 | **0** | 1 | 70 |
| 1350 | 1075 | **2** | 0 | 78 |
| 1950 | 1536 | **14** | 1 | 128 |

First board divergences (cause NOT established for any; these are cards, not diagnoses):

```
1350 omit-spread           …bo3-2683867010 t4  golisopod.hp 74/65, incineroar.hp 138/148, active[0].species golisopod/incineroar
1350 pair-speedctrl        …bo3-2683185970 t4  delphox.item rockyhelmet/focussash, pelipper.item focussash/''
1950 omit-weather          …bo3-2682175073 t1  lucario.hp 145/72
1950 omit-intimidate       …bo3-2681663488 t5  field.terrain psychic/''
1950 omit-intimidate       …bo3-2681789845 t1  beedrill.hp 110/95, armarouge.hp 146/139
1950 omit-intimidate       …bo3-2682187499 t4  indeedeef.hp 58/125
1950 omit-intimidate       …bo3-2683185970 t2  delphox.item damprock/lightball, maushold.item ''/damprock
1950 omit-spread           …bo3-2678871998 t8  pawmot.types /fighting vs electric/fighting
1950 omit-spread           …bo3-2681801782 t1  lucario.hp 145/72
1950 omit-spread           …bo3-2681855173 t1  greninja.types dark/water vs water
1950 pair-protect-bust     …bo3-2678161087 t4  garchomp.hp 76/54
1950 pair-redirect-priority …bo3-2678207112 t5 whimsicott.hp 36/135, armarouge.hp 59/142
1950 pair-redirect-priority …bo3-2678460835 t2 talonflame.hp 103/153, indeedeef.hp 10/104
1950 pair-redirect-priority …bo3-2684290289 t3 toxapex.hp 125/69
1950 pair-redirect-priority …-2681082751 t1     lucario.hp 145/72
1950 pair-speedctrl        …bo3-2684749333 t8  rillaboom.hp 97/87
```

Visible groupings, unconfirmed: three `lucario.hp 145/72` at turn 1 (the same number three times -- one cause); two item
swaps on a Delphox (the same team, `…2683185970`, in both lattices -- an item-transfer mechanic); two type rows (a Pawmot
that lost Electric on one engine only, a Greninja typed Dark on one engine -- Protean/Libero-shaped). Each can be
replayed with `--only-game <digits>` under `--games 1350` or `--games 1950` (the index differs by lattice).

---

## OWED, NOT RUN

From the MAIN checkout after the merge (none of these was run in this worktree; `status.js --write` must not run from a
worktree):

```
node engine/status.js --write
node engine/quarantine.js --regulation regmc
```

The Reg M-C census regeneration (the probes of this pass are staged tests, not census rows; ENGINE's `tests/test-mechanics.js`
was not extended, so no census row carries `clearsTerrainAfterHit` yet):

```
node tests/test-mechanics.js --regulation regmc
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/test-mechanics.js
```

The Reg M-B held-out draw, owed because 0.45.0 (Ice Spinner) and 0.47.0 (`???` STAB) change paths Reg M-B runs:

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/engine_release.js cut "abra/regmc 0.48.0, Reg M-B held-out"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown tools\lownode.cmd engine/game_differential.js --steering empirical --arm middle --end-state --census <copy of data/mechanics-census.json> --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen --release <id> --games 12000 --write --out <scratch>
```

The next Reg M-C hand list (16 games across the 1350/1950 lattices, §6), replayed one at a time:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state --census data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --release <id> --games 1950 --only-game 2682175073 --only-game-out <scratch>/og-lucario-regmc.json
```

Narration, not board-material, carried: the `-fail|<user>|move: <Move>` attribute on a failed `spendsOwnType` move.

For MEASURE (the driver is theirs):
- `--steering empirical` games are not independent: `coveragePick` (the empirical driver's fallback) reads `CLICKS` and the
  credit maps, which carry across games within an arm (§2). The same pair at another position in the order can be a
  different game.
- `mirrorRevival` (carried from pass 3): it drops the head of the USER's slot entry queue, not the revived body's.

Left in the worktree, uncommitted: `data/engine-release-regmc.json` (untracked; the Reg M-C release pointer this pass's
cuts wrote -- the main checkout carries its own untracked copy) and scratch under `data/_scratch-eng-a4f8/` (git-ignored).
The tracked M-B pointer `data/engine-release.json` was moved by this pass's M-B cuts and is restored from HEAD, not
committed.
