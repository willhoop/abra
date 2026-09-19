# Quiet controls on the legacy ladder, Stalwart's redirect fixture, and the live-control sweep — 2026-09-19, ENGINE (light mode)

A findings record, not a living document. It is not cited as current state; `node engine/status.js` holds that.

Main tree, pinned to release **`54d02066fd71`**. No release was cut. `data/engine-release.json` was byte-identical
before and after, checked with `cmp` after every run. Light mode: named staged-game rows only. No battery, no
lattice, no roster stage, no `quarantine.js`.

Every run used `engine/all_mechanics_fire.js --release 54d02066fd71 --kind abilities --only <names> --team-store
C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen --write --out <scratch>`, through `tools/lownode.cmd`. No
main-tree artifact was written. 0 games threw in any run.

---

## 0. VERDICT

1. **Legacy chooser — done, and "quiet" is measured, not assumed.** The ladder now tries every alternative ability on
   the same body, in slot order, and takes the first one whose control game the authority reads QUIET. "Quiet" comes
   from a new handler watch inside the authority, not from a tag or a static reading. The knob
   `AMF_LEGACY_FIRST_CONTROL=1` restores the old first-alternative choice. On the named rows it moved two rows, and
   both now read **DID-NOT-FIRE** because their old FIRED was the control's:
   - **Flash Fire:** Intimidate → Justified;
   - **Stench:** Weak Armor → Aftermath.
2. **Stalwart — FIRED against a quiet control, on a fixture built from the authority.**
   - Stalwart's handler writes `move.tracksTarget`. The authority asks `RedirectTarget` only when that flag is not
     set (`sim/pokemon.ts:829`).
   - The new planner trigger `foe-redirects` puts a derived redirector on the foe side (Ariados, Rage Powder) while
     Archaludon aims Dragon Claw at Feraligatr.
   - The row reads **FIRED on the planner** against Stamina. Stamina's handlers were called **0 times** in both
     control games.
   - The board moves exactly on the redirect's leaves on both engines: `p2.party.feraligatr.hp` (888 against 960) and
     Ariados' HP. The board reads NO-DIVERGENCE on both variants.
   - Before this pass the planner read DID-NOT-FIRE, and the ladder's FIRED moved only
     `p1.party.archaludon.boosts.def` (0 against 1), which is Stamina's own boost.
3. **Sweep — FIRED ability rows on a live control: 58 → 55. Rows with no authority receipt for the subject: 12 → 9.**
   - The nine are Corrosion, Damp, Infiltrator, Leaf Guard, Long Reach, Overgrow, Pickpocket, Poison Touch and Sticky
     Hold.
   - None of them has a quiet alternative on its current board. For seven of them the fixture never stages the
     subject's own trigger.
   - **Item rows: 0.** An item's control is always "the item is removed", so it cannot act.

Census: **968 live / 968 probed / 0 missing**, unchanged (`data/mechanics-census.json`, generated
2026-09-19T17:50:30Z). No engine byte changed, so no census row could move.

## 1. THE WATCH — "QUIET" IS MEASURED IN THE AUTHORITY

In 6.66.0, two things could say whether a control acted:
- `stage_planner.js` `loudOnBoard`, which reads it statically from the handler text;
- the log receipt `abilityActedOn`, which reads the authority's protocol.

Both are blind to a silent modifier: Tough Claws scales a hit and writes no line. The static judge also cannot see
the legacy gauntlet's board at all.

**`watchAuthorityAbility` (`engine/all_mechanics_fire.js`).** Showdown's dex entries are deep-frozen. The first
attempt to wrap `ability.onUpdate` threw "Cannot assign to read only property". So the watch patches two doors, once.
Every ability handler passes through one of them:
- `Battle#getCallback`, which `findPokemonEventHandlers` uses for the status, volatiles, ability and item;
- `Battle#singleEvent`, which reads `effect['on' + id]` itself.

