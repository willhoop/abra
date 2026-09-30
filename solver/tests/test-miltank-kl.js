/* solver/tests/test-miltank-kl.js — THE HUMAN-REGULARISED SOLVE (piKL): SLOWKING's KL-regularised equilibrium and
 * MILTANK's `kl` option. (2026-09-30, docs/_reports/2026-09-30-human-regularised-search.md)
 *
 *   node solver/tests/test-miltank-kl.js [--no-red] [--release eaa5becc54eb] [--positions 4] [--passes 6]
 *        [--team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc]
 *        exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * SOLVER clauses (no engine; solver/slowking/matrix.js solveKL):
 *   FLAT     every cell equal: the solve returns the anchors exactly (x = tau_row, y = tau_col), at any lambda > 0.
 *   CLOSED   every row constant across the columns (A[i][j] = a_i): the row mix is the closed form tau_i*exp(a_i/lambda),
 *            normalised, to TV 1e-4 after 4,000 rounds (the averaged iterate carries the early rounds: measured 5e-6 at
 *            lambda 0.03).
 *   LIMITS   lambda = 100 returns the anchor (TV < 1e-3); lambda = 1e-4 on matching pennies with a 0.9/0.1 anchor returns a
 *            mix within 0.03 of the Nash (0.5, 0.5).
 *   GAP      on 40 random 4-8 x 4-8 tables over a lambda grid, the regularised gap (computed from the returned pair) is
 *            <= the tolerance, and moving the row mix off the answer raises it (the certificate can see an error).
 *   INPUT    an anchor that is not a positive distribution, or a negative lambda, throws.
 * SEARCH clauses (engine, release pinned; gen5's search: k 4x4, depth 0, PORYGON2 gen5 leaf, a pass cap, no clock):
 *   OFF      kl absent and kl = 0 play the same joint from the same mix as each other, and the kl counters stay 0.
 *   FIRES    kl = 0.01: every searched decision is counted (klDecisions), the table is the SAME table the plain search
 *            filled (CRN: same coin, same passes), and the played mix equals solveKL recomputed from the record's table and
 *            the record's prior scores through anchorOf (1e-9) — the flag reached the solve with the prior as its anchor.
 *   ANCHOR   kl = 100: the played mix is the anchor (TV < 0.01), and on at least one fixture that is not the plain mix.
 *   COUNT    the protect-family and double-protect mass counters equal the masses recomputed from the record.
 *   MISSING  a prior that matches nothing (every score 1e-15) anchors to uniform, is counted (klPriorMissingMe/Opp), and
 *            still solves.
 *   AGENT    a league spec carrying "kl" reaches the search (agent COUNTERS.kl[name].decisions > 0); without it, none.
 *
 * RED, unless --no-red: re-runs itself under MILTANK_BREAK=klignored (lambda read as 0 in the solve: FIRES and ANCHOR
 * must fail) and SLOWKING_BREAK=klsign (the anchor with the wrong sign: FLAT and CLOSED must fail).
 */
'use strict';
require('../arena/env.js');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NO_RED = argv.includes('--no-red');
const REL = flag('--release', 'eaa5becc54eb');
const NPOS = +flag('--positions', 4);
const PASSES = +flag('--passes', 6);
const STORE = flag('--team-store', 'C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc');
const ROOT = path.join(__dirname, '..', '..');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };
const SK = require('../slowking/matrix.js');
const SEARCH = require('../miltank/search.js');
const tvd = (p, q) => p.reduce((s, v, i) => s + Math.abs(v - q[i]), 0) / 2;

