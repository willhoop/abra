# Tag review — corrected pass

**130 tags.** Usage from **5,440 open-sheet human games** — 65,976 sheet entries, 263,581 move slots.

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
| Tailwind should be its own category | `doublesSideSpeed` — 6,981 uses, and it sets speed order, not damage |
| Aurora Veil with the screens, fails without snow | `halvesDamage` + `failsWithoutWeather` |
| should each major status have its own tag | yes — burn / paralysis / sleep / poison split. Each sets a different parameter |
| Matcha Gotcha and Flare Blitz get one too | right — status now read from **secondaries**, not just the primary |
| Toxic is different from normal poison | split. Flat 1/8 vs **escalating n/16** — a different clock |
| Yawn inflicts drowsy | `delayedSleep` — a volatile, not a status. Forces a switch |
| Perish Song needs its own | `perishClock` — ignores HP, typing, items, abilities |
| Baneful Bunker spreads poison | I had missed it — the poison is in `condition.onHit`. Also catches Spiky Shield chip |
| Strength Sap lowers their Attack too | declared in `onHit`, not `boosts` — now read |
| lowersTarget needs the stat and direction | carries it now, mirroring `boostsUser` |
| Taunt doesn&rsquo;t lock, it prevents status | `forbidsStatusMoves` — the Assault Vest restriction, applied to them |
| Disable is like Cursed Body but for non-attacks | both present — `locksTarget` and `disablesAttacker` |
| Haze clears all stat changes | `clearsBoosts` — 359 uses, and it wipes **yours** too |
| explain oneTurnGuard for Quick Guard | the parameter now names the class: Wide Guard blanks **spread**, Quick Guard blanks **priority** |
| shouldn&rsquo;t Coil get the defense and attack tags | it already did — the **doc** was hiding parameter values. Now shown |
| does the engine know what boostsUser boosts | **it did not.** `movesBoostMe` is only a sign, so Dragon Dance and Swords Dance read identically |
| Quick Claw and Bright Powder | added — `fractionalPriority` and `accuracyMod`, both derived |
| Sand Veil and Bright Powder | found a **mistag** — Sand Veil and Snow Cloak were labelled typeImmunity. They are evasion abilities |
| how do accuracy/evasion stages work | a **different table** — [1, 4/3, 5/3, 2, …] not [1, 1.5, 2, …]. And nothing applies them |
| Life Dew heals self 25% too | you asked for "or BOTH" originally and my split was exclusive. Fixed — 1,683 uses |
| should all the weathers have their own tag | no — what a weather does belongs to the weather, and that table is in the damage engine |
| we need to code in Trick too | item changes now tracked. **Knock Off is 1,640 uses** and the board saw none of it |
| Knock Off breaks Sash from damage anyway | **you were right** — the Sash drag needs full HP. The real cost is a stale Assault Vest or Choice Scarf |
| Knock Off is 1.5x on a held item — a variable move | it uses `onBasePower`, which my probe missed. That gap alone missed **4,351 appearances** |
| almost all Whimsicott are Focus Sash | measured: **78.0%** in our corpus, and the Smogon prior says 78.6%. Which argues against max-bulk as a default |
| what if we just assume max bulk | `ABRA_BULK=max` toggle. Measured gap is ~6% median — about one damage roll |
| will we leave too many kills on the table | on average no. But Whimsicott +25%, Mega Beedrill +31% — the bimodal ones |
| do we need all 16 rolls | yes, and it is easiest. Exactly correct, no floor() inversion edge cases, and free |
| is that gonna butcher calc time | no — damage is **0.03%** of a self-play run. 2.18M calls/sec |
| we don&rsquo;t know EVs so these are guesses | yes — but a weighted distribution of ~6 spreads per species, narrowed by the revealed nature |

## The two gaps this surfaced

**Screens do not affect damage.** board.js derives the screen set correctly, then feeds it to
one consumer — a DODUO joint feature that is switched off. Light Screen 2,346 + Reflect 1,988
+ Aurora Veil 853 = **5,187 uses**, and none of them halve a single damage number.

**Wide Guard exists only in the rollout engine**, behind a hardcoded 35% heuristic. board.js
has nothing. **2,065 uses**.

## 68 of 130 tags are read by nothing

| tag | usage | sets |
|---|---|---|
| `profitsFromHit` | 10.7% | the target gains something for being hit |
| `resistBerry` | 9.5% | halves one super-effective hit, then is gone |
| `damageMultType` | 8.6% | x1.2 on one type |
| `weatherSetter` | 6.7% | weather := x on switch-in |
| `preventsStatDrop` | 6.4% | stat drops simply do not apply |
| `boostsWhenLowered` | 6.4% | +2 to a stat when any stat is lowered |
| `contactPunish` | 6.3% | the ATTACKER pays for touching it |
| `healsAllyOnSwitchIn` | 5.0% | restores the partner on entry |
| `extendsScreens` | 2.9% | side conditions last 8 turns not 5 |
| `blocksStatusMoves` | 2.3% | every Status-category move fails against it |
| `speedOnItemLoss` | 2.1% | speed x2 once its item is gone |
| `restoresStats` | 2.0% | undoes stat drops once |
| `blocksBerries` | 1.9% | their berries cannot be eaten |
| `weatherChipImmune` | 1.9% | takes no sandstorm or snow residual damage |
| `lowersUser` | 1.5% | WHICH of my own stats drop, as the price of the move |
| `needsUntrackedState` | 1.4% | power depends on state the board does not track |
| `weatherScaled` | 1.3% | type, power or target changes with the weather |
| `thawsTarget` | 1.2% | unfreezes the target it hits |
| `disablesAttacker` | 1.2% | the move I just used is removed from MY options |
| `ignoresProtect` | 1.1% | Protect does NOT stop it |
| `accuracyMod` | 0.8% | P(hit) is scaled, for or against the holder |
| `accuracyMod` | 0.8% | P(hit) scaled, often gated on a weather or a category |
| `boostsProcedural` | 0.8% | stat changes exist but are computed, not declared in a field |
| `pivotStatus` | 0.7% | no damage, an effect, then the user leaves |
| `conditionalPower` | 0.6% | fixed power x a multiplier when a condition holds |
| `chargeSkippedByWeather` | 0.6% | the charge turn DISAPPEARS under one weather |
| `needsTargetToAttack` | 0.6% | FAILS unless the target is attacking this turn |
| `healsSelf` | 0.5% | restores a share of MY max HP, costing the turn |
| `multiHit` | 0.5% | hits = n (or a distribution) |
| `statusImmune` | 0.4% | a status cannot land |
| `inflictsConfusion` | 0.4% | P(confusion): they hit themselves some of the time |
| `blocksSoundMoves` | 0.3% | they cannot use sound moves for 2 turns |
| `ignoresStatStages` | 0.3% | the boost multiplier does not apply, permanently |
| `clearsScreens` | 0.2% | destroys Reflect, Light Screen and Aurora Veil on their side |
| `proceduralStatus` | 0.2% | one status from a set, chosen at random in the handler |
| `survivesFromFull` | 0.2% | a lethal hit from full HP leaves 1 |
| `ignoresStatStages` | 0.2% | the boost multiplier does not apply |
| `curesStatus` | 0.2% | a status is removed the moment it lands |
| `ignoresDefenderAbility` | 0.2% | suppress every defender-side ability tag for this move |
| `preventsCrit` | 0.1% | P(crit) = 0 |
| `failsWithoutWeather` | 0.1% | the move does NOTHING unless a weather is up |
| `critRatioUp` | 0.1% | P(crit) raised |
| `critRatioUp` | 0.1% | P(crit) raised |
| `boostsTarget` | 0.1% | positive stat stages on a BODY THAT IS NOT ME |
| `perishClock` | 0.1% | everything on the field dies in 3 turns unless it switches |
| `delayedSleep` | 0.1% | they fall asleep at the end of NEXT turn unless they switch |
| `addsFlinch` | 0.1% | P(flinch) += 10% on moves that do not already flinch |
| `fractionalPriority` | 0.1% | a CHANCE to move first inside the priority bracket |
| `clearsBoosts` | 0.1% | every stat stage on the field := 0, both sides |
| `accuracyMod` | 0.1% | P(hit) is scaled for everyone |
| `forcesSwitch` | 0.1% | the TARGET is removed from the field |
| `critDamageUp` | 0.0% | the CRIT MULTIPLIER itself, not its probability |
| `terrainScaled` | 0.0% | power or target changes with the terrain |
| `alwaysCrit` | 0.0% | P(crit) = 1 |
| `passesState` | 0.0% | the incoming Pokemon INHERITS something |
| `hazard` | 0.0% | their side is damaged or slowed on switch-in, until removed |
| `ohko` | 0.0% | removes the target outright |
| `critRatioUp` | 0.0% | P(crit) raised |
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

# COVERAGE — nothing common is missing from this document

The per-tag sections further down only list things that **have** a tag. Anything untagged
would never appear. This section lists everything above **0.05% of usage** regardless, so a gap is visible rather than absent.

## MOVES — 167 above 0.05% (97.0% of all usage)

**6 of these carry NO tag at all.** For a plain attacking move that is correct — there is nothing unusual to say. For anything else it is a gap.

