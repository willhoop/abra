/* coverage.js — WHAT EVERY GATE NUMBER DOES NOT COVER, DERIVED FROM THE ARTIFACTS THEMSELVES.
 *
 * WHY THIS EXISTS (2026-08-28). Every unpleasant surprise of that day had ONE shape: **a verdict was
 * printed without its coverage.** In each case the number was correct and quietly narrower than it
 * read, AND THE SCOPE WAS ALREADY RECORDED — in a field beside the pass count, in a separate probe
 * nobody runs, in a clause tail, or in a per-row `note`:
 *
 *   damage differential `0 of 6000`     `skipped_multihit: 134` sits in the same object. It has never
 *                                       run a volley.
 *   "the boards match"                  33 of the 80 leaves a legal mechanic can write are read by the
 *                                       comparator. 43 are read by nothing.
 *   census `780 probed / 780 live`      67 mechanics never fired in the harness at all.
 *   roster multi-hit `BOARDS-MATCH`     the two arms reach the two ENDS of the hit range. On eight
 *                                       moves declaring [2,5], counts 3 and 4 are reached by no arm,
 *                                       and the damage differential skips those moves outright.
 *
 * (The fourth row above was stated to me as "only ever at 2 hits" and that is REFUTED — see
 * `rangeStaged` below for the measurement that refutes it. It is left in the list because the SHAPE
 * was right and the number was not, which is the whole argument for deriving a scope instead of
 * reading it out of a `note`. The first row is likewise narrower than it was given to me: the raw
 * skip COUNT was already on status.js's differential line; what was missing is that the skip is a
 * whole FAMILY of moves the volley loop has never run.)
 *
 * So the verdict is read, the scope is not, and the next person to look somewhere new produces
 * another surprise. That is a REPORTING defect and this file is the fix: the counts a reader needs in
 * order to know how wide a clean verdict is, printed beside it, every one of them derived.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT THIS CATCHES, AND — THE SENTENCE THAT MATTERS — WHAT IT DOES NOT.
 *
 * "A gate built from an instance catches that instance, not the class." The species-key bug was found,
 * fixed and gated TWICE and came back a third time because both gates matched known-bad SHAPES instead
 * of checking that every caller went through one door. So this file must be judged on whether it finds
 * a scope field NOBODY TOLD IT ABOUT. Three mechanisms, in decreasing generality:
 *
 *   1. NAME VOCABULARY (`scopeFields`). Walks any artifact object and reports every non-zero numeric
 *      or non-empty list whose KEY matches the exclusion vocabulary — `skipped_*`, `*_dropped`,
 *      `did_not_fire`, `unreachable`, `out_of_scope`, `could_not_stage*`, `refused`, `threw`,
 *      `not_compared`, and ~25 more. IT IS NOT GIVEN A LIST OF ARTIFACTS OR FIELDS. A new instrument
 *      that writes `skipped_volleys` is reported on the run it first writes one, with no edit here.
 *      **IT WILL MISS AN EXCLUSION NAMED OUTSIDE THAT VOCABULARY** — `volleysNotRun`, `remainder`,
 *      `theOtherOnes`. There is no mechanical defence against that and pretending otherwise is the
 *      failure this header exists to prevent. The `unclassified` list below is the partial answer: it
 *      prints every numeric field the vocabulary did NOT match, so a reader auditing a new artifact
 *      can see the names that exist rather than only the ones that were recognised.
 *
 *   2. ARITHMETIC RESIDUAL (`residual`). Structural, not lexical: any object carrying BOTH a
 *      population-shaped key (`total`, `exist`, `in_scope`, `probed`, `requested`) and an
 *      accounted-shaped key (`tested`, `fired`, `resolved`, `compared`, `matched`, `live`) reports the
 *      difference. This is what catches an artifact whose exclusion has NO NAME AT ALL — the rows
 *      simply are not in the tested count. It misses an artifact that names neither side by convention.
 *
 *   3. DECLARED RANGES (`rangeStaged`). Any tag param in `data/tags.json` carrying a `range: [lo,hi]`
 *      with `hi > lo` is a mechanic the roster stages at ONE point of several. Today the class has
 *      exactly one member (`multiHit`, 8 moves), which is the point: a second ranged param added to
 *      any tag is reported without an edit here.
 *
 * NOTHING HERE PARSES PROSE. The roster's per-row `note` is where the multi-hit pin was recorded, and
 * a `note` is exactly the place a scope goes to die — that one had been WRONG in the artifact for
 * nine days (`tests/roster.js` `move/multihit` `why`, 2026-08-27: the printed sentence "THE PIN LANDS
 * ON 2 HIT(S)" was typed from `e.multihit[0]` and "was never a reading of anything"; the arms actually
 * reach the two ENDS of the range). So the range gap is derived from `tags.json` params instead.
 *
 * ---------------------------------------------------------------------------------------------
 * IT IS NOT A GATE AND MUST NOT BECOME ONE. Every count here is non-zero today by construction; a gate
 * registered on them would be RED on the day it was written and "KNOWN FAILURE" is a banned phrase.
 * It is a reporter, and `engine/status.js` is its only shipping caller.
 *
 *   node engine/coverage.js            the COVERAGE block, as status.js prints it
 *   node engine/coverage.js --audit    every artifact under data/, every scope field it carries
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
/* EVERY ARTIFACT THIS FILE READS IS RECORDED, so the block can end by saying HOW OLD each of its own
 * inputs was. A coverage figure carries the staleness of what it read, and until 2026-08-28 nothing
 * printed that: a stage run without `--write` exits 0 on a full clean report while its artifact never
 * moves, and `data/roster.items.json` published a fixed row as DEFERRED-BY-OWNER for hours because of
 * exactly that. Recorded here rather than at each call site, so a new read cannot forget to. */
