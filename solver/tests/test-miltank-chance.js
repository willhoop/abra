/* solver/tests/test-miltank-chance.js — WEIGHTED CHANCE (solver/miltank/chance.js) on positions from REAL Reg M-C open sheets.
 *
 *   node solver/tests/test-miltank-chance.js [--no-red] [--games 2]     exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * Positions: the humans' own teams and brings (solver/arena/teams.js), played forward by uniform legal joints on seeded
 * dice; at each, random legal (mine, theirs) joint pairs. The enumeration runs with dmg 'exact' (the default; 'coarse' and 'mid'
 * are measured biased, solver/miltank/chance.js DAMAGE DRAWS).
 *   WEIGHTS  the bucket weights are positive and sum to 1; the buckets are distinct boards; no replayed prefix drew a
 *            different stream (the turn is a function of its dice) and no turn ran away.
 *   DIST     the enumerated distribution over board CONSEQUENCES (chance.coarseKey) matches the frequency of the same
 *            consequences over 400 ordinary seeded turns: per consequence |f − w| <= 4·sqrt(w(1−w)/n) + truncatedMass + 0.01.
 *            This is the test that the probabilities are the ENGINE's: nothing here knows an accuracy or a crit rate.
 *   AGREE    Σ w · leaf over the buckets equals the mean leaf of the same 400 seeded turns within 4 SE + truncatedMass.
 *   WIRED    MILTANK with o.chance fills every cell through the enumerator (rollout chancePlayouts = cells), returns a joint
 *            legalActions offers and leaves S untouched; without o.chance the enumerator never runs (off by default);
 *            chance + quiesce is REFUSED, not silently combined.
 *
 * RED, unless --no-red: re-runs itself under MILTANK_BREAK=chance (every bucket weighs the same) and REQUIRES DIST to fail.
 */
'use strict';
require('../arena/env.js');
const cp = require('child_process');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const GAMES = +((i => (i >= 0 ? argv[i + 1] : 0))(argv.indexOf('--games')) || 2);

const API = require('../../engine/medicham_api.js');
const M = API.M;
const T = require('../arena/teams.js');
const prior = require('../prior/infer.js').load();
const PA = require('../miltank/prior_adapter.js').create(API, prior);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
const CH = require('../miltank/chance.js').create(API);

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };
const jointKey = j => j.map(o => o.choice || JSON.stringify(o)).join(' / ');

const L = T.loadGames({ n: GAMES, seed: 7, M });
if (L.refused) cannot(L.refused);
if (!L.games.length) cannot('no buildable games');

const coin = M.rngStreams({ seed: 11 }).any;
const positions = [];
for (let gi = 0; gi < L.games.length; gi++) {
  const G = L.games[gi];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  const rng = API.makeRng(100 + gi);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA.newGame(G);
  const hist = [];
  while (!API.isTerminal(S) && S.turn < 10) {
    hist.push({ G, S: API.clone(S), ctx: { G, hist: ctx.hist.slice() } });
    const jA = API.legalActions(S, 'A').joint, jB = API.legalActions(S, 'B').joint;
    const x = jA[Math.floor(coin() * jA.length)], y = jB[Math.floor(coin() * jB.length)];
    PA.record(ctx, S, x, y);
    API.stepInPlace(S, x, y, rng);
  }
  for (const k of [1, 3]) if (hist[k]) positions.push(hist[k]);
}
if (positions.length < 2) cannot('too few positions');

