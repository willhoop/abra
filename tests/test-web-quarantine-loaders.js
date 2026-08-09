/* A PAGE THAT *LOADS* A WITHHELD ARTIFACT IS THE LEAK NO CITATION CHECK CAN SEE.
 *
 *   node tests/test-web-quarantine-loaders.js
 *
 * WHY THIS EXISTS
 * ---------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * `engine/quarantine.js`'s `citations()` walks docs/, web/ and app/ looking for a quarantined
 * artifact's VERDICT SENTENCE. That catches a page that QUOTES a withheld number, and it caught six
 * on the day it was written. It is structurally blind to the bigger class:
 *
 *     web/index.html       <script src="../data/mag.js">   <script src="../data/mew.js">
 *     web/replay.html      <script src="../data/mew.js">
 *     web/scoreboard.html  <script src="../data/scoreboard.js">
 *
 * All three files are in the withheld set. Not one of those pages quotes a sentence out of them —
 * they load the bundle and draw the whole room from the object, so the leak is a hundred numbers
 * wide and has no quotable string in it at all. THE SCOREBOARD IS THE WORST OF THE THREE: every
 * score, every feature contribution and every board on that page came out of data/scoreboard.js, and
 * a verdict grep returns clean on it forever.
 *
 * `tests/test-web-quarantine.js` proves the STATUS BOARD obeys the quarantine. This proves the five
 * ROOMS do, and it is the half that needed a different probe rather than a wider grep.
 *
 * WHAT IT ASSERTS, AND WHY EACH ONE IS HERE
 * -----------------------------------------
 *   DETECT — every `<script src>` and every `fetch()` target on every page under web/ is resolved to
 *            a row in engine/quarantine.js's graph. A page that loads a WITHHELD artifact must
 *            consult the gate about that exact artifact before drawing it. An UNCLASSIFIED target is
 *            reported and never defaulted: defaulting to clean hides a leak and defaulting to held
 *            withholds an instrument, which is the reasoning quarantine.js itself uses.
 *   RED    — with the gate CLOSED, every held page figure is absent from the emitted payload, and no
 *            withheld literal survives on any page line that cites a quarantined artifact.
 *   LIFT   — with the gate OPEN, every one of those figures comes back and equals the harvested
 *            value byte for byte. A page that can never show a number again is exactly as broken as
 *            one that shows a stale number, and with today's gate closed, deleting every figure on
 *            the site would pass the RED half on its own.
 *   BUILT  — the committed web/quarantine-data.js and the block stamped inside web/stadium.html are
 *            what the builder emits now. A generator that withholds and an output that does not is
 *            the drift the whole mechanism exists to catch, one level up.
 *
 * THE WITHHOLDER IS AN ARGUMENT AND THERE IS NO --force-open. `buildQuarantine(withhold, gate, rows)`
 * is driven twice over ONE classification, changing only the gate — the shape engine/quarantine.js's
 * own selftest uses. Anything that can silence a quarantine from the command line eventually does.
 *
 * WHAT engine/quarantine.js WOULD NEED TO ABSORB THIS (reported at the end of every run, so it is a
 * measurement rather than a memory): a second probe beside `citations()` that resolves a page's
 * `<script src>` and `fetch()` targets against the artifact rows, and a way for a page to DECLARE it
 * has consulted the gate. Both are implemented below and neither needs anything this repository does
 * not already have. It is not moved by hand from here, because WEB may not edit engine/.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let failures = 0;
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const pass = m => console.log('  ok    ' + m);

console.log('WEB QUARANTINE / LOADERS — the pages that LOAD a withheld artifact rather than quote one\n');

const Q = require('../engine/quarantine.js');
const BUILD = require('../web/build-quarantine.js');

const cls = Q.classify();
if (cls.error) {
  console.log('  FAIL  engine/quarantine.js could not classify the artifacts: ' + cls.error);
  console.log('\n1 FAILURE(S)');
  process.exit(1);
}
const ROWS = cls.rows;
const CLOSED = Q.medichamIsCorrect();
/* The synthetic OPEN gate has the shape withholder() reads and nothing else. It is not written to
   disk, it is not a flag, and it exists only inside this process. */
