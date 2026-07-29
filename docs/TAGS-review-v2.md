# Tag review — corrected pass

**101 tags.** Usage from **5,440 open-sheet human games** — 65,280 sheet entries, 260,799 move slots.

## Every point from your review

| you said | what I did |
|---|---|
| Scope Lens? | added — items had **no** crit tag at all. Also Super Luck, Merciless |
| max is 1.5 crit | documented — the ratio is a *stage* feeding P(crit); crit damage stays ×1.5 |
| Sniper makes crits 3x | added as a third crit parameter — but it is **×2.25**. It was ×3 when crits were ×2 |
| tag never-miss moves | `neverMisses` — 34.4% of move slots |
| Horn Drill is also OHKO | tagged. The whole OHKO family has **zero** usage in 260,799 slots |
| how do you model Mold Breaker | one boolean gating every defender-ability tag |
| do we need the priority table | already correct — it probes onModifyPriority. **Gap: Quash and priority items** |
| you can use negative prio vs Farig | verified: +3 → 0.984 blocked, 0 and −6 → 0.000 |
| does Gale Wings check full HP | verified — the probe passes real HP, so the condition evaluates |
| is Draining Kiss contact | yes. Exactly **4** special contact moves exist, 3 see play |
| .75 same, differ enemies vs my side too | split `spreadFoes` (9.7%) / `spreadAll` (2.0%) |
| Rock Slide only hits the enemy side | **you were right, I was wrong.** It is allAdjacentFoes |
| what is Dazzling | the ability, on Bruxish. Three names for one identical effect |
| these are just % chance to flinch | `flinches` now carries P(flinch), 10%–100% |
| King&rsquo;s Rock | added — same parameter, from the item side |
| Wide Guard: side condition or protect | split `oneTurnGuard` / `sideBuff` / `hazard` |
| hazards are different than Reflect | separated — **their** side, prices future switches |
| some recoil moves have more than others | now carries the fraction. Head Smash 1/2, Flare Blitz 33/100 |
| restores MY hp or PARTNER hp | split `healsSelf` / `healsAlly`, reconciled with `drain` |
| make sure Wide Guard works | **it does not** — rollout engine only. 2,065 uses |
| Trick Room needs its own tag | `reversesSpeed`. Wonder Room, Magic Room and Gravity separated too |
| accuracy tags — Gravity | `accuracyMod` |
| Wonder Room makes items useless? | close — Wonder Room **swaps Def/SpD**; *Magic Room* kills items. Both tagged |
| charge needs a weather sub-tag | `chargeSkippedByWeather` — Electro Shot in rain, Solar Beam in sun |
| or Power Herb (future proofing) | `skipsChargeTurn` — nonstandard today, derived so it works the day it is legal |
| Phantom Force / Meteor Beam not weather | correct — excluded |
| these are just switch moves not damage | split `pivotDamaging` / `pivotStatus` / `passesState` |
| is Substitute its own class | yes — added |
| Coaching would never be used on the enemy | boosts split **by sign**, not by target field |
| Decorate almost never on the foe | same fix — 525 Coaching and 18 Decorate were mistagged as debuffs |
| you could Decorate a Contrary Staraptor | Mega Staraptor **does** have Contrary. `expectedBoostSign` already handles the inversion |
| Memento is an Explosion-like move | `userFaints` |
| Encore is sorta like choice lock | `locksTarget` |
| status section for the Prankster buff | `statusCategory` — **38.5%** of move slots, unnamed until now |
| Weather Ball / Expanding Force | `weatherScaled` / `terrainScaled` |
| do we know what each berry resists | yes — the dex names it. 16 in play, 9.8% of items |
| Lum Berry? | `curesStatus` — a different class from the resist berries |
| Cursed Body / Toxic Debris under contact? | different **triggers**. Contact now derived from handler source |
| is "something happens when hit" enough | yes for the decision, no for the number |
| Reflect and Light Screen into damage calcs | **they are not.** 5,187 uses, zero effect on damage |
| no hardcodes | contact, weather/terrain setters, Intimidate, redirection and Sniper now derive from handler source. **18** name-based definitions remain, counted in the tool |

## The two gaps this surfaced

**Screens do not affect damage.** board.js derives the screen set correctly, then feeds it to
one consumer — a DODUO joint feature that is switched off. Light Screen 2,346 + Reflect 1,988
+ Aurora Veil 853 = **5,187 uses**, and none of them halve a single damage number.

**Wide Guard exists only in the rollout engine**, behind a hardcoded 35% heuristic. board.js
has nothing. **2,065 uses**.

## 45 of 101 tags are read by nothing

| tag | usage | sets |
|---|---|---|
| `profitsFromHit` | 15.1% | the target gains something for being hit |
| `resistBerry` | 9.5% | halves one super-effective hit, then is gone |
| `weatherSetter` | 9.5% | weather := x on switch-in |
| `contactPunish` | 8.8% | the ATTACKER pays for touching it |
| `damageMultType` | 8.6% | x1.2 on one type |
| `statusImmune` | 3.2% | a status cannot land |
| `extendsScreens` | 3.0% | side conditions last 8 turns not 5 |
| `restoresStats` | 2.0% | undoes stat drops once |
| `disablesAttacker` | 1.7% | the move I just used is removed from MY options |
| `weatherScaled` | 1.4% | type, power or target changes with the weather |
| `ignoresProtect` | 1.3% | Protect does NOT stop it |
| `accuracyMod` | 0.8% | P(hit) is scaled, for or against the holder |
| `pivotStatus` | 0.8% | no damage, an effect, then the user leaves |
| `chargeSkippedByWeather` | 0.7% | the charge turn DISAPPEARS under one weather |
| `healsSelf` | 0.6% | restores a share of MY max HP, costing the turn |
| `multiHit` | 0.5% | hits = n (or a distribution) |
| `survivesFromFull` | 0.3% | a lethal hit from full HP leaves 1 |
| `ignoresDefenderAbility` | 0.3% | suppress every defender-side ability tag for this move |
| `curesStatus` | 0.2% | a status is removed the moment it lands |
| `preventsCrit` | 0.2% | P(crit) = 0 |
| `failsWithoutWeather` | 0.1% | the move does NOTHING unless a weather is up |
| `critRatioUp` | 0.1% | P(crit) raised |
| `boostsTarget` | 0.1% | positive stat stages on a BODY THAT IS NOT ME |
| `critRatioUp` | 0.1% | P(crit) raised |
| `addsFlinch` | 0.1% | P(flinch) += 10% on moves that do not already flinch |
| `accuracyMod` | 0.1% | P(hit) is scaled for everyone |
| `fractionalPriority` | 0.1% | a CHANCE to move first inside the priority bracket |
| `forcesSwitch` | 0.1% | the TARGET is removed from the field |
| `critDamageUp` | 0.0% | the CRIT MULTIPLIER itself, not its probability |
| `terrainScaled` | 0.0% | power or target changes with the terrain |
| `alwaysCrit` | 0.0% | P(crit) = 1 |
| `passesState` | 0.0% | the incoming Pokemon INHERITS something |
| `hazard` | 0.0% | their side is damaged or slowed on switch-in, until removed |
| `critRatioUp` | 0.0% | P(crit) raised |
| `ohko` | 0.0% | removes the target outright |
| `fixedDamage` | 0.0% | damage is a constant, not a formula |
| `terrainSetter` | 0.0% | terrain := x on switch-in |
| `swapsDefences` | 0.0% | Def and SpD are exchanged, field-wide |
| `suppressesItems` | 0.0% | held items stop working, field-wide |
| `ignoresAbility` | 0.0% | the defender's ability does not apply |
| `blocksSecondary` | 0.0% | added effects do not apply to the holder |
| `preventsStatDrop` | 0.0% | stat drops do not apply |
| `contactPunish` | 0.0% | hurts anything that makes contact |
| `skipsChargeTurn` | 0.0% | the charge turn is skipped for any charge move |
| `preventsSwitch` | 0.0% | the foe cannot leave |

*read? is a grep for the probe string — wrong in both directions. A shortlist to verify, not a verdict.*

---

# STATUS MOVES — you asked to review these

**146 see real play.** All of them get **Prankster +1**, are **blanked by Taunt**,
and are **illegal under Assault Vest** — three interactions hanging off one property nothing
had named until now.

