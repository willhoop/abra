# A forme change recomputes from the set, HP SP included, on both roads (abra/regmc 1.51.0)

ENGINE, 2026-10-01. Worktree, `ABRA_REGULATION=regmc`, `SHOWDOWN_PATH` unset (authority `pokemon-showdown-mc`).
Staged boards only. No gate, differential, roster or self-play was run; another agent holds the game slot.

## Verdict

**Confirmed and fixed. The defect was wider than filed.** The mega road could not recompute an HP-invested spread.
The mid-battle forme road (`formeSwap`) had never recomputed at all, so a natured, invested Palafin-Hero was one point
off with or without HP. Both roads now recompute from the set. Probe `tests/probe_forme_spread_hp.js`: RED 318 + 572
before, GREEN 0 + 0 after. Each of two knobs restores exactly its own road's count. Census unmoved at 1027 live /
1027 probed / 0 missing.

## 1. The filing

SOLVER, abra/regmc 1.49.0 (`docs/_reports/2026-09-30-arena-real-spreads.md`): of the role-v1 table's 3,293 mega-stone
sets, 3,185 invest HP and 114 land off the authority after mega evolution (Atk 70, Spe 23, SpA 14, SpD 6, Def 1).

## 2. The authority, read in full (both stat paths)

- `data/mods/champions/scripts.ts` `statModify`, else-branch (no `levelclausemod`): HP returns `stat + evs + 75`; other
  stats `stat + evs + 20`, then one nature multiply `tr(tr(stat * 110, 16) / 100)` (or 90).
- Champions `pokemon.formeChange` calls `this.setSpecies(rawSpecies, source)` and, when `isPermanent`,
  `this.updateMaxHp()`.
- `sim/pokemon.ts` `setSpecies`: `const stats = this.battle.spreadModify(this.species.baseStats, this.set)`; writes
  every `storedStats` entry from it; `maxhp` is set only when it is still 0. `updateMaxHp`:
  `statModify(this.species.baseStats, this.set, 'hp')`, keeping damage taken constant.
- So a mega (permanent) recomputes the five battle stats AND max HP from the set. Zero to Hero (permanent) does the
  same. Stance Change (temporary) recomputes the five and keeps max HP.

## 3. The engine, read in full

- `l50(bs, sp, nature)` builds HP as `floor((2b+31)*50/100) + 60` = `b + 75` with **no SP term**. `spreadL50` is `l50`
  and documents that it has no HP term. `solver/xatu/worlds.js` `applySpread` adds `sp.hp` itself.
- `megaEvolveNow`: since 2026-08-27 it recomputes from `(megaBs, _sp, _nature)`, gated on `l50(baseBs, _sp, _nature)`
  reproducing the body's whole line. With HP SP the HP never matches, so the body takes the additive delta between two
  natured anchors. That delta truncates the nature multiply three times where `statModify` truncates once.
- `formeSwap` (Zero to Hero, Stance Change, reverts): always the same delta, natured anchors, no spread read at all.

## 4. The class (forme changes through the delta path), derived

`Dex.forFormat('gen9championsvgc2026regmc')`, legal species, legal battle-only formes:

| forme change | stats move | road | off before the fix? |
|---|---|---|---|
| 81 megas (stones the engine table carries) | yes | `megaEvolveNow` | yes, HP-invested spreads only |
| Aegislash -> Aegislash-Blade (and back) | atk, def, spa, spd | `formeSwap` | no: every anchor `B + 20` is a multiple of 10, so the delta is exact |
| Palafin -> Palafin-Hero | atk, def, spa, spd | `formeSwap` | **yes**, with or without HP |
| Castform formes, Mimikyu-Busted, Morpeko-Hangry | none | `formeSwap` / retype | no (identical base stats) |
| Greninja-Ash, Mimikyu-Busted-Totem | | | not legal in Reg M-C |

Palafin Defence worked through: anchors `tr(1.1 * 92) = 101` and `tr(1.1 * 117) = 128`. The delta loses one point
exactly when the body's sum `92 + S` ends in 5 to 9, so whenever `(2 + S) mod 10 >= 5`.

## 5. The probe — written first, watched fail

