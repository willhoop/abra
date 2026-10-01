/* ABRA-HEAP: 4096
 * solver/gary/fit.js — FIT GARY v1 and run its per-cell held-out gate against DODUO v1 (store-only, no simulator).
 *
 *   node solver/gary/fit.js --data solver/out/gary/<tag> --out solver/gary/model/gary-v1 [--folds 5] [--grid 3,10,...]
 *
 * THE MODEL. For one decision with valid joint cells k, DODUO v1 gives log-probabilities lp_k. GARY scores
 *     s_k = (1 + a) * lp_k + theta . bits_k ,      p_GARY = softmax(s)
 * where bits_k are the joint's class indicators (solver/gary/situation.js CLASS_NAMES) and (a, theta) is the SUM of four
 * additive levels: global + bucket + band + cell (cell = bucket x band). a = 0, theta = 0 is DODUO v1 exactly, so the
 * gate against DODUO asks precisely whether the population at that band, in that situation, clicks differently from
 * what DODUO predicts. The fit is L2-penalised maximum likelihood (a GLMM-style shrinkage: each level is pulled toward
 * zero, i.e. toward the level above it), by Newton's method on the exact Hessian. ONE penalty lambda for the bucket,
 * band and cell levels is chosen by K-fold cross-validation over PLAYERS on the FIT rows only (the global level gets
 * LAMBDA0, a declared guard); the eval (TEST-player) rows are read only after the model is frozen.
 *
 * THE GATE (DODUO clause; the tau* clause is solver/gary/gate.js). Per cell, on the eval rows: d = mean over decisions
 * of [-log p_GARY(human) + log p_DODUO(human)], with a 95% bootstrap CI that resamples GAMES (decisions of one game are
 * not independent), 2,000 resamples, seed 1. PASS iff the CI's upper bound < 0. The rule is fixed in
 * solver/gary/preregistration.json before the first fit.
 *
 * Deliberate breaks: GARY_BREAK=nofit discards the fitted parameters (DODUO returned); GARY_BREAK=gradsign flips the data
 * gradient. solver/tests/test-gary.js must go red under gradsign.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const S = require('./situation.js');

const NF = 1 + S.NB;                        // features per cell: lp, then the class bits
const LAMBDA0 = 1e-2;                       // the global level's guard penalty (declared, not tuned)

/* ---------- data ---------- */
function load(dirs) {
  const rows = [];
  let lpAll = [], bitsAll = [], base = 0;
  for (const dir of [].concat(dirs)) {
    const shards = fs.readdirSync(dir).filter(f => /^meta-\d+\.jsonl$/.test(f)).map(f => +f.match(/\d+/)[0]).sort((a, b) => a - b);
    for (const s of shards) {
      const lp = new Float32Array(fs.readFileSync(path.join(dir, `lp-${s}.f32`)).buffer.slice(0));
      const bb = fs.readFileSync(path.join(dir, `bits-${s}.u16`));
      const bits = new Uint16Array(bb.buffer.slice(bb.byteOffset, bb.byteOffset + bb.length));
      for (const l of fs.readFileSync(path.join(dir, `meta-${s}.jsonl`), 'utf8').split('\n')) {
        if (!l) continue;
        const m = JSON.parse(l);
        m.off += base;
        rows.push(m);
      }
      lpAll.push(lp); bitsAll.push(bits); base += lp.length;
    }
  }
  const LP = new Float32Array(base), BI = new Uint16Array(base);
  let o = 0; for (let i = 0; i < lpAll.length; i++) { LP.set(lpAll[i], o); BI.set(bitsAll[i], o); o += lpAll[i].length; }
  const bI = Object.fromEntries(S.BUCKETS.map((b, i) => [b, i])), nI = Object.fromEntries(S.BANDS.map((b, i) => [b, i]));
  for (const r of rows) { r.bi = bI[r.b]; r.ni = nI[r.band]; r.ci = r.bi * S.BANDS.length + r.ni; }
  return { rows, LP, BI };
}

