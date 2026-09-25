/* solver/tests/test-arena-release.js — the arena on a FROZEN engine release reads no live engine byte.
 *
 *   node solver/tests/test-arena-release.js [--no-red]      exit 0 GREEN, 1 RED, 3 BLIND
 *   env ARENA_TEST_RELEASE=<id>   the release to play (default: the regulation's release pointer)
 *
 * A measurement is a photograph (CLAUDE.md): with --release, every engine and data byte the arena and its
 * pool workers load must come from data/releases/<id>/. This test runs the real arena CLI under a preload
 * that records every file each process opens — by require or by an fs read — in the parent AND in every
 * forked pool worker (fork inherits the preload through execArgv).
 *
 *   FROZEN   a release-bound miltank-vs-doduo match with one pool worker opens no live file under engine/
 *            or data/ except the release loader and the regulation selector (LIVE_OK below), and at least
 *            one process opened the release's own medicham2-browser.js.
 *   WORKER   a pool worker was traced, played playouts, and opened the release's engine, not the live one.
 *   STAMP    the artifact carries REL.stamp(): engine_release = the id, the full source digest set, the
 *            flags name the release, and the sheet pool is digested (sample.pool_sha256).
 *   GREEDY   the mag bot (MAG v1 alone) and the doduo bot each matched options, with no warning.
 *   SEES     CONTROL — the same match with no --release DOES open the live engine, in the parent and in
 *            the worker. Without this the FROZEN clause could pass because the tracer saw nothing.
 *
 * RED, unless --no-red: ARENA_BREAK=live (the release stamped, the live API played) must fail FROZEN.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const NO_RED = process.argv.includes('--no-red');
const ROOT = path.join(__dirname, '..', '..');
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
require('../arena/env.js');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };

const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
let ID = process.env.ARENA_TEST_RELEASE || null;
if (!ID) { try { ID = JSON.parse(fs.readFileSync(ER.POINTER.replace(/engine-release\.json$/, 'engine-release-regmc.json'), 'utf8')).current; } catch (e) {} }
if (!ID) { try { ID = ER.currentId(); } catch (e) {} }
if (!ID) { console.log('test-arena-release: CANNOT ANSWER — no Reg M-C release to play (set ARENA_TEST_RELEASE)'); process.exit(3); }

/* The only live engine/ files a release-bound run may open: the loader, and the selector that must run
 * before it to say which regulation's table the release serves. Everything else is the snapshot's. */
const LIVE_OK = new Set(['engine/engine_release.js', 'engine/regulation.js',
  'data/regulations.json']);   // the selector's own table of regulations: read to choose, before the release opens
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-release-'));
const PRELOAD = path.join(TMP, 'trace.js');
fs.writeFileSync(PRELOAD, `'use strict';
const fs = require('fs'), path = require('path');
const DIR = process.env.ARENA_TRACE_DIR, seen = new Set();
const note = p => { try { if (typeof p === 'string' || p instanceof URL) seen.add(path.resolve(String(p))); } catch (e) {} };
for (const k of ['readFileSync', 'openSync', 'readFile', 'open', 'createReadStream']) {
  const f = fs[k]; fs[k] = function (p, ...a) { note(p); return f.call(this, p, ...a); };
}
/* a pool worker is KILLED by pool.close(), so no exit handler runs there: the trace is also written after
 * every message the process handles and on a short timer, so a killed worker's last write is still whole */
const dump = () => { for (const k of Object.keys(require.cache)) seen.add(k);
  const f = path.join(DIR, process.pid + '.json'), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ pid: process.pid, worker: !!process.send, files: [...seen] })); fs.renameSync(tmp, f); };
process.on('exit', dump);
if (process.send) { process.on('message', () => setImmediate(dump)); setInterval(dump, 250).unref(); }
`);

