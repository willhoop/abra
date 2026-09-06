/* test-workflow-paths.js — A WORKFLOW THAT `git add`s AN IGNORED PATH IS A DEAD COLLECTOR.
 *
 * WHY THIS EXISTS. On 2026-07-28 commit acf7124 moved the game stores to being tracked COMPRESSED
 * (`<store>.jsonl.gz`) because the plain ladder file was approaching GitHub's hard 100 MB per-file
 * limit, and added the plain paths to .gitignore. `.github/workflows/ingest.yml` still named the
 * PLAIN paths in its `git add`. `git add` on an ignored path exits 1, the step runs under
 * `bash -e`, and the run died there — before the commit, before the push.
 *
 * IT FAILED ON EVERY SCHEDULED RUN FOR 24 DAYS, roughly 570 consecutive failures, each one emailing
 * the owner. The collector fetched the replays correctly every hour and threw them away. Showdown's
 * replay pool is a rolling ~1,250 per format, so an estimated 2,500-3,000 ladder games aged out and
 * are unrecoverable. The commit that FIXED the size problem is what broke the collector, and it
 * broke it in the one place nobody reads.
 *
 * WHY A TEST AND NOT A COMMENT. The repository already carries this lesson three times over — the
 * fourteen stale handoffs, the ban list of four, the auto-commit described in the present tense for
 * twelve days after it died. Prose does not survive contact with a file it describes. This is a
 * STATIC check: it needs no network, no runner and no schedule, it runs in milliseconds, and it
 * would have failed on the very commit that introduced the bug.
 *
 * WHAT IT CHECKS. Every `git add` path in every workflow must be committable — not ignored, and its
 * directory must exist. A glob is resolved before being judged. A path that does not exist YET is
 * allowed only when it is a generated artifact whose directory is tracked, because failing on those
 * would make the test fire on a fresh clone; an IGNORED path is never allowed, which is the defect.
 *
 * SHOWN RED BEFORE BEING TRUSTED (re-demonstrated 2026-08-26, on BOTH line endings): put
 * `git add data/games.ladder.jsonl` back into a workflow and this reports
 *     FAIL  <file> stages data/games.ladder.jsonl, which .gitignore excludes
 * Removed again, it reports `ok` and a non-zero static-path count.
 *
 * LINE ENDINGS — WHY THE READ NORMALISES. This check was BLIND ON THIS MACHINE for its whole life
 * and green on CI, which is the worst arrangement available: the box where somebody edits a
 * workflow is the box where the check is asleep. `git config core.autocrlf` is true, so a workflow
 * can be CRLF in the working tree while its committed blob is LF. `joined.split('\n')` then leaves
 * a trailing `\r` on every line, and in JavaScript `.` EXCLUDES all FOUR line terminators
 * (\n, \r, \u2028, \u2029 - WRITTEN ESCAPED ON PURPOSE: the last two are invisible
 * in an editor, and this repo has already lost a regex to two raw 0x08 bytes that rendered as
 * nothing). So `(.+)$` (no `m` flag, `$` = end of string) cannot consume that `\r` and the match
 * fails OUTRIGHT. Every `git add` line was silently skipped; `staged` stayed 0 and the only reason
 * this was ever visible is the "asserted nothing" guard below. Measured before the fix:
 * smogon-stats.yml carried 98 CR / 98 LF and held the ONLY static `git add` in the repo.
 * The normalisation is done ONCE, at the read, so nothing added downstream in this file can be
 * bitten by the same thing again — a per-regex `\r?` would have fixed the instance, not the class.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const WF = path.join(ROOT, '.github', 'workflows');
let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok    ' + m); };
const bad = m => { fail++; console.log('  FAIL  ' + m); };

if (!fs.existsSync(WF)) {
  console.log('NOT RUN — no .github/workflows directory. This is not a pass.');
  process.exit(2);
}

/* `git check-ignore` is the authority on whether a path is ignored — reimplementing .gitignore
 * matching here would be a second implementation of a fact git already owns, which is the very
 * thing CLAUDE.md forbids. Exit 0 means IGNORED. */
const isIgnored = p => {
  const r = cp.spawnSync('git', ['check-ignore', '-q', '--', p], { cwd: ROOT });
  return r.status === 0;
};

const files = fs.readdirSync(WF).filter(f => /\.ya?ml$/.test(f));
console.log('WORKFLOW STAGING PATHS — every `git add` must name something git can actually commit\n');
console.log('  ' + files.length + ' workflow file(s): ' + files.join(', ') + '\n');

