# Role Atlas — every move and ability, and what it is tagged as

**ABRA · generated from `engine/roles.py` · 2026-07-24**

Generated directly from the tagger, so it cannot drift. `uses` = real in-battle uses for moves, revealed sets for abilities. Blank role = deliberately untagged (ordinary damage, a passive modifier, or a gap worth filling).

Roles in the taxonomy: **52**. Moves listed: **539**. Abilities listed: **113**.


## Roles in the taxonomy

| key | label |
|---|---|
| `speed_tailwind` | Tailwind (speed up) |
| `speed_trickroom` | Trick Room setter |
| `speed_lower` | Speed control (lower foe) |
| `weather_rain` | Rain setter |
| `weather_sun` | Sun setter |
| `weather_sand` | Sand setter |
| `weather_snow` | Snow setter |
| `terrain_psychic` | Psychic Terrain setter |
| `terrain_grassy` | Grassy Terrain setter |
| `terrain_electric` | Electric Terrain setter |
| `terrain_misty` | Misty Terrain setter |
| `abuser_psychic` | Psychic Terrain abuser |
| `abuser_grassy` | Grassy Terrain abuser |
| `abuser_electric` | Electric Terrain abuser |
| `abuser_misty` | Misty Terrain abuser |
| `fakeout` | Fake Out (tempo) |
| `redirection` | Redirection |
| `denial` | Weather / effect denial |
| `abuser_rain` | Rain abuser (needs rain) |
| `abuser_sun` | Sun abuser (needs sun) |
| `abuser_sand` | Sand abuser (needs sand) |
| `abuser_snow` | Snow abuser (needs snow) |
| `taunt` | Taunt |
| `encore` | Move-lock (Encore / Disable) |
| `priority` | Priority attacker |
| `prankster` | Prankster (priority support) |
| `status_burn` | Burn spreader |
| `status_para` | Paralysis spreader |
| `status_sleep` | Sleep spreader (action denial) |
| `status_poison` | Poison spreader |
| `status` | Status spreader (other) |
| `debuff` | Debuff (Intimidate / drops) |
| `setup` | Setup / sweeper |
| `healing` | Healing / sustain |
| `screens` | Screen setter |
| `teamprotect` | Wide / Quick Guard |
| `helpinghand` | Helping Hand |
| `pivot` | Pivot |
| `wall` | Bulky wall / support |
| `trapping` | Trapper |
| `spread` | Spread attacker (both foes) |
| `spread_self` | Field-wide (hits own partner) |
| `substitute` | Substitute user |
| `chip` | Residual / chip damage |
| `multihit` | Multi-hit (breaks Sash / Sturdy) |
| `fixed_damage` | Fixed / fractional damage |
| `hazards` | Hazard setter |
| `perish` | Perish Trap |
| `allysupport` | Positioning / ally support |
| `itemdisrupt` | Item disruption |
| `phys_attacker` | Physical attacker |
| `spec_attacker` | Special attacker |

## Multi-role moves (override table — authoritative)

These do several jobs at once; the table is factual, not weighted.

| move | roles |
|---|---|
| **Bind** | Residual / chip damage, Trapper |
| **Body Press** | Physical attacker, Bulky wall / support |
| **Brick Break** | Weather / effect denial, Physical attacker |
| **Charge Beam** | Setup / sweeper, Special attacker |
| **Discharge** | Special attacker, Paralysis spreader |
| **Draining Kiss** | Healing / sustain, Special attacker |
| **Fake Out** | Fake Out (tempo) |
| **Fiery Dance** | Setup / sweeper, Special attacker |
| **Fire Spin** | Residual / chip damage, Trapper |
| **Flip Turn** | Physical attacker, Pivot |
| **Infestation** | Residual / chip damage, Trapper |
| **Knock Off** | Item disruption, Physical attacker |
| **Leech Seed** | Residual / chip damage, Healing / sustain |
| **Matcha Gotcha** | Healing / sustain, Special attacker, Burn spreader |
| **Meteor Mash** | Physical attacker, Setup / sweeper |
| **Nuzzle** | Paralysis spreader |
| **Parting Shot** | Debuff (Intimidate / drops), Pivot |
| **Pollen Puff** | Healing / sustain, Special attacker |
| **Psychic Fangs** | Weather / effect denial, Physical attacker |
| **Sand Tomb** | Residual / chip damage, Trapper |
| **Scale Shot** | Multi-hit (breaks Sash / Sturdy), Physical attacker, Setup / sweeper |
| **Shed Tail** | Positioning / ally support, Pivot, Substitute user |
| **Stockpile** | Setup / sweeper |
| **Torch Song** | Setup / sweeper, Special attacker |
| **U-turn** | Physical attacker, Pivot |
| **Volt Switch** | Pivot, Special attacker |
| **Whirlpool** | Residual / chip damage, Trapper |
| **Wrap** | Residual / chip damage, Trapper |

## Every ability

