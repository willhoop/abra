/* solver/meta/lib.js — shared helpers for the Reg M-C meta analysis. Pure functions only; no I/O
 * except the streaming readers and the file digest. Nothing here names a Pokemon value: every
 * legality fact is read from the M-C Showdown checkout at run time (see legality.js). */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'solver', 'out', 'meta');
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const toID = s => (s == null ? '' : String(s)).toLowerCase().replace(/[^a-z0-9]+/g, '');

function sha256File(abs) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 22);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

/** Stat + digest a file for the manifest. The digest is taken BEFORE reading so a concurrent append
 *  between digest and read is detectable: the caller re-stats after reading and compares sizes. */
function fileReceipt(abs) {
  const st = fs.statSync(abs);
  return { path: rel(abs), bytes: st.size, mtime: st.mtime.toISOString(), sha256: sha256File(abs) };
}

/** Stream a .jsonl or .jsonl.gz, calling fn(obj, lineNo). Bad lines are counted, not thrown. */
async function eachJsonl(abs, fn) {
  let input = fs.createReadStream(abs);
  if (/\.gz$/.test(abs)) input = input.pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let n = 0, bad = 0;
  for await (const line of rl) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { bad++; continue; }
    n++;
    fn(o, n);
  }
  return { rows: n, bad };
}

/* ---- statistics ------------------------------------------------------------------------------ */

/** Wilson score interval, 95% by default. */
function wilson(k, n, z = 1.959963984540054) {
  if (!n) return [null, null];
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Cluster-robust (linearised ratio-estimator) SE of p = sum(c)/sum(n) over clusters g.
 *  clusters: array of [c_g, n_g]. Returns { p, se, G }. */
function clusterRatio(clusters) {
  let C = 0, N = 0;
  for (const [c, n] of clusters) { C += c; N += n; }
  const G = clusters.length;
  if (!N || G < 2) return { p: N ? C / N : null, se: null, G };
  const p = C / N;
  let s = 0;
  for (const [c, n] of clusters) { const r = c - p * n; s += r * r; }
  return { p, se: Math.sqrt((G / (G - 1)) * s) / N, G };
}

/** Cluster-robust SE of pA - pB where each cluster g contributes (cA,nA,cB,nB). Covariance from a
 *  cluster appearing in both periods is included (the linearisation is joint). */
function clusterDiff(rows) {
  let CA = 0, NA = 0, CB = 0, NB = 0;
  for (const r of rows) { CA += r[0]; NA += r[1]; CB += r[2]; NB += r[3]; }
  const G = rows.length;
  if (!NA || !NB || G < 2) return { pA: NA ? CA / NA : null, pB: NB ? CB / NB : null, diff: null, se: null, G };
  const pA = CA / NA, pB = CB / NB;
  let s = 0;
  for (const r of rows) { const z = (r[2] - pB * r[3]) / NB - (r[0] - pA * r[1]) / NA; s += z * z; }
  return { pA, pB, diff: pB - pA, se: Math.sqrt((G / (G - 1)) * s), G };
}

/** Standard normal two-sided p-value. */
function pTwo(z) {
  const x = Math.abs(z) / Math.SQRT2;
  // Abramowitz-Stegun 7.1.26 erfc
  const t = 1 / (1 + 0.3275911 * x);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return Math.min(1, y * Math.exp(-x * x));
}

/** Benjamini-Hochberg q-values, same order as input. */
function bh(ps) {
  const m = ps.length;
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(m);
  let prev = 1;
  for (let r = m - 1; r >= 0; r--) {
    const [p, i] = idx[r];
    prev = Math.min(prev, (p * m) / (r + 1));
    q[i] = prev;
  }
  return q;
}

/** Adjusted Rand index between two labelings of the same items. */
function ari(a, b) {
  const n = a.length;
  const ct = new Map(), ra = new Map(), rb = new Map();
  for (let i = 0; i < n; i++) {
    const k = a[i] + '|' + b[i];
    ct.set(k, (ct.get(k) || 0) + 1);
    ra.set(a[i], (ra.get(a[i]) || 0) + 1);
    rb.set(b[i], (rb.get(b[i]) || 0) + 1);
  }
  const c2 = x => (x * (x - 1)) / 2;
  let sij = 0, sa = 0, sb = 0;
  for (const v of ct.values()) sij += c2(v);
  for (const v of ra.values()) sa += c2(v);
  for (const v of rb.values()) sb += c2(v);
  const exp = (sa * sb) / c2(n), mx = (sa + sb) / 2;
  return mx === exp ? 1 : (sij - exp) / (mx - exp);
}

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- raw-log facts --------------------------------------------------------------------------- */

/* The custom-rule infobox pattern is READ from engine/scan_custom_rulesets.js:59 (`rules?`, singular
 * and plural), restated here only because this folder may not import engine/. */
const CUSTOM_BOX = /<strong>\s*(\d+)\s+custom rules?:<\/strong>\s*<\/summary>\s*([^<]*)/i;
const BESTOF = /\|uhtml\|bestof\|<h2><strong>Game (\d+)<\/strong> of <a href="\/game-bestof(\d+)-([a-z0-9]+-\d+)">/;

/** Facts a raw log carries that the parsed store drops. */
function rawFacts(log) {
  const f = { custom: null, rated: /\n\|rated\|/.test('\n' + log), gameNo: null, bestOf: null, series: null };
  const b = CUSTOM_BOX.exec(log);
  if (b) f.custom = b[2].replace(/\\n/g, ' ').replace(/\\"/g, '"').trim() || ('(' + b[1] + ' rules)');
  const s = BESTOF.exec(log);
  if (s) { f.gameNo = +s[1]; f.bestOf = +s[2]; f.series = s[3]; }
  return f;
}

module.exports = { ROOT, OUT, rel, toID, sha256File, fileReceipt, eachJsonl, wilson, clusterRatio,
  clusterDiff, pTwo, bh, ari, rng, rawFacts, CUSTOM_BOX, BESTOF };