| move | uses | share | tags |
|---|---|---|---|
| Protect | 43,795 | 16.62% | `priority` `neverMisses` `stalling` `statusCategory` |
| Fake Out | 7,934 | 3.01% | `priority` `contact` `flinches` |
| Tailwind | 7,052 | 2.68% | `neverMisses` `doublesSideSpeed` `statusCategory` |
| Rock Slide | 6,980 | 2.65% | `spreadFoes` `flinches` |
| Close Combat | 5,558 | 2.11% | `contact` `lowersUser` |
| Parting Shot | 4,827 | 1.83% | `sound` `pivotStatus` `boostsProcedural` `lowersTarget` `statusCategory` |
| Weather Ball | 4,739 | 1.80% | `weatherScaled` |
| Earthquake | 4,569 | 1.73% | `spreadAll` |
| Trick Room | 4,461 | 1.69% | `priority` `neverMisses` `ignoresProtect` `reversesSpeed` `statusCategory` |
| Iron Head | 4,349 | 1.65% | `contact` `flinches` |
| Wave Crash | 4,092 | 1.55% | `contact` `recoil` |
| Heat Wave | 4,091 | 1.55% | `spreadFoes` `inflictsBurn` |
| Flare Blitz | 4,090 | 1.55% | `contact` `thawsTarget` `inflictsBurn` `recoil` |
| Moonblast | 4,088 | 1.55% | `secondaryStatEffect` |
| Sucker Punch | 3,949 | 1.50% | `priority` `contact` `needsTargetToAttack` |
| Dragon Claw | 3,888 | 1.48% | `contact` |
| Rage Powder | 3,886 | 1.47% | `priority` `powder` `neverMisses` `redirects` `statusCategory` |
| Matcha Gotcha | 3,422 | 1.30% | `spreadFoes` `thawsTarget` `inflictsBurn` `drain` |
| Shadow Ball | 3,332 | 1.26% | `secondaryStatEffect` |
| Aqua Jet | 3,066 | 1.16% | `priority` `contact` |
| Last Respects | 3,034 | 1.15% | `needsUntrackedState` `variablePower` |
| Kowtow Cleave | 3,006 | 1.14% | `contact` `neverMissesAttack` |
| Encore | 2,786 | 1.06% | `statusCategory` `locksTarget` |
| Solar Beam | 2,501 | 0.95% | `conditionalPower` `chargeTurn` `chargeSkippedByWeather` |
| Hyper Voice | 2,496 | 0.95% | `spreadFoes` `sound` |
| Earth Power | 2,409 | 0.91% | `secondaryStatEffect` |
| Light Screen | 2,359 | 0.89% | `neverMisses` `halvesDamage` `statusCategory` |
| Brave Bird | 2,309 | 0.88% | `contact` `recoil` |
| Hurricane | 2,275 | 0.86% | `weatherScaled` `inflictsConfusion` |
| Stomping Tantrum | 2,132 | 0.81% | `needsUntrackedState` `variablePower` `contact` |
| Wide Guard | 2,098 | 0.80% | `priority` `neverMisses` `oneTurnGuard` `statusCategory` |
| Helping Hand | 2,051 | 0.78% | `priority` `neverMisses` `statusCategory` |
| dragonpulse | 2,048 | 0.78% | **— none —** |
| Dazzling Gleam | 2,023 | 0.77% | `spreadFoes` |
| Sludge Bomb | 2,005 | 0.76% | `inflictsPoison` |
| Reflect | 2,000 | 0.76% | `neverMisses` `halvesDamage` `statusCategory` |
| Low Kick | 1,880 | 0.71% | `needsUntrackedState` `variablePower` `contact` |
| Thunderbolt | 1,874 | 0.71% | `inflictsParalysis` |
| Flash Cannon | 1,806 | 0.69% | `secondaryStatEffect` |
| Nasty Plot | 1,779 | 0.67% | `neverMisses` `boostsUser` `statusCategory` |
| Throat Chop | 1,778 | 0.67% | `blocksSoundMoves` `contact` |
| Psychic | 1,776 | 0.67% | `secondaryStatEffect` |
| Flip Turn | 1,774 | 0.67% | `contact` `pivotDamaging` |
| Dual Wingbeat | 1,738 | 0.66% | `multiHit` `contact` |
| Life Dew | 1,694 | 0.64% | `neverMisses` `statusCategory` `healsSelf` `healsAlly` |
| Electro Shot | 1,679 | 0.64% | `chargeTurn` `chargeSkippedByWeather` |
| Knock Off | 1,663 | 0.63% | `conditionalPower` `contact` |
| Blizzard | 1,547 | 0.59% | `weatherScaled` `spreadFoes` `inflictsFreeze` |
| Dire Claw | 1,520 | 0.58% | `contact` `proceduralStatus` |
| Make It Rain | 1,437 | 0.55% | `spreadFoes` `lowersUser` |
| Ice Punch | 1,432 | 0.54% | `contact` `inflictsFreeze` |
| Roost | 1,363 | 0.52% | `neverMisses` `statusCategory` `healsSelf` |
| Psychic Fangs | 1,356 | 0.51% | `clearsScreens` `contact` |
| High Horsepower | 1,294 | 0.49% | `contact` |
| Darkest Lariat | 1,259 | 0.48% | `ignoresStatStages` `contact` |
| Swords Dance | 1,216 | 0.46% | `neverMisses` `boostsUser` `statusCategory` |
| Quick Attack | 1,216 | 0.46% | `priority` `contact` |
| Draco Meteor | 1,206 | 0.46% | `lowersUser` |
| Calm Mind | 1,184 | 0.45% | `neverMisses` `boostsUser` `statusCategory` |
| Detect | 1,179 | 0.45% | `priority` `neverMisses` `stalling` `statusCategory` |
| Spirit Break | 1,122 | 0.43% | `contact` `secondaryStatEffect` |
| Will-O-Wisp | 1,112 | 0.42% | `statusCategory` `inflictsBurn` |
| Focus Blast | 1,105 | 0.42% | `secondaryStatEffect` |
| Zap Cannon | 1,077 | 0.41% | `inflictsParalysis` |
| Dark Pulse | 1,026 | 0.39% | `flinches` |
| Hyper Beam | 1,026 | 0.39% | `recharge` |
| Volt Switch | 992 | 0.38% | `pivotDamaging` |
| Follow Me | 944 | 0.36% | `priority` `neverMisses` `redirects` `statusCategory` |
| Play Rough | 919 | 0.35% | `contact` `secondaryStatEffect` |
| Taunt | 881 | 0.33% | `statusCategory` `forbidsStatusMoves` |
| Aurora Veil | 860 | 0.33% | `neverMisses` `halvesDamage` `failsWithoutWeather` `statusCategory` |
| Icy Wind | 854 | 0.32% | `spreadFoes` `secondaryStatEffect` |
| Giga Drain | 820 | 0.31% | `drain` |
| Overheat | 772 | 0.29% | `lowersUser` |
| Poison Jab | 767 | 0.29% | `contact` `inflictsPoison` |
| U-turn | 749 | 0.28% | `contact` `pivotDamaging` |
| freezedry | 748 | 0.28% | **— none —** |
| Sleep Powder | 742 | 0.28% | `powder` `statusCategory` `inflictsSleep` |
| Light of Ruin | 718 | 0.27% | `recoil` |
| hydropump | 718 | 0.27% | **— none —** |
| Drain Punch | 710 | 0.27% | `contact` `drain` |
| Rain Dance | 704 | 0.27% | `neverMisses` `ignoresProtect` `setsWeather` `statusCategory` |
| Charm | 700 | 0.27% | `lowersTarget` `statusCategory` |
| Aura Sphere | 688 | 0.26% | `neverMissesAttack` |
| powergem | 687 | 0.26% | **— none —** |
| Scald | 608 | 0.23% | `thawsTarget` `inflictsBurn` |
| Eruption | 571 | 0.22% | `needsUntrackedState` `variablePower` `spreadFoes` |
| Bullet Punch | 570 | 0.22% | `priority` `contact` |
| Foul Play | 569 | 0.22% | `contact` |
| Snarl | 569 | 0.22% | `spreadFoes` `sound` `secondaryStatEffect` |
| Bulk Up | 567 | 0.22% | `neverMisses` `boostsUser` `statusCategory` |
| Body Press | 567 | 0.22% | `contact` |
| Perish Song | 562 | 0.21% | `sound` `neverMisses` `ignoresProtect` `statusCategory` `perishClock` |
| Ice Beam | 561 | 0.21% | `inflictsFreeze` |
| Liquidation | 557 | 0.21% | `contact` `secondaryStatEffect` |
| Yawn | 542 | 0.21% | `neverMisses` `statusCategory` `delayedSleep` |
| Coaching | 529 | 0.20% | `neverMisses` `boostsTarget` `statusCategory` |
| Strength Sap | 519 | 0.20% | `boostsProcedural` `lowersTarget` `statusCategory` `healsAlly` |
| Flamethrower | 499 | 0.19% | `inflictsBurn` |
| Toxic | 495 | 0.19% | `statusCategory` `inflictsToxic` |
| Rock Tomb | 491 | 0.19% | `secondaryStatEffect` |
| psyshock | 479 | 0.18% | **— none —** |
| Muddy Water | 478 | 0.18% | `spreadFoes` `secondaryStatEffect` |
| Twin Beam | 469 | 0.18% | `multiHit` |
| Energy Ball | 457 | 0.17% | `secondaryStatEffect` |
| Extreme Speed | 455 | 0.17% | `priority` `contact` |
| Baneful Bunker | 451 | 0.17% | `priority` `neverMisses` `stalling` `statusCategory` `inflictsPoison` |
| Infestation | 450 | 0.17% | `contact` |
| Draining Kiss | 445 | 0.17% | `contact` `drain` |
| Super Fang | 442 | 0.17% | `needsUntrackedState` `contact` |
| Ice Fang | 433 | 0.16% | `contact` `inflictsFreeze` `flinches` |
| Disable | 416 | 0.16% | `statusCategory` `locksTarget` |
| Spiky Shield | 407 | 0.15% | `priority` `neverMisses` `stalling` `statusCategory` |
| Discharge | 406 | 0.15% | `spreadAll` `inflictsParalysis` |
| Sunny Day | 379 | 0.14% | `neverMisses` `ignoresProtect` `setsWeather` `statusCategory` |
| Quick Guard | 366 | 0.14% | `priority` `neverMisses` `oneTurnGuard` `statusCategory` |
| Rage Fist | 364 | 0.14% | `needsUntrackedState` `variablePower` `contact` |
| Haze | 362 | 0.14% | `neverMisses` `ignoresProtect` `clearsBoosts` `statusCategory` |
| Ice Shard | 361 | 0.14% | `priority` |
| Shadow Sneak | 348 | 0.13% | `priority` `contact` |
| Fake Tears | 347 | 0.13% | `lowersTarget` `statusCategory` |
| Water Spout | 345 | 0.13% | `needsUntrackedState` `variablePower` `spreadFoes` |
| Electroweb | 345 | 0.13% | `spreadFoes` `secondaryStatEffect` |
| Dragon Dance | 345 | 0.13% | `neverMisses` `boostsUser` `statusCategory` |
| Leaf Storm | 340 | 0.13% | `lowersUser` |
| Triple Axel | 332 | 0.13% | `multiHit` `variablePower` `contact` |
| Ancient Power | 326 | 0.12% | `secondaryStatEffect` |
| Meteor Mash | 319 | 0.12% | `contact` `secondaryStatEffect` |
| Clanging Scales | 312 | 0.12% | `spreadFoes` `sound` |
| Coil | 306 | 0.12% | `neverMisses` `accuracyMod` `boostsUser` `statusCategory` |
| Recover | 305 | 0.12% | `neverMisses` `statusCategory` `healsSelf` |
| Brick Break | 293 | 0.11% | `clearsScreens` `contact` |
| Thunder Wave | 287 | 0.11% | `statusCategory` `inflictsParalysis` |
| Roar | 283 | 0.11% | `priority` `sound` `neverMisses` `ignoresProtect` `forcesSwitch` `statusCategory` |
| Hypnosis | 278 | 0.11% | `statusCategory` `inflictsSleep` |
| Population Bomb | 276 | 0.10% | `multiHit` `contact` |
| Trick | 268 | 0.10% | `statusCategory` |
| Shell Smash | 249 | 0.09% | `neverMisses` `boostsUser` `lowersUser` `statusCategory` |
| Substitute | 247 | 0.09% | `neverMisses` `substitute` `statusCategory` |
| Accelerock | 244 | 0.09% | `priority` `contact` |
| Grass Knot | 244 | 0.09% | `needsUntrackedState` `variablePower` `contact` |
| Leech Seed | 237 | 0.09% | `statusCategory` |
| Feint | 225 | 0.09% | `priority` `ignoresProtect` |
| Gunk Shot | 224 | 0.08% | `inflictsPoison` |
| Beat Up | 223 | 0.08% | `variablePower` |
| Crunch | 218 | 0.08% | `contact` `secondaryStatEffect` |
| Waterfall | 215 | 0.08% | `contact` `flinches` |
| Bitter Blade | 211 | 0.08% | `contact` `drain` |
| Scary Face | 208 | 0.08% | `lowersTarget` `statusCategory` |
| Thunder Punch | 205 | 0.08% | `contact` `inflictsParalysis` |
| Phantom Force | 205 | 0.08% | `contact` `ignoresProtect` `chargeTurn` |
| Psycho Cut | 193 | 0.07% | `critRatioUp` |
| Head Smash | 190 | 0.07% | `contact` `recoil` |
| Clangorous Soul | 190 | 0.07% | `sound` `neverMisses` `boostsUser` `statusCategory` |
| Icicle Crash | 184 | 0.07% | `flinches` |
| poltergeist | 183 | 0.07% | **— none —** |
| Thunder | 182 | 0.07% | `weatherScaled` `inflictsParalysis` |
| Superpower | 182 | 0.07% | `contact` `lowersUser` |
| Final Gambit | 180 | 0.07% | `needsUntrackedState` `userFaints` |
| Tickle | 179 | 0.07% | `lowersTarget` `statusCategory` |
| Double-Edge | 166 | 0.06% | `contact` `recoil` |
| Imprison | 160 | 0.06% | `neverMisses` `statusCategory` |
| Iron Defense | 149 | 0.06% | `neverMisses` `boostsUser` `statusCategory` |
| Sacred Sword | 145 | 0.06% | `ignoresStatStages` `contact` |
| Volt Tackle | 145 | 0.06% | `contact` `inflictsParalysis` `recoil` |
| Vacuum Wave | 143 | 0.05% | `priority` |
| Air Slash | 141 | 0.05% | `flinches` |

## ABILITIES — 100 above 0.05% (98.7% of all usage)

**21 of these carry NO tag at all.** For a plain attacking move that is correct — there is nothing unusual to say. For anything else it is a gap.

| ability | uses | share | tags |
|---|---|---|---|
| Intimidate | 6,604 | 10.01% | `onSwitchInDrop` |
| Prankster | 4,692 | 7.11% | `priorityMod` |
| Rough Skin | 3,762 | 5.70% | `profitsFromHit` `contactPunish` |
| Defiant | 3,610 | 5.47% | `boostsWhenLowered` |
| Hospitality | 3,435 | 5.21% | `healsAllyOnSwitchIn` |
| Adaptability | 2,855 | 4.33% | `stabBoost` |
| Blaze | 2,722 | 4.13% | `damageBoost` |
| Drizzle | 2,213 | 3.35% | `weatherSetter` |
| Levitate | 1,785 | 2.71% | `typeImmunity` |
| Armor Tail | 1,699 | 2.58% | `blocksMove` |
| Stamina | 1,643 | 2.49% | `profitsFromHit` |
| Unburden | 1,465 | 2.22% | `speedOnItemLoss` |
| Flower Veil | 1,465 | 2.22% | `preventsStatDrop` |
| Good as Gold | 1,450 | 2.20% | `blocksStatusMoves` |
| Pixilate | 1,448 | 2.19% | `damageBoost` |
| Clear Body | 1,331 | 2.02% | `preventsStatDrop` |
| Unnerve | 1,329 | 2.01% | `blocksBerries` |
| Lightning Rod | 1,302 | 1.97% | `typeImmunity` |
| Chlorophyll | 1,151 | 1.74% | `speedCond` |
| Torrent | 1,093 | 1.66% | `damageBoost` |
| Snow Warning | 954 | 1.45% | `weatherSetter` |
| Sand Stream | 848 | 1.29% | `weatherSetter` |
| Cursed Body | 837 | 1.27% | `disablesAttacker` `profitsFromHit` |
| Competitive | 815 | 1.24% | `boostsWhenLowered` |
| Friend Guard | 623 | 0.94% | `reducesAllyDamage` |
| Drought | 621 | 0.94% | `weatherSetter` |
| Regenerator | 555 | 0.84% | `healsOnSwitchOut` |
| poisontouch | 528 | 0.80% | **— none —** |
| Sand Rush | 495 | 0.75% | `speedCond` `weatherChipImmune` |
| Gale Wings | 493 | 0.75% | `priorityMod` |
| speedboost | 453 | 0.69% | **— none —** |
| damp | 437 | 0.66% | **— none —** |
| Solar Power | 432 | 0.65% | `damageBoost` |
| Toxic Debris | 417 | 0.63% | `profitsFromHit` |
| rockhead | 399 | 0.60% | **— none —** |
| Hyper Cutter | 378 | 0.57% | `preventsStatDrop` |
| Inner Focus | 377 | 0.57% | `preventsStatDrop` |
| Overgrow | 362 | 0.55% | `damageBoost` |
| Flash Fire | 357 | 0.54% | `typeImmunity` |
| Multiscale | 353 | 0.54% | `damageReduce` |
| Technician | 344 | 0.52% | `damageBoost` |
| Swift Swim | 325 | 0.49% | `speedCond` |
| Static | 278 | 0.42% | `profitsFromHit` `contactPunish` |
| Oblivious | 277 | 0.42% | `preventsStatDrop` `weatherChipImmune` |
| Tough Claws | 272 | 0.41% | `damageBoost` |
| Scrappy | 262 | 0.40% | `preventsStatDrop` `priorityMod` |
| moody | 249 | 0.38% | **— none —** |
| liquidvoice | 243 | 0.37% | **— none —** |
| raindish | 240 | 0.36% | **— none —** |
| Mirror Armor | 226 | 0.34% | `preventsStatDrop` |
| Queenly Majesty | 226 | 0.34% | `blocksMove` |
| Snow Cloak | 219 | 0.33% | `accuracyMod` `weatherChipImmune` |
| Compound Eyes | 210 | 0.32% | `accuracyMod` |
| soundproof | 207 | 0.31% | **— none —** |
| Unaware | 173 | 0.26% | `ignoresStatStages` |
| Solid Rock | 170 | 0.26% | `damageReduce` |
| protean | 167 | 0.25% | **— none —** |
| Sharpness | 155 | 0.23% | `damageBoost` |
| Sturdy | 154 | 0.23% | `survivesFromFull` |
| Stance Change | 149 | 0.23% | `priorityMod` |
| Sand Veil | 135 | 0.20% | `accuracyMod` `weatherChipImmune` |
| Contrary | 134 | 0.20% | `invertsBoosts` |
| Mold Breaker | 130 | 0.20% | `ignoresDefenderAbility` `priorityMod` |
| Telepathy | 116 | 0.18% | `blocksStatusMoves` |
| Zero to Hero | 115 | 0.17% | `healsOnSwitchOut` `formeChange` |
| trace | 114 | 0.17% | **— none —** |
| Flame Body | 114 | 0.17% | `profitsFromHit` `contactPunish` |
| Sheer Force | 94 | 0.14% | `damageBoost` `priorityMod` |
| magicbounce | 92 | 0.14% | **— none —** |
| Overcoat | 90 | 0.14% | `weatherChipImmune` |
| pressure | 85 | 0.13% | **— none —** |
| Huge Power | 75 | 0.11% | `damageBoost` |
| Leaf Guard | 75 | 0.11% | `statusImmune` |
| Water Bubble | 73 | 0.11% | `damageBoost` `statusImmune` |
| frisk | 72 | 0.11% | **— none —** |
| thickfat | 71 | 0.11% | **— none —** |
| cloudnine | 70 | 0.11% | **— none —** |
| Disguise | 64 | 0.10% | `preventsCrit` `formeChange` |
| Limber | 63 | 0.10% | `statusImmune` |
| Illusion | 63 | 0.10% | `profitsFromHit` `formeChange` |
| magicguard | 60 | 0.09% | **— none —** |
| Supreme Overlord | 60 | 0.09% | `damageBoost` |
| Infiltrator | 56 | 0.08% | `priorityMod` |
| Iron Fist | 55 | 0.08% | `damageBoost` |
| synchronize | 53 | 0.08% | **— none —** |
| Dry Skin | 52 | 0.08% | `typeImmunity` |
| bulletproof | 52 | 0.08% | **— none —** |
| Poison Point | 51 | 0.08% | `profitsFromHit` `contactPunish` |
| Cute Charm | 48 | 0.07% | `profitsFromHit` `contactPunish` |
| Electromorphosis | 48 | 0.07% | `profitsFromHit` |
| Magma Armor | 44 | 0.07% | `weatherChipImmune` |
| Own Tempo | 44 | 0.07% | `preventsStatDrop` |
| magician | 41 | 0.06% | **— none —** |
| Imposter | 39 | 0.06% | `formeChange` |
| Insomnia | 39 | 0.06% | `statusImmune` |
| Natural Cure | 38 | 0.06% | `healsOnSwitchOut` |
| moxie | 37 | 0.06% | **— none —** |
| symbiosis | 37 | 0.06% | **— none —** |
| Purifying Salt | 35 | 0.05% | `statusImmune` |
| Volt Absorb | 33 | 0.05% | `typeImmunity` |

## ITEMS — 95 above 0.05% (98.8% of all usage)

**6 of these carry NO tag at all.** For a plain attacking move that is correct — there is nothing unusual to say. For anything else it is a gap.

