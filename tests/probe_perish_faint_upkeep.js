#!/usr/bin/env node
/* tests/probe_perish_faint_upkeep.js — ROADMAP #440.
 * ==================================================================================================
 * DOES A PERISH DEATH'S `|faint|` LAND ON THE SAME SIDE OF `|upkeep|` AS THE AUTHORITY'S?
 *
 * `perishsong.condition.onEnd` writes `-start perish0` and calls `faint()`, which only QUEUES. A
 * duration expiry `continue`s past `fieldEvent`'s drain, so the queued faints are paid by the next
 * handler in the residual walk that does NOT itself expire — or, if none follows, below `|upkeep|` by
 * the tail of `runAction`. The release (2b5a6585d8cf) models this since 2026-08-26
 * (`RESIDUAL_AFTER_PERISH`), and the pinned pool STILL carries one game where it parts:
 * `event missing from medicham2 :: |upkeep <> |faint|p1a` (omit-spread, turn 12), three perish0 starts
 * immediately before it, one side's slot already emptied that turn, and rain up.
 *
 * FOUR BOARDS, BOTH ENGINES, SHOWDOWN IS THE EXPECTATION (protocol by the driver's own aligner, board at
 * every boundary). Nothing here types where the line should be.
 *   BARE        four bodies perish, everybody clicks a stat boost — nothing follows the group. The
 *               engine's own documented case; expected to agree.
 *   FOLLOWER    the same with a Tailwind set on turn 1, still running at the drain — something follows.
 *               The over-fire control: expected to agree.
 *   POOL SHAPE  three bodies perish; the fourth was KO'd earlier in the same turn, so its slot is empty.
 *   POOL + RAIN the pool game's own shape: Drizzle rain up, three perish0, the p2 slot emptied that turn.
 *   CORPSE      (2026-09-11, ENGINE 6.26.0, ROADMAP #601) the POOL SHAPE with the KO'd body holding a
 *               residual follower item. The authority skips a `fainted` holder, so nothing follows and
 *               the faints land below `|upkeep|`. `MEDI_FOLLOWER_COUNTS_CORPSES=1` must turn it RED.
 * The last two are selected ON THE AUTHORITY (a mid-turn faint, then three perish0 in the residual).
 * KNOBS (exist): `MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP=1` / `MEDI_PERISH_AT_FOOT=1` restore an unconditional
 * drain — BARE must go red under either, which is the green-then-red demonstration for this file.
 * Legality from the format's TeamValidator. EXIT: 0 green / 1 red / 2 cannot answer.
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
const KNOB = process.env.MEDI_RESIDUAL_DRAIN_ABOVE_UPKEEP === '1' || process.env.MEDI_PERISH_AT_FOOT === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
console.log('\ntests/probe_perish_faint_upkeep.js — ROADMAP #440   release ' + RID + (KNOB ? '   (A DRAIN KNOB IS ARMED — BARE expected RED)' : ''));
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
const FILL = (a, b) => [mon(a, '', a === 'milotic' ? 'Marvel Scale' : a === 'toxapex' ? 'Limber' : a === 'garchomp' ? 'Sand Veil' : 'Thick Fat', ['Protect']),
                        mon(b, '', b === 'milotic' ? 'Marvel Scale' : b === 'toxapex' ? 'Limber' : b === 'garchomp' ? 'Sand Veil' : 'Thick Fat', ['Protect'])];
const A1 = () => [mon('gengar', '', 'Cursed Body', ['Perish Song', 'Nasty Plot', 'Protect']),
                  mon('raichu', '', 'Static', ['Nasty Plot', 'Thunderbolt', 'Protect'])].concat(FILL('milotic', 'toxapex'));
const B1 = () => [mon('hydreigon', '', 'Levitate', ['Nasty Plot', 'Dark Pulse', 'Protect']),
                  mon('talonflame', '', 'Flame Body', ['Swords Dance', 'Tailwind', 'Protect'])].concat(FILL('garchomp', 'snorlax'));
const A2 = () => [mon('raichu', '', 'Static', ['Nasty Plot', 'Thunderbolt', 'Protect']),
                  mon('archaludon', '', 'Stamina', ['Iron Defense', 'Protect'])].concat(FILL('milotic', 'toxapex'));
const B2 = () => [mon('politoed', '', 'Drizzle', ['Perish Song', 'Weather Ball', 'Helping Hand', 'Protect']),
                  mon('talonflame', '', 'Flame Body', ['Swords Dance', 'Protect'])].concat(FILL('garchomp', 'snorlax'));
const bad0 = [].concat(...[A1(), B1(), A2(), B2()].map(t => [].concat(...t.map(problems))));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return null;
  G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'owed440:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  const sd = G.lastSdLog(), n = script.length, i = sd.lastIndexOf('|turn|' + n);
  return { tag, r, boards, sd, last: i >= 0 ? sd.slice(i) : [], sc: G.scriptCounters() };
}
/* FOUR TURNS, NOT THREE. The first form ran three and the authority showed 0 perish0: the count runs
 * perish3 -> perish0 over four end-of-turns. TURN 1 IS PROTECT for everybody but the singer, so no stat
 * boost caps before turn 4 and no `stall` clock is still standing at the drain (Protect's stall set on
 * turn 1 is gone by the end of turn 2). The FOLLOWER's Tailwind is set on turn 2 so it OUTLIVES the
 * turn-4 residual — a Tailwind set on turn 1 expires in that same residual and so cannot pay the queue.
 * The pool arms land their mid-turn KO on turn 4, the turn the perish group drains. */
