# Tagging pass — first draft for review

Generated from `data/tags.json` by `engine/tag_dex.js`. Nothing hand-listed: every tag is derived
from a dex field or a handler probe, so it stays correct when the format changes.

## The idea

A tag says **what parameter a mechanic sets**, never *"special-case this one"*. So one damage
distribution consumes all of them and there is no per-mechanic branch to get subtly wrong.

| mechanic | sets |
|---|---|
| ordinary move | P(crit) = 1/24 |
| Flower Trick, Storm Throw, Frost Breath | P(crit) = 1 |
| Shell Armor / Battle Armor on the defender | P(crit) = 0 |
| Dual Wingbeat | hits = 2 |
| Bullet Seed | hits ~ {2:35%, 3:35%, 4:15%, 5:15%} |
| any move | P(hit) = accuracy |

Then **P(kill) = P(total damage ≥ remaining HP)** over the whole distribution. Focus Sash falls out
for free — it only saves when the *first* hit is lethal and the rest are not, which is exactly why a
multi-hit move goes straight through it.

## The column that matters

**read?** is whether any feature actually consumes the parameter. It is a grep for the probe string,
so it can be wrong in both directions — treat it as a shortlist to verify, not a verdict. Two false
positives were already found and fixed this way (Sturdy shared the Focus Sash probe).

**23 of 64 tags are currently unread.**

## MOVES

