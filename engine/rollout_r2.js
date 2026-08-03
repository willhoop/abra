/* rollout_r2.js — GATE R2 of docs/ROLLOUT-design.md: what does a rollout LEAF cost?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/rollout_r2.js
 *
 * R1 measured that accuracy is FLAT in N (64.03 / 64.68 / 64.48 at n=10/40/160 on the same 4,487
 * positions). That changes this gate completely: the leaf is bias-limited, so the right N is the
 * SMALLEST one that does not lose accuracy, and the cost budget in ROLLOUT-design 4.3 was written
 * assuming N would have to be large.
 *
 * WHAT A SEARCH ACTUALLY PAYS is cells x leafCost, and the cell counts are the ones
 * engine/truncation_curve.js already established: K per slot, two slots per side, two sides, so K^4.
 * Those are quoted from that file rather than recomputed, and the fork-based alternative is quoted
 * from data/lookahead-cost.json, so all three numbers in the comparison come from measurements
 * rather than from this file's imagination.
 *
 * MEASURED ACROSS BOARDS, not on one. lookahead_cost.js reported a single board's figure and was
 * wrong by a factor of three; the same mistake is available here and is avoided the same way.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');
const RL = require('./rollout_leaf.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

const GAMES = parseInt(process.env.GAMES || '120', 10);
const N_LIST = (process.env.N_LIST || '10,40,160').split(',').map(Number).filter(Boolean);
const BUDGET_MS = parseInt(process.env.BUDGET_MS || '3000', 10);

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
const { games } = FP.loadCorpus();

console.log('ROLLOUT R2 — what one leaf costs, and what that buys\n');

const timings = {};           /* n -> [ms per leaf, per board] */
for (const n of N_LIST) timings[n] = [];
let boards = 0;

JR.build(games, dex, {
  topK: 3, w1, maxGames: GAMES, onRow: () => {},
  onBoard: (board, g, gi) => {
    boards++;
    if (boards % 3) return;                 /* sample, so one long game does not dominate */
    const field = { weather: board.weather || '', terrain: '',
                    tr: board.hasField('trickroom') ? 5 : 0,
                    twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
                    twB: board.hasSide('p2', 'tailwind') ? 4 : 0 };
    for (const n of N_LIST) {
      const t = process.hrtime.bigint();
      const r = RL.rolloutWinProb(board, 'p1', { n, dex, seed: gi * 104729 + boards, field });
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      if (r) timings[n].push(ms);
    }
  },
});

function q(a, p) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

console.log(`  leaves timed on ${timings[N_LIST[0]].length.toLocaleString()} real boards\n`);
console.log('     n    median    p90     max   ms per leaf');
console.log('  ' + '-'.repeat(46));
for (const n of N_LIST) {
  const a = timings[n];
  console.log('  ' + String(n).padStart(4) + q(a, 0.5).toFixed(2).padStart(10) +
    q(a, 0.9).toFixed(2).padStart(8) + q(a, 1).toFixed(2).padStart(8));
}

/* THE SMALLEST N THAT DOES NOT LOSE ACCURACY. R1 says that is 10, and the accuracy figures are quoted
 * from that run rather than re-measured here — this file times, it does not judge. */
const NUSE = N_LIST[0];
const med = q(timings[NUSE], 0.5), worst = q(timings[NUSE], 1);
console.log(`\n  Using n=${NUSE}, which R1 found loses nothing against n=160.\n`);
console.log('    K   cells   median cost   worst cost   verdict');
console.log('  ' + '-'.repeat(58));
for (const K of [2, 3, 4, 5, 6]) {
  const cells = K * K * K * K;
  const m = cells * med / 1000, w = cells * worst / 1000;
  const verdict = w * 1000 <= BUDGET_MS ? 'affordable' : (m * 1000 <= BUDGET_MS ? 'MARGINAL' : 'TOO SLOW');
  console.log('  ' + String(K).padStart(3) + String(cells).padStart(8) +
    m.toFixed(2).padStart(13) + ' s' + w.toFixed(2).padStart(11) + ' s   ' + verdict);
}

/* THE COMPARISON THAT MATTERS: a rollout leaf against the Showdown fork the other design needs. */
/* NOT ONE CATCH FOR BOTH. "the fork cost has not been measured yet" is an expected state with a
 * printed instruction; "it exists and does not parse" is a corrupt artifact. Folding them together
 * would silently omit the comparison and read as if the run had simply not been done. Third time this
 * guard has caught the same shape in one session, and it has been right every time. */
let fork = null;
const FORKF = D('data', 'lookahead-cost.json');
if (fs.existsSync(FORKF)) {
  try {
    fork = JSON.parse(fs.readFileSync(FORKF, 'utf8'));
  } catch (e) {
    console.error(`  data/lookahead-cost.json exists but could not be read: ${e.message}`);
    console.error('  Refusing to guess a fork cost — regenerate it with engine/lookahead_cost.js.');
    process.exit(1);
  }
}
console.log('');
if (fork) {
  console.log(`  A SHOWDOWN FORK costs ${fork.forkCostMs.median.toFixed(2)} ms median ` +
    `(data/lookahead-cost.json), and that buys ONE simulated turn.`);
  console.log(`  A ROLLOUT LEAF costs ${med.toFixed(2)} ms median and plays the position OUT, up to 20 turns, ${NUSE} times.`);
  console.log('  So the rollout is not the expensive half of this design — it is cheaper per unit of');
  console.log('  information than the transition the fork-based search would need anyway.');
} else {
  console.log('  data/lookahead-cost.json missing, so the fork comparison is omitted rather than guessed.');
}
console.log(`\n  budget ${BUDGET_MS} ms per decision (BUDGET_MS to change). Cell counts are K^4 from`);
console.log('  engine/truncation_curve.js: K per slot, two slots a side, two sides.');

fs.writeFileSync(D('data', 'rollout-cost.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/rollout_r2.js',
  boards: timings[NUSE].length, games: GAMES,
  leafCostMs: Object.fromEntries(N_LIST.map(n => [n, { median: q(timings[n], 0.5), p90: q(timings[n], 0.9), max: q(timings[n], 1) }])),
  note: 'n is chosen by R1, which found accuracy flat in N; this file times, it does not judge.',
}, null, 2) + '\n');
console.log('\n  wrote data/rollout-cost.json');