const T = (p1, p2) => ({ p1, p2 });
const P = { m: 'protect' };
const boostA = () => [{ m: 'nastyplot' }, { m: 'nastyplot' }], boostB = () => [{ m: 'nastyplot' }, { m: 'swordsdance' }];
const ARMS = [];
ARMS.push({ name: 'BARE', expectRed: KNOB, g: play('bare', A1(), B1(), [T([{ m: 'perishsong' }, P], [P, P]), T(boostA(), boostB()), T(boostA(), boostB()), T(boostA(), boostB())]) });
ARMS.push({ name: 'FOLLOWER (Tailwind set on turn 2, still running)', g: play('follower', A1(), B1(), [T([{ m: 'perishsong' }, P], [P, P]), T(boostA(), [{ m: 'nastyplot' }, { m: 'tailwind' }]), T(boostA(), boostB()), T(boostA(), boostB())]) });
ARMS.push({ name: 'POOL SHAPE (slot emptied mid-turn)', pool: true, g: play('pool', A1(), B1(), [T([{ m: 'perishsong' }, P], [P, P]), T(boostA(), boostB()), T(boostA(), boostB()), T([{ m: 'nastyplot' }, { m: 'thunderbolt', t: 1 }], boostB())]) });
/* ONE WEATHER BALL, THEN HELPING HAND. The first rain arm threw: Politoed's second Weather Ball KO'd
 * Archaludon on turn 3 and Milotic stood in its slot on turn 4. Helping Hand is legal on Politoed, deals
 * nothing, and its volatile is one-turn (`alwaysExpires` in the engine's own derived split), so it
 * cannot pay the perish queue on either engine. */
ARMS.push({ name: 'POOL + RAIN (the pool game\'s shape)', pool: true, g: play('pool-rain', A2(), B2(), [
  T([P, P], [{ m: 'perishsong' }, P]),
  T([{ m: 'nastyplot' }, { m: 'irondefense' }], [{ m: 'weatherball', t: 1 }, { m: 'swordsdance' }]),
  T([{ m: 'nastyplot' }, { m: 'irondefense' }], [{ m: 'helpinghand' }, { m: 'swordsdance' }]),
  T([{ m: 'thunderbolt', t: 1 }, { m: 'irondefense' }], [{ m: 'helpinghand' }, { m: 'swordsdance' }])]) });
/* THE CORPSE ARM — 2026-09-11 (ENGINE 6.26.0, ROADMAP #601). The POOL SHAPE again, with the body KO'd
 * mid-turn HOLDING a residual follower. Its `|faint|` was written at the KO, so the authority has it
 * `fainted` (sim/battle.ts:2561) and `fieldEvent` skips everything it holds (:512): nothing follows the
 * perish group and the queue drains BELOW `|upkeep|`. `residualFollowerRuns` counted every body in the
 * slots, corpse included, and drained above it. The item is DERIVED — a `route: 'handler'` item row that
 * sorts after `condition:perishsong` in data/residual-order.json and is legal here — never named.
 * `MEDI_FOLLOWER_COUNTS_CORPSES=1` restores the corpse count and must turn this arm RED. */
