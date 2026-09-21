/* screen_tags.js — WHAT A SCREEN IS, WHICH CATEGORY IT HALVES, AND WHAT TAKES ONE DOWN.
 *
 *   const SC = require('./screen_tags.js');
 *   SC.screenSideConditions(dex)   -> Set of side-condition ids that halve incoming damage
 *   SC.screenCategory(m)           -> 'Physical' | 'Special' | 'both' | null   (null: not a screen setter)
 *   SC.clearsScreens(m, dex)       -> { clears: 'screens' } | null
 *
 * WHY IT IS ITS OWN FILE AND NOT TWO CLOSURES IN tag_dex.js
 * --------------------------------------------------------
 * Because `tests/probe_tag_derivation_without_prose.js` has to run the SAME derivation the artifact
 * is built from, twice — once with the authority's descriptions present and once with them absent —
 * and `engine/tag_dex.js` exports nothing and writes `data/tags.json` on require. Two copies of this
 * rule would disagree eventually and the disagreement would be invisible, which is the fact/feature
 * split CLAUDE.md already governs: FACTS ARE GLOBAL, one implementation, everyone calls it.
 *
 * THE DEFECT THIS REPLACES (2026-09-20, found by the first Reg M-C run,
 * docs/_reports/2026-09-20-regmc-first-run.md §5)
 * -----------------------------------------------
 * Both derivations read `move.shortDesc` — a HUMAN-READABLE STRING — and Reg M-C's checkout ships
 * with every Champions description removed (`02bb2ae Remove redundant Champions descriptions`). So:
 *
 *     reflect      M-B shortDesc "For 5 turns, physical damage to allies is halved."   M-C ""
 *     lightscreen  M-B shortDesc "For 5 turns, special damage to allies is halved."    M-C ""
 *     brickbreak   M-B shortDesc "Destroys screens, unless the target is immune."      M-C ""
 *
 * `/physical/i.test('')` is false and `/special/i.test('')` is false, so both screens fell through to
 * the `'both'` DEFAULT and Reflect began halving special attacks; `clearsScreens` required
 * `/reflect|screen|veil/i` on the same empty string, so Brick Break, Psychic Fangs and Raging Bull
 * silently lost the tag. A silent default that changes a board — and it was OUR derivation, not a
 * change to the game. The comment at the old site said in as many words that treating the two screens
 * as one "would have Reflect reducing a Moonblast, which it does not"; the sentence it derived that
 * from is what went away.
 *
 * A DESCRIPTION IS DOCUMENTATION. IT IS NOT THE MECHANIC. Everything below reads the handler bodies
 * and the condition objects — the code the authority actually runs — so the answer does not depend on
 * whether anybody wrote a sentence about it.
 *
 * MEMBERSHIP MEASURED ON BOTH CHECKOUTS BEFORE IT WAS WIRED (docs/LESSONS §4). Pinned M-B `20ad99f`
 * and M-C `f10d679` both derive the screen set {reflect, lightscreen, auroraveil} and both give
 * clearsScreens {brickbreak, psychicfangs, ragingbull} and categories Physical/Special/both — the old
 * derivation agrees on M-B and is wrong on all five rows on M-C.
 *
 * `ABRA_TAGDEX_SCREENS_FROM_PROSE=1` restores the pre-fix reads for a before/after. Under it
 * `engine/tag_dex.js` REFUSES to write `data/tags.json`, because a knob run that publishes the
 * artifact turns a demonstration into a regression nobody made. */
'use strict';

const PROSE = () => process.env.ABRA_TAGDEX_SCREENS_FROM_PROSE === '1';

/* GAME_RULES -- conformance S12b, 2026-09-21. ONE name is typed in this file and it is not a rule of
 * the game at all: it is a QUOTATION of the retired derivation, kept verbatim so
 * `ABRA_TAGDEX_SCREENS_FROM_PROSE=1` reproduces the pre-fix reads exactly. Deriving it would defeat
 * the purpose — a knob that restores "what the old code did" must restore what the old code did,
 * including its word list, or the before/after is a comparison against something nobody shipped.
 *
 * Nothing on the LIVE path below names a screen: `screenSideConditions` finds them by handler shape
 * and `clearsScreens` reads the literal arguments of `removeSideCondition`. If this constant is ever
 * reachable without the knob, that is the defect, not the name. */
