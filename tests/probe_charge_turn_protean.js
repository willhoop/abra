#!/usr/bin/env node
/* tests/probe_charge_turn_protean.js — PROTEAN AND LIBERO CONVERT ON A TWO-TURN MOVE'S CHARGE TURN, IN BOTH
 * REGULATIONS. 2026-09-22 (ENGINE pass 8, abra/regmc 0.67.0).
 *
 *   node tests/probe_charge_turn_protean.js --regulation regmc                               # green, exit 0
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_charge_turn_protean.js                     # green, exit 0
 *   MEDI_CHARGE_NO_PREPAREHIT=1 node tests/probe_charge_turn_protean.js --regulation regmc   # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (both checkouts; read whole) ====================================
 *
 *   data/conditions.ts twoturnmove.onStart :291-313 (no Champions override in either regulation) ends
 *       // Run side-effects normally associated with hitting (e.g., Protean, Libero)
 *       this.runEvent('PrepareHit', attacker, defender, effect);
 *   and every charge move's `onTryMove` adds `twoturnmove` as its last line on a SPENT charge turn (data/moves.ts
 *   bounce :1715-1725, the same shape on all ten). `runEvent('TryMove')` sits ABOVE the move's own PrepareHit
 *   (sim/battle-actions.ts :486 against :591), so without the wrapper's call no conversion could happen on that turn.
 *   Protean / Libero (`onPrepareHit`, once per entry) therefore change the user's type WHILE IT WINDS UP; the release
 *   turn converts nothing more.
 *
 * ================= THE DEFECT ====================================================================
 *
 *   medicham2 called `proteanConvert` at the hit and on status clicks, never on a spent charge turn, so a Libero
 *   body winding up Bounce kept its own type for the whole charge turn. Found by the Reg M-C roster's Bounce row (below
 *   the usage shelf, underlying DIFFER on `types`: the authority Flying, this engine Fire).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   CHARGE    a Protean/Libero carrier clicks a charge move of a type it does not have: it converts on turn 1 (the
 *             charge), and turn 2 (the release) converts nothing more.
 *   CONTROL   the same script with the carrier on another of its own abilities: no conversion.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_charge_turn_protean', ['MEDI_CHARGE_NO_PREPAREHIT'], { anyRegulation: true });
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED */
const CONV = ['protean', 'libero'];
const CHARGE = D.moves.all().filter(m => K.legal(m) && m.flags.charge && m.category !== 'Status' && m.target !== 'self'
  && !/^solarb/.test(m.id) && m.id !== 'electroshot');
const CAR = SPEC.filter(s => abil(s).some(a => CONV.includes(a)) && abil(s).some(a => !CONV.includes(a)) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     Protean/Libero carriers with a second ability: ' + show(CAR) + '\n     charge moves (no weather skip): '
  + CHARGE.map(m => m.id).join(', '));

const KEEP = /^\|(-start|-prepare|-damage|move|faint)\|/;
const OWN = /^\|(-start|-prepare|-damage|faint)\|/;
const counters = () => ({ charge: K.M.MEDSEEN.proteanOnChargeTurn || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let cast = null;
for (const c of CAR) {
  const mv = CHARGE.find(m => learns(c, m.id) && !c.types.includes(m.type));
  if (!mv) continue;
  const conv = abil(c).find(a => CONV.includes(a)), other = abil(c).find(a => !CONV.includes(a));
  const used = new Set([c.baseSpecies, c.id]);
  const foe = FILL.find(s => !used.has(s.baseSpecies) && D.getImmunity(mv.type, s) && K.idle(s));
  if (!foe) continue;
  used.add(foe.baseSpecies); used.add(foe.id);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
  if (fills.length < 5) continue;
  cast = { c, mv, conv, other, foe, fills };
  break;
}
if (!cast) { console.log('  NOT STAGED — no carrier learns a charge move outside its own type'); process.exit(1); }
const { c, mv, conv, other, foe, fills } = cast;
const fIdle = K.idle(foe);
console.log('     carrier ' + c.id + ' (' + conv + '; control ' + other + ')   ' + mv.id + ' (' + mv.type + ') into ' + foe.id);

function arm(tag, ab) {
  const A = [mon(c, '', [mv.name, 'Protect'], ab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(foe, '', [fIdle.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  return play(tag, A, B, [{ p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: fIdle.id }, P.protect] },
                          { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: fIdle.id }, P.protect] }]);
}
const CH = arm('charge', conv), CT = arm('control', other);
K.printArms([['CHARGE', CH], ['CONTROL', CT]]);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const tc = R => R.sdK.filter(l => /^\|-start\|p1a:.*typechange/.test(l));
const prepIdx = R => R.sdK.findIndex(l => /^\|-prepare\|p1a:/.test(l));
const dmgIdx = R => R.sdK.findIndex(l => /^\|-damage\|p2a:/.test(l));
ok(tc(CH).length === 1 && prepIdx(CH) >= 0 && R_before(CH), 'CHARGE — one type change, written on the CHARGE turn (after -prepare, before the release hit)',
  JSON.stringify(CH.sdK.filter(l => /-start|-prepare|-damage\|p2a/.test(l))));
ok(tc(CT).length === 0, 'CONTROL — no type change', JSON.stringify(tc(CT)));
function R_before(R) { const i = R.sdK.findIndex(l => /^\|-start\|p1a:.*typechange/.test(l)); const d = dmgIdx(R); return i > prepIdx(R) && (d < 0 || i < d); }

K.compareArms([['CHARGE', CH], ['CONTROL', CT]], OWN, '-start / -prepare / -damage / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(CH.counters.charge === 1 && CT.counters.charge === 0, 'the engine converted once on a charge turn in CHARGE, never in CONTROL',
    JSON.stringify([CH.counters, CT.counters]));
}
K.finish();
