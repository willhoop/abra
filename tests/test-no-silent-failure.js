/* test-no-silent-failure.js — a catch block may not discard the reason.
 *
 * WHY THIS EXISTS (whole-repo review, 2026-07-31)
 * ----------------------------------------------
 * 164 confirmed findings clustered into four habits, and the largest by far was this one: something
 * failed, the failure was caught and discarded, and a plausible-looking default was substituted. The
 * code then ran cleanly and reported success. Four of them had never worked once:
 *
 *   engine/magnemite.js    `dex` out of scope -> ReferenceError -> bare catch -> an EMPTY duration
 *                          table cached permanently. Every volatile duration in every scored game
 *                          this project has ever played was the fallback 3.
 *   engine/champions_sim.js  used fs without requiring it, so the derived-format read threw every
 *                          time and the hardcoded literal in the catch is the only path ever run.
 *   engine/ditto.js        `catch(e){ return null }` around the referee, so a missing require and an
 *                          unbuildable matchup were indistinguishable; both read as a tasteful "n/a"
 *                          while the file printed a FINAL TEAM.
 *   engine/sprt.js         (mine, written the same day) readFileSync inside a bare catch; on a
 *                          1.59 GB corpus V8 threw ERR_STRING_TOO_LONG and the tool reported "no
 *                          records read" as though the run had produced nothing.
 *
 * The last one matters most for justifying this file: it was written by someone who had just
 * finished documenting the habit. Discipline demonstrably does not prevent it. A check does.
 *
 * WHAT COUNTS AS NOT-SILENT. The body must do at least one of: rethrow, report (console.*), exit,
 * or record the failure somewhere a human or a later assertion can see (a counter, a push, an
 * assignment to something named like an error). Returning a default and saying nothing is silent.
 *
 * IT IS A RATCHET, NOT A BIG BANG. There were 75 bare catches in engine/ when this was written and
 * stopping the world for all of them would mean it never lands. The baseline is GENERATED, never
 * typed (S13): `node tests/test-no-silent-failure.js --update` records what exists today, and the
 * test fails on anything NEW. The baseline is keyed by a hash of the catch body rather than by line
 * number, so it survives edits elsewhere in the file but does NOT survive someone quietly changing
 * what a known-silent catch does.
 *
 * The count is printed every run, so the number going DOWN is visible and going up is impossible.
 *
 *   node tests/test-no-silent-failure.js            check
 *   node tests/test-no-silent-failure.js --update   re-baseline (do this when you FIX some)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, 'data', 'silent-catch-baseline.json');
const UPDATE = process.argv.includes('--update');
const DIRS = ['engine', 'build', 'tests'];

/* ---- strip what would confuse a brace scanner ------------------------------------------------
 * Comments, strings, template literals and regex literals are replaced by spaces of the same length
 * so every offset in the stripped text still maps to the original. Written out because a naive
 * regex over raw source would treat a brace inside a string as structure. */
function blank(src) {
  const out = src.split('');
  let i = 0, n = src.length;
  const isRegexPos = (j) => {
    for (let k = j - 1; k >= 0; k--) {
      const c = src[k];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
      return !/[A-Za-z0-9_$)\]]/.test(c);      // after an operator/paren-open -> a regex can start
    }
    return true;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') out[i++] = ' '; continue; }
    if (c === '/' && d === '*') { out[i++] = ' '; out[i++] = ' ';
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; }
      if (i < n) { out[i++] = ' '; out[i++] = ' '; } continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out[i++] = ' ';
      while (i < n) {
        if (src[i] === '\\') { out[i++] = ' '; if (i < n) { if (src[i] !== '\n') out[i] = ' '; i++; } continue; }
        if (src[i] === q) { out[i++] = ' '; break; }
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && isRegexPos(i)) {
      let j = i + 1, ok = false;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '\n') break;
        if (src[j] === '[') { while (j < n && src[j] !== ']' && src[j] !== '\n') j++; }
        if (src[j] === '/') { ok = true; break; }
        j++;
      }
      if (ok) { for (let k = i; k <= j; k++) if (src[k] !== '\n') out[k] = ' '; i = j + 1; continue; }
    }
    i++;
  }
  return out.join('');
}

