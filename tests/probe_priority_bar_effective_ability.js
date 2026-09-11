#!/usr/bin/env node
/* tests/probe_priority_bar_effective_ability.js — ROADMAP #412.
 * ==================================================================================================
 * IS THE PRIORITY BAR'S DEFENDER LIST BUILT FROM THE EFFECTIVE ABILITY IN BOTH FILES THAT BUILD IT?
 *
 * `priorityRefusedAbove()` exists twice. engine/board.js resolves the defender's ability through
 * `effAbility(f.mon, dex)`; engine/position_features.js reads `f.mon.ability || e.ability` raw (line
 * 249). One fact, two implementations. tests/test-effective-identity.js's runtime tripwire FOUND the
 * raw read on its first run and is green only because its `RUNTIME_ALLOWED` list declares that exact
 * line. The row's own words: the instrument owed is that test with the entry deleted.
 *
 * SO THIS RUNS EXACTLY THAT, WITHOUT EDITING IT. The test's source is read, the one RUNTIME_ALLOWED
 * object naming engine/position_features.js is cut out in memory (a string-aware brace match, printed
 * before it is used), and the result is run as the MAIN module in a child through a `-r` preload that
 * substitutes the source at compile time under the test's real filename — so every relative require,
 * `__dirname` and `require.main` behave as in a normal run.
 *
 *   CONTROL   the unmodified source through the same preload must exit 0. If it does not, the test
 *             is red for another reason and nothing below can be attributed.
 *   RED ARM   the stripped source must exit 0 too. Red names the FAIL line that cites
 *             engine/position_features.js.
 *
 * EXPOSURE IS ZERO AND THIS DOES NOT PRETEND OTHERWISE: no legal mega gains or loses a blocksMove
 * ability (the entry's own guard re-derives that on every run), so no legal board can show the two
 * functions disagreeing. This row is a code-structure defect, and the tripwire is its decider.
 *
 * FROZEN BYTES. The test loads the LIVE engine/board.js and engine/position_features.js; the probe
 * refuses unless both are byte-identical to release 2b5a6585d8cf's copies.
 * EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', '2b5a6585d8cf');
const TEST = path.join(ROOT, 'tests', 'test-effective-identity.js');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

console.log('\ntests/probe_priority_bar_effective_ability.js — ROADMAP #412');
let REL;
try { REL = require(path.join(ROOT, 'engine', 'engine_release.js')).open(REL_ID); } catch (e) { cannot('release ' + REL_ID + ' would not open: ' + e.message); }
for (const f of ['engine/position_features.js', 'engine/board.js']) {
  const live = sha(fs.readFileSync(path.join(ROOT, f))), rel = sha(Buffer.from(REL.read(f)));
  console.log('  ' + f.padEnd(30) + ' live ' + live + '   release ' + REL.id + ' ' + rel);
  if (live !== rel) cannot(f + ' in the live tree differs from release ' + REL.id + ', so the test would not measure the frozen bytes');
}

/* ---- cut the one entry, string-aware -------------------------------------------------------- */
const src = fs.readFileSync(TEST, 'utf8');
const anchor = src.indexOf("file: 'engine/position_features.js'");
if (anchor < 0) cannot('RUNTIME_ALLOWED no longer names engine/position_features.js — the entry is gone; run tests/test-effective-identity.js itself');
function matchBrace(s, open) {
  let depth = 0, i = open, q = null;
  for (; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && n === '/') { i = s.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && n === '*') { i = s.indexOf('*/', i + 2) + 1; if (i <= 0) return -1; continue; }
    if (c === '\'' || c === '"' || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
const open = src.lastIndexOf('{', anchor);
const close = matchBrace(src, open);
if (open < 0 || close < 0) cannot('could not bound the RUNTIME_ALLOWED entry by braces');
let end = close + 1;
while (/[\s,]/.test(src[end]) && src[end] !== '\n') end++;
const cut = src.slice(open, end);
if (!/file: 'engine\/position_features\.js'/.test(cut) || /file: 'engine\/board\.js'/.test(cut))
  cannot('the bounded text is not exactly the one entry:\n' + cut.slice(0, 300));
const stripped = src.slice(0, open) + src.slice(end);
console.log('  cut ' + cut.length + ' chars, lines ' + (src.slice(0, open).split('\n').length) + '-' + (src.slice(0, close).split('\n').length)
  + ' of tests/test-effective-identity.js: ' + cut.split('\n')[0].trim() + ' ' + cut.split('\n')[1].trim().slice(0, 60));

/* ---- run it as main, with the source substituted at compile time ---------------------------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-412-'));
const PRE = path.join(TMP, 'substitute.js');
fs.writeFileSync(PRE, [
  "const M = require('module'); const fs = require('fs'); const path = require('path');",
  "const real = path.resolve(process.env.ABRA_REAL); const alt = process.env.ABRA_ALT;",
  "const orig = M.prototype._compile;",
  "M.prototype._compile = function (content, filename) {",
  "  if (alt && path.resolve(filename) === real) content = fs.readFileSync(alt, 'utf8');",
  "  return orig.call(this, content, filename); };"].join('\n'));
function run(tag, text) {
  const alt = path.join(TMP, tag + '.js'); fs.writeFileSync(alt, text);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['-r', PRE, TEST], { cwd: ROOT, encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 28,
    env: { ...process.env, ABRA_REAL: TEST, ABRA_ALT: alt,
           SHOWDOWN_PATH: process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown' } });
  const out = (r.stdout || '') + (r.stderr || '');
  return { status: r.status, s: Math.round((Date.now() - t0) / 1000), out,
           tally: (out.match(/EFFECTIVE IDENTITY TESTS: \d+ passed, \d+ failed/) || ['(no tally)'])[0],
           fails: out.split(/\r?\n/).filter(l => /^\s*FAIL\b/.test(l)) };
}
const ctl = run('control', src);
console.log('\n  CONTROL — unmodified source through the same preload: exit ' + ctl.status + ' in ' + ctl.s + 's, ' + ctl.tally);
if (ctl.status !== 0) {
  for (const f of ctl.fails.slice(0, 5)) console.log('      ' + f.trim().slice(0, 160));
  cannot('the unmodified test is not green, so a red with the entry removed could not be attributed');
}
const red = run('stripped', stripped);
console.log('  RED ARM — the position_features entry removed: exit ' + red.status + ' in ' + red.s + 's, ' + red.tally);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + TMP + ')'); }

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const cites = red.fails.filter(l => /position_features/.test(l)).concat(red.out.split(/\r?\n/).filter(l => /position_features\.js/.test(l) && !/^\s*ok\b/.test(l))).slice(0, 3);
ok(red.status === 0, 'the effective-identity tripwire is green with no exception declared for engine/position_features.js',
   red.status === 0 ? null : 'cell: engine/position_features.js:249 priorityRefusedAbove() reads `f.mon.ability || e.ability` raw; '
     + 'the tripwire reports it once the allowlist stops declaring it:\n' + (cites.map(l => '  ' + l.trim().slice(0, 170)).join('\n') || '  (no line cited it — read the run)'));

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
