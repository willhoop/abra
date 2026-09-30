/* solver/tests/test-double-protect.js — THE DOUBLE-PROTECT SOFT GATE (solver/doduo/double_protect.js) on CONSTRUCTED
 * boards, one clause per case, each shown RED on a deliberate break.
 *
 *   node solver/tests/test-double-protect.js [--no-red] [--release eaa5becc54eb]   exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * Plays the frozen release (default eaa5becc54eb). EVERY ENTITY IS DERIVED from the Reg M-C dex (solver/human/dex.js,
 * filtered to the regulation) by PROPERTY, never typed: the protect-type move (a self `stallingMove` whose condition blocks),
 * a plain damaging move, species with a quiet ability, a first-turn-only guaranteed-flinch move (purpose 'flinch' and the
 * engine's `firstTurnOnly` tag), a weather- and a terrain-setting ability (their switch-in sets it), a screen (a timed
 * own-side condition that modifies damage), the move that raises the engine's Trick Room counter (found by stepping).
 *
 * CLAUSES
 *   PROTECT    protect-type is read off the dex: every self stalling move is in, the side guards are out, an attack is out
 *   OFF        with no `doubleProtect` in the gates the scores are the prior's own, byte for byte (the flag is off by default)
 *   FIRES      a clear field, no foe clock: every (protect, protect) joint is weighted by the floor and nothing else moves;
 *              the counters say it fired
 *   SINGLE     a joint with ONE protect is never weighted (the single-slot Protect is unchanged)
 *   OPPSIDE    the opponent's joints (side !== viewer) are never weighted
 *   TRICKROOM  Trick Room up with the opponent slower (it favours them): exempt; with the opponent faster: fires
 *   OWNFIELD   a weather only MY revealed body can set fires; one only THEIR body can set is exempt; one both can set is
 *              contested and fires. The same for terrain
 *   TAILWIND   the opponent's Tailwind exempts; mine does not
 *   SCREEN     a screen on the opponent's side exempts; on mine it does not
 *   FAKEOUT    a foe on its first turn with a first-turn-only flinch move in its engine menu exempts; the same foe after its
 *              first move action (the engine refuses the move at selection) fires
 *   PERISH     a foe's Perish count with none on my side exempts; mine lower than the foe's fires
 *   RESIDUAL   a foe poisoned (the board's status) exempts
 *   SETUP      a foe that can SET Trick Room this turn (it is not up) is NOT a stall reason: fires (the chomp1 turn-4 shape)
 *   AGENT      a league spec's gates.doubleProtect reaches the agent's prior, its code is in the gate digest, and a MILTANK
 *              decision at a FIRES board plays no double protect
 *   STATS      solver/arena/protect_stats.js counts a double-protect turn (pairs, doubles)
 *
 * RED, unless --no-red: re-runs itself under each GATE_BREAK and REQUIRES the named clause to fail:
 *   dpoff -> FIRES, dpnoexempt -> TRICKROOM, dpanyfield -> OWNFIELD, dpsheetfo -> FAKEOUT
 */
