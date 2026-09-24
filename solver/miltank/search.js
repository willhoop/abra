/* solver/miltank/search.js — MILTANK v1: the per-turn search skeleton.
 *
 * One decision:
 *   1. CANDIDATES. `legalActions` for both sides (the engine's legal set, never hand-built). Each joint
 *      is scored by the human prior v0 (solver/prior/infer.js through prior_adapter.js) from the
 *      deciding side's own view. The top k1 of mine and k2 of theirs are kept, with SLOTS RESERVED for
 *      switch-containing joints (and one mega joint when a mega is available) — the prior under-rates
 *      switches (solver/LOG.md: switch turns 74.8% at top-16), and a pruner that quietly deletes them
 *      caps every stage after it.
 *   2. CELLS. Each (mine, theirs) pair is filled with short playouts through the MEDICHAM API: a world
 *      (the opponent's unrevealed back line redrawn UNIFORMLY from its sheet — XATU replaces this), one
 *      stepped turn on seeded dice, `depth` random turns, the heuristic leaf. COMMON RANDOM NUMBERS:
 *      pass p of every cell uses the same world and the same dice seed, so a difference between two
 *      cells is the action, not the dice. Passes repeat round-robin until the time budget is spent.
 *   3. SOLVE. The mean matrix goes to SLOWKING (regret matching+). The move is SAMPLED from the row
 *      mix — never the argmax; mixing is the point of a simultaneous-move root.
 *
 *   const MT = require('./solver/miltank/search.js').create(API, { prior: PA, rollout: R });
 *   MT.decide(S, side, ctx, { budgetMs, k1, k2, reserveSwitch, depth, coin, solver:'rm'|'lp', leaf:'heuristic'|'pory2' }) -> { joint, info }
 *   The leaf defaults to env MILTANK_LEAF, else the heuristic. `pory2` = PORYGON2 v0 (PRE-GATE), solver/porygon2/leaf.js.
 *
 * `info` carries the counters for the decision: cells, passes, playouts, unfilled cells, the solved
 * value and SLOWKING's gap, the time spent. A cell with no playout when the clock ran out is filled
 * with the mean of the filled cells and COUNTED (`unfilled`) — never silently.
 */
'use strict';
const LEAF_ENV = (typeof process !== 'undefined' && process.env && process.env.MILTANK_LEAF) || '';
const SK = require('../slowking/matrix.js');
const C = require('./cells.js');

