# ABILITIES — tag review

Generated from `data/tags.json` by `engine/tag_dex.js`. Every number is a count over the
**65,976** team-sheet entries in the clean corpus — not an opinion about what matters.

Your moves review is applied and committed; what changed from it is at the end.

---

## The one thing I want you to rule on first

**`profitsFromHit` is doing two different jobs and I think it should be split.**

It covers 32 abilities and 11.2% of sheet entries, and inside it are two mechanics that imply
opposite decisions:

| | what happens | compounds? | what the bot should do |
|---|---|---|---|
| **Holder gets stronger** | Stamina +1 Def, Justified +1 Atk, Electromorphosis gains Charge, Weak Armor +2 Spe | **Yes** — every hit makes the next worse | stop hitting it, or kill it this turn |
| **Attacker gets hurt** | Rough Skin chip, Static / Flame Body / Poison Point status, Gooey −1 Spe, Cursed Body disable | No — a flat toll each time | keep hitting it, just not with contact |

This is your Bellibolt turn exactly. Discharge into Archaludon was resisted **and** handed it a
free Stamina boost — that is the first row. A Rough Skin body would have been the second row and
the right play would have been different.

Rough Skin alone is 3,762 entries and Stamina 1,643, so both halves are common. My proposal is
`buffsHolderOnHit` and `punishesAttacker`, with the few that do both (Weak Armor, Gooey) carrying
both tags. **Say yes or no and I will do it.**

---

## Every ability tag, ordered by how much of the format it covers

`read` means a probe string for it appears in `board.js` or the damage engine. **NOT READ** means
the tag is correct and nothing consumes it yet — a wiring backlog, not an error.

### `profitsFromHit` — 11.2% of entries, 32 abilities — read

**Sets:** the target gains something for being hit  
**Why:** Stamina, Weak Armour, Berserk, Anger Shell, Justified, Rattled. Task #18 -- Will's Bellibolt case

| ability | entries | share |
|---|---:|---:|
| Rough Skin | 3,762 | 5.7% |
| Stamina | 1,643 | 2.5% |
| Cursed Body | 837 | 1.3% |
| Toxic Debris | 417 | 0.6% |
| Static | 278 | 0.4% |
| Flame Body | 114 | 0.2% |
| Illusion | 63 | 0.1% |
| Poison Point | 51 | 0.1% |
| Cute Charm | 48 | 0.1% |
| Electromorphosis | 48 | 0.1% |
| Justified | 29 | 0.0% |
| Wandering Spirit | 21 | 0.0% |
| Effect Spore | 20 | 0.0% |
| Mummy | 16 | 0.0% |
| Gooey | 10 | 0.0% |
| Weak Armor | 9 | 0.0% |
| *…and 1 more below this cut* | | |

### `damageBoost` — 11.1% of entries, 44 abilities — read

**Sets:** x>1 damage dealt  
**Why:** Adaptability, Technician, Tinted Lens, Sheer Force, Iron Fist, Strong Jaw

| ability | entries | share |
|---|---:|---:|
| Blaze | 2,722 | 4.1% |
| Pixilate | 1,448 | 2.2% |
| Torrent | 1,093 | 1.7% |
| Solar Power | 432 | 0.7% |
| Overgrow | 362 | 0.5% |
| Technician | 344 | 0.5% |
| Tough Claws | 272 | 0.4% |
| Sharpness | 155 | 0.2% |
| Sheer Force | 94 | 0.1% |
| Huge Power | 75 | 0.1% |
| Water Bubble | 73 | 0.1% |
| Supreme Overlord | 60 | 0.1% |
| Iron Fist | 55 | 0.1% |
| Swarm | 27 | 0.0% |
| Reckless | 21 | 0.0% |
| Mega Launcher | 20 | 0.0% |
| *…and 10 more below this cut* | | |

### `onSwitchInDrop` — 10.0% of entries, 3 abilities — read

**Sets:** stat stages on the foe at switch-in  
**Why:** Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked

| ability | entries | share |
|---|---:|---:|
| Intimidate | 6,604 | 10.0% |
| Supersweet Syrup | 13 | 0.0% |

### `priorityMod` — 9.0% of entries, 22 abilities — read

**Sets:** order shifts for a class of move  
**Why:** Prankster, Gale Wings, Triage. stallIntoEncore already depends on it

