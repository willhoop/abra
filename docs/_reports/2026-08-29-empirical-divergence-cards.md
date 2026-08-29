# THE CARD REVIEW — 2026-08-29 (the empirical-click arm)

**135 games in this run have a board that genuinely differs. This file groups them by MECHANISM —
36 groups — so they can be read rather than tallied.** Ranked table first, one short card each,
biggest group first. The groups I could NOT explain are in their own section at the end, marked.

Measured on `data/verification/game-differential.empirical.json`, release `e129bca605e3`, census pin
`9446a684709d`, `--team-store data/team-pool-frozen`, pool `0d103fb9fa87`, 961 games, cap 12,
arm `middle`, policy `empirical-click/v1`. Cards from a re-run of the identical pins with
`--dump-games 250`, written to `data/verification/divergence-turns.empirical.json` (235 of 248) and
`data/verification/gd-empirical-cards.json`. **Nothing was fixed and nothing was committed.**

---

## WHY THESE 135 EXIST NOW AND DID NOT LAST WEEK

The coverage-seeking driver clicks whatever the census has not seen. It reaches turn 12 in 98% of its
games and ends almost none of them, so it never plays the part of a game where bodies die: post-KO
replacement, pivots, residual chains, endings. On the same 961 games it parted 6 times and **0** of
those were board-material.

The empirical driver clicks what people actually click. **47.8% of its games reach an ending.** That
opens a population no instrument here has looked at, and 135 of its games hold a board that differs.
**This is a re-baseline, not a regression** — the two cause sets are disjoint, and `arms_comparable.js`
correctly refuses the pair.

**What I want from you.** Read the titles. The verdict is in each title, so you can skip a card whose
title already tells you what it is. The four cards I could not explain are section **H** and they are
where your last pass beat the automation.

**And read the two INSTRUMENT cards first (A1, A2).** The largest single explainable group in this
run is the harness, not the engine.

---

## THE RANKED TABLE

Counts are **board-material games** — the game's board parted, and this is the cause its first
protocol divergence carries.

| | group | games |
|---|---|---|
| **B1** | direct damage value differs | **12** |
| **A1** | INSTRUMENT — the forced-switch mirror asks Showdown to re-switch-in an ACTIVE body | **11** *(and it truncates 42 games)* |
| **B3** | a multi-hit move stops after fewer hits than the authority | **7** |
| **C1** | Parting Shot ignores Follow Me / Rage Powder | **7** |
| **D1** | Innards Out never fires — CONFIRMED, no implementation exists | **6** |
| **D2** | the faint is announced before the hit's consequences | **5** |
| **B2** | the confusion self-hit draws a different roll | **4** |
| **C4** | Sucker Punch does not fail against a status-move target | **4** |
| **E4** | Skill Swap / Wandering Spirit / Mummy | **4** |
| **A2** | a pivot move that FAILED still switches us out | **3** |
| **D3** | an on-KO boost lands after the authority has ended the battle | **3** |
| **E3** | Poison Point / Poison Touch mistimed or absent | **3** |
| **F1** | Encore relocates the encored body's action in our turn order | **3** |
| **G1** | resist-berry / Sitrus timing | **3** |
| **G3** | forme identity and when a forme change is announced | **3** |
| **C2** | Lightning Rod does not redirect | 2 |
| **C5** | Psychic Terrain blocks nothing and spreads nothing | 2 |
| **F2** | an Instruct-repeated Protect fails for us and succeeds for the authority | 2 |
| **F6** | the Infestation / partial-trap counter runs a turn long — IT KILLS A BODY | 2 |
| **F7** | Struggle's `-activate` line is missing | 2 |
| **G2** | Bug Bite's stolen-berry line shape | 2 |
| **B4** | a crit lands on a different body of a spread move | 1 |
| **C3** | Wide Guard does not protect the ally | 1 |
| **C6** | Armor Tail does not block priority | 1 |
| **C7** | Leech Seed's fail condition is not applied | 1 |
| **D4** | Stamina fires once per move, not once per hit | 1 |
| **E1** | Toxic Debris lays its hazard on the WRONG SIDE | 1 |
| **E2** | Sand Spit does not set weather | 1 |
| **E5** | a PARTIAL stat-drop refusal (Hyper Cutter) is not announced | 1 |
| **E6** | Mega Sol is not announced | 1 |
| **E7** | Contrary does not invert an incoming stat drop | 1 |
| **F3** | a re-cast Perish Song does not fail | 1 |
| **F4** | Soundproof does not block Perish Song | 1 |
| **F5** | Substitute break ordering | 1 |
| **G4** | a residual is attributed to the wrong source | 1 |
| **H1–H4** | **CANNOT EXPLAIN** | 4 |

