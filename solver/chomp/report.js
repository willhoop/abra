/* solver/chomp/report.js — read a finished CHOMP v0 evaluation: (a) agreement with humans, (c) exploitability.
 * (b), the arena, is read from the arena artifacts themselves (solver/arena/arena.js --plan).
 *
 *   node solver/chomp/report.js --plan solver/out/chomp/v0/plan.json [--out <dir>/report.json] [--boot 2000]
 *
 * (a) AGREEMENT — a SANITY CHECK, not an objective. On the plan's held-out TEST sides:
 *     lead pair: CHOMP's modal option leads with the human's pair (top-1), and the mix's mass on that pair;
 *     option (sides whose whole four is known): top-1 = the mix's modal option, top-5 = the five best options
 *     against their equilibrium mix; the mix's mass on the human option;
 *     REGRET: v* − the human option's win chance against their mix, inside CHOMP's own table, against the same
 *     for a uniformly random option (a human who reads the matchup at all should sit below random).
 *     Baselines: uniform, and the human prior (human_prior.js, fitted on TRAIN sides only).
 *     95% intervals: percentile bootstrap over sides, seeded.
 * (c) EXPLOITABILITY inside CHOMP's own table, per solved matchup: the mix (the LP residual), the greedy pick,
 *     the best pure option, the uniform mix, and the HUMAN's actual option (v* − its worst case). On the refine
 *     jobs: how far the MILTANK playouts moved the cells, the mix and v*, what they would have taken from the
 *     unrefined mix, and the final mix's exploitability under a bootstrap of the playouts (cell uncertainty).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const O = require('./options.js');
const SK = require('../slowking/matrix.js');
const TB = require('./tables.js');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const planFile = path.resolve(flag('--plan', path.join(__dirname, '..', 'out', 'chomp', 'v0', 'plan.json')));
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const dir = path.dirname(planFile);
const OUT = path.resolve(flag('--out', path.join(dir, 'report.json')));
const BOOT = +flag('--boot', 2000);

/* seeded uniform */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function meanCI(xs, seed) {
  const n = xs.length; if (!n) return null;
  const m = xs.reduce((s, v) => s + v, 0) / n;
  const u = rng(seed || 1), bs = [];
  for (let b = 0; b < BOOT; b++) { let s = 0; for (let k = 0; k < n; k++) s += xs[Math.floor(u() * n)]; bs.push(s / n); }
  bs.sort((a, b) => a - b);
  return { n, mean: +m.toFixed(4), ci95: [+bs[Math.floor(0.025 * BOOT)].toFixed(4), +bs[Math.floor(0.975 * BOOT) - 1].toFixed(4)] };
}
const argmax = a => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(5) : null; };
const dist = a => ({ n: a.length, mean: a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(5) : null, p10: q(a, 0.1), p50: q(a, 0.5), p90: q(a, 0.9), max: a.length ? +Math.max(...a).toFixed(5) : null });

const cache = TB.load(dir);
const D = require('./data.js');
const H = D.headers(plan.dataset.file);
if (H.pool_sha256 !== plan.dataset.pool_sha256) throw new Error('report: the dataset moved since the plan was written');
const byId = new Map(H.games.map(G => [G.id, G]));
const HP = require('./human_prior.js').fit(H.games);

/* ---------------- (a) ---------------- */
const A = { lead_top1: { chomp: [], chomp_marginal: [], hprior: [], uniform: [] }, lead_mass: { chomp: [], hprior: [] },
            opt_top1: { chomp: [], hprior: [] }, opt_top5: { chomp: [], hprior: [] }, opt_mass: { chomp: [], hprior: [] },
            regret: { human: [], random: [], hprior_modal: [], chomp_greedy: [] }, missing: 0, errors: 0 };
