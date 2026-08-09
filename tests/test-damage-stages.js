/* THE DAMAGE STAGE GATE — every multiplier, at every roll, against the authority, exactly.
 *
 *   SHOWDOWN_PATH=... node tests/test-damage-stages.js
 *
 * WHY THIS EXISTS, AND WHY NOTHING ELSE IN THIS REPO COULD HAVE CAUGHT WHAT IT CATCHES
 * -----------------------------------------------------------------------------------
 * Showdown applies each multiplier at a STAGE — a base power, a stat, or the final damage — folds
 * every handler at that stage into ONE `event.modifier`, and spends it ONCE. Until ROADMAP #92 this
 * engine applied roughly a third of them at a DIFFERENT stage, and separately. The truncations
 * between stages do not commute, so the answer came out a point or two off, which reads as rounding
 * to every human and every gate in this repo.
 *
 * That disguise is why it survived audits for months. BOTH engines "apply Black Glasses", so:
 *   - tests/test-mechanics.js sees it LIVE, because the arms differ and the mechanic is present;
 *   - the interaction matrix sees agreement, because it compares a RATIO between arms;
 *   - tests/test-engine-diff.js allows a 12% midpoint band, by design, so it cannot see one point;
 *   - the protocol differential compares whole games, and one point of damage rarely forks a game.
 * It surfaced only as an unexplained "off-by-one" bucket — 58 games at turn 1.
 *
 *     SHOWDOWN:  BP 85 -> x1.2 -> BP 102 -> base 72 -> STAB -> 108      Black Glasses is onBasePower
 *     OURS:      BP 85 ->         base 61 -> STAB 91 -> x1.2 -> 109     we multiplied the FINAL damage
 *
 * WHAT THIS GATE DOES DIFFERENTLY, IN THREE WAYS THAT EACH MATTER
 * --------------------------------------------------------------
 * 1. EXACT EQUALITY. No band, no ratio, no midpoint. `===` against Showdown's own `moveHit`.
 * 2. ALL SIXTEEN ROLLS, both crit states. Every existing check pins the TOP roll, and the top roll is
 *    where a stage error is SMALLEST — the randomizer is the identity there. Worked example from the
 *    audit: Kowtow Cleave at base 61, six of sixteen rolls disagree and ROLL 0, the one everything
 *    pins, is one of the ten that AGREE. The crit family measured 5.5% wrong at the bottom roll with
 *    nothing on and 61.8% with a crit and a Life Orb; at the top roll it looked like 20%.
 * 3. TWO-MODIFIER ROWS. A fix that moves every multiplier to the right stage but still spends each
 *    one separately passes every single-modifier test anybody would write. Demonstrated: Gallade
 *    Drain Punch into Snorlax with Iron Fist AND Muscle Band read 228 in the authority and 227 here
 *    while EACH ONE ALONE agreed. Every stage below carries at least one two-member row, marked
 *    CHAIN, and they are the rows that fail first if somebody re-introduces a per-member floor.
 *
 * AND IT CHECKS THE KNOB MOVES BEFORE IT CHECKS THE ANSWER. `docs/LESSONS.md`: identical results
 * across a varied knob mean the knob is unwired, not that it does not matter. Every scenario is run
 * against its own control first and the gate FAILS if the two are equal — a row that agrees with the
 * authority because neither engine did anything is not evidence. The Electric-Terrain probe in
 * tests/test-mechanics.js hit exactly this on its first run (Thunderbolt into a Ground type, 0 both
 * arms) and that is why this check is here rather than assumed.
 *
 * WHAT IT CANNOT SEE, STATED RATHER THAN DISCOVERED
 * ------------------------------------------------
 * The harness calls `battle.actions.moveHit`, one level below `spreadMoveHit`, so `ModifyMove`,
 * `spreadHit` and `willCrit` never fire on their own. `willCrit` and `spreadHit` are staged by hand
 * here and said so. `ModifyMove` cannot be: it means Showdown never sets `typeChangerBoosted`, so
 * the -ate abilities' retype does not happen on the reference side and a Pixilate row would compare
 * two different moves. Pixilate is therefore NOT in this matrix; its stage is argued from
 * `data/abilities.ts` in docs/DAMAGE-STAGES.md and its behaviour is probed in tests/test-mechanics.js.
 * Sheer Force IS here, with `move.hasSheerForce` staged by hand exactly as its `onModifyMove` would.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('DAMAGE STAGE GATE');
  console.log('  FAIL SHOWDOWN_PATH is not set, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const MC = globalThis.MC;
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* ---------------------------------------------------------------------------------------------
 * THE STAGING. Flat bodies in BOTH engines — level 50, 0 EVs, 31 IVs, Serious — so the two are
 * comparing arithmetic and not two different stat lines. The dataset's own spread let a real
 * truncation bug ride for weeks because both engines happened to land on the same integer.
 * ------------------------------------------------------------------------------------------- */
