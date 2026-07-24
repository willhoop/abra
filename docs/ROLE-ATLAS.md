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
| 7277 | Intimidate | Debuff (Intimidate / drops) |
| 2584 | Stamina | Bulky wall / support |
| 1655 | Fairy Aura | — |
| 1212 | Unnerve | — |
| 701 | Speed Boost | Setup / sweeper |
| 686 | Defiant | Setup / sweeper |
| 438 | Mold Breaker | — |
| 328 | Cloud Nine | Weather / effect denial |
| 253 | Competitive | Setup / sweeper |
| 235 | Lightning Rod | Redirection |
| 162 | Eelevate | — |
| 157 | Pressure | — |
| 119 | Simple | Setup / sweeper |
| 85 | No Guard | — |
| 68 | Moody | Setup / sweeper |
| 65 | Berserk | Setup / sweeper |
| 53 | Mirror Armor | Weather / effect denial |
| 49 | Moxie | Setup / sweeper |
| 39 | Insomnia | — |
| 34 | Justified | Setup / sweeper |
| 32 | Pixilate | — |
| 26 | Blaze | — |
| 26 | Sturdy | — |
| 24 | Supersweet Syrup | Setup / sweeper |
| 22 | Rough Skin | — |
| 18 | Unseen Fist | — |
| 16 | Adaptability | — |
| 14 | Drizzle | Rain setter |
| 14 | Prankster | Prankster (priority support) |
| 14 | Weak Armor | Setup / sweeper |
| 12 | Hospitality | Healing / sustain |
| 12 | Sap Sipper | Healing / sustain |
| 12 | Water Absorb | Healing / sustain |
| 11 | Good as Gold | Weather / effect denial |
| 10 | Drought | Sun setter |
| 8 | Chlorophyll | Sun abuser (needs sun) |
| 6 | Gooey | — |
| 6 | Water Bubble | — |
| 4 | Flame Body | — |
| 4 | Levitate | — |
| 4 | Multiscale | Bulky wall / support |
| 4 | Opportunist | — |
| 4 | Piercing Drill | — |
| 4 | Plus | — |
| 4 | Sand Rush | Sand abuser (needs sand) |
| 4 | Sand Stream | Sand setter |
| 4 | Solar Power | Sun abuser (needs sun) |
| 4 | Thick Fat | Bulky wall / support |
| 3 | Fire Mane | — |
| 3 | Snow Warning | Snow setter |
| 2 | Damp | — |
| 2 | Earth Eater | Healing / sustain |
| 2 | Flash Fire | — |
| 2 | Friend Guard | — |
| 2 | Frisk | — |
| 2 | Gale Wings | Prankster (priority support) |
| 2 | Illuminate | — |
| 2 | Mega Sol | — |
| 2 | Motor Drive | — |
| 2 | Natural Cure | — |
| 2 | Protean | — |
| 2 | Queenly Majesty | — |
| 2 | Rain Dish | Rain abuser (needs rain), Healing / sustain |
| 2 | Refrigerate | — |
| 2 | Regenerator | Healing / sustain, Bulky wall / support |
| 2 | Rock Head | — |
| 2 | Snow Cloak | Snow abuser (needs snow) |
| 2 | Supreme Overlord | — |
| 2 | Swift Swim | Rain abuser (needs rain) |
| 2 | Tough Claws | — |
| 2 | Toxic Debris | Hazard setter |
| 1 | Infiltrator | — |
| 1 | Unburden | — |
| 0 | Air Lock | Weather / effect denial |
| 0 | Arena Trap | Trapper |
| 0 | Beast Boost | Setup / sweeper |
| 0 | Chilling Neigh | Setup / sweeper |
| 0 | Clear Body | Weather / effect denial |
| 0 | Desolate Land | Sun setter |
| 0 | Dry Skin | Rain abuser (needs rain), Healing / sustain |
| 0 | Electric Surge | Electric Terrain setter |
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
| 0 | Sand Spit | Sand setter |
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
| 30077 | Protect | _(neutral — everyone runs it)_ |
| 10769 | Heat Wave | Special attacker, Spread attacker (both foes) |
| 8130 | Rock Slide | Physical attacker, Spread attacker (both foes) |
| 7316 | Tailwind | Tailwind (speed up) |
| 7293 | Fake Out | Fake Out (tempo) |
| 7135 | Hyper Voice | Special attacker, Spread attacker (both foes) |
| 6946 | Last Respects | Physical attacker |
| 6097 | Moonblast | Special attacker |
| 5267 | Earthquake | Physical attacker, Field-wide (hits own partner) |
| 5251 | Wave Crash | Physical attacker |
| 5084 | Close Combat | Physical attacker |
| 4585 | Weather Ball | Special attacker |
| 4022 | Electro Shot | Special attacker |
| 3952 | Sucker Punch | Physical attacker, Priority attacker |
| 3687 | Flare Blitz | Physical attacker |
| 3588 | Matcha Gotcha | Healing / sustain, Special attacker, Burn spreader |
| 3581 | Shadow Ball | Special attacker |
| 3391 | Hurricane | Special attacker |
| 3113 | Dragon Pulse | Special attacker |
| 3099 | Trick Room | Trick Room setter |
| 3018 | Psychic | Special attacker |
| 2812 | Parting Shot | Debuff (Intimidate / drops), Pivot |
| 2754 | Stomping Tantrum | Physical attacker |
| 2741 | Kowtow Cleave | Physical attacker |
| 2716 | Iron Head | Physical attacker |
| 2652 | Dragon Claw | Physical attacker |
| 2482 | Sludge Bomb | Special attacker, Poison spreader |
| 2463 | Earth Power | Special attacker |
| 2462 | Encore | Move-lock (Encore / Disable) |
| 2451 | Knock Off | Item disruption, Physical attacker |
| 2375 | Rage Powder | Redirection, Bulky wall / support |
| 2323 | Dazzling Gleam | Special attacker, Spread attacker (both foes) |
| 2313 | Flash Cannon | Special attacker |
| 2265 | Thunderbolt | Special attacker |
| 2225 | Eruption | Special attacker, Spread attacker (both foes) |
| 2114 | Make It Rain | Special attacker, Spread attacker (both foes) |
| 1895 | Aqua Jet | Physical attacker, Priority attacker |
| 1821 | Wide Guard | Wide / Quick Guard, Bulky wall / support |
| 1784 | Dual Wingbeat | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 1640 | Blizzard | Special attacker, Spread attacker (both foes) |
| 1635 | Helping Hand | Positioning / ally support, Helping Hand, Bulky wall / support |
| 1612 | Brave Bird | Physical attacker |
| 1603 | Light Screen | Screen setter, Bulky wall / support |
| 1552 | High Horsepower | Physical attacker |
| 1492 | Dire Claw | Physical attacker, Poison spreader |
| 1415 | Solar Beam | Special attacker |
| 1375 | Sleep Powder | Sleep spreader (action denial) |
| 1367 | Throat Chop | Physical attacker |
| 1331 | Spirit Break | Debuff (Intimidate / drops), Physical attacker |
| 1222 | Flip Turn | Physical attacker, Pivot |
| 1216 | Life Dew | Healing / sustain, Bulky wall / support |
| 1210 | Infestation | Residual / chip damage, Trapper |
| 1197 | Will-O-Wisp | Burn spreader |
| 1175 | Hyper Beam | Special attacker |
| 1136 | Scald | Special attacker, Burn spreader |
| 1133 | Hydro Pump | Special attacker |
| 1119 | Giga Drain | Healing / sustain, Special attacker |
| 1118 | Zap Cannon | Paralysis spreader |
| 1113 | Ice Punch | Physical attacker |
| 1102 | Dark Pulse | Special attacker |
| 1102 | Reflect | Screen setter, Bulky wall / support |
| 1031 | Darkest Lariat | Physical attacker |
| 1025 | Baneful Bunker | Poison spreader |
| 1016 | Quick Attack | Physical attacker, Priority attacker |
| 976 | Drain Punch | Healing / sustain, Physical attacker |
| 943 | Toxic | Poison spreader |
| 931 | Foul Play | Physical attacker |
| 925 | Water Spout | Special attacker, Spread attacker (both foes) |
| 910 | Follow Me | Redirection, Bulky wall / support |
| 907 | Icy Wind | Speed control (lower foe), Spread attacker (both foes) |
| 861 | Muddy Water | Special attacker, Spread attacker (both foes) |
| 859 | Body Press | Physical attacker, Bulky wall / support |
| 853 | Calm Mind | Setup / sweeper |
| 853 | Draco Meteor | Special attacker |
| 833 | Poison Jab | Physical attacker, Poison spreader |
| 797 | Play Rough | Physical attacker |
| 773 | Power Gem | Special attacker |
| 765 | Nasty Plot | Setup / sweeper |
| 743 | Detect | _(neutral — everyone runs it)_ |
| 743 | Swords Dance | Setup / sweeper |
| 715 | Discharge | Special attacker, Paralysis spreader |
| 713 | Super Fang | Fixed / fractional damage |
| 689 | Rock Blast | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 686 | Psychic Fangs | Weather / effect denial, Physical attacker |
| 666 | Volt Switch | Pivot, Special attacker |
| 650 | Ice Beam | Special attacker |
| 630 | Light of Ruin | Special attacker |
| 613 | Liquidation | Physical attacker |
| 606 | Bullet Punch | Physical attacker, Priority attacker |
| 590 | Expanding Force | Psychic Terrain abuser, Spread attacker (both foes) |
| 585 | Shadow Sneak | Physical attacker, Priority attacker |
| 575 | Focus Blast | Special attacker |
| 566 | Taunt | Taunt |
| 535 | Bulk Up | Setup / sweeper |
| 507 | Extreme Speed | Physical attacker, Priority attacker |
| 496 | Perish Song | Perish Trap |
| 492 | Population Bomb | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 488 | Snarl | Debuff (Intimidate / drops), Special attacker, Spread attacker (both foes) |
| 486 | Rage Fist | Physical attacker |
| 485 | Roost | Healing / sustain |
| 478 | Low Kick | Physical attacker |
| 477 | Rain Dance | Rain setter |
| 476 | Energy Ball | Special attacker |
| 472 | Charm | Debuff (Intimidate / drops) |
| 466 | Hypnosis | Sleep spreader (action denial) |
| 453 | Bitter Blade | Physical attacker |
| 453 | Freeze-Dry | Special attacker |
| 444 | Overheat | Special attacker |
| 440 | Rock Tomb | Speed control (lower foe) |
| 437 | Flamethrower | Special attacker |
| 436 | Last Resort | Physical attacker |
| 436 | Superpower | Physical attacker |
| 405 | Yawn | Sleep spreader (action denial) |
| 404 | Disable | Move-lock (Encore / Disable) |
| 403 | Aura Sphere | Special attacker |
| 401 | Draining Kiss | Healing / sustain, Special attacker |
| 399 | Triple Axel | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 393 | Leaf Storm | Special attacker |
| 389 | Thunder | Special attacker, Paralysis spreader |
| 381 | Aurora Veil | Screen setter, Bulky wall / support |
| 377 | Psyshock | Special attacker |
| 369 | Twin Beam | Multi-hit (breaks Sash / Sturdy), Special attacker |
| 368 | Coil | Setup / sweeper |
| 367 | Dragon Dance | Setup / sweeper |
| 358 | Crunch | Physical attacker |
| 342 | Phantom Force | Physical attacker |
| 341 | U-turn | Physical attacker, Pivot |
| 336 | Spiky Shield | _(neutral — everyone runs it)_ |
| 333 | Stockpile | Setup / sweeper |
| 329 | Air Slash | Special attacker |
| 328 | Instruct | Positioning / ally support |
| 328 | Waterfall | Physical attacker |
| 327 | Minimize | — |
| 322 | Electroweb | Speed control (lower foe), Spread attacker (both foes) |
| 313 | Leech Seed | Residual / chip damage, Healing / sustain |
| 312 | Ice Shard | Physical attacker, Priority attacker |
| 294 | Skill Swap | — |
| 283 | Sacred Sword | Physical attacker |
| 276 | Poltergeist | Physical attacker |
| 272 | Coaching | Positioning / ally support |
| 264 | Shell Smash | Setup / sweeper |
| 261 | Recover | Healing / sustain |
| 260 | Fake Tears | Debuff (Intimidate / drops) |
| 257 | Psycho Cut | Physical attacker |
| 256 | Iron Defense | Setup / sweeper |
| 245 | Psychic Terrain | Psychic Terrain setter |
| 239 | Sunny Day | Sun setter |
| 230 | Double-Edge | Physical attacker |
| 225 | Volt Tackle | Physical attacker |
| 218 | Barb Barrage | — |
| 216 | Ally Switch | Positioning / ally support |
| 216 | Heavy Slam | Physical attacker |
| 204 | Ancient Power | Special attacker |
| 199 | Rising Voltage | Electric Terrain abuser, Special attacker |
| 186 | Thunder Wave | Paralysis spreader |
| 185 | Leaf Blade | Physical attacker |
| 179 | Surf | Field-wide (hits own partner) |
| 174 | Brick Break | Weather / effect denial, Physical attacker |
| 173 | Acrobatics | Physical attacker |
| 173 | Quick Guard | Wide / Quick Guard, Bulky wall / support |
| 173 | Stored Power | Special attacker |
| 172 | Feint | Physical attacker |
| 167 | Final Gambit | Fixed / fractional damage |
| 158 | Water Pulse | Special attacker |
| 157 | Trop Kick | Physical attacker |
| 155 | Grass Knot | Special attacker |
| 154 | Round | Special attacker |
| 149 | Clanging Scales | Special attacker |
| 149 | Flower Trick | Physical attacker |
| 147 | Gunk Shot | Physical attacker, Poison spreader |
| 146 | Baton Pass | Pivot |
| 145 | Stone Edge | Physical attacker |
| 144 | Meteor Mash | Physical attacker, Setup / sweeper |
| 144 | Simple Beam | — |
| 140 | Psychic Noise | Special attacker |
| 140 | Triple Arrows | — |
| 134 | Salt Cure | Residual / chip damage |
| 131 | Gigaton Hammer | Physical attacker |
| 130 | Parabolic Charge | Healing / sustain, Special attacker, Field-wide (hits own partner) |
| 128 | Mystical Fire | Special attacker |
| 125 | Body Slam | Physical attacker, Paralysis spreader |
| 125 | King's Shield | Debuff (Intimidate / drops) |
| 125 | Soak | — |
| 124 | Substitute | _(neutral — everyone runs it)_ |
| 123 | Stone Axe | Hazard setter |
| 122 | Psych Up | — |
| 121 | Scale Shot | Multi-hit (breaks Sash / Sturdy), Physical attacker, Setup / sweeper |
| 118 | Cosmic Power | — |
| 118 | Sludge Wave | Special attacker, Field-wide (hits own partner) |
| 117 | Lumina Crash | — |
| 116 | Hex | Special attacker |
| 115 | Head Smash | Physical attacker |
| 115 | Quash | Positioning / ally support |
| 114 | Power Whip | Physical attacker |
| 114 | Thunder Punch | Physical attacker |
| 113 | Ice Fang | — |
| 112 | Bug Bite | — |
| 112 | Struggle | — |
| 110 | High Jump Kick | — |
| 110 | Icicle Crash | Physical attacker |
| 110 | Jet Punch | Physical attacker, Priority attacker |
| 109 | Beat Up | — |
| 109 | Gravity | — |
| 109 | Quiver Dance | Setup / sweeper |
| 109 | Trick | Item disruption |
| 107 | Dragon Darts | Multi-hit (breaks Sash / Sturdy) |
| 106 | After You | Positioning / ally support |
| 104 | Fissure | — |
| 104 | Sheer Cold | — |
| 103 | Roar | Positioning / ally support |
| 100 | Destiny Bond | — |
| 100 | Torch Song | Setup / sweeper, Special attacker |
| 99 | Accelerock | Physical attacker, Priority attacker |
| 97 | Breaking Swipe | Spread attacker (both foes) |
| 96 | Headlong Rush | Physical attacker |
| 96 | Strength Sap | Healing / sustain |
| 94 | Outrage | Physical attacker |
| 92 | Belly Drum | Setup / sweeper |
| 92 | Curse | Residual / chip damage, Setup / sweeper |
| 90 | Shadow Claw | Physical attacker |
| 88 | Fire Spin | Residual / chip damage, Trapper |
| 86 | Endeavor | Fixed / fractional damage |
| 86 | Heal Pulse | Positioning / ally support, Healing / sustain |
| 86 | Solar Blade | — |
| 84 | Night Slash | Physical attacker |
| 84 | Shed Tail | Positioning / ally support, Pivot, Substitute user |
| 84 | Swagger | Status spreader (other) |
| 84 | Zen Headbutt | Physical attacker |
| 81 | Imprison | Move-lock (Encore / Disable) |
| 80 | Decorate | Positioning / ally support |
| 78 | Entrainment | — |
| 72 | Vacuum Wave | Priority attacker |
| 71 | Haze | Weather / effect denial |
| 70 | Armor Cannon | — |
| 68 | Raging Bull | — |
| 66 | Leech Life | Healing / sustain, Physical attacker |
| 65 | Boomburst | Special attacker, Field-wide (hits own partner) |
| 65 | Ceaseless Edge | Hazard setter, Physical attacker |
| 64 | Hammer Arm | Physical attacker |
| 64 | Mach Punch | Physical attacker, Priority attacker |
| 63 | Alluring Voice | Special attacker |
| 62 | No Retreat | Setup / sweeper |
| 62 | Role Play | — |
| 61 | Tickle | Debuff (Intimidate / drops) |
| 59 | Chilling Water | — |
| 59 | Fiery Dance | Setup / sweeper, Special attacker |
| 59 | Ice Hammer | — |
| 59 | Slack Off | Healing / sustain |
| 58 | Stealth Rock | Hazard setter |
| 57 | Ice Spinner | — |
| 56 | Lash Out | — |
| 55 | Dragon Cheer | — |
| 54 | Blaze Kick | — |
| 54 | Drill Run | — |
| 54 | Wish | Healing / sustain, Bulky wall / support |
| 53 | Bitter Malice | — |
| 52 | Bug Buzz | Special attacker |
| 50 | Burn Up | — |
| 50 | Clangorous Soul | Setup / sweeper |
| 50 | Shell Side Arm | — |
| 49 | Scary Face | Speed control (lower foe) |
| 46 | Frost Breath | Special attacker |
| 46 | Trailblaze | — |
| 46 | X-Scissor | Physical attacker |
| 45 | Venoshock | Special attacker |
| 45 | Worry Seed | — |
| 44 | Chilly Reception | Pivot, Snow setter |
| 44 | Nuzzle | Paralysis spreader |
| 44 | Wood Hammer | Physical attacker |
| 43 | Aura Wheel | — |
| 43 | Horn Drill | — |
| 42 | Aqua Cutter | — |
| 42 | Flame Charge | — |
| 42 | Synthesis | Healing / sustain |
| 40 | Facade | Physical attacker |
| 40 | Fire Blast | Special attacker |
| 40 | Glare | Paralysis spreader |
| 39 | Wild Charge | Physical attacker |
| 38 | Fire Punch | Physical attacker |
| 38 | Icicle Spear | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 37 | Explosion | Field-wide (hits own partner) |
| 36 | Dragon Rush | Physical attacker |
| 36 | Heat Crash | — |
| 36 | Pollen Puff | Healing / sustain, Special attacker |
| 36 | Psyshield Bash | — |
| 36 | Scorching Sands | Burn spreader |
| 36 | Seed Bomb | Physical attacker |
| 35 | Moonlight | Healing / sustain, Special attacker |
| 35 | Screech | Debuff (Intimidate / drops) |
| 35 | Upper Hand | — |
| 35 | Water Shuriken | Multi-hit (breaks Sash / Sturdy), Priority attacker |
| 34 | Dynamic Punch | — |
| 32 | Bite | Physical attacker |
| 32 | Power Trip | — |
| 32 | Toxic Spikes | Hazard setter, Poison spreader |
| 31 | Terrain Pulse | Special attacker |
| 30 | Supercell Slam | — |
| 29 | Mortal Spin | Weather / effect denial |
| 28 | Amnesia | — |
| 28 | Dig | — |
| 28 | Gyro Ball | — |
| 28 | Lunge | Debuff (Intimidate / drops) |
| 28 | Pin Missile | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 26 | Baby-Doll Eyes | Debuff (Intimidate / drops), Priority attacker |
| 26 | Dragon Tail | Positioning / ally support |
| 26 | Grassy Terrain | Grassy Terrain setter |
| 26 | Memento | — |
| 26 | Rest | Healing / sustain |
| 26 | Sandstorm | Sand setter |
| 26 | Whirlpool | Residual / chip damage, Trapper |
| 24 | Acid Spray | — |
| 24 | Bullet Seed | Multi-hit (breaks Sash / Sturdy), Physical attacker |
| 24 | Confuse Ray | Status spreader (other) |
| 24 | Eerie Impulse | — |
| 24 | Feather Dance | Debuff (Intimidate / drops) |
| 24 | Mirror Coat | — |
| 23 | Copycat | — |
| 22 | Aqua Step | — |
| 22 | Fickle Beam | Special attacker |
| 22 | First Impression | Physical attacker, Priority attacker |
| 22 | Pain Split | — |
| 22 | Storm Throw | Physical attacker |
| 20 | Bulldoze | Speed control (lower foe), Field-wide (hits own partner) |
| 20 | Double Team | — |
| 20 | Horn Leech | Healing / sustain, Physical attacker |
| 20 | Speed Swap | — |
| 18 | Cotton Guard | — |
| 18 | Defog | Weather / effect denial |
| 18 | Mud Shot | — |
| 18 | Mud-Slap | — |
| 18 | String Shot | Speed control (lower foe) |
| 18 | Switcheroo | Item disruption |
| 17 | Transform | — |
| 16 | Agility | Setup / sweeper |
| 16 | Assurance | — |
| 16 | Fire Fang | — |
| 16 | Fling | — |
| 16 | Grassy Glide | Grassy Terrain abuser, Physical attacker, Priority attacker |
| 16 | Misty Terrain | Misty Terrain setter |
| 16 | Safeguard | — |
| 16 | Self-Destruct | Field-wide (hits own partner) |
| 15 | Acid Armor | — |
| 15 | Focus Energy | — |
| 15 | Iron Tail | Physical attacker |
| 15 | Metal Burst | — |
| 14 | Aqua Tail | Physical attacker |
| 14 | Burning Jealousy | Spread attacker (both foes) |
| 14 | Fell Stinger | — |
| 14 | Mean Look | Trapper |
| 14 | Night Shade | Fixed / fractional damage |
| 14 | Shelter | — |
| 14 | Temper Flare | — |
| 12 | Charge Beam | Setup / sweeper, Special attacker |
| 12 | Cross Poison | Poison spreader |
| 12 | Eerie Spell | — |
| 12 | Fly | — |
| 12 | Giga Impact | Physical attacker |
| 12 | Spikes | Hazard setter |
| 12 | Tidy Up | Weather / effect denial |
| 11 | Struggle Bug | Debuff (Intimidate / drops), Spread attacker (both foes) |
| 10 | Beak Blast | — |
| 10 | Clear Smog | Weather / effect denial |
| 10 | Electro Ball | — |
| 10 | Future Sight | Special attacker |
| 10 | Metal Sound | — |
| 10 | Mountain Gale | — |
| 10 | Razor Shell | — |
| 10 | Smack Down | — |
| 10 | Spirit Shackle | Trapper |
| 10 | Steel Beam | Special attacker |
| 10 | Steel Wing | Physical attacker |
| 10 | Sticky Web | Hazard setter |
| 9 | Lava Plume | Field-wide (hits own partner), Burn spreader |
| 9 | Megahorn | Physical attacker |
| 8 | Flatter | Status spreader (other) |
| 8 | Howl | — |
| 8 | Snowscape | Snow setter |
| 8 | Spicy Extract | — |
| 8 | Thunder Fang | — |
| 6 | Aerial Ace | Physical attacker |
| 6 | Aqua Ring | — |
| 6 | Brutal Swing | — |
| 6 | Electrify | — |
| 6 | Flying Press | — |
| 6 | Grav Apple | — |
| 6 | Growth | Setup / sweeper |
| 6 | Hard Press | — |
| 6 | Low Sweep | — |
| 6 | Misty Explosion | Misty Terrain abuser |
| 6 | Payback | Physical attacker |
| 6 | Petal Blizzard | Field-wide (hits own partner) |
| 6 | Pounce | — |
| 6 | Skitter Smack | — |
| 6 | Stun Spore | Paralysis spreader |
| 6 | Trick-or-Treat | — |
| 5 | Topsy-Turvy | — |
| 4 | Acupressure | — |
| 4 | Air Cutter | Spread attacker (both foes) |
| 4 | Cotton Spore | Speed control (lower foe) |
| 4 | Crabhammer | — |
| 4 | Cross Chop | Physical attacker |
| 4 | Endure | _(neutral — everyone runs it)_ |
| 4 | Extrasensory | — |
| 4 | Fairy Lock | Trapper |
| 4 | Guard Split | — |
| 4 | Meteor Beam | Special attacker |
| 4 | Morning Sun | Healing / sustain |
| 4 | Night Daze | — |
| 4 | Snap Trap | — |
| 4 | Thief | Item disruption |
| 4 | Wonder Room | — |
| 3 | Avalanche | Physical attacker |
| 3 | Electric Terrain | Electric Terrain setter |
| 3 | Infernal Parade | — |
| 3 | Rock Polish | Setup / sweeper |
| 2 | Aromatic Mist | Positioning / ally support |
| 2 | Axe Kick | — |
| 2 | Blast Burn | — |
| 2 | Block | Trapper |
| 2 | Charge | — |
| 2 | Double Hit | Multi-hit (breaks Sash / Sturdy) |
| 2 | Drill Peck | — |
| 2 | Focus Punch | — |
| 2 | Frenzy Plant | — |
| 2 | Gastro Acid | — |
| 2 | Guard Swap | — |
| 2 | Magic Room | — |
| 2 | Mega Kick | — |
| 2 | Power Split | — |
| 2 | Return | — |
| 2 | Rock Wrecker | — |
| 2 | Sand Tomb | Residual / chip damage, Trapper |
| 2 | Sparkling Aria | — |
| 2 | Syrup Bomb | — |
| 2 | Tearful Look | Debuff (Intimidate / drops) |
| 1 | Guillotine | — |
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
| 327 | Minimize |
| 294 | Skill Swap |
| 218 | Barb Barrage |
| 144 | Simple Beam |
| 140 | Triple Arrows |
| 125 | Soak |
| 122 | Psych Up |
| 118 | Cosmic Power |
| 117 | Lumina Crash |
| 113 | Ice Fang |
| 112 | Struggle |
| 112 | Bug Bite |
| 110 | High Jump Kick |
| 109 | Gravity |
| 109 | Beat Up |
| 104 | Sheer Cold |
| 104 | Fissure |
| 100 | Destiny Bond |
| 86 | Solar Blade |
| 78 | Entrainment |
| 70 | Armor Cannon |
| 68 | Raging Bull |
| 62 | Role Play |
| 59 | Ice Hammer |
| 59 | Chilling Water |
| 57 | Ice Spinner |
| 56 | Lash Out |
| 55 | Dragon Cheer |
| 54 | Drill Run |
| 54 | Blaze Kick |
| 53 | Bitter Malice |
| 50 | Shell Side Arm |
| 50 | Burn Up |
| 46 | Trailblaze |
| 45 | Worry Seed |
| 43 | Horn Drill |
| 43 | Aura Wheel |
| 42 | Flame Charge |
| 42 | Aqua Cutter |
| 36 | Psyshield Bash |
| 36 | Heat Crash |
| 35 | Upper Hand |
| 34 | Dynamic Punch |
| 32 | Power Trip |
| 30 | Supercell Slam |
| 28 | Gyro Ball |
| 28 | Dig |
| 28 | Amnesia |
| 26 | Memento |
| 24 | Mirror Coat |
