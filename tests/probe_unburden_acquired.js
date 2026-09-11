#!/usr/bin/env node
/* tests/probe_unburden_acquired.js — ROADMAP #535.
 * ==================================================================================================
 * DOES AN UNBURDEN ACQUIRED AFTER THE HAND IS ALREADY EMPTY DOUBLE SPEED?
 *
 * THE AUTHORITY (data/abilities.ts `unburden`, no Champions override): the doubling is a VOLATILE,
 * added by `onAfterUseItem` / `onTakeItem` — i.e. only by a body that HOLDS Unburden at the moment the
 * item goes — and its `onModifySpe` doubles while `!pokemon.item`. A body that loses its item first and
 * receives Unburden later never gets the volatile, so its Speed does not move.
 * THIS ENGINE (release 2b5a6585d8cf, `effSpeed`): `if (m._hadItem && !m.item ...)` then
 * `TAGS.param('ability', m.ability, 'speedOnItemLoss')` — the CURRENT ability, recomputed every read. So
 * the late Unburden doubles here.
 *
 * THE OBSERVABLE IS THE DRIVER'S OWN SPEED COMPARISON. At every turn boundary `playGame` asks the
 * authority `getActionSpeed()` and this engine `effSpeed` for every active body and publishes each
 * disagreement in `speedRows` (engine/game_differential.js, ROADMAP #290). Nothing is recomputed here.
 *
 *   RED ARM   Liepard (Unburden, empty hand) Knock Offs Clefable's Leftovers on turn 1; on turn 2
 *             Clefable Skill Swaps Liepard and receives Unburden with an empty hand. From the next
 *             boundary Clefable's Speed must agree between the engines.
 *   CONTROL 1 (the effect is visible) Scrafty Knock Offs a Liepard that holds Unburden AND Leftovers:
 *             the volatile is granted and Speed doubles on BOTH engines — no disagreement, and the
 *             authority's own number for Liepard must double across the boundary, or the leaf cannot
 *             show a doubling at all.
 *   CONTROL 2 (one variable) the red arm with turn 1's Knock Off replaced by Nasty Plot: Clefable keeps
 *             its Leftovers, receives Unburden while holding an item, and nobody doubles.
 * Legality from the format's TeamValidator. Pinned release; staged through tests/staged_board.js.
 * KNOB, for after the fix: `MEDI_UNBURDEN_FROM_CURRENT_ABILITY=1` is the name proposed for restoring
 * the current-ability read; when set, the red arm is labelled expected RED.
 * EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--release') < 0) process.argv.push('--release', '2b5a6585d8cf');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const KNOB = process.env.MEDI_UNBURDEN_FROM_CURRENT_ABILITY === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
console.log('\ntests/probe_unburden_acquired.js — ROADMAP #535   release ' + RID);
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);

const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(require(path.join(ROOT, 'engine', 'champions_sim.js')).FORMAT);
const DX = V.dex;
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') out.push(m.species + ' is not legal');
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(m.species + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) if (V.checkCanLearn(DX.moves.get(mv), sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(m.species + ' cannot learn ' + mv);
  return out;
}
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
/* CLEFABLE, NOT ALAKAZAM. The first form of this probe used Alakazam, and Liepard's Knock Off (Dark,
 * super-effective, boosted by the held item) KO'd it on turn 1 — Milotic came in and the script's
 * Skill Swap was no longer on the request. A Fairy resists Dark, and Clefable learns Skill Swap. */
