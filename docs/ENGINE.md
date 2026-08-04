# ENGINE — does the simulator do what Pokémon does

**Owns:** `engine/medicham2-browser.js`, `data/abra-tags.js`, `tests/test-mechanics.js`,
`tests/walk_tags.js`, `tests/test-engine-diff.js`, `tests/mechanics_rank.js`

**Its one number:** mechanics live. **It must never go down.**

**May not:** claim a strength gain (that is SEARCH, gated by MEASURE), change what board.js
*means* by a feature, or land during a fit or self-play run.

<!-- GENERATED: engine/status.js -->

```
ENGINE — does the simulator do what Pokémon does
  90/142 probed mechanics live, 52 missing   (census 2026-08-04 07:27)
  missing:
    move    conditionalPower       Facade doubles when statused
    ability damageReduce           Ice Scales halves special damage
    move    ignoresProtect         Feint goes through Protect
    move    recharge               Giga Impact costs the following turn
    move    needsTargetToAttack    Avalanche doubles after being hit
    move    needsUntrackedState    Gyro Ball scales with the speed gap
    ability redirectsType          Lightning Rod pulls an Electric move
    ability blocksBerries          Unnerve stops the foe eating a berry
    ability disablesAttacker       Cursed Body can disable the move that hit it
    item    restoresStats          White Herb undoes a stat drop
    move    statChangeInCode       Belly Drum maxes Attack
    move    proceduralStatus       Tri Attack can burn, freeze or paralyse
    move    drain                  Drain Punch heals the user
    move    redirects              Follow Me pulls the attack onto the partner
    item    choiceLock             Choice Scarf locks the holder into its first move
    move    multiHit               Rock Blast lands more than one hit
    move    overridesEffectiveness Freeze-Dry beats Ice Beam into a Water type
    ability reducesAllyDamage      Friend Guard cuts what the partner takes
    ability poisonsOnMyContact     Poison Touch poisons on a contact hit
    ability immuneToMoveClass      Bulletproof refuses Rock Blast
    ability writesAccuracy         No Guard makes an 80%-accurate move land on a losing roll
    ability accuracyMod            Sand Veil makes the attacker miss a roll it would have hit
    ability boostsEachTurn         Speed Boost raises Speed every turn
    ability healsOnSwitchOut       Regenerator heals a third on the way out
    move    fixedDamage            Seismic Toss deals the level, whoever it hits
    move    costsUserHP            Substitute costs the user a quarter
    move    partialTrap            Infestation chips at the end of each turn
    move    blocksSoundMoves       Throat Chop stops the target using a sound move
    move    punishesContact        Spiky Shield hurts the attacker it blocked
    move    critRatioUp            Night Slash is priced above the same move without its crit ratio
    move    clearsBoosts           Haze wipes the boosts off both sides
    move    cantUseTwice           Gigaton Hammer cannot be clicked twice in a row
    move    terrainScaled          Expanding Force gains power on Psychic Terrain
    move    swapsStat              Foul Play attacks with the TARGET Attack
    ability formeChange            Disguise eats the first hit
    ability untagged               Marvel Scale raises Defense while statused
    ability halvesTypeDamage       Dry Skin takes 1.25x from Fire
    ability ignoresDefenderAbility Mold Breaker ignores Levitate
    ability ignoresTypeImmunity    Scrappy lets Normal hit a Ghost
    ability noRecoil               Rock Head takes no recoil
    move    alwaysCrit             Flower Trick always crits
    move    forcesSwitch           Dragon Tail drags the target out
    move    crashOnMiss            High Jump Kick hurts the user when it misses
    move    userFaints             Explosion faints its user
    item    curesStatus            Lum Berry cures the status it was just given
    ability typeBecomesMoveType    Protean makes the user the type it just used
    ability blocksExplosion        Damp stops Explosion happening at all
    move    hazard                 Stealth Rock chips what comes in afterwards
    move    blocksHealing          Psychic Noise stops the target healing
    move    reordersTurn           After You lets the partner move next
    item    curesVolatile          Mental Herb frees the holder from Taunt
    move    multiAccuracy          Triple Axel rolls accuracy on every hit
  4/400 differential comparisons disagree with Showdown   (2026-08-04 07:25)
    spiritomb foulplay -> wyrdeer: showdown 178-178, medicham 132-156  (734 uses)
    klefki foulplay -> pangoro: showdown 19-23, medicham 8-10  (734 uses)
    chesnaught woodhammer -> mimikyu: showdown 0-0, medicham 120-130  (54 uses)
    houndoom fireblast -> heliolisk: showdown 123-137, medicham 99-117  (50 uses)
    a differential hit is NOT in the census count above — the census probes what someone thought to probe
  tag coverage: 137/176 probed, 39 unprobed
```