const FILLER = ['Ditto', 'Ditto', 'Ditto'];
/* THE INERT SLOT'S MOVE IS DERIVED, NOT NAMED (2026-08-09, ROADMAP #116). 'Tackle' is
 * `isNonstandard: 'Past'` and does not exist in this format; it padded every non-acting slot here. */
const inertMove = (species) => CS.firstLegalMove(species) || CS.INERT_MOVE;
const flatStat = (b) => Math.floor((2 * b + 31) * 50 / 100) + 5;
const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
function flatStats(name) {
  const bs = dex.species.get(name).baseStats;
  return { hp: flatHP(bs.hp), at: flatStat(bs.atk), df: flatStat(bs.def),
           sa: flatStat(bs.spa), sd: flatStat(bs.spd), sp: flatStat(bs.spe) };
}
function mkSet(name, move) {
  return { name, species: name, item: '', ability: dex.species.get(name).abilities[0],
           moves: [move], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 };
}

/* THE AUTHORITY. */
function showdownDamage(o) {
  const teamA = [mkSet(o.att, o.move), ...FILLER.map(f => mkSet(f, inertMove(f)))];
  const teamB = [mkSet(o.def, inertMove(o.def)), ...FILLER.map(f => mkSet(f, inertMove(f)))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  const A = flatStats(o.att), Dst = flatStats(o.def);
  src.storedStats.atk = A.at; src.storedStats.spa = A.sa; src.storedStats.def = A.df; src.storedStats.spd = A.sd;
  tgt.storedStats.atk = Dst.at; tgt.storedStats.spa = Dst.sa; tgt.storedStats.def = Dst.df; tgt.storedStats.spd = Dst.sd;
  src.maxhp = A.hp; src.hp = A.hp;
  /* UNFAINTABLE, and it is not a convenience. The reference reports HP ACTUALLY LOST, so a KO clamps
   * it at the defender's maximum — "strong" and "much stronger" then print the same number and the
   * two engines agree for a reason that has nothing to do with the arithmetic. The same multiple is
   * applied on our side. */
  tgt.maxhp = Dst.hp * 40; tgt.hp = tgt.maxhp;
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) p.clearBoosts();
  battle.field.clearWeather(); battle.field.clearTerrain();
  if (o.attItem) src.item = dex.items.get(o.attItem).id;
  if (o.defItem) tgt.item = dex.items.get(o.defItem).id;
  /* BOTH ABILITIES ARE SET EXPLICITLY, ALWAYS. Leaving one at the species default made Araquanid's
   * own Water Bubble the control for the Water Bubble arm, and Heliolisk's own Dry Skin the control
   * for the Dry Skin arm — the compare-a-Scarf-against-a-Scarf failure, and it happened here before
   * it was caught. Illuminate touches no damage event. */
  const setAb = (p, name) => {
    const ab = dex.abilities.get(name);
    if (!ab.exists) throw new Error('no ability ' + name);
    p.ability = ab.id; p.abilityState = { id: ab.id, target: p, effectOrder: 0 };
  };
  setAb(src, o.attAb || 'Illuminate'); src.abilityState.fallen = o.fallen || 0;
  setAb(tgt, o.defAb || 'Illuminate');
  if (o.terrain) {
    battle.field.setTerrain(o.terrain, src);
    if (battle.field.terrain !== dex.conditions.get(o.terrain).id) throw new Error('terrain did not take');
  }
  if (o.weather) {
    battle.field.setWeather(o.weather, src);
    if (battle.field.weather !== dex.conditions.get(o.weather).id) throw new Error('weather did not take');
  }
  battle.random = (n) => (n === 16 ? (o.roll == null ? 0 : o.roll) : 0);
  const move = battle.dex.getActiveMove(o.move);
  move.willCrit = !!o.crit || !!battle.dex.moves.get(o.move).willCrit;   // STAGED BY HAND — see the header
  move.hit = 1;
  if (o.sheerForce) { delete move.secondaries; move.hasSheerForce = true; }   // STAGED BY HAND
  if (o.spread) move.spreadHit = true;                                        // STAGED BY HAND
  if (o.burn) { src.setStatus('brn'); if (src.status !== 'brn') throw new Error('burn did not take'); }
  if (o.helpingHand) { src.addVolatile('helpinghand', src); src.volatiles['helpinghand'].multiplier = 1.5; }
  if (o.friendGuard) {
    const pal = battle.p2.active[1] || battle.p2.pokemon[1];
    if (!pal) throw new Error('no ally slot for Friend Guard');
    setAb(pal, 'Friend Guard');
    if (!battle.p2.active.includes(pal)) battle.p2.active[1] = pal;
  }
  const before = tgt.hp;
  battle.actions.moveHit(tgt, src, move);
  return before - tgt.hp;
}

