# The gate on `18773c22878f`, and the held-out 12,000-game draw — 2026-09-19, ENGINE (measure only)

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state. No engine byte changed in
this pass; nothing was fixed, and no version beyond the brief's 6.71.0 is declared here.

---

## 0. VERDICT

- **The gate is OPEN on the three lattices and it is a statement about those three lattices.**
  `node engine/quarantine.js` prints `GATE: OPEN — MEDICHAM passes both conditions; nothing is
  withheld`, all 10 gating clauses PASS, board-material **0 / 0 / 0** and undeclared narration
  **0 / 0 / 0** at `--games` 1200 / 1350 / 1950.
- **The held-out draw refutes any reading of that as "the engine is correct".** One `--games 12000`
  run on the SAME release, census pin, team store, arm, cap and steering plays **7,178 usable games**
  and parts **34 boards** (`state.games` − `state.games_board_never_diverged`). Quarantine's own
  `wholeGameClause`, handed this artifact, reads **36 of 7183** — it adds 2 void games whose
  `mid_void` tag carries a `board_parted_at_turn`. `narrationClause` on the same artifact reads
  **56 undeclared of 7183, across 66 causes** (79 narration-only raw, less 23 declared).
- **The corner arms part boards on the gate's own lattices.** At `--games` 1200 / 1350 / 1950 the
  `top-tie-first` arm parts **0 / 1 / 4** boards and `bottom-tie-first` parts **1 / 1 / 4**, where
  `middle` parts 0 / 0 / 0. The gate reads `middle` only.
- **Everything else the brief asked for is clean.** Battery 4,634 games, 0 threw, abilities FIRED
  **199 of 200** (Illusion, closeted, is the other), moves 497 of 497 resolved on both engines, items
  148 of 148, unearned FIRED **0**, control-arm board partings **0**. Roster items 148 / abilities 194
  (+6 deferred) / moves **495** (+2 deferred) MATCH with 0 DIFFER, 0 DID-NOT-FIRE, 0 COULD-NOT-STAGE
  and every red plant caught. Damage differential **0 of 6,000** at every index. Census **970 live /
  970 probed / 0 missing**.
- **So the answer to "what is left to finish MEDICHAM" is a list, and §4 is that list**: 34 board
  partings in one wide draw, grouped into 18 mechanisms, 4 of which account for 12 of the 34.

## 1. PINS — every run in this report shares them

| pin | value |
|---|---|
| release | `18773c22878f`, first cut `2026-09-19T21:50:22.269Z`, HEAD `dec05b65` (`eb80e54a` before the ingest rebase; the two differ only in `data/` and `docs/ORIENTATION.md`), CHANGELOG 6.70.0. `node engine/engine_release.js list`: **`0 of 27 files have moved since`**. `cuts.jsonl` holds 1 event, before and after every run in this pass |
| census (the steering pin) | `data/mechanics-census.json` as it stood at HEAD: generated `2026-09-19T20:41:52.493Z`, **970 live / 970 probed / 0 missing**, file digest `0c1d71e2a1bb`. Every differential artifact below stamps `steering.input_digest` **`0c1d71e2a1bb`**, including the 12,000-game run and all six corner runs. The census was regenerated AFTER every differential run (§5) |
| team store | `--team-store data/team-pool-frozen`. Pools: `0d103fb9fa87` (1200), `7e7a37ded7fc` (1350), `a5ce76242f8d` (1950) — the same three as `6180c4712761` — and **`e398641bda45`** for the 12,000-game draw, which is therefore a different lattice from all three gate samples |
| driver | `steering.driver_code.digest` **`faf70ecbca71`** over 12 files on every run, and each run printed that it held still during play. Unmoved since `6180c4712761`, so those lattices ARE comparable with this pass's |
| mode | `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real` on the four middle runs; `A/top-tie-first/pins:7759a509491f/…` and `A/bottom-tie-first/pins:844515f6a72a/…` on the corners |
| flags | `--steering empirical --release 18773c22878f --arm <arm> --end-state --census data/mechanics-census.json --team-store data/team-pool-frozen --games <N> --write --out <path> --dump-games <400\|4000> --dump-out <relative path>`. `turns_cap` **50** in every artifact. **`--games` is part of the sample definition, not a budget**, and is stated on every row below |
| launcher | A node script in this session's scratchpad (`1877_run.js`, written with the Write tool, no file of that name existed) spawns `cmd.exe /c tools\lownode.cmd <argv>` — the argv route `tools/lownode.cmd`'s own header documents — with `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`. `tools/lownode.cmd` derives the ABRA-HEAP marker itself: `engine/game_differential.js` declares **8192 MB** in its header (measured 2026-09-12 on exactly this 12,000-game case), so no flag had to be typed |
| concurrency | Every process was mine; I was the only agent. The 12,000-game run overlapped the battery, the roster chain, the damage differential and the corner runs, all of which write DIFFERENT artifacts and none of which the differential reads. The census rewrite, `quarantine.js` and `coverage.js` were run strictly after every writer had exited |

## 2. THE THREE GATE LATTICES — unchanged at 0 / 0 / 0

