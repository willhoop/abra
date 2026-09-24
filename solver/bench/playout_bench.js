/* solver/bench/playout_bench.js — playouts/s on FIXED positions with FIXED seeds, and a digest of every
 * value produced, so "faster" can be checked against "identical".
 *
 *   node solver/bench/playout_bench.js [--games 6] [--passes 3] [--k 6] [--depth 1] [--impl <solver dir>]
 *        [--workers N] [--no-decide] [--json out.json]
 *
 * Positions: real Reg M-C team pairs (solver/arena/teams.js, seed 7), played forward by uniform legal
 * joints on fixed dice — the same recipe as solver/tests/test-miltank.js. For every position, the first
 * k joints of each side's `legalActions` form a k×k matrix and the MILTANK cell loop is run exactly as
 * solver/miltank/search.js runs it: one sampled world per pass, one playout per cell, CRN seeds.
 * Every value goes into a sha256; `values_sha` must not move when only speed was touched.
 * Timing covers the cell loop only (worlds + playouts), not position collection. Wall AND cpu time are
 * both reported: this machine is shared, and wall time moved 3x between two identical runs an hour apart.
 *
 * `--impl <dir>` loads rollout.js and search.js from another copy of solver/ (the pre-change commit,
 * exported to a scratch folder), so before and after can be timed back to back under the same load.
 * `--workers N` fills the same passes through solver/miltank/pool.js instead of in-process; the values
 * are hashed in pass order, so `values_sha` must equal the serial run's.
 */
'use strict';
require('../arena/env.js');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const GAMES = +flag('--games', 6), PASSES = +flag('--passes', 3), K = +flag('--k', 6), DEPTH = +flag('--depth', 1);
const WORKERS = +flag('--workers', 0);
const IMPL = path.resolve(flag('--impl', path.join(__dirname, '..')));

const API = require('../../engine/medicham_api.js');
const M = API.M;
const T = require('../arena/teams.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../prior/infer.js').load());
const R = require(path.join(IMPL, 'miltank', 'rollout.js')).create(API, { buildBody: T.buildBody });

/* MAIN-THREAD cpu time (process.threadCpuUsage, node >= 23.9): the least load-sensitive clock here. Process cpu
 * time also counts V8's GC helper threads, and wall time counts every other process on the machine. */
const threadCpu = () => { const u = process.threadCpuUsage ? process.threadCpuUsage() : process.cpuUsage(); return u.user + u.system; };

function positions() {
  const L = T.loadGames({ n: GAMES, seed: 7, M });
  if (L.refused) throw new Error(L.refused);
  const out = [];
  for (let gi = 0; gi < L.games.length; gi++) {
    const G = L.games[gi];
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const rng = API.makeRng(100 + gi);
    const S = API.newBattle(a.team, b.team, { rng });
    const coin = M.rngStreams({ seed: 200 + gi }).any;
    while (!API.isTerminal(S) && S.turn < 40) {
      if (S.turn % 2 === 0) out.push({ G, S: API.clone(S) });
      const jA = API.legalActions(S, 'A').joint, jB = API.legalActions(S, 'B').joint;
      const x = jA[Math.floor(coin() * jA.length)], y = jB[Math.floor(coin() * jB.length)];
      API.stepInPlace(S, x, y, rng);
    }
  }
  return out;
}

function jobsOf(P) {
  return P.map((p, ji) => ({ S: p.S, side: 'A', opp: 'B', G: p.G,
    rows: API.legalActions(p.S, 'A').joint.slice(0, K), cols: API.legalActions(p.S, 'B').joint.slice(0, K),
    belief: { sheet: p.G.sheets.p2, revealed: PA.revealed(p.S, 'B') }, depth: DEPTH, baseSeed: 1000003 * ji }));
}

