/* solver/results/2026-10-02-pool-screen/read.js — apply the pooled-search screen's PRE-REGISTERED rule ONCE to its finished
 * gate result (preregistration.json, written and committed before the first game; nothing here is tuned after one).
 *
 *   node solver/results/2026-10-02-pool-screen/read.js --result <gate result.json> --out <read.json>
 *
 * VOID if ANY capability bar fails, else PASS or FAIL by gate.js's notlose rule (the Wilson 95% UPPER bound of X's score
 * >= 0.5). Bars, per arm from gate.js `arms` (solver/mew/play.js ARMS) and X's pool counters (ctr.pool on the LAST line of
 * every shard, solver/mew/agent.js COUNTERS.pool):
 *   prior-fallback share <= max_fallback_share (both arms); playouts per searched decision >= the floor (both arms);
 *   clock ratio decision_ms.x.mean / decision_ms.y.mean <= max_clock_ratio; games scored >= min_scored;
 *   POOL RAN: X's pooled decisions >= 0.95 x X's searched decisions, X's idle-worker share (idle workers / (pooled
 *   decisions x pool size)) <= max_idle_share, every one of X's pool workers delivered playouts, agent fallbacks (a thrown
 *   search, including a dead pool) == 0; Y never pooled.
 *   REPORTED, not a bar: X's playouts per searched decision over Y's (the expected direction, stated in the file: above 1).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PR = JSON.parse(fs.readFileSync(path.join(__dirname, 'preregistration.json'), 'utf8'));
const resF = flag('--result'), outF = flag('--out');
const R = JSON.parse(fs.readFileSync(resF, 'utf8'));
const dir = resF.replace(/\.json$/, '') + '.shards';
const last = fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f => { const L = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n'); return JSON.parse(L[L.length - 1]).ctr; });
const xName = R.x.name, yName = R.y.name, AX = R.arms[xName], AY = R.arms[yName];
const N = PR.pool_size;
const poolX = { decisions: 0, playouts: 0, idle_workers: 0, late: 0, playouts_by_worker: new Array(N).fill(0) };
let poolY = 0;
for (const c of last) {
  const p = c.pool || {};
  if (p[xName]) { const q = p[xName]; poolX.decisions += q.decisions; poolX.playouts += q.playouts; poolX.idle_workers += q.idle_workers; poolX.late += q.late; q.playouts_by_worker.forEach((v, k) => { poolX.playouts_by_worker[k] += v; }); }
  if (p[yName]) poolY += p[yName].decisions;
}
const bars = [];
const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
const B = PR.bars;
bar('games scored', R.result.played >= B.min_scored, R.result.played, '>= ' + B.min_scored);
for (const [arm, A] of [['x', AX], ['y', AY]]) {
  bar(`${arm} prior-fallback share`, A && A.derived.fallback_share != null && A.derived.fallback_share <= B.max_fallback_share, A && A.derived.fallback_share, '<= ' + B.max_fallback_share);
  bar(`${arm} playouts per searched decision`, A && A.derived.playouts_per_searched >= PR.playouts_floor, A && A.derived.playouts_per_searched, '>= ' + PR.playouts_floor);
}
const ratio = R.decision_ms.x.mean / R.decision_ms.y.mean;
bar('clock ratio x/y', ratio <= B.max_clock_ratio, +ratio.toFixed(4), '<= ' + B.max_clock_ratio);
const searchedX = AX ? AX.searched : 0;
bar('x pooled decisions >= 0.95 x searched', poolX.decisions >= 0.95 * searchedX && poolX.decisions > 0, { pooled: poolX.decisions, searched: searchedX }, '>= 0.95');
const idleShare = poolX.decisions ? poolX.idle_workers / (poolX.decisions * N) : 1;
bar('x idle-worker share', idleShare <= B.max_idle_share, +idleShare.toFixed(4), '<= ' + B.max_idle_share);
bar('every x pool worker delivered playouts', poolX.playouts_by_worker.length === N && poolX.playouts_by_worker.every(v => v > 0), poolX.playouts_by_worker, 'all > 0');
bar('agent fallbacks (thrown search, dead pool)', R.fallbacks === 0, R.fallbacks, '== 0');
bar('y never pooled', poolY === 0, poolY, '== 0');
const capOk = bars.every(b => b.pass);
const ci = R.result.ci95_x;
const verdict = !capOk ? 'VOID' : (ci[1] >= 0.5 ? 'PASS' : 'FAIL');
const read = { screen: 'pooled vs in-process', result: resF, read_at: new Date().toISOString(),
  preregistration_sha: require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'preregistration.json'))).digest('hex').slice(0, 16),
  engine_release: R.engine_release, flags: R.flags, x: xName, y: yName, score: R.result, paired: R.paired, rule: 'notlose: Wilson 95% upper bound of X score >= 0.5',
  clock_ratio: +ratio.toFixed(4), decision_ms: R.decision_ms, bars, capability_ok: capOk, verdict,
  reported: { playouts_ratio_x_over_y: AX && AY ? +(AX.derived.playouts_per_searched / AY.derived.playouts_per_searched).toFixed(3) : null, pool_x: poolX },
  arms: { x: AX, y: AY }, warnings: R.warnings, wall_s: R.wall_s };
fs.writeFileSync(outF, JSON.stringify(read, null, 1) + '\n');
console.log(JSON.stringify({ verdict, score: R.result.score_x, ci95: ci, games: R.result.played, clock_ratio: read.clock_ratio, playouts_ratio: read.reported.playouts_ratio_x_over_y,
  bars: bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
