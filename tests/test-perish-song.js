/* PROVE THE PERISH SONG KO ACTUALLY FIRES — ROADMAP #90, Will's test, 1,141 corpus uses on it.
 *
 * ================= WHY THE COUNTER BEING RIGHT PROVED NOTHING =====================================
 *
 * Will, 2026-08-07. The counter half was fixed in 3.71.0 — it had been KO'ing a turn early — and
 * `tests/test-volatile-duration.js` carries a Perish Song row that guards it. That row runs THREE turns
 * and asserts the count falls. **It never reaches zero.**
 *
 * So the thing 1,141 uses actually rest on has never been observed: `perishsong.condition.onEnd` calls
 * `target.faint()`, and nothing in this repo had ever watched a body die of it. A counter that ticks
 * correctly and a Pokemon that actually faints are two claims, and the project has been bitten by
 * exactly that gap before — the capability looks present, every check reports success, and the last
 * step was never executed. Will separated the two claims; this file is the second one.
 *
 * ================= WHAT PERISH SONG IS, READ NOT RECALLED =========================================
 *
 * `D.moves.get('perishsong')` — `target: 'all'`, `pp: 5`, `flags.sound`. Its condition:
 *
 *     duration: 4
 *     onResidualOrder: 24
 *     onResidual(pokemon) { ...add -start perishN... }        // the tick, already guarded elsewhere
 *     onEnd(target)       { add -start perish0; target.faint() }   // THE CLAIM UNDER TEST
 *
 * `target: 'all'` is the whole field — BOTH SIDES, INCLUDING THE USER'S OWN PARTNER. That is why Will's
 * spec says *"the whole sequence, both sides simultaneously"*: an engine that applied the volatile only
 * to the foes would pass any single-target check and lose half the mechanic.
 *
 * `faint()` takes no damage argument and reads no HP. A body at full health dies. An engine that
 * modelled this as damage would be wrong in a way no HP comparison at turn 3 could see.
 *
 * ================= THE THIRD CLAUSE, AND WHY IT NEEDED A PIVOT ====================================
 *
 * Will's spec has a negative: *"a body that switches out must NOT faint."* The counter is a volatile,
 * and leaving the field clears volatiles — so the escape is real and an engine that keeps the count on
 * a benched body would kill something that should have lived.
 *
 * `tests/staged_board.js` DECLARES it cannot express a voluntary switch — exclusion D, *"scripted() can
 * express a move and a pass and nothing else"* (ROADMAP #122). Taken at face value that kills the
 * clause.
 *
 * **IT IS NOT TAKEN AT FACE VALUE, BECAUSE A COULD-NOT-STAGE VERDICT IS A CLAIM ABOUT THE FIXTURE AND
 * NEVER ABOUT THE MECHANIC.** Will has taught me this twice — Muk and Shadow Punch, where the answer was
 * Shadow Sneak; and Farigiraf, where the rare ability was the point. The exclusion's own text says how:
 * *"every switch in this file is driven by a PIVOT MOVE"*. U-turn leaves the field. The volatile is
 * cleared by leaving, not by the manner of leaving, so a pivot answers this question.
 *
 * WHAT THE PIVOT DOES NOT ANSWER, SAID PLAINLY: a pivot is not a voluntary switch — trapping does not
 * stop one — so "does a TRAPPED body still escape the count" is out of reach here and stays with #122.
 * This file tests the escape, not the trap.
 *
 *   node tests/test-perish-song.js
 *   node tests/test-perish-song.js --engine release    # play the frozen snapshot instead
 *
 * Showdown is the expectation. Both engines play the same script and the boards are compared. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const SB = require(D('tests', 'staged_board.js'));

const WHICH = ARG('--engine') === 'release' ? 'release' : 'live';
let SRC = WHICH === 'live' ? fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8') : null;

/* ---- THE RED DEMONSTRATION ------------------------------------------------------------------------
 *
 * `--break-the-faint` deletes the KO and leaves the clock running. That is not an arbitrary mutation —
 * it reconstructs EXACTLY the state Will separated out on 2026-08-07: a counter that ticks perfectly
 * and a body that never dies. `tests/test-volatile-duration.js` is green against this mutant, which is
 * the whole argument for this file existing.
 *
 * A GREEN TEST THAT WAS NEVER SHOWN RED PROVES NOTHING, and the first attempt at this demonstration was
 * itself wrong: I rebuilt the scenario by hand in a throwaway script, both the clean and the broken run
 * returned SHORT, and the check only asked "is the verdict not IDENTICAL" — so it reported the guard
 * firing when nothing had been demonstrated. The mutation belongs INSIDE the file that owns the
 * scenarios, where the clean run is known to pass. */
