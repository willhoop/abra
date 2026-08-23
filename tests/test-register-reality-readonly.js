/* test-register-reality-readonly.js — A READ-ONLY FLAG THAT WRITES IS THE WORST KIND OF INSTRUMENT
 * DEFECT, AND NOTHING IN THIS REPOSITORY WAS ASSERTING OTHERWISE. ROADMAP #369.
 *
 * ================= WHAT HAPPENED ==================================================================
 *
 * `engine/register_reality.js --list` advertises *"coverage only; runs nothing"*. That was true of
 * the INSTRUMENTS and false of the ARTIFACT: both modes ran one shared code path that ended in
 * `fs.writeFileSync(data/register-reality.json)`, so LOOKING at the register republished it.
 *
 * MEASURED ON THE PRE-FIX BYTES, 2026-08-23. One `--list` took the settled 2026-08-22T01:55:12.569Z
 * artifact from `premature_closes: 2, unrunnable: 1, distinct_commands_run: 22` to `0, 0, 0` — every
 * verdict replaced by `NOT RUN`, 306 insertions and 144 deletions against HEAD — and then printed
 * *"REGISTER REALITY: every marked row agrees with its instrument"*, a verdict sentence about 22
 * instruments not one of which had been started. It was recovered only because the file is TRACKED.
 *
 * ================= WHY THE ASSERTION LIVES OUT HERE ===============================================
 *
 * `engine/register_reality.js --selftest` proves the STRUCTURAL half — that `publish()` refuses a
 * caller not holding a measurement, and that the whole listing path runs with `fs.writeFileSync`
 * booby-trapped and never touches it. It cannot prove the BEHAVIOURAL half. A function inside a
 * process cannot honestly assert what that process did to a file on disk: it can only assert about
 * the paths it thought to call. So this file starts the REAL process, with the REAL flag, and
 * compares the artifact's bytes and mtime across it. That is the claim #369 is about, and it is the
 * one a later refactor would break.
 *
 * IT IS HERE AND NOT IN A GATE LIST BECAUSE THE RUNNER FINDS `tests/test-*.js` BY DERIVATION.
 * `tests/run-all.js` globs this directory; a check that needs a human to remember to register it is
 * the hand-typed CI list that file exists to replace. `engine/register_reality.js` itself is carried
 * in that runner's PENDING_WIRE with "it WRITES its artifact unconditionally" as one of its two
 * blockers — this test also runs its `--selftest`, so the selftest is wired even while the full
 * measurement (22 instruments, minutes) stays out of the suite.
 *
 * ================= THE MTIME IS PART OF THE CLAIM =================================================
 *
 * A digest-only assertion would pass on a writer made IDEMPOTENT, and idempotence is not the fix:
 * this artifact's job is to record WHEN each verdict was measured, so rewriting it with identical
 * content still moves its timestamp and its provenance, and the file then lies about the age of
 * every verdict in it. Both are asserted.
 *
 * Runs no game, loads no simulator, fits nothing. Two short child processes. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, 'data', 'register-reality.json');
const SCRIPT = path.join(ROOT, 'engine', 'register_reality.js');

let ran = 0, bad = 0;
const ok = (n, c, got) => {
  ran++; if (!c) bad++;
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`);
};

const snap = () => {
  if (!fs.existsSync(ART)) return { exists: false };
  const bytes = fs.readFileSync(ART);
  const st = fs.statSync(ART);
  return { exists: true, bytes, sha: crypto.createHash('sha256').update(bytes).digest('hex'), mtimeMs: st.mtimeMs };
};

/* ---- 1. THE READ-ONLY FLAG, ON THE REAL PROCESS ----------------------------------------------- */

const before = snap();
const r = spawnSync(process.execPath, [SCRIPT, '--list'], { cwd: ROOT, encoding: 'utf8' });
const after = snap();
const out = (r.stdout || '') + (r.stderr || '');

/* RESTORE FIRST, ASSERT SECOND. If this test is ever red it is because a listing has just overwritten
 * the verdicts, and leaving them overwritten while printing FAIL would do the damage the test exists
 * to catch. The bytes and the mtime both go back.
 *
 * THE ABSENT CASE IS NOT SYMMETRIC AND IS NOT TIDIED. If the artifact did not exist and the listing
 * CREATED it, this reports and leaves it: CLAUDE.md's standing rule is that a file you did not create
 * is never deleted, and a test that tidies data/ is a worse defect than the one it found. */
let restored = false;
if (before.exists && after.exists && after.sha !== before.sha) {
  fs.writeFileSync(ART, before.bytes);
  const t = new Date(before.mtimeMs);
  fs.utimesSync(ART, t, t);
  restored = true;
} else if (before.exists && after.exists && after.mtimeMs !== before.mtimeMs) {
  const t = new Date(before.mtimeMs);
  fs.utimesSync(ART, t, t);
  restored = true;
}

ok('`--list` exits 0 — it is an inventory, not a verdict', r.status === 0, { status: r.status, out: out.slice(-400) });

