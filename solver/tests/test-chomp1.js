/* solver/tests/test-chomp1.js — CHOMP v1: the learned cell scorer, the table, the solve, the bo3 adjustment, the wiring.
 *
 *   node solver/tests/test-chomp1.js [--no-red]      exit 0 = GREEN, 1 = RED
 *   env CHOMP_TEST_RELEASE=<id>   play on a frozen release (default: the live tree — this tests code, not a figure)
 *
 * Sheets are REAL Reg M-C open sheets from ROTOM's validated team pool (solver/rotom/teams/regmc-pool.json) and the
 * ROTOM preview fixture; nothing here names or types a Pokemon fact. The model is solver/chomp/v1/model/chomp1.json.
 *
 *   FEATURES  every engine fact is in [0, 1]; a sheet holding a mega stone builds its mega body; and the LEAD block
 *             moves: under one four, some two lead choices give different features (a scorer blind to the leads
 *             would pass every other clause).
 *   ANTISYM   the table of (s1, s2) and the table of (s2, s1) agree cell for cell: T[a][b] + T'[b][a] = 1; a mirror
 *             matchup (s, s) has 1/2 on the diagonal.
 *   PARITY    the JS forward pass equals train.py's on the model's 20 fixture rows (|logit difference| < 1e-4).
 *   SOLVE     on a real matchup: 8,100 cells in (0, 1), the mix sums to 1, and the equilibrium conditions hold IN THE
 *             TABLE (no option beats v* against their mix; every support option earns v*). The table MOVES: the
 *             options' win chances against a uniform opponent span more than 0.02 (a bring-blind scorer ties them).
 *   BO3       the opponent model sums to 1 and puts exactly s4[result] on the four they brought, with s4 read from
 *             bo3.json by their previous result; the adjusted mix is (1 - lambda) x + lambda BR(q) and does at least
 *             as well against q as the equilibrium mix.
 *   WIRING    the arena arm `chomp1` (solver/chomp/arms.js) returns an option from the mix and counts its solve; ROTOM's
 *             --preview hook (policy.previewChomp) answers the preview fixture with a legal choice FROM CHOMP v1 and
 *             passes the series through (a game-2 request is bo3-adjusted).
 *
 * Deliberate breaks, each must turn this RED (run unless --no-red): CHOMP1_BREAK=leads (FEATURES), CHOMP1_BREAK=sign
 * (ANTISYM, PARITY), SLOWKING_BREAK=lpdual (SOLVE), CHOMP1_BREAK=bo3 (BO3), CHOMP_VERSION=v0 (WIRING).
 */
'use strict';
require('../arena/env.js');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const NO_RED = process.argv.includes('--no-red');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const want = c => !ONLY || ONLY === c;

const ENGINE = require('../arena/engine.js').load(process.env.CHOMP_TEST_RELEASE || null);
const API = ENGINE.API;
const O = require('../chomp/options.js');
const { parseShowteam } = require('../human/parse_game.js');
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rotom', 'teams', 'regmc-pool.json'), 'utf8'));
const sheetOf = k => parseShowteam(POOL.teams[k].packed);
const S1 = sheetOf('0'), S2 = sheetOf('1'), S3 = sheetOf('2');

/* ---------------- FEATURES ---------------- */
if (want('FEATURES')) {
  const FX = require('../chomp/v1/features.js').create(API);
  const F = FX.pairFacts({ p1: S1, p2: S2 });
  let inRange = true;
  for (const s of ['p1', 'p2']) for (const k of ['d', 'ko', 'sko', 'h2', 'fast', 'pko']) for (const r of F[s][k]) for (const v of r) if (!(v >= 0 && v <= 1)) inRange = false;
  ok('FEATURES', inRange, 'an engine fact outside [0, 1]');
  const hasStone = [S1, S2].some(sh => sh.some(r => FX.megaForme(r)));
  ok('FEATURES', !hasStone || FX.COUNTERS.megaBodies > 0, 'a sheet holds a mega stone and no mega body was built');
  /* the lead block: options 0..5 share one four (options.js orders by four, then lead pair) */
  const sameFour = O.OPTIONS.map((o, i) => i).filter(i => O.fourOf[i] === O.fourOf[0]);
  const leadIdx = FX.G_NAMES.map((n, i) => (n.startsWith('lead_') || n === 'mega_lead' ? i : -1)).filter(i => i >= 0);
  const sig = a => { const g = FX.side(F, 'p1', a, 0); return leadIdx.map(i => g[i].toFixed(6)).join(','); };
  ok('FEATURES', sameFour.length === 6 && new Set(sameFour.map(sig)).size > 1, 'the lead features do not move with the lead choice under one four');
}