**105 games are in a named group; 6 more are in H; 12 of the 135 parted on the BOARD with no protocol
divergence at all** (Morpeko's forme, `choicelock`, `vol.charging`, the Protect `stall` counter — see
G3, G5 and F1). The remaining ~12 are causes that fell outside the 235-card dump.

---

## A. THE INSTRUMENT — read this before anything else

### A1. The forced-switch mirror asks Showdown to switch in a body that is ALREADY ACTIVE, on boards that AGREE — CONFIRMED, and it is the largest explainable group

`mirrorForcedSwitch` (`engine/game_differential.js:4433`) answers Showdown's replacement request by
looking up medicham2's **current active** body in Showdown's roster under `!isActive && !fainted`. On
a pivot (Parting Shot, U-turn, Flip Turn) Showdown raises that request the instant the move resolves,
**before medicham2 has performed its own pivot**. So the mirror sees the pivoting body still standing,
asks Showdown to switch it in, Showdown refuses because it is active, and the harness stops the game
with *"the boards had already parted"*.

**The boards had not parted.** Card #64, both rosters read out of the dump at the stop:

```
  ours       p2 active: incineroar 110, staraptor 105     bench: (basculegion)
  showdown   p2 active: incineroar 110, staraptor 105     bench: whimsicott 0 fnt, basculegion 195
  stop reason: "p2: slot 1 holds incineroar, which showdown has but cannot switch in (fainted/active)"
  our very next line: |switch|p2a: Basculegion|basculegion, L50|195/195|[from] partingshot
```

Identical boards. **11 of the 135 have this as their first divergence, and 42 of the 961 games end on
it** — so the arm's 47.8% completion figure is a lower bound and 42 games' board comparison is cut
short for a reason that is not the game.

**Every one of the 12 switch-truncations names `[from] partingshot` or `[from] flipturn`.** No other
move produces it.

*HYPOTHESIS, marked as one:* the mirror is being asked at a point in the turn where the two engines
legitimately hold different intermediate states, and it should either be asked later or be taught that
a body Showdown is currently replacing is a body it must answer `pass` for. **I cannot tell from the
artifact whether medicham2's pivot timing is also wrong** — that needs a staged control, which this
pass did not run.

### A2. A pivot move that FAILED still switches us out — CONFIRMED, probed from three cards

Cards #79, #113, #230. All three:

```
  |move|p2a: Grimmsnarl|partingshot|p1a: Metagross
  |-fail|p1a: Metagross|unboost|[from] ability: clearbody|[of] p1a: Metagross
  SHOWDOWN : |move|p2b: Pelipper|Weather Ball|p1a: Metagross      <- the turn carries on, nobody left
  MEDICHAM : |switch|p2a: Archaludon|archaludon, L50|165/165|[from] partingshot
```

Parting Shot's self-switch is conditional on the move succeeding. Clear Body (twice) and Hyper Cutter
(once) refuse both drops, so the authority's move fails and the user stays in. **We switch anyway.**
Board-material by construction: the wrong body is standing.

*This is very likely the same root as A1* — a spurious pivot puts our board into a placement the
mirror cannot express — but they are filed apart because A1 fires on games where the pivot was legal.

---

## B. DICE AND DAMAGE — the largest engine family, and it is not one defect

### B1. Direct damage value differs — 12 games, and MOST ARE OUTSIDE THE ROLL BAND

Twelve `-damage field 3` cards on a normal hit. Two rolls of the **same** base can differ by at most
0.85–1.177×, so a pair outside that ratio band cannot be one base with two rolls — it is a different
BASE, a different stat, or a different multiplier.

**The two I verified by hand, both on a body that had just switched in at full HP so the prior is not
in doubt:**

| move | prior HP | authority dealt | we dealt | ratio |
|---|---|---|---|---|
| **Grass Knot** → Staraptor-Mega | 160/160 | 23 | **11** | **0.478 — we dealt half** |
| **Heavy Slam** → Kingambit | 175/175 | 62 | **42** | **0.677** |

