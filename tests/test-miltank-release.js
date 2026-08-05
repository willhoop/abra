/* test-miltank-release.js — MILTANK's release stamp must be capable of being FALSE.
 *
 * THE BUG THIS PINS, WITH THE RECEIPT
 * -----------------------------------
 * `engine/miltank.js:145` read `rel.digests` and `rel.release` out of the release pointer
 * `data/engine-release.json`. `engine/engine_release.js` HAS NEVER WRITTEN EITHER FIELD — a cut
 * writes `current`, `cut`, `why`, `cuts`, `latest_cut`, `latest_why`, and the digests live in the
 * release's own manifest one directory down, which the resolver never opened.
 *
 * So the resolver iterated an empty digest set, compared ZERO files, found ZERO moved, and stamped
 * `release: 'UNNAMED', release_status: 'ON_RELEASE'` on every MILTANK artifact ever written. It was
 * green because it was empty. Reproduced 2026-08-05 against the live pointer: feeding the old code a
 * digest set in which EVERY FILE IS WRONG still returned `ON_RELEASE`.
 *
 * That matters because the queued WOBBUFFET / AXIS-4 exploitability run's whole value is a
 * defensible claim about WHICH BYTES were measured, and it would have carried a stamp that could not
 * be false.
 *
 * WHAT THIS TEST REFUSES TO ACCEPT
 * --------------------------------
 * A green that is not evidence. Arm 1 replays the OLD resolver against the pointer schema that is
 * actually on disk and asserts it says ON_RELEASE off zero files — if that assertion ever fails, the
 * bad input stopped being bad and the rest of this file is measuring nothing. Only then do arms 2-6
 * check the new one.
 *
 * WHY IT NEVER TOUCHES THE REAL RELEASE STORE
 * -------------------------------------------
 * `cut()` REPOINTS `data/engine-release.json`. Doing that from a test, while another division is
 * measuring through it, is the precise hazard `engine_release.js` was built to prevent — the failure
 * arriving through the test. So every release here is cut into a throwaway store under the OS temp
 * directory, and `engine_release.js` prints a line on stderr each time an override is in play.
 *
 * AND WHY THE DRIFT ARM MUTATES A FILE THIS TEST CREATED, not a live engine source. Drift is only
 * real if a file the manifest names actually changes in the live tree. `tests/test-engine-release.js`
 * does that to `data/move-priors.json` and restores it; this test cannot, because four divisions are
 * writing to this repo and a frozen source being different for even a moment is exactly what voids
 * somebody else's run. `drift()` hashes whatever relative paths the manifest names, so the manifest
 * is augmented with one probe file this test wrote itself — a genuine live-tree mutation of a genuine
 * manifest entry, harmless to everyone. It is named `data/.miltank-release-probe-<pid>.jsonl`, which
 * `.gitignore`'s `data/.*.jsonl` rule keeps out of the auto-commit, and it is removed in a `finally`.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const REL_API = require('../engine/engine_release.js');
const MIL = require('../engine/miltank.js');

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };
const sha12 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
/* A cleanup that cannot clean up is worth a line: a throwaway store left behind on Windows usually
 * means a handle is still open, and the next run of this test would cut into a dirty directory. */
const rmrf = d => {
  try { fs.rmSync(d, { recursive: true, force: true }); }
  catch (e) { console.error('  (could not remove ' + d + ': ' + ((e && e.message) || e) + ' — remove it by hand)'); }
};

console.log('MILTANK RELEASE STAMP — a green must mean files were compared\n');

const TMP = path.join(os.tmpdir(), 'abra-miltank-release-' + process.pid);
const PROBE_REL = 'data/.miltank-release-probe-' + process.pid + '.jsonl';
const PROBE_ABS = D(PROBE_REL);

/* THE OLD RESOLVER, COPIED VERBATIM FROM engine/miltank.js AS IT STOOD BEFORE THIS FIX.
 * It lives here and not in the engine so the engine has exactly one implementation. Its only job is
 * to prove that arm 1's input is genuinely bad; a check believed on its green without ever being
 * shown failing on known-bad input is the thing this repo does not accept. */
