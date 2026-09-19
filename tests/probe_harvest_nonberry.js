/* probe_harvest_nonberry.js — HARVEST MAY ONLY GIVE BACK A BERRY. Found while checking ROADMAP #80's
 * consumers (tests/probe_knockoff_berry_consumers.js).
 *
 *   SHOWDOWN_PATH=... node tests/probe_harvest_nonberry.js                 # expect GREEN
 *   MEDI_HARVEST_GATES_ON_ATEBERRY=1 SHOWDOWN_PATH=... node tests/...      # the old gate: expect RED
 *
 * THE AUTHORITY (data/abilities.ts `harvest`, not overridden in data/mods/champions/abilities.ts):
 *
 *     if (pokemon.hp && !pokemon.item && this.dex.items.get(pokemon.lastItem).isBerry) {
 *
 * It asks whether the LAST ITEM is a berry. medicham2 asked `m._lastItem && m._ateBerry` — whether
 * the body has EVER eaten a berry. `ateBerry` is never cleared (sim/pokemon.ts writes it at :1809 and
 * resets it only at :429, the constructor-side reset), so once a body has eaten one, ANY later spent
 * item satisfied the old gate. `useItem` writes `lastItem` for a non-berry (sim/pokemon.ts:1846), and
 * White Herb is one (data/items.ts `whiteherb` onUpdate -> `pokemon.useItem()`).
 *
 * THE STAGING (every body, item and move derived from the format, none typed):
 *   T1  the Knock Off attacker hits the Harvest carrier, which holds the Dark-resist berry. The berry
 *       is EATEN inside the calc (ateBerry = true); a Drought partner's sun makes Harvest certain, so
 *       it comes straight back at the residual (lastItem = '').
 *   T2  the carrier Tricks that berry onto the attacker and receives the attacker's White Herb.
 *   T3  the attacker lowers one of the carrier's stats; White Herb is USED (lastItem = whiteherb,
 *       slot empty). At the residual Harvest asks its question — with ateBerry still true.
 * Read: the carrier's item after turn 3. The authority must read EMPTY (a White Herb is not a berry).
 *
 * THE CONTROL, and why the probe can see the defect: turn 1's restore is the SAME Harvest on the SAME
 * body in the SAME sun, answering yes for a berry. So Harvest demonstrably fires in this fixture; the
 * turn-3 arm differs only in what `lastItem` holds.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));

const legal = x => x && x.exists && !x.isNonstandard;
const sp = n => dex.species.get(n);
const nonMega = n => !sp(n).isMega && legal(sp(n));
const KO = dex.moves.get('knockoff');
const TRICK = dex.moves.get('trick');
const HERB = dex.items.get('whiteherb');
const BERRY = dex.items.all().filter(legal)
  .find(i => i.isBerry && i.onSourceModifyDamage && i.naturalGift && i.naturalGift.type === KO.type);
if (!legal(KO) || !legal(TRICK) || !legal(HERB) || HERB.isBerry || !BERRY) { console.log('FIXTURE — an entity is not legal'); process.exit(1); }

const setsWeather = a => /setWeather/.test(String(dex.abilities.get(a).onStart || ''));
const hitsSE = n => dex.getImmunity(KO.type, sp(n).types) && dex.getEffectiveness(KO.type, sp(n).types) > 0;
const CARRIER = CS.abilityCarriers('Harvest').filter(nonMega).find(n => hitsSE(n) && CS.canLearn(n, TRICK.name));
const ATTACKER = CS.moveCarriers(KO.name).filter(nonMega)
  .find(n => sp(n).types.includes(KO.type) && !setsWeather(sp(n).abilities[0]));
const SUN = CS.abilityCarriers('Drought').filter(nonMega)[0];
if (!CARRIER || !ATTACKER || !SUN) { console.log('FIXTURE — no carrier/attacker/sun body'); process.exit(1); }

const BOOSTERS = dex.moves.all().filter(legal).filter(m => m.category === 'Status' && m.target === 'self'
  && m.boosts && !m.stallingMove && !m.heal && !m.onHit && !m.self && !m.volatileStatus && !m.selfSwitch
  && !m.sideCondition && !m.condition && !m.onTryHit && !m.onTry);
const idleFor = n => { const m = BOOSTERS.find(x => CS.canLearn(n, x.name)); return m && m.name; };
const carrierIdle = idleFor(CARRIER), attackerIdle = idleFor(ATTACKER);
const raised = new Set(Object.keys(dex.moves.get(carrierIdle).boosts || {}));
/* a single-target status move whose only effect is to LOWER a stat the carrier's idle move never raised.
 * The Knock Off attacker learns none, so the drop comes from the attacker's PARTNER (p1b) — the first
 * legal non-weather body that learns one. */
const DROPS = dex.moves.all().filter(legal).filter(m => m.category === 'Status' && m.target === 'normal'
  && m.boosts && Object.values(m.boosts).every(v => v < 0) && Object.keys(m.boosts).every(k => !raised.has(k))
  && !m.onHit && !m.volatileStatus && !m.flags.sound);