/* OURS — all sixteen rolls in one call, through dmgRange's `hit.rolls` out-parameter. */
function medichamRolls(o) {
  const a = MEDI.buildMon(o.att.toLowerCase().replace(/[^a-z0-9]/g, ''), {});
  const d = MEDI.buildMon(o.def.toLowerCase().replace(/[^a-z0-9]/g, ''), {});
  if (!a || !d) throw new Error('buildMon failed for ' + o.att + ' / ' + o.def);
  a.st = flatStats(o.att); d.st = Object.assign({}, flatStats(o.def));
  d.st.hp = d.st.hp * 40;
  a.curHP = a.st.hp; d.curHP = d.st.hp;
  a.item = o.attItem ? dex.items.get(o.attItem).id : '';
  d.item = o.defItem ? dex.items.get(o.defItem).id : '';
  a.ability = o.attAb ? dex.abilities.get(o.attAb).id : 'none';
  d.ability = o.defAb ? dex.abilities.get(o.defAb).id : 'none';
  if (o.fallen) a._fallenStuck = o.fallen;
  if (o.burn) a.status = 'brn';
  /* THE TWO ENGINES SPELL THE SKY DIFFERENTLY, and the translation is here rather than in the
   * scenario so a scenario says the AUTHORITY's word once and both sides read it. Getting this wrong
   * silently disables the weather on our side only, which is what the first run of this file did:
   * `field.weather = 'sunnyday'` matches none of medicham's branches, so the sun arm read the clear
   * number and 64 rows went red against an engine that was right. */
  const WEATHER = { sunnyday: 'sun', desolateland: 'sun', raindance: 'rain', primordialsea: 'rain',
                    sandstorm: 'sand', snowscape: 'snow', snow: 'snow', hail: 'snow' };
  let ourWeather = '';
  if (o.weather) {
    ourWeather = WEATHER[o.weather];
    if (!ourWeather) throw new Error('no medicham spelling for weather ' + o.weather);
  }
  const field = { terrain: o.terrain || '', weather: ourWeather, twA: 0, twB: 0 };
  const mv = MC.moves[dex.moves.get(o.move).id];
  if (!mv) throw new Error('no move row for ' + o.move);
  const hit = { rolls: [] };
  if (o.helpingHand) hit.helpingHand = true;
  if (o.friendGuard) hit.allyDamageMult = 0.75;
  MEDI.dmgRange(a, d, mv, field, !!o.spread, !!o.crit, hit);
  return hit.rolls;
}

