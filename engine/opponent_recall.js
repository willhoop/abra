/* opponent_recall.js — can MAG narrow the OPPONENT's turn? The question that decides whether MAG is
 * load-bearing or decorative.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/opponent_recall.js
 *
 * WHY THIS EXISTS, AND WHY recall_at_k.js DOES NOT ANSWER IT
 * ---------------------------------------------------------
 * engine/recall_at_k.js measures whether the human's choice survives a cut to MAG's top k FOR ONE
 * POKEMON: 87.9% at k=5 against a mean of 7.3 options. That is a real number and it is used to argue
 * MAG is good enough to prune.
 *
 * It does not support the conclusion the search layer needs, for two reasons.
 *
 * ONE: ON MY OWN SIDE, ORDERING BUYS NOTHING. The plan is to search all ~7 candidates rather than
 * prune to 5, precisely because 7 is cheap and pruning costs 12% of the good moves. But if every
 * candidate is searched, the ORDER they are searched in does not change the answer — search order
 * only matters under pruning, a time cutoff, or PUCT-style budget allocation. So on my own side a
 * better-ordered list of things I am going to evaluate anyway is worth approximately zero.
 *
 * TWO: THE BRANCHING THAT COSTS IS THEIRS, AND IT IS THE SQUARE. A VGC turn is a JOINT choice of two
 * Pokemon. Measured over 7,254 real decisions: ~7.1 options per Pokemon, so ~51 joint actions per
 * side, and the matrix of mine against theirs is ~2,584 cells — about two minutes a turn at 50ms a
 * rollout. The EV of a move is a sum over THEIR actions weighted by how likely each is:
 *
 *     EV(a) = SUM_r P(r) . SUM_b sigma_opp(b|r) . V(T(s,a,b))
 *
 * so the term that has to be abstracted is sigma_opp — their ~51, not my ~7. If MAG can rank the
 * opponent's joint action and put the real one in a short list, the matrix collapses from 2,584 to a
 * few hundred and EV becomes computable. If it cannot, MAG is not doing the job the architecture
 * needs done, and the honest conclusion is that its remaining value is as a futility filter.
 *
 * THAT IS THE WHOLE MEASUREMENT: recall of the opponent's JOINT action at k.
 *
 * WHAT IT SCORES WITH, STATED
 * ---------------------------
 * The joint score is the SUM of the two per-slot scores under the shipped 47-feature weights. It is
 * not the fitted joint layer: data/policy-weights-joint.json carries 46 features against board.js's
 * 47, so it predates the current vector and is stale — the same feature-count guard recall_at_k.js
 * applies. An additive score is also exactly what a policy PRIOR supplies to a search, which is the
 * role being tested, so this is the relevant quantity rather than a fallback.
 *
 * THE BASELINE IS THE POINT. Recall at k means nothing without the size of the set: "the real joint
 * action is in my top 20 of 51" is nearly free. Every k is reported against a random shortlist of the
 * same size, and the GAP is the evidence.
 *
 * SAME CORPUS AND SAME HELD-OUT SPLIT as the fit and as recall_at_k.js — hash(game) % 5 — so this
 * reads the model on games it was not trained on. Same caveat too: that split is deterministic and
 * has been inspected across many refits, so it is a validation set in practice rather than a virgin
 * holdout, and recall is measured against HUMAN choices rather than objectively best ones.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('./fit_policy.js');
const B = require('./board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const KS = [1, 2, 3, 5, 8, 10, 15, 20];

if (!process.env.SHOWDOWN_PATH) {
  console.error('set SHOWDOWN_PATH to a built master checkout of pokemon-showdown');
  process.exit(2);
}

const WFILE = process.argv[2] || D('data', 'policy-weights.json');
const W = JSON.parse(fs.readFileSync(WFILE, 'utf8'));
if (W.features.join(',') !== B.FEATURES.join(',')) {
  console.error('weight file and board.js disagree on the feature list — refit before trusting this.\n' +
    `  weights: ${W.features.length} features, board.js: ${B.FEATURES.length}`);
  process.exit(1);
}
const w = W[`weights_${W.shipped}`] || W.weights;
const score = x => { let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * x[i]; return s; };

console.log('OPPONENT RECALL — can MAG narrow the other player\'s TURN?\n');
console.log(`  weights ${path.relative(ROOT, WFILE)} (${W.shipped}, ${W.features.length} features)`);

const { games } = F.loadCorpus();
const tally = { seen: 0, kept: 0, trivial: 0, noSheet: 0, unmatched: 0, ambiguous: 0, noUser: 0 };
let rows = [];
for (const g of games) rows = rows.concat(F.decisionsFor(g, tally));

const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const test = rows.filter(r => hash(r.game) % 5 === 0);

/* PAIR THE TWO SLOTS OF ONE PLAYER ON ONE TURN. That pairing is the whole point: a turn is a joint
 * choice, and a per-slot number cannot describe it. Turns where only one slot produced a scoreable
 * decision are counted separately rather than padded — a singleton is a different (easier) problem
 * and mixing it in would flatter the result. */
