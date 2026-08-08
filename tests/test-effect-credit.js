/* test-effect-credit.js — THE RED DEMONSTRATION FOR "A CLICK IS NOT A TEST". ROADMAP #91.
 *
 *   SHOWDOWN_PATH=... node tests/test-effect-credit.js
 *
 * `engine/game_differential.js` used to credit a census row the moment an entity carrying its tag was
 * CLICKED. Nothing asked whether the move did anything.
 *
 * CAUGHT LIVE: Primarina clicked Haze on turn 1 into a board with zero boosts on it. Haze is a no-op
 * there. The row was marked exercised and the driver moved on.
 *
 * IT COMPOUNDS, WHICH IS WHY IT IS WORTH A TEST OF ITS OWN. The census SELECTS THE SAMPLE — `covWant`
 * prefers the least-exercised row — so a falsely credited row steers every LATER run AWAY from the
 * mechanic it was supposed to test. A wrong coverage number is not a cosmetic problem here; it is a
 * sampling bias that hides mechanics for good.
 *
 * WHAT IS PROVED, in the order that makes each step mean something:
 *
 *   1  THE CONTROL, CLEARED EXPLICITLY. Haze into a BOOSTED board scores ONE credit. If this failed,
 *      step 2 would be indistinguishable from a crediting path that never fires at all.
 *   2  RED. The SAME move, the same body, the same click, into an EMPTY board scores ZERO. This is
 *      the case the old counter called covered.
 *   3  THE STEERING FOLLOWS THE CREDIT. An uncredited row must still be WANTED; a credited one must
 *      not. That is the half that decides which games the next run plays.
 *   4  THE DERIVATION DOES NOT OVER-MATCH. A tag that moves no board leaf must be DECLARED so, not
 *      quietly credited on somebody else's effect.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

const G = require(D('engine', 'game_differential.js'));

const st = r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] });
/* A FIXTURE, per the same declared exception the DIRECTED table in the driver carries: "Haze into a
 * board with no boosts on it" is a specific board and cannot be derived from a tag.
 *
 * EVERY BODY HERE IS CHOSEN TO MOVE NO STAT BY ITSELF. No Intimidate, no Download, no Speed Boost, no
 * Defiant — otherwise a boost leaf would move for a reason that is not the move under test, and the
 * empty-board arm would credit Haze for somebody else's work. */
const A = [
  st(['meowscarada', '', 'Overgrow', ['Swords Dance', 'Protect']]),
  st(['primarina', '', 'Torrent', ['Haze', 'Protect']]),
  st(['clefable', '', 'Unaware', ['Protect']]),
  st(['milotic', '', 'Marvel Scale', ['Protect']]),
];
const B = [
  st(['snorlax', '', 'Thick Fat', ['Protect']]),
  st(['corviknight', '', 'Pressure', ['Protect']]),
  st(['toxapex', '', 'Regenerator', ['Protect']]),
  st(['garchomp', '', 'Rough Skin', ['Protect']]),
];
const P2 = [{ m: 'protect' }, { m: 'protect' }];
/* TWO TURNS IN BOTH ARMS, so the two runs credit over the same number of turn boundaries and a
 * difference cannot be "one arm had more chances". */
const BOOSTED = [{ p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: P2 },
                 { p1: [{ m: 'protect' }, { m: 'haze' }], p2: P2 }];
const EMPTY = [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: P2 },
               { p1: [{ m: 'protect' }, { m: 'haze' }], p2: P2 }];

const KEY = 'move:clearsBoosts';
const BOOSTKEY = 'move:boostsUser';

function run(script) {
  G.driverReset();
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return null;
  const r = G.playGame(a, b, 'directed', 'credit/x', { script });
  const kind = G.CREDIT_KIND.get(KEY) || { effect: 0, negative: 0, click: 0 };
  return { err: r.err, turns: r.turns,
           credit: G.COV_CREDIT.get(KEY) || 0, kind,
           attempts: G.COV_ATTEMPT.get(KEY) || 0,
           touched: G.COV_TOUCHED.has(KEY),
           boostCredit: G.COV_CREDIT.get(BOOSTKEY) || 0,
           want: G.covWant('moves', 'haze'),
           trace: r.mediTrace };
}

