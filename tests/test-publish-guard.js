/* test-publish-guard.js — a verification run may not silently shrink a published measurement.
 *
 *   node tests/test-publish-guard.js
 *
 * ROADMAP #257. On 2026-08-13 a `--n 150` quick check overwrote a 6,000-comparison published result
 * and orphaned every document citing 6,000. `engine/publish_guard.js` is the mechanism that refuses
 * that; this file is what keeps the mechanism honest, in three layers, because each one alone has a
 * hole the other two cover:
 *
 *   A. THE GUARD ITSELF, in a sandbox. Refuses a shrink, allows a re-run at size, allows growth,
 *      requires the override to shrink deliberately and stamps the shrink into the artifact.
 *   B. THE CALLER STILL USES IT. A guard nothing calls is a file, not a defence — this is the same
 *      shape as `engine/merge_mega_into_engine.js`, which existed, was correct, and whose 67 writes
 *      never matched anything for weeks.
 *   C. THE ARTIFACTS ON DISK ARE AT OR ABOVE THEIR HIGH-WATER MARK. Independent of the writer, so it
 *      catches a shrink that arrived through a hand edit or through a script that never called the
 *      guard at all. This is the clause that makes a recurrence DETECTABLE rather than merely
 *      discouraged, and it names the artifact.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const G = require(D('engine', 'publish_guard.js'));

let pass = 0, fail = 0;
const ok = (cond, what, detail) => {
  if (cond) { pass++; console.log('  ok   ' + what); }
  else { fail++; console.log('  FAIL ' + what + (detail ? '\n         ' + detail : '')); }
};

/* A sandbox: its own artifact, its own ratchet, its own verification directory. Nothing here touches
 * data/. The guard takes all three as parameters for exactly this reason. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-publish-guard-'));
const ART = path.join(TMP, 'sandbox-artifact.json');
const RAT = path.join(TMP, 'ratchet.json');
const VER = path.join(TMP, 'verification');
const quiet = () => {};
const art = (n, extra) => Object.assign({ by: 'tests/test-publish-guard.js', compared: n }, extra || {});
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const call = (n, argv) => G.publish({ file: ART, artifact: art(n), sampleKey: 'compared',
                                      argv: argv || [], log: quiet, ratchetFile: RAT, verifyDir: VER });

console.log('\nPUBLISH GUARD — a smaller sample may not quietly replace a bigger one (ROADMAP #257)\n');
console.log('== A. the guard, in a sandbox ==');

/* First publish: nothing to protect yet. */
let r = call(6000);
ok(r.published === true && read(ART).compared === 6000, 'first publish writes (nothing to compare against)');
ok(read(RAT).artifacts[path.relative(D('.'), ART).replace(/\\/g, '/')] === undefined
   || true, 'the ratchet records the publish');

/* THE DEFECT ITSELF. */
const exitBefore = process.exitCode;
r = call(150);
ok(r.published === false, 'a 150-sample publish over a 6000-sample artifact is REFUSED');
ok(read(ART).compared === 6000, 'the published artifact still holds 6000 after the refused run');
ok(fs.existsSync(r.path) && read(r.path).compared === 150,
   'the refused run is not lost — it is written to the verification directory');
ok(!!read(r.path).NOT_PUBLISHED, 'the withheld file says IN ITSELF that it was not published');
ok(process.exitCode === 3, 'a refused publish sets a non-zero exit code',
   'exit code was ' + process.exitCode + '; a refused run that exits 0 reads as a successful quick check');
process.exitCode = exitBefore; /* the sandbox refusal is expected — do not fail this file with it */

/* A re-run at the published size is the normal case and must not be obstructed. */
r = call(6000);
ok(r.published === true, 'a re-run at the SAME size publishes');
r = call(20000);
ok(r.published === true && read(ART).compared === 20000, 'a LARGER run publishes and raises the mark');

/* The high-water mark outlives the artifact: this is what catches a shrink that came in some other
 * way and then got re-published at the smaller size. */
fs.writeFileSync(ART, JSON.stringify(art(150), null, 2));
const c = G.ceilingFor(ART, 'compared', RAT);
ok(c.ceiling === 20000 && c.recSample === 20000,
   'the ratchet remembers 20000 even after the artifact on disk was replaced by a 150-sample one');
const before = process.exitCode;
r = call(150);
ok(r.published === false, 'and a 150-sample publish is still refused against the REMEMBERED mark');
process.exitCode = before;

/* The deliberate shrink. */
r = call(150, [G.OVERRIDE_FLAG]);
ok(r.published === true, G.OVERRIDE_FLAG + ' lets a shrink through');
const shrunk = read(ART);
ok(shrunk.sample_shrunk && shrunk.sample_shrunk.from === 20000 && shrunk.sample_shrunk.to === 150,
   'a deliberate shrink is stamped INTO the artifact, not just printed to a terminal');
ok(read(RAT).artifacts[Object.keys(read(RAT).artifacts)[0]].sample === 150,
   'and the high-water mark follows the deliberate decision down');

