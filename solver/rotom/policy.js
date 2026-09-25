/* solver/rotom/policy.js — the pluggable decision policies ROTOM asks for every choice.
 *
 *   const P = require('./policy.js').create({ API, PA, R, MT, tables });
 *   P.move(name, d)        -> { choice, info }   a move request       name: 'random' | 'prior' | 'miltank'
 *   P.forceSwitch(name, d) -> { choice, info }   a forced / mid-turn switch request
 *   P.preview(name, d)     -> { order, info }    team preview: four request positions, leads first
 *
 * `d` is the decision: { req, world (world.js build, or null if the world failed), budgetMs, coin, series, sheets, me, xatu }.
 *
 *   random   uniform over the REQUEST's legal joints (solver/rotom/request.js) — the "random legal" baseline.
 *   prior    DODUO greedy: MAG v1 + DODUO v1 (solver/mag/infer.js) through solver/miltank/prior_adapter.js, the
 *            argmax joint among MEDICHAM's legal joints that the request also allows. No search.
 *   miltank  MILTANK v1 (solver/miltank/search.js) at the clock's budget, lean playouts (rollout.js), its root
 *            candidate set restricted to joints the request allows (a proxied `legalActions` at the root only).
 *            The opponent's unrevealed back line in each world is drawn from XATU's back-pair posterior (which
 *            carries the bo3 series features) instead of MILTANK's uniform draw, when XATU has one.
 *
 * EVERY POLICY'S OUTPUT GOES THROUGH request.isLegal BEFORE IT IS SENT; the caller owns the fallback chain
 * (miltank -> prior -> request heuristic -> `default`) and counts every step of it.
 */
'use strict';
const RQ = require('./request.js');
const T = require('../arena/teams.js');

