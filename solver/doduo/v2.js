/* solver/doduo/v2.js — DODUO v2 as a policy: the learned joint scorer (DODUO v1, or a self-play generation's
 * DODUO) over the candidates that survive BOTH dead-click gates.
 *
 *   const V2 = require('./solver/doduo/v2.js').create(API, { rollout, soft, maxSteps, maxMs, need });
 *   const PA2 = V2.wrap(PA)      PA = solver/miltank/prior_adapter.js over any MAG/DODUO model pair
 *   PA2.scoreJoints(ctx, S, side, viewer, la) -> Float64Array   (every other PA method passes through)
 *
 * A drop-in for the prior adapter, so DODUO-greedy (solver/mew/agent.js kind 'greedy') and MILTANK's candidate
 * ranking (solver/miltank/search.js, which scores both sides' joints with its prior) take the gates with no change
 * to either. What the score of each joint becomes:
 *   - a joint holding a click MAG v2 calls DEAD for its slot                          -> 0   (cut)
 *   - a joint DODUO v2's pair gate calls futile TOGETHER                               -> 0   (cut)
 *   - each click MAG v2 calls SOFT (futile only against the bodies now in)            -> x `soft` (default 1e-3)
 *   - everything else                                                                 -> DODUO's own score
 * `soft` is a POLICY CHOICE, not a measurement: "near-zero, not cut" (Will, 2026-09-25). Nothing may be cut to zero:
 * a slot whose every option is dead is not gated, and the pair gate keeps the partner's click reachable
 * (solver/doduo/gate.js representative()).
 *
 * LAZY, BY BRANCH AND BOUND. The gates cost engine steps, and a caller only reads the top of the list: greedy reads
 * the argmax, MILTANK the top k1 (k2) rows plus a reserved switch joint and a mega joint. So the joints are verified
 * in DODUO's order and the walk stops once `need` verified survivors outrank every unverified raw score (the gates
 * only ever LOWER a score). `need` = { all, switch, mega }. `full: true` verifies every joint (the ablation tables).
 * A budget bounds the cost — `maxSteps` engine steps and/or `maxMs` of wall clock per call, the clock starting before
 * DODUO scores: past it a verdict is 'untested' and the joint KEEPS its score — a gate that ran out of time cuts
 * nothing. Every budget stop is counted. Inside MILTANK the gate's time is the search's time (equal wall-clock).
 *
 * WHAT THE GATE MAY SEE. The gate reasons in a WORLD, not the true battle: the viewer's opponent's unrevealed back
 * line is redrawn from its open sheet (solver/miltank/rollout.js sampleWorld, the searcher's own rule), with a second
 * draw kept as the alternative world a would-be hard cut is re-checked in (solver/mag/gate.js). The sleep clock is
 * opened (solver/mag/probe.js). So a gate verdict never uses information the player does not have.
 *
 * COUNTERS (a capability that cannot prove it ran is assumed broken): calls, joints verified, cut by MAG, cut by the
 * pair gate, soft-weighted, slot guards, budget stops, unmapped joints, engine steps, ms.
 */
