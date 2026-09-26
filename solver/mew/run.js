/* solver/mew/run.js — MEW, the self-play factory: N long-lived worker processes, one frozen release, one manifest.
 *
 *   cmd.exe /c tools\lownode.cmd solver\mew\run.js --release <id> --league <league.json> --games N --seed S
 *        --workers 4 --out solver/out/selfplay/<release>/<gen> [--cap 50] [--human <games.jsonl>]
 *
 * Forks --workers shards of solver/mew/play.js (process-level parallelism only; each worker loads its own
 * engine once and plays games g = shard, shard + workers, …). Children inherit BELOWNORMAL from lownode and
 * set it themselves as well. Workers never share an isolate.
 *
 * <out>/shard-<i>.jsonl.gz   one gzip member per game (solver/mew/play.js describes the record)
 * <out>/manifest.json        the release stamp, every flag, the league with each model's digest, the merged
 *                            counters, games per hour, the sha256 of every shard, and WARNINGS: a zero where a
 *                            capability should have fired (PORYGON2 leaf evaluations, playouts, recorded
 *                            decisions) and any fallback or error. A capability that cannot prove it ran is
 *                            assumed broken, so the warnings are printed, not buried.
 * The data are keyed by release: a different release writes a different directory (solver/PLAN.md §6).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');

async function forkShards(script, n, argsOf, label) {
  const t0 = Date.now();
  const procs = [];
  for (let i = 0; i < n; i++) {
    procs.push(new Promise((resolve) => {
      const c = cp.fork(script, argsOf(i), { execArgv: ['--max-old-space-size=1536'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      console.log(`${label}: shard ${i} pid ${c.pid}`);
      c.on('exit', code => resolve({ shard: i, code, pid: c.pid }));
    }));
  }
  const res = await Promise.all(procs);
  return { res, wall_s: (Date.now() - t0) / 1000 };
}
const sha = f => { const h = crypto.createHash('sha256'); h.update(fs.readFileSync(f)); return h.digest('hex'); };

async function main() {
  const rel = flag('--release'), league = flag('--league'), N = +flag('--games', 100), seed = +flag('--seed', 1);
  const W = +flag('--workers', 4), cap = +flag('--cap', 50), out = path.resolve(ROOT, flag('--out'));
  if (!rel || !league || !flag('--out')) throw new Error('usage: --release <id> --league <json> --games N --seed S --workers W --out <dir>');
  if (W > 4) throw new Error('mew/run: at most 4 workers on this machine (other agents share it)');
  fs.mkdirSync(out, { recursive: true });
  const human = flag('--human', null), store = flag('--team-store', null);
  const started = new Date().toISOString();
  const { res, wall_s } = await forkShards(path.join(__dirname, 'play.js'), W, i => ['--mode', 'selfplay', '--release', rel, '--league', path.resolve(ROOT, league),
    '--games', String(N), '--seed', String(seed), '--shard', String(i), '--shards', String(W), '--cap', String(cap),
    '--out', path.join(out, `shard-${i}.jsonl.gz`), ...(human ? ['--human', human] : []), ...(store ? ['--team-store', store] : [])], 'mew');
  const shards = res.map(r => {
    const f = path.join(out, `shard-${r.shard}.jsonl.gz`);
    let s = null; try { s = JSON.parse(fs.readFileSync(f + '.summary.json', 'utf8')); } catch (e) {}
    return { ...r, file: path.relative(ROOT, f).split(path.sep).join('/'), sha256: fs.existsSync(f) ? sha(f) : null, summary: s };
  });
  const ok = shards.filter(s => s.summary);
  const sum = k => ok.reduce((a, s) => a + (s.summary.counts[k] || 0), 0);
  const counts = { games: sum('games'), errors: sum('errors'), capped: sum('capped'), unbuildable: sum('unbuildable'), decisions: sum('decisions'), fallback_decisions: sum('fallback_decisions'),
    rows: sum('rows'), decisions_unmapped_rows: sum('decisions_unmapped_rows'), opp: {}, current_score: {} };
  for (const s of ok) for (const k in s.summary.counts.opp) counts.opp[k] = (counts.opp[k] || 0) + s.summary.counts.opp[k];
  for (const s of ok) for (const k in s.summary.counts.current_score) { const c = counts.current_score[k] || [0, 0]; c[0] += s.summary.counts.current_score[k][0]; c[1] += s.summary.counts.current_score[k][1]; counts.current_score[k] = c; }
  const addObj = key => { const o = {}; for (const s of ok) for (const k in s.summary[key]) if (typeof s.summary[key][k] === 'number') o[k] = (o[k] || 0) + s.summary[key][k]; return o; };
  const agent = addObj('agent_counters'), rollout = addObj('rollout');
  const searchDec = ok.reduce((a, s) => a + (s.summary.search ? s.summary.search.decisions : 0), 0);
  const wmean = key => ok.reduce((a, s) => a + (s.summary.search ? s.summary.search[key] * s.summary.search.decisions : 0), 0) / Math.max(1, searchDec);
  const warnings = [];
  if (res.some(r => r.code !== 0)) warnings.push('a worker exited non-zero: ' + JSON.stringify(res.filter(r => r.code !== 0)));
  if (!rollout.leafPory2) warnings.push('PORYGON2 leaf served 0 evaluations');
  if (!rollout.playouts) warnings.push('0 playouts');
  if (!counts.decisions) warnings.push('0 recorded decisions');
  if (counts.fallback_decisions) warnings.push(`${counts.fallback_decisions} search FALLBACK decisions (too empty to solve, or threw) recorded in the games' fallbacks lists`);
  if (agent.fallbacks) warnings.push(`${agent.fallbacks} FALLBACKS to the prior's top legal joint (search threw)`);
  if (counts.errors) warnings.push(`${counts.errors} games ended in an engine/agent error`);
  const first = ok[0] ? ok[0].summary : {};
  const manifest = {
    what: 'MEW self-play shards (solver/mew/run.js)', started, finished: new Date().toISOString(),
    engine_release: first.engine_release || rel, release_stamp: first.release_stamp || null,
    flags: { release: rel, league: path.relative(ROOT, path.resolve(ROOT, league)).split(path.sep).join('/'), games: N, seed, workers: W, cap, human, team_store: store },
    league: first.agents || null, league_weights: first.weights || null, league_file_sha256: sha(path.resolve(ROOT, league)),
    pool: first.pool ? { source: first.pool.pool_source, file: first.pool.file, train_pairs: first.pool.train_pairs, counts: first.pool.counts } : null,
    counts, wall_s, games_per_hour: +(counts.games / (wall_s / 3600)).toFixed(1),
    search: { decisions: searchDec, playouts_mean: +wmean('playouts_mean').toFixed(2), unfilled_share: +wmean('unfilled_share').toFixed(4), ms_mean: +wmean('ms_mean').toFixed(1) },
    agent_counters: agent, rollout_counters: rollout, warnings,
    shards: shards.map(s => ({ shard: s.shard, pid: s.pid, code: s.code, file: s.file, sha256: s.sha256, games: s.summary ? s.summary.counts.games : null, wall_s: s.summary ? s.summary.wall_s : null })),
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(JSON.stringify({ counts, games_per_hour: manifest.games_per_hour, search: manifest.search, fallbacks: agent.fallbacks, warnings }, null, 1));
  if (warnings.length) console.log('WARNINGS:\n  ' + warnings.join('\n  '));
  return res.some(r => r.code !== 0) ? 1 : 0;
}

if (require.main === module) main().then(c => process.exit(c), e => { console.error(e); process.exit(1); });
module.exports = { forkShards };
