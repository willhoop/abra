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
