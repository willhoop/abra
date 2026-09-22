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