/* ---------------------------------------------------------------------------------------------
 * THE MATRIX
 * ------------------------------------------------------------------------------------------- */
let compared = 0, disagreed = 0, flat = 0, threw = 0;
const failures = [];

function row(stage, label, scenario, control, knobCrit) {
  /* THE KNOB CHECK FIRST. `control` is the same scenario with the varied thing removed; if the
   * authority gives the same answer either way, the row proves nothing and this gate says so.
   * `knobCrit` exists for the one family whose knob is INVISIBLE without a crit: Sniper's handler
   * returns early unless `getMoveHitData(move).crit`, so its non-crit control is identical by the
   * rule rather than by a defect. The flag is per-row and explicit; defaulting the whole check to a
   * crit would hide a genuinely dead knob everywhere else. */
  if (control) {
    let c, t;
    const at = { roll: 0, crit: !!knobCrit };
    try { c = showdownDamage(Object.assign({}, control, at)); t = showdownDamage(Object.assign({}, scenario, at)); }
    catch (e) { threw++; failures.push(`${label}: control THREW ${e.message}`); return; }
    if (c === t) {
      flat++;
      failures.push(`${label}: THE KNOB DOES NOT MOVE THE AUTHORITY (${c} -> ${t}). ` +
                    'A row that agrees because neither engine did anything is not evidence.');
      return;
    }
  }
  for (const crit of [false, true]) {
    let ours;
    try { ours = medichamRolls(Object.assign({}, scenario, { crit })); }
    catch (e) { threw++; failures.push(`${label} crit=${crit}: OURS THREW ${e.message}`); continue; }
    for (let i = 0; i < 16; i++) {
      let theirs;
      try { theirs = showdownDamage(Object.assign({}, scenario, { crit, roll: i })); }
      catch (e) { threw++; failures.push(`${label} crit=${crit} roll=${i}: AUTHORITY THREW ${e.message}`); continue; }
      compared++;
      if (theirs !== ours[i]) {
        disagreed++;
        if (failures.length < 60)
          failures.push(`${stage} | ${label} | crit=${crit} roll=${i}: showdown ${theirs}, ours ${ours[i]}`);
      }
    }
  }
}

const K = { att: 'Kingambit', move: 'Kowtow Cleave', def: 'Snorlax' };
const KC = { att: 'Kingambit', move: 'Kowtow Cleave', def: 'Charizard' };
const G = { att: 'Gallade', move: 'Drain Punch', def: 'Snorlax' };
const A = { att: 'Alakazam', move: 'Psychic', def: 'Snorlax' };
const C = { att: 'Charizard', move: 'Flamethrower', def: 'Snorlax' };
const P = { att: 'Pikachu', move: 'Thunderbolt', def: 'Snorlax' };
const with_ = (base, extra) => Object.assign({}, base, extra);

/* --- STAGE 0: THE CONTROL. Anything red here is NOT the stage class and must be read as such. --- */
row('control', 'kowtow -> charizard, nothing on', KC, null);
row('control', 'psychic -> snorlax, nothing on', A, null);
row('control', 'drain punch -> snorlax, nothing on', G, null);
row('control', 'flamethrower -> snorlax, nothing on', C, null);

