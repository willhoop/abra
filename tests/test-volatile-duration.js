/* tests/test-volatile-duration.js — THE VOLATILE DURATION FAMILY, AS ONE MECHANISM.
 *
 *   SHOWDOWN_PATH=... node tests/test-volatile-duration.js
 *   SHOWDOWN_PATH=... node tests/test-volatile-duration.js --release <id>   (pin a snapshot)
 *   SHOWDOWN_PATH=... node tests/test-volatile-duration.js --engine release (play the SNAPSHOT's bytes)
 *
 * ================= WHAT IT ASKS ==================================================================
 *
 * `Battle#residualEvent` (sim/battle.js:341-348) decrements EVERY handler that carries both an `end`
 * and a `duration`, inside the Residual event, ordered by `onResidualOrder`:
 *
 *     if (eventid === 'Residual' && handler.end && handler.state?.duration) {
 *       handler.state.duration--;
 *       if (!handler.state.duration) { handler.end.call(...endCallArgs); continue; }
 *     }
 *
 * Three consequences, and this file asserts all three against the official engine rather than
 * against a number typed here:
 *
 *   1. A volatile applied on turn N has ALREADY been decremented once by the end of turn N.
 *   2. Re-applying a volatile the body already carries FAILS (`Pokemon#addVolatile` returns false
 *      when the condition has no `onRestart`) — it does not refresh the counter.
 *   3. The counter written at application is adjusted by whether the target has already SPENT its
 *      turn (`this.queue.willMove(target)`), because a turn already spent must not be one of the N.
 *
 * This was fixed for ONE volatile — Perish Song, medicham2-browser.js:6588 — and the general defect
 * was left standing, which is why Taunt, Encore and Disable all came back FIRED-AND-BOARDS-DIFFER on
 * `data/roster.moves.json` (9,092 corpus uses between them). PERISH SONG IS THE POSITIVE CONTROL
 * HERE: it is the member of the family that was already right, and a change to the model that breaks
 * it has broken the model.
 *
 * ================= NO NUMBER IN THIS FILE IS AN EXPECTATION ======================================
 *
 * Every scenario is played in BOTH engines by `tests/staged_board.js`, whose rule is that SHOWDOWN IS
 * THE EXPECTATION and no scenario declares a result. What is written below is a staging — which body
 * clicks what, on which turn — and the verdict is `board_state.js` comparing the two boards leaf by
 * leaf. If Showdown changes, this file changes with it and nobody has to notice.
 *
 * THE ENGINE UNDER TEST IS THE LIVE TREE BY DEFAULT, not the frozen release. That is deliberate and
 * it is the opposite of `tests/roster.js`: this is a GATE on the working copy, so it has to fail on
 * the bytes an author just wrote. `--engine release` plays the snapshot instead, which is how the
 * red demonstration was taken (release 72e361e1bd44 is the unfixed engine).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const HAS = (n) => process.argv.includes(n);
const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const SB = require(D('tests', 'staged_board.js'));

/* THE BYTES UNDER TEST, NAMED OUT LOUD. A gate that silently played a snapshot while its author was
 * editing the live tree would be green on code nobody wrote. */
const WHICH = ARG('--engine') === 'release' ? 'release' : 'live';
const SRC = WHICH === 'live' ? fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8') : null;

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* THE TARGET CLICKS A REAL MOVE EVERY TURN. Taunt, Encore and Disable all read the target's LAST
 * MOVE, and a target that never moves stages nothing — the counter would be the only thing on the
 * board and half of what is under test is WHETHER IT IS THERE AT ALL. Two 40-BP clicks, alternated
 * where Disable needs it, so nothing faints inside three turns and no boundary is lost to a
 * replacement walking in. */
const TARGET = () => mon('snorlax', '', 'Thick Fat', ['Pound', 'Shadow Punch']);
const USER = () => mon('weavile', '', 'Pressure', ['Taunt', 'Encore', 'Disable', 'Pound']);
const A_REST = () => [mon('clefable', '', 'Unaware', ['Perish Song', 'Protect'])].concat(FILL('toxapex', 'garchomp'));
/* NOTHING ATTACKS EITHER PARTNER, so a Protect that succeeds in one engine and fails in the other is
 * invisible — `board_state.js` publishes the stall counter as NOT_COMPARED. The bodies that ARE being
 * hit never click Protect twice running, because that difference is REAL and is not this row: measured
 * here on the first draft, Showdown failed Weavile's second consecutive Protect and medicham2 did not,
 * which showed up as a 42 HP divergence with nothing to do with a duration. Filed, not fixed. */
const B_REST = () => [mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('milotic', 'incineroar'));
const PASS2 = { m: 'protect' };

