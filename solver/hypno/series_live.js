/* solver/hypno/series_live.js — feed a finished game of a bo3 into HYPNO's in-series memory (solver/hypno/series.js).
 *
 *   const SL = require('./solver/hypno/series_live.js');
 *   SL.observeGame(SR, G, row, side, gn, band) -> { decisions, observed }
 *     SR    a series.js instance for this bo3 (one per series, keyed by the bestof room)
 *     G     solver/gary/infer.js load() (its DODUO v1 and its fitted parameters)
 *     row   the finished game in the dataset schema (solver/human/parse_game.js parseGame, as ROTOM's endBattle parses it)
 *     side  the OPPONENT's side ('p1' | 'p2'); gn the game's number in the series; band the opponent's band
 *
 * Every fully observed opponent decision becomes one observation: DODUO v1's log-probabilities over the valid cells, the
 * class masks, the cell they clicked (solver/gary/cells.js — the same function the training rows came from) and the
 * population cell's parameters at that decision's bucket and this band. series.js then weights them by game and fits the
 * per-opponent deviation; games 2 and 3 read only games before them.
 */
'use strict';
const S = require('../gary/situation.js');
const CELLS = require('../gary/cells.js');

function effOf(M, bucket, band) {
  const NF = 1 + S.NB, out = new Float64Array(NF);
  for (const v of [M.params.global, M.params.bucket[bucket], M.params.band[band], M.params.cell[bucket + '|' + band]]) if (v) for (let f = 0; f < NF; f++) out[f] += v[f];
  return out;
}

function observeGame(SR, G, row, side, gn, band) {
  let decisions = 0, observed = 0;
  for (let t = 0; t < row.turns.length; t++) {
    const dc = CELLS.decisionCells(G.MAG, row, t, side);
    if (!dc) continue;
    decisions++;
    if (dc.status !== 'exact') continue;
    const bucket = S.bucket(row, t, side, dc.d);
    SR.observe({ gn, lp: Float64Array.from(dc.lp), bits: dc.bits, lab: dc.lab, eff: effOf(G.M, bucket, band) });
    observed++;
  }
  return { decisions, observed };
}

module.exports = { observeGame, effOf };
