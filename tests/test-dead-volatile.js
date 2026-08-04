/* test-dead-volatile.js — a move whose only effect is a volatile the target already has is not a
 * candidate.
 *
 * WHY THIS EXISTS. Will played MAG in the real client on 2026-08-01 and its Whimsicott used Encore
 * three times in one game, one of which failed outright. Every other "this move cannot work right
 * now" case is covered by a fitted feature — deadStatus, deadSide, deadField, deadWeather, deadStall,
 * deadNoLastMove — and volatiles are not, because `board.js:620` states that the stored corpus cannot
 * see them. So there is no weight to learn and this is a play-time rule instead.
 *
 * The checks below are as much about what must NOT be dropped as what must. A rule that removes
 * candidates is dangerous in exactly one direction: taking away a move that was fine. So Thousand
 * Arrows (a 120 BP attack that happens to carry a volatile), Protect (its volatile is on itself), and
 * Swagger (also boosts) are all asserted to survive.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const path = require('path');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('DEAD VOLATILE — re-applying a live volatile is not a choice\n');

if (!process.env.SHOWDOWN_PATH) {
  console.log('  FAIL SHOWDOWN_PATH is not set, so the Champions dex cannot be loaded');
  console.log('\nDEAD VOLATILE TESTS: 0 passed, 1 failed');
  process.exit(1);
}

const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const M = require(path.join(ROOT, 'engine', 'magnemite.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

/* ---- 1. THE DERIVED MOVE SET ------------------------------------------------------------------
 * The rule is not a list of move names, so assert it resolves to the right SHAPE against the real
 * dex rather than against a list typed here. */
const Pl = M.makeScoringPlayer({});
const proto = Pl.prototype;
ok(typeof proto._dropDeadVolatiles === 'function', 'the rule is a real method on the player');

/* A minimal stand-in for the player: _dropDeadVolatiles only touches this.board and this.stats. */
const board = new B.Board();
for (const side of ['p1', 'p2']) {
  board.setSheet(side, 'Whimsicott', { nature: 'Timid', item: 'Focus Sash', ability: 'Prankster', moves: ['encore', 'taunt', 'moonblast', 'protect'] });
  board.setSheet(side, 'Garchomp', { nature: 'Jolly', item: 'Life Orb', ability: 'Rough Skin', moves: ['earthquake', 'dragonclaw', 'swordsdance', 'protect'] });
  board.setParty(side, ['Whimsicott', 'Garchomp']);
  board.switchIn(side, 'a', 'Whimsicott');
  board.switchIn(side, 'b', 'Garchomp');
}
board.turn = 5;

const fake = { board, stats: {}, _dropDeadVolatiles: proto._dropDeadVolatiles };
const run = cands => proto._dropDeadVolatiles.call(fake, cands, board.slot('p1', 'a'), true);

const foeA = board.slot('p2', 'a');       // Whimsicott
const foeB = board.slot('p2', 'b');       // Garchomp
const cand = (moveName, target, spread) => ({
  move: dex.moves.get(moveName), targetMon: target || null, spread: spread || null, choice: 'move 1',
});

/* ---- 2. NOTHING IS DROPPED WHEN NO VOLATILE IS UP -------------------------------------------- */
let cs = [cand('Encore', foeA), cand('Taunt', foeA), cand('Moonblast', foeA)];
ok(run(cs).cands.length === 3, 'a clean board drops nothing');

/* ---- 3. THE ACTUAL DEFECT --------------------------------------------------------------------- */
board.startVolatile('p2', 'a', 'encore', 3);
ok(board.hasVolatile('p2', 'a', 'encore'), 'the board records the Encore that was just applied');

let out = run([cand('Encore', foeA), cand('Taunt', foeA), cand('Moonblast', foeA)]);
ok(out.cands.length === 2, 'Encore into an already-Encored target is dropped');
ok(!out.cands.some(c => c.move.id === 'encore'), '...and it is Encore that went, not something else');
ok(out.cands.some(c => c.move.id === 'taunt'), 'Taunt survives — a different volatile');

