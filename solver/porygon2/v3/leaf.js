/* solver/porygon2/v3/leaf.js — the PORYGON2 v3 student as MILTANK's leaf. OFF BY DEFAULT, ON NO ARM.
 *
 *   const L = require('./solver/porygon2/v3/leaf.js').create(API, { model[, ratings] });
 *   L.value(S, sheets)   P(side A wins) for a MEDICHAM battle S; sheets = { p1, p2 } (both OPEN sheets), p1 = side A
 *   L.counters           { evals, errors } — the capability counter (rollout.js leafOwn() reports it per model file)
 *
 * solver/porygon2/leaf.js dispatches here when the model file declares arch "v3-student"; a league spec turns it on by naming
 * the file in its `pory2` field (solver/porygon2/v3/gen5-p2v3s.json). The world goes through v2's play producer and encoder
 * (solver/porygon2/v2/features.js fromEngine -> encode: the SAME input the student was distilled on), then the student's
 * forward pass. Ratings default to [1600, 1600], v2's pre-registered query, so the student is asked what its teacher is.
 */
'use strict';

function create(API, opts) {
  opts = opts || {};
  if (!opts.model) throw new Error('porygon2/v3/leaf: a model file is required');
  const F = require('../v2/features.js').create(API);
  if (F.BROKEN) throw new Error('porygon2/v3/leaf: refusing to play with PORY2V2_FEAT_BREAK=' + F.BROKEN);
  const NET = require('./infer.js').load(opts.model);
  const ratings = opts.ratings || [1600, 1600];
  const counters = { evals: 0, errors: 0, fallbacks: 0 };
  function encode(S, sheets) { return F.encode(F.fromEngine(S, sheets), { p1: ratings[0], p2: ratings[1] }); }
  function value(S, sheets) {
    if (!sheets || !sheets.p1 || !sheets.p2) throw new Error('porygon2 v3 leaf: both open sheets are required');
    let v;
    try { v = NET.value(encode(S, sheets)); } catch (e) { counters.errors++; throw e; }
    counters.evals++;
    return v;
  }
  return { value, encode, net: NET, features: F, counters, ratings, version: 'v3-student' };
}

module.exports = { create };
