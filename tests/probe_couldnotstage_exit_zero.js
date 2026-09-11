#!/usr/bin/env node
/* tests/probe_couldnotstage_exit_zero.js — ROADMAP #524, the instrument the row says is owed.
 * ==================================================================================================
 * DOES ANY PROBE PRINT A STAGING REFUSAL AND THEN EXIT ZERO?
 *
 * `engine/register_reality.js`'s `classifyExit` reads exit 0 as VERDICT-GREEN unless the output
 * declares otherwise (engine/register_reality.js:512-520). So a probe that prints `COULD-NOT-STAGE`
 * and then calls `process.exit(0)` publishes a claim about its FIXTURE as a clean bill of health for
 * the MECHANIC, and a closed row reads CONFIRMED on it. The row counted 12 such paths in 4 files on
 * 2026-08-28; this probe re-derives the count every run and names each site.
 *
 * WHAT IT SCANS. Every `tests/probe_*.js` except this file. A SITE is a line carrying the refusal
 * word followed, within LOOKAHEAD lines, by a literal exit-zero call, with no `ABRA-EXIT` declaration
 * of a non-zero code between them. The needles are assembled from pieces so this file cannot match
 * itself.
 *
 * THE CONTROL IS A CONVERTED SITE, READ BY THE SAME SCANNER. `tests/probe_hazard_recap_fail.js`
 * carries one refusal path that exits 0 and one that was converted to `ABRA-EXIT 2 CANNOT-ANSWER` +
 * `exit(2)`. The converted one must NOT be flagged, or the scanner is just grepping a word. Checked
 * by name below; if that file changes shape the control is re-derived from any file carrying a
 * converted refusal.
 *
 * PLANT (so a fixed tree can be shown green-then-red): `--plant` appends a synthetic source with an
 * unconverted refusal to the scanned set. With every real site converted, the plant alone must turn
 * this probe red.
 *
 * EXIT: 0 no site (VERDICT-GREEN); 1 one or more sites (VERDICT-RED); 2 the scan could not run.
 * Plays no game. Reads only files.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SELF = path.basename(__filename);
const LOOKAHEAD = 4;

const WORD = 'COULD-NOT' + '-STAGE';
const EXIT0 = new RegExp('process\\.exit\\(\\s*' + '0' + '\\s*\\)');
const EXITN = /process\.exit\(\s*[1-9]\d*\s*\)|process\.exit\(\s*[A-Za-z_]/;
const DECL_NONZERO = /ABRA-EXIT\s+[1-9]/;

function scan(name, src) {
  const L = src.replace(/\r/g, '').split('\n');
  const sites = [], converted = [];
  for (let i = 0; i < L.length; i++) {
    if (!L[i].includes(WORD)) continue;
    let decl = false;
    for (let j = i; j < Math.min(L.length, i + 1 + LOOKAHEAD); j++) {
      if (DECL_NONZERO.test(L[j])) decl = true;
      if (EXIT0.test(L[j])) { if (!decl) sites.push({ file: name, word: i + 1, exit: j + 1 }); break; }
      if (EXITN.test(L[j])) { converted.push({ file: name, word: i + 1, exit: j + 1 }); break; }
    }
  }
  return { sites, converted };
}

let files;
try {
  files = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => /^probe_.*\.js$/.test(f) && f !== SELF).sort();
} catch (e) {
  console.log('CANNOT ANSWER — tests/ is unreadable: ' + e.message);
  console.log('ABRA-EXIT 2 CANNOT-ANSWER');
  process.exit(2);
}

console.log('\ntests/probe_couldnotstage_exit_zero.js — ROADMAP #524');
console.log('  scanning ' + files.length + ' tests/probe_*.js for a `' + WORD + '` print followed within '
  + LOOKAHEAD + ' lines by an undeclared exit-zero');

const allSites = [], allConverted = [];
for (const f of files) {
  const r = scan('tests/' + f, fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8'));
  allSites.push(...r.sites); allConverted.push(...r.converted);
}
if (process.argv.includes('--plant')) {
  const planted = ["if (!ok) {", "  console.log('" + WORD + " — planted');", "  process.exit(" + "0);", "}"].join('\n');
  const r = scan('(planted source)', planted);
  console.log('  --plant: one synthetic unconverted refusal added to the scanned set');
  allSites.push(...r.sites);
}

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

/* THE CONTROL FIRST: the scanner must see a converted refusal as converted. */
const ctlFile = 'tests/probe_hazard_recap_fail.js';
const ctl = allConverted.filter(c => c.file === ctlFile);
const ctlAny = ctl.length ? ctl : allConverted;
console.log('\n  CONTROL — refusals that exit non-zero (converted): ' + allConverted.length + ' site(s) in '
  + new Set(allConverted.map(c => c.file)).size + ' file(s)');
for (const c of ctlAny.slice(0, 4)) console.log('      ' + c.file + ':' + c.word + ' -> exit at line ' + c.exit);
if (!ctlAny.length) {
  console.log('  CANNOT ANSWER — no converted refusal exists anywhere, so the scanner has no control and a');
  console.log('  zero below would not distinguish "fixed" from "the scanner matches nothing".');
  console.log('ABRA-EXIT 2 CANNOT-ANSWER');
  process.exit(2);
}

console.log('\n  THE CELLS — each is a refusal published as a pass:');
for (const s of allSites) console.log('      ' + s.file + ':' + s.word + '  prints ' + WORD + ', exits 0 at line ' + s.exit);
const byFile = allSites.reduce((m, s) => (m[s.file] = (m[s.file] || 0) + 1, m), {});
ok(allSites.length === 0,
   'no probe publishes a staging refusal at exit 0',
   allSites.length ? allSites.length + ' site(s) in ' + Object.keys(byFile).length + ' file(s): '
     + Object.entries(byFile).map(([f, n]) => f + ' x' + n).join(', ')
     + '\n  first cell: ' + allSites[0].file + ':' + allSites[0].word + ' -> process.exit(0) at line ' + allSites[0].exit
     + '. Fix per site: print `ABRA-EXIT 2 CANNOT-ANSWER` and exit 2 (the arrangement at '
     + ctlAny[0].file + ':' + ctlAny[0].word + ').' : null);

console.log('\n' + (bad ? 'RED — ' + allSites.length + ' refusal path(s) exit 0' : 'GREEN — every refusal path exits non-zero'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