| uses | ability | tagged as |
|---|---|---|
| 3883 | Intimidate | Debuff (Intimidate / drops) |
| 3009 | Drought | Sun setter |
| 1712 | Drizzle | Rain setter |
| 1320 | Stamina | Bulky wall / support |
| 1152 | Sand Stream | Sand setter |
| 801 | Fairy Aura | — |
| 724 | Snow Warning | Snow setter |
| 619 | Unnerve | — |
| 362 | Speed Boost | Setup / sweeper |
| 356 | Defiant | Setup / sweeper |
| 221 | Mold Breaker | — |
| 191 | Cloud Nine | Weather / effect denial |
| 140 | Electric Surge | Electric Terrain setter |
| 130 | Competitive | Setup / sweeper |
| 119 | Lightning Rod | Redirection |
| 81 | Eelevate | — |
| 80 | Pressure | — |
| 62 | Simple | Setup / sweeper |
| 44 | No Guard | — |
| 35 | Moody | Setup / sweeper |
| 33 | Berserk | Setup / sweeper |
| 28 | Mirror Armor | Weather / effect denial |
| 25 | Moxie | Setup / sweeper |
| 21 | Insomnia | — |
| 18 | Justified | Setup / sweeper |
| 16 | Pixilate | — |
| 13 | Sturdy | — |
| 12 | Supersweet Syrup | Setup / sweeper |
| 11 | Blaze | — |
| 11 | Rough Skin | — |
| 9 | Unseen Fist | — |
| 8 | Adaptability | — |
| 7 | Weak Armor | Setup / sweeper |
| 6 | Good as Gold | Weather / effect denial |
| 6 | Hospitality | Healing / sustain |
| 6 | Sap Sipper | Healing / sustain |
| 6 | Water Absorb | Healing / sustain |
| 5 | Prankster | Prankster (priority support) |
| 4 | Chlorophyll | Sun abuser (needs sun) |
| 3 | Gooey | — |
| 3 | Sand Spit | Sand setter |
| 3 | Solar Power | Sun abuser (needs sun) |
| 2 | Fire Mane | — |
| 2 | Opportunist | — |
| 2 | Piercing Drill | — |
| 2 | Plus | — |
| 2 | Sand Rush | Sand abuser (needs sand) |
| 2 | Thick Fat | Bulky wall / support |
| 2 | Water Bubble | — |
| 1 | Damp | — |
| 1 | Earth Eater | Healing / sustain |
| 1 | Flame Body | — |
| 1 | Flash Fire | — |
| 1 | Friend Guard | — |
| 1 | Frisk | — |
| 1 | Gale Wings | Prankster (priority support) |
| 1 | Illuminate | — |
| 1 | Infiltrator | — |
| 1 | Levitate | — |
| 1 | Mega Sol | — |
| 1 | Motor Drive | — |
| 1 | Multiscale | Bulky wall / support |
| 1 | Natural Cure | — |
| 1 | Protean | — |
| 1 | Queenly Majesty | — |
| 1 | Rain Dish | Rain abuser (needs rain), Healing / sustain |
| 1 | Refrigerate | — |
| 1 | Regenerator | Healing / sustain, Bulky wall / support |
| 1 | Rock Head | — |
| 1 | Snow Cloak | Snow abuser (needs snow) |
| 1 | Supreme Overlord | — |
| 1 | Swift Swim | Rain abuser (needs rain) |
| 1 | Tough Claws | — |
| 1 | Toxic Debris | Hazard setter |
| 1 | Unburden | — |
| 0 | Air Lock | Weather / effect denial |
| 0 | Arena Trap | Trapper |
| 0 | Beast Boost | Setup / sweeper |
| 0 | Chilling Neigh | Setup / sweeper |
| 0 | Clear Body | Weather / effect denial |
| 0 | Desolate Land | Sun setter |
| 0 | Dry Skin | Rain abuser (needs rain), Healing / sustain |
| 0 | Flower Gift | Sun abuser (needs sun) |
| 0 | Fluffy | Bulky wall / support |
| 0 | Full Metal Body | Weather / effect denial |
| 0 | Fur Coat | Bulky wall / support |
| 0 | Grass Pelt | Grassy Terrain abuser |
| 0 | Grassy Surge | Grassy Terrain setter |
| 0 | Grim Neigh | Setup / sweeper |
| 0 | Hadron Engine | Electric Terrain setter |
| 0 | Harvest | Sun abuser (needs sun) |
| 0 | Hydration | Rain abuser (needs rain) |
| 0 | Ice Body | Snow abuser (needs snow), Healing / sustain |
| 0 | Ice Face | Bulky wall / support |
| 0 | Leaf Guard | Sun abuser (needs sun) |
| 0 | Magic Bounce | Weather / effect denial |
| 0 | Magnet Pull | Trapper |
| 0 | Misty Surge | Misty Terrain setter |
| 0 | Neutralizing Gas | Weather / effect denial |
| 0 | Orichalcum Pulse | Sun setter |
| 0 | Poison Heal | Healing / sustain |
| 0 | Primordial Sea | Rain setter |
| 0 | Protosynthesis | Sun abuser (needs sun) |
| 0 | Psychic Surge | Psychic Terrain setter |
| 0 | Quark Drive | Electric Terrain abuser |
| 0 | Sand Force | Sand abuser (needs sand) |
| 0 | Sand Veil | Sand abuser (needs sand) |
| 0 | Shadow Tag | Trapper |
| 0 | Slush Rush | Snow abuser (needs snow) |
| 0 | Storm Drain | Redirection |
| 0 | Surge Surfer | Electric Terrain abuser |
| 0 | Volt Absorb | Healing / sustain |
| 0 | White Smoke | Weather / effect denial |

