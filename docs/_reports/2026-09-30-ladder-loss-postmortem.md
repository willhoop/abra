# Ladder loss post-mortem: why ROTOM loses the series it plays out (abra/regmc 1.39.0)

2026-09-30. SOLVER. Read-only over the saved ladder games in the main checkout's `solver/out/rotom/`. No game was
played, no engine was loaded, and the analysis needed a few MB of RAM.

## Verdict

- **The chomp1 run lost 26 games without a forfeit.** Each loss has one mechanism at its turning point:
  - VISIBLE_KO 5: we stayed in, or switched in, to a KO that a searched column already held.
  - SPEED_CONTROL 5: the opponent set Trick Room or Tailwind.
  - SUCKER_PUNCH 4: Sucker Punch into Protect, Helping Hand or Rage Powder.
  - OUTSPED 4: in two, our Choice Scarf Basculegion ran Speed SP 2; in two, the opponent's hidden Speed SP decided
    it.
  - SETUP 3: Nasty Plot or Clangorous Soul went unpunished.
  - BEHIND_FROM_PREVIEW 3: the lead exchange was lost.
  - UNSEEN_ACTION 1: the decisive action was outside the four searched columns.
  - PERISH 1: the Perish count is not in the search's world.
- **No loss came from a clock or search timeout** (0 timeouts, 0 fallbacks). **No loss came from a chosen-versus-applied
  mismatch.** The one mismatch was in game 26, after its turning point.
- **Engine-versus-server:** one loss (PERISH), plus one refused switch. The refused switch was in game 26 after its
  turning point: the server knew our mon was trapped by a Skill-Swapped Shadow Tag, and the search did not. Both are
  gaps in ROTOM's world reconstruction, not simulator bugs. See OWED.
- **The value is overconfident in the middle and calibrated at the ends.**
  - Pooled over 668 decisions in 90 games (chomp1 plus the gen5ab search arm), values in [0.5, 0.9) average 0.707.
    Those games were won 51.6% of the time: a gap of +0.19, 95% game-clustered CI [0.06, 0.32].
  - The turn-1 value averages 0.62 against a 0.43 win rate: +0.19 [0.07, 0.28].
  - Below 0.1 and above 0.9 the value is calibrated, and those are the endgames.
- **The fix that matters most is PORYGON2 v2 with depth**, the leaf. VISIBLE_KO, SPEED_CONTROL and SETUP are 13 of
  26: in each, the table already held the opponent's action and the one-turn leaf still valued the position at
  0.42 to 0.87.
- **The cheapest fix is already built, and it covers two losses.** The 1.35.0 spreads fix the two OUTSPED losses
  where our Scarf Basculegion ran Speed SP 2. They do not fix the other two: the new rule leaves our Sneasler and
  Gengar at Speed SP 0 (`ladder-rotation.json` `spreads`), and those two were decided by the opponent's hidden Speed SP.
- SUCKER_PUNCH (4) and PERISH (1) are fixed by none of the planned items.

## 1. What was read

