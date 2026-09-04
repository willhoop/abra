# THE 77 BOARD-MATERIAL GAMES, GROUPED BY MECHANISM

Diagnosis only. **Nothing was fixed, no engine byte moved, no released artifact was rewritten.**

## What was measured, and how the read was made safe

`data/game-differential.json` (generated 2026-09-04T02:01Z, release `8ad06030e129`, arm `middle`,
`--end-state`, census `9446a684709d`, pool `0d103fb9fa87`, cap 12) carries `state.games` 961 and
`state.games_board_never_diverged` 884 -> **77 board-material games (8.0%)**.

**The artifact only names 40 of the 77.** `game_differential.js:7361` is
`results.filter(r => r.stateDiv).slice(0, 40)`. To get all 77 without touching the published file the
run was reproduced with the same pins, **without `--write`**, using the pre-existing env hook
`MEDI_SAMPLE_DUMP` (`:6521`), which records `board_parted_turn` and the full `board_parted_paths` for
**every** game, uncapped:

```
SHOWDOWN_PATH=... MEDI_SAMPLE_DUMP=data/_diag77-sample.json \
  tools\lownode.cmd engine\game_differential.js --steering empirical --games 1200 --arm middle \
  --release 8ad06030e129 --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json --end-state \
  --dump-games 250 --dump-out data/_diag77-cards.json
```

**THE `--steering empirical` FLAG IS LOAD-BEARING AND WAS MISSED ON THE FIRST ATTEMPT.** Without it the
driver is `coverage`, and the same pins produce **961 games, 6 protocol divergences, 961/961 boards
identical** - a completely different sample that would have read as "the 77 do not exist". The pinned
artifact's `steering.policy` is `empirical-click/v1`; the flag is how you get it.

With the flag the run reproduces the artifact **exactly**: 961 games / 168 diverged / 884 boards never
diverged, so every row below is the same population the gate counts.

Inputs were stable across the run (nothing under `engine/` or the pinned data newer than 03:05; run
started 04:14). `data/game-differential.json` itself was never rewritten (mtime still Sep 3 22:16).

**HAZARD OBSERVED, REPORTED NOT ACTED ON:** at 04:25-04:28, while this pass was writing up,
`CHANGELOG.md`, `docs/ROADMAP.md` and `docs/_reports/2026-09-04-register-rows-filed.md` were modified
by something else on this machine. No engine source and no pinned input moved, so this diagnosis is
unaffected - but the brief said no other agents were running and that is not what the tree says.

Two working files were created and are **left in place, not deleted**: `data/_diag77-sample.json`,
`data/_diag77-cards.json`.

### The join

`_diag77-sample.json` gives all 77 board diffs. `_diag77-cards.json` gives the protocol window
(`cls`, `cause`, the two parting lines, and the six lines before) for the 160 non-void diverging games.
Joined on `config|seed`:

- 77 board-parted
- 66 of them also diverged on the protocol; **11 did not** (the UNCAUSED set, section 2)
- 58 of the 66 matched a card; **the 8 that did not are exactly the 8 VOID games** - `DUMP_POOL`
  filters `r.div && !r._mid_void`, the dump contains all 160 non-void diverging games, and the run
  reports `VOID (instrument desync): 8 of 961`. 66 - 58 = 8 = the whole void set.

---

## 0. THE FINDING THAT IS NOT AN ENGINE DEFECT: 8 OF THE 77 ARE VOID

`quarantine.js:2298` reads `state.games` minus `state.games_board_never_diverged`.
`game_differential.js:7152` computes that denominator as `results.filter(r => r.boundaries > 0)` -
**with no `_mid_void` filter.** The protocol clause in the same artifact does exclude them: the run
prints `DIVERGED among the 953 usable games: 160`.

So two clauses over the same population treat the void set differently. Eight games whose *dice
streams desynchronised* - where the instrument itself says "these are NOT divergences" - are counted
as board-material.

The eight, by first board leaf:

