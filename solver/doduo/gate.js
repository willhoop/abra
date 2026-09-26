/* solver/doduo/gate.js — DODUO v2's PAIR GATE: the joint actions that are futile only TOGETHER.
 *
 * MAG v2 (solver/mag/gate.js) cuts a click that is dead for its slot whatever the partner does. What it cannot see
 * is a click that works beside one partner and is wasted beside another — Helping Hand beside a partner that does
 * not attack, two redirects on one turn, a partner-targeting support move on a partner that is leaving or for which
 * it fails. Those are properties of the PAIR, and this gate removes the pair, never the click.
 *
 *   const DG = require('./solver/doduo/gate.js').create(API, { mag })     mag = solver/mag/gate.js's create()
 *   DG.pairVerdict(pos, joint) -> { cut: bool, slot, why, ... }             pos = solver/mag/probe.js position
 *   DG.futileGiven(pos, k, a, b) -> 'futile' | 'effect' | 'unknown'        a in slot k beside b
 *
 * "NO EFFECT BESIDE b", read from the engine, never typed. In every informative world of the opponent's covering
 * design (probe.js oppCover: every option of each opposing slot at least twice, both dice sets):
 *   - the engine's move result for `a` was not success (it failed, or was blocked), OR
 *   - it succeeded and the BOARD after the turn (engine/board_state.js readMedi — HP, status, items, boosts,
 *     volatiles and their clocks, field, sides) is identical to the board when slot k PASSES instead, same partner
 *     click, same opponent joint, same event-addressed dice.
 * A world in which slot k never reached its move is uninformative and skipped.
 *
 * THE PAIR IS CUT ONLY IF THE FUTILITY IS THE PAIR'S. `a` futile beside `b` is not enough: it must ALSO have an
 * effect beside some other partner option. A click futile beside every partner is MAG's to judge (it will have
 * failed everywhere, or its effect is invisible to the board, in which case nobody may cut it); this gate never
 * touches it. That is what keeps the two gates' removals disjoint, by construction and in
 * solver/doduo/eval_gates.js's ablation table.
 *
 * Two pair rules the authority enforces itself — one body switched in twice, two megas in one turn — are refused by
 * MEDICHAM's `legalActions` joint product (engine/medicham_api.js, from sim/side.ts). Those joints never reach this
 * gate; eval_gates.js counts them as the ENGINE-REFUSED share of the slot product.
 *
 * DELIBERATE BREAKS (env GATE_BREAK): `pairany` — a pair is cut when `a` is futile beside `b` without asking whether
 * it has an effect beside anyone else (so the pair gate starts cutting over MAG's dead clicks); `norep` — the
 * partner's click is not kept reachable (see representative()); `twovalued` — a click never informatively tested beside
 * a partner is read as having an effect there (the first version's fold); `megapass` — a mega click's counterfactual is a plain
 * pass, so the mega evolution itself reads as the click's effect. solver/tests/test-gates.js must go red under each.
 */
