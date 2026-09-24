#!/usr/bin/env node
/* tests/probe_mimicry_terrain_event_only.js — THE REFLECT TYPE ROSTER ROW'S HIDDEN BOARD MISMATCH.
 * ==================================================================================================
 *
 *   node tests/probe_mimicry_terrain_event_only.js --release <M-B id>
 *   ABRA_REGULATION=regmc node tests/probe_mimicry_terrain_event_only.js --release <M-C id>
 *   MEDI_MIMICRY_SYNC_EVERY_CALL=1 ...        (the red demonstration: the old every-call sync)
 *
 * WHAT WAS MEASURED (docs/_reports/2026-09-24-roster-staging.md, the moves stage, `--only reflecttype`):
 * the aggressor Stunfisk-Galar reflects Goodra-Hisui's type on turn 2; at the next boundary both
 * engines read dragon/steel, and one boundary later the authority still reads dragon/steel while this
 * engine reads ground/steel. The row is shelved on usage (11 clicks) and its underlying verdict is
 * FIRED-AND-BOARDS-DIFFER in both regulations.
 *
 * THE CAUSE IS NOT REFLECT TYPE. Stunfisk-Galar's only ability is Mimicry, and the authority's Mimicry is an
 * EVENT (data/abilities.ts `mimicry`, no Champions override, identical in both checkouts):
 *     onStart(pokemon) { this.singleEvent('TerrainChange', this.effect, this.effectState, pokemon); }
 *     onTerrainChange(pokemon) { ... default: types = pokemon.baseSpecies.types; ... setType(types) }
 * It answers a terrain being set or cleared, and its holder's own Start — nothing else. This engine ran it
 * as a SYNC at the head of every turn (`syncFieldTypes` in battleTurn), on every other body's entry and on
 * every weather change, so a Mimicry body whose type another handler rewrote under an UNCHANGED terrain
 * was reverted to its base typing at the next call.
 *
 * THE ARMS — every one played in both engines, Showdown is the expectation, the whole board compared:
 *   RED 1   no terrain. Stunfisk-Galar Reflect Types Goodra-Hisui on turn 2, then three idle turns.
 *   RED 2   Electric Terrain set on turn 1 (Stunfisk-Galar goes Electric), Reflect Type on turn 2 under the
 *           standing terrain, then idle turns. A sync re-Electrifies it; the authority keeps the copy.
 *   LIVE    the gate must not deafen Mimicry: Reflect Type on turn 2, Electric Terrain on turn 3 — the
 *           authority's TerrainChange retypes it Electric, and so must this engine.
 *   CONTROL Stunfisk (Static) — the same line with no Mimicry: the copy must hold in both engines, so
 *           a disagreement on RED 1 is charged to Mimicry and not to Reflect Type.
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
const KNOB = process.env.MEDI_MIMICRY_SYNC_EVERY_CALL === '1';

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const BS = require(path.join(ROOT, 'engine', 'board_state.js'));
const G = SB.harness();
const RID = (G.REL && G.REL.id) || '?';
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
console.log('\ntests/probe_mimicry_terrain_event_only.js   release ' + RID + '   format ' + CS.FORMAT
  + (KNOB ? '   [MEDI_MIMICRY_SYNC_EVERY_CALL=1 — the RED arms are expected RED]' : ''));
if (RID !== REL_ID) cannot('the driver opened release ' + RID + ', not ' + REL_ID);

const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(CS.FORMAT);
const DX = V.dex;
function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!sp.exists || sp.isNonstandard || sp.tier === 'Illegal') out.push(m.species + ' is not legal');
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(m.species + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) if (V.checkCanLearn(DX.moves.get(mv), sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(m.species + ' cannot learn ' + mv);
  return out;
}
/* THE AUTHORITY, READ: Mimicry's handler set is onStart + onTerrainChange and nothing that runs per turn. */
const mim = DX.abilities.get('mimicry');
const mimHandlers = Object.keys(mim).filter(k => /^on[A-Z]/.test(k) && typeof mim[k] === 'function');
console.log('  authority, read: mimicry handlers = ' + mimHandlers.join(', '));
if (!mimHandlers.includes('onTerrainChange')) cannot('the checkout\'s Mimicry has no onTerrainChange; this probe\'s premise does not hold');
const perTurn = mimHandlers.filter(h => /Residual|Update|BeforeTurn|WeatherChange|AnySwitchIn/.test(h));
if (perTurn.length) cannot('the checkout\'s Mimicry carries a per-turn or weather handler (' + perTurn.join(', ') + '); re-derive the premise');

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const A = (user, ability) => [mon(user, 'Leftovers', ability, ['Reflect Type', 'Sleep Talk', 'Protect']),
                              mon('rotomwash', 'Sitrus Berry', 'Levitate', ['Electric Terrain', 'Sleep Talk', 'Protect']),
                              mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('clefable', '', 'Magic Guard', ['Protect'])];
