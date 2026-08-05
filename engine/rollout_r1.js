/* rollout_r1.js — GATE R1 of docs/ROLLOUT-design.md.
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/rollout_r1.js
 *
 * THE QUESTION, AND WHY IT COMES BEFORE ANY SEARCH
 * ------------------------------------------------
 * Every search maximises a leaf, and ours is weak: data/porygon2c.json scores PORYGON2 at 63.70%
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
 * own bot, and PORYGON2 was fitted on self-play, so a self-play evaluation would flatter the incumbent
 * as well as the challenger.
 *
 * THE BASELINE IS RECOMPUTED, NOT QUOTED
 * --------------------------------------
 * `material sign` is measured on THESE positions rather than read from porygon2c.json. A published
 * number from a different sample is a different question, and comparing against it is how the
 * withdrawn Sucker Punch claim happened. Coin is included for the same reason: an instrument that
 * cannot beat a coin on this sample has not earned the right to be compared to anything.
 *
 * ONE REPLAY, NOT A SECOND ONE. Positions come from joint_rows.js's `onBoard` observer, so this file
 * does not re-implement the event walk that turns a replay into a board.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

/* --------------------------------------------------------------------------------------------
 * STEP 0 — OPEN THE FROZEN RELEASE. The LEAF is read from the snapshot, not the live tree.
 *
 * The 2026-08-04 explore sweep was stamped against live files and went UNSAFE in provenance the
 * moment engine/rollout_r1.js was edited afterwards — and ENGINE edits medicham2 while gates run,
 * which is the normal state, not an accident. DIVISIONS rule 1: a gate measures a NAMED release.
 * `open()` verifies the snapshot has not rotted and throws if none was ever cut.
 *
 * WHAT STILL LOADS LIVE, said plainly: the corpus walker (fit_policy.js, joint_rows.js) and their
 * board.js instance. Those are the HARNESS — they decide which positions are sampled, not what a
 * rollout is worth. The start-of-run drift check below proves live board.js is byte-identical to
 * the snapshot's at load time, and node caches modules at load, so a mid-run edit to the live tree
 * cannot reach this process. Their digests are recorded in the sidecar as harness_digests.
 * ------------------------------------------------------------------------------------------ */