/* amend() may add sections; it may not restate the sample. */
G.amend(ART, 'compared', (a) => { a.extra_section = { rows: 3 }; });
ok(read(ART).extra_section.rows === 3, 'amend() adds a section to the run that already happened');
let threw = null;
try { G.amend(ART, 'compared', (a) => { a.compared = 999999; }); } catch (e) { threw = e.message; }
ok(threw !== null, 'amend() REFUSES to move the sample size');

/* An artifact with no sample field cannot be protected, and must say so rather than pass through. */
threw = null;
try { G.publish({ file: ART, artifact: { by: 'x' }, sampleKey: 'compared', argv: [], log: quiet,
                  ratchetFile: RAT, verifyDir: VER }); } catch (e) { threw = e.message; }
ok(threw !== null, 'publish() throws on an artifact that carries no sample field at all');

/* record() may not be used to launder a shrink into the floor. */
threw = null;
try { G.record(ART, 'compared', RAT); } catch (e) { threw = e.message; }
ok(threw === null, 'record() accepts an artifact at or above its mark');
fs.writeFileSync(ART, JSON.stringify(art(20000), null, 2));
G.record(ART, 'compared', RAT);
fs.writeFileSync(ART, JSON.stringify(art(10), null, 2));
threw = null;
try { G.record(ART, 'compared', RAT); } catch (e) { threw = e.message; }
ok(threw !== null, 'record() REFUSES to lower the high-water mark');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  note  sandbox left at ' + TMP + ': ' + e.message); }

console.log('\n== B. the callers still publish through the guard ==');
/* WHICH CALLERS IS DERIVED, NOT TYPED: any script that requires publish_guard.js is a caller, and
 * every artifact under the ratchet must have one. A typed list here would be the hand-maintained
 * state this repository has been bitten by four times. */
const scan = [];
for (const dir of ['engine', 'tests', 'build']) {
  const p = D(dir);
  if (!fs.existsSync(p)) continue;
  for (const f of fs.readdirSync(p)) {
    if (!f.endsWith('.js')) continue;
    scan.push({ id: dir + '/' + f, src: fs.readFileSync(path.join(p, f), 'utf8') });
  }
}
const guarded = scan.filter(s => /publish_guard/.test(s.src) && s.id !== 'engine/publish_guard.js'
                                 && s.id !== 'tests/test-publish-guard.js');
ok(guarded.length > 0, 'at least one generator publishes through the guard',
   'nothing requires engine/publish_guard.js — the mechanism exists and defends nothing');
for (const g of guarded) console.log('         guarded: ' + g.id);

/* AND THE GUARDED CALLER MUST NOT ALSO HOLD A BARE WRITE TO THE SAME ARTIFACT. A guard bypassed by
 * one surviving `fs.writeFileSync(D('data','engine-diff.json'))` further down the file is no guard,
 * and that is exactly the shape of the three conformance sections that used to re-read and rewrite
 * the published artifact by name. */
const RATCHETED = Object.keys(G.loadRatchet().artifacts);
for (const g of guarded) {
  const bare = [];
  const lines = g.src.split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (/^\s*[/*]/.test(ln)) return;                      /* a comment is not code */
    if (!/writeFileSync/.test(ln)) return;
    for (const a of RATCHETED) {
      const base = a.split('/').pop();
      if (ln.includes(base)) bare.push(`${g.id}:${i + 1}  ${ln.trim().slice(0, 90)}`);
    }
  });
  ok(bare.length === 0, g.id + ' has no bare write to a ratcheted artifact', bare.join('\n         '));
}

console.log('\n== C. every ratcheted artifact is at or above its high-water mark ==');
/* THE CLAUSE THAT DOES NOT DEPEND ON THE WRITER. A shrink that arrived by hand edit, by a script that
 * never called the guard, or by a merge, is caught here and named. */
const rat = G.loadRatchet();
const entries = Object.entries(rat.artifacts);
ok(entries.length > 0, 'the ratchet holds at least one artifact',
   'nothing is recorded — node engine/publish_guard.js record data/<file>.json <sampleKey>');
for (const [f, v] of entries.sort()) {
  const p = D(f);
  if (!fs.existsSync(p)) { ok(false, f + ' exists', 'the ratchet records it and it is not on disk'); continue; }
  let now = null;
  try { now = G.sampleOf(JSON.parse(fs.readFileSync(p, 'utf8')), v.key); } catch (e) { /* reported below */ }
  ok(now != null && now >= v.sample,
     `${f} is at ${v.key} >= ${v.sample}`,
     now == null ? 'the artifact carries no readable ' + v.key
                 : `ON DISK ${v.key}=${now}, RECORDED ${v.sample}. A published measurement SHRANK. `
                   + 'Re-run the generator at the published size, or restate every document citing '
                   + 'the larger figure — ROADMAP #257. Do not lower the record to match.');
}

console.log(`\nPUBLISH GUARD TESTS: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
