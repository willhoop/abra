/* test-end-state.js — THE GATE ON THE END-STATE MEASUREMENT, not on the engines it measures.
 *
 *   SHOWDOWN_PATH=... node tests/test-end-state.js
 *
 * WHAT IS BEING MEASURED AND WHY IT NEEDED A NEW STOP RULE. Will, 2026-08-12: *"how much is just
 * medicham being semantic"* — of the games whose PROTOCOL parted, how many end with the two engines
 * holding the SAME board, and how many genuinely played a different battle. Until this pass the driver
 * stopped at the first mismatched LINE (protocol mode) or the first mismatched BOARD (`--state`), so
 * the end of a diverged game was never reached and nobody could answer.
 *
 * `--end-state` is the third stop rule: run to the turn cap or to the end of the battle WHATEVER
 * either comparator has already found, and compare the LAST board both engines produced.
 *
 * WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE". A divergence is a finding and the driver reports
 * it. This file goes red only when the INSTRUMENT is wrong, in the four ways it can be:
 *
 *   PART 1  the verdict function itself — every branch, including the two that must NOT be folded
 *           into "agreed": a game that threw, and a game where ONE engine ended the battle and the
 *           other did not. A silent drop there would flatter the semantic rate, which is the whole
 *           number being reported.
 *   PART 2  the stop rule actually changed. A game whose protocol parted on turn 1 must still be
 *           playing on turn 2, or `--end-state` is `--state` wearing a new name and every "the boards
 *           agreed at the end" is really "the boards agreed at the point we stopped looking".
 *   PART 3  a PLANTED difference that is never undone must be caught AT THE END and LOCALISED, with
 *           the SAME PAIR AND SEED run clean as an explicit control. A comparator that has not been
 *           shown catching a planted end-state bug is not a comparator (168 red demonstrations in
 *           this repo, 0 failures, five probes found this week resting on the defect they watched).
 *   PART 4  the cross-tab is over the SHAPE module, not a second copy of it.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

/* THE DRIVER READS ITS FLAGS OFF argv, so the end-state path has to be armed before it is loaded —
 * exactly as tests/test-state-differential.js arms `--state`. Asserted immediately after the require,
 * because a run with the flag unread would pass every assertion below on an empty measurement. */
process.argv.push('--end-state');
const G = require(D('engine', 'game_differential.js'));
const SHAPE = require(D('engine', 'divergence_shape.js'));

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

if (!G.END_STATE) fail('the driver did not read --end-state — nothing below measures anything');
else pass('the driver is in end-state mode');
if (!G.STATE_ON) fail('--end-state did not turn the BOARD comparison on; there is nothing to compare');
else pass('--end-state implies --state, so boards are read at every boundary');

