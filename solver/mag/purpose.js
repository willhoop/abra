/* solver/mag/purpose.js — WHAT A CLICK IS FOR, read off the move's own effect data in the Reg M-C dex (never a list).
 *
 * Will, 2026-09-26: a filtered click is judged on whether it can achieve its PURPOSE, not on whether it does damage.
 * "For Fake Out the purpose is the flinch; damage alone isn't the point." So MAG v2's question moves from "did the
 * engine report this click a success" to "did the engine show this click's PURPOSE achieved".
 *
 *   const PU = require('./solver/mag/purpose.js');
 *   PU.purposeOf(moveId) -> 'flinch' | 'result'
 *   PU.achieved(purpose, r, k) -> bool     r = a probe world (solver/mag/probe.js), k = my slot
 *
 * THE RULE, from the move's data:
 *   'flinch'   a damaging move whose GUARANTEED secondary (chance 100) is a flinch. Its purpose is to take the target's
 *              action away this turn, so it is achieved only when the engine sets the flinch on a body that has NOT
 *              acted yet (MEDICHAM sets `_flinch` only on a target still in `unresolved`, and an Inner Focus-style
 *              refusal sets nothing — medicham2-browser.js, the secondary loop's flinch branch), and only by THIS
 *              click (probe.js attributes each flinch write to the body whose move was executing). A switch-in has
 *              already spent its action on the switch, so a flinch on it is always too late: a flinch move cannot be
 *              rescued by a switch. Derived today: `node solver/mag/purpose.js`.
 *   'result'   every other move: MEDICHAM's own move result (probe.js `ok`, Showdown's moveThisTurnResult) — the
 *              damage landed, the side or field condition went up, the self-targeted move worked, the status move's
 *              status, stat change or volatile went on.
 *
 * NO 'effect' PURPOSE SINCE 2026-09-26 (evening). The tiered gates first read a status move aimed at a body off the
 * target's BOARD (result AND the turn-end board differing from a pass), because MEDICHAM ended a Prankster status move
 * refused by a Dark target `true` where the authority ends it `false` — Will's Prankster Encore example. ENGINE fixed
 * the result in abra/regmc 1.21.0 (release 4067de46a0ee), and on 300 held-out decisions on that release the board
 * reading changed one verdict of 78 status clicks, wrongly (a Hypnosis at a fainted slot retargeted onto the live foe
 * and slept it; the board compared the empty slot). So the status move is read off the engine's result like every
 * other move, and solver/tests/test-gates.js ENCORE proves the gate reads it: under the engine's own knob
 * MEDI_PRANKSTER_RESULT_TRUE=1 (the pre-fix `true`), ENCORE goes red.
 *
 * WHAT THIS DOES NOT DECIDE (stated, a question for Will): a damaging move whose guaranteed rider is NOT a flinch — a
 * speed drop, a stat drop — keeps DAMAGE as its purpose here, so it is never banned because the rider is refused (a
 * Clear Body-style target). The count is printed by `node solver/mag/purpose.js`; reading their purpose as the rider
 * would ban clicks that still deal damage, which is a design call, not a derivation.
 *
 * DELIBERATE BREAK (env GATE_BREAK=purposeresult): every move's purpose is its move result (the 2026-09-25 gate) — a
 * flinch move into a body whose ability refuses the flinch then reads LIVE. solver/tests/test-gates.js FAKEOUT must go red.
 */
'use strict';
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';
const CACHE = new Map();
const secs = m => (m.secondaries || (m.secondary ? [m.secondary] : [])).filter(Boolean);

function purposeOf(id) {
  if (!id) return 'result';
  if (CACHE.has(id)) return CACHE.get(id);
  const D = require('../human/dex.js').D;
  const m = D.moves.get(id);
  let p = 'result';
  if (BREAK !== 'purposeresult' && m && m.exists && m.category !== 'Status' && secs(m).some(s => s.chance === 100 && s.volatileStatus === 'flinch')) p = 'flinch';
  CACHE.set(id, p);
  return p;
}
/* r: probe world result; k: my slot */
function achieved(purpose, r, k) {
  if (purpose === 'flinch') return !!(r.ok[k] && r.fl && r.fl[k]);
  return !!r.ok[k];
}

module.exports = { purposeOf, achieved, BROKEN: BREAK || null };

if (require.main === module) {
  require('../arena/env.js');
  const X = require('../human/dex.js');
  const L = X.D.moves.all().filter(X.legal);
  const byP = {};
  for (const m of L) { const p = purposeOf(m.id); (byP[p] = byP[p] || []).push(m.id); }
  console.log('flinch-purpose moves (' + (byP.flinch || []).length + '): ' + (byP.flinch || []).join(' '));
  console.log('result-purpose moves: ' + (byP.result || []).length);
  const rider = L.filter(m => m.category !== 'Status' && secs(m).some(s => s.chance === 100 && s.volatileStatus !== 'flinch'));
  console.log('damaging moves with a guaranteed NON-flinch rider (damage stays their purpose): ' + rider.length);
}
