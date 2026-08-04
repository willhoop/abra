/* feature_audit.js — does every feature in board.js actually DO anything?
 *
 *   SHOWDOWN_PATH=... node engine/feature_audit.js [--games 400]   ->  data/feature-audit.json
 *
 * WHY THIS EXISTS
 * ---------------
 * Will asked whether all 48 features are fully tested. They are not: 8 of 48 are named anywhere in
 * tests/, and 40 are not. But test coverage is the weaker question, because a feature can be
 * mentioned in a test and still be dead in play, and this project has shipped exactly that failure
 * more than once -- a mechanics-coverage document that was a regex artefact TWICE, switch features
 * fitted and unreachable because the player never built switch candidates, a whole joint layer that
 * fell back on every eligible turn while reporting nothing wrong.
 *
 * The failure mode is always the same shape: everything runs, nothing errors, and the capability
 * simply is not there.
 *
 * THE THREE THINGS THIS MEASURES, IN ORDER OF SEVERITY
 * ---------------------------------------------------
 *   DEAD          the feature is the same value on every candidate of every decision. It cannot
 *                 influence any choice, whatever weight it carries. A fitted weight on a dead
 *                 feature is not a small effect, it is a number multiplying a constant.
 *
 *   NO CONTRAST   the feature varies across the corpus but is CONSTANT WITHIN a decision. MAG scores
 *                 candidates against each other and takes a softmax, so a term identical on every
 *                 option cancels exactly. `x` on all candidates shifts every score by `w*x` and
 *                 changes no probability. This is the subtle one and it is invisible in a weight
 *                 table: the feature looks alive because it varies globally.
 *
 *   RARE          it has real contrast, but on so few decisions that its fitted weight is resting on
 *                 a handful of rows. Reported with the count so the weight can be read with the
 *                 right amount of trust rather than at face value.
 *
 * WHAT THIS IS NOT. It does not check that a feature is CORRECT -- only that it is reachable and
 * discriminating. A feature can be alive, contrastive, frequent, and still measure the wrong thing.
 * Correctness needs a hand-built scenario per feature, which is the test debt this file quantifies
 * rather than pays off.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const F = require('./fit_policy.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const LIMIT = +arg('games', 400);

if (!process.env.SHOWDOWN_PATH) { console.error('set SHOWDOWN_PATH'); process.exit(2); }

const { games } = F.loadCorpus();
const sample = games.slice(0, LIMIT);
console.log(`FEATURE AUDIT — is every feature reachable, and does it discriminate?\n`);
console.log(`  ${sample.length.toLocaleString()} clean games of ${games.length.toLocaleString()} (--games to change)\n`);

const tally = { seen: 0, kept: 0, trivial: 0, noSheet: 0, unmatched: 0, ambiguous: 0, noUser: 0 };
let rows = [];
for (const g of sample) rows = rows.concat(F.decisionsFor(g, tally));

const N = B.FEATURES.length;
const stat = B.FEATURES.map(name => ({
  name, nonzero: 0, cands: 0, min: Infinity, max: -Infinity,
  decisionsWithContrast: 0, decisions: 0,
}));

for (const r of rows) {
  for (let k = 0; k < N; k++) {
    const s = stat[k];
    let lo = Infinity, hi = -Infinity;
    for (const x of r.feats) {
      const v = x[k];
      if (v !== 0) s.nonzero++;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      s.cands++;
    }
    if (lo < s.min) s.min = lo;
    if (hi > s.max) s.max = hi;
    s.decisions++;
    /* THE ONE THAT MATTERS. A softmax over candidates is invariant to anything added equally to
     * every candidate, so a feature constant WITHIN the decision cannot move the choice. */
    if (hi - lo > 1e-12) s.decisionsWithContrast++;
  }
}

for (const s of stat) {
  if (!isFinite(s.min)) s.min = 0;
  if (!isFinite(s.max)) s.max = 0;
  s.pctNonzero = s.cands ? 100 * s.nonzero / s.cands : 0;
  s.pctContrast = s.decisions ? 100 * s.decisionsWithContrast / s.decisions : 0;
  s.verdict = s.max === s.min ? 'DEAD'
    : s.decisionsWithContrast === 0 ? 'NO CONTRAST'
    : s.pctContrast < 1 ? 'RARE'
    : 'ok';
}

const order = { DEAD: 0, 'NO CONTRAST': 1, RARE: 2, ok: 3 };
const sorted = stat.slice().sort((a, b) => order[a.verdict] - order[b.verdict] || a.pctContrast - b.pctContrast);

console.log('  feature              nonzero%   decisions w/ contrast      range          verdict');
console.log('  ' + '-'.repeat(88));
for (const s of sorted) {
  console.log('  ' + s.name.padEnd(20) +
    s.pctNonzero.toFixed(1).padStart(7) + '   ' +
    (s.decisionsWithContrast.toLocaleString() + ' (' + s.pctContrast.toFixed(1) + '%)').padStart(20) + '   ' +
    (`[${s.min.toFixed(2)}, ${s.max.toFixed(2)}]`).padStart(16) + '   ' +
    (s.verdict === 'ok' ? '' : s.verdict));
}

const dead = stat.filter(s => s.verdict === 'DEAD');
const nocon = stat.filter(s => s.verdict === 'NO CONTRAST');
const rare = stat.filter(s => s.verdict === 'RARE');
console.log('');
console.log(`  ${dead.length} DEAD, ${nocon.length} NO CONTRAST, ${rare.length} RARE, ${stat.length - dead.length - nocon.length - rare.length} ok`);
if (dead.length || nocon.length) {
  console.log('');
  console.log('  A feature with no contrast inside a decision CANNOT change what MAG clicks. The softmax');
  console.log('  is invariant to a constant added to every candidate, so its fitted weight multiplies a');
  console.log('  constant and the model is smaller than the feature count suggests.');
}

fs.writeFileSync(D('data', 'feature-audit.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/feature_audit.js',
  what: 'Whether each board.js feature is REACHABLE and DISCRIMINATING on real decisions. Not whether '
      + 'it is correct -- a feature can be alive, contrastive and frequent while measuring the wrong '
      + 'thing. This quantifies the test debt rather than paying it off.',
  games_sampled: sample.length, games_available: games.length, decisions: rows.length,
  key: {
    DEAD: 'identical on every candidate of every decision; its weight multiplies a constant',
    'NO CONTRAST': 'varies across the corpus but never within a decision; the softmax cancels it exactly',
    RARE: 'real contrast on under 1% of decisions; its fitted weight rests on very few rows',
  },
  features: stat,
}, null, 1));
console.log('\nwrote data/feature-audit.json');
