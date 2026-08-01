/* test-site-data-fresh.js — the site may not serve a number older than the data it claims to describe.
 *
 * WHY THIS EXISTS (Will, 2026-08-01: "so now other sites on the site might be old")
 * --------------------------------------------------------------------------------
 * He asked because CHOMP had just been caught: data/chomp-ev.json was four days old, the site derived
 * its status from it honestly, and published "does not beat a coin" about a model that — re-run on
 * the current corpus — has a directional edge whose interval clears 0.5. Nothing anywhere noticed
 * that an evaluation had aged. The derivation was right; its input had rotted.
 *
 * The audit that followed found two more on the page itself:
 *
 *   data/mag.js                 0.8 days stale — the site was serving MAG's PRE-REFIT weights, the
 *                               ones fitted against the wrong population and replaced at 00:28.
 *   data/slowking-playstyle.js  3.8 days stale, and NO GENERATOR WRITES IT. Only sanity_check.py
 *                               reads it. It cannot be refreshed at all.
 *
 * TWO SEPARATE CLAIMS, AND THE SECOND IS THE WORSE ONE:
 *
 *   FRESH        the file is newer than the newest game corpus it could have been computed from.
 *                A stale file is a wrong number with a confident presentation.
 *   REGENERABLE  some script in the repository writes it. A file with no generator cannot be
 *                brought up to date by anyone, so it is not merely stale — it is permanently stale,
 *                and it will still be on the page in a year.
 *
 * The orphan check is the one that matters long-term. data/meta-nash.json was found the same way and
 * carries an explicit "must_not_be_quoted" stanza for exactly this reason.
 *
 * A BASELINE, NOT A BIG BANG, for the same reason the silent-catch ratchet has one: failing the suite
 * on every known orphan means the check never lands. Known orphans are recorded with a reason and
 * the test fails on NEW ones. Generated, never typed.
 *
 *   node tests/test-site-data-fresh.js            check
 *   node tests/test-site-data-fresh.js --update   re-baseline after fixing or accepting one
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const BASELINE = D('data', 'site-data-orphans.json');
const UPDATE = process.argv.includes('--update');

let pass = 0, fail = 0;
const ok = (cond, what, detail) => {
  if (cond) { pass++; console.log(`  ok   ${what}`); }
  else { fail++; console.log(`  FAIL ${what}${detail ? '   -- ' + detail : ''}`); }
};

/* ---- what the site actually loads, read from the page rather than listed here ------------------ */
const PAGES = fs.readdirSync(D('app')).filter(f => f.endsWith('.html'));
const loaded = new Map();          // data/x.js -> [pages]
for (const pg of PAGES) {
  const html = fs.readFileSync(D('app', pg), 'utf8');
  for (const m of html.matchAll(/<script src="\.\.\/(data\/[^"]+)"/g)) {
    if (!loaded.has(m[1])) loaded.set(m[1], []);
    loaded.get(m[1]).push(pg);
  }
}
ok(loaded.size > 0, `the site loads ${loaded.size} data files across ${PAGES.length} pages`,
  'no <script src="../data/..."> found — this test is not reaching the pages');

/* ---- the newest game data anything could have been computed from ------------------------------- */
const corpora = fs.readdirSync(D('data'))
  .filter(f => /^games\..*\.jsonl$/.test(f) && !/raw-logs/.test(f));
let newest = 0, newestName = null;
for (const f of corpora) {
  const m = fs.statSync(D('data', f)).mtimeMs;
  if (m > newest) { newest = m; newestName = f; }
}
ok(newest > 0, `found the newest game corpus (${newestName})`, 'no games.*.jsonl on disk');

/* ---- does anything in the repo write this file? ------------------------------------------------
 * Scanned rather than listed: a hand-kept map of generators is the same hand-maintained state this
 * project has been burned by, one level up. */
const GEN_DIRS = ['build', 'engine', 'tools', 'scripts'];
/* THE WRITE DETECTOR MUST SURVIVE A NESTED CALL. The first version used
 * open\s*\([^)]*['"][wa], whose [^)]* stops at the FIRST ')' — so open(P('data','x.js'),'w') never
 * matched and three generated files were reported as orphans. A false orphan is the worse error
 * here: it tells you a working generator does not exist. */
