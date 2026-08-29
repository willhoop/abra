/* WHICH HIT COUNTS DOES ANYTHING IN THIS REPOSITORY ACTUALLY COMPARE?
 *
 *   SHOWDOWN_PATH=... node tests/probe_multihit_corners.js
 *
 * `data/roster.moves.json` stages fourteen multi-hit moves and every one of them carries the note
 * "THE PIN LANDS ON 2 HIT(S), which is the bottom corner of the range and the only count either
 * engine can be asked about here". That sentence is TYPED, not measured — `tests/roster.js:7624`
 * builds it from `e.multihit[0]`, the move's own declared minimum — so it says what the author
 * believed the pin would do and not what the pin does.
 *
 * IT IS WRONG FOR THE `[2,5]` FAMILY ON THE TOP ARM, AND THIS FILE IS THE MEASUREMENT.
 *
 * The `random(m,n)` RANGE form is pinned to `m` in every arm, which is what the note describes. But
 * a 2-5 move does not go through the range form at all. `data/mods/champions/scripts.ts:441` draws it
 * with `this.battle.sample([2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,5,5,5])`, and `PRNG#sample` is
 * `this.random(items.length)` — the ONE-argument form, which the arms answer with `top ? m-1 : 0`.
 * So the authority takes index 19 at the top corner and index 0 at the bottom: FIVE hits and TWO.
 * medicham2's `rollHitsOf` samples the identical twenty-element table with `rnd()`, so it lands on
 * the same two.
 *
 * WHAT IS THEREFORE COMPARED, AND WHAT IS NOT: the corners reach 2 and 5. THREE and FOUR are the
 * interior of the table and no pinned arm can select them.
 *
 * BOTH ENGINES ARE MEASURED HERE RATHER THAN ONE, because the claim is about a COMPARISON. Reading
 * only medicham2 would say what this engine rolls and nothing about what it is being scored against.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const CS = require(D('engine', 'champions_sim.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

/* THE TWO CORNERS, TAKEN FROM `engine/game_differential.js` RATHER THAN RETYPED — the arms are
 * `corner: CORNER_TOP = 1 - 1e-9` with `damageIndex: 0`, and `corner: CORNER_BOTTOM = 0` with
 * `damageIndex: 15`. A second copy of those constants here would be the fact-in-two-places breach. */
const CORNER_TOP = 1 - 1e-9, CORNER_BOTTOM = 0;

/* MEMBERSHIP, PRINTED BEFORE IT IS USED. */
const MULTI = Object.keys(TAGS.moves || {})
  .filter(id => (TAGS.moves[id].tags || []).indexOf('multiHit') >= 0);
const rangeOf = id => ((TAGS.moves[id].params || {}).multiHit || {}).range;
const TWO_FIVE = MULTI.filter(id => { const r = rangeOf(id); return Array.isArray(r) && +r[0] === 2 && +r[1] === 5; });
const FIXED = MULTI.filter(id => TWO_FIVE.indexOf(id) < 0);
console.log('\n  WHICH HIT COUNTS ARE COMPARED — measured at both pinned corners\n');
console.log('  DERIVED — multi-hit moves in the format (' + MULTI.length + '): ' + MULTI.sort().join(', '));
console.log('  DERIVED — the `[2,5]` family (' + TWO_FIVE.length + '): ' + TWO_FIVE.sort().join(', '));
console.log('  DERIVED — every other multi-hit move, whose count is FIXED and therefore fully covered ('
  + FIXED.length + '): ' + FIXED.sort().map(id => id + ' ' + JSON.stringify(
      rangeOf(id) || ((TAGS.moves[id].params || {}).multiHit || {}).hits)).join(', ') + '\n');

/* ---- THE AUTHORITY, WITH THE ARM'S OWN RANDOM INSTALLED ON THE PRNG ------------------------------
 * `game_differential.js:3357` installs the arm as `battle.prng.random`, so `Battle#sample` — which
 * is `this.prng.sample(items)` and thence `this.random(items.length)` — goes THROUGH it. That is the
 * whole mechanism, and it is why the range-form pin never sees this draw. */
