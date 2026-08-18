/* register_reality.js — THE REGISTER IS AN ARTIFACT, AND NOTHING WAS CHECKING IT AGAINST REALITY.
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * Every other artifact in this repository has something that compares it to its source.
 * `engine/provenance.js` compares an artifact to the files it declares it read. `engine/artifact_audit.js`
 * compares a generated file to the source values it was built from. `engine/quarantine.js` compares a
 * printed figure to whether its generator is downstream of a simulator we know is wrong.
 *
 * `docs/ROADMAP.md` had NOTHING. A row is a sentence a person typed, and the ONLY test applied to it
 * was whether some later person remembered to type a different sentence. That is prose, and this
 * repository's whole opening argument is what prose is worth here: fourteen stale handoffs, a
 * hand-maintained ban list of four, an auto-commit paragraph kept twelve days past its subject.
 *
 * THE COST IS MEASURED, NOT SUSPECTED. In one session on 2026-08-14 four rows turned out to be stale
 * rather than live — #279 claimed a guaranteed-crit damage error that `dmgRange` already got right and
 * had been RANKED FIRST OF FOURTEEN as the place to start; #244 had been fixed since 2026-08-13 with
 * nobody flipping the row; two of #273's eight FAILs probed abilities with no legal carrier in this
 * regulation; #266 said 41 illegal declarations against a true 32. On 2026-08-15 the audit of the
 * seven rows the MEDICHAM gate was counting found ONE fully closed (#273 — 200 demonstrations, 0
 * failed, and filed as red) and two matched only by a prose fallback reading a metaphor and a
 * description of an already-repaired bug.
 *
 * **A ROW THAT OVERSTATES ITS SCOPE COSTS A WHOLE AGENT, WHICH IS MORE THAN THE DEFECT IT NAMES.**
 * And because `quarantine.js` reads the open count as a GATE INPUT, a stale row holds the gate shut on
 * a defect that no longer exists — the gate then reports something untrue in the direction that gets
 * gates ignored, which is the exact failure `openDefectClause` was narrowed to prevent.
 *
 * ================= WHAT IT DOES ====================================================================
 *
 * A row may name the instrument that decides it:
 *
 *     VERIFIED BY: `node tests/test-fixture-legality.js`
 *
 * This file finds every such row, RUNS the command, and compares the exit code to the row's status:
 *
 *   STALE ROW        the row is OPEN and its instrument is GREEN. The register overstates. Loudest
 *                    verdict here, because it is the one that costs an agent.
 *   PREMATURE CLOSE  the row is CLOSED and its instrument is RED. The register understates.
 *   CONFIRMED        open + red, or closed + green. The row and the world agree.
 *   UNVERIFIABLE     no marker. Counted and named, never hidden — the coverage figure IS the honest
 *                    measure of how much of this register is still prose.
 *
 * ================= WHAT IT DELIBERATELY DOES NOT DO ================================================
 *
 * It does not guess. A row with no marker is reported as unverifiable, not as fine and not as
 * suspicious. Inferring an instrument from a row's prose would be the same vocabulary-matching that
 * put a metaphor into a gate; #148 has been paid for three times in one detector already.
 *
 * It is not the closed-detector. `roadmapRowIsClosed` is imported from `quarantine.js`, never copied:
 * CLAUDE.md's rule is that two files deciding the same fact will disagree eventually and the
 * disagreement will be invisible because both keep working.
 *
 * An exit code is a weaker oracle than a re-derivation, and that is stated rather than glossed: a
 * green instrument means THAT instrument sees nothing, not that the row's claim is false. It is
 * nevertheless strictly more than the register had, which was nothing at all.
 *
 *   node engine/register_reality.js            # run every marked row
 *   node engine/register_reality.js --list     # coverage only; runs nothing
 *   node engine/register_reality.js --json
 *   node engine/register_reality.js --selftest # every verdict on synthetic input, red and green
 *
 * Exit 1 on any STALE ROW or PREMATURE CLOSE. Runs no games. Writes one artifact. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'register-reality.json');
const Q = require('./quarantine.js');

const has = (f) => process.argv.includes(f);
const TIMEOUT_MS = 10 * 60 * 1000;

/* THE MARKER IS UPPERCASE AND FENCED, so it is visible to a human reading the table and cannot be
 * produced by ordinary prose. The command must start with `node ` and name a path inside the
 * repository: this file executes what it finds, and a register anybody can edit is not a place to
 * accept an arbitrary shell string. Refused loudly rather than skipped — a marker that silently does
 * nothing is worse than no marker, because it reads as coverage. */
