/* mutate-gates.js — MUTATION TESTING, POINTED AT THE GATES.
 *
 *   node tools/mutate-gates.js                     mutate the default target set
 *   node tools/mutate-gates.js --targets a,b,c     mutate named top-level functions instead
 *   node tools/mutate-gates.js --list              print the derived ranges and the tree, run nothing
 *   node tools/mutate-gates.js --stryker <dir>     where @stryker-mutator/core is installed
 *
 * WHY THIS EXISTS
 * ---------------
 * This project's whole testing culture is "shown RED on a deliberate break" — tests/test-lownode.js,
 * the coverage assertion in tests/run-all.js, the MEDI_* knobs that restore a defect on demand so a
 * probe can be demonstrated failing. That IS mutation testing, done one mutant at a time, by hand, by
 * whoever remembers. This mechanises it.
 *
 * AND IT IS POINTED AT THE GATES, NOT THE ENGINE, DELIBERATELY. The engine has an oracle: Showdown,
 * and engine/game_differential.js compares against it every run. The gates have none. Nothing checks
 * the checkers — which is exactly how a regex holding two raw 0x08 bytes sat inside the meta-check for
 * weeks with one alternative that could never match, and how `unrun.length` was printed as a warning
 * while the exit expression read `fail.length` alone.
 *
 * THREE THINGS IT REFUSES TO DO, EACH BECAUSE THE OBVIOUS VERSION IS DANGEROUS HERE
 * ---------------------------------------------------------------------------------
 * 1. IT DOES NOT RUN STRYKER AGAINST THE REPO ROOT. data/ is 26 GB; Stryker's sandbox would copy it.
 *
 * 2. IT DOES NOT LET A MUTANT WRITE INTO THE LIVE data/. `quarantine.js --selftest` writes
 *    data/decision-impact.json, UNLINKS it, and restores it in a `finally` (engine/quarantine.js
 *    ~3745-3800). That is correct for one hand-run. Under mutation it is run hundreds of times, and a
 *    mutant that hangs is KILLED BY TIMEOUT — mid-block, after the unlink, before the finally. An
 *    untracked artifact deleted that way is unrecoverable. So the run happens in an isolated tree.
 *
 * 3. IT DOES NOT TYPE THE LINE RANGES INTO THE CONFIG. Stryker's `file.js:START-END` syntax is a
 *    promise to remember to update it, and this repository has a fourteen-handoff record of not
 *    keeping that promise. Worse, the failure is silent in the reassuring direction: a range that has
 *    slid off its function mutates comment text, produces "no mutants" or an easy 100%, and reads as
 *    coverage. Ranges are derived from the source on every run, from the function NAME.
 *
 * THE FAITHFULNESS CHECK IS THE LOAD-BEARING PART. An isolated tree that does not reproduce the live
 * verdict is not a photograph of the gate, it is a different gate. This runs the selftest in the REAL
 * repo and in the isolated tree and REFUSES to start Stryker unless the two verdict lines are
 * identical. A missing support file shows up there as a changed count, not as a quiet 100% score.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const ARG = process.argv.slice(2);
const flag = (n, dflt) => { const i = ARG.indexOf(n); return i >= 0 && ARG[i + 1] ? ARG[i + 1] : dflt; };

/* THE FILE UNDER MUTATION, AND THE COMMAND THAT IS THE ORACLE FOR IT.
 * `--selftest` and not `--check`: --check shells out to engine/status.js, which reads the live tree,
 * so it cannot be isolated and its verdict moves under another division's pass. --selftest is 159
 * assertions on synthetic input in 2.6s, and it is the thing that decides whether --check may be
 * believed at all (engine/quarantine.js:4429 runs it first and refuses if it is red). */
const TARGET_FILE = 'engine/quarantine.js';
const TEST_CMD = ['engine/quarantine.js', '--selftest'];

/* THE DEFAULT TARGET SET — the closed-detector and the exit-code map.
 * These are the smallest functions in the file whose output is a VERDICT rather than a report, and
 * both are shared: engine/open_work.js imports the closed-detector so the work list and the gate can
 * never disagree, and `clauseExit` is the 0/1/2 that engine/register_reality.js reads to decide
 * whether a register row is closed. A wrong answer here closes a live defect. */
const DEFAULT_TARGETS = ['roadmapRowIsClosed', 'roadmapRowStatusCell', 'notADefectSuppresses',
  'roadmapRowSaysBroken', 'clauseExit'];
