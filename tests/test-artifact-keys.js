/* test-artifact-keys.js — any artifact whose keys can be MISSED must declare how it is read.
 *
 *   node tests/test-artifact-keys.js            check
 *   node tests/test-artifact-keys.js --list     show every name-keyed table and its key style
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-01 `MC.mons` was found to key formes with a hyphen (`rotom-wash`) while every caller
 * looked it up with `norm()`, which strips punctuation. 101 of 308 entries were unreachable, covering
 * 8.17% of observed metagame usage, and it failed SILENTLY -- a missing key reads as "never seen this
 * Pokemon", which is a legitimate answer.
 *
 * `tests/test-mc-key.js` bans hand-rolled lookups into that ONE table. This file is the general case,
 * and it is the answer to "will the fix apply to all our artifacts": it does not sweep them, it
 * DETECTS the ones that could ever have the same problem, and requires each to name the accessor that
 * reads it.
 *
 * THE RULE, and it is narrow on purpose:
 *
 *   A name-keyed lookup table whose keys are NOT all flat-lowercase can be missed by a caller that
 *   normalises. Every such table must be listed in data/artifact-accessors.json, naming the one
 *   function allowed to read it. A table whose keys ARE all flat-lowercase cannot be missed by
 *   norm(), so it needs nothing.
 *
 * MEASURED WHEN WRITTEN. Of eleven real name-keyed tables in data/ with 50+ keys, nine are entirely
 * flat-lowercase and structurally immune. Two are not: MC.mons (fixed, accessor engine/mc_key.js)
 * and porygon2-species.json (one consumer, which also generates it). So the exposure was two tables,
 * not ninety-six files -- which is why this is a detector and not a migration.
 *
 * WHAT IT BUYS: the next artifact somebody generates with hyphenated or capitalised keys fails this
 * test until they say who reads it. That is the point at which the question is cheap to answer.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('ARTIFACT KEYS — a table whose keys can be missed must declare its accessor\n');

/* A real lookup table, not a metadata blob: enough keys to be a table, and keys shaped like names.
 * The 50 floor is what separates `{generated, corpus, weights}` from `{incineroar, garchomp, ...}`. */
const MIN_KEYS = 50;
const NAMEISH = /^[a-z0-9][a-z0-9 '.:-]{1,30}$/i;
const FLAT = /^[a-z0-9]+$/;

function tables(obj, depth, at, out) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 3) return;
  const ks = Object.keys(obj);
  if (ks.length >= MIN_KEYS && ks.filter(k => NAMEISH.test(k)).length / ks.length > 0.9) {
    const notFlat = ks.filter(k => !FLAT.test(k));
    out.push({ at: at || '(root)', n: ks.length, notFlat: notFlat.length, sample: notFlat.slice(0, 3) });
    return;                                   // a table's VALUES are not themselves tables to report
  }
  for (const k of ks.slice(0, 8)) tables(obj[k], depth + 1, at ? `${at}.${k}` : k, out);
}

/* ---- every name-keyed table in the project ---------------------------------------------------- */
const found = [];
const unparseable = [];
for (const f of fs.readdirSync(D('data'))) {
  if (!/\.json$/.test(f)) continue;
  let j;
  /* A data file that will not parse is not "no tables here" — it is an artifact this guard cannot
   * see into, which is exactly the blind spot the guard exists to remove. Counted and named. */
  try { j = JSON.parse(fs.readFileSync(D('data', f), 'utf8')); }
  catch (e) { unparseable.push(`${f} (${e.message.slice(0, 40)})`); continue; }
  const out = [];
  tables(j, 0, '', out);
  out.forEach(t => found.push({ artifact: f, ...t }));
}

/* engine-data.js is a SCRIPT, not JSON -- it publishes globalThis.MC -- and it is the table that
 * caused all of this, so it would be absurd for the general guard to skip it. */
