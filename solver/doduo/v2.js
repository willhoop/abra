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
 *   - each click MAG v2 calls SOFT (futile only against the bodies now in)            -> x P(a rescuing switch) under the
 *     HUMAN switch model (2026-09-26, the tiered gates; floored at `floor`, default `soft` = 1e-3 — see softWeight)
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
 * THE TIERS (Will, 2026-09-26). A click MAG v2 calls DEAD is ALWAYS BANNED: no world — the target staying or any
 * switch-in — achieves its purpose (solver/mag/purpose.js), and in live play the alternative worlds between them put
 * EVERY unrevealed sheet member on the bench (world(), up to 16 draws). A click MAG calls SOFT is MOSTLY BANNED: weighted
 * by the human switch model's probability that the opponent makes one of the switches that rescued it (softWeight),
 * floored at `floor`. DELIBERATE BREAKS (env GATE_BREAK): `softconst` — the weight is the floor, whatever the model says;
 * `benchone` — no alternative world is drawn. solver/tests/test-gates.js WEIGHT and BENCH must go red.
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
  const COUNTERS = { calls: 0, joints: 0, verified: 0, cutMag: 0, cutPair: 0, softWeighted: 0, slotGuards: 0, budgetStops: 0, unmapped: 0, steps: 0, ms: 0, full: 0,
    /* the tiered gates (2026-09-26): the switch model's calls, its failures (counted, then the floor is used), the soft
     * weights it produced (sum, min, max, how many sat on the floor), and the hidden-bench cover of the alternative worlds */
    switchModelCalls: 0, switchModelFallbacks: 0, softWeightSum: 0, softWeightMin: null, softWeightMax: null, softAtFloor: 0,
    benchCandidates: 0, benchCovered: 0, altWorlds: 0 };
  /* MOSTLY BANNED IS WEIGHTED BY THE HUMAN SWITCH MODEL (Will, 2026-09-26). A soft click's weight is the probability, under
   * the HUMAN joint model (MAG v1 + DODUO v1 by default — fitted on human Reg M-C clicks, deps.switchModel to override),
   * that the opponent makes one of the switches that rescued the click in the gate's worlds; never below FLOOR (the
   * 2026-09-25 constant), so a mostly-banned click is down-weighted and never removed. `soft` (the old constant) is kept
   * only as the floor's default. The opponent's joint distribution is scored in the gate's WORLD (its back line drawn by
   * XATU's rule, rollout.js sampleWorld), from the opponent's own seat, so its switch-ins are the world's bench. */
  const FLOOR = deps.floor == null ? SOFT : deps.floor;
  let HPA = deps.switchPA || null;
  const switchPA = () => {
    if (HPA) return HPA;
    const MAGI = require('../mag/infer.js');
    const PAmod = require('../miltank/prior_adapter.js');
    const pth = require('path');
    const root = pth.join(__dirname, '..', '..');
    const sm = Object.assign({ mag: 'solver/mag/model/mag-v1.json', doduo: 'solver/mag/model/doduo-v1.json' }, deps.switchModel || {});
    HPA = PAmod.create(API, MAGI.load({ mag: pth.resolve(root, sm.mag), doduo: pth.resolve(root, sm.doduo) }));
    return HPA;
  };
  /* the opponent's joint distribution in world W: Map(jointKey -> probability), or null when the model cannot answer */
  function oppDist(ctx, W, opp) {
    COUNTERS.switchModelCalls++;
    try {
      const lo = API.legalActions(W, opp);
      const s = switchPA().scoreJoints(ctx, W, opp, opp, lo);
      let z = 0; for (let i = 0; i < s.length; i++) z += s[i] > 0 ? s[i] : 0;
      if (!(z > 0)) { COUNTERS.switchModelFallbacks++; return null; }
      const m = new Map();
      lo.joint.forEach((j, i) => m.set(PR.jointKey(j), s[i] > 0 ? s[i] / z : 0));
      return m;
    } catch (e) { COUNTERS.switchModelFallbacks++; return null; }
  }
  /* P(the opponent's joint holds a rescuing switch). rescue: ['slot:optKey' | 'slot:any'] from the MAG verdict. */
  function rescueProb(dist, pos, rescue) {
    if (!dist || !rescue || !rescue.length) return null;
    const R0 = new Set(rescue);
    let p = 0;
    for (const j of pos.lo.joint) {
      const hit = j.some((x, s) => x && x.kind === 'switch' && (R0.has(s + ':' + PR.optKey(x)) || R0.has(s + ':any')));
      if (hit) p += dist.get(PR.jointKey(j)) || 0;
    }
    return p;
  }
  function softWeight(v, dist, pos) {
    if (BREAK === 'softconst') return FLOOR;
    const p = rescueProb(dist, pos, v.rescue);
    const w = p == null ? FLOOR : Math.max(FLOOR, Math.min(1, p));
    COUNTERS.softWeightSum += w;
    COUNTERS.softWeightMin = COUNTERS.softWeightMin == null ? w : Math.min(COUNTERS.softWeightMin, w);
    COUNTERS.softWeightMax = COUNTERS.softWeightMax == null ? w : Math.max(COUNTERS.softWeightMax, w);
    if (w === FLOOR) COUNTERS.softAtFloor++;
    return w;
  }

  const hashN = (...xs) => { let h = 2166136261 >>> 0; for (const x of xs) h = Math.imul(h ^ (x >>> 0), 16777619) >>> 0; return h; };

  function wrap(PA) {
    function world(ctx, S, side, viewer) {
      const hidden = viewer === 'A' ? 'B' : 'A';
      if (!R) return { W: S, alt: [] };
      const belief = { sheet: ctx.G.sheets[hidden === 'A' ? 'p1' : 'p2'], revealed: PA.revealed(S, hidden) };
      const seed = hashN(S.turn, side === 'A' ? 1 : 2, viewer === 'A' ? 1 : 2, (ctx.hist || []).length);
      const W = R.sampleWorld(S, hidden, belief, M.rngStreams({ seed }).any);
      /* EVERY POSSIBLE SWITCH-IN (2026-09-26). "Always banned" means no switch-in rescues the click, and with open sheets
       * the candidates are known: every sheet member not yet revealed. The alternative worlds a would-be hard cut is
       * re-checked in are drawn until, between them and W, every candidate has stood on the bench (at most 16 draws; a
       * draw that adds no candidate is dropped). The 2026-09-25 gate kept ONE alternative draw, which could leave a
       * candidate unasked. Coverage is counted (benchCandidates, benchCovered). */
      const sfW = hidden === 'A' ? W.sfA : W.sfB;
      const benchOf = X => { const sf = hidden === 'A' ? X.sfA : X.sfB; return sf.team.filter((m, k) => !belief.revealed.has(k)).map(m => m._solverSheet); };
      const revSheet = new Set([...belief.revealed].map(k => sfW.team[k] && sfW.team[k]._solverSheet));
      /* no hidden slot (all four brought are revealed) = no candidate: the two sheet rows left behind cannot switch in */
      const nHidden = sfW.team.filter((m, k) => !belief.revealed.has(k)).length;
      const cand = new Set(nHidden ? belief.sheet.map((r, s) => s).filter(s => !revSheet.has(s)) : []);
      const seen = new Set(benchOf(W));
      const alt = [];
      if (BREAK !== 'benchone') {
        for (let d = 1; d <= 16 && [...cand].some(s => !seen.has(s)); d++) {
          const X = R.sampleWorld(S, hidden, belief, M.rngStreams({ seed: seed + d }).any);
          const b = benchOf(X);
          if (b.some(s => !seen.has(s))) { alt.push(X); b.forEach(s => seen.add(s)); }
        }
      }
      if (!alt.length && BREAK !== 'benchone') alt.push(R.sampleWorld(S, hidden, belief, M.rngStreams({ seed: seed + 1 }).any));
      COUNTERS.benchCandidates += cand.size;
      COUNTERS.benchCovered += [...cand].filter(s => seen.has(s)).length;
      if ([...cand].some(s => !seen.has(s)) && (COUNTERS.benchShort || (COUNTERS.benchShort = [])).length < 5)
        COUNTERS.benchShort.push({ turn: S.turn, cand: [...cand], seen: [...seen], hiddenSlots: sfW.team.filter((m, k) => !belief.revealed.has(k)).length, team: sfW.team.length });
      COUNTERS.altWorlds += alt.length;
      return { W, alt, cand: [...cand], covered: [...cand].filter(s => seen.has(s)) };
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
      let dist;   // the opponent's joint distribution under the switch model: computed once, on the first soft verdict
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
          if (v.v === 'soft') {
            if (dist === undefined) dist = BREAK === 'softconst' ? null : oppDist(ctx, wd.W, pos.opp);
            w *= softWeight(v, dist, pos); COUNTERS.softWeighted++;
          }
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
    return Object.assign({}, PA, { scoreJoints, gated: true, gateCounters: COUNTERS, gateWorld: world });
  }

  return { wrap, COUNTERS, MG, DG, probe, SOFT, FLOOR, oppDist, rescueProb, softWeight, switchPA, BROKEN: BREAK || null };
}

module.exports = { create };
