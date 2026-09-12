/* probe_apparent_type_broadcast.js — THE BOTTOM-SCREEN TYPE LINE, WHICH THIS ENGINE HAD NEVER
 * EMITTED AND WHICH EXACTLY ONE LEGAL MOVE CAN CAUSE.
 *
 *   node tests/probe_apparent_type_broadcast.js
 *   MEDI_APPARENT_TYPE_BLIND=1 node tests/probe_apparent_type_broadcast.js     (the red demonstration)
 *
 * ================= WHAT WAS MEASURED, BEFORE ANYTHING WAS WRITTEN ================================
 *
 * `data/all-mechanics-fire.json`, release 48ac1c228e02, row `moves.reflecttype`:
 *
 *     medicham2 stopped emitting while showdown continued :: |-start|p1a|typechange|water
 *
 *     showdown   |move|p1a: Gengar|Reflect Type|p2a: Feraligatr
 *                |-start|p1a: Gengar|typechange|[from] move: Reflect Type|[of] p2a: Feraligatr
 *                ... |upkeep
 *                |-start|p1a: Gengar|typechange|Water|[silent]        <- this line
 *                |turn|2
 *     medicham   (identical through `|upkeep`, then nothing)
 *
 * The two streams agree line for line for the whole turn. The authority then writes one more line at
 * the TURN BOUNDARY, and it says out loud what the in-move line deliberately withheld.
 *
 * ================= THE AUTHORITY, READ WHOLE =====================================================
 *
 * `Battle#nextTurn`, sim/battle.ts:1709-1721 — runs after the upkeep and before `|turn|N`:
 *
 *     if (this.gen >= 7 && !pokemon.terastallized) {
 *       const seenPokemon = pokemon.illusion || pokemon;
 *       const realTypeString = seenPokemon.getTypes(true).join('/');
 *       if (realTypeString !== seenPokemon.apparentType) {
 *         this.add('-start', pokemon, 'typechange', realTypeString, '[silent]');
 *         seenPokemon.apparentType = realTypeString;
 *         if (pokemon.addedType) this.add('-start', pokemon, 'typeadd', pokemon.addedType, '[silent]');
 *       }
 *     }
 *
 * and `Pokemon#setType` ends in `this.apparentType = this.types.join('/')` (sim/pokemon.ts:2131), so
 * an ordinary type write can never make this fire. ONE legal handler pulls the two apart on purpose:
 *
 *     reflecttype.onHit (data/moves.ts:14887-14904; no Champions override — the mod's moves.ts was
 *                        grepped for the id and holds none):
 *       const oldApparentType = source.apparentType;
 *       ...
 *       source.setType(newBaseTypes);
 *       source.knownType = target.isAlly(source) && target.knownType;
 *       if (!source.knownType) source.apparentType = oldApparentType;
 *
 * So it is a HIDDEN-INFORMATION mechanism: Reflect Type aimed at a FOE does not tell the room what
 * the user turned into, and the bottom-screen broadcast then tells the OWNER at the next boundary.
 * Aimed at an ALLY, `knownType` stays true, nothing is held back, and NO line follows.
 *
 * ================= WHAT THE ARMS BELOW ARE ======================================================
 *
 * The ALLY arm and the SOAK arm are the two ways an over-firing fix breaks something that is correct
 * today: a sweep that fired on every type change would add a line to Soak, Conversion, Camouflage,
 * Protean and every forme change, none of which the authority writes.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_APPARENT_TYPE_BLIND === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  THE TURN-BOUNDARY REAL-TYPE BROADCAST' + (OFF ? '   [MEDI_APPARENT_TYPE_BLIND=1]' : ''));

/* ---- 0. THE MEMBERSHIP, PRINTED ---------------------------------------------------------------
 * The hold-back lives in the `typecopy` branch, which is `changesTargetType.writesToSelf`. Printed
 * so that a second carrier arriving later is visible here rather than assumed away. */
const copiers = Object.keys(TAGS.moves || {})
  .filter(k => (((TAGS.moves[k].params || {}).changesTargetType) || {}).writesToSelf);