| move | uses | prio | other tags |
|---|---|---|---|
| Protect | 43,362 | +4 | `priority` `neverMisses` `stalling` |
| Tailwind | 6,981 |  | `neverMisses` `doublesSideSpeed` |
| Parting Shot | 4,782 |  | `sound` `pivotStatus` |
| Trick Room | 4,415 | -7 | `priority` `neverMisses` `ignoresProtect` `reversesSpeed` |
| Rage Powder | 3,851 | +2 | `priority` `powder` `neverMisses` `redirects` |
| Encore | 2,758 |  | `locksTarget` |
| Light Screen | 2,346 |  | `neverMisses` `halvesDamage` |
| Wide Guard | 2,065 | +3 | `priority` `neverMisses` `oneTurnGuard` |
| Helping Hand | 2,027 | +5 | `priority` `neverMisses` |
| Reflect | 1,988 |  | `neverMisses` `halvesDamage` |
| Nasty Plot | 1,763 |  | `neverMisses` `boostsUser` |
| Life Dew | 1,683 |  | `neverMisses` `healsSelf` `healsAlly` |
| Roost | 1,353 |  | `neverMisses` `healsSelf` |
| Swords Dance | 1,195 |  | `neverMisses` `boostsUser` |
| Calm Mind | 1,163 |  | `neverMisses` `boostsUser` |
| Detect | 1,162 | +4 | `priority` `neverMisses` `stalling` |
| Will-O-Wisp | 1,101 |  | `inflictsBurn` `inflictsStatus` |
| Follow Me | 933 | +2 | `priority` `neverMisses` `redirects` |
| Taunt | 867 |  | `forbidsStatusMoves` |
| Aurora Veil | 853 |  | `neverMisses` `halvesDamage` `failsWithoutWeather` |
| Sleep Powder | 734 |  | `powder` `inflictsSleep` `inflictsStatus` |
| Rain Dance | 701 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Charm | 691 |  | `lowersTarget` |
| Bulk Up | 561 |  | `neverMisses` `boostsUser` |
| Perish Song | 560 |  | `sound` `neverMisses` `ignoresProtect` |
| Yawn | 536 |  | `neverMisses` |
| Coaching | 525 |  | `neverMisses` `boostsTarget` |
| Strength Sap | 518 |  | `healsAlly` |
| Toxic | 480 |  | `inflictsPoison` `inflictsStatus` |
| Baneful Bunker | 436 | +4 | `priority` `neverMisses` `stalling` |
| Disable | 414 |  | `locksTarget` |
| Spiky Shield | 401 | +4 | `priority` `neverMisses` `stalling` |
| Sunny Day | 376 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Haze | 359 |  | `neverMisses` `ignoresProtect` |
| Quick Guard | 356 | +3 | `priority` `neverMisses` `oneTurnGuard` |
| Fake Tears | 345 |  | `lowersTarget` |
| Dragon Dance | 343 |  | `neverMisses` `boostsUser` |
| Coil | 301 |  | `neverMisses` `accuracyMod` `boostsUser` |
| Recover | 300 |  | `neverMisses` `healsSelf` |
| Thunder Wave | 284 |  | `inflictsParalysis` `inflictsStatus` |
| Roar | 281 | -6 | `priority` `sound` `neverMisses` `ignoresProtect` `forcesSwitch` |
| Hypnosis | 273 |  | `inflictsSleep` `inflictsStatus` |
| Trick | 266 |  | — |
| Shell Smash | 248 |  | `neverMisses` `boostsUser` |
| Leech Seed | 234 |  | — |
| Substitute | 234 |  | `neverMisses` `substitute` |
| Scary Face | 208 |  | `lowersTarget` |
| Clangorous Soul | 189 |  | `sound` `neverMisses` `boostsUser` |
| Tickle | 177 |  | `lowersTarget` |
| Imprison | 158 |  | `neverMisses` |
| Iron Defense | 146 |  | `neverMisses` `boostsUser` |
| King's Shield | 127 | +4 | `priority` `neverMisses` `stalling` |
| Quash | 125 |  | — |
| After You | 104 |  | `neverMisses` `ignoresProtect` |
| Instruct | 90 |  | `neverMisses` |
| Soak | 78 |  | — |
| Ally Switch | 76 | +2 | `priority` `neverMisses` |
| Belly Drum | 66 |  | `neverMisses` |
| Baton Pass | 65 |  | `neverMisses` `passesState` |
| Swagger | 64 |  | `boostsTarget` |
| Heal Pulse | 62 |  | `neverMisses` `healsAlly` |
| Stealth Rock | 62 |  | `neverMisses` `hazard` |
| Curse | 61 |  | `neverMisses` `ignoresProtect` |
| Quiver Dance | 58 |  | `neverMisses` `boostsUser` |
| Skill Swap | 56 |  | `neverMisses` |
| Baby-Doll Eyes | 50 | +1 | `priority` `lowersTarget` |
| Psychic Terrain | 50 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Psych Up | 46 |  | `neverMisses` `ignoresProtect` |
| Wish | 46 |  | `neverMisses` `healsSelf` |
| Rest | 44 |  | `neverMisses` `healsSelf` |
| No Retreat | 43 |  | `neverMisses` `boostsUser` |
| Shed Tail | 41 |  | `neverMisses` `passesState` `substitute` |
| Destiny Bond | 39 |  | `neverMisses` |
| Transform | 39 |  | `neverMisses` `ignoresProtect` |
| Gravity | 34 |  | `neverMisses` `ignoresProtect` `accuracyMod` |
| Slack Off | 34 |  | `neverMisses` `healsSelf` |
| Synthesis | 33 |  | `neverMisses` `healsSelf` |
| Memento | 31 |  | `lowersTarget` `userFaints` |
| Worry Seed | 29 |  | — |
| Howl | 26 |  | `sound` `neverMisses` `boostsTarget` |
| Pain Split | 26 |  | `neverMisses` |
| Moonlight | 21 |  | `neverMisses` `healsSelf` |
| Stockpile | 21 |  | `neverMisses` |
| Tidy Up | 21 |  | `neverMisses` |
| Cotton Spore | 20 |  | `spreadFoes` `powder` `lowersTarget` |
| Entrainment | 20 |  | — |
| Glare | 20 |  | `inflictsParalysis` `inflictsStatus` |
| Toxic Spikes | 20 |  | `neverMisses` `hazard` |
| Decorate | 18 |  | `neverMisses` `ignoresProtect` `boostsTarget` |
| Shelter | 18 |  | `neverMisses` `boostsUser` |
| Chilly Reception | 17 |  | `neverMisses` `ignoresProtect` `pivotStatus` `setsWeather` |
| Sticky Web | 17 |  | `neverMisses` `hazard` |
| Cosmic Power | 15 |  | `neverMisses` `boostsUser` |
| Dragon Cheer | 14 |  | `sound` `neverMisses` |
| Minimize | 14 |  | `neverMisses` `accuracyMod` `boostsUser` |
| Acid Armor | 13 |  | `neverMisses` `boostsUser` |
| String Shot | 13 |  | `spreadFoes` `lowersTarget` |
| Role Play | 12 |  | `neverMisses` `ignoresProtect` |
| Stun Spore | 12 |  | `powder` `inflictsParalysis` `inflictsStatus` |
| Whirlwind | 12 | -6 | `priority` `neverMisses` `ignoresProtect` `forcesSwitch` |
| Electric Terrain | 11 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Agility | 10 |  | `neverMisses` `boostsUser` |
| Eerie Impulse | 10 |  | `lowersTarget` |
| Sleep Talk | 10 |  | `neverMisses` |
| Topsy-Turvy | 10 |  | `neverMisses` |
| Cotton Guard | 9 |  | `neverMisses` `boostsUser` |
| Simple Beam | 9 |  | — |
| Feather Dance | 8 |  | `lowersTarget` |
| Morning Sun | 7 |  | `neverMisses` `healsSelf` |
| Switcheroo | 7 |  | — |
| Toxic Thread | 6 |  | `lowersTarget` `inflictsPoison` `inflictsStatus` |
| Safeguard | 6 |  | `neverMisses` `sideBuff` |
| Aqua Ring | 5 |  | `neverMisses` |
| Grassy Terrain | 5 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Magic Powder | 5 |  | `powder` |
| Mean Look | 5 |  | `neverMisses` `ignoresProtect` |
| Misty Terrain | 5 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Power Swap | 5 |  | `neverMisses` |
| Speed Swap | 5 |  | `neverMisses` |
| Spikes | 5 |  | `neverMisses` `hazard` |
| Spite | 5 |  | — |
| Growth | 4 |  | `weatherScaled` `neverMisses` `boostsUser` |
| Sandstorm | 4 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Trick-or-Treat | 4 |  | — |
| Amnesia | 4 |  | `neverMisses` `boostsUser` |
| Copycat | 4 |  | `neverMisses` |
| Defog | 4 |  | `neverMisses` |
| Focus Energy | 4 |  | `neverMisses` |
| Healing Wish | 4 |  | `neverMisses` `userFaints` `healsSelf` |
| Torment | 4 |  | `locksTarget` |
| Snowscape | 3 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Endure | 3 | +4 | `priority` `neverMisses` `stalling` |
| Gastro Acid | 3 |  | — |
| Screech | 3 |  | `sound` `lowersTarget` |
| Spore | 3 |  | `powder` `inflictsSleep` `inflictsStatus` |
| Confuse Ray | 2 |  | — |
| Wonder Room | 2 |  | `neverMisses` `ignoresProtect` `swapsDefences` |
| Corrosive Gas | 1 |  | `spreadAll` |
| Electrify | 1 |  | `neverMisses` |
| Aromatic Mist | 1 |  | `neverMisses` `boostsTarget` |
| Charge | 1 |  | `neverMisses` `boostsUser` |
| Forest's Curse | 1 |  | — |
| Magnet Rise | 1 |  | `neverMisses` `failsWithoutWeather` |
| Recycle | 1 |  | `neverMisses` |
| Spicy Extract | 1 |  | `neverMisses` `lowersTarget` |
| Sweet Scent | 1 |  | `spreadFoes` `accuracyMod` `lowersTarget` |

