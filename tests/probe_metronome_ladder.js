/* WIRE 158 — THE METRONOME ITEM'S CONSECUTIVE-USE LADDER, PROBED AT EVERY RUNG.
 *
 *   node tests/probe_metronome_ladder.js
 *   MEDI_NO_METRONOME_LADDER=1 node tests/probe_metronome_ladder.js     (the red demonstration)
 *
 * WHY IT PROBES EVERY RUNG AND NOT JUST THE SECOND. `data/roster.items.json` stages this item once
 * and its divergence is `949 against 952` — one step of one rung. A fixture that only ever reaches
 * rung 1 cannot tell a correct six-step ladder from an engine that hard-codes a single x1.2, and this
 * repository has already paid for exactly that shape twice: a multi-hit pin that only ever landed on
 * the bottom corner of a [2,5] range, and a fixture that was immune for two reasons. So the price is
 * read at rungs 0..6 and compared to the tag's OWN `steps4096`, including the rung ABOVE the cap.
 *
 * IT COMPARES A RATIO, NOT A NUMBER. `dmgRange` truncates once at the end of the modifier chain, so
 * the rung-N damage is not exactly rung-0 damage times the step — it is the authority's own
 * `modify(value, mod)` and the last bit is dropped. Asserting an exact product would be asserting
 * against float arithmetic the authority does not do. What is asserted instead is the property that
 * cannot hold by accident: the sequence is NON-DECREASING, it MOVES at every rung the tag says moves,
 * it is FLAT at the cap, and rung 0 is the un-boosted price to the unit.
 *
 * THE KNOB IS THE CONTROL AND IT IS NOT OPTIONAL. `MEDI_NO_METRONOME_LADDER=1` must make all seven
 * readings IDENTICAL. An unwired consumer produces exactly that, so a run that only ever sees the
 * climbing arm has not shown the knob is connected — it has shown one number seven times.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));
const MC = globalThis.MC;

const OFF = process.env.MEDI_NO_METRONOME_LADDER === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

/* THE MEMBERSHIP, PRINTED BEFORE IT IS USED. Every derived set in this project over-matched on its
 * first try, and a set of one is not exempt — it is the case where an over-match is least visible. */
const CARRIERS = Object.keys(TAGS.items || {})
  .filter(k => (TAGS.items[k].tags || []).indexOf('damageMultOnRepeat') >= 0);
const CALLERS = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('callsAnotherMove') >= 0);
console.log('\n  WIRE 158 — the Metronome item, rung by rung' + (OFF ? '   [MEDI_NO_METRONOME_LADDER=1]' : ''));
console.log('\n  DERIVED — items carrying `damageMultOnRepeat`: ' + (CARRIERS.join(', ') || 'NONE'));
console.log('  DERIVED — moves carrying `callsAnotherMove` (skipped by the counter, never reset): '
  + (CALLERS.join(', ') || 'NONE'));

if (!CARRIERS.length) { console.log('\n  FAIL  no carrier — the tag is gone and nothing below can run'); process.exit(1); }
const ITEM = CARRIERS[0];
const LADDER = ((TAGS.items[ITEM].params || {}).damageMultOnRepeat) || {};
const STEPS = LADDER.steps4096 || [];
const DENOM = +LADDER.denom || 0;
const CAP = Number.isFinite(+LADDER.cap) ? +LADDER.cap : STEPS.length - 1;
console.log('  DERIVED — the ladder off the tag: [' + STEPS.join(', ') + '] / ' + DENOM + ', cap ' + CAP + '\n');

/* THE FIXTURE. A never-missing, non-multi-hit, single-target physical move so that nothing else in
 * `dmgRange` varies between the readings — the ONLY thing that moves across the seven calls is the
 * attacker's `_metroN`. Aerial Ace is `accuracy: true`, carries no secondary and no `multiHit`. */
const ATT = 'corviknight', DEF = 'aggron', MV = 'aerialace';
const att = MEDI.buildMon(ATT), def = MEDI.buildMon(DEF);
if (!att || !def) { console.log('  FAIL  buildMon returned null — the fixture never ran'); process.exit(1); }
att.item = ITEM; def.item = '';
const FIELD = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0 };
const priceAt = n => {
  att._metroN = n;
  const r = MEDI.dmgRange(att, def, MC.moves[MV], FIELD, false, false, {});
  return r ? { min: r.min, max: r.max } : null;
};

const rows = [];
for (let n = 0; n <= CAP + 1; n++) rows.push({ n, ...(priceAt(n) || {}) });
console.log('  ' + ATT + ' ' + MV + ' -> ' + DEF + ', holding ' + ITEM + ':');
for (const r of rows) {
  const step = STEPS[Math.min(n2i(r.n), STEPS.length - 1)];
  console.log('    rung ' + r.n + (r.n > CAP ? ' (above the cap)' : '') + '   '
    + String(r.min) + '-' + String(r.max) + '   tag step ' + step + '/' + DENOM);
}
function n2i(n) { return Math.max(0, Math.min(CAP, n)); }
console.log('');

