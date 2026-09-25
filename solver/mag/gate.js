/* solver/mag/gate.js — MAG v2: THE PER-SLOT DEAD-CLICK GATE.
 *
 * MAG no longer scores or ranks (Will, 2026-09-25). Its one job is to remove, per slot, the clicks MEDICHAM can
 * show are futile FOR THAT SLOT WHATEVER ITS PARTNER DOES — and to mark, not remove, the clicks that are futile
 * only while the opponent keeps its current body in. DODUO (solver/doduo/) scores what survives, and carries the
 * PAIR-level gate for combinations that are futile only together.
 *
 *   const G = require('./solver/mag/gate.js').create(API, { probe })
 *   G.verdict(pos, k, opt)  -> { v: 'live'|'soft'|'dead'|'untested'|'na', inf, worlds, why }
 *   G.slotVerdicts(pos)     -> [ Map(optKey -> verdict), Map(...) ]   every option of both of `pos.side`'s slots
 *   pos = probe.position(world, side[, { alt }])   (solver/mag/probe.js)
 *
 * THE VERDICT IS THE ENGINE'S. For a move option `a` in slot k, the gate plays one engine step per WORLD and reads
 * MEDICHAM's own move result for the slot (probe.js: `_mvRes`, Showdown's moveThisTurnResult). No rule about types,
 * statuses or moves is written here. The worlds are a covering design over everything else that can happen this
 * turn: every option my partner has (each at least twice), every option of each opposing slot (each at least twice,
 * each time with a different companion), both dice sets (probe.js: every accuracy roll hits; unpinned).
 *
 *   live      the move SUCCEEDED in some world where the opponent did not switch      -> kept at full weight
 *   soft      it succeeded only in worlds where the opponent switched: futile against the bodies in now, not
 *             against the slot (a move follows the slot) — the "read" plays (a Ground move into a Flying body,
 *             a status move into a statused one). NOT CUT: DODUO gives it a near-zero weight, SLOWKING may still
 *             find its frequency (docs/ALAKAZAM-v2-spec.md, "the gate is a range, not a filter")
 *   dead      it failed in EVERY informative world, whoever moved and however the dice fell: futile for the slot.
 *             CUT. With the opponent's hidden back line unknown (live play), a would-be dead verdict is re-checked in
 *             the probe's alternative worlds (the back line drawn differently); a success there makes it soft
 *   untested  no world was informative (the body never reached its move), or the step budget ran out: KEPT and
 *             COUNTED — a gate that cannot prove a click dead does not cut it
 *   na        not a move the gate judges (a switch, a pass, a locked move, Struggle): kept
 *
 * "Informative" = the body's move result was written (probe.js `exec`): a body KO'd or forced out before it acts
 * tells us nothing about its click, and such a world is skipped rather than counted as a failure.
 *
 * DELIBERATE BREAKS (env GATE_BREAK): `nopartner` — only the partner's first option is tried (the "whatever the
 * partner does" quantifier is gone); `softhard` — a click rescued only by a switch is CUT as dead; `shieldcounts` —
 * a world where the target shielded counts, so a status click at a Protect user reads live.
 * solver/tests/test-gates.js must go red under each.
 */
'use strict';
const P = require('./probe.js');
const X = require('../human/dex.js');
/* a click at a body that raised a Protect-family shield this world: read off the dex (`stallingMove`), never a list */
const SHIELD = new Map();
const isShield = o => {
  if (!o || o.kind !== 'move' || !o.move) return false;
  if (!SHIELD.has(o.move)) { const m = X.D.moves.get(o.move); SHIELD.set(o.move, !!(m && m.exists && m.stallingMove && m.target === 'self')); }
  return SHIELD.get(o.move);
};
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';

