/* test-json-nan-guard.js — A PYTHON GENERATOR MUST NOT BE ABLE TO WRITE A FILE JAVASCRIPT CANNOT READ.
 *
 * THE DEFECT THIS EXISTS FOR, found 2026-08-06 by the PORYGON2 separation gate on its own output.
 *
 * Python's `json.dump` writes a BARE `NaN` by default — and `Infinity`, and `-Infinity`. None of the
 * three is valid JSON. `JSON.parse` throws on all of them. So the file round-trips perfectly in
 * Python, looks completely fine to whoever wrote it, and is unreadable to every JavaScript consumer
 * in this repository.
 *
 * IT IS NOT THE UNREADABILITY THAT MAKES THIS A GATE. It is what happened next. The first
 * `data/porygon2-separation-gate.json` carried `"R_same_over_unrelated": NaN`.
 * `engine/provenance.js` — the tool whose entire job is to say which artifacts can be trusted —
 * could not parse the file, and REPORTED IT `ok`. Every declaration inside became invisible,
 * including the artifact's own `void` flag, which exists precisely so that a generator can condemn
 * its own run. An artifact that cannot be opened was classified as healthy.
 *
 * That is this project's signature failure shape, and it is the third instance of it recorded in
 * one day: the census counting probes that EXECUTED rather than mechanics that WORK; the interaction
 * matrix reporting 899/899 while silently dropping 5,090 pairs; and this.
 *
 * WHY THE RISK CONCENTRATES WHERE IT HURTS MOST. A NaN arises exactly where a denominator went to
 * zero — an empty stratum, a bootstrap resample with no variance, a rate over a category nobody
 * played. So the generators most likely to emit one are the STATISTICAL ones, and the field most
 * likely to be NaN is the RESULT rather than a decoration. The artifacts this protects are the ones
 * carrying rates, intervals and verdicts.
 *
 * WHAT `allow_nan=False` ACTUALLY BUYS. It is not cosmetic. It makes the generator RAISE at write
 * time — at the moment the maths went wrong, with a stack trace pointing at it — instead of
 * shipping a file nobody can open and discovering it hours later through a downstream tool that
 * happened to be JavaScript.
 *
 * RATCHETED, not asserted at zero, so the check can be introduced without a flag day and can never
 * quietly regress: the unguarded count MAY FALL AND MAY NEVER RISE.
 *
 * Proven red before it was trusted — see `--selftest`, which plants an unguarded call in a scratch
 * copy and asserts this file rejects it. `node tests/test-json-nan-guard.js --selftest`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, 'data', 'json-nan-guard-baseline.json');
const SKIP_DIRS = new Set(['node_modules', '.git', 'archive', '__pycache__', 'venv', '.venv']);

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ok   ' + m); };
const bad = (m) => { fail++; console.log('  FAIL ' + m); };

/* PAREN-MATCHING, NOT REGEX. Several of these calls open `json.dump({` and span many lines, so
 * scanning to the first `)` would judge a nested dict literal instead of the call. Quotes are
 * tracked so a bracket inside a string does not move the depth. */
function callsIn(src) {
  const out = [];
  const re = /json\.dumps?\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, k = m.index + m[0].length, quote = null;
    while (k < src.length && depth > 0) {
      const c = src[k];
      if (quote) {
        if (c === '\\') { k += 2; continue; }
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      k++;
    }
    if (depth !== 0) continue;                       // unbalanced: not ours to judge
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ line, text: src.slice(m.index, k), guarded: /allow_nan\s*=\s*False/.test(src.slice(m.index, k)) });
    re.lastIndex = k;
  }
  return out;
}

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.py')) acc.push(p);
  }
  return acc;
}

function scan(root) {
  const unguarded = [];
  let total = 0, files = 0;
  for (const p of walk(root, [])) {
    const src = fs.readFileSync(p, 'utf8');
    const calls = callsIn(src);
    if (!calls.length) continue;
    files++;
    for (const c of calls) {
      total++;
      if (!c.guarded) unguarded.push(path.relative(root, p).replace(/\\/g, '/') + ':' + c.line);
    }
  }
  return { unguarded, total, files };
}

