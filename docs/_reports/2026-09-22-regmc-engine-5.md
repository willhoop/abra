# Reg M-C engine pass 5: the 1350 and 1950 gate lattices

**Date.** 2026-09-22. **Division.** ENGINE. **Line.** abra/regmc 0.48.0 onward. **Status.** Findings record, historical by
construction; never cited as current state. **No Reg M-C figure is published here.**

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-af5ab49007802bcac`, base `867df20c` (abra/regmc 0.48.0) |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` (`f10d679`), selected by the regulation |
| M-B authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (`SHOWDOWN_PATH` explicit on every M-B arm) |
| launcher | `tools\lownode.cmd` through `cmd.exe /c`, from a node argv launcher (`data/_scratch-eng-af54/gd.js`, git-ignored) |

**The pinned Reg M-C differential**, every reading below:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state \
  --census data/verification/census-pin-regmc-f3b70bc0c47c.json \
  --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc \
  --release <id> --games <1200|1350|1950> --write --out <scratch> --dump-games 3000 --dump-out <scratch dump>
```

Arm `middle`, steering `empirical`, `--end-state`, census pin `f3b70bc0c47c`, pool = the MAIN checkout's
`data/team-pool-frozen-regmc`. State bar = `state.games - state.games_board_never_diverged`. A fresh `--release` per
engine change. Causes are bucketed from the full `--dump-games` output (every board-material game has a card in it).

**The Reg M-B check**, every commit: `data/protocol-events.json`, `data/move-effects.js` and `data/tags.json`
byte-identical to the base; lattice `--steering empirical --arm middle --end-state --census <copy of HEAD's
data/mechanics-census.json> --team-store <main>/data/team-pool-frozen --games N` on a Reg M-B release cut from the
commit's tree, `SHOWDOWN_PATH` the M-B checkout. 1200 after every fix; 1200/1350/1950 at the end.

---

## 0. The baseline (re-read on the current tree)

Release **`519f2a27fce0`** (cut from the 0.48.0 tree in this worktree). All three artifacts generated 2026-09-22 ~21:27-21:29Z.

| `--games` | games | board-material | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 954 | **0** | 1 | 70 |
| 1350 | 1075 | **2** | 0 | 78 |
| 1950 | 1536 | **14** | 1 | 128 |

The same readings and the same sixteen cards as pass 4's §6.

### The buckets (first board divergence + the dump card's first protocol split, then the authority read)

| # | cause (read off the card; confirmed against the authority only where a section below fixes it) | games | lattice(s) |
|---|---|---|---|
| A | Steel Beam into a Protect: the authority charges the user half its max HP (`onMoveFail`); this engine charged nothing | 3 (`…2682175073`, `…2681801782`, `…2681082751`) | 1950 |
| B | Magician takes from the first hit target in the authority's `speedSort`, which Trick Room reverses; this engine sorted on live Speed, descending | 2 (`…2683185970` in both lattices) | 1350, 1950 |
| C | A priority move redirected by Follow Me into a Psychic-Terrain-grounded Indeedee: the authority blocks it (`-activate … Psychic Terrain`), this engine hits | 2 (`…2682187499` Extreme Speed, `…2678460835` Gale Wings Dual Wingbeat) | 1950 |
| D | Emergency Exit brings Incineroar back in the turn it left through Eject Button; this engine then runs its queued Parting Shot, the authority does not | 1 (`…2683867010`) | 1350 |
| E | Ice Spinner's user knocked out by Rocky Helmet: the authority still ends the terrain | 1 (`…2681663488`) | 1950 |
| F | Castform's Forecast on Snowscape (a mega Froslass's Snow Warning): the authority changes to Castform-Snowy | 1 (`…2681789845`) | 1950 |
| G | Protean announces its type change before Psychic Terrain refuses a priority move (Water Shuriken) | 1 (`…2681855173`) | 1950 |
| H | Double Shock's type change is written before the Rocky Helmet toll that KOs the user; here after the faint, and it survives on the corpse | 1 (`…2678871998`) | 1950 |
| I | Rough Skin copied by a transformed Ditto, charged by the authority after the Ditto is KOed | 1 (`…2678161087`) | 1950 |
| J | Milk Drink: this engine heals the partner too | 1 (`…2684290289`) | 1950 |
| K | Encore / Expanding Force order between two Armarouge | 1 (`…2678207112`) | 1950 |
| L | Revival Blessing's revived body takes a Grassy Terrain heal before it is on the field | 1 (`…2684749333`) | 1950 |

Largest first: A (3), then B and C (2 each; B is the only cause in both lattices), then the singles.

---

## 1. Steel Beam into a Protect (abra/regmc 0.49.0)

### The card

All three games, turn 1, a Lucario-Mega-Z (`lucarionitez`) clicking Steel Beam into a target whose Protect answers:

```
showdown   |move|p2a: Lucario|steelbeam|p1a: Gengar   |-activate|p1a: Gengar|move: Protect   |-damage|p2a: Lucario|72/145|[from] steelbeam
medicham2  |move|p2a: Lucario|steelbeam|p1a: Gengar   |-activate|p1a: Gengar|move: Protect   (nothing)
```

### The authority, read whole

- `data/moves.ts` steelbeam :17876-17892 (not named by the Champions mod): `mindBlownRecoil: true`,
  `onMoveFail(target, source, move) { if (move.multihit) return; this.damage(Math.round(source.maxhp / 2), source, source,
  this.dex.conditions.get('Steel Beam')); }`.
- `sim/battle-actions.ts` useMoveInner :509-533 (no Champions override of `useMoveInner`; the mod's `scripts.ts` overrides
  `canTerastallize`, `canMegaEvo`, `modifyDamage`, `spreadMoveHit`, `hitStepMoveHitLoop` and three Pokemon members, read
  off `data/mods/champions/scripts.ts` :44-428): `if (!targets.length) { … return false; }` charges
  nothing; `moveResult = this.trySpreadMoveHit(targets, pokemon, move)`; `if (!moveResult) { …
  this.battle.singleEvent('MoveFail', move, null, target, pokemon, move); … }`. A target whose Protect answered leaves
  `trySpreadMoveHit` falsy, so the charge is paid.
- The charge is `Battle#damage` with a Condition effect, so a `refusesIndirectDamage` body (Magic Guard) refuses it.