function create(API, deps) {
  deps = deps || {};
  const COUNTERS = { verdicts: 0, live: 0, soft: 0, dead: 0, untested: 0, na: 0, budgetStops: 0, altRescued: 0, uninformativeWorlds: 0, shieldWorlds: 0 };
  const ROUNDS = deps.rounds || 2;

  function cover(pos) {
    if (!pos._cover) pos._cover = P.oppCover(pos.lo, 7 + pos.salt, ROUNDS);
    return pos._cover;
  }
  /* my partner's options that can stand beside `a` in one legal joint */
  function partners(pos, k, a) {
    const sl = pos.la.slots[1 - k];
    if (!sl) return [P.PASS];
    const ok = new Set(pos.la.joint.map(P.jointKey));
    const list = sl.options.filter(b => ok.has(P.jointKey(k === 0 ? [a, b] : [b, a])));
    return BREAK === 'nopartner' ? list.slice(0, 1) : list;
  }
  /* the worlds for (k, a): the opponent's cover, stretched so every partner option appears at least ROUNDS times */
  function worlds(pos, k, a, B) {
    const C = cover(pos);
    const n = Math.max(C.length, ROUNDS * B.length);
    const pb = P.perm(B.length, P.hashStr(k + ':' + P.optKey(a)) + pos.salt);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ b: B[pb[i % B.length]], o: C[i % C.length].o, di: i });
    return out;
  }

  function verdict(pos, k, a, o) {
    o = o || {};
    pos.mag = pos.mag || new Map();
    const key = k + '@' + P.optKey(a);
    if (pos.mag.has(key)) return pos.mag.get(key);
    const done = v => { COUNTERS.verdicts++; COUNTERS[v.v]++; pos.mag.set(key, v); return v; };
    if (!P.isMove(a) || a.move === 'struggle') return done({ v: 'na' });
    const B = partners(pos, k, a);
    if (!B.length) return done({ v: 'untested', why: 'no partner option fits beside it' });
    const W = worlds(pos, k, a, B);
    let inf = 0, succSw = false, swInf = 0, n = 0;
    for (const w of W) {
      if (P.over(pos, o)) { COUNTERS.budgetStops++; return done({ v: 'untested', why: 'step budget', worlds: n, inf }); }
      n++;
      const j = k === 0 ? [a, w.b] : [w.b, a];
      /* A WORLD IN WHICH THE TARGET SHIELDED SAYS NOTHING ABOUT THE CLICK. Protect blocks everything, so it is no
       * evidence either way — and MEDICHAM's move result for a STATUS move blocked by a shield reads success where the
       * authority's is null (the known residual of ROADMAP #509, docs/ENGINE.md), which would make every status click
       * at a Protect user look live. The world is skipped, as a world where the body never acted is. */
      const tgtAct = a.target == null ? null : a.target > 0 ? w.o[a.target - 1] : (-a.target - 1 === 1 - k ? w.b : null);
      if (isShield(tgtAct) && BREAK !== 'shieldcounts') { COUNTERS.shieldWorlds++; continue; }
      const r = pos.run(j, w.o, w.di);
      if (!r.exec[k]) { COUNTERS.uninformativeWorlds++; continue; }
      inf++;
      const sw = P.hasSwitch(w.o);
      if (sw) swInf++;
      if (r.ok[k]) {
        if (!sw) return done({ v: 'live', worlds: n, inf });
        succSw = true;
      }
    }
    if (!inf) return done({ v: 'untested', why: 'no informative world', worlds: n, inf });
    if (succSw) return done({ v: BREAK === 'softhard' ? 'dead' : 'soft', worlds: n, inf, why: 'succeeds only when the opponent switches' });
    /* no success anywhere. If the opponent could switch but no switch world was informative, hardness is unshown. */
    const oppCanSwitch = pos.lo.slots.some(s => s && s.options.some(x => x.kind === 'switch'));
    if (oppCanSwitch && !swInf) return done({ v: 'soft', worlds: n, inf, why: 'no informative switch world; not shown dead against a switch-in' });
    /* the hidden back line: re-check the switch worlds in the alternative worlds */
    for (let wi = 1; wi < pos.worlds; wi++) {
      for (const w of W) {
        if (!P.hasSwitch(w.o)) continue;
        const r = pos.run(k === 0 ? [a, w.b] : [w.b, a], w.o, w.di, { world: wi });
        if (r.exec[k] && r.ok[k]) { COUNTERS.altRescued++; return done({ v: 'soft', worlds: n, inf, why: 'a switch-in from another draw of the hidden back line rescues it' }); }
      }
    }
    return done({ v: 'dead', worlds: n, inf, why: 'failed in every informative world' });
  }

  function slotVerdicts(pos, o) {
    return [0, 1].map(k => {
      const m = new Map();
      const sl = pos.la.slots[k];
      if (!sl) return m;
      for (const a of sl.options) m.set(P.optKey(a), verdict(pos, k, a, o));
      return m;
    });
  }

  return { COUNTERS, verdict, slotVerdicts, partners, worlds, BROKEN: BREAK || null };
}

module.exports = { create };