/* Aiming the SAME move at the OTHER foe must still be legal. */
out = run([cand('Encore', foeA), cand('Encore', foeB)]);
ok(out.cands.length === 1 && out.cands[0].targetMon === foeB,
  'Encore aimed at the partner-slot foe, who is not Encored, survives');

/* ---- 4. WHAT MUST NOT BE DROPPED -------------------------------------------------------------- */

/* Protect's volatile is on ITSELF, and clicking it twice is a real decision with real odds. */
board.startVolatile('p1', 'a', 'protect', 1);
out = run([cand('Protect', null), cand('Moonblast', foeA)]);
ok(out.cands.length === 2, 'Protect is never dropped — its volatile is self-targeting');

/* A damaging move that happens to carry a volatile still does its damage. */
const ta = dex.moves.get('Thousand Arrows');
if (ta && ta.exists) {
  board.startVolatile('p2', 'a', ta.volatileStatus, 5);
  board.startVolatile('p2', 'b', ta.volatileStatus, 5);
  out = run([cand('Thousand Arrows', null, [foeA, foeB]), cand('Moonblast', foeA)]);
  ok(out.cands.length === 2, `${ta.name} survives — it is a ${ta.basePower} BP attack, not a volatile`);
} else {
  ok(true, 'Thousand Arrows is not in this dex, so the damaging-move case is untestable here');
}

/* A status move that ALSO boosts still does the boost. */
const sw = dex.moves.get('Swagger');
if (sw && sw.exists) {
  board.startVolatile('p2', 'a', 'confusion', 4);
  out = run([cand('Swagger', foeA), cand('Moonblast', foeA)]);
  ok(out.cands.length === 2, 'Swagger survives — it also raises Attack, so it is not a total failure');
} else {
  ok(true, 'Swagger is not in this dex');
}

/* ---- 5. A SPREAD VOLATILE IS ONLY DEAD IF IT REACHES NOBODY NEW ------------------------------- */
const td = dex.moves.get('Teeter Dance');
if (td && td.exists) {
  const b2 = new B.Board();
  for (const side of ['p1', 'p2']) {
    b2.setSheet(side, 'Whimsicott', { nature: 'Timid', item: '', ability: 'Prankster', moves: ['teeterdance'] });
    b2.setParty(side, ['Whimsicott']);
    b2.switchIn(side, 'a', 'Whimsicott');
    b2.switchIn(side, 'b', 'Whimsicott');
  }
  b2.turn = 3;
  const f2 = { board: b2, stats: {} };
  const r2 = cands => proto._dropDeadVolatiles.call(f2, cands, b2.slot('p1', 'a'), true);
  const t2a = b2.slot('p2', 'a'), t2b = b2.slot('p2', 'b');
  const spreadCand = { move: td, targetMon: null, spread: [t2a, t2b], choice: 'move 1' };
  const filler = { move: dex.moves.get('Moonblast'), targetMon: t2a, spread: null, choice: 'move 2' };

  b2.startVolatile('p2', 'a', 'confusion', 4);
  ok(r2([spreadCand, filler]).cands.length === 2,
    'a spread volatile with ONE fresh target survives — it still lands on the other one');
  b2.startVolatile('p2', 'b', 'confusion', 4);
  ok(r2([spreadCand, filler]).cands.length === 1,
    '...and is dropped only once every target it reaches already has it');
} else {
  ok(true, 'Teeter Dance is not in this dex, so the spread case is untestable here');
}

/* ---- 6. IT MUST NEVER HAND BACK AN EMPTY LIST ------------------------------------------------- */
const only = run([cand('Encore', foeA)]);
ok(only && only.cands.length === 1,
  'when every candidate is dead the list is returned unchanged rather than emptied');
ok(fake.stats.deadVolatileAllDead > 0, '...and that is counted, not silent');

/* ---- 7. SWITCHES ARE NOT MOVES ---------------------------------------------------------------- */
out = run([{ move: null, switchTo: 'garchomp', targetMon: null, choice: 'switch 2' }, cand('Encore', foeA)]);
ok(out.cands.some(c => c.switchTo === 'garchomp'), 'a switch candidate is untouched by the rule');

console.log(`\nDEAD VOLATILE TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