**Both are WEIGHT-BASED base powers.** *HYPOTHESIS:* the weight table or the weight-ratio thresholds
differ. Grass Knot landing at almost exactly half is the sharpest single number in this document.

Across all the direct-damage cards the ratios split roughly half and half — several sit inside the
roll band (Blizzard 1.09, Low Kick 0.95, Beat Up 0.86) and several far outside it (0.48, 0.65, 0.68,
0.74, 1.25, 1.32). **So this row is at least two different bugs and possibly three.**

**Moonblast is the other concentration — 5 of the 12** — and Moonblast carries a 30% SpA-drop
secondary, so those five may be downstream of an earlier secondary landing on one side only rather
than a damage defect at all. See H3. Do not treat this row as one bug.

### B2. The confusion self-hit draws a different roll — STILL OPEN, unchanged since 2026-08-22

Four cards; every gap is 1–5 HP on a 26–35 HP self-hit, i.e. a **different index of the same
sixteen**, not a different multiplier. `medicham2-browser.js:11388` already implements the formula
correctly. This is card **B2** of the 2026-08-22 review, re-observed on a new population.

### B3. A multi-hit move stops after fewer hits than the authority — 7 games

```
  |move|p2b: Tsareena|tripleaxel|p1a: Swampert
  |-damage|p1a: Swampert|166/175
  SHOWDOWN : |-damage|p1a: Swampert|149/175     <- hit 2 lands
  MEDICHAM : |-hitcount|p1a: Swampert|1         <- we stopped at one
```

Every card names **Triple Axel or Population Bomb**, and both are `multiaccuracy` moves — the
authority rolls accuracy **once per hit**. One card is a KO: the authority's fifth Population Bomb hit
takes Maushold to `0 fnt`; we announce `-hitcount 4`.
*HYPOTHESIS:* our per-hit accuracy check draws at a different address, so the hit count diverges. Same
shape as ROADMAP #294 and the 2026-08-22 card **B3**.

### B4. A crit lands on a different body of a spread move — 1 game

Rock Slide: authority crits Absol (p2a), we crit Whimsicott (p2b). Per-target roll family, same as B3.

### B5. The full-paralysis roll differs — 1 game

`|cant|p1a: Whimsicott|par` against our `|move|p1a: Whimsicott|moonblast`. Champions' full-para is
`randomChance(1,8)`. **Also note our line names p1a as its own target on a foe-targeting move** —
the reducer strips the target field so it cannot cause a divergence, but it is worth a glance.

---

## C. REDIRECTION, PROTECTION AND FAIL CONDITIONS — a fact the authority checks and we do not

### C1. Parting Shot ignores Follow Me and Rage Powder — 7 games, the biggest clean engine group

```
  |move|p1b: Maushold|followme|p1b: Maushold
  |-singleturn|p1b: Maushold|move: followme
  |move|p2a: Incineroar|partingshot|p1a: Beedrill
  SHOWDOWN : |-unboost|p1b: Maushold|atk|1      <- the redirector took it
  MEDICHAM : |-unboost|p1a: Beedrill|atk|1      <- we hit the named target
```

Four cards share this exact pair; three more are the same mechanic landing on a Protect or an immunity
instead. **Follow Me and Rage Powder redirect any single-target move, including a status move.**
*HYPOTHESIS:* our redirect check is gated on the move being damaging.

This also reaches the largest end-state leaf family that is not HP or a faint — `active[].boosts.atk`
at 30 games and `party.boosts.atk` at 28. A first-board-divergence card reads exactly like the
diagnosis:
`p1.party.beedrill.boosts.atk m=-2 s=-1 ; p1.party.maushold.boosts.atk m=-1 s=-2` — **the same total
drops, distributed to different bodies.**

### C2. Lightning Rod does not redirect — 2 games

Volt Switch and Electro Shot: the authority announces `-activate ... ability: Lightning Rod` on the
ally; we resolve the move at its named target.

### C3. Wide Guard does not protect the ally — 1 game

Rotom's Discharge hits its own ally Bastiodon, which had Wide Guard up. Authority:
`-activate|p2a: Bastiodon|move: Wide Guard`. We: `-immune|p1a: Garchomp` and the damage lands.

### C4. Sucker Punch does not fail against a status-move target — 4 games