const B = () => [mon('goodrahisui', 'Leftovers', 'Shell Armor', ['Sleep Talk', 'Protect']),
                 mon('corviknight', 'Leftovers', 'Pressure', ['Sleep Talk', 'Protect']),
                 mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])];
const bad0 = [].concat(...A('stunfiskgalar', 'Mimicry').map(problems), ...A('stunfisk', 'Static').map(problems), ...B().map(problems));
console.log('  fixture legality (TeamValidator): ' + (bad0.length ? bad0.join('; ') : 'every body, ability, item and move is legal'));
if (bad0.length) cannot('the fixture is not legal: ' + bad0.join('; '));

function play(tag, a0, b0, script) {
  const a = G.buildPair(a0), b = G.buildPair(b0);
  if (!a || !b) return null;
  G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'mimicry-event:' + tag, { script,
    onBoundary: (snap, t) => { boards.push({ turn: t, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  return { r, boards, sd: G.lastSdLog(), turns: boards.length };
}
const T = (p1, p2) => ({ p1, p2 });
const IDLE = T([{ m: 'sleeptalk' }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const RT = T([{ m: 'reflecttype', t: 0 }, { m: 'sleeptalk' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);
const ET = T([{ m: 'sleeptalk' }, { m: 'electricterrain' }], [{ m: 'sleeptalk' }, { m: 'sleeptalk' }]);

const ARMS = [
  ['RED 1  no terrain, Reflect Type turn 2', 'red', A('stunfiskgalar', 'Mimicry'), [IDLE, RT, IDLE, IDLE, IDLE]],
  ['RED 2  Electric Terrain turn 1, Reflect Type turn 2', 'red', A('stunfiskgalar', 'Mimicry'), [ET, RT, IDLE, IDLE]],
  ['LIVE   Reflect Type turn 2, Electric Terrain turn 3', 'live', A('stunfiskgalar', 'Mimicry'), [IDLE, RT, ET, IDLE]],
  ['CONTROL  Stunfisk (Static), Reflect Type turn 2', 'control', A('stunfisk', 'Static'), [IDLE, RT, IDLE, IDLE, IDLE]],
];
let bad = 0, redBad = 0;
const ok = (cond, what, detail, isRed) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) { bad++; if (isRed) redBad++; }
};
const out = {};
for (const [name, kind, a0, script] of ARMS) {
  const g = play(name.split(' ')[0].toLowerCase() + name.split(' ')[1], a0, B(), script);
  if (!g) cannot('buildPair returned null on ' + name);
  if (g.r.err) cannot(name + ' threw: ' + g.r.err);
  if (g.turns < script.length + 1) cannot(name + ' played ' + g.turns + ' boundaries of ' + (script.length + 1) + ' — a short game tests nothing');
  out[name] = g;
  console.log('\n  ' + name);
  const reflected = g.sd.some(l => /^\|-start\|p1a: [^|]*\|typechange\|\[from\] move: Reflect Type/.test(l));
  const mimicryLines = g.sd.filter(l => /ability: Mimicry/.test(l));
  console.log('      authority: Reflect Type landed ' + reflected + '; Mimicry lines: ' + (mimicryLines.join('  ') || 'none'));
  ok(reflected, 'the authority copied the type (the move is staged, not refused)');
  if (/Electric Terrain/.test(name)) ok(g.sd.some(l => /^\|-fieldstart\|move: Electric Terrain/.test(l)), 'the authority set Electric Terrain');
  if (kind === 'live') ok(mimicryLines.some(l => /typechange\|Electric/.test(l)),
    'LIVE: the authority\'s Mimicry retyped the holder on the terrain it answers (the gate must keep this)');
  const diffs = [].concat(...g.boards.map(b => b.diffs.map(d => 'boundary ' + b.turn + '  ' + d.path + '  sd ' + JSON.stringify(d.sd) + ' / me ' + JSON.stringify(d.us))));
  ok(!diffs.length, 'the two boards agree at every boundary' + (kind === 'red' && KNOB ? '   [expected RED: the knob is armed]' : ''),
     diffs.length ? diffs.slice(0, 6).join('\n') : null, kind === 'red');
}

console.log('\n' + (bad ? 'RED' : 'GREEN') + (KNOB ? '   (knob armed: ' + redBad + ' red-arm failure(s) — must be > 0 for the knob to be live)' : ''));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
