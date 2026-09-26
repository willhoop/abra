/* solver/mag/gate.js — MAG v2: THE PER-SLOT DEAD-CLICK GATE.
 *
 * MAG no longer scores or ranks (Will, 2026-09-25). Its one job is to remove, per slot, the clicks MEDICHAM can
 * show are futile FOR THAT SLOT WHATEVER ITS PARTNER DOES — and to mark, not remove, the clicks that are futile
 * only while the opponent keeps its current body in. DODUO (solver/doduo/) scores what survives, and carries the
 * PAIR-level gate for combinations that are futile only together.
 *
 * TIERED, 2026-09-26 (Will): 'dead' is ALWAYS BANNED (no branch — the target staying or any switch-in — achieves the
 * click's PURPOSE, solver/mag/purpose.js) and is removed; 'soft' is MOSTLY BANNED (futile against the body in now,
 * achieved only on a switch) and is weighted by the probability of a rescuing switch under the human switch model
 * (solver/doduo/v2.js), not removed. See verdict() below.
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
 * a world where the target's shield held counts, so a status click at a Protect user reads live; `shieldskipall` —
 * every world where the target clicked a shield is skipped, held or not.
 * solver/tests/test-gates.js must go red under each.
 */
'use strict';
const P = require('./probe.js');
const PU = require('./purpose.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';

function create(API, deps) {
  deps = deps || {};
  const COUNTERS = { verdicts: 0, live: 0, soft: 0, dead: 0, untested: 0, na: 0, budgetStops: 0, altRescued: 0, uninformativeWorlds: 0, shieldWorlds: 0, purposeChanged: 0 };

  /* my partner's options that can stand beside `a` in one legal joint */
  function partners(pos, k, a) {
    const sl = pos.la.slots[1 - k];
    if (!sl) return [P.PASS];
    const ok = new Set(pos.la.joint.map(P.jointKey));
    const list = sl.options.filter(b => ok.has(P.jointKey(k === 0 ? [a, b] : [b, a])));
    return BREAK === 'nopartner' ? list.slice(0, 1) : list;
  }
  /* THE WORLDS FOR (k, a): EVERY partner option against EVERY entry of the opponent's covering design — the full
   * product, and the SAME worlds (same joints, same dice) the pair gate asks about, so the two gates read one set of
   * engine answers. The first full run gave MAG only a stretched cover (each partner option twice, beside a random
   * opponent joint) and the pair gate the whole cover per partner: in 6 of 2,000 decisions the pair gate then saw a
   * click SUCCEED (an Encore at my partner after the partner had moved, found when no Fake Out stopped it) that MAG
   * had already called dead. One design for both makes that impossible: a pair-gate effect is a success in a world
   * MAG also played. Interleaved, so a live click still finds its success in the first few worlds. */
  function worlds(pos, k, a, B) {
    const C = P.cover(pos);
    const pb = P.perm(B.length, P.hashStr(k + ':' + P.optKey(a)) + pos.salt);
    const out = [];
    for (let t = 0; t < C.length; t++) for (let i = 0; i < B.length; i++) {
      const c = C[(t + i) % C.length];
      out.push({ b: B[pb[i]], o: c.o, di: c.di });
    }
    return out;
  }

  /* THE PURPOSE, NOT THE RESULT (2026-09-26, Will's tiered gates). A world counts as a success only if the click's
   * PURPOSE was achieved there (solver/mag/purpose.js): the engine's move result for most moves, and for a flinch move
   * the flinch itself. So a Fake Out into a body that cannot flinch fails in every world, and a switch-in can never
   * rescue it (a switch-in has already spent its action on the switch): ALWAYS BANNED. The worlds are unchanged.
   *
   * TWO TIERS, one set of worlds:
   *   dead ("always banned")   no world achieves the purpose — the target staying, or ANY switch-in the opponent has
   *                            (every option of each opposing slot, the switches included, is in the cover; in live
   *                            play the hidden back line is re-checked in alternative worlds that between them put
   *                            every unrevealed sheet member on the bench — solver/doduo/v2.js). REMOVED.
   *   soft ("mostly banned")   achieved only in worlds where the opponent switched. The verdict carries `rescue`: the
   *                            switch options (slot:option) present in a rescuing world ('slot:any' when the rescue
   *                            came from another draw of the hidden back line), so DODUO v2 weights the click by the
   *                            probability that the opponent makes one of them under the human switch model.
   * `v_result` is the verdict the move RESULT alone gives (the 2026-09-25 gate), kept where it differs, so the change
   * the purpose makes is counted rather than asserted. */
  const purposeAt = (pos, a) => PU.purposeOf(a.move);
  /* was click `a` (slot k)'s PURPOSE achieved in the world (j, oj, di[, alternative world wi])? r = that world's plain
   * result. A status move is read off the engine's own move result, like every non-flinch move: the board-diff reading
   * ('effect', 2026-09-26) was a workaround for MEDICHAM ending a Prankster status move refused by a Dark target `true`.
   * The engine ends it `false` since abra/regmc 1.21.0 (release 4067de46a0ee), and on 300 held-out decisions there the
   * workaround changed one verdict of 78, wrongly: a Hypnosis at a fainted slot retargeted onto the live foe and slept it,
   * and the board read the empty slot. Removed 2026-09-26 (docs/_reports/2026-09-26-encore-break-reaim.md). */
  function achievedWorld(pos, k, a, purpose, r) { return PU.achieved(purpose, r, k); }
  /* the same question for ONE given pair of joints (the held-out eval: the human's click against the opponent's actual
   * joint) -> { exec, achieved, result } */
  function achievedAgainst(pos, k, jS, jO, di) {
    const a = jS[k];
    const r = pos.run(jS, jO, di | 0);
    if (!r.exec[k]) return { exec: false, achieved: false, result: false };
    return { exec: true, achieved: achievedWorld(pos, k, a, purposeAt(pos, a), r, jS, jO, di | 0, 0), result: !!r.ok[k] };
  }

  function verdict(pos, k, a, o) {
    o = o || {};
    pos.mag = pos.mag || new Map();
    const key = k + '@' + P.optKey(a);
    if (pos.mag.has(key)) return pos.mag.get(key);
    const done = v => { COUNTERS.verdicts++; COUNTERS[v.v]++; if (v.v_result) COUNTERS.purposeChanged++; pos.mag.set(key, v); return v; };
    if (!P.isMove(a) || a.move === 'struggle') return done({ v: 'na' });
    const B = partners(pos, k, a);
    if (!B.length) return done({ v: 'untested', why: 'no partner option fits beside it' });
    const purpose = purposeAt(pos, a);
    const achievedIn = (r, j, oj, di, wi) => achievedWorld(pos, k, a, purpose, r, j, oj, di, wi);
    const W = worlds(pos, k, a, B);
    const st = { inf: 0, swInf: 0, n: 0 };
    /* p: the purpose; r: the move result alone (read off the same cached engine answers) */
    const T = { p: { live: false, succSw: false, rescue: new Set() }, r: { live: false, succSw: false } };
    const addRescue = (wo, set) => { wo.forEach((x, s) => { if (x && x.kind === 'switch') set.add(s + ':' + P.optKey(x)); }); };
    for (const w of W) {
      if (T.p.live && (purpose === 'result' || T.r.live)) break;
      if (P.over(pos, o)) { COUNTERS.budgetStops++; return done({ v: 'untested', why: 'step budget', worlds: st.n, inf: st.inf, purpose }); }
      st.n++;
      const j = k === 0 ? [a, w.b] : [w.b, a];
      /* A WORLD IN WHICH THE TARGET SHIELDED SAYS NOTHING ABOUT THE CLICK (probe.js shieldHeld; the #509 residual
       * makes a blocked status click read as a success). Skipped only when the shield HELD, by its own move result. */
      const tgtAct = a.target == null ? null : a.target > 0 ? w.o[a.target - 1] : (-a.target - 1 === 1 - k ? w.b : null);
      if (P.isShield(tgtAct) && BREAK === 'shieldskipall') { COUNTERS.shieldWorlds++; continue; }
      const r = pos.run(j, w.o, w.di);
      if (BREAK !== 'shieldcounts' && P.shieldHeld(k, a, w.b, w.o, r)) { COUNTERS.shieldWorlds++; continue; }
      if (!r.exec[k]) { COUNTERS.uninformativeWorlds++; continue; }
      st.inf++;
      const sw = P.hasSwitch(w.o);
      if (sw) st.swInf++;
      if ((!T.p.live || sw) && achievedIn(r, j, w.o, w.di, 0)) { if (!sw) T.p.live = true; else { T.p.succSw = true; addRescue(w.o, T.p.rescue); } }
      if (r.ok[k]) { if (!sw) T.r.live = true; else T.r.succSw = true; }
    }
    if (!st.inf) return done({ v: 'untested', why: 'no informative world', worlds: st.n, inf: st.inf, purpose });
    const oppCanSwitch = pos.lo.slots.some(s => s && s.options.some(x => x.kind === 'switch'));
    /* the hidden back line: re-check the switch worlds in the alternative worlds */
    const altRescue = (pred, set) => {
      for (let wi = 1; wi < pos.worlds; wi++) {
        for (const w of W) {
          if (!P.hasSwitch(w.o)) continue;
          const j = k === 0 ? [a, w.b] : [w.b, a];
          const r = pos.run(j, w.o, w.di, { world: wi });
          if (r.exec[k] && pred(r, j, w.o, w.di, wi)) { if (set) w.o.forEach((x, s) => { if (x && x.kind === 'switch') set.add(s + ':any'); }); return true; }
        }
      }
      return false;
    };
    const classify = (t, pred, set) => {
      if (t.live) return { v: 'live' };
      if (t.succSw) return { v: BREAK === 'softhard' ? 'dead' : 'soft', why: 'achieves its purpose only when the opponent switches' };
      /* no success anywhere. If the opponent could switch but no switch world was informative, hardness is unshown. */
      if (oppCanSwitch && !st.swInf) {
        if (set) pos.lo.slots.forEach((sl, s) => { if (sl && sl.options.some(x => x.kind === 'switch')) set.add(s + ':any'); });
        return { v: 'soft', why: 'no informative switch world; not shown dead against a switch-in' };
      }
      if (altRescue(pred, set)) { if (set) COUNTERS.altRescued++; return { v: 'soft', why: 'a switch-in from another draw of the hidden back line rescues it' }; }
      return { v: 'dead', why: purpose === 'flinch' ? 'no world flinches a body that had not yet acted' : 'failed in every informative world' };
    };
    const vp = classify(T.p, achievedIn, T.p.rescue);
    const out = Object.assign({ worlds: st.n, inf: st.inf, purpose }, vp);
    if (vp.v === 'soft') out.rescue = [...T.p.rescue];
    if (purpose !== 'result') { const vr = classify(T.r, r => r.ok[k], null).v; if (vr !== vp.v) out.v_result = vr; }
    return done(out);
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

  return { COUNTERS, verdict, slotVerdicts, partners, worlds, achievedAgainst, purposeAt, BROKEN: BREAK || null };
}

module.exports = { create };