const TARGETS = flag('--targets', '').split(',').map(s => s.trim()).filter(Boolean);
const WANT = TARGETS.length ? TARGETS : DEFAULT_TARGETS;

/* ---- 1. derive the line range of each named top-level function ------------------------------- */

/* A top-level function in this file opens at column 0 with `function NAME(` and closes at the first
 * later line that is exactly `}`. That is a property of the file's own formatting, so it is asserted
 * rather than assumed: a name that does not resolve is an ERROR and stops the run. A LOOKUP THAT
 * MATCHES NOTHING IS AN ERROR, NOT AN EMPTY SET (engine/names.js). */
function rangeOf(lines, name) {
  const open = lines.findIndex(l => new RegExp('^function\\s+' + name + '\\s*\\(').test(l));
  if (open < 0) return null;
  for (let i = open + 1; i < lines.length; i++) if (lines[i] === '}') return [open + 1, i + 1];
  return null;
}

const src = fs.readFileSync(D(TARGET_FILE), 'utf8');
const lines = src.split(/\r?\n/);
const ranges = [], missing = [];
for (const name of WANT) {
  const r = rangeOf(lines, name);
  if (!r) { missing.push(name); continue; }
  ranges.push({ name, from: r[0], to: r[1] });
}
if (missing.length) {
  console.error('CANNOT DERIVE A RANGE for: ' + missing.join(', '));
  console.error('  Those names are not top-level `function NAME(` declarations in ' + TARGET_FILE + '.');
  console.error('  A range that cannot be derived is NOT run as a whole-file mutation — that would');
  console.error('  mutate 4,500 lines and report a score for a question nobody asked.');
  process.exit(2);
}

const mutate = ranges.map(r => `${TARGET_FILE}:${r.from}-${r.to}`);

/* ---- 2. derive the isolated tree ------------------------------------------------------------- */

/* The support set is DERIVED, transitively, from what the sources actually reference:
 *   require('./x.js')     — sibling engine modules
 *   D('data', 'x.json')   — artifacts the clauses read
 *   D('docs', 'x.md')     — the register the closed-detector runs over
 * It is deliberately not a typed list. If the derivation misses something, the faithfulness check
 * below fails loudly rather than the score coming back clean. */
function closure(entryRel) {
  const seen = new Set(), files = new Set(), data = new Set(), docs = new Set();
  const walk = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    let s; try { s = fs.readFileSync(D(rel), 'utf8'); } catch (e) { return; }
    files.add(rel);
    const dir = path.posix.dirname(rel.replace(/\\/g, '/'));
    for (const m of s.matchAll(/require\(\s*'(\.\/[A-Za-z0-9_.\-]+\.js)'\s*\)/g)) {
      walk(path.posix.normalize(dir + '/' + m[1]));
    }
    for (const m of s.matchAll(/D\(\s*'data'\s*,\s*'([A-Za-z0-9_.\-]+)'\s*\)/g)) data.add('data/' + m[1]);
    for (const m of s.matchAll(/D\(\s*'docs'\s*,\s*'([A-Za-z0-9_.\-]+)'\s*\)/g)) docs.add('docs/' + m[1]);
  };
  walk(entryRel);
  return { js: [...files].sort(), data: [...data].sort(), docs: [...docs].sort() };
}

const CL = closure(TARGET_FILE);

/* --tree <dir> REUSES AN EXISTING TREE, AND IT IS THERE BECAUSE A SCORE IS ONLY COMPARABLE TO A SCORE
 * TAKEN ON THE SAME BYTES. The support set includes data/game-differential.json and
 * data/mechanics-census.json, which OPS and ENGINE rewrite while this runs; a tree rebuilt an hour
 * later is a different sample, exactly as engine/game_differential.js's team pool is. Rebuild for a
 * fresh reading; pass --tree to compare two runs. */