_stamped 2026-08-04 07:58_

<!-- /GENERATED -->

## The working rule

**A mechanic is not open work until a probe fails on it.** Everything in the generated block above
came out of an artifact; anything in the hand list below is a claim about the engine that nothing
checks. The job of that list is to empty itself — each item becomes a probe in
`tests/test-mechanics.js`, and from then on the census carries it and the line disappears from here.

That is the whole reason the census count may never fall: it is the only number in the project that
a human cannot quietly soften.

## Hand list — found by differential testing, not yet probed

These were seen against Showdown but have no probe, so they are invisible to the census. Write the
probe first, watch it fail, then fix.

Nine items left this list on 2026-08-04 because they became probes: Freeze-Dry, Haze, Friend Guard,
Poison Touch, Gigaton Hammer, Expanding Force, Marvel Scale, Disguise and Foul Play. All nine are
red, and the census carries them now — `overridesEffectiveness`, `clearsBoosts`, `reducesAllyDamage`,
`poisonsOnMyContact`, `cantUseTwice`, `terrainScaled`, `untagged`, `formeChange`, `swapsStat`.

- **Dry Skin's Fire vulnerability** — x1.25 taken from Fire, and the engine does not apply it.
  `houndoom fireblast -> heliolisk` reads 123-137 on Showdown and 99-117 here, which is 1.24. The
  artifact records Dry Skin only as `typeImmunity{type:"Water", via:"onTryHit"}`; the Fire half is
  not tagged at all, so this cannot be wired from `abra-tags.js` as it stands. Not probed because a
  probe with nothing behind it to read is a probe with no derivation — needs the tag first, and the
  tag file is ENGINE's, so this is ours.
- **Rivalry** — x1.25 into the same gender, x0.75 into the opposite, x1.0 if either is genderless.
  Wholly absent. Blocked on data, not on will: `MC.mons` carries no gender and `buildMon` returns
  none, and `data/engine-data.js` belongs to MEASURE. Its `damageBoost` tag carries a bare
  `mult:1.25` with no condition and 43 other members including Blaze 1.5 and Slow Start 0.5, so it
  cannot be wired from the artifact as it stands. The differential can no longer see it either:
  CONTROL FIX 6 sets `gender:'N'` on both sides, because `gender:''` made Showdown roll one off the
  battle seed and MEDICHAM has none — a seed-dependent x0.75 nothing could match.

## Filed, not fixed

- **The differential passes a false PASS on Bulletproof.** `forretress rockblast -> kommoo` reads
  5-6 on both sides and is scored AGREE. Showdown's `moveHit` does not run the ability's `TryHit`,
  the same hole CONTROL FIX 5 closed for the absorb abilities, and `immuneToMoveClass` is the class
  it is still open for: Bulletproof (84 uses), Soundproof (344) and Overcoat (240). Tightening the
  harness converts that false pass into a true engine bug, so it lands WITH the engine fix and not
  before — a red test with nothing beside it is what CLAUDE.md bans filing.
- **`engine/status.js` prints the differential count without its seed.** The artifact now carries
  `seed` and `requested`; the print does not read them, so "4/400 differential comparisons disagree"
  still looks unconditional. `status.js` is MEASURE's file. One line.
- **`battleResult` cannot tell a finished battle from an expired clock.** `medicham2-browser.js:1802`
  scores bodies-then-HP unconditionally; `battleOver` returns true for a wipeout *and* for
  `S.turn >= maxTurns`, and the caller cannot distinguish them from the return value. Every
  cap-expired playout is therefore a material count returned as a win probability, silently.
  Filed by SEARCH 2026-08-04 while testing whether that was the cause of the flat leaf calibration.
  **It is not** — measured by wrapping `battleResult` over 1.1M playouts, 99.5–99.8% end by an actual
  wipeout at every explore setting and at horizons 20 and 60, and cap-hits run 0.2–0.5%. So this is a
  latent hazard, not a live defect, and it is filed rather than ranked. The cheap fix is for
  `battleResult` to return the reason beside the score so a caller can weight or discard those rows;
  do not change what it *scores*, which several artifacts depend on.