## Every move

| uses | move | tagged as |
|---|---|---|
| 15363 | Protect | _(neutral — everyone runs it)_ |
| 5452 | Heat Wave | Special attacker, Spread attacker (both foes) |
| 4124 | Rock Slide | Physical attacker, Spread attacker (both foes) |
| 3716 | Fake Out | Fake Out (tempo) |
| 3701 | Tailwind | Tailwind (speed up) |
| 3605 | Hyper Voice | Special attacker, Spread attacker (both foes) |
| 3505 | Last Respects | Physical attacker |
| 3094 | Moonblast | Special attacker |
| 2703 | Earthquake | Physical attacker, Field-wide (hits own partner) |
| 2668 | Wave Crash | Physical attacker |
| 2602 | Close Combat | Physical attacker |
| 2350 | Weather Ball | Special attacker |
| 2070 | Electro Shot | Special attacker |
| 2032 | Sucker Punch | Physical attacker, Priority attacker |
| 1905 | Flare Blitz | Physical attacker |
| 1845 | Matcha Gotcha | Healing / sustain, Special attacker, Burn spreader |
| 1825 | Shadow Ball | Special attacker |
| 1734 | Hurricane | Special attacker |
| 1604 | Dragon Pulse | Special attacker |
| 1575 | Trick Room | Trick Room setter |
| 1545 | Psychic | Special attacker |
| 1428 | Parting Shot | Debuff (Intimidate / drops), Pivot |
| 1414 | Stomping Tantrum | Physical attacker |
| 1403 | Kowtow Cleave | Physical attacker |
| 1392 | Iron Head | Physical attacker |
| 1357 | Dragon Claw | Physical attacker |
| 1259 | Sludge Bomb | Special attacker, Poison spreader |
| 1254 | Earth Power | Special attacker |
| 1252 | Knock Off | Item disruption, Physical attacker |
| 1245 | Encore | Move-lock (Encore / Disable) |
| 1222 | Rage Powder | Redirection, Bulky wall / support |
| 1190 | Flash Cannon | Special attacker |
| 1187 | Dazzling Gleam | Special attacker, Spread attacker (both foes) |
| 1161 | Thunderbolt | Special attacker |
| 1145 | Eruption | Special attacker, Spread attacker (both foes) |
| 1075 | Make It Rain | Special attacker, Spread attacker (both foes) |
| 963 | Aqua Jet | Physical attacker, Priority attacker |
| 931 | Wide Guard | Wide / Quick Guard, Bulky wall / support |
| 906 | Dual Wingbeat | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 843 | Helping Hand | Positioning / ally support, Helping Hand, Bulky wall / support |
| 836 | Blizzard | Special attacker, Spread attacker (both foes) |
| 817 | Brave Bird | Physical attacker |
| 813 | Light Screen | Screen setter, Bulky wall / support |
| 798 | High Horsepower | Physical attacker |
| 755 | Dire Claw | Physical attacker, Poison spreader |
| 727 | Solar Beam | Special attacker |
| 705 | Throat Chop | Physical attacker |
| 704 | Sleep Powder | Sleep spreader (action denial) |
| 674 | Spirit Break | Debuff (Intimidate / drops), Physical attacker |
| 636 | Life Dew | Healing / sustain, Bulky wall / support |
| 620 | Infestation | Residual / chip damage, Trapper |
| 617 | Flip Turn | Physical attacker, Pivot |
| 606 | Will-O-Wisp | Burn spreader |
| 599 | Hyper Beam | Special attacker |
| 573 | Scald | Special attacker, Burn spreader |
| 572 | Ice Punch | Physical attacker |
| 571 | Zap Cannon | Paralysis spreader |
| 570 | Hydro Pump | Special attacker |
| 568 | Dark Pulse | Special attacker |
| 564 | Giga Drain | Healing / sustain, Special attacker |
| 558 | Reflect | Screen setter, Bulky wall / support |
| 533 | Darkest Lariat | Physical attacker |
| 526 | Baneful Bunker | Poison spreader |
| 514 | Quick Attack | Physical attacker, Priority attacker |
| 498 | Drain Punch | Healing / sustain, Physical attacker |
| 485 | Toxic | Poison spreader |
| 477 | Foul Play | Physical attacker |
| 476 | Water Spout | Special attacker, Spread attacker (both foes) |
| 466 | Follow Me | Redirection, Bulky wall / support |
| 458 | Icy Wind | Speed control (lower foe), Spread attacker (both foes) |
| 446 | Muddy Water | Special attacker, Spread attacker (both foes) |
| 441 | Draco Meteor | Special attacker |
| 438 | Calm Mind | Setup / sweeper |
| 436 | Body Press | Physical attacker, Bulky wall / support |
| 423 | Poison Jab | Physical attacker, Poison spreader |
| 408 | Play Rough | Physical attacker |
| 393 | Nasty Plot | Setup / sweeper |
| 393 | Power Gem | Special attacker |
| 386 | Detect | _(neutral — everyone runs it)_ |
| 379 | Swords Dance | Setup / sweeper |
| 363 | Super Fang | Fixed / fractional damage |
| 362 | Discharge | Special attacker, Paralysis spreader |
| 349 | Rock Blast | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 348 | Psychic Fangs | Weather / effect denial, Physical attacker |
| 338 | Volt Switch | Pivot, Special attacker |
| 334 | Ice Beam | Special attacker |
| 320 | Light of Ruin | Special attacker |
| 311 | Liquidation | Physical attacker |
| 309 | Bullet Punch | Physical attacker, Priority attacker |
| 308 | Expanding Force | Psychic Terrain abuser, Spread attacker (both foes) |
| 296 | Shadow Sneak | Physical attacker, Priority attacker |
| 292 | Focus Blast | Special attacker |
| 290 | Taunt | Taunt |
| 275 | Bulk Up | Setup / sweeper |
| 259 | Extreme Speed | Physical attacker, Priority attacker |
| 253 | Snarl | Debuff (Intimidate / drops), Special attacker, Spread attacker (both foes) |
| 251 | Perish Song | Perish Trap |
| 249 | Rage Fist | Physical attacker |
| 248 | Roost | Healing / sustain |
| 246 | Low Kick | Physical attacker |
| 246 | Population Bomb | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 243 | Energy Ball | Special attacker |
| 243 | Rain Dance | Rain setter |
| 239 | Charm | Debuff (Intimidate / drops) |
| 236 | Hypnosis | Sleep spreader (action denial) |
| 234 | Bitter Blade | Physical attacker |
| 232 | Freeze-Dry | Special attacker |
| 225 | Overheat | Special attacker |
| 225 | Rock Tomb | Speed control (lower foe) |
| 224 | Flamethrower | Special attacker |
| 223 | Last Resort | Physical attacker |
| 222 | Superpower | Physical attacker |
| 208 | Aura Sphere | Special attacker |
| 207 | Yawn | Sleep spreader (action denial) |
| 205 | Disable | Move-lock (Encore / Disable) |
| 205 | Draining Kiss | Healing / sustain, Special attacker |
| 204 | Leaf Storm | Special attacker |
| 202 | Triple Axel | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 201 | Thunder | Special attacker, Paralysis spreader |
| 195 | Aurora Veil | Screen setter, Bulky wall / support |
| 194 | Psyshock | Special attacker |
| 190 | Dragon Dance | Setup / sweeper |
| 187 | Coil | Setup / sweeper |
| 185 | Twin Beam | Multi-hit (breaks Sash / Sturdy), Special attacker |
| 181 | Crunch | Physical attacker |
| 180 | Phantom Force | Physical attacker |
| 175 | U-turn | Physical attacker, Pivot |
| 171 | Spiky Shield | _(neutral — everyone runs it)_ |
| 169 | Air Slash | Special attacker |
| 168 | Waterfall | Physical attacker |
| 167 | Stockpile | Setup / sweeper |
| 166 | Instruct | Positioning / ally support |
| 166 | Minimize | — |
| 163 | Electroweb | Speed control (lower foe), Spread attacker (both foes) |
| 162 | Leech Seed | Residual / chip damage, Healing / sustain |
| 159 | Ice Shard | Physical attacker, Priority attacker |
| 148 | Skill Swap | — |
| 144 | Sacred Sword | Physical attacker |
| 141 | Coaching | Positioning / ally support |
| 139 | Poltergeist | Physical attacker |
| 135 | Shell Smash | Setup / sweeper |
| 132 | Fake Tears | Debuff (Intimidate / drops) |
| 132 | Recover | Healing / sustain |
| 131 | Iron Defense | Setup / sweeper |
| 130 | Psycho Cut | Physical attacker |
| 128 | Psychic Terrain | Psychic Terrain setter |
| 128 | Sunny Day | Sun setter |
| 116 | Double-Edge | Physical attacker |
| 113 | Volt Tackle | Physical attacker |
| 112 | Ally Switch | Positioning / ally support |
| 111 | Heavy Slam | Physical attacker |
| 109 | Barb Barrage | — |
| 102 | Ancient Power | Special attacker |
| 102 | Rising Voltage | Electric Terrain abuser, Special attacker |
| 97 | Thunder Wave | Paralysis spreader |
| 95 | Leaf Blade | Physical attacker |
| 95 | Surf | Field-wide (hits own partner) |
| 89 | Brick Break | Weather / effect denial, Physical attacker |
| 88 | Quick Guard | Wide / Quick Guard, Bulky wall / support |
| 88 | Stored Power | Special attacker |
| 87 | Acrobatics | Physical attacker |
| 87 | Feint | Physical attacker |
| 85 | Final Gambit | Fixed / fractional damage |
| 80 | Water Pulse | Special attacker |
| 79 | Trop Kick | Physical attacker |
| 78 | Grass Knot | Special attacker |
| 77 | Round | Special attacker |
| 76 | Meteor Mash | Physical attacker, Setup / sweeper |
| 75 | Baton Pass | Pivot |
| 75 | Clanging Scales | Special attacker |
| 75 | Flower Trick | Physical attacker |
| 74 | Gunk Shot | Physical attacker, Poison spreader |
| 74 | Simple Beam | — |
| 73 | Stone Edge | Physical attacker |
| 70 | Psychic Noise | Special attacker |
| 70 | Triple Arrows | — |
| 68 | Parabolic Charge | Healing / sustain, Special attacker, Field-wide (hits own partner) |
| 67 | Mystical Fire | Special attacker |
| 67 | Salt Cure | Residual / chip damage |
| 67 | Soak | — |
| 66 | Gigaton Hammer | Physical attacker |
| 63 | Body Slam | Physical attacker, Paralysis spreader |
| 63 | King's Shield | Debuff (Intimidate / drops) |
| 63 | Scale Shot | Multi-hit (breaks Sash / Sturdy), Physical attacker, Setup / sweeper |
| 62 | Psych Up | — |
| 62 | Stone Axe | Hazard setter |
| 62 | Substitute | _(neutral — everyone runs it)_ |
| 61 | Hex | Special attacker |
| 61 | Lumina Crash | — |
| 61 | Sludge Wave | Special attacker, Field-wide (hits own partner) |
| 60 | Bug Bite | — |
| 60 | Head Smash | Physical attacker |
| 59 | Cosmic Power | — |
| 58 | Beat Up | — |
| 58 | Power Whip | Physical attacker |
| 58 | Quash | Positioning / ally support |
| 58 | Thunder Punch | Physical attacker |
| 57 | Fissure | — |
| 57 | Ice Fang | — |
| 57 | Struggle | — |
| 56 | Icicle Crash | Physical attacker |
| 56 | Quiver Dance | Setup / sweeper |
| 55 | Gravity | — |
| 55 | High Jump Kick | — |
| 55 | Jet Punch | Physical attacker, Priority attacker |
| 55 | Trick | Item disruption |
| 54 | Dragon Darts | Multi-hit (breaks Sash / Sturdy) |
| 53 | After You | Positioning / ally support |
| 53 | Roar | Positioning / ally support |
| 52 | Sheer Cold | — |
| 51 | Destiny Bond | — |
| 50 | Accelerock | Physical attacker, Priority attacker |
| 50 | Strength Sap | Healing / sustain |
| 50 | Torch Song | Setup / sweeper, Special attacker |
| 49 | Breaking Swipe | Spread attacker (both foes) |
| 49 | Zen Headbutt | Physical attacker |
| 48 | Headlong Rush | Physical attacker |
| 47 | Curse | Residual / chip damage, Setup / sweeper |
| 47 | Outrage | Physical attacker |
| 46 | Belly Drum | Setup / sweeper |
| 45 | Endeavor | Fixed / fractional damage |
| 45 | Shadow Claw | Physical attacker |
| 44 | Fire Spin | Residual / chip damage, Trapper |
| 43 | Decorate | Positioning / ally support |
| 43 | Heal Pulse | Positioning / ally support, Healing / sustain |
| 43 | Shed Tail | Positioning / ally support, Pivot, Substitute user |
| 43 | Solar Blade | — |
| 42 | Imprison | Move-lock (Encore / Disable) |
| 42 | Night Slash | Physical attacker |
| 42 | Swagger | Status spreader (other) |
| 41 | Entrainment | — |
| 36 | Boomburst | Special attacker, Field-wide (hits own partner) |
| 36 | Haze | Weather / effect denial |
| 36 | Vacuum Wave | Priority attacker |
| 35 | Armor Cannon | — |
| 35 | Ceaseless Edge | Hazard setter, Physical attacker |
| 34 | Alluring Voice | Special attacker |
| 34 | Hammer Arm | Physical attacker |
| 34 | Mach Punch | Physical attacker, Priority attacker |
| 34 | Raging Bull | — |
| 33 | Leech Life | Healing / sustain, Physical attacker |
| 32 | No Retreat | Setup / sweeper |
| 31 | Chilling Water | — |
| 31 | Role Play | — |
| 31 | Stealth Rock | Hazard setter |
| 31 | Tickle | Debuff (Intimidate / drops) |
| 30 | Fiery Dance | Setup / sweeper, Special attacker |
| 30 | Ice Hammer | — |
| 30 | Lash Out | — |
| 30 | Slack Off | Healing / sustain |
| 29 | Bitter Malice | — |
| 29 | Ice Spinner | — |
| 28 | Dragon Cheer | — |
| 27 | Blaze Kick | — |
| 27 | Drill Run | — |
| 27 | Wish | Healing / sustain, Bulky wall / support |
| 26 | Bug Buzz | Special attacker |
| 25 | Burn Up | — |
| 25 | Clangorous Soul | Setup / sweeper |
| 25 | Scary Face | Speed control (lower foe) |
| 25 | Shell Side Arm | — |
| 24 | Frost Breath | Special attacker |
| 24 | Nuzzle | Paralysis spreader |
| 23 | Horn Drill | — |
| 23 | Trailblaze | — |
| 23 | Venoshock | Special attacker |
| 23 | Worry Seed | — |
| 23 | X-Scissor | Physical attacker |
| 22 | Aura Wheel | — |
| 22 | Chilly Reception | Pivot, Snow setter |
| 22 | Wood Hammer | Physical attacker |
| 21 | Aqua Cutter | — |
| 21 | Flame Charge | — |
| 21 | Synthesis | Healing / sustain |
| 20 | Facade | Physical attacker |
| 20 | Fire Blast | Special attacker |
| 20 | Glare | Paralysis spreader |
| 20 | Moonlight | Healing / sustain, Special attacker |
| 20 | Wild Charge | Physical attacker |
| 19 | Explosion | Field-wide (hits own partner) |
| 19 | Fire Punch | Physical attacker |
| 19 | Icicle Spear | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 19 | Pollen Puff | Healing / sustain, Special attacker |
| 19 | Screech | Debuff (Intimidate / drops) |
| 19 | Upper Hand | — |
| 18 | Dragon Rush | Physical attacker |
| 18 | Heat Crash | — |
| 18 | Power Trip | — |
| 18 | Psyshield Bash | — |
| 18 | Scorching Sands | Burn spreader |
| 18 | Seed Bomb | Physical attacker |
| 18 | Water Shuriken | Multi-hit (breaks Sash / Sturdy), Priority attacker |
| 17 | Dynamic Punch | — |
| 17 | Terrain Pulse | Special attacker |
| 16 | Bite | Physical attacker |
| 16 | Mortal Spin | Weather / effect denial |
| 16 | Toxic Spikes | Hazard setter, Poison spreader |
| 15 | Gyro Ball | — |
| 15 | Lunge | Debuff (Intimidate / drops) |
| 15 | Supercell Slam | — |
| 14 | Amnesia | — |
| 14 | Dig | — |
| 14 | Grassy Terrain | Grassy Terrain setter |
| 14 | Pin Missile | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 14 | Rest | Healing / sustain |
| 13 | Baby-Doll Eyes | Debuff (Intimidate / drops), Priority attacker |
| 13 | Dragon Tail | Positioning / ally support |
| 13 | Memento | — |
| 13 | Sandstorm | Sand setter |
| 13 | Whirlpool | Residual / chip damage, Trapper |
| 12 | Acid Spray | — |
| 12 | Aqua Step | — |
| 12 | Bullet Seed | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 12 | Confuse Ray | Status spreader (other) |
| 12 | Copycat | — |
| 12 | Eerie Impulse | — |
| 12 | Feather Dance | Debuff (Intimidate / drops) |
| 12 | Mirror Coat | — |
| 11 | Fickle Beam | Special attacker |
| 11 | First Impression | Physical attacker, Priority attacker |
| 11 | Pain Split | — |
| 11 | Storm Throw | Physical attacker |
| 10 | Bulldoze | Speed control (lower foe), Field-wide (hits own partner) |
| 10 | Double Team | — |
| 10 | Horn Leech | Healing / sustain, Physical attacker |
| 10 | Speed Swap | — |
| 10 | Transform | — |
| 9 | Agility | Setup / sweeper |
| 9 | Cotton Guard | — |
| 9 | Defog | Weather / effect denial |
| 9 | Mud Shot | — |
| 9 | Mud-Slap | — |
| 9 | String Shot | Speed control (lower foe) |
| 9 | Switcheroo | Item disruption |
| 8 | Acid Armor | — |
| 8 | Assurance | — |
| 8 | Fire Fang | — |
| 8 | Fling | — |
| 8 | Focus Energy | — |
| 8 | Grassy Glide | Grassy Terrain abuser, Physical attacker, Priority attacker |
| 8 | Iron Tail | Physical attacker |
| 8 | Metal Burst | — |
| 8 | Misty Terrain | Misty Terrain setter |
| 8 | Safeguard | — |
| 8 | Self-Destruct | Field-wide (hits own partner) |
| 8 | Shelter | — |
| 7 | Aqua Tail | Physical attacker |
| 7 | Beak Blast | — |
| 7 | Burning Jealousy | Spread attacker (both foes) |
| 7 | Fell Stinger | — |
| 7 | Mean Look | Trapper |
| 7 | Night Shade | Fixed / fractional damage |
| 7 | Temper Flare | — |
| 6 | Charge Beam | Setup / sweeper, Special attacker |
| 6 | Clear Smog | Weather / effect denial |
| 6 | Cross Poison | Poison spreader |
| 6 | Eerie Spell | — |
| 6 | Fly | — |
| 6 | Giga Impact | Physical attacker |
| 6 | Lava Plume | Field-wide (hits own partner), Burn spreader |
| 6 | Megahorn | Physical attacker |
| 6 | Spikes | Hazard setter |
| 6 | Sticky Web | Hazard setter |
| 6 | Struggle Bug | Debuff (Intimidate / drops), Spread attacker (both foes) |
| 6 | Tidy Up | Weather / effect denial |
| 5 | Electro Ball | — |
| 5 | Future Sight | Special attacker |
| 5 | Metal Sound | — |
| 5 | Mountain Gale | — |
| 5 | Razor Shell | — |
| 5 | Smack Down | — |
| 5 | Spirit Shackle | Trapper |
| 5 | Steel Beam | Special attacker |
| 5 | Steel Wing | Physical attacker |
| 4 | Flatter | Status spreader (other) |
| 4 | Howl | — |
| 4 | Snowscape | Snow setter |
| 4 | Spicy Extract | — |
| 4 | Thunder Fang | — |
| 3 | Aerial Ace | Physical attacker |
| 3 | Aqua Ring | — |
| 3 | Brutal Swing | — |
| 3 | Electrify | — |
| 3 | Flying Press | — |
| 3 | Grav Apple | — |
| 3 | Growth | Setup / sweeper |
| 3 | Hard Press | — |
| 3 | Low Sweep | — |
| 3 | Misty Explosion | Misty Terrain abuser |
| 3 | Payback | Physical attacker |
| 3 | Petal Blizzard | Field-wide (hits own partner) |
| 3 | Pounce | — |
| 3 | Skitter Smack | — |
| 3 | Stun Spore | Paralysis spreader |
| 3 | Topsy-Turvy | — |
| 3 | Trick-or-Treat | — |
| 2 | Acupressure | — |
| 2 | Air Cutter | Spread attacker (both foes) |
| 2 | Avalanche | Physical attacker |
| 2 | Cotton Spore | Speed control (lower foe) |
| 2 | Crabhammer | — |
| 2 | Cross Chop | Physical attacker |
| 2 | Electric Terrain | Electric Terrain setter |
| 2 | Endure | _(neutral — everyone runs it)_ |
| 2 | Extrasensory | — |
| 2 | Fairy Lock | Trapper |
| 2 | Guard Split | — |
| 2 | Infernal Parade | — |
| 2 | Meteor Beam | Special attacker |
| 2 | Morning Sun | Healing / sustain |
| 2 | Night Daze | — |
| 2 | Rock Polish | Setup / sweeper |
| 2 | Snap Trap | — |
| 2 | Thief | Item disruption |
| 2 | Wonder Room | — |
| 1 | Aromatic Mist | Positioning / ally support |
| 1 | Axe Kick | — |
| 1 | Blast Burn | — |
| 1 | Block | Trapper |
| 1 | Charge | — |
| 1 | Double Hit | Multi-hit (breaks Sash / Sturdy) |
| 1 | Drill Peck | — |
| 1 | Focus Punch | — |
| 1 | Frenzy Plant | — |
| 1 | Gastro Acid | — |
| 1 | Guard Swap | — |
| 1 | Guillotine | — |
| 1 | Magic Room | — |
| 1 | Mega Kick | — |
| 1 | Power Split | — |
| 1 | Return | — |
| 1 | Rock Wrecker | — |
| 1 | Sand Tomb | Residual / chip damage, Trapper |
| 1 | Sparkling Aria | — |
| 1 | Syrup Bomb | — |
| 1 | Tearful Look | Debuff (Intimidate / drops) |
| 1 | Whirlwind | Positioning / ally support |
| 0 | Anchor Shot | Trapper |
| 0 | Apple Acid | Special attacker |
| 0 | Arm Thrust | Multi-hit (breaks Sash / Sturdy) |
| 0 | Astral Barrage | Spread attacker (both foes) |
| 0 | Attract | Status spreader (other) |
| 0 | Aurora Beam | Special attacker |
| 0 | Barrage | Multi-hit (breaks Sash / Sturdy) |
| 0 | Bind | Residual / chip damage, Trapper |
| 0 | Bleakwind Storm | Spread attacker (both foes) |
| 0 | Blood Moon | Special attacker |
| 0 | Blue Flare | Burn spreader |
| 0 | Bolt Strike | Physical attacker |
| 0 | Bone Rush | Multi-hit (breaks Sash / Sturdy) |
| 0 | Bonemerang | Multi-hit (breaks Sash / Sturdy) |
| 0 | Bounce | Physical attacker |
| 0 | Captivate | Debuff (Intimidate / drops) |
| 0 | Chloroblast | Special attacker |
| 0 | Circle Throw | Positioning / ally support |
| 0 | Collision Course | Physical attacker |
| 0 | Comet Punch | Multi-hit (breaks Sash / Sturdy) |
| 0 | Core Enforcer | Special attacker |
| 0 | Corrosive Gas | Item disruption |
| 0 | Court Change | Weather / effect denial |
| 0 | Covet | Item disruption |
| 0 | Dark Void | Sleep spreader (action denial) |
| 0 | Diamond Storm | Spread attacker (both foes) |
| 0 | Double Iron Bash | Multi-hit (breaks Sash / Sturdy) |
| 0 | Dragon Breath | Paralysis spreader |
| 0 | Dragon Rage | Fixed / fractional damage |
| 0 | Echoed Voice | Special attacker |
| 0 | Fishious Rend | Physical attacker |
| 0 | Floral Healing | Healing / sustain |
| 0 | Fury Attack | Multi-hit (breaks Sash / Sturdy) |
| 0 | Gear Up | Positioning / ally support |
| 0 | Geomancy | Setup / sweeper |
| 0 | Glacial Lance | Spread attacker (both foes) |
| 0 | Glaciate | Speed control (lower foe) |
| 0 | Glaive Rush | Physical attacker |
| 0 | Grass Whistle | Sleep spreader (action denial) |
| 0 | Growl | Debuff (Intimidate / drops) |
| 0 | Guardian of Alola | Fixed / fractional damage |
| 0 | Hail | Snow setter |
| 0 | Incinerate | Item disruption |
| 0 | Inferno | Burn spreader |
| 0 | Ivy Cudgel | Physical attacker |
| 0 | Jungle Healing | Healing / sustain |
| 0 | Lovely Kiss | Sleep spreader (action denial) |
| 0 | Lunar Blessing | Healing / sustain |
| 0 | Luster Purge | Special attacker |
| 0 | Magnetic Flux | Positioning / ally support |
| 0 | Magnitude | Field-wide (hits own partner) |
| 0 | Milk Drink | Healing / sustain |
| 0 | Nature's Madness | Fixed / fractional damage |
| 0 | Noble Roar | Debuff (Intimidate / drops) |
| 0 | Origin Pulse | Spread attacker (both foes) |
| 0 | Overdrive | Spread attacker (both foes) |
| 0 | Play Nice | Debuff (Intimidate / drops) |
| 0 | Poison Gas | Poison spreader |
| 0 | Poison Powder | Poison spreader |
| 0 | Precipice Blades | Spread attacker (both foes) |
| 0 | Purify | Healing / sustain |
| 0 | Rapid Spin | Weather / effect denial |
| 0 | Razor Leaf | Spread attacker (both foes) |
| 0 | Relic Song | Spread attacker (both foes) |
| 0 | Retaliate | Physical attacker |
| 0 | Revenge | Physical attacker |
| 0 | Ruination | Fixed / fractional damage |
| 0 | Sacred Fire | Burn spreader |
| 0 | Sandsear Storm | Spread attacker (both foes) |
| 0 | Searing Shot | Field-wide (hits own partner) |
| 0 | Seismic Toss | Fixed / fractional damage |
| 0 | Shore Up | Healing / sustain |
| 0 | Silk Trap | Debuff (Intimidate / drops) |
| 0 | Sing | Sleep spreader (action denial) |
| 0 | Slash | Physical attacker |
| 0 | Smart Strike | Physical attacker |
| 0 | Snipe Shot | Special attacker |
| 0 | Soft-Boiled | Healing / sustain |
| 0 | Sonic Boom | Fixed / fractional damage |
| 0 | Spider Web | Trapper |
| 0 | Spore | Sleep spreader (action denial) |
| 0 | Springtide Storm | Spread attacker (both foes) |
| 0 | Surging Strikes | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 0 | Swift | Spread attacker (both foes) |
| 0 | Synchronoise | Field-wide (hits own partner) |
| 0 | Tail Glow | Setup / sweeper |
| 0 | Tail Slap | Multi-hit (breaks Sash / Sturdy) |
| 0 | Take Down | Physical attacker |
| 0 | Take Heart | Setup / sweeper |
| 0 | Teeter Dance | Status spreader (other) |
| 0 | Teleport | Pivot |
| 0 | Tera Blast | Special attacker |
| 0 | Thousand Waves | Trapper |
| 0 | Torment | Move-lock (Encore / Disable) |
| 0 | Toxic Thread | Poison spreader |
| 0 | Twineedle | Multi-hit (breaks Sash / Sturdy) |
| 0 | Twister | Special attacker |
| 0 | Victory Dance | Setup / sweeper |
| 0 | Wildbolt Storm | Spread attacker (both foes) |
| 0 | Work Up | Setup / sweeper |
| 0 | Wrap | Residual / chip damage, Trapper |
| 0 | Zing Zap | Physical attacker |