const REL_API = require('./engine_release.js');
let REL;
try { REL = REL_API.open(process.env.RELEASE || undefined); }
catch (e) {
  console.error('REFUSING TO RUN: ' + e.message);
  console.error('R1 is a measurement of the leaf, and a leaf is a fact about one specific engine.');
  console.error('Without a release the artifact cannot name which. Cut one, or pass RELEASE=<id>.');
  process.exit(1);
}
{
  const drift0 = REL_API.drift(REL.id);
  if (drift0.length) {
    console.error(`REFUSING TO RUN: the live tree has moved off release ${REL.id}:`);
    for (const f of drift0) console.error('  ' + f);
    console.error('The corpus walker (joint_rows/fit_policy) loads live board.js, so live and');
    console.error('snapshot must agree at load time. Cut a fresh release and re-run.');
    process.exit(1);
  }
}
const CS = REL.require('engine/champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');
const B = require('./board.js');
const RL = REL.require('engine/rollout_leaf.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const GAMES = parseInt(process.env.GAMES || '150', 10);
const N = parseInt(process.env.N || '40', 10);
/* N_LIST scores SEVERAL rollout budgets on the SAME positions in one replay. That pairing is the
 * whole point: it separates "the rollout is NOISY" from "the rollout is WRONG". A leaf whose accuracy
 * climbs with N is variance-limited and buying more samples fixes it; a leaf that is flat in N is
 * bias-limited, and the fault is the engine or its playout policy, which more samples cannot touch.
 * Running them as separate jobs would confound the answer with which positions each job happened to
 * sample. */
const N_LIST = (process.env.N_LIST || String(N)).split(',').map(Number).filter(Boolean);
/* EXPLORE_LIST sweeps the playout's randomness on the SAME positions, for the same reason N_LIST
 * sweeps the budget. 0 is the deterministic-greedy incumbent, so the sweep always contains the thing
 * it is trying to beat. The calibration table said 53% of positions land in the 0-10% or 90-100% bin
 * and those bins are wrong by 22-29 points, which is a low-variance playout saturating -- and the
 * literature's prescription for that is a MORE RANDOM playout, not a stronger one. */
const EXPLORE_LIST = (process.env.EXPLORE_LIST || '0').split(',').map(Number);
/* Every EVERY_TH turn, so a long game does not dominate the sample with near-identical late boards. */
const EVERY = parseInt(process.env.EVERY || '2', 10);
/* MAXTURNS — the playout horizon, now a RECORDED parameter instead of an unstated default.
 * Every R1 number ever published was measured at MEDICHAM's default horizon of 20 turns while the
 * live leaf runs 60 (engine/miltank.js DEFAULTS.turns); data/rollout-r1-explore-sweep.json filed
 * that as "a parameter neither states". Unset = the engine default (20), exactly as before, and
 * whichever value applies is stamped into the sidecar. */
const MAXTURNS = process.env.MAXTURNS ? parseInt(process.env.MAXTURNS, 10) : 0;

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

/* THE PYTHON BASELINE, COPIED IN FORM SO THE LIFTS ARE COMPARABLE.
 * engine/porygon2.py:530 is `clip(0.5 + 0.15*alive_diff, 0.02, 0.98)` -- GRADED, and a function of
 * BODIES ONLY. The hard bodies-then-HP sign above is a different and stronger baseline, which is why
 * it scored 66.14% here against the 60.28% porygon2c.json publishes, and why its Brier looked so much
 * worse: a hard 0/1 is punished for every miss.
 *
 * That difference matters for the only comparison that decides R1. PORYGON2's claim is "+3.42 points
 * over material"; measuring the rollout's lift over a DIFFERENT material is not the same quantity, and
 * comparing the two would be the corpus-mismatch mistake in a new costume. Both baselines are printed
 * so the reader can see the choice rather than inherit it. */
function materialPy(board, side) {
  const foe = side === 'p1' ? 'p2' : 'p1';
  const alive = s => {
    let n = 0;
    for (const L of ['a', 'b']) { const m = board.slot(s, L); if (m && !m.fainted) n++; }
    n += board.bench(s).length;
    return n;
  };
  return Math.max(0.02, Math.min(0.98, 0.5 + 0.15 * (alive(side) - alive(foe))));
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

/* DUMP lets phase 2 score PORYGON2 on THESE positions, which is the comparison R1 actually needs and
 * cannot make from JS: the incumbent is a Python k-NN and its feature vector is defined by
 * porygon2.py's parser. Re-implementing that parser here to get a like-for-like number would be a
 * second definition of the feature semantics -- the exact mistake that made the first coverage number
 * wrong. So the rows travel instead.
 *
 * `aliveDiff` rides along as an ALIGNMENT WITNESS, not as data: phase 2 recomputes the same quantity
 * from its own parse and the two must agree, or the join is lining up different turns and every
 * number after it is fiction. */
const fs = require('fs');
const DUMP = process.env.DUMP ? D('data', process.env.DUMP) : null;
const dumpRows = [];
/* DUMP0 — the FIRST explore arm's column, dumped from the SAME process as DUMP's last-arm column.
 *
 * Added 2026-08-05, and the reason is a measured failure, not tidiness: the re-run plan was "run A
 * dumps explore=1, run B re-runs EXPLORE_LIST=0 to dump the greedy column on the same positions".
 * Run A finished at 01:31 and ENGINE landed medicham2/tags edits in the minutes after, so run B's
 * start-of-run drift guard refused — correctly — and the pairing died in the WINDOW BETWEEN RUNS.
 * The explore=0 column had already been computed inside run A on the identical boards and seeds; it
 * simply was not written. One process, both columns, no window. */
const DUMP0 = process.env.DUMP0 ? D('data', process.env.DUMP0) : null;
if (DUMP0 && EXPLORE_LIST.length < 2) { console.error('DUMP0 needs EXPLORE_LIST to hold at least two arms.'); process.exit(2); }
const dumpRows0 = [];

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
      /* A THIRD SPELLING, MATCHING NOTHING — see `RL.terrainOnBoard`. This probed the ENGINE's
       * words against a Board that stores the dex's `electricterrain`, so every R1 row ever scored
       * was scored with no terrain, on the 1.24% of boards that carry one. */
      terrain: RL.terrainOnBoard(board),
      tr: board.hasField('trickroom') ? 5 : 0,
      twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
      twB: board.hasSide('p2', 'tailwind') ? 4 : 0,
    };
    const ps = {};
    for (const ee of EXPLORE_LIST) for (const nn of N_LIST) {
      const key = EXPLORE_LIST.length > 1 ? `${nn}@${ee}` : nn;
      const rr = RL.rolloutWinProb(board, 'p1', Object.assign(
        { n: nn, dex, seed: gi * 7919 + sampled, field, explore: ee },
        MAXTURNS ? { maxTurns: MAXTURNS } : {}));
      if (!rr) { nulls++; return; }
      ps[key] = rr.p;
    }
    if (0) for (const nn of N_LIST) {
      /* The SAME seed across budgets, so the small-N runs are a prefix of the large-N ones rather
       * than an independent sample. Otherwise the sweep measures seed luck as well as N. */
      const r = RL.rolloutWinProb(board, 'p1', { n: nn, dex, seed: gi * 7919 + sampled, field });
      if (!r) { nulls++; return; }
      ps[nn] = r.p;
    }
    rows.push({ ps, m: materialP(board, 'p1'), mpy: materialPy(board, 'p1'), y });
    if (DUMP) {
      const aliveOf = sd => {
        let k = 0;
        for (const L of ['a', 'b']) { const mm = board.slot(sd, L); if (mm && !mm.fainted) k++; }
        return k + board.bench(sd).length;
      };
      /* A SECOND, CONTINUOUS WITNESS. alive_diff is 0 on most early turns, so it agrees trivially
       * there and confirms nothing -- it only says "neither of us thinks anything has fainted yet".
       * Summed HP fraction is continuous and disagrees loudly when two turn indices are not the same
       * turn. Both are dumped; phase 2 reports how well each agrees BEFORE either is used to filter,
       * because a witness that rejects everything on a definitional difference and a join that is
       * genuinely misaligned look identical from the far side. */
      const hpOf = sd => {
        let h = 0;
        for (const L of ['a', 'b']) { const mm = board.slot(sd, L); if (mm && !mm.fainted) h += (typeof mm.hp === 'number' ? mm.hp : 1); }
        return h + board.bench(sd).length;
      };
      /* THE SAME KEY THE VERDICT USES, not a plain N.
       *
       * This read `ps[N_LIST[last]]`, and the sweep keys become `${nn}@${ee}` the moment
       * EXPLORE_LIST holds more than one value — so under an explore sweep the lookup returned
       * undefined, JSON.stringify dropped the field, and every dumped row lost its rollout column
       * without a word. The verdict below computes NBEST with the branch; the dump did not, which is
       * two definitions of "the column this run is about". */
      const dumpKey = EXPLORE_LIST.length > 1
        ? `${N_LIST[N_LIST.length - 1]}@${EXPLORE_LIST[EXPLORE_LIST.length - 1]}`
        : N_LIST[N_LIST.length - 1];
      const witness = { gid: g.id, turn: board.turn,
                        mpy: materialPy(board, 'p1'), y,
                        aliveDiff: aliveOf('p1') - aliveOf('p2'),
                        hpDiff: +(hpOf('p1') - hpOf('p2')).toFixed(6) };
      dumpRows.push(Object.assign({ p: ps[dumpKey] }, witness));
      /* The first arm's column, same board, same witnesses, same seed — the pairing the sweep
       * checks is then true by construction rather than by two walks happening to agree. */
      if (DUMP0) dumpRows0.push(Object.assign(
        { p: ps[`${N_LIST[N_LIST.length - 1]}@${EXPLORE_LIST[0]}`] }, witness));
    }
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
  ['material: bodies then HP (hard)', r => r.m],
  ['material: porygon2 form (graded)', r => r.mpy],
].concat([].concat(...EXPLORE_LIST.map(ee => N_LIST.map(nn => {
  const key = EXPLORE_LIST.length > 1 ? `${nn}@${ee}` : nn;
  return [`ROLLOUT n=${nn}` + (EXPLORE_LIST.length > 1 ? ` explore=${ee}` : ''), r => r.ps[key]];
}))));
console.log(`  positions scored ${rows.length.toLocaleString()}  (${nulls} unbuildable, ${unlabelled} unlabelled)  in ${(ms / 1000).toFixed(1)}s` +
  `  -> ${(ms / Math.max(1, rows.length)).toFixed(0)} ms per position\n`);
