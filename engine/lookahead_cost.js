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
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const D = (...p) => path.join(__dirname, '..', ...p);

const { BattleStream, getPlayerStreams } = CS.sim();
const N = parseInt(process.env.N || '40', 10);

/* The budget a live decision actually has. Showdown's per-turn timer is generous, but the number that
 * matters is what Will would tolerate sitting behind, so it is stated as a parameter rather than
 * assumed. */
const BUDGET_MS = parseInt(process.env.BUDGET_MS || '3000', 10);

/* HOW DEEP THE BOARD UNDER TEST IS. A parameter because G2 recorded cost varying by a factor of nine
 * across boards and then quoted a single turn-4 figure, and because the fork bug this file used to hit
 * scaled with log length — i.e. with turn number. A depth that cannot be varied cannot be shown not to
 * be the lucky one. */
const TURNS = parseInt(process.env.TURNS || '4', 10);

/* HOW MANY INDEPENDENT BOARDS. The cost varies by board, so one board is an anecdote. */
const BOARDS = parseInt(process.env.BOARDS || '1', 10);

function packedTeams() {
  /* The same team source the self-play farm uses, so this is timed on real teams rather than on
   * something convenient. */
  const mew = require('./mew.js');
  if (mew && typeof mew.samplePair === 'function') return mew.samplePair();
  return null;
}