/* ================= PART 1 — EVERY BRANCH OF THE VERDICT ========================================= */
console.log('\nPART 1 — the verdict function, every branch, on fabricated rows');
{
  const V = G.endStateVerdict;
  if (typeof V !== 'function') fail('the driver exports no endStateVerdict — the measurement does not exist');
  else {
    const cases = [
      ['a game that threw is its own answer, never an agreement',
       { err: 'p1 choice rejected', divTurn: 1, endedMedi: false, endedSd: false,
         finalBoard: { turn: 3, identical: true, diffs: [] } }, 'THREW'],
      ['both engines still playing at the cap, boards equal',
       { divTurn: 1, endedMedi: false, endedSd: false, finalBoard: { turn: 12, identical: true, diffs: [] } },
       'SAME-END-STATE'],
      ['both engines still playing at the cap, boards differ',
       { divTurn: 1, endedMedi: false, endedSd: false,
         finalBoard: { turn: 12, identical: false, diffs: [{ path: 'p1.active[0].hp' }] } },
       'DIFFERENT-END-STATE'],
      ['both engines ended the battle together, boards equal',
       { divTurn: 2, endedMedi: true, endedSd: true, finalBoard: { turn: 7, identical: true, diffs: [] } },
       'SAME-END-STATE'],
      ['ONLY medicham2 thinks the battle is over — this is not an agreement',
       { divTurn: 2, endedMedi: true, endedSd: false, finalBoard: { turn: 7, identical: true, diffs: [] } },
       'ENDED-APART'],
      ['ONLY showdown thinks the battle is over — this is not an agreement either',
       { divTurn: 2, endedMedi: false, endedSd: true, finalBoard: { turn: 7, identical: true, diffs: [] } },
       'ENDED-APART'],
      ['no board was ever compared — a third answer, never counted as agreement',
       { divTurn: 0, endedMedi: false, endedSd: false, finalBoard: null }, 'NO-COMPARABLE-BOARD'],
    ];
    for (const [what, row, want] of cases) {
      const got = V(row);
      if (got === want) pass(what + '  -> ' + got);
      else fail(what + '  -> got ' + got + ', want ' + want);
    }
    /* THE ONE THAT WOULD FLATTER THE NUMBER. `ENDED-APART` with identical boards is the case a
     * careless classifier folds into SAME-END-STATE, and it is the opposite of cosmetic: one engine
     * has stopped the battle and the other has not. Asserted separately so it cannot regress quietly. */
    const sneaky = V({ divTurn: 1, endedMedi: true, endedSd: false,
                       finalBoard: { turn: 4, identical: true, diffs: [] } });
    if (sneaky === 'SAME-END-STATE') fail('a game ONE engine ended was reported as the same end state');
    else pass('an identical board does not launder a battle only one engine ended');
  }
}

/* ================= PART 2 — THE STOP RULE ACTUALLY MOVED ======================================== */
console.log('\nPART 2 — a game whose protocol parts on turn 1 must keep playing');
const PAIRS = G.pairsFor('baseline');
if (!PAIRS.length) fail('no baseline pairs could be built — nothing below ran');
let usedPair = null, endRow = null;
for (const pr of PAIRS.slice(0, 12)) {
  const r = G.playGame(pr.a, pr.b, 'baseline', 'endstate/' + pr.tag.slice(0, 24));
  if (r.err) continue;
  if (r.div && r.divTurn != null && r.divTurn <= 1) { usedPair = pr; endRow = r; break; }
}
if (!endRow) {
  note('no pair in the first 12 parted at or before turn 1 without throwing — PART 2 could not be');
  note('staged, which is a claim about the FIXTURE and not about the stop rule.');
  fail('PART 2 COULD NOT BE STAGED — see the note above; it is not a pass');
} else {
  note(usedPair.tag);
  note('protocol parted at turn ' + endRow.divTurn + ', the game ran ' + endRow.turns + ' turn(s), '
       + endRow.boundaries + ' board(s) compared, end reason: ' + endRow.endReason);
  if (endRow.turns <= endRow.divTurn)
    fail('the game stopped at its protocol divergence — --end-state is --state wearing a new name');
  else pass('the game played on past the mismatched line (turn ' + endRow.divTurn + ' -> ' + endRow.turns + ')');
  if (!endRow.finalBoard) fail('no finalBoard was recorded, so there is no end state to compare');
  else pass('a final board was recorded at boundary ' + endRow.finalBoard.turn
            + ', identical=' + endRow.finalBoard.identical);
  if (typeof endRow.endedMedi !== 'boolean' || typeof endRow.endedSd !== 'boolean')
    fail('the two engines\' own "is the battle over" answers were not recorded — the third answer '
         + '(one side ended early) cannot be told from an agreement');
  else pass('both engines\' end-of-battle flags recorded (medi=' + endRow.endedMedi + ', sd=' + endRow.endedSd + ')');
}

