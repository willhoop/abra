/* effect_kind.js — WHICH TABLE A PROTOCOL TOKEN BELONGS TO. ONE IMPLEMENTATION.
 *
 * `engine/game_differential.js` annotates every divergence cause with the format standing of every
 * entity the two lines name. It finds those entities the cheap way — split the cause on everything
 * that is not a letter or a digit, and ask the dex about each token — deliberately, because guessing
 * a field position cannot miss an entity.
 *
 * IT CAN, HOWEVER, ASK THE WRONG TABLE. A CONDITION AND A MOVE MAY SHARE A NAME.
 *
 *     |-start|p2a|confusion|[fatigue]
 *
 * is the confusion VOLATILE — what a body gets when a locking move (Outrage, Petal Dance, Raging
 * Fury, Thrash, all legal here) runs out. The token `confusion` also names a MOVE, and that move is
 * `isNonstandard: 'Past'` in Champions. Asked about the move table, the annotator answered
 * `legal: false, reachable: false, nonstandard: 'Past'` and published it — a divergence over a
 * mechanic four legal moves cause, labelled as one this format cannot contain. It is the same shape
 * as reading `/data/abilities.ts` when the mod overrides it: a real lookup against the wrong source.
 *
 * THE RULE, AND IT IS DERIVED RATHER THAN LISTED.
 *
 *   1. A token in a `|move|SLOT|NAME` line's NAME position is a MOVE. That is the one protocol
 *      position that names a move as a move, and it is the only position this file claims.
 *   2. Anywhere else, a token naming an entry in the format's own STANDALONE condition table
 *      (`Dex.data.Conditions` — 35 entries, not the 900-odd conditions that hang off a move) occupies
 *      a condition slot and is a CONDITION.
 *   3. A LEGAL move sharing that name is kept BESIDE it. Showdown names a volatile after the move
 *      that sets it, so the move is a genuine setter and its corpus usage is real signal about how
 *      much play the condition touches. Dropping it would push a live family down the ranking.
 *   4. An ILLEGAL move sharing that name is DROPPED. It cannot be the setter — nothing in this format
 *      can click it — so the match is a coincidence of spelling and nothing more.
 *
 * Rule 3 is why this is not simply "conditions win". `|-singleturn|p1a|protect` and
 * `|-sideend|p1:|tailwind` name volatiles whose setter is the move of the same name, and Protect
 * (101,357 clicks) and Tailwind (16,074) are the two entities that dominate the whole worklist.
 * Neither is in the standalone table, so neither reaches this rule at all — but a rule that binned
 * the move half would have silently deleted the top of the ranking the first time one did.
 *
 * WHAT THIS FILE DOES NOT DECIDE. It says which TABLE to ask. It does not say how much play a
 * condition touches: `tags.json` carries `uses` for moves, abilities and items and nothing for a
 * condition, so a condition mention reads `uses: null` — UNKNOWN, which is a different claim from
 * zero and must stay different. The reach of a weather residual is the reach of the legal bodies that
 * SET the weather, and computing that is a separate change with its own argument to make.
 *
 * IT LIVES HERE AND NOT IN THE DIFFERENTIAL because the differential is a four-minute run against
 * the official simulator, and a rule that can only be exercised by running it is a rule nobody will
 * test. `tests/test-effect-kind.js` exercises it in milliseconds. Same move `divergence_shape.js`
 * made on 2026-08-12, for the same reason.
 */
'use strict';

/* The tokeniser the differential already uses, kept here so the two cannot drift apart. */
const TOKENS = (s) => String(s).split(/[^a-z0-9]+/i);

/* Split a cause into its two protocol halves. The `cls :: ` prefix is the differential's own label
 * and is not protocol; a cause that is not a pair (the UNPARSED shape) yields the halves it has. */
function halves(cause) {
  return String(cause).replace(/^[^:]*:: /, '').split(' <> ');
}

/* THE ONE POSITION THAT NAMES A MOVE AS A MOVE: `|move|pXy|<name>|...`. Everything else — `-start`,
 * `-end`, `-activate`, `-singleturn`, `-sideend`, `cant`, `-weather`, a `[from]` tag — names an
 * EFFECT, which may be a move, an ability, an item or a condition. */
