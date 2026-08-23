/* move_result_state.js — THE MOVE RESULT, READ OUT OF BOTH ENGINES AND COMPARED.
 *
 * ================= WHY THIS EXISTS ==============================================================
 *
 * EVERY DEFERRAL OF THE ANNOUNCE-FAILURE CLASS HAS CITED THE SAME MISSING INSTRUMENT, IN THESE WORDS:
 *
 *   engine/medicham2-browser.js:17525 (ROADMAP #341, 2026-08-22)
 *       "`_mvRes` IS LEFT EXACTLY AS IT WAS ... What the authority does to `moveThisTurnResult` on a
 *        `null` drag -- which is what Stomping Tantrum reads next turn -- was NOT staged in this
 *        pass, and the 2026-08-12 retraction is what happens when a state change rides in on a
 *        narration fix."
 *
 *   engine/medicham2-browser.js:8875 (ROADMAP #256)
 *       "`NOT_FAIL`'s effect on `moveThisTurnResult` was NOT staged in this pass -- the field is
 *        cleared at the turn boundary, so it cannot be read off a finished battle the way a protocol
 *        line can."
 *
 *   docs/_reports/2026-08-23-phaze-empty-bench.md §4
 *       "`mvFail` also writes `m._mvRes` ... `board_state.js` does not compare it, so the boards
 *        agreeing does not prove `_mvRes` agrees. So this was NOT fixed in this pass."
 *
 * The reasoning is sound and it is why the class kept stalling: `mvFail(mon)` is
 * `{ mon._mvRes = false; TR.fail(mon); }` — ONE call that writes a protocol line AND a state field,
 * and only the line had an instrument. Adding the line therefore silently changed state nothing
 * measured. THIS FILE IS THE MISSING HALF. It does not fix anything; it makes the second half of
 * `mvFail` visible so a fix can be judged on both.
 *
 * ================= THE FIELD IS REAL STATE, NOT BOOKKEEPING =====================================
 *
 * Consumers in the authority, read out of the source rather than recalled:
 *
 *   data/moves.ts:18048   `if (pokemon.moveLastTurnResult === false) { return move.basePower * 2; }`
 *   data/moves.ts:19184   the same test on a second move
 *   data/items.ts:4010    `if (this.effectState.lastMove === move.id && pokemon.moveLastTurnResult)`
 *   data/abilities.ts:5176 `pokemon.moveThisTurnResult !== undefined` — the UNDEFINED/true split
 *                          matters to this one, where it is inert for the other three.
 *
 * So a wrong value is a wrong base power or a wrong item trigger on the FOLLOWING turn. It is not
 * narration, and it is not compared by `engine/board_state.js` — checked, not assumed: that file's
 * field list holds no move-result entry and its `NOT_COMPARED` block does not name one either, so
 * this was an ABSENCE rather than a declared gap. An absent field reads exactly like an agreeing one.
 *
 * ================= WHERE THE VALUE LIVES, AND WHY `last` IS THE ONE TO COMPARE ==================
 *
 * Both engines roll the live result into a previous-turn field at the SAME instant:
 *
 *   sim/battle.ts:1671-1672            `moveLastTurnResult = moveThisTurnResult;
 *                                       moveThisTurnResult = undefined;`      (nextTurn)
 *   engine/medicham2-browser.js:24630  `m._mvResLast = m._mvRes; m._mvRes = undefined;`
 *
 * A comparison taken at the turn boundary — the instant `engine/board_state.js` already compares
 * everything else at, and the instant the next decision is made from — therefore reads `last` on
 * both sides and `undefined` on both `this` fields. `this` is read and reported ANYWAY, because a
 * non-undefined `this` at a boundary means one of the two engines did not roll, which is a different
 * defect from the two disagreeing and must not be collapsed into it.
 *
 * ================= THE MAPPING, DECLARED AND DEMONSTRATED =======================================
 *
 * Four-valued on both sides and the vocabulary is IDENTICAL, which is the unusual case — this is a
 * field medicham2 copied from the authority rather than modelled independently:
 *
 *     true       the move resolved and did something
 *     false      the move failed (`-fail`); THIS is the value the doubler reads
 *     null       the move ended with no message — the authority's NOT_FAIL / `!moveResult &&
 *                !atLeastOneFailure` road (battle-actions.ts:507, :616)
 *     undefined  the body did not move at all, or the turn has been rolled
 *
 * `null` and `undefined` are NOT collapsed. `moveLastTurnResult === false` is the only test three of
 * the four consumers make, so a null/undefined confusion is inert for them — but the fourth reads
 * `!== undefined`, and collapsing here would silence exactly that one. Encoding is to STRINGS so the
 * four survive JSON, `Object.keys` and a console; `decode` is exported and round-trips, asserted in
 * the selftest, because two encoders for one fact eventually disagree.
 *
 * ================= WHAT IT DOES NOT DO ==========================================================
 *
 *  - It is NOT wired into `engine/board_state.js`. Promoting it to a compared board field changes
 *    what every whole-game run counts, and light mode cannot size that. See the OWED list in
 *    docs/_reports/2026-08-23-announce-failure-class.md.
 *  - It reads ACTIVE bodies only. A benched body's result is stale by construction and neither
 *    engine's consumers read it there.
 *  - It reports; it never decides. The caller says what a difference means.
 *
 *   node engine/move_result_state.js --selftest
 */
