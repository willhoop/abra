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
 * IT PROVES BOTH DIRECTIONS, AND THE SECOND ONE IS NOT OPTIONAL
 * ------------------------------------------------------------
 * `engine/quarantine.js`'s own selftest is the model: gate closed -> 34 of 34 withheld, gate open ->
 * 0 of 34. A page that can never show a number again is exactly as broken as one that shows a stale
 * one, and a test that only ever runs against today's closed gate cannot tell those apart — deleting
 * every figure in build-status.js would pass it.
 *
 * So `web/build-status.js` exports `buildPayload(held)` and takes the withholder as an ARGUMENT, the
 * way `quarantine.withholder(gate, rows)` does. This drives that exact shipping function twice over
 * the same classification, changing only the gate. There is deliberately no --force-open flag in
 * either file: anything that can silence a quarantine from the command line eventually does, which is
 * why provenance.js's `void` is one-way. A parameter is visible in the caller; a flag is not.
 *
 * WHAT IT ASSERTS, AND WHY EACH ONE IS HERE
 * -----------------------------------------
 *   RED  — with the gate CLOSED, every board slot whose artifact is quarantined carries no value,
 *          and no quarantined artifact's own verdict/headline/summary sentence appears ANYWHERE in
 *          the payload. The second half is the real test: it is the exact text a reader would quote,
 *          and it is what engine/quarantine.js --check greps for.
 *   RED  — a withheld slot carries the four things that replace the number: the artifact, why it is
 *          downstream, how many gate clauses fail, and the command that re-runs it. A withheld
 *          figure with no route back is just a hole.
 *   LIFT — with the gate OPEN, nothing is withheld and the same slots carry the artifacts' values
 *          again, matching the artifact field for field.
 *   And that the page can render the state at all — a payload full of withheld slots against a
 *   status.html with no branch for them would render blanks, which is worse than the stale number.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

console.log('WEB QUARANTINE — web/status-data.js against engine/quarantine.js, gate closed and gate open\n');

const Q = require('../engine/quarantine.js');
/* Building the board runs `node engine/status.js` once, at require time. That is the same command
 * the generator runs, so this measures the shipping path rather than a stand-in. */
const BUILD = require('../web/build-status.js');

/* ---- one classification, two gates. The membership test is NOT reimplemented here; asking a second
 * opinion about what is downstream of the simulator is CLAUDE.md's FACTS ARE GLOBAL failure. ---- */
const cls = Q.classify();
if (cls.error) {
  console.log('  FAIL  engine/quarantine.js could not classify the artifacts: ' + cls.error);
  console.log('\n1 FAILURE(S)');
  process.exit(1);
}
const ROWS = cls.rows;
const CLOSED = Q.medichamIsCorrect();
/* The synthetic OPEN gate has the shape withholder() reads and nothing else. It is not written to
 * disk, it is not a flag, and it exists only inside this process. */
const OPEN = { ok: true, clauses: CLOSED.clauses, failing: [] };

pass('engine/quarantine.js classified ' + ROWS.size + ' artifacts; the real gate is '
  + (CLOSED.ok ? 'OPEN' : 'CLOSED (' + CLOSED.failing.length + ' of ' + CLOSED.clauses.length + ' clauses fail)'));

const closedBoard = BUILD.buildPayload(BUILD.makeHeld(Q.withholder(CLOSED, ROWS)),
  BUILD.quarantineBlock(CLOSED, ROWS, null));
const openBoard = BUILD.buildPayload(BUILD.makeHeld(Q.withholder(OPEN, ROWS)),
  BUILD.quarantineBlock(OPEN, ROWS, null));

/* Every slot on a board, flattened once, so the three checks below walk the same definition of
 * "a slot" rather than three slightly different ones. */
function slots(board) {
  const out = [];
  (function walk(o, p) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.state === 'string') out.push({ at: p, o: o });
    for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
  })(board, '');
  return out;
}
/* The artifacts the board actually sources from, whichever state each slot is in. A quarantined slot
 * names its withheld artifact in `src`, so this set is the same on both boards — which is the point:
 * the board reads the same files either way and only the publishing decision changes. */