A dash means the taxonomy says nothing about it beyond being a status move — **13 of them**.

---

# MOVES

## `weatherScaled` — type, power or target changes with the weather  **← NOT READ**

*Weather Ball (4,699 uses), Hydro Steam. Its type is handled; the power and the target change are not*

| entry | appearances |
|---|---|
| Weather Ball | 4,699 |
| Hurricane | 2,259 |
| Blizzard | 1,532 |
| Thunder | 179 |
| Growth | 4 |

Total tagged: **5**  ·  share: **1.4%**

## `ignoresProtect` — Protect does NOT stop it  **← NOT READ**

*Feint, Phantom Force, Future Sight. tgtMayProtect discounts these as if a Protect saves the target, and it does not*

| entry | appearances |
|---|---|
| Trick Room | 4,415 |
| Rain Dance | 701 |
| Perish Song | 560 |
| Sunny Day | 376 |
| Haze | 359 |
| Roar | 281 |
| Feint | 222 |
| Phantom Force | 201 |
| After You | 104 |
| Curse | 61 |
| Psychic Terrain | 50 |
| Psych Up | 46 |
| Transform | 39 |
| Gravity | 34 |
| Decorate | 18 |
| Chilly Reception | 17 |
| Role Play | 12 |
| Whirlwind | 12 |
| Electric Terrain | 11 |
| Future Sight | 5 |
| Grassy Terrain | 5 |
| Mean Look | 5 |
| Misty Terrain | 5 |
| Sandstorm | 4 |
| Snowscape | 3 |
| Wonder Room | 2 |

Total tagged: **31**  ·  5 legal but unused  ·  share: **1.3%**

## `pivotStatus` — no damage, an effect, then the user leaves  **← NOT READ**

*Parting Shot (4,782 uses, the most common pivot in the format) and Chilly Reception. The switch is the point and the effect is the payment*

| entry | appearances |
|---|---|
| Parting Shot | 4,782 |
| Chilly Reception | 17 |

Total tagged: **2**  ·  share: **0.8%**

## `chargeSkippedByWeather` — the charge turn DISAPPEARS under one weather  **← NOT READ**

*Electro Shot in rain, Solar Beam and Solar Blade in sun. Same move, no downside, and the weather that does it is usually one the user set themselves*

| entry | appearances |
|---|---|
| Solar Beam | 2,477 |
| Electro Shot | 1,667 |
| Solar Blade | 8 |

Total tagged: **3**  ·  share: **0.7%**

## `healsSelf` — restores a share of MY max HP, costing the turn  **← NOT READ**

*Wish, Rest, Slack Off, Synthesis, Moonlight. Trades tempo for bulk, which nothing prices*

| entry | appearances |
|---|---|
| Life Dew | 1,683 |
| Roost | 1,353 |
| Recover | 300 |
| Wish | 46 |
| Rest | 44 |
| Slack Off | 34 |
| Synthesis | 33 |
| Moonlight | 21 |
| Morning Sun | 7 |
| Healing Wish | 4 |

Total tagged: **12**  ·  2 legal but unused  ·  share: **0.6%**

## `multiHit` — hits = n (or a distribution)  **← NOT READ**

*total damage is n x base, and it BREAKS Focus Sash and Sturdy -- the first hit takes the holder to 1, the rest kill*

| entry | appearances |
|---|---|
| Dual Wingbeat | 1,724 |
| Twin Beam | 467 |
| Triple Axel | 326 |
| Population Bomb | 276 |
| Scale Shot | 123 |
| Dragon Darts | 55 |
| Rock Blast | 39 |
| Bullet Seed | 21 |
| Pin Missile | 17 |
| Water Shuriken | 16 |
| Icicle Spear | 5 |
| Bone Rush | 4 |

Total tagged: **14**  ·  2 legal but unused  ·  share: **0.5%**

## `failsWithoutWeather` — the move does NOTHING unless a weather is up  **← NOT READ**

*Aurora Veil needs snow. Clicking it on a clear field is a wasted turn, and no feature can currently say so*

| entry | appearances |
|---|---|
| Aurora Veil | 853 |
| Magnet Rise | 1 |

Total tagged: **2**  ·  share: **0.1%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*a higher crit stage, which the damage distribution should weight rather than ignore*

| entry | appearances |
|---|---|
| Psycho Cut | 190 |
| Stone Edge | 110 |
| Leaf Blade | 108 |
| Blaze Kick | 87 |
| Shadow Claw | 68 |
| Night Slash | 64 |
| Triple Arrows | 49 |
| Aqua Cutter | 27 |
| Drill Run | 17 |
| Cross Chop | 10 |
| Crabhammer | 4 |
| Cross Poison | 1 |

Total tagged: **14**  ·  2 legal but unused  ·  share: **0.1%**

## `boostsTarget` — positive stat stages on a BODY THAT IS NOT ME  **← NOT READ**

*Coaching (525 uses), Decorate, Howl, Aromatic Mist. Aimed at the partner in every real game, and DODUO has boostsPartnerDamage for exactly this*

| entry | appearances |
|---|---|
| Coaching | 525 |
| Swagger | 64 |
| Howl | 26 |
| Decorate | 18 |
| Aromatic Mist | 1 |

Total tagged: **6**  ·  1 legal but unused  ·  share: **0.1%**

## `accuracyMod` — P(hit) is scaled for everyone  **← NOT READ**

*Gravity (x5/3 and grounds Flying), Sand Attack, Hone Claws. Feeds the same P(hit) the kill distribution already needs*

| entry | appearances |
|---|---|
| Coil | 301 |
| Gravity | 34 |
| Minimize | 14 |
| Sweet Scent | 1 |

Total tagged: **5**  ·  1 legal but unused  ·  share: **0.1%**

## `forcesSwitch` — the TARGET is removed from the field  **← NOT READ**

*Whirlwind, Dragon Tail, Roar. Undoes setup and changes who is in front of you*

| entry | appearances |
|---|---|
| Roar | 281 |
| Dragon Tail | 48 |
| Whirlwind | 12 |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.1%**

## `terrainScaled` — power or target changes with the terrain  **← NOT READ**

*Expanding Force becomes a SPREAD move in Psychic Terrain, Rising Voltage doubles in Electric. Grassy Glide gains priority, which board.js already special-cases*

| entry | appearances |
|---|---|
| Rising Voltage | 90 |
| Expanding Force | 80 |
| Terrain Pulse | 4 |

Total tagged: **3**  ·  share: **0.0%**

## `alwaysCrit` — P(crit) = 1  **← NOT READ**

*x1.5 and ignores the defender's positive defensive boosts*

| entry | appearances |
|---|---|
| Flower Trick | 124 |
| Frost Breath | 32 |
| Storm Throw | 10 |

Total tagged: **3**  ·  share: **0.0%**

## `passesState` — the incoming Pokemon INHERITS something  **← NOT READ**

*Baton Pass hands over the stat boosts, Shed Tail hands over a Substitute. Nothing in the model represents a switch that carries state across*

| entry | appearances |
|---|---|
| Baton Pass | 65 |
| Shed Tail | 41 |

Total tagged: **2**  ·  share: **0.0%**

## `hazard` — their side is damaged or slowed on switch-in, until removed  **← NOT READ**

*Stealth Rock, Spikes, Toxic Spikes, Sticky Web. Does nothing THIS turn -- it prices their future switches, which is a decision MAG does not model at all*

| entry | appearances |
|---|---|
| Stealth Rock | 62 |
| Toxic Spikes | 20 |
| Sticky Web | 17 |
| Spikes | 5 |

Total tagged: **4**  ·  share: **0.0%**

## `ohko` — removes the target outright  **← NOT READ**

