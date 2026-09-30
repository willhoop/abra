/* solver/tests/test-rotom-world-clocks.js — ROTOM's world carries the clocks, volatiles, abilities and field state the
 * public log shows (solver/rotom/world_log.js, 2026-09-30, docs/_reports/2026-09-30-rotom-world-fixes.md).
 *
 *   node solver/tests/test-rotom-world-clocks.js [--release eaa5becc54eb]        exit 0 GREEN, 1 RED
 *
 * Every REPLAY clause rebuilds the world from a SAVED LADDER LOG of the chomp1 run (fixtures/rotom/postmortem/, copied
 * from solver/out/rotom/chomp1-2026-09-29T23-13-11-521Z) at the decision the post-mortem named, and asks the engine
 * what the server showed. No game is played: one engine step from a rebuilt position at most.
 *
 *   PERISH    sdkvndfv g1, turn 4: both our actives (Salamence, Volcarona) at the engine's `_perish` 1, and one engine
 *             step from that world faints both — the server fainted both at the end of that turn.
 *   CLOCKS    the same game with volatile lines spliced into turn 2: a Taunt on a body that had acted runs the dex
 *             duration + 1 - 1 and the engine offers it no status move; an Encore locks the engine's menu to the encored
 *             move; a Substitute, a Leech Seed and a confusion are laid on the engine's own fields. Plus the walk on its
 *             own: sleep ticks, the toxic stage, Disable's -1 and Rest's fixed sleep.
 *   AUDIT     every per-body leaf engine/board_state.js mediBody reads, and every field leaf of readMedi, is either
 *             CARRIED or OWED in world_log.js (a leaf in neither fails by name).
 *   RED       ROTOM_WORLD_BREAK=noclocks (the pre-fix world: no body clocks, no log field) turns PERISH and CLOCKS red.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');

let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const W = require('../rotom/world.js');
const WL = require('../rotom/world_log.js');
const LR = require('./ladder_replay.js');
const FX = path.join(__dirname, 'fixtures', 'rotom', 'postmortem');
const WB = W.create(API);
const hpOf = row => { const b = T.buildBody(M, row); return b ? b.st.hp : 100; };
const opp = s => (s === 'A' ? 'B' : 'A');
const acts = (S, s) => (s === 'A' ? S.actA : S.actB);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------------- PERISH ---------------- */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'sdkvndfv-g1.battle.txt'), me: 'p2', bring: [0, 5, 2, 4], cut: '|turn|4', hpOf });
  const sal = LR.bodyOf(w, 'p2', 'Salamence'), vol = LR.bodyOf(w, 'p2', 'Volcarona');
  ok('PERISH', sal && sal._perish === 1 && vol && vol._perish === 1, 'our actives at turn 4: Salamence perish ' + (sal && sal._perish) + ', Volcarona ' + (vol && vol._perish) + ' (the server showed perish1 on both)');
  const mine = API.legalActions(w.S, w.side), theirs = API.legalActions(w.S, opp(w.side));
  const jm = mine.joint.find(j => j.every(o => o.kind === 'move' && !/protect/.test(o.move || ''))) || mine.joint[0];
  const S2 = API.step(w.S, w.side === 'A' ? jm : theirs.joint[0], w.side === 'A' ? theirs.joint[0] : jm, API.makeRng(7));
  const team = w.side === 'A' ? S2.sfA.team : S2.sfB.team;
  const dead = n => { const b = team.find(m => new RegExp('^' + n, 'i').test(m.name)); return !!(b && (b.fainted || b.curHP <= 0)); };
  ok('PERISH', dead('salamence') && dead('volcarona'), 'one engine step from the turn-4 world: Salamence fainted ' + dead('salamence') + ', Volcarona ' + dead('volcarona') + ' (the server fainted both)');
  console.log('  PERISH  turn 4: Salamence ' + (sal && sal._perish) + ', Volcarona ' + (vol && vol._perish) + '; after one step fainted ' + dead('salamence') + '/' + dead('volcarona'));
}

