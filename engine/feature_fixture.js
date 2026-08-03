/* feature_fixture.js — a guard against a feature's MEANING changing under an unchanged NAME.
 *
 *   node engine/feature_fixture.js                 print every feature's fixture values and hash
 *   node engine/feature_fixture.js --stamp FILE    write the hashes into a weight file
 *   node engine/feature_fixture.js --check FILE    compare a weight file's hashes against the code
 *
 * WHY THIS EXISTS
 * ---------------
 * engine/magnemite.js already refuses to load a weight file whose feature LIST differs (it compares
 * the joined names) and whose vector LENGTH differs. On 2026-08-01 both of those guards passed while
 * a feature quietly started meaning something else:
 *
 *   board.js `allyHit` began asking getImmunity before getEffectiveness, because getEffectiveness
 *   returns 0 for immune AND for neutral. A Flying partner beside Earthquake had read as HIT. The
 *   name did not change, the list did not change, the length did not change -- and every shipped
 *   weight had been fitted against the old meaning.
 *
 * Nothing in the project failed. Twenty-four files read that vector. This is the gap.
 *
 * WHAT IT DOES
 * ------------
 * Feature code is a function from a board to a number. Two versions of that function are the same
 * function if they agree on every board -- so pin a small set of boards, evaluate every feature on
 * them, and hash each feature's COLUMN separately. A changed meaning changes its column and so its
 * hash, and because the hash is per feature the failure names the feature that moved rather than
 * saying "something is different".
 *
 * WHY THE SPECIES AND MOVES ARE WRITTEN DOWN HERE
 * -----------------------------------------------
 * This project's rule is that model quantities are derived from handlers and artifacts, never typed.
 * A fixture is the opposite case and deliberately so: it must be FROZEN. Deriving it from
 * data/meta-usage.json would mean the hashes changed every time Will ingested a day of ladder, which
 * would make the guard cry wolf until it was ignored. So the boards are written down, and they are
 * written down ONCE. Every name is checked against the dex at build time and a missing one throws,
 * so this cannot rot silently into a fixture that exercises nothing.
 *
 * The prior is synthetic for the same reason: passing the real behaviour clone's P(move|species)
 * would tie the hashes to data/move-priors.json and re-ingesting would look like a semantics change.
 *
 * THE LIMITATION, STATED
 * ----------------------
 * Some features read derived tables -- abilityBlock reads data/ability-blocks.json -- so refreshing
 * one of those artifacts CAN move a hash without any code changing. That is not a false alarm in the
 * strict sense: if the table a feature reads has changed, the weight fitted against the old table is
 * stale too. But it is a different cause with the same symptom, and the error message says so.
 *
 * ROUNDING. Values are rounded to ROUND decimals before hashing. A feature's meaning is not carried
 * by its sixteenth decimal place, and hashing raw doubles would make the guard fire on a reordered
 * sum. ROUND is a parameter and is stated as one.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const B = require('./board.js');

const ROUND = 6;

/* ---- THE BOARDS ------------------------------------------------------------------------------
 *
 * Chosen to make the features actually FIRE, not to look like a real game. A feature that is
 * identically zero on every fixture board has a hash indistinguishable from every other zero column,
 * so its meaning could change without this file noticing -- coverage is the whole value here, and
 * the CLI prints which features are still uncovered rather than letting the gap go unstated.
 *
 * EVERY SPECIES MUST BE LEGAL IN THIS FORMAT AND PRESENT IN THE DAMAGE ENGINE'S CACHE, and both are
 * asserted below rather than assumed. The first draft of this file used Amoonguss, Rillaboom,
 * Flutter Mane and Rotom-Wash: three are `tier: Illegal` in the Champions mod and all four are
 * absent from MC.mons, so every damage-derived feature silently read zero on them and the fixture
 * quietly claimed coverage it did not have. That is the same failure the file exists to prevent, so
 * it is now a hard check.
 *
 * Scenario 1 is the board that motivated the whole thing -- a Ground spread move beside a Flying
 * partner -- and scenario 2 is its control, the same move beside a partner that merely takes it. */
