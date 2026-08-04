/* recall_at_k.js — is MAG good enough to PRUNE, which is a different question from whether it decides well.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/recall_at_k.js
 *
 * WHY THIS IS THE NUMBER THAT MATTERS FOR THE SEARCH LAYER
 * -------------------------------------------------------
 * MAG's headline is top-1 accuracy: 30.9% of the time its best-scoring option is the one the human
 * actually clicked. That is the right metric for a bot that DECIDES by taking its top pick.
 *
 * It is the wrong metric for a bot whose job is to hand a shortlist to a search. There, the only failure
 * that matters is throwing the good move away — if the best move is anywhere in the surviving set, search
 * and a value function sort out the ranking. Keeping some junk costs a little compute; discarding the
 * winner is unrecoverable, because nothing downstream can get it back.
 *
 * So the question is RECALL: how often does the human's choice survive a cut to the top k?
 *
 * MAG should be well suited to this, and for the same reason it is a weak decider. Nine of its ten
 * strongest weights are negative and every one means "this move cannot work right now" — immune, blocked
 * by an ability, already in place, Encore into something that has not moved. Those are near-certainties
 * rather than judgements, and a move that cannot function is never the best move, so pruning on them
 * cannot cost the winner.
 *
 * WHAT THIS DELIBERATELY ALSO REPORTS
 * -----------------------------------
 * Recall at k is meaningless without the number of candidates. If a typical decision offers six options,
 * then "the winner is in my top 5" is nearly free and says nothing. So this prints the candidate-count
 * distribution and computes recall against a RANDOM shortlist of the same size as the honest baseline.
 * The gap between MAG's recall and random's recall is the actual evidence that pruning works.
 *
 * SAME CORPUS AND SAME SPLIT AS THE FIT. Held out by GAME on hash(game) % 5, exactly as
 * engine/fit_policy.js does, so this reads the model on data it was not trained on. Note the caveat
 * recorded in docs/SESSION-REVIEW-2026-07-28.md: that split is deterministic and has been inspected
 * across many refits, so it is a validation set in practice rather than a virgin holdout.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const F = require('./fit_policy.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const KS = [1, 2, 3, 5, 8];

if (!process.env.SHOWDOWN_PATH) {
  console.error('set SHOWDOWN_PATH to a built master checkout of pokemon-showdown');
  process.exit(2);
}

const WFILE = process.argv[2] || D('data', 'policy-weights.json');
const W = JSON.parse(fs.readFileSync(WFILE, 'utf8'));
if (W.features.join(',') !== B.FEATURES.join(',')) {
  console.error(`weight file and board.js disagree on the feature list — refit before trusting this.\n` +
    `  weights: ${W.features.length} features, board.js: ${B.FEATURES.length}`);
  process.exit(1);
}
/* The shipped vector, whichever that is. `shipped` names it so this cannot silently read the wrong one. */
const w = W[`weights_${W.shipped}`] || W.weights;

console.log(`RECALL AT K — can MAG's shortlist be trusted to contain the right move?\n`);
console.log(`  weights ${path.relative(ROOT, WFILE)} (${W.shipped}, ${W.features.length} features)`);

const { games } = F.loadCorpus();
const tally = { seen: 0, kept: 0, trivial: 0, noSheet: 0, unmatched: 0, ambiguous: 0, noUser: 0 };
let rows = [];
for (const g of games) rows = rows.concat(F.decisionsFor(g, tally));

/* Held out by GAME, identical to fit_policy.js. */
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const test = rows.filter(r => hash(r.game) % 5 === 0);
console.log(`  corpus  ${games.length.toLocaleString()} games -> ${rows.length.toLocaleString()} decisions, ` +
  `${test.length.toLocaleString()} held out\n`);
if (!test.length) { console.error('no held-out decisions'); process.exit(1); }

const score = x => { let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * x[i]; return s; };

/* Candidate-count distribution first, because recall at k cannot be read without it. */
const counts = {};
for (const r of test) { const n = r.feats.length; counts[n] = (counts[n] || 0) + 1; }
const sizes = Object.keys(counts).map(Number).sort((a, b) => a - b);
const meanCands = test.reduce((a, r) => a + r.feats.length, 0) / test.length;
console.log(`CANDIDATES PER DECISION  (mean ${meanCands.toFixed(1)})`);
for (const n of sizes) {
  const pct = 100 * counts[n] / test.length;
  if (pct >= 0.5) console.log(`  ${String(n).padStart(3)} options  ${pct.toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(pct / 2))}`);
}

