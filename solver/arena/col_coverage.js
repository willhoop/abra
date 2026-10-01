/* solver/arena/col_coverage.js — did the search's COLUMNS hold the opponent's actual joint? (2026-10-01)
 *
 *   const CC = require('./solver/arena/col_coverage.js');
 *   CC.jointHit(cols, actual, 'target' | 'move')   -> boolean
 *
 * `cols` is MILTANK's candidate opponent joints (solver/miltank/search.js info._cols), `actual` the joint the opponent
 * then played (legalActions shape: per slot { kind: 'move', move, target, mega } | { kind: 'switch', to, ident } | null).
 *   target  each slot's move id AND target, or a switch to the same body (ident). The blind-spot report's 57.7% measure
 *           (docs/_reports/2026-10-01-search-blind-spots.md §2, "targets").
 *   move    move ids only; any switch matches any switch (that report's 63.7% measure, "moves").
 * The mega flag is not compared in either (that report counts it apart). A slot with no action (null) matches anything.
 *
 * DELIBERATE BREAK (env COLCOV_BREAK=notarget): 'target' ignores the target — solver/tests/test-col-coverage.js must go red.
 */
'use strict';
const BREAK = (typeof process !== 'undefined' && process.env && process.env.COLCOV_BREAK) || '';

function slotHit(col, act, mode) {
  if (!act) return true;
  if (!col) return false;
  if (act.kind !== col.kind) return false;
  if (act.kind === 'switch') return mode === 'move' ? true : String(act.ident) === String(col.ident);
  if (act.move !== col.move) return false;
  if (mode === 'move' || BREAK === 'notarget') return true;
  return (act.target == null ? null : act.target) === (col.target == null ? null : col.target);
}

function jointHit(cols, act, mode) {
  if (!Array.isArray(cols) || !act) return false;
  return cols.some(c => c && [0, 1].every(k => slotHit(c[k], act[k], mode)));
}

module.exports = { slotHit, jointHit, BROKEN: BREAK || null };