*a different kill calculation entirely*

| entry | appearances |
|---|---|
| Sheer Cold | 41 |
| Fissure | 24 |
| Guillotine | 2 |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.0%**

## `fixedDamage` — damage is a constant, not a formula  **← NOT READ**

*Seismic Toss and Night Shade ignore stats entirely*

| entry | appearances |
|---|---|
| Night Shade | 22 |

Total tagged: **2**  ·  1 legal but unused  ·  share: **0.0%**

## `swapsDefences` — Def and SpD are exchanged, field-wide  **← NOT READ**

*Wonder Room. Every stored damage number is wrong while it is up*

| entry | appearances |
|---|---|
| Wonder Room | 2 |

Total tagged: **1**  ·  share: **0.0%**

## `suppressesItems` — held items stop working, field-wide  **← NOT READ**

*Magic Room. Kills Focus Sash, Choice items, Assault Vest and the berries at once*

*Nothing carrying this tag appears on any real team.*

Total tagged: **1**  ·  1 legal but unused  ·  share: **0.0%**

## `ignoresAbility` — the defender's ability does not apply  **← NOT READ**

*Mold Breaker-style moves walk through Levitate and the damage-reducing abilities*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

## `statusCategory` — category is Status: Prankster +1, blanked by Taunt, illegal under Assault Vest

*The class Prankster boosts and Taunt deletes. isStatus exists as a FEATURE but was never a named parameter, so nothing connected it to priorityMod or to Taunt*

| entry | appearances |
|---|---|
| Protect | 43,362 |
| Tailwind | 6,981 |
| Parting Shot | 4,782 |
| Trick Room | 4,415 |
| Rage Powder | 3,851 |
| Encore | 2,758 |
| Light Screen | 2,346 |
| Wide Guard | 2,065 |
| Helping Hand | 2,027 |
| Reflect | 1,988 |
| Nasty Plot | 1,763 |
| Life Dew | 1,683 |
| Roost | 1,353 |
| Swords Dance | 1,195 |
| Calm Mind | 1,163 |
| Detect | 1,162 |
| Will-O-Wisp | 1,101 |
| Follow Me | 933 |
| Taunt | 867 |
| Aurora Veil | 853 |
| Sleep Powder | 734 |
| Rain Dance | 701 |
| Charm | 691 |
| Bulk Up | 561 |
| Perish Song | 560 |
| Yawn | 536 |
| Coaching | 525 |
| Strength Sap | 518 |
| Toxic | 480 |
| Baneful Bunker | 436 |
| Disable | 414 |
| Spiky Shield | 401 |
| Sunny Day | 376 |
| Haze | 359 |
| Quick Guard | 356 |
| Fake Tears | 345 |
| Dragon Dance | 343 |
| Coil | 301 |
| Recover | 300 |
| Thunder Wave | 284 |
| *…106 more* | |

Total tagged: **175**  ·  29 legal but unused  ·  share: **16.7%**

## `neverMisses` — P(hit) = 1

*Aerial Ace, Swift, Flower Trick, Aura Sphere, Magical Leaf. The accuracy feature and the kill probability both scale by P(hit), so a move that CANNOT miss must not be discounted like one that can*

| entry | appearances |
|---|---|
| Protect | 43,362 |
| Tailwind | 6,981 |
| Trick Room | 4,415 |
| Rage Powder | 3,851 |
| Kowtow Cleave | 2,970 |
| Light Screen | 2,346 |
| Wide Guard | 2,065 |
| Helping Hand | 2,027 |
| Reflect | 1,988 |
| Nasty Plot | 1,763 |
| Life Dew | 1,683 |
| Roost | 1,353 |
| Swords Dance | 1,195 |
| Calm Mind | 1,163 |
| Detect | 1,162 |
| Follow Me | 933 |
| Aurora Veil | 853 |
| Rain Dance | 701 |
| Aura Sphere | 672 |
| Bulk Up | 561 |
| Perish Song | 560 |
| Yawn | 536 |
| Coaching | 525 |
| Baneful Bunker | 436 |
| Spiky Shield | 401 |
| Sunny Day | 376 |
| Haze | 359 |
| Quick Guard | 356 |
| Dragon Dance | 343 |
| Coil | 301 |
| Recover | 300 |
| Roar | 281 |
| Shell Smash | 248 |
| Substitute | 234 |
| Clangorous Soul | 189 |
| Imprison | 158 |
| Iron Defense | 146 |
| King's Shield | 127 |
| Flower Trick | 124 |
| After You | 104 |
| *…68 more* | |

Total tagged: **132**  ·  24 legal but unused  ·  share: **14.9%**

## `priority` — order = priority

*who moves first, before speed is consulted at all*

| entry | appearances |
|---|---|
| Protect | 43,362 |
| Fake Out | 7,846 |
| Trick Room | 4,415 |
| Sucker Punch | 3,909 |
| Rage Powder | 3,851 |
| Aqua Jet | 3,034 |
| Wide Guard | 2,065 |
| Helping Hand | 2,027 |
| Quick Attack | 1,199 |
| Detect | 1,162 |
| Follow Me | 933 |
| Bullet Punch | 565 |
| Extreme Speed | 449 |
| Baneful Bunker | 436 |
| Spiky Shield | 401 |
| Quick Guard | 356 |
| Ice Shard | 354 |
| Shadow Sneak | 345 |
| Roar | 281 |
| Accelerock | 241 |
| Feint | 222 |
| Vacuum Wave | 135 |
| King's Shield | 127 |
| Jet Punch | 90 |
| Ally Switch | 76 |
| Upper Hand | 56 |
| Baby-Doll Eyes | 50 |
| Dragon Tail | 48 |
| Mach Punch | 36 |
| Water Shuriken | 16 |
| Mirror Coat | 12 |
| Whirlwind | 12 |
| Counter | 7 |
| Avalanche | 6 |
| Focus Punch | 6 |
| First Impression | 3 |
| Endure | 3 |
| Beak Blast | 2 |

Total tagged: **39**  ·  1 legal but unused  ·  share: **13.0%**

## `contact` — triggers contact punishment on the defender

*Rocky Helmet, Rough Skin, Iron Barbs, Static, Flame Body all cost you for touching*

| entry | appearances |
|---|---|
| Fake Out | 7,846 |
| Close Combat | 5,487 |
| Iron Head | 4,314 |
| Wave Crash | 4,052 |
| Flare Blitz | 4,032 |
| Sucker Punch | 3,909 |
| Dragon Claw | 3,864 |
| Aqua Jet | 3,034 |
| Kowtow Cleave | 2,970 |
| Brave Bird | 2,279 |
| Stomping Tantrum | 2,122 |
| Low Kick | 1,854 |
| Throat Chop | 1,768 |
| Flip Turn | 1,762 |
| Dual Wingbeat | 1,724 |
| Knock Off | 1,640 |
| Dire Claw | 1,509 |
| Ice Punch | 1,421 |
| Psychic Fangs | 1,352 |
| High Horsepower | 1,286 |
| Darkest Lariat | 1,232 |
| Quick Attack | 1,199 |
| Spirit Break | 1,115 |
| Play Rough | 911 |
| Poison Jab | 758 |
| U-turn | 741 |
| Drain Punch | 705 |
| Bullet Punch | 565 |
| Foul Play | 563 |
| Body Press | 562 |
| Liquidation | 552 |
| Extreme Speed | 449 |
| Draining Kiss | 434 |
| Infestation | 434 |
| Super Fang | 434 |
| Ice Fang | 433 |
| Rage Fist | 363 |
| Shadow Sneak | 345 |
| Triple Axel | 326 |
| Meteor Mash | 315 |
| *…101 more* | |

Total tagged: **166**  ·  25 legal but unused  ·  share: **12.7%**

## `stalling` — is a Protect-family move

*protectThreatened and deadStall both hang off it*

| entry | appearances |
|---|---|
| Protect | 43,362 |
| Detect | 1,162 |
| Baneful Bunker | 436 |
| Spiky Shield | 401 |
| King's Shield | 127 |
| Endure | 3 |

Total tagged: **6**  ·  share: **7.6%**

## `spreadFoes` — x0.75, hits BOTH ENEMIES, ally is safe

*Heat Wave, Hyper Voice, Dazzling Gleam, Blizzard, Make It Rain. Free to click beside a partner*

| entry | appearances |
|---|---|
| Rock Slide | 6,915 |
| Heat Wave | 4,031 |
| Matcha Gotcha | 3,392 |
| Hyper Voice | 2,461 |
| Dazzling Gleam | 1,999 |
| Blizzard | 1,532 |
| Make It Rain | 1,420 |
| Icy Wind | 845 |
| Snarl | 569 |
| Eruption | 565 |
| Muddy Water | 469 |
| Electroweb | 343 |
| Water Spout | 342 |
| Clanging Scales | 302 |
| Breaking Swipe | 70 |
| Burning Jealousy | 32 |
| Struggle Bug | 30 |
| Mortal Spin | 21 |
| Cotton Spore | 20 |
| String Shot | 13 |
| Sweet Scent | 1 |