const GAME_RULES = Object.freeze({
  RETIRED_PROSE_SCREEN_WORDS: /reflect|screen|veil/i,
});
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* WHICH SIDE CONDITIONS ARE SCREENS, derived: a side condition is a screen when its own `condition`
 * object carries a handler that modifies INCOMING DAMAGE. Safeguard writes `onSetStatus`, Mist
 * `onTryBoost`, Tailwind `onModifySpe`, Lucky Chant `onCriticalHit` — none of them is a screen, and
 * none of them is named here for it. Nothing is hand-listed. */
const DAMAGE_HANDLER = /^on(Any|Foe|Source)?(Modify)?Damage$/;
const _screens = new WeakMap();
function screenSideConditions(dex) {
  if (_screens.has(dex)) return _screens.get(dex);
  const out = new Set();
  for (const m of dex.moves.all()) {
    if (!m || !m.exists || !m.sideCondition) continue;
    const c = m.condition || {};
    if (Object.keys(c).some(k => typeof c[k] === 'function' && DAMAGE_HANDLER.test(k))) out.add(norm(m.sideCondition));
  }
  _screens.set(dex, out);
  return out;
}

/* WHICH CATEGORY ONE HALVES, out of the condition's own gate. Reflect's handler runs only when
 * `this.getCategory(move) === "Physical"`; Light Screen's only on `"Special"`. Aurora Veil names BOTH
 * — inside a bail-out that defers to whichever of the two is already up — so it restricts to neither
 * and the answer is `both`. The rule is therefore "the handler gates on exactly one category, or it
 * does not restrict", which reads the same on a handler written either way round. */
const CATEGORY_GATE = /getCategory\([^)]*\)\s*===\s*['"`](Physical|Special)['"`]/g;
function screenCategory(m) {
  if (PROSE()) {
    const d = String((m && m.shortDesc) || (m && m.desc) || '');
    return /physical/i.test(d) ? 'Physical' : /special/i.test(d) ? 'Special' : 'both';
  }
  const c = (m && m.condition) || {};
  const src = Object.keys(c).filter(k => typeof c[k] === 'function' && DAMAGE_HANDLER.test(k))
    .map(k => String(c[k])).join('\n');
  const cats = new Set([...src.matchAll(CATEGORY_GATE)].map(x => x[1]));
  return cats.size === 1 ? [...cats][0] : 'both';
}

/* WHAT TAKES ONE DOWN. The handler must name a screen as a STRING LITERAL argument of
 * `removeSideCondition` — `pokemon.side.removeSideCondition("reflect")`, three times over, in Brick
 * Break, Psychic Fangs and Raging Bull.
 *
 * LITERAL ARGUMENTS ONLY, AND THAT IS A DECISION WITH A COST. Defog and Tidy Up build a LIST and loop
 * it (`const removeTarget = ["reflect", "lightscreen", "auroraveil", "safeguard", "mist",
 * ...removeAll]; for (const targetCondition of removeTarget) ...`), so they name no screen at the call
 * site and do not match. Defog does clear screens in this format and carries no `clearsScreens` row
 * TODAY either — the prose read it replaces rejected it on the same grounds ("-1 evasion; ends user
 * and target hazards/terrain" holds no screen word). So membership is unchanged in both directions,
 * which is what a fix to a DERIVATION is allowed to do; widening it to the loop form is a MEMBERSHIP
 * change and belongs to its own pass, where a moved count cannot be confused with this one.
 * REPORTED, not silently absorbed. */
const LITERAL_REMOVE = /removeSideCondition\(\s*(['"`])([A-Za-z0-9]+)\1\s*\)/g;
function clearsScreens(m, dex) {
  const src = String((m && m.onTryHit) || '') + '\n' + String((m && m.onHit) || '');
  if (PROSE()) {
    return (/removeSideCondition/i.test(src) && GAME_RULES.RETIRED_PROSE_SCREEN_WORDS.test(String((m && m.shortDesc) || '')))
      ? { clears: 'screens' } : null;
  }
  const screens = screenSideConditions(dex);
  for (const x of src.matchAll(LITERAL_REMOVE)) if (screens.has(norm(x[2]))) return { clears: 'screens' };
  return null;
}

module.exports = { screenSideConditions, screenCategory, clearsScreens, PROSE_KNOB: 'ABRA_TAGDEX_SCREENS_FROM_PROSE' };
