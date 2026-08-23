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
    seal();                         /* the table may only have appeared just now; see seal() */
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

  /* ---- THE SEAL (2026-08-23) --------------------------------------------------------------------
   *
   * WHY A PROXY AND NOT ANOTHER PATTERN IN tests/test-mc-key.js.
   *
   * Turning a species name into a key of this table has broken FOUR times, twice after it was
   * "fixed and gated", and every fix so far has been A LIST OF WRONG FORMS:
   *
   *   2026-07-30  a builder keyed `venusaurmega`, the artifact keyed `venusaur-mega`  0 of 67 writes
   *   2026-08-01  MC.mons[norm(x)] in four more files                                 101 of 308 keys
   *   2026-08-23  buildMon(s.toLowerCase()) in tests/test-engine-diff.js              138 of 345 species
   *   2026-08-23  a bare `globalThis.` prefix walked past the ratchet in eight files
   *
   * A list cannot catch a form nobody thought of. That is not a defect in the regexes; it is the
   * shape of a static check, and two of the four got through one that was already written.
   *
   * WHAT THE FOUR HAVE IN COMMON IS NOT THE SPELLING. IT IS THE SILENCE. Every one of them returned
   * `undefined` or `null`, which reads as "the engine has never seen this Pokemon" -- a real and
   * common condition -- so every caller carried on and nothing anywhere complained. The bug was
   * therefore invisible for weeks at a time, and in one case inflated a published figure for ten
   * days.
   *
   * So the seal does not try to recognise a wrong spelling. It makes the MISS ITSELF impossible to
   * ignore: reading a key the table does not have THROWS `LookupMiss`, and the message names the key
   * the caller almost certainly meant. There is no prefix, alias, template string, concatenation,
   * destructure or `Reflect.get` that avoids it, because the trap is on the OBJECT and every one of
   * those forms ends in a property access on that object. `tests/test-mc-seal.js` executes all seven
   * of those shapes rather than matching them as text.
   *
   * NODE ONLY BY DEFAULT, AND THE REASON IS NOT TIMIDITY. `web/index.html`, `web/tower.html` and
   * their `app/` twins index `MC.mons` directly in ~20 places with `MC.mons[n]||{}`, expecting a
   * miss; they belong to WEB and are not ENGINE's to rewrite. Sealing in a page would break the site
   * on load. Every one of the four incidents happened under node, which is where every engine, test
   * and instrument in this project runs. A page may opt in with `MCKEY.mcKey.seal({force:true})`
   * once those call sites are routed, and `sealed()` reports the truth either way rather than
   * pretending.
   *
   * ESCAPE HATCHES ARE DECLARED, NEVER SILENT. `build/build_engine_data.js` and
   * `engine/merge_mega_into_engine.js` BUILD this table and must ask "is this key absent" before
   * writing it, which is a legitimate raw question; they call `mcKey.rawTable('<why>')`, the reason
   * is greppable, and `mcKey.rawTable.reasons()` lists every one taken in a run. */
  const SEALED = Symbol.for('abra.mc.sealed');
  const TARGET = Symbol.for('abra.mc.target');

  /* Reads that are NOT species questions and must not throw. Everything reachable on Object.prototype
   * (`toString`, `hasOwnProperty`, `constructor`) is handled by the `in` test in the trap, so this
   * list is only for properties the HOST invents and no object actually carries:
   *   then      -- `await x` and Promise.resolve(x) probe for it; a throw here is unrecoverable
   *   toJSON    -- JSON.stringify probes for it before serialising
   *   inspect / nodeType -- older console.log and DOM duck-typing
   * No Pokemon is named any of these, and the list is short on purpose: every entry is a hole. */
  const HOST = new Set(['then', 'toJSON', 'inspect', 'nodeType']);

  const rawReasons = Object.create(null);
  const isNode = typeof process !== 'undefined' && !!(process.versions && process.versions.node);

  function unwrap(t) { return (t && t[TARGET]) || t; }

  function seal(opts) {
    const MC = root.MC;
    if (!MC || !MC.mons) return false;
    if (MC.mons[SEALED]) return true;
    if (!isNode && !(opts && opts.force)) return false;
    if (typeof Proxy !== 'function') return false;

    const target = MC.mons;
    /* Its own flattened index, built here rather than borrowed from `index`, because the trap must
     * work before anybody has called mcKey() and must not recurse back into build(). */
    const flatIdx = new Map();
    for (const k of Object.keys(target)) if (!flatIdx.has(flat(k))) flatIdx.set(flat(k), k);

    MC.mons = new Proxy(target, {
      get(t, p, r) {
        if (p === SEALED) return true;
        if (p === TARGET) return t;
        if (typeof p !== 'string') return Reflect.get(t, p, r);
        if (p in t) return Reflect.get(t, p, r);          /* own key, or Object.prototype */
        if (HOST.has(p)) return undefined;
        const meant = flatIdx.get(flat(p));
        /* `miss` throws for an undeclared miss and there is no way to declare one at a raw property
         * access, so this always throws -- EXCEPT under ABRA_LOOKUP_SOFT, where it returns null and
         * counts. Returning undefined there is deliberate: soft mode exists so a long run already in
         * flight can be finished and its misses read off, and `throw null` would defeat that. */
        miss(null, p, null,
          meant
            ? 'the table keys that species "' + meant + '"; you asked for "' + p + '". '
              + 'Resolve it with mcKey(name) from engine/mc_key.js -- that is the one door, and it '
              + 'accepts any spelling.'
            : 'no key of this table flattens to "' + flat(p) + '" at all. If a miss is legitimate '
              + 'here, ask through mcKey.row(name, {mayMiss: "<why>"}) instead of indexing the table.');
        return undefined;
      },
      /* Writes, deletes and enumeration pass straight through: the merge script legitimately adds
       * rows, and Object.keys / for..in / JSON.stringify must keep working exactly as before. */
      set(t, p, v) { if (typeof p === 'string' && !(p in t)) flatIdx.set(flat(p), p); return Reflect.set(t, p, v); },
      deleteProperty(t, p) { if (typeof p === 'string') flatIdx.delete(flat(p)); return Reflect.deleteProperty(t, p); },
    });
    return true;
  }

  /* Is the trap actually on? Asked rather than assumed -- a seal that silently failed to install
   * would look exactly like a seal that works, which is this project's signature failure. */
  function sealed() { return !!(root.MC && root.MC.mons && root.MC.mons[SEALED]); }

  /* THE RAW TABLE, FOR THE TWO CALLERS THAT LEGITIMATELY NEED IT. A builder that CREATES rows has to
   * ask whether a key is absent, and "absent" is the answer it wants rather than a crash. The reason
   * is mandatory and recorded, so the number of places holding this key is a measurable quantity
   * that can be driven down -- the same argument engine/lookup.js makes about `mayMiss`. */
  function rawTable(why) {
    if (!why || typeof why !== 'string') {
      throw new Error('mcKey.rawTable(why) needs a reason in one phrase. The raw table lets a miss be '
        + 'silent again, which is the defect the seal exists to end -- say why that is correct here.');
    }
    rawReasons[why] = (rawReasons[why] || 0) + 1;
    return unwrap(root.MC && root.MC.mons) || null;
  }
  rawTable.reasons = () => Object.assign(Object.create(null), rawReasons);

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

  /* The seal, exposed on the same object as everything else so a caller has ONE import. */
  mcKey.seal = seal;
  mcKey.sealed = sealed;
  mcKey.rawTable = rawTable;

  /* MEMBERSHIP, WHICH IS A DIFFERENT QUESTION FROM RESOLUTION AND USED TO BE ASKED BY INDEXING.
   *
   * `if (MC.mons[n])` was the idiom in a dozen files and it is the exact line the seal now throws on.
   * The honest replacement is not `{mayMiss}` sprinkled everywhere -- a membership test EXPECTS a
   * miss by definition, so declaring it every time is ceremony that teaches people to write the
   * declaration without meaning it. This verb never throws and never returns a row, so it cannot be
   * mistaken for a lookup, and it accepts any spelling because it resolves first. */
  mcKey.has = name => {
    if (!index || builtFrom !== (root.MC && root.MC.mons)) index = build();
    return !!(index && index.get(flat(name)));
  };

  /* THE KEY LIST. `mcKey.all()` returns entries, which is right for a caller that wants the rows and
   * wrong for the commonest case in tests/ -- "give me a pool of species to build bodies from", which
   * wants names and then calls buildMon. Those callers were writing `Object.keys(MC.mons)`, so the
   * verb was missing rather than the callers being careless.
   *
   * IT KEEPS THE TABLE'S OWN ORDER, AND `all()` DOES NOT. That difference is deliberate and was
   * MEASURED before it was decided: the first version returned `all()`'s sorted keys, and six test
   * files went red at once -- every one of them does `.slice(0, 12)` to pick an arbitrary pool, so
   * re-ordering the table silently replaced the cast of a dozen fixtures. Nothing was wrong with the
   * new pools; they were simply a different experiment, which is the worst kind of change to make
   * while re-routing call sites that were supposed to move nothing.
   *
   * So the two verbs answer two questions. `all()` is sorted because a DIGEST over it must not depend
   * on insertion order (engine/feature_fixture.js). `keys()` is the table's order because a POOL is a
   * choice of subjects and re-ordering it is a change of subject. */
  mcKey.keys = opts => {
    if (!index || builtFrom !== (root.MC && root.MC.mons)) index = build();
    const mons = root.MC && root.MC.mons;
    if (!index || !mons) return miss(null, '<keys>', opts, 'MC.mons is not loaded at all');
    return Object.keys(mons);
  };

  /* ---- WHICH BODY IS THIS -------------------------------------------------------------------
   *
   * A THIRD VERB, ADDED 2026-08-04 FOR THE SAME REASON `mcKey.all` WAS. `mcKey` answers "what is
   * this one species called in here". It is the wrong question for a caller holding a BRING LIST:
   * a bring list names bodies (`charizard`), an event names formes (`charizardmegay`), and the two
   * never compare equal however carefully they are normalised. `engine/train_value.py` asked the
   * question with `idn()` on both sides and got False, silently, on 22.7% of every damaging event
   * in the corpus — 97.6% of the discarded targets were megas. Same shape as `buildMon("Scizor")`
   * returning null, in a file that had no lookup at all.
   *
   * IT IS NOT A STRING STRIP, and that is the whole point of it living here. `f.replace(/mega[xy]?$/,'')`
   * is the obvious three lines, it is what the previous occupant of this file did, and the comment
   * in `mcKey` above records why it was removed: it answers Victreebel for Victreebel-Mega and
   * Meganium for Megani- anything beginning with the letters. The table already carries the answer
   * — every mega row in `MC.mons` has a `base` field written by the generator from the dex — so
   * this reads a fact instead of inventing one.
   *
   * ZERO NEW DEPENDENCIES, DELIBERATELY. It reads only `MC.mons`, which this file already indexes.
   * It does NOT reach for the dex the way `cosmeticAliases()` does, so it cannot crash a caller
   * that has no SHOWDOWN_PATH — the failure mode PRIORITIES #40 records for two other ratchets.
   *
   * IT RETURNS A FLAT BODY ID, NOT A TABLE KEY, and the difference is load-bearing rather than
   * stylistic. `MC.mons` carries `floette-mega` with `base: "floette"` and does NOT carry a
   * `floette` row at all — 1,613 of the events this verb exists to rescue are Floette-Mega. A
   * version that resolved the base back through the table returned null for exactly those and
   * dropped them again, one layer down. The body is a fact about the game; being in our damage
   * table is a fact about our table, and only the first one answers "which of your four is this".
   * It still composes — `mcKey` flattens its input, so `mcKey(mcKey.base(x))` is the base's row
   * when there is one.
   *
   * A species already at its base returns its own flat id; a species the table has never seen
   * returns null, like `mcKey`, so a caller can tell "no forme relationship" from "no idea". */
  mcKey.base = (name, opts) => {
    if (!index || builtFrom !== (root.MC && root.MC.mons)) index = build();
    const k = mcKey(name, opts);
    if (!k) return null;
    const row = root.MC && root.MC.mons && root.MC.mons[k];
    return flat(row && row.base ? row.base : k);
  };

  /* THE ROW ITSELF, because handing back a KEY sends every caller straight to `MC.mons[k]`.
   *
   * Same missing-verb finding as `mcKey.all` one block down, arrived at from the other direction.
   * `mcKey` answers "what is this species called in here" and stops there — so a caller that wants
   * the actual entry must index the raw table with the answer, which is the one line this whole file
   * exists to ban. Four callers had written it (`million_run.js`, `replay_differential.js`,
   * `test-mechanics.js`, and the membership test inside each), and `tests/test-mc-key.js` failed
   * all four at once. Correctly: the regex cannot tell `MC.mons[mcKey(x)]` from `MC.mons[norm(x)]`,
   * and it SHOULD NOT TRY — a regex clever enough to allow the first is clever enough to let the
   * second through, which is the header's whole argument.
   *
   * So the fix is a verb rather than an exception, exactly as `.all` was.
   *
   * A MISS RETURNS null RATHER THAN THROWING, and that is deliberate: "this table has no row for
   * that species" is a legitimate answer — `MC.mons` does not cover the whole format, which is why
   * a staged fixture can come out COULD-NOT-STAGE with a reason instead of a zero. It is still
   * DECLARED through `miss`, so a caller that has not written down that it expects one still gets
   * the throw. Membership is then `!!mcKey.row(x, {mayMiss: '...'})` and nobody indexes anything. */
  mcKey.row = (name, opts) => {
    const k = mcKey(name, opts);
    if (!k) return null;
    const row = root.MC && root.MC.mons && root.MC.mons[k];
    return row || miss(null, k, opts, 'resolved to ' + k + ', which MC.mons has no row for');
  };

  /* THE WHOLE MAP AT ONCE, for a caller that cannot call into JavaScript per name.
   *
   * `engine/train_value.py` is Python and walks ~95,000 events per run; a subprocess per name is
   * not a design. It shells this ONCE and gets a flat-forme -> flat-base map. Emitting the map is
   * still this file answering the question, which is the property that matters — the alternative
   * was a fourth hand-rolled resolver, in a third language. */
  mcKey.bases = (opts) => {
    const all = mcKey.all(opts);
    if (!all) return null;
    const out = {};
    for (const [k, row] of all) {
      if (!row || !row.base) continue;
      if (flat(row.base) !== flat(k)) out[flat(k)] = flat(row.base);
    }
    return out;
  };

  /* ENUMERATION IS A LOOKUP TOO, and leaving it out of this file sent the next caller straight back
   * to `Object.keys(MC.mons)`.
   *
   * engine/feature_fixture.js needed to digest EVERY row of the table, to detect a re-ingest that
   * the frozen fixture boards cannot see. There was no accessor for "all of it", so the first
   * version indexed the raw artifact directly -- and tests/test-mc-key.js failed it, correctly,
   * inside the same run. That test is what R1 is for and it did its job.
   *
   * The right answer is not a new exception in the baseline. It is that the accessor was missing a
   * verb: mcKey answers "what is this one species called in here", mcKey.all answers "what is in
   * here at all". Both are questions about how MC.mons is keyed, so both belong to the one file
   * allowed to know. It returns ENTRIES rather than keys, because a caller handed a list of keys
   * will index the raw table with them and we are exactly back where we started.
   *
   * The miss is DECLARED rather than thrown: "the table is not loaded" is a legitimate answer for a
   * digest to receive, and its caller reports UNAVAILABLE instead of guessing. */
  mcKey.all = (opts) => {
    if (!index || builtFrom !== (root.MC && root.MC.mons)) index = build();
    const mons = root.MC && root.MC.mons;
    if (!index || !mons) return miss(null, '<all>', opts, 'MC.mons is not loaded at all');
    /* Sorted, so a digest taken over these is stable across runs and across key insertion order. */
    return Object.keys(mons).sort().map(k => [k, mons[k]]);
  };

  const api = { mcKey, flat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MCKEY = api; root.mcKey = mcKey; }

  /* INSTALL ON LOAD, WITH NO CALL NEEDED. A seal somebody has to remember to switch on is a
   * preference, and this file's whole history is preferences that were not followed. If MC.mons is
   * not published yet -- a caller that requires this file first -- build() seals on the first
   * lookup instead, so load order cannot decide whether the guarantee exists. */
  seal();

  /* A CLI, so a non-JavaScript caller reaches the SAME resolver instead of writing its own.
   *
   *   node engine/mc_key.js --bases      -> {"charizardmegay":"charizard", ...} on stdout
   *
   * It loads data/engine-data.js itself, because a caller that has to know how to publish MC before
   * asking a question about MC is a caller that will get it wrong. Exits non-zero with a message on
   * stderr if the table will not load: a Python caller must be able to tell "no aliases" from "the
   * table is missing", and the second one silently returning {} is how the bug this verb fixes went
   * unnoticed for as long as it did. */
  if (typeof require === 'function' && typeof module !== 'undefined'
      && require.main === module && process.argv.includes('--bases')) {
    try { require('../data/engine-data.js'); } catch (e) {
      console.error('mc_key --bases: could not load data/engine-data.js: ' + e.message); process.exit(2);
    }
    const b = mcKey.bases({ mayMiss: 'CLI dump; a miss is omitted from the map' });
    if (!b) { console.error('mc_key --bases: MC.mons is not loaded'); process.exit(2); }
    process.stdout.write(JSON.stringify(b) + '\n');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
