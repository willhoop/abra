/* AN ARTIFACT WHOSE RELEASE CANNOT BE OPENED IS UNFALSIFIABLE, AND IT LOOKS EXACTLY LIKE A LIVE ONE.
 *
 * ABRA-HEAP: 6144
 *
 * DECLARED 2026-09-04, AND THE REASON IS THIS FILE'S OWN SUBJECT. It audits 91 stamped artifacts
 * across 30 releases and died at node's default heap (exit 134) partway through — after printing a
 * STRANDED line and before printing `no artifact became unre-runnable since the baseline (1 known,
 * was 1)`. So it blocked a commit on a partial verdict that read WORSE than the truth. A check that
 * cannot finish is not a stricter check; it is a check whose answer is whatever it managed to say
 * before it died. Fourth such file found in one session.
 *
 * Will, 2026-08-12: *"should i be concerned we suddenly cant run old things"*, then *"you need to fix
 * it and make it so it doesnt happen again"*.
 *
 * ================= WHAT ACTUALLY HAPPENED =========================================================
 *
 * A release freezes the ENGINE and not the READER. Every symbol a caller adds to its `need` list
 * retroactively strands every release cut before that symbol existed — the snapshot still verifies,
 * still holds its bytes, and simply stops being openable. Nothing announces it.
 *
 * The cause is dated and it is not carelessness: ROADMAP #222 split the RNG streams so the stall
 * counter stopped being welded to the accuracy pin, and 30 snapshots export `rngStreams` with the
 * oldest cut at 2026-08-12T00:19. `spreadL50` stranded two more. **Both changes were right. The bug
 * is that paying their cost was invisible.**
 *
 * ================= WHY THIS DOES NOT TRY TO RECOVER ANYTHING ======================================
 *
 * CLAUDE.md: *"A quarantined number does not become true when MEDICHAM becomes correct; it becomes
 * RE-RUNNABLE."* Re-running is re-MEASURING on the current engine, not reproducing old bytes. So a
 * stranded artifact does not need rescuing — it needs to stop being citeable. That is the same
 * prescription as the quarantine rule one level up: **the figure must be WITHHELD, not annotated.**
 *
 * Freezing the reader alongside the engine would make old runs reproducible and is deliberately NOT
 * done here. It doubles every snapshot to answer a question this project does not ask: nobody wants
 * the number the old harness produced, they want today's number.
 *
 * ================= THE TWO RULES THIS FILE IS BUILT ON ============================================
 *
 * RULE 1 — AN ARTIFACT IS JUDGED AGAINST THE CALLER THAT PRODUCED IT, NEVER AGAINST A UNION.
 *   The first version of this check unioned every `need` list in engine/ into one 24-symbol set and
 *   held every artifact to it. That is wrong in the direction that matters: `hitChance`, `ACCMOD`,
 *   `MEDSEEN` and `MEDFAILS` are asked for by `engine/million_run.js` ALONE, and `fails`,
 *   `rngStreams`, `spreadL50`, `traceCanon` and `TRACE_EVENTS` by `engine/game_differential.js`
 *   ALONE. Unioned, a release that can still serve the differential perfectly well is reported as
 *   stranding the differential's own artifact because it predates a symbol the differential has
 *   never read. A false stranding is not a safe error here — it retires a number that is fine, and
 *   an over-firing gate is the one people learn to ignore (#148).
 *
 * RULE 2 — WHERE THE PRODUCER CANNOT BE READ, SAY SO. DO NOT GUESS AND DO NOT ACCUSE.
 *   The producer is the artifact's own `by` field, normalised to a repo path. Three cases, and each
 *   one is a distinct printed band rather than a default:
 *     (a) `by` names a caller with at least one `REL.require(file, {need:[...]})` site  -> judged
 *         against exactly THAT caller's rows, unioned WITHIN the caller (a caller with three require
 *         sites genuinely needs all three) and never across callers.
 *     (b) `by` is absent, or names a caller with no such site (a .py script, a driver that shells
 *         out, a caller that reaches the snapshot through REL.read/REL.path) -> UNKNOWN-PRODUCER.
 *         It is still held to the one requirement that is caller-INDEPENDENT: the release must
 *         actually open. A pruned, modified or missing snapshot strands everybody, and that verdict
 *         needs no guess about who read it.
 *     (c) `"rerun": false` WITH a reason -> RETIRED, an explicit act by a person. Without a reason it
 *         is not a declaration, it is a blank, and it counts as stranded.
 *
 * ================= WHY THERE IS NO PARSER IN THIS FILE ============================================
 *
 * The first version hand-rolled a `module.exports` parser to work out what a snapshot exported, and
 * it was wrong twice — it reported that a release cut MINUTES earlier lacked `fails` and `hitChance`.
 * A snapshot cannot lose a symbol the live tree has, so the parser was wrong and not the release.
 *
 * THE CAUSE, MEASURED: `medicham2-browser.js` interleaves BLOCK COMMENTS with the keys inside its
 * `module.exports={...}` literal. Splitting the body on commas glues each comment onto the key that
 * follows it, so the first key after every comment fails `/^\w+$/` and is lost — eleven of them,
 * `hitChance` and `fails` among them. The `root.(\w+)=` arm then invented four symbols out of prose,
 * including one called `deliberately`. It is the identical hole `provenance.js`'s `writesNear` had
 * and that `callerNeeds` already strips for: **a parser that has not stripped comments is reading
 * prose as code.**
 *
 * So the parse is gone. `engine/engine_release.js` already answers this question by LOADING the
 * frozen module — `surface(id, file)` — and that is the authority, for the reason its own comment
 * gives: a text search finds `natureL50` in a file that never put it in `module.exports`. Measured at
 * 18ms for medicham2 and 23 distinct releases across every artifact on disk, so there is no cost
 * argument for a second implementation either. Hand-rolling one is how `buildMon("Scizor")` returned
 * null.
 *
 * The manifest's recorded `provides` list is kept — it is the ONLY record of a pruned release's
 * export surface, which `surface()` can no longer answer — and it is AUDITED against the loader on
 * every run rather than trusted. A derived value is not a fact until something compares it to its
 * source.
 *
 * ================= WHAT THIS CHECK CANNOT SEE, SAID OUT LOUD ======================================
 *
 * The requirement table comes from `ER.callerNeeds()`, which reads `REL.require(file, {need:[...]})`
 * sites. `tests/roster.js` and `tests/mutation_harness.js` reach into a snapshot through `REL.read`
 * and `REL.path` instead, so their FILE requirements are invisible to it and their artifacts are
 * judged on openability alone. That under-reports, never over-reports. The fix belongs in
 * `callerNeeds` — one requirement reader, not a second one in here — and is filed, not done here.
 *
 * ================= ABSENT IS NOT STRANDED — 2026-09-10, ROADMAP #554 ==============================
 *
 * `data/releases/` is gitignored; a release reaches the repository only by `git add -f`. On the laptop
 * every release an artifact names is on disk. On a fresh clone only the force-added ones are, and the
 * first clone run of this file read "99 stamped artifacts: 99 STRANDED" — a release ABSENT from the
 * machine reported as a release that will not open. Those are different facts about different things:
 * STRANDED is a property of the artifact-release pair and follows it everywhere; absence is a property
 * of the clone. A gate that fails on every fresh clone is a gate everyone learns to bypass (#148), and
 * it pinned every commit to one keyboard.
 *
 * So git is asked, once, what it carries, and the open failure is split by that answer:
 *   - not on this disk AND not tracked in git  -> ABSENT-ON-THIS-MACHINE. Counted, printed per release,
 *     NOT a failure and NOT in the ratchet. `--stamp` refuses while any exist, because a floor written
 *     on a clone that cannot see half the releases is not the floor.
 *   - tracked in git (or on disk) and will not open -> STRANDED, exactly as before. A release the
 *     repository claims to carry and cannot serve is broken wherever it is read, and the ratchet holds it.
 *
 * AND THE COMMITTED BYTES ARE HASHED, NOT THE WORKING COPY'S. The same clone run found five tracked
 * releases reading MODIFIED with every file `i/lf w/crlf`: force-added in August under core.autocrlf
 * before `data/releases/** -text` existed, so git NORMALISED the blobs and the committed copy has never
 * hashed to its manifest — while the laptop's copy, CRLF and stat-clean, verifies and `git status`
 * says nothing. A check against the working tree can only see that from a second machine. This one
 * streams every tracked release's blobs through `git cat-file --batch` (~3s, measured, 676 files) and
 * fails BY NAME on the laptop too, which is where the fix (`git add --renormalize`) has to be made.
 *
 * ================= --staged: JUDGE THE COMMIT, NOT THE WORKING TREE — 2026-09-11 ==================
 *
 * The pre-commit hook runs this file. It was the last gate in the hook's loop that still read the
 * working tree, and several agents write that tree at once. So an unrelated commit could be blocked
 * by an artifact another agent had rewritten on disk and that the commit did not contain, and a
 * stranded artifact STAGED beside a clean disk copy was passed. With `--staged`, every input a commit
 * carries is read AS THE COMMIT HOLDS IT, through engine/docs_scan.js's one reader (`useIndex()`):
 * the index version where staged, HEAD's where not. That covers:
 *   - the data/*.json artifacts and the release each one names;
 *   - data/artifact-rerunnable-baseline.json, the ratchet floor;
 *   - the callers' `REL.require(file, {need})` sites. `ER.callerNeeds(dir)` reads a directory, so the
 *     staged top level of engine/ and tests/ is copied out byte-exact (`DS.materialize`) to an
 *     OS-temp directory and the authority reads it there. There is no second parser. The process
 *     removes only the directory it made;
 *   - the live recorder check. The staged engine/medicham2-browser.js is compiled at its real path,
 *     so the commit's export list is judged. The modules it requires still resolve from disk.
 * `git ls-files` already honours GIT_INDEX_FILE, so "what git tracks" was always the commit's view.
 *
 * data/releases/ IS STILL READ FROM DISK, AND THAT IS SAFE. A release is content-addressed: ER.open()
 * checks every file against the manifest digests before it serves a byte, so a disk copy that is not
 * the release reads MODIFIED. It can be over-accused and never passed. Section 5b already hashes the
 * COMMITTED blobs of every tracked release. Without the flag, a hand run reads the working tree
 * exactly as before.
 *
 *   node tests/test-artifact-rerunnable.js
 *   node tests/test-artifact-rerunnable.js --staged  # what .githooks/pre-commit runs
 *   node tests/test-artifact-rerunnable.js --stamp   # accept the current count as the new ratchet
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const { spawnSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
const ER = require(D('engine', 'engine_release.js'));
const DS = require(D('engine', 'docs_scan.js'));
/* ONE READER. Without --staged it is the working tree, byte-identical to the fs calls it replaced. */
const STAGED = process.argv.includes('--staged');
if (STAGED) DS.useIndex();

