/* solver/tests/test-arena.js — the offline arena (solver/arena/arena.js).
 *
 *   node solver/tests/test-arena.js [--no-red]      exit 0 GREEN, 1 RED, 3 BLIND
 *
 *   WILSON   the interval matches the closed form at published points (50/100 -> 0.4038..0.5962;
 *            0/10 -> 0..0.2775; 10/10 -> 0.7225..1).
 *   SEAT     paired seating: consecutive games share a team pair and a battle seed, and bot x sits on
 *            side A in one and side B in the other.
 *   PLAY     a short random-vs-prior match plays to the end with no errors, both bots' decision times
 *            are recorded, the prior matched options (its capability fired), the result is PRE-GATE.
 *   DET      the same flags give the same per-game results twice (the arena is reproducible).
 *
 * RED, unless --no-red: ARENA_BREAK=seat must fail SEAT.
 */
'use strict';
const cp = require('child_process');
const NO_RED = process.argv.includes('--no-red');
const AR = require('../arena/arena.js');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const near = (a, b) => Math.abs(a - b) < 5e-4;

{
  const w = AR.wilson(50, 100); ok('WILSON', near(w[0], 0.4038) && near(w[1], 0.5962), '50/100 ' + w);
  const z = AR.wilson(0, 10); ok('WILSON', near(z[0], 0) && near(z[1], 0.2775), '0/10 ' + z);
  const f = AR.wilson(10, 10); ok('WILSON', near(f[0], 0.7225) && near(f[1], 1), '10/10 ' + f);
}

const o = { x: 'random', y: 'prior', games: 6, seed: 5, budget: 0, depth: 1, k1: 4, k2: 4, cap: 60 };
const r1 = AR.run(o);
{
  const g = r1.per_game;
  for (let i = 0; i + 1 < g.length; i += 2) {
    ok('SEAT', g[i].id === g[i + 1].id && g[i].seed === g[i + 1].seed, 'pair ' + i + ' does not share team and seed');
    ok('SEAT', g[i].xSide !== g[i + 1].xSide, 'pair ' + i + ': x sat on side ' + g[i].xSide + ' both times');
  }
  ok('PLAY', r1.played === 6 && r1.result.errors === 0, 'played ' + r1.played + ' errors ' + r1.result.errors);
  const dm = Object.values(r1.decision_ms);
  ok('PLAY', dm.every(s => s && s.n > 0), 'decision times missing');
  ok('PLAY', r1.counters.prior.optionsMatched > 0, 'prior matched no option');
  ok('PLAY', /^PRE-GATE/.test(r1.status), 'artifact not labelled PRE-GATE');
  ok('PLAY', r1.result.score_x >= 0 && r1.result.score_x <= 1 && r1.result.ci95_x[0] <= r1.result.score_x && r1.result.score_x <= r1.result.ci95_x[1], 'score/CI inconsistent');
}
{
  const r2 = AR.run(o);
  ok('DET', JSON.stringify(r2.per_game.map(g => [g.vX, g.turns])) === JSON.stringify(r1.per_game.map(g => [g.vX, g.turns])), 'two identical runs differ');
}

console.log('test-arena: ' + (checks - fails) + '/' + checks + ' checks' + (AR.BROKEN ? '  [BREAK ' + AR.BROKEN + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));
if (!NO_RED && !AR.BROKEN) {
  const res = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env: Object.assign({}, process.env, { ARENA_BREAK: 'seat' }), encoding: 'utf8' });
  const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-arena:')) || '';
  const seen = /failed clauses: .*\bSEAT\b/.test(line) && res.status === 1;
  console.log('  RED ARENA_BREAK=seat -> SEAT: ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)'));
  if (!seen) process.exit(3);
}
process.exit(fails ? 1 : 0);