const READS = new Set();
/* THE SILENT-CATCH GATE IS RIGHT AND THIS IS THE ANSWER TO IT. Every read below can legitimately
 * fail -- an artifact that was never generated is a real state and is REPORTED as NOT DERIVED. What
 * may not happen is the failure vanishing: a coverage number is a claim about what is NOT covered,
 * so a read that failed and said nothing would understate the hole it exists to print. */
const COVFAILS = { readJson: 0, readJsonFirst: '', gateSource: 0, artifactStat: 0 };
const readJson = f => {
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (/[\\/]data[\\/]/.test(f)) READS.add(path.basename(f));
        return j; }
  catch (e) {
    /* ENOENT is the ordinary case -- the artifact has never been generated. It still COUNTS, because
     * `NOT DERIVED` printed once is a fact and `NOT DERIVED` printed for every row is a broken run. */
    COVFAILS.readJson++;
    if (!COVFAILS.readJsonFirst) COVFAILS.readJsonFirst = path.basename(f) + ': ' + e.message;
    return null;
  }
};

/* ---- 1. THE NAME VOCABULARY -------------------------------------------------------------------
 * Two halves, because English puts the word at either end: `skipped_multihit` and `teams_dropped`
 * name the same class. Kept as one regex so there is ONE place the vocabulary lives. */
const HEAD = ['skipped', 'dropped', 'unstaged', 'unreachable', 'unattributable', 'unarmed',
  'unplanned', 'unprobed', 'unfired', 'untested', 'unresolved', 'unattempted', 'uncomparable',
  'missing', 'refused', 'threw', 'hollow', 'deferred', 'shelved', 'excluded', 'omitted', 'ignored',
  'out_of_scope', 'could_not_stage', 'cannot_fire', 'did_not_fire', 'not_asked', 'not_compared',
  'not_run', 'non_finite', 'nonfinite', 'void_games'];
const TAIL = ['skipped', 'dropped', 'missing', 'unstaged', 'unreachable', 'unattributable',
  'refused', 'threw', 'deferred', 'shelved', 'excluded', 'omitted', 'untested', 'unchecked',
  'unfired', 'unplanned', 'unresolved', 'not_compared', 'not_exercised'];
const EXCLUSION_RX = new RegExp('^(' + HEAD.join('|') + ')|_(' + TAIL.join('|') + ')$', 'i');
/* A BOUND is not an exclusion — it is how far the run went — and it is scope all the same. The
 * whole-game differential's `turns_cap: 12` is the single widest unstated narrowing in the gate: the
 * clause says "the same game on both engines" and it compares the first twelve turns. */
const BOUND_RX = /(^|_)(cap|limit|maxturns|max_turns|horizon)($|_)/i;

/* Walks any object. `results` / `rows` arrays are per-entity payloads, not summaries, so the walk is
 * depth-limited rather than reading 900 rows looking for a field name. */
function scopeFields(obj, depth = 4) {
  const excluded = [], bounds = [], unclassified = [];
  (function walk(o, pre, d) {
    if (!o || typeof o !== 'object' || d > depth) return;
    for (const k of Object.keys(o)) {
      const v = o[k], p = pre ? pre + '.' + k : k;
      if (typeof v === 'number') {
        if (EXCLUSION_RX.test(k)) { if (v !== 0) excluded.push({ path: p, n: v }); }
        else if (BOUND_RX.test(k)) bounds.push({ path: p, n: v });
        else unclassified.push({ path: p, n: v });
      } else if (Array.isArray(v)) {
        if (EXCLUSION_RX.test(k) && v.length) excluded.push({ path: p, n: v.length, list: true });
      } else if (v && typeof v === 'object') walk(v, p, d + 1);
    }
  })(obj, '', 0);
  return { excluded, bounds, unclassified };
}

