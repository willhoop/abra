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

/* ---- 4. TONIGHT'S SEQUENCE: TWO CUTS OVER AN UNCHANGED TREE ------------------------------------ *
 * THE BUG, with the receipt. `engine/engine_release.js cut` ran twice over an unchanged tree on
 * 2026-08-05 — 02:12:57Z by SEARCH ("h60 log leg of the R1 explore-sweep re-run"), 02:26:04Z by the
 * router ("R10/click-censoring parallel session"). Both produced id `09acd3b404ef`, exactly 2 lines
 * of `release.json` changed and ZERO of the 23 digests, so no measurement was corrupted — and the
 * second cut OVERWROTE the first's `cut` and `why`. Any artifact SEARCH stamped `09acd3b404ef` then
 * pointed at a record claiming a freeze time THIRTEEN MINUTES AFTER the run that used it, for an
 * unrelated purpose. That is the "artifact newer than an input it never read" shape this repo has
 * already lost a 7,100-game measurement to.
 *
 * The docs called a second cut "a no-op". That was true of the frozen BYTES and false of the RECORD.
 *
 * WHY A THROWAWAY STORE. `cut()` writes the pointer that says which release a measurement opens by
 * default. A test that cut into the real store would repoint it while another division measures —
 * the failure this whole file exists to prevent, arriving through the test. `{store}` is passed
 * explicitly, the CLI never passes it, and every call using one prints that it did. */
const os = require('os');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-relstore-'));
const S = { store: TMP };
const rec = id => JSON.parse(fs.readFileSync(path.join(TMP, 'releases', id, 'release.json'), 'utf8'));