'use strict';

/* THE FOUR VALUES, ENCODED SO THEY SURVIVE JSON. `typeof` rather than a chain of ===, so a value
 * outside the four (a number, a string) is reported AS ITSELF rather than silently becoming one of
 * the four — a silent default here would be the exact shape CLAUDE.md names. */
function encode(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  return 'UNEXPECTED(' + (typeof v) + ':' + String(v) + ')';
}
function decode(s) {
  if (s === 'undefined') return undefined;
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  return s;
}

const SLOT = (sideIdx, slotIdx) => 'p' + (sideIdx + 1) + 'abcd'[slotIdx];

/* ---- THE AUTHORITY ----------------------------------------------------------------------------
 * `battle.sides[i].active[j]` is the same walk `engine/board_state.js` makes. A null slot (a body
 * that fainted and has not been replaced) yields no row rather than a row of undefined, so an empty
 * slot cannot masquerade as agreement. */
function readSd(battle) {
  const out = {};
  if (!battle || !battle.sides) return out;
  battle.sides.forEach((side, i) => {
    (side.active || []).forEach((p, j) => {
      if (!p) return;
      out[SLOT(i, j)] = { species: String((p.species && p.species.id) || p.speciesid || ''),
                          this: encode(p.moveThisTurnResult), last: encode(p.moveLastTurnResult) };
    });
  });
  return out;
}

/* ---- MEDICHAM2 --------------------------------------------------------------------------------
 * `S.actA` / `S.actB` are the live active arrays; the species key is `.name` because that is what
 * this engine keys bodies on. Order is index-parallel with the authority's `active`, which is the
 * same assumption every other comparator in this repo makes and is checked by the caller through the
 * species field below rather than assumed here. */
function readMe(S) {
  const out = {};
  if (!S) return out;
  [S.actA, S.actB].forEach((arr, i) => {
    (arr || []).forEach((m, j) => {
      if (!m) return;
      out[SLOT(i, j)] = { species: String(m.name || ''),
                          this: encode(m._mvRes), last: encode(m._mvResLast) };
    });
  });
  return out;
}

/* THE SPECIES KEYS DIFFER IN SPELLING LEGITIMATELY (`morpeko-hangry` vs `morpekohangry`), so they
 * are folded before being compared — and they are compared at all only to catch the index-parallel
 * assumption failing, which is a claim about the INSTRUMENT and is reported apart from a value
 * difference. */
const fold = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* `which` is 'last' by default: see the header for why the turn boundary is the moment `last` is the
 * live value on both sides. Pass 'both' to compare `this` as well — a non-undefined `this` at a
 * boundary means an engine did not roll, which is reported as its own shape. */
function compare(sd, me, which) {
  const want = which === 'both' ? ['last', 'this'] : ['last'];
  const slots = Array.from(new Set(Object.keys(sd || {}).concat(Object.keys(me || {})))).sort();
  const diffs = [], misaligned = [], missing = [];
  for (const k of slots) {
    const a = sd && sd[k], b = me && me[k];
    if (!a || !b) { missing.push({ slot: k, sd: a ? a.species : null, me: b ? b.species : null }); continue; }
    if (fold(a.species) !== fold(b.species)) misaligned.push({ slot: k, sd: a.species, me: b.species });
    for (const f of want) {
      if (a[f] !== b[f]) diffs.push({ slot: k, field: f, species: b.species, sd: a[f], me: b[f] });
    }
  }
  return { identical: diffs.length === 0, diffs, misaligned, missing, compared: slots.length };
}

const at = (battle, S, which) => compare(readSd(battle), readMe(S), which);

module.exports = { encode, decode, readSd, readMe, compare, at, SLOT };

