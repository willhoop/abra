/* DOES THIS MOVE CARRY THIS LINKAGE KEY? — ONE IMPLEMENTATION, TWO CALLERS.
 *
 * `engine/tag_dex.js` asks it to BUILD `linkage.<key>.carrierMoves`.
 * `tests/interaction_matrix.js` asks it to REFUSE a control carrier that carries the flag under test.
 *
 * WHY IT HAD TO BE LIFTED OUT, 2026-08-11
 * ---------------------------------------
 * The generator had no predicate at all. It asked `LINKAGE[key].carrierMoves` — the ARTIFACT — whether
 * a candidate carried the flag, and `tag_dex` builds that list behind a USAGE GATE:
 *
 *     const u = U.move[id] || 0;  if (!u) continue;      // tag_dex, the carrier loop
 *
 * So `linkage.contact.carrierMoves` is "contact moves people actually click", 151 of them, and
 * FIFTEEN moves that carry `flags.contact` are absent from it purely because nobody plays them —
 * crushclaw, axekick, bind, bounce, comeuppance, covet, doublehit, flail, pluck, pound, seismictoss,
 * struggle, tailslap, thrash, wrap. Every one of those was eligible to be chosen as the "flagless"
 * CONTROL in a `contact x <protect>` case, and Blastoise's control was `flail`.
 *
 * Both arms then made contact, Spiky Shield chipped in both, the reference engine's two arms came out
 * IDENTICAL, and 57 pairs reported INERT — never scored, never in the parting list, and invisible in
 * the agreement rate, which went UP because it now covered less. A usage-ranked index is the right
 * thing for ranking and the wrong thing for a membership test, and the two uses had one name.
 *
 * The rule is CLAUDE.md's: a FACT gets one implementation and everybody calls it. The membership rule
 * here is Showdown's own — `move.flags.contact`, `move.priority`, `move.category` — read off the move,
 * never off a list of names and never off a derived artifact.
 *
 * `null` means THIS KEY HAS NO MOVE-CARRIER RULE (`emptyItemSlot`, `targetBoosted`, `moveType` are
 * properties of a holder or a type, not of a move) or the key is not one of tag_dex's. It is NOT
 * `false`: a caller that cannot get an answer must say so out loud rather than proceed as though the
 * answer were "no", which is exactly the silent default that cost the 57 pairs.
 */
'use strict';

/* The nine Showdown move flags tag_dex indexes verbatim. Read from `move.flags`, which is the
 * upstream boolean — a FLAG in the CLAUDE.md sense, never invented here. */
const FLAG_KEYS = ['contact', 'sound', 'punch', 'bullet', 'powder', 'wind', 'slicing', 'bite', 'heal'];

/* Keys whose carrier side tag_dex deliberately leaves empty: they describe the HOLDER's item slot,
 * the TARGET's boosts, or a type rather than a property a move can carry. Named so that "no rule"
 * is distinguishable from "not a key I know". */
const NO_MOVE_CARRIER_RULE = new Set(['emptyItemSlot', 'targetBoosted', 'moveType']);

function carriesLinkageKey(move, key) {
  if (!move || !move.exists) return null;
  if (FLAG_KEYS.includes(key)) return !!(move.flags || {})[key];
  if (key === 'priorityMove') return move.priority > 0;
  if (key === 'statusMove') return move.category === 'Status';
  if (key === 'physicalMove') return move.category === 'Physical';
  if (key === 'specialMove') return move.category === 'Special';
  if (NO_MOVE_CARRIER_RULE.has(key)) return null;
  return null;
}

/* A key whose carriers are, by construction, EVERY move of one category. A control carrier for such a
 * key cannot be both "the same category" and "without the key" — the two requirements contradict, and
 * a generator that does not know this stages a control the reactor treats exactly like the carrier.
 * That is how `statusMove x taunt` staged Guard Split against Disable: Taunt blocks both. */
const CATEGORY_KEYS = new Set(['statusMove', 'physicalMove', 'specialMove']);

module.exports = { carriesLinkageKey, FLAG_KEYS, NO_MOVE_CARRIER_RULE, CATEGORY_KEYS };
