# The search's blind spots that no planned fix covers (abra/regmc 1.51.0)

2026-10-01. SOLVER. Read-only over the finished ladder runs in the main checkout's `solver/out/rotom/`. No game was played
and no ladder was touched. Engine: release `eaa5becc54eb`. Gen5 prior digests: MAG `65e76caf2423b28b`, DODUO
`abb0b88dd573b728`.

This follows the loss post-mortem (`docs/_reports/2026-09-30-ladder-loss-postmortem.md`, 1.39.0) and the world fixes
(`docs/_reports/2026-09-30-rotom-world-fixes.md`, 1.40.0–1.44.0).

## Verdict

- **Opponent coverage is 57.7% with targets, 63.7% by move id alone** (636 decisions with a table and an observed
  opponent action, chomp1 plus gen5ab). It is lowest on turn 1 (51.1%) and rises to 61.5% from turn 5. The commonest
  miss is an ATTACK the columns did not hold (85 slots), then a switch (47), a Protect (46) and a status move (39).
  - DODUO ranks the actual joint in its top 4 in 57.1% of decisions and its top 8 in 71.1% (86.5 legal opponent joints
    on average).
  - Our own side is just as narrow: in 30.1% of our slots the four rows hold one move only. For the opponent's columns
    it is 25.9%.
  - The control holds: our chosen action is in the rows 668 of 668 times.
- **Sucker Punch: the main cause is OUR row narrowing, then the leaf. It is not the engine, and only partly DODUO.**
  It failed 17 times in 36: into a status move 9 times, Protect 4, a switch 3, and an Extreme Speed once.
  - **The engine is right.** One MEDICHAM step reproduces all 17 failures and all 12 staged landings.
  - **9 of the 17 failures: the four rows gave that body nothing but Sucker Punch or a switch.** The search could not
    choose anything else.
  - **8 of the 17: other moves were in the table.** The table's own minimax mix gave the target a mean 25% chance of
    attacking. The Sucker Punch row still tied or beat every non-Sucker-Punch row in expected value, by 0.00 to 0.08.
    The one-turn leaf does not separate a wasted Sucker Punch from a real move.
  - **DODUO does overrate attacks, mildly.** At the Sucker Punch targets it predicts 0.630 against 0.556 observed. In
    the 0.6–0.8 bin it predicts 0.712 against 0.429 (n 14). Over all 1,119 observed opponent slots it predicts 0.625
    against 0.575, and it **halves switches** (0.047 against 0.102).
  - **The columns missed the target's action in 7 of the 17 failures.**
- **World fields: four fixed, each red on its own break, each verified on a real ladder log.**
  - **Identity**, the largest. A forme (Indeedee-F, Arcanine-Hisui) or a nicknamed mon was not keyed. That was 220 of
    1,841 switch idents in 119 of 189 games, and a switch then put the incoming body's clocks on the outgoing one.
  - **Unburden.** Live at 178 of 668 search decisions. Of 69 ladder orderings that the doubling decides, 66 agree with
    the fix and 0 with the old world.
  - **Flash Fire**: 1 game, 4 decisions. **Trick-or-Treat's added type**: 2 games, 1 decision.
  - The rest occur 0 or 1 times, or nothing on any brought sheet reads them (§3).
- **Nothing here changes the search or a gate.** The world fixes change what the search SEES, as 1.40.0–1.44.0 did. No
  series has played on them.

## 1. What was read

| run | policy | games | move decisions | with a table |
|---|---|---|---|---|
| `chomp1-2026-09-29T23-13-11-521Z` | `miltank-gen5`, 5 s, CHOMP v1 preview | 50 | 370 | 370 |
| `gen5ab-2026-09-26T04-06-53-848Z` | A `miltank-gen5` / B `prior` | 76 | 511 | 300 |
| `aa1-…`, `aa2-…` | `prior` | 22, 41 | 151, 305 | 0 |

- The five `run-*` directories were counted for the world fields only.
- **The sample is fixed in code** (`RUNS_FIXED`).
  - A run that started at 04:18Z (`chomptop-2026-10-01T04-18-07-546Z`) was live and being written while this ran. It is
    **not read**.
  - An early pass had picked up 14 of its decisions. Every figure here is from the re-run on the fixed list.
