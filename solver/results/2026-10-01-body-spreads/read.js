/* solver/results/2026-10-01-body-spreads/read.js — apply the body-fix screen's PRE-REGISTERED rule ONCE to its finished gate result.
 *
 *   node solver/results/2026-10-01-body-spreads/read.js --result <gate result.json> --out <read.json>
 *
 * Rule, bars and floor are read from preregistration.json (committed before the first game). VOID if any bar fails, else
 * PASS or FAIL by gate.js's notlose rule (Wilson 95% upper bound of X's score >= 0.5). Same per-arm bars as
 * solver/results/2026-10-01-screens/read.js, plus this screen's capability: Y's `_sp` strip ran (ctr.pre169) and the true
 * battles' megas recomputed from `_sp` (ctr.form_stats.mega_from_spread), summed over the last line of every shard.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PRF = path.join(__dirname, 'preregistration.json');
const PR = JSON.parse(fs.readFileSync(PRF, 'utf8'));
const resF = flag('--result'), outF = flag('--out');
const R = JSON.parse(fs.readFileSync(resF, 'utf8'));
const dir = resF.replace(/\.json$/, '') + '.shards';
const last = fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f => { const L = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n'); return JSON.parse(L[L.length - 1]).ctr; });
const sum = objs => { const o = {}; for (const x of objs) for (const [k, v] of Object.entries(x || {})) o[k] = (o[k] || 0) + (+v || 0); return o; };
const pre = sum(last.map(c => c.pre169)), form = sum(last.map(c => c.form_stats));

const B = PR.bars, AX = R.arms[R.x.name], AY = R.arms[R.y.name];
const bars = [];
const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
bar('games scored', R.result.played >= B.min_scored, R.result.played, '>= ' + B.min_scored);
for (const [arm, A] of [['x', AX], ['y', AY]]) {
  bar(`${arm} prior-fallback share`, A && A.derived.fallback_share != null && A.derived.fallback_share <= B.max_fallback_share, A && A.derived.fallback_share, '<= ' + B.max_fallback_share);
  bar(`${arm} playouts per searched decision`, A && A.derived.playouts_per_searched >= B.playouts_floor, A && A.derived.playouts_per_searched, '>= ' + B.playouts_floor);
}
const ratio = R.decision_ms.x.mean / R.decision_ms.y.mean;
bar('clock ratio x/y', ratio <= B.max_clock_ratio, +ratio.toFixed(4), '<= ' + B.max_clock_ratio);
bar('y stripped _sp (views, worlds, bodies > 0)', pre.views > 0 && pre.worlds > 0 && pre.bodies > 0, pre, 'each > 0');
bar('true-battle megas recomputed from _sp', form.mega_from_spread > 0, form, 'mega_from_spread > 0');
const capOk = bars.every(b => b.pass);
const ci = R.result.ci95_x;
const verdict = !capOk ? 'VOID' : (ci[1] >= 0.5 ? 'PASS' : 'FAIL');
const read = { result: resF, read_at: new Date().toISOString(), preregistration_sha: crypto.createHash('sha256').update(fs.readFileSync(PRF)).digest('hex').slice(0, 16),
  engine_release: R.engine_release, flags: R.flags, x: R.x.name, y: R.y.name, score: R.result, paired: R.paired, rule: 'notlose: Wilson 95% upper bound of X score >= 0.5',
  clock_ratio: +ratio.toFixed(4), decision_ms: R.decision_ms, bars, capability_ok: capOk, verdict, pre169: pre, form_stats: form,
  arms: { x: AX, y: AY }, warnings: R.warnings, wall_s: R.wall_s };
fs.writeFileSync(outF, JSON.stringify(read, null, 1) + '\n');
console.log(JSON.stringify({ verdict, score: R.result.score_x, ci95: ci, games: R.result.played, clock_ratio: read.clock_ratio, bars: bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