console.log('    judge                              accuracy     Brier    log-loss');
console.log('  ' + '-'.repeat(66));
for (const [name, f] of lines) {
  console.log('   ' + name.padEnd(34) + (100 * acc(f)).toFixed(2).padStart(6) + '%   ' +
    brier(f).toFixed(4).padStart(7) + '   ' + logloss(f).toFixed(4).padStart(7));
}

/* The number this gate turns on. PORYGON2's 63.70% is a HUMAN-game figure from data/porygon2c.json,
 * quoted for scale — the like-for-like comparison on this sample is the material row above, because
 * that one was measured here. */
const NBEST = EXPLORE_LIST.length > 1 ? `${N_LIST[N_LIST.length - 1]}@${EXPLORE_LIST[EXPLORE_LIST.length - 1]}` : N_LIST[N_LIST.length - 1];
const rAcc = 100 * acc(r => r.ps[NBEST]), mAcc = 100 * acc(r => r.mpy);

/* McNEMAR, BECAUSE THE TWO JUDGES SEE THE SAME POSITIONS. Comparing two accuracies as if they were
 * independent samples throws away the pairing and overstates the noise; the information is in the
 * DISCORDANT positions — the ones where exactly one judge was right. b and c below.
 *
 * This exists because the first version of this verdict printed "R1 fails" off a 1.40-point gap, and
 * a gap that size on this many positions is not a result in either direction. An instrument that
 * cannot tell a difference from nothing will happily report nothing as a difference. */
