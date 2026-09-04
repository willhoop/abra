#!/usr/bin/env node
/* ==================================================================================================
 * THE REGISTER MUST NOT LIE ABOUT ITS OWN STATUS — the durable guard for the cell-parse class.
 * ==================================================================================================
 * WHAT THE CLASS IS. `roadmapRowStatusCell` in engine/quarantine.js reads a row's status as the text
 * after the LAST pipe on the line, and `roadmapRowIsClosed`'s cell clause skips leading whitespace
 * with `\s*`. Two authoring habits defeat that, and BOTH move gate verdicts:
 *
 *   - a pipe that is not a column delimiter — inside inline code, or backslash-escaped — pushes the
 *     capture past the row's own status. ESCAPING DOES NOT FIX IT: the capture is a negated-pipe
 *     character class, so it stops at the `|` of `\|` exactly as it stops at a bare one.
 *   - decoration at the head of the cell — `**CLOSED 2026-08-13**` — is not skipped by `\s*`, so the
 *     clause never sees the closure word its author wrote.
 *
 * WHAT IT COST. Measured 2026-09-04 over docs/ROADMAP.md at commit 8519e071 (the register as it stood
 * before the repair pass): TWENTY-SEVEN verdicts moved on this in one night. #531 was closed in its
 * own cell and read open-and-broken. #175 read CLOSED while its own cell begins `open — engine DEFECT`
 * — a live breakage claim excused from the gate by a parse artifact, which is the same cost shape as
 * #403. Nine more read OPEN against an authored closure. Nothing prevented the next row doing it.
 * See docs/_reports/2026-09-04-pipe-class-repair.md and -register-closures.md.
 *
 * WHAT THIS ASSERTS — A PROPERTY, NOT A LIST OF THE TWO KNOWN-BAD FORMS.
 *
 *   For every register row, the GATE-VISIBLE VERDICT must be the same whether the row's status cell
 *   is read as the shipping detector reads it, or read as the column the author wrote and then
 *   rendered to plain text.
 *
 * Neither half names a defeating form. The first half is "which text is the status cell" and catches
 * any non-delimiter pipe, through any door — code span, backslash escape, a link, a table shape
 * nobody meant. The second half is "what does that text say" under a general Markdown-inline
 * rendering, and catches any decoration that hides a verdict word — emphasis, a link, a stray
 * backtick, an HTML span, an escape. A third habit, spelled differently, fails here without an edit.
 *
 * THE HONEST LIMIT, stated rather than dressed up: the renderer knows Markdown inline syntax. A
 * verdict word hidden behind something that is NOT Markdown — an HTML entity, a Unicode look-alike —
 * is outside what this can see. It is a property of Markdown notation, not of all possible notation.
 *
 * IT WAS SHOWN RED BEFORE IT WAS TRUSTED, on seven synthetic rows in seven different doors AND on the
 * real register at commit 8519e071 — it names FIFTEEN rows there and exits 1, and moves nothing on
 * the repaired file. Every red
 * synthetic has a REPAIRED TWIN that must produce no finding — a knob-cleared control, so a finding
 * is attributable to the defect and not to the row.
 *
 * WHAT FAILS AND WHAT ONLY REPORTS, and the reasoning is in the report:
 *   FAIL   — the two readings give different GATE-VISIBLE verdicts. That is a verdict decided by
 *            notation, and it is what #175 and #531 each were.
 *   REPORT — a cut cell whose verdict is unchanged. 90 rows still carry 631 non-delimiter pipes;
 *            rewriting them for no verdict change is a diff nobody can review against a benefit
 *            nobody can measure, and a gate that fires on a latent hazard is the over-firing gate
 *            #148 warns about. Every one is PRINTED BY NAME every run, so it is a list and not a
 *            ratchet — there is no count anybody must keep below a number.
 *   REPORT — a row whose inline-code delimiters do not pair, so the recovery is not stable (below).
 *   REPORT — a row with an empty status cell. #196 was this: a trailing empty column, so the cell
 *            parsed to "" against an authored `closed — measure`.
 *
 * WHY THE STABILITY TEST EXISTS, AND IT IS NOT AN ESCAPE HATCH. A row whose backtick runs do not pair
 * has no recoverable cell structure: a stray backtick re-pairs every span after it. #332 is one — its
 * title carries a corrupt `AND\|upkeep` fragment, present at 8519e071 and NOT introduced by the repair
 * pass — and reading it two defensible ways gives two different cells. Asserting a verdict there would
 * be asserting a claim from an instrument that is broken on that input, which is the over-fire this
 * repo has already paid for. So the recovery is computed under BOTH treatments of an unpaired run
 * (literal, per CommonMark; and opening a span to end of line) and a verdict divergence is only
 * asserted when the two agree. Rows where they do not agree are NAMED AND PRINTED on every run, at
 * zero as well as at four — the receipt convention `NOT A DEFECT` already uses in quarantine.js,
 * because a door nobody can see being used is not a door, it is a hole.
 *
 * THE DETECTORS ARE IMPORTED, NOT REIMPLEMENTED. `roadmapRowIsClosed` and `roadmapRowSaysBroken` are
 * required from engine/quarantine.js. `roadmapRowStatusCell` is NOT exported, so its source is LIFTED
 * OUT OF THE SHIPPING BYTES and compiled — never re-typed. A third copy of a closed-row detector once
 * disagreed with the shipping one on 24 of 292 rows in BOTH directions; a verifier that reimplements
 * the rule it is checking is a documented failure class here. If the function is renamed or moved,
 * this THROWS by name rather than checking a stale copy.
 *
 * WIRING. It is not in run-all.js's GATES and must not be: GATES exists for checks that live in
 * engine/ "because other tooling imports them, so they cannot be found by globbing tests/".
 * tests/run-all.js discovers every tests/test-*.js by glob, so this file is wired by its NAME.
 * Confirmed against `node tests/run-all.js --list`: 156 test files before, 157 after.
 * ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
/* `--register <path>` points PART 2 at another copy of the register. It exists so the RED
 * demonstration is reproducible rather than a sentence in a report — run it against
 * a copy of `git show <commit>:docs/ROADMAP.md` and the verdicts that moved on 2026-09-04 come back.
 * Only this flag is read; a stray argument must not silently change what is checked. */
