/* solver/tests/test-miltank-deadline.js — a MILTANK decision returns within its budget + 500 ms, whatever the load.
 *
 *   node solver/tests/test-miltank-deadline.js [--no-red] [--release <id>] [--core 15] [--n 40]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * Each clause runs solver/bench/deadline_bench.js on real Reg M-C positions (the humans' own sheets, brings and
 * leads, played forward by the prior) at a 500 ms budget, the load confined to ONE logical core (`--core`): a burner
 * process that alternates starve episodes (NORMAL priority, above the pool workers), fair ones (the workers' own
 * class) and idle ones. The bench's own artifact is read back; nothing is inferred from its exit code alone.
 *   BOUND    under that load, every decision — the pool lane (arena path: decideAsync, 1 worker) and the serial lane
 *            (ROTOM's path: decide, with collectIdle between decisions) — returns in <= budget + 500 ms. No errors.
 *   COUNTED  every fallback is visible: the decisions whose info names a fallback equal MILTANK's fallbackEmpty +
 *            fallbackSparse counters, and under the starve load the pool's deadline timer fired (deadlineResolves > 0)
 *            and at least one fallback happened — a hard deadline that never had to act has not been tested.
 *   SEARCH   the deadline does not starve the search itself: with NO load, at a 1.5 s budget, both lanes solve at least
 *            80% of their decisions from the table (no fallback) and the median decision plays at least 16 playouts.
 *
 * RED, unless --no-red: re-runs the BOUND clause under MILTANK_DEADLINE_BREAK=1 (the pool waits for every worker
 * and a pass always starts, as before 2026-09-25) and REQUIRES it to fail.
 *
 * The full measurement (2,000 decisions at 1 s and at 5 s) is the bench itself; see
 * docs/_reports/2026-09-25-miltank-deadline.md. This test is its small, repeatable form.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NO_RED = argv.includes('--no-red');
const RELEASE = flag('--release', process.env.ARENA_TEST_RELEASE || 'eaa5becc54eb');
const CORE = flag('--core', '15');
const N = +flag('--n', 40);
const BUDGET = 500, BOUND = BUDGET + 500;
/* the no-load control runs at 1.5 s: one process fills ~40 playouts a second on these positions (measured), so 500 ms
 * is too short to fill a quarter of an 8x8 table even with the machine to itself — that would test the budget, not
 * whether the deadline machinery starves the search */
const SEARCH_BUDGET = 1500;
const ROOT = path.join(__dirname, '..', '..');
const BENCH = path.join(ROOT, 'solver', 'bench', 'deadline_bench.js');
const OUT = path.join(ROOT, 'solver', 'out', 'deadline', 'test');
const ONLY = flag('--only', null);   // internal: the RED re-run asks for one clause

if (!fs.existsSync(path.join(ROOT, 'data', 'releases', RELEASE))) { console.log('CANNOT ANSWER: release ' + RELEASE + ' is not in data/releases'); process.exit(2); }

function bench(tag, args, env, budget) {
  const out = path.join(OUT, tag + '.json');
  try { fs.unlinkSync(out); } catch (e) {}
  const r = cp.spawnSync(process.execPath, [BENCH, '--release', RELEASE, '--budget', String(budget || BUDGET), '--out', out, '--tag', tag].concat(args),
    { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}), maxBuffer: 1 << 26 });
  if (!fs.existsSync(out)) { console.log('  bench ' + tag + ' wrote nothing (exit ' + r.status + '): ' + String(r.stderr || r.stdout).split('\n').filter(l => !/ABRA REGULATION/.test(l)).slice(-5).join(' | ')); return null; }
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const LOAD = ['--core', CORE, '--burn', '1', '--starve', '0.5', '--idle', '0.2', '--decisions', String(N)];
const fallbacksCounted = r => r.per_decision.filter(x => x.fallback).length === (r.counters.miltank.fallbackEmpty || 0) + (r.counters.miltank.fallbackSparse || 0);

fs.mkdirSync(OUT, { recursive: true });
const want = c => !ONLY || ONLY === c;