| tag | sets | usage | read? | why it matters |
|---|---|---|---|---|
| `protectBlocked` | Protect stops it | 32.9% | **NO** | the protect family is priced against this, and a move that ignores Protect must not be |
| `multiHit` | hits = n (or a distribution) | 0.6% | **NO** | total damage is n x base, and it BREAKS Focus Sash and Sturdy -- the first hit takes the holder to 1, the rest kill |
| `critRatioUp` | P(crit) raised | 0.1% | **NO** | a higher crit stage, which the damage distribution should weight rather than ignore |
| `forcesSwitch` | the TARGET is removed from the field | 0.1% | **NO** | Whirlwind, Dragon Tail, Roar. Undoes setup and changes who is in front of you |
| `alwaysCrit` | P(crit) = 1 | 0.0% | **NO** | x1.5 and ignores the defender's positive defensive boosts |
| `ohko` | removes the target outright | 0.0% | **NO** | a different kill calculation entirely |
| `fixedDamage` | damage is a constant, not a formula | 0.0% | **NO** | Seismic Toss and Night Shade ignore stats entirely |
| `ignoresAbility` | the defender's ability does not apply | 0.0% | **NO** | Mold Breaker-style moves walk through Levitate and the damage-reducing abilities |
| `priority` | order = priority | 14.7% | yes | who moves first, before speed is consulted at all |
| `contact` | triggers contact punishment on the defender | 14.3% | yes | Rocky Helmet, Rough Skin, Iron Barbs, Static, Flame Body all cost you for touching |
| `stalling` | is a Protect-family move | 8.5% | yes | protectThreatened and deadStall both hang off it |
| `spread` | x0.75 and it also hits my ally | 5.7% | yes | the ally half is what allyHit is for, and the 0.75 is a damage parameter |
| `flinches` | P(flinch) on a faster hit | 4.0% | yes | Fake Out. Blocked by Covert Cloak and by Inner Focus, neither of which is checked |
| `setsScreen` | a side condition | 2.8% | yes | Reflect, Light Screen, Tailwind, Safeguard -- halved damage or doubled speed for five turns |
| `recoil` | costs the user HP | 2.2% | yes | a cost the score does not currently carry |
| `heals` | restores HP | 1.8% | yes | and healing an ALLY is a pair feature that exists in DODUO |
| `variablePower` | basePower is computed, not fixed | 1.8% | yes | Gyro Ball, Low Kick, Grass Knot, Weather Ball, Facade, Acrobatics. A fixed bp reads them wrong in both directions |
| `sound` | bypasses Substitute, blocked by Soundproof | 1.8% | yes | also the trigger for Throat Spray |
| `selfSwitch` | the user leaves after damaging | 1.6% | yes | U-turn, Volt Switch, Flip Turn. Momentum, and the switch features cannot see it |
| `boostsUser` | stat stages on self | 1.1% | yes | the setup family, derived rather than listed |
| `drain` | heals a fraction of damage dealt | 1.1% | yes | changes the value of clicking it into a healthy target |
| `redirects` | takes the turn's single-target attacks | 0.9% | yes | Follow Me and Rage Powder. A pair feature in DODUO and nothing in the single-move vector |
| `powder` | fails into Grass types, Overcoat and Safety Goggles | 0.9% | yes | this is how Rage Powder is beaten, and redirection is scored as if it always works |
| `setsRoom` | a pseudo-weather that reverses or reorders | 0.8% | yes | Trick Room. It set this FOR Will and then lost to it |
| `chargeTurn` | costs a turn before it lands | 0.8% | yes | and the request omits the target field on the locked turn, which already broke the player once |
| `inflictsStatus` | status := x | 0.5% | yes | burn halves physical damage, paralysis halves speed -- both are damage/order parameters |
| `lowersTarget` | stat stages on the foe | 0.4% | yes | Intimidate-shaped effects from a move; also what Clear Amulet and White Herb answer |
| `setsWeather` | weather := x | 0.2% | yes | and whether that weather HELPS is the thing nothing currently asks (task #19) |
| `recharge` | costs the turn AFTER it lands | 0.2% | yes | Hyper Beam. A free turn for the opponent |
| `setsTerrain` | terrain := x | 0.0% | yes | same as weather: redundancy is detected, benefit is not |

## ITEMS

| tag | sets | usage | read? | why it matters |
|---|---|---|---|---|
| `resistBerry` | halves one super-effective hit, then is gone | 9.6% | **NO** | Chople, Colbur, Kasib, Occa. About 6.8% of held items and it turns kills into non-kills |
| `damageMultType` | x1.2 on one type | 8.7% | **NO** | Charcoal, Black Glasses, Mystic Water, Fairy Feather. About 6.7% of held items and a pure calculation error |
| `extendsScreens` | side conditions last 8 turns not 5 | 3.0% | **NO** | 3.1% of items |
| `restoresStats` | undoes stat drops once | 2.0% | **NO** | 2.1% of items, and it changes what a drop is worth |
| `blocksSecondary` | added effects do not apply to the holder | 0.0% | **NO** | Covert Cloak. Fake Out does not flinch through it, and nothing checks |
| `preventsStatDrop` | stat drops do not apply | 0.0% | **NO** | Clear Amulet turns Intimidate into nothing |
| `contactPunish` | hurts anything that makes contact | 0.0% | **NO** | a cost of clicking a contact move that is not currently priced |
| `megaStone` | the holder becomes another species | 27.3% | yes | different stats, typing and ability from turn one |
| `survivesFromFull` | a lethal hit from full HP leaves 1 | 11.4% | yes | Focus Sash, the most-held item in the format. Broken by multi-hit moves and by any prior chip |
| `healsAtHalf` | restores 25% when it drops below half | 10.5% | yes | Sitrus, 10.8% of items. Modelled in the rollout engine only, invisible to MAG |
| `damageMultAll` | x damage on everything | 9.3% | yes | Life Orb 1.3, at a cost this does not model |
| `passiveHeal` | restores HP every turn | 6.4% | yes | changes how many turns a kill takes |
| `choiceLock` | the holder is locked into one move | 5.8% | yes | the single strongest thing an open sheet tells you about what they can do next turn |
| `speedMult` | speed x1.5 | 5.8% | yes | order, which most kill features hang off |
| `blocksPowder` | powder moves fail against the holder | 0.0% | yes | Safety Goggles beats Rage Powder redirection outright |
| `statMult` | raises one stat | 0.0% | yes | Band, Specs, Assault Vest, Eviolite |

## ABILITYS

| tag | sets | usage | read? | why it matters |
|---|---|---|---|---|
| `profitsFromHit` | the target gains something for being hit | 15.0% | **NO** | Stamina, Weak Armour, Berserk, Anger Shell, Justified, Rattled. Task #18 -- Will's Bellibolt case |
| `weatherSetter` | weather := x on switch-in | 9.4% | **NO** | and megaing can COST you it, which is Will's reason to decline a mega |
| `contactPunish` | hurts or afflicts anything making contact | 8.7% | **NO** | Rough Skin, Iron Barbs, Static, Flame Body, Effect Spore |
| `statusImmune` | a status cannot land | 3.2% | **NO** | Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor |
| `survivesFromFull` | a lethal hit from full HP leaves 1 | 0.3% | **NO** | Sturdy. Identical to Focus Sash and NOT modelled anywhere -- verified 0 mentions |
| `preventsCrit` | P(crit) = 0 | 0.2% | **NO** | Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit |
| `terrainSetter` | terrain := x on switch-in | 0.0% | **NO** | same shape as weather |
| `preventsSwitch` | the foe cannot leave | 0.0% | **NO** | Shadow Tag, Arena Trap, Magnet Pull. Already used by the playstyle classifier |
| `damageBoost` | x>1 damage dealt | 14.8% | yes | Adaptability, Technician, Tinted Lens, Sheer Force, Iron Fist, Strong Jaw |
| `onSwitchInDrop` | stat stages on the foe at switch-in | 13.4% | yes | Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked |
| `priorityMod` | order shifts for a class of move | 12.1% | yes | Prankster, Gale Wings, Triage. stallIntoEncore already depends on it |
| `typeImmunity` | damage of one type := 0 | 10.5% | yes | Levitate, Water Absorb, Flash Fire, Sap Sipper. Clicking into one wastes the turn entirely |
| `speedCond` | speed x2 under a condition | 4.0% | yes | Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order |
| `blocksMove` | a whole class of move fails | 3.9% | yes | already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold |
| `redirectsType` | draws that type to itself | 2.6% | yes | Lightning Rod and Storm Drain redirect AND boost |
| `damageReduce` | x<1 damage taken | 1.1% | yes | Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them |
| `formeChange` | the species changes mid-battle | 0.5% | yes | Zero to Hero (needs a switch), Illusion, Imposter, Disguise |
| `invertsBoosts` | stat changes flip sign | 0.3% | yes | Contrary and Simple, already probed for expectedBoostSign |

## Unread, ordered by how often it actually appears

| tag | usage | sets |
|---|---|---|
| `protectBlocked` | 32.9% | Protect stops it |
| `profitsFromHit` | 15.0% | the target gains something for being hit |
| `resistBerry` | 9.6% | halves one super-effective hit, then is gone |
| `weatherSetter` | 9.4% | weather := x on switch-in |
| `damageMultType` | 8.7% | x1.2 on one type |
| `contactPunish` | 8.7% | hurts or afflicts anything making contact |
| `statusImmune` | 3.2% | a status cannot land |
| `extendsScreens` | 3.0% | side conditions last 8 turns not 5 |
| `restoresStats` | 2.0% | undoes stat drops once |
| `multiHit` | 0.6% | hits = n (or a distribution) |
| `survivesFromFull` | 0.3% | a lethal hit from full HP leaves 1 |
| `preventsCrit` | 0.2% | P(crit) = 0 |
| `critRatioUp` | 0.1% | P(crit) raised |
| `forcesSwitch` | 0.1% | the TARGET is removed from the field |
| `alwaysCrit` | 0.0% | P(crit) = 1 |
| `ohko` | 0.0% | removes the target outright |
| `fixedDamage` | 0.0% | damage is a constant, not a formula |
| `terrainSetter` | 0.0% | terrain := x on switch-in |
| `ignoresAbility` | 0.0% | the defender's ability does not apply |
| `blocksSecondary` | 0.0% | added effects do not apply to the holder |
| `preventsStatDrop` | 0.0% | stat drops do not apply |
| `contactPunish` | 0.0% | hurts anything that makes contact |
| `preventsSwitch` | 0.0% | the foe cannot leave |

Usage share is per-slot: for moves it is the share of all move slots on real teams, for items and
abilities the share of all sheet entries. 65,280 entries.