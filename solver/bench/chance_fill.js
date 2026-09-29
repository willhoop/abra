/* solver/bench/chance_fill.js — does a MILTANK decision with WEIGHTED CHANCE fill its table inside the clock? LIGHT: one
 * process, in-process fill (no pool), a handful of real positions. The phase-2 feasibility preview
 * (docs/_reports/2026-09-29-weighted-chance-search.md; solver/miltank/preregistration-chance.json).
 *
 *   node solver/bench/chance_fill.js [--release eaa5becc54eb] [--games 3] [--budget 1000] [--k 4] [--dmg coarse]
 *        [--out solver/out/chance/fill.json]
 *
 * Each position is decided twice on the same coin: the current search (gen5's shape: k x k, 1 reserved switch row,
 * depth 0, heuristic leaf) and the same with `chance`. Reported per arm: filled fraction, passes, playouts, fallbacks.
 */
'use strict';
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode sets it */ }
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const RELEASE = flag('--release', null), GAMES = +flag('--games', 3), BUDGET = +flag('--budget', 1000), K = +flag('--k', 4);
const DMG = flag('--dmg', 'coarse');
const OUT = flag('--out', path.join('solver', 'out', 'chance', 'fill.json'));

const E = require('../arena/engine.js').load(RELEASE);
const API = E.API, M = API.M;
const T = require('../arena/teams.js');
const prior = require('../prior/infer.js').load();
const PA = require('../miltank/prior_adapter.js').create(API, prior);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });

const L = T.loadGames({ n: GAMES, seed: 7, M });
if (L.refused) { console.log('CANNOT ANSWER: ' + L.refused); process.exit(2); }
const coin = M.rngStreams({ seed: 23 }).any;
const rows = [];
for (let gi = 0; gi < L.games.length; gi++) {
  const G = L.games[gi];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  const rng = API.makeRng(300 + gi);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA.newGame(G);
  while (!API.isTerminal(S) && S.turn < 8) {
    if (S.turn % 3 === 1) {
      for (const arm of ['base', 'chance']) {
        const o = { budgetMs: BUDGET, k1: K, k2: K, reserveSwitch: 1, depth: 0, coin: M.rngStreams({ seed: 77 + S.turn }).any };
        if (arm === 'chance') o.chance = { dmg: DMG };
        const c0 = R.COUNTERS.chanceEvals;
        const d = MT.decide(API.clone(S), 'A', { G, hist: ctx.hist.slice() }, o);
        if (d.info.forced) break;
        rows.push({ game: G.id, turn: S.turn, arm, filled: d.info.filled, passes: d.info.passes, playouts: d.info.playouts, fallback: d.info.fallback || null,
                    ms: d.info.ms, chance_evals: R.COUNTERS.chanceEvals - c0 });
        console.log('  ' + arm + ' t' + S.turn + ' filled ' + d.info.filled + ' passes ' + d.info.passes + ' playouts ' + d.info.playouts + ' fallback ' + (d.info.fallback || '-') + ' ' + d.info.ms + 'ms');
      }
    }
    const jA = API.legalActions(S, 'A').joint, jB = API.legalActions(S, 'B').joint;
    const x = jA[Math.floor(coin() * jA.length)], y = jB[Math.floor(coin() * jB.length)];
    PA.record(ctx, S, x, y);
    API.stepInPlace(S, x, y, rng);
  }
}
const by = arm => rows.filter(r => r.arm === arm);
const mean = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
const summary = {};
for (const arm of ['base', 'chance']) {
  const r = by(arm);
  summary[arm] = { decisions: r.length, filled_mean: mean(r.map(x => x.filled)), passes_mean: mean(r.map(x => x.passes)), playouts_mean: mean(r.map(x => x.playouts)),
                   fallbacks: r.filter(x => x.fallback).length, ms_mean: mean(r.map(x => x.ms)) };
}
summary.counters = { miltank: MT.COUNTERS, rollout: R.COUNTERS };
console.log(JSON.stringify({ base: summary.base, chance: summary.chance }, null, 1));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(Object.assign({ at: new Date().toISOString(), flags: { release: RELEASE, games: GAMES, budget: BUDGET, k: K, dmg: DMG, leaf: 'heuristic', depth: 0, reserveSwitch: 1 } }, E.stamp, { summary, rows }), null, 1));
console.log('wrote ' + OUT);
