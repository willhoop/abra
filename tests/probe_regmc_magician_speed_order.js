#!/usr/bin/env node
/* tests/probe_regmc_magician_speed_order.js — MAGICIAN TAKES FROM THE FIRST HIT TARGET IN THE AUTHORITY'S `speedSort`,
 * WHICH TRICK ROOM REVERSES, UNDER REG M-C. 2026-09-22 (abra/regmc 0.50.0).
 *
 *   node tests/probe_regmc_magician_speed_order.js --regulation regmc                                     # green, exit 0
 *   MEDI_MAGICIAN_LIVE_SPEED_ORDER=1 node tests/probe_regmc_magician_speed_order.js --regulation regmc      # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts magician :2477-2500 (no Champions override):
 *       const hitTargets = move.hitTargets; this.speedSort(hitTargets);
 *       for (const pokemon of hitTargets) { if (pokemon !== source) { const yourItem = pokemon.takeItem(source);
 *           if (!yourItem) continue; ... this.add('-item', source, yourItem, '[from] ability: Magician', `[of] ${pokemon}`); return; } }
 *   `speedSort` with no comparator is `comparePriority`, which reads the CACHED `pokemon.speed` -- written by
 *   `updateSpeed()` (sim/pokemon.ts:556-558) as `getActionSpeed()`, and the Champions `getActionSpeed`
 *   (data/mods/champions/scripts.ts:46-54) is `-speed` under Trick Room. So under Trick Room the SLOWER target's item goes.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   ROOM      turn 1 the Magician user sets Trick Room; turn 2 its spread move hits two item-holding foes of different
 *             Speed: the slower foe's item is taken.
 *   OPEN      turn 1 the user Protects instead: the faster foe's item is taken (the control; unchanged by the fix).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_magician_speed_order', ['MEDI_MAGICIAN_LIVE_SPEED_ORDER']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P, legal } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const THIEF_AB = Object.keys(TAGS.abilities).filter(a => { const p = (TAGS.abilities[a].params || {}).stealsItem; return p && p.takesFrom === 'target'; });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     stealsItem {takesFrom: target}: ' + (THIEF_AB.join(', ') || '(none)'));
const AB = THIEF_AB[0];
if (!AB) { ok(false, 'a takesFrom:target thief ability exists'); K.finish(); }
const HOLDERS = SPEC.filter(s => Object.values(s.abilities).map(a => D.abilities.get(a).id).includes(AB) && learns(s, 'trickroom') && learns(s, 'protect'));
console.log('     holders that learn Trick Room and Protect: ' + show(HOLDERS));
/* items with no handler of their own: nothing but the theft can write a line about them */
const INERT = D.items.all().filter(i => legal(i) && !i.isBerry && !i.megaStone
  && !Object.keys(i).some(k => /^on[A-Z]/.test(k) && typeof i[k] === 'function')).map(i => i.name).sort();
console.log('     inert items: ' + INERT.join(', '));
const SPREAD = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.target === 'allAdjacentFoes' && K.sure(m)
  && !m.secondary && !m.secondaries && !m.self && !m.recoil && !m.drain && !m.priority && !m.onHit && !m.onAfterHit
  && !m.basePowerCallback && !m.onBasePower && !m.onModifyMove && !m.onTry && !m.flags.charge).sort((a, b) => a.basePower - b.basePower);
const KEEP = /^\|(-item|-enditem|-damage|-fieldstart)\|/;
const OWN = /^\|-item\|/;
const counters = () => ({ stolen: K.M.MEDSEEN.itemStolenByAbility || 0, cached: K.M.MEDSEEN.magicianSpeedSortCached || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let RM = null, OP = null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
outer: for (const h of HOLDERS) {
  const mv = SPREAD.find(m => learns(h, m.id));
  if (!mv) continue;
  const foes = FILL.filter(s => s.baseSpecies !== h.baseSpecies && D.getImmunity(mv.type, s) && D.getEffectiveness(mv.type, s) <= 0 && K.idle(s));
  for (let i = 0; i < foes.length; i++) for (let j = i + 1; j < Math.min(foes.length, 16); j++) {
    const fast = foes[i].baseStats.spe >= foes[j].baseStats.spe ? foes[i] : foes[j];
    const slow = fast === foes[i] ? foes[j] : foes[i];
    if (fast.baseStats.spe - slow.baseStats.spe < 30 || fast.baseSpecies === slow.baseSpecies) continue;
    const used = new Set([h.baseSpecies, h.id, fast.baseSpecies, fast.id, slow.baseSpecies, slow.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
    if (fills.length < 3) continue;
    const A = [mon(h, '', [mv.name, 'Trick Room', 'Protect'], AB), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const fi = K.idle(fast), si = K.idle(slow);
    const B = [mon(fast, INERT[0], ['Protect', fi.name]), mon(slow, INERT[1], ['Protect', si.name]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const t1 = first => ({ p1: [{ m: first }, P.protect], p2: [P.protect, P.protect] });
    const t2 = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: fi.id }, { m: si.id }] };
    const r = play('room', A, B, [t1('trickroom'), t2]);
    if (!r.staged) { console.log('   (skip ' + h.id + '/' + fast.id + '/' + slow.id + ': ' + r.why + ')'); continue; }
    const o = play('open', A, B, [t1('protect'), t2]);
    if (!o.staged) { console.log('   (skip open ' + o.why + ')'); continue; }
    r.cast = h.id + ' (' + AB + ') Trick Room t1, ' + mv.id + ' t2 into ' + fast.id + ' @' + INERT[0] + ' (spe ' + fast.baseStats.spe + ') and '
      + slow.id + ' @' + INERT[1] + ' (spe ' + slow.baseStats.spe + ')';
    o.cast = 'the same with Protect on t1 (no Trick Room)';
    r.slowItem = INERT[1]; r.fastItem = INERT[0];
    RM = r; OP = o; break outer;
  }
}
const RUNS = [['ROOM', RM], ['OPEN', OP]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const took = (R, item) => R.sdK.some(l => l.startsWith('|-item|p1a') && l.includes('|' + K.canon(item) + '|'));
ok(took(RM, RM.slowItem) && !took(RM, RM.fastItem), 'ROOM — under Trick Room the SLOWER foe\'s ' + RM.slowItem + ' is taken');
ok(took(OP, RM.fastItem) && !took(OP, RM.slowItem), 'OPEN — without it the FASTER foe\'s ' + RM.fastItem + ' is taken');

K.compareArms(RUNS, OWN, '-item');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(RM.counters.stolen === 1 && OP.counters.stolen === 1 && RM.counters.cached >= 1 && OP.counters.cached >= 1,
    'one theft in each arm, each ordered on the cached action speed', JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
