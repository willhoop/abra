/* solver/porygon2/v2/leaf.js — PORYGON2 v2 as MILTANK's leaf. OFF BY DEFAULT, ON NO ARM.
 *
 *   const L = require('./solver/porygon2/v2/leaf.js').create(API, { model[, ratings] });
 *   L.value(S, sheets)   P(side A wins) for a MEDICHAM battle S; sheets = { p1, p2 } (both OPEN sheets), p1 = side A
 *   L.counters           { evals, errors } — the capability counter: a v2 leaf that served nothing is assumed broken
 *
 * solver/porygon2/leaf.js dispatches here when the model file declares arch "v2-transformer", so a league spec turns v2 on
 * by naming a v2 file in its `pory2` field (solver/porygon2/v2/gen5-p2v2.json; no ladder arm names one). The world goes
 * through the play producer (features.js fromEngine: the open sheets known, the history fields blanked as in training),
 * the ONE encode(), then the hand-written forward pass.
 *
 * RATINGS. v2 conditions on both pre-game ratings. The default is [1600, 1600]: in self-play both chairs are the strong
 * search, queried at the pre-registered target band (preregistration.json "query"). ROTOM passes { ratings: [1600, the
 * opponent's displayed rating] } in the searcher's frame when it adopts v2.
 */
'use strict';

function create(API, opts) {
  opts = opts || {};
  if (!opts.model) throw new Error('porygon2/v2/leaf: a model file is required');
  const F = require('./features.js').create(API);
  if (F.BROKEN) throw new Error('porygon2/v2/leaf: refusing to play with PORY2V2_FEAT_BREAK=' + F.BROKEN);
  const NET = require('./infer.js').load(opts.model);
  const ratings = opts.ratings || [1600, 1600];
  const counters = { evals: 0, errors: 0, fallbacks: 0 };
  function encode(S, sheets) { return F.encode(F.fromEngine(S, sheets), { p1: ratings[0], p2: ratings[1] }); }
  function value(S, sheets) {
    if (!sheets || !sheets.p1 || !sheets.p2) throw new Error('porygon2 v2 leaf: both open sheets are required');
    let v;
    try { v = NET.value(encode(S, sheets)); } catch (e) { counters.errors++; throw e; }
    counters.evals++;
    return v;
  }
  return { value, encode, net: NET, features: F, counters, ratings, version: 'v2' };
}

module.exports = { create };
