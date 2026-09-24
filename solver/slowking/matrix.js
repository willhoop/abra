/* solver/slowking/matrix.js — SLOWKING v1: the per-turn simultaneous-move solver.
 *
 * A two-player ZERO-SUM matrix game. A[i][j] is the ROW player's payoff when row plays i and column
 * plays j; the column player receives -A[i][j] (equivalently: row maximises, column minimises). In
 * MILTANK the row player is the searcher and A is its win-probability estimate in [0, 1].
 *
 *   const SK = require('./solver/slowking/matrix.js');
 *   SK.solveRM(A, { iters, tol, timeMs, alternate, avg })  -> { x, y, value, gap, iters }
 *   SK.solveLP(A)                                          -> { x, y, value, gap, pivots }
 *   SK.exploitability(A, x, y)                             -> { gap, brRow, brCol, value }
 *   SK.sample(p, u)                                        -> index drawn from p with u in [0,1)
 *
 * THE NUMBER REPORTED WITH EVERY SOLVE is `gap` = max_i (A y)_i − min_j (xᵀA)_j, the sum of both
 * players' best-response gains against the returned pair. It is >= 0 and is 0 exactly at a Nash
 * equilibrium; `gap / 2` is the usual "exploitability" of the pair. It is computed from x and y after
 * the solve, never carried from inside the loop, so a solver that is wrong cannot report itself right.
 *
 * REGRET MATCHING+ (Tammelin 2014; Tammelin, Burch, Johanson, Bowling, IJCAI 2015). Cumulative regrets
 * clipped at zero. Two modes:
 *   alternate:true,  avg:'linear'   the default: alternating updates, average weighted by t. Fast.
 *   alternate:false, avg:'uniform'  simultaneous updates, plain average. This is the mode the textbook
 *                                   bound is proven for: each player's regret after T rounds is at most
 *                                   Δ·sqrt(k·T) (Δ = payoff range, k = that player's action count), and
 *                                   in a zero-sum game the average pair's gap is at most the sum of the
 *                                   two average regrets, so  gap(T) <= Δ·(sqrt(m) + sqrt(n)) / sqrt(T).
 *                                   solver/tests/test-slowking.js checks that inequality on real runs.
 *
 * LINEAR PROGRAMMING. The exact answer, for small games and as the reference the tests hold RM+ to.
 * The payoffs are shifted to be positive (A' = A − min + 1, so the value v' > 0), then
 *   max Σq  s.t.  A' q <= 1, q >= 0          (the column player's LP; origin feasible, no phase 1)
 * is solved by a dense tableau simplex with Bland's rule (no cycling). v' = 1/Σq, y = q·v', and the
 * row player's strategy is the DUAL: the objective-row entries under the slack columns, times v'.
 *
 * DELIBERATE BREAKS (env SLOWKING_BREAK), for the tests to show they can see a fault. Each is loud:
 * `BROKEN` is exported and names the break, so a run with one on cannot pass as a clean run.
 *   colsign   the column player's regret has the wrong sign (it maximises the row's payoff)
 *   noavg     RM+ returns the LAST iterate instead of the average
 *   lpdual    solveLP returns a uniform row strategy instead of reading the dual
 */
'use strict';

const BREAK = (typeof process !== 'undefined' && process.env && process.env.SLOWKING_BREAK) || '';

function dims(A) {
  if (!Array.isArray(A) || !A.length || !Array.isArray(A[0]) || !A[0].length) throw new Error('slowking: A must be a non-empty 2-D array');
  const m = A.length, n = A[0].length;
  for (const r of A) {
    if (r.length !== n) throw new Error('slowking: ragged matrix');
    for (const v of r) if (!Number.isFinite(v)) throw new Error('slowking: non-finite payoff ' + v);
  }
  return [m, n];
}

function exploitability(A, x, y) {
  const [m, n] = dims(A);
  let brRow = -Infinity, brCol = Infinity, value = 0;
  for (let i = 0; i < m; i++) {
    let s = 0; for (let j = 0; j < n; j++) s += A[i][j] * y[j];
    if (s > brRow) brRow = s;
    value += x[i] * s;
  }
  for (let j = 0; j < n; j++) {
    let s = 0; for (let i = 0; i < m; i++) s += x[i] * A[i][j];
    if (s < brCol) brCol = s;
  }
  return { gap: Math.max(0, brRow - brCol), brRow, brCol, value };
}

function normalise(q, out) {
  let s = 0; for (let i = 0; i < q.length; i++) s += q[i];
  if (s > 0) for (let i = 0; i < q.length; i++) out[i] = q[i] / s;
  else for (let i = 0; i < q.length; i++) out[i] = 1 / q.length;
  return out;
}

