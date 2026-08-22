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
 *   node engine/engine_release.js compat <file> [symbol ...]      # which releases can a caller open?
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
  /* THE RESIDUAL ORDER TABLE, added 2026-08-12 (ROADMAP #221). `medicham2-browser.js` reads
   * `data/residual-order.json` to build RESIDUAL_GROUPS — the sequence its end-of-turn walk runs in —
   * so the table is not documentation about the engine, it IS part of the engine. A release without it
   * verifies, opens, and then throws `Cannot find module` the first time a battle reaches a residual.
   *
   * THE GUARD FOUND THIS, NOT A CRASHING RUN, WHICH IS THE FIRST TIME. mc_key (2026-08-05),
   * move-effects (2026-08-05) and pp.js (2026-08-10) were each discovered by a measurement blowing up
   * mid-flight; this one was refused at the cut, minutes after the dependency was introduced and
   * before a single game was played against it. The escape check is doing exactly what it was built
   * for, and it is worth saying so somewhere the next person will read.
   *
   * It is DERIVED — regenerate with `node engine/residual_order.js --write` — so freezing it does not
   * freeze a hand-typed order. It freezes WHICH derivation the run used, which is the point. */
  'data/residual-order.json',
  /* THE SWITCH-IN PRIORITY TABLE, added 2026-08-22. Identical in kind to the residual table directly
   * above and added for the identical reason: `medicham2-browser.js` builds `SWITCHIN_PRIORITY` from
   * `data/switchin-order.json` and sorts every entering body with it, so the table is not
   * documentation ABOUT the engine, it IS part of the engine — an entry order is a different battle.
   * A release without it does not crash; it falls back to a speed-only sort and stamps
   * `MEDFAILS.switchInPriorityTableMissing`, which is the loud direction, but a snapshot that plays a
   * DIFFERENT entry order from the tree it claims to freeze is a photograph of something else.
   *
   * The escape check refused the cut before a single game was played against it — the second time
   * that guard has caught a dependency at the cut rather than mid-flight (the first was
   * residual-order.json). It is DERIVED — `SHOWDOWN_PATH=... node engine/switchin_order.js --write` —
   * so freezing it freezes WHICH derivation the run used, never a hand-typed order. */
  'data/switchin-order.json',
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
  /* THE FOURTH INSTANCE, 2026-08-10 (ROADMAP #153). `engine/pp.js` became a require of BOTH
   * `engine/board.js` and `engine/rollout_leaf.js` — the leaf itself — and was not in this list, so
   * the three releases cut between 00:27Z and 00:43Z froze 23 valid digests and could not load the
   * thing MEASURE's one number is about: `Cannot find module './pp.js'` out of the snapshot, for
   * `engine/board.js` AND `engine/rollout_leaf.js`. PP decides which moves are available, so it
   * changes a number by this list's own criterion.
   *
   * IT IS THE LAST ONE THAT WILL BE FOUND BY A CRASH. The previous three growths were each
   * discovered by a run dying inside an unrelated file; `requireClosure()` below now DERIVES this
   * set from the sources themselves and `cut()` REFUSES when it escapes the list, so a fifth
   * omission is a refusal at second zero rather than a void measurement at minute thirty-nine. */
  'engine/pp.js',
];

/* WHAT THE LIST ABOVE CANNOT KNOW ABOUT ITSELF, DERIVED RATHER THAN REMEMBERED.
 *
 * SOURCES has now grown FOUR times, and every one of the four was found the same way: a measurement
 * crashed. +6 loader deps (`REL.require('engine/board.js')` threw `Cannot find module './mc_key.js'`),
 * +5 lazily-read data files (the R1 smoke run died on `data/move-effects.js`), and now
 * `engine/pp.js`. Each time the list was patched and each time the METHOD stayed "wait for a crash".
 *
 * A require edge is derivable. This walks the local `require('./x.js')` graph from the .js SOURCES
 * and returns every file reachable from a frozen source that is NOT itself frozen. A release whose
 * closure escapes the list is a valid DIGEST SET and not a loadable ENGINE — the exact sentence the
 * two earlier growths wrote about themselves.
 *
 * WHAT IT DELIBERATELY DOES NOT CATCH, said out loud rather than implied. It reads static
 * `require('./literal')` only: a computed path, a dynamic import, or a data file opened through
 * `fs.readFileSync` is invisible to it. `data/move-effects.js` — the +5 growth — was a lazy require
 * and IS caught; `data/ability-blocks.json`, read through board.js's `loadData`, is NOT. So this
 * closes the arm that has broken three times of four and says plainly that it does not close the
 * other. A partial guard that names its own gap is not the same thing as a guard that implies it is
 * complete, and this repository has paid for the second one. */
