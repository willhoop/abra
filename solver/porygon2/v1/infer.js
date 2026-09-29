/* solver/porygon2/v1/infer.js — PORYGON2 v1's forward pass, hand-written, float64. Both architectures of train.py.
 *
 *   const N = require('./solver/porygon2/v1/infer.js').load(file);
 *   N.logit(X)   X = features.js encode(H) (or a fixture's raw row) -> the logit of P(p1 wins)
 *   N.value(X)   sigmoid(logit)
 *
 * Arithmetic, read off the exported weights (train.py is the reference; solver/tests/test-porygon2-v1.js holds the two
 * together on a fixture of raw rows):
 *   token  t = [tok ⊕ E_sp[species] ⊕ E_it[item] ⊕ E_ab[ability] ⊕ Σ_j mvw_j E_mv[move_j] / 4],  h_t = relu(t2 · relu(t1 · t))
 *   pools  P(side) = [ Σ w_t h_t / 4 , max_t (h_t if w_t > 0 else 0) , Σ active_t h_t / 2 ]
 *   sets   g(A,B) = h3 · relu(h2 · relu(h1 · [P(A) ⊕ side_A ⊕ P(B) ⊕ side_B ⊕ field ⊕ facts_A ⊕ facts_B]))
 *   attn   x = [h_A + s_me (6), h_B + s_op (6), sp·side_A + s_me, sp·side_B + s_op, fp·(field ⊕ facts_A ⊕ facts_B)]  (15 tokens)
 *          x += O · MHA(LN1 x) (keys with w = 0 masked);  x += f2 · relu(f1 · LN2 x)
 *          g(A,B) = h3 · relu(h2 · relu(h1 · [P'(A) ⊕ P'(B) ⊕ x_13 ⊕ x_14 ⊕ x_15]))    (P' = the pools over the mixed tokens)
 *   logit = g(A, B) − g(B, A)          antisymmetric by construction; dropout is off at inference
 * Inputs are rounded to float32 first (Math.fround): the Python side read them from float32 tensors.
 *
 * DELIBERATE BREAK (env PORY2V1_INFER_BREAK=mask): the attention key mask is dropped (fainted tokens are attended to), and
 * for `sets` the max pool is dropped. The agreement test must go red.
 */
'use strict';
const fs = require('fs');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2V1_INFER_BREAK) || '';

function decode(w) {
  const buf = Buffer.from(w.f32_b64, 'base64');
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return { shape: w.shape, d: Float64Array.from(f) };
}

