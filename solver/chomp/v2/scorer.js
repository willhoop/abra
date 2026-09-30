/* solver/chomp/v2/scorer.js — CHOMP v2's cell scorer in JS: the 90 x 90 table P(p1 wins), from the model train.py wrote.
 *
 *   const SC = require('./solver/chomp/v2/scorer.js').create(API[, { model, source, spreads }]);
 *   SC.table(sheets[, { deadline }]) -> { A, F, ms, source, tau }          the same shape as v1's (solver/chomp/v1/scorer.js)
 *   SC.logitRow(ga, gb, sp)                                                 one dataset row's logit (the PARITY fixtures)
 *   SC.model, SC.COUNTERS, SC.features
 *
 * The forward pass is v1's, over v2's features (solver/chomp/v2/features.js). The model names its feature set:
 *   'flat+field'  the table stat line + the field block — no spread source is needed
 *   'set+field'   the set spread + the field block — spreads come from the model's table (model/spreads.json, every set
 *                 CHOMP's rows met) and, for a set not in it, from solver/chomp/v2/spreads.js's rule run against the saved
 *                 population (model/population.json). Both are COUNTED (`spreadTable`, `spreadDerived`); a set that can
 *                 be neither keeps the table line and is counted by features.js (`spreadMissing`).
 *
 * DELIBERATE BREAK (env CHOMP2_BREAK=sign): the opponent's half enters with the wrong sign; the table stops being
 * antisymmetric and the parity fixtures fail. solver/tests/test-chomp2.js must go red.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const O = require('../options.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.CHOMP2_BREAK) || '';
const MODEL_DIR = path.join(__dirname, 'model');
const DEFAULT_MODEL = path.join(MODEL_DIR, 'chomp2.json');

/* the spread source for a 'set+field' model: the table first, the rule on the saved population for a miss */
function spreadSource(API, dir) {
  const S2 = require('./spreads.js');
  const SPR = require('../../rotom/spreads.js');
  const T = fs.existsSync(path.join(dir, 'spreads.json')) ? S2.table(path.join(dir, 'spreads.json')) : null;
  const C = { spreadTable: 0, spreadDerived: 0 };
  let MD = null;
  const deriver = () => {
    if (MD) return MD;
    const P = JSON.parse(fs.readFileSync(path.join(dir, 'population.json'), 'utf8'));
    MD = S2.make(API, { teams: P.teams, slots: P.slots.map(s => ({ row: s.row, w: s.w, key: SPR.setKey(s.row) })) });
    return MD;
  };
  return {
    COUNTERS: C,
    spreadOf(row) {
      const z = T && T.spreadOf(row);
      if (z) { C.spreadTable++; return z; }
      if (!row || !row.nature) return null;
      const d = deriver().spreadFor(row);
      C.spreadDerived++;
      return { evs: d.evs, source: d.source, role: d.role };
    },
  };
}

function create(API, opts) {
  opts = opts || {};
  const file = opts.model || DEFAULT_MODEL;
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const mode = m.features === 'set+field' ? { spread: 'set', field: true } : m.features === 'flat+field' ? { spread: 'flat', field: true } : null;
  if (!mode) throw new Error('chomp/v2/scorer: unknown feature set ' + m.features);
  const spreads = mode.spread === 'set' ? (opts.spreads || spreadSource(API, path.dirname(file))) : null;
  const FX = require('./features.js').create(API, { mode, spreads });
  const G = m.g_dim;
  if (G !== FX.G_DIM) throw new Error('chomp/v2/scorer: the model has ' + G + ' features and features.js has ' + FX.G_DIM);
  const mlp = m.arch === 'chomp2-mlp';
  const H = mlp ? m.v.length : 0;
  const vix = new Map(m.vocab.map((s, i) => [s, i]));
  const source = opts.source || 'selfplay';
  const tau = m.tau[source];
  if (!(tau > 0)) throw new Error('chomp/v2/scorer: no temperature for source ' + source);
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
  function spTerm(F, side, o) {
    const op = O.OPTIONS[o], ids = F.sp[side];
    let t = 0;
    for (const i of op.order) t += m.beta[spIdx(ids[i])];
    for (const i of op.leads) t += m.lam[spIdx(ids[i])];
    return t;
  }
  const gx = new Float64Array(G), gy = new Float64Array(G), nx = new Float64Array(G), ny = new Float64Array(G);
  function cell(F, a, b, spA, spB) {
    FX.side(F, 'p1', a, b, gx); FX.side(F, 'p2', b, a, gy);
    norm(gx, nx); norm(gy, ny);
    const opp = s(ny, nx);
    const z = s(nx, ny) - (BREAK === 'sign' ? -opp : opp);
    return z + (spA == null ? spTerm(F, 'p1', a) : spA) - (spB == null ? spTerm(F, 'p2', b) : spB);
  }
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
      if (o.deadline && Date.now() > o.deadline) { COUNTERS.overBudget++; throw new Error('chomp2: over budget after ' + a + ' of 90 rows'); }
      const row = new Array(N);
      for (let b = 0; b < N; b++) row[b] = 1 / (1 + Math.exp(-tau * cell(F, a, b, spA[a], spB[b])));
      A.push(row);
    }
    COUNTERS.tables++; COUNTERS.cells += N * N;
    return { A, F, ms: Date.now() - t0, source, tau };
  }
  return { table, cell, logitRow, model: m, file, COUNTERS, features: FX, spreads, BROKEN: BREAK || null };
}

module.exports = { create, DEFAULT_MODEL, spreadSource };
