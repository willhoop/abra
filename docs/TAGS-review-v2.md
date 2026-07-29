# Tag review — corrected pass

**108 tags.** Usage from **5,440 open-sheet human games** — 65,280 sheet entries, 260,799 move slots.

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

## 51 of 108 tags are read by nothing

| tag | usage | sets |
|---|---|---|
| `profitsFromHit` | 15.4% | the target gains something for being hit |
| `weatherSetter` | 9.7% | weather := x on switch-in |
| `resistBerry` | 9.5% | halves one super-effective hit, then is gone |
| `contactPunish` | 9.0% | the ATTACKER pays for touching it |
| `damageMultType` | 8.6% | x1.2 on one type |
| `extendsScreens` | 3.0% | side conditions last 8 turns not 5 |
| `weatherChipImmune` | 2.7% | takes no sandstorm or snow residual damage |
| `restoresStats` | 2.0% | undoes stat drops once |
| `disablesAttacker` | 1.8% | the move I just used is removed from MY options |
| `weatherScaled` | 1.4% | type, power or target changes with the weather |
| `ignoresProtect` | 1.2% | Protect does NOT stop it |
| `accuracyMod` | 1.2% | P(hit) scaled, often gated on a weather or a category |
| `accuracyMod` | 0.8% | P(hit) is scaled, for or against the holder |
| `pivotStatus` | 0.8% | no damage, an effect, then the user leaves |
| `conditionalPower` | 0.7% | fixed power x a multiplier when a condition holds |
| `chargeSkippedByWeather` | 0.7% | the charge turn DISAPPEARS under one weather |
| `statusImmune` | 0.6% | a status cannot land |
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
| `perishClock` | 0.1% | everything on the field dies in 3 turns unless it switches |
| `delayedSleep` | 0.1% | they fall asleep at the end of NEXT turn unless they switch |
| `addsFlinch` | 0.1% | P(flinch) += 10% on moves that do not already flinch |
| `clearsBoosts` | 0.1% | every stat stage on the field := 0, both sides |
| `fractionalPriority` | 0.1% | a CHANCE to move first inside the priority bracket |
| `accuracyMod` | 0.1% | P(hit) is scaled for everyone |
| `forcesSwitch` | 0.1% | the TARGET is removed from the field |
| `critDamageUp` | 0.1% | the CRIT MULTIPLIER itself, not its probability |
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
| Parting Shot | 4,782 |  | `sound` `pivotStatus` `lowersTarget` |
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
| Perish Song | 560 |  | `sound` `neverMisses` `ignoresProtect` `perishClock` |
| Yawn | 536 |  | `neverMisses` `delayedSleep` |
| Coaching | 525 |  | `neverMisses` `boostsTarget` |
| Strength Sap | 518 |  | `lowersTarget` `healsAlly` |
| Toxic | 480 |  | `inflictsToxic` `inflictsStatus` |
| Baneful Bunker | 436 | +4 | `priority` `neverMisses` `stalling` `inflictsPoison` |
| Disable | 414 |  | `locksTarget` |
| Spiky Shield | 401 | +4 | `priority` `neverMisses` `stalling` |
| Sunny Day | 376 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Haze | 359 |  | `neverMisses` `ignoresProtect` `clearsBoosts` |
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
| Power Swap | 5 |  | `neverMisses` `lowersTarget` |
| Speed Swap | 5 |  | `neverMisses` |
| Spikes | 5 |  | `neverMisses` `hazard` |
| Spite | 5 |  | — |
| Growth | 4 |  | `weatherScaled` `neverMisses` `boostsUser` |
| Sandstorm | 4 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Trick-or-Treat | 4 |  | — |
| Amnesia | 4 |  | `neverMisses` `boostsUser` |
| Copycat | 4 |  | `neverMisses` |
| Defog | 4 |  | `neverMisses` `lowersTarget` |
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

| entry | appearances | parameter |
|---|---|---|
| Weather Ball | 4,699 | scalesWith:weather |
| Hurricane | 2,259 | scalesWith:weather |
| Blizzard | 1,532 | scalesWith:weather |
| Thunder | 179 | scalesWith:weather |
| Growth | 4 | scalesWith:weather |

Total tagged: **5**  ·  share: **1.4%**

## `ignoresProtect` — Protect does NOT stop it  **← NOT READ**

*Feint, Phantom Force, Future Sight. tgtMayProtect discounts these as if a Protect saves the target, and it does not*

| entry | appearances | parameter |
|---|---|---|
| Trick Room | 4,415 | ignoresProtect:true |
| Rain Dance | 701 | ignoresProtect:true |
| Perish Song | 560 | ignoresProtect:true |
| Sunny Day | 376 | ignoresProtect:true |
| Haze | 359 | ignoresProtect:true |
| Roar | 281 | ignoresProtect:true |
| Feint | 222 | ignoresProtect:true |
| Phantom Force | 201 | ignoresProtect:true |
| After You | 104 | ignoresProtect:true |
| Curse | 61 | ignoresProtect:true |
| Psychic Terrain | 50 | ignoresProtect:true |
| Psych Up | 46 | ignoresProtect:true |
| Transform | 39 | ignoresProtect:true |
| Gravity | 34 | ignoresProtect:true |
| Decorate | 18 | ignoresProtect:true |
| Chilly Reception | 17 | ignoresProtect:true |
| Role Play | 12 | ignoresProtect:true |
| Whirlwind | 12 | ignoresProtect:true |
| Electric Terrain | 11 | ignoresProtect:true |
| Future Sight | 5 | ignoresProtect:true |
| Grassy Terrain | 5 | ignoresProtect:true |
| Mean Look | 5 | ignoresProtect:true |
| Misty Terrain | 5 | ignoresProtect:true |
| Sandstorm | 4 | ignoresProtect:true |
| Snowscape | 3 | ignoresProtect:true |
| Wonder Room | 2 | ignoresProtect:true |

Total tagged: **31**  ·  5 legal but unused  ·  share: **1.2%**

## `pivotStatus` — no damage, an effect, then the user leaves  **← NOT READ**

*Parting Shot (4,782 uses, the most common pivot in the format) and Chilly Reception. The switch is the point and the effect is the payment*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,782 | selfSwitch:true |
| Chilly Reception | 17 | selfSwitch:true |

Total tagged: **2**  ·  share: **0.8%**

## `conditionalPower` — fixed power x a multiplier when a condition holds  **← NOT READ**

*Knock Off x1.5 if they hold an item (1,640 uses, and the SHEET tells you), Facade x2 if statused, Venoshock x2 if poisoned, Expanding Force x1.5 on Psychic Terrain. The engine uses the base number every time*

| entry | appearances | parameter |
|---|---|---|
| Solar Beam | 2,477 | conditional:true |
| Knock Off | 1,640 | conditional:true |
| Expanding Force | 80 | conditional:true |
| Lash Out | 47 | conditional:true |
| Facade | 32 | conditional:true |
| Fickle Beam | 28 | conditional:true |
| Barb Barrage | 22 | conditional:true |
| Grav Apple | 9 | conditional:true |
| Solar Blade | 8 | conditional:true |
| Venoshock | 5 | conditional:true |
| Misty Explosion | 3 | conditional:true |

Total tagged: **11**  ·  share: **0.7%**

## `chargeSkippedByWeather` — the charge turn DISAPPEARS under one weather  **← NOT READ**

*Electro Shot in rain, Solar Beam and Solar Blade in sun. Same move, no downside, and the weather that does it is usually one the user set themselves*

| entry | appearances | parameter |
|---|---|---|
| Solar Beam | 2,477 | skipsIn:sun |
| Electro Shot | 1,667 | skipsIn:rain |
| Solar Blade | 8 | skipsIn:sun |

Total tagged: **3**  ·  share: **0.7%**

## `healsSelf` — restores a share of MY max HP, costing the turn  **← NOT READ**

*Wish, Rest, Slack Off, Synthesis, Moonlight. Trades tempo for bulk, which nothing prices*

| entry | appearances | parameter |
|---|---|---|
| Life Dew | 1,683 | heal:[1,4] |
| Roost | 1,353 | heal:[1,2] |
| Recover | 300 | heal:[1,2] |
| Wish | 46 | heal:true |
| Rest | 44 | heal:true |
| Slack Off | 34 | heal:[1,2] |
| Synthesis | 33 | heal:true |
| Moonlight | 21 | heal:true |
| Morning Sun | 7 | heal:true |
| Healing Wish | 4 | heal:true |

Total tagged: **12**  ·  2 legal but unused  ·  share: **0.6%**

## `multiHit` — hits = n (or a distribution)  **← NOT READ**

*total damage is n x base, and it BREAKS Focus Sash and Sturdy -- the first hit takes the holder to 1, the rest kill*

| entry | appearances | parameter |
|---|---|---|
| Dual Wingbeat | 1,724 | hits:2 |
| Twin Beam | 467 | hits:2 |
| Triple Axel | 326 | hits:3 |
| Population Bomb | 276 | hits:10 |
| Scale Shot | 123 | hits:[2,5] |
| Dragon Darts | 55 | hits:2 |
| Rock Blast | 39 | hits:[2,5] |
| Bullet Seed | 21 | hits:[2,5] |
| Pin Missile | 17 | hits:[2,5] |
| Water Shuriken | 16 | hits:[2,5] |
| Icicle Spear | 5 | hits:[2,5] |
| Bone Rush | 4 | hits:[2,5] |