| `--games` | artifact | games | **board-material** | protocol diverged | threw | boundaries identical | generated | wall |
|---|---|---|---|---|---|---|---|---|
| 1200 | `data/game-differential.json` | 961 | **0** | 0 | **0** | 10716 / 10716 | 22:09:07Z | 542 s |
| 1350 | `data/game-differential.g1350.json` | 1069 | **0** | 1 | **0** | 11856 / 11856 | 22:09:46Z | 573 s |
| 1950 | `data/game-differential.g1950.json` | 1497 | **0** | 2 | **0** | 16725 / 16725 | 22:11:03Z | 644 s |

Board-material is `state.games` − `state.games_board_never_diverged`, never a capped list and never
`by_cause_totals.games_board_material`. The three protocol divergences are the same declared Supreme
Overlord `fallenundefined` games as on `6180c4712761`, at the same seeds: `…2661010853` (1350,
pair-speedctrl), `…2663628673` and `…2656799052` (1950, omit-weather and pair-redirect-priority).
Every `generated` stamp moved from 19:45–19:48Z to the times above.

## 3. THE GATE, CLAUSE BY CLAUSE

`node engine/quarantine.js` at HEAD bytes, run once, after every artifact below had been written and
with no other writer live. Exit 0. **`GATE: OPEN — MEDICHAM passes both conditions; nothing is
withheld`, 10 of 10 gating clauses PASS.**

| clause | reading |
|---|---|
| game differential (damage) | **PASS** — midpoint 0 of 6000, top 0/6000, bottom 0/6000, idx01–idx14 0/6000, seed 20260804 |
| deliberate roster / items | **PASS** — clean, 148 of 148 tested |
| deliberate roster / abilities | **PASS** — clean, 194 of 200 tested |
| deliberate roster / moves | **PASS** — clean, **495** of 497 tested (494 on `6180c4712761`; Axe Kick joined) |
| coverage / every used mechanic is measured | **PASS** — all 412 moves above 25 clicks are measured by the roster or the census |
| board leaves / nothing uncompared at a boundary | **PASS** — 0 standing, 56 compared, `BS.snapshot` has 1 call site |
| whole-game BOARD-MATERIAL, on EVERY lattice | **PASS** — `ZERO ON EVERY LATTICE`: 0 of 961, 0 of 1069, 0 of 1497 |
| whole-game NARRATION, on EVERY lattice | **PASS** — `ZERO ON EVERY LATTICE`: raw 0 / 1 / 2, all declared |
| mechanics / each staged and compared | **PASS** — 0 diverge, 0 declared, 0 below the shelf; PROOF: every in-scope row proven; owner-excused **1** (`ability:illusion`, closet); CONTROL WATCH 42 live-control rows, **42 earned, 0 unearned**; CONTROL ARMS 2 of 841 parted, **none on a board** (both announcement-only, both owner-shelved Illusion carriers); 3 shelved by the owner |
| no open, known engine defect | **PASS** — no open row names a RED instrument (194 verdicts read); 11 NOT-A-DEFECT rows excused |

Two things the gate printed that are not clauses and are reported rather than filed:

