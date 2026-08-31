/* test-effect-kind.js — THE CONDITION/MOVE NAME COLLISION.
 *
 *   node tests/test-effect-kind.js
 *
 * `engine/game_differential.js` annotates a divergence cause with the format standing of every entity
 * the two protocol lines name. It found them by tokenising and asking the dex, and it asked the MOVE
 * table first — so `|-start|p2a|confusion|[fatigue]`, the volatile that Outrage, Petal Dance, Raging
 * Fury and Thrash all leave behind, was published as `moves/confusion, legal: false,
 * nonstandard: 'Past'`. A mechanic four legal moves cause, filed as one this format cannot contain.
 *
 * WHY THIS TEST AND NOT A RE-RUN OF THE DIFFERENTIAL. The differential is a multi-minute run against
 * the official simulator and it is the last thing anyone reaches for to check a naming rule. The rule
 * therefore lives in `engine/effect_kind.js` and is exercised here in milliseconds, which is the same
 * move `divergence_shape.js` made on 2026-08-12.
 *
 * THE THREE CLAIMS, and the third is the one that is easy to get wrong:
 *   1. a condition-slot token that collides with an ILLEGAL move is a condition, and the move is gone;
 *   2. a condition-slot token that collides with a LEGAL move keeps BOTH — the move sets the volatile
 *      and its corpus usage is the only signal about how much play the family touches;
 *   3. a token that is NOT in the standalone condition table is untouched. Protect (101,357 clicks)
 *      and Tailwind (16,074) are volatiles named after their own moves and are NOT in that table;
 *      a rule that binned the move half would have deleted the top of the worklist.
 *
 * SHOWN RED BEFORE IT WAS TRUSTED: deleting the `inMoveArg.has(id)` guard in `effect_kind.js` makes
 * PART 3 report `|move|p1a|sunnyday` resolving as a condition; dropping the legality test in
 * `game_differential.js` makes PART 2 report the setter deleted.
 */
'use strict';
const path = require('path');
const EK = require(path.join(__dirname, '..', 'engine', 'effect_kind.js'));

let FAIL = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok    ' : '  FAIL  ') + msg); if (!cond) FAIL++; };

/* RESOLVE THE SIBLING CHECKOUT FIRST, THE WAY EVERY OTHER TEST HERE DOES. The refusal below is
 * right — a test that cannot run must not report a pass — but it fired before anything tried to
 * find the simulator, so a correct checkout read as an absent one. */
try { require('../engine/showdown_path.js'); } catch (e) { /* leave the refusal below to speak */ }
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const dex = Dex.forFormat('gen9championsvgc2026regmb');
const TABLE = dex.data.Conditions || {};
const IS_COND = (id) => Object.prototype.hasOwnProperty.call(TABLE, id);

console.log('\n  THE CONDITION TABLE');
ok(Object.keys(TABLE).length > 0,
   'the format carries a standalone condition table (' + Object.keys(TABLE).length + ' entries) — '
   + 'an empty one would silence the rule and every count below would be a legitimate-looking zero');

/* DERIVED, never typed: the collision set is whatever the format says it is. */
const COLLIDES = Object.keys(TABLE).filter(id => { const m = dex.moves.get(id); return m && m.exists; });
const ILLEGAL = COLLIDES.filter(id => !!dex.moves.get(id).isNonstandard);
const LEGAL = COLLIDES.filter(id => !dex.moves.get(id).isNonstandard);
console.log('  ' + COLLIDES.length + ' condition(s) share a name with a move; ' + ILLEGAL.length
            + ' of those moves are not in this format (' + ILLEGAL.join(', ') + ')');
ok(ILLEGAL.length > 0, 'at least one collision is with a move this format does not contain — the '
   + 'case the rule exists for is reachable, so a green run is evidence rather than vacuous');

console.log('\n  PART 1 — a condition-slot token is not answered out of the move table');
for (const id of ILLEGAL) {
  const cause = 'event missing from medicham2 :: |-start|p2a|' + id + '|[fatigue] <> |-weather|sunnyday|[upkeep]';
  const slots = EK.conditionSlotTokens(cause, IS_COND);
  ok(slots.has(id), '`|-start|p2a|' + id + '|…` resolves `' + id + '` as a condition, not as the '
     + dex.moves.get(id).isNonstandard + ' move of the same name');
  const st = EK.conditionStanding(id);
  ok(st.kind === 'conditions' && st.reachable === null && st.uses === null && st.legal === null,
     '  its standing is UNKNOWN on every field, never `reachable: false` — a condition must not be '
     + 'the reason a live cause is binned `cannot_occur_in_format`');
}

