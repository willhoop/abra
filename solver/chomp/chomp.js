/* solver/chomp/chomp.js — CHOMP v0, the team-preview solver. Both open sheets in; a mixed strategy over the 90
 * bring/lead options, with win chances, out.
 *
 *   const CHOMP = require('./solver/chomp/chomp.js');
 *   const CH = CHOMP.create({ API })                  // or { release: 'eaa5becc54eb' } to load a frozen engine itself
 *   const r  = CH.solve({ mine: [6 rows], theirs: [6 rows] }[, { refine: {...} | false, seed, deadline }])
 *              deadline = an epoch ms: the scorer throws past it (a live client falls back and counts it)
 *   const op = CH.sample(r, u)                        // u in [0,1) -> one option: { order:[4 sheet idx, leads first], ... }
 *
 * A "row" is one open-sheet member as the human dataset and ROTOM's |showteam| parser write it
 * ({ species, item, ability, moves[4], ... }). Nothing else is read: no store, no ladder, no network.
 *
 * WHAT IT DOES.
 *   1. SCORE. PORYGON2 v0 scores all 90 x 90 cells, each the turn-1 position after both leads, with each side's
 *      back two as a point belief (solver/chomp/score.js). Cell = P(I win).
 *   2. SOLVE. SLOWKING's exact LP (solver/slowking/matrix.js solveLP) gives my mix x, their mix y and the value v*.
 *   3. REFINE (optional). MILTANK playouts on the cells in the support and the best responses
 *      (solver/chomp/refine.js), blended into the table, then SLOWKING solves again.
 *
 * THE RESULT r:
 *   r.options[i]   { i, order, leads, back, label }            the 90 options, solver/chomp/options.js order
 *   r.mix[i]       my equilibrium probability of option i       r.oppMix[j] theirs
 *   r.value        v*: my win chance at the equilibrium
 *   r.win[i]       { vsMix, vsUniform, worst }                  option i's win chance against their mix, against a
 *                                                               uniform opponent, and against their best reply
 *   r.support      the options with mass, best first, with labels (what a human reads)
 *   r.exploit      how exploitable each candidate policy is INSIDE THIS TABLE (v* − its guaranteed value):
 *                  the mix (≈ 0 by construction; the LP's residual), the greedy pick vs a uniform opponent, the
 *                  best pure option (maximin), the uniform mix. `mixing_gain` = v* − maximin.
 *   r.refine       the refinement's receipt (cells, playouts, how far the cells and the mix moved), or null
 *   r.counters     every capability's counter for this solve (cells scored, memo hits, LP pivots, playouts)
 *   r.ms           wall time; r.engine names the engine it read
 *
 * CALIBRATION CAVEAT, stated where the number is produced: PORYGON2 v0 was trained on human outcomes, so a win
 * chance here is P(win) under human-like play from that position, not a promise about any bot's play.
 */
'use strict';
const O = require('./options.js');
const SK = require('../slowking/matrix.js');

