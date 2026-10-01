/* solver/results/2026-10-01-student-sprt/read.js — apply the student SPRT's PRE-REGISTERED bars ONCE to its finished
 * sprt.js result.
 *
 *   node solver/results/2026-10-01-student-sprt/read.js --result <sprt result.json> --guard <guard.log> --out <read.json>
 *
 * The bars are read from preregistration.json (committed before the first game); nothing here is tuned after a game.
 * The verdict is sprt.js's (H1 / H0 / INCONCLUSIVE), unless ANY bar fails, in which case it is VOID.
 *
 * sprt.js (unlike gate.js) does not sum the per-arm counters, so they are summed here from ctr.arms on the LAST COUNTED
 * line of each shard: a shard plays its pairs in index order and its counters are cumulative, so that line holds the
 * shard's counts through the stopping pair. Decision ms are pooled over the counted lines (ms_x, ms_y), as gate.js does.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PRF = path.join(__dirname, 'preregistration.json');
const PR = JSON.parse(fs.readFileSync(PRF, 'utf8'));
const resF = flag('--result'), guardF = flag('--guard'), outF = flag('--out');
if (!resF || !outF) throw new Error('usage: --result <sprt.json> --guard <guard.log> --out <read.json>');
const R = JSON.parse(fs.readFileSync(resF, 'utf8'));
const B = PR.bars;
const cut = R.stop_pair_index != null ? R.stop_pair_index : Math.floor(R.flags.maxGames / 2) - 1;

/* the shard lines */
const dir = resF.replace(/\.json$/, '') + '.shards';
const shards = fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f =>
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean));
/* complete, error-free pairs at or before the stop: the same set sprt.js counted */
const byPair = new Map();
for (const L of shards) for (const p of L) { const a = byPair.get(p.pi) || []; a.push(p); byPair.set(p.pi, a); }
const countedPair = pi => { const a = byPair.get(pi); return a && a.length >= 2 && !a.some(g => g.vX == null); };
const counted = [].concat(...shards).filter(p => p.pi <= cut && countedPair(p.pi));
const lastCounted = shards.map(L => { let last = null; for (const p of L) if (p.pi <= cut && p.ctr) last = p; return last; }).filter(Boolean);

const addInto = (dst, src) => { for (const [k, v] of Object.entries(src || {})) { if (v && typeof v === 'object') addInto(dst[k] || (dst[k] = {}), v); else dst[k] = (dst[k] || 0) + v; } };
const arms = {};
for (const p of lastCounted) for (const [name, a] of Object.entries(p.ctr.arms || {})) addInto(arms[name] || (arms[name] = {}), a);
for (const a of Object.values(arms)) {
  const nf = a.decisions - a.forced;
  a.derived = { non_forced: nf, playouts_per_searched: a.searched ? +(a.playouts / a.searched).toFixed(1) : null,
    fallback_share: nf ? +(a.fallback_decisions / nf).toFixed(4) : null, cols_mean: a.searched ? +(a.cols_sum / a.searched).toFixed(2) : null,
    playouts_per_cell: a.cells ? +(a.playouts / a.cells).toFixed(1) : null,
    coverage_target: a.cov && a.cov.n ? +(a.cov.target / a.cov.n).toFixed(4) : null };
}
const leafByModel = {}, leafOwn = {}, formStats = {};
for (const p of lastCounted) { addInto(leafByModel, p.ctr.leaf_by_model); addInto(leafOwn, p.ctr.leaf_own); addInto(formStats, p.ctr.form_stats); }
const ms = key => { const a = [].concat(...counted.map(p => p[key] || [])).sort((p, q) => p - q); return a.length ? { n: a.length, mean: +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(1), p50: a[a.length >> 1], p99: a[Math.floor(0.99 * (a.length - 1))], max: a[a.length - 1] } : null; };
const decision_ms = { x: ms('ms_x'), y: ms('ms_y') };

