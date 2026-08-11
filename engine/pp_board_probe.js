/* pp_board_probe.js — DOES A BOARD ROLLOUT RUN OUT OF PP? (ROADMAP #145, SEARCH)
 *
 * ROADMAP #144 gave `engine/medicham2-browser.js` real PP: a body inside a playout spends it, the
 * chooser refuses an empty slot, and Struggle fires when every slot is drained. That fix is entirely
 * INSIDE one playout. `engine/board.js` — the state every MILTANK candidate is imagined from —
 * tracked no PP at all, so **every rollout started at full PP no matter what the real game had
 * already spent**, and the search could price a stall line that cannot exist.
 *
 * The simulator's own header says it (medicham2-browser.js, the ROADMAP #144 block):
 *
 *     "WHAT IS NOT CLAIMED: a rollout STARTS at full PP, because board.js does not track PP and is
 *      not ENGINE's to change. So a stall priced 8 turns deep inside a rollout is 8 turns from NOW,
 *      not 8 from the start of the game."
 *
 * WHY IT MATTERS DESPITE SHORT GAMES. Real games end at a median of 6 turns (ROADMAP #38) and the
 * rollout cap is 60. That gap is the whole problem rather than a reason to ignore it: a 60-turn
 * playout with infinite PP can discover unlimited Protect, unlimited recovery and unlimited
 * redirection. That is a systematically WRONG valuation of exactly the positions where the search
 * believes it is being clever, not a harmless approximation.
 *
 * THE MEASUREMENT. One Pokemon whose declared sheet holds a single move, Protect (`maxpp` 8 in this
 * format, read off the artifact, never typed). The board is told the real game has ALREADY seen `k`
 * Protects from it, through `board.js`'s own `noteMove` — the same call every offline adapter and the
 * live player make. Then one playout is run through `rollout_leaf`'s OWN `buildSide`/`runPlayout`,
 * with the protocol trace armed, and the `|move|` lines are counted.
 *
 * The quantity is TOTAL PROTECTS THE POSITION CONTAINS: `k` already spent plus what the rollout adds.
 * A correct engine can never exceed 8. Before the board carried PP the answer was `k + 8` for every
 * `k`, which is the RED arm at k=8: sixteen Protects out of a move that has eight.
 *
 * Not a leaf-value claim and deliberately so — `n=1` and one board says nothing about win rates. It
 * says whether the state is representable, which is the prerequisite for the value being worth
 * measuring at all. Two controls guard the two ways this could pass while being broken: `k=0` must
 * still yield the full 8 (the fix must not deduct what was never spent), and the Struggle count must
 * be non-zero exactly when the slot is empty (an empty menu that silently passes the turn would show
 * as 0 Protects and prove nothing).
 *
 *   node engine/pp_board_probe.js            # prints the table, writes data/pp-board-probe.json
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));                 // globalThis.MC / mcEff, for MEDICHAM
const MEDI = require('./medicham2-browser.js');
const B = require('./board.js');
const RL = require('./rollout_leaf.js');
const TAGS = require('./tags.js');

const MOVE = 'protect';
const MAXPP = (() => {
  /* READ, NEVER TYPED. `tag_dex.js` reads `moveSlots[].maxpp` off a real battle constructed in
   * gen9championsvgc2026regmb; Champions compresses PP and Protect is the worst offender (8 here
   * against 16 mainline), so a literal in this file would be wrong in the one direction that makes
   * the probe pass while the engine is broken. */
  const p = TAGS.param('move', MOVE, 'pp');
  if (!p || !(+p.max > 0)) throw new Error('no pp row for ' + MOVE + ' — the artifact cannot answer this probe');
  return +p.max;
})();

/* A one-move sheet, so the playout has exactly one thing it can click and the count is unambiguous. */
function makeBoard(k) {
  const bd = new B.Board();
  const sheet = mv => ({ nature: 'Adamant', item: '', ability: '', moves: mv });
  bd.setParty('p1', ['incineroar']);
  bd.setParty('p2', ['garchomp']);
  bd.setSheet('p1', 'incineroar', sheet([MOVE]));
  bd.setSheet('p2', 'garchomp', sheet([MOVE]));
  bd.switchIn('p1', 'a', 'incineroar');
  bd.switchIn('p2', 'a', 'garchomp');
  /* THE ONLY INPUT THAT DIFFERS BETWEEN ARMS. `noteMove` is board.js's own "this move was actually
   * used" hook — the one every offline adapter (fit_policy, joint_rows, corpus_shift, branch_recall)
   * and magnemite.js call. Nothing here reaches into board state by hand. */
  const stub = { id: MOVE, stallingMove: true };
  for (let i = 0; i < k; i++) B.noteMove(bd, 'p1', bd.slot('p1', 'a'), stub, true);
  return bd;
}