function create(deps) {
  const { API, PA, R, tables } = deps;
  const M = API.M;
  const SK_MT = require('../miltank/search.js');
  const COUNTERS = { move: {}, forceSwitch: {}, preview: {}, unmappedJoints: 0, unmappedBy: {}, unmappedSamples: [], rootFiltered: 0, xatuWorlds: 0, xatuFallback: 0, previewPlayouts: 0 };
  const bump = (k, n) => { COUNTERS[k][n] = (COUNTERS[k][n] || 0) + 1; };

  /* the read-only tap on MILTANK's internals (see payoffTable) — installed once per process */
  const TAP = { on: false, job: null, A: null, sol: null };
  (function installTap() {
    const C = require('../miltank/cells.js'), SK = require('../slowking/matrix.js');
    if (C.__rotomTap) return;
    const f0 = C.fillSerial;
    C.fillSerial = function (api, R, job) { if (TAP.on) TAP.job = job; return f0.apply(this, arguments); };
    for (const k of ['solveRM', 'solveLP']) {
      const s0 = SK[k];
      if (typeof s0 !== 'function') continue;
      SK[k] = function (A) { const sol = s0.apply(this, arguments); if (TAP.on) { TAP.A = A; TAP.sol = sol; } return sol; };
    }
    Object.defineProperty(C, '__rotomTap', { value: true });
  })();
  const engLabel = j => (j || []).map(o => !o ? '-' : o.kind === 'switch' ? 'switch ' + o.to : o.kind === 'pass' ? 'pass'
    : String(o.move || o.kind) + (o.target != null ? ' ' + o.target : '') + (o.mega ? ' mega' : '')).join(', ');

  /* ---- MEDICHAM joints the request allows ---- */
  function filteredLegal(w, req) {
    const la = API.legalActions(w.S, w.side);
    const keep = [];
    for (const j of la.joint) {
      const mapped = RQ.fromEngine(req, j, w.posOfTeam);
      if (mapped.some(x => !x)) {
        COUNTERS.unmappedJoints++;
        const k = mapped.findIndex(x => !x), o = j[k];
        const why = o.kind === 'switch' ? 'switch' : o.mega ? 'mega' : o.target != null ? 'target' : 'move';
        COUNTERS.unmappedBy[why] = (COUNTERS.unmappedBy[why] || 0) + 1;
        if (COUNTERS.unmappedSamples.length < 8) COUNTERS.unmappedSamples.push({ engine: o.choice || o.kind, move: o.move, target: o.target, mega: o.mega, request: (RQ.options(req)[k] || { options: [] }).options.map(x => x.choice).slice(0, 12) });
        continue;
      }
      const c = RQ.joinChoice(mapped);
      if (!RQ.isLegal(req, c)) { COUNTERS.unmappedJoints++; continue; }
      keep.push({ j, c });
    }
    return { la, keep };
  }

  function randomChoice(req, coin) {
    const J = RQ.joints(req);
    return J.length ? RQ.joinChoice(J[Math.floor(coin() * J.length)]) : null;
  }

  function priorMove(d) {
    const w = d.world;
    if (!w) throw new Error('prior: no world');
    const { la, keep } = filteredLegal(w, d.req);
    if (!keep.length) throw new Error('prior: no MEDICHAM joint maps onto the request');
    const sub = { side: la.side, kind: la.kind, slots: la.slots, joint: keep.map(x => x.j) };
    const s = PA.scoreJoints(w.ctx, w.S, w.side, w.side, sub);
    let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
    return { choice: keep[b].c, info: { p: s[b], candidates: keep.length, engineJoints: la.joint.length } };
  }

  /* MILTANK with the root restricted to request-legal joints, and XATU worlds */
  function miltankMove(d, budgetMs) {
    const w = d.world;
    if (!w) throw new Error('miltank: no world');
    const { keep } = filteredLegal(w, d.req);
    if (!keep.length) throw new Error('miltank: no MEDICHAM joint maps onto the request');
    const allowed = new Map(keep.map(x => [x.j, x.c]));
    const rootS = w.S, rootSide = w.side;
    const APIp = new Proxy(API, { get(t, k) {
      if (k === 'legalActions') return (S, side) => {
        const la = API.legalActions(S, side);
        if (S !== rootS || side !== rootSide) return la;
        const joint = la.joint.filter(j => { const m = RQ.fromEngine(d.req, j, w.posOfTeam); return !m.some(x => !x) && RQ.isLegal(d.req, RQ.joinChoice(m)); });
        COUNTERS.rootFiltered += la.joint.length - joint.length;
        return { side: la.side, kind: la.kind, slots: la.slots, joint };
      };
      return t[k];
    } });
    const Rx = xatuRollout(d);
    const MT = SK_MT.create(APIp, { prior: PA, rollout: Rx });
    TAP.on = true; TAP.job = null; TAP.A = null; TAP.sol = null;
    let r;
    try { r = MT.decide(w.S, w.side, w.ctx, { budgetMs, k1: d.k1 || 8, k2: d.k2 || 8, depth: d.depth == null ? 2 : d.depth, coin: d.coin }); }
    finally { TAP.on = false; }
    const mapped = RQ.fromEngine(d.req, r.joint, w.posOfTeam);
    if (mapped.some(x => !x)) throw new Error('miltank: chosen joint does not map');
    return { choice: RQ.joinChoice(mapped), info: Object.assign({ counters: MT.COUNTERS }, r.info, { table: payoffTable(d, w, r) }) };
  }

  /* THE PAYOFF TABLE, FOR THE GAME RECORD. search.js returns only the chosen joint, so the candidate rows and
   * columns and the solved mix are read by tapping the two module functions it calls through their exports
   * (cells.fillSerial gets the job; slowking/matrix solveRM|solveLP gets the matrix and returns the mix).
   * The tap only records; it never changes an argument or a result. */
  function payoffTable(d, w, r) {
    if (!TAP.job || !TAP.A || !TAP.sol) return r.info && r.info.forced ? { forced: true } : null;
    const r3 = v => Math.round(v * 1000) / 1000;
    const rowLabel = j => { const m = RQ.fromEngine(d.req, j, w.posOfTeam); return m.some(x => !x) ? engLabel(j) : RQ.joinChoice(m); };
    const x = Array.from(TAP.sol.x || []);
    return {
      rows: TAP.job.rows.map(rowLabel), cols: TAP.job.cols.map(engLabel),
      A: TAP.A.map(row => Array.from(row, r3)), mix: x.map(r3),
      row_mean: TAP.A.map(row => r3(Array.from(row).reduce((s, v) => s + v, 0) / Math.max(1, row.length))),
      value: TAP.sol.value == null ? null : r3(TAP.sol.value), gap: TAP.sol.gap == null ? null : r3(TAP.sol.gap), pick: r.info ? r.info.pick : null,
    };
  }

  /* the rollout with XATU's back-pair posterior deciding who fills the opponent's unrevealed slots */
  function xatuRollout(d) {
    const bt = d.xatuBack;   // [{pair:[i,j], p}] over the opponent's six sheet rows, or null
    if (!bt || !bt.length) return R;
    return Object.assign({}, R, { sampleWorld(S, oppSide, belief, coin) {
      const W = API.clone(S);
      const sf = oppSide === 'A' ? W.sfA : W.sfB;
      const hidden = []; for (let k = 0; k < sf.team.length; k++) if (!belief.revealed.has(k)) hidden.push(k);
      if (!hidden.length) return W;
      const revSheet = new Set([...belief.revealed].map(k => sf.team[k]._solverSheet));
      let u = coin(), acc = 0, pair = bt[bt.length - 1].pair;
      for (const x of bt) { acc += x.p; if (u <= acc) { pair = x.pair; break; } }
      const fill = pair.filter(s => !revSheet.has(s));
      if (fill.length < hidden.length) { COUNTERS.xatuFallback++; return R.sampleWorld(S, oppSide, belief, coin); }
      hidden.forEach((k, i) => { const nb = R.body(belief.sheet[fill[i]], fill[i]); if (nb) R.swapBody(W, oppSide, k, nb); });
      COUNTERS.xatuWorlds++;
      return W;
    } });
  }

  function move(name, d) {
    bump('move', name);
    if (name === 'random') return { choice: randomChoice(d.req, d.coin), info: {} };
    if (name === 'prior') return priorMove(d);
    if (name === 'miltank') return miltankMove(d, d.budgetMs);
    throw new Error('unknown policy ' + name);
  }

  /* ---- forced switches ---- */
  const hpFrac = p => { const c = String(p.condition || ''); const m = /^(\d+)\/(\d+)/.exec(c); return m ? +m[1] / +m[2] : 0; };
  function forceSwitch(name, d) {
    bump('forceSwitch', name);
    const req = d.req;
    const J = RQ.joints(req);
    if (!J.length) return { choice: null, info: {} };
    if (J.length === 1) return { choice: RQ.joinChoice(J[0]), info: { only: true } };
    if (name === 'random') return { choice: RQ.joinChoice(J[Math.floor(d.coin() * J.length)]), info: {} };
    const mons = req.side.pokemon;
    if (name === 'miltank' && d.world && d.budgetMs > 300) {
      /* each candidate replacement: put it in the slot, ask MILTANK for the value of the next turn */
      const per = Math.max(150, Math.floor(d.budgetMs / J.length));
      const scored = [];
      for (const j of J) {
        const W = API.clone(d.world.S);
        const act = d.world.side === 'A' ? W.actA : W.actB, bench = d.world.side === 'A' ? W.benchA : W.benchB, sf = d.world.side === 'A' ? W.sfA : W.sfB;
        let ok = true;
        j.forEach((o, i) => {
          if (o.kind !== 'switch') return;
          const want = mons[o.pos - 1];
          const b = sf.team.find(m => d.world.posOfSheet.get(m._solverSheet) === o.pos);
          if (!b || !want) { ok = false; return; }
          const bi = bench.indexOf(b);
          const out = act[i];
          act[i] = b; if (bi >= 0) bench[bi] = out;
        });
        if (!ok) continue;
        try {
          const MT = SK_MT.create(API, { prior: PA, rollout: xatuRollout(d) });
          const ctx = d.world.ctx;
          const r = MT.decide(W, d.world.side, ctx, { budgetMs: per, k1: 6, k2: 6, depth: 2, coin: d.coin });
          scored.push({ j, v: r.info.value != null ? r.info.value : 0.5 });
        } catch (e) { scored.push({ j, v: -1, err: String(e.message || e).slice(0, 120) }); }
      }
      if (scored.length) {
        scored.sort((a, b) => b.v - a.v);
        return { choice: RQ.joinChoice(scored[0].j), info: { values: scored.map(s => ({ c: RQ.joinChoice(s.j), v: +s.v.toFixed(3) })) } };
      }
    }
    /* prior (and the miltank floor): the healthiest bench bodies */
    const sc = j => j.reduce((s, o) => s + (o.kind === 'switch' ? 1 + hpFrac(mons[o.pos - 1]) : 0), 0);
    let best = J[0]; for (const j of J) if (sc(j) > sc(best)) best = j;
    return { choice: RQ.joinChoice(best), info: { rule: 'healthiest bench' } };
  }

  /* ---- team preview ---- */
  const combos = (a, k) => { const out = []; const rec = (s, pre) => { if (pre.length === k) { out.push(pre); return; } for (let i = s; i < a.length; i++) rec(i + 1, pre.concat([a[i]])); }; rec(0, []); return out; };
  function allOptions(n) {   // 90 for six: four brought, the first two lead (lead order and back order do not matter here)
    const out = [];
    for (const four of combos([...Array(n).keys()], 4)) for (const leads of combos(four, 2)) out.push(leads.concat(four.filter(x => !leads.includes(x))));
    return out;
  }
  function preview(name, d) {
    bump('preview', name);
    const n = d.req.side.pokemon.length;
    if (name === 'random') { const a = [...Array(n).keys()]; for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(d.coin() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return { order: a.slice(0, 4).map(x => x + 1), info: {} }; }
    const human = d.teamBring && d.teamBring.length === 4 ? d.teamBring.slice() : [0, 1, 2, 3];
    if (name === 'prior' || !(d.budgetMs > 1500)) return { order: human.map(x => x + 1), info: { rule: 'the pool team\'s own human bring and leads' } };
    return { order: null, info: null, search: true, human };
  }

  /* CHOMP-lite v0 (PRE-GATE, a stand-in until CHOMP exists): every one of the 90 bring/lead options scored by random
   * playouts in MEDICHAM against the opponent's options — sampled from their previous game in this series with the
   * store's carry-over rates (tables.json bo3, by their previous result), uniform otherwise — with successive halving. */
  function previewSearch(d, human) {
    const t0 = Date.now(), deadline = t0 + d.budgetMs;
    const mySheet = d.sheets[d.me], opSheet = d.sheets[d.me === 'p1' ? 'p2' : 'p1'];
    const mine = allOptions(mySheet.length);
    const theirOpts = allOptions(opSheet.length);
    const prev = d.series && d.series.oppLast;   // { brought:[sheet idx], leads:[sheet idx], won: bool }
    const bo3 = tables && tables.bo3;
    const sampleOpp = () => {
      if (prev && bo3 && prev.brought && prev.brought.length === 4) {
        const res = prev.won ? 'won' : 'lost';
        let four = prev.brought.slice();
        if (d.coin() >= bo3.same_four[res]) { const all = [...Array(opSheet.length).keys()]; four = combos(all, 4)[Math.floor(d.coin() * 15)]; }
        let leads = (prev.leads || []).filter(x => four.includes(x));
        if (leads.length !== 2 || d.coin() >= bo3.same_lead_pair[res]) { const lp = combos(four, 2); leads = lp[Math.floor(d.coin() * lp.length)]; }
        return leads.concat(four.filter(x => !leads.includes(x)));
      }
      return theirOpts[Math.floor(d.coin() * theirOpts.length)];
    };
    const cache = new Map();
    const body = (sheet, s, tag) => { const k = tag + s; if (!cache.has(k)) cache.set(k, T.buildBody(M, sheet[s])); const b = cache.get(k); if (!b) return null; const c = structuredClone(b); c._solverSheet = s; return c; };
    const A = d.me === 'p1';
    const play = (myOrder, opOrder, seed) => {
      const tm = myOrder.map(s => body(mySheet, s, 'm')), to = opOrder.map(s => body(opSheet, s, 'o'));
      if (tm.some(x => !x) || to.some(x => !x)) return null;
      const rng = M.rngStreams({ seed });
      const coin = M.rngStreams({ seed: seed + 7919 }).any;
      const S = A ? API.newBattle(tm, to, { rng, lean: true }) : API.newBattle(to, tm, { rng, lean: true });
      const v = API.leanRun(() => {
        for (let t = 0; t < 12 && !API.isTerminal(S); t++) API.stepInPlace(S, R.randomJoint(S, 'A', coin), R.randomJoint(S, 'B', coin), rng);
        return R.leaf(S);
      });
      COUNTERS.previewPlayouts++;
      return A ? v : 1 - v;
    };
    let cand = mine.map(o => ({ o, s: 0, n: 0 }));
    let round = 0, seed = Math.floor(d.coin() * 1e9);
    while (cand.length > 1 && Date.now() < deadline) {
      const per = 4 << round;
      for (const c of cand) {
        for (let k = 0; k < per && Date.now() < deadline; k++) { const v = play(c.o, sampleOpp(), seed++); if (v != null) { c.s += v; c.n++; } }
        if (Date.now() >= deadline) break;
      }
      cand.forEach(c => { c.m = c.n ? c.s / c.n : -1; });
      cand.sort((a, b) => b.m - a.m);
      if (Date.now() >= deadline) break;
      cand = cand.slice(0, Math.max(1, Math.ceil(cand.length / 3)));
      round++;
    }
    cand.forEach(c => { c.m = c.n ? c.s / c.n : -1; });
    cand.sort((a, b) => b.m - a.m);
    const best = cand[0] && cand[0].n ? cand[0].o : human;
    return { order: best.map(x => x + 1), info: { rounds: round, top: cand.slice(0, 3).map(c => ({ o: c.o, m: +c.m.toFixed(3), n: c.n })), oppModel: prev ? 'series carry-over' : 'uniform', ms: Date.now() - t0 } };
  }

  return { COUNTERS, move, forceSwitch, preview, previewSearch, randomChoice, filteredLegal, allOptions };
}

module.exports = { create };
