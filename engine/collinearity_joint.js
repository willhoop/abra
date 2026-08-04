/* collinearity_joint.js — the same question engine/collinearity_audit.js asks of the 56 single-move
 * features, asked of the 18 PAIR features, which have never been audited.
 *
 *   SHOWDOWN_PATH=... node engine/collinearity_joint.js   ->  data/collinearity-joint.json
 *
 * WHY
 * ---
 * On 2026-08-01 the pair fit was refitted after a matcher defect was found, and NINE of the eighteen
 * pair weights changed sign. `spreadFreeBesideAlly` went -4.986 to +0.859. A vector where half the
 * coefficients can flip is a vector whose individual numbers nobody should be quoting -- and one of
 * them is being quoted: `redirectThenAttack` sits at -0.405, which reads as "humans avoid the
 * textbook Follow Me play", and that reading is currently an argument for changing board.js.
 *
 * collinearity_audit.js established the method and the caution for the 56-vector: fit each feature
 * ALONE and compare with its weight in company. A predictor that is strong alone and near-zero or
 * sign-flipped in company is not weak; its credit is being split among correlated neighbours, and
 * its individual weight is not a statement about the game. Five of the 56 are in that state. The
 * pair block was never measured, and it has more reason to be collinear, not less: `bothSameTarget`,
 * `overkill`, `focusFireKills` and `doubleKO` are nested conditions on the SAME event.
 *
 * WHAT IS DIFFERENT HERE, AND IT MATTERS
 * --------------------------------------
 * A pair feature does not compete only with the other seventeen. It competes with the SUM OF THE TWO
 * SINGLE-MOVE VECTORS, which is 56 features' worth of explanation already in the model. So "alone"
 * is measured twice:
 *
 *   alone            the pair feature and nothing else
 *   beside the sum   the pair feature plus the two-moves-decided-separately score as one column
 *
 * The second is the honest test of a pair term, because a pair feature exists to explain what the
 * independent evaluation cannot. A feature that is strong alone and dead beside the sum is not
 * being robbed by its neighbours; it is restating something the single-move vector already said.
 *
 * NOTHING HERE REFITS OR SHIPS ANYTHING. It reads data/policy-weights-joint.json and reports.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH to a built master checkout of pokemon-showdown'); process.exit(2); }
if (!B.damageEngine()) { console.error('damage engine unavailable — refusing to audit'); process.exit(1); }

const TOPK = +(process.env.TOPK || 6);
const NF = B.FEATURES.length, NJ = B.JOINT_FEATURES.length, NW = NF + NJ;
const JF = B.JOINT_FEATURES;

const WFILE = process.argv.slice(2).find(a => !a.startsWith('--')) || D('data', 'policy-weights-joint.json');
const W = JSON.parse(fs.readFileSync(WFILE, 'utf8'));
if ((W.features || []).join(',') !== B.FEATURES.join(',') ||
    (W.jointFeatures || []).join(',') !== JF.join(',')) {
  console.error('the joint weight file and board.js disagree on the feature list — refit before trusting this.');
  process.exit(1);
}
const wFull = W.weights;

const w1 = JR.loadRanker();

/* ---- build the rows once, keeping only what this file needs ---------------------------------- */
const LIMIT = (() => { const a = process.argv.find(s => s.startsWith('--games=')); return a ? +a.slice(8) : 0; })();
const { games: allGames } = FP.loadCorpus();
/* --games=N is for smoke-testing the machinery only. The artifact records how many were used, so a
 * truncated run cannot be mistaken for the real one. */
const games = LIMIT ? allGames.slice(0, LIMIT) : allGames;
console.log(`JOINT COLLINEARITY — ${games.length.toLocaleString()} clean open-sheet games` +
            (LIMIT ? ` (of ${allGames.length.toLocaleString()}; --games=${LIMIT})` : '') + `, top-${TOPK} per slot\n`);

const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const train = [], test = [];
/* Streaming moment accumulators for the 18x18 correlation matrix, over every ENUMERATED alternative
 * — not only chosen ones, because collinearity is a property of the design matrix the fit saw. */
let n = 0;
const sum = new Float64Array(NJ), cross = new Float64Array(NJ * NJ);

const { tally } = JR.build(games, dex, {
  topK: TOPK, w1,
  onRow: (r) => {
    /* offset = the two-moves-decided-separately score, MAG's behaviour before the pair model. */
    const feats = r.alts.map(v => {
      let off = 0; for (let k = 0; k < NF; k++) off += w1[k] * v[k];
      const j = new Float64Array(NJ + 1);
      j[0] = off;
      for (let k = 0; k < NJ; k++) j[k + 1] = v[NF + k];
      n++;
      for (let a = 0; a < NJ; a++) {
        const va = j[a + 1]; sum[a] += va;
        for (let b = a; b < NJ; b++) cross[a * NJ + b] += va * j[b + 1];
      }
      return j;
    });
    (hash(r.game) % 5 === 0 ? test : train).push({ feats, chosen: r.chosen });
  },
});