'use strict';
const PR = require('../mag/probe.js');
const MGm = require('../mag/gate.js');
const DGm = require('./gate.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';

function create(API, deps) {
  deps = deps || {};
  const M = API.M;
  const R = deps.rollout;
  const SOFT = deps.soft == null ? 1e-3 : deps.soft;
  const MAXSTEPS = deps.maxSteps || Infinity;
  const MAXMS = deps.maxMs || Infinity;
  const NEED = Object.assign({ all: 1, switch: 0, mega: 0 }, deps.need || {});
  const probe = PR.create(API);
  const MG = MGm.create(API);
  const DG = DGm.create(API, { mag: MG });
  const COUNTERS = { calls: 0, joints: 0, verified: 0, cutMag: 0, cutPair: 0, softWeighted: 0, slotGuards: 0, budgetStops: 0, unmapped: 0, steps: 0, ms: 0, full: 0 };

  const hashN = (...xs) => { let h = 2166136261 >>> 0; for (const x of xs) h = Math.imul(h ^ (x >>> 0), 16777619) >>> 0; return h; };

  function wrap(PA) {
    function world(ctx, S, side, viewer) {
      const hidden = viewer === 'A' ? 'B' : 'A';
      if (!R) return { W: S, alt: [] };
      const belief = { sheet: ctx.G.sheets[hidden === 'A' ? 'p1' : 'p2'], revealed: PA.revealed(S, hidden) };
      const seed = hashN(S.turn, side === 'A' ? 1 : 2, viewer === 'A' ? 1 : 2, (ctx.hist || []).length);
      const W = R.sampleWorld(S, hidden, belief, M.rngStreams({ seed }).any);
      const W2 = R.sampleWorld(S, hidden, belief, M.rngStreams({ seed: seed + 1 }).any);
      return { W, alt: [W2] };
    }

    function scoreJoints(ctx, S, side, viewer, la, o) {
      o = o || {};
      const t0 = Date.now();
      COUNTERS.calls++;
      const raw = PA.scoreJoints(ctx, S, side, viewer, la);
      const eff = Float64Array.from(raw);
      if (la.joint.length <= 1 || BREAK === 'nogate') { COUNTERS.ms += Date.now() - t0; return eff; }
      const wd = world(ctx, S, side, viewer);
      const pos = probe.position(wd.W, side, { alt: wd.alt, salt: hashN(S.turn, side === 'A' ? 1 : 2) & 0xffff });
      const byKey = new Map(pos.la.joint.map(j => [PR.jointKey(j), j]));
      const ms = o.maxMs || MAXMS;
      const lim = { maxSteps: o.maxSteps || MAXSTEPS, deadline: Number.isFinite(ms) ? t0 + ms : 0 };
      const guard = [null, null];
      const slotAllDead = k => {
        if (guard[k] != null) return guard[k];
        const sl = pos.la.slots[k];
        guard[k] = !!(sl && sl.options.length && sl.options.every(x => MG.verdict(pos, k, x, lim).v === 'dead'));
        if (guard[k]) COUNTERS.slotGuards++;
        return guard[k];
      };
      const done = new Uint8Array(raw.length);
      function verify(i) {
        if (done[i]) return;
        done[i] = 1;
        COUNTERS.verified++;
        const j = byKey.get(PR.jointKey(la.joint[i]));
        if (!j) { COUNTERS.unmapped++; return; }
        let w = 1;
        for (let k = 0; k < j.length && k < 2; k++) {
          const v = MG.verdict(pos, k, j[k], lim);
          if (v.why === 'step budget') COUNTERS.budgetStops++;
          if (v.v === 'dead' && !slotAllDead(k)) { eff[i] = 0; COUNTERS.cutMag++; return; }
          if (v.v === 'soft') { w *= SOFT; COUNTERS.softWeighted++; }
        }
        const pv = DG.pairVerdict(pos, j, lim);
        if (pv.cut) { eff[i] = 0; COUNTERS.cutPair++; return; }
        eff[i] = raw[i] * w;
      }
      const order = Array.from(raw, (_, i) => i).sort((a, b) => raw[b] - raw[a] || a - b);
      function select(filter, need) {
        if (!need) return;
        const best = [];
        for (const i of order) {
          if (!filter(la.joint[i])) continue;
          if (best.length >= need && raw[i] <= best[need - 1]) break;
          verify(i);
          if (eff[i] > 0) { best.push(eff[i]); best.sort((a, b) => b - a); }
        }
      }
      if (o.full || deps.full) { COUNTERS.full++; for (let i = 0; i < raw.length; i++) verify(i); }
      else {
        const need = Object.assign({}, NEED, o.need || {});
        select(() => true, need.all);
        select(j => j.some(x => x && x.kind === 'switch'), need.switch);
        select(j => j.some(x => x && x.mega), need.mega);
      }
      COUNTERS.joints += raw.length;
      COUNTERS.steps += pos.steps;
      COUNTERS.ms += Date.now() - t0;
      return eff;
    }
    return Object.assign({}, PA, { scoreJoints, gated: true, gateCounters: COUNTERS });
  }

  return { wrap, COUNTERS, MG, DG, probe, SOFT, BROKEN: BREAK || null };
}

module.exports = { create };
