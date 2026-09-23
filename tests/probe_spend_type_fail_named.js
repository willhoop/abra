#!/usr/bin/env node
/* tests/probe_spend_type_fail_named.js — A MOVE THAT SPENDS ITS USER'S TYPE, CLICKED AGAIN, FAILS NAMING ITSELF.
 * 2026-09-23 (ENGINE pass 10, abra/regmc 0.83.0).
 *
 *   node tests/probe_spend_type_fail_named.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_spend_type_fail_named.js
 *   MEDI_SPEND_TYPE_FAIL_BARE=1   restores the bare `-fail` (must exit 1)
 *
 * THE AUTHORITY: Double Shock / Burn Up `onTryMove` (data/moves.ts :3954 / :2102, both checkouts, no Champions
 * override): `if (pokemon.hasType(<T>)) return; this.add('-fail', pokemon, 'move: <Name>'); this.attrLastMove('[still]');`.
 * ARMS: every legal `spendsOwnType` move, derived from the tag, clicked twice by a learner that carries the type -- the
 * first click spends the type, the second is refused. CONTROL: one click (it hits; no `-fail`).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_spend_type_fail_named', ['MEDI_SPEND_TYPE_FAIL_BARE'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, legal, idle, abil } = K;
const TAGS = require('../engine/tags.js');

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const MOVES = TAGS.withTag('move', 'spendsOwnType').map(id => D.moves.get(id)).filter(legal);
console.log('     spendsOwnType members: ' + MOVES.map(m => m.id + ' (' + TAGS.param('move', m.id, 'spendsOwnType').requires + ')').join(', '));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const RUNS = [], CHK = [];
for (const mv of MOVES) {
  const T = TAGS.param('move', mv.id, 'spendsOwnType').requires;
  /* a user with no quiet ability keeps its first: nothing in this fixture aims a move at it (Pawmot, the one Reg M-C
   * Double Shock learner, has only loud abilities; Volt Absorb answers only an incoming Electric move) */
  const users = SPEC.filter(s => learns(s, mv.id) && learns(s, 'protect') && s.types.includes(T))  .sort((a, b) => (!!quiet(b) - !!quiet(a)) || (bulk(b) - bulk(a)));
  let done = false;
  for (const user of users) {
    const used = new Set([user.baseSpecies, user.id]);
    const foe = FILL.find(s => !used.has(s.baseSpecies) && idle(s) && D.getImmunity(mv.type, s) && s.baseStats.hp >= 90);
    if (!foe) continue; used.add(foe.baseSpecies); used.add(foe.id);
    const f = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (f.length < 4) continue;
    const A = [mon(user, '', [mv.name, 'Protect'], quiet(user) || abil(user)[0]), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[2], '', ['Protect'])];
    const B = [mon(foe, '', ['Protect', idle(foe).name]), mon(f[3], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[2], '', ['Protect'])];
    const KEEP = /^\|(move|-fail)\|/;
    const t0 = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: idle(foe).id }, P.protect] };
    const t = t0;
    const R = K.play(mv.id, A, B, [t0, t], KEEP);
    const C = K.play(mv.id + '-ctl', A, B, [t0], KEEP);
    if (!R.staged || !C.staged) { console.log('   (skip ' + user.id + ': ' + (R.why || C.why) + ')'); continue; }
    R.cast = user.id + ' clicks ' + mv.id + ' twice'; C.cast = user.id + ' clicks ' + mv.id + ' once';
    RUNS.push([mv.id.toUpperCase(), R], [mv.id.toUpperCase() + '-CTL', C]); CHK.push([mv, R, C]); done = true; break;
  }
  if (!done) console.log('     ' + mv.id + ': no stageable learner');
}
if (!RUNS.length) { console.log('  NOT RUN — no member staged'); process.exit(2); }
K.printArms(RUNS);
console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
for (const [mv, R, C] of CHK) {
  const nm = K.canon(mv.name);
  ok(R.sdK.some(l => l === '|-fail|p1a:' + R.sdK.find(x => /^\|move\|p1a:/.test(x)).split('|')[2].slice(4) + '|move:' + nm)
     && !C.sdK.some(l => /^\|-fail\|p1a:/.test(l)),
    mv.id.toUpperCase() + ' — the second click fails naming the move on the authority; one click does not', R.sdK.join('  '));
}
K.compareArms(RUNS, /^\|(move|-fail)\|/, 'move / -fail');
K.finish();
