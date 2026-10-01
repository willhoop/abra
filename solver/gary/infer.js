/* solver/gary/infer.js — GARY v1 in Node: the population's joint-action distribution at a rating band.
 *
 *   const G = require('./solver/gary/infer.js').load();             // solver/gary/model/gary-v1.json + DODUO v1
 *   const r = G.predict(row, t, 'p2', { band: '1100' });              // row = { game, turns } (dataset schema)
 *   r.cells     -> [{ a, b, p }] over DODUO v1's valid cells, sorted by p (the same (a, b) indices DODUO uses)
 *   r.bucket, r.band, r.cell ('bucket|band'), r.trusted (the cell's held-out gate: true = p 1, false = p 0)
 *
 * It is a drop-in `prior` for solver/miltank/prior_adapter.js: predict(row, t, side) with three arguments reads the band
 * from `G.band` (set it per opponent) or, failing that, from the row's own players and ratings (solver/gary/situation.js
 * band). A row with neither is `unrated` and COUNTED (bandMissing) — never guessed silently.
 *
 * The math is solver/gary/fit.js's: s_k = (1 + a) * lp_k + theta . bits_k with (a, theta) = global + bucket + band + cell.
 * DELIBERATE BREAK GARY_BREAK=doduo: predict returns DODUO's own distribution (the tilt is dropped) — test-gary must go red.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./situation.js');

const MODEL = path.join(__dirname, 'model', 'gary-v1.json');

function load(opts = {}) {
  const file = opts.model || MODEL;
  const M = JSON.parse(fs.readFileSync(file, 'utf8'));
  const MAG = opts.mag || require('../mag/infer.js').load();
  const NF = 1 + S.NB;
  if (M.class_names.join() !== S.CLASS_NAMES.join() || M.buckets.join() !== S.BUCKETS.join() || M.bands.join() !== S.BANDS.join()) throw new Error('gary: model layout differs from solver/gary/situation.js');
  const sha = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'mag', 'model', 'doduo-v1.json'))).digest('hex');
  if (M.doduo && M.doduo.sha256 && M.doduo.sha256 !== sha) throw new Error('gary: fitted over a different DODUO v1 file');
  const BREAK = process.env.GARY_BREAK || '';
  const COUNTERS = { calls: 0, bandMissing: 0, byCell: {}, trusted: 0, untrusted: 0 };
  const effCache = new Map();
  function eff(bucket, band) {
    const key = bucket + '|' + band;
    if (effCache.has(key)) return effCache.get(key);
    const out = new Float64Array(NF);
    for (const v of [M.params.global, M.params.bucket[bucket], M.params.band[band], M.params.cell[key]]) if (v) for (let f = 0; f < NF; f++) out[f] += v[f];
    effCache.set(key, out);
    return out;
  }
  const G = { M, MAG, COUNTERS, band: null, delta: null, file };
  G.gateOf = cell => (M.gate && M.gate[cell]) || null;
  G.predict = function (row, t, side, o) {
    COUNTERS.calls++;
    const d = MAG.decide(row, t, side);
    if (!d.slots[0] && !d.slots[1]) return null;
    let band = (o && o.band) || G.band;
    if (!band) {
      const gm = row.game || {};
      if (gm.id || (gm.players && gm.players[side])) band = S.band(gm, side);
      else { band = 'unrated'; COUNTERS.bandMissing++; }
    }
    const bucket = S.bucket(row, t, side, d);
    const cell = bucket + '|' + band;
    let e = BREAK === 'doduo' ? new Float64Array(NF) : eff(bucket, band);
    const dl = (o && o.delta) || G.delta;      // a per-opponent deviation (solver/hypno/series.js), added to the cell's
    if (dl && BREAK !== 'doduo') { e = Float64Array.from(e); for (let f = 0; f < NF; f++) e[f] += dl[f]; }
    const L = MAG.logits(d).joint;
    const raw = [];
    let mx = -Infinity;
    for (let i = 0; i < L.length; i++) for (let j = 0; j < L[i].length; j++) if (L[i][j] > -Infinity) { raw.push([i, j, L[i][j]]); if (L[i][j] > mx) mx = L[i][j]; }
    let z = 0; for (const c of raw) z += Math.exp(c[2] - mx);
    const lz = mx + Math.log(z);
    let smx = -Infinity;
    const sc = raw.map(c => {
      const lp = c[2] - lz, bits = S.classBits(d, c[0], c[1]);
      let s = (1 + e[0]) * lp;
      for (let f = 0; f < S.NB; f++) if (bits & (1 << f)) s += e[1 + f];
      if (s > smx) smx = s;
      return { a: c[0], b: c[1], s, doduo: Math.exp(lp) };
    });
    let zz = 0; for (const c of sc) zz += Math.exp(c.s - smx);
    const cells = sc.map(c => ({ a: c.a, b: c.b, p: Math.exp(c.s - smx) / zz, doduo: c.doduo })).sort((x, y) => y.p - x.p);
    const gate = G.gateOf(cell);
    const trusted = !!(gate && gate.p === 1);
    COUNTERS.byCell[cell] = (COUNTERS.byCell[cell] || 0) + 1;
    if (trusted) COUNTERS.trusted++; else COUNTERS.untrusted++;
    const key = (s, i) => (s ? s.cands[i].key : null);
    return { decision: d, cells, bucket, band, cell, trusted, gate,
             top: k => cells.slice(0, k).map(c => ({ ...c, ka: key(d.slots[0], c.a), kb: key(d.slots[1], c.b) })) };
  };
  return G;
}

module.exports = { load, MODEL };