console.log(`  joint turns seen ${tally.turns.toLocaleString()} -> ${tally.kept.toLocaleString()} usable`);
console.log(`  ${train.length.toLocaleString()} training pairs, ${test.length.toLocaleString()} held out (split by game)`);
console.log(`  ${n.toLocaleString()} enumerated alternatives behind the correlation matrix\n`);
if (!train.length) { console.error('nothing to audit'); process.exit(1); }

/* ---- a small conditional logit over a chosen subset of columns -------------------------------- */
function fitCols(rows, cols, iters = 300, lr = 0.05) {
  const nf = cols.length;
  const w = new Array(nf).fill(0), m = new Array(nf).fill(0), v = new Array(nf).fill(0);
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let it = 1; it <= iters; it++) {
    const g = new Array(nf).fill(0);
    for (const r of rows) {
      const s = new Array(r.feats.length); let max = -Infinity;
      for (let j = 0; j < r.feats.length; j++) {
        let x = 0; const f = r.feats[j];
        for (let k = 0; k < nf; k++) x += w[k] * f[cols[k]];
        s[j] = x; if (x > max) max = x;
      }
      let z = 0; for (let j = 0; j < s.length; j++) { s[j] = Math.exp(s[j] - max); z += s[j]; }
      const fc = r.feats[r.chosen];
      for (let k = 0; k < nf; k++) g[k] += fc[cols[k]];
      for (let j = 0; j < s.length; j++) {
        const p = s[j] / z, f = r.feats[j];
        for (let k = 0; k < nf; k++) g[k] -= p * f[cols[k]];
      }
    }
    for (let k = 0; k < nf; k++) {
      const gk = g[k] / rows.length;
      m[k] = b1 * m[k] + (1 - b1) * gk;
      v[k] = b2 * v[k] + (1 - b2) * gk * gk;
      w[k] += lr * (m[k] / (1 - Math.pow(b1, it))) / (Math.sqrt(v[k] / (1 - Math.pow(b2, it))) + eps);
    }
  }
  return w;
}

/* ---- the model-free check: do people actually choose pairs with this property? ---------------- */
function lift(k) {
  let dec = 0, chosen = 0, base = 0;
  for (const r of test) {
    const N = r.feats.length;
    let hits = 0; for (const f of r.feats) if (f[k + 1] > 0.5) hits++;
    if (!hits || hits === N) continue;                 // no contrast, no information
    dec++; base += hits / N;
    if (r.feats[r.chosen][k + 1] > 0.5) chosen++;
  }
  return dec ? { dec, lift: (chosen / dec) / (base / dec) } : null;
}

/* ---- correlation matrix and VIF --------------------------------------------------------------- */
const mean = new Float64Array(NJ);
for (let a = 0; a < NJ; a++) mean[a] = sum[a] / n;
const cov = (a, b) => {
  const [i, j] = a <= b ? [a, b] : [b, a];
  return cross[i * NJ + j] / n - mean[a] * mean[b];
};
const sd = new Float64Array(NJ);
for (let a = 0; a < NJ; a++) sd[a] = Math.sqrt(Math.max(0, cov(a, a)));
const corr = (a, b) => (sd[a] > 1e-12 && sd[b] > 1e-12) ? cov(a, b) / (sd[a] * sd[b]) : 0;

/* VIF_i = 1 / (1 - R^2_i) from the inverse correlation matrix: R^2_i = 1 - 1/(C^-1)_ii.
 * Ridge-nudged so a perfectly constant feature does not make the inverse blow up rather than
 * report; the nudge is 1e-9 and is reported so nobody reads a capped VIF as a real one. */