const writers = Object.keys(TAGS.moves || {})
  .filter(k => { const p = ((TAGS.moves[k].params || {}).changesTargetType) || {}; return p.adds || p.replaces; });
console.log('\n  DERIVED — moves that copy a typing ONTO THE USER (the hold-back): ' + (copiers.join(', ') || 'NONE'));
console.log('  DERIVED — moves that write a typing onto a TARGET (must stay silent): ' + (writers.join(', ') || 'NONE'));
ok(copiers.length >= 1 && writers.length >= 1,
  'the format has both shapes, so the positive and the negative arm are both real',
  'copiers ' + copiers.length + ', writers ' + writers.length);

/* ---- THE FIXTURE — the roster row's own bodies ------------------------------------------------- */
const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = 'none'; return b; };
const rng5 = () => 0.5;

/* Two turns, because the line is written at the boundary of the SECOND. `aim` is 'foe' | 'ally'. */
function play(click, aim, turns, foeSp) {
  const me = bare('gengar'), ally = bare('venusaur');
  const f1 = bare(foeSp || 'feraligatr'), f2 = bare('charizard');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  const tgt = aim === 'ally' ? ally : f1;
  const acts = (t) => new Map([[me, t === 1 ? M.playerAction(me, click, tgt, S.field) : { kind: 'pass' }],
                               [ally, { kind: 'pass' }]]);
  for (let t = 1; t <= (turns || 2); t++) {
    M.battleTurn(S, rng5, acts(t), new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  }
  return { trace, myTypes: (me.types || []).join('/'), foeTypes: (f1.types || []).join('/'),
           allyTypes: (ally.types || []).join('/'), held: me._apparentTypes };
}
const silent = (r) => r.trace.filter(l => /typechange/.test(String(l)) && /\[silent\]/.test(String(l)));
const anyType = (r) => r.trace.filter(l => /typechange/.test(String(l)));

/* ---- 1. REFLECT TYPE AT A FOE — THE LINE ------------------------------------------------------- */
const foe = play('reflecttype', 'foe');
ok(foe.myTypes === 'Water',
  'CONTROL — the user really does take the target\'s typing',
  'gengar types now ' + foe.myTypes + '   (feraligatr is ' + foe.foeTypes + ')');
ok(silent(foe).length === 1 && /gengar/i.test(String(silent(foe)[0])) && /\|Water\|/.test(String(silent(foe)[0])),
  'one `|-start|<user>|typechange|<real types>|[silent]` follows, naming the NEW typing',
  (silent(foe).join(' | ') || '(no [silent] line)')
  + '\n          full trace: ' + foe.trace.join(' | '));

/* ---- 2. IT SITS AT THE TURN BOUNDARY, AFTER THE UPKEEP AND BEFORE THE `|turn|` ------------------ */
const idx = foe.trace.findIndex(l => /typechange/.test(String(l)) && /\[silent\]/.test(String(l)));
ok(idx > 0 && /^\|upkeep/.test(String(foe.trace[idx - 1] || ''))
   && /^\|turn\|/.test(String(foe.trace[idx + 1] || '')),
  'and it sits between the `|upkeep|` and the next `|turn|`, where `nextTurn` writes it',
  'before: ' + (foe.trace[idx - 1] || '(nothing)') + '   after: ' + (foe.trace[idx + 1] || '(nothing)'));

/* ---- 3. IT FIRES ONCE, NOT EVERY TURN ---------------------------------------------------------- */
/* `seenPokemon.apparentType = realTypeString` is the same statement that writes the line, so the
 * mismatch is gone by the next boundary. A sweep that re-fired would add a line every single turn. */
const four = play('reflecttype', 'foe', 5);
ok(silent(four).length === 1,
  'it fires ONCE — the broadcast updates the apparent typing as it writes it',
  silent(four).length + ' line(s) across five turns: ' + silent(four).join(' | '));

/* ---- 4. AT THE ALLY IT IS SILENT — `target.isAlly(source) && target.knownType` ------------------ */
const ally = play('reflecttype', 'ally');
ok(ally.myTypes === 'Grass/Poison',
  'CONTROL — a Reflect Type aimed at the ALLY still copies the ally\'s typing',
  'gengar types now ' + ally.myTypes + '   (venusaur is ' + ally.allyTypes + ')');
ok(silent(ally).length === 0,
  'and NO `[silent]` line follows — nothing was withheld, so nothing leaks at the boundary',
  (silent(ally).join(' | ') || '(none — correct)')
  + '\n          full trace: ' + ally.trace.join(' | '));

/* ---- 5. AN ORDINARY TYPE WRITE IS SILENT — THE OVER-FIRE ARM ----------------------------------- */
/* Soak writes the TARGET's typing through `setType`, which updates `apparentType` in the same call.
 * A sweep keyed on "the types changed" rather than on "a handler held the apparent typing back"
 * would add a line here, to every Conversion, and to every forme change. */
/* THE TARGET IS DELIBERATELY NOT ALREADY WATER. Aimed at the roster's Feraligatr the control reads
 * `Water` before and after and would pass while measuring nothing — the first version of this arm
 * did exactly that. Garchomp is Dragon/Ground, so the write is visible. */
const soak = play('soak', 'foe', 2, 'garchomp');
ok(soak.foeTypes === 'Water',
  'CONTROL — Soak still writes the target\'s typing, and the target was not Water to begin with',
  'garchomp (Dragon/Ground) types now ' + soak.foeTypes);
ok(silent(soak).length === 0,
  'an ordinary type WRITE emits no boundary line at all',
  (silent(soak).join(' | ') || '(none — correct)')
  + '\n          typechange lines seen: ' + (anyType(soak).join(' | ') || '(none)'));

/* ---- 6. IT IS PAID AT THE FOOT OF THE TURN THAT OWES IT, NOT AT THE HEAD OF THE NEXT ONE -------
 * THE ARM THAT CAUGHT THE FIRST PLACEMENT. The sweep originally sat above `TR.turn(S.turn+1)`, which
 * is indistinguishable inside a long game and emits NOTHING on the last turn of a script — and the
 * roster's Reflect Type fixture is ONE TURN, so the row went on diverging with the fix in. The
 * authority always advances (`Battle#nextTurn` runs whether or not anybody chooses again), so a
 * single-turn game must already carry the line. */
const oneTurn = (() => {
  const me = bare('gengar'), ally = bare('venusaur');
  const f1 = bare('feraligatr'), f2 = bare('charizard');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'reflecttype', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { trace, held: me._apparentTypes };
})();
ok(oneTurn.trace.some(l => /typechange/.test(String(l)) && /\[silent\]/.test(String(l)))
   && oneTurn.held === null,
  'ONE turn is enough — the line is written at the foot of the turn that owes it, and the debt clears',
  'trace: ' + oneTurn.trace.join(' | ') + '\n          _apparentTypes after: ' + JSON.stringify(oneTurn.held));

/* ---- 7. THE KNOB MOVES THE OUTCOME ------------------------------------------------------------- */
ok(OFF || silent(foe).length === 1,
  'the knob MOVES the stream — identical output across it would mean the sweep is dead',
  'lines with the sweep on: ' + silent(foe).length);

const seen = M.MEDSEEN || {}, fails = M.MEDFAILS || {};
/* ---- 8. THE TWO COUNTERS AGREE ----------------------------------------------------------------- */
/* A broadcast with no hold-back is impossible by construction; a hold-back with no broadcast means
 * the body left or died first. Both must be non-zero here or the fixture proved nothing. */
ok(OFF ? true : ((seen.apparentTypeHeldBack || 0) > 0 && (seen.apparentTypeBroadcast || 0) > 0),
  'both halves of the mechanism ran — a handler held one back AND a boundary leaked it',
  'heldBack=' + (seen.apparentTypeHeldBack || 0) + '  broadcast=' + (seen.apparentTypeBroadcast || 0));

console.log('\n  COUNTERS  apparentTypeHeldBack=' + (seen.apparentTypeHeldBack || 0)
  + '  apparentTypeBroadcast=' + (seen.apparentTypeBroadcast || 0)
  + '  apparentTypeBlindRestored=' + (fails.apparentTypeBlindRestored || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
