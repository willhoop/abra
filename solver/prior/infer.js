/* solver/prior/infer.js — Node inference for the human policy prior (hand-written forward pass).
 *
 *   const P = require('./solver/prior/infer.js').load();          // model + train frequency tables
 *   const r = P.predict(row, turnIndex, 'p1');                     // row = { game, turns } (dataset schema)
 *   r.top(8)   -> [{ a, b, p, ka, kb }]  the 8 most likely JOINT actions (a/b = candidate index per slot)
 *   r.slotMarginal(0|1) -> Float64Array over that slot's candidates
 *
 * The decision is featurised by solver/prior/features.js — the same function the trainer's tensors
 * came from. The math mirrors train.py Model.joint exactly; solver/tests/test-prior-agree.js holds
 * the two to 1e-6 on real decisions.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('./features.js');

const MODEL_DIR = path.join(__dirname, 'model');

function load(opts = {}) {
  const mpath = opts.model || path.join(MODEL_DIR, 'prior-v0.json');
  const fpath = opts.freq || path.join(MODEL_DIR, 'freq-v0.json');
  const M = JSON.parse(fs.readFileSync(mpath, 'utf8'));
  const freq = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  if (M.feature_version !== F.FEATURE_VERSION) throw new Error(`prior: model feature_version ${M.feature_version} != features.js ${F.FEATURE_VERSION}`);
  if (M.ctx_names.join() !== F.CTX_NAMES.join() || M.cand_names.join() !== F.CAND_NAMES.join()) throw new Error('prior: feature layout differs from the model');
  const p = M.params;
  const H = p.b1.length, R = p.U.length, EMB = p.E[0].length;
  const DIN = F.CTX_F + F.CAND_F + EMB;

  function candVec(ctx, c) {
    const x = new Float64Array(DIN);
    for (let i = 0; i < F.CTX_F; i++) x[i] = (ctx[i] - M.mu[i]) / M.sd[i];
    for (let i = 0; i < F.CAND_F; i++) x[F.CTX_F + i] = (c.f[i] - M.mu[F.CTX_F + i]) / M.sd[F.CTX_F + i];
    const tok = c.attr.mv === 'LOCKED' ? 'LOCKED' : c.attr.mv;
    const row = M.emb_rows[tok] != null ? M.emb_rows[tok] : 0;
    for (let i = 0; i < EMB; i++) x[F.CTX_F + F.CAND_F + i] = p.E[row][i];
    return x;
  }
  function candForward(ctx, c) {
    /* float32 round trip on the inputs: the trainer read float32 tensors, so the live path does too */
    const f32 = a => Float64Array.from(Float32Array.from(a));
    const x = candVec(f32(ctx), { f: f32(c.f), attr: c.attr });
    const h = new Float64Array(H);
    for (let j = 0; j < H; j++) { let z = p.b1[j]; const w = p.W1[j]; for (let i = 0; i < DIN; i++) z += w[i] * x[i]; h[j] = z > 0 ? z : 0; }
    let s = 0; for (let j = 0; j < H; j++) s += p.w2[j] * h[j];
    const u = new Float64Array(R), v = new Float64Array(R);
    for (let r = 0; r < R; r++) { let a = 0, b = 0; for (let j = 0; j < H; j++) { a += p.U[r][j] * h[j]; b += p.V[r][j] * h[j]; } u[r] = a; v[r] = b; }
    return { s, u, v };
  }

  /* joint logits over VALID cells; a one-slot decision is a column vector */
  function logits(d) {
    const [A, B] = d.slots;
    const one = s => (s ? s.cands.map(c => candForward(s.ctx, c)) : [{ s: 0, u: new Float64Array(R), v: new Float64Array(R) }]);
    const fa = one(A), fb = one(B);
    const both = !!(A && B);
    const L = [];
    for (let i = 0; i < fa.length; i++) {
      const row = [];
      for (let j = 0; j < fb.length; j++) {
        if (both && !F.pairValid(A.cands[i].attr, B.cands[j].attr)) { row.push(-Infinity); continue; }
        let l = fa[i].s + fb[j].s;
        if (M.pair && both) {
          for (let r = 0; r < R; r++) l += fa[i].u[r] * fb[j].v[r];
          const pf = F.pairFeat(A.cands[i].attr, B.cands[j].attr);
          for (let k = 0; k < pf.length; k++) l += p.wp[k] * pf[k];
        }
        row.push(l);
      }
      L.push(row);
    }
    return L;
  }

  function predict(row, t, side) {
    const d = F.decide(row, t, side, freq);
    if (!d.slots[0] && !d.slots[1]) return null;
    const L = logits(d);
    let mx = -Infinity;
    for (const r of L) for (const x of r) if (x > mx) mx = x;
    let Z = 0; for (const r of L) for (const x of r) Z += Math.exp(x - mx);
    const cells = [];
    L.forEach((r, i) => r.forEach((x, j) => { if (x > -Infinity) cells.push({ a: i, b: j, p: Math.exp(x - mx) / Z }); }));
    const sorted = cells.slice().sort((x, y) => y.p - x.p);
    const key = (s, i) => (s ? s.cands[i].key : null);
    return {
      decision: d, logits: L, cells,
      top: k => sorted.slice(0, k).map(c => ({ ...c, ka: key(d.slots[0], c.a), kb: key(d.slots[1], c.b) })),
      slotMarginal: k => {
        const n = k === 0 ? L.length : L[0].length, m = new Float64Array(n);
        for (const c of cells) m[k === 0 ? c.a : c.b] += c.p;
        return m;
      },
    };
  }
  return { M, freq, logits, predict, decide: (row, t, side) => F.decide(row, t, side, freq) };
}

module.exports = { load };
