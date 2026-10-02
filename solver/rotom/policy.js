/* solver/rotom/policy.js — the pluggable decision policies ROTOM asks for every choice.
 *
 *   const P = require('./policy.js').create({ API, PA, R, MT, tables });
 *   P.move(name, d)        -> { choice, info }   a move request       name: 'random' | 'prior' | 'miltank' | 'miltank-gen5'
 *   P.forceSwitch(name, d) -> { choice, info }   a forced / mid-turn switch request
 *   P.preview(name, d)     -> { order, info }    team preview: four request positions, leads first
 *   P.previewChomp(d)      -> { order, info }    team preview by CHOMP v1 (solver/chomp/v1/chomp1.js; v0 under env CHOMP_VERSION=v0): the option SAMPLED from its
 *                                                mix with d.coin; order = 1-based SHEET indices (the caller maps them to
 *                                                request positions, as for previewSearch). Throws past d.budgetMs.
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
 *   miltank-gen5  the MACHAMP gen5 champion exactly as the HONEST arena measured it (solver/mew/play.js --info honest,
 *            solver/results/2026-09-26-gen5-honest/): MILTANK with gen5's MAG + DODUO as the candidate prior and gen5's
 *            PORYGON2 as the leaf, k and depth from solver/machamp/league/gen5.json (the spec's budgetMs is NOT used —
 *            the clock's budget, capped by the ladder arm, is), lean playouts, the hard deadline (search.js). The belief
 *            is solver/xatu/worlds.js — the same module the honest arena calls: the ROOT position is the world.js
 *            build with every opponent body laid at zero SP under its sheet nature and a revealed body's HP at the
 *            middle of its displayed percentage (XW.publicOpp); each world draws the back pair from XATU's posterior
 *            (d.xatuBack) and every opponent spread from XATU's spread belief (the prior, no observations — as in the
 *            arena). Preview: the rotation team's own human bring, as the arena plays the humans' own bring.
 *            A forced switch scores each candidate with the same searcher at an equal share of the budget.
 *
 * EVERY POLICY'S OUTPUT GOES THROUGH request.isLegal BEFORE IT IS SENT; the caller owns the fallback chain
 * (miltank -> prior -> request heuristic -> `default`) and counts every step of it.
 */
'use strict';
const RQ = require('./request.js');
const T = require('../arena/teams.js');

/* DELIBERATE BREAKS (env ROTOM_POOL_BREAK, solver/tests/test-search-pool.js): `nocount` = a pool fallback is taken but not
 * counted (FALLBACK must go red); `throw` = every pooled move decision takes the fallback path (counted) */
const BREAK_POOL = (typeof process !== 'undefined' && process.env && process.env.ROTOM_POOL_BREAK) || '';