function sourced(board) {
  const out = new Set();
  for (const s of slots(board)) {
    if (typeof s.o.src === 'string' && /^data\//.test(s.o.src)) out.add(s.o.src.replace(/^data\//, ''));
  }
  return out;
}

/* ================================================================================================
 * 1. RED — GATE CLOSED. Nothing quarantined is published.
 * ============================================================================================== */
const closedSlots = slots(closedBoard);
const heldSlots = closedSlots.filter(s => s.o.state === 'quarantined');

if (!CLOSED.ok && !heldSlots.length) {
  fail('the gate is CLOSED and the board withheld NOTHING. Either build-status.js is not asking '
    + 'engine/quarantine.js, or it asked and ignored the answer.');
} else if (!CLOSED.ok) {
  pass(heldSlots.length + ' slot(s) render QUARANTINED with the gate closed');
}

/* A slot may not carry a value for an artifact that is withheld. This is the mechanical form of
 * "the figure is ABSENT, not annotated" — a `v` beside a caveat is the bug this closes. */
const leakedValues = closedSlots.filter(s => {
  if (s.o.state === 'quarantined') return false;
  const src = typeof s.o.src === 'string' ? s.o.src.replace(/^data\//, '') : null;
  if (!src) return false;
  const r = ROWS.get(src);
  if (!r || !r.quarantined) return false;
  /* `rows` panels have no `v` but do carry the artifact's contents, so both are a publication. */
  return Object.prototype.hasOwnProperty.call(s.o, 'v') || Array.isArray(s.o.rows);
});
if (leakedValues.length) {
  fail('slots carrying a value sourced to a QUARANTINED artifact:\n'
    + leakedValues.map(s => '          - ' + s.at + '  <- ' + s.o.src).join('\n'));
} else {
  pass('no slot on the closed board carries a value sourced to a quarantined artifact');
}

/* THE STRONGEST CHECK, AND IT IS THE ONE engine/quarantine.js --check USES. Every quarantined
 * artifact that carries a verdict carries its whole headline in it. If that sentence is anywhere in
 * the payload — a figure, a note, a caveat, or the embedded raw status.js output — it was published.
 * This is what found the five rows in the first place. */
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
const closedText = JSON.stringify(closedBoard);
const leakedVerdicts = probes.filter(p => closedText.includes(p.probe));
if (!probes.length) {
  fail('no quarantined artifact carries a verdict/headline/summary string, so this check proved '
    + 'nothing. That is not a pass — it means the probe set is empty and a leak would be invisible.');
} else if (leakedVerdicts.length) {
  fail(leakedVerdicts.length + ' QUARANTINED verdict string(s) still appear in the board payload:\n'
    + leakedVerdicts.map(p => '          - data/' + p.file + ' (' + p.key + '): ' + p.probe + '...').join('\n')
    + '\n        A caption is not a quarantine. Withhold the number; print what would re-run it.');
} else {
  pass(probes.length + ' quarantined verdict string(s) checked against the whole payload, including '
    + 'the embedded engine/status.js output — none appears');
}

/* ================================================================================================
 * 2. RED — A WITHHELD SLOT CARRIES THE ROUTE BACK.
 * The whole substitute for a withheld number is knowing what re-runs it. Without that this is not a
 * quarantine, it is a deletion.
 * ============================================================================================== */
const incomplete = heldSlots.filter(s => !(s.o.src && s.o.because && s.o.clause && s.o.rerun));
if (heldSlots.length && incomplete.length) {
  fail('withheld slots missing the artifact, the reason, the failing clauses or the re-run command:\n'
    + incomplete.map(s => '          - ' + s.at + ' ' + JSON.stringify({
      src: s.o.src, because: !!s.o.because, clause: !!s.o.clause, rerun: s.o.rerun })).join('\n'));
} else if (heldSlots.length) {
  pass('every withheld slot names its artifact, why it is downstream, the failing clauses and the command that re-runs it');
}

/* And the gate itself is rendered, not merely obeyed — a page that silently drops five figures
 * teaches a visitor nothing about why. */
const qz = closedBoard.quarantine;
if (!qz || (!CLOSED.ok && qz.open !== false)) fail('the closed board carries no quarantine block, so the page cannot explain the holes');
else if (!CLOSED.ok && !(qz.clauses && qz.clauses.length && qz.rule && qz.derivation)) {
  fail('the quarantine block is missing the clauses, the rule or the derivation command');
} else pass('the board carries the gate itself — the failing clauses, the rule and the derivation command');

/* ================================================================================================
 * 3. LIFT — GATE OPEN. The numbers come back.
 * A quarantine that can never lift is as broken as one that never engages, and this is the direction
 * a test naturally forgets: with today's gate closed, deleting every figure would pass section 1.
 * ============================================================================================== */
const openHeld = slots(openBoard).filter(s => s.o.state === 'quarantined');
if (openHeld.length) {
  fail('LIFT FAILED — with the gate OPEN, ' + openHeld.length + ' slot(s) are still withheld:\n'
    + openHeld.map(s => '          - ' + s.at).join('\n'));
} else {
  pass('LIFT — with the gate open, NOTHING is withheld');
}

/* The same slots must carry the ARTIFACTS' values again, not merely stop saying QUARANTINED. Every
 * pair below is a RELATION against the artifact, never a pinned literal: these numbers are supposed
 * to move when the runs are redone. Each names an artifact that is quarantined today, so each is a
 * slot section 1 proved absent — the two directions are asserted over the same slots on purpose. */
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
let restored = 0, notRestored = [];
for (const [boardPath, file, jsonPath] of RESTORED) {
  let a = null;
  try { a = JSON.parse(fs.readFileSync(D('data', file), 'utf8')); } catch (e) { /* below */ }
  if (!a) { notRestored.push(boardPath + ': data/' + file + ' could not be read'); continue; }
  const want = get(a, jsonPath);
  const got = get(openBoard, boardPath);
  const gotV = got && Object.prototype.hasOwnProperty.call(got, 'v') ? got.v : got;
  if (want === undefined || want === null) { notRestored.push(boardPath + ': data/' + file + ' -> ' + jsonPath + ' is absent'); continue; }
  if (String(gotV) !== String(want)) {
    notRestored.push(boardPath + ' = ' + JSON.stringify(gotV) + ' but data/' + file + ' -> ' + jsonPath + ' = ' + JSON.stringify(want));
    continue;
  }
  /* And it must have been absent with the gate closed, or this pair proves nothing about the
     quarantine — only that the board can read a file. */
  const before = get(closedBoard, boardPath);
  if (!CLOSED.ok && before && Object.prototype.hasOwnProperty.call(before, 'v')) {
    notRestored.push(boardPath + ' carried a value with the gate CLOSED, so its return proves nothing');
    continue;
  }
  restored++;
}
if (notRestored.length) fail('LIFT — figures that did not come back correctly:\n' + notRestored.map(s => '          - ' + s).join('\n'));
else pass('LIFT — ' + restored + ' figures return and equal their artifact, each having been absent with the gate closed');

/* ================================================================================================
 * 4. THE PAGE CAN RENDER THE STATE.
 * A payload full of withheld slots against a status.html with no branch for them renders blanks,
 * which is worse than the stale number — the exact "a capability was absent and everything reported
 * success" shape. Checked as CODE, with comments stripped, so this file's own prose about the
 * quarantine cannot satisfy it.
 * ============================================================================================== */
const HTML = fs.readFileSync(D('web', 'status.html'), 'utf8');
const CODE = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const branch = /state\s*===\s*'quarantined'/.test(CODE);
const plate = /qplate/.test(CODE) && /QUARANTINED/.test(CODE);
const rerun = /\.rerun/.test(CODE);
if (!branch) fail('web/status.html has no branch for state === "quarantined" — withheld slots would render blank');
else if (!plate) fail('web/status.html has a quarantined branch but no full-size plate that says QUARANTINED');
else if (!rerun) fail('web/status.html renders the withheld state without the re-run command — a withheld figure with no route back is a hole');
else pass('web/status.html branches on the withheld state, renders a full-size QUARANTINED plate and prints what re-runs it');

/* The committed board must be in the same state as the one just built. A generator that withholds and
 * an output that does not is the drift this whole board exists to catch, one level up. */
const sandbox = { window: {} };
try {
  new Function('window', fs.readFileSync(D('web', 'status-data.js'), 'utf8'))(sandbox.window);
} catch (e) { /* handled below */ }
const committed = sandbox.window.ABRA_BOARD;
if (!committed) {
  fail('web/status-data.js did not load — build it: node web/build-status.js');
} else {
  const cHeld = slots(committed).filter(s => s.o.state === 'quarantined').length;
  if (!CLOSED.ok && !cHeld) {
    fail('the committed web/status-data.js withholds NOTHING while the gate is CLOSED. '
      + 'Rebuild it: node web/build-status.js');
  } else {
    const cLeak = probes.filter(p => JSON.stringify(committed).includes(p.probe));
    if (cLeak.length) {
      fail('the COMMITTED web/status-data.js still quotes ' + cLeak.length + ' withheld verdict(s):\n'
        + cLeak.map(p => '          - data/' + p.file + ': ' + p.probe + '...').join('\n')
        + '\n        Rebuild it: node web/build-status.js');
    } else {
      pass('the committed web/status-data.js withholds ' + cHeld + ' slot(s) and quotes no withheld verdict');
    }
  }
}

/* Reported, not asserted: which artifacts this board reads that are currently withheld. It is the
 * list a reader needs when the gate opens, and it is derived rather than typed. */
const src = sourced(closedBoard);
const heldSources = [...src].filter(f => ROWS.get(f) && ROWS.get(f).quarantined).sort();
if (heldSources.length) {
  console.log('\n  The board sources ' + heldSources.length + ' quarantined artifact(s). When the gate opens, each\n'
    + '  must be RE-RUN before the board can show it — a quarantined number does not become true when\n'
    + '  MEDICHAM becomes correct, it becomes re-runnable:');
  for (const f of heldSources) console.log('    data/' + f + '   re-run: node ' + ROWS.get(f).by);
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