/* ---- 2. THE ARITHMETIC RESIDUAL ---------------------------------------------------------------
 * The exclusion with no name. Population and accounted are matched by CONVENTION, in preference
 * order, so the tightest honest denominator wins: an artifact carrying both `total` and `in_scope`
 * is measured against `in_scope`, which is the number its author already narrowed to. */
const POP = ['in_scope', 'total', 'exist', 'probed', 'requested', 'measurable'];
const ACC = ['tested', 'fired', 'resolved', 'compared', 'matched', 'live', 'exercised'];
function residual(obj, depth = 4) {
  const out = [];
  (function walk(o, pre, d) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || d > depth) return;
    const pk = POP.find(k => typeof o[k] === 'number');
    const ak = ACC.find(k => typeof o[k] === 'number');
    if (pk && ak && o[pk] - o[ak] > 0)
      out.push({ path: pre || '(root)', pop: pk, popN: o[pk], acc: ak, accN: o[ak], gap: o[pk] - o[ak] });
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, pre ? pre + '.' + k : k, d + 1);
    }
  })(obj, '', 0);
  return out;
}

/* ---- 3. DECLARED RANGES AND THE POINTS OF THEM NOTHING REACHES ---------------------------------
 * WHAT THIS ROW SAID FIRST WAS WRONG, AND THE CORRECTION IS THE POINT OF THE ROW. It read "staged at
 * ONE point of four", taken from the roster artifact's per-row `note`. That note is TYPED from
 * `e.multihit[0]` and, as `tests/roster.js`'s own `move/multihit` `why` block records (2026-08-27),
 * "was never a reading of anything" — a `[2,5]` move does not go through the pinned range form at
 * all. `data/mods/champions/scripts.ts:441` draws it with `battle.sample` over a twenty-entry table,
 * `PRNG#sample` is the ONE-argument `random(items.length)`, and the arms answer that `top ? m-1 : 0`.
 * So the two arms reach the two ENDS, 2 and 5, measured in both engines by
 * `tests/probe_multihit_corners.js`. THE UNREACHED SET IS THE INTERIOR: 3 and 4.
 *
 * SO THE COUNT HERE IS `width - 2` (the ends the arms reach), NOT `width - 1`. It is derived from the
 * declared range rather than from the note, which is exactly why the note being wrong for nine days
 * cannot reach this number. A fixed-count move has width 1 and contributes nothing. */
function rangeStaged() {
  const t = readJson(D('data', 'tags.json'));
  if (!t) return null;
  const rows = [];
  for (const kind of ['moves', 'items', 'abilities']) {
    for (const id of Object.keys(t[kind] || {})) {
      const params = t[kind][id].params || {};
      for (const tag of Object.keys(params)) {
        const r = params[tag] && params[tag].range;
        if (Array.isArray(r) && r.length === 2 && r[1] > r[0])
          rows.push({ kind, id, tag, lo: r[0], hi: r[1], width: r[1] - r[0] + 1,
                      /* the two arms reach the two ENDS; the interior is reached by nothing */
                      interior: Math.max(0, r[1] - r[0] - 1),
                      distribution: params[tag].distribution || null });
      }
    }
  }
  return rows;
}

/* ---- THE ARTIFACT SET THE GATE READS, DERIVED FROM ITS SOURCE ---------------------------------
 * Not a typed list, for the reason `provenance.js` derives its graph from source: a typed one is
 * wrong within a day and this repository has a fourteen-handoff receipt for that. The roster stages
 * are added from the gate's own clause objects, which carry `file` directly. */
function gateArtifacts() {
  const files = new Set();
  for (const f of ['quarantine.js', 'status.js']) {
    let src;
    try { src = fs.readFileSync(D('engine', f), 'utf8'); }
    catch (e) {
      /* The gate's OWN source is unreadable. That is not a missing artifact, it is a broken
       * checkout, and the artifact list derived below would silently be short by everything this
       * file names -- which is the exact shape this counter exists to make visible. */
      COVFAILS.gateSource++;
      console.error('coverage: could not read engine/' + f + ' -- the derived artifact list is INCOMPLETE:', e.message);
      continue;
    }
    for (const m of src.matchAll(/D\(\s*'data'\s*,\s*'([A-Za-z0-9_.-]+\.json)'\s*\)/g)) files.add(m[1]);
    for (const m of src.matchAll(/\bj\(\s*'([A-Za-z0-9_.-]+\.json)'\s*\)/g)) files.add(m[1]);
  }
  return [...files].sort();
}

/* ---- CLAUSE -> ARTIFACT, DERIVED, NEVER TYPED --------------------------------------------------
 * A clause either names its file (the roster stages do) or carries the `generated` stamp it read. A
 * stamp identifies its artifact uniquely; if two artifacts share one, the answer is NOT DERIVED
 * rather than a guess. */
