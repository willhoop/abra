#!/usr/bin/env node
/* tests/probe_added_type_replaced.js — A SECOND ADDED TYPE REPLACES THE FIRST.
 * ==================================================================================================
 *
 *   node tests/probe_added_type_replaced.js --release <M-B id>
 *   ABRA_REGULATION=regmc node tests/probe_added_type_replaced.js --release <M-C id>
 *   MEDI_ADDED_TYPE_APPENDS=1 ...        (the red demonstration: the old append)
 *
 * FILED in docs/_reports/2026-09-24-reflect-type.md §3, gap 2. The authority keeps ONE added type:
 *     addType(newType) { if (this.terastallized) return false; this.addedType = newType; return true; }
 *                                              sim/pokemon.ts, both checkouts, byte-identical
 *     getTypes(excludeAdded) { ... if (!excludeAdded && this.addedType) return types.concat(this.addedType); }
 * so Trick-or-Treat then Forest's Curse leaves [base..., Grass] — the Ghost is gone. This engine's
 * `changesTargetType.adds` branch appended (`t.types=[...t.types,_ty]`) and left [base..., Ghost, Grass].
 *
 * THE ARMS — every one played in both engines, Showdown is the expectation, the whole board compared:
 *   RED 1   Gourgeist Trick-or-Treats Snorlax (turn 1), Trevenant Forest's Curses it (turn 2), idle.
 *   RED 2   the other order: Forest's Curse turn 1, Trick-or-Treat turn 2.
 *   CONTROL Forest's Curse alone — one added type, which both engines already agreed on, so a red on
 *           RED 1 is charged to the SECOND add and not to either move alone.
 * Legality: every body, ability and move is put to the format's TeamValidator first.
 * EXIT: 0 green / 1 red / 2 cannot answer.
 * ================================================================================================ */
'use strict';
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
/* 2026-09-24 -- the ACTIVE regulation's checkout, not a Reg M-B literal: under --regulation regmc the literal
 * handed Reg M-C's format to Reg M-B's checkout and the probe could only CANNOT-ANSWER. engine/showdown_path.js is
 * the one answer (an explicit SHOWDOWN_PATH still wins) and sets process.env.SHOWDOWN_PATH for the requires below. */
require(require('path').join(__dirname, '..', 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('CANNOT ANSWER — engine/showdown_path.js found no Showdown checkout for this regulation'); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); }
const path = require('path');
const ROOT = path.join(__dirname, '..');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
if (process.argv.indexOf('--release') < 0) cannot('pass --release <id>: a probe does not pick the engine it measures');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
const REL_ID = process.argv[process.argv.indexOf('--release') + 1];
const KNOB = process.env.MEDI_ADDED_TYPE_APPENDS === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
console.log('\ntests/probe_added_type_replaced.js   release ' + RID + '   format ' + CS.FORMAT
  + (KNOB ? '   [MEDI_ADDED_TYPE_APPENDS=1 — the RED arms are expected RED]' : ''));
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
/* THE AUTHORITY, READ: addType overwrites a single field. */
const PK = require(process.env.SHOWDOWN_PATH + '/dist/sim/pokemon');
const addSrc = String(PK.Pokemon.prototype.addType);
console.log('  authority, read: Pokemon#addType = ' + addSrc.replace(/\s+/g, ' '));
if (!/this\.addedType\s*=\s*newType/.test(addSrc)) cannot('the checkout\'s addType does not overwrite addedType; this probe\'s premise does not hold');

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const A = () => [mon('gourgeist', 'Leftovers', 'Frisk', ['Trick-or-Treat', 'Sleep Talk', 'Protect']),
                 mon('trevenant', 'Sitrus Berry', 'Frisk', ['Forest\'s Curse', 'Sleep Talk', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('clefable', '', 'Magic Guard', ['Protect'])];
const B = () => [mon('snorlax', 'Leftovers', 'Thick Fat', ['Sleep Talk', 'Protect']),
                 mon('corviknight', 'Leftovers', 'Pressure', ['Sleep Talk', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('garchomp', '', 'Rough Skin', ['Protect'])];
const bad0 = [].concat(...A().map(problems), ...B().map(problems));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability, item and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));

function play(tag, a0, b0, script) {
  const a = G.buildPair(a0), b = G.buildPair(b0);
  if (!a || !b) return null;
  G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'added-type:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { r, boards, sd: G.lastSdLog(), turns: boards.length };
}
const T = (p1, p2) => ({ p1, p2 });
const IDLE = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const TOT = T([{ m: 'trickortreat', t: 0 }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const FC = T([{ m: 'sleeptalk' }, { m: 'forestscurse', t: 0 }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);

const ARMS = [
  ['RED 1  Trick-or-Treat turn 1, Forest\'s Curse turn 2', 'red', [TOT, FC, IDLE], ['typeadd|Ghost', 'typeadd|Grass']],
  ['RED 2  Forest\'s Curse turn 1, Trick-or-Treat turn 2', 'red', [FC, TOT, IDLE], ['typeadd|Grass', 'typeadd|Ghost']],
  ['CONTROL  Forest\'s Curse alone', 'control', [IDLE, FC, IDLE], ['typeadd|Grass']],
];
let bad = 0, redBad = 0;
const ok = (cond, what, detail, isRed) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) { bad++; if (isRed) redBad++; }
};
for (const [name, kind, script, adds] of ARMS) {
  const g = play(name.split(' ')[0].toLowerCase() + name.split(' ')[1], A(), B(), script);
  if (!g) cannot('buildPair returned null on ' + name);
  if (g.r.err) cannot(name + ' threw: ' + g.r.err);
  if (g.turns < script.length + 1) cannot(name + ' played ' + g.turns + ' boundaries of ' + (script.length + 1) + ' — a short game tests nothing');
  console.log('\n  ' + name);
  const added = g.sd.filter(l => /^\|-start\|p2a: Snorlax\|typeadd\|/.test(l));
  console.log('      authority: ' + (added.join('  ') || 'no typeadd line'));
  ok(adds.every((x, i) => added[i] && added[i].indexOf(x) >= 0) && added.length === adds.length,
     'the authority landed every add in order (' + adds.join(', ') + ') — the moves are staged, not refused');
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'boundary ' + b.turn + '  ' + d.path + '  sd ' + JSON.stringify(d.sd) + ' / me ' + JSON.stringify(d.us))));
  ok(!diffs.length, 'the two boards agree at every boundary' + (kind === 'red' && KNOB ? '   [expected RED: the knob is armed]' : ''),
     diffs.length ? diffs.slice(0, 6).join('\n') : null, kind === 'red');
}

console.log('\n' + (bad ? 'RED' : 'GREEN') + (KNOB ? '   (knob armed: ' + redBad + ' red-arm failure(s) — must be > 0 for the knob to be live)' : ''));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