## Untagged moves with real usage (candidates to tag)

| uses | move |
|---|---|
| 166 | Minimize |
| 148 | Skill Swap |
| 109 | Barb Barrage |
| 74 | Simple Beam |
| 70 | Triple Arrows |
| 67 | Soak |
| 62 | Psych Up |
| 61 | Lumina Crash |
| 60 | Bug Bite |
| 59 | Cosmic Power |
| 58 | Beat Up |
| 57 | Struggle |
| 57 | Ice Fang |
| 57 | Fissure |
| 55 | High Jump Kick |
| 55 | Gravity |
| 52 | Sheer Cold |
| 51 | Destiny Bond |
| 43 | Solar Blade |
| 41 | Entrainment |
| 35 | Armor Cannon |
| 34 | Raging Bull |
| 31 | Role Play |
| 31 | Chilling Water |
| 30 | Lash Out |
| 30 | Ice Hammer |
| 29 | Ice Spinner |
| 29 | Bitter Malice |
| 28 | Dragon Cheer |
| 27 | Drill Run |
| 27 | Blaze Kick |
| 25 | Shell Side Arm |
| 25 | Burn Up |
| 23 | Worry Seed |
| 23 | Trailblaze |
| 23 | Horn Drill |
| 22 | Aura Wheel |
| 21 | Flame Charge |
| 21 | Aqua Cutter |
| 19 | Upper Hand |
| 18 | Psyshield Bash |
| 18 | Power Trip |
| 18 | Heat Crash |
| 17 | Dynamic Punch |
| 15 | Supercell Slam |
| 15 | Gyro Ball |
| 14 | Dig |
| 14 | Amnesia |
| 13 | Memento |
| 12 | Mirror Coat |
