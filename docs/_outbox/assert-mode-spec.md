# THE ABSOLUTE-ASSERTION SPEC — the 14 abilities with no control arm

**Designed by Will, 2026-08-11.** I said this was the one thing I could not do, because every legal
carrier has the ability as its ONLY ability, so no "same Pokémon without it" control arm can exist.

**Will's answer dissolved the problem rather than solving it: these abilities do not need a control
arm, because their effect is ABSOLUTE.** "Does a status move fail against Gholdengo" needs no second
Gholdengo — it is a yes/no fact about one board. The A/B harness was the wrong instrument, and
insisting on it is what made 14 abilities look untestable.

Every rule below is Will's. Every mechanical detail is READ from `Dex.forFormat` or the Champions mod
and cited, per the no-typing-from-memory rule.

---

## 1. ABSOLUTE — assert the outcome, no comparison needed

| ability | teams | the assertion |
|---|---|---|
| **Good as Gold** | 3,136 | *"if a status move targets Gholdengo, it fails. no status move can ever succeed"* — one board per status move, assert FAIL. The strongest row on the list and the easiest. |
| **Levitate** | 2,633 | *"if using a ground move, it should not hit"* — assert immunity, not reduced damage. |
| **Surge Surfer** | 16 | *"just check the pokemons speed on electric terrain and on no terrain"* — assert the ratio is exactly 2. The terrain IS the control, so the two arms are two field states of one body. |
| **Fur Coat** | 8 | Same shape as Surge Surfer but with no field state to toggle: assert the physical damage taken is half what the damage formula gives without it. |

**Good as Gold is not "status moves are blocked" in general.** Write the assertion over the moves this
format actually contains and let it enumerate — a hand-listed set of status moves is the ban-list-of-four
failure. Derive the list from `D.moves.all().filter(m => m.category === 'Status')`.

## 2. FORM CHANGE — *"just measure the form and if it corresponds to its new stats"*

Will, 2026-08-10, and again today: *"THE FORM CHANGE ONES SHOULD BE EASY, DID THE FORM CHANGE? (AND DID
THE UNDERLYING STATS CHANGE WITH IT)"*, plus *"MAKE SURE TO SET UP THE CONDITION FOR THE FORM CHANGE, SO
KINGS SHIELD AND THEN ATTACK FOR AEGISLASH, SWITCHING IN AND OUT FOR PALAFIN, ETC"*.

| ability | teams | the trigger to STAGE | assert |
|---|---|---|---|
| **Zero to Hero** (Palafin) | 292 | switch out, then switch back in | forme + stats |
| **Stance Change** (Aegislash) | 235 | King's Shield → Blade forme; attack → Shield forme | forme + stats |
| **Disguise** (Mimikyu) | 178 | take one damaging hit | forme + the busted-disguise chip |
| **Forecast** (Castform) | 8 | set each weather in turn | forme + **TYPE — see below, the stats never move** |
| **Mimicry** (Stunfisk-Galar) | 4 | set each terrain in turn | **TYPE only — there is no forme at all** |

### THREE OF THE SIX WOULD PASS A BROKEN ENGINE UNDER "DID THE STATS CHANGE"

Will's rule — *"just measure the form and if it corresponds to its new stats"* — is right for half this
table and silently wrong for the other half. Measured, not assumed:

| | forme changes? | stats change? | what actually moves |
|---|---|---|---|
| Palafin / Zero to Hero | yes | **yes** | Will's rule works |
| Aegislash / Stance Change | yes | **yes** | Will's rule works |
| Mimikyu / Disguise | yes | **yes** | Will's rule works |
| **Morpeko / Hunger Switch** | yes | **NO** — both formes are `58/95/58/70/58/97` | **Aura Wheel's TYPE** |
| **Castform / Forecast** | yes | **NO** — all four formes are `70/70/70/70/70/70` | **the TYPE**: Normal → Fire → Water → Ice |
| **Stunfisk-Galar / Mimicry** | **no forme at all** | no | **the TYPE**, via `setType` |

A test written to the stat rule would report PASS for Morpeko, Castform and Stunfisk against an engine
that never changed anything. **The assertion has to be "did the OBSERVABLE move", and the observable is
per-ability.** This is the roster's control-arm mistake in a new place — measuring the wrong thing and
getting a green light for it.

### FORECAST IS FOUR STATES, NOT THREE, AND THE FOURTH IS THE ONE THAT BREAKS

`forecast.onWeatherChange`, read:

