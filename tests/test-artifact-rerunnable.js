/* AN ARTIFACT WHOSE RELEASE CANNOT BE OPENED IS UNFALSIFIABLE, AND IT LOOKS EXACTLY LIKE A LIVE ONE.
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
 *   node tests/test-artifact-rerunnable.js
 *   node tests/test-artifact-rerunnable.js --stamp   # accept the current count as the new ratchet
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const ER = require(D('engine', 'engine_release.js'));

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
function requirementTable() {
  const errs = [];
  const rows = [];
  const e = ER.callerNeeds();                       /* defaults to engine/ */
  if (e.error) errs.push(e.error);
  rows.push(...e.rows);
  /* tests/ is scanned too, because tests/roster.js and tests/mutation_harness.js produce ten of the
   * artifacts below. `callerNeeds` hard-codes the 'engine/' prefix on the caller name, so the label
   * is corrected here from the directory that was actually scanned — the ROWS are the authority's,
   * only the name is repaired. Fixing the prefix inside engine_release.js is the right home for it
   * and is filed rather than done while other divisions are live in that file. */
  const t = ER.callerNeeds(D('tests'));
  if (t.error) errs.push(t.error);
  rows.push(...t.rows.map(r => ({ ...r, caller: 'tests/' + path.basename(r.caller) })));

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
  for (const f of fs.readdirSync(D('data')).filter(x => /\.json$/.test(x))) {
    /* AN UNREADABLE ARTIFACT USED TO DROP OUT OF THIS SCAN ENTIRELY, so a corrupt file that names a
       stranded release escaped the check while the run stayed green. It is bucketed and named, next
       to `prose` and `scratch`, because a scanner that could not read a file may not report that
       file clean. */
    let j; try { j = JSON.parse(fs.readFileSync(D('data', f), 'utf8')); }
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
  if (o.err) return { band: 'STRANDED', detail: 'the release will not open — ' + oneLine(o.err) };
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
const ORDER = { 'STRANDED': 0, 'UNKNOWN-PRODUCER': 1, 'RETIRED': 2, 'RE-RUNNABLE': 3 };
for (const r of [...rows].sort((x, y) => ORDER[x.band] - ORDER[y.band] || x.file.localeCompare(y.file))) {
  console.log('  ' + r.band.padEnd(17) + r.id + '  ' + r.file.padEnd(48)
    + (r.producer || '(no by)').padEnd(34) + (r.detail || ''));
}

const bad = rows.filter(r => r.band === 'STRANDED');
const unknown = rows.filter(r => r.band === 'UNKNOWN-PRODUCER');
console.log('\n  ' + rows.length + ' stamped artifact(s) over ' + new Set(rows.map(r => r.id)).size + ' release(s):  '
  + rows.filter(r => r.band === 'RE-RUNNABLE').length + ' re-runnable, '
  + rows.filter(r => r.band === 'RETIRED').length + ' retired, '
  + unknown.length + ' unknown-producer, ' + bad.length + ' STRANDED and undeclared.');

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
{
  const live = Object.keys(require(D(MEDI))).sort();
  const parsed = ER.exportedNames(fs.readFileSync(D(MEDI), 'utf8'));
  const miss = live.filter(k => !parsed.includes(k));
  const extra = parsed.filter(k => !live.includes(k));
  ok(miss.length === 0 && extra.length === 0,
     'the recorder that will stamp the NEXT release agrees with require() on the live engine',
     miss.length || extra.length
       ? 'missed: ' + (miss.join(',') || '-') + ' | invented: ' + (extra.join(',') || '-')
       : parsed.length + ' exports, ' + ER.PROVIDES_BY);
}

/* ---- 6. THE RATCHET ----------------------------------------------------------------------------- */
const BASE = D('data', 'artifact-rerunnable-baseline.json');
let base = null, baseWhy = null;
/* AN ABSENT BASELINE IS A FIRST RUN. AN UNREADABLE ONE IS NOT, AND READING THEM ALIKE IS HOW A
   RATCHET STOPS RATCHETING WITHOUT SAYING SO: a corrupt file used to fall through to "NO BASELINE —
   run with --stamp", which invites the operator to re-stamp the floor straight over the record of
   what was already stranded. ENOENT is the only forgiven error; anything else is named and refuses
   the overwrite. */
try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')); }
catch (e) {
  baseWhy = (e && e.code === 'ENOENT') ? null : String((e && e.message) || e).split('\n')[0];
}
if (baseWhy) {
  ok(false, 'the ratchet baseline is readable',
     'data/artifact-rerunnable-baseline.json EXISTS AND DID NOT PARSE (' + baseWhy + '). It is NOT a '
     + 'first run: the stranded-release ratchet has no floor to hold this run against.');
}

if (process.argv.includes('--stamp')) {
  if (baseWhy) {
    console.error('\n  REFUSING TO --stamp over an UNREADABLE baseline (' + baseWhy + '). Stamping now '
      + 'would write a fresh floor over a record nobody has read. Repair or delete the file first.');
    process.exit(2);
  }
  fs.writeFileSync(BASE, JSON.stringify({
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
  if (bad.length < base.stranded) {
    console.log('  note  the ratchet TIGHTENED: ' + base.stranded + ' -> ' + bad.length
      + '. Re-stamp with --stamp so it cannot drift back up.');
  }
}

console.log('\n' + (fails
  ? 'FAILED: ' + fails + ' of ' + checks
  : 'ALL GREEN — ' + checks + ' checks. Growing a `need` list now costs a visible, named artifact.'));
process.exitCode = fails ? 1 : 0;
