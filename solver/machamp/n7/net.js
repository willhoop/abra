/* solver/machamp/n7/net.js — the N7 net in Node: the PORYGON2 v3 student's value forward pass PLUS its policy head.
 *
 *   const N = require('./solver/machamp/n7/net.js').load(file);
 *   N.forward(X)    -> { logit, hidA, hidB }   X = solver/porygon2/v2/features.js encode() output (the student's input)
 *   N.logit(X)      P(p1 wins) logit — the SAME number solver/porygon2/v3/infer.js returns for the file (held to 1e-12 by
 *                   solver/tests/test-n7-loop.js NET, and to the Python export's float64 logits by its fixture)
 *   N.tilt(hid)     -> Float64Array(1 + NB): [beta, theta_0 .. theta_{NB-1}] — the policy head's output for one chair
 *   N.hasPolicy     the file carries a policy block (a v3 student file without one is a value-only net)
 *
 * THE FILE. A model file the N7 trainer exports (solver/machamp/n7/train.py export) is a v3-student file: arch "v3-student",
 * the student's own weight names, so solver/porygon2/leaf.js serves its VALUE as a MILTANK leaf unchanged. The policy head
 * rides in a separate `policy` block that solver/porygon2/v3/infer.js never reads:
 *   policy = { arch: 'tilt-v1', class_names: solver/gary/situation.js CLASS_NAMES, base_prior: { mag, doduo } (sha256 of the
 *              DODUO prior the head tilts), weights: { 'p.weight': [1 + NB, 64], 'p.bias': [1 + NB] } }
 *
 * THE POLICY HEAD (tilt-v1). The deciding chair's 64-unit head activation hid (g(me, them)'s first layer, the same hidden the
 * value is read from) goes through one linear map to (beta, theta). A joint cell k of the DODUO decision scores
 *     s_k = exp(beta) * lp_k + theta . bits_k
 * where lp_k is DODUO's log-probability of the cell and bits_k its 14 class bits (solver/gary/situation.js classBits) — GARY's
 * form (solver/gary/fit.js), conditioned on the board instead of a bucket. exp(beta) > 0 keeps the order of a cell DODUO
 * calls impossible; beta = theta = 0 is DODUO exactly, so the head starts AT the human anchor and the trainer's L2 on its
 * outputs pulls it back there.
 *
 * DELIBERATE BREAK (env N7_NET_BREAK=chair): the policy reads p1's hidden for both chairs. test-n7-loop.js NET must go red.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.N7_NET_BREAK) || '';

function decode(w) {
  const b = Buffer.from(w.f32_b64, 'base64');
  const f = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  return { shape: w.shape, data: Float64Array.from(f) };
}

function load(file) {
  const raw = fs.readFileSync(file);
  const J = JSON.parse(raw.toString('utf8'));
  if (J.arch !== 'v3-student') throw new Error('n7/net: not a v3-student file: ' + file);
  const W = {};
  for (const k of Object.keys(J.weights)) W[k] = decode(J.weights[k]);
  const P = J.policy ? Object.fromEntries(Object.entries(J.policy.weights).map(([k, w]) => [k, decode(w)])) : null;
  const VOC = J.vocab, KINDS = J.names.id_kinds, EDGES = J.rating_edges, h = J.hidden;
  const COUNTERS = { forwards: 0, tilts: 0 };
  const TABLE = { species: 'e_sp', item: 'e_it', ability: 'e_ab', move: 'e_mv' };
  const idOf = (kind, s) => { const v = VOC[kind][s]; return v == null ? 1 : v; };
  const emb = (name, idx) => { const w = W[name + '.weight']; const k = w.shape[1]; return w.data.subarray(idx * k, idx * k + k); };
  function lin(Wm, name, x, y, relu) {
    const w = Wm[name + '.weight'], b = Wm[name + '.bias'];
    const [o, i] = w.shape, wd = w.data, bd = b.data;
    for (let r = 0; r < o; r++) { let s = bd[r]; const off = r * i; for (let c = 0; c < i; c++) s += wd[off + c] * x[c]; y[r] = relu && s < 0 ? 0 : s; }
    return y;
  }
  const TIN = W['m1.weight'].shape[1], MV = W['e_mv.weight'].shape[1];
  const xin = new Float64Array(TIN), h1 = new Float64Array(48), mcode = new Float64Array(h);
  const sideBuf = [new Float64Array(16), new Float64Array(16)], fieldBuf = new Float64Array(16);
  const pool = [new Float64Array(2 * h), new Float64Array(2 * h)];
  const zin = new Float64Array(W['h1.weight'].shape[1]), out1 = new Float64Array(1);
  const HID = W['h1.weight'].shape[0];
  function member(tok, ids) {
    let o = 0;
    for (let q = 0; q < tok.length; q++) xin[o++] = tok[q];
    for (let j = 0; j < 6; j++) { const e = emb(TABLE[KINDS[j]], idOf(KINDS[j], ids[j])); for (let q = 0; q < e.length; q++) xin[o++] = e[q]; }
    const mv0 = o; for (let q = 0; q < MV; q++) xin[o++] = 0;
    for (let j = 6; j < 10; j++) { const e = emb('e_mv', idOf('move', ids[j])); for (let q = 0; q < MV; q++) xin[mv0 + q] += e[q] / 4; }
    lin(W, 'm1', xin, h1, true);
    return lin(W, 'm2', h1, mcode, true);
  }
  function rating(r) {
    if (r == null || !isFinite(r)) return { bin: 0, cont: 0 };
    let b = 1; for (const e of EDGES) if (r > e) b++;
    return { bin: b, cont: (r - 1300) / 200 };
  }
  function g(a, b, R, bs, hid) {
    let o = 0;
    for (const v of pool[a]) zin[o++] = v;
    for (const v of pool[b]) zin[o++] = v;
    for (const v of sideBuf[a]) zin[o++] = v;
    for (const v of sideBuf[b]) zin[o++] = v;
    for (const v of fieldBuf) zin[o++] = v;
    for (const s of [a, b]) { const e = emb('e_rb', R[s].bin); for (let q = 0; q < e.length; q++) zin[o++] = e[q] + R[s].cont * W.r_c.data[q]; }
    zin[o++] = bs[0]; zin[o++] = bs[1];
    lin(W, 'h1', zin, hid, true);
    return lin(W, 'h2', hid, out1, false)[0];
  }
  function forward(X) {
    COUNTERS.forwards++;
    ['p1', 'p2'].forEach((s, k) => {
      const Pl = pool[k]; Pl.fill(0); for (let q = 0; q < h; q++) Pl[h + q] = -Infinity;
      for (let i = 0; i < 6; i++) {
        const c = member(X.tok[s][i], X.ids[s][i]);
        for (let q = 0; q < h; q++) { Pl[q] += c[q] / 6; if (c[q] > Pl[h + q]) Pl[h + q] = c[q]; }
      }
      lin(W, 'sp', Float64Array.from([...X.side[s], ...X.facts[s]]), sideBuf[k], true);
    });
    lin(W, 'fp', Float64Array.from(X.field), fieldBuf, true);
    const R = [rating(X.rating[0]), rating(X.rating[1])];
    const hidA = new Float64Array(HID), hidB = new Float64Array(HID);
    const l12 = g(0, 1, R, X.base, hidA);
    const l21 = g(1, 0, R, [-X.base[0], -X.base[1]], hidB);
    return { logit: l12 - l21, hidA, hidB: BREAK === 'chair' ? hidA : hidB };
  }
  const NB = P ? P['p.weight'].shape[0] - 1 : 0;
  function tilt(hid) {
    if (!P) throw new Error('n7/net: ' + file + ' carries no policy head');
    COUNTERS.tilts++;
    return lin(P, 'p', hid, new Float64Array(1 + NB), false);
  }
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  return { forward, logit: X => forward(X).logit, value: X => 1 / (1 + Math.exp(-forward(X).logit)), tilt, hasPolicy: !!P, NB,
    policy: J.policy ? { arch: J.policy.arch, class_names: J.policy.class_names, base_prior: J.policy.base_prior } : null,
    n7: J.n7 || null, COUNTERS, sha256, file, BROKEN: BREAK || null };
}

module.exports = { load };
