/* pp.js — CHAMPIONS PP, AS ONE FACT (ROADMAP #145)
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL, STATED FIRST, BECAUSE IT IS A COMPROMISE AND NOT A DESIGN WIN
 * ---------------------------------------------------------------------------------------------
 *
 * CLAUDE.md: **FEATURES ARE PER-MODEL. FACTS ARE GLOBAL.** "How much PP does this move have in this
 * format, and what does spending one cost" is a FACT. `engine/medicham2-browser.js` already
 * implements it correctly (ROADMAP #144: `ppMax`, `ppLeft`, `ppDeduct`, `ppAllOut`,
 * `ppPressureExtra`) — and implements it as five FILE-LOCAL functions that appear on neither
 * `module.exports` nor `root`. `engine/board.js` therefore **cannot call them**, and board.js is the
 * file that has to seed a rollout with the PP the real game has already spent.
 *
 * Exporting them is a one-line change to `medicham2-browser.js`, which SEARCH may not make — that
 * file belongs to ENGINE and was being edited by ENGINE on the night this was written. So the
 * options were: copy the five functions into board.js, or put them somewhere both files can reach
 * and ask ENGINE to delegate. **A copy is the thing this project has been bitten by four times**
 * (choiceLock's two engines, the three dialects of terrain, the four setters writing a literal 5,
 * `board.js`'s second copy of the turn order). This file is the second option.
 *
 * SO IT IS HONESTLY A SECOND READER UNTIL ENGINE LANDS ITS HALF, AND THAT IS RECORDED RATHER THAN
 * GLOSSED: filed as ROADMAP #146 / `docs/ENGINE.md`. What keeps the window safe is that the two
 * readers read the SAME ROW OF THE SAME ARTIFACT — `data/tags.json`'s `pp` tag, built by
 * `engine/tag_dex.js` off a real `Battle` in `gen9championsvgc2026regmb` — so they cannot disagree
 * about a NUMBER. They could still disagree about a RULE (the clamp, the Pressure list, the Struggle
 * condition), which is why every rule below is written to mirror `medicham2-browser.js` line for line
 * and says which line it mirrors. `tests/test-pp-fact.js` asserts the two agree and FAILS if they
 * part, so the window is guarded rather than merely declared.
 *
 * ---------------------------------------------------------------------------------------------
 * THE NUMBER IS READ, NEVER COMPUTED
 * ---------------------------------------------------------------------------------------------
 *
 * Champions compresses PP. `floor(base * 0.8) + 4` fits all 500 rows today and is deliberately NOT
 * the implementation: the mod can change the rule, and a hardcoded formula would then be silently
 * wrong on every move at once with nothing to notice. Protect is `maxpp` **8** here against 16
 * mainline — the mainline `pp * 8/5` rule matches only 85 of the 500 moves in this format, so a
 * table typed from memory would be wrong on 415 of them.
 *
 * **Every slot starts at its maximum** (Will: "ALL MOVES GET MAX PPED IN CHAMPIONS"), which is why
 * there is no "PP Up" concept here and why an untouched slot needs no storage.
 *
 * ---------------------------------------------------------------------------------------------
 * SELECTABILITY IS ITS OWN THING, AND PP IS ONE INPUT TO IT
 * ---------------------------------------------------------------------------------------------
 *
 * Showdown Struggles when the menu of ENABLED moves is empty (`sim/side.ts:697`,
 * `sim/pokemon.ts:1022-1044`), which is BROADER than "out of PP": a Choice lock onto a move that is
 * then Disabled, or an Encore into a move that cannot be used, empties the menu at full PP. Our
 * simulator's predicate is PP-only and widening it is ENGINE's open item, not this file's.
 *
 * So `slotSelectable()` takes a REASONS OBJECT rather than a PP number, today reads only the PP
 * field, and names the others in its signature. A caller that learns about Disable adds a field; no
 * consumer of this module changes. Modelling it as `ppLeft > 0` at the call sites — which is what a
 * three-line version would have done — is what would force a rewrite of every caller when the
 * condition widens.
 */
'use strict';

/* THE KEY. `medicham2-browser.js:1443` — `String(id).toLowerCase().replace(/[^a-z0-9]/g,'')` — and it
 * is identical to `board.js`'s `norm`. It is repeated here rather than imported because importing it
 * would make this module depend on one of its two consumers. */
const key = id => String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE ARTIFACT, in node and in the browser, in that order and for `board.js:1617`'s stated reason:
 * a require-only load latches false on the live site and every lookup silently reads "no PP". */