/* ---- find every catch body -------------------------------------------------------------------- */
function catches(src) {
  const b = blank(src);
  const found = [];
  const re = /\bcatch\b/g;
  let m;
  while ((m = re.exec(b))) {
    let i = m.index + 5;
    while (i < b.length && /\s/.test(b[i])) i++;
    if (b[i] === '(') { let depth = 0; for (; i < b.length; i++) { if (b[i] === '(') depth++; else if (b[i] === ')') { depth--; if (!depth) { i++; break; } } } }
    while (i < b.length && /\s/.test(b[i])) i++;
    if (b[i] !== '{') continue;                       // not a catch clause we understand
    const start = i;
    let depth = 0, end = -1;
    for (; i < b.length; i++) {
      if (b[i] === '{') depth++;
      else if (b[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) continue;
    const line = src.slice(0, m.index).split('\n').length;
    found.push({ line, bodyRaw: src.slice(start + 1, end), bodyStripped: b.slice(start + 1, end) });
  }
  return found;
}

/* A body is NOT silent if it rethrows, reports, exits, or records the failure somewhere visible. */
const SPEAKS = [
  /\bthrow\b/,                       // rethrow
  /\bconsole\s*\./,                  // report
  /\bprocess\s*\.\s*exit\b/,         // stop
  /\+\+/, /\+=/,                     // a counter
  /\.push\s*\(/,                     // recorded into a list of failures
  /\b(err|error|fail|failure|failed|warn)\w*\s*=/i,   // stashed for a later assertion
  /\blog\w*\s*\(/i,
  /* CALLING a failure recorder is reporting. tests/test-stadium-roster.js's `catch { fail(msg) }`
   * counts AND prints through its own `fail()` helper and was flagged as silent, which is a false
   * positive — a wrongly-red ratchet is how a ratchet gets ignored. Call syntax only: a bare
   * mention of a name like `failCount` in a condition does not qualify. This can only SHRINK the
   * silent set, which is the one direction a detector change here is allowed to move it. */
  /\bfail\w*\s*\(/i,
  /* WRITING TO stderr IS REPORTING. The list recognised `console.*` and missed
   * `process.stderr.write`, which is the same act through a lower-level door — and it is the door a
   * library uses when it must not assume a console exists. `engine/job_cost.js` was flagged for a
   * catch whose entire body writes the failure to stderr. Same false-positive class as `fail(` above,
   * same justification: this can only SHRINK the silent set, which is the one direction a detector
   * change here is allowed to move it. */
  /\bprocess\s*\.\s*std(err|out)\s*\.\s*write\s*\(/,
  /* CARRYING THE MESSAGE INTO THE VALUE UNDER TEST IS REPORTING, and it is the loudest form of it —
   * louder than a counter, because a later assertion cannot help but read it.
   *
   * `tests/mutation_harness.js` writes `'THREW:' + e.message` into the digest it then COMPARES, so a
   * mutation that makes the engine throw is distinguishable from one that changes its output; its
   * own `threwAnywhere()` reads the string back. Three of its catches were flagged silent while the
   * failure reason was travelling in the return value the whole time.
   *
   * The pattern is deliberately narrow: the caught binding's `.message` (or the binding itself) must
   * appear inside a STRING CONCATENATION or template, which is what "the reason is being carried
   * somewhere" looks like. A bare `e` in a condition still does not qualify. Same justification as
   * `fail(` and `process.stderr.write` above: this can only SHRINK the silent set, which is the one
   * direction a detector change here is allowed to move it. */
  /\.\s*message\b/,
  /* AND THE LIMIT OF THAT PATTERN, STATED RATHER THAN DISCOVERED LATER: a catch that reads
   * `e.message` only to BRANCH on it and then discards it — `if (e.message === 'x') return null` —
   * still passes this test while being genuinely silent. That case is accepted knowingly. The
   * alternative is telling four honest catches they are silent, and a wrongly-red ratchet is how a
   * ratchet gets ignored, which this file has already been corrected for twice. */
];
const isSilent = (body) => !SPEAKS.some(re => re.test(body));

/* ---- NOT ALL SILENCE IS EQUAL, and treating it as such is how a guard becomes noise ------------
 *
 * `catch (e) { continue; }` while parsing a ragged JSONL line is CORRECT silence: nothing failed,
 * the data was torn, and forcing it to shout would train everyone to ignore this check.
 *
 * The catches that have actually cost this project something share one shape: the body MANUFACTURES
 * A VALUE that something downstream then trusts.
 *
 *   magnemite.js   cached an empty duration table   -> every duration became the fallback 3
 *   ditto.js       returned null from the referee   -> sorted, and a team was recommended anyway
 *   sprt.js        returned an empty array          -> read as "the run produced no games"
 *   board.js       (not a catch, same shape)        -> a dropped key made a live feature constant
 *
 * So: a silent catch that RETURNS a value, or ASSIGNS to something, or writes into a map/array, is
 * manufacturing an answer. One that only skips, continues, or breaks is not. The first group is
 * where every real defect has been; the second is mostly legitimate.
 *
 * Approximated without a parser, deliberately conservatively — `=` catches assignment but also `==`
 * and `=>`, so those are excluded explicitly rather than being allowed to inflate the count. */
const MANUFACTURES = [
  /\breturn\b(?!\s*;)/,             // returns an actual value (bare `return;` is just an exit)
  /[^=!<>]=(?!=|>)/,                 // an assignment, excluding ==, ===, !=, <=, >=, =>
  /\.set\s*\(/, /\.push\s*\(/,      // written into a map or list
];
const manufactures = (body) => MANUFACTURES.some(re => re.test(body));

const hash = (s) => crypto.createHash('sha1').update(s.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);

/* ---- scan --------------------------------------------------------------------------------------- */
const silent = [];
let scanned = 0, total = 0;
for (const dir of DIRS) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.js')) continue;
    const rel = dir + '/' + f;
    let src; try { src = fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) { continue; }
    scanned++;
    for (const c of catches(src)) {
      total++;
      if (!isSilent(c.bodyStripped)) continue;
      silent.push({ file: rel, line: c.line, hash: hash(c.bodyRaw),
                    manufactures: manufactures(c.bodyStripped),
                    body: c.bodyRaw.replace(/\s+/g, ' ').trim().slice(0, 70) });
    }
  }
}

/* ---- baseline ------------------------------------------------------------------------------------ */
if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    by: 'tests/test-no-silent-failure.js --update',
    note: 'GENERATED. Silent catch blocks that existed when the ratchet was set. Never hand-edit: '
        + 're-run with --update after FIXING some, so this number only ever goes down.',
    count: silent.length,
    /* COUNTS, NOT A SET. Keying on file#hash alone collapsed 229 silent blocks into 184 keys,
     * because `catch (e) {}` and `catch (e) { /* ignore *\/ }` hash identically wherever they appear.
     * A set therefore could not tell a THIRD identical silent catch in the same file from the two
     * already baselined — the ratchet would have been fooled by the commonest shape of the very
     * thing it exists to stop. Counting per key is edit-resilient (a change elsewhere in the file
     * does not move the key) and still catches duplication. */
    entries: (() => {
      const m = {};
      for (const s of silent) { const k = `${s.file}#${s.hash}`; m[k] = (m[k] || 0) + 1; }
      return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a < b ? -1 : 1));
    })(),
  }, null, 1));
  console.log(`baselined ${silent.length} silent catch blocks across ${scanned} files -> ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

if (process.argv.includes('--dangerous')) {
  const d = silent.filter(s => s.manufactures);
  console.log(`SILENT CATCHES THAT MANUFACTURE A VALUE — ${d.length} of ${silent.length}\n`);
  const byFile = {};
  for (const s of d) (byFile[s.file] = byFile[s.file] || []).push(s);
  for (const [f, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${f}  (${list.length})`);
    for (const s of list) console.log(`      :${String(s.line).padEnd(5)} ${s.body}`);
  }
  process.exit(0);
}

