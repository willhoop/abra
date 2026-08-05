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
 * CUTTING TWICE OVER AN UNCHANGED TREE IS NOT A NO-OP, AND SAYING IT WAS COST A RECORD. The id is
 * the digest of the file digests, so an identical tree always yields an identical id — true, and it
 * is only true of the BYTES. Until 2026-08-05 the second cut also rewrote `cut` and `why` in
 * `release.json`, so the first cut's time and reason were destroyed. See the cut-log comment above
 * `cut()` for the receipt. A cut is now an EVENT appended to `cuts.jsonl`; `cut`/`why` mean the FIRST
 * freeze of these bytes and are never overwritten.
 *
 * USAGE
 *   node engine/engine_release.js cut "why this release exists"   # freeze the tree as it stands
 *   node engine/engine_release.js list
 *   node engine/engine_release.js verify <id>                     # has the snapshot itself rotted?
 *   node engine/engine_release.js rerender <id>                   # redraw release.json from cuts.jsonl
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

/* WHERE THE RELEASE STORE LIVES, and why every entry point takes an optional `{store}`.
 *
 * `cut()` WRITES: a snapshot directory and the pointer file that says which release a measurement
 * opens by default. A test that exercises cut() against the real store therefore REPOINTS the live
 * pointer while another division may be measuring through it — the exact class of failure this file
 * exists to prevent, arriving through the test. So `tests/test-engine-release.js` passes a
 * throwaway store and the real one is never written by a test.
 *
 * NOT an environment variable and NOT a fallback: an override is passed explicitly by a caller, the
 * CLI never passes one, and every call that uses one SAYS SO on stderr. A silent default here would
 * look exactly like a working release store while writing somewhere nobody reads. */
function store(opts) {
  const s = opts && opts.store;
  if (!s) return { releases: RELEASES, pointer: POINTER };
  console.error('  (release store OVERRIDDEN -> ' + s + '  — the real store at ' + RELEASES + ' is untouched)');
  return { releases: path.join(s, 'releases'), pointer: path.join(s, 'engine-release.json') };
}

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

/* THE CUT LOG — why a release has an append-only event list instead of a `cut` field.
 *
 * THE RECEIPT. On 2026-08-05 the same tree was cut twice: 02:12:57Z by SEARCH ("h60 log leg of the
 * R1 explore-sweep re-run — cut immediately before the run because ENGINE lands roughly every half
 * hour") and 02:26:04Z by the router ("R10/click-censoring parallel session"). Both produced id
 * `09acd3b404ef`. Exactly two lines of `release.json` changed and NONE of the 23 digests, so no
 * measurement was corrupted — and the first cut's time and reason were gone. Every artifact SEARCH
 * had already stamped `09acd3b404ef` then pointed at a record claiming a freeze THIRTEEN MINUTES
 * AFTER the run that read it, for an unrelated purpose. That is the "newer than an input it never
 * read" shape that cost this repo a 7,100-game measurement.
 *
 * The old comment called a second cut "a no-op". True of the frozen BYTES, false of the RECORD.
 *
 * A LIST, NOT A FIELD, AND A LOG, NOT AN ARRAY IN A JSON DOCUMENT. Each cut appends one line to
 * `cuts.jsonl`; `release.json`'s `cuts` array is a RENDERING of that log. An append cannot lose an
 * earlier line, which a read-modify-write of a JSON array can under two concurrent cuts — and two
 * agents cutting at once is the normal state here, since that is literally what happened. `cut` and
 * `why` stay at the top level and now mean the FIRST freeze of these bytes, which is the only
 * reading under which an artifact can never be older than the release it names.
 *
 * WHAT A RACE CAN STILL COST, stated rather than papered over: two simultaneous cuts both append,
 * and the slower render can be written from a read taken before the other's line landed — so
 * `release.json`'s `cuts[]` may lag the log by one event until the next cut. The HISTORY is never
 * lost, only the rendering, and `rerender` redraws it. That is a deliberately cheap trade against a
 * lock file, whose failure mode (a stale lock blocking a cut at 2am) is worse than a stale render. */
function eventsPath(dir) { return path.join(dir, 'cuts.jsonl'); }

