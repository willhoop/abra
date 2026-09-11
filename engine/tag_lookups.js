/* tag_lookups.js — WHICH TAG NAMES DOES A SOURCE FILE LOOK UP. One implementation.
 *
 *   const { sourceConsumers, lookupCalls } = require('./tag_lookups.js');
 *   sourceConsumers(src)   -> Set of tag names named as a literal argument of a TAGS lookup
 *   lookupCalls(src)       -> { calls: [{ fn, line, args, literals }], unclosed: [{ fn, line }] }
 *
 * WHY THIS IS ITS OWN FILE, 2026-09-11 (MEASURE). `tests/mutation_harness.js` carried the only lookup
 * detector in the repository as a regex:
 *
 *     /TAGS\.(?:param|has|withTag|reactorsTo)\(([^;]{0,220}?)\)/g
 *
 * The lazy `?` stops at the FIRST `)`, so a call with a nested call in its arguments was cut before its
 * tag. `engine/medicham2-browser.js` reads Heavy Metal and Light Metal as
 *
 *     TAGS.param('ability',(m.ability||'').replace(/[^a-z0-9]/g,''),'modifiesWeight')
 *
 * and the regex saw only `'ability',(m.ability||''` — so `modifiesWeight` read as NO LOOKUP while its
 * census row was LIVE. A detector that is blind in exactly the calls that do real work (normalising an
 * id before the lookup) says "unconsumed" about the tags the engine reads most carefully.
 *
 * `engine/tag_dex.js` (ENGINE's file) decides `consumedBy` by grepping for a hint string instead, which
 * is a second, different detector for the same fact. It is not changed here; this module is where it
 * should come to, so the two cannot disagree (docs/_reports/2026-09-11-plan-tags.md, batch B1).
 *
 * THE RULE. From each `TAGS.<fn>(` the argument list is scanned to its BALANCED close: strings,
 * template literals, regex literals and comments are skipped, so a `)` inside any of them does not
 * close the call. A tag is a string literal at the call's OWN argument level — not inside a nested
 * call, array or object — which is where `param(kind, id, tag)`, `has(kind, id, tag)` and
 * `withTag(kind, tag)` put it (engine/tags.js). A literal inside a nested `.replace('x','y')` is an
 * argument of `replace`, not a tag, and the old regex would have counted it had it ever reached it.
 * The three KIND words are dropped because they sit in the same argument list and are not tags.
 *
 * A CALL THAT DOES NOT CLOSE WITHIN `MAX_ARGS` CHARACTERS IS REPORTED, NEVER DROPPED IN SILENCE. It
 * appears in `unclosed` with its line, so a reader can see the detector gave up rather than infer the
 * call names nothing. */
'use strict';

const FNS = /TAGS\.(param|has|withTag|reactorsTo)\(/g;
const KINDS = new Set(['move', 'item', 'ability']);
const MAX_ARGS = 2000;
const TAG_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/* A `/` opens a regex literal when the last significant character cannot end an operand. */
const REGEX_AFTER = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));

function lineOf(src, at) {
  let n = 1;
  for (let i = 0; i < at; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

/* Scan one argument list starting just after its `(`. Returns { end, literals } where `end` is the
 * index of the matching `)`, or -1 if none was found inside MAX_ARGS characters. */
function scanArgs(src, start) {
  const literals = [];
  let depth = 0, prev = '(';
  const limit = Math.min(src.length, start + MAX_ARGS);
  for (let i = start; i < limit; i++) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); if (nl < 0) return { end: -1, literals }; i = nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) return { end: -1, literals }; i = e + 1; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      for (; j < limit; j++) { if (src[j] === '\\') { j++; continue; } if (src[j] === c) break; }
      if (j >= limit) return { end: -1, literals };
      if (depth === 0 && c !== '`') literals.push(src.slice(i + 1, j));
      i = j; prev = c; continue;
    }
    if (c === '/' && REGEX_AFTER.has(prev)) {
      let j = i + 1, inClass = false;
      for (; j < limit; j++) {
        const d = src[j];
        if (d === '\\') { j++; continue; }
        if (d === '\n') break;
        if (inClass) { if (d === ']') inClass = false; continue; }
        if (d === '[') inClass = true; else if (d === '/') break;
      }
      if (j >= limit || src[j] !== '/') return { end: -1, literals };
      i = j; prev = 'r'; continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return c === ')' ? { end: i, literals } : { end: -1, literals };
      depth--;
    }
    prev = c;
  }
  return { end: -1, literals };
}

function lookupCalls(src) {
  const calls = [], unclosed = [];
  FNS.lastIndex = 0;
  let m;
  while ((m = FNS.exec(src))) {
    const start = m.index + m[0].length;
    const r = scanArgs(src, start);
    if (r.end < 0) { unclosed.push({ fn: m[1], line: lineOf(src, m.index) }); continue; }
    calls.push({ fn: m[1], line: lineOf(src, m.index), args: src.slice(start, r.end),
                 literals: r.literals.filter(s => TAG_NAME.test(s) && !KINDS.has(s)) });
  }
  return { calls, unclosed };
}

function sourceConsumers(src) {
  const set = new Set();
  const r = lookupCalls(src);
  for (const c of r.calls) for (const t of c.literals) set.add(t);
  if (r.unclosed.length) console.error('tag_lookups: ' + r.unclosed.length + ' TAGS lookup(s) did not close within '
    + MAX_ARGS + ' characters and name NOTHING in this set — lines '
    + r.unclosed.slice(0, 10).map(u => u.line).join(', ') + (r.unclosed.length > 10 ? ', ...' : ''));
  return set;
}

module.exports = { sourceConsumers, lookupCalls, scanArgs, MAX_ARGS };