'use strict';
const P = require('../mag/probe.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';

function create(API, deps) {
  deps = deps || {};
  const COUNTERS = { pairs: 0, cut: 0, kept: 0, futileChecks: 0, otherPartnerScans: 0, budgetStops: 0, uninformativeWorlds: 0, representativesKept: 0, shieldWorlds: 0 };
  const cover = pos => P.cover(pos);
  /* the counterfactual: slot k does nothing — but a mega click still mega-evolves (probe.js PASS_MEGA) */
  const withPass = (j, k) => j.map((x, i) => (i === k ? (x && x.mega && BREAK !== 'megapass' ? P.PASS_MEGA : P.PASS) : x));

  /* 'eff' | 'none' | 'uninf' for slot k's click in joint j against opponent joint o on dice di */
  function effect(pos, j, k, o, di) {
    const r1 = pos.run(j, o, di, { board: true });
    if (!r1.exec[k]) { COUNTERS.uninformativeWorlds++; return 'uninf'; }
    /* the same skip as MAG's: a world where the click's target shielded and the shield held is no evidence, so both
     * gates read one set of worlds the same way (without it a Disable blocked by a Protect still "enabled" the
     * partner's Encore on the user and read as an effect, while MAG had rightly skipped that world — seed 3) */
    if (P.shieldHeld(k, j[k], j[1 - k], o, r1)) { COUNTERS.shieldWorlds++; return 'uninf'; }
    if (!r1.ok[k]) return 'none';
    const r0 = pos.run(withPass(j, k), o, di, { board: true });
    return r1.board !== r0.board ? 'eff' : 'none';
  }

  function futileGiven(pos, k, a, b, lim) {
    pos.fut = pos.fut || new Map();
    const key = k + '@' + P.optKey(a) + '|' + P.optKey(b);
    if (pos.fut.has(key)) return pos.fut.get(key);
    COUNTERS.futileChecks++;
    const j = k === 0 ? [a, b] : [b, a];
    /* THREE ANSWERS, NOT TWO: 'futile' (no effect in any informative world), 'effect' (an effect was SEEN), 'unknown'
     * (no informative world, or the budget ran out). The first version folded 'unknown' into "not futile", and
     * effectBesideOther read "not futile" as "has an effect": a Disable at my own partner, beside that partner's
     * Protect (every world uninformative: the shield always held), was taken as proof the Disable works with SOME
     * partner, and the pair gate then cut it beside all the others while MAG had called it dead (seed 3). */
    let inf = 0, res = null;
    for (const w of cover(pos)) {
      if (P.over(pos, lim)) { COUNTERS.budgetStops++; res = 'unknown'; break; }
      const e = effect(pos, j, k, w.o, w.di);
      if (e === 'uninf') continue;
      inf++;
      if (e === 'eff') { res = 'effect'; break; }
    }
    if (res === null) res = inf > 0 ? 'futile' : 'unknown';
    if (BREAK === 'twovalued' && res === 'unknown') res = 'effect';
    pos.fut.set(key, res);
    return res;
  }

  /* does `a` have an effect beside some partner option other than `b`? */
  function effectBesideOther(pos, k, a, b, lim) {
    if (BREAK === 'pairany') return true;
    pos.oth = pos.oth || new Map();
    const key = k + '@' + P.optKey(a) + '|' + P.optKey(b);
    if (pos.oth.has(key)) return pos.oth.get(key);
    COUNTERS.otherPartnerScans++;
    const sl = pos.la.slots[1 - k];
    const okJ = new Set(pos.la.joint.map(P.jointKey));
    const B = sl ? sl.options.filter(x => P.optKey(x) !== P.optKey(b) && okJ.has(P.jointKey(k === 0 ? [a, x] : [x, a]))) : [];
    let res = false;
    for (const x of B) {
      if (P.over(pos, lim)) { COUNTERS.budgetStops++; res = false; break; }
      if (futileGiven(pos, k, a, x, lim) === 'effect') { res = true; break; }
    }
    pos.oth.set(key, res);
    return res;
  }

  /* THE PARTNER'S CLICK MUST STAY REACHABLE. If the partner's click `b` ends the game, or makes everything slot k can
   * do irrelevant, then EVERY slot-k click is futile beside it — and cutting them all would delete `b`, the very
   * click that made them futile (measured on the first smoke run: a finishing priority move lost every joint it sat
   * in). So a futile pair is cut only while some OTHER slot-k click still stands beside `b`: a switch, a pass or a
   * locked move (never judged here), or a move that is neither MAG-dead nor futile beside `b`. When none does, the
   * slot-k clicks beside `b` are interchangeable, and the first of them in the menu's order that MAG has not cut is
   * kept as the representative. */
  function representative(pos, k, b, lim) {
    pos.rep = pos.rep || new Map();
    const key = k + '|' + P.optKey(b);
    if (pos.rep.has(key)) return pos.rep.get(key);
    const sl = pos.la.slots[k];
    const okJ = new Set(pos.la.joint.map(P.jointKey));
    const side = sl ? sl.options.filter(x => okJ.has(P.jointKey(k === 0 ? [x, b] : [b, x]))) : [];
    let res = null, first = null;
    for (const x of side) {
      if (!P.isMove(x) || x.move === 'struggle') { res = { reachable: true }; break; }
      if (deps.mag && deps.mag.verdict(pos, k, x).v === 'dead') continue;
      if (first == null) first = x;
      if (futileGiven(pos, k, x, b, lim) !== 'futile') { res = { reachable: true }; break; }
    }
    if (!res) { res = { reachable: false, keep: first ? P.optKey(first) : null }; COUNTERS.representativesKept++; }
    pos.rep.set(key, res);
    return res;
  }

  function pairVerdict(pos, j, o) {
    o = o || {};
    COUNTERS.pairs++;
    for (let k = 0; k < j.length && k < 2; k++) {
      const a = j[k], b = j[1 - k];
      if (!P.isMove(a) || a.move === 'struggle' || !b) continue;
      if (futileGiven(pos, k, a, b, o) === 'futile' && effectBesideOther(pos, k, a, b, o)) {
        const rep = BREAK === 'norep' ? { reachable: true } : representative(pos, k, b, o);
        if (!rep.reachable && rep.keep === P.optKey(a)) continue;   // the one kept so that `b` stays reachable
        COUNTERS.cut++;
        return { cut: true, slot: k, why: 'slot ' + k + ' click has no effect beside this partner click, and has one beside another' };
      }
    }
    COUNTERS.kept++;
    return { cut: false };
  }

  return { COUNTERS, pairVerdict, futileGiven, effectBesideOther, BROKEN: BREAK || null };
}

module.exports = { create };