/* --- STAGE 1: THE BASE POWER CHAIN --- */
row('basePower', 'black glasses (type item)', with_(KC, { attItem: 'Black Glasses' }), KC);
row('basePower', 'charcoal (type item)', with_(C, { attItem: 'Charcoal' }), C);
row('basePower', 'fairy feather (type item)',
    { att: 'Sylveon', move: 'Moonblast', def: 'Goodra', attItem: 'Fairy Feather' },
    { att: 'Sylveon', move: 'Moonblast', def: 'Goodra' });
row('basePower', 'helping hand', with_(A, { helpingHand: true }), A);
row('basePower', 'helping hand on a physical click', with_(K, { helpingHand: true }), K);
row('basePower', 'technician',
    { att: 'Scizor', move: 'Bullet Punch', def: 'Snorlax', attAb: 'Technician' },
    { att: 'Scizor', move: 'Bullet Punch', def: 'Snorlax' });
row('basePower', 'tough claws [5325/4096]', with_(G, { attAb: 'Tough Claws' }), G);
row('basePower', 'sharpness',
    { att: 'Gallade', move: 'Sacred Sword', def: 'Snorlax', attAb: 'Sharpness' },
    { att: 'Gallade', move: 'Sacred Sword', def: 'Snorlax' });
row('basePower', 'iron fist', with_(G, { attAb: 'Iron Fist' }), G);
row('basePower', 'muscle band [4505/4096]', with_(G, { attItem: 'Muscle Band' }), G);
row('basePower', 'wise glasses [4505/4096]', with_(A, { attItem: 'Wise Glasses' }), A);
row('basePower', 'supreme overlord n=1', with_(K, { attAb: 'Supreme Overlord', fallen: 1 }), K);
row('basePower', 'supreme overlord n=3', with_(K, { attAb: 'Supreme Overlord', fallen: 3 }), K);
row('basePower', 'supreme overlord n=5', with_(K, { attAb: 'Supreme Overlord', fallen: 5 }), K);
row('basePower', 'sheer force',
    { att: 'Kingambit', move: 'Iron Head', def: 'Snorlax', attAb: 'Sheer Force', sheerForce: true },
    { att: 'Kingambit', move: 'Iron Head', def: 'Snorlax' });
row('basePower', 'dry skin (onSourceBasePower)',
    { att: 'Houndoom', move: 'Fire Blast', def: 'Heliolisk', defAb: 'Dry Skin' },
    { att: 'Houndoom', move: 'Fire Blast', def: 'Heliolisk' });
row('basePower', 'expanding force (move reads terrain)',
    { att: 'Hatterene', move: 'Expanding Force', def: 'Snorlax', terrain: 'psychicterrain' },
    { att: 'Hatterene', move: 'Expanding Force', def: 'Snorlax' });
row('basePower', 'rising voltage (move reads terrain)',
    { att: 'Pikachu', move: 'Rising Voltage', def: 'Snorlax', terrain: 'electricterrain' },
    { att: 'Pikachu', move: 'Rising Voltage', def: 'Snorlax' });

/* --- STAGE 1b: THE FIELD TERRAINS, which the terrain CONDITION owns, not the move --- */
row('terrain', 'electric terrain x[5325/4096] on Electric', with_(P, { terrain: 'electricterrain' }), P);
row('terrain', 'psychic terrain x[5325/4096] on Psychic',
    { att: 'Hatterene', move: 'Psychic', def: 'Snorlax', terrain: 'psychicterrain' },
    { att: 'Hatterene', move: 'Psychic', def: 'Snorlax' });
row('terrain', 'grassy terrain x0.5 on Earthquake',
    { att: 'Garchomp', move: 'Earthquake', def: 'Snorlax', terrain: 'grassyterrain' },
    { att: 'Garchomp', move: 'Earthquake', def: 'Snorlax' });
row('terrain', 'grassy terrain x[5325/4096] on a Grass move',
    { att: 'Meowscarada', move: 'Energy Ball', def: 'Snorlax', terrain: 'grassyterrain' },
    { att: 'Meowscarada', move: 'Energy Ball', def: 'Snorlax' });
