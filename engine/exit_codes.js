/* engine/exit_codes.js — WHAT AN EXIT CODE MEANS, DECIDED IN ONE PLACE. ROADMAP #380 (3), 2026-09-11.
 *
 *   const EXIT = require('./exit_codes.js');
 *   EXIT.classifyExit(status, stdoutAndStderr)   -> { green: true|false|null, kind, declared, why }
 *   EXIT.runnerOutcome(status, stdoutAndStderr)  -> the same, plus outcome: PASS | FAIL | SKIP
 *   EXIT.declaration(code, kind)                 -> the one line an instrument prints on its way out
 *   node engine/exit_codes.js --selftest
 *
 * WHY THIS FILE EXISTS. Three readers decide what a child's exit code means: `engine/register_reality.js`
 * (is this register row's instrument RED, GREEN, or silent?), `tests/run-all.js` (did this check pass,
 * fail, or not run?) and `engine/wire_ladder.js` (did this arm complete?). Until today the first owned
 * `classifyExit` and the second carried its own `r.status === 2 -> SKIP`. Two files deciding one fact
 * disagree eventually, and these already did: register_reality read `exit 2` + `ABRA-EXIT 2 VERDICT-RED`
 * as a RED verdict while run-all read the same exit as a SKIP — a declared red, not run. The body below is
 * register_reality's classifier moved here byte-for-byte in behaviour; register_reality's own selftest
 * still drives it through the thin wrapper it keeps for its knob.
 *
 * THE CONTRACT, unchanged from register_reality.js (read the full argument there):
 *   exit 0            VERDICT-GREEN, unless a declaration contradicts it (then: not a verdict).
 *   exit 1            VERDICT-RED. Also what node exits on an uncaught throw.
 *   any other code    NOT A VERDICT unless the instrument declares one, at the start of a line:
 *                         ABRA-EXIT 2 CANNOT-ANSWER
 *                         ABRA-EXIT 3 VERDICT-RED
 *                     Only the declaration naming the code the process ACTUALLY exited with is read,
 *                     and the last such line wins.
 *   no code at all    NOT-STARTED — the process never ran, or a signal ended it.
 *
 * `runnerOutcome` IS THE SAME CLASSIFICATION READ BY A SUITE RUNNER, AND IT ADDS POLICY ONLY WHERE THE
 * CLASSIFIER SAYS "NOT A VERDICT". A runner must still put every check in PASS, FAIL or SKIP, so the null
 * case needs a rule, and the rule errs shut:
 *   green true                  PASS
 *   green false                 FAIL
 *   declared CANNOT-ANSWER      SKIP   — the instrument ran and said it had no finding
 *   undeclared exit 2           SKIP   — run-all's historic "I could not run" convention, kept so that no
 *                                        gate which exits 2 without declaring turns the suite red
 *   anything else that is null  FAIL   — an undeclared 3, a 134 out-of-memory death, a signal, or a
 *                                        declaration contradicting exit 0. A crash is not a skip.
 * It never turns a verdict the classifier calls RED into anything but FAIL, and never calls a code the
 * classifier refuses to read a PASS. So the two readers can differ on how loudly a silence is reported,
 * and can no longer differ on what a verdict was.
 */
'use strict';

const KIND = {
  GREEN: 'VERDICT-GREEN',
  RED: 'VERDICT-RED',
  REFUSED: 'CANNOT-ANSWER',
  UNDECLARED: 'UNDECLARED',
  CONTRADICTION: 'DECLARATION-CONTRADICTS-EXIT',
  NOT_STARTED: 'NOT-STARTED',
  /* the ruler refused to read a register marker — register_reality's, carried here so every KIND a
   * reader can meet has one spelling */
  REJECTED: 'MARKER-REJECTED',
  LEGACY: 'LEGACY-ANY-NONZERO-IS-RED',
};
const DECLARATION = /^ABRA-EXIT[ \t]+(\d+)[ \t]+(VERDICT-GREEN|VERDICT-RED|CANNOT-ANSWER)\b/;

