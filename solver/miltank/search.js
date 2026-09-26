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
 *   MT.decide(S, side, ctx, { budgetMs, k1, k2, reserveSwitch, depth, coin, solver:'rm'|'lp', leaf:'heuristic'|'pory2', leafModel, record, quiesce }) -> { joint, info }
 *   quiesce = true | 'all': every playout plays one extension turn (each side carries on with its plan) before the leaf;
 *   'held': only a playout in which a protect-family use HELD (the horizon fix, docs/_reports/2026-09-27-protect-repeat-fix.md;
 *   solver/miltank/rollout.js QUIESCENCE). Off by default.
 *   flatEps = e: when every played cell is within e of every other, play the ranking prior's top joint (counted flatPrior).
 *   reserveNoRepeat = true: the reserved mega row is the prior's best mega joint that repeats no Protect, when one exists
 *   (counted megaUnbundled when that differs from the plain top). Both off by default; same report.
 *   leafModel = a PORYGON2 model file for the pory2 leaf (a self-play generation's net; default v0). record = true puts
 *   the root (rows, cols, both mixes, the mean matrix, the per-cell playout counts) in info.rec.
 *   The leaf defaults to env MILTANK_LEAF, else the heuristic. `pory2` = PORYGON2 v0 (PRE-GATE), solver/porygon2/leaf.js.
 *
 * `info` carries the counters for the decision: cells, passes, playouts, unfilled cells, the solved
 * value and SLOWKING's gap, the time spent. A cell with no playout when the clock ran out is filled
 * with the mean of the filled cells and COUNTED (`unfilled`) — never silently.
 *
 * THE DEADLINE IS HARD (2026-09-25, docs/_reports/2026-09-25-miltank-deadline.md). A decision returns within
 * `budgetMs` plus a bounded margin whatever the machine is doing to the cell fill:
 *   - the fill stops at t0 + budgetMs - reserveMs (o.reserveMs, else 6% of the budget clamped to 20-300 ms:
 *     room for the solve and the pick); no pass STARTS after it, in this process or in a worker;
 *   - through the pool the parent does not wait for its workers: a timer resolves the fill at that instant with
 *     every pass that has ARRIVED, and the workers still out are sent a cancel (solver/miltank/pool.js);
 *   - if a candidate ROW has no playout at all, or fewer than `minFill` (o.minFill, default 0.25 — a policy choice,
 *     NOT measured for strength) of the cells hold one, the table is too empty to solve and the move is the ranking
 *     prior's top legal joint. MILTANK scored every legal joint with
 *     that prior in step 1, so the fallback costs nothing; in ROTOM that prior is DODUO. It is COUNTED
 *     (`fallbackEmpty`: no cell at all, `fallbackSparse`: some) and `info.fallback` names it.
 * Before this the pool waited for EVERY worker (Promise.all) and a worker checked its clock only after each
 * playout, so one worker starved of CPU held a 5 s decision for 28-39 s in the arena. Deliberate break
 * MILTANK_DEADLINE_BREAK=1 restores that (no pool timer, no pass-start check, no reserve);
 * solver/tests/test-miltank-deadline.js must go red under it.
 */
'use strict';
/* the moves whose use rolls the consecutive-use die: `stallingMove`, read off the Reg M-C dex (never listed) */
const STALL_ROLL = new Map();
function rollsStall(id) {
  if (!STALL_ROLL.has(id)) { const mv = require('../human/dex.js').D.moves.get(id); STALL_ROLL.set(id, !!(mv && mv.exists && mv.stallingMove)); }
  return STALL_ROLL.get(id);
}
const LEAF_ENV = (typeof process !== 'undefined' && process.env && process.env.MILTANK_LEAF) || '';
const SK = require('../slowking/matrix.js');
const C = require('./cells.js');
const DEADLINE_BREAK = (typeof process !== 'undefined' && process.env && process.env.MILTANK_DEADLINE_BREAK) || '';
/* DELIBERATE BREAKS for solver/tests/test-miltank-quiesce.js (env MILTANK_BREAK, shared with rollout.js): `flat` = a flat
 * table is never detected; `megabundle` = the mega reservation ignores reserveNoRepeat */
const SEARCH_BREAK = (typeof process !== 'undefined' && process.env && process.env.MILTANK_BREAK) || '';

function create(API, deps) {
  const PA = deps.prior, R = deps.rollout;
  const COUNTERS = { decisions: 0, forced: 0, cells: 0, playouts: 0, unfilled: 0, reservedSwitch: 0, reservedMega: 0, rmIters: 0, overBudget: 0, pory2Decisions: 0,
                     fallbackEmpty: 0, fallbackSparse: 0, deadlineCut: 0, quiesceDecisions: 0, flatPrior: 0, megaUnbundled: 0 };

  function rank(scores, joints, k, reserveSwitch, wantMega, avoidMega) {
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
      /* avoidMega (o.reserveNoRepeat): the reserved mega joint is the prior's best one that does NOT also repeat a
       * Protect, when there is one — else the one reserved mega row carries a 1-in-3 Protect in with the mega, and the
       * table can only buy the mega by buying the Protect (docs/_reports/2026-09-27-protect-repeat-fix.md) */
      let i = avoidMega && SEARCH_BREAK !== 'megabundle' ? idx.find(i => has(i, isMega) && !avoidMega(joints[i])) : undefined;
      if (i != null && i !== idx.find(i => has(i, isMega))) COUNTERS.megaUnbundled++;
      if (i == null) i = idx.find(i => has(i, isMega));
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
    const repeats = sd => { const act = sd === 'A' ? S.actA : S.actB; return j => j.some((x, k) => x && x.kind === 'move' && rollsStall(x.move) && act[k] && (act[k].tookProtectTurns | 0) >= 1); };
    const rowsI = rank(Array.from(sMe), laMe.joint, k1, rs, megaMe, o.reserveNoRepeat ? repeats(side) : null);
    const colsI = rank(Array.from(sOp), laOp.joint, k2, rs, megaOp, o.reserveNoRepeat ? repeats(opp) : null);
    const rows = rowsI.map(i => laMe.joint[i]), cols = colsI.map(i => laOp.joint[i]);
    /* the prior's own top legal joint: the move when the clock leaves the table too empty to solve */
    let top = 0; for (let i = 1; i < sMe.length; i++) if (sMe[i] > sMe[top]) top = i;
    const priorTop = laMe.joint[top];
    const belief = { sheet: ctx.G.sheets[opp === 'A' ? 'p1' : 'p2'], revealed: PA.revealed(S, opp) };
    const job = { S, side, opp, rows, cols, belief, depth: o.depth == null ? 2 : o.depth };
    /* QUIESCENCE (o.quiesce): each slot's best non-protect move by the ranking prior, over EVERY legal joint, for the
     * extension turn a playout plays after a protect held (solver/miltank/rollout.js). Read off the scores step 1
     * already computed, so it costs no model call. */
    if (o.quiesce) {
      const fam = require('../arena/protect_stats.js').family();
      const best = (la, s) => [0, 1].map(k => {
        let b = -1;
        la.joint.forEach((j, i) => { const x = j[k]; if (x && x.kind === 'move' && !x.forced && !x.mega && !fam.has(x.move) && (b < 0 || s[i] > s[b])) b = i; });
        return b < 0 ? null : { move: la.joint[b][k].move, target: la.joint[b][k].target };
      });
      job.quiesce = { fb: { [side]: best(laMe, sMe), [opp]: best(laOp, sOp) }, mode: o.quiesce === 'held' ? 'held' : 'all' };
      COUNTERS.quiesceDecisions++;
    }
    /* THE LEAF: o.leaf, else env MILTANK_LEAF, else the heuristic. PORYGON2 needs both open sheets (p1 = side A). */
    const leafMode = o.leaf || LEAF_ENV || 'heuristic';
    if (leafMode === 'pory2') { job.leafCtx = { mode: 'pory2', sheets: ctx.G.sheets }; if (o.leafModel) job.leafCtx.model = o.leafModel; COUNTERS.pory2Decisions++; }
    else if (leafMode !== 'heuristic') throw new Error('MILTANK: unknown leaf ' + leafMode);
    return { job, priorTop };
  }
  /* 3. SOLVE the mean matrix and sample the row mix. */
  function finishDecision(job, acc, o, t0, budget, coin, extra, priorTop) {
    const { rows } = job, m = rows.length, n = job.cols.length;
    const { sum, cnt, passes, playouts } = acc;
    let tot = 0, nf = 0;
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (cnt[i][j]) { tot += sum[i][j] / cnt[i][j]; nf++; }
    const mean = nf ? tot / nf : 0.5;
    const filled = nf / (m * n);
    COUNTERS.cells += m * n; COUNTERS.playouts += playouts;
    if (acc.cut) COUNTERS.deadlineCut++;
    const minFill = o.minFill == null ? 0.25 : o.minFill;
    let emptyRows = 0;
    for (let i = 0; i < m; i++) { let any = false; for (let j = 0; j < n; j++) if (cnt[i][j]) { any = true; break; } if (!any) emptyRows++; }
    if (priorTop && !DEADLINE_BREAK && (nf === 0 || emptyRows > 0 || filled < minFill)) {
      /* TOO EMPTY TO SOLVE: the ranking prior's top joint. The coin is still drawn once, as the solve path draws
       * it, so a fallback does not shift the stream of every later decision. */
      coin();
      const kind = nf === 0 ? 'empty' : 'sparse';
      COUNTERS[nf === 0 ? 'fallbackEmpty' : 'fallbackSparse']++;
      COUNTERS.unfilled += m * n - nf;
      const ms = Date.now() - t0;
      if (ms > budget * 1.5 + 50) COUNTERS.overBudget++;
      return { joint: priorTop, info: Object.assign({ m, n, passes, playouts, unfilled: m * n - nf, filled: +filled.toFixed(3), empty_rows: emptyRows, fallback: kind, ms }, extra || {}) };
    }
    let unfilled = 0;
    const A = sum.map((r, i) => Array.from(r, (v, j) => (cnt[i][j] ? v / cnt[i][j] : (unfilled++, mean))));
    /* the solve is capped by what is left of the budget too (SLOWKING reads its own clock every 64 iterations) */
    const left = DEADLINE_BREAK ? 0 : Math.max(5, t0 + budget - Date.now());
    const sol = o.solver === 'lp' ? SK.solveLP(A) : SK.solveRM(A, { iters: o.rmIters || 4000, tol: 1e-4, timeMs: left });
    const pick = SK.sample(sol.x, coin());
    /* A FLAT TABLE (o.flatEps): every played cell within flatEps of every other — a game already won or lost inside
     * the horizon. Any mix is an equilibrium of it, so SLOWKING's pick is decided by noise below the leaf's resolution
     * (measured: a lost position put its whole mix on a repeat Protect that delayed the loss by 1e-4). The ranking
     * prior's top joint is played instead, and COUNTED (flatPrior). The solve still runs, so the root record is kept. */
    let flat = false;
    if (o.flatEps != null && priorTop && SEARCH_BREAK !== 'flat') {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (cnt[i][j]) { const v = sum[i][j] / cnt[i][j]; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo <= o.flatEps) { flat = true; COUNTERS.flatPrior++; }
    }
    const ms = Date.now() - t0;
    COUNTERS.unfilled += unfilled; COUNTERS.rmIters += sol.iters || 0;
    if (ms > budget * 1.5 + 50) COUNTERS.overBudget++;
    const info = Object.assign({ m, n, passes, playouts, unfilled, filled: +filled.toFixed(3), value: sol.value, gap: sol.gap, rm_iters: sol.iters,
             support: sol.x.filter(v => v > 1e-3).length, pick, ms }, flat ? { flat: true } : {}, extra || {});
    /* o.record (self-play, solver/mew): the whole root — the candidate joints, both mixes and the mean matrix —
     * so a training target can be read off the search rather than off the one sampled move */
    if (o.record) info.rec = { rows, cols: job.cols, x: Array.from(sol.x), y: sol.y ? Array.from(sol.y) : null, A, cnt: cnt.map(r => Array.from(r)) };
    return { joint: flat ? priorTop : rows[pick], info };
  }
  /* when the cell fill must stop: the budget less a reserve for the solve and the pick */
  function fillByOf(o, t0, budget) {
    if (DEADLINE_BREAK) return t0 + budget;
    return t0 + budget - (o.reserveMs != null ? o.reserveMs : reserveMsOf(budget));
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
    const fillBy = fillByOf(o, t0, budget);
    /* an in-flight playout is abandoned half-way through the reserve, so the other half is left for the solve */
    if (!DEADLINE_BREAK) d.job.abortAt = fillBy + Math.floor((t0 + budget - fillBy) / 2);
    return { t0, budget, coin, job: d.job, priorTop: d.priorTop, fillBy };
  }

  /* 2. CELLS, in this process: solver/miltank/cells.js, passes 0, 1, 2, … */
  function decide(S, side, ctx, o) {
    o = o || {};
    const b = begin(S, side, ctx, o);
    if (b.done) return b.done;
    const acc = C.fillSerial(API, R, b.job, b.fillBy, o.maxPasses);
    return finishDecision(b.job, acc, o, b.t0, b.budget, b.coin, { overrun_ms: acc.overrunMs, max_world_ms: acc.maxWorldMs, max_playout_ms: acc.maxPlayoutMs }, b.priorTop);
  }
  /* 2'. CELLS across worker processes (o.pool = solver/miltank/pool.js). The SAME passes: with a pass cap
   * the matrix, the value and the pick are identical to decide()'s (solver/tests/test-playout-speed.js). */
  async function decideAsync(S, side, ctx, o) {
    o = o || {};
    if (!o.pool) return decide(S, side, ctx, o);
    const b = begin(S, side, ctx, o);
    if (b.done) return b.done;
    const acc = await o.pool.fill(Object.assign({}, b.job, { deadline: b.fillBy, maxPasses: o.maxPasses || 0 }));
    COUNTERS.pooled = (COUNTERS.pooled || 0) + 1;
    return finishDecision(b.job, acc, o, b.t0, b.budget, b.coin, { workers: acc.workers, late_workers: acc.late || 0 }, b.priorTop);
  }

  return { COUNTERS, decide, decideAsync, rank, collectIdle, BROKEN: DEADLINE_BREAK || (['flat', 'megabundle'].includes(SEARCH_BREAK) ? SEARCH_BREAK : null) };
}

/* THE RESERVE: 6% of the budget, clamped to 20-300 ms (60 ms at 1 s, 300 ms at 5 s). It was 3% clamped to 150 ms,
 * and the serial path's 5 s arm then passed by 74 ms: one 663 ms playout straddled the abort line, which falls halfway
 * through the reserve, and one engine step cannot be cut short (docs/_reports/2026-09-25-miltank-deadline.md). */
function reserveMsOf(budget) { return Math.max(20, Math.min(300, Math.round(budget * 0.06))); }

/* A FULL GC OFF THE CLOCK. A decision allocates a world copy per playout, and a major collection that lands INSIDE a
 * decision stops the decider for its whole length: 1.1-1.6 s measured on a loaded core, over the 500 ms margin, and
 * no clock check can interrupt it (docs/_reports/2026-09-25-miltank-deadline.md). A caller with idle time — ROTOM
 * between sending a choice and the next request — calls this so the next decision starts on a collected heap.
 * `gc` is exposed at run time (the V8 flag, then a fresh context hands the function out), so no launch flag is needed.
 * Returns the ms it took, or null if the runtime refused. */
let GC = null;
function collectIdle() {
  try {
    if (!GC) { require('v8').setFlagsFromString('--expose-gc'); GC = require('vm').runInNewContext('gc'); }
    const t = Date.now(); GC(); return Date.now() - t;
  } catch (e) { return null; }
}

module.exports = { create, collectIdle, reserveMsOf };
