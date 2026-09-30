/* solver/tests/test-porygon2-v2-arena.js — the v2 leaf RUNS IN THE ARENA, per arm, and says so on every shard line.
 *
 *   node solver/tests/test-porygon2-v2-arena.js [--release eaa5becc54eb] [--no-red]      exit 0 GREEN, 1 RED
 *
 * Why this exists (2026-09-30, SPRT 2: gen5 with PORYGON2 v2 as its leaf against gen5 as is). rollout COUNTERS.leafPory2
 * sums EVERY arm in a worker, so in an arena where both arms use a PORYGON2 leaf it cannot prove that the v2 arm's leaf was
 * v2. solver/miltank/rollout.js now counts leaf calls by model file (leafByModel) and returns each loaded leaf's OWN
 * counters (leafOwn: the v2 leaf's { evals, errors }), and solver/mew/play.js writes both on every shard line
 * (ctr.leaf_by_model, ctr.leaf_own). This test plays ONE seat-swapped pair, capped at 3 turns, with the two SPRT 2 arms at a
 * 300 ms budget, and asserts from the LAST shard line:
 *   - the v2 file served evaluations (leaf_by_model and the v2 leaf's own evals > 0, the two equal, 0 errors);
 *   - gen5's own net served evaluations too (the Y arm is not silently on v2 or on the heuristic).
 * RED unless --no-red: MILTANK_BREAK=leaf (every leaf call goes to the heuristic) must turn it RED.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = arg('--release', 'eaa5becc54eb');
const STORE = arg('--team-store', 'C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc');
const OUT = path.join(ROOT, 'solver', 'out', 'test-porygon2-v2-arena');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL ' + msg); } };

const V2 = 'porygon2-v2-k1.json', G5 = 'porygon2-gen5.json';
const spec = (src, name) => { const s = JSON.parse(fs.readFileSync(path.join(ROOT, src), 'utf8')); s.name = name; s.budgetMs = 300; const f = path.join(OUT, name + '.json'); fs.writeFileSync(f, JSON.stringify(s)); return f; };
const X = spec('solver/porygon2/v2/gen5-p2v2.json', 'test-gen5-p2v2'), Y = spec('solver/machamp/league/gen5.json', 'test-gen5');
const shard = path.join(OUT, 'shard-0.jsonl');
try { fs.unlinkSync(shard); } catch (e) {}
const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'solver', 'mew', 'play.js'), '--mode', 'match', '--release', REL, '--x', X, '--y', Y, '--pairs', '1', '--pair-seed', '1',
  '--seed', '777', '--shard', '0', '--shards', '1', '--cap', '3', '--out', shard, '--info', 'honest', '--team-store', STORE], { encoding: 'utf8', cwd: ROOT, maxBuffer: 64 << 20 });
ok(r.status === 0, 'play.js exited ' + r.status + ' ' + (r.stderr || '').slice(-400));
let last = null;
try { last = fs.readFileSync(shard, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(l => l.ctr).pop(); } catch (e) {}
ok(!!last, 'no shard line written');
const ctr = (last && last.ctr) || {};
const by = ctr.leaf_by_model || {}, own = ctr.leaf_own || {};
ok((by[V2] || 0) > 0, `the v2 file served ${by[V2] || 0} leaf calls (leaf_by_model)`);
ok(own[V2] && own[V2].evals > 0, `the v2 leaf's own counter reads ${own[V2] ? own[V2].evals : 'absent'} evals`);
ok(own[V2] && own[V2].evals === by[V2], `v2 own evals ${own[V2] && own[V2].evals} != calls ${by[V2]}`);
ok(own[V2] && own[V2].errors === 0, `v2 leaf errors ${own[V2] && own[V2].errors}`);
ok((by[G5] || 0) > 0, `gen5's own net served ${by[G5] || 0} leaf calls`);
console.log(JSON.stringify({ leaf_by_model: by, leaf_own: own, fallbacks: ctr.fallbacks, searched: ctr.searched, games: last ? 'pair 0' : null, break: process.env.MILTANK_BREAK || null }));

if (!argv.includes('--no-red')) {
  const b = cp.spawnSync(process.execPath, [__filename, '--no-red', '--release', REL, '--team-store', STORE], { env: Object.assign({}, process.env, { MILTANK_BREAK: 'leaf' }), encoding: 'utf8', cwd: ROOT, maxBuffer: 64 << 20 });
  ok(b.status === 1, 'MILTANK_BREAK=leaf did not turn the test RED (exit ' + b.status + ')');
  console.log('  deliberate break MILTANK_BREAK=leaf: ' + (b.status === 1 ? 'RED (as it must be)' : 'NOT RED') + '\n' + (b.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}
console.log(`test-porygon2-v2-arena: ${checks - fails}/${checks} ${fails ? 'RED' : 'GREEN'}`);
process.exit(fails ? 1 : 0);