async function measureBoard() {
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
      if (turns >= TURNS) break;
    }
  })();
  const drive = (async () => {
    for await (const chunk of streams.p1) {
      if (chunk.includes('|request|')) void streams.p1.write('default');
      if (turns >= TURNS) break;
    }
  })();
  const drive2 = (async () => {
    for await (const chunk of streams.p2) {
      if (chunk.includes('|request|')) void streams.p2.write('default');
      if (turns >= TURNS) break;
    }
  })();
  await Promise.race([done, new Promise(r => setTimeout(r, 15000))]);
  void drive; void drive2;

  /* WAIT FOR THE BATTLE TO STAND STILL BEFORE PHOTOGRAPHING IT. The drive loops above are async and
   * are still writing choices when `done` resolves, so a snapshot taken here can catch the battle
   * between a choice and the turn it triggers. Restored from that moment, the fork has no active
   * request: `choose()` returns TRUE, emits log lines, and does not advance the turn. Nothing throws.
   * A search would score that cell as a successor position when it is the same position, and every
   * such cell is wrong in the same direction.
   *
   * Diagnosed rather than assumed: the first reading of it looked like `fromJSON` losing the request
   * state, because the probe printed `requestState` AFTER the snapshot and by then the pending writes
   * had landed. It is this harness racing itself, not the serializer. */
  const quiet = async () => {
    for (let i = 0; i < 200; i++) {
      const b = bs.battle;
      if (b && !b.ended && b.requestState === 'move' &&
          b.sides.every(s => s.activeRequest)) return true;
      await new Promise(r => setTimeout(r, 10));
    }
    return false;
  };
  const settled = await quiet();
  const setup = Date.now() - t0;
  console.log(`  drove ${turns} turn(s) in ${setup} ms to reach a real mid-game state` +
    (settled ? '' : '  <-- NEVER SETTLED, skipping this board'));
  /* A board that ended early, or never came to rest at a move request, is not a cheap board — it is
   * not a board at all. Timing forks on it would credit ~2 ms deserialize-only cells to the median
   * and make the matrix look affordable because nothing was simulated. */
  if (!settled) return null;

  const battle = bs.battle || null;
  if (!battle) {
    console.log('\n  COULD NOT REACH THE Battle OBJECT from the stream.');
    console.log('  G2 is not answered. A one-step search needs a handle on the battle to fork it;');
    console.log('  without one the design in docs/LOOKAHEAD-design.md 4.2 has no transition function.');
    process.exit(2);
  }

  /* ---- can it fork at all -------------------------------------------------------------------- */
  /* CS.snapshot(), not battle.toJSON() directly. Upstream's serializer ALIASES the live battle's log
   * array into the snapshot (sim/state.ts:72), so every fork stepped from a raw toJSON() appends its
   * simulated turn into the log of the real game. See the comment on CS.snapshot. */
  let json = null, err = null;
  try { json = CS.snapshot(battle); } catch (e) { err = e; }
  if (!json) {
    console.log(`\n  toJSON() FAILED: ${err && err.message}`);
    console.log('  G2 fails here. Stated rather than worked around: without a serialisable state the');
    console.log('  search would have to replay every battle from turn 1 per cell, which is not affordable.');
    process.exit(1);
  }
  const size = JSON.stringify(json).length;
  console.log(`  toJSON() ok — ${(size / 1024).toFixed(0)} KB of state`);

  let restored = null;
  try { restored = CS.forkBattle(json); } catch (e) { err = e; }
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
  /* WITNESSES FOR THE TWO FAILURE MODES THE FORK USED TO HAVE, recorded before the loop so the run
   * proves they are gone rather than merely not mentioning them. A search that forks the battle it is
   * playing must leave that battle's log alone, and forks must not accumulate into each other. */
  const srcLogBefore = (battle.log || []).length;
  const snapLogBefore = json.log.length;
  const baseTurn = battle.turn;
  const t1 = Date.now();
  let ok = 0, failed = 0, inert = 0, endedN = 0, steppedN = 0, switchN = 0, firstInert = null, firstFail = null, firstFailIdx = -1, lastOkIdx = -1;
  for (let i = 0; i < N; i++) {
    try {
      const b = CS.forkBattle(json);
      b.choose('p1', 'default');
      b.choose('p2', 'default');
      /* DID IT ACTUALLY MOVE? `choose()` returns a boolean and returns TRUE in states where it does
       * nothing, so its return value is not the check.
       *
       * THE TURN COUNTER IS NOT THE CHECK EITHER, which is where the first version of this was wrong.
       * Two outcomes advance the game without incrementing `turn`, and both were being counted as
       * holes:
       *
       *   ended === true            the turn ran and the battle FINISHED. Measured: logGrew 10-11.
       *                             For a search this is the best leaf there is — terminal value is
       *                             known exactly instead of estimated by a 63%-accurate k-NN.
       *   requestState === 'switch' the turn ran and something FAINTED, so the engine wants a
       *                             replacement before it increments. Measured: logGrew 31.
       *
       * Discarding those two would have thrown away terminal and post-KO positions specifically —
       * i.e. biased the cost measurement toward quiet boards and the search toward not seeing KOs.
       *
       * A genuine hole is the race described above the quiescence gate: no request pending, not ended,
       * same turn. That is a fork that went nowhere. */
      const advanced = b.ended || b.turn > baseTurn || b.requestState === 'switch';
      if (advanced) {
        ok++; lastOkIdx = i;
        if (b.ended) endedN++; else if (b.turn > baseTurn) steppedN++; else switchN++;
      } else {
        inert++;
        if (!firstInert) firstInert = { requestState: b.requestState, ended: b.ended, turn: b.turn,
                                        logGrew: b.log.length - json.log.length };
      }
    } catch (e) {
      /* SAID OUT LOUD THE FIRST TIME, not merely stashed. A fork that throws a third of the time
       * still produces a flattering "ms per cell" from the two thirds that worked — which is exactly
       * what the first version of this file reported: 40/40 on one battle, 27/40 on the next, and
       * the difference invisible. The ratio alone does not say WHY either, and "the API cannot
       * restore this state" and "the action string was wrong for this board" need completely
       * different responses. */
      failed++;
      if (!firstFail) {
        firstFail = e; firstFailIdx = i;
        console.error(`  fork ${i + 1} threw: ${e.message}`);
      }
    }
  }
  /* CONTIGUOUS-TAIL TEST. It separates the two explanations that a bare rate cannot: a fork that fails
   * because THIS cell's state is unrestorable fails at random positions, while a fork that fails
   * because earlier forks poisoned shared state fails from some index onward and never recovers. The
   * second was the truth, and the rate alone hid it for five runs. */
  const tail = failed > 0 && firstFailIdx > lastOkIdx;
  const ms = Date.now() - t1;
  /* Per SUCCESSFUL fork. Dividing by N would quietly credit the failures with zero cost and make a
   * broken run look faster than a working one. */
  const per = ms / Math.max(1, ok);
  console.log(`\n  forked and stepped ${ok}/${N} times in ${ms} ms  ->  ${per.toFixed(1)} ms per successful cell`);
  if (inert) {
    console.log(`  ${inert} FORK(S) DID NOT ADVANCE THE TURN — restored, accepted a choice, went nowhere.`);
    console.log('  These are holes, not cells. Excluded from the cost above rather than counted cheap.');
    console.log('  first such fork: ' + JSON.stringify(firstInert));
  }
  if (firstFail) {
    console.log(`\n  ${N - ok} FORK(S) FAILED — first at ${firstFailIdx + 1}: ${firstFail.message}`);
    console.log('  This is a gate finding, not noise. A search cannot evaluate a cell it cannot');
    console.log('  simulate, so the failure RATE bounds the matrix as hard as the cost does.');
    console.log(tail ? '  Failures are a CONTIGUOUS TAIL — state is leaking between forks, not a bad cell.'
                     : '  Failures are SCATTERED — these are per-cell, not cross-fork contamination.');
  }
  /* ISOLATION, ASSERTED. Two arrays that must not have grown: the live battle's log (a fork must not
   * write into the game it was forked from) and the snapshot's (forks must not accumulate into each
   * other). Before the fix both grew by ~26 lines per fork. */
  const srcGrew = (battle.log || []).length - srcLogBefore;
  const snapGrew = json.log.length - snapLogBefore;
  const isolated = srcGrew === 0 && snapGrew === 0;
  console.log(`\n  fork isolation: live battle log +${srcGrew}, snapshot log +${snapGrew}  ` +
    `${isolated ? '(isolated)' : '<-- LEAKING, forks are mutating shared state'}`);
  console.log('');

  return { per, ok, failed, inert, endedN, steppedN, switchN, tail, isolated, turn: battle.turn };
}