'use strict';
require('../arena/env.js');
const path = require('path');
const cp = require('child_process');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NO_RED = argv.includes('--no-red');
const REL = flag('--release', 'eaa5becc54eb');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const X = require('../human/dex.js');
const D = X.D;
const PR = require('../mag/probe.js');
const PU = require('../mag/purpose.js');
const DPm = require('../doduo/double_protect.js');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------- derived entities ---------- */
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const MOVES = D.moves.all().filter(X.legal).sort(byId);
const SPECIES = D.species.all().filter(s => X.legal(s) && !s.isMega && !s.battleOnly && !s.forme && (() => { try { return !!M.buildMon(s.id, {}); } catch (e) { return false; } })()).sort(byId);
const firstAbility = s => toID(Object.values(s.abilities || {})[0]);
const QUIET_KEYS = /^on(TryHit|Immunity|SetStatus|FoeRedirectTarget|AnyRedirectTarget|ModifyType|Damage|TryBoost|SourceModify|ModifyMove|AllyTryHitSide|TryHitSide|DragOut|FoeTryMove|AnyTryMove|SwitchIn|Start|Update|Residual|BeforeMove|ModifyPriority|ModifySpe)/;
const quietAbility = id => { const a = D.abilities.get(id); return !!(a && a.exists) && !Object.keys(a).some(k => QUIET_KEYS.test(k)) && !a.isBreakable; };
const quiet = SPECIES.filter(s => quietAbility(firstAbility(s)) && !s.types.includes('Ghost'));
if (quiet.length < 12) cannot('too few quiet species: ' + quiet.length);
const stallMove = MOVES.filter(m => m.stallingMove && m.target === 'self' && m.condition && m.condition.onTryHit)
  .sort((a, b) => Object.keys(a.condition).length - Object.keys(b.condition).length || byId(a, b))[0];
const plain = MOVES.find(m => (m.category === 'Physical' || m.category === 'Special') && m.target === 'normal' && m.basePower >= 40 && m.basePower <= 60
  && (m.accuracy === true || m.accuracy === 100) && !m.priority && !m.secondary && !m.secondaries && !m.onTry && !m.self && !m.drain && !m.recoil && !m.flags.charge);
const fakeOut = MOVES.find(m => PU.purposeOf(m.id) === 'flinch' && M.moveTagParam(m.id, 'firstTurnOnly'));
const T = DPm.setters();
const wAb = [...T.abilityWeather.entries()].find(([a, w]) => M.weatherId(w) && D.abilities.get(a).exists);
const tAb = [...T.abilityTerrain.entries()].find(([a, t]) => M.terrainId(t) && D.abilities.get(a).exists);
const screen = [...T.screens][0];
if (!stallMove || !plain || !fakeOut || !wAb || !tAb || !screen) cannot('a derived entity is missing: ' + JSON.stringify({ stall: !!stallMove, plain: !!plain, fakeOut: !!fakeOut, wAb: !!wAb, tAb: !!tAb, screen }));
const WEATHER = M.weatherId(wAb[1]), TERRAIN = M.terrainId(tAb[1]);

let sheetIx = 0;
function body(sp, moves, o) {
  o = o || {};
  const b = M.buildMon(sp.id, {});
  b.moves = moves.map(m => (typeof m === 'string' ? m : m.id));
  b.item = '';
  b.ability = firstAbility(sp);
  b._solverSheet = (sheetIx++) % 6;
  return b;
}
/* the plain board: my two bodies know an attack and the protect-type move; the foes know an attack */
function board(o) {
  o = o || {};
  const [a, b, c, d] = [quiet[0], quiet[1], quiet[2], quiet[3]];
  const S = API.newBattle([body(a, [plain, stallMove]), body(b, [plain, stallMove])], [body(c, o.foeMoves || [plain]), body(d, [plain])], { seeded: true });
  S.maxTurns = Infinity;
  return S;
}
const ctx = { G: { sheets: { p1: [], p2: [] } } };
const DP = DPm.create(API, {});
const isDbl = j => DP.isDouble(j);
const uniform = la => new Float64Array(la.joint.length).fill(1);
function weigh(S, o) {
  const la = API.legalActions(S, 'A');
  const w = DP.weights(ctx, S, 'A', 'A', la, uniform(la));
  return { la, w, fired: !!w, reasons: DP.stall(S, 'A', ctx).reasons };
}
const reasonsOf = S => DP.stall(S, 'A', ctx).reasons;

