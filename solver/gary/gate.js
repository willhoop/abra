/* ABRA-HEAP: 3072
 * solver/gary/gate.js — the tau* clause of GARY's per-cell gate, the final verdicts, and the mixture weight w0.
 *
 *   node solver/gary/gate.js --model solver/gary/model/gary-v1.json --human <the rebuilt games.jsonl> \
 *        [--roots solver/results/2026-10-01-gary-hypno/roots-human-s1]
 *
 * Reads the fitted model and its DODUO clause (solver/gary/fit.js -> <model>.fit-metrics.json), then the RECORDED roots
 * (solver/gary/roots.js; a finished run, nothing is searched): for each, GARY's probability of the human's joint at the
 * root's own band against tau* = the plain solve's row mix at the human's row (0 when the human's joint is not a row),
 * both floored at 1e-4 (the 1.34.0 convention). Pooling and the PASS rule are solver/gary/preregistration.json's.
 * Writes the verdicts INTO the model (model.gate[cell] = { p, doduo, tau }) and <model>.gate-metrics.json.
 *
 * w0, the in-series mixture weight's prior (preregistration in_series.mixture_weight): the maximum-likelihood w of
 * w * GARY + (1 - w) * tau* over the roots, written to model.mixture_w0.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const S = require('./situation.js');
const R = require('./roots.js');
const { clusterCI } = require('./fit.js');
const F0 = require('../prior/features.js');

const FLOOR = 1e-4, MIN_N = 20;

async function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const ROOT = path.join(__dirname, '..', '..');
  const MODEL = path.resolve(ROOT, flag('--model', 'solver/gary/model/gary-v1.json'));
  const HUMAN = path.resolve(flag('--human', null));
  const ROOTS = path.resolve(ROOT, flag('--roots', 'solver/results/2026-10-01-gary-hypno/roots-human-s1'));
  const fm = JSON.parse(fs.readFileSync(MODEL.replace(/\.json$/, '.fit-metrics.json'), 'utf8'));
  const GARY = require('./infer.js').load({ model: MODEL });
  const all = R.load(ROOTS), recs = all.filter(R.usable);
  const games = await R.gamesFor(HUMAN, recs);
  const C = { roots: all.length, usable: recs.length, no_game: 0, key_mismatch: 0, not_exact: 0, label_cell_missing: 0, used: 0 };
  const per = [];
  for (const r of recs) {
    const g = games.get(r.id);
    if (!g) { C.no_game++; continue; }
    if (R.humanKey(r, g) !== r.human) { C.key_mismatch++; continue; }
    const band = S.band(g.game, r.p);
    const pr = GARY.predict(g, r.ti, r.p, { band });
    if (F0.jointStatus(pr.decision) !== 'exact') { C.not_exact++; continue; }
    const d = pr.decision;
    const la = d.slots[0] ? d.slots[0].label.set[0] : 0, lb = d.slots[1] ? d.slots[1].label.set[0] : 0;
    const cell = pr.cells.find(c => c.a === la && c.b === lb);
    if (!cell) { C.label_cell_missing++; continue; }
    const tau = r.hrow >= 0 ? r.x[r.hrow] : 0;
    per.push({ id: r.id, ti: r.ti, p: r.p, bucket: pr.bucket, band, cell: pr.cell, gary: cell.p, doduo: cell.doduo, tau, gen5: r.doduo_p, hrow: r.hrow });
    C.used++;
  }
  const lg = v => Math.log(Math.max(FLOOR, v));
  const verdictTau = sel => {
    const v = sel.map(x => -lg(x.gary) + lg(x.tau)), k = sel.map(x => x.id);
    const ci = clusterCI(v, k);
    return { n: sel.length, games: ci.clusters, delta: +ci.mean.toFixed(4), ci: [+ci.lo.toFixed(4), +ci.hi.toFixed(4)], pass: ci.hi < 0 };
  };
  const globalTau = verdictTau(per);
  const bucketTau = Object.fromEntries(S.BUCKETS.map(b => [b, verdictTau(per.filter(x => x.bucket === b))]));
  const gate = {}, cellTau = {};
  for (const b of S.BUCKETS) for (const n of S.BANDS) {
    const key = b + '|' + n;
    const own = per.filter(x => x.cell === key);
    let tau, from;
    if (own.length >= MIN_N) { tau = verdictTau(own); from = 'cell'; }
    else if (bucketTau[b].n >= MIN_N) { tau = bucketTau[b]; from = 'bucket'; }
    else { tau = globalTau; from = 'all'; }
    cellTau[key] = Object.assign({ from }, tau);
    const dc = fm.cells[key] || { n: 0, pass_doduo: false };
    const p = dc.pass_doduo && tau.pass ? 1 : 0;
    gate[key] = { p, doduo: { n: dc.n, games: dc.games, delta: dc.delta, ci: dc.ci, pass: !!dc.pass_doduo }, tau: { from, n: tau.n, delta: tau.delta, ci: tau.ci, pass: tau.pass } };
  }
  /* w0: ML mixture weight of GARY vs tau* on the roots (golden-section on a concave 1-d log-likelihood) */
  const ll = w => per.reduce((s, x) => s + Math.log(Math.max(FLOOR, w * x.gary + (1 - w) * x.tau)), 0);
  let lo = 0, hi = 1;
  for (let it = 0; it < 80; it++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (ll(m1) < ll(m2)) lo = m1; else hi = m2; }
  const w0 = +((lo + hi) / 2).toFixed(4);
  /* how GARY's p of the human joint compares, root by root */
  const beats = (a, b) => per.filter(x => Math.max(FLOOR, x[a]) > Math.max(FLOOR, x[b])).length;
  const mean = f => per.reduce((s, x) => s + f(x), 0) / Math.max(1, per.length);
  const passing = Object.entries(gate).filter(([, v]) => v.p === 1).map(([k]) => k);
  /* Bonferroni over 48 cells, reported beside the verdict: the DODUO clause's CI at 1 - 0.05/48 is not recomputed here;
   * it is approximated by requiring the 95% upper bound below zero by a margin of the half-width * (z_0.99948/z_0.975 - 1) */
  const zr = 3.30 / 1.96;
  const bonf = Object.entries(gate).filter(([, v]) => v.p === 1 && v.doduo.ci && (v.doduo.delta + (v.doduo.ci[1] - v.doduo.delta) * zr) < 0).map(([k]) => k);
  const metrics = {
    generator: 'solver/gary/gate.js', model: path.relative(ROOT, MODEL).replace(/\\/g, '/'), roots: path.relative(ROOT, ROOTS).replace(/\\/g, '/'), human: HUMAN, counts: C,
    floor: FLOOR, min_n: MIN_N,
    roots_prediction: {
      n: per.length, mean_log_gary: +mean(x => lg(x.gary)).toFixed(4), mean_log_doduo_v1: +mean(x => lg(x.doduo)).toFixed(4), mean_log_tau: +mean(x => lg(x.tau)).toFixed(4),
      mean_log_gen5_doduo: +mean(x => lg(x.gen5 || 0)).toFixed(4),
      gary_beats_tau: beats('gary', 'tau'), gary_beats_doduo_v1: beats('gary', 'doduo'), gary_ties_doduo_v1: per.filter(x => Math.abs(x.gary - x.doduo) < 1e-12).length,
      covered: per.filter(x => x.hrow >= 0).length,
    },
    tau_global: globalTau, tau_by_bucket: bucketTau, tau_by_cell: cellTau,
    gate, passing_cells: passing, passing_cells_bonferroni_approx: bonf, mixture_w0: w0,
  };
  const model = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
  model.gate = gate; model.mixture_w0 = w0;
  model.gate_rule = 'p = 1 iff the DODUO clause (fit.js, EVAL rows) AND the tau* clause (gate.js, recorded roots) both PASS; solver/gary/preregistration.json';
  fs.writeFileSync(MODEL, JSON.stringify(model, null, 1));
  fs.writeFileSync(MODEL.replace(/\.json$/, '.gate-metrics.json'), JSON.stringify(metrics, null, 1));
  console.log('gary/gate: ' + JSON.stringify(C));
  console.log(`gary/gate: roots mean log p  GARY ${metrics.roots_prediction.mean_log_gary}  DODUO v1 ${metrics.roots_prediction.mean_log_doduo_v1}  tau* ${metrics.roots_prediction.mean_log_tau}; GARY > tau* on ${metrics.roots_prediction.gary_beats_tau}/${per.length}, > DODUO v1 on ${metrics.roots_prediction.gary_beats_doduo_v1}`);
  console.log(`gary/gate: tau* global ${JSON.stringify(globalTau)}; w0 ${w0}`);
  console.log(`gary/gate: ${passing.length} of ${Object.keys(gate).length} cells p = 1: ${passing.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
