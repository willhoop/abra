/* solver/mag/infer.js — Node forward pass for MAG v1 (per-slot scorer) and DODUO v1 (joint coordinator).
 *
 *   const M = require('./solver/mag/infer.js').load();
 *   const r = M.predict(row, turnIndex, 'p1');        // row = { game, turns } (dataset schema)
 *   r.top(16)            -> the 16 most likely JOINT actions under DODUO  [{ a, b, p, ka, kb }]
 *   r.top(16, 'mag')     -> the same under MAG alone (factorised: the two slots independent)
 *   r.slotScores(0|1)    -> MAG's per-candidate scores for that slot (softmax them for P_MAG)
 *
 * Hand-written, dependency-free. The math mirrors solver/mag/train.py MagDoduo.forward exactly;
 * solver/tests/test-mag-doduo.js holds the two to 1e-9 on real held-out decisions.
 * The featuriser is solver/mag/features.js — the function the trainer's tensors came from.
 *
 * One documented difference from the trainer: a species absent from the WHOLE training dataset maps
 * to the "rare" embedding row here (the trainer could never see one; its vocabulary is the dataset's).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('./features.js');
const F0 = F.V0;

const ROOT = path.join(__dirname, '..', '..');
const MODEL_DIR = path.join(__dirname, 'model');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function load(opts = {}) {
  const mpath = opts.mag || path.join(MODEL_DIR, 'mag-v1.json');
  const dpath = opts.doduo || path.join(MODEL_DIR, 'doduo-v1.json');
  const M = JSON.parse(fs.readFileSync(mpath, 'utf8'));
  const Dj = JSON.parse(fs.readFileSync(dpath, 'utf8'));
  if (Dj.mag.sha256 !== sha(mpath)) throw new Error('doduo-v1 was trained over a different MAG file than ' + mpath);
  if (M.v0_feature_version !== F0.FEATURE_VERSION || M.feature_version !== F.FEATURE_VERSION) throw new Error('mag: feature version differs from the model');
  if (M.ctx_names.join() !== F0.CTX_NAMES.join() || M.cand_names.join() !== F0.CAND_NAMES.join() || M.slot_x_names.join() !== F.SLOT_X_NAMES.join()) throw new Error('mag: feature layout differs from the model');
  const fpath = path.resolve(ROOT, M.freq.path.split('\\').join('/'));    // written on Windows
  if (sha(fpath) !== M.freq.sha256) throw new Error('mag: frequency table ' + M.freq.path + ' is not the one the model was trained with');
  const freq = JSON.parse(fs.readFileSync(fpath, 'utf8'));

  const P = { ...M.params, ...Dj.params };
  const Emv = P['E_mv.weight'], Esp = P['E_sp.weight'];
  const W1 = P['l1.weight'], b1 = P['l1.bias'], W2 = P['l2.weight'], b2 = P['l2.bias'];
  const ws = P['s.weight'][0], bs = P['s.bias'][0];
  const ra = P['ra.weight'][0], rb = P['rb.weight'][0];
  const U = P['U.weight'], V = P['V.weight'], wp = P['wp.weight'][0];
  const Pa = P['Pa.weight'], Pb = P['Pb.weight'], Pbb = P['Pb.bias'], Pp = P['Pp.weight'], q = P['q.weight'][0];
  const H = b1.length, E = Emv[0].length, R = U.length, Q = Pa.length;
  const CF = F0.CTX_F, KF = F0.CAND_F;
  const DIN = CF + KF + E + E + 4 * E + 3 * E;
  if (W1[0].length !== DIN) throw new Error('mag: l1 input width ' + W1[0].length + ' != ' + DIN);

  const f32 = a => Float64Array.from(Float32Array.from(a));        // the trainer read float32 tensors
  const spRow = id => (!id ? 0 : M.species_rows[id] != null ? M.species_rows[id] : 1);
  const mvRow = tok => (M.move_rows[tok] != null ? M.move_rows[tok] : 0);
  const matvec = (W, x, b) => { const o = new Float64Array(W.length); for (let j = 0; j < W.length; j++) { let z = b ? b[j] : 0; const w = W[j]; for (let i = 0; i < x.length; i++) z += w[i] * x[i]; o[j] = z; } return o; };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const relu = v => v.map(z => (z > 0 ? z : 0));

  /* one slot: per-candidate MAG score s, DODUO unary r (for a slot position), and the h2 vectors */
  function slotForward(s, posB) {
    const ctx = f32(s.ctx);
    const rows = s.sx.map(spRow);
    const slotv = [];
    for (let k = 0; k < 4; k++) slotv.push(...Esp[rows[k]]);
    for (const lo of [4, 10, 16]) {
      const acc = new Float64Array(E); let n = 0;
      for (let k = lo; k < lo + 6; k++) if (rows[k] > 0) { n++; for (let e = 0; e < E; e++) acc[e] += Esp[rows[k]][e]; }
      for (let e = 0; e < E; e++) slotv.push(acc[e] / Math.max(n, 1));
    }
    const h1s = s.cands.map(c => {
      const x = new Float64Array(DIN);
      const cf = f32(c.f);
      for (let i = 0; i < CF; i++) x[i] = (ctx[i] - M.mu[i]) / M.sd[i];
      for (let i = 0; i < KF; i++) x[CF + i] = (cf[i] - M.mu[CF + i]) / M.sd[CF + i];
      const em = Emv[mvRow(c.attr.mv)], et = Esp[spRow(c.tx)];
      for (let e = 0; e < E; e++) { x[CF + KF + e] = em[e]; x[CF + KF + E + e] = et[e]; }
      for (let i = 0; i < slotv.length; i++) x[CF + KF + 2 * E + i] = slotv[i];
      return relu(matvec(W1, x, b1));
    });
    const pool = new Float64Array(H);
    for (const h of h1s) for (let j = 0; j < H; j++) pool[j] += h[j] / h1s.length;
    return h1s.map(h1 => {
      const x = new Float64Array(2 * H); x.set(h1, 0); x.set(pool, H);
      const h2 = relu(matvec(W2, x, b2));
      return { s: dot(ws, h2) + bs, r: dot(posB ? rb : ra, h2), h2, u: posB ? null : matvec(U, h2), v: posB ? matvec(V, h2) : null,
        p: posB ? matvec(Pb, h2, Pbb) : matvec(Pa, h2) };
    });
  }

  /* joint logits over the VALID cells: { joint, mag } (-Infinity = invalid); one-slot = a column */
  function logits(d) {
    const [A, B] = d.slots;
    const NULL = { s: 0, r: 0 };
    const fa = A ? slotForward(A, false) : [NULL], fb = B ? slotForward(B, true) : [NULL];
    const both = !!(A && B);
    const joint = [], mag = [];
    for (let i = 0; i < fa.length; i++) {
      const rj = [], rm = [];
      for (let j = 0; j < fb.length; j++) {
        if (both && !F0.pairValid(A.cands[i].attr, B.cands[j].attr)) { rj.push(-Infinity); rm.push(-Infinity); continue; }
        const lm = fa[i].s + fb[j].s;
        let l = lm + fa[i].r + fb[j].r;
        if (both) {
          const pf = F0.pairFeat(A.cands[i].attr, B.cands[j].attr);
          l += dot(fa[i].u, fb[j].v) + dot(wp, pf);
          let zq = 0;
          for (let k = 0; k < Q; k++) { const z = fa[i].p[k] + fb[j].p[k] + dot(Pp[k], pf); zq += q[k] * (z > 0 ? z : 0); }
          l += zq;
        }
        rj.push(l); rm.push(lm);
      }
      joint.push(rj); mag.push(rm);
    }
    return { joint, mag, fa, fb };
  }

  function softmaxCells(L) {
    let mx = -Infinity; for (const r of L) for (const x of r) if (x > mx) mx = x;
    let Z = 0; for (const r of L) for (const x of r) Z += Math.exp(x - mx);
    const cells = [];
    L.forEach((r, i) => r.forEach((x, j) => { if (x > -Infinity) cells.push({ a: i, b: j, p: Math.exp(x - mx) / Z }); }));
    return cells.sort((x, y) => y.p - x.p);
  }

  function predict(row, t, side) {
    const d = F.decide(row, t, side, freq);
    if (!d.slots[0] && !d.slots[1]) return null;
    const L = logits(d);
    const cells = { joint: softmaxCells(L.joint), mag: softmaxCells(L.mag) };
    const key = (s, i) => (s ? s.cands[i].key : null);
    return {
      decision: d, logits: L.joint, magLogits: L.mag, cells: cells.joint,
      top: (k, which = 'joint') => cells[which].slice(0, k).map(c => ({ ...c, ka: key(d.slots[0], c.a), kb: key(d.slots[1], c.b) })),
      slotScores: k => (d.slots[k] ? (k === 0 ? L.fa : L.fb).map(x => x.s) : null),
    };
  }
  return { M, D: Dj, freq, logits, predict, decide: (row, t, side) => F.decide(row, t, side, freq) };
}

module.exports = { load };