/* ---------- PROTECT ---------- */
{
  const selfStall = MOVES.filter(m => m.stallingMove && m.target === 'self');
  const guards = [...require('../arena/protect_stats.js').family()].map(id => D.moves.get(id)).filter(m => m.target !== 'self');
  ok('PROTECT', selfStall.length >= 2 && selfStall.every(m => DP.isProtect({ kind: 'move', move: m.id })), 'every self stalling move is protect-type: ' + selfStall.map(m => m.id));
  ok('PROTECT', guards.every(m => !DP.isProtect({ kind: 'move', move: m.id })), 'a side guard is not protect-type: ' + guards.map(m => m.id));
  ok('PROTECT', !DP.isProtect({ kind: 'move', move: plain.id }) && !DP.isProtect({ kind: 'switch', to: 2 }), 'an attack or a switch is not protect-type');
  console.log(`  PROTECT: ${selfStall.map(m => m.id).join(', ')} in; ${guards.map(m => m.id).join(', ') || 'no side guard'} out`);
}

/* ---------- FIRES / SINGLE / OFF / OPPSIDE ---------- */
{
  const S = board();
  const { la, w, reasons } = weigh(S);
  const nD = la.joint.filter(isDbl).length;
  ok('FIRES', nD >= 1, 'the board offers ' + nD + ' double-protect joints');
  ok('FIRES', !!w && reasons.length === 0, 'a clear board with no foe clock: the gate must fire (reasons ' + JSON.stringify(reasons) + ')');
  if (w) {
    ok('FIRES', la.joint.every((j, i) => (isDbl(j) ? w[i] === DP.WEIGHT : w[i] === 1)), 'every double joint at the floor and nothing else moved');
    ok('SINGLE', la.joint.filter(j => !isDbl(j) && j.some(x => DP.isProtect(x))).every(j => w[la.joint.indexOf(j)] === 1), 'a single protect is never weighted');
  }
  ok('FIRES', DP.COUNTERS.fired >= 1 && DP.COUNTERS.jointsWeighted >= nD, 'the counters say it fired: ' + JSON.stringify({ fired: DP.COUNTERS.fired, weighted: DP.COUNTERS.jointsWeighted }));
  /* through DODUO v2, the way an agent sees it */
  const stubPA = { scoreJoints: (c, S2, side, viewer, l) => uniform(l), revealed: () => new Set(), newGame: () => ({}) };
  const V2off = require('../doduo/v2.js').create(API, { tiers: false });
  const off = V2off.wrap(stubPA).scoreJoints(ctx, S, 'A', 'A', la);
  ok('OFF', off.every(x => x === 1), 'with no doubleProtect the prior is untouched');
  const V2on = require('../doduo/v2.js').create(API, { tiers: false, doubleProtect: true });
  const on = V2on.wrap(stubPA).scoreJoints(ctx, S, 'A', 'A', la);
  ok('FIRES', la.joint.every((j, i) => (isDbl(j) ? on[i] === DP.WEIGHT : on[i] === 1)), 'DODUO v2 (tiers off) applies the gate');
  ok('FIRES', V2on.COUNTERS.doubleProtect && V2on.COUNTERS.doubleProtect.fired === 1, 'DODUO v2 carries the gate counters');
  const laB = API.legalActions(S, 'B');
  const opp = V2on.wrap(stubPA).scoreJoints(ctx, S, 'B', 'A', laB);
  ok('OPPSIDE', opp.every(x => x === 1), 'the opponent\'s columns are never weighted');
  console.log(`  FIRES: ${nD} double joints weighted to ${DP.WEIGHT} of ${la.joint.length}; OFF leaves the prior; OPPSIDE untouched`);
}

/* ---------- TRICKROOM ---------- */
{
  const S = board();
  S.field.tr = 3;
  for (const m of S.actB) m.boosts = Object.assign({}, m.boosts, { sp: -6 });
  const slow = reasonsOf(S);
  ok('TRICKROOM', slow.includes('trickroom'), 'Trick Room up and the opponent slower: expected exempt, reasons ' + JSON.stringify(slow));
  ok('TRICKROOM', !weigh(S).w, 'Trick Room up and the opponent slower: the double protect must NOT be weighted');
  for (const m of S.actB) m.boosts = Object.assign({}, m.boosts, { sp: 6 });
  const fast = reasonsOf(S);
  ok('TRICKROOM', !fast.includes('trickroom'), 'Trick Room up and the opponent faster: it favours me, expected no exemption, reasons ' + JSON.stringify(fast));
  console.log(`  TRICKROOM: opponent slower -> ${JSON.stringify(slow)}; faster -> ${JSON.stringify(fast)}`);
}

