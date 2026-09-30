/* solver/porygon2/v2/infer.js — PORYGON2 v2's forward pass in Node, hand-written, float64 on the exported float32 weights.
 *
 *   const N = require('./solver/porygon2/v2/infer.js').load(file);
 *   N.logit(X)   X = features.js encode() output: { tok:{p1,p2}[6][TN], ids:{p1,p2}[6][10] strings, side, field, facts, base, rating:[r1,r2] }
 *   N.value(X)   sigmoid(logit) = P(p1 wins)
 *
 * The same computation as solver/porygon2/v2/net.py Net.forward (no dropout at inference): member MLP, 17 tokens, 2 pre-LN
 * blocks with the rating context added to every query, final LayerNorm, value head; logit = g(p1, p2) - g(p2, p1).
 * solver/tests/test-porygon2-v2.js holds it to Python's float64 logits within 1e-9.
 * DELIBERATE BREAK (env PORY2V2_INFER_BREAK=rating): the rating context is not added to the queries; parity must go red.
 */
'use strict';
const fs = require('fs');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2V2_INFER_BREAK) || '';

function decode(w) {
  const b = Buffer.from(w.f32_b64, 'base64');
  const f = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  return { shape: w.shape, data: Float64Array.from(f) };
}

function load(file) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (J.arch !== 'v2-transformer') throw new Error('porygon2/v2/infer: not a v2 model: ' + file);
  const W = {};
  for (const k of Object.keys(J.weights)) W[k] = decode(J.weights[k]);
  const D = J.dims, d = D.d, H = D.heads, dh = d / H, EPS = J.layernorm_eps || 1e-5;
  const VOC = J.vocab, KINDS = J.names.id_kinds, EDGES = J.rating_edges;
  const COUNTERS = { evals: 0 };

  const lin = (name, x) => {          // y = W x + b, W [out,in]
    const w = W[name + '.weight'], b = W[name + '.bias'];
    const [o, i] = w.shape, y = new Float64Array(o);
    for (let r = 0; r < o; r++) { let s = b ? b.data[r] : 0; const off = r * i; for (let c = 0; c < i; c++) s += w.data[off + c] * x[c]; y[r] = s; }
    return y;
  };
  const ln = (name, x) => {
    const n = x.length; let mu = 0; for (let i = 0; i < n; i++) mu += x[i]; mu /= n;
    let v = 0; for (let i = 0; i < n; i++) v += (x[i] - mu) * (x[i] - mu); v /= n;
    const sd = Math.sqrt(v + EPS), g = W[name + '.weight'].data, b = W[name + '.bias'].data, y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = (x[i] - mu) / sd * g[i] + b[i];
    return y;
  };
  const relu = x => x.map(v => (v > 0 ? v : 0));
  const emb = (name, idx) => { const w = W[name + '.weight']; const k = w.shape[1]; return w.data.subarray(idx * k, idx * k + k); };
  const idOf = (kind, s) => { const v = VOC[kind][s]; return v == null ? 1 : v; };
  const TABLE = { species: 'e_sp', item: 'e_it', ability: 'e_ab', move: 'e_mv' };

  function member(tok, ids) {
    const parts = [Float64Array.from(tok)];
    for (let j = 0; j < 6; j++) parts.push(emb(TABLE[KINDS[j]], idOf(KINDS[j], ids[j])));
    const mv = new Float64Array(W['e_mv.weight'].shape[1]);
    for (let j = 6; j < 10; j++) { const e = emb('e_mv', idOf('move', ids[j])); for (let q = 0; q < mv.length; q++) mv[q] += e[q] / 4; }
    parts.push(mv);
    let n = 0; for (const p of parts) n += p.length;
    const x = new Float64Array(n); let o = 0; for (const p of parts) { x.set(p, o); o += p.length; }
    return lin('t2', relu(lin('t1', x)));
  }
  function rating(r) {
    if (r == null || !isFinite(r)) return { bin: 0, cont: 0 };
    let b = 1; for (const e of EDGES) if (r > e) b++;
    return { bin: b, cont: (r - 1300) / 200 };
  }
  const add = (a, b) => { const y = new Float64Array(a.length); for (let i = 0; i < a.length; i++) y[i] = a[i] + b[i]; return y; };
  const typ = k => W.typ.data.subarray(k * d, k * d + d);

  function g(h, side, fieldTok, R, a, b, bs) {
    const rme = add(emb('e_rb', R[a].bin), W.r_c.data.map(v => v * R[a].cont));
    const rop = add(emb('e_rb', R[b].bin), W.r_c.data.map(v => v * R[b].cont));
    let x = [...h[a].map(t => add(t, typ(0))), ...h[b].map(t => add(t, typ(1))), add(side[a], typ(2)), add(side[b], typ(3)),
      add(fieldTok, typ(4)), add(rme, typ(5)), add(rop, typ(6))];
    const rc = new Float64Array(2 * d); rc.set(rme, 0); rc.set(rop, d);
    const T = x.length;
    for (let L = 0; L < D.blocks; L++) {
      const p = 'blocks.' + L + '.';
      const rq = BREAK === 'rating' ? new Float64Array(d) : lin(p + 'rq', rc);
      const Q = [], K = [], V = [];
      for (let t = 0; t < T; t++) {
        const qkv = lin(p + 'qkv', ln(p + 'ln1', x[t]));
        Q.push(add(qkv.subarray(0, d), rq)); K.push(qkv.subarray(d, 2 * d)); V.push(qkv.subarray(2 * d, 3 * d));
      }
      const out = [];
      for (let t = 0; t < T; t++) {
        const cat = new Float64Array(d);
        for (let hh = 0; hh < H; hh++) {
          const o = hh * dh, sc = new Float64Array(T); let mx = -Infinity;
          for (let u = 0; u < T; u++) { let s = 0; for (let q = 0; q < dh; q++) s += Q[t][o + q] * K[u][o + q]; s /= Math.sqrt(dh); sc[u] = s; if (s > mx) mx = s; }
          let z = 0; for (let u = 0; u < T; u++) { sc[u] = Math.exp(sc[u] - mx); z += sc[u]; }
          for (let u = 0; u < T; u++) { const w = sc[u] / z; for (let q = 0; q < dh; q++) cat[o + q] += w * V[u][o + q]; }
        }
        out.push(cat);
      }
      x = x.map((xt, t) => add(xt, lin(p + 'o', out[t])));
      x = x.map(xt => add(xt, lin(p + 'f2', relu(lin(p + 'f1', ln(p + 'ln2', xt))))));
    }
    x = x.map(xt => ln('lnf', xt));
    const mean = (lo, hi) => { const m = new Float64Array(d); for (let t = lo; t < hi; t++) for (let q = 0; q < d; q++) m[q] += x[t][q] / (hi - lo); return m; };
    const z = new Float64Array(7 * d + 2);
    [mean(0, 6), mean(6, 12), x[12], x[13], x[14], x[15], x[16]].forEach((v, k) => z.set(v, k * d));
    z[7 * d] = bs[0]; z[7 * d + 1] = bs[1];
    return lin('h2', relu(lin('h1', z)))[0];
  }

  function logit(X) {
    COUNTERS.evals++;
    const S = ['p1', 'p2'];
    const h = S.map(s => X.tok[s].map((t, i) => member(t, X.ids[s][i])));
    const side = S.map(s => lin('sp', Float64Array.from([...X.side[s], ...X.facts[s]])));
    const fieldTok = lin('fp', Float64Array.from(X.field));
    const R = [rating(X.rating[0]), rating(X.rating[1])];
    const bs = X.base;
    return g(h, side, fieldTok, R, 0, 1, bs) - g(h, side, fieldTok, R, 1, 0, [-bs[0], -bs[1]]);
  }
  return { logit, value: X => 1 / (1 + Math.exp(-logit(X))), COUNTERS, meta: { model: J.model, arch: J.arch, release: J.release, dims: D }, BROKEN: BREAK || null };
}

module.exports = { load };