function authorityHits(moveName, top) {
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.prng.random = function pinRandom(m, n) {
    if (n === undefined) { if (m === undefined) return top ? CORNER_TOP : CORNER_BOTTOM;
                           return top ? m - 1 : 0; }
    return m;                                        // the RANGE form, pinned to the bottom in every arm
  };
  const body = (sp, moves) => ({ name: '', species: sp, item: '',
    ability: dex.species.get(sp).abilities['0'], moves,
    nature: 'Serious', evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 }, ivs: {}, level: 50 });
  /* FOUR BODIES A SIDE, because this format has TEAM PREVIEW and `team 1234` has to have four things
   * to name. The differential does the same two lines at game_differential.js:3389. */
  /* THE FOES CLICK IRON DEFENCE, NOT PROTECT, AND THAT IS NOT A DETAIL. The first version of this
   * fixture gave every foe a single Protect and then chose it — the volley was shielded, no
   * `|-hitcount|` was ever written, and the probe read `null` on BOTH corners, which is exactly what
   * "the corner does not move the count" would look like. Iron Defence is self-targeting (so it needs
   * no target index), 100-accurate and cannot refuse the hit. */
  battle.setPlayer('p1', { name: 'a', team: Teams.pack([body('Goodra-Hisui', [moveName, 'Protect']),
    body('Aggron', ['Iron Defense']), body('Milotic', ['Protect']), body('Snorlax', ['Protect'])]) });
  battle.setPlayer('p2', { name: 'b', team: Teams.pack([body('Aggron', ['Iron Defense']),
    body('Corviknight', ['Iron Defense']), body('Milotic', ['Protect']), body('Snorlax', ['Protect'])]) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  battle.makeChoices('move 1 1, move 1', 'move 1, move 1');
  const line = battle.log.find(l => l.startsWith('|-hitcount|'));
  return line ? +line.split('|')[3] : null;
}

/* ---- THIS ENGINE, THROUGH ITS OWN TURN LOOP, WITH THE SAME CORNER ------------------------------- */
function mediHits(moveId, top) {
  const before = MEDI.MEDSEEN.multiHitPacketsDealt;
  /* THROUGH THE SAME `bare` SHAPE tests/test-mechanics.js uses — `buildMon(sp, {})` with the item and
   * the ability cleared. `buildMon(sp)` with no second argument returns a body `dmgRange` cannot
   * price, which is a null-deref and not a finding. */
  const bare = sp => { const b = MEDI.buildMon(sp, {}); if (!b) throw new Error('no MC row for ' + sp);
                       b.item = ''; b.ability = 'none'; return b; };
  const me = bare('goodrahisui'), ally = bare('aggron');
  const f1 = bare('aggron'), f2 = bare('aggron');
  for (const m of [f1, f2]) { m.st = Object.assign({}, m.st, { hp: m.st.hp * 8 }); m.curHP = m.st.hp; }
  const S = MEDI.battleInit([me, ally], [f1, f2], { seeded: true });
  const rng = () => (top ? CORNER_TOP : CORNER_BOTTOM);
  MEDI.battleTurn(S, rng,
    new Map([[me, MEDI.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return MEDI.MEDSEEN.multiHitPacketsDealt - before;
}

const MV = 'iciclespear', MVNAME = dex.moves.get(MV).name;
console.log('  ' + MVNAME + ' (a [2,5] move, staged on the roster\'s own carrier), one turn per corner:\n');
const rows = [['top-tie-first (CORNER_TOP)', true], ['bottom-tie-first (CORNER_BOTTOM)', false]];
const got = {};
for (const [label, top] of rows) {
  const a = authorityHits(MVNAME, top), m = mediHits(MV, top);
  got[top ? 'top' : 'bottom'] = { a, m };
  console.log('    ' + label.padEnd(34) + 'authority ' + a + ' hit(s)   medicham2 ' + m + ' hit(s)');
}
console.log('');

ok(got.top.a === got.top.m && got.bottom.a === got.bottom.m,
   'the two engines land on the SAME count at each corner — which is why the roster rows are green',
   'top ' + got.top.a + '/' + got.top.m + ', bottom ' + got.bottom.a + '/' + got.bottom.m);
ok(got.bottom.a === 2,
   'THE BOTTOM CORNER IS TWO HITS — the roster note is right about this arm',
   'authority ' + got.bottom.a);
ok(got.top.a === 5,
   'THE TOP CORNER IS FIVE HITS, NOT TWO — the roster note is WRONG on every `[2,5]` row it pins to '
   + 'the top arm',
   'authority ' + got.top.a + '. `sample()` of a twenty-element table takes index 19 at the top '
   + 'corner, and index 19 of [2x7,3x7,4x3,5x3] is 5.');
ok(got.top.a !== got.bottom.a,
   'CONTROL — the corner actually moves the count, so neither reading is a constant',
   got.bottom.a + ' -> ' + got.top.a + ' (an unwired pin would give the same number twice)');

console.log('\n  SO THE BOUND IS: the pinned arms compare 2 and 5. THREE and FOUR are the interior of');
console.log('  the sample table and no corner can select them. The fixed-count moves listed above are');
console.log('  fully covered at their only count.\n');
console.log('  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