let b = 0, c = 0;
for (const r of rows) {
  const rr = (r.ps[NBEST] >= 0.5) === (r.y === 1);
  const mm = (r.mpy >= 0.5) === (r.y === 1);
  if (rr && !mm) b++; else if (!rr && mm) c++;
}
const disc = b + c;
/* Normal approximation to the sign test on discordant pairs; the 95% half-width on the DIFFERENCE in
 * accuracy is 1.96*sqrt(b+c)/n, expressed in points. */
const half = disc ? 100 * 1.96 * Math.sqrt(disc) / rows.length : 0;
const diff = rAcc - mAcc;

console.log('\n  VERDICT');
console.log('  ' + '-'.repeat(66));
console.log(`  rollout minus material (porygon2 form): ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} points` +
  `  (95% CI ${(diff - half).toFixed(2)} to ${(diff + half).toFixed(2)})`);
console.log(`  discordant positions: rollout-only-right ${b}, material-only-right ${c}, of ${rows.length}`);
console.log(`  PORYGON2 is 63.70% on human games (data/porygon2c.json) and beats material by 3.42 there.`);
/* THREE THRESHOLDS, NOT TWO, and the message must match the interval it just printed.
 *
 * The first version tested only "does the lower bound clear 3.42" and otherwise printed "the interval
 * spans zero". At +2.91 [1.79, 4.04] that was a FALSE STATEMENT about the numbers on the line above:
 * the interval does not span zero, it clears it comfortably and merely fails to clear PORYGON2's
 * published lift. A verdict that contradicts its own table is worse than no verdict. */
