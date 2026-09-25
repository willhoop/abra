/* solver/bench/deadline_bench.js — MILTANK's DECISION LATENCY under artificial CPU load, on real Reg M-C positions.
 *
 *   tools\lownode.cmd solver/bench/deadline_bench.js --release eaa5becc54eb --lane pool --workers 1 --budget 1000
 *        --decisions 2000 [--core 15] [--burn 1] [--starve 0.35] [--seed 1] [--games 400] [--out <json>]
 *
 * WHAT IT MEASURES. The wall time of one MILTANK decision — `decide` (lane serial: ROTOM's path) or
 * `decideAsync` through solver/miltank/pool.js (lane pool: the arena's path) — from the call to the returned
 * joint, on `--decisions` positions, and whether it stayed under budget + 500 ms. Each decision is also split
 * into its phases (prepare = legal sets + prior scoring; fill = the cells; solve = SLOWKING + the pick) by
 * timing the fill from the outside, so a slow decision says WHERE it was slow.
 *
 * THE POSITIONS are real: the humans' own Reg M-C open sheets, brings and leads (solver/arena/teams.js, the arena's
 * loader, seeded stride over solver/out/human/games.jsonl), played forward by the human prior v0's argmax for both
 * sides on the arena's battle seeds. Every turn of every game is one position; the deciding side alternates. The
 * moves after the leads are the prior's, not the humans' — the humans' turns are not replayable into MEDICHAM.
 *
 * THE LOAD. This process confines itself (and so every child it forks — pool workers and burners inherit the mask)
 * to ONE logical core, `--core`, and forks `--burn` solver/bench/cpu_burner.js processes onto it. The burner
 * alternates FAIR episodes (below-normal, the pool workers' own class: round-robin sharing) and STARVE episodes
 * (normal priority: a below-normal worker on that core runs only on Windows' starvation boost). The deciding
 * process runs at NORMAL — the class ROTOM's process has — so what is measured is MILTANK's own bound, not the
 * OS refusing to run the decider at all. The total load this bench adds to the machine is one core.
 *
 * --idle-gc runs search.js collectIdle() between decisions, off the clock, as ROTOM must between requests (the serial
 * lane's tails past the margin were all major GCs inside a decision).
 * --burn 0 is the no-load control; --burn-mode starve keeps the burner at NORMAL throughout; --decider below leaves the
 * deciding process at BELOW_NORMAL (lownode's class, which ROTOM's clients are launched in) — the control for the
 * one thing MILTANK cannot bound: a decider process the OS is not running.
 *
 * EVERY FLAG IS IN THE ARTIFACT, with the engine release stamp, the positions' digest and the burner's episode log.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { PerformanceObserver } = require('perf_hooks');
const threadCpu = () => { const u = process.threadCpuUsage ? process.threadCpuUsage() : process.cpuUsage(); return u.user + u.system; };
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../arena/env.js');
const ROOT = path.join(__dirname, '..', '..');

const O = { lane: flag('--lane', 'pool'), workers: +flag('--workers', 1), budget: +flag('--budget', 1000), decisions: +flag('--decisions', 200),
  core: flag('--core', '15'), burn: +flag('--burn', 1), starve: +flag('--starve', 0.35), idle: +flag('--idle', 0), seed: +flag('--seed', 1), games: +flag('--games', 400),
  depth: +flag('--depth', 2), k1: +flag('--k1', 8), k2: +flag('--k2', 8), release: flag('--release', null), tag: flag('--tag', ''),
  burnMode: flag('--burn-mode', 'mixed'), decider: flag('--decider', 'normal'), idleGc: argv.includes('--idle-gc') };
const OUT = flag('--out', path.join(ROOT, 'solver', 'out', 'deadline', `${O.lane}-b${O.budget}-n${O.decisions}${O.tag ? '-' + O.tag : ''}.json`));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* 1. confine this process to one core BEFORE anything is forked; children inherit the mask */
let affinity = null;
function setAffinity(mask) {
  const ps = `$p=Get-Process -Id ${process.pid}; $p.ProcessorAffinity=[IntPtr]${mask}; $p.ProcessorAffinity.ToInt64()`;
  const got = cp.execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim();
  if (+got !== mask) throw new Error('affinity not set: asked ' + mask + ', got ' + got);
  return mask;
}
if (O.core !== 'none') affinity = { core: +O.core, mask: setAffinity(2 ** (+O.core)), decider: 'pinned with the load' };
/* --decider below keeps the lownode class: the CONTROL that shows what no code in MILTANK can bound — a decider the OS does not run */
try { os.setPriority(0, O.decider === 'below' ? os.constants.priority.PRIORITY_BELOW_NORMAL : os.constants.priority.PRIORITY_NORMAL); } catch (e) { console.error('could not set the decider priority: ' + e.message); }
const deciderPriority = os.getPriority(0);

