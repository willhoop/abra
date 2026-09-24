/* solver/tests/test-playout-speed.js — the playout speed-ups change NOTHING but the time.
 *
 *   node solver/tests/test-playout-speed.js [--no-red] [--games 3]     exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * Positions: real Reg M-C team pairs played forward on fixed dice (solver/bench/playout_bench.js).
 *   CLONE   a prepared world's copy (rollout.copy(rollout.prepare(W))) has the same battle digest as
 *           API.clone(W) — the digest is canonical and key-order sensitive — on every sampled world.
 *   IDENT   every cell value R.playout produces equals the value of the PRE-CHANGE playout, written out
 *           below from commit 562dc055 (API.clone + API.makeRng), on the same world, joints and seed.
 *   POOL    the worker pool at a pass cap returns the serial fill's matrix BIT FOR BIT (sum and count of
 *           every cell, 3 workers, a pass cap that is not a multiple of 3), and decideAsync through the
 *           pool returns decide()'s joint, value and playout count.
 *   COVER   passes cut short by the clock start at DIFFERENT cells: eight passes each stopped after one
 *           playout fill at least six distinct cells, and the value each one wrote equals that cell's value
 *           in a full pass (a cell's value does not depend on the order it was played in).
 *
 * RED, unless --no-red: re-runs itself under each deliberate break and REQUIRES the named clause to fail:
 *   MILTANK_BREAK=prepare -> CLONE     (the prepared copy drops the battle's scratch scope)
 *   MILTANK_BREAK=rng     -> IDENT     (the playout's dice streams collapse into one stream)
 *   MILTANK_POOL_BREAK=stride -> POOL  (every worker replays passes 0,1,2,… instead of its own stride)
 *   MILTANK_POOL_BREAK=rotate -> COVER (every pass starts at cell (0,0) again, as the first version did)
 */
'use strict';
require('../arena/env.js');
const cp = require('child_process');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const GAMES = +((i => (i >= 0 ? argv[i + 1] : 0))(argv.indexOf('--games')) || 3);
process.argv.push('--games', String(GAMES), '--k', '4');   // the bench module reads its flags from argv

const API = require('../../engine/medicham_api.js');
const M = API.M;
const T = require('../arena/teams.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../prior/infer.js').load());
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
const C = require('../miltank/cells.js');
const B = require('../bench/playout_bench.js');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 20) console.log('  FAIL [' + clause + '] ' + msg); } };

/* THE PRE-CHANGE PLAYOUT, verbatim from solver/miltank/rollout.js at 562dc055 (less the crn break). The
 * reference the new one must equal. It shares randomJoint and leaf with R — those did not change. */
function referencePlayout(W, jA, jB, seed, depth) {
  const S = API.clone(W);
  const rng = API.makeRng(seed);
  const coin = M.rngStreams({ seed: seed + 7919 }).any;
  API.stepInPlace(S, jA, jB, rng);
  for (let d = 0; d < depth && !API.isTerminal(S); d++) API.stepInPlace(S, R.randomJoint(S, 'A', coin), R.randomJoint(S, 'B', coin), rng);
  return R.leaf(S);
}

