/* solver/miltank/cells.js — ONE PASS OF MILTANK'S CELL FILL, the one piece of code the serial search and
 * every pool worker run. Two copies of this loop would drift, and a drift here would be invisible: the
 * pool would still return a matrix, just not the one the serial search would have built.
 *
 *   job = { S, side, opp, rows, cols, belief:{sheet, revealed:Set}, depth, baseSeed[, leafCtx][, abortAt] }
 *       abortAt: an absolute instant past which an in-flight playout is abandoned (rollout.js playFrom); absent = never
 *       leafCtx = { mode:'pory2', sheets } selects the PORYGON2 leaf (solver/miltank/rollout.js); absent = heuristic
 *       quiesce = { fb:{A:[opt|null, opt|null], B:[…]} } plays one extension turn after a turn in which a protect held
 *                 (solver/miltank/rollout.js QUIESCENCE); absent = the playout it always was
 *   playPass(API, R, job, p, deadline) -> { p, v: Float64Array(m·n), stopped }
 *   passRunner(API, R, job, p)          -> { p, v, step(deadline, sliceEnd) -> 'done'|'deadline'|'slice' }  (the same pass, in slices)
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
  const r = passRunner(API, R, job, p);
  const why = r.step(deadline, Infinity);
  return { p, v: r.v, stopped: why === 'deadline', timing: r.timing };
}

/* PASS p AS A RESUMABLE RUNNER, so a pool worker can play it in SLICES and hand the parent what it has so far
 * (solver/miltank/pool_worker.js; docs/_reports/2026-09-25-miltank-deadline.md). The world is drawn on the first
 * step. step(deadline, sliceEnd) plays cells in the pass's order until the pass is done ('done'), the clock passes
 * `deadline` ('deadline') or `sliceEnd` ('slice'); like playPass it always plays at least one cell per call and
 * reads the clock AFTER each playout. playPass is this runner run to the deadline in one call, so the two cannot
 * produce different cells. */
function passRunner(API, R, job, p) {
  const m = job.rows.length, n = job.cols.length, mn = m * n;
  const v = new Float64Array(mn).fill(NaN);
  const seed = job.baseSeed + p * STRIDE;
  const off = startCell(p, mn), K = walkStep(m, n);
  let W = null, t = 0;
  const T = { worldMs: 0, maxPlayoutMs: 0 };   // where a pass's wall time went: the world draw, the slowest single playout
  function step(deadline, sliceEnd) {
    if (!W) {
      const t0 = Date.now();
      const wcoin = API.M.rngStreams({ seed: seed + 1 }).any;
      W = R.prepare(R.sampleWorld(job.S, job.opp, job.belief, wcoin));
      T.worldMs = Date.now() - t0;
    }
    while (t < mn) {
      const c = (off + t * K) % mn, i = (c / n) | 0, j = c - i * n;
      const jA = job.side === 'A' ? job.rows[i] : job.cols[j], jB = job.side === 'A' ? job.cols[j] : job.rows[i];
      const t1 = Date.now();
      const vA = R.playout(W, jA, jB, seed, job.depth, job.leafCtx, job.abortAt, job.quiesce);
      v[c] = job.side === 'A' ? vA : 1 - vA;            // NaN (abandoned at job.abortAt) stays an unplayed cell
      t++;
      const now = Date.now();
      if (now - t1 > T.maxPlayoutMs) T.maxPlayoutMs = now - t1;
      if (t >= mn) break;
      if (now >= deadline) return 'deadline';
      if (now >= sliceEnd) return 'slice';
    }
    return 'done';
  }
  return { p, v, step, played: () => t, timing: T };
}

/* THE ORDER A PASS WALKS ITS CELLS (2026-09-25, docs/_reports/2026-09-25-miltank-deadline.md): from its start cell in
 * steps of K = the smallest integer >= n+1 coprime to m*n, wrapping — a permutation of the cells, so a FULL pass is
 * the same set of playouts, and each cell's value does not depend on the order (see below). What moves is which
 * cells a pass CUT SHORT reaches: stepping n+1 walks a diagonal, so the first m cells of a pass touch (nearly)
 * every row and column, where the row-major walk filled the top rows and left the bottom rows EMPTY. With a hard
 * deadline a cut pass is the common case at a short budget, and search.js falls back to the prior when a row has
 * no cell at all. MILTANK_POOL_BREAK=rotate still returns every pass to cell (0,0) — only the start. */
function walkStep(m, n) {
  const mn = m * n;
  if (mn <= 1) return 1;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let K = n + 1;
  while (gcd(K, mn) !== 1) K++;
  return K % mn || 1;
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
const DEADLINE_BREAK = (typeof process !== 'undefined' && process.env && process.env.MILTANK_DEADLINE_BREAK) || '';

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

/* the serial fill: passes 0, 1, 2, … until the clock or the pass cap. NO PASS STARTS AT OR AFTER THE DEADLINE —
 * not even pass 0 (a pass costs a world draw before its first playout, and playPass always plays one cell), so
 * past the deadline this returns an empty fill and search.js falls back (docs/_reports/2026-09-25-miltank-deadline.md).
 * `cut` says the clock, not the pass cap, ended it. MILTANK_DEADLINE_BREAK=1 restores "pass 0 always starts". */
function fillSerial(API, R, job, deadline, maxPasses) {
  const vs = [];
  let cut = false, maxWorldMs = 0, maxPlayoutMs = 0;
  for (let p = 0; ; p++) {
    if ((p > 0 || !DEADLINE_BREAK) && Date.now() >= deadline) { cut = true; break; }
    const r = playPass(API, R, job, p, deadline);
    vs.push(r.v);
    maxWorldMs = Math.max(maxWorldMs, r.timing.worldMs); maxPlayoutMs = Math.max(maxPlayoutMs, r.timing.maxPlayoutMs);
    if (r.stopped) { cut = true; break; }
    if (maxPasses && vs.length >= maxPasses) break;
  }
  return Object.assign(accumulate(job.rows.length, job.cols.length, vs), { cut, overrunMs: Math.max(0, Date.now() - deadline), maxWorldMs, maxPlayoutMs });
}

module.exports = { playPass, passRunner, accumulate, fillSerial, startCell, walkStep, STRIDE };