### The defect

The engine's max-HP recoil block (ROADMAP #139 / 2026-09-19) pays the `paidOnFail` member on a whiff and on an immunity,
but the FULLY-SHIELDED exit (`if(_hadTargets&&!targets.length){ … _crashOnFail(); continue; }`) leaves above it. The
block's own header named the gap: *"Steel Beam into a Protect is still UNPAID here where the authority charges it -- a
separate gap on the other member, named rather than quietly inherited."*

### Fix

`_failRecoilOnShield()`, called at the fully-shielded exit beside `_crashOnFail()`: the move's `recoil` tag with
`of: 'maxhp'` and `paidOnFail` (tag_dex's reading of a damaging `onMoveFail`; membership printed by the probe: Steel Beam
alone, in the tag and in the dex), `refusesIndirect` honoured, `Math.round(maxhp * fraction)`, `[from] <move id>`.
`MEDSEEN.failRecoilPaidOnShield`. Knob `MEDI_FAIL_RECOIL_SHIELD_FREE`. No tag moved.

### Probe -- `tests/probe_regmc_steel_beam_protect.js --regulation regmc`

Cast derived on the run: Hisuian Goodra (Steel Beam), Corviknight (resists Steel, learns Protect), Dragon Claw as the
control move.

| arm | staged | authority |
|---|---|---|
| SHIELD | t1 Steel Beam into Corviknight's Protect | `-activate|p2a: Corviknight|move: Protect`, `-damage|p1a: Goodra|77/155|[from] steelbeam` |
| HIT | Corviknight idles | the hit, then the same charge (already paid before this fix) |
| CONTROL | Dragon Claw into the Protect | no charge |

| run | exit | red |
|---|---|---|
| release `519f2a27fce0` + the 0.48.0 engine bytes | **1** | SHIELD (line and boards) |
| clean, release `fef8345b826a` | **0** | none; counter 1 in SHIELD, 0 in HIT and CONTROL |
| `MEDI_FAIL_RECOIL_SHIELD_FREE=1` | **1** | SHIELD (line and boards) |

6 staged sets, 0 illegal.

