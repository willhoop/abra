/* tags.js — the ONE loader for data/tags.json.
 *
 * Everything the tag sweep derived lives in data/tags.json, and until this file existed nothing in
 * the engine opened it: zero of board.js, medicham2-browser.js, magnemite.js and mew.js. 172 tags
 * were a specification, not a component. That is this repository's recurring failure -- built,
 * saved, quoted, never used -- and it is the whole reason to wire rather than keep tagging.
 *
 * TWO WAYS TO ASK:
 *
 *   tagsFor('item', 'lifeorb')        -> { tags: [...], params: {...} }   what does THIS thing do
 *   reactorsTo('contact')             -> { abilities, items, moves }      who cares about this key
 *
 * The second is the linkage dispatch. A move exposes properties; items and abilities subscribe to
 * them. Asking once per (move, target) replaces a branch per mechanic, and it is what makes the
 * remaining ~100 unread tags wirable as a group rather than one at a time.
 *
 * COUNTERS. Every lookup that actually returns something is counted, and hit() exposes the totals.
 * A capability that cannot prove it ran is assumed broken -- tests/test-wiring.js asserts these are
 * non-zero after real games, because five capabilities in this project were present, ran clean, and
 * did nothing at all.
 */
'use strict';
/* WRAPPED IN AN IIFE so the file can be a <script> tag as well as a module. Browser scripts SHARE
 * one top-level lexical scope, so an unwrapped `const norm` here collides with the identical
 * declaration in engine/board.js and BOTH files fail to parse — which is exactly what happened the
 * first time this was loaded in a page. engine/mc_key.js is wrapped for the same reason. */
