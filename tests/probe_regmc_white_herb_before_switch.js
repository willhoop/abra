#!/usr/bin/env node
/* tests/probe_regmc_white_herb_before_switch.js — WHITE HERB IS SPENT AT THE AFTERMOVE DOOR, BEFORE THE END-OF-ACTION
 * SWITCH, UNDER REG M-C. 2026-09-22 (abra/regmc 0.32.0).
 *
 *   node tests/probe_regmc_white_herb_before_switch.js --regulation regmc                                # green, exit 0
 *   MEDI_HERB_AFTER_OWED_SWITCH=1 node tests/probe_regmc_white_herb_before_switch.js --regulation regmc  # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts whiteherb (read from the dist dex): onStart restores every negative stage and spends the item; it is
 *   raised from onAnySwitchIn, onAnyAfterMega, onAnyAfterMove and onResidual. `AfterMove` is raised inside `useMove`, so
 *   it runs BEFORE `runAction`'s tail, where the switches the move owed (an Eject Button's `switchFlag`, sim/battle.ts
 *   :2874-2907) are requested. So a self-dropping hit into an Eject Button holder spends the attacker's herb first, and an
 *   Intimidate on the replacement then lands and STAYS.
 *   The items and the ability are found by their TAGS (`restoresStats`, `ejectsHolderOnHit`, `onSwitchInDrop`).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   EJECT     the herb holder's self-dropping hit ejects the target; the replacement Intimidates.
 *   CONTROL   the same without the Eject Button (no switch): the herb clears the drop; nothing else happens.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_white_herb_before_switch', ['MEDI_HERB_AFTER_OWED_SWITCH']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, sure, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const withTag = (k, t) => Object.keys(TAGS[k]).filter(x => (TAGS[k][x].tags || []).includes(t));
const HERB = withTag('items', 'restoresStats').find(i => K.legal(D.items.get(i)));
const EJECT = withTag('items', 'ejectsHolderOnHit').find(i => K.legal(D.items.get(i)));
const INTIM = withTag('abilities', 'onSwitchInDrop');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     herb: ' + HERB + '   eject: ' + EJECT + '   switch-in droppers: ' + INTIM.join(', '));
if (!HERB || !EJECT || !INTIM.length) { console.log('  NOT STAGED — a member is missing'); process.exit(1); }
const boostQuiet = s => { const a = quiet(s); if (!a) return null; const A = D.abilities.get(a);
  return (A.onTryBoost || A.onChangeBoost || A.onAfterBoost || A.onAfterEachBoost || A.onFoeAfterBoost) ? null : a; };
/* a single-target sure damaging move that lowers its user's own stats and does nothing else */
const selfDrop = s => D.moves.all().filter(m => K.legal(m) && learns(s, m.id) && m.category !== 'Status' && m.target === 'normal' && sure(m)
  && m.self && m.self.boosts && Object.values(m.self.boosts).every(v => v < 0) && !m.secondary && !m.secondaries && !m.priority
  && !m.multihit && !m.flags.charge && !m.selfSwitch && !m.basePowerCallback).sort((a, b) => a.basePower - b.basePower)[0] || null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-enditem|-clearnegativeboost|switch|-unboost|-ability)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ restored: K.M.MEDSEEN.statsRestoredByItem || 0 }));

let EJ = null, CT = null;
outer: for (const u of SPEC.filter(s => boostQuiet(s) && learns(s, 'protect') && selfDrop(s))) {
  const mv = selfDrop(u);
  const used = new Set([u.baseSpecies, u.id]);
  const ints = SPEC.filter(s => abil(s).some(a => INTIM.includes(a)) && !used.has(s.baseSpecies) && learns(s, 'protect'));
  for (const ib of ints.slice(0, 5)) {
    const ia = abil(ib).find(a => INTIM.includes(a));
    const u2 = new Set(used); u2.add(ib.baseSpecies);
    const tgt = FILL.find(s => !u2.has(s.baseSpecies) && D.getImmunity(mv.type, s) && D.getEffectiveness(mv.type, s) <= 0 && K.idle(s));
    if (!tgt) continue; u2.add(tgt.baseSpecies);
    const fills = pickDistinct(FILL.filter(s => !u2.has(s.baseSpecies)), u2, 4);
    if (fills.length < 4) continue;
    const tIdle = K.idle(tgt);
    const A = [mon(u, D.items.get(HERB).name, [mv.name, 'Protect'], boostQuiet(u)), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
    const B = it => [mon(tgt, it, [tIdle.name, 'Protect']), mon(fills[2], '', ['Protect']), mon(ib, '', ['Protect'], ia), mon(fills[3], '', ['Protect'])];
    const script = [{ p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: tIdle.id }, P.protect] }];
    const e = play('eject', A, B(D.items.get(EJECT).name), script);
    if (!e.staged) { console.log('   (skip ' + u.id + '/' + ib.id + ': ' + e.why + ')'); continue; }
    if (!e.sdK.some(l => /^\|switch\|p2a:/.test(l) && e.sdK.indexOf(l) > 3)) continue;
    const c = play('control', A, B(''), script);
    if (!c.staged) continue;
    e.cast = u.id + ' @ White Herb --' + mv.id + '--> ' + tgt.id + ' @ Eject Button; ' + ib.id + ' [' + ia + '] comes in';
    c.cast = u.id + ' @ White Herb --' + mv.id + '--> ' + tgt.id + ' (no item)';
    EJ = e; CT = c; break outer;
  }
}
const RUNS = [['EJECT', EJ], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const idx = (R, re) => R.sdK.findIndex(l => re.test(l));
ok(idx(EJ, /^\|-clearnegativeboost\|p1a:/) >= 0 && idx(EJ, /^\|-clearnegativeboost\|p1a:/) < idx(EJ, /^\|-ability\|p2a:/),
  'EJECT — the herb clears the self-drop BEFORE the replacement Intimidates');
ok(EJ.sdK.some(l => /^\|-unboost\|p1a:.*\|atk\|/.test(l)) && idx(CT, /^\|-clearnegativeboost\|p1a:/) >= 0, 'EJECT — the Intimidate drop lands; CONTROL — the herb fires');

K.compareArms(RUNS, KEEP, '-enditem / -clearnegativeboost / switch / -unboost / -ability');
K.finish();
