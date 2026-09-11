#!/usr/bin/env node
/* tests/probe_open_defect_refusal_holds.js — ROADMAP #380, halves (2) and (3).
 * ==================================================================================================
 * DOES AN OPEN ROW WHOSE INSTRUMENT REFUSED HOLD THE OPEN-DEFECT CLAUSE — AND IS "WHAT DOES THIS
 * EXIT CODE MEAN" DECIDED IN ONE PLACE?
 *
 * (2) `openDefectClause` computes `ok: withRed.length === 0`. A row whose instrument ran and declared
 *     CANNOT-ANSWER (`green: null`) goes to `unrunnable` and stops holding the clause at all. The row
 *     asks for `ok: false, cannot_answer: true` — the rule `orderProbeClause` in the same file already
 *     follows: a clause that cannot be computed FAILS.
 *     Driven, not reimplemented: `fs.readFileSync` is intercepted for docs/ROADMAP.md and
 *     data/register-reality.json only, and the real clause is called on fixtures.
 *       RED ARM   one open breakage row, its instrument `green: null` (declared CANNOT-ANSWER)
 *       CONTROL   the same row with `green: false` must give ok:false (proves the plant reaches the
 *                 clause), and with `green: true` must give ok:true.
 *
 * (3) One classifier. `engine/register_reality.js` owns `classifyExit`; `tests/run-all.js` keeps its
 *     own exit-2-is-SKIP reading. This half is STRUCTURAL and says so: it asserts run-all.js requires
 *     the shared classifier. There is no outcome to stage for "two implementations exist" — the
 *     outcome is the day they disagree, which is what the row exists to prevent.
 *
 * Half (1), the sentence, is fixed ("ASKED AND ANSWERED NOTHING USABLE"); its line is printed as
 * context. Reads the LIVE engine/quarantine.js. EXIT: 0 green / 1 red / 2 cannot answer. No game.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };

const realRead = fs.readFileSync;
let FIX = null;
fs.readFileSync = function (p, ...rest) {
  const s = String(p).replace(/\\/g, '/');
  if (FIX && s.endsWith('/docs/ROADMAP.md')) return FIX.roadmap;
  if (FIX && s.endsWith('/data/register-reality.json')) return FIX.rr;
  return realRead.call(fs, p, ...rest);
};
let Q;
const log = console.log;
try { console.log = () => {}; Q = require(path.join(ROOT, 'engine', 'quarantine.js')); }
catch (e) { console.log = log; cannot('engine/quarantine.js would not load: ' + String(e && e.message || e)); }
finally { console.log = log; }
if (typeof Q.openDefectClause !== 'function') cannot('engine/quarantine.js no longer exports openDefectClause');

const N = 9201;
const CMD = 'node tests/probe_fixture_refuses.js';
const ROADMAP = ['# fixture register', '', '| # | title | status |', '|---|---|---|',
  '| #' + N + ' | **FIXTURE — A DEFECT WHOSE INSTRUMENT DECLARED IT COULD NOT ANSWER.** VERIFIED BY: `' + CMD + '` | open — engine DEFECT (fixture) |', ''].join('\n');
function run(verdict) {
  FIX = { roadmap: ROADMAP, rr: JSON.stringify({ generated: new Date().toISOString(),
    results: [Object.assign({ n: N, title: 'fixture', closed: false, saysBroken: true, cmd: CMD, owed: null }, verdict)] }) };
  try { return Q.openDefectClause(); } finally { FIX = null; }
}

console.log('\ntests/probe_open_defect_refusal_holds.js — ROADMAP #380 (2) and (3)');
const RED = run({ green: false, kind: 'VERDICT-RED', declared: 'VERDICT-RED', why: 'exit 1', verdict: 'CONFIRMED' });
const GRN = run({ green: true, kind: 'VERDICT-GREEN', declared: null, why: 'exit 0', verdict: 'STALE ROW' });
const REF = run({ green: null, kind: 'CANNOT-ANSWER', declared: 'CANNOT-ANSWER', why: 'exit 2 — declared CANNOT-ANSWER', verdict: 'INSTRUMENT REFUSED' });
if (!(RED.open || []).some(r => +r.n === N)) cannot('the fixture row was not read as an open breakage row — the plant did not reach the clause');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
console.log('\n  CONTROL — the same fixture row under a red and a green verdict:');
ok(RED.ok === false, 'green:false  -> ok false (withRed ' + (RED.withRed || []).length + ')');
ok(GRN.ok === true, 'green:true   -> ok true (staleRows ' + (GRN.staleRows || []).length + ')');

console.log('\n  CELL (2) — the instrument ran and declared CANNOT-ANSWER:');
console.log('      bucketed as: ' + Object.entries(REF).filter(([k, v]) => Array.isArray(v) && k !== 'open' && v.some(x => +x.n === N)).map(([k]) => k).join(', '));
const _ui = REF.why.search(/\d+ open row\(s\) name an instrument that (WAS ASKED AND ANSWERED NOTHING USABLE|WOULD NOT RUN)/);
const uLine = _ui >= 0 ? REF.why.slice(_ui, _ui + 130) : '';
if (uLine) console.log('      (1) context, the fixed sentence: ' + uLine.slice(0, 120));
ok(REF.ok === false && REF.cannot_answer === true,
   'an open breakage row whose instrument refused holds the clause as CANNOT-ANSWER',
   'cell: #' + N + ' green:null -> ok=' + REF.ok + ', cannot_answer=' + REF.cannot_answer
     + ' — the row moved to `unrunnable` and stopped holding the clause');

console.log('\n  CELL (3) — one exit classifier (STRUCTURAL):');
const runAll = realRead.call(fs, path.join(ROOT, 'tests', 'run-all.js'), 'utf8');
const rr = realRead.call(fs, path.join(ROOT, 'engine', 'register_reality.js'), 'utf8');
const rrExports = /module\.exports\s*=\s*\{[^}]*\bclassifyExit\b/.test(rr) || /exports\.classifyExit\s*=/.test(rr);
const runAllImports = /require\([^)]*register_reality[^)]*\)/.test(runAll) && /classifyExit/.test(runAll);
console.log('      engine/register_reality.js exports classifyExit: ' + rrExports);
console.log('      tests/run-all.js requires it:                   ' + runAllImports);
ok(runAllImports, 'tests/run-all.js reads exit codes through the shared classifier',
   'cell: tests/run-all.js carries its own exit-2-is-SKIP reading and never requires engine/register_reality.js\'s classifyExit');

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