Four cards, four different attackers, same shape: the target used Follow Me or Rage Powder, so the
authority writes `-fail` and we deal damage. **This is Sucker Punch's own `onTry`, not the priority
model.** Redirection worked in all four — the failure is the condition.

### C5. Psychic Terrain blocks nothing and spreads nothing — 2 games

One card: Aqua Jet into a grounded body under Psychic Terrain — the authority emits
`-activate|p2a: Meowstic|move: Psychic Terrain`, we let the priority move through. The other: Expanding
Force hits one body for us and two for the authority.

### C6. Armor Tail does not block priority — 1 game

`|cant|p2b: Farigiraf|ability: Armor Tail|Brave Bird|[of] p1b: Talonflame` on the authority; we deal
the damage. `tags.json` already carries `armortail → blocksMove {what:"priority", priorityAbove:0}`
with **6,279 uses**, so the tag exists and something is not reading it.

### C7. Leech Seed's fail condition is not applied — 1 game

`-fail` on the authority, a normal resolution here. The `onTryImmunity` family of the 2026-08-22 card
**C1**, which is still open.

---

## D. THE FAINT BATCH — the 2026-08-22 A1/A3 finding, re-confirmed on a population that actually kills things

### D1. Innards Out never fires — CONFIRMED BY READING THE ENGINE, 6 games

```
  |move|p2b: Pelipper|hurricane|p1a: Victreebel
  |-damage|p1a: Victreebel|0 fnt
  SHOWDOWN : |-damage|p2b: Pelipper|42/135|[from] ability: Innards Out|[of] p1a: Victreebel
  MEDICHAM : |faint|p1a: Victreebel
```

Not an ordering problem — **the damage never arrives at all.** `innardsout` appears **once** in
`engine/medicham2-browser.js`, at line 6336, in a species→ability map. There is no handler.

And the reason is the 2026-08-22 **C2** shape exactly: `data/tags.json` derives
`innardsout → buffsHolderOnHit {compounds:true, boosts:null, gainsVolatile:null, when:null}` — a tag
with **an empty payload**. It is the only ability in the whole table whose `buffsHolderOnHit` carries
nulls in both slots. The attacker keeps HP it should have lost, in six games, always at the moment a
body dies.

### D2. The faint is announced before the hit's consequences — 5 games

Rough Skin ×2, Cursed Body's Disable, a freeze, and a Life Orb recoil that we replace with a Moxie
boost. `this.add('faint', …)` lives inside `faintMessages()` and runs **after the action completes**
(`sim/battle.ts:2549`, called from `:2832`); we announce at the moment of lethal damage. This is card
**A3** of 2026-08-22 and it is unchanged.

### D3. An on-KO boost lands after the authority has ended the battle — 3 games

```
  SHOWDOWN : (emitted nothing further — the battle is over)
  MEDICHAM : |-boost|p1b: Quaquaval|atk|1|[from] ability: moxie
```

Moxie ×2, Eelevate ×1. Same root as D2: the authority's `faintMessages` ends the battle before the
on-KO hook can run.

### D4. Stamina fires once per move, not once per hit — 1 game

Twin Beam into Archaludon: the authority raises Defense between the hits, we do not. This is the
FREQUENCY half of the 2026-08-22 **A1** finding, still open.

---

## E. ABILITIES THAT FIRE ON THE WRONG SIDE, AT THE WRONG TIME, OR NOT AT ALL

### E1. Toxic Debris lays its hazard on the WRONG SIDE — 1 game, and it is unambiguous

```
  |-activate|p2a: Glimmora|ability: toxicdebris
  SHOWDOWN : |-sidestart|p1: A|move: Toxic Spikes    <- the ATTACKER's side
  MEDICHAM : |-sidestart|p2: |move: toxicspikes      <- our own side
```

Toxic Debris lays Toxic Spikes on the side of the Pokémon that struck it. We lay it on the holder's
own side. The reducer normalises the side-name spelling (2026-08-22 **D**), so this is the *side*
differing, not the wording.

### E2. Sand Spit does not set weather — 1 game

Authority: `-weather|Sandstorm|[from] ability: Sand Spit|[of] p2b: Sandaconda`. We carry on in sun.
Named in CLAUDE.md's 2026-08-08 quarantine paragraph; still true.