for (const e of plan.eval.sides) {
  const rec = cache.get(TB.jobKey(e.id, e.side, false));
  if (!rec) { A.missing++; continue; }
  if (rec.error) { A.errors++; continue; }
  const r = rec.result, G = byId.get(e.id);
  const mix = r.mix, hp = HP.probs(G.sheets[e.side]);
  const hl = O.leadPairs.findIndex(p => p.join() === G.leads[e.side].slice().sort((a, b) => a - b).join());
  const lm = new Array(15).fill(0), hlm = new Array(15).fill(0);
  mix.forEach((p, i) => { lm[O.leadPairOf[i]] += p; }); hp.forEach((p, i) => { hlm[O.leadPairOf[i]] += p; });
  A.lead_top1.chomp.push(O.leadPairOf[argmax(mix)] === hl ? 1 : 0);
  A.lead_top1.chomp_marginal.push(argmax(lm) === hl ? 1 : 0);
  A.lead_top1.hprior.push(argmax(hlm) === hl ? 1 : 0);
  A.lead_top1.uniform.push(1 / 15);
  A.lead_mass.chomp.push(lm[hl]); A.lead_mass.hprior.push(hlm[hl]);
  const ho = G.option[e.side];
  if (ho >= 0) {
    const byWin = r.win_vsMix.map((v, i) => i).sort((a, b) => r.win_vsMix[b] - r.win_vsMix[a]);
    const byHp = Array.from(hp).map((v, i) => i).sort((a, b) => hp[b] - hp[a]);
    A.opt_top1.chomp.push(argmax(mix) === ho ? 1 : 0); A.opt_top1.hprior.push(byHp[0] === ho ? 1 : 0);
    A.opt_top5.chomp.push(byWin.slice(0, 5).includes(ho) ? 1 : 0); A.opt_top5.hprior.push(byHp.slice(0, 5).includes(ho) ? 1 : 0);
    A.opt_mass.chomp.push(mix[ho]); A.opt_mass.hprior.push(hp[ho]);
    A.regret.human.push(r.value - r.win_vsMix[ho]);
    A.regret.random.push(r.value - r.win_vsMix.reduce((s, v) => s + v, 0) / 90);
    A.regret.hprior_modal.push(r.value - r.win_vsMix[byHp[0]]);
    A.regret.chomp_greedy.push(r.value - r.win_vsMix[r.greedy.i]);
  }
}
const paired = (a, b) => a.map((v, i) => v - b[i]);
const agreement = {
  note: 'SANITY CHECK only; agreement with humans is not the objective and is not a promotion test',
  sides: plan.eval.sides.length, missing: A.missing, errors: A.errors, hprior: HP.meta,
  lead_pair_top1: { chomp_modal_option: meanCI(A.lead_top1.chomp, 11), chomp_lead_marginal: meanCI(A.lead_top1.chomp_marginal, 12), hprior: meanCI(A.lead_top1.hprior, 13), uniform: +(1 / 15).toFixed(4) },
  lead_pair_mass: { chomp: meanCI(A.lead_mass.chomp, 14), hprior: meanCI(A.lead_mass.hprior, 15), uniform: +(1 / 15).toFixed(4) },
  option_sides: A.opt_top1.chomp.length,
  option_top1: { chomp: meanCI(A.opt_top1.chomp, 16), hprior: meanCI(A.opt_top1.hprior, 17), uniform: +(1 / 90).toFixed(4) },
  option_top5: { chomp_by_win_vs_mix: meanCI(A.opt_top5.chomp, 18), hprior: meanCI(A.opt_top5.hprior, 19), uniform: +(5 / 90).toFixed(4) },
  option_mass: { chomp: meanCI(A.opt_mass.chomp, 20), hprior: meanCI(A.opt_mass.hprior, 21), uniform: +(1 / 90).toFixed(4) },
  regret_in_chomp_table: { human_option: meanCI(A.regret.human, 22), random_option: meanCI(A.regret.random, 23), hprior_modal: meanCI(A.regret.hprior_modal, 24),
                           chomp_greedy: meanCI(A.regret.chomp_greedy, 25), human_minus_random_paired: meanCI(paired(A.regret.human, A.regret.random), 26) },
};

