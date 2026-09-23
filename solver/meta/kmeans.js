/* solver/meta/kmeans.js — spherical k-means for sparse binary points (each point = the sorted index
 * list of its non-zero coordinates; every team has six, so every point has the same norm).
 * Similarity = dot(x, c/|c|). k-means++ seeding on cosine distance. Deterministic given a seed. */
'use strict';
const { rng } = require('./lib.js');

function norm(C, V, k) {
  const N = [];
  for (let c = 0; c < k; c++) {
    let s = 0; const row = C[c];
    for (let v = 0; v < V; v++) s += row[v] * row[v];
    const r = Math.sqrt(s) || 1;
    N.push(Float64Array.from(row, x => x / r));
  }
  return N;
}

function sim(x, cn) { let s = 0; for (const i of x) s += cn[i]; return s; }

/** Assign every point to its most similar normalised centroid. C = raw centroids. */
function assign(X, C, V) {
  const k = C.length, N = norm(C, V, k);
  return X.map(x => { let b = 0, bs = -1; for (let c = 0; c < k; c++) { const s = sim(x, N[c]); if (s > bs) { bs = s; b = c; } } return b; });
}

function once(X, V, k, R, maxIter) {
  const n = X.length, len = X[0].length;
  const C = [];
  // k-means++ on cosine distance 1 - sim
  const first = X[Math.floor(R() * n)];
  const mk = x => { const a = new Float64Array(V); for (const i of x) a[i] = 1; return a; };
  C.push(mk(first));
  const d = new Float64Array(n).fill(Infinity);
  while (C.length < k) {
    const cn = norm([C[C.length - 1]], V, 1)[0];
    let tot = 0;
    for (let i = 0; i < n; i++) { const di = 1 - sim(X[i], cn) / Math.sqrt(len); if (di < d[i]) d[i] = di; tot += d[i] * d[i]; }
    let t = R() * tot, j = 0;
    for (; j < n - 1; j++) { t -= d[j] * d[j]; if (t <= 0) break; }
    C.push(mk(X[j]));
  }
  let labels = new Int32Array(n).fill(-1), obj = 0;
  for (let it = 0; it < maxIter; it++) {
    const N = norm(C, V, k);
    let changed = 0; obj = 0;
    for (let i = 0; i < n; i++) {
      let b = 0, bs = -1;
      for (let c = 0; c < k; c++) { const s = sim(X[i], N[c]); if (s > bs) { bs = s; b = c; } }
      if (labels[i] !== b) { changed++; labels[i] = b; }
      obj += bs / Math.sqrt(len);
    }
    for (let c = 0; c < k; c++) C[c].fill(0);
    const cnt = new Int32Array(k);
    for (let i = 0; i < n; i++) { cnt[labels[i]]++; for (const v of X[i]) C[labels[i]][v] += 1; }
    // re-seed an empty cluster on the worst-fitted point
    for (let c = 0; c < k; c++) if (!cnt[c]) { const j = Math.floor(R() * n); for (const v of X[j]) C[c][v] = 1; changed++; }
    if (!changed) break;
  }
  return { labels: Array.from(labels), C, obj: obj / n };
}

/** Best (highest mean cosine) of `restarts` runs. Labels are canonicalised by cluster size, largest
 *  first, so two fits are comparable by eye; ARI does not need it. */
function fit(X, V, k, opts = {}) {
  const R = rng(opts.seed || 1);
  let best = null;
  for (let r = 0; r < (opts.restarts || 4); r++) {
    const m = once(X, V, k, R, opts.maxIter || 60);
    if (!best || m.obj > best.obj) best = m;
  }
  const size = new Array(k).fill(0); best.labels.forEach(l => size[l]++);
  const order = size.map((s, c) => [s, c]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const remap = new Array(k); order.forEach((c, i) => { remap[c] = i; });
  return { labels: best.labels.map(l => remap[l]), C: order.map(c => best.C[c]), obj: best.obj };
}

module.exports = { fit, assign };
