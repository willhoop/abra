/* solver/porygon2/v3/infer.js — the PORYGON2 v3 student's forward pass in Node, hand-written, float64 on the exported float32
 * weights (solver/porygon2/v3/student.py export, arch "v3-student").
 *
 *   const N = require('./solver/porygon2/v3/infer.js').load(file);
 *   N.logit(X)   X = solver/porygon2/v2/features.js encode() output (the SAME input v2 reads)
 *   N.value(X)   sigmoid(logit) = P(p1 wins)
 *
 * The computation of student.py Student.forward: the shared member MLP (v2's embeddings and numbers -> 48 -> h, ReLU),
 * mean and max pooling over each side's six, side code relu(sp([side, facts])), field code relu(fp(field)), rating code
 * e_rb[bin] + cont * r_c, the 64-unit head; logit = g(p1, p2) - g(p2, p1). solver/tests/test-porygon2-v3-student.js holds it
 * to Python's float64 logits within 1e-9.
 * DELIBERATE BREAK (env PORY2V3_INFER_BREAK=pool): max pooling is replaced by mean pooling; parity must go red.
 */
'use strict';
const fs = require('fs');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2V3_INFER_BREAK) || '';

function decode(w) {
  const b = Buffer.from(w.f32_b64, 'base64');
  const f = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  return { shape: w.shape, data: Float64Array.from(f) };
}

function load(file) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (J.arch !== 'v3-student') throw new Error('porygon2/v3/infer: not a v3 student: ' + file);
  const W = {};
  for (const k of Object.keys(J.weights)) W[k] = decode(J.weights[k]);
  const VOC = J.vocab, KINDS = J.names.id_kinds, EDGES = J.rating_edges, h = J.hidden;
  const COUNTERS = { evals: 0 };
  const TABLE = { species: 'e_sp', item: 'e_it', ability: 'e_ab', move: 'e_mv' };
  const idOf = (kind, s) => { const v = VOC[kind][s]; return v == null ? 1 : v; };
  const emb = (name, idx) => { const w = W[name + '.weight']; const k = w.shape[1]; return w.data.subarray(idx * k, idx * k + k); };
  /* y = relu?(W x + b) into a preallocated buffer */
  function lin(name, x, y, relu) {
    const w = W[name + '.weight'], b = W[name + '.bias'];
    const [o, i] = w.shape, wd = w.data, bd = b.data;
    for (let r = 0; r < o; r++) { let s = bd[r]; const off = r * i; for (let c = 0; c < i; c++) s += wd[off + c] * x[c]; y[r] = relu && s < 0 ? 0 : s; }
    return y;
  }
  const TIN = W['m1.weight'].shape[1], MV = W['e_mv.weight'].shape[1];
  const xin = new Float64Array(TIN), h1 = new Float64Array(48), mcode = new Float64Array(h);
  const sideBuf = [new Float64Array(16), new Float64Array(16)], fieldBuf = new Float64Array(16);
  const pool = [new Float64Array(2 * h), new Float64Array(2 * h)];
  const zin = new Float64Array(W['h1.weight'].shape[1]), hid = new Float64Array(64), out1 = new Float64Array(1);

  function member(tok, ids) {
    let o = 0;
    for (let q = 0; q < tok.length; q++) xin[o++] = tok[q];
    for (let j = 0; j < 6; j++) { const e = emb(TABLE[KINDS[j]], idOf(KINDS[j], ids[j])); for (let q = 0; q < e.length; q++) xin[o++] = e[q]; }
    const mv0 = o; for (let q = 0; q < MV; q++) xin[o++] = 0;
    for (let j = 6; j < 10; j++) { const e = emb('e_mv', idOf('move', ids[j])); for (let q = 0; q < MV; q++) xin[mv0 + q] += e[q] / 4; }
    lin('m1', xin, h1, true);
    return lin('m2', h1, mcode, true);
  }
  function rating(r) {
    if (r == null || !isFinite(r)) return { bin: 0, cont: 0 };
    let b = 1; for (const e of EDGES) if (r > e) b++;
    return { bin: b, cont: (r - 1300) / 200 };
  }
  function g(a, b, R, bs) {
    let o = 0;
    for (const v of pool[a]) zin[o++] = v;
    for (const v of pool[b]) zin[o++] = v;
    for (const v of sideBuf[a]) zin[o++] = v;
    for (const v of sideBuf[b]) zin[o++] = v;
    for (const v of fieldBuf) zin[o++] = v;
    for (const s of [a, b]) { const e = emb('e_rb', R[s].bin); for (let q = 0; q < e.length; q++) zin[o++] = e[q] + R[s].cont * W.r_c.data[q]; }
    zin[o++] = bs[0]; zin[o++] = bs[1];
    lin('h1', zin, hid, true);
    return lin('h2', hid, out1, false)[0];
  }
  function logit(X) {
    COUNTERS.evals++;
    ['p1', 'p2'].forEach((s, k) => {
      const P = pool[k]; P.fill(0); for (let q = 0; q < h; q++) P[h + q] = -Infinity;
      for (let i = 0; i < 6; i++) {
        const c = member(X.tok[s][i], X.ids[s][i]);
        for (let q = 0; q < h; q++) { P[q] += c[q] / 6; if (c[q] > P[h + q]) P[h + q] = c[q]; }
      }
      if (BREAK === 'pool') for (let q = 0; q < h; q++) P[h + q] = P[q];
      lin('sp', Float64Array.from([...X.side[s], ...X.facts[s]]), sideBuf[k], true);
    });
    lin('fp', Float64Array.from(X.field), fieldBuf, true);
    const R = [rating(X.rating[0]), rating(X.rating[1])];
    return g(0, 1, R, X.base) - g(1, 0, R, [-X.base[0], -X.base[1]]);
  }
  return { logit, value: X => 1 / (1 + Math.exp(-logit(X))), COUNTERS, meta: { model: J.model, arch: J.arch, release: J.release, hidden: h }, BROKEN: BREAK || null };
}

module.exports = { load };
