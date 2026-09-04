/* test-counter-init.js — an increment must land on a field its object DECLARES.
 *
 *   node tests/test-counter-init.js            check
 *   node tests/test-counter-init.js --list     every capitalised counter object it found
 *
 * WHY THIS EXISTS
 * ---------------
 * The founding rule of this repository is "a capability that cannot prove it ran is assumed broken":
 * every capability emits a counter, the run prints it, and a zero is called out. `undefined++` is
 * `NaN`, and `NaN++` stays `NaN` — so an increment aimed at a field the object never declared is a
 * counter that can never be zero, can never be non-zero, and can never be compared to anything. It
 * is the founding rule inverted: a capability that fires and PROVES NOTHING, while looking exactly
 * like a working counter at the call site.
 *
 * This is not hypothetical and it did not stay in the source. `data/million-run.json` and
 * `data/million-run-150k.json` both carry
 *
 *     "retaliateWhenLowered": null
 *
 * which is `JSON.stringify(NaN)`. WIRE 138 — the `boostsWhenLowered` retaliation family, called from
 * five sites — fired during both runs and recorded nothing, twice, in two published artifacts. A
 * `=== 0` zero-check passes on it forever. It was the only non-finite value in either artifact.
 *
 * The nastier member of the class is `roostRiderNoPrimary`: it is incremented on `MEDFAILS` and was
 * DECLARED inside the `MEDSEEN` literal. So one object read 0 forever while the other read NaN —
 * the documented trap where a reader taking one object's delta against the other compares `undefined`
 * to `0` and can never go red. `MEDSEEN` counts what HAPPENED and `MEDFAILS` counts what WENT WRONG;
 * a field declared on the wrong one is two broken counters, not one.
 *
 * THE RULE, and it is deliberately structural
 * -------------------------------------------
 *   For every capitalised object declared in a file as a non-empty object literal
 *   (`const MEDSEEN = { ... }`), every `OBJ.field++`, `OBJ.field += n`, `OBJ.field--` and
 *   `OBJ.field -= n` in that same file must name a `field` the literal declares.
 *
 * No registry, no by-name list, no judgement. It is a PROPERTY, so it catches a second instance
 * spelled differently, in any file — including one incremented on the wrong object by mistake, which
 * is exactly how `roostRiderNoPrimary` arrived. The `(x || 0) + 1` idiom that
 * `tests/test-no-silent-failure.js` already recognises is an ASSIGNMENT, not an increment, and is
 * structurally safe, so it is not matched here and needs no exemption.
 *
 * It is NOT a fix for `tests/test-no-silent-failure.js`, whose `++` rule asks a different question
 * ("does this catch block discard the reason?") and has been corrected four separate times for
 * over-reach. That rule stays exactly as it is; this is a separate check about a separate property.
 *
 * MEASURED BEFORE IT WAS WIRED, per LESSONS §4 — every derivation over-matches on the first try:
 * 507 files, 602 capitalised object literals, 3,604 declared top-level keys, and exactly FOUR
 * violations, all four the ones named in docs/_reports/2026-09-04-dead-counters-audit.md. Zero
 * false positives to argue about, so nothing here is exempted by name.
 *
 * WHAT IT DOES NOT SEE, stated so silence is never read as "checked and fine". Each is COUNTED and
 * PRINTED on every run rather than dropped:
 *   - COMPUTED-KEY increments (`MEDSEEN[_row.chosen]++`). Six exist tree-wide; the key is a value,
 *     so no source scan can decide them. They are named in the output.
 *   - NESTED increments (`OBJ.sub.field++`). The literal's top-level key is what is checked; a
 *     second level would need the sub-literal parsed. None exist today; they are named if they appear.
 *   - CROSS-FILE increments (`M.MEDSEEN.field++` in a test against the engine's export). The
 *     declaration is in another file, so this check does not resolve them. Measured: they exist and
 *     are not covered. That is clause (a)'s stated limit, not an oversight.
 *
 * A DETECTOR THAT CANNOT GO RED IS THE THING IT IS GUARDING AGAINST, so PART 1 runs the scanner over
 * a synthetic source carrying one known violation and one known-clean increment, and fails if it does
 * not separate them. That arm is why "0 violations" on the real tree means something.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

/* Comments and strings are blanked before anything is matched — a counter NAMED IN PROSE is not an
 * increment, and `console.log('MEDFAILS.foo++')` increments nothing. NEWLINES ARE PRESERVED so that
 * every line number this file prints is a real line in the real file: a report that points at the
 * wrong line costs the reader the same time as no report. */