/* the in-process cell loop, written out (not via cells.js) so it also runs against the pre-change solver/ */
function serialValues(jobs, h) {
  let playouts = 0;
  for (const J of jobs) {
    for (let pass = 0; pass < PASSES; pass++) {
      const seed = J.baseSeed + pass * 104729;
      const W0 = R.sampleWorld(J.S, 'B', J.belief, M.rngStreams({ seed: seed + 1 }).any);
      const W = R.prepare ? R.prepare(W0) : W0;
      for (const jA of J.rows) for (const jB of J.cols) { h.update(String(R.playout(W, jA, jB, seed, DEPTH)) + ';'); playouts++; }
    }
  }
  return playouts;
}

async function pooledValues(jobs, h, pool) {
  let playouts = 0;
  for (const J of jobs) {
    const r = await pool.fillRaw({ S: J.S, side: 'A', opp: 'B', rows: J.rows, cols: J.cols, belief: J.belief, depth: DEPTH,
                                   baseSeed: J.baseSeed, budgetMs: 1e12, maxPasses: PASSES });
    for (const pv of r) for (const x of pv.v) { h.update(String(x) + ';'); playouts++; }
  }
  return playouts;
}

async function run() {
  const P = positions();
  const jobs = jobsOf(P);
  const h = crypto.createHash('sha256');
  let pool = null, poolUp = 0;
  if (WORKERS) { const a = Date.now(); pool = await require(path.join(IMPL, 'miltank', 'pool.js')).create({ workers: WORKERS }); poolUp = Date.now() - a; }
  const t0 = process.hrtime.bigint(), c0 = process.cpuUsage(), m0 = threadCpu();
  const playouts = pool ? await pooledValues(jobs, h, pool) : serialValues(jobs, h);
  const s = Number(process.hrtime.bigint() - t0) / 1e9;
  const cu = process.cpuUsage(c0), cpu = (cu.user + cu.system) / 1e6, mcpu = (threadCpu() - m0) / 1e6;
  if (pool) pool.close();
  const out = { impl: IMPL, workers: WORKERS, pool_startup_ms: poolUp || undefined, positions: P.length, playouts,
    seconds: +s.toFixed(3), playouts_per_s: +(playouts / s).toFixed(1),
    parent_cpu_s: +cpu.toFixed(3), main_thread_cpu_s: +mcpu.toFixed(3),
    playouts_per_main_thread_cpu_s: pool ? undefined : +(playouts / mcpu).toFixed(1),
    worker_cpu_s: pool ? +(pool.counters.cpu_ms / 1000).toFixed(3) : undefined,
    playouts_per_worker_cpu_s: pool ? +(playouts / (pool.counters.cpu_ms / 1000)).toFixed(1) : undefined,
    values_sha: h.digest('hex').slice(0, 16), flags: { games: GAMES, passes: PASSES, k: K, depth: DEPTH } };
  if (!argv.includes('--no-decide') && !pool) {
    /* THE WHOLE DECISION, not only the cell loop: MT.decide at a fixed pass count (no clock in the loop),
     * hashing the chosen joint, the solved value and the playout count per position. */
    const MT = require(path.join(IMPL, 'miltank', 'search.js')).create(API, { prior: PA, rollout: R });
    const hd = crypto.createHash('sha256');
    const td = process.hrtime.bigint();
    P.forEach((p, i) => {
      const d = MT.decide(p.S, 'A', { G: p.G, hist: [] }, { budgetMs: 1e9, maxPasses: PASSES, k1: K, k2: K, depth: DEPTH,
        coin: M.rngStreams({ seed: 31337 + i }).any });
      hd.update(JSON.stringify([d.joint.map(o => o.choice), d.info.value, d.info.playouts]) + ';');
    });
    out.decide_sha = hd.digest('hex').slice(0, 16);
    out.decide_s = +(Number(process.hrtime.bigint() - td) / 1e9).toFixed(3);
  }
  return out;
}

if (require.main === module) {
  run().then(r => {
    console.log(JSON.stringify(r));
    const out = flag('--json', null);
    if (out) require('fs').writeFileSync(out, JSON.stringify(r, null, 1));
    process.exit(0);
  }, e => { console.error(e); process.exit(1); });
}
module.exports = { run, positions, jobsOf };
