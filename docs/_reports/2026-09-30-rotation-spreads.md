# ROTOM's ladder spreads: from one flat spread to one per role (abra/regmc 1.35.0)

2026-09-30. SOLVER. Branch `worktree-agent-ad709405a9532c067`, based on `worktree-agent-ac90042e1051cc68c` (the
top-meta rotation, not yet on main) with `origin/main` merged in. No ladder game was played and no arena game was
needed. The main checkout was not touched.

## Verdict

Every set in both ladder rotations had the same spread: 32 HP, 32 in its attacking stat and 2 Speed
(`build_assets.js` `spreadFor`, 60 of 60 sets). So each Choice Scarf and Tailwind set ran 2 Speed, and each Trick Room
setter ran 2 Speed above its minimum. That is fixed. `solver/rotom/spreads.js` uses a Reg M-C observed spread first
(none exists yet) and otherwise derives one from the set's role against the top-meta population, using only the
checkout's own stat, speed and damage code. Both rotations are re-spread in place; the teams, sheets, natures and
bring are unchanged. All ten fast-role sets are now at Speed SP 32, and both Trick Room setters are at 0. Every team
passes `TeamValidator` for `gen9championsvgc2026regmcbo3`.

## 1. Where the spreads came from (before)

- `solver/rotom/build_assets.js` `spreadFor(row)`: `{hp: 32, <atk or spa by move-category count>: 32, spe: 2}`, the
  same for every set. `packTeam` applied it.
- `solver/rotom/build_ladder_teams.js` (the default `ladder-rotation.json`) and `solver/rotom/build_top_rotation.js`
  (on the top-meta branch, `ladder-rotation-top.json`) both called `BA.packTeam(rows)`. Both files stated the same
  `spread_rule` string.
- The nature was the sheet's. The IVs are 31, and the format enforces that: the validator returns "this format
  requires all IVs to be 31" for a Speed IV of 0. So SP and the sheet's nature are the only speed levers.
- Checked from the format and the code, not from the brief: `TeamValidator.get(gen9championsvgc2026regmcbo3)`
  `ruleTable.evLimit` = 66. 33 in one stat returns "more than 32 Stat Points in HP", and 67 in total returns "more
  than this format's limit of 66". The stat formula is the champions mod `statModify`
  (`pokemon-showdown-mc/data/mods/champions/scripts.ts` lines 10-35): `stat = base + SP + 20`, then the nature's
  x1.1 / x0.9 (HP `base + SP + 75`, no nature). So the nature applies after SP.

## 2. Is there Reg M-C spread data? No

- `data/smogon-stats/` holds 2026-06, 2026-07 and 2026-08 only, and every file is `gen9championsvgc2026regmb*`. Reg M-B
  data does not count, and none of it is read.
- The store's sheets carry `evs: null` on every slot, and the raw `|showteam|` lines leave the EV field empty (read from
  `data/raw/games.gen9championsvgc2026regmcbo3/20260930T0021-00.jsonl.gz`). So open sheets do not carry spreads.
- XATU (`solver/xatu/spreads.js`) holds a per-game belief over spreads, pruned from turn order and damage. It writes no
  aggregate table, and its prior is uniform. There is nothing to read from it.

## 3. The method (after)

`solver/rotom/spreads.js`, `Deriver.spreadFor(row)`:

1. **Observed (the hook).** `findObserved()` takes the newest `data/smogon-stats/<YYYY-MM>/moveset/<FORMAT>-<cutoff>.txt`
   with the highest cutoff, and matches the format name exactly, so no Reg M-B file can match. `parseMoveset` reads each
   species' `Spreads` block (`Nature:hp/atk/def/spa/spd/spe pct%`). `observedSpread` takes the highest-share spread for
   the species **with the sheet's nature**; the nature belongs to the pilot and is never overridden. A spread over the
   total or the cap is refused. Today `findObserved()` returns null, so 0 of 60 sets are observed.
   **To use the September 2026 Smogon files (due about 2026-10-04):** put `gen9championsvgc2026regmcbo3-<cutoff>.txt`
   under `data/smogon-stats/2026-09/moveset/`, then run
   `node solver/rotom/respread.js --store <bo3 store> solver/rotom/teams/ladder-rotation.json solver/rotom/teams/ladder-rotation-top.json`.
   A set whose species and nature appear there takes the observed spread (`source: observed:<file> (<pct>%)`). Any
   other set still derives. `test-rotom-spreads.js` HOOK checks that the files' `observed` provenance names what
   `findObserved()` finds, so the new file will turn that clause RED until the rotations are re-spread.
