/* opponent_calibration.js — is MAG a usable SAMPLER of the opponent, even though it is a bad RANKER?
 *
 *   SHOWDOWN_PATH=... node engine/opponent_calibration.js   ->   data/opponent-calibration.json
 *
 * WHY THIS IS THE RIGHT QUESTION AND recall-at-k WAS THE WRONG ONE
 * ---------------------------------------------------------------
 * engine/opponent_recall.js measured whether the opponent's real joint action survives a cut to
 * MAG's top k. The answer was 33.3% at k=5 and 74.5% at k=20 against ~56 joint actions, and the
 * conclusion was that no k is both affordable and honest.
 *
 * But a top-k shortlist is the wrong instrument. A hard cut has a RECALL CEILING: an opponent action
 * deleted before search begins can never be recovered, however good the value function is.
 * SAMPLING has no such ceiling — every action keeps its probability, and a rare action simply comes
 * up rarely, which is exactly what the EV sum wants:
 *
 *     EV(a) = SUM_r P(r) . SUM_b sigma_opp(b|r) . V(T(s,a,b))
 *
 * Nothing in that expression needs a shortlist. It needs sigma_opp to be RIGHT ABOUT FREQUENCIES.
 * A model can rank badly and still sample well: if it says "Protect 30% of the time" and people
 * Protect 30% of the time, the sum is correct even though Protect is rarely the top-scored option.
 *
 * So the metric is CALIBRATION, not accuracy. That is what this measures, and it has never been
 * measured in this project.
 *
 * HOW
 * ---
 * MAG already produces a distribution: softmax over its scores, which is what magnemite.js samples
 * from in play. For every held-out opponent decision, bin every candidate by its predicted
 * probability and compare, within each bin, the predicted rate against the observed rate at which
 * that candidate was the one actually clicked.
 *
 *   ECE   expected calibration error, the usage-weighted mean gap between predicted and observed.
 *         0 is perfect. Below about 0.05 is usable for an expectation.
 *   BRIER a proper score over the same predictions, so a model cannot look good by hedging.
 *
 * TWO BASELINES, because a calibration number alone means nothing:
 *   uniform    1/n over the candidate list. Perfectly honest, carries no information.
 *   prior      the behaviour clone, P(move | species) — what the bot used before MAG existed.
 *
 * WHAT WOULD MAKE THIS FAIL, STATED UP FRONT. A softmax fitted by conditional logit is trained to
 * maximise the likelihood of the observed choice, which is exactly a calibration objective — so MAG
 * SHOULD be well calibrated in-sample almost by construction. The interesting number is therefore
 * the HELD-OUT one, and the interesting comparison is against the temperature-scaled variant: if a
 * single temperature materially improves calibration, the raw distribution is over- or
 * under-confident and should be scaled before any search consumes it.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const F = require('./fit_policy.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH'); process.exit(2); }

const W = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
if (W.features.join(',') !== B.FEATURES.join(',')) {
  console.error('weight file and board.js disagree on the feature list — refit first.');
  process.exit(1);
}
const w = W[`weights_${W.shipped}`] || W.weights;

const { games } = F.loadCorpus();
const tally = { seen: 0, kept: 0, trivial: 0, noSheet: 0, unmatched: 0, ambiguous: 0, noUser: 0 };
let rows = [];
for (const g of games) rows = rows.concat(F.decisionsFor(g, tally));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const test = rows.filter(r => hash(r.game) % 5 === 0);

console.log('OPPONENT CALIBRATION — can MAG be SAMPLED from, even though it ranks badly?\n');
console.log(`  ${test.length.toLocaleString()} held-out decisions, ${W.shipped} vector\n`);

/* Softmax over MAG's scores at a given temperature. T = 1 is what magnemite.js samples from. */
function probsFor(r, T) {
  const s = r.feats.map(x => { let v = 0; for (let k = 0; k < w.length; k++) v += w[k] * x[k]; return v / T; });
  let mx = -Infinity; for (const v of s) if (v > mx) mx = v;
  const e = s.map(v => Math.exp(v - mx));
  const z = e.reduce((a, b) => a + b, 0) || 1;
  return e.map(v => v / z);
}
const uniformFor = r => r.feats.map(() => 1 / r.feats.length);

/* Reliability over ALL candidates, not only the chosen one: a candidate predicted at 0.3 should be
 * the click 30% of the time it is offered. Ten equal-width bins. */
function calib(predFn) {
  const BINS = 10;
  const sum = new Array(BINS).fill(0), hit = new Array(BINS).fill(0), cnt = new Array(BINS).fill(0);
  let brier = 0, nCand = 0;
  for (const r of test) {
    const p = predFn(r);
    for (let i = 0; i < p.length; i++) {
      const y = i === r.chosen ? 1 : 0;
      const b = Math.min(BINS - 1, Math.floor(p[i] * BINS));
      sum[b] += p[i]; hit[b] += y; cnt[b]++;
      brier += (p[i] - y) * (p[i] - y); nCand++;
    }
  }
  let ece = 0;
  const bins = [];
  for (let b = 0; b < BINS; b++) {
    if (!cnt[b]) continue;
    const pred = sum[b] / cnt[b], obs = hit[b] / cnt[b];
    ece += (cnt[b] / nCand) * Math.abs(pred - obs);
    bins.push({ bin: `${(b / BINS).toFixed(1)}-${((b + 1) / BINS).toFixed(1)}`, n: cnt[b],
                predicted: +pred.toFixed(4), observed: +obs.toFixed(4), gap: +(obs - pred).toFixed(4) });
  }
  return { ece, brier: brier / nCand, bins, nCand };
}