| item | uses | share | tags |
|---|---|---|---|
| Focus Sash | 7,693 | 11.66% | `survivesFromFull` |
| Sitrus Berry | 7,132 | 10.81% | `healsAtHalf` |
| Life Orb | 6,301 | 9.55% | `damageMultAll` |
| Leftovers | 4,336 | 6.57% | `passiveHeal` |
| Choice Scarf | 3,947 | 5.98% | `choiceLock` `speedMult` |
| Charizardite Y | 2,223 | 3.37% | `megaStone` |
| Light Clay | 2,016 | 3.06% | `extendsScreens` |
| Staraptite | 1,956 | 2.96% | `megaStone` |
| Fairy Feather | 1,521 | 2.31% | `damageMultType` |
| Floettite | 1,455 | 2.21% | `megaStone` |
| Chople Berry | 1,441 | 2.18% | `resistBerry` |
| White Herb | 1,362 | 2.06% | `restoresStats` |
| Swampertite | 1,351 | 2.05% | `megaStone` |
| Black Glasses | 1,332 | 2.02% | `damageMultType` |
| Colbur Berry | 1,256 | 1.90% | `resistBerry` |
| Metagrossite | 1,189 | 1.80% | `megaStone` |
| Kasib Berry | 1,102 | 1.67% | `resistBerry` |
| Raichunite Y | 1,076 | 1.63% | `megaStone` |
| Mystic Water | 873 | 1.32% | `damageMultType` |
| Aerodactylite | 847 | 1.28% | `megaStone` |
| Delphoxite | 782 | 1.19% | `megaStone` |
| Charcoal | 694 | 1.05% | `damageMultType` |
| Mawilite | 680 | 1.03% | `megaStone` |
| Occa Berry | 650 | 0.99% | `resistBerry` |
| Tyranitarite | 643 | 0.97% | `megaStone` |
| Froslassite | 548 | 0.83% | `megaStone` |
| Roseli Berry | 511 | 0.77% | `resistBerry` |
| Passho Berry | 487 | 0.74% | `resistBerry` |
| Gengarite | 446 | 0.68% | `megaStone` |
| mentalherb | 445 | 0.67% | **— none —** |
| Wide Lens | 414 | 0.63% | `accuracyMod` |
| Venusaurite | 409 | 0.62% | `megaStone` |
| Coba Berry | 401 | 0.61% | `resistBerry` |
| expertbelt | 399 | 0.60% | **— none —** |
| Never-Melt Ice | 393 | 0.60% | `damageMultType` |
| Blastoisinite | 357 | 0.54% | `megaStone` |
| Sharp Beak | 302 | 0.46% | `damageMultType` |
| Dragoninite | 289 | 0.44% | `megaStone` |
| Scovillainite | 284 | 0.43% | `megaStone` |
| Blazikenite | 277 | 0.42% | `megaStone` |
| Shuca Berry | 266 | 0.40% | `resistBerry` |
| Eelektrossite | 259 | 0.39% | `megaStone` |
| Scraftinite | 247 | 0.37% | `megaStone` |
| Raichunite X | 217 | 0.33% | `megaStone` |
| Metal Coat | 212 | 0.32% | `damageMultType` |
| damprock | 200 | 0.30% | **— none —** |
| Gardevoirite | 197 | 0.30% | `megaStone` |
| Cameruptite | 196 | 0.30% | `megaStone` |
| Sceptilite | 195 | 0.30% | `megaStone` |
| Pyroarite | 188 | 0.28% | `megaStone` |
| Glimmoranite | 163 | 0.25% | `megaStone` |
| Dragalgite | 145 | 0.22% | `megaStone` |
| Bright Powder | 144 | 0.22% | `accuracyMod` |
| Meganiumite | 139 | 0.21% | `megaStone` |
| Kangaskhanite | 133 | 0.20% | `megaStone` |
| Dragon Fang | 117 | 0.18% | `damageMultType` |
| Haban Berry | 112 | 0.17% | `resistBerry` |
| Lum Berry | 108 | 0.16% | `curesStatus` |
| Silk Scarf | 102 | 0.15% | `damageMultType` |
| Malamarite | 90 | 0.14% | `megaStone` |
| ironball | 85 | 0.13% | **— none —** |
| Garchompite | 85 | 0.13% | `megaStone` |
| Spell Tag | 79 | 0.12% | `damageMultType` |
| Lopunnite | 78 | 0.12% | `megaStone` |
| Magnet | 77 | 0.12% | `damageMultType` |
| Soft Sand | 75 | 0.11% | `damageMultType` |
| Lucarionite | 72 | 0.11% | `megaStone` |
| Gyaradosite | 71 | 0.11% | `megaStone` |
| Babiri Berry | 70 | 0.11% | `resistBerry` |
| Scope Lens | 69 | 0.10% | `critRatioUp` |
| Scizorite | 65 | 0.10% | `megaStone` |
| Charizardite X | 65 | 0.10% | `megaStone` |
| Starminite | 59 | 0.09% | `megaStone` |
| Greninjite | 59 | 0.09% | `megaStone` |
| Clefablite | 54 | 0.08% | `megaStone` |
| Drampanite | 53 | 0.08% | `megaStone` |
| Excadrite | 53 | 0.08% | `megaStone` |
| heatrock | 52 | 0.08% | **— none —** |
| Ampharosite | 50 | 0.08% | `megaStone` |
| Chandelurite | 50 | 0.08% | `megaStone` |
| Falinksite | 50 | 0.08% | `megaStone` |
| King's Rock | 49 | 0.07% | `addsFlinch` |
| Miracle Seed | 48 | 0.07% | `damageMultType` |
| muscleband | 48 | 0.07% | **— none —** |
| Yache Berry | 47 | 0.07% | `resistBerry` |
| Scolipite | 42 | 0.06% | `megaStone` |
| Quick Claw | 39 | 0.06% | `fractionalPriority` |
| Kebia Berry | 39 | 0.06% | `resistBerry` |
| Aggronite | 38 | 0.06% | `megaStone` |
| Beedrillite | 37 | 0.06% | `megaStone` |
| Crabominite | 37 | 0.06% | `megaStone` |
| Black Belt | 36 | 0.05% | `damageMultType` |
| Wacan Berry | 36 | 0.05% | `resistBerry` |
| Slowbronite | 36 | 0.05% | `megaStone` |
| Sablenite | 33 | 0.05% | `megaStone` |

---

# STATUS MOVES — you asked to review these

**146 see real play.** All of them get **Prankster +1**, are **blanked by Taunt**,
and are **illegal under Assault Vest** — three interactions hanging off one property nothing
had named until now.

| move | uses | prio | other tags |
|---|---|---|---|
| Protect | 43,795 | +4 | `priority` `neverMisses` `stalling` |
| Tailwind | 7,052 |  | `neverMisses` `doublesSideSpeed` |
| Parting Shot | 4,827 |  | `sound` `pivotStatus` `boostsProcedural` `lowersTarget` |
| Trick Room | 4,461 | -7 | `priority` `neverMisses` `ignoresProtect` `reversesSpeed` |
| Rage Powder | 3,886 | +2 | `priority` `powder` `neverMisses` `redirects` |
| Encore | 2,786 |  | `locksTarget` |
| Light Screen | 2,359 |  | `neverMisses` `halvesDamage` |
| Wide Guard | 2,098 | +3 | `priority` `neverMisses` `oneTurnGuard` |
| Helping Hand | 2,051 | +5 | `priority` `neverMisses` |
| Reflect | 2,000 |  | `neverMisses` `halvesDamage` |
| Nasty Plot | 1,779 |  | `neverMisses` `boostsUser` |
| Life Dew | 1,694 |  | `neverMisses` `healsSelf` `healsAlly` |
| Roost | 1,363 |  | `neverMisses` `healsSelf` |
| Swords Dance | 1,216 |  | `neverMisses` `boostsUser` |
| Calm Mind | 1,184 |  | `neverMisses` `boostsUser` |
| Detect | 1,179 | +4 | `priority` `neverMisses` `stalling` |
| Will-O-Wisp | 1,112 |  | `inflictsBurn` |
| Follow Me | 944 | +2 | `priority` `neverMisses` `redirects` |
| Taunt | 881 |  | `forbidsStatusMoves` |
| Aurora Veil | 860 |  | `neverMisses` `halvesDamage` `failsWithoutWeather` |
| Sleep Powder | 742 |  | `powder` `inflictsSleep` |
| Rain Dance | 704 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Charm | 700 |  | `lowersTarget` |
| Bulk Up | 567 |  | `neverMisses` `boostsUser` |
| Perish Song | 562 |  | `sound` `neverMisses` `ignoresProtect` `perishClock` |
| Yawn | 542 |  | `neverMisses` `delayedSleep` |
| Coaching | 529 |  | `neverMisses` `boostsTarget` |
| Strength Sap | 519 |  | `boostsProcedural` `lowersTarget` `healsAlly` |
| Toxic | 495 |  | `inflictsToxic` |
| Baneful Bunker | 451 | +4 | `priority` `neverMisses` `stalling` `inflictsPoison` |
| Disable | 416 |  | `locksTarget` |
| Spiky Shield | 407 | +4 | `priority` `neverMisses` `stalling` |
| Sunny Day | 379 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Quick Guard | 366 | +3 | `priority` `neverMisses` `oneTurnGuard` |
| Haze | 362 |  | `neverMisses` `ignoresProtect` `clearsBoosts` |
| Fake Tears | 347 |  | `lowersTarget` |
| Dragon Dance | 345 |  | `neverMisses` `boostsUser` |
| Coil | 306 |  | `neverMisses` `accuracyMod` `boostsUser` |
| Recover | 305 |  | `neverMisses` `healsSelf` |
| Thunder Wave | 287 |  | `inflictsParalysis` |
| Roar | 283 | -6 | `priority` `sound` `neverMisses` `ignoresProtect` `forcesSwitch` |
| Hypnosis | 278 |  | `inflictsSleep` |
| Trick | 268 |  | — |
| Shell Smash | 249 |  | `neverMisses` `boostsUser` `lowersUser` |
| Substitute | 247 |  | `neverMisses` `substitute` |
| Leech Seed | 237 |  | — |
| Scary Face | 208 |  | `lowersTarget` |
| Clangorous Soul | 190 |  | `sound` `neverMisses` `boostsUser` |
| Tickle | 179 |  | `lowersTarget` |
| Imprison | 160 |  | `neverMisses` |
| Iron Defense | 149 |  | `neverMisses` `boostsUser` |
| King's Shield | 130 | +4 | `priority` `neverMisses` `stalling` |
| Quash | 127 |  | — |
| After You | 107 |  | `neverMisses` `ignoresProtect` |
| Instruct | 92 |  | `neverMisses` |
| Soak | 78 |  | — |
| Ally Switch | 77 | +2 | `priority` `neverMisses` |
| Belly Drum | 69 |  | `neverMisses` `boostsProcedural` |
| Baton Pass | 65 |  | `neverMisses` `passesState` |
| Stealth Rock | 64 |  | `neverMisses` `hazard` |
| Swagger | 64 |  | `inflictsConfusion` `boostsTarget` |
| Curse | 62 |  | `neverMisses` `ignoresProtect` |
| Heal Pulse | 62 |  | `neverMisses` `healsAlly` |
| Quiver Dance | 58 |  | `neverMisses` `boostsUser` |
| Skill Swap | 56 |  | `neverMisses` |
| Psychic Terrain | 52 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Baby-Doll Eyes | 50 | +1 | `priority` `lowersTarget` |
| No Retreat | 48 |  | `neverMisses` `boostsUser` |
| Psych Up | 46 |  | `neverMisses` `ignoresProtect` `boostsProcedural` |
| Wish | 46 |  | `neverMisses` `healsSelf` |
| Rest | 44 |  | `neverMisses` `healsSelf` |
| Shed Tail | 41 |  | `neverMisses` `passesState` `substitute` |
| Destiny Bond | 39 |  | `neverMisses` |
| Transform | 39 |  | `neverMisses` `ignoresProtect` |
| Gravity | 34 |  | `neverMisses` `ignoresProtect` `accuracyMod` |
| Slack Off | 34 |  | `neverMisses` `healsSelf` |
| Synthesis | 33 |  | `neverMisses` `healsSelf` |
| Memento | 31 |  | `lowersTarget` `userFaints` |
| Worry Seed | 29 |  | — |
| Pain Split | 27 |  | `neverMisses` |
| Howl | 26 |  | `sound` `neverMisses` `boostsTarget` |
| Moonlight | 21 |  | `neverMisses` `healsSelf` |
| Stockpile | 21 |  | `neverMisses` |
| Tidy Up | 21 |  | `neverMisses` `boostsProcedural` |
| Cotton Spore | 20 |  | `spreadFoes` `powder` `lowersTarget` |
| Entrainment | 20 |  | — |
| Glare | 20 |  | `inflictsParalysis` |
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
| Stun Spore | 12 |  | `powder` `inflictsParalysis` |
| Whirlwind | 12 | -6 | `priority` `neverMisses` `ignoresProtect` `forcesSwitch` |
| Electric Terrain | 11 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Agility | 10 |  | `neverMisses` `boostsUser` |
| Eerie Impulse | 10 |  | `lowersTarget` |
| Sleep Talk | 10 |  | `neverMisses` |
| Topsy-Turvy | 10 |  | `neverMisses` `boostsProcedural` |
| Cotton Guard | 9 |  | `neverMisses` `boostsUser` |
| Simple Beam | 9 |  | — |
| Feather Dance | 8 |  | `lowersTarget` |
| Morning Sun | 7 |  | `neverMisses` `healsSelf` |
| Switcheroo | 7 |  | — |
| Toxic Thread | 6 |  | `lowersTarget` `inflictsPoison` |
| Safeguard | 6 |  | `neverMisses` `sideBuff` |
| Speed Swap | 6 |  | `neverMisses` |
| Aqua Ring | 5 |  | `neverMisses` |
| Grassy Terrain | 5 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Magic Powder | 5 |  | `powder` |
| Mean Look | 5 |  | `neverMisses` `ignoresProtect` |
| Misty Terrain | 5 |  | `neverMisses` `ignoresProtect` `setsTerrain` |
| Power Swap | 5 |  | `neverMisses` `boostsProcedural` `lowersTarget` |
| Spikes | 5 |  | `neverMisses` `hazard` |
| Spite | 5 |  | — |
| Growth | 4 |  | `weatherScaled` `neverMisses` `boostsUser` |
| Sandstorm | 4 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Trick-or-Treat | 4 |  | — |
| Amnesia | 4 |  | `neverMisses` `boostsUser` |
| Copycat | 4 |  | `neverMisses` |
| Defog | 4 |  | `neverMisses` `boostsProcedural` `lowersTarget` |
| Focus Energy | 4 |  | `neverMisses` |
| Healing Wish | 4 |  | `neverMisses` `userFaints` `healsSelf` |
| Torment | 4 |  | `locksTarget` |
| Snowscape | 3 |  | `neverMisses` `ignoresProtect` `setsWeather` |
| Endure | 3 | +4 | `priority` `neverMisses` `stalling` |
| Gastro Acid | 3 |  | — |
| Screech | 3 |  | `sound` `lowersTarget` |
| Spore | 3 |  | `powder` `inflictsSleep` |
| Confuse Ray | 2 |  | `inflictsConfusion` |
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

A dash means the taxonomy says nothing about it beyond being a status move — **12 of them**.

---

# MOVES

## `lowersUser` — WHICH of my own stats drop, as the price of the move  **← NOT READ**

*Close Combat (5,487 uses) pays -1 Def and -1 SpD; Draco Meteor, Overheat and Make It Rain pay -2 SpA. movesBoostMe only fires on a POSITIVE change, so all of them read as having no self-effect whatsoever*