row('terrain', 'misty terrain x0.5 on Dragon',
    { att: 'Garchomp', move: 'Dragon Claw', def: 'Snorlax', terrain: 'mistyterrain' },
    { att: 'Garchomp', move: 'Dragon Claw', def: 'Snorlax' });

/* --- STAGE 2: THE STAT CHAIN --- */
row('stat', 'thick fat (onSourceModifyAtk)', with_(C, { defAb: 'Thick Fat' }), C);
row('stat', 'heatproof (onSourceModifyAtk)', with_(C, { defAb: 'Heatproof' }), C);
row('stat', 'purifying salt (onSourceModifySpA)',
    { att: 'Gengar', move: 'Shadow Ball', def: 'Gardevoir', defAb: 'Purifying Salt' },
    { att: 'Gengar', move: 'Shadow Ball', def: 'Gardevoir' });
row('stat', 'water bubble, attacking (onModifyAtk)',
    { att: 'Araquanid', move: 'Surf', def: 'Snorlax', attAb: 'Water Bubble' },
    { att: 'Araquanid', move: 'Surf', def: 'Snorlax' });
row('stat', 'water bubble, defending (onSourceModifyAtk)',
    { att: 'Charizard', move: 'Flamethrower', def: 'Araquanid', defAb: 'Water Bubble' },
    { att: 'Charizard', move: 'Flamethrower', def: 'Araquanid' });
row('stat', 'steelworker (damageBoost, narrowed)',
    { att: 'Kingambit', move: 'Iron Head', def: 'Snorlax', attAb: 'Steelworker' },
    { att: 'Kingambit', move: 'Iron Head', def: 'Snorlax' });
row('stat', 'transistor (damageBoost, [5325/4096])', with_(P, { attAb: 'Transistor' }), P);
row('stat', 'sword of ruin', with_(K, { attAb: 'Sword of Ruin' }), K);
row('stat', 'beads of ruin', with_(A, { attAb: 'Beads of Ruin' }), A);
row('stat', 'guts on a burnt body',
    { att: 'Machamp', move: 'Facade', def: 'Snorlax', attAb: 'Guts', burn: true },
    { att: 'Machamp', move: 'Facade', def: 'Snorlax', burn: true });

/* --- STAGE 3: THE FINAL ModifyDamage CHAIN --- */
row('modifyDamage', 'life orb [5324/4096]', with_(K, { attItem: 'Life Orb' }), K);
row('modifyDamage', 'friend guard', with_(A, { friendGuard: true }), A);
row('modifyDamage', 'expert belt on a super-effective hit',
    { att: 'Gallade', move: 'Drain Punch', def: 'Tyranitar', attItem: 'Expert Belt' },
    { att: 'Gallade', move: 'Drain Punch', def: 'Tyranitar' });

/* --- STAGE 4: THE CRIT, WHICH IS NOT A MODIFIER AT ALL. Every row above already runs both crit
 *     states; these are the ones where the crit interacts with something else. --- */
row('crit', 'crit + life orb', with_(K, { attItem: 'Life Orb' }), K);
row('crit', 'sniper (onModifyDamage, only on a crit)',
    { att: 'Kingambit', move: 'Night Slash', def: 'Snorlax', attAb: 'Sniper' },
    { att: 'Kingambit', move: 'Night Slash', def: 'Snorlax' }, true);

/* --- STAGE 5: SPREAD AND WEATHER, which the audit cleared. Kept so a regression is visible. --- */
row('spread', 'spread x0.75', with_(K, { spread: true }), K);
row('weather', 'sun on a Fire move', with_(C, { weather: 'sunnyday' }), C);
row('weather', 'rain on a Fire move', with_(C, { weather: 'raindance' }), C);