## The authorised list — LANDED vs PREPARED

Will's "fix all that" of 2026-08-04 turned six filed findings into approved work. A SEARCH explore
sweep is using the engine, so `medicham2-browser.js`, `board.js`, `engine-data.js` and
`abra-tags.js` are frozen until the coordinator says CLEARED. Everything under `tests/` landed.

| # | Item | State |
|---|---|---|
| 1 | **Foul Play** — harness alignment | **LANDED.** CONTROL FIX 8 aligns all four offensive/defensive stats on BOTH bodies. Verified against the coordinator's own arithmetic: `klefki foulplay -> swampert` now reads `showdown 65-77`, exactly the predicted `43-51 × (198/130)`. The engine half is PREPARED — probe `swapsStat` is red. |
| 2 | **Disguise** | PREPARED. Probe `formeChange` is red and its control is clean (`no ability took 92, Disguise took 92`). Must be modelled as first-hit-nullified **plus** the gen-9 maxhp/8, not as a flat 0 — Showdown only reports 0 because `battle.update()` never runs here. |
| 3 | **`immuneToMoveClass`** — Bulletproof, Soundproof (344), Overcoat (240) | PREPARED. Probe red. The strict TryHit harness change is written up but **deliberately not landed**: it turns `forretress rockblast -> kommoo` from a false pass into a true red, and it must land in the same pass as the engine fix. |
| 4 | **Dry Skin's Fire x1.25** | PREPARED. Probe `halvesTypeDamage` / "Dry Skin takes 1.25x from Fire" is red. **The artifact is the blocker, not the code**: `dryskin.tags` is `["typeImmunity"]` and there is no row for the Fire half at all. `halvesTypeDamage` is the right home — Thick Fat, Heatproof, Purifying Salt and Water Bubble all carry it as `{types:[…], attackerStatMult:0.5}`, so Dry Skin wants the same shape at 1.25. |
| 5 | **Triple Axel / `basePowerCallback`** | **LANDED.** CONTROL FIX 9 sets `move.hit = 1`. Measured: unset returns 0, set returns 72. Three instrument lines landed with it — a derived print of the corpus moves whose base power reads `move.hit` (exactly one, `tripleaxel`), a count of comparisons whose move has a callback (15 of 400), and a SUSPECT marker on any phantom zero. |
| 6 | `train_policy.js` `writeWeights` provenance | NOT DONE. Out of time, and it is a provenance bug on a file a running sweep may be writing. Reported rather than half-landed. |

**The mechanism in item 5 was diagnosed wrongly first and the correction matters.** A starved
`basePowerCallback` does compute NaN, but Showdown clamps before it reaches the target's HP, so the
row comes back as a clean, plausible, entirely fake **zero** — not a NaN. A `Number.isFinite` guard
therefore does *not* catch it and has never fired on this corpus; the guard is kept and says so in
its own comment, and the phantom zero is caught by the SUSPECT marker instead. A fix aimed at the
wrong mechanism is still a bug.

## Ranked engine fixes — every one has a red probe behind it

The 2026-08-04 tag walk added 88 probes and moved the census from 54 probed to 142. `missing` rose
from 12 to 52, which is the census getting HONEST rather than the engine getting worse: `live` went
42 → 90 and not one previously-live probe fell. Ranked by corpus uses, then by how badly wrong the
behaviour is, with Lesson 3 applied by hand.

**Six of these were my probe being wrong, not the engine, and each was caught by its own control
before it reached this list** — a spread move aimed where a single-target one was needed, Close
Combat fired at a Ghost that is immune to it, Toxic fired at a Steel that cannot be poisoned, and a
Fly declared by a Pokemon slower than its attacker (which the real game also lets through). That is
Lesson 5 for the sixteenth-through-nineteenth time, and it is why every probe here prints BOTH arms.

