/* run-all.js — run every check in the repository. The list is DERIVED, never typed.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/run-all.js
 *   node tests/run-all.js --list          show what would run, and what would be skipped
 *
 * WHY THIS EXISTS
 * ---------------
 * The CI job list in `.github/workflows/tests.yml` was typed by hand, one `- name:` step per test.
 * On 2026-07-27 it named 6 of the 18 test files in this repository. The twelve it omitted included
 * `tests/test-quality.js`, `tests/test-docs-current.js`, `tests/test-site-sync.js` — and
 * `engine/selftest.js`, the file whose own header calls it "the checks that catch silent wrongness".
 *
 * That check was failing at the time nobody was running it: 17 files read the raw ladder store with
 * no clean filter and no declaration, which is the GARBODOR rule, the single defect this project has
 * recorded catching itself on more than any other.
 *
 * This is S13 (if a fact can be derived from an artifact, no human types it) applied to the test
 * list itself. A hand-kept list of tests is a promise to remember to add the next one, and this repo
 * has now demonstrated twice — here and in the PDF build list — that the promise is not kept.
 *
 * SKIPS ARE LOUD. A check that needs the Showdown simulator cannot run without SHOWDOWN_PATH. It is
 * reported as SKIPPED with its reason and counted in the summary. A silent skip is indistinguishable
 * from a pass, which is the failure mode this whole file is about.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
/* Stamped once, before any child runs, and handed down so a check can tell an artifact THIS SUITE
 * rewrote from one that was already stale when it started. See the env note further down. */
const SUITE_STARTED_AT = Date.now();
const LIST_ONLY = process.argv.includes('--list');

/* ---- discovery ------------------------------------------------------------------------------- */

/* Everything in tests/ that is a test. Discovered, so a new file is covered the moment it lands. */
const testFiles = fs.readdirSync(D('tests'))
  .filter(f => /^test-.*\.(js|py)$/.test(f))
  .sort()
  .map(f => path.join('tests', f));

/* The engine-side gates. These live in engine/ because other tooling imports them, so they cannot be
 * found by globbing tests/. The coverage assertion below is what stops this short list from becoming
 * the same hand-maintained lie as the CI file it replaces. */
/* validate_selfplay.js is included even though the corpus it gates is gitignored: it exits 2 when the
 * store is absent, and exit 2 is treated as SKIP below. That keeps it visible in every run instead of
 * being a gate nobody remembers, which is what it was. */
/* artifact_audit.js is a gate rather than a report because the hole it found was invisible for as
 * long as nobody ran it: data/engine-data.js carried `ab: null`, `mv: []` and `item: null` on every
 * mega forme — 26.0% of this format's usage — while data/mega-dex-official.json held all of it and a
 * builder existed to apply it. Nothing compared the derived artifact to its source, so a build step
 * that had been silently undone stayed undone. Running it every time is the whole point (Will:
 * "arent we making sure all fixes get applied to every applicaiton? how was this not caught?"). */
/* validate_damage.js is the GOLDEN MASTER against @smogon/calc — the guard on the number every other
 * result depends on. It was NOT in this list, and the coverage assertion below did not notice,
 * because that assertion detects a check by its OUTPUT FORMAT and this file reports an aggregate
 * table plus `process.exit(1)` rather than "N passed, N failed". So the meta-check written to stop
 * unrun checks was itself fooled, by the most important check in the repository.
 *
 * Proven during the 2026-07-31 engineering review by mutation: neutering Sword of Ruin (0.75 -> 1.00)
 * dropped within-5% agreement to 94% (needs >=95) with a worst case of 25% (needs <=8), and
 * validate_damage caught it while the full suite stayed green. It exits 2 when @smogon/calc is
 * absent, which this runner treats as SKIP, so listing it is safe on a machine without the dep. */
/* provenance.js runs with --strict, which exits 1 when any artifact is UNSAFE TO QUOTE. Both the
 * 2026-07-31 systems audit and the engineering review found the same thing independently: the tool
 * was correct, complete, and wired to nothing, so 31 artifacts computed under superseded filter rules
 * sat unflagged while the roadmap called them "the blocker on everything in section 3".
 *
 * Two independent reviews finding the same unwired gate is the signal. It is wired now. If this is
 * red, the fix is to REGENERATE the artifacts it names — not to remove it from this list. */