const REUSE = flag('--tree', null);
const TREE = REUSE || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abra-mutate-')), 'tree');
function build() {
  if (REUSE) return { copied: fs.readdirSync(path.join(TREE, 'engine')), absent: ['(reused tree — nothing copied)'] };
  for (const d of ['engine', 'data', 'docs', 'tools']) fs.mkdirSync(path.join(TREE, d), { recursive: true });
  const copied = [], absent = [];
  for (const rel of [...CL.js, ...CL.data, ...CL.docs]) {
    const from = D(rel), to = path.join(TREE, rel);
    if (!fs.existsSync(from)) { absent.push(rel); continue; }
    /* A DIRECTORY IS NOT AN ARTIFACT. `D('data','releases')` is a folder of frozen snapshots, and it
     * is never read by --selftest. Copying it would be minutes and gigabytes; the faithfulness check
     * below is what proves leaving it out changed no answer. */
    if (fs.statSync(from).isDirectory()) { absent.push(rel + ' [directory, not copied]'); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied.push(rel);
  }
  /* Stryker wants a package.json in the project it sandboxes. This one is the isolated tree's, not
   * the repo's — nothing here touches the repo's dependency tree, which matters because this is
   * expected to be run beside other agents' work. */
  fs.writeFileSync(path.join(TREE, 'package.json'),
    JSON.stringify({ name: 'abra-gate-mutation-tree', private: true, version: '0.0.0' }, null, 2) + '\n');
  return { copied, absent };
}

/* ---- 3. the faithfulness check --------------------------------------------------------------- */

const verdictOf = (cwd) => {
  const r = spawnSync(process.execPath, TEST_CMD, { cwd, encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  const m = out.match(/QUARANTINE SELFTEST: .*$/m);
  return { status: r.status, bytes: out.length, verdict: m ? m[0] : null, tail: out.split('\n').slice(-6).join('\n') };
};

/* ---- 4. go ----------------------------------------------------------------------------------- */

console.log('MUTATE-GATES — ' + TARGET_FILE + ', ' + ranges.length + ' derived range(s)');
for (const r of ranges) console.log(`  ${r.name}   lines ${r.from}-${r.to}  (${r.to - r.from + 1} lines)`);
console.log('  test command: node ' + TEST_CMD.join(' '));

const built = build();
console.log(`\n  isolated tree: ${TREE}`);
console.log(`    ${built.copied.length} file(s) copied` + (built.absent.length
  ? `, ${built.absent.length} referenced-but-absent (${built.absent.join(', ')})` : ''));

const live = verdictOf(ROOT);
const iso = verdictOf(TREE);
console.log(`\n  LIVE  exit ${live.status}  ${live.verdict || '(no verdict line)'}`);
console.log(`  ISO   exit ${iso.status}  ${iso.verdict || '(no verdict line)'}`);

/* THE EXIT CODE IS NOT THE EVIDENCE. This repository has been burned repeatedly by a command that
 * exits 0 having done nothing — `node engine/move_result_state.js` without --selftest prints nothing
 * at all and exits 0. So the output SIZE and the verdict LINE are checked too, in both trees. */
if (live.status !== 0 || !live.verdict || live.bytes < 1000) {
  console.error('\nREFUSING — the live selftest is not green, so there is no baseline to mutate against.');
  console.error(live.tail);
  process.exit(1);
}
if (iso.verdict !== live.verdict || iso.status !== live.status) {
  console.error('\nREFUSING — the isolated tree does not reproduce the live verdict.');
  console.error('  A tree that answers differently is a DIFFERENT GATE, and a score taken on it is a');
  console.error('  score for a question nobody asked. Most likely a support file was not derived.');
  console.error(iso.tail);
  process.exit(1);
}
console.log('  the isolated tree reproduces the live verdict exactly — it is a photograph of the gate.');

if (ARG.includes('--list')) { console.log('\n--list: nothing was run.'); process.exit(0); }

/* The config is the repo's; only `mutate` is overlaid, because only `mutate` is derived. */
const conf = JSON.parse(fs.readFileSync(D('stryker.gates.conf.json'), 'utf8'));
conf.mutate = mutate;
conf.tempDirName = 'stryker-tmp';
const confPath = path.join(TREE, 'stryker.conf.json');
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

const STRYKER_HOME = flag('--stryker', process.env.ABRA_STRYKER_HOME || ROOT);
const bin = path.join(STRYKER_HOME, 'node_modules', '@stryker-mutator', 'core', 'bin', 'stryker.js');
if (!fs.existsSync(bin)) {
  console.error('\n@stryker-mutator/core is not installed at ' + STRYKER_HOME);
  console.error('  npm install --save-dev @stryker-mutator/core@10.0.0');
  console.error('  or point this at an existing install: --stryker <dir>  /  ABRA_STRYKER_HOME=<dir>');
  process.exit(2);
}

console.log('\n  running stryker (this is the expensive part) ...\n');
const started = Date.now();
const r = spawnSync(process.execPath, [bin, 'run', confPath], { cwd: TREE, stdio: 'inherit' });
console.log(`\n  wall clock: ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log('  report:     ' + path.join(TREE, 'reports', 'mutation', 'mutation-report.json'));
console.log('  tree kept for inspection: ' + TREE);
process.exit(r.status === null ? 1 : r.status);
