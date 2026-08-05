/* test-engine-release.js — a measurement reading a release does not see the live tree change.
 *
 * WHY. On 2026-08-04 three division agents ran concurrently, which is the point of having divisions.
 * Their files were separated. The 7,100-game WOBBUFFET run was destroyed anyway, because
 * `data/policy-weights.json` — the very thing being measured — was refitted between the two legs of
 * the measurement, and `engine/medicham2-browser.js` moved four times inside eight minutes.
 *
 * The first response was a paragraph in CLAUDE.md saying a measuring agent must run alone. That is
 * the WRONG FIX twice over: it is prose, which this project has learned is a preference rather than a
 * rule, and it serialises four divisions that were cut apart precisely so they could run at once.
 * (Will: *"we can run multiple agents at once that's the whole point"*.)
 *
 * `engine/engine_release.js` is the right fix: a measurement reads an immutable SNAPSHOT, so the live
 * tree may move freely underneath it.
 *
 * WHAT THIS FILE ASSERTS is the only claim that matters, and it asserts it by DOING IT: cut a
 * release, then genuinely modify the live file, and confirm the release still serves the old bytes.
 * A test that merely compared two digests would pass against an implementation that symlinked the
 * snapshot to the live tree — which is the plausible wrong implementation, and it would reproduce the
 * exact bug this exists to stop.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const REL = require('../engine/engine_release.js');

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);

console.log('ENGINE RELEASE — a measurement reads a snapshot, not the tree\n');

/* ---- 1. A RELEASE EXISTS AND IS INTACT -------------------------------------------------------- */
const ids = REL.list();
ok(ids.length > 0, `at least one release has been cut (${ids.length})`);
if (!ids.length) { console.log('\nENGINE RELEASE TESTS: cannot run'); process.exit(1); }

const r = REL.open();
ok(!!r && !!r.id, `the pointer opens a release (${r.id})`);
ok(REL.verify(r.id).ok, 'the snapshot matches its own manifest — it has not rotted on disk');

/* Every source the engine's behaviour depends on must be IN the release. A snapshot missing the
 * weights would freeze the simulator and let the thing being measured move, which is the exact
 * failure of 2026-08-04. */
for (const need of ['engine/medicham2-browser.js', 'engine/board.js', 'data/policy-weights.json',
                    'data/engine-data.js', 'data/tags.json']) {
  ok(!!r.manifest.files[need], `the release contains ${need}`);
}
ok(!!r.manifest.showdown_commit, 'the release records which Showdown commit it was cut against');

/* ---- 2. THE STAMP IS WHAT PROVENANCE VERIFIES -------------------------------------------------- */
const st = r.stamp();
ok(!!st.source_digests && Object.keys(st.source_digests).length === Object.keys(r.manifest.files).length,
   'stamp() emits source_digests for every frozen file');
ok(st.engine_release === r.id, 'stamp() names the release id, so an artifact says what it was measured on');
/* `engine/provenance.js` reads exactly this key and compares by CONTENT. An artifact carrying this
 * stamp is the first thing in the repo that can be verified rather than assumed. */
ok(Object.values(st.source_digests).every(d => typeof d === 'string' && d.length === 12),
   'every digest is a real 12-char content hash, not a placeholder');

/* ---- 3. THE ONE THAT MATTERS: MOVE THE LIVE TREE, THE RELEASE DOES NOT MOVE -------------------- */
/* `data/move-priors.json` is the victim, chosen because it is a leaf that nothing in this test
 * evaluates. Backed up to a separate path BEFORE the edit and restored in a finally, so an
 * interrupted run cannot leave it modified. */
const VICTIM = 'data/move-priors.json';
const live = D(VICTIM);
const original = fs.readFileSync(live);
const backup = path.join(require('os').tmpdir(), 'abra-move-priors-' + process.pid + '.bak');
fs.writeFileSync(backup, original);

let moved = false;
try {
  const beforeSnapshot = sha(fs.readFileSync(r.path(VICTIM)));
  ok(beforeSnapshot === r.manifest.files[VICTIM], `snapshot of ${VICTIM} matches the manifest going in`);

  /* A REAL EDIT, not a touch. The whole point is CONTENT. */
  const parsed = JSON.parse(original.toString('utf8'));
  parsed.__test_marker_engine_release = 'the live tree moved while a measurement was open';
  fs.writeFileSync(live, JSON.stringify(parsed, null, 2) + '\n');
  moved = true;

  const liveNow = sha(fs.readFileSync(live));
  ok(liveNow !== r.manifest.files[VICTIM], 'the LIVE file genuinely changed (the test actually did the thing)');

  /* THE ASSERTION. */
  const snapNow = sha(fs.readFileSync(r.path(VICTIM)));
  ok(snapNow === r.manifest.files[VICTIM],
     'the RELEASE still serves the original bytes — a division may rewrite the live tree mid-measurement');
  ok(!r.read(VICTIM).includes('__test_marker_engine_release'),
     'REL.read() does not see the edit either — the snapshot is a copy, not a symlink or a passthrough');
  ok(REL.verify(r.id).ok, 'and the release still verifies against its manifest');

  /* DRIFT IS REPORTED, NOT HIDDEN. A release that no longer describes the shipped engine is the
   * normal state and is exactly what a reader needs to know before quoting an old number. */
  const drifted = REL.drift(r.id);
  ok(drifted.includes(VICTIM), `drift() reports ${VICTIM} as moved (${drifted.length} file(s) drifted)`);
} finally {
  fs.writeFileSync(live, original);
  /* A backup that will not delete is left in place, never fought over — but said out loud, because
   * an orphaned backup file in the tree is exactly the kind of debris the no-delete rule protects. */
  try { fs.unlinkSync(backup); }
  catch (e) { console.error('  (backup left behind at ' + backup + ': ' + e.message + ')'); }
}

ok(sha(fs.readFileSync(live)) === r.manifest.files[VICTIM], 'the live file was restored exactly');
ok(moved, 'the mutation arm actually ran — a skipped edit would have passed every check above');

console.log(`\nENGINE RELEASE TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