/* ---------- SOLVER ---------- */
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const dist = (k, s) => { const v = Array.from({ length: k }, () => Math.exp(s * rnd())); const t = v.reduce((a, b) => a + b, 0); return v.map(x => 0.999 * x / t + 0.001 / k); };
{
  for (const lam of [0.001, 0.1]) {
    const tr = dist(5, 3), tc = dist(4, 3);
    const A = Array.from({ length: 5 }, () => new Array(4).fill(0.42));
    const r = SK.solveKL(A, { tauRow: tr, tauCol: tc, lambda: lam, iters: 4000, tol: 1e-9 });
    ok('FLAT', tvd(r.x, tr) < 1e-6 && tvd(r.y, tc) < 1e-6, 'flat table at lambda ' + lam + ': TV to the anchors ' + tvd(r.x, tr).toExponential(2) + ' / ' + tvd(r.y, tc).toExponential(2));
  }
  for (const lam of [0.003, 0.03]) {
    const tr = dist(6, 3), tc = dist(5, 3), a = Array.from({ length: 6 }, () => 0.4 + 0.1 * rnd());
    const A = a.map(v => new Array(5).fill(v));
    const r = SK.solveKL(A, { tauRow: tr, tauCol: tc, lambda: lam, iters: 4000, tol: 0 });
    const w = tr.map((t, i) => t * Math.exp((a[i] - Math.max(...a)) / lam)), s = w.reduce((x, y) => x + y, 0);
    ok('CLOSED', tvd(r.x, w.map(v => v / s)) < 1e-4, 'row-constant table at lambda ' + lam + ': TV to the closed form ' + tvd(r.x, w.map(v => v / s)).toExponential(2));
  }
  {
    const tr = dist(4, 2), tc = dist(4, 2);
    const A = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => rnd()));
    const r = SK.solveKL(A, { tauRow: tr, tauCol: tc, lambda: 100, iters: 4000, tol: 1e-10 });
    ok('LIMITS', tvd(r.x, tr) < 1e-3, 'lambda 100 is not the anchor: TV ' + tvd(r.x, tr));
    const MP = [[1, 0], [0, 1]];
    const q = SK.solveKL(MP, { tauRow: [0.9, 0.1], tauCol: [0.9, 0.1], lambda: 1e-4, iters: 20000, tol: 1e-7 });
    ok('LIMITS', Math.abs(q.x[0] - 0.5) < 0.03 && Math.abs(q.y[0] - 0.5) < 0.03, 'lambda 1e-4 on matching pennies: x ' + q.x.map(v => v.toFixed(3)) + ' y ' + q.y.map(v => v.toFixed(3)));
  }
  let worst = 0, raised = 0, n = 0;
  for (const lam of [0.001, 0.003, 0.01, 0.03, 0.1]) for (let k = 0; k < 8; k++) {
    const m = 4 + (k % 5), nn = 4 + ((k * 3) % 5), base = 0.3 + 0.4 * rnd();
    const A = Array.from({ length: m }, () => Array.from({ length: nn }, () => Math.min(1, Math.max(0, base + 0.3 * (rnd() - 0.5)))));
    const tr = dist(m, 3), tc = dist(nn, 3);
    const r = SK.solveKL(A, { tauRow: tr, tauCol: tc, lambda: lam, iters: 4000, tol: 1e-5 });
    worst = Math.max(worst, r.gap); n++;
    const x2 = r.x.map((v, i) => (i === 0 ? v + 0.05 : v)); const s = x2.reduce((a, b) => a + b, 0);
    if (SK.gapKL(A, x2.map(v => v / s), r.y, tr, tc, lam, lam) > r.gap + 1e-6) raised++;
  }
  ok('GAP', worst <= 1e-5, 'a regularised gap above the tolerance: ' + worst.toExponential(2));
  ok('GAP', raised === n, 'moving the row mix off the answer did not raise the gap on ' + (n - raised) + ' of ' + n);
  console.log('  SOLVER: ' + n + ' random tables, worst regularised gap ' + worst.toExponential(2));
  const thr = f => { try { f(); return false; } catch (e) { return true; } };
  ok('INPUT', thr(() => SK.solveKL([[1, 0], [0, 1]], { tauRow: [1, 0], tauCol: [0.5, 0.5], lambda: 0.1 })), 'a zero in the anchor did not throw');
  ok('INPUT', thr(() => SK.solveKL([[1, 0], [0, 1]], { tauRow: [0.6, 0.6], tauCol: [0.5, 0.5], lambda: 0.1 })), 'an anchor summing to 1.2 did not throw');
  ok('INPUT', thr(() => SK.solveKL([[1, 0], [0, 1]], { lambda: -1 })), 'a negative lambda did not throw');
}

