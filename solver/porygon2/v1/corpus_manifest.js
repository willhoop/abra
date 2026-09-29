/* solver/porygon2/v1/corpus_manifest.js — the manifest of a MEW self-play directory whose run was STOPPED on purpose before its
 * --games target (the workers were ended by pid, so solver/mew/run.js wrote no per-shard summaries). Everything is read back
 * from the shards themselves: games, decisions, search counters, errors, capped games, league seats, wall time from the
 * first and last game's shard mtime window, and the sha256 of every shard. Torn last lines are counted (replay.js readShard).
 *
 *   node solver/porygon2/v1/corpus_manifest.js <dir> --league <league.json> --release <id> --seed S --started <ISO> --stopped <ISO>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..', '..');
const dir = path.resolve(ROOT, argv[0]);
const { readShard } = require('./replay.js');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const torn = {};
const c = { games: 0, errors: 0, capped: 0, decisions: 0, fallbacks: 0, positions: 0, opp: {}, playouts: 0, searched: 0, unfilled: 0, cells: 0, current_score: {} };
const shards = [];
for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl\.gz$/.test(f)).sort()) {
  const recs = readShard(path.join(dir, f), torn);
  shards.push({ file: path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/'), sha256: sha(path.join(dir, f)), games: recs.length });
  for (const r of recs) {
    c.games++; if (r.err) c.errors++; if (r.capped) c.capped++;
    c.decisions += (r.decisions || []).length; c.fallbacks += (r.fallbacks || []).length; c.positions += (r.hist || []).length;
    c.opp[r.opp] = (c.opp[r.opp] || 0) + 1;
    for (const d of r.decisions || []) { c.searched++; c.playouts += d.playouts || 0; c.unfilled += d.unfilled || 0; c.cells += (d.m || 0) * (d.nc || 0); }
    if (r.vA != null) { const v = r.cur_side === 'A' ? r.vA : 1 - r.vA; const s = c.current_score[r.opp] || [0, 0]; s[0] += v; s[1]++; c.current_score[r.opp] = s; }
  }
}
const started = flag('--started'), stopped = flag('--stopped');
const wall = (Date.parse(stopped) - Date.parse(started)) / 1000;
const m = { what: 'MEW self-play shards (solver/mew/run.js), STOPPED before the --games target; manifest rebuilt from the shards by solver/porygon2/v1/corpus_manifest.js',
  engine_release: flag('--release'), flags: { league: flag('--league'), seed: +flag('--seed'), workers: shards.length, cap: 50, team_store: 'data/team-pool-frozen-regmc', info: 'omniscient' },
  league_file_sha256: sha(path.resolve(ROOT, flag('--league'))), started, stopped, wall_s: wall, counts: c, torn,
  games_per_hour: +(c.games / (wall / 3600)).toFixed(1),
  search: { decisions: c.searched, playouts_mean: +(c.playouts / Math.max(1, c.searched)).toFixed(2), unfilled_share: +(c.unfilled / Math.max(1, c.cells)).toFixed(5) }, shards };
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 1));
console.log(JSON.stringify({ counts: c, games_per_hour: m.games_per_hour, torn }));