/* ---------------- CLOCKS ---------------- */
{
  const inject = [['|-sidestart|p2: medicham32|move: Tailwind', ['|-start|p2a: Salamence|move: Taunt', '|-start|p2b: Volcarona|Encore',
    '|-start|p2a: Salamence|Substitute', '|-start|p2b: Volcarona|move: Leech Seed', '|-start|p2a: Salamence|confusion']]];
  const w = LR.worldAt(WB, { log: path.join(FX, 'sdkvndfv-g1.battle.txt'), me: 'p2', bring: [0, 5, 2, 4], cut: '|turn|3', hpOf, inject });
  const sal = LR.bodyOf(w, 'p2', 'Salamence'), vol = LR.bodyOf(w, 'p2', 'Volcarona');
  const tauntWant = WL.durationOf('taunt') - 1 + WL.startAdj('taunt').ifActed;
  ok('CLOCKS', sal._vol && sal._vol.taunt === tauntWant, 'Taunt on a body that acted, one residual later: ' + (sal._vol && sal._vol.taunt) + ', want ' + tauntWant);
  ok('CLOCKS', vol._vol && vol._vol.encore > 0 && vol._encoreMove === 'quiverdance', 'Encore laid ' + (vol._vol && vol._vol.encore) + ' on ' + vol._encoreMove + ' (want the last move, quiverdance)');
  const la = API.legalActions(w.S, w.side);
  const slotOf = b => acts(w.S, w.side).indexOf(b);
  const movesIn = b => la.slots[slotOf(b)].options.filter(o => o.kind === 'move').map(o => o.move);
  const salMoves = [...new Set(movesIn(sal))], volMoves = [...new Set(movesIn(vol))];
  const status = id => { const m = require('../human/dex.js').D.moves.get(id); return m.exists && m.category === 'Status'; };
  ok('CLOCKS', salMoves.length && !salMoves.some(status), 'a Taunted Salamence is offered no status move by the engine: ' + salMoves.join(','));
  ok('CLOCKS', volMoves.length && volMoves.every(m => m === 'quiverdance'), 'an Encored Volcarona is offered only Quiver Dance by the engine: ' + volMoves.join(','));
  ok('CLOCKS', sal._sub > 0 && vol._seededBy && sal._vol.confusion > 0, 'Substitute ' + sal._sub + ', Leech Seed ' + !!vol._seededBy + ', confusion ' + (sal._vol && sal._vol.confusion));
  console.log('  CLOCKS  taunt ' + (sal._vol && sal._vol.taunt) + ' | encore ' + (vol._vol && vol._vol.encore) + ' ' + vol._encoreMove + ' | Salamence offered ' + salMoves.join(',') + ' | Volcarona offered ' + volMoves.join(','));

  /* the walk on its own */
  const sheets = { p1: [{ nick: 'A', item: '' }, { nick: 'B', item: '' }], p2: [{ nick: 'C', item: '' }, { nick: 'D', item: '' }] };
  const L = WL.walk(['|switch|p1a: A|X|100/100', '|switch|p2a: C|Y|100/100', '|switch|p2b: D|Z|100/100', '|turn|1',
    '|move|p1a: A|Spore|p2a: C', '|-status|p2a: C|slp|[from] move: Spore', '|move|p1a: A|Toxic|p2b: D', '|-status|p2b: D|tox',
    '|-start|p2b: D|Disable|Tackle', '|upkeep', '|turn|2', '|cant|p2a: C|slp', '|upkeep', '|turn|3', '|cant|p2a: C|slp', '|-status|p1a: A|slp|[from] move: Rest'], sheets);
  const C = L.bodies.get('p2:0'), D = L.bodies.get('p2:1'), A = L.bodies.get('p1:0');
  ok('CLOCKS', C && C.slp && C.slp.ticks === 2, 'sleep ticks after two |cant|slp: ' + (C && C.slp && C.slp.ticks));
  ok('CLOCKS', D && D.tox && L.U - D.tox.since === 2, 'toxic stage after two residuals: ' + (D && D.tox && L.U - D.tox.since));
  ok('CLOCKS', D && D.vols.get('disable') && D.vols.get('disable').adj === WL.startAdj('disable').ifNotActed && D.vols.get('disable').arg === 'tackle', 'Disable on a body that had not acted: adj ' + (D && D.vols.get('disable') && D.vols.get('disable').adj) + ' move ' + (D && D.vols.get('disable') && D.vols.get('disable').arg));
  ok('CLOCKS', A && A.slp && A.slp.rest === true && WL.restTime() > 0, 'Rest sleep marked (fixed time ' + WL.restTime() + ')');
}

/* ---------------- AUDIT ---------------- */
{
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'engine', 'board_state.js'), 'utf8');
  const i = src.indexOf('function mediBody'), j = src.indexOf('function sdBody');
  const body = src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '');
  const leaves = new Set([...body.matchAll(/^\s+([a-z_]+):/gm)].map(m => m[1]).filter(k => k !== 'vol'));
  const r = src.indexOf('function readMedi'); const rm = src.slice(r, src.indexOf('\n}', r)).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of rm.matchAll(/([a-z_]+)_turns:/g)) leaves.add(m[1] + '_turns');
  for (const k of ['weather', 'terrain', 'screens', 'tailwind', 'hazards', 'party', 'pp', 'slots']) if (new RegExp('\\b' + k + ':').test(rm)) leaves.add(k);
  const missing = [...leaves].filter(k => !(k in WL.CARRIED) && !(k in WL.OWED));
  ok('AUDIT', leaves.size >= 40, 'parsed only ' + leaves.size + ' leaves from engine/board_state.js — the parse is broken');
  ok('AUDIT', !missing.length, 'board leaves neither CARRIED nor OWED in world_log.js: ' + missing.join(', '));
  console.log('  AUDIT   ' + leaves.size + ' board leaves: ' + [...leaves].filter(k => k in WL.CARRIED).length + ' carried, ' + [...leaves].filter(k => k in WL.OWED).length + ' owed');
}

console.log(fails ? `RED  ${fails} of ${checks} checks failed${process.env.ROTOM_WORLD_BREAK ? ' (ROTOM_WORLD_BREAK=' + process.env.ROTOM_WORLD_BREAK + ')' : ''}` : `GREEN  ${checks} checks`);
process.exit(fails ? 1 : 0);