const xName = R.x.spec.name, yName = R.y.spec.name, AX = arms[xName], AY = arms[yName];
const bars = [];
const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
for (const [arm, A] of [['x', AX], ['y', AY]]) {
  bar(`${arm} prior-fallback share`, A && A.derived.fallback_share != null && A.derived.fallback_share <= B.max_fallback_share, A && A.derived.fallback_share, '<= ' + B.max_fallback_share);
  bar(`${arm} playouts per searched decision`, A && A.derived.playouts_per_searched >= B.playouts_floor, A && A.derived.playouts_per_searched, '>= ' + B.playouts_floor);
}
const ratio = decision_ms.x && decision_ms.y ? decision_ms.x.mean / decision_ms.y.mean : NaN;
bar('clock ratio x/y', ratio <= B.max_clock_ratio, +(+ratio).toFixed(4), '<= ' + B.max_clock_ratio);
const errShare = R.pairs_used ? R.excluded_errored_pairs / (R.pairs_used + R.excluded_errored_pairs) : 1;
bar('errored pairs share', errShare <= B.max_errored_pair_share, { errored: R.excluded_errored_pairs, used: R.pairs_used }, '<= ' + B.max_errored_pair_share);
const SK = 'porygon2-v3-student.json', GK = 'porygon2-gen5.json';
bar('x leaf served the student', (leafByModel[SK] || 0) > 0 && leafOwn[SK] && leafOwn[SK].errors === 0, { calls: leafByModel[SK] || 0, own: leafOwn[SK] || null }, '> 0 calls, 0 errors');
bar('y leaf served gen5', (leafByModel[GK] || 0) > 0, { calls: leafByModel[GK] || 0 }, '> 0 calls');
bar('spreads warnings empty', R.spreads && Array.isArray(R.spreads.warnings) && R.spreads.warnings.length === 0, R.spreads && R.spreads.warnings, '[]');
/* (7) not paused, not interrupted: the coordinator reached its own stop; a worker exit is 0, or null / a signal from
 * the coordinator's own kill at the bound; the guard saw no ladder process at any sample */
const stoppedOwn = R.stop_pair_index != null || R.pairs_used + R.excluded_errored_pairs >= Math.floor(R.flags.maxGames / 2);
const exitsOk = (R.worker_exits || []).every(c => c === 0 || c === null);
let guard = { file: guardF || null, samples: 0, ladder_seen: null, voided: false };
if (guardF && fs.existsSync(guardF)) {
  const G = fs.readFileSync(guardF, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  guard.samples = G.filter(g => g.kind === 'sample').length;
  guard.ladder_seen = G.filter(g => g.kind === 'sample' && g.ladder && g.ladder.length).length;
  guard.voided = G.some(g => g.kind === 'void');
}
bar('ran to its own stop, not paused', stoppedOwn && exitsOk && guard.samples > 0 && guard.ladder_seen === 0 && !guard.voided,
  { stopped_own: stoppedOwn, worker_exits: R.worker_exits, guard }, 'own stop, exits ok, guard sampled with 0 ladder sightings');

const capOk = bars.every(b => b.pass);
const verdict = capOk ? R.verdict : 'VOID (' + bars.filter(b => !b.pass).map(b => b.name).join('; ') + ')';
const read = { result: resF, read_at: new Date().toISOString(),
  preregistration_sha: require('crypto').createHash('sha256').update(fs.readFileSync(PRF)).digest('hex').slice(0, 16),
  engine_release: R.engine_release, flags: R.flags, x: xName, y: yName, sprt_verdict: R.verdict, verdict,
  llr_at_stop: R.llr_at_stop, bounds: R.bounds, stop_pair_index: R.stop_pair_index, pairs_used: R.pairs_used, games_used: R.games_used,
  score: R.result, elo_estimate: R.elo_estimate, games_played_total: R.games_played_total, games_after_stop_not_counted: R.games_played_after_stop_not_counted,
  clock_ratio: +(+ratio).toFixed(4), decision_ms, bars, capability_ok: capOk, arms: { x: AX, y: AY },
  leaf_by_model: leafByModel, leaf_own: leafOwn, form_stats: formStats, spreads: R.spreads, pool: R.pool, wall_s: R.wall_s };
fs.writeFileSync(outF, JSON.stringify(read, null, 1) + '\n');
console.log(JSON.stringify({ verdict, score: R.result.score_x, ci95: R.result.ci95_x, games: R.games_used, W: R.result.W, L: R.result.L, D: R.result.D,
  clock_ratio: read.clock_ratio, bars: bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