(function (root) {

const HAS_REQUIRE = typeof require === 'function';
const path = HAS_REQUIRE ? require('path') : null;

let DB = null;
const COUNT = Object.create(null);

function load() {
  if (DB) return DB;
  /* THE BROWSER PATH, AND IT IS NOT COSMETIC.
   *
   * engine/board.js falls back to `globalThis.ABRA_TAGS` when it cannot require this module, and
   * tests it for a `.has()` method — but data/abra-tags.js publishes ABRA_TAGS as raw DATA, with no
   * methods on it. So in a browser board.js latched `_TAGS = false` and every tag lookup returned
   * null. board.js's own comment says what that costs: healValue, screenValue and speedSwing are
   * among the largest positive weights in the shipped vector, and all three silently read 0.
   *
   * Measured 2026-08-02 by tests/test-board-browser.js, which found those three among 14 features
   * where a browser-hosted board.js disagreed with the engine. Publishing the API here — over the
   * same data file the page already loads — is what makes the two runtimes the same scorer rather
   * than two that merely share a name. */
  if (!HAS_REQUIRE) {
    const g = (typeof globalThis !== 'undefined') ? globalThis : {};
    DB = g.ABRA_TAGS || null;
    if (!DB) throw new Error('engine/tags.js: no data/abra-tags.js loaded — include it before board.js');
    return DB;
  }
  try {
    DB = require(path.join(__dirname, '..', 'data', 'tags.json'));
  } catch (e) {
    /* Missing artifact must be LOUD, not a silent fall-through to "no tags". A quiet empty table
     * would make every consumer behave exactly as it did before wiring and report success. */
    throw new Error('engine/tags.js: cannot load data/tags.json — run `node engine/tag_dex.js` first. ' + e.message);
  }
  return DB;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* kind: 'move' | 'item' | 'ability' */
const TABLE = { move: 'moves', item: 'items', ability: 'abilities' };

function tagsFor(kind, id) {
  const db = load();
  const t = db[TABLE[kind]];
  if (!t) return null;
  const rec = t[norm(id)];
  if (!rec) return null;
  COUNT[kind] = (COUNT[kind] || 0) + 1;
  return rec;
}

/* Does this thing carry that tag? Returns the tag's PARAMETERS, which is what a consumer needs --
 * never a bare boolean, because a boolean instead of a parameter was the single most common defect
 * the review turned up (Swift Swim not naming rain, Sitrus not naming the amount). */
/* ASKED AND FOUND ARE DIFFERENT QUESTIONS, AND COLLAPSING THEM MADE THIS INSTRUMENT USELESS.
 *
 * `hits()` has existed since this module was written and NOTHING has ever called it. Worse, it could
 * not have answered the question it exists for. `param()` counted a tag only when the entity CARRIED
 * it, and `has()` counted nothing at all — so a tag with a zero reading could mean either of two
 * completely different things:
 *
 *   ASKED = 0            no consumer exists anywhere in the engine. The tag is DEAD.
 *   ASKED > 0, FOUND = 0 a consumer exists and never met a body carrying the tag. That is a STAGING
 *                        gap in whatever battery was run, not a wiring defect.
 *   FOUND > 0            a consumer read real data off a real entity.
 *
 * Those demand opposite responses — write code, versus write a better probe — and one counter cannot
 * tell them apart. Will, 2026-08-04: *"CAN WE DESIGN TESTS THAT CHECK ALL THE MOST COMMON MOVES,
 * ITEMS, ABILITIES, AND MONS AND SEE IF ALL THE TAGS ACTUALLY GET USED IN THE ENGINE"*. This is the
 * cheap tier of that answer: run any battery, read the counters, and every tag at ASKED = 0 is
 * unconsumed with no probe required.
 *
 * It does NOT prove the read had an effect — a consumer can read a tag and ignore it, which is the
 * `hitsAlly` shape. That needs the mutation tier (docs/TAG-COVERAGE.md). ASKED = 0 is decisive;
 * FOUND > 0 is necessary and not sufficient. */
const ASKED = Object.create(null);

function param(kind, id, tag) {
  ASKED[tag] = (ASKED[tag] || 0) + 1;
  const rec = tagsFor(kind, id);
  if (!rec || !rec.tags || !rec.tags.includes(tag)) return null;
  COUNT[tag] = (COUNT[tag] || 0) + 1;
  return (rec.params && rec.params[tag]) || {};
}

/* `has()` counted NOTHING, and it is a first-class consumer path — `clearsScreens`, `ignoresProtect`
 * and every derived set reach the artifact through here. Every one of them was invisible. */
function has(kind, id, tag) {
  ASKED[tag] = (ASKED[tag] || 0) + 1;
  const rec = tagsFor(kind, id);
  const yes = !!(rec && rec.tags && rec.tags.includes(tag));
  if (yes) COUNT[tag] = (COUNT[tag] || 0) + 1;
  return yes;
}

function reactorsTo(key) {
  const db = load();
  const l = db.linkage && db.linkage[key];
  if (!l) return { abilities: [], items: [], moves: [] };
  COUNT['key:' + key] = (COUNT['key:' + key] || 0) + 1;
  return l;
}

/* Read the counters. Used by tests/test-wiring.js to prove each wired tag fired in a real game. */
function hits() { return Object.assign(Object.create(null), COUNT); }
function resetHits() {
  for (const k of Object.keys(COUNT)) delete COUNT[k];
  for (const k of Object.keys(ASKED)) delete ASKED[k];
}
/* Every tag the engine ASKED about, whether or not the entity carried it. A tag absent from this is
 * one no line of engine code looks for. */
function asked() { return Object.assign(Object.create(null), ASKED); }

/* Enumerate every id of one kind carrying a tag — the consumer for derived SETS (the spread table
 * in medicham2 builds from this instead of a 34-name list). Counted like every other read. */
function withTag(kind, tag) {
  const db = load();
  const K = { move: 'moves', item: 'items', ability: 'abilities' };
  const T = db && db[K[kind]];
  if (!T) return [];
  ASKED[tag] = (ASKED[tag] || 0) + 1;
  COUNT[tag] = (COUNT[tag] || 0) + 1;
  return Object.keys(T).filter(id => (T[id].tags || []).includes(tag));
}

/* PUBLISHED BOTH WAYS, like engine/mc_key.js and engine/board.js. In node this is the module; in a
 * browser it REPLACES globalThis.ABRA_TAGS — the raw data table published by data/abra-tags.js —
 * with this same API over that data. board.js tests ABRA_TAGS for `.has`, so the object it finds has
 * to be the accessor, not the artifact. Sharing the artifact was never enough; the ACCESSOR has to
 * be shared too (docs/ARTIFACT-ACCESS-RULES.md R1). */
const _API = { tagsFor, param, has, reactorsTo, hits, asked, resetHits, norm, withTag };
if (typeof module !== 'undefined' && module.exports) module.exports = _API;
if (!HAS_REQUIRE && typeof globalThis !== 'undefined') {
  if (globalThis.ABRA_TAGS && !globalThis.ABRA_TAGS.has) DB = globalThis.ABRA_TAGS;   // keep the data
  globalThis.ABRA_TAGS = _API;
  globalThis.TAGS = _API;
}
})(typeof globalThis !== 'undefined' ? globalThis : this);
