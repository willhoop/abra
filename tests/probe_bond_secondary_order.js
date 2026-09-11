#!/usr/bin/env node
/* tests/probe_bond_secondary_order.js — A PARENTAL BOND VOLLEY ROLLS ITS SECONDARY ON EVERY ARRIVAL.
 *   node tests/probe_bond_secondary_order.js
 *   MEDI_BOND_SECONDARY_ONCE=1 node tests/probe_bond_secondary_order.js     (the red, once a fix lands)
 * ==================================================================================================
 *
 * WHERE IT CAME FROM. `engine/all_mechanics_fire.js`'s board-only arm, `abilities:parentalbond`, release
 * `2b5a6585d8cf` (docs/_reports/2026-09-11-harness-batches.md §1): Kangaskhan-Mega's Body Slam into
 * Feraligatr under `bottom-tie-first`, where every secondary fires. The authority writes
 * `|-status|p2a|par` after arrival 1; medicham2 writes arrival 2's `|-crit|` first.
 *
 * THE AUTHORITY. Parental Bond's `onPrepareHit` writes `move.multihit = 2` (data/abilities.ts:3160-3166,
 * no Champions override), and the Champions hit loop (data/mods/champions/scripts.ts, the loop at :428)
 * runs `spreadMoveHit` ONCE PER HIT, whose step 5 is `secondaries` (:388). So the secondary is ROLLED per
 * arrival and lands BETWEEN them. medicham2 wraps the step list once per MOVE, so its `_stepEffects`
 * (the secondaries) runs once, below the whole volley — the per-hit wrap `tests/test-resolution-order.js`
 * carries as a KNOWN-OPEN arm (ROADMAP #500).
 *
 * TWO CONSEQUENCES, AND ONLY THE FIRST WAS SEEN.
 *   ORDER  a status secondary lands after arrival 1 and before arrival 2 (narration).
 *   COUNT  a STAT-DROP secondary is rolled twice, so at a corner where every secondary fires the target
 *          takes the drop twice — and arrival 2 is priced against the dropped stat. BOARD-MATERIAL.
 *
 * THE ARMS (each a real game through game_differential's `playGame`, the `bottom-tie-first` pin):
 *   ORDER  Kangaskhan-Mega clicks the single-target move with a status secondary. Compared: the ORDER of
 *          `-damage` / `-status` / `-crit` lines between the move line and the next move line.
 *   COUNT  Kangaskhan-Mega clicks the single-target move with a target stat-drop secondary. Compared: the
 *          target's stat stages after the turn, and its HP.
 *   CTRL   the SAME Kangaskhan WITHOUT the stone clicks the ORDER move: one arrival, one roll, and both
 *          engines must agree — so a parting above is the volley and nothing about the fixture.
 * Every move is DERIVED from the carrier's validated learnset; nothing is typed but the carrier, which is
 * asserted to be the format's only `hitsTwice` holder.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
const KNOB = process.env.MEDI_BOND_SECONDARY_ONCE === '1';
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) throw new Error('the bottom-tie-first arm is gone from game_differential.js');
const TAGS = require(D('data', 'tags.json'));

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE CARRIER. `hitsTwice` membership off data/tags.json, and the one mega that carries it. */
const HT = Object.keys(TAGS.abilities || {}).filter(a => (TAGS.abilities[a].tags || []).includes('hitsTwice'));
const MEGA = dex.species.all().filter(legal).filter(s => s.isMega && Object.values(s.abilities).some(a => HT.includes(idOf(a))));
console.log('  hitsTwice abilities: ' + HT.join(', ') + '   legal carriers: ' + MEGA.map(s => s.name).join(', '));
if (MEGA.length !== 1) { console.log('NOT RUN — expected exactly one legal hitsTwice carrier. A claim about the format.'); process.exit(2); }
const MSP = MEGA[0], BASE = dex.species.get(MSP.baseSpecies);
const STONE = [].concat(MSP.requiredItem || [], MSP.requiredItems || [])[0];
const BASE_AB = Object.values(BASE.abilities)[0];

const single = m => legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.multihit && !m.flags.charge
  && !m.flags.futuremove && !m.flags.noparentalbond && (m.accuracy === true || m.accuracy === 100) && !m.recoil
  && !m.drain && !m.self && !m.selfSwitch && m.priority === 0 && CS.canLearn(BASE.name, m.id);
const pool = Object.keys((dex.species.getLearnsetData(BASE.id) || {}).learnset || {}).map(id => dex.moves.get(id)).filter(single)
  .sort((a, b) => a.id.localeCompare(b.id));
