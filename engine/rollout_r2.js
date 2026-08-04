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
const EVERY = parseInt(process.env.EVERY || '3', 10);
/* EXPLORE AND MAXTURNS WERE NEVER PASSED, AND THAT IS NOT A NEUTRAL OMISSION.
 *
 * This file called RL.rolloutWinProb without either key, so it inherited engine/rollout_leaf.js:197's
 * `explore = 0` and engine/medicham2-browser.js:1079's `maxTurns = 20`. The leaf MILTANK actually runs
 * in a game is explore=1.0 at maxTurns=60. The published "a leaf costs 5.83 ms" therefore times a
 * DIFFERENT LEAF from the one it is quoted about, at a third of its horizon, and the affordability
 * table underneath it (K=3 -> 0.47 s) inherits that.
 *
 * The defaults below preserve the previous behaviour EXACTLY, so nothing here re-dates the committed
 * artifact by accident. What changes is that both are now explicit, overridable and STAMPED, so the
 * next run says which leaf it timed instead of leaving a reader to trace two library defaults. */
const EXPLORE = parseFloat(process.env.EXPLORE || '0');
const MAXTURNS = parseInt(process.env.MAXTURNS || '0', 10) || null;

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
const { games } = FP.loadCorpus();

console.log('ROLLOUT R2 — what one leaf costs, and what that buys\n');
/* WHICH LEAF, ON THE SCREEN, BEFORE THE NUMBERS. A cost is meaningless without it: MILTANK's in-game
 * leaf is explore=1.0 at maxTurns=60, and this gate has always timed explore=0 at maxTurns=20 by
 * inheriting two library defaults nobody wrote down. */
console.log(`  leaf timed: explore=${EXPLORE}, maxTurns=${MAXTURNS || 20}` +
  `${(EXPLORE !== 1 || (MAXTURNS || 20) !== 60) ? '   <-- NOT the leaf MILTANK ships (explore=1.0, maxTurns=60)' : ''}\n`);

const timings = {};           /* n -> [ms per leaf, per board] */
for (const n of N_LIST) timings[n] = [];
let boards = 0;
/* THE ARTIFACT SAID "477 boards over 200 games" AND 200 WAS AN ENVIRONMENT VARIABLE.
 * `games: GAMES` is the CAP handed to JR.build, not a count of anything, and engine/status.js prints
 * it in a sentence that reads as a measurement. A distinct-id set is the measurement. */
const gamesSeen = new Set();