const maxes = rows.map(r => r.max);
ok(rows.every(r => Number.isFinite(r.max) && r.max > 0),
   'every rung priced a real number', maxes.join(', '));

if (OFF) {
  /* THE CONTROL ARM. The knob must flatten the whole ladder — not soften it. */
  ok(new Set(maxes).size === 1,
     'THE KNOB IS CONNECTED — every rung reads the SAME damage with the ladder switched off',
     'maxes: ' + maxes.join(', ') + '   (a live consumer cannot produce this)');
  ok(MEDI.MEDFAILS.metronomeLadderBlindRestored === 1
     || MEDI.MEDSEEN.metroLadderApplied === 0,
     'the run declares itself: nothing was multiplied',
     'metroLadderApplied ' + MEDI.MEDSEEN.metroLadderApplied);
} else {
  ok(new Set(maxes).size > 1,
     'THE LADDER IS NOT FLAT — the seven rungs are not one number seven times',
     'maxes: ' + maxes.join(', '));
  /* NON-DECREASING is the weakest true statement; MOVING AT EVERY DECLARED STEP is the strong one. */
  let mono = true, movedAt = [], stuckAt = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].max < rows[i - 1].max) mono = false;
    const wantMove = i <= CAP && STEPS[i] !== STEPS[i - 1];
    if (wantMove && rows[i].max > rows[i - 1].max) movedAt.push(i);
    else if (wantMove) stuckAt.push(i);
  }
  ok(mono, 'the ladder never goes DOWN a rung', maxes.join(' -> '));
  ok(stuckAt.length === 0,
     'the damage MOVES at every rung the tag says moves — all ' + movedAt.length + ' of them',
     stuckAt.length ? 'stuck at rung(s) ' + stuckAt.join(', ') + ' — a consumer that reads only the '
                    + 'first step looks exactly like this'
                    : 'moved at rungs ' + movedAt.join(', '));
  ok(rows[CAP + 1] && rows[CAP + 1].max === rows[CAP].max,
     'the ladder is FLAT ABOVE THE CAP — rung ' + (CAP + 1) + ' prices as rung ' + CAP,
     rows[CAP].max + ' -> ' + rows[CAP + 1].max + '   (the authority clamps with `> 5 ? 5`)');
  /* RUNG 0 IS THE UN-BOOSTED PRICE, ASSERTED AGAINST A BODY WITH NO ITEM AT ALL rather than against
   * itself. `steps4096[0]` is the identity 4096, so holding the item and having used the move ONCE
   * must be indistinguishable from not holding it — if it is not, the consumer is off by one rung
   * and every number above is wrong in the same direction. */
  const bare = MEDI.buildMon(ATT); bare.item = '';
  const bareR = MEDI.dmgRange(bare, def, MC.moves[MV], FIELD, false, false, {});
  ok(bareR && bareR.max === rows[0].max && bareR.min === rows[0].min,
     'RUNG 0 IS THE IDENTITY — the first use of a move is priced as if the item were not there',
     'no item ' + (bareR && bareR.min) + '-' + (bareR && bareR.max)
     + '   rung 0 ' + rows[0].min + '-' + rows[0].max);
  ok(MEDI.MEDSEEN.metroLadderApplied > 0,
     'the consumer PROVES IT RAN — metroLadderApplied is non-zero',
     'metroLadderApplied ' + MEDI.MEDSEEN.metroLadderApplied
     + ' (it counts only steps ABOVE the identity, so rung 0 does not credit itself)');
  ok(MEDI.MEDFAILS.metroLadderUnreadable === 0,
     'the ladder was readable on every call',
     'metroLadderUnreadable ' + MEDI.MEDFAILS.metroLadderUnreadable
     + (MEDI.MEDFAILS.metroLadderUnreadableFirst ? ' — ' + MEDI.MEDFAILS.metroLadderUnreadableFirst : ''));
}

/* THE OVER-MATCH CONTROL. A body holding ANY OTHER item must be untouched by `_metroN`, or the
 * consumer is keyed on the counter rather than on the item. */
{
  const other = MEDI.buildMon(ATT); other.item = 'leftovers';
  const at0 = (other._metroN = 0, MEDI.dmgRange(other, def, MC.moves[MV], FIELD, false, false, {}));
  const at5 = (other._metroN = 5, MEDI.dmgRange(other, def, MC.moves[MV], FIELD, false, false, {}));
  ok(at0 && at5 && at0.max === at5.max,
     'CONTROL — a body holding a DIFFERENT item is untouched by the counter',
     'leftovers at rung 0 ' + (at0 && at0.max) + ', at rung 5 ' + (at5 && at5.max));
}

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
