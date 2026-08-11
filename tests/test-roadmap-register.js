/* test-roadmap-register.js — THE ROADMAP MAY NOT LOSE TRACK OF SOMETHING WE DECIDED TO BUILD.
 *
 * Will, 2026-08-06: "I WANT THE ROADMAP TO BE COMPREHENSIVE AND UNABLE TO LOSE TRACK OF THE THINGS
 * WE WANT TO BUILD LATER."
 *
 * "Unable to" is a check, not a promise. This is the check.
 *
 * THE DRIFT IT CATCHES. Work in this project gets named in three places and they fall out of step:
 * a division ledger (docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md) says "routed, see #43"; a task holds
 * the detail; and docs/ROADMAP.md §5 is the index a human actually reads. When a ledger cites a task
 * the register has never heard of, that item exists only in a file nobody opens — which is precisely
 * how DODUO came to be "fitted, saved, quoted in documents, and never once in a live decision", and
 * how fourteen HANDOFF-*.md files came to be the only record of anything.
 *
 * WHAT IT ASSERTS. Every `#NN` a division ledger cites is either IN THE REGISTER, or in the DECLARED
 * list below with a reason. A number that is neither is a lost item and fails this file.
 *
 * WHY THE REGISTER AND NOT THE TASK LIST IS THE AUTHORITY. The task list lives in the harness and is
 * not in the repository, so a check cannot read it and a fresh session cannot recover it. The
 * register is committed. If the two disagree, the register is the one that survives a laptop.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not require every register entry to have a task, because
 * an idea can legitimately be recorded before it is scheduled — several §5 rows carry an em-dash
 * instead of a number. Losing a SCHEDULED item is the failure; recording an UNSCHEDULED one is the
 * point of the register.
 *
 * Proven red before trusted: `node tests/test-roadmap-register.js --selftest`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROADMAP = path.join(ROOT, 'docs', 'ROADMAP.md');
const LEDGERS = ['ENGINE', 'MEASURE', 'SEARCH', 'OPS', 'WEB'].map(n => path.join(ROOT, 'docs', n + '.md'));

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ok   ' + m); };
const bad = (m) => { fail++; console.log('  FAIL ' + m); };

/* DECLARED — a number a ledger cites that is deliberately NOT in the register, WITH ITS REASON.
 * A reason, not a bump: the same shape as tests/test-effective-identity.js's DECLARED block, which
 * exists so that a baseline nudge cannot launder an omission. */
const DECLARED = {
  '1': 'docs/ENGINE.md cites "#1" as a TABLE ROW ("the residue of #1") and in the prose "the #1 row '
     + 'by volume". Neither is a task reference. Not rewritten, because the sentences are correct '
     + 'English and bending them to satisfy a regex would be the check dictating the prose.',
  '2': 'Same shape: docs/ENGINE.md\'s "same pass as #2" points at row 2 of the table it sits in.',
  '18': 'docs/SEARCH.md:323 reads "`PRIORITIES.md` #18", with the scheme named on the line but the '
      + 'word separated from the number by a backtick, so the PRIORITIES strip above does not reach '
      + 'it. A docs/PRIORITIES.md index entry, not a task.',
  '40': 'Task #40 (the DUSK size gate) is DONE — verdict TOO BIG, 2026-08-06, artifact '
      + 'data/dusk-size-gate.json. Its successor #47 IS in the register. docs/MEASURE.md cites it '
      + 'twice and both are the PRIORITIES scheme anyway ("P0 #40", "PRIORITIES #40"). A completed '
      + 'item does not belong in a register of things still to build.',
  '46': 'Task #46 (the strong-player baseline) is DONE, 2026-08-06, artifact '
      + 'data/strong-player-baseline.json. docs/MEASURE.md:2004 cites it as provenance — "Built for '
      + 'task #46" — which is history, not a schedule.',
};

/* §5 is the register. Anything above it is narrative and may cite freely. */
function registerBody(md) {
  const start = md.indexOf('## 5. THE REGISTER');
  if (start < 0) return null;
  const after = md.indexOf('\n## ', start + 10);
  return md.slice(start, after < 0 ? md.length : after);
}

