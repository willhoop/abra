/* solver/chomp/v2/chomp2.js — CHOMP v2, the team-preview solver: v1's solve (SLOWKING's LP, the bo3 adjustment, v0's
 * result shape) over v2's cell scorer (solver/chomp/v2/scorer.js: the facts at a per-set spread and under the field
 * each side can set).
 *
 *   const CH = require('./solver/chomp/v2/chomp2.js').create({ API } | { release }[, { model, source }])
 *   CH.solve({ mine, theirs }[, { deadline, series }]), CH.sample(r, u)      exactly v1's interface
 *
 * Nothing about the solve changed; only the table it solves. The result's `model` names chomp2.json.
 */
'use strict';
const V1 = require('../v1/chomp1.js');
const SC2 = require('./scorer.js');

function create(o) {
  o = o || {};
  return V1.create(Object.assign({}, o, { scorer: API => SC2.create(API, { model: o.model, source: o.source }) }));
}

module.exports = { create };
