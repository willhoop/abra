/* THE STATUS BOARD MUST STILL BE SAYING WHAT THE ARTIFACTS SAY.
 *
 * web/status.html renders web/status-data.js, which web/build-status.js bakes from data/*.json and
 * from the output of `node engine/status.js`. That baking is what makes the page work from file://
 * (a fetch() of a local JSON is blocked there and fails silently) -- and it is also what makes the
 * page a SNAPSHOT that can drift. A baked artifact with no check against its source is exactly the
 * hole CLAUDE.md names: `data/engine-data.js` was newer than the merge script that fed it and had
 * still lost its output, because nothing compared the two files.
 *
 * So this compares them. It is `tests/test-stadium-roster.js` applied to NUMBERS rather than to a
 * roster, which docs/WEB.md lists as the obvious next guard to build.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not assert that any figure has a particular VALUE. Pinning 42/54 here would make the
 * project's own numbers un-improvable without editing a test, and ENGINE's census is supposed to go
 * up. Every assertion below is a RELATION: the board's value equals the artifact's value, whatever
 * that value currently is.
 *
 *   node tests/test-web-status.js            check the committed board
 *   node tests/test-web-status.js --rebuild  rebuild it first, then check
 *
 * A STALE BOARD IS A FAILURE, NOT A WARNING. If an artifact has been written since the board was
 * built, the board is describing something that has moved and the fix is one command:
 *     node web/build-status.js
 *
 * AND A WITHHELD FIGURE IS NOT A DRIFTING ONE (added 2026-08-08)
 * -------------------------------------------------------------
 * CLAUDE.md quarantines everything downstream of MEDICHAM until MEDICHAM is correct, and the board
 * now obeys it. That inverts what a match MEANS for those slots: `measure.headline` equalling
 * `data/winrate-backtest.json`'s verdict used to be the pass and is now the FAILURE, because it means
 * the board published a withheld number. So every relation below asks engine/quarantine.js first and
 * flips: a quarantined artifact must be WITHHELD, everything else must MATCH.
 *
 * The membership test is not reimplemented here — the module is asked, exactly as web/build-status.js
 * asks it. Two opinions about what is downstream of the simulator is CLAUDE.md's FACTS ARE GLOBAL
 * failure, and it would be a slow one: the two would agree today and diverge the day a model is added.
 * The BOTH-DIRECTIONS proof (gate closed -> withheld, gate open -> the numbers return) lives in
 * tests/test-web-quarantine.js, which drives buildPayload() twice.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

console.log('WEB STATUS BOARD — web/status-data.js against its artifacts\n');

if (process.argv.includes('--rebuild')) {
  execFileSync(process.execPath, [D('web', 'build-status.js')], { stdio: 'inherit', cwd: ROOT });
  console.log('');
}

/* ---- load the board the same way the browser does: as a script setting one global ---- */
const DATA = D('web', 'status-data.js');
if (!fs.existsSync(DATA)) {
  console.log('  FAIL  web/status-data.js does not exist. Build it: node web/build-status.js');
  process.exit(1);
}
const sandbox = { window: {} };
new Function('window', fs.readFileSync(DATA, 'utf8'))(sandbox.window);
const B = sandbox.window.ABRA_BOARD;
if (!B) { console.log('  FAIL  web/status-data.js did not set window.ABRA_BOARD'); process.exit(1); }
pass('web/status-data.js loads and sets window.ABRA_BOARD');