function solveRM(A, opts) {
  opts = opts || {};
  const [m, n] = dims(A);
  const iters = opts.iters == null ? 10000 : opts.iters;
  const tol = opts.tol == null ? 0 : opts.tol;
  const alternate = opts.alternate !== false;
  const linear = (opts.avg || (alternate ? 'linear' : 'uniform')) === 'linear';
  const deadline = opts.timeMs ? Date.now() + opts.timeMs : Infinity;
  const every = opts.checkEvery || 64;
  const Qx = new Float64Array(m), Qy = new Float64Array(n);
  const x = new Float64Array(m).fill(1 / m), y = new Float64Array(n).fill(1 / n);
  const sx = new Float64Array(m), sy = new Float64Array(n);
  const u = new Float64Array(m), w = new Float64Array(n);
  let t = 0, gap = Infinity;
  const colSign = BREAK === 'colsign' ? -1 : 1;
  const avgOut = () => {
    if (BREAK === 'noavg') return [Array.from(x), Array.from(y)];
    return [Array.from(normalise(sx, new Float64Array(m))), Array.from(normalise(sy, new Float64Array(n)))];
  };
  while (t < iters) {
    t++;
    normalise(Qx, x); normalise(Qy, y);
    // row update
    let ev = 0;
    for (let i = 0; i < m; i++) { let s = 0; const r = A[i]; for (let j = 0; j < n; j++) s += r[j] * y[j]; u[i] = s; ev += x[i] * s; }
    if (!alternate) {
      // simultaneous: the column player's utilities are read against the SAME x
      let evc = 0;
      for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += x[i] * A[i][j]; w[j] = s; evc += y[j] * s; }
      for (let i = 0; i < m; i++) Qx[i] = Math.max(0, Qx[i] + u[i] - ev);
      for (let j = 0; j < n; j++) Qy[j] = Math.max(0, Qy[j] + colSign * (evc - w[j]));
    } else {
      for (let i = 0; i < m; i++) Qx[i] = Math.max(0, Qx[i] + u[i] - ev);
      normalise(Qx, x);
      let evc = 0;
      for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += x[i] * A[i][j]; w[j] = s; evc += y[j] * s; }
      for (let j = 0; j < n; j++) Qy[j] = Math.max(0, Qy[j] + colSign * (evc - w[j]));
    }
    const wt = linear ? t : 1;
    for (let i = 0; i < m; i++) sx[i] += wt * x[i];
    for (let j = 0; j < n; j++) sy[j] += wt * y[j];
    if ((tol > 0 || deadline !== Infinity) && t % every === 0) {
      if (tol > 0) { const [ax, ay] = avgOut(); gap = exploitability(A, ax, ay).gap; if (gap <= tol) break; }
      if (Date.now() >= deadline) break;
    }
  }
  const [ax, ay] = avgOut();
  const e = exploitability(A, ax, ay);
  return { x: ax, y: ay, value: e.value, gap: e.gap, iters: t, method: 'rm+' + (alternate ? '-alt' : '-sim') + (linear ? '-linear' : '-uniform') };
}

function solveLP(A) {
  const [m, n] = dims(A);
  let mn = Infinity; for (const r of A) for (const v of r) if (v < mn) mn = v;
  const shift = 1 - mn;
  // tableau: m constraint rows, objective row last. columns: n decision vars, m slacks, rhs.
  const W = n + m + 1;
  const T = [];
  for (let i = 0; i < m; i++) {
    const row = new Float64Array(W);
    for (let j = 0; j < n; j++) row[j] = A[i][j] + shift;
    row[n + i] = 1; row[W - 1] = 1;
    T.push(row);
  }
  const obj = new Float64Array(W); for (let j = 0; j < n; j++) obj[j] = -1;
  T.push(obj);
  const basis = []; for (let i = 0; i < m; i++) basis.push(n + i);
  const EPS = 1e-12;
  let pivots = 0;
  for (;;) {
    let enter = -1;
    for (let c = 0; c < n + m; c++) if (obj[c] < -EPS) { enter = c; break; }       // Bland: lowest index
    if (enter < 0) break;
    let leave = -1, best = Infinity;
    for (let r = 0; r < m; r++) {
      const a = T[r][enter];
      if (a > EPS) {
        const ratio = T[r][W - 1] / a;
        if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[r] < basis[leave])) { best = ratio; leave = r; }
      }
    }
    if (leave < 0) throw new Error('slowking LP: unbounded (cannot happen for a positive matrix)');
    const pr = T[leave], pv = pr[enter];
    for (let c = 0; c < W; c++) pr[c] /= pv;
    for (let r = 0; r <= m; r++) {
      if (r === leave) continue;
      const f = T[r][enter];
      if (f !== 0) { const row = T[r]; for (let c = 0; c < W; c++) row[c] -= f * pr[c]; }
    }
    basis[leave] = enter;
    if (++pivots > 50000) throw new Error('slowking LP: pivot limit');
  }
  const q = new Float64Array(n);
  for (let r = 0; r < m; r++) if (basis[r] < n) q[basis[r]] = T[r][W - 1];
  let sq = 0; for (const v of q) sq += v;
  const vp = 1 / sq;
  const y = Array.from(q, v => Math.max(0, v * vp));
  let x = [];
  for (let i = 0; i < m; i++) x.push(Math.max(0, obj[n + i] * vp));
  if (BREAK === 'lpdual') x = x.map(() => 1 / m);
  const nx = x.reduce((a, b) => a + b, 0), ny = y.reduce((a, b) => a + b, 0);
  x = x.map(v => v / nx);
  const yy = y.map(v => v / ny);
  const e = exploitability(A, x, yy);
  return { x, y: yy, value: e.value, lpValue: vp - shift, gap: e.gap, pivots, method: 'lp-simplex' };
}

function sample(p, u) {
  let c = 0;
  for (let i = 0; i < p.length; i++) { c += p[i]; if (u < c) return i; }
  for (let i = p.length - 1; i >= 0; i--) if (p[i] > 0) return i;
  return p.length - 1;
}

/* the proven bound for the simultaneous / uniform-average mode (see the header) */
function rmBound(A, T) {
  const [m, n] = dims(A);
  let lo = Infinity, hi = -Infinity; for (const r of A) for (const v of r) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return (hi - lo) * (Math.sqrt(m) + Math.sqrt(n)) / Math.sqrt(T);
}

module.exports = { solveRM, solveLP, exploitability, sample, rmBound, BROKEN: BREAK || null };