/* WRITE THE RECORD IN ONE STEP. Two agents cutting at once is the normal state here — it is what
 * produced this bug — and a measurement that opens a release halfway through a plain writeFileSync
 * reads a truncated JSON document and throws for a reason that has nothing to do with it. Rename
 * over an existing path is atomic on both platforms (libuv uses MoveFileEx REPLACE_EXISTING). */
function writeJsonAtomic(file, obj) {
  const tmp = file + '.tmp' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function appendEvent(dir, ev) { fs.appendFileSync(eventsPath(dir), JSON.stringify(ev) + '\n'); }

/* An unparsable line is KEPT as a placeholder and shouted about, never dropped. Dropping it would
 * silently shorten the history, which is the same class of loss this file was built to stop. */
function readEvents(dir) {
  let raw;
  /* ENOENT is the ordinary state of a release cut before cuts.jsonl existed — genuinely no history,
   * and an empty list is the right answer. Any OTHER read failure means the history is THERE and
   * unreadable, which is the opposite fact, and returning [] for both would quietly report a
   * release as having never been re-cut when its record was merely unopenable. */
  try { raw = fs.readFileSync(eventsPath(dir), 'utf8'); }
  catch (readErr) {
    if (readErr.code !== 'ENOENT') {
      console.error('  !! cannot read the cut history at ' + eventsPath(dir) + ' — ' + readErr.message
        + '\n     Reporting NO history for this release; it may have one. Do not read that as never re-cut.');
    }
    return [];
  }
  return raw.split('\n').filter(l => l.trim()).map(line => {
    try { return JSON.parse(line); }
    catch (e) {
      console.error('  !! unreadable cut record in ' + eventsPath(dir) + ': ' + line.slice(0, 120));
      return { at: null, why: '(UNPARSABLE CUT RECORD — see cuts.jsonl)', unparsable: true };
    }
  });
}

/* A record written before the cut log existed (the seven releases on disk on 2026-08-05) knows one
 * cut and nothing about the list. Its own claim becomes event 0, MARKED `reconstructed` so nobody
 * reads it as observed — and marked rather than silently promoted, because for `09acd3b404ef` that
 * value is the SECOND cut wearing the first one's slot, and the mark is what says so. */
function seedEventsFromRecord(dir, prev) {
  if (!prev) return;
  appendEvent(dir, {
    at: prev.cut || null,
    why: prev.why || '(no reason given)',
    showdown_commit: prev.showdown_commit || null,
    reconstructed: true,
    note: 'rebuilt from release.json, which is all this release recorded before cut events existed',
  });
}

function cut(why, opts) {
  const S = store(opts);
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
   * and cutting twice in a row reuses this directory rather than making a second copy. NOT "a no-op"
   * — that wording is what licensed the record being overwritten; see the cut-log comment above. */
  const id = crypto.createHash('sha256')
    .update(SOURCES.map(r => r + ':' + files[r]).join('\n')).digest('hex').slice(0, 12);
  const dir = path.join(S.releases, id);

  /* THE SNAPSHOT COPIES, CHECKED PER FILE. This used to be `if (!fs.existsSync(dir))` around the
   * whole loop, so a release whose snapshot was incomplete (an interrupted first cut) or had rotted
   * on disk stayed broken through every later cut while the cut reported success — the same overwrite
   * hazard one layer down, in the direction of NOT writing. The live bytes are byte-identical to the
   * frozen ones by construction here (that is what makes the id equal), so restoring is safe; doing
   * it QUIETLY would not be, because a rotted snapshot means any measurement that read it is void. */
  const repaired = [];
  for (const rel of SOURCES) {
    const dst = path.join(dir, rel);
    const have = fs.existsSync(dst) ? sha12(dst) : null;
    if (have === files[rel]) continue;
    if (have !== null) {
      console.error('  !! SNAPSHOT ROT: ' + rel + ' in release ' + id + ' reads ' + have + ', the frozen bytes are '
        + files[rel] + '. Restoring from the live tree, which is byte-identical. open() would have REFUSED this '
        + 'release, so nothing measured against the rotted copy — but the repair is recorded in the cut event.');
      repaired.push(rel);
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(D(rel), dst);
  }

  /* THE EXISTING RECORD IS READ, NEVER ASSUMED ABSENT. */
  const recPath = path.join(dir, 'release.json');
  let prev = null;
  if (fs.existsSync(recPath)) {
    try { prev = JSON.parse(fs.readFileSync(recPath, 'utf8')); }
    /* Refuse rather than replace. A record is the only history a release has, and an unreadable one
     * is a finding; overwriting it would destroy the evidence of whatever made it unreadable. */
    catch (e) {
      throw new Error('release ' + id + ' has a release.json that cannot be parsed: ' + e.message
        + '\nRefusing to overwrite it. Move it aside by hand if it is genuinely rubbish.');
    }
    /* SAME ID MUST MEAN SAME DIGESTS — the id IS the hash of them. If they disagree, the record was
     * hand-edited (or SOURCES changed under a stored release), and writing over it would launder
     * that away in exactly the manner this whole fix exists to stop. */
    const pf = prev.files || {};
    const disagree = SOURCES.filter(k => pf[k] !== files[k]).concat(Object.keys(pf).filter(k => !(k in files)));
    if (disagree.length) {
      throw new Error('release ' + id + ' already exists and its manifest digests DISAGREE with the tree just '
        + 'hashed: ' + disagree.join(', ') + '\nThe id is the digest of the digests, so this cannot happen by '
        + 'accident — the record has been edited. Refusing to overwrite it.');
    }
  }

  /* THE EVENT. Appended before the record is rendered, so a crash between the two loses the RENDER
   * and never the HISTORY. */
  if (!fs.existsSync(eventsPath(dir))) seedEventsFromRecord(dir, prev);
  const sc = showdownCommit();
  appendEvent(dir, Object.assign(
    { at: new Date().toISOString(), why: why || '(no reason given)', showdown_commit: sc },
    repaired.length ? { repaired } : {}));

  const events = readEvents(dir);
  const first = events[0] || {};
  /* THE REFERENCE ENGINE CAN MOVE WHILE THE FROZEN BYTES DO NOT, and that makes the two cuts
   * different measurements against the same snapshot. Said out loud rather than silently resolved
   * one way; `showdown_commit` stays the first cut's, and the event list carries the rest. */
  if (first.showdown_commit && sc && first.showdown_commit !== sc) {
    console.error('  !! this tree was first frozen against Showdown ' + first.showdown_commit + ' and is being '
      + 're-cut against ' + sc + '. Same bytes, DIFFERENT reference engine — a number measured under one is '
      + 'not comparable with a number measured under the other. Both are in cuts[].');
  }

  const manifest = {
    id,
    /* THE FIRST FREEZE OF THESE BYTES, and never rewritten. Under any other reading an artifact can
     * end up older than the release it names, which is what happened on 2026-08-05. */
    cut: first.at,
    why: first.why,
    showdown_commit: first.showdown_commit || null,
    cuts: events,
    files,
    note: 'IMMUTABLE. A measurement reads these bytes, not the live tree, so other divisions may keep '
        + 'working while it runs. Re-cutting an identical tree returns this same id and APPENDS to cuts[]; '
        + '`cut` and `why` are the FIRST freeze of these bytes and are never overwritten. The event log is '
        + 'cuts.jsonl beside this file and is the source of truth for cuts[].',
  };
  writeJsonAtomic(recPath, manifest);
  /* THE POINTER IS THE ONE FILE THAT IS SUPPOSED TO BE OVERWRITTEN — it points at the newest release
   * and that is its whole job. What it must not do is invent a cut time: it mirrors the FIRST freeze,
   * so it can never disagree with the record it points at. When it re-points somewhere else, the
   * release it left behind still holds its own full history. */
  writeJsonAtomic(S.pointer, {
    current: id,
    cut: manifest.cut,
    why: manifest.why,
    cuts: events.length,
    latest_cut: (events[events.length - 1] || {}).at,
    latest_why: (events[events.length - 1] || {}).why,
    pointer_written: new Date().toISOString(),
    note: 'Pointer to the newest release under data/releases/. `cut`/`why` are that release\'s FIRST freeze; '
        + '`latest_*` is the most recent cut of the same unchanged tree. Measurements should open a release '
        + 'explicitly by id when they want to reproduce an old number.',
  });
  return manifest;
}

/* RE-RENDER release.json FROM ITS CUT LOG, touching nothing else.
 *
 * `cuts.jsonl` is the source of truth for the history and `release.json` is a rendering of it, so
 * there has to be a way to redraw the rendering without cutting. Two uses, and neither is a cut:
 *   - migrating a release written before the log existed;
 *   - landing a cut record that was LOST to the overwrite this file's cut() now prevents — the line
 *     goes into cuts.jsonl and this redraws the top of the record from it.
 * `id`, `files` and the snapshot bytes are copied through untouched: this function cannot change what
 * a release IS, only what it says about when and why it was frozen. */
function rerender(id, opts) {
  const dir = path.join(store(opts).releases, id);
  const recPath = path.join(dir, 'release.json');
  const m = JSON.parse(fs.readFileSync(recPath, 'utf8'));
  const events = readEvents(dir);
  if (!events.length) throw new Error('release ' + id + ' has no cuts.jsonl to render from');
  const before = { cut: m.cut, why: m.why };
  /* Rebuilt in the same key order a cut writes, so a hand diff of two records lines up. */
  const out = {
    id: m.id,
    cut: events[0].at,
    why: events[0].why,
    showdown_commit: events[0].showdown_commit || m.showdown_commit || null,
    cuts: events,
    files: m.files,
    note: m.note,
  };
  writeJsonAtomic(recPath, out);
  return { id, before, after: { cut: out.cut, why: out.why }, cuts: events.length };
}

function list(opts) {
  const RELEASES = store(opts).releases;
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
function verify(id, opts) {
  const dir = path.join(store(opts).releases, id);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8'));
  /* A PRE-EVENT-LIST RECORD IS NORMALISED FOR THE READER AND NOT REWRITTEN ON DISK. A reader that
   * has to ask "does this release have a cuts[] or not" will eventually forget to, so every caller
   * of verify()/open() sees the list shape. Rewriting the file instead would mean `verify` — the one
   * function whose job is to say whether a release has been touched — touching every release it
   * reads, and would stamp a fabricated `at` on a cut nobody observed. */
  if (!Array.isArray(m.cuts)) {
    m.cuts = [{ at: m.cut || null, why: m.why || '(no reason given)',
                showdown_commit: m.showdown_commit || null, reconstructed: true,
                note: 'this release predates the cut log; release.json is all it recorded' }];
  }
  const bad = [];
  for (const [rel, want] of Object.entries(m.files)) {
    const got = sha12OrNull(path.join(dir, rel));
    if (got !== want) bad.push(`${rel}: manifest says ${want}, snapshot is ${got}`);
  }
  return { ok: bad.length === 0, id, bad, manifest: m };
}

/* HOW FAR THE LIVE TREE HAS MOVED SINCE A RELEASE. Not an error — it is the normal state, and it is
 * the number that says whether a published measurement still describes the engine we ship. */
function drift(id, opts) {
  const m = JSON.parse(fs.readFileSync(path.join(store(opts).releases, id, 'release.json'), 'utf8'));
  const moved = [];
  for (const [rel, want] of Object.entries(m.files)) {
    const got = sha12OrNull(D(rel));
    if (got !== want) moved.push(rel);
  }
  return moved;
}

function open(id, opts) {
  const S = store(opts);
  const POINTER = S.pointer;
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
  const v = verify(id, opts);
  if (!v.ok) throw new Error('release ' + id + ' has been MODIFIED since it was cut:\n  ' + v.bad.join('\n  '));
  const dir = path.join(S.releases, id);
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
     * verify it by CONTENT rather than by mtime.
     *
     * WHICH BYTES WAS THIS MEASURED AGAINST — answered by `engine_release` and, independently of any
     * record on disk, by `source_digests`, which is the full digest set and is what the id is the
     * hash of. `engine_release_cut` is the FIRST freeze of those bytes, so it is always <= the time
     * the artifact was written; before 2026-08-05 a later cut of the same tree could push it PAST
     * the run that read it. `engine_release_cuts` says how many times this tree has been frozen, so a
     * reader who sees anything but 1 knows to read cuts[] rather than assume one purpose. */
    stamp() {
      return {
        engine_release: id,
        engine_release_cut: v.manifest.cut,
        engine_release_cuts: (v.manifest.cuts || []).length,
        showdown_commit: v.manifest.showdown_commit,
        source_digests: Object.assign({}, v.manifest.files),
      };
    },
  };
}

/* sha12 IS EXPORTED BECAUSE THREE OTHER FILES HAD COPIED IT, AND ALL THREE COPIED THE OLD BUG.
 * `engine/em_validation.js` (twice) and `engine/click_census.js` each carried
 *   `try { ...digest... } catch (e) { return null; }`
 * which is exactly the defect the comment above this function describes: two unreadable files
 * produce two nulls, the nulls compare EQUAL, and a stamp certifies itself over a file nobody could
 * read. That is the FACTS ARE GLOBAL rule in CLAUDE.md — how to hash a file is a fact, not a
 * per-model choice, and four implementations of it will disagree eventually while all four keep
 * working. One implementation, everyone calls it. */
module.exports = { cut, list, verify, drift, open, rerender, sha12, sha12OrNull, SOURCES, POINTER, RELEASES };

if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'cut') {
    const m = cut(arg);
    const n = (m.cuts || []).length;
    console.log(`cut engine release ${m.id}`);
    console.log(`  first frozen: ${m.cut}`);
    console.log(`  why:          ${m.why}`);
    console.log(`  showdown:     ${m.showdown_commit || 'UNKNOWN'}`);
    for (const [r, d] of Object.entries(m.files)) console.log('  ' + d + '  ' + r);
    console.log(`\n  ${Object.keys(m.files).length} files frozen under data/releases/${m.id}/`);
    /* SAY IT WHEN THE TREE WAS ALREADY FROZEN. "Re-cutting is a no-op" was true of the bytes and
     * false of the record, and the person at the terminal is the one who can tell whether they meant
     * to cut a new release and got an old one back. */
    if (n > 1) {
      console.log(`\n  THIS TREE WAS ALREADY FROZEN — this is cut ${n} of the same bytes, appended, nothing overwritten:`);
      for (const e of m.cuts) console.log(`    ${e.at}  ${e.reconstructed ? '(reconstructed) ' : ''}${e.why}`);
      console.log('  Every number stamped with this id was measured against these same digests.');
    }
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
      const cuts = Array.isArray(m.cuts) ? m.cuts : null;
      console.log(`${id === cur ? '*' : ' '} ${id}  ${m.cut}  ${moved.length} of ${Object.keys(m.files).length} files have moved since`);
      console.log(`    ${m.why}`);
      /* The later cuts of the same bytes are printed too, because an artifact stamped with this id
       * may belong to any of them and the reader is entitled to know there was more than one. */
      if (cuts && cuts.length > 1) for (const e of cuts.slice(1)) console.log(`    + re-cut ${e.at}  ${e.why}`);
    }
  } else if (cmd === 'verify') {
    const v = verify(arg || (JSON.parse(fs.readFileSync(POINTER, 'utf8')).current));
    console.log(v.ok ? `release ${v.id} is intact` : `release ${v.id} is MODIFIED:\n  ${v.bad.join('\n  ')}`);
    process.exit(v.ok ? 0 : 1);
  } else if (cmd === 'rerender') {
    const res = rerender(arg || (JSON.parse(fs.readFileSync(POINTER, 'utf8')).current));
    console.log(`re-rendered ${res.id} from its cut log (${res.cuts} cut(s))`);
    console.log(`  was: ${res.before.cut}  ${res.before.why}`);
    console.log(`  now: ${res.after.cut}  ${res.after.why}`);
    console.log('  digests and snapshot bytes untouched — this redraws the record, it does not cut.');
  } else {
    console.log('usage: engine_release.js cut "<why>" | list | verify [id] | rerender [id]');
    process.exit(2);
  }
}