console.log('\n  -- re-cutting an identical tree (throwaway store at ' + TMP + ')');
try {
  const WHY1 = 'FIRST CUT — the h60 leg, cut immediately before the run that reads it';
  const WHY2 = 'SECOND CUT — an unrelated parallel session, thirteen minutes later';

  const c1 = REL.cut(WHY1, S);
  const rec1 = rec(c1.id);
  ok(rec1.why === WHY1, 'the first cut records its own reason');
  ok(!!rec1.cut, 'the first cut records when it froze the tree');

  /* An artifact is stamped BETWEEN the two cuts — this is SEARCH's run. */
  const stampedAt = new Date().toISOString();
  const artifact = REL.open(undefined, S).stamp();
  ok(artifact.engine_release === c1.id, 'an artifact stamped between the cuts names the release');

  let recut = false;
  const c2 = REL.cut(WHY2, S);
  recut = true;
  const rec2 = rec(c2.id);

  /* 1. DETERMINISM IS NOT WEAKENED. */
  ok(c2.id === c1.id, `an identical tree still yields the identical id (${c1.id})`
     + (c2.id === c1.id ? '' : ' — if this failed, the live tree moved mid-test: ' + REL.drift(c1.id, S).join(', ')));
  ok(JSON.stringify(rec2.files) === JSON.stringify(rec1.files), 'not one of the frozen digests changed');

  /* 2. THE FIRST CUT'S RECORD SURVIVES. This is the assertion that was red. */
  ok(rec2.cut === rec1.cut, `the FIRST cut's timestamp survived the second cut (${rec1.cut})`);
  ok(rec2.why === WHY1, "the FIRST cut's reason survived the second cut");

  /* 3. AND THE SECOND CUT IS NOT DISCARDED EITHER — it is an event, not an overwrite. */
  ok(Array.isArray(rec2.cuts) && rec2.cuts.length === 2, `both cuts are recorded as events (${(rec2.cuts || []).length})`);
  ok(!!rec2.cuts && rec2.cuts[0] && rec2.cuts[0].why === WHY1, 'event 0 is the first cut');
  ok(!!rec2.cuts && rec2.cuts[1] && rec2.cuts[1].why === WHY2, 'event 1 is the second cut');
  ok(!!rec2.cuts && rec2.cuts[1] && rec2.cuts[1].at >= rec2.cuts[0].at, 'the events are in the order they happened');

  /* 4. THE RECEIPT ITSELF: no artifact can be older than the release it names. */
  ok(new Date(rec2.cut) <= new Date(stampedAt),
     'the record never claims a freeze time AFTER a run that used it (the exact 2026-08-05 defect)');
  const stampAfter = REL.open(undefined, S).stamp();
  ok(stampAfter.engine_release_cut === rec1.cut,
     'stamp() still names the FIRST freeze, so an old artifact and a new one agree about the release');
  ok(JSON.stringify(stampAfter.source_digests) === JSON.stringify(artifact.source_digests),
     'stamp() answers "which bytes" identically before and after the recut');

  /* 5. THE POINTER IS A POINTER, AND IT MUST NOT INVENT A CUT TIME EITHER. */
  const ptr = JSON.parse(fs.readFileSync(path.join(TMP, 'engine-release.json'), 'utf8'));
  ok(ptr.current === c1.id, 'the pointer points at the release');
  ok(ptr.cut === rec1.cut && ptr.why === WHY1, 'the pointer mirrors the FIRST cut, not the latest');

  ok(recut, 'the second cut genuinely ran — a skipped recut must not pass this section');

  /* ---- 5. A ROTTED SNAPSHOT IS REPAIRED AND SAID OUT LOUD, NOT SKIPPED ------------------------ *
   * The old cut() tested `fs.existsSync(dir)` and skipped the whole copy loop, so a release whose
   * snapshot was incomplete or had rotted stayed broken through every later cut while cut() reported
   * success. Shown on known-bad input: verify() must FAIL first. */
  const ROT = 'data/quality-filter.json';
  const rotPath = path.join(TMP, 'releases', c1.id, ROT);
  fs.writeFileSync(rotPath, '{"__rotted":true}\n');
  ok(!REL.verify(c1.id, S).ok, 'a rotted snapshot file genuinely fails verify() first (the bad input is real)');
  const c3 = REL.cut('third cut, over a rotted snapshot', S);
  ok(REL.verify(c3.id, S).ok, 'a later cut RESTORES the rotted snapshot file instead of skipping the copy');
  const rec3 = rec(c3.id);
  const ev3 = (rec3.cuts || [])[2];
  ok(!!ev3 && Array.isArray(ev3.repaired) && ev3.repaired.includes(ROT),
     'and the repair is recorded in the cut event — a silent repair hides that a snapshot rotted');
  ok(rec3.cut === rec1.cut && rec3.why === WHY1, 'three cuts later, the first is still the one on top');

  /* ---- 6. A LEGACY RECORD (no cuts array) IS MIGRATED, NOT OVERWRITTEN ------------------------ *
   * The seven releases already on disk have no event list. A recut must adopt what they DO say as
   * event 0 rather than replacing it. */
  const legacyDir = path.join(TMP, 'releases', c1.id);
  fs.unlinkSync(path.join(legacyDir, 'cuts.jsonl'));
  const legacy = rec(c1.id);
  delete legacy.cuts;
  legacy.cut = '2026-08-05T02:12:57.000Z';
  legacy.why = 'the pre-event-list record';
  fs.writeFileSync(path.join(legacyDir, 'release.json'), JSON.stringify(legacy, null, 2) + '\n');
  const c4 = REL.cut('a cut against a legacy record', S);
  const rec4 = rec(c4.id);
  ok(rec4.cut === '2026-08-05T02:12:57.000Z' && rec4.why === 'the pre-event-list record',
     'a legacy record keeps its own cut/why when a later cut lands on it');
  ok((rec4.cuts || []).length === 2 && rec4.cuts[0].reconstructed === true,
     'the legacy value is adopted as event 0 and MARKED reconstructed, not passed off as observed');

  /* ---- 7. SAME ID MUST MEAN SAME DIGESTS — a hand-edited record is refused, not overwritten --- */
  const good = fs.readFileSync(path.join(legacyDir, 'release.json'));
  const tampered = JSON.parse(good.toString('utf8'));
  tampered.files['engine/board.js'] = '000000000000';
  fs.writeFileSync(path.join(legacyDir, 'release.json'), JSON.stringify(tampered, null, 2) + '\n');
  /* Named errRefused rather than `threw` so the silent-catch ratchet can see what this is: a
   * failure STASHED FOR A LATER ASSERTION, which is the one shape of quiet catch that is always
   * correct in a test expecting a throw. The detector recognises the idiom by the variable name. */
  let errRefused = null;
  try { REL.cut('a cut over a record whose digests disagree', S); } catch (e) { errRefused = e.message; }
  ok(!!errRefused && /digest/i.test(errRefused), 'a cut REFUSES a record whose digests disagree with the tree it just hashed');
  fs.writeFileSync(path.join(legacyDir, 'release.json'), good);
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); }
  catch (e) { console.error('  (throwaway release store left behind at ' + TMP + ': ' + e.message + ')'); }
}

