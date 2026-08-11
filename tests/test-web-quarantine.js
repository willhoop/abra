/* THE STATUS BOARD MUST WITHHOLD WHAT MEDICHAM'S QUARANTINE WITHHOLDS — AND MUST GIVE IT BACK.
 *
 *   node tests/test-web-quarantine.js
 *
 * WHY THIS EXISTS
 * ---------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * `node engine/quarantine.js --check` found SIX places outside engine/ still quoting a withheld
 * verdict, and five of them were `web/status-data.js` — the generated board behind web/status.html,
 * publishing data/winrate-backtest.json, rollout-r1.json, rollout-r1-explore-sweep.json,
 * rollout-r3.json and rollout-r4.json. The gate deliberately does NOT fail on web/, because a gate
 * whose owner cannot satisfy it becomes a "known failure", which CLAUDE.md bans by name. So nothing
 * forces the board to keep obeying it. This does.
 *
 * WHAT CHANGED ON 2026-08-11, AND WHY THIS FILE WAS RED
 * ----------------------------------------------------
 * The gate OPENED — six of six clauses pass. This test went red, and the reason recorded in
 * docs/MEDICHAM-SPRINT-NOTES.md was "the board payload was built while the gate was closed — WEB
 * rebuilds it". That reason was WRONG and rebuilding would have been the bug:
 *
 *   `engine/quarantine.js`'s `withholder(gate, rows)` is BINARY. Gate closed, withhold; gate open,
 *   return null. So the moment the gate opened, `web/build-status.js` began PUBLISHING six artifacts
 *   that were between 148 and 190 hours old, measured through a simulator that had been rewritten
 *   within the hour. Nothing re-ran when the gate lifted. The board's own strongest assertion — no
 *   slot may carry a value sourced to an artifact downstream of MEDICHAM — caught it, correctly, and
 *   a rebuild would have gone green while being LESS true.
 *
 * The fix is `web/publish-rule.js`: a THIRD state, `rerunnable`, composed from the two facts
 * quarantine.js already publishes (the gate, and the downstream set) and quoting the sentence
 * quarantine.js already prints in this exact situation — "NOT withheld and NOT current … each must be
 * re-run before it is quoted (ROADMAP #57)". Nothing is authored here or there.
 *
 * IT PROVES THREE DIRECTIONS, AND THE LAST TWO ARE NOT OPTIONAL
 * ------------------------------------------------------------
 * `engine/quarantine.js`'s own selftest is the model: gate closed -> 34 of 34 withheld, gate open ->
 * 0 of 34. A page that can never show a number again is exactly as broken as one that shows a stale
 * one, and a test that only ever runs against ONE state of the world cannot tell those apart.
 *
 * THIS FILE USED TO DEPEND ON TODAY'S GATE BEING CLOSED and that is the second bug it carried. It
 * built one board with the REAL gate, called the variable `closedBoard`, and asserted the closed-gate
 * properties over it. That was correct for exactly as long as the gate was shut. Every drive below is
 * now SYNTHETIC — the gate and the rows are both arguments, exactly as `withholder(gate, rows)` takes
 * them — so this file measures the same three things whatever the tree happens to be doing tonight:
 *
 *   A. gate CLOSED, artifacts downstream   -> QUARANTINED, no value, no verdict text anywhere
 *   B. gate OPEN,   artifacts downstream   -> RE-RUN OWED, no value, no verdict text anywhere
 *   C. gate OPEN,   artifacts RE-RUN       -> every figure returns and equals its artifact
 *
 * C is the LIFT and it is what makes this a quarantine rather than a deletion: `rows` is cleared the
 * way a re-run clears it. There is deliberately no --force-open flag in any of these files: anything
 * that can silence a quarantine from the command line eventually does, which is why provenance.js's
 * `void` is one-way. A parameter is visible in the caller; a flag is not.
 *
 * AND THE REAL TREE IS STILL ASSERTED, in the one direction that is always true: whatever the gate is
 * doing, a freshly built board may not publish a figure or a verdict sentence belonging to an artifact
 * that is downstream of the simulator. That assertion is gate-independent by construction, which is
 * precisely why it survived the gate opening when the rest of the file did not.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

console.log('WEB QUARANTINE — web/status-data.js against engine/quarantine.js, over three states of the world\n');

const Q = require('../engine/quarantine.js');
/* Building the board runs `node engine/status.js` once, at require time. That is the same command
 * the generator runs, so this measures the shipping path rather than a stand-in. */