/* group blocks: 0 global, 1..8 bucket, 9..14 band, 15.. cell */
const NBK = S.BUCKETS.length, NBD = S.BANDS.length, NCELL = NBK * NBD;
const NG = 1 + NBK + NBD + NCELL, NP = NG * NF;
const groupsOf = r => [0, 1 + r.bi, 1 + NBK + r.ni, 1 + NBK + NBD + r.ci];

/* effective (a, theta) for a cell: sum of its four blocks */
function cellParams(w, ci) {
  const bi = Math.floor(ci / NBD), ni = ci % NBD;
  const out = new Float64Array(NF);
  for (const g of [0, 1 + bi, 1 + NBK + ni, 1 + NBK + NBD + ci]) for (let f = 0; f < NF; f++) out[f] += w[g * NF + f];
  return out;
}

/* per-row log p(label) under params eff (NF); fills p (scratch) */
function rowLogp(D, r, eff, p) {
  const { LP, BI } = D;
  let mx = -Infinity;
  for (let k = 0; k < r.K; k++) {
    const c = r.off + k, bits = BI[c];
    let s = (1 + eff[0]) * LP[c];
    for (let f = 0; f < S.NB; f++) if (bits & (1 << f)) s += eff[1 + f];
    p[k] = s; if (s > mx) mx = s;
  }
  let z = 0; for (let k = 0; k < r.K; k++) { p[k] = Math.exp(p[k] - mx); z += p[k]; }
  for (let k = 0; k < r.K; k++) p[k] /= z;
  return Math.log(p[r.lab]);
}

/* the penalised NLL, its gradient and Hessian over the rows `idx` */
function accumulate(D, idx, w, lam, wantH) {
  const cellG = new Map();                       // ci -> { g: NF, H: NF*NF }
  let nll = 0;
  const p = new Float64Array(4096), x = new Float64Array(NF), mu = new Float64Array(NF);
  const effOf = new Map();
  for (const i of idx) {
    const r = D.rows[i];
    let eff = effOf.get(r.ci); if (!eff) { eff = cellParams(w, r.ci); effOf.set(r.ci, eff); }
    nll -= rowLogp(D, r, eff, p);
    let acc = cellG.get(r.ci); if (!acc) { acc = { g: new Float64Array(NF), H: wantH ? new Float64Array(NF * NF) : null }; cellG.set(r.ci, acc); }
    mu.fill(0);
    for (let k = 0; k < r.K; k++) {
      const c = r.off + k, bits = D.BI[c];
      x[0] = D.LP[c]; for (let f = 0; f < S.NB; f++) x[1 + f] = (bits >> f) & 1;
      const pk = p[k], y = k === r.lab ? 1 : 0;
      for (let f = 0; f < NF; f++) { acc.g[f] += (pk - y) * x[f]; mu[f] += pk * x[f]; }
      if (wantH) for (let f = 0; f < NF; f++) { const a = pk * x[f]; if (a === 0) continue; for (let h = f; h < NF; h++) acc.H[f * NF + h] += a * x[h]; }
    }
    if (wantH) for (let f = 0; f < NF; f++) for (let h = f; h < NF; h++) acc.H[f * NF + h] -= mu[f] * mu[h];
  }
  /* expand to the full parameter vector */
  const g = new Float64Array(NP), H = wantH ? new Float64Array(NP * NP) : null;
  for (const [ci, acc] of cellG) {
    const bi = Math.floor(ci / NBD), ni = ci % NBD;
    const gs = [0, 1 + bi, 1 + NBK + ni, 1 + NBK + NBD + ci];
    for (const ga of gs) for (let f = 0; f < NF; f++) g[ga * NF + f] += acc.g[f];
    if (wantH) for (const ga of gs) for (const gb of gs) for (let f = 0; f < NF; f++) for (let h = 0; h < NF; h++) {
      const v = f <= h ? acc.H[f * NF + h] : acc.H[h * NF + f];
      H[(ga * NF + f) * NP + gb * NF + h] += v;
    }
  }
  /* deliberate break GARY_BREAK=gradsign: the data gradient with the wrong sign (the fit walks away from the data) */
  if (process.env.GARY_BREAK === 'gradsign') for (let i = 0; i < NP; i++) g[i] = -g[i];
  /* penalty */
  let pen = 0;
  for (let gi = 0; gi < NG; gi++) {
    const L = gi === 0 ? LAMBDA0 : lam;
    for (let f = 0; f < NF; f++) { const v = w[gi * NF + f]; pen += L * v * v; g[gi * NF + f] += 2 * L * v; if (wantH) H[(gi * NF + f) * NP + gi * NF + f] += 2 * L; }
  }
  return { obj: nll + pen, nll, g, H, n: idx.length };
}