const CORPSE_ITEM = (() => {
  const rows = require(path.join(ROOT, 'data', 'residual-order.json')).rows;
  const ps = rows.find(r => r.id === 'perishsong' && r.site === 'volatile');
  if (!ps) return null;
  const r = rows.find(x => x.route === 'handler' && x.ns === 'item' && x.order !== null && x.order > ps.order
    && DX.items.get(x.id).exists && !DX.items.get(x.id).isNonstandard);
  return r ? DX.items.get(r.id).name : null;
})();
if (CORPSE_ITEM) {
  const B1c = () => { const t = B1(); t[1] = { ...t[1], item: CORPSE_ITEM }; return t; };
  const badC = [].concat(...B1c().map(problems));
  if (badC.length) console.log('  corpse arm fixture NOT LEGAL: ' + badC.join('; '));
  else ARMS.push({ name: 'POOL SHAPE, THE CORPSE HOLDS ' + CORPSE_ITEM + ' (a follower it can no longer run)', pool: true,
    expectRed: process.env.MEDI_FOLLOWER_COUNTS_CORPSES === '1' || process.env.MEDI_ZOMBIE_SKIPS_RESIDUAL === '1',
    g: play('pool-corpse', A1(), B1c(), [T([{ m: 'perishsong' }, P], [P, P]), T(boostA(), boostB()), T(boostA(), boostB()), T([{ m: 'nastyplot' }, { m: 'thunderbolt', t: 1 }], boostB())]) });
} else console.log('  corpse arm NOT STAGED — no legal handler-route item sorts after perishsong in data/residual-order.json');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
let judged = 0;
for (const A of ARMS) {
  const g = A.g;
  console.log('\n  ' + A.name);
  if (!g) { console.log('      NOT STAGED — buildPair returned null'); continue; }
  if (g.r.err) {
    console.log('      NOT STAGED — the game threw: ' + g.r.err);
    for (const l of (g.sd || []).filter(l => /^\|(move|faint|-damage|switch|turn|-weather)\|/.test(l)).slice(-10)) console.log('        sd ' + l);
    continue;
  }
  const p0 = g.last.filter(l => /\|perish0$/.test(l)).length;
  const midFaint = g.last.findIndex(l => /^\|faint\|p2/.test(l)) >= 0
    && g.last.findIndex(l => /^\|faint\|p2/.test(l)) < g.last.findIndex(l => /\|perish0$/.test(l));
  const tail = g.last.filter(l => /perish0|^\|faint\||^\|upkeep|^\|-weather|^\|-sideend|^\|-end/.test(l));
  for (const l of tail.slice(0, 12)) console.log('      sd  ' + l);
  if (A.pool && !(p0 === 3 && midFaint)) { console.log('      NOT STAGED — the authority shows ' + p0 + ' perish0 and mid-turn p2 faint ' + midFaint + '; the pool shape needs 3 and true'); continue; }
  if (!A.pool && p0 < 3) { console.log('      NOT STAGED — only ' + p0 + ' perish0 on the authority'); continue; }
  judged++;
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us) + ' / authority ' + JSON.stringify(d.sd))));
  const tagR = A.expectRed ? '   [expected RED: a drain knob is armed]' : '';
  ok(g.r.div == null, 'the protocol never parts' + tagR,
     g.r.div ? 'cell: ' + A.name + ' — ' + JSON.stringify(g.r.div).slice(0, 600) : null);
  ok(!diffs.length, 'every board boundary agrees', diffs.slice(0, 4).join('\n') || null);
  ok(g.sc && g.sc.moveNotOnRequest === 0, 'every scripted click was on the request', g.sc && g.sc.moveNotOnRequest ? 'first missing: ' + g.sc.firstMissing : null);
}
if (!judged) cannot('no arm staged its perish case');

console.log('\n' + (bad ? 'RED' : 'GREEN') + '   (' + judged + ' of ' + ARMS.length + ' arms staged)');
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