- **`STALE VERDICTS`** — `data/register-reality.json` was generated `2026-09-12T11:43:20Z`, older than
  `docs/ROADMAP.md` (`2026-09-19T15:16:30Z`). Rows added or re-marked since are judged on a verdict
  that predates them. Re-run: `node engine/register_reality.js`. **18 open rows assert breakage with
  no instrument that decides them** (#397, #400, #175, #207, #284, #285, #67, #365, #367, #393, #421,
  #423, #441, #473, #495, #507, #530, #550) and **2 name an instrument that is GREEN** (#310, #442).
- **69 downstream artifacts are listed RE-RUNNABLE**, not current (ROADMAP #57).

`node engine/coverage.js`:

| row | now (was, on `6180c4712761`) |
|---|---|
| board leaves compared | 56 (56); 0 uncompared leaves can stand at a boundary |
| uncomparable leaves with a firing writer | 23 of 24 (23 of 24) |
| move leaves whose EFFECT was exercised | 7 of 11 (7 of 11) |
| staged mechanics that fired | **844 of 845** (843 of 845) — moves 497/497, abilities 199/200, items 148/148 |
| fired mechanics with a board compared | **844 of 845** (843 of 845) |
| tags with an engine consumer | 299 of 301 (299 of 301) |
| turn boundaries compared | 10716 (10716) |
| entities exercised in a real game | **861 of 902** (860 of 901) |

## 4. THE HELD-OUT DRAW — `--games 12000`, AND THE NEXT FIX WAVE

One run, same pins as §1, written to its own files so no gate artifact was touched:
`--out data/verification/game-differential.g12000.json`,
`--dump-games 4000 --dump-out data/_1877_dump_g12000.json`. Started 22:12:44Z, finished 23:05:52Z
(53 minutes), exit 0.

| quantity | reading |
|---|---|
| games | **7,178 usable** (+5 void, 7,183 before the void exclusion); 0 cut off by the turn cap |
| **board-material** | **34** = 7,178 − 7,144 whose board never diverged. Quarantine's `wholeGameClause` on this artifact: **36 of 7183**, the 34 plus 2 void games whose `mid_void` tag carries a `board_parted_at_turn` |
| **undeclared narration** | `narrationClause` on this artifact: **56 of 7183 across 66 causes** — 79 narration-only raw, less 23 declared, 0 cleared on decision impact |
| protocol diverged | **111** in `state` (the dump reports 113 diverged in the arm and shows 111; the 2-game gap is the void exclusion and is not independently confirmed — see OWED) |
| threw | **0** |
| turn boundaries | 79,474 identical of 79,623 compared |
| board parted before the protocol did | **3** |
| pool | `e398641bda45` — a lattice none of the three gate samples draws |

**The 113 protocol divergences by class**, from the full dump (not a capped list): event missing from
medicham2 45, unrelated event mismatch 22, ordering 16, extra event emitted by medicham2 11, `-fail`
on a different body 6, `-damage` field 3 5, `-unboost` on a different body 2, `cant` on a different
body 1, `-fail` field 3 1, `move` field 3 1, medicham2 stopped emitting 1. **23 of them are the
declared Supreme Overlord `fallenundefined`**, and the largest undeclared narration bucket is a bare
`|-fail|` medicham2 never writes (6 games as a first divergence, plus 6 more where the two engines
`-fail` different bodies).

**THE 34 BOARD PARTINGS, GROUPED.** The grouping is mine, from the board leaves and the game's first
protocol divergence; the counts are exact, the attribution is a lead rather than a diagnosis. **A
game records only its FIRST divergence, and the first PROTOCOL divergence is not necessarily the
cause of the board parting** — that confusion cost three batches on 2026-09-06 and is not repeated
here.

| mechanism | games | which |
|---|---|---|
| Protect: the activation and the consecutive-use `stall` counter (ours reads 0 where the authority reads 3 or 9) | **4** | 1, 4, 9, 21 |
| flinch: who flinches, or whether the click happens at all | **4** | 7, 18, 26, 31 |
| a status (burn) landing in one engine and not the other, or cured in one | **4** | 3, 6, 27, 29 |
| trapping volatiles: `vol.trapped`, `vol.trapped_by_move`, an Infestation that ends in one engine | **3** | 12, 24, 32 |
| a damage value or a KO threshold | **3** | 11, 16, 22 |
| a spread `-unboost` landing on the wrong body (Whimsicott / Clefable, twice) | **2** | 5, 10 |
| Fickle Beam | **2** | 28, 33 |
| recoil: the line's order and the faint it causes | **2** | 2, 25 |
| Disguise | 1 | 8 |
| Armor Tail refusing Fake Out | 1 | 17 |
| Heal Block refusing Drain Punch | 1 | 23 |
| Cursed Body's Disable on Struggle | 1 | 30 |
| Bug Bite's steal-eat against Rough Skin's KO | 1 | 19 |
| accuracy: a `-miss` one engine does not draw | 1 | 13 |
| spread order: `-resisted` against the second target's `-damage` | 1 | 14 |
| a boost that lands in the opposite direction (`-unboost` vs `-boost`) | 1 | 15 |
| a faint queued in one engine and not the other (a mega body stands behind it) | 1 | 20 |
| Trick Room: a different move resolves in `move` field 3 | 1 | 34 |

**Three of the 34 part a board before the protocol parts** (`state.board_parted_before_the_protocol_did`
= 3): rows 4 and 12 below never diverge in narration at all (the Protect `stall` counter and a
`vol.trapped`), and row 32's board parts at turn 9 while its first protocol divergence is at turn 12.
Those three could not have been found by reading narration.

Every parting game, with its lattice seed, its first-divergence line and both board leaves:

```text
 1. baseline  turn 8  seed gen9championsvgc2026regmbbo3-2659324893
    first divergence: unrelated event mismatch :: |-activate|p1a|protect <> |move|p1a|partingshot
    board: p1.party.talonflame.hp   us=140  showdown=153
    board: p1.active[0].species   us="talonflame"  showdown="hatterene"
    board: p1.active[0].hp   us=140  showdown=132
    board: p1.active[0].maxhp   us=153  showdown=132
    board: p1.active[0].item   us="sharpbeak"  showdown="focussash"
    board: p1.active[0].types   us="fire/flying"  showdown="fairy/psychic"
    board: p1.active[0].ability   us="galewings"  showdown="magicbounce"
    board: p1.active[0].stall   us=0  showdown=3

 2. baseline  turn 19  seed gen9championsvgc2026regmbbo3-2663420926
    first divergence: extra event emitted by medicham2 :: |move|p1a|heatwave <> |-damage|p1b|H/H|[from]recoil
    board: p1.party.garchomp.hp   us=45  showdown=91
    board: p1.active[1].hp   us=45  showdown=91

 3. omit-weather  turn 9  seed gen9championsvgc2026regmbbo3-2654574813
    first divergence: extra event emitted by medicham2 :: |faint|p2b <> |-status|p1b|brn|[from]spicyspray
    board: p1.party.sinistcha.hp   us=75  showdown=84
    board: p1.party.sinistcha.status   us="brn"  showdown=""
    board: p1.active[1].hp   us=75  showdown=84
    board: p1.active[1].status   us="brn"  showdown=""

 4. omit-weather  turn 14  seed gen9championsvgc2026regmbbo3-2655134691
    first divergence: NO PROTOCOL DIVERGENCE — the board parted while the two streams agreed
    board: p2.active[1].stall   us=0  showdown=3

 5. omit-weather  turn 2  seed gen9championsvgc2026regmbbo3-2657156895
    first divergence: -unboost: a different body :: |-unboost|p2b|spd|2 <> |-unboost|p2a|spd|2
    board: p2.party.whimsicott.hp   us=1  showdown=38
    board: p2.party.whimsicott.item   us=""  showdown="focussash"
    board: p2.party.whimsicott.boosts.spd   us=-2  showdown=0
    board: p2.party.clefable.hp   us=95  showdown=21
    board: p2.party.clefable.boosts.spd   us=0  showdown=-2
    board: p2.active[0].hp   us=1  showdown=38
    board: p2.active[0].item   us=""  showdown="focussash"
    board: p2.active[0].last_item   us="focussash"  showdown=""

 6. omit-weather  turn 6  seed gen9championsvgc2026regmbbo3-2657243554
    first divergence: medicham2 stopped emitting while showdown continued :: |-curestatus|p1a|brn|[msg]
    board: p1.party.kingambit.status   us="brn"  showdown=""
    board: p1.active[0].status   us="brn"  showdown=""

 7. omit-weather  turn 1  seed gen9championsvgc2026regmbbo3-2657252654
    first divergence: unrelated event mismatch :: |move|p2b|overheat <> |cant|p2b|flinch
    board: p2.pp[1].overheat   us=0  showdown=1

 8. omit-weather  turn 4  seed gen9championsvgc2026regmbbo3-2658731303
    first divergence: unrelated event mismatch :: |-damage|p2b|H/H <> |-activate|p2b|disguise
    board: p2.party.mimikyu.species   us="mimikyubusted"  showdown="mimikyu"
    board: p2.party.mimikyu.hp   us=114  showdown=112
    board: p2.active[1].species   us="mimikyubusted"  showdown="mimikyu"
    board: p2.active[1].hp   us=114  showdown=112

 9. omit-weather  turn 1  seed gen9championsvgc2026regmbbo3-2659164097
    first divergence: unrelated event mismatch :: |-activate|p1a|protect <> |move|p1a|soak
    board: p2.party.bellibolt.types   us="water"  showdown="electric"
    board: p2.active[0].types   us="water"  showdown="electric"

10. omit-weather  turn 1  seed gen9championsvgc2026regmbbo3-2660074844
    first divergence: -unboost: a different body :: |-unboost|p2b|spd|2 <> |-unboost|p2a|spd|2
    board: p2.party.whimsicott.boosts.spd   us=-2  showdown=0
    board: p2.party.clefable.boosts.spd   us=0  showdown=-2
    board: p2.active[0].boosts.spd   us=-2  showdown=0
    board: p2.active[1].boosts.spd   us=0  showdown=-2

11. omit-intimidate  turn 5  seed gen9championsvgc2026regmbbo3-2654352872
    first divergence: -damage field 3 :: |-damage|p2a|H/H <> |-damage|p2a|0fnt
    board: p2.party.froslass.hp   us=0  showdown=6
    board: p2.party.froslass.fainted   us=true  showdown=false
    board: p2.party.froslass.status   us="fnt"  showdown=""
    board: p2.active[0].species   us="ninetalesalola"  showdown="froslassmega"
    board: p2.active[0].hp   us=148  showdown=6
    board: p2.active[0].maxhp   us=148  showdown=145
    board: p2.active[0].item   us="lightclay"  showdown="froslassite"
    board: p2.active[0].types   us="fairy/ice"  showdown="ghost/ice"

12. omit-intimidate  turn 8  seed gen9championsvgc2026regmbbo3-2654505540
    first divergence: NO PROTOCOL DIVERGENCE — the board parted while the two streams agreed
    board: p2.active[0].vol.trapped   us=1  showdown=0

13. omit-intimidate  turn 5  seed gen9championsvgc2026regmbbo3-2655224585
    first divergence: unrelated event mismatch :: |-damage|p1b|H/H <> |-miss|p2b|p1b
    board: p1.party.garchomp.hp   us=116  showdown=84
    board: p1.active[1].hp   us=116  showdown=84

14. omit-intimidate  turn 3  seed gen9championsvgc2026regmbbo3-2656656403
    first divergence: unrelated event mismatch :: |-resisted|p2b|1 <> |-damage|p2a|H/H
    board: p2.party.rotomheat.hp   us=45  showdown=52
    board: p2.party.heliolisk.hp   us=77  showdown=117
    board: p2.active[0].hp   us=45  showdown=52
    board: p2.active[1].hp   us=77  showdown=117

15. omit-intimidate  turn 9  seed gen9championsvgc2026regmbbo3-2657170022
    first divergence: unrelated event mismatch :: |-unboost|p1b|spa|1 <> |-boost|p1b|spa|1
    board: p1.party.archaludon.boosts.spa   us=2  showdown=0
    board: p1.active[1].boosts.spa   us=2  showdown=0
    board: p2.party.metagross.hp   us=1  showdown=77
    board: p2.active[0].hp   us=1  showdown=77

16. omit-intimidate  turn 1  seed gen9championsvgc2026regmbbo3-2657742695
    first divergence: -damage field 3 :: |-damage|p2a|H/H <> |-damage|p2a|H/H  [values differ: |-damage|p2a:froslass|69/145 vs |-damage|p2a:froslass|31/145]
    board: p2.party.froslass.hp   us=22  showdown=60
    board: p2.active[0].hp   us=22  showdown=60

17. omit-intimidate  turn 1  seed gen9championsvgc2026regmbbo3-2659757084
    first divergence: unrelated event mismatch :: |-resisted|p1a|1 <> |cant|p1b|armortail|fakeout
    board: p1.tailwind   us=3  showdown=0
    board: p1.party.aerodactyl.hp   us=53  showdown=43
    board: p1.active[0].hp   us=53  showdown=43
    board: p1.pp[0].tailwind   us=1  showdown=0

18. omit-intimidate  turn 5  seed gen9championsvgc2026regmbbo3-2660280251
    first divergence: unrelated event mismatch :: |move|p1b|ironhead <> |cant|p1b|flinch
    board: p1.party.kingambit.hp   us=65  showdown=44
    board: p1.active[1].hp   us=65  showdown=44
    board: p1.pp[1].ironhead   us=0  showdown=1
    board: p2.party.garchomp.hp   us=183  showdown=102
    board: p2.active[1].hp   us=183  showdown=102

19. omit-intimidate  turn 13  seed gen9championsvgc2026regmbbo3-2660750080
    first divergence: unrelated event mismatch :: |-enditem|p1a|sitrusberry|[from]stealeat|[move]bugbite <> |-damage|p2a|0fnt|[from]roughskin
    board: p2.party.scizor.hp   us=0  showdown=34
    board: p2.party.scizor.fainted   us=true  showdown=false
    board: p2.party.scizor.status   us="fnt"  showdown=""
    board: p2.active[0].hp   us=0  showdown=34
    board: p2.active[0].fainted   us=true  showdown=false
    board: p2.active[0].status   us="fnt"  showdown=""
    board: p2.active[0].ate_berry   us=0  showdown=1

20. pair-protect-bust  turn 4  seed gen9championsvgc2026regmbbo3-2655368189
    first divergence: extra event emitted by medicham2 :: |faint|p1a <> |-damage|p1b|H/H
    board: p1.party.delphox.hp   us=0  showdown=42
    board: p1.party.delphox.fainted   us=true  showdown=false
    board: p1.party.delphox.status   us="fnt"  showdown="psn"
    board: p1.active[1].species   us="mamoswine"  showdown="delphoxmega"
    board: p1.active[1].hp   us=185  showdown=42
    board: p1.active[1].maxhp   us=185  showdown=150
    board: p1.active[1].status   us=""  showdown="psn"
    board: p1.active[1].item   us="focussash"  showdown="delphoxite"

21. pair-protect-bust  turn 14  seed gen9championsvgc2026regmbbo3-2658446009
    first divergence: extra event emitted by medicham2 :: |-activate|p2a|protect <> |move|p2a|taunt
    board: p1.active[1].vol.taunt   us=3  showdown=0

22. pair-protect-bust  turn 5  seed gen9championsvgc2026regmbbo3-2658618561
    first divergence: unrelated event mismatch :: |-immune|p1a <> |-damage|p1b|H/H
    board: p1.party.tsareena.hp   us=14  showdown=104
    board: p1.active[1].hp   us=14  showdown=104

23. pair-protect-bust  turn 3  seed gen9championsvgc2026regmbbo3-2661429975
    first divergence: unrelated event mismatch :: |cant|p2a|healblock|drainpunch <> |move|p2a|drainpunch
    board: p1.party.slowbro.hp   us=137  showdown=170
    board: p1.active[0].hp   us=137  showdown=170
    board: p2.pp[0].drainpunch   us=1  showdown=0

24. pair-protect-bust  turn 4  seed gen9championsvgc2026regmbbo3-2662400605
    first divergence: unrelated event mismatch :: |-end|p1a|infestation|[partiallytrapped] <> |-damage|p1a|H/Htox|[from]infestation|[partiallytrapped]
    board: p1.party.blastoise.hp   us=18  showdown=37
    board: p1.active[0].hp   us=18  showdown=37
    board: p1.active[0].vol.trapped_by_move   us=1  showdown=0

25. pair-protect-bust  turn 14  seed gen9championsvgc2026regmbbo3-2634939984
    first divergence: extra event emitted by medicham2 :: |move|p1b|knockoff <> |-damage|p1a|0fnt|[from]recoil
    board: p1.party.kangaskhan.hp   us=0  showdown=33
    board: p1.party.kangaskhan.fainted   us=true  showdown=false
    board: p1.party.kangaskhan.status   us="fnt"  showdown=""
    board: p1.active[0].hp   us=0  showdown=33
    board: p1.active[0].fainted   us=true  showdown=false
    board: p1.active[0].status   us="fnt"  showdown=""

26. pair-redirect-priority  turn 4  seed gen9championsvgc2026regmbbo3-2655714014
    first divergence: unrelated event mismatch :: |move|p1a|shedtail <> |cant|p1a|flinch
    board: p1.pp[0].shedtail   us=1  showdown=2

27. pair-redirect-priority  turn 11  seed gen9championsvgc2026regmbbo3-2656306845
    first divergence: event missing from medicham2 :: |-status|p2b|brn <> |upkeep
    board: p2.party.whimsicott.hp   us=108  showdown=100
    board: p2.party.whimsicott.status   us=""  showdown="brn"
    board: p2.active[1].hp   us=108  showdown=100
    board: p2.active[1].status   us=""  showdown="brn"

28. pair-redirect-priority  turn 14  seed gen9championsvgc2026regmbbo3-2659722527
    first divergence: unrelated event mismatch :: |-activate|p1a|ficklebeam <> |-damage|p2a|H/H
    board: p2.party.volcarona.hp   us=53  showdown=34
    board: p2.active[0].hp   us=53  showdown=34

29. pair-speedctrl  turn 5  seed gen9championsvgc2026regmbbo3-2655141321
    first divergence: event missing from medicham2 :: |-status|p1a|brn|[from]flamebody <> |-weather|sunnyday|[upkeep]
    board: p1.party.toxapex.hp   us=49  showdown=42
    board: p1.party.toxapex.status   us=""  showdown="brn"
    board: p1.active[0].hp   us=49  showdown=42
    board: p1.active[0].status   us=""  showdown="brn"

30. pair-speedctrl  turn 13  seed gen9championsvgc2026regmbbo3-2656401580
    first divergence: extra event emitted by medicham2 :: |-damage|p2b|H/H|[from]recoil <> |-start|p2b|disable|struggle|[from]cursedbody
    board: p2.active[1].vol.disable   us=3  showdown=0

31. pair-speedctrl  turn 10  seed gen9championsvgc2026regmbbo3-2658356295
    first divergence: unrelated event mismatch :: |cant|p2b|flinch <> |move|p2b|strengthsap
    board: p1.party.talonflame.boosts.atk   us=-2  showdown=-1
    board: p1.active[0].boosts.atk   us=-2  showdown=-1
    board: p2.party.vileplume.hp   us=144  showdown=56
    board: p2.active[1].hp   us=144  showdown=56
    board: p2.pp[1].strengthsap   us=2  showdown=1

32. pair-speedctrl  turn 9  seed gen9championsvgc2026regmbbo3-2658772547
    first divergence: event missing from medicham2 :: |switch|p1a|sneasler,l50|H/H <> |move|p1b|protect
    board: p1.active[0].vol.trapped   us=1  showdown=0

33. pair-speedctrl  turn 7  seed gen9championsvgc2026regmbbo3-2660534650
    first divergence: unrelated event mismatch :: |-activate|p2b|ficklebeam <> |-damage|p1a|H/H
    board: field.weather_turns   us=2  showdown=1
    board: field.trickroom_turns   us=4  showdown=3
    board: p1.party.chandelure.hp   us=38  showdown=0
    board: p1.party.chandelure.fainted   us=false  showdown=true
    board: p1.party.chandelure.status   us=""  showdown="fnt"
    board: p1.active[0].hp   us=38  showdown=0
    board: p1.active[0].fainted   us=false  showdown=true
    board: p1.active[0].status   us=""  showdown="fnt"

34. pair-speedctrl  turn 10  seed gen9championsvgc2026regmbbo3-2663796709
    first divergence: move field 3 :: |move|p2a|trickroom <> |move|p2a|psychic
    board: field.trickroom_turns   us=3  showdown=0
    board: p2.pp[0].trickroom   us=1  showdown=2
    board: p2.pp[0].psychic   us=1  showdown=0
```

## 5. THE CORNER ARMS

Same pins, `--arm top-tie-first` and `--arm bottom-tie-first` by id, on each of the three gate
lattices, written to `data/verification/game-differential.g<N>.<arm>.json` so no gate artifact moved.
The default arm is `middle`; a corner run measures the corner because `RUN_PRIMARY` is `ARMS_RUN[0]`
(the 2026-09-10 fix — before it, a corner-only run published `0 − 0`, byte-identical to a perfect
score).

| `--games` | arm | games | **board-material** | protocol diverged (raw) | pool |
|---|---|---|---|---|---|
| 1200 | middle | 961 | **0** | 0 | `0d103fb9fa87` |
| 1200 | top-tie-first | 961 | **0** | 7 | `0d103fb9fa87` |
| 1200 | bottom-tie-first | 961 | **1** | 10 | `0d103fb9fa87` |
| 1350 | middle | 1069 | **0** | 1 | `7e7a37ded7fc` |
| 1350 | top-tie-first | 1069 | **1** | 9 | `7e7a37ded7fc` |
| 1350 | bottom-tie-first | 1069 | **1** | 8 | `7e7a37ded7fc` |
| 1950 | middle | 1497 | **0** | 2 | `a5ce76242f8d` |
| 1950 | top-tie-first | 1497 | **4** | 20 | `a5ce76242f8d` |
| 1950 | bottom-tie-first | 1497 | **4** | 11 | `a5ce76242f8d` |

The corner protocol counts are RAW: they include the declared Supreme Overlord `fallenundefined`
games and no declared subtraction was computed per corner. That is stated rather than left to be
found.

Every corner board parting, with its seed:

```text
1200 bottom  omit-spread     turn 11 (protocol never diverged)  seed ...2662099996
    p1.active[0].stall                        us=0             showdown=9
1350 top     omit-intimidate turn 14 (protocol turn 14)         seed ...2657162450
    p2.party.gholdengo.hp / p2.active[0].hp   us=103           showdown=102
1350 bottom  omit-spread     turn 11 (protocol never diverged)  seed ...2662099996   [the same game]
    p1.active[0].stall                        us=0             showdown=9
1950 top     baseline        turn 10 (protocol turn 10)         seed ...2662949913
    p1.party.aerodactyl.hp / p1.active[0].hp  us=35            showdown=54
    p1.active[0].vol.trapped_by_move          us=3             showdown=0
1950 top     omit-intimidate turn 5  (protocol turn 5)          seed ...2656305550
    p1.active[0].item                         us="choicescarf" showdown="brightpowder"
    p2.active[0].item                         us="brightpowder" showdown="choicescarf"
    p2.active[0].vol.choicelock               us=""            showdown="trick"
1950 top     pair-protect-bust turn 11 (protocol turn 11)       seed ...2655984323
    p2.pp[0].matchagotcha                     us=5             showdown=4
1950 top     pair-protect-bust turn 2  (protocol turn 2)        seed ...2659670177
    p2.party.kangaskhan.hp                    us=124           showdown=126
1950 bottom  omit-weather    turn 7  (protocol turn 7)          seed ...2654689944
    p1.active[0].boosts.atk                   us=-5            showdown=-4
    p1.active[0].boosts.spa                   us=-3            showdown=-2
1950 bottom  omit-intimidate turn 6  (protocol turn 5)          seed ...2656668990
    p2.active[1].status                       us=""            showdown="slp"
1950 bottom  omit-spread     turn 11 (protocol never diverged)  seed ...2662099996   [the same game]
    p1.active[0].stall                        us=0             showdown=9
1950 bottom  pair-speedctrl  turn 4  (protocol turn 4)          seed ...2660988502
    p1.active[0].hp                           us=3             showdown=106
    p1.active[0].status                       us="par"         showdown=""
    p2.pp[0].zapcannon                        us=4             showdown=3
```

Two readings worth stating plainly:

- **The Protect `stall` counter is the best-evidenced lead in this report.** It parts a board twice
  in the 12,000-game draw (rows 1 and 4 of §4), once more as a board-only parting reproduced on three
  separate corner samples, and `-activate|protect` against a move the other engine simply resolves is
  one of the larger narration buckets. `p1.active[0].stall` reading 0 against the authority's 3 and 9
  says the consecutive-use counter is not being kept at all on that road.
- **A corner is not noise.** Mode A pins every die on both sides and both engines draw from the same
  constant at a corner, so `1200 top` reading 0 while `1200 bottom` reads 1 is an asymmetry in the
  game, not a sampling wobble.

## 6. THE STAGED BATTERY, THE ROSTER, THE DAMAGE DIFFERENTIAL AND THE CENSUS

| artifact | generated (was, on `6180c4712761`) | reading |
|---|---|---|
| `data/all-mechanics-fire.json` | 22:13:20Z (19:38:03Z) | **4,634 games, 0 threw, 0 sheets unassembled, `red_ok: true`**, release stamped `18773c22878f`. Abilities: 200 in scope, **FIRED 199**, DID-NOT-FIRE **0** (Frisk now fires, 6.70.0), SHOWDOWN-ONLY 0, MEDICHAM-ONLY 0, diverged 0; the one row not FIRED is `illusion`, UNPROVEN-UNCONTROLLED and closeted. Moves: 497 in scope, **497 resolved on both engines**, 0 diverged unshelved (2 shelved and diverging, both Illusion carriers), 0 resolution disagreements. Items: **148 FIRED**, 0 diverged. `control_watch.fired_on_live_control_unearned` **[] (0)** over 42 live-control rows. `control_arm_partings`: 841 rows with a control arm, **2 parted, `board_material` 0**, both announcement-only |
| `data/roster.items.json` | 22:13:21Z (19:49:32Z) | **148 FIRED-AND-BOARDS-MATCH**; 0 DIFFER / DID-NOT-FIRE / COULD-NOT-STAGE / CONTROL-NOT-QUIET. Reds **22 of 22 caught**. Exit 0 |
| `data/roster.abilities.json` | 22:15:41Z (19:51:36Z) | **194 MATCH**, 6 DEFERRED-BY-OWNER, 0 otherwise. Reds **63 of 63 caught**. Exit 0 |
| `data/roster.moves.json` | 22:17:16Z (19:53:14Z) | **495 MATCH** (was 494), **2 DEFERRED-BY-OWNER** (was 3), 0 otherwise. Reds **37 of 37 caught**. Exit 0 |
| `data/engine-diff.json` | 22:17:13Z (19:53:14Z) | `--n 6000`, seed 20260804: requested 6000, **compared 6000, agreed 6000, disagreed 0**, `band_missing` 0. Release stamped `18773c22878f` from `liveStamp()` |
| `data/mechanics-census.json` | 23:08:39Z (19:54:42Z) | **970 live / 970 probed / 0 missing, `run_ok: true`**. Regenerated AFTER every differential run, so the steering pin `0c1d71e2a1bb` is the census as it stood at HEAD; the regenerated file digests `9a0d8b3451ee` and no row's verdict moved |

## 7. FILES CHANGED

- **Code: none.** No engine, instrument or test file was edited, and no release was cut —
  `data/releases/18773c22878f/cuts.jsonl` still holds exactly one event.
- **Data, rewritten by the runs:** `data/game-differential{,.g1350,.g1950}.json`,
  `data/all-mechanics-fire.json`, `data/roster.{items,abilities,moves}{,.prev}.json`,
  `data/roster.json`, `data/engine-diff.json`, `data/published-samples.json`,
  `data/mechanics-census.json`.
- **Data, new and untracked (nothing was added to git):**
  `data/verification/game-differential.g12000.json` and the six
  `data/verification/game-differential.g<N>.<arm>-tie-first.json`. **Nine** `--dump-out` files were
  written to relative paths `data/_1877_dump_*.json` as the brief asked, then moved into
  `data/verification/` so `data/` stays legible — nine and not ten because the `--games 1200` middle
  lattice diverged nowhere and wrote no dump. **Nothing was deleted.**
- **Docs:** this report; `CHANGELOG.md` 6.71.0; one `docs/RUNNING-NOTES.md` row (MINOR, **Basis.**
  unchanged); one `docs/ENGINE.md` section and its hand list; the five ledgers restamped by
  `node engine/status.js --write`.
- **White paper:** one tense correction, no figure deleted. The corner-arm paragraph read *"on the
  current release they part 16 of 961 and 15 of 961"*. Those two figures belong to release
  `cbd510bc2b13` (2026-09-10) — which the same sentence already names — and this pass measures the
  corners on `18773c22878f` at 0 / 1 / 4 and 1 / 1 / 4, so *"the current release"* had stopped being
  true. The words are replaced by the release id; the figures stay because they are a correct reading
  of that release. No other gate or whole-game figure in that document is stated in the present
  tense; every one sits in a dated block.
- **Held documents (technical docs, MODELS, SUMMARY, deck): NOT TOUCHED**, neither the index nor the
  working copy. Their gate and corner figures each name the artifact and the release they were read
  from and sit inside dated version blocks, so none is superseded as written. Will's held drafts were
  never read past `git show HEAD:`.
- `docs/_reports/2026-09-19-700-draft/` was not touched.
- **git:** no command that writes was run. Nothing staged, committed or pushed.
- **Processes:** all 18 were started by me, all exited on their own, all exit 0. Nothing was killed.

## OWED, NOT RUN

1. **THE FIX WAVE IS §4.** 34 board partings in a held-out draw, on the release whose gate reads
   OPEN. Four mechanisms carry 12 of them — the Protect `stall` counter (4), flinch (4), a burn that
   lands or is cured in one engine only (4), trapping volatiles (3). Nothing in the roster or the
   census stages them in a form that catches them today, so each needs a probe shown RED first.
2. **THE GATE'S LATTICE SET IS A MEASURE DECISION, NOT ENGINE'S.** 1200 / 1350 / 1950 are three
   samples of ~1,000–1,500 games; 12,000 games on the same release, census, pool and arm find 34
   partings. Whether the gate should read a wider `--games`, or read the corner arms as well, changes
   what the gate MEANS. No clause was edited in this pass.
3. **THE CORNER ARMS ARE UNGATED.** They part 0/1/4 and 1/1/4 on the gate's own lattices and nothing
   reads them. Note the three bottom-arm `stall` partings are ONE game (`…2662099996`) drawn by three
   samples, so the corner totals are not independent.
4. **111 vs 113.** `state.protocol_diverged_games` reads 111 on the 12,000-game artifact while its
   dump reports `diverged_in_arm: 113` and shows 111. Five games are void-excluded, so the arithmetic
   is consistent with 2 of the 5 having diverged — but I did not confirm that by seed, and an
   unexplained 2 is exactly the shape this project has been bitten by.
5. **`data/register-reality.json` is STALE** (generated 2026-09-12; `docs/ROADMAP.md` moved
   2026-09-19). `node engine/register_reality.js` is owed before the open-defect clause's PASS means
   what it says. The same clause prints 18 open rows asserting breakage with no instrument that
   decides them, and 2 naming an instrument that is GREEN.
6. **No per-corner declared subtraction.** The corner protocol counts in §5 are raw. The declared
   narration subtraction was computed only for the three gate lattices (by `quarantine.js`) and for
   the 12,000-game artifact (through the exported `narrationClause`).
7. **Not claimed: a battery or roster before/after against `6180c4712761`.** The driver digest and the
   census pin are unmoved, so the lattices ARE comparable across the two passes; the battery and
   roster moved because the ENGINE moved at 6.70.0, and those deltas are attributed in 6.70.0's own
   row rather than re-derived here.
8. **`docs/ENGINE.md` still carries `CHANGELOG <<VER>>` placeholders** in some worktree-pass headings,
   and `CHANGELOG.md` is still missing its `## [6.65.0]` heading (replaced by 6.65.1 in `d7b784c7`).
   Both were reported on 2026-09-19 and neither is repaired here.
9. **`tests/test-docs-current.js` was not run against the working tree.** Will's held drafts carry 23
   NEW entries whose figures predate this run; I edited none of those files.
10. **THE DOCUMENTATION DEBT IS AT 94 OF 100.** `node engine/docs_scan.js --owed` reads **94 of 100
    notes entries owed to the next major** with this pass's row counted. At the cap the build FAILS.
    Clearing it is a DOCUMENT PASS at any version, not a major — and it is not ENGINE's to take.
11. **`node engine/status.js --write` printed `FEATURE SEMANTICS CHECK FAILED` on
    `data/policy-weights.json`** (the fixture moved: scenarios 10 -> 12, and the damage table was
    regenerated, 318 species -> 322). That is MAG, which is paused and waived. Reported, not touched.
