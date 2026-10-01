/* ABRA-HEAP: 3072
 * solver/hypno/eval_offline.js — HYPNO v1's offline check on the search's OWN recorded tables of held-out human decisions
 * (solver/gary/preregistration.json hypno_offline). Reads a finished run; plays, steps and searches nothing.
 *
 *   node solver/hypno/eval_offline.js --model solver/gary/model/gary-v1.json --human <the rebuilt games.jsonl> \
 *        [--roots solver/results/2026-10-01-gary-hypno/roots-human-s1] [--out <file>]
 *
 * Each recorded root (solver/gary/roots.js) is re-oriented so that WE are its column side: our table B = 1 - A^T, our
 * playout counts cnt^T, and the human is the opponent whose joint GARY predicts over the human's candidate rows. sigma* is
 * SLOWKING's plain solve of B (solveRM, 4,000 iterations, tol 1e-4: the search's own solve). Then, per variant of the
 * response rule (solver/hypno/hypno.js respond):
 *   predicted gain   x_play.B.h_eff - x*.B.h_eff                    (what the model says the deviation buys)
 *   REALISED gain    (x_play - x*).B[:, human]                       (against what the human actually clicked; only where
 *                                                                     the human's joint is one of the table's rows)
 *   vs equilibrium   (x_play - x*).B.y*                              (the cost if the opponent plays the table's equilibrium)
 *   worst case       v* - min_j (x_play.B)_j                         (what a best-responding opponent could take)
 * Variants: HYPNO as shipped (GARY, its gates, w = w0); the same with w = 1; GARY with every gate off (the raw best
 * response); DODUO v1 as the model with the same SE and coverage gates and no cell gate. CIs: bootstrap over games, 2,000,
 * seed 1; the realised gain is also reported less its SELECTION BIAS (a parametric bootstrap, --debias N, default 200).
 * And the prediction question: how often GARY's probability of the human's joint beats tau*'s and DODUO v1's.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const S = require('../gary/situation.js');
const R = require('../gary/roots.js');
const H = require('./hypno.js');
const SK = require('../slowking/matrix.js');
const { clusterCI } = require('../gary/fit.js');
const F0 = require('../prior/features.js');

async function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const ROOT = path.join(__dirname, '..', '..');
  const MODEL = path.resolve(ROOT, flag('--model', 'solver/gary/model/gary-v1.json'));
  const HUMAN = path.resolve(flag('--human', null));
  const ROOTS = path.resolve(ROOT, flag('--roots', 'solver/results/2026-10-01-gary-hypno/roots-human-s1'));
  const OUT = path.resolve(ROOT, flag('--out', MODEL.replace(/\.json$/, '.hypno-offline.json')));
  const DEBIAS = +flag('--debias', 200);
  const GARY = require('../gary/infer.js').load({ model: MODEL });
  const w0 = GARY.M.mixture_w0 == null ? 1 : GARY.M.mixture_w0;
  const recs = R.load(ROOTS).filter(R.usable);
  const games = await R.gamesFor(HUMAN, recs);
  const C = { usable: recs.length, used: 0, no_game: 0, key_mismatch: 0, not_exact: 0, unmapped_rows: 0 };
  const items = [];
  for (const r of recs) {
    const g = games.get(r.id);
    if (!g) { C.no_game++; continue; }
    if (R.humanKey(r, g) !== r.human) { C.key_mismatch++; continue; }
    const band = S.band(g.game, r.p);
    const pr = GARY.predict(g, r.ti, r.p, { band });
    if (F0.jointStatus(pr.decision) !== 'exact') { C.not_exact++; continue; }
    const cells = R.rowCells(r, g, pr.decision);
    const cp = new Map(pr.cells.map(c => [c.a + ',' + c.b, c]));
    const hG = cells.map(c => (c && cp.get(c[0] + ',' + c[1]) ? cp.get(c[0] + ',' + c[1]).p : 0));
    const hD = cells.map(c => (c && cp.get(c[0] + ',' + c[1]) ? cp.get(c[0] + ',' + c[1]).doduo : 0));
    C.unmapped_rows += cells.filter(c => !c).length;
    const m = r.A.length, n = r.A[0].length;
    const B = Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => 1 - r.A[i][j]));
    const cntB = Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => r.cnt[i][j]));
    const sol = SK.solveRM(B, { iters: 4000, tol: 1e-4 });
    const d = pr.decision, la = d.slots[0] ? d.slots[0].label.set[0] : 0, lb = d.slots[1] ? d.slots[1].label.set[0] : 0;
    const hc = cp.get(la + ',' + lb);
    items.push({ r, cell: pr.cell, trusted: pr.trusted, B, cntB, sol, hG, hD, pHuman: { gary: hc.p, doduo: hc.doduo, tau: r.hrow >= 0 ? r.x[r.hrow] : 0 } });
    C.used++;
  }
  const VARIANTS = {
    hypno: { model: 'gary', gate: true, w: w0, opts: {} },
    hypno_w1: { model: 'gary', gate: true, w: 1, opts: {} },
    gary_raw_br: { model: 'gary', gate: false, w: 1, opts: { kSE: -Infinity, minCover: 0 } },
    doduo_v1: { model: 'doduo', gate: false, w: 1, opts: {} },
    doduo_v1_raw_br: { model: 'doduo', gate: false, w: 1, opts: { kSE: -Infinity, minCover: 0 } },
    hypno_eps01: { model: 'gary', gate: true, w: w0, opts: { eps: 0.01 } },
  };
  const out = { generator: 'solver/hypno/eval_offline.js', model: path.relative(ROOT, MODEL).replace(/\\/g, '/'), roots: path.relative(ROOT, ROOTS).replace(/\\/g, '/'), human: HUMAN, counts: C, w0, variants: {} };
  for (const [name, V] of Object.entries(VARIANTS)) {
    const reasons = {}, pred = [], real = [], realKeys = [], vsEq = [], worst = [], keys = [], tvs = [];
    let dev = 0, devCovered = 0;
    for (const it of items) {
      const hCols = V.model === 'gary' ? it.hG : it.hD;
      const rr = H.respond({ A: it.B, cnt: it.cntB, x: it.sol.x, y: it.sol.y, hCols, hMass: 1, trusted: V.gate ? it.trusted : true, w: V.w }, V.opts);
      reasons[rr.reason] = (reasons[rr.reason] || 0) + 1;
      const played = rr.reason === 'played';
      if (played) dev++;
      const dx = played ? rr.x.map((v, i) => v - it.sol.x[i]) : null;
      pred.push(played ? rr.gainPlayed : 0); worst.push(rr.worst); tvs.push(rr.tv); keys.push(it.r.id);
      let ve = 0; if (dx) for (let i = 0; i < dx.length; i++) for (let j = 0; j < it.sol.y.length; j++) ve += dx[i] * it.B[i][j] * it.sol.y[j];
      vsEq.push(ve);
      if (it.r.hrow >= 0) {
        let g = 0; if (dx) for (let i = 0; i < dx.length; i++) g += dx[i] * it.B[i][it.r.hrow];
        real.push(g); realKeys.push(it.r.id); if (played) devCovered++;
      }
    }
    const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const ciR = clusterCI(real, realKeys), ciE = clusterCI(vsEq, keys);
    /* SELECTION BIAS of the realised gain: the response is chosen on the same noisy cells it is scored on (a winner's curse).
     * Parametric bootstrap (--debias N draws): A* = B + N(0, B(1-B)/n) per cell, clipped to [0, 1]; the response and sigma*
     * re-made on A*; bias = mean[(x_play* - x**).A*[:, human] - (x_play* - x**).B[:, human]]. The debiased realised gain is the
     * realised gain less that bias, per decision, with the same game-clustered CI. The variance bound overstates CRN noise, so
     * this correction is if anything too large. */
    let deb = null;
    if (DEBIAS > 0) {
      let sd = 12345; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-300)) * Math.cos(2 * Math.PI * rnd());
      const adj = [];
      for (const it of items) {
        if (it.r.hrow < 0) continue;
        const hCols = V.model === 'gary' ? it.hG : it.hD;
        const m = it.B.length, n = it.B[0].length, h = it.r.hrow;
        let bias = 0;
        for (let b = 0; b < DEBIAS; b++) {
          const As = it.B.map((row, i) => row.map((v, j) => Math.min(1, Math.max(0, v + gauss() * Math.sqrt(v * (1 - v) / Math.max(1, it.cntB[i][j]))))));
          const so = SK.solveRM(As, { iters: 4000, tol: 1e-4 });
          const rs = H.respond({ A: As, cnt: it.cntB, x: so.x, y: so.y, hCols, hMass: 1, trusted: V.gate ? it.trusted : true, w: V.w }, V.opts);
          if (rs.reason !== 'played') continue;
          for (let i = 0; i < m; i++) { const dxi = rs.x[i] - so.x[i]; bias += dxi * (As[i][h] - it.B[i][h]); }
        }
        adj.push(bias / DEBIAS);
      }
      const dr = real.map((v, i) => v - adj[i]);
      const c = clusterCI(dr, realKeys);
      deb = { draws: DEBIAS, mean_bias: +mean(adj).toFixed(5), realised_debiased: { mean: +c.mean.toFixed(5), ci: [+c.lo.toFixed(5), +c.hi.toFixed(5)] } };
    }
    out.variants[name] = {
      reasons, deviated: dev, of: items.length, deviated_covered: devCovered, covered: real.length,
      predicted_gain_mean: +mean(pred).toFixed(5),
      realised_gain_covered: { mean: +ciR.mean.toFixed(5), ci: [+ciR.lo.toFixed(5), +ciR.hi.toFixed(5)], n: real.length, games: ciR.clusters },
      vs_equilibrium_opponent: { mean: +ciE.mean.toFixed(5), ci: [+ciE.lo.toFixed(5), +ciE.hi.toFixed(5)] },
      worst_case_mean: +mean(worst).toFixed(5), worst_case_max: +Math.max(0, ...worst).toFixed(5), tv_mean: +mean(tvs).toFixed(4),
      selection_bias: deb,
    };
    if (deb) console.log(`  ${name.padEnd(16)} selection bias ${deb.mean_bias}; realised debiased ${deb.realised_debiased.mean} [${deb.realised_debiased.ci}]`);
    console.log(`  ${name.padEnd(16)} deviated ${dev}/${items.length}  pred ${mean(pred).toFixed(4)}  realised ${ciR.mean.toFixed(4)} [${ciR.lo.toFixed(4)}, ${ciR.hi.toFixed(4)}] (n ${real.length})  vsEq ${ciE.mean.toFixed(4)}  worst ${mean(worst).toFixed(4)} max ${Math.max(0, ...worst).toFixed(3)}  ${JSON.stringify(reasons)}`);
  }
  const FL = 1e-4, lg = v => Math.log(Math.max(FL, v));
  const cov = items.filter(it => it.r.hrow >= 0);
  /* on the covered roots, both models conditioned on the table's rows: GARY renormalised over the rows vs tau* (x) */
  const cond = cov.map(it => { const s = it.hG.reduce((a, b) => a + b, 0); const sd = it.hD.reduce((a, b) => a + b, 0); return { g: s > 0 ? it.hG[it.r.hrow] / s : 0, d: sd > 0 ? it.hD[it.r.hrow] / sd : 0, t: it.r.x[it.r.hrow] }; });
  out.prediction = {
    n: items.length,
    all_cells: { gary_beats_tau: items.filter(it => Math.max(FL, it.pHuman.gary) > Math.max(FL, it.pHuman.tau)).length, gary_beats_doduo_v1: items.filter(it => it.pHuman.gary > it.pHuman.doduo).length,
                 mean_log: { gary: +(items.reduce((s, it) => s + lg(it.pHuman.gary), 0) / items.length).toFixed(4), doduo_v1: +(items.reduce((s, it) => s + lg(it.pHuman.doduo), 0) / items.length).toFixed(4), tau: +(items.reduce((s, it) => s + lg(it.pHuman.tau), 0) / items.length).toFixed(4) } },
    table_rows_covered: { n: cov.length, gary_beats_tau: cond.filter(c => Math.max(FL, c.g) > Math.max(FL, c.t)).length, gary_beats_doduo_v1: cond.filter(c => c.g > c.d).length,
                          mean_log: { gary: +(cond.reduce((s, c) => s + lg(c.g), 0) / Math.max(1, cond.length)).toFixed(4), doduo_v1: +(cond.reduce((s, c) => s + lg(c.d), 0) / Math.max(1, cond.length)).toFixed(4), tau: +(cond.reduce((s, c) => s + lg(c.t), 0) / Math.max(1, cond.length)).toFixed(4) } },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('hypno/eval_offline: ' + JSON.stringify(C) + '; prediction ' + JSON.stringify(out.prediction));
}
main().catch(e => { console.error(e); process.exit(1); });
