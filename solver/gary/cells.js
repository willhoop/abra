/* solver/gary/cells.js — ONE decision as GARY reads it: DODUO v1's log-probability of every valid joint cell, each cell's
 * class mask, and the human's cell. The one implementation behind solver/gary/extract.js (the training rows) and
 * solver/hypno/series_live.js (an opponent's observed decisions inside a bo3), so the two can never disagree.
 *
 *   const C = require('./solver/gary/cells.js');
 *   C.decisionCells(MAG, row, t, side) -> null (no decision) | { status, d } (not a fully observed joint) |
 *                                         { status: 'exact', d, cells: [[a, b]], lp: Float32Array, bits: Uint16Array, lab, two }
 *   MAG = require('./solver/mag/infer.js').load()
 */
'use strict';
const S = require('./situation.js');
const F0 = require('../prior/features.js');

function decisionCells(MAG, row, t, side) {
  const d = MAG.decide(row, t, side);
  if (!d.slots[0] && !d.slots[1]) return null;
  const status = F0.jointStatus(d);
  if (status !== 'exact') return { status, d };
  const L = MAG.logits(d).joint;
  const cells = [];
  let mx = -Infinity;
  for (let i = 0; i < L.length; i++) for (let j = 0; j < L[i].length; j++) if (L[i][j] > -Infinity) { cells.push([i, j, L[i][j]]); if (L[i][j] > mx) mx = L[i][j]; }
  if (cells.length < 2) return { status: 'one_cell', d };
  let z = 0; for (const c of cells) z += Math.exp(c[2] - mx);
  const lz = mx + Math.log(z);
  const la = d.slots[0] ? d.slots[0].label.set[0] : 0, lb = d.slots[1] ? d.slots[1].label.set[0] : 0;
  const lab = cells.findIndex(c => c[0] === la && c[1] === lb);
  if (lab < 0) return { status: 'label_invalid', d };
  const K = cells.length, lp = new Float32Array(K), bits = new Uint16Array(K);
  cells.forEach((c, k) => { lp[k] = c[2] - lz; bits[k] = S.classBits(d, c[0], c[1]); });
  const two = !!(d.slots[0] && d.slots[1] && d.slots[0].label.status !== 'locked' && d.slots[1].label.status !== 'locked');
  return { status: 'exact', d, cells: cells.map(c => [c[0], c[1]]), lp, bits, lab, two };
}

module.exports = { decisionCells };