### Pinned Reg M-C differential (release `fef8345b826a`)

| `--games` | before | after | void | note |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | unmoved |
| 1350 | 2 / 1075 | **2 / 1075** | 0 | unmoved |
| 1950 | 14 / 1536 | **11 / 1537** | 0 (was 1) | the three Lucario games left, none joined |

The 1950 void game of the baseline (`omit-spread …bo3-2680694534`, `low-identity`, board parted turn 1) is no longer void
and does not part: its dice addresses now agree, so it joins the usable population (1536 -> 1537) as a clean game.

### Reg M-B

Steel Beam is Reg M-B legal (`data/tags.json:moves.steelbeam.uses` 125), so this changes Reg M-B behaviour toward the
authority (the same handler in the M-B checkout). No tag moved; the three Reg M-B data files byte-identical. Lattice 1200
on release `c60cc1ca32b8`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 2. Magician's victim is the authority's `speedSort` order (abra/regmc 0.50.0)

### The cards

Both are the same team (`…bo3-2683185970`), Trick Room up:

```
1350 t4  Heat Wave hits Pelipper and Indeedee
  showdown   |-item|p1a: Delphox|Focus Sash|[from] ability: Magician|[of] p2a: Pelipper
  medicham2  |-item|p1a: Delphox|rockyhelmet|[from] ability: magician|[of] p2b: Indeedee
1950 t2  Expanding Force hits Maushold and Pikachu; Pikachu faints to it
  showdown   |-item|p1a: Delphox|Light Ball|[from] ability: Magician|[of] p2: Pikachu
  medicham2  |-item|p1a: Delphox|damprock|[from] ability: magician|[of] p2a: Maushold
```

### The authority, read whole

- `data/abilities.ts` magician :2477-2500 (no Champions override): after the handler's refusals, `const hitTargets =
  move.hitTargets; this.speedSort(hitTargets); for (const pokemon of hitTargets) { if (pokemon !== source) { const
  yourItem = pokemon.takeItem(source); if (!yourItem) continue; … this.add('-item', …); return; } }`.
- `speedSort` with no comparator is `comparePriority`, which reads the cached `pokemon.speed`; `updateSpeed()`
  (`sim/pokemon.ts` :556-558) writes `getActionSpeed()` into it, and the Champions `getActionSpeed`
  (`data/mods/champions/scripts.ts` :46-54) is `-speed` under Trick Room. So under Trick Room the SLOWER target is asked
  first. `takeItem` (`sim/pokemon.ts` :1851-1866) asks no HP, so a target the same move knocked out is still asked (the
  1950 card: the authority took the fainted Pikachu's Light Ball).

### The defect

The engine's Magician block sorted its candidates on live Speed, fastest first (`effSpeed(y) - effSpeed(x)`): no Trick
Room, no cached value, no tie die.

### Fix

The sort loop of `sdEachEventOrder` (the `Battle#speedSort` emulation over cached action speeds) is lifted verbatim into
`sdSpeedSortEntries(L, why)`; `sdEachEventOrder` calls it with its counters unchanged, and the Magician block now builds
the whole hit list (each body once, `_sdSpe` or, counted, its live `sdActionSpeed`), sorts it through the same function,
and takes from the first body whose item can be taken. `MEDSEEN.magicianSpeedSortCached`, `speedSortTieResolved`. Knob
`MEDI_MAGICIAN_LIVE_SPEED_ORDER` (the old sort). No tag moved.

### Probe -- `tests/probe_regmc_magician_speed_order.js --regulation regmc`

Cast derived: Delphox (Magician; the holders that learn Trick Room and Protect are Delphox and Klefki), Dazzling Gleam
(the first plain 100%-accurate `allAdjacentFoes` move it learns), foes Kangaskhan @ Binding Band (base Speed 90) and
Sylveon @ Damp Rock (60) -- items with no handler of their own.

| arm | staged | authority |
|---|---|---|
| ROOM | t1 Delphox's Trick Room; t2 Dazzling Gleam | `-item|p1a: Delphox|Damp Rock|…|[of] p2b: Sylveon` (the slower) |
| OPEN | t1 Protect; t2 the same | `-item|p1a: Delphox|Binding Band|…|[of] p2a: Kangaskhan` (the faster) |

