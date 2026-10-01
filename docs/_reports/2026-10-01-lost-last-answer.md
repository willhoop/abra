# Lost the last answer: does ROTOM lose by giving away its only answer to a live threat? (abra/regmc 1.58.0)

2026-10-01. SOLVER. Read-only over ROTOM's saved ladder games. No game was played. Every position was rebuilt from its
saved log with ROTOM's own world builder and staged on MEDICHAM release `eaa5becc54eb`, at BelowNormal priority.

## Verdict

- **It happens, and it goes with losing, but it is not a separate cause of losses.**
  - A contested last-answer faint occurs in **31 of 90 losses (34%)** and **9 of 68 wins (13%)**.
  - Games with one won **22.5%** (9 of 40). Games without one won **50.0%** (59 of 118).
  - At the same search value, a last-answer faint does not cost significantly more than any other faint of ours. The
    residual (won − value before the faint) is **−0.092, 95% CI [−0.225, +0.059]**, game-clustered.
  - **It is the turning point in 6 of the post-mortem's 26 losses**: OUTSPED 2, UNSEEN_ACTION 1, SPEED_CONTROL 1,
    BEHIND_FROM_PREVIEW 1, SUCKER_PUNCH 1. It is never the turning point of a VISIBLE_KO or SETUP loss. In 9 more losses
    it happens only after the turning point, which is a consequence of the loss and not its cause.
- **The search prices the loss only after it has happened.** After a last-answer faint, the search's own root value
  falls **0.108 more** than after any other faint, CI [−0.214, −0.006]. Before it happens, the table rarely protects
  the answer:
  - 33 contested events had a search table.
  - In 14, no row kept the answer alive.
  - In 18, a row kept it alive and was not chosen. The table rated that row higher by row mean in 7 of the 18.
  - In 1, the chosen row was itself a Protect, and it failed.
- **The answer map is a real signal on its own.**
  - A threat with fewer than 0.5 expected answers left won the game for the opponent **82.9%** of the time (86.2% in
    games without a forfeit), and survived the game 79.4% of the time.
  - The relation is monotone. Our loss rate by answers left: 0.83 (fewer than 0.5), 0.66 (0.5–1.2), 0.62 (1.2–2),
    0.56 (2 or more).
- **It adds nothing to the search's root value.**
  - Leave-one-game-out logistic, 863 search decisions in 119 games: value alone has log-loss 0.515 (AUC 0.807). Value
    plus the map has 0.519 (AUC 0.800). The gain is −0.0045, CI [−0.0187, +0.0063].
  - The map does add to a material count: AUC 0.535 → 0.724, log-loss gain +0.023, CI [−0.005, +0.047].
- **Recommendation: do not add the duel answer map as a live value-net input.**
  - It costs about 3 s of CPU per position. The leaf is called hundreds of thousands of times per SPRT.
  - Over the search's own value, it adds nothing measurable.
  - The one place it looks useful is the overconfident band, values 0.5 to 0.9. There, positions with an unanswered
    threat won 15.7 points less at the same value (CI [−0.356, +0.052]). The value overstated them by 0.328, against
    0.191 for the other positions. That is suggestive and not significant.
  - If v3 wants the signal, the better use is offline: an auxiliary training target, or a label on these 1,131 ladder
    positions (§7).

## 1. What was read

| run | arm | games mapped | move decisions | won | lost, no forfeit | won, no forfeit |
|---|---|---|---|---|---|---|
| `chomp1-2026-09-29T23-13-11-521Z` | miltank-gen5 (search) | 49 | 369 | 23 | 26 | 11 |
| `gen5ab-2026-09-26T04-06-53-848Z` | miltank-gen5 (search) | 41 | 300 | 16 | 25 | 9 |
| `gen5ab-2026-09-26T04-06-53-848Z` | prior (no search, no table) | 33 | 211 | 12 | 21 | 8 |
| `chomptop-2026-10-01T04-18-07-546Z` | miltank-gen5 (search) | 35 | 251 | 17 | 18 | 7 |
| **total** | | **158** | **1,131** | 68 | 90 | 35 |

- **chomptop:** every game that had ended when the run wrote `ladder-report.json`: 35 games, read at 07:02Z. The first
  pass read 32 games and a second pass added 3. Three games that ended at team preview have no move decision.
