/* collinearity_audit.js — fit every feature ALONE, and compare with its weight in the full model.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/collinearity_audit.js
 *
 * WHY
 * ---
 * MAG's fitted weights say that killing the target does not matter. koTarget is -0.164 and ranks
 * 36th of 47; koFirst is +0.060 and ranks 43rd; killsThreat is -0.064. Taken at face value that is a
 * claim about people — that among the options in front of them, players are very slightly LESS
 * likely to click the move that removes the thing they are aiming at.
 *
 * It is not true. Measured on held-out decisions with no model involved at all, humans pick a
 * killing move 1.41x more often than the base rate among the same candidates, a move that kills AND
 * moves first 1.82x, and a move that kills the thing threatening them 1.55x. The signal is real,
 * large, and the fit is throwing it away.
 *
 * The reason is collinearity, and Will proposed the test that proves it: fit each feature ON ITS
 * OWN and compare. A predictor that is strong alone and near-zero (or sign-flipped) in company is
 * not weak; its credit is being split among correlated neighbours. Measured:
 *
 *     feature          alone     in the full fit
 *     koTarget        +0.764        -0.164        sign flips
 *     koFirst         +0.902        +0.060        absorbed
 *     killsThreat     +0.584        -0.064        sign flips
 *     dmgFrac         +0.648        -0.076        sign flips
 *     eff4            +1.268        +1.277        unaffected
 *     immune          -2.323        -2.198        unaffected
 *
 * The kill family is inter-correlated at 0.5-0.67 (koTarget/dmgFrac 0.67, koTarget/koFirst 0.64,
 * koTarget/killsThreat 0.58, dmgFrac/bp 0.66). eff4 correlates with nothing above 0.19 — and eff4
 * and immune are precisely the two whose weights do not move. The pattern is exact.
 *
 * AND THE REGULARISATION IS ZERO. fit_policy.js selects lambda on held-out likelihood from
 * [0, 1e-5, 1e-4, 1e-3, 1e-2] and 0 wins. That is defensible for raw predictive accuracy and it
 * leaves collinear coefficients completely unconstrained, which is the condition under which credit
 * splits and signs flip.
 *
 * WHAT THIS IS AND IS NOT
 * -----------------------
 * It is NOT an argument that the weights predict badly — they were selected on held-out likelihood
 * and they do. Collinear coefficients can be individually meaningless while the model as a whole is
 * well calibrated, because the correlated block still carries the right total.
 *
 * It IS a warning against reading any single weight in that block as a statement about the game.
 * Several documents in this repository quote individual weights as findings — "the biggest learned
 * effects are the this-move-is-already-dead terms" is safe, because those features are uncorrelated;
 * "MAG does not value kills" would not be.
 *
 * It also matters for a REASON BEYOND IMITATION. The objective is going to change: the plan is to
 * optimise for winning via self-play rather than for resembling people, and the record already shows
 * that re-optimising these features for winning moved the kill proxy from +0.34 to +2.75. Collinearity
 * is a property of the FEATURE SET, not of the data source, so it will do the same thing to a
 * self-play fit unless the block is regularised or collapsed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('./fit_policy.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.env.SHOWDOWN_PATH) {
  console.error('set SHOWDOWN_PATH to a built master checkout of pokemon-showdown');
  process.exit(2);
}

const WFILE = process.argv[2] || D('data', 'policy-weights.json');
const W = JSON.parse(fs.readFileSync(WFILE, 'utf8'));
if (W.features.join(',') !== B.FEATURES.join(',')) {
  console.error('weight file and board.js disagree on the feature list — refit before trusting this.');
  process.exit(1);
}
const joint = W[`weights_${W.shipped}`] || W.weights;

const { games } = F.loadCorpus();
const tally = { seen: 0, kept: 0, trivial: 0, noSheet: 0, unmatched: 0, ambiguous: 0, noUser: 0 };
let rows = [];
for (const g of games) rows = rows.concat(F.decisionsFor(g, tally));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const train = rows.filter(r => hash(r.game) % 5 !== 0);
const test = rows.filter(r => hash(r.game) % 5 === 0);

console.log('COLLINEARITY AUDIT — is a near-zero weight a measurement, or a split?\n');
console.log(`  weights ${path.relative(ROOT, WFILE)} (${W.shipped}), lambda used in the fit: ${W.lambda}`);
console.log(`  ${train.length.toLocaleString()} training decisions, ${test.length.toLocaleString()} held out\n`);

/* ---- 1. the model-free check: do people actually do this? ------------------------------------
 * Restricted to decisions where the feature is neither true of every candidate nor of none, since a
 * decision with no contrast carries no information about preference. */