const BUILD = require('../web/build-status.js');
const RULE = require('../web/publish-rule.js');

/* ---- one classification, three states. The membership test is NOT reimplemented here; asking a
 * second opinion about what is downstream of the simulator is CLAUDE.md's FACTS ARE GLOBAL failure. */
const cls = Q.classify();
if (cls.error) {
  console.log('  FAIL  engine/quarantine.js could not classify the artifacts: ' + cls.error);
  console.log('\n1 FAILURE(S)');
  process.exit(1);
}
const ROWS = cls.rows;
const REAL = Q.medichamIsCorrect();

/* The synthetic gates have the shape withholder() reads and nothing else. Neither is written to disk,
 * neither is a flag, and both exist only inside this process. CLOSED is built from the REAL clause
 * list so its `clause` sentence is a real one — a synthetic gate with an empty clause list would let a
 * withheld slot pass the "names the failing clauses" check with a vacuous string. */
const OPEN = { ok: true, clauses: REAL.clauses, failing: [] };
const CLOSED = {
  ok: false, clauses: REAL.clauses,
  failing: REAL.failing.length ? REAL.failing
    : [{ name: 'game differential', ok: false, why: 'SYNTHETIC — this test drives the closed-gate '
         + 'branch whether or not the real gate is shut. The real gate is OPEN today.' }],
};

/* AND THE RE-RUN. `classify()`'s `quarantined` flag is graph topology — winrate-backtest.json's
 * generator loads the simulator and always will — so nothing on disk can clear it today. That is a
 * real limitation of engine/quarantine.js and web/publish-rule.js names it out loud rather than
 * inventing an exit. What the LIFT needs is the STATE that clearing produces, so it is constructed:
 * the same rows, re-run. If quarantine.js ever grows a `current` flag, this is the shape it takes. */
const RERUN = new Map([...ROWS.entries()].map(([k, r]) => [k, { ...r, quarantined: false, reason: null }]));

pass('engine/quarantine.js classified ' + ROWS.size + ' artifacts; the real gate is '
  + (REAL.ok ? 'OPEN (' + [...ROWS.values()].filter(r => r.quarantined).length
      + ' artifacts downstream of the simulator are RE-RUNNABLE, not current)'
    : 'CLOSED (' + REAL.failing.length + ' of ' + REAL.clauses.length + ' clauses fail)'));

const board = (gate, rows) => BUILD.buildPayload(
  BUILD.makeHeld(RULE.publishRule(gate, rows)), BUILD.quarantineBlock(gate, rows, null));

const closedBoard = board(CLOSED, ROWS);     /* A — the simulator is wrong                        */
const owedBoard = board(OPEN, ROWS);         /* B — the simulator is right, the runs are not      */
const liftedBoard = board(OPEN, RERUN);      /* C — everything has been re-run                    */
const realBoard = board(REAL, ROWS);         /* whatever tonight actually is                      */

/* Every slot on a board, flattened once, so the checks below walk the same definition of "a slot"
 * rather than several slightly different ones. */
function slots(b) {
  const out = [];
  (function walk(o, p) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.state === 'string') out.push({ at: p, o: o });
    for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
  })(b, '');
  return out;
}
const heldSlots = b => slots(b).filter(s => RULE.isHeld(s.o.state));

/* The verdict/headline/summary sentence of every artifact that is downstream of the simulator. This is
 * the strongest probe there is and it is the one `engine/quarantine.js --check` uses: it is the exact
 * text a reader would quote, so if it is anywhere in the payload — a figure, a note, a caveat, or the
 * embedded raw status.js output — the number was published. This is what found the original five. */
