# Misconception-video audit — is every claim in scope, true for Champions, implemented, and covered?

Source: `data/external/2026-08-31-mechanic-misconceptions.txt` (24,441 chars, ASR).
Written in passes; each pass appended after it finished, so a stall costs one pass.

Scope authority for every row below:

```js
const {Dex} = require('<SHOWDOWN_PATH>/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
```

Abilities carry no `isNonstandard` in this mod, so an ability is scoped by **carrier count over the
filtered species walk**, never by its own row. Zero legal carriers = cannot occur = OUT OF SCOPE.

---

## PASS 1 + PASS 2 — the claims, and which of them can happen at all

74 distinct mechanical claims extracted (the video says "69"; a few of its sentences carry two
separable claims and one is not about Pokémon). Entities resolved against the dex, not from the ASR
spelling.

### The scope kills, grouped by cause

**(a) Terastallization does not exist in Champions.** `data/mods/champions/scripts.ts:180`:

```js
actions: {
  canTerastallize(pokemon) {
    return null;
  },
```

Unconditional `null`. Four claims die here and they are the video's most-discussed ones:

| # | Claim | Verdict |
|---|---|---|
| T1 | Tera raises a Tera-type move with BP < 60 up to 60, after all other BP modifiers, not on multi-hit or priority moves | OUT — no Tera |
| T2 | Tera into an original type makes STAB 2.0; Adaptability + Tera gives 2.0 / 2.25 | OUT — no Tera (the plain Adaptability = 2.0 half survives, row A12) |
| T3 | A Terastallized Pokémon cannot have its type changed or removed by any means | OUT — no Tera |
| T4 | The added-type effect goes away on terastallization | OUT — no Tera |

**(b) Zero legal carriers.** Measured over the filtered species walk (mega formes included, since a
mega overwrites the ability):

| Ability named by the video | Legal carriers | Claims killed |
|---|---|---|
| Serene Grace | **0** | rainbow/Serene-Grace stacking, and the King's-Rock-doubling half |
| Magnet Pull | **0** | "a Ghost/Steel is still immune to Magnet Pull's trap" |
| Full Metal Body | **0** | member of the stat-drop-prevention list |
| Wonder Guard | **0** | the whole Skill Swap / Trace / Entrainment claim |
| Normalize | **0** | "Normalize *does* boost an already-Normal move" |
| Ice Scales | **0** | the Fur-Coat-vs-Ice-Scales half of the Psyshock claim |
| Mycelium Might | **0** | member of the static-priority-effect list |
| Neutralizing Gas | **0** | the "switching the suppressor out changes Prankster mid-turn" claim |
| Emergency Exit | **0** | member of the half-HP-trigger claim |
| Anger Shell | **0** | member of the half-HP-trigger claim |
| Slow Start | **0** | the Legends-Arceus aside |
| Protosynthesis / Quark Drive / Orichalcum Pulse / Hadron Engine | **0 each** | the whole paradox-boost claim |
| Iron Barbs | **0** | member of the contact-punish list (Rough Skin survives, 2 carriers) |

Carriers that DO exist and keep their claims alive, for contrast: Bulletproof 3, Moody 2,
Speed Boost 5, No Guard 6, Sticky Hold 1, Magic Guard 3, Poison Heal 1, Stench 1, Shadow Tag 1,
Guts 5, Quick Feet 1, Iron Fist 6, Clear Body 3, White Smoke 1, Flower Veil 2, Defiant 5,
Competitive 3, Sand Rush 3, Sand Veil 6, Sand Force 4, Snow Cloak 5, Ice Body 6, Slush Rush 1,
Adaptability 6, Receiver 1, Wandering Spirit 1, Trace 4, Sheer Force 9, Fur Coat 1, Earth Eater 1,
Levitate 11, Water Absorb 3, Sap Sipper 6, Prankster 7, Pressure 7, Huge Power 4, Pure Power 2,
Stall 1, Quick Draw 1, Pixilate 3, Protean 3, Dry Skin 2, Fluffy 1, Parental Bond 1, Unseen Fist 1,
Berserk 2, Rough Skin 2.

**(c) `isNonstandard: 'Past'` — banned entity.** Every one confirmed by reading the format, not
recalled:

- Items: Flame Orb, Toxic Orb, Blunder Policy, Red Card, Ring Target, Punching Glove, Eject Button,
  Eject Pack, all four terrain seeds, Lagging Tail, Custap Berry, Protective Pads, Kee Berry,
  Rocky Helmet, the three form-changing masks, Eviolite. (Assault Vest, Clear Amulet, Choice Band
  were already known banned.)
- Moves: Thousand Arrows, Mind Reader, Triple Kick, Trump Card, Wring Out, Electro Drift,
  Sand Attack, Water Pledge, Fire Pledge, Psystrike, Secret Sword, Surging Strikes,
  Revival Blessing, Double Shock, Mist, Silk Trap, Obstruct, Burning Bulwark.

Claims killed outright by (c): the orb-activation-timing rule, the Blunder-Policy non-activation
list, the form-changing-item Knock Off half, the Red Card survival rule, the double-eject rule
(the video's one explicit "Showdown does this wrong"), the terrain-seed grounding rule, the
Punching-Glove-vs-Protective-Pads contact claim, the Iron Fist + Punching Glove 1.32 stacking claim,
the Kee/Eject exceptions to the Knock-Off-activates-the-item rule.

**(d) Not in generation 9 at all.** Z-Moves — the whole "Z-moves ignore Taunt and Encore" claim.

**(e) Not a Pokémon claim.** The 1-to-10 median aside.

**(f) Moot rather than illegal.** Hail does not exist in gen 9 (snow deals no chip), so the
Snow-Cloak / Ice-Body / Slush-Rush *hail* half of the weather-chip claim cannot be exercised.
The video says this itself. The **sand** half is fully in scope and survives.

### Scope tally

| | count |
|---|---|
| distinct claims extracted | **74** |
| OUT OF SCOPE | **31** |
| IN SCOPE (whole or in part) | **43** |

Nine of the 43 are in scope only in part — a member of a list that the format banned or that has no
carrier is struck out and the rest of the claim is judged on the survivors. Each is marked
"(partial)" in Pass 3/4.

---

## PASS 3 + PASS 4 — for the 43 survivors: is the video right, do we have it, could the check go red?

Ranked: **wrong first**, then right-but-uncovered, then covered, then the rows where **the video is
wrong**. Every "we get it wrong" row is a source read, not a staged game — no games were run.

### A. IN SCOPE + WE GET IT WRONG (3 confirmed)

#### A1. Accuracy and evasion stages are applied separately and multiplied. They must be combined into ONE clamped stage.

This is the video's claim verbatim: *"Using a move with -1 accuracy against a target with +1
evasiveness will not have an accuracy of 56.25% ... but rather 60%."*

The authority, `sim/battle-actions.ts:713-727` (no Champions override):

```js
let boost = 0;
if (!move.ignoreAccuracy) { boost = this.battle.clampIntRange(boosts['accuracy'], -6, 6); }
if (!move.ignoreEvasion) { boost = this.battle.clampIntRange(boost - boosts['evasion'], -6, 6); }
if (boost > 0)      { accuracy = this.battle.trunc(accuracy * (3 + boost) / 3); }
else if (boost < 0) { accuracy = this.battle.trunc(accuracy * 3 / (3 - boost)); }
```

One subtraction, one clamp, one table lookup, and a truncation. `engine/medicham2-browser.js:10080`:

```js
if(_ab)acc*=accStageMul(_ab);
if(_eb)acc/=accStageMul(_eb);
```

Two lookups, multiplied, no combined clamp, no truncation. Computed divergence (printed accuracy 100):

| accuracy stage | evasion stage | ABRA | Showdown |
|---|---|---|---|
| 0 | +2 | 60.00 | 60 |
| **-1** | **+1** | **56.25** | **60** |
| -2 | +2 | 36.00 | 42 |
| -6 | +6 | 11.11 | 33 |
| +2 | -1 | 222.22 | 200 |

The engine agrees exactly whenever one side is zero and diverges whenever both move. **Board-material
— it decides hit or miss.** Small, local fix.

**Coverage: an appearance of coverage.** Every accuracy census row varies ONE side:
`item|accuracyMod — a PRINTED-100 move misses at the evasion-stage rate and at the Bright Powder
rate` (attacker unboosted), `move|accuracyMod — the accuracy DRAW happens exactly where the
authority draws` (each modifier alone), `ability|ignoresEvasion` (evasion only). **Nothing in the
census puts a non-zero accuracy stage and a non-zero evasion stage on the board at the same time**,
so none of them could have gone red on this. The truncation is likewise unprobed.

#### A2. Expanding Force does not become a spread move on Psychic Terrain.

Video: *"Expanding Force becomes spread if the user is on Psychic Terrain."* The authority,
`data/moves.ts` (no Champions override):

```js
onModifyMove(move, source, target) {
  if (this.field.isTerrain('psychicterrain') && source.isGrounded()) {
    move.target = 'allAdjacentFoes';
  }
},
```

ABRA has no move-target rewrite at all. `data/tags.json` gives the move a static
`targetClass {target:"normal"}` and its tag list is `["pp","terrainScaled","conditionalPower",
"targetClass","formatSecondaryCount"]` — no `spreadFoes`, and no terrain-driven promotion anywhere
in the engine (`grep -n "allAdjacentFoes"` returns only the static target tables).

**Board-material in doubles and it points the wrong way**: the click hits one foe here and two on
the authority, and the survivor also never pays the spread x0.75. 310 corpus uses of the move,
180 of the terrain.

**Coverage:** `move|terrainScaled — Expanding Force gains power on Psychic Terrain` probes the
POWER half only. Nothing asks how many bodies it reached.

#### A3. The move-specific terrain multiplier has no grounded gate — and the engine says so itself.

Video: *"Grassy, Electric, and Psychic Terrain only boost ... if the user is grounded"*, plus
*"Rising Voltage deals double damage if the TARGET is on Electric Terrain."* Two different subjects,
which is exactly why this was left open. `engine/medicham2-browser.js:11520`:

> *"The grounded-ness gate is still not applied and the reason is unchanged and stated at the old
> site: the tag carries `{terrain, mult}` and no SUBJECT, and the two members disagree about whose
> feet matter (Expanding Force the user's, Rising Voltage the target's)."*

Authority: Expanding Force gates on `source.isGrounded()`; Rising Voltage's `basePowerCallback`
gates on `target.isGrounded()`. So an airborne user still gets the x1.5 here, and an airborne target
still eats the x2. Note the *generic* terrain type boosts a few lines below ARE gated correctly
(`_ag` / `_dg`), so this is only the two move-specific multipliers.

**Coverage:** none. A self-declared gap with no failing probe is indistinguishable from a working
feature. 310 + 185 corpus uses.

---

### B. IN SCOPE + RIGHT + NOT COVERED BY ANYTHING THAT COULD GO RED (10)

Each verified correct by reading the engine against the authority. None has a probe that would fail
if the behaviour were removed.

| # | Claim | Where it is right | Why the cover is not cover |
|---|---|---|---|
| B1 | Aurora Veil only needs snow when it is SET; it stays up and keeps working if snow ends | `failsWithoutWeather` is tested at click time only (line 27883); the screen afterwards is read off the side condition with no weather re-check | census `failsWithoutWeather — Aurora Veil fails when it is not snowing` probes the CLICK gate. No row asserts persistence, so deleting the persistence would turn nothing red |
| B2 | Belly Drum costs half max HP rounded DOWN, so only an even max HP triggers a Sitrus from full | `Math.floor(m.st.hp*0.5)` at 26250; the berry fires on `curHP <= maxhp*1/2` (9709) — the parity result falls out correctly | `costsUserHP` probes Belly Drum's ORDER (pay before boost) and Shed Tail's `ceil`. Nothing probes the parity consequence |
| B3 | A move-type-changing ability gives NO power boost to a move already of the type it converts to | `convertsMoveTypeTo` returns null when `curT === _cm.into`, so the multiplier is never set. The duplicate unconditional `damageBoost {mult:1.2, onType:null, onlyWhen:null}` row on the same ability matches none of the engine's three `damageBoost` gates, so it is never double-spent either | no census row for the negative case |
| B4 | Sheer Force cancels Life Orb recoil ONLY on a move Sheer Force actually boosted | `_sfB` requires the ability tag AND `moveFx(id).secondary.length` before the toll is skipped (34468-34476) | `damageMultAll` rows probe the toll on a miss and on a connect; `removesOwnSecondaries` probes the strip. The pair — Sheer Force user, secondary-less move, toll still owed — has no row |
| B5 | Guts ignores burn's physical halving entirely rather than halving then boosting | `const burn=(phys&&att.status==='brn'&&att.ability!=='guts'&&...)?0.5:1;` (11874) | no row compares a burned Guts body's damage against a burned non-Guts one. **Also implemented BY NAME, not by tag shape** — the engine documents this at 11361-11371 as blocked on `tag_dex` deriving a `hasStatus` condition |
| B6 | The three sand abilities all grant sandstorm-chip immunity; the snow speed one does not grant chip immunity | `weatherChipImmune` membership is derived and is exactly `icebody, overcoat, sandforce, sandrush, sandveil, snowcloak` — the snow speed ability is absent, as the video says | `weatherChipImmune — sandstorm chips, and Sand Veil / a Steel type ignore it` names one carrier. Same tag, so the shape is exercised; the NEGATIVE member — the half the video calls the misconception — is not |
| B7 | A crit ignores Light Screen and Aurora Veil, not only Reflect | one `_critHere` guard covers all three (11976) | census names Reflect only (`a crit ignores Reflect`). Same branch, so risk is low, but the claim as stated is untested |
| B8 | Dragon Claw, X-Scissor, Dire Claw, Stone Axe and Ceaseless Edge have NO raised crit ratio | `critRatioUp` membership is derived from the format and contains none of the five | `critRatioUp — Night Slash crits on a roll Crunch does not` uses a different control. No probe names any of the five |
| B9 | Moody fires at end of turn on a body that spent its turn switching in, where Speed Boost does not | Speed Boost is gated `!m._newlySwitched` (35148); Moody is deliberately ungated, matching the authority (`speedboost` tests `pokemon.activeTurns`, `moody` tests nothing) | the Speed Boost half has a named arm, `tests/staged_board.js --only speedboost-entry-gate`. The Moody CONTRAST — the point of the claim — has none |
| B10 | Burn reduces Body Press and Foul Play, because it multiplies damage rather than base power | the `burn` multiplier at 11874 gates on `phys`, and both moves are Physical, so it applies after the swapped stat | census has `a crit does NOT ignore a burn` and `Body Press attacks with Defense` as separate rows. The pair is unprobed |

---

### C. IN SCOPE + RIGHT + GENUINELY COVERED (a probe that could fail)

| Claim | Cover |
|---|---|
| Fake Out / First Impression cannot be SELECTED after the first turn — Champions replaces the fail with `onDisableMove` | `firstTurnOnly` — refused at the selection site (6143) as well as at execution; the probe's turn-3 arm reads 0 |
| First Impression is 100 BP in Champions | derived from the format, never typed |
| Wide Guard / Quick Guard never fail consecutively, but DO advance the shared Protect stall counter | `stallCounterFeeds — a Wide Guard ADVANCES the shared stall counter, so the next Protect is 1/3` |
| Spread moves take x0.75 whenever ≥2 bodies are targeted — a Protecting or type-immune partner does not remove it, an already-fainted one does | three separate `spreadFoes` rows, one per case |
| Screens are x2732/4096 in doubles, not x0.5; a second one does not extend the first; Aurora Veil stacks with neither | `DOUBLES_SCREEN=2732/4096` (15067) + `halvesDamage` rows |
| A crit ignores the attacker's negative Attack stages and the defender's positive Defence stages, but not a burn | four `alwaysCrit` rows |
| Perfect-accuracy moves miss a semi-invulnerable body; No Guard and a Poison-type's Toxic reach it | `semiInvulnerable` + `writesAccuracy` + `neverMissesFromUserType` rows |
| OHKO moves bypass the accuracy chain entirely, and the Ice one is 20% for a non-Ice user | the `move.ohko` early return at 10058-10065 mirrors the authority's *"bypasses accuracy modifiers"*; two `ohko` census rows |
| Ghost types are immune to every form of trapping, not just one ability's | `trapsTarget — a Ghost refuses a trap SILENTLY` + `preventsSwitch — a Ghost type walks out anyway` |
| A priority move is refused on Psychic Terrain only against a GROUNDED target | `setsTerrain — Psychic Terrain refuses priority only against a GROUNDED target` |
| Dark types do not block a Prankster-boosted move from an ALLY | `priorityMod — the Prankster refusal is a FOE clause` |
| Misty Terrain boosts no Fairy move (it only halves Dragon) | `setsTerrain — Misty Terrain HALVES a DRAGON move and nothing else` |
| A 5-turn sandstorm chips 4 times | `weatherChipStopsOnExpiry — a 5-turn sandstorm chips 4 times, not 5` |
| Grassy Terrain heals only a grounded body | `perTurnHP — Grassy Terrain heals a grounded body and not an airborne one` |
| A move that hit into a Protect, or missed only one of two spread targets, does NOT double Stomping Tantrum / Temper Flare | `_mvRes = _reached ? true : (_explicitFail ? false : null)` (34110) reproduces `moveResult = !!targets.length`; two `variablePower` rows probe the flinch and miss arms |
| Pressure costs 1 extra PP only when the move targets a Pressure body, priced off the TARGET CLASS | three rows including `Pressure is priced off the move's TARGET CLASS, not off a named target` |
| A rampaging move pays PP once for the whole lock | `locksIntoMove — a rampage pays ONE PP for the whole lock` |
| Each hit of a multi-hit move raises Rage Fist's counter | `_timesAttacked += _arrivals` (31644) + `variablePower` row |
| Parental Bond does not add a hit to a multi-hit or a spread move | `hitsTwice` + `noExtraHit` rows |
| Dry Skin takes x1.25 from Fire; Fluffy takes x2 and halves contact, so a contact Fire move is unchanged | `halvesTypeDamage — Dry Skin takes 1.25x from Fire`; `damageByMoveTrait — ... leaves a contact Fire move UNCHANGED` |
| Body Press attacks with Defence; Foul Play with the target's Attack | `swapsStat` / `statSwap` rows for all three stat-swap moves |
| The half-HP-trigger ability fires only on the hit that crosses half, and pays once for a multi-hit | three `boostsAtHPThreshold` rows |
| Sticky Hold keeps the item through Knock Off | `refusesItemLoss` row |
| Some SPECIAL moves make contact | the `contact` tag is flag-derived; four of the video's list carry it in `data/tags.json` |
| An airborne body under Gravity is reachable by Ground moves; a held weight flattens the matchup to neutral and Gravity takes that back | `groundsField` and `flattensTypeMatchup` rows |
| Flying Press multiplies Fighting effectiveness by Flying | `overridesEffectiveness — Flying Press multiplies Fighting BY Flying` |
| The "go first / go last in bracket" items and abilities are decided once, not re-decided mid-turn | `fractionalPriority` + `fractionalPriorityAnnounce` rows |
| A type-set move is refused on a body that already has exactly that type | `changesTargetType` rows |
| Defiant / Competitive fire once per stat lowered by an opponent | `boostsWhenLowered` rows |
| King's Rock adds no flinch to a move that already flinches, and Sheer Force deletes it | `addsFlinch` row; the ability equivalent has a `dedupes` gate read from its own param (32463) |

---

### D. THE VIDEO IS WRONG FOR THIS FORMAT'S AUTHORITY — and we are already right

#### D1. "Sticky Hold blocks the removal BUT Knock Off still gets the 1.5x power boost."

False on Showdown, and the video contradicts itself one sentence earlier. `knockoff.onBasePower`:

```js
const item = target.getItem();
if (!this.singleEvent('TakeItem', item, target.itemState, target, target, move, item)) return;
if (item.id) { return this.chainModify(1.5); }
```

`stickyhold.onTakeItem` **returns `false`** on a Knock Off (`data/abilities.ts`, no Champions
override — `grep -c stickyhold data/mods/champions/abilities.ts` = 0), so `singleEvent` is falsy and
the handler returns before the `chainModify`. **No boost.** That is the same mechanism the video
correctly cites for a form-changing item one sentence earlier; it just reaches the opposite
conclusion for this carrier.

ABRA agrees with the authority and has a probe that says so: `removesItem — Knock Off gets its x1.5
only when the item could actually be taken`. **Nothing to fix. Do not "correct" the engine toward
the video here.**

*(Hypothesis, unverified: the video may be right about cartridge. It is wrong about the authority
this project is measured against, which is what decides the row.)*

---

## The three worth dispatching, in order

1. **A1 — combine the accuracy and evasion stages.** Two lines, `engine/medicham2-browser.js:10080-10081`.
   Replace the two lookups with `clamp(accStage - evaStage, -6, 6)` and one lookup, and add the
   `trunc`. **Write the probe first: it must put a non-zero stage on BOTH sides**, because every
   existing accuracy probe zeroes one of them and would stay green through the fix. The failing
   assertion is -1 accuracy into +1 evasion: 60, not 56.25.
2. **A2 — promote Expanding Force to `allAdjacentFoes` on Psychic Terrain.** Board-material in
   doubles; the click currently reaches one body where the authority reaches two. Needs a
   terrain-conditional target class, which the tag does not carry today — say so rather than
   hardcoding the move name.
3. **A3 — gate the two move-specific terrain multipliers on the right feet.** The subject differs per
   member (user vs target), which is why it was deferred; the fix is a `subject` field on the tag
   plus the two reads. Lower blast radius than A2 but it is a *self-declared* gap, which is the
   worst kind to leave uncovered.

---

## OWED, NOT RUN

Everything below is a claim I did not settle. Each is named so it is not mistaken for a clean row.

**Reached, not finished (hypotheses, symptom stated, cause unverified):**

- **Rapid Spin / Knock Off still fire when the user faints to a contact-punish ability.** The video
  says Champions changed this. I read the authority's `rapidspin.onAfterHit` and `knockoff.onAfterHit`
  and **neither carries a `pokemon.hp` guard** (the `onAfterSubDamage` twin does) — so on the face of
  it the effects do still fire, and the video is right. **I did not check whether ABRA runs its
  equivalent after the user's faint.** Only one contact-punish carrier survives scope (2 species), so
  this is rare but real. Hypothesis, not a finding.
- **A resist berry and Knock Off on the same hit.** The berry has no `onTakeItem`, so the x1.5 should
  apply AND the berry should halve — the video's claim. ABRA gates the x1.5 on takeability (correct)
  and has a `resistBerryAtCalculation` row, but **the pair is unprobed and I did not read the
  interaction.** Hypothesis.
- **A flinch-adding item AND a flinch-adding ability on the same body.** The video says they do not
  stack. ABRA's item check reads the move's STATIC secondary list, not the ability-augmented one, so
  the two may both fire here. **One carrier can hold both**, so it is legal but very rare. Hypothesis —
  and note a separate agent is already probing whether the item's roll is per landed arrival; that
  work is NOT duplicated here.

**In scope, not examined at all:**

- Stat-drop-prevention abilities do not stop SELF-inflicted drops, and do not stop a boost reset
  (3 surviving carriers of the ability family; the two reset moves are legal).
- Defiant / Competitive do NOT fire when an ALLY lowers your stats, nor on a boost reset. The census
  row that exists uses a foe-sourced drop, so the ally arm is untested; I did not read the engine.
- A type-immunity ability grants immunity to STATUS moves of that type only when the ability also
  gives a benefit. Partially in scope (the video's own example uses a banned move; other type
  families survive).
- A type-immunity ability with a bonus effect activates only ONCE across a multi-hit move.
- The two added-type moves cannot stack with each other.
- Huge Power / Pure Power / Fur Coat modify the effective stat, not the base stat.
- The win rule on a mutual KO from recoil. CLAUDE.md records a recent win-rule fix; I did not check
  whether it covers this case, and the differential explicitly never compares who won.
- The bad-poison counter keeps incrementing under an ability that ignores the damage.
- The stat-stage table is (2+n)/2 while accuracy and evasion are (3+n)/3 — I confirmed the CONSTANT
  (`ACC_STAGE`, 9054) but did not check the stat-stage table beside it.
- Spiky Shield / Baneful Bunker block STATUS moves. Both legal, both carry `shieldsUser`; there is a
  census row for the sibling shield that does NOT block status, which suggests the distinction is
  modelled, but I did not confirm the positive arm for these two.
- Bulletproof does NOT refuse a Fairy move that merely looks like a ball. The tag is flag-derived so
  this is almost certainly right, but I did not print the membership.
- Being on a rampage does not count as repeating a move for the move-sealing status.
- Last Respects' cap. Unreachable in this format anyway (the revive move is banned and a side has at
  most 5 allies to lose), so it is in scope only trivially.

**Method notes for whoever picks this up:**

- No games were run and no artifact was written. Every claim above is settled by reading
  `data/mods/champions/`, `sim/`, `engine/medicham2-browser.js`, `data/tags.json` and
  `data/mechanics-census.json` (817 rows, all live, generated 2026-08-31T06:12Z).
- The census was read from the artifact, not regenerated. If it moves, the coverage column moves
  with it.
