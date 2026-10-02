/* solver/bench/ladbench.js — PLAYOUTS PER LIVE DECISION against the search pool's size (2026-10-02,
 * docs/_reports/2026-10-02-parallelism.md).
 *
 *   node solver/bench/ladbench.js --release <id> [--pools 0,1,2,4,8,12,14] [--budget 14000] [--decisions 10] [--games 40]
 *        [--seed 1] [--out solver/out/parallelism/ladbench-<release>-b<budget>.json]
 *
 * WHAT IT MEASURES. ROTOM's miltank-gen5 decision exactly as solver/rotom/policy.js makes it — the gen5 nets (MAG + DODUO
 * candidates, the PORYGON2 leaf), k / depth / reserveSwitch from solver/machamp/league/gen5.json, XATU's honest world
 * sampler — at a FIXED budget (no adaptive stop, so the number is capacity, not policy), in-process (pool 0) and with
 * its cells filled by a pool of N worker processes (solver/miltank/pool.js, as ROTOM --search-workers N runs it). Per pool
 * size: playouts and passes per decision, wall ms and overrun, every worker's playouts (idle workers), the deadline's
 * late workers, the prior fallbacks, the RSS of the decider and of every worker, the machine's free memory, and the CPU
 * the whole machine was busy (so the cores left for the desktop are a measurement, not a hope).
 *
 * THE POSITIONS are real and PAIRED across pool sizes: the humans' own Reg M-C open sheets, brings and leads (solver/arena/teams.js,
 * seeded stride over the human dataset), played forward by the gen5 prior's argmax on fixed battle seeds; each position is the
 * deciding side's PUBLIC VIEW (solver/xatu/worlds.js arenaView: XATU's back posterior, the spread prior), and each decision's
 * coin is seeded by its index, so every pool size answers the same decisions. Pool 0's playouts are the BEFORE.
 *
 * EVERY FLAG IS IN THE ARTIFACT, with the release stamp and the positions' digest. Run it on a QUIET machine: it is a timing
 * measurement, and a starved core reads as a smaller pool.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../arena/env.js');
const ROOT = path.join(__dirname, '..', '..');

const O = { release: flag('--release', null), pools: flag('--pools', '0,1,2,4,8,12,14').split(',').map(Number), budget: +flag('--budget', 14000),
  decisions: +flag('--decisions', 10), games: +flag('--games', 40), seed: +flag('--seed', 1),
  /* --gap-ms: idle between decisions, as the ladder waits for the opponent (the CPU's thermal duty cycle; 0 = back to back) */
  gapMs: +flag('--gap-ms', 0) };
if (!O.release) { console.error('ladbench: --release is required'); process.exit(2); }
const OUT = path.resolve(ROOT, flag('--out', path.join('solver', 'out', 'parallelism', `ladbench-${O.release}-b${O.budget}${O.gapMs ? '-gap' + O.gapMs : ''}.json`)));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const ENGINE = require('../arena/engine.js').load(O.release);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
/* ROTOM's rollout: PUBLIC fresh bodies (solver/rotom/rotom.js); the gen5 agent on it (solver/rotom/policy.js gen5()) */
const R = require('../miltank/rollout.js').create(API, { buildBody: T.bodyBuilder(M, { view: 'public' }) });
const AGmod = require('../mew/agent.js');
const AGm = AGmod.create(API, { rollout: R, buildBody: T.buildBody });
const specFile = path.join(ROOT, 'solver', 'machamp', 'league', 'gen5.json');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const G5 = AGm.load(spec), XW = AGm.XW;
const MTmod = require('../miltank/search.js');
const POOLMOD = require('../miltank/pool.js');

function rssOf(pids) {
  if (!pids.length) return {};
  try {
    const out = cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $($_.WorkingSet64)" }`], { encoding: 'utf8' });
    const o = {}; for (const l of out.split(/\r?\n/)) { const [p, b] = l.trim().split(/\s+/); if (p && b) o[p] = Math.round(+b / 1048576); }
    return o;
  } catch (e) { return { error: String(e.message).slice(0, 100) }; }
}
const cpuSnap = () => os.cpus().map(c => Object.assign({}, c.times));
function cpuBusy(a, b) { let busy = 0, tot = 0; b.forEach((t, i) => { const d = k => t[k] - a[i][k]; const T0 = d('user') + d('nice') + d('sys') + d('idle') + d('irq'); tot += T0; busy += T0 - d('idle'); }); return tot ? busy / tot : null; }
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const pct = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };

/* the positions: decision i of game g, the deciding side alternating, the public view built once and cloned per pool size */
function positions() {
  const L = T.loadGames({ n: O.games, seed: O.seed, M });
  if (L.refused) throw new Error(L.refused);
  const out = [];
  for (let gi = 0; gi < L.games.length && out.length < O.decisions; gi++) {
    const G = L.games[gi];
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const rng = API.makeRng(O.seed * 100000 + gi);
    const S = API.newBattle(a.team, b.team, { rng });
    const ctx = G5.PA.newGame(G);
    const H = XW.arenaGame(G, S);
    const argmax = side => { const la = API.legalActions(S, side); if (la.joint.length === 1) return la.joint[0]; const s = G5.PA.scoreJoints(ctx, S, side, side, la); let k = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[k]) k = i; return la.joint[k]; };
    /* two decisions per game, at turns 1 and 3 (a lead turn and a mid-game turn) */
    for (let t = 1; t <= 3 && !API.isTerminal(S); t++) {
      if (t === 1 || t === 3) {
        const side = out.length % 2 ? 'B' : 'A';
        const la = API.legalActions(S, side);
        if (la.joint.length > 1) { const v = XW.arenaView(H, G, S, side, G5.PA); out.push({ id: G.id, turn: S.turn, side, V: v.V, hb: v.hb, ctx: { G, hist: ctx.hist.slice() } }); }
        if (out.length >= O.decisions) break;
      }
      const jA = argmax('A'), jB = argmax('B'); G5.PA.record(ctx, S, jA, jB); API.stepInPlace(S, jA, jB, rng);
    }
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const P = positions();
  if (P.length < O.decisions) console.log('ladbench: only ' + P.length + ' positions');
  const posSha = crypto.createHash('sha256').update(P.map(p => p.id + ':' + p.turn + ':' + p.side + ':' + API.digest(p.V)).join('\n')).digest('hex').slice(0, 16);
  console.log(`ladbench: ${P.length} positions (sha ${posSha}), budget ${O.budget} ms, pools ${O.pools.join(',')}, release ${O.release}`);
  const opts = (coin, pool, p) => Object.assign({ budgetMs: O.budget, k1: spec.k1, k2: spec.k2, depth: spec.depth, reserveSwitch: spec.reserveSwitch, leaf: 'pory2',
    leafModel: AGmod.abs(spec.pory2), coin }, AGmod.searchExtras(spec), pool ? { pool, world: { kind: 'xatu', back: p.hb.back || null, oppP: p.hb.oppP, sheets: p.ctx.G.sheets } } : {});
  /* warm this process (nets, leaf, tier-up) before the first timed decision */
  { const p = P[0]; MTmod.create(API, { prior: G5.PA, rollout: XW.rollout(p.hb) }).decide(API.clone(p.V), p.side, p.ctx, opts(M.rngStreams({ seed: 1 }).any, null, p)); }
  const rows = [];
  for (const N of O.pools) {
    let pool = null, upMs = null;
    if (N > 0) {
      const a = Date.now();
      pool = await POOLMOD.create({ workers: N, env: { MILTANK_BODIES: 'public' } });
      /* warm every worker: a pooled pass-capped decision (each worker loads the nets, the leaf, the spread prior) */
      const p = P[0];
      await MTmod.create(API, { prior: G5.PA, rollout: XW.rollout(p.hb) }).decideAsync(API.clone(p.V), p.side, p.ctx, Object.assign(opts(M.rngStreams({ seed: 2 }).any, pool, p), { budgetMs: 120000, maxPasses: 2 * N }));
      upMs = Date.now() - a;
    }
    const D = [];
    let rssMid = null, freeMin = Infinity;
    const c0 = cpuSnap();
    for (const [i, p] of P.entries()) {
      const MT = MTmod.create(API, { prior: G5.PA, rollout: XW.rollout(p.hb) });
      const coin = M.rngStreams({ seed: 7000 + i }).any;
      const t = Date.now();
      const sampler = setTimeout(() => { if (!rssMid) rssMid = rssOf([process.pid, ...(pool ? pool.pids : [])]); freeMin = Math.min(freeMin, os.freemem()); }, Math.floor(O.budget / 2));
      const r = pool ? await MT.decideAsync(API.clone(p.V), p.side, p.ctx, opts(coin, pool, p)) : MT.decide(API.clone(p.V), p.side, p.ctx, opts(coin, null, p));
      clearTimeout(sampler);
      freeMin = Math.min(freeMin, os.freemem());
      const ms = Date.now() - t;
      D.push({ i, ms, forced: !!r.info.forced, playouts: r.info.playouts || 0, passes: r.info.passes || 0, unfilled: r.info.unfilled || 0, fallback: r.info.fallback || null,
               pool: r.info.pool || null, value: r.info.value });
      process.stdout.write(`  pool ${N}: decision ${i + 1}/${P.length}  ${r.info.playouts} playouts  ${ms} ms\r`);
      if (O.gapMs > 0) await new Promise(res => setTimeout(res, O.gapMs));
    }
    const busy = cpuBusy(c0, cpuSnap());
    if (!rssMid) rssMid = rssOf([process.pid, ...(pool ? pool.pids : [])]);   // pool 0's decision blocks the timer: read after it
    const S = D.filter(d => !d.forced);
    const pw = S.map(d => d.playouts);
    const row = { pool: N, decisions: S.length, playouts_mean: +mean(pw).toFixed(1), playouts_p50: pct(pw, 0.5), playouts_min: Math.min(...pw), passes_mean: +mean(S.map(d => d.passes)).toFixed(2),
      ms_mean: Math.round(mean(S.map(d => d.ms))), ms_max: Math.max(...S.map(d => d.ms)), over_budget_500: S.filter(d => d.ms > O.budget + 500).length,
      fallbacks: S.filter(d => d.fallback).length, unfilled: S.reduce((s, d) => s + d.unfilled, 0),
      idle_workers: S.reduce((s, d) => s + (d.pool ? d.pool.idle_workers : 0), 0), late_workers: S.reduce((s, d) => s + (d.pool ? d.pool.late : 0), 0),
      playouts_per_worker_mean: N ? +(mean(pw) / N).toFixed(1) : null,
      machine_cpu_busy: busy == null ? null : +busy.toFixed(3), cores_idle: busy == null ? null : +((1 - busy) * os.cpus().length).toFixed(1),
      rss_mb: rssMid, rss_total_mb: rssMid && !rssMid.error ? Object.values(rssMid).reduce((s, x) => s + x, 0) : null, free_mb_min: Math.round(freeMin / 1048576),
      pool_up_ms: upMs, pool_counters: pool ? Object.assign({}, pool.counters) : null, per_decision: D };
    rows.push(row);
    console.log(`  pool ${String(N).padStart(2)}: ${row.playouts_mean} playouts/decision (p50 ${row.playouts_p50}, min ${row.playouts_min}), ${row.ms_mean} ms mean, machine busy ${(100 * busy).toFixed(0)}% (${row.cores_idle} cores idle), RSS ${row.rss_total_mb} MB, free ${row.free_mb_min} MB, fallbacks ${row.fallbacks}, idle workers ${row.idle_workers}, late ${row.late_workers}`);
    if (pool) pool.close();
    fs.writeFileSync(OUT, JSON.stringify(result(), null, 1));
  }
  function result() {
    const base = rows.find(r => r.pool === 0);
    return { tool: 'solver/bench/ladbench.js', generated: new Date().toISOString(), flags: O, argv, release: ENGINE.stamp, spec: { file: path.relative(ROOT, specFile).split(path.sep).join('/'), digests: G5.digests, k1: spec.k1, k2: spec.k2, depth: spec.depth },
      machine: { logical_cores: os.cpus().length, model: os.cpus()[0].model, total_mb: Math.round(os.totalmem() / 1048576), priority: os.getPriority(0) },
      positions: { n: P.length, sha: posSha, source: 'solver/arena/teams.js loadGames n ' + O.games + ' seed ' + O.seed + '; turns 1 and 3; honest view (XW.arenaView)' },
      rows: rows.map(r => Object.assign({}, r, { speedup_vs_inprocess: base ? +(r.playouts_mean / base.playouts_mean).toFixed(2) : null })), wall_s: Math.round((Date.now() - t0) / 1000) };
  }
  fs.writeFileSync(OUT, JSON.stringify(result(), null, 1));
  console.log('ladbench: wrote ' + path.relative(ROOT, OUT));
  process.exit(0);
}
main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