/* ---- 0. WHAT GIT CARRIES, ASKED ONCE -------------------------------------------------------------
 * One `git ls-files -s` over the release store and the artifact directory: which release ids the
 * repository tracks, the blob id of every tracked release file, and which data/*.json artifacts are
 * tracked. A git that cannot be asked is a printed fact, not a silent default: without it nothing here
 * can tell ABSENT from STRANDED, so the split is not made and the old, over-accusing verdict stands. */
function gitTracked() {
  const out = { ok: false, why: null, releases: new Set(), blobs: new Map(), artifacts: new Set() };
  const r = spawnSync('git', ['ls-files', '-s', '-z', '--', 'data/releases', 'data/*.json'],
    { cwd: D(), encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error || r.status !== 0) {
    out.why = r.error ? r.error.message : ('git ls-files exit ' + r.status + ': ' + String(r.stderr || '').trim());
    return out;
  }
  for (const line of r.stdout.split('\0')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    const sha = line.slice(0, tab).split(' ')[1];
    const p = line.slice(tab + 1);
    const m = p.match(/^data\/releases\/([0-9a-f]{12})\//);
    if (m) { out.releases.add(m[1]); out.blobs.set(p, sha); }
    else if (/^data\/[^/]+\.json$/.test(p)) out.artifacts.add(p);
  }
  out.ok = true;
  return out;
}
const GIT = gitTracked();

let fails = 0, checks = 0;
const ok = (cond, label, extra) => {
  checks++;
  if (cond) { console.log('  ok    ' + label + (extra ? '   (' + extra + ')' : '')); return true; }
  fails++; console.log('  FAIL  ' + label + (extra ? '   (' + extra + ')' : '')); return false;
};
const oneLine = s => String(s).split('\n')[0].trim();

/* ---- 1. THE REQUIREMENT TABLE, READ PER CALLER FROM THE AUTHORITY --------------------------------
 * `ER.callerNeeds()` is the one implementation of "what does a caller demand of a snapshot". It
 * strips comments (this file's own header documents what happens to a scanner that does not), it
 * anchors the options object immediately after the require path so it cannot drift into a LATER
 * require's `need:` list, and it skips engine_release.js itself. Re-deriving any of that here would
 * be the second implementation the FACTS ARE GLOBAL rule forbids. */
/* UNDER --staged THE CALLERS ARE READ AS THE COMMIT HOLDS THEM. `ER.callerNeeds(dir)` is the authority
 * and it reads a directory, so the staged top level of engine/ and tests/ (exactly what it scans) is
 * copied out through the one reader and the authority is pointed at the copy. Growing a `need` list is
 * the change this gate exists to price, so judging the DISK's need lists would miss the staged one. */
let CALLERS_COPIED = null;
function callerDirs() {
  if (!STAGED) return { engine: undefined, tests: D('tests'), copied: null, done() {} };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-rerunnable-staged-'));
  const rels = [];
  for (const d of ['engine', 'tests']) {
    fs.mkdirSync(path.join(tmp, d), { recursive: true });
    for (const f of DS.listFiles(d)) if (f.endsWith('.js')) rels.push(d + '/' + f);
  }
  DS.materialize(rels, tmp);
  return { engine: path.join(tmp, 'engine'), tests: path.join(tmp, 'tests'), copied: rels.length,
    done() {
      try { fs.rmSync(tmp, { recursive: true, force: true }); }
      catch (err) { console.error('  could not remove the staged caller copy ' + tmp + ': ' + err.message); }
    } };
}
function requirementTable() {
  const errs = [];
  const rows = [];
  const dirs = callerDirs();
  CALLERS_COPIED = dirs.copied;
  try {
  const e = ER.callerNeeds(dirs.engine);            /* undefined -> the live engine/ */
  if (e.error) errs.push(e.error);
  rows.push(...e.rows);
  /* tests/ is scanned too, because tests/roster.js and tests/mutation_harness.js produce ten of the
   * artifacts below. `callerNeeds` hard-codes the 'engine/' prefix on the caller name, so the label
   * is corrected here from the directory that was actually scanned — the ROWS are the authority's,
   * only the name is repaired. Fixing the prefix inside engine_release.js is the right home for it
   * and is filed rather than done while other divisions are live in that file. */
  const t = ER.callerNeeds(dirs.tests);
  if (t.error) errs.push(t.error);
  rows.push(...t.rows.map(r => ({ ...r, caller: 'tests/' + path.basename(r.caller) })));
  } finally { dirs.done(); }

  const byCaller = new Map();
  for (const r of rows) {
    if (!byCaller.has(r.caller)) byCaller.set(r.caller, new Map());
    const m = byCaller.get(r.caller);
    if (!m.has(r.file)) m.set(r.file, new Set());
    for (const k of r.need) m.get(r.file).add(k);
  }
  return { byCaller, rows, errors: errs };
}

/* ---- 2. WHO PRODUCED AN ARTIFACT ---------------------------------------------------------------
 * `by` is prose in places — "engine/game_differential.js run twice under --nature serious|real",
 * "engine/million_run.js --staged" — so the path is matched out of it rather than the whole string
 * being compared. A `by` that names no path at all yields null, which is UNKNOWN-PRODUCER and not a
 * silent default. */
const PRODUCER = /\b((?:engine|tests|build|web)\/[A-Za-z0-9_.\-]+\.(?:js|py|mjs|cjs))/;
function producerOf(j) {
  for (const v of [j.by, j.generator, j.producer]) {
    if (typeof v !== 'string') continue;
    const m = v.match(PRODUCER);
    if (m) return m[1];
  }
  return null;
}

/* ---- 3. EVERY ARTIFACT THAT NAMES A RELEASE ----------------------------------------------------- */
const SCRATCH = /^_scratch-/;                       /* not artifacts; see the report at the bottom */
function stampedArtifacts() {
  const out = [], prose = [], scratch = [], unreadable = [];
  for (const f of DS.listFiles('data').filter(x => /\.json$/.test(x))) {
    /* AN UNREADABLE ARTIFACT USED TO DROP OUT OF THIS SCAN ENTIRELY, so a corrupt file that names a
       stranded release escaped the check while the run stayed green. It is bucketed and named, next
       to `prose` and `scratch`, because a scanner that could not read a file may not report that
       file clean. */
    let j; try { j = JSON.parse(DS.rawText('data/' + f)); }
    catch (e) { unreadable.push({ file: f, why: oneLine(String((e && e.message) || e)).slice(0, 90) }); continue; }
    const cand = [j.release, j.engine_release, j.engine_release_cut && j.engine_release_cut.id];
    /* A RELEASE ID IS 12 HEX CHARACTERS. Some artifacts put PROSE in `release` explaining why they are
     * not stamped — `dusk-size-gate.json` says "none — this is pure store analysis and loads no engine
     * module". That is a legitimate declaration and must not be read as a broken id; the first scan
     * printed it as a stranded release, which is a probe reporting prose as a defect. */
    const id = cand.find(x => typeof x === 'string' && /^[0-9a-f]{12}$/.test(x));
    if (!id) {
      const p = cand.find(x => typeof x === 'string' && x.trim());
      if (p) prose.push({ file: f, said: oneLine(p).slice(0, 90) });
      continue;
    }
    const row = {
      file: f, id, producer: producerOf(j),
      retired: j.rerun === false,
      why: j.rerun_why || j.retired_why || null,
      when: j.generated || j.cut || j.engine_release_cut || '',
    };
    if (SCRATCH.test(f)) scratch.push(row); else out.push(row);
  }
  out.sort((a, b) => String(a.when).localeCompare(String(b.when)) || a.file.localeCompare(b.file));
  return { out, prose, scratch, unreadable };
}

/* ---- 4. THE RELEASE SIDE, THROUGH THE CANONICAL CALLS ONLY -------------------------------------- */
const OPENED = new Map();
function openOf(id) {
  if (!OPENED.has(id)) {
    /* `open()` is what a re-run actually calls: it refuses a pruned release by name, refuses a
     * modified one, and its manifest is what `frozen()` checks a file path against. Asking it is
     * asking the question the re-run will ask. */
    try { OPENED.set(id, { rel: ER.open(id), err: null }); }
    catch (e) { OPENED.set(id, { rel: null, err: e.message }); }
  }
  return OPENED.get(id);
}
const SURF = new Map();
function surfaceOf(id, rel) {
  const k = id + '|' + rel;
  if (!SURF.has(k)) SURF.set(k, ER.surface(id, rel));
  return SURF.get(k);
}

function judge(a, byCaller) {
  if (a.retired && a.why) return { band: 'RETIRED', detail: oneLine(a.why).slice(0, 100) };
  const o = openOf(a.id);
  if (o.err) {
    /* THE SPLIT. Absent from this disk and unknown to git is a fact about the clone; anything else
     * that will not open is a fact about the release, and it travels with the artifact. When git could
     * not be asked the split is not made — the old verdict is the over-accusing one, which is the safe
     * direction for a ratchet, and the reason is printed beside every row it touches. */
    const onDisk = fs.existsSync(D('data', 'releases', a.id));
    const tracked = GIT.releases.has(a.id);
    if (GIT.ok && !onDisk && !tracked) {
      return { band: 'ABSENT-ON-THIS-MACHINE',
               detail: 'data/releases/' + a.id + ' is not on this clone and is not tracked in git — a fact about the machine, not the artifact' };
    }
    const where = !GIT.ok ? '[git could not be asked: ' + GIT.why + ']'
                : tracked ? '[TRACKED in git — broken on every clone]'
                : '[on this disk, untracked]';
    return { band: 'STRANDED', detail: 'the release will not open — ' + oneLine(o.err) + '  ' + where };
  }
  if (a.retired) return { band: 'STRANDED', detail: 'declares "rerun": false with NO reason — a blank is not a declaration' };

  const req = a.producer ? byCaller.get(a.producer) : null;
  if (!req) {
    return { band: 'UNKNOWN-PRODUCER', detail: a.producer
      ? a.producer + ' has no REL.require(file,{need}) site — its requirement cannot be read, so it is not accused'
      : 'the artifact records no `by`, so nothing says which caller must be able to re-run it' };
  }
  const lacks = [];
  for (const [file, syms] of [...req].sort()) {
    if (!(file in (o.rel.manifest.files || {}))) { lacks.push(file + ' (the release predates the file)'); continue; }
    const s = surfaceOf(a.id, file);
    if (s.status !== 'ok') { lacks.push(file + ' (' + s.status + (s.why ? ': ' + oneLine(s.why).slice(0, 70) : '') + ')'); continue; }
    for (const k of [...syms].sort()) if (!s.exports.includes(k)) lacks.push(file + '::' + k);
  }
  return lacks.length ? { band: 'STRANDED', detail: 'lacks ' + lacks.join(', ') }
                      : { band: 'RE-RUNNABLE', detail: '' };
}

/* ================================================================================================ */
console.log('ARTIFACTS THAT NAME A RELEASE — can each still be RE-RUN?\n');

const { byCaller, rows: needRows, errors } = requirementTable();
ok(errors.length === 0, 'the requirement table was read without a scan error', errors.join('; ') || 'engine/ and tests/');
ok(byCaller.size > 0 && needRows.some(r => r.need.length > 0),
   'the requirement table came from the callers, not from a list typed here',
   needRows.length + ' REL.require site(s) across ' + byCaller.size + ' caller(s)');
for (const [caller, files] of [...byCaller].sort()) {
  const parts = [...files].sort().map(([f, s]) => f + (s.size ? ' needs ' + s.size : ' (loadable only)'));
  console.log('        ' + caller.padEnd(38) + parts.join('  |  '));
}

const { out: arts, prose, scratch, unreadable } = stampedArtifacts();
const rows = arts.map(a => ({ ...a, ...judge(a, byCaller) }));

console.log('');
const ORDER = { 'STRANDED': 0, 'UNKNOWN-PRODUCER': 1, 'RETIRED': 2, 'RE-RUNNABLE': 3, 'ABSENT-ON-THIS-MACHINE': 4 };
for (const r of [...rows].sort((x, y) => ORDER[x.band] - ORDER[y.band] || x.file.localeCompare(y.file))) {
  if (r.band === 'ABSENT-ON-THIS-MACHINE') continue;              /* grouped by release below */
  console.log('  ' + r.band.padEnd(17) + r.id + '  ' + r.file.padEnd(48)
    + (r.producer || '(no by)').padEnd(34) + (r.detail || ''));
}

const bad = rows.filter(r => r.band === 'STRANDED');
const unknown = rows.filter(r => r.band === 'UNKNOWN-PRODUCER');
const absent = rows.filter(r => r.band === 'ABSENT-ON-THIS-MACHINE');
console.log('\n  ' + rows.length + ' stamped artifact(s) over ' + new Set(rows.map(r => r.id)).size + ' release(s):  '
  + rows.filter(r => r.band === 'RE-RUNNABLE').length + ' re-runnable, '
  + rows.filter(r => r.band === 'RETIRED').length + ' retired, '
  + unknown.length + ' unknown-producer, ' + bad.length + ' STRANDED and undeclared, '
  + absent.length + ' absent on this machine.');

/* WHAT GIT WAS ASKED, AND WHAT IT SAID. Printed every run so a clone and the laptop can be told apart
 * from the output alone. "TRACKED artifacts naming an untracked release" is ROADMAP #554's option 1
 * made a number: those are re-runnable HERE and absent on every other clone, and the count only falls
 * when a release is force-added or the artifact is re-run on a tracked one. */
if (!GIT.ok) {
  console.log('\n  GIT COULD NOT BE ASKED (' + GIT.why + ') -- ABSENT and STRANDED are NOT split this run; every');
  console.log('  unopenable release is reported STRANDED, which over-accuses and never under-accuses.');
} else {
  const strandedOnClone = arts.filter(a => GIT.artifacts.has('data/' + a.file) && !GIT.releases.has(a.id));
  console.log('\n  git tracks ' + GIT.releases.size + ' release(s) under data/releases/ and ' + GIT.artifacts.size + ' data/*.json file(s); '
    + strandedOnClone.length + ' TRACKED artifact(s) name a release that is NOT tracked (re-runnable here, absent on every other clone).');
}
if (absent.length) {
  const byId = new Map();
  for (const r of absent) { if (!byId.has(r.id)) byId.set(r.id, []); byId.get(r.id).push(r.file); }
  console.log('\n  ABSENT ON THIS MACHINE -- ' + absent.length + ' artifact(s) over ' + byId.size + ' release(s) that are neither on this disk nor');
  console.log('  tracked in git. This is a fact about the CLONE, not about the artifacts: nothing here says whether they');
  console.log('  would re-run where the release exists, and they are NOT counted as stranded and NOT in the ratchet.');
  for (const [id, files] of [...byId].sort()) {
    console.log('    ' + id + '  ' + files.length + ' artifact(s): ' + files.slice(0, 4).join(', ') + (files.length > 4 ? ', ...' : ''));
  }
}

/* THE EXCLUSIONS ARE PRINTED, NEVER SILENT. A file this check skips is a file it makes no claim
 * about, and a skip nobody can see is indistinguishable from a pass. */
if (prose.length) {
  console.log('\n  DECLARED NOT STAMPED — a prose `release` field is a legitimate declaration, not a broken id:');
  for (const p of prose) console.log('    ' + p.file.padEnd(34) + '"' + p.said + '"');
}
if (unreadable.length) {
  console.log('\n  DID NOT PARSE — these data/*.json files were NOT scanned for a stranded release, so');
  console.log('  nothing above says anything about them either way:');
  for (const u of unreadable) console.log('    ' + u.file.padEnd(34) + u.why);
}
if (scratch.length) {
  console.log('\n  SKIPPED as scratch (`_scratch-*.json`, matched by name, untracked temp dumps in data/):');
  for (const s of scratch) console.log('    ' + s.file.padEnd(34) + s.id + '  ' + (s.producer || '(no by)'));
  console.log('    They carry a real release stamp and are shaped exactly like artifacts, which is the');
  console.log('    argument for moving them OUT of data/ rather than for this filter. Reported, not deleted.');
}

/* ---- 5. THE RECORDED `provides` IS AUDITED, NOT TRUSTED ----------------------------------------
 * `release.json` carries a `provides` list captured at cut time. It is worth keeping — after a prune
 * the bodies are gone and `surface()` can answer nothing, so that list becomes the only surviving
 * record of the export surface — and it is a DERIVED value, so something has to compare it to its
 * source. The loader is the source.
 *
 * IT IS ASKED OF EVERY RELEASE ON DISK THAT CARRIES THE FIELD, not only the ones an artifact cites.
 * Scoped to the cited ones it audited ZERO manifests and printed a green tick, which is a capability
 * that cannot prove it ran — the failure this project is named after, inside the check written to
 * stop it. */
const MEDI = 'engine/medicham2-browser.js';
let audited = 0; const legacy = [], broken = [];
/* A MANIFEST THAT WILL NOT READ USED TO BE SKIPPED IN SILENCE, which shrinks `audited` with no
   receipt — the same "audited ZERO manifests and printed a green tick" failure the comment above
   describes, arriving one line lower. Counted and named. */
const unreadableManifests = [];
for (const id of ER.list()) {
  let man;
  try { man = JSON.parse(fs.readFileSync(D('data', 'releases', id, 'release.json'), 'utf8')); }
  catch (e) {
    if (!(e && e.code === 'ENOENT')) unreadableManifests.push(id + ' (' + oneLine(String(e.message || e)).slice(0, 70) + ')');
    continue;
  }
  if (!Array.isArray(man.provides)) continue;
  const s = surfaceOf(id, MEDI);
  if (s.status !== 'ok') continue;
  audited++;
  const miss = s.exports.filter(k => !man.provides.includes(k));
  const extra = man.provides.filter(k => !s.exports.includes(k));
  if (!miss.length && !extra.length) continue;
  const note = id + ': recorded ' + man.provides.length + ', loads ' + s.exports.length
    + (miss.length ? ' | never recorded: ' + miss.join(',') : '')
    + (extra.length ? ' | recorded but not exported: ' + extra.join(',') : '');
  (man.provides_by ? broken : legacy).push(note);
}
ok(broken.length === 0,
   'every `provides` written by the CURRENT recorder agrees with the loader',
   broken.length ? broken.join(' ;; ') : audited + ' manifest(s) audited against surface(), '
     + legacy.length + ' of them legacy');
if (unreadableManifests.length) {
  console.log('\n  RELEASE MANIFESTS THAT DID NOT PARSE — excluded from the ' + audited + ' audited above,');
  console.log('  so no `provides` claim was checked for them:');
  for (const m of unreadableManifests) console.log('    ' + m);
}
if (legacy.length) {
  console.log('\n  LEGACY `provides` — recorded before 2026-08-12 by a parser that had not stripped comments,');
  console.log('  so it lost the first key after every comment and read four symbols out of prose. Reported,');
  console.log('  not failed, and used for NO verdict above: a release record is immutable and is not');
  console.log('  rewritten to make a check green.');
  for (const l of legacy) console.log('    ' + l);
}

/* THE CORRECTED RECORDER IS SHOWN CORRECT, ON BYTES THAT EXIST, RATHER THAN ASSUMED. Auditing only
 * what has already been written can never exercise a fix — the one legacy record above is by
 * definition the OLD parser's. So the live parser is run against the live engine and compared to what
 * `require()` actually yields. If this goes red, the next release cut will record a wrong `provides`. */
/* Under --staged the COMMIT's engine is judged: its source is compiled at the real module path, so its
 * relative requires resolve as they would after checkout (the modules it pulls in come from disk), and
 * the same source is what the recorder parses. Without the flag this is require() on the live file. */
function stagedExports(abs, src) {
  const m = new Module(abs, module);
  m.filename = abs;
  m.paths = Module._nodeModulePaths(path.dirname(abs));
  m._compile(src, abs);
  return m.exports;
}
{
  const src = DS.rawText(MEDI);
  const live = Object.keys(STAGED ? stagedExports(D(MEDI), src) : require(D(MEDI))).sort();
  const parsed = ER.exportedNames(src);
  const miss = live.filter(k => !parsed.includes(k));
  const extra = parsed.filter(k => !live.includes(k));
  ok(miss.length === 0 && extra.length === 0,
     'the recorder that will stamp the NEXT release agrees with require() on the live engine',
     miss.length || extra.length
       ? 'missed: ' + (miss.join(',') || '-') + ' | invented: ' + (extra.join(',') || '-')
       : parsed.length + ' exports, ' + ER.PROVIDES_BY);
}

/* ---- 5b. THE COMMITTED COPY OF EVERY TRACKED RELEASE HASHES TO ITS MANIFEST -------------------------
 * 2026-09-10 (ROADMAP #554). Five tracked releases opened on the laptop and read MODIFIED on a fresh
 * clone: force-added in August under core.autocrlf before `data/releases/** -text` existed, so git
 * normalised their blobs to LF while the manifests digest the CRLF bytes `cut` copied. The laptop's
 * working copy is stat-clean, so `git status` says nothing and `verify()` passes — the only machine
 * that could see the defect was one that did not have the file. So the INDEX is hashed, not the disk:
 * every blob of every tracked release goes through one `git cat-file --batch` and is sha256'd against
 * the manifest committed beside it. Fails by name, on the laptop, where `git add --renormalize` fixes it. */
{
  const catBatch = (shas) => {
    const r = spawnSync('git', ['cat-file', '--batch'], { cwd: D(), input: shas.join('\n') + '\n', maxBuffer: 1 << 30 });
    if (r.error || r.status !== 0) throw new Error(r.error ? r.error.message : 'git cat-file exit ' + r.status);
    const out = new Map(); const buf = r.stdout; let i = 0;
    while (i < buf.length) {
      const nl = buf.indexOf(10, i); if (nl < 0) break;
      const [sha, type, sz] = buf.slice(i, nl).toString().split(' ');
      if (type !== 'blob') { out.set(sha, null); i = nl + 1; continue; }     /* "missing" has no body */
      const size = +sz; out.set(sha, buf.slice(nl + 1, nl + 1 + size)); i = nl + 1 + size + 1;
    }
    return out;
  };
  const ids = [...GIT.releases].sort();
  const notes = []; let checked = 0, files = 0, pruned = 0; let why = null;
  if (!GIT.ok) why = 'git could not be asked: ' + GIT.why;
  else if (!ids.length) why = 'no release is tracked in git';
  else {
    try {
      const manShas = ids.map(id => GIT.blobs.get('data/releases/' + id + '/release.json'));
      const mans = catBatch(manShas.filter(Boolean));
      const want = [];   /* {id, rel, digest, sha} */
      ids.forEach((id, k) => {
        const body = manShas[k] && mans.get(manShas[k]);
        if (!body) { notes.push(id + ': release.json is not tracked, so the release is tracked in name only'); return; }
        let man; try { man = JSON.parse(body.toString('utf8')); } catch (e) { notes.push(id + ': committed release.json does not parse'); return; }
        /* PRUNED IS A RECORDED DECISION, NOT A DEFECT — the same distinction open() makes. The manifest
         * and cut history are tracked so the release can still PROVE what it froze; its bodies are gone
         * on purpose, here and on every clone alike. Counted, not accused. */
        if (man.bodies_pruned) { pruned++; return; }
        let missing = null;
        for (const [rel, digest] of Object.entries(man.files || {})) {
          const sha = GIT.blobs.get('data/releases/' + id + '/' + rel);
          if (!sha) { if (!missing) missing = rel; continue; }
          want.push({ id, rel, digest, sha });
        }
        if (missing) notes.push(id + ': ' + missing + ' is in the manifest and NOT in git — tracked in name only');
        checked++;
      });
      const blobs = catBatch([...new Set(want.map(w => w.sha))]);
      const firstBad = new Map();
      for (const w of want) {
        files++;
        const b = blobs.get(w.sha);
        const got = b ? crypto.createHash('sha256').update(b).digest('hex').slice(0, 12) : null;
        if (got !== w.digest && !firstBad.has(w.id)) firstBad.set(w.id, w.rel + ' committed ' + got + ', manifest ' + w.digest);
      }
      for (const [id, d] of [...firstBad].sort()) notes.push(id + ': ' + d + ' — the committed copy is not the release');
      if (firstBad.size) notes.push('FIX, on the machine whose working copies verify: git add --renormalize -- '
        + [...firstBad.keys()].sort().map(id => 'data/releases/' + id).join(' ') + '  (then commit; data-only)');
    } catch (e) { why = 'could not read the committed blobs: ' + oneLine(e.message); }
  }
  ok(!why && notes.length === 0,
     'the COMMITTED bytes of every tracked release hash to its manifest (what a clone will get)',
     why ? why + ' — NOT CHECKED, which is not a pass'
         : notes.length ? (notes.length - (notes.some(n => n.startsWith('FIX,')) ? 1 : 0)) + ' of ' + checked
           + ' tracked release(s) BROKEN IN GIT — a clone cannot open them: ' + notes.join(' ;; ')
         : checked + ' tracked release(s), ' + files + ' committed file(s) hashed against their manifests'
           + (pruned ? ', ' + pruned + ' pruned (manifest only, by decision)' : ''));
}

/* ---- 6. THE RATCHET ----------------------------------------------------------------------------- */
const BASE = D('data', 'artifact-rerunnable-baseline.json');
let base = null, baseWhy = null;
/* AN ABSENT BASELINE IS A FIRST RUN. AN UNREADABLE ONE IS NOT, AND READING THEM ALIKE IS HOW A
   RATCHET STOPS RATCHETING WITHOUT SAYING SO: a corrupt file used to fall through to "NO BASELINE —
   run with --stamp", which invites the operator to re-stamp the floor straight over the record of
   what was already stranded. ENOENT is the only forgiven error; anything else is named and refuses
   the overwrite. */
try { base = JSON.parse(DS.rawText('data/artifact-rerunnable-baseline.json')); }
catch (e) {
  baseWhy = (e && e.code === 'ENOENT') ? null : String((e && e.message) || e).split('\n')[0];
}
if (baseWhy) {
  ok(false, 'the ratchet baseline is readable',
     'data/artifact-rerunnable-baseline.json EXISTS AND DID NOT PARSE (' + baseWhy + '). It is NOT a '
     + 'first run: the stranded-release ratchet has no floor to hold this run against.');
}

if (process.argv.includes('--stamp')) {
  if (STAGED) {
    console.error('\n  REFUSING TO --stamp under --staged. The floor is written to the working tree, and a floor '
      + 'derived from the staged tree would describe bytes that are not on disk. Stamp with a plain run.');
    process.exit(2);
  }
  if (absent.length) {
    console.error('\n  REFUSING TO --stamp on a clone with ' + absent.length + ' artifact(s) whose release is ABSENT from this '
      + 'machine. Their verdict is unknown here, so a floor written now would be below the truth and the '
      + 'machine that holds the releases would read it as a regression. Stamp where the releases are.');
    process.exit(2);
  }
  if (baseWhy) {
    console.error('\n  REFUSING TO --stamp over an UNREADABLE baseline (' + baseWhy + '). Stamping now '
      + 'would write a fresh floor over a record nobody has read. Repair or delete the file first.');
    process.exit(2);
  }
  fs.writeFileSync(BASE, JSON.stringify({
    /* First, so engine/conformance.js S13 can see this file is generated (it reads the first 400 bytes). */
    generated_by: 'tests/test-artifact-rerunnable.js --stamp',
    stamped: new Date().toISOString(),
    by: 'tests/test-artifact-rerunnable.js --stamp',
    stranded: bad.length,
    files: bad.map(r => r.file).sort(),
    unknown_producer: unknown.map(r => r.file).sort(),
    why: 'Grandfathered when the check was written. These artifacts name a release that can no longer '
       + 'serve the caller that produced them. They are not recoverable and are not meant to be: re-run '
       + 'them on the current engine, or declare "rerun": false with a reason. The count may only FALL. '
       + 'unknown_producer is recorded for visibility and is NOT part of the ratchet — those artifacts '
       + 'name no readable producer, so this check refuses to accuse them.',
  }, null, 2) + '\n');
  console.log('\n  stamped ' + bad.length + ' stranded (and ' + unknown.length + ' unknown-producer) as the ratchet floor.');
  process.exit(0);
}

if (!base) {
  ok(false, 'a ratchet exists', baseWhy
    ? 'THE BASELINE DID NOT PARSE (' + baseWhy + ') — this is not a first run and not a pass'
    : 'NO BASELINE — run with --stamp to accept the current count deliberately');
} else {
  const known = new Set(base.files || []);
  const fresh = bad.filter(r => !known.has(r.file));
  ok(fresh.length === 0,
     'no artifact became unre-runnable since the baseline',
     fresh.length ? 'NEW: ' + fresh.map(r => r.file + ' — ' + r.detail).join('; ')
                  : bad.length + ' known, was ' + base.stranded);
  if (bad.length < base.stranded && !absent.length) {
    console.log('  note  the ratchet TIGHTENED: ' + base.stranded + ' -> ' + bad.length
      + '. Re-stamp with --stamp so it cannot drift back up.');
  }
}

/* SAY WHICH TREE WAS READ, green or red; the hook echoes this line. It names every path where the working
 * tree differs from the commit and the commit's bytes were judged instead. */
if (STAGED) {
  const r = DS.readerReport();
  console.log('\n(--staged: ' + r.index_entries + ' files in the index; ' + r.verified_on_disk + ' read from disk after their hash '
    + 'matched the staged blob; ' + r.from_index.length + ' read from the index because the working tree differs'
    + (r.from_index.length ? ': ' + r.from_index.slice(0, 12).join(', ') + (r.from_index.length > 12 ? ', … +' + (r.from_index.length - 12) : '') : '')
    + '; callers read from a staged copy of ' + CALLERS_COPIED + ' engine/ and tests/ file(s); data/releases/ read from disk, verified against each manifest)');
  if (r.unreadable.length) console.log('(--staged: ' + r.unreadable.length + ' disk read(s) failed and were answered from the index: ' + r.unreadable.slice(0, 6).join(', ') + ')');
}
console.log('\n' + (fails
  ? 'FAILED: ' + fails + ' of ' + checks
  : 'ALL GREEN — ' + checks + ' checks. Growing a `need` list now costs a visible, named artifact.'));
process.exitCode = fails ? 1 : 0;
