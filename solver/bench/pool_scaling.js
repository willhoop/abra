/* solver/bench/pool_scaling.js — playouts/s through the worker pool at 1/2/4/8 workers, each run launched
 * through `cmd.exe /c tools\lownode.cmd` (BELOWNORMAL, as CLAUDE.md requires for a heavy run), plus the
 * in-process serial run through the same wrapper, and whether every run's values_sha is the serial one.
 *
 *   node solver/bench/pool_scaling.js [--games 4] [--passes 8] [--workers 0,1,2,4,8] [--reps 1] [--out f.json]
 *
 * The machine is SHARED (other sessions' jobs run at the same priority), so each row also records how busy
 * the whole machine was while it ran (os.cpus() time deltas: 1 − idle/total over all 16 logical cores).
 * A scaling curve without that column cannot be read.
 */
'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const GAMES = flag('--games', '4'), PASSES = flag('--passes', '8');
const WS = flag('--workers', '0,1,2,4,8').split(',').map(Number);
const REPS = +flag('--reps', 1);

const cpuSnap = () => os.cpus().reduce((a, c) => { const t = c.times; a.idle += t.idle; a.total += t.user + t.nice + t.sys + t.idle + t.irq; return a; }, { idle: 0, total: 0 });

const rows = [];
for (let rep = 0; rep < REPS; rep++) for (const w of (rep % 2 ? WS.slice().reverse() : WS)) {   // odd reps run in reverse, so drift in the machine's load does not line up with the worker count
  const args = ['/c', 'tools\\lownode.cmd', 'solver/bench/playout_bench.js', '--games', GAMES, '--passes', PASSES, '--no-decide', '--workers', String(w)];
  const c0 = cpuSnap(), t0 = Date.now();
  const r = cp.spawnSync('cmd.exe', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const c1 = cpuSnap();
  const line = (r.stdout || '').split('\n').filter(l => l.startsWith('{')).pop();
  let j = null; try { j = JSON.parse(line); } catch (e) {}
  const busy = 1 - (c1.idle - c0.idle) / Math.max(1, c1.total - c0.total);
  const row = { rep, workers: w, exit: r.status, wall_total_s: +((Date.now() - t0) / 1000).toFixed(1), machine_busy: +busy.toFixed(3),
                playouts: j && j.playouts, fill_s: j && j.seconds, playouts_per_s: j && j.playouts_per_s,
                playouts_per_cpu_s: j && (j.playouts_per_worker_cpu_s || j.playouts_per_main_thread_cpu_s), values_sha: j && j.values_sha,
                pool_startup_ms: j && j.pool_startup_ms };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const serial = rows.find(r => r.workers === 0);
const out = { generated: new Date().toISOString(), what: 'pool scaling, fixed positions and seeds; each run via cmd.exe /c tools\\lownode.cmd',
              flags: { games: +GAMES, passes: +PASSES, k: 6, depth: 1 }, logical_cores: os.cpus().length,
              identical_to_serial: serial ? rows.every(r => r.values_sha === serial.values_sha) : null, rows };
const f = flag('--out', null);
if (f) fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ identical_to_serial: out.identical_to_serial }));
process.exit(rows.every(r => r.exit === 0) && out.identical_to_serial !== false ? 0 : 1);