/* dense Cholesky solve of H d = g (H SPD after the ridge) */
function cholSolve(H, g, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = H[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) { if (!(s > 0)) s = 1e-9; L[i * n + i] = Math.sqrt(s); } else L[i * n + j] = s / L[j * n + j];
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = g[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; }
  return x;
}

/* only the blocks some row touches are free; the rest stay at 0 (their rows/cols would be pure ridge anyway) */
function newton(D, idx, lam, opts = {}) {
  let w = new Float64Array(NP);
  let cur = accumulate(D, idx, w, lam, true);
  const log = [];
  for (let it = 0; it < (opts.maxIter || 25); it++) {
    const d = cholSolve(cur.H, cur.g, NP);
    let step = 1, next = null, wn = null;
    for (let ls = 0; ls < 30; ls++) {
      wn = w.map((v, i) => v - step * d[i]);
      next = accumulate(D, idx, wn, lam, false);
      if (next.obj <= cur.obj - 1e-4 * step * d.reduce((s, v, i) => s + v * cur.g[i], 0)) break;
      step /= 2;
    }
    const dec = cur.obj - next.obj;
    w = wn;
    log.push({ it, obj: +next.obj.toFixed(4), step, dec: +dec.toFixed(6) });
    if (opts.verbose) console.log(`    newton ${it} obj ${next.obj.toFixed(3)} step ${step} dec ${dec.toExponential(2)}`);
    if (dec < 1e-6 * Math.max(1, Math.abs(next.obj)) || dec < 1e-5) break;
    cur = accumulate(D, idx, w, lam, true);
  }
  return { w, log };
}

/* ---------- evaluation ---------- */
function rowsLoss(D, idx, w) {
  const p = new Float64Array(4096);
  const effOf = new Map();
  return idx.map(i => {
    const r = D.rows[i];
    let eff = effOf.get(r.ci); if (!eff) { eff = w ? cellParams(w, r.ci) : new Float64Array(NF); effOf.set(r.ci, eff); }
    const lg = rowLogp(D, r, eff, p);
    let top = 0; for (let k = 1; k < r.K; k++) if (p[k] > p[top]) top = k;
    return { nll: -lg, top1: top === r.lab ? 1 : 0, doduo: -D.LP[r.off + r.lab] };
  });
}
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* game-clustered bootstrap of the mean of v (per decision), clusters by key */
function clusterCI(vals, keys, B = 2000, seed = 1) {
  const by = new Map();
  vals.forEach((v, i) => { const k = keys[i]; const c = by.get(k) || { s: 0, n: 0 }; c.s += v; c.n++; by.set(k, c); });
  const cl = [...by.values()];
  const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, n);
  if (cl.length < 2) return { mean, lo: -Infinity, hi: Infinity, n, clusters: cl.length };
  const rnd = mulberry(seed), bs = [];
  for (let b = 0; b < B; b++) {
    let s = 0, m = 0;
    for (let j = 0; j < cl.length; j++) { const c = cl[Math.floor(rnd() * cl.length)]; s += c.s; m += c.n; }
    bs.push(s / m);
  }
  bs.sort((a, b) => a - b);
  return { mean, lo: bs[Math.floor(0.025 * B)], hi: bs[Math.ceil(0.975 * B) - 1], n, clusters: cl.length };
}

