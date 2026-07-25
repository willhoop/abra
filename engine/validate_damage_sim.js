/* validate_damage_sim.js — the OFFICIAL Champions engine's damage vs @smogon/calc.
 *
 * WHY THIS EXISTS. ADR-001 migration step 3: "Run the existing 31-scenario damage golden master
 * against the simulator. If it disagrees with @smogon/calc, resolve that before going further."
 *
 * This is NOT a test of Showdown. Showdown is the authority. It is a test of OUR WIRING — that we
 * are driving the champions mod correctly. ADR-001 records four attempts to compare engines, and
 * three produced numbers that looked like findings and were not: one filled teams from the raw
 * learnset (so it measured the filler), and one silently fell through to uniform-random on 100% of
 * decisions while reporting itself as a prior sampler. Neither crashed. A mis-wired simulator is
 * indistinguishable from a working one unless something independent checks it, and @smogon/calc is
 * that independent thing.
 *
 * SCENARIOS ARE NOT DUPLICATED. They are imported from validate_damage.js (S1). A second copy would
 * be free to drift.
 *
 * STATS ARE ALIGNED, exactly as the MEDICHAM harness does it. Champions uses SP (stat = base+SP+20,
 * budget 66), @smogon/calc uses EVs/IVs/nature — so the two disagree on STATS before they ever
 * disagree on damage. Feeding both the same attack/defence/HP isolates the damage MATH, which is the
 * only thing this file is trying to check.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/validate_damage_sim.js
 */
'use strict';
const path = require('path');
const { SCENARIOS, MV, CALCMOVE } = require('./validate_damage.js');

let SC; try { SC = require('@smogon/calc'); }
catch (e) { console.error('need @smogon/calc: npm i @smogon/calc'); process.exit(2); }
const { calculate, Pokemon, Move, Field, Generations } = SC;
const gen = Generations.get(9);

const base = process.env.SHOWDOWN_PATH;
if (!base) { console.error('set SHOWDOWN_PATH to a BUILT pokemon-showdown master checkout'); process.exit(2); }
let Battle, Teams;
try {
  const dist = path.join(base, 'dist', 'sim');
  ({ Battle, Teams } = require(path.join(dist, 'index')));
} catch (e) {
  console.error(`could not load the simulator from ${base}: ${e.message}`);
  console.error('the champions mod is master-only: git clone, npm install, node build');
  process.exit(2);
}

const FORMAT = 'gen9championsvgc2026regmb';
/* Filler so both sides field a legal six and team preview can bring four. These never act — only
 * slot 1 of each side is ever asked for damage — but the format will not start without them. */
const FILLER = ['Sylveon', 'Kingambit', 'Whimsicott', 'Basculegion'];