function create(o) {
  o = o || {};
  let API = o.API, ENGINE = null;
  if (!API) { ENGINE = require('../arena/engine.js').load(o.release || null); API = ENGINE.API; }
  const SC = require('./score.js').create(API, { model: o.model, mode: o.mode, memo: o.memo });
  let RF = null;
  const rf = () => (RF || (RF = require('./refine.js').create(API)));
  const COUNTERS = { solves: 0, lpPivots: 0, refined: 0, failures: 0 };

  function summarise(A, sol) {
    const N = A.length;
    const colMin = x => { let m = Infinity; for (let j = 0; j < N; j++) { let s = 0; for (let i = 0; i < N; i++) s += x[i] * A[i][j]; if (s < m) m = s; } return m; };
    const rowVs = y => A.map(r => r.reduce((s, v, j) => s + v * y[j], 0));
    const uni = new Array(N).fill(1 / N);
    const vsMix = rowVs(sol.y), vsUni = rowVs(uni), worst = A.map(r => Math.min(...r));
    const pure = i => { const x = new Array(N).fill(0); x[i] = 1; return x; };
    let g = 0; for (let i = 1; i < N; i++) if (vsUni[i] > vsUni[g]) g = i;
    let mm = 0; for (let i = 1; i < N; i++) if (worst[i] > worst[mm]) mm = i;
    const v = sol.value;
    const exploit = {
      mix: +(v - colMin(sol.x)).toExponential(3),
      lp_gap: +sol.gap.toExponential(3),
      greedy: { i: g, value: v - worst[g] },
      maximin: { i: mm, value: v - worst[mm] },
      uniform: v - colMin(uni),
      mixing_gain: v - worst[mm],
    };
    return { vsMix, vsUni, worst, exploit, greedy: g, maximin: mm };
  }

  function solve(sh, so) {
    so = so || {};
    const t0 = Date.now();
    if (!sh || !Array.isArray(sh.mine) || !Array.isArray(sh.theirs)) throw new Error('chomp: solve({ mine, theirs }) needs both open sheets');
    const sheets = { p1: sh.mine, p2: sh.theirs };
    const c0 = Object.assign({}, SC.COUNTERS);
    let tab;
    try { tab = SC.table(sheets, { seed: so.seed, deadline: so.deadline }); } catch (e) { COUNTERS.failures++; throw e; }
    let A = tab.A;
    let sol = SK.solveLP(A);
    COUNTERS.solves++; COUNTERS.lpPivots += sol.pivots;
    let ref = null;
    const ropt = so.refine === undefined ? o.refine : so.refine;
    if (ropt) {
      const sol0 = sol;
      const r = rf().refine(sheets, A, Object.assign({ seed: so.seed || 1 }, ropt));
      const sol1 = r.sol;
      COUNTERS.refined++;
      let maxShift = 0, meanShift = 0;
      for (const k of r.samples.keys()) { const i = Math.floor(k / O.N), j = k % O.N; const d = Math.abs(r.A2[i][j] - A[i][j]); meanShift += d; if (d > maxShift) maxShift = d; }
      meanShift /= Math.max(1, r.cells);
      const tv = sol0.x.reduce((s, p, i) => s + Math.abs(p - sol1.x[i]), 0) / 2;
      /* how exploitable the UNREFINED mix is inside the REFINED table: what the playouts would have taken from it */
      const colMin = (M, x) => { let m = Infinity; for (let j = 0; j < M.length; j++) { let s = 0; for (let i = 0; i < M.length; i++) s += x[i] * M[i][j]; if (s < m) m = s; } return m; };
      ref = { cells: r.cells, playouts: r.playouts, rounds: r.rounds, history: r.history, unrefined_support_cells: r.unrefinedSupportCells,
              depth: r.depth, leaf: r.leaf, k0: r.k0, ms: r.ms,
              cell_shift_mean: meanShift, cell_shift_max: maxShift, mix_tv_moved: tv,
              value_before: sol0.value, value_after: sol1.value,
              unrefined_mix_exploit_in_refined: sol1.value - colMin(r.A2, sol0.x),
              rollout: r.rollout,
              /* per refined cell: the PORYGON2 value and every playout value, so a caller can bootstrap the table */
              samples: so.keepSamples ? Object.fromEntries([...r.samples].map(([k, vs]) => [k, { base: A[Math.floor(k / O.N)][k % O.N], v: vs }])) : undefined };
      A = r.A2; sol = sol1;
    }
    const S = summarise(A, sol);
    const options = O.OPTIONS.map((op, i) => ({ i, order: op.order.slice(), leads: op.leads.slice(), back: op.back.slice(), label: O.label(op, sh.mine) }));
    const win = options.map((_, i) => ({ vsMix: S.vsMix[i], vsUniform: S.vsUni[i], worst: S.worst[i] }));
    const support = sol.x.map((p, i) => ({ i, p })).filter(s => s.p > 1e-9).sort((a, b) => b.p - a.p)
      .map(s => ({ i: s.i, p: s.p, label: options[s.i].label, order: options[s.i].order, vsMix: S.vsMix[s.i] }));
    return {
      options, mix: sol.x, oppMix: sol.y, value: sol.value, win, support,
      greedy: { i: S.greedy, label: options[S.greedy].label, vsUniform: S.vsUni[S.greedy] },
      maximin: { i: S.maximin, label: options[S.maximin].label, worst: S.worst[S.maximin] },
      exploit: S.exploit, refine: ref, table: so.keepTable ? A : undefined,
      counters: { cells: SC.COUNTERS.cells - c0.cells, leadBattles: SC.COUNTERS.leadBattles - c0.leadBattles,
                  dmgCalls: SC.COUNTERS.dmgCalls - c0.dmgCalls, dmgMemoHits: SC.COUNTERS.dmgMemoHits - c0.dmgMemoHits,
                  lpPivots: sol.pivots, refinedCells: ref ? ref.cells : 0, playouts: ref ? ref.playouts : 0 },
      mode: tab.mode, score_ms: tab.ms, ms: Date.now() - t0,
      engine: ENGINE ? (ENGINE.id || 'live tree') : 'caller API',
    };
  }

  function sample(r, u) {
    const i = SK.sample(r.mix, u);
    return r.options[i];
  }

  return { solve, sample, COUNTERS, scorer: SC, API, engine: ENGINE };
}

module.exports = { create, OPTIONS: O.OPTIONS };