Total tagged: **22**  ·  1 legal but unused  ·  share: **4.2%**

## `flinches` — P(flinch), 10% to 100%, and only if I move first

*Fake Out 100% at +3, Rock Slide 30%, Iron Head 20%, the fangs 10%. Blocked by Covert Cloak and Inner Focus, neither of which is checked*

| entry | appearances |
|---|---|
| Fake Out | 7,846 |
| Rock Slide | 6,915 |
| Iron Head | 4,314 |
| Dark Pulse | 1,013 |
| Ice Fang | 433 |
| Waterfall | 212 |
| Icicle Crash | 184 |
| Air Slash | 135 |
| Zen Headbutt | 59 |
| Upper Hand | 56 |
| Triple Arrows | 49 |
| Extrasensory | 39 |
| Bite | 22 |
| Dragon Rush | 16 |
| Fire Fang | 9 |
| Mountain Gale | 6 |
| Thunder Fang | 6 |

Total tagged: **19**  ·  2 legal but unused  ·  share: **3.5%**

## `boostsUser` — WHICH stat stages, on self, not just that there are some

*movesBoostMe is only a sign. +Spe flips the speed order, +Atk changes damage, +Def changes survival -- three different values reading as one number today*

| entry | appearances |
|---|---|
| Close Combat | 5,487 |
| Nasty Plot | 1,763 |
| Make It Rain | 1,420 |
| Draco Meteor | 1,199 |
| Swords Dance | 1,195 |
| Calm Mind | 1,163 |
| Overheat | 771 |
| Bulk Up | 561 |
| Dragon Dance | 343 |
| Leaf Storm | 337 |
| Coil | 301 |
| Shell Smash | 248 |
| Clangorous Soul | 189 |
| Superpower | 182 |
| Iron Defense | 146 |
| Hammer Arm | 106 |
| Quiver Dance | 58 |
| No Retreat | 43 |
| Armor Cannon | 31 |
| Ice Hammer | 31 |
| Headlong Rush | 26 |
| Shelter | 18 |
| Cosmic Power | 15 |
| Minimize | 14 |
| Acid Armor | 13 |
| Agility | 10 |
| Cotton Guard | 9 |
| Growth | 4 |
| Amnesia | 4 |
| Charge | 1 |

Total tagged: **32**  ·  2 legal but unused  ·  share: **2.6%**

## `inflictsBurn` — P(burn): x0.5 physical damage on them, plus chip

*Will-O-Wisp as the move, Flare Blitz and Matcha Gotcha as a secondary. Halving their physical output is a damage parameter, not a status footnote*

| entry | appearances |
|---|---|
| Flare Blitz | 4,032 |
| Heat Wave | 4,031 |
| Matcha Gotcha | 3,392 |
| Will-O-Wisp | 1,101 |
| Scald | 601 |
| Flamethrower | 494 |
| Blaze Kick | 87 |
| Scorching Sands | 87 |
| Fire Punch | 45 |
| Fire Blast | 25 |
| Infernal Parade | 15 |
| Fire Fang | 9 |
| Lava Plume | 1 |

Total tagged: **14**  ·  1 legal but unused  ·  share: **2.3%**

## `recoil` — the user pays a FRACTION of the damage dealt

*Head Smash 1/2, Flare Blitz and Wave Crash 33/100 at ~4,000 uses each, Wild Charge 1/4. A cost nothing prices*

| entry | appearances |
|---|---|
| Wave Crash | 4,052 |
| Flare Blitz | 4,032 |
| Brave Bird | 2,279 |
| Light of Ruin | 713 |
| Head Smash | 183 |
| Double-Edge | 164 |
| Volt Tackle | 145 |
| Wild Charge | 58 |
| Steel Beam | 27 |
| Wood Hammer | 24 |

Total tagged: **11**  ·  1 legal but unused  ·  share: **1.9%**

## `variablePower` — basePower is computed, not fixed

*Gyro Ball, Low Kick, Grass Knot, Weather Ball, Facade, Acrobatics. A fixed bp reads them wrong in both directions*

| entry | appearances |
|---|---|
| Last Respects | 3,009 |
| Stomping Tantrum | 2,122 |
| Low Kick | 1,854 |
| Eruption | 565 |
| Rage Fist | 363 |
| Water Spout | 342 |
| Triple Axel | 326 |
| Grass Knot | 242 |
| Beat Up | 223 |
| Heavy Slam | 119 |
| Acrobatics | 92 |
| Rising Voltage | 90 |
| Hex | 63 |
| Round | 36 |
| Temper Flare | 30 |
| Assurance | 26 |
| Hard Press | 26 |
| Gyro Ball | 24 |
| Stored Power | 17 |
| Water Shuriken | 16 |
| Infernal Parade | 15 |
| Electro Ball | 7 |
| Avalanche | 6 |
| Heat Crash | 5 |
| Reversal | 4 |
| Power Trip | 2 |
| Payback | 1 |

Total tagged: **29**  ·  2 legal but unused  ·  share: **1.6%**

## `sound` — bypasses Substitute, blocked by Soundproof

*also the trigger for Throat Spray*

| entry | appearances |
|---|---|
| Parting Shot | 4,782 |
| Hyper Voice | 2,461 |
| Snarl | 569 |
| Perish Song | 560 |
| Clanging Scales | 302 |
| Roar | 281 |
| Clangorous Soul | 189 |
| Psychic Noise | 95 |
| Alluring Voice | 86 |
| Bug Buzz | 40 |
| Round | 36 |
| Howl | 26 |
| Torch Song | 26 |
| Dragon Cheer | 14 |
| Boomburst | 11 |
| Screech | 3 |
| Sparkling Aria | 3 |
| Eerie Spell | 1 |
| Uproar | 1 |

Total tagged: **24**  ·  5 legal but unused  ·  share: **1.6%**

## `doublesSideSpeed` — my whole side moves at x2 speed for the duration

*Tailwind, 6,981 uses. Flips who moves first across every matchup on the field at once, and board.js already derives the speed multiplier -- it just is not scored as a CHOICE*

| entry | appearances |
|---|---|
| Tailwind | 6,981 |

Total tagged: **1**  ·  share: **1.2%**

## `drain` — heals a fraction of damage dealt

*changes the value of clicking it into a healthy target*

| entry | appearances |
|---|---|
| Matcha Gotcha | 3,392 |
| Giga Drain | 806 |
| Drain Punch | 705 |
| Draining Kiss | 434 |
| Bitter Blade | 211 |
| Leech Life | 92 |
| Parabolic Charge | 70 |
| Horn Leech | 6 |

Total tagged: **8**  ·  share: **0.9%**

## `spreadAll` — x0.75, hits BOTH ENEMIES AND MY PARTNER

*Earthquake, Rock Slide, Discharge, Surf. This is the one allyHit exists for, and the one that killed its own Archaludon*

| entry | appearances |
|---|---|
| Earthquake | 4,533 |
| Discharge | 400 |
| Sludge Wave | 97 |
| Parabolic Charge | 70 |
| Surf | 68 |
| Bulldoze | 17 |
| Petal Blizzard | 12 |
| Boomburst | 11 |
| Explosion | 11 |
| Self-Destruct | 7 |
| Misty Explosion | 3 |
| Sparkling Aria | 3 |
| Brutal Swing | 2 |
| Corrosive Gas | 1 |
| Lava Plume | 1 |

Total tagged: **16**  ·  1 legal but unused  ·  share: **0.9%**

## `halvesDamage` — incoming damage to my side is roughly halved

*Light Screen 2,346, Reflect 1,988, Aurora Veil 853 -- 5,187 uses that currently change NO damage number anywhere in MAG*

| entry | appearances |
|---|---|
| Light Screen | 2,346 |
| Reflect | 1,988 |
| Aurora Veil | 853 |

Total tagged: **3**  ·  share: **0.9%**

## `redirects` — takes the turn's single-target attacks

*Follow Me and Rage Powder. A pair feature in DODUO and nothing in the single-move vector*

| entry | appearances |
|---|---|
| Rage Powder | 3,851 |
| Follow Me | 933 |

Total tagged: **2**  ·  share: **0.8%**

## `powder` — fails into Grass types, Overcoat and Safety Goggles

*this is how Rage Powder is beaten, and redirection is scored as if it always works*