const argAt = process.argv.indexOf('--register');
const REGISTER = argAt > 0 ? path.resolve(process.argv[argAt + 1]) : path.join(ROOT, 'docs', 'ROADMAP.md');
const QUARANTINE = path.join(ROOT, 'engine', 'quarantine.js');
const Q = require('../engine/quarantine.js');
const BS = String.fromCharCode(92);

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL  ' + msg); };
const pass = (msg) => console.log('  ok    ' + msg);

/* ---- 1. THE SHIPPING CELL EXTRACTOR, LIFTED FROM THE SHIPPING BYTES ------------------------------
 * quarantine.js exports the two DETECTORS but not the cell reader they share. Re-typing the regex
 * here would create the second implementation this repo's own rule forbids, so the function's source
 * text is cut out of the file and compiled. It cannot drift, and if it moves this throws. */
function liftFunction(file, name) {
  const src = fs.readFileSync(file, 'utf8');
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error(name + ' is not in ' + file + ' — it was renamed or moved. This check '
    + 'reads the SHIPPING bytes on purpose; re-typing it here would make a second implementation. '
    + 'Point the lift at the new name.');
  let depth = 0, end = -1;
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) { end = j; break; }
  }
  if (end < 0) throw new Error(name + ' in ' + file + ' has unbalanced braces — the lift cannot cut it out.');
  const text = src.slice(at, end + 1);
  const fn = vm.runInNewContext('(' + text + ')', Object.create(null));
  if (typeof fn !== 'function') throw new Error(name + ' did not compile to a function.');
  return { fn, text };
}
const LIFT = liftFunction(QUARANTINE, 'roadmapRowStatusCell');
const shippingCell = LIFT.fn;

/* ---- 2. THE OTHER READING — the status column the author wrote --------------------------------- */
/* the index of the last pipe that is a COLUMN DELIMITER: not backslash-escaped, and not inside an
 * inline code span. `runToEOL` is the treatment of a backtick run that never pairs — see the header. */
function lastDelimiter(s, runToEOL) {
  let last = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === BS && i + 1 < s.length) { i++; continue; }
    if (c === '`') {
      let n = 1; while (s[i + n] === '`') n++;
      let j = i + n, close = -1;
      while (j < s.length) {
        if (s[j] === '`') { let m = 1; while (s[j + m] === '`') m++; if (m === n) { close = j; break; } j += m; continue; }
        j++;
      }
      if (close < 0) { if (runToEOL) return last; i += n - 1; continue; }
      i = close + n - 1; continue;
    }
    if (c === '|') last = i;
  }
  return last;
}
/* the authored status cell: the text between the last two delimiters */
function authoredCell(line, runToEOL) {
  const s = String(line).replace(/\s+$/, '');
  const end = lastDelimiter(s, runToEOL);
  if (end < 0) return null;
  const open = lastDelimiter(s.slice(0, end), runToEOL);
  if (open < 0) return null;
  return { at: open + 1, text: s.slice(open + 1, end) };
}

