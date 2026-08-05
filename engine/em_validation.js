/* em_validation.js — does the partial-label fit recover weights the naive fit demonstrably cannot?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/em_validation.js [--games=N]
 *       ->  data/partial-label-em.json          exit 1 if the estimator fails to recover
 *
 * docs/CLICK-CENSORING-FIX.md Stage C's gate, and the spec is explicit that the gate doubles as the
 * measurement: "generate clicks from KNOWN weights, censor them with the real censoring process, and
 * require the fit to recover the planted weights within tolerance where the naive (dropping) fit
 * demonstrably does not."
 *
 * WHY SYNTHETIC LABELS ON REAL FEATURES
 * -------------------------------------
 * On real data there is no ground truth: the whole problem is that the true click is unobserved. So
 * the only way to say "this estimator is unbiased" is to plant the answer. The FEATURES here are the
 * real corpus rows — real collinearity, real candidate-list lengths, real target structure — and only
 * the LABELS are generated, from a known w*. Anything recovered is then attributable to the
 * estimator rather than to a well-conditioned toy.
 *
 * TWO REGIMES, BECAUSE THEY ANSWER DIFFERENT QUESTIONS
 * ---------------------------------------------------
 *   AMPLIFIED  a random 40% of the rows whose chosen move has more than one possible target are
 *              censored, and within a censored row the label collapses onto a FIXED member of the
 *              set. Heavy, systematic MNAR. This is the known-bad-input demonstration: naive must
 *              fail, EM must recover.
 *
 *              THE ELIGIBILITY IS RANDOM AND THE COLLAPSE IS LABEL-DEPENDENT, and that split is not
 *              cosmetic. A first version censored EVERY eligible row and EM recovered only 45% —
 *              correctly, because with every same-move row collapsed there is nothing left to
 *              identify the target-choice features from at all. That is Cour, Sapp & Taskar's
 *              identifiability condition failing, not the estimator failing, and it is also not what
 *              the corpus does: a redirector is up on some turns and not others, which is exactly an
 *              exogenous eligibility with a label-dependent collapse inside it.
 *   OBSERVED   only the rows the corpus really censors (a redirector was up) are censored, at the
 *              rate the corpus really shows. This is the honest size of the bias Stage C removes,
 *              and it is small because the class is small — which is exactly what
 *              docs/CLICK-CENSORING-FIX.md §4 says to expect.
 *
 * THREE ARMS in each regime, all on identical rows and identical planted labels:
 *   ORACLE  fitted on the TRUE labels. The best any estimator could do; it bounds the other two.
 *   NAIVE   fitted on the CENSORED labels as though they were certain. What ships today.
 *   EM      fitted on the censored labels plus the candidate set, under the marginal likelihood.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---- `--check`: VERIFY THE RECORDED GATE WITHOUT RE-RUNNING IT ------------------------------
 *
 * The measurement is a set of conditional-logit fits and takes tens of minutes, so it cannot be in
 * tests/run-all.js as a live run. It also must not be OUTSIDE the suite: run-all.js asserts that
 * every engine file which behaves like a gate is registered, precisely because "a check that nothing
 * runs is worse than no check — it reads as coverage in a review".
 *
 * So this mode reads the artifact and re-checks its verdict AND its provenance: the sources the
 * measurement depends on must still hash to what they hashed when it ran. That is the same
 * hash-not-mtime rule engine/status.js applies to the leaf, and it means a change to
 * engine/click_class.js turns this red instead of leaving a stale PASS on the board.
 *
 * Placed before the heavy requires so --check costs milliseconds and never needs SHOWDOWN_PATH.
 * ------------------------------------------------------------------------------------------ */