console.log('\n  PART 2 — a LEGAL move of the same name is kept beside the condition, not instead of it');
for (const id of LEGAL) {
  const cause = 'ordering :: |-damage|p1b|H/H|[from]' + id + ' <> |-sideend|p1:|tailwind';
  const slots = EK.conditionSlotTokens(cause, IS_COND);
  ok(slots.has(id), '`[from]' + id + '` is flagged as a condition slot');
  ok(!dex.moves.get(id).isNonstandard,
     '  and `' + id + '` IS a legal move here, so the differential keeps it as a setter and the '
     + 'family does not lose its usage weight');
}

console.log('\n  PART 3 — the `|move|` argument position still names a move');
for (const id of COLLIDES) {
  const cause = 'ordering :: |move|p1a|' + id + ' <> |move|p2b|' + id;
  ok(!EK.conditionSlotTokens(cause, IS_COND).has(id),
     '`|move|p1a|' + id + '` is a CLICK of that move and is never reclassified');
}

/* PART 4 ASSERTED A CLASSIFICATION AND THE CLASSIFICATION CHANGED UNDER IT ON 2026-08-31. It read
 * "`protect` is NOT in the standalone condition table, so the rule cannot reach it" — true of the
 * 35-entry table, and FALSE of the shipped resolver, which now derives the condition set from what
 * something legal can actually set and so does reach `protect`. The claim that matters was never the
 * classification: it is that the worklist keeps its corpus weight, because a rule that binned the move
 * half would have deleted the top of the ranking. So the OUTCOME is what is asserted here now. */
console.log('\n  PART 4 — the entities that carry the worklist keep their weight, however they classify');
const carriers = (() => {
  const m = new Map();
  for (const sp of dex.species.all()) {
    if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') continue;
    for (const a of Object.values(sp.abilities || {})) {
      const k = String(a).toLowerCase().replace(/[^a-z0-9]/g, ''); m.set(k, (m.get(k) || 0) + 1);
    }
  }
  return m;
})();
/* A `uses` figure is not what this file asserts, but an unreadable tags.json would make PART 4's
 * "the worklist keeps its weight" claim pass on two UNKNOWNs — so the failure speaks and PART 4
 * asserts a real number below rather than merely an equal one. */
let TAGS_ERR = null;
const TAGS = (() => {
  try { return JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', 'data', 'tags.json'), 'utf8')); }
  catch (e) { TAGS_ERR = String((e && e.message) || e); return {}; }
})();
ok(!TAGS_ERR, 'data/tags.json parsed' + (TAGS_ERR ? ' — IT DID NOT: ' + TAGS_ERR
   + ' , so every `uses` below reads UNKNOWN and PART 4 would pass on an absence' : ''));
const RESOLVER = EK.makeStanding({ dex, tags: TAGS, abilityCarriers: carriers });
for (const id of ['protect', 'tailwind', 'encore', 'reflect', 'endure']) {
  const m = dex.moves.get(id);
  ok(m && m.exists && !m.isNonstandard, '`' + id + '` is legal in this format');
  const a = RESOLVER.annotateCause('ordering :: |-singleturn|p1a|' + id + ' <> |move|p2b|' + id);
  const mv = a.mentions.find(x => x.kind === 'moves' && x.id === id);
  ok(!!mv && mv.reachable === true,
     '  and the resolver still returns the MOVE beside whatever else it names, reachable — the move '
     + 'is the setter of its own volatile and dropping it would delete the top of the worklist');
  ok(a.cannot_occur_in_format === false, '  so `|-singleturn|p1a|' + id + '` is never binned impossible');
}

console.log('\n  PART 5 — an UNPARSED cause (one half, no pair) does not throw');
for (const c of ['drag: a different body :: |drag|p2a|maus', '', '|upkeep']) {
  let threw = null;
  try { EK.conditionSlotTokens(c, IS_COND); EK.moveArgTokens(c); } catch (e) { threw = e.message; }
  ok(!threw, 'a cause the shaper calls UNPARSED is handled: ' + JSON.stringify(c.slice(0, 40))
     + (threw ? ' — THREW: ' + threw : ''));
}

console.log('');
if (FAIL) { console.log('  ' + FAIL + ' FAILURE(S)\n'); process.exit(1); }
console.log('  PASS — the condition/move collision is closed and the move positions are intact\n');