/* ---- 3. MARKDOWN INLINE -> PLAIN TEXT ----------------------------------------------------------
 * A RENDERING, not a list of the forms that have bitten. Emphasis runs are only stripped where they
 * could be emphasis — a `_` between two word characters is part of an identifier such as
 * MEDI_FAINT_INLINE and is left alone. A residual pipe becomes `/`: a non-word, non-space character,
 * so the substitution can neither join two words into a detector token nor split one apart. */
function renderInline(s) {
  let t = String(s);
  t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');        /* inline links and images   */
  t = t.replace(/\[\^[^\]]*\]/g, '');                     /* footnote markers          */
  t = t.replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1');       /* reference links           */
  t = t.replace(/<\/?[A-Za-z][^>]*>/g, '');               /* inline HTML               */
  t = t.replace(/`+/g, '');                               /* code-span fences          */
  t = t.replace(/([*_]+)/g, (m, run, off) => {            /* emphasis runs             */
    const before = t[off - 1] || ' ', after = t[off + run.length] || ' ';
    return (/[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after)) ? run : '';
  });
  t = t.replace(new RegExp(BS + BS + '(.)', 'g'), '$1');  /* backslash escapes         */
  t = t.replace(/\|/g, '/');
  return t.replace(/\s+/g, ' ').trim();
}

/* ---- 4. THE VERDICT ANYTHING DOWNSTREAM ACTUALLY CONSUMES --------------------------------------
 * Two booleans, composed exactly as engine/quarantine.js's open-defect clause composes them: it skips
 * a closed row before it ever asks whether the row asserts breakage, so `saysBroken` on a CLOSED row
 * reaches no gate. Comparing this pair rather than the two detectors separately is what keeps the
 * check off #502 — a closed row whose breakage flag differs between the readings and is consulted by
 * nobody — without carving out an exception anybody could argue their row into. */
function gateVisible(line) {
  const closed = Q.roadmapRowIsClosed(line);
  return closed + '/' + (!closed && Q.roadmapRowSaysBroken(line));
}

const ROW = /^\|\s*#(\d+)\s*\|\s*(.*)$/;
const HEADER = /^\|\s*#\s*\|/;
const RULE = /^\|[\s\-:|]+\|\s*$/;

/* ---- 5. THE CHECK ------------------------------------------------------------------------------ */
function scan(lines) {
  const out = { rows: 0, moved: [], cut: [], unstable: [], empty: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HEADER.test(line) && RULE.test(lines[i + 1] || '')) continue;
    const m = line.match(ROW);
    if (!m) continue;
    out.rows++;
    const n = +m[1];
    const det = shippingCell(line);
    const a = authoredCell(line, false);
    const b = authoredCell(line, true);
    if (det.trim() === '') out.empty.push({ n, why: 'the detector reads an empty status cell' });
    if (!a) continue;                      /* not a table row after all */
    if (a.text.trim() !== det.trim()) out.cut.push({ n, det: det.trim(), authored: a.text.trim() });

    const canonOf = (c) => line.slice(0, c.at) + ' ' + renderInline(c.text) + ' |';
    const g0 = gateVisible(line);
    const g1 = gateVisible(canonOf(a));
    const g2 = b ? gateVisible(canonOf(b)) : g1;
    if (g1 !== g2) {
      out.unstable.push({ n, g0, g1, g2, a: renderInline(a.text).slice(0, 70),
                          b: b ? renderInline(b.text).slice(0, 70) : '(no cell)' });
      continue;                            /* no reading can be asserted — reported, not judged */
    }
    if (g0 !== g1) out.moved.push({ n, detector: g0, authored: g1,
      det: det.trim().slice(0, 76), auth: renderInline(a.text).slice(0, 76) });
  }
  return out;
}

/* =================================================================================================
 * PART 1 — RED FIRST. Seven doors, each with a REPAIRED TWIN that must go quiet.
 * ============================================================================================== */
console.log('\n  REGISTER CELL-PARSE GUARD — the status a gate reads must be the status the row states\n');
console.log('  PART 1 — seven defeating forms, each with a knob-cleared twin');

/* > 600 characters, because both detectors fall back to a prose scan over the row HEAD. A synthetic
 * short enough to fit inside that window is decided by the fallback and tests nothing. The filler
 * carries no closure token and no breakage vocabulary — asserted below, not assumed. */
const PAD = ('the row narrates a measurement and the sample it rests on, and it repeats so that the '
  + 'status cell sits past the head window the prose scan reads. ').repeat(6);
const row = (n, cell) => '| #' + n + ' | **A SYNTHETIC ROW.** ' + PAD + ' | ' + cell + ' |';

if (gateVisible(row(9000, 'in progress')) !== 'false/false')
  fail('the synthetic filler is not neutral — it decides the verdict on its own, so PART 1 tests nothing');
else pass('the synthetic filler is neutral: a padded row with a plain status reads false/false');

const DOORS = [
  { n: 9001, what: 'an unescaped pipe inside inline code (the #531 shape)',
    red: 'closed 2026-08-29 — LANDED. The trace reads `-unboost|TARGET|atk|0` and the boards match.',
    fixed: 'closed 2026-08-29 — LANDED. The trace reads an -unboost on the TARGET reading atk then 0 and the boards match.' },
  { n: 9002, what: 'a BACKSLASH-ESCAPED pipe — escaping does not fix it (the #294 shape)',
    red: 'closed 2026-08-18 — ENGINE; the probe `move' + BS + '|spreadFoes` staged all four outcomes.',
    fixed: 'closed 2026-08-18 — ENGINE; the probe move spreadFoes staged all four outcomes.' },
  { n: 9003, what: 'emphasis at the head of the cell (the #254 shape)',
    red: '**CLOSED 2026-08-13** — engine.',
    fixed: 'CLOSED 2026-08-13 — engine.' },
  { n: 9004, what: 'a LINK at the head of the cell — a door nobody has used yet',
    red: '[CLOSED 2026-08-13](docs/_reports/2026-08-13-x.md) — engine.',
    fixed: 'CLOSED 2026-08-13 — engine, account docs/_reports/2026-08-13-x.md.' },
  { n: 9005, what: 'the status wrapped in a code span — a stray backtick',
    red: '`closed 2026-09-04` — engine.',
    fixed: 'closed 2026-09-04 — engine.' },
  { n: 9006, what: 'an inline HTML tag at the head of the cell',
    red: '<b>CLOSED 2026-08-13</b> — engine.',
    fixed: 'CLOSED 2026-08-13 — engine.' },
  { n: 9007, what: 'THE DANGEROUS DIRECTION — a live DEFECT claim read as CLOSED (the #175 shape)',
    red: 'open — engine DEFECT; the tag is written a ' + BS + '| b in the note. CLOSED 2026-08-11 — seven wired, one tossed.',
    fixed: 'open — engine DEFECT; the tag is written a / b in the note. An earlier half closed 2026-08-11 — seven wired, one tossed.' },
];

for (const d of DOORS) {
  const red = scan([row(d.n, d.red)]);
  const fixed = scan([row(d.n, d.fixed)]);
  const named = red.moved.length === 1 && red.moved[0].n === d.n;
  if (!named) {
    fail('NOT RED on ' + d.what + ' — the check did not name #' + d.n
      + ' (moved=' + JSON.stringify(red.moved) + ' unstable=' + JSON.stringify(red.unstable) + ')');
  } else if (fixed.moved.length !== 0) {
    fail('the twin of ' + d.what + ' still reports — the finding is not attributable to the defect');
  } else {
    pass('RED on ' + d.what + '\n          #' + d.n + '  gate reads ' + red.moved[0].detector
      + ', the row states ' + red.moved[0].authored + '  — twin repaired: quiet');
  }
}

/* ---- controls: rows that must NOT be findings -------------------------------------------------- */
const CONTROLS = [
  { n: 9010, what: 'a clean closed row', cell: 'closed 2026-08-13 — engine.' },
  { n: 9011, what: 'a clean open row asserting breakage', cell: 'open — engine DEFECT; unprobed.' },
  { n: 9012, what: 'a pipe in the cell whose verdict is the same either way (cut but harmless)',
    cell: 'open — engine DEFECT; the trace reads `-start|confusion` and the DEFECT stands.', expectCut: true },
];
for (const c of CONTROLS) {
  const r = scan([row(c.n, c.cell)]);
  if (r.moved.length) fail('FALSE ALARM on ' + c.what + ' — #' + c.n + ' reported as a verdict move');
  else if (c.expectCut && r.cut.length !== 1) fail(c.what + ' should have been REPORTED as a cut cell and was not');
  else pass('quiet on ' + c.what + (c.expectCut ? ' (reported as cut, not failed)' : ''));
}

/* ---- the arm that would go green if the comparison were deleted --------------------------------- */
/* tests/test-counter-init.js's shape: a synthetic corpus carrying a known violation AND a known-clean
 * row, so a check that stopped comparing anything could not pass. Deleting the `g0 !== g1` test makes
 * every DOOR above report nothing and this arm fails by name. */
const CORPUS = DOORS.map(d => row(d.n, d.red)).concat(CONTROLS.map(c => row(c.n, c.cell)));
const both = scan(CORPUS);
if (both.moved.length !== DOORS.length)
  fail('the mixed corpus reports ' + both.moved.length + ' of ' + DOORS.length
    + ' known violations — a check that finds fewer than it was handed is not comparing');
else if (both.moved.some(x => x.n >= 9010))
  fail('the mixed corpus reported a known-clean row: ' + JSON.stringify(both.moved.filter(x => x.n >= 9010)));
else pass('a mixed corpus of ' + CORPUS.length + ' rows finds exactly the ' + DOORS.length
  + ' violations and none of the ' + CONTROLS.length + ' clean rows');

/* THE LIFT IS LOAD-BEARING, so it is exercised rather than assumed: the compiled function must read
 * a clean row's status, AND must exhibit the defect this file exists for — on a row whose cell ends
 * in a pipe it returns the SUFFIX. If a future edit made the shipping reader robust, this arm says so
 * by name instead of the whole check quietly becoming a tautology. */
const liftClean = shippingCell('| #1 | title | closed 2026-01-01 |');
const liftCut = shippingCell('| #1 | title | closed 2026-01-01, see `a|b`. |');
if (liftClean !== 'closed 2026-01-01 ') {
  fail('the lifted roadmapRowStatusCell does not read a clean row\'s status — the lift is wrong '
    + '(returned ' + JSON.stringify(liftClean) + ')');
} else if (liftCut !== 'b`. ') {
  fail('the lifted roadmapRowStatusCell no longer cuts on a pipe inside a code span (returned '
    + JSON.stringify(liftCut) + '). If the SHIPPING reader was made robust, this whole check is now '
    + 'asking nothing and must be re-derived against the new reader.');
} else {
  pass('roadmapRowStatusCell lifted from engine/quarantine.js, compiled, and shown to cut: '
    + JSON.stringify(LIFT.text.replace(/\s+/g, ' ')));
}

