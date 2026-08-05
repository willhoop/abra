/* engine_release.js — a FROZEN engine a measurement can read while other divisions rewrite the live one.
 *
 * WHY THIS EXISTS, with the receipt
 * --------------------------------
 * On 2026-08-04 three division agents ran at once, which is the point of having divisions. Their
 * FILES were separated so they could not clobber each other. The 7,100-game WOBBUFFET run was
 * destroyed anyway:
 *
 *   - `data/policy-weights.json` — MAG itself, the thing being defended — was refitted at 22:15:24,
 *     between a search that froze its opponent at 21:41 and a replay that reloaded it at 22:17. The
 *     two legs of one measurement defended with DIFFERENT weight vectors.
 *   - `engine/medicham2-browser.js` — the simulator every candidate is scored through — showed four
 *     distinct content digests inside eight minutes.
 *
 * Nothing crashed. Nothing reported a failure. The artifact passed every check in
 * `engine/provenance.js`, because that file compared mtimes and the artifact was newer than an input
 * it had never read.
 *
 * THE FIX IS NOT TO RUN ONE AGENT AT A TIME. (Will, 2026-08-04: *"we can run multiple agents at once
 * that's the whole point"*.) Serialising four divisions throws away the reason they were cut apart.
 * `docs/DIVISIONS.md` encodes an invalidation ORDER, and the first response to this failure was to
 * treat that order as a scheduling constraint — which is the weak fix, and it is prose, and this
 * project has learned repeatedly that a rule nobody checks is a preference.
 *
 * The real fix is that **a measurement must not read the live tree at all.** It reads an immutable
 * snapshot. Then ENGINE can rewrite the simulator all night while SEARCH measures, because SEARCH is
 * not reading those bytes — it is reading a release. Concurrency becomes safe rather than forbidden.
 *
 * A SNAPSHOT, NOT A CHECKSUM. Verifying digests at the end would only tell you the run was wasted.
 * That is better than publishing a void number and it is still a wasted run. Copying the files costs
 * a few hundred kilobytes and removes the failure instead of detecting it.
 *
 * USAGE
 *   node engine/engine_release.js cut "why this release exists"   # freeze the tree as it stands
 *   node engine/engine_release.js list
 *   node engine/engine_release.js verify <id>                     # has the snapshot itself rotted?
 *
 * In a measuring script:
 *   const REL = require('./engine_release.js').open();             # newest release
 *   const MEDI = REL.require('engine/medicham2-browser.js');       # from the SNAPSHOT
 *   ... REL.stamp()  -> put this in the artifact; it names exactly what was measured
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const RELEASES = D('data', 'releases');
const POINTER = D('data', 'engine-release.json');

/* WHAT AN ENGINE IS, FOR THE PURPOSE OF A MEASUREMENT.
 *
 * Every file whose CONTENT can change a number a measurement reports. Two things are easy to leave
 * out and both were live causes on 2026-08-04:
 *   - the DATA the engine reads through globals (`engine-data.js`, `abra-tags.js`, `tags.json`) —
 *     the mega ability gap was an artifact defect, not a code defect, and it changed every damage row;
 *   - the WEIGHTS (`policy-weights.json`), because a measurement of "can anything beat MAG" is a
 *     statement about a specific vector. That is the file that actually moved.
 *
 * Listed explicitly rather than globbed: a glob over `engine/` would sweep in the fitters and the
 * one-off scripts, and a release that changes whenever an unrelated tool is edited is a release
 * nobody cuts. */
const SOURCES = [
  'engine/medicham2-browser.js',
  'engine/board.js',
  'engine/rollout_leaf.js',
  'engine/position_features.js',
  'engine/tags.js',
  'engine/champions_sim.js',
  /* THE LOADER CLOSURE, added 2026-08-05 (filed in docs/SEARCH.md R9). Without these six,
   * `REL.require('engine/board.js')` threw `Cannot find module './mc_key.js'` for 4 of the 12
   * frozen sources, so the release was a valid DIGEST SET and not a loadable ENGINE — and every
   * measuring script had to fall back to reading the live tree "after proving zero drift", which
   * stops being safe the day someone passes --allow-drift. Each of these can change a number:
   * mc_key decides which dex row a species resolves to, lookup is the path underneath it,
   * set_priors/smogon_priors decide what an unknown set is filled with, quality decides the team
   * pool, showdown_path decides which Showdown checkout loads. Adding them changes every FUTURE
   * release id; existing releases carry their own manifests and are untouched. */
  'engine/mc_key.js',
  'engine/lookup.js',
  'engine/set_priors.js',
  'engine/smogon_priors.js',
  'engine/quality.js',
  'engine/showdown_path.js',
  /* THE LAZY DATA READS, found by RUNNING from a snapshot rather than by loading it. medicham2
   * requires data/move-effects.js relative to its own __dirname the first time a priority is asked
   * (the R1 smoke run crashed there); board.js reads ability-blocks.json and smogon-priors.json
   * through loadData with strict-miss semantics, so from a snapshot they would THROW, not degrade;
   * regulations.json names the format champions_sim loads; quality-filter.json IS the definition of
   * a usable game. Every one changes a number. A release that loads but cannot RUN is the same hole
   * one layer down. */
  'data/move-effects.js',
  'data/ability-blocks.json',
  'data/smogon-priors.json',
  'data/regulations.json',
  'data/quality-filter.json',
  'data/engine-data.js',
  'data/abra-tags.js',
  'data/tags.json',
  'data/policy-weights.json',
  'data/policy-weights-joint.json',
  'data/move-priors.json',
];