/* THE COST IS A DISTRIBUTION, NOT A NUMBER, and G2 already knew that and quoted a number anyway: it
 * recorded per-fork cost ranging 3.5 to 32.2 ms across six runs, then tabulated one board's figure and
 * concluded top-6 is unaffordable. One board cannot decide a matrix size. This runs independent boards
 * and reports the spread, and the affordability verdict is taken from the WORST board rather than the
 * typical one — a search that blows the budget one turn in ten is not affordable, it is a timeout with
 * good average-case manners. */
function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

async function main() {
  console.log('LOOKAHEAD COST — Gate 2 of docs/LOOKAHEAD-design.md\n');
  const results = [];
  let skipped = 0;
  for (let b = 0; b < BOARDS; b++) {
    if (BOARDS > 1) console.log(`--- board ${b + 1} of ${BOARDS} ---`);
    const r = await measureBoard();
    if (r) results.push(r); else skipped++;
  }
  if (!results.length) { console.log('\nNo board ever settled at a move request. Nothing measured.'); process.exit(2); }

  const costs = results.map(r => r.per).sort((a, b) => a - b);
  const totalOk = results.reduce((s, r) => s + r.ok, 0);
  const totalFail = results.reduce((s, r) => s + r.failed, 0);
  const totalInert = results.reduce((s, r) => s + r.inert, 0);
  const anyLeak = results.some(r => !r.isolated);

  console.log('\n' + '='.repeat(72));
  console.log(`FORKS: ${totalOk} advanced a turn, ${totalFail} threw, ${totalInert} went nowhere` +
    `  (${results.length} board(s) measured, ${skipped} never settled)`);
  console.log(`       isolation ${anyLeak ? 'BROKEN' : 'clean on every board'}`);
  console.log(`COST per fork (ms):  min ${costs[0].toFixed(2)}   median ${quantile(costs, 0.5).toFixed(2)}` +
    `   p90 ${quantile(costs, 0.9).toFixed(2)}   max ${costs[costs.length - 1].toFixed(2)}`);

  console.log('\n  WHAT THAT BUYS, at the matrix sizes in the design');
  console.log('  ' + ' '.repeat(44) + 'median board      worst board');
  console.log('  ' + '-'.repeat(70));
  for (const [label, cells] of [['unpruned (~144 joint actions/side)', 20736],
                                ['top-6 per slot (fit_joint uses this)', 1296],
                                ['top-3 per slot', 81]]) {
    const med = quantile(costs, 0.5) * cells, worst = costs[costs.length - 1] * cells;
    /* The verdict is the WORST board's. See the note above quantile(). */
    const verdict = worst <= BUDGET_MS ? 'affordable' : (med <= BUDGET_MS ? 'MARGINAL' : 'TOO SLOW');
    console.log('   ' + label.padEnd(38) + String(cells).padStart(6) + ' cells ' +
      (med / 1000).toFixed(2).padStart(9) + ' s' + (worst / 1000).toFixed(2).padStart(13) + ' s   ' + verdict);
  }
  console.log(`\n  budget assumed: ${BUDGET_MS} ms per decision (BUDGET_MS to change).`);
  console.log('  One sample per cell. A Pokemon turn is stochastic, so averaging n samples multiplies');
  console.log('  every figure above by n — see docs/LOOKAHEAD-design.md 4.4.');

  /* WRITTEN OUT SO NOBODY RETYPES IT. truncation_curve.js needs the fork cost to say which K the
   * budget allows, and the first version of that file carried the number as a literal in its source —
   * which was already stale by the time this run finished, because cleaning the instrument moved the
   * median from 9.68 ms to under 4. A measured constant living in a second file's source is a
   * hand-maintained copy of an artifact, and it drifts silently. Consumers read this file or say they
   * could not. */
  const out = {
    generated: new Date().toISOString(),
    engine_commit: CS.actualCommit(), format: CS.FORMAT,
    boards: results.length, boardsSkipped: skipped, forksPerBoard: N, turnsDriven: TURNS,
    forks: { advanced: totalOk, threw: totalFail, inert: totalInert,
             stepped: results.reduce((s, r) => s + r.steppedN, 0),
             awaitingSwitch: results.reduce((s, r) => s + r.switchN, 0),
             ended: results.reduce((s, r) => s + r.endedN, 0) },
    forkCostMs: { min: costs[0], median: quantile(costs, 0.5), p90: quantile(costs, 0.9),
                  max: costs[costs.length - 1], perBoard: costs },
    /* Stated because the sampling is not neutral: a board only counts if it survived TURNS turns of
     * `default` play and came to rest at a move request, which skews toward longer games. */
    caveat: `${skipped} of ${BOARDS} boards ended or never settled and were excluded; ` +
            'the measured boards are therefore biased toward games that survive default play.',
  };
  fs.writeFileSync(D('data', 'lookahead-cost.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`\n  wrote data/lookahead-cost.json`);
}

main().catch(e => { console.error('lookahead_cost: ' + (e.stack || e.message)); process.exit(1); });