/* ================= PART 0 — THE ROW EXISTS AND HAZE IS IN IT ==================================== */
console.log('\nPART 0 — the census row this test is about');
{
  const t = G.COV_TARGETS.find(x => x.key === KEY);
  if (!t) fail('there is no `' + KEY + '` row in the census — this test would prove nothing');
  else if (!t.entities.has('haze')) fail(KEY + ' does not carry Haze: ' + [...t.entities].join(', '));
  else {
    pass(KEY + ' carries ' + [...t.entities].join(', ') + ', witness families ['
      + t.witness.families.join(',') + ']');
    if (t.witness.kind === 'no-board-leaf')
      fail('the derivation calls ' + KEY + ' leafless. Haze RESETS STAT STAGES, which the board '
         + 'comparator reads — if this is leafless, the derivation lost the one family that matters.');
  }
}

/* ================= PART 1 — THE CONTROL: HAZE INTO A BOOSTED BOARD ============================== */
console.log('\nPART 1 — THE CONTROL, CLEARED FIRST. Haze into a BOOSTED board must score ONE.');
const boosted = run(BOOSTED);
if (!boosted) fail('the staged pair could not be built');
else if (boosted.err) fail('the boosted arm threw: ' + boosted.err);
else {
  const sawBoost = boosted.trace.some(l => /^\|-boost\|.*atk/.test(String(l)));
  const sawHaze = boosted.trace.some(l => /^\|move\|.*haze/i.test(String(l)));
  if (!sawBoost) fail('the boosted arm never emitted a `-boost` — the fixture staged NOTHING, which '
       + 'is the failure four of six staged demos hit on 2026-08-07. Nothing below means anything.');
  else if (!sawHaze) fail('Haze was never clicked in the boosted arm — the script did not run');
  else if (boosted.kind.effect < 1)
    fail('Haze cleared a REAL +2 Attack and scored ' + boosted.kind.effect + ' effect credits. The '
       + 'crediting path does not fire at all, so PART 2\'s zero would prove nothing.');
  else pass('Haze into a board carrying +2 Attack scores ' + boosted.kind.effect
       + ' effect credit(s), attempts ' + boosted.attempts);
}

/* ================= PART 2 — RED: THE SAME CLICK INTO AN EMPTY BOARD ============================= */
console.log('\nPART 2 — RED. The SAME click into an EMPTY board must score ZERO.');
const empty = run(EMPTY);
if (!empty) fail('the staged pair could not be built');
else if (empty.err) fail('the empty arm threw: ' + empty.err);
else {
  const sawHaze = empty.trace.some(l => /^\|move\|.*haze/i.test(String(l)));
  const sawBoost = empty.trace.some(l => /^\|-boost\|/.test(String(l)));
  if (!sawHaze)
    fail('Haze was not clicked in the empty arm either, so the zero below is the script and not the '
       + 'credit rule. THIS IS THE FAILURE THAT LOOKS LIKE A PASS.');
  else if (sawBoost)
    fail('the empty arm emitted a `-boost` after all — the board was not empty and the arm is not a '
       + 'control: ' + empty.trace.filter(l => /^\|-boost\|/.test(String(l)))[0]);
  else if (empty.credit !== 0)
    fail('Haze into a board with no boosts on it scored ' + empty.credit + ' credit(s) ('
       + JSON.stringify(empty.kind) + '). It is a no-op there. This is the exact over-claim #91 '
       + 'exists to remove.');
  else if (!empty.touched)
    fail('the row was not even recorded as TOUCHED, so the zero is "nothing was in play" and not '
       + '"it was clicked and did nothing" — those are different claims and only the second is the point.');
  else if (empty.attempts < 1)
    fail('the click was not counted as an ATTEMPT. Without that the steering has no tie-break and an '
       + 'uncreditable row pins the driver to itself for ever.');
  else pass('Haze into a board with no boosts scores 0 credits and ' + empty.attempts
       + ' attempt(s) — CLICKED, AND NOT COUNTED AS TESTED');
}

/* THE TWO ARMS MUST DIFFER IN ONE THING. If the boosted arm merely ran longer, its credit would not
 * be attributable to the boost. */
if (boosted && empty && !boosted.err && !empty.err) {
  if (boosted.turns !== empty.turns)
    fail('the two arms played ' + boosted.turns + ' and ' + empty.turns + ' turns. They are not a '
       + 'controlled pair and the difference in credit is partly the length.');
  else pass('both arms played ' + boosted.turns + ' turns, so the ONLY difference is whether there '
       + 'was a boost on the board for Haze to clear');
  if (boosted.kind.effect > 0 && empty.credit === 0)
    pass('THE KNOB IS WIRED: ' + boosted.kind.effect + ' vs 0 credits for the same move, same body, '
       + 'same click. Under the old counter BOTH were 1.');
}

