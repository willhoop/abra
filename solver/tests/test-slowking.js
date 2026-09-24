/* solver/tests/test-slowking.js — SLOWKING v1 (solver/slowking/matrix.js) on games with known answers.
 *
 *   node solver/tests/test-slowking.js [--no-red]      exit 0 GREEN, 1 RED, 3 a clause is BLIND
 *
 * What each clause asserts. The equilibrium check is always recomputed HERE from the returned x and y
 * (`gapOf` below), never read from the solver's own report.
 *   KNOWN   matching pennies -> (1/2,1/2) both, value 0. Rock-paper-scissors -> uniform, value 0.
 *           A 2x2 with a mixed equilibrium solved in closed form (p = (d-c)/(a-b-c+d) etc.).
 *           A game with a strictly dominant row -> that row with probability 1. By BOTH solvers.
 *   LP      200 random games up to 12x16: the LP's pair has gap < 1e-9, and its value equals the
 *           value certified by brute force over the pair (min_j xA_j = max_i Ay_i).
 *   RM      the same 200 games: RM+ (default mode) reaches gap <= 1e-3 * range and its value agrees
 *           with the LP's to that tolerance.
 *   CONV    convergence, proved against the theorem: simultaneous RM+ with the plain average obeys
 *           gap(T) <= range * (sqrt(m) + sqrt(n)) / sqrt(T) at T = 100, 1000, 10000 on 30 random games,
 *           and gap(10000) < gap(100) on every one of them.
 *   SELF    the solver's reported gap equals the gap recomputed here.
 *
 * RED, unless --no-red: the file re-runs itself under each deliberate break in matrix.js and REQUIRES
 * the named clause to fail — colsign (RM, CONV), noavg (CONV), lpdual (LP, KNOWN). A clause that stays
 * green under its break is blind: exit 3.
 */
'use strict';
const path = require('path');
const cp = require('child_process');
const SK = require('../slowking/matrix.js');

const NO_RED = process.argv.includes('--no-red');
let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 30) console.log('  FAIL [' + clause + '] ' + msg); } };

function gapOf(A, x, y) {
  let br = -Infinity, bc = Infinity;
  for (let i = 0; i < A.length; i++) { let s = 0; for (let j = 0; j < y.length; j++) s += A[i][j] * y[j]; br = Math.max(br, s); }
  for (let j = 0; j < A[0].length; j++) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * A[i][j]; bc = Math.min(bc, s); }
  return { gap: br - bc, lo: bc, hi: br };
}
const isDist = p => p.every(v => v >= -1e-12) && Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9;
/* a seeded LCG, the test's own; nothing here depends on the engine */
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function randGame(r, m, n) { const A = []; for (let i = 0; i < m; i++) { const row = []; for (let j = 0; j < n; j++) row.push(r()); A.push(row); } return A; }
const close = (a, b, t) => Math.abs(a - b) <= t;

/* ---------- KNOWN ---------- */
for (const [name, solve] of [['LP', SK.solveLP], ['RM', A => SK.solveRM(A, { iters: 20000, tol: 1e-6 })]]) {
  const MP = [[1, -1], [-1, 1]];
  let s = solve(MP);
  ok('KNOWN', close(s.x[0], 0.5, 1e-3) && close(s.y[0], 0.5, 1e-3) && close(s.value, 0, 1e-3), name + ' matching pennies ' + JSON.stringify([s.x, s.y, s.value]));
  const RPS = [[0, -1, 1], [1, 0, -1], [-1, 1, 0]];
  s = solve(RPS);
  ok('KNOWN', s.x.every(v => close(v, 1 / 3, 1e-3)) && s.y.every(v => close(v, 1 / 3, 1e-3)) && close(s.value, 0, 1e-3), name + ' RPS ' + JSON.stringify([s.x, s.y]));
  // 2x2 closed form: A = [[a,b],[c,d]] with no saddle point
  const a = 3, b = -1, c = -2, d = 1;
  const p = (d - c) / (a - b - c + d), q = (d - b) / (a - b - c + d), v = (a * d - b * c) / (a - b - c + d);
  s = solve([[a, b], [c, d]]);
  ok('KNOWN', close(s.x[0], p, 1e-3) && close(s.y[0], q, 1e-3) && close(s.value, v, 1e-3), name + ' 2x2 closed form want ' + [p, q, v] + ' got ' + JSON.stringify([s.x[0], s.y[0], s.value]));
  // strictly dominant row 1
  s = solve([[0, 0.2, 0.1], [0.5, 0.9, 0.6], [0.1, 0.3, 0.2]]);
  ok('KNOWN', close(s.x[1], 1, 1e-3) && close(s.y[0], 1, 1e-3), name + ' dominant row ' + JSON.stringify([s.x, s.y]));
}