Total tagged: **14**  ·  2 legal but unused  ·  share: **0.5%**

## `failsWithoutWeather` — the move does NOTHING unless a weather is up  **← NOT READ**

*Aurora Veil needs snow. Clicking it on a clear field is a wasted turn, and no feature can currently say so*

| entry | appearances | parameter |
|---|---|---|
| Aurora Veil | 853 | needsWeather:true |
| Magnet Rise | 1 | needsWeather:true |

Total tagged: **2**  ·  share: **0.1%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*a higher crit stage, which the damage distribution should weight rather than ignore*

| entry | appearances | parameter |
|---|---|---|
| Psycho Cut | 190 | critRatio:2 |
| Stone Edge | 110 | critRatio:2 |
| Leaf Blade | 108 | critRatio:2 |
| Blaze Kick | 87 | critRatio:2 |
| Shadow Claw | 68 | critRatio:2 |
| Night Slash | 64 | critRatio:2 |
| Triple Arrows | 49 | critRatio:2 |
| Aqua Cutter | 27 | critRatio:2 |
| Drill Run | 17 | critRatio:2 |
| Cross Chop | 10 | critRatio:2 |
| Crabhammer | 4 | critRatio:2 |
| Cross Poison | 1 | critRatio:2 |

Total tagged: **14**  ·  2 legal but unused  ·  share: **0.1%**

## `boostsTarget` — positive stat stages on a BODY THAT IS NOT ME  **← NOT READ**

*Coaching (525 uses), Decorate, Howl, Aromatic Mist. Aimed at the partner in every real game, and DODUO has boostsPartnerDamage for exactly this*

| entry | appearances | parameter |
|---|---|---|
| Coaching | 525 | boosts:{atk:1,def:1} |
| Swagger | 64 | boosts:{atk:2} |
| Howl | 26 | boosts:{atk:1} |
| Decorate | 18 | boosts:{atk:2,spa:2} |
| Aromatic Mist | 1 | boosts:{spd:1} |

Total tagged: **6**  ·  1 legal but unused  ·  share: **0.1%**

## `perishClock` — everything on the field dies in 3 turns unless it switches  **← NOT READ**

*Perish Song, 560 uses. Ignores HP, typing, items and abilities. No damage feature can see it and no kill calculation applies*

| entry | appearances | parameter |
|---|---|---|
| Perish Song | 560 | turns:3 |

Total tagged: **1**  ·  share: **0.1%**

## `delayedSleep` — they fall asleep at the end of NEXT turn unless they switch  **← NOT READ**

*Yawn, 536 uses. Not a status this turn -- a threat that forces a switch, which is the whole point of clicking it*

| entry | appearances | parameter |
|---|---|---|
| Yawn | 536 | delay:1 |

Total tagged: **1**  ·  share: **0.1%**

## `clearsBoosts` — every stat stage on the field := 0, both sides  **← NOT READ**

*Haze, 359 uses. The only answer to setup in the format, and it hits YOUR boosts too -- so whether to click it depends on who is ahead on stages, which nothing computes*

| entry | appearances | parameter |
|---|---|---|
| Haze | 359 | resets:true |
| Clear Smog | 6 | resets:true |

Total tagged: **2**  ·  share: **0.1%**

## `accuracyMod` — P(hit) is scaled for everyone  **← NOT READ**

*Gravity (x5/3 and grounds Flying), Sand Attack, Hone Claws. Feeds the same P(hit) the kill distribution already needs*

| entry | appearances | parameter |
|---|---|---|
| Coil | 301 | accuracy:true |
| Gravity | 34 | accuracy:true |
| Minimize | 14 | accuracy:true |
| Sweet Scent | 1 | accuracy:true |

Total tagged: **5**  ·  1 legal but unused  ·  share: **0.1%**

## `forcesSwitch` — the TARGET is removed from the field  **← NOT READ**

*Whirlwind, Dragon Tail, Roar. Undoes setup and changes who is in front of you*

| entry | appearances | parameter |
|---|---|---|
| Roar | 281 | forceSwitch:true |
| Dragon Tail | 48 | forceSwitch:true |
| Whirlwind | 12 | forceSwitch:true |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.1%**

## `terrainScaled` — power or target changes with the terrain  **← NOT READ**

*Expanding Force becomes a SPREAD move in Psychic Terrain, Rising Voltage doubles in Electric. Grassy Glide gains priority, which board.js already special-cases*

| entry | appearances | parameter |
|---|---|---|
| Rising Voltage | 90 | scalesWith:terrain |
| Expanding Force | 80 | scalesWith:terrain |
| Terrain Pulse | 4 | scalesWith:terrain |

Total tagged: **3**  ·  share: **0.0%**

## `alwaysCrit` — P(crit) = 1  **← NOT READ**

*x1.5 and ignores the defender's positive defensive boosts*

| entry | appearances | parameter |
|---|---|---|
| Flower Trick | 124 | pCrit:1 |
| Frost Breath | 32 | pCrit:1 |
| Storm Throw | 10 | pCrit:1 |

Total tagged: **3**  ·  share: **0.0%**

## `passesState` — the incoming Pokemon INHERITS something  **← NOT READ**

*Baton Pass hands over the stat boosts, Shed Tail hands over a Substitute. Nothing in the model represents a switch that carries state across*

| entry | appearances | parameter |
|---|---|---|
| Baton Pass | 65 | passes:true |
| Shed Tail | 41 | passes:true |

Total tagged: **2**  ·  share: **0.0%**

## `hazard` — their side is damaged or slowed on switch-in, until removed  **← NOT READ**

*Stealth Rock, Spikes, Toxic Spikes, Sticky Web. Does nothing THIS turn -- it prices their future switches, which is a decision MAG does not model at all*

| entry | appearances | parameter |
|---|---|---|
| Stealth Rock | 62 | hazard:stealthrock |
| Toxic Spikes | 20 | hazard:toxicspikes |
| Sticky Web | 17 | hazard:stickyweb |
| Spikes | 5 | hazard:spikes |

Total tagged: **4**  ·  share: **0.0%**

## `ohko` — removes the target outright  **← NOT READ**

*a different kill calculation entirely*

| entry | appearances | parameter |
|---|---|---|
| Sheer Cold | 41 | ohko:true |
| Fissure | 24 | ohko:true |
| Guillotine | 2 | ohko:true |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.0%**

## `fixedDamage` — damage is a constant, not a formula  **← NOT READ**

*Seismic Toss and Night Shade ignore stats entirely*

| entry | appearances | parameter |
|---|---|---|
| Night Shade | 22 | damage:level |

Total tagged: **2**  ·  1 legal but unused  ·  share: **0.0%**

## `swapsDefences` — Def and SpD are exchanged, field-wide  **← NOT READ**

*Wonder Room. Every stored damage number is wrong while it is up*

| entry | appearances | parameter |
|---|---|---|
| Wonder Room | 2 | swaps:true |

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

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,362 | status:true |
| Tailwind | 6,981 | status:true |
| Parting Shot | 4,782 | status:true |
| Trick Room | 4,415 | status:true |
| Rage Powder | 3,851 | status:true |
| Encore | 2,758 | status:true |
| Light Screen | 2,346 | status:true |
| Wide Guard | 2,065 | status:true |
| Helping Hand | 2,027 | status:true |
| Reflect | 1,988 | status:true |
| Nasty Plot | 1,763 | status:true |
| Life Dew | 1,683 | status:true |
| Roost | 1,353 | status:true |
| Swords Dance | 1,195 | status:true |
| Calm Mind | 1,163 | status:true |
| Detect | 1,162 | status:true |
| Will-O-Wisp | 1,101 | status:true |
| Follow Me | 933 | status:true |
| Taunt | 867 | status:true |
| Aurora Veil | 853 | status:true |
| Sleep Powder | 734 | status:true |
| Rain Dance | 701 | status:true |
| Charm | 691 | status:true |
| Bulk Up | 561 | status:true |
| Perish Song | 560 | status:true |
| Yawn | 536 | status:true |
| Coaching | 525 | status:true |
| Strength Sap | 518 | status:true |
| Toxic | 480 | status:true |
| Baneful Bunker | 436 | status:true |
| Disable | 414 | status:true |
| Spiky Shield | 401 | status:true |
| Sunny Day | 376 | status:true |
| Haze | 359 | status:true |
| Quick Guard | 356 | status:true |
| Fake Tears | 345 | status:true |
| Dragon Dance | 343 | status:true |
| Coil | 301 | status:true |
| Recover | 300 | status:true |
| Thunder Wave | 284 | status:true |
| *…106 more* | | |

Total tagged: **175**  ·  29 legal but unused  ·  share: **16.4%**

## `neverMisses` — P(hit) = 1

