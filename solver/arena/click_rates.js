/* solver/arena/click_rates.js — TWO CLICK RATES PER SIDE PER GAME, read at the moment of the click on the TRUE battle.
 *
 * Added 2026-09-26 for the tiered gates (docs/_reports/2026-09-26-tiered-gates.md): the before/after of a filter is
 * not only a win rate; it is also whether the clicks the filter exists to stop went down.
 *
 *   const CR = require('./solver/arena/click_rates.js').create(API);
 *   const t = CR.tally();            // one per side per game
 *   CR.add(t, S, side, joint);       // BEFORE the step, on the true battle S
 *   t -> { decisions, clicks, protect, protect_repeat, aimed, immune }
 *
 *   protect          a click of a Protect-family move (the dex's `stallingMove`, target `self` — read, never listed)
 *   protect_repeat   ... by a body whose Protect streak is live (MEDICHAM's `tookProtectTurns > 0`: it protected
 *                    successfully last turn), i.e. the click that succeeds only on a falling roll
 *   aimed            a damaging click at ONE opposing body that is on the field (a move whose damage is a callback — a
 *                    counter-attack, a fraction of HP — is not priced by the damage function and is left out)
 *   immune           ... into a body MEDICHAM's own damage function gives 0 (`M.dmgRange(...).max === 0`: a type or an
 *                    ability immunity, as the engine prices it at the moment of the click). A spread click is not
 *                    counted; a click whose target then switches out still counts (it was aimed at an immune body).
 */
'use strict';
const X = require('../human/dex.js');
const live = m => !!(m && !m.fainted && m.curHP > 0);

function create(API) {
  const M = API.M;
  const INFO = new Map();
  const info = id => {
    if (!INFO.has(id)) { const m = X.D.moves.get(id); INFO.set(id, m && m.exists ? { stall: !!(m.stallingMove && m.target === 'self'), dmg: m.category !== 'Status' && !m.damageCallback }: { stall: false, dmg: false }); }
    return INFO.get(id);
  };
  const tally = () => ({ decisions: 0, clicks: 0, protect: 0, protect_repeat: 0, aimed: 0, immune: 0, priced_errors: 0 });
  function add(t, S, side, joint) {
    t.decisions++;
    const own = side === 'A' ? S.actA : S.actB, foes = side === 'A' ? S.actB : S.actA;
    (joint || []).forEach((o, k) => {
      if (!o || o.kind !== 'move' || o.forced || !o.move) return;
      const u = own[k];
      if (!live(u)) return;
      t.clicks++;
      const I = info(o.move);
      if (I.stall) { t.protect++; if ((u.tookProtectTurns | 0) > 0) t.protect_repeat++; }
      if (I.dmg && o.target > 0) {
        const tg = foes[o.target - 1];
        if (!live(tg)) return;
        t.aimed++;
        const MC = globalThis.MC;
        const mv = MC && MC.moves && MC.moves[o.move];
        if (!mv) { t.priced_errors++; return; }
        let r = null;
        try { r = M.dmgRange(u, tg, mv, S.field, false); } catch (e) { r = null; }
        if (!r) { t.priced_errors++; return; }
        if (!(r.max > 0)) t.immune++;
      }
    });
  }
  return { tally, add };
}

module.exports = { create };