const probes = [];
for (const r of ROWS.values()) {
  if (!r.quarantined) continue;
  let j = null;
  try { j = JSON.parse(fs.readFileSync(D('data', r.file), 'utf8')); } catch (e) { continue; }
  for (const k of ['verdict', 'headline', 'summary']) {
    const v = j[k];
    if (typeof v === 'string' && v.length >= 30) probes.push({ file: r.file, key: k, probe: v.slice(0, 50) });
  }
}
if (!probes.length) {
  fail('no artifact downstream of the simulator carries a verdict/headline/summary string, so the '
    + 'leak probe proved nothing. That is not a pass — it means the probe set is empty and a leak '
    + 'would be invisible.');
} else {
  pass(probes.length + ' verdict string(s) collected from the downstream set, to be checked against '
    + 'whole payloads including the embedded engine/status.js output');
}

/* ================================================================================================
 * THE TWO PROPERTIES EVERY WITHHELD BOARD MUST HAVE. Driven over each state below rather than
 * written out three times, so the three drives cannot quietly diverge.
 * ============================================================================================== */
function assertWithholds(name, b, wanted) {
  const all = slots(b);
  const held = heldSlots(b);
  if (!held.length) {
    fail(name + ': the board withheld NOTHING. Either web/build-status.js is not asking '
      + 'web/publish-rule.js, or it asked and ignored the answer.');
    return;
  }
  const wrongState = held.filter(s => s.o.state !== wanted);
  if (wrongState.length) {
    fail(name + ': ' + wrongState.length + ' slot(s) render "' + wrongState[0].o.state
      + '" where this state of the world calls for "' + wanted + '". QUARANTINED and RE-RUN OWED tell '
      + 'a reader opposite things about what to do next — wait, or run the command.');
  } else {
    pass(name + ': ' + held.length + ' slot(s) render ' + wanted.toUpperCase());
  }

  /* A slot may not carry a value for an artifact that is withheld. This is the mechanical form of
   * "the figure is ABSENT, not annotated" — a `v` beside a caveat is the bug this closes. */
  const leaked = all.filter(s => {
    if (RULE.isHeld(s.o.state)) return false;
    const src = typeof s.o.src === 'string' ? s.o.src.replace(/^data\//, '') : null;
    if (!src) return false;
    const r = ROWS.get(src);
    if (!r || !r.quarantined) return false;
    /* `rows` panels have no `v` but do carry the artifact's contents, so both are a publication. */
    return Object.prototype.hasOwnProperty.call(s.o, 'v') || Array.isArray(s.o.rows);
  });
  if (leaked.length) {
    fail(name + ': slots carrying a value sourced to an artifact downstream of the simulator:\n'
      + leaked.map(s => '          - ' + s.at + '  <- ' + s.o.src).join('\n'));
  } else {
    pass(name + ': no slot carries a value sourced to an artifact downstream of the simulator');
  }

  const text = JSON.stringify(b);
  const spoken = probes.filter(p => text.includes(p.probe));
  if (spoken.length) {
    fail(name + ': ' + spoken.length + ' withheld verdict string(s) appear in the payload:\n'
      + spoken.map(p => '          - data/' + p.file + ' (' + p.key + '): ' + p.probe + '...').join('\n')
      + '\n        A caption is not a quarantine. Withhold the number; print what would re-run it.');
  } else if (probes.length) {
    pass(name + ': none of the ' + probes.length + ' withheld verdict strings appears anywhere in the '
      + 'payload, including the embedded engine/status.js output');
  }

  /* THE ROUTE BACK. The whole substitute for a withheld number is knowing what re-runs it. Without
   * that this is not a quarantine, it is a deletion. */
  const incomplete = held.filter(s => !(s.o.src && s.o.because && s.o.clause && s.o.rerun));
  if (incomplete.length) {
    fail(name + ': withheld slots missing the artifact, the reason, the failing clauses or the '
      + 're-run command:\n' + incomplete.map(s => '          - ' + s.at + ' ' + JSON.stringify({
        src: s.o.src, because: !!s.o.because, clause: !!s.o.clause, rerun: s.o.rerun })).join('\n'));
  } else {
    pass(name + ': every withheld slot names its artifact, why it is downstream, the gate state and '
      + 'the command that re-runs it');
  }
}

/* ================================================================================================
 * A. GATE CLOSED — the simulator is wrong and nothing measured through it may be published.
 * ============================================================================================== */
console.log('\n  A. THE GATE IS CLOSED — the simulator is wrong');
assertWithholds('    closed', closedBoard, 'quarantined');

const qzC = closedBoard.quarantine;
if (!qzC || qzC.open !== false) fail('    closed: the board carries no quarantine block, so the page cannot explain the holes');
else if (!(qzC.clauses && qzC.clauses.length && qzC.rule && qzC.derivation)) {
  fail('    closed: the quarantine block is missing the clauses, the rule or the derivation command');
} else pass('    closed: the board carries the gate itself — the clauses, the rule and the derivation command');

/* ================================================================================================
 * B. GATE OPEN, NOTHING RE-RUN — and this is the state the whole 2026-08-11 pass is about.
 * The gate lifting is NOT the figures coming back. A board that publishes here has taken a six-day-old
 * measurement of a simulator that no longer exists and printed it as today's result.
 * ============================================================================================== */
console.log('\n  B. THE GATE IS OPEN AND NOTHING HAS BEEN RE-RUN — the state of the tree on 2026-08-11');
assertWithholds('    open/owed', owedBoard, 'rerunnable');

const qzO = owedBoard.quarantine;
if (!qzO || qzO.open !== true) fail('    open/owed: the board does not record that the gate is open');
else if (!qzO.n_rerunnable) {
  fail('    open/owed: the gate is open and the board reports 0 re-runnable artifacts, so the page '
    + 'would show holes with no banner explaining them');
} else if (!qzO.rerun_rule || !/ROADMAP #57/.test(qzO.rerun_rule)) {
  fail('    open/owed: the quarantine block carries no re-run rule naming the re-run list');
} else {
  pass('    open/owed: the board reports the gate OPEN with ' + qzO.n_rerunnable + ' of '
    + qzO.n_artifacts + ' artifacts re-runnable, and carries the rule that says so');
}

/* THE TWO STATES MUST NOT BE THE SAME OBJECT WITH A DIFFERENT LABEL. A reader is told to wait in one
 * and to run a command in the other, so the words have to differ somewhere a reader can see. */
const cWords = heldSlots(closedBoard).map(s => s.o.headline + '|' + s.o.clause).sort().join('\n');
const oWords = heldSlots(owedBoard).map(s => s.o.headline + '|' + s.o.clause).sort().join('\n');
if (cWords === oWords) {
  fail('    the CLOSED and OPEN-BUT-OWED boards say exactly the same thing. If the two states read '
    + 'identically to a visitor, the third state bought nothing.');
} else pass('    the two withheld states carry different headlines and different reasons');

/* ================================================================================================
 * C. LIFT — the artifacts have been re-run. Every figure comes back and equals its artifact.
 * A quarantine that can never lift is as broken as one that never engages, and this is the direction a
 * test naturally forgets: with today's tree, deleting every figure would pass A and B.
 * ============================================================================================== */
console.log('\n  C. LIFT — the gate is open AND the artifacts have been re-run');
const stillHeld = heldSlots(liftedBoard);
if (stillHeld.length) {
  fail('LIFT FAILED — with the gate open and the artifacts re-run, ' + stillHeld.length
    + ' slot(s) are still withheld:\n' + stillHeld.map(s => '          - ' + s.at).join('\n'));
} else {
  pass('LIFT — nothing is withheld once the artifacts are no longer downstream-and-stale');
}

/* The same slots must carry the ARTIFACTS' values again, not merely stop saying QUARANTINED. Every
 * pair below is a RELATION against the artifact, never a pinned literal: these numbers are supposed
 * to move when the runs are redone. Each names an artifact that is downstream today, so each is a
 * slot A and B proved absent — the directions are asserted over the same slots on purpose. */
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const RESTORED = [
  ['measure.headline', 'winrate-backtest.json', 'verdict'],
  ['measure.n_games', 'winrate-backtest.json', 'n_games_scored'],
  ['measure.rollouts', 'winrate-backtest.json', 'rollouts_per_game'],
  ['search.ladder.0.figs.0', 'rollout-r1.json', 'positions'],
  ['search.ladder.1.figs.0', 'rollout-cost.json', 'boards'],
  ['search.ladder.2.figs.1', 'rollout-r3.json', 'decisions'],
  ['search.ladder.3.figs.1', 'rollout-r4.json', 'decisive_pairs'],
  ['search.explore.figs.2', 'rollout-r1-explore-sweep.json', 'paired_comparison.diff_points'],
  ['search.r4.share', 'rollout-r4.json', 'arm1_share_pct'],
];
let restored = 0; const notRestored = [];
for (const [boardPath, file, jsonPath] of RESTORED) {
  let a = null;
  try { a = JSON.parse(fs.readFileSync(D('data', file), 'utf8')); } catch (e) { /* below */ }
  if (!a) { notRestored.push(boardPath + ': data/' + file + ' could not be read'); continue; }
  const want = get(a, jsonPath);
  const got = get(liftedBoard, boardPath);
  const gotV = got && Object.prototype.hasOwnProperty.call(got, 'v') ? got.v : got;
  if (want === undefined || want === null) { notRestored.push(boardPath + ': data/' + file + ' -> ' + jsonPath + ' is absent'); continue; }
  if (String(gotV) !== String(want)) {
    notRestored.push(boardPath + ' = ' + JSON.stringify(gotV) + ' but data/' + file + ' -> ' + jsonPath + ' = ' + JSON.stringify(want));
    continue;
  }
  /* And it must have been absent in BOTH withheld states, or this pair proves nothing about the
     quarantine — only that the board can read a file. */
  for (const [label, b] of [['CLOSED', closedBoard], ['OPEN-BUT-OWED', owedBoard]]) {
    const before = get(b, boardPath);
    if (before && Object.prototype.hasOwnProperty.call(before, 'v')) {
      notRestored.push(boardPath + ' carried a value on the ' + label + ' board, so its return proves nothing');
    }
  }
  restored++;
}
if (notRestored.length) fail('LIFT — figures that did not come back correctly:\n' + notRestored.map(s => '          - ' + s).join('\n'));
else pass('LIFT — ' + restored + ' figures return and equal their artifact, each having been absent '
  + 'with the gate closed AND with the gate open but the run owed');

/* And the raw handoff comes back too. web/build-status.js drops engine/status.js's verbatim output
   whenever status.js is printing a withheld verdict — which it is, today, with the gate open. That is
   a publication channel with no card around it, so it has to lift like everything else. */
if (liftedBoard.status_js_ok && !liftedBoard.status_raw) {
  fail('LIFT — engine/status.js ran but its raw output is still not embedded once everything is '
    + 're-run. The board would never show the handoff again.');
} else if (liftedBoard.status_js_ok) {
  pass('LIFT — the verbatim engine/status.js handoff is embedded again');
}

/* ================================================================================================
 * D. THE REAL TREE, in the one direction that is true whatever the gate is doing.
 * ============================================================================================== */
console.log('\n  D. THE TREE AS IT IS TONIGHT');
const realText = JSON.stringify(realBoard);
const realLeak = probes.filter(p => realText.includes(p.probe));
if (realLeak.length) {
  fail('a board built against the REAL gate publishes ' + realLeak.length + ' verdict string(s) '
    + 'belonging to an artifact downstream of the simulator:\n'
    + realLeak.map(p => '          - data/' + p.file + ' (' + p.key + '): ' + p.probe + '...').join('\n')
    + '\n        The gate opening does not make an old measurement true. See web/publish-rule.js.');
} else {
  pass('a board built against the REAL gate publishes no verdict belonging to the downstream set');
}
const realHeld = heldSlots(realBoard);
pass('the real board withholds ' + realHeld.length + ' slot(s): '
  + ['quarantined', 'rerunnable'].map(s => realHeld.filter(x => x.o.state === s).length + ' ' + s).join(', '));

/* ================================================================================================
 * E. THE PAGE CAN RENDER EVERY STATE THE BUILDER CAN EMIT.
 * A payload full of withheld slots against a status.html with no branch for them renders blanks —
 * or worse, falls through to the value branch and prints the string "undefined" at 30px. That is the
 * exact "a capability was absent and everything reported success" shape. Checked as CODE, with
 * comments stripped, so this file's own prose about the states cannot satisfy it.
 * ============================================================================================== */
console.log('\n  E. THE PAGE');
const HTML = fs.readFileSync(D('web', 'status.html'), 'utf8');
const CODE = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
for (const [state, plate, label] of [
  ['quarantined', /qplate/, 'QUARANTINED'],
  ['rerunnable', /rrplate/, 'RE-RUN OWED'],
]) {
  const branch = new RegExp("state\\s*===\\s*'" + state + "'").test(CODE);
  const hasPlate = plate.test(CODE) && CODE.includes(label);
  if (!branch) fail('web/status.html has no branch for state === "' + state + '" — those slots would '
    + 'render blank, or fall through to the value branch and print "undefined" at full size');
  else if (!hasPlate) fail('web/status.html branches on "' + state + '" but has no full-size plate saying ' + label);
  else pass('web/status.html branches on "' + state + '" and renders a full-size ' + label + ' plate');
}
if (!/\.rerun/.test(CODE)) fail('web/status.html renders a withheld state without the re-run command — a withheld figure with no route back is a hole');
else pass('web/status.html prints the command that re-runs a withheld figure');
/* EVERY state the builder can emit needs a branch, and the two above are enumerated by hand. This is
   the check that catches a THIRD one being added without a renderer — which is exactly what happened
   on 2026-08-11 and is the reason this section exists in this shape. */
const emitted = new Set([...slots(closedBoard), ...slots(owedBoard), ...slots(liftedBoard)].map(s => s.o.state));
/* `notembedded` is the raw engine/status.js handoff, which is another division's TEXT rather than an
   artifact. It does NOT go through figCard() — its sentence would be false — so its renderer is the
   bespoke THE RAW OUTPUT branch, asserted separately below. */
const RENDERED = new Set(['ok', 'bad', 'stale', 'notmeasured', 'quarantined', 'rerunnable', 'notembedded']);
if (!/status_raw_withheld/.test(CODE)) {
  fail('web/status.html has no branch for a build that declined to embed the raw engine/status.js '
    + 'output — the section would simply vanish, which is the "capability absent, everything reports '
    + 'success" shape');
} else pass('web/status.html renders the reason when the raw engine/status.js handoff is not embedded');
const unrendered = [...emitted].filter(s => !RENDERED.has(s));
if (unrendered.length) {
  fail('web/build-status.js emits slot state(s) that web/status.html has no branch for: '
    + unrendered.join(', ') + '. figCard() would fall through and render the value branch.');
} else pass('every slot state the builder emits (' + [...emitted].sort().join(', ') + ') has a renderer');

/* ================================================================================================
 * F. THE COMMITTED BOARD. A generator that withholds and an output that does not is the drift this
 * whole board exists to catch, one level up.
 * ============================================================================================== */
console.log('\n  F. THE COMMITTED web/status-data.js');
const sandbox = { window: {} };
try {
  new Function('window', fs.readFileSync(D('web', 'status-data.js'), 'utf8'))(sandbox.window);
} catch (e) { /* handled below */ }
const committed = sandbox.window.ABRA_BOARD;
if (!committed) {
  fail('web/status-data.js did not load — build it: node web/build-status.js');
} else {
  const cText = JSON.stringify(committed);
  const cLeak = probes.filter(p => cText.includes(p.probe));
  if (cLeak.length) {
    fail('the COMMITTED web/status-data.js quotes ' + cLeak.length + ' verdict(s) belonging to the '
      + 'downstream set:\n' + cLeak.map(p => '          - data/' + p.file + ': ' + p.probe + '...').join('\n')
      + '\n        Rebuild it: node web/build-status.js');
  } else {
    const cHeld = heldSlots(committed);
    if (!cHeld.length) {
      fail('the committed web/status-data.js withholds NOTHING while ' + probes.length + ' downstream '
        + 'verdict(s) exist. Rebuild it: node web/build-status.js');
    } else {
      pass('the committed web/status-data.js withholds ' + cHeld.length
        + ' slot(s) and quotes no verdict belonging to the downstream set');
    }
    /* REPORTED, NOT ASSERTED, AND HERE IS EXACTLY WHY. The committed board is a SNAPSHOT — it is a
     * <script src> because status.html must work from file://, where fetch() of a local JSON is
     * blocked with no error a visitor can see (web/build-status.js's opening comment). So the gate it
     * carries is the gate that was live when it was built, and it cannot read tonight's.
     *
     * Asserting "the embedded gate equals the live gate" would be a check whose only remedy is a
     * rebuild, and a rebuild is the wrong move while the simulator is being rewritten under it — the
     * board would embed numbers that are mid-change. So the safety property is asserted above (nothing
     * withheld is published, in either direction) and the LABEL drift is reported with its command.
     * The direction matters: this board is UNDER-publishing with a stale reason, which is the safe
     * side. If it were ever over-publishing, the assertion above is the one that fires. */
    const cq = committed.quarantine;
    if (cq && typeof cq.open === 'boolean' && cq.open !== REAL.ok) {
      console.log('\n  STALE BOARD — the committed web/status-data.js embeds a gate that has since moved:');
      console.log('    built ' + committed.built_at + ', gate ' + (cq.open ? 'OPEN' : 'CLOSED')
        + (cq.failing && cq.failing.length ? ' (' + cq.failing.join('; ') + ')' : ''));
      console.log('    live now: gate ' + (REAL.ok ? 'OPEN' : 'CLOSED')
        + (REAL.failing.length ? ' (' + REAL.failing.map(c => c.name).join('; ') + ')' : ''));
      console.log('    It is withholding the right figures for a reason that is out of date. Nothing');
      console.log('    is leaked. Rebuild AFTER the engine settles and the #57 re-runs land:');
      console.log('      node web/build-status.js  &&  cp web/status-data.js app/status-data.js');
    }
  }
}

/* Reported, not asserted: which artifacts this board reads that are currently downstream. It is the
 * list a reader needs when the gate opens, and it is derived rather than typed. */
const sourced = new Set();
for (const s of slots(closedBoard)) {
  if (typeof s.o.src === 'string' && /^data\//.test(s.o.src)) sourced.add(s.o.src.replace(/^data\//, ''));
}
const heldSources = [...sourced].filter(f => ROWS.get(f) && ROWS.get(f).quarantined).sort();
if (heldSources.length) {
  console.log('\n  The board sources ' + heldSources.length + ' artifact(s) downstream of the simulator. Each\n'
    + '  must be RE-RUN before the board can show it — a quarantined number does not become true when\n'
    + '  MEDICHAM becomes correct, it becomes re-runnable (ROADMAP #57):');
  for (const f of heldSources) {
    let age = '';
    try {
      const d = (Date.now() - fs.statSync(D('data', f)).mtimeMs) / 3600000;
      age = '   (' + d.toFixed(0) + 'h old)';
    } catch (e) { age = '   (mtime unreadable)'; }
    console.log('    data/' + f + '   re-run: node ' + ROWS.get(f).by + age);
  }
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
