/* solver/tests/test-hypno.js — HYPNO v1, the population best response (solver/hypno/; docs/_reports/2026-10-01-gary-hypno.md).
 *
 *   node solver/tests/test-hypno.js [--no-red] [--release df172ccd2aaf] [--positions 4] [--passes 6]
 *        [--model solver/gary/model/gary-v1.json] [--team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * RULE clauses (no engine; solver/hypno/hypno.js respond on constructed tables):
 *   GATES    an untrusted cell plays sigma*; GARY mass under minCover plays sigma*; a gain within one SE (few playouts)
 *            plays sigma*; the same table with many playouts plays the pure best response; no gain plays sigma*.
 *   BR       the played row is the argmax of A.h (checked against a brute-force enumeration on 50 random tables), the
 *            reported gain is (A h)_BR - x.A.h, and the worst case is v* - min_j (x_play.A)_j.
 *   EPS      with eps, the played mix's worst case is >= v* - eps - 1e-12, and eps = 0 plays (essentially) sigma*.
 *   MIX      w = 0 with y = the solve's column mix makes h_eff = y*, against which sigma* already earns the most: no deviation.
 * SERIES clauses (solver/hypno/series.js):
 *   DELTA    an opponent who protects far more than the population: the MAP deviation's stall tilt is > 0, larger with more
 *            evidence, 0 with sigma 0 / disabled; a game-1 observation is not used in game 1.
 *   WPOST    evidence the opponent follows GARY raises w above w0, evidence for the equilibrium lowers it; a column the table
 *            did not hold is not evidence; game g reads only games < g.
 * SEARCH clauses (engine, release pinned; gen5's search k 4x4, depth 0, gen5 leaf, a pass cap, no clock):
 *   OFF      hypno absent: no hypno counter moves and no info.hypno.
 *   FIRES    hypno on with every cell trusted and the SE and coverage gates open (kSE -Infinity, minCover 0): each decision
 *            is counted, the record's columns carry GARY's mass (recomputed here through a fresh adapter: 1e-12), the
 *            response recomputed from the record equals the one played, and a played response picks the best-response row.
 *   PLAYS    on at least one fixture the best-response row differs from what the solve's mix sampled with the same coin
 *            (so FIRES can see a response that is computed and ignored).
 *   UNTRUST  the shipped gates: an untrusted cell is counted and the pick is the solve's.
 *   AGENT    a league spec carrying "hypno" reaches the search (agent COUNTERS.hypno[name].decisions > 0); without it, none.
 *   SERIESLIVE ROTOM's game-end hook (solver/rotom/policy.js observeGame -> solver/hypno/series_live.js) records every fully
 *            observed opponent decision of a fixture game, game 2 then reads a non-zero deviation (game 1 reads none), and the
 *            deviation moves GARY's distribution. Needs the model's in-series test to have ENABLED the update.
 * RED, unless --no-red: HYPNO_BREAK=nogate (GATES), argmin (BR), seriesleak (WPOST), deltaoff (SERIESLIVE);
 * MILTANK_BREAK=hypnoignored (FIRES).
 */
'use strict';
require('../arena/env.js');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NO_RED = argv.includes('--no-red');
const REL = flag('--release', 'df172ccd2aaf');
const NPOS = +flag('--positions', 4);
const PASSES = +flag('--passes', 6);
const STORE = flag('--team-store', 'C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc');
const ROOT = path.join(__dirname, '..', '..');
const MODEL = path.resolve(ROOT, flag('--model', 'solver/gary/model/gary-v1.json'));
let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };
const H = require('../hypno/hypno.js');
const SRm = require('../hypno/series.js');
const SK = require('../slowking/matrix.js');

