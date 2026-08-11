# ROADMAP #151 — multi-hit, the crit predicate, and Stance Change. Receipts.

ENGINE division, 2026-08-10. Every figure here was produced by a command in this file against a frozen
release; nothing is quoted from memory.

Releases cut for measurement: `ec3db328727d` (crit + volley), `e4948ab6f77f` (+ stance change),
`debbbe33ce6d` (+ spread-preserving `formeSwap`, the one the final numbers come from).

---

## THE HEADLINE

| | before | after |
|---|---|---|
| `data/mechanics-census.json` live / probed / missing | 416 / 416 / 0 | **421 / 421 / 0** |
| `engine/all_mechanics_fire.js` diverging MOVE rows | 125 | **93** |
| of the 34 rows I was handed | 0 agree | **32 agree** |
| `tests/test-engine-diff.js --n 20000` | 0 disagreements | **0 disagreements** |
| deliberate roster, all three stages | 0 DIFFER / 0 DID-NOT-FIRE | **0 / 0** |
| `tests/test-game-diff.js` | 5/5 scripted games agree | **5/5** |
| `tests/test-protocol-trace.js` | 39/39 claimed events fired | **40/40** (`-hitcount`, `-formechange`) |

Five new probes, each watched RED before the fix:

- `move fixedDamage` — *Seismic Toss rolls no crit — a fixed number has no multiplier to apply*
- `move ohko` — *Sheer Cold announces no type effectiveness — an OHKO never reaches the type chart*
- `move multiHit` — *each hit of a multi-hit move arrives as its own damage packet, as Showdown emits it*
- `item survivesFromFull` — *a Focus Sash answers the packet that arrives, so two half-lethal hits still kill*
- `ability formeOnMoveCategory` — *Stance Change draws the sword on an attack, and a status click does not sheathe it*

---

## 1. THE CRIT PREDICATE — 13 ROWS, ONE FACT

`sim/battle-actions.ts:getDamage` has four early returns and both the crit die and the type-chart
announcement are BELOW all four:

```
if (move.ohko)             return target.maxhp;
if (move.damageCallback)   return move.damageCallback.call(...);
if (move.damage === 'level') return source.level;
if (move.damage)           return move.damage;
...  moveHit.crit = randomChance(1, critMult[critRatio])
...  add('-supereffective' | '-resisted' | '-crit', target)      (champions scripts.ts:271/278/285)
```

Membership was checked rather than assumed — enumerating the format for `ohko || damageCallback ||
damage` returns **exactly the 13 moves the `fixedDamage` tag already carries**:

```
comeuppance counter endeavor finalgambit fissure guillotine horndrill
metalburst mirrorcoat nightshade seismictoss sheercold superfang
```

So the predicate is `damageIsComputed(moveId)` = *not tagged `fixedDamage`*, read in **one** place
(`critChance`, which every caller already goes through — the battle loop's rolled die, `dmgRangeOneHit`'s
certain-crit door, and every hypothetical price) plus the effectiveness announcement.

**It is not cosmetic.** The rolled crit set `R.crit`, and Anger Point's whole condition is "did that one
crit". `-immune` is deliberately still emitted: `runImmunity` is above all four returns.

Authority, measured under the differential's own bottom pin:

```
|move|p1a: Machamp|Seismic Toss|p2a: Feraligatr
|-damage|p2a: Feraligatr|110/160            <- and nothing else
|move|p1a: Abomasnow|Sheer Cold|p2a: Feraligatr
|-damage|p2a: Feraligatr|0 fnt              <- no -resisted, though Ice into Water is 0.5x
```

---

## 2. MULTI-HIT — AND THE HIT COUNT WAS NEVER WRONG

**Answer to the RNG question first, because it decides whether those rows are evidence.** The harness has
no die of its own; `engine/game_differential.js` installs `pinRandom` / `pinShuffle` over **both** engines
(`:451`, `:467`) and `random(m,n)` is pinned to `m`. Under `bottom-tie-first`, Showdown's
`sample(MULTIHIT_2_5)` takes element 0 (= 2) and this engine's `MULTIHIT_2_5[floor(0*20)]` takes the same
element. **Both engines hit twice.** Every affected row's exact-2x ratio was our AGGREGATE against
Showdown's FIRST packet. **This is not a regression of ROADMAP #103** and must not be reported as one.

Confirmed directly in Showdown at the same pin — the volley is a *sequence*, and the count is 10 for
Population Bomb, not 1:

```
|move|p1a: Abomasnow|Bullet Seed|p2a: Feraligatr
|-supereffective|p2a: Feraligatr|1
|-crit|p2a: Feraligatr
|-damage|p2a: Feraligatr|116/160
|-supereffective|p2a: Feraligatr|1
|-crit|p2a: Feraligatr
|-damage|p2a: Feraligatr|72/160
|-hitcount|p2a: Feraligatr|2
```

Population Bomb landed **all ten** at this pin and stopped at eight only because the target FAINTED
(`|-hitcount|...|8`) — the per-hit accuracy re-roll passes at the bottom corner in both engines, so
"Showdown landed one and stopped" is not what happened.

