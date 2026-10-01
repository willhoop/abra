/* solver/hypno/hypno.js — HYPNO v1: the POPULATION BEST RESPONSE at one root (solver/PLAN.md §2 HYPNO dated update,
 * 2026-10-01; §3 N2). Pure arithmetic on the search's own table: no simulator, no model call.
 *
 *   const H = require('./solver/hypno/hypno.js');
 *   const r = H.respond({ A, cnt, x, y, hCols, hMass, trusted, w }, opts);
 *   r.x   -> the mix to sample (x itself whenever any gate says no)
 *   r.reason -> 'played' | 'untrusted' | 'coverage' | 'belowSE' | 'noGain'     r.gainPred, r.se, r.worst, r.tv, r.iBR
 *
 * INPUTS. A[i][j] = OUR win probability (row i = our candidate joint, column j = the opponent's), cnt = playouts per cell,
 * (x, y) = the solve's mixes (sigma* and the opponent's), hCols = GARY's probability of each opponent column (raw, not
 * renormalised), hMass = GARY's total mass over every joint the opponent could pick (normally 1), trusted = the GARY
 * cell's held-out gate (p = 1), w = the in-series weight that this opponent follows GARY (solver/hypno/series.js; 1 when
 * no series evidence is used).
 *
 * THE RULE (defaults pre-registered in solver/gary/preregistration.json hypno_offline.policy):
 *   1. the cell's gate failed                                   -> sigma*   ('untrusted')     [DBR: p = 0 where data is thin]
 *   2. GARY's mass on the table's columns < minCover (0.25)     -> sigma*   ('coverage')      the table cannot price the rest
 *   3. h = hCols renormalised; h_eff = w h + (1 - w) y           (DBBR: a deviation from the equilibrium, weighted by belief)
 *   4. BR = argmax_i (A h_eff)_i; gainPred = (A h_eff)_BR - x.A.h_eff; se = its standard error from the playout counts
 *      (each cell's variance bounded by A(1 - A)/n, cells independent: conservative, CRN makes the true one smaller)
 *   5. gainPred <= kSE * se (kSE 1)                              -> sigma*   ('belowSE')       the "gain" is rollout noise
 *   6. else the pure best response e_BR, or with opts.eps (the eps-safe A/B option, McCracken & Bowling 2004) the point
 *      on the segment sigma* -> e_BR furthest toward e_BR whose worst case stays >= v* - eps (closed form per column).
 * Every outcome is reported with its worst-case cost: v* - min_j (x_play.A)_j, the most a best-responding opponent
 * could take on this table — the number the one-off premise says need NOT be capped by default (report §3).
 *
 * DELIBERATE BREAKS (env HYPNO_BREAK): `nogate` ignores the cell gate; `argmin` plays the WORST response to h. The tests
 * must go red under each.
 */
'use strict';
const BREAK = (typeof process !== 'undefined' && process.env && process.env.HYPNO_BREAK) || '';
const DEFAULTS = { kSE: 1, minCover: 0.25, eps: null };

function respond(inp, opts) {
  const o = Object.assign({}, DEFAULTS);
  for (const [k, v] of Object.entries(opts || {})) if (v !== undefined) o[k] = v;
  const { A, x } = inp;
  const m = A.length, n = A[0].length;
  const out = { x, reason: null, gainPred: 0, se: 0, worst: 0, tv: 0, iBR: -1, cover: 0, w: inp.w == null ? 1 : inp.w };
  const colVal = xx => { const v = new Float64Array(n); for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += xx[i] * A[i][j]; v[j] = s; } return v; };
  const a = colVal(x);
  let vstar = Infinity; for (let j = 0; j < n; j++) if (a[j] < vstar) vstar = a[j];
  out.vstar = vstar;
  if (!inp.trusted && BREAK !== 'nogate') { out.reason = 'untrusted'; return out; }
  const hs = inp.hCols.map(v => (v > 0 && Number.isFinite(v) ? v : 0));
  const tot = hs.reduce((s, v) => s + v, 0);
  const mass = inp.hMass == null ? 1 : inp.hMass;
  out.cover = mass > 0 ? tot / mass : 0;
  if (!(tot > 0) || out.cover < o.minCover) { out.reason = 'coverage'; return out; }
  const w = out.w;
  const y = inp.y && inp.y.length === n ? inp.y : null;
  const h = hs.map(v => v / tot).map((v, j) => (y ? w * v + (1 - w) * y[j] : v));
  const u = new Float64Array(m);
  for (let i = 0; i < m; i++) { let s = 0; for (let j = 0; j < n; j++) s += A[i][j] * h[j]; u[i] = s; }
  let br = 0;
  for (let i = 1; i < m; i++) if (BREAK === 'argmin' ? u[i] < u[br] : u[i] > u[br]) br = i;
  let base = 0; for (let i = 0; i < m; i++) base += x[i] * u[i];
  const gain = u[br] - base;
  /* se of sum_j h_j [ (1 - x_br) A_br,j - sum_{i != br} x_i A_ij ], cells independent, Var(A_ij) <= A(1-A)/n */
  const V = (i, j) => { const p = Math.min(1, Math.max(0, A[i][j])); const c = inp.cnt ? Math.max(1, inp.cnt[i][j] || 0) : 1; return p * (1 - p) / c; };
  let vv = 0;
  for (let j = 0; j < n; j++) {
    let s = (1 - x[br]) * (1 - x[br]) * V(br, j);
    for (let i = 0; i < m; i++) if (i !== br) s += x[i] * x[i] * V(i, j);
    vv += h[j] * h[j] * s;
  }
  out.gainPred = gain; out.se = Math.sqrt(vv); out.iBR = br;
  if (!(gain > 0)) { out.reason = 'noGain'; return out; }
  if (gain <= o.kSE * out.se) { out.reason = 'belowSE'; return out; }
  let t = 1;
  if (o.eps != null) {
    const floor = vstar - o.eps;
    for (let j = 0; j < n; j++) { const b = A[br][j]; if (a[j] > b) t = Math.min(t, Math.max(0, (a[j] - floor) / (a[j] - b))); }
  }
  const xp = x.map((v, i) => (1 - t) * v + (i === br ? t : 0));
  const ap = colVal(xp);
  let mn = Infinity; for (let j = 0; j < n; j++) if (ap[j] < mn) mn = ap[j];
  out.worst = Math.max(0, vstar - mn);
  out.tv = xp.reduce((s, v, i) => s + Math.abs(v - x[i]), 0) / 2;
  out.t = t;
  out.x = xp;
  out.reason = 'played';
  /* the gain actually bought (on h_eff) by the played mix, which is gainPred when t = 1 */
  out.gainPlayed = t * gain;
  return out;
}

module.exports = { respond, DEFAULTS, BREAK };