/* =================================================================================================
 * PART 2 — THE LIVE REGISTER
 * ============================================================================================== */
console.log('\n  PART 2 — ' + path.relative(ROOT, REGISTER).replace(/\\/g, '/'));
const live = scan(fs.readFileSync(REGISTER, 'utf8').split(/\r?\n/));
console.log('    ' + live.rows + ' register rows');
console.log('    ' + live.moved.length + ' with a GATE-VISIBLE VERDICT that depends on the parse   <- fails');
console.log('    ' + live.cut.length + ' with a cut status cell and the same verdict either way    <- reported');
console.log('    ' + live.unstable.length + ' whose inline-code delimiters do not pair, so no reading can be asserted');
console.log('    ' + live.empty.length + ' with an empty status cell');

if (live.cut.length) {
  console.log('\n    CUT BUT THE VERDICT IS UNCHANGED — printed by name every run, not counted against a bar:');
  for (const x of live.cut) console.log('      #' + x.n + '  gate reads: ' + x.det.slice(0, 64));
}
if (live.unstable.length) {
  console.log('\n    NOT READABLE — two defensible readings, two cells. Renotate the row; do not trust either:');
  for (const x of live.unstable) console.log('      #' + x.n + '  gate=' + x.g0 + '  readings ' + x.g1 + ' and ' + x.g2
    + '\n           A: ' + x.a + '\n           B: ' + x.b);
}
if (live.empty.length) {
  console.log('\n    EMPTY STATUS CELL — the detector has nothing to read and falls through to prose:');
  for (const x of live.empty) console.log('      #' + x.n);
}
if (live.moved.length) {
  console.log('');
  for (const x of live.moved) fail('#' + x.n + ' — the gate reads ' + x.detector + ' and the row states '
    + x.authored + '\n          gate  : ' + x.det + '\n          stated: ' + x.auth);
} else {
  pass('no register row has a gate-visible verdict that depends on how its cell is parsed');
}

console.log('\n  ' + (failures ? failures + ' FAILED' : 'PASSED')
  + ' — a verdict must come from what the row states, not from where a pipe fell\n');
process.exit(failures ? 1 : 0);
