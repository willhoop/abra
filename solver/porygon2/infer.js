/* solver/porygon2/infer.js — PORYGON2 v0's forward pass, hand-written, float64.
 *
 *   const P2 = require('./solver/porygon2/infer.js').load([path]);    // default: model/porygon2-v0.json
 *   P2.logit(x)   x = features.js encode(pos) -> the logit of P(p1 wins)
 *   P2.value(x)   sigmoid(logit)
 *
 * It is the same arithmetic as train.py's Pory2.forward, read off the exported weights:
 *   token t = [tok_num ⊕ E_sp[species] ⊕ E_it[item] ⊕ E_ab[ability] ⊕ mean(E_mv[move1..4])]
 *   h_t     = relu(t2 · relu(t1 · t))
 *   side    = [ Σ w_t h_t / 4 , max_t h_t·[w_t>0] , Σ active_t h_t / 2 , side_num ]    (Deep Sets: order-free)
 *   g(a,b)  = h3 · relu(h2 · relu(h1 · [a ⊕ b ⊕ field ⊕ facts_a ⊕ facts_b]))      (dropout is off at inference)
 *   logit   = g(side_p1, side_p2) − g(side_p2, side_p1)                              (antisymmetric by construction)
 * Inputs are rounded to float32 first (Math.fround), because the Python side read them from float32 tensors;
 * that is what lets solver/tests/test-porygon2.js hold the two to ~1e-12 rather than to the float32 noise.
 *
 * DELIBERATE BREAK (env PORY2_INFER_BREAK=pool): the max pool is dropped. The agreement test must go red.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2_INFER_BREAK) || '';

function decode(w) {
  const buf = Buffer.from(w.f32_b64, 'base64');
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return { shape: w.shape, d: Float64Array.from(f) };
}

function load(file) {
  file = file || path.join(__dirname, 'model', 'porygon2-v0.json');
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  const W = {}; for (const k in J.weights) W[k] = decode(J.weights[k]);
  const D = J.dims, V = J.vocab;
  const TN = J.names.tok_num.length, SN = J.names.side.length, FN = J.names.field.length, KN = J.names.facts.length;
  const TOK = D.tok, H1 = D.head1, H2 = D.head2;
  const TIN = TN + D.sp + D.it + D.ab + D.mv;
  const SV = 3 * TOK + SN;
  const HIN = 2 * SV + FN + (J.facts_on ? 2 * KN : 0);
  if (W['t1.weight'].shape[1] !== TIN || W['h1.weight'].shape[1] !== HIN) throw new Error('porygon2/infer: weight shapes do not match the declared dims');
  const COUNTERS = { evals: 0, unkIds: 0 };

  /* y = relu?(W x + b), W [out, in] row-major */
  function lin(Wk, bk, x, out, relu) {
    const w = W[Wk].d, b = W[bk].d, n = W[Wk].shape[1], m = W[Wk].shape[0];
    for (let i = 0; i < m; i++) {
      let s = b[i]; const o = i * n;
      for (let j = 0; j < n; j++) s += w[o + j] * x[j];
      out[i] = relu && s < 0 ? 0 : s;
    }
    return out;
  }
  const idx = (kind, s) => { const v = V[kind][s]; if (v == null) { COUNTERS.unkIds++; return 0; } return v; };
  const tin = new Float64Array(TIN), a1 = new Float64Array(TOK), a2 = new Float64Array(TOK);
  const fr = Math.fround;

  function sideVec(x, sd) {
    const out = new Float64Array(SV);
    const mx = new Float64Array(TOK).fill(-Infinity); let anyW = false;
    for (let t = 0; t < 6; t++) {
      const tn = x.tokNum[sd][t], ids = x.tokId[sd][t];
      let k = 0;
      for (let j = 0; j < TN; j++) tin[k++] = fr(tn[j]);
      const sp = idx('species', ids[0]), it = idx('item', ids[1]), ab = idx('ability', ids[2]);
      for (let j = 0; j < D.sp; j++) tin[k++] = W['e_sp.weight'].d[sp * D.sp + j];
      for (let j = 0; j < D.it; j++) tin[k++] = W['e_it.weight'].d[it * D.it + j];
      for (let j = 0; j < D.ab; j++) tin[k++] = W['e_ab.weight'].d[ab * D.ab + j];
      const mv = [3, 4, 5, 6].map(q => idx('move', ids[q]));
      for (let j = 0; j < D.mv; j++) {
        let s = 0; for (const m of mv) s += W['e_mv.weight'].d[m * D.mv + j];
        tin[k++] = s / 4;
      }
      lin('t1.weight', 't1.bias', tin, a1, true);
      lin('t2.weight', 't2.bias', a1, a2, true);
      const w = fr(tn[1]), act = fr(tn[3]);
      const on = w > 0 ? 1 : 0;
      for (let j = 0; j < TOK; j++) {
        out[j] += w * a2[j] / 4;
        const v = a2[j] * on; if (v > mx[j]) mx[j] = v;
        out[2 * TOK + j] += act * a2[j] / 2;
      }
      anyW = true;
    }
    for (let j = 0; j < TOK; j++) out[TOK + j] = (BREAK === 'pool' || !anyW) ? 0 : mx[j];
    for (let j = 0; j < SN; j++) out[3 * TOK + j] = fr(x.side[sd][j]);
    return out;
  }
  const hin = new Float64Array(HIN), b1 = new Float64Array(H1), b2 = new Float64Array(H2), b3 = new Float64Array(1);
  function g(a, b, field, fa, fb) {
    let k = 0;
    for (let j = 0; j < SV; j++) hin[k++] = a[j];
    for (let j = 0; j < SV; j++) hin[k++] = b[j];
    for (let j = 0; j < FN; j++) hin[k++] = fr(field[j]);
    if (J.facts_on) { for (let j = 0; j < KN; j++) hin[k++] = fr(fa[j]); for (let j = 0; j < KN; j++) hin[k++] = fr(fb[j]); }
    lin('h1.weight', 'h1.bias', hin, b1, true);
    lin('h2.weight', 'h2.bias', b1, b2, true);
    return lin('h3.weight', 'h3.bias', b2, b3, false)[0];
  }
  function logit(x) {
    COUNTERS.evals++;
    const s1 = sideVec(x, 'p1'), s2 = sideVec(x, 'p2');
    return g(s1, s2, x.field, x.facts.p1, x.facts.p2) - g(s2, s1, x.field, x.facts.p2, x.facts.p1);
  }
  const value = x => 1 / (1 + Math.exp(-logit(x)));
  return { logit, value, COUNTERS, meta: { file, model: J.model, status: J.status, facts_on: J.facts_on, feature_version: J.feature_version, dims: D }, BROKEN: BREAK || null };
}

module.exports = { load };
