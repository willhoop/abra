#!/usr/bin/env node
/* tests/probe_open_defect_marker_debt.js — ROADMAP #350.
 * ==================================================================================================
 * DOES THE OPEN-DEFECT CLAUSE CALL A ROW "NO INSTRUMENT DECIDES IT" WHEN THE ROW NAMES ONE AND THE
 * VERDICT ARTIFACT SIMPLY HAS NOT CAUGHT UP?
 *
 * `openDefectClause` (engine/quarantine.js) sends every open breakage row with no verdict in
 * data/register-reality.json to `debt`, whose line reads "assert breakage with NO instrument that
 * decides them". A row that carries a `VERIFIED BY:` marker the artifact has not yet run is not that:
 * it NAMES an instrument and has no verdict. The row asks for the two to be split, and for the clause
 * to say STALE when the verdict artifact is older than docs/ROADMAP.md.
 *
 * THE CLAUSE IS DRIVEN, NOT REIMPLEMENTED. `fs.readFileSync` is intercepted for exactly two paths —
 * docs/ROADMAP.md and data/register-reality.json — and the real `openDefectClause()` is called on the
 * fixtures. Nothing else in the process sees a changed file, and nothing is written.
 *
 *   CELL 1  a fixture row carrying `VERIFIED BY: \`node ...\`` with no verdict must not land in the
 *           bucket whose sentence says no instrument decides it.
 *   CELL 2  a verdict artifact stamped 2000-01-01 against the live ROADMAP's mtime must be reported
 *           as older than the register.
 *   CONTROL a fixture row with NO marker must land in `debt` (the clause's correct answer for it),
 *           and an artifact stamped in the future must NOT be called stale.
 *
 * Reads the LIVE engine/quarantine.js — this row is about that file, not about the simulator, so no
 * release applies. EXIT: 0 green / 1 red / 2 cannot answer. Plays no game.
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

const MARKED = 9101, BARE = 9102;
const ROADMAP = [
  '# fixture register', '',
  '| # | title | status |', '|---|---|---|',
  '| #' + MARKED + ' | **FIXTURE — A ROW THAT NAMES ITS INSTRUMENT.** The defect is real and a check exists. VERIFIED BY: `node tests/probe_fixture_not_yet_run.js` | open — engine DEFECT (fixture) |',
  '| #' + BARE + ' | **FIXTURE — A ROW THAT NAMES NOTHING.** The defect is asserted and no check exists. | open — engine DEFECT (fixture) |',
  ''].join('\n');
function run(generated) {
  FIX = { roadmap: ROADMAP, rr: JSON.stringify({ generated, results: [] }) };
  try { return Q.openDefectClause(); } finally { FIX = null; }
}

console.log('\ntests/probe_open_defect_marker_debt.js — ROADMAP #350');
const roadmapMtime = fs.statSync(path.join(ROOT, 'docs', 'ROADMAP.md')).mtime.toISOString();
const OLD = run('2000-01-01T00:00:00.000Z');
const NEW = run('2999-01-01T00:00:00.000Z');
const nums = a => (a || []).map(r => +r.n);
if (!nums(OLD.open).includes(MARKED) || !nums(OLD.open).includes(BARE))
  cannot('the fixture rows were not read as open breakage rows (open: ' + JSON.stringify(nums(OLD.open)) + ') — the plant did not reach the clause');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const buckets = r => Object.entries(r).filter(([k, v]) => Array.isArray(v) && k !== 'open' && k !== 'excused'
  && v.some(x => x && (+x.n === MARKED))).map(([k]) => k);

console.log('\n  CONTROL');
ok(nums(OLD.debt).includes(BARE), '#' + BARE + ' (no marker) lands in debt — the clause\'s right answer for it');
ok(!/STALE|older than|predates/i.test(NEW.why), 'a verdict artifact stamped in the future is not called stale');

console.log('\n  THE CELLS');
const inDebt = nums(OLD.debt).includes(MARKED);
const homes = buckets(OLD);
const _di = OLD.why.search(/\d+ open row\(s\) assert breakage with NO instrument/);
const debtSentence = _di >= 0 ? OLD.why.slice(_di, _di + 150) : '(no debt sentence found)';
ok(!inDebt || homes.some(k => k !== 'debt'),
   'a row that NAMES an instrument with no verdict is not filed as naming none',
   'cell: #' + MARKED + ' carries `VERIFIED BY: node tests/probe_fixture_not_yet_run.js` and lands only in '
     + JSON.stringify(homes) + ', under the sentence: ' + debtSentence.slice(0, 140));
ok(/STALE|older than|predates/i.test(OLD.why),
   'a verdict artifact older than docs/ROADMAP.md is reported as such',
   'cell: register-reality generated 2000-01-01T00:00:00Z against ROADMAP mtime ' + roadmapMtime
     + '; the clause printed no staleness (verdicts_generated=' + OLD.verdicts_generated + ')');

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