| entry | appearances | parameter |
|---|---|---|
| Close Combat | 5,558 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Make It Rain | 1,437 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Draco Meteor | 1,206 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Overheat | 772 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Leaf Storm | 340 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Shell Smash | 249 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:true |
| Superpower | 182 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Hammer Arm | 107 | readFrom:m.self.boosts,lowersSpeed:true,alsoRaises:false |
| Armor Cannon | 31 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |
| Ice Hammer | 31 | readFrom:m.self.boosts,lowersSpeed:true,alsoRaises:false |
| Headlong Rush | 28 | readFrom:m.self.boosts,lowersSpeed:false,alsoRaises:false |

Total tagged: **11**  ·  share: **1.5%**

## `needsUntrackedState` — power depends on state the board does not track  **← NOT READ**

*Last Respects (3,009 uses) needs a fainted COUNT, Low Kick (1,854) needs target WEIGHT which is not in our mon table at all, Rage Fist needs times-hit, Stomping Tantrum needs whether the last move failed. Their dex basePower is 0, so board.js returns null and scores them as non-damaging*

| entry | appearances | parameter |
|---|---|---|
| Last Respects | 3,034 | needs:fainted count |
| Stomping Tantrum | 2,132 | needs:last move failed |
| Low Kick | 1,880 | needs:target weight |
| Eruption | 571 | needs:user hp |
| Super Fang | 442 | needs:target hp |
| Rage Fist | 364 | needs:times hit |
| Water Spout | 345 | needs:user hp |
| Grass Knot | 244 | needs:target weight |
| Final Gambit | 180 | needs:user hp |
| Heavy Slam | 121 | needs:weight ratio |
| Endeavor | 75 | needs:hp difference |
| Hard Press | 26 | needs:target hp |
| Gyro Ball | 24 | needs:speed ratio |
| Stored Power | 17 | needs:user boosts |
| Electro Ball | 7 | needs:speed ratio |
| Heat Crash | 5 | needs:weight ratio |
| Reversal | 4 | needs:user hp |

Total tagged: **18**  ·  1 legal but unused  ·  share: **1.4%**

## `weatherScaled` — type, power or target changes with the weather  **← NOT READ**

*Weather Ball (4,699 uses), Hydro Steam. Its type is handled; the power and the target change are not*

| entry | appearances | parameter |
|---|---|---|
| Weather Ball | 4,739 | scalesWith:weather |
| Hurricane | 2,275 | scalesWith:weather |
| Blizzard | 1,547 | scalesWith:weather |
| Thunder | 182 | scalesWith:weather |
| Growth | 4 | scalesWith:weather |

Total tagged: **5**  ·  share: **1.3%**

## `thawsTarget` — unfreezes the target it hits  **← NOT READ**

*Scald (601 uses), Scorching Sands. Undoes a freeze you may have wanted*

| entry | appearances | parameter |
|---|---|---|
| Flare Blitz | 4,090 | thaws:true |
| Matcha Gotcha | 3,422 | thaws:true |
| Scald | 608 | thaws:true |
| Scorching Sands | 89 | thaws:true |
| Burn Up | 35 | thaws:true |

Total tagged: **5**  ·  share: **1.2%**

## `ignoresProtect` — Protect does NOT stop it  **← NOT READ**

*Feint, Phantom Force, Future Sight. tgtMayProtect discounts these as if a Protect saves the target, and it does not*

| entry | appearances | parameter |
|---|---|---|
| Trick Room | 4,461 | ignoresProtect:true |
| Rain Dance | 704 | ignoresProtect:true |
| Perish Song | 562 | ignoresProtect:true |
| Sunny Day | 379 | ignoresProtect:true |
| Haze | 362 | ignoresProtect:true |
| Roar | 283 | ignoresProtect:true |
| Feint | 225 | ignoresProtect:true |
| Phantom Force | 205 | ignoresProtect:true |
| After You | 107 | ignoresProtect:true |
| Curse | 62 | ignoresProtect:true |
| Psychic Terrain | 52 | ignoresProtect:true |
| Psych Up | 46 | ignoresProtect:true |
| Transform | 39 | ignoresProtect:true |
| Gravity | 34 | ignoresProtect:true |
| Decorate | 18 | ignoresProtect:true |
| Chilly Reception | 17 | ignoresProtect:true |
| Role Play | 12 | ignoresProtect:true |
| Whirlwind | 12 | ignoresProtect:true |
| Electric Terrain | 11 | ignoresProtect:true |
| Future Sight | 6 | ignoresProtect:true |
| Grassy Terrain | 5 | ignoresProtect:true |
| Mean Look | 5 | ignoresProtect:true |
| Misty Terrain | 5 | ignoresProtect:true |
| Sandstorm | 4 | ignoresProtect:true |
| Snowscape | 3 | ignoresProtect:true |
| Wonder Room | 2 | ignoresProtect:true |

Total tagged: **31**  ·  5 legal but unused  ·  share: **1.1%**

## `boostsProcedural` — stat changes exist but are computed, not declared in a field  **← NOT READ**

*Curse (differs for Ghost types), Scale Shot. Nothing can read the actual numbers off the dex, so they need a hand-written case or a live probe -- flagged rather than missed*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,827 | procedural:true |
| Strength Sap | 519 | procedural:true |
| Belly Drum | 69 | procedural:true |
| Psych Up | 46 | procedural:true |
| Tidy Up | 21 | procedural:true |
| Topsy-Turvy | 10 | procedural:true |
| Clear Smog | 6 | procedural:true |
| Power Swap | 5 | procedural:true |
| Defog | 4 | procedural:true |

Total tagged: **12**  ·  3 legal but unused  ·  share: **0.8%**

## `pivotStatus` — no damage, an effect, then the user leaves  **← NOT READ**

*Parting Shot (4,782 uses, the most common pivot in the format) and Chilly Reception. The switch is the point and the effect is the payment*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,827 | selfSwitch:true |
| Chilly Reception | 17 | selfSwitch:true |

Total tagged: **2**  ·  share: **0.7%**

## `conditionalPower` — fixed power x a multiplier when a condition holds  **← NOT READ**

*Knock Off x1.5 if they hold an item (1,640 uses, and the SHEET tells you), Facade x2 if statused, Venoshock x2 if poisoned, Expanding Force x1.5 on Psychic Terrain. The engine uses the base number every time*

| entry | appearances | parameter |
|---|---|---|
| Solar Beam | 2,501 | conditional:true |
| Knock Off | 1,663 | conditional:true |
| Expanding Force | 84 | conditional:true |
| Lash Out | 47 | conditional:true |
| Facade | 32 | conditional:true |
| Fickle Beam | 28 | conditional:true |
| Barb Barrage | 22 | conditional:true |
| Grav Apple | 9 | conditional:true |
| Solar Blade | 9 | conditional:true |
| Venoshock | 5 | conditional:true |
| Misty Explosion | 3 | conditional:true |

Total tagged: **11**  ·  share: **0.6%**

## `chargeSkippedByWeather` — the charge turn DISAPPEARS under one weather  **← NOT READ**

*Electro Shot in rain, Solar Beam and Solar Blade in sun. Same move, no downside, and the weather that does it is usually one the user set themselves*

| entry | appearances | parameter |
|---|---|---|
| Solar Beam | 2,501 | skipsIn:sun |
| Electro Shot | 1,679 | skipsIn:rain |
| Solar Blade | 9 | skipsIn:sun |

Total tagged: **3**  ·  share: **0.6%**

## `needsTargetToAttack` — FAILS unless the target is attacking this turn  **← NOT READ**

*Sucker Punch (3,909 uses), Upper Hand, Counter, Mirror Coat, Metal Burst, Focus Punch. Their value is a prediction about the opponent, not a property of the board -- which is exactly what sigma_opp is for and nothing connects them*

| entry | appearances | parameter |
|---|---|---|
| Sucker Punch | 3,949 | needs:target attacking |
| Upper Hand | 56 | needs:target attacking |
| Assurance | 26 | needs:target attacking |
| Mirror Coat | 12 | needs:target attacking |
| Avalanche | 7 | needs:target attacking |
| Counter | 7 | needs:target attacking |
| Focus Punch | 6 | needs:target attacking |
| Metal Burst | 4 | needs:target attacking |
| Payback | 1 | needs:target attacking |

Total tagged: **9**  ·  share: **0.6%**

## `healsSelf` — restores a share of MY max HP, costing the turn  **← NOT READ**

*Wish, Rest, Slack Off, Synthesis, Moonlight. Trades tempo for bulk, which nothing prices*

| entry | appearances | parameter |
|---|---|---|
| Life Dew | 1,694 | heal:[1,4] |
| Roost | 1,363 | heal:[1,2] |
| Recover | 305 | heal:[1,2] |
| Wish | 46 | heal:true |
| Rest | 44 | heal:true |
| Slack Off | 34 | heal:[1,2] |
| Synthesis | 33 | heal:true |
| Moonlight | 21 | heal:true |
| Morning Sun | 7 | heal:true |
| Healing Wish | 4 | heal:true |

Total tagged: **12**  ·  2 legal but unused  ·  share: **0.5%**

## `multiHit` — hits = n (or a distribution)  **← NOT READ**

*total damage is n x base, and it BREAKS Focus Sash and Sturdy -- the first hit takes the holder to 1, the rest kill*

| entry | appearances | parameter |
|---|---|---|
| Dual Wingbeat | 1,738 | readFrom:m.multihit,distribution:fixed |
| Twin Beam | 469 | readFrom:m.multihit,distribution:fixed |
| Triple Axel | 332 | readFrom:m.multihit,distribution:fixed |
| Population Bomb | 276 | readFrom:m.multihit,distribution:fixed |
| Scale Shot | 124 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |
| Dragon Darts | 55 | readFrom:m.multihit,distribution:fixed |
| Rock Blast | 39 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |
| Bullet Seed | 21 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |
| Pin Missile | 17 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |
| Water Shuriken | 16 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |
| Icicle Spear | 5 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |
| Bone Rush | 4 | readFrom:m.multihit,distribution:2:35 3:35 4:15 5:15 |

Total tagged: **14**  ·  2 legal but unused  ·  share: **0.5%**

## `inflictsConfusion` — P(confusion): they hit themselves some of the time  **← NOT READ**

*4,620 appearances. Not a status -- a volatile that adds a failure chance to every move they click while it lasts*

| entry | appearances | parameter |
|---|---|---|
| Hurricane | 2,275 | p:0.3 |
| Swagger | 64 | p:1 |
| Water Pulse | 45 | p:0.2 |
| Dynamic Punch | 6 | p:1 |
| Confuse Ray | 2 | p:1 |

Total tagged: **9**  ·  4 legal but unused  ·  share: **0.4%**

## `blocksSoundMoves` — they cannot use sound moves for 2 turns  **← NOT READ**

*Throat Chop. The sound flag already exists on the moves it blocks, so this is a join rather than new information*

| entry | appearances | parameter |
|---|---|---|
| Throat Chop | 1,778 | blocks:sound |

Total tagged: **1**  ·  share: **0.3%**

## `clearsScreens` — destroys Reflect, Light Screen and Aurora Veil on their side  **← NOT READ**

*Psychic Fangs (1,352 uses), Brick Break (289), Raging Bull. The answer to 5,187 uses of screens, and it lands as a damaging move rather than costing a turn*

| entry | appearances | parameter |
|---|---|---|
| Psychic Fangs | 1,356 | clears:screens |
| Brick Break | 293 | clears:screens |
| Raging Bull | 8 | clears:screens |

Total tagged: **3**  ·  share: **0.2%**

## `proceduralStatus` — one status from a set, chosen at random in the handler  **← NOT READ**

*Dire Claw (1,509 uses) rolls poison / paralysis / sleep at 10% each; Tri Attack rolls burn / paralysis / freeze. The secondary declares a chance and no status, so every status probe misses them*

| entry | appearances | parameter |
|---|---|---|
| Dire Claw | 1,520 | p:0.3,oneOf:[psn,par,slp],each:0.1 |
| Tri Attack | 1 | p:0.2,oneOf:[brn,par,frz],each:0.067 |

Total tagged: **2**  ·  share: **0.2%**

## `ignoresStatStages` — the boost multiplier does not apply  **← NOT READ**

*Darkest Lariat (1,232 uses), Sacred Sword. Setup means nothing into them, so a boosted target is no safer than an unboosted one -- and it is the same switch a crit flips*

| entry | appearances | parameter |
|---|---|---|
| Darkest Lariat | 1,259 | ignores:target defensive stages |
| Sacred Sword | 145 | ignores:target defensive stages |

Total tagged: **2**  ·  share: **0.2%**

## `failsWithoutWeather` — the move does NOTHING unless a weather is up  **← NOT READ**

*Aurora Veil needs snow. Clicking it on a clear field is a wasted turn, and no feature can currently say so*

| entry | appearances | parameter |
|---|---|---|
| Aurora Veil | 860 | needsWeather:true |
| Magnet Rise | 1 | needsWeather:true |

Total tagged: **2**  ·  share: **0.1%**

## `critRatioUp` — P(crit) raised  **← NOT READ**

*a higher crit stage, which the damage distribution should weight rather than ignore*

| entry | appearances | parameter |
|---|---|---|
| Psycho Cut | 193 | critRatio:2 |
| Stone Edge | 111 | critRatio:2 |
| Leaf Blade | 109 | critRatio:2 |
| Blaze Kick | 87 | critRatio:2 |
| Shadow Claw | 69 | critRatio:2 |
| Night Slash | 65 | critRatio:2 |
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
| Coaching | 529 | boosts:{atk:1,def:1} |
| Swagger | 64 | boosts:{atk:2} |
| Howl | 26 | boosts:{atk:1} |
| Decorate | 18 | boosts:{atk:2,spa:2} |
| Aromatic Mist | 1 | boosts:{spd:1} |

Total tagged: **6**  ·  1 legal but unused  ·  share: **0.1%**

## `perishClock` — everything on the field dies in 3 turns unless it switches  **← NOT READ**

*Perish Song, 560 uses. Ignores HP, typing, items and abilities. No damage feature can see it and no kill calculation applies*

| entry | appearances | parameter |
|---|---|---|
| Perish Song | 562 | turns:3 |

Total tagged: **1**  ·  share: **0.1%**

## `delayedSleep` — they fall asleep at the end of NEXT turn unless they switch  **← NOT READ**

*Yawn, 536 uses. Not a status this turn -- a threat that forces a switch, which is the whole point of clicking it*

| entry | appearances | parameter |
|---|---|---|
| Yawn | 542 | delay:1 |

Total tagged: **1**  ·  share: **0.1%**

## `clearsBoosts` — every stat stage on the field := 0, both sides  **← NOT READ**

*Haze, 359 uses. The only answer to setup in the format, and it hits YOUR boosts too -- so whether to click it depends on who is ahead on stages, which nothing computes*

| entry | appearances | parameter |
|---|---|---|
| Haze | 362 | resets:true |
| Clear Smog | 6 | resets:true |

Total tagged: **2**  ·  share: **0.1%**

## `accuracyMod` — P(hit) is scaled for everyone  **← NOT READ**

*Gravity (x5/3 and grounds Flying), Sand Attack, Hone Claws. Feeds the same P(hit) the kill distribution already needs*

| entry | appearances | parameter |
|---|---|---|
| Coil | 306 | accuracy:true |
| Gravity | 34 | accuracy:true |
| Minimize | 14 | accuracy:true |
| Sweet Scent | 1 | accuracy:true |

Total tagged: **5**  ·  1 legal but unused  ·  share: **0.1%**

## `forcesSwitch` — the TARGET is removed from the field  **← NOT READ**