let base = null;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { /* first run */ }
if (!base) {
  console.error('NO BASELINE. Run:  node tests/test-no-silent-failure.js --update');
  process.exit(2);
}
/* Old baselines were an array of keys; treat those as count 1 each so the file can be re-based
 * without a flag day. */
const rawEntries = base.entries || {};
const known = Array.isArray(rawEntries)
  ? rawEntries.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {})
  : rawEntries;

const now = {};
for (const s of silent) { const k = `${s.file}#${s.hash}`; (now[k] = now[k] || []).push(s); }

/* NEW = this key appears MORE times than the baseline allows. The extras are the new ones. */
const fresh = [];
for (const [k, list] of Object.entries(now)) {
  const allowed = known[k] || 0;
  if (list.length > allowed) fresh.push(...list.slice(allowed));
}
const knownTotal = Object.values(known).reduce((a, b) => a + b, 0);
const gone = Object.entries(known)
  .filter(([k, n]) => (now[k] ? now[k].length : 0) < n)
  .map(([k, n]) => `${k} (${n - (now[k] ? now[k].length : 0)})`);

console.log('SILENT FAILURE RATCHET — a catch block may not discard the reason\n');
console.log(`  files scanned            ${scanned}`);
console.log(`  catch blocks             ${total}`);
const danger = silent.filter(s => s.manufactures);
console.log(`  silent (say nothing)     ${silent.length}   of ${total}  (${(100 * silent.length / Math.max(1, total)).toFixed(0)}%)`);
console.log(`    of those, MANUFACTURE  ${danger.length}   <- these hand a made-up value downstream`);
console.log(`    merely skip/continue   ${silent.length - danger.length}   <- usually legitimate`);
console.log(`  baselined                ${knownTotal}`);
console.log(`  FIXED since the baseline ${gone.length}`);
console.log(`  NEW since the baseline   ${fresh.length}`);

if (fresh.length) {
  console.log('\n  NEW SILENT CATCH BLOCKS — each of these discards the reason something failed:');
  /* `--all` prints every one WITH ITS BODY. The 25-line cap is right for a gate — a wall of text is
   * a wall nobody reads — but a truncated list cannot be worked through, and "... and 27 more" is
   * how the tail of a list stops being anybody's job. */
  const ALL = process.argv.includes('--all');
  const show = ALL ? fresh : fresh.slice(0, 25);
  for (const s of show) console.log(`    ${s.file}:${s.line}${ALL ? (s.manufactures ? '   [MANUFACTURES]  ' : '                 ') + s.body : ''}`);
  if (!ALL && fresh.length > 25) console.log(`    ... and ${fresh.length - 25} more  (--all to list them)`);
  console.log('\n  Make it speak: rethrow, console.error it, count it, or record it somewhere a later');
  console.log('  assertion can see. If a silent fallback is genuinely right here, say why in the code');
  console.log('  and re-baseline with --update so the exception is deliberate and visible.');
  process.exit(1);
}
if (gone.length) console.log(`\n  ${gone.length} baselined block(s) now speak. Re-run with --update to lock the gain in.`);
console.log('\n  no NEW silent failures.');
process.exit(0);