const PORY_LIFT = 3.42;
if (diff - half > PORY_LIFT) {
  console.log(`  -> R1 PASSES OUTRIGHT. The lower bound clears PORYGON2's published +${PORY_LIFT} lift,`);
  console.log('     so the rollout carries more than the learned model adds over the same baseline.');
} else if (diff - half > 0) {
  console.log('  -> R1 PASSES ON THE BASELINE. The rollout is significantly better than counting');
  console.log(`     bodies, and PORYGON2's published +${PORY_LIFT} sits INSIDE this interval — so the two`);
  console.log('     are not separated by this sample, and the rollout is at least its equal here.');
  console.log('     Not the same claim as beating it. Said separately because they are separate.');
} else if (diff + half < 0) {
  console.log('  -> R1 FAILS. The rollout is measurably WORSE than counting bodies.');
  console.log('     docs/ROLLOUT-design.md 5 says this kills the idea here, cheaply.');
} else {
  console.log('  -> UNDECIDED. The interval spans zero, so this sample cannot tell the rollout');
  console.log('     from counting. Not a pass and NOT a failure — raise GAMES until it separates.');
}
console.log('\n  NOT A LIKE-FOR-LIKE TEST OF THE REAL QUESTION, said plainly: the incumbent is');
console.log('  PORYGON2, and PORYGON2 is a Python k-NN that has not been scored on THESE positions.');
console.log('  Material is the honest local stand-in, and Brier/log-loss below flatter the rollout');
console.log('  against it because a sign function emits hard 0/1 and is punished for it.');
if (DUMP) {
  fs.writeFileSync(DUMP, dumpRows.map(r => JSON.stringify(r)).join(String.fromCharCode(10)) + String.fromCharCode(10));
  console.log(`  wrote ${dumpRows.length.toLocaleString()} rows to ${path.relative(D('.'), DUMP)}`);
  /* A SIDECAR THAT SAYS WHICH ROLLOUT THE `p` COLUMN IS.
   *
   * The rows carried {gid, turn, p, mpy, y, aliveDiff, hpDiff} and NOTHING about the run. A dump at
   * explore=0 and a dump at explore=1 are byte-compatible, and they differ by nearly four accuracy
   * points — the whole of R1's published result. data/rollout-r1-rows.jsonl, the only surviving
   * evidence for that result, cannot be told apart from the incumbent arm by any field in it, and
   * only its calibration shape settles the question. That is a hole where a stamp should be.
   *
   * A SIDECAR AND NOT A HEADER LINE, deliberately: engine/rollout_r1_join.py parses every line of the
   * dump as a row, and a header would make it read the stamp as a position.
   *
   * The digests are of the SOURCES THAT PRODUCED THE ROWS. data/rollout-r4.json can name an engine
   * commit because mew.js stamps one into every game record; nothing stamps this path, so the closest
   * honest equivalent is a content hash of the files the leaf reaches, taken at the moment the rows
   * were written. */
  const sha12 = rel => {
    try { return require('crypto').createHash('sha256').update(fs.readFileSync(D(rel))).digest('hex').slice(0, 12); }
    catch (e) {
      /* 'MISSING' in the sidecar is the record; the reason it is missing must not evaporate */
      console.error('  meta digest: ' + rel + ' unreadable: ' + ((e && e.message) || e));
      return 'MISSING';
    }
  };
  /* THE SIDECAR NAME FOLLOWS THE DUMP NAME. It was hardcoded to data/rollout-r1-rows.meta.json,
   * so a run dumping to any OTHER filename stamped the wrong dump — engine/rollout_explore_sweep.js
   * looks for `<dump>.meta.json` and would have read a stamp describing a different file. */
  const writeMeta = (dumpAbs, nRows, exploreVal) => {
    const META = path.relative(D('.'), dumpAbs).replace(/\\/g, '/').replace(/\.jsonl$/, '.meta.json');
    fs.writeFileSync(D(META), JSON.stringify(Object.assign({
      generated: new Date().toISOString(),
      by: 'engine/rollout_r1.js',
      describes: path.relative(D('.'), dumpAbs).replace(/\\/g, '/'),
      rows: nRows,
      p_column: {
        key: String(EXPLORE_LIST.length > 1
          ? `${N_LIST[N_LIST.length - 1]}@${exploreVal}` : N_LIST[N_LIST.length - 1]),
        n_rollouts: N_LIST[N_LIST.length - 1],
        explore: exploreVal,
        max_turns: MAXTURNS || 20,
        max_turns_source: MAXTURNS ? 'MAXTURNS env, passed to rolloutWinProb' : 'engine default (20) — MAXTURNS unset',
        note: 'The dump carries ONE rollout column and this names it. Both dumps of a DUMP0 run come '
          + 'from ONE process and ONE walk, so their rows pair by construction.',
      },
      sweep: { N_LIST, EXPLORE_LIST, EVERY, GAMES, MAXTURNS: MAXTURNS || null, corpus_games: games.length },
    },
    /* THE ENGINE THE ROWS DESCRIBE IS THE RELEASE, BY CONSTRUCTION — the leaf was loaded through
     * REL.require, so these digests are what actually ran, not what happened to be on disk after.
     * provenance.js verifies source_digests against the named release's frozen copies, which is what
     * lets ENGINE keep editing the live simulator while this artifact stays checkable. The generator's
     * own digest rides along because the rows depend on this file too: edit it later and the artifact
     * honestly reads stale until re-run — that is the correct semantics, it is how the 2026-08-04
     * sweep was caught, and restamping around it is forbidden. */
    REL.stamp(),
    {
      source_digests: Object.assign({}, REL.stamp().source_digests, {
        'engine/rollout_r1.js': sha12('engine/rollout_r1.js'),
        note: 'Frozen-release digests plus the generator. Content, not mtime.',
      }),
      harness_digests: {
        'engine/joint_rows.js': sha12('engine/joint_rows.js'),
        'engine/fit_policy.js': sha12('engine/fit_policy.js'),
        note: 'Loaded LIVE (they choose which positions are sampled; the sampled positions are '
          + 'recorded in the dump itself). Informational, not verified by provenance.',
      },
    }), null, 2) + '\n');
    console.log(`  wrote ${META} — n=${N_LIST[N_LIST.length - 1]}, explore=${exploreVal}`);
  };
  writeMeta(DUMP, dumpRows.length, EXPLORE_LIST[EXPLORE_LIST.length - 1]);
  if (DUMP0) {
    fs.writeFileSync(DUMP0, dumpRows0.map(r => JSON.stringify(r)).join(String.fromCharCode(10)) + String.fromCharCode(10));
    console.log(`  wrote ${dumpRows0.length.toLocaleString()} rows to ${path.relative(D('.'), DUMP0)} (explore=${EXPLORE_LIST[0]} arm, same walk)`);
    writeMeta(DUMP0, dumpRows0.length, EXPLORE_LIST[0]);
  }
  console.log('  next: node engine/rollout_r1_artifact.js — write data/rollout-r1.json from these rows.');
}
console.log('\n  Both columns are scored on identical positions with identical labels, per');
console.log('  docs/DATA-LAW.md case 2. The only thing that differs is which judge was asked.');
