#!/usr/bin/env node
/* tests/probe_steel_roller_onhit.js — STEEL ROLLER ENDS THE TERRAIN IN ITS OWN `onHit`, ABOVE THE TOLLS AND THE FAINT.
 * 2026-09-23 (ENGINE pass 10, abra/regmc 0.84.0).
 *
 *   node tests/probe_steel_roller_onhit.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_steel_roller_onhit.js
 *   MEDI_STEEL_ROLLER_CLEAR_AT_END=1   restores the clear at the bottom of the move (must exit 1)
 *
 * THE AUTHORITY: `steelroller.onHit() { this.field.clearTerrain(); }` (data/moves.ts, both checkouts, no Champions
 * override). `runMoveEffects` raises the move's `Hit` above `DamagingHit` and above `faintMessages`.
 * ARMS (terrain raised on turn 1 by the user's partner, Steel Roller on turn 2):
 *   TOLL  the target holds the first legal contact-toll item the format offers (derived: an item whose `onDamagingHit`
 *         checks `checkMoveMakesContact`), so a `-damage ... [from] item:` line follows the hit.
 *   KO    the frailest Steel-weak foe, so the target's `|faint|` follows the hit.
 * Each arm asserts on the authority that `-fieldend` precedes the toll / faint line, then compares both engines.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_steel_roller_onhit', ['MEDI_STEEL_ROLLER_CLEAR_AT_END'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, legal, idle } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const TERR = D.moves.all().filter(m => legal(m) && m.terrain && m.target === 'all').map(m => m.id);
const USER = SPEC.filter(s => quiet(s) && learns(s, 'steelroller') && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const SETTER = SPEC.filter(s => quiet(s) && learns(s, 'protect') && TERR.some(t => learns(s, t)));
const TOLL = D.items.all().filter(i => legal(i) && /checkMoveMakesContact/.test(String(i.onDamagingHit || ''))).map(i => i.id);
console.log('     users: ' + USER.map(s => s.id).join(', ') + '   terrain moves: ' + TERR.join(', ') + '   toll items: ' + TOLL.join(', '));
if (!USER.length || !SETTER.length) { console.log('  NOT RUN — no quiet Steel Roller learner or terrain setter'); process.exit(2); }
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const steelWeak = s => D.getImmunity('Steel', s) && D.getEffectiveness('Steel', s) > 0;
const KEEP = /^\|(move|-fieldstart|-fieldend|-damage|faint)\|/;

const RUNS = [], CHK = [];
function arm(tag, targetOf, item) {
  for (const u of USER) for (const st of SETTER) {
    if (st.baseSpecies === u.baseSpecies) continue;
    const tmv = TERR.find(t => learns(st, t));
    const used = new Set([u.baseSpecies, u.id, st.baseSpecies, st.id]);
    const tg = targetOf(used); if (!tg) continue;
    used.add(tg.baseSpecies); used.add(tg.id);
    const f = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
    if (f.length < 3) continue;
    const A = [mon(u, '', ['Steel Roller', 'Protect']), mon(st, '', [D.moves.get(tmv).name, 'Protect']), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect'])];
    const B = [mon(tg, item, ['Protect', idle(tg).name]), mon(f[2], '', ['Protect', idle(f[2]).name]), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect'])];
    const R = K.play(tag, A, B, [{ p1: [P.protect, { m: tmv }], p2: [P.protect, P.protect] },
      { p1: [{ m: 'steelroller', t: 0 }, P.protect], p2: [{ m: idle(tg).id }, { m: idle(f[2]).id }] }], KEEP);
    if (!R.staged) { console.log('   (skip ' + tag + ' ' + u.id + '/' + tg.id + ': ' + R.why + ')'); continue; }
    R.cast = u.id + ' Steel Roller into ' + tg.id + (item ? ' @ ' + item : '') + ' under ' + tmv + ' (' + st.id + ')';
    return R;
  }
  return null;
}
if (TOLL.length) {
  const R = arm('TOLL', used => FILL.find(s => !used.has(s.baseSpecies) && !steelWeak(s) && D.getImmunity('Steel', s)), TOLL[0]);
  if (R) { RUNS.push(['TOLL', R]); CHK.push(['TOLL', R, /^\|-damage\|p1a:[^|]*\|[^|]*\|\[from\]item:/]); }
}
{
  const R = arm('KO', used => SPEC.filter(s => quiet(s) && idle(s) && learns(s, 'protect') && steelWeak(s) && !used.has(s.baseSpecies))
    .sort((a, b) => bulk(a) - bulk(b))[0], '');
  if (R) { RUNS.push(['KO', R]); CHK.push(['KO', R, /^\|faint\|p2a:/]); }
}
if (!RUNS.length) { console.log('  NOT RUN — no arm staged'); process.exit(2); }
K.printArms(RUNS);
console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
for (const [tag, R, after] of CHK) {
  const iEnd = R.sdK.findIndex(l => /^\|-fieldend\|/.test(l)), iAfter = R.sdK.findIndex(l => after.test(l));
  ok(iEnd >= 0 && iAfter >= 0 && iEnd < iAfter, tag + ' — the authority ends the terrain ABOVE the ' + (tag === 'KO' ? 'faint' : 'toll') + ' line',
     'fieldend at ' + iEnd + ', ' + tag + ' line at ' + iAfter);
}
K.compareArms(RUNS, /^\|(-fieldend|-damage|faint)\|/, '-fieldend / -damage / faint');
K.finish();
