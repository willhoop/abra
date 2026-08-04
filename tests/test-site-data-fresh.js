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

/* ---- BUNDLE OR PUBLISHER? ------------------------------------------------------------------------
 *
 * Two generators can both write a data/*.js the site loads and mean completely different things:
 *
 *   a BUNDLE generator is a pure function of artifacts already on disk. Running it republishes
 *     nothing. build/build_mag_data.js turns data/policy-weights.json into data/mag.js.
 *   a PUBLISHER refits a model and writes new measured numbers that documents quote. Running it is
 *     the refit cascade, not a refresh.
 *
 * THE FIRST VERSION OF THIS TEST DETECTED PUBLISHERS BY THE FILENAME SUFFIX `-eval.json`, and that
 * is not a property of anything. It caught engine/pory.py, which writes data/pory-eval.json. It did
 * NOT catch engine/nmf_roles.py (writes data/nmf-roles.json — a fitted NMF decomposition quoted in
 * docs/MODELS.md) or engine/xatu.py (writes data/xatu.json — a belief model, likewise quoted). Both
 * were on the auto-run list, so `--fix` would have refitted two models to make a freshness check go
 * green — the exact thing the block below was written to prevent, evaded by a naming convention.
 *
 * The rule that actually holds, checked against all ten generators this test names: a bundle writes
 * ONLY browser files. A generator that also writes a data/*.json is producing an artifact, and
 * artifacts are what documents quote. Same WRITE probe generatorFor already uses, asked of every
 * data file the generator writes rather than of one suffix. */