`tests/probe_forme_spread_hp.js`. Drives the real engine through `battleInit` + `battleTurn`. The body is built by
`buildPair`/`freshBodies`, then dressed with the declared spread through the engine's own `spreadL50` plus the HP SP,
and asserted equal to the authority BEFORE the forme changes.

- **Witness.** One real Showdown battle (Abomasnow @ Abomasite, Adamant, 32 HP / 32 Atk / 2 Spe) megas and lands on
  the oracle line `hp 197 / at 202 / df 125 / sa 136 / sd 125 / sp 52`. So the oracle is the line a mega really takes.
- **MEGA-HP.** 81 stones x every nature whose plus or minus stat moves x 2 HP-invested shapes (plus stat 32 and 7).
- **MEGA-0HP (control).** The same natures and plus/minus investment with HP at 0.
- **SWAP.** Aegislash and Palafin x every biting nature x plus stat S = 0..32, each with an HP shape and a 0-HP twin.

**The probe was wrong first, toward the comfortable answer.** Its first cut parked the plus stat at 0, 2 and 32. SWAP
came back clean, 160 of 160. The arithmetic above says those three values can never reach `(2 + S) mod 10 >= 5`. The
sweep over S = 0..32 is what made the road visible.

| arm | before fix | after fix | `MEDI_MEGA_SPREAD_HP_BLIND=1` | `MEDI_FORME_SWAP_STAT_DELTA=1` |
|---|---|---|---|---|
| MEGA-HP | **318 / 3,132 off** | 0 / 3,132 | **318 / 3,132** | 0 / 3,132 |
| MEGA-0HP (control) | 0 / 3,132 | 0 / 3,132 | 0 / 3,132 | 0 / 3,132 |
| SWAP | **572 / 2,640 off** | 0 / 2,640 | 0 / 2,640 | **572 / 2,640** |
| exit | 1 | **0** | 1 | 1 |

Before the fix `MEDFAILS.megaStatSpreadStale` read 3,132, one per HP-invested mega. After it reads 0. Each knob
restores only its own road's count, so the two halves are separately attributable.

Examples before the fix: Absol-Mega-Z Brave 5 HP / 32 Atk / 29 Spe, Speed authority 180 engine 179. Palafin-Hero
Adamant 32 HP / 2 Atk / 17 SpA, SpA authority 128 engine 129.

## 6. The fix (one cause, two roads, two knobs)

- `setLineL50(bs, sp, nature)`: `l50` plus `sp.hp` on HP. Used only by the two forme roads. `l50` and `spreadL50` keep
  their numbers for every other caller.
- `megaEvolveNow`: the check and the recompute use `setLineL50`. Knob `MEDI_MEGA_SPREAD_HP_BLIND=1` puts back `l50`.
- `formeSwap`: when the body carries `_sp` and `setLineL50(oldBs, _sp, _nature)` reproduces its line, the five battle
  stats are recomputed from `setLineL50(newBs, ...)`. HP keeps the delta, which is exact (no nature on HP) and keeps a
  temporary change's max HP, as the authority does. A body with no `_sp` keeps the delta and counts
  `MEDFAILS.formeSwapStatDelta`. A spread that does not reproduce the line counts `MEDFAILS.formeSwapSpreadStale`.
  A recompute counts `MEDSEEN.formeSwapStatFromSpread`. Knob `MEDI_FORME_SWAP_STAT_DELTA=1` puts back the delta.

## 7. Neighbours re-run (light)

- `tests/probe_mega_spread_stat.js` (Reg M-C): GREEN, 162 / 162 both arms.
- `tests/test-forme-assert.js` (live-release preload): 6 of 6 rows agree on all four assertions. Its artifact was
  restored, because only its timestamp moved.
- `tests/test-nature-differential.js` (live-release preload): parts 1 to 6 green, including part 4 (mega mid-turn).
  Part 7 fails because the preload redirects releases to a temp store, which does not hold baseline `6b5447db1738`.
  That is a harness limit, not an engine result. Part 7 is owed on a real release (section 9).
- Census: `node tests/test-mechanics.js` -> **1027 live / 1027 probed / 0 missing, run_ok true**. Before: 1027 / 1027
  / 0 (`data/mechanics-census-regmc.json`, generated 2026-09-30T10:40). Only the timestamp and a sampled detail line
  moved, so the file was restored to its pinned bytes.

## 8. Which scoreboard should move — stated before any measurement