function lift(name, thresh = 0.5) {
  const k = B.FEATURE_INDEX[name];
  let dec = 0, chosen = 0, base = 0;
  for (const r of test) {
    const n = r.feats.length, hits = r.feats.filter(x => x[k] > thresh).length;
    if (!hits || hits === n) continue;
    dec++; base += hits / n;
    if (r.feats[r.chosen][k] > thresh) chosen++;
  }
  return dec ? { dec, obs: 100 * chosen / dec, base: 100 * base / dec, lift: (chosen / dec) / (base / dec) } : null;
}

/* ---- 2. the same feature, fitted alone ------------------------------------------------------- */
function solo(name) {
  const k = B.FEATURE_INDEX[name];
  const r1 = train.map(r => ({ feats: r.feats.map(x => [x[k]]), chosen: r.chosen }));
  return F.fit(r1, 1, 0, 300)[0];
}

const FAM = process.argv.includes('--all') ? B.FEATURES : [
  'koTarget', 'koFirst', 'killsThreat', 'dmgFrac', 'killIsRoll', 'tgtHurt', 'bp', 'tgtMayProtect',
  'eff4', 'eff2', 'immune', 'deadNoLastMove', 'isSwitch', 'movesFirst', 'myOffenseStage',
];

console.log('  feature            alone     in fit    human lift   verdict');
console.log('  ' + '-'.repeat(68));
const out = {};
for (const f of FAM) {
  const s = solo(f), j = joint[B.FEATURE_INDEX[f]], L = lift(f);
  let verdict = '';
  if (Math.sign(s) !== Math.sign(j) && Math.abs(s) > 0.15) verdict = 'SIGN FLIPS';
  else if (Math.abs(s) > 0.4 && Math.abs(j) < 0.25) verdict = 'absorbed';
  out[f] = { solo: +s.toFixed(4), joint: +j.toFixed(4), lift: L ? +L.lift.toFixed(3) : null, verdict: verdict || null };
  console.log('  ' + f.padEnd(18) +
    ((s >= 0 ? '+' : '') + s.toFixed(3)).padStart(7) + '   ' +
    ((j >= 0 ? '+' : '') + j.toFixed(3)).padStart(7) + '   ' +
    (L ? (L.lift.toFixed(2) + 'x').padStart(8) : '       -') + '     ' + verdict);
}

const flipped = Object.entries(out).filter(([, v]) => v.verdict);
console.log('');
if (flipped.length) {
  console.log(`  ${flipped.length} feature(s) are strong alone and lost in company: ` +
    flipped.map(([k]) => k).join(', '));
  console.log('  Do not read those individual weights as statements about the game.');
} else {
  console.log('  No feature changes character between the solo and joint fits.');
}

fs.writeFileSync(D('data', 'collinearity-audit.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/collinearity_audit.js',
  what: 'Each feature fitted ALONE versus its weight in the full model, beside a model-free lift ' +
        'measuring whether humans actually prefer it. A feature strong alone and near-zero in ' +
        'company has had its credit split among correlated neighbours; its individual weight is not ' +
        'a statement about the game.',
  weights_file: path.relative(ROOT, WFILE),
  lambda_in_fit: W.lambda,
  corpus: { games: games.length, train: train.length, held_out: test.length },
  features: out,
  caveat: 'Collinear coefficients can be individually meaningless while the MODEL is well calibrated, ' +
          'because the correlated block still carries the right total. This is not evidence the ' +
          'weights predict badly — lambda was selected on held-out likelihood. It is evidence that ' +
          'single weights inside the damage/kill block cannot be quoted as findings.',
}, null, 1));
console.log('\nwrote data/collinearity-audit.json');