/* ---------- RULE ---------- */
{
  const A = [[0.9, 0.1], [0.5, 0.5]];             // row 0 wins against column 0, row 1 is safe
  const sol = SK.solveLP(A);
  const many = [[4000, 4000], [4000, 4000]], few = [[2, 2], [2, 2]];
  const base = { A, x: sol.x, y: sol.y, hCols: [0.9, 0.1], hMass: 1, trusted: true, w: 1 };
  ok('GATES', H.respond(Object.assign({}, base, { trusted: false, cnt: many })).reason === 'untrusted', 'an untrusted cell deviated');
  ok('GATES', H.respond(Object.assign({}, base, { hCols: [0.09, 0.01], cnt: many })).reason === 'coverage', 'GARY mass 0.1 on the columns deviated');
  const rf = H.respond(Object.assign({}, base, { A: [[0.52, 0.48], [0.5, 0.5]], x: [0, 1], cnt: few, hCols: [0.6, 0.4] }));
  ok('GATES', rf.reason === 'belowSE', 'a 0.004 gain at 2 playouts a cell deviated: ' + rf.reason + ' gain ' + rf.gainPred + ' se ' + rf.se);
  const rm = H.respond(Object.assign({}, base, { cnt: many }));
  ok('GATES', rm.reason === 'played' && rm.iBR === 0 && rm.x[0] === 1, 'a clear gain at 4,000 playouts did not play the best response: ' + rm.reason);
  ok('GATES', H.respond(Object.assign({}, base, { hCols: [0.5, 0.5], A: [[0.5, 0.5], [0.5, 0.5]], x: [0.5, 0.5], cnt: many })).reason === 'noGain', 'a flat table deviated');
  let sd = 3; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let t = 0; t < 50; t++) {
    const m = 2 + Math.floor(rnd() * 6), n = 2 + Math.floor(rnd() * 6);
    const T = Array.from({ length: m }, () => Array.from({ length: n }, () => rnd()));
    const s = SK.solveRM(T, { iters: 4000, tol: 1e-6 });
    const h = Array.from({ length: n }, () => rnd());
    const r = H.respond({ A: T, x: s.x, y: s.y, hCols: h, hMass: h.reduce((a, b) => a + b, 0), trusted: true, w: 1, cnt: T.map(rw => rw.map(() => 1e9)) });
    const hs = h.map(v => v / h.reduce((a, b) => a + b, 0));
    const u = T.map(rw => rw.reduce((a, v, j) => a + v * hs[j], 0));
    const best = u.indexOf(Math.max(...u)), baseV = s.x.reduce((a, v, i) => a + v * u[i], 0);
    if (u[best] - baseV > 1e-6) ok('BR', r.reason === 'played', 'a positive gain of ' + (u[best] - baseV).toFixed(6) + ' at 1e9 playouts a cell was refused: ' + r.reason);
    if (r.reason === 'played') {
      ok('BR', r.iBR === best, 'not the argmax row: ' + r.iBR + ' vs ' + best);
      ok('BR', Math.abs(r.gainPred - (u[best] - baseV)) < 1e-9, 'gain misreported');
      const ap = Array.from({ length: n }, (_, j) => r.x.reduce((a, v, i) => a + v * T[i][j], 0));
      const a0 = Array.from({ length: n }, (_, j) => s.x.reduce((a, v, i) => a + v * T[i][j], 0));
      ok('BR', Math.abs(r.worst - Math.max(0, Math.min(...a0) - Math.min(...ap))) < 1e-9, 'worst case misreported');
      for (const eps of [0, 0.02, 0.1]) {
        const re = H.respond({ A: T, x: s.x, y: s.y, hCols: h, hMass: 1e-9 + h.reduce((a, b) => a + b, 0), trusted: true, w: 1, cnt: T.map(rw => rw.map(() => 1e9)) }, { eps });
        if (re.reason !== 'played') continue;
        ok('EPS', re.worst <= eps + 1e-12, `eps ${eps}: worst ${re.worst}`);
        if (eps === 0) ok('EPS', re.tv < 1e-6 || re.worst <= 1e-12, 'eps 0 moved off sigma* with a positive worst case');
      }
    } else ok('BR', r.reason === 'noGain' || r.reason === 'belowSE', 'unexpected refusal ' + r.reason);
    const rw0 = H.respond({ A: T, x: s.x, y: s.y, hCols: h, hMass: 1, trusted: true, w: 0, cnt: T.map(rw => rw.map(() => 1e9)) });
    ok('MIX', rw0.reason !== 'played' || rw0.gainPred < 2e-3, 'w = 0 found a gain of ' + rw0.gainPred + ' against y* (the solve gap is ~1e-6)');
  }
}