### E3. Poison Point / Poison Touch mistimed or absent — 3 games

One card is stark: the target eats a Lum Berry and cures paralysis, then the authority applies Poison
Touch. **We emit `|upkeep`** — no status at all. The other two fire on our side at a point where the
authority is doing something else. *HYPOTHESIS:* the contact-status hook is evaluated before the
target's `Update` event (the berry), so the target still holds a status and the second one is refused.
That is the 2026-08-22 **A4** berry-ordering finding reaching a different mechanic.

### E4. Skill Swap / Wandering Spirit / Mummy — 4 games

Two sub-shapes, filed together because they are one hook:
- **the acquired ability does not run its on-start effect.** Skill Swap hands Intimidate across; the
  authority writes `-unboost|p1b: Wyrdeer|atk|1`, we write nothing.
- **the announcement carries no fields.** Ours: `|-activate|p1a: Cofagrigus|ability: mummy`.
  Authority: `|-activate|p1a: Cofagrigus|ability: Mummy|p2a: Staraptor|[ability] Contrary`. Same for
  Wandering Spirit ×2, where we additionally attribute the line to the other body.

### E5. A PARTIAL stat-drop refusal is not announced — 1 game

Parting Shot into a Hyper Cutter Mawile: the authority refuses the Attack drop
(`-fail|…|unboost|Attack|[from] ability: Hyper Cutter`) and lands the SpA drop. We emit only the SpA
drop. Note **Clear Body we get right** — three other cards show us emitting the `-fail … clearbody`
line correctly. *HYPOTHESIS:* a refusal covering one stat of two has no representation.

### E6. Mega Sol is not announced — 1 game

`-activate|p2b: Meganium|ability: Mega Sol` after a Solar Beam prepare. `tags.json` gives Mega Sol
`privateWeather {actsAsWeather:["sun"], visibleOnField:false}`; the tag is derived, the line is not
emitted. Solar Beam under Mega Sol should skip its charge turn.

### E7. Contrary does not invert an incoming stat drop — 1 game

Staraptor-Mega's ability is **Contrary** and `medicham2-browser.js:6332` maps it. Something lowers its
Attack; the authority writes `-boost|p2a: Staraptor|atk|1` and we write `-unboost`. Joins the standing
"an unwired knob gives identical output" note on Contrary.

---

## F. TURN ORDER, COUNTERS AND FAIL STATES

### F1. Encore relocates the encored body's action in our turn order — CONFIRMED across three cards, and it is a new one

Three cards, three different games, one shape. Card #105, the clearest:

```
  turn 5
  |move|p2a: Garchomp|protect|p2a: Garchomp        (priority +4, first — both agree)
  |move|p2b: Whimsicott|encore|p1a: Dragonite      (Prankster +1)
  |-start|p1a: Dragonite|move: encore
  SHOWDOWN : |move|p1a: Dragonite|Protect          -> SUCCEEDS
  MEDICHAM : |move|p1b: Sableye|encore|p2a: Garchomp
             …then later |move|p1a: Dragonite|protect||[still] -> -fail
```

Dragonite did not *choose* Protect — if it had, priority +4 would have put it ahead of the Encore.
Encore overrode its move mid-turn. **The authority keeps the action where it was; we move it to the
back of the turn.** In all three cards the encored body then acts last and its Protect fails.

**This is also where the `stall` board leaf comes from.** `active[].stall` is 11 games in the
end-state worklist and reads `m=0 s=3`: the authority's Protect succeeded and kept its counter at 3;
ours failed and cleared it. Those 11 games are downstream of this card, not a separate stall defect.

### F2. An Instruct-repeated Protect fails for us and succeeds for the authority — 2 games

```
  |move|p2a: Oranguru|instruct|p1a: Ninetales
  |-singleturn|p1a: Ninetales|move: Instruct|[of] p2a: Oranguru
  |move|p1a: Ninetales|protect||[still]
  SHOWDOWN : |-singleturn|p1a: Ninetales|Protect
  MEDICHAM : |-fail|p1a: Ninetales
```

*HYPOTHESIS, and I flag that it may be downstream of F1:* the second consecutive Protect is a
`randomChance(1,3)` under Showdown's `stall`; a different die address gives a different answer without
either engine being wrong about the rule.

### F3. A re-cast Perish Song does not fail — 1 game