function moveArgTokens(cause) {
  const out = new Set();
  for (const half of halves(cause)) {
    const parts = String(half).trim().replace(/^\|/, '').split('|');
    if (parts[0] !== 'move') continue;
    const name = (parts[2] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name) out.add(name);
  }
  return out;
}

/* The tokens of `cause` that must be resolved against the CONDITION table rather than the move table.
 * `isCondition` is supplied by the caller so this file holds no copy of the format's data — pass
 * `id => id in dex.data.Conditions`. */
function conditionSlotTokens(cause, isCondition) {
  const inMoveArg = moveArgTokens(cause);
  const out = new Set();
  for (const tok of TOKENS(cause)) {
    const id = String(tok).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!id || inMoveArg.has(id)) continue;
    if (isCondition(id)) out.add(id);
  }
  return out;
}

/* The standing of a condition. Every field is UNKNOWN on purpose and none of them is a zero:
 *   legal      — a condition has no legality of its own; it is reachable exactly when something that
 *                sets it is legal, and this file does not compute that.
 *   reachable  — `null`, never `false`. `cannot_occur_in_format` is `every(m => m.reachable === false)`
 *                and a condition must never be the reason a live cause is binned as impossible.
 *   uses       — `tags.json` carries no usage for a condition. Absent means UNKNOWN.
 */
function conditionStanding(id) {
  return { kind: 'conditions', id, legal: null, carriers: null, reachable: null, nonstandard: null, uses: null };
}

/* ---- THE CONDITION SET IS DERIVED, AND THE 35-ENTRY TABLE WAS THE WRONG SET -----------------------
 *
 * `Dex.data.Conditions` holds the 35 conditions that have a STANDALONE entry — the statuses, the
 * weathers, `lockedmove`, `stall`. It does NOT hold a volatile that lives inside the move it is named
 * after, and that is where the hole was: the `healblock` VOLATILE is applied by Psychic Noise, which
 * is legal here (`secondary: { chance: 100, volatileStatus: 'healblock' }`), while the MOVE Heal Block
 * is `isNonstandard: 'Past'`. `healblock` is not in the standalone table, so the rule above never
 * reached it, the move table answered, and a reachable BOARD-MATERIAL mechanic was published
 * `cannot_occur_in_format: true` — the failure direction that makes a real defect invisible and never
 * goes red.
 *
 * THE SET IS THEREFORE COMPUTED, NEVER LISTED. A name is a condition IN PLAY when something LEGAL in
 * this format can set it:
 *
 *   - a declared `volatileStatus` / `sideCondition` / `slotCondition` / `pseudoWeather` / `weather` /
 *     `terrain` / `status` on a legal move, ability or item — including inside `self`, `secondary`,
 *     `secondaries` and the entity's own `condition` block;
 *   - an `addVolatile('x')` / `addSideCondition('x')` / `addSlotCondition('x')` /
 *     `addPseudoWeather('x')` / `setWeather('x')` / `setTerrain('x')` literal inside one of that
 *     entity's handlers, because a good many volatiles are only ever applied from code;
 *   - the standalone table, kept because a status or a weather has no single setter.
 *
 * WHY "SETTABLE BY SOMETHING LEGAL" AND NOT "IS A CONDITION AT ALL". A volatile whose ONLY setter is a
 * `Past` move — `octolock`, `iceball`, `telekinesis` — genuinely cannot occur here, and the move table's
 * answer for it is RIGHT. Widening to every condition name in the dex would silence those correctly-
 * labelled rows, which is the same fault pointed the other way.
 *
 * MEASURED 2026-08-31 on `gen9championsvgc2026regmb`: 96 names, of which exactly THREE collide with a
 * move this format does not contain — `confusion` (Past), `hail` (Past), `healblock` (Past). The first
 * two were already covered by the standalone table; `healblock` is the one this widening adds. The
 * count is printed by the caller so a derivation that silently matched nothing cannot pass for one that
 * had nothing to match.
 */
const COND_FIELDS = ['volatileStatus', 'sideCondition', 'slotCondition', 'pseudoWeather',
                     'weather', 'terrain', 'status'];