/* ---- SELFTEST: the check must reject a planted unguarded call ------------------------------- */
if (process.argv.includes('--selftest')) {
  console.log('SELFTEST — plant an unguarded json.dump and assert this file rejects it\n');
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nanguard-'));
  fs.writeFileSync(path.join(tmp, 'clean.py'),
    'import json\njson.dump({"a": 1}, open("x", "w"), indent=2, allow_nan=False)\n');
  const a = scan(tmp);
  a.unguarded.length === 0 ? ok('a guarded call is accepted (0 unguarded of ' + a.total + ')')
                           : bad('a guarded call was rejected: ' + a.unguarded.join(', '));

  fs.writeFileSync(path.join(tmp, 'planted.py'),
    'import json\njson.dump({"r": float("nan")}, open("y", "w"), indent=2)\n');
  const b = scan(tmp);
  b.unguarded.some(u => u.startsWith('planted.py'))
    ? ok('the planted unguarded call is CAUGHT — ' + b.unguarded.filter(u => u.startsWith('planted.py')).join(', '))
    : bad('THE GATE IS BLIND: it did not catch a bare json.dump. It would pass on known-bad input.');

  /* The multi-line shape is the one a regex gets wrong, so it is tested explicitly. */
  fs.writeFileSync(path.join(tmp, 'multiline.py'),
    'import json\njson.dump({\n  "nested": {"k": [1, 2, 3]},\n  "b": 2,\n},\n  open("z", "w"),\n  indent=2)\n');
  const c = scan(tmp);
  c.unguarded.some(u => u.startsWith('multiline.py'))
    ? ok('a MULTI-LINE unguarded call spanning a nested dict is caught')
    : bad('a multi-line unguarded call was missed — the paren matcher is wrong');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nSELFTEST: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

/* ---- THE GATE ------------------------------------------------------------------------------- */
console.log('JSON NaN GUARD — a Python generator must not be able to write a file JS cannot read\n');

const { unguarded, total, files } = scan(ROOT);
console.log('  ' + total + ' json.dump/dumps call(s) across ' + files + ' Python file(s)');
console.log('  ' + (total - unguarded.length) + ' guarded, ' + unguarded.length + ' unguarded\n');

let base = null;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).unguarded; } catch (e) { base = null; }

if (base == null) {
  console.log('  NOTE: no baseline on disk — writing one. The count may fall and may never rise.');
} else if (unguarded.length > base) {
  bad('unguarded json.dump calls ' + base + ' -> ' + unguarded.length + '. A NEW one can ship an '
    + 'artifact JavaScript cannot parse, and engine/provenance.js reported exactly that file as `ok`.');
  unguarded.forEach(u => console.log('         ' + u));
} else if (unguarded.length < base) {
  ok('unguarded fell ' + base + ' -> ' + unguarded.length + ' (ratchet tightens)');
} else {
  ok('unguarded held at ' + unguarded.length);
}

if (unguarded.length) {
  console.log('\n  STILL UNGUARDED:');
  unguarded.forEach(u => console.log('    ' + u));
  console.log('  Fix: pass allow_nan=False. It makes the generator RAISE where the maths went wrong,');
  console.log('  instead of shipping a file that looks fine from Python and throws in every JS reader.');
}

/* THE ARTIFACTS THEMSELVES, because a guarded generator says nothing about a file written before the
 * guard existed. This is the outcome the source check is a proxy for, so it is asserted directly. */
const dataDir = path.join(ROOT, 'data');
const broken = [];
for (const f of fs.readdirSync(dataDir).filter(x => x.endsWith('.json'))) {
  const s = fs.readFileSync(path.join(dataDir, f), 'utf8');
  if (/:\s*(NaN|-?Infinity)\s*[,}\]]/.test(s)) broken.push(f);
}
broken.length ? bad('shipped artifact(s) carry a bare NaN/Infinity and cannot be parsed: ' + broken.join(', '))
              : ok('no shipped artifact in data/ carries a bare NaN or Infinity');

if (base == null || unguarded.length < base) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    unguarded: unguarded.length,
    note: 'RATCHET: may fall, may never rise. See tests/test-json-nan-guard.js for why this exists.',
    updated: new Date().toISOString().slice(0, 10),
    remaining: unguarded,
  }, null, 2) + '\n');
  console.log('\n  (baseline written: data/json-nan-guard-baseline.json)');
}

console.log('\nJSON NaN GUARD: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
