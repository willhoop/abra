/* solver/results/2026-10-01-screens/read.js — apply a screen's PRE-REGISTERED rule ONCE to its finished gate result.
 *
 *   node solver/results/2026-10-01-screens/read.js --screen student|cols8 --result <gate result.json> --out <read.json>
 *
 * The rule, the bars and the floors are read from preregistration.json (written and committed before the first game);
 * nothing here is tuned after a game. The verdict is VOID if ANY capability bar fails, else PASS or FAIL by gate.js's
 * notlose rule (the Wilson 95% UPPER bound of X's score >= 0.5). Per arm, from gate.js `arms` (solver/mew/play.js ARMS):
 *   prior-fallback share = fallback decisions (MILTANK's empty/sparse table, the adaptive clock's low bank, a thrown search)
 *                          / non-forced decisions                                  bar: <= max_fallback_share
 *   playouts per searched decision                                                 bar: >= the screen's floor
 *   clock ratio = decision_ms.x.mean / decision_ms.y.mean                          bar: <= max_clock_ratio
 *   games scored                                                                   bar: >= min_scored
 * Screen-specific capability: student — X's leaf served the student file with 0 errors (ctr.leaf_by_model, ctr.leaf_own on
 * the last line of every shard), and Y's leaf served gen5's net; cols8 — X used more than 4 columns and Y never more than 4.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PR = JSON.parse(fs.readFileSync(path.join(__dirname, 'preregistration.json'), 'utf8'));
const screen = flag('--screen'), resF = flag('--result'), outF = flag('--out');
const S = PR.screens[screen];
if (!S) throw new Error('unknown --screen ' + screen);
const R = JSON.parse(fs.readFileSync(resF, 'utf8'));
const dir = resF.replace(/\.json$/, '') + '.shards';
const last = fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f => { const L = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n'); return JSON.parse(L[L.length - 1]).ctr; });
const sumObj = objs => { const o = {}; for (const x of objs) for (const [k, v] of Object.entries(x || {})) { if (v && typeof v === 'object') { o[k] = o[k] || {}; for (const [k2, v2] of Object.entries(v)) o[k][k2] = (o[k][k2] || 0) + v2; } else o[k] = (o[k] || 0) + v; } return o; };
const leafByModel = sumObj(last.map(c => c.leaf_by_model)), leafOwn = sumObj(last.map(c => c.leaf_own));

const xName = R.x.name, yName = R.y.name, AX = R.arms[xName], AY = R.arms[yName];
const bars = [];
const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
const B = PR.bars;
bar('games scored', R.result.played >= B.min_scored, R.result.played, '>= ' + B.min_scored);
for (const [arm, A] of [['x', AX], ['y', AY]]) {
  bar(`${arm} prior-fallback share`, A && A.derived.fallback_share != null && A.derived.fallback_share <= B.max_fallback_share, A && A.derived.fallback_share, '<= ' + B.max_fallback_share);
  bar(`${arm} playouts per searched decision`, A && A.derived.playouts_per_searched >= S.playouts_floor, A && A.derived.playouts_per_searched, '>= ' + S.playouts_floor);
}
const ratio = R.decision_ms.x.mean / R.decision_ms.y.mean;
bar('clock ratio x/y', ratio <= B.max_clock_ratio, +ratio.toFixed(4), '<= ' + B.max_clock_ratio);
if (screen === 'student') {
  const sk = S.x_leaf_file, gk = S.y_leaf_file;
  bar('x leaf served the student', (leafByModel[sk] || 0) > 0 && leafOwn[sk] && leafOwn[sk].errors === 0, { calls: leafByModel[sk] || 0, own: leafOwn[sk] || null }, '> 0 calls, 0 errors');
  bar('y leaf served gen5', (leafByModel[gk] || 0) > 0, { calls: leafByModel[gk] || 0 }, '> 0 calls');
} else {
  const mx = h => Math.max(...Object.keys(h || {}).map(Number));
  bar('x used more than 4 columns', AX && mx(AX.cols_hist) > 4 && mx(AX.cols_hist) <= 8, AX && AX.cols_hist, 'max in (4, 8]');
  bar('y never more than 4 columns', AY && mx(AY.cols_hist) <= 4, AY && AY.cols_hist, 'max <= 4');
}
const capOk = bars.every(b => b.pass);
const ci = R.result.ci95_x;
const notlose = ci[1] >= 0.5;
const verdict = !capOk ? 'VOID' : (notlose ? 'PASS' : 'FAIL');
const read = { screen, result: resF, read_at: new Date().toISOString(), preregistration_sha: require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'preregistration.json'))).digest('hex').slice(0, 16),
  engine_release: R.engine_release, flags: R.flags, x: xName, y: yName, score: R.result, paired: R.paired, rule: 'notlose: Wilson 95% upper bound of X score >= 0.5',
  clock_ratio: +ratio.toFixed(4), decision_ms: R.decision_ms, bars, capability_ok: capOk, verdict,
  arms: { x: AX, y: AY }, leaf_by_model: leafByModel, leaf_own: leafOwn, warnings: R.warnings, wall_s: R.wall_s };
fs.writeFileSync(outF, JSON.stringify(read, null, 1) + '\n');
console.log(JSON.stringify({ verdict, score: R.result.score_x, ci95: ci, games: R.result.played, clock_ratio: read.clock_ratio, bars: bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
