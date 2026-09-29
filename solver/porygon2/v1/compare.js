/* solver/porygon2/v1/compare.js — two EXPORTED v1 models on the SAME held-out rows, paired, clustered by game.
 *
 *   node solver/porygon2/v1/compare.js --a <model A json> --b <model B json> --human <build dir> --selfplay <dir,dir,...>
 *        [--boot 2000] --out <result.json>
 *
 * Why (2026-09-29, PORYGON2 v1-r1): train.py's gate reads each model against gen5 on ITS OWN test set, and r1's test set
 * holds p2v1-c1's test split, which v1's did not. This reads both models through the Node forward pass (infer.js, the
 * one the search uses) on one fixed row set — the test rows (split 2) of the directories given — and reports
 * log-loss and Brier against the OUTCOME for A, B and B − A, each with a 95% bootstrap interval over games.
 * Human rows are weighted by the number of test players in them (a test player's view), exactly as train.py does;
 * a self-play row weighs 1. Each model maps the build's ids through ITS OWN vocabulary (infer.js takes strings).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const INF = require('./infer.js');
const KINDS = ['species', 'item', 'ability', 'move', 'move', 'move', 'move'];
const A = path.resolve(ROOT, flag('--a')), B = path.resolve(ROOT, flag('--b'));
const NA = INF.load(A), NB = INF.load(B);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const BOOT = +flag('--boot', 2000);

function openDir(d) {
  const meta = JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8'));
  const nm = meta.names, NN = meta.N;
  const TN = nm.tok.length, SN = nm.side.length, FN = nm.field.length, KN = nm.facts.length, MC = nm.meta.length;
  const f32 = n => { const b = fs.readFileSync(path.join(d, n)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
  const i32 = n => { const b = fs.readFileSync(path.join(d, n)); return new Int32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
  const inv = {};
  for (const k of Object.keys(meta.vocab)) { inv[k] = []; for (const [s, i] of Object.entries(meta.vocab[k])) inv[k][i] = s; }
  return { dir: d, meta, NN, TN, SN, FN, KN, MC, col: Object.fromEntries(nm.meta.map((c, i) => [c, i])), inv,
    tok: f32('tok.f32'), ids: i32('ids.i32'), mvw: f32('mvw.f32'), side: f32('side.f32'), field: f32('field.f32'), facts: f32('facts.f32'),
    M: i32('meta.i32'), z: f32('z.f32') };
}
function rowX(D, i) {
  const sl = (arr, off, n) => Array.from(arr.subarray(off, off + n));
  const x = { tok: {}, ids: {}, mvw: {}, side: {}, facts: {}, field: sl(D.field, i * D.FN, D.FN) };
  ['p1', 'p2'].forEach((sd, k) => {
    x.tok[sd] = []; x.ids[sd] = []; x.mvw[sd] = [];
    for (let t = 0; t < 6; t++) {
      x.tok[sd].push(sl(D.tok, ((i * 2 + k) * 6 + t) * D.TN, D.TN));
      const o = ((i * 2 + k) * 6 + t) * 7;
      x.ids[sd].push(KINDS.map((kind, j) => D.inv[kind][D.ids[o + j]]));
      x.mvw[sd].push(sl(D.mvw, ((i * 2 + k) * 6 + t) * 4, 4));
    }
    x.side[sd] = sl(D.side, (i * 2 + k) * D.SN, D.SN);
    x.facts[sd] = sl(D.facts, (i * 2 + k) * D.KN, D.KN);
  });
  return x;
}
const ll = (lg, y) => Math.max(0, lg) + Math.log1p(Math.exp(-Math.abs(lg))) - y * lg;
const sig = lg => 1 / (1 + Math.exp(-lg));

function evaluate(dirs, kind) {
  const R = [];   // {g, w, llA, llB, brA, brB}
  let goff = 0;
  for (const d of dirs) {
    const D = openDir(path.resolve(ROOT, d));
    const c = D.col;
    for (let i = 0; i < D.NN; i++) {
      const s1 = D.M[i * D.MC + c.split_p1], s2 = D.M[i * D.MC + c.split_p2];
      const w = kind === 'human' ? (s1 === 2) + (s2 === 2) : (s1 === 2 ? 1 : 0);
      if (!w) continue;
      const x = rowX(D, i), y = D.z[i];
      const a = NA.logit(x), b = NB.logit(x);
      R.push({ g: goff + D.M[i * D.MC + c.game], w, llA: ll(a, y), llB: ll(b, y), brA: (sig(a) - y) ** 2, brB: (sig(b) - y) ** 2 });
    }
    goff += D.meta.games.length;
    console.log(`compare: ${d} ${kind} rows so far ${R.length}`);
  }
  const gid = new Map(); for (const r of R) if (!gid.has(r.g)) gid.set(r.g, gid.size);
  const G = gid.size;
  const stat = f => {
    const num = new Float64Array(G), den = new Float64Array(G);
    for (const r of R) { const k = gid.get(r.g); num[k] += f(r) * r.w; den[k] += r.w; }
    let sn = 0, sd = 0; for (let k = 0; k < G; k++) { sn += num[k]; sd += den[k]; }
    let s = 12345 >>> 0; const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 12)) >>> 0; return s / 4294967296; };
    const bs = [];
    for (let b = 0; b < BOOT; b++) { let n = 0, dd = 0; for (let k = 0; k < G; k++) { const j = Math.floor(rnd() * G); n += num[j]; dd += den[j]; } bs.push(n / dd); }
    bs.sort((p, q) => p - q);
    const q = p => bs[Math.min(BOOT - 1, Math.max(0, Math.round(p * (BOOT - 1))))];
    return { mean: +(sn / sd).toFixed(6), ci95: [+q(0.025).toFixed(6), +q(0.975).toFixed(6)], n_views: sd, n_games: G };
  };
  return { rows: R.length, a_logloss: stat(r => r.llA), b_logloss: stat(r => r.llB), b_minus_a_logloss: stat(r => r.llB - r.llA),
    a_brier: stat(r => r.brA), b_brier: stat(r => r.brB), b_minus_a_brier: stat(r => r.brB - r.brA) };
}

const human = flag('--human') ? [flag('--human')] : [];
const sp = String(flag('--selfplay', '')).split(',').filter(Boolean);
const res = { what: 'two exported PORYGON2 v1 models on the same held-out rows (split 2), paired, clustered by game; B − A < 0 means B predicts the outcome better',
  a: { path: flag('--a'), sha256: sha(A) }, b: { path: flag('--b'), sha256: sha(B) }, argv, boot: BOOT,
  human: human.length ? evaluate(human, 'human') : null, selfplay: sp.length ? evaluate(sp, 'selfplay') : null };
fs.mkdirSync(path.dirname(path.resolve(ROOT, flag('--out'))), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, flag('--out')), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ human: res.human && res.human.b_minus_a_logloss, selfplay: res.selfplay && res.selfplay.b_minus_a_logloss }));