function requireClosure(sources, rootDir) {
  const root = rootDir || ROOT;
  const inList = new Set(sources);
  const seen = new Set(), escapes = new Map(), unresolved = [];
  const rel = p => path.relative(root, p).split(path.sep).join('/');
  const queue = sources.filter(s => /\.js$/.test(s));
  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    const abs = path.join(root, cur);
    let src;
    /* UNREADABLE IS NOT EMPTY. Returning "no requires" for a file that could not be opened would
     * report a clean closure over a source nobody read, which is this repository's signature bug. */
    try { src = fs.readFileSync(abs, 'utf8'); }
    catch (e) { unresolved.push(cur + ': cannot read to scan (' + e.message.slice(0, 60) + ')'); continue; }
    const re = /require\(\s*['"`](\.[^'"`]+)['"`]\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      let t = path.resolve(path.dirname(abs), m[1]);
      if (!fs.existsSync(t) && fs.existsSync(t + '.js')) t += '.js';
      if (!fs.existsSync(t)) { unresolved.push(cur + ' -> ' + m[1] + ' (does not resolve on disk)'); continue; }
      const r = rel(t);
      if (!inList.has(r)) {
        if (!escapes.has(r)) escapes.set(r, []);
        escapes.get(r).push(cur);
      }
      if (/\.js$/.test(r) && !seen.has(r)) queue.push(r);
    }
  }
  return { scanned: seen.size, escapes, unresolved };
}

/* WHAT A SNAPSHOT'S BYTES EXPORT — PARSED, AND THE FIRST VERSION OF THIS READ PROSE AS CODE.
 *
 * `provides` (in the manifest below) was added 2026-08-12 so that "can this release still serve this
 * caller" is a string comparison against a fact captured when the bytes were known good, instead of a
 * load. Its first parser matched `module\.exports\s*=\s*\{([^}]*)\}` and split the body on commas.
 *
 * `medicham2-browser.js` INTERLEAVES BLOCK COMMENTS WITH THE KEYS INSIDE THAT LITERAL, so every
 * comment glued itself onto the key that followed it and that key then failed the `^\w+$` test.
 * Measured on the live file: **ELEVEN of 78 exports were lost** — `hitChance`, `fails`, `seen`,
 * `SUBPASS`, `CODE_OF_STATUS`, `PROTECTMOVES`, `RESIDUAL_GROUPS`, `foeThreatensGuardClass`, `md4096`,
 * `ppSpentMap`, `weatherTurns` — and a `root\.(\w+)\s*=` arm invented **four more out of prose**, one
 * of which was the word `deliberately`. A `provides` list containing an English adverb is the exact
 * failure CLAUDE.md names: a value typed next to a name looks as authoritative as a value that was
 * read. This is the same hole `provenance.js`'s `writesNear` had, and the same one `callerNeeds()`
 * below already strips for. **Comments come out first, in every scanner in this repository.**
 *
 * THE `root.` ARM IS GONE AND ITS ABSENCE IS THE POINT. `root` is `window`/`globalThis`; `require()`
 * returns `module.exports`; and `REL.require`'s contract check asks `k in mod`. `MEDI_SPREAD` is the
 * receipt this file already carries: `root.MEDI_SPREAD=SPREAD` existed for months while
 * `require(...).MEDI_SPREAD` was undefined. A `provides` built off `root.` would promise symbols the
 * contract check refuses, and answering YES for a symbol the caller cannot reach is worse than
 * answering nothing at all.
 *
 * IT IS STILL A PARSE, NOT A LOAD, AND `surface()` REMAINS THE AUTHORITY. Cutting must not execute the
 * engine — `engine/game_differential.js` calls `cut()` at startup and then measures, and loading
 * medicham2 writes its exports onto the global object. So this stays static and cheap, it is stamped
 * with `provides_by` so a reader can tell WHICH recorder wrote a given list, and
 * `tests/test-artifact-rerunnable.js` compares every recorded list against `surface()` on every run.
 * A derived value is not a fact until something compares it to its source. */
const PROVIDES_BY = 'engine_release.js exportedNames — static parse of module.exports, comments stripped';
function exportedNames(src) {
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const seen = new Set();
  for (const m of bare.matchAll(/module\.exports\.(\w+)\s*=/g)) seen.add(m[1]);
  /* Brace-MATCHED rather than `[^}]*`, so a nested value in the literal cannot truncate the list.
   * The opening brace is found by the assignment itself, never by "the next `{` within N chars" —
   * a distance guard is a magic number that goes wrong the first time somebody reformats. */
  for (const m of bare.matchAll(/module\.exports\s*=\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let k = open; k < bare.length; k++) {
      const c = bare[k];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end < 0) continue;
    let d = 0;                       /* top-level keys only — a nested value's keys are not exports */
    for (const part of bare.slice(open + 1, end).split(',')) {
      if (d === 0) { const k = part.split(':')[0].trim(); if (/^\w+$/.test(k)) seen.add(k); }
      for (const c of part) { if (c === '{' || c === '[' || c === '(') d++; else if (c === '}' || c === ']' || c === ')') d--; }
    }
  }
  return [...seen].sort();
}

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

/* A CAPABILITY THAT CANNOT PROVE IT RAN IS ASSUMED BROKEN. The closure guard is expected to be
 * silent forever, which is exactly the condition under which a check quietly stops running and
 * nobody notices — `setSheet()` existed and `magnemite.js` never called it. Counted, exported, and
 * printed by the CLI. */
const CUT_COUNTERS = { closure_scans: 0, closure_refusals: 0, closure_unresolved: 0 };

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
  /* AND A RELEASE WHOSE REQUIRE CLOSURE ESCAPES THE LIST IS NOT A RELEASE EITHER — same argument,
   * one edge further out. Freezing board.js without pp.js produces a snapshot that VERIFIES, that
   * `open()` accepts, and that throws `Cannot find module './pp.js'` the moment anything loads the
   * leaf. That is worse than a missing file, because it passes every check the release has.
   *
   * IT REFUSES RATHER THAN WARNS. A warning here is a line printed at 00:27 and read at 09:00, by
   * which time three releases exist that nothing can open and whatever they were cut for is void.
   * The refusal names the file and the requirer, so the fix is a one-line addition to SOURCES.
   * CUT_ESCAPES counts how many times it has fired this process — a guard that cannot prove it ran
   * is assumed broken, and this one is expected to sit at zero forever. */
  const clo = requireClosure(SOURCES);
  CUT_COUNTERS.closure_scans++;
  if (clo.unresolved.length) {
    CUT_COUNTERS.closure_unresolved += clo.unresolved.length;
    console.error('  !! the release closure scan could not follow ' + clo.unresolved.length
      + ' require edge(s); the list below is therefore a LOWER BOUND on what escapes SOURCES:');
    for (const u of clo.unresolved) console.error('     ' + u);
  }
  if (clo.escapes.size) {
    CUT_COUNTERS.closure_refusals++;
    throw new Error('cannot cut a release — ' + clo.escapes.size + ' file(s) are REQUIRED by a frozen '
      + 'source and are not themselves frozen:\n'
      + [...clo.escapes].map(([f, by]) => '  ' + f + '  <- required by ' + by.join(', ')).join('\n')
      + '\n  A snapshot missing these VERIFIES and OPENS and then throws "Cannot find module" the first\n'
      + '  time anything loads them. That is a valid digest set and not a loadable engine — the same\n'
      + '  fault as the mc_key.js growth (2026-08-05), the move-effects.js growth (2026-08-05) and\n'
      + '  the pp.js break (2026-08-10), each of which was found by a run crashing instead of here.\n'
      + '  Add them to SOURCES in engine/engine_release.js. Existing releases are untouched; every\n'
      + '  FUTURE release id changes, which is correct — the definition of the engine changed.');
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
    /* WHAT THIS SNAPSHOT CAN SERVE, RECORDED AT CUT TIME — 2026-08-12.
     *
     * A release freezes the ENGINE and not the READER. Every symbol a caller later adds to its `need`
     * list retroactively strands every release cut before that symbol existed, and nothing announces
     * it: the snapshot still verifies, still holds its bytes, and simply stops being openable. On
     * 2026-08-12 that reached 168 of 200 releases, and of the 26 artifacts on disk that name a release,
     * exactly ONE could still be re-run. An unreproducible measurement is not wrong, it is
     * unfalsifiable — which is the thing freezing was supposed to prevent.
     *
     * `compat` answered this by LOADING and parsing every snapshot, which is slow and can itself fail
     * on a release that no longer parses. Recorded here, the answer is a string comparison against a
     * fact captured when the bytes were known good.
     *
     * IT IS A RECORD, NOT A PROMISE. It says which top-level names this snapshot exported on the day
     * it was frozen; it cannot say whether they still MEAN the same thing. That is the honest limit of
     * a photograph and it is why this is `provides` rather than `compatible`.
     *
     * AND IT IS THE ONLY THING THAT SURVIVES A PRUNE, which is why it is kept rather than deleted in
     * favour of `surface()`. Once the bodies are removed `surface()` can answer nothing at all; this
     * list is then the sole record of what those bytes could serve. See `exportedNames` above for what
     * the first version of this parser got wrong and how. */
    provides: (() => {
      try { return exportedNames(fs.readFileSync(path.join(dir, 'engine', 'medicham2-browser.js'), 'utf8')); }
      catch (e) {
        /* null means "not recorded", never "exports nothing" — and a silent null is indistinguishable
         * from a release cut before the field existed, so the reason goes where a person can see it. */
        console.error('  (could not record `provides` for ' + id + ': ' + e.message + ' — the manifest will say null)');
        return null;
      }
    })(),
    /* WHICH RECORDER WROTE THAT LIST. Without this a reader cannot tell a list produced by the parser
     * that read prose (every manifest before 2026-08-12) from one produced by the corrected parser, so
     * a check comparing `provides` against the loader could not know whether a disagreement is a live
     * defect or a known-bad legacy record. */
    provides_by: PROVIDES_BY,
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

/* ---- PRUNING, AND WHY IT IS SAFE ---------------------------------------------------------------
 *
 * Nine releases hold 23 MB of copied bytes, and the five largest FILES in this repository are the
 * same 26,348-line tag artifact five times over — one per release. It grows with every cut and
 * nobody decided that it should.
 *
 * The copy itself is not negotiable: `verify()` and `open()` exist because a measurement must read
 * bytes that cannot move, and a digest alone cannot serve a rollout. What IS negotiable is how long
 * we keep the bytes of a release that NOTHING POINTS AT.
 *
 * THE RULE IS DERIVED, NOT A NUMBER SOMEBODY PICKED. A release keeps its bytes while any artifact
 * under data/ names its id. That is exactly the set whose numbers a reader might want to re-verify.
 * Measured 2026-08-05: 5 of 9 releases are cited, 4 are cited by nothing at all — including
 * 55c7a0f19c86, which was ABANDONED fifteen minutes after it was cut because ENGINE moved
 * medicham2 underneath it. Keeping a snapshot nothing measured against is not caution, it is habit.
 *
 * WHAT PRUNING NEVER TOUCHES: `release.json` and `cuts.jsonl`. The manifest holds every digest and
 * the cut history, so a pruned release can still PROVE what it contained and when it was frozen.
 * The evidence stays; only the convenience copy goes.
 *
 * AND IT MUST NOT LOOK LIKE CORRUPTION. `verify()` reports a missing file as MODIFIED, which for a
 * deliberately pruned release is a lie in the alarming direction — it says tampering where the truth
 * is a recorded decision. A pruned release is marked, and `open()` refuses it with its own message
 * naming what happened and how to get the bytes back. Silence here would be worse than either. */
function citedReleaseIds(opts) {
  const S = store(opts);
  const root = path.join(S.releases, '..');            // data/
  const ids = new Set();
  /* A FAILED READ HERE MUST FAIL CLOSED, AND IT DID THE OPPOSITE. Returning an empty set on an
   * unreadable data/ says "no artifact cites any release" — so prune, whose whole rule is "keep a
   * release while something cites it", would have deleted EVERY release body precisely when it could
   * no longer tell which were in use. A destructive operation that becomes more destructive the less
   * it can see is the worst available failure mode, and the catch two lines down already knew that:
   * it returns every release as CITED. Both paths now agree. */
  let files = [];
  try { files = fs.readdirSync(root).filter(f => f.endsWith('.json')); }
  catch (e) {
    throw new Error('prune: cannot list ' + root + ' to find out which releases are cited (' + e.message
      + '). Refusing to continue — with no citation evidence every release reads as uncited, and '
      + 'pruning on that would delete the bodies of releases that are in use.');
  }
  let known = [];
  try { known = fs.readdirSync(S.releases); }
  catch (e) {
    throw new Error('prune: cannot list ' + S.releases + ' (' + e.message + '). There is nothing to '
      + 'prune and nothing to compare against; this is a broken store, not an empty one.');
  }
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join(root, f), 'utf8'); }
    catch (readErr) { console.error('  prune: cannot read data/' + f + ' — treating every release as CITED for safety'); return new Set(known); }
    for (const id of known) if (text.includes(id)) ids.add(id);
  }
  return ids;
}

function prune(apply, opts) {
  const S = store(opts);
  const cited = citedReleaseIds(opts);
  /* THE CURRENT RELEASE IS NEVER PRUNED, and that protection was one unreadable file away from
   * vanishing without a word. `current = null` matches no id, so the guard simply stopped applying. */
  let current = null;
  try { current = JSON.parse(fs.readFileSync(S.pointer, 'utf8')).current; }
  catch (e) {
    throw new Error('prune: cannot read the current-release pointer ' + S.pointer + ' (' + e.message
      + '). The rule "the current release is never pruned" cannot be enforced without it, so this '
      + 'refuses rather than pruning with the guard silently switched off.');
  }
  const out = [];
  for (const id of fs.readdirSync(S.releases)) {
    const dir = path.join(S.releases, id);
    const manPath = path.join(dir, 'release.json');
    if (!fs.existsSync(manPath)) continue;
    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    if (man.bodies_pruned) { out.push({ id, action: 'already pruned' }); continue; }
    /* The CURRENT release is never pruned whatever the citation count says: it is what the next
     * measurement will open, and citations lag the pointer by definition. */
    const why = cited.has(id) ? 'cited by an artifact' : (id === current ? 'is the current release' : null);
    if (why) { out.push({ id, action: 'keep', why }); continue; }
    if (!apply) { out.push({ id, action: 'WOULD PRUNE' }); continue; }
    for (const rel of Object.keys(man.files || {})) {
      const p = path.join(dir, rel);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (rmErr) { console.error('  prune: could not remove ' + p + ' — ' + rmErr.message); }
    }
    man.bodies_pruned = {
      at: new Date().toISOString(),
      why: 'no artifact under data/ cited this release id',
      manifest_retained: true,
      note: 'The digests above are unchanged and still prove what this release contained. Only the '
          + 'copied file bodies were removed. To measure against it again, re-cut from a tree whose '
          + 'files hash to these digests; `verify` will confirm the match.',
    };
    fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
    out.push({ id, action: 'pruned' });
  }
  return out;
}

/* ---- WHAT THE PHOTOGRAPH DOES NOT FREEZE, AND THE THIRD TIME THAT COST A RELEASE ---------------
 *
 * SOURCES has grown twice, both times because a release turned out not to be ENOUGH: +6 loader deps
 * so `REL.require` resolves at all, +5 lazily-read data files so a snapshot can actually play a game.
 * Both comments are above this one. This is the third instance of the same class and it is NOT the
 * same SHAPE, which is exactly why SOURCES does not grow a third time here.
 *
 * MEASURED 2026-08-09 over the 65 release directories on disk, against engine/game_differential.js:
 *    4  pruned — open() already refuses these by name, and a recorded decision is not a defect
 *    1  d3d04b669e18, the oldest release that still has bodies, froze TWELVE files and does not
 *       contain `engine/mc_key.js` at all. game_differential.js:1250 died with
 *       `Cannot find module ...\releases\d3d04b669e18\engine\mc_key.js`, thrown out of THIS FILE.
 *   56  do not export `natureL50`: `TypeError: M.natureL50 is not a function`, 1,280 lines into a
 *       file whose subject is turn order and damage, naming neither the release nor the symbol.
 *    5  can serve the current driver.
 * So the two earlier SOURCES growths did not repair a single release cut before them either. Neither
 * of them said so. That silence is half of why this is the third time.
 *
 * THE SUBJECT IS FROZEN AND THE CAMERA IS NOT, AND THAT IS DELIBERATE RATHER THAN AN OVERSIGHT.
 * game_differential.js already argues it, in its own words, about `steering.js` and `board_state.js`:
 * they are the INSTRUMENT, and freezing them "would mean each rung was scored by its own
 * contemporaneous reader, which is the one thing a ladder must not do." Adding the driver to SOURCES
 * is therefore the WRONG fix even though it is the shape of the previous two — it recovers none of
 * the 56, it changes every future release id over a file that cannot change a number the ENGINE
 * produces, and it breaks the release ladder, which is the main reason anybody re-opens an old
 * release at all.
 *
 * WHAT WAS ACTUALLY MISSING IS A CONTRACT ACROSS THAT BOUNDARY. A release knows precisely which files
 * it froze and precisely what those bytes export. A caller knows precisely what it needs. Nothing
 * ever asked. So a require out of a release is now CHECKED, at the require:
 *    - the FILE is not in the manifest  -> "this release predates <file> being part of the engine"
 *    - a NEEDED SYMBOL is not exported  -> "this release predates <symbol>", named, with the command
 *      that lists the releases which do have it.
 *
 * AND IT RECOVERS NOTHING — say it plainly rather than letting "fixed" imply a backlog came back. The
 * 56 do not become runnable. Those bytes never held the function and no error message can put it
 * there. What changes is that they fail in one sentence at second zero instead of deep inside an
 * unrelated file, and that `compat` answers "which releases can this run use" BEFORE the run. */

/* WHAT A FROZEN MODULE ACTUALLY EXPORTS. Loaded, not scanned: a text search for `natureL50` in the
 * frozen source would find the definition and the root assignment and would answer YES for a module
 * that never put it in `module.exports` — which is not a hypothetical, it is exactly the state of
 * `MEDI_SPREAD` in the LIVE engine today (assigned to `root`, absent from `module.exports`, read by
 * game_differential.js:2713 behind a `? :` that has therefore always taken the false branch).
 *
 * Loading has side effects — medicham2 writes its own exports onto the global object — so this is a
 * DIAGNOSTIC, not something a measurement should call mid-run. The module is dropped from
 * require.cache afterwards so that `compat` over sixty releases does not hold sixty engines. */
function surface(id, rel, opts) {
  const dir = path.join(store(opts).releases, id);
  let man;
  try { man = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8')); }
  catch (e) { return { id, rel, status: 'no-manifest', why: e.message, exports: null }; }
  if (man.bodies_pruned) return { id, rel, cut: man.cut, status: 'pruned', why: 'bodies removed ' + man.bodies_pruned.at, exports: null };
  if (!(rel in (man.files || {}))) {
    return { id, rel, cut: man.cut, status: 'file-absent', exports: null,
             why: 'this release froze ' + Object.keys(man.files || {}).length + ' files and ' + rel + ' was not one of them' };
  }
  const abs = path.join(dir, rel);
  try {
    const mod = require(abs);
    delete require.cache[require.resolve(abs)];
    return { id, rel, cut: man.cut, status: 'ok', exports: Object.keys(mod).sort() };
  } catch (e) {
    /* A snapshot that will not LOAD is a different answer from one that loads and lacks a symbol, and
     * collapsing the two would report a broken release as merely old. */
    return { id, rel, cut: man.cut, status: 'unloadable', why: e.message.split('\n')[0], exports: null };
  }
}

/* ---- WHO ACTUALLY NEEDS WHAT, READ OUT OF THE CALLERS -----------------------------------------
 *
 * `census()` below has to know what a modern caller demands of a snapshot. Typing that list here
 * would be the hand-maintained-ban-list-of-four failure: `engine/game_differential.js` needs twelve
 * symbols and `engine/replay_differential.js` needs thirteen, the two lists overlap and differ, and
 * a copy of either goes stale the first time somebody adds an export.
 *
 * So it is READ from the callers. Every `REL.require('<file>', { need: [...] })` in engine/ is one
 * row of the requirement table. A caller with no `need` clause asks only that the file be loadable,
 * which is still a real requirement and is recorded as an empty need list rather than skipped. */
function callerNeeds(dir) {
  const from = dir || path.join(ROOT, 'engine');
  const out = [];
  let files;
  try { files = fs.readdirSync(from).filter(f => f.endsWith('.js')); }
  catch (e) { return { rows: out, error: 'cannot scan ' + from + ': ' + e.message }; }
  for (const f of files) {
    /* THIS FILE'S OWN HEADER DOCUMENTS THE CALL IT IS SCANNING FOR, and the first version of this
     * scan read `REL.require('<file>', ...)` out of that comment and reported `<file>` as a real
     * requirement. Identical to provenance.js's `writesNear` crediting itself from its own example.
     * Comments are stripped, and the file that DEFINES the mechanism is skipped outright. */
    if (f === 'engine_release.js') continue;
    let src;
    try { src = fs.readFileSync(path.join(from, f), 'utf8'); } catch (e) { continue; }
    src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const re = /REL\.require\(\s*['"]([^'"]+)['"]\s*(?:,\s*\{([\s\S]{0,400}?)\}\s*)?\)/g;
    let m;
    while ((m = re.exec(src))) {
      /* A REQUIREMENT IS A PATH INSIDE THE RELEASE, and anything that is not one is a false read
       * rather than a caller this census should hold every release to. */
      if (!/^(engine|data)\/[\w.\-]+\.(js|json)$/.test(m[1])) continue;
      const need = [];
      const nm = m[2] && m[2].match(/need\s*:\s*\[([\s\S]*?)\]/);
      if (nm) for (const s of nm[1].split(',')) {
        const t = s.trim().replace(/^['"]|['"]$/g, '');
        if (t) need.push(t);
      }
      out.push({ caller: 'engine/' + f, file: m[1], need });
    }
  }
  return { rows: out, error: null };
}

/* ---- THE WHOLE-STORE CENSUS — ROADMAP #109 ----------------------------------------------------
 *
 * THE COUNT WAS A COMMENT AND THE COMMENT WENT STALE, INSIDE THE FILE THAT ARGUES AGAINST PROSE.
 * The block above this one records "MEASURED 2026-08-09 over the 65 release directories on disk:
 * 4 pruned, 1 that predates mc_key.js, 56 that predate natureL50, 5 that can serve the driver."
 * On 2026-08-10 the disk holds 115 directories and 52 can serve it. Nobody mistyped anything —
 * it is the fourteen stale handoffs and the ban list of four, one more time, and it is why the
 * project could still describe the store as "56 of 62 unopenable" a day later.
 *
 * A count moves. A sentence does not. So the census is DERIVED and writes an artifact.
 *
 * THE WORD "UNOPENABLE" IS WRONG AND THE CENSUS SEPARATES WHAT IT WAS COLLAPSING. `open()` succeeds
 * for almost every release on disk: the snapshot verifies, the manifest is intact, `stamp()` still
 * proves exactly which bytes a run read. What fails is RE-RUNNING — `REL.require` refusing because
 * the frozen bytes predate a file or an export. Those are opposite facts for a reader:
 *   VERIFIABLE   — a run stamped with this id can still be checked against these digests. This is
 *                  what provenance.js does, and it works for every release with a manifest.
 *   RUNNABLE     — the measurement can be REPEATED against these bytes.
 * A release can be verifiable and not runnable, and that is the ordinary state of an old one. */
function census(opts) {
  const S = store(opts);
  const needs = callerNeeds();
  /* One requirement row per (file, symbol), unioned across callers, so the census asks the hardest
   * question any live caller asks rather than one caller's question. */
  const union = new Map();
  for (const r of needs.rows) {
    if (!union.has(r.file)) union.set(r.file, new Set());
    for (const k of r.need) union.get(r.file).add(k);
  }
  const rows = [];
  for (const id of list(opts)) {
    const dir = path.join(S.releases, id);
    const row = { id, cause: null, cut: null, files_frozen: null, verifiable: false, runnable: false, why: null };
    let man;
    try { man = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8')); }
    catch (e) { row.cause = 'no-manifest'; row.why = e.message.slice(0, 120); rows.push(row); continue; }
    row.cut = man.cut;
    row.files_frozen = Object.keys(man.files || {}).length;
    /* A MANIFEST IS ENOUGH TO VERIFY A STAMP. Pruned bodies do not take that away and the prune
     * record says so in its own words; that is why `verifiable` is not `runnable`. */
    row.verifiable = true;
    row.missing_sources = SOURCES.filter(s => !(s in (man.files || {})));
    if (man.bodies_pruned) { row.cause = 'pruned'; row.why = 'bodies removed ' + man.bodies_pruned.at + ' — a recorded decision'; rows.push(row); continue; }
    const v = verify(id, opts);
    if (!v.ok) { row.cause = 'modified'; row.verifiable = false; row.why = v.bad.slice(0, 2).join('; '); rows.push(row); continue; }
    /* THE CAUSE IS WHAT A LIVE CALLER HITS, NOT WHAT THE LIST HAPPENS TO CONTAIN, and the first
     * version of this got that backwards. Adding `engine/pp.js` to SOURCES instantly made 112 of 117
     * releases "predate a source" — arithmetically true, useless as a diagnosis, and it buried the
     * one cause that matters. `missing_sources` is kept as a FACT on every row and is never the
     * verdict; the verdict is whether a snapshot can serve somebody. */
    const lacks = [], unloadable = [], absent = [];
    for (const [rel, syms] of union) {
      const s = surface(id, rel, opts);
      if (s.status === 'file-absent') { absent.push(rel); continue; }
      if (s.status !== 'ok') { unloadable.push(rel + ': ' + (s.why || s.status)); continue; }
      for (const k of syms) if (!s.exports.includes(k)) lacks.push(rel + '::' + k);
    }
    row.lacks = lacks;
    if (unloadable.length) { row.cause = 'unloadable'; row.why = unloadable.join(' | ').slice(0, 240); }
    else if (absent.length) { row.cause = 'predates-a-source'; row.why = 'froze ' + row.files_frozen + ' files and never held ' + absent.join(', '); }
    else if (lacks.length) { row.cause = 'predates-an-export'; row.why = 'the frozen bytes never exported ' + lacks.join(', '); }
    else { row.cause = 'serviceable'; row.runnable = true; }
    rows.push(row);
  }
  const counts = {};
  for (const r of rows) counts[r.cause] = (counts[r.cause] || 0) + 1;
  return {
    generated: new Date().toISOString(),
    by: 'engine/engine_release.js census',
    note: 'ROADMAP #109. Derived every run. VERIFIABLE means a run stamped with this id can still be '
        + 'checked against its digests; RUNNABLE means the measurement can be repeated against these '
        + 'bytes. They are different questions and "unopenable" collapsed them.',
    sources_now: SOURCES.length,
    caller_requirements: [...union].map(([file, s]) => ({ file, need: [...s].sort() })),
    caller_requirement_sites: needs.rows.length,
    caller_scan_error: needs.error,
    counts,
    releases: rows.length,
    verifiable: rows.filter(r => r.verifiable).length,
    runnable: rows.filter(r => r.runnable).length,
    rows,
  };
}

/* WHICH RELEASES CAN SERVE THIS CALLER — the inventory that turns a backlog into a list.
 * Ordered by first cut, so the answer reads as a timeline of when the caller's requirement appeared. */
function compat(rel, symbols, opts) {
  const need = symbols || [];
  const rows = list(opts).map(id => {
    const s = surface(id, rel, opts);
    if (s.status !== 'ok') return Object.assign(s, { provides: false, missing: null });
    const missing = need.filter(k => !s.exports.includes(k));
    return Object.assign(s, { provides: missing.length === 0, missing });
  });
  rows.sort((a, b) => String(a.cut).localeCompare(String(b.cut)));
  return rows;
}

/* THE TWO REFUSALS, WRITTEN ONCE. Both say the same three things, because a reader hitting either one
 * needs the same three things: this is not corruption, the snapshot cannot be repaired, and here is
 * the command that finds a release which can. */
function fileRefusal(id, man, rel) {
  const n = Object.keys(man.files || {}).length;
  return new Error('release ' + id + ' does not contain ' + rel + '.\n'
    + '  It froze ' + n + ' files when it was first cut at ' + man.cut + '; ' + rel + ' was added to\n'
    + '  engine_release.js SOURCES afterwards, so these bytes never held it.\n'
    + '  This is NOT corruption and NOT drift — the snapshot is intact and simply predates the file.\n'
    + '  It cannot be repaired: a release is a photograph, and the file was not in the frame.\n'
    + '  Which releases DO carry it:  node engine/engine_release.js compat ' + rel);
}
function symbolRefusal(id, man, rel, missing, provided) {
  return new Error('release ' + id + ' was frozen before ' + rel + ' exported: ' + missing.join(', ') + '\n'
    + '  First cut ' + man.cut + '. The snapshot is INTACT — it provides ' + provided + ' exports and\n'
    + '  predates ' + (missing.length === 1 ? 'that one' : 'those') + '.\n'
    + '  It cannot be repaired: the frozen bytes never had it. Pick a release that does:\n'
    + '    node engine/engine_release.js compat ' + rel + ' ' + missing.join(' '));
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
  /* PRUNED IS NOT MODIFIED, and saying "MODIFIED" here would accuse a recorded decision of being
   * tampering. Checked BEFORE verify(), because verify sees only missing files and cannot tell the
   * difference. The manifest is still here, so the refusal can say exactly what was frozen. */
  {
    const manPath = path.join(S.releases, id, 'release.json');
    if (fs.existsSync(manPath)) {
      const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
      if (man.bodies_pruned) {
        throw new Error('release ' + id + ' was PRUNED on ' + man.bodies_pruned.at + ' — its file bodies '
          + 'were removed because no artifact cited it. This is a recorded decision, NOT corruption.\n'
          + '  Its manifest survives: ' + Object.keys(man.files || {}).length + ' digests, first cut ' + man.cut + '.\n'
          + '  To measure against it again, restore a tree whose files hash to those digests and re-cut;\n'
          + '  `node engine/engine_release.js verify ' + id + '` will confirm the match.');
      }
    }
  }
  const v = verify(id, opts);
  if (!v.ok) throw new Error('release ' + id + ' has been MODIFIED since it was cut:\n  ' + v.bad.join('\n  '));
  const dir = path.join(S.releases, id);
  /* EVERY WAY INTO THE SNAPSHOT GOES THROUGH THE SAME GUARD. `require` was the one that broke, but
   * `path` and `read` reach the same missing file and would answer ENOENT from somewhere else. */
  const frozen = (rel) => {
    if (!(rel in (v.manifest.files || {}))) throw fileRefusal(id, v.manifest, rel);
    return path.join(dir, rel);
  };
  return {
    id,
    dir,
    manifest: v.manifest,
    /* Loads from the SNAPSHOT. A measuring script that calls this cannot be affected by another
     * division editing the live file, which is the entire point.
     *
     * `{ need, want }` IS THE CONTRACT, AND IT IS EXPLICIT BECAUSE THE ALTERNATIVE WAS TESTED IN THE
     * HEAD AND REJECTED. Wrapping the module in a Proxy that threw on any absent key would need no
     * caller change and would ALSO turn every legitimate feature-detect — `M.MEDI_SPREAD ? ... : ...`,
     * `'x' in M` — into a crash, for every caller in the repo, silently. A caller says what it needs.
     *   need: absent -> REFUSE, by name, here.
     *   want: absent -> a loud line and carry on. That is for a genuinely optional read, and it is
     *         loud because a `? :` over an export that is never there is indistinguishable from a
     *         working feature until someone measures it. */
    require(rel, opts2) {
      const abs = frozen(rel);
      const mod = require(abs);
      const need = (opts2 && opts2.need) || [];
      const want = (opts2 && opts2.want) || [];
      const missing = need.filter(k => !(k in mod));
      if (missing.length) throw symbolRefusal(id, v.manifest, rel, missing, Object.keys(mod).length);
      const soft = want.filter(k => !(k in mod));
      if (soft.length) {
        console.error('  !! release ' + id + ' does not export ' + soft.join(', ') + ' from ' + rel
          + ' — the caller declared these OPTIONAL, so it is running with whatever its fallback is.\n'
          + '     A fallback nobody can see is the failure mode this project is named after. If the\n'
          + '     number below depends on it, it is not the number you think it is.');
      }
      return mod;
    },
    path(rel) { return frozen(rel); },
    read(rel) { return fs.readFileSync(frozen(rel), 'utf8'); },
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
/* `exportedNames` is exported so it can be SHOWN correct against `surface()` rather than assumed —
 * it is the parser that read prose once already. It is not a substitute for `surface()`: use the
 * loader wherever the bodies still exist, and this only where they do not. */
module.exports = { cut, list, verify, drift, open, rerender, surface, compat, sha12, sha12OrNull,
                   requireClosure, census, callerNeeds, exportedNames, PROVIDES_BY,
                   CUT_COUNTERS, SOURCES, POINTER, RELEASES };

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
  } else if (cmd === 'prune') {
    const apply = process.argv.includes('--apply');
    const rows = prune(apply, undefined);
    console.log('\n  RELEASE BODIES — kept while an artifact cites the id, otherwise prunable.');
    console.log('  The manifest and cut history are NEVER removed, so a pruned release can still prove\n'
              + '  what it contained. ' + (apply ? 'APPLIED.' : 'Dry run — pass --apply to act.') + '\n');
    for (const r of rows) {
      console.log('    ' + r.id + '  ' + r.action.toUpperCase() + (r.why ? '  (' + r.why + ')' : ''));
    }
    const n = rows.filter(r => r.action === 'WOULD PRUNE' || r.action === 'pruned').length;
    console.log('\n  ' + n + ' release(s) ' + (apply ? 'pruned' : 'would be pruned') + '.\n');
  } else if (cmd === 'compat') {
    /* WHICH RELEASES CAN A GIVEN CALLER STILL USE. The question ROADMAP #57's re-run list and the
     * quarantine's lift condition both assume has the answer "all of them", and it does not. */
    const rel = arg;
    if (!rel) { console.log('usage: engine_release.js compat <file-in-the-release> [symbol ...]'); process.exit(2); }
    const syms = process.argv.slice(4);
    const rows = compat(rel, syms);
    console.log('\n  CAN A RELEASE SERVE THIS CALLER — ' + rel
      + (syms.length ? '  needing: ' + syms.join(', ') : '  (file presence only)'));
    console.log('  A release is a photograph. One that predates a file or an export cannot be repaired;\n'
              + '  this says which ones can be USED, before a run finds out 1,280 lines deep.\n');
    for (const r of rows) {
      const verdict = r.status !== 'ok' ? r.status.toUpperCase()
        : (r.provides ? 'PROVIDES' : 'LACKS ' + r.missing.join(','));
      console.log('    ' + (r.cut || '(no cut time)') + '  ' + r.id + '  ' + verdict
        + (r.status !== 'ok' && r.why ? '   (' + r.why + ')' : ''));
    }
    const okN = rows.filter(r => r.provides).length;
    console.log('\n  ' + okN + ' of ' + rows.length + ' releases can serve it.'
      + '  ' + rows.filter(r => r.status === 'pruned').length + ' pruned,'
      + '  ' + rows.filter(r => r.status === 'file-absent').length + ' predate the file,'
      + '  ' + rows.filter(r => r.status === 'ok' && !r.provides).length + ' predate an export,'
      + '  ' + rows.filter(r => r.status === 'unloadable' || r.status === 'no-manifest').length + ' broken.\n');
  } else if (cmd === 'census') {
    /* ROADMAP #109. `--write` puts it in data/ so status.js and provenance.js can read it instead of
     * anybody quoting the stale count out of this file's own header comment. */
    const c = census();
    console.log('\n  RELEASE CENSUS — ' + c.releases + ' releases, ' + c.sources_now + ' files in SOURCES');
    console.log('  VERIFIABLE = a run stamped with this id can still be checked against its digests.');
    console.log('  RUNNABLE   = the measurement can be REPEATED against these bytes. Not the same question.\n');
    for (const [k, v] of Object.entries(c.counts).sort((a, b) => b[1] - a[1])) {
      console.log('    ' + String(v).padStart(4) + '  ' + k);
    }
    console.log('\n  ' + c.verifiable + ' of ' + c.releases + ' verifiable, '
              + c.runnable + ' of ' + c.releases + ' runnable.');
    console.log('  asked against ' + c.caller_requirements.length + ' file(s) that live callers load out of a '
              + 'release, read from ' + c.caller_requirement_sites + ' REL.require site(s) — not a typed list:');
    for (const r of c.caller_requirements) {
      console.log('    ' + r.file + (r.need.length ? '  needs ' + r.need.length + ': ' + r.need.join(', ') : '  (loadable only)'));
    }
    /* THE DATED BOUNDARY IS THE DIAGNOSIS, not the count. A cause that maps onto a contiguous date
     * range is one event in the engine's history; one that scatters is many. */
    console.log('');
    const byCause = {};
    for (const r of c.rows) { (byCause[r.cause] = byCause[r.cause] || []).push(r.cut); }
    for (const [k, ds] of Object.entries(byCause)) {
      const s = ds.filter(Boolean).sort();
      console.log('    ' + k.padEnd(20) + (s.length ? s[0].slice(0, 19) + '  ..  ' + s[s.length - 1].slice(0, 19) : '(undated)'));
    }
    if (process.argv.includes('--write')) {
      fs.writeFileSync(D('data', 'release-census.json'), JSON.stringify(c, null, 1) + '\n');
      console.log('\n  wrote data/release-census.json');
    } else console.log('\n  (dry run — pass --write to publish data/release-census.json)');
  } else if (cmd === 'rerender') {
    const res = rerender(arg || (JSON.parse(fs.readFileSync(POINTER, 'utf8')).current));
    console.log(`re-rendered ${res.id} from its cut log (${res.cuts} cut(s))`);
    console.log(`  was: ${res.before.cut}  ${res.before.why}`);
    console.log(`  now: ${res.after.cut}  ${res.after.why}`);
    console.log('  digests and snapshot bytes untouched — this redraws the record, it does not cut.');
  } else {
    console.log('usage: engine_release.js cut "<why>" | list | verify [id] | rerender [id]\n'
              + '       engine_release.js compat <file-in-the-release> [symbol ...]\n'
              + '       engine_release.js census [--write]   (ROADMAP #109 — verifiable vs runnable)');
    process.exit(2);
  }
}
