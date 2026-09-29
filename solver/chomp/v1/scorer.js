/* solver/chomp/v1/scorer.js — CHOMP v1's cell scorer in JS: the 90 x 90 table P(p1 wins), from the model train.py wrote.
 *
 *   const SC = require('./solver/chomp/v1/scorer.js').create(API[, { model, source }]);
 *   const r  = SC.table(sheets[, { deadline }])   -> { A: 90 x 90 Float64Array rows, ms, source, tau }
 *   SC.cell(F, a, b)                               one cell's logit, before the source temperature (tests)
 *   SC.model, SC.COUNTERS
 *
 * The forward pass is train.py's Scorer, written out: x = (g(a|b) - mu)/sd, y = (g(b|a) - mu)/sd;
 * s(x, y) = w.x [+ v.tanh(W[x;y] + c)]; logit = tau_source * (s(x,y) - s(y,x) + species terms). The table uses the
 * `selfplay` temperature by default (the arena bot is gen5 MILTANK). solver/tests/test-chomp1.js holds this pass equal
 * to the Python one on fixture rows (the metrics file carries them) and holds the table antisymmetric.
 *
 * DELIBERATE BREAK (env CHOMP1_BREAK=sign): the opponent's half enters with the wrong sign (s(x,y) + s(y,x)), so the
 * table stops being antisymmetric. The test must go red.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const O = require('../options.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.CHOMP1_BREAK) || '';
const DEFAULT_MODEL = path.join(__dirname, 'model', 'chomp1.json');

function create(API, opts) {
  opts = opts || {};
  const FX = require('./features.js').create(API);
  const file = opts.model || DEFAULT_MODEL;
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const G = m.g_dim;
  if (G !== FX.G_DIM) throw new Error('chomp/v1/scorer: the model has ' + G + ' features and features.js has ' + FX.G_DIM);
  const mlp = m.arch === 'chomp1-mlp';
  const H = mlp ? m.v.length : 0;
  const vix = new Map(m.vocab.map((s, i) => [s, i]));
  const source = opts.source || 'selfplay';
  const tau = m.tau[source];
  if (!(tau > 0)) throw new Error('chomp/v1/scorer: no temperature for source ' + source);
  const COUNTERS = { tables: 0, cells: 0, oov: 0, overBudget: 0 };

  const norm = (g, out) => { for (let k = 0; k < G; k++) out[k] = (g[k] - m.mu[k]) / m.sd[k]; return out; };
  function s(x, y) {
    let o = 0;
    for (let k = 0; k < G; k++) o += m.w[k] * x[k];
    if (mlp) {
      for (let h = 0; h < H; h++) {
        const row = m.W[h];
        let z = m.c[h];
        for (let k = 0; k < G; k++) z += row[k] * x[k] + row[G + k] * y[k];
        o += m.v[h] * Math.tanh(z);
      }
    }
    return o;
  }
  const spIdx = sp => { const i = vix.get(sp); if (i === undefined) { COUNTERS.oov++; return 0; } return i; };
  /* per-side species terms of an option: sum of bring values over the four + lead values over the two */
  function spTerm(F, side, o) {
    const op = O.OPTIONS[o], ids = F.sp[side];
    let t = 0;
    for (const i of op.order) t += m.beta[spIdx(ids[i])];
    for (const i of op.leads) t += m.lam[spIdx(ids[i])];
    return t;
  }
  const gx = new Float64Array(G), gy = new Float64Array(G), nx = new Float64Array(G), ny = new Float64Array(G);
  /* the logit of cell (a, b) before the temperature */
  function cell(F, a, b, spA, spB) {
    FX.side(F, 'p1', a, b, gx); FX.side(F, 'p2', b, a, gy);
    norm(gx, nx); norm(gy, ny);
    const opp = s(ny, nx);
    const z = s(nx, ny) - (BREAK === 'sign' ? -opp : opp);
    return z + (spA == null ? spTerm(F, 'p1', a) : spA) - (spB == null ? spTerm(F, 'p2', b) : spB);
  }
  /* the logit of one dataset row (raw g vectors and species ids), WITH the temperature: the PARITY fixture's question */
  function logitRow(ga, gb, sp) {
    const x = norm(ga, new Float64Array(G)), y = norm(gb, new Float64Array(G));
    const opp = s(y, x);
    let z = s(x, y) - (BREAK === 'sign' ? -opp : opp);
    for (const q of sp.A) z += m.beta[spIdx(q)];
    for (const q of sp.LA) z += m.lam[spIdx(q)];
    for (const q of sp.B) z -= m.beta[spIdx(q)];
    for (const q of sp.LB) z -= m.lam[spIdx(q)];
    return tau * z;
  }
  function table(sheets, o) {
    o = o || {};
    const t0 = Date.now();
    const F = FX.pairFacts(sheets);
    const N = O.N;
    const spA = new Float64Array(N), spB = new Float64Array(N);
    for (let i = 0; i < N; i++) { spA[i] = spTerm(F, 'p1', i); spB[i] = spTerm(F, 'p2', i); }
    const A = [];
    for (let a = 0; a < N; a++) {
      if (o.deadline && Date.now() > o.deadline) { COUNTERS.overBudget++; throw new Error('chomp1: over budget after ' + a + ' of 90 rows'); }
      const row = new Array(N);
      for (let b = 0; b < N; b++) row[b] = 1 / (1 + Math.exp(-tau * cell(F, a, b, spA[a], spB[b])));
      A.push(row);
    }
    COUNTERS.tables++; COUNTERS.cells += N * N;
    return { A, F, ms: Date.now() - t0, source, tau };
  }
  return { table, cell, logitRow, model: m, file, COUNTERS, features: FX, BROKEN: BREAK || null };
}

module.exports = { create, DEFAULT_MODEL };
