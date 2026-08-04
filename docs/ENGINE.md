# ENGINE — does the simulator do what Pokémon does

**Owns:** `engine/medicham2-browser.js`, `data/abra-tags.js`, `tests/test-mechanics.js`,
`tests/walk_tags.js`, `tests/test-engine-diff.js`, `tests/mechanics_rank.js`

**Its one number:** mechanics live. **It must never go down.**

**May not:** claim a strength gain (that is SEARCH, gated by MEASURE), change what board.js
*means* by a feature, or land during a fit or self-play run.

<!-- GENERATED: engine/status.js -->

```
ENGINE — does the simulator do what Pokémon does
  42/54 probed mechanics live, 12 missing   (census 2026-08-04 06:30)
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
  3/120 differential comparisons disagree with Showdown   (2026-08-04 06:30)
    pyroar solarbeam -> kingambit: showdown 29-34, medicham 39-46  (3984 uses)
    meowscarada tripleaxel -> orthworm: showdown 0-0, medicham 5-6  (522 uses)
    quaquaval tripleaxel -> kingambit: showdown 0-0, medicham 5-6  (522 uses)
    a differential hit is NOT in the census count above — the census probes what someone thought to probe
  tag coverage: 53/176 probed, 123 unprobed
```

_stamped 2026-08-04 06:37_

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

- **Freeze-Dry** — deals *less* than Ice Beam into Water. That is the move's entire identity.
- **Haze**
- **Friend Guard**
- **Poison Touch**
- **Gigaton Hammer**
- **Expanding Force**
- **Marvel Scale**
- **Disguise** — the whole story of every Mimikyu row in the differential. Forcing Mimikyu's ability
  to Levitate reproduces MEDICHAM's number exactly, so the damage math is right and only the free hit
  is missing. Note the artifact will not hand it to you: `disguise.tags` is `["preventsCrit",
  "formeChange"]`, and `preventsCrit` also holds Battle Armor, Shell Armor and Ice Face.
- **Foul Play** — uses the TARGET's Attack, and the engine uses the attacker's. `dmgRange` reads the
  `statSwap` tag, which Foul Play does not carry; its `swapsStat` params say `offensiveFrom:"target"`
  and nothing reads that field. Body Press and Psyshock work because they carry `statSwap`. Measured
  1.55x too high (spiritomb foulplay -> pelipper, 33-39 against 51-61) and NOT explained by the
  harness — aligning the target's Attack on the Showdown side leaves the gap.
- **Rivalry** — x1.25 into the same gender, x0.75 into the opposite, x1.0 if either is genderless.
  Wholly absent. Blocked on data, not on will: `MC.mons` carries no gender and `buildMon` returns
  none, and `data/engine-data.js` belongs to MEASURE. Its `damageBoost` tag carries a bare
  `mult:1.25` with no condition and 43 other members including Blaze 1.5 and Slow Start 0.5, so it
  cannot be wired from the artifact as it stands.

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

- The census `live` count is higher than it was and `missing` is lower.
- No probe that passed yesterday fails today.
- The differential test finds fewer disagreements, or the same ones with smaller error.
- Nothing in the hand list above that has not become a probe.

## The one thing this division owes the others

A **named engine release**. Fixes batch; the release is what triggers the refit and the restamps —
see [DIVISIONS.md](DIVISIONS.md). Landing engine changes continuously is what leaves SEARCH
measuring a build that no longer exists.