let _T = null;
function tagsMod() {
  if (_T !== null) return _T;
  try {
    if (typeof require === 'function') { _T = require('./tags.js'); return _T; }
    const g = (typeof globalThis !== 'undefined') ? globalThis : {};
    _T = (g.ABRA_TAGS && typeof g.ABRA_TAGS.param === 'function') ? g.ABRA_TAGS
       : (g.ABRA_TAG_LOOKUP && typeof g.ABRA_TAG_LOOKUP.param === 'function') ? g.ABRA_TAG_LOOKUP
       : false;
  } catch (e) {
    /* SAYS WHY, ONCE, AND KEEPS THE REASON. A PP module that cannot reach the artifact answers null
     * for every move, and null is "unknown" everywhere below — so this degrades to "nobody ever runs
     * out", which is exactly the pre-fix behaviour arriving back silently. */
    _T = false;
    ppFails.loadFailed++;
    if (!ppFails.loadFailedWhy) ppFails.loadFailedWhy = String((e && e.message) || e);
    if (typeof console !== 'undefined') console.error('pp.js: the tag artifact is unavailable (' + ppFails.loadFailedWhy + ') — every PP answer will be null and nothing can run out');
  }
  return _T;
}
/* ONE GUARDED LOOKUP, so the three readers below cannot each grow their own swallowed catch. A throw
 * here means the artifact is present but malformed for that key, which is a different failure from
 * "no row" and is counted apart from it. */
function tagParam(kind, id, tag) {
  const T = tagsMod();
  if (!T) return null;
  try { return T.param(kind, key(id), tag); } catch (e) {
    ppFails.lookupThrew++;
    if (!ppFails.lookupThrewWhy) ppFails.lookupThrewWhy = kind + ' ' + id + ' ' + tag + ': ' + String((e && e.message) || e);
    return null;
  }
}
/* Injectable for a test that wants to prove the degraded path, and for a bundle that pre-loads the
 * artifact under a name this file does not know. */
function setTagSource(T) { _T = T || false; }

/* SWALLOWED-FAILURE COUNTERS, same contract as `MEDFAILS`: a zero is a CLAIM, not a pass.
 *  unknownMove   a move with no `pp` row. It becomes FREE FOREVER if a caller treats null as "full",
 *                which is exactly the silent default this project keeps finding. Must read 0 —
 *                data/tags.json carries a `pp` row for all 500 moves in this format.
 *  noArtifact    the tag module could not be loaded at all; every answer below is null. */
const ppFails = { unknownMove: 0, unknownMoveFirst: '', noArtifact: 0,
                  loadFailed: 0, loadFailedWhy: '', lookupThrew: 0, lookupThrewWhy: '' };

/* HOW MANY CLICKS A FULL SLOT HOLDS. `null` means "this project has no PP number for that move" and
 * is deliberately distinct from 0 — `medicham2-browser.js:1438` makes the same distinction for the
 * same reason: a tagger gap must never read as an empty slot, or a whole team silently Struggles. */
function maxPP(id) {
  if (!id) return null;
  if (!tagsMod()) { ppFails.noArtifact++; return null; }
  const p = tagParam('move', id, 'pp');
  if (p && +p.max > 0) return +p.max;
  ppFails.unknownMove++;
  if (!ppFails.unknownMoveFirst) ppFails.unknownMoveFirst = String(id);
  return null;
}

/* A TABLE IS `{moveKey: clicksRemaining}` AND HOLDS ONLY WHAT HAS BEEN TOUCHED.
 *
 * An absent key means "full", not "unknown", and that is the whole reason the representation is
 * sparse: `medicham2-browser.js` derives each slot on FIRST TOUCH because `board.js`'s `dmgMon`
 * overwrites `b.moves` after `buildMon` has run, so a table stamped against the pre-overwrite moves
 * would be keyed to the wrong four. A sparse table is correct under that overwrite and under any
 * builder that does not exist yet. */
function left(table, id) {
  const k = key(id);
  if (table && Object.prototype.hasOwnProperty.call(table, k)) return table[k];
  return maxPP(k);
}

/* SPEND, AND RETURN WHAT WAS ACTUALLY TAKEN. `medicham2-browser.js:1448` — subtract, clamp at zero,
 * report the real amount, because Spite and Eerie Spell branch on it and the clamp cannot be left to
 * the caller. A move with no row is spent as 0 rather than driven negative. */
function spend(table, id, amount) {
  if (!table) return 0;
  const k = key(id);
  const cur = left(table, k);
  if (cur == null) return 0;
  let amt = (amount == null ? 1 : +amount);
  if (!(amt > 0)) return 0;
  table[k] = cur - amt;
  if (table[k] < 0) { amt += table[k]; table[k] = 0; }
  return amt;
}

/* IS EVERY SLOT ON THIS BODY OUT — the PP half of the Struggle condition, asked of the body's OWN
 * move list so a four-move sheet and a one-move probe body both answer correctly.
 * `medicham2-browser.js:1461`: a body carrying no PP number at all answers FALSE, because "unknown"
 * must never be read as "empty". */
function allOut(moves, table) {
  const mv = moves || [];
  if (!mv.length) return false;
  let known = 0;
  for (const id of mv) {
    const l = left(table, id);
    if (l == null) return false;
    known++;
    if (l > 0) return false;
  }
  return known > 0;
}

