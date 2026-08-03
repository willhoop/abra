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
let scanIncomplete = false;
function generatorFor(rel) {
  const base = path.basename(rel);
  for (const dir of GEN_DIRS) {
    let entries = [];
    /* A DIRECTORY WE CANNOT READ PRODUCES A FALSE ORPHAN, which this file already calls the worse
     * error — it reports that a working generator does not exist. Silence here would have
     * reintroduced exactly that, in the guard written to prevent it. Reported, and the scan is
     * marked incomplete so a miss cannot masquerade as a clean result. */
    try { entries = fs.readdirSync(D(dir)); }
    catch (e) { if (e.code !== 'ENOENT') { console.error(`  (cannot scan ${dir}/: ${e.message})`); scanIncomplete = true; } continue; }
    for (const f of entries) {
      if (!/\.(js|py|sh)$/.test(f)) continue;
      let src;
      try { src = fs.readFileSync(D(dir, f), 'utf8'); }
      catch (e) { console.error(`  (cannot read ${dir}/${f}: ${e.message})`); scanIncomplete = true; continue; }
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
let baselineMissing = false;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
catch (e) {
  /* No baseline means every orphan reads as NEW and the check fails loudly, which is the safe
   * direction — but say why, so the first run is not mistaken for a regression. */
  baselineMissing = true;
  console.error(`  (no orphan baseline yet: ${e.code === 'ENOENT' ? 'first run' : e.message})`);
}

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

/* AN INCOMPLETE SCAN MUST NOT PASS AS A CLEAN ONE. If any generator directory or file could not be
 * read, every orphan verdict below is unreliable in the dangerous direction. */
ok(!scanIncomplete, 'the generator scan read every file it needed',
  'some generator files were unreadable — orphan verdicts below may be false');

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

/* --list AND --fix, SO THE REPAIR COMES FROM THE SAME DERIVATION AS THE COMPLAINT.
 *
 * This check goes red on its own schedule. The ingest adds games, every derived file is instantly
 * older than its inputs, and half a day later this fails — twice in one session on 2026-08-03, with
 * nothing wrong except that time passed. That trains a reader to ignore it, and a check nobody reads
 * is worse than no check at all.
 *
 * WIDENING THE TOLERANCE IS THE WRONG FIX. 0.5 days IS the tolerance, and the files were at 0.7, so
 * the complaint is true: the site really was serving data seventeen hours behind the games. The right
 * fix is to make regenerating cheap enough to automate.
 *
 * `generatorFor` already DERIVES which script writes each file by scanning for the writer, so the
 * repair list is a property of the repo rather than a table somebody keeps up to date. Emitting the
 * commands from here means the fix and the complaint cannot disagree — a second list living in a
 * refresh script is exactly the kind of copy that has gone stale in this project before.
 *
 *   node tests/test-site-data-fresh.js --list    print the commands, run nothing
 *   node tests/test-site-data-fresh.js --fix     run them, in the order listed
 *
 * Run --fix after each ingest and this check goes quiet honestly, rather than by being loosened. */
if (process.argv.includes('--list') || process.argv.includes('--fix')) {
  const cmds = actionable.filter(a => a.gen).map(a => ({ rel: a.rel, gen: a.gen }));
  const runner = g => (/\.py$/.test(g) ? 'python' : 'node') + ' ' + g;
  if (!cmds.length) {
    console.log('  nothing to regenerate — every site file is newer than the newest game data.');
    process.exit(0);
  }
  if (process.argv.includes('--list')) {
    console.log('  REGENERATE, in this order:');
    for (const c of cmds) console.log('    ' + runner(c.gen) + '        # ' + c.rel);
    process.exit(0);
  }
  /* A REFIT IS NOT A REFRESH, AND --fix MUST NOT PERFORM ONE AS A SIDE EFFECT.
   *
   * The first version of this ran every generator the check named. One of them was `engine/pory.py`,
   * which does not rebuild a bundle — it REFITS the model and rewrites data/pory-eval.json. The
   * published log-loss moved 0.6298 -> 0.6184, the white paper and SUMMARY.md still quoted the old
   * one, and engine/sanity_check.py failed on the mismatch. It was right to.
   *
   * That is the refit cascade this project has rules about, triggered by a FRESHNESS CHECK. Making a
   * test green must never silently republish a measured number.
   *
   * Detected rather than listed: a generator that also writes a `*-eval.json` is publishing measured
   * numbers that documents quote, so it is a fit and not a bundle. Same WRITE probe the orphan scan
   * already uses, asked of a different target. Named and skipped, with the command printed so a human
   * can run it deliberately and then follow the refit checklist in engine/provenance.js. */
  const PUBLISHES = [];
  const kept = [];
  for (const c of cmds) {
    /* AN UNREADABLE GENERATOR MUST NOT READ AS "SAFE TO RUN". This scan decides whether a generator
     * refits a model, and an empty source finds no `-eval.json`, so a read failure would silently
     * promote a refit into the auto-run list — the exact thing this block exists to prevent. Refused
     * loudly and treated as a publisher, which is the safe direction. */
    let src = '';
    try {
      src = fs.readFileSync(D(c.gen), 'utf8');
    } catch (e) {
      console.error(`    cannot read ${c.gen} (${e.message}) — treating it as a refit and SKIPPING.`);
      PUBLISHES.push({ ...c, evals: ['<unreadable — could not be checked>'] });
      continue;
    }
    const evals = [...new Set([...src.matchAll(/['"]([\w./-]*-eval\.json)['"]/g)].map(m => m[1]))]
      .filter(t => src.split('\n').some(ln => ln.includes(t) && WRITE.test(ln)));
    if (evals.length) PUBLISHES.push({ ...c, evals }); else kept.push(c);
  }
  if (PUBLISHES.length) {
    console.log('  SKIPPED — these REFIT a model and republish measured numbers:');
    for (const c of PUBLISHES) {
      console.log('    ' + runner(c.gen) + '   writes ' + c.evals.join(', '));
    }
    console.log('    Run those deliberately, then follow the refit checklist (engine/provenance.js)');
    console.log('    and update whatever docs quote the numbers they publish.');
  }
  if (!kept.length) {
    console.log('  nothing left to regenerate automatically.');
    process.exit(0);
  }
  console.log('  REGENERATING ' + kept.length + ' file(s):');
  const { execFileSync } = require('child_process');
  let failed = 0, unchanged = 0;
  for (const c of kept) {
    process.stdout.write('    ' + c.rel.padEnd(34) + ' ');
    const before = fs.existsSync(D(c.rel)) ? fs.statSync(D(c.rel)).mtimeMs : 0;
    try {
      const out = execFileSync(/\.py$/.test(c.gen) ? 'python' : 'node', [D(c.gen)],
        { cwd: D('.'), stdio: 'pipe', timeout: 900000, encoding: 'utf8' }) || '';
      const after = fs.existsSync(D(c.rel)) ? fs.statSync(D(c.rel)).mtimeMs : 0;
      if (after > before) { console.log('ok'); continue; }
      /* RAN CLEAN AND WROTE NOTHING, which is NOT success and must not print as `ok`.
       *
       * build/rebuild_sets_from_sheets.js is report-only and ends with "Re-run with --write to
       * update data/engine-data.js" — and the first version of this piped stdio, so the instruction
       * that says how to fix the very thing being fixed was swallowed and the file reported `ok`
       * while staying stale forever. A --fix that cannot fix something has to say so in the
       * generator's own words rather than in mine. */
      unchanged++;
      console.log('ran, wrote nothing');
      const tail = out.trim().split('\n').filter(Boolean).slice(-3);
      for (const ln of tail) console.log('        | ' + ln.trim());
      /* THE COMMAND THIS CHECK DERIVES IS THE SCRIPT, NOT THE INVOCATION, and two of them proved it:
       *
       *   build/rebuild_sets_from_sheets.js  is REPORT-ONLY without --write, and needs SHOWDOWN_PATH
       *                                      or it exits with "no dex — refusing to guess".
       *   engine/slowking_preview.py         writes data/slowking.js by default and only writes
       *                                      data/slowking-playstyle.js when TAG=playstyle.
       *
       * So "the script that writes this file" and "the command that regenerates this file" are not
       * the same thing, and no scan of the source can close that gap. Flagged here rather than
       * guessed at, because a --fix that invents flags is worse than one that admits its limit. */
      console.log('        (this generator needs flags or env this check cannot derive — see above)');
    } catch (e) {
      /* A GENERATOR THAT FAILS IS THE WHOLE POINT OF RUNNING THEM, so it is named and counted rather
       * than swallowed: a --fix that skipped failures quietly would leave the file stale and the next
       * run would report the same red with no explanation for it. */
      failed++;
      console.log('FAILED: ' + String(e.message).split('\n')[0]);
    }
  }
  if (unchanged) {
    console.log('  ' + unchanged + ' generator(s) ran clean but wrote nothing — read their output above.');
    console.log('  A report-only generator needs its write flag; an unchanged one means the CONTENT is');
    console.log('  already current and only the timestamp is behind. Those are different problems and');
    console.log('  neither is fixed by running the same command again.');
  }
  console.log(failed ? '  ' + failed + ' generator(s) failed — those files are still stale.'
                     : '  done; re-run without --fix to confirm.');
  process.exit(failed ? 1 : 0);
}

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