```
sunnyday | desolateland  -> Castform-Sunny  (Fire)
raindance | primordialsea -> Castform-Rainy  (Water)
hail | snowscape          -> Castform-Snowy  (Ice)
default:                  -> Castform        (Normal)
```

Will said *"one of the three weathers"* and that is the visible three. **SAND IS NOT IN THE SWITCH** — it
falls to `default`, so a Castform in sand is plain Normal-type. So does no-weather, and so does weather
EXPIRING. Stage all five: sun, rain, snow, sand, and weather running out. The revert is the branch an
engine forgets, exactly like the transform-never-reverts bug (#95).

### MIMICRY'S FOUR TERRAINS

`electricterrain -> Electric`, `grassyterrain -> Grass`, `mistyterrain -> **Fairy**`,
`psychicterrain -> Psychic`, `default -> the base types` (Ground/Steel). Note Misty gives **Fairy**, not
Water — the one a memory-typed test would get wrong. Stage all five including the revert.

### MORPEKO IS THE EXCEPTION AND IT WOULD HAVE FAILED THE RULE SILENTLY

`hungerswitch.onResidual` — read, not recalled:

```js
onResidual(pokemon) {
  if (pokemon.species.baseSpecies !== "Morpeko" || pokemon.terastallized) return;
  const targetForme = pokemon.species.name === "Morpeko" ? "Morpeko-Hangry" : "Morpeko";
  pokemon.formeChange(targetForme);
}
```

1. **It flips EVERY TURN, unconditionally** — no threshold, no trigger, nothing to stage. Unlike every
   other row in this table, there is no condition to set up.
2. **Terastallizing freezes it permanently** — the early return.
3. **THE STATS ARE IDENTICAL.** `Morpeko` and `Morpeko-Hangry` are both
   `hp 58, atk 95, def 58, spa 70, spd 58, spe 97`, both Electric/Dark.

So "did the stats change with the forme" is **always NO for Morpeko, correctly** — a test written to
Will's general rule would pass a broken engine here, or fail a correct one. The observable lives in a
different place: **Aura Wheel's type**. `aurawheel.onModifyType` returns **Dark** in Hangry and
**Electric** in Full Belly, and `onTry` fails the move outright for any other body.

**Morpeko's three assertions:** the forme alternates on every residual; Aura Wheel reads
Electric → Dark → Electric across three turns; a Terastallized Morpeko stops alternating.

## 3. CONTACT-TRIGGERED ABILITY THEFT — Will: *"like above"*, i.e. one family, two members

| ability | teams | Will's description |
|---|---|---|
| **Wandering Spirit** (Runerigus) | 132 | *"like skill swap, but only on contact moves sorta like cursed body"* |
| **Mummy** (Cofagrigus) | 92 | *"just spreads a useless ability to anyone who attacks it with a contact move like above"* |

Both fire on being hit by a CONTACT move and both rewrite the ATTACKER's ability. The difference is what
the attacker ends up with — Wandering Spirit trades (the attacker gets Wandering Spirit, Runerigus gets
the attacker's), Mummy overwrites (the attacker gets Mummy). Stage: attack the carrier with a contact
move, assert the attacker's ability afterwards. Then assert a NON-contact move changes nothing — that
second arm is what proves the contact clause rather than the ability.

**These two are already measured as live disagreements** (`stoneaxe -> wanderingspirit`,
`stoneaxe -> mummy`), so the fixture has a known answer to check itself against.

## 4. ALREADY SOLVED ELSEWHERE

| ability | teams | Will |
|---|---|---|
| **Mega Launcher** (Clawitzer) | 54 | *"same as mega blastoise, we already tagged the relevant moves"* — the pulse-move boost is a tag that exists; assert the multiplier on a tagged move. |

## 5. CLOSETED

| ability | teams | why |
|---|---|---|
| **Illusion** (Zoroark) | 449 | Will: *"we are tossing aside for now"*, and the corpus follows — ROADMAP #160, 384 games excluded from the fit corpus, counted and named. **Temporary by decision:** *"at some point we are going to have to have zoroark in our engine."* |

---

## WHAT THIS CHANGES ABOUT THE HARNESS

`tests/roster.js` scores an A/B pair and reports `NO CONTROL` when it cannot build one. That verdict is
correct about the A/B method and **wrong as a statement about testability**, which is how 14 abilities
covering 6,000+ teams came to be filed as unreachable.

The harness needs a second mode that takes an ASSERTION rather than a comparison. Nothing above needs a
control body; five of them (§1) need only a single board.

**Two of the fourteen do not fit the mode at all and must be said out loud:** Morpeko, because its stats
do not move (§2), and Illusion, because it is closeted (§5).