function clauseArtifact(clause, cache) {
  if (clause.file) return String(clause.file).replace(/^data[\\/]/, '');
  if (!clause.generated) return null;
  const hits = [];
  for (const f of gateArtifacts()) {
    const j = cache[f] !== undefined ? cache[f] : (cache[f] = readJson(D('data', f)));
    if (j && j.generated === clause.generated) hits.push(f);
  }
  return hits.length === 1 ? hits[0] : null;
}

/* ---- HOW OLD IS THE THING THIS VERDICT WAS DRAWN FROM -----------------------------------------
 * ADDED 2026-08-28, after a stage run that printed a complete report and exited 0 while its artifact
 * NEVER MOVED. `tests/roster.js --stage items` without `--write` is a full, clean, exit-0 report on a
 * file that stays where it was; `data/roster.items.json` went on publishing DEFERRED-BY-OWNER for a
 * row that had been fixed hours earlier. The verdict was published and the staleness was not — the
 * same shape as every other gap in this file, arriving through the clock instead of through a count.
 *
 * THE ARTIFACT'S OWN `generated` STAMP IS THE AGE, NOT THE MTIME. "Newer than its source" is no
 * evidence at all (CLAUDE.md, and engine-data.js was newer than the merge script that had lost its
 * output). The mtime is read for ONE purpose: to say when a file is being written RIGHT NOW, because
 * a torn read is a plausible, well-formed, completely fictitious answer and not an error. */
function artifactAge(file, now = Date.now()) {
  let st = null;
  try { st = fs.statSync(D('data', file)); }
  catch (e) { COVFAILS.artifactStat++; return null; }   /* absent artifact -> no age; counted, not hidden */
  const j = readJson(D('data', file));
  const g = j && j.generated ? Date.parse(j.generated) : NaN;
  const ageMs = Number.isFinite(g) ? now - g : null;
  return { file, generated: (j && j.generated) || null, ageMs,
           mtimeMs: st.mtimeMs, beingWritten: (now - st.mtimeMs) < 60000 };
}
const humanAge = ms => ms == null ? 'NO `generated` STAMP — age unknown, which is not the same as fresh'
  : ms < 0 ? 'stamped in the FUTURE'
  : ms < 3600000 ? Math.round(ms / 60000) + ' min old'
  : ms < 86400000 ? (ms / 3600000).toFixed(1) + ' h old'
  : (ms / 86400000).toFixed(1) + ' days old';

/* One scope line per clause. Prose is OPTIONAL: a field with no entry here still prints, under its
 * own name. That is deliberate — a vocabulary of prose would be a second list to keep current, and
 * the raw field name is the thing a reader can grep for. */
const PROSE = {
  skipped_multihit: 'multi-hit volleys, never run',
  skipped_ability_multihit: 'Parental Bond clicks, never run',
  'pool.dropped': 'species that can never be drawn',
  did_not_fire: 'staged and never fired',
  unreachable: 'no legal carrier',
  out_of_scope: 'excluded before staging',
  could_not_stage_in_scope: 'in scope, no fixture',
  unattributable: 'fired, control not quiet',
  'closet.teams_dropped': 'teams dropped from the pool',
  not_compared: 'declared uncompared',
  trigger_unstaged: 'triggers never staged',
  shelved_by_owner: 'shelved by the owner',
};
function clauseScope(clause, cache) {
  const file = clauseArtifact(clause, cache);
  if (!file) return null;
  const j = cache[file] !== undefined ? cache[file] : (cache[file] = readJson(D('data', file)));
  if (!j) return null;
  /* DEPTH 2 ON A CLAUSE LINE, FULL DEPTH IN `--audit`. Below depth 2 the vocabulary starts matching
   * MECHANIC data rather than run bookkeeping — `tags.json` carries
   * `moves.worryseed.params.rewritesTargetAbility.refusedAbilities`, which is a fact about Worry Seed
   * and not a row somebody skipped. A scope line that cries wolf is one people learn to read past,
   * which is the exact failure this file exists to fix. */
  const s = scopeFields(j, 2);
  /* A list and its own count are one exclusion written twice (`pool.dropped` / `pool.droppedNames`,
   * `closet.teams_dropped` / `closet.dropped`). Same parent, same n -> keep the numeric one. */
  /* ONE EXCLUSION WRITTEN TWICE IS STILL ONE EXCLUSION — `closet.teams_dropped` beside
   * `closet.dropped`, `scope.unattributable` beside `scope.unattributable_ids`,
   * `state.not_compared` beside `end_state_not_compared`. Collapsed ONLY when the two names are
   * related (one leaf contains the other, or one is the `_ids`/`Names`/`_list` sidecar of the other)
   * AND the counts match. Two UNRELATED fields that happen to share a value are both kept: merging
   * those would hide an exclusion, which is the failure this whole file is against. */
  const parent = p => p.split('.').slice(0, -1).join('.');
  const leafOf = p => p.split('.').pop().replace(/^end_state_/, '');
  const sidecar = l => l.replace(/(_ids|Names|_list|_first)$/, '');
  const related = (a, b) => { const x = sidecar(leafOf(a)), y = sidecar(leafOf(b));
    return x === y || x.includes(y) || y.includes(x); };
  const excluded = [];
  for (const e of s.excluded.slice().sort((a, b) => (a.list ? 1 : 0) - (b.list ? 1 : 0)
      || a.path.length - b.path.length)) {
    if (excluded.some(k => k.n === e.n && related(k.path, e.path)
        && (parent(k.path) === parent(e.path) || leafOf(k.path) === leafOf(e.path)))) continue;
    excluded.push(e);
  }
  excluded.sort((a, b) => b.n - a.n);
  return { file, stale: !!(clause.ranOn && clause.staleAgainst && clause.ranOn !== clause.staleAgainst),
           excluded, bounds: s.bounds, residual: residual(j, 2) };
}