const WRITE = /(writeFileSync|createWriteStream|json\.dump|to_json|\bopen\b[\s\S]{0,120}?['"][wa]['"])/;
function generatorFor(rel) {
  const base = path.basename(rel);
  for (const dir of GEN_DIRS) {
    let entries = [];
    try { entries = fs.readdirSync(D(dir)); } catch (e) { continue; }
    for (const f of entries) {
      if (!/\.(js|py|sh)$/.test(f)) continue;
      let src;
      try { src = fs.readFileSync(D(dir, f), 'utf8'); } catch (e) { continue; }
      if (!src.includes(base)) continue;
      for (const ln of src.split('\n')) {
        if (ln.includes(base) && WRITE.test(ln)) return `${dir}/${f}`;
      }
    }
  }
  return null;
}

/* ---- baseline of known orphans ------------------------------------------------------------------ */
let base = { orphans: {} };
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { /* first run */ }

const stale = [], orphans = [], fresh = [];
for (const [rel, pages] of [...loaded.entries()].sort()) {
  if (!fs.existsSync(D(rel))) { stale.push({ rel, pages, days: Infinity, why: 'MISSING' }); continue; }
  const mt = fs.statSync(D(rel)).mtimeMs;
  const days = (newest - mt) / 864e5;
  const gen = generatorFor(rel);
  if (!gen) orphans.push({ rel, pages, days });
  if (days > 0.5) stale.push({ rel, pages, days, gen });
  else fresh.push(rel);
}

/* ---- THE INPUTS BEHIND THE PAGE, WHICH IS WHERE CHOMP ACTUALLY ROTTED ---------------------------
 *
 * data/status.js was FRESH and still published a stale verdict, because the artifact it derives from
 * — data/chomp-ev.json — was four days old. Checking only the files the page LOADS would have missed
 * that completely, which is exactly how it went unnoticed until Will asked whether the numbers were
 * up to date.
 *
 * So the evaluation artifacts build_status.js reads are checked too, scanned out of that file rather
 * than listed here. A verdict derived from a rotten input is a confident wrong answer, and that is
 * the shape this project keeps producing. */
const statusSrc = (() => {
  try { return fs.readFileSync(D('build', 'build_status.js'), 'utf8'); }
  catch (e) { console.error('  (cannot read build_status.js: ' + e.message + ')'); return ''; }
})();
const statusInputs = [...new Set([...statusSrc.matchAll(/readJSON\(\s*'(data\/[^']+)'/g)].map(m => m[1]))];
const staleInputs = [], orphanInputs = [];
for (const rel of statusInputs) {
  if (!fs.existsSync(D(rel))) continue;
  const days = (newest - fs.statSync(D(rel)).mtimeMs) / 864e5;
  /* AN ORPHAN INPUT IS A DIFFERENT PROBLEM FROM A STALE ONE, and telling somebody to "re-run the
   * generator" for a file no generator writes wastes their time and teaches them to ignore the
   * check. data/damage-validation.json is read by build_status.js and written by nothing. */
  if (!generatorFor(rel)) { orphanInputs.push({ rel, days }); continue; }
  if (days > 1) staleInputs.push({ rel, days });
}
staleInputs.sort((a, b) => b.days - a.days);
ok(statusInputs.length > 0, `found ${statusInputs.length} artifacts the site's verdicts derive from`,
  'could not scan build_status.js — the indirect check is not running');
if (staleInputs.length) {
  console.log('\n  STALE INPUTS — the page looks fresh, but its verdicts come from these:');
  for (const si of staleInputs) console.log(`    ${si.rel.padEnd(32)} ${si.days.toFixed(1)}d`);
}
ok(staleInputs.length === 0, 'every artifact the site\'s verdicts derive from is current',
  staleInputs.length ? `${staleInputs.length} stale, oldest ${staleInputs[0].rel} at ${staleInputs[0].days.toFixed(1)}d` : '');

console.log(`\n  fresh    ${fresh.length}`);
console.log(`  stale    ${stale.length}`);
console.log(`  orphans  ${orphans.length} on the page + ${orphanInputs.length} status inputs   (no script writes them)`);

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    by: 'tests/test-site-data-fresh.js --update',
    note: 'GENERATED. Files the site loads that no script writes. Each is permanently stale — it '
        + 'cannot be brought up to date by anyone. Shrink this list; never hand-edit it.',
    orphans: Object.fromEntries(
      orphans.map(o => [o.rel, `served by ${o.pages.join(', ')}`])
        .concat(orphanInputs.map(o => [o.rel, 'read by build/build_status.js; no generator']))),
  }, null, 1));
  console.log(`\n  baselined ${orphans.length} orphan(s) -> ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

const known = new Set(Object.keys(base.orphans || {}));
const allOrphans = orphans.concat(orphanInputs.map(o => ({ ...o, pages: ['(status input)'] })));
const newOrphans = allOrphans.filter(o => !known.has(o.rel));
const goneOrphans = [...known].filter(k => !allOrphans.some(o => o.rel === k));

if (stale.length) {
  console.log('\n  STALE — older than the newest game data:');
  for (const s of stale) {
    console.log(`    ${s.rel.padEnd(32)} ${s.days === Infinity ? 'MISSING' : s.days.toFixed(1) + 'd'}` +
      `   served by ${s.pages.join(', ')}` + (s.gen ? `   regenerate: node ${s.gen}` : '   NO GENERATOR'));
  }
}
/* A BASELINED ORPHAN IS ALREADY KNOWN TO BE PERMANENTLY STALE, and failing on its staleness too
 * reports the same fact twice and leaves a red that can never be cleared. A permanent red is how a
 * check stops being read. The actionable failure is a stale file that COULD be regenerated — those
 * name their generator in the list above and someone can act on them today. */
const actionable = stale.filter(s2 => !known.has(s2.rel));
ok(actionable.length === 0, 'every regenerable file the site loads is newer than the newest game data',
  actionable.map(a => `${a.rel} (${a.days.toFixed(1)}d) -> node ${a.gen}`).join('; '));
if (stale.length > actionable.length)
  console.log(`  (${stale.length - actionable.length} of those are baselined orphans — permanently stale, no generator exists)`);

if (newOrphans.length) {
  console.log('\n  NEW ORPHANS — the site serves these and nothing can regenerate them:');
  for (const o of newOrphans) console.log(`    ${o.rel}   served by ${o.pages.join(', ')}`);
}
ok(newOrphans.length === 0, `no NEW un-regenerable file reached the site (${known.size} known)`,
  newOrphans.map(o => o.rel).join(', '));

if (goneOrphans.length) console.log(`\n  ${goneOrphans.length} baselined orphan(s) now have a generator. Re-run with --update.`);

console.log(`\nSITE DATA FRESHNESS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