function set(species, ability, item, moves) {
  return {
    name: species, species, item: item || '', ability: ability || '', moves,
    nature: 'Hardy',
    evs: { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50, gender: '',
  };
}

/* Weather ids the mod uses. `null` means "leave the field alone". */
const WEATHER_ID = { Rain: 'raindance', Sun: 'sunnyday', Sand: 'sandstorm', Snow: 'snowscape' };

function simDamage(sc, calcStats) {
  const [att, ab, item, , off, mvKey, def, , , weather, defAb, defItem] = sc;
  const moveName = CALCMOVE[mvKey];

  const teamA = [set(att, ab, item, [moveName]), ...FILLER.map(s => set(s, '', '', ['Tackle']))];
  const teamB = [set(def, defAb || '', defItem || '', ['Tackle']), ...FILLER.map(s => set(s, '', '', ['Tackle']))];

  const battle = new Battle({ formatid: FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') {
    battle.choose('p1', 'team 1234');
    battle.choose('p2', 'team 1234');
  }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  if (!src || !tgt) throw new Error('no active pokemon after team preview');

  /* ALIGN STATS to whatever calc computed. Without this the comparison measures the difference
   * between the SP system and the EV system, not the damage formula. */
  src.storedStats.atk = calcStats.atk;
  src.storedStats.spa = calcStats.spa;
  tgt.storedStats.def = calcStats.def;
  tgt.storedStats.spd = calcStats.spd;
  tgt.maxhp = calcStats.hp;
  tgt.hp = calcStats.hp;

  const wid = WEATHER_ID[weather];
  if (wid) { battle.field.weather = wid; battle.field.weatherState = { id: wid, duration: 5 }; }

  /* randomizer() is trunc(baseDamage * (100 - random(16)) / 100), so random(16)->15 is the 85% floor
   * and random(16)->0 the 100% ceiling.
   *
   * CAREFUL, this bit is a trap. A blanket `random = () => 0` also forces a CRITICAL HIT, because the
   * crit check is randomChance(1, 24) === random(24) === 0. The first version of this file did that
   * and produced a "maximum" 1.5x above the real one — 168-300 where calc said 168-200, and a minimum
   * ABOVE the maximum. Return a non-zero value for every call that is not the damage roll.
   *
   * Also take a FRESH active move per call: moveHitData (which caches the crit decision per target)
   * lives on the move object, so reusing it lets the first call's outcome leak into the second. */
  const orig = battle.random.bind(battle);
  const roll = (v) => (n) => (n === 16 ? v : 1);   // 1, never 0 => no forced crit

  battle.random = roll(15);
  const lo = battle.actions.getDamage(src, tgt, battle.dex.getActiveMove(moveName));
  battle.random = roll(0);
  const hi = battle.actions.getDamage(src, tgt, battle.dex.getActiveMove(moveName));
  battle.random = orig;

  /* Spread reduction is applied by moveHit in a real turn, NOT by getDamage. @smogon/calc applies it
   * because the Field says Doubles. Apply it here so the two are comparable, and only for moves that
   * actually hit more than one target. */
  const tgtKind = battle.dex.moves.get(moveName).target;
  const spreads = tgtKind === 'allAdjacent' || tgtKind === 'allAdjacentFoes';
  const f = spreads ? 0.75 : 1;
  const adj = v => (typeof v === 'number' ? Math.floor(v * f) : v);
  return { lo: adj(lo), hi: adj(hi), spread: spreads };
}

function run() {
  const rows = [], errs = [];
  for (const sc of SCENARIOS) {
    const [att, ab, item, nat, off, mvKey, def, dnat, devs, weather, defAb, defItem] = sc;
    const cat = MV[mvKey][2];
    const evA = off === 'atk' ? { atk: 252 } : { spa: 252 };
    const A = new Pokemon(gen, att, { level: 50, ability: ab, item: item || undefined, nature: nat, evs: evA });
    const D = new Pokemon(gen, def, { level: 50, nature: dnat, evs: devs, ability: defAb || undefined, item: defItem || undefined });
    const field = new Field({ gameType: 'Doubles', weather });

    let calcLo, calcHi;
    try { const r = calculate(gen, A, D, new Move(gen, CALCMOVE[mvKey]), field).range(); calcLo = r[0]; calcHi = r[1]; }
    catch (e) { rows.push({ sc: `${att} ${mvKey} -> ${def}`, err: 'calc: ' + e.message }); continue; }

    let s;
    try {
      s = simDamage(sc, { atk: A.stats.atk, spa: A.stats.spa, def: D.stats.def, spd: D.stats.spd, hp: D.stats.hp });
    } catch (e) { rows.push({ sc: `${att} ${mvKey} -> ${def}`, err: 'sim: ' + e.message }); continue; }

    const eLo = calcLo ? 100 * (s.lo - calcLo) / calcLo : 0;
    const eHi = calcHi ? 100 * (s.hi - calcHi) / calcHi : 0;
    errs.push(Math.abs(eLo), Math.abs(eHi));
    rows.push({
      sc: `${att} ${mvKey}${item ? ' @' + item : ''}${weather ? ' [' + weather + ']' : ''} -> ${def}`,
      calc: `${calcLo}-${calcHi}`, sim: `${s.lo}-${s.hi}`,
      dLo: eLo.toFixed(0) + '%', dHi: eHi.toFixed(0) + '%',
    });
  }

  const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  const within = (a, t) => (a.length ? 100 * a.filter(x => x <= t).length / a.length : 0);

  console.log('\nSCENARIO'.padEnd(52), 'CALC'.padEnd(12), 'OFFICIAL'.padEnd(12), 'dMIN', 'dMAX');
  console.log('-'.repeat(92));
  for (const r of rows) {
    if (r.err) { console.log(r.sc.padEnd(52), 'ERROR', r.err); continue; }
    console.log(r.sc.padEnd(52), r.calc.padEnd(12), r.sim.padEnd(12), r.dLo.padStart(5), r.dHi.padStart(5));
  }

  const errored = rows.filter(r => r.err).length;
  console.log('\n=== AGGREGATE (official Champions engine vs @smogon/calc, stats aligned) ===');
  console.log(`scenarios: ${rows.length - errored} compared, ${errored} errored | median abs err: ${med(errs).toFixed(1)}% | within 2%: ${within(errs, 2).toFixed(0)}% | within 5%: ${within(errs, 5).toFixed(0)}%`);
  if (errs.length) console.log(`worst: ${Math.max(...errs).toFixed(0)}%`);

  if (errored) { console.error(`\nFAIL: ${errored} scenario(s) could not be run — the wiring is wrong, not the engine.`); process.exit(1); }
  const w5 = within(errs, 5), worst = Math.max(...errs);
  if (w5 < 95 || worst > 8) {
    console.error(`\nFAIL: within-5% ${w5.toFixed(0)}% (need >=95), worst ${worst.toFixed(0)}% (need <=8).`);
    console.error('Showdown is the authority here, so a gap this size means WE are driving it wrong.');
    console.error('Resolve before building anything on the simulator (ADR-001 step 3).');
    process.exit(1);
  }
  console.log('PASS: the official engine agrees with @smogon/calc — the wiring is sound.');
}

module.exports = { simDamage };
if (require.main === module) run();
