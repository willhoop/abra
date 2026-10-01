/* ABRA-HEAP: 4096
 * solver/gary/eval_series.js — does an in-series update of GARY toward THIS opponent predict games 2-3 better than the
 * population model? (solver/gary/preregistration.json in_series; store-only, no simulator.)
 *
 *   node solver/gary/eval_series.js --data solver/out/gary/<tag> --model solver/gary/model/gary-v1.json
 *
 * A series is (bo3 series id, player). For each game g >= 2 of a series, the opponent's decisions in games < g give a MAP
 * deviation delta (solver/hypno/series.js mapDelta: N(0, sigma^2) prior, each older game's rows weighted gamma per game
 * back), and each decision of game g is scored under population + delta against population alone. sigma and gamma are
 * chosen on FIT series; the verdict is read on EVAL (TEST-player) series, 95% CI by bootstrap over SERIES. The result is
 * written INTO the model (model.in_series = { enabled, sigma, gamma, ... }) and to <model>.series-metrics.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const FIT = require('./fit.js');
const SR = require('../hypno/series.js');
const S = require('./situation.js');

const SIGMAS = [0.05, 0.1, 0.2, 0.4, 0.8], GAMMAS = [0.5, 1.0];

function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const ROOT = path.join(__dirname, '..', '..');
  const DATA = flag('--data', null).split(',').map(d => path.resolve(ROOT, d));
  const MODEL = path.resolve(ROOT, flag('--model', 'solver/gary/model/gary-v1.json'));
  const model = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
  const D = FIT.load(DATA);
  const NF = FIT.NF;
  const effOf = r => {
    const out = new Float64Array(NF);
    for (const v of [model.params.global, model.params.bucket[r.b], model.params.band[r.band], model.params.cell[r.b + '|' + r.band]]) if (v) for (let f = 0; f < NF; f++) out[f] += v[f];
    return out;
  };
  /* group rows into series (bo3 only: a series id and a game number) */
  const series = new Map();
  D.rows.forEach((r, i) => {
    if (!r.ser || !(r.gn >= 1) || r.band === 'bo1') return;
    const k = r.ser + '|' + r.pl;
    if (!series.has(k)) series.set(k, { role: r.role, rows: [] });
    series.get(k).rows.push(i);
  });
  const obsOf = i => { const r = D.rows[i]; return { gn: r.gn, lp: Float64Array.from(D.LP.subarray(r.off, r.off + r.K)), bits: D.BI.subarray(r.off, r.off + r.K), lab: r.lab, eff: effOf(r) }; };
  const multi = [...series.entries()].filter(([, s]) => new Set(s.rows.map(i => D.rows[i].gn)).size >= 2);
  console.log(`gary/eval_series: ${series.size} series-players, ${multi.length} with >= 2 games`);

  function evaluate(role, sigma, gamma) {
    const out = [];   // { key, d } per scored decision
    for (const [key, s] of multi) {
      if (s.role !== role) continue;
      const gns = [...new Set(s.rows.map(i => D.rows[i].gn))].sort((a, b) => a - b);
      const obsAll = s.rows.map(obsOf);
      for (const g of gns) {
        if (g < 2) continue;
        const prior = obsAll.filter(o => o.gn < g).map(o => Object.assign({}, o, { w: Math.pow(gamma, g - o.gn - 1) }));
        if (!prior.length) continue;
        const delta = SR.mapDelta(prior, sigma);
        for (const o of obsAll) {
          if (o.gn !== g) continue;
          const p0 = SR.scores(o.lp, o.bits, o.eff, null)[o.lab], p1 = SR.scores(o.lp, o.bits, o.eff, delta)[o.lab];
          out.push({ key, d: -Math.log(p1) + Math.log(p0), g });
        }
      }
    }
    return out;
  }
  const t0 = Date.now();
  const grid = [];
  for (const sg of SIGMAS) for (const gm of GAMMAS) {
    const e = evaluate('fit', sg, gm);
    grid.push({ sigma: sg, gamma: gm, n: e.length, mean: e.reduce((s, x) => s + x.d, 0) / Math.max(1, e.length) });
    console.log(`  fit sigma ${sg} gamma ${gm}: n ${e.length} mean ${grid[grid.length - 1].mean.toFixed(5)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const best = grid.reduce((a, b) => (b.mean < a.mean ? b : a));
  const ev = evaluate('eval', best.sigma, best.gamma);
  const ci = FIT.clusterCI(ev.map(x => x.d), ev.map(x => x.key));
  const byGame = {};
  for (const g of [2, 3]) { const sel = ev.filter(x => x.g === g); const c = FIT.clusterCI(sel.map(x => x.d), sel.map(x => x.key)); byGame[g] = { n: sel.length, mean: +c.mean.toFixed(5), ci: [+c.lo.toFixed(5), +c.hi.toFixed(5)] }; }
  const enabled = ci.hi < 0 && best.mean < 0;
  const res = { generator: 'solver/gary/eval_series.js', model: path.relative(ROOT, MODEL).replace(/\\/g, '/'), grid, chosen: { sigma: best.sigma, gamma: best.gamma, fit_mean: +best.mean.toFixed(5) },
    eval: { n: ev.length, series: ci.clusters, mean: +ci.mean.toFixed(5), ci: [+ci.lo.toFixed(5), +ci.hi.toFixed(5)], by_game: byGame }, enabled,
    rule: 'ENABLED iff the EVAL CI upper bound < 0 (and the FIT mean at the chosen point < 0); solver/gary/preregistration.json in_series' };
  model.in_series = { enabled, sigma: best.sigma, gamma: best.gamma, eval: res.eval };
  fs.writeFileSync(MODEL, JSON.stringify(model, null, 1));
  fs.writeFileSync(MODEL.replace(/\.json$/, '.series-metrics.json'), JSON.stringify(res, null, 1));
  console.log(`gary/eval_series: chose sigma ${best.sigma} gamma ${best.gamma}; EVAL delta ${res.eval.mean} [${res.eval.ci}] over ${res.eval.series} series, ${res.eval.n} decisions -> ${enabled ? 'ENABLED' : 'NOT enabled'}`);
}

main();