function OLD_resolveRelease(pointerPath, engineDigests) {
  let rel = null;
  try { rel = JSON.parse(fs.readFileSync(pointerPath, 'utf8')); }
  catch (e) {
    /* The reason is kept even in the museum copy. If this branch ever fires during a run of this
     * test it means the throwaway pointer was not written, and arm 1 would then be "proving" the old
     * bug from a read failure rather than from the schema — a false red is as useless as a false green. */
    const errWhy = String((e && e.message) || e);
    return { release: 'UNRELEASED', release_status: 'NO RELEASE HAS EVER BEEN CUT', _compared: 0, _readError: errWhy };
  }
  const want = (rel && rel.digests) || {};
  const moved = Object.keys(want).filter(k => k !== 'note' && engineDigests[k] !== want[k]);
  return {
    release: rel.release || 'UNNAMED',
    release_status: moved.length ? 'PRE-RELEASE' : 'ON_RELEASE',
    release_moved: moved.length ? moved : undefined,
    _compared: Object.keys(want).length,
  };
}

let mutationRan = false;   // arm 6 is worthless if the edit silently did not happen — asserted, not assumed

try {
  /* ---- ARM 1. THE KNOWN-BAD INPUT, AND PROOF THAT IT IS BAD ---------------------------------- */
  /* A real cut, into a throwaway store, so the pointer under test is the exact schema
   * `engine_release.js` writes today rather than a hand-typed imitation of it. */
  const cutRec = REL_API.cut('tests/test-miltank-release.js — throwaway store, never the real one', { store: TMP });
  const POINTER = path.join(TMP, 'engine-release.json');
  const ptr = JSON.parse(fs.readFileSync(POINTER, 'utf8'));

  ok(ptr.digests === undefined && ptr.release === undefined,
     'the pointer engine_release.js writes has NO `digests` and NO `release` field — the two the old resolver read');
  ok(typeof ptr.current === 'string' && ptr.current.length > 0,
     'it names the release in `current` (' + ptr.current + '), which is where the answer actually lives');

  const allWrong = {};
  for (const k of Object.keys(cutRec.files)) allWrong[k] = 'ZZZZZZZZZZZZ';
  const oldOut = OLD_resolveRelease(POINTER, allWrong);
  /* THE DEMONSTRATION. Every digest deliberately wrong, and the old code still says ON_RELEASE. */
  ok(oldOut.release_status === 'ON_RELEASE' && oldOut._compared === 0,
     'OLD code, every engine digest deliberately WRONG: still stamps ' + oldOut.release_status
     + ' off ' + oldOut._compared + ' files compared — the green was an empty comparison');
  ok(oldOut.release === 'UNNAMED',
     'OLD code cannot even name the release it claims to be on (' + oldOut.release + ')');

  /* ---- ARM 2. AN EMPTY DIGEST SET MUST NEVER READ AS ON_RELEASE ------------------------------ */
  /* Today's actual failure shape, reproduced against the NEW code: a release that names zero files.
   * `verify()` passes it (nothing to compare disagrees with nothing), `open()` returns it, and the
   * only thing standing between that and a false green is an explicit branch. */
  const EMPTY = path.join(TMP, 'empty-store');
  const eid = 'e0000000empty';
  fs.mkdirSync(path.join(EMPTY, 'releases', eid), { recursive: true });
  fs.writeFileSync(path.join(EMPTY, 'releases', eid, 'release.json'),
    JSON.stringify({ id: eid, cut: '2026-08-05T00:00:00.000Z', why: 'a manifest naming zero files',
                     cuts: [], files: {} }, null, 2));
  fs.writeFileSync(path.join(EMPTY, 'engine-release.json'), JSON.stringify({ current: eid }, null, 2));

  const emptyOut = MIL._resolveRelease({ store: EMPTY });
  ok(emptyOut.release_status !== 'ON_RELEASE',
     'NEW code REFUSES a zero-file manifest — status is ' + emptyOut.release_status + ', not ON_RELEASE');
  ok(emptyOut.release_status === 'UNKNOWN' && emptyOut.release_files === 0,
     'and it says so as its own state (UNKNOWN, release_files 0) rather than borrowing NO_RELEASE');
  ok(/zero/i.test(emptyOut.release_why || ''),
     'with a reason a reader can act on: ' + String(emptyOut.release_why || '').slice(0, 80) + '…');

  /* ---- ARM 3. NOTHING CUT AT ALL IS NOT THE SAME EVENT --------------------------------------- */
  const BARE = path.join(TMP, 'bare-store');
  fs.mkdirSync(BARE, { recursive: true });
  const bareOut = MIL._resolveRelease({ store: BARE });
  ok(bareOut.release_status === 'NO_RELEASE' && bareOut.engine_release === null,
     'an empty release store reads NO_RELEASE with a null engine_release — rule 1 unenforced, not satisfied');

  /* ---- ARM 4. A BROKEN POINTER IS NOT "NO RELEASE" ------------------------------------------- */
  /* The distinction the old code got right and is kept: a store that HAS releases but cannot open
   * one is a finding. Collapsing it into NO_RELEASE would read as a fresh install. */
  fs.writeFileSync(POINTER, JSON.stringify({ current: 'ffffffffffff' }, null, 2));
  const brokenOut = MIL._resolveRelease({ store: TMP });
  ok(brokenOut.release_status === 'RELEASE_UNUSABLE',
     'a pointer naming a release that is not on disk reads RELEASE_UNUSABLE, not NO_RELEASE');
  fs.writeFileSync(POINTER, JSON.stringify(ptr, null, 2));   // put the throwaway pointer back

  /* ---- ARM 5. A GENUINE RELEASE, AN UNMOVED TREE --------------------------------------------- */
  /* The probe file is created BEFORE it is added to the manifest, then copied into the snapshot, so
   * `verify()` (manifest vs snapshot) passes and `drift()` (manifest vs live tree) has something
   * this test is allowed to move. */
  fs.writeFileSync(PROBE_ABS, JSON.stringify({ probe: 'v1', pid: process.pid }) + '\n');
  const relDir = path.join(TMP, 'releases', cutRec.id);
  const man = JSON.parse(fs.readFileSync(path.join(relDir, 'release.json'), 'utf8'));
  man.files[PROBE_REL] = sha12(fs.readFileSync(PROBE_ABS));
  fs.mkdirSync(path.dirname(path.join(relDir, PROBE_REL)), { recursive: true });
  fs.copyFileSync(PROBE_ABS, path.join(relDir, PROBE_REL));
  fs.writeFileSync(path.join(relDir, 'release.json'), JSON.stringify(man, null, 2) + '\n');

  const onOut = MIL._resolveRelease({ store: TMP });
  const nFiles = Object.keys(man.files).length;
  ok(onOut.release_status === 'ON_RELEASE',
     'a genuine release with an unmoved tree reads ON_RELEASE');
  ok(onOut.release_files === nFiles && nFiles > 1,
     'and it says how many files that green rests on (' + onOut.release_files + ') — a green off 0 is now impossible to write');
  ok(onOut.release === cutRec.id && onOut.engine_release === cutRec.id,
     'it names the release id (' + onOut.release + ') instead of "UNNAMED"');
  ok(onOut.engine_release_cut === man.cut && typeof onOut.engine_release_cuts === 'number',
     'it carries the FIRST-freeze time and the cut count, consistent with REL.stamp()');
  ok(onOut.engine_release_digests && Object.keys(onOut.engine_release_digests).length === nFiles,
     'and the full digest set, so a reader can answer "which bytes" without the release store');
  ok(onOut.release_moved === undefined, 'nothing is reported moved when nothing moved');

  /* ---- ARM 6. THE ONE THAT DECIDES IT: MOVE A LIVE FILE THE MANIFEST NAMES -------------------- */
  const before = sha12(fs.readFileSync(PROBE_ABS));
  fs.writeFileSync(PROBE_ABS, JSON.stringify({ probe: 'v2 — DELIBERATELY MODIFIED', pid: process.pid }) + '\n');
  const after = sha12(fs.readFileSync(PROBE_ABS));
  mutationRan = (after !== before);
  /* ASSERTED, NOT ASSUMED. A skipped or no-op edit would leave arm 6 passing for the wrong reason —
   * it would be reporting "no drift" correctly about a tree that never moved, which is precisely the
   * false green this whole file is about, one level up. */
  ok(mutationRan, 'the live probe file GENUINELY changed content (' + before + ' -> ' + after + ')');

  const driftOut = MIL._resolveRelease({ store: TMP });
  ok(driftOut.release_status === 'OFF_RELEASE',
     'the resolver now reports OFF_RELEASE — it is capable of being false, which the old one was not');
  ok(Array.isArray(driftOut.release_moved) && driftOut.release_moved.includes(PROBE_REL),
     'and it NAMES the file that moved: ' + JSON.stringify(driftOut.release_moved));
  ok(driftOut.release === cutRec.id,
     'while still naming the release the run is off (' + driftOut.release + ')');
  ok(/moved/i.test(driftOut.release_why || ''),
     'with a human-readable reason: ' + String(driftOut.release_why || '').slice(0, 90) + '…');

  /* ---- ARM 7. THE LIVE STAMP, READ-ONLY ------------------------------------------------------ */
  /* No override: this is what a real MILTANK shard will carry. Read only — the real store is never
   * written by this test. The status is NOT asserted to be green, because whether the live tree is
   * on release is a fact about the tree and not about this code; what is asserted is that the answer
   * is one of the defined states and that a green can never again rest on zero files. */
  const liveOut = MIL._buildStamp();
  const STATES = ['ON_RELEASE', 'OFF_RELEASE', 'NO_RELEASE', 'RELEASE_UNUSABLE', 'UNKNOWN'];
  ok(STATES.includes(liveOut.release_status),
     'the live stamp reports a defined state: ' + liveOut.release_status
     + ' (release ' + liveOut.release + ', ' + liveOut.release_files + ' files)');
  ok(liveOut.release_status !== 'ON_RELEASE' || liveOut.release_files > 0,
     'ON_RELEASE is unreachable without at least one file compared');
  ok(liveOut.release_status !== 'ON_RELEASE' || (liveOut.engine_release && liveOut.engine_release_digests),
     'a green live stamp carries the release id AND its digest set');
  /* The four-file sha1 player hash must stay a hash of the LIVE bytes this process loaded. Merging
   * REL.stamp() wholesale would have replaced it with the frozen set and broken reduce()'s
   * mixed-build check silently — a quieter version of the same bug. */
  ok(liveOut.source_digests && liveOut.source_digests['miltank.js'] === sha1of(D('engine', 'miltank.js')),
     'reduce()\'s mixed-build key `source_digests` still hashes the LIVE player, not the release');

} finally {
  /* Only paths this test created. `data/.miltank-release-probe-<pid>.jsonl` and the temp store are
   * both written above; nothing pre-existing is removed. */
  try { fs.unlinkSync(PROBE_ABS); }
  catch (e) {
    /* ENOENT is fine — an early throw can land before the probe is written. Anything else means a
     * file this test created is still sitting in data/, which the assertion below will catch, but
     * the reason only exists here. */
    if (!e || e.code !== 'ENOENT') console.error('  (could not remove ' + PROBE_ABS + ': ' + ((e && e.message) || e) + ')');
  }
  rmrf(TMP);
  ok(!fs.existsSync(PROBE_ABS), 'the probe file this test created is cleaned up');
}

function sha1of(abs) {
  return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 12);
}

console.log(`\nMILTANK RELEASE STAMP: ${P} passed, ${F} failed`);
if (!mutationRan) {
  console.log('  NOTE: the drift arm did not mutate anything — its result proves nothing.');
  F++;
}
process.exit(F ? 1 : 0);