Both patches pass calls through unchanged unless a watch is open. Only the named ability's handlers are wrapped, and
only on the carrier's species: a pad holding the same ability is not the control. A wrapped callback is marked, so
the fieldEvent path is counted once. Each call is classified:
- **LOUD** when any of these happen:
  - a keyed leaf changed across the call. The Pokemon leaves are hp, status, fainted, item, ability, species, types,
    boosts, volatiles, pp and trapped. The field and side leaves are weather, terrain, pseudo-weathers, and side and
    slot conditions.
  - the event `modifier` moved;
  - the handler returned something other than its relay input;
  - it mutated a plain-object argument (Big Pecks deletes `def` from the boost table);
  - a static value was consulted (Shell Armor's `onCriticalHit: false`).
- **ANNOUNCE** when it only wrote protocol.
- **LATENT** when it only wrote a move property (Stalwart's `tracksTarget`, Skill Link's `multihit`, Keen Eye's
  `ignoreEvasion`).

**It changes no outcome.** Twelve rows were run twice: on the HEAD instrument (a `git show` copy, deleted after), and
on the new instrument under the legacy knob. The rows were Aftermath, Analytic, Iron Fist, Aerilate, Gale Wings, Sheer
Force, Skill Link, Tough Claws, Levitate, Torrent, Shell Armor and Damp. These fields were identical on all 12:
verdict, control, rung, board verdict and diffs, `ab_board`, `moved_by` and divergence. The game counts matched too
(111 / 111). The final sweep was also run twice, and the two runs were identical on all 81 rows.

**It is not blind.** In the red demonstration, the old choice (`AMF_LEGACY_FIRST_CONTROL=1`) on Stalwart reads Stamina
LOUD: `onDamagingHit (turn 1): state` and `(turn 2): state`. The row lands in `fired_on_loud_control: stalwart`. The
sweep watched 126 control games (604 handler calls) and 228 fixture games (1,048 calls). A run whose watched games see
zero handler calls prints `!! BLIND`.

**What is written to the artifact:**
- per row: `control_watch`, `subject_watch`, `subject_log_receipt`, `legacy_control` and `control_live`;
- in the summary: `summary.abilities.control_watch`, which holds `measured`, `quiet`, `loud`,
  `fired_on_loud_control`, `fired_on_live_control`, `fired_on_live_control_unearned`, the game and call counters, and
  `legacy_chooser`.

## 2. THE LEGACY CHOOSER (item 1)

`runAbilities` used `abControlFor(carrier)`, which returns the carrier's FIRST other ability. The new
`abControlsFor` returns every alternative in slot order, and its head is exactly the old choice. The chooser works
like this:
- It plays the ladder for each alternative in turn.
- It takes the first alternative whose control game on the reported rung is watch-quiet.
- If none is quiet, the head stands, stamped `quiet: false` with the reasons.

It is a preference and never a gate. A quiet head costs nothing extra; a loud head costs one more ladder for each
alternative tried.

| run (81 named rows) | ladder rows | head quiet | moved | none quiet |
|---|---|---|---|---|
| knob `AMF_LEGACY_FIRST_CONTROL=1` | 22 | 15 | none | corrosion, flashfire, leafguard, pickpocket, sandveil, stench, stickyhold |
| default | 22 | 15 | flashfire: Intimidate → Justified; stench: Weak Armor → Aftermath | corrosion, leafguard, pickpocket, sandveil, stickyhold |

Stalwart and Frisk were first run by name (`--only stalwart,frisk`):

| run | Stalwart | Frisk |
|---|---|---|
| HEAD instrument, before any change | planner DID-NOT-FIRE → ladder **FIRED, Stamina**; moved `p1.party.archaludon.boosts.def` 0 vs 1 | ladder DID-NOT-FIRE, Insomnia |
| legacy chooser only (old Stalwart fixture) | ladder tried `Stamina [loud] -> FIRED`, then `Sturdy [quiet] -> DID-NOT-FIRE`; the row reads **DID-NOT-FIRE, Sturdy** | unchanged |
| the same, knob on | **FIRED, Stamina**; the watch reads LOUD `onDamagingHit` | unchanged |
| plus the redirect fixture (final) | **planner FIRED, Stamina, 0 control calls** | unchanged |

## 3. STALWART (item 2)

**The trigger, derived and printed before wiring** (`node engine/stage_planner.js --only ability:stalwart
--redirectors`):

```
redirect gate: {"at":"sim/pokemon.ts:829","text":"if (this.battle.activePerHalf > 1 && !move.tracksTarget) {"}
redirector moves: Follow Me, Rage Powder (powder-gated)
redirector abilities: Lightning Rod (Electric only), Storm Drain (Water only)
abilities whose handler writes move.tracksTarget: Propeller Tail, Stalwart
items whose handler writes move.tracksTarget:
```

- **What the authority does.** Stalwart's handler is `onModifyMove(move) { move.tracksTarget = move.target !==
  'scripted'; }` (`data/abilities.ts:4495-4505`). `Battle#getTarget` also forces tracking for Stalwart and Propeller
  Tail (`sim/battle.ts:2440`). Propeller Tail has no legal carrier and is refused NO-LEGAL-CARRIER.
- **How the redirectors are derived.**
  - Moves: legal self-target moves whose `condition` carries `onFoeRedirectTarget`.
  - Abilities: those carrying `onAnyRedirectTarget` or `onFoeRedirectTarget`. The type is read from the handler's
    `move.type !==` gate.
  - A powder-gated redirector is used only when the carrier is not powder-immune by the type chart.
