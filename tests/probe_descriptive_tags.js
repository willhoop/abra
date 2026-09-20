/* probe_descriptive_tags.js — A TAG MAY ONLY BE CALLED DESCRIPTIVE WHILE SOMETHING ELSE REALLY DOES
 * THE WORK. 2026-09-19.
 *
 *   node tests/probe_descriptive_tags.js
 *   TAG_DESCRIPTIVE_BREAK=needsUntrackedState node tests/probe_descriptive_tags.js     (the red arm)
 *
 * `engine/tag_descriptive.js` takes two move tags out of coverage.js's unread column on the grounds
 * that they name a DEPENDENCY and the behaviour lives on another tag on the same row. That is a claim
 * with three ways to rot, and none of them announces itself:
 *
 *   1. the behaviour tag is deleted or renamed, so the carrier has no behaviour at all;
 *   2. the behaviour tag loses its engine reader, so `consumedBy` goes null and the row is genuinely
 *      unread while still being excused here;
 *   3. the behaviour stops being PROBED, so nothing measures it against the authority any more and
 *      "it works" becomes an assertion.
 *
 * SO ALL THREE ARE ASSERTED, PER IN-SCOPE CARRIER, off the artifacts themselves:
 *   A  every in-scope carrier of a descriptive tag also carries one of its declared `via` tags
 *   B  every `via` tag a carrier actually uses has a non-empty `consumedBy` in data/tags.json
 *   C  the descriptive tag AND every used `via` tag have a LIVE, non-hollow row in the census
 *
 * IT DOES NOT PLAY A GAME, DELIBERATELY. Clause C's census rows are what play the game: they are the
 * measurements against Showdown (Gyro Ball 30 Spe deals 81 / 150 Spe deals 18; Acrobatics 15 holding
 * Leftovers, 29 holding nothing; Rage Fist, Last Respects and Electro Ball each with their own rows).
 * Re-staging them here would be a second instrument answering a question the census already answers,
 * which is the two-implementations-of-one-fact breach. What this file adds is the LINK — that the
 * excuse and the evidence are about the same rows.
 *
 * `TAG_DESCRIPTIVE_BREAK=<tag>` empties that tag's `via` list, which must fail clause A on every one
 * of its carriers. Run it before trusting a green.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const fs = require('fs');

const { DESCRIPTIVE } = require(D('engine', 'tag_descriptive.js'));
const BREAK = process.env.TAG_DESCRIPTIVE_BREAK || '';

const T = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
const C = JSON.parse(fs.readFileSync(D('data', 'mechanics-census.json'), 'utf8'));
const BLOCK = { move: 'moves', item: 'items', ability: 'abilities' };

/* THE LEGAL SCOPE FROM THE ONE PRODUCER. A failure to derive is a refusal, not a fallback to "every
 * carrier in the artifact": an unscoped run would judge the claim on entities this format cannot
 * bring, which is the `.all()` trap CLAUDE.md names. */
let S = null, scopeWhy = '';
try { S = require(D('engine', 'legal_scope.js')).derive(); }
catch (e) { scopeWhy = String((e && e.message) || e).split('\n')[0]; }
if (S && typeof S.inScope !== 'function') { scopeWhy = 'legal_scope.derive() returned no inScope()'; S = null; }
if (!S) {
  console.log('CANNOT ANSWER — the legal scope did not derive (' + scopeWhy + '). This is not a pass.');
  process.exit(2);
}

const consumedBy = (tag, kind) => {
  const row = (T.tags || []).find(r => r.tag === tag && r.kind === kind);
  return row && row.consumedBy && String(row.consumedBy).trim() ? String(row.consumedBy) : null;
};
const censusLive = tag => (C.results || []).some(r => r.tag === tag && r.live && !r.hollow);
const censusRows = tag => (C.results || []).filter(r => r.tag === tag && r.live && !r.hollow).length;

console.log('\nDESCRIPTIVE TAGS — the excuse and the evidence, checked against each other.');
console.log('  data/tags.json generated ' + T.generated);
console.log('  data/mechanics-census.json ' + (C.generated || '?') + '   '
  + ((C.results || []).length) + ' rows');
if (BREAK) console.log('  *** TAG_DESCRIPTIVE_BREAK=' + BREAK + ' — the via list for that tag is EMPTIED. '
  + 'This arm MUST fail. ***');

let bad = 0, carriers = 0;
for (const [tag, dec] of Object.entries(DESCRIPTIVE)) {
  const kind = dec.kind;
  const blk = T[BLOCK[kind]];
  if (!blk) { console.log('  FAIL ' + tag + ' — declares kind "' + kind + '", which data/tags.json has no block for'); bad++; continue; }
  const via = (BREAK === tag) ? [] : (dec.via || []);
  const mem = Object.keys(blk).filter(i => (blk[i].tags || []).includes(tag) && S.inScope(kind, i));
  console.log('\n  ' + tag + '  (' + kind + ')   ' + mem.length + ' in-scope carrier(s): '
    + (mem.join(', ') || '(none)'));
  console.log('      declared via: ' + (via.join(', ') || '(none)'));
  if (!mem.length) {
    console.log('      FAIL — a tag with no in-scope carrier needs no excuse; remove the declaration instead.');
    bad++; continue;
  }
  /* C, first half: the descriptive tag itself must still be measured against the authority. */
  if (!censusLive(tag)) { console.log('      FAIL — no LIVE, non-hollow census row probes ' + tag
    + ', so nothing measures the behaviour this declaration is excusing'); bad++; }
  else console.log('      ok   ' + censusRows(tag) + ' live census row(s) probe ' + tag + ' itself');

  const usedVia = new Set();
  for (const id of mem) {
    carriers++;
    const has = via.filter(v => (blk[id].tags || []).includes(v));
    if (!has.length) {
      console.log('      FAIL ' + id + ' — carries ' + tag + ' and NONE of the declared via tags, so '
        + 'nothing on this row does the work');
      bad++; continue;
    }
    for (const v of has) usedVia.add(v);
    console.log('      ok   ' + id.padEnd(16) + ' via ' + has.join('+'));
  }
  for (const v of usedVia) {
    const cb = consumedBy(v, kind);
    if (!cb) { console.log('      FAIL via tag ' + v + ' has no engine reader (consumedBy null), so the '
      + 'behaviour is not read either'); bad++; }
    else console.log('      ok   via ' + v.padEnd(18) + ' read by  ' + cb);
    if (!censusLive(v)) { console.log('      FAIL via tag ' + v + ' has no LIVE census row'); bad++; }
    else console.log('      ok   via ' + v.padEnd(18) + ' probed by ' + censusRows(v) + ' live census row(s)');
  }
}

console.log('\n  ' + carriers + ' in-scope carrier(s) over ' + Object.keys(DESCRIPTIVE).length
  + ' descriptive tag(s); ' + bad + ' failing clause(s)');
if (bad) console.log('  FAIL — a descriptive declaration is no longer covered by what it names.');
else console.log('  ALL CLAUSES PASS.');
process.exit(bad ? 1 : 0);