function create(API, deps) {
  const PA = deps.prior, R = deps.rollout;
  const COUNTERS = { decisions: 0, forced: 0, cells: 0, playouts: 0, unfilled: 0, reservedSwitch: 0, reservedMega: 0, rmIters: 0, overBudget: 0, pory2Decisions: 0 };

  function rank(scores, joints, k, reserveSwitch, wantMega) {
    const idx = scores.map((p, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
    const keep = [];
    const has = (i, f) => joints[i].some(f);
    const isSw = o => o && o.kind === 'switch';
    const isMega = o => o && o.mega;
    /* reserved first, so the prior's head cannot crowd them out */
    let sw = 0;
    for (const i of idx) { if (sw >= reserveSwitch) break; if (has(i, isSw)) { keep.push(i); sw++; } }
    COUNTERS.reservedSwitch += sw;
    if (wantMega && !keep.some(i => has(i, isMega))) {
      const i = idx.find(i => has(i, isMega));
      if (i != null) { keep.push(i); COUNTERS.reservedMega++; }
    }
    for (const i of idx) { if (keep.length >= k) break; if (!keep.includes(i)) keep.push(i); }
    return keep.slice(0, Math.max(k, keep.length));
  }

  /* 1. CANDIDATES: legal sets, prior scores, the ranked rows and columns. Consumes no coin. */
  function prepareDecision(S, side, ctx, o) {
    const k1 = o.k1 || 8, k2 = o.k2 || 8;
    const rs = o.reserveSwitch == null ? 2 : o.reserveSwitch;
    const opp = side === 'A' ? 'B' : 'A';
    const laMe = API.legalActions(S, side), laOp = API.legalActions(S, opp);
    if (laMe.joint.length === 1) return { forced: laMe.joint[0] };
    const sMe = PA.scoreJoints(ctx, S, side, side, laMe);
    const sOp = PA.scoreJoints(ctx, S, opp, side, laOp);
    const megaMe = laMe.joint.some(j => j.some(x => x && x.mega));
    const megaOp = laOp.joint.some(j => j.some(x => x && x.mega));
    const rowsI = rank(Array.from(sMe), laMe.joint, k1, rs, megaMe);
    const colsI = rank(Array.from(sOp), laOp.joint, k2, rs, megaOp);
    const rows = rowsI.map(i => laMe.joint[i]), cols = colsI.map(i => laOp.joint[i]);
    const belief = { sheet: ctx.G.sheets[opp === 'A' ? 'p1' : 'p2'], revealed: PA.revealed(S, opp) };
    const job = { S, side, opp, rows, cols, belief, depth: o.depth == null ? 2 : o.depth };
    /* THE LEAF: o.leaf, else env MILTANK_LEAF, else the heuristic. PORYGON2 needs both open sheets (p1 = side A). */
    const leafMode = o.leaf || LEAF_ENV || 'heuristic';
    if (leafMode === 'pory2') { job.leafCtx = { mode: 'pory2', sheets: ctx.G.sheets }; COUNTERS.pory2Decisions++; }
    else if (leafMode !== 'heuristic') throw new Error('MILTANK: unknown leaf ' + leafMode);
    return { job };
  }
  /* 3. SOLVE the mean matrix and sample the row mix. */
  function finishDecision(job, acc, o, t0, budget, coin, extra) {
    const { rows } = job, m = rows.length, n = job.cols.length;
    const { sum, cnt, passes, playouts } = acc;
    let tot = 0, nf = 0;
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (cnt[i][j]) { tot += sum[i][j] / cnt[i][j]; nf++; }
    const mean = nf ? tot / nf : 0.5;
    let unfilled = 0;
    const A = sum.map((r, i) => Array.from(r, (v, j) => (cnt[i][j] ? v / cnt[i][j] : (unfilled++, mean))));
    const sol = o.solver === 'lp' ? SK.solveLP(A) : SK.solveRM(A, { iters: o.rmIters || 4000, tol: 1e-4 });
    const pick = SK.sample(sol.x, coin());
    const ms = Date.now() - t0;
    COUNTERS.cells += m * n; COUNTERS.playouts += playouts; COUNTERS.unfilled += unfilled; COUNTERS.rmIters += sol.iters || 0;
    if (ms > budget * 1.5 + 50) COUNTERS.overBudget++;
    return { joint: rows[pick], info: Object.assign({ m, n, passes, playouts, unfilled, value: sol.value, gap: sol.gap, rm_iters: sol.iters,
             support: sol.x.filter(v => v > 1e-3).length, pick, ms }, extra || {}) };
  }
  function begin(S, side, ctx, o) {
    const t0 = Date.now();
    const budget = o.budgetMs == null ? 1000 : o.budgetMs;
    const coin = o.coin || Math.random;
    COUNTERS.decisions++;
    const d = prepareDecision(S, side, ctx, o);
    if (d.forced) { COUNTERS.forced++; return { done: { joint: d.forced, info: { forced: true, ms: Date.now() - t0 } } }; }
    /* the coin is drawn in the same order in both paths: baseSeed now, the mix sample after the solve */
    d.job.baseSeed = Math.floor(coin() * 1e9);
    return { t0, budget, coin, job: d.job };
  }

  /* 2. CELLS, in this process: solver/miltank/cells.js, passes 0, 1, 2, … */
  function decide(S, side, ctx, o) {
    o = o || {};
    const b = begin(S, side, ctx, o);
    if (b.done) return b.done;
    const acc = C.fillSerial(API, R, b.job, b.t0 + b.budget, o.maxPasses);
    return finishDecision(b.job, acc, o, b.t0, b.budget, b.coin);
  }
  /* 2'. CELLS across worker processes (o.pool = solver/miltank/pool.js). The SAME passes: with a pass cap
   * the matrix, the value and the pick are identical to decide()'s (solver/tests/test-playout-speed.js). */
  async function decideAsync(S, side, ctx, o) {
    o = o || {};
    if (!o.pool) return decide(S, side, ctx, o);
    const b = begin(S, side, ctx, o);
    if (b.done) return b.done;
    const acc = await o.pool.fill(Object.assign({}, b.job, { budgetMs: b.t0 + b.budget - Date.now(), maxPasses: o.maxPasses || 0 }));
    COUNTERS.pooled = (COUNTERS.pooled || 0) + 1;
    return finishDecision(b.job, acc, o, b.t0, b.budget, b.coin, { workers: acc.workers });
  }

  return { COUNTERS, decide, decideAsync, rank };
}

module.exports = { create };