if (want('BOUND') || want('COUNTED')) {
  const pool = bench('load-pool', ['--lane', 'pool', '--workers', '1'].concat(LOAD));
  /* the serial lane collects garbage between decisions (search.js collectIdle), as ROTOM must: without it a major GC inside a
   * decision on the loaded core ran 1.1-1.6 s, past the margin (docs/_reports/2026-09-25-miltank-deadline.md) */
  const serial = bench('load-serial', ['--lane', 'serial', '--idle-gc'].concat(LOAD));
  if (!pool || !serial) { console.log('CANNOT ANSWER: a bench run failed'); process.exit(2); }
  for (const [name, r] of [['pool', pool], ['serial', serial]]) {
    console.log(`  BOUND ${name}: ${r.latency_ms.n} decisions  p50 ${r.latency_ms.p50}  p99 ${r.latency_ms.p99}  max ${r.latency_ms.max} ms (bound ${BOUND})  fallbacks ${r.fallbacks}  starve ${r.load.starve_s} s`);
    ok('BOUND', r.latency_ms.max <= BOUND, `${name}: max ${r.latency_ms.max} ms > ${BOUND} ms (${r.over_bound} over)`);
    ok('BOUND', r.errors === 0, `${name}: ${r.errors} errors`);
    if (want('COUNTED')) {
      ok('COUNTED', fallbacksCounted(r), `${name}: fallbacks in info ${r.fallbacks} != counters ${JSON.stringify(r.counters.miltank)}`);
      ok('COUNTED', r.load.starve_s > 0, `${name}: the burner never ran a starve episode`);
    }
  }
  if (want('COUNTED')) {
    ok('COUNTED', pool.counters.pool && pool.counters.pool.deadlineResolves > 0, 'pool: the deadline timer never fired under the starve load');
    ok('COUNTED', pool.fallbacks > 0, 'pool: no fallback under the starve load — the fallback path was never exercised');
  }
}
if (want('SEARCH')) {
  for (const lane of ['pool', 'serial']) {
    const r = bench('noload-' + lane, ['--lane', lane, '--workers', '1', '--core', CORE, '--burn', '0', '--decisions', '15'], null, SEARCH_BUDGET);
    if (!r) { console.log('CANNOT ANSWER: a bench run failed'); process.exit(2); }
    const solved = r.per_decision.filter(x => !x.forced && !x.fallback).length / r.per_decision.filter(x => !x.forced).length;
    console.log(`  SEARCH ${lane} (no load): solved ${(100 * solved).toFixed(0)}%  median playouts ${r.playouts.p50}  max ${r.latency_ms.max} ms`);
    ok('SEARCH', solved >= 0.8, `${lane}: only ${(100 * solved).toFixed(0)}% of decisions solved without load`);
    ok('SEARCH', r.playouts.p50 >= 16, `${lane}: median ${r.playouts.p50} playouts without load`);
    ok('SEARCH', r.latency_ms.max <= SEARCH_BUDGET + 500, `${lane}: max ${r.latency_ms.max} ms without load`);
  }
}

console.log(`test-miltank-deadline: ${checks - fails}/${checks} checks  ${process.env.MILTANK_DEADLINE_BREAK ? '[BREAK deadline]  ' : ''}failed clauses: ${[...failed].join(', ') || 'none'}`);
if (ONLY) process.exit(fails ? 1 : 0);

let blind = 0;
if (!NO_RED && !fails) {
  const r = cp.spawnSync(process.execPath, [__filename, '--only', 'BOUND', '--release', RELEASE, '--core', CORE, '--n', String(Math.min(N, 20))],
    { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { MILTANK_DEADLINE_BREAK: '1' }), maxBuffer: 1 << 26 });
  const line = String(r.stdout).split('\n').filter(l => /^test-miltank-deadline:|BOUND/.test(l)).join(' | ');
  const red = r.status === 1 && /failed clauses: .*BOUND/.test(r.stdout);
  console.log('  RED MILTANK_DEADLINE_BREAK=1 -> BOUND: ' + (red ? 'fails as required' : 'STAYED GREEN (blind)') + '  ' + line);
  if (!red) blind++;
}
if (fails) process.exit(1);
if (blind) { console.log('BLIND: the BOUND clause did not see its break'); process.exit(3); }
process.exit(0);