function playerFold(pl, K) { return crypto.createHash('sha256').update('gary-cv:' + pl).digest().readUInt32BE(0) % K; }

function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const ROOT = path.join(__dirname, '..', '..');
  const DATA = flag('--data', null).split(',').map(d => path.resolve(ROOT, d));
  const OUT = path.resolve(ROOT, flag('--out', 'solver/gary/model/gary-v1'));
  const FOLDS = +flag('--folds', 5);
  const GRID = String(flag('--grid', '3,10,30,100,300,1000')).split(',').map(Number);
  const t0 = Date.now();
  const D = load(DATA);
  const fit = [], ev = [];
  D.rows.forEach((r, i) => (r.role === 'eval' ? ev : fit).push(i));
  console.log(`gary/fit: ${D.rows.length} rows (${fit.length} fit, ${ev.length} eval), ${D.LP.length} cells, ${NP} parameters`);

  /* 1. lambda by player-fold CV on FIT only */
  const cv = [];
  for (const lam of GRID) {
    let tot = 0, n = 0;
    for (let k = 0; k < FOLDS; k++) {
      const tr = fit.filter(i => playerFold(D.rows[i].pl, FOLDS) !== k), te = fit.filter(i => playerFold(D.rows[i].pl, FOLDS) === k);
      const { w } = newton(D, tr, lam);
      const L = rowsLoss(D, te, w);
      tot += L.reduce((s, x) => s + x.nll, 0); n += L.length;
    }
    cv.push({ lambda: lam, cv_logloss: tot / n });
    console.log(`  cv lambda ${lam}: ${(tot / n).toFixed(5)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const best = cv.reduce((a, b) => (b.cv_logloss < a.cv_logloss ? b : a));
  /* 2. the model: all FIT rows at the chosen lambda */
  const fitted = newton(D, fit, best.lambda, { verbose: true });
  const w = process.env.GARY_BREAK === 'nofit' ? new Float64Array(NP) : fitted.w;

  /* 3. the DODUO clause of the gate, per cell, on EVAL rows only */
  const L = rowsLoss(D, ev, w);
  const keyGame = ev.map(i => D.rows[i].g);
  const dvals = L.map(x => x.nll - x.doduo);
  const summarise = sel => {
    const v = sel.map(j => dvals[j]), k = sel.map(j => keyGame[j]);
    const ci = clusterCI(v, k);
    const g = sel.reduce((s, j) => s + L[j].nll, 0) / Math.max(1, sel.length), dd = sel.reduce((s, j) => s + L[j].doduo, 0) / Math.max(1, sel.length);
    const t1 = sel.reduce((s, j) => s + L[j].top1, 0) / Math.max(1, sel.length);
    return { n: sel.length, games: ci.clusters, gary_logloss: +g.toFixed(5), doduo_logloss: +dd.toFixed(5), delta: +ci.mean.toFixed(5), ci: [+ci.lo.toFixed(5), +ci.hi.toFixed(5)], gary_top1: +t1.toFixed(4), pass_doduo: ci.hi < 0 };
  };
  const all = [...ev.keys()];
  const cells = {};
  for (let bi = 0; bi < NBK; bi++) for (let ni = 0; ni < NBD; ni++) {
    const ci = bi * NBD + ni, sel = all.filter(j => D.rows[ev[j]].ci === ci);
    cells[S.BUCKETS[bi] + '|' + S.BANDS[ni]] = sel.length ? summarise(sel) : { n: 0, games: 0, pass_doduo: false };
  }
  const byBucket = Object.fromEntries(S.BUCKETS.map((b, bi) => [b, summarise(all.filter(j => D.rows[ev[j]].bi === bi))]));
  const byBand = Object.fromEntries(S.BANDS.map((b, ni) => [b, summarise(all.filter(j => D.rows[ev[j]].ni === ni))]));
  const overall = summarise(all);
  /* DODUO's own top-1 on the eval rows, as a sanity check against the published 25.4% (a different test set: this one
   * adds the TEST players' games after 2026-09-23) */
  let dTop = 0; for (const i of ev) { const r = D.rows[i]; let t = 0; for (let k = 1; k < r.K; k++) if (D.LP[r.off + k] > D.LP[r.off + t]) t = k; if (t === r.lab) dTop++; }

  const params = { global: Array.from(w.slice(0, NF)) };
  params.bucket = Object.fromEntries(S.BUCKETS.map((b, i) => [b, Array.from(w.slice((1 + i) * NF, (2 + i) * NF))]));
  params.band = Object.fromEntries(S.BANDS.map((b, i) => [b, Array.from(w.slice((1 + NBK + i) * NF, (2 + NBK + i) * NF))]));
  params.cell = {};
  for (let ci = 0; ci < NCELL; ci++) params.cell[S.BUCKETS[Math.floor(ci / NBD)] + '|' + S.BANDS[ci % NBD]] = Array.from(w.slice((1 + NBK + NBD + ci) * NF, (2 + NBK + NBD + ci) * NF));
  const manifests = DATA.map(d => { const p = path.join(d, 'manifest.json'); return fs.existsSync(p) ? { dir: path.relative(ROOT, d).replace(/\\/g, '/'), manifest_sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), human: JSON.parse(fs.readFileSync(p, 'utf8')).human } : { dir: d }; });
  const prereg = path.join(__dirname, 'preregistration.json');
  const model = {
    name: 'gary-v1', kind: 'GARY v1: DODUO v1 tilted per (situation bucket x rating band) toward the population', generated: new Date().toISOString(), generator: 'solver/gary/fit.js',
    buckets: S.BUCKETS, bands: S.BANDS, class_names: S.CLASS_NAMES, features: ['lp (scale 1+a on DODUO v1 log-probability)'].concat(S.CLASS_NAMES),
    levels: 'effective (a, theta) of a cell = global + bucket + band + cell', lambda0: LAMBDA0, lambda: best.lambda, cv, folds: FOLDS,
    doduo: { file: 'solver/mag/model/doduo-v1.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'mag', 'model', 'doduo-v1.json'))).digest('hex') },
    data: manifests, preregistration_sha256: fs.existsSync(prereg) ? crypto.createHash('sha256').update(fs.readFileSync(prereg)).digest('hex') : null,
    newton: fitted.log, broken: process.env.GARY_BREAK || null, params,
  };
  const metrics = {
    generator: 'solver/gary/fit.js', rows: { fit: fit.length, eval: ev.length }, doduo_eval_top1: +(dTop / ev.length).toFixed(4),
    rule: 'per cell, eval rows: delta = mean[-log p_GARY + log p_DODUO], 95% CI by game-clustered bootstrap (2,000, seed 1); PASS_DODUO iff CI upper < 0',
    overall, by_bucket: byBucket, by_band: byBand, cells,
    passing_cells_doduo: Object.entries(cells).filter(([, c]) => c.pass_doduo).map(([k]) => k), wall_s: (Date.now() - t0) / 1000,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT + '.json', JSON.stringify(model, null, 1));
  fs.writeFileSync(OUT + '.fit-metrics.json', JSON.stringify(metrics, null, 1));
  console.log(`gary/fit: lambda ${best.lambda}; eval overall GARY ${overall.gary_logloss} vs DODUO ${overall.doduo_logloss}, delta ${overall.delta} [${overall.ci}]; DODUO top-1 ${metrics.doduo_eval_top1}, GARY top-1 ${overall.gary_top1}`);
  console.log(`gary/fit: ${metrics.passing_cells_doduo.length} of ${NCELL} cells pass the DODUO clause; wrote ${path.relative(ROOT, OUT)}.json (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

module.exports = { load, newton, rowsLoss, cellParams, clusterCI, NF, NP, accumulate, rowLogp };
if (require.main === module) main();