const ENGINE = require('../arena/engine.js').load(O.release);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../prior/infer.js').load());
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const C = require('../miltank/cells.js');
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });

/* ONE GAME'S POSITIONS AT A TIME, as a ROTOM process holds one battle. The first version built all 2,000 positions up
 * front and held them: a ~350 MB old space, whose major GCs paused the serial decider for 1.1-1.6 s on the loaded
 * core (measured with a gc observer; docs/_reports/2026-09-25-miltank-deadline.md). The positions and their order are
 * the same either way; pos_sha is over the same sequence. */
function* positions(L, n) {
  const argmax = (S, side, ctx) => { const la = API.legalActions(S, side); if (la.joint.length === 1) return la.joint[0];
    const s = PA.scoreJoints(ctx, S, side, side, la); let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i; return la.joint[b]; };
  let k = 0;
  for (let gi = 0; gi < L.games.length && k < n; gi++) {
    const G = L.games[gi];
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const rng = API.makeRng(O.seed * 100000 + gi);
    const S = API.newBattle(a.team, b.team, { rng });
    const ctx = PA.newGame(G);
    const game = [];
    while (!API.isTerminal(S) && S.turn < 30 && k + game.length < n) {
      game.push({ gi, id: G.id, turn: S.turn, S: API.clone(S), ctx: { G, hist: ctx.hist.slice() }, side: (k + game.length) % 2 ? 'B' : 'A' });
      const jA = argmax(S, 'A', ctx), jB = argmax(S, 'B', ctx);
      PA.record(ctx, S, jA, jB);
      API.stepInPlace(S, jA, jB, rng);
    }
    for (const p of game) { k++; yield p; }
  }
}

const pct = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
function summary(ms) {
  if (!ms.length) return null;
  return { n: ms.length, mean: +(ms.reduce((x, y) => x + y, 0) / ms.length).toFixed(1), p50: pct(ms, 0.5), p99: pct(ms, 0.99), max: Math.max(...ms) };
}