function load(file) {
  const J = typeof file === 'string' ? JSON.parse(fs.readFileSync(file, 'utf8')) : file;
  if (!/^v1-(sets|attn)$/.test(J.arch || '')) throw new Error('porygon2/v1/infer: not a v1 model (arch ' + J.arch + ')');
  const ARCH = J.arch.slice(3);
  const W = {}; for (const k in J.weights) W[k] = decode(J.weights[k]);
  const D = J.dims, V = J.vocab;
  const TN = J.names.tok.length, SN = J.names.side.length, FN = J.names.field.length, KN = J.names.facts.length;
  const TOK = D.tok, T1 = D.t1;
  const TIN = TN + D.sp + D.it + D.ab + D.mv;
  if (W['t1.weight'].shape[1] !== TIN) throw new Error('porygon2/v1/infer: token width ' + W['t1.weight'].shape[1] + ' != ' + TIN);
  const COUNTERS = { evals: 0, unkIds: 0 };
  const fr = Math.fround;

  function lin(Wk, bk, x, out, relu, xo) {
    const w = W[Wk].d, b = W[bk].d, n = W[Wk].shape[1], m = W[Wk].shape[0];
    xo = xo || 0;
    for (let i = 0; i < m; i++) {
      let s = b[i]; const o = i * n;
      for (let j = 0; j < n; j++) s += w[o + j] * x[xo + j];
      out[i] = relu && s < 0 ? 0 : s;
    }
    return out;
  }
  const idx = (kind, s) => { const v = V[kind][s]; if (v == null) { COUNTERS.unkIds++; return 0; } return v; };
  const tin = new Float64Array(TIN), a1 = new Float64Array(T1);

  /* the 6 token codes of one side: [6][TOK] */
  function tokens(X, sd) {
    const H = [];
    const Esp = W['e_sp.weight'].d, Eit = W['e_it.weight'].d, Eab = W['e_ab.weight'].d, Emv = W['e_mv.weight'].d;
    for (let t = 0; t < 6; t++) {
      const tn = X.tok[sd][t], ids = X.ids[sd][t], mw = X.mvw[sd][t];
      let k = 0;
      for (let j = 0; j < TN; j++) tin[k++] = fr(tn[j]);
      const sp = idx('species', ids[0]), it = idx('item', ids[1]), ab = idx('ability', ids[2]);
      for (let j = 0; j < D.sp; j++) tin[k++] = Esp[sp * D.sp + j];
      for (let j = 0; j < D.it; j++) tin[k++] = Eit[it * D.it + j];
      for (let j = 0; j < D.ab; j++) tin[k++] = Eab[ab * D.ab + j];
      const mv = [3, 4, 5, 6].map(q => idx('move', ids[q]));
      for (let j = 0; j < D.mv; j++) {
        let s = 0; for (let q = 0; q < 4; q++) s += Emv[mv[q] * D.mv + j] * fr(mw[q]);
        tin[k++] = s / 4;
      }
      lin('t1.weight', 't1.bias', tin, a1, true);
      H.push(lin('t2.weight', 't2.bias', a1, new Float64Array(TOK), true));
    }
    return H;
  }
  /* the three pools over 6 codes (dim d) with the side's token weights */
  function pools(Hs, X, sd, d, out, o) {
    for (let j = 0; j < 3 * d; j++) out[o + j] = 0;
    const mx = new Float64Array(d).fill(-Infinity);
    for (let t = 0; t < 6; t++) {
      const w = fr(X.tok[sd][t][1]), act = fr(X.tok[sd][t][3]), h = Hs[t], on = w > 0 ? 1 : 0;
      for (let j = 0; j < d; j++) {
        out[o + j] += w * h[j] / 4;
        const v = h[j] * on; if (v > mx[j]) mx[j] = v;
        out[o + 2 * d + j] += act * h[j] / 2;
      }
    }
    for (let j = 0; j < d; j++) out[o + d + j] = (BREAK === 'mask' && ARCH === 'sets') ? 0 : mx[j];
    return out;
  }

  /* ---- sets */
  const H1 = D.head1, H2 = D.head2;
  const b1 = new Float64Array(H1), b2 = new Float64Array(H2), b3 = new Float64Array(1);
  function gSets(PA, sA, PB, sB, X, fa, fb) {
    const hin = new Float64Array(W['h1.weight'].shape[1]); let k = 0;
    for (let j = 0; j < 3 * TOK; j++) hin[k++] = PA[j];
    for (let j = 0; j < SN; j++) hin[k++] = fr(sA[j]);
    for (let j = 0; j < 3 * TOK; j++) hin[k++] = PB[j];
    for (let j = 0; j < SN; j++) hin[k++] = fr(sB[j]);
    for (let j = 0; j < FN; j++) hin[k++] = fr(X.field[j]);
    for (let j = 0; j < KN; j++) hin[k++] = fr(fa[j]);
    for (let j = 0; j < KN; j++) hin[k++] = fr(fb[j]);
    lin('h1.weight', 'h1.bias', hin, b1, true); lin('h2.weight', 'h2.bias', b1, b2, true);
    return lin('h3.weight', 'h3.bias', b2, b3, false)[0];
  }

  /* ---- attn */
  const NT = 15;
  function layerNorm(x, g, b, d, out) {
    let m = 0; for (let j = 0; j < d; j++) m += x[j]; m /= d;
    let v = 0; for (let j = 0; j < d; j++) { const q = x[j] - m; v += q * q; } v /= d;
    const inv = 1 / Math.sqrt(v + 1e-5);
    for (let j = 0; j < d; j++) out[j] = (x[j] - m) * inv * g[j] + b[j];
    return out;
  }
  function gAttn(hA, hB, X, sdA, sdB) {
    const d = TOK, NH = D.heads, dh = d / NH;
    const sme = W.s_me.d, sop = W.s_op.d;
    const x = [];
    for (let t = 0; t < 6; t++) { const r = new Float64Array(d); for (let j = 0; j < d; j++) r[j] = hA[t][j] + sme[j]; x.push(r); }
    for (let t = 0; t < 6; t++) { const r = new Float64Array(d); for (let j = 0; j < d; j++) r[j] = hB[t][j] + sop[j]; x.push(r); }
    const sAin = Float64Array.from(X.side[sdA], fr), sBin = Float64Array.from(X.side[sdB], fr);
    const rA = lin('sp.weight', 'sp.bias', sAin, new Float64Array(d), false); for (let j = 0; j < d; j++) rA[j] += sme[j]; x.push(rA);
    const rB = lin('sp.weight', 'sp.bias', sBin, new Float64Array(d), false); for (let j = 0; j < d; j++) rB[j] += sop[j]; x.push(rB);
    const fin = new Float64Array(FN + 2 * KN); let k = 0;
    for (let j = 0; j < FN; j++) fin[k++] = fr(X.field[j]);
    for (let j = 0; j < KN; j++) fin[k++] = fr(X.facts[sdA][j]);
    for (let j = 0; j < KN; j++) fin[k++] = fr(X.facts[sdB][j]);
    x.push(lin('fp.weight', 'fp.bias', fin, new Float64Array(d), false));
    const keep = new Array(NT).fill(true);
    if (BREAK !== 'mask') for (let t = 0; t < 6; t++) { keep[t] = fr(X.tok[sdA][t][1]) > 0; keep[6 + t] = fr(X.tok[sdB][t][1]) > 0; }
    /* attention */
    const y = new Float64Array(d), Q = [], K = [], Vv = [];
    for (let t = 0; t < NT; t++) {
      layerNorm(x[t], W['ln1.weight'].d, W['ln1.bias'].d, d, y);
      const qkv = lin('qkv.weight', 'qkv.bias', y, new Float64Array(3 * d), false);
      Q.push(qkv.subarray(0, d)); K.push(qkv.subarray(d, 2 * d)); Vv.push(qkv.subarray(2 * d, 3 * d));
    }
    const sc = 1 / Math.sqrt(dh), att = new Float64Array(NT), cat = new Float64Array(d), oo = new Float64Array(d);
    const x2 = [];
    for (let t = 0; t < NT; t++) {
      for (let h = 0; h < NH; h++) {
        let mx = -Infinity;
        for (let u = 0; u < NT; u++) {
          let s;
          if (!keep[u]) s = -1e9;
          else { s = 0; for (let j = h * dh; j < (h + 1) * dh; j++) s += Q[t][j] * K[u][j]; s *= sc; }
          att[u] = s; if (s > mx) mx = s;
        }
        let z = 0; for (let u = 0; u < NT; u++) { att[u] = Math.exp(att[u] - mx); z += att[u]; }
        for (let j = h * dh; j < (h + 1) * dh; j++) { let s = 0; for (let u = 0; u < NT; u++) s += att[u] * Vv[u][j]; cat[j] = s / z; }
      }
      lin('o.weight', 'o.bias', cat, oo, false);
      const r = new Float64Array(d); for (let j = 0; j < d; j++) r[j] = x[t][j] + oo[j];
      x2.push(r);
    }
    /* feed-forward */
    const f1 = new Float64Array(D.ffn), f2 = new Float64Array(d);
    for (let t = 0; t < NT; t++) {
      layerNorm(x2[t], W['ln2.weight'].d, W['ln2.bias'].d, d, y);
      lin('f1.weight', 'f1.bias', y, f1, true); lin('f2.weight', 'f2.bias', f1, f2, false);
      for (let j = 0; j < d; j++) x2[t][j] += f2[j];
    }
    const zin = new Float64Array(W['h1.weight'].shape[1]);
    pools(x2.slice(0, 6), X, sdA, d, zin, 0);
    pools(x2.slice(6, 12), X, sdB, d, zin, 3 * d);
    for (let q = 0; q < 3; q++) for (let j = 0; j < d; j++) zin[6 * d + q * d + j] = x2[12 + q][j];
    lin('h1.weight', 'h1.bias', zin, b1, true); lin('h2.weight', 'h2.bias', b1, b2, true);
    return lin('h3.weight', 'h3.bias', b2, b3, false)[0];
  }

  function logit(X) {
    COUNTERS.evals++;
    const hA = tokens(X, 'p1'), hB = tokens(X, 'p2');
    if (ARCH === 'sets') {
      const PA = pools(hA, X, 'p1', TOK, new Float64Array(3 * TOK), 0), PB = pools(hB, X, 'p2', TOK, new Float64Array(3 * TOK), 0);
      return gSets(PA, X.side.p1, PB, X.side.p2, X, X.facts.p1, X.facts.p2) - gSets(PB, X.side.p2, PA, X.side.p1, X, X.facts.p2, X.facts.p1);
    }
    return gAttn(hA, hB, X, 'p1', 'p2') - gAttn(hB, hA, X, 'p2', 'p1');
  }
  const value = X => 1 / (1 + Math.exp(-logit(X)));
  return { logit, value, COUNTERS, meta: { arch: J.arch, model: J.model, feature_version: J.feature_version, dims: D, engine_release: J.engine_release }, BROKEN: BREAK || null };
}

module.exports = { load };
