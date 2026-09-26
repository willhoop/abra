/* solver/chomp/refine.js — CHOMP's optional MILTANK refinement: short playouts on the cells that decide the mix.
 *
 *   const RF = require('./solver/chomp/refine.js').create(API[, { buildBody }]);
 *   RF.refine(sheets, A, o) -> { A2, sol, cells, playouts, rounds, history, unrefinedSupportCells, samples, ms }
 *     sheets   { p1: mine, p2: theirs } (p1 = side A = the row player)
 *     A        the PORYGON2 table (solver/chomp/score.js), row = mine
 *     o        { rows: 6, cols: 6, playouts: 16, depth: 2, leaf: 'pory2'|'heuristic', k0: 8, rounds: 3, seed, timeMs }
 *
 * WHICH CELLS. SLOWKING solves the table; the rows with mass in x (filled to `rows` by value against y) plus the
 * best response to y, times the same for the columns, are the cells the equilibrium stands on. Those are played,
 * blended in, and the table is solved again. Refining only the support lowers exactly the cells that looked best
 * (the winner's curse), so the support can walk onto cells nobody played: the loop repeats, double-oracle style,
 * for up to `rounds` rounds while it does. `unrefinedSupportCells` says whether the final support still stands on
 * an unplayed cell.
 *
 * ONE PLAYOUT is MILTANK's (solver/miltank/rollout.js): the two chosen fours built in their orders, a LEAN battle
 * on seeded dice, `depth` turns of MILTANK's random playout policy (`randomJoint`, whose support is pinned to
 * `legalActions` by solver/tests/test-miltank.js), then MILTANK's leaf — PORYGON2 v0 on the position (default) or
 * the HP heuristic. COMMON RANDOM NUMBERS: playout p of every cell uses the same seed, so a difference between two
 * cells is the bring, not the dice.
 *
 * BLEND. A refined cell = (k0 * PORYGON2 cell + sum of playout values) / (k0 + n). k0 is a prior strength in
 * playouts; the per-playout values are returned (`samples`) so the caller can bootstrap the table.
 *
 * `timeMs` bounds the whole refinement; a cell left with fewer playouts than asked is COUNTED (`short`), never hidden.
 */
'use strict';
const O = require('./options.js');

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const T = require('../arena/teams.js');
  const R = require('../miltank/rollout.js').create(API, { buildBody: opts.buildBody || T.buildBody });
  const COUNTERS = { refines: 0, cells: 0, playouts: 0, short: 0, failed: 0 };

  const argmax = a => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };
  /* the k lines with the most mass, then (to fill k) the best remaining lines by value, plus the best response */
  function pick(mass, value, k) {
    const idx = mass.map((v, i) => i).sort((a, b) => (mass[b] > 1e-9) - (mass[a] > 1e-9) || mass[b] - mass[a] || value[b] - value[a] || a - b).slice(0, k);
    const br = argmax(value);
    if (!idx.includes(br)) idx.push(br);
    return idx;
  }

  function refine(sheets, A, o) {
    o = Object.assign({ rows: 6, cols: 6, playouts: 16, depth: 2, leaf: 'pory2', k0: 8, rounds: 3, seed: 1, timeMs: Infinity }, o || {});
    const SK = require('../slowking/matrix.js');
    const t0 = Date.now();
    COUNTERS.refines++;
    const N = A.length;
    const cache = { p1: [], p2: [] };
    const body = (sd, s) => {
      if (cache[sd][s] === undefined) cache[sd][s] = T.buildBody(M, sheets[sd][s]) || null;
      if (!cache[sd][s]) throw new Error('chomp/refine: ' + sd + ' member ' + s + ' does not build');
      const b = structuredClone(cache[sd][s]); b._solverSheet = s; return b;
    };
    const lctx = o.leaf === 'pory2' ? { mode: 'pory2', sheets } : null;
    const play = (i, j, seed) => {
      const rng = M.rngStreams({ seed });
      const coin = M.rngStreams({ seed: seed + 7919 }).any;
      const S = API.newBattle(O.OPTIONS[i].order.map(s => body('p1', s)), O.OPTIONS[j].order.map(s => body('p2', s)), { rng, lean: true });
      return API.leanRun(() => {
        for (let t = 0; t < o.depth && !API.isTerminal(S); t++) API.stepInPlace(S, R.randomJoint(S, 'A', coin), R.randomJoint(S, 'B', coin), rng);
        return R.leaf(S, lctx);
      });
    };
    const A2 = A.map(r => r.slice());
    const samples = new Map();
    let playouts = 0, rounds = 0, sol = SK.solveLP(A2);
    const history = [];
    /* double-oracle style: refine the cells the current equilibrium stands on, re-solve, and repeat while the
     * support walks onto cells that have not been played yet */
    while (rounds < o.rounds && Date.now() - t0 <= o.timeMs) {
      const Ay = A2.map(r => r.reduce((s, v, j) => s + v * sol.y[j], 0));
      const xA = A2[0].map((_, j) => -A2.reduce((s, r, i) => s + r[j] * sol.x[i], 0));
      const rows = pick(sol.x, Ay, o.rows), cols = pick(sol.y, xA, o.cols);
      const fresh = [];
      for (const i of rows) for (const j of cols) if (!samples.has(i * N + j)) { samples.set(i * N + j, []); fresh.push([i, j]); }
      if (!fresh.length) break;
      rounds++;
      /* pass p plays every fresh cell once on seed p: CRN, and a clock cut leaves the cells evenly filled */
      for (let p = 0; p < o.playouts; p++) {
        if (Date.now() - t0 > o.timeMs) break;
        const seed = o.seed * 100003 + p;
        for (const [i, j] of fresh) {
          let v;
          try { v = play(i, j, seed); } catch (e) { COUNTERS.failed++; continue; }
          if (!Number.isFinite(v)) { COUNTERS.failed++; continue; }
          samples.get(i * N + j).push(v);
          playouts++;
        }
      }
      for (const [i, j] of fresh) {
        const vs = samples.get(i * N + j);
        if (vs.length < o.playouts) COUNTERS.short++;
        A2[i][j] = (o.k0 * A[i][j] + vs.reduce((s, v) => s + v, 0)) / (o.k0 + vs.length);
      }
      sol = SK.solveLP(A2);
      history.push({ round: rounds, fresh: fresh.length, value: sol.value, support: sol.x.filter(p => p > 1e-9).length });
    }
    /* is the final support standing on refined cells only? (it should, unless rounds or the clock ran out) */
    const supR = sol.x.map((p, i) => (p > 1e-9 ? i : -1)).filter(i => i >= 0), supC = sol.y.map((p, j) => (p > 1e-9 ? j : -1)).filter(j => j >= 0);
    let unrefinedSupportCells = 0;
    for (const i of supR) for (const j of supC) if (!samples.has(i * N + j)) unrefinedSupportCells++;
    COUNTERS.cells += samples.size; COUNTERS.playouts += playouts;
    return { A2, sol, cells: samples.size, playouts, rounds, history, unrefinedSupportCells, samples, k0: o.k0, depth: o.depth, leaf: o.leaf, ms: Date.now() - t0,
             rollout: { leafPory2: R.COUNTERS.leafPory2, leafHeuristic: R.COUNTERS.leafHeuristic } };
  }

  return { refine, COUNTERS, R };
}

module.exports = { create };
