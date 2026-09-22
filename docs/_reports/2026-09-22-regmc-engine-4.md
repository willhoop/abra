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
