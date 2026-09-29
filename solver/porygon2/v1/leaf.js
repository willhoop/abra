/* solver/porygon2/v1/leaf.js — PORYGON2 v1 as MILTANK's leaf.
 *
 *   const L = require('./solver/porygon2/v1/leaf.js').create(API, { model });
 *   L.value(S, sheets)   P(side A wins) for a MEDICHAM battle S (a search world); sheets = { p1, p2 }, p1 = side A
 *
 * The world goes through the honest producer (features.js fromEngine: only what a player sees — the unrevealed back line
 * masked, spreads never read), then the ONE encode() the training data went through, then the hand-written forward pass.
 * solver/porygon2/leaf.js dispatches here when the model file declares arch v1-*, so MILTANK, MEW and the arena name a v1
 * model exactly as they name a v0 one (o.leafModel / a league spec's `pory2`).
 */
'use strict';

function create(API, opts) {
  opts = opts || {};
  if (!opts.model) throw new Error('porygon2/v1/leaf: a model file is required');
  const F = require('./features.js').create(API);
  const NET = require('./infer.js').load(opts.model);
  function encode(S, sheets) { return F.encode(F.fromEngine(S, sheets), sheets); }
  function value(S, sheets) {
    if (!sheets || !sheets.p1 || !sheets.p2) throw new Error('porygon2 v1 leaf: both open sheets are required');
    return NET.value(encode(S, sheets));
  }
  return { value, encode, net: NET, features: F, version: 'v1' };
}

module.exports = { create };