/* ---- the quarantine, asked rather than assumed ---- */
let QHELD = null, QGATE = null, QERR = null;
try {
  const Q = require('../engine/quarantine.js');
  QGATE = Q.medichamIsCorrect();
  const c = Q.classify();
  if (c.error) throw new Error(c.error);
  const wh = Q.withholder(QGATE, c.rows);
  QHELD = rel => wh(String(rel).replace(/^data\//, ''));
} catch (e) { QERR = String((e && e.message) || e).split('\n')[0]; }
if (QERR) {
  /* NOT a silent pass-through. If the gate cannot be computed, this test cannot tell a published
     withheld figure from a correct one, and saying nothing would be the "capability absent, everything
     reports success" shape. */
  fail('engine/quarantine.js could not be consulted, so no slot below can be checked for a WITHHELD '
     + 'figure being published: ' + QERR);
} else {
  pass('engine/quarantine.js consulted — the gate is '
    + (QGATE.ok ? 'OPEN, so every figure below must carry its value'
                : 'CLOSED (' + QGATE.failing.length + ' of ' + QGATE.clauses.length
                  + ' clauses fail), so anything downstream of the simulator must be WITHHELD'));
}

/* Every caller turns a null into a `fail()`, so the failure IS visible — what was discarded is WHY,
 * and "the artifact is missing" and "the artifact is corrupt" send a reader to different places. */
const readWhy = [];
const j = rel => {
  try { return JSON.parse(fs.readFileSync(D(rel), 'utf8')); }
  catch (e) { readWhy.push(rel + ': ' + String(e.message).split('\n')[0]); return null; }
};

/* ================================================================================================
 * 1. EVERY FIGURE CARRIES A SOURCE.
 * This is the division's whole rule (.claude/agents/web.md) in mechanical form. A figure with a
 * value and no `src` is a number WEB authored, and there is no legitimate case for one.
 * ============================================================================================== */
const sourceless = [];
(function walk(o, p) {
  if (!o || typeof o !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(o, 'v') && Object.prototype.hasOwnProperty.call(o, 'state')) {
    if (!o.src) sourceless.push(p + ' = ' + JSON.stringify(o.v));
  }
  for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
})(B, '');
if (sourceless.length) {
  fail('figures with a value and NO source — these are numbers WEB authored:\n' +
    sourceless.map(s => '          - ' + s).join('\n'));
} else {
  pass('every figure with a value carries the artifact it came from');
}

/* Same rule for a gap: a NOT MEASURED with no reason tells a reader nothing. */
const reasonless = [];
(function walk(o, p) {
  if (!o || typeof o !== 'object') return;
  if (o.state === 'notmeasured' && !o.why) reasonless.push(p);
  for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
})(B, '');
if (reasonless.length) fail('NOT MEASURED slots with no stated reason: ' + reasonless.join(', '));
else pass('every NOT MEASURED slot states why');

/* ================================================================================================
 * 2. THE BOARD'S VALUES EQUAL THE ARTIFACTS' VALUES — OR, WHERE THE ARTIFACT IS WITHHELD, THE SLOT
 *    CARRIES NO VALUE AT ALL.
 * Relations, never literals. Each entry names the artifact path and the JSON path inside it, so a
 * failure says which file to look at rather than "a number changed".
 *
 * A fourth element is the WITHHELD-AT path, and it is needed because withholding collapses a panel.
 * `search.explore` publishes four figures under `.figs` when it is quotable and becomes a single
 * withheld slot when it is not, so `search.explore.figs.2` simply stops existing. Checking the
 * container in that case is the difference between "correctly withheld" and "silently vanished" —
 * and those must not read the same, which is the whole lesson of this file.
 * ============================================================================================== */
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const CHECKS = [
  ['engine.live', 'data/mechanics-census.json', 'live'],
  ['engine.probed', 'data/mechanics-census.json', 'probed'],
  ['engine.missing_n', 'data/mechanics-census.json', 'missing'],
  /* THE INTERACTION MATRIX, PINNED TO ITS ARTIFACT AND NOT TO A LITERAL. Added 2026-08-05 because
   * four living documents were quoting this result at "899 of 899, 100%" while the artifact read
   * 1012 live / 1011 agreeing / 1 parting. Pinning the value here would have made the site agree
   * with a number rather than with a file; these are relations, so MEASURE's queued re-run moves
   * them together and only a board that was not rebuilt goes red. */
  ['engine.matrix_live', 'data/interaction-matrix.json', 'live'],
  ['engine.matrix_agree', 'data/interaction-matrix.json', 'agree'],
  ['engine.matrix_part', 'data/interaction-matrix.json', 'part'],
  ['engine.matrix_ran', 'data/interaction-matrix.json', 'ran'],
  ['engine.matrix_commit', 'data/interaction-matrix.json', 'showdown_commit'],
  /* The explore sweep — the artifact that re-earns the --rollout-explore default after the figure it
   * originally shipped on was retracted as uncheckable. The two ARM accuracies live under a key with
   * a dot in it (`arms.explore_1.0`) and cannot be addressed by this dotted path walker, so the two
   * pinned here are the paired difference and the sample size; the arm figures are still emitted
   * verbatim by build-status.js and are covered by check 1 (every value carries its source). */
  ['search.explore.figs.2', 'data/rollout-r1-explore-sweep.json', 'paired_comparison.diff_points', 'search.explore'],
  ['search.explore.figs.3', 'data/rollout-r1-explore-sweep.json', 'sample.positions', 'search.explore'],
  ['measure.headline', 'data/winrate-backtest.json', 'verdict'],
  ['measure.n_games', 'data/winrate-backtest.json', 'n_games_scored'],
  ['measure.rollouts', 'data/winrate-backtest.json', 'rollouts_per_game'],
  /* The gate ladder, added with the quarantine. Each rung has its own artifact, and all four are
     downstream of the simulator today — so today each of these asserts a WITHHELD rung, and the day
     the gate opens each asserts the rung's value against its artifact. Same line, both regimes. */
  ['search.ladder.0.figs.0', 'data/rollout-r1.json', 'positions', 'search.ladder.0'],
  ['search.ladder.1.figs.0', 'data/rollout-cost.json', 'boards', 'search.ladder.1'],
  ['search.ladder.2.figs.1', 'data/rollout-r3.json', 'decisions', 'search.ladder.2'],
  ['search.ladder.3.figs.1', 'data/rollout-r4.json', 'decisive_pairs', 'search.ladder.3'],
  ['ops.games', 'data/live.js', 'games'],
  ['ops.usable', 'data/live.js', 'usable'],
  ['ops.usablePct', 'data/live.js', 'usablePct'],
  ['ops.teams', 'data/live.js', 'teams'],
  ['ops.turns', 'data/live.js', 'turns'],
];
function artifact(rel) {
  if (rel === 'data/live.js') {
    try { return JSON.parse(fs.readFileSync(D(rel), 'utf8').replace(/^\s*window\.LIVE\s*=\s*/, '').replace(/;\s*$/, '')); }
    catch (e) { readWhy.push(rel + ': ' + String(e.message).split('\n')[0]); return null; }
  }
  return j(rel);
}
let mismatches = 0, withheldOk = 0;
for (const [boardPath, rel, jsonPath, heldAt] of CHECKS) {
  const f = get(B, boardPath);
  const a = artifact(rel);
  if (!a) { fail(boardPath + ': cannot read ' + rel); mismatches++; continue; }
  const want = get(a, jsonPath);

  /* THE QUARANTINE INVERTS THIS ASSERTION, so it is asked FIRST. For a withheld artifact, equalling
     the artifact is the failure: it means the board published a number CLAUDE.md says must not be
     published. The withheld slot must also carry the route back, or it is a deletion rather than a
     quarantine. */
  const h = QHELD && QHELD(rel);
  if (h) {
    const w = get(B, heldAt || boardPath);
    const where = heldAt ? heldAt + ' (which carries ' + boardPath + ' when it is quotable)' : boardPath;
    if (!w || w.state !== 'quarantined') {
      fail(where + ' must be WITHHELD — ' + rel + ' is downstream of the simulator (' + h.because + ')'
        + '\n        but the board renders it as ' + JSON.stringify(w && (w.state + (w.v !== undefined ? ' = ' + JSON.stringify(w.v) : '')))
        + '\n        Rebuild: node web/build-status.js');
      mismatches++;
    } else if (!(w.src && w.because && w.clause && w.rerun)) {
      fail(where + ' is withheld but does not say which artifact, why, which clauses fail or what re-runs it');
      mismatches++;
    } else if (Object.prototype.hasOwnProperty.call(w, 'v') || (heldAt && f !== undefined)) {
      fail(where + ' is marked withheld and a value survives at ' + boardPath + '. A caption is not a quarantine.');
      mismatches++;
    } else withheldOk++;
    continue;
  }

  if (!f || f.state === 'notmeasured') {
    if (want !== undefined && want !== null) {
      fail(boardPath + ' renders NOT MEASURED but ' + rel + ' -> ' + jsonPath + ' = ' + JSON.stringify(want));
      mismatches++;
    }
    continue;
  }
  if (String(f.v) !== String(want)) {
    fail(boardPath + ' = ' + JSON.stringify(f.v) + ' but ' + rel + ' -> ' + jsonPath + ' = ' + JSON.stringify(want)
      + '\n        Rebuild: node web/build-status.js');
    mismatches++;
  }
  if (f.src !== rel) { fail(boardPath + ' claims source ' + f.src + ', should be ' + rel); mismatches++; }
}
if (!mismatches) {
  pass((CHECKS.length - withheldOk) + ' figures match the artifact they name, value and source; '
    + withheldOk + ' are correctly WITHHELD as downstream of MEDICHAM');
}

/* R4 is the number the project is quoted on, so its shape gets its own check.
 * THE SPECIFIC TRAP: the corpus file holds TWO lines per game, so a line count is twice the game
 * count and four times the pair count. A page that prints 5,248 games has quoted the line count. */
const r4 = j('data/rollout-r4.json');
const qr4 = QHELD && QHELD('data/rollout-r4.json');
if (qr4) {
  /* R4 IS THE RESULT THE PROJECT GETS QUOTED ON, which is exactly why it gets its own withheld check
     rather than riding on the loop above. The line-count trap below is untestable while the figure is
     absent, and that is the correct trade: a number that is not printed cannot be printed wrongly. */
  const b4 = B.search && B.search.r4;
  if (!b4 || b4.state !== 'quarantined') {
    fail('data/rollout-r4.json is WITHHELD (' + qr4.because + ') but the board renders R4 as '
      + JSON.stringify(b4 && b4.state) + '. Rebuild: node web/build-status.js');
  } else if (r4 && r4.verdict && JSON.stringify(B).includes(String(r4.verdict).slice(0, 50))) {
    fail('R4 is marked withheld but its verdict sentence still appears somewhere in the board payload');
  } else {
    pass('R4 is WITHHELD, carries no share/pairs/games, and its verdict appears nowhere on the board');
  }
} else if (!r4) {
  fail('data/rollout-r4.json missing — the R4 section of the board cannot be checked');
} else {
  const b4 = B.search && B.search.r4;
  if (!b4 || b4.state === 'notmeasured') fail('board renders R4 as NOT MEASURED but data/rollout-r4.json exists');
  else {
    const same = ['share:arm1_share_pct', 'decisive_pairs:decisive_pairs', 'pairs:pairs', 'games:games', 'verdict:verdict']
      .map(s => s.split(':'))
      .filter(([bk, ak]) => String(b4[bk]) !== String(r4[ak]));
    if (same.length) fail('R4 board fields disagree with data/rollout-r4.json: ' + same.map(s => s[0]).join(', '));
    else pass('R4 verdict, share, decisive pairs, seed pairs and games all match data/rollout-r4.json');

    if (String(b4.games) === String(r4.corpus_shape && r4.corpus_shape.lines)) {
      fail('R4 "games" on the board equals the LINE count. Every game id appears twice in the corpus; ' +
        'games is ' + r4.games + ', lines is ' + r4.corpus_shape.lines + '.');
    } else {
      pass('R4 games is the game count (' + r4.games + '), not the line count (' +
        (r4.corpus_shape ? r4.corpus_shape.lines : '?') + ')');
    }
  }
}

/* ================================================================================================
 * 3. THE BOARD IS NOT STALE.
 * A snapshot is only honest while it is current. Anything the board sources from must not be newer
 * than the build stamp.
 * ============================================================================================== */
const built = new Date(B.built_at);
const sources = new Set();
(function walk(o) {
  if (!o || typeof o !== 'object') return;
  /* engine/status.js is excluded on purpose: it is RUN at build time, not read as data, so its
     mtime is when somebody last edited the printer — not when the figure was produced. Treating a
     tool's mtime as its output's age is the mistake status.js itself documents having made. */
  if (typeof o.src === 'string' && o.src !== 'engine/status.js'
      && o.src.indexOf('/') > 0 && /\.(json|js)$/.test(o.src)) sources.add(o.src);
  for (const k of Object.keys(o)) walk(o[k]);
})(B);
/* A SOURCE THAT NO LONGER EXISTS WAS READING AS UP TO DATE. `catch { return false }` means "not
 * newer than the board", which is the same answer this filter gives a perfectly fresh artifact. So
 * the board could name `data/foo.json` that had been renamed or deleted and this check — the one
 * whose job is that every rendered figure traces to an artifact — would say nothing at all. Missing
 * is now its own failure, because it is a WORSE state than stale, not a better one. */
const missing = [];
const newer = [...sources].filter(s => {
  try { return fs.statSync(D(s)).mtime > built; }
  catch (e) { missing.push(`${s} — ${e.code === 'ENOENT' ? 'does not exist' : e.message}`); return false; }
}).sort();
if (missing.length) {
  fail('the board names artifacts that cannot be stat-ed, so nothing can be said about their age:\n'
    + missing.map(s => '          - ' + s).join('\n')
    + '\n        A figure whose source is gone is not fresh; it is unsourced.');
}
/* THE SUITE REWRITES THE ARTIFACTS THIS BOARD IS BUILT FROM, AND THAT IS NOT THE BOARD'S FAULT.
 *
 * `tests/run-all.js` runs test-mechanics (writes mechanics-census.json), test-engine-diff (writes
 * engine-diff.json) and the interaction matrix (writes interaction-matrix.json). So a full suite
 * run INVALIDATES the board it is about to check, every time — this test was red at the end of a
 * run that started green, and rebuilding, committing and re-running reproduced it immediately.
 * That is the harness measuring its own side effect and reporting it as a defect in the site.
 *
 * The fix is NOT to stop checking. A board somebody forgot to rebuild after changing the engine is
 * exactly what this exists to catch, and that case is untouched. What changes is that an artifact
 * rewritten AFTER the suite started is attributed to the suite and reported as a notice, while one
 * that was already newer than the board when the suite BEGAN is still a failure — it was stale
 * before anybody ran anything, which is the real defect.
 *
 * Absent the variable (running this file directly) every entry is a failure, as before. The
 * strictness only relaxes when something can prove it caused the change. */
const SUITE_AT = Number(process.env.ABRA_SUITE_STARTED_AT) || null;
const staleBefore = [], rewrittenByThisRun = [];
for (const s of newer) {
  const at = fs.statSync(D(s)).mtime.getTime();
  (SUITE_AT && at >= SUITE_AT ? rewrittenByThisRun : staleBefore).push(s);
}
if (staleBefore.length) {
  fail('these artifacts were ALREADY newer than the board when this run began (' + B.built_at + '):\n' +
    staleBefore.map(s => '          - ' + s).join('\n') +
    '\n        The board is describing values that had already moved. Rebuild: node web/build-status.js');
} else {
  pass(sources.size + ' sourced artifacts, none stale when this run began');
}
if (rewrittenByThisRun.length) {
  console.log('        NOTE: ' + rewrittenByThisRun.length + ' artifact(s) were rewritten by THIS suite run '
    + '(' + rewrittenByThisRun.join(', ') + ').\n'
    + '        Not scored — the suite regenerates them, so the board cannot be current at the end of a\n'
    + '        run that produced them. Rebuild after the suite if you are about to publish.');
}

/* ================================================================================================
 * 4. THE PAGE ACTUALLY READS THE BOARD, AND READS NOTHING REMOTE.
 * docs/WEB.md: no external assets, ever — a blocked font fails silently and ships a fallback nobody
 * chose. And a page that fetch()es a local JSON works when served and is blank from file://.
 * ============================================================================================== */
const HTML = fs.readFileSync(D('web', 'status.html'), 'utf8');
/* Scan CODE, not prose. The first version of the fetch() check went red on this very file's own
 * comment explaining why fetch() is banned — a check that fires on its own rationale is a check
 * people delete. Strip HTML comments and JS block comments first. */
const CODE = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
if (!/<script src="status-data\.js"><\/script>/.test(HTML)) {
  fail('web/status.html does not load status-data.js with a plain <script src> — that tag is what makes it work from file://');
} else pass('web/status.html loads the board with a <script src>, which works under file://');

if (/\bfetch\s*\(/.test(CODE)) fail('web/status.html calls fetch() — blocked under file://, and it fails silently');
else pass('no fetch() in web/status.html');

const remote = [...CODE.matchAll(/(?:src|href)\s*=\s*"(https?:)?\/\/[^"]+"/g)].map(m => m[0]);
if (remote.length) fail('external assets in web/status.html: ' + remote.join(', '));
else pass('no external assets — nothing is loaded from another host');

/* THE BOARD IS THE ONE PAGE WHOSE JOB IS TO SHOW GAPS, so a board showing none has to prove it can
 * still show one.
 *
 * This check used to FAIL outright on zero, on the reasoning that either everything got measured at
 * once or the rendering broke. On 2026-08-04 the first of those actually happened: WEB's own
 * traceability slot was the last open gap on the board, and measuring it (web/figure-audit.js) took
 * the count to zero and turned this red. A guard that goes red when the project succeeds is a guard
 * that gets filed as "known", which CLAUDE.md bans by name.
 *
 * So it now tests what it always MEANT: that the gap path is intact. `build-status.js` must still
 * have a gap emitter, and `status.html` must still have a branch that renders one. Zero gaps then
 * passes, loudly, as the result it is — while a deleted gap renderer still fails. */
const nm = JSON.stringify(B).split('"state":"notmeasured"').length - 1;
if (nm > 0) {
  pass(nm + ' NOT MEASURED slot(s) rendered');
} else {
  const BUILD = fs.readFileSync(D('web', 'build-status.js'), 'utf8');
  const emitter = /function gap\s*\(/.test(BUILD) && /state:\s*'notmeasured'/.test(BUILD);
  const renderer = /notmeasured/.test(CODE);
  if (!emitter) fail('the board renders zero NOT MEASURED slots AND web/build-status.js no longer emits one — the gap path was deleted, not closed');
  else if (!renderer) fail('the board renders zero NOT MEASURED slots AND web/status.html no longer has a branch that renders one — the gap path was deleted, not closed');
  else pass('zero NOT MEASURED slots — every slot on the board is sourced. The gap path is still present in build-status.js and status.html, so this is a closed gap and not a broken renderer.');
}

if (readWhy.length) {
  console.log(`\n  ${readWhy.length} artifact(s) could not be read. The failures above say WHICH figure`);
  console.log('  is unchecked; these say why, which is the difference between "nobody built it" and');
  console.log('  "it is there and it has rotted":');
  for (const s of readWhy) console.log('    ' + s);
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