/* ---------- OWNFIELD (weather, terrain) ---------- */
{
  for (const [kind, id, ab] of [['weather', WEATHER, wAb[0]], ['terrain', TERRAIN, tAb[0]]]) {
    const S = board();
    S.field[kind] = id; S.field[kind + 'T'] = 3;
    S.actA[0].ability = ab;
    const mine = reasonsOf(S);
    ok('OWNFIELD', !mine.includes(kind), `${kind} ${id} only I can set (${ab}): expected no exemption, reasons ${JSON.stringify(mine)}`);
    S.actA[0].ability = firstAbility(quiet[0]); S.actB[0].ability = ab;
    const theirs = reasonsOf(S);
    ok('OWNFIELD', theirs.includes(kind), `${kind} ${id} only they can set: expected exempt, reasons ${JSON.stringify(theirs)}`);
    S.actA[0].ability = ab;
    const both = reasonsOf(S);
    ok('OWNFIELD', !both.includes(kind), `${kind} ${id} both can set (contested): expected no exemption, reasons ${JSON.stringify(both)}`);
    console.log(`  OWNFIELD ${kind} ${id} (${ab}): mine -> ${JSON.stringify(mine)}, theirs -> ${JSON.stringify(theirs)}, both -> ${JSON.stringify(both)}`);
  }
}

/* ---------- TAILWIND / SCREEN ---------- */
{
  const S = board();
  S.field.twA = 3;
  const mine = reasonsOf(S);
  S.field.twA = 0; S.field.twB = 3;
  const theirs = reasonsOf(S);
  ok('TAILWIND', !mine.includes('tailwind') && theirs.includes('tailwind'), `my Tailwind ${JSON.stringify(mine)}, theirs ${JSON.stringify(theirs)}`);
  const S2 = board();
  S2.sfA.sc = Object.assign({}, S2.sfA.sc, { [screen]: 4 });
  const sm = reasonsOf(S2);
  S2.sfA.sc[screen] = 0; S2.sfB.sc = Object.assign({}, S2.sfB.sc, { [screen]: 4 });
  const st = reasonsOf(S2);
  ok('SCREEN', !sm.includes('screen') && st.includes('screen'), `${screen} on my side ${JSON.stringify(sm)}, on theirs ${JSON.stringify(st)}`);
  console.log(`  TAILWIND mine ${JSON.stringify(mine)} theirs ${JSON.stringify(theirs)}; SCREEN (${screen}) mine ${JSON.stringify(sm)} theirs ${JSON.stringify(st)}`);
}

/* ---------- FAKEOUT ---------- */
{
  const S = board({ foeMoves: [fakeOut, plain] });
  S.actB[0]._mvActs = 0;
  const menu0 = API.legalActions(S, 'B').slots[0].options.some(o => o.move === fakeOut.id);
  const r0 = reasonsOf(S);
  S.actB[0]._mvActs = 1;
  const menu1 = API.legalActions(S, 'B').slots[0].options.some(o => o.move === fakeOut.id);
  const r1 = reasonsOf(S);
  if (!menu0 || menu1) cannot(`the engine menu premise: ${fakeOut.id} offered on the first turn ${menu0}, after a move action ${menu1}`);
  ok('FAKEOUT', r0.includes('fakeout'), `${fakeOut.id} in the foe's menu on its first turn: expected exempt, ${JSON.stringify(r0)}`);
  ok('FAKEOUT', !r1.includes('fakeout'), `${fakeOut.id} refused by the engine after the foe's first move action: expected no exemption, ${JSON.stringify(r1)}`);
  console.log(`  FAKEOUT (${fakeOut.id}): first turn -> ${JSON.stringify(r0)}; after a move action -> ${JSON.stringify(r1)}`);
}