### what changed

`dmgRange` hands back the packet vector on request (`wantPackets`, the sibling of ROADMAP #139's
`wantFirst`). The flat path's packets are **derived, not re-priced**: `dmgRangeOneHit` returns
`floor(roll(85) * n)` over an integer `roll` and an integer `n`, so the range divides by `n` exactly. The
per-hit path pushes each packet as it already loops. A count that does not divide is a PRICE
(`expectedHitsOf`'s 3.1, which no real turn hands in) and hands back nothing rather than an invented split.

The battle loop then applies them one at a time, emitting effectiveness, crit and `-damage` per arrival
and `|-hitcount|` at the end, and **stops at a KO** — the authority's own loop guard
(`if (targets.every(target => !target?.hp)) break`, champions `scripts.ts:464`), which is why `-hitcount`
reports `hit - 1` rather than the drawn count.

`-hitcount`'s condition is asked of the PLAN, not of a name list, because Showdown's own `move.multihit`
is set three different ways: by the `multiHit` tag, by Beat Up's `move.allies.length`, and by Parental
Bond. Measured: Beat Up prints `|-hitcount|...|4`, a Parental Bond Body Slam prints `|2`. Dragon Darts
prints none, and for the authority's reason (`typeof move.smartTarget !== 'boolean'`), which the loop asks.

### two mechanics that fell out, both previously declared open in the source

- **Focus Sash.** WIRE 12's own comment: *"This engine rolls multi-hit as one packet, so a sash here also
  eats Bullet Seed — the one divergence from the real rule, stated rather than hidden."* `R.first` is the
  first packet now for every splittable plan, so two half-lethal hits KILL a Sash holder.
- **A volley stopped at one hit was priced at the expectation.** `if (_hitsThisUse > 1) c.hits = ...` left
  the count unset when the per-hit accuracy roll stopped a Triple Axel at hit one — and an unset count
  sends `hitPlanOf` to `expectedHitsOf`, i.e. 1 + 0.9 + 0.81 hits of escalating damage instead of the one
  that landed.

### what is still NOT reproduced, stated

Showdown draws a randomizer **per hit**; this spends one index across the packets. Both pinned corners are
exact by construction (bottom → every packet at its minimum, top → every packet saturated). The interior
of a multi-hit distribution is modelled as one sample, which is the same range-versus-sample divergence
`dmgRange`'s header already declared for the summed form.

A volley whose TOTAL is rewritten between pricing and application (a Sash firing, an Endure, a busted
Disguise, a hit through Protect) collapses back to one packet rather than scaling a split that would then
be an invention. It ticks `MEDSEEN.multiHitPacketsCollapsed`.

### Beat Up — confirmed against the authority, not reasoned

Four arms, `-hitcount` compared engine to engine on a brought **four** with statuses applied:

| burned user | burned teammate | Showdown | medicham2 |
|---|---|---|---|
| no | no | 4 | 4 |
| **yes** | no | **4** | **4** |
| no | **yes** | **3** | **3** |
| yes | yes | 3 | 3 |

So: the user always participates even when statused (`ally === pokemon ||` short-circuits), a statused
teammate does not, and the party is `side.pokemon` — which team preview has already reduced to the
**four brought**, never six. `beatUpAllies` reads `att._sf.team`, which `battleInit` fills from the teams
it was handed. Per-hit base power is each ally's BASE Attack; the attack STAT in the formula is the
USER's, which is what `dmgRangeOneHit(att, ...)` already uses. Beat Up carries no `contact` flag and our
tags agree (`["pp","variablePower"]`). **None of this needed changing.**

---

## 3. STANCE CHANGE — EIGHT ROWS AND ONE ABILITY

`grep -c stancechange engine/medicham2-browser.js` = **0**, and `data/tags.json` read
`{"tags":["untagged"],"uses":270}`. Every Aegislash attack was computed at the Shield forme's 50 base
Attack against the Blade forme's 140.

Derived by SHAPE as `formeOnMoveCategory` — an `onModifyMove` that calls `formeChange` **and** branches on
`move.category`. The wide predicate was measured first, as `formeOnHit` and `formeCycleResidual` both
record having to: `formeChange(` inside any `onModifyMove` matches **one** ability in this format.
Carriers printed before wiring: `stancechange`. **One entity changed in `data/tags.json`; one tag name
added; nothing removed.**

The trap the tag records as `revertsOnStatus: false` — a Status move that is not King's Shield is a
**no-op, not a revert**. Authority:

```
|move|p1a: Aegislash|Swords Dance|p1a: Aegislash        <- no forme line at all
|-formechange|p1a: Aegislash|Aegislash-Blade|
|move|p1a: Aegislash|Iron Head|p2a: Feraligatr
|-formechange|p1a: Aegislash|Aegislash|
|move|p1a: Aegislash|King's Shield|p1a: Aegislash
```

The announcement is `-formechange`, **not** `detailschange`: `formeChange()` with no `isPermanent` takes
the else branch, and the line carries an **empty fourth field** (Showdown's undefined `message`), so it is
built rather than assembled — `push()` drops empty fields, which is right everywhere else and wrong here.

### and `formeSwap` was throwing the body's spread away

The first wire landed **31% too hard**: Iron Head 59 against the authority's 45, Head Smash 150 against
114, Sacred Sword 90 against 68, Reversal 21 against 16 — the same 1.31x on five moves, with Gyro Ball
going the OTHER way (33 against 36) because its power falls with the user's Speed. That is the signature
of a stat, not a formula. `formeSwap` called `buildMon(newKey, {})` and adopted the NEW species' stored
line — a stranger's SP investment.

Showdown's `formeChange` calls `setSpecies`, which recomputes from the SAME evs/ivs/nature. Measured at
two spreads so the claim is about the DELTA:

```
SP(atk)=0    Palafin  90  ->  Palafin-Hero 180    delta 90
SP(atk)=32   Palafin 122  ->  Palafin-Hero 212    delta 90
```

So the swap now re-applies the body's own investment to the new base line — `buildMon`'s own mega
transform, so the two roads cannot disagree — and `_bsAtk` follows the species standing on the field.

**One existing probe's expected number moved and the ENGINE is what moved.** `switchInForme` asserted
Palafin-Hero at **233**; that was `data/engine-data.js`'s hero row, which carries a different investment
from its base row. The correct answer is the body's own 154 + 90 = **244**. The reason is written into the
probe, with the two-spread measurement, so nobody has to re-derive it.

---

## 4. THE TWO ROWS I DID NOT CLOSE — both moved onto a DIFFERENT defect

| row | before | now |
|---|---|---|
| `finalgambit` | SD `-damage`, MC `-crit` | SD `\|faint\|p1a: Lucario`, MC `\|-damage\|p1a: Lucario\|0 fnt` |
| `steelbeam` (aegislash) | SD 92 damage, MC 40 | **both 405/810** — only `[from] steelbeam` vs `[from] Recoil` |

Final Gambit's is the **user-faint emission shape**, shared with `explosion`, `selfdestruct`, `memento`
and `mistyexplosion` — one family, not one move. Steel Beam's is **self-damage attribution**, the same
shape as the seven `-damage field 4` trapping rows (`bind firespin infestation sandtomb snaptrap
whirlpool wrap`). Neither is multi-hit and neither is a crit. **Filed, not fixed.**

---

## 5. TWO RED TESTS — ATTRIBUTED, AND NONE OF IT IS THIS BATCH

Reported to me as "every named offender is in your uncommitted work". **Measured, and that is not the
case.** The attribution below is by whether the file differs from HEAD at all.

`tests/test-no-silent-failure.js` — RED, 49 new silent catches over a baseline generated **2026-08-06**
(220 entries; the tree now holds 267). Fourteen files carry them. **Thirteen of the fourteen are
byte-identical to HEAD** — `champions_sim.js`, `click_counts.js`, `diff_swarm.js`, `explain_divergence.js`,
`leaf_engine_contrast.js`, `mega_census.js`, `mega_sets_from_sheets.js`, `merge_mega_into_engine.js`,
`provenance.js`, `quarantine.js`, `replay_differential.js`, `scenario_catalogue.js`, `tests/roster.js` —
so their catches arrived in COMMITTED work since the baseline, not in tonight's tree. The fourteenth is
`engine/tag_dex.js`, which I did edit; its three flagged catch bodies (`:380`, `:546`, `:3713`) all exist
verbatim at HEAD and all sit outside my single hunk (`+4643,55`). **My additions contain no `try`/`catch`
at all.**

`tests/test-effective-identity.js` — RED, 1,146 raw reads against a 234 baseline across twelve files.
**Eleven are byte-identical to HEAD**, including `tests/roster.js`, which alone accounts for **247** of the
912. The twelfth is `engine/all_mechanics_fire.js`, which the coordinator edited tonight and which I am
forbidden to touch.

**I did not re-baseline either.** Both files say in their own text that re-baselining launders every other
new entry beside the one being excused, and neither belongs to me to fix. Reporting them RED, with the
attribution, rather than filing them.

---

## 6. COMMANDS

```bash
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node engine/engine_release.js cut "…"
node tests/test-mechanics.js                                   # census
SHOWDOWN_PATH=… node tests/test-engine-diff.js --n 20000       # 0 disagreements
SHOWDOWN_PATH=… node tests/test-game-diff.js
SHOWDOWN_PATH=… node tests/test-protocol-trace.js
SHOWDOWN_PATH=… node engine/derive_protocol_events.js --write
SHOWDOWN_PATH=… node engine/tag_dex.js && node build/build_tags_js.js
SHOWDOWN_PATH=… node engine/all_mechanics_fire.js --release debbbe33ce6d --kind all --write
SHOWDOWN_PATH=… node tests/roster.js --stage {moves,items,abilities} --release debbbe33ce6d
```

**Not run, deliberately:** any fit, any self-play, `mew.js`. ENGINE's work is single-process.