/* ---------------- ANTISYM + PARITY ---------------- */
const SC = (want('ANTISYM') || want('PARITY')) ? require('../chomp/v1/scorer.js').create(API) : null;
if (want('ANTISYM')) {
  const T = SC.table({ p1: S1, p2: S2 }).A, Tr = SC.table({ p1: S2, p2: S1 }).A;
  let worst = 0;
  for (let a = 0; a < O.N; a++) for (let b = 0; b < O.N; b++) worst = Math.max(worst, Math.abs(T[a][b] + Tr[b][a] - 1));
  ok('ANTISYM', worst < 1e-9, 'T[a][b] + T\'[b][a] - 1 reaches ' + worst);
  const Tm = SC.table({ p1: S3, p2: S3 }).A;
  let dmax = 0; for (let a = 0; a < O.N; a++) dmax = Math.max(dmax, Math.abs(Tm[a][a] - 0.5));
  ok('ANTISYM', dmax < 1e-9, 'a mirror matchup is not 1/2 on the diagonal: ' + dmax);
}
if (want('PARITY')) {
  const fx = SC.model.fixtures || [];
  ok('PARITY', fx.length >= 10, 'the model carries ' + fx.length + ' parity fixtures');
  let worst = 0;
  for (const f of fx) worst = Math.max(worst, Math.abs(SC.logitRow(f.ga, f.gb, f.sp) - f.logit));
  ok('PARITY', worst < 1e-4, 'JS vs Python logit differs by ' + worst);
}

/* ---------------- SOLVE ---------------- */
if (want('SOLVE')) {
  const CH = require('../chomp/v1/chomp1.js').create({ API });
  const r = CH.solve({ mine: S1, theirs: S2 }, { keepTable: true });
  const A = r.table;
  ok('SOLVE', A.length === 90 && A.every(row => row.length === 90 && row.every(v => v > 0 && v < 1)), 'the table is not 90 x 90 in (0, 1)');
  const sx = r.mix.reduce((s, p) => s + p, 0), sy = r.oppMix.reduce((s, p) => s + p, 0);
  ok('SOLVE', Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9 && r.mix.every(p => p >= -1e-12), 'mixes do not sum to 1');
  const vs = A.map(row => row.reduce((s, v, j) => s + v * r.oppMix[j], 0));
  const colv = A[0].map((_, j) => A.reduce((s, row, i) => s + r.mix[i] * row[j], 0));
  ok('SOLVE', Math.max(...vs) <= r.value + 1e-6, 'an option beats v* against their mix: ' + (Math.max(...vs) - r.value));
  ok('SOLVE', Math.min(...colv) >= r.value - 1e-6, 'a reply holds my mix under v*: ' + (r.value - Math.min(...colv)));
  ok('SOLVE', r.mix.every((p, i) => p < 1e-9 || Math.abs(vs[i] - r.value) < 1e-6), 'a support option does not earn v*');
  ok('SOLVE', r.spread.row_vsUniform_range > 0.02, 'the options barely differ against a uniform opponent: ' + r.spread.row_vsUniform_range);
}

/* ---------------- BO3 ---------------- */
if (want('BO3')) {
  const C1 = require('../chomp/v1/chomp1.js');
  const rates = C1.bo3Rates();
  const y = new Array(O.N).fill(1 / O.N);
  for (const won of [true, false]) {
    const prev = { brought: [0, 2, 3, 5], leads: [2, 5], won };
    const M = C1.oppModel(prev, y, rates);
    const tot = M.q.reduce((s, v) => s + v, 0);
    const onFour = M.q.reduce((s, v, i) => s + (O.fourOf[i] === '0235' ? v : 0), 0);
    const want4 = rates.same_four[won ? 'won' : 'lost'];
    ok('BO3', Math.abs(tot - 1) < 1e-9, 'q sums to ' + tot);
    ok('BO3', Math.abs(onFour - want4) < 1e-9, (won ? 'won' : 'lost') + ': mass on their last four ' + onFour + ' is not s4 ' + want4);
  }
  ok('BO3', rates.same_four.won > rates.same_four.lost, 'bo3.json no longer says winners repeat more than losers');
  const CH = C1.create({ API });
  const r = CH.solve({ mine: S1, theirs: S2 }, { series: { oppLast: { brought: [0, 1, 2, 3], leads: [0, 1], won: true } } });
  ok('BO3', r.bo3 && Math.abs(r.mix.reduce((s, p) => s + p, 0) - 1) < 1e-9, 'no bo3 receipt or a mix that does not sum to 1');
  ok('BO3', r.bo3 && r.bo3.v_adj_vs_q >= r.bo3.v_eq_vs_q - 1e-12, 'the adjusted mix does worse against q than the equilibrium');
  ok('BO3', r.bo3 && Math.abs(r.mix[r.bo3.br] - (0.5 * r.eqMix[r.bo3.br] + 0.5)) < 1e-9, 'the adjusted mix is not (1 - lambda) x + lambda BR');
}