/* --- THE CHAIN ROWS. These are the ones a stage-only fix fails. --- */
row('CHAIN', 'iron fist + muscle band (two basePower members)',
    with_(G, { attAb: 'Iron Fist', attItem: 'Muscle Band' }), with_(G, { attAb: 'Iron Fist' }));
row('CHAIN', 'tough claws + black glasses (two basePower members)',
    with_(K, { attAb: 'Tough Claws', attItem: 'Black Glasses' }), with_(K, { attAb: 'Tough Claws' }));
row('CHAIN', 'helping hand + type item (two basePower members)',
    with_(K, { helpingHand: true, attItem: 'Black Glasses' }), with_(K, { helpingHand: true }));
row('CHAIN', 'supreme overlord + muscle band (two basePower members)',
    with_(K, { attAb: 'Supreme Overlord', fallen: 3, attItem: 'Muscle Band' }),
    with_(K, { attAb: 'Supreme Overlord', fallen: 3 }));
row('CHAIN', 'electric terrain + wise glasses (two basePower members)',
    with_(P, { terrain: 'electricterrain', attItem: 'Wise Glasses' }), with_(P, { terrain: 'electricterrain' }));
/* BEADS OF RUIN, NOT SWORD OF RUIN. Flamethrower is SPECIAL and Sword of Ruin lowers the physical
 * Defence, so that pairing left the knob dead — the gate caught it, which is the check working. */
row('CHAIN', 'thick fat + beads of ruin (two stat members)',
    with_(C, { defAb: 'Thick Fat', attAb: 'Beads of Ruin' }), with_(C, { defAb: 'Thick Fat' }));
row('CHAIN', 'life orb + friend guard (two ModifyDamage members)',
    with_(A, { attItem: 'Life Orb', friendGuard: true }), with_(A, { attItem: 'Life Orb' }));
row('CHAIN', 'sniper + life orb on a crit (two ModifyDamage members)',
    { att: 'Kingambit', move: 'Night Slash', def: 'Snorlax', attAb: 'Sniper', attItem: 'Life Orb' },
    { att: 'Kingambit', move: 'Night Slash', def: 'Snorlax', attItem: 'Life Orb' }, true);
row('CHAIN', 'a member at EVERY stage at once',
    with_(K, { attAb: 'Tough Claws', attItem: 'Life Orb', helpingHand: true, friendGuard: true }),
    with_(K, { attAb: 'Tough Claws' }));

/* ---------------------------------------------------------------------------------------------
 * THE SECOND HALF OF THE GATE: the engine's hand-written exact-4096ths table, checked against the
 * dex it claims to be quoting. `CH_EXACT` exists because the tag artifact stores 1.3 as a float and
 * the authority spells that ratio TWO ways — `[5324,4096]` for Life Orb and `[5325,4096]` for Tough
 * Claws — so nothing recovers the difference from the number itself. A hand list is exactly what
 * this repo keeps getting burned by, so it is re-derived from the live handler source every run.
 * ------------------------------------------------------------------------------------------- */