2. **Derived.** The population is the distinct (player, six) teams at or above the top-meta floor, each read from its
   highest-rated complete sheet, and every slot weighs 1/teams. The floor, the quality filter and the sides are
   `build_top_rotation.topSides`, now shared, so the teams and the spreads read one sample. On the store the top
   rotation was built from (sha256 `fe78202a8515`, extracted from `27825c32` to
   `solver/out/rotom/store-fe78202a.jsonl.gz`) that is floor 1409, 148 teams, 888 slots and 384 distinct sets.
   - **Role, from the set alone.** Choice Scarf or Tailwind gives `fast`, and Trick Room gives `trickroom`. A set with
     both counts as `other` and is named; none exists.
   - **Speed.** `fast` gets the cap (32) and `trickroom` gets 0. An `other` set gets the least SP whose *effective*
     speed exceeds the population's weighted median effective speed, with every member at the top of its speed
     options (Trick Room at 0), or 0 if the cap cannot reach it. Effective speed is the sim's `getActionSpeed` on a
     neutral field, which includes the Scarf, the mega forme and abilities. The benchmark is **138**.
     *A fixed point was tried first:* the median of the rule's own output. It does not exist. Best-responding to the
     median creeps it up 114 -> 115 -> ... -> 138, and then it falls back to 128 and cycles, which is speed creep. So
     the benchmark is stated against full investment. The code throws on a cycle, and that is how this was found.
   - **Bulk.** Every population set attacks with its strongest move. The damage is the sim's `getDamage` through
     `solver/xatu/sd.js` `damageRange`: top roll, no crit, spread moves at the spread modifier, a fixed multi-hit count
     multiplied, the attacker at 32 SP in its attacking stat with its own nature, neutral field, both at full HP, and
     mega formes for both. A hit is survived when its damage is below this set's HP. A set whose item or ability
     endures any hit from full HP survives all of them; the sim's `Damage` event decides this, and it is Focus Sash on
     4 sets. Bulk is the least HP+Def+SpD SP that survives at least half the attacker weight, or 0 if the set already
     does, or 0 if no split within the budget can. This step bought bulk on **16 of 60** sets.
   - **Attack.** The rest goes to the attacking stat its moves use more (dex category, the base stat breaks a tie), up
     to 32.
   - **Remainder.** Whatever the cap leaves goes to the HP/Def/SpD split that survives the most attacker weight. Ties
     go to more HP, then Def.

   The only free parameter is the median (0.5). The rest is either the format's rules or the sim's output.
3. **Recorded.** Each team gets a `spreads[6]` entry per set: SP vector, `source`, `role`, `speed` {sp, effective,
   median} and `bulk` {why, share_survived, share_at_zero, endures}. Each file gets `spread_rule` and `spread_source`:
   store, sha256, floor, population, benchmark, and the counters (17,281 staged battles, 1,318,100 damage calls, 2,687
   no-damage moves, 4 enduring sets, 0 observed, 60 derived). The plan digest hashes `rotation.teams`, so the spreads
   are in it. `solver/rotom/ladder.js` adds `spreads` (hp/atk/def/spa/spd/spe per slot) and `spread_source` to every
   series row's `team_meta`.

## 4. Before and after, every set

Speed stat = the sim's `statModify` at the set's own nature (mega forme if it holds its stone). Effective = with the
item and ability. "Survived" is the share of top-meta attacker weight whose best hit the set survives: at 0 bulk SP,
then with the new spread.