| entry | appearances |
|---|---|
| Rage Powder | 3,851 |
| Sleep Powder | 734 |
| Cotton Spore | 20 |
| Stun Spore | 12 |
| Magic Powder | 5 |
| Spore | 3 |

Total tagged: **7**  ·  1 legal but unused  ·  share: **0.8%**

## `reversesSpeed` — speed order is inverted for the whole field

*Trick Room. MAG set this FOR Will, who had the slowest Pokemon on the field, and was then 4-0ed. It knows the field is ALREADY set (deadField) and cannot ask whether setting it helps*

| entry | appearances |
|---|---|
| Trick Room | 4,415 |

Total tagged: **1**  ·  share: **0.7%**

## `chargeTurn` — costs a turn before it lands

*and the request omits the target field on the locked turn, which already broke the player once*

| entry | appearances |
|---|---|
| Solar Beam | 2,477 |
| Electro Shot | 1,667 |
| Phantom Force | 201 |
| Solar Blade | 8 |
| Meteor Beam | 5 |
| Dig | 3 |

Total tagged: **10**  ·  4 legal but unused  ·  share: **0.7%**

## `inflictsParalysis` — P(paralysis): x0.5 their speed, plus 12.5% lost turns

*Changes who moves first, which most kill features hang off. Champions uses 12.5% full-para, not the 25% everywhere else*

| entry | appearances |
|---|---|
| Thunderbolt | 1,858 |
| Zap Cannon | 1,064 |
| Discharge | 400 |
| Thunder Wave | 284 |
| Thunder Punch | 204 |
| Thunder | 179 |
| Volt Tackle | 145 |
| Nuzzle | 110 |
| Body Slam | 71 |
| Glare | 20 |
| Stun Spore | 12 |
| Thunder Fang | 6 |

Total tagged: **13**  ·  1 legal but unused  ·  share: **0.7%**

## `inflictsPoison` — P(poison): chip, 1/8 or escalating

*Pure chip, so it prices a long game rather than this turn*

| entry | appearances |
|---|---|
| Sludge Bomb | 1,982 |
| Poison Jab | 758 |
| Toxic | 480 |
| Gunk Shot | 223 |
| Sludge Wave | 97 |
| Barb Barrage | 22 |
| Mortal Spin | 21 |
| Shell Side Arm | 9 |
| Toxic Thread | 6 |
| Poison Fang | 5 |
| Cross Poison | 1 |

Total tagged: **12**  ·  1 legal but unused  ·  share: **0.6%**

## `pivotDamaging` — damages, then the user leaves

*U-turn, Flip Turn, Volt Switch. Chip plus momentum, and no switch feature can see either*

| entry | appearances |
|---|---|
| Flip Turn | 1,762 |
| Volt Switch | 986 |
| U-turn | 741 |

Total tagged: **3**  ·  share: **0.6%**

## `locksTarget` — their option set collapses to one specific move, or loses one

*Encore pins them to their last move, Disable removes it, Torment blocks the repeat. stallIntoEncore already prices the Encore case from the RECEIVING end*

| entry | appearances |
|---|---|
| Encore | 2,758 |
| Disable | 414 |
| Torment | 4 |

Total tagged: **3**  ·  share: **0.5%**

## `inflictsStatus` — status := x (any)

*burn halves physical damage, paralysis halves speed -- both are damage/order parameters*

| entry | appearances |
|---|---|
| Will-O-Wisp | 1,101 |
| Sleep Powder | 734 |
| Toxic | 480 |
| Thunder Wave | 284 |
| Hypnosis | 273 |
| Glare | 20 |
| Stun Spore | 12 |
| Toxic Thread | 6 |
| Spore | 3 |

Total tagged: **11**  ·  2 legal but unused  ·  share: **0.5%**

## `oneTurnGuard` — blocks a CLASS of move for one turn

*Wide Guard blanks every spread move, Quick Guard every priority move. Neither is scored, and Wide Guard alone is 2,065 uses*

| entry | appearances |
|---|---|
| Wide Guard | 2,065 |
| Quick Guard | 356 |

Total tagged: **2**  ·  share: **0.4%**

## `healsAlly` — restores my PARTNER max-HP share

*Heal Pulse, Life Dew, Floral Healing. Already a pair feature in DODUO and nothing in the single-move vector*

| entry | appearances |
|---|---|
| Life Dew | 1,683 |
| Strength Sap | 518 |
| Heal Pulse | 62 |

Total tagged: **3**  ·  share: **0.4%**

## `lowersTarget` — negative stat stages on the foe

*Charm, Fake Tears, Scary Face, Tickle. Intimidate-shaped, and what Clear Amulet and White Herb answer*

| entry | appearances |
|---|---|
| Charm | 691 |
| Fake Tears | 345 |
| Scary Face | 208 |
| Tickle | 177 |
| Baby-Doll Eyes | 50 |
| Memento | 31 |
| Cotton Spore | 20 |
| String Shot | 13 |
| Eerie Impulse | 10 |
| Feather Dance | 8 |
| Toxic Thread | 6 |
| Screech | 3 |
| Spicy Extract | 1 |
| Sweet Scent | 1 |

Total tagged: **17**  ·  3 legal but unused  ·  share: **0.3%**

## `setsWeather` — weather := x