try {
  require(D('data', 'engine-data.js'));
  /* THE DOOR IS LOADED BESIDE THE TABLE, ALWAYS. engine/mc_key.js installs the SEAL on MC.mons --
   * a raw read of a key the table does not have then THROWS instead of returning undefined, which
   * is how the same species-key bug went unnoticed four separate times. Requiring it here is not
   * decoration: section 4 of tests/test-mc-key.js FAILS on any file that loads the table without
   * it, because a seal that depends on load order is a seal that is sometimes absent. */
    require(D('engine', 'mc_key.js'));
  for (const name of ['mons', 'moves']) {
    const t = globalThis.MC && globalThis.MC[name];
    if (!t) continue;
    const ks = Object.keys(t);
    if (ks.length < MIN_KEYS) continue;
    const notFlat = ks.filter(k => !FLAT.test(k));
    found.push({ artifact: 'engine-data.js', at: `MC.${name}`, n: ks.length, notFlat: notFlat.length, sample: notFlat.slice(0, 3) });
  }
} catch (e) {
  console.error('  (could not load data/engine-data.js: ' + e.message + ')');
}

ok(found.length > 0, `found ${found.length} name-keyed lookup tables with ${MIN_KEYS}+ keys`);
ok(unparseable.length === 0,
  `every data/*.json parsed, so none is invisible to this guard (${unparseable.join(', ') || 'all parsed'})`);

if (process.argv.includes('--list')) {
  console.log('\n  ' + 'artifact'.padEnd(30) + 'table'.padEnd(14) + 'keys'.padStart(6) + '   key style');
  for (const t of found.sort((a, b) => b.notFlat - a.notFlat || b.n - a.n)) {
    console.log('  ' + t.artifact.padEnd(30) + String(t.at).slice(0, 13).padEnd(14) + String(t.n).padStart(6)
      + '   ' + (t.notFlat ? `NOT FLAT: ${t.notFlat} (${t.sample.join(', ')})` : 'flat-lowercase — cannot be missed'));
  }
  process.exit(0);
}

/* ---- the ones that can be missed must be declared ---------------------------------------------- */
const REG_FILE = D('data', 'artifact-accessors.json');
const reg = fs.existsSync(REG_FILE) ? JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) : { accessors: {} };
const declared = reg.accessors || {};

const risky = found.filter(t => t.notFlat > 0);
const safe = found.filter(t => t.notFlat === 0);
console.log(`  ${safe.length} table(s) are flat-lowercase and structurally immune; ${risky.length} can be missed`);

const undeclared = risky.filter(t => !declared[`${t.artifact}:${t.at}`]);
ok(undeclared.length === 0,
  'every table whose keys can be missed names the accessor that reads it'
  + (undeclared.length ? ` — UNDECLARED: ${undeclared.map(t => `${t.artifact}:${t.at}`).join(', ')}` : ''));

if (undeclared.length) {
  console.log('\n  Add each to data/artifact-accessors.json with the ONE function allowed to read it,');
  console.log('  or make the generator emit flat-lowercase keys so the question cannot arise.');
  console.log('  See docs/ARTIFACT-ACCESS-RULES.md and engine/mc_key.js for the worked example.\n');
}

/* A declaration that points at a file which does not exist is worse than none: it reads as handled. */
const dangling = Object.entries(declared)
  .filter(([, v]) => v && v.accessor && !fs.existsSync(D(v.accessor)))
  .map(([k, v]) => `${k} -> ${v.accessor}`);
ok(dangling.length === 0, `every declared accessor file exists (${dangling.join(', ') || 'none dangling'})`);

/* And a declaration for a table that no longer has risky keys is stale -- report it so the registry
 * shrinks as generators are cleaned up, rather than accumulating dead entries. */
const stale = Object.keys(declared).filter(k => !risky.some(t => `${t.artifact}:${t.at}` === k));
if (stale.length) console.log(`  (${stale.length} declaration(s) no longer needed — table is flat now: ${stale.join(', ')})`);

console.log(`\nARTIFACT KEY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