| run | exit | red |
|---|---|---|
| release `fef8345b826a` + the 0.49.0 engine bytes | **1** | ROOM (line and boards) |
| clean, release `3ddd357ff11f` | **0** | none; one theft per arm, each sorted on the cached speed |
| `MEDI_MAGICIAN_LIVE_SPEED_ORDER=1` | **1** | ROOM (line and boards) |

6 staged sets, 0 illegal. The probe does not stage the fainted-target case; the 1950 card is its measurement.

### Pinned Reg M-C differential (release `3ddd357ff11f`)

| `--games` | before | after | void |
|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 |
| 1350 | 2 / 1075 | **1 / 1075** | 0 |
| 1950 | 11 / 1537 | **10 / 1537** | 0 |

Left: the Delphox game in both lattices. Joined: none.

### Reg M-B

Magician is Reg M-B legal (`data/tags.json:abilities.magician.uses` 466) and the M-B checkout's handler is the same
(`data/abilities.ts` :2467), so this is a shared rule; Reg M-B data files byte-identical. Lattice 1200 on release
`97eafd8d3dc3`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 3. Psychic Terrain asks the body a priority move was drawn to (abra/regmc 0.51.0)

### The cards

Both 1950 games: a grounded Indeedee's Follow Me draws a priority move that was aimed at its airborne partner.

```
…2682187499 t4  Dragonite-Mega's Extreme Speed, drawn onto p2b Indeedee
  showdown   |-activate|p2b: Indeedee|move: Psychic Terrain
  medicham2  |-damage|p2b: Indeedee|58/145
…2678460835 t2  Talonflame's Dual Wingbeat (Gale Wings priority), drawn onto p2b Indeedee
  showdown   |-activate|p2b: Indeedee|move: Psychic Terrain
  medicham2  |-damage|p2b: Indeedee|56/145   (and two Rocky Helmet tolls)
```

### The authority, read whole

- `data/moves.ts` psychicterrain.condition.onTryHit :14114-14128 (not named by the Champions mod): `if (effect &&
  (effect.priority <= 0.1 || effect.target === 'self')) return; if (target.isSemiInvulnerable() || target.isAlly(source))
  return; if (!target.isGrounded()) { … return; } this.add('-activate', target, 'move: Psychic Terrain'); return null;`
- It is a `TryHit` handler, raised by `hitStepTryHitEvent` over the move's TARGETS, the list `getMoveTargets` built after
  `RedirectTarget` (Follow Me) moved the aim. So the body asked is the one the move was drawn to.

### The defect