| ability | entries | share |
|---|---:|---:|
| Prankster | 4,692 | 7.1% |
| Gale Wings | 493 | 0.7% |
| Scrappy | 262 | 0.4% |
| Stance Change | 149 | 0.2% |
| Mold Breaker | 130 | 0.2% |
| Sheer Force | 94 | 0.1% |
| Infiltrator | 56 | 0.1% |
| Illuminate | 27 | 0.0% |
| Keen Eye | 27 | 0.0% |
| Stalwart | 27 | 0.0% |
| Skill Link | 4 | 0.0% |
| Long Reach | 2 | 0.0% |

### `weatherSetter` — 7.0% of entries, 8 abilities — read

**Sets:** weather := x on switch-in  
**Why:** and megaing can COST you it, which is Will's reason to decline a mega

| ability | entries | share |
|---|---:|---:|
| Drizzle | 2,213 | 3.4% |
| Snow Warning | 954 | 1.4% |
| Sand Stream | 848 | 1.3% |
| Drought | 621 | 0.9% |

### `preventsStatDrop` — 6.7% of entries, 15 abilities — read

**Sets:** stat drops simply do not apply  
**Why:** Clear Body (2.03%), Flower Veil for the ally. Intimidate and every -1 move do nothing, so lowersTarget is worth zero into them

| ability | entries | share |
|---|---:|---:|
| Flower Veil | 1,465 | 2.2% |
| Clear Body | 1,331 | 2.0% |
| Hyper Cutter | 378 | 0.6% |
| Inner Focus | 377 | 0.6% |
| Oblivious | 277 | 0.4% |
| Scrappy | 262 | 0.4% |
| Mirror Armor | 226 | 0.3% |
| Own Tempo | 44 | 0.1% |
| Illuminate | 27 | 0.0% |
| Keen Eye | 27 | 0.0% |
| Big Pecks | 13 | 0.0% |
| White Smoke | 1 | 0.0% |

### `boostsWhenLowered` — 6.7% of entries, 2 abilities — read

**Sets:** +2 to a stat when any stat is lowered  
**Why:** Defiant (5.46%) and Competitive. The Intimidate punisher -- dropping their Attack HANDS them an attack boost, so the lead interaction inverts

| ability | entries | share |
|---|---:|---:|
| Defiant | 3,610 | 5.5% |
| Competitive | 815 | 1.2% |

### `contactPunish` — 6.5% of entries, 14 abilities — read

**Sets:** the ATTACKER pays for touching it  
**Why:** Rough Skin (3,739), Static, Flame Body, Poison Point, Cute Charm, Effect Spore, Mummy, Gooey. Derived by reading the handler for checkMoveMakesContact

| ability | entries | share |
|---|---:|---:|
| Rough Skin | 3,762 | 5.7% |
| Static | 278 | 0.4% |
| Flame Body | 114 | 0.2% |
| Poison Point | 51 | 0.1% |
| Cute Charm | 48 | 0.1% |
| Wandering Spirit | 21 | 0.0% |
| Effect Spore | 20 | 0.0% |
| Mummy | 16 | 0.0% |
| Gooey | 10 | 0.0% |

### `typeImmunity` — 5.5% of entries, 11 abilities — read

**Sets:** damage of one TYPE := 0  
**Why:** Levitate, Water Absorb, Flash Fire, Sap Sipper. Clicking into one wastes the turn entirely

| ability | entries | share |
|---|---:|---:|
| Levitate | 1,785 | 2.7% |
| Lightning Rod | 1,302 | 2.0% |
| Flash Fire | 357 | 0.5% |
| Dry Skin | 52 | 0.1% |
| Volt Absorb | 33 | 0.1% |
| Earth Eater | 31 | 0.0% |
| Sap Sipper | 22 | 0.0% |
| Water Absorb | 15 | 0.0% |
| Motor Drive | 13 | 0.0% |

### `healsAllyOnSwitchIn` — 5.2% of entries, 1 abilities — read

**Sets:** restores the partner on entry  
**Why:** Hospitality, 5.22% of abilities and the third most common in the format

| ability | entries | share |
|---|---:|---:|
| Hospitality | 3,435 | 5.2% |

### `stabBoost` — 4.3% of entries, 1 abilities — read

