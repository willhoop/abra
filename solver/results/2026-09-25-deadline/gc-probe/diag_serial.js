// DIAGNOSIS: why does a serial MILTANK decision overrun by ~1.4 s once in ~1000 under load? Per decision: wall, main-thread
// cpu, GC pauses (perf_hooks), and the slowest single playout's wall AND cpu. Same positions/load recipe as the bench.
//   node diag_serial.js <core> <decisions> <positions> [budget]
const WT = 'C:\\Users\\willj\\Projects\\Pokemon\\ABRA\\.claude\\worktrees\\agent-a0ffd3be7ba08dc95';
process.chdir(WT);
const fs = require('fs'), os = require('os'), cp = require('child_process');
const { PerformanceObserver } = require('perf_hooks');
const [core, NDEC, NPOS, BUDGET] = [+process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5] || 1000)];
cp.execFileSync('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${process.pid}; $p.ProcessorAffinity=[IntPtr]${2 ** core}`]);
os.setPriority(0, os.constants.priority.PRIORITY_NORMAL);
require(WT + '/solver/arena/env.js');
const E = require(WT + '/solver/arena/engine.js').load('eaa5becc54eb');
const API = E.API, M = API.M;
const T = require(WT + '/solver/arena/teams.js');
const PA = require(WT + '/solver/miltank/prior_adapter.js').create(API, require(WT + '/solver/prior/infer.js').load());
const R = require(WT + '/solver/miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require(WT + '/solver/miltank/search.js').create(API, { prior: PA, rollout: R });
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const gcs = [];
new PerformanceObserver(l => { for (const e of l.getEntries()) gcs.push({ t0: performance.timeOrigin + e.startTime, ms: e.duration, kind: e.detail && e.detail.kind }); }).observe({ entryTypes: ['gc'] });
// wrap the playout: wall + cpu of each
let cur = null;
const p0 = R.playout;
R.playout = function () { const w = Date.now(), c = cpu(); const v = p0.apply(this, arguments); const dw = Date.now() - w, dc = cpu() - c;
  if (cur && dw > cur.pw) { cur.pw = dw; cur.pc = +dc.toFixed(1); cur.pt = w; } return v; };
// positions (same recipe as the bench)
const L = T.loadGames({ n: 400, seed: 1, M });
const P = [];
const argmax = (S, side, ctx) => { const la = API.legalActions(S, side); if (la.joint.length === 1) return la.joint[0];
  const s = PA.scoreJoints(ctx, S, side, side, la); let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i; return la.joint[b]; };
for (let gi = 0; gi < L.games.length && P.length < NPOS; gi++) {
  const G = L.games[gi]; const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  const rng = API.makeRng(100000 + gi); const S = API.newBattle(a.team, b.team, { rng }); const ctx = PA.newGame(G);
  while (!API.isTerminal(S) && S.turn < 30 && P.length < NPOS) {
    P.push({ S: API.clone(S), ctx: { G, hist: ctx.hist.slice() }, side: P.length % 2 ? 'B' : 'A', turn: S.turn });
    const jA = argmax(S, 'A', ctx), jB = argmax(S, 'B', ctx); PA.record(ctx, S, jA, jB); API.stepInPlace(S, jA, jB, rng);
  }
}
const burner = cp.fork(WT + '\\solver\\bench\\cpu_burner.js', ['--seed', '7', '--starve', '0.35', '--idle', '0.2', '--log', __dirname + '\\diag.burn.jsonl'], { stdio: 'ignore' });
process.on('exit', () => { try { burner.kill(); } catch (e) {} });
MT.decide(P[0].S, P[0].side, P[0].ctx, { budgetMs: 1500, coin: M.rngStreams({ seed: 4 }).any });
console.log('heap MB', (process.memoryUsage().heapUsed / 1e6).toFixed(0), 'positions', P.length);
const rec = [];
(async () => {
for (let i = 0; i < NDEC; i++) {
  await new Promise(r => setImmediate(r));   // let the gc observer deliver
  const p = P[i % P.length];
  cur = { pw: 0, pc: 0, pt: 0 };
  const w = Date.now(), c = cpu(), g0 = gcs.length;
  const r = MT.decide(p.S, p.side, p.ctx, { budgetMs: BUDGET, coin: M.rngStreams({ seed: 977 * i + 1 }).any });
  const ms = Date.now() - w;
  rec.push({ i, w, pt: cur.pt, ms, cpu: +(cpu() - c).toFixed(0),
    worst_playout_wall: cur.pw, worst_playout_cpu: cur.pc, overrun: r.info.overrun_ms, prep_like: null, fb: r.info.fallback || '' });
}
await new Promise(r => setTimeout(r, 200));
/* gc entries arrive late: attribute them to decisions after the fact, by time */
for (const x of rec) {
  const g = gcs.filter(e => e.t0 >= x.w - 1 && e.t0 <= x.w + x.ms + 1);
  x.gc_ms = +g.reduce((s, e) => s + e.ms, 0).toFixed(0); x.gc_max = +Math.max(0, ...g.map(e => e.ms)).toFixed(0);
  x.gc_in_worst_playout = +gcs.filter(e => e.t0 >= x.pt && e.t0 <= x.pt + x.worst_playout_wall).reduce((s, e) => s + e.ms, 0).toFixed(0);
}
const w = rec.slice().sort((a, b) => b.ms - a.ms).slice(0, 12);
console.log(JSON.stringify(w.map(x => `${x.ms}ms cpu${x.cpu} gc${x.gc_ms}/max${x.gc_max} worstPlayout wall${x.worst_playout_wall} cpu${x.worst_playout_cpu} gcIn${x.gc_in_worst_playout} over${x.overrun} ${x.fb}`), null, 0).replace(/","/g, '\n'));
const all = rec.map(x => x.ms).sort((a, b) => a - b);
console.log('n', rec.length, 'p50', all[rec.length >> 1], 'p99', all[Math.floor(rec.length * 0.99)], 'max', all[all.length - 1], 'over', rec.filter(x => x.ms > BUDGET + 500).length,
  'gc max overall', Math.max(...gcs.map(x => x.ms)).toFixed(0), 'heap MB', (process.memoryUsage().heapUsed / 1e6).toFixed(0));
fs.writeFileSync(__dirname + '\\diag_serial.json', JSON.stringify({ rec, gcs }));
process.exit(0);
})();