- **Counters** (`results.json` `counters`):
  - Positions: 1,131 built, 0 failed, 1,131 maps.
  - Duels: 183,648 played, 271,930 duel steps, 278,649 probe steps, 217,886 shared picks.
  - Duel endings: 220 hit the 10-turn cap (0.12%, scored 0.5). 0 draws. 0 duels with no move.
  - World: 1,447 megas applied, 0 mega failures, 49 Perish counts laid, 124 Choice locks.
  - `oppFilledBlind` 346: an opposing slot that the log never revealed was filled from the sheet, as the live world
    does. Such a body is never counted as a threat.
- **Hindsight, stated.** The opponent's back line is the set of sheet rows the WHOLE log revealed, not XATU's guess.
  This is a post-mortem of the board as it was. Our side is exact up to what the log shows. The request is rebuilt from
  the log by `solver/tests/ladder_replay.js`, so the stat line comes from the sheet.

## 2. The live answer map

`solver/results/2026-10-01-lost-last-answer/answer_map.js`. For every live pair (our i, their j) at a decision:

- **The board.** The position is cloned, and every body except i and j leaves the board. Each side keeps one fainted
  body to hold its empty slot, and its fallen count is restored, so Last Respects and Supreme Overlord read the real
  game.
- **The play.** i and j then play a one-on-one on `medicham_api.step` with the engine's dice, 16 times per pair.
- **What comes from MEDICHAM.** Current HP, boosts, status, the field and its clocks (Tailwind, Trick Room, weather,
  terrain, screens), priority, items yet to trigger, abilities, damage rolls, accuracy, crits and speed ties. Nothing
  in the file computes a damage number or a turn order.