/* ---------------- (c) ---------------- */
const unref = [...cache.values()].filter(r => !r.refine && r.result);
const E = { mix: [], lp_gap: [], greedy: [], maximin: [], uniform: [], human: [], support: [], value: [], ms: [] };
for (const rec of unref) {
  const r = rec.result, x = r.exploit;
  E.mix.push(x.mix); E.lp_gap.push(x.lp_gap); E.greedy.push(x.greedy.value); E.maximin.push(x.maximin.value); E.uniform.push(x.uniform);
  E.support.push(r.support.length); E.value.push(r.value); E.ms.push(r.ms);
  const G = byId.get(rec.id), ho = G && G.option[rec.side];
  if (ho >= 0) E.human.push(r.value - r.win_worst[ho]);
}
const refs = [...cache.values()].filter(r => r.refine && r.result && r.result.refine);
const RF = { cells: [], playouts: [], rounds: [], unrefined_support_cells: [], cell_shift_mean: [], cell_shift_max: [], mix_tv_moved: [], value_shift: [],
             unrefined_mix_exploit_in_refined: [], boot_final_mix_exploit_p50: [], boot_final_mix_exploit_p95: [], ms: [] };
const colMin = (M, x) => { let m = Infinity; for (let j = 0; j < M.length; j++) { let s = 0; for (let i = 0; i < M.length; i++) s += x[i] * M[i][j]; if (s < m) m = s; } return m; };
const NB = Math.min(200, BOOT);
refs.forEach((rec, k) => {
  const r = rec.result, f = r.refine;
  RF.cells.push(f.cells); RF.playouts.push(f.playouts); RF.rounds.push(f.rounds); RF.unrefined_support_cells.push(f.unrefined_support_cells);
  RF.cell_shift_mean.push(f.cell_shift_mean); RF.cell_shift_max.push(f.cell_shift_max); RF.mix_tv_moved.push(f.mix_tv_moved);
  RF.value_shift.push(f.value_after - f.value_before); RF.unrefined_mix_exploit_in_refined.push(f.unrefined_mix_exploit_in_refined); RF.ms.push(f.ms);
  if (f.samples) {
    const Ar = TB.unpackTable(r.table_f32, 90);
    const u = rng(1000 + k), ex = [];
    for (let b = 0; b < NB; b++) {
      const Ab = Ar.map(row => row.slice());
      for (const key in f.samples) {
        const { base, v } = f.samples[key], i = Math.floor(key / 90), j = key % 90;
        let s = 0; for (let t = 0; t < v.length; t++) s += v[Math.floor(u() * v.length)];
        Ab[i][j] = (f.k0 * base + s) / (f.k0 + v.length);
      }
      const sol = SK.solveLP(Ab);
      ex.push(sol.value - colMin(Ab, r.mix));
    }
    ex.sort((a, b) => a - b);
    RF.boot_final_mix_exploit_p50.push(ex[Math.floor(0.5 * NB)]); RF.boot_final_mix_exploit_p95.push(ex[Math.floor(0.95 * NB)]);
  }
});
const exploitability = {
  note: 'inside CHOMP\'s own PORYGON2 table: v* minus the value a policy guarantees against a best reply',
  matchups: unref.length,
  mix_lp_residual: dist(E.mix), lp_gap: dist(E.lp_gap),
  greedy_vs_uniform_pick: dist(E.greedy), best_pure_maximin: dist(E.maximin), uniform_mix: dist(E.uniform), human_actual_option: dist(E.human),
  mixing_gain: dist(E.maximin), support_size: dist(E.support), value: dist(E.value), solve_ms: dist(E.ms),
  refine: { jobs: refs.length, cells: dist(RF.cells), playouts: dist(RF.playouts), rounds: dist(RF.rounds), unrefined_support_cells: dist(RF.unrefined_support_cells),
            cell_shift_mean: dist(RF.cell_shift_mean), cell_shift_max: dist(RF.cell_shift_max), mix_tv_moved: dist(RF.mix_tv_moved), value_shift: dist(RF.value_shift),
            unrefined_mix_exploit_in_refined: dist(RF.unrefined_mix_exploit_in_refined),
            final_mix_exploit_under_playout_bootstrap: { resamples: NB, p50: dist(RF.boot_final_mix_exploit_p50), p95: dist(RF.boot_final_mix_exploit_p95) }, ms: dist(RF.ms) },
};

const errors = [...cache.values()].filter(r => r.error).map(r => ({ key: r.key, error: r.error }));
const out = { plan: planFile, release: plan.release, dataset_sha256: plan.dataset.pool_sha256, jobs: plan.jobs.length, solved: cache.size, errors, agreement, exploitability, boot: BOOT };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log('wrote ' + OUT);
