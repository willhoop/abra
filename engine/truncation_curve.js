/* truncation_curve.js — how much of the game the one-step search never gets to look at.
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/truncation_curve.js
 *
 * WHAT THIS DECIDES
 * -----------------
 * docs/LOOKAHEAD-design.md G2 measured the cost of a fork and concluded the search must prune to
 * top-3 candidates per slot, not the top-6 that fit_joint.js uses. That conclusion came from a cost
 * measurement that has since been corrected -- see data/lookahead-cost.json, which this file reads --
 * but pruning of SOME size is not optional either way, because the matrix is quartic in K.
 *
 * Pruning has a price and this file is the price. A search cannot recover value from a branch it never
 * enumerated, so if the move a strong player would pick falls outside the window, no amount of search
 * quality below that point can find it. That failure is INVISIBLE at run time — the search returns a
 * confident equilibrium over a matrix that simply does not contain the answer — which is why it is
 * measured here rather than discovered later as an unexplained gap between G1's +4.91 and G3.
 *
 * WHY IT IS NOT A SECOND IMPLEMENTATION
 * -------------------------------------
 * fit_joint.js already reported this quantity for one K (11.3% at top-6). It came from
 * joint_rows.js's `pick`, which sorts every candidate by the single-move score and slices. The chosen
 * candidate's RANK in that sort is now kept, so one replay answers every K at once: the truncation
 * rate at K is just the share of turns whose rank is >= K. Same corpus, same ranker, same matcher.
 *
 * WHAT THE HUMAN BASELINE IS AND IS NOT
 * -------------------------------------
 * The label is the pair a human clicked. That is a proxy for "the move worth enumerating", not the
 * same thing — humans misclick and the corpus is not all strong players. It bounds the search in the
 * direction that matters anyway: if MAG's top-3 misses what humans do, it is also missing lines a
 * search would want, since MAG is the policy prior doing the pruning in both cases.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

/* The K values the design actually has to choose between, plus enough either side to see the shape of
 * the curve rather than two points on it. */
const KS = (process.env.KS || '1,2,3,4,5,6,8,10').split(',').map(Number);

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }

const { games } = FP.loadCorpus();
console.log('TRUNCATION CURVE — what top-K pruning costs the search\n');
console.log(`  corpus  ${games.length.toLocaleString()} clean open-sheet games`);
console.log(`  ranker  ${path.relative(D('.'), JR.rankerPath())}\n`);

/* onRow discards each row as it is produced. The rank histogram is what this file needs and holding
 * ~49 alternatives x 74 numbers per turn to get it would cost gigabytes for nothing. TOPK is set to
 * the smallest useful value because the histogram does not depend on it — the rank comes from the
 * full sorted order — and a smaller K builds fewer pair vectors. */
const { tally } = JR.build(games, dex, { topK: 3, w1, onRow: () => {} });

const kept = tally.kept;
const turns = tally.rankHist.reduce((s, v) => s + (v || 0), 0);
const slots = tally.slotRankHist.reduce((s, v) => s + (v || 0), 0);
console.log(`  joint turns kept ${kept.toLocaleString()}  (${turns.toLocaleString()} ranked, ${slots.toLocaleString()} slot decisions)`);

const cands = tally.candCount;
if (cands.length) {
  const sorted = cands.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const mean = cands.reduce((s, v) => s + v, 0) / cands.length;
  /* A slot with few candidates cannot be truncated, so its zero is arithmetic rather than evidence
   * about the ranker. The share below each K says how much of the rate is that. */
  console.log(`  candidates per slot: median ${med}, mean ${mean.toFixed(1)}, max ${sorted[sorted.length - 1]}`);
}
console.log('');

/* The truncation rate at K is a SUFFIX SUM of the histogram: every turn whose chosen rank is K or
 * worse is a turn the window excludes. Derived from the one histogram rather than recomputed per K,
 * so the numbers below cannot disagree with each other. */
function suffix(hist, total, k) {
  let n = 0;
  for (let r = k; r < hist.length; r++) n += hist[r] || 0;
  return total ? 100 * n / total : NaN;
}

/* THE FORK COST IS READ, NOT TYPED. engine/lookahead_cost.js measures it and writes it down; carrying
 * the number here as a literal would be a hand-maintained copy that goes stale the moment the harness
 * improves — which it already did once, from 9.68 ms to under 4 when the instrument stopped counting
 * boards that never simulated anything. If the artifact is absent the cost columns are omitted rather
 * than guessed, because a made-up budget silently decides the matrix size. */