/* The declaration for THIS exit code, or null. Last one wins. Reads whatever the caller captured —
 * stdout and stderr both, because an instrument that refuses may say so on either. */
function declaredKind(status, text) {
  let found = null;
  for (const line of String(text == null ? '' : text).split(/\r?\n/)) {
    const m = line.match(DECLARATION);
    if (m && Number(m[1]) === status) found = m[2];
  }
  return found;
}

/* `opts.legacy` restores the pre-2026-08-23 reading (every non-zero exit is a RED verdict). It exists so
 * a caller's knob can show that defect red on demand; register_reality's RR_CANNOT_ANSWER_AS_RED sets it. */
function classifyExit(status, text, opts) {
  if (status === null || status === undefined)
    return { green: null, kind: KIND.NOT_STARTED, declared: null,
      why: 'no exit code — the process never started, or a signal ended it' };
  if (opts && opts.legacy)
    return status === 0
      ? { green: true, kind: KIND.LEGACY, why: 'exit 0' }
      : { green: false, kind: KIND.LEGACY, why: 'exit ' + status + ' (legacy reading: the '
          + 'pre-fix behaviour — every non-zero exit is published as a RED verdict)' };
  const declared = declaredKind(status, text);
  if (status === 0) {
    if (declared && declared !== KIND.GREEN)
      return { green: null, kind: KIND.CONTRADICTION, declared,
        why: 'exit 0 with a declaration of ' + declared + ' — the instrument contradicts itself, and a '
           + 'contradiction is not a verdict' };
    return { green: true, kind: KIND.GREEN, declared: declared || null, why: 'exit 0' };
  }
  if (declared === KIND.REFUSED)
    return { green: null, kind: KIND.REFUSED, declared,
      why: 'exit ' + status + ' — the instrument DECLARED CANNOT-ANSWER. It ran; it had no finding to '
         + 'report about this row, and a refusal is not evidence in either direction' };
  if (declared === KIND.RED)
    return { green: false, kind: KIND.RED, declared, why: 'exit ' + status + ' (declared VERDICT-RED)' };
  if (declared === KIND.GREEN)
    return { green: true, kind: KIND.GREEN, declared, why: 'exit ' + status + ' (declared VERDICT-GREEN)' };
  if (status === 1) return { green: false, kind: KIND.RED, declared: null, why: 'exit 1' };
  return { green: null, kind: KIND.UNDECLARED, declared: null,
    why: 'exit ' + status + ' — a code outside {0,1} that the instrument never declared, so it is NOT '
       + 'read as a verdict. Declare it with a line `ABRA-EXIT ' + status + ' <VERDICT-RED|CANNOT-ANSWER>`' };
}

function runnerOutcome(status, text) {
  const c = classifyExit(status, text);
  if (c.green === true) return Object.assign({ outcome: 'PASS' }, c);
  if (c.green === false) return Object.assign({ outcome: 'FAIL' }, c);
  if (c.kind === KIND.REFUSED) return Object.assign({ outcome: 'SKIP' }, c);
  if (c.kind === KIND.UNDECLARED && status === 2)
    return Object.assign({ outcome: 'SKIP' }, c, { why: c.why + ' — a runner reads an undeclared exit 2 '
      + 'as SKIP ("I could not run"), never as a pass' });
  return Object.assign({ outcome: 'FAIL' }, c, { why: c.why + ' — not a verdict, and a runner errs shut: '
    + 'a crash, a signal or a self-contradiction is not a skip' });
}

/* The line an instrument prints before it exits. Kept beside the reader so a writer and a reader
 * cannot spell it differently. */
function declaration(code, kind) {
  if (!Object.values(KIND).includes(kind) || ![KIND.GREEN, KIND.RED, KIND.REFUSED].includes(kind))
    throw new Error('exit_codes.declaration: ' + kind + ' is not a declarable kind');
  return 'ABRA-EXIT ' + code + ' ' + kind;
}