function create(deps) {
  const { API, PA, R, tables } = deps;
  const M = API.M;
  const SK_MT = require('../miltank/search.js');
  const COUNTERS = { move: {}, forceSwitch: {}, preview: {}, unmappedJoints: 0, unmappedBy: {}, unmappedSamples: [], rootFiltered: 0, xatuWorlds: 0, xatuFallback: 0, previewPlayouts: 0, chompSolves: 0,
                     gen5: { decisions: 0, searched: 0, forced: 0, fallbackEmpty: 0, fallbackSparse: 0, noBack: 0, hpLaid: 0, switchScored: 0 },
                     /* the search pool (d.pool, ROTOM --search-workers): pooled decisions and switch scorings, what they played, and every
                      * fallback to the in-process search (a dead or throwing pool), with the first errors */
                     pool: { decisions: 0, switchScored: 0, playouts: 0, passes: 0, idleWorkers: 0, late: 0, fallback: 0, errors: [] } };
  const bump = (k, n) => { COUNTERS[k][n] = (COUNTERS[k][n] || 0) + 1; };

  /* the read-only tap on MILTANK's internals (see payoffTable) — installed once per process */
  const TAP = { on: false, job: null, A: null, sol: null };
  (function installTap() {
    const C = require('../miltank/cells.js'), SK = require('../slowking/matrix.js');
    if (C.__rotomTap) return;
    const f0 = C.fillSerial;
    C.fillSerial = function (api, R, job) { if (TAP.on) TAP.job = job; return f0.apply(this, arguments); };
    for (const k of ['solveRM', 'solveLP', 'solveKL']) {   // solveKL: the human-regularised solve (o.kl) runs AFTER the plain one, so the tap keeps the mix that played
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

  /* ---- HYPNO's in-series memory (2026-10-01): one solver/hypno/series.js per bo3, fed at each game's end ---- */
  const HY_SERIES = new Map();
  COUNTERS.hypno = { decisions: 0, games: 0, observed: 0, disabled: 0, series: 0 };
  function observeGame(o) {
    const cfg = o.hypno || (G5 ? G5.spec.hypno : null);   // the arm's config, else the loaded gen5 spec's
    if (!cfg || !o.bestof) return null;
    const c = cfg === true ? {} : cfg;
    const G = require('../hypno/live.js').gary(c.model);
    const IS = G.M.in_series;
    if (!IS || !IS.enabled) { COUNTERS.hypno.disabled++; return { enabled: false }; }
    let SR = HY_SERIES.get(o.bestof);
    if (!SR) {
      if (HY_SERIES.size > 200) HY_SERIES.delete(HY_SERIES.keys().next().value);
      SR = require('../hypno/series.js').create({ sigma: IS.sigma, gamma: IS.gamma, enabled: true, w0: G.M.mixture_w0 });
      HY_SERIES.set(o.bestof, SR); COUNTERS.hypno.series++;
    }
    const S_ = require('../gary/situation.js');
    const band = c.band || (o.oppRating != null ? S_.bandOfRating(o.oppRating, true) : 'unrated');
    const r = require('../hypno/series_live.js').observeGame(SR, G, o.row, o.opp, o.gnum, band);
    COUNTERS.hypno.games++; COUNTERS.hypno.observed += r.observed;
    return Object.assign({ enabled: true, band }, r);
  }

  /* ---- miltank-gen5: the honest-arena searcher (see the header) ---- */
  let G5 = null;
  function gen5() {
    if (G5) return G5;
    const path = require('path');
    const specFile = deps.gen5Spec || path.join(__dirname, '..', 'machamp', 'league', 'gen5.json');
    const spec = JSON.parse(require('fs').readFileSync(specFile, 'utf8'));
    const AGmod = require('../mew/agent.js');
    const AGm = AGmod.create(API, { rollout: R, buildBody: T.buildBody });
    const A = AGm.load(spec);
    G5 = { spec, specFile, A, PA: A.PA, XW: AGm.XW, leafModel: AGmod.abs(spec.pory2), digests: A.digests };
    return G5;
  }
  /* the honest ROOT and belief on a world.js build: opponent bodies at zero SP under their nature, displayed HP */
  function gen5Root(d, w) {
    const g = gen5();
    const oppSide = w.side === 'A' ? 'B' : 'A', oppP = w.side === 'A' ? 'p2' : 'p1';
    const sheets = w.ctx.G.sheets;
    const pub = new Map((w.theirs || []).map(x => [x.b, x.pub]));
    const before = g.XW.COUNTERS.hpLaid;
    g.XW.publicOpp(w.S, oppSide, sheets[oppP], m => {
      const p = pub.get(m);
      if (!p || !p.seen || p.fnt) return null;
      return (p.max || 100) === 100 ? p.hp : g.XW.pctOf(p.hp, p.max);
    });
    COUNTERS.gen5.hpLaid += g.XW.COUNTERS.hpLaid - before;
    if (!(d.xatuBack && d.xatuBack.length)) COUNTERS.gen5.noBack++;
    return { hb: { back: d.xatuBack || null, spreads: g.XW.spreadPrior(sheets), oppP } };
  }
  function gen5Opts(budgetMs, coin, over) {
    const g = gen5(), s = g.spec;
    return Object.assign({ budgetMs, k1: s.k1, k2: s.k2, depth: s.depth, reserveSwitch: s.reserveSwitch, leaf: 'pory2', leafModel: g.leafModel, coin },
      require('../mew/agent.js').searchExtras(s), over || {});   // the spec's quiesce / flatEps / reserveNoRepeat (2026-09-27)
  }
  function gen5Move(d) {
    const w = d.world;
    if (!w) throw new Error('miltank-gen5: no world');
    const { keep } = filteredLegal(w, d.req);
    if (!keep.length) throw new Error('miltank-gen5: no MEDICHAM joint maps onto the request');
    const g = gen5();
    const { hb } = gen5Root(d, w);
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
    const MT = SK_MT.create(APIp, { prior: g.PA, rollout: g.XW.rollout(hb) });
    COUNTERS.gen5.decisions++;
    TAP.on = true; TAP.job = null; TAP.A = null; TAP.sol = null;
    let r;
    /* HYPNO (spec.hypno, 2026-10-01): the opponent's band from the rating their |player| line carried; without one the search
     * plays the 'unrated' band and counts it (hypnoBandMissing) */
    const hyCfg = d.hypno || g.spec.hypno;
    const hy = hyCfg ? { hypno: Object.assign({}, hyCfg === true ? {} : hyCfg, d.oppRating != null ? { oppRating: d.oppRating } : {},
                                              d.bestof && HY_SERIES.has(d.bestof) ? { series: HY_SERIES.get(d.bestof), gn: d.gnum || 1 } : {}) } : {};
    if (hyCfg) COUNTERS.hypno.decisions++;
    const opts = gen5Opts(d.budgetMs, d.coin, Object.assign({}, d.onPass ? { onPass: d.onPass } : {}, d.record ? { record: true } : {}, d.maxPasses ? { maxPasses: d.maxPasses } : {}, hy));   // d.onPass: the adaptive clock's early stop (solver/rotom/adaptive.js); d.record (2026-09-30, replay probes): the root in r.info.rec
    if (d.pool) { TAP.on = false; return gen5MovePooled(d, w, g, hb, MT, opts); }
    try { r = MT.decide(w.S, w.side, w.ctx, opts); }
    finally { TAP.on = false; }
    return gen5Finish(d, w, g, hb, MT, r, payoffTable(d, w, r));
  }
  /* THE POOLED gen5 DECISION (2026-10-02, docs/_reports/2026-10-02-parallelism.md): the same search, its cells filled by
   * d.pool's worker processes (solver/miltank/pool.js) on the same world sampler (job.world: XATU's honest sampler with this
   * hb, rebuilt in each worker). The payoff table is read from the search's own root record (o.record), not the module tap,
   * because a tap left on across an await could catch another decision's solve. A pool that is dead or throws is a COUNTED
   * fallback (COUNTERS.pool.fallback) to the in-process search on what is left of the budget; d.onPoolDead(why) lets the
   * caller replace the pool off the clock. Returns a Promise. */
  async function gen5MovePooled(d, w, g, hb, MT, opts) {
    const t0 = Date.now(), PC = COUNTERS.pool;
    let r = null, err = null;
    if (BREAK_POOL === 'throw') err = 'deliberate break (ROTOM_POOL_BREAK=throw)';
    else if (!d.pool.alive()) err = 'pool not alive: ' + (d.pool.why() || 'closed');
    else {
      try { r = await MT.decideAsync(w.S, w.side, w.ctx, Object.assign({}, opts, { pool: d.pool, world: worldOf(hb, w.ctx), record: true })); }
      catch (e) { err = String(e && e.message || e).slice(0, 200); }
    }
    if (err != null) {
      if (BREAK_POOL !== 'nocount') PC.fallback++;
      if (PC.errors.length < 10) PC.errors.push(err);
      if (typeof d.onPoolDead === 'function') d.onPoolDead(err);
      const left = Math.max(0, d.budgetMs - (Date.now() - t0));
      TAP.on = true; TAP.job = null; TAP.A = null; TAP.sol = null;
      try { r = MT.decide(w.S, w.side, w.ctx, Object.assign({}, opts, { budgetMs: left })); }
      finally { TAP.on = false; }
      r.info = Object.assign({}, r.info, { pool: { workers: 0, fallback: err } });
      return gen5Finish(d, w, g, hb, MT, r, payoffTable(d, w, r));
    }
    PC.decisions++;
    if (r.info && r.info.pool) { PC.playouts += r.info.playouts || 0; PC.passes += r.info.passes || 0; PC.idleWorkers += r.info.pool.idle_workers || 0; PC.late += r.info.pool.late || 0; }
    const table = tableFromRec(d, w, r);
    if (!d.record && r.info) delete r.info.rec;
    return gen5Finish(d, w, g, hb, MT, r, table);
  }
  /* the world a pool worker samples, as plain data: XATU's back posterior and the two sheets (its spread prior is rebuilt) */
  function worldOf(hb, ctx) { return { kind: 'xatu', back: hb.back || null, oppP: hb.oppP, sheets: ctx.G.sheets }; }
  function tableFromRec(d, w, r) {
    const rec = r.info && r.info.rec;
    if (!rec) return r.info && r.info.forced ? { forced: true } : null;
    const r3 = v => Math.round(v * 1000) / 1000;
    const rowLabel = j => { const m = RQ.fromEngine(d.req, j, w.posOfTeam); return m.some(x => !x) ? engLabel(j) : RQ.joinChoice(m); };
    return { rows: rec.rows.map(rowLabel), cols: rec.cols.map(engLabel), A: rec.A.map(row => Array.from(row, r3)), mix: rec.x.map(r3),
             row_mean: rec.A.map(row => r3(Array.from(row).reduce((s, v) => s + v, 0) / Math.max(1, row.length))),
             value: r.info.value == null ? null : r3(r.info.value), gap: r.info.gap == null ? null : r3(r.info.gap), pick: r.info.pick };
  }
  function gen5Finish(d, w, g, hb, MT, r, table) {
    if (r.info && r.info.forced) COUNTERS.gen5.forced++; else COUNTERS.gen5.searched++;
    COUNTERS.gen5.fallbackEmpty += MT.COUNTERS.fallbackEmpty; COUNTERS.gen5.fallbackSparse += MT.COUNTERS.fallbackSparse;
    const mapped = RQ.fromEngine(d.req, r.joint, w.posOfTeam);
    if (mapped.some(x => !x)) throw new Error('miltank-gen5: chosen joint does not map');
    return { choice: RQ.joinChoice(mapped), info: Object.assign({ counters: MT.COUNTERS, gen5: g.digests, honest: { back: !!hb.back, worlds: g.XW.COUNTERS.worlds } }, r.info, { table }) };
  }

  function move(name, d) {
    bump('move', name);
    if (name === 'random') return { choice: randomChoice(d.req, d.coin), info: {} };
    if (name === 'prior') return priorMove(d);
    if (name === 'miltank') return miltankMove(d, d.budgetMs);
    if (name === 'miltank-gen5') return gen5Move(d);
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
    /* each candidate gets an EQUAL SHARE of the budget, never a floor above it: the first version gave each at least
     * 150 ms, so J candidates could spend J x 150 ms against a smaller budget (docs/_reports/2026-09-25-miltank-deadline.md).
     * Under 150 ms a share is too thin to search, and the prior floor below answers instead. */
    const per = Math.floor(d.budgetMs / J.length);
    const g5 = name === 'miltank-gen5' && d.world && d.budgetMs > 300 && per >= 150 ? gen5Root(d, d.world) : null;
    if ((name === 'miltank' || g5) && d.world && d.budgetMs > 300 && per >= 150) {
      /* each candidate replacement: put it in the slot, ask MILTANK for the value of the next turn */
      const scored = [], jobs = [];
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
        jobs.push({ j, W });
      }
      const ctx = d.world.ctx;
      const mk = () => (g5 ? SK_MT.create(API, { prior: gen5().PA, rollout: gen5().XW.rollout(g5.hb) }) : SK_MT.create(API, { prior: PA, rollout: xatuRollout(d) }));
      const optsOf = () => (g5 ? gen5Opts(per, d.coin) : { budgetMs: per, k1: 6, k2: 6, depth: 2, coin: d.coin });
      const pick = extra => {
        if (!scored.length) return null;
        scored.sort((a, b) => b.v - a.v);
        return { choice: RQ.joinChoice(scored[0].j), info: Object.assign({ values: scored.map(s => ({ c: RQ.joinChoice(s.j), v: +s.v.toFixed(3) })) }, extra || {}) };
      };
      /* POOLED (gen5 only, d.pool): each candidate's search fills its cells in the pool, one after another; a failure is the
       * counted in-process fallback for that candidate and every later one. Returns a Promise. */
      if (g5 && d.pool) return (async () => {
        let pooled = !!d.pool.alive() && BREAK_POOL !== 'throw', fell = pooled ? null : (BREAK_POOL === 'throw' ? 'deliberate break (ROTOM_POOL_BREAK=throw)' : 'pool not alive: ' + (d.pool.why() || 'closed'));
        if (fell) { if (BREAK_POOL !== 'nocount') COUNTERS.pool.fallback++; if (COUNTERS.pool.errors.length < 10) COUNTERS.pool.errors.push(fell); if (typeof d.onPoolDead === 'function') d.onPoolDead(fell); }
        const byWorker = [];
        for (const { j, W } of jobs) {
          try {
            const MT = mk();
            let r = null;
            if (pooled) {
              try { r = await MT.decideAsync(W, d.world.side, ctx, Object.assign(optsOf(), { pool: d.pool, world: worldOf(g5.hb, ctx) })); }
              catch (e) { pooled = false; fell = String(e && e.message || e).slice(0, 200); if (BREAK_POOL !== 'nocount') COUNTERS.pool.fallback++; if (COUNTERS.pool.errors.length < 10) COUNTERS.pool.errors.push(fell); if (typeof d.onPoolDead === 'function') d.onPoolDead(fell); }
            }
            if (!r) r = MT.decide(W, d.world.side, ctx, optsOf());
            else { COUNTERS.pool.switchScored++; COUNTERS.pool.playouts += r.info.playouts || 0; COUNTERS.pool.passes += r.info.passes || 0; if (r.info.pool) byWorker.push(r.info.pool.playouts_by_worker); }
            COUNTERS.gen5.switchScored++;
            scored.push({ j, v: r.info.value != null ? r.info.value : 0.5 });
          } catch (e) { scored.push({ j, v: -1, err: String(e.message || e).slice(0, 120) }); }
        }
        const sumBy = byWorker.length ? byWorker[0].map((_, k) => byWorker.reduce((s, a) => s + (a[k] || 0), 0)) : [];
        const out = pick({ pool: { workers: fell && !byWorker.length ? 0 : d.pool.workers, scored_pooled: byWorker.length, playouts_by_worker: sumBy, fallback: fell || undefined } });
        return out || healthiest();
      })();
      for (const { j, W } of jobs) {
        try {
          const MT = mk();
          const r = MT.decide(W, d.world.side, ctx, optsOf());
          if (g5) COUNTERS.gen5.switchScored++;
          scored.push({ j, v: r.info.value != null ? r.info.value : 0.5 });
        } catch (e) { scored.push({ j, v: -1, err: String(e.message || e).slice(0, 120) }); }
      }
      const out = pick();
      if (out) return out;
    }
    return healthiest();
    function healthiest() {
      /* prior (and the miltank floor): the healthiest bench bodies */
      const sc = j => j.reduce((s, o) => s + (o.kind === 'switch' ? 1 + hpFrac(mons[o.pos - 1]) : 0), 0);
      let best = J[0]; for (const j of J) if (sc(j) > sc(best)) best = j;
      return { choice: RQ.joinChoice(best), info: { rule: 'healthiest bench' } };
    }
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
    if (name === 'prior' || name === 'miltank-gen5' || !(d.budgetMs > 1500)) return { order: human.map(x => x + 1), info: { rule: 'the pool team\'s own human bring and leads' } };
    return { order: null, info: null, search: true, human };
  }

  /* CHOMP-lite v0 (PRE-GATE, a stand-in until CHOMP exists): every one of the 90 bring/lead options scored by random
   * playouts in MEDICHAM against the opponent's options — sampled from their previous game in this series with the
   * store's carry-over rates (tables.json bo3, by their previous result), uniform otherwise — with successive halving. */
  const PV_BUILD = {};
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
    /* mine at the truth builder (the spread the arena and the ladder rotations field, role-v1), theirs PUBLIC (zero SP under the
     * sheet's nature): the same two builders the turn search uses (abra/regmc 1.69.0) */
    PV_BUILD.m = PV_BUILD.m || T.bodyBuilder(M, { view: 'truth' }); PV_BUILD.o = PV_BUILD.o || T.bodyBuilder(M, { view: 'public' });
    const body = (sheet, s, tag) => { const k = tag + s; if (!cache.has(k)) cache.set(k, PV_BUILD[tag](M, sheet[s])); const b = cache.get(k); if (!b) return null; const c = structuredClone(b); c._solverSheet = s; return c; };
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

  /* warm the gen5 searcher before a clock runs: the nets, the PORYGON2 leaf, XATU's spread belief (the checkout's sim) */
  function warmGen5(S, ctx, coin) {
    const g = gen5();
    const hb = { back: null, spreads: g.XW.spreadPrior(ctx.G.sheets), oppP: 'p2' };
    const MT = SK_MT.create(API, { prior: g.PA, rollout: g.XW.rollout(hb) });
    return MT.decide(S, 'A', ctx, gen5Opts(1500, coin));
  }

  /* ---- CHOMP at team preview (rotom.js --preview chomp) ----
   * CHOMP v1 (solver/chomp/v1/chomp1.js: the learned cell scorer, SLOWKING, and the bo3 adjustment from the series'
   * previous game) unless env CHOMP_VERSION=v0 asks for v0 (solver/chomp/chomp.js). The series is passed through, so a
   * game-2/3 preview is adjusted to what the opponent brought before; `info.model` and `info.bo3` say what answered. */
  let CH = null;
  function previewChomp(d) {
    const me = d.me, mine = d.sheets && d.sheets[me], theirs = d.sheets && d.sheets[me === 'p1' ? 'p2' : 'p1'];
    if (!mine || !theirs) throw new Error('chomp: both open sheets are needed');
    CH = CH || require(process.env.CHOMP_VERSION === 'v0' ? '../chomp/chomp.js' : '../chomp/v1/chomp1.js').create({ API });
    const r = CH.solve({ mine, theirs }, { deadline: Date.now() + (d.budgetMs || 0), series: d.series });
    const op = CH.sample(r, d.coin());
    COUNTERS.chompSolves++;
    return { order: op.order.map(x => x + 1), info: { chomp: true, model: r.model || null, bo3: !!r.bo3, option: op.i, label: op.label, p: +r.mix[op.i].toFixed(4), v: +r.value.toFixed(4),
      vsMix: +r.win[op.i].vsMix.toFixed(4), support: r.support.length, cells: r.counters.cells, ms: r.ms } };
  }

  return { COUNTERS, move, forceSwitch, preview, previewSearch, previewChomp, randomChoice, filteredLegal, allOptions, gen5, warmGen5, observeGame, HY_SERIES,
           POLICIES: ['random', 'prior', 'miltank', 'miltank-gen5'], SEARCH: ['miltank', 'miltank-gen5'] };
}

module.exports = { create };
