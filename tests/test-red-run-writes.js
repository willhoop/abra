/* test-red-run-writes.js — A CHECK MAY NOT PUBLISH AN ARTIFACT ON A PATH WHERE IT ALREADY FAILED.
 *
 *   node tests/test-red-run-writes.js            the gate
 *   node tests/test-red-run-writes.js --explain   every write site and every failure signal it found
 *
 * WHY THIS EXISTS — 2026-08-23, and it is the worst class this repository has found.
 * ---------------------------------------------------------------------------------
 * `tests/test-unmodelled-clicks.js` wrote its artifact unconditionally, and that artifact is the
 * test's OWN RATCHET BASELINE. So a red run wrote the grown set as the new baseline and the second
 * run was green. Measured, with a deliberate break:
 *
 *   run 1  FAIL (NEW: healbell), exit 1, REWROTE the artifact including healbell   ->  run 2 GREEN
 *
 * **Re-running a failing test made it pass.** That is not a dirty-tree annoyance: it is a check that
 * erases the evidence of its own failure, which is this project's signature bug — a capability going
 * absent while everything reports success — with the sign flipped. Five more instances were found by
 * reading on the same night, one of them (`tests/test-game-diff.js`) publishing after its comparator
 * had FAILED ITS OWN PLANTED-DIVERGENCE PROOF: an instrument declaring itself trustworthy immediately
 * after failing the test of its trustworthiness.
 *
 * Four instruments in this tree already carry an ad-hoc write-detecting regex —
 * `test-rollout-gates.js`, `test-site-data-fresh.js`, `test-publish-guard.js`,
 * `test-register-reality-readonly.js`. The machinery was present four times and enforced nowhere.
 *
 * THE PROPERTY, NOT A LIST OF KNOWN-BAD FILES
 * -------------------------------------------
 * Three separate bugs in this repository came from a ratchet whose DETECTOR was an enumeration; the
 * most recent was found today. So the detector here is structural and applies to a file nobody has
 * ever looked at:
 *
 *   A file is a CANDIDATE when it contains an UNGUARDED, MODULE-LEVEL write to a repo `data/` path
 *   AND signals failure at a LATER source line.
 *
 * "Module-level" means the statement starts at column 0. That is what makes the reading sound rather
 * than suggestive: a write at column 0 is not inside any `if`, so no condition stands between the
 * run's failure and the publish. If the write were guarded on the run's verdict it would be indented,
 * and the file would not be a candidate at all — which is exactly what happened to
 * `test-tag-consumed.js` and `test-game-diff.js` when they were fixed.
 *
 * A candidate is then classified, and the two classes are not equally bad:
 *
 *   SELF-BASELINING   the file also READS the artifact it writes. The artifact is its own baseline,
 *                     so a red run records what it just caught as the accepted state. This is the
 *                     class that destroys evidence, and it is the one to fix first.
 *   PUBLISHES-ON-RED  a downstream reader gets a fresh, plausible, unmarked artifact from a failed
 *                     run. Tolerated where the file DECLARES a policy in its own source and stamps a
 *                     run status into the artifact, so a consumer can refuse it.
 *
 * "Reads what it writes" is a SOUND detector for a SUPERSET of the laundering shape, and the
 * difference is worth stating rather than glossing. `engine/em_validation.js` reads its own artifact
 * in `--check` mode, but that read RE-DERIVES every verdict from the artifact's content and source
 * digests — it never asks "was this accepted last time", so it cannot launder. `tests/test-mechanics.js`
 * reads `unarmed` and `directCall` out of the census, FAILS when this run's number is larger, and then
 * writes this run's number — which is laundering, exactly. The gate cannot tell those apart
 * statically; a human read both and the answers are recorded per row below.
 *
 * WHAT THIS GATE CANNOT SEE — stated with specifics, because a check whose limits are vague reads as
 * coverage it does not have:
 *
 *   1. A write reached through a HELPER FUNCTION (`publish(x)`), or a write inside a callback. Only
 *      a literal `writeFileSync` / `createWriteStream` at column 0 is decided.
 *   2. A failure signalled by a CALLEE (`assertOrDie()` setting process.exitCode inside a function).
 *      Only `process.exit(<non-zero>)` and `process.exitCode = <non-zero>` written in this file count.
 *   3. A write GUARDED on something other than the run's verdict. An indented write is not decided at
 *      all — it is neither passed nor flagged. `--explain` prints how many were skipped that way, so
 *      the size of the blind spot is a number rather than a shrug.
 *   4. A target path assembled at RUN TIME from a variable this file cannot resolve statically. Only
 *      a literal `'data'` segment, a literal `data/...` path, or a module-level `const` bound to one
 *      is recognised.
 *   5. A non-zero exit inside a `catch` — deliberately ignored, because a crash handler is not a
 *      verdict. `engine/merge_mega_into_engine.js` is the real example.
 *
 * Limits 1 and 2 mean this is not a proof. It is a SOUND detector for the shape all six known
 * instances actually had, and the shape is the common one because it is the one people write.
 *
 * THE GATE PROVES ITS OWN DETECTOR, ON EVERY RUN
 * ----------------------------------------------
 * A guard that has never been shown firing is not a guard. Section 1 plants five fixtures in a temp
 * directory and runs the REAL detector over them: two that must be caught, three CONTROLS that must
 * NOT be (a guarded write, a write to a temp path, a crash handler). The controls matter as much as
 * the plants — the first version of this detector flagged `tests/test-arm-steering.js`, which writes
 * a perturbed census into `os.tmpdir()` and never touches `data/` at all. The scan roots are a
 * parameter with a default, the same idiom `engine/publish_guard.js` uses for its ratchet file, so
 * the demonstration exercises the shipped code rather than a copy of it.
 *
 * THE ACCEPTED SET IS A SOURCE CONSTANT, NOT AN ARTIFACT
 * -----------------------------------------------------
 * `ACCEPTED` below is a ratchet floor: it may lose members and may never gain one, and a candidate
 * outside it FAILS BY NAME. It is deliberately NOT stored in `data/`, for the obvious reason — an
 * artifact-backed floor for this particular gate would be a self-baselining ratchet, i.e. the defect
 * the file is about. Raising it costs a source edit that shows up in a diff.
 *
 * The floor is the accepted set. The DETECTOR is a property. A new offender is caught because it is
 * not in the floor, not because anybody remembered to add it to a list.
 *
 * THIS FILE WRITES NOTHING. Asserted in section 4, against its own source.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const EXPLAIN = process.argv.includes('--explain');

let P = 0, F = 0;
const ok = (c, m, why) => {
  console.log((c ? '  ok   ' : '  FAIL ') + m);
  if (!c && why) console.log('         ' + String(why).split('\n').join('\n         '));
  c ? P++ : F++;
};

/* ================= THE ACCEPTED SET (RATCHET FLOOR — may shrink, may never grow) =================
 *
 * Each row is a candidate that is neither fixed nor declared, with an OWNER, a SEVERITY TIER and a
 * reason. It is red, named and not a pass — the `DECLARED KNOWN-OPEN` idiom
 * `tests/test-forme-assert.js` and `tests/test-switch-back-renamed.js` already use.
 *
 * Most of these were NOT read line by line and are NOT claimed to be safe. They are claimed to be
 * KNOWN, on 2026-08-23, so that the eighth one is the thing that fails this gate. Where a row WAS
 * read end to end its reason says so; where it was not, it says that too. */