/* TWO NUMBERING SCHEMES SHARE THE `#N` SPELLING IN THIS REPO AND THEY ARE NOT THE SAME THING.
 * `PRIORITIES #18` indexes docs/PRIORITIES.md, a separate and older list; task #18 is unrelated.
 * The first version of this check read them as one and reported six phantom lost items — a check
 * that cries wolf is a check that gets ignored, which is how the docs-currency guard spent two days
 * as "one of the two known failures". Stripped before matching rather than filtered after, so the
 * exclusion cannot silently swallow a real citation that happens to sit near the word. */
const STRIP = /\bPRIORITIES\s+#\d{1,3}/gi;

function numbersIn(text) {
  const out = new Set();
  /* `#43` and `(#43)` and `#43/#44`. NOT `1.3` or a bare 43, which would match half the prose. */
  for (const m of text.replace(STRIP, ' ').matchAll(/#(\d{1,3})\b/g)) out.add(m[1]);
  return out;
}

function run(roadmapText, ledgerTexts) {
  const reg = registerBody(roadmapText);
  if (reg === null) return { fatal: 'docs/ROADMAP.md has no "## 5. THE REGISTER" section' };
  const registered = numbersIn(reg);
  const cited = new Map();
  for (const [name, text] of ledgerTexts) {
    for (const n of numbersIn(text)) {
      if (!cited.has(n)) cited.set(n, []);
      cited.get(n).push(name);
    }
  }
  const lost = [...cited.keys()].filter(n => !registered.has(n) && !DECLARED[n]).sort((a, b) => +a - +b);
  return { registered, cited, lost };
}

/* ---- SELFTEST ------------------------------------------------------------------------------- */
if (process.argv.includes('--selftest')) {
  console.log('SELFTEST — the check must catch a ledger citing something the register has never heard of\n');

  const goodReg = '## 5. THE REGISTER — x\n| 41 | a thing | (#41) and #42 |\n';
  const a = run(goodReg, [['docs/ENGINE.md', 'routed, see #41 and #42']]);
  a.lost.length === 0 ? ok('a fully-registered ledger passes (0 lost of ' + a.cited.size + ' cited)')
                      : bad('a registered item was reported lost: ' + a.lost.join(', '));

  const b = run(goodReg, [['docs/SEARCH.md', 'routed, see #41 and #99']]);
  b.lost.includes('99')
    ? ok('a ledger citing UNREGISTERED #99 is caught')
    : bad('THE GATE IS BLIND: it did not catch a ledger citing an item the register never mentions.');

  const c = run('## 4. something else\nno register here\n', [['docs/ENGINE.md', '#41']]);
  c.fatal ? ok('a roadmap with no register section is a hard failure, not a silent pass')
          : bad('a missing register section did not fail — the check would pass on a deleted register');

  /* A number inside prose like "1.3" must not be read as task #3. */
  const d = run(goodReg, [['docs/OPS.md', 'see section 1.3 and 4.2 for context']]);
  d.lost.length === 0 ? ok('section numbers in prose are not mistaken for task references')
                      : bad('prose section numbers were read as tasks: ' + d.lost.join(', '));

  console.log('\nSELFTEST: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

/* ---- THE GATE ------------------------------------------------------------------------------- */
console.log('ROADMAP REGISTER — nothing a division ledger schedules may be missing from §5\n');

const roadmap = fs.readFileSync(ROADMAP, 'utf8');
const ledgers = LEDGERS.filter(p => fs.existsSync(p))
  .map(p => [path.relative(ROOT, p).replace(/\\/g, '/'), fs.readFileSync(p, 'utf8')]);

const r = run(roadmap, ledgers);
if (r.fatal) { bad(r.fatal); console.log('\nROADMAP REGISTER: ' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

console.log('  register §5 names        ' + r.registered.size + ' item(s)');
console.log('  division ledgers cite    ' + r.cited.size + ' distinct item(s) across ' + ledgers.length + ' ledger(s)');
console.log('  declared exceptions      ' + Object.keys(DECLARED).length + '\n');

if (r.lost.length) {
  bad(r.lost.length + ' item(s) a ledger schedules and the register does not name — these exist only '
    + 'in a file nobody opens:');
  for (const n of r.lost) console.log('         #' + n + '  cited by ' + [...new Set(r.cited.get(n))].join(', '));
  console.log('\n         Add it to docs/ROADMAP.md §5 with what unblocks it, or declare it in');
  console.log('         DECLARED at the top of this file WITH A REASON. Do not delete the citation.');
} else {
  ok('every item a division ledger schedules is named in the register');
}

/* The register must actually be a register, not an empty heading somebody kept. */
r.registered.size >= 10
  ? ok('the register is populated (' + r.registered.size + ' items)')
  : bad('the register names only ' + r.registered.size + ' item(s) — that is a heading, not a register');

/* ---- ROADMAP #149 — A NUMBER IN A COMMIT MESSAGE IS NOT A REGISTERED NUMBER ------------------
 *
 * The check above reads DIVISION LEDGERS. On 2026-08-10 two shipped commits cited numbers that had
 * never been registered anywhere: `0a28580` (4.1.0) says "ROADMAP #145" for the grounded axis and
 * `e7d672a` (4.2.0) says "ROADMAP #146" for the sixth gate clause, while HEAD's §5 stopped at #143.
 * A later agent then correctly took #145 and #146 as the next free numbers for unrelated PP work, so
 * **those two numbers now mean two different things depending on which file you read.**
 *
 * This gate did not fail and was not wrong to pass — it was never pointed at commit messages. So it
 * is pointed at them now. A commit is as durable a citation as a ledger and a good deal harder to
 * correct afterwards: the message cannot be rewritten once pushed, which is why #147/#148 had to be
 * minted rather than the history fixed.
 *
 * SCOPE IS THE LAST 40 COMMITS, DELIBERATELY. The whole history contains numbers from long-retired
 * numbering schemes, and a gate that fails on ancient history gets ignored — which is the disease
 * this repository names "one of the two known failures". Recent enough to catch the mistake while it
 * is still correctable, short enough to stay green.
 *
 * ABSENT GIT IS NOT A PASS OR A FAIL — it is SKIPPED and said out loud, because a check that silently
 * evaporates outside a git checkout is a capability that cannot prove it ran. */
(() => {
  let log = null;
  try {
    log = require('child_process')
      .execSync('git log -40 --format=%s%n%b', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { log = null; }
  if (log === null) {
    console.log('  skip commit-message citations — git log unavailable here (not a pass: nothing was checked)');
    return;
  }
  const cited = new Map();
  /* Only "ROADMAP #n" counts. A bare "#n" in a commit body is as often a PR or an issue, and a gate
   * that fires on those trains people to phrase around it. */
  for (const m of log.matchAll(/ROADMAP\s+#(\d{1,3})/gi)) {
    const n = m[1];
    if (!cited.has(n)) cited.set(n, 0);
    cited.set(n, cited.get(n) + 1);
  }
  const missing = [...cited.keys()].filter(n => !r.registered.has(n) && !DECLARED[n]).sort((a, b) => a - b);
  if (!cited.size) {
    ok('no ROADMAP citation in the last 40 commit messages to check');
  } else if (missing.length) {
    bad(missing.length + ' ROADMAP number(s) cited by a recent COMMIT MESSAGE that §5 does not name — '
      + 'the citation is permanent and the number is free for someone else to take: #' + missing.join(', #'));
    console.log('         Register it in docs/ROADMAP.md §5, or — if the number has already been reused —');
    console.log('         mint a NEW row for the finding and record the collision. Do not renumber the');
    console.log('         other row and do not rewrite the commit.');
  } else {
    ok('every ROADMAP number cited by the last 40 commit messages is named in the register ('
      + cited.size + ' distinct)');
  }
})();

console.log('\nROADMAP REGISTER: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