function invert(M, sz) {
  const A = [];
  for (let i = 0; i < sz; i++) { A.push(new Float64Array(2 * sz)); for (let j = 0; j < sz; j++) A[i][j] = M[i][j]; A[i][sz + i] = 1; }
  for (let c = 0; c < sz; c++) {
    let p = c; for (let r = c + 1; r < sz; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c]; for (let j = 0; j < 2 * sz; j++) A[c][j] /= d;
    for (let r = 0; r < sz; r++) { if (r === c) continue; const f = A[r][c]; if (!f) continue; for (let j = 0; j < 2 * sz; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map(row => row.slice(sz));
}
const C = [];
for (let a = 0; a < NJ; a++) { C.push(new Float64Array(NJ)); for (let b = 0; b < NJ; b++) C[a][b] = (a === b) ? 1 + 1e-9 : corr(a, b); }
const Cinv = invert(C, NJ);

/* ---- run it ------------------------------------------------------------------------------------ */
console.log('  pair feature           alone   beside sum   in fit    human lift    VIF   verdict');
console.log('  ' + '-'.repeat(88));
const out = {};
for (let k = 0; k < NJ; k++) {
  const soloW = fitCols(train, [k + 1])[0];
  const withSum = fitCols(train, [0, k + 1])[1];
  const full = wFull[NF + k];
  const L = lift(k);
  const vif = Cinv ? Math.max(1, Cinv[k][k]) : null;
  let worst = null, worstR = 0;
  for (let b = 0; b < NJ; b++) { if (b === k) continue; const r = corr(k, b); if (Math.abs(r) > Math.abs(worstR)) { worstR = r; worst = JF[b]; } }

  /* Same verdict rule as engine/collinearity_audit.js, so the two audits are comparable. */
  let verdict = '';
  if (Math.sign(soloW) !== Math.sign(full) && Math.abs(soloW) > 0.15) verdict = 'SIGN FLIPS';
  else if (Math.abs(soloW) > 0.4 && Math.abs(full) < 0.25) verdict = 'absorbed';
  /* And the one the 56-feature audit cannot ask: did the SUM already say it? */
  if (!verdict && Math.abs(soloW) > 0.4 && Math.abs(withSum) < 0.25) verdict = 'the sum already knew';

  out[JF[k]] = {
    alone: +soloW.toFixed(4), besideSum: +withSum.toFixed(4), inFit: +full.toFixed(4),
    humanLift: L ? +L.lift.toFixed(3) : null, decisionsWithContrast: L ? L.dec : 0,
    vif: vif != null ? +vif.toFixed(2) : null,
    mostCorrelatedWith: worst, r: +worstR.toFixed(3),
    verdict: verdict || null,
  };
  console.log('  ' + JF[k].padEnd(22) +
    ((soloW >= 0 ? '+' : '') + soloW.toFixed(3)).padStart(7) + '   ' +
    ((withSum >= 0 ? '+' : '') + withSum.toFixed(3)).padStart(9) + '   ' +
    ((full >= 0 ? '+' : '') + full.toFixed(3)).padStart(7) + '   ' +
    (L ? (L.lift.toFixed(2) + 'x').padStart(9) : '        -') + '  ' +
    (vif != null ? vif.toFixed(1).padStart(6) : '     -') + '   ' + verdict);
}

const flagged = Object.entries(out).filter(([, v]) => v.verdict);
console.log('');
if (flagged.length) {
  console.log(`  ${flagged.length} of ${NJ} pair weights change character between the solo and joint fits:`);
  for (const [f, v] of flagged) console.log(`    ${f.padEnd(22)} ${v.verdict}   (most correlated with ${v.mostCorrelatedWith}, r=${v.r})`);
  console.log('  Do not read those individual weights as statements about the game.');
} else {
  console.log('  No pair weight changes character between the solo and joint fits.');
}

const pairs = [];
for (let a = 0; a < NJ; a++) for (let b = a + 1; b < NJ; b++) pairs.push([JF[a], JF[b], corr(a, b)]);
pairs.sort((x, y) => Math.abs(y[2]) - Math.abs(x[2]));
console.log('\n  most correlated pairs of pair features:');
for (const [a, b, r] of pairs.slice(0, 8)) console.log(`    ${a.padEnd(22)} ${b.padEnd(22)} r = ${(r >= 0 ? '+' : '') + r.toFixed(3)}`);

/* How often does each pair feature fire at all? A weight fitted on almost nothing is a different
 * problem from a weight fitted on a lot and split, and the two look identical in a table. */
console.log('\n  how often each fires, over enumerated alternatives:');
const rates = JF.map((f, k) => [f, mean[k]]).sort((a, b) => b[1] - a[1]);
for (const [f, m] of rates) console.log(`    ${f.padEnd(22)} ${(100 * m).toFixed(2)}%`);

fs.writeFileSync(D('data', 'collinearity-joint.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/collinearity_joint.js',
  what: 'Each PAIR feature fitted alone, and again beside the two-moves-decided-separately score, '
      + 'versus its weight in the full 74-weight fit — with a model-free lift and a VIF. The pair '
      + 'block had never been audited; nine of its eighteen weights changed sign on 2026-08-01.',
  weights_file: path.relative(ROOT, WFILE),
  topK: TOPK,
  corpus: { games: games.length, ofTotal: allGames.length, train: train.length, held_out: test.length, alternatives: n },
  matching: tally,
  features: out,
  fireRate: Object.fromEntries(JF.map((f, k) => [f, +mean[k].toFixed(5)])),
  topCorrelations: pairs.slice(0, 20).map(([a, b, r]) => ({ a, b, r: +r.toFixed(4) })),
  caveat: 'Collinear coefficients can be individually meaningless while the MODEL is well calibrated, '
        + 'because the correlated block still carries the right total. This is not evidence the pair '
        + 'model predicts badly. It is evidence about which single pair weights can be quoted.',
}, null, 1) + '\n');
console.log('\n  -> data/collinearity-joint.json');
