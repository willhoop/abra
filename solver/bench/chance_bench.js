/* solver/bench/chance_bench.js — what one turn of WEIGHTED CHANCE costs and whether it agrees with sampled dice
 * (solver/miltank/chance.js; docs/_reports/2026-09-29-weighted-chance-search.md). LIGHT: one process, a few positions.
 *
 *   node solver/bench/chance_bench.js [--release eaa5becc54eb] [--games 4] [--per-game 2] [--pairs 3] [--n 2000]
 *        [--dmg exact|coarse|sample] [--rep strat|mid] [--mass-eps 1e-2] [--max-evals 4000] [--out solver/out/chance/bench.json]
 *
 * Positions: real Reg M-C open-sheet team pairs (solver/arena/teams.js), played forward by uniform legal joints on seeded
 * dice (the test-miltank recipe). At each sampled position, --pairs random (mine, theirs) joint pairs from legalActions:
 *   exact   Σ w · leaf(bucket)   over CH.enumerate's buckets (the heuristic leaf, depth 0: the turn is the only chance)
 *   sample  mean of --n ordinary playouts (rollout.playout, depth 0, seeds 1..n) with its standard error
 *   z       (exact − sample) / SE
 * plus buckets, evals, draws and ms per joint pair. Writes the JSON with the release stamp and every flag.
 */
'use strict';
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode sets it when used */ }
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const RELEASE = flag('--release', null);
const GAMES = +flag('--games', 4), PER = +flag('--per-game', 2), PAIRS = +flag('--pairs', 3), N = +flag('--n', 2000);
const DMG = flag('--dmg', 'exact'), REP = flag('--rep', 'strat');
const MASS = +flag('--mass-eps', 1e-2), MAXE = +flag('--max-evals', 4000), SEED = +flag('--seed', 11), REPS = +flag('--reps', 1);
const DUMP = new Set(String(flag('--dump', '')).split(',').filter(Boolean).map(Number));
const ONLY = flag('--only-games', null) ? new Set(String(flag('--only-games')).split(',').map(Number)) : null;
const OUT = flag('--out', path.join('solver', 'out', 'chance', 'bench.json'));

const E = require('../arena/engine.js').load(RELEASE);
const API = E.API, M = API.M;
const T = require('../arena/teams.js');
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const CH = require('../miltank/chance.js').create(API);

