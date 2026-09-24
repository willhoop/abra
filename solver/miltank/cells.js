/* solver/miltank/cells.js — ONE PASS OF MILTANK'S CELL FILL, the one piece of code the serial search and
 * every pool worker run. Two copies of this loop would drift, and a drift here would be invisible: the
 * pool would still return a matrix, just not the one the serial search would have built.
 *
 *   job = { S, side, opp, rows, cols, belief:{sheet, revealed:Set}, depth, baseSeed }
 *   playPass(API, R, job, p, deadline) -> { p, v: Float64Array(m·n), stopped }
 *       cells are played from startCell(p) onward, wrapping (see startCell below)
 *       v[i·n+j] is the value of cell (i, j) for `side`, NaN if the clock ran out before it was played
 *   accumulate(m, n, [v0, v1, …])     -> { sum:[m][n], cnt:[m][n], passes, playouts }
 *       adds the passes IN THE ORDER GIVEN, which callers make pass order — the serial loop's order
 *
 * PASS p IS A PURE FUNCTION OF (job, p). The world is drawn from the engine's seeded stream at
 * baseSeed + p·104729 + 1 and every cell of the pass plays its dice from baseSeed + p·104729 (common random
 * numbers: a difference between two cells of one pass is the action, not the dice). Nothing reads the
 * clock except to stop; nothing reads process state. That is what lets a worker play pass 5 and hand back
 * the numbers the serial loop would have produced for pass 5.
 *
 * THE WORLD IS SERIALISED ONCE PER PASS (`R.prepare`) and every playout of the pass deserialises it,
 * instead of structuredClone-ing the world 36 times: same V8 serializer, half the work (measured,
 * docs/_reports/2026-09-24-playout-speed.md).
 */
'use strict';
const STRIDE = 104729;

function playPass(API, R, job, p, deadline) {
  const m = job.rows.length, n = job.cols.length;
  const v = new Float64Array(m * n).fill(NaN);
  const seed = job.baseSeed + p * STRIDE;
  const wcoin = API.M.rngStreams({ seed: seed + 1 }).any;
  const W = R.prepare(R.sampleWorld(job.S, job.opp, job.belief, wcoin));
  const mn = m * n, off = startCell(p, mn);
  let stopped = false;
  for (let t = 0; t < mn; t++) {
    const c = (off + t) % mn, i = (c / n) | 0, j = c - i * n;
    const jA = job.side === 'A' ? job.rows[i] : job.cols[j], jB = job.side === 'A' ? job.cols[j] : job.rows[i];
    const vA = R.playout(W, jA, jB, seed, job.depth);
    v[c] = job.side === 'A' ? vA : 1 - vA;
    if (Date.now() >= deadline) { stopped = true; break; }
  }
  return { p, v, stopped };
}

/* WHERE PASS p STARTS IN THE MATRIX. Pass 0 starts at cell (0,0), as the first version did. Later passes
 * start at the golden-ratio point frac(p·φ)·m·n and wrap, so passes cut short by the clock cover
 * DIFFERENT cells. This matters for the pool: with every pass starting at (0,0), four workers each cut
 * short mid-pass all filled the same top rows, and the 1 s arena run left 34.8% of cells empty against
 * 28% for one process (docs/_reports/2026-09-24-playout-speed.md). A cell's value does not depend on the
 * order it is played in — each playout copies the world and seeds its own dice — so a FULL pass is
 * unchanged; only which cells a cut-short pass reaches moves. */
const PHI = (Math.sqrt(5) - 1) / 2;
function startCell(p, mn) {
  if (BREAK_ROTATE || p === 0) return 0;
  return Math.floor(((p * PHI) % 1) * mn) % mn;
}
const BREAK_ROTATE = (typeof process !== 'undefined' && process.env && process.env.MILTANK_POOL_BREAK === 'rotate');

function accumulate(m, n, vs) {
  const sum = Array.from({ length: m }, () => new Float64Array(n));
  const cnt = Array.from({ length: m }, () => new Uint32Array(n));
  let playouts = 0;
  for (const v of vs) for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    const x = v[i * n + j];
    if (x === x) { sum[i][j] += x; cnt[i][j]++; playouts++; }   // NaN != NaN: an unplayed cell
  }
  return { sum, cnt, passes: vs.length, playouts };
}

/* the serial fill: passes 0, 1, 2, … until the clock or the pass cap */
function fillSerial(API, R, job, deadline, maxPasses) {
  const vs = [];
  for (let p = 0; ; p++) {
    const r = playPass(API, R, job, p, deadline);
    vs.push(r.v);
    if (r.stopped || (maxPasses && vs.length >= maxPasses)) break;
  }
  return accumulate(job.rows.length, job.cols.length, vs);
}

module.exports = { playPass, accumulate, fillSerial, startCell, STRIDE };
