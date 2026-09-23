#!/usr/bin/env node
/* tests/probe_self_volatile_fail.js — A SELF-AIMED VOLATILE MOVE THAT IS REFUSED WRITES `[still]` AND `-fail`.
 * 2026-09-23 (ENGINE pass 10, abra/regmc 0.81.0).
 *
 *   node tests/probe_self_volatile_fail.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_self_volatile_fail.js
 *   MEDI_SELF_VOLATILE_FAIL_SILENT=1   restores the old silence (must exit 1)
 *
 * THE AUTHORITY: `Pokemon#addVolatile` returns false for a volatile already present whose condition has no `onRestart`
 * (sim/pokemon.ts), `moveHit`'s `didAnything` is then false, and `useMoveInner` writes `attrLastMove('[still]')` and
 * `-fail` on the user. The move is aimed at the USER, which is the case the engine's announcement excluded.
 *
 * ARMS: every self-aimed Status move whose whole effect is one volatile (derived from the dex: target `self`,
 * `volatileStatus`, no boosts, no heal), clicked on two consecutive turns by a body that learns it -- the second click
 * must fail. CONTROL: the same body clicks it once, then Protects -- no `-fail`.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_self_volatile_fail', ['MEDI_SELF_VOLATILE_FAIL_SILENT'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, legal } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const VOLS = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && m.volatileStatus
  && !m.boosts && !m.heal && !m.onTry && !m.onPrepareHit && !m.onHit && m.volatileStatus === m.id
  && !(D.conditions.get(m.id) || {}).onRestart && !m.stallingMove && !m.flags.charge && !(D.conditions.get(m.id) || {}).duration);
console.log('     members: ' + VOLS.map(m => m.id).join(', '));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const RUNS = [], CHK = [];
for (const mv of VOLS) {
  const user = SPEC.filter(s => quiet(s) && learns(s, mv.id) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a))[0];
  if (!user) { console.log('     ' + mv.id + ': no quiet learner -- not staged'); continue; }
  const used = new Set([user.baseSpecies, user.id]);
  const f = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
  const A = [mon(user, '', [mv.name, 'Protect']), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[2], '', ['Protect'])];
  const B = [mon(f[3], '', ['Protect']), mon(f[4], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[2], '', ['Protect'])];
  const KEEP = /^\|(move|-fail|-start)\|/;
  const t = x => ({ p1: [x, P.protect], p2: [P.protect, P.protect] });
  const R = K.play(mv.id, A, B, [t({ m: mv.id }), t({ m: mv.id })], KEEP);
  const C = K.play(mv.id + '-ctl', A, B, [t({ m: mv.id })], KEEP);
  if (!R.staged || !C.staged) { console.log('   (skip ' + mv.id + ': ' + (R.why || C.why) + ')'); continue; }
  R.cast = user.id + ' clicks ' + mv.id + ' twice'; C.cast = user.id + ' clicks ' + mv.id + ' once';
  RUNS.push([mv.id.toUpperCase(), R], [mv.id.toUpperCase() + '-CTL', C]); CHK.push([mv, R, C]);
}
if (!RUNS.length) { console.log('  NOT RUN — no member staged'); process.exit(2); }
K.printArms(RUNS);
console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
for (const [mv, R, C] of CHK) {
  ok(R.sdK.some(l => /^\|-fail\|p1a:/.test(l)) && R.sdK.some(l => /\|\[still\]$/.test(l)) && !C.sdK.some(l => /^\|-fail\|p1a:/.test(l)),
    mv.id.toUpperCase() + ' — the second click fails with [still] on the authority; one click does not');
}
K.compareArms(RUNS, /^\|(move|-fail|-start)\|/, 'move / -fail / -start');
K.finish();