- **The fixture:**
  - C: Archaludon (Stalwart) clicks Dragon Claw at R.
  - R: Feraligatr idles with Sleep Talk.
  - RA: Ariados clicks Rage Powder.
  - CA: Absol clicks Protect.
  - The observed leaf is R's HP. Both variants are played: near-a and far-a.
  - The control is the same body with Stamina. The planner judges both Stamina and Sturdy quiet on this board, and
    the watch confirms 0 Stamina calls.
- **The whole-population plan changed only this row.** A HEAD-versus-new diff of all mechanics compared the fixture's
  control variable, the carrier's ability and the control reason. It changed 1 row: `ability:stalwart`. Ability-swap
  controls number 157: 146 quiet and 11 loud. That count uses the first fixture of each ability mechanic, and HEAD
  reads the same 157 / 146 / 11 under it.
- **Tests:** `tests/test-stage-planner.js` is **GREEN** (15.8 s, every red demonstration included).
  `tests/probe_amf_default_populations.js` is **GREEN**.

## 4. THE SWEEP (item 3)

**Population: 81 named abilities.**
- Every ladder-verdict row in the published `data/all-mechanics-fire.json` (release `d92bdfb50d88`): 22 rows.
- Every planner row whose control is not an ability swap: 39 click swaps and 1 item swap.
- The 11 statically loud planner controls.
- The rows 6.66.0 changed, plus Anger Point.

The remaining ~146 planner ability-swap rows are statically quiet. They were **not** run under the watch; see OWED.

**Definition.** A FIRED ability row rests on a **live control** in three cases:
- the watch reads the control ability LOUD in its own game;
- the control is a different CLICK, so the arms throw different moves and differ whatever the ability does;
- the control removes an item from another body.

For such a row the A/B proves nothing about the subject. The credit can then come only from the subject's
**authority receipt**, graded in five classes:
- `state`: the subject's handler read LOUD in the fixture game.
- `narrated`: the handler wrote its own protocol.
- `log`: the authority's log names the ability acting for the subject. Levitate's immunity is written by the sim core,
  not by a handler, so it shows up only here.
- `latent-only`: the handler only wrote a move property.
- `none`: nothing.

The first three earn the credit. This is the board-only arm's standard, extended to silent modifiers.

| | before | after |
|---|---|---|
| FIRED on a live control | 58 | 55 |
| on a loud ability control | 18 | 15 |
| on a click swap / item swap | 39 / 1 | 39 / 1 |
| no subject receipt (UNEARNED) | 12 | 9 |

- **"Before"** is the `sweep-before` run (57 rows, 485 games): the 6.66.0 planner chooser with
  `AMF_LEGACY_FIRST_CONTROL=1`. It adds Stalwart's HEAD ladder row, which is FIRED on a loud Stamina. That row has no
  receipt, because its only subject handler writes a move property.
- **"After"** is the `sweep-new3` run (55 rows, 497 games). It is identical to the earlier `sweep-new2` run on all 81
  rows.

The receipt classes after the change: state 44, log 2 (Levitate, Parental Bond), latent-only 2 (Infiltrator, Long
Reach), none 7.

### 4a. Every live-control row, and every row whose verdict moved