/* ---------- PERISH / RESIDUAL ---------- */
{
  const S = board();
  S.actB[0]._perish = 2;
  const a = reasonsOf(S);
  S.actA[0]._perish = 1;
  const b = reasonsOf(S);
  ok('PERISH', a.includes('perish') && !b.includes('perish'), `a foe at 2 with none on my side ${JSON.stringify(a)}; mine at 1 ${JSON.stringify(b)}`);
  const S2 = board();
  S2.actB[1].status = 'psn';
  const c = reasonsOf(S2);
  ok('RESIDUAL', c.includes('residual'), `a poisoned foe: expected exempt, ${JSON.stringify(c)}`);
  S2.actB[1].status = ''; S2.actA[1].status = 'psn';
  const d = reasonsOf(S2);
  ok('RESIDUAL', !d.includes('residual'), `my own poisoned body is no reason: ${JSON.stringify(d)}`);
  console.log(`  PERISH foe-only ${JSON.stringify(a)}, mine lower ${JSON.stringify(b)}; RESIDUAL foe ${JSON.stringify(c)}, mine ${JSON.stringify(d)}`);
}

/* ---------- SETUP: a foe that can SET Trick Room is not a stall reason ---------- */
{
  /* the move that raises the engine's Trick Room counter, found by stepping, never named */
  let trMove = null;
  for (const m of MOVES.filter(m => m.pseudoWeather && m.target === 'all')) {
    const S = board({ foeMoves: [m, plain] });
    const lb = API.legalActions(S, 'B');
    const jb = lb.joint.find(j => j[0].move === m.id && j[1].kind === 'move');
    const ja = API.legalActions(S, 'A').joint.find(j => j[0].move === plain.id && j[1].move === plain.id);
    if (!jb || !ja) continue;
    const T2 = API.clone(S);
    API.stepInPlace(T2, ja, jb, M.midEventDice({ seed: 5, reset: false }));
    if ((T2.field.tr | 0) > 0) { trMove = m; break; }
  }
  if (!trMove) cannot('no move in this regulation raises the engine\'s Trick Room counter');
  const S = board({ foeMoves: [trMove, plain] });
  for (const m of S.actB) m.boosts = Object.assign({}, m.boosts, { sp: -6 });
  const { w, reasons } = weigh(S);
  ok('SETUP', !!w && reasons.length === 0, `${trMove.id} in the foe's menu but not up: expected the gate to fire, reasons ${JSON.stringify(reasons)}`);
  console.log(`  SETUP: the foe can click ${trMove.id} this turn -> ${w ? 'fires' : 'exempt ' + JSON.stringify(reasons)}`);
}