/* ================= PART 3 — A PLANT THAT IS NEVER UNDONE, AGAINST A CLEAN CONTROL =============== */
console.log('\nPART 3 — a planted board difference must survive to the end, and the control must not have it');
if (!PAIRS.length) fail('no pairs — PART 3 did not run');
else {
  const pr = usedPair || PAIRS[0];
  /* THE ITEM IS THE PLANT, deliberately: an HP plant can be erased by a faint and a boost by a Haze,
   * and a plant the game can legally undo would make a false GREEN look like a false RED. An item slot
   * that is emptied and never refilled stays different for the rest of the battle. */
  const plantAt = 1;
  const clean = G.playGame(pr.a, pr.b, 'baseline', 'endstate/control');
  let applied = false;
  const planted = G.playGame(pr.a, pr.b, 'baseline', 'endstate/planted', {
    statePlant: (S, b, turnIdx) => {
      if (turnIdx !== plantAt || applied) return;
      const m = (S.actA || []).find(x => x && !x.fainted && x.curHP > 0);
      if (!m) return;
      m.item = m.item ? '' : 'leftovers';
      applied = true;
    } });
  if (!applied) {
    fail('THE PLANT WAS NEVER APPLIED — a comparator that finds nothing has proved nothing. This is a '
       + 'claim about the fixture (no living body on side A at boundary ' + plantAt + '), not about the engine.');
  } else {
    const cv = G.endStateVerdict(clean), pv = G.endStateVerdict(planted);
    note('control  ' + cv + '   (' + clean.turns + ' turns, ' + clean.boundaries + ' boards, '
         + clean.endReason + ')');
    note('planted  ' + pv + '   (' + planted.turns + ' turns, ' + planted.boundaries + ' boards, '
         + planted.endReason + ')');
    const paths = (planted.finalBoard && planted.finalBoard.diffs || []).map(d => d.path || '');
    const cpaths = (clean.finalBoard && clean.finalBoard.diffs || []).map(d => d.path || '');
    if (pv !== 'DIFFERENT-END-STATE')
      fail('the planted item difference did not reach the end state — verdict ' + pv);
    else pass('the plant is caught AT THE END: ' + pv);
    if (!paths.some(p => p.indexOf('.item') >= 0))
      fail('caught but NOT LOCALISED to the item that was planted: ' + paths.slice(0, 6).join(', '));
    else pass('localised to the planted field (' + paths.filter(p => p.indexOf('.item') >= 0)[0] + ')');
    /* THE CONTROL, CLEARED EXPLICITLY. Without this the plant proves nothing: the same pair might have
     * parted on an item all by itself, and the "catch" would be the game. */
    if (cpaths.some(p => p.indexOf('.item') >= 0))
      fail('THE CONTROL ALREADY DIFFERS ON AN ITEM — this pair cannot prove the plant was caught. '
         + 'Choose another fixture: ' + cpaths.filter(p => p.indexOf('.item') >= 0).join(', '));
    else pass('the control game does not differ on any item leaf, so the catch is the plant');
  }
}

/* ================= PART 4 — ONE SHAPE FUNCTION, NOT TWO ========================================= */
console.log('\nPART 4 — the cross-tab reads the shape out of engine/divergence_shape.js');
{
  if (typeof G.shapeOfCause !== 'function') fail('the driver does not expose the shape it cross-tabs by');
  else {
    const probes = [
      ['|-damage|p1a: Ceruledge|50/100 <> |-damage|p2a: Ceruledge|50/100', 'ORDERING'],
      ['|-damage|p1a: Ceruledge|50/100 <> |-heal|p1a: Ceruledge|60/100', 'RULE'],
      ['|-damage|p1a: Ceruledge|50/100 <> |-damage|p1a: Ceruledge|60/100', 'FIELD'],
      ['not a protocol line at all', 'UNPARSED'],
    ];
    let ok = true;
    for (const [c, want] of probes) {
      const a = G.shapeOfCause(c).shape, b = SHAPE.shapeOf(c).shape;
      if (a !== b || a !== want) { ok = false; fail('shape disagreement on "' + c + '": driver ' + a + ', module ' + b + ', want ' + want); }
    }
    if (ok) pass('the driver and engine/divergence_shape.js return the same shape on every probe');
  }
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — the end-state instrument is not trustworthy'
                             : 'ALL GREEN — the end-state measurement measures what it says it does'));
process.exit(failures ? 1 : 0);