1. **`redirects` — 7,240 (Rage Powder 5,874, Follow Me 1,366). Take this first, and not for the
   usage.** The failure is worse than absence: the attack *vanishes*. Probe reads
   `no Follow Me: aimed 92 / partner 0 | Follow Me: aimed 0 / partner 0` — nobody takes it. Every
   Rage Powder in every rollout ever run has been a free team-wide Protect, and the searcher
   maximises exactly the lines its model is most optimistic about (Lesson 2). `redirectsType`
   (Lightning Rod, 1,901) is the same bug through a different door and reads the same way.
2. **`drain` — 8,553 (Matcha Gotcha 4,957, Giga Drain 1,255, Drain Punch 916, Draining Kiss 814).**
   `move dealt 51 to the foe; user 85 -> 85 hp`. The damage lands and the heal is dropped, so the
   most-clicked recovery route in the format is worth nothing.
3. **`choiceLock` — 5,886.** Not unimplemented: `tests/test-choice-lock.js` asserts it four ways and
   passes, on `board.js`. MEDICHAM obeys whatever action it is handed. Two engines disagreeing about
   a FACT is the CLAUDE.md rule this project has broken most expensively.
4. **`multiHit` — 4,655 (Dual Wingbeat 2,675, Twin Beam 676, Triple Axel 522, Population Bomb 385).**
   Priced as ONE hit. Dual Wingbeat is exactly half its real damage; Population Bomb about a seventh.
   The differential cannot see this — single-call `moveHit` also hits once — so only the probe can.