/* ---------- AGENT ---------- */
{
  /* the spec field reaches the agent's prior and the digest (no decision: the league prior needs real sheets) */
  const T3 = require('../arena/teams.js');
  const AG = require('../mew/agent.js').create(API, { buildBody: T3.buildBody });
  const spec = { name: 'dp-test', kind: 'miltank', mag: 'solver/machamp/models/gen5/mag-gen5.json', doduo: 'solver/machamp/models/gen5/doduo-gen5.json',
    pory2: 'solver/machamp/models/gen5/porygon2-gen5.json', k1: 4, k2: 4, depth: 0, reserveSwitch: 1, gates: { doubleProtect: true, tiers: false } };
  const a = AG.load(spec);
  ok('AGENT', !!(a.PA.gateCounters && a.PA.gateCounters.doubleProtect), 'the agent\'s prior carries the gate counters');
  const plainSpec = Object.assign({}, spec, { name: 'dp-test-plain' });
  delete plainSpec.gates;
  const b = AG.load(plainSpec);
  ok('AGENT', !!a.digests.gates && !b.digests.gates && !b.PA.gateCounters, 'the gated spec is digested and the plain one carries no gate');
  /* MILTANK on the FIRES board with a flat stand-in prior wrapped by the gate: the double protect never reaches the rows */
  const R = require('../miltank/rollout.js').create(API, { buildBody: T3.buildBody });
  const stubPA = { scoreJoints: (c, S2, side, viewer, l) => uniform(l), revealed: (S2, sd) => new Set((sd === 'A' ? S2.sfA : S2.sfB).team.map((m, k) => k)), newGame: () => ({}) };
  const V2 = require('../doduo/v2.js').create(API, { tiers: false, doubleProtect: true });
  const MT = require('../miltank/search.js').create(API, { prior: V2.wrap(stubPA), rollout: R });
  const S = board();
  let dbl = 0, rowsD = 0, recs = 0;
  for (let sd = 0; sd < 3; sd++) {
    const r = MT.decide(API.clone(S), 'A', { G: { sheets: { p1: [], p2: [] } }, hist: [] }, { budgetMs: 20000, maxPasses: 2, k1: 4, k2: 4, depth: 0, reserveSwitch: 0, leaf: 'heuristic', record: true, coin: M.rngStreams({ seed: 70 + sd }).any });
    if (isDbl(r.joint)) dbl++;
    const rows = r.info && r.info.rec && r.info.rec.rows;
    if (rows) { recs++; if (rows.some(isDbl)) rowsD++; }
  }
  ok('AGENT', V2.COUNTERS.doubleProtect.fired >= 3, 'the gate fired inside the search: ' + JSON.stringify(V2.COUNTERS.doubleProtect));
  ok('AGENT', recs === 3 && dbl === 0 && rowsD === 0, `rows recorded ${recs}/3; a double protect reached the rows in ${rowsD} and was played in ${dbl}`);
  console.log(`  AGENT: spec wired and digested; in MILTANK the gate fired ${V2.COUNTERS.doubleProtect.fired}x, double protect in the rows ${rowsD}/${recs}, played ${dbl}/3`);
}

/* ---------- STATS ---------- */
{
  const PS = require('../arena/protect_stats.js').create(API);
  const g = PS.game();
  const S = board();
  const laA = API.legalActions(S, 'A'), laB = API.legalActions(S, 'B');
  const jA = laA.joint.find(isDbl), jB = laB.joint.find(j => j.every(x => x.kind === 'move' && x.move === plain.id));
  g.before(S, jA, jB);
  API.stepInPlace(S, jA, jB, M.midEventDice({ seed: 5, reset: false }));
  g.after();
  const o = g.out();
  ok('STATS', o.A.pairs === 1 && o.A.doubles === 1 && o.B.pairs === 1 && o.B.doubles === 0, 'protect_stats pairs/doubles: ' + JSON.stringify(o));
  console.log(`  STATS: A ${JSON.stringify(o.A)}  B ${JSON.stringify(o.B)}`);
}

const brk = DP.BROKEN;
console.log('test-double-protect: ' + (checks - fails) + '/' + checks + ' checks' + (brk ? '  [BREAK ' + brk + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));

if (!NO_RED && !brk) {
  const need = [['dpoff', 'FIRES'], ['dpnoexempt', 'TRICKROOM'], ['dpanyfield', 'OWNFIELD'], ['dpsheetfo', 'FAKEOUT']];
  let blind = 0;
  for (const [v, clause] of need) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--release', REL], { env: Object.assign({}, process.env, { GATE_BREAK: v }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-double-protect:') && l.includes('failed clauses')) || '';
    const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
    console.log('  RED GATE_BREAK=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line + (res.status === 2 ? ' ' + (res.stdout || '').split('\n').find(l => l.startsWith('CANNOT')) : '')));
    if (!seen) blind++;
  }
  if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
