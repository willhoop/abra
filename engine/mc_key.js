/* mc_key.js — the ONE way to turn a species name into a key of the damage engine's mon table.
 *
 *   const { mcKey } = require('./mc_key.js');
 *   const key = mcKey('Rotom-Wash');        // 'rotom-wash', or null if the table has never seen it
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS A FILE RATHER THAN THREE LINES IN EACH CALLER
 * --------------------------------------------------------------------------------
 * `data/engine-data.js` publishes `globalThis.MC`, and MC.mons keys formes WITH A HYPHEN:
 * `rotom-wash`, `slowking-galar`, `ninetales-alola`. The project's `norm()` is
 * `.replace(/[^a-z0-9]/g,'')`, which strips the hyphen. So `MC.mons[norm(species)]` misses every
 * forme entry -- 101 of 308 keys, covering 8.17% of all observed metagame usage.
 *
 * There has only ever been ONE artifact here. Every engine already read the same MC.mons from the
 * same generated file, which is the single-source-of-truth arrangement working exactly as intended.
 * It broke anyway, because each caller wrote its own DOORWAY into that artifact:
 *
 *   engine/medicham2-browser.js   pasteKey()  -- lowercase, spaces to hyphens, then a linear rescan
 *   engine/merge_mega_into_engine.js  byNorm  -- a normalised Map, built inline
 *   engine/board.js               MC.mons[norm(x)]        -- BROKEN until 2026-08-01
 *   engine/backtest_winrate.js    .filter(n => MC.mons[n]) -- BROKEN: silently drops every forme
 *   engine/forced_switch_audit.js MC.mons[norm(x)]        -- BROKEN: returns null for every forme
 *
 * Four implementations of the same three lines, two of them wrong, all written by the same author
 * across different sessions. Sharing the artifact did not prevent that; only sharing the ACCESSOR
 * does. That is the lesson worth keeping: the unit that has to be single-source is the function that
 * reads the data, not just the data.
 *
 * `tests/test-mc-key.js` fails on any new hand-rolled lookup, so this cannot be re-derived a fifth
 * time by someone who has not read this comment.
 *
 * ATTACHES TO globalThis TOO, because engine/medicham2-browser.js runs in a browser with no
 * `require` -- the same pattern engine/board.js uses to publish BOARD. One accessor, both worlds.
 */
(function (root) {
  'use strict';

  /* The table's keys are compared with punctuation removed, so the caller may pass 'Rotom-Wash',
   * 'rotom-wash', 'Rotom Wash' or 'rotomwash' and get the same answer. Nothing here knows the name
   * of a single Pokemon: the index is built from whatever keys the artifact actually contains, so a
   * change to the generator's naming is picked up with no edit. */
  const flat = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let index = null, builtFrom = null;

  function build() {
    const MC = root.MC;
    if (!MC || !MC.mons) return null;
    const m = new Map();
    for (const k of Object.keys(MC.mons)) {
      const f = flat(k);
      /* First key wins. Verified collision-free on the shipped table -- 308 keys, 308 distinct
       * flattened forms -- and tests/test-mc-key.js re-checks that on whatever ships later, because
       * a collision would mean silently resolving to the wrong forme, which is worse than missing. */
      if (!m.has(f)) m.set(f, k);
    }
    builtFrom = MC.mons;
    return m;
  }

  function mcKey(name) {
    /* Rebuilt if the table object itself was replaced -- merge_mega_into_engine.js mutates MC.mons,
     * and a cached index over a stale object is exactly the kind of quiet wrongness this file is
     * meant to end. */
    if (!index || builtFrom !== (root.MC && root.MC.mons)) index = build();
    if (!index) return null;
    const f = flat(name);
    /* Exact first. Megas are their OWN entries in this table (`gengar-mega` has real base stats), so
     * stripping the suffix is a fallback for a caller that passed a mega name the table does not
     * carry -- never a shortcut past a real entry. */
    return index.get(f) || index.get(f.replace(/mega[xy]?$/, '')) || null;
  }

  /* For tests that swap the table underneath. */
  mcKey.reset = () => { index = null; builtFrom = null; };

  const api = { mcKey, flat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MCKEY = api; root.mcKey = mcKey; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