*Aerial Ace, Swift, Flower Trick, Aura Sphere, Magical Leaf. The accuracy feature and the kill probability both scale by P(hit), so a move that CANNOT miss must not be discounted like one that can*

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,362 | pHit:1 |
| Tailwind | 6,981 | pHit:1 |
| Trick Room | 4,415 | pHit:1 |
| Rage Powder | 3,851 | pHit:1 |
| Kowtow Cleave | 2,970 | pHit:1 |
| Light Screen | 2,346 | pHit:1 |
| Wide Guard | 2,065 | pHit:1 |
| Helping Hand | 2,027 | pHit:1 |
| Reflect | 1,988 | pHit:1 |
| Nasty Plot | 1,763 | pHit:1 |
| Life Dew | 1,683 | pHit:1 |
| Roost | 1,353 | pHit:1 |
| Swords Dance | 1,195 | pHit:1 |
| Calm Mind | 1,163 | pHit:1 |
| Detect | 1,162 | pHit:1 |
| Follow Me | 933 | pHit:1 |
| Aurora Veil | 853 | pHit:1 |
| Rain Dance | 701 | pHit:1 |
| Aura Sphere | 672 | pHit:1 |
| Bulk Up | 561 | pHit:1 |
| Perish Song | 560 | pHit:1 |
| Yawn | 536 | pHit:1 |
| Coaching | 525 | pHit:1 |
| Baneful Bunker | 436 | pHit:1 |
| Spiky Shield | 401 | pHit:1 |
| Sunny Day | 376 | pHit:1 |
| Haze | 359 | pHit:1 |
| Quick Guard | 356 | pHit:1 |
| Dragon Dance | 343 | pHit:1 |
| Coil | 301 | pHit:1 |
| Recover | 300 | pHit:1 |
| Roar | 281 | pHit:1 |
| Shell Smash | 248 | pHit:1 |
| Substitute | 234 | pHit:1 |
| Clangorous Soul | 189 | pHit:1 |
| Imprison | 158 | pHit:1 |
| Iron Defense | 146 | pHit:1 |
| King's Shield | 127 | pHit:1 |
| Flower Trick | 124 | pHit:1 |
| After You | 104 | pHit:1 |
| *…68 more* | | |

Total tagged: **132**  ·  24 legal but unused  ·  share: **14.6%**

## `priority` — order = priority

*who moves first, before speed is consulted at all*

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,362 | priority:4 |
| Fake Out | 7,846 | priority:3 |
| Trick Room | 4,415 | priority:-7 |
| Sucker Punch | 3,909 | priority:1 |
| Rage Powder | 3,851 | priority:2 |
| Aqua Jet | 3,034 | priority:1 |
| Wide Guard | 2,065 | priority:3 |
| Helping Hand | 2,027 | priority:5 |
| Quick Attack | 1,199 | priority:1 |
| Detect | 1,162 | priority:4 |
| Follow Me | 933 | priority:2 |
| Bullet Punch | 565 | priority:1 |
| Extreme Speed | 449 | priority:2 |
| Baneful Bunker | 436 | priority:4 |
| Spiky Shield | 401 | priority:4 |
| Quick Guard | 356 | priority:3 |
| Ice Shard | 354 | priority:1 |
| Shadow Sneak | 345 | priority:1 |
| Roar | 281 | priority:-6 |
| Accelerock | 241 | priority:1 |
| Feint | 222 | priority:2 |
| Vacuum Wave | 135 | priority:1 |
| King's Shield | 127 | priority:4 |
| Jet Punch | 90 | priority:1 |
| Ally Switch | 76 | priority:2 |
| Upper Hand | 56 | priority:3 |
| Baby-Doll Eyes | 50 | priority:1 |
| Dragon Tail | 48 | priority:-6 |
| Mach Punch | 36 | priority:1 |
| Water Shuriken | 16 | priority:1 |
| Mirror Coat | 12 | priority:-5 |
| Whirlwind | 12 | priority:-6 |
| Counter | 7 | priority:-5 |
| Avalanche | 6 | priority:-4 |
| Focus Punch | 6 | priority:-3 |
| First Impression | 3 | priority:2 |
| Endure | 3 | priority:4 |
| Beak Blast | 2 | priority:-3 |

Total tagged: **39**  ·  1 legal but unused  ·  share: **12.7%**

## `contact` — triggers contact punishment on the defender

*Rocky Helmet, Rough Skin, Iron Barbs, Static, Flame Body all cost you for touching*

| entry | appearances | parameter |
|---|---|---|
| Fake Out | 7,846 | contact:true |
| Close Combat | 5,487 | contact:true |
| Iron Head | 4,314 | contact:true |
| Wave Crash | 4,052 | contact:true |
| Flare Blitz | 4,032 | contact:true |
| Sucker Punch | 3,909 | contact:true |
| Dragon Claw | 3,864 | contact:true |
| Aqua Jet | 3,034 | contact:true |
| Kowtow Cleave | 2,970 | contact:true |
| Brave Bird | 2,279 | contact:true |
| Stomping Tantrum | 2,122 | contact:true |
| Low Kick | 1,854 | contact:true |
| Throat Chop | 1,768 | contact:true |
| Flip Turn | 1,762 | contact:true |
| Dual Wingbeat | 1,724 | contact:true |
| Knock Off | 1,640 | contact:true |
| Dire Claw | 1,509 | contact:true |
| Ice Punch | 1,421 | contact:true |
| Psychic Fangs | 1,352 | contact:true |
| High Horsepower | 1,286 | contact:true |
| Darkest Lariat | 1,232 | contact:true |
| Quick Attack | 1,199 | contact:true |
| Spirit Break | 1,115 | contact:true |
| Play Rough | 911 | contact:true |
| Poison Jab | 758 | contact:true |
| U-turn | 741 | contact:true |
| Drain Punch | 705 | contact:true |
| Bullet Punch | 565 | contact:true |
| Foul Play | 563 | contact:true |
| Body Press | 562 | contact:true |
| Liquidation | 552 | contact:true |
| Extreme Speed | 449 | contact:true |
| Draining Kiss | 434 | contact:true |
| Infestation | 434 | contact:true |
| Super Fang | 434 | contact:true |
| Ice Fang | 433 | contact:true |
| Rage Fist | 363 | contact:true |
| Shadow Sneak | 345 | contact:true |
| Triple Axel | 326 | contact:true |
| Meteor Mash | 315 | contact:true |
| *…101 more* | | |

Total tagged: **166**  ·  25 legal but unused  ·  share: **12.4%**

## `stalling` — is a Protect-family move

*protectThreatened and deadStall both hang off it*

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,362 | stalling:true |
| Detect | 1,162 | stalling:true |
| Baneful Bunker | 436 | stalling:true |
| Spiky Shield | 401 | stalling:true |
| King's Shield | 127 | stalling:true |
| Endure | 3 | stalling:true |

Total tagged: **6**  ·  share: **7.4%**

## `spreadFoes` — x0.75, hits BOTH ENEMIES, ally is safe

*Heat Wave, Hyper Voice, Dazzling Gleam, Blizzard, Make It Rain. Free to click beside a partner*

| entry | appearances | parameter |
|---|---|---|
| Rock Slide | 6,915 | target:allAdjacentFoes,hitsAlly:false |
| Heat Wave | 4,031 | target:allAdjacentFoes,hitsAlly:false |
| Matcha Gotcha | 3,392 | target:allAdjacentFoes,hitsAlly:false |
| Hyper Voice | 2,461 | target:allAdjacentFoes,hitsAlly:false |
| Dazzling Gleam | 1,999 | target:allAdjacentFoes,hitsAlly:false |
| Blizzard | 1,532 | target:allAdjacentFoes,hitsAlly:false |
| Make It Rain | 1,420 | target:allAdjacentFoes,hitsAlly:false |
| Icy Wind | 845 | target:allAdjacentFoes,hitsAlly:false |
| Snarl | 569 | target:allAdjacentFoes,hitsAlly:false |
| Eruption | 565 | target:allAdjacentFoes,hitsAlly:false |
| Muddy Water | 469 | target:allAdjacentFoes,hitsAlly:false |
| Electroweb | 343 | target:allAdjacentFoes,hitsAlly:false |
| Water Spout | 342 | target:allAdjacentFoes,hitsAlly:false |
| Clanging Scales | 302 | target:allAdjacentFoes,hitsAlly:false |
| Breaking Swipe | 70 | target:allAdjacentFoes,hitsAlly:false |
| Burning Jealousy | 32 | target:allAdjacentFoes,hitsAlly:false |
| Struggle Bug | 30 | target:allAdjacentFoes,hitsAlly:false |
| Mortal Spin | 21 | target:allAdjacentFoes,hitsAlly:false |
| Cotton Spore | 20 | target:allAdjacentFoes,hitsAlly:false |
| String Shot | 13 | target:allAdjacentFoes,hitsAlly:false |
| Sweet Scent | 1 | target:allAdjacentFoes,hitsAlly:false |

Total tagged: **22**  ·  1 legal but unused  ·  share: **4.1%**

## `flinches` — P(flinch), 10% to 100%, and only if I move first

*Fake Out 100% at +3, Rock Slide 30%, Iron Head 20%, the fangs 10%. Blocked by Covert Cloak and Inner Focus, neither of which is checked*

| entry | appearances | parameter |
|---|---|---|
| Fake Out | 7,846 | pFlinch:1 |
| Rock Slide | 6,915 | pFlinch:0.3 |
| Iron Head | 4,314 | pFlinch:0.2 |
| Dark Pulse | 1,013 | pFlinch:0.2 |
| Ice Fang | 433 | pFlinch:0.1 |
| Waterfall | 212 | pFlinch:0.2 |
| Icicle Crash | 184 | pFlinch:0.3 |
| Air Slash | 135 | pFlinch:0.3 |
| Zen Headbutt | 59 | pFlinch:0.2 |
| Upper Hand | 56 | pFlinch:1 |
| Triple Arrows | 49 | pFlinch:0.3 |
| Extrasensory | 39 | pFlinch:0.1 |
| Bite | 22 | pFlinch:0.3 |
| Dragon Rush | 16 | pFlinch:0.2 |
| Fire Fang | 9 | pFlinch:0.1 |
| Mountain Gale | 6 | pFlinch:0.3 |
| Thunder Fang | 6 | pFlinch:0.1 |