/* ---------------- WIRING ---------------- */
if (want('WIRING')) {
  const PV = require('../chomp/arms.js').create({ API });
  const G = { id: 'fixture', sheets: { p1: S1, p2: S2 }, brought: { p1: [0, 1, 2, 3], p2: [0, 1, 2, 3] } };
  const pick = PV.choose('chomp1', G, 'p1', 11);
  ok('WIRING', PV.COUNTERS.chomp1Solves === 1 && O.indexOf(pick.order) === pick.info.option && pick.info.p > 0, 'arm chomp1: ' + JSON.stringify(pick.info));
  PV.choose('chomp1', G, 'p1', 12);
  ok('WIRING', PV.COUNTERS.chomp1Cached === 1, 'arm chomp1 re-solved a cached (pair, side)');
  /* ROTOM's hook, as test-chomp.js ROTOM drives it */
  const PFX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rotom', 'preview.json'), 'utf8'));
  const RQ = require('../rotom/request.js');
  const REQ = PFX.req, me = PFX.me;
  const sheets = PFX.sheets;
  const P = require('../rotom/policy.js').create({ API, PA: null, R: null, tables: null });
  const d = { req: REQ, coin: API.M.rngStreams({ seed: 3 }).any, sheets, me, budgetMs: 60000 };
  const r = P.previewChomp(d);
  const mySheet = sheets[me];
  const choice = RQ.previewChoice(r.order.map(x => RQ.posOfSheet(REQ, mySheet, x - 1)));
  ok('WIRING', RQ.isLegal(REQ, choice), 'the hook\'s choice is not legal: ' + choice);
  ok('WIRING', r.info && r.info.model === 'chomp1.json', 'the --preview hook did not answer from CHOMP v1: ' + JSON.stringify(r.info));
  const r2 = P.previewChomp(Object.assign({}, d, { series: { oppLast: { brought: [0, 1, 2, 3], leads: [0, 1], won: false } } }));
  ok('WIRING', r2.info && r2.info.bo3 === true, 'a game-2 request was not bo3-adjusted through the hook: ' + JSON.stringify(r2.info));
}

/* ---------------- deliberate breaks ---------------- */
if (!NO_RED && !ONLY) {
  for (const [env, clause] of [[{ CHOMP1_BREAK: 'leads' }, 'FEATURES'], [{ CHOMP1_BREAK: 'sign' }, 'ANTISYM'], [{ CHOMP1_BREAK: 'sign' }, 'PARITY'],
                               [{ SLOWKING_BREAK: 'lpdual' }, 'SOLVE'], [{ CHOMP1_BREAK: 'bo3' }, 'BO3'], [{ CHOMP_VERSION: 'v0' }, 'WIRING']]) {
    const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--only=' + clause], { env: Object.assign({}, process.env, env), encoding: 'utf8', timeout: 900000 });
    const red = r.status !== 0 && new RegExp('FAIL \\[' + clause + '\\]').test(r.stdout || '');
    ok('BREAKS', red, JSON.stringify(env) + ' did not turn ' + clause + ' red (exit ' + r.status + ')');
    console.log('  red check ' + JSON.stringify(env) + ' -> ' + (red ? 'RED as required' : 'NOT RED'));
  }
}
console.log((fails ? 'RED' : 'GREEN') + ' test-chomp1: ' + (checks - fails) + '/' + checks + (fails ? '  failed: ' + [...failed].join(', ') : '') + '  (' + (ENGINE.id || 'live tree') + ')');
process.exit(fails ? 1 : 0);
