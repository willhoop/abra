/* solver/bench/throughput.js — GAMES PER HOUR against the number of game workers (2026-10-02,
 * docs/_reports/2026-10-02-parallelism.md).
 *
 *   node solver/bench/throughput.js --kind match|selfplay --release <id> --workers 3,6,10,14 [--per-worker 6]
 *        [--x <spec>] [--y <spec>]              match: solver/machamp/gate.js (the engine sprt.js and every screen use: play.js --mode match)
 *        [--league <json>] [--pcr <json>]       selfplay: solver/mew/run.js (the N7 loop's self-play stage)
 *        --team-store <dir> [--spreads observed-v1] [--seed 1] [--machine dedicated] [--out <json>]
 *
 * Each worker count is ONE run of the real driver with `--per-worker` games per worker (match: pairs = per-worker/2 x W),
 * so the measured rate includes everything a real run pays: process start-up, the release load, the nets, the tail of the
 * slowest shard. While a run plays this samples the machine every 10 s: free memory, CPU busy across all logical cores, and
 * the working set of every process whose command line carries this run's output path (the shards). Per worker count:
 * games, wall s, games per hour, playouts per searched decision and decision ms per arm (match) or the PCR full/fast cut
 * counts (selfplay), fallbacks, peak RSS and minimum free memory. A timed match on more workers than physical cores
 * buys games per hour by SPENDING SEARCH (playouts per decision fall at a fixed clock); that is why both are reported.
 * Every flag is in the artifact. Run it on a QUIET machine.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const O = { kind: flag('--kind', 'match'), release: flag('--release', null), workers: flag('--workers', '3,6,10,14').split(',').map(Number), perWorker: +flag('--per-worker', 6),
  x: flag('--x', 'solver/results/2026-10-01-screens/ref-2s-a.json'), y: flag('--y', 'solver/results/2026-10-01-screens/ref-2s-b.json'),
  league: flag('--league', null), pcr: flag('--pcr', null), store: flag('--team-store', null), spreads: flag('--spreads', 'observed-v1'), seed: +flag('--seed', 1),
  machine: flag('--machine', 'dedicated'), cap: +flag('--cap', 50), extra: JSON.parse(flag('--extra', '[]')) };   // --extra '["--n7","--am-rate","0.1"]': passed to the driver as is
if (!O.release || !O.store) { console.error('throughput: --release and --team-store are required'); process.exit(2); }
if (O.kind === 'selfplay' && !O.league) { console.error('throughput: --kind selfplay needs --league'); process.exit(2); }
const OUT = path.resolve(ROOT, flag('--out', path.join('solver', 'out', 'parallelism', `throughput-${O.kind}-${O.release}.json`)));
const RUNDIR = OUT.replace(/\.json$/, '');
fs.mkdirSync(RUNDIR, { recursive: true });

function sample(tag) {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${tag.replace(/'/g, "''")}*' } | ForEach-Object { "$($_.ProcessId) $($_.WorkingSetSize)" }`;
  try {
    const out = cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
    const rss = out.split(/\r?\n/).map(l => l.trim().split(/\s+/)).filter(x => x.length === 2).map(([p, b]) => ({ pid: +p, mb: Math.round(+b / 1048576) }));
    return { procs: rss.length, rss_mb: rss.reduce((s, x) => s + x.mb, 0), max_mb: rss.reduce((m, x) => Math.max(m, x.mb), 0) };
  } catch (e) { return { error: String(e.message).slice(0, 80) }; }
}
const cpuSnap = () => os.cpus().map(c => Object.assign({}, c.times));
function cpuBusy(a, b) { let busy = 0, tot = 0; b.forEach((t, i) => { const d = k => t[k] - a[i][k]; const T0 = d('user') + d('nice') + d('sys') + d('idle') + d('irq'); tot += T0; busy += T0 - d('idle'); }); return tot ? busy / tot : null; }

function runOne(W) {
  return new Promise(resolve => {
    const tag = path.join(RUNDIR, `w${W}`);
    let script, args;
    if (O.kind === 'match') {
      const pairs = Math.max(1, Math.round(O.perWorker / 2 * W));
      script = path.join(ROOT, 'solver', 'machamp', 'gate.js');
      args = ['--release', O.release, '--x', O.x, '--y', O.y, '--pairs', String(pairs), '--pair-seed', '1', '--seed', String(O.seed), '--workers', String(W), '--cap', String(O.cap),
        '--rule', 'notlose', '--info', 'honest', '--spreads', O.spreads, '--team-store', O.store, '--machine', O.machine, '--out', tag + '.json', ...O.extra];
    } else {
      script = path.join(ROOT, 'solver', 'mew', 'run.js');
      args = ['--release', O.release, '--league', O.league, '--games', String(O.perWorker * W), '--seed', String(O.seed), '--workers', String(W), '--cap', String(O.cap),
        '--out', tag, '--team-store', O.store, '--info', 'honest', '--spreads', O.spreads, '--machine', O.machine, ...(O.pcr ? ['--pcr', O.pcr] : []), ...O.extra];
    }
    const t0 = Date.now(), c0 = cpuSnap();
    const samples = [];
    const ch = cp.spawn(process.execPath, [script, ...args], { cwd: ROOT, stdio: ['ignore', fs.openSync(tag + '.log', 'w'), fs.openSync(tag + '.err', 'w')] });
    console.log(`throughput ${O.kind}: ${W} workers, pid ${ch.pid}`);
    let cPrev = cpuSnap();
    const timer = setInterval(() => { const c = cpuSnap(); const s = sample(tag); samples.push(Object.assign({ t_s: Math.round((Date.now() - t0) / 1000), free_mb: Math.round(os.freemem() / 1048576), cpu_busy: +cpuBusy(cPrev, c).toFixed(3) }, s)); cPrev = c; }, 10000);
    ch.on('exit', code => {
      clearInterval(timer);
      const wall = (Date.now() - t0) / 1000, busy = cpuBusy(c0, cpuSnap());
      resolve({ W, code, wall_s: +wall.toFixed(1), cpu_busy_mean: +busy.toFixed(3), samples, tag });
    });
  });
}

function readRun(r) {
  const o = { workers: r.W, exit: r.code, wall_s: r.wall_s, cpu_busy_mean: r.cpu_busy_mean, cores_idle_mean: +((1 - r.cpu_busy_mean) * os.cpus().length).toFixed(1),
    rss_peak_mb: Math.max(0, ...r.samples.map(s => s.rss_mb || 0)), worker_rss_max_mb: Math.max(0, ...r.samples.map(s => s.max_mb || 0)), free_min_mb: Math.min(...r.samples.map(s => s.free_mb)), samples: r.samples.length };
  try {
    if (O.kind === 'match') {
      const R = JSON.parse(fs.readFileSync(r.tag + '.json', 'utf8'));
      const n = R.result ? R.result.played : null;
      o.games = n; o.games_per_hour = n ? +(n / (R.wall_s / 3600)).toFixed(1) : null; o.driver_wall_s = R.wall_s;
      o.fallbacks = R.fallbacks; o.errors = R.result ? R.result.errors : null; o.warnings = R.warnings;
      o.decision_ms = R.decision_ms;
      o.arms = R.arms ? Object.fromEntries(Object.entries(R.arms).map(([k, a]) => [k, { searched: a.searched, playouts_per_searched: a.derived ? a.derived.playouts_per_searched : null, fallback_share: a.derived ? a.derived.fallback_share : null }])) : null;
    } else {
      const man = JSON.parse(fs.readFileSync(path.join(r.tag, 'manifest.json'), 'utf8'));
      o.games = man.counts ? man.counts.games : null; o.games_per_hour = man.games_per_hour; o.driver_wall_s = man.wall_s; o.search = man.search; o.warnings = man.warnings;
      o.pcr = man.agent_counters ? man.agent_counters.pcr || null : null; o.fallbacks = man.agent_counters ? man.agent_counters.fallbacks : null;
    }
  } catch (e) { o.read_error = String(e.message).slice(0, 200); }
  return o;
}

(async () => {
  const rows = [];
  for (const W of O.workers) {
    const r = await runOne(W);
    const row = readRun(r);
    rows.push(row);
    console.log(`  ${W} workers: ${row.games} games in ${row.wall_s} s = ${row.games_per_hour} games/h; cpu busy ${(100 * row.cpu_busy_mean).toFixed(0)}% (${row.cores_idle_mean} cores idle); peak RSS ${row.rss_peak_mb} MB, worker max ${row.worker_rss_max_mb} MB, free min ${row.free_min_mb} MB` +
      (row.arms ? '; ' + Object.entries(row.arms).map(([k, a]) => `${k} ${a.playouts_per_searched} playouts/dec`).join('; ') + '; decision ms x ' + (row.decision_ms && row.decision_ms.x ? row.decision_ms.x.mean : '?') : '') + (row.pcr ? '; pcr ' + JSON.stringify(row.pcr) : '') + (row.read_error ? ' READ ERROR ' + row.read_error : ''));
    fs.writeFileSync(OUT, JSON.stringify({ tool: 'solver/bench/throughput.js', generated: new Date().toISOString(), flags: O, argv, machine: { logical_cores: os.cpus().length, model: os.cpus()[0].model, total_mb: Math.round(os.totalmem() / 1048576) }, rows }, null, 1));
  }
  console.log('throughput: wrote ' + path.relative(ROOT, OUT));
})();
