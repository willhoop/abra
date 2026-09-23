#!/usr/bin/env node
/* tests/probe_regmc_jaw_lock.js — JAW LOCK TRAPS BOTH BODIES, UNDER REG M-C. 2026-09-22 (ENGINE pass 8, abra/regmc 0.68.0).
 *
 *   node tests/probe_regmc_jaw_lock.js --regulation regmc                            # green, exit 0
 *   MEDI_JAW_LOCK_INERT=1 node tests/probe_regmc_jaw_lock.js --regulation regmc      # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts jawlock :9789-9804 (the Champions mod does not name it; Reg M-B has no legal Jaw Lock):
 *       onHit(target, source, move) {
 *         source.addVolatile('trapped', target, move, 'trapper');
 *         target.addVolatile('trapped', source, move, 'trapper');
 *       },
 *   data/conditions.ts trapped: `onStart(target) { this.add('-activate', target, 'trapped'); }`. `addVolatile` refuses a
 *   repeat and a Ghost (`runStatusImmunity('trapped')`) silently; `onHit` is not a secondary.
 *
 * ================= THE DEFECT ====================================================================
 *
 *   medicham2's `trapsTarget` doors were a status click (`kind:'trapmove'`) and a secondary (Spirit Shackle), so a
 *   Jaw Lock landed its damage and trapped nobody. Found by the Reg M-C roster's Jaw Lock row (below the usage shelf,
 *   underlying DIFFER: `vol.trapped` 1 on both bodies on the authority, 0 here; the authority refused the target's
 *   switch and this engine let it go).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   LOCK      Jaw Lock into a non-Ghost, then a quiet turn: both bodies carry `trapped` at both boundaries.
 *   GHOST     Jaw Lock into a Ghost: the user is trapped and the Ghost is not.
 *   CONTROL   a plain bite of the same user in Jaw Lock's place: nobody is trapped.
 *   REFUSED   LOCK, then the target asks to switch: the AUTHORITY refuses it (the fixture's own receipt).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_jaw_lock', ['MEDI_JAW_LOCK_INERT']);
const { D, ok, SPEC, learns, quiet, plain, sure, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED */
const JL = D.moves.get('jawlock');
if (!K.legal(JL)) { console.log('  NOT STAGED — Jaw Lock is not legal in ' + K.CS.FORMAT); process.exit(1); }
const USERS = SPEC.filter(s => quiet(s) && learns(s, 'jawlock') && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     Jaw Lock users (quiet ability): ' + show(USERS));
const KEEP = /^\|(-activate|-damage|move|switch|faint)\|/;
const OWN = /^\|(-activate|-damage|switch|faint)\|/;
const counters = () => ({ onHit: K.M.MEDSEEN.moveTrapAppliedByOnHit || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let cast = null;
for (const u of USERS) {
  const used = new Set([u.baseSpecies, u.id]);
  const tgt = FILL.find(s => !used.has(s.baseSpecies) && !s.types.includes('Ghost') && D.getImmunity('Dark', s)
    && (K.idle(s) || K.hitFor(s, u)));
  /* the control click: another sure single-target BITE of the same user (its secondary, if any, fires in both engines
   * on this arm and is compared like everything else), else its weakest plain hit into the target */
  const bite = tgt && (D.moves.all().filter(m => K.legal(m) && sure(m) && m.flags.bite && m.id !== 'jawlock' && m.target === 'normal'
      && m.category !== 'Status' && !m.onHit && learns(u, m.id)).sort((a, b) => a.basePower - b.basePower)[0]
    || K.hitFor(u, tgt));
  const gh = FILL.find(s => !used.has(s.baseSpecies) && s.types.includes('Ghost') && (K.idle(s) || K.hitFor(s, u)));
  if (!tgt || !bite) continue;
  [tgt, gh].filter(Boolean).forEach(s => { used.add(s.baseSpecies); used.add(s.id); });
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
  if (fills.length < 5) continue;
  cast = { u, bite, tgt, gh, fills };
  break;
}
if (!cast) { console.log('  NOT STAGED — no Jaw Lock user / target pair'); process.exit(1); }
const { u, bite, tgt, gh, fills } = cast;
console.log('     user ' + u.id + '   target ' + tgt.id + '   first Ghost candidate ' + (gh ? gh.id : 'NONE') + '   control bite ' + bite.id);

function arm(tag, into, mv, turn2) {
  /* the target's own click must not be Protect (Jaw Lock would bounce off it): an idle click, else its weakest hit */
  const tIdle = K.idle(into) || K.hitFor(into, u);
  const tClick = K.idle(into) ? { m: tIdle.id } : { m: tIdle.id, t: 0 };
  const A = [mon(u, '', [mv.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(into, '', [tIdle.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const t1 = { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [tClick, P.protect] };
  return play(tag, A, B, turn2 === 'one' ? [t1] : [t1, turn2 || { p1: [P.protect, P.protect], p2: [tClick, P.protect] }]);
}
const LK = arm('lock', tgt, JL), CT = arm('control', tgt, bite);
/* one turn: a Dark hit into a Ghost can knock it out on this arm, and a second turn would hand its click to the replacement */
let GH = null;
for (const g of FILL.filter(s => s.types.includes('Ghost') && ![u.baseSpecies, tgt.baseSpecies].includes(s.baseSpecies)
    && !fills.some(f => f.baseSpecies === s.baseSpecies) && (K.idle(s) || K.hitFor(s, u)))) {
  const R = arm('ghost', g, JL, 'one');
  /* a Ghost the hit KNOCKS OUT traps nobody on either side (the authority writes no -activate at all), which is a
   * different question: the arm wants one that stands */
  if (R.staged && !R.sdK.some(l => /^\|faint\|p2a:/.test(l))) { R.cast = u.id + ' --jawlock--> ' + g.id; GH = R; break; }
}
const RF = arm('refused', tgt, JL, { p1: [P.protect, P.protect], p2: [{ sw: fills[4].id }, P.protect] });
const RUNS = [['LOCK', LK], ['CONTROL', CT]].concat(GH ? [['GHOST', GH]] : []);
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const act = (R, side) => R.sdK.filter(l => new RegExp('^\\|-activate\\|' + side + 'a:[^|]*\\|trapped').test(l)).length;
ok(act(LK, 'p1') === 1 && act(LK, 'p2') === 1, 'LOCK — the user AND the target are trapped', JSON.stringify(LK.sdK.filter(l => /-activate/.test(l))));
ok(act(CT, 'p1') === 0 && act(CT, 'p2') === 0, 'CONTROL — nobody is trapped');
if (GH) ok(act(GH, 'p1') === 1 && act(GH, 'p2') === 0, 'GHOST — the user is trapped and the Ghost is not', JSON.stringify(GH.sdK.filter(l => /-activate/.test(l))));
ok(!RF.staged && /trapped/i.test(RF.why || ''), 'REFUSED — the authority refuses the target\'s switch', RF.staged ? 'accepted' : RF.why);

K.compareArms(RUNS, OWN, '-activate / -damage / switch / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(LK.counters.onHit === 2 && CT.counters.onHit === 0 && (!GH || GH.counters.onHit === 1),
    'the engine trapped two bodies in LOCK, none in CONTROL, one in GHOST', JSON.stringify([LK.counters, CT.counters, GH && GH.counters]));
}
K.finish();
