/* solver/tests/test-dusk-measure.js — DUSK's measurement library (solver/dusk/lib.js): the endgame predicate, the
 * colour-blind keys, the sheet-bound action count and the ahead-wins rule, on constructed positions.
 *
 *   node solver/tests/test-dusk-measure.js          exit 0 GREEN, 1 RED
 *   DUSK_BREAK=alive  node solver/tests/test-dusk-measure.js    must go RED (a fainted member counts alive)
 *   DUSK_BREAK=colour node solver/tests/test-dusk-measure.js    must go RED (keys keep the chairs in order)
 *
 *   PRED     a constructed game 4v4 -> 3v3 -> 3v1 -> 2v1 -> 1v1: E4 enters at turn 3, E2 at turn 4, E1 at turn 5; a brought
 *            member never seen counts alive.
 *   KEYS     every key level is the same with the chairs swapped; K0 ignores HP and K1d does not; K0set sees an item change.
 *   ACTIONS  2v2 with four moves whose target types are READ from the Reg M-C dex (and asserted, so a dex change fails the
 *            fixture loudly rather than the rule silently): Protect 1 + Fake Out (live foes + ally) + Earthquake 1 + Helping
 *            Hand 1, per body; the joint is the product, and a mega stone doubles one body's options.
 *   AHEAD    2v1 won by the side ahead -> 1; 2v2 decided by the HP tiebreak only when asked; a tie in both -> null.
 *   CONTROL  (skipped inside a break run) the test is re-run under each DUSK_BREAK and must exit non-zero.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs'), path = require('path'), cp = require('child_process');
if (!process.env.SHOWDOWN_PATH) {
  for (const c of [path.join(__dirname, '..', '..', '..', 'pokemon-showdown-mc'), 'C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc'])
    if (fs.existsSync(path.join(c, 'dist', 'sim'))) { process.env.SHOWDOWN_PATH = c; break; }
}
const X = require('../human/dex.js');
const L = require('../dusk/lib.js');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };
const UNK = L.UNK;

function mon(i, species, o = {}) {
  return Object.assign({ i, species, brought: true, form: species, hp: 100, status: null, fnt: false, boosts: {}, vol: {}, mega: false, pos: null,
    moves: [UNK, UNK, UNK, UNK], item: { orig: null, now: null }, ability: { base: UNK, now: UNK } }, o);
}
function pos(n, p1, p2, field) {
  return { n, field: field || { weather: null, terrain: null, pseudo: {} },
    sides: { p1: { teamsize: 4, mega_used: false, conditions: {}, mons: p1 }, p2: { teamsize: 4, mega_used: false, conditions: {}, mons: p2 } } };
}
const SP = ['Rillaboom', 'Sneasler', 'Incineroar', 'Kingambit', 'Gholdengo', 'Basculegion'];
for (const s of SP) ok(X.legal(X.species(s)), 'fixture species legal in Reg M-C: ' + s);
const side = (dead, onField, unseen = 0) => SP.slice(0, 4).map((s, i) => {
  if (i >= 4 - unseen) return mon(i, s, { brought: UNK, hp: UNK, status: UNK });
  return mon(i, s, { fnt: i < dead, hp: i < dead ? 0 : 100, pos: !( i < dead) && onField.includes(i) ? (onField.indexOf(i) ? 'b' : 'a') : null });
});

// ---------------------------------------------------------------- PRED
const P = [
  pos(1, side(0, [0, 1]), side(0, [0, 1])),
  pos(2, side(1, [1, 2]), side(1, [1, 2])),
  pos(3, side(1, [1, 2]), side(3, [3])),
  pos(4, side(2, [2, 3]), side(3, [3])),
  pos(5, side(3, [3]), side(3, [3])),
];
const g = { positions: P.map(x => ({ n: x.n, x })), game: { players: { p1: { name: 'a' }, p2: { name: 'b' } } } };
const lab = { z: 1, end: 'normal', turns: 6 };
const row = L.gameRow(g, lab, { id: 't', fmt: 'bo3', rating: { p1: 1200, p2: 1250 } });
ok(row.e4 && row.e4.n === 3, 'PRED: E4 enters at turn 3 (3v1), got ' + (row.e4 && row.e4.n));
ok(row.e2 && row.e2.n === 4, 'PRED: E2 enters at turn 4 (2v1), got ' + (row.e2 && row.e2.n));
ok(row.e1 && row.e1.n === 5, 'PRED: E1 enters at turn 5 (1v1), got ' + (row.e1 && row.e1.n));
ok(row.e2 && row.e2.decisions_left === 3, 'PRED: decisions left from turn 4 of a 6-turn game = 3');
ok(row.band === '1200-1299', 'PRED: band is the lower rating\'s');
ok(L.aliveOf({ teamsize: 4, mons: side(2, [2], 1) }) === 2, 'PRED: an unseen brought member counts alive (4 - 2 fainted = 2)');

// ---------------------------------------------------------------- KEYS
const a = pos(6, side(2, [2, 3]), side(3, [3]));
const b = pos(6, side(3, [3]), side(2, [2, 3]));
const ka = L.keysOf(a), kb = L.keysOf(b);
for (const k of Object.keys(ka)) ok(ka[k] === kb[k], 'KEYS colour-blind at ' + k + ': ' + ka[k] + ' / ' + kb[k]);
const c = JSON.parse(JSON.stringify(a)); c.sides.p1.mons[2].hp = 60;
const kc = L.keysOf(c);
ok(kc.K0 === ka.K0, 'KEYS: K0 ignores HP');
ok(kc.K1d !== ka.K1d, 'KEYS: K1d sees a 40-point HP change');
const d = JSON.parse(JSON.stringify(a)); d.sides.p1.mons[2].item.now = 'Sitrus Berry';
ok(X.legal(X.item('Sitrus Berry')), 'fixture item legal');
ok(L.keysOf(d).K0set !== ka.K0set && L.keysOf(d).K0 === ka.K0, 'KEYS: K0set sees an item, K0 does not');

// ---------------------------------------------------------------- ACTIONS
const MV = { protect: 'self', fakeout: 'normal', earthquake: 'allAdjacent', helpinghand: 'adjacentAlly' };
for (const [m, t] of Object.entries(MV)) { ok(X.legal(X.move(m)), 'fixture move legal: ' + m); ok(X.moveTargetType(m) === t, 'fixture move target read from the dex: ' + m + ' is ' + X.moveTargetType(m) + ', fixture expects ' + t); }
const four = ['Protect', 'Fake Out', 'Earthquake', 'Helping Hand'];
const s2 = (stone) => [mon(0, 'Rillaboom', { pos: 'a', moves: four.slice(), item: { orig: stone, now: stone } }), mon(1, 'Incineroar', { pos: 'b', moves: four.slice() }),
  mon(2, 'Sneasler', { fnt: true, hp: 0 }), mon(3, 'Kingambit', { fnt: true, hp: 0 })];
const e = pos(7, s2(null), s2(null));
ok(L.actionCount(e, 'p1') === 36, 'ACTIONS: (1 + (2 foes + 1 ally) + 1 + 1)^2 = 36, got ' + L.actionCount(e, 'p1'));
const stone = X.D.items.all().filter(X.legal).find(i => i.megaStone);
ok(!!stone, 'fixture: a legal mega stone exists in the regulation');
const e2 = pos(7, s2(stone && stone.name), s2(null));
ok(L.actionCount(e2, 'p1') === 72, 'ACTIONS: a mega stone doubles one body: 12 x 6 = 72, got ' + L.actionCount(e2, 'p1'));
e2.sides.p1.mega_used = true;
ok(L.actionCount(e2, 'p1') === 36, 'ACTIONS: no mega once the side has used it');

// ---------------------------------------------------------------- AHEAD
ok(L.aheadWon({ alive: { p1: 2, p2: 1 }, hp: { p1: 50, p2: 100 } }, 1, false) === 1, 'AHEAD: 2v1 won by p1');
ok(L.aheadWon({ alive: { p1: 1, p2: 2 }, hp: { p1: 50, p2: 100 } }, 1, false) === 0, 'AHEAD: 1v2 won by p1 is the ahead side losing');
ok(L.aheadWon({ alive: { p1: 2, p2: 2 }, hp: { p1: 150, p2: 100 } }, 1, false) === null, 'AHEAD: 2v2 has no mons leader');
ok(L.aheadWon({ alive: { p1: 2, p2: 2 }, hp: { p1: 150, p2: 100 } }, 0, true) === 0, 'AHEAD: 2v2 HP leader lost');
ok(L.aheadWon({ alive: { p1: 2, p2: 2 }, hp: { p1: 100, p2: 100 } }, 1, true) === null, 'AHEAD: exact tie -> null');

// ---------------------------------------------------------------- CONTROL
if (!process.env.DUSK_BREAK) {
  for (const br of ['alive', 'colour']) {
    const r = cp.spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { DUSK_BREAK: br }), encoding: 'utf8' });
    ok(r.status !== 0, 'CONTROL: DUSK_BREAK=' + br + ' must turn this test RED (exit ' + r.status + ')');
  }
}
console.log((fail ? 'RED' : 'GREEN') + ' test-dusk-measure ' + pass + '/' + (pass + fail) + (process.env.DUSK_BREAK ? ' [DUSK_BREAK=' + process.env.DUSK_BREAK + ']' : ''));
process.exit(fail ? 1 : 0);
