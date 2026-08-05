/* test-mutation-coverage.js — the registered gate for COVERAGE LAYER 2 (tests/mutation_harness.js).
 *
 *   node tests/test-mutation-coverage.js
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE HARNESS
 * -----------------------------------------------
 * `tests/run-all.js` discovers `tests/test-*.js` and nothing else, so an instrument named
 * `mutation_harness.js` is invisible to the suite however good it is. That is the lesson
 * `engine/artifact_audit.js` is named after: a check nobody runs is not a check. The harness itself
 * is a ~10-minute full sweep and does not belong inside the suite; what belongs inside the suite is
 * the two things that can go silently wrong between sweeps.
 *
 * WHAT THIS ASSERTS
 * -----------------
 *   1. THE INSTRUMENT STILL WORKS. It re-runs the harness's own planted-stub gate — a param handler
 *      that reads a tag and writes a literal (the WIRE 71 shape), and a handler that ignores a
 *      module-load derived SET. Both must be caught while the shipped engine reads LIVE on the same
 *      operators. A harness that has never caught a stub it planted itself is not evidence, and a
 *      refactor that quietly breaks it would otherwise report every tag as clean.
 *   2. THE RATCHET HOLDS. `defectCandidates + tagNotConsumed` may fall and may never rise within one
 *      sweep scope, and an operator that was LIVE may never come back anything else.
 *   3. THE SCOPE HAS NOT SHRUNK. The sweep must cover every tag in the release's own `data/tags.json`.
 *      A sweep quietly narrowed to a comfortable dozen looks exactly like a sweep that passed — the
 *      previous artifact covered 12 of 177 tags and its headline number read as a result.
 *
 * WHAT IT DELIBERATELY DOES NOT FAIL ON, and why that is stated rather than silent
 * -------------------------------------------------------------------------------
 * A NEW ENGINE RELEASE. The artifact is stamped with the release it measured, so a reader can always
 * tell which bytes it describes, and ENGINE cuts releases far more often than a ten-minute sweep can
 * be re-run. Failing here would put the suite red for work another division did correctly, and this
 * repository has already shown what happens next: `tests/test-docs-current.js` sat red for two days
 * across ~40 commits and was reported as "one of the two known failures" until the docs were four
 * days behind the code. So drift is printed LOUDLY with the command that clears it, and it is not a
 * failure. If that turns out to be the wrong call it should be changed here, on purpose, with the
 * re-sweep in the same pass — not by filing a red test.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok    ' + m); } else { F++; console.log('  FAIL  ' + m); } };

const ART = D('data', 'mutation-coverage.json');

console.log('\nMUTATION COVERAGE (Layer 2) — the instrument, the ratchet, and the scope\n');

/* ---- 1. the instrument -------------------------------------------------------------------------- */
const H = require('./mutation_harness.js');
const gate = H.runGate();
ok(gate.failures === 0, 'the planted-stub gate catches both stubs (' + gate.rows.filter(r => r.caught).length
  + '/' + gate.rows.length + ' caught)');
for (const r of gate.rows) {
  if (!r.caught) console.log('        MISSED ' + r.stub + '  shipped=' + r.shipped + ' stubbed=' + r.stubbed
    + ' (expected LIVE / ' + r.expectedStub + ')');
}

/* ---- 2 + 3. the artifact ------------------------------------------------------------------------ */
let A = null;
try { A = JSON.parse(fs.readFileSync(ART, 'utf8')); }
catch (e) {
  /* NOT A SKIP. An absent artifact is the state where nothing has been measured, which is exactly
   * what this file exists to make visible; skipping would report it as a pass. */
  ok(false, 'data/mutation-coverage.json exists — run: node tests/mutation_harness.js  (' + e.message + ')');
}

if (A) {
  ok(!!A.engine_release, 'the artifact names the engine release it measured (' + (A.engine_release || 'NONE') + ')');

  const R = A.ratchet || {};
  ok(!R.broken, 'the open-defect ceiling holds — ' + (R.ceilingNote || 'no ceiling recorded'));
  ok(!(R.regressions || []).length, 'no operator that was LIVE has stopped moving the engine ('
    + (R.regressions || []).length + ' regressions)');

  /* THE SCOPE. Counted against the RELEASE THE ARTIFACT MEASURED, not against the live tree — an
   * artifact is not out of scope because someone added a tag after it ran. */
  let tagsInRelease = null;
  try {
    const relDir = D('data', 'releases', A.engine_release, 'data', 'tags.json');
    const db = JSON.parse(fs.readFileSync(relDir, 'utf8'));
    tagsInRelease = H.allTags(db).length;
  } catch (e) { console.log('        (could not open that release\'s tags.json: ' + e.message + ')'); }

  if (tagsInRelease !== null) {
    ok(A.summary.tagsSwept >= tagsInRelease,
      'the sweep covers every tag in the release artifact (' + A.summary.tagsSwept + '/' + tagsInRelease + ')');
  } else {
    ok(false, 'the release named by the artifact could not be opened, so the scope cannot be checked');
  }

  /* ---- LOUD, NOT FATAL: has the current release moved past the one measured? ---- */
  let current = null;
  try { current = JSON.parse(fs.readFileSync(D('data', 'engine-release.json'), 'utf8')).current; }
  catch (e) { console.log('        (no readable release pointer: ' + e.message + ')'); }
  if (current && current !== A.engine_release) {
    console.log('\n  NOTICE — the current engine release is ' + current + '; this coverage artifact measured '
      + A.engine_release + '.');
    console.log('           Its verdicts describe those older bytes. Re-sweep with:');
    console.log('             SHOWDOWN_PATH=<ps> node tests/mutation_harness.js');
    console.log('           Deliberately NOT a failure — see the header of this file.');
  }

  const s = A.summary || {};
  console.log('\n  ' + s.operators + ' operators over ' + s.tagsSwept + ' tags: ' + s.live + ' LIVE, '
    + s.readAndIgnored + ' READ-AND-IGNORED');
  console.log('  OPEN: ' + s.tagNotConsumed + ' TAG-NOT-CONSUMED + ' + s.defectCandidates + ' DEFECT-CANDIDATE = '
    + ((s.tagNotConsumed || 0) + (s.defectCandidates || 0)) + '   ceiling ' + ((R.ceiling || {}).value));
  console.log('  UNSTAGEABLE tags: ' + (s.unstageableTags || []).length + ', NO-CARRIER: '
    + (s.noCarrierTags || []).length + ', THREW: ' + (s.threwTags || []).length);
}

console.log('\n' + P + ' passed, ' + F + ' failed\n');
process.exit(F ? 1 : 0);