/* ---- TAG COVERAGE, ONE PRODUCER ---------------------------------------------------------------
 * `engine/status.js` printed its own `tag coverage: N/M probed` line and this file wanted the same
 * fact. Two producers of one fact is the breach that made the closed-row detector disagree with
 * itself on 24 of 292 rows in both directions, so status.js now calls THIS and holds no arithmetic
 * of its own. The gating — whether tags.json is safe to read at all — stays in status.js, because
 * that is a provenance question and not a coverage one. */
function tagCoverage() {
  const T = readJson(D('data', 'tags.json'));
  if (!T || !Array.isArray(T.tags)) return null;
  const uniq = new Map();
  for (const r of T.tags) { const n = r.tag || r.name || r.id; if (!uniq.has(n)) uniq.set(n, r); }
  const withConsumer = [...uniq.values()].filter(r => r.consumedBy && String(r.consumedBy).trim()).length;
  const C = readJson(D('data', 'mechanics-census.json'));
  if (!C || !Array.isArray(C.results))
    return { unique: uniq.size, withConsumer, probed: null, unprobed: null, noConsumer:
             [...uniq.values()].filter(r => !r.consumedBy).map(r => r.tag) };
  const probedSet = new Set(C.results.map(r => r.tag));
  const unprobed = [...uniq.keys()].filter(k => !probedSet.has(k));
  return { unique: uniq.size, withConsumer, probed: uniq.size - unprobed.length, unprobed,
           noConsumer: [...uniq.values()].filter(r => !r.consumedBy).map(r => r.tag) };
}

/* ---- THE FINISH LINE, AS A SET OF COUNTS ------------------------------------------------------
 * "Is MEDICHAM done" as one command instead of a judgement. Every row is `have / of` plus what the
 * denominator excludes. A row that cannot be derived says NOT DERIVED and never estimates. */
