/* solver/arena/protect_stats.js — THE PROTECT COUNTER of an arena game (2026-09-26,
 * docs/_reports/2026-09-26-protect-overuse.md).
 *
 *   const PS = require('./solver/arena/protect_stats.js').create(API);
 *   const g = PS.game();                    one per game
 *   g.before(S, jA, jB)                     after both sides chose, BEFORE the step
 *   g.after(S)                              after the step
 *   g.out() -> { A: tally, B: tally }       tally = { actions, protects, failed, consec, consecFailed }
 *   PS.add(into, tally)                     sum tallies
 *   PS.FAMILY                               the protect family, derived (see below)
 *
 * THE SAME QUESTION AS THE LIVE READ (docs/_reports/2026-09-26-click-outcomes.md §1 and §4), asked of the engine's
 * state instead of the protocol, because an arena game writes none:
 *   actions       every slot's chosen action that is a move or a switch (a pass and an engine-forced move are not
 *                 choices and are not counted);
 *   protects      the protect-family clicks among them;
 *   failed        a protect-family click whose user carries no `stall` counter after the turn. The counter
 *                 (`tookProtectTurns`) rises only on a SUCCESSFUL use and is zeroed by a lost roll or by a turn the
 *                 volatile was not refreshed (engine/medicham2-browser.js `_stallRoll`, `_stallExpire`) — so after
 *                 the step it is > 0 exactly when this turn's use succeeded. A click that never executed (a flinch,
 *                 sleep) reads failed here and is a `cant` in the live read — a small over-count, said out loud;
 *   consec        a protect-family click by a body that clicked one on the previous turn AND it succeeded (the live
 *                 read's "consecutive": the same slot, a successful protect-family move the turn before);
 *   consecFailed  the consec clicks that failed.
 *
 * THE FAMILY IS DERIVED FROM THE FORMAT, never listed: every legal move with `stallingMove`, plus every legal move
 * whose `onHitSide` adds the `stall` volatile to its user (data/moves.ts — the two side guards). The live read used
 * the same set (click-outcomes §Sources).
 */
'use strict';
const X = require('../human/dex.js');

let FAMILY = null;
function family() {
  if (FAMILY) return FAMILY;
  FAMILY = new Set();
  for (const m of X.D.moves.all()) {
    if (!m.exists || m.isNonstandard) continue;
    if (m.stallingMove || /addVolatile\(\s*["']stall["']\s*\)/.test(String(m.onHitSide || ''))) FAMILY.add(m.id);
  }
  return FAMILY;
}

function create(API) {
  const F = family();
  const blank = () => ({ actions: 0, protects: 0, failed: 0, consec: 0, consecFailed: 0 });
  const add = (into, t) => { for (const k of Object.keys(blank())) into[k] = (into[k] || 0) + (t[k] || 0); return into; };
  const live = m => !!(m && !m.fainted && m.curHP > 0);

  function game() {
    const T = { A: blank(), B: blank() };
    let prevUp = new Set();          // bodies whose protect-family use succeeded on the previous turn
    let pend = [];
    return {
      before(S, jA, jB) {
        pend = [];
        for (const [sd, j] of [['A', jA], ['B', jB]]) {
          const act = sd === 'A' ? S.actA : S.actB;
          (j || []).forEach((o, k) => {
            if (!o || o.kind === 'pass' || o.forced || !live(act[k])) return;
            if (o.kind !== 'move' && o.kind !== 'switch') return;
            T[sd].actions++;
            if (o.kind === 'move' && F.has(o.move)) {
              const body = act[k];
              const c = prevUp.has(body);
              T[sd].protects++; if (c) T[sd].consec++;
              pend.push({ sd, body, c });
            }
          });
        }
      },
      after() {
        const up = new Set();
        for (const p of pend) {
          const ok = p.body.tookProtectTurns > 0;
          if (ok) up.add(p.body);
          else { T[p.sd].failed++; if (p.c) T[p.sd].consecFailed++; }
        }
        prevUp = up; pend = [];
      },
      out() { return T; },
    };
  }
  return { game, add, blank, FAMILY: F };
}

module.exports = { create, family };