const BREAK = process.argv.includes('--break-the-faint');
if (BREAK) {
  if (WHICH !== 'live') { console.log('--break-the-faint needs the live tree'); process.exit(1); }
  const before = SRC;
  SRC = SRC.replace('if(x._perish<=0){x.fainted=true;x.curHP=0;MEDSEEN.perishKO++;',
                    'if(false){x.fainted=true;x.curHP=0;MEDSEEN.perishKO++;');
  if (SRC === before) {
    console.log('THE MUTATION DID NOT APPLY — medicham2-browser.js:14898 has moved. A demonstration '
              + 'that silently patched nothing is worse than none: fix the anchor, do not delete it.');
    process.exit(1);
  }
  console.log('*** --break-the-faint: the perish KO is disabled and the clock left running. ***');
  console.log('*** Every row below MUST fail. A pass here means the guard is not watching.    ***\n');
}

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* THE SINGER IS CLEFABLE, matching the row already in test-volatile-duration.js so a shared duration
 * change cannot pass there and fail here for a reason that is really about the body. */
const SINGER  = () => mon('clefable', '', 'Unaware', ['Perish Song', 'Protect']);
/* THE PARTNER IS ON THE SINGER'S OWN SIDE AND MUST DIE TOO. `target: 'all'`. If this body survives,
 * the engine is applying Perish Song to the foes only — which is the failure a one-sided test cannot
 * see, and it is the whole reason Will said "both sides simultaneously". */
const PARTNER = () => mon('snorlax', '', 'Thick Fat', ['Protect', 'Pound']);
/* THE PIVOT carries U-turn so the negative clause can be staged at all. Bug move into Clefable is
 * resisted-neutral and 70 BP, so nothing faints early and the boundary is not lost to a replacement. */
const PIVOT   = () => mon('scizor', '', 'Technician', ['U-turn', 'Protect']);
const ANCHOR  = () => mon('corviknight', '', 'Pressure', ['Protect', 'Pound']);

const PASS = { m: 'protect' };

