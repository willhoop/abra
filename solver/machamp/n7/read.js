/* solver/machamp/n7/read.js — apply a generation's PRE-REGISTERED screen or SPRT rule ONCE, at its stop, with the capability
 * bars. The two readers of 2026-10-01 (solver/results/2026-10-01-screens/read.js, solver/results/2026-10-01-student-sprt/read.js)
 * made general: the bars, the floor and the arms come from the generation's pre-registration, never from this file.
 *
 *   node solver/machamp/n7/read.js --kind screen|sprt --result <gate.js | sprt.js result.json> --prereg <preregistration.json>
 *        --x-net <candidate net file> --y-net <champion net file> [--x-policy <net file>] [--guard <guard.jsonl>] --out <read.json>
 *   const R = require('./solver/machamp/n7/read.js').read({ ... the same ... })
 *
 * BARS (VOID, whatever the score or the LLR, if ANY fails; memory: a starved run is never read as a result):
 *   per arm, from the play.js ARMS counters (gate.js `arms`, or summed here from the LAST COUNTED line of each sprt.js shard)
 *     prior-fallback share <= max_fallback_share, playouts per searched decision >= playouts_floor
 *   clock ratio = mean decision ms X / Y <= max_clock_ratio
 *   screen: games scored >= min_scored.  sprt: errored pairs <= max_errored_pair_share of the pairs used
 *   capability: X's leaf served the candidate's net (leaf_by_model[file] > 0, leaf_own errors 0); Y's leaf served the
 *     champion's net; when X names a policy head, its counter (ctr.policy[x name].calls) > 0 and tilted > 0
 *   the spreads block has no warning and the lines played the registered mode
 *   the guard (solver/machamp/n7/loop.js) sampled the machine and saw no ladder process, and wrote no `void` line
 * VERDICT: screen PASS / FAIL by notlose (the Wilson 95% upper bound of X's score >= 0.5); sprt H1 / H0 / INCONCLUSIVE as
 * sprt.js stopped. `verdict_code` is the one word the promotion reads.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..', '..');
const shaFile = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const shaText = f => crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).digest('hex');   // line endings normalised (solver/machamp/n7/loop.js)
const base = f => String(f).split(/[\\/]/).pop();

function addInto(dst, src) { for (const [k, v] of Object.entries(src || {})) { if (v && typeof v === 'object') addInto(dst[k] || (dst[k] = {}), v); else if (typeof v === 'number') dst[k] = (dst[k] || 0) + v; } }
function derive(a) {
  const nf = a.decisions - a.forced;
  a.derived = { non_forced: nf, playouts_per_searched: a.searched ? +(a.playouts / a.searched).toFixed(1) : null,
    fallback_share: nf ? +(a.fallback_decisions / nf).toFixed(4) : null, cols_mean: a.searched ? +(a.cols_sum / a.searched).toFixed(2) : null };
  return a;
}
function readLines(dir) {
  return fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f =>
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean));
}
function guardOf(file) {
  const g = { file: file || null, samples: 0, ladder_seen: null, voided: false, beside_ladder: false };
  if (!file || !fs.existsSync(file)) return g;
  const L = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  g.samples = L.filter(x => x.kind === 'sample').length;
  g.ladder_seen = L.filter(x => x.kind === 'sample' && x.ladder && x.ladder.length).length;
  g.voided = L.some(x => x.kind === 'void');
  g.beside_ladder = L.some(x => x.kind === 'start' && x.beside_ladder);
  return g;
}

function read(o) {
  const PR = JSON.parse(fs.readFileSync(o.prereg, 'utf8'));
  const S = o.kind === 'screen' ? PR.screen : PR.sprt;
  if (!S) throw new Error('n7/read: the pre-registration has no ' + o.kind + ' block');
  const B = S.bars;
  const R = JSON.parse(fs.readFileSync(o.result, 'utf8'));
  const dir = o.result.replace(/\.json$/, '') + '.shards';
  const shards = readLines(dir);
  let cut = Infinity, counted;
  if (o.kind === 'sprt') {
    cut = R.stop_pair_index != null ? R.stop_pair_index : Math.floor(R.flags.maxGames / 2) - 1;
    const byPair = new Map();
    for (const L of shards) for (const p of L) { const a = byPair.get(p.pi) || []; a.push(p); byPair.set(p.pi, a); }
    const ok = pi => { const a = byPair.get(pi); return a && a.length >= 2 && !a.some(g => g.vX == null); };
    counted = [].concat(...shards).filter(p => p.pi <= cut && ok(p.pi));
  } else counted = [].concat(...shards);
  const lastLines = shards.map(L => { let last = null; for (const p of L) if (p.pi <= cut && p.ctr) last = p; return last; }).filter(Boolean);
  let arms = {};
  if (o.kind === 'screen' && R.arms) arms = R.arms;
  else { for (const p of lastLines) for (const [name, a] of Object.entries(p.ctr.arms || {})) addInto(arms[name] || (arms[name] = {}), a); for (const a of Object.values(arms)) derive(a); }
  const leafByModel = {}, leafOwn = {}, policy = {};
  for (const p of lastLines) { addInto(leafByModel, p.ctr.leaf_by_model); addInto(leafOwn, p.ctr.leaf_own); addInto(policy, p.ctr.policy); }
  const ms = key => { const a = [].concat(...counted.map(p => p[key] || [])).sort((p, q) => p - q); return a.length ? { n: a.length, mean: +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(1), p50: a[a.length >> 1], p99: a[Math.floor(0.99 * (a.length - 1))] } : null; };
  const decision_ms = o.kind === 'screen' && R.decision_ms ? R.decision_ms : { x: ms('ms_x'), y: ms('ms_y') };
  const xName = o.kind === 'screen' ? R.x.name : R.x.spec.name, yName = o.kind === 'screen' ? R.y.name : R.y.spec.name;
  const xSpec = o.kind === 'screen' ? R.x.spec : R.x.spec, AX = arms[xName], AY = arms[yName];
  const bars = [];
  const bar = (name, pass, value, limit) => bars.push({ name, pass: !!pass, value, limit });
  for (const [arm, A] of [['x', AX], ['y', AY]]) {
    bar(`${arm} prior-fallback share`, A && A.derived && A.derived.fallback_share != null && A.derived.fallback_share <= B.max_fallback_share, A && A.derived && A.derived.fallback_share, '<= ' + B.max_fallback_share);
    bar(`${arm} playouts per searched decision`, A && A.derived && A.derived.playouts_per_searched >= B.playouts_floor, A && A.derived && A.derived.playouts_per_searched, '>= ' + B.playouts_floor);
  }
  const ratio = decision_ms.x && decision_ms.y ? decision_ms.x.mean / decision_ms.y.mean : NaN;
  bar('clock ratio x/y', ratio <= B.max_clock_ratio, +(+ratio).toFixed(4), '<= ' + B.max_clock_ratio);
  if (o.kind === 'screen') bar('games scored', R.result.played >= B.min_scored, R.result.played, '>= ' + B.min_scored);
  else {
    const err = R.pairs_used ? R.excluded_errored_pairs / (R.pairs_used + R.excluded_errored_pairs) : 1;
    bar('errored pairs share', err <= B.max_errored_pair_share, { errored: R.excluded_errored_pairs, used: R.pairs_used }, '<= ' + B.max_errored_pair_share);
  }
  const XK = base(o.xNet), YK = base(o.yNet);
  bar('x leaf served the candidate net', (leafByModel[XK] || 0) > 0 && leafOwn[XK] && leafOwn[XK].errors === 0, { file: XK, calls: leafByModel[XK] || 0, own: leafOwn[XK] || null }, '> 0 calls, 0 errors');
  bar('y leaf served the champion net', (leafByModel[YK] || 0) > 0, { file: YK, calls: leafByModel[YK] || 0 }, '> 0 calls');
  if (xSpec && xSpec.policyNet) {
    const P = policy[xName] || {};
    bar('x policy head served', P.calls > 0 && P.tilted > 0 && !P.broken_passthrough, P, 'calls > 0, tilted > 0, no pass-through');
  }
  const sp = R.spreads || {};
  bar('spreads warnings empty', Array.isArray(sp.warnings) && sp.warnings.length === 0, sp.warnings, '[]');
  const mode = S.flags.spreads;
  const linesSay = sp.lines_say || (o.kind === 'screen' ? null : []);
  bar('played the registered spread mode', R.flags && R.flags.spreads === mode && (linesSay == null || (linesSay.length === 1 && linesSay[0] === mode)), { flags: R.flags && R.flags.spreads, lines_say: linesSay }, mode);
  const G = guardOf(o.guard);
  const exitsOk = o.kind === 'sprt' ? (R.worker_exits || []).every(c => c === 0 || c === null) : (R.shards || []).every(s => s.code === 0);
  bar('guard: sampled, no ladder seen, not voided, exits ok', G.samples > 0 && G.ladder_seen === 0 && !G.voided && !G.beside_ladder && exitsOk, Object.assign({ exits_ok: exitsOk }, G), 'sampled, 0 ladder sightings');
  const capOk = bars.every(b => b.pass);
  let code;
  if (!capOk) code = 'VOID';
  else if (o.kind === 'screen') code = R.result.ci95_x[1] >= 0.5 ? 'PASS' : 'FAIL';
  else code = R.stop_pair_index == null ? 'INCONCLUSIVE' : /^H1/.test(R.verdict) ? 'H1' : /^H0/.test(R.verdict) ? 'H0' : 'INCONCLUSIVE';
  return { kind: o.kind, result: path.relative(ROOT, o.result).split(path.sep).join('/'), result_sha256: shaFile(o.result), read_at: new Date().toISOString(),
    preregistration: path.relative(ROOT, o.prereg).split(path.sep).join('/'), preregistration_sha256: shaText(o.prereg),
    engine_release: R.engine_release, flags: R.flags, x: xName, y: yName, x_spec: xSpec,
    x_digests: o.kind === 'screen' ? (R.x && R.x.digests) : R.x.digests,
    score: R.result, sprt: o.kind === 'sprt' ? { verdict: R.verdict, llr_at_stop: R.llr_at_stop, bounds: R.bounds, stop_pair_index: R.stop_pair_index, pairs_used: R.pairs_used, games_used: R.games_used } : null,
    clock_ratio: +(+ratio).toFixed(4), decision_ms, bars, capability_ok: capOk, verdict_code: code,
    verdict: capOk ? code : 'VOID (' + bars.filter(b => !b.pass).map(b => b.name).join('; ') + ')',
    arms: { x: AX || null, y: AY || null }, leaf_by_model: leafByModel, leaf_own: leafOwn, policy, guard: G };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  try {
    const r = read({ kind: flag('--kind'), result: path.resolve(ROOT, flag('--result')), prereg: path.resolve(ROOT, flag('--prereg')), xNet: flag('--x-net'), yNet: flag('--y-net'), guard: flag('--guard', null) ? path.resolve(ROOT, flag('--guard')) : null });
    fs.writeFileSync(path.resolve(ROOT, flag('--out')), JSON.stringify(r, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: r.verdict, score: r.score && r.score.score_x, ci95: r.score && r.score.ci95_x, bars: r.bars.map(b => `${b.pass ? 'ok' : 'FAIL'} ${b.name} ${JSON.stringify(b.value)} ${b.limit}`) }, null, 1));
    process.exit(0);
  } catch (e) { console.error(e && e.stack || e); process.exit(1); }
}

module.exports = { read, guardOf };
