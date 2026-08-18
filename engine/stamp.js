/* stamp.js — the provenance block every artifact carries, in one shape.
 *
 * RAW-STORE-NOT-READ: this file opens no corpus at all. The store filename appears once, in the usage
 * example below, as the value a CALLER would pass for `corpus:`. engine/selftest.js greps for the
 * filename anywhere in a file, so the documentation of the provenance helper was itself counted as an
 * unfiltered read of the store.
 *
 *   const { stamp } = require('./stamp.js');
 *   fs.writeFileSync(out, JSON.stringify({ ...stamp({ by: 'engine/foo.js', corpus: 'games.ladder.jsonl',
 *                                                     games: n, clean: true }), ...result }));
 *
 * WHY THIS EXISTS
 * ---------------
 * Every model here consumes another model's output, and until now each one described itself
 * differently or not at all. `n_games` in one file, `games` in another, `corpus.games` in a third,
 * and nothing whatsoever in `chomp-ev.json`, `move-priors.json` or `bring-priors.json`. So the
 * question "what was this built from?" had a different answer shape per file, and for several files
 * no answer at all.
 *
 * That is how SLOWKING's equilibrium came to be quoted as evidence while sitting on data computed
 * before the filter that invalidated it. The file looked exactly as authoritative as a fresh one.
 * Nothing about it was checkable, because it did not say anything checkable about itself.
 *
 * THE FOUR THINGS EVERY ARTIFACT MUST STATE
 * -----------------------------------------
 *   corpus   which file the data came from
 *   games    how many, so it can be compared against what exists clean
 *   clean    whether the quality filter was applied — the single most important bit
 *   filter   the version of the filter in force, so a later rule change is detectable
 *
 * `filter` is the modification time of data/quality-filter.json rather than a version somebody
 * types, because a version number is a thing to forget to bump and a timestamp is not. An artifact
 * whose filter stamp predates the current one was computed under different rules about what counts
 * as a usable game, which is exactly the failure this is here to make visible.
 *
 * `raw_store_ok` is the one escape hatch and it takes a REASON, never a boolean. It is the same
 * convention engine/selftest.js enforces on source files, carried into the artifact so a reader sees
 * it without opening the generator. Mechanics may use it; nothing about how people play may.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILTER = path.join(__dirname, '..', 'data', 'quality-filter.json');

/* The filter's identity: its modification time, to the second. Enough to detect "this artifact
 * predates a rule change" without pretending to be a content hash. */
function filterVersion() {
  try { return new Date(fs.statSync(FILTER).mtimeMs).toISOString(); }
  catch (e) {
    /* NULL IS A REAL ANSWER HERE — no filter file means no filter version — but an UNREADABLE
     * filter is a different thing wearing the same null, and every artifact stamped in that
     * state silently claims it predates no rule change (ROADMAP #258). ENOENT stays quiet;
     * anything else says so, once, on stderr, so a stamp run cannot look clean while blind. */
    if (e.code !== 'ENOENT') console.error('stamp: cannot read ' + FILTER + ' — ' + e.message
      + '. Every artifact stamped in this run records NO filter version.');
    return null;
  }
}

function stamp(o) {
  o = o || {};
  if (!o.by) throw new Error('stamp() needs `by` — which generator wrote this');
  if (o.clean === undefined && !o.raw_store_ok) {
    throw new Error(`stamp() for ${o.by} must state clean:true/false, or give a raw_store_ok reason`);
  }
  if (o.raw_store_ok !== undefined && typeof o.raw_store_ok !== 'string') {
    throw new Error(`stamp() for ${o.by}: raw_store_ok must be a REASON, not a boolean`);
  }
  return {
    provenance: {
      generated: new Date().toISOString(),
      by: o.by,
      corpus: o.corpus || null,
      games: o.games != null ? o.games : null,
      clean: o.raw_store_ok ? false : !!o.clean,
      filter: filterVersion(),
      raw_store_ok: o.raw_store_ok || null,
      note: o.note || null,
    },
  };
}

/* Read a provenance block back, tolerating the older hand-rolled shapes so the audit can report on
 * artifacts that have not been migrated yet rather than treating them as absent. */
function readStamp(j) {
  if (!j || typeof j !== 'object') return null;
  if (j.provenance) return j.provenance;
  const legacyGames = ['n_games', 'games', 'gamesUsed', 'nGames'].map(k => j[k]).find(v => typeof v === 'number');
  const nested = j.corpus && typeof j.corpus.games === 'number' ? j.corpus.games : undefined;
  const g = legacyGames !== undefined ? legacyGames : nested;
  if (g === undefined && !j.raw_store_ok) return null;
  return {
    generated: j.generated || null, by: null, corpus: null,
    games: g === undefined ? null : g,
    clean: j.clean === undefined ? null : !!j.clean,
    filter: null, raw_store_ok: j.raw_store_ok || null, legacy: true,
  };
}

module.exports = { stamp, readStamp, filterVersion };