/* MAG's recall, and the honest baseline: a random shortlist of the same size. Random recall for a
 * decision with n candidates is min(k,n)/n, which is exactly the "is top-5 of 6 even pruning?" check. */
const hit = {}, rnd = {};
for (const k of KS) { hit[k] = 0; rnd[k] = 0; }
let prunedTotal = 0;
for (const r of test) {
  const n = r.feats.length;
  const scored = r.feats.map((x, i) => ({ i, s: score(x) })).sort((a, b) => b.s - a.s);
  const rank = scored.findIndex(o => o.i === r.chosen);      /* 0 = MAG's top pick */
  for (const k of KS) {
    if (rank < k) hit[k]++;
    rnd[k] += Math.min(k, n) / n;                            /* expected recall of a random shortlist */
  }
  prunedTotal += Math.max(0, n - 5);
}

console.log(`\nHOW OFTEN THE HUMAN'S CHOICE SURVIVES A CUT TO THE TOP k`);
console.log(`  k      MAG      random shortlist      MAG's advantage`);
for (const k of KS) {
  const m = 100 * hit[k] / test.length;
  const b = 100 * rnd[k] / test.length;
  console.log(`  ${String(k).padStart(2)}   ${m.toFixed(1).padStart(6)}%   ${b.toFixed(1).padStart(6)}%` +
    `             ${(m - b >= 0 ? '+' : '')}${(m - b).toFixed(1)} points`);
}

const r5 = 100 * hit[5] / test.length, b5 = 100 * rnd[5] / test.length;
console.log(`\n  average options discarded by a top-5 cut: ${(prunedTotal / test.length).toFixed(1)} per decision`);
console.log(`\nREAD IT THIS WAY`);
console.log(`  A top-5 shortlist keeps the human's move ${r5.toFixed(1)}% of the time, against ${b5.toFixed(1)}%`);
console.log(`  for a random shortlist of the same size. The gap is what pruning is worth; the LEVEL is`);
console.log(`  what the search layer inherits, because whatever fraction is missing here is a ceiling`);
console.log(`  no amount of search or value function can recover.`);
if (r5 >= 90) {
  console.log(`\n  ${r5.toFixed(1)}% at k=5 is high enough to treat MAG as finished work for the pruning role.`);
} else {
  console.log(`\n  ${r5.toFixed(1)}% at k=5 means roughly ${(100 - r5).toFixed(0)} decisions in 100 have the good`);
  console.log(`  move pruned away before search begins. That is the ceiling to fix before building search.`);
}

const out = {
  generated: new Date().toISOString(),
  by: 'engine/recall_at_k.js',
  what: 'How often the human-chosen option survives a cut to MAG\'s top k. The metric for MAG as a ' +
        'PRUNER feeding a search, as opposed to top-1 accuracy which is the metric for MAG as a decider.',
  weights_file: path.relative(ROOT, WFILE),
  shipped_vector: W.shipped,
  n_features: W.features.length,
  corpus: { games: games.length, decisions: rows.length, held_out: test.length },
  mean_candidates: Number(meanCands.toFixed(2)),
  candidate_distribution: counts,
  recall: Object.fromEntries(KS.map(k => [`top${k}`, Number((100 * hit[k] / test.length).toFixed(2))])),
  random_shortlist_recall: Object.fromEntries(KS.map(k => [`top${k}`, Number((100 * rnd[k] / test.length).toFixed(2))])),
  caveat: 'The held-out split is hash(game) % 5, deterministic and inspected across many refits, so it ' +
          'is a validation set in practice rather than an untouched holdout. Recall here is measured ' +
          'against HUMAN choices, which is not the same as against the objectively best move — a human ' +
          'shortlist ceiling, not a game-theoretic one.',
};
fs.writeFileSync(D('data', 'recall-at-k.json'), JSON.stringify(out, null, 1));
console.log(`\nwrote data/recall-at-k.json`);
