#!/usr/bin/env node
/* THE WRITER SCAN'S OWN BLIND SPOT — pinned, because it is invisible in its own output.
 *
 * `engine/provenance.js` decides whether a number on disk may be quoted. It does that by finding the
 * artifact's WRITER and comparing the artifact to what that writer read. An artifact whose writer it
 * cannot find used to be reported as a NAME on a list and nothing else: no row, no reason, no way for
 * a consumer to tell "this file is fine" from "this file was never examined".
 *
 * `engine/quarantine.js` then computed its unclassified set by SUBTRACTION — every file in data/ that
 * the graph has no row for — and printed a sentence explaining the gap that had been false since
 * 2026-08-09 ("provenance.js finds a writer only in engine/ and build/"; it has scanned tests/ since
 * ROADMAP #105). A gap described by prose beside a tool is the exact failure CLAUDE.md keeps naming.
 *
 * So this test asserts the structural property, not a count:
 *
 *   1. EVERY file in data/ that is subject to the audit has a ROW. Attributed or explicitly unknown —
 *      never absent. An artifact missing from the report is the bug; an artifact present and marked
 *      unknown is the fix.
 *   2. EVERY unknown row carries a DERIVED reason. "We could not find a writer" is not a reason;
 *      "nothing in engine/build/tests names this file at all" is.
 *   3. The two tools agree. quarantine.js's unclassified set must be exactly provenance.js's unknown
 *      set — the second tool must not grow its own answer by subtraction.
 *   4. The false-attribution direction still holds. data/engine-release.json is written by
 *      engine/engine_release.js through a same-file helper; tests/test-miltank-release.js writes the
 *      same BASENAME into a scratch tree as a fixture. The scratch write must never win.
 *
 * Shown RED on all four before the discovery change landed. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const fails = [];
const ok = [];
const T = (cond, name, detail) => (cond ? ok : fails).push(name + (cond ? '' : '  — ' + detail));

function graph() {
  const out = execFileSync(process.execPath, [D('engine', 'provenance.js'), '--graph', '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

const rows = graph();
const byFile = new Map(rows.map(r => [r.file, r]));

/* THE SUBJECT SET IS DERIVED THE SAME WAY BOTH TOOLS DERIVE IT, so this test cannot pass by
 * disagreeing with them about what an artifact is. Game stores and run sidecars are excluded for the
 * reasons those tools already state; everything else in data/ is in scope. */
const subject = fs.readdirSync(D('data'))
  .filter(f => /\.(json|js)$/.test(f) && !/^games\./.test(f) && !/\.meta\.json$/.test(f));

/* 1 — no artifact is silently absent. */
const absent = subject.filter(f => !byFile.has(f));
T(absent.length === 0, 'every artifact in data/ has a row in the graph',
  absent.length + ' have NO row at all: ' + absent.slice(0, 8).join(', '));

/* 2 — an unknown row is an ANSWER, not a shrug. */
const unknowns = rows.filter(r => r.unknown);
const mute = unknowns.filter(r => !r.why || String(r.why).trim().length < 20);
T(unknowns.length === 0 || mute.length === 0, 'every unknown row carries a derived reason',
  mute.length + ' unknown rows say nothing: ' + mute.map(r => r.file).slice(0, 6).join(', '));

/* 2b — an unknown row must not be mistaken for an attributed one by a consumer reading `by`. */
const contradictory = unknowns.filter(r => r.by);
T(contradictory.length === 0, 'an unknown row names no writer',
  contradictory.map(r => r.file + ' -> ' + r.by).join(', '));

/* 3 — the two tools agree about the unknown set. quarantine.js must READ this, not re-derive it. */
let qUnknown = null;
try { qUnknown = (require('../engine/quarantine.js').state().unclassified || []).slice().sort(); }
catch (e) { qUnknown = null; console.log('  (quarantine.js state() threw: ' + e.message + ')'); }
if (qUnknown) {
  const pUnknown = unknowns.map(r => r.file).sort();
  const onlyQ = qUnknown.filter(f => !pUnknown.includes(f));
  const onlyP = pUnknown.filter(f => !qUnknown.includes(f));
  T(!onlyQ.length && !onlyP.length, 'quarantine.js and provenance.js name the same unknown set',
    'only quarantine: [' + onlyQ.join(', ') + ']  only provenance: [' + onlyP.join(', ') + ']');
} else {
  fails.push('quarantine.js state() did not emit an unclassified set this test could read');
}

/* 4 — the scratch-tree fixture must never outrank the real writer. */
const rel = byFile.get('engine-release.json');
T(rel && rel.by === 'engine/engine_release.js', 'data/engine-release.json is attributed to its writer',
  rel ? 'attributed to ' + (rel.by || 'NOBODY (' + rel.why + ')') : 'no row');

console.log('PROVENANCE DISCOVERY');
for (const s of ok) console.log('  ok    ' + s);
for (const s of fails) console.log('  FAIL  ' + s);
console.log(`\n  ${rows.length} rows, ${unknowns.length} of them explicitly unknown, ${subject.length} files in scope`);
if (fails.length) { console.log('\n  ' + fails.length + ' FAILED'); process.exit(1); }
console.log('\n  all clear');