if (process.argv.includes('--check')) {
  const crypto = require('crypto');
  const ART = path.join(__dirname, '..', 'data', 'partial-label-em.json');
  /* sha12OrNull, not sha12, and the difference is the whole point of the pair. This is a COMPARISON
   * site: it checks a stamped digest against the tree, so an unreadable source is a real and
   * reportable answer — null compares unequal to the stamp and the gate says "changed", loudly.
   * The STAMPING site further down uses the throwing form, because writing a null digest is how an
   * artifact certifies itself over a file nobody could read. Same fact, two honest answers. */
  const sha12 = require('./engine_release.js').sha12OrNull;
  let j;
  try { j = JSON.parse(fs.readFileSync(ART, 'utf8')); }
  catch (e) {
    console.error('EM VALIDATION: cannot read data/partial-label-em.json (' + e.message + ').');
    console.error('Run: SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/em_validation.js');
    process.exit(1);
  }
  const A = (j.regimes || {}).amplified || {};
  let bad = [];
  if (!A.bias_exceeds_noise_floor) bad.push('the amplified regime\'s censoring bias did not exceed its own noise floor');
  if (!A.em_beats_naive) bad.push('EM did not beat the naive fit on the amplified regime');
  if (!(A.em_recovered_fraction > 0.5)) bad.push('EM recovered <=50% of the censoring bias');
  for (const [f, d] of Object.entries(j.source_digests || {})) {
    const now = sha12(path.join(__dirname, '..', f));
    if (now !== d) bad.push(`${f} has changed since this was measured (${d} -> ${now}) — re-run it`);
  }
  if (!j.source_digests) bad.push('the artifact records no source digests, so it cannot be checked against the tree');
  if (bad.length) { console.error('EM VALIDATION FAILED:\n  - ' + bad.join('\n  - ')); process.exit(1); }
  console.log('EM VALIDATION ok — amplified bias ' + A.censoring_bias.toFixed(4) +
    ' > floor ' + A.noise_floor_oracle_spread.toFixed(4) + ', EM recovered ' +
    (100 * A.em_recovered_fraction).toFixed(1) + '%; every source still hashes to what it was measured against.');
  process.exit(0);
}

const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);
const NF = B.FEATURES.length;
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(k + '=')); return a ? +a.slice(k.length + 1) : d; };
const GAMES = arg('--games', 1200);
const ITERS = arg('--iters', 300);

/* A SEEDED GENERATOR. Two runs of this file must agree to the digit or the numbers below are a draw
 * rather than a measurement — the same reason engine/backtest_winrate.js seeds every configuration. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

console.log('PARTIAL-LABEL EM VALIDATION\n');
const { games: all } = FP.loadCorpus();
const games = all.slice(0, GAMES);
const tally = { seen: 0, kept: 0, noUser: 0, noSheet: 0, trivial: 0, unmatched: 0, ambiguous: 0, coerced: 0 };
let rows = [];
for (const g of games) rows = rows.concat(FP.decisionsFor(g, tally));
console.log(`  rows        ${rows.length.toLocaleString()} decisions over ${games.length.toLocaleString()} games`);

/* THE PLANTED TRUTH. The shipped vector, so the scale and the correlations are the ones this model
 * actually lives at rather than a vector picked to be easy to recover. */
/* PLANT_WEIGHTS names the vector to plant. It defaults to the shipped one and exists so this can run
 * BESIDE a refit that is about to overwrite that file: a measurement whose input is rewritten
 * mid-run is the WOBBUFFET failure, and pointing it at a snapshot is cheaper than serialising. */
const PLANT = process.env.PLANT_WEIGHTS ? path.resolve(process.env.PLANT_WEIGHTS) : D('data', 'policy-weights.json');
const SHIPPED = JSON.parse(fs.readFileSync(PLANT, 'utf8'));
const wStar = (SHIPPED[SHIPPED.shipped || 'weights'] || SHIPPED.weights).slice();
if (wStar.length !== NF) { console.error('the shipped vector is not the current feature list — refit first'); process.exit(1); }

function sampleLabels(seed) {
  const r = rng(seed);
  const out = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const f = rows[i].feats;
    let max = -Infinity; const s = new Array(f.length);
    for (let j = 0; j < f.length; j++) { let v = 0; for (let k = 0; k < NF; k++) v += wStar[k] * f[j][k]; s[j] = v; if (v > max) max = v; }
    let z = 0; for (let j = 0; j < s.length; j++) { s[j] = Math.exp(s[j] - max); z += s[j]; }
    let u = r() * z, pick = s.length - 1;
    for (let j = 0; j < s.length; j++) { u -= s[j]; if (u <= 0) { pick = j; break; } }
    out[i] = pick;
  }
  return out;
}

