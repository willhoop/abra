/* solver/hypno/series.js — HYPNO's in-series memory of ONE opponent across the games of a bo3.
 *
 * A ladder bo3 is a one-off against a stranger (Will, 2026-10-01), so the only per-opponent evidence is this series.
 * Two posteriors are kept, both updated only from games BEFORE the current one (solver/PLAN.md §2 HYPNO dated update:
 * "games 2 and 3 update h toward this opponent from game 1"), each older game's evidence decayed by gamma per game back:
 *
 *   1. delta — a per-opponent deviation from the population cell's GARY parameters (the same 15 numbers: the DODUO
 *      scale and the 14 class tilts), MAP under N(0, sigma^2 I) given the opponent's observed joints. delta = 0 is the
 *      population. Its value is TESTED offline on held-out human series (solver/gary/eval_series.js); HYPNO applies it
 *      only when that test passed (opts.enabled).
 *   2. w — P(this opponent follows GARY) against "plays like the search's equilibrium column mix" (the research's
 *      two-hypothesis Dirichlet, docs/_reports/2026-09-23-solver-research-humans-and-ladder.md §1.4). Prior w0 is fitted
 *      on the recorded roots (solver/gary/gate.js). Evidence only from a decision whose joint was one of the search's
 *      columns (else the equilibrium hypothesis has no probability to give); both hypotheses are compared on the
 *      columns, GARY renormalised over them, the equilibrium mix mixed with ETA of uniform so no column is impossible.
 *
 *   const SR = require('./solver/hypno/series.js').create({ sigma, gamma, enabled, w0 });
 *   SR.observe({ gn, lp, bits, lab })            // one opponent decision: DODUO log-probs, class masks, their cell
 *   SR.observeTable({ gn, hCols, yStar, j })     // the same decision on our table: GARY over cols, y*, their column
 *   SR.delta(gn) -> Float64Array(15) | null      // for game gn, from games < gn
 *   SR.w(gn) -> number                           // the same
 */
'use strict';
const NB = require('../gary/situation.js').NB;
const NF = 1 + NB;
const ETA = 0.05, FLOOR = 1e-4;

function scores(lp, bits, eff, delta) {
  const K = lp.length, s = new Float64Array(K);
  let mx = -Infinity;
  for (let k = 0; k < K; k++) {
    let v = (1 + eff[0] + (delta ? delta[0] : 0)) * lp[k];
    for (let f = 0; f < NB; f++) if (bits[k] & (1 << f)) v += eff[1 + f] + (delta ? delta[1 + f] : 0);
    s[k] = v; if (v > mx) mx = v;
  }
  let z = 0; for (let k = 0; k < K; k++) { s[k] = Math.exp(s[k] - mx); z += s[k]; }
  for (let k = 0; k < K; k++) s[k] /= z;
  return s;
}

/* MAP delta: minimise sum_o w_o * NLL_o(eff_o + delta) + |delta|^2 / (2 sigma^2), by Newton (15 x 15) */
function mapDelta(obs, sigma, iters = 20) {
  if (!obs.length || !(sigma > 0)) return null;
  const d = new Float64Array(NF), x = new Float64Array(NF), mu = new Float64Array(NF);
  const prec = 1 / (sigma * sigma);
  for (let it = 0; it < iters; it++) {
    const g = new Float64Array(NF), H = new Float64Array(NF * NF);
    for (const o of obs) {
      const p = scores(o.lp, o.bits, o.eff, d);
      mu.fill(0);
      const Hl = new Float64Array(NF * NF), gl = new Float64Array(NF);
      for (let k = 0; k < o.lp.length; k++) {
        x[0] = o.lp[k]; for (let f = 0; f < NB; f++) x[1 + f] = (o.bits[k] >> f) & 1;
        const y = k === o.lab ? 1 : 0;
        for (let f = 0; f < NF; f++) { gl[f] += (p[k] - y) * x[f]; mu[f] += p[k] * x[f]; }
        for (let f = 0; f < NF; f++) if (x[f]) for (let h = 0; h < NF; h++) Hl[f * NF + h] += p[k] * x[f] * x[h];
      }
      for (let f = 0; f < NF; f++) { g[f] += o.w * gl[f]; for (let h = 0; h < NF; h++) H[f * NF + h] += o.w * (Hl[f * NF + h] - mu[f] * mu[h]); }
    }
    for (let f = 0; f < NF; f++) { g[f] += prec * d[f]; H[f * NF + f] += prec; }
    const step = solve(H, g);
    let mx = 0;
    for (let f = 0; f < NF; f++) { d[f] -= step[f]; mx = Math.max(mx, Math.abs(step[f])); }
    if (mx < 1e-7) break;
  }
  return d;
}
function solve(H, g) {        // Gaussian elimination with partial pivoting, NF x NF
  const n = g.length, A = Array.from({ length: n }, (_, i) => Array.from(H.slice(i * n, i * n + n)).concat([g[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const v = A[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / v; if (f) for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = A[r][n]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / (A[r][r] || 1e-12); }
  return x;
}

function create(opts = {}) {
  const sigma = opts.sigma == null ? 0.2 : opts.sigma, gamma = opts.gamma == null ? 1 : opts.gamma;
  const enabled = !!opts.enabled, w0 = opts.w0 == null ? 0.5 : opts.w0;
  const BREAK = process.env.HYPNO_BREAK || '';
  const obs = [], tab = [];
  const COUNTERS = { observed: 0, observedTable: 0, tableSkippedNotInCols: 0, deltaSolves: 0 };
  const weightOf = (gnObs, gn) => Math.pow(gamma, gn - gnObs - 1);
  return {
    COUNTERS, sigma, gamma, enabled, w0,
    observe(o) { obs.push(o); COUNTERS.observed++; },
    observeTable(o) {
      if (!(o.j >= 0)) { COUNTERS.tableSkippedNotInCols++; return; }
      tab.push(o); COUNTERS.observedTable++;
    },
    delta(gn) {
      if (!enabled || BREAK === 'deltaoff') return null;
      const use = obs.filter(o => o.gn < gn).map(o => Object.assign({}, o, { w: weightOf(o.gn, gn) }));
      if (!use.length) return null;
      COUNTERS.deltaSolves++;
      return mapDelta(use, sigma);
    },
    w(gn) {
      let lo = Math.log(w0 / (1 - w0));
      for (const o of tab) {
        if (!(o.gn < gn) && BREAK !== 'seriesleak') continue;
        const n = o.hCols.length;
        const g = Math.max(FLOOR, o.hCols[o.j]), t = Math.max(FLOOR, (1 - ETA) * o.yStar[o.j] + ETA / n);
        lo += weightOf(o.gn, gn) * (Math.log(g) - Math.log(t));
      }
      return 1 / (1 + Math.exp(-lo));
    },
    get size() { return { obs: obs.length, tab: tab.length }; },
  };
}

module.exports = { create, mapDelta, scores, NF, ETA, FLOOR };