const byTurn = new Map();
for (const r of test) {
  if (r.turn == null || !r.side) continue;
  const k = `${r.game}|${r.turn}|${r.side}`;
  if (!byTurn.has(k)) byTurn.set(k, []);
  byTurn.get(k).push(r);
}
const joints = [], singles = [];
for (const v of byTurn.values()) {
  if (v.length === 2) joints.push(v);
  else if (v.length === 1) singles.push(v);
}

console.log(`  corpus  ${games.length.toLocaleString()} games -> ${rows.length.toLocaleString()} decisions, ` +
  `${test.length.toLocaleString()} held out`);
console.log(`  of those, ${joints.length.toLocaleString()} full two-slot turns and ` +
  `${singles.length.toLocaleString()} single-slot turns\n`);
if (!joints.length) { console.error('no paired turns — is decisionsFor tagging turn/side?'); process.exit(1); }

/* ---- the joint action space, per turn -------------------------------------------------------- */
const hit = {}, rnd = {};
for (const k of KS) { hit[k] = 0; rnd[k] = 0; }
let sumN = 0; const sizeHist = {};
let perSlotHit5 = 0;

for (const [a, b] of joints) {
  const na = a.feats.length, nb = b.feats.length, n = na * nb;
  sumN += n;
  const bucket = n < 10 ? '<10' : n < 25 ? '10-24' : n < 50 ? '25-49' : n < 100 ? '50-99' : '100+';
  sizeHist[bucket] = (sizeHist[bucket] || 0) + 1;

  /* Score each slot once, then combine. The joint score is additive, so the ranking can be produced
   * without materialising every pair — but n is ~51, so clarity beats cleverness here. */
  const sa = a.feats.map(score), sb = b.feats.map(score);
  const truth = sa.length && sb.length ? (a.chosen * nb + b.chosen) : -1;
  const pairs = new Array(n);
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) pairs[i * nb + j] = { id: i * nb + j, s: sa[i] + sb[j] };
  pairs.sort((x, y) => y.s - x.s);
  const rank = pairs.findIndex(p => p.id === truth);

  for (const k of KS) {
    if (rank >= 0 && rank < k) hit[k]++;
    rnd[k] += Math.min(k, n) / n;
  }
  /* For contrast: how often BOTH slots' real choices are individually inside their own top 5. This is
   * what the per-slot number implies if the two slots were independent, and the gap between it and
   * the joint recall is how much the independence assumption flatters MAG. */
  const ra = sa.map((s, i) => ({ i, s })).sort((x, y) => y.s - x.s).findIndex(o => o.i === a.chosen);
  const rb = sb.map((s, i) => ({ i, s })).sort((x, y) => y.s - x.s).findIndex(o => o.i === b.chosen);
  if (ra < 5 && rb < 5) perSlotHit5++;
}

const meanN = sumN / joints.length;
console.log(`JOINT ACTIONS PER TURN  (mean ${meanN.toFixed(1)})`);
for (const k of ['<10', '10-24', '25-49', '50-99', '100+']) {
  if (!sizeHist[k]) continue;
  const pct = 100 * sizeHist[k] / joints.length;
  console.log(`  ${k.padStart(6)}  ${pct.toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(pct / 2))}`);
}

