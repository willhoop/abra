/* WHAT IS ACTUALLY OPEN. PRINTED, NEVER TYPED.
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * Will, 2026-08-11: *"i feel like we already talked about and fixed most of these."* He was right. I
 * had just read him a list of ~30 open defects; **eight were closed days ago and four had never had a
 * register row at all.** It was the second stale list I quoted in one hour — the first was
 * `data/interaction-matrix.json`, five days and 52 simulator commits old, whose 19 rows are really 5.
 *
 * Neither was carelessness, and treating them as carelessness is how this repeats. **Nothing in this
 * repo printed the open work.** `engine/quarantine.js` computes a GATE — "is there an open row that
 * asserts breakage?" — and prints a verdict, narrow on purpose because an over-firing gate is the one
 * people learn to ignore (#148). It is correct and it is not a work list: #80, #84, #59 and #60 are
 * all open and none of them trips it. So the only list that existed was one somebody typed, and
 * CLAUDE.md's own opening paragraph is about what a typed list is worth here — fourteen stale
 * handoffs, a ban list of four, an auto-commit paragraph kept twelve days past its subject.
 *
 * ================= WHAT IT PRINTS =================================================================
 *
 *   OPEN          a register row not marked closed
 *   UNREGISTERED  a defect a LIVE INSTRUMENT is measuring right now with no roadmap row behind it.
 *                 This is the half a register can never catch by reading itself.
 *
 * The closed-detector is IMPORTED from quarantine.js, not copied. CLAUDE.md: two files that both
 * decide a fact will disagree eventually, and the disagreement will be invisible because both keep
 * working. The gate and the work list must never differ on whether a row is closed.
 *
 * ================= WHAT IT DOES NOT CLAIM ==========================================================
 *
 * A row is OPEN here if nobody marked it closed. That is a claim about the REGISTER, not about the
 * code — a fixed mechanic whose row was never updated still prints, and that is the correct direction
 * to err. UNREGISTERED is the stronger signal: it is measured, not filed.
 *
 *   node engine/open_work.js              # the list
 *   node engine/open_work.js --engine     # engine rows only
 *   node engine/open_work.js --json       # for a caller
 *
 * Reads the register and the live artifacts. Writes one artifact. Runs no games. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'open-work.json');
const Q = require('./quarantine.js');
const ENGINE_ONLY = process.argv.includes('--engine');
const AS_JSON = process.argv.includes('--json');

/* ---- 1. THE REGISTER ------------------------------------------------------------------------------ */
const lines = fs.readFileSync(path.join(ROOT, 'docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/);
const rows = [];
let section = '(unfiled)';
for (const l of lines) {
  const h = l.match(/^#{2,3}\s+(.+?)\s*$/);
  if (h) { section = h[1].replace(/^[\d.]+\s*/, ''); continue; }
  const m = l.match(/^\|\s*#(\d+)\s*\|\s*(.*)$/);
  if (!m) continue;
  const closed = Q.roadmapRowIsClosed(l);
  const title = m[2].replace(/\s*\|[^|]*\|?\s*$/, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const uses = +((l.match(/([\d,]{3,})\s*(uses|clicks)/) || [, '0'])[1].replace(/,/g, '')) || 0;
  /* THE FULL LINE IS KEPT ALONGSIDE THE DISPLAY TITLE. Matching subjects against a 120-char truncation
   * meant #161 — which registers five pairs BY NAME — still read as unregistered, because the names sit
   * past the cut. A tool that over-reports is the thing this file exists to stop. */
  rows.push({ n: +m[1], section, closed, saysBroken: Q.roadmapRowSaysBroken(l), uses,
              title: title.slice(0, 120), full: title.toLowerCase() });
}
const open = rows.filter(r => !r.closed);

/* ---- 2. WHAT THE LIVE INSTRUMENTS ARE MEASURING RIGHT NOW ------------------------------------------
 * A REGISTER CANNOT AUDIT ITSELF. Every row above is something a human wrote down; a defect nobody
 * wrote down is invisible to any amount of reading. So the measured disagreements are pulled from the
 * artifacts and matched against the register by SUBJECT, and anything unmatched is reported. */
/* ROADMAP #258 — AN UNREADABLE INSTRUMENT IS NOT AN INSTRUMENT WITH NOTHING TO SAY. This returned
 * null for both, so a corrupt or half-written artifact dropped silently out of the measured half of
 * this report and the work it was measuring simply stopped being printed — in the one tool whose job
 * is to print what is open. ENOENT stays quiet: an artifact that was never generated is a real and
 * expected answer, and shouting about it would make this list noise. */
const readJSON = (p) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') console.error(`  ${p} EXISTS AND COULD NOT BE READ (${e.message}) — `
      + 'anything it measures is missing from this report, not absent from the project.');
    return null;
  }
};
const measured = [];
const matrix = readJSON('data/interaction-matrix.json');
if (matrix && Array.isArray(matrix.parting)) {
  for (const r of matrix.parting)
    measured.push({ subject: r.carrier + ' -> ' + r.reactor, uses: r.uses || 0,
                    instrument: 'data/interaction-matrix.json', generated: matrix.generated,
                    detail: (r.diffs || []).map(d => d[0] + ' medi=' + d[1] + ' sd=' + d[2]).join(' | ') });
}
/* the register mentions a subject if either name appears in any OPEN row's title */
const openText = open.map(r => r.full).join(' ~ ');
for (const m of measured) {
  const parts = m.subject.split(' -> ').map(s => s.trim().toLowerCase());
  m.registered = parts.some(p => p && openText.includes(p));
}
const unregistered = measured.filter(m => !m.registered);

/* STALENESS IS PART OF THE ANSWER, NOT A FOOTNOTE. The matrix I quoted was five days old and I said
 * "6 disagreements" from it while 52 commits had landed on the simulator. Anything read out of an
 * artifact carries that artifact's age, printed next to it. */
const ageDays = (iso) => iso ? ((Date.now() - Date.parse(iso)) / 86400000) : null;

const art = {
  generated: new Date().toISOString(),
  by: 'engine/open_work.js',
  what: 'Every register row not marked closed, plus every defect a live instrument is measuring that '
      + 'has no register row. The answer to "what is open" — printed, never typed.',
  why: 'On 2026-08-11 a hand-typed list of ~30 open defects was read out while the gate sat green: '
     + '8 were closed, 4 had never been registered. Nothing printed the open work, so the only list '
     + 'that existed was one somebody typed.',
  not_a_claim_about_code: 'A row is OPEN here if nobody marked it closed. That is a statement about '
      + 'the REGISTER. A fixed mechanic whose row was never updated still prints, which is the correct '
      + 'direction to err. UNREGISTERED is the stronger signal — measured, not filed.',
  counts: { register_rows: rows.length, open: open.length, closed: rows.length - open.length,
            open_asserting_breakage: open.filter(r => r.saysBroken).length,
            measured_disagreements: measured.length, unregistered: unregistered.length },
  open, unregistered,
  instruments: [{ artifact: 'data/interaction-matrix.json', generated: matrix && matrix.generated,
                  age_days: matrix ? +ageDays(matrix.generated).toFixed(1) : null }],
};
fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');

if (AS_JSON) { console.log(JSON.stringify(art, null, 2)); process.exit(0); }

const c = art.counts;
console.log('  OPEN WORK — read from docs/ROADMAP.md and the live artifacts, never from a typed list\n');
console.log('    ' + String(c.register_rows).padStart(4) + '  register rows');
console.log('    ' + String(c.closed).padStart(4) + '  marked closed');
console.log('    ' + String(c.open).padStart(4) + '  OPEN'
          + '   (' + c.open_asserting_breakage + ' of them assert breakage — those are what the gate counts)');
console.log('    ' + String(c.unregistered).padStart(4) + '  MEASURED BUT UNREGISTERED\n');

const bySection = {};
for (const r of open) (bySection[r.section] = bySection[r.section] || []).push(r);
/* `--engine` MEANS THE MEDICHAM BLOCK, which is what anyone asking actually wants. The first version
 * matched /engine|mechanic|simulat/ against the SECTION HEADING and the heading is "MEDICHAM
 * completeness — PHASE 1", so the flag printed nothing at all and looked like a clean board. */
const wanted = ENGINE_ONLY ? Object.keys(bySection).filter(s => /medicham|engine|mechanic|simulat/i.test(s)) : Object.keys(bySection);
for (const s of wanted.sort()) {
  console.log('  ' + s);
  for (const r of bySection[s].sort((a, b) => b.uses - a.uses || a.n - b.n))
    console.log('      #' + String(r.n).padEnd(5) + (r.saysBroken ? 'DEFECT  ' : '        ')
              + (r.uses ? String(r.uses.toLocaleString()).padStart(7) + '  ' : '         ') + r.title);
  console.log();
}

if (unregistered.length) {
  console.log('  MEASURED BY AN INSTRUMENT, NOT IN THE REGISTER — a register cannot audit itself:');
  for (const m of unregistered.sort((a, b) => b.uses - a.uses))
    console.log('      ' + String(m.uses).padStart(6) + '  ' + m.subject.padEnd(34) + m.detail.slice(0, 70));
  console.log();
}
for (const i of art.instruments)
  if (i.age_days != null && i.age_days > 1)
    console.log('  WARNING: ' + i.artifact + ' is ' + i.age_days + ' days old. Anything read out of it '
              + 'describes the engine of that day, not this one.\n');
console.log('  wrote data/open-work.json');
