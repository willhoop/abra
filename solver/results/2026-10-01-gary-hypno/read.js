/* solver/results/2026-10-01-gary-hypno/read.js — apply the HYPNO screen's PRE-REGISTERED rule ONCE to its finished gate result.
 *
 *   node solver/results/2026-10-01-gary-hypno/read.js --result <gate result.json> --out <read.json>
 *
 * Rule, bars and floor are read from screen-preregistration.json (committed before the first game). VOID if any bar fails,
 * else PASS or FAIL by gate.js's notlose rule (Wilson 95% upper bound of X's score >= 0.5). The per-arm bars are the
 * 1.67.0 / 1.69.0 screens'; the capability is this screen's: X's HYPNO RAN and PLAYED — summed over the last line of every
 * shard, ctr.hypno[X].decisions > 0 and ctr.hypno[X].played > 0 — and Y never ran it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PRF = path.join(__dirname, 'screen-preregistration.json');
const PR = JSON.parse(fs.readFileSync(PRF, 'utf8'));
const resF = flag('--result'), outF = flag('--out');
const R = JSON.parse(fs.readFileSync(resF, 'utf8'));
const dir = resF.replace(/\.json$/, '') + '.shards';
const last = fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f => { const L = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n'); return JSON.parse(L[L.length - 1]).ctr; });
const hy = name => {
  const o = { decisions: 0, played: 0, untrusted: 0, coverage: 0, belowSE: 0, noGain: 0, changed: 0, tvSum: 0, worstSum: 0, worstMax: 0, gainSum: 0, cells: {}, trustedCells: {} };
  for (const c of last) {
    const h = c && c.hypno && c.hypno[name]; if (!h) continue;
    for (const k of ['decisions', 'played', 'untrusted', 'coverage', 'belowSE', 'noGain', 'changed', 'tvSum', 'worstSum', 'gainSum']) o[k] += +h[k] || 0;
    o.worstMax = Math.max(o.worstMax, +h.worstMax || 0);
    for (const k of ['cells', 'trustedCells']) for (const [a, b] of Object.entries(h[k] || {})) o[k][a] = (o[k][a] || 0) + b;
  }
  return o;
};
const HX = hy(R.x.name), HY = hy(R.y.name);

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
bar('x HYPNO ran (decisions > 0)', HX.decisions > 0, HX.decisions, '> 0');
bar('x HYPNO played (played > 0)', HX.played > 0, HX.played, '> 0');
bar('y never ran HYPNO', HY.decisions === 0, HY.decisions, '= 0');
const capOk = bars.every(b => b.pass);
const ci = R.result.ci95_x;
const verdict = !capOk ? 'VOID' : (ci[1] >= 0.5 ? 'PASS' : 'FAIL');
const read = { result: resF, read_at: new Date().toISOString(), preregistration_sha: crypto.createHash('sha256').update(fs.readFileSync(PRF)).digest('hex').slice(0, 16),
  engine_release: R.engine_release, flags: R.flags, x: R.x.name, y: R.y.name, score: R.result, paired: R.paired, rule: 'notlose: Wilson 95% upper bound of X score >= 0.5',
  clock_ratio: +ratio.toFixed(4), decision_ms: R.decision_ms, bars, capability_ok: capOk, verdict, hypno_x: HX,
  hypno_x_rates: HX.decisions ? { played: +(HX.played / HX.decisions).toFixed(4), untrusted: +(HX.untrusted / HX.decisions).toFixed(4), belowSE: +(HX.belowSE / HX.decisions).toFixed(4), worst_mean_when_played: HX.played ? +(HX.worstSum / HX.played).toFixed(5) : null } : null,
  arms: { x: AX, y: AY }, warnings: R.warnings, wall_s: R.wall_s };
fs.writeFileSync(outF, JSON.stringify(read, null, 1) + '\n');
console.log(JSON.stringify({ verdict, score: R.result.score_x, ci95: ci, games: R.result.played, clock_ratio: read.clock_ratio, hypno_x: read.hypno_x_rates, bars: bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