const SCENARIOS = [

  /* -------------------------------------------------------------- 1. the clean case: TAUNT twice */
  { id: 'taunt-counter-and-no-restart',
    what: 'Weavile (125 Speed) Taunts Snorlax (30 Speed) on turn 1 and clicks the SAME Taunt again on '
        + 'turn 2 into a body that already carries it. Snorlax clicks a 40-BP move every turn.',
    asks: 'the counter after the application turn (Showdown has already decremented it once), and '
        + 'whether the second Taunt REFRESHES it. Showdown\'s addVolatile returns false — taunt\'s '
        + 'condition has no onRestart — so turn 2 must read one LOWER than turn 1, not the same.',
    negative: 'turn 3 nobody clicks Taunt, so the counter must fall again on its own. An engine that '
            + 'only ticked while the move was being re-clicked parts there.',
    A: [USER()].concat(A_REST()),
    B: [TARGET()].concat(B_REST()),
    script: [
      { p1: [{ m: 'taunt', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'taunt', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'pound', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
    ] },

  /* ---------------------------------------------------- 2. DISABLE — the application-timing half */
  { id: 'disable-needs-a-last-move-and-counts-from-four',
    what: 'Weavile clicks Disable at Snorlax on turn 1 — BEFORE Snorlax has ever moved — and again on '
        + 'turn 2. Snorlax alternates its two clicks so the sealed one is never chosen.',
    asks: 'turn 1 is an APPLICATION question, not a counter one: Showdown\'s `onTryHit` refuses '
        + 'Disable outright when the target has no `lastMove`, so the volatile must be ABSENT. Turn 2 '
        + 'is the counter: duration 5, decremented once by `onStart` because the target has not yet '
        + 'moved (`this.queue.willMove(pokemon)`), then once more by the residual.',
    negative: 'turn 1 IS the negative for the application half, and turn 3 — nobody clicks Disable — '
            + 'is the negative for the counter half.',
    A: [USER()].concat(A_REST()),
    B: [TARGET()].concat(B_REST()),
    script: [
      { p1: [{ m: 'disable', t: 0 }, PASS2], p2: [{ m: 'shadowpunch', t: 0 }, PASS2] },
      { p1: [{ m: 'disable', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'pound', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
    ] },

  /* ------------------------------------------------------------------------------- 3. ENCORE */
  { id: 'encore-counter-ticks-without-the-chooser',
    what: 'Weavile Encores Snorlax on turn 2 (turn 1 it cannot — Snorlax has no last move yet). '
        + 'Snorlax clicks the SAME move all three turns, so the Encore repeating it is a no-op and '
        + 'the only thing on the board is the clock.',
    asks: 'whether the Encore counter moves at all on a turn whose action came from OUTSIDE the '
        + 'engine. It used to be decremented inside `_chooseAction`, which a scripted or '
        + 'caller-supplied action never reaches — the WIRE 24 rule, which Disable and Taunt already '
        + 'honour and Encore did not.',
    negative: 'turn 1 is the negative: Showdown\'s condition returns false against a target with no '
            + '`lastMove`, so nothing may be on the board after it.',
    A: [USER()].concat(A_REST()),
    B: [TARGET()].concat(B_REST()),
    script: [
      { p1: [{ m: 'encore', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'encore', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'pound', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
    ] },

  /* ------------------------------------------------- 4. THE POSITIVE CONTROL — PERISH SONG */
  { id: 'perishsong-still-correct',
    what: 'Clefable clicks Perish Song once, on turn 1. All four bodies take the count.',
    asks: 'NOTHING NEW. This is the one member of the family that was already fixed — '
        + 'medicham2-browser.js:6588 records `perishsong.condition.duration` being 4 while the '
        + 'residual decrements on the turn of application. It is here so that a change to the shared '
        + 'duration model cannot quietly re-break it while turning three other rows green.',
    negative: 'the count has to fall on turns 2 and 3 with nobody clicking anything, which is the '
            + 'same tick the other three scenarios exercise.',
    A: [USER()].concat(A_REST()),
    B: [TARGET()].concat(B_REST()),
    script: [
      { p1: [{ m: 'pound', t: 0 }, { m: 'perishsong' }], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'pound', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
      { p1: [{ m: 'pound', t: 0 }, PASS2], p2: [{ m: 'pound', t: 0 }, PASS2] },
    ] },
];

/* THE FIXTURE AUDIT RUNS FIRST, because a click that stages nothing agrees for the wrong reason. */
const bad = SB.fixtureAudit(SCENARIOS);
if (bad.length) {
  console.log('FIXTURE AUDIT FAILED — the scenarios are wrong, not the engine:');
  for (const b of bad) console.log('  ' + b);
  process.exit(1);
}

console.log('VOLATILE DURATION FAMILY — one mechanism, four scenarios, Showdown is the expectation');
console.log('  engine under test: ' + (WHICH === 'live' ? 'the LIVE tree (engine/medicham2-browser.js)'
  : 'the frozen release\'s own bytes'));
console.log('');

let failed = 0;
for (const sc of SCENARIOS) {
  let r;
  /* IT SPEAKS TWICE. A throw here is the harness failing, not a verdict about the engine, and
   * `tests/test-no-silent-failure.js` is right that a catch which only stuffs the reason into a
   * variable is one refactor away from swallowing it. The stack goes to stderr AND into the row. */
  try { r = SB.runOne(sc, SRC); }
  catch (e) {
    console.error('THREW while staging ' + sc.id + ': ' + ((e && e.stack) || e));
    r = { verdict: 'THREW', why: String((e && e.stack) || e) };
  }
  const ok = r.verdict === 'IDENTICAL';
  if (!ok) failed++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + sc.id + '   [' + r.verdict + ']');
  console.log('        ' + sc.asks.replace(/\s+/g, ' '));
  if (r.why) console.log('        why: ' + r.why);
  for (const bd of (r.boards || [])) {
    for (const d of (bd.unexplained || [])) {
      console.log('        turn ' + bd.turn + '  ' + d.side + (d.body ? ' ' + d.body : '') + '  '
        + d.field + '   showdown=' + JSON.stringify(d.sd) + '  ours=' + JSON.stringify(d.us));
    }
  }
}

console.log('');
if (failed) {
  console.log(failed + '/' + SCENARIOS.length + ' scenario(s) DIFFER from the official engine.');
  process.exit(1);
}
console.log('all ' + SCENARIOS.length + ' scenarios identical to the official engine.');