/* ---------- LP, RM, SELF on 200 random games ---------- */
{
  const r = lcg(12345);
  let worstRM = 0, worstLP = 0;
  for (let g = 0; g < 200; g++) {
    const m = 1 + Math.floor(r() * 12), n = 1 + Math.floor(r() * 16);
    const A = randGame(r, m, n);
    const L = SK.solveLP(A);
    ok('LP', isDist(L.x) && isDist(L.y), 'LP not a distribution g' + g);
    const gl = gapOf(A, L.x, L.y);
    worstLP = Math.max(worstLP, gl.gap);
    ok('LP', gl.gap < 1e-9, 'LP gap ' + gl.gap + ' on ' + m + 'x' + n + ' g' + g);
    ok('LP', close(L.lpValue, gl.lo, 1e-9) && close(L.lpValue, gl.hi, 1e-9), 'LP value ' + L.lpValue + ' not certified [' + gl.lo + ',' + gl.hi + '] g' + g);
    const R = SK.solveRM(A, { iters: 200000, tol: 1e-3 });
    const gr = gapOf(A, R.x, R.y);
    worstRM = Math.max(worstRM, gr.gap);
    ok('RM', isDist(R.x) && isDist(R.y), 'RM not a distribution g' + g);
    ok('RM', gr.gap <= 1e-3, 'RM gap ' + gr.gap + ' after ' + R.iters + ' iters on ' + m + 'x' + n + ' g' + g);
    ok('RM', close(R.value, L.lpValue, 1e-3), 'RM value ' + R.value + ' vs LP ' + L.lpValue + ' g' + g);
    ok('SELF', close(R.gap, gr.gap, 1e-12) && close(L.gap, gl.gap, 1e-12), 'reported gap differs from recomputed g' + g);
  }
  console.log('  random games: worst LP gap ' + worstLP.toExponential(2) + ', worst RM+ gap ' + worstRM.toExponential(2));
}

/* ---------- CONV: the theorem's bound, measured ---------- */
{
  const r = lcg(777);
  let minSlack = Infinity;
  for (let g = 0; g < 30; g++) {
    const m = 2 + Math.floor(r() * 10), n = 2 + Math.floor(r() * 14);
    const A = randGame(r, m, n);
    const gaps = [];
    for (const T of [100, 1000, 10000]) {
      const R = SK.solveRM(A, { iters: T, alternate: false, avg: 'uniform' });
      const gp = gapOf(A, R.x, R.y).gap;
      const bound = SK.rmBound(A, T);
      minSlack = Math.min(minSlack, bound - gp);
      ok('CONV', gp <= bound, 'gap ' + gp + ' > bound ' + bound + ' at T=' + T + ' on ' + m + 'x' + n);
      gaps.push(gp);
    }
    ok('CONV', gaps[2] < gaps[0] || gaps[0] < 1e-9, 'no convergence: ' + gaps.join(' -> '));
    // the default (alternating, linear) mode should be far below the bound too
    const Rd = SK.solveRM(A, { iters: 1000 });
    ok('CONV', gapOf(A, Rd.x, Rd.y).gap <= SK.rmBound(A, 1000), 'default mode above the bound at T=1000');
  }
  console.log('  CONV: smallest (bound - gap) over 90 runs ' + minSlack.toExponential(2));
}

/* sampling */
{
  const r = lcg(5); const p = [0.1, 0.6, 0.3]; const c = [0, 0, 0];
  for (let i = 0; i < 30000; i++) c[SK.sample(p, r())]++;
  ok('KNOWN', c.every((v, i) => Math.abs(v / 30000 - p[i]) < 0.015), 'sample frequencies ' + c);
}

console.log('test-slowking: ' + (checks - fails) + '/' + checks + ' checks' + (SK.BROKEN ? '  [BREAK ' + SK.BROKEN + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));

if (!NO_RED && !SK.BROKEN) {
  const need = { colsign: ['RM', 'CONV'], noavg: ['CONV'], lpdual: ['LP', 'KNOWN'] };
  let blind = 0;
  for (const [brk, clauses] of Object.entries(need)) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env: Object.assign({}, process.env, { SLOWKING_BREAK: brk }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-slowking:')) || '';
    for (const c of clauses) {
      const seen = new RegExp('failed clauses: .*\\b' + c + '\\b').test(line) && res.status !== 0;
      console.log('  RED ' + brk + ' -> ' + c + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)'));
      if (!seen) blind++;
    }
  }
  if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