/* ---------- SERIES ---------- */
{
  const NF = SRm.NF, eff = new Float64Array(NF);
  let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const mk = gn => {      // 8 cells, cell 0..1 carry the stall bit; the opponent clicks a stall cell 80% of the time
    const lp = Float64Array.from({ length: 8 }, () => Math.log(1 / 8)), bits = Uint16Array.from({ length: 8 }, (_, k) => (k < 2 ? 1 : 0));
    return { gn, lp, bits, lab: rnd() < 0.8 ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 6), eff };
  };
  const S1 = SRm.create({ sigma: 0.5, gamma: 1, enabled: true }), S2 = SRm.create({ sigma: 0.5, gamma: 1, enabled: true }), S0 = SRm.create({ sigma: 0.5, gamma: 1, enabled: false });
  for (let i = 0; i < 3; i++) S1.observe(mk(1));
  for (let i = 0; i < 12; i++) { const o = mk(1); S2.observe(o); S0.observe(o); }
  const d1 = S1.delta(2), d2 = S2.delta(2);
  ok('DELTA', d1 && d2 && d1[1] > 0 && d2[1] > d1[1], 'the stall tilt did not grow with evidence: ' + (d1 && d1[1]) + ' / ' + (d2 && d2[1]));
  ok('DELTA', S0.delta(2) === null && S2.delta(1) === null, 'a disabled update or a game-1 read returned a deviation');
  const W = SRm.create({ w0: 0.5 });
  W.observeTable({ gn: 1, hCols: [0.7, 0.1, 0.1, 0.1], yStar: [0.05, 0.05, 0.05, 0.85], j: 0 });   // they clicked GARY's favourite
  ok('WPOST', W.w(2) > 0.5 && Math.abs(W.w(1) - 0.5) < 1e-12, 'w did not rise on evidence for GARY (or game 1 read itself): ' + W.w(2) + ' / ' + W.w(1));
  const W2 = SRm.create({ w0: 0.5 });
  W2.observeTable({ gn: 1, hCols: [0.7, 0.1, 0.1, 0.1], yStar: [0.05, 0.05, 0.05, 0.85], j: 3 });
  W2.observeTable({ gn: 1, hCols: [0.7, 0.1, 0.1, 0.1], yStar: [0.05, 0.05, 0.05, 0.85], j: -1 });
  ok('WPOST', W2.w(2) < 0.5 && W2.COUNTERS.tableSkippedNotInCols === 1, 'w did not fall on evidence for the equilibrium, or an off-table joint counted');
}

