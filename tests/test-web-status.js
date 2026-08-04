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

const j = rel => { try { return JSON.parse(fs.readFileSync(D(rel), 'utf8')); } catch (e) { return null; } };

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
 * 2. THE BOARD'S VALUES EQUAL THE ARTIFACTS' VALUES.
 * Relations, never literals. Each entry names the artifact path and the JSON path inside it, so a
 * failure says which file to look at rather than "a number changed".
 * ============================================================================================== */
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const CHECKS = [
  ['engine.live', 'data/mechanics-census.json', 'live'],
  ['engine.probed', 'data/mechanics-census.json', 'probed'],
  ['engine.missing_n', 'data/mechanics-census.json', 'missing'],
  ['measure.headline', 'data/winrate-backtest.json', 'verdict'],
  ['measure.n_games', 'data/winrate-backtest.json', 'n_games_scored'],
  ['measure.rollouts', 'data/winrate-backtest.json', 'rollouts_per_game'],
  ['ops.games', 'data/live.js', 'games'],
  ['ops.usable', 'data/live.js', 'usable'],
  ['ops.usablePct', 'data/live.js', 'usablePct'],
  ['ops.teams', 'data/live.js', 'teams'],
  ['ops.turns', 'data/live.js', 'turns'],
];
function artifact(rel) {
  if (rel === 'data/live.js') {
    try { return JSON.parse(fs.readFileSync(D(rel), 'utf8').replace(/^\s*window\.LIVE\s*=\s*/, '').replace(/;\s*$/, '')); }
    catch (e) { return null; }
  }
  return j(rel);
}
let mismatches = 0;
for (const [boardPath, rel, jsonPath] of CHECKS) {
  const f = get(B, boardPath);
  const a = artifact(rel);
  if (!a) { fail(boardPath + ': cannot read ' + rel); mismatches++; continue; }
  const want = get(a, jsonPath);
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
if (!mismatches) pass(CHECKS.length + ' figures match the artifact they name, value and source');

/* R4 is the number the project is quoted on, so its shape gets its own check.
 * THE SPECIFIC TRAP: the corpus file holds TWO lines per game, so a line count is twice the game
 * count and four times the pair count. A page that prints 5,248 games has quoted the line count. */
const r4 = j('data/rollout-r4.json');
if (!r4) {
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
const newer = [...sources].filter(s => {
  try { return fs.statSync(D(s)).mtime > built; } catch (e) { return false; }
}).sort();
if (newer.length) {
  fail('these artifacts have been written SINCE the board was built (' + B.built_at + '):\n' +
    newer.map(s => '          - ' + s).join('\n') +
    '\n        The board is describing values that have moved. Rebuild: node web/build-status.js');
} else {
  pass(sources.size + ' sourced artifacts, none written since the board was built');
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

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