| row | stage | verdict (before -> after) | control (after) | control watch | subject receipt | moved leaves (authority) | why no quiet control |
|---|---|---|---|---|---|---|---|
| aerilate | planner | FIRED -> FIRED | C.click@1: the trigger click Facade becomes X-Scissor, which supplies none of type=Normal | n/a (not an ability) | state | p2.feraligatr.hp | ability swap rejected: no alternative: the bearer is a mega (Pinsir) |
| bigpecks | planner | FIRED -> FIRED | R.click@1: the trigger click Screech becomes Block, which supplies none of the needs | n/a (not an ability) | state | p1.active.0.vol.trapped | ability swap rejected: Keen Eye: shares preventsStatDrop; Tangled Feet: a click on this board supplies its subaccuracy= |
| blaze | planner | FIRED -> FIRED | C.click@3: the trigger click Temper Flare becomes Assurance, which supplies none of the ne | n/a (not an ability) | state | p2.feraligatr.hp | ability swap rejected: Speed Boost: writes state on its own (an entry/residual/field handler that changes a leaf) |
| corrosion | legacy-fallback | FIRED -> FIRED | Toxic Debris | LOUD: onDamagingHit (turn 1): state[p2:side] | none **UNEARNED** | p2.hazards.toxicspikes | ladder tried: Toxic Debris [loud] -> FIRED |
| damp | planner | FIRED -> FIRED | Electromorphosis | LOUD: onDamagingHit (turn 1): state[p1:bellibolt:volatiles] | none **UNEARNED** | p1.active.0.vol.charge | planner passing: Electromorphosis [loud], Static [loud] |
| disguise | planner | FIRED -> FIRED | R.click@1: the trigger click Earthquake becomes Protect, which supplies none of category=P | n/a (not an ability) | state | p1.mimikyu.hp, p1.mimikyu.species | ability swap rejected: no alternative: Mimikyu carries no other ability |
| dragonize | planner | FIRED -> FIRED | C.click@1: the trigger click Mega Kick becomes Dragon Claw, which supplies none of type=No | n/a (not an ability) | state | p2.active_keys.0, p2.abomasnow.fainted, p2.abomasnow.hp, p2.abomasnow.stall | ability swap rejected: no alternative: the bearer is a mega (Feraligatr) |
| eelevate | planner | FIRED -> FIRED | C.click@2: the trigger click Dragon Claw becomes Protect, which supplies none of category= | n/a (not an ability) | state | p1.eelektross.boosts.atk, p2.active_keys.0 | ability swap rejected: no alternative: the bearer is a mega (Eelektross) |
| electricsurge | planner | FIRED -> FIRED | CA.click@1: the partner sets Electric Terrain on turn 1, before the carrier's mega brings  | n/a (not an ability) | state | field.terrain_turns | ability swap rejected: no alternative: the bearer is a mega (Raichu) |
| fairyaura | planner | FIRED -> FIRED | R.click@1: the trigger click Play Rough becomes Assurance, which supplies none of the need | n/a (not an ability) | state | p1.floetteeternal.boosts.atk, p1.floetteeternal.hp | ability swap rejected: no alternative: the bearer is a mega (Floette-Eternal) |
| filter | planner | FIRED -> FIRED | R.click@1: the trigger click Earthquake becomes Brutal Swing, which supplies none of the n | n/a (not an ability) | state | p1.aggron.hp | ability swap rejected: no alternative: the bearer is a mega (Aggron) |
| firemane | planner | FIRED -> FIRED | C.click@1: the trigger click Burning Jealousy becomes Hyper Voice, which supplies none of  | n/a (not an ability) | state | p2.feraligatr.hp | ability swap rejected: no alternative: the bearer is a mega (Pyroar) |
| flashfire | legacy-fallback | FIRED -> DID-NOT-FIRE | Justified | quiet (2 calls) | - | (none: line only) | ladder tried: Intimidate [loud] -> FIRED; Justified [quiet] -> DID-NOT-FIRE |
| flowerveil | planner | FIRED -> FIRED | R.click@1: the trigger click Fake Tears becomes Block, which supplies none of the needs | n/a (not an ability) | state | p1.active.1.vol.trapped | ability swap rejected: Symbiosis: writes state on its own (an entry/residual/field handler that changes a leaf) |
| forecast | planner | FIRED -> FIRED | CA.click@1: the trigger click Rain Dance becomes Sleep Talk, which supplies none of the fi | n/a (not an ability) | state | field.weather, field.weather_turns, p1.castform.species, p1.castform.types, p2.f | ability swap rejected: no alternative: Castform carries no other ability |
| furcoat | planner | FIRED -> FIRED | R.click@1: the trigger click Earthquake becomes Surf, which supplies none of category=Phys | n/a (not an ability) | state | p1.furfrou.hp | ability swap rejected: no alternative: Furfrou carries no other ability |
| galewings | planner | FIRED -> FIRED | Flame Body | LOUD: onDamagingHit (turn 1): state[p2:aerodactyl:status] | state | p2.aerodactyl.hp, p2.aerodactyl.status | planner passing: Flame Body [loud] |
| goodasgold | planner | FIRED -> FIRED | R.click@1: the trigger click Spite becomes Dragon Pulse, which supplies none of category=S | n/a (not an ability) | state | p1.gholdengo.hp | ability swap rejected: no alternative: Gholdengo carries no other ability |
| heatproof | planner | FIRED -> FIRED | R.click@2: the trigger click Flamethrower becomes Future Sight, which supplies none of the | n/a (not an ability) | state | p1.sinistcha.hp, p1.slots.0.futuremove | ability swap rejected: Hospitality: writes state on its own (an entry/residual/field handler that changes a leaf) |
| hungerswitch | planner | FIRED -> FIRED | C.click@1: the carrier switches to the bench on turn 1 instead of clicking Seed Bomb, so i | n/a (not an ability) | state | p1.active_keys.0, p1.aerodactyl.hp, p1.aerodactyl.stall, p1.aerodactyl.vol | ability swap rejected: no alternative: Morpeko carries no other ability |
| hydration | planner | FIRED -> FIRED | Gooey | LOUD: onDamagingHit (turn 2): state[p2:feraligatr:boosts] | state | p2.feraligatr.boosts.spe | planner passing: Gooey [loud] |
| infiltrator | planner | FIRED -> FIRED | Flame Body | LOUD: onDamagingHit (turn 1): state[p2:feraligatr:status] | latent-only **UNEARNED** | p2.feraligatr.hp, p2.feraligatr.status | planner passing: Flame Body [loud] |
| innardsout | planner | FIRED -> FIRED | R.click@1: the trigger click Sheer Cold becomes Chilling Water, which supplies none of the | n/a (not an ability) | state | p1.active_keys.0, p1.aerodactyl.stall, p1.aerodactyl.vol | ability swap rejected: no alternative: the bearer is a mega (Victreebel) |
| insomnia | planner | FIRED -> FIRED | Sniper | LOUD: onModifyDamage (turn 1): modifier 1->1.5 | state | p2.altaria.hp | planner passing: Sniper [loud] |
| ironfist | planner | FIRED -> FIRED | C.click@1: the trigger click Drain Punch becomes Body Slam, which supplies none of the nee | n/a (not an ability) | state | p2.feraligatr.hp, p2.feraligatr.status | ability swap rejected: Guts: shares damageBoost; Sheer Force: shares damageBoost |
| leafguard | legacy-fallback | FIRED -> FIRED | Chlorophyll | LOUD: onModifySpe (turn 1): modifier 1->2 | none **UNEARNED** | (none: line only) | ladder tried: Chlorophyll [loud] -> FIRED |
| levitate | planner | FIRED -> FIRED | R.click@1: the trigger click Earthquake becomes Brutal Swing, which supplies none of the n | n/a (not an ability) | log | p1.chimecho.hp | ability swap rejected: no alternative: Chimecho carries no other ability |
| longreach | planner | FIRED -> FIRED | C.click@1: the trigger click Grassy Glide becomes Bullet Seed, which supplies none of the  | n/a (not an ability) | latent-only **UNEARNED** | p2.garbodor.hp | ability swap rejected: Overgrow: a click on this board supplies its type=Grass |
| magmaarmor | planner | FIRED -> FIRED | Anger Point | LOUD: onHit (turn 1): state[p1:camerupt:boosts] | state | p1.camerupt.boosts.atk, p2.feraligatr.hp | planner passing: Anger Point [loud] |
| megalauncher | planner | FIRED -> FIRED | C.click@1: the trigger click Dragon Pulse becomes Hydro Pump, which supplies none of flag= | n/a (not an ability) | state | p2.feraligatr.hp | ability swap rejected: no alternative: Clawitzer carries no other ability |
| megasol | planner | FIRED -> FIRED | C.click@1: the trigger click Weather Ball becomes Pollen Puff, which supplies none of type | n/a (not an ability) | state | p2.feraligatr.hp | ability swap rejected: no alternative: the bearer is a mega (Meganium) |
| mimicry | planner | FIRED -> FIRED | CA.click@1: the trigger click Psychic Terrain becomes Sleep Talk, which supplies none of t | n/a (not an ability) | state | field.terrain, field.terrain_turns, p1.stunfiskgalar.hp, p1.stunfiskgalar.types, | ability swap rejected: no alternative: Stunfisk-Galar carries no other ability |
| moxie | planner | FIRED -> FIRED | C.click@2: the trigger click Hydro Pump becomes Protect, which supplies none of category=P | n/a (not an ability) | state | p1.gyarados.boosts.atk, p2.active_keys.0 | ability swap rejected: Intimidate: writes state on its own (an entry/residual/field handler that changes a leaf) |
| mummy | planner | FIRED -> FIRED | R.click@1: the trigger click Dragon Claw becomes Fling, which supplies none of the needs | n/a (not an ability) | state | p1.cofagrigus.hp | ability swap rejected: no alternative: Cofagrigus carries no other ability |
| overgrow | planner | FIRED -> FIRED | C.click@3: the trigger click Seed Bomb becomes Bite, which supplies none of the needs | n/a (not an ability) | none **UNEARNED** | p2.feraligatr.hp | ability swap rejected: Bulletproof: a click on this board supplies its flag=bullet |
| parentalbond | planner | FIRED -> FIRED | C.click@1: the trigger click Hydro Pump becomes Surf, a spread hit of the same category, w | n/a (not an ability) | log | p2.feraligatr.hp | ability swap rejected: no alternative: the bearer is a mega (Kangaskhan) |
| pickpocket | legacy-fallback | FIRED -> FIRED | Tough Claws | LOUD: onBasePower (turn 1): modifier 1->1.300048828125 | none **UNEARNED** | p2.feraligatr.hp | ladder tried: Tough Claws [loud] -> FIRED; Sniper [loud] -> FIRED |
| piercingdrill | planner | FIRED -> FIRED | R.click@1: the trigger click Protect becomes Agility, which supplies none of the needs | n/a (not an ability) | state | p2.feraligatr.boosts.spe, p2.feraligatr.hp | ability swap rejected: no alternative: the bearer is a mega (Excadrill) |
| plus | planner | FIRED -> FIRED | Static | LOUD: onDamagingHit (turn 1): state[p2:feraligatr:status] | state | p2.feraligatr.hp, p2.feraligatr.status | planner passing: Static [loud] |
| poisontouch | planner | FIRED -> FIRED | Poison Point | LOUD: onDamagingHit (turn 1): state[p2:feraligatr:status] | none **UNEARNED** | p2.feraligatr.hp, p2.feraligatr.status | planner passing: Poison Point [loud] |
| reckless | planner | FIRED -> FIRED | C.click@1: the trigger click Double-Edge becomes Assurance, which supplies none of the nee | n/a (not an ability) | state | p1.emboar.hp, p2.feraligatr.hp | ability swap rejected: Blaze: shares damageBoost |
| refrigerate | planner | FIRED -> FIRED | C.click@1: the trigger click Hyper Voice becomes Blizzard, which supplies none of the need | n/a (not an ability) | state | p2.feraligatr.hp, p2.feraligatr.status | ability swap rejected: Snow Warning: writes state on its own (an entry/residual/field handler that changes a leaf) |
| sandveil | legacy-fallback | FIRED -> FIRED | Rough Skin | LOUD: onDamagingHit (turn 1): state[p2:feraligatr:hp] | state | p1.charizard.hp, p2.feraligatr.hp | ladder tried: Rough Skin [loud] -> FIRED |
| shadowtag | planner | FIRED -> FIRED | R.item: the receiver holds Shed Shell (tag escapesTrap), so the trap cannot hold it | n/a (not an ability) | state | p2.feraligatr.item | ability swap rejected: no alternative: the bearer is a mega (Gengar) |
| shellarmor | planner | FIRED -> FIRED | Gooey | LOUD: onDamagingHit (turn 1): state[p2:feraligatr:boosts] | state | p1.goodrahisui.hp, p2.feraligatr.boosts.spe | planner passing: Gooey [loud] |
| simple | planner | FIRED -> FIRED | CA.click@1: CA clicks Protect instead of simplebeam | n/a (not an ability) | state | p1.abomasnow.boosts.atk, p1.abomasnow.boosts.spa | ability swap rejected: no bearer (a conferred fixture) |
| solarpower | planner | FIRED -> FIRED | CA.click@1: the trigger click Sunny Day becomes Sleep Talk, which supplies none of the fie | n/a (not an ability) | state | field.weather, field.weather_turns, p1.charizard.hp, p2.feraligatr.hp | ability swap rejected: Blaze: shares damageBoost; a click on this board supplies its type=Fire |
| soundproof | planner | FIRED -> FIRED | R.click@1: the trigger click Screech becomes Block, which supplies none of the needs | n/a (not an ability) | state | p1.active.0.vol.trapped | ability swap rejected: Snow Warning: writes state on its own (an entry/residual/field handler that changes a leaf) |
| spicyspray | planner | FIRED -> FIRED | R.click@1: the trigger click Dragon Pulse becomes Sleep Talk, which supplies none of categ | n/a (not an ability) | state | p1.scovillain.hp | ability swap rejected: no alternative: the bearer is a mega (Scovillain) |
| stancechange | planner | FIRED -> FIRED | C.click@1: the trigger click Brutal Swing becomes Protect, which supplies none of category | n/a (not an ability) | state | p1.aegislash.species, p2.feraligatr.hp | ability swap rejected: no alternative: Aegislash carries no other ability |
| stench | legacy-fallback | FIRED -> DID-NOT-FIRE | Aftermath | quiet (3 calls) | - | (none: line only) | ladder tried: Weak Armor [loud] -> FIRED; Aftermath [quiet] -> DID-NOT-FIRE |
| stickyhold | legacy-fallback | FIRED -> FIRED | Supersweet Syrup | LOUD: onSwitchIn (turn 0): state[p2:feraligatr:boosts p2:charizard:boo | none **UNEARNED** | p2.charizard.boosts.evasion, p2.feraligatr.boosts.evasion | ladder tried: Supersweet Syrup [loud] -> FIRED; Regenerator [loud] -> FIRED |
| surgesurfer | planner | FIRED -> FIRED | CA.click@1: the trigger click Electric Terrain becomes Sleep Talk, which supplies none of  | n/a (not an ability) | state | field.terrain, field.terrain_turns | ability swap rejected: no alternative: Raichu-Alola carries no other ability |
| toughclaws | planner | FIRED -> FIRED | Sniper | LOUD: onModifyDamage (turn 1): modifier 1->1.5 | state | p2.feraligatr.hp | planner passing: Sniper [loud] |
| unseenfist | planner | FIRED -> FIRED | R.click@1: the trigger click Protect becomes Agility, which supplies none of the needs | n/a (not an ability) | state | p2.feraligatr.boosts.spe, p2.feraligatr.hp | ability swap rejected: no alternative: the bearer is a mega (Golurk) |
| wanderingspirit | planner | FIRED -> FIRED | R.click@1: the trigger click Dragon Claw becomes Fling, which supplies none of the needs | n/a (not an ability) | state | p1.runerigus.hp | ability swap rejected: no alternative: Runerigus carries no other ability |
| zerotohero | planner | FIRED -> FIRED | C.click@1: the carrier stays in and clicks Protect instead of switching to CB | n/a (not an ability) | state | p1.active_keys.0, p1.aerodactyl.stall, p1.aerodactyl.vol | ability swap rejected: no alternative: Palafin carries no other ability |

Stalwart is not in this table, because it no longer rests on a live control. Its before and after are in §2.

### 4b. The nine UNEARNED rows — why there is no quiet control, and what would earn them

| row | why no quiet control on this board | what the moved leaves are | what the fixture is missing |
|---|---|---|---|
| Corrosion | Glimmora's only alternative is Toxic Debris, LOUD on the physical hit (`p2:side`) | `p2.hazards.toxicspikes`, the control's | a poison-status click on a Steel or Poison target. Corrosion has no handler; the sim core reads it. |
| Damp | Bellibolt's alternatives, Electromorphosis and Static, both act on the receiver's contact hit | `p1.active.0.vol.charge`, Electromorphosis' | an explosion-family click. With one, Static would be quiet (the family is non-contact), but the planner derives no need from Damp's `includes(effect.id)` gate. |
| Infiltrator | Chandelure's only passing alternative is Flame Body, LOUD on contact | R's hp and status (the burn) | a screen or substitute on the foe side. The subject only wrote `move.infiltrates`. |
| Leaf Guard | Leafeon's only alternative is Chlorophyll, LOUD in the ladder's sun (`onModifySpe` ×2) | none; one protocol line only (turn order) | the planner fixture reads DID-NOT-FIRE, so the ladder is used |
| Long Reach | the ability swap is rejected: Overgrow, "a click on this board supplies its type=Grass" | R's hp, from two different moves | a contact punisher on the target. The subject only deletes `flags.contact`. |
| Overgrow | the ability swap is rejected: Bulletproof, "a click on this board supplies its flag=bullet" | R's hp, from two different moves | the 1/3-HP threshold is never reached. The handler was called twice and moved no modifier. |
| Pickpocket | Barbaracle's Tough Claws is LOUD (`onBasePower` ×1.3), and Sniper is LOUD (crits on the arm) | R's hp, the control's damage | an attacker that holds an item and makes contact |
| Poison Touch | Dragalge's only passing alternative is Poison Point, LOUD on contact | R's status and hp (Poison Point) | a contact hit by the holder. The fixture throws Hydro Pump. |
| Sticky Hold | Hydrapple's Supersweet Syrup is LOUD on entry, and Regenerator is LOUD on the gauntlet's switch | p2's evasion boosts, Supersweet Syrup's | the planner fixture reads DID-NOT-FIRE, so the ladder is used |

### 4c. The eight loud-ability rows that ARE earned

Each of these rows has a subject handler that read LOUD in the fixture game:

| row | subject receipt |
|---|---|
| Gale Wings | `onModifyPriority` returned 1 |
| Hydration | `onResidual` cured the status |
| Insomnia | `onSetStatus` returned false |
| Magma Armor | `onImmunity` returned false |
| Plus | `onModifySpA` ×1.5 |
| Sand Veil | `onModifyAccuracy` ×0.8 |
| Shell Armor | `onCriticalHit = false` |
| Tough Claws | `onBasePower` ×1.3 |

The board also agrees on both engines. The control is still live, so the A/B's own clause, "the control did not move
the board", is not met. The credit rests on the receipt.

Minus was statically loud (Static on contact) but measured QUIET, because Static's roll did not land. The measurement
is the finer instrument.

## 5. FILES CHANGED

- `engine/all_mechanics_fire.js`:
  - the watch: `authorityFingerprint`, `fpDiff`, `argObjects`, `moveShallow`, `patchWatchDoors`,
    `watchAuthorityAbility`, `watchedControl` and `foldWatch`;
  - `abControlsFor`, the legacy chooser loop and its knob;
  - the row fields `control_watch`, `subject_watch`, `subject_log_receipt`, `legacy_control` and `control_live`;
  - `summary.abilities.control_watch` and its console block.
- `engine/stage_planner.js`:
  - `redirectGate`, `redirectors`, the `foe-redirects` trigger and its staging;
  - the `--redirectors` print;
  - `control.ability_swap_rejected` on every control that is not an ability swap.
- `docs/ENGINE.md`: the new section and the hand list.
- This report.

Not touched: the engine, the tags, CHANGELOG, RUNNING-NOTES, `quarantine.js`, and every data file.

I created two temporary copies of HEAD files, `engine/_tmp_sp_head_quietctl.js` and `engine/_tmp_amf_head_quietctl.js`,
and deleted both myself. Every process I started ended on its own, and none was killed.

## PROPOSED NOTES ROW

```
### <<VER>> — 2026-09-19 — The legacy ladder prefers a measured-quiet control; Stalwart fires on a redirect fixture; 9 FIRED rows on a live control have no subject receipt

**What changed.** `engine/all_mechanics_fire.js` watches the authority's handlers of a named ability for one game
(patched once on `Battle#getCallback` / `Battle#singleEvent`, carrier only) and classifies each call LOUD / ANNOUNCE /
LATENT. The legacy ladder now takes the first alternative ability whose control game reads quiet (knob
`AMF_LEGACY_FIRST_CONTROL=1` restores the first alternative). `engine/stage_planner.js` derives a `foe-redirects`
trigger from a handler writing `move.tracksTarget` (gate sim/pokemon.ts:829) and stages a derived redirector on the
foe side. Rows carry `control_watch`, `subject_watch`, `legacy_control`, `control_live`; the summary carries
`summary.abilities.control_watch`.
**Figures.** Release 54d02066fd71, 81 named ability rows, light mode (497 games, 0 threw; two runs identical). Stalwart
FIRED on the planner against Stamina with 0 control-handler calls; both engines move p2.party.feraligatr.hp 888 vs 960,
board NO-DIVERGENCE. The legacy chooser moved Flash Fire (Intimidate→Justified) and Stench (Weak Armor→Aftermath),
both now DID-NOT-FIRE. FIRED on a live control 58 → 55; of those, with no subject receipt 12 → 9 (Corrosion, Damp,
Infiltrator, Leaf Guard, Long Reach, Overgrow, Pickpocket, Poison Touch, Sticky Hold). Watch A/B against the HEAD
instrument: 12 of 12 rows identical, 111/111 games. Census 968/968 unchanged (no engine byte changed).
**Supersedes.** Stalwart's ladder FIRED (control Stamina; the moved leaf was Stamina's own boosts.def), and the ladder
FIRED of Flash Fire and Stench. None of these is a published figure; the staged-game battery has not been re-run.
**Basis.** unchanged
**Owes.** docs/ABRA-technical-docs.md (the control watch and the live-control definition) at the next major.
```

## OWED, NOT RUN

1. **The full staged-game battery on `54d02066fd71`, pinned.** It is the only way to learn three things:
   - how the watch reads the ~146 statically quiet planner ability-swap controls that were not run here;
   - whether any other FIRED row rests on a live control (this watch does not cover moves);
   - the published `summary.abilities.control_watch` numbers.
2. **MEASURE: a gate question.** `summary.abilities.control_watch.fired_on_live_control_unearned` lists FIRED rows
   whose credit nothing earns: 9 on the named rows. The PROOF clause still counts them. Whether they should count as
   UNPROVEN is MEASURE's call. `engine/quarantine.js` was not touched.
3. **Seven fixtures that do not stage their own trigger** (§4b):
   - Damp: an explosion click. This needs a derivation from an `includes(effect.id)` gate, and its membership must be
     printed before wiring.
   - Poison Touch: a contact hit.
   - Infiltrator: a screen or a substitute.
   - Overgrow: the 1/3-HP threshold.
   - Pickpocket: an item on the attacker.
   - Long Reach: a contact punisher.
   - Corrosion: a poison status on a Steel or Poison target.

   Two ladder rows, Leaf Guard and Sticky Hold, first need their planner fixture to fire.
4. **The 39 click-swap controls.** For any of them, the A/B cannot tell the ability from the move. 37 are earned by
   the subject's receipt; Long Reach and Overgrow are not. The planner's chain rejected an ability-swap control for
   each one, and the reason is now stamped (`control.ability_swap_rejected`). A second opinion is owed on whether
   `reactsTo`'s "shares <tag>" rejection is too strict: Iron Fist rejects Guts and Sheer Force for sharing
   `damageBoost`.
5. **`tests/test-stage-planner.js` has no clause for `foe-redirects`.** Tests are outside this brief's files. A red
   demonstration exists as a run: without the redirector, Stalwart reads DID-NOT-FIRE on the planner (HEAD).
6. **CHANGELOG, RUNNING-NOTES and `node engine/status.js --write` belong to the coordinator.** `status.js --write`
   restamps all five ledgers, which is outside this brief's file list.
7. **Debris seen and left alone.** None of it is mine. The six untracked `docs/_reports/2026-09-11-*.md` files and the
   modified deck, technical-docs, MODELS and SUMMARY files predate this session and were not touched.