- Artifacts, tracked, in `solver/results/2026-10-01-search-blind-spots/`:
  - `blind_spots.js` → `measured.json`: coverage, Sucker Punch and world-field counts. It loads the dex only, no engine.
  - `doduo_probe.js` → `doduo.json`. It rebuilds ROTOM's world at every tabled decision (668, 0 failed) through
    `solver/tests/ladder_replay.js` and scores every legal opponent joint with the gen5 prior, exactly as
    `solver/miltank/search.js` ranks columns. It gives calibration, recall@k and fidelity.
  - `sp_engine_check.js` → `sp_engine.json`: one engine step per Sucker Punch decision, with a no-Sucker-Punch control.
- Run each with `--root <main>/solver/out/rotom` and `SHOWDOWN_PATH` set. A worktree has no `solver/out`.
- **Fidelity of a rebuilt world:** its top-4 + 1 reserved switch reproduces 91.7% of the recorded live columns, and all
  four in 588 of 668 decisions. The rebuilt request has no stat line, so some HP- and speed-sensitive ranks move. The
  DODUO figures are about that world, not the live one.

## 2. Opponent coverage (`measured.json` `coverage`, `doduo.json` `recall_actual_joint`)

The actual joint is each opponent slot's first own `|move|`, or a `|switch|` before any move. A slot that never acted
(fainted first, flinched, slept) matches anything. 32 decisions had no observed opponent action and are excluded.

| measure | hit | rate |
|---|---|---|
| moves (ids, slot by slot; the post-mortem's measure) | 405 / 636 | 63.7% |
| targets (plus the target of a single-target move) | 367 / 636 | **57.7%** |

| turn | n | moves | targets |
|---|---|---|---|
| 1 | 88 | 56.8% | 51.1% |
| 2 | 88 | 61.4% | 53.4% |
| 3 | 83 | 62.7% | 55.4% |
| 4 | 76 | 64.5% | 57.9% |
| 5+ | 301 | 66.4% | 61.5% |

- By result (targets): won 54.1% (n 222), lost 59.7% (n 414). As in the post-mortem, coverage does not separate a loss
  from a win.
- **The cause of each of the 269 target-aware misses:**

  | cause | misses |
  |---|---|
  | an attack no column held | 71 |
  | a wrong target only | 38 |
  | a switch | 37 |
  | each slot's action held, but not together | 36 |
  | a Protect | 35 |
  | a status move | 30 |
  | both slots missed | 22 |

- **By slot**, the action no column held was an attack 85 times, a switch 47, a Protect 46 and a status move 39.
- On 12 matched columns the mega flag disagreed with whether the opponent mega-evolved that turn.
- **Recall under the gen5 prior over ALL legal joints**, with the switch's sheet row compared, on 636 decisions:

  | k | 1 | 2 | 4 | 8 | 16 | 32 |
  |---|---|---|---|---|---|---|
  | actual joint ranked within k | 28.8% | 41.5% | 57.1% | 71.1% | 78.9% | 83.6% |

  - 40 of the actual joints are not in the rebuilt legal set: a switch to a body the world has not revealed, or a
    target the rebuilt menu does not offer.
  - Turn 2 is the weakest turn: top4 47.7%, top8 63.6%.
- **Our own rows narrow just as hard.** In 352 of 1,168 slots (30.1%), the four rows hold a single move for that slot,
  the reserved switch aside. For the opponent's columns it is 319 of 1,232 (25.9%).
- Controls: our choice is in the rows 668 of 668 times. Our move index maps to the move the log shows we used 928 of
  929 times.

## 3. Sucker Punch: a hypothesis test (`measured.json` `sucker_punch`, `doduo.json`, `sp_engine.json`)

36 decisions clicked Sucker Punch, and every one executed: 17 failed and 19 landed. 24 were in lost games (11 failed)
and 12 in won games (6 failed).

**What the target actually did when it failed:**

| action | n |
|---|---|
| a status move (Helping Hand 2, Will-O-Wisp 2, Rage Powder, Skill Swap, Dragon Dance, Trick-or-Treat, Swords Dance) | 9 |
| Protect | 4 |
| a switch | 3 |
| an attack with higher priority (Extreme Speed) | 1 |

| hypothesis | test | result |
|---|---|---|
| **The engine or playout does not charge a failed Sucker Punch** | One MEDICHAM step, 6 seeds: Sucker Punch into the target's actual action, against a control where that slot clicks Protect. | **Refuted.** 17 of 17 failures are clean in the engine, and 12 of 12 staged landings hurt. 7 were not staged: the target fainted before it acted. |
| **DODUO overrates the target attacking** | The prior's mass on the target slot attacking, over every legal joint, against what it did. A landed Sucker Punch whose target never acted counts as an attack (the move's own condition), 7 cases. | **Mildly supported.** Mean 0.630 predicted against 0.556 observed (n 36). 0.6–0.8 bin: 0.712 against 0.429 (n 14). Failures 0.548, landings 0.703, so it ranks. Over all 1,119 slots: attack 0.625 against 0.575, and 0.704 against 0.565 in the 0.6–0.8 bin. Switch 0.047 against 0.102. Protect (0.133 against 0.143) and status (0.194 against 0.181) are close. |
| **The table lacks the target's Protect or support column** | Was the target's actual action in any column? | **Partly.** It was in 10 of the 17 failures and absent in 7. The table had at least one non-attacking column for the target in 14 of 17. |
| **Our rows gave the body no alternative** (new) | Every row's action for the Sucker Punch user. | **Supported.** In 9 of 17 failures (20 of 36 overall) every row was Sucker Punch or a switch. |
| **The leaf does not price the wasted move** | In the other 8 failures: the table's own mix, and each row's expected value under it. | **Supported, for these 8.** The mix gave the target a mean P(attack) of 0.25. Yet the Sucker Punch row's expected value was equal to or above the best non-Sucker-Punch row (0.721 = 0.721, 0.787 = 0.787, 0.049 = 0.049, 0.257 vs 0.236, 0.343 vs 0.263, 0.962 vs 0.951, 0.634 vs 0.609, 0.412 vs 0.411). |