**Sets:** STAB becomes x2 instead of x1.5  
**Why:** Adaptability, 4.34% of abilities. A flat 33% damage increase on same-type moves and nothing was reading it

| ability | entries | share |
|---|---:|---:|
| Adaptability | 2,855 | 4.3% |

### `speedCond` — 3.0% of entries, 7 abilities — read

**Sets:** speed x2 under a condition  
**Why:** Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order

| ability | entries | share |
|---|---:|---:|
| Chlorophyll | 1,151 | 1.7% |
| Sand Rush | 495 | 0.8% |
| Swift Swim | 325 | 0.5% |
| Surge Surfer | 8 | 0.0% |
| Slush Rush | 4 | 0.0% |
| Quick Feet | 2 | 0.0% |

### `blocksMove` — 2.9% of entries, 3 abilities — read

**Sets:** a whole class of move fails  
**Why:** already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold

| ability | entries | share |
|---|---:|---:|
| Armor Tail | 1,699 | 2.6% |
| Queenly Majesty | 226 | 0.3% |

### `blocksStatusMoves` — 2.4% of entries, 3 abilities — read

**Sets:** every Status-category move fails against it  
**Why:** Good as Gold, 2.20%. Immune to Will-O-Wisp, Taunt, Encore, Thunder Wave -- the whole 38.5% of move slots that are status

| ability | entries | share |
|---|---:|---:|
| Good as Gold | 1,450 | 2.2% |
| Telepathy | 116 | 0.2% |

### `speedOnItemLoss` — 2.2% of entries, 2 abilities — read

**Sets:** speed x2 once its item is gone  
**Why:** Unburden, 2.23%. A consumed Sash or berry doubles their speed, which flips the order mid-battle and the item tracking now makes observable

| ability | entries | share |
|---|---:|---:|
| Unburden | 1,465 | 2.2% |

### `blocksBerries` — 2.0% of entries, 3 abilities — read

**Sets:** their berries cannot be eaten  
**Why:** Unnerve, 2.03%. Turns off Sitrus (10.8% of items) and every resist berry on the other side

| ability | entries | share |
|---|---:|---:|
| Unnerve | 1,329 | 2.0% |

### `redirectsType` — 2.0% of entries, 2 abilities — read

**Sets:** draws that type to itself  
**Why:** Lightning Rod and Storm Drain redirect AND boost

| ability | entries | share |
|---|---:|---:|
| Lightning Rod | 1,302 | 2.0% |

### `weatherChipImmune` — 1.9% of entries, 8 abilities — read

**Sets:** takes no sandstorm or snow residual damage  
**Why:** What onImmunity actually means for Sand Veil, Snow Cloak, Overcoat and Magic Guard -- and what typeImmunity was wrongly reporting until Will asked

| ability | entries | share |
|---|---:|---:|
| Sand Rush | 495 | 0.8% |
| Oblivious | 277 | 0.4% |
| Snow Cloak | 219 | 0.3% |
| Sand Veil | 135 | 0.2% |
| Overcoat | 90 | 0.1% |
| Magma Armor | 44 | 0.1% |
| Sand Force | 18 | 0.0% |
| Ice Body | 6 | 0.0% |

### `disablesAttacker` — 1.3% of entries, 1 abilities — read

**Sets:** the move I just used is removed from MY options  
**Why:** Cursed Body (833 uses). Not damage and not a stat change -- it shrinks my own option set, the same shape as locksTarget from the receiving end

| ability | entries | share |
|---|---:|---:|
| Cursed Body | 837 | 1.3% |

### `healsOnSwitchOut` — 1.1% of entries, 3 abilities — read

**Sets:** restores a third of max HP by leaving  
**Why:** Regenerator. Makes switching a HEAL, which is the strongest argument for pivoting that the switch features cannot see

| ability | entries | share |
|---|---:|---:|
| Regenerator | 555 | 0.8% |
| Zero to Hero | 115 | 0.2% |
| Natural Cure | 38 | 0.1% |

### `reducesAllyDamage` — 0.9% of entries, 1 abilities — read

**Sets:** my PARTNER takes x0.75  
**Why:** Friend Guard. Changes every damage number aimed at the partner and nothing applies it

| ability | entries | share |
|---|---:|---:|
| Friend Guard | 623 | 0.9% |

