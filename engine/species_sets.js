/* species_sets.js — draw a REAL set for a species, the way the metagame actually plays it.
 *
 * WHY (Will, 2026-07-31: "what if pokemon often use multiple sets")
 * ----------------------------------------------------------------
 * They do, and it is not a detail. Measured over the clean open-sheet corpus:
 *
 *   USAGE-WEIGHTED, ONLY 24.5% OF REAL POKEMON MATCH THEIR SPECIES' MODAL SET.
 *
 *   incineroar   13% modal, 329 distinct sets, 48 needed to cover 80% of its usage
 *   sinistcha     7% modal, 339 distinct sets, 63 needed
 *   whimsicott   34% modal, 324 distinct sets, 49 needed
 *   garchomp     33% modal, 305 distinct sets, 26 needed
 *   charizard    60% modal, 109 distinct sets,  5 needed   <- the one standardised mon
 *
 * data/engine-data.js can only hold ONE set per species, so building from MC.mons models about a
 * quarter of the metagame and silently asserts the rest away. That is a large improvement on what it
 * held before (sets from a foreign dataset — Garchomp with Outrage and Thrash, moves nobody in this
 * format runs) but it is still wrong three times in four.
 *
 * data/species-sets.json already carries the whole distribution with counts. This module is the
 * reader, so a consumer can ask for the modal set OR sample the way the meta actually is:
 *
 *   DITTO's gauntlet   MUST sample. Optimising a team against 3,753 opponents who all run the modal
 *                      set is optimising against a metagame that does not exist.
 *   rollouts           SHOULD sample, so variance across games reflects real set variance.
 *   the Battle Tower   SHOULD sample, so the same species is not the same Pokemon every battle.
 *   a display          MAY take the modal set, when one representative example is the point.
 *
 * NOTHING HERE IS TYPED. Every set, count and share comes from engine/derive_sets.js reading real
 * sheets. If this file has no data for a species, it says so and returns null rather than inventing
 * a fallback — the fallback is the caller's decision to make explicitly.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'species-sets.json');

let _db = null;
function db() {
  if (_db) return _db;
  let raw;
  try { raw = fs.readFileSync(FILE, 'utf8'); }
  catch (e) {
    /* LOUD. A missing distribution must not degrade quietly into "every species is unknown", which
     * would make every caller fall back to the single modal set without anyone noticing. */
    throw new Error(`species_sets: cannot read ${FILE} — ${e.message}. `
      + 'Run: node engine/derive_sets.js');
  }
  _db = JSON.parse(raw);
  return _db;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* How many real sheets back this species. The caller decides what depth it needs; a species seen
 * three times is data, but it is not a distribution. */
function depth(species) {
  const e = db().species[norm(species)];
  return e ? e.n : 0;
}

function distinct(species) {
  const e = db().species[norm(species)];
  return e ? e.distinct_sets : 0;
}

/* The single most-played set. Honest for a display, wrong for a gauntlet. */
function modal(species) {
  const e = db().species[norm(species)];
  return (e && e.sets && e.sets[0]) ? e.sets[0] : null;
}

/* Draw one set in proportion to how often it is actually played.
 *
 * rng is injected rather than taken from Math.random, because every sampling path in this project
 * has to be reproducible from a seed — a gauntlet you cannot replay is a gauntlet you cannot debug. */
function sample(species, rng) {
  const e = db().species[norm(species)];
  if (!e || !e.sets || !e.sets.length) return null;
  const r = (typeof rng === 'function' ? rng() : Math.random()) * e.n;
  let acc = 0;
  for (const s of e.sets) { acc += s.n; if (r < acc) return s; }
  return e.sets[e.sets.length - 1];        // float drift on the last bucket
}

/* The smallest set of sets covering `frac` of this species' real usage — the honest way to bound a
 * search. Incineroar needs 48 to reach 80%; Charizard needs 5. A caller that wants "the sets that
 * matter" should ask for coverage, not for a top-N, because N means something different per species. */
function cover(species, frac) {
  const e = db().species[norm(species)];
  if (!e || !e.sets) return [];
  const want = e.n * (frac == null ? 0.8 : frac);
  const out = [];
  let acc = 0;
  for (const s of e.sets) { out.push(s); acc += s.n; if (acc >= want) break; }
  return out;
}

/* Every species with at least `min` sightings, most-played first. The gauntlet's species pool. */
function speciesWithDepth(min) {
  const d = db().species;
  return Object.keys(d).filter(k => d[k].n >= (min || 10)).sort((a, b) => d[b].n - d[a].n);
}

module.exports = { modal, sample, cover, depth, distinct, speciesWithDepth, FILE,
  meta: () => ({ generated: db().generated, games: db().games, sheet_entries: db().sheet_entries }) };
