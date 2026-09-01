# The field-effect gap — weather and terrain are SET correctly and what they REFUSE is mostly unread

2026-09-01. **SCOPING ONLY. No game was played, no census was run, no `tag_dex` regeneration was
attempted, and nothing was fixed.** Another ENGINE agent held the machine on a `punishesAttacker`
batch throughout.

## How this was read, given a writing agent was live

`git status` at the start showed `engine/medicham2-browser.js`, `data/mechanics-census.json` and
`tests/test-mechanics.js` all modified in the working tree. **Every engine and test read below is
`git show HEAD:<file>`**, snapshotted once to the session scratchpad. `data/tags.json` was read the
same way. Only `data/team-pool-frozen/` (frozen by construction, `FROZEN.md` dated 2026-08-12) and
the Showdown checkout were read live.

Shapes were printed before every query: `Object.keys` on a move, a condition, an ability, a
`tags.json` row and a pool game object.

---

## 1. THE MEMBERSHIP, DERIVED

### 1a. Which field conditions can occur at all

Setters were derived, not recalled: every legal move carrying `weather` / `terrain` /
`pseudoWeather`, plus every legal ability and item whose handler source contains
`setWeather(...)` / `setTerrain(...)` / `addPseudoWeather(...)`. Then each setter was
**carrier-checked** — abilities against the 347 legal species, moves through
`champions_sim.moveCarriers` (which is the validator's own `checkCanLearn`).

| condition | move setters (carriers) | ability setters (carriers) | occurs? |
|---|---|---|---|
| `sunnyday` | Sunny Day (256) | Drought (3: Charizard-Mega-Y, Ninetales, Torkoal) | **yes** |
| `raindance` | Rain Dance (259) | Drizzle (2: Politoed, Pelipper) | **yes** |
| `sandstorm` | Sandstorm (85) | Sand Stream (3), Sand Spit (1: Sandaconda) | **yes** |
| `snowscape` | Snowscape (44), Chilly Reception (2) | Snow Warning (6) | **yes** |
| `desolateland` | — | Desolate Land (**0**) | **NO** |
| `primordialsea` | — | Primordial Sea (**0**) | **NO** |
| `deltastream` | — | Delta Stream (**0**) | **NO** |
| `electricterrain` | Electric Terrain (25) | Electric Surge (1: Raichu-Mega-X), Hadron Engine (0) | **yes** |
| `grassyterrain` | Grassy Terrain (30) | Grassy Surge (0), Seed Sower (0) | **yes** |
| `mistyterrain` | Misty Terrain (37) | Misty Surge (0) | **yes** |
| `psychicterrain` | Psychic Terrain (29) | Psychic Surge (0) | **yes** |
| `gravity` | Gravity (31) | — | **yes** |
| `trickroom` | Trick Room (61) | — | **yes** |
| `magicroom` | Magic Room (31) | — | **yes** |
| `wonderroom` | Wonder Room (49) | — | **yes** |
| `fairylock` | Fairy Lock (1: Klefki) | — | **yes** |

**Thirteen legal field conditions. Three ruled out by carrier check.**

**A correction to the brief.** Card 1 cited `data/conditions.ts:578-581` *and* `:615-618` "for the
stronger sun". `:615-618` is **Desolate Land**, whose only carrier is not in this regulation. Only
the `sunnyday` clause can ever run, so the fix has one site, not two.

### 1b. Items that would have changed this, and cannot

Derived from the format, not recalled. **`utilityumbrella`, `terrainextender`, `electricseed`,
`grassyseed`, `mistyseed`, `psychicseed` and `airballoon` are all `isNonstandard: 'Past'` — banned.**

Two consequences that shrink the job:
- **`effectiveWeather()`'s per-body arm reduces to two things in this format:** the field-wide
  suppressor (Cloud Nine — Air Lock has zero carriers) and Mega Sol's private sun. There is no legal
  per-holder umbrella. Both are already modelled (see §3).
- **Terrain duration is always 5.** No extender exists. That is what makes the 5-turn window in the
  pool measurement below legitimate rather than an assumption.

`heatrock` / `damprock` / `smoothrock` / `icyrock` ARE legal and carry `extendsDuration`, which
`weatherTurns(w, item)` reads.

---

## 2. FOR EACH HANDLER: DO WE READ IT?

Matched on tag shape and on the engine's own reads, not on a name grep. **`data/tags.json` was
checked first** — and the headline finding is structural:

> **No tag anywhere carries a terrain's or a weather's REFUSAL.** `setsTerrain` carries
> `{terrain:'mistyterrain'}` and nothing else; `setsWeather` likewise. `tag_dex` tags moves, items
> and abilities — the refusing handlers live on the CONDITION, which is not a tagged namespace. The
> engine's own ROADMAP #92 block says exactly this and typed the four base-power constants as
> literals for that reason.

**23 refusing/modifying handlers across the 13 conditions. 18 are read. 5 are not.**

| condition | handler | what it does | read? |
|---|---|---|---|
| `sunnyday` | `onWeatherModifyDamage` | Fire x1.5, Water x0.5 | **yes** — `dmgRangeOneHit` :11838-11839 |
| `sunnyday` | **`onImmunity`** | **refuses `frz` to ANY body, ANY type** | **NO** |
| `raindance` | `onWeatherModifyDamage` | Water x1.5, Fire x0.5 | **yes** :11838 |
| `sandstorm` | `onModifySpD` | Rock x1.5 SpD | **yes** :11310 |
| `sandstorm` | `onWeather` | 1/16 chip | **yes** :35487 |
| `snowscape` | `onModifyDef` | Ice x1.5 Def | **yes** :11309 |
| `electricterrain` | **`onSetStatus`** | **refuses `slp` to a grounded, non-semi-invuln body** | **NO** |
| `electricterrain` | **`onTryAddVolatile`** | **refuses `yawn`** | **NO** |
| `electricterrain` | `onBasePower` | Electric x5325/4096, attacker grounded | **yes** :11643 |
| `grassyterrain` | `onBasePower` | EQ/Bulldoze/Magnitude x0.5 (defender grounded); Grass x5325/4096 (attacker grounded) | **yes** :11647-11648 |
| `grassyterrain` | `onResidual` | 1/16 heal to grounded bodies | **yes** — WIRE 117, :13837 |
| `mistyterrain` | **`onSetStatus`** | **refuses EVERY status to a grounded body** | **NO** |
| `mistyterrain` | **`onTryAddVolatile`** | **refuses `confusion`** | **NO — declared, counted `MEDFAILS.confusionMistyUnmodelled` :16995** |
| `mistyterrain` | `onBasePower` | Dragon x0.5, defender grounded | **yes** :11645 |
| `psychicterrain` | `onTryHit` | refuses priority into a grounded target | **yes** — `priorityRefusedAbove` :5566-5580 |
| `psychicterrain` | `onBasePower` | Psychic x5325/4096, attacker grounded | **yes** :11644 |
| `gravity` | `onModifyAccuracy` | x6840/4096 | **yes** :10139-10150 |
| `gravity` | `onDisableMove` | `flags.gravity` moves sealed | **yes** — `sealsMoves`, 30 refs |
| `gravity` | `onBeforeMove` / `onModifyMove` | same rule at click time | **yes** |
| `gravity` | (grounding, in `isGrounded`) | first clause | **yes** :5530 |
| `magicroom` | `onFieldStart` | ends every item | **yes** :18769, :19746, `itemRoomSync` |
| `wonderroom` | `onModifyMove` + core stat swap | Def/SpD swap | **yes** :11180 |
| `fairylock` | `onTrapPokemon` | nobody switches | **yes** :13849, probed |

**A card in the brief is stale, and it matters for the plan.** Card 3 — *"Psychic Terrain blocks
nothing and spreads nothing"* — is **no longer true at HEAD.** The bar is wired through
`priorityRefusedAbove`, it is gated on the AIMED body's `isGrounded()`, it emits
`|-activate|BLOCKED BODY|move: Psychic Terrain`, it orders itself strictly below an ability bar
(the authority's own `TryMove`-above-`onTryHit` order), and it carries `MEDSEEN.terrainSparedAirborne`.
Two census probes already cover it (`test-mechanics.js` :13524, :13571). Nothing is owed there.

**One defect I nearly filed and did not, because I read the scope.** Lines 11309-11310 read
`field.weather` raw, which looks like a suppression hole. They are inside `dmgRangeOneHit`, which
**shadows `field` with `effWeatherOf(field, att, def)` at :10689** — its header names "the snow/sand
defence bumps" explicitly. They compose correctly. This is recorded because the near-miss is the
finding: a raw `field.weather` read is not evidence on its own.

### 2b. Move-level field-conditional handlers — a second membership the brief did not ask for

The condition is not the only carrier of a field rule. Every legal move with a handler reading
`field.isTerrain` / `effectiveWeather` was enumerated the same way:

| move | authority handler | modelled? | corpus uses |
|---|---|---|---|
| **Expanding Force** | `onModifyMove`: **`move.target = 'allAdjacentFoes'`** in Psychic Terrain, user grounded | **NO — `targetClass.target` is a fixed `"normal"`; nothing converts it** | 310 |
| **Expanding Force** | `onBasePower` x1.5, **USER grounded** | power yes, **grounded gate NO** (:11618-11624) | 310 |
| **Rising Voltage** | `basePowerCallback` x2, **TARGET grounded** | power yes, **grounded gate NO** | 185 |
| **Misty Explosion** | `onBasePower` x1.5, **USER grounded** | power yes, **grounded gate NO** | 7 |
| **Ice Spinner** | `onAfterHit`/`onAfterSubDamage`: **`field.clearTerrain()`** | **NO — no tag, zero references in the engine** | 191 |
| Terrain Pulse | type + x2, user grounded | **yes** — `requiresGrounded:true` is the one member that carries a subject, read at :10455 / :10795 | 16 |
| Grassy Glide | `onModifyPriority` +1, user grounded | priority yes (`PRIO_CONDITIONAL` :4296), **grounded gate NO** | 9 |
| Steel Roller | `onTry` fails without terrain, `onHit` clears it | **yes** — `failsWithoutTerrain`, probed :14965 | 11 |
| Defog | clears terrain | **yes** — `removesHazards.clearsTerrain` :19538 | 20 |
| Weather Ball, Solar Beam/Blade, Growth, Moonlight/Morning Sun/Synthesis, Thunder, Hurricane, Blizzard, Aurora Veil | `weatherScaled` | **yes**, all through `effWeatherOf` | 14,976 + |

The `terrainScaled` tag carries `{terrain, mult}` and **no subject**, and the engine's own comment at
:11618 states the deferral and the reason: "the two members disagree about whose feet matter". That
is still true and it is now measured rather than argued — Expanding Force and Misty Explosion gate on
the USER, Rising Voltage on the TARGET.

---

## 3. `effectiveWeather()` IS LOAD-BEARING — AND IT IS MODELLED, AND IT COMPOSES

Answered in full, because the question was whether a suppressor turns the protection back off.

- **`suppressesWeather()`** (:10529) reads the derived `weatherSuppression` tag — exactly two
  abilities, **Cloud Nine live (2 carriers: Altaria, Drampa; 156 brought sheets in the frozen pool),
  Air Lock zero carriers.**
- **`recomputeWeatherSuppression(field, bodies)`** (:10552) is the single implementation, called from
  four sites (top of turn, mega, entry pass, residual), mirroring `Field#suppressingWeather()`'s
  cache-free walk. A suppressor that faints or switches stops suppressing at that instant — measured
  against the official simulator, recorded at WIRE 78 / ROADMAP #352.
- **`effWeatherOf(field, att, def)`** (:10566) is the one reader, with **19 call sites** — Weather
  Ball's type, `weatherScaled`, the Fire/Water multipliers, the snow/sand defence bumps, Solar Power,
  Orichalcum Pulse, Solar Beam's charge skip, the weather residual heals, Castform's forme sync,
  `speedCond`, and Leaf Guard's `statusImmune.inWeather`. It also honours **Mega Sol's private sky**,
  including the authority's guard that the private sun rides on `activePokemon` (the acting body) and
  not on the target or its ally.
- **Aurora Veil's `failsWithoutWeather`** (:28019) reads `field.wSup || field.weather !== 'snow'`, so
  suppression composes there too.

**So the composition question for the sun/freeze fix has a clean answer before the work starts: the
new read must be `effWeatherOf`, and there is already one function to call.** A Cloud Nine body on
the field must turn the freeze protection back off, and a Mega Sol attacker must turn it on with no
sun anywhere — which is what makes this a two-arm probe rather than a one-arm one.

---

## 4. `isGrounded()` IS LOAD-BEARING — AND CARD 4'S LESSON HOLDS

`isGrounded(mon, att, mvCategory)` at :5521 mirrors `sim/pokemon.ts:2153` **clause for clause and in
order**, and it is emphatically not "is it Flying":

```
  1. Gravity on the field          -> grounded          (read off the body's own side, fieldOfBody)
  2. Ingrain / Smack Down volatile -> grounded
  3. Iron Ball                     -> grounded          (beats every airborne clause)
  4. Flying type                   -> airborne
  5. Levitate / E-Elevate ability  -> airborne          (via suppressedAbility, so Mold Breaker
                                                         un-grounds by making the clause stop matching)
  6. Magnet Rise / Telekinesis     -> airborne
  7. Air Balloon                   -> airborne          (illegal item, kept deliberately)
```

A body with no side stamp has no Gravity, and that is counted (`MEDFAILS.groundedBodyIncomplete`)
rather than defaulted.

**What is missing is not `isGrounded` — it is its companion.** Every terrain handler in the authority
is `target.isGrounded() && !target.isSemiInvulnerable()`. The tag `semiInvulnerable` exists and is read
at nine sites in this engine, and **not one of them is a terrain site.** So a body mid-Dig or mid-Dive
— grounded, but semi-invulnerable — currently takes the Grassy Terrain heal it should not take, and
blocks priority under Psychic Terrain when it should not. Near-zero pool reach; recorded for
completeness, ranked last.

---

## 5. POOL REACH, DERIVED FROM `data/team-pool-frozen`

17,381 games (`games.bo3.jsonl` 13,214 + `games.ots.jsonl` 4,167). Field state was reconstructed from
the stored `w` (weather) and `fs` (field start) events, **with terrain expiring five turns after its
start** — legitimate here only because Terrain Extender is banned (§1b).

**Stated caveat: the store carries no field-END event.** Weather is re-announced at every upkeep so
weather tracking is faithful; terrain is announced only at start, so the 5-turn window is a model.
An unwindowed run (terrain held for the rest of the game) is the upper bound and is given beside each
figure where it differs.

| | count | of what |
|---|---|---|
| games with any weather at any point | **9,531** | 54.8% of 17,381 |
| games with any TERRAIN at any point | **325** | **1.87%** |
| terrain field-starts: Electric / Psychic / Grassy / Misty | **237 / 110 / 13 / 4** | |
| Trick Room field-starts | 4,216 | for scale |
| **Expanding Force clicked under Psychic Terrain** | **147** (upper bound 156) | of 205 EF clicks total |
| **Rising Voltage clicked under Electric Terrain** | **103** (upper bound 112) | of 125 RV clicks total |
| **any status move clicked under Electric Terrain** | **36** (upper bound 40) | |
| **a SLEEP move clicked under Electric Terrain** | **11** (upper bound 12) | Spore / Hypnosis / Sleep Powder / Yawn |
| Cloud Nine brought into a game that had weather | **80** | the suppression-composition population |
| **freeze applied while the sun was up** | **2** | of 474 freeze applications in 430 games |
| **any status move clicked under Misty Terrain** | **0** | Misty Terrain is 4 field-starts total |
| Misty Explosion under Misty Terrain | **0** | |
| Ice Spinner clicked with a terrain up | **0** | of 53 Ice Spinner clicks |
| Grassy Glide under Grassy Terrain | 5 | of 6 clicks |
| Earthquake/Bulldoze/Magnitude under Grassy Terrain | **0** | |
| Steel Roller with a terrain up | 3 | |
| priority move clicked under Psychic Terrain | 26 | already modelled |

**The ranking this produces is not the ranking the four cards imply.** The sun/freeze immunity — the
card that opened the brief — has a pool reach of **2 events in 17,381 games**. The largest
board-material field gap in the pool is one the brief did not name: **Expanding Force is a SPREAD
move under Psychic Terrain and this engine fires it at one target**, 147 clicks.

---

## 6. THE LANDING PLAN — BATCHES OF ONE, WITH THE SCOREBOARD NAMED BEFORE THE RUN

Every item below is **board-material**. None is narration-only; the three `-activate` lines that come
with items 3-5 arrive *with* a board change, not instead of one.

**The tag question, settled once for the whole plan.** No refusal semantics are tag-carried and
`tag_dex` may not be regenerated in these conditions. **Follow the ROADMAP #92 precedent: type the
condition's rules as literal constants in `medicham2-browser.js`, each citing its authority source
line**, exactly as the four terrain base-power constants already are, and file the `tag_dex`
enrichment (`terrainScaled.subject`, a `refusesStatus` param on `setsTerrain`, `clearsTerrain` on Ice
Spinner) as separate follow-up work. Landing through a tag first would block every item on a
regeneration.

---

**1. Expanding Force becomes `allAdjacentFoes` under Psychic Terrain when the user is grounded.**
Authority: `data/moves.ts` `expandingforce.onModifyMove`. Today medicham2 hits one body at x1.5;
the authority hits both at x1.5 with the spread x0.75 on each.
*Expect before the run:* **pool differential MOVES** — 147 clicks over ~0.85% of games, so a
1,000-game run should surface a handful of newly-parted boards. **Census +1** (`move|terrainScaled`
or a new `targetClass` row). Probe must assert **two targets' HP**, with a knob-cleared control of
the identical board on a CLEAR field, where the target count must stay at one.

**2. The three `terrainScaled` moves gate on the right body's feet.**
Expanding Force and Misty Explosion on the **USER**; Rising Voltage on the **TARGET**. Authority
handlers quoted in §2b. Today all three fire ungated.
*Expect:* **census +1**; **pool likely to sit still or move by one or two games** — the boost only
disappears when the gated body is airborne, and Flying/Levitate bodies under Electric Terrain are
uncommon. **Say that before the run**: a still pool here is a confirmation, not a failure. The probe
must vary the gated body's grounding and assert the DAMAGE, with the airborne arm distinguishing
Rising Voltage's target from Expanding Force's user — if both arms move together the subject is
still unwired.

**3. Electric Terrain refuses `slp` and `yawn` to a grounded, non-semi-invulnerable body.**
Authority: `electricterrain.condition.onSetStatus` / `onTryAddVolatile`. Emits
`|-activate|TARGET|move: Electric Terrain` when the source is Yawn or a move with no secondaries.
Landing site is cheap: `canTakeStatus` already reaches the field as `t._sf._S.field` for the Leaf
Guard arm.
*Expect:* **pool MOVES a little** — 11 sleep clicks under Electric Terrain, and a landed Spore versus
a refused one is a whole game. **Census +1.** Probe asserts the target's STATUS after the click, with
the same board on a clear field as the control.

**4. Sun refuses `frz`, any body, any type.**
Authority: `data/conditions.ts:578-581`, one site (Desolate Land is unreachable, §1a). **The read must
be `effWeatherOf`, not `field.weather`** — a Cloud Nine body must turn the protection back off and a
Mega Sol attacker must turn it on with no sun on the field.
*Expect:* **pool SITS STILL** — 2 freeze-under-sun events in the whole frozen pool. This is a LAB
mechanic and should be reported as one. **Census +1.** Probe needs three arms: sun + Ice move (no
freeze), no sun + Ice move (freeze), sun + Cloud Nine + Ice move (freeze again). The third arm is the
composition control and is the one that can fail silently.

**5. Misty Terrain refuses every status, and confusion, to a grounded body.**
Authority: `mistyterrain.condition.onSetStatus` (unconditional `return false` past the grounded gate —
including a self-inflicted sleep) and `onTryAddVolatile`. Retires
`MEDFAILS.confusionMistyUnmodelled` (:16995), which is a declared gap with a counter already in place.
*Expect:* **pool SITS STILL** — Misty Terrain is 4 field-starts and zero status clicks under it in
17,381 games. Pure lab. **Census +1 or +2.**

**6. Ice Spinner clears the terrain.**
Authority: `icespinner.onAfterHit` / `onAfterSubDamage`. 191 corpus uses, 53 pool clicks, **zero of
them with a terrain up**. Needs either a literal or a `clearsTerrain` tag; `removesHazards.clearsTerrain`
already exists as a param shape on Defog, so the tagger road is short when regeneration is possible.
*Expect:* **pool SITS STILL. Census +1.** Board-material (terrain is board state) but lab-only reach.

**7. The `isSemiInvulnerable()` clause, missing from all eight terrain reads.**
Grassy heal, Grassy's EQ arm, all four base-power arms, Psychic Terrain's bar, and whatever items
3-5 add. Near-zero pool reach; the honest reason to do it is that every one of those sites will be
open anyway after items 1-6.
*Expect:* **pool SITS STILL. Census +0 or +1.** Lowest priority; a candidate to fold into item 5's
pass rather than run alone.

---

## OWED, NOT RUN

- **Nothing above was staged and nothing was fixed.** Three claims are reads of source rather than
  measurements and want a probe to settle them, in this order of doubt:
  - *"Expanding Force hits one target under Psychic Terrain"* — inferred from `targetClass.target`
    being a fixed `"normal"` with no converter anywhere in the file. **Most load-bearing unproven
    claim in this report; the whole of item 1 rests on it.**
  - *"Electric Terrain does not refuse sleep"* — `canTakeStatus`'s only field read is the Leaf Guard
    `inWeather` arm, checked line by line, but a second refusal road outside that function was not
    exhaustively excluded.
  - *"Grassy Glide's +1 has no grounded gate"* — `PRIO_CONDITIONAL` carries `{prio, needsTerrain}` and
    no subject; the call site at :4300 was not read in full. 5 pool clicks, so it was not chased.
- **The pool figures use a 5-turn terrain window**, not a field-end event, because the store carries
  none. Upper bounds are given beside each. Anyone re-deriving these must use the same window or the
  numbers are not comparable.
- **`tests/test-engine-diff.js` was not run** (no damage byte moved by this pass — nothing moved).
- **The three roster stages were not run.**
- **No `tag_dex` derivation was attempted**, per the brief. The three tagger enrichments the plan
  defers — `terrainScaled.subject`, a refusal param on `setsTerrain`, `clearsTerrain` on Ice Spinner —
  are unfiled work, not landed work.
- **Whether `MEDSEEN`/`MEDFAILS` counters for items 1-6 already exist beyond
  `confusionMistyUnmodelled` was not audited.** Item 5 has one; the other five appear to have none,
  which was not proven.
- The engine snapshot read is `HEAD` as of this session's start. **The other agent's
  `punishesAttacker` batch may have moved `medicham2-browser.js` under every line number quoted
  here.** Line numbers are pointers, not citations; re-locate before editing.
