/* solver/tests/test-col-coverage.js — the per-arm counters and the column-coverage counter prove what they count (2026-10-01).
 *
 *   node solver/tests/test-col-coverage.js [--no-red] [--release <id>]        exit 0 GREEN, 1 RED
 *
 *   UNIT  solver/arena/col_coverage.js on constructed joints: a joint in the columns hits; the same move at another target
 *         misses on `target` and hits on `move`; a switch to another body misses on `target`; an empty slot matches
 *         anything; a column for one slot only does not cover a joint whose other slot it does not hold.
 *   LIVE  a 1-pair match through solver/machamp/gate.js, X = gen5 at k2 8 and Y = gen5 at k2 4, both on ROTOM's adaptive
 *         clock (the screen's path): gate.js's `arms` holds BOTH agents by name; X used more than 4 columns on some
 *         decision and never more than 8, Y never more than 4; every searched decision of each arm was scored for coverage
 *         (cov.n = searched, so a dropped column list cannot pass as 0 coverage); and the playouts per arm sum to the
 *         shard's pooled RUN.playouts.
 *
 * RED, unless --no-red — each must turn this test red:
 *   COLCOV_BREAK=notarget   `target` ignores the target          -> UNIT
 *   MEW_BREAK=dropcols      the adaptive path drops the columns  -> LIVE
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const REL = process.env.ARENA_TEST_RELEASE || (argv.includes('--release') ? argv[argv.indexOf('--release') + 1] : 'df172ccd2aaf');
const STORE = process.env.ARENA_TEST_STORE || 'C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'colcov-'));
let fails = 0, checks = 0;
const failed = new Set();
function ok(clause, c, msg) { checks++; if (!c) { fails++; failed.add(clause); } console.log(`  ${c ? 'ok  ' : 'FAIL'} [${clause}] ${msg}`); }
const nodeRun = (script, args, env) => cp.spawnSync(process.execPath, ['--max-old-space-size=1536', script, ...args], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}), maxBuffer: 1 << 26 });

/* ---------------- UNIT (in a child, so the break env reaches the module) ---------------- */
function unit(env) {
  const script = path.join(TMP, 'unit.js');
  fs.writeFileSync(script, `
const CC = require(${JSON.stringify(path.join(ROOT, 'solver', 'arena', 'col_coverage.js'))});
const mv = (move, target) => ({ kind: 'move', move, target, mega: false });
const sw = ident => ({ kind: 'switch', to: 2, ident });
const cols = [[mv('fakeout', 1), mv('protect', null)], [mv('heatwave', null), sw('p2: Garchomp')], [mv('fakeout', 2), mv('heatwave', null)]];
const r = {
  exact: CC.jointHit(cols, [mv('fakeout', 1), mv('protect', null)], 'target'),
  wrongTargetT: CC.jointHit(cols, [mv('fakeout', 1), mv('heatwave', null)], 'target'),
  wrongTargetM: CC.jointHit(cols, [mv('fakeout', 1), mv('heatwave', null)], 'move'),
  otherBodyT: CC.jointHit(cols, [mv('heatwave', null), sw('p2: Incineroar')], 'target'),
  otherBodyM: CC.jointHit(cols, [mv('heatwave', null), sw('p2: Incineroar')], 'move'),
  emptySlot: CC.jointHit(cols, [null, mv('protect', null)], 'target'),
  notTogether: CC.jointHit(cols, [mv('fakeout', 2), mv('protect', null)], 'target'),
};
console.log(JSON.stringify(r));`);
  const r = nodeRun(script, [], env);
  if (r.status !== 0) { console.log(r.stderr); return null; }
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function checkUnit(U) {
  ok('UNIT', !!U, 'the unit probe ran');
  if (!U) return;
  ok('UNIT', U.exact === true, 'a joint held by a column is covered');
  ok('UNIT', U.wrongTargetT === false && U.wrongTargetM === true, `the same move at another target misses on target (${U.wrongTargetT}) and hits on move (${U.wrongTargetM})`);
  ok('UNIT', U.otherBodyT === false && U.otherBodyM === true, `a switch to another body misses on target (${U.otherBodyT}), hits on move (${U.otherBodyM})`);
  ok('UNIT', U.emptySlot === true, 'a slot with no action matches anything');
  ok('UNIT', U.notTogether === false, 'two slots each held by a different column are not covered together');
}

/* ---------------- LIVE ---------------- */
function live(env) {
  const out = path.join(TMP, 'gate-' + (env ? 'red' : 'ok') + '.json');
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'results', '2026-09-30-human-regularised', 'screen-2s-off.json'), 'utf8'));
  const adaptive = { targetMs: 400, credit0Ms: 133 };
  const x = path.join(TMP, 'x.json'), y = path.join(TMP, 'y.json');
  fs.writeFileSync(x, JSON.stringify(Object.assign({}, base, { name: 'test-k8', k2: 8, adaptive })));
  fs.writeFileSync(y, JSON.stringify(Object.assign({}, base, { name: 'test-k4', k2: 4, adaptive })));
  const r = nodeRun(path.join(ROOT, 'solver', 'machamp', 'gate.js'), ['--release', REL, '--x', x, '--y', y, '--pairs', '1', '--seed', '7', '--workers', '1', '--cap', '6',
    '--rule', 'notlose', '--info', 'honest', '--spreads', 'role-v1', '--team-store', STORE, '--out', out], env);
  if (r.status !== 0) { console.log(r.stdout, r.stderr); return null; }
  const res = JSON.parse(fs.readFileSync(out, 'utf8'));
  const sum = JSON.parse(fs.readFileSync(path.join(out.replace(/\.json$/, '') + '.shards', 'shard-0.jsonl.summary.json'), 'utf8'));
  const lines = fs.readFileSync(path.join(out.replace(/\.json$/, '') + '.shards', 'shard-0.jsonl'), 'utf8').trim().split('\n');
  return { res, run: JSON.parse(lines[lines.length - 1]).ctr, sum };
}
function checkLive(L) {
  ok('LIVE', !!L, 'a 1-pair k8-vs-k4 match ran through gate.js');
  if (!L) return;
  const X = L.res.arms['test-k8'], Y = L.res.arms['test-k4'];
  ok('LIVE', !!X && !!Y, `gate.js arms holds both agents (${Object.keys(L.res.arms || {}).join(', ')})`);
  if (!X || !Y) return;
  const keys = h => Object.keys(h).map(Number);
  ok('LIVE', X.searched > 0 && Y.searched > 0, `both arms searched (k8 ${X.searched}, k4 ${Y.searched})`);
  ok('LIVE', Math.max(...keys(X.cols_hist)) > 4 && Math.max(...keys(X.cols_hist)) <= 8, `k8 used more than 4 columns and never more than 8 (${JSON.stringify(X.cols_hist)})`);
  ok('LIVE', Math.max(...keys(Y.cols_hist)) <= 4, `k4 never used more than 4 columns (${JSON.stringify(Y.cols_hist)})`);
  ok('LIVE', X.cov.n === X.searched && Y.cov.n === Y.searched, `every searched decision was scored for coverage (k8 ${X.cov.n}/${X.searched}, k4 ${Y.cov.n}/${Y.searched})`);
  ok('LIVE', X.playouts + Y.playouts === L.run.playouts, `per-arm playouts sum to the pooled RUN (${X.playouts} + ${Y.playouts} = ${L.run.playouts})`);
}

function runAll(env) {
  fails = 0; checks = 0; failed.clear();
  checkUnit(unit(env)); checkLive(live(env));
  return { fails, checks, failed: new Set(failed) };
}

console.log(`test-col-coverage (release ${REL})`);
const g = runAll(null);
console.log(`${g.checks - g.fails}/${g.checks} ${g.fails ? 'RED' : 'GREEN'}`);
let redOk = true;
if (!NO_RED) {
  for (const [env, clause] of [[{ COLCOV_BREAK: 'notarget' }, 'UNIT'], [{ MEW_BREAK: 'dropcols' }, 'LIVE']]) {
    console.log(`-- deliberate break ${JSON.stringify(env)}: ${clause} must go red`);
    const b = runAll(env);
    const red = b.failed.has(clause);
    console.log(`   ${red ? 'RED as required' : 'STILL GREEN — the test is blind to this break'}`);
    if (!red) redOk = false;
  }
}
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* the temp dir this test made */ }
process.exit(g.fails || !redOk ? 1 : 0);