/* ONE normalisation, at the read. CRLF and lone-CR both become \n here, so every regex, split and
 * trim below sees exactly what CI sees. See the LINE ENDINGS note in the header. */
const readWorkflow = p => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');

let staged = 0, crlfFiles = 0;
for (const f of files) {
  const raw = fs.readFileSync(path.join(WF, f), 'utf8');
  if (raw.includes('\r')) crlfFiles++;
  const text = readWorkflow(path.join(WF, f));

  /* A `git add` may be continued across lines with a trailing backslash, which ingest.yml does.
   * Joining them first is why this sees the .gz paths on the second line rather than stopping at
   * the first. */
  const joined = text.replace(/\\\s*\n\s*/g, ' ');

  for (const line of joined.split('\n')) {
    /* COMMENTS TALK ABOUT `git add` TOO, and matching them made this test report `ok ... stages
     * would` — a passing assertion about an English word. A green line that names no path is the
     * "a test asking nothing" shape this repo has a rule about, so comment lines are skipped
     * BEFORE the match rather than filtered out of its results afterwards. */
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/git\s+add\s+(.+)$/);
    if (!m) continue;
    const args = m[1].split(/\s+/)
      .filter(a => a && !a.startsWith('-') && !a.startsWith('#') && a !== '.' && a !== '&&');
    for (const a of args) {
      /* A shell variable cannot be resolved statically. Naming one here is itself a smell, but it
       * is not this test's claim to make, so it is reported and skipped rather than failed. */
      if (/[$`*?]/.test(a)) { console.log('  --    ' + f + ' stages a dynamic path, not checked: ' + a); continue; }
      staged++;
      const abs = path.join(ROOT, a);
      if (isIgnored(abs)) {
        bad(f + ' stages ' + a + ', which .gitignore excludes — `git add` exits 1 and, under '
          + '`bash -e`, kills the step before the commit');
      } else if (!fs.existsSync(path.dirname(abs))) {
        bad(f + ' stages ' + a + ', whose directory does not exist');
      } else {
        ok(f + ' stages ' + a);
      }
    }
  }
}

/* THE RECEIPT. A count is the only thing that separates "every path is fine" from "the matcher is
 * blind and reported every path fine by never looking at one". It is printed on every run, pass or
 * fail, because that is what made the CRLF blindness visible. */
console.log('\n  ' + staged + ' static `git add` path(s) checked'
  + (crlfFiles ? '  (' + crlfFiles + ' workflow file(s) are CRLF in the working tree — normalised at the read)' : ''));
if (!staged) bad('no `git add` path was found in any workflow — this test asserted nothing, which '
  + 'is worse than failing. Did the staging move out of the workflow files?');

/* THE SECOND HALF: the tracked archive must not silently lag the store it claims to mirror. A stale
 * archive reads as a healthy repository right up until somebody clones it. Only meaningful where
 * the plain store exists (a fresh clone has only the compressed side), so absence is skipped, not
 * failed.
 *
 * WHAT IS TRACKED CHANGED ON 2026-09-06 AND THIS CLAUSE DID NOT HAVE TO. It used to mean "the three
 * data/games.*.jsonl.gz monoliths are newer than their stores"; it now means "every row of every
 * store is carried by a shard under data/parsed/". The wording is updated because a message naming
 * a file that no longer exists is the stale-prose failure this repository is full of, but the call
 * is the same one — `--check` still reports rather than repairs, and it is the authority on its own
 * rule rather than a second implementation of it here. It costs ~9 s (it gunzips ~67 MB of shards),
 * against ~0 s for the mtime comparison it replaces; that is the price of comparing counts instead
 * of timestamps, and CLAUDE.md is explicit that "newer than its source" is no evidence at all. */
const anyPlain = ['games.ladder', 'games.bo3', 'games.ots']
  .some(s => fs.existsSync(path.join(ROOT, 'data', s + '.jsonl')));
if (anyPlain) {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'build', 'compress-stores.js'), '--check'],
    { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) ok('every store row is carried by a tracked shard under data/parsed/');
  else bad('a store has rows in no shard — origin would carry an out-of-date corpus while every '
    + 'local run reads a newer one. Run: node build/compress-stores.js\n' + (r.stdout || '').trim());
} else {
  console.log('  --    no plain store present (fresh clone) — shard currency not checked');
}

console.log('\nWORKFLOW PATHS: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