/* ---------- WEIGHTS / DIST / AGREE ---------- */
const N = 400;
let informative = 0, pairs = 0;
for (const P of positions) {
  const W = R.prepare(P.S);
  const jAs = API.legalActions(P.S, 'A').joint, jBs = API.legalActions(P.S, 'B').joint;
  for (let q = 0; q < 3; q++) {
    const jA = jAs[Math.floor(coin() * jAs.length)], jB = jBs[Math.floor(coin() * jBs.length)];
    const c0 = { sm: CH.COUNTERS.streamMismatch, ra: CH.COUNTERS.runaway };
    const res = CH.enumerate(W, jA, jB, { dmg: 'exact', massEps: 0.01, maxEvals: 3000 });
    pairs++;
    const ws = res.buckets.map(b => b.w);
    const tot = ws.reduce((a, x) => a + x, 0);
    ok('WEIGHTS', Math.abs(tot - 1) < 1e-9 && ws.every(w => w > 0), 'weights sum ' + tot);
    ok('WEIGHTS', new Set(res.buckets.map(b => API.digest(b.S))).size === res.buckets.length, 'two buckets hold one board');
    ok('WEIGHTS', CH.COUNTERS.streamMismatch === c0.sm && CH.COUNTERS.runaway === c0.ra, 'stream mismatch / runaway: ' + JSON.stringify(CH.COUNTERS));
    const slop = res.stats.truncatedMass;
    /* the enumerated distribution over consequences */
    const want = new Map();
    let ex = 0;
    for (const b of res.buckets) { const k = CH.coarseKey(b.S); want.set(k, (want.get(k) || 0) + b.w); ex += b.w * R.leaf(b.S); }
    /* the same consequences over N ordinary seeded turns */
    const got = new Map();
    let s = 0, s2 = 0;
    for (let k = 1; k <= N; k++) {
      const S = R.copy(W); API.makeLean(S);
      API.stepInPlace(S, jA, jB, R.dice(k));
      const key = CH.coarseKey(S); got.set(key, (got.get(key) || 0) + 1);
      const v = R.leaf(S); s += v; s2 += v * v;
    }
    const keys = new Set([...want.keys(), ...got.keys()]);
    let worst = '';
    for (const k of keys) {
      const w = want.get(k) || 0, f = (got.get(k) || 0) / N;
      const tol = 4 * Math.sqrt(Math.max(w * (1 - w), 1 / N) / N) + slop + 0.01;
      if (Math.abs(f - w) > tol) worst = 'consequence ' + k + ' enumerated ' + w.toFixed(4) + ' sampled ' + f.toFixed(4) + ' (tol ' + tol.toFixed(4) + ')';
    }
    ok('DIST', !worst, 'turn ' + P.S.turn + ' ' + jointKey(jA) + ' vs ' + jointKey(jB) + ': ' + worst);
    if (want.size >= 2) informative++;
    const mean = s / N, se = Math.sqrt(Math.max(0, s2 / N - mean * mean) / N);
    ok('AGREE', Math.abs(ex - mean) <= 4 * se + slop + 1e-6, 'turn ' + P.S.turn + ' exact ' + ex.toFixed(5) + ' sampled ' + mean.toFixed(5) + ' ± ' + se.toFixed(5) + ' slop ' + slop.toFixed(4));
  }
}
ok('DIST', informative >= 3, 'too few pairs with two or more consequences to answer DIST: ' + informative);
console.log('  WEIGHTS/DIST/AGREE: ' + pairs + ' joint pairs, ' + informative + ' with 2+ consequences; enumerator ' + JSON.stringify({ evals: CH.COUNTERS.evals, buckets: CH.COUNTERS.buckets, snapped: CH.COUNTERS.snapped, unsnapped: CH.COUNTERS.unsnapped }));

/* ---------- WIRED ---------- */
{
  const P = positions[positions.length - 1];
  const dg = API.digest(P.S);
  const off0 = R.COUNTERS.chancePlayouts;
  MT.decide(P.S, 'A', P.ctx, { budgetMs: 1e9, maxPasses: 1, k1: 3, k2: 3, depth: 0, coin: M.rngStreams({ seed: 5 }).any });
  ok('WIRED', R.COUNTERS.chancePlayouts === off0, 'the enumerator ran with chance off');
  const c0 = R.COUNTERS.chancePlayouts, d0 = MT.COUNTERS.chanceDecisions;
  const d = MT.decide(P.S, 'A', P.ctx, { budgetMs: 1e9, maxPasses: 1, k1: 3, k2: 3, depth: 0, chance: { maxEvals: 600 }, coin: M.rngStreams({ seed: 5 }).any });
  if (!d.info.forced) {
    ok('WIRED', MT.COUNTERS.chanceDecisions === d0 + 1, 'chanceDecisions did not count');
    ok('WIRED', R.COUNTERS.chancePlayouts - c0 === d.info.m * d.info.n && d.info.unfilled === 0, 'chance playouts ' + (R.COUNTERS.chancePlayouts - c0) + ' for ' + d.info.m + 'x' + d.info.n + ' cells');
  }
  ok('WIRED', API.digest(P.S) === dg, 'decide mutated S');
  ok('WIRED', API.legalActions(P.S, 'A').joint.map(jointKey).includes(jointKey(d.joint)), 'illegal joint ' + jointKey(d.joint));
  let refused = false;
  try { MT.decide(P.S, 'A', P.ctx, { budgetMs: 1e9, maxPasses: 1, k1: 2, k2: 2, depth: 0, chance: true, quiesce: 'all', coin: M.rngStreams({ seed: 5 }).any }); }
  catch (e) { refused = /not combined/.test(String(e.message)); }
  ok('WIRED', refused, 'chance + quiesce was not refused');
  console.log('  WIRED: ' + (d.info.forced ? 'forced position' : d.info.m + 'x' + d.info.n + ' cells through the enumerator'));
}

const brk = CH.BROKEN;
console.log('test-miltank-chance: ' + (checks - fails) + '/' + checks + ' checks' + (brk ? '  [BREAK ' + brk + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));

if (!NO_RED && !brk) {
  const need = [['MILTANK_BREAK', 'chance', 'DIST']];
  let blind = 0;
  for (const [envk, v, clause] of need) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--games', String(GAMES)], { env: Object.assign({}, process.env, { [envk]: v }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-miltank-chance:') && l.includes('failed clauses')) || '';
    const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
    console.log('  RED ' + envk + '=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line));
    if (!seen) blind++;
  }
  if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