Total tagged: **19**  ·  2 legal but unused  ·  share: **3.5%**

## `boostsUser` — WHICH stat stages, on self, not just that there are some

*movesBoostMe is only a sign. +Spe flips the speed order, +Atk changes damage, +Def changes survival -- three different values reading as one number today*

| entry | appearances | parameter |
|---|---|---|
| Close Combat | 5,487 | boosts:{def:-1,spd:-1},raisesSpeed:false |
| Nasty Plot | 1,763 | boosts:{spa:2},raisesSpeed:false |
| Make It Rain | 1,420 | boosts:{spa:-2},raisesSpeed:false |
| Draco Meteor | 1,199 | boosts:{spa:-2},raisesSpeed:false |
| Swords Dance | 1,195 | boosts:{atk:2},raisesSpeed:false |
| Calm Mind | 1,163 | boosts:{spa:1,spd:1},raisesSpeed:false |
| Overheat | 771 | boosts:{spa:-2},raisesSpeed:false |
| Bulk Up | 561 | boosts:{atk:1,def:1},raisesSpeed:false |
| Dragon Dance | 343 | boosts:{atk:1,spe:1},raisesSpeed:true |
| Leaf Storm | 337 | boosts:{spa:-2},raisesSpeed:false |
| Coil | 301 | boosts:{atk:1,def:1,accuracy:1},raisesSpeed:false |
| Shell Smash | 248 | boosts:{def:-1,spd:-1,atk:2,spa:2,spe:2},raisesSpeed:true |
| Clangorous Soul | 189 | boosts:{atk:1,def:1,spa:1,spd:1,spe:1},raisesSpeed:true |
| Superpower | 182 | boosts:{atk:-1,def:-1},raisesSpeed:false |
| Iron Defense | 146 | boosts:{def:2},raisesSpeed:false |
| Hammer Arm | 106 | boosts:{spe:-1},raisesSpeed:true |
| Quiver Dance | 58 | boosts:{spa:1,spd:1,spe:1},raisesSpeed:true |
| No Retreat | 43 | boosts:{atk:1,def:1,spa:1,spd:1,spe:1},raisesSpeed:true |
| Armor Cannon | 31 | boosts:{def:-1,spd:-1},raisesSpeed:false |
| Ice Hammer | 31 | boosts:{spe:-1},raisesSpeed:true |
| Headlong Rush | 26 | boosts:{def:-1,spd:-1},raisesSpeed:false |
| Shelter | 18 | boosts:{def:2},raisesSpeed:false |
| Cosmic Power | 15 | boosts:{def:1,spd:1},raisesSpeed:false |
| Minimize | 14 | boosts:{evasion:2},raisesSpeed:false |
| Acid Armor | 13 | boosts:{def:2},raisesSpeed:false |
| Agility | 10 | boosts:{spe:2},raisesSpeed:true |
| Cotton Guard | 9 | boosts:{def:3},raisesSpeed:false |
| Growth | 4 | boosts:{atk:1,spa:1},raisesSpeed:false |
| Amnesia | 4 | boosts:{spd:2},raisesSpeed:false |
| Charge | 1 | boosts:{spd:1},raisesSpeed:false |

Total tagged: **32**  ·  2 legal but unused  ·  share: **2.6%**

## `inflictsBurn` — P(burn): x0.5 physical damage on them, plus chip

*Will-O-Wisp as the move, Flare Blitz and Matcha Gotcha as a secondary. Halving their physical output is a damage parameter, not a status footnote*

| entry | appearances | parameter |
|---|---|---|
| Flare Blitz | 4,032 | p:0.1,via:secondary |
| Heat Wave | 4,031 | p:0.1,via:secondary |
| Matcha Gotcha | 3,392 | p:0.2,via:secondary |
| Will-O-Wisp | 1,101 | p:0.85,via:primary |
| Scald | 601 | p:0.3,via:secondary |
| Flamethrower | 494 | p:0.1,via:secondary |
| Blaze Kick | 87 | p:0.1,via:secondary |
| Scorching Sands | 87 | p:0.3,via:secondary |
| Fire Punch | 45 | p:0.1,via:secondary |
| Fire Blast | 25 | p:0.1,via:secondary |
| Infernal Parade | 15 | p:0.3,via:secondary |
| Fire Fang | 9 | p:0.1,via:secondary |
| Beak Blast | 2 | p:1,via:contact with the shield |
| Lava Plume | 1 | p:0.3,via:secondary |

Total tagged: **15**  ·  1 legal but unused  ·  share: **2.3%**

## `recoil` — the user pays a FRACTION of the damage dealt

*Head Smash 1/2, Flare Blitz and Wave Crash 33/100 at ~4,000 uses each, Wild Charge 1/4. A cost nothing prices*

| entry | appearances | parameter |
|---|---|---|
| Wave Crash | 4,052 | fraction:0.33 |
| Flare Blitz | 4,032 | fraction:0.33 |
| Brave Bird | 2,279 | fraction:0.33 |
| Light of Ruin | 713 | fraction:0.5 |
| Head Smash | 183 | fraction:0.5 |
| Double-Edge | 164 | fraction:0.33 |
| Volt Tackle | 145 | fraction:0.33 |
| Wild Charge | 58 | fraction:0.25 |
| Steel Beam | 27 | fraction:0.5,of:maxhp |
| Wood Hammer | 24 | fraction:0.33 |

Total tagged: **11**  ·  1 legal but unused  ·  share: **1.9%**

## `variablePower` — basePower is the calculation itself; dex bp is 0

*Low Kick by weight, Gyro Ball by speed ratio, Grass Knot. dex basePower is 0, so board.js returns null and scores them as NON-DAMAGING -- 1.27% of move slots doing zero*

| entry | appearances | parameter |
|---|---|---|
| Last Respects | 3,009 | computed:true |
| Stomping Tantrum | 2,122 | computed:true |
| Low Kick | 1,854 | computed:true |
| Eruption | 565 | computed:true |
| Rage Fist | 363 | computed:true |
| Water Spout | 342 | computed:true |
| Triple Axel | 326 | computed:true |
| Grass Knot | 242 | computed:true |
| Beat Up | 223 | computed:true |
| Heavy Slam | 119 | computed:true |
| Acrobatics | 92 | computed:true |
| Rising Voltage | 90 | computed:true |
| Hex | 63 | computed:true |
| Round | 36 | computed:true |
| Temper Flare | 30 | computed:true |
| Assurance | 26 | computed:true |
| Hard Press | 26 | computed:true |
| Gyro Ball | 24 | computed:true |
| Stored Power | 17 | computed:true |
| Water Shuriken | 16 | computed:true |
| Infernal Parade | 15 | computed:true |
| Electro Ball | 7 | computed:true |
| Avalanche | 6 | computed:true |
| Heat Crash | 5 | computed:true |
| Reversal | 4 | computed:true |
| Power Trip | 2 | computed:true |
| Payback | 1 | computed:true |

Total tagged: **29**  ·  2 legal but unused  ·  share: **1.6%**

## `sound` — bypasses Substitute, blocked by Soundproof

*also the trigger for Throat Spray*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,782 | sound:true |
| Hyper Voice | 2,461 | sound:true |
| Snarl | 569 | sound:true |
| Perish Song | 560 | sound:true |
| Clanging Scales | 302 | sound:true |
| Roar | 281 | sound:true |
| Clangorous Soul | 189 | sound:true |
| Psychic Noise | 95 | sound:true |
| Alluring Voice | 86 | sound:true |
| Bug Buzz | 40 | sound:true |
| Round | 36 | sound:true |
| Howl | 26 | sound:true |
| Torch Song | 26 | sound:true |
| Dragon Cheer | 14 | sound:true |
| Boomburst | 11 | sound:true |
| Screech | 3 | sound:true |
| Sparkling Aria | 3 | sound:true |
| Eerie Spell | 1 | sound:true |
| Uproar | 1 | sound:true |

Total tagged: **24**  ·  5 legal but unused  ·  share: **1.5%**

## `doublesSideSpeed` — my whole side moves at x2 speed for the duration

*Tailwind, 6,981 uses. Flips who moves first across every matchup on the field at once, and board.js already derives the speed multiplier -- it just is not scored as a CHOICE*

| entry | appearances | parameter |
|---|---|---|
| Tailwind | 6,981 | speedMult:2 |

Total tagged: **1**  ·  share: **1.1%**

## `lowersTarget` — WHICH stat stages come off the foe, not just that some do

