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

module.exports = { TOKENS, halves, moveArgTokens, conditionSlotTokens, conditionStanding };