/* ---- 8. THE OLDEST RELEASE ON DISK — THE ONE THAT FAILS FIRST, AND THE ONE NOTHING OPENED ------
 *
 * THE HOLE THIS CLOSES. Everything above cuts a release and reads it back seconds later, so it only
 * ever exercises a snapshot taken by the CURRENT code against the CURRENT callers. The releases that
 * break are the OLD ones, and no test had ever opened one.
 *
 * MEASURED 2026-08-09, 65 release directories: 4 pruned, 1 that predates `engine/mc_key.js` being in
 * SOURCES at all, 56 that predate `natureL50`, 5 that can serve engine/game_differential.js. The two
 * failures a person actually saw were `Cannot find module ...\releases\d3d04b669e18\engine\mc_key.js`
 * and `TypeError: M.natureL50 is not a function` at game_differential.js:1280 — neither of which
 * names a release, a symbol, or the fact that the snapshot is INTACT and merely old.
 *
 * THE SUBJECT IS FROZEN, THE CAMERA IS NOT — deliberately, because freezing the driver would score
 * every rung of the release ladder by its own contemporaneous reader. So the fix is a CONTRACT across
 * that boundary, and this section asserts the contract rather than asserting compatibility: the 56
 * are not repairable and a test that demanded they open would be red forever, which this project has
 * already learned is the same thing as no test.
 *
 * READ-ONLY, AND AGAINST THE REAL STORE ON PURPOSE. Every other section here uses a throwaway store
 * because `cut()` WRITES the pointer. This section only opens and requires, and a synthetic release
 * cannot be old — the age is the whole subject. */
console.log('\n  -- the oldest release on disk (real store, read-only)');
{
  const REAL = REL.RELEASES;
  const withCut = REL.list().map(rid => {
    const m = JSON.parse(fs.readFileSync(path.join(REAL, rid, 'release.json'), 'utf8'));
    return { id: rid, cut: m.cut, pruned: !!m.bodies_pruned, files: Object.keys(m.files || {}) };
  }).sort((a, b) => String(a.cut).localeCompare(String(b.cut)));
  const oldest = withCut.filter(x => !x.pruned)[0];
  ok(!!oldest, 'there is an oldest un-pruned release to open' + (oldest ? ` (${oldest.id}, cut ${oldest.cut})` : ''));

  if (oldest) {
    /* IT IS NOT BROKEN. Everything below is about age, and the distinction only means something if
     * the snapshot itself is provably intact. */
    ok(REL.verify(oldest.id).ok, `the oldest release still verifies against its own manifest (${oldest.id})`);
    const old = REL.open(oldest.id);

    /* 8a. A FILE THE RELEASE PREDATES. `engine/mc_key.js` joined SOURCES on 2026-08-05 with the
     * loader-deps growth; a release cut before that never held it, and the old code went straight to
     * node's resolver and produced MODULE_NOT_FOUND from inside engine_release.js. */
    const absentFile = REL.SOURCES.find(s => !oldest.files.includes(s));
    if (absentFile) {
      let errFile = null;
      try { old.require(absentFile); } catch (e) { errFile = e.message; }
      ok(!!errFile, `requiring ${absentFile} out of a release that predates it fails`);
      ok(!!errFile && errFile.includes(oldest.id) && errFile.includes(absentFile),
         'and the refusal names the RELEASE and the FILE');
      ok(!!errFile && !/Cannot find module/i.test(errFile),
         'not a bare MODULE_NOT_FOUND out of the resolver — that is what it used to be');
      ok(!!errFile && /predates|never held it/i.test(errFile),
         'and it says the snapshot predates the file rather than implying corruption');
      /* `path` and `read` reach the same missing file by another door. */
      let errPath = null;
      try { old.path(absentFile); } catch (e) { errPath = e.message; }
      ok(!!errPath && errPath.includes(absentFile), 'REL.path() refuses it too, not just REL.require()');
    } else {
      ok(false, 'expected the oldest release to predate at least one current SOURCE — if this is '
              + 'genuinely false the store was rebuilt, not that the check is unnecessary');
    }

    /* 8b. THE SYMBOL. This is the reported failure, in one line, at second zero. */
    let errSym = null;
    try { old.require('engine/medicham2-browser.js', { need: ['natureL50'] }); }
    catch (e) { errSym = e.message; }
    ok(!!errSym, 'requiring a symbol the oldest snapshot predates FAILS at the require');
    ok(!!errSym && errSym.includes('natureL50'), 'and the refusal NAMES the missing symbol');
    ok(!!errSym && errSym.includes(oldest.id), 'and names the release, which the TypeError never did');
    ok(!!errSym && !/is not a function/i.test(errSym),
       'and is not a TypeError raised 1,280 lines into an unrelated file');

    /* 8c. THE CONTROL, EXPLICITLY CLEARED. A guard that threw for EVERY release would pass every
     * assertion above while making the whole release store unusable. The CURRENT release must load
     * the same module with the same need list and NOT throw. */
    let currentThrew = null;
    try { REL.open().require('engine/medicham2-browser.js', { need: ['natureL50', 'battleInit', 'buildMon'] }); }
    catch (e) { currentThrew = e.message; }
    ok(!currentThrew, 'the CURRENT release satisfies the same need list — the guard refuses by age, '
       + 'not always' + (currentThrew ? ': ' + currentThrew.split('\n')[0] : ''));

    /* 8d. AND THE INVENTORY EXISTS, because a 56-release backlog cannot be acted on one crash at a
     * time. Both verdicts must appear: identical results across every release would mean `compat` is
     * reading nothing. */
    const rows = REL.compat('engine/medicham2-browser.js', ['natureL50']);
    ok(rows.length === REL.list().length, `compat() reports every release (${rows.length})`);
    const provides = rows.filter(r => r.provides).length;
    const lacks = rows.filter(r => r.status === 'ok' && !r.provides).length;
    ok(provides > 0 && lacks > 0,
       `compat() separates them rather than answering the same for all: ${provides} provide, ${lacks} predate it`);
    ok(rows.some(r => r.id === oldest.id && !r.provides), 'and the oldest release is on the LACKS side');
  }
}

