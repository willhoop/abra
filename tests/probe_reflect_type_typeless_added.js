#!/usr/bin/env node
/* tests/probe_reflect_type_typeless_added.js — REFLECT TYPE AT A TYPELESS TARGET THAT CARRIES AN ADDED TYPE.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=<Reg M-B checkout> node tests/probe_reflect_type_typeless_added.js --release <M-B id>
 *   SHOWDOWN_PATH=<Reg M-C checkout> ABRA_REGULATION=regmc node tests/probe_reflect_type_typeless_added.js --release <M-C id>
 *   MEDI_REFLECT_TYPE_FOLDS_ADDED=1 ...     (the red demonstration: the added type copied as a base type)
 *
 * FILED in docs/_reports/2026-09-24-reflect-type.md §3, gap 1. The authority (data/moves.ts `reflecttype`, no
 * Champions override, byte-identical in both checkouts):
 *     let newBaseTypes = target.getTypes(true).filter(type => type !== '???');
 *     if (!newBaseTypes.length) { if (target.addedType) newBaseTypes = ['Normal']; else return false; }
 *     ... source.setType(newBaseTypes); source.addedType = target.addedType;
 * `getTypes(true)` EXCLUDES the added type. So a mono-Fire body that Burned Up (['???']) and was then
 * Trick-or-Treated copies as NORMAL + the added Ghost. This engine had no added-type slot and copied the
 * whole list minus '???', i.e. Ghost alone. The turn-boundary broadcast has the same split: it writes the
 * BASE list (`getTypes(true)`) and then, if there is one, a `typeadd` line for the added type
 * (sim/battle.ts nextTurn).
 *
 * REACHABLE IN BOTH REGULATIONS, derived: Burn Up, Trick-or-Treat and Reflect Type are all legal in both
 * formats and the fixture below passes each format's TeamValidator. Double Shock (the other '???' writer) is
 * Reg M-C only and its one legal learner is dual-typed, so it cannot empty a base list; it is not staged.
 *
 * THE ARMS — every one played in both engines, Showdown is the expectation, the whole board compared:
 *   RED       Arcanine Burns Up (turn 1, into its own Milotic), Gourgeist Trick-or-Treats it (turn 2),
 *             Stunfisk Reflect Types it (turn 3), idle. Authority: Stunfisk is Normal + Ghost.
 *   CONTROL 1 the same line with no Trick-or-Treat: the target is ['???'] with nothing added, and the copy
 *             FAILS in both engines — so the RED arm's Normal is the added type's doing.
 *   CONTROL 2 Trick-or-Treat on the Milotic, Reflect Type at it: an added type on a non-empty base, which the
 *             two boards already agreed on (Water + Ghost).
 * Each arm also compares the turn-boundary broadcast lines for the Reflect Type user (the `[silent]`
 * typechange and, when there is an added type, the `[silent]` typeadd after it).
 * Legality: every body, ability and move is put to the format's TeamValidator first.
 * EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
if (process.argv.indexOf('--release') < 0) cannot('pass --release <id>: a probe does not pick the engine it measures');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];
const KNOB = process.env.MEDI_REFLECT_TYPE_FOLDS_ADDED === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
console.log('\ntests/probe_reflect_type_typeless_added.js   release ' + RID + '   format ' + CS.FORMAT
  + (KNOB ? '   [MEDI_REFLECT_TYPE_FOLDS_ADDED=1 — the RED arm is expected RED]' : ''));
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);

const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(CS.FORMAT);
const DX = V.dex;
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') out.push(m.species + ' is not legal');
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(m.species + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) {
    const mm = DX.moves.get(mv);
    if (!mm.exists || mm.isNonstandard) out.push(mv + ' is not legal');
    else if (V.checkCanLearn(mm, sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(m.species + ' cannot learn ' + mv);
  }
  return out;
}
/* THE AUTHORITY, READ: Reflect Type reads the base list and carries the added type separately. */
const rt = String(DX.moves.get('reflecttype').onHit);
console.log('  authority, read: reflecttype.onHit uses getTypes(true): ' + /getTypes\(true\)/.test(rt)
  + '; Normal for an empty base with an added type: ' + /addedType\)\s*\{?\s*newBaseTypes\s*=\s*\[\s*["']Normal["']\s*\]/.test(rt)
  + '; copies addedType: ' + /source\.addedType\s*=\s*target\.addedType/.test(rt));
if (!/getTypes\(true\)/.test(rt) || !/source\.addedType\s*=\s*target\.addedType/.test(rt)) cannot('the checkout\'s Reflect Type does not read as this probe assumes; re-derive the premise');

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const A = () => [mon('gourgeist', 'Leftovers', 'Frisk', ['Trick-or-Treat', 'Sleep Talk', 'Protect']),
                 mon('stunfisk', 'Sitrus Berry', 'Static', ['Reflect Type', 'Sleep Talk', 'Protect']),
                 mon('corviknight', '', 'Pressure', ['Protect']), mon('clefable', '', 'Magic Guard', ['Protect'])];
const B = () => [mon('arcanine', 'Leftovers', 'Flash Fire', ['Burn Up', 'Sleep Talk', 'Protect']),
                 mon('milotic', 'Sitrus Berry', 'Marvel Scale', ['Sleep Talk', 'Protect']),
                 mon('snorlax', '', 'Thick Fat', ['Protect']), mon('garchomp', '', 'Rough Skin', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...B().map(problems));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability, item and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));

function play(tag, script) {
  const a = G.buildPair(A()), b = G.buildPair(B());
  if (!a || !b) return null;
  G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'reflect-typeless:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { r, boards, sd: G.lastSdLog(), me: (r.mediTrace || []).map(String), turns: boards.length };
}
const T = (p1, p2) => ({ p1, p2 });
const IDLE = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const BURNUP = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'burnup', ally: true }, { m: 'sleeptalk' }]);
const TOT = (t) => T([{ m: 'trickortreat', t }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const RT = (t) => T([{ m: 'sleeptalk' }, { m: 'reflecttype', t }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);

const ARMS = [
  ['RED  Burn Up, Trick-or-Treat, Reflect Type at the typeless Arcanine', 'red', [BURNUP, TOT(0), RT(0), IDLE], true],
  ['CONTROL 1  Burn Up, no add, Reflect Type at the typeless Arcanine (fails)', 'control', [BURNUP, IDLE, RT(0), IDLE], false],
  ['CONTROL 2  Trick-or-Treat the Milotic, Reflect Type at it', 'control', [IDLE, TOT(1), RT(1), IDLE], true],
];
let bad = 0, redBad = 0;
const ok = (cond, what, detail, isRed) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) { bad++; if (isRed) redBad++; }
};
/* the two streams spell a body differently (`p1b: Stunfisk` / `p1b:stunfisk`); the comparison is on the
 * address, the kind, the type and the [silent] tag */
const norm = (l) => String(l).toLowerCase().replace(/\s+/g, '').replace(/^(\|-start\|p\d[ab]):[^|]*/, '$1');
const broadcast = (lines) => lines.filter(l => /^\|-start\|p1b/.test(l) && /\|type(change|add)\|/.test(l) && /\[silent\]/.test(l)).map(norm);
for (const [name, kind, script, copies] of ARMS) {
  const g = play(name.split(' ')[0].toLowerCase() + (name.split(' ')[1] || ''), script);
  if (!g) cannot('buildPair returned null on ' + name);
  if (g.r.err) cannot(name + ' threw: ' + g.r.err);
  if (g.turns < script.length + 1) cannot(name + ' played ' + g.turns + ' boundaries of ' + (script.length + 1) + ' — a short game tests nothing');
  console.log('\n  ' + name);
  const burned = g.sd.some(l => /^\|-start\|p2a: Arcanine\|typechange\|\?\?\?\|\[from\] move: Burn Up/.test(l));
  const reflected = g.sd.some(l => /^\|-start\|p1b: Stunfisk\|typechange\|\[from\] move: Reflect Type/.test(l));
  if (script[0] === BURNUP) ok(burned, 'the authority emptied Arcanine\'s type with Burn Up (the fixture is staged)');
  ok(reflected === copies, 'the authority ' + (copies ? 'landed' : 'refused') + ' the Reflect Type (landed: ' + reflected + ')');
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'boundary ' + b.turn + '  ' + d.path + '  sd ' + JSON.stringify(d.sd) + ' / me ' + JSON.stringify(d.us))));
  ok(!diffs.length, 'the two boards agree at every boundary' + (kind === 'red' && KNOB ? '   [expected RED: the knob is armed]' : ''),
     diffs.length ? diffs.slice(0, 6).join('\n') : null, kind === 'red');
  const bs = broadcast(g.sd), bm = broadcast(g.me);
  ok(JSON.stringify(bs) === JSON.stringify(bm), 'the turn-boundary type broadcast agrees',
     'showdown ' + JSON.stringify(bs) + '\n' + 'medicham ' + JSON.stringify(bm), kind === 'red');
}

console.log('\n' + (bad ? 'RED' : 'GREEN') + (KNOB ? '   (knob armed: ' + redBad + ' red-arm failure(s) — must be > 0 for the knob to be live)' : ''));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