### `accuracyMod` — 0.9% of entries, 6 abilities — read

**Sets:** P(hit) scaled, often gated on a weather or a category  
**Why:** Sand Veil (135 uses, x1.25 evasion in sand), Snow Cloak (219, in snow), Compound Eyes, Victory Star, Hustle, Wonder Skin, No Guard. Same P(hit) the kill distribution needs

| ability | entries | share |
|---|---:|---:|
| Snow Cloak | 219 | 0.3% |
| Compound Eyes | 210 | 0.3% |
| Sand Veil | 135 | 0.2% |
| Hustle | 9 | 0.0% |
| Tangled Feet | 2 | 0.0% |

### `damageReduce` — 0.8% of entries, 9 abilities — read

**Sets:** x<1 damage taken  
**Why:** Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them

| ability | entries | share |
|---|---:|---:|
| Multiscale | 353 | 0.5% |
| Solid Rock | 170 | 0.3% |
| Fluffy | 3 | 0.0% |

### `boostsMoveClass` — 0.8% of entries, 6 abilities — read

**Sets:** x1.2-1.5 on moves carrying ONE FLAG  
**Why:** Tough Claws (contact, 272 uses), Sharpness (slicing, 155), Iron Fist (punch), Mega Launcher (pulse), Strong Jaw (bite). The join partner of moveClass -- the ability names the flag, the move carries it, and no per-ability case is needed

| ability | entries | share |
|---|---:|---:|
| Tough Claws | 272 | 0.4% |
| Sharpness | 155 | 0.2% |
| Iron Fist | 55 | 0.1% |
| Mega Launcher | 20 | 0.0% |
| Strong Jaw | 5 | 0.0% |

### `statusImmune` — 0.4% of entries, 12 abilities — read

**Sets:** a status cannot land  
**Why:** Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor. onSetStatus only -- onImmunity also means weather-chip immunity and was over-capturing

| ability | entries | share |
|---|---:|---:|
| Leaf Guard | 75 | 0.1% |
| Water Bubble | 73 | 0.1% |
| Limber | 63 | 0.1% |
| Insomnia | 39 | 0.1% |
| Purifying Salt | 35 | 0.1% |
| Vital Spirit | 3 | 0.0% |
| Immunity | 1 | 0.0% |

### `formeChange` — 0.4% of entries, 7 abilities — read

**Sets:** the species changes mid-battle  
**Why:** Zero to Hero (needs a switch), Illusion, Imposter, Disguise

| ability | entries | share |
|---|---:|---:|
| Zero to Hero | 115 | 0.2% |
| Disguise | 64 | 0.1% |
| Illusion | 63 | 0.1% |
| Imposter | 39 | 0.1% |

### `ignoresStatStages` — 0.3% of entries, 1 abilities — read

**Sets:** the boost multiplier does not apply, permanently  
**Why:** Unaware, 172 uses. Ignores the opponent stat stages in BOTH directions, so their setup is worthless and so is yours. Same parameter Darkest Lariat sets for one move

| ability | entries | share |
|---|---:|---:|
| Unaware | 173 | 0.3% |

### `survivesFromFull` — 0.2% of entries, 1 abilities — read

**Sets:** a lethal hit from full HP leaves 1  
**Why:** Sturdy. Identical to Focus Sash and NOT modelled anywhere -- verified 0 mentions

| ability | entries | share |
|---|---:|---:|
| Sturdy | 154 | 0.2% |

### `invertsBoosts` — 0.2% of entries, 3 abilities — read

**Sets:** stat changes flip sign  
**Why:** Contrary and Simple, already probed for expectedBoostSign

| ability | entries | share |
|---|---:|---:|
| Contrary | 134 | 0.2% |

### `ignoresDefenderAbility` — 0.2% of entries, 3 abilities — read

**Sets:** suppress every defender-side ability tag for this move  
**Why:** Mold Breaker, Turboblaze, Teravolt. Gates typeImmunity, damageReduce, blocksMove, preventsCrit and Sturdy in one flag

| ability | entries | share |
|---|---:|---:|
| Mold Breaker | 130 | 0.2% |

### `preventsCrit` — 0.1% of entries, 4 abilities — read

**Sets:** P(crit) = 0  
**Why:** Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit

| ability | entries | share |
|---|---:|---:|
| Disguise | 64 | 0.1% |
| Shell Armor | 25 | 0.0% |