5. **`blocksSoundMoves` — 2,726 (Throat Chop).** One move, all real clicks, no effect at all.
6. **`punishesContact` — 1,761 (Spiky Shield 887, Baneful Bunker 698, King's Shield 176).** The block
   works and the punish does not, so the three are currently just Protect.
7. **`swapsStat` / Foul Play — 734, and the only red item with an independent authority behind it.**
   Confirmed twice against Showdown in the same run and in BOTH directions —
   `spiritomb foulplay -> wyrdeer` 178 there against 132 here, `klefki foulplay -> pangoro` 19
   against 8. `dmgRange` reads the `statSwap` tag, which Foul Play does not carry; its `swapsStat`
   params say `offensiveFrom:"target"` and nothing reads that field.
8. **`overridesEffectiveness` / Freeze-Dry — 1,252.** `mrrime freezedry -> araquanid` reads 96-114 on
   Showdown and 24-28 here: the full 4x, the move's entire identity, and independently confirmed.
9. **`fixedDamage` — 1,122 (Super Fang 577, Final Gambit 250, Endeavor 93).** `mv.bp=0`, so
   `dmgRange` short-circuits and these moves are worth literally zero to the engine.
10. **`boostsEachTurn` — 1,137 (Speed Boost 700, Moody 434)** and **`healsOnSwitchOut` — 1,057
    (Regenerator 830).** Both sheet counts, but both fire on a schedule rather than on a condition,
    so the count is close to the real rate.
11. **`costsUserHP` — 929 (Substitute 528).** Resolves to `kind: affect` and costs nothing;
    Substitute is not modelled at all and the HP cost is only its visible half.
12. **`poisonsOnMyContact` — 947 (Poison Touch)**, **`reducesAllyDamage` — 875 (Friend Guard)**,
    **`immuneToMoveClass` — 838 (Soundproof 344, Overcoat 240, Bulletproof 84)**. Sheet counts, and
    Lesson 3 bites hardest on Poison Touch: it fires only on CONTACT moves, so a special attacker
    carrying it contributes to the 947 and never triggers.
13. **`clearsBoosts` — 542 (Haze).** `playerAction` resolves it to `kind: pass`, so Haze is a wasted
    turn in every rollout.
14. **`partialTrap` 772, `terrainScaled` 296, `cantUseTwice` 186, `untagged`/Marvel Scale.** Real
    but small. Infestation lands its 8 damage and then chips nothing at all; Spiky Shield (item 6)
    blocks correctly and then punishes nothing — both probes print which half happened, so neither
    can be confused with a move that never resolved.
15. **`formeChange` / Disguise — 111 sheet uses, and the count badly understates it.** Mimikyu
    appeared in three of the residual differential rows across four seeds, because every Mimikyu that
    appears at all uses Disguise on turn one. Note the artifact will not hand this to you:
    `disguise.tags` is `["preventsCrit","formeChange"]`, and `preventsCrit` also holds Battle Armor,
    Shell Armor and Ice Face.

**The second block, found by walking further down the same list.** Smaller individually, and three
of them are whole categories of turn the engine cannot represent at all:

16. **`forcesSwitch` — 513 (Roar 400, Dragon Tail 96).** The move deals its 69 damage and the drag
    does not happen, so a phazing turn is priced as a weak attack.
17. **`noRecoil` — 731 (Rock Head)**, **`curesVolatile` — 665 (Mental Herb)**,
    **`blocksExplosion` — 545 (Damp)**, **`ignoresTypeImmunity` — 469 (Scrappy)**,
    **`reordersTurn` — 463 (After You 148, Instruct 162, Quash 153)**. All sheet or click counts,
    all read identical across the knob.
18. **`userFaints` — 338.** Explosion leaves its user on full HP. **`crashOnMiss` — 199**: High Jump
    Kick misses correctly and costs nothing. **`hazard` — 195**: the switch happens and Stealth Rock
    chips a 4x-weak Staraptor for zero.
19. **`typeBecomesMoveType` — 248 (Protean)**, **`ignoresDefenderAbility` — 212 (Mold Breaker,
    verified against a Levitate hard zero)**, **`blocksHealing` — 196 (Psychic Noise)**,
    **`curesStatus` — 208 (Lum Berry 175)**.
20. **`multiAccuracy` — 907 (Triple Axel 522, Population Bomb 385), and it hides a second bug.**
    Three 90% rolls compound to about 73%, and `moveAccuracy('tripleaxel')` returns **100** — so the
    printed accuracy is wrong before the per-hit rule is even considered.
21. **`alwaysCrit` — 274 (Flower Trick 216).** Same design question as `critRatioUp` below, not a
    separate decision.

**Two that are NOT one-line fixes, called out so nobody starts them by accident:**

- **`writesAccuracy` (987) and `accuracyMod` (927) are blocked on a signature.** `moveAccuracy(id,
  field)` takes neither the attacker nor the defender, so No Guard, Compound Eyes, Sand Veil and Snow
  Cloak have nowhere to be read from. Both probes clear their control — the No Guard one pins the
  roll at 0.9 against 80% accuracy, so the control correctly MISSES — and both still read identical
  across the knob, which by Lesson 5 means unwired rather than unimportant. Changing that signature
  touches every caller.
- **`critRatioUp` (1,139) may not be a bug.** `dmgRange` models no crit anywhere, so "Night Slash is
  priced above the same move without its crit ratio" is asking for an expectation the function has
  never carried. Decide whether damage is a crit-free min/max before treating this as work.

## Ordering the queue

`tests/mechanics_rank.js` ranks unread tags by corpus usage — use it, not intuition, and read the
result against Lesson 3: **usage counts are sheet counts.** Blaze reads 4,585 uses and is worthless
because 30 of 54 entries are a Charizard that megas into Drought on turn one. Ice Scales, Filter,
Aerilate, Prism Armor, Punk Rock and Ripen read zero.

The damage disagreements in the generated block are ordered by `uses` for the same reason, and carry
the same caveat.

## Before wiring a new derived tag

Print what it matched. Every derivation over-matches on the first try — `refusesStatusMoves` caught
Telepathy and Wonder Guard, `speedOnItemLoss` caught Sticky Hold, `failsIfTargetNotAttacking` caught
Quick Guard, Wide Guard and Round. See `docs/LESSONS.md` §4.

## Done looks like

- The census `live` count is higher than it was.
- No probe that passed yesterday fails today.
- The differential test finds fewer disagreements **at the same `--seed` and `--n`**, or the same
  ones with smaller error. Quoting a residual without its seed is quoting a coin flip: the sampler
  used bare `Math.random()` until 2026-08-04, and two runs on identical source gave 6 and then 3.
- Nothing in the hand list above that has not become a probe.

**`missing` going UP is not a regression, and this is the one place the rule is easy to misread.**
It rose 12 → 52 on 2026-08-04 while `live` rose 42 → 90, because 88 probes were written for
mechanics nobody had asked about before. The number that may never fall is `live`. A rising `missing`
means the census stopped flattering the engine.

## The one thing this division owes the others

A **named engine release**. Fixes batch; the release is what triggers the refit and the restamps —
see [DIVISIONS.md](DIVISIONS.md). Landing engine changes continuously is what leaves SEARCH
measuring a build that no longer exists.
