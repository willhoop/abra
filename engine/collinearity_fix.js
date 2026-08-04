/* collinearity_fix.js — can the kill block be repaired, and does repairing it help?
 *
 *   SHOWDOWN_PATH=... node engine/collinearity_fix.js
 *
 * THE PROBLEM, established by engine/collinearity_audit.js
 * -------------------------------------------------------
 * Five features are strong alone and destroyed in company:
 *
 *     koTarget     +0.764 alone  ->  -0.206 in the fit    SIGN FLIPS
 *     koFirst      +0.902        ->  +0.089               absorbed
 *     killsThreat  +0.584        ->  -0.098               SIGN FLIPS
 *     dmgFrac      +0.648        ->  -0.004               SIGN FLIPS
 *     movesFirst   +0.412        ->  +0.127               absorbed
 *
 * They are inter-correlated at 0.5-0.67 and the regularisation selected on held-out likelihood is
 * zero, so the coefficients are unconstrained and the credit splits arbitrarily. Model-free, humans
 * pick a killing move at 1.41x the base rate and a kill-and-move-first at 1.82x, so the signal is
 * real and the fit is throwing it away.
 *
 * WHAT THIS TESTS, AND THE HONEST BAR IT HAS TO CLEAR
 * --------------------------------------------------
 * Three repairs, each a refit on the SAME decisions and the SAME held-out split, so the only thing
 * that varies is the treatment:
 *
 *   RIDGE      keep all 48 features, sweep lambda past the range fit_policy searches. Shrinkage
 *              toward zero is the textbook stabiliser for collinear predictors.
 *   COLLAPSE   replace the four kill features with ONE, their first principal direction, so the
 *              block contributes a single coefficient that cannot be split.
 *   DROP       keep koTarget and delete koFirst, killsThreat and dmgFrac outright, on the argument
 *              that four noisy measurements of "this removes the target" are worse than one.
 *
 * THE BAR: a repair must not cost held-out likelihood. Making coefficients pretty at the price of
 * prediction is not a fix, it is a preference. This file reports held-out logL and top-1 for every
 * variant and states plainly if the baseline wins -- which is a real possible outcome, because
 * lambda = 0 was SELECTED on held-out data and is therefore already the best of its family.
 *
 * NOTHING IS SHIPPED FROM HERE. It writes a report, not weights. Changing the shipped vector is a
 * decision about a model people quote, and it belongs to Will.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const F = require('./fit_policy.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH'); process.exit(2); }

const I = B.FEATURE_INDEX;
const KILL = ['koTarget', 'koFirst', 'killsThreat', 'dmgFrac'];
const ITERS = 300;

console.log('COLLINEARITY REPAIR — can the kill block be fixed without losing prediction?\n');

const { games } = F.loadCorpus();
const tally = { seen: 0, kept: 0, trivial: 0, noSheet: 0, unmatched: 0, ambiguous: 0, noUser: 0 };
let rows = [];
for (const g of games) rows = rows.concat(F.decisionsFor(g, tally));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const train = rows.filter(r => hash(r.game) % 5 !== 0);
const test = rows.filter(r => hash(r.game) % 5 === 0);
console.log(`  ${train.length.toLocaleString()} train / ${test.length.toLocaleString()} held out, split by GAME\n`);

/* fit_policy.logLik already returns BOTH the mean log-likelihood and top-1 accuracy as {ll, acc}.
 * A first version of this file recomputed accuracy in a second pass and then called .toFixed on the
 * object -- a crash that cost a run. Use what the fitter already gives back. */
const evalOn = (rowsIn, w) => { const r = F.logLik(rowsIn, w); return { ll: r.ll, top1: 100 * r.acc }; };
const report = (name, w, tr, te, note) =>
  console.log(`  ${name.padEnd(26)} logL ${te.toFixed(4)}   top-1 ${tr.toFixed(2)}%   ${note || ''}`);

/* ---- 0. baseline, all 48, the shipped setting ------------------------------------------------ */
const nf = B.FEATURES.length;
const results = {};
{
  const w = F.fit(train, nf, 0, ITERS);
  const e = evalOn(test, w);
  results.baseline = { logL: e.ll, top1: e.top1, kill: KILL.map(k => +w[I[k]].toFixed(3)) };
  report('baseline (lambda 0)', w, e.top1, e.ll);
  console.log(`    kill block: ${KILL.map((k, i) => `${k} ${results.baseline.kill[i] >= 0 ? '+' : ''}${results.baseline.kill[i]}`).join(', ')}`);
}

/* ---- 1. ridge, swept past fit_policy's range -------------------------------------------------- */
console.log('\n  RIDGE — shrink the whole vector and see what it costs');
results.ridge = [];
for (const lam of [1e-3, 1e-2, 3e-2, 1e-1, 3e-1]) {
  const w = F.fit(train, nf, lam, ITERS);
  const e = evalOn(test, w);
  const kill = KILL.map(k => +w[I[k]].toFixed(3));
  const signsFixed = kill.every(v => v >= 0);
  results.ridge.push({ lambda: lam, logL: e.ll, top1: e.top1, kill, signsFixed });
  report(`lambda ${lam}`, w, e.top1, e.ll, signsFixed ? '<- all kill signs positive' : '');
}