*Charm, Fake Tears, Scary Face, Tickle, Strength Sap. -1 Spe flips the order, -1 Atk halves their physical output. What Clear Amulet and White Herb answer*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,782 | boosts:via onHit,lowersAttack:true |
| Charm | 691 | boosts:{atk:-2},lowersSpeed:false,lowersAttack:true |
| Strength Sap | 518 | boosts:via onHit,lowersAttack:true |
| Fake Tears | 345 | boosts:{spd:-2},lowersSpeed:false,lowersAttack:false |
| Scary Face | 208 | boosts:{spe:-2},lowersSpeed:true,lowersAttack:false |
| Tickle | 177 | boosts:{atk:-1,def:-1},lowersSpeed:false,lowersAttack:true |
| Baby-Doll Eyes | 50 | boosts:{atk:-1},lowersSpeed:false,lowersAttack:true |
| Memento | 31 | boosts:{atk:-2,spa:-2},lowersSpeed:false,lowersAttack:true |
| Cotton Spore | 20 | boosts:{spe:-2},lowersSpeed:true,lowersAttack:false |
| String Shot | 13 | boosts:{spe:-2},lowersSpeed:true,lowersAttack:false |
| Eerie Impulse | 10 | boosts:{spa:-2},lowersSpeed:false,lowersAttack:false |
| Feather Dance | 8 | boosts:{atk:-2},lowersSpeed:false,lowersAttack:true |
| Toxic Thread | 6 | boosts:{spe:-2},lowersSpeed:true,lowersAttack:false |
| Power Swap | 5 | boosts:via onHit,lowersAttack:true |
| Defog | 4 | boosts:via onHit,lowersAttack:false |
| Screech | 3 | boosts:{def:-2},lowersSpeed:false,lowersAttack:false |
| Spicy Extract | 1 | boosts:{atk:2,def:-2},lowersSpeed:false,lowersAttack:false |
| Sweet Scent | 1 | boosts:{evasion:-2},lowersSpeed:false,lowersAttack:false |

Total tagged: **22**  ·  4 legal but unused  ·  share: **1.1%**

## `drain` — heals a fraction of damage dealt

*changes the value of clicking it into a healthy target*

| entry | appearances | parameter |
|---|---|---|
| Matcha Gotcha | 3,392 | drain:[1,2] |
| Giga Drain | 806 | drain:[1,2] |
| Drain Punch | 705 | drain:[1,2] |
| Draining Kiss | 434 | drain:[3,4] |
| Bitter Blade | 211 | drain:[1,2] |
| Leech Life | 92 | drain:[1,2] |
| Parabolic Charge | 70 | drain:[1,2] |
| Horn Leech | 6 | drain:[1,2] |

Total tagged: **8**  ·  share: **0.9%**

## `spreadAll` — x0.75, hits BOTH ENEMIES AND MY PARTNER

*Earthquake, Rock Slide, Discharge, Surf. This is the one allyHit exists for, and the one that killed its own Archaludon*

| entry | appearances | parameter |
|---|---|---|
| Earthquake | 4,533 | target:allAdjacent,hitsAlly:true |
| Discharge | 400 | target:allAdjacent,hitsAlly:true |
| Sludge Wave | 97 | target:allAdjacent,hitsAlly:true |
| Parabolic Charge | 70 | target:allAdjacent,hitsAlly:true |
| Surf | 68 | target:allAdjacent,hitsAlly:true |
| Bulldoze | 17 | target:allAdjacent,hitsAlly:true |
| Petal Blizzard | 12 | target:allAdjacent,hitsAlly:true |
| Boomburst | 11 | target:allAdjacent,hitsAlly:true |
| Explosion | 11 | target:allAdjacent,hitsAlly:true |
| Self-Destruct | 7 | target:allAdjacent,hitsAlly:true |
| Misty Explosion | 3 | target:allAdjacent,hitsAlly:true |
| Sparkling Aria | 3 | target:allAdjacent,hitsAlly:true |
| Brutal Swing | 2 | target:allAdjacent,hitsAlly:true |
| Corrosive Gas | 1 | target:allAdjacent,hitsAlly:true |
| Lava Plume | 1 | target:allAdjacent,hitsAlly:true |

Total tagged: **16**  ·  1 legal but unused  ·  share: **0.9%**

## `halvesDamage` — incoming damage to my side is roughly halved

*Light Screen 2,346, Reflect 1,988, Aurora Veil 853 -- 5,187 uses that currently change NO damage number anywhere in MAG*

| entry | appearances | parameter |
|---|---|---|
| Light Screen | 2,346 | mult:0.5 |
| Reflect | 1,988 | mult:0.5 |
| Aurora Veil | 853 | mult:0.5 |

Total tagged: **3**  ·  share: **0.8%**

## `redirects` — takes the turn's single-target attacks

*Follow Me and Rage Powder. A pair feature in DODUO and nothing in the single-move vector*

| entry | appearances | parameter |
|---|---|---|
| Rage Powder | 3,851 | redirect:true |
| Follow Me | 933 | redirect:true |

Total tagged: **2**  ·  share: **0.8%**

## `powder` — fails into Grass types, Overcoat and Safety Goggles

*this is how Rage Powder is beaten, and redirection is scored as if it always works*

| entry | appearances | parameter |
|---|---|---|
| Rage Powder | 3,851 | powder:true |
| Sleep Powder | 734 | powder:true |
| Cotton Spore | 20 | powder:true |
| Stun Spore | 12 | powder:true |
| Magic Powder | 5 | powder:true |
| Spore | 3 | powder:true |

Total tagged: **7**  ·  1 legal but unused  ·  share: **0.8%**

## `reversesSpeed` — speed order is inverted for the whole field

*Trick Room. MAG set this FOR Will, who had the slowest Pokemon on the field, and was then 4-0ed. It knows the field is ALREADY set (deadField) and cannot ask whether setting it helps*

| entry | appearances | parameter |
|---|---|---|
| Trick Room | 4,415 | reverses:true |

Total tagged: **1**  ·  share: **0.7%**

## `chargeTurn` — costs a turn before it lands

*and the request omits the target field on the locked turn, which already broke the player once*

| entry | appearances | parameter |
|---|---|---|
| Solar Beam | 2,477 | charge:true |
| Electro Shot | 1,667 | charge:true |
| Phantom Force | 201 | charge:true |
| Solar Blade | 8 | charge:true |
| Meteor Beam | 5 | charge:true |
| Dig | 3 | charge:true |

Total tagged: **10**  ·  4 legal but unused  ·  share: **0.7%**

## `inflictsParalysis` — P(paralysis): x0.5 their speed, plus 12.5% lost turns

*Changes who moves first, which most kill features hang off. Champions uses 12.5% full-para, not the 25% everywhere else*

| entry | appearances | parameter |
|---|---|---|
| Thunderbolt | 1,858 | p:0.1,via:secondary |
| Zap Cannon | 1,064 | p:1,via:secondary |
| Discharge | 400 | p:0.3,via:secondary |
| Thunder Wave | 284 | p:0.9,via:primary |
| Thunder Punch | 204 | p:0.1,via:secondary |
| Thunder | 179 | p:0.3,via:secondary |
| Volt Tackle | 145 | p:0.1,via:secondary |
| Nuzzle | 110 | p:1,via:secondary |
| Body Slam | 71 | p:0.3,via:secondary |
| Glare | 20 | p:1,via:primary |
| Stun Spore | 12 | p:0.75,via:primary |
| Thunder Fang | 6 | p:0.1,via:secondary |

Total tagged: **13**  ·  1 legal but unused  ·  share: **0.7%**

## `inflictsPoison` — P(poison): flat 1/8 chip a turn

*Poison Jab (758 uses), Baneful Bunker on contact. Prices the long game, not this turn*

| entry | appearances | parameter |
|---|---|---|
| Sludge Bomb | 1,982 | p:0.3,via:secondary |
| Poison Jab | 758 | p:0.3,via:secondary |
| Baneful Bunker | 436 | p:1,via:contact with the shield |
| Gunk Shot | 223 | p:0.3,via:secondary |
| Sludge Wave | 97 | p:0.1,via:secondary |
| Barb Barrage | 22 | p:0.5,via:secondary |
| Mortal Spin | 21 | p:1,via:secondary |
| Shell Side Arm | 9 | p:0.2,via:secondary |
| Toxic Thread | 6 | p:1,via:primary |
| Cross Poison | 1 | p:0.1,via:secondary |

Total tagged: **11**  ·  1 legal but unused  ·  share: **0.6%**

## `pivotDamaging` — damages, then the user leaves

*U-turn, Flip Turn, Volt Switch. Chip plus momentum, and no switch feature can see either*

| entry | appearances | parameter |
|---|---|---|
| Flip Turn | 1,762 | selfSwitch:true |
| Volt Switch | 986 | selfSwitch:true |
| U-turn | 741 | selfSwitch:true |

Total tagged: **3**  ·  share: **0.6%**

## `locksTarget` — their option set collapses to one specific move, or loses one

*Encore pins them to their last move, Disable removes it, Torment blocks the repeat. stallIntoEncore already prices the Encore case from the RECEIVING end*

| entry | appearances | parameter |
|---|---|---|
| Encore | 2,758 | locks:encore |
| Disable | 414 | locks:disable |
| Torment | 4 | locks:torment |

Total tagged: **3**  ·  share: **0.5%**

## `inflictsStatus` — status := x (any)

*burn halves physical damage, paralysis halves speed -- both are damage/order parameters*

| entry | appearances | parameter |
|---|---|---|
| Will-O-Wisp | 1,101 | status:brn |
| Sleep Powder | 734 | status:slp |
| Toxic | 480 | status:tox |
| Thunder Wave | 284 | status:par |
| Hypnosis | 273 | status:slp |
| Glare | 20 | status:par |
| Stun Spore | 12 | status:par |
| Toxic Thread | 6 | status:psn |
| Spore | 3 | status:slp |