/* ONE SECONDARY, READ OFF `secondaries` — the dex fills that array from `secondary` on every move, so the
 * first cut's `!m.secondaries` refused every candidate and printed `undefined`. */
const oneSec = m => Array.isArray(m.secondaries) && m.secondaries.length === 1 ? m.secondaries[0] : null;
const ORDER_MV = pool.find(m => { const s = oneSec(m); return s && s.status && !s.volatileStatus && !s.boosts && !s.self; });
const COUNT_MV = pool.find(m => { const s = oneSec(m); return s && s.boosts && !s.status && !s.self && !s.volatileStatus
  && Object.values(s.boosts).every(v => v < 0); });
console.log('  carrier ' + BASE.name + ' + ' + STONE + ' -> ' + MSP.name + '   ORDER move ' + (ORDER_MV && ORDER_MV.id)
  + ' ' + JSON.stringify(ORDER_MV && ORDER_MV.secondary) + '   COUNT move ' + (COUNT_MV && COUNT_MV.id) + ' '
  + JSON.stringify(COUNT_MV && COUNT_MV.secondary));
if (!ORDER_MV || !COUNT_MV) { console.log('NOT RUN — no derived move for an arm. A claim about the fixture.'); process.exit(2); }

/* THE TARGET: a bulky legal body the status and the drop can both reach, with an ability that touches
 * neither (refused by its tags). It clicks Protect-free idles so every click lands. */
const inertAb = s => { const t = ((TAGS.abilities || {})[idOf(Object.values(s.abilities)[0])] || {}).tags || [];
  return !t.some(x => /Stat|Boost|immun|absorb|redirect|refus|prevent|reflect|punish|contact|Contact|secondar|Secondar/.test(x)); };
const TGT = dex.species.all().filter(legal).filter(s => !s.isMega && !s.battleOnly && !s.requiredItem && inertAb(s)
  && dex.getImmunity(ORDER_MV.type, s) && dex.getImmunity(COUNT_MV.type, s)
  && dex.getImmunity(ORDER_MV.secondary.status, s) && CS.canLearn(s.name, CS.INERT_MOVE))
  .sort((a, b) => (b.baseStats.hp * b.baseStats.def) - (a.baseStats.hp * a.baseStats.def))[0];
if (!TGT) { console.log('NOT RUN — no legal target for both arms. A claim about the fixture.'); process.exit(2); }
console.log('  target ' + TGT.name + ' (' + Object.values(TGT.abilities)[0] + ', idle ' + CS.INERT_MOVE + ')');

const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const CLEF = { species: 'clefable', item: '', ability: 'Unaware', moves: ['Protect'] };
const PROT = { m: 'protect' };
const IDLE = { m: idOf(CS.INERT_MOVE) };
const A = (stone, mv) => [{ species: BASE.id, item: stone ? STONE : '', ability: BASE_AB, moves: [dex.moves.get(mv).name, 'Protect'] }, CLEF];
const B = () => [{ species: TGT.id, item: '', ability: Object.values(TGT.abilities)[0], moves: [CS.INERT_MOVE] }, CLEF];

/* THE USER'S OWN `self:` DROP (step 4, `selfDrops`, above the secondaries in the same per-hit call). A
 * sub-100 accuracy is allowed here because the arm is pinned to the bottom corner, where every roll
 * hits. Measured, not reasoned: the arm reports what the authority does with a second arrival. */
const SELF_MV = Object.keys((dex.species.getLearnsetData(BASE.id) || {}).learnset || {}).map(id => dex.moves.get(id))
  .filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.multihit && !m.flags.charge
    && !m.flags.noparentalbond && m.self && m.self.boosts && !(m.secondaries || []).length && m.priority === 0
    && CS.canLearn(BASE.name, m.id)).sort((a, b) => a.id.localeCompare(b.id))[0] || null;
console.log('  SELF move ' + (SELF_MV ? SELF_MV.id + ' ' + JSON.stringify(SELF_MV.self) : '(none — the SELF arm is not staged)'));
const CASES = [
  { name: 'ORDER  ' + MSP.name + ' ' + ORDER_MV.name, bond: true, A: A(true, ORDER_MV.id), mv: ORDER_MV },
  { name: 'COUNT  ' + MSP.name + ' ' + COUNT_MV.name, bond: true, A: A(true, COUNT_MV.id), mv: COUNT_MV },
  { name: 'CTRL   ' + BASE.name + ' (no stone) ' + ORDER_MV.name, bond: false, A: A(false, ORDER_MV.id), mv: ORDER_MV },
].concat(SELF_MV ? [{ name: 'SELF   ' + MSP.name + ' ' + SELF_MV.name, bond: true, A: A(true, SELF_MV.id), mv: SELF_MV, self: true }] : []);
const userShape = seg => (seg || []).map(l => l.split('|')).filter(f => /^-(unboost|boost)$/.test(f[1]) && /^p1a/.test(f[2] || ''))
  .map(f => f[1] + ':' + f[3] + ':' + f[4]);
