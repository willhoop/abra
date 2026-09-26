/* solver/bench/adaptive_tune.js — the TRAIN-pair tuning of ROTOM's adaptive clock (solver/rotom/adaptive.js), done BEFORE
 * its SPRT was registered (docs/_reports/2026-09-27-adaptive-clock.md §2).
 *
 *   node solver/bench/adaptive_tune.js collect --workers 3 --games 36 --passes 60 --out-dir solver/out/adaptive-tune
 *   node solver/bench/adaptive_tune.js analyze --dir solver/out/adaptive-tune
 *
 * COLLECT plays honest-arena games (solver/mew/play.js's honest flow: true spreads, each decision on the decider's public
 * view with XATU's belief) on TRAIN team pairs — never the TEST pairs the SPRT plays — gen5 (solver/machamp/league/gen5.json)
 * against DODUO-greedy, frozen release eaa5becc54eb, pool data/team-pool-frozen-regmc. Each searched gen5 decision fills
 * `--passes` complete passes (a 30 s ceiling) and records every pass's cell vector and its time from the decision start.
 * ANALYZE replays stop rules over those tables: a fixed budget T stops at the last pass done by T less MILTANK's reserve;
 * an adaptive config runs adaptive.js's own plan() and stopper() per game, in order. Loss is measured against the table
 * of ALL recorded passes (A_ref, its LP value v*): regret-br = v* − min_j (x·A_ref)_j and regret-vs-yref = v* − x·A_ref·y_ref,
 * x = SLOWKING's RM+ mix on the prefix. The reference contains the prefix, which favours LONGER searches, so an early stop
 * is judged conservatively.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const MODE = argv[0];
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode set it */ }