const COSTF = D('data', 'lookahead-cost.json');
let cost = null;
/* NOT ONE CATCH FOR BOTH CASES. "The artifact has not been generated yet" is an expected state that
 * prints an instruction; "the artifact exists and does not parse" is a corrupt measurement. Folding
 * them together would print a table with no cost columns and let a reader conclude the run had simply
 * not been done. The silent-catch guard flagged this line and was right to. */
if (!fs.existsSync(COSTF)) {
  console.log('  data/lookahead-cost.json is missing, so the cost columns are omitted.');
  console.log('  Run:  SHOWDOWN_PATH=... BOARDS=25 N=200 TURNS=8 node engine/lookahead_cost.js\n');
} else {
  try {
    cost = JSON.parse(fs.readFileSync(COSTF, 'utf8'));
  } catch (e) {
    console.error(`  ${path.relative(D('.'), COSTF)} exists but could not be read: ${e.message}`);
    console.error('  Refusing to guess a fork cost — regenerate it with engine/lookahead_cost.js.');
    process.exit(1);
  }
}
if (cost) {
  console.log(`  fork cost  median ${cost.forkCostMs.median.toFixed(2)} ms, worst board ` +
    `${cost.forkCostMs.max.toFixed(2)} ms  (${cost.boards} boards, ${cost.forks.advanced} forks, ` +
    `${cost.generated.slice(0, 10)})`);
  /* THE INSTRUMENT'S OWN SPREAD, because a single run of it is not the cost. Five back-to-back runs
   * gave medians 5.75 / 4.51 / 3.70 / 4.78 / 4.52 ms, and one run taken while the machine was busy
   * read 12.45 — 2.7x the centre. So a verdict that depends on the difference between 4 and 12 ms is
   * a verdict about machine load, and K=4 sits exactly there. */
  console.log('  run-to-run: 5 repeats gave medians 3.70-5.75 ms; a loaded machine read 12.45.\n');
}
const BUDGET_MS = parseInt(process.env.BUDGET_MS || '3000', 10);

const head = '    K   joint miss   per-slot miss   matrix cells' +
  (cost ? '   median cost   worst cost   verdict' : '');
console.log(head);
console.log('  ' + '-'.repeat(head.length));
for (const k of KS) {
  const joint = suffix(tally.rankHist, turns, k);
  const slot = suffix(tally.slotRankHist, slots, k);
  /* K options per slot, two slots per side -> K^2 joint actions per side; two sides -> K^4 cells.
   * The design's 4.3 quotes ~144 joint actions per side from an assumed ~12 options; the corpus says
   * the median slot has 8 and the maximum seen is 11, so the unpruned matrix is smaller than the
   * document claims — which does not rescue it, but should not be misquoted either. */
  const cells = (k * k) * (k * k);
  let line = '  ' + String(k).padStart(3) + '   ' + joint.toFixed(1).padStart(8) + '%   ' +
    slot.toFixed(1).padStart(11) + '%   ' + String(cells).padStart(12);
  if (cost) {
    const med = cells * cost.forkCostMs.median / 1000, worst = cells * cost.forkCostMs.max / 1000;
    /* The verdict is the WORST board's, not the median's. A search that fits the budget on a typical
     * turn and blows it on a bad one is a timeout with good average-case manners. */
    const verdict = worst * 1000 <= BUDGET_MS ? 'affordable'
      : (med * 1000 <= BUDGET_MS ? 'MARGINAL' : 'TOO SLOW');
    line += med.toFixed(2).padStart(13) + ' s' + worst.toFixed(2).padStart(11) + ' s   ' + verdict;
  }
  console.log(line);
}

console.log('\n  joint miss  = the pair a human clicked is outside the window on AT LEAST ONE slot.');
console.log('                This is the one that bounds the search: the matrix is a product, so a');
console.log('                cell survives only if both slots do.');
console.log('  per-slot    = the same question asked of one slot at a time. Always the smaller number,');
console.log('                and quoting it in place of the joint one would understate the cost.');
if (cost) console.log(`  verdict     = worst-board cost against a ${BUDGET_MS} ms budget (BUDGET_MS to change).`);