/* THE AUTHORITY'S LOG CARRIES EVERY HP LINE TWICE: `|split|p2` then the owner's exact copy then the
 * spectators' copy. The first cut counted both and read four arrivals on a two-hit volley. The marker and
 * the line after it are dropped, so one line is one event, as in medicham2's stream. */
const segOf = (lines, mvName) => {
  const L0 = lines.map(String), L = [];
  for (let k = 0; k < L0.length; k++) { if (L0[k].startsWith('|split|')) { k++; continue; } L.push(L0[k]); }
  const i = L.findIndex(l => l.startsWith('|move|p1a') && idOf(l.split('|')[3]) === idOf(mvName));
  if (i < 0) return null;
  const j = L.findIndex((l, k) => k > i && (l.startsWith('|move|') || l.startsWith('|upkeep')));
  return L.slice(i + 1, j < 0 ? L.length : j);
};
const shape = seg => (seg || []).map(l => l.split('|')).filter(f => /^-(damage|status|crit|unboost|boost|hitcount|supereffective|resisted)$/.test(f[1]) && /^p2a/.test(f[2] || ''))
  .map(f => f[1] + (f[1] === '-status' || f[1] === '-unboost' ? ':' + f[3] + (f[4] ? ':' + f[4] : '') : ''));

console.log(NL + (KNOB ? 'KNOB ARM — MEDI_BOND_SECONDARY_ONCE=1' : 'CLEAN ARM') + '   (arm ' + ARM.id + ')' + NL);
for (const c of CASES) {
  const a = G.buildPair(c.A.concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(B().concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const bp0 = SEEN.parentalBondPlanned | 0;
  const r = G.playGame(a, b, 'directed', 'probe_bond_secondary_order :: ' + c.name,
    { script: [{ p1: [{ m: c.mv.id, t: 0, mega: c.bond }, PROT], p2: [IDLE, PROT] }], arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdSeg = segOf(G.lastSdLog(), c.mv.name), meSeg = segOf(r.mediTrace || [], c.mv.name);
  const sdS = shape(sdSeg), meS = shape(meSeg);
  const planned = (SEEN.parentalBondPlanned | 0) - bp0;
  console.log(NL + c.name + '   parentalBondPlanned +' + planned);
  console.log('    showdown ' + JSON.stringify(sdS));
  console.log('    medicham ' + JSON.stringify(meS));
  claim((planned > 0) === c.bond, c.name + ' — the click ' + (c.bond ? 'TOOK' : 'did NOT take') + ' the Parental Bond plan', '+' + planned);
  claim(sdS.filter(x => x === '-damage').length === (c.bond ? 2 : 1),
    c.name + ' — FIXTURE: the authority landed ' + (c.bond ? 'two arrivals' : 'one arrival'), JSON.stringify(sdS));
  if (c.self) {
    const sdU = userShape(sdSeg), meU = userShape(meSeg);
    console.log('    showdown user ' + JSON.stringify(sdU) + NL + '    medicham user ' + JSON.stringify(meU));
    claim(sdU.length > 0, c.name + ' — FIXTURE: the authority dropped the user at least once', JSON.stringify(sdU));
    claim(JSON.stringify(sdU) === JSON.stringify(meU),
      c.name + ' — the two engines drop the USER the same number of times', 'showdown ' + JSON.stringify(sdU) + '  medicham ' + JSON.stringify(meU));
    continue;
  }
  /* AND THE SECONDARY REALLY LANDED IN THE AUTHORITY — a target immune to it would make both arms agree
   * by writing nothing at all. */
  const want = c.mv === ORDER_MV ? /^-status:/ : /^-unboost:/;
  claim(sdS.some(x => want.test(x)),
    c.name + ' — FIXTURE: the authority wrote the secondary on the target', JSON.stringify(sdS));
  claim(JSON.stringify(sdS) === JSON.stringify(meS),
    c.name + ' — the two engines write the SAME sequence of hit, crit, status and stat lines on the target',
    'showdown ' + JSON.stringify(sdS) + NL + '          medicham ' + JSON.stringify(meS));
}
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