function play(tag, args, env) {
  const dir = path.join(TMP, tag); fs.mkdirSync(dir);
  const out = path.join(TMP, tag + '.json');
  const e = Object.assign({}, process.env, { ARENA_TRACE_DIR: dir }, env || {});
  if (!env || !('SOLVER_RELEASE' in env)) delete e.SOLVER_RELEASE;
  const res = cp.spawnSync(process.execPath, ['-r', PRELOAD, path.join(ROOT, 'solver', 'arena', 'arena.js'), ...args, '--out', out],
    { env: e, encoding: 'utf8', maxBuffer: 64 << 20 });
  let art = null; try { art = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (err) {}
  const traces = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  return { status: res.status, stderr: (res.stderr || '').slice(-2000), art, traces };
}
const liveEngine = t => t.files.map(rel).filter(f => /^(engine|data)\//.test(f) && !f.startsWith('data/releases/') && !LIVE_OK.has(f)
  && !/^data\/engine-release(-\w+)?\.json$/.test(f));
const opened = (t, f) => t.files.map(rel).includes(f);
const RELENG = 'data/releases/' + ID + '/engine/medicham2-browser.js';

const MATCH = ['--x', 'miltank', '--y', 'doduo', '--games', '2', '--seed', '3', '--budget', '150', '--depth', '1', '--k1', '3', '--k2', '3',
  '--cap', '3', '--workers', '1'];

const A = play('frozen', MATCH.concat(['--release', ID]));
{
  ok('FROZEN', A.status === 0 && A.art, 'the release-bound match did not finish: exit ' + A.status + ' ' + A.stderr);
  ok('FROZEN', A.traces.length >= 2, 'expected the parent and a worker to be traced, got ' + A.traces.length);
  for (const t of A.traces) { const bad = liveEngine(t); ok('FROZEN', bad.length === 0, (t.worker ? 'worker' : 'parent') + ' ' + t.pid + ' opened live ' + bad.slice(0, 8).join(', ')); }
  ok('FROZEN', A.traces.some(t => opened(t, RELENG)), 'no process opened the release engine ' + RELENG);
  const W = A.traces.filter(t => t.worker);
  ok('WORKER', W.length >= 1 && W.every(t => opened(t, RELENG) && !opened(t, 'engine/medicham2-browser.js')), 'a pool worker did not play the release engine');
  ok('WORKER', A.art && A.art.counters.rollout_workers && A.art.counters.rollout_workers.playouts > 0, 'the pool worker played no playouts');
  const s = A.art || {};
  ok('STAMP', s.engine_release === ID && s.flags && s.flags.release === ID, 'engine_release ' + s.engine_release + ' flags.release ' + (s.flags && s.flags.release));
  ok('STAMP', s.source_digests && s.source_digests['engine/medicham2-browser.js'] && Object.keys(s.source_digests).length >= 20, 'source digests missing');
  ok('STAMP', s.sample && /^[0-9a-f]{16}$/.test(s.sample.pool_sha256 || ''), 'sheet pool not digested');
  ok('STAMP', /^frozen engine release /.test(s.status || ''), 'status ' + s.status);
  ok('GREEDY', s.counters && s.counters.greedy_y && s.counters.greedy_y.optionsMatched > 0, 'doduo matched no option');
}
const G = play('greedy', ['--x', 'mag', '--y', 'prior', '--games', '2', '--seed', '3', '--cap', '4', '--release', ID]);
ok('GREEDY', G.status === 0 && G.art && G.art.counters.greedy_x.optionsMatched > 0 && !G.art.warnings.length,
  'mag vs prior: exit ' + G.status + ' ' + (G.art ? JSON.stringify(G.art.warnings) : G.stderr));
for (const t of G.traces) ok('FROZEN', liveEngine(t).length === 0, 'mag run opened live ' + liveEngine(t).slice(0, 8).join(', '));

if (!process.env.ARENA_BREAK) {
  const C = play('live', MATCH);
  ok('SEES', C.status === 0 && C.art && C.art.engine_release === null, 'the live control did not finish: exit ' + C.status + ' ' + C.stderr);
  ok('SEES', C.traces.some(t => !t.worker && opened(t, 'engine/medicham2-browser.js')), 'the tracer did not see the parent open the live engine');
  ok('SEES', C.traces.some(t => t.worker && opened(t, 'engine/medicham2-browser.js')), 'the tracer did not see a worker open the live engine');
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
console.log('test-arena-release: ' + (checks - fails) + '/' + checks + ' checks  release ' + ID
  + (process.env.ARENA_BREAK ? '  [BREAK ' + process.env.ARENA_BREAK + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));
if (!NO_RED && !process.env.ARENA_BREAK) {
  const res = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env: Object.assign({}, process.env, { ARENA_BREAK: 'live', ARENA_TEST_RELEASE: ID }), encoding: 'utf8' });
  const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-arena-release:')) || '';
  const seen = /failed clauses: .*\bFROZEN\b/.test(line) && res.status === 1;
  console.log('  RED ARENA_BREAK=live -> FROZEN: ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)'));
  if (!seen) process.exit(3);
}
process.exit(fails ? 1 : 0);
