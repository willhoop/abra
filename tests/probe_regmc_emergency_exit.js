#!/usr/bin/env node
/* tests/probe_regmc_emergency_exit.js — EMERGENCY EXIT, UNDER REG M-C. 2026-09-21 (abra/regmc 0.22.0).
 *
 *   node tests/probe_regmc_emergency_exit.js --regulation regmc                                 # green, exit 0
 *   MEDI_EMERGENCY_EXIT_INERT=1    node tests/probe_regmc_emergency_exit.js --regulation regmc  # RED, exit 1
 *   MEDI_EMERGENCY_EXIT_MAINLINE=1 node tests/probe_regmc_emergency_exit.js --regulation regmc  # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/abilities.ts emergencyexit :22-29, overriding data/abilities.ts :1250-1266:
 *       onEmergencyExit(target) {
 *         if (!this.canSwitch(target.side) || target.forceSwitchFlag || target.switchFlag) return;
 *         target.switchFlag = true;
 *         this.add('-activate', target, 'ability: Emergency Exit');
 *       },
 *   -- mainline ALSO clears every active body's `switchFlag` first, so there a pivot into the holder does not switch.
 *   data/mods/champions/scripts.ts:575-590 -- after `afterMoveSecondaryEvent`, unless Sheer Force boosted the move, every
 *   target still standing whose HP went from above half to at or below half on this move raises `EmergencyExit`.
 *   The switch itself is the end-of-action request (sim/battle.ts:2874-2907): a bare `|switch|`, faster leaver first.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   CROSS     a hit takes the holder from full to at or below half: `-activate`, then it switches out.
 *   STAY      a weaker hit leaves it above half: nothing.
 *   UTURN     a U-turn takes it below half: under Champions BOTH switch (the pivot's flag is not cleared).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_emergency_exit', ['MEDI_EMERGENCY_EXIT_INERT', 'MEDI_EMERGENCY_EXIT_MAINLINE']);
const { D, ok, SPEC, learns, abil, quiet, plain, sure, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED: the ability's carriers, read off the dex */
const EE = SPEC.filter(s => abil(s).includes('emergencyexit') && learns(s, 'protect'));
const ATT = SPEC.filter(s => quiet(s) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     Emergency Exit carriers: ' + show(EE));
if (!EE.length) { console.log('  NOT STAGED — no legal Emergency Exit carrier'); process.exit(1); }
const holder = EE[0];

const counters = () => ({ ee: K.M.MEDSEEN.emergencyExitSwitched || 0, other: K.M.MEDFAILS.emergencyExitOtherDoorUnmodelled || 0 });
const KEEP = /^\|(-activate|switch|drag|-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const after = (R, re) => { const i = R.sdK.findIndex(l => /^\|-damage\|/.test(l)); return (i < 0 ? [] : R.sdK.slice(i)).filter(l => re.test(l)); };

/* the attacker's damaging moves into the holder, 100% accurate, single target, no secondary: the strongest (to cross half)
 * and the weakest (to stay above it); the probe finds a pair whose ONE hit crosses on the authority and whose other does not */
const hitsInto = (att, tgt) => D.moves.all().filter(m => plain(m) && !m.multihit && sure(m) && learns(att, m.id)
  && D.getImmunity(m.type, tgt)).sort((a, b) => a.basePower * Math.pow(2, D.getEffectiveness(a.type, tgt)) - b.basePower * Math.pow(2, D.getEffectiveness(b.type, tgt)));
const used = new Set([holder.baseSpecies, holder.id]);
const fills = pickDistinct(FILL, used, 5);
const ALLP = { p1: [P.protect, P.protect], p2: [P.protect, P.protect] };
function arm(tag, att, moveId, extra) {
  const hHit = K.hitFor(holder, fills[3]);
  if (!hHit) return { staged: false, why: holder.id + ' has no plain hit into ' + fills[3].id };
  const A = [mon(holder, '', ['Protect', hHit.name], 'emergencyexit'), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(att, '', [moveId, 'Protect'].concat(extra || [])), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  return play(tag, A, B, [{ p1: [{ m: hHit.id, t: 1 }, P.protect], p2: [{ m: D.moves.get(moveId).id, t: 0 }, P.protect] }, ALLP]);
}
let CR = null, ST = null, UT = null;
for (const att of ATT) {
  if (used.has(att.baseSpecies)) continue;
  const ms = hitsInto(att, holder);
  if (ms.length < 2) continue;
  const strong = ms[ms.length - 1], weak = ms[0];
  const c = arm('cross', att, strong.name);
  if (process.env.EE_DEBUG) console.log('   try ' + att.id + ' ' + strong.id + ': ' + (c.staged ? after(c, /./).join(' ') : c.why));
  if (!c.staged || !after(c, /^\|-activate\|p1a:.*emergencyexit/).length) continue;
  const s = arm('stay', att, weak.name);
  if (!s.staged || after(s, /^\|-activate\|p1a:.*emergencyexit/).length) continue;
  CR = c; ST = s; CR.cast = holder.id + ' <- ' + att.id + ' (' + strong.id + ')'; ST.cast = holder.id + ' <- ' + att.id + ' (' + weak.id + ')';
  break;
}
/* UTURN: turn 1 a weaker hit leaves the holder above half (the holder protects nothing: it hits p2b's Protect), turn 2 the
 * U-turn takes it to or below half. The exit must be announced right below the U-turn's own damage. */
const ALLP2 = ALLP;
for (const att of ATT.filter(s => learns(s, 'uturn'))) {
  if (used.has(att.baseSpecies) || !D.getImmunity('Bug', holder)) continue;
  const ms = hitsInto(att, holder).filter(m => m.id !== 'uturn');
  const hHit = K.hitFor(holder, fills[3]);
  if (!ms.length || !hHit) continue;
  for (const w of ms.slice(0, 4)) {
    const A = [mon(holder, '', ['Protect', hHit.name], 'emergencyexit'), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const B = [mon(att, '', [w.name, 'U-turn', 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const u = play('uturn', A, B, [{ p1: [{ m: hHit.id, t: 1 }, P.protect], p2: [{ m: w.id, t: 0 }, P.protect] },
                                   { p1: [{ m: hHit.id, t: 1 }, P.protect], p2: [{ m: 'uturn', t: 0 }, P.protect] }, ALLP2]);
    if (!u.staged) continue;
    const L = after(u, /./), i = L.findIndex(l => /^\|-activate\|p1a:.*emergencyexit/.test(l));
    const d = L.filter(l => /^\|-damage\|p1a:/.test(l));
    if (i < 1 || d.length < 2 || !/^\|-damage\|p1a:/.test(L[i - 1]) || L[i - 1] !== d[1]) continue;
    UT = u; UT.cast = holder.id + ' <- ' + att.id + ' (' + w.id + ', then uturn)'; break;
  }
  if (UT) break;
}
const RUNS = [['CROSS', CR], ['STAY', ST], ['UTURN', UT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
ok(after(CR, /^\|-activate\|p1a:.*emergencyexit/).length === 1 && after(CR, /^\|switch\|p1a:/).length === 1, 'CROSS — announced once, and the holder switches out');
ok(after(ST, /^\|-activate\|p1a:.*emergencyexit|^\|switch\|/).length === 0, 'STAY — above half: nothing');
ok(after(UT, /^\|switch\|p1a:/).length === 1 && after(UT, /^\|switch\|p2a:.*\[from\]/).length === 1, 'UTURN — Champions: the holder AND the pivot both switch');

K.compareArms(RUNS, KEEP, '-activate / switch / drag / -damage / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(CR.counters.ee === 1 && ST.counters.ee === 0 && UT.counters.ee === 1, 'the engine\'s own receipts: one exit per crossing arm, none on STAY',
     JSON.stringify([CR.counters, ST.counters, UT.counters]));
}
K.finish();