function finishLine() {
  const rows = [];
  const add = (label, have, of, note, why) => rows.push({ label, have, of, note, why });
  const nd = (label, why) => rows.push({ label, have: null, of: null, note: null, why });

  /* board leaves — IMPORTED, never recomputed. status.js printing its own split from board_state.js
   * is the two-producers-of-one-fact breach that made the closed-row detector disagree with itself
   * on 24 of 292 rows in both directions. */
  try {
    const L = require(D('tests', 'probe_uncompared_leaves.js')).derive();
    add('board leaves compared', L.compared, L.total,
        `${L.declared} declared uncomparable, ${L.total - L.compared - L.declared - L.standing_at_the_boundary}`
        + ` the authority ends in the residual -> ${L.compared + L.standing_at_the_boundary} comparable,`
        + ` ${L.standing_at_the_boundary} standing and unread`,
        'tests/probe_uncompared_leaves.js derive(); the residual split is EVIDENCE, not proof — it '
        + 'assumes the comparator only reads at a turn boundary, which is unverified');
  } catch (e) {
    nd('board leaves compared', 'the leaf derivation would not run: '
       + String((e && e.message) || e).split('\n')[0]);
  }

  /* staged entities that fired */
  const F = readJson(D('data', 'all-mechanics-fire.json'));
  if (F && F.summary) {
    const s = F.summary;
    const mv = s.moves || {}, ab = s.abilities || {}, it = s.items || {};
    const inScope = (o, ...drop) => (+o.exist || 0) - drop.reduce((n, k) => n + (+o[k] || 0), 0);
    const fired = (+mv.resolved || 0) + (+ab.fired || 0) + (+it.fired || 0);
    const scope = inScope(mv) + inScope(ab, 'unreachable') + inScope(it, 'out_of_scope');
    add('staged mechanics that fired', fired, scope,
        `moves ${mv.resolved}/${inScope(mv)}, abilities ${ab.fired}/${inScope(ab, 'unreachable')}`
        + ` (${ab.unreachable} no legal carrier), items ${it.fired}/${inScope(it, 'out_of_scope')}`
        + ` (${it.out_of_scope} out of scope); ${(+ab.did_not_fire || 0) + (+it.did_not_fire || 0)}`
        + ' staged and never fired',
        'data/all-mechanics-fire.json summary.*.{exist,fired,resolved,unreachable,out_of_scope}');
    const b = s.boards || {};
    const rowsOf = k => (b[k] && b[k].rows) || 0;
    add('mechanics with a board compared', rowsOf('moves') + rowsOf('abilities') + rowsOf('items'),
        (+mv.exist || 0) + (+ab.exist || 0) + (+it.exist || 0),
        `moves ${rowsOf('moves')}/${mv.exist}, abilities ${rowsOf('abilities')}/${ab.exist},`
        + ` items ${rowsOf('items')}/${it.exist} — a row with no board is a mechanic whose EFFECT`
        + ' nothing compared, however clean its protocol line was',
        'data/all-mechanics-fire.json summary.boards.<kind>.rows vs summary.<kind>.exist');
  } else nd('staged mechanics that fired', 'data/all-mechanics-fire.json absent or has no summary');

  /* tags: a consumer, and a probe */
  const TC = tagCoverage();
  if (TC) {
    add('tags with an engine consumer', TC.withConsumer, TC.unique,
        `${TC.unique - TC.withConsumer} tags no line of engine/board.js or engine/medicham2-browser.js`
        + ' reads — derived, not declared: tag_dex.js greps both engines for the tag probe',
        'data/tags.json tags[].consumedBy');
    if (TC.probed == null) nd('tags with a census probe', 'data/mechanics-census.json absent');
    else add('tags with a census probe', TC.probed, TC.unique,
        `${TC.unprobed.length} tags nothing probes at all`,
        'data/tags.json x data/mechanics-census.json results[].tag');
  } else nd('tags with an engine consumer', 'data/tags.json absent');

  /* the damage differential's excluded moves — DERIVED THROUGH THE SAME DOOR the instrument uses.
   * tests/test-engine-diff.js builds its skip set as `tags.moves[id].tags includes 'multiHit'`, so
   * this reads that, never a list of names and never the dex's own `multihit` field. */
  const Dd = readJson(D('data', 'engine-diff.json'));
  const T = readJson(D('data', 'tags.json'));
  if (T && T.moves) {
    const all = Object.keys(T.moves);
    const mh = all.filter(id => (T.moves[id].tags || []).indexOf('multiHit') >= 0);
    const drawn = Object.keys((Dd && Dd.skipped_multihit_moves) || {});
    const never = mh.filter(id => drawn.indexOf(id) < 0);
    add('moves the damage diff can compare', all.length - mh.length, all.length,
        `${mh.length} carry the multiHit tag and are skipped by construction — one moveHit call is`
        + ` one packet. ${drawn.length} were drawn and skipped`
        + (Dd ? ` ${Dd.skipped_multihit} times` : '') + `, ${never.length} were never drawn at all`
        + (never.length ? ` (${never.join(', ')})` : ''),
        'data/tags.json moves[].tags multiHit — the same set tests/test-engine-diff.js skips on');
  } else nd('moves the damage differential can compare', 'data/tags.json has no moves block');

  /* a mechanic staged at one point of a declared range */
  const R = rangeStaged();
  if (R) {
    if (!R.length) add('ranged mechanics fully staged', 0, 0,
        'no tag param declares a range wider than one — nothing to widen', 'data/tags.json params.*.range');
    else {
      const full = R.filter(r => r.interior === 0).length;
      const pts = [...new Set(R.map(r => r.width))].sort((a, b) => a - b);
      add('ranged mechanics fully staged', full, R.length,
          `the two pinned arms reach the two ENDS of a range, never its interior. `
          + `${R.length - full} entit${R.length - full === 1 ? 'y is' : 'ies are'} wider than two points`
          + ` (${[...new Set(R.map(r => r.tag))].join(', ')}, width ${pts.join('/')}): `
          + `${R.filter(r => r.interior).map(r => r.id + ' ' + (r.lo + 1) + '-' + (r.hi - 1)).join(', ')}`
          + ' — those counts are reached by no arm, and the damage differential skips these moves'
          + ' outright, so nothing in the project compares them there either',
          'data/tags.json params.<tag>.range, ends reached per tests/probe_multihit_corners.js — '
          + 'derived from the declared range, never from the roster row note, which was wrong for nine days');
    }
  } else nd('ranged mechanics fully staged', 'data/tags.json absent');

  /* the whole game, and how far into it */
  const G = readJson(D('data', 'game-differential.json'));
  if (G) {
    const cap = G.turns_cap;
    const st = G.state || {};
    add('turn boundaries compared', st.turn_boundaries_compared == null ? null : st.turn_boundaries_compared,
        st.turn_boundaries_compared == null ? null : st.turn_boundaries_compared,
        `${G.games} games, turns_cap ${cap == null ? 'NOT RECORDED' : cap}`
        + (G.coverage && G.coverage.median_turn_of_first_board_divergence != null ? '' : '')
        + (cap != null && G.coverage && G.coverage.median_completed_turns_before_divergence === cap
            ? ` — the median game completes ${cap} turns, i.e. it ENDS AT THE CAP, so turn ${cap + 1} onward`
              + ' is compared by nothing'
            : '')
        + `; ${(G.closet && G.closet.teams_dropped) || 0} teams dropped from the pool`,
        'data/game-differential.json turns_cap / state.turn_boundaries_compared / closet.teams_dropped');
    if (G.coverage) add('entities exercised in a real game', G.coverage.exercised, G.coverage.measurable,
        `${(G.coverage.unmeasurable_by_this_instrument || []).length} unmeasurable by this instrument,`
        + ` ${(G.coverage.not_exercised || []).length} measurable and not exercised,`
        + ` ${(G.coverage.clicked_but_never_connected || []).length} clicked and never connected`,
        'data/game-differential.json coverage.*');
  } else nd('turn boundaries compared', 'data/game-differential.json absent');

  return rows;
}