/* THROWS RATHER THAN RETURNING null. A null digest inside a manifest is the worst possible value:
 * `verify()` would compare null against null and PASS, so a release frozen over an unreadable file
 * would certify itself. A release is the one thing in this repo that must not be approximately right. */
function sha12(abs) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 12); }
  catch (e) { throw new Error('cannot digest ' + abs + ' — ' + e.message); }
}
/* Only `drift()` and `verify()` may tolerate an unreadable file, because "it is gone" is a real and
 * reportable answer there: both compare the null against a manifest digest, so it always reads as a
 * MISMATCH, never as unchanged. The miss is still said out loud here, because a caller reporting
 * "moved" for a file that is actually GONE is answering with less than it knows. */
function sha12OrNull(abs) {
  try { return sha12(abs); }
  catch (e) { console.error('  (cannot digest ' + abs + ': ' + e.message + ' — scored as a mismatch)'); return null; }
}

/* The pinned Showdown commit belongs in the release too. A measurement scored against a different
 * reference engine is a different measurement, and `champions_sim.js` already reads the real commit
 * from git rather than trusting its own constant. */
function showdownCommit() {
  try { return require('./champions_sim.js').actualCommit ? require('./champions_sim.js').actualCommit() : null; }
  /* UNKNOWN is printed as UNKNOWN by the caller and never as a match — champions_sim's own header
   * makes that point about this exact field. The reason still goes somewhere a person can see it. */
  catch (e) { console.error('  (could not read the Showdown commit: ' + e.message + ')'); return null; }
}