/* ---- THE RED DEMONSTRATION --------------------------------------------------------------------
 * Every claim above is driven through the SHIPPING functions, never through a restatement of them.
 * The bar is that a comparator which cannot tell the four values apart FAILS here. */
if (require.main === module && process.argv.includes('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}` + (c ? '' : '   got ' + JSON.stringify(got))); };

  ok('the four values encode apart — no two share a token',
    new Set([encode(true), encode(false), encode(null), encode(undefined)]).size === 4);
  ok('RED — a value outside the four is reported AS ITSELF and never folded into one of them',
    encode(0) !== 'false' && encode(0) !== 'null' && /^UNEXPECTED/.test(encode(0))
    && /^UNEXPECTED/.test(encode('')), [encode(0), encode('')]);
  ok('decode round-trips all four, so an encoded artifact is not a one-way door',
    decode(encode(true)) === true && decode(encode(false)) === false
    && decode(encode(null)) === null && decode(encode(undefined)) === undefined);

  /* -- the two readers, on hand-built stand-ins with the REAL field names ----------------------- */
  const battle = { sides: [
    { active: [{ species: { id: 'tyranitar' }, moveThisTurnResult: undefined, moveLastTurnResult: false }, null] },
    { active: [{ species: { id: 'weavile' }, moveThisTurnResult: true, moveLastTurnResult: true }] }] };
  const S = { actA: [{ name: 'Tyranitar', _mvRes: undefined, _mvResLast: false }, null],
              actB: [{ name: 'Weavile', _mvRes: true, _mvResLast: true }] };
  const sd = readSd(battle), me = readMe(S);
  ok('the authority reader names slots p1a/p2a and skips a null slot rather than inventing a row',
    Object.keys(sd).join(',') === 'p1a,p2a', Object.keys(sd));
  ok('medicham2\'s reader names the same slots off actA/actB',
    Object.keys(me).join(',') === 'p1a,p2a', Object.keys(me));
  ok('an agreeing pair is identical', compare(sd, me).identical === true, compare(sd, me));

  /* -- THE BAR: each of the four values must be distinguishable from each of the other three ---- */
  for (const [x, y] of [[false, null], [false, undefined], [false, true], [null, undefined],
                        [null, true], [undefined, true]]) {
    const A = { p1a: { species: 'x', this: encode(undefined), last: encode(x) } };
    const B = { p1a: { species: 'x', this: encode(undefined), last: encode(y) } };
    ok('RED — ' + encode(x) + ' is not mistaken for ' + encode(y),
      compare(A, B).identical === false && compare(A, B).diffs[0].field === 'last', compare(A, B));
  }

  /* -- the `this` field is only compared when asked, and then it IS compared ------------------- */
  const T1 = { p1a: { species: 'x', this: 'true', last: 'true' } };
  const T2 = { p1a: { species: 'x', this: 'undefined', last: 'true' } };
  ok('a `this` difference is INVISIBLE at the default boundary comparison', compare(T1, T2).identical === true);
  ok('RED — and VISIBLE under \'both\', so an engine that failed to roll is catchable',
    compare(T1, T2, 'both').identical === false
    && compare(T1, T2, 'both').diffs[0].field === 'this', compare(T1, T2, 'both'));

  /* -- the instrument's own failure modes are reported APART from a finding --------------------- */
  const M1 = { p1a: { species: 'Weavile', this: 'undefined', last: 'true' } };
  const M2 = { p1a: { species: 'Garchomp', this: 'undefined', last: 'true' } };
  ok('RED — two different bodies in one slot is an INDEX-PARALLEL failure, reported apart from a '
    + 'value difference and NOT as agreement',
    compare(M1, M2).identical === true && compare(M1, M2).misaligned.length === 1, compare(M1, M2));
  ok('a spelling difference in one species is NOT misalignment',
    compare({ p1a: { species: 'morpeko-hangry', this: 'undefined', last: 'true' } },
            { p1a: { species: 'morpekohangry', this: 'undefined', last: 'true' } }).misaligned.length === 0);
  ok('RED — a slot ONE engine has and the other does not is `missing`, never silent',
    compare({ p1a: { species: 'x', this: 'undefined', last: 'true' } }, {}).missing.length === 1);
  ok('a null battle / null state returns no rows rather than throwing',
    Object.keys(readSd(null)).length === 0 && Object.keys(readMe(null)).length === 0);

  console.log('\nMOVE-RESULT-STATE SELFTEST: ' + (ran - bad) + ' passed, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
}