const GATES = ['engine/selftest.js', 'engine/conformance.js', 'engine/artifact_audit.js',
  'engine/validate_damage.js', 'engine/validate_damage_sim.js', 'engine/provenance.js',
  'engine/validate_selfplay.js',
  /* engine/sanity_check.py — 96 assertions, called MANDATORY in the handoff docs, and it was in no
   * suite. The runner has always been able to execute .py (it resolves an interpreter and skips
   * cleanly when none exists); this list simply never named it, so the cross-consistency checks that
   * tie the docs to the artifacts ran only when somebody typed the command by hand. That is how a
   * published PORY log-loss of 0.567 survived while the artifact said 0.6321. Whole-repo review,
   * 2026-07-31. */
  'engine/sanity_check.py',
  /* engine/em_validation.js — the Stage C estimator gate, docs/CLICK-CENSORING-FIX.md. It is run
   * with --check, which VERIFIES the recorded verdict and re-hashes every source the measurement
   * depended on, rather than re-running tens of minutes of conditional-logit fits inside the suite.
   * Editing engine/click_class.js or engine/fit_policy.js therefore turns this red until the
   * measurement is re-run, which is the hash-not-mtime rule engine/status.js already applies to the
   * leaf. Listing it without --check would put a 25-minute fit in the suite; not listing it at all
   * would leave a gate that nothing runs, which the assertion below exists to forbid. */
  'engine/em_validation.js'];

/* COVERAGE ASSERTION. Any file in engine/ that reports its own pass/fail summary is a check, and a
 * check that nothing runs is worse than no check — it reads as coverage in a review. If one turns up
 * that is neither a listed gate nor in tests/, this runner fails rather than quietly ignoring it. */
/* WIDENED 2026-07-31. This detected a check purely by its reporting idiom, so a file that gates by
 * exit code without printing "N passed, N failed" was invisible — which is exactly how
 * validate_damage.js, the damage golden master, sat outside the suite unnoticed. A check is now also
 * anything that calls process.exit with a non-zero literal, which is what a gate DOES rather than
 * what it PRINTS. Behaviour is the honest signal; formatting is not. */
const looksLikeACheck = src => /\d+ passed, \$\{?F?\}? ?failed|passed, .*failed/.test(src) ||
  /console\.log\('  ok   '/.test(src) ||
  /* A GATE, detected by what it DOES rather than how it prints: it exits non-zero AND announces a
   * regression. `process.exit(1)` alone is far too broad -- 36 engine files exit(1) on ordinary
   * error handling, and widening to that made this assertion cry wolf, which is the same defect it
   * exists to prevent. Both clauses are required. */
  (/process\.exit\(\s*1\s*\)/.test(src) && /REGRESSION|FAIL:|FAIL/.test(src));
const unrun = fs.readdirSync(D('engine'))
  .filter(f => f.endsWith('.js'))
  .filter(f => !GATES.includes('engine/' + f))
  .filter(f => {
    let src = ''; try { src = fs.readFileSync(D('engine', f), 'utf8'); } catch (e) { return false; }
    return looksLikeACheck(src);
  });

const all = [...testFiles, ...GATES];

/* ---- how to run each one --------------------------------------------------------------------- */

/* python3 is a Microsoft Store stub on this machine and exits with an install prompt, so the
 * interpreter is probed rather than assumed. publish.sh already does the same thing. */
function python() {
  for (const c of ['python3', 'python']) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /^Python 3/.test((r.stdout || '') + (r.stderr || ''))) return c;
  }
  return null;
}
const PY = python();
const HAS_SIM = !!process.env.SHOWDOWN_PATH;

function plan(rel) {
  const src = fs.readFileSync(D(rel), 'utf8');
  const needsSim = /champions_sim|SHOWDOWN_PATH/.test(src);
  if (needsSim && !HAS_SIM) return { skip: 'needs the Showdown simulator; SHOWDOWN_PATH is not set' };
  if (rel.endsWith('.py') && !PY) return { skip: 'no working python 3 interpreter found' };
  /* Per-check extra arguments. provenance.js reports by default and only GATES with --strict, so the
   * runner must ask for the strict behaviour or it would list unsafe artifacts and exit 0 — a gate
   * that reads as a pass, which is the failure this file exists to prevent. */
  /* conformance.js is the same shape and was the worse case: it was registered as a gate here and
   * run WITHOUT --strict, so its exit(1) could never fire. It printed findings on every run and
   * exited 0. Two near-identical comment blocks sat at this exact spot documenting that defect, and
   * it was acted on zero times — the write-up became the substitute for the fix.
   *
   * It is switched on now, and it is a RATCHET rather than a switch, because flipping --strict as
   * it stood turned the suite red on ~a hundred findings that are mostly legitimate. A red board
   * gets normalised: tests/test-docs-current.js sat red for two days across ~40 commits as a "known
   * failure", the phrase CLAUDE.md bans. So what already existed is recorded in
   * data/conformance-baseline.json — the count lives in that artifact and is deliberately not typed
   * here — and the gate fails only on a finding that is NOT in there. The baseline may shrink and
   * may never grow. PRIORITIES #46b, closed 2026-08-04. */
  const EXTRA = { 'engine/provenance.js': ['--strict'], 'engine/conformance.js': ['--strict'],
                  'engine/em_validation.js': ['--check'] };
  return { cmd: rel.endsWith('.py') ? PY : process.execPath, args: [D(rel), ...(EXTRA[rel] || [])] };
}

