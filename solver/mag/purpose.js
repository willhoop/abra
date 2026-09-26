/* solver/mag/purpose.js — WHAT A CLICK IS FOR, read off the move's own effect data in the Reg M-C dex (never a list).
 *
 * Will, 2026-09-26: a filtered click is judged on whether it can achieve its PURPOSE, not on whether it does damage.
 * "For Fake Out the purpose is the flinch; damage alone isn't the point." So MAG v2's question moves from "did the
 * engine report this click a success" to "did the engine show this click's PURPOSE achieved".
 *
 *   const PU = require('./solver/mag/purpose.js');
 *   PU.purposeOf(moveId, readVol) -> 'flinch' | 'effect' | 'result'     readVol = the volatiles the board reads
 *   PU.achieved(purpose, r, k, r0) -> bool     r = a probe world (solver/mag/probe.js), k = my slot, r0 = the same world
 *                                              with slot k passing (needed for 'effect' only, both read with the board)
 *
 * THE RULE, from the move's data:
 *   'flinch'   a damaging move whose GUARANTEED secondary (chance 100) is a flinch. Its purpose is to take the target's
 *              action away this turn, so it is achieved only when the engine sets the flinch on a body that has NOT
 *              acted yet (MEDICHAM sets `_flinch` only on a target still in `unresolved`, and an Inner Focus-style
 *              refusal sets nothing — medicham2-browser.js, the secondary loop's flinch branch), and only by THIS
 *              click (probe.js attributes each flinch write to the body whose move was executing). A switch-in has
 *              already spent its action on the switch, so a flinch on it is always too late: a flinch move cannot be
 *              rescued by a switch. Derived today: `node solver/mag/purpose.js`.
 *   'effect'   a STATUS move aimed at another body (not `self`, not the whole field or a side) whose effect is a status,
 *              a stat change, or a volatile the board reads (`readVol`: the keys of engine/board_state.js `readMedi`'s
 *              volatile leaves, read off the frozen copy at run time). Achieved when the move result is a success AND
 *              the turn-end board differs from the same world with this slot passing — the effect is ON the board.
 *              Needed because MEDICHAM's move result can say success when nothing was applied: a Prankster-boosted
 *              status move refused by a Dark target ends with the result `true` here and `false` in the authority
 *              (filed in docs/ENGINE.md 2026-09-26, not fixed), which is exactly Will's Prankster Encore example.
 *   'result'   every other move: MEDICHAM's own move result (probe.js `ok`, Showdown's moveThisTurnResult) — the
 *              damage landed, the side or field condition went up, the self-targeted move worked.
 *
 * WHAT THIS DOES NOT DECIDE (stated, a question for Will): a damaging move whose guaranteed rider is NOT a flinch — a
 * speed drop, a stat drop — keeps DAMAGE as its purpose here, so it is never banned because the rider is refused (a
 * Clear Body-style target). The count is printed by `node solver/mag/purpose.js`; reading their purpose as the rider
 * would ban clicks that still deal damage, which is a design call, not a derivation. A status volatile the board does
 * not read (Helping Hand's, for one) stays 'result': an effect the board cannot see is never read as absent.
 *
 * DELIBERATE BREAK (env GATE_BREAK=purposeresult): every move's purpose is its move result (the 2026-09-25 gate) — Fake
 * Out into an Inner Focus body then reads LIVE, and a Prankster Encore into a Dark body reads LIVE.
 * solver/tests/test-gates.js FAKEOUT and ENCORE must go red.
 */
'use strict';
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';
const CACHE = new Map();
const secs = m => (m.secondaries || (m.secondary ? [m.secondary] : [])).filter(Boolean);
const AIMED = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf', 'allAdjacentFoes', 'allAdjacent', 'randomNormal']);

function purposeOf(id, readVol) {
  if (!id) return 'result';
  const key = id + (readVol ? '|v' : '');
  if (CACHE.has(key)) return CACHE.get(key);
  const D = require('../human/dex.js').D;
  const m = D.moves.get(id);
  let p = 'result';
  if (BREAK !== 'purposeresult' && m && m.exists) {
    if (m.category !== 'Status' && secs(m).some(s => s.chance === 100 && s.volatileStatus === 'flinch')) p = 'flinch';
    else if (m.category === 'Status' && AIMED.has(m.target)
      && (m.status || (m.boosts && Object.keys(m.boosts).length) || (m.volatileStatus && readVol && readVol.has(m.volatileStatus)))) p = 'effect';
  }
  CACHE.set(key, p);
  return p;
}
/* r: probe world result; k: my slot; r0: the pass counterfactual of the same world (boards read), for 'effect' */
function achieved(purpose, r, k, r0) {
  if (purpose === 'flinch') return !!(r.ok[k] && r.fl && r.fl[k]);
  if (purpose === 'effect') return !!(r.ok[k] && r0 && r.board != null && r0.board != null && r.board !== r0.board);
  return !!r.ok[k];
}

module.exports = { purposeOf, achieved, AIMED, BROKEN: BREAK || null };

if (require.main === module) {
  require('../arena/env.js');
  const X = require('../human/dex.js');
  const BS = require('../doduo/board_state.frozen.js');
  const L = X.D.moves.all().filter(X.legal);
  /* the board's volatile leaves, read off one built body (the same derivation solver/mag/gate.js makes on a position) */
  const API = require('../../engine/medicham_api.js');
  const sp = X.D.species.all().filter(s => X.legal(s) && !s.isMega && !s.forme)[0];
  const S = API.newBattle([API.M.buildMon(sp.id, {}), API.M.buildMon(sp.id, {})], [API.M.buildMon(sp.id, {}), API.M.buildMon(sp.id, {})], { seeded: true });
  const readVol = new Set(Object.keys(BS.readMedi(S, { id: X.toID, fails: {} }).sides.p1.active[0].vol || {}));
  const byP = {};
  for (const m of L) { const p = purposeOf(m.id, readVol); (byP[p] = byP[p] || []).push(m.id); }
  console.log('flinch-purpose moves (' + (byP.flinch || []).length + '): ' + (byP.flinch || []).join(' '));
  console.log('effect-purpose moves (' + (byP.effect || []).length + '): ' + (byP.effect || []).join(' '));
  console.log('result-purpose moves: ' + (byP.result || []).length);
  const rider = L.filter(m => m.category !== 'Status' && secs(m).some(s => s.chance === 100 && s.volatileStatus !== 'flinch'));
  console.log('damaging moves with a guaranteed NON-flinch rider (damage stays their purpose): ' + rider.length);
}