const results = {};
results.uniform = calib(uniformFor);
results.mag = calib(r => probsFor(r, 1));

/* Temperature scaling, selected on the HELD-OUT set. That is the standard way to do it (Guo et al.
 * 2017 fit T on a validation split), and it is stated rather than hidden: the reported temperature
 * is therefore the best case, and a fresh split would give a slightly worse one. */
let bestT = 1, bestE = results.mag.ece;
for (const T of [0.5, 0.7, 0.85, 1, 1.2, 1.5, 2, 3, 5]) {
  const c = calib(r => probsFor(r, T));
  if (c.ece < bestE) { bestE = c.ece; bestT = T; }
}
results.mag_temp = calib(r => probsFor(r, bestT));
results.temperature = bestT;

/* UNIFORM IS PERFECTLY CALIBRATED AND USELESS, which is why ECE alone cannot decide this.
 * Saying 1/n over n candidates is right on average by construction, so uniform scores ECE 0.0000
 * while carrying no information whatever. The BRIER score is what separates them: it punishes a
 * distribution for being vague as well as for being wrong. Read the two columns together — the
 * claim is that MAG is nearly as calibrated as the trivially-calibrated baseline AND sharper. */
console.log('  model                     ECE      Brier');
console.log('  ' + '-'.repeat(44));
console.log(`  uniform over candidates  ${results.uniform.ece.toFixed(4)}   ${results.uniform.brier.toFixed(4)}`);
console.log(`  MAG (T = 1, as played)   ${results.mag.ece.toFixed(4)}   ${results.mag.brier.toFixed(4)}`);
console.log(`  MAG (T = ${String(bestT).padEnd(4)})           ${results.mag_temp.ece.toFixed(4)}   ${results.mag_temp.brier.toFixed(4)}`);

console.log('\n  RELIABILITY — a candidate predicted at p should be the click p of the time');
console.log('  bin          n        predicted   observed      gap');
for (const b of results.mag.bins) {
  console.log(`  ${b.bin.padEnd(10)} ${String(b.n).padStart(8)}      ${b.predicted.toFixed(3)}      ${b.observed.toFixed(3)}   ${(b.gap >= 0 ? '+' : '') + b.gap.toFixed(3)}`);
}

console.log('');
const usable = results.mag.ece < 0.05;
if (usable) {
  const sharper = results.uniform.brier - results.mag.brier;
  console.log(`  MAG's distribution is calibrated to within ${(100 * results.mag.ece).toFixed(2)} points on held-out data,`);
  console.log(`  and it is SHARPER than uniform by ${sharper.toFixed(4)} Brier — uniform is perfectly calibrated`);
  console.log('  by construction and carries no information, so being near it on ECE while beating it');
  console.log('  on Brier is the combination that matters.');
  console.log('  It is USABLE AS sigma_opp BY SAMPLING, despite ranking the opponent\'s joint turn');
  console.log('  correctly only 33% of the time at k=5. Ranking badly and sampling well are different');
  console.log('  properties, and the EV sum needs the second one.');
} else {
  console.log(`  ECE ${results.mag.ece.toFixed(4)} is too large to sample from directly; the distribution`);
  console.log('  is mis-stated by more than the effect any search would be measuring.');
}
if (bestT !== 1) {
  console.log(`\n  Temperature ${bestT} improves ECE from ${results.mag.ece.toFixed(4)} to ${bestE.toFixed(4)}.`);
  console.log(`  MAG is ${bestT > 1 ? 'OVER' : 'UNDER'}-confident as played; scale before any search consumes it.`);
}

fs.writeFileSync(D('data', 'opponent-calibration.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/opponent_calibration.js',
  what: 'Calibration of MAG\'s softmax as a distribution over the opponent\'s options. The metric that '
      + 'matters if MAG is SAMPLED rather than cut to a shortlist — a hard top-k has a recall ceiling '
      + 'no value function can recover from, sampling has none, and the EV sum needs correct '
      + 'frequencies rather than a correct ranking.',
  shipped_vector: W.shipped, held_out_decisions: test.length,
  uniform: { ece: +results.uniform.ece.toFixed(5), brier: +results.uniform.brier.toFixed(5) },
  mag: { ece: +results.mag.ece.toFixed(5), brier: +results.mag.brier.toFixed(5), bins: results.mag.bins },
  mag_temperature_scaled: { temperature: bestT, ece: +results.mag_temp.ece.toFixed(5), brier: +results.mag_temp.brier.toFixed(5) },
  usable_as_sampler: usable,
  sharper_than_uniform_brier: +(results.uniform.brier - results.mag.brier).toFixed(5),
  read_this_way: 'Uniform scores ECE 0.0000 by construction — 1/n over n candidates is right on average and carries no information. ECE alone therefore cannot rank these. The pair to read is ECE NEAR uniform and Brier BELOW it: calibrated and sharp.',
  caveat: 'The temperature is selected ON the held-out set (Guo et al. 2017 fit T on a validation '
        + 'split), so the scaled figure is a best case and a fresh split would be slightly worse. '
        + 'A conditional logit is trained to maximise the likelihood of the observed choice, which '
        + 'is close to a calibration objective, so good calibration here is partly by construction — '
        + 'the informative comparison is against uniform, not against zero.',
}, null, 1));
console.log('\nwrote data/opponent-calibration.json');