const ACCEPTED = {
  'tests/test-mechanics.js': { owner: 'ENGINE', tier: 'LAUNDERS', why:
    'THE WORST ROW HERE AND IT IS NOT MEASURE\'S TO FIX. It reads `unarmed` out of '
    + 'data/mechanics-census.json into `armBase`, sets process.exitCode=1 when THIS run\'s `unarmed` '
    + 'is LARGER, and then writes this run\'s `unarmed` into that same file. So the second run '
    + 'compares against the number the failing run just recorded, and passes. `directCall`/`dcBase` '
    + 'has the identical shape. (Named by SYMBOL, not by line: the line numbers moved under this row '
    + 'within the hour it was written.) This is the tests/test-unmodelled-clicks.js defect on '
    + 'the artifact that steers engine/all_mechanics_fire.js and holds a MEDICHAM gate clause. '
    + 'ENGINE owned and was actively editing this file on 2026-08-23; MEASURE may not touch it. '
    + 'The file already refuses to write under the `residualCollapsed` deliberate break and its own '
    + 'comment says "any future switch of the same kind belongs here" — the right instinct, scoped to '
    + 'deliberate breaks rather than to failure generally. OWED to ENGINE.' },
  'engine/em_validation.js': { owner: 'MEASURE', tier: 'self-read, does NOT launder', why:
    'READ END TO END on 2026-08-23. It reads data/partial-label-em.json in `--check` mode, but that '
    + 'mode RE-DERIVES every verdict from the artifact\'s own content (bias_exceeds_noise_floor, '
    + 'em_beats_naive, em_recovered_fraction>0.5) and re-hashes every source digest. There is no '
    + '"was this accepted before" comparison, so a red run cannot make the next run green. The real '
    + 'residual cost is narrower and is ROADMAP #257\'s shape: a FAILED measurement overwrites the '
    + 'last GOOD one, deleting the evidence rather than the verdict. Lowest priority row here.' },
  'engine/all_mechanics_fire.js': { owner: 'ENGINE', tier: 'publishes-on-red', why:
    'The whole-game mechanics sweep. Five separate non-zero exits follow its write. Not read line by '
    + 'line; not run — MEASURE was forbidden to run it on 2026-08-23. OWED.' },
  'engine/conformance.js': { owner: 'ENGINE', tier: 'publishes-on-red', why:
    'A registered GATE in tests/run-all.js with five non-zero exits after its write, one of them '
    + '`--strict`-gated. Deciding which are FINDINGS and which are failed runs needs the file read '
    + 'end to end. OWED.' },
  'engine/format_audit.js': { owner: 'ENGINE', tier: 'publishes-on-red', why:
    'Exits `rows.length ? 1 : 0` — probably a FINDINGS exit (rows were found), which would make the '
    + 'write correct and the declaration the only thing missing. NOT confirmed by reading. OWED.' },
  'engine/million_run.js': { owner: 'ENGINE', tier: 'publishes-on-red', why:
    'The million-target driver. Two exits, ~1,400 lines after the write. OWED.' },
  'engine/tag_dex.js': { owner: 'ENGINE', tier: 'publishes-on-red', why:
    'The tag derivation. ENGINE held this file (dirty in the working tree) when the gate was written. '
    + 'OWED to ENGINE.' },
};