Every eligible body already carries the perish counter, so the authority writes `-fail`; we re-cast
`-fieldactivate|move: Perish Song`.

### F4. Soundproof does not block Perish Song — 1 game

Authority: `-immune|p1b: Kommo-o|[from] ability: Soundproof`. We: `-start|p1b: Kommo-o|perish3`.

### F5. Substitute break ordering — 1 game

Authority emits `-end|p1b: Sinistcha|Substitute` where we continue resolving the second target of a
spread move.

### F6. The Infestation / partial-trap counter runs a turn long — 2 games, AND IT KILLS A BODY

```
  SHOWDOWN : |-end|p1a: Kingambit|Infestation|[partiallytrapped]     <- the trap expires
  MEDICHAM : |-damage|p1a: Kingambit|0 fnt|[from] move: infestation|[partiallytrapped]
```

We take one more tick of Infestation damage after the authority has ended it, and in this card the
extra tick is lethal. This is the 2026-08-22 **E6** question answered: **yes, our counter is a turn
late, and it is board-material rather than cosmetic.**

### F7. Struggle's `-activate` line is missing — 2 games board-material, 5 in total

`|-activate|p2b: Salazzle|move: Struggle` on the authority; we go straight to `|move|…|struggle`.

---

## G. STATE, ITEMS AND IDENTITY

### G1. Resist-berry / Sitrus timing — 3 games

Three shapes, one hook: the authority eats a Roseli Berry **before** applying Fairy damage and we do
not; the authority announces `-supereffective` before we eat a Chople; and one game ends on our side
before the authority's Sitrus is eaten. `onUpdate` fires **after** `|upkeep` and after faint
processing (`sim/battle.ts`). 2026-08-22 card **A4**, still open, now visible on damage-reducing
berries as well as Sitrus.

### G2. Bug Bite's stolen-berry line shape — 2 games

```
  SHOWDOWN : |-enditem|p1a: Farigiraf|Sitrus Berry|[from] stealeat|[move] Bug Bite|[of] p2a: Scizor
  MEDICHAM : |-enditem|p1a: Farigiraf|sitrusberry|[from] move: bugbite|[of] p2a: Scizor
```

The `[from] stealeat` marker and the `[move]` field are missing. **CAUTION:** this is a field
difference on a line the reducer does not normalise; the board parted in both games, but the board's
cause may well be somewhere else in the game. Treat the count as an upper bound.

### G3. Forme identity and when a forme change is announced — 3 games, plus the board-only Morpeko

- Mimikyu: we emit `detailschange|mimikyu-busted` at a different point in the turn (×2).
- Aegislash: the authority's U-turn line reads `|switch|p1a: Aegislash|Aegislash, L50`; ours reads
  `aegislash-blade`.
- Raichu-Mega-Y: `detailschange` ordered against a White Herb.
- **And the single PROTO-SILENT board divergence in the dump:**
  `p2.party.morpeko.species  m="morpekohangry"  s="morpeko"` — a board leaf that differs with **no
  protocol line at all**. ROADMAP #204's three formes with no row in `engine-data.js`.

### G4. A residual is attributed to the wrong source — 1 game

`|-damage|p2a: Pelipper|111/135 brn|[from] brn` on the authority against
`|-damage|p2a: Pelipper|103/135 brn|[from] Leech Seed` here — different source AND different amount.

### G5. `choicelock` DOES appear, and the driver-arm report says it does not — CORRECTION

The empirical-driver report, §4.2, says `choicelock` *"appears in zero of the 225 causes and zero of
the end-state leaf worklist rows"*. **The first half is right and the second half is wrong.**

```
  state.families            active[].vol.choicelock   5 leaves / 5 games
  end_state_families        active[].vol.choicelock   2 games
  a first-board-divergence  p2.active[1].vol.choicelock  m="darkpulse"  s=""
  another                   p2.active[1].vol.choicelock  m="transform"  s=""
```

We hold a choice lock the authority does not, twice, once naming `transform`. **Choice Specs and
Choice Band are banned in this format; Choice Scarf is the only legal source.** Worth a look on its
own.

---

## H. WHAT I CANNOT EXPLAIN — 4 cards, and these are the ones worth your judgement

### H1. Ditto: the two engines offered the body a different set of legal moves

