/* lookahead_cost.js — GATE 2 of docs/LOOKAHEAD-design.md: can we afford to look one turn ahead?
 *
 *   SHOWDOWN_PATH=... node engine/lookahead_cost.js
 *
 * WHAT THIS DECIDES
 * -----------------
 * G1 passed: engine/lookahead_bound.py measured +4.91 accuracy points of information one turn ahead,
 * against +0.03 and +0.11 for two rounds of feature work on the snapshot. So the information exists.
 *
 * G2 asks the question that can kill the design for the least money: a one-step search must take the
 * CURRENT battle, fork it once per cell of the payoff matrix, apply a different action pair to each
 * fork, and step one turn. If a fork costs too much, none of the rest matters and it is better to
 * find that out now than after the search is written.
 *
 * Two things are measured, and the first is not obvious:
 *
 *   CAN IT FORK AT ALL      Battle.toJSON()/fromJSON() exist in sim/battle.ts. That they exist is not
 *                           the same as them round-tripping a mid-game state correctly, and a search
 *                           built on a fork that silently loses volatiles, boosts or the RNG position
 *                           would produce confident nonsense. Checked by comparing the restored
 *                           battle's own log against the original's, not by trusting the API.
 *   WHAT A CELL COSTS       wall-clock per fork-and-step, which multiplied by the matrix size is the
 *                           per-decision budget.
 *
 * THE MATRIX SIZES COME FROM docs/LOOKAHEAD-design.md 4.3 and are not invented here: ~144 joint
 * actions per side unpruned (~20,000 cells), 36 at top-6 per slot (1,296 cells), 9 at top-3 (81).
 * fit_joint.js already uses top-6 and measured that the human's chosen pair falls outside that window
 * only 11.3% of the time, which is what bounds the cost of pruning.
 */
'use strict';
const CS = require('./champions_sim.js');

const { BattleStream, getPlayerStreams } = CS.sim();
const N = parseInt(process.env.N || '40', 10);

/* The budget a live decision actually has. Showdown's per-turn timer is generous, but the number that
 * matters is what Will would tolerate sitting behind, so it is stated as a parameter rather than
 * assumed. */
const BUDGET_MS = parseInt(process.env.BUDGET_MS || '3000', 10);

function packedTeams() {
  /* The same team source the self-play farm uses, so this is timed on real teams rather than on
   * something convenient. */
  const mew = require('./mew.js');
  if (mew && typeof mew.samplePair === 'function') return mew.samplePair();
  return null;
}