const MARKER = /VERIFIED BY:\s*`([^`]+)`/;
const SAFE = /^node\s+((?:engine|tests|build)[\\/][A-Za-z0-9_.\-]+\.js)((?:\s+--[A-Za-z0-9_\-=]+)*)\s*$/;

function parse(lines) {
  const rows = [];
  for (const l of lines) {
    const m = l.match(/^\|\s*#(\d+)\s*\|\s*\*\*(.{0,140})/);
    if (!m) continue;
    const mk = l.match(MARKER);
    rows.push({
      n: +m[1],
      title: m[2].replace(/\s+/g, ' ').slice(0, 90),
      closed: Q.roadmapRowIsClosed(l),
      saysBroken: Q.roadmapRowSaysBroken(l),
      cmd: mk ? mk[1].trim() : null,
    });
  }
  return rows;
}

/* THE VERDICT TABLE, EXTRACTED SO THE SELFTEST DRIVES THE SHIPPING FUNCTION RATHER THAN A RESTATEMENT
 * OF IT. `green` is a tri-state: true, false, or null when the instrument could not be run at all —
 * and null is NOT green. An instrument that will not start says nothing about the row, and calling
 * that agreement is the "a capability was absent and everything reported success" shape. */
function verdict(row, green) {
  if (!row.cmd) return 'UNVERIFIABLE';
  if (green === null) return 'INSTRUMENT UNRUNNABLE';
  if (!row.closed && green) return 'STALE ROW';
  if (row.closed && !green) return 'PREMATURE CLOSE';
  return 'CONFIRMED';
}
const BAD = new Set(['STALE ROW', 'PREMATURE CLOSE', 'INSTRUMENT UNRUNNABLE']);

function run(cmd) {
  const m = cmd.match(SAFE);
  if (!m) return { green: null, why: 'the marker is not a plain `node <repo script>.js [--flags]` command, so it was NOT run' };
  const args = [path.join(ROOT, m[1])].concat((m[2] || '').trim() ? m[2].trim().split(/\s+/) : []);
  const t0 = Date.now();
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: TIMEOUT_MS });
    return { green: true, why: 'exit 0', ms: Date.now() - t0 };
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.killed))
      return { green: null, why: 'the instrument could not be run: ' + String(e.message).split('\n')[0], ms: Date.now() - t0 };
    return { green: false, why: 'exit ' + (e && e.status), ms: Date.now() - t0 };
  }
}

if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const R = (closed, cmd) => ({ n: 1, title: 't', closed, saysBroken: true, cmd });
  const C = 'node tests/x.js';
  ok('RED — an OPEN row whose instrument is GREEN is a STALE ROW, the case that costs an agent',
    verdict(R(false, C), true) === 'STALE ROW', verdict(R(false, C), true));
  ok('RED — a CLOSED row whose instrument is RED is a PREMATURE CLOSE',
    verdict(R(true, C), false) === 'PREMATURE CLOSE', verdict(R(true, C), false));
  ok('an OPEN row with a RED instrument is CONFIRMED', verdict(R(false, C), false) === 'CONFIRMED');
  ok('a CLOSED row with a GREEN instrument is CONFIRMED', verdict(R(true, C), true) === 'CONFIRMED');
  ok('a row with no marker is UNVERIFIABLE, never assumed fine', verdict(R(false, null), true) === 'UNVERIFIABLE');
  ok('RED — an instrument that will not run is NOT treated as agreement',
    verdict(R(false, C), null) === 'INSTRUMENT UNRUNNABLE' && BAD.has('INSTRUMENT UNRUNNABLE'));
  /* THE PARSER, ON SYNTHETIC ROWS. A marker that is not picked up reads as coverage that does not
   * exist, which is the failure this file is about wearing its own uniform. */
  const p = parse([
    '| #1 | **A THING.** VERIFIED BY: `node tests/a.js` | open — DEFECT |',
    '| #2 | **ANOTHER.** nothing here | open — DEFECT |',
    '| #3 | **A CLOSED ONE.** VERIFIED BY: `node tests/b.js --flag` | closed 2026-08-15 |',
  ]);
  ok('the marker is parsed off a row', p[0].cmd === 'node tests/a.js', p[0]);
  ok('a row without one carries null, not a guess', p[1].cmd === null);
  ok('flags survive the marker', p[2].cmd === 'node tests/b.js --flag', p[2]);
  ok('the closed-detector is the one the GATE uses, not a second copy', p[2].closed === true && p[0].closed === false);
  ok('RED — a marker that is not a plain node command is REFUSED rather than run',
    run('rm -rf /').green === null && /NOT run/.test(run('rm -rf /').why), run('rm -rf /'));
  ok('RED — a shell chain hidden after a legitimate script is refused too',
    run('node tests/a.js && curl evil').green === null);
  console.log(`\nREGISTER-REALITY SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

