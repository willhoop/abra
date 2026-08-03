/* rollout_r1.js — GATE R1 of docs/ROLLOUT-design.md.
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/rollout_r1.js
 *
 * THE QUESTION, AND WHY IT COMES BEFORE ANY SEARCH
 * ------------------------------------------------
 * Every search maximises a leaf, and ours is weak: data/porygon3.json scores PORYGON3 at 63.70%
 * against 60.28% for "material sign" — literally counting bodies and HP. The whole learned value
 * function is worth 3.4 points over counting. That is the best available explanation for why one step
 * of foresight measures small once the clock artifact is removed (+2.29, not +4.91).
 *
 * So: can a MEDICHAM ROLLOUT judge a position better than the k-NN? No search, no matrix, no
 * equilibrium — just "play it out and see who wins". If the answer is no, the whole rollout-leaf idea
 * dies for the price of an afternoon, which is the cheapest null available and the reason R1 is first.
 *
 * WHICH CORPUS, AND WHY IT IS NOT A CHOICE
 * ----------------------------------------
 * docs/DATA-LAW.md case 2: this is an ABSOLUTE accuracy claim compared against a published number, so
 * it must run on held-out HUMAN games. Self-play would be doubly circular — the outcomes come from our
 * own bot, and PORYGON3 was fitted on self-play, so a self-play evaluation would flatter the incumbent
 * as well as the challenger.
 *
 * THE BASELINE IS RECOMPUTED, NOT QUOTED
 * --------------------------------------
 * `material sign` is measured on THESE positions rather than read from porygon3.json. A published
 * number from a different sample is a different question, and comparing against it is how the
 * withdrawn Sucker Punch claim happened. Coin is included for the same reason: an instrument that
 * cannot beat a coin on this sample has not earned the right to be compared to anything.
 *
 * ONE REPLAY, NOT A SECOND ONE. Positions come from joint_rows.js's `onBoard` observer, so this file
 * does not re-implement the event walk that turns a replay into a board.
 */