The attack path's terrain gate (NARRATION 2026-09-10) asked `priorityRefusedAbove(..., _tAim, ...)` with `_tAim =
a.target`, the body the player named. Its own header named the gap: *"The authority hands `onTryHit` the post-redirect
body and exempts an ally outright; both are true here too and neither is claimed by this pass -- named rather than folded
in, because no probe fails on them today."* Two do now.

### Fix

For a single-target move whose one target (after the redirect gate above it has run) is a foe, the gate asks that body.
`MEDSEEN.terrainBarAskedRedirected`. Knob `MEDI_TERRAIN_BAR_PRE_REDIRECT`. The ally exemption (`target.isAlly(source)`)
is NOT touched: no card or probe parts on it, and it stays named in the header. No tag moved.

### Probe -- `tests/probe_regmc_terrain_bar_redirect.js --regulation regmc`

Cast derived: Galarian Slowking (Psychic Terrain, t1), Clefable (Follow Me, grounded), Corviknight (Flying, the aimed
body), Baxcalibur's Ice Shard (the first plain priority move neutral or resisted into both).

| arm | staged | authority |
|---|---|---|
| DRAWN | t2 Clefable Follow Me; Ice Shard aimed at Corviknight | `-activate|p2a: Clefable|move: Psychic Terrain`, no damage |
| AIMED | t2 Clefable Protects; the same Ice Shard | `-damage|p2b: Corviknight|119/173` |

| run | exit | red |
|---|---|---|
| release `3ddd357ff11f` + the 0.50.0 engine bytes | **1** | DRAWN (line and boards) |
| clean, release `0f2b9112051e` | **0** | none; the terrain refused once in DRAWN, asked of the redirected body |
| `MEDI_TERRAIN_BAR_PRE_REDIRECT=1` | **1** | DRAWN (line and boards) |

7 staged sets, 0 illegal.

### Pinned Reg M-C differential (release `0f2b9112051e`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 70 → 67 |
| 1350 | 1 / 1075 | **1 / 1075** | 0 | 77 → 74 |
| 1950 | 10 / 1537 | **8 / 1537** | 0 | 124 → 117 |

Left: the two Indeedee games. Joined: none. The protocol-only count fell in all three lattices (narration-only games of
the same shape, which parted a line and no board).

### Reg M-B

Follow Me and Psychic Terrain are both Reg M-B legal and the M-B checkout's handler is the same, so this is a shared rule;
Reg M-B data files byte-identical. Lattice 1200 on release `7a9b704e148a`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 4. A body forced out loses its queued action, even if it comes back (abra/regmc 0.52.0)

### The card (1350, `omit-spread …bo3-2683867010`, turn 4)

```
|-enditem|p1a: Incineroar|Eject Button              Dragapult's Shadow Ball; Incineroar ejected, Golisopod in
|move|p2b: Rillaboom|woodhammer|p1a: Golisopod        Golisopod to 65/150
|-activate|p1a: Golisopod|ability: Emergency Exit     Incineroar back in (Intimidate)
showdown   |-weather|RainDance|[upkeep]               (Incineroar does not act)
medicham2  |move|p1a: Incineroar|partingshot|p2a: Dragapult   (and pivots Golisopod back in)
```

### The authority, read whole

- `sim/battle-actions.ts` switchIn :62-122 (no Champions override): for the unfainted body leaving the slot,
  `// if a pokemon is forced out by Whirlwind/etc or Eject Button/Pack, it can't use its chosen move` then
  `this.battle.queue.cancelAction(oldActive);` (:104-107).