const L = T.loadGames({ n: GAMES, seed: 7, M });
if (L.refused) { console.log('CANNOT ANSWER: ' + L.refused); process.exit(2); }
const coin = M.rngStreams({ seed: SEED }).any;
const rows = [];
for (let gi = 0; gi < L.games.length; gi++) {
  const G = L.games[gi];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  const rng = API.makeRng(100 + gi);
  const S = API.newBattle(a.team, b.team, { rng });
  const hist = [];
  while (!API.isTerminal(S) && S.turn < 12) {
    hist.push(API.clone(S));
    const jA = API.legalActions(S, 'A').joint, jB = API.legalActions(S, 'B').joint;
    API.stepInPlace(S, jA[Math.floor(coin() * jA.length)], jB[Math.floor(coin() * jB.length)], rng);
  }
  const picks = []; for (let k = 0; k < PER && hist.length; k++) picks.push(hist[Math.floor(coin() * hist.length)]);
  for (const P of picks) {
    const W = R.prepare(P);
    const jAs = API.legalActions(P, 'A').joint, jBs = API.legalActions(P, 'B').joint;
    for (let q = 0; q < PAIRS; q++) {
      const jA = jAs[Math.floor(coin() * jAs.length)], jB = jBs[Math.floor(coin() * jBs.length)];
      const t0 = Date.now();
      let res;
      try { res = CH.enumerate(W, jA, jB, { massEps: MASS, maxEvals: MAXE, dmg: DMG, rep: REP, seed: SEED }); }
      catch (e) { rows.push({ game: G.id, turn: P.turn, error: String(e.message || e) }); console.log('  error ' + e.message); continue; }
      const tEnum = Date.now() - t0;
      const t1 = Date.now();
      let ex = 0, wsum = 0;
      for (const bk of res.buckets) { ex += bk.w * R.leaf(bk.S); wsum += bk.w; }
      /* --reps r: the enumeration is stratified SAMPLING (a drawn u per class), so it is re-run on r seeds and its own
       * standard error enters z; with one rep z uses the sampled SE alone and overstates |z| */
      const exs = [ex];
      for (let k = 1; k < REPS; k++) {
        const rk = CH.enumerate(W, jA, jB, { massEps: MASS, maxEvals: MAXE, dmg: DMG, rep: REP, seed: SEED + 1000 * k });
        exs.push(rk.buckets.reduce((a, bk) => a + bk.w * R.leaf(bk.S), 0));
      }
      const exMean = exs.reduce((a, x) => a + x, 0) / exs.length;
      const exSe = exs.length > 1 ? Math.sqrt(exs.reduce((a, x) => a + (x - exMean) * (x - exMean), 0) / (exs.length - 1) / exs.length) : 0;
      ex = exMean;
      const tLeaf = Date.now() - t1;
      const t2 = Date.now();
      let s = 0, s2 = 0;
      const idx = rows.length;
      if (DUMP.has(idx)) {
        /* --dump i: the i-th pair's enumerated consequences against the sampled ones, and the root's draw streams */
        const want = new Map(), got = new Map();
        for (const bk of res.buckets) { const k = CH.coarseKey(bk.S); want.set(k, (want.get(k) || 0) + bk.w); }
        for (let k = 1; k <= N; k++) { const S = R.copy(W); API.makeLean(S); API.stepInPlace(S, jA, jB, R.dice(k)); const key = CH.coarseKey(S); got.set(key, (got.get(key) || 0) + 1 / N); }
        console.log('DUMP pair ' + idx + ' ' + jA.map(o => o.choice) + ' vs ' + jB.map(o => o.choice) + ' stats ' + JSON.stringify(res.stats));
        for (const k of new Set([...want.keys(), ...got.keys()])) console.log('   ' + k + '  enumerated ' + (want.get(k) || 0).toFixed(4) + '  sampled ' + (got.get(k) || 0).toFixed(4));
        if (process.env.CHANCE_DEBUG) {
          /* the dice of the first sampled turns whose consequence the enumeration never reached */
          let shown = 0;
          for (let k = 1; k <= N && shown < 3; k++) {
            const S = R.copy(W); API.makeLean(S);
            const base = R.dice(k), lg = [];
            const wrap = { split: true, seed: k };
            for (const st of ['any'].concat(M.RNG_STREAMS)) wrap[st] = () => { const u = base[st](); lg.push(st + ':' + u.toFixed(4)); return u; };
            API.stepInPlace(S, jA, jB, wrap);
            const key = CH.coarseKey(S);
            if (!want.has(key)) { console.log('   MISSED ' + key + ' dice ' + lg.join(' ')); shown++; }
          }
          const S0 = R.copy(W); API.makeLean(S0); const lg0 = [];
          const w0 = { split: true, seed: 0 }; for (const st of ['any'].concat(M.RNG_STREAMS)) w0[st] = () => { lg0.push(st); return 0.5; };
          API.stepInPlace(S0, jA, jB, w0);
          console.log('   canonical root draws ' + lg0.join(' ') + ' -> ' + CH.coarseKey(S0));
        }
      }
      for (let k = 1; k <= N; k++) { const v = R.playout(W, jA, jB, k, 0); s += v; s2 += v * v; }
      const tSamp = Date.now() - t2;
      const mean = s / N, sd = Math.sqrt(Math.max(0, s2 / N - mean * mean)), se = sd / Math.sqrt(N);
      const zse = Math.sqrt(se * se + exSe * exSe);
      const z = zse > 1e-9 ? (ex - mean) / zse : (Math.abs(ex - mean) < 1e-9 ? 0 : Infinity);
      const row = { game: G.id, turn: P.turn, jA: jA.map(o => o.choice).join(','), jB: jB.map(o => o.choice).join(','),
        buckets: res.buckets.length, leaves: res.stats.leaves, evals: res.stats.evals, draws: res.stats.draws, depth: res.stats.maxDepth,
        truncatedMass: +res.stats.truncatedMass.toFixed(6), capped: res.stats.capped, snapped: res.stats.snapped, sampledDmg: res.stats.sampledDmg, sampledTie: res.stats.sampledTie, repMismatch: res.stats.repMismatch, unsnapped: res.stats.unsnapped,
        wsum: +wsum.toFixed(9), exact: +ex.toFixed(6), exact_se: +exSe.toFixed(6), reps: exs.length, sample: +mean.toFixed(6), sd: +sd.toFixed(6), se: +se.toFixed(6), z: +z.toFixed(2),
        ms_enum: tEnum, ms_leaf: tLeaf, ms_per_playout: +(tSamp / N).toFixed(3) };
      rows.push(row);
      console.log(`  g${gi} t${P.turn} buckets ${row.buckets} evals ${row.evals} draws ${row.draws} trunc ${row.truncatedMass} ${tEnum}ms  exact ${row.exact} sample ${row.sample}±${row.se} z ${row.z}  playout ${row.ms_per_playout}ms`);
    }
  }
}
const ok = rows.filter(r => r.error == null);
const q = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const summary = { pairs: ok.length, errors: rows.length - ok.length,
  buckets: { median: q(ok.map(r => r.buckets), 0.5), p90: q(ok.map(r => r.buckets), 0.9), max: Math.max(...ok.map(r => r.buckets)) },
  evals: { median: q(ok.map(r => r.evals), 0.5), p90: q(ok.map(r => r.evals), 0.9), max: Math.max(...ok.map(r => r.evals)) },
  ms_enum: { median: q(ok.map(r => r.ms_enum), 0.5), p90: q(ok.map(r => r.ms_enum), 0.9), max: Math.max(...ok.map(r => r.ms_enum)) },
  ms_per_playout: { median: q(ok.map(r => r.ms_per_playout), 0.5) },
  abs_z: { median: q(ok.map(r => Math.abs(r.z)), 0.5), max: Math.max(...ok.map(r => Math.abs(r.z))), over3: ok.filter(r => Math.abs(r.z) > 3).length },
  capped: ok.filter(r => r.capped).length, counters: CH.COUNTERS };