/* ---------- SEARCH ---------- */
let ENGINE;
try { ENGINE = require('../arena/engine.js').load(REL); } catch (e) { cannot('release ' + REL + ' does not open: ' + e.message); }
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const FAM = require('../arena/protect_stats.js').family();
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
console.log('  fixtures: ' + fx.length + ' positions, ' + PASSES + ' passes');

let differs = 0;
for (let fi = 0; fi < fx.length; fi++) {
  const f = fx[fi];
  const run = extra => { const MT = SEARCH.create(API, { prior: G5.PA, rollout: R }); const r = MT.decide(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() }, opts(40 + fi, extra)); return { r, C: MT.COUNTERS }; };
  const off = run({}), zero = run({ kl: 0 }), on = run({ kl: 0.01 }), big = run({ kl: 100 });
  ok('OFF', JSON.stringify(off.r.joint) === JSON.stringify(zero.r.joint) && JSON.stringify(off.r.info.rec.x) === JSON.stringify(zero.r.info.rec.x), 'kl 0 differs from kl absent');
  ok('OFF', off.C.klDecisions === 0 && zero.C.klDecisions === 0 && !off.r.info.kl, 'kl counters moved with kl off');
  ok('FIRES', on.C.klDecisions === 1 && on.r.info.kl && on.r.info.lambda === 0.01, 'kl 0.01 not counted: klDecisions ' + on.C.klDecisions);
  const recOn = on.r.info.rec, recOff = off.r.info.rec;
  ok('FIRES', JSON.stringify(recOn.A) === JSON.stringify(recOff.A), 'the kl search did not fill the same table');
  ok('FIRES', JSON.stringify(recOn.x0) === JSON.stringify(recOff.x), 'the plain mix recorded beside the kl mix is not the plain search\'s mix');
  const tr = SEARCH.anchorOf(recOn.tauRow), tc = SEARCH.anchorOf(recOn.tauCol);
  ok('FIRES', !!tr && !!tc, 'the fixture prior is degenerate');
  if (tr && tc) {
    const ref = SK.solveKL(recOn.A, { tauRow: tr, tauCol: tc, lambda: 0.01, iters: 4000, tol: 1e-5 });
    ok('FIRES', tvd(ref.x, recOn.x) < 1e-9, 'the played mix is not solveKL on the record: TV ' + tvd(ref.x, recOn.x).toExponential(2));
    const bx = big.r.info.rec.x;
    ok('ANCHOR', tvd(bx, tr) < 0.01, 'kl 100 is not the anchor: TV ' + tvd(bx, tr).toFixed(4));
    if (tvd(tr, recOff.x) > 0.05 && tvd(bx, recOff.x) > 0.05) differs++;
  }
  const isP = x => !!(x && x.kind === 'move' && FAM.has(x.move));
  const pm = recOn.rows.reduce((s, j, i) => s + (j.some(isP) ? recOn.x[i] : 0), 0), pm0 = recOn.rows.reduce((s, j, i) => s + (j.some(isP) ? recOn.x0[i] : 0), 0);
  const dm = recOn.rows.reduce((s, j, i) => s + (j.filter(isP).length >= 2 ? recOn.x[i] : 0), 0);
  ok('COUNT', Math.abs(on.C.protMass - pm) < 1e-9 && Math.abs(on.C.protMass0 - pm0) < 1e-9 && Math.abs(on.C.dblMass - dm) < 1e-9, 'protect mass counters ' + [on.C.protMass, on.C.protMass0, on.C.dblMass] + ' vs recomputed ' + [pm, pm0, dm]);
}
ok('ANCHOR', differs > 0, 'no fixture where the anchor and the plain mix differ: the clause cannot see a lambda that is ignored');
{
  const f = fx[0];
  const dead = { scoreJoints: (ctx, S, side, viewer, la) => new Float64Array(la.joint.length).fill(1e-15), revealed: G5.PA.revealed };
  const MT = SEARCH.create(API, { prior: dead, rollout: R });
  let r = null, err = null;
  try { r = MT.decide(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() }, opts(77, { kl: 0.01 })); } catch (e) { err = e; }
  ok('MISSING', !err && r && r.info.kl && MT.COUNTERS.klPriorMissingMe === 1 && MT.COUNTERS.klPriorMissingOpp === 1, 'a matchless prior: ' + (err ? err.message : 'missing counters ' + MT.COUNTERS.klPriorMissingMe + '/' + MT.COUNTERS.klPriorMissingOpp));
  if (r && r.info.rec) { const u = new Array(r.info.rec.rows.length).fill(1 / r.info.rec.rows.length); const ref = SK.solveKL(r.info.rec.A, { tauRow: u, tauCol: new Array(r.info.rec.cols.length).fill(1 / r.info.rec.cols.length), lambda: 0.01, iters: 4000, tol: 1e-5 }); ok('MISSING', tvd(ref.x, r.info.rec.x) < 1e-9, 'the missing prior was not anchored to uniform'); }
}
{
  const f = fx[0];
  const on = AGm.load(Object.assign({}, G5spec, { name: 'gen5-kl-test', kl: 0.01 }));
  on.bot(3, { budgetMs: 600000, maxPasses: 2 }).choose(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() });
  G5.bot(3, { budgetMs: 600000, maxPasses: 2 }).choose(API.clone(f.S), 'A', { G: f.ctx.G, hist: f.ctx.hist.slice() });
  const K = AGm.COUNTERS.kl || {};
  ok('AGENT', K['gen5-kl-test'] && K['gen5-kl-test'].decisions === 1 && K['gen5-kl-test'].lambda === 0.01, 'the spec kl did not reach the search: ' + JSON.stringify(K));
  ok('AGENT', !K[G5spec.name], 'the plain gen5 spec counted a kl decision');
}