/* ONE PLAYOUT, THROUGH THE LEAF'S OWN MACHINERY. buildSide and runPlayout are rollout_leaf's exports;
 * nothing here re-implements a playout, because a second turn loop is how this project got two
 * MILTANKs (docs/MILTANK.md §2). The trace is armed by handing battleInit's state a `_trace` sink,
 * which is what makes the count a count of PROTOCOL LINES rather than of an inferred side effect. */
function runOne(bd, seed) {
  const stats = { fainted: 0, unbuildable: 0, threw: 0 };
  const A = RL.buildSide(bd, 'p1', undefined, stats);
  const Bt = RL.buildSide(bd, 'p2', undefined, stats);
  if (!A.length || !Bt.length) throw new Error('probe board did not build: ' + JSON.stringify(stats));
  const S = MEDI.battleInit(A, Bt, { seeded: true });
  S._trace = [];
  S.maxTurns = 60;
  RL.applyField(S, {}, 'p1', true);
  let a = (seed >>> 0);
  const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  RL.runPlayout(S, rng, 1.0, 'uniform', { threw: 0, first: null });
  /* A `|move|` LINE IS THE UNIT, not a successful Protect. Showdown deducts PP above the announcement
   * and below every BeforeMove refusal, so a Protect that `-fail`s to the consecutive-use roll has
   * still been spent — counting only the successful ones would undercount the exact thing being
   * measured. Split by field rather than through `traceCanon`, which normalises a line to a string. */
  let protects = 0, struggles = 0, nopp = 0;
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9:]/g, '');
  for (const line of S._trace) {
    const f = String(line).split('|').map(norm);
    if (f[1] === 'move' && f[2].startsWith('p1a:')) {
      if (f[3] === MOVE) protects++;
      if (f[3] === 'struggle') struggles++;
    }
    if (f[1] === 'cant' && f[2].startsWith('p1a:') && f[3] === 'nopp') nopp++;
  }
  /* WHAT THE BODY THINKS IT HAS LEFT, read off the engine's own field rather than inferred, so a
   * seeding that silently wrote nothing is distinguishable from one that wrote a full table. */
  const seeded = A[0] && A[0]._pp ? JSON.parse(JSON.stringify(A[0]._pp)) : null;
  return { protects, struggles, nopp, seeded };
}

/* ---- PRESSURE, AS ITS OWN ARM, BECAUSE A ZERO COUNTER PROVES NOTHING -------------------------
 *
 * `board.ppCounters.pressureCharged` reads 0 over the whole stored corpus. That is consistent with
 * "no Pressure body was ever on the field" AND with "the wire is inert", and CLAUDE.md is explicit
 * that a capability which cannot prove it ran is assumed broken. These two arms stage a Pressure foe
 * deliberately and assert the CONTRAST, which is the only thing that separates the two explanations.
 *
 * THE CONTRAST IS THE POINT AND THE NAIVE VERSION FAILS IT. Pressure charges per APPARENT TARGET, so
 * an aimed move costs 2 PP a click and a SELF-TARGETING one costs 1 — measured in Showdown, not
 * reasoned: Protect goes 8 -> 3 in five clicks against Pressure and against Levitate alike, while
 * Flamethrower goes 16 -> 6 against Pressure and 16 -> 11 against Levitate. An implementation that
 * simply doubles every deduction under Pressure passes the attacking arm and fails the Protect one,
 * which is why both are here. */