/* EFFICIENCY at equal time, per pair that has dice variance: (sampled variance x ms per playout) / (chance variance x ms per
 * enumeration). Above 1 the enumeration buys more precision per millisecond than playouts do. Needs --reps >= 2. */
if (REPS >= 2) {
  const eff = [];
  for (const r of ok) { if (r.sd < 1e-9) continue; const sdc = r.exact_se * Math.sqrt(r.reps); const vc = sdc * sdc * r.ms_enum; eff.push(vc < 1e-15 ? Infinity : (r.sd * r.sd * r.ms_per_playout) / vc); }
  summary.efficiency = { pairs: eff.length, median: q(eff, 0.5), min: eff.length ? Math.min(...eff) : null, over1: eff.filter(x => x > 1).length };
}
summary.cost_in_playouts = { median: q(ok.map(r => r.ms_enum / Math.max(1e-3, r.ms_per_playout)), 0.5), p90: q(ok.map(r => r.ms_enum / Math.max(1e-3, r.ms_per_playout)), 0.9) };
console.log(JSON.stringify(summary, null, 1));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(Object.assign({ at: new Date().toISOString(), flags: { release: RELEASE, games: GAMES, per_game: PER, pairs: PAIRS, n: N, reps: REPS, mass_eps: MASS, dmg: DMG, rep: REP, max_evals: MAXE, seed: SEED, leaf: 'heuristic', depth: 0 } }, E.stamp, { summary, rows }), null, 1));
console.log('wrote ' + OUT);