/* ================= THE DETECTOR ================================================================= */

const BS = String.fromCharCode(92);

/* Blank out comments and string bodies while preserving offsets, so a `writeFileSync` inside a
 * comment block is not a write site and `'data'` inside prose is not a path. String DELIMITERS are
 * kept so a path literal is still recognisable by its quotes. */
function stripComments(src) {
  const out = src.split('');
  let i = 0; const n = src.length; let mode = 0; /* 0 code 1 line 2 block 3 ' 4 " 5 ` */
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 0) {
      if (c === '/' && d === '/') { mode = 1; out[i] = out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 2; out[i] = out[i + 1] = ' '; i += 2; continue; }
      if (c === "'") mode = 3; else if (c === '"') mode = 4; else if (c === '`') mode = 5;
      i++; continue;
    }
    if (mode === 1) { if (c === '\n') mode = 0; else out[i] = ' '; i++; continue; }
    if (mode === 2) { if (c === '*' && d === '/') { out[i] = out[i + 1] = ' '; mode = 0; i += 2; continue; } if (c !== '\n') out[i] = ' '; i++; continue; }
    if (mode === 3) { if (c === BS) { i += 2; continue; } if (c === "'") mode = 0; i++; continue; }
    if (mode === 4) { if (c === BS) { i += 2; continue; } if (c === '"') mode = 0; i++; continue; }
    if (mode === 5) { if (c === BS) { i += 2; continue; } if (c === '`') mode = 0; i++; continue; }
  }
  return out.join('');
}