const SCENARIOS = [

  /* ---------------------------------------------------------- 1. THE CLAIM: FOUR BODIES DIE AT ONCE */
  { id: 'perishsong-kills-all-four-on-turn-four',
    what: 'Clefable clicks Perish Song on turn 1 and nothing else happens for three more turns. All '
        + 'four active bodies — both foes AND Clefable\'s own partner AND Clefable — carry the count, '
        + 'and on turn 4 `onEnd` calls faint() on every one of them.',
    asks: 'THE FAINT, which nothing in this repo has ever observed. `tests/test-volatile-duration.js` '
        + 'runs three turns and watches the number fall; the number reaching zero and a body actually '
        + 'dying are two claims and only the first was ever checked. 1,141 corpus uses rest on the '
        + 'second one.',
    negative: 'turns 1-3 are the negative: NOBODY may faint before the count runs out. An engine that '
            + 'KO\'d a turn early would be caught here, which is the 3.71.0 bug this guards against '
            + 'regressing.',
    A: [SINGER(), PARTNER()].concat(FILL('toxapex', 'garchomp')),
    /* AMOONGUSS WAS HERE ON THE FIRST DRAFT AND IT IS `isNonstandard: 'Past'` IN THIS FORMAT.
     * `buildPair` returned null and the row read NOT-STAGED — the fixture audit doing its job. I typed
     * a body from memory of what is common in VGC, on the same night this repo gained a check whose
     * entire purpose is that no Pokemon value may be typed from memory. Derived, not recalled:
     * `D.species.get('amoonguss').isNonstandard === 'Past'`. */
    B: [ANCHOR(), mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(FILL('incineroar', 'garchomp')),
    script: [
      { p1: [{ m: 'perishsong' }, PASS], p2: [PASS, PASS] },
      { p1: [PASS, PASS],                p2: [PASS, PASS] },
      { p1: [PASS, PASS],                p2: [PASS, PASS] },
      { p1: [PASS, PASS],                p2: [PASS, PASS] },
    ] },

  /* ------------------------------------------- 2. WILL'S NEGATIVE: LEAVING THE FIELD DROPS THE COUNT */
  { id: 'perishsong-does-not-follow-a-body-off-the-field',
    what: 'Same song on turn 1, but Scizor U-turns out on turn 2. The replacement walks in with no '
        + 'count on it, and Scizor is on the bench when the music stops.',
    asks: 'Will\'s clause — *"a body that switches out must NOT faint"*. The count is a VOLATILE, so '
        + 'leaving the field clears it. An engine that carried the count on a benched body would kill '
        + 'something that should have lived, and an engine that put the count on the REPLACEMENT would '
        + 'kill the wrong body. Both are invisible to scenario 1.',
    negative: 'the replacement is the negative and it is the sharper half: it must be alive on turn 4 '
            + 'while the three bodies that never left are dead. A test where everything dies cannot '
            + 'tell a working escape from an engine that simply kills everything.',
    A: [SINGER(), PARTNER()].concat(FILL('toxapex', 'garchomp')),
    B: [PIVOT(), ANCHOR()].concat(FILL('milotic', 'incineroar')),
    script: [
      { p1: [{ m: 'perishsong' }, PASS], p2: [PASS, PASS] },
      { p1: [PASS, PASS],                p2: [{ m: 'uturn', t: 0 }, PASS] },
      { p1: [PASS, PASS],                p2: [PASS, PASS] },
      { p1: [PASS, PASS],                p2: [PASS, PASS] },
    ] },
];

/* THE FIXTURE AUDIT RUNS FIRST — a click that stages nothing agrees for the wrong reason, and this
 * file's whole value is that the mechanic REACHED its last step. */
const bad = SB.fixtureAudit(SCENARIOS);
if (bad.length) {
  console.log('FIXTURE AUDIT FAILED — the scenarios are wrong, not the engine:');
  for (const b of bad) console.log('  ' + b);
  process.exit(1);
}

console.log('PERISH SONG — does the KO actually fire? (ROADMAP #90, Will 2026-08-07)');
console.log('  engine under test: ' + (WHICH === 'live' ? 'the LIVE tree (engine/medicham2-browser.js)'
  : 'the frozen release\'s own bytes'));
console.log('  Showdown is the expectation; both engines play the same script.\n');

let failed = 0;
for (const sc of SCENARIOS) {
  let r;
  /* IT SPEAKS TWICE — the stack goes to stderr AND into the row. A catch that only stuffs the reason
   * into a variable is one refactor from swallowing it (tests/test-no-silent-failure.js). */
  try { r = SB.runOne(sc, SRC); }
  catch (e) {
    console.error('THREW while staging ' + sc.id + ': ' + ((e && e.stack) || e));
    r = { verdict: 'THREW', why: String((e && e.stack) || e) };
  }
  const ok = r.verdict === 'IDENTICAL';
  if (!ok) failed++;
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + sc.id);
  console.log('        ' + sc.what);
  console.log('        asks: ' + sc.asks);
  console.log('        negative: ' + sc.negative);
  if (!ok) {
    console.log('        VERDICT: ' + r.verdict + (r.why ? ' — ' + r.why : ''));
    for (const b of (r.boards || [])) {
      if (!b.diffs || !b.diffs.length) continue;
      console.log('        turn ' + b.turn + ':');
      for (const d of b.diffs.slice(0, 6)) console.log('           ' + JSON.stringify(d));
    }
  }
  console.log('');
}

if (failed) {
  console.log('  ' + failed + ' of ' + SCENARIOS.length + ' FAILED.\n');
  console.log('  A red row here is not a status. Fix it in this session or have Will waive it by name '
            + '— "known failure" is a banned phrase in this repo.\n');
  process.exit(1);
}
console.log('  PASS — the faint fires, it fires on both sides at once, and a body that leaves the '
          + 'field survives it.\n');