'use strict';
const path = require('path');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');
const B = require('./board.js');
const RL = require('./rollout_leaf.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

const GAMES = parseInt(process.env.GAMES || '150', 10);
const N = parseInt(process.env.N || '40', 10);
/* Every EVERY_TH turn, so a long game does not dominate the sample with near-identical late boards. */
const EVERY = parseInt(process.env.EVERY || '2', 10);

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
const { games } = FP.loadCorpus();

console.log('ROLLOUT R1 — is playing it out a better judge than the k-NN?\n');
console.log(`  corpus  ${games.length.toLocaleString()} clean open-sheet games, first ${GAMES} sampled`);
console.log(`  leaf    MEDICHAM seeded mid-game, ${N} rollouts per position, every ${EVERY}th turn\n`);

/* MATERIAL SIGN, the baseline that matters. Bodies first, then summed HP fraction — the same quantity
 * MEDICHAM's own battleResult uses at the 20-turn horizon, which is deliberate: if the rollout only
 * matches this, then it is an expensive way to count, and that is worth knowing. */
function materialP(board, side) {
  const foe = side === 'p1' ? 'p2' : 'p1';
  const count = s => {
    let alive = 0, hp = 0;
    for (const L of ['a', 'b']) { const m = board.slot(s, L); if (m && !m.fainted) { alive++; hp += (typeof m.hp === 'number' ? m.hp : 1); } }
    for (const sp of board.bench(s)) { void sp; alive++; hp += 1; }
    return { alive, hp };
  };
  const a = count(side), b = count(foe);
  if (a.alive !== b.alive) return a.alive > b.alive ? 1 : 0;
  if (Math.abs(a.hp - b.hp) > 1e-9) return a.hp > b.hp ? 1 : 0;
  return 0.5;
}

/* SELF-CHECK BEFORE THE AGGREGATE. A leaf that cannot call a position where one side has four
 * healthy bodies and the other has one on its last legs is broken, and a broken leaf will still
 * produce a plausible-looking accuracy table. This is the same guard medicham_coverage.js needed:
 * an instrument that returns nothing and an engine that knows nothing print the same number. */
{
  /* SPECIES COME FROM THE TABLE, not from names typed here. The first version named real VGC
   * Pokemon — Landorus-Therian, Incineroar — and MC.mons is keyed differently, so nothing resolved,
   * two bodies were built and the check reported 50%. It caught itself, which is the point, but a
   * fixture that hardcodes identifiers is the same second-source-of-truth mistake in miniature. */
  const pool = Object.keys(globalThis.MC.mons).slice(0, 8);
  const bd = new B.Board();
  for (const side of ['p1', 'p2']) bd.setParty(side, pool.slice(0, 4));
  bd.switchIn('p1', 'a', pool[0]); bd.switchIn('p1', 'b', pool[1]);
  bd.switchIn('p2', 'a', pool[0]);
  const weak = bd.slot('p2', 'a'); if (weak) weak.hp = 0.05;
  bd.faint('p2', 'b');
  const chk = RL.rolloutWinProb(bd, 'p1', { n: 60, dex, seed: 11 });
  if (!chk) { console.error('  SELF-CHECK could not build a board at all — aborting.'); process.exit(1); }
  console.log(`  self-check: 2 healthy + bench vs 1 at 5% HP  ->  p1 ${(100 * chk.p).toFixed(1)}%  ` +
    `(${chk.built} bodies, dropped ${JSON.stringify(chk.dropped)})  ` +
    `${chk.p > 0.65 ? 'sane' : '<-- SUSPECT, an ahead position should not be a coin flip'}`);
  if (chk.p <= 0.55) {
    console.error('  The leaf cannot call a won position. Nothing below would mean anything.');
    process.exit(1);
  }
  console.log('');
}

const rows = [];
let sampled = 0, nulls = 0, unlabelled = 0;
const t0 = Date.now();

JR.build(games, dex, {
  topK: 3, w1, maxGames: GAMES,
  onRow: () => {},
  onBoard: (board, g, gi) => {
    sampled++;
    if (sampled % EVERY) return;
    /* The label is which SIDE won. `g.p1` is an OBJECT — {name, rating, bot} — not a string, so
     * comparing the winner against it directly is always false and silently drops every position.
     * It did exactly that on the first run and the report said "no positions scored", which is the
     * only reason it was caught rather than becoming a sample of whatever survived. */
    const y = g.winner === (g.p1 && g.p1.name) ? 1
            : (g.winner === (g.p2 && g.p2.name) ? 0 : null);
    if (y === null) { unlabelled++; return; }
    /* THE FIELD HAS TO TRAVEL WITH THE POSITION. rolloutWinProb accepts it and the first version of
     * this file never passed it, so every rollout ran in clear skies with no room and no tailwind —
     * which silently deletes Aurora Veil, every weather-scaled move, Swift Swim and Chlorophyll, and
     * inverts the speed order under Trick Room. Exactly the one-directional error docs/ROLLOUT-design
     * 4.1 warns about, committed by the harness rather than the engine. A rollout judged on a board
     * it was never told about is not a measurement of the rollout. */
    const field = {
      weather: board.weather || '',
      terrain: ['electric', 'grassy', 'misty', 'psychic'].find(t => board.hasField(t)) || '',
      tr: board.hasField('trickroom') ? 5 : 0,
      twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
      twB: board.hasSide('p2', 'tailwind') ? 4 : 0,
    };
    const r = RL.rolloutWinProb(board, 'p1', { n: N, dex, seed: gi * 7919 + sampled, field });
    if (!r) { nulls++; return; }
    rows.push({ p: r.p, m: materialP(board, 'p1'), y });
  },
});

const ms = Date.now() - t0;
if (!rows.length) { console.log('  no positions scored — nothing to report.'); process.exit(2); }

/* Proper scores, not just accuracy: a leaf that is right slightly more often but wildly overconfident
 * is worse inside a search, because the search averages its numbers rather than its verdicts. */
const acc = f => rows.filter(r => (f(r) >= 0.5) === (r.y === 1)).length / rows.length;
const brier = f => rows.reduce((s, r) => s + Math.pow(f(r) - r.y, 2), 0) / rows.length;
const logloss = f => rows.reduce((s, r) => {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, f(r)));
  return s - (r.y * Math.log(q) + (1 - r.y) * Math.log(1 - q));
}, 0) / rows.length;