/* ---- PRESSURE, AS A FACT ABOUT AN ABILITY RATHER THAN AS A BOOLEAN --------------------------
 *
 * MEASURED IN SHOWDOWN, and the wrong version of this passes a Close Combat test: **Pressure does
 * NOT shorten Protect.** The handler charges once per APPARENT TARGET (`pressureTargets`,
 * `sim/battle-actions.ts:476`) and an ALLY charges nothing, so a self-targeting move has
 * `pressureTargets = [self]` and costs one PP whatever is standing opposite. A spread move into two
 * Pressure bodies costs THREE.
 *
 *   Protect      v Pressure   8 -> 3    v Levitate   8 -> 3    NO DIFFERENCE
 *   Flamethrower v Pressure  16 -> 6    v Levitate  16 -> 11   2 PP a click
 *   Heat Wave, two Pressure foes        12 -> 0 in FOUR clicks  3 PP a click
 *
 * The extra is therefore computed over a TARGET LIST. This module supplies only
 * `extraPerTarget(abilityId)` — the artifact read — and each caller composes it over the bodies IT
 * knows how to enumerate, because a `board.js` mon and a MEDICHAM body are different shapes and a
 * shared function over both would have to know both. The FACT is the number 1 and the ability it
 * belongs to; the LOOP is not a fact. */
function extraPerTarget(abilityId) {
  if (!abilityId) return 0;
  const p = tagParam('ability', abilityId, 'deductsExtraPP');
  return (p && +p.extra > 0) ? +p.extra : 0;
}
/* `alliesExempt` is read rather than assumed, so an ability added later that DOES charge an ally
 * behaves correctly without an edit here. */
function alliesExempt(abilityId) {
  const p = tagParam('ability', abilityId, 'deductsExtraPP');
  return !p || p.alliesExempt !== false;
}

/* ---- SELECTABILITY ---------------------------------------------------------------------------
 *
 * @param r  { ppLeft, disabled, encoreLocked, choiceLocked, taunted, tormented, imprisoned, sealed }
 *
 * TODAY ONLY `ppLeft` IS READ, and the others are named in the signature on purpose: Showdown's
 * condition is "the enabled-move menu is empty", our simulator's is PP-only, and closing that gap is
 * ENGINE's open item. When it closes, the extra clauses land HERE and every caller — the board, the
 * playout's explore pick, the candidate menu — widens at once. That is the difference between this
 * and writing `ppLeft > 0` at three call sites.
 *
 * `ppLeft == null` (no row for the move) is SELECTABLE. Unknown is not empty. */
function slotSelectable(r) {
  if (!r) return true;
  if (r.ppLeft != null && r.ppLeft <= 0) return false;
  return true;
}

/* ---- THE BODY CONTRACT -----------------------------------------------------------------------
 *
 * `_pp` is `medicham2-browser.js`'s own field on a built body (`ppLeft` lazily creates it at
 * `:1444`). Naming it in ONE place means the coupling is a declared contract rather than a string
 * literal in board.js, and it is the single line ENGINE has to look at when it adopts this module.
 * Seeding it is what makes a rollout START from the board's PP instead of from full. */
const BODY_FIELD = '_pp';

/* Copy the position's remaining PP onto a freshly built body, for the moves that body actually
 * carries. ONLY DEPLETED SLOTS ARE WRITTEN: an absent key is lazily filled with the maximum by the
 * engine on first touch, so writing full slots would duplicate a derivation the engine already owns
 * and would go stale the moment the maximum moved. */
function seedBody(body, table) {
  if (!body || !table) return 0;
  const mv = body.moves || [];
  let wrote = 0;
  for (const id of mv) {
    const k = key(id);
    if (!Object.prototype.hasOwnProperty.call(table, k)) continue;
    const v = table[k];
    if (v == null) continue;
    const t = (body[BODY_FIELD] || (body[BODY_FIELD] = {}));
    t[k] = v;
    wrote++;
  }
  return wrote;
}

/* What a BUILT BODY has left, without touching the engine's lazy init. Used by the playout's explore
 * pick, which must not offer a slot the chooser would refuse. */
function bodyLeft(body, id) { return left(body && body[BODY_FIELD], id); }
function bodySelectable(body, id) { return slotSelectable({ ppLeft: bodyLeft(body, id) }); }

const _EXPORTS = {
  key, maxPP, left, spend, allOut, extraPerTarget, alliesExempt,
  slotSelectable, seedBody, bodyLeft, bodySelectable, BODY_FIELD,
  setTagSource, ppFails,
};
/* PUBLISHED BOTH WAYS, exactly as engine/mc_key.js and engine/lookup.js are: board.js reaches this
 * through `require` in node and through the global in a browser, and a module-only export would
 * leave the site seeding no PP while looking like it worked. `board.js ppCounters.moduleMissing`
 * is the receipt if a page ever ships board.js without this script beside it. */
if (typeof module !== 'undefined' && module.exports) module.exports = _EXPORTS;
if (typeof globalThis !== 'undefined') globalThis.ABRA_PP = _EXPORTS;
