/* solver/hypno/live.js — HYPNO inside MILTANK's search (solver/miltank/search.js, spec extra `hypno`, OFF by default).
 *
 *   spec.hypno = true | { model?, band?, oppRating?, kSE?, minCover?, eps?, w?, series?, gn? }
 *     model      GARY model file (default solver/gary/model/gary-v1.json)
 *     band       the opponent's rating band (solver/gary/situation.js BANDS); else from oppRating; else 'unrated', COUNTED
 *     kSE, minCover, eps   solver/hypno/hypno.js respond() options (defaults there)
 *     w          the weight that the opponent follows GARY; default the model's mixture_w0 (or the series posterior)
 *     series, gn a solver/hypno/series.js instance and this game's number in the bo3 (games 2-3 read games before)
 *
 *   const HL = require('./solver/hypno/live.js').create(API, spec.hypno);
 *   HL.score(ctx, S, opp, viewer, laOp, colsI) -> { hCols, hMass, cell, trusted, band, w }   (at candidate time)
 *   HL.respond(A, cnt, sol, sc) -> hypno.js respond()'s answer                               (after the solve)
 *
 * GARY is asked through the SAME translation the search's ranking prior uses (solver/miltank/prior_adapter.js), so the
 * opponent's columns are scored on exactly the dataset-schema row DODUO v1 would see. A model file is loaded once per
 * process. The COUNTERS live in search.js (hypno*), so a run proves HYPNO ran or says it did not.
 */
'use strict';
const path = require('path');
const S = require('../gary/situation.js');
const H = require('./hypno.js');
const CACHE = new Map();

function garyFor(file) {
  if (!CACHE.has(file)) CACHE.set(file, require('../gary/infer.js').load({ model: file }));
  return CACHE.get(file);
}

function create(API, spec) {
  spec = spec === true ? {} : Object.assign({}, spec || {});
  const file = spec.model ? path.resolve(path.join(__dirname, '..', '..'), spec.model) : require('../gary/infer.js').MODEL;
  const G = garyFor(file);
  const last = { r: null };
  const wrapped = { predict: (row, t, side) => { const r = G.predict(row, t, side); last.r = r; return r; } };
  const PA = require('../miltank/prior_adapter.js').create(API, wrapped);
  const bandOf = () => {
    if (spec.band) return { band: spec.band, missing: false };
    if (spec.oppRating != null) return { band: S.bandOfRating(spec.oppRating, true), missing: false };
    return { band: 'unrated', missing: true };
  };
  function score(ctx, S_, opp, viewer, laOp, colsI) {
    const { band, missing } = bandOf();
    G.band = band;
    G.delta = spec.series && spec.gn ? spec.series.delta(spec.gn) : null;
    last.r = null;
    let s;
    try { s = PA.scoreJoints(ctx, S_, opp, viewer, laOp); } finally { G.band = null; G.delta = null; }
    let hMass = 0; for (const v of s) hMass += v > 1e-12 ? v : 0;
    const hCols = colsI.map(i => (s[i] > 1e-12 ? s[i] : 0));
    const r = last.r;
    let w = spec.w != null ? spec.w : (G.M.mixture_w0 != null ? G.M.mixture_w0 : 1);
    if (spec.series && spec.gn) w = spec.series.w(spec.gn);
    return { hCols, hMass, cell: r ? r.cell : null, trusted: !!(r && r.trusted), band, bandMissing: missing, w, noDecision: !r };
  }
  function respond(A, cnt, sol, sc) {
    return H.respond({ A, cnt, x: sol.x, y: sol.y, hCols: sc.hCols, hMass: sc.hMass, trusted: sc.trusted, w: sc.w },
      { kSE: spec.kSE, minCover: spec.minCover, eps: spec.eps == null ? null : spec.eps });
  }
  return { score, respond, G, file };
}

/* the GARY model a spec names (default solver/gary/model/gary-v1.json), loaded once per process */
function gary(model) { return garyFor(model ? path.resolve(path.join(__dirname, '..', '..'), model) : require('../gary/infer.js').MODEL); }

module.exports = { create, gary };
