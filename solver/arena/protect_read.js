/* solver/arena/protect_read.js — sum the protect counter (solver/arena/protect_stats.js) over a finished match's shards.
 *
 *   node solver/arena/protect_read.js <result.json of gate.js or sprt.js> [--all]
 *
 * Reads <result>.shards/shard-*.jsonl (solver/mew/play.js --mode match lines). For an SPRT result only the COUNTED
 * pairs (index <= stop_pair_index) are summed unless --all; a gate reads every game. Prints, per arm (x, y): actions,
 * protect clicks, share, failed, fail rate, consecutive, consecutive failed. A finished run only — never a live one.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const res = path.resolve(argv[0]);
const R = JSON.parse(fs.readFileSync(res, 'utf8'));
const dir = res.replace(/\.json$/, '') + '.shards';
const cut = argv.includes('--all') || R.stop_pair_index == null ? Infinity : R.stop_pair_index;
const sum = { x: {}, y: {} };
let games = 0, missing = 0;
for (const f of fs.readdirSync(dir).filter(n => /^shard-\d+\.jsonl$/.test(n))) {
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!l) continue;
    const p = JSON.parse(l);
    if (p.unbuildable || p.pi > cut) continue;
    if (!p.protect) { missing++; continue; }
    games++;
    for (const a of ['x', 'y']) for (const [k, v] of Object.entries(p.protect[a])) sum[a][k] = (sum[a][k] || 0) + v;
  }
}
const out = { result: path.relative(process.cwd(), res), games, games_without_counter: missing, x: R.x && R.x.file, y: R.y && R.y.file, arms: {} };
for (const a of ['x', 'y']) {
  const s = sum[a];
  out.arms[a] = Object.assign({}, s, { share: s.actions ? +(s.protects / s.actions).toFixed(4) : null, fail_rate: s.protects ? +(s.failed / s.protects).toFixed(4) : null,
    consec_share: s.protects ? +(s.consec / s.protects).toFixed(4) : null, consec_fail_rate: s.consec ? +(s.consecFailed / s.consec).toFixed(4) : null });
}
console.log(JSON.stringify(out, null, 1));
if (missing) { console.error('  WARNING: ' + missing + ' games carry no protect counter (played before solver/arena/protect_stats.js was wired)'); process.exitCode = 1; }