let tableBad = 0;
function checkExactTable() {
  const claimed = MEDI.CH_EXACT;
  if (!claimed) { tableBad++; failures.push('CH_EXACT is not exported — the table cannot be checked'); return; }
  for (const id of Object.keys(claimed)) {
    const ab = dex.abilities.get(id);
    if (!ab.exists) { tableBad++; failures.push(`CH_EXACT names ${id}, which is not an ability in this format`); continue; }
    const src = Object.keys(ab).filter(k => /^on/.test(k) && typeof ab[k] === 'function')
                              .map(k => String(ab[k])).join(' ');
    const m = src.match(/chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
    if (!m) { tableBad++; failures.push(`CH_EXACT names ${id}, whose handler has no literal chainModify([n,d]) — it does not need an override`); continue; }
    const want = [Number(m[1]), Number(m[2])], got = claimed[id];
    if (want[0] !== got[0] || want[1] !== got[1]) {
      tableBad++;
      failures.push(`CH_EXACT[${id}] says [${got}] and data/abilities.ts says [${want}]`);
    }
  }
}
checkExactTable();

/* AND THE MEMBERSHIP OF THE NARROWED `damageBoost` SHAPE, PRINTED BEFORE ANYONE TRUSTS IT.
 * docs/LESSONS.md 4: a new derived tag over-matches, and printing what it matched is the only thing
 * that has ever caught it. The shape the engine reads is "a multiplier, a type, no weather, an
 * EVALUABLE condition or none, and no other tag on the ability"; this recomputes that set from the
 * artifact and then asks the DEX whether each member really is a stat-stage handler, which the tag
 * cannot say.
 *
 * ROADMAP #112 CHANGED THE FOURTH CLAUSE AND THIS LINE HAD TO CHANGE WITH IT. It read
 * `|| p.onlyWhen`, matching the engine's old `!_db.onlyWhen`. `onlyWhen` is now a STRUCTURE the
 * engine can evaluate, so the set grew from five to nine and this instrument would otherwise have
 * kept printing five — an instrument silently describing a smaller engine than the one that runs,
 * which is the same shape as the fourteen stale handoffs. The clause mirrors `condHolds`: a
 * condition is admitted when it is absent OR readable, and refused when it is neither. */
const TAGS = require(D('engine', 'tags.js'));
const tagDB = require(D('data', 'tags.json'));
const readableCond = (w) => w == null
  || (typeof w === 'object' && w.cond === 'hpFraction' && w.of === 'self'
      && Number.isInteger(w.num) && Number.isInteger(w.den) && w.den > 0
      && (w.cmp === '<=' || w.cmp === '>='));
const dbMembers = [];
for (const id of Object.keys(tagDB.abilities || {})) {
  const rec = tagDB.abilities[id];
  if (!rec.tags || !rec.tags.includes('damageBoost') || rec.tags.length !== 1) continue;
  const p = (rec.params || {}).damageBoost || {};
  if (!p.mult || !p.onType || p.inWeather || !readableCond(p.onlyWhen)) continue;
  dbMembers.push(id);
}
let dbBad = 0;
for (const id of dbMembers) {
  const ab = dex.abilities.get(id);
  const evs = ab.exists ? Object.keys(ab).filter(k => /^on/.test(k) && typeof ab[k] === 'function') : [];
  const stat = evs.some(e => /^onModify(Atk|SpA)$/.test(e));
  if (!stat) { dbBad++; failures.push(`damageBoost shape admits ${id}, whose handlers are ${evs.join('/')} — NOT the stat stage the engine applies it at`); }
}

/* ------------------------------------------------------------------------------------------- */
console.log('DAMAGE STAGE GATE — exact equality against the authority, all 16 rolls, both crit states');
console.log(`  simulator: ${process.env.SHOWDOWN_PATH}`);
console.log(`  ${compared - disagreed}/${compared} exact` + (flat ? `, ${flat} row(s) had a knob that does not move` : '') +
            (threw ? `, ${threw} threw` : ''));
console.log(`  CH_EXACT: ${Object.keys(MEDI.CH_EXACT || {}).length} override(s), re-derived from the live dex, ${tableBad} wrong`);
console.log(`  narrowed damageBoost shape matches ${dbMembers.length}: ${dbMembers.join(', ') || '(none)'} — ${dbBad} at the wrong stage`);
if (failures.length) {
  console.log('\n  FAILURES:');
  for (const f of failures) console.log('    ' + f);
}
const bad = disagreed + flat + threw + tableBad + dbBad;
if (bad) {
  console.log(`\nFAIL — ${bad} problem(s). Every one is a stage, a chain or a knob, not a rounding choice.`);
  process.exitCode = 1;
} else {
  console.log('\nPASS');
}
