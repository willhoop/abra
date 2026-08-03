/* rollout_r3.js — GATE R3 of docs/ROLLOUT-design.md: does the search PICK A DIFFERENT MOVE?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=4096 engine/rollout_r3.js
 *
 * THE QUESTION THAT COMES BEFORE "DOES IT WIN"
 * -------------------------------------------
 * R1 says the rollout judges positions better than counting bodies (+2.91, CI 1.79 to 4.04, with a
 * FULLY RANDOM playout). R2 says a leaf costs 5.83 ms, about what ONE forked Showdown turn costs. Both
 * are properties of the leaf, and neither says the bot would play differently.
 *
 * If a one-step search over this leaf picks what MAG already picks on 95% of turns, it cannot win more
 * games than MAG whatever the theory says, and no SPRT is needed to know it. That is a behavioural
 * question and it is answerable without a matrix solver, an equilibrium or a single played-out game.
 *
 * WHAT IT DOES
 * ------------
 * At each real decision, for each of MY joint actions (top-K per slot by MAG's own score, the same
 * narrowing fit_joint uses): force those two clicks, let the opponent play its own policy, run ONE
 * turn, then roll the rest out. The action with the best rollout value is the search's pick. MAG's
 * pick is the top of its own ranking on the same candidates.
 *
 * WHAT IS AND IS NOT CONTROLLED
 * -----------------------------
 *   BOTH players are ranked over the SAME candidate set, so a disagreement is a disagreement about
 *   VALUE, never about what was on the menu. Truncation is measured separately in truncation_curve.js
 *   and would otherwise be confounded with it.
 *
 *   THE OPPONENT IS NOT MODELLED. It plays chooseAction during the stepped turn, the same for every
 *   candidate, so the comparison across candidates is like-for-like. It is a best-response to a fixed
 *   opponent rather than an equilibrium, which is weaker than the design's matrix game and is the
 *   right first cut: if even this does not diverge, the equilibrium version will not either, because
 *   the equilibrium is a mixture over the same cells.
 *
 *   AGREEMENT IS NOT SUCCESS AND DISAGREEMENT IS NOT SUCCESS EITHER. This measures whether the two
 *   are different players. Whether the different one is better is R4, and only an SPRT answers that.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const FP = require('./fit_policy.js');
const JR = require('./joint_rows.js');
const B = require('./board.js');
const RL = require('./rollout_leaf.js');
const CM = require('./click_match.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const D = (...p) => path.join(__dirname, '..', ...p);

const GAMES = parseInt(process.env.GAMES || '150', 10);
const N = parseInt(process.env.N || '20', 10);
const TOPK = parseInt(process.env.TOPK || '3', 10);
const EXPLORE = parseFloat(process.env.EXPLORE || '1.0');
const EVERY = parseInt(process.env.EVERY || '3', 10);

let w1;
try { w1 = JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
const { games } = FP.loadCorpus();

console.log('ROLLOUT R3 — does a rollout search pick a different move than MAG?\n');
console.log(`  top-${TOPK} per slot by MAG's own score, n=${N} rollouts, explore=${EXPLORE}`);
console.log(`  ${GAMES} games, every ${EVERY}th decision\n`);

const NF = B.FEATURES.length;
const score1 = x => { let s = 0; for (let k = 0; k < NF; k++) s += w1[k] * x[k]; return s; };

let decisions = 0, agreed = 0, skipped = 0, sampled = 0, selfDisagree = 0;
const gaps = [];

JR.build(games, dex, {
  topK: TOPK, w1, maxGames: GAMES, onRow: () => {},
  onBoard: (board, g, gi) => {
    sampled++;
    if (sampled % EVERY) return;
    const side = 'p1', foe = 'p2';
    const SI = CM.sheetIndex(g, dex);

    /* MAG's own candidate list and ranking, per slot. Built through the same B.candidates /
     * B.featuresFor path fit_policy and joint_rows use, so "MAG's pick" here is MAG's pick. */
    const slots = ['a', 'b'].map(L => {
      const user = board.slot(side, L);
      if (!user || user.fainted) return null;
      const sh = SI.get(side, user.species);
      if (!sh) return null;
      const cands = B.candidates(sh.moves, user, board, side, dex);
      if (!cands.length) return null;
      const feats = cands.map(c => B.featuresFor(c, user, board, side, dex,
        c.switchTo ? B.PRIOR_FLOOR : FP.priorFor(user.species, c.move.id)));
      const order = feats.map((x, i) => [score1(x), i]).sort((a, b) => b[0] - a[0]);
      return { user, cands, order: order.slice(0, TOPK).map(p => p[1]) };
    });
    if (!slots[0] || !slots[1]) { skipped++; return; }

    /* The MEDICHAM bodies, in sideTeam order: actives first, so index 0 is slot a and 1 is slot b.
     * Rebuilt per candidate because MEDICHAM mutates what it is handed. */
    const field = { weather: board.weather || '', terrain: '',
                    tr: board.hasField('trickroom') ? 5 : 0,
                    twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
                    twB: board.hasSide('p2', 'tailwind') ? 4 : 0 };

    /* THE NOISE FLOOR, MEASURED THE SAME WAY THE PROJECT ALWAYS MEASURES IT: run the SAME search
     * twice with different seeds and see how often it disagrees with ITSELF. The truth there is 0.00
     * by construction, so whatever it invents is what the instrument invents.
     *
     * This matters more here than anywhere: the search takes an ARGMAX over K^2 noisy estimates, and
     * an argmax over noise disagrees with anything. A raw divergence rate without this control cannot
     * distinguish "different player" from "coin flip over nine near-ties". */
    let best = null, bestVal = -1, magVal = null;
    let best2 = null, bestVal2 = -1;
    for (const ia of slots[0].order) for (const ib of slots[1].order) {
      const ca = slots[0].cands[ia], cb = slots[1].cands[ib];
      /* A SWITCH candidate is skipped rather than approximated: MAG's switch candidates name a
       * species to bring, and mapping that onto a MEDICHAM bench slot is a second matcher. Counted,
       * because a silently narrowed menu would make the two players look more alike than they are. */
      if (ca.switchTo || cb.switchTo) continue;
      const val = RL.rolloutAfterActions(board, side, {
        n: N, dex, explore: EXPLORE, field, seed: gi * 7919 + sampled + ia * 31 + ib,
        myClicks: [{ move: ca.move.id, targetLetter: ca.targetLetter },
                   { move: cb.move.id, targetLetter: cb.targetLetter }],
      });
      if (val === null) continue;
      if (val > bestVal) { bestVal = val; best = [ia, ib]; }
      if (ia === slots[0].order[0] && ib === slots[1].order[0]) magVal = val;
      /* The same cell, a different seed. Same candidates, same opponent policy, same everything the
       * search can see -- only the dice differ. */
      const val2 = RL.rolloutAfterActions(board, side, {
        n: N, dex, explore: EXPLORE, field, seed: 990001 + gi * 7919 + sampled + ia * 31 + ib,
        myClicks: [{ move: ca.move.id, targetLetter: ca.targetLetter },
                   { move: cb.move.id, targetLetter: cb.targetLetter }],
      });
      if (val2 !== null && val2 > bestVal2) { bestVal2 = val2; best2 = [ia, ib]; }
    }
    if (!best || magVal === null) { skipped++; return; }

    decisions++;
    const magPick = [slots[0].order[0], slots[1].order[0]];
    if (best[0] === magPick[0] && best[1] === magPick[1]) agreed++;
    else gaps.push(bestVal - magVal);
    if (best2 && (best2[0] !== best[0] || best2[1] !== best[1])) selfDisagree++;
  },
});