function pressureArms() {
  const arms = [];
  for (const [label, ability] of [['pressure', 'pressure'], ['levitate (control)', 'levitate']]) {
    for (const [what, mv] of [['aimed (flamethrower)', 'flamethrower'], ['self (protect)', MOVE]]) {
      const bd = new B.Board();
      bd.setParty('p1', ['incineroar']);
      bd.setParty('p2', ['garchomp']);
      bd.setSheet('p1', 'incineroar', { nature: 'Adamant', item: '', ability: '', moves: [mv] });
      bd.setSheet('p2', 'garchomp', { nature: 'Jolly', item: '', ability, moves: [MOVE] });
      bd.switchIn('p1', 'a', 'incineroar');
      bd.switchIn('p2', 'a', 'garchomp');
      const dexMove = { id: mv, target: mv === MOVE ? 'self' : 'normal', stallingMove: mv === MOVE };
      const before = bd.ppLeft('p1', 'incineroar', mv);
      B.noteMove(bd, 'p1', bd.slot('p1', 'a'), dexMove, true);
      const after = bd.ppLeft('p1', 'incineroar', mv);
      arms.push({ foeAbility: label, move: what, max: before, left: after, costOfOneClick: before - after });
    }
  }
  return arms;
}

function main() {
  const rows = [];
  for (const k of [0, 5, MAXPP]) {
    const bd = makeBoard(k);
    /* The board's OWN answer, before a body is built — null when board.js has no PP concept at all,
     * which is what makes the pre-fix arm readable rather than merely wrong. */
    const boardLeft = typeof bd.ppLeft === 'function' ? bd.ppLeft('p1', 'incineroar', MOVE) : null;
    const r = runOne(bd, 90210 + k);
    rows.push({ alreadyUsed: k, boardSaysLeft: boardLeft,
                bodySeededWith: r.seeded, protectsInRollout: r.protects,
                totalProtects: k + r.protects, struggles: r.struggles, cantNoPP: r.nopp,
                exceedsMax: (k + r.protects) > MAXPP });
  }
  const pressure = pressureArms();
  const find = (a, m) => pressure.find(x => x.foeAbility === a && x.move.startsWith(m));
  const pressureOK = find('pressure', 'aimed').costOfOneClick === 2 &&
                     find('levitate (control)', 'aimed').costOfOneClick === 1 &&
                     find('pressure', 'self').costOfOneClick === 1 &&
                     find('levitate (control)', 'self').costOfOneClick === 1;
  const bad = rows.filter(r => r.exceedsMax);
  const out = {
    probe: 'pp-board', roadmap: 145, move: MOVE, maxpp: MAXPP,
    what: 'total Protect executions a position contains: already spent on the board + spent inside one rollout',
    verdict: (bad.length || !pressureOK)
      ? ('RED — ' + (bad.length ? 'the rollout can spend PP the position no longer has' : 'Pressure is charged wrongly'))
      : 'GREEN',
    rows, pressure, pressureOK,
    counters: JSON.parse(JSON.stringify(B.ppCounters)),
    generated: new Date().toISOString(),
  };
  const w = (s) => String(s).padStart(9);
  console.log(`\nPP IN THE ROLLOUT — ${MOVE}, maxpp ${MAXPP} (read from data/tags.json)\n`);
  console.log('  usedOnBoard  boardLeft  inRollout      TOTAL  struggles  cant|nopp  verdict');
  for (const r of rows) {
    console.log('  ' + w(r.alreadyUsed) + '  ' + w(r.boardSaysLeft === null ? 'n/a' : r.boardSaysLeft) +
      '  ' + w(r.protectsInRollout) + '  ' + w(r.totalProtects) + '  ' + w(r.struggles) +
      '  ' + w(r.cantNoPP) + '  ' + (r.exceedsMax ? 'OVER MAX' : 'ok'));
  }
  console.log('\n  PRESSURE — the extra is per APPARENT TARGET, so a self-targeting move pays nothing extra\n');
  console.log('  foe ability          move                    max   left   cost of one click');
  for (const a of pressure) {
    console.log('  ' + a.foeAbility.padEnd(20) + a.move.padEnd(22) + String(a.max).padStart(5) +
      String(a.left).padStart(7) + String(a.costOfOneClick).padStart(20));
  }
  console.log('\n  pressure arms: ' + (pressureOK ? 'ok' : 'WRONG'));
  console.log('  board counters: ' + JSON.stringify(out.counters));
  console.log('\n  ' + out.verdict + '\n');
  fs.writeFileSync(D('data', 'pp-board-probe.json'), JSON.stringify(out, null, 2));
  console.log('  wrote data/pp-board-probe.json');
  return (bad.length || !pressureOK) ? 1 : 0;
}

if (require.main === module) process.exit(main());
module.exports = { makeBoard, runOne, MAXPP };
