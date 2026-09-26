/* solver/machamp/gate.js — a MACHAMP arena gate: agent X vs agent Y on held-out TEST team pairs, paired seating,
 * a frozen release, a fixed game count read ONCE at the end.
 *
 *   cmd.exe /c tools\lownode.cmd solver\machamp\gate.js --release <id> --x <spec.json> --y <spec.json>
 *        --pairs 100 --pair-seed S --seed S --workers 4 --out <result.json> [--cap 50] [--rule beats|notlose]
 *        [--info honest|omniscient]   default HONEST (solver/mew/play.js); recorded in flags.info (2026-09-26)
 *
 * 100 pairs = 200 games: each TEST pair (solver/mew/pairs.js — both players held out of every net's training data)
 * is played twice on the same battle seed with the bots swapped. The shards (solver/mew/play.js --mode match) are
 * merged here. Score = (W + D/2)/N for X with a Wilson 95% interval; the paired view counts the pairs X took both
 * games of, split, or lost both.
 *
 * THE RULE IS FIXED BEFORE THE FIRST GAME (solver/machamp/preregistration.json) and applied once:
 *   beats    PASS iff the Wilson 95% LOWER bound of X's score is > 0.5
 *   notlose  PASS iff the Wilson 95% UPPER bound of X's score is >= 0.5 (X is not shown to lose)
 * A game that errored scores nothing and is counted; any error or fallback is a WARNING in the artifact.
 * Both agents search at the same per-decision budget (equal wall-clock) when both are MILTANK agents.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { forkShards } = require('../mew/run.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}
const RULES = {
  beats: ci => ci[0] > 0.5,
  notlose: ci => ci[1] >= 0.5,
};

function merge(per) {
  const res = { W: 0, D: 0, L: 0, errors: 0, capped: 0, unbuildable: 0 };
  const pairs = { both: 0, split: 0, lost: 0, incomplete: 0 };
  const byPair = new Map();
  for (const p of per) {
    if (p.unbuildable) { res.unbuildable++; continue; }
    if (p.err) res.errors++;
    if (p.capped) res.capped++;
    if (p.vX === 1) res.W++; else if (p.vX === 0) res.L++; else if (p.vX === 0.5) res.D++;
    const a = byPair.get(p.pi) || []; a.push(p.vX); byPair.set(p.pi, a);
  }
  for (const a of byPair.values()) {
    if (a.length !== 2 || a.some(v => v == null)) { pairs.incomplete++; continue; }
    const s = a[0] + a[1]; if (s === 2) pairs.both++; else if (s === 0) pairs.lost++; else pairs.split++;
  }
  const n = res.W + res.D + res.L;
  const score = n ? (res.W + res.D / 2) / n : null;
  return { res, pairs, n, score, ci95: wilson(res.W + res.D / 2, n) };
}

async function main() {
  const rel = flag('--release'), X = flag('--x'), Y = flag('--y'), NP = +flag('--pairs', 100), PS = +flag('--pair-seed', 1);
  const seed = +flag('--seed', 1), W = +flag('--workers', 4), cap = +flag('--cap', 50), rule = flag('--rule', 'beats');
  const info = flag('--info', 'honest');
  if (!['honest', 'omniscient'].includes(info)) throw new Error('machamp/gate: --info must be honest or omniscient');
  const out = path.resolve(ROOT, flag('--out'));
  if (!rel || !X || !Y || !flag('--out')) throw new Error('usage: --release --x --y --pairs --out');
  if (!RULES[rule]) throw new Error('unknown rule ' + rule);
  if (W > 4) throw new Error('machamp/gate: at most 4 workers');
  const dir = out.replace(/\.json$/, '') + '.shards';
  fs.mkdirSync(dir, { recursive: true });
  const human = flag('--human', null), store = flag('--team-store', null);
  const started = new Date().toISOString();
  const { res: exits, wall_s } = await forkShards(path.join(__dirname, '..', 'mew', 'play.js'), W, i => ['--mode', 'match', '--release', rel,
    '--x', path.resolve(ROOT, X), '--y', path.resolve(ROOT, Y), '--pairs', String(NP), '--pair-seed', String(PS), '--seed', String(seed),
    '--shard', String(i), '--shards', String(W), '--cap', String(cap), '--out', path.join(dir, `shard-${i}.jsonl`), '--info', info, ...(human ? ['--human', human] : []), ...(store ? ['--team-store', store] : [])], 'gate');
  const sums = exits.map(e => { try { return JSON.parse(fs.readFileSync(path.join(dir, `shard-${e.shard}.jsonl.summary.json`), 'utf8')); } catch (err) { return null; } });
  const per = [].concat(...sums.filter(Boolean).map(s => s.per));
  const m = merge(per);
  const warnings = [];
  if (exits.some(e => e.code !== 0)) warnings.push('a worker exited non-zero: ' + JSON.stringify(exits.filter(e => e.code !== 0)));
  const fb = sums.filter(Boolean).reduce((a, s) => a + s.agent_counters.fallbacks, 0);
  if (fb) warnings.push(fb + ' FALLBACKS (search threw; the prior top legal joint was played)');
  if (m.res.errors) warnings.push(m.res.errors + ' games ended in an error and score nothing');
  const leaf = sums.filter(Boolean).reduce((a, s) => a + (s.rollout.leafPory2 || 0), 0);
  const first = sums.find(Boolean) || {};
  const miltankIn = [first.x, first.y].some(a => a && a.spec.kind === 'miltank');
  if (miltankIn && !leaf) warnings.push('a MILTANK agent played and the PORYGON2 leaf served 0 evaluations');
  /* QUIESCENCE (solver/miltank/rollout.js, 2026-09-27): an arm that asks for it must show extensions */
  const quiesced = sums.filter(Boolean).reduce((a, s) => a + (s.rollout.quiesced || 0), 0);
  if ([first.x, first.y].some(a => a && a.spec.quiesce) && !quiesced) warnings.push('an arm asked for quiescence and 0 playouts were extended');
  const expected = 2 * NP;
  if (m.n + m.res.errors + m.res.unbuildable !== expected) warnings.push(`expected ${expected} games, merged ${m.n} scored + ${m.res.errors} errored + ${m.res.unbuildable} unbuildable`);
  const ms = key => { const a = [].concat(...per.map(p => p[key] || [])).sort((p, q) => p - q); return a.length ? { n: a.length, mean: +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(1), p50: a[a.length >> 1], p99: a[Math.floor(0.99 * (a.length - 1))], max: a[a.length - 1] } : null; };
  const result = {
    what: 'MACHAMP gate (solver/machamp/gate.js)', started, finished: new Date().toISOString(),
    engine_release: first.engine_release || rel, release_stamp: first.release_stamp || null,
    flags: { release: rel, x: X, y: Y, pairs: NP, games: 2 * NP, pair_seed: PS, seed, workers: W, cap, rule, human, team_store: store, info },
    x: first.x || null, y: first.y || null, pool: first.pool || null,
    result: { ...m.res, played: m.n, score_x: m.score, ci95_x: m.ci95 }, paired: { team_pairs: NP, ...m.pairs },
    rule: { name: rule, text: rule === 'beats' ? 'PASS iff Wilson 95% lower bound of X score > 0.5' : 'PASS iff Wilson 95% upper bound of X score >= 0.5' },
    pass: m.n > 0 && !exits.some(e => e.code !== 0) && RULES[rule](m.ci95),
    decision_ms: { x: ms('ms_x'), y: ms('ms_y') },
    search: sums.filter(Boolean).map(s => s.search), rollout_leafPory2: leaf, rollout_quiesced: quiesced, fallbacks: fb, warnings, wall_s,
    shards: exits.map(e => ({ shard: e.shard, pid: e.pid, code: e.code })),
    per_game_sha256: crypto.createHash('sha256').update(JSON.stringify(per.map(p => [p.pi, p.xSide, p.vX]))).digest('hex').slice(0, 16),
  };
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ x: result.x && result.x.name, y: result.y && result.y.name, result: result.result, paired: result.paired, pass: result.pass, warnings }, null, 1));
  return exits.some(e => e.code !== 0) ? 1 : 0;
}

if (require.main === module) main().then(c => process.exit(c), e => { console.error(e); process.exit(1); });
module.exports = { wilson, merge, RULES };