const SCENARIOS = [
  {
    label: 'ground-spread-beside-flying-partner',
    p1: [
      { species: 'Garchomp', item: 'Life Orb', ability: 'Rough Skin', nature: 'Jolly',
        moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'] },
      { species: 'Gyarados', item: 'Leftovers', ability: 'Intimidate', nature: 'Adamant',
        moves: ['Waterfall', 'Taunt', 'Protect', 'Dragon Dance'] },
    ],
    p2: [
      { species: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', nature: 'Careful',
        moves: ['Flare Blitz', 'Fake Out', 'Darkest Lariat', 'Parting Shot'] },
      { species: 'Venusaur', item: 'Rocky Helmet', ability: 'Overgrow', nature: 'Relaxed',
        moves: ['Grassy Terrain', 'Solar Beam', 'Sleep Powder', 'Charm'] },
    ],
    /* AEGISLASH IS BENCHED HERE, AND THE SCENARIO IS NOT ARBITRARY.
     *
     * Rotom-Wash covers the hyphen; Sinistcha-Masterpiece covers the cosmetic fallback. NEITHER
     * covers a forme whose body genuinely DIFFERS from its base and so needs its own damage-table
     * row. On 2026-08-02 eight species had no row at all -- five format megas plus Aegislash-Blade,
     * Palafin-Hero and Gourgeist's sizes -- and every damage-derived feature read zero for them. The
     * table changed for all eight and EVERY STORED HASH STAYED IDENTICAL, because none of them stood
     * on these boards. R7 a fourth time: a guard only guards what it exercises.
     *
     * GOURGEIST-SUPER RATHER THAN AEGISLASH, and the difference is the whole point. Aegislash-Blade
     * only exists once Stance Change flips it mid-battle, which a static fixture never does -- so
     * benching "Aegislash" exercises the Shield row, which was never missing. Gourgeist-Super is a
     * species you actually BRING, so it reaches the table directly. Verified rather than assumed:
     * with Aegislash benched, deleting the aegislash-blade row moved ZERO hashes; with
     * Gourgeist-Super benched, deleting its row makes needPlayable() throw by name, which is a
     * louder failure than a moved hash and is the outcome wanted.
     *
     * Two earlier attempts are recorded because both LOOKED right. Benching it in
     * dead-moves-and-status was INERT -- benchRisk is identically zero there, so the swap moved no
     * number and the guard would have looked improved without being improved. Making it ACTIVE
     * REGRESSED coverage: it displaced the Fire partner Torkoal's sun boosts, and
     * weatherSetupHelpsPartner then fired nowhere. Both were caught by RUNNING the coverage check,
     * not by reasoning about it. */
    bench: { p1: ['Whimsicott', 'Torkoal'], p2: ['Grimmsnarl', 'Gourgeist-Super'] },
    state: {},
  },

  {
    label: 'ground-spread-beside-neutral-partner',
    p1: [
      { species: 'Garchomp', item: 'Life Orb', ability: 'Rough Skin', nature: 'Jolly',
        moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'] },
      { species: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', nature: 'Careful',
        moves: ['Flare Blitz', 'Fake Out', 'Darkest Lariat', 'Parting Shot'] },
    ],
    p2: [
      { species: 'Gyarados', item: 'Leftovers', ability: 'Intimidate', nature: 'Adamant',
        moves: ['Waterfall', 'Taunt', 'Protect', 'Dragon Dance'] },
      { species: 'Venusaur', item: 'Rocky Helmet', ability: 'Overgrow', nature: 'Relaxed',
        moves: ['Grassy Terrain', 'Solar Beam', 'Sleep Powder', 'Charm'] },
    ],
    bench: { p1: ['Whimsicott', 'Volcarona'], p2: ['Clefable', 'Grimmsnarl'] },
    state: {},
  },

  /* ROTOM-WASH IS HERE FOR ITS HYPHEN, not for its typing.
   *
   * The damage engine's mon cache keys formes with a hyphen -- `rotom-wash`, `slowking-galar` -- and
   * board.js looked them up through norm(), which strips hyphens. 101 of 308 cache entries were
   * unreachable, covering 8.17% of all observed metagame usage, and every damage-derived feature
   * silently read zero for them. The first version of this fixture used only hyphen-free species, so
   * the guard could not have caught it: a whole code path was outside the boards it checks.
   *
   * A fixture only guards what it exercises, so it now carries at least one hyphenated forme. */
  {
    label: 'dead-moves-and-status',
    p1: [
      { species: 'Rotom-Wash', item: 'Sitrus Berry', ability: 'Levitate', nature: 'Modest',
        moves: ['Hydro Pump', 'Thunderbolt', 'Will-O-Wisp', 'Protect'] },
      /* SINISTCHA-MASTERPIECE IS A COSMETIC FORME, AND THAT IS WHY IT IS HERE.
       *
       * It is not in the damage table under its own name; it resolves to `sinistcha` because their
       * base stats and types are identical (engine/mc_key.js). That resolution is a distinct code
       * path, and on 2026-08-01 the fixture contained no species that took it -- so when the path was
       * added, the semantics guard could not see that feature values had changed for it, and said the
       * weights were fine when they were stale.
       *
       * That is R7 in docs/ARTIFACT-ACCESS-RULES.md, learned the hard way twice in one day: a guard
       * only guards what it exercises. It is on 5.3% of real teams, so this is not a corner. */
      { species: 'Sinistcha-Masterpiece', item: 'Leftovers', ability: 'Hospitality', nature: 'Bold',
        moves: ['Shadow Ball', 'Life Dew', 'Protect', 'Giga Drain'] },
    ],
    p2: [
      { species: 'Venusaur', item: 'Rocky Helmet', ability: 'Overgrow', nature: 'Relaxed',
        moves: ['Grassy Terrain', 'Solar Beam', 'Sleep Powder', 'Charm'] },
      { species: 'Garchomp', item: 'Life Orb', ability: 'Rough Skin', nature: 'Jolly',
        moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'] },
    ],
    /* AEGISLASH AND GOURGEIST-SUPER ARE ON THE BENCH FOR A THIRD DISTINCT REASON, added 2026-08-02.
     *
     * Rotom-Wash covers the hyphen. Sinistcha-Masterpiece covers the cosmetic fallback. NEITHER
     * covers a forme whose body genuinely differs from its base and therefore needs its OWN ROW —
     * and on 2026-08-02 eight species were found to have no row at all, so every damage-derived
     * feature read zero for them: five format megas, plus Aegislash-Blade, Palafin-Hero and
     * Gourgeist's size formes.
     *
     * The damage table changed for all eight and EVERY STORED HASH STAYED IDENTICAL, because not one
     * of them appeared on these boards. The guard reported the weights as current while the function
     * beneath them had moved. R7 for the fourth time: a guard only guards what it exercises.
     *
     * They sit on the BENCH deliberately — benchRisk was among the features reading zero, and the
     * bench lookup is a second call site that was blind in exactly the same way as dmgMon. */
    bench: { p1: ['Gyarados', 'Incineroar'], p2: ['Incineroar', 'Gyarados'] },
    /* Applied after both sides are on the field, so the dead-move family has something to be dead
     * against: a status already inflicted, a side condition already up, a terrain already down,
     * weather already set, and damage taken. */
    state: {
      turn: 6,
      weather: 'RainDance',
      field: ['grassyterrain'],
      side: { p1: ['reflect'] },
      status: { p2: { a: 'slp' } },
      hp: { p1: { a: 0.4 }, p2: { b: 0.55 } },
    },
  },

  /* Every condition a move could set is ALREADY set, so the whole dead-move family has something to
   * be dead against at once. Grimmsnarl has Prankster and Incineroar is Dark, which is the
   * pranksterFailsDark board; Torkoal is left stalling so Protect reads as deadStall. */
  {
    label: 'everything-already-up',
    p1: [
      { species: 'Grimmsnarl', item: 'Light Clay', ability: 'Prankster', nature: 'Careful',
        moves: ['Light Screen', 'Reflect', 'Thunder Wave', 'Spirit Break'] },
      { species: 'Torkoal', item: 'Charcoal', ability: 'Drought', nature: 'Quiet',
        moves: ['Sunny Day', 'Eruption', 'Body Press', 'Protect'] },
    ],
    p2: [
      { species: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', nature: 'Careful',
        moves: ['Flare Blitz', 'Fake Out', 'Darkest Lariat', 'Parting Shot'] },
      { species: 'Venusaur', item: 'Rocky Helmet', ability: 'Overgrow', nature: 'Relaxed',
        moves: ['Grassy Terrain', 'Solar Beam', 'Sleep Powder', 'Charm'] },
    ],
    bench: { p1: ['Clefable', 'Garchomp'], p2: ['Gyarados', 'Whimsicott'] },
    state: {
      turn: 6,
      weather: 'SunnyDay',
      field: ['grassyterrain'],
      side: { p1: ['reflect'], p2: ['tailwind'] },
      status: { p2: { a: 'par' } },
      stalled: { p1: { b: true } },
      hp: { p1: { b: 0.6 }, p2: { a: 0.7 } },
    },
  },

  /* The mirror of the one above: nothing is up, so the SETUP-HELPS-PARTNER family can fire instead of
   * the dead family. Both pairs are a setter beside somebody who benefits -- Tailwind beside an
   * attacker, Sun beside two Fire types. BOTH foes are left nearly dead, because doubleKO is a
   * statement about the pair and one dying foe can only ever produce a single kill. */
  {
    label: 'clean-board-setup-and-kills',
    p1: [
      { species: 'Whimsicott', item: 'Focus Sash', ability: 'Prankster', nature: 'Timid',
        moves: ['Tailwind', 'Encore', 'Moonblast', 'Helping Hand'] },
      { species: 'Volcarona', item: 'Leftovers', ability: 'Flame Body', nature: 'Timid',
        moves: ['Heat Wave', 'Quiver Dance', 'Fiery Dance', 'Rage Powder'] },
    ],
    p2: [
      { species: 'Torkoal', item: 'Charcoal', ability: 'Drought', nature: 'Quiet',
        moves: ['Sunny Day', 'Eruption', 'Body Press', 'Protect'] },
      { species: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', nature: 'Adamant',
        moves: ['Flare Blitz', 'Fake Out', 'Darkest Lariat', 'Protect'] },
    ],
    bench: { p1: ['Garchomp', 'Clefable'], p2: ['Venusaur', 'Gyarados'] },
    state: { turn: 3, hp: { p1: { a: 0.12 }, p2: { a: 0.07, b: 0.07 } } },
  },

  /* ABILITY immunity beside TYPE immunity. Garchomp's Earthquake next to a Levitate partner is the
   * abilityBlock route to the same fact allyHit reads off the type chart, and those two disagreed
   * with each other until 2026-08-01. Clefable's Icy Wind into Garchomp is the only 4x hit on any of
   * these boards. Grimmsnarl brings screens that are NOT already up, standing beside a partner low
   * enough to be threatened, which is what screenWhileThreatened is about. */
  {
    label: 'immunities-screens-and-heals',
    p1: [
      { species: 'Garchomp', item: 'Life Orb', ability: 'Rough Skin', nature: 'Jolly',
        moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'] },
      { species: 'Hydreigon', item: 'Choice Scarf', ability: 'Levitate', nature: 'Modest',
        moves: ['Dark Pulse', 'Dragon Pulse', 'Nasty Plot', 'Protect'] },
    ],
    p2: [
      { species: 'Clefable', item: 'Leftovers', ability: 'Unaware', nature: 'Bold',
        moves: ['Follow Me', 'Life Dew', 'Icy Wind', 'Moonblast'] },
      { species: 'Grimmsnarl', item: 'Light Clay', ability: 'Prankster', nature: 'Careful',
        moves: ['Light Screen', 'Reflect', 'Thunder Wave', 'Spirit Break'] },
    ],
    bench: { p1: ['Whimsicott', 'Gyarados'], p2: ['Venusaur', 'Incineroar'] },
    state: { turn: 4, hp: { p1: { a: 0.3 }, p2: { a: 0.18, b: 0.22 } } },
  },

  /* A PASSED TURN THAT PAYS, added 2026-08-02 with the multi-turn features.
   *
   * `passTurnAccrues` fires only where a Protect-family move meets an ability that gains on residual
   * — Speed Boost, Moody, Opportunist. No board above carried that combination, so the feature was
   * SILENT on the whole fixture the moment it was written, and tests/test-feature-semantics.js said
   * so on the first run. A feature with a zero column has no hash protecting it, which is the same
   * hole that let the forme bug and the missing damage rows through.
   *
   * This is a NEW scenario rather than an edit to one above, and deliberately: on 2026-08-02 two
   * separate attempts to add coverage by MODIFYING an existing board went wrong — one was inert
   * (benched into a slot where the feature is identically zero) and one REGRESSED coverage
   * (displaced Torkoal, and weatherSetupHelpsPartner then fired nowhere). Adding a board cannot take
   * anything away from the boards already there.
   *
   * Blaziken carries Speed Boost and Protect, which is Will's own example and the largest single
   * Protect residual in the corpus at -18.0 points. Torkoal opposite brings Drought and a Trick Room
   * partner, so `setupTurns` is exercised on weather, on a field move and on a screen across this
   * board rather than only on one channel. */
  {
    label: 'passed-turn-that-pays',
    p1: [
      { species: 'Blaziken', item: 'Life Orb', ability: 'Speed Boost', nature: 'Adamant',
        moves: ['Flare Blitz', 'Close Combat', 'Protect', 'Swords Dance'] },
      { species: 'Farigiraf', item: 'Electric Seed', ability: 'Armor Tail', nature: 'Relaxed',
        moves: ['Trick Room', 'Psychic', 'Helping Hand', 'Protect'] },
    ],
    p2: [
      { species: 'Torkoal', item: 'Charcoal', ability: 'Drought', nature: 'Quiet',
        moves: ['Eruption', 'Heat Wave', 'Sunny Day', 'Protect'] },
      { species: 'Pelipper', item: 'Focus Sash', ability: 'Drizzle', nature: 'Modest',
        moves: ['Tailwind', 'Hurricane', 'Weather Ball', 'Wide Guard'] },
    ],
    bench: { p1: ['Incineroar', 'Garchomp'], p2: ['Grimmsnarl', 'Venusaur'] },
    /* THE HP IS A THRESHOLD, FOUND BY SWEEPING, NOT A ROUND NUMBER CHOSEN BECAUSE IT LOOKS TIDY.
     *
     * `boostMayConvertKill` fires only where a boost flips a NON-kill into a kill, which is a narrow
     * band by construction. Swept 0.90 down to 0.25 in steps: it fires at 0.50 and NOWHERE ELSE.
     *
     * It went silent across the whole fixture when the July Smogon priors landed — the spreads and
     * item odds moved, the damage estimates moved with them, and a feature that had been covered
     * stopped being. That is the honest reason this value is here, and it is also the honest warning
     * about it: a knife-edge board can go silent again the next time the priors move. The test that
     * demands every feature fire is what will say so, which is the arrangement wanted — the coverage
     * check is load-bearing, not decoration. */
    state: { turn: 3, hp: { p2: { a: 0.5, b: 0.5 } } },
  },

  /* The leftovers, each of which was identically zero on the boards above: a charge move, a recharge
   * move, stat stages already on the field, and a target that stalled last turn so Encore has
   * something to punish. The terrain SETTER and the mon whose move it lifts have to be different
   * slots or the pair feature has no pair -- Venusaur lays it, Sceptile's Grass moves benefit.
   *
   * BOTH defence stages are set, not just one: tgtDefenseStage reads `def` for a physical move and
   * `spd` for a special one, so a fixture that boosts only `def` leaves it silent for every special
   * attacker on the board, which is how it read zero on the first pass. */
  {
    label: 'charge-recharge-stages-and-stall',
    p1: [
      { species: 'Venusaur', item: 'Miracle Seed', ability: 'Overgrow', nature: 'Modest',
        moves: ['Grassy Terrain', 'Solar Beam', 'Sleep Powder', 'Charm'] },
      { species: 'Sceptile', item: 'Sitrus Berry', ability: 'Overgrow', nature: 'Timid',
        moves: ['Energy Ball', 'Leaf Blade', 'Hyper Beam', 'Protect'] },
    ],
    p2: [
      { species: 'Whimsicott', item: 'Focus Sash', ability: 'Prankster', nature: 'Timid',
        moves: ['Tailwind', 'Encore', 'Moonblast', 'Helping Hand'] },
      { species: 'Farigiraf', item: 'Throat Spray', ability: 'Armor Tail', nature: 'Quiet',
        moves: ['Hyper Beam', 'Trick Room', 'Psychic', 'Helping Hand'] },
    ],
    bench: { p1: ['Garchomp', 'Volcarona'], p2: ['Incineroar', 'Gyarados'] },
    state: {
      turn: 8,
      stalled: { p1: { a: true } },
      boosts: {
        p1: { a: { atk: 2, spa: 1 }, b: { spd: 1 } },
        p2: { a: { def: 2, spd: 2 }, b: { atk: 1, spe: 1, def: -1, spd: -2 } },
      },
      /* 0.6 rather than a rounder number because it is the value that makes boostMayConvertKill fire:
       * that feature needs the partner's kill to be a ROLL, which is a narrow band of target HP, and
       * it was the last of the 74 still reading identically zero. Found by sweeping, not chosen. */
      hp: { p1: { a: 0.6, b: 0.6 }, p2: { a: 0.3, b: 0.85 } },
    },
  },
];

function need(x, what, name) {
  if (!x || !x.exists) throw new Error(`feature_fixture: the ${what} "${name}" is not in the Champions dex — the fixture is stale and is no longer exercising what it claims to`);
  return x;
}

/* A SPECIES THAT IS NOT REALLY PLAYABLE HERE MAKES THE FIXTURE LIE ABOUT ITS OWN COVERAGE.
 *
 * Two separate ways that happens, and both are checked because they are independent:
 *
 *   1. Illegal in the format. dex.species.get() answers for the whole National Dex, so a species can
 *      exist, have types, produce candidates and features, and still be something no opponent can
 *      ever bring. Amoonguss, Rillaboom and Flutter Mane are all `tier: Illegal` in the Champions mod.
 *   2. Missing from the damage engine's mon cache. MC.mons holds 308 entries against 357 standard
 *      species, and everything routed through buildMon -- the kill features, the threat features,
 *      benchRisk, clickCost -- silently returns nothing for a species that is not in it. The column
 *      then reads all-zero, which hashes the same as every other all-zero column and guards nothing.
 *
 * Rotom-Wash is the case that shows these are different questions: legal in the format, absent from
 * MC.mons. That gap is real and is not this file's to fix; it is reported by the CLI. */
function needPlayable(sp, dex, name) {
  const s = need(dex.species.get(name), 'species', name);
  if (s.isNonstandard || s.tier === 'Illegal') {
    throw new Error(`feature_fixture: "${name}" is not legal in ${require('./champions_sim.js').FORMAT} `
      + `(tier ${s.tier}, isNonstandard ${s.isNonstandard}). A board that cannot occur is not a fixture.`);
  }
  /* Asked through board.js's own resolver rather than by re-deriving the key here. The first version
   * of this check re-implemented `MC.mons[norm(name)]`, which is precisely the lookup that was broken
   * -- so it agreed with the bug and would have rejected every hyphenated forme as "not in the cache"
   * when the entry was there all along. A guard that re-derives what it is guarding tests nothing. */
  const MC = globalThis.MC;
  /* A DECLARED miss: this check EXISTS to detect absence and then throw its own, better error. */
  if (MC && MC.mons && !B.mcKeyFor(name, { mayMiss: 'this guard is asking whether the species is absent' })) {
    throw new Error(`feature_fixture: "${name}" is legal but is NOT in the damage engine's mon cache `
      + `(MC.mons), so every damage-derived feature reads zero on it and the fixture would claim `
      + `coverage it does not have. Pick a species that is in the cache.`);
  }
  return s;
}

/* ---- BUILD ------------------------------------------------------------------------------------ */
function buildScenario(sc, dex) {
  const board = new B.Board();
  B.damageEngine();          // so globalThis.MC exists before needPlayable checks it
  for (const side of ['p1', 'p2']) {
    for (const m of sc[side]) {
      needPlayable(m.species, dex, m.species);
      for (const mv of m.moves) need(dex.moves.get(mv), 'move', mv);
      board.setSheet(side, m.species, { nature: m.nature, item: m.item, ability: m.ability, moves: m.moves });
    }
    for (const sp of sc.bench[side]) needPlayable(sp, dex, sp);
    board.setParty(side, sc[side].map(m => m.species).concat(sc.bench[side]));
    board.switchIn(side, 'a', sc[side][0].species);
    board.switchIn(side, 'b', sc[side][1].species);
  }

  /* Set through the Board's own doors -- startSide, startField, setWeather -- rather than by reaching
   * into its maps, so the fixture keeps working if the storage shape changes and breaks loudly if the
   * API does. The turn is set FIRST because startSide and startField store an expiry relative to it. */
  const st = sc.state || {};
  if (st.turn != null) board.turn = st.turn;
  if (st.weather) board.setWeather(st.weather);
  if (st.field) for (const f of st.field) board.startField(f, 5);
  if (st.side) for (const s of Object.keys(st.side)) for (const c of st.side[s]) board.startSide(s, c, 5);
  const each = (obj, fn) => { if (!obj) return; for (const s of Object.keys(obj)) for (const L of Object.keys(obj[s])) { const m = board.slot(s, L); if (m) fn(m, obj[s][L]); } };
  each(st.status, (m, v) => { m.status = v; });
  each(st.hp, (m, v) => { m.hp = v; });
  each(st.stalled, (m, v) => { m.stalledLastTurn = v; });
  each(st.boosts, (m, v) => { m.boosts = { ...m.boosts, ...v }; });
  each(st.lastMove, (m, v) => { m.lastMove = B.norm(v); });

  const out = [];
  for (const side of ['p1', 'p2']) {
    for (const L of ['a', 'b']) {
      const user = board.slot(side, L);
      if (!user) continue;
      const cands = B.candidates(user.moves, user, board, side, dex);
      /* A SYNTHETIC PRIOR, deliberately. See the header: the real one would tie these hashes to a
       * data file that Will re-ingests. Deterministic in the candidate's index so the column is not
       * constant, which would hide a change in anything that reads it. */
      const feats = cands.map((c, i) => B.featuresFor(c, user, board, side, dex, (i + 1) / (cands.length + 1)));
      out.push({ label: `${sc.label}/${side}${L}`, board, side, letter: L, cands, feats });
    }
  }
  return out;
}

function build(dex) {
  if (!dex) {
    const CS = require('./champions_sim.js');
    dex = CS.sim().Dex.forFormat(CS.FORMAT);
  }
  const slots = [];
  for (const sc of SCENARIOS) slots.push(...buildScenario(sc, dex));
  if (!slots.length) throw new Error('feature_fixture: produced no scored slots');
  return slots;
}

/* ---- THE MATRIX AND THE HASHES ---------------------------------------------------------------- */
const r = v => {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  return n.toFixed(ROUND);
};
const h = parts => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);

/* Every feature's column, in the order the fixture produces it. */
function columns(dex) {
  const slots = build(dex);
  const marg = {}, joint = {};
  for (const f of B.FEATURES) marg[f] = [];
  for (const f of B.JOINT_FEATURES) joint[f] = [];

  let nCands = 0, nPairs = 0;
  for (const s of slots) {
    for (const x of s.feats) {
      nCands++;
      for (let k = 0; k < B.FEATURES.length; k++) marg[B.FEATURES[k]].push(r(x[k]));
    }
  }
  /* Pairs are formed WITHIN a scenario, slot a against slot b of the same side, because that is the
   * only pairing jointFeaturesFor is ever asked about. */
  for (let i = 0; i < slots.length; i++) {
    const A = slots[i];
    const Bs = slots.find(s => s !== A && s.side === A.side && s.label.split('/')[0] === A.label.split('/')[0] && s.letter > A.letter);
    if (!Bs) continue;
    for (let ia = 0; ia < A.cands.length; ia++) {
      for (let ib = 0; ib < Bs.cands.length; ib++) {
        nPairs++;
        const j = B.jointFeaturesFor(A.cands[ia], Bs.cands[ib], A.feats[ia], Bs.feats[ib]);
        for (let k = 0; k < B.JOINT_FEATURES.length; k++) joint[B.JOINT_FEATURES[k]].push(r(j[k]));
      }
    }
  }
  return { marg, joint, nCands, nPairs, nSlots: slots.length };
}

/* ---- THE INPUTS, NOT JUST THE FUNCTION -------------------------------------------------------
 *
 * THE GAP THIS CLOSES, found on 2026-08-02 by walking into it.
 *
 * Everything above hashes what the features COMPUTE on a frozen set of boards. That catches a change
 * to board.js -- a feature quietly changing meaning under its own name -- which is what it was built
 * for and it does that well.
 *
 * It cannot catch a change to what the features READ. `build/rebuild_sets_from_sheets.js` rewrote the
 * sets of eight species (Snorlax's whole moveset, Mawile's ability, Zoroark's four moves) and EVERY
 * ONE OF THE 74 FEATURE HASHES STAYED IDENTICAL, because none of those eight stand on these boards.
 * 27.57% of the fit corpus contains one of them. The guard was silent, the weights were stale, and
 * silence read exactly like agreement.
 *
 * That is R7 for the fifth time, and adding those eight species to SCENARIOS would be R7 for the
 * sixth: the next regeneration touches a different eight. A hand-listed fixture can only ever guard
 * the species somebody remembered, so the fix cannot be another entry in the list.
 *
 * This SWEEPS the artifact instead of naming anything in it -- every set-bearing field of every
 * species in the table the damage engine actually reads. Nothing is typed, and a species added to the
 * format is covered the day it appears.
 *
 * IT IS A SEPARATE BLOCK BECAUSE IT MEANS A DIFFERENT THING, and the project's own rule turns on that
 * distinction. A moved FEATURE hash means board.js changed and the weights now describe a different
 * quantity: refit, never restamp. A moved TABLE hash means a derived table was re-ingested, which may
 * or may not reach the fit -- the honest answer is to measure how much of the corpus it touches.
 * Collapsing the two into one verdict makes the louder one unreadable. */
function tableDigest() {
  /* THROUGH THE ACCESSOR, NOT THE RAW TABLE (R1). The first version of this read Object.keys(MC.mons)
   * directly and tests/test-mc-key.js failed it in the same run — so mcKey gained an `all` verb
   * rather than this file gaining a baseline exemption. See engine/mc_key.js. */
  let rows = null;
  try {
    const MK = require('./mc_key.js');
    rows = MK.mcKey.all({ mayMiss: 'a digest of a table that is not loaded is UNAVAILABLE, not empty' });
  } catch (e) {
    /* Named, not swallowed. "The table check could not run" and "the table did not change" are the
     * two meanings this repository keeps collapsing into one value, and here that distinction is the
     * entire point of the function. */
    if (typeof console !== 'undefined' && console.error) {
      console.error('feature_fixture: table digest unavailable (' + e.message + '). This is NOT a '
        + 'statement that the damage table is unchanged.');
    }
    return { species: 0, digest: 'UNAVAILABLE' };
  }
  if (!rows) return { species: 0, digest: 'UNAVAILABLE' };
  const parts = [];
  for (const [n, m0] of rows) {
    const m = m0 || {};
    /* Set-bearing fields plus the stats and typing the damage formula multiplies. */
    parts.push(n + '=' + JSON.stringify([
      m.mv || [], m.item || null, m.ab || null, m.st || null, m.bs || null, m.ty || null,
    ]));
  }
  return { species: rows.length, digest: h(parts) };
}

function hashes(dex) {
  const c = columns(dex);
  const features = {}, jointFeatures = {};
  for (const f of B.FEATURES) features[f] = h(c.marg[f]);
  for (const f of B.JOINT_FEATURES) jointFeatures[f] = h(c.joint[f]);
  return {
    version: 2, round: ROUND,
    scenarios: SCENARIOS.map(s => s.label),
    candidates: c.nCands, pairs: c.nPairs,
    features, jointFeatures,
    table: tableDigest(),
  };
}

/* ---- THE CHECK, called from magnemite.js when weights load ------------------------------------ */
/* Returns null when the file agrees with the code, or a message naming the features that moved.
 * A file with no hashes at all returns a message too -- silence about a missing guard is how the
 * original defect survived. `which` is 'features' or both, so the joint file can check both blocks. */
function verify(stored, dex, opts) {
  const want = (opts && opts.blocks) || ['features'];
  if (!stored || !stored.features) {
    return 'this weight file carries no feature-semantics hashes. Stamp it with:\n'
      + '    node engine/feature_fixture.js --stamp <file>\n'
      + '  and refit if board.js has changed since the file was written.';
  }
  const now = hashes(dex);
  if (stored.round !== now.round || (stored.scenarios || []).join(',') !== now.scenarios.join(',')) {
    return `the fixture itself changed (rounding ${stored.round} -> ${now.round}, scenarios `
      + `${(stored.scenarios || []).length} -> ${now.scenarios.length}). Old hashes cannot be compared; restamp after checking board.js.`;
  }
  /* THE TABLE CHECK RUNS FIRST AND REPORTS SEPARATELY. A weight file stamped before this block
   * existed carries no `table`, and that is not a mismatch — it is an older stamp, which must not
   * be announced as staleness or every pre-existing file cries wolf on the first run. */
  if (stored.table && stored.table.digest && now.table && now.table.digest !== 'UNAVAILABLE'
      && stored.table.digest !== now.table.digest) {
    return 'the DAMAGE TABLE these weights were fitted against has been regenerated '
      + `(${stored.table.species} species -> ${now.table.species}, digest ${stored.table.digest} -> ${now.table.digest}).\n`
      + '  The feature hashes below may still match and that is NOT reassurance: the fixture stands on a\n'
      + '  fixed handful of species, so a set change to any species it does not contain moves nothing here.\n'
      + '  Measure what it touches before deciding — how many corpus games contain a changed species —\n'
      + '  then refit (node engine/fit_policy.js, then node engine/fit_joint.js) if it reaches the fit,\n'
      + '  or restamp with: node engine/feature_fixture.js --stamp <file>';
  }
  const moved = [];
  for (const blk of want) {
    const a = stored[blk] || {}, b = now[blk] || {};
    for (const f of Object.keys(b)) {
      if (a[f] === undefined) moved.push(`${f} (not in the stored hashes)`);
      else if (a[f] !== b[f]) moved.push(`${f} (${a[f]} -> ${b[f]})`);
    }
  }
  if (!moved.length) return null;
  return 'these features changed MEANING since the weights were fitted — same name, different value '
    + 'on the fixture board:\n    ' + moved.join('\n    ')
    + '\n  The weights were fitted against the old definition and no longer describe these quantities.'
    + '\n  Refit (node engine/fit_policy.js, then node engine/fit_joint.js), or if a derived table was'
    + '\n  merely re-ingested, restamp with: node engine/feature_fixture.js --stamp <file>';
}

module.exports = { SCENARIOS, ROUND, build, columns, hashes, verify };

/* ---- CLI -------------------------------------------------------------------------------------- */
if (require.main === module) {
  const CS = require('./champions_sim.js');
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

  const stampFile = arg('--stamp'), checkFile = arg('--check');
  if (stampFile) {
    const f = path.resolve(stampFile);
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    j.featureHashes = hashes(dex);
    fs.writeFileSync(f, JSON.stringify(j, null, 2));
    console.log(`stamped ${Object.keys(j.featureHashes.features).length} feature hashes and `
      + `${Object.keys(j.featureHashes.jointFeatures).length} joint hashes into ${path.relative(process.cwd(), f)}`);
    console.log(`  fixture: ${j.featureHashes.candidates} candidates, ${j.featureHashes.pairs} pairs, `
      + `${j.featureHashes.scenarios.length} scenarios`);
    process.exit(0);
  }
  if (checkFile) {
    const j = JSON.parse(fs.readFileSync(path.resolve(checkFile), 'utf8'));
    const blocks = j.jointFeatures ? ['features', 'jointFeatures'] : ['features'];
    const msg = verify(j.featureHashes, dex, { blocks });
    if (msg) { console.error(`FEATURE SEMANTICS CHECK FAILED — ${checkFile}\n  ${msg}`); process.exit(1); }
    console.log(`feature semantics OK — ${checkFile} agrees with board.js on every fixture board`);
    process.exit(0);
  }

  const c = columns(dex);
  const H = hashes(dex);
  console.log(`FEATURE FIXTURE — ${c.nSlots} slots, ${c.nCands} candidates, ${c.nPairs} pairs, rounding ${ROUND}\n`);
  console.log('MARGINAL FEATURES (hash, how many fixture candidates it fires on)');
  for (const f of B.FEATURES) {
    const col = c.marg[f];
    const nz = col.filter(v => +v !== 0).length;
    console.log(`  ${f.padEnd(24)} ${H.features[f]}  ${String(nz).padStart(4)}/${col.length}${nz ? '' : '   <- never fires on this fixture'}`);
  }
  console.log('\nJOINT FEATURES');
  for (const f of B.JOINT_FEATURES) {
    const col = c.joint[f];
    const nz = col.filter(v => +v !== 0).length;
    console.log(`  ${f.padEnd(24)} ${H.jointFeatures[f]}  ${String(nz).padStart(4)}/${col.length}${nz ? '' : '   <- never fires on this fixture'}`);
  }
}