async function main() {
  const P = B.positions();
  const jobs = B.jobsOf(P);
  if (jobs.length < 5) { console.log('CANNOT ANSWER: ' + jobs.length + ' positions'); process.exit(2); }
  console.log('test-playout-speed: ' + jobs.length + ' positions from ' + GAMES + ' real Reg M-C team pairs');

  /* ---------- CLONE + IDENT ---------- */
  let cells = 0, worlds = 0;
  jobs.forEach((J, ji) => {
    for (let pass = 0; pass < 2; pass++) {
      const seed = J.baseSeed + pass * C.STRIDE;
      const W = R.sampleWorld(J.S, 'B', J.belief, M.rngStreams({ seed: seed + 1 }).any);
      const Wp = R.prepare(W);
      ok('CLONE', API.digest(R.copy(Wp)) === API.digest(API.clone(W)), 'position ' + ji + ' pass ' + pass + ': prepared copy differs from API.clone');
      worlds++;
      for (const jA of J.rows) for (const jB of J.cols) {
        for (const depth of [1, 2]) {
          const a = R.playout(Wp, jA, jB, seed, depth), b = referencePlayout(W, jA, jB, seed, depth);
          ok('IDENT', Object.is(a, b), 'position ' + ji + ' depth ' + depth + ': ' + a + ' vs pre-change ' + b);
          cells++;
        }
      }
    }
  });
  ok('IDENT', cells > 200, 'too few cells to answer: ' + cells);
  console.log('  CLONE: ' + worlds + ' worlds; IDENT: ' + cells + ' playouts against the pre-change playout');

  /* ---------- COVER ---------- */
  {
    let distinctMin = Infinity, n = 0;
    for (const J of jobs.slice(0, 6)) {
      const cells = new Set();
      for (let p = 0; p < 8; p++) {
        const cut = C.playPass(API, R, J, p, 0);            // deadline already past: exactly one playout
        const full = C.playPass(API, R, J, p, Infinity);
        const c = cut.v.findIndex(x => x === x);
        cells.add(c);
        ok('COVER', cut.v.filter(x => x === x).length === 1 && Object.is(cut.v[c], full.v[c]), 'pass ' + p + ': a cut-short cell differs from the full pass');
      }
      distinctMin = Math.min(distinctMin, cells.size); n++;
    }
    ok('COVER', distinctMin >= 6, 'eight cut-short passes reached only ' + distinctMin + ' distinct cells');
    console.log('  COVER: ' + n + ' positions, fewest distinct start cells over 8 passes: ' + distinctMin);
  }

  /* ---------- POOL ---------- */
  const pool = await require('../miltank/pool.js').create({ workers: 3 });
  try {
    let n = 0;
    for (const J of jobs.filter((_, i) => i % 2 === 0).slice(0, 5)) {
      const s = C.fillSerial(API, R, J, Infinity, 5);
      const q = await pool.fill(Object.assign({}, J, { budgetMs: 1e12, maxPasses: 5 }));
      const same = s.passes === q.passes && s.playouts === q.playouts &&
        s.sum.every((r, i) => r.every((x, j) => Object.is(x, q.sum[i][j]) && s.cnt[i][j] === q.cnt[i][j]));
      ok('POOL', same, 'pooled matrix differs from serial (passes ' + s.passes + '/' + q.passes + ', playouts ' + s.playouts + '/' + q.playouts + ')');
      n++;
    }
    let d = 0;
    for (const [i, p] of P.entries()) {
      if (i % 3 !== 0) continue;
      const o = { budgetMs: 1e12, maxPasses: 4, k1: 4, k2: 4, depth: 1 };
      const a = MT.decide(p.S, 'A', { G: p.G, hist: [] }, Object.assign({ coin: M.rngStreams({ seed: 500 + i }).any }, o));
      const b = await MT.decideAsync(p.S, 'A', { G: p.G, hist: [] }, Object.assign({ coin: M.rngStreams({ seed: 500 + i }).any, pool }, o));
      if (a.info.forced) continue;
      ok('POOL', JSON.stringify(a.joint) === JSON.stringify(b.joint) && Object.is(a.info.value, b.info.value) && a.info.playouts === b.info.playouts,
         'decideAsync(pool) != decide at position ' + i + ': ' + a.info.value + ' vs ' + b.info.value);
      d++;
    }
    ok('POOL', n >= 3 && d >= 3 && pool.counters.playouts > 0, 'too few pooled checks: ' + n + ' fills, ' + d + ' decisions, worker playouts ' + pool.counters.playouts);
    console.log('  POOL: ' + n + ' matrices and ' + d + ' decisions, 3 workers, ' + pool.counters.playouts + ' worker playouts');
  } finally { pool.close(); }

  const brk = R.BROKEN || process.env.MILTANK_POOL_BREAK || null;
  console.log('test-playout-speed: ' + (checks - fails) + '/' + checks + ' checks' + (brk ? '  [BREAK ' + brk + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));

  if (!NO_RED && !brk) {
    const need = [['MILTANK_BREAK', 'prepare', 'CLONE'], ['MILTANK_BREAK', 'rng', 'IDENT'], ['MILTANK_POOL_BREAK', 'stride', 'POOL'], ['MILTANK_POOL_BREAK', 'rotate', 'COVER']];
    let blind = 0;
    for (const [envk, v, clause] of need) {
      const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--games', String(GAMES)], { env: Object.assign({}, process.env, { [envk]: v }), encoding: 'utf8' });
      const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-playout-speed:') && l.includes('failed clauses')) || '';
      const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
      console.log('  RED ' + envk + '=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line));
      if (!seen) blind++;
    }
    if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
  }
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('CANNOT ANSWER: ' + (e && e.stack || e)); process.exit(2); });