/* ---------- SEARCH ---------- */
let ENGINE;
if (!fs.existsSync(MODEL)) cannot('no GARY model at ' + MODEL);
try { ENGINE = require('../arena/engine.js').load(REL); } catch (e) { cannot('release ' + REL + ' does not open: ' + e.message); }
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const SEARCH = require('../miltank/search.js');
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const R = AGm.R;
const G5spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
const G5 = AGm.load(G5spec);
const CL = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
let P;
try { P = require('../mew/pairs.js').load({ teamStore: STORE }); } catch (e) { cannot('team store: ' + e.message); }
const leafModel = path.join(ROOT, G5spec.pory2);
const opts = (s, extra) => Object.assign({ budgetMs: 600000, maxPasses: PASSES, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2', leafModel, coin: M.rngStreams({ seed: s }).any, record: true }, extra || {});
/* a copy of the model with every cell trusted (FIRES must see responses) */
const allTrusted = (() => { const Mj = JSON.parse(fs.readFileSync(MODEL, 'utf8')); for (const k of Object.keys(Mj.gate || {})) Mj.gate[k].p = 1; const f = path.join(os.tmpdir(), 'gary-trusted-' + process.pid + '.json'); fs.writeFileSync(f, JSON.stringify(Mj)); return f; })();
const fx = [];
for (let g = 0; fx.length < NPOS && g < P.test.length; g++) {
  const G = P.test[(g * 17 + 3) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(900 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA0.newGame(G);
  const bA = CL.bot(1), bB = CL.bot(2);
  for (let t = 0; t < 3 && !API.isTerminal(S); t++) {
    if (t === 1 + (g % 2) && API.legalActions(S, 'A').joint.length > 1) { fx.push({ S: API.clone(S), ctx: { G: ctx.G, hist: ctx.hist.slice() } }); break; }
    const jA = bA.choose(S, 'A', ctx).joint, jB = bB.choose(S, 'B', ctx).joint;
    PA0.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
if (fx.length < Math.min(3, NPOS)) cannot('only ' + fx.length + ' fixture positions');
console.log('  fixtures: ' + fx.length + ' positions, ' + PASSES + ' passes, release ' + REL);
const hyOpen = { model: allTrusted, band: '1100', kSE: -Infinity, minCover: 0 };
let plays = 0, playedAny = 0;
for (let fi = 0; fi < fx.length; fi++) {
  const f = fx[fi];
  const run = extra => { const MT = SEARCH.create(API, { prior: G5.PA, rollout: R }); const r = MT.decide(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() }, opts(60 + fi, extra)); return { r, C: MT.COUNTERS }; };
  const off = run({}), on = run({ hypno: hyOpen });
  ok('OFF', off.C.hypnoDecisions === 0 && !off.r.info.hypno, 'hypno counters moved with hypno off');
  if (on.r.info.forced) continue;
  ok('FIRES', on.C.hypnoDecisions === 1 && !!on.r.info.hypno, 'hypno on was not counted');
  const rec = on.r.info.rec, q = on.r.info.hypno;
  ok('FIRES', JSON.stringify(rec.A) === JSON.stringify(off.r.info.rec.A), 'the hypno search did not fill the same table');
  /* GARY's column mass, recomputed through a fresh adapter */
  const HL = require('../hypno/live.js').create(API, hyOpen);
  const laOp = API.legalActions(f.S, 'B');
  const colsI = rec.cols.map(c => laOp.joint.findIndex(j => JSON.stringify(j) === JSON.stringify(c)));
  ok('FIRES', colsI.every(i => i >= 0), 'a recorded column is not a legal opponent joint');
  const sc = HL.score({ G: f.ctx.G, hist: f.ctx.hist.slice() }, f.S, 'B', 'A', laOp, colsI);
  ok('FIRES', rec.hCols && rec.hCols.every((v, j) => Math.abs(v - sc.hCols[j]) < 1e-12), 'the record\'s GARY column mass is not GARY\'s: ' + JSON.stringify(rec.hCols) + ' vs ' + JSON.stringify(sc.hCols));
  const cnt = rec.cnt;
  const re = H.respond({ A: rec.A, cnt, x: rec.x, y: rec.y, hCols: sc.hCols, hMass: sc.hMass, trusted: sc.trusted, w: sc.w }, { kSE: -Infinity, minCover: 0 });
  ok('FIRES', re.reason === q.reason, 'the recomputed response is ' + re.reason + ', the search said ' + q.reason);
  if (q.reason === 'played') {
    playedAny++;
    ok('FIRES', on.r.info.pick === re.iBR, 'the search did not play the best-response row: pick ' + on.r.info.pick + ' BR ' + re.iBR);
    if (q.pick0 !== re.iBR) plays++;
  }
}
ok('PLAYS', playedAny > 0 && plays > 0, `no fixture where the best response differs from the solve's sampled pick (played ${playedAny}, differing ${plays}): FIRES cannot see an ignored response`);
{
  /* the shipped gates: count an untrusted decision, play the solve */
  let unt = 0;
  for (let fi = 0; fi < fx.length; fi++) {
    const f = fx[fi];
    const MT = SEARCH.create(API, { prior: G5.PA, rollout: R });
    const r = MT.decide(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() }, opts(60 + fi, { hypno: { model: MODEL, band: '1100' } }));
    if (r.info.hypno && r.info.hypno.reason === 'untrusted') { unt++; ok('UNTRUST', MT.COUNTERS.hypnoUntrusted === 1 && r.info.pick === r.info.hypno.pick0, 'an untrusted decision changed the pick or was not counted'); }
  }
  ok('UNTRUST', unt > 0 || process.env.HYPNO_BREAK === 'nogate', 'no fixture decision fell in an untrusted cell under the shipped gates');
}
{
  const f = fx[0];
  const on = AGm.load(Object.assign({}, G5spec, { name: 'gen5-hypno-test', hypno: hyOpen }));
  on.bot(3, { budgetMs: 600000, maxPasses: 2 }).choose(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() });
  G5.bot(3, { budgetMs: 600000, maxPasses: 2 }).choose(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() });
  const K = AGm.COUNTERS.hypno || {};
  ok('AGENT', K['gen5-hypno-test'] && K['gen5-hypno-test'].decisions === 1, 'the spec hypno did not reach the search: ' + JSON.stringify(K));
  ok('AGENT', !K[G5spec.name], 'the plain gen5 spec counted a hypno decision');
}
{
  /* SERIESLIVE: ROTOM's game-end hook (policy.observeGame -> solver/hypno/series_live.js) turns a finished game into the
   * opponent's observations, game 2 then reads a deviation, and the search's GARY scores move with it */
  const games = fs.readFileSync(path.join(__dirname, 'fixtures', 'gary-games.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const Gm = require('../hypno/live.js').gary(MODEL);
  const IS = Gm.M.in_series;
  if (!IS || !IS.enabled) ok('SERIESLIVE', false, 'the model does not enable the in-series update, so ROTOM\'s series memory is never used');
  const Pp = require('../rotom/policy.js').create({ API, PA: G5.PA, R, tables: null });
  const CELLS = require('../gary/cells.js');
  let exact = 0;
  const row = games[0], opp = 'p2';
  for (let t = 0; t < row.turns.length; t++) { const dc = CELLS.decisionCells(Gm.MAG, row, t, opp); if (dc && dc.status === 'exact') exact++; }
  const r = Pp.observeGame({ bestof: 'test-series', gnum: 1, row, opp, oppRating: 1150, hypno: { model: MODEL } });
  ok('SERIESLIVE', r && r.enabled && r.observed === exact && exact > 0, 'observeGame recorded ' + JSON.stringify(r) + ' against ' + exact + ' exact opponent decisions');
  const SRx = Pp.HY_SERIES.get('test-series');
  const dl = SRx && SRx.delta(2);
  ok('SERIESLIVE', !!dl && dl.some(v => Math.abs(v) > 1e-9), 'game 2 reads no deviation from game 1');
  ok('SERIESLIVE', SRx && SRx.delta(1) === null, 'game 1 read its own observations');
  if (dl) {
    const t = Math.min(2, row.turns.length - 1);
    const a = Gm.predict(row, t, opp, { band: '1100' }), b = Gm.predict(row, t, opp, { band: '1100', delta: dl });
    ok('SERIESLIVE', a.cells.some(c => Math.abs(c.p - b.cells.find(x => x.a === c.a && x.b === c.b).p) > 1e-9), 'the deviation did not move GARY');
  }
}
fs.unlinkSync(allTrusted);

console.log(`test-hypno: ${checks - fails}/${checks} ${fails ? 'RED' : 'GREEN'}  (failed clauses: ${[...failed].join(', ') || 'none'})` + (process.env.HYPNO_BREAK || process.env.MILTANK_BREAK ? '  [BREAK ' + (process.env.HYPNO_BREAK || process.env.MILTANK_BREAK) + ']' : ''));
if (process.env.HYPNO_BREAK || process.env.MILTANK_BREAK) process.exit(fails ? 1 : 0);
if (!NO_RED) {
  let blind = false;
  for (const [k, v, must] of [['HYPNO_BREAK', 'nogate', ['GATES']], ['HYPNO_BREAK', 'argmin', ['BR']], ['HYPNO_BREAK', 'seriesleak', ['WPOST']], ['HYPNO_BREAK', 'deltaoff', ['SERIESLIVE']], ['MILTANK_BREAK', 'hypnoignored', ['FIRES']]]) {
    const r = cp.spawnSync(process.execPath, [__filename, ...argv, '--no-red'], { env: Object.assign({}, process.env, { [k]: v }), encoding: 'utf8', maxBuffer: 64 << 20 });
    const line = ((r.stdout || '') + (r.stderr || '')).split('\n').find(l => l.startsWith('test-hypno:')) || '(no summary line)';
    const red = r.status === 1 && must.every(c => new RegExp('failed clauses: .*\\b' + c + '\\b').test(line));
    console.log('  RED ' + k + '=' + v + ': exit ' + r.status + ', ' + line.replace(/^test-hypno: /, '') + (red ? '' : '   <-- BLIND: expected ' + must.join(', ')));
    if (!red) blind = true;
  }
  if (blind) { console.log('BLIND: a deliberate break was not seen'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