if (MODE === 'collect' && !argv.includes('--shard')) {
  const W = Math.min(3, +flag('--workers', 3)), dir = path.resolve(ROOT, flag('--out-dir', 'solver/out/adaptive-tune'));
  fs.mkdirSync(dir, { recursive: true });
  const kids = [];
  for (let s = 0; s < W; s++) {
    const out = path.join(dir, 'passes-' + s + '.jsonl'); if (fs.existsSync(out)) fs.unlinkSync(out);
    const k = cp.spawn(process.execPath, [__filename, 'collect', '--shard', String(s), '--shards', String(W), '--games', flag('--games', '36'), '--passes', flag('--passes', '60'), '--out', out], { stdio: 'inherit' });
    kids.push(new Promise(r => k.on('exit', r)));
  }
  Promise.all(kids).then(c => { console.log('exit codes', c); process.exit(c.some(x => x) ? 1 : 0); });
} else if (MODE === 'collect') {
  process.chdir(ROOT);
  require('../arena/env.js');
  const E = require('../arena/engine.js').load(flag('--release', 'eaa5becc54eb'));
  const API = E.API, M = API.M;
  const T = require('../arena/teams.js');
  const PAIRS = require('../mew/pairs.js');
  const AG = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
  const PA0 = require('../miltank/prior_adapter.js').create(API, null);
  const XW = AG.XW;
  const SHARD = +flag('--shard', 0), SHARDS = +flag('--shards', 1), NG = +flag('--games', 36), OUT = flag('--out'), PASSES = +flag('--passes', 60);
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
  const X = AG.load(Object.assign({}, spec, { budgetMs: 30000 }));
  const Y = AG.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
  const P = PAIRS.load({ teamStore: 'data/team-pool-frozen-regmc' });
  const list = PAIRS.pick(P.train, NG, 777);
  for (let g = SHARD; g < list.length; g += SHARDS) {
    const G = list[g], seed = 777000 + g;
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2'); if (!a || !b) continue;
    const truth = XW.truthSpreads(G.sheets, seed);
    for (const [p, t] of [['p1', a], ['p2', b]]) for (const m of t.team) XW.applySpread(m, truth[p][m._solverSheet], G.sheets[p][m._solverSheet]);
    const rng = API.makeRng(seed);
    const S = API.newBattle(a.team, b.team, { rng });
    const H = XW.arenaGame(G, S, PA0), ctx = PA0.newGame(G);
    const xSide = (g & 1) ? 'B' : 'A', by = Y.bot(seed * 3 + 2);
    while (!API.isTerminal(S) && S.turn < 50) {
      const ch = {};
      for (const side of ['A', 'B']) {
        const hv = XW.arenaView(H, G, S, side, PA0);
        if (side !== xSide) { ch[side] = by.choose(hv.V, side, ctx, hv.hb); continue; }
        const passes = []; const t0 = Date.now(); let job0 = null;
        const onPass = (vs, job, tt0) => { job0 = job; passes.push({ v: Array.from(vs[vs.length - 1], z => (z === z ? +z.toFixed(5) : null)), ms: Date.now() - tt0 }); return vs.length >= PASSES; };
        ch[side] = X.bot(seed * 5 + S.turn, { onPass }).choose(hv.V, side, ctx, hv.hb);
        const info = ch[side].info || {};
        if (!info.forced && passes.length) fs.appendFileSync(OUT, JSON.stringify({ g, pair: G.id, turn: S.turn, m: job0.rows.length, n: job0.cols.length, passes, total_ms: Date.now() - t0, playouts: info.playouts, release: E.id }) + '\n');
      }
      PA0.record(ctx, S, ch.A.joint, ch.B.joint);
      API.stepInPlace(S, ch.A.joint, ch.B.joint, rng);
    }
    console.log('  [shard ' + SHARD + '] game ' + g + ' turns ' + S.turn);
  }
  process.exit(0);
} else if (MODE === 'analyze') {
  const SK = require('../slowking/matrix.js');
  const AD = require('../rotom/adaptive.js');
  const dir = path.resolve(ROOT, flag('--dir', 'solver/out/adaptive-tune'));
  const recs = [];
  for (const f of fs.readdirSync(dir).filter(f => /^passes-\d+\.jsonl$/.test(f)).sort()) for (const l of fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n')) if (l) recs.push(JSON.parse(l));
  const meanA = (vs, m, n) => { const A = Array.from({ length: m }, () => new Array(n).fill(0)), C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (const v of vs) for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { const x = v[i * n + j]; if (x === x) { A[i][j] += x; C[i][j]++; } }
    let t = 0, k = 0; for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (C[i][j]) { A[i][j] /= C[i][j]; t += A[i][j]; k++; }
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (!C[i][j]) A[i][j] = k ? t / k : 0.5; return A; };
  for (const r of recs) { r.vs = r.passes.map(p => Float64Array.from(p.v, z => (z == null ? NaN : z))); r.Aref = meanA(r.vs, r.m, r.n); const s = SK.solveLP(r.Aref); r.vstar = s.value; r.yref = s.y; }
  const regret = (r, P) => { const x = SK.solveRM(meanA(r.vs.slice(0, P), r.m, r.n), { iters: 4000, tol: 1e-4 }).x;
    let br = Infinity; for (let j = 0; j < r.n; j++) { let s = 0; for (let i = 0; i < r.m; i++) s += x[i] * r.Aref[i][j]; br = Math.min(br, s); }
    let vy = 0; for (let i = 0; i < r.m; i++) for (let j = 0; j < r.n; j++) vy += x[i] * r.Aref[i][j] * r.yref[j];
    return { br: r.vstar - br, vy: r.vstar - vy }; };
  const res = T => Math.max(20, Math.min(300, Math.round(T * 0.06)));
  const timeAt = (r, P) => (P ? r.passes[P - 1].ms : 0);
  /* TIME ACCOUNTING (corrected 2026-09-26 after the first SPRT attempt, report §3): a real fill does not stop because this
   * recording ran out of passes. A fixed budget always fills to T − reserve; an adaptive decision that was still going when
   * the recording ended is charged to where its rule would have stopped it — the hard line if its table was close, else
   * the soft line. Its regret is read from all the recorded passes (optimistic by the same amount for both). */
  const SOLVE_MS = 40;
  function fixed(T) { let t = 0, br = 0, vy = 0, n = 0; for (const r of recs) { let P = 0; for (const p of r.passes) if (p.ms <= T - res(T)) P++; P = Math.max(1, P); const g = regret(r, P); br += g.br; vy += g.vy; t += T - res(T) + SOLVE_MS; n++; } return { name: 'fixed ' + T, ms: t / n, br: br / n, vy: vy / n }; }
  function adaptive(cfg) {
    const byGame = new Map(); for (const r of recs) { if (!byGame.has(r.g)) byGame.set(r.g, []); byGame.get(r.g).push(r); }
    let t = 0, br = 0, vy = 0, n = 0; const stops = {};
    for (const [, rs] of byGame) {
      const A = AD.create(cfg); A.newGame();
      for (const r of rs) {
        const pl = A.plan({ kind: 'move', bankS: 400, turnLeftS: 55, eRem: 6, eRemHi: 10 });
        const rec = {}; const f = A.stopper(pl, rec);
        let P;
        for (P = 1; P <= r.passes.length; P++) {
          if (r.passes[P - 1].ms > pl.hardMs - res(pl.hardMs)) { P = Math.max(1, P - 1); rec.stop = 'hard'; break; }
          if (f(r.vs.slice(0, P), { rows: new Array(r.m), cols: new Array(r.n) }, Date.now() - r.passes[P - 1].ms)) break;
        }
        let ms;
        if (P > r.passes.length) { P = r.passes.length; rec.stop = rec.state === 'close' ? 'hard' : 'soft';
          ms = Math.max(timeAt(r, P), rec.state === 'close' ? pl.hardMs - res(pl.hardMs) : pl.softMs - res(pl.softMs)) + SOLVE_MS; }
        else ms = (rec.stop === 'hard' ? pl.hardMs - res(pl.hardMs) : timeAt(r, P)) + SOLVE_MS;
        A.spent(ms, true, { kind: 'move', stop: rec.stop });
        stops[rec.stop] = (stops[rec.stop] || 0) + 1;
        const g = regret(r, P); br += g.br; vy += g.vy; t += ms; n++;
      }
    }
    return { name: 'adaptive ' + JSON.stringify(cfg), ms: t / n, br: br / n, vy: vy / n, stops };
  }
  const rows = [1000, 2000, 3000, 5000, 8000, 10000].map(fixed);
  const cfgs = flag('--cfgs') ? JSON.parse(flag('--cfgs')) : [{ targetMs: 5000 }, { targetMs: 5000, credit0Ms: 0 }, { targetMs: 4700, credit0Ms: 0 }, { targetMs: 4500, credit0Ms: 0 }, { targetMs: 4700, credit0Ms: 0, minMs: 1500 },
    { targetMs: 4700, credit0Ms: 0, clearZ: 2.5 }, { targetMs: 4700, credit0Ms: 0, clearZ: 1.5 }, { targetMs: 4700, credit0Ms: 0, closeZ: 0.5 }, { targetMs: 4700, credit0Ms: 0, stretch: 3 }, { targetMs: 4700, credit0Ms: 2350 }];
  for (const cfg of cfgs) rows.push(adaptive(cfg));
  const out = { what: 'adaptive clock tuning on TRAIN pairs (solver/bench/adaptive_tune.js)', decisions: recs.length, games: new Set(recs.map(r => r.g)).size,
                release: recs[0] && recs[0].release, rows: rows.map(r => ({ name: r.name, mean_ms: +r.ms.toFixed(0), regret_br_x1000: +(1000 * r.br).toFixed(2), regret_vs_yref_x1000: +(1000 * r.vy).toFixed(2), stops: r.stops })) };
  for (const r of out.rows) console.log(r.name.padEnd(48), 'ms', String(r.mean_ms).padStart(6), ' regret-br x1000', String(r.regret_br_x1000).padStart(6), ' regret-vs-yref x1000', String(r.regret_vs_yref_x1000).padStart(6), r.stops ? JSON.stringify(r.stops) : '');
  if (flag('--out')) fs.writeFileSync(path.resolve(ROOT, flag('--out')), JSON.stringify(out, null, 1));
} else { console.error('usage: adaptive_tune.js collect|analyze …'); process.exit(2); }