| # | cfg | turn | first board leaf |
|---|---|---|---|
| 2 | baseline | 2 | `p2.party.incineroar.hp` 160/98, `item` sitrusberry/"" |
| 15 | omit-protect | 4 | `p1.party.klefki.hp` 15/23, `status` brn/"" |
| 27 | omit-weather | 6 | 18 leaves; game THREW |
| 37 | omit-intimidate | 5 | `p1.party.swampert.hp` 113/175 |
| 41 | omit-spread | 6 | 29 leaves incl. `p1.screens.physical` 2/3, `p1.tailwind` 0/1 |
| 44 | omit-spread | 6 | `p1.party.arbok` alive/fainted |
| 51 | omit-spread | 9 | `p1.active[1].vol.charging` 1/0 |
| 62 | pair-protect-bust | 2 | `p2.party.charizard.status` frz/"" |

**The void set's own cause is itself an engine defect** and is the same one as mechanism M1 below -
the run's unshared-address table reads `9 crit populationbomb [sd only]`, `9 dmg populationbomb
[sd only]`, `8 acc partingshot [sd only]`. Showdown drew dice for Population Bomb arrivals we never
made.

Excluding them takes the gate from **77 of 961 (8.0%) to 69 of 953 (7.2%)** with no engine change.
**That is a MEASURE decision about a denominator, not an ENGINE fix, and it is flagged here rather
than taken.**

---

## 1. THE MECHANISM LIST, RANKED

Grouped by mechanism, never by comparator class. The `families` table in the artifact
(`active[].hp` 42 games, `party.hp` 41, ...) is a leaf tally and names none of these.

Each row: **SYMPTOM** = what actually differs on the board (measured). **HYPOTHESIS** = my best read of
the cause, explicitly untested unless the evidence line says otherwise.

---

### M1 - MULTI-ACCURACY VOLLEY: the two engines land a different number of arrivals - **6 games, plus most of the 8 VOID**

Games 7, 19, 21, 31, 57, 77. Moves: `tripleaxel` x3, `populationbomb` x3.

**SYMPTOM.** In every one of the six, Showdown's stream continues with more `-damage` lines while ours
emits `-hitcount <slot> 1`. The board consequence is HP, and in three of them a body Showdown has
killed is still standing for us (game 19: `p1.party.blastoise` 97 HP alive vs 0 fnt; game 21:
`p2.party.maushold` 27 alive vs 0 fnt; game 31: `p2.party.raichu` 84 alive vs 0 fnt).

**HYPOTHESIS - and this one carries a hard derivation.** Exactly **two** moves in this regulation carry
`multiaccuracy`, and they are exactly the two that appear:

```
SHOWDOWN_PATH=... node -e "... D.moves.all().filter(m=>legal(m)&&m.multiaccuracy)"
  populationbomb(hits=10,acc=90), tripleaxel(hits=3,acc=90)