/* THE CENSORING PROCESS, APPLIED TO THE PLANTED LABELS.
 *
 * `observed` is the same candidate set the corpus row carries (or, in the amplified regime, every
 * same-move alternative), and the recorded label collapses onto ONE fixed member of it — which is
 * what the protocol does: it writes down the redirector, every time, whoever was aimed at. */
const AMPLIFIED_ELIGIBLE = 0.40;
function censor(labels, mode, seed) {
  const r0 = rng(seed ^ 0x5bd1e995);
  const rec = labels.slice();
  const sets = new Array(rows.length).fill(null);
  let n = 0, moved = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let set = null;
    if (mode === 'observed') {
      set = (r.cset && r.cset.length > 1) ? r.cset : null;
    } else {
      /* Eligibility drawn BEFORE the label is looked at, so it is exogenous — the analogue of "was a
       * redirector up this turn". Draw unconditionally so the stream does not depend on the label. */
      const eligible = r0() < AMPLIFIED_ELIGIBLE;
      const id = r.mvs[labels[i]];
      if (!eligible || !id || id.startsWith('switch:')) continue;
      const s2 = [];
      for (let j = 0; j < r.mvs.length; j++) if (r.mvs[j] === id) s2.push(j);
      set = s2.length > 1 ? s2 : null;
    }
    if (!set || !set.includes(labels[i])) continue;
    sets[i] = set;
    n++;
    /* Collapse onto the set's FIRST member: a systematic, label-dependent rewrite. Choosing at
     * random would be MCAR and would cost only sample size (Rubin 1976), which is precisely the
     * case this whole fix says we are NOT in. */
    if (rec[i] !== set[0]) moved++;
    rec[i] = set[0];
  }
  return { rec, sets, censored: n, relabelled: moved };
}

function arm(labels, sets, useSets) {
  const fitRows = rows.map((r, i) => {
    const o = { feats: r.feats, chosen: labels[i] };
    if (useSets && sets && sets[i]) o.cset = sets[i];
    return o;
  });
  return FP.fit(fitRows, NF, 0, ITERS);
}

const l2 = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) * (v - b[i]), 0));
const worst = (a, b) => {
  let m = 0, which = '';
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > m) { m = d; which = B.FEATURES[i]; } }
  return { delta: m, feature: which };
};

/* REPLICATED, BECAUSE ONE DRAW IS A DRAW.
 *
 * The oracle arm is not at zero either — it is a finite sample of a 58-parameter model — so the
 * question "did EM beat naive" needs the run-to-run spread of the SAME arm beside it or it is a
 * coin flip with extra steps. Three seeds; the spread is published and the gate reads it. */
const SEEDS = [20260805, 20260806, 20260807].slice(0, arg('--seeds', 3));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const spread = (a) => Math.max(...a) - Math.min(...a);

const report = {};
for (const mode of ['amplified', 'observed']) {
  const per = { oracle: [], naive: [], em: [] };
  let cens = 0, moved = 0;
  const detail = [];
  for (const seed of SEEDS) {
    const labels = sampleLabels(seed);
    const c = censor(labels, mode, seed);
    cens += c.censored; moved += c.relabelled;
    const w = { oracle: arm(labels, null, false), naive: arm(c.rec, null, false), em: arm(c.rec, c.sets, true) };
    const one = { seed, censored: c.censored, relabelled: c.relabelled };
    for (const k of ['oracle', 'naive', 'em']) {
      const e = l2(w[k], wStar), wo = worst(w[k], wStar);
      per[k].push(e);
      one[k] = { l2_from_planted: e, worst_feature: wo.feature, worst_delta: wo.delta };
    }
    detail.push(one);
  }
  cens /= SEEDS.length; moved /= SEEDS.length;
  const eO = mean(per.oracle), eN = mean(per.naive), eE = mean(per.em);
  const floor = spread(per.oracle);
  const recovered = (eN - eO) > 0 ? (eN - eE) / (eN - eO) : null;

  console.log(`\n${mode.toUpperCase()} REGIME — ${Math.round(cens).toLocaleString()} rows censored on average ` +
    `(${(100 * cens / rows.length).toFixed(3)}% of rows), of which ${Math.round(moved).toLocaleString()} ` +
    `had their label actually MOVED (${(100 * moved / Math.max(1, cens)).toFixed(1)}%)`);
  for (const k of ['oracle', 'naive', 'em']) {
    console.log(`  ${k.padEnd(7)} ||w - w*||2 = ${mean(per[k]).toFixed(4)}   ` +
      `across ${SEEDS.length} seeds: ${per[k].map(v => v.toFixed(3)).join(' / ')}`);
  }
  console.log(`  NOISE FLOOR (spread of the ORACLE arm across seeds): ${floor.toFixed(4)}`);
  console.log(`  bias attributable to the censoring: ${(eN - eO).toFixed(4)}   ` +
    `recovered by EM: ${recovered == null ? 'n/a' : (100 * recovered).toFixed(1) + '%'}`);
  if (eN - eO <= floor) {
    console.log('  ...and that bias is INSIDE the noise floor, so this regime cannot resolve it. ' +
      'Stated, not hidden.');
  }
  report[mode] = {
    rows: rows.length, seeds: SEEDS, censored_mean: cens, relabelled_mean: moved,
    censored_rate: cens / rows.length,
    l2_from_planted: { oracle: eO, naive: eN, em: eE },
    per_seed: detail,
    noise_floor_oracle_spread: floor,
    censoring_bias: eN - eO,
    bias_exceeds_noise_floor: (eN - eO) > floor,
    em_recovered_fraction: recovered,
    em_beats_naive: eE < eN,
  };
}

