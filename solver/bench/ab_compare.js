/* solver/bench/ab_compare.js — before vs after, INTERLEAVED (A B A B …), each run through
 * `cmd.exe /c tools\lownode.cmd solver/bench/playout_bench.js`, on the same fixed positions and seeds.
 *
 *   node solver/bench/ab_compare.js --base <dir holding the pre-change solver/> [--reps 3] [--games 3] [--passes 4] [--out f.json]
 *
 * The pre-change copy is made by exporting commit 562dc055's solver/miltank and solver/slowking to a
 * scratch folder (git archive … | tar -x); `--base` points at its solver/ directory.
 * Interleaving matters here: this machine is shared and its load moved wall time 3–4x within an hour, so a
 * block of "before" runs followed by a block of "after" runs measures the load, not the change. The
 * main-thread cpu rate is the primary figure; wall is reported beside it. Every run's values_sha and
 * decide_sha must be the same across A and B — speed is only claimed if nothing else moved.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const BASE = flag('--base', null);
if (!BASE) { console.error('--base <pre-change solver dir> required'); process.exit(2); }
const REPS = +flag('--reps', 3), GAMES = flag('--games', '3'), PASSES = flag('--passes', '4');

const arms = { before: path.resolve(BASE), after: path.join(ROOT, 'solver') };
const rows = [];
for (let r = 0; r < REPS; r++) for (const arm of (r % 2 ? ['after', 'before'] : ['before', 'after'])) {
  const res = cp.spawnSync('cmd.exe', ['/c', 'tools\\lownode.cmd', 'solver/bench/playout_bench.js', '--games', GAMES, '--passes', PASSES, '--impl', arms[arm]],
                           { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const line = (res.stdout || '').split('\n').filter(l => l.startsWith('{')).pop();
  let j = null; try { j = JSON.parse(line); } catch (e) {}
  const row = { rep: r, arm, exit: res.status, playouts: j && j.playouts, wall_per_s: j && j.playouts_per_s,
                cpu_per_s: j && j.playouts_per_main_thread_cpu_s, values_sha: j && j.values_sha, decide_sha: j && j.decide_sha, decide_s: j && j.decide_s };
  rows.push(row); console.log(JSON.stringify(row));
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const pick = (arm, k) => rows.filter(x => x.arm === arm).map(x => x[k]);
const summary = {
  identical: new Set(rows.map(x => x.values_sha)).size === 1 && new Set(rows.map(x => x.decide_sha)).size === 1,
  before: { cpu_per_s_median: med(pick('before', 'cpu_per_s')), wall_per_s_median: med(pick('before', 'wall_per_s')) },
  after: { cpu_per_s_median: med(pick('after', 'cpu_per_s')), wall_per_s_median: med(pick('after', 'wall_per_s')) },
  paired_cpu_ratio: rows.filter(x => x.arm === 'after').map(a => { const b = rows.find(x => x.arm === 'before' && x.rep === a.rep); return +(a.cpu_per_s / b.cpu_per_s).toFixed(3); }),
};
const out = { generated: new Date().toISOString(), flags: { games: +GAMES, passes: +PASSES, k: 6, depth: 1, reps: REPS }, arms, summary, rows };
const f = flag('--out', null);
if (f) fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log(JSON.stringify(summary));
process.exit(summary.identical && rows.every(x => x.exit === 0) ? 0 : 1);