function artifactsWrittenBy(gen) {
  let src;
  /* AN UNREADABLE GENERATOR MUST NOT READ AS "SAFE TO RUN". An empty source finds no writes, so a
   * read failure would silently promote a refit into the auto-run list. Refused in the safe
   * direction: unreadable counts as a publisher. */
  try { src = fs.readFileSync(D(gen), 'utf8'); }
  catch (e) { return { unreadable: e.message, artifacts: ['<unreadable — could not be checked>'] }; }
  const artifacts = new Set();
  for (const ln of src.split('\n')) {
    if (!WRITE.test(ln)) continue;
    for (const m of ln.matchAll(/['"]([\w./-]*\.json)['"]/g)) artifacts.add(m[1]);
    /* The os.path.join / path.join idiom splits the name across arguments, which is how
     * data/guru-matchups.json hid a writer from engine/provenance.js entirely. */
    for (const m of ln.matchAll(/join\s*\([^)]*['"]data['"]\s*,\s*['"]([\w.-]+\.json)['"]/g)) artifacts.add(m[1]);
  }
  return { artifacts: [...artifacts] };
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

/* MTIME IS THE WRONG RULE FOR A VERDICT ARTIFACT, and this check used it for three days.
 *
 * It compared each input's mtime against the newest games.*.jsonl and failed past one day. The store
 * is APPEND-ONLY and the collector runs hourly, so that clock can never be beaten: every verdict in
 * the repository is "stale" within a day of being computed, permanently, with nothing wrong. Five
 * artifacts were red on this rule tonight and four of them are fine — engine/provenance.js reports
 * chomp-ev, eval-report, species-sets and policy-weights-joint as clean.
 *
 * engine/provenance.js already rejected the mtime rule for exactly this reason and replaced it with
 * a CORPUS DRIFT test: compare the corpus an artifact DECLARES against the clean corpus available
 * now. That is answerable, it scales with the real growth rate (~7%/day), and it would still have
 * caught the founding case — data/chomp-ev.json four days behind is ~28% drift, well past the 10%
 * threshold. So this check delegates instead of keeping a second, weaker definition of stale.
 * status.js shells out to provenance.js for the same reason; there is one staleness authority.
 *
 * WHAT DELEGATION LOSES, SAID OUT LOUD RATHER THAN QUIETLY DROPPED. Drift can only see an artifact
 * that DECLARES a corpus, and chomp-ev.json, eval-report.json and policy-weights-joint.json declare
 * none. Under mtime they were checked badly; under drift they would be exempt SILENTLY, which is the
 * failure engine/provenance.js §5 describes — doing the right thing being the thing that made you
 * invisible. They are listed by name, every run, without failing: an artifact is fixed by its
 * generator recording a count, and that is the pressure to add one. The same shape as
 * tests/test-timestamps.js listing the artifacts that still carry a naive stamp. */
let provText = '';
try {
  provText = require('child_process').execFileSync(
    process.execPath, [D('engine', 'provenance.js')], { encoding: 'utf8', maxBuffer: 1 << 24 });
} catch (e) {
  console.error('  (cannot run engine/provenance.js: ' + String(e.message).split('\n')[0] + ')');
}
/* Parsed out of provenance's own report rather than recomputed here — a second implementation of the
 * drift arithmetic is how two files come to disagree about the same fact. */
function provNote(rel) {
  const base = path.basename(rel);
  const line = provText.split('\n').findIndex(l => l.trim().startsWith(base + ' '));
  if (line < 0) return null;
  const lines = provText.split('\n');
  const notes = [lines[line]];
  for (let i = line + 1; i < lines.length && /^\s{30,}\S/.test(lines[i]); i++) notes.push(lines[i]);
  return notes.join(' ');
}
const staleInputs = [], orphanInputs = [], uncheckable = [];
for (const rel of statusInputs) {
  if (!fs.existsSync(D(rel))) continue;
  const days = (newest - fs.statSync(D(rel)).mtimeMs) / 864e5;
  /* AN ORPHAN INPUT IS A DIFFERENT PROBLEM FROM A STALE ONE, and telling somebody to "re-run the
   * generator" for a file no generator writes wastes their time and teaches them to ignore the
   * check. data/damage-validation.json is read by build_status.js and written by nothing. */
  if (!generatorFor(rel)) { orphanInputs.push({ rel, days }); continue; }
  const note = provNote(rel);
  if (note === null) continue;
  const drift = note.match(/CORPUS DRIFT — declares ([\d,]+) games; ([\d,]+) are clean ladder now, so ([\d.]+)%/);
  if (/\bUNSAFE\b/.test(note)) staleInputs.push({ rel, days, why: 'UNSAFE — older than the quality filter' });
  else if (drift) staleInputs.push({ rel, days, why: `CORPUS DRIFT ${drift[3]}% — declares ${drift[1]}, ${drift[2]} clean now` });
  else if (/records no game count/.test(note)) uncheckable.push({ rel, days, why: 'its generator records no corpus count' });
  else if (!/declares|n_games|games/.test(note) && !/\bok\b/.test(note)) uncheckable.push({ rel, days, why: 'provenance reports no corpus claim' });
}
/* An input provenance never mentions a count for is uncheckable too, whatever else it said. */
for (const rel of statusInputs) {
  if (uncheckable.some(u => u.rel === rel) || staleInputs.some(s => s.rel === rel)) continue;
  if (!fs.existsSync(D(rel)) || !generatorFor(rel)) continue;
  let j = null; try { j = JSON.parse(fs.readFileSync(D(rel), 'utf8')); } catch (e) { /* not our check */ }
  if (!j) continue;
  const claims = ['n_games', 'games', 'clean_games', 'usable', 'n_measured']
    .some(k => typeof j[k] === 'number') || (j.provenance && j.provenance.funnel);
  if (!claims) uncheckable.push({ rel, days: (newest - fs.statSync(D(rel)).mtimeMs) / 864e5,
    why: 'declares no corpus — drift cannot see it' });
}
staleInputs.sort((a, b) => b.days - a.days);
ok(statusInputs.length > 0, `found ${statusInputs.length} artifacts the site's verdicts derive from`,
  'could not scan build_status.js — the indirect check is not running');
if (uncheckable.length) {
  console.log('\n  UNCHECKABLE INPUTS — not a failure, and not clean either. Drift cannot see these:');
  for (const u of uncheckable) console.log(`    ${u.rel.padEnd(32)} ${u.why}`);
  console.log('    Fix by making the generator record the corpus it used, not by re-running it.');
}
if (staleInputs.length) {
  console.log('\n  STALE INPUTS — the page looks fresh, but its verdicts come from these:');
  for (const si of staleInputs) console.log(`    ${si.rel.padEnd(32)} ${si.why}`);
}
ok(staleInputs.length === 0, 'every artifact the site\'s verdicts derive from is current',
  staleInputs.length ? `${staleInputs.length} behind the corpus, worst ${staleInputs[0].rel}: ${staleInputs[0].why}` : '');

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
      /* `node engine/slowking_preview.py` is not a command. The --list path already derives the
       * interpreter from the extension and this line hardcoded `node`, so the repair printed for
       * every Python generator was one that cannot run. */
      `   served by ${s.pages.join(', ')}` +
      (s.gen ? `   regenerate: ${(/\.py$/.test(s.gen) ? 'python' : 'node')} ${s.gen}` : '   NO GENERATOR'));
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
   * Classified by artifactsWrittenBy(), above — a generator that writes any data/*.json is a
   * publisher, not a bundle. Named and skipped, with the command printed so a human can run it
   * deliberately and then follow the refit checklist in engine/provenance.js. */
  const PUBLISHES = [];
  const kept = [];
  for (const c of cmds) {
    const { unreadable, artifacts } = artifactsWrittenBy(c.gen);
    if (unreadable) console.error(`    cannot read ${c.gen} (${unreadable}) — treating it as a refit and SKIPPING.`);
    if (artifacts.length) PUBLISHES.push({ ...c, evals: artifacts }); else kept.push(c);
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

/* A STALE BUNDLE AND A STALE FIT ARE NOT THE SAME FAILURE, and failing on both under one sentence
 * told a reader to run a command that would have refitted a model.
 *
 * A bundle is a pure function of artifacts already on disk. It is stale because nobody ran it, the
 * repair is one command, `--fix` will do it, and it is right to fail on that.
 *
 * A fit is stale because the MODEL is behind, and re-running it republishes numbers the white paper
 * and SUMMARY.md quote. That is a deliberate act with a docs pass attached, and mtime is not even
 * the right question to ask about it — the right question is CORPUS DRIFT, and engine/provenance.js
 * asks it and reports these same three: pory-eval.json at 33.4%, nmf-roles.json behind its input,
 * xatu.json recording no game count at all. Nothing becomes invisible by being moved off this line;
 * it moves to the tool whose job it is. Listed here every run with the command, never filed. */
const actionableBundles = [], stalePublishers = [];
for (const a of actionable) {
  if (!a.gen) { actionableBundles.push(a); continue; }
  const { artifacts } = artifactsWrittenBy(a.gen);
  if (artifacts.length) stalePublishers.push({ ...a, artifacts }); else actionableBundles.push(a);
}
if (stalePublishers.length) {
  console.log('\n  STALE FITS — the site serves these and only a REFIT makes them current:');
  for (const p of stalePublishers) {
    console.log(`    ${p.rel.padEnd(22)} ${p.days.toFixed(1)}d   ${(/\.py$/.test(p.gen) ? 'python ' : 'node ') + p.gen}` +
      `   republishes ${p.artifacts.join(', ')}`);
  }
  console.log('    NOT a failure of this check and NOT filed: engine/provenance.js measures whether');
  console.log('    their numbers are actually behind, and docs must move in the same pass.');
}
ok(actionableBundles.length === 0, 'every regenerable BUNDLE the site loads is newer than the newest game data',
  actionableBundles.map(a => `${a.rel} (${a.days.toFixed(1)}d) -> ${a.gen}`).join('; '));
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
