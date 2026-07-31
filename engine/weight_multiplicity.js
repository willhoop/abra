/* weight_multiplicity.js — which of the fitted weights survive a multiplicity correction?
 *
 * WHY THIS EXISTS (thesis defence, 2026-07-31)
 *
 * `fit_policy.js` reports a 95% interval for every feature and flags the ones whose interval clears
 * zero. There are 56 features. At alpha = 0.05, **about 2.8 of them clear zero by chance alone**, and
 * nothing in this repository corrects for that. The defence called it "the weakest statistical point,
 * and it is not corrected anywhere".
 *
 * The distinction matters for what may be claimed. "56 measured weights, 41 of which are individually
 * significant" is a different sentence from "56 measured weights, k of which survive a correction for
 * having looked at 56" — and only the second is defensible when the reader was shown all of them.
 *
 * TWO CORRECTIONS, because they answer different questions and disagreeing is informative:
 *
 *   BONFERRONI controls the FAMILY-WISE ERROR RATE: P(any false positive at all) <= alpha. It is the
 *   conservative choice and the right one if a single spurious weight would embarrass a claim.
 *   (Bonferroni 1936; see Dunn 1961 for the modern treatment.)
 *
 *   BENJAMINI-HOCHBERG controls the FALSE DISCOVERY RATE: the expected PROPORTION of the rejections
 *   that are false. It is the right one when the weights are a screen for what to investigate rather
 *   than a set of individual claims, and it is strictly more powerful.
 *   (Benjamini & Hochberg, JRSS-B 57(1), 1995.)
 *
 * THE FAMILY IS NAMED AND IT IS THE WHOLE VECTOR. Every feature in the shipped fit is reported to the
 * reader, so every feature is in the family. Choosing a smaller family after seeing which ones are
 * large is exactly the practice these corrections exist to prevent.
 *
 * WHAT THIS DOES NOT DO. It does not re-fit. It reads the intervals the fit already published and
 * asks which survive. A correction cannot rescue a weight that was never measured well, and it
 * cannot make an imitation-fitted weight into evidence about winning.
 *
 *   node engine/weight_multiplicity.js            -> data/weight-multiplicity.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const W = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
const F = W.features || [];
const SE = W.standardErrors || null;

if (!SE || !SE.length) {
  console.error('data/policy-weights.json carries no standardErrors — cannot correct what was not measured.');
  console.error('Re-run engine/fit_policy.js, which computes them.');
  process.exit(2);
}

/* The shipped vector is `reweighted_to_closed`; the standard errors belong to the fit that produced
 * them. Use the same block the fit reported intervals for, and say which. */
const which = W.shipped || 'weights';
const w = W[which] || W.weights;

/* Normal approximation, which is what the reported 95% intervals already assume. z = |w| / se. */
const rows = F.map((f, i) => {
  const est = w[i], se = SE[i];
  const z = (se && isFinite(se) && se > 0) ? Math.abs(est) / se : null;
  return { feature: f, estimate: est, se, z };
}).filter(r => r.z !== null);

/* Two-sided p from z, via the complementary error function. Abramowitz & Stegun 7.1.26 is accurate
 * to 1.5e-7, which is far beyond what matters at these thresholds. */
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return s * y;
}
const pTwoSided = z => 1 - erf(z / Math.SQRT2);

for (const r of rows) r.p = pTwoSided(r.z);

const m = rows.length;
const ALPHA = 0.05;

/* ---- uncorrected ------------------------------------------------------------------------------ */
const uncorrected = rows.filter(r => r.p < ALPHA);

/* ---- Bonferroni: reject when p < alpha / m ----------------------------------------------------- */
const bonfThresh = ALPHA / m;
const bonferroni = rows.filter(r => r.p < bonfThresh);

/* ---- Benjamini-Hochberg: sort ascending, reject up to the largest k with p_(k) <= k*alpha/m ------ */
const sorted = rows.slice().sort((a, b) => a.p - b.p);
let kMax = 0;
for (let k = 1; k <= m; k++) if (sorted[k - 1].p <= (k * ALPHA) / m) kMax = k;
const bh = sorted.slice(0, kMax);
const bhSet = new Set(bh.map(r => r.feature));

const out = {
  generated: new Date().toISOString().slice(0, 10),
  by: 'engine/weight_multiplicity.js',
  source: 'data/policy-weights.json',
  shipped_block: which,
  family: 'every feature in the shipped fit, because every one is reported to the reader',
  alpha: ALPHA,
  n_features: m,
  expected_false_positives_uncorrected: +(m * ALPHA).toFixed(2),
  survives: {
    uncorrected: uncorrected.length,
    bonferroni: bonferroni.length,
    benjamini_hochberg: bh.length,
  },
  bonferroni_threshold: bonfThresh,
  lost_to_correction: uncorrected.filter(r => !bhSet.has(r.feature)).map(r => r.feature),
  rows: sorted.map(r => ({
    feature: r.feature, estimate: +r.estimate.toFixed(4), se: +r.se.toFixed(4),
    z: +r.z.toFixed(2), p: r.p, bh: bhSet.has(r.feature),
    bonferroni: r.p < bonfThresh,
  })),
  caveat: 'A correction says which weights are distinguishable from zero given that 56 were examined. '
        + 'It says nothing about whether an imitation-fitted weight is evidence about WINNING, which is '
        + 'a separate and larger question this project has measured going the other way.',
};

fs.writeFileSync(D('data', 'weight-multiplicity.json'), JSON.stringify(out, null, 1));

console.log('MULTIPLICITY CORRECTION over the shipped policy weights\n');
console.log(`  family      every feature in the shipped fit (${which})`);
console.log(`  features    ${m}`);
console.log(`  alpha       ${ALPHA}`);
console.log(`  expected false positives with NO correction: ${(m * ALPHA).toFixed(1)}\n`);
console.log(`  ${'test'.padEnd(24)}${'survives'.padStart(10)}`);
console.log('  ' + '-'.repeat(36));
console.log(`  ${'uncorrected'.padEnd(24)}${String(uncorrected.length).padStart(10)}`);
console.log(`  ${'Benjamini-Hochberg (FDR)'.padEnd(24)}${String(bh.length).padStart(10)}`);
console.log(`  ${'Bonferroni (FWER)'.padEnd(24)}${String(bonferroni.length).padStart(10)}`);
if (out.lost_to_correction.length) {
  console.log(`\n  LOST to the FDR correction (${out.lost_to_correction.length}): ${out.lost_to_correction.join(', ')}`);
} else {
  console.log('\n  Nothing significant uncorrected fails the FDR correction.');
}
console.log('\n  -> data/weight-multiplicity.json');