*Whirlwind, Dragon Tail, Roar. Undoes setup and changes who is in front of you*

| entry | appearances | parameter |
|---|---|---|
| Roar | 283 | forceSwitch:true |
| Dragon Tail | 49 | forceSwitch:true |
| Whirlwind | 12 | forceSwitch:true |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.1%**

## `terrainScaled` — power or target changes with the terrain  **← NOT READ**

*Expanding Force becomes a SPREAD move in Psychic Terrain, Rising Voltage doubles in Electric. Grassy Glide gains priority, which board.js already special-cases*

| entry | appearances | parameter |
|---|---|---|
| Rising Voltage | 91 | scalesWith:terrain |
| Expanding Force | 84 | scalesWith:terrain |
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
| Stealth Rock | 64 | hazard:stealthrock |
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
| Protect | 43,795 | status:true |
| Tailwind | 7,052 | status:true |
| Parting Shot | 4,827 | status:true |
| Trick Room | 4,461 | status:true |
| Rage Powder | 3,886 | status:true |
| Encore | 2,786 | status:true |
| Light Screen | 2,359 | status:true |
| Wide Guard | 2,098 | status:true |
| Helping Hand | 2,051 | status:true |
| Reflect | 2,000 | status:true |
| Nasty Plot | 1,779 | status:true |
| Life Dew | 1,694 | status:true |
| Roost | 1,363 | status:true |
| Swords Dance | 1,216 | status:true |
| Calm Mind | 1,184 | status:true |
| Detect | 1,179 | status:true |
| Will-O-Wisp | 1,112 | status:true |
| Follow Me | 944 | status:true |
| Taunt | 881 | status:true |
| Aurora Veil | 860 | status:true |
| Sleep Powder | 742 | status:true |
| Rain Dance | 704 | status:true |
| Charm | 700 | status:true |
| Bulk Up | 567 | status:true |
| Perish Song | 562 | status:true |
| Yawn | 542 | status:true |
| Coaching | 529 | status:true |
| Strength Sap | 519 | status:true |
| Toxic | 495 | status:true |
| Baneful Bunker | 451 | status:true |
| Disable | 416 | status:true |
| Spiky Shield | 407 | status:true |
| Sunny Day | 379 | status:true |
| Quick Guard | 366 | status:true |
| Haze | 362 | status:true |
| Fake Tears | 347 | status:true |
| Dragon Dance | 345 | status:true |
| Coil | 306 | status:true |
| Recover | 305 | status:true |
| Thunder Wave | 287 | status:true |
| *…106 more* | | |

Total tagged: **175**  ·  29 legal but unused  ·  share: **14.9%**

## `neverMisses` — P(hit) = 1 (the default for a self-targeting status move)

*Correct as a PARAMETER and uninformative as a category -- Protect does not roll accuracy because there is nothing to roll against. Kept so the distribution reads the right P(hit), flagged so nobody reviews 103 status moves looking for a pattern*

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,795 | pHit:1,note:default for status |
| Tailwind | 7,052 | pHit:1,note:default for status |
| Trick Room | 4,461 | pHit:1,note:default for status |
| Rage Powder | 3,886 | pHit:1,note:default for status |
| Light Screen | 2,359 | pHit:1,note:default for status |
| Wide Guard | 2,098 | pHit:1,note:default for status |
| Helping Hand | 2,051 | pHit:1,note:default for status |
| Reflect | 2,000 | pHit:1,note:default for status |
| Nasty Plot | 1,779 | pHit:1,note:default for status |
| Life Dew | 1,694 | pHit:1,note:default for status |
| Roost | 1,363 | pHit:1,note:default for status |
| Swords Dance | 1,216 | pHit:1,note:default for status |
| Calm Mind | 1,184 | pHit:1,note:default for status |
| Detect | 1,179 | pHit:1,note:default for status |
| Follow Me | 944 | pHit:1,note:default for status |
| Aurora Veil | 860 | pHit:1,note:default for status |
| Rain Dance | 704 | pHit:1,note:default for status |
| Bulk Up | 567 | pHit:1,note:default for status |
| Perish Song | 562 | pHit:1,note:default for status |
| Yawn | 542 | pHit:1,note:default for status |
| Coaching | 529 | pHit:1,note:default for status |
| Baneful Bunker | 451 | pHit:1,note:default for status |
| Spiky Shield | 407 | pHit:1,note:default for status |
| Sunny Day | 379 | pHit:1,note:default for status |
| Quick Guard | 366 | pHit:1,note:default for status |
| Haze | 362 | pHit:1,note:default for status |
| Dragon Dance | 345 | pHit:1,note:default for status |
| Coil | 306 | pHit:1,note:default for status |
| Recover | 305 | pHit:1,note:default for status |
| Roar | 283 | pHit:1,note:default for status |
| Shell Smash | 249 | pHit:1,note:default for status |
| Substitute | 247 | pHit:1,note:default for status |
| Clangorous Soul | 190 | pHit:1,note:default for status |
| Imprison | 160 | pHit:1,note:default for status |
| Iron Defense | 149 | pHit:1,note:default for status |
| King's Shield | 130 | pHit:1,note:default for status |
| After You | 107 | pHit:1,note:default for status |
| Instruct | 92 | pHit:1,note:default for status |
| Ally Switch | 77 | pHit:1,note:default for status |
| Belly Drum | 69 | pHit:1,note:default for status |
| *…63 more* | | |

Total tagged: **124**  ·  21 legal but unused  ·  share: **12.8%**

## `priority` — order = priority

*who moves first, before speed is consulted at all*

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,795 | readFrom:m.priority,sign:+ |
| Fake Out | 7,934 | readFrom:m.priority,sign:+ |
| Trick Room | 4,461 | readFrom:m.priority,sign:- |
| Sucker Punch | 3,949 | readFrom:m.priority,sign:+ |
| Rage Powder | 3,886 | readFrom:m.priority,sign:+ |
| Aqua Jet | 3,066 | readFrom:m.priority,sign:+ |
| Wide Guard | 2,098 | readFrom:m.priority,sign:+ |
| Helping Hand | 2,051 | readFrom:m.priority,sign:+ |
| Quick Attack | 1,216 | readFrom:m.priority,sign:+ |
| Detect | 1,179 | readFrom:m.priority,sign:+ |
| Follow Me | 944 | readFrom:m.priority,sign:+ |
| Bullet Punch | 570 | readFrom:m.priority,sign:+ |
| Extreme Speed | 455 | readFrom:m.priority,sign:+ |
| Baneful Bunker | 451 | readFrom:m.priority,sign:+ |
| Spiky Shield | 407 | readFrom:m.priority,sign:+ |
| Quick Guard | 366 | readFrom:m.priority,sign:+ |
| Ice Shard | 361 | readFrom:m.priority,sign:+ |
| Shadow Sneak | 348 | readFrom:m.priority,sign:+ |
| Roar | 283 | readFrom:m.priority,sign:- |
| Accelerock | 244 | readFrom:m.priority,sign:+ |
| Feint | 225 | readFrom:m.priority,sign:+ |
| Vacuum Wave | 143 | readFrom:m.priority,sign:+ |
| King's Shield | 130 | readFrom:m.priority,sign:+ |
| Jet Punch | 100 | readFrom:m.priority,sign:+ |
| Ally Switch | 77 | readFrom:m.priority,sign:+ |
| Upper Hand | 56 | readFrom:m.priority,sign:+ |
| Baby-Doll Eyes | 50 | readFrom:m.priority,sign:+ |
| Dragon Tail | 49 | readFrom:m.priority,sign:- |
| Mach Punch | 37 | readFrom:m.priority,sign:+ |
| Water Shuriken | 16 | readFrom:m.priority,sign:+ |
| Mirror Coat | 12 | readFrom:m.priority,sign:- |
| Whirlwind | 12 | readFrom:m.priority,sign:- |
| Avalanche | 7 | readFrom:m.priority,sign:- |
| Counter | 7 | readFrom:m.priority,sign:- |
| Focus Punch | 6 | readFrom:m.priority,sign:- |
| First Impression | 3 | readFrom:m.priority,sign:+ |
| Endure | 3 | readFrom:m.priority,sign:+ |
| Beak Blast | 2 | readFrom:m.priority,sign:- |

Total tagged: **39**  ·  1 legal but unused  ·  share: **11.6%**

## `contact` — triggers contact punishment on the defender

*Rocky Helmet, Rough Skin, Iron Barbs, Static, Flame Body all cost you for touching*

| entry | appearances | parameter |
|---|---|---|
| Fake Out | 7,934 | contact:true |
| Close Combat | 5,558 | contact:true |
| Iron Head | 4,349 | contact:true |
| Wave Crash | 4,092 | contact:true |
| Flare Blitz | 4,090 | contact:true |
| Sucker Punch | 3,949 | contact:true |
| Dragon Claw | 3,888 | contact:true |
| Aqua Jet | 3,066 | contact:true |
| Kowtow Cleave | 3,006 | contact:true |
| Brave Bird | 2,309 | contact:true |
| Stomping Tantrum | 2,132 | contact:true |
| Low Kick | 1,880 | contact:true |
| Throat Chop | 1,778 | contact:true |
| Flip Turn | 1,774 | contact:true |
| Dual Wingbeat | 1,738 | contact:true |
| Knock Off | 1,663 | contact:true |
| Dire Claw | 1,520 | contact:true |
| Ice Punch | 1,432 | contact:true |
| Psychic Fangs | 1,356 | contact:true |
| High Horsepower | 1,294 | contact:true |
| Darkest Lariat | 1,259 | contact:true |
| Quick Attack | 1,216 | contact:true |
| Spirit Break | 1,122 | contact:true |
| Play Rough | 919 | contact:true |
| Poison Jab | 767 | contact:true |
| U-turn | 749 | contact:true |
| Drain Punch | 710 | contact:true |
| Bullet Punch | 570 | contact:true |
| Foul Play | 569 | contact:true |
| Body Press | 567 | contact:true |
| Liquidation | 557 | contact:true |
| Extreme Speed | 455 | contact:true |
| Infestation | 450 | contact:true |
| Draining Kiss | 445 | contact:true |
| Super Fang | 442 | contact:true |
| Ice Fang | 433 | contact:true |
| Rage Fist | 364 | contact:true |
| Shadow Sneak | 348 | contact:true |
| Triple Axel | 332 | contact:true |
| Meteor Mash | 319 | contact:true |
| *…101 more* | | |

Total tagged: **166**  ·  25 legal but unused  ·  share: **11.4%**

## `stalling` — is a Protect-family move

*protectThreatened and deadStall both hang off it*

| entry | appearances | parameter |
|---|---|---|
| Protect | 43,795 | stalling:true |
| Detect | 1,179 | stalling:true |
| Baneful Bunker | 451 | stalling:true |
| Spiky Shield | 407 | stalling:true |
| King's Shield | 130 | stalling:true |
| Endure | 3 | stalling:true |

Total tagged: **6**  ·  share: **6.8%**

## `spreadFoes` — x0.75, hits BOTH ENEMIES, ally is safe

*Heat Wave, Hyper Voice, Dazzling Gleam, Blizzard, Make It Rain. Free to click beside a partner*

| entry | appearances | parameter |
|---|---|---|
| Rock Slide | 6,980 | target:allAdjacentFoes,hitsAlly:false |
| Heat Wave | 4,091 | target:allAdjacentFoes,hitsAlly:false |
| Matcha Gotcha | 3,422 | target:allAdjacentFoes,hitsAlly:false |
| Hyper Voice | 2,496 | target:allAdjacentFoes,hitsAlly:false |
| Dazzling Gleam | 2,023 | target:allAdjacentFoes,hitsAlly:false |
| Blizzard | 1,547 | target:allAdjacentFoes,hitsAlly:false |
| Make It Rain | 1,437 | target:allAdjacentFoes,hitsAlly:false |
| Icy Wind | 854 | target:allAdjacentFoes,hitsAlly:false |
| Eruption | 571 | target:allAdjacentFoes,hitsAlly:false |
| Snarl | 569 | target:allAdjacentFoes,hitsAlly:false |
| Muddy Water | 478 | target:allAdjacentFoes,hitsAlly:false |
| Electroweb | 345 | target:allAdjacentFoes,hitsAlly:false |
| Water Spout | 345 | target:allAdjacentFoes,hitsAlly:false |
| Clanging Scales | 312 | target:allAdjacentFoes,hitsAlly:false |
| Breaking Swipe | 70 | target:allAdjacentFoes,hitsAlly:false |
| Burning Jealousy | 32 | target:allAdjacentFoes,hitsAlly:false |
| Struggle Bug | 30 | target:allAdjacentFoes,hitsAlly:false |
| Mortal Spin | 21 | target:allAdjacentFoes,hitsAlly:false |
| Cotton Spore | 20 | target:allAdjacentFoes,hitsAlly:false |
| String Shot | 13 | target:allAdjacentFoes,hitsAlly:false |
| Sweet Scent | 1 | target:allAdjacentFoes,hitsAlly:false |

Total tagged: **22**  ·  1 legal but unused  ·  share: **3.8%**

## `secondaryStatEffect` — P(stat change) as a SECONDARY — blockable by Covert Cloak and Shield Dust

*Icy Wind, Rock Tomb and Electroweb drop Speed 100% of the time -- speed control. Moonblast 10% SpA, Spirit Break 100% SpA, Snarl 100%. 21,748 appearances and not one was tagged*

| entry | appearances | parameter |
|---|---|---|
| Moonblast | 4,088 | p:0.1,boosts:{spa:-1},onSelf:false,lowersSpeed:false |
| Shadow Ball | 3,332 | p:0.2,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Earth Power | 2,409 | p:0.1,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Flash Cannon | 1,806 | p:0.1,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Psychic | 1,776 | p:0.1,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Spirit Break | 1,122 | p:1,boosts:{spa:-1},onSelf:false,lowersSpeed:false |
| Focus Blast | 1,105 | p:0.1,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Play Rough | 919 | p:0.1,boosts:{atk:-1},onSelf:false,lowersSpeed:false |
| Icy Wind | 854 | p:1,boosts:{spe:-1},onSelf:false,lowersSpeed:true |
| Snarl | 569 | p:1,boosts:{spa:-1},onSelf:false,lowersSpeed:false |
| Liquidation | 557 | p:0.2,boosts:{def:-1},onSelf:false,lowersSpeed:false |
| Rock Tomb | 491 | p:1,boosts:{spe:-1},onSelf:false,lowersSpeed:true |
| Muddy Water | 478 | p:0.3,boosts:{accuracy:-1},onSelf:false,lowersSpeed:false |
| Energy Ball | 457 | p:0.1,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Electroweb | 345 | p:1,boosts:{spe:-1},onSelf:false,lowersSpeed:true |
| Ancient Power | 326 | p:0.1,boosts:{atk:1,def:1,spa:1,spd:1,spe:1},onSelf:true,lowersSpeed:false |
| Meteor Mash | 319 | p:0.2,boosts:{atk:1},onSelf:true,lowersSpeed:false |
| Crunch | 218 | p:0.2,boosts:{def:-1},onSelf:false,lowersSpeed:false |
| Trop Kick | 121 | p:1,boosts:{atk:-1},onSelf:false,lowersSpeed:false |
| Mystical Fire | 76 | p:1,boosts:{spa:-1},onSelf:false,lowersSpeed:false |
| Breaking Swipe | 70 | p:1,boosts:{atk:-1},onSelf:false,lowersSpeed:false |
| Lumina Crash | 56 | p:1,boosts:{spd:-2},onSelf:false,lowersSpeed:false |
| Acid Spray | 54 | p:1,boosts:{spd:-2},onSelf:false,lowersSpeed:false |
| Triple Arrows | 49 | p:0.5,boosts:{def:-1},onSelf:false,lowersSpeed:false |
| Bitter Malice | 44 | p:1,boosts:{atk:-1},onSelf:false,lowersSpeed:false |
| Fiery Dance | 42 | p:0.5,boosts:{spa:1},onSelf:true,lowersSpeed:false |
| Bug Buzz | 40 | p:0.1,boosts:{spd:-1},onSelf:false,lowersSpeed:false |
| Chilling Water | 33 | p:1,boosts:{atk:-1},onSelf:false,lowersSpeed:false |
| Struggle Bug | 30 | p:1,boosts:{spa:-1},onSelf:false,lowersSpeed:false |
| Torch Song | 26 | p:1,boosts:{spa:1},onSelf:true,lowersSpeed:false |
| Trailblaze | 24 | p:1,boosts:{spe:1},onSelf:true,lowersSpeed:false |
| Aura Wheel | 21 | p:1,boosts:{spe:1},onSelf:true,lowersSpeed:false |
| Lunge | 18 | p:1,boosts:{atk:-1},onSelf:false,lowersSpeed:false |
| Bulldoze | 17 | p:1,boosts:{spe:-1},onSelf:false,lowersSpeed:true |
| Aqua Step | 11 | p:1,boosts:{spe:1},onSelf:true,lowersSpeed:false |
| Iron Tail | 10 | p:0.3,boosts:{def:-1},onSelf:false,lowersSpeed:false |
| Grav Apple | 9 | p:1,boosts:{def:-1},onSelf:false,lowersSpeed:false |
| Low Sweep | 9 | p:1,boosts:{spe:-1},onSelf:false,lowersSpeed:true |
| Mud Shot | 9 | p:1,boosts:{spe:-1},onSelf:false,lowersSpeed:true |
| Steel Wing | 9 | p:0.1,boosts:{def:1},onSelf:true,lowersSpeed:false |
| *…9 more* | | |