JR.build(games, dex, {
  topK: 3, w1, maxGames: GAMES, onRow: () => {},
  onBoard: (board, g, gi) => {
    boards++;
    gamesSeen.add(g && g.id != null ? g.id : gi);
    if (boards % EVERY) return;             /* sample, so one long game does not dominate */
    const field = { weather: board.weather || '', terrain: '',
                    tr: board.hasField('trickroom') ? 5 : 0,
                    twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
                    twB: board.hasSide('p2', 'tailwind') ? 4 : 0 };
    for (const n of N_LIST) {
      const t = process.hrtime.bigint();
      const opts = { n, dex, seed: gi * 104729 + boards, field, explore: EXPLORE };
      if (MAXTURNS) opts.maxTurns = MAXTURNS;
      const r = RL.rolloutWinProb(board, 'p1', opts);
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
  /* THE HORIZON WAS HARDCODED AT 20 IN THIS SENTENCE while the number it describes came from
   * whatever maxTurns was in force. It is now read from the config, because "up to 20 turns" printed
   * beside a 60-turn measurement is a false sentence next to a true number, and the sentence is what
   * gets quoted. */
  const H = MAXTURNS || 20;
  console.log(`  A ROLLOUT LEAF costs ${med.toFixed(2)} ms median and plays the position OUT, up to ${H} turns, ${NUSE} times.`);
  /* THE RATIO, COMPUTED RATHER THAN REMEMBERED. docs/ROLLOUT-design.md 5 says "roughly 200x the
   * simulated turns per millisecond"; the artifacts it cites give 155x, and 155x is itself a CEILING
   * because it assumes every playout runs the full horizon and most end early. Printing the division
   * is cheaper than arguing about it later. */
  const ratio = (NUSE * H / med) / (1 / fork.forkCostMs.median);
  console.log(`  Per simulated turn that is ${ratio.toFixed(0)}x cheaper AT MOST — the ${NUSE}x${H} assumes no`);
  console.log('  playout ends early, and they do, so the true ratio is lower.');
  console.log('  So the rollout is not the expensive half of this design — it is cheaper per unit of');
  console.log('  information than the transition the fork-based search would need anyway.');
} else {
  console.log('  data/lookahead-cost.json missing, so the fork comparison is omitted rather than guessed.');
}
console.log(`\n  budget ${BUDGET_MS} ms per decision (BUDGET_MS to change). Cell counts are K^4 from`);
console.log('  engine/truncation_curve.js: K per slot, two slots a side, two sides.');

/* WHY THIS ARTIFACT IS NOT CALLED rollout-r2.json. It should be. It is the only rung in the ladder
 * whose file does not carry its gate's name, which is why a reader looking for R2 finds nothing.
 * Renaming it means updating engine/status.js:230, web/build-status.js:200 and :265, and regenerating
 * web/status-data.js — four readers, one of them in a directory MEASURE does not own. Filed in
 * docs/MEASURE.md rather than half-done here; a rename that misses one reader is worse than the
 * inconsistency, because the missed reader prints NOT DERIVED and reads as "nobody ran this". */
fs.writeFileSync(D('data', 'rollout-cost.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/rollout_r2.js',
  gate: 'R2 — what does a rollout leaf cost',
  /* A COMMON COUNT AND ITS UNIT. R1 published `positions`, R2 `boards`, R3 `decisions`, R4
   * `decisive_pairs` — four names for the same slot, so comparing two rungs meant reading two
   * generators first. `n_measured` is the number; `n_unit` says what one of them IS, which is the
   * part that actually differs. The old names stay so no reader breaks.
   *
   * NOT called `n`: data/rollout-r3.json has published `n` as the ROLLOUT BUDGET since 2026-08-03,
   * and a key meaning a sample size in one rung and a budget in the next is worse than no common key. */
  n_measured: timings[NUSE].length,
  n_unit: `timed leaf calls at n=${NUSE}, on boards sampled every ${EVERY}th`,
  boards: timings[NUSE].length,
  /* `games` is now the number of games actually TRAVERSED. It used to be the GAMES cap. */
  games: gamesSeen.size,
  games_requested: GAMES,
  boards_traversed: boards,
  sample_every: EVERY,
  /* PER-n SAMPLE SIZES, because they are not guaranteed equal. A leaf that returns null at one n and
   * not another leaves the quantile columns measured over different board sets, and only the n=10
   * count was ever recorded. */
  samples_per_n: Object.fromEntries(N_LIST.map(n => [n, timings[n].length])),
  leafCostMs: Object.fromEntries(N_LIST.map(n => [n, { median: q(timings[n], 0.5), p90: q(timings[n], 0.9), max: q(timings[n], 1) }])),
  /* WHICH LEAF WAS TIMED. This is the R1 hole in cost form: explore and maxTurns were library
   * defaults, were never written down, and are not the ones the bot ships with. */
  leaf_config: {
    explore: EXPLORE,
    maxTurns: MAXTURNS,
    maxTurns_effective: MAXTURNS || 20,
    maxTurns_source: MAXTURNS ? 'MAXTURNS env' : 'engine/medicham2-browser.js:1079 default',
    foePolicy: 'uniform (engine/rollout_leaf.js default)',
    shipped_leaf: 'explore=1.0, maxTurns=60 — see docs/MEASURE.md. If leaf_config differs from that, '
      + 'these timings are NOT the cost of the leaf MILTANK runs, and the affordability table above '
      + 'inherits the difference.',
  },
  /* `caveats` as an ARRAY, matching data/rollout-r1.json and data/rollout-r4.json. This file used a
   * scalar `note` and rollout-r3.json a scalar `caveat`, three shapes for one idea across four
   * artifacts. Nothing reads the old key: engine/status.js and web/build-status.js both read only
   * boards / games / generated / verdict*, so the change breaks no reader. */
  caveats: [
    'n is chosen by R1, which found accuracy flat in N; this file times, it does not judge.',
    'A TIMING IS NOT RECOMPUTABLE. Every other rung can be re-derived from committed rows; this one '
    + 'cannot, because it measures a machine under a load and dumps no per-leaf sample. Nothing '
    + 'records the CPU, the node version or what else was running. It is re-run or it is nothing.',
    'READ leaf_config BEFORE QUOTING A COST. explore and maxTurns are what decide how long a playout '
    + 'runs, and both were library defaults here until 2026-08-04.',
  ],
}, null, 2) + '\n');
console.log('\n  wrote data/rollout-cost.json');

/* THE STAMP. One shared implementation — engine/run_stamp.js — so r2, r3 and the r1 dump cannot drift
 * into three sidecar formats. See that file's header for what R1 cost by not having one. */
{
  const RS = require('./run_stamp.js');
  const { path: metaPath } = RS.writeStamp({
    by: 'engine/rollout_r2.js',
    describes: 'data/rollout-cost.json',
    rows: timings[NUSE].length,
    n_unit: 'timed leaf calls',
    measured: {
      key: `n=${NUSE}`,
      n_rollouts: NUSE,
      explore: EXPLORE,
      maxTurns: MAXTURNS || 20,
      note: 'The cost column the affordability table and every downstream quote are computed from. '
        + 'It is the SMALLEST n in N_LIST, chosen because R1 found accuracy flat in N.',
    },
    sweep: { N_LIST, EXPLORE, MAXTURNS, EVERY, GAMES, BUDGET_MS, corpus_games: games.length, games_seen: gamesSeen.size },
    sources: ['engine/rollout_r2.js', 'engine/joint_rows.js', 'engine/fit_policy.js'],
  });
  console.log(`  wrote ${metaPath} — n=${NUSE}, explore=${EXPLORE}, maxTurns=${MAXTURNS || 20}`);
}