- `sim/battle-queue.ts` cancelAction :334-343 splices EVERY queued action of that body out of the queue.
- `runAction` `case 'move'` refuses `!action.pokemon.isActive` -- the only refusal this engine had (ROADMAP #361). It
  answers only while the body is still off the field; a body brought back later the same turn passes it.

### The defect

This engine let a body that was forced out and brought back in the same turn run its queued action.

### Fix

`switchOut` stamps the leaving (unfainted) body with `_leftEpoch = TURN_EPOCH`, a counter the turn loop advances once per
turn where it builds its queue; the action loop, right after the `isActive` refusal, drops the action of a body stamped
this turn (every kind but `pass`, as the splice takes every kind). `MEDSEEN.actionCancelledByForcedOut`. Knob
`MEDI_RETURNED_BODY_KEEPS_ACTION`. No tag moved.

Not changed, stated: the body is removed from this engine's `unresolved` set when its slot in the loop comes up, not at
the moment it leaves, so a question asked in between (`queue.willMove` in the authority) still counts it as pending here.
No card or probe parts on that.

### Probe -- `tests/probe_regmc_forced_out_action_cancelled.js --regulation regmc`

Cast derived: Sylveon @ Eject Button (base Speed 60, Focus Energy queued), Thievul (90, U-turn), Sceptile (120, Night
Slash into Sylveon). The first bench body is the one a forced switch brings in on both engines, so Toxapex replaces the
ejected Sylveon and Sylveon replaces the pivoting Thievul.

| arm | staged | authority |
|---|---|---|
| BACK | Sylveon ejected, walks back in behind Thievul's U-turn | no `|move|` from Sylveon this turn |
| STAYS | Sylveon holds nothing: hit, stays; Toxapex comes in behind the U-turn | Sylveon's Focus Energy runs |

| run | exit | red |
|---|---|---|
| release `0f2b9112051e` + the 0.51.0 engine bytes | **1** | BACK (Sylveon's `|move|` and its Focus Energy volatile and PP) |
| clean, release `4d7779ca7bad` | **0** | none; one cancellation in BACK, none in STAYS |
| `MEDI_RETURNED_BODY_KEEPS_ACTION=1` | **1** | BACK |

8 staged sets, 0 illegal.

### Pinned Reg M-C differential (release `4d7779ca7bad`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 67 |
| 1350 | 1 / 1075 | **0 / 1075** | 0 | 74 → 73 |
| 1950 | 8 / 1537 | **8 / 1537** | 0 | 117 |

Left: `…2683867010`. Joined: none. **The 1350 lattice reads zero.**

### Reg M-B

A shared rule (the same `switchIn` in both checkouts; in Reg M-B, where neither eject door has a carrier, a forced exit
followed by a same-turn return needs a drag move and a later pivot). Reg M-B data files
byte-identical. Lattice 1200 on release `359ba087f8f2`: **0 of 961**,
0 void, 0 protocol-diverged.

---

## 5. Ice Spinner ends the terrain even when a contact toll knocks its user out (abra/regmc 0.53.0)

### The card (1950, `omit-intimidate …bo3-2681663488`, turn 5)

```
|move|p2a: Starmie|icespinner|p1a: Indeedee
|-damage|p1a: Indeedee|50/145
|-damage|p2a: Starmie|0 fnt|[from] item: Rocky Helmet|[of] p1a: Indeedee
showdown   |-fieldend|move: Psychic Terrain     |faint|p2a: Starmie
medicham2  |faint|p2a: Starmie                   (the terrain stays: field.terrain psychic/'')
```

### The authority, read whole -- and a correction to pass 4

- `data/mods/champions/scripts.ts` spreadMoveHit :315-426 is the Champions mod's OWN copy. After `runEvent('DamagingHit',
  …)` (where Rocky Helmet and Rough Skin are paid) it raises `if (moveData.onAfterHit) { for (const t of damagedTargets)
  this.battle.singleEvent('AfterHit', moveData, {}, t, pokemon, move); }` -- with **no `pokemon.hp` test**. The Reg M-B
  checkout's mod has the identical block (`data/mods/champions/scripts.ts` :412-416 there).
- `data/moves.ts` icespinner :9417-9437: `onAfterHit(target, source) { this.field.clearTerrain(); }` asks no HP; only
  `onAfterSubDamage` asks `source.hp`.
- **Pass 4 §1 read the mainline guard** -- `sim/battle-actions.ts` :1123 `if (moveData.onAfterHit && pokemon.hp)` -- and
  wrote "a user a contact toll just knocked out clears nothing". That is mainline, and Champions overrides the function. The
  dated claim in `docs/_reports/2026-09-22-regmc-engine-4.md` is left as written; this section is its correction.

### The defect

The engine's Ice Spinner clear (0.45.0) required `!m.fainted`, copying the mainline guard.

### Fix

The live-user test now applies only on the Substitute road and only when the tag says the sub handler asks
(`clearsTerrainAfterHit.subNeedsUserHP`). `MEDSEEN.terrainClearedByFaintedUser`. Knob `MEDI_AFTERHIT_NEEDS_LIVE_USER`. No
tag moved.

**Named, not fixed:** the other two families in the same step (`hazardOnHit` -- Stone Axe `data/moves.ts` :18078,
Ceaseless Edge :2229; `removesHazards` -- Rapid Spin :14703, Mortal Spin :12323) keep `!m.fainted`. Their `onAfterHit`
bodies ask no HP either, so under the Champions `spreadMoveHit` they carry the same gap; no card or probe parts on them yet.

### Probe -- `tests/probe_regmc_ice_spinner_fainted_user.js --regulation regmc`

Cast derived: Froslass (the only Ghost that learns Ice Spinner, Curse and Substitute), Clefable (Misty Terrain),
Sharpedo (Rough Skin, resists Ice) @ Rocky Helmet, its click Agility (a self boost it can repeat; Focus Energy fails on
the second use).

| arm | staged | authority |
|---|---|---|
| FAINTS | t1 Curse (half HP), t2 Substitute (a quarter) + Misty Terrain, t3 Ice Spinner into Sharpedo | Rough Skin, Rocky Helmet `0 fnt`, `-fieldend|mistyterrain`, `|faint|` ×2 |
| STANDS | t1 Protect in place of Curse | Froslass survives; `-fieldend` |

The FAINTS arm's first protocol divergence is turn 1's Ghost Curse line (authority: the user's `-damage` above
`-start|p2a: Sharpedo|curse|[of] p1a: Froslass`; here the `-start` first, with `[of] froslass`) -- a separate narration
defect that moves no board. The probe therefore asserts this mechanic's `-fieldend`/`faint` lines in order and the boards,
and prints the protocol divergence rather than asserting it away.

| run | exit | red |
|---|---|---|
| release `4d7779ca7bad` + the 0.52.0 engine bytes | **1** | FAINTS (`-fieldend` line and boards) |
| clean, release `cd3eed0c5796` | **0** | none; one clear per arm, the FAINTS one by a fainted user |
| `MEDI_AFTERHIT_NEEDS_LIVE_USER=1` | **1** | FAINTS |

6 staged sets, 0 illegal. Pass 4's `tests/probe_regmc_ice_spinner.js` stays green on the new bytes.

### Pinned Reg M-C differential (release `cd3eed0c5796`)

| `--games` | before | after | void | protocol-diverged |
|---|---|---|---|---|
| 1200 | 0 / 954 | **0 / 954** | 1 | 67 |
| 1350 | 0 / 1075 | **0 / 1075** | 0 | 73 |
| 1950 | 8 / 1537 | **7 / 1537** | 0 | 117 → 116 |

Left: `…2681663488`. Joined: none.

### Reg M-B

Shared (the Reg M-B checkout's Champions `spreadMoveHit` has the same unguarded `AfterHit`; Ice Spinner is Reg M-B legal).
Reg M-B data files byte-identical. Lattice 1200 on release `017932cdac0b`: **0 of 961**, 0 void, 0 protocol-diverged.

---

## 6. Where the line stands after this pass

### The five fixes

| # | card | cause (confirmed against the authority) | commit | 1200 | 1350 | 1950 |
|---|---|---|---|---|---|---|
| base | | | 0.48.0 `519f2a27fce0` | 0 / 954 | 2 / 1075 | 14 / 1536 |
| 1 | three `lucario.hp 145/72` | Steel Beam's `onMoveFail` charge unpaid at the fully-shielded exit (both regulations) | 0.49.0 `fef8345b826a` | 0 / 954 | 2 / 1075 | 11 / 1537 |
| 2 | Delphox item swaps | Magician's victim order ignored the cached, Trick-Room-negated `speedSort` (both) | 0.50.0 `3ddd357ff11f` | 0 / 954 | 1 / 1075 | 10 / 1537 |
| 3 | two Indeedee HP gaps | Psychic Terrain asked the aimed body, not the Follow Me body the move was drawn to (both) | 0.51.0 `0f2b9112051e` | 0 / 954 | 1 / 1075 | 8 / 1537 |
| 4 | Golisopod / Incineroar | a body forced out and brought back the same turn kept its queued action (both) | 0.52.0 `4d7779ca7bad` | 0 / 954 | **0 / 1075** | 8 / 1537 |
| 5 | a psychic terrain the authority ended | Ice Spinner's clear refused to a user a contact toll knocked out; the Champions `spreadMoveHit` has no such guard (both) | 0.53.0 `cd3eed0c5796` | **0 / 954** | **0 / 1075** | **7 / 1537** |

Every step: left = the named card(s), joined = none. None of the five was an exact speed tie, an instrument artifact or
narration by measurement. The 1200 lattice never regressed (0 throughout; its void game and protocol-only count 70 → 67
are the only movement, the latter from §3).

### Reg M-B on the final tree (release `017932cdac0b`, `SHOWDOWN_PATH` the M-B checkout)

| `--games` | games | board-material | void | protocol-only |
|---|---|---|---|---|
| 1200 | 961 | **0** | 0 | 0 |
| 1350 | 1069 | **0** | 0 | 1 |
| 1950 | 1497 | **0** | 0 | 2 |

The same readings as pass 4's final tree. `data/tags.json`, `data/protocol-events.json` and `data/move-effects.js`
byte-identical to the base (`git diff --quiet 867df20c`); every fix of this pass is an engine change with no tag moved.
All five change Reg M-B behaviour toward the authority (each rule is the same handler in both checkouts), which is why
the Reg M-B held-out draw is owed.

### The 1950 lattice: seven cards left (read off the dump; NO cause confirmed)

| card | first board divergence | what the dump card shows |
|---|---|---|
| `omit-intimidate …2681789845` t1 | `beedrill.hp 110/95`, `armarouge.hp 146/139`, castform species | Froslass-Mega's Snow Warning raises Snowscape; the authority writes `-formechange|p2b: Castform|Castform-Snowy` there, this engine does not (the `formeFollowsWeather` tag maps `snow`; the weather id or the entry-time sync is the suspect), so Blizzard is weaker here |
| `omit-spread …2681855173` t1 | `greninja.types dark/water vs water` | Water Shuriken (priority) into a grounded Indeedee under Psychic Terrain: the authority writes Protean's `typechange` BEFORE the terrain's refusal; this engine refuses first |
| `omit-spread …2678871998` t8 | `pawmot.types /fighting vs electric/fighting` | Double Shock KOs Indeedee, Rocky Helmet KOs Pawmot: the authority writes the self type change before the toll and the fainted body reverts; this engine writes it after `|faint|` and it sticks to the corpse |
| `pair-protect-bust …2678161087` t4 | `garchomp.hp 76/54` | Stomping Tantrum KOs a Ditto transformed into Garchomp; the authority charges the copied Rough Skin, this engine does not |
| `pair-redirect-priority …2684290289` t3 | `toxapex.hp 125/69` | Gogoat's Milk Drink (Champions: `target: "adjacentAllyOrSelf"`, `data/mods/champions/moves.ts` :646-649) heals Gogoat on the authority; this engine heals Toxapex AND Gogoat |
| `pair-redirect-priority …2678207112` t5 | `whimsicott.hp 36/135`, `armarouge.hp 59/142` | after Encore, the two Armarouge's Expanding Forces run in opposite orders -- **an exact speed tie is NOT excluded** (same species; not checked) |
| `pair-speedctrl …2684749333` t8 | `rillaboom.hp 97/87` | Revival Blessing revives Rillaboom into the empty slot; this engine gives it the Grassy Terrain heal before it is on the field (adjacent to MEASURE's `mirrorRevival`; not touched) |

### Also found, not fixed

- **Ghost Curse narration** (probe §5): the authority writes the user's `-damage` above `-start|<foe>|curse|[of] <user>`;
  this engine writes the `-start` first, with a bare `[of] froslass`. No board moves.
- **The same fainted-user gap on the hazard families** (§5): Stone Axe, Ceaseless Edge, Rapid Spin, Mortal Spin.
- **Psychic Terrain's ally exemption** (§3), named in the engine, unclaimed.
- **`unresolved` timing** (§4): a forced-out body stays "pending" in this engine until its slot in the loop.

---

## OWED, NOT RUN

From the MAIN checkout after the merge (none of these was run in this worktree; `status.js --write` must not run from a
worktree):

```
node engine/status.js --write
node engine/quarantine.js --regulation regmc
```

The census regenerations (the probes of this pass are staged tests, not census rows):

```
node tests/test-mechanics.js --regulation regmc
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/test-mechanics.js
```

The Reg M-B held-out draw, owed because all five fixes change paths Reg M-B runs (Steel Beam, Magician, Follow Me +
Psychic Terrain, the forced-exit queue, Ice Spinner):

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/engine_release.js cut "abra/regmc 0.53.0, Reg M-B held-out"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown tools\lownode.cmd engine/game_differential.js --steering empirical --arm middle --end-state --census <copy of data/mechanics-census.json> --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen --release <id> --games 12000 --write --out <scratch>
```

The next Reg M-C hand list (the seven 1950 cards, §6), replayed one at a time on the final release:

```
node engine/game_differential.js --regulation regmc --steering empirical --arm middle --end-state --census data/verification/census-pin-regmc-f3b70bc0c47c.json --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --release cd3eed0c5796 --games 1950 --only-game 2681789845 --only-game-out <scratch>/og-castform.json
```

(and `--only-game` 2681855173, 2678871998, 2678161087, 2684290289, 2678207112, 2684749333 the same way; for
`2678207112` read both Armarouge's action speeds off the dump before calling it a defect.)

Left in the worktree, uncommitted: `data/engine-release-regmc.json` (untracked, the Reg M-C release pointer this pass's
cuts wrote) and scratch under `data/_scratch-eng-af54/` (git-ignored). The tracked M-B pointer `data/engine-release.json`
was moved by this pass's M-B cuts and restored from HEAD before every commit.