```

`multiaccuracy` means the accuracy check is repeated **per arrival after the first**, at a call site
inside the hit loop rather than at `hitStepAccuracy`. Every one of the six games stops at arrival 1 on
our side. At 90 accuracy an independently-drawn per-hit check diverges about 10% of the time per extra
arrival - 1 extra check for Triple Axel, 9 for Population Bomb - which is the right shape for
"Population Bomb dominates the void table". The claim to test is that the per-arrival accuracy draw
takes a **different shared address** on the two engines (or that one side draws it and the other does
not), not that the count formula is wrong.

**Register:** #361 (*"THE MULTI-HIT COUNT DIVERGENCE DOES NOT REPRODUCE"*, filed 2026-08-22 with no
verdict, on Scale Shot). **It reproduces now, on 6 games, and Scale Shot is not `multiaccuracy` - so
#361's fixture was the wrong move.** #333 is multi-hit DAMAGE and #511 is a dropped `-hitcount` on a
collapsed volley; neither is this.

---

### M2 - SINGLE-HIT DAMAGE VALUE DIFFERS - **7 games**

Games 4, 17, 18, 32, 39, 58, 67. All `-damage field 3` with identical attacker/target/move on both
sides and a different number.

**SYMPTOM.** Named, with the gap:

| # | line | SD | us | gap |
|---|---|---|---|---|
| 4 | Moonblast -> Gengar | 101/135 | 90/135 | 11 |
| 17 | Moonblast -> Floette-Mega (brn) | 82/149 | 97/149 | 15 |
| 18 | Moonblast -> Floette-Mega | 74/149 | 92/149 | 18 |
| 32 | Moonblast -> Archaludon | 77/165 | 48/165 | 29 |
| 39 | Beat Up -> Milotic | 161/170 | 164/170 | 3 |
| 58 | Gigaton Hammer -> Lucario (resisted) | 75/145 | 93/145 | 18 |
| 67 | Vacuum Wave -> Gardevoir | 21/143 | 22/143 | 1 |

**HYPOTHESIS - this is at least two mechanisms and should NOT be worked as one.** Games 39 and 67 are
gaps of 3 and 1 on totals near 170 and 143 - that is a damage-roll INDEX, the shape #333/#334 describe.
Games 17, 18 and 32 are gaps of 15-29, far outside the 85-100% band, so they are a MULTIPLIER, not an
index. Games 17 and 18 are the same species pair, and the party key is `floetteeternal` while the
`switch` line reads `floette-mega` - **a forme/stat mismatch is the first thing to rule out there, not
the roll.** I did not separate them; that separation is the first work on this group.

**Register:** #333, #334 cover the index half. The multiplier half (17/18/32) is **NEW** - no register
row names a Moonblast-class damage gap of 15-29.

---

### M3 - A NON-PERMANENT FORME IS NOT REVERTED WHEN THE BODY LEAVES THE FIELD - **6 games**

Games 1, 38, 50, 53, 56, 72. Carriers: Morpeko/Hunger Switch x3, Aegislash/Stance Change x2,
Castform/Forecast x1.

**SYMPTOM.** A benched or leaving body holds the transformed forme for us and the base forme for
Showdown:

- `p2.party.morpeko.species` `morpekohangry` / `morpeko` (games 1, 56; game 50 the same on `active`)
- `p2.party.aegislash.species` `aegislashblade` / `aegislash` (game 38)
- game 72 is the same fact caught mid-switch: `switch p1a: Aegislash|Aegislash, L50|[from] U-turn`
  against our `switch p1a: Aegislash|aegislash-blade, L50|[from] uturn`
- `p2.party.castform.species` `castformrainy` / `castform` **and** `.types` `water` / `normal`
  (game 53) - the types leaf makes this board-material beyond a name

**HYPOTHESIS: already root-caused, not by me.** ROADMAP #328 C1: Showdown's `formeChange` takes an
`isPermanent` flag, Hunger Switch passes nothing, and `clearVolatile` on switch-out puts the base
species back; `medicham2-browser.js` does not. #505 records the same gap on the FAINT path.
Stance Change and Forecast are the same shape and are **not named in #328** - it was written about
Morpeko alone.

**Register:** #328 C1 (open, ENGINE half). Aegislash and Castform as carriers are NEW.

---

### M4 - THE CHOICE LOCK IS NOT CLEARED - **5 games**

Games 9, 10, 45, 52, 59. `active[].vol.choicelock` = `transform` / `darkpulse` / `phantomforce` /
`lastrespects` / `trick`; **Showdown holds no lock in all five.** One-directional, 5 of 5.

**SYMPTOM.** We hold a body bound to a move Showdown has freed. This is board-material *and*
decision-material: a locked body cannot click its other three moves. Game 9 shows the consequence -
our Ditto re-clicks `transform` on the turn Showdown's Ditto uses the Earthquake it copied.

**THE INSTRUMENT HYPOTHESIS WAS TESTED AND REFUTED.** `board_state.js:1155` reads the Showdown side as
`v.choicelock ? id(v.choicelock.move || '') : ''`, and `choicelock` is **not** in the planted-state
proof list - so "the Showdown reader can never populate this leaf" was a live explanation for a leaf
that differs one-way in 5 of 5. I staged it directly: a Choice Scarf Weavile clicking Ice Shard in a
real `gen9championsvgc2026regmb` battle yields `p.volatiles.choicelock = { ... move: 'iceshard' }`.
**The reader works. This is the engine.**

**HYPOTHESIS.** Showdown removes the volatile in `data/conditions.ts:349` `onDisableMove` on two
conditions we do not implement: `!pokemon.getItem().isChoice` (Trick - game 59) and
`!pokemon.hasMove(this.effectState.move)` (Transform rewrites `moveSlots`, so `hasMove('transform')`
is false - game 9). `board_state.js:1023` reads our side as the **raw**
`m._lockT === Infinity && m._lock`; `lockStillBinds` (`medicham2-browser.js:14317`) already knows the
item rule but the board never calls it, and the `hasMove` rule is not implemented anywhere. Games 10,
45 and 52 (`darkpulse`, `phantomforce`, `lastrespects`) are not explained by either clause and are the
part that needs a probe. Note only **Choice Scarf** is legal here - Band and Specs are banned - so this
is one item.

**Register:** NEW. No row names `choicelock`.

---

### M5 - SUCKER PUNCH DOES NOT FAIL INTO A REDIRECTOR - **4 games**

Games 14, 46, 69, 70. One shape in all four:

```
move <TARGET> followme <TARGET>          (or ragepowder)
-singleturn <TARGET> move: followme
move <ATTACKER> suckerpunch <TARGET>
SD:  -fail <ATTACKER>
US:  -damage <TARGET>  /  -resisted <TARGET>
```

**SYMPTOM.** Showdown refuses the Sucker Punch; we land it. Board: the redirector's HP (game 70:
`p1.party.maushold.hp` 58 for us, 149 untouched for Showdown - a 91 HP board difference on turn 9).
Attackers: Kingambit x3, Meowscarada x1.

**HYPOTHESIS.** The target used a **status** move and, at +2/+3 priority, has **already moved** - both
of Sucker Punch's refusal clauses apply, and neither fires. The distinguishing feature against the
already-closed row is that the target is a **redirector**: my read is that the refusal is evaluated
against the ORIGINAL target and the move is then redirected, so the check never sees the Follow Me
user. Untested.

**Register: THERE IS A CLOSED ROW SITTING OVER THIS.** #403 (*"SUCKER PUNCH LANDED ON A TARGET THAT HAD
ALREADY MOVED"*, closed 2026-08-23, 85/85 -> 0/85, four whole-game divergences -> zero). That fix is
real and this is not it. **Four games say the mechanic is still wrong on the redirect road.**

---

### M6 - CONFUSION SELF-HIT DAMAGE - **4 games**

Games 8, 35, 47, 74. `-damage X H/H [from] confusion` with different values: 1/5, 110/107, 78/81,
179/178. Gaps of 4, 3, 3, 1 - inside the 85-100% band, i.e. a different INDEX.

**Register:** #334, open, root cause explicitly unprobed. Exactly the predicted symptom. No new work
to define.

---

### M7 - PROTECT UNDER ENCORE: the shield holds on one engine and not the other - **4 games**

Games 3, 30, 33, 43. One shape:

```
move <X> encore <TARGET>
-start <TARGET> move: encore
move <TARGET> protect
SD:  -singleturn <TARGET> Protect      US: -fail <TARGET>      (games 3, 30, 33)
SD:  -fail <TARGET>                    US: -singleturn ...     (game 43 - the other way)
```

**SYMPTOM.** `active[].stall` reads 0 for us against 9 for Showdown (games 3, 33) and 9 against 0
(game 43). Game 30 cascades into an 8-leaf board including a mega Dragonite alive at 7 HP for
Showdown and fainted for us.

**HYPOTHESIS.** The `middle` arm frees the stall counter onto its **own seeded stream**, so consecutive
Protect is a shared die. `stall` is the DENOMINATOR (3, 9, 27); the two engines are rolling against
different denominators, which means one of them is counting consecutive shields differently under a
forced (Encore'd) Protect. It is not an ordering tie - see section 3.

**Register:** #195 puts *the Stall ability* in the closet. **That is a different thing from the `stall`
volatile counter and must not be read as covering this.** NEW.

---

### M8 - AN ABILITY TRANSFER LANDS ON THE WRONG BODY, OR THE ACQUIRED `onStart` NEVER RUNS - **4 games**

Games 42, 48, 61, 73. Carriers: Skill Swap x2, Wandering Spirit x2, Mummy x1 (48 is Mummy through a
Skill Swap board).

**SYMPTOM, split in two:**

*Wrong body* - game 48: `p1.party.scrafty.ability` is `mummy` for us and `intimidate` for Showdown; the
Mummy carrier on the field is Cofagrigus and Scrafty is **benched**. Game 61:
`p1.party.metagross.ability` `wanderingspirit` / `clearbody`, and Metagross was dragged in earlier -
the swapped ability was written onto a body that was not in the swap.

*Acquired `onStart` not run* - game 73: Showdown emits
`-activate p2b: Scrafty|Skill Swap|Wandering Spirit|Intimidate|[of] p1a: Runerigus` and then drops
**both** p2 bodies' Attack (`boosts.atk` -1/-1); we emit `-activate p1a: Runerigus|ability: intimidate`
and apply nothing. Game 42 is the same on a Skill Swap that hands Wyrdeer an Intimidate.

**HYPOTHESIS.** `setAbility` ends `singleEvent('Start', ability, ...)` in the authority, so an ability
acquired mid-turn immediately runs its entry handler. `probe_mega_trace_entry.js`'s own scope note says
`receiverSweep` counts `MEDFAILS.inheritedAbilityStartNotFired` and `traceSweep`'s deferred copies have
no counter at all - so a counter for this already exists and was never read on a real game.

**Register:** NEW as a whole-game board finding. The `inheritedAbilityStartNotFired` counter exists;
the wrong-body half is not named anywhere.

---

### M9 - THE `stall` COUNTER DRIFTS WITH NO PROTOCOL DIVERGENCE - **2 games**

Games 25, 29. `active[].stall` 0 for us, 3 for Showdown, and **the narration never parts.** Same leaf
as M7 with the outcome not yet realised. Part of the UNCAUSED set (section 2).

---

### M10-M15 - the two-game mechanisms

| id | mechanism | games | symptom | hypothesis (untested) |
|---|---|---|---|---|
| M10 | **A freeze we apply and Showdown does not** | 28, 68 | `party.status` `frz` / `""` on Charizard and Mawile | game 28 is a Blizzard spread where Showdown KOs the first target and does NOT freeze the second - the `sec` draw for target 2 after a KO on target 1. (Game 62 is the same leaf and is VOID.) |
| M11 | **Dire Claw sleep - attribution and duration** | 63, 66 | `-status field 4`: SD `-status X slp`, us the same with `[from] move: direclaw`. Board: we hold `slp` with `status_counter` 2, Showdown holds none | the `[from]` is narration; the board half is the sleep CLOCK. Champions sleep is 1 or 2 turns - we are one turn long, or we drew a different duration |
| M12 | **Partial trap (Infestation) duration** | 16, 36 | SD `-end X Infestation [partiallytrapped]` (expired), us `-damage ... [from] move: infestation` (still ticking). Game 36 the extra tick KILLS Kingambit | the trap counter runs one turn long. #111 closed the volatile-duration family *including Infestation* - the effect is back |
| M13 | **Soundproof vs Perish Song** | 40, 60 | game 60: SD `-immune p1b: Kommo-o [from] ability: Soundproof`, us `-start p1b: Kommo-o perish3` - board `vol.perish` 3/0. Game 40: SD `-fail p1b: Altaria` on the Perish Song, us `-fieldactivate Perish Song` | Soundproof does not refuse Perish Song for us; game 40 is the all-targets-immune case where the whole move should fail |
| M14 | **A berry Showdown eats and we do not** | 23, 24 | SD `-enditem p2b: Incineroar Sitrus Berry [eat]` and `-enditem p1b: Grimmsnarl Roseli Berry [eat]`; board holds the berry still in our pocket and the HP 42 apart (game 23) | two different berries (pinch and resist), so probably two causes. #167 is Sitrus firing on the wrong side of its threshold and is open |
| M15 | **Poison Touch's secondary** | 26, 34 | **both directions.** Game 34: SD poisons Goodra after a Lum Berry cure, we do not. Game 26: we poison Clefable, Showdown eats a Sitrus instead and does not | an address, not a rate: the ordering of the pinch-berry eat against the contact-ability secondary shifts the shared `sec` die |

---

### M16-M30 - the fifteen singletons

| # | mechanism | leaf |
|---|---|---|
| 5 | full-paralysis die: SD `cant p1a par`, we move | `pp[].moonblast` 2/1 |
| 6 | terrain end vs a self-aimed Play Rough after a double KO | `pp[].expandingforce` 1/2 |
| 11 | `vol.charging` not cleared - no protocol divergence | `active[].vol.charging` 1/0 |
| 12 | Staraptor's Attack: SD `-boost` +1, we `-unboost` -1 (net 0 vs +2) | `boosts.atk` 0/2 - Contrary sign, hypothesis |
| 13 | a Rock Slide spread crits a **different body**: SD `-crit p2a`, us `-crit p2b` | `party.whimsicott.hp` 65/86 |
| 20 | Cursed Body's Disable does not fire off a fainting body | `vol.disable` 0/3 |
| 22 | Close Combat's self-drop skipped when the hit broke a Substitute | `boosts.def/spd` 0/-1 |
| 49 | Wide Lens removed from a Talonflame that Showdown still holds | `party.talonflame.item` ""/widelens |
| 54 | `-activate X move: Struggle` missing from our stream; the game then desynchronises into an 18-leaf placement cascade | `active[1].species` sneasler/incineroar |
| 55 | Leech Seed applied where Showdown answers `-fail` | `party.politoed.hp` 95/115 |
| 64 | Drain Punch's `-heal ... [from] drain` missing after a Chople Berry `[eat]`+`[weaken]` pair | both sides' HP |
| 65 | residual order: SD tolls `[from] brn` first, we toll `[from] Leech Seed` | `party.pelipper.hp` 95/111 |
| 71 | Rage Powder + spread + Substitute: SD ends the Substitute where we resist onto the ally | `party.tyranitar.hp` 128/110 |
| 75 | `p2.tailwind` 2/3 - the side clock is one short, no protocol divergence | `tailwind` |
| 76 | confusion self-hit **die** (not damage): SD's Gholdengo hits itself, ours moves twice more | `boosts.spa` -6/-4 |

Group totals: M1 6, M2 7, M3 6, M4 5, M5 4, M6 4, M7 4, M8 4, M9 2, M10-M15 12, singletons 15,
VOID 8. **Sum 77.**

---

## 2. THE 11 UNCAUSED - a board that parts with nothing in the narration

`77 - (168 - 102) = 11`. These are the games where `board_parted_turn` is set and `diverged` is false.

**They are not mysterious, and they are not eleven separate problems. They are FIVE leaves that the
protocol never narrates:**

| # | cfg | turn | leaf | mechanism |
|---|---|---|---|---|
| 1 | baseline | 5 | `p2.party.morpeko.species` hangry/base | M3 forme revert |
| 38 | omit-intimidate | 5 | `p2.party.aegislash.species` blade/base | M3 forme revert |
| 53 | omit-spread | 7 | `p2.party.castform.species` rainy/base + `.types` water/normal | M3 forme revert |
| 56 | omit-spread | 5 | `p1.party.morpeko.species` hangry/base | M3 forme revert |
| 10 | baseline | 9 | `p2.active[1].vol.choicelock` darkpulse/"" | M4 choice lock |
| 45 | omit-spread | 4 | `p1.active[0].vol.choicelock` phantomforce/"" | M4 choice lock |
| 52 | omit-spread | 5 | `p1.active[0].vol.choicelock` lastrespects/"" | M4 choice lock |
| 11 | baseline | 7 | `p1.active[0].vol.charging` 1/0 | two-turn lock not cleared |
| 25 | omit-weather | 7 | `p1.active[1].stall` 0/3 | M9 stall counter |
| 29 | omit-weather | 9 | `p1.active[0].stall` 0/3 | M9 stall counter |
| 75 | pair-speedctrl | 10 | `p2.tailwind` 2/3 | tailwind clock |

**WHY THEY ARE SILENT IS THE FINDING.** A benched body's forme is announced once, on the way in. A
`choicelock` volatile has no protocol line at all. A two-turn charge lock has none. The `stall`
denominator is invisible until a shield fails. A side's Tailwind counter is announced at start and at
end and never in between. **Every one of the 11 is a leaf whose value cannot be read off the wire** -
which is exactly why the narration clause counted none of them, and exactly why a repair aimed at
narration could move the headline without moving the engine.

**Nine of the 11 fall inside mechanisms that already have games in section 1** (M3 x4, M4 x3, M9 x2).
Two are their own singletons (`vol.charging`, `tailwind`). **The UNCAUSED set costs almost no extra
work: fix M3 and M4 and eight of the eleven go with them.**

---

## 3. WHICH ARE TIES RATHER THAN DEFECTS

**None of the 77, on the evidence in this artifact.** Checked, not assumed:

- `order_probe` carries the only speed/priority metadata in the run and holds **two** rows.
  Row 1 IS one of the 77 (game 9, Ditto): `speed_gap 0`, `same_priority true`, `speed_tied true` -
  **but `showdown_first` and `medicham_first` name the SAME slot (`p2b:ditto`)**. The ordering agrees;
  the divergence is `same_move: false`, which is M4 (our Ditto is choice-locked into Transform). It is
  not a tie. Row 2 has `speed_gap 286` and its seed is not among the 77 at all.
- **The Protect/Detect exact-tie family the brief warns about is NOT in this set.** The four Protect
  rows (M7) are not ordering disagreements: both engines run the Encore'd Protect at the same point and
  disagree on whether the shield HOLDS, which is the shared `stall` die.
- Speed ties generally are pinned: the `middle` arm resolves them "to the EARLIER body" on both sides
  and the run resolved 59,028 tied groups without either engine choosing freely.

**The closest thing to "not work" in the 77 is the VOID 8 (section 0)** - not because there is no
correct answer, but because the instrument has already declared those comparisons invalid.

---

## 4. REGISTER COVERAGE - what is filed and what is new

Read from `node engine/open_work.js` (497 rows, 251 open) and `docs/ROADMAP.md`.

**Covered by an OPEN row - no new row needed:**

| mechanism | games | row |
|---|---|---|
| M3 forme revert on switch-out | 6 | **#328 C1** - open, ENGINE half, root-caused with a control. Names Morpeko only; **Aegislash and Castform are new carriers of the same root** |
| M6 confusion self-hit index | 4 | **#334** - open, symptom matches exactly, root cause declared unprobed |
| M2 index half (games 39, 67) | 2 | **#333** - open, multi-hit damage roll; #334 for the confusion road |

**Covered by a row that is WRONG or CLOSED over a live defect - these need saying:**

| mechanism | games | row | why it does not cover it |
|---|---|---|---|
| M5 Sucker Punch into a redirector | 4 | **#403, CLOSED 2026-08-23** | #403 fixed the already-moved queue clause (85/85 -> 0/85, four whole-game divergences -> zero) and is real. Four games say the mechanic is still wrong when the target is a Follow Me / Rage Powder user |
| M1 multi-accuracy volley | 6 + void | **#361**, open, *"does not reproduce"* | filed on Scale Shot, which is **not** `multiaccuracy`. It reproduces on the two moves that are |
| M7 Protect under Encore | 4 | **#195** closets *the Stall ability* | that is the ability with zero corpus uses; this is the `stall` VOLATILE counter. Different thing |
| M12 Infestation trap duration | 2 | **#111** closed the volatile-duration family *including Infestation* | the effect is back on the board |

**NEW - nothing in the register names these:**

- **M4 the choice lock is not cleared** (5 games) - no row mentions `choicelock`
- **M2 multiplier half** (games 17, 18, 32 - Moonblast gaps of 15-29) - every damage row on the
  register is about the roll INDEX
- **M8 ability transfer to the wrong body** (2 of 4) - the `inheritedAbilityStartNotFired` counter
  exists for the `onStart` half; the wrong-body half is unnamed
- **M10 freeze after a spread KO**, **M13 Soundproof vs Perish Song**, **M15 Poison Touch both
  directions**, **the `vol.charging` leak**, **the tailwind clock**, and the twelve other singletons
- **Section 0, the void 8 inside the board denominator** - a MEASURE question, unfiled

---

## 5. UNBURDEN - asked for, answered, not re-investigated

**It does not appear among the 77 as a named cause.** `board_state.js` compares no speed leaf at all,
so Unburden can only reach the board through a downstream turn-order change, and none of the 77 cards
attributes to it.

It DOES appear once in the run's **speed-desync** block, which is a different measurement:
`ability=unburden item=- ... p2a sneasler showdown 154 medicham 308 (turn 8)` - exactly 2x, on a body
holding no item, which is the reported defect's signature. That block is not the 77, and every row in
it reads `sd:fnt` (a corpse compared against a living body), so it is the index-parallel pairing
failing rather than a board comparison. Reported and left alone.

---

## 6. RECOMMENDED FIRST BATCH - three mechanisms, 17 of the 77 plus most of the void 8

Chosen on value per unit of work, and deliberately **not** on the largest family table entry
(`active[].hp`, 42 games - which is a leaf, not a mechanism, and spans nine of the groups above).

**1. M1 - the multi-accuracy volley (6 board-material + the Population Bomb share of the 8 VOID).**
The regulation contains exactly **two** `multiaccuracy` moves and both are in the set - that is a
derivation, not a guess, and it makes the surface a single call site. It is the only mechanism here
that pays twice: it takes games out of the board count **and** out of the void count, and the void
count is what makes eight other games unattributable. Probe: stage Triple Axel and Population Bomb
under the pinned `middle` dice and assert both engines take the **same number of `acc` draws at the
same addresses**, not merely the same number of hits - the count is the symptom, the address is the
claim.

**2. M3 - the non-permanent forme revert on switch-out (6, four of them UNCAUSED).**
Already root-caused with a control by #328 C1 and never landed because that day's file was owned by
another agent. Three carriers, one rule (`clearVolatile` -> `setSpecies(baseSpecies)` where
`isPermanent` was not passed), and #505 says the faint path has the same hole. This is the cheapest
six games on the board, and it clears four of the eleven UNCAUSED with it.

**3. M4 - the choice lock is not cleared (5, three of them UNCAUSED).**
The instrument explanation was live and is now **refuted by measurement** (Showdown's
`volatiles.choicelock.move` populates; I staged it), so the engine is the answer. Only Choice Scarf is
legal here, so it is one item. Two of Showdown's three removal conditions are readable straight off
`data/conditions.ts:332-352`, and `lockStillBinds` already implements one of them and is simply not
consulted by the board. It is also the only group in the set that is **decision-material as well as
board-material** - a body we hold locked cannot click three of its moves in any rollout.

Combined: **17 of 77 directly, plus the void 8 becoming attributable.** All three are one root each,
all three have a named code site, and none of them is a damage-number question - which keeps
#333/#334's die-index work off the critical path where it does not belong.

**Deliberately NOT in the first batch:** M2 (7 games) - it is at least two mechanisms and the split has
to be done before any of it is worked, or the result is unattributable.