const COND_CALL = /(?:addVolatile|addSideCondition|addSlotCondition|addPseudoWeather|setWeather|setTerrain)\(\s*'([a-z0-9]+)'/g;
const ID = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

/* `exists && !isNonstandard && tier !== 'Illegal'` — the regulation filter CLAUDE.md requires on every
 * dex walk. `.all()` is the National Dex wearing the format's name. */
const IN_FORMAT = (x) => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');

/* EVERY DEX LOOKUP IN THIS FILE COUNTS ITS OWN FAILURE, AND SAYS SO ONCE. A throw here hands back an
 * empty walk or a null row, and an empty walk reads EXACTLY like "this format has no such entity" —
 * which is the same silence that let a live mechanic be published as impossible in the first place.
 * The counters ride out on the derivation so a caller can print them beside the membership; a
 * derivation that matched nothing because the dex threw must never read as one that had nothing to
 * match. */
const DERIVE_FAILS = { speciesWalk: 0, entityWalk: 0, conditionTable: 0, moveLookup: 0, speciesLookup: 0 };
let DERIVE_FAIL_SAID = false;
function deriveFail(what, why) {
  DERIVE_FAILS[what]++;
  if (!DERIVE_FAIL_SAID) {
    DERIVE_FAIL_SAID = true;
    console.error('  effect_kind: a dex lookup threw (' + what + ') — the derived membership below is '
                + 'INCOMPLETE, not empty: ' + String(why).slice(0, 140));
  }
}

function conditionNames(dex) {
  const names = new Map();          /* id -> Set of the legal things that can set it */
  const note = (raw, src) => { const k = ID(raw); if (!k) return;
    if (!names.has(k)) names.set(k, new Set()); names.get(k).add(src); };

  const walk = (node, src, seen) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'function') {
        let m; COND_CALL.lastIndex = 0; const body = String(v);
        while ((m = COND_CALL.exec(body))) note(m[1], src + '#' + k);
      } else if (v && typeof v === 'object') {
        walk(v, src, seen);
      } else if (typeof v === 'string' && COND_FIELDS.includes(k)) {
        note(v, src + '#' + k);
      }
    }
  };

  let scanned = 0;
  for (const kind of ['moves', 'abilities', 'items']) {
    let all = []; try { all = dex[kind].all(); } catch (e) { deriveFail('entityWalk', e && e.message); all = []; }
    for (const e of all) { if (!IN_FORMAT(e)) continue; scanned++;
      walk(e, kind.replace(/s$/, '') + ' ' + e.id, new WeakSet()); }
  }
  const derived = names.size;
  let standalone = 0;
  let table = {}; try { table = dex.data.Conditions || {}; } catch (e) { deriveFail('conditionTable', e && e.message); table = {}; }
  for (const k of Object.keys(table)) { standalone++; note(k, 'STANDALONE-TABLE'); }

  /* THE COLLISION SET, derived on the same run rather than remembered: which of these names is also
   * the name of a move this format does not contain. Those are the names the move table gets wrong. */
  const collisions = [];
  for (const id of names.keys()) {
    let mv = null; try { mv = dex.moves.get(id); } catch (e) { deriveFail('moveLookup', e && e.message); mv = null; }
    if (mv && mv.exists && (mv.isNonstandard || mv.tier === 'Illegal')) {
      collisions.push({ id, move_nonstandard: mv.isNonstandard || mv.tier,
                        in_standalone_table: Object.prototype.hasOwnProperty.call(table, id),
                        set_by: [...names.get(id)] });
    }
  }
  collisions.sort((a, b) => a.id.localeCompare(b.id));
  return { names, has: (id) => names.has(ID(id)),
           count: names.size, standalone, derived_from_legal_setters: derived,
           entities_scanned: scanned, collisions, fails: { ...DERIVE_FAILS } };
}

/* ---- A LEGAL FORME UNDER AN ILLEGAL BASE NAME ----------------------------------------------------
 *
 * The second guise of the same fault, and it cost two BOARD-PARTED rows. `|-damage|p1a:floette|74/149`
 * names the body Floette-Eternal / Floette-Mega, both of which are in this format. The BASE species
 * `floette` is `isNonstandard: 'Past'` AND `tier: 'Illegal'`, so a token resolved straight to the base
 * spelling answered `reachable: false` and two real damage divergences were binned as impossible.
 *
 * DERIVED, and the membership is the argument: across the whole regulation exactly ONE illegal base
 * species carries a legal forme, and it is Floette. A rule keyed to that name would catch that name; a
 * rule that asks the dex catches the next one. The caller prints the count.
 */