/* ---- RENDERING -------------------------------------------------------------------------------- */
const wrap = (s, indent, width = 118) => {
  const outl = []; let line = ' '.repeat(indent);
  for (const w of String(s).split(/\s+/)) {
    if (line.trim() && (line + w).length > width) { outl.push(line.replace(/\s+$/, '')); line = ' '.repeat(indent) + w + ' '; }
    else line += w + ' ';
  }
  if (line.trim()) outl.push(line.replace(/\s+$/, ''));
  return outl;
};

function lines() {
  const L = [];
  READS.clear();
  L.push('COVERAGE — WHAT THE VERDICTS ABOVE DO NOT COVER. Every count is derived; NOT DERIVED means no artifact says it.');
  for (const r of finishLine()) {
    if (r.have == null && r.of == null) {
      L.push('  ' + r.label.padEnd(40) + 'NOT DERIVED');
      L.push(...wrap(r.why, 42));
      continue;
    }
    const head = r.of != null && r.have !== r.of ? `${r.have} of ${r.of}` : `${r.have}`;
    L.push('  ' + r.label.padEnd(40) + head);
    if (r.note) L.push(...wrap(r.note, 42));
    if (r.why) L.push(...wrap('<- ' + r.why, 42));
  }
  /* THE AGE OF EVERY INPUT, BESIDE THE COUNTS DRAWN FROM IT. `open_work.js` has stamped artifact age
   * for weeks and the gate never did, so a verdict and a two-day-old artifact printed identically. */
  const ages = [...READS].sort().map(f => ({ f, a: artifactAge(f) })).filter(x => x.a);
  if (ages.length) {
    L.push(...wrap('READ FROM, AND HOW OLD — '
      + ages.map(x => x.f + ' ' + humanAge(x.a.ageMs)).join(';  '), 2));
    const live = ages.filter(x => x.a.beingWritten);
    if (live.length) L.push(...wrap('*** ' + live.map(x => x.f).join(', ')
      + ' changed on disk in the last minute. ANOTHER PROCESS MAY STILL BE WRITING. A torn read is a '
      + 'plausible, well-formed, completely fictitious answer — re-run this when the writer is done '
      + 'rather than trusting the block above.', 2));
  }
  return L;
}