const A = () => [mon('clefable', 'Leftovers', 'Magic Guard', ['Skill Swap', 'Calm Mind', 'Protect']),
                 mon('scrafty', '', 'Shed Skin', ['Knock Off', 'Bulk Up', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const B = (liepardItem) => [mon('liepard', liepardItem, 'Unburden', ['Knock Off', 'Nasty Plot', 'Protect']),
                 mon('corviknight', '', 'Pressure', ['Bulk Up', 'Protect']),
                 mon('garchomp', '', 'Sand Veil', ['Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...B('Leftovers').map(problems));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability, item and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));
const ubHandler = String(DX.abilities.get('unburden').onTakeItem || '') + String(DX.abilities.get('unburden').onAfterUseItem || '');
console.log('  authority, read: unburden grants its volatile in onTakeItem/onAfterUseItem: ' + /addVolatile\(\s*["']unburden["']/.test(ubHandler));

function play(tag, a0, b0, script) {
  const a = G.buildPair(a0), b = G.buildPair(b0);
  if (!a || !b) return null;
  G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'owed535:' + tag, { script, speedCensus: true,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { r, boards, sd: G.lastSdLog(), sc: G.scriptCounters() };
}
const T = (p1, p2) => ({ p1, p2 });
const RED = play('red', A(), B(''), [
  T([{ m: 'calmmind' }, { m: 'bulkup' }], [{ m: 'knockoff', t: 0 }, { m: 'bulkup' }]),
  T([{ m: 'skillswap', t: 0 }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }]),
  T([{ m: 'calmmind' }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }])]);
const C1 = play('ctl-from-start', A(), B('Leftovers'), [
  T([{ m: 'calmmind' }, { m: 'knockoff', t: 0 }], [{ m: 'nastyplot' }, { m: 'bulkup' }]),
  T([{ m: 'calmmind' }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }]),
  T([{ m: 'calmmind' }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }])]);
const C2 = play('ctl-keeps-item', A(), B(''), [
  T([{ m: 'calmmind' }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }]),
  T([{ m: 'skillswap', t: 0 }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }]),
  T([{ m: 'calmmind' }, { m: 'bulkup' }], [{ m: 'nastyplot' }, { m: 'bulkup' }])]);
for (const [n, g] of [['red', RED], ['control 1', C1], ['control 2', C2]]) {
  if (!g) cannot('buildPair returned null on the ' + n + ' arm');
  if (g.r.err) cannot('the ' + n + ' arm threw: ' + g.r.err);
}

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const rowsFor = (g, body) => (g.r.speedRows || []).filter(x => x.body === body);
const sdSpeeds = (g, body) => (g.r.speedCensus || []).filter(x => x.body === body).map(x => x.showdown);
const staged = (g, re) => g.sd.some(l => re.test(l));

console.log('\n  CONTROL 1 — Unburden held from the start, the item knocked off:');
const lie = sdSpeeds(C1, 'liepard');
console.log('      authority Speed for Liepard across boundaries: ' + JSON.stringify(lie));
ok(staged(C1, /^\|-enditem\|p2a: Liepard\|Leftovers\|\[from\] move: Knock Off/), 'the authority knocked Liepard\'s Leftovers off');
ok(lie.length >= 2 && Math.max(...lie) >= 2 * Math.min(...lie) - 1, 'the authority\'s own Speed for Liepard doubled — the leaf can show a doubling');
ok(!rowsFor(C1, 'liepard').length, 'both engines double it: no speed disagreement on Liepard',
   rowsFor(C1, 'liepard').map(x => x.when + ' sd ' + x.showdown + ' / me ' + x.medicham).join('; ') || null);
console.log('\n  CONTROL 2 — Clefable keeps its item, then receives Unburden:');
ok(staged(C2, /^\|-activate\|p1a: Clefable\|move: Skill Swap/) || staged(C2, /Skill Swap/), 'the authority ran the Skill Swap');
ok(!rowsFor(C2, 'clefable').length, 'nobody doubles: no speed disagreement on Clefable',
   rowsFor(C2, 'clefable').map(x => x.when + ' sd ' + x.showdown + ' / me ' + x.medicham + ' ability ' + x.ability).join('; ') || null);
if (bad) cannot('a control failed, so a disagreement on the red arm could not be attributed to the acquired Unburden');

console.log('\n  THE CELL — the hand emptied on turn 1, Unburden received on turn 2:');
ok(staged(RED, /^\|-enditem\|p1a: Clefable\|Leftovers\|\[from\] move: Knock Off/) && staged(RED, /Skill Swap/),
   'the authority staged it: Leftovers knocked off, then the Skill Swap');
const rr = rowsFor(RED, 'clefable');
for (const x of rr) console.log('      ' + x.when + '  ' + x.slot + ' clefable  authority ' + x.showdown + '  medicham ' + x.medicham
  + '  (ability ' + x.ability + ' / sd ' + x.sd_ability + ', item ' + JSON.stringify(x.item) + ')');
ok(!rr.length, 'Clefable\'s Speed agrees between the engines after it acquires Unburden with an empty hand'
   + (KNOB ? '   [expected RED: the knob is armed]' : ''),
   rr.length ? 'cell: ' + rr[0].slot + ' clefable at ' + rr[0].when + ' — authority ' + rr[0].showdown + ', medicham ' + rr[0].medicham
     + ' (x' + (rr[0].medicham / rr[0].showdown).toFixed(2) + '); effSpeed doubles off the CURRENT ability where the authority holds no unburden volatile' : null);
const dRed = [].concat(...RED.boards.map(b => b.diffs.map(d => 'turn ' + b.turn + ' ' + d.path)));
console.log('      board leaves parted on the red arm: ' + (dRed.length ? dRed.slice(0, 4).join(', ') : 'none (Speed is not a board leaf — speedRows is the observable)'));

console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