### `critDamageUp` — 0.0% of entries, 1 abilities — read

**Sets:** the CRIT MULTIPLIER itself, not its probability  
**Why:** Sniper (Will raised it). Three separate crit parameters exist and the taxonomy had only two: probability (Scope Lens, Flower Trick), prevention (Shell Armor) and now the multiplier. Crit damage is x1.5 and Sniper makes it x1.5 again, so x2.25 total -- it was x3 in the old gens when crits themselves were x2, which is where the folklore comes from

| ability | entries | share |
|---|---:|---:|
| Sniper | 24 | 0.0% |

### `critRatioUp` — 0.0% of entries, 2 abilities — read

**Sets:** P(crit) raised  
**Why:** Super Luck and Merciless. Same parameter as Scope Lens and Flower Trick

| ability | entries | share |
|---|---:|---:|
| Merciless | 3 | 0.0% |
| Super Luck | 3 | 0.0% |

### `terrainSetter` — 0.0% of entries, 5 abilities — read

**Sets:** terrain := x on switch-in  
**Why:** same shape as weather

| ability | entries | share |
|---|---:|---:|
| Psychic Surge | 1 | 0.0% |

### `preventsSwitch` — 0.0% of entries, 3 abilities — read

**Sets:** the foe cannot leave  
**Why:** Shadow Tag, Arena Trap, Magnet Pull. Already used by the playstyle classifier

*No ability with this tag appears on a single sheet in the corpus — legal, but never brought.*

---

## What your moves review changed

Six things, all cases where the engine could not see a mechanic at all.

**1. Clanging Scales — you were right to be suspicious.** There are *three* separate dex fields
carrying self stat changes and my probes read two. `self.boosts` (Close Combat) and
`secondaries[].self.boosts` (Ancient Power) were covered; `selfBoost.boosts` was not, and that is
where Clanging Scales keeps its Defense drop. A 110 BP spread move with an invisible drawback.
Now tagged `lowersUser`.

**2. HP-gated moves.** Substitute (247 uses) costs 1/4, Clangorous Soul (190) costs 1/3, Shed Tail
(41) costs 1/2 — and all three *fail outright* below that. Neither the cost nor the failure was
modelled. The failure also inherits the simultaneity problem: you can have the HP when you choose
and not when you act, because their attack resolves first.

**3. Per-hit accuracy.** Triple Axel rolls each hit separately, so it lands all three **73%** of
the time, not 90%. Population Bomb lands all ten **35%** of the time. Dual Wingbeat and Bullet Seed
roll once for the whole move. Applying accuracy once overstated the multi-accuracy ones.

**4. Moves that read the target’s item.** Knock Off is ×1.5 into an item (1,663 uses) and
Poltergeist fails without one (183). On your mega-stone question — **stones do not dodge
Poltergeist.** A stone is an item and the move reads `target.item`. What stones resist is
*removal*: Knock Off and Trick fail to take them, and only from the matching species. Poltergeist
is near-unconditional here anyway — **106 of 65,976** sheet entries hold no item.

**5. Fixed-damage moves, and this is the worst one.** Super Fang, Final Gambit, Endeavor, the OHKO
moves and Night Shade all have base power **0** and compute damage in a callback. The engine did
not misprice them — it read them as dealing **nothing at all**. 764 uses across the corpus. Super
Fang halves your HP and the bot thought it was harmless.

**6. Your placeholder rule is in.** Anything untagged now carries an explicit `untagged` marker
instead of an empty list, and is only *flagged* if it appears on more than 0.5% of sheets. Watchog
never crosses that line; a genuinely missed common move would. Right now **every move, ability and
item above the floor carries at least one tag.**

**Icicle Crash flinch is 30%** — you asked and I owed you the number directly.

---

## Where this actually stands

**7 of 139 tags are read by nothing yet.** The taxonomy is ahead of the consumer,
deliberately — you are reviewing it before I wire it. But that gap *is* the risk: this repository
has a history of models that were fitted, saved, quoted and never once used in a live decision. A
tag that nothing reads is that same failure in a new shape.

So when you sign this off, the next work is not more tags. It is `tags.json` feeding the damage
distribution in MAGNEMITE, and `tests/test-wiring.js` proving each one ran in a real game.