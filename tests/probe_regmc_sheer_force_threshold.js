#!/usr/bin/env node
/* tests/probe_regmc_sheer_force_threshold.js — A HALF-HP BOOST (BERSERK) IS NOT RAISED BY A SHEER FORCE HIT, UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.44.0).
 *
 *   node tests/probe_regmc_sheer_force_threshold.js --regulation regmc                                  # green, exit 0
 *   MEDI_THRESHOLD_IGNORES_SHEER_FORCE=1 node tests/probe_regmc_sheer_force_threshold.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts berserk :414-444: the boost is `onAfterMoveSecondary` (from above half to at or below it).
 *   sim/battle-actions.ts afterMoveSecondaryEvent :811-818 runs the AfterMoveSecondary event only
 *       `if (!(move.hasSheerForce && pokemon.hasAbility('sheerforce')))`,
 *   and Sheer Force's onModifyMove sets `move.hasSheerForce` exactly when the move HAD secondaries to delete. So a Sheer
 *   Force attacker's move with a secondary cannot raise Berserk; the same attacker on another ability can. Both abilities
 *   are found by their TAGS (`boostsAtHPThreshold`, `removesOwnSecondaries`), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turn; SHOWDOWN IS THE ANSWER) ====
 *
 *   SHEER     a Sheer Force attacker's move with a secondary takes the holder from above half to at or below it: no boost.
 *   CONTROL   the same attacker, move and holder, the attacker on another ability: the boost.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_sheer_force_threshold', ['MEDI_THRESHOLD_IGNORES_SHEER_FORCE']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const THR = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].params || {}).boostsAtHPThreshold);
const SF = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].params || {}).removesOwnSecondaries);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     boostsAtHPThreshold: ' + THR.join(', ') + '   removesOwnSecondaries: ' + SF.join(', '));
const HOLDERS = SPEC.filter(s => abil(s).some(a => THR.includes(a)) && learns(s, 'protect'));
const ATTS = SPEC.filter(s => abil(s).some(a => SF.includes(a)) && abil(s).some(a => !SF.includes(a) && !K.LOUD.has(a)));
console.log('     holders: ' + show(HOLDERS) + '   Sheer Force attackers with a quiet second ability: ' + show(ATTS));
const KEEP = /^\|(-damage|-ability|-boost|-unboost)\|/;
const counters = () => ({ boosted: K.M.MEDSEEN.hpThresholdBoosted || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
/* a damaging single-target move with a secondary the target cannot shrug off by type; big enough to matter */
const secMoves = (u, tgt) => D.moves.all().filter(m => K.legal(m) && m.category !== 'Status' && m.target === 'normal' && (m.secondary || m.secondaries)
  && !m.self && !m.recoil && !m.drain && !m.flags.charge && !m.flags.recharge && !m.priority && !m.multihit && !m.basePowerCallback
  && !m.onBasePower && !m.onModifyMove && K.sure(m) && learns(u, m.id) && D.getImmunity(m.type, tgt) && m.basePower >= 60)
  .sort((a, b) => b.basePower - a.basePower);

const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const sdHP = (R, side) => R.sdK.filter(l => new RegExp('^\\|-damage\\|' + side + 'a:').test(l)).map(l => +/\|(\d+)\//.exec(l.replace(/^\|-damage\|[^|]*/, ''))[1]);
let SH = null, CT = null;
outer: for (const h of HOLDERS) {
  const hab = abil(h).find(a => THR.includes(a));
  const hIdle = K.idle(h) || D.moves.all().find(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.heal
    && !m.stallingMove && !m.volatileStatus && !m.onHit && learns(h, m.id));
  if (!hIdle) continue;
  const maxHP = null;
  for (const att of ATTS.filter(s => s.baseSpecies !== h.baseSpecies)) {
    const sfAb = abil(att).find(a => SF.includes(a)), other = abil(att).find(a => !SF.includes(a) && !K.LOUD.has(a));
    for (const mv of secMoves(att, h).slice(0, 6)) {
      const used = new Set([h.baseSpecies, h.id, att.baseSpecies, att.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
      if (fills.length < 4) continue outer;
      const A = ab => [mon(att, '', [mv.name, 'Protect'], ab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
      const B = [mon(h, '', [hIdle.name, 'Protect'], hab), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
      const sc = [{ p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: hIdle.id }, P.protect] }];
      const c = play('control', A(other), B, sc);
      if (!c.staged) { console.log('   (skip ' + att.id + ' ' + mv.id + ': ' + c.why + ')'); continue; }
      /* the control must show the authority's boost off this hit, or the hit did not cross the line */
      if (!c.sdK.some(l => new RegExp('^\\|-ability\\|p2a:[^|]*\\|' + hab + '\\|boost').test(l))) continue;
      const s = play('sheer', A(sfAb), B, sc);
      if (!s.staged) continue;
      /* and the Sheer Force hit must cross it too (at or below half, from full), or SHEER asks nothing */
      const hp = sdHP(s, 'p2');
      const full = +((s.sd.find(l => /^\|switch\|p2a:/.test(l)) || '').split('|')[4] || '0/0').split('/')[1];
      if (!hp.length || !(hp[0] <= full / 2)) continue;
      c.cast = att.id + ' (' + other + ') --' + mv.id + '--> ' + h.id + ' (' + hab + ')';
      s.cast = att.id + ' (' + sfAb + ') --' + mv.id + '--> ' + h.id + ' (' + hab + '), ' + hp[0] + '/' + full;
      SH = s; CT = c; SH.hab = CT.hab = hab; break outer;
    }
  }
}
const RUNS = [['SHEER', SH], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const boosted = R => R.sdK.some(l => new RegExp('^\\|-ability\\|p2a:[^|]*\\|' + R.hab + '\\|boost').test(l));
ok(!boosted(SH), 'SHEER — the holder crossed half and was NOT boosted');
ok(boosted(CT), 'CONTROL — the same hit from the attacker\'s other ability boosts it');

K.compareArms(RUNS, KEEP, '-damage / -ability / -boost / -unboost');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(SH.counters.boosted === 0 && CT.counters.boosted === 1, 'the engine\'s receipts: no boost in SHEER, one in CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + R.counters.boosted)));
}
K.finish();