/* ---- 2. collapse the block to its first principal direction ---------------------------------- */
/* One coefficient instead of four means there is nothing to split. The direction is estimated from
 * the TRAINING candidates only, so the held-out set stays untouched by the construction. */
console.log('\n  COLLAPSE — the four kill features become one');
{
  const idx = KILL.map(k => I[k]);
  const mu = idx.map(() => 0); let n = 0;
  for (const r of train) for (const x of r.feats) { idx.forEach((j, q) => mu[q] += x[j]); n++; }
  for (let q = 0; q < mu.length; q++) mu[q] /= n;
  /* Power iteration for the leading eigenvector of the covariance — four dimensions, so this is
   * exact enough in a handful of passes and avoids adding a linear-algebra dependency. */
  let v = idx.map(() => 1 / Math.sqrt(idx.length));
  for (let it = 0; it < 40; it++) {
    const acc = idx.map(() => 0);
    for (const r of train) for (const x of r.feats) {
      let dot = 0; idx.forEach((j, q) => dot += (x[j] - mu[q]) * v[q]);
      idx.forEach((j, q) => acc[q] += (x[j] - mu[q]) * dot);
    }
    const nrm = Math.sqrt(acc.reduce((a, b) => a + b * b, 0)) || 1;
    v = acc.map(a => a / nrm);
  }
  /* Orient it so a bigger projection means MORE killing, otherwise the sign of the reported
   * coefficient is an artefact of power iteration rather than of the game. */
  if (v.reduce((a, b) => a + b, 0) < 0) v = v.map(a => -a);
  const proj = x => { let d = 0; idx.forEach((j, q) => d += (x[j] - mu[q]) * v[q]); return d; };
  const keep = B.FEATURES.map((f, i) => i).filter(i => !idx.includes(i));
  const remap = rs => rs.map(r => ({
    feats: r.feats.map(x => { const y = keep.map(i => x[i]); y.push(proj(x)); return y; }),
    chosen: r.chosen, game: r.game,
  }));
  const trC = remap(train), teC = remap(test);
  const w = F.fit(trC, keep.length + 1, 0, ITERS);
  const e = evalOn(teC, w);
  results.collapse = { logL: e.ll, top1: e.top1, killCoef: +w[keep.length].toFixed(3), direction: v.map(a => +a.toFixed(3)) };
  report('collapsed to 1 feature', w, e.top1, e.ll, `kill coefficient ${w[keep.length] >= 0 ? '+' : ''}${w[keep.length].toFixed(3)}`);
  console.log(`    direction over [${KILL.join(', ')}] = [${results.collapse.direction.join(', ')}]`);
}

/* ---- 3. drop the redundant three --------------------------------------------------------------- */
console.log('\n  DROP — keep koTarget, delete koFirst / killsThreat / dmgFrac');
{
  const drop = ['koFirst', 'killsThreat', 'dmgFrac'].map(k => I[k]);
  const keep = B.FEATURES.map((f, i) => i).filter(i => !drop.includes(i));
  const remap = rs => rs.map(r => ({ feats: r.feats.map(x => keep.map(i => x[i])), chosen: r.chosen, game: r.game }));
  const trD = remap(train), teD = remap(test);
  const w = F.fit(trD, keep.length, 0, ITERS);
  const e = evalOn(teD, w);
  const ko = w[keep.indexOf(I.koTarget)];
  results.drop = { logL: e.ll, top1: e.top1, koTarget: +ko.toFixed(3) };
  report('koTarget only', w, e.top1, e.ll, `koTarget ${ko >= 0 ? '+' : ''}${ko.toFixed(3)}`);
}

/* ---- verdict ---------------------------------------------------------------------------------- */
console.log('\nVERDICT');
const base = results.baseline;
const cands = [
  ['ridge (best)', results.ridge.reduce((a, b) => (b.logL > a.logL ? b : a))],
  ['collapse', results.collapse],
  ['drop', results.drop],
];
let winner = null;
for (const [name, r] of cands) if (r.logL > base.logL && (!winner || r.logL > winner[1].logL)) winner = [name, r];
if (winner) {
  console.log(`  ${winner[0]} BEATS the baseline on held-out likelihood ` +
    `(${winner[1].logL.toFixed(4)} against ${base.logL.toFixed(4)}).`);
  console.log('  Worth shipping, but it changes a model people quote — that is Will\'s call.');
} else {
  console.log(`  NOTHING BEATS THE BASELINE. Best held-out logL stays ${base.logL.toFixed(4)} at lambda 0.`);
  console.log('  That is the expected outcome and it is not a failure of the repair: lambda was already');
  console.log('  SELECTED on held-out data, so the baseline is the best of its family by construction.');
  console.log('  It means the collinearity costs INTERPRETABILITY, not prediction — the block carries the');
  console.log('  right total and only its internal split is arbitrary. The practical consequence is');
  console.log('  narrow and worth stating exactly: do not quote individual weights from that block, and');
  console.log('  do not expect improving one of its features to move the model.');
}

fs.writeFileSync(path.join(ROOT, 'data', 'collinearity-fix.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/collinearity_fix.js',
  what: 'Three repairs for the kill-feature collinearity, each refit on the same split. The bar is ' +
        'held-out likelihood: a repair that costs prediction is a preference, not a fix.',
  kill_block: KILL,
  results,
}, null, 1));
console.log('\nwrote data/collinearity-fix.json');