if (!before.exists) {
  /* The gitignore/clean-checkout case. The artifact is tracked today, so this is a guard rather than
   * the expected path — and the claim it makes is the strong one: a listing must not CREATE it. */
  ok('`--list` did not CREATE data/register-reality.json where none existed (it was absent before)',
    !after.exists, { after_exists: after.exists });
  console.log('  NOTE  data/register-reality.json was absent before this run; the byte-identity '
    + 'assertions below could not be made.');
  if (after.exists) console.log('  NOTE  the file the listing created has been LEFT IN PLACE, not deleted.');
} else {
  ok('THE ASSERTION #369 IS ABOUT — data/register-reality.json is BYTE-IDENTICAL after a `--list`. '
    + 'A coverage listing may not republish the verdicts it is listing',
    after.exists && after.sha === before.sha,
    { before: before.sha.slice(0, 16), after: after.exists ? after.sha.slice(0, 16) : 'GONE', restored });
  ok('and its MTIME did not move either — the artifact records WHEN each verdict was measured, so an '
    + 'idempotent rewrite is not a fix',
    after.exists && after.mtimeMs === before.mtimeMs,
    { before: before.mtimeMs, after: after.exists ? after.mtimeMs : 'GONE', restored });
}

/* ---- 2. AND IT MUST NOT CLAIM A VERDICT IT DID NOT MEASURE ------------------------------------ */

/* The quieter half of the same defect: the pre-fix `--list` fell through to the summary line and
 * printed "every marked row agrees with its instrument" having run nothing. The wipe leaves a trace
 * in git; the sentence leaves none, and a sentence is what gets quoted. */
ok('RED — `--list` does not print the agreement verdict. It ran no instrument, so it has no standing '
  + 'to say every row agrees with one',
  !/agrees with its instrument/.test(out) && !/row\(s\) disagree with their own instrument/.test(out),
  out.split('\n').filter(l => /instrument/.test(l)).slice(-3));
ok('RED — `--list` does not report a write it did not make',
  !/wrote data\/register-reality\.json/.test(out),
  out.split('\n').filter(l => /wrote/.test(l)));
ok('`--list` says out loud that nothing was run and nothing was written',
  /NOTHING WAS WRITTEN/.test(out) && /NOT WRITTEN|NOT written/.test(out), out.slice(0, 200));
ok('`--list` still reports the coverage it exists to report', /defect-register rows/.test(out)
  && /rows carrying a VERIFIED BY marker/.test(out), out.slice(0, 300));

/* ---- 3. THE STRUCTURAL HALF, WIRED IN ---------------------------------------------------------- */

const s = spawnSync(process.execPath, [SCRIPT, '--selftest'], { cwd: ROOT, encoding: 'utf8' });
const sout = (s.stdout || '') + (s.stderr || '');
const m = sout.match(/REGISTER-REALITY SELFTEST: (\d+) passed, (\d+) failed/);
ok('engine/register_reality.js --selftest is GREEN, and this suite is what runs it',
  s.status === 0 && m && +m[2] === 0, { status: s.status, line: m ? m[0] : sout.slice(-300) });
ok('the selftest carries the #369 cases — the listing path is exercised against a booby-trapped '
  + 'writer on every run, not just on the day it was fixed',
  /BOOBY-TRAPPED/.test(sout) && /REFUSING to write|publish\(\) REFUSES/.test(sout));

/* ---- 4. THE ARTIFACT IS STILL WHERE WE FOUND IT ------------------------------------------------ */

/* THE BYTES ARE COMPARED EXACTLY AND THE MTIME TO THE MILLISECOND, and the difference is not a
 * relaxation for convenience. `fs.statSync` reports mtime with sub-millisecond precision on this
 * filesystem (…140.483) while `fs.utimesSync` accepts only a Date, i.e. whole milliseconds — so an
 * exact restore is not expressible and demanding one would make this line red on a run that had
 * repaired the damage perfectly. Measured on the pre-fix bytes: it failed by 0.483 ms. The assertion
 * above, which is the #369 claim itself, stays EXACT because there nothing has restored anything. */
const end = snap();
ok('this test itself left data/register-reality.json as it found it (bytes exactly; mtime to the '
  + 'millisecond, which is all fs.utimesSync can restore)',
  before.exists === end.exists
  && (!before.exists || (end.sha === before.sha && Math.abs(end.mtimeMs - before.mtimeMs) < 2)),
  { before: before.exists && before.sha.slice(0, 16), end: end.exists && end.sha.slice(0, 16),
    mtime_delta_ms: before.exists && end.exists ? end.mtimeMs - before.mtimeMs : null });

if (restored) {
  console.log('\n  THE ARTIFACT WAS OVERWRITTEN BY A `--list` AND HAS BEEN RESTORED FROM THE BYTES THIS');
  console.log('  TEST READ BEFORE THE RUN. Verify against HEAD before trusting it: '
    + 'git diff -- data/register-reality.json');
}

console.log(`\nREGISTER-REALITY READ-ONLY: ${ran - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