Total tagged: **52**  ·  3 legal but unused  ·  share: **3.2%**

## `flinches` — P(flinch), 10% to 100%, and only if I move first

*Fake Out 100% at +3, Rock Slide 30%, Iron Head 20%, the fangs 10%. Blocked by Covert Cloak and Inner Focus, neither of which is checked*

| entry | appearances | parameter |
|---|---|---|
| Fake Out | 7,934 | pFlinch:1 |
| Rock Slide | 6,980 | pFlinch:0.3 |
| Iron Head | 4,349 | pFlinch:0.2 |
| Dark Pulse | 1,026 | pFlinch:0.2 |
| Ice Fang | 433 | pFlinch:0.1 |
| Waterfall | 215 | pFlinch:0.2 |
| Icicle Crash | 184 | pFlinch:0.3 |
| Air Slash | 141 | pFlinch:0.3 |
| Zen Headbutt | 60 | pFlinch:0.2 |
| Upper Hand | 56 | pFlinch:1 |
| Triple Arrows | 49 | pFlinch:0.3 |
| Extrasensory | 39 | pFlinch:0.1 |
| Bite | 22 | pFlinch:0.3 |
| Dragon Rush | 16 | pFlinch:0.2 |
| Fire Fang | 9 | pFlinch:0.1 |
| Mountain Gale | 6 | pFlinch:0.3 |
| Thunder Fang | 6 | pFlinch:0.1 |

Total tagged: **19**  ·  2 legal but unused  ·  share: **3.2%**

## `inflictsBurn` — P(burn): x0.5 physical damage on them, plus chip

*Will-O-Wisp as the move, Flare Blitz and Matcha Gotcha as a secondary. Halving their physical output is a damage parameter, not a status footnote*

| entry | appearances | parameter |
|---|---|---|
| Heat Wave | 4,091 | p:0.1,via:secondary |
| Flare Blitz | 4,090 | p:0.1,via:secondary |
| Matcha Gotcha | 3,422 | p:0.2,via:secondary |
| Will-O-Wisp | 1,112 | p:0.85,via:primary |
| Scald | 608 | p:0.3,via:secondary |
| Flamethrower | 499 | p:0.1,via:secondary |
| Scorching Sands | 89 | p:0.3,via:secondary |
| Blaze Kick | 87 | p:0.1,via:secondary |
| Fire Punch | 48 | p:0.1,via:secondary |
| Fire Blast | 26 | p:0.1,via:secondary |
| Infernal Parade | 15 | p:0.3,via:secondary |
| Fire Fang | 9 | p:0.1,via:secondary |
| Beak Blast | 2 | p:1,via:contact with the shield |
| Lava Plume | 1 | p:0.3,via:secondary |

Total tagged: **15**  ·  1 legal but unused  ·  share: **2.1%**

## `recoil` — the user pays a FRACTION of the damage dealt

*Head Smash 1/2, Flare Blitz and Wave Crash 33/100 at ~4,000 uses each, Wild Charge 1/4. A cost nothing prices*

| entry | appearances | parameter |
|---|---|---|
| Wave Crash | 4,092 | readFrom:m.recoil |
| Flare Blitz | 4,090 | readFrom:m.recoil |
| Brave Bird | 2,309 | readFrom:m.recoil |
| Light of Ruin | 718 | readFrom:m.recoil |
| Head Smash | 190 | readFrom:m.recoil |
| Double-Edge | 166 | readFrom:m.recoil |
| Volt Tackle | 145 | readFrom:m.recoil |
| Wild Charge | 58 | readFrom:m.recoil |
| Steel Beam | 27 | fraction:0.5,of:maxhp |
| Wood Hammer | 24 | readFrom:m.recoil |

Total tagged: **11**  ·  1 legal but unused  ·  share: **1.7%**

## `variablePower` — basePower is the calculation itself; dex bp is 0

*Low Kick by weight, Gyro Ball by speed ratio, Grass Knot. dex basePower is 0, so board.js returns null and scores them as NON-DAMAGING -- 1.27% of move slots doing zero*

| entry | appearances | parameter |
|---|---|---|
| Last Respects | 3,034 | computed:true |
| Stomping Tantrum | 2,132 | computed:true |
| Low Kick | 1,880 | computed:true |
| Eruption | 571 | computed:true |
| Rage Fist | 364 | computed:true |
| Water Spout | 345 | computed:true |
| Triple Axel | 332 | computed:true |
| Grass Knot | 244 | computed:true |
| Beat Up | 223 | computed:true |
| Heavy Slam | 121 | computed:true |
| Acrobatics | 92 | computed:true |
| Rising Voltage | 91 | computed:true |
| Hex | 63 | computed:true |
| Round | 36 | computed:true |
| Temper Flare | 30 | computed:true |
| Assurance | 26 | computed:true |
| Hard Press | 26 | computed:true |
| Gyro Ball | 24 | computed:true |
| Stored Power | 17 | computed:true |
| Water Shuriken | 16 | computed:true |
| Infernal Parade | 15 | computed:true |
| Avalanche | 7 | computed:true |
| Electro Ball | 7 | computed:true |
| Heat Crash | 5 | computed:true |
| Reversal | 4 | computed:true |
| Power Trip | 2 | computed:true |
| Payback | 1 | computed:true |

Total tagged: **29**  ·  2 legal but unused  ·  share: **1.4%**

## `sound` — bypasses Substitute, blocked by Soundproof

*also the trigger for Throat Spray*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,827 | sound:true |
| Hyper Voice | 2,496 | sound:true |
| Snarl | 569 | sound:true |
| Perish Song | 562 | sound:true |
| Clanging Scales | 312 | sound:true |
| Roar | 283 | sound:true |
| Clangorous Soul | 190 | sound:true |
| Psychic Noise | 96 | sound:true |
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

Total tagged: **24**  ·  5 legal but unused  ·  share: **1.4%**

## `doublesSideSpeed` — my whole side moves at x2 speed for the duration

*Tailwind, 6,981 uses. Flips who moves first across every matchup on the field at once, and board.js already derives the speed multiplier -- it just is not scored as a CHOICE*

| entry | appearances | parameter |
|---|---|---|
| Tailwind | 7,052 | speedMult:2 |

Total tagged: **1**  ·  share: **1.0%**

## `lowersTarget` — WHICH stat stages come off the foe, not just that some do

*Charm, Fake Tears, Scary Face, Tickle, Strength Sap. -1 Spe flips the order, -1 Atk halves their physical output. What Clear Amulet and White Herb answer*

| entry | appearances | parameter |
|---|---|---|
| Parting Shot | 4,827 | boosts:via onHit,lowersAttack:true |
| Charm | 700 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:true |
| Strength Sap | 519 | boosts:via onHit,lowersAttack:true |
| Fake Tears | 347 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:false |
| Scary Face | 208 | readFrom:m.boosts,lowersSpeed:true,lowersAttack:false |
| Tickle | 179 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:true |
| Baby-Doll Eyes | 50 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:true |
| Memento | 31 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:true |
| Cotton Spore | 20 | readFrom:m.boosts,lowersSpeed:true,lowersAttack:false |
| String Shot | 13 | readFrom:m.boosts,lowersSpeed:true,lowersAttack:false |
| Eerie Impulse | 10 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:false |
| Feather Dance | 8 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:true |
| Toxic Thread | 6 | readFrom:m.boosts,lowersSpeed:true,lowersAttack:false |
| Power Swap | 5 | boosts:via onHit,lowersAttack:true |
| Defog | 4 | boosts:via onHit,lowersAttack:false |
| Screech | 3 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:false |
| Spicy Extract | 1 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:false |
| Sweet Scent | 1 | readFrom:m.boosts,lowersSpeed:false,lowersAttack:false |

Total tagged: **22**  ·  4 legal but unused  ·  share: **1.0%**

## `boostsUser` — WHICH stat stages, on self, not just that there are some

*movesBoostMe is only a sign. +Spe flips the speed order, +Atk changes damage, +Def changes survival -- three different values reading as one number today*

| entry | appearances | parameter |
|---|---|---|
| Nasty Plot | 1,779 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Swords Dance | 1,216 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Calm Mind | 1,184 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Bulk Up | 567 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Dragon Dance | 345 | readFrom:m.self.boosts,raisesSpeed:true,alsoLowers:false |
| Coil | 306 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Shell Smash | 249 | readFrom:m.self.boosts,raisesSpeed:true,alsoLowers:true |
| Clangorous Soul | 190 | readFrom:m.self.boosts,raisesSpeed:true,alsoLowers:false |
| Iron Defense | 149 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Quiver Dance | 58 | readFrom:m.self.boosts,raisesSpeed:true,alsoLowers:false |
| No Retreat | 48 | readFrom:m.self.boosts,raisesSpeed:true,alsoLowers:false |
| Shelter | 18 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Cosmic Power | 15 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Minimize | 14 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Acid Armor | 13 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Agility | 10 | readFrom:m.self.boosts,raisesSpeed:true,alsoLowers:false |
| Cotton Guard | 9 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Growth | 4 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Amnesia | 4 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |
| Charge | 1 | readFrom:m.self.boosts,raisesSpeed:false,alsoLowers:false |

Total tagged: **22**  ·  2 legal but unused  ·  share: **0.9%**

## `drain` — heals a FRACTION OF DAMAGE DEALT, so its value scales with the hit

*Matcha Gotcha (3,422 uses), Giga Drain, Drain Punch all 1/2; Draining Kiss 3/4. Clicking one into a resisted target heals almost nothing, which no feature currently expresses*

| entry | appearances | parameter |
|---|---|---|
| Matcha Gotcha | 3,422 | readFrom:m.drain,unusual:false |
| Giga Drain | 820 | readFrom:m.drain,unusual:false |
| Drain Punch | 710 | readFrom:m.drain,unusual:false |
| Draining Kiss | 445 | readFrom:m.drain,unusual:true |
| Bitter Blade | 211 | readFrom:m.drain,unusual:false |
| Leech Life | 94 | readFrom:m.drain,unusual:false |
| Parabolic Charge | 70 | readFrom:m.drain,unusual:false |
| Horn Leech | 6 | readFrom:m.drain,unusual:false |

Total tagged: **8**  ·  share: **0.9%**

## `spreadAll` — x0.75, hits BOTH ENEMIES AND MY PARTNER

*Earthquake, Rock Slide, Discharge, Surf. This is the one allyHit exists for, and the one that killed its own Archaludon*

| entry | appearances | parameter |
|---|---|---|
| Earthquake | 4,569 | target:allAdjacent,hitsAlly:true |
| Discharge | 406 | target:allAdjacent,hitsAlly:true |
| Sludge Wave | 98 | target:allAdjacent,hitsAlly:true |
| Parabolic Charge | 70 | target:allAdjacent,hitsAlly:true |
| Surf | 69 | target:allAdjacent,hitsAlly:true |
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

Total tagged: **16**  ·  1 legal but unused  ·  share: **0.8%**

## `halvesDamage` — incoming damage of ONE category is halved for my side

*Reflect (1,988) physical only, Light Screen (2,346) special only, Aurora Veil (853) both and snow-only. 5,187 uses that change NO damage number anywhere in MAG today*

| entry | appearances | parameter |
|---|---|---|
| Light Screen | 2,359 | mult:0.5,category:Special |
| Reflect | 2,000 | mult:0.5,category:Physical |
| Aurora Veil | 860 | mult:0.5,category:both |

Total tagged: **3**  ·  share: **0.8%**

## `redirects` — takes the turn's single-target attacks

*Follow Me and Rage Powder. A pair feature in DODUO and nothing in the single-move vector*

| entry | appearances | parameter |
|---|---|---|
| Rage Powder | 3,886 | redirect:true |
| Follow Me | 944 | redirect:true |

Total tagged: **2**  ·  share: **0.7%**

## `powder` — fails into Grass types, Overcoat and Safety Goggles

*this is how Rage Powder is beaten, and redirection is scored as if it always works*

| entry | appearances | parameter |
|---|---|---|
| Rage Powder | 3,886 | powder:true |
| Sleep Powder | 742 | powder:true |
| Cotton Spore | 20 | powder:true |
| Stun Spore | 12 | powder:true |
| Magic Powder | 5 | powder:true |
| Spore | 3 | powder:true |

Total tagged: **7**  ·  1 legal but unused  ·  share: **0.7%**

## `reversesSpeed` — speed order is inverted for the whole field

*Trick Room. MAG set this FOR Will, who had the slowest Pokemon on the field, and was then 4-0ed. It knows the field is ALREADY set (deadField) and cannot ask whether setting it helps*

| entry | appearances | parameter |
|---|---|---|
| Trick Room | 4,461 | reverses:true |

Total tagged: **1**  ·  share: **0.7%**

## `chargeTurn` — costs a turn before it lands

*and the request omits the target field on the locked turn, which already broke the player once*

| entry | appearances | parameter |
|---|---|---|
| Solar Beam | 2,501 | charge:true |
| Electro Shot | 1,679 | charge:true |
| Phantom Force | 205 | charge:true |
| Solar Blade | 9 | charge:true |
| Meteor Beam | 5 | charge:true |
| Dig | 3 | charge:true |

Total tagged: **10**  ·  4 legal but unused  ·  share: **0.6%**

## `inflictsParalysis` — P(paralysis): x0.5 their speed, plus 12.5% lost turns

*Changes who moves first, which most kill features hang off. Champions uses 12.5% full-para, not the 25% everywhere else*

| entry | appearances | parameter |
|---|---|---|
| Thunderbolt | 1,874 | p:0.1,via:secondary |
| Zap Cannon | 1,077 | p:1,via:secondary |
| Discharge | 406 | p:0.3,via:secondary |
| Thunder Wave | 287 | p:0.9,via:primary |
| Thunder Punch | 205 | p:0.1,via:secondary |
| Thunder | 182 | p:0.3,via:secondary |
| Volt Tackle | 145 | p:0.1,via:secondary |
| Nuzzle | 110 | p:1,via:secondary |
| Body Slam | 72 | p:0.3,via:secondary |
| Glare | 20 | p:1,via:primary |
| Stun Spore | 12 | p:0.75,via:primary |
| Thunder Fang | 6 | p:0.1,via:secondary |