### `solver/rotom/teams/ladder-rotation.json` (the default rotation, L1-L5)

| team | Pokemon | item | nature | role | before hp/atk/def/spa/spd/spe | after | Speed stat before -> after (effective) | survived: 0 bulk -> after |
|---|---|---|---|---|---|---|---|---|
| L1 | Gengar | Gengarite | Timid | other | 32/0/0/32/0/2 | 29/0/3/32/2/0 | 167 -> 165 (165) | 0.384 -> 0.634 |
| L1 | Incineroar | Sitrus Berry | Impish | other | 32/32/0/0/0/2 | 29/32/0/0/5/0 | 82 -> 80 (80) | 0.696 -> 0.773 |
| L1 | Rillaboom | Miracle Seed | Adamant | other | 32/32/0/0/0/2 | 20/32/1/0/13/0 | 107 -> 105 (105) | 0.533 -> 0.708 |
| L1 | Kingambit | Life Orb | Adamant | other | 32/32/0/0/0/2 | 32/32/0/0/2/0 | 72 -> 70 (70) | 0.577 -> 0.715 |
| L1 | Hippowdon | Leftovers | Careful | other | 32/32/0/0/0/2 | 6/32/0/0/28/0 | 69 -> 67 (67) | 0.784 -> 0.847 |
| L1 | Sneasler | White Herb | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| L2 | Indeedee-F | Sitrus Berry | Bold | trickroom (Trick Room) | 32/0/0/32/0/2 | 4/0/30/32/0/0 | 107 -> 105 (105) | 0.57 -> 0.822 |
| L2 | Gardevoir | Gardevoirite | Modest | other | 32/0/0/32/0/2 | 6/0/9/32/0/19 | 122 -> 139 (139) | 0.505 -> 0.562 |
| L2 | Sneasler | Psychic Seed | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| L2 | Basculegion | Choice Scarf | Jolly | fast (Choice Scarf) | 32/32/0/0/0/2 | 0/32/2/0/0/32 | 110 -> 143 (214) | 0.539 -> 0.565 |
| L2 | Pelipper | Focus Sash | Modest | fast (Tailwind) | 32/0/0/32/0/2 | 2/0/0/32/0/32 | 87 -> 117 (117) | 1 -> 1 (endures) |
| L2 | Archaludon | Leftovers | Modest | other | 32/0/0/32/0/2 | 8/0/0/32/26/0 | 107 -> 105 (105) | 0.67 -> 0.805 |
| L3 | Salamence | Salamencite | Timid | fast (Tailwind) | 32/0/0/32/0/2 | 2/0/0/32/0/32 | 156 -> 189 (189) | 0.731 -> 0.731 |
| L3 | Raichu | Raichunite Y | Timid | other | 32/0/0/32/0/2 | 23/0/0/32/11/0 | 167 -> 165 (165) | 0.391 -> 0.551 |
| L3 | Sneasler | Grassy Seed | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| L3 | Rillaboom | Miracle Seed | Adamant | other | 32/32/0/0/0/2 | 20/32/1/0/13/0 | 107 -> 105 (105) | 0.533 -> 0.708 |
| L3 | Kingambit | Chople Berry | Adamant | other | 32/32/0/0/0/2 | 20/32/0/0/14/0 | 72 -> 70 (70) | 0.634 -> 0.816 |
| L3 | Volcarona | Leftovers | Modest | other | 32/0/0/32/0/2 | 6/0/9/32/0/19 | 122 -> 139 (139) | 0.679 -> 0.727 |
| L4 | Rillaboom | Miracle Seed | Adamant | other | 32/32/0/0/0/2 | 20/32/1/0/13/0 | 107 -> 105 (105) | 0.533 -> 0.708 |
| L4 | Arcanine-Hisui | Focus Sash | Jolly | other | 32/32/0/0/0/2 | 17/32/0/0/0/17 | 123 -> 139 (139) | 1 -> 1 (endures) |
| L4 | Dragonite | Dragoninite | Modest | fast (Tailwind) | 32/0/0/32/0/2 | 2/0/0/32/0/32 | 122 -> 152 (152) | 0.971 -> 0.971 |
| L4 | Raichu | Raichunite Y | Timid | other | 32/0/0/32/0/2 | 23/0/0/32/11/0 | 167 -> 165 (165) | 0.391 -> 0.551 |
| L4 | Gholdengo | Life Orb | Modest | other | 32/0/0/32/0/2 | 28/0/0/32/6/0 | 106 -> 104 (104) | 0.591 -> 0.717 |
| L4 | Garchomp | Sitrus Berry | Adamant | other | 32/32/0/0/0/2 | 14/32/3/0/0/17 | 124 -> 139 (139) | 0.734 -> 0.773 |
| L5 | Corviknight | Psychic Seed | Impish | other | 32/32/0/0/0/2 | 22/32/1/0/11/0 | 89 -> 87 (87) | 0.755 -> 0.905 |
| L5 | Tyranitar | Tyranitarite | Jolly | other | 32/32/0/0/0/2 | 26/32/8/0/0/0 | 102 -> 100 (100) | 0.545 -> 0.62 |
| L5 | Sneasler | White Herb | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| L5 | Indeedee | Choice Scarf | Modest | fast (Choice Scarf) | 32/0/0/32/0/2 | 14/0/0/20/0/32 | 117 -> 147 (220) | 0.385 -> 0.503 |
| L5 | Salamence | Salamencite | Timid | other | 32/0/0/32/0/2 | 7/0/0/32/27/0 | 156 -> 154 (154) | 0.731 -> 0.801 |
| L5 | Excadrill | Focus Sash | Adamant | other | 32/32/0/0/0/2 | 3/32/0/0/0/31 | 110 -> 139 (139) | 1 -> 1 (endures) |