module.exports = { KIND, DECLARATION, declaredKind, classifyExit, runnerOutcome, declaration };

if (require.main === module && process.argv.includes('--selftest')) {
  let bad = 0, ran = 0;
  const ok = (what, cond, got) => {
    ran++;
    console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (cond ? '' : '\n          got ' + JSON.stringify(got)));
    if (!cond) bad++;
  };
  const R = (s, t) => runnerOutcome(s, t || '');
  console.log('\nengine/exit_codes.js --selftest');
  /* run-all's reading before this file: 0 PASS, 2 SKIP, anything else FAIL. These four agree with it. */
  ok('exit 0 -> PASS', R(0).outcome === 'PASS', R(0));
  ok('exit 1 -> FAIL', R(1).outcome === 'FAIL', R(1));
  ok('undeclared exit 2 -> SKIP (the runner convention, unchanged)', R(2, 'NOT RUN — SHOWDOWN_PATH is unset').outcome === 'SKIP', R(2));
  ok('undeclared exit 134 (out of heap) -> FAIL, never a skip', R(134, 'FATAL ERROR: Reached heap limit').outcome === 'FAIL', R(134));
  /* The three places the two readers used to disagree. Each is RED on the pre-shared reading. */
  ok('RED — exit 2 DECLARED VERDICT-RED -> FAIL. run-all used to SKIP a declared red',
    R(2, 'ABRA-EXIT 2 VERDICT-RED\n').outcome === 'FAIL' && R(2, 'ABRA-EXIT 2 VERDICT-RED\n').green === false);
  ok('RED — exit 0 with a contradicting CANNOT-ANSWER declaration -> FAIL. run-all used to PASS it',
    R(0, 'ABRA-EXIT 0 CANNOT-ANSWER\n').outcome === 'FAIL' && R(0, 'ABRA-EXIT 0 CANNOT-ANSWER\n').green === null);
  ok('exit 4 DECLARED CANNOT-ANSWER -> SKIP, the same reading register_reality gives it',
    R(4, 'ABRA-EXIT 4 CANNOT-ANSWER\n').outcome === 'SKIP' && classifyExit(4, 'ABRA-EXIT 4 CANNOT-ANSWER\n').green === null);
  ok('a signal (no status) -> NOT-STARTED -> FAIL', R(null).kind === KIND.NOT_STARTED && R(null).outcome === 'FAIL', R(null));
  /* The runner never contradicts the classifier on a verdict, over every code 0..5 and every declaration. */
  const decls = ['', 'VERDICT-GREEN', 'VERDICT-RED', 'CANNOT-ANSWER'];
  let agree = true;
  for (let s = 0; s <= 5; s++) for (const d of decls) {
    const t = d ? 'ABRA-EXIT ' + s + ' ' + d + '\n' : '';
    const c = classifyExit(s, t), r = runnerOutcome(s, t);
    if ((c.green === true && r.outcome !== 'PASS') || (c.green === false && r.outcome !== 'FAIL')
        || (c.green === null && r.outcome === 'PASS')) agree = false;
  }
  ok('over exit 0..5 x every declaration, the runner reads every verdict exactly as the classifier does', agree);
  ok('the declaration writer produces a line the reader parses back to the same kind',
    declaredKind(2, declaration(2, KIND.REFUSED)) === KIND.REFUSED && declaredKind(3, declaration(3, KIND.RED)) === KIND.RED);
  ok('the legacy reading is opt-in: exit 2 declared CANNOT-ANSWER is red only when asked for',
    classifyExit(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n', { legacy: true }).green === false
    && classifyExit(2, 'ABRA-EXIT 2 CANNOT-ANSWER\n').green === null);
  console.log('\nEXIT-CODES SELFTEST: ' + (ran - bad) + ' passed, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
}