/* The FIRST argument of a call, by balanced-paren scan. `[^,]+` is not good enough: the repo's own
 * idiom is `writeFileSync(D('data', 'x.json'), ...)` and `path.join(ROOT, 'data', 'x.json')`, where
 * the first argument contains commas of its own. */
function firstArg(src, openParen) {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return src.slice(openParen + 1, i); }
    else if (c === ',' && depth === 1) return src.slice(openParen + 1, i);
  }
  return src.slice(openParen + 1, openParen + 200);
}

const DATA_MARKER = /(['"])data\1|['"][\w./-]*data\/[\w.-]+\.(json|jsonl|js|md)['"]/;
const ARTIFACT_NAME = /['"]([\w.-]+\.(?:json|jsonl|js|md))['"]/;

function analyse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const code = stripComments(raw);
  const rawLines = raw.split(/\r?\n/);

  /* Identifiers bound at module level to a repo data PATH. A binding whose right-hand side READS a
   * file is bound to its CONTENT, not to a path — that distinction is why the first version of this
   * detector flagged tests/test-arm-steering.js, whose `live` holds the census bytes and whose write
   * target is a temp file. */
  const ids = new Map();
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n;]*)/g)) {
    const rhs = m[2];
    if (/readFileSync|require\s*\(|JSON\.parse/.test(rhs)) continue;
    if (!DATA_MARKER.test(rhs)) continue;
    const nm = rhs.match(ARTIFACT_NAME);
    ids.set(m[1], nm ? nm[1] : null);
  }

  /* Line number for a character offset. */
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);
  const lineOf = off => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; } return lo + 1; };

  const writes = [];
  for (const m of code.matchAll(/\b(writeFileSync|createWriteStream)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const arg = firstArg(code, open);
    let artifact = null, isData = false;
    if (DATA_MARKER.test(arg)) { isData = true; const nm = arg.match(ARTIFACT_NAME); artifact = nm ? nm[1] : null; }
    else for (const [id, nm] of ids) if (new RegExp('\\b' + id + '\\b').test(arg)) { isData = true; artifact = nm; break; }
    if (!isData) continue;
    const no = lineOf(m.index);
    const src = rawLines[no - 1] || '';
    /* MODULE LEVEL = the statement starts at column 0. `fs.writeFileSync(` where `fs` is at column 0
     * — so measure from the start of the statement, which for a multi-line call is this line. */
    const guarded = /^\s/.test(src);
    writes.push({ no, artifact, guarded, txt: src.trim().slice(0, 100) });
  }

  const fails = [];
  /* SPLIT ONCE. The first version re-split the whole comment-stripped source inside this loop, which
   * is O(n^2) in lines and hung outright on the 1.6 MB tests/test-mechanics.js. */
  const codeLines = code.split(/\r?\n/);
  rawLines.forEach((src, i) => {
    const codeLine = codeLines[i] || '';
    /* A CRASH HANDLER IS NOT A VERDICT. `engine/merge_mega_into_engine.js` ends
     * `.catch(e => { console.error(e); process.exit(1); })`, and a top-level
     * `process.on('uncaughtException', ...)` is the same thing wearing a different name — that second
     * form was missed by the first draft and its own control fixture caught it. */
    if (/\bcatch\s*[({]|\.catch\s*\(|uncaughtException|unhandledRejection/.test(codeLine)) return;
    let m;
    if ((m = codeLine.match(/process\.exit\(\s*([^)]*)\)/))) {
      const a = m[1].trim();
      if (a && a !== '0' && a !== '2') fails.push({ no: i + 1, txt: src.trim().slice(0, 100) });
      return;
    }
    if ((m = codeLine.match(/process\.exitCode\s*=\s*([^;]+)/))) {
      const a = m[1].trim();
      if (a !== '0') fails.push({ no: i + 1, txt: src.trim().slice(0, 100) });
    }
  });

  /* Does it READ back what it writes? That is the self-baselining shape. */
  const reads = new Set();
  for (const m of code.matchAll(/\b(readFileSync|existsSync|require)\s*\(([^\n]{0,160})/g)) {
    const nm = m[2].match(ARTIFACT_NAME);
    if (nm) reads.add(nm[1]);
    for (const [id, art] of ids) if (art && new RegExp('\\b' + id + '\\b').test(m[2])) reads.add(art);
  }

  const declared = /WRITE-POLICY:\s*(green-only|findings|crash-only)/.exec(raw);
  const stampsStatus = /\b(write_policy|run_ok)\s*:/.test(code);

  const unguarded = writes.filter(w => !w.guarded);
  const first = unguarded.length ? Math.min(...unguarded.map(w => w.no)) : Infinity;
  const after = fails.filter(f => f.no > first);

  return {
    writes, fails, reads, unguarded, after,
    guardedCount: writes.length - unguarded.length,
    isCandidate: unguarded.length > 0 && after.length > 0,
    selfBaselining: unguarded.some(w => w.artifact && reads.has(w.artifact)),
    declared: declared ? declared[1] : null,
    stampsStatus,
  };
}

function scan(roots) {
  const out = [];
  for (const dir of roots) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (e) { if (e.code !== 'ENOENT') throw e; continue; }
    for (const f of entries.sort()) {
      if (!f.endsWith('.js')) continue;
      const full = path.join(dir, f);
      let st; try { st = fs.statSync(full); } catch (e) { continue; }
      if (!st.isFile()) continue;
      let a; try { a = analyse(full); } catch (e) { out.push({ rel: full, err: e.message }); continue; }
      out.push({ rel: path.relative(ROOT, full).replace(/\\/g, '/'), abs: full, ...a });
    }
  }
  return out;
}

module.exports = { analyse, scan, stripComments, firstArg };
if (require.main !== module) return;

console.log('RED-RUN WRITES — a check may not publish on a path where it already failed\n');

/* ================= 1. THE DETECTOR, SHOWN FIRING AND SHOWN NOT FIRING =========================== */
console.log('== 1. the detector proves itself on planted fixtures (2 plants, 3 controls) ==');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-redrun-'));
const FIXTURES = {
  'plant-publishes-on-red.js':
    "'use strict';\nconst fs=require('fs'),path=require('path');\nlet bad=1;\n"
    + "fs.writeFileSync(path.join(__dirname,'..','data','made-up.json'),'{}');\n"
    + "if (bad) process.exit(1);\n",
  'plant-self-baselining.js':
    "'use strict';\nconst fs=require('fs'),path=require('path');\n"
    + "const STAMP = path.join(__dirname,'..','data','made-up-baseline.json');\n"
    + "const prev = fs.existsSync(STAMP) ? JSON.parse(fs.readFileSync(STAMP,'utf8')) : null;\n"
    + "let F = prev ? 1 : 0;\nfs.writeFileSync(STAMP, '{}');\nprocess.exit(F ? 1 : 0);\n",
  'control-guarded.js':
    "'use strict';\nconst fs=require('fs'),path=require('path');\nlet F=1;\n"
    + "if (F) { console.log('DID NOT WRITE'); process.exit(1); }\n"
    + "fs.writeFileSync(path.join(__dirname,'..','data','made-up.json'),'{}');\n",
  'control-temp-target.js':
    "'use strict';\nconst fs=require('fs'),os=require('os'),path=require('path');\nlet F=0;\n"
    + "const live = fs.readFileSync(path.join(__dirname,'..','data','made-up.json'),'utf8');\n"
    + "const scratch = path.join(os.tmpdir(),'copy.json');\nfs.writeFileSync(scratch, live);\n"
    + "process.exit(F ? 1 : 0);\n",
  'control-crash-handler.js':
    "'use strict';\nconst fs=require('fs'),path=require('path');\n"
    + "fs.writeFileSync(path.join(__dirname,'..','data','made-up.json'),'{}');\n"
    + "process.on('uncaughtException', e => { console.error(e); process.exit(1); });\n"
    + "main().catch(e => { console.error(e); process.exit(1); });\n",
};
for (const [f, body] of Object.entries(FIXTURES)) fs.writeFileSync(path.join(tmp, f), body);
console.log('  fixtures: ' + tmp + '   (left on disk on purpose — they are the evidence)');
const fix = new Map(scan([tmp]).map(r => [path.basename(r.rel), r]));

const g = n => fix.get(n) || {};
ok(g('plant-publishes-on-red.js').isCandidate === true,
  'PLANT  a module-level data write with process.exit(1) after it is CAUGHT',
  'the detector did not flag the plainest form of the defect — every result below is worthless');
ok(g('plant-self-baselining.js').isCandidate === true && g('plant-self-baselining.js').selfBaselining === true,
  'PLANT  a write to the artifact the file also READS is caught AND classed SELF-BASELINING',
  'isCandidate=' + g('plant-self-baselining.js').isCandidate + ' selfBaselining=' + g('plant-self-baselining.js').selfBaselining);
ok(g('control-guarded.js').isCandidate === false,
  'CONTROL a write placed AFTER the failure exit is not flagged (this is the fix shape)',
  'the detector flags correct code, so a green reading below would mean nothing');
ok(g('control-temp-target.js').isCandidate === false,
  'CONTROL a write to an os.tmpdir() path is not flagged, even reading data/ for its content',
  'this exact false positive fired on tests/test-arm-steering.js in the first draft');
ok(g('control-crash-handler.js').isCandidate === false,
  'CONTROL a non-zero exit inside a catch handler is not a verdict and is not flagged',
  'engine/merge_mega_into_engine.js is the real instance');

/* ================= 2. THE REPOSITORY ============================================================ */
console.log('\n== 2. every .js in tests/ engine/ build/ tools/ ==');
/* THE SCAN ROOTS ARE A PARAMETER WITH A DEFAULT — the idiom engine/publish_guard.js uses for its
 * ratchet file, and for the same reason. `--scan <dir>` points THIS gate, not a copy of it, at a
 * directory of planted offenders, so section 2's clauses can be shown RED without editing a real
 * instrument or leaving a file in tests/. A demonstration against a re-implementation would prove
 * nothing about the code that ships. */
const scanArgs = process.argv.reduce((a, v, i, arr) => (v === '--scan' && arr[i + 1] ? [...a, path.resolve(arr[i + 1])] : a), []);
const rows = scan(scanArgs.length ? scanArgs : [D('tests'), D('engine'), D('build'), D('tools')]);
if (scanArgs.length) console.log('  SCAN ROOTS OVERRIDDEN: ' + scanArgs.join(', ') + '  (a demonstration, not a repository reading)');
const broke = rows.filter(r => r.err);
for (const r of broke) console.log('  (could not analyse ' + r.rel + ': ' + r.err + ')');
ok(broke.length === 0, 'every file parsed — a file this gate cannot read is not a file it cleared',
  broke.map(r => r.rel).join(', '));

const cands = rows.filter(r => r.isCandidate);
const undecided = rows.reduce((n, r) => n + (r.guardedCount || 0), 0);
console.log('  scanned ' + rows.length + ' files; ' + cands.length + ' candidates; '
  + undecided + ' indented write site(s) NOT DECIDED either way (limit 3 in the header)');

/* ---- 2a. what each candidate is, printed before it is judged ---- */
for (const r of cands) console.log('    ' + (r.selfBaselining ? 'READS-WHAT-IT-WRITES' : 'publishes-on-red    ')
  + '  ' + r.rel.padEnd(34) + ' ' + (r.unguarded.map(w => w.artifact).find(Boolean) || '')
  + (r.declared ? '   [declared ' + r.declared + ']' : ''));

/* ---- 2b. declared, or in the floor ---- */
const declared = cands.filter(r => r.declared);
const undeclared = cands.filter(r => !r.declared);
for (const r of declared) {
  if (r.declared !== 'findings') continue;
  ok(r.stampsStatus, r.rel + ' declares WRITE-POLICY: findings AND stamps a run status into the artifact',
    'it publishes from a run that can fail and writes neither `write_policy` nor `run_ok`, so a '
    + 'consumer — engine/provenance.js sweeps data/*.json on freshness, web/quarantine-data.js lists '
    + 'files by name — cannot tell a red artifact from a green one.');
}

const outside = undeclared.filter(r => !(r.rel in ACCEPTED));
const insideFloor = undeclared.filter(r => r.rel in ACCEPTED);
if (insideFloor.length) console.log('\n  ACCEPTED — red, named, NOT a pass. Owner and tier, worst first:');
for (const r of insideFloor.sort((a, b) => (ACCEPTED[a.rel].tier === 'LAUNDERS' ? 0 : 1) - (ACCEPTED[b.rel].tier === 'LAUNDERS' ? 0 : 1)))
  console.log('    ' + ACCEPTED[r.rel].tier.padEnd(28) + ACCEPTED[r.rel].owner.padEnd(8) + r.rel);
ok(outside.length === 0,
  'no NEW check publishes on red — the accepted set is ' + Object.keys(ACCEPTED).length + ' file(s)',
  outside.map(r => r.rel + (r.selfBaselining ? '  [READS WHAT IT WRITES — fix this one first]' : '')
    + '  writes at line ' + r.unguarded.map(w => w.no).join(',')
    + ', fails at line ' + r.after.map(f => f.no).join(',') + '\n    ' + (r.after[0] || {}).txt
    + '\n    Either move the write behind the verdict, or declare `WRITE-POLICY: findings — <why>` '
    + 'in the source AND stamp `run_ok` into the artifact.').join('\n  '));

/* ---- 2c. the floor may only shrink ---- */
/* Only against the DEFAULT roots. Under `--scan` every accepted row is trivially "missing" because it
 * was not scanned, and printing seven false FIXEDs is how a demonstration teaches somebody a wrong
 * fact about the tree. */
const gone = scanArgs.length ? [] : Object.keys(ACCEPTED).filter(f => !cands.some(r => r.rel === f));
if (gone.length) console.log('\n  FIXED since the floor was written (' + gone.length + '): ' + gone.join(', ')
  + '\n    Remove them from ACCEPTED in this file — the floor may lose members and may never gain one.');
ok(true, 'the accepted set is a source constant, not an artifact — an artifact-backed floor for THIS '
  + 'gate would itself be the defect');

/* ================= 3. THE FOUR AD-HOC DETECTORS STILL EXIST ===================================== */
/* Not a duplicate check — a claim in this file's header, verified rather than typed. If these lose
 * their write detection the reasoning above about "the machinery was present four times" goes stale,
 * and stale prose is what LESSONS.md is about. */
console.log('\n== 3. the four pre-existing ad-hoc write detectors ==');
for (const f of ['tests/test-rollout-gates.js', 'tests/test-site-data-fresh.js',
                 'tests/test-publish-guard.js', 'tests/test-register-reality-readonly.js']) {
  const p = D(f);
  ok(fs.existsSync(p) && /writeFileSync|createWriteStream/.test(fs.readFileSync(p, 'utf8')),
    f + ' still detects writes by inspecting source',
    'this gate\'s header claims four instruments already did this by hand; that claim is now false');
}

/* ================= 4. AND THIS FILE PUBLISHES NOTHING =========================================== */
console.log('\n== 4. the gate itself ==');
const self = analyse(__filename);
ok(self.writes.filter(w => !w.guarded).length === 0,
  'this gate writes no data/ artifact at module level — it cannot launder its own verdict',
  self.writes.map(w => 'line ' + w.no + ': ' + w.txt).join('\n'));

/* ================= --explain =================================================================== */
if (EXPLAIN) {
  console.log('\n== --explain: every candidate, in full ==');
  for (const r of cands) {
    console.log('\n  ' + r.rel + (r.selfBaselining ? '   [SELF-BASELINING]' : '')
      + (r.declared ? '   [declared ' + r.declared + ']' : ''));
    for (const w of r.unguarded) console.log('    write  ' + String(w.no).padStart(6) + '  '
      + (w.artifact || '?') + '  ' + w.txt);
    for (const f of r.after) console.log('    fails  ' + String(f.no).padStart(6) + '  ' + f.txt);
  }
  const skipped = rows.filter(r => r.guardedCount > 0);
  console.log('\n  indented (NOT DECIDED) write sites, by file:');
  for (const r of skipped) console.log('    ' + String(r.guardedCount).padStart(3) + '  ' + r.rel);
}

console.log('\nRED-RUN WRITES: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