async function main() {
  const t0 = Date.now();
  const L = T.loadGames({ n: O.games, seed: O.seed, M });
  if (L.refused) throw new Error(L.refused);
  const stream = positions(L, O.decisions);
  const first = stream.next().value;
  const posHash = crypto.createHash('sha256');
  const pairs = new Set();
  let posN = 0;
  const take = p => { posHash.update((posN ? '\n' : '') + p.id + ':' + p.turn + ':' + API.digest(p.S)); pairs.add(p.gi); posN++; return p; };
  const gcs = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) gcs.push({ pt: e.startTime, ms: e.duration, kind: e.detail && e.detail.kind }); }).observe({ entryTypes: ['gc'] });
  process.stdout.on('error', () => {});   // a closed stdout (the launcher went away) must not kill a run that writes its own artifact

  const pool = O.lane === 'pool' ? await require('../miltank/pool.js').create({ workers: O.workers }) : null;
  const burnLog = OUT.replace(/\.json$/, '.burn.jsonl');
  try { fs.unlinkSync(burnLog); } catch (e) {}
  const burners = [];
  for (let i = 0; i < O.burn; i++) burners.push(cp.fork(path.join(__dirname, 'cpu_burner.js'),
    ['--seed', String(O.seed * 7 + i), '--starve', String(O.starve), '--idle', String(O.idle), '--mode', O.burnMode, '--log', burnLog], { stdio: 'ignore' }));

  /* THE POOL LANE'S DECIDER FLOATS. The workers and the burner were forked inside the one-core mask and keep it;
   * the decider — which only waits on a timer and the workers' messages — gets every core back, as ROTOM's process
   * has on the ladder. The serial lane's decider IS the compute, so it stays pinned beside the burner (the worse case). */
  if (affinity && O.lane === 'pool') { setAffinity(2 ** os.cpus().length - 1); affinity.decider = 'floats (all ' + os.cpus().length + ' cores)'; }
  process.on('exit', () => { for (const c of burners) { try { c.kill(); } catch (e) {} } });
  /* phase timing from the outside: the fill is the one call both paths make */
  const PH = { fill0: 0, fill1: 0 };
  const f0 = C.fillSerial;
  C.fillSerial = function () { PH.fill0 = Date.now(); try { return f0.apply(this, arguments); } finally { PH.fill1 = Date.now(); } };
  if (pool) { const pf = pool.fill; pool.fill = async function (job) { PH.fill0 = Date.now(); try { return await pf.call(pool, job); } finally { PH.fill1 = Date.now(); } }; }

  /* WARM-UP, untimed, as ROTOM does at start-up (solver/rotom/rotom.js warm): one search on the first position so V8's
   * tier-up and the lean paths' first use are paid before the clock runs. Without it the FIRST decision of a process
   * overshoots by one cold playout (~0.5 s measured), which is a fact about start-up, not about the deadline. */
  const tw = Date.now();
  { const q = { budgetMs: 1500, k1: O.k1, k2: O.k2, depth: O.depth, coin: M.rngStreams({ seed: 424242 }).any, pool };
    if (pool) await MT.decideAsync(first.S, first.side, first.ctx, q); else MT.decide(first.S, first.side, first.ctx, q); }
  const warmMs = Date.now() - tw;
  for (const k in MT.COUNTERS) MT.COUNTERS[k] = 0;
  const rec = [];
  const tRun = Date.now();
  for (let i = 0; i < O.decisions; i++) {
    const p = take(i === 0 ? first : stream.next().value || (() => { throw new Error('only ' + i + ' positions from ' + L.games.length + ' team pairs; raise --games'); })());
    await new Promise(r => setImmediate(r));   // one event-loop turn between decisions, as ROTOM has: the gc observer delivers
    let idleGcMs = null;
    if (O.idleGc) { const g0 = Date.now(); MT.collectIdle(); idleGcMs = Date.now() - g0; }   // untimed: ROTOM does it while it waits for the next request
    PH.fill0 = PH.fill1 = 0;
    const cpu0 = threadCpu();
    const coin = M.rngStreams({ seed: 977 * i + O.seed }).any;
    const o = { budgetMs: O.budget, k1: O.k1, k2: O.k2, depth: O.depth, coin, pool };
    const a = Date.now(), pa = performance.now();
    let r, err = null;
    try { r = pool ? await MT.decideAsync(p.S, p.side, p.ctx, o) : MT.decide(p.S, p.side, p.ctx, o); } catch (e) { err = String(e && e.message || e).slice(0, 200); }
    const b = Date.now();
    const cpuMs = Math.round((threadCpu() - cpu0) / 1000);
    const inf = (r && r.info) || {};
    rec.push({ i, id: p.id, turn: p.turn, side: p.side, t0: a, pt0: pa, ms: b - a, cpu_ms: cpuMs, idle_gc_ms: idleGcMs, prepare_ms: PH.fill0 ? PH.fill0 - a : null, fill_ms: PH.fill0 ? PH.fill1 - PH.fill0 : null,
      solve_ms: PH.fill1 ? b - PH.fill1 : null, forced: !!inf.forced, playouts: inf.playouts, passes: inf.passes, unfilled: inf.unfilled, cells: inf.m * inf.n || null,
      filled: inf.filled, fallback: inf.fallback || null, late_workers: inf.late_workers,
      overrun_ms: inf.overrun_ms, max_world_ms: inf.max_world_ms, max_playout_ms: inf.max_playout_ms, err });
    if ((i + 1) % 100 === 0) {
      const ms = rec.map(x => x.ms);
      console.log(`  ${i + 1}/${O.decisions}  p50 ${pct(ms, 0.5)}  p99 ${pct(ms, 0.99)}  max ${Math.max(...ms)}  over ${ms.filter(x => x > O.budget + 500).length}  ${((Date.now() - tRun) / 1000).toFixed(0)} s`);
    }
  }
  for (const c of burners) { try { c.kill(); } catch (e) {} }
  if (pool) pool.close();
  await new Promise(r => setTimeout(r, 100));
  /* GC pauses in the DECIDER (this process), attributed to decisions by time */
  for (const x of rec) {
    /* both sides on performance.now(): the first version put a gc entry on performance.timeOrigin + startTime against a
     * Date.now() window, and the two clocks drifted apart over an hour, so an idle GC landed inside the next decision */
    const g = gcs.filter(e => e.pt >= x.pt0 && e.pt <= x.pt0 + x.ms);
    x.gc_ms = Math.round(g.reduce((s, e) => s + e.ms, 0)); x.gc_max = Math.round(Math.max(0, ...g.map(e => e.ms)));
  }
  const posSha = posHash.digest('hex').slice(0, 16);
  const episodes = []; try { for (const l of fs.readFileSync(burnLog, 'utf8').split('\n')) if (l.trim()) episodes.push(JSON.parse(l)); } catch (e) {}
  const inStarve = x => episodes.some(e => e.mode === 'starve' && e.t0 < x.t0 + x.ms && e.t1 > x.t0);
  const ms = rec.map(x => x.ms), searched = rec.filter(x => !x.forced);
  const bound = O.budget + 500;
  const over = rec.filter(x => x.ms > bound);
  const worst = rec.slice().sort((x, y) => y.ms - x.ms).slice(0, 10);
  const out = {
    what: 'MILTANK decision latency under artificial CPU load (solver/bench/deadline_bench.js)',
    ...ENGINE.stamp,
    flags: O, argv: process.argv.slice(2), out: OUT, node: process.version,
    /* the code that ran, by content: HEAD alone would not say whether the working tree carried uncommitted edits */
    code: Object.fromEntries(['solver/miltank/search.js', 'solver/miltank/cells.js', 'solver/miltank/pool.js', 'solver/miltank/pool_worker.js',
      'solver/miltank/rollout.js', 'solver/slowking/matrix.js', 'solver/bench/deadline_bench.js', 'solver/bench/cpu_burner.js']
      .map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 12)])),
    head: (() => { try { return cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { return null; } })(),
    env: { MILTANK_DEADLINE_BREAK: process.env.MILTANK_DEADLINE_BREAK || null, MILTANK_BREAK: process.env.MILTANK_BREAK || null, SOLVER_RELEASE: process.env.SOLVER_RELEASE || null },
    load: { affinity, decider_priority: deciderPriority, burners: O.burn, starve_share: O.starve, episodes: episodes.length,
            starve_s: +(episodes.filter(e => e.mode === 'starve').reduce((s, e) => s + e.t1 - e.t0, 0) / 1000).toFixed(0),
            fair_s: +(episodes.filter(e => e.mode === 'fair').reduce((s, e) => s + e.t1 - e.t0, 0) / 1000).toFixed(0),
            idle_s: +(episodes.filter(e => e.mode === 'idle').reduce((s, e) => s + e.t1 - e.t0, 0) / 1000).toFixed(0) },
    sample: { positions: posN, team_pairs: pairs.size, pos_sha: posSha, human_file: L.file },
    decider_gc_ms: { max_pause: Math.round(Math.max(0, ...gcs.map(e => e.ms))), pauses_over_100ms: gcs.filter(e => e.ms > 100).length,
                     over_bound_with_gc_over_100ms: rec.filter(x => x.ms > O.budget + 500 && x.gc_max > 100).length },
    warm_ms: warmMs, bound_ms: bound,
    latency_ms: summary(ms), latency_searched_ms: summary(searched.map(x => x.ms)),
    latency_in_starve_ms: summary(rec.filter(inStarve).map(x => x.ms)), latency_outside_starve_ms: summary(rec.filter(x => !inStarve(x)).map(x => x.ms)),
    phases_ms: { prepare: summary(searched.filter(x => x.prepare_ms != null).map(x => x.prepare_ms)), fill: summary(searched.filter(x => x.fill_ms != null).map(x => x.fill_ms)),
                 solve: summary(searched.filter(x => x.solve_ms != null).map(x => x.solve_ms)) },
    over_bound: over.length, errors: rec.filter(x => x.err).length,
    fallbacks: searched.filter(x => x.fallback).length, fallback_kinds: searched.reduce((a, x) => { if (x.fallback) a[x.fallback] = (a[x.fallback] || 0) + 1; return a; }, {}),
    playouts: summary(searched.map(x => x.playouts || 0)), unfilled_share: +(searched.reduce((s, x) => s + (x.unfilled || 0), 0) / Math.max(1, searched.reduce((s, x) => s + (x.cells || 0), 0))).toFixed(4),
    counters: { miltank: MT.COUNTERS, rollout: R.COUNTERS, pool: pool ? pool.counters : null },
    worst, verdict: over.length ? 'RED: ' + over.length + ' decisions over budget + 500 ms' : 'GREEN: max ' + Math.max(...ms) + ' ms <= ' + bound + ' ms',
    wall_s: Math.round((Date.now() - t0) / 1000), per_decision: rec,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const { per_decision, source_digests, worst: _w, argv: _a, ...head } = out;
  console.log(JSON.stringify(head));
  console.log('wrote ' + OUT);
  process.exit(over.length || out.errors ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