/* ================= PART 3 — THE STEERING FOLLOWS THE CREDIT ===================================== */
console.log('\nPART 3 — the steering. A row that has never been seen to act must still be WANTED.');
if (boosted && empty && !boosted.err && !empty.err) {
  /* `covWant` is lexicographic: credit first, attempts second. Lower = more wanted. */
  if (!(empty.want < boosted.want))
    fail('after a no-op Haze the driver wants it ' + empty.want + ', and after a real one ' + boosted.want
       + '. An uncredited row must be strictly MORE wanted, or the falsely credited row goes on '
       + 'steering every future run away from the mechanic.');
  else pass('a row that did nothing scores ' + empty.want + ' and one that acted scores ' + boosted.want
       + ' — lower is more wanted, so the driver keeps steering toward the untested one');
  /* AND THE ATTEMPT MUST STILL BREAK A TIE, or an uncreditable row is maximally wanted for ever and
   * the swarm stops exploring — a new silent failure introduced by the fix. */
  const before = G.covWant('moves', 'haze');
  if (!(before > 0 && before < 1e6))
    fail('an attempted-but-uncredited row scores ' + before + '. It must be above zero (so a second '
       + 'click is slightly less wanted) and below one credit (so it still outranks anything that '
       + 'has acted).');
  else pass('an attempted-but-uncredited row scores ' + before + ': above 0, below one credit');
}

/* ================= PART 4 — THE DERIVATION DOES NOT OVER-MATCH ================================== */
console.log('\nPART 4 — a tag that moves no board leaf is DECLARED so, not credited on somebody else\'s');
console.log('         effect. These four were caught over-matching before the rule was wired.');
{
  /* Each of these WAS given a witness family by the first cut of the derivation, and each would have
   * been credited on an effect it does not produce. They are the reason the rule is printed before it
   * is used. */
  const MUST_BE_LEAFLESS = [
    ['damageBoost', 'a damage MULTIPLIER — it would have been credited on any stat change, because '
      + 'its name contains "boost"'],
    ['weightBased', 'Grass Knot reads a weight; it would have been credited on any damage'],
    ['convertsMoveType', '`into: "Dragon"` is a TYPE and was being read as a SPECIES'],
    ['statusCategory', '"this move is in the Status category" was being read as "a status appeared"'],
    ['terrainScaled', 'it READS the terrain; crediting it when the terrain changed would credit the '
      + 'mechanic that SET it'],
  ];
  for (const [tag, why] of MUST_BE_LEAFLESS) {
    const w = G.witnessFor('moves', tag, new Set());
    const w2 = G.witnessFor('abilities', tag, new Set());
    if (w.kind !== 'no-board-leaf' || w2.kind !== 'no-board-leaf')
      fail(tag + ' is not declared leafless (families [' + w.families.join(',') + ']) — ' + why);
    else pass(tag + ' is DECLARED leafless: ' + why);
  }
  /* AND THE OPPOSITE ERROR. A rule that declares everything leafless would pass the block above and
   * measure nothing at all, so the mechanics that DO move a leaf are asserted too. */
  const MUST_HAVE = [['setsWeather', 'weather'], ['hazard', 'hazards'], ['inflictsBurn', 'status'],
                     ['boostsUser', 'boosts'], ['drain', 'hp'], ['perishClock', 'perish']];
  for (const [tag, fam] of MUST_HAVE) {
    const w = G.witnessFor('moves', tag, new Set());
    if (w.families.indexOf(fam) < 0)
      fail(tag + ' should witness on `' + fam + '` and derives [' + w.families.join(',') + ']. A rule '
         + 'that declares everything leafless would pass the block above and measure nothing.');
    else pass(tag + ' witnesses on `' + fam + '`');
  }
  const leafless = G.COV_TARGETS.filter(t => t.witness.kind === 'no-board-leaf').length;
  const witnessable = G.COV_TARGETS.length - leafless;
  if (!witnessable) fail('EVERY census row is declared leafless — the credit rule measures nothing');
  else note(witnessable + ' of ' + G.COV_TARGETS.length + ' steered rows can be witnessed on a board; '
       + leafless + ' name no board leaf and can only ever be credited by a connected click, counted apart');
}

console.log('\n' + (failures
  ? failures + ' FAILURE(S) — the CREDIT RULE is wrong, which is the only thing this file fails on'
  : 'ALL PASSED — a click into a board it cannot change scores nothing, the same click into a board\n'
  + 'it does change scores one, and the steering follows the credit rather than the click.'));
process.exit(failures ? 1 : 0);