let DROPPER = null, DROP = null;
for (const n of CS.moveCarriers('Protect').filter(nonMega)) {
  if (n === ATTACKER || n === CARRIER || n === SUN || setsWeather(sp(n).abilities[0])) continue;
  const m = DROPS.find(x => CS.canLearn(n, x.name));
  if (m) { DROPPER = n; DROP = m; break; }
}
if (!carrierIdle || !attackerIdle || !DROP) { console.log('FIXTURE — no idle or drop move'); process.exit(1); }

console.log('\n  FIXTURE (derived from ' + CS.FORMAT + ')');
console.log('    carrier  ' + CARRIER + ' (Harvest) holding ' + BERRY.name + '; moves ' + [TRICK.name, carrierIdle].join(', '));
console.log('    attacker ' + ATTACKER + ' holding ' + HERB.name + '; moves ' + [KO.name, attackerIdle].join(', '));
console.log('    dropper  ' + DROPPER + ' (p1b) with ' + DROP.name);
console.log('    sun      ' + SUN + ' (Drought)   knob MEDI_HARVEST_GATES_ON_ATEBERRY=' + (process.env.MEDI_HARVEST_GATES_ON_ATEBERRY || '0'));

const fill = ex => CS.moveCarriers('Protect').filter(nonMega)
  .filter(n => !ex.includes(n) && !CS.abilityCarriers('Drought').includes(n)).slice(0, 3)
  .map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }));
const A = [{ species: ATTACKER, item: HERB.name, ability: sp(ATTACKER).abilities[0], moves: [KO.name, attackerIdle, 'Protect'] },
           { species: DROPPER, item: '', ability: sp(DROPPER).abilities[0], moves: [DROP.name, 'Protect'] }]
  .concat(fill([ATTACKER, CARRIER, SUN, DROPPER])).slice(0, 4);
const B = [{ species: CARRIER, item: BERRY.name, ability: 'Harvest', moves: [TRICK.name, carrierIdle, 'Protect'] },
           { species: SUN, item: '', ability: 'Drought', moves: ['Protect'] }].concat(fill([ATTACKER, CARRIER, SUN, DROPPER])).slice(0, 4);
const a = G.buildPair(A, { hpBoost: 8 }), b = G.buildPair(B, { hpBoost: 8 });
if (!a || !b) { console.log('FIXTURE — could not build'); process.exit(1); }

const PR = { m: 'protect' };
const script = [
  { p1: [{ m: 'knockoff', t: 0 }, PR], p2: [{ m: N.id(carrierIdle) }, PR] },
  { p1: [{ m: N.id(attackerIdle) }, PR], p2: [{ m: 'trick', t: 0 }, PR] },
  { p1: [{ m: N.id(attackerIdle) }, { m: N.id(DROP.name), t: 0 }], p2: [{ m: N.id(carrierIdle) }, PR] },
  { p1: [PR, PR], p2: [PR, PR] },
];
const rows = [];
let sdBattle = null;
const r = G.playGame(a, b, 'directed', 'harvest-nonberry', { script,
  onBoundary: (snap, turnIdx, S, battle) => {
    sdBattle = battle;
    const mB = (S.actB || [])[0], sB = battle.sides[1].active[0];
    if (!mB || !sB) return;
    rows.push({ b: turnIdx,
      medi: (N.id(mB.item || mB._roomItem || '') || '-') + ' last=' + (N.id(mB._lastItem || '') || '-') + (mB._ateBerry ? ' ate' : ''),
      sd: (N.id(sB.item || '') || '-') + ' last=' + (N.id(sB.lastItem || '') || '-') + (sB.ateBerry ? ' ate' : '') });
  } });
console.log('\n  boundary   medicham2 (item / lastItem / ateBerry)      showdown');
for (const x of rows) console.log('  ' + String(x.b).padEnd(10) + x.medi.padEnd(40) + x.sd);
if (r.err) console.log('  [game threw: ' + r.err + ']');

const at = k => rows.find(x => x.b === k);
const item = s => s.split(' ')[0];
const t1 = at(1), t3 = at(3);
const herbUsed = /whiteherb/.test(t3 ? t3.sd : '') && /last=whiteherb/.test(t3.sd);
const control = t1 && item(t1.sd) === N.id(BERRY.name) && item(t1.medi) === N.id(BERRY.name);
const verdict = !t3 ? 'NO BOUNDARY 3'
  : !control ? 'UNREADABLE — Harvest did not restore the berry on turn 1 in both engines, so the fixture cannot show it'
  : !herbUsed ? 'UNREADABLE — the authority never spent the White Herb, so turn 3 asks nothing'
  : item(t3.medi) === item(t3.sd) ? 'GREEN — both engines leave the slot ' + item(t3.sd)
  : 'RED — medicham2 holds ' + item(t3.medi) + ' where the authority holds ' + item(t3.sd);
const harvestLines = log => (log || []).map(String).filter(l => /\|-item\|[^|]*\|[^|]*\|\[from\] ability: ?harvest/i.test(l)).length;
console.log('\n  Harvest restore lines   medicham2 ' + harvestLines(r.mediTrace) + '   showdown ' + harvestLines(sdBattle && sdBattle.log));
console.log('  ' + verdict + '\n');
process.exit(/^GREEN/.test(verdict) ? 0 : 1);