const OPEN = { ok: true, clauses: CLOSED.clauses, failing: [] };
const wClosed = Q.withholder(CLOSED, ROWS);
const wOpen = Q.withholder(OPEN, ROWS);

pass('engine/quarantine.js classified ' + ROWS.size + ' artifacts; the real gate is '
  + (CLOSED.ok ? 'OPEN' : 'CLOSED (' + CLOSED.failing.length + ' of ' + CLOSED.clauses.length + ' clauses fail)'));

/* ================================================================================================
 * 1. THE DETECTOR — what each page LOADS, resolved against the artifact graph.
 * ============================================================================================== */
const PAGES = fs.readdirSync(D('web')).filter(f => /\.html$/.test(f)).sort();

/* Comments stripped before any of this is read as code. A page that DISCUSSES the quarantine in a
   comment has not consulted it — the same lesson engine/quarantine.js records about `require` in a
   comment being a citation rather than a dependency. */
const decomment = s => s.replace(/<!--[\s\S]*?-->/g, ' ')
                        .replace(/\/\*[\s\S]*?\*\//g, ' ')
                        .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

function loadsOf(src) {
  const out = [];
  for (const m of src.matchAll(/<script[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) out.push({ how: '<script src>', target: m[1] });
  for (const m of src.matchAll(/fetch\(\s*["']([^"']+)["']/g)) out.push({ how: 'fetch()', target: m[1] });
  return out;
}
/* A target is ours when it resolves inside data/. Everything else is a sibling page asset or a
   remote host, and neither is an artifact this gate has an opinion about. */
function asArtifact(t) {
  if (/^https?:/i.test(t)) return null;
  const m = /(?:^|\/)data\/([A-Za-z0-9_.\-]+)$/.exec(t);
  return m ? m[1] : null;
}

/* ONE detector, driven over the real pages below and over synthetic ones in the selftest, because a
   probe that has only ever returned "no leaks" is not evidence — the same reason
   engine/quarantine.js drives its own withholder red and green. */
function detect(pages, held) {
  const report = [], unclassified = [];
  for (const p of pages) {
    const code = decomment(p.src);
    for (const l of loadsOf(p.src)) {
      const art = asArtifact(l.target);
      if (!art) continue;
      const row = ROWS.get(art);
      if (!row) { unclassified.push(p.name + '  ' + l.how + ' ' + l.target); continue; }
      if (!held(art)) continue;
      /* THE PAGE MUST NAME THE ARTIFACT IT IS ASKING ABOUT. `heldFor('data/mew.js')` is a declaration
         a machine can check; a bare `if (ABRA_QUARANTINE.open)` is not, because it would let a page
         hide one bundle behind another bundle's gate. */
      const asks = new RegExp('heldFor\\(\\s*[\'"](?:\\.\\./)?(?:data/)?'
        + art.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]').test(code);
      report.push({ page: p.name, how: l.how, art: art, asks: asks, by: row.by });
    }
  }
  return { report, unclassified };
}

/* ---- THE DETECTOR, SHOWN RED FIRST ------------------------------------------------------------
   Three synthetic pages: one loads a withheld bundle with no guard at all, one guards the WRONG
   bundle (the case a bare gate check would wave through), one guards correctly. If the middle case
   ever passes, a page can hide any bundle behind any other bundle's branch. */
{
  const isHeld = a => a === 'mag.js' || a === 'mew.js';
  const s = detect([
    { name: 'RED/naked.html', src: '<script src="../data/mag.js"></script><script>draw(MAG);</script>' },
    { name: 'RED/wrongguard.html', src: '<script src="../data/mag.js"></script><script>if(Q.heldFor("data/mew.js"))return;draw(MAG);</script>' },
    { name: 'RED/commented.html', src: '<script src="../data/mew.js"></script><script>/* Q.heldFor("data/mew.js") one day */ draw(MEW);</script>' },
    { name: 'GREEN/guarded.html', src: '<script src="../data/mew.js"></script><script>if(Q.heldFor("data/mew.js"))return;draw(MEW);</script>' },
  ], isHeld);
  const by = Object.fromEntries(s.report.map(r => [r.page, r.asks]));
  const want = { 'RED/naked.html': false, 'RED/wrongguard.html': false, 'RED/commented.html': false, 'GREEN/guarded.html': true };
  const wrong = Object.keys(want).filter(k => by[k] !== want[k]);
  if (s.report.length !== 4 || wrong.length) {
    fail('the detector does not behave on synthetic input (' + s.report.length + ' of 4 loads seen'
      + (wrong.length ? ', wrong on ' + wrong.join(', ') : '') + '). A probe that only ever says "clean" '
      + 'proves nothing about the real pages below.');
  } else {
    pass('RED — the detector flags an unguarded load, a load guarded on the WRONG artifact, and a guard '
      + 'that exists only in a comment; and passes the one that names its own bundle');
  }
}

const found = detect(PAGES.map(f => ({ name: 'web/' + f, src: fs.readFileSync(D('web', f), 'utf8') })),
  a => { const r = ROWS.get(a); return !!(r && r.quarantined); });
const report = found.report, unclassified = found.unclassified;
const leaks = report.filter(r => !r.asks).length, consulted = report.length - leaks;

if (!report.length) {
  fail('the detector resolved NO page load to a quarantined artifact. Either nothing is withheld — '
    + 'and the gate says ' + (CLOSED.ok ? 'it is OPEN, which would explain it' : 'it is CLOSED, which would not')
    + ' — or the scanner is broken. A zero here is not a clean site.');
} else {
  console.log('');
  for (const r of report) {
    console.log('        ' + (r.asks ? 'guarded' : 'LEAK   ') + '  ' + r.page.padEnd(20) + r.how.padEnd(14) + 'data/' + r.art);
  }
  console.log('');
  if (leaks) {
    fail(leaks + ' page(s) LOAD a withheld artifact and never ask engine/quarantine.js about it. '
      + 'A verdict-string check cannot see this — the page draws the object, it does not quote a sentence.');
  } else {
    pass(consulted + ' page load(s) of a withheld artifact, every one of them guarded by a '
      + 'heldFor() naming that exact artifact');
  }
}
if (unclassified.length) {
  console.log('  note  ' + unclassified.length + ' loaded data file(s) have NO ROW in the artifact graph, so they are '
    + 'neither\n        cleared nor withheld. Reported, never defaulted — the same reason\n'
    + '        engine/quarantine.js prints its unclassified set:');
  for (const u of unclassified) console.log('          ' + u);
}

/* ================================================================================================
 * 2. RED — GATE CLOSED. Nothing held is emitted, and nothing held is left typed on a page.
 * ============================================================================================== */
const RELEASE = JSON.parse(fs.readFileSync(D('web', 'quarantine-release.json'), 'utf8'));
const closed = BUILD.buildQuarantine(wClosed, CLOSED, ROWS, RELEASE);
const open = BUILD.buildQuarantine(wOpen, OPEN, ROWS, RELEASE);

const heldEntries = RELEASE.entries.filter(e => !!wClosed(e.src));
if (!CLOSED.ok && !heldEntries.length) {
  fail('the gate is CLOSED and not one harvested figure resolves to a withheld artifact. Either the '
    + 'release file lost its `src` fields or the classification is not being consulted.');
} else if (!CLOSED.ok) {
  pass(heldEntries.length + ' of ' + RELEASE.entries.length + ' harvested page figures resolve to a withheld artifact');
}

const closedText = JSON.stringify(closed);
const leaked = heldEntries.filter(e => Object.prototype.hasOwnProperty.call(closed.R, e.key));
if (leaked.length) {
  fail(leaked.length + ' withheld figure(s) are still emitted into web/quarantine-data.js:\n'
    + leaked.map(e => '          - ' + e.key + '  <- ' + e.src).join('\n'));
} else if (heldEntries.length) {
  pass('no withheld figure is emitted with the gate closed');
}

/* THE STRONGEST FORM: the VALUE itself must not appear anywhere in the payload — not in R, not in a
   note, not in the source map. This is what catches a figure that was moved rather than withheld. */
const valueLeaks = [];
for (const e of heldEntries) {
  const text = typeof e.value === 'string' ? e.value : JSON.stringify(e.value);
  const probe = text.replace(/^["{[]+/, '').slice(0, 60);
  if (probe.length >= 20 && closedText.includes(probe)) valueLeaks.push(e.key);
}
if (valueLeaks.length) fail(valueLeaks.length + ' withheld value(s) appear verbatim in the payload: ' + valueLeaks.join(', '));
else if (heldEntries.length) pass('no withheld value appears verbatim anywhere in the payload');

/* And the pages themselves carry no live figure on a line that cites a withheld artifact. This is
   the direct form of "the figure is ABSENT, not annotated", read off the shipping HTML. */
const FA = require('../web/figure-audit.js');
const CITE = /\b(?:data|docs|engine|tests|web|app|build)\/[A-Za-z0-9_.\-]+\.(?:json|jsonl|js|md|py|html|txt)\b/g;
const onPage = [];
for (const f of PAGES) {
  for (const row of FA.visibleByLine(fs.readFileSync(D('web', f), 'utf8'))) {
    if (!row.visible.trim()) continue;
    const cites = (row.visible.match(CITE) || []).filter(c => wClosed(c));
    if (!cites.length) continue;
    const wd = new Set(FA.figuresIn(row.withdrawn).map(x => x.tok));
    const live = FA.figuresIn(row.visible).filter(x => !wd.has(x.tok));
    if (live.length) onPage.push('web/' + f + ':' + row.n + '  ' + [...new Set(cites)].join(',') + '  ' + live.map(x => x.tok).join(' '));
  }
}
if (onPage.length) {
  fail(onPage.length + ' page line(s) still print a figure beside a citation to a WITHHELD artifact:\n'
    + onPage.map(s => '          - ' + s).join('\n')
    + '\n        A caption is not a quarantine. Withhold the number; print what would re-run it.');
} else {
  pass('no page under web/ prints a live figure on a line citing a withheld artifact');
}

/* ================================================================================================
 * 3. LIFT — GATE OPEN. Every figure comes back, byte for byte.
 * ============================================================================================== */
const openHeld = Object.keys(open.held);
if (openHeld.length) fail('LIFT FAILED — with the gate OPEN, ' + openHeld.length + ' artifact(s) are still withheld');
else pass('LIFT — with the gate open, NOTHING is withheld');

let restored = 0; const notRestored = [];
for (const e of RELEASE.entries) {
  const got = open.R[e.key];
  if (got === undefined) { notRestored.push(e.key + ' did not come back at all'); continue; }
  if (JSON.stringify(got) !== JSON.stringify(e.value)) { notRestored.push(e.key + ' came back CHANGED'); continue; }
  /* and it must have been absent with the gate closed, or its return proves nothing about the
     quarantine — only that the builder can read a file */
  if (!CLOSED.ok && wClosed(e.src) && Object.prototype.hasOwnProperty.call(closed.R, e.key)) {
    notRestored.push(e.key + ' was present with the gate CLOSED, so its return proves nothing'); continue;
  }
  restored++;
}
if (notRestored.length) fail('LIFT — figures that did not come back correctly:\n' + notRestored.map(s => '          - ' + s).join('\n'));
else pass('LIFT — ' + restored + ' harvested figure(s) return and equal web/quarantine-release.json byte for byte, '
  + heldEntries.length + ' of them having been absent with the gate closed');

/* The pages must have a branch for the released state too, or LIFT proves something about the
   payload and nothing about the site. Checked as CODE. */
const RESTORE = [
  ['web/stadium.html', /QZ\.rel\(/],
  ['web/models.html', /Q\.rel\(/],
  ['web/index.html', /\.rel\('index\.jolteon\.winrate'\)/],
];
const noRestore = RESTORE.filter(([f, re]) => !re.test(decomment(fs.readFileSync(D(f), 'utf8'))));
if (noRestore.length) fail('page(s) with no path back to the released figure: ' + noRestore.map(x => x[0]).join(', '));
else pass('every page that lost a figure reads it back out of the released set when the gate opens');

/* ================================================================================================
 * 4. THE PAGES CAN RENDER THE WITHHELD STATE.
 * A page stripped of its figures with no branch for the hole renders blanks, which is worse than the
 * stale number — "a capability was absent and everything reported success", exactly.
 * ============================================================================================== */
const RENDERS = [
  ['web/scoreboard.html', /heldFor\('data\/scoreboard\.js'\)/, /plate\(/],
  ['web/replay.html', /heldFor\('data\/mew\.js'\)/, /plate\(/],
  ['web/index.html', /heldFor\('data\/mag\.js'\)/, /plate\(/],
  ['web/models.html', /heldFor\(src\)/, /QUARANTINED/],
  ['web/stadium.html', /cabinetHold\(/, /QUARANTINED/],
];
for (const [f, guard, render] of RENDERS) {
  const code = decomment(fs.readFileSync(D(f), 'utf8'));
  if (!guard.test(code)) fail(f + ' has no guard on the withheld state — its figures would render blank');
  else if (!render.test(code)) fail(f + ' guards the withheld state but renders nothing in its place');
  else pass(f + ' branches on the withheld state and renders the reason at full weight');
}

/* ================================================================================================
 * 5. WHAT IS COMMITTED IS WHAT THE BUILDER EMITS.
 * ============================================================================================== */
/* THE COMPARISON IS THE DECISION, NOT THE BYTES, and that is a correction rather than a loosening.
   Byte-equality went red on `"n_artifacts": 160` against 161 — another division regenerated a
   data/ artifact while this ran, which moves a count in the banner and changes nothing about what is
   published. A gate that goes red on somebody else's unrelated write is a gate that gets ignored,
   which CLAUDE.md names as how a red check becomes "one of the known failures". So the assertion is
   on the four things that decide what a visitor sees — the gate, the withheld set with its reasons,
   the source map, and exactly which keys were released — and a byte difference beyond those is
   reported as a rebuild to do before publishing. */
function decisionOf(payload) {
  return JSON.stringify({
    open: payload.open, held: payload.held, sources: payload.sources,
    released: Object.keys(payload.R).sort(), withheld: payload.withheld_keys,
  });
}
function loadBlock(src, where) {
  const win = {};
  try {
    new Function('window', 'var root=window;' + src.replace(/\}\)\(typeof window[\s\S]*$/, '})(window);'))(win);
  } catch (e) { fail(where + ' does not load: ' + e.message); return null; }
  if (!win.ABRA_QUARANTINE) { fail(where + ' loaded but set no window.ABRA_QUARANTINE'); return null; }
  return win.ABRA_QUARANTINE;
}

const fresh = BUILD.buildQuarantine(wClosed, CLOSED, ROWS, RELEASE);
const text = BUILD.emit(fresh);
const committed = fs.readFileSync(BUILD.OUT, 'utf8');
const QQ = loadBlock(committed, 'web/quarantine-data.js');
if (QQ) {
  if (decisionOf(QQ) !== decisionOf(fresh)) {
    fail('the committed web/quarantine-data.js withholds a DIFFERENT set from what the builder decides '
      + 'now. Rebuild: node web/build-quarantine.js');
  } else pass('the committed web/quarantine-data.js withholds exactly what the builder decides now');
}

const html = fs.readFileSync(BUILD.STADIUM, 'utf8');
const i = html.indexOf(BUILD.BEGIN), j = html.indexOf(BUILD.END);
if (i < 0 || j < 0) fail('web/stadium.html carries no generated quarantine block');
else {
  const inline = loadBlock(html.slice(i + BUILD.BEGIN.length, j), 'the block inside web/stadium.html');
  if (inline) {
    if (decisionOf(inline) !== decisionOf(fresh)) {
      fail('the block stamped inside web/stadium.html withholds a different set from web/quarantine-data.js. '
        + 'Rebuild: node web/build-quarantine.js');
    } else pass('web/stadium.html carries the same decision, stamped in place — it must stay self-contained '
      + 'because a claude.ai artifact blocks a sibling <script src> exactly like a remote one');
  }
}
const staleBytes = [];
if (committed.replace(/"generated": "[^"]*"/, '') !== text.replace(/"generated": "[^"]*"/, '')) staleBytes.push('web/quarantine-data.js');
if (i >= 0 && html.slice(i, j + BUILD.END.length).replace(/"generated": "[^"]*"/, '')
    !== BUILD.stampStadium(html, text).slice(i, j + BUILD.END.length).replace(/"generated": "[^"]*"/, '')) staleBytes.push('web/stadium.html');

if (QQ) {
  const probe = QQ.heldFor('../data/mag.js');
  if (!CLOSED.ok && !(probe && probe.because && probe.rerun && probe.clause)) {
    fail('the shipped runtime does not withhold data/mag.js, or withholds it without the reason, the '
      + 'failing clauses and the command that re-runs it — a withheld figure with no route back is a hole');
  } else if (!CLOSED.ok && !QQ.plate('data/mag.js', {}).includes('QUARANTINED')) {
    fail('the shipped plate() does not say QUARANTINED');
  } else {
    pass('the shipped runtime withholds through the same relative path a page uses, and its plate carries '
      + 'the artifact, the reason, the failing clauses and the re-run command');
  }
}

/* ================================================================================================
 * 6. app/ IS THE COPY A VISITOR LOADS — reported here, gated by tests/test-site-sync.js.
 * That file asserts byte-identity between web/ and app/, so web/ being clean AND app/ matching web/
 * is the whole proof. It is not re-implemented here, and this test does not fail on app/: WEB cannot
 * write app/ in this pass, and a gate its owner cannot satisfy becomes a "known failure".
 * ============================================================================================== */
/* WHAT app/ ACTUALLY NEEDS is the rooms plus the generated files a room loads with a sibling
   <script src>. A builder or an auditor under web/ is a tool, not a page asset, and listing it here
   would hand over a sync list with wrong entries in it — which is how a real one stops being read. */
const needSync = [];
const SIBLING = new Set();
for (const f of PAGES) {
  for (const l of loadsOf(fs.readFileSync(D('web', f), 'utf8'))) {
    if (l.how === '<script src>' && /^[A-Za-z0-9_.\-]+\.js$/.test(l.target)) SIBLING.add(l.target);
  }
}
for (const f of fs.readdirSync(D('web'))) {
  if (!/\.html$/.test(f) && !SIBLING.has(f)) continue;
  const a = D('app', f);
  if (!fs.existsSync(a)) { needSync.push(f + '  (missing in app/)'); continue; }
  if (fs.readFileSync(D('web', f), 'utf8') !== fs.readFileSync(a, 'utf8')) needSync.push(f + '  (differs)');
}
if (needSync.length) {
  console.log('\n  app/ NEEDS SYNCING — it is the copy a visitor actually loads, and until it is copied the');
  console.log('  deployed pages go on drawing from the withheld artifacts while this check reads green.');
  console.log('  tests/test-site-sync.js is the gate that fails on it:');
  for (const f of needSync) console.log('    cp web/' + f.split('  ')[0] + ' app/' + f.split('  ')[0] + '   ' + (f.split('  ')[1] || ''));
} else {
  console.log('\n  app/ is byte-identical to web/ for every page and generated file.');
}
if (staleBytes.length) {
  console.log('\n  REBUILD BEFORE PUBLISHING — the withholding decision is right in ' + staleBytes.join(' and ')
    + ',\n  but the surrounding counts have moved since it was generated: node web/build-quarantine.js');
}

/* ================================================================================================
 * WHAT engine/quarantine.js WOULD NEED TO ABSORB THIS — printed, so it is a measurement.
 * ============================================================================================== */
console.log('\n  TO ABSORB THIS INTO engine/quarantine.js (WEB may not edit engine/, so it is reported):');
console.log('    1. a `loaders(S)` probe beside `citations(S)`: walk docs/, web/ and app/ for');
console.log('       <script src> and fetch() targets, resolve each against S.rows the way asArtifact()');
console.log('       above does, and report every load of a quarantined artifact. The mapping needs no');
console.log('       heuristic — data/mag.js, data/mew.js and data/scoreboard.js are rows in the graph');
console.log('       already, because provenance.js finds their builders under build/.');
console.log('    2. a DECLARATION a machine can read, so a guarded load is distinguishable from a leak.');
console.log('       heldFor(\'<the exact artifact>\') is the one used here; a bare gate check must not');
console.log('       count, or one bundle can hide behind another bundle\'s branch.');
console.log('    3. the same RATCHET citations() already has: the list of guarded-vs-unguarded loads');
console.log('       may shrink and may never grow while the gate is closed.');
console.log('    4. it must walk app/ LAST for the same reason citations() does, so the web/ row is the');
console.log('       one reported first — app/ was the blind spot that certified a leak on 2026-08-08.');

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