### `solver/rotom/teams/ladder-rotation-top.json` (the top-meta rotation, arm `gen5-chomp-top.json`, T1-T5)

| team | Pokemon | item | nature | role | before hp/atk/def/spa/spd/spe | after | Speed stat before -> after (effective) | survived: 0 bulk -> after |
|---|---|---|---|---|---|---|---|---|
| T1 | Kingambit | Focus Sash | Adamant | other | 32/32/0/0/0/2 | 32/32/2/0/0/0 | 72 -> 70 (70) | 1 -> 1 (endures) |
| T1 | Garchomp | Life Orb | Jolly | other | 32/32/0/0/0/2 | 6/32/0/0/23/5 | 136 -> 139 (139) | 0.734 -> 0.801 |
| T1 | Charizard | Charizardite Y | Modest | other | 32/0/0/32/0/2 | 14/0/0/32/1/19 | 122 -> 139 (139) | 0.691 -> 0.75 |
| T1 | Sylveon | Fairy Feather | Modest | other | 32/0/0/32/0/2 | 7/0/26/32/1/0 | 82 -> 80 (80) | 0.609 -> 0.813 |
| T1 | Farigiraf | Sitrus Berry | Bold | trickroom (Trick Room) | 32/0/0/32/0/2 | 20/0/10/32/4/0 | 82 -> 80 (80) | 0.824 -> 0.902 |
| T1 | Aerodactyl | Aerodactylite | Jolly | fast (Tailwind) | 32/32/0/0/0/2 | 2/32/0/0/0/32 | 189 -> 222 (222) | 0.581 -> 0.59 |
| T2 | Salamence | Salamencite | Timid | fast (Tailwind) | 32/0/0/32/0/2 | 2/0/0/32/0/32 | 156 -> 189 (189) | 0.731 -> 0.731 |
| T2 | Raichu | Raichunite Y | Timid | other | 32/0/0/32/0/2 | 23/0/0/32/11/0 | 167 -> 165 (165) | 0.391 -> 0.551 |
| T2 | Sneasler | Grassy Seed | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| T2 | Rillaboom | Miracle Seed | Adamant | other | 32/32/0/0/0/2 | 20/32/1/0/13/0 | 107 -> 105 (105) | 0.533 -> 0.708 |
| T2 | Gholdengo | Life Orb | Timid | other | 32/0/0/32/0/2 | 3/0/8/32/0/23 | 116 -> 139 (139) | 0.591 -> 0.622 |
| T2 | Arcanine-Hisui | Focus Sash | Jolly | other | 32/32/0/0/0/2 | 17/32/0/0/0/17 | 123 -> 139 (139) | 1 -> 1 (endures) |
| T3 | Incineroar | Sitrus Berry | Careful | other | 32/32/0/0/0/2 | 21/32/0/0/13/0 | 82 -> 80 (80) | 0.684 -> 0.795 |
| T3 | Rillaboom | Miracle Seed | Adamant | other | 32/32/0/0/0/2 | 20/32/1/0/13/0 | 107 -> 105 (105) | 0.533 -> 0.708 |
| T3 | Sneasler | Grassy Seed | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| T3 | Floette-Eternal | Floettite | Modest | other | 32/0/0/32/0/2 | 15/0/2/32/0/17 | 124 -> 139 (139) | 0.644 -> 0.702 |
| T3 | Gholdengo | Choice Scarf | Modest | fast (Choice Scarf) | 32/0/0/32/0/2 | 1/0/1/32/0/32 | 106 -> 136 (204) | 0.591 -> 0.601 |
| T3 | Dragonite | Dragoninite | Modest | fast (Tailwind) | 32/0/0/32/0/2 | 2/0/0/32/0/32 | 122 -> 152 (152) | 0.971 -> 0.971 |
| T4 | Rillaboom | Miracle Seed | Adamant | other | 32/32/0/0/0/2 | 20/32/1/0/13/0 | 107 -> 105 (105) | 0.533 -> 0.708 |
| T4 | Kingambit | Life Orb | Adamant | other | 32/32/0/0/0/2 | 32/32/0/0/2/0 | 72 -> 70 (70) | 0.577 -> 0.715 |
| T4 | Sneasler | Grassy Seed | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |
| T4 | Arcanine-Hisui | Focus Sash | Jolly | other | 32/32/0/0/0/2 | 17/32/0/0/0/17 | 123 -> 139 (139) | 1 -> 1 (endures) |
| T4 | Froslass | Froslassite | Timid | other | 32/0/0/32/0/2 | 19/0/5/32/10/0 | 156 -> 154 (154) | 0.392 -> 0.541 |
| T4 | Raichu | Raichunite Y | Timid | other | 32/0/0/32/0/2 | 23/0/0/32/11/0 | 167 -> 165 (165) | 0.391 -> 0.551 |
| T5 | Froslass | Froslassite | Timid | other | 32/0/0/32/0/2 | 19/0/5/32/10/0 | 156 -> 154 (154) | 0.392 -> 0.541 |
| T5 | Rillaboom | Occa Berry | Adamant | other | 32/32/0/0/0/2 | 31/32/0/0/3/0 | 107 -> 105 (105) | 0.682 -> 0.838 |
| T5 | Volcarona | Grassy Seed | Modest | other | 32/0/0/32/0/2 | 6/0/9/32/0/19 | 122 -> 139 (139) | 0.679 -> 0.727 |
| T5 | Kingambit | Life Orb | Adamant | other | 32/32/0/0/0/2 | 32/32/0/0/2/0 | 72 -> 70 (70) | 0.577 -> 0.715 |
| T5 | Garchomp | Choice Scarf | Adamant | fast (Choice Scarf) | 32/32/0/0/0/2 | 2/32/0/0/0/32 | 124 -> 154 (231) | 0.734 -> 0.734 |
| T5 | Sneasler | White Herb | Adamant | other | 32/32/0/0/0/2 | 16/32/17/0/1/0 | 142 -> 140 (140) | 0.43 -> 0.66 |