const lines = [
  ['coin', () => 0.5],
  ['material sign (recomputed here)', r => r.m],
  [`ROLLOUT, n=${N}`, r => r.p],
];
console.log(`  positions scored ${rows.length.toLocaleString()}  (${nulls} unbuildable, ${unlabelled} unlabelled)  in ${(ms / 1000).toFixed(1)}s` +
  `  -> ${(ms / Math.max(1, rows.length)).toFixed(0)} ms per position\n`);
console.log('    judge                              accuracy     Brier    log-loss');
console.log('  ' + '-'.repeat(66));
for (const [name, f] of lines) {
  console.log('   ' + name.padEnd(34) + (100 * acc(f)).toFixed(2).padStart(6) + '%   ' +
    brier(f).toFixed(4).padStart(7) + '   ' + logloss(f).toFixed(4).padStart(7));
}

/* The number this gate turns on. PORYGON3's 63.70% is a HUMAN-game figure from data/porygon3.json,
 * quoted for scale — the like-for-like comparison on this sample is the material row above, because
 * that one was measured here. */
const rAcc = 100 * acc(r => r.p), mAcc = 100 * acc(r => r.m);

/* McNEMAR, BECAUSE THE TWO JUDGES SEE THE SAME POSITIONS. Comparing two accuracies as if they were
 * independent samples throws away the pairing and overstates the noise; the information is in the
 * DISCORDANT positions — the ones where exactly one judge was right. b and c below.
 *
 * This exists because the first version of this verdict printed "R1 fails" off a 1.40-point gap, and
 * a gap that size on this many positions is not a result in either direction. An instrument that
 * cannot tell a difference from nothing will happily report nothing as a difference. */
let b = 0, c = 0;
for (const r of rows) {
  const rr = (r.p >= 0.5) === (r.y === 1);
  const mm = (r.m >= 0.5) === (r.y === 1);
  if (rr && !mm) b++; else if (!rr && mm) c++;
}
const disc = b + c;
/* Normal approximation to the sign test on discordant pairs; the 95% half-width on the DIFFERENCE in
 * accuracy is 1.96*sqrt(b+c)/n, expressed in points. */
const half = disc ? 100 * 1.96 * Math.sqrt(disc) / rows.length : 0;
const diff = rAcc - mAcc;

console.log('\n  VERDICT');
console.log('  ' + '-'.repeat(66));
console.log(`  rollout minus material: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} points` +
  `  (95% CI ${(diff - half).toFixed(2)} to ${(diff + half).toFixed(2)})`);
console.log(`  discordant positions: rollout-only-right ${b}, material-only-right ${c}, of ${rows.length}`);
console.log(`  PORYGON3 is 63.70% on human games (data/porygon3.json) and beats material by 3.42 there.`);
if (diff - half > 3.42) {
  console.log('  -> R1 PASSES. The rollout carries more than the learned model adds over counting.');
} else if (diff + half < 0) {
  console.log('  -> R1 FAILS. The rollout is measurably WORSE than counting bodies.');
  console.log('     docs/ROLLOUT-design.md 5 says this kills the idea here, cheaply.');
} else {
  console.log('  -> UNDECIDED. The interval spans zero, so this sample cannot tell the rollout');
  console.log('     from counting. Not a pass and NOT a failure — raise GAMES until it separates,');
  console.log('     or accept that the two are close and the rollout is not the win it looked like.');
}
console.log('\n  NOT A LIKE-FOR-LIKE TEST OF THE REAL QUESTION, said plainly: the incumbent is');
console.log('  PORYGON3, and PORYGON3 is a Python k-NN that has not been scored on THESE positions.');
console.log('  Material is the honest local stand-in, and Brier/log-loss below flatter the rollout');
console.log('  against it because a sign function emits hard 0/1 and is punished for it.');
console.log('\n  Both columns are scored on identical positions with identical labels, per');
console.log('  docs/DATA-LAW.md case 2. The only thing that differs is which judge was asked.');
