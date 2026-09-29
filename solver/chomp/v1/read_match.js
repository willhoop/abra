/* solver/chomp/v1/read_match.js — read a finished fixed-n preview match (solver/mew/play.js --mode match shards) ONCE.
 *
 *   node solver/chomp/v1/read_match.js --out <result.json> <shard.jsonl> [<shard.jsonl> ...]
 *
 * Score of X (W + D/2)/n with a Wilson 95% interval; the pair view (both / split / lost); the per-pair mean with a
 * normal 95% interval over pairs; every preview arm's picks and fallbacks read off the match lines (a CHOMP fallback is
 * counted, never silent); how often X's option differs from Y's arm on the same sheet; the honest-information counters
 * and search fallbacks from the last line of each shard.
 */
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const out = oi >= 0 ? argv[oi + 1] : null;
const files = argv.filter((a, i) => a !== '--out' && (oi < 0 || i !== oi + 1));
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 1]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; };
const per = [], last = [];
for (const f of files) {
  const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  per.push(...L); if (L.length) last.push(L[L.length - 1]);
}
const games = per.filter(p => !p.unbuildable);
const scored = games.filter(p => p.vX != null);
const W = scored.filter(p => p.vX === 1).length, L = scored.filter(p => p.vX === 0).length, D = scored.length - W - L;
const n = scored.length, sc = n ? (W + D / 2) / n : null;
const byPair = new Map(); for (const p of scored) { const a = byPair.get(p.pi) || []; a.push(p.vX); byPair.set(p.pi, a); }
const ps = [...byPair.values()].filter(a => a.length === 2).map(a => (a[0] + a[1]) / 2);
const pm = ps.reduce((s, v) => s + v, 0) / (ps.length || 1), pv = ps.reduce((s, v) => s + (v - pm) * (v - pm), 0) / Math.max(1, ps.length - 1);
const pairs = { both: ps.filter(v => v === 1).length, split: ps.filter(v => v === 0.5).length, lost: ps.filter(v => v === 0).length, n: ps.length,
  mean: pm, ci95: [pm - 1.96 * Math.sqrt(pv / Math.max(1, ps.length)), pm + 1.96 * Math.sqrt(pv / Math.max(1, ps.length))] };
const arms = {};
let differ = 0, withPv = 0;
for (const p of games) {
  if (!p.preview) continue;
  withPv++;
  for (const k of ['x', 'y']) { const v = p.preview[k]; const a = arms[v.arm + ':' + k] || (arms[v.arm + ':' + k] = { picks: 0, fallbacks: 0, support: [], p: [] });
    a.picks++; if (v.fallback) a.fallbacks++; if (v.support != null) a.support.push(v.support); if (v.p != null) a.p.push(v.p); }
}
for (const a of Object.values(arms)) { a.support_mean = a.support.length ? a.support.reduce((s, v) => s + v, 0) / a.support.length : null; a.p_mean = a.p.length ? a.p.reduce((s, v) => s + v, 0) / a.p.length : null; delete a.support; delete a.p; }
const res = {
  files, games: games.length, scored: n, errors: games.filter(p => p.err).length, capped: games.filter(p => p.capped).length, unbuildable: per.filter(p => p.unbuildable).length,
  W, D, L, score_x: sc, ci95_x: wilson(W + D / 2, n), pairs, preview: { games_with_preview: withPv, arms },
  search: last.map(l => l.ctr ? { fallbacks: l.ctr.fallbacks, decisions: l.ctr.decisions, honest: l.ctr.honest, hon_views: l.ctr.hon_views, hon_back_xatu: l.ctr.hon_back_xatu, hon_back_error: l.ctr.hon_back_error, zero_playouts: l.ctr.zero_playouts, fallback_decisions: l.ctr.fallback_decisions } : null),
};
if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ n, W, L, D, score_x: sc && +sc.toFixed(4), ci95_x: res.ci95_x.map(v => +v.toFixed(4)), pairs: { both: pairs.both, split: pairs.split, lost: pairs.lost }, errors: res.errors, capped: res.capped, arms }, null, 1));