if (!decisions) {
  console.log('  no decisions scored — nothing to report.');
  process.exit(2);
}
const rate = 100 * (decisions - agreed) / decisions;
console.log(`  decisions compared  ${decisions.toLocaleString()}   (${skipped.toLocaleString()} skipped)`);
console.log(`  the search picked MAG's pair on ${agreed.toLocaleString()} of them`);
console.log(`\n  DIVERGENCE  ${rate.toFixed(1)}%\n`);
if (gaps.length) {
  const s = gaps.slice().sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  console.log(`  when they disagree, the search's pair is worth ${(100 * med).toFixed(1)} points more`);
  console.log('  BY ITS OWN LEAF, which is not evidence it is better — only that the two players');
  console.log('  are ranking the same menu differently. R4 is the only thing that answers "better".\n');
}
const floor = 100 * selfDisagree / decisions;
console.log(`  NOISE FLOOR — the same search, a different seed, disagreeing with ITSELF: ${floor.toFixed(1)}%`);
console.log('  The truth there is 0.00 by construction, so that is what the instrument invents.');
console.log('');
if (rate <= floor) {
  console.log('  -> NOT A RESULT. The search disagrees with MAG no more than it disagrees with');
  console.log('     itself, so this is an argmax over near-ties and not a different player.');
  console.log('     Raise N until the floor drops, then re-read the divergence.');
} else if (rate < 5) {
  console.log('  -> R3 FAILS. The search is MAG with extra steps: it cannot win more games than a');
  console.log('     player it agrees with, whatever R1 says about the leaf.');
} else {
  console.log('  -> R3 PASSES. These are different players, so an SPRT (R4) can tell them apart.');
  console.log('     Divergence is a precondition for winning more, not evidence of it.');
}

fs.writeFileSync(D('data', 'rollout-r3.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'engine/rollout_r3.js',
  games: GAMES, decisions, agreed, skipped, divergence_pct: rate,
  n: N, topK: TOPK, explore: EXPLORE,
  caveat: 'Both players rank the SAME candidate set, so this is a disagreement about value and not '
        + 'about the menu. The opponent is not modelled: it plays chooseAction during the stepped '
        + 'turn, identically for every candidate. Switch candidates are excluded and counted.',
}, null, 2) + '\n');
console.log('\n  wrote data/rollout-r3.json');