## 5. Validation and tests

- `solver/rotom/respread.js` re-validated every team and asserted that only `evs` changed (unpack, drop `evs`,
  compare). It would have refused to write otherwise. The run took 1,357 s on a loaded machine
  (`solver/out/rotom/respread-run.log`).
- `node solver/tests/test-rotom-spreads.js`: **GREEN 23/23**, which includes REPRODUCE. That clause re-derived the
  benchmark (138) and one fast, one Trick Room and one other set on the pinned store, and all three were identical.
  **RED** under `--break scarf` (Aerodactyl 31 and Basculegion 31 reported "not the top of its speed options"),
  `--break trickroom` (Farigiraf 1 and Indeedee-F 1: "not the bottom"), and `--break record` (a recorded spread that
  differs from the packed team). It was also RED on the old files: every fast set at SP 2 and every Trick Room set at 2.
- `node solver/tests/test-rotom-top-rotation.js`: **GREEN 9/9**. REBUILD printed NOT CHECKED because the live store has
  moved (`fe78202a8515` -> `3e5affee9991`). Run by hand on the pinned store,
  `build({store: pinned, deriver: SP.recorded(ROT)})` reproduced the floor (1409) and every team's `from_game`,
  `packed`, `bring` and `spreads` byte for byte.
- `node solver/tests/test-rotom-ladder.js`: **GREEN 142/142**. Also run: `test-rotom-chomp-live` 13/13 and
  `test-rotom-throttle` 33/33. The throttle test needs `SHOWDOWN_PATH` set in a worktree: its part B child cannot find
  `../pokemon-showdown-mc` from `.claude/worktrees/`. That is environmental and was not caused by this change.