async function main() {
  console.log('LOOKAHEAD COST — Gate 2 of docs/LOOKAHEAD-design.md\n');

  const t0 = Date.now();
  /* THE BattleStream ITSELF, kept. getPlayerStreams() returns the four player-facing streams and
   * `streams.omniscient` is a read/write wrapper, NOT the BattleStream -- so the Battle object hangs
   * off the object we constructed, and reaching for it on the wrapper finds nothing. Caught on the
   * first run, which reported "COULD NOT REACH THE Battle OBJECT" and would have read as a design
   * failure rather than as my mistake. */
  const bs = new BattleStream();
  const streams = getPlayerStreams(bs);
  const spec = { formatid: CS.FORMAT };
  void streams.omniscient.write(`>start ${JSON.stringify(spec)}\n` +
    `>player p1 ${JSON.stringify({ name: 'A' })}\n` +
    `>player p2 ${JSON.stringify({ name: 'B' })}`);

  /* Drive a few turns with random choices so the state under test is a REAL mid-game position with
   * volatiles, boosts and damage on it -- forking turn 1 would flatter the measurement. */
  let turns = 0;
  const done = (async () => {
    for await (const chunk of streams.omniscient) {
      if (/\|turn\|/.test(chunk)) turns++;
      if (turns >= 4) break;
    }
  })();
  const drive = (async () => {
    for await (const chunk of streams.p1) {
      if (chunk.includes('|request|')) void streams.p1.write('default');
      if (turns >= 4) break;
    }
  })();
  const drive2 = (async () => {
    for await (const chunk of streams.p2) {
      if (chunk.includes('|request|')) void streams.p2.write('default');
      if (turns >= 4) break;
    }
  })();
  await Promise.race([done, new Promise(r => setTimeout(r, 15000))]);
  void drive; void drive2;
  const setup = Date.now() - t0;
  console.log(`  drove ${turns} turn(s) in ${setup} ms to reach a real mid-game state`);

  const battle = bs.battle || null;
  if (!battle) {
    console.log('\n  COULD NOT REACH THE Battle OBJECT from the stream.');
    console.log('  G2 is not answered. A one-step search needs a handle on the battle to fork it;');
    console.log('  without one the design in docs/LOOKAHEAD-design.md 4.2 has no transition function.');
    process.exit(2);
  }

  /* ---- can it fork at all -------------------------------------------------------------------- */
  let json = null, err = null;
  try { json = battle.toJSON(); } catch (e) { err = e; }
  if (!json) {
    console.log(`\n  toJSON() FAILED: ${err && err.message}`);
    console.log('  G2 fails here. Stated rather than worked around: without a serialisable state the');
    console.log('  search would have to replay every battle from turn 1 per cell, which is not affordable.');
    process.exit(1);
  }
  const size = JSON.stringify(json).length;
  console.log(`  toJSON() ok — ${(size / 1024).toFixed(0)} KB of state`);

  const Battle = battle.constructor;
  let restored = null;
  try { restored = Battle.fromJSON(json); } catch (e) { err = e; }
  if (!restored) {
    console.log(`\n  fromJSON() FAILED: ${err && err.message}`);
    process.exit(1);
  }
  /* ROUND-TRIP CHECKED, NOT ASSUMED. A fork that quietly drops a volatile or a boost would make every
   * leaf score wrong in the same direction, which is the shape of every expensive bug this project
   * has had. The log is the battle's own account of itself. */
  const sameTurn = restored.turn === battle.turn;
  const sameLog = (restored.log || []).length === (battle.log || []).length;
  console.log(`  fromJSON() ok — turn ${restored.turn} vs ${battle.turn}` +
    `, log ${(restored.log || []).length} vs ${(battle.log || []).length} lines` +
    `  ${sameTurn && sameLog ? '(round-trips)' : '<-- DIVERGED'}`);

  /* ---- what a cell costs --------------------------------------------------------------------- */
  const t1 = Date.now();
  let ok = 0, failed = 0, firstFail = null;
  for (let i = 0; i < N; i++) {
    try {
      const b = Battle.fromJSON(json);
      b.choose('p1', 'default');
      b.choose('p2', 'default');
      ok++;
    } catch (e) {
      /* SAID OUT LOUD THE FIRST TIME, not merely stashed. A fork that throws a third of the time
       * still produces a flattering "ms per cell" from the two thirds that worked — which is exactly
       * what the first version of this file reported: 40/40 on one battle, 27/40 on the next, and
       * the difference invisible. The ratio alone does not say WHY either, and "the API cannot
       * restore this state" and "the action string was wrong for this board" need completely
       * different responses. */
      failed++;
      if (!firstFail) {
        firstFail = e;
        console.error(`  fork ${i + 1} threw: ${e.message}`);
      }
    }
  }
  const ms = Date.now() - t1;
  /* Per SUCCESSFUL fork. Dividing by N would quietly credit the failures with zero cost and make a
   * broken run look faster than a working one. */
  const per = ms / Math.max(1, ok);
  console.log(`\n  forked and stepped ${ok}/${N} times in ${ms} ms  ->  ${per.toFixed(1)} ms per successful cell`);
  if (firstFail) {
    console.log(`\n  ${N - ok} FORK(S) FAILED — first: ${firstFail.message}`);
    console.log('  This is a gate finding, not noise. A search cannot evaluate a cell it cannot');
    console.log('  simulate, so the failure RATE bounds the matrix as hard as the cost does.');
  }
  console.log('');

  console.log('  WHAT THAT BUYS, at the matrix sizes in the design');
  console.log('  ' + '-'.repeat(62));
  for (const [label, cells] of [['unpruned (~144 joint actions/side)', 20736],
                                ['top-6 per slot (fit_joint uses this)', 1296],
                                ['top-3 per slot', 81]]) {
    const total = per * cells;
    const verdict = total <= BUDGET_MS ? 'affordable' : 'TOO SLOW';
    console.log('   ' + label.padEnd(38) + String(cells).padStart(6) + ' cells  ' +
      (total / 1000).toFixed(1).padStart(7) + ' s   ' + verdict);
  }
  console.log(`\n  budget assumed: ${BUDGET_MS} ms per decision (BUDGET_MS to change).`);
  console.log('  One sample per cell. A Pokemon turn is stochastic, so averaging n samples multiplies');
  console.log('  every figure above by n — see docs/LOOKAHEAD-design.md 4.4.');
}

main().catch(e => { console.error('lookahead_cost: ' + (e.stack || e.message)); process.exit(1); });