```
  SHOWDOWN : |move|p2b: Ditto|Earthquake|p1b: Garchomp|[spread] p2a
  MEDICHAM : |move|p2b: Ditto|transform|p1b: Garchomp
```

Same slot, same body, same speed (201 vs 201, priority 0 vs 0 — the order probe calls it a tie, which
is misleading: this is not two bodies racing, it is **one body clicking two different things**). The
authority's Ditto has a transformed moveset and clicks Earthquake; ours still has Transform available.
So our Ditto's transform did not stick, or stuck and then reverted. **I could not find the earlier
turn that decides it in the dumped window.** Related to the `choicelock m="transform"` leaf in G5.

### H2. A `-fail` and an `-immune` we cannot place — the game THREW

`|-immune|p2a: Oranguru` on the authority against `|-supereffective|p2b: Sinistcha|1` here, after an
Instruct re-uses Shadow Ball. Oranguru is Normal/Psychic and is not immune to Ghost, so the authority's
`-immune` has a source I cannot identify from the window. **This game is one of the two THREW games**,
so the stream is not trustworthy past this point either.

### H3. Five Moonblast damage cards that may be a damage defect or may be downstream

Five of the twelve B1 cards are Moonblast, and Moonblast carries a 30% SpA-drop secondary. If the
secondary lands in one engine and not the other on an earlier turn, every later Moonblast differs for
a reason that has nothing to do with damage. **I did not separate them**, and the board leaves
(`boosts.spa` at 12–13 games) are consistent with either story.

### H4. Which half of A1 is wrong — the harness or our pivot timing

A1 is confirmed as an instrument STOP on boards that agree. What I cannot say is whether medicham2 also
resolves a pivot switch at the wrong point in the turn, which would make the mirror's question
reasonable and our board the problem. **Answering it needs a staged Parting Shot control with both
engines' turn logs, which this pass did not run.** Given 42 games hang on it, it is the highest-value
single control in this list.

---

## RETRACTIONS — kept visible, because being wrong here is the useful part

### RETRACTED-1. "Eelevate carries a `boostsOnKO` tag it should not have" — WRONG, THE TAG IS RIGHT

I filed this on seeing us emit `|-boost|p2b: Eelektross|atk|1|[from] ability: eelevate` and reading
Champions' `desc`, which describes **only** the Ground immunity. `tags.json` gives eelevate
`boostsOnKO {stat:"highest", stages:1}` where its twin `levitate` carries nothing, and it looked like
exactly the over-matching derived tag this project keeps paying for.

**It is correct.** `data/abilities.ts:1139` gives Eelevate an `onSourceAfterFaint` that boosts the
user's best stat on a KO; Champions inherits it unchanged. `boostsOnKO` has exactly **two** carriers
and both are right. The real defect is D3 — the boost lands after the authority has ended the battle.

**The `desc` was the trap.** Reading the short description instead of the whole block is the documented
way to be wrong here, and it cost a filing.

### RETRACTED-2. "Only three exact speed ties, so check for ties before proposing a fix" — NOT THIS ARM

The 2026-08-22 review found three Protect/Detect rows at `speed_gap: 0, same_priority: true`, where
neither engine is wrong. **This arm has none.** The order probe holds 8 rows; the single row it labels
a tie is H1 (one body, two moves), which is not a tie at all. **No group in this document should be
discounted as an unwinnable tie.**

### RETRACTED-3. The four `protect(+4) vs …(+0)` rows in `order_probe` are NOT a priority defect

The probe reads the priority of the move that was **executed**, not the one that was chosen. All four
are card F1 — Encore overriding the move after the queue was built — so the probe's `priority: 4` is
an artifact of when it looked. I nearly filed "Protect's +4 priority is not applied", which would have
been a very expensive wrong turn on a mechanic that is plainly working in hundreds of other turns.

---

## WHAT THIS PASS DID NOT DO

- **Nothing was fixed, nothing was committed, nothing was pushed.** `docs/ENGINE.md` is untouched and
  `status.js --write` was not run — no probe was written and the census did not move.
- `data/game-differential.json` was not written. Everything went to `data/verification/`.
- **The determinism check the driver-arm report owed is now done and PASSES.** Re-running the identical
  pins reproduced `games`, `diverged`, `end_reasons`, `by_cause_totals`, `verdicts` and
  `games_board_never_diverged` byte-for-byte.
- The 13 diverging games outside the 235-card dump were not read.