console.log(`\nHOW OFTEN THE OPPONENT'S REAL TURN SURVIVES A CUT TO THE TOP k`);
console.log('   k       MAG      random        advantage');
for (const k of KS) {
  const m = 100 * hit[k] / joints.length, r = 100 * rnd[k] / joints.length;
  console.log(`  ${String(k).padStart(2)}   ${m.toFixed(1).padStart(6)}%   ${r.toFixed(1).padStart(6)}%` +
    `        ${(m - r >= 0 ? '+' : '')}${(m - r).toFixed(1)} points`);
}

const r5 = 100 * hit[5] / joints.length;
const r10 = 100 * hit[10] / joints.length;
const r20 = 100 * hit[20] / joints.length;
const indep = 100 * perSlotHit5 / joints.length;

console.log(`\n  both slots individually inside their own top 5: ${indep.toFixed(1)}%`);
console.log(`  (that is the per-slot number's implied joint recall — it needs a 25-cell shortlist,`);
console.log(`   not a 5-cell one, so it is not comparable to the k=5 row above)`);

console.log('\nWHAT THIS MEANS FOR THE SEARCH LAYER');
console.log(`  The matrix is mine (~51) x theirs (~${meanN.toFixed(0)}). Cutting THEIR side to k is what`);
console.log('  makes EV computable, so the usable abstraction is the smallest k with acceptable recall:');
console.log(`     k=5   ${r5.toFixed(1)}%   -> matrix ~${Math.round(51 * 5).toLocaleString()} cells`);
console.log(`     k=10  ${r10.toFixed(1)}%   -> matrix ~${Math.round(51 * 10).toLocaleString()} cells`);
console.log(`     k=20  ${r20.toFixed(1)}%   -> matrix ~${Math.round(51 * 20).toLocaleString()} cells`);
console.log('  Whatever fraction is missing is a CEILING: an opponent action pruned here is one the');
console.log('  search can never consider, however good the value function becomes.');

const out = {
  generated: new Date().toISOString(),
  by: 'engine/opponent_recall.js',
  what: 'Recall of the OPPONENT\'S JOINT (two-slot) action at k. The metric for MAG as the sigma_opp ' +
        'abstraction in the EV sum, which is the branching that actually costs — as opposed to ' +
        'recall_at_k.js, which measures one Pokemon\'s choice and describes a list the search layer ' +
        'intends to evaluate in full anyway.',
  weights_file: path.relative(ROOT, WFILE),
  shipped_vector: W.shipped,
  n_features: W.features.length,
  scoring: 'additive: the joint score is the sum of the two per-slot scores. The fitted joint layer ' +
           '(data/policy-weights-joint.json) is STALE — 46 features against board.js\'s 47 — and was ' +
           'not used. An additive score is also what a policy prior supplies to a search.',
  corpus: { games: games.length, decisions: rows.length, held_out: test.length,
            paired_turns: joints.length, single_slot_turns: singles.length },
  mean_joint_actions: Number(meanN.toFixed(2)),
  joint_size_distribution: sizeHist,
  recall: Object.fromEntries(KS.map(k => [`top${k}`, Number((100 * hit[k] / joints.length).toFixed(2))])),
  random_shortlist_recall: Object.fromEntries(KS.map(k => [`top${k}`, Number((100 * rnd[k] / joints.length).toFixed(2))])),
  both_slots_in_own_top5: Number(indep.toFixed(2)),
  caveat: 'Held out by hash(game) % 5, deterministic and inspected across many refits, so a validation ' +
          'set in practice rather than a virgin holdout. Recall is against the HUMAN\'s joint choice, ' +
          'not the objectively best one. Turns where only one slot produced a scoreable decision are ' +
          'reported separately and excluded, because a singleton is an easier problem.',
};
fs.writeFileSync(D('data', 'opponent-recall.json'), JSON.stringify(out, null, 1));
console.log('\nwrote data/opponent-recall.json');