function legalFormesByBase(dex) {
  const by = new Map();
  let all = []; try { all = dex.species.all(); } catch (e) { deriveFail('speciesWalk', e && e.message); all = []; }
  for (const sp of all) {
    if (!IN_FORMAT(sp)) continue;
    const b = ID(sp.baseSpecies || sp.name);
    if (!by.has(b)) by.set(b, []); by.get(b).push(ID(sp.id || sp.name));
  }
  /* The rescues this map can actually perform: a base spelling that is NOT in the format but whose
   * base has at least one forme that is. Anything else is a body already answering `reachable: true`. */
  const rescues = [];
  for (const [b, formes] of by) {
    let base = null; try { base = dex.species.get(b); } catch (e) { deriveFail('speciesLookup', e && e.message); base = null; }
    if (base && base.exists && !IN_FORMAT(base)) rescues.push({ id: b, legal_formes: formes.slice() });
  }
  rescues.sort((a, b) => a.id.localeCompare(b.id));
  return { by, formesOf: (id) => by.get(ID(id)) || [], rescues, fails: { ...DERIVE_FAILS } };
}

/* ---- THE ONE RESOLVER --------------------------------------------------------------------------
 *
 * `entityStanding` and `annotateCause` lived in `engine/game_differential.js`, which is a four-minute
 * run against the official simulator and takes 26 seconds merely to LOAD. A naming rule that can only
 * be exercised by running the differential is a rule nobody tests, which is the argument this file was
 * created on. They live here now and the differential calls them, so there is one implementation and a
 * probe drives THE resolver rather than a second copy of it.
 *
 * The caller supplies its own `dex`, its own `tags.json` object (the differential reads the RELEASE's
 * bytes, not the live file) and its own failure counters, so this module holds no data of its own.
 */
const STANDING_KINDS = [['moves', 'moves'], ['abilities', 'abilities'], ['items', 'items']];

