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

  /* ---- COSMETIC FORMES ------------------------------------------------------------------------
   *
   * Vivillon-Pokeball, Maushold-Four and Sinistcha-Masterpiece are on real open team sheets and are
   * not in the table. They are the same Pokemon as their base for every purpose the damage formula
   * has: IDENTICAL base stats and IDENTICAL types. Falling back to the base is not an approximation,
   * it computes the same number.
   *
   * THE DISCRIMINATOR IS DERIVED, AND IT MATTERS THAT IT IS EXACT. Slowking-Galar is Poison/Psychic
   * where Slowking is Water/Psychic; Rotom-Wash and Ninetales-Alola likewise differ in both stats and
   * types; Gourgeist-Super shares Gourgeist's types but not its stats. Falling those back would hand
   * the damage engine the wrong body, which is far worse than returning null -- null at least counts
   * itself in dmgFailures. So the rule is the strictest one available:
   *
   *     fall back to the base species ONLY when base stats AND types are identical.
   *
   * `cosmeticFormes` is not populated in the Champions mod, so it cannot be asked directly; the stats
   * and types are, and they are the property that actually licenses the substitution.
   *
   * NODE ONLY, BY DESIGN. This needs the dex, which the browser copy of the engine does not have.
   * The require is guarded and cached, so a browser caller keeps exactly today's behaviour and a node
   * caller needs no new argument -- dmgMon has no dex in scope and should not have to grow one. */
  let alias = null;
  function cosmeticAliases() {
    if (alias) return alias;
    alias = new Map();
    try {
      /* THE BROWSER GETS THESE ALIASES TOO, and until 2026-08-02 it silently did not.
       *
       * This line was `if (typeof require !== 'function') return alias;` — an empty map returned
       * without a word, directly above a catch block that had been deliberately made LOUD for the
       * very same failure. The cost was measured, not argued: with board.js running in a page,
       * `sinistchamasterpiece` resolved to null instead of `sinistcha`, so dmgMon returned nothing
       * and every damage-derived feature for that Pokemon read zero while node had them all.
       * Sinistcha is on 5.3% of teams in this format.
       *
       * data/board-data.js now publishes __ABRA_DEX carrying types, baseStats and baseSpecies —
       * exactly what the discriminator needs. Same rule, same data, both runtimes. */
      const CS = (typeof require === 'function') ? require('./champions_sim.js') : null;
      const dex = CS ? CS.sim().Dex.forFormat(CS.FORMAT) : (root && root.__ABRA_DEX);
      if (!dex || !dex.species || typeof dex.species.all !== 'function') {
        throw new Error('no dex available — in a browser, load data/board-data.js before this file');
      }
      for (const s of dex.species.all()) {
        if (!s.exists || !s.baseSpecies || s.baseSpecies === s.name) continue;
        const b = dex.species.get(s.baseSpecies);
        if (!b || !b.exists) continue;
        if (s.types.join('|') !== b.types.join('|')) continue;
        if (JSON.stringify(s.baseStats) !== JSON.stringify(b.baseStats)) continue;
        alias.set(flat(s.name), flat(b.name));
      }
    } catch (e) {
      /* Reported, not swallowed: without the dex this silently reverts to the old behaviour, and a
       * silent revert to a known-worse path is the failure mode this whole file exists to end. */
      if (typeof console !== 'undefined' && console.error) {
        console.error('mc_key: cosmetic-forme aliases unavailable (' + e.message + '); '
          + 'forme names not in the table will resolve to null as before.');
      }
    }
    return alias;
  }

  /* A MISS MUST BE DECLARED. See engine/lookup.js for why this is the shape of every expensive bug
   * this project has had. `mcKey(sp)` throws if the species is not in the table; a caller that
   * genuinely expects misses passes `{ mayMiss: '<why>' }` and the reason is greppable.
   *
   * Loaded the same dual way as everything else here, so the browser keeps working; without the
   * module the old permissive behaviour stands rather than the file failing to load. */
  const LK = (typeof require === 'function') ? require('./lookup.js')
           : (root && root.ABRA_LOOKUP) || null;
  const miss = (v, key, opts, hint) => LK ? LK.resolve(v, 'MC.mons', key, opts, hint) : (v || null);

  function mcKey(name, opts) {
    /* Rebuilt if the table object itself was replaced -- merge_mega_into_engine.js mutates MC.mons,
     * and a cached index over a stale object is exactly the kind of quiet wrongness this file is
     * meant to end. */
    if (!index || builtFrom !== (root.MC && root.MC.mons)) index = build();
    if (!index) return miss(null, name, opts, 'MC.mons is not loaded at all');
    const f = flat(name);
    /* Exact only. Megas are their OWN entries here (`gengar-mega` carries real mega base stats), so a
     * mega that IS in the table is found on this line.
     *
     * THE BLANKET `mega` STRIP THAT USED TO SIT HERE WAS UNSOUND, and tests/test-mc-key.js found it
     * the day the same-body rule was written. `f.replace(/mega[xy]?$/,'')` answered Victreebel for
     * Victreebel-Mega, Skarmory for Skarmory-Mega and so on -- handing the damage engine the
     * UNEVOLVED body for a mega, which is the exact error the cosmetic rule below refuses to make.
     * It was inherited from board.js's original `baseSpecies` fallback and predates this file.
     *
     * A mega the table does not carry now resolves to null, which is honest and counts itself in
     * dmgFailures, instead of silently computing with the wrong stats. */
    const direct = index.get(f);
    if (direct) return direct;
    const cos = cosmeticAliases().get(f);
    return miss((cos && index.get(cos)) || null, name, opts,
      'the table keys formes with a hyphen; the cosmetic-forme fallback also found nothing');
  }

  /* For tests that swap the table underneath. */
  mcKey.reset = () => { index = null; builtFrom = null; alias = null; };

  const api = { mcKey, flat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MCKEY = api; root.mcKey = mcKey; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