if (LIST_ONLY) {
  console.log(`DISCOVERED ${all.length} checks (${testFiles.length} in tests/, ${GATES.length} engine gates)\n`);
  for (const rel of all) {
    const p = plan(rel);
    console.log(`  ${p.skip ? 'SKIP' : 'RUN '}  ${rel}${p.skip ? '   — ' + p.skip : ''}`);
  }
  if (unrun.length) console.log(`\n  UNRUN CHECKS IN engine/: ${unrun.join(', ')}`);
  process.exit(0);
}

/* ---- run ------------------------------------------------------------------------------------- */

console.log(`RUN-ALL — ${all.length} checks discovered ` +
  `(${testFiles.length} in tests/, ${GATES.length} engine gates)`);
console.log(`  simulator: ${HAS_SIM ? process.env.SHOWDOWN_PATH : 'NOT SET — simulator checks will be skipped'}`);
console.log(`  python:    ${PY || 'NOT FOUND — python checks will be skipped'}\n`);

const pass = [], fail = [], skip = [];
for (const rel of all) {
  const p = plan(rel);
  if (p.skip) { skip.push([rel, p.skip]); console.log(`  SKIP  ${rel}  — ${p.skip}`); continue; }
  const started = Date.now();
  /* ABRA_STRICT_SEMANTICS MAKES A STALE-WEIGHTS WARNING FATAL, AND UNTIL 2026-08-02 NOTHING SET IT.
   *
   * engine/magnemite.js implements the flag, and its own comment says it "is what tests/run-all.js
   * and any fit should use" — but no file in this repository ever set it. So the semantics guard was
   * a warning everywhere, permanently. Verified by making the fixture genuinely change: it printed
   * 22 features whose meaning had moved, and then LOADED THE WEIGHTS ANYWAY. A capability that
   * exists, runs clean and does nothing is this project's single most repeated defect.
   *
   * The default stays a warning for LIVE PLAY, and that trade-off is argued where it is made: a
   * routine re-ingest is a legitimate cause of a mismatch, and a guard that halts a battle for a data
   * refresh is one that gets switched off within a week. The suite is where it has to bite. */
  const r = spawnSync(p.cmd, p.args, {
    cwd: ROOT, encoding: 'utf8',
    /* ABRA_SUITE_STARTED_AT lets a child tell "this artifact was stale when the suite began" from
     * "this suite wrote it thirty seconds ago". tests/test-web-status.js could not be green at the
     * end of a run that regenerates the very artifacts its board is built from — the harness was
     * measuring its own side effect and calling it a defect in the site. Only that distinction is
     * exported; the check itself still fails on a board somebody genuinely forgot to rebuild. */
    env: Object.assign({}, process.env, { ABRA_STRICT_SEMANTICS: '1', ABRA_SUITE_STARTED_AT: String(SUITE_STARTED_AT) }),
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (r.status === 0) { pass.push(rel); console.log(`  ok    ${rel}  (${secs}s)`); }
  /* EXIT 2 MEANS "I COULD NOT RUN", NOT "I FAILED". A gate whose input is gitignored must be able to
   * say that without turning every clean checkout red — and must still be listed, so the distinction
   * between "passed" and "never ran" stays visible. */
  else if (r.status === 2) {
    const why = ((r.stderr || '') + (r.stdout || '')).trim().split('\n')[0] || 'exit 2';
    skip.push([rel, why]);
    console.log(`  SKIP  ${rel}  — ${why}`);
  }
  else {
    fail.push([rel, r.status, ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-14)]);
    console.log(`  FAIL  ${rel}  (exit ${r.status}, ${secs}s)`);
  }
}

console.log(`\n${'-'.repeat(78)}`);
console.log(`  ${pass.length} passed, ${fail.length} failed, ${skip.length} skipped`);

if (unrun.length) {
  console.log(`\n  WARNING — engine/ contains ${unrun.length} file(s) that report their own pass/fail`);
  console.log(`  summary but are neither a listed gate nor in tests/, so nothing runs them:`);
  for (const f of unrun) console.log(`    engine/${f}`);
}

if (skip.length) {
  console.log(`\n  SKIPPED (not passed — a skip is not a result):`);
  for (const [rel, why] of skip) console.log(`    ${rel}  — ${why}`);
}

if (fail.length) {
  console.log(`\n  FAILURES`);
  for (const [rel, status, tailLines] of fail) {
    console.log(`\n    ${rel}  (exit ${status})`);
    for (const l of tailLines) console.log(`      ${l}`);
  }
}

process.exit(fail.length ? 1 : 0);