- **The lab:** this probe, red to green. It moved.
- **The census:** no tag row covers forme-change arithmetic. It should stay at 1027, and it did.
- **The whole-game pool (`data/team-pool-frozen-regmc`):** the mega half cannot move it. `game_differential.js`
  `spreadFor` puts nothing into HP. The Palafin half can move it only in a game where a natured, invested Palafin
  switches out on a spread whose fractions do not cancel. Palafin appears in 148 of the 23,473 pool lines. All three
  lattices read 0 board-material on the last release. **Expected: still 0. A non-zero after the fix would be a
  regression, not a gain.**
- **The arena and ROTOM's world (SOLVER):** these do not move until `solver/xatu/worlds.js` `applySpread` stamps `_sp`
  (engine keys plus `hp`). Until then those bodies carry no `_sp` and both roads keep the delta (counted). This is
  SOLVER's file and was not touched.

## 9. Notes for SOLVER

- To take the fix, `applySpread` must set `m._sp = { hp, at, df, sa, sd, sp }` from the same spread. The mega
  recompute then gives the authority's line, including max HP, which `updateMaxHp` recomputes on a mega.
- Its comment ("a forme change never recomputes it ... `if (!this.maxhp)`") is right for `setSpecies` alone and for a
  temporary change. A permanent change also runs `updateMaxHp`. For megas this makes no difference today: in the Reg M-C dex,
  0 of 82 legal stone pairs change the HP base stat. But the reasoning is incomplete.

## OWED, NOT RUN

The engine moved, so the Reg M-C gate needs a re-run on a new release. Not run here: another agent holds the game slot.
The sequence matches `docs/_reports/2026-09-30-regmc-gate-rerun.md`. Main checkout, `ABRA_REGULATION=regmc`,
`SHOWDOWN_PATH` unset. Every step goes through `cmd.exe /c tools\lownode.cmd`, one at a time, and each log is checked
for its exit:

1. `node engine/engine_release.js cut "forme change recomputes from the set, HP SP included (abra/regmc 1.51.0): gate re-run"`,
   then force-track the release directory (`git add -f data/releases/<id>/`), as `97451d5fbf40` was.
2. `node tests/test-mechanics.js` -> expect 1027 / 0 / 1027. Pin by content digest to
   `data/verification/census-pin-regmc-<digest>.json`.
3. Lattices, each `node engine/game_differential.js --steering empirical --arm middle --end-state --release <id>
   --census data/verification/census-pin-regmc-<digest>.json --team-store data/team-pool-frozen-regmc --write --out <gate path>`
   with **`--games 1200`** (+ `--dump-games 2000 --dump-out data/verification/gd-regmc-<id>-dump.json`), **`--games 1600`**
   and **`--games 1900`** (the Reg M-C `LATTICE_GAMES` row in `engine/quarantine.js`). Expect 0 board-material and 0
   narration at all three. Compare `team_pool_digest` with 3c60452ad2c5 / 2d8e6931a914 / ede5538f9153.
4. `node tests/test-engine-diff.js --n 6000 --seed 20260804`: expect 0 / 6000 at every corner.
5. `node tests/roster.js --stage items --reds --write`, then `--stage abilities`, then `--stage moves`: expect 166/166,
   210/214, 510/511.
6. `node engine/all_mechanics_fire.js --kind all --write`: expect 0 threw, 0 diverge.
7. `node engine/register_reality.js`. It exits 1 on register hygiene. That is not a gate clause.
8. `node engine/quarantine.js --regulation regmc`: expect OPEN, 10 of 10.
9. `node tests/test-nature-differential.js` on the new release. Part 7 is the item from section 7.
10. `node engine/status.js --write`, a RUNNING-NOTES row, and a CHANGELOG-REGMC patch for the re-run.

`node engine/status.js --write` was NOT run for this commit. In this worktree it ran past 600 s without writing and
was stopped by its own `timeout`. A worktree has no stores, and a worktree `--write` can stamp missing files as fact.
So the generated blocks in `docs/*.md` are restamped from the main checkout after the merge (step 10).

Also owed, not ENGINE's: SOLVER stamps `_sp` in `applySpread` (section 9), then re-measures any arena figure that
megas or plays Palafin. An arena figure measured before that stamp stays on the old stat path.