| run | arm | search-arm games | lost, no forfeit | won (of which by the opponent's forfeit) |
|---|---|---|---|---|
| `chomp1-2026-09-29T23-13-11-521Z` | A `miltank-gen5`, 5 s, depth 0, CHOMP v1 preview | 49 | 26 | 23 (12) |
| `gen5ab-2026-09-26T04-06-53-848Z` | A `miltank-gen5`, 5 s, depth 0, the team's own bring | 41 | 25 | 16 (9) |

- Both runs used release `eaa5becc54eb` and the default rotation `solver/rotom/teams/ladder-rotation.json`.
- chomp1 ran from 2026-09-29 23:13Z to about 01:44Z on 2026-09-30. The re-spread (commit `ad24ab4b`, 02:15Z) landed
  after it, so every chomp1 set had the flat 32 HP / 32 attack / 2 Speed spread
  (`docs/_reports/2026-09-30-rotation-spreads.md` §1).
- Series: chomp1 went 10-10, 5-10 without the opponent's forfeits (`ladder-series-medicham32.jsonl`).
- The 50th chomp1 game ended at team preview and has no move decision.
- Forfeits are read from the server's own `|-message|… forfeited.` line. We forfeited nothing.

**Artifacts** (tracked, in `solver/results/2026-09-30-ladder-loss-postmortem/`):
- `postmortem.js` derives every number below into `measured.json`. Run
  `node solver/results/2026-09-30-ladder-loss-postmortem/postmortem.js --root <main>/solver/out/rotom`.
- `classifications.json` holds the hand-read turning point and class of all 26 chomp1 losses. Its values are checked
  against `measured.json`, and every one matches.

## 2. Turning points: how they were chosen

For each lost game, `measured.json` `turning_points` gives two things:
- the highest root value (`info.value`);
- the largest drop between consecutive decisions, with the last decision dropping to 0.

The two often disagree, and the largest drop is sometimes leaf noise. Examples:
- Game 1: 0.30 → 0.03 across a turn in which a double Protect blocked everything and nothing but burn chip changed.
- Game 21: 0.84 → 0.26 across a turn in which the opponent's Heat Wave missed.

So the turning point is the decision the game did not recover from. It is read from the log and the decision's table,
guided by both metrics, and `classifications.json` records it beside them.

## 3. The classes, with counts (chomp1, 26 losses)

| class | n | games (`classifications.json` n) | typical value at the turning point |
|---|---|---|---|
| VISIBLE_KO | 5 | 1, 2, 4, 5, 13 | 0.42–0.85 |
| SPEED_CONTROL | 5 | 6, 7, 8, 15, 17 (Trick Room ×3, Tailwind ×1, both ×1) | 0.63–0.85 |
| SUCKER_PUNCH | 4 | 11, 12, 20, 21 | peak 0.87–0.95 before it |
| OUTSPED | 4 | 9, 22, 23, 26 | 0.43–0.87 |
| SETUP | 3 | 18, 19, 25 | 0.50–0.65 |
| BEHIND_FROM_PREVIEW | 3 | 10, 14, 16 | never above 0.46 |
| UNSEEN_ACTION | 1 | 3 | 0.75 |
| PERISH | 1 | 24 | 0.84 |

The classes Will named that did not occur as a turning point:
- **Fell for Fake Out.** Fake Out appears in two turning points only as a secondary cause (games 25 and 26).
- **Mega timing.**
- **Misread hidden set.** The sheets are open. The hidden part that mattered is the opponent's Speed SP, counted
  under OUTSPED.
- **Spread-damage misjudgement.** Spread moves decided games 4, 6 and 18, but each is filed under the reason the KO
  was taken.
- **Clock or search timeout.** 0 timeouts; every decision took about 4.7 s of 5 s.
- **Chosen-versus-applied mismatch.** 1 in the run (game 26, turn 8, after its turning point). It was the trap case
  below.

Double Protect is a tag, not a class. It is the turning-point decision in games 7 and 18, and a secondary cause in
games 8, 15 and 26.

### Cross-check against the won games, by detector (`measured.json` `detectors`)

| chomp1 | lost, no forfeit (26) | won, no forfeit (11) |
|---|---|---|
| games with a failed Sucker Punch | 7 (10 of 20 used) | 2 (2 of 5) |
| games with a double-Protect turn | 13 (16 turns) | 2 (2 turns) |
| games with a Protect that failed | 17 (21) | 0 |
| games with an opponent's Trick Room | 4 | 3 |
| games with an opponent's Tailwind | 3 | 0 |
| games with a Perish faint of ours | 1 (3 faints) | 0 |

- The failed Protects are mostly the endgame habit: a lost position protects every turn until the repeat fails.
- In the gen5ab search arm, the opponent set Trick Room in **12 of 25** losses and 2 of 7 wins. Tailwind: 6 of 25 and
  2 of 7. On that run speed control is the loudest signal. Its losses were not hand-classified (OWED).

### Does DODUO's narrowing miss the opponent's move? Often, but no more in losses

- chomp1: the opponent's actual move ids fell in one of the four searched columns on 239 of 355 decisions (67%).
  That is 66% in losses and 69% in wins.
- gen5ab: 58% overall, 61% in losses and 51% in wins.
- A third of opposing actions are outside the table either way. The narrowing is not what separates a loss from a
  win, and it was the turning point once (game 3).
- The matching is by move id and ignores targets.

## 4. Examples

1. **Double Protect into Trick Room** (SPEED_CONTROL; Will's case).
   AngryGator game 1, turn 4: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690121468-je1ca9h7t1ieywx0ohi326o4gihs7lfpw
   - Mega Gengar and Hippowdon both Protect. Farigiraf sets Trick Room, which was a searched column (`trickroom, protect`).
   - Value 0.825. The next decision is 0.259, and the game is lost on turn 7.
   - The 1.32.0 and 1.34.0 reports already call this a horizon fault: the one-turn table barely charges for the
     Trick Room turns.
2. **The Perish count is not in the world** (PERISH).
   sdkvndfv game 1, turn 4: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690156746-fo3175ocrtqccorctoq86eyujesnwe8pw
   - Gengar used Perish Song on turn 1, and our Salamence and Volcarona stayed in. On turn 4 both were at perish 1.
   - Every row attacked: the cells were 0.78–0.96 and the value 0.844. Both fainted at the end of the turn. The
     forced-switch value that followed was 0.057.
   - A one-turn playout would have fainted both if the world carried the count. `solver/doduo/double_protect.js`
     line 27 already says "ROTOM's world lays no Perish".
3. **Our Choice Scarf ran Speed SP 2** (OUTSPED).
   Jaylek game 1, turns 3–4: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690154483-dpuuw8l7j3wu1kjy9ambegncf9jk8glpw
   - On both turns the opponent's Scarf Indeedee used Expanding Force before our Scarf Basculegion. The second one
     KO'd Basculegion before it moved.
   - The value went 0.77 → 0.43 → 0.01. Game 3 of the series repeats the pair on turn 2.
   - 1.35.0 moves that Basculegion's Speed stat from 110 to 143 (before the Scarf).
4. **Sucker Punch into Helping Hand, twice** (SUCKER_PUNCH).
   rosescope game 1, turns 3–4: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690133981
   - Kingambit Sucker Punched a Raichu that used Helping Hand on both turns, and both failed. A searched column held
     Helping Hand both times.
   - Our Zap Cannon went into that Raichu's Lightning Rod.
   - Value 0.947 on turn 3. Kingambit fell to the helped Scald on turn 4.
5. **Switched into a KO every column predicted** (VISIBLE_KO).
   theson1909 game 2, turn 3: https://replay.pokemonshowdown.com/gen9championsvgc2026regmcbo3-2690119994
   - All four columns held Sceptile-Mega's Earth Power into slot b. The search switched Gengar into slot b, and
     Gengar was KO'd on entry.
   - The search had also valued the turn before at 0.815, and on that turn Grassy Glide went into a switched-in
     Armor Tail.

## 5. Calibration of the root value (all ladder decisions, both search-arm runs)

Pooled, all games: 668 decisions in 90 games. Mean value 0.473, win rate 0.374. Brier 0.184 against 0.234 for a
constant; AUC 0.816.

| value bin | decisions | games | mean value | game win rate |
|---|---|---|---|---|
| 0.0–0.1 | 143 | 52 | 0.030 | 0.063 |
| 0.1–0.2 | 48 | 26 | 0.153 | 0.208 |
| 0.2–0.3 | 48 | 32 | 0.249 | 0.208 |
| 0.3–0.4 | 50 | 37 | 0.348 | 0.240 |
| 0.4–0.5 | 51 | 35 | 0.451 | 0.176 |
| 0.5–0.6 | 51 | 33 | 0.562 | 0.412 |
| 0.6–0.7 | 74 | 45 | 0.654 | 0.568 |
| 0.7–0.8 | 65 | 44 | 0.749 | 0.385 |
| 0.8–0.9 | 60 | 40 | 0.850 | 0.683 |
| 0.9–1.0 | 78 | 38 | 0.967 | 0.910 |

- **Values in [0.5, 0.9) are +0.191 too high**, 95% CI [0.062, 0.318] (game-clustered bootstrap, B 2000, seed 7;
  84 games, 250 decisions).
  - Among games that ended without a forfeit it is +0.362 [0.226, 0.504]. That filter drops wins by forfeit, so it
    overstates the gap.
  - The all-games figure understates it where an opponent quit a position it was winning.
- **Turn 1:** chomp1 mean 0.615 against 0.469 won (AUC 0.666). gen5ab 0.631 against 0.390 (AUC 0.573). Pooled gap
  +0.189 [0.070, 0.275].
- **Games that ended without a forfeit:** the Brier score is 0.1857 against 0.1852 for a constant. On the games we
  play to the end, the root value is no better than a constant at predicting the result, although it ranks
  positions (AUC 0.83).
- The ends are right: 0–0.1 wins 6%, and 0.9–1.0 wins 91%. These are endgames, where a one-turn leaf sees the result.
- **CHOMP's preview value** (chomp1, 49 games): mean 0.548 against 0.469 won. Bring values of 0.55 or more won 55.6%
  (n 27); below 0.55, 36.4% (n 22). It ranks and runs about +0.08 high, on a small sample.

**What this says about the value net.** The error lives where decisions are made: mid-game positions between 0.4 and
0.9. The same one-turn leaf misreads in 13 of the 26 losses (VISIBLE_KO, SPEED_CONTROL and SETUP):
- it valued a position after Kingambit died higher than before (game 1, 0.50 → 0.76);
- it valued a Trick Room turn at 0.63–0.82 (games 7 and 8);
- it valued a +2 Delphox-Mega at 0.65 (game 19).

Decisions are clustered within games, so the effective sample is the 84–90 games, and the CIs above account for that.

## 6. Which planned fix addresses which class

| class | n | PORYGON2 v2 | human-prior λ (piKL, 1.34.0) | CHOMP v2 (spreads, field) | team rotation / spreads | none of them |
|---|---|---|---|---|---|---|
| VISIBLE_KO | 5 | **yes**: the table held the KO; the leaf mis-valued it | partly | | | |
| SPEED_CONTROL | 5 | **yes, with depth**: a horizon fault on Trick Room / Tailwind turns | partly (humans honour Trick Room and Tailwind, 1.32.0) | field | | |
| SETUP | 3 | **yes**: the value of a boosted foe | partly (humans punish setup) | | | |
| OUTSPED | 4 | | | spreads | **yes** for games 22 and 23 (Scarf Basculegion to Speed SP 32, 1.35.0); **no** for games 9 and 26 (the new rule gives Sneasler and Gengar Speed SP 0) | games 9 and 26: the opponent's hidden Speed SP, read by XATU's spread belief (uniform prior) |
| SUCKER_PUNCH | 4 | | partly | | | **yes**: no plan targets it |
| BEHIND_FROM_PREVIEW | 3 | | | **yes** | top-meta rotation (1.31.0) | |
| UNSEEN_ACTION | 1 | | | | | **yes** (DODUO's k = 4 narrowing) |
| PERISH | 1 | | | | | **yes**: ROTOM's world must lay the Perish count |

- **The largest share is PORYGON2 v2 with depth: 13 of 26.** The calibration gap of +0.19 in [0.5, 0.9) is the same
  fault seen across all decisions.
- **The cheapest is already built.** The 1.35.0 spreads (Scarf and Tailwind at Speed SP 32) plus the top-meta rotation
  address OUTSPED and part of BEHIND_FROM_PREVIEW. That is up to 5 of 26 (2 OUTSPED and 3 BEHIND_FROM_PREVIEW), and no series has been played on either.
- **SUCKER_PUNCH has no owner.** On the ladder it failed 10 times in 20 uses in the losses. The 2026-07-30 lesson
  about priority blocking (CLAUDE.md) is the engine half and is fixed. This is the search half: a Sucker Punch row is
  worth only what the opponent's attack columns are worth.

## OWED, NOT RUN

- **ROTOM's world lays no Perish count.** Game 24 lost two mons to it at a table value of 0.84. The code note already
  exists (`solver/doduo/double_protect.js` line 27); no fix is registered. The fix is SOLVER's, in the world builder
  (the server state is right and MEDICHAM plays Perish). It needs a live-state probe that stages perish 1 on both
  actives and shows the table's value fall.
- **ROTOM's world does not carry a Skill-Swapped ability.** In game 26, turn 8, the server refused
  `switch 4` ("The active Pokémon is trapped"). Espeon had Skill Swapped our Gengar-Mega's Shadow Tag on turn 6. It was
  counted as `server_error` plus one `applied_mismatch`. To decide whether it is the world builder or MEDICHAM, probe
  the world at that request. It is not filed to `docs/ENGINE.md`, because nothing yet shows the simulator is wrong.
- **The gen5ab search arm's 25 losses are not hand-classified.** Only the detectors and the calibration read them. Its
  12 of 25 Trick Room losses say SPEED_CONTROL would lead there.
- **Sucker Punch needs a pre-registered test and a named baseline** before any fix (for example: include the target's
  Protect or status column whenever a Sucker Punch row is searched). The baseline is gen5 at 5 s.
- **The top-meta rotation with the 1.35.0 spreads has played no series.** The OUTSPED share is a prediction about it,
  not a measurement. The command is Will's (`docs/_reports/2026-09-30-top-meta-rotation.md`).
- **The value-calibration figures are the live baseline for PORYGON2 v2.** Its gates (`solver/porygon2/v2/preregistration.json`)
  are offline. A ladder re-read of this table after v2 plays is owed, with the same script.