const lines = fs.readFileSync(path.join(ROOT, 'docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/);
const rows = parse(lines);
const marked = rows.filter(r => r.cmd);
const openBroken = rows.filter(r => !r.closed && r.saysBroken);

const results = [];
for (const r of marked) {
  const res = has('--list') ? { green: null, why: '--list: not run' } : run(r.cmd);
  results.push({ ...r, ...res, verdict: has('--list') ? 'NOT RUN' : verdict(r, res.green) });
}

const failing = results.filter(r => BAD.has(r.verdict));
const art = {
  generated: new Date().toISOString(),
  by: 'engine/register_reality.js',
  what: 'Every register row that names the instrument deciding it, run, with its exit code compared '
      + 'to the row\'s open/closed status.',
  why: 'docs/ROADMAP.md is read by engine/quarantine.js as a GATE INPUT and nothing checked it against '
     + 'reality. On 2026-08-14 four rows were stale rather than live and two of them were put in front '
     + 'of a human as the place to start. A row nobody re-verifies is prose.',
  weaker_than_it_looks: 'A green instrument means THAT instrument sees nothing. It is not a '
      + 'derivation of the row\'s claim. It is strictly more than the register had, which was nothing.',
  counts: {
    register_rows: rows.length,
    open_asserting_breakage: openBroken.length,
    marked: marked.length,
    open_asserting_breakage_and_marked: openBroken.filter(r => r.cmd).length,
    stale_rows: results.filter(r => r.verdict === 'STALE ROW').length,
    premature_closes: results.filter(r => r.verdict === 'PREMATURE CLOSE').length,
    unrunnable: results.filter(r => r.verdict === 'INSTRUMENT UNRUNNABLE').length,
  },
  results,
  unverifiable_open_defects: openBroken.filter(r => !r.cmd).map(r => ({ n: r.n, title: r.title })),
};
fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');

if (has('--json')) { console.log(JSON.stringify(art, null, 2)); process.exit(failing.length ? 1 : 0); }

const c = art.counts;
console.log('\nREGISTER REALITY — the register checked against the instruments, not against itself\n');
console.log('  ' + String(c.register_rows).padStart(4) + '  register rows');
console.log('  ' + String(c.open_asserting_breakage).padStart(4) + '  OPEN and asserting breakage  (the MEDICHAM gate counts these)');
console.log('  ' + String(c.open_asserting_breakage_and_marked).padStart(4) + '  of those, naming the instrument that decides them');
console.log('  ' + String(c.marked).padStart(4) + '  rows carrying a VERIFIED BY marker in total\n');
for (const r of results)
  console.log('  ' + r.verdict.padEnd(22) + '#' + String(r.n).padEnd(5) + (r.why || '').padEnd(22) + r.title);
console.log('');
if (art.unverifiable_open_defects.length) {
  console.log('  NO INSTRUMENT NAMED — these rows are still prose, and that is the coverage number:');
  for (const r of art.unverifiable_open_defects) console.log('      #' + String(r.n).padEnd(5) + r.title);
  console.log('');
}
console.log('  Add one to a row with:   VERIFIED BY: `node tests/<the gate that decides it>.js`');
console.log('  wrote data/register-reality.json\n');
if (failing.length) {
  console.log('REGISTER REALITY: ' + failing.length + ' row(s) disagree with their own instrument. '
    + 'A stale row holds a gate shut on a defect that does not exist.');
  process.exit(1);
}
console.log('REGISTER REALITY: every marked row agrees with its instrument.');