function cut(why) {
  const files = {};
  const missing = [];
  for (const rel of SOURCES) {
    const abs = D(rel);
    if (!fs.existsSync(abs)) { missing.push(rel); continue; }
    files[rel] = sha12(abs);
  }
  /* A RELEASE CUT OVER A MISSING SOURCE IS NOT A RELEASE. Silently freezing eleven of twelve files
   * produces a snapshot that loads and measures and is not the engine. */
  if (missing.length) {
    throw new Error('cannot cut a release — these sources do not exist: ' + missing.join(', ')
      + '\nEither the list in engine_release.js is stale or the tree is mid-write.');
  }
  /* The ID is the digest OF THE DIGESTS, so an identical tree always yields an identical release id
   * and cutting twice in a row is a no-op rather than a second copy. */
  const id = crypto.createHash('sha256')
    .update(SOURCES.map(r => r + ':' + files[r]).join('\n')).digest('hex').slice(0, 12);
  const dir = path.join(RELEASES, id);

  if (!fs.existsSync(dir)) {
    for (const rel of SOURCES) {
      const dst = path.join(dir, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(D(rel), dst);
    }
  }
  const manifest = {
    id,
    cut: new Date().toISOString(),
    why: why || '(no reason given)',
    showdown_commit: showdownCommit(),
    files,
    note: 'IMMUTABLE. A measurement reads these bytes, not the live tree, so other divisions may keep '
        + 'working while it runs. Re-cutting an identical tree returns this same id.',
  };
  fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(POINTER, JSON.stringify({
    current: id,
    cut: manifest.cut,
    why: manifest.why,
    note: 'Pointer to the newest release under data/releases/. Measurements should open a release '
        + 'explicitly by id when they want to reproduce an old number.',
  }, null, 2) + '\n');
  return manifest;
}

function list() {
  try { return fs.readdirSync(RELEASES).filter(d => fs.existsSync(path.join(RELEASES, d, 'release.json'))); }
  /* An empty list and an unreadable releases directory are different, and only the first means
   * "none cut yet". Collapsing them would report a wiped release store as a fresh install. */
  catch (e) {
    if (e.code !== 'ENOENT') console.error('  (could not read ' + RELEASES + ': ' + e.message + ')');
    return [];
  }
}

/* HAS THE SNAPSHOT ITSELF ROTTED? An immutable directory is immutable by convention, and convention
 * is what this whole file exists to stop relying on. Cheap enough to run before every measurement. */
function verify(id) {
  const dir = path.join(RELEASES, id);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8'));
  const bad = [];
  for (const [rel, want] of Object.entries(m.files)) {
    const got = sha12OrNull(path.join(dir, rel));
    if (got !== want) bad.push(`${rel}: manifest says ${want}, snapshot is ${got}`);
  }
  return { ok: bad.length === 0, id, bad, manifest: m };
}

/* HOW FAR THE LIVE TREE HAS MOVED SINCE A RELEASE. Not an error — it is the normal state, and it is
 * the number that says whether a published measurement still describes the engine we ship. */
function drift(id) {
  const m = JSON.parse(fs.readFileSync(path.join(RELEASES, id, 'release.json'), 'utf8'));
  const moved = [];
  for (const [rel, want] of Object.entries(m.files)) {
    const got = sha12OrNull(D(rel));
    if (got !== want) moved.push(rel);
  }
  return moved;
}

function open(id) {
  if (!id) {
    /* A CORRUPT POINTER MUST NOT LOOK LIKE "NO RELEASE YET". The message below tells the caller to
     * cut one, which over a damaged pointer would create a SECOND release and silently change what a
     * measurement is scored against. */
    try { id = JSON.parse(fs.readFileSync(POINTER, 'utf8')).current; }
    catch (e) {
      if (fs.existsSync(POINTER)) throw new Error('data/engine-release.json exists but cannot be read: ' + e.message);
      id = null;
    }
  }
  if (!id) throw new Error('no engine release has been cut. Run: node engine/engine_release.js cut "<why>"');
  const v = verify(id);
  if (!v.ok) throw new Error('release ' + id + ' has been MODIFIED since it was cut:\n  ' + v.bad.join('\n  '));
  const dir = path.join(RELEASES, id);
  return {
    id,
    dir,
    manifest: v.manifest,
    /* Loads from the SNAPSHOT. A measuring script that calls this cannot be affected by another
     * division editing the live file, which is the entire point. */
    require(rel) { return require(path.join(dir, rel)); },
    path(rel) { return path.join(dir, rel); },
    read(rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); },
    /* Goes straight into the artifact. `engine/provenance.js` reads `source_digests` and will now
     * verify it by CONTENT rather than by mtime. */
    stamp() {
      return {
        engine_release: id,
        engine_release_cut: v.manifest.cut,
        showdown_commit: v.manifest.showdown_commit,
        source_digests: Object.assign({}, v.manifest.files),
      };
    },
  };
}

module.exports = { cut, list, verify, drift, open, SOURCES, POINTER, RELEASES };

if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'cut') {
    const m = cut(arg);
    console.log(`cut engine release ${m.id}`);
    console.log(`  why: ${m.why}`);
    console.log(`  showdown: ${m.showdown_commit || 'UNKNOWN'}`);
    for (const [r, d] of Object.entries(m.files)) console.log('  ' + d + '  ' + r);
    console.log(`\n  ${Object.keys(m.files).length} files frozen under data/releases/${m.id}/`);
    console.log('  A measurement opens this and reads THESE bytes, so other divisions may keep working.');
  } else if (cmd === 'list') {
    const ids = list();
    if (!ids.length) { console.log('no releases cut yet'); process.exit(0); }
    /* A missing or corrupt pointer only costs the `*` marker on this listing, but a corrupt one is
     * still worth a line: `open()` will refuse it, and this is where a person would look first. */
    let cur = null;
    try { cur = JSON.parse(fs.readFileSync(POINTER, 'utf8')).current; }
    catch (e) { console.error('  (no readable release pointer at ' + POINTER + ': ' + e.message + ')'); }
    for (const id of ids) {
      const m = JSON.parse(fs.readFileSync(path.join(RELEASES, id, 'release.json'), 'utf8'));
      const moved = drift(id);
      console.log(`${id === cur ? '*' : ' '} ${id}  ${m.cut}  ${moved.length} of ${Object.keys(m.files).length} files have moved since`);
      console.log(`    ${m.why}`);
    }
  } else if (cmd === 'verify') {
    const v = verify(arg || (JSON.parse(fs.readFileSync(POINTER, 'utf8')).current));
    console.log(v.ok ? `release ${v.id} is intact` : `release ${v.id} is MODIFIED:\n  ${v.bad.join('\n  ')}`);
    process.exit(v.ok ? 0 : 1);
  } else {
    console.log('usage: engine_release.js cut "<why>" | list | verify [id]');
    process.exit(2);
  }
}