- **Speed ties.** Each of the 16 duels plays a tie on its own dice, so both branches count at their weight.
- **The policy.** Each turn, each side picks among its damaging moves (by the dex's category) and mega-evolves when it
  may.
  - The pick is the best row (and column) mean of a one-turn probe table, my candidates × theirs, one probe per cell.
  - A cell is scored as the foe's HP fraction lost, +1 if the foe faints, −1 if I faint. So a priority move that
    finishes a low foe is found by the engine's own turn order.
  - Duels that reach the same coarse state share the pick: turn, HP in 32nds, status, boosts, forme. This cut CPU about
    5× on the fixture. Mean |ΔP| against unshared picks was 0.043, the duel noise.
- **Derived from the map.**
  - `answers_j` = Σ_i P(i beats j) is the expected number of answers left to threat j.
  - `threats_i` = Σ_j (1 − P(i beats j)) is the opposing answers left to my i.

**What it does not value.** Setup, Protect, switching, and anything a partner adds (Helping Hand, Follow Me, a Fake
Out from the side). It is a damage race on the live board. One case read by hand shows the edge:

- chomptop, robby w, turn 10: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690830687-rhmy6avgrll3xpgspth403bltuxi52lpw
- Their Kingambit (Life Orb) is at 10%. The map gives it **0 answers**: P = 0 for each of our three. Read by hand, its
  priority Sucker Punch moves first in every straight race.
- In the game, on turn 12, it Sucker Punched our Dragonite, fell to 1% from its own Life Orb, and was finished by our
  Sneasler's Rock Slide. We lost the game anyway.
- A Protect or a status move (which baits the Sucker Punch) is outside the duel policy.

**Shown live, and shown red.** `solver/tests/test-answer-map.js` (fixture `sdkvndfv-g1`, turn 2):

| run | LIVE-HP: mean P, foes at full → foes at 1 HP | SIDES: mean \|P + P_rev − 1\| | result |
|---|---|---|---|
| default | 0.781 → 0.992 | 0.043 | GREEN, 6 checks |
| `ANSWER_MAP_BREAK=fullhp` (duel restores full HP) | 0.785 → 0.785 | 0.031 | RED, LIVE-HP |

- LIVE-HP is the brief's point that "Garchomp at a third of its HP" changes who answers it.
- READONLY: the battle's digest is unchanged by a map.
- The P distribution is mostly decisive: of 11,244 pair values, 4,322 are below 0.2 and 5,775 are 0.8 or more.

## 3. The event, pre-registered

The definitions in the header of `analyze.js` were written before any map was read:

- **Last-answer faint.** Our i faints during turn t. At the decision for turn t, some revealed live threat j had
  answers_j < 1.2 and P(i beats j) ≥ 0.5. j is still standing at the end of turn t.
- **Strict.** Also answers_j − P(i beats j) < 0.5: without i, j is unanswered. All 79 events met the strict
  definition as well, so the two are the same set here.
- **Alternatives.**
  - If i was active: the legal menu at the rebuilt position (a switch, a stalling move).
  - If i was switched in that turn: any row that does not bring it in.
  - The table's view of each is the row mean and mix of the best such row, against the chosen row.

**Added after the first 18 games and reported beside the raw count: "contested".** Our side had 2 or more live bodies,
and the search value was 0.15 or more (or the arm had no search). The last body of a lost endgame is trivially the
last answer to everything, and 79 raw events include that endgame: for example, `pass, move 4` at value 0.001. Both
sets are in `results.json` (`all`, `contested`).

## 4. How often, and what follows (step 3)

| | all events | contested |
|---|---|---|
| events (faints) | 79 | 42 |
| losses without forfeit with one | 50 of 90 | 31 of 90 |
| wins without forfeit with one | 6 of 35 | 6 of 35 |
| wins by the opponent's forfeit with one | 3 of 33 | 3 of 33 |
| search-arm losses / wins (no forfeit) | 42 of 69 / 4 of 27 | 25 of 69 / 4 of 27 |
| win rate, games with one | 0.153 (9 of 59) | 0.225 (9 of 40) |
| win rate, games without | 0.596 (59 of 99) | 0.500 (59 of 118) |
| share of our faints that were last-answer, losses / wins | 0.210 / 0.103 | 0.153 / 0.109 |

**The control is every other faint of ours, at the same search value.** The win-rate gap above is mostly the gap
between games where we lose bodies and games where we do not.

| faints, contested | n | win rate | value before → after | won − value before |
|---|---|---|---|---|
| last-answer | 42 | 0.214 | 0.531 → 0.290 | −0.349 |
| every other faint | 250 | 0.272 | 0.550 → 0.413 | −0.257 |
| difference, game-clustered bootstrap (B 2000, seed 23) | | | **−0.108 [−0.214, −0.006]** | **−0.092 [−0.225, +0.059]** |

- All events, residual: −0.013 [−0.104, +0.074]. The value change is −0.104 [−0.211, −0.012].
- **Read:** losing the last answer is about as bad as losing any body at the same value. The searched value treats it
  as worse only after the fact. Every faint loses about 0.26–0.35 against the value before it, which is the
  post-mortem's mid-game overconfidence again.

### The alternatives (contested, 42 events)

- **Where i stood.**
  - Active at the decision: 39.
  - Switched in that turn: 4.
  - A legal switch existed for 31, and a legal stalling move for 27.
  - Neither existed for 1.
- **The table** (33 events with one; the other 9 are the prior arm):
  - 1: the chosen row was itself the preserving row, a Protect that failed.
  - 18: a preserving row was in the table and was not chosen. The table rated it higher by row mean in 7. Over the
    18, the chosen row averaged +0.090 above the best preserving row.
  - 14: no preserving row was among the four searched rows.
- **So there are two faults, about evenly split.** DODUO's narrowing never offered the save, or the one-turn table
  did not value keeping the answer.

## 5. The post-mortem's 26 losses

An event counts as at the turning point (TP) if it falls within ±1 turn of the hand-read TP in
`solver/results/2026-09-30-ladder-loss-postmortem/classifications.json`.

| class | n | contested event at the TP | any contested event |
|---|---|---|---|
| VISIBLE_KO | 5 | 0 | 3 |
| SPEED_CONTROL | 5 | 1 | 2 |
| SUCKER_PUNCH | 4 | 1 | 3 |
| OUTSPED | 4 | 2 | 3 |
| SETUP | 3 | 0 | 1 |
| BEHIND_FROM_PREVIEW | 3 | 1 | 2 |
| UNSEEN_ACTION | 1 | 1 | 1 |
| PERISH | 1 | 0 | 0 |
| **total** | **26** | **6** | **15** (9 only after the TP) |

Raw (all events): 7 at the TP and 23 with any event. It explains, as one reading of the TP, **6 of 26**, and in each
of those it shares the TP with the class already given.

## 6. Examples (replay, turn)

1. **The Sylveon case, nearly verbatim** (OUTSPED, post-mortem game 22).
   Jaylek g1, turn 4: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690154483-dpuuw8l7j3wu1kjy9ambegncf9jk8glpw
   - Our Basculegion was the ONLY answer to Sylveon: answers 1.0, P 1.0.
   - The table held `switch 4, move 2 2` at a row mean of 0.543, above the chosen row's 0.491, and mixed it at 0.
   - Basculegion fell to the Scarf Indeedee's Expanding Force before it moved. Archaludon, the last answer to that
     Indeedee at 1.5% HP, fell the same turn.
   - Value 0.426 → 0.012.
2. **No preserving row searched** (UNSEEN_ACTION, game 3).
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690116810, turn 8:
   - Indeedee was the last answer to a 96% Garchomp: answers 1.0, P 1.0. A switch was legal, but no row of the four
     kept Indeedee.
   - Value 0.753 → 0.190.
   - Earlier in the same game the map already showed the hole while the value read high: on turn 1 (value 0.768),
     Gyarados had 0.125 answers and Garchomp 0.44; on turn 3 (value 0.619), Garchomp had 0.125.
3. **A preserving row searched and mixed** (SPEED_CONTROL, game 7).
   AngryGator g1, turn 3: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690121468-je1ca9h7t1ieywx0ohi326o4gihs7lfpw
   - Kingambit was the last answer to Farigiraf: answers 1.125, P 1.0.
   - `switch 4, move 1 2` was in the table at 0.756 with mix 0.167. The chosen row was rated 0.818.
   - Farigiraf then set the Trick Room of the post-mortem's turn 4.
4. **The answer that lived on a Protect** (BEHIND_FROM_PREVIEW, game 16).
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690146981-p1kcd17hr43vi1q4fp9uct8q36yqbygpw, turn 2:
   - Salamence-Mega was the last answer to Kommo-o: answers 1.125, P 0.875.
   - The Protect row (`move 4, move 3 1`) was searched at 0.180, against 0.437 for the chosen row.
5. **A low threat that only one body still beat** (OUTSPED, game 26).
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690163131, turn 11:
   - Espeon at 20%. Gengar-Mega was its only answer: answers 1.0, P 1.0.
   - The Protect row was searched at 0.639 against 0.764. Value 0.725 → 0.051.
6. **It happens in wins too.**
   https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690125424, turn 6:
   - Archaludon was the last answer to an 83% Rillaboom: answers 0.94. It fell, and the game was won.
   - Value 0.865 → 0.549. The Rillaboom fell on turn 8.

## 7. Validating the map against outcomes (step 4)

| answers_j left (revealed, live threat) | threat-decisions | games | we lost | threat survived the game | no forfeit: we lost / survived |
|---|---|---|---|---|---|
| < 0.5 | 422 | 96 | 0.829 | 0.794 | 0.862 / 0.800 (n 406) |
| 0.5–1.2 | 693 | 130 | 0.664 | 0.618 | 0.753 / 0.615 |
| 1.2–2 | 429 | 126 | 0.620 | 0.497 | 0.704 / 0.489 |
| ≥ 2 | 1,271 | 146 | 0.557 | 0.412 | 0.690 / 0.388 |

- **Positions.**
  - With any unanswered threat: won 0.181 (349 decisions, 96 games).
  - Without one: won 0.468 (725 decisions, 149 games).
  - Without forfeits: 0.144 against 0.351.
- **Most frequent unanswered threats** (in-game names): Staraptor 46, Excadrill 35, Golisopod 26, Kingambit 23,
  Salamence 19, Archaludon 19.
- **Within search-value bins:**

  | value bin | with an unanswered threat: n, win | without: n, win |
  |---|---|---|
  | 0–0.3 | 170, 0.065 | 113, 0.159 |
  | 0.3–0.5 | 38, 0.237 | 92, 0.152 |
  | 0.5–0.7 | 33, 0.424 | 131, 0.466 |
  | 0.7–0.9 | **24, 0.292** | **147, 0.578** |
  | 0.9–1 | 9, 0.778 | 106, 0.868 |

  - The band 0.5–0.9 is where the post-mortem's +0.19 overconfidence lives.
  - In that band: win difference −0.157 [−0.356, +0.052].
  - Overconfidence (value − result): 0.328 with an unanswered threat, 0.191 without. The difference is +0.137
    [−0.069, +0.346].
- **Leave-one-game-out logistic** (log-loss / AUC; 863 search decisions, 119 games):

  | features | log-loss | AUC |
  |---|---|---|
  | value | 0.515 | 0.807 |
  | value + map | 0.519 | 0.800 |
  | material | 0.599 | 0.544 |
  | map | 0.621 | 0.657 |
  | material + map | 0.583 | 0.713 |

  - The map features are min answers_j, the count of unanswered threats, the count of our unanswered bodies, and
    Σ min(answers_j, 2).
  - Value vs value + map: −0.0045 [−0.0187, +0.0063]. Games without a forfeit: −0.0034 [−0.0185, +0.0090].
  - All 1,074 decisions (152 games), material vs material + map: +0.023 [−0.005, +0.047].

## 8. For the v3 value-net agent: the code path

```js
const ENGINE = require('solver/arena/engine.js').load('eaa5becc54eb');          // a frozen release, never HEAD
const AM = require('solver/results/2026-10-01-lost-last-answer/answer_map.js').create(ENGINE.API);
const m = AM.answerMap(S, side, { n: 16, seed: 1 });   // S: any MEDICHAM battle (a world.js build, a self-play state)
// m.P[i][j] = P(my live body i beats their live body j); m.answers[j], m.threats[i]; m.mine / m.theirs carry team
// index, name, HP fraction, sheet row. AM.C = counters (duels, steps, probes, memoHits, capped, noMove).
// Options: n (duels per pair), cap (turns, 10), memo (true), prune (false: measured, no faster).
```

- **Positions from a saved ladder log:** `solver/results/2026-10-01-lost-last-answer/maps.js`, which uses
  `solver/tests/ladder_replay.js` `build` and then `world.js` `build` with the hindsight back line.
- **The 1,131 labelled ladder positions:** `solver/results/2026-10-01-lost-last-answer/maps/maps-<run>.jsonl`. Each
  line carries the room, turn, policy, root value, table, P, answers, threats and the actives' legal saves. Game
  results come from the logs (`analyze.js` `readLog`).
- **Cost:** about 3 s of CPU for a 4×4 map at n = 16, from one scratch measurement on the fixture (not an artifact).
  The full run was 1,131 maps on 8 BelowNormal workers on a loaded machine, in about 70 minutes.
- **If v3 takes it:**
  - Make it an auxiliary target: predict `answers` from the position, then drop it at inference.
  - Or an offline label for the training positions.
  - Not a leaf input.

## 9. Reproduce

```
ABRA_REGULATION=regmc node solver/results/2026-10-01-lost-last-answer/maps.js --workers 8      # -> solver/out/lost-last-answer-v1
node solver/results/2026-10-01-lost-last-answer/analyze.js                                     # reads the tracked maps/ copy
node solver/tests/test-answer-map.js ; ANSWER_MAP_BREAK=fullhp node solver/tests/test-answer-map.js   # GREEN, then RED
```

- `maps.js` sets its own priority to BelowNormal, the class `tools/lownode.cmd` uses. This agent's shell refused
  `cmd.exe`, so the run could not go through the `.cmd`.
- A first pass with unshared picks was too slow on the loaded machine. It was stopped after a few games by moving its
  output directory, so its workers exited on their next write. None of its output is used.
- `analyze.js` run against the tracked `maps/` copy reproduces `results.json` exactly (checked).

## OWED, NOT RUN

- **No fix is proposed or tested.** A pre-registered test would be: "include a row that preserves a last answer
  (answers < 1.2) whenever DODUO's top 4 lack one", against gen5 at 5 s by SPRT. It addresses the 14 of 33 events
  where no saving row was searched. It is not registered, and the step 3 contrast says the expected gain is small.
- **The duel policy values no Protect, no setup and no partner.** A Sucker Punch user at low HP therefore reads as
  unanswerable (the robby w example, §2). A policy that includes status moves in the probe table is the next version
  if the map is used for anything.
- **The hindsight back line.** A live-usable map must use XATU's belief. It was not measured.
- **`docs/SOLVER.md` was not restamped.** `node engine/status.js --write` must run from the main checkout after merge,
  and this agent is isolated in a worktree.
- **chomptop was read as finished at 07:02Z** (35 games, `ladder-report.json` present). A later game, if any, is not
  in this read.