console.log(`test-miltank-kl: ${checks - fails}/${checks} ${fails ? 'RED' : 'GREEN'}  (failed clauses: ${[...failed].join(', ') || 'none'})` + (SK.BROKEN || (SEARCH.create(API, { prior: G5.PA, rollout: R }).BROKEN) ? '  [BREAK ' + (SK.BROKEN || process.env.MILTANK_BREAK) + ']' : ''));

if (process.env.MILTANK_BREAK || process.env.SLOWKING_BREAK) process.exit(fails ? 1 : 0);
if (!NO_RED) {
  const breaks = [['MILTANK_BREAK', 'klignored', ['FIRES', 'ANCHOR']], ['SLOWKING_BREAK', 'klsign', ['FLAT', 'CLOSED']]];
  let blind = false;
  for (const [k, v, must] of breaks) {
    const env = Object.assign({}, process.env, { [k]: v });
    const r = cp.spawnSync(process.execPath, [__filename, ...argv, '--no-red'], { env, encoding: 'utf8', maxBuffer: 64 << 20 });
    const out = (r.stdout || '') + (r.stderr || '');
    const line = out.split('\n').find(l => l.startsWith('test-miltank-kl:')) || '(no summary line)';
    const hit = must.filter(c => new RegExp('failed clauses: .*\\b' + c + '\\b').test(line));
    const red = r.status === 1 && hit.length === must.length;
    console.log('  RED ' + k + '=' + v + ': exit ' + r.status + ', ' + line.replace(/^test-miltank-kl: /, '') + (red ? '' : '   <-- BLIND: expected ' + must.join(', ')));
    if (!red) blind = true;
  }
  if (blind) { console.log('BLIND: a deliberate break was not seen'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
