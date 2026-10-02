/* solver/tests/test-search-pool.js — ROTOM's live decision and the arena agent through MILTANK's worker pool (2026-10-02,
 * docs/_reports/2026-10-02-parallelism.md).
 *
 *   node solver/tests/test-search-pool.js [--no-red]     exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND (a break did not go red)
 *
 *   IDENTITY  ROTOM's miltank-gen5 move (solver/rotom/policy.js) at a PASS CAP, pooled (3 workers) and in-process, on the
 *             two move fixtures with a XATU-shaped back posterior: the same choice, value, pick, playout count and payoff
 *             table, bit for bit. The pool's worlds are XATU's honest sampler rebuilt in each worker (job.world), so this
 *             is the clause that says the workers draw the SAME worlds as the parent would.
 *   COUNTER   every pooled decision carries info.pool: 3 workers, and EVERY worker delivered playouts (none idle);
 *             policy COUNTERS.pool.decisions counts them.
 *   ADAPT     an onPass stop through the pool (the adaptive clock's hook) ends a 60 s fill early, after >= 2 complete passes.
 *   SWITCH    a pooled forced switch scores its candidates in the pool and answers a request-legal choice.
 *   AGENT     the arena agent (solver/mew/agent.js spec.pool, the screen's pooled arm) at a pass cap equals the same spec
 *             unpooled on an honest view: joint, value, playouts.
 *   FALLBACK  a pool with a worker killed (by the pid this test spawned) still answers a legal choice IN-PROCESS, and the
 *             fallback is COUNTED (COUNTERS.pool.fallback, info.pool.workers 0, onPoolDead called).
 *
 * RED, unless --no-red: re-runs itself under each deliberate break and REQUIRES the named clause to fail:
 *   MILTANK_POOL_BREAK=noworld -> IDENTITY   (workers ignore job.world and draw the uniform back line, no spread belief)
 *   ROTOM_POOL_BREAK=nocount   -> FALLBACK   (the fallback is taken but not counted)
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
require('../arena/env.js');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const FIX = path.join(__dirname, 'fixtures', 'rotom');
const fx = n => JSON.parse(fs.readFileSync(path.join(FIX, n + '.json'), 'utf8'));

const API = require('../../engine/medicham_api.js');
const M = API.M;
const T = require('../arena/teams.js');
const RQ = require('../rotom/request.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../mag/infer.js').load());
/* ROTOM's own rollout: PUBLIC fresh bodies (solver/rotom/rotom.js), and the pool told to build the same */
const R = require('../miltank/rollout.js').create(API, { buildBody: T.bodyBuilder(M, { view: 'public' }) });
const WB = require('../rotom/world.js').create(API);
const P = require('../rotom/policy.js').create({ API, PA, R, tables: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rotom', 'tables.json'), 'utf8')) });
const { parseGame } = require('../human/parse_game.js');
const POOLMOD = require('../miltank/pool.js');

function worldOf(f, kind) {
  const lines = kind === 'switch' ? f.lines.concat(['|turn|' + (f.turn + 1)]) : f.lines;
  let row; try { row = parseGame({ id: 'fx', log: lines.join('\n') }); } catch (e) { row = parseGame({ id: 'fx', log: f.lines.join('\n') }); }
  return WB.build({ row, sheets: f.sheets, me: f.me, req: f.req, oppGuess: null });
}
function backOf(w, f) {
  const revRows = w.theirs.filter(x => x.pub && x.pub.seen).map(x => x.s);
  const rest = [0, 1, 2, 3, 4, 5].filter(i => !revRows.includes(i));
  return rest.length >= 2 ? [{ pair: [rest[0], rest[1]], p: 0.75 }, { pair: [rest[rest.length - 2], rest[rest.length - 1]], p: 0.25 }] : null;
}
const sig = r => JSON.stringify({ c: r.choice, v: r.info.value, pick: r.info.pick, n: r.info.playouts, passes: r.info.passes, A: r.info.table && r.info.table.A, mix: r.info.table && r.info.table.mix });

async function main() {
  const moveFx = ['move-mega-disabled', 'move-disabled'].map(fx), forceFx = ['force-a', 'force-b'].map(fx);
  const pool = await POOLMOD.create({ workers: 3, env: { MILTANK_BODIES: 'public' } });
  try {
    /* warm the gen5 searcher in this process (the nets, the leaf) */
    { const w = worldOf(moveFx[0], 'move'); P.warmGen5(API.clone(w.S), w.ctx, M.rngStreams({ seed: 3 }).any); }

    /* ---------- IDENTITY + COUNTER ---------- */
    let pooledN = 0;
    for (const [fi, f] of moveFx.entries()) {
      const d0 = P.COUNTERS.pool.decisions;
      const wa = worldOf(f, 'move'), wb = worldOf(f, 'move');
      const back = backOf(wa, f);
      const base = { req: f.req, budgetMs: 120000, xatuBack: back, maxPasses: 7 };   // 7: not a multiple of 3
      const a = P.move('miltank-gen5', Object.assign({}, base, { world: wa, coin: M.rngStreams({ seed: 900 + fi }).any }));
      const b = await P.move('miltank-gen5', Object.assign({}, base, { world: wb, coin: M.rngStreams({ seed: 900 + fi }).any, pool }));
      ok('IDENTITY', a.choice && RQ.isLegal(f.req, a.choice) && b.choice && RQ.isLegal(f.req, b.choice), 'fixture ' + fi + ': a choice is not legal');
      if (a.info.forced) { console.log('  fixture ' + fi + ': forced (no search to compare)'); continue; }
      ok('IDENTITY', sig(a) === sig(b), 'fixture ' + fi + ': pooled differs from in-process\n      in-process ' + sig(a).slice(0, 300) + '\n      pooled     ' + sig(b).slice(0, 300));
      ok('IDENTITY', a.info.passes === 7 && b.info.passes === 7, 'fixture ' + fi + ': passes ' + a.info.passes + ' / ' + b.info.passes + ' (want the cap, 7)');
      const q = b.info.pool;
      ok('COUNTER', q && q.workers === 3 && q.playouts_by_worker.length === 3 && q.playouts_by_worker.every(x => x > 0) && q.idle_workers === 0,
         'fixture ' + fi + ': info.pool ' + JSON.stringify(q));
      ok('COUNTER', q && q.playouts_by_worker.reduce((s, x) => s + x, 0) === b.info.playouts, 'fixture ' + fi + ': per-worker playouts do not sum to the decision\'s');
      ok('COUNTER', P.COUNTERS.pool.decisions === d0 + 1, 'COUNTERS.pool.decisions did not count the pooled decision');
      pooledN++;
      console.log('  fixture ' + fi + ': value ' + (+b.info.value).toFixed(5) + ', ' + b.info.playouts + ' playouts, per worker ' + JSON.stringify(q && q.playouts_by_worker));
    }
    ok('IDENTITY', pooledN >= 1, 'no fixture searched: cannot answer');

    /* ---------- ADAPT ---------- */
    {
      const f = moveFx[0], w = worldOf(f, 'move');
      let calls = 0;
      const t = Date.now();
      const r = await P.move('miltank-gen5', { req: f.req, world: w, budgetMs: 60000, xatuBack: backOf(w, f), coin: M.rngStreams({ seed: 77 }).any, pool,
                                             onPass: vs => { calls++; return vs.length >= 2; } });
      const ms = Date.now() - t;
      ok('ADAPT', r.info.forced || (calls >= 1 && r.info.adapt_stop === true && r.info.passes >= 2 && ms < 30000), 'onPass through the pool: calls ' + calls + ', adapt_stop ' + r.info.adapt_stop + ', passes ' + r.info.passes + ', ' + ms + ' ms');
      console.log('  ADAPT: stopped after ' + ms + ' ms, ' + r.info.passes + ' passes, onPass called ' + calls + 'x');
    }

    /* ---------- SWITCH ---------- */
    for (const f of forceFx) {
      const s0 = P.COUNTERS.pool.switchScored;
      const r = await P.forceSwitch('miltank-gen5', { req: f.req, world: worldOf(f, 'switch'), coin: M.rngStreams({ seed: 5 }).any, budgetMs: 1500, xatuBack: null, pool });
      ok('SWITCH', r.choice && RQ.isLegal(f.req, r.choice), 'pooled forced switch: ' + (r && r.choice));
      ok('SWITCH', r.info.only || r.info.rule || (P.COUNTERS.pool.switchScored > s0 && r.info.pool && r.info.pool.scored_pooled > 0), 'the forced switch was not scored in the pool: ' + JSON.stringify(r.info).slice(0, 240));
    }

    /* ---------- AGENT (the arena's pooled arm) ---------- */
    {
      const L = T.loadGames({ n: 2, seed: 7, M });
      if (L.refused || !L.games.length) { console.log('CANNOT ANSWER: no human games for the AGENT clause (' + (L.refused || 'none') + ')'); process.exit(2); }
      const G = L.games[0];
      const AGm = require('../mew/agent.js').create(API, { buildBody: T.bodyBuilder(M, { view: 'public' }), poolEnv: { MILTANK_BODIES: 'public' } });
      const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'machamp', 'league', 'gen5.json'), 'utf8'));
      const plain = AGm.load(Object.assign({}, spec, { name: 'gen5-cap', maxPasses: 5, budgetMs: 120000 }));
      const pooled = AGm.load(Object.assign({}, spec, { name: 'gen5-cap-pool', maxPasses: 5, budgetMs: 120000, pool: 2 }));
      const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
      const S = API.newBattle(a.team, b.team, { rng: API.makeRng(4242) });
      const ctx = plain.PA.newGame(G);
      const H = AGm.XW.arenaGame(G, S);
      let compared = 0;
      for (const side of ['A', 'B']) {
        const v1 = AGm.XW.arenaView(H, G, S, side, plain.PA), v2 = AGm.XW.arenaView(H, G, S, side, plain.PA);
        const r1 = plain.bot(31).choose(v1.V, side, ctx, v1.hb);
        const r2 = await pooled.bot(31).choose(v2.V, side, ctx, v2.hb);
        if (r1.info.forced) continue;
        compared++;
        const s1 = JSON.stringify([r1.joint, r1.info.value, r1.info.playouts]), s2 = JSON.stringify([r2.joint, r2.info.value, r2.info.playouts]);
        ok('AGENT', s1 === s2 && !r2.info.fallback, 'side ' + side + ': pooled agent ' + s2.slice(0, 200) + ' vs ' + s1.slice(0, 200));
        ok('AGENT', r2.info.pool && r2.info.pool.workers === 2 && r2.info.pool.idle_workers === 0, 'side ' + side + ': agent info.pool ' + JSON.stringify(r2.info.pool));
      }
      ok('AGENT', compared >= 1, 'no searched decision to compare');
      ok('AGENT', AGm.COUNTERS.pool && AGm.COUNTERS.pool['gen5-cap-pool'] && AGm.COUNTERS.pool['gen5-cap-pool'].decisions >= 1, 'agent COUNTERS.pool did not count: ' + JSON.stringify(AGm.COUNTERS.pool));
      console.log('  AGENT: ' + compared + ' decisions compared, pool counters ' + JSON.stringify(AGm.COUNTERS.pool && AGm.COUNTERS.pool['gen5-cap-pool']));
    }

    /* ---------- FALLBACK: kill one worker WE spawned, by its pid ---------- */
    {
      const pid = pool.pids[1];
      process.kill(pid);
      for (let i = 0; i < 50 && pool.alive(); i++) await new Promise(r => setTimeout(r, 100));
      ok('FALLBACK', !pool.alive(), 'the pool still reports alive after its worker ' + pid + ' was killed');
      const f = moveFx[0], w = worldOf(f, 'move');
      const fb0 = P.COUNTERS.pool.fallback;
      let died = null;
      const r = await P.move('miltank-gen5', { req: f.req, world: w, budgetMs: 1500, xatuBack: backOf(w, f), coin: M.rngStreams({ seed: 8 }).any, pool, onPoolDead: why => { died = why; } });
      ok('FALLBACK', r.choice && RQ.isLegal(f.req, r.choice), 'no legal choice from the fallback: ' + (r && r.choice));
      ok('FALLBACK', P.COUNTERS.pool.fallback === fb0 + 1, 'the pool fallback was not counted (' + fb0 + ' -> ' + P.COUNTERS.pool.fallback + ')');
      ok('FALLBACK', r.info.pool && r.info.pool.workers === 0 && r.info.pool.fallback, 'the decision does not say it fell back: ' + JSON.stringify(r.info.pool));
      ok('FALLBACK', died != null, 'onPoolDead was not called');
      ok('FALLBACK', r.info.forced || r.info.playouts > 0, 'the in-process fallback did not search: playouts ' + r.info.playouts);
      console.log('  FALLBACK: worker ' + pid + ' killed; choice ' + r.choice + ', in-process playouts ' + r.info.playouts + ', counted ' + P.COUNTERS.pool.fallback);
    }
  } finally { pool.close(); }

  console.log('test-search-pool: ' + (checks - fails) + '/' + checks + (fails ? ' — RED (' + [...failed].join(', ') + ')' : ' — GREEN'));
  if (process.env.SEARCH_POOL_CHILD) process.exit(fails ? 1 : 0);
  if (fails) process.exit(1);

  if (!NO_RED) {
    const breaks = [['MILTANK_POOL_BREAK', 'noworld', 'IDENTITY'], ['ROTOM_POOL_BREAK', 'nocount', 'FALLBACK']];
    let blind = 0;
    for (const [k, v, clause] of breaks) {
      const env = Object.assign({}, process.env, { [k]: v, SEARCH_POOL_CHILD: '1' });
      const r = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env, encoding: 'utf8', timeout: 900000 });
      const red = r.status === 1 && new RegExp('FAIL \\[' + clause + '\\]').test(r.stdout);
      console.log('  RED ' + k + '=' + v + ' -> ' + clause + ': ' + (red ? 'red, as it must be' : 'NOT RED (exit ' + r.status + ')'));
      if (!red) { blind++; console.log((r.stdout || '').split('\n').filter(l => /FAIL|RED|GREEN/.test(l)).slice(0, 8).join('\n')); }
    }
    if (blind) { console.log('test-search-pool: BLIND — ' + blind + ' deliberate break(s) did not go red'); process.exit(3); }
  }
  process.exit(0);
}
main().catch(e => { console.log('test-search-pool: CANNOT ANSWER — ' + (e && e.stack || e)); process.exit(2); });