- The REPRODUCE clause needs the pinned store on disk. `solver/out/` is gitignored; to restore the bytes, run
  `git show 27825c32:data/games.gen9championsvgc2026regmcbo3.jsonl.gz > solver/out/rotom/store-fe78202a.jsonl.gz`.
  Without it the clause prints NOT CHECKED, named, and does not count as a pass.

## 6. What this does not model (stated, not hidden)

- Neutral field. There is no weather, terrain, Intimidate, screens, Helping Hand or Tailwind in the bulk and speed
  calculations. A Charizard-Y set's own sun, a Grassy Seed or Weather Ball typing is not in its hits.
- The attacker is assumed to have 32 SP in its attacking stat. Its real spread is unknown for the same reason ours was.
- Multi-hit moves with a variable count use the minimum (the maximum with Skill Link). OHKO moves are skipped.
- A Trick Room *teammate* is not driven to 0 by its team; it gets 0 only if it cannot reach the benchmark anyway.
  Every slow set in these rotations does get 0. The ROLE test covers the setter only.
- A Focus Sash set gets its leftover SP in HP by the tie rule (Kingambit T1 32 HP). That costs nothing and gains
  nothing.

## OWED, NOT RUN

- **The ladder run with the re-spread top rotation** is Will's call, from the main checkout after chomp1 ends and this
  branch and `worktree-agent-ac90042e1051cc68c` are merged. The command is the one in
  `docs/_reports/2026-09-30-top-meta-rotation.md` §OWED, unchanged. The plan digest will differ, because the rotation
  file changed. Residuals from any series on the old spreads (chomp1, live now) are not pooled with it.
- **`node engine/status.js --write`**: not run. It must run from the main checkout, and the main checkout is serving a
  live ladder run until about 21:45. Run it after the merge.
- **Smogon September 2026 Reg M-C files** (due about 2026-10-04): drop them in and re-spread (§3.1). The observed
  spreads then replace the derived ones set by set.
- **The offline pool** `solver/rotom/teams/regmc-pool.json` keeps the flat spread (arena baselines read it).
  Re-spreading it would move offline figures, so it needs its own row if done.
- **Performance.** 60 sets took 23 minutes on a loaded machine, mostly one staged battle per (set, attacker) pair.
  The next rebuild could reuse one battle per defender. This is not needed for correctness.