Total tagged: **13**  ·  1 legal but unused  ·  share: **0.6%**

## `inflictsFreeze` — P(freeze): they lose turns until thawed

*7,441 appearances carry a freeze secondary -- Ice Beam, Blizzard. Rarer than sleep and harder to remove*

| entry | appearances | parameter |
|---|---|---|
| Blizzard | 1,547 | p:0.1,via:secondary |
| Ice Punch | 1,432 | p:0.1,via:secondary |
| Ice Beam | 561 | p:0.1,via:secondary |
| Ice Fang | 433 | p:0.1,via:secondary |

Total tagged: **4**  ·  share: **0.6%**

## `neverMissesAttack` — P(hit) = 1 on a DAMAGING move

*Kowtow Cleave (2,970 uses), Aura Sphere, Flower Trick, Aerial Ace. Never discounted by accuracy, so the kill is as certain as the roll allows. 1.5% of slots against 156,486 uses of attacks that can miss*

| entry | appearances | parameter |
|---|---|---|
| Kowtow Cleave | 3,006 | pHit:1 |
| Aura Sphere | 688 | pHit:1 |
| Flower Trick | 124 | pHit:1 |
| Aerial Ace | 23 | pHit:1 |
| Clear Smog | 6 | pHit:1 |

Total tagged: **8**  ·  3 legal but unused  ·  share: **0.6%**

## `inflictsPoison` — P(poison): flat 1/8 chip a turn

*Poison Jab (758 uses), Baneful Bunker on contact. Prices the long game, not this turn*

| entry | appearances | parameter |
|---|---|---|
| Sludge Bomb | 2,005 | p:0.3,via:secondary |
| Poison Jab | 767 | p:0.3,via:secondary |
| Baneful Bunker | 451 | p:1,via:contact with the shield |
| Gunk Shot | 224 | p:0.3,via:secondary |
| Sludge Wave | 98 | p:0.1,via:secondary |
| Barb Barrage | 22 | p:0.5,via:secondary |
| Mortal Spin | 21 | p:1,via:secondary |
| Shell Side Arm | 9 | p:0.2,via:secondary |
| Toxic Thread | 6 | p:1,via:primary |
| Cross Poison | 1 | p:0.1,via:secondary |

Total tagged: **11**  ·  1 legal but unused  ·  share: **0.5%**

## `pivotDamaging` — damages, then the user leaves

*U-turn, Flip Turn, Volt Switch. Chip plus momentum, and no switch feature can see either*

| entry | appearances | parameter |
|---|---|---|
| Flip Turn | 1,774 | selfSwitch:true |
| Volt Switch | 992 | selfSwitch:true |
| U-turn | 749 | selfSwitch:true |

Total tagged: **3**  ·  share: **0.5%**

## `locksTarget` — their option set collapses to one specific move, or loses one

*Encore pins them to their last move, Disable removes it, Torment blocks the repeat. stallIntoEncore already prices the Encore case from the RECEIVING end*

| entry | appearances | parameter |
|---|---|---|
| Encore | 2,786 | locks:encore |
| Disable | 416 | locks:disable |
| Torment | 4 | locks:torment |

Total tagged: **3**  ·  share: **0.5%**

## `oneTurnGuard` — blocks ONE NAMED CLASS of move, for one turn, for my whole side

*Wide Guard blanks spread (2,065 uses), Quick Guard blanks priority (356) -- including Fake Out at 7,846 uses. Different threats, and nothing scores either*

| entry | appearances | parameter |
|---|---|---|
| Wide Guard | 2,098 | blocks:spread moves |
| Quick Guard | 366 | blocks:priority moves |

Total tagged: **2**  ·  share: **0.4%**

## `healsAlly` — restores my PARTNER max-HP share

*Heal Pulse, Life Dew, Floral Healing. Already a pair feature in DODUO and nothing in the single-move vector*

| entry | appearances | parameter |
|---|---|---|
| Life Dew | 1,694 | heal:[1,4] |
| Strength Sap | 519 | heal:true |
| Heal Pulse | 62 | heal:true |

Total tagged: **3**  ·  share: **0.3%**

## `setsWeather` — weather := x