*and whether that weather HELPS is the thing nothing currently asks (task #19)*

| entry | appearances |
|---|---|
| Rain Dance | 701 |
| Sunny Day | 376 |
| Chilly Reception | 17 |
| Sandstorm | 4 |
| Snowscape | 3 |

Total tagged: **5**  ·  share: **0.2%**

## `recharge` — costs the turn AFTER it lands

*Hyper Beam. A free turn for the opponent*

| entry | appearances |
|---|---|
| Hyper Beam | 1,012 |
| Giga Impact | 20 |
| Hydro Cannon | 16 |
| Blast Burn | 3 |

Total tagged: **6**  ·  2 legal but unused  ·  share: **0.2%**

## `inflictsSleep` — P(sleep): they lose turns outright

*The most valuable status in the game and the one Electric Terrain blanks*

| entry | appearances |
|---|---|
| Sleep Powder | 734 |
| Hypnosis | 273 |
| Spore | 3 |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.2%**

## `forbidsStatusMoves` — the whole Status CATEGORY becomes unclickable for them

*Taunt. Deletes every Protect, setup move and Tailwind at once -- 38.5% of their move slots by share. Same restriction Assault Vest applies to its own holder*

| entry | appearances |
|---|---|
| Taunt | 867 |

Total tagged: **1**  ·  share: **0.1%**

## `substitute` — an HP buffer that absorbs hits and blanks status until it breaks

*Its own class. Sound moves go through it, and the damage needed to break it is a real number the kill calculation would have to clear first*

| entry | appearances |
|---|---|
| Substitute | 234 |
| Shed Tail | 41 |

Total tagged: **2**  ·  share: **0.0%**

## `userFaints` — the user dies as the cost

*Memento, Explosion, Final Gambit, Healing Wish. Final Gambit is 176 uses and deals damage equal to the user remaining HP, which the damage engine reads as ZERO*

| entry | appearances |
|---|---|
| Final Gambit | 176 |
| Memento | 31 |
| Explosion | 11 |
| Self-Destruct | 7 |
| Healing Wish | 4 |
| Misty Explosion | 3 |

Total tagged: **6**  ·  share: **0.0%**

## `setsTerrain` — terrain := x, with a second effect beyond the type boost

*Psychic Terrain blanks priority field-wide (Fake Out is 7,846 uses and nothing checks), Electric blocks sleep, Misty blocks all status, Grassy heals 1/16 a turn*

| entry | appearances |
|---|---|
| Psychic Terrain | 50 |
| Electric Terrain | 11 |
| Grassy Terrain | 5 |
| Misty Terrain | 5 |

Total tagged: **4**  ·  share: **0.0%**

## `sideBuff` — another multi-turn modifier on my side

*Safeguard, Mist -- what is left once Tailwind and the screens are split out*

| entry | appearances |
|---|---|
| Safeguard | 6 |

Total tagged: **1**  ·  share: **0.0%**

## `setsRoom` — another pseudo-weather

*whatever is left after Trick Room, Wonder Room, Magic Room and Gravity are split out*

*Nothing carrying this tag appears on any real team.*

Total tagged: **1**  ·  1 legal but unused  ·  share: **0.0%**

---

# ITEMS

## `resistBerry` — halves one super-effective hit, then is gone  **← NOT READ**

*Chople, Colbur, Kasib, Occa. About 6.8% of held items and it turns kills into non-kills*

| entry | appearances |
|---|---|
| Chople Berry | 1,432 |
| Colbur Berry | 1,234 |
| Kasib Berry | 1,101 |
| Occa Berry | 635 |
| Roseli Berry | 510 |
| Passho Berry | 484 |
| Coba Berry | 399 |
| Shuca Berry | 262 |
| Haban Berry | 112 |
| Babiri Berry | 70 |
| Yache Berry | 46 |
| Kebia Berry | 38 |
| Wacan Berry | 36 |
| Charti Berry | 31 |
| Rindo Berry | 23 |
| Payapa Berry | 6 |

Total tagged: **18**  ·  2 legal but unused  ·  share: **9.5%**

## `damageMultType` — x1.2 on one type  **← NOT READ**

*Charcoal, Black Glasses, Mystic Water, Fairy Feather. About 6.7% of held items and a pure calculation error*

| entry | appearances |
|---|---|
| Fairy Feather | 1,502 |
| Black Glasses | 1,319 |
| Mystic Water | 864 |
| Charcoal | 689 |
| Never-Melt Ice | 386 |
| Sharp Beak | 294 |
| Metal Coat | 212 |
| Dragon Fang | 116 |
| Silk Scarf | 100 |
| Spell Tag | 79 |
| Magnet | 77 |
| Soft Sand | 75 |
| Miracle Seed | 48 |
| Black Belt | 36 |
| Twisted Spoon | 24 |
| Hard Stone | 23 |
| Poison Barb | 6 |
| Silver Powder | 2 |

Total tagged: **18**  ·  share: **8.6%**

## `extendsScreens` — side conditions last 8 turns not 5  **← NOT READ**

*3.1% of items*

| entry | appearances |
|---|---|
| Light Clay | 2,007 |

Total tagged: **1**  ·  share: **3.0%**

## `restoresStats` — undoes stat drops once  **← NOT READ**

*2.1% of items, and it changes what a drop is worth*

| entry | appearances |
|---|---|
| White Herb | 1,358 |

Total tagged: **1**  ·  share: **2.0%**

## `accuracyMod` — P(hit) is scaled, for or against the holder  **← NOT READ**

*Bright Powder makes attacks against the holder 0.9x; Wide Lens (411 uses) makes the holder 1.1x. Feeds the same P(hit) the kill distribution consumes*

| entry | appearances |
|---|---|
| Wide Lens | 411 |
| Bright Powder | 142 |
| Zoom Lens | 22 |

Total tagged: **3**  ·  share: **0.8%**

## `curesStatus` — a status is removed the moment it lands  **← NOT READ**

*Lum (107 uses), Chesto, Rawst. Every status move aimed at the holder is a wasted turn, and inflictsStatus has no idea*

| entry | appearances |
|---|---|
| Lum Berry | 107 |
| Chesto Berry | 24 |
| Rawst Berry | 2 |

Total tagged: **6**  ·  3 legal but unused  ·  share: **0.2%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*Scope Lens (Will spotted this one missing). Rare at 0.11% of items, but it sets a parameter the distribution already needs for Flower Trick, so it costs nothing to support. NOTE the ratio is a STAGE feeding P(crit); the crit damage multiplier is always x1.5 and nothing here changes it -- do not read critRatio: 2 as double damage*

| entry | appearances |
|---|---|
| Scope Lens | 69 |

Total tagged: **1**  ·  share: **0.1%**

## `addsFlinch` — P(flinch) += 10% on moves that do not already flinch  **← NOT READ**

*King's Rock and Razor Fang. Sets the same parameter the move-side flinch tag does, which is exactly what a parameter taxonomy is for. Derived from an onModifyMove that mentions flinch, not from the names*

| entry | appearances |
|---|---|
| King's Rock | 49 |

Total tagged: **1**  ·  share: **0.1%**

## `fractionalPriority` — a CHANCE to move first inside the priority bracket  **← NOT READ**

*Quick Claw, 20% of turns. Speed order is what most kill features hang off, and this makes it probabilistic rather than determined*

| entry | appearances |
|---|---|
| Quick Claw | 39 |

Total tagged: **1**  ·  share: **0.1%**

## `blocksSecondary` — added effects do not apply to the holder  **← NOT READ**

*Covert Cloak. Fake Out does not flinch through it, and nothing checks*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

## `preventsStatDrop` — stat drops do not apply  **← NOT READ**

*Clear Amulet turns Intimidate into nothing*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

## `contactPunish` — hurts anything that makes contact  **← NOT READ**

*a cost of clicking a contact move that is not currently priced*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

## `skipsChargeTurn` — the charge turn is skipped for any charge move  **← NOT READ**

*Power Herb. Not legal in Reg M-B today; tagged so a format change does not silently leave a two-turn move scored as two turns*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

## `megaStone` — the holder becomes another species

*different stats, typing and ability from turn one*

| entry | appearances |
|---|---|
| Charizardite Y | 2,200 |
| Staraptite | 1,938 |
| Floettite | 1,439 |
| Swampertite | 1,345 |
| Metagrossite | 1,186 |
| Raichunite Y | 1,063 |
| Aerodactylite | 844 |
| Delphoxite | 760 |
| Mawilite | 677 |
| Tyranitarite | 633 |
| Froslassite | 544 |
| Gengarite | 446 |
| Venusaurite | 401 |
| Blastoisinite | 351 |
| Dragoninite | 284 |
| Scovillainite | 281 |
| Blazikenite | 277 |
| Eelektrossite | 258 |
| Scraftinite | 244 |
| Raichunite X | 216 |
| Sceptilite | 194 |
| Cameruptite | 193 |
| Gardevoirite | 190 |
| Pyroarite | 188 |
| Glimmoranite | 159 |
| Dragalgite | 145 |
| Meganiumite | 138 |
| Kangaskhanite | 131 |
| Malamarite | 90 |
| Garchompite | 85 |
| Lopunnite | 74 |
| Lucarionite | 72 |
| Gyaradosite | 69 |
| Charizardite X | 64 |
| Scizorite | 63 |
| Greninjite | 59 |
| Starminite | 56 |
| Clefablite | 53 |
| Excadrite | 53 |
| Drampanite | 51 |
| *…35 more* | |

Total tagged: **75**  ·  share: **27.0%**

## `survivesFromFull` — a lethal hit from full HP leaves 1

*Focus Sash, the most-held item in the format. Broken by multi-hit moves and by any prior chip*

| entry | appearances |
|---|---|
| Focus Sash | 7,610 |

Total tagged: **1**  ·  share: **11.2%**

## `healsAtHalf` — restores 25% when it drops below half

*Sitrus, 10.8% of items. Modelled in the rollout engine only, invisible to MAG*

| entry | appearances |
|---|---|
| Sitrus Berry | 7,043 |

Total tagged: **2**  ·  1 legal but unused  ·  share: **10.4%**

## `damageMultAll` — x damage on everything

*Life Orb 1.3, at a cost this does not model*

| entry | appearances |
|---|---|
| Life Orb | 6,223 |

Total tagged: **1**  ·  share: **9.2%**

## `passiveHeal` — restores HP every turn

*changes how many turns a kill takes*

| entry | appearances |
|---|---|
| Leftovers | 4,289 |

Total tagged: **1**  ·  share: **6.3%**

## `choiceLock` — the holder is locked into one move

*the single strongest thing an open sheet tells you about what they can do next turn*

| entry | appearances |
|---|---|
| Choice Scarf | 3,907 |

Total tagged: **1**  ·  share: **5.8%**

## `speedMult` — speed x1.5

*order, which most kill features hang off*

| entry | appearances |
|---|---|
| Choice Scarf | 3,907 |

Total tagged: **1**  ·  share: **5.8%**

## `blocksPowder` — powder moves fail against the holder

*Safety Goggles beats Rage Powder redirection outright*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

## `statMult` — raises one stat

*Band, Specs, Assault Vest, Eviolite*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**

---

# ABILITYS

## `profitsFromHit` — the target gains something for being hit  **← NOT READ**

*Stamina, Weak Armour, Berserk, Anger Shell, Justified, Rattled. Task #18 -- Will's Bellibolt case*

| entry | appearances |
|---|---|
| Rough Skin | 3,739 |
| Stamina | 1,631 |
| Cursed Body | 833 |
| Toxic Debris | 411 |
| Static | 276 |
| Flame Body | 113 |
| Illusion | 62 |
| Poison Point | 50 |
| Cute Charm | 48 |
| Electromorphosis | 48 |
| Justified | 29 |
| Wandering Spirit | 21 |
| Effect Spore | 20 |
| Mummy | 16 |
| Gooey | 10 |
| Weak Armor | 9 |
| Sand Spit | 4 |

Total tagged: **32**  ·  15 legal but unused  ·  share: **15.1%**

## `weatherSetter` — weather := x on switch-in  **← NOT READ**

*and megaing can COST you it, which is Will's reason to decline a mega*

| entry | appearances |
|---|---|
| Drizzle | 2,197 |
| Snow Warning | 943 |
| Sand Stream | 838 |
| Drought | 615 |

Total tagged: **8**  ·  4 legal but unused  ·  share: **9.5%**

## `contactPunish` — the ATTACKER pays for touching it  **← NOT READ**

*Rough Skin (3,739), Static, Flame Body, Poison Point, Cute Charm, Effect Spore, Mummy, Gooey. Derived by reading the handler for checkMoveMakesContact*

| entry | appearances |
|---|---|
| Rough Skin | 3,739 |
| Static | 276 |
| Flame Body | 113 |
| Poison Point | 50 |
| Cute Charm | 48 |
| Wandering Spirit | 21 |
| Effect Spore | 20 |
| Mummy | 16 |
| Gooey | 10 |

Total tagged: **14**  ·  5 legal but unused  ·  share: **8.8%**

## `statusImmune` — a status cannot land  **← NOT READ**

*Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor*

| entry | appearances |
|---|---|
| Sand Rush | 488 |
| Oblivious | 274 |
| Snow Cloak | 219 |
| Sand Veil | 135 |
| Overcoat | 85 |
| Leaf Guard | 75 |
| Water Bubble | 72 |
| Limber | 59 |
| Magma Armor | 43 |
| Insomnia | 39 |
| Purifying Salt | 32 |
| Sand Force | 18 |
| Ice Body | 6 |
| Vital Spirit | 3 |
| Immunity | 1 |

Total tagged: **20**  ·  5 legal but unused  ·  share: **3.2%**

## `disablesAttacker` — the move I just used is removed from MY options  **← NOT READ**

*Cursed Body (833 uses). Not damage and not a stat change -- it shrinks my own option set, the same shape as locksTarget from the receiving end*

| entry | appearances |
|---|---|
| Cursed Body | 833 |

Total tagged: **1**  ·  share: **1.7%**

## `survivesFromFull` — a lethal hit from full HP leaves 1  **← NOT READ**

*Sturdy. Identical to Focus Sash and NOT modelled anywhere -- verified 0 mentions*

| entry | appearances |
|---|---|
| Sturdy | 153 |

Total tagged: **1**  ·  share: **0.3%**

## `ignoresDefenderAbility` — suppress every defender-side ability tag for this move  **← NOT READ**

*Mold Breaker, Turboblaze, Teravolt. Gates typeImmunity, damageReduce, blocksMove, preventsCrit and Sturdy in one flag*

| entry | appearances |
|---|---|
| Mold Breaker | 127 |

Total tagged: **3**  ·  2 legal but unused  ·  share: **0.3%**

## `preventsCrit` — P(crit) = 0  **← NOT READ**

*Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit*

| entry | appearances |
|---|---|
| Disguise | 62 |
| Shell Armor | 24 |

Total tagged: **4**  ·  2 legal but unused  ·  share: **0.2%**

## `critDamageUp` — the CRIT MULTIPLIER itself, not its probability  **← NOT READ**

*Sniper (Will raised it). Three separate crit parameters exist and the taxonomy had only two: probability (Scope Lens, Flower Trick), prevention (Shell Armor) and now the multiplier. Crit damage is x1.5 and Sniper makes it x1.5 again, so x2.25 total -- it was x3 in the old gens when crits themselves were x2, which is where the folklore comes from*

| entry | appearances |
|---|---|
| Sniper | 24 |

Total tagged: **1**  ·  share: **0.0%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*Super Luck and Merciless. Same parameter as Scope Lens and Flower Trick*

| entry | appearances |
|---|---|
| Merciless | 3 |
| Super Luck | 3 |

Total tagged: **2**  ·  share: **0.0%**

## `terrainSetter` — terrain := x on switch-in  **← NOT READ**

*same shape as weather*

| entry | appearances |
|---|---|
| Psychic Surge | 1 |

Total tagged: **5**  ·  4 legal but unused  ·  share: **0.0%**

## `preventsSwitch` — the foe cannot leave  **← NOT READ**

*Shadow Tag, Arena Trap, Magnet Pull. Already used by the playstyle classifier*

*Nothing carrying this tag appears on any real team.*

Total tagged: **3**  ·  3 legal but unused  ·  share: **0.0%**

## `damageBoost` — x>1 damage dealt

*Adaptability, Technician, Tinted Lens, Sheer Force, Iron Fist, Strong Jaw*

| entry | appearances |
|---|---|
| Blaze | 2,675 |
| Pixilate | 1,426 |
| Torrent | 1,086 |
| Solar Power | 432 |
| Overgrow | 360 |
| Technician | 339 |
| Tough Claws | 269 |
| Sharpness | 154 |
| Sheer Force | 94 |
| Huge Power | 72 |
| Water Bubble | 72 |
| Supreme Overlord | 60 |
| Iron Fist | 53 |
| Swarm | 26 |
| Mega Launcher | 20 |
| Reckless | 19 |
| Sand Force | 18 |
| Rivalry | 13 |
| Guts | 12 |
| Hustle | 9 |
| Pure Power | 9 |
| Analytic | 7 |
| Strong Jaw | 5 |
| Minus | 2 |
| Plus | 2 |
| Refrigerate | 1 |

Total tagged: **44**  ·  18 legal but unused  ·  share: **14.9%**

## `onSwitchInDrop` — stat stages on the foe at switch-in

*Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked*

| entry | appearances |
|---|---|
| Intimidate | 6,536 |
| Supersweet Syrup | 13 |

Total tagged: **3**  ·  1 legal but unused  ·  share: **13.5%**

## `priorityMod` — order shifts for a class of move

*Prankster, Gale Wings, Triage. stallIntoEncore already depends on it*

| entry | appearances |
|---|---|
| Prankster | 4,649 |
| Gale Wings | 480 |
| Scrappy | 259 |
| Stance Change | 146 |
| Mold Breaker | 127 |
| Sheer Force | 94 |
| Infiltrator | 54 |
| Illuminate | 27 |
| Keen Eye | 27 |
| Stalwart | 27 |
| Skill Link | 4 |
| Long Reach | 2 |

Total tagged: **22**  ·  10 legal but unused  ·  share: **12.1%**

## `typeImmunity` — damage of one type := 0

*Levitate, Water Absorb, Flash Fire, Sap Sipper. Clicking into one wastes the turn entirely*

| entry | appearances |
|---|---|
| Good as Gold | 1,433 |
| Lightning Rod | 1,288 |
| Sand Rush | 488 |
| Flash Fire | 357 |
| Oblivious | 274 |
| Snow Cloak | 219 |
| Soundproof | 202 |
| Sturdy | 153 |
| Sand Veil | 135 |
| Telepathy | 112 |
| Magic Bounce | 89 |
| Overcoat | 85 |
| Bulletproof | 52 |
| Dry Skin | 52 |
| Magma Armor | 43 |
| Volt Absorb | 33 |
| Earth Eater | 31 |
| Sap Sipper | 22 |
| Sand Force | 18 |
| Water Absorb | 15 |
| Motor Drive | 13 |
| Ice Body | 6 |

Total tagged: **26**  ·  4 legal but unused  ·  share: **10.5%**

## `speedCond` — speed x2 under a condition

*Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order*

| entry | appearances |
|---|---|
| Chlorophyll | 1,131 |
| Sand Rush | 488 |
| Swift Swim | 321 |
| Surge Surfer | 8 |
| Slush Rush | 4 |
| Quick Feet | 2 |

Total tagged: **7**  ·  1 legal but unused  ·  share: **4.0%**

## `blocksMove` — a whole class of move fails

*already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold*

| entry | appearances |
|---|---|
| Armor Tail | 1,682 |
| Queenly Majesty | 220 |

Total tagged: **3**  ·  1 legal but unused  ·  share: **3.9%**

## `damageReduce` — x<1 damage taken

*Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them*

| entry | appearances |
|---|---|
| Multiscale | 348 |
| Solid Rock | 166 |
| Fluffy | 3 |

Total tagged: **9**  ·  6 legal but unused  ·  share: **1.1%**

## `formeChange` — the species changes mid-battle

*Zero to Hero (needs a switch), Illusion, Imposter, Disguise*

| entry | appearances |
|---|---|
| Zero to Hero | 105 |
| Disguise | 62 |
| Illusion | 62 |
| Imposter | 39 |

Total tagged: **7**  ·  3 legal but unused  ·  share: **0.6%**

## `invertsBoosts` — stat changes flip sign

*Contrary and Simple, already probed for expectedBoostSign*

| entry | appearances |
|---|---|
| Contrary | 134 |

Total tagged: **3**  ·  2 legal but unused  ·  share: **0.3%**

## `redirectsType` — draws that type to itself

*Lightning Rod and Storm Drain redirect AND boost*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**