const nl = m => m.replace(/[^\n]/g, '');
const blank = src => src
  .replace(/\/\*[\s\S]*?\*\//g, m => ' ' + nl(m))
  .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
  .replace(/'(\\.|[^'\\\n])*'/g, "''")
  .replace(/"(\\.|[^"\\\n])*"/g, '""')
  .replace(/`(\\.|[^\\`])*`/g, m => '``' + nl(m));

/* Top-level keys of the object literal whose opening brace is at `i`. Depth-counted over braces,
 * brackets and parens, so a nested literal, an array default or a call in a value contributes
 * nothing. A key is an identifier at depth 1 that is preceded by `{` or `,` and followed by `:`. */
function literalKeys(code, i) {
  let depth = 0; const keys = [];
  for (let j = i; j < code.length; j++) {
    const c = code[j];
    if (c === '{' || c === '(' || c === '[') { depth++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) break; continue; }
    if (depth === 1 && /[A-Za-z_$]/.test(c)) {
      let k = j - 1; while (k >= 0 && /\s/.test(code[k])) k--;
      if (code[k] === '{' || code[k] === ',') {
        const m = /^[\w$]+/.exec(code.slice(j));
        if (m) {
          const e = j + m[0].length;
          let q = e; while (q < code.length && /\s/.test(code[q])) q++;
          if (code[q] === ':') keys.push(m[0]);
          j = e - 1;
        }
      }
    }
  }
  return keys;
}

const DECL = /(?:^|[;{}\n)])\s*(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*\{/gm;
const INCR = /\b([A-Z][A-Z0-9_]*)\.([A-Za-z_$][\w$]*)\s*(\+\+|--|\+=|-=)/g;
const NESTED = /\b([A-Z][A-Z0-9_]*)\.([A-Za-z_$][\w$]*)\.[\w$.]+\s*(?:\+\+|--|\+=|-=)/g;
const COMPUTED = /\b([A-Z][A-Z0-9_]*)\[[^\]\n]+\]\s*(?:\+\+|--|\+=|-=)/g;

/* The whole detector, over ONE file's source. Exported shape is deliberate: PART 1 calls it on a
 * synthetic string, PART 2 calls it on the tree, and both therefore exercise the same code. */
function analyse(rel, raw) {
  const code = blank(raw);
  const lines = code.split('\n');
  const starts = []; let acc = 0;
  for (const L of lines) { starts.push(acc); acc += L.length + 1; }
  const lineOf = idx => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; };

  const objects = new Map();
  let m;
  DECL.lastIndex = 0;
  while ((m = DECL.exec(code))) {
    const bi = code.indexOf('{', m.index + m[0].length - 1);
    objects.set(m[1], { keys: new Set(literalKeys(code, bi)), line: lineOf(m.index) });
  }
  const out = { file: rel, objects, checked: 0, violations: [], nested: [], computed: [] };
  if (!objects.size) return out;

  INCR.lastIndex = 0;
  while ((m = INCR.exec(code))) {
    const [, obj, fld, op] = m;
    const d = objects.get(obj);
    if (!d || d.keys.size === 0) continue;   /* not a declared literal counter object */
    out.checked++;
    if (!d.keys.has(fld)) out.violations.push({ file: rel, line: lineOf(m.index), obj, fld, op, declLine: d.line, declKeys: d.keys.size });
  }
  NESTED.lastIndex = 0;
  while ((m = NESTED.exec(code))) if (objects.has(m[1])) out.nested.push({ file: rel, line: lineOf(m.index), what: m[1] + '.' + m[2] + '.…' });
  COMPUTED.lastIndex = 0;
  while ((m = COMPUTED.exec(code))) if (objects.has(m[1])) out.computed.push({ file: rel, line: lineOf(m.index), what: m[1] + '[…]' });
  return out;
}

/* ================================================================================================
 * PART 1 — THE DETECTOR MUST BE ABLE TO GO RED
 * ================================================================================================ */
const FIXTURE = [
  'const SEEN = { alpha: 0, beta: 0 };',
  'const NOTALIT = {};',
  'function f() {',
  '  SEEN.alpha++;',            /* declared — clean */
  '  SEEN.beta += 2;',          /* declared — clean */
  '  SEEN.gamma++;',            /* NOT declared — the whole point */
  '  NOTALIT.anything++;',      /* empty literal, not a counter table — must not be accused */
  '  SEEN.delta = (SEEN.delta || 0) + 1;',  /* guarded assignment — structurally safe */
  '  /* SEEN.epsilon++ in a comment is not an increment */',
  "  console.log('SEEN.zeta++');",
  '}',
].join('\n');
const fx = analyse('<fixture>', FIXTURE);
ok(fx.violations.length === 1 && fx.violations[0].fld === 'gamma',
  'the detector separates an undeclared increment from four things that look like one'
  + ` — flagged [${fx.violations.map(v => v.obj + '.' + v.fld).join(', ') || 'nothing'}]`);
ok(fx.violations.length === 1 && fx.violations[0].line === 6,
  `and reports its real line number (got ${fx.violations.length === 1 ? fx.violations[0].line : 'n/a'}, want 6)`);

/* ================================================================================================
 * PART 2 — THE TREE
 * ================================================================================================ */
const DIRS = ['engine', 'tests', 'build', 'tools', 'web', 'app'];
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const files = []; for (const d of DIRS) walk(D(d), files);

let nObjects = 0, nKeys = 0, nChecked = 0;
const violations = [], nested = [], computed = [];
for (const f of files) {
  const r = analyse(path.relative(ROOT, f).replace(/\\/g, '/'), fs.readFileSync(f, 'utf8'));
  for (const [, v] of r.objects) if (v.keys.size) { nObjects++; nKeys += v.keys.size; }
  nChecked += r.checked;
  violations.push(...r.violations); nested.push(...r.nested); computed.push(...r.computed);
}
console.log(`  scanned ${files.length} file(s) in ${DIRS.join('/')}: ${nObjects} capitalised object literal(s), ${nKeys} declared key(s), ${nChecked} increment(s) checked`);

/* A SCAN THAT SEES NOTHING PASSES EVERY ASSERTION BELOW, which is the exact failure this file is
 * about, so the scan proves it ran before it is allowed to report clean. No hand-typed floor — the
 * numbers move with the tree; zero is the only value that means the instrument is dead. */
ok(files.length > 0 && nObjects > 0 && nChecked > 0,
  'the scan reached real source (a zero here is the instrument, not the tree)');

ok(violations.length === 0,
  'every increment on a declared counter object names a field that object declares'
  + (violations.length ? ` — ${violations.length} do not` : ''));
for (const v of violations) {
  console.log(`       ${v.file}:${v.line}  ${v.obj}.${v.fld}${v.op}  is NaN — ${v.obj}'s literal (:${v.declLine}, ${v.declKeys} keys) has no '${v.fld}'`);
}
if (violations.length) {
  console.log('\n  Declare the field on THE OBJECT THAT INCREMENTS IT. Do not guard the increment site');
  console.log('  with `|| 0` — that hides which object owns the counter, and ownership is what is wrong.');
  console.log('  MEDSEEN counts what HAPPENED; MEDFAILS counts what WENT WRONG.\n');
}

/* Named, never dropped. These are outside the rule's reach and saying so is the difference between a
 * limit and a silent default. */
console.log(`  outside this rule's reach: ${computed.length} computed-key increment(s), ${nested.length} nested increment(s)`);
for (const c of computed) console.log(`       ${c.file}:${c.line}  ${c.what}  (key is a value — undecidable by scan)`);
for (const c of nested) console.log(`       ${c.file}:${c.line}  ${c.what}  (second-level field — not checked)`);

if (process.argv.includes('--list')) {
  console.log('\n  every capitalised object literal found:');
  for (const f of files) {
    const r = analyse(path.relative(ROOT, f).replace(/\\/g, '/'), fs.readFileSync(f, 'utf8'));
    for (const [name, v] of r.objects) if (v.keys.size) console.log(`       ${r.file}:${v.line}  ${name}  ${v.keys.size} key(s)`);
  }
}

console.log(`\nCOUNTER INIT TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