*and whether that weather HELPS is the thing nothing currently asks (task #19)*

| entry | appearances | parameter |
|---|---|---|
| Rain Dance | 704 | weather:RainDance |
| Sunny Day | 379 | weather:sunnyday |
| Chilly Reception | 17 | weather:snowscape |
| Sandstorm | 4 | weather:Sandstorm |
| Snowscape | 3 | weather:snowscape |

Total tagged: **5**  ·  share: **0.2%**

## `recharge` — costs the turn AFTER it lands

*Hyper Beam. A free turn for the opponent*

| entry | appearances | parameter |
|---|---|---|
| Hyper Beam | 1,026 | recharge:true |
| Giga Impact | 20 | recharge:true |
| Hydro Cannon | 16 | recharge:true |
| Blast Burn | 3 | recharge:true |

Total tagged: **6**  ·  2 legal but unused  ·  share: **0.2%**

## `inflictsSleep` — P(sleep): they lose turns outright

*The most valuable status in the game and the one Electric Terrain blanks*

| entry | appearances | parameter |
|---|---|---|
| Sleep Powder | 742 | p:0.75,via:primary |
| Hypnosis | 278 | p:0.6,via:primary |
| Spore | 3 | p:1,via:primary |

Total tagged: **4**  ·  1 legal but unused  ·  share: **0.2%**

## `forbidsStatusMoves` — the whole Status CATEGORY becomes unclickable for them

*Taunt. Deletes every Protect, setup move and Tailwind at once -- 38.5% of their move slots by share. Same restriction Assault Vest applies to its own holder*

| entry | appearances | parameter |
|---|---|---|
| Taunt | 881 | forbids:Status |

Total tagged: **1**  ·  share: **0.1%**

## `inflictsToxic` — P(badly poisoned): n/16 ESCALATING, not a flat 1/8

*Toxic, 480 uses. By turn six it is doing more than triple what regular poison does, so it is a different clock entirely*

| entry | appearances | parameter |
|---|---|---|
| Toxic | 495 | p:0.9,via:primary |
| Poison Fang | 5 | p:0.5,via:secondary |

Total tagged: **2**  ·  share: **0.1%**

## `substitute` — an HP buffer that absorbs hits and blanks status until it breaks

*Its own class. Sound moves go through it, and the damage needed to break it is a real number the kill calculation would have to clear first*

| entry | appearances | parameter |
|---|---|---|
| Substitute | 247 | buffer:0.25 |
| Shed Tail | 41 | buffer:0.25 |

Total tagged: **2**  ·  share: **0.0%**

## `userFaints` — the user dies as the cost

*Memento, Explosion, Final Gambit, Healing Wish. Final Gambit is 176 uses and deals damage equal to the user remaining HP, which the damage engine reads as ZERO*

| entry | appearances | parameter |
|---|---|---|
| Final Gambit | 180 | faints:ifHit |
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
| Psychic Terrain | 52 | terrain:psychicterrain |
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
| Chople Berry | 1,441 | halves:true |
| Colbur Berry | 1,256 | halves:true |
| Kasib Berry | 1,102 | halves:true |
| Occa Berry | 650 | halves:true |
| Roseli Berry | 511 | halves:true |
| Passho Berry | 487 | halves:true |
| Coba Berry | 401 | halves:true |
| Shuca Berry | 266 | halves:true |
| Haban Berry | 112 | halves:true |
| Babiri Berry | 70 | halves:true |
| Yache Berry | 47 | halves:true |
| Kebia Berry | 39 | halves:true |
| Wacan Berry | 36 | halves:true |
| Charti Berry | 32 | halves:true |
| Rindo Berry | 23 | halves:true |
| Payapa Berry | 6 | halves:true |

Total tagged: **18**  ·  2 legal but unused  ·  share: **9.5%**

## `damageMultType` — x1.2 on one type  **← NOT READ**

*Charcoal, Black Glasses, Mystic Water, Fairy Feather. About 6.7% of held items and a pure calculation error*

| entry | appearances | parameter |
|---|---|---|
| Fairy Feather | 1,521 | mult:1.2 |
| Black Glasses | 1,332 | mult:1.2 |
| Mystic Water | 873 | mult:1.2 |
| Charcoal | 694 | mult:1.2 |
| Never-Melt Ice | 393 | mult:1.2 |
| Sharp Beak | 302 | mult:1.2 |
| Metal Coat | 212 | mult:1.2 |
| Dragon Fang | 117 | mult:1.2 |
| Silk Scarf | 102 | mult:1.2 |
| Spell Tag | 79 | mult:1.2 |
| Magnet | 77 | mult:1.2 |
| Soft Sand | 75 | mult:1.2 |
| Miracle Seed | 48 | mult:1.2 |
| Black Belt | 36 | mult:1.2 |
| Twisted Spoon | 26 | mult:1.2 |
| Hard Stone | 23 | mult:1.2 |
| Poison Barb | 6 | mult:1.2 |
| Silver Powder | 2 | mult:1.2 |

Total tagged: **18**  ·  share: **8.6%**

## `extendsScreens` — side conditions last 8 turns not 5  **← NOT READ**

*3.1% of items*

| entry | appearances | parameter |
|---|---|---|
| Light Clay | 2,016 | turns:8 |

Total tagged: **1**  ·  share: **2.9%**

## `restoresStats` — undoes stat drops once  **← NOT READ**

*2.1% of items, and it changes what a drop is worth*

| entry | appearances | parameter |
|---|---|---|
| White Herb | 1,362 | restores:true |

Total tagged: **1**  ·  share: **2.0%**

## `accuracyMod` — P(hit) is scaled, for or against the holder  **← NOT READ**

*Bright Powder makes attacks against the holder 0.9x; Wide Lens (411 uses) makes the holder 1.1x. Feeds the same P(hit) the kill distribution consumes*

| entry | appearances | parameter |
|---|---|---|
| Wide Lens | 414 | accuracy:true |
| Bright Powder | 144 | accuracy:true |
| Zoom Lens | 22 | accuracy:true |

Total tagged: **3**  ·  share: **0.8%**

## `curesStatus` — a status is removed the moment it lands  **← NOT READ**

*Lum (107 uses), Chesto, Rawst. Every status move aimed at the holder is a wasted turn, and inflictsStatus has no idea*

| entry | appearances | parameter |
|---|---|---|
| Lum Berry | 108 | cures:true |
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
| Charizardite Y | 2,223 | into:{Charizard:Charizard-Mega-Y} |
| Staraptite | 1,956 | into:{Staraptor:Staraptor-Mega} |
| Floettite | 1,455 | into:{Floette-Eternal:Floette-Mega} |
| Swampertite | 1,351 | into:{Swampert:Swampert-Mega} |
| Metagrossite | 1,189 | into:{Metagross:Metagross-Mega} |
| Raichunite Y | 1,076 | into:{Raichu:Raichu-Mega-Y} |
| Aerodactylite | 847 | into:{Aerodactyl:Aerodactyl-Mega} |
| Delphoxite | 782 | into:{Delphox:Delphox-Mega} |
| Mawilite | 680 | into:{Mawile:Mawile-Mega} |
| Tyranitarite | 643 | into:{Tyranitar:Tyranitar-Mega} |
| Froslassite | 548 | into:{Froslass:Froslass-Mega} |
| Gengarite | 446 | into:{Gengar:Gengar-Mega} |
| Venusaurite | 409 | into:{Venusaur:Venusaur-Mega} |
| Blastoisinite | 357 | into:{Blastoise:Blastoise-Mega} |
| Dragoninite | 289 | into:{Dragonite:Dragonite-Mega} |
| Scovillainite | 284 | into:{Scovillain:Scovillain-Mega} |
| Blazikenite | 277 | into:{Blaziken:Blaziken-Mega} |
| Eelektrossite | 259 | into:{Eelektross:Eelektross-Mega} |
| Scraftinite | 247 | into:{Scrafty:Scrafty-Mega} |
| Raichunite X | 217 | into:{Raichu:Raichu-Mega-X} |
| Gardevoirite | 197 | into:{Gardevoir:Gardevoir-Mega} |
| Cameruptite | 196 | into:{Camerupt:Camerupt-Mega} |
| Sceptilite | 195 | into:{Sceptile:Sceptile-Mega} |
| Pyroarite | 188 | into:{Pyroar:Pyroar-Mega} |
| Glimmoranite | 163 | into:{Glimmora:Glimmora-Mega} |
| Dragalgite | 145 | into:{Dragalge:Dragalge-Mega} |
| Meganiumite | 139 | into:{Meganium:Meganium-Mega} |
| Kangaskhanite | 133 | into:{Kangaskhan:Kangaskhan-Mega} |
| Malamarite | 90 | into:{Malamar:Malamar-Mega} |
| Garchompite | 85 | into:{Garchomp:Garchomp-Mega} |
| Lopunnite | 78 | into:{Lopunny:Lopunny-Mega} |
| Lucarionite | 72 | into:{Lucario:Lucario-Mega} |
| Gyaradosite | 71 | into:{Gyarados:Gyarados-Mega} |
| Charizardite X | 65 | into:{Charizard:Charizard-Mega-X} |
| Scizorite | 65 | into:{Scizor:Scizor-Mega} |
| Greninjite | 59 | into:{Greninja:Greninja-Mega} |
| Starminite | 59 | into:{Starmie:Starmie-Mega} |
| Clefablite | 54 | into:{Clefable:Clefable-Mega} |
| Drampanite | 53 | into:{Drampa:Drampa-Mega} |
| Excadrite | 53 | into:{Excadrill:Excadrill-Mega} |
| *…35 more* | | |

Total tagged: **75**  ·  share: **27.0%**

## `survivesFromFull` — a lethal hit from full HP leaves 1

*Focus Sash, the most-held item in the format. Broken by multi-hit moves and by any prior chip*

| entry | appearances | parameter |
|---|---|---|
| Focus Sash | 7,693 | survives:true |

Total tagged: **1**  ·  share: **11.2%**

## `healsAtHalf` — restores 25% when it drops below half

*Sitrus, 10.8% of items. Modelled in the rollout engine only, invisible to MAG*

| entry | appearances | parameter |
|---|---|---|
| Sitrus Berry | 7,132 | heal:0.25 |

Total tagged: **2**  ·  1 legal but unused  ·  share: **10.4%**

## `damageMultAll` — x damage on everything

*Life Orb 1.3, at a cost this does not model*

| entry | appearances | parameter |
|---|---|---|
| Life Orb | 6,301 | mult:1.3 |

Total tagged: **1**  ·  share: **9.2%**

## `passiveHeal` — restores HP every turn

*changes how many turns a kill takes*

| entry | appearances | parameter |
|---|---|---|
| Leftovers | 4,336 | heal:0.0625 |

Total tagged: **1**  ·  share: **6.3%**

## `choiceLock` — the holder is locked into one move

*the single strongest thing an open sheet tells you about what they can do next turn*

| entry | appearances | parameter |
|---|---|---|
| Choice Scarf | 3,947 | choice:true |

Total tagged: **1**  ·  share: **5.8%**

## `speedMult` — speed x1.5

*order, which most kill features hang off*

| entry | appearances | parameter |
|---|---|---|
| Choice Scarf | 3,947 | mult:1.5 |

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
| Rough Skin | 3,762 | profits:true |
| Stamina | 1,643 | profits:true |
| Cursed Body | 837 | profits:true |
| Toxic Debris | 417 | profits:true |
| Static | 278 | profits:true |
| Flame Body | 114 | profits:true |
| Illusion | 63 | profits:true |
| Poison Point | 51 | profits:true |
| Cute Charm | 48 | profits:true |
| Electromorphosis | 48 | profits:true |
| Justified | 29 | profits:true |
| Wandering Spirit | 21 | profits:true |
| Effect Spore | 20 | profits:true |
| Mummy | 16 | profits:true |
| Gooey | 10 | profits:true |
| Weak Armor | 9 | profits:true |
| Sand Spit | 4 | profits:true |

Total tagged: **32**  ·  15 legal but unused  ·  share: **10.7%**

## `weatherSetter` — weather := x on switch-in  **← NOT READ**

*and megaing can COST you it, which is Will's reason to decline a mega*

| entry | appearances | parameter |
|---|---|---|
| Drizzle | 2,213 | sets:true |
| Snow Warning | 954 | sets:true |
| Sand Stream | 848 | sets:true |
| Drought | 621 | sets:true |

Total tagged: **8**  ·  4 legal but unused  ·  share: **6.7%**

## `preventsStatDrop` — stat drops simply do not apply  **← NOT READ**

*Clear Body (2.03%), Flower Veil for the ally. Intimidate and every -1 move do nothing, so lowersTarget is worth zero into them*

| entry | appearances | parameter |
|---|---|---|
| Flower Veil | 1,465 | prevents:true |
| Clear Body | 1,331 | prevents:true |
| Hyper Cutter | 378 | prevents:true |
| Inner Focus | 377 | prevents:true |
| Oblivious | 277 | prevents:true |
| Scrappy | 262 | prevents:true |
| Mirror Armor | 226 | prevents:true |
| Own Tempo | 44 | prevents:true |
| Illuminate | 27 | prevents:true |
| Keen Eye | 27 | prevents:true |
| Big Pecks | 13 | prevents:true |
| White Smoke | 1 | prevents:true |

Total tagged: **15**  ·  3 legal but unused  ·  share: **6.4%**

## `boostsWhenLowered` — +2 to a stat when any stat is lowered  **← NOT READ**

*Defiant (5.46%) and Competitive. The Intimidate punisher -- dropping their Attack HANDS them an attack boost, so the lead interaction inverts*

| entry | appearances | parameter |
|---|---|---|
| Defiant | 3,610 | retaliates:true |
| Competitive | 815 | retaliates:true |

Total tagged: **2**  ·  share: **6.4%**

## `contactPunish` — the ATTACKER pays for touching it  **← NOT READ**

*Rough Skin (3,739), Static, Flame Body, Poison Point, Cute Charm, Effect Spore, Mummy, Gooey. Derived by reading the handler for checkMoveMakesContact*

| entry | appearances | parameter |
|---|---|---|
| Rough Skin | 3,762 | trigger:contact |
| Static | 278 | trigger:contact |
| Flame Body | 114 | trigger:contact |
| Poison Point | 51 | trigger:contact |
| Cute Charm | 48 | trigger:contact |
| Wandering Spirit | 21 | trigger:contact |
| Effect Spore | 20 | trigger:contact |
| Mummy | 16 | trigger:contact |
| Gooey | 10 | trigger:contact |

Total tagged: **14**  ·  5 legal but unused  ·  share: **6.3%**

## `healsAllyOnSwitchIn` — restores the partner on entry  **← NOT READ**

*Hospitality, 5.22% of abilities and the third most common in the format*

| entry | appearances | parameter |
|---|---|---|
| Hospitality | 3,435 | heals:true |

Total tagged: **1**  ·  share: **5.0%**

## `blocksStatusMoves` — every Status-category move fails against it  **← NOT READ**

*Good as Gold, 2.20%. Immune to Will-O-Wisp, Taunt, Encore, Thunder Wave -- the whole 38.5% of move slots that are status*

| entry | appearances | parameter |
|---|---|---|
| Good as Gold | 1,450 | blocks:Status |
| Telepathy | 116 | blocks:Status |

Total tagged: **3**  ·  1 legal but unused  ·  share: **2.3%**

## `speedOnItemLoss` — speed x2 once its item is gone  **← NOT READ**

*Unburden, 2.23%. A consumed Sash or berry doubles their speed, which flips the order mid-battle and the item tracking now makes observable*

| entry | appearances | parameter |
|---|---|---|
| Unburden | 1,465 | speedMult:2 |

Total tagged: **2**  ·  1 legal but unused  ·  share: **2.1%**

## `blocksBerries` — their berries cannot be eaten  **← NOT READ**

*Unnerve, 2.03%. Turns off Sitrus (10.8% of items) and every resist berry on the other side*

| entry | appearances | parameter |
|---|---|---|
| Unnerve | 1,329 | blocks:true |

Total tagged: **3**  ·  2 legal but unused  ·  share: **1.9%**

## `weatherChipImmune` — takes no sandstorm or snow residual damage  **← NOT READ**

*What onImmunity actually means for Sand Veil, Snow Cloak, Overcoat and Magic Guard -- and what typeImmunity was wrongly reporting until Will asked*

| entry | appearances | parameter |
|---|---|---|
| Sand Rush | 495 | chipImmune:true |
| Oblivious | 277 | chipImmune:true |
| Snow Cloak | 219 | chipImmune:true |
| Sand Veil | 135 | chipImmune:true |
| Overcoat | 90 | chipImmune:true |
| Magma Armor | 44 | chipImmune:true |
| Sand Force | 18 | chipImmune:true |
| Ice Body | 6 | chipImmune:true |

Total tagged: **8**  ·  share: **1.9%**

## `disablesAttacker` — the move I just used is removed from MY options  **← NOT READ**

*Cursed Body (833 uses). Not damage and not a stat change -- it shrinks my own option set, the same shape as locksTarget from the receiving end*

| entry | appearances | parameter |
|---|---|---|
| Cursed Body | 837 | disables:true |

Total tagged: **1**  ·  share: **1.2%**

## `accuracyMod` — P(hit) scaled, often gated on a weather or a category  **← NOT READ**

*Sand Veil (135 uses, x1.25 evasion in sand), Snow Cloak (219, in snow), Compound Eyes, Victory Star, Hustle, Wonder Skin, No Guard. Same P(hit) the kill distribution needs*

| entry | appearances | parameter |
|---|---|---|
| Snow Cloak | 219 | accuracy:true |
| Compound Eyes | 210 | accuracy:true |
| Sand Veil | 135 | accuracy:true |
| Hustle | 9 | accuracy:true |
| Tangled Feet | 2 | accuracy:true |

Total tagged: **6**  ·  1 legal but unused  ·  share: **0.8%**

## `statusImmune` — a status cannot land  **← NOT READ**

*Limber, Immunity, Insomnia, Vital Spirit, Water Veil, Magma Armor. onSetStatus only -- onImmunity also means weather-chip immunity and was over-capturing*

| entry | appearances | parameter |
|---|---|---|
| Leaf Guard | 75 | immune:true |
| Water Bubble | 73 | immune:true |
| Limber | 63 | immune:true |
| Insomnia | 39 | immune:true |
| Purifying Salt | 35 | immune:true |
| Vital Spirit | 3 | immune:true |
| Immunity | 1 | immune:true |

Total tagged: **12**  ·  5 legal but unused  ·  share: **0.4%**

## `ignoresStatStages` — the boost multiplier does not apply, permanently  **← NOT READ**

*Unaware, 172 uses. Ignores the opponent stat stages in BOTH directions, so their setup is worthless and so is yours. Same parameter Darkest Lariat sets for one move*

| entry | appearances | parameter |
|---|---|---|
| Unaware | 173 | ignores:all opposing stages |

Total tagged: **1**  ·  share: **0.3%**

## `survivesFromFull` — a lethal hit from full HP leaves 1  **← NOT READ**

*Sturdy. Identical to Focus Sash and NOT modelled anywhere -- verified 0 mentions*

| entry | appearances | parameter |
|---|---|---|
| Sturdy | 154 | survives:true |

Total tagged: **1**  ·  share: **0.2%**

## `ignoresDefenderAbility` — suppress every defender-side ability tag for this move  **← NOT READ**

*Mold Breaker, Turboblaze, Teravolt. Gates typeImmunity, damageReduce, blocksMove, preventsCrit and Sturdy in one flag*

| entry | appearances | parameter |
|---|---|---|
| Mold Breaker | 130 | ignoresDefAbility:true |

Total tagged: **3**  ·  2 legal but unused  ·  share: **0.2%**

## `preventsCrit` — P(crit) = 0  **← NOT READ**

*Shell Armor and Battle Armor. Turns Flower Trick from a guaranteed crit into an ordinary hit*

| entry | appearances | parameter |
|---|---|---|
| Disguise | 64 | pCrit:0 |
| Shell Armor | 25 | pCrit:0 |

Total tagged: **4**  ·  2 legal but unused  ·  share: **0.1%**

## `critDamageUp` — the CRIT MULTIPLIER itself, not its probability  **← NOT READ**

*Sniper (Will raised it). Three separate crit parameters exist and the taxonomy had only two: probability (Scope Lens, Flower Trick), prevention (Shell Armor) and now the multiplier. Crit damage is x1.5 and Sniper makes it x1.5 again, so x2.25 total -- it was x3 in the old gens when crits themselves were x2, which is where the folklore comes from*

| entry | appearances | parameter |
|---|---|---|
| Sniper | 24 | critMult:1.5 |

Total tagged: **1**  ·  share: **0.0%**

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
| Blaze | 2,722 | boost:true |
| Pixilate | 1,448 | boost:true |
| Torrent | 1,093 | boost:true |
| Solar Power | 432 | boost:true |
| Overgrow | 362 | boost:true |
| Technician | 344 | boost:true |
| Tough Claws | 272 | boost:true |
| Sharpness | 155 | boost:true |
| Sheer Force | 94 | boost:true |
| Huge Power | 75 | boost:true |
| Water Bubble | 73 | boost:true |
| Supreme Overlord | 60 | boost:true |
| Iron Fist | 55 | boost:true |
| Swarm | 27 | boost:true |
| Reckless | 21 | boost:true |
| Mega Launcher | 20 | boost:true |
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

Total tagged: **44**  ·  18 legal but unused  ·  share: **10.6%**

## `onSwitchInDrop` — stat stages on the foe at switch-in

*Intimidate. Beaten by Clear Amulet and by White Herb, neither of which is checked*

| entry | appearances | parameter |
|---|---|---|
| Intimidate | 6,604 | drop:true |
| Supersweet Syrup | 13 | drop:true |

Total tagged: **3**  ·  1 legal but unused  ·  share: **9.6%**

## `priorityMod` — order shifts for a class of move

*Prankster, Gale Wings, Triage. stallIntoEncore already depends on it*

| entry | appearances | parameter |
|---|---|---|
| Prankster | 4,692 | priority:true |
| Gale Wings | 493 | priority:true |
| Scrappy | 262 | priority:true |
| Stance Change | 149 | priority:true |
| Mold Breaker | 130 | priority:true |
| Sheer Force | 94 | priority:true |
| Infiltrator | 56 | priority:true |
| Illuminate | 27 | priority:true |
| Keen Eye | 27 | priority:true |
| Stalwart | 27 | priority:true |
| Skill Link | 4 | priority:true |
| Long Reach | 2 | priority:true |

Total tagged: **22**  ·  10 legal but unused  ·  share: **8.6%**

## `typeImmunity` — damage of one TYPE := 0

*Levitate, Water Absorb, Flash Fire, Sap Sipper. Clicking into one wastes the turn entirely*

| entry | appearances | parameter |
|---|---|---|
| Levitate | 1,785 | immune:true,via:not derivable -- no handler |
| Lightning Rod | 1,302 | immune:true,via:onTryHit |
| Flash Fire | 357 | immune:true,via:onTryHit |
| Dry Skin | 52 | immune:true,via:onTryHit |
| Volt Absorb | 33 | immune:true,via:onTryHit |
| Earth Eater | 31 | immune:true,via:onTryHit |
| Sap Sipper | 22 | immune:true,via:onTryHit |
| Water Absorb | 15 | immune:true,via:onTryHit |
| Motor Drive | 13 | immune:true,via:onTryHit |

Total tagged: **11**  ·  2 legal but unused  ·  share: **5.2%**

## `stabBoost` — STAB becomes x2 instead of x1.5

*Adaptability, 4.34% of abilities. A flat 33% damage increase on same-type moves and nothing was reading it*

| entry | appearances | parameter |
|---|---|---|
| Adaptability | 2,855 | stab:2 |

Total tagged: **1**  ·  share: **4.1%**

## `speedCond` — speed x2 under a condition

*Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Unburden, Quick Feet. Already probed for the speed order*

| entry | appearances | parameter |
|---|---|---|
| Chlorophyll | 1,151 | conditional:true |
| Sand Rush | 495 | conditional:true |
| Swift Swim | 325 | conditional:true |
| Surge Surfer | 8 | conditional:true |
| Slush Rush | 4 | conditional:true |
| Quick Feet | 2 | conditional:true |

Total tagged: **7**  ·  1 legal but unused  ·  share: **2.9%**

## `blocksMove` — a whole class of move fails

*already derived for allySideBlockProb -- Dazzling, Armor Tail, Good as Gold*

| entry | appearances | parameter |
|---|---|---|
| Armor Tail | 1,699 | blocks:true |
| Queenly Majesty | 226 | blocks:true |

Total tagged: **3**  ·  1 legal but unused  ·  share: **2.8%**

## `healsOnSwitchOut` — restores a third of max HP by leaving

*Regenerator. Makes switching a HEAL, which is the strongest argument for pivoting that the switch features cannot see*

| entry | appearances | parameter |
|---|---|---|
| Regenerator | 555 | heal:0.3333333333333333 |
| Zero to Hero | 115 | heal:0.3333333333333333 |
| Natural Cure | 38 | heal:0.3333333333333333 |

Total tagged: **3**  ·  share: **1.0%**

## `reducesAllyDamage` — my PARTNER takes x0.75

*Friend Guard. Changes every damage number aimed at the partner and nothing applies it*

| entry | appearances | parameter |
|---|---|---|
| Friend Guard | 623 | mult:0.75 |

Total tagged: **1**  ·  share: **0.9%**

## `damageReduce` — x<1 damage taken

*Filter, Solid Rock, Multiscale, Thick Fat, Heatproof, Fluffy. Overcalling kills without them*

| entry | appearances | parameter |
|---|---|---|
| Multiscale | 353 | reduce:true |
| Solid Rock | 170 | reduce:true |
| Fluffy | 3 | reduce:true |

Total tagged: **9**  ·  6 legal but unused  ·  share: **0.8%**

## `formeChange` — the species changes mid-battle

*Zero to Hero (needs a switch), Illusion, Imposter, Disguise*

| entry | appearances | parameter |
|---|---|---|
| Zero to Hero | 115 | changes:true |
| Disguise | 64 | changes:true |
| Illusion | 63 | changes:true |
| Imposter | 39 | changes:true |

Total tagged: **7**  ·  3 legal but unused  ·  share: **0.4%**

## `invertsBoosts` — stat changes flip sign

*Contrary and Simple, already probed for expectedBoostSign*

| entry | appearances | parameter |
|---|---|---|
| Contrary | 134 | inverts:true |

Total tagged: **3**  ·  2 legal but unused  ·  share: **0.2%**

## `redirectsType` — draws that type to itself

*Lightning Rod and Storm Drain redirect AND boost*

*Nothing carrying this tag appears on any real team.*

Total tagged: **0**  ·  share: **0.0%**