/* The scope tail for one gate clause, as status.js appends it under the clause. */
function clauseLines(clause, cache, indent) {
  const s = clauseScope(clause, cache);
  if (!s) return [];
  const out = [];
  const A = artifactAge(s.file);
  if (A) {
    out.push(...wrap(`READ FROM ${s.file}, ${humanAge(A.ageMs)}`
      + (A.beingWritten ? '  *** WRITTEN IN THE LAST MINUTE — ANOTHER PROCESS MAY STILL BE WRITING IT. '
        + 'A torn read is a plausible, well-formed, completely fictitious answer, not an error.' : ''), indent));
  }
  const bits = [];
  for (const b of s.bounds) bits.push(`${b.path} ${b.n}`);
  for (const g of s.residual) bits.push(`${g.path === '(root)' ? '' : g.path + '.'}${g.acc} ${g.accN} of ${g.pop} ${g.popN} — ${g.gap} unaccounted`);
  /* THE BIGGEST EXCLUSIONS FIRST AND THE TAIL COUNTED, NOT DROPPED. A clause carrying twenty scope
   * fields printed in full is a wall, and a wall is skimmed — which is the failure this file exists
   * to fix, arriving from the other side. The count of what is not shown is itself a scope line. */
  const SHOW = 8;
  for (const e of s.excluded.slice(0, SHOW)) {
    const p = PROSE[e.path] || PROSE[e.path.split('.').pop()];
    bits.push(`${e.path} ${e.n}${p ? ' (' + p + ')' : ''}`);
  }
  if (s.excluded.length > SHOW) bits.push(`+${s.excluded.length - SHOW} smaller exclusion(s) — `
    + 'node engine/coverage.js --audit');
  if (!bits.length) return out;
  out.push(...wrap(`SCOPE${s.stale ? ' (last run — the artifact is stale, so this is the harness\'s shape, '
    + 'not a claim about this engine)' : ''} — ${s.file}: ` + bits.join(';  '), indent));
  return out;
}

module.exports = { EXCLUSION_RX, BOUND_RX, scopeFields, residual, rangeStaged, gateArtifacts,
                   clauseArtifact, clauseScope, clauseLines, finishLine, lines, tagCoverage,
                   artifactAge, humanAge, wrap };

if (require.main !== module) return;

if (process.argv.includes('--audit')) {
  /* EVERY artifact, not the ones a clause happens to read — this is where a scope field nobody has
   * wired shows up. `unclassified` is printed for the gate's own artifacts so a reader can see the
   * field names the vocabulary did NOT recognise. */
  const files = fs.readdirSync(D('data')).filter(f => f.endsWith('.json'));
  const gate = new Set(gateArtifacts());
  let n = 0, withScope = 0;
  for (const f of files.sort()) {
    const j = readJson(D('data', f));
    if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
    n++;
    const s = scopeFields(j), r = residual(j);
    if (!s.excluded.length && !r.length) continue;
    withScope++;
    console.log((gate.has(f) ? '* ' : '  ') + f);
    for (const e of s.excluded) console.log('      EXCLUDED  ' + e.path.padEnd(48) + e.n);
    for (const g of r) console.log('      RESIDUAL  ' + (g.path + ' ' + g.acc + '/' + g.pop).padEnd(48) + g.gap);
    /* THE NAMES THE VOCABULARY DID NOT RECOGNISE, for the gate's own artifacts only. This is the
     * partial answer to the limitation in this file's header: an exclusion called `volleysNotRun`
     * cannot be MATCHED, but it can be SHOWN, so a reader auditing a new instrument sees the field
     * names that exist rather than only the ones a regex happened to know. */
    if (gate.has(f)) {
      const names = s.unclassified
        /* depth 1 and 2 only, and never the per-name breakdown OF an exclusion already reported
         * (`skipped_multihit_moves.pinmissile` is not a second gap, it is the first one itemised) */
        .filter(u => u.path.split('.').length <= 2
                  && !EXCLUSION_RX.test(u.path.split('.')[0]))
        .map(u => u.path);
      if (names.length) console.log(wrap('UNMATCHED numeric fields (shown, not classified — read them '
        + 'yourself before trusting the exclusions above): ' + names.join(' '), 6).join('\n'));
    }
  }
  console.log(`\n  ${withScope} of ${n} artifacts under data/ record a non-zero exclusion or residual.`);
  console.log('  * marks an artifact a gate clause reads. Vocabulary: engine/coverage.js EXCLUSION_RX.');
  process.exit(0);
}
console.log(lines().join('\n'));

/* THE READS THAT FAILED, PRINTED. A coverage report is a claim about what is NOT covered, so a read
 * that failed in silence would understate the very hole this file exists to show. An absent artifact
 * is a legitimate state and prints as NOT DERIVED above -- this says HOW MANY there were, so 'one
 * artifact missing' and 'nothing on disk parsed' cannot look identical. */
if (COVFAILS.readJson || COVFAILS.gateSource || COVFAILS.artifactStat) {
  console.error('');
  console.error('  READS THAT FAILED -- some counts above read NOT DERIVED for this reason,');
  console.error('  not because the work is done:');
  console.error('    artifacts absent or unparseable: ' + COVFAILS.readJson
    + (COVFAILS.readJsonFirst ? '  (first: ' + COVFAILS.readJsonFirst + ')' : ''));
  console.error('    gate sources unreadable, so the artifact list is INCOMPLETE: ' + COVFAILS.gateSource);
  console.error('    artifacts with no file on disk, so no age: ' + COVFAILS.artifactStat);
}