/* THE SOURCES THIS NUMBER DEPENDS ON, hashed. `--check` compares them to the tree, so editing the
 * estimator turns the gate red instead of leaving yesterday's PASS standing. */
const crypto = require('crypto');
const sha12 = require('./engine_release.js').sha12;   /* ONE implementation — the local copy returned null on an unreadable file, so two nulls compared EQUAL and a stamp could certify itself. See the comment on sha12 in engine_release.js. */
const SOURCES = ['engine/fit_policy.js', 'engine/click_class.js', 'engine/click_match.js',
  'engine/board.js', 'engine/em_validation.js'];

const out = {
  generated: new Date().toISOString(),
  source: 'engine/em_validation.js',
  source_digests: SOURCES.reduce((o, f) => (o[f] = sha12(D(f)), o), {}),
  what: 'Planted-weight recovery under the real censoring process. docs/CLICK-CENSORING-FIX.md Stage C.',
  planted_from: path.relative(D('.'), PLANT) + ' (' + (SHIPPED.shipped || 'weights') + ')',
  corpus: { games: games.length, games_requested: GAMES, of_total: all.length, rows: rows.length },
  iters: ITERS,
  features: B.FEATURES,
  regimes: report,
  reading: 'AMPLIFIED is the known-bad-input demonstration: censoring is heavy and systematic, so a '
         + 'naive fit must be visibly wrong and EM must recover most of the gap. OBSERVED applies '
         + 'only the censoring the corpus really contains, so its bias is small BY CONSTRUCTION — '
         + 'about 1% of rows — and it is the honest size of what Stage C buys in weight space. '
         + 'Neither number is a win rate or a held-out accuracy.',
};
fs.writeFileSync(D('data', 'partial-label-em.json'), JSON.stringify(out, null, 1) + '\n');
console.log('\n  -> data/partial-label-em.json');

/* THE GATE. An estimator that does not beat the naive one on the amplified regime is not an
 * estimator, and shipping it would be worse than the censoring. */
const A = report.amplified;
if (!A.bias_exceeds_noise_floor) {
  console.error('\nGATE INCONCLUSIVE — the amplified regime did not produce a censoring bias larger than');
  console.error('its own noise floor, so it cannot say anything about the estimator. Raise --games.');
  process.exit(1);
}
if (!A.em_beats_naive || !(A.em_recovered_fraction > 0.5)) {
  console.error('\nGATE FAILED — EM did not recover the planted weights on the amplified regime.');
  console.error(`  naive ${A.l2_from_planted.naive.toFixed(4)}  em ${A.l2_from_planted.em.toFixed(4)}  ` +
    `oracle ${A.l2_from_planted.oracle.toFixed(4)}`);
  process.exit(1);
}
console.log('\nGATE PASSED — on heavy systematic censoring the naive fit is biased beyond the noise ' +
  'floor and EM recovers ' + (100 * A.em_recovered_fraction).toFixed(1) + '% of that bias.');