Total tagged: **11**  ·  2 legal but unused  ·  share: **0.5%**

## `oneTurnGuard` — blocks ONE NAMED CLASS of move, for one turn, for my whole side

*Wide Guard blanks spread (2,065 uses), Quick Guard blanks priority (356) -- including Fake Out at 7,846 uses. Different threats, and nothing scores either*

| entry | appearances | parameter |
|---|---|---|
| Wide Guard | 2,065 | blocks:spread moves |
| Quick Guard | 356 | blocks:priority moves |

Total tagged: **2**  ·  share: **0.4%**

## `healsAlly` — restores my PARTNER max-HP share

*Heal Pulse, Life Dew, Floral Healing. Already a pair feature in DODUO and nothing in the single-move vector*

| entry | appearances | parameter |
|---|---|---|
| Life Dew | 1,683 | heal:[1,4] |
| Strength Sap | 518 | heal:true |
| Heal Pulse | 62 | heal:true |

Total tagged: **3**  ·  share: **0.4%**

## `setsWeather` — weather := x

*and whether that weather HELPS is the thing nothing currently asks (task #19)*

| entry | appearances | parameter |
|---|---|---|
| Rain Dance | 701 | weather:RainDance |
| Sunny Day | 376 | weather:sunnyday |
| Chilly Reception | 17 | weather:snowscape |
| Sandstorm | 4 | weather:Sandstorm |
| Snowscape | 3 | weather:snowscape |

Total tagged: **5**  ·  share: **0.2%**

## `recharge` — costs the turn AFTER it lands

*Hyper Beam. A free turn for the opponent*

| entry | appearances | parameter |
|---|---|---|
| Hyper Beam | 1,012 | recharge:true |
| Giga Impact | 20 | recharge:true |
| Hydro Cannon | 16 | recharge:true |
| Blast Burn | 3 | recharge:true |

Total tagged: **6**  ·  2 legal but unused  ·  share: **0.2%**

## `inflictsSleep` — P(sleep): they lose turns outright

*The most valuable status in the game and the one Electric Terrain blanks*

| entry | appearances | parameter |
|---|---|---|
| Sleep Powder | 734 | p:0.75,via:primary |
| Hypnosis | 273 | p:0.6,via:primary |
| Spore | 3 | p:1,via:primary |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.2%**

## `forbidsStatusMoves` — the whole Status CATEGORY becomes unclickable for them

*Taunt. Deletes every Protect, setup move and Tailwind at once -- 38.5% of their move slots by share. Same restriction Assault Vest applies to its own holder*

| entry | appearances | parameter |
|---|---|---|
| Taunt | 867 | forbids:Status |

Total tagged: **1**  ·  share: **0.1%**

## `inflictsToxic` — P(badly poisoned): n/16 ESCALATING, not a flat 1/8

*Toxic, 480 uses. By turn six it is doing more than triple what regular poison does, so it is a different clock entirely*

| entry | appearances | parameter |
|---|---|---|
| Toxic | 480 | p:0.9,via:primary |
| Poison Fang | 5 | p:0.5,via:secondary |

Total tagged: **2**  ·  share: **0.1%**

## `substitute` — an HP buffer that absorbs hits and blanks status until it breaks

*Its own class. Sound moves go through it, and the damage needed to break it is a real number the kill calculation would have to clear first*

| entry | appearances | parameter |
|---|---|---|
| Substitute | 234 | buffer:0.25 |
| Shed Tail | 41 | buffer:0.25 |

Total tagged: **2**  ·  share: **0.0%**

## `userFaints` — the user dies as the cost

*Memento, Explosion, Final Gambit, Healing Wish. Final Gambit is 176 uses and deals damage equal to the user remaining HP, which the damage engine reads as ZERO*

| entry | appearances | parameter |
|---|---|---|
| Final Gambit | 176 | faints:ifHit |
| Memento | 31 | faints:ifHit |
| Explosion | 11 | faints:always |
| Self-Destruct | 7 | faints:always |
| Healing Wish | 4 | faints:ifHit |
| Misty Explosion | 3 | faints:always |

Total tagged: **6**  ·  share: **0.0%**

## `setsTerrain` — terrain := x, with a second effect beyond the type boost

*Psychic Terrain blanks priority field-wide (Fake Out is 7,846 uses and nothing checks), Electric blocks sleep, Misty blocks all status, Grassy heals 1/16 a turn*

| entry | appearances | parameter |
|---|---|---|
| Psychic Terrain | 50 | terrain:psychicterrain |
| Electric Terrain | 11 | terrain:electricterrain |
| Grassy Terrain | 5 | terrain:grassyterrain |
| Misty Terrain | 5 | terrain:mistyterrain |

Total tagged: **4**  ·  share: **0.0%**

## `sideBuff` — another multi-turn modifier on my side

*Safeguard, Mist -- what is left once Tailwind and the screens are split out*

| entry | appearances | parameter |
|---|---|---|
| Safeguard | 6 | sideCondition:safeguard |

Total tagged: **1**  ·  share: **0.0%**

## `setsRoom` — another pseudo-weather

*whatever is left after Trick Room, Wonder Room, Magic Room and Gravity are split out*

*Nothing carrying this tag appears on any real team.*

Total tagged: **1**  ·  1 legal but unused  ·  share: **0.0%**

---

# ITEMS

## `resistBerry` — halves one super-effective hit, then is gone  **← NOT READ**

*Chople, Colbur, Kasib, Occa. About 6.8% of held items and it turns kills into non-kills*

| entry | appearances | parameter |
|---|---|---|
| Chople Berry | 1,432 | halves:true |
| Colbur Berry | 1,234 | halves:true |
| Kasib Berry | 1,101 | halves:true |
| Occa Berry | 635 | halves:true |
| Roseli Berry | 510 | halves:true |
| Passho Berry | 484 | halves:true |
| Coba Berry | 399 | halves:true |
| Shuca Berry | 262 | halves:true |
| Haban Berry | 112 | halves:true |
| Babiri Berry | 70 | halves:true |
| Yache Berry | 46 | halves:true |
| Kebia Berry | 38 | halves:true |
| Wacan Berry | 36 | halves:true |
| Charti Berry | 31 | halves:true |
| Rindo Berry | 23 | halves:true |
| Payapa Berry | 6 | halves:true |

Total tagged: **18**  ·  2 legal but unused  ·  share: **9.5%**

## `damageMultType` — x1.2 on one type  **← NOT READ**

*Charcoal, Black Glasses, Mystic Water, Fairy Feather. About 6.7% of held items and a pure calculation error*

| entry | appearances | parameter |
|---|---|---|
| Fairy Feather | 1,502 | mult:1.2 |
| Black Glasses | 1,319 | mult:1.2 |
| Mystic Water | 864 | mult:1.2 |
| Charcoal | 689 | mult:1.2 |
| Never-Melt Ice | 386 | mult:1.2 |
| Sharp Beak | 294 | mult:1.2 |
| Metal Coat | 212 | mult:1.2 |
| Dragon Fang | 116 | mult:1.2 |
| Silk Scarf | 100 | mult:1.2 |
| Spell Tag | 79 | mult:1.2 |
| Magnet | 77 | mult:1.2 |
| Soft Sand | 75 | mult:1.2 |
| Miracle Seed | 48 | mult:1.2 |
| Black Belt | 36 | mult:1.2 |
| Twisted Spoon | 24 | mult:1.2 |
| Hard Stone | 23 | mult:1.2 |
| Poison Barb | 6 | mult:1.2 |
| Silver Powder | 2 | mult:1.2 |

Total tagged: **18**  ·  share: **8.6%**

## `extendsScreens` — side conditions last 8 turns not 5  **← NOT READ**

*3.1% of items*

| entry | appearances | parameter |
|---|---|---|
| Light Clay | 2,007 | turns:8 |

Total tagged: **1**  ·  share: **3.0%**

## `restoresStats` — undoes stat drops once  **← NOT READ**

*2.1% of items, and it changes what a drop is worth*

| entry | appearances | parameter |
|---|---|---|
| White Herb | 1,358 | restores:true |

Total tagged: **1**  ·  share: **2.0%**

## `accuracyMod` — P(hit) is scaled, for or against the holder  **← NOT READ**

*Bright Powder makes attacks against the holder 0.9x; Wide Lens (411 uses) makes the holder 1.1x. Feeds the same P(hit) the kill distribution consumes*

| entry | appearances | parameter |
|---|---|---|
| Wide Lens | 411 | accuracy:true |
| Bright Powder | 142 | accuracy:true |
| Zoom Lens | 22 | accuracy:true |

Total tagged: **3**  ·  share: **0.8%**

## `curesStatus` — a status is removed the moment it lands  **← NOT READ**

*Lum (107 uses), Chesto, Rawst. Every status move aimed at the holder is a wasted turn, and inflictsStatus has no idea*

| entry | appearances | parameter |
|---|---|---|
| Lum Berry | 107 | cures:true |
| Chesto Berry | 24 | cures:true |
| Rawst Berry | 2 | cures:true |

Total tagged: **6**  ·  3 legal but unused  ·  share: **0.2%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*Scope Lens (Will spotted this one missing). Rare at 0.11% of items, but it sets a parameter the distribution already needs for Flower Trick, so it costs nothing to support. NOTE the ratio is a STAGE feeding P(crit); the crit damage multiplier is always x1.5 and nothing here changes it -- do not read critRatio: 2 as double damage*

| entry | appearances | parameter |
|---|---|---|
| Scope Lens | 69 | critRatio:2 |

Total tagged: **1**  ·  share: **0.1%**

## `addsFlinch` — P(flinch) += 10% on moves that do not already flinch  **← NOT READ**

*King's Rock and Razor Fang. Sets the same parameter the move-side flinch tag does, which is exactly what a parameter taxonomy is for. Derived from an onModifyMove that mentions flinch, not from the names*

| entry | appearances | parameter |
|---|---|---|
| King's Rock | 49 | pFlinch:0.1 |

Total tagged: **1**  ·  share: **0.1%**

## `fractionalPriority` — a CHANCE to move first inside the priority bracket  **← NOT READ**

*Quick Claw, 20% of turns. Speed order is what most kill features hang off, and this makes it probabilistic rather than determined*

| entry | appearances | parameter |
|---|---|---|
| Quick Claw | 39 | chance:0.2 |

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

| entry | appearances | parameter |
|---|---|---|
| Charizardite Y | 2,200 | into:{Charizard:Charizard-Mega-Y} |
| Staraptite | 1,938 | into:{Staraptor:Staraptor-Mega} |
| Floettite | 1,439 | into:{Floette-Eternal:Floette-Mega} |
| Swampertite | 1,345 | into:{Swampert:Swampert-Mega} |
| Metagrossite | 1,186 | into:{Metagross:Metagross-Mega} |
| Raichunite Y | 1,063 | into:{Raichu:Raichu-Mega-Y} |
| Aerodactylite | 844 | into:{Aerodactyl:Aerodactyl-Mega} |
| Delphoxite | 760 | into:{Delphox:Delphox-Mega} |
| Mawilite | 677 | into:{Mawile:Mawile-Mega} |
| Tyranitarite | 633 | into:{Tyranitar:Tyranitar-Mega} |
| Froslassite | 544 | into:{Froslass:Froslass-Mega} |
| Gengarite | 446 | into:{Gengar:Gengar-Mega} |
| Venusaurite | 401 | into:{Venusaur:Venusaur-Mega} |
| Blastoisinite | 351 | into:{Blastoise:Blastoise-Mega} |
| Dragoninite | 284 | into:{Dragonite:Dragonite-Mega} |
| Scovillainite | 281 | into:{Scovillain:Scovillain-Mega} |
| Blazikenite | 277 | into:{Blaziken:Blaziken-Mega} |
| Eelektrossite | 258 | into:{Eelektross:Eelektross-Mega} |
| Scraftinite | 244 | into:{Scrafty:Scrafty-Mega} |
| Raichunite X | 216 | into:{Raichu:Raichu-Mega-X} |
| Sceptilite | 194 | into:{Sceptile:Sceptile-Mega} |
| Cameruptite | 193 | into:{Camerupt:Camerupt-Mega} |
| Gardevoirite | 190 | into:{Gardevoir:Gardevoir-Mega} |
| Pyroarite | 188 | into:{Pyroar:Pyroar-Mega} |
| Glimmoranite | 159 | into:{Glimmora:Glimmora-Mega} |
| Dragalgite | 145 | into:{Dragalge:Dragalge-Mega} |
| Meganiumite | 138 | into:{Meganium:Meganium-Mega} |
| Kangaskhanite | 131 | into:{Kangaskhan:Kangaskhan-Mega} |
| Malamarite | 90 | into:{Malamar:Malamar-Mega} |
| Garchompite | 85 | into:{Garchomp:Garchomp-Mega} |
| Lopunnite | 74 | into:{Lopunny:Lopunny-Mega} |
| Lucarionite | 72 | into:{Lucario:Lucario-Mega} |
| Gyaradosite | 69 | into:{Gyarados:Gyarados-Mega} |
| Charizardite X | 64 | into:{Charizard:Charizard-Mega-X} |
| Scizorite | 63 | into:{Scizor:Scizor-Mega} |
| Greninjite | 59 | into:{Greninja:Greninja-Mega} |
| Starminite | 56 | into:{Starmie:Starmie-Mega} |
| Clefablite | 53 | into:{Clefable:Clefable-Mega} |
| Excadrite | 53 | into:{Excadrill:Excadrill-Mega} |
| Drampanite | 51 | into:{Drampa:Drampa-Mega} |
| *…35 more* | | |

Total tagged: **75**  ·  share: **27.0%**

## `survivesFromFull` — a lethal hit from full HP leaves 1

*Focus Sash, the most-held item in the format. Broken by multi-hit moves and by any prior chip*

| entry | appearances | parameter |
|---|---|---|
| Focus Sash | 7,610 | survives:true |

Total tagged: **1**  ·  share: **11.2%**

## `healsAtHalf` — restores 25% when it drops below half

*Sitrus, 10.8% of items. Modelled in the rollout engine only, invisible to MAG*

| entry | appearances | parameter |
|---|---|---|
| Sitrus Berry | 7,043 | heal:0.25 |

Total tagged: **2**  ·  1 legal but unused  ·  share: **10.4%**

## `damageMultAll` — x damage on everything

*Life Orb 1.3, at a cost this does not model*

| entry | appearances | parameter |
|---|---|---|
| Life Orb | 6,223 | mult:1.3 |

Total tagged: **1**  ·  share: **9.2%**

## `passiveHeal` — restores HP every turn

*changes how many turns a kill takes*

| entry | appearances | parameter |
|---|---|---|
| Leftovers | 4,289 | heal:0.0625 |

Total tagged: **1**  ·  share: **6.3%**

## `choiceLock` — the holder is locked into one move

*the single strongest thing an open sheet tells you about what they can do next turn*

| entry | appearances | parameter |
|---|---|---|
| Choice Scarf | 3,907 | choice:true |

Total tagged: **1**  ·  share: **5.8%**

## `speedMult` — speed x1.5

*order, which most kill features hang off*

| entry | appearances | parameter |
|---|---|---|
| Choice Scarf | 3,907 | mult:1.5 |

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

| entry | appearances | parameter |
|---|---|---|
| Rough Skin | 3,739 | profits:true |
| Stamina | 1,631 | profits:true |
| Cursed Body | 833 | profits:true |
| Toxic Debris | 411 | profits:true |
| Static | 276 | profits:true |
| Flame Body | 113 | profits:true |
| Illusion | 62 | profits:true |
| Poison Point | 50 | profits:true |
| Cute Charm | 48 | profits:true |
| Electromorphosis | 48 | profits:true |
| Justified | 29 | profits:true |
| Wandering Spirit | 21 | profits:true |
| Effect Spore | 20 | profits:true |
| Mummy | 16 | profits:true |
| Gooey | 10 | profits:true |
| Weak Armor | 9 | profits:true |
| Sand Spit | 4 | profits:true |

Total tagged: **32**  ·  15 legal but unused  ·  share: **15.4%**

## `weatherSetter` — weather := x on switch-in  **← NOT READ**

*and megaing can COST you it, which is Will's reason to decline a mega*

| entry | appearances | parameter |
|---|---|---|
| Drizzle | 2,197 | sets:true |
| Snow Warning | 943 | sets:true |
| Sand Stream | 838 | sets:true |
| Drought | 615 | sets:true |

Total tagged: **8**  ·  4 legal but unused  ·  share: **9.7%**

## `contactPunish` — the ATTACKER pays for touching it  **← NOT READ**

*Rough Skin (3,739), Static, Flame Body, Poison Point, Cute Charm, Effect Spore, Mummy, Gooey. Derived by reading the handler for checkMoveMakesContact*

| entry | appearances | parameter |
|---|---|---|
| Rough Skin | 3,739 | trigger:contact |
| Static | 276 | trigger:contact |
| Flame Body | 113 | trigger:contact |
| Poison Point | 50 | trigger:contact |
| Cute Charm | 48 | trigger:contact |
| Wandering Spirit | 21 | trigger:contact |
| Effect Spore | 20 | trigger:contact |
| Mummy | 16 | trigger:contact |
| Gooey | 10 | trigger:contact |

Total tagged: **14**  ·  5 legal but unused  ·  share: **9.0%**

## `weatherChipImmune` — takes no sandstorm or snow residual damage  **← NOT READ**

*What onImmunity actually means for Sand Veil, Snow Cloak, Overcoat and Magic Guard -- and what typeImmunity was wrongly reporting until Will asked*

| entry | appearances | parameter |
|---|---|---|
| Sand Rush | 488 | chipImmune:true |
| Oblivious | 274 | chipImmune:true |
| Snow Cloak | 219 | chipImmune:true |
| Sand Veil | 135 | chipImmune:true |
| Overcoat | 85 | chipImmune:true |
| Magma Armor | 43 | chipImmune:true |
| Sand Force | 18 | chipImmune:true |
| Ice Body | 6 | chipImmune:true |

Total tagged: **8**  ·  share: **2.7%**

## `disablesAttacker` — the move I just used is removed from MY options  **← NOT READ**

*Cursed Body (833 uses). Not damage and not a stat change -- it shrinks my own option set, the same shape as locksTarget from the receiving end*

| entry | appearances | parameter |
|---|---|---|
| Cursed Body | 833 | disables:true |

Total tagged: **1**  ·  share: **1.8%**

## `accuracyMod` — P(hit) scaled, often gated on a weather or a category  **← NOT READ**

*Sand Veil (135 uses, x1.25 evasion in sand), Snow Cloak (219, in snow), Compound Eyes, Victory Star, Hustle, Wonder Skin, No Guard. Same P(hit) the kill distribution needs*

| entry | appearances | parameter |
|---|---|---|
| Snow Cloak | 219 | accuracy:true |
| Compound Eyes | 208 | accuracy:true |
| Sand Veil | 135 | accuracy:true |
| Hustle | 9 | accuracy:true |
| Tangled Feet | 2 | accuracy:true |

Total tagged: **6**  ·  1 legal but unused  ·  share: **1.2%**

## `statusImmune` — a status cannot land  **← NOT READ**

*Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor. onSetStatus only -- onImmunity also means weather-chip immunity and was over-capturing*

| entry | appearances | parameter |
|---|---|---|
| Leaf Guard | 75 | immune:true |
| Water Bubble | 72 | immune:true |
| Limber | 59 | immune:true |
| Insomnia | 39 | immune:true |
| Purifying Salt | 32 | immune:true |
| Vital Spirit | 3 | immune:true |
| Immunity | 1 | immune:true |

Total tagged: **12**  ·  5 legal but unused  ·  share: **0.6%**

## `survivesFromFull` — a lethal hit from full HP leaves 1  **← NOT READ**

*Sturdy. Identical to Focus Sash and NOT modelled anywhere -- verified 0 mentions*

| entry | appearances | parameter |
|---|---|---|
| Sturdy | 153 | survives:true |

Total tagged: **1**  ·  share: **0.3%**

## `ignoresDefenderAbility` — suppress every defender-side ability tag for this move  **← NOT READ**

*Mold Breaker, Turboblaze, Teravolt. Gates typeImmunity, damageReduce, blocksMove, preventsCrit and Sturdy in one flag*

| entry | appearances | parameter |
|---|---|---|
| Mold Breaker | 127 | ignoresDefAbility:true |

Total tagged: **3**  ·  2 legal but unused  ·  share: **0.3%**

## `preventsCrit` — P(crit) = 0  **← NOT READ**

*Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit*

| entry | appearances | parameter |
|---|---|---|
| Disguise | 62 | pCrit:0 |
| Shell Armor | 24 | pCrit:0 |

Total tagged: **4**  ·  2 legal but unused  ·  share: **0.2%**

## `critDamageUp` — the CRIT MULTIPLIER itself, not its probability  **← NOT READ**

*Sniper (Will raised it). Three separate crit parameters exist and the taxonomy had only two: probability (Scope Lens, Flower Trick), prevention (Shell Armor) and now the multiplier. Crit damage is x1.5 and Sniper makes it x1.5 again, so x2.25 total -- it was x3 in the old gens when crits themselves were x2, which is where the folklore comes from*

| entry | appearances | parameter |
|---|---|---|
| Sniper | 24 | critMult:1.5 |

Total tagged: **1**  ·  share: **0.1%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*Super Luck and Merciless. Same parameter as Scope Lens and Flower Trick*

| entry | appearances | parameter |
|---|---|---|
| Merciless | 3 | critRatio:2 |
| Super Luck | 3 | critRatio:2 |

Total tagged: **2**  ·  share: **0.0%**

## `terrainSetter` — terrain := x on switch-in  **← NOT READ**

*same shape as weather*

| entry | appearances | parameter |
|---|---|---|
| Psychic Surge | 1 | sets:true |

Total tagged: **5**  ·  4 legal but unused  ·  share: **0.0%**

## `preventsSwitch` — the foe cannot leave  **← NOT READ**

*Shadow Tag, Arena Trap, Magnet Pull. Already used by the playstyle classifier*

*Nothing carrying this tag appears on any real team.*

Total tagged: **3**  ·  3 legal but unused  ·  share: **0.0%**

## `damageBoost` — x>1 damage dealt

*Adaptability, Technician, Tinted Lens, Sheer Force, Iron Fist, Strong Jaw*

| entry | appearances | parameter |
|---|---|---|
| Blaze | 2,675 | boost:true |
| Pixilate | 1,426 | boost:true |
| Torrent | 1,086 | boost:true |
| Solar Power | 432 | boost:true |
| Overgrow | 360 | boost:true |
| Technician | 339 | boost:true |
| Tough Claws | 269 | boost:true |
| Sharpness | 154 | boost:true |
| Sheer Force | 94 | boost:true |
| Huge Power | 72 | boost:true |
| Water Bubble | 72 | boost:true |
| Supreme Overlord | 60 | boost:true |
| Iron Fist | 53 | boost:true |
| Swarm | 26 | boost:true |
| Mega Launcher | 20 | boost:true |
| Reckless | 19 | boost:true |
| Sand Force | 18 | boost:true |
| Rivalry | 13 | boost:true |
| Guts | 12 | boost:true |
| Hustle | 9 | boost:true |
| Pure Power | 9 | boost:true |
| Analytic | 7 | boost:true |
| Strong Jaw | 5 | boost:true |
| Minus | 2 | boost:true |
| Plus | 2 | boost:true |
| Refrigerate | 1 | boost:true |

Total tagged: **44**  ·  18 legal but unused  ·  share: **15.2%**

## `onSwitchInDrop` — stat stages on the foe at switch-in

*Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked*

| entry | appearances | parameter |
|---|---|---|
| Intimidate | 6,536 | drop:true |
| Supersweet Syrup | 13 | drop:true |

Total tagged: **3**  ·  1 legal but unused  ·  share: **13.8%**

## `priorityMod` — order shifts for a class of move

*Prankster, Gale Wings, Triage. stallIntoEncore already depends on it*

| entry | appearances | parameter |
|---|---|---|
| Prankster | 4,649 | priority:true |
| Gale Wings | 480 | priority:true |
| Scrappy | 259 | priority:true |
| Stance Change | 146 | priority:true |
| Mold Breaker | 127 | priority:true |
| Sheer Force | 94 | priority:true |
| Infiltrator | 54 | priority:true |
| Illuminate | 27 | priority:true |
| Keen Eye | 27 | priority:true |
| Stalwart | 27 | priority:true |
| Skill Link | 4 | priority:true |
| Long Reach | 2 | priority:true |

Total tagged: **22**  ·  10 legal but unused  ·  share: **12.4%**

## `typeImmunity` — damage of one TYPE := 0

*Levitate, Water Absorb, Flash Fire, Sap Sipper. Clicking into one wastes the turn entirely*

| entry | appearances | parameter |
|---|---|---|
| Levitate | 1,768 | immune:true,via:not derivable -- no handler |
| Lightning Rod | 1,288 | immune:true,via:onTryHit |
| Flash Fire | 357 | immune:true,via:onTryHit |
| Dry Skin | 52 | immune:true,via:onTryHit |
| Volt Absorb | 33 | immune:true,via:onTryHit |
| Earth Eater | 31 | immune:true,via:onTryHit |
| Sap Sipper | 22 | immune:true,via:onTryHit |
| Water Absorb | 15 | immune:true,via:onTryHit |
| Motor Drive | 13 | immune:true,via:onTryHit |

Total tagged: **11**  ·  2 legal but unused  ·  share: **7.5%**

## `speedCond` — speed x2 under a condition

*Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order*

| entry | appearances | parameter |
|---|---|---|
| Chlorophyll | 1,131 | conditional:true |
| Sand Rush | 488 | conditional:true |
| Swift Swim | 321 | conditional:true |
| Surge Surfer | 8 | conditional:true |
| Slush Rush | 4 | conditional:true |
| Quick Feet | 2 | conditional:true |

Total tagged: **7**  ·  1 legal but unused  ·  share: **4.1%**

## `blocksMove` — a whole class of move fails

*already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold*

| entry | appearances | parameter |
|---|---|---|
| Armor Tail | 1,682 | blocks:true |
| Queenly Majesty | 220 | blocks:true |

Total tagged: **3**  ·  1 legal but unused  ·  share: **4.0%**

## `damageReduce` — x<1 damage taken

*Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them*

| entry | appearances | parameter |
|---|---|---|
| Multiscale | 348 | reduce:true |
| Solid Rock | 166 | reduce:true |
| Fluffy | 3 | reduce:true |

Total tagged: **9**  ·  6 legal but unused  ·  share: **1.1%**

## `formeChange` — the species changes mid-battle

*Zero to Hero (needs a switch), Illusion, Imposter, Disguise*

| entry | appearances | parameter |
|---|---|---|
| Zero to Hero | 105 | changes:true |
| Disguise | 62 | changes:true |
| Illusion | 62 | changes:true |
| Imposter | 39 | changes:true |

Total tagged: **7**  ·  3 legal but unused  ·  share: **0.6%**

## `invertsBoosts` — stat changes flip sign

*Contrary and Simple, already probed for expectedBoostSign*

| entry | appearances | parameter |
|---|---|---|
| Contrary | 134 | inverts:true |

Total tagged: **3**  ·  2 legal but unused  ·  share: **0.3%**

## `redirectsType` — draws that type to itself

*Lightning Rod and Storm Drain redirect AND boost*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**
