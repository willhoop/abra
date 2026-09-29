/* solver/porygon2/leaf.js — PORYGON2 v0 as MILTANK's leaf. PRE-GATE.
 *
 *   const L = require('./solver/porygon2/leaf.js').create(API[, { model }]);
 *   L.value(S, sheets)   P(side A wins) for a MEDICHAM battle S; sheets = { p1:[6 rows], p2:[6 rows] }, p1 = side A
 *
 * The battle goes through the ONE engine -> dataset translation (solver/miltank/prior_adapter.js publicState,
 * the same public view the human dataset has: a body is seen once it has been out), then through the SAME
 * features.js encode() the training data went through, then the hand-written forward pass. Nothing here is a
 * second copy of the features. Bodies carry their sheet row as `_solverSheet` (solver/arena/teams.js).
 */
'use strict';
const path = require('path');

/* A v1 model file (arch "v1-sets" / "v1-attn", solver/porygon2/v1/) is served by solver/porygon2/v1/leaf.js — the richer
 * honest-state encoder and its own forward pass. The file says which it is; nothing else in the search changes. */
function isV1(file) {
  if (!file) return false;
  const fs = require('fs');
  const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(256); const n = fs.readSync(fd, buf, 0, 256, 0); fs.closeSync(fd);
  return /"arch"\s*:\s*"v1-/.test(buf.subarray(0, n).toString('utf8'));
}

function create(API, opts) {
  opts = opts || {};
  if (isV1(opts.model)) return require('./v1/leaf.js').create(API, opts);
  const PA = require('../miltank/prior_adapter.js').create(API, null);
  const F = require('./features.js').create(API.M);
  const NET = require('./infer.js').load(opts.model || path.join(__dirname, 'model', 'porygon2-v0.json'));
  function value(S, sheets) {
    if (!sheets || !sheets.p1 || !sheets.p2) throw new Error('porygon2 leaf: both open sheets are required');
    return NET.value(F.encode(F.fromEngine(PA, S, sheets)));
  }
  return { value, encode: (S, sheets) => F.encode(F.fromEngine(PA, S, sheets)), net: NET, features: F };
}

module.exports = { create };