/* ---- 9. THE CLOSURE GUARD — ROADMAP #153, THE FOURTH TIME SOURCES WAS SHORT ---------------------
 *
 * §8 asserts the CONTRACT for releases that are old. This asserts that a NEW release is loadable at
 * all, which is a different failure and the live one: between 2026-08-11T00:27Z and 00:43Z three
 * releases were cut whose 23 digests were all valid and whose `engine/board.js` AND
 * `engine/rollout_leaf.js` — the leaf — could not be required out of the snapshot, because
 * `engine/pp.js` had become a require of both and was not in SOURCES.
 *
 * Those three verify. `open()` accepts them. Every existing check passed. That is why the guard has
 * to be at the CUT, and why it must refuse rather than warn.
 *
 * SHOWN RED ON KNOWN-BAD INPUT, not merely green: the scan is driven with `engine/pp.js` removed
 * from the list and must name it. A guard that has only ever been green is not evidence. */
console.log('\n  -- the require closure of SOURCES (ROADMAP #153)');
{
  const live = REL.requireClosure(REL.SOURCES);
  ok(live.escapes.size === 0,
     'every file a frozen source requires is itself frozen'
     + (live.escapes.size ? ': ESCAPES ' + [...live.escapes.keys()].join(', ') : ''));
  ok(live.unresolved.length === 0,
     'the scan followed every require edge it found'
     + (live.unresolved.length ? ' — could not follow: ' + live.unresolved.join('; ') : ''));
  /* THE SCAN GENUINELY WALKED SOMETHING. `escapes.size === 0` is also what a scan that read nothing
   * returns, which is the "capability absent, everything reports success" shape. */
  ok(live.scanned >= 10, `the scan actually walked the graph (${live.scanned} modules reached)`);

  const short = REL.SOURCES.filter(s => s !== 'engine/pp.js');
  const red = REL.requireClosure(short);
  ok(red.escapes.has('engine/pp.js'),
     'RED PROOF — with engine/pp.js removed from the list the scan names it as an escape');
  ok((red.escapes.get('engine/pp.js') || []).some(f => /rollout_leaf|board/.test(f)),
     'and names which frozen source requires it (the leaf and/or the board)');

  /* AND THE REFUSAL IS WIRED TO cut(), not merely available beside it. Driven through the real
   * `cut()` into a throwaway store with a deliberately short list is not possible without mutating
   * the module constant, so the assertion is on the counter: a real cut in this run incremented the
   * scan counter, which proves the guard is on the path rather than sitting in module scope. */
  ok(REL.CUT_COUNTERS.closure_scans > 0,
     `cut() ran the closure scan ${REL.CUT_COUNTERS.closure_scans} time(s) in this test run — a guard `
     + 'that cannot prove it ran is assumed broken');
  ok(REL.CUT_COUNTERS.closure_refusals === 0,
     `and refused ${REL.CUT_COUNTERS.closure_refusals} of them, which is the expected steady state`);
}

console.log(`\nENGINE RELEASE TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