function makeStanding(opts) {
  const dex = opts.dex;
  const TAGS_OBJ = opts.tags || {};
  const ABILITY_CARRIERS = opts.abilityCarriers || new Map();
  const FAILS = opts.fails || { dexLookup: 0, speciesLookup: 0 };
  const counters = { condition_slot_tokens: 0, rescued_from_an_illegal_move: 0,
                     kind_preference_rescues: 0, species_forme_rescues: 0 };

  /* THE KNOB, AND IT IS HERE SO THE FIX CAN BE SHOWN RED RATHER THAN ASSERTED.
   *   'by-kind'   — the rule above: a derived condition set, a reachable kind preferred over an
   *                 unreachable one, and a legal forme under an illegal base spelling.
   *   'first-hit' — EXACTLY what this resolver did until 2026-08-31: the 35-entry standalone table,
   *                 the first dex hit wins, and a species answered on its own spelling alone.
   * A probe that cannot turn a fix OFF cannot tell a working rule from an unwired one, and this repo
   * has been caught by that shape often enough to build the control in. */
  const RESOLUTION = opts.resolution === 'first-hit' ? 'first-hit' : 'by-kind';
  const BY_KIND = RESOLUTION === 'by-kind';

  const CONDITIONS = conditionNames(dex);
  const FORMES = legalFormesByBase(dex);
  const TABLE = (() => { try { return dex.data.Conditions || {}; }
                         catch (e) { deriveFail('conditionTable', e && e.message); return {}; } })();
  const IS_CONDITION = BY_KIND
    ? (id) => CONDITIONS.has(id)
    : (id) => Object.prototype.hasOwnProperty.call(TABLE, id);

  /* A CANDIDATE PER KIND, THEN THE REACHABLE ONE WINS. The old loop returned the FIRST dex hit and
   * moves are asked first, so a token naming a legal ITEM and a `Past` move answered out of the move
   * table — `metronome` is the live instance: the item is legal here, the move is Past. `reachable`
   * is what `cannot_occur_in_format` reads, so "nothing this token can denote is reachable" is the
   * only honest reading and preferring a reachable kind is exactly that sentence. When NOTHING is
   * reachable the first hit is still returned, so a correctly-impossible token is unchanged. */
  function entityStanding(id) {
    const found = [];
    for (const [sec, dexKind] of STANDING_KINDS) {
      const row = TAGS_OBJ[sec] && TAGS_OBJ[sec][id];
      let d = null;
      try { d = dex[dexKind].get(id); } catch (e) { d = null; FAILS.dexLookup++; }
      if (row || (d && d.exists)) {
        const legal = !!(d && d.exists && !d.isNonstandard);
        /* An ability nothing legal can carry is unreachable even though it is legal. `null` when the
         * map could not be built, so UNKNOWN never reads as zero. */
        const carriers = sec === 'abilities'
          ? (ABILITY_CARRIERS.size ? (ABILITY_CARRIERS.get(id) || 0) : null) : null;
        found.push({ kind: sec, id, legal, carriers,
                     reachable: legal && carriers !== 0,
                     nonstandard: (d && d.isNonstandard) || null,
                     uses: row && typeof row.uses === 'number' ? row.uses : null });
      }
    }
    if (found.length) {
      if (!BY_KIND) return found[0];
      const reachable = found.find(f => f.reachable === true);
      if (reachable && reachable !== found[0]) counters.kind_preference_rescues++;
      return reachable || found[0];
    }
    const sp = (() => { try { return dex.species.get(id); } catch (e) { FAILS.speciesLookup++; return null; } })();
    if (sp && sp.exists) {
      const legal = !sp.isNonstandard && sp.tier !== 'Illegal';
      /* A BASE SPELLING THAT IS NOT IN THE FORMAT MAY STILL NAME A BODY THAT IS. Floette is Past and
       * Illegal; Floette-Eternal and Floette-Mega are neither, and the protocol addresses the slot by
       * the base name. `legal` stays the species' OWN standing — that field is not a lie — and only
       * `reachable` is corrected, with the formes that did it riding along as `via`. */
      const via = (legal || !BY_KIND) ? [] : FORMES.formesOf(id).filter(f => f !== id);
      if (!legal && via.length) counters.species_forme_rescues++;
      return { kind: 'species', id, legal, carriers: null, reachable: legal || via.length > 0,
               nonstandard: sp.isNonstandard || (sp.tier === 'Illegal' ? 'Illegal' : null),
               uses: null, ...(via.length ? { via } : {}) };
    }
    return null;
  }

  function annotateCause(cause) {
    const seen = new Set(), out = [];
    /* Computed ONCE per cause, because it is a property of the whole pair: `|move|pXy|<name>` is the
     * one position that names a move as a move, and a token there stays a move wherever else it appears. */
    const condSlots = conditionSlotTokens(cause, IS_CONDITION);
    for (const tok of String(cause).split(/[^a-z0-9]+/i)) {
      const id = ID(tok);
      if (!id || id.length < 4 || seen.has(id)) continue;
      seen.add(id);
      if (condSlots.has(id)) {
        counters.condition_slot_tokens++;
        out.push(conditionStanding(id));
        /* A LEGAL move of the same name is kept BESIDE the condition, never instead of it: Showdown
         * names a volatile after the move that sets it, so that move is a genuine setter and its corpus
         * usage is real signal. An ILLEGAL one cannot be the setter — nothing here can click it — so the
         * match is a coincidence of spelling. Dropping it is the whole fix, and it is counted so a run
         * that rescues nothing cannot pass as a run that had nothing to rescue. */
        const mv = entityStanding(id);
        if (mv && mv.legal) out.push(mv); else if (mv) counters.rescued_from_an_illegal_move++;
        continue;
      }
      const st = entityStanding(id);
      if (st) out.push(st);
    }
    if (!out.length) return { mentions: [] };
    const known = out.filter(m => typeof m.uses === 'number');
    return {
      mentions: out,
      /* THE HEADLINE FIELD. If every entity a cause names is illegal in this format, fixing it changes
       * nothing a real game can reach -- and that must be visible without a second query. */
      cannot_occur_in_format: out.every(m => m.reachable === false),
      max_uses: known.length ? Math.max(...known.map(m => m.uses)) : null,
    };
  }

  return { entityStanding, annotateCause, counters, conditions: CONDITIONS, formes: FORMES,
           isCondition: IS_CONDITION, resolution: RESOLUTION };
}

module.exports = { TOKENS, halves, moveArgTokens, conditionSlotTokens, conditionStanding,
                   conditionNames, legalFormesByBase, makeStanding, STANDING_KINDS, IN_FORMAT, ID,
                   deriveFails: () => ({ ...DERIVE_FAILS }) };