**Reading.** In half the failures the search never had a choice: k1 = 4 prior-ranked rows plus one reserved switch,
and the prior loves Sucker Punch on that body. In the other half the table expected no attack and still could not tell
a wasted Sucker Punch from Protect or a weak alternative, which is the one-turn leaf. DODUO's overrating of attacks is
real and secondary. The table missing the column matters in 7.

## 4. World fields (`measured.json` `world_fields`, `identity`; `doduo.json` `world_counters`)

| field (the 1.44.0 report's OWED list) | events | games | live at our move decisions | action |
|---|---|---|---|---|
| **identity** (not on the list: a forme or nickname not keyed) | 220 of 1,841 switch idents | 119 of 189 | most decisions in those games | **FIXED** |
| **Unburden** | 123 item losses on an Unburden holder | 109 | 350 (all runs); 178 of 668 search worlds | **FIXED** |
| **Flash Fire** | 1 | 1 | 4 | **FIXED** |
| **type change** (Trick-or-Treat typeadd) | 2 | 2 | 1 | **FIXED** (typeadd only; typechange 0) |
| `last_item` | 304 `-enditem` | 160 | — | owed: no brought sheet carries a reader (Recycle, Belch, Cud Chew, Harvest: 0 holders) |
| `ate_berry` | 56 | 49 | — | owed, same reason |
| two-turn charge | 8 `-prepare` | 5 | 0 | owed: every charge fired the same turn |
| Wish slot | 1 | 1 | 1 | owed: one event; the engine's slot condition was not traced |
| Attract source (`_attractedBy`) | 1 (Cute Charm) | 1 | 0 | owed: it ended before any decision. Note: the engine drops an infatuation with no source at the first move, so a presence-only Attract is effectively not carried |
| rampage lock, Uproar, recharge, Ally Switch, Metronome item, Curse, transform, Healing Wish | 0 | 0 | 0 | owed, 0 on the logs |
| PP beyond one per move seen | — | — | — | owed: hidden; 2 sheet rows carry Pressure |

**The fixes** (`solver/rotom/world_log.js`, `solver/rotom/world.js`; test `solver/tests/test-rotom-world-fields.js`,
GREEN 17/17):

1. **IDENTITY** (break `noalias`).
   - **The fix.** An ident that is no sheet nickname is bound to the row its switch line's species names: exact species,
     then base species, unique (`world_log.aliases`). On a switch line the slot's old occupant no longer stands in for
     an unmatched ident. `world.js stallStreaks` maps through the same aliases.
   - **The real log.** yeetpheesh, chomp1 2690109794, turn 7. Our Arcanine-Hisui (the log says "Arcanine") Protected on
     turn 6, and its Protect failed on turn 7.
   - **Fixed:** counter 1, and the engine's second Protect fails on 5 of 6 seeds. **Broken:** counter 0, fails 0 of 6,
     8 idents unmatched.
   - **Over 668 search worlds** the fix lays these, which the old world dropped: +43 Protect counters (305 → 348), +3
     Perish, +6 volatiles, +10 ability changes, +10 Choice locks and +13 sleep counters.
   - The test helper `ladder_replay.js` had the same gap in the rebuilt request. Fixing it raised world fidelity from
     88.7% to 91.7%.
2. **UNBURDEN** (break `noub`).
   - **The fix.** `-enditem` on a body that holds an item-loss Speed ability lays `_ubVol`, the engine's state, at the
     multiplier read from the ability's own `condition.onModifySpe` (×2). An ability change, a suppression, a mega or
     leaving the field ends it.
   - **The real log.** sbsbsh, chomp1 2690129513, turn 2. Their Sneasler moved before our Excadrill. Engine Speed is 330
     against 266 with the fix, and 165 against 266 without.
   - **Over the two runs:** 69 orderings the doubling decides. 66 agree with the server under the fix. Without it, all 69
     flip. The 3 that disagree are Excadrill twice and Whimsicott once; not traced.
3. **FLASH FIRE** (break `noff`).
   - **The fix.** `-start|X|ability: Flash Fire` lays `_vol.flashfire = 1`.
   - **The real log.** pandywulu, gen5ab 2688051443, turn 5. Their Armarouge, boosted, KO'd our full-HP Sneasler.
     Engine Armor Cannon into our full-HP Volcarona: 430 HP over 6 seeds with the volatile, 244 without (×1.76).
4. **TYPE ADD** (break `notype`).
   - **The fix.** `-start|X|typeadd|T` lays the type on the engine's added-type slot (`types._added`). It leaves with
     the body.
   - **The real log.** ekohc, gen5ab 2688067676, turn 2. Kowtow Cleave was super effective on our Trick-or-Treated
     Hippowdon. Engine: 1,232 HP over 6 seeds against 567 on plain Ground (×2.17).

`test-rotom-world-clocks.js` stays GREEN 20/20, and its AUDIT now reads 57 carried and 11 owed. `test-rotom-world-stall.js`
is GREEN 6/6. It needs `data/team-pool-frozen-regmc`, so it was run with the main checkout as the working directory and
the worktree's code.

## 5. Recommendations (none applied: each changes play and needs a screen, then an SPRT against gen5 at equal wall clock)

1. **Diversify the rows, not only the columns.** When a slot's rows collapse to one move (30.1% of our slots), reserve
   a row with that body's best different move, the same way a switch row is reserved. This is the Sucker Punch fix in
   9 of 17 failures, and it is general.
2. **Widen k2 from 4 to 8, or reserve by class.** k = 8 would hold the actual opponent joint 71.1% of the time against
   57.1%. Or keep 4 and reserve one Protect column and one status column for the target of a conditional move (the
   post-mortem's Sucker Punch suggestion), which covers 7 of 17. Both cost cells. Measure at equal clock.
3. **Recalibrate DODUO's switch and attack masses.** It halves switches (0.047 against 0.102), and its 0.6–0.8 attack bin
   runs 14 points high. A temperature or class-bias fit on the store is store-only work and need not wait for anything.
4. **The tie cases (8 of 17) are the leaf.** They are PORYGON2 v2 with depth, already planned. Re-read this table after
   v2 plays.
5. **Screen the world fixes before a ladder run.** Unburden alone changes Speed in 27% of search worlds.

## OWED, NOT RUN

- **No series and no screen has played on the four world fixes.** They change what the search sees. A ladder run is
  Will's call. An offline screen of world-on against world-off is not meaningful, because the arena does not build its
  worlds from logs.
- `docs/SOLVER.md` and `node engine/status.js --write` are owed from the main checkout. They are never run from a worktree.
- Wish slot conditions, Attract's source, `last_item` / `ate_berry` (no reader on any brought sheet), the two-turn
  charge (0 crossing a decision), and every field with 0 events: owed, named in `world_log.js` OWED.
- 3 of 69 Unburden orderings disagree with the fixed world. Two involve Excadrill, likely Sand Rush and the sand
  clock, or a hidden Speed SP; one involves Whimsicott. Not traced.
- The 12 mega-flag disagreements on matched columns are not read.
- The `chomptop-2026-10-01T04-18-07-546Z` run was live and is not in this sample. Re-run the three scripts after it
  ends, with it added to `RUNS_FIXED`.
- All recommendations in §5 are unregistered as tests. Each needs a pre-registered SPRT with a named baseline (gen5 at
  equal clock) before it is built into play.
