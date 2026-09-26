/* solver/tests/test-chomp.js — CHOMP v0, the team-preview solver.
 *
 *   node solver/tests/test-chomp.js [--no-red]      exit 0 = GREEN, 1 = RED
 *   env CHOMP_TEST_RELEASE=<id>   play on a frozen release (default: the live tree — this tests code, not a figure)
 *
 * Sheets are REAL Reg M-C open sheets from ROTOM's validated team pool (solver/rotom/teams/regmc-pool.json) and the
 * ROTOM preview fixture; nothing here names or types a Pokemon fact.
 *
 *   OPTIONS   90 distinct options, each four distinct sheet members, two leads; indexOf inverts every one, ignoring
 *             lead order and back order; 15 lead pairs of 6 options each.
 *   MEMO      the memoised scorer returns EXACTLY the unmemoised scorer's cells (two lead-pair blocks, 72 cells).
 *   BACK      every checked cell equals PORYGON2 on the FULL battle of that cell (the real four in order, the back
 *             two marked seen): the lead-only battle plus the written-in bench entries loses nothing. And the back
 *             pair MOVES the value (some block has cells that differ) — a table blind to the bring would pass the
 *             equality and fail this.
 *   SOLVE     on a real matchup: 8,100 cells scored, the mix sums to 1, its exploitability in its own table is
 *             ~0, no option beats v* against their mix and every support option earns v* (the equilibrium
 *             conditions, read from the table, not from the solver's own report); the table is in (0, 1).
 *   REFINE    a small refinement plays playouts (counter > 0) through the PORYGON2 leaf, and a re-run on the same
 *             seed returns the identical refined table (common random numbers, deterministic).
 *   ARMS      random: all 90 options drawn, none far from uniform; human: the recorded bring; chomp: the sampled
 *             option frequencies follow the mix.
 *   ROTOM     policy.previewChomp answers the preview fixture with a legal `team ....`, the chosen request positions
 *             hold the chosen sheet members, and the counter moves.
 *
 * Deliberate breaks, each must turn this RED (run unless --no-red): CHOMP_BREAK=memokey (MEMO), CHOMP_BREAK=back
 * (BACK), SLOWKING_BREAK=lpdual (SOLVE), ROTOM_BREAK=posmap (ROTOM).
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
const API = ENGINE.API, M = API.M;
const O = require('../chomp/options.js');
const { parseShowteam } = require('../human/parse_game.js');
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rotom', 'teams', 'regmc-pool.json'), 'utf8'));
const sheetOf = k => parseShowteam(POOL.teams[k].packed);
const PFX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rotom', 'preview.json'), 'utf8'));

/* ---------------- OPTIONS ---------------- */
if (want('OPTIONS')) {
  ok('OPTIONS', O.N === 90 && new Set(O.OPTIONS.map(o => o.order.join(''))).size === 90, 'not 90 distinct options');
  ok('OPTIONS', O.OPTIONS.every(o => new Set(o.order).size === 4 && o.order.every(x => x >= 0 && x < 6) && o.leads.length === 2), 'a malformed option');
  ok('OPTIONS', O.OPTIONS.every((o, i) => O.indexOf(o.order) === i && O.indexOf([o.leads[1], o.leads[0], o.back[1], o.back[0]]) === i), 'indexOf does not invert');
  ok('OPTIONS', O.indexOf([0, 0, 1, 2]) === -1 && O.indexOf([0, 1, 2]) === -1, 'indexOf accepted a bad order');
  ok('OPTIONS', O.leadPairs.length === 15 && O.leadPairs.every((p, k) => O.leadPairOf.filter(x => x === k).length === 6), 'lead pairs');
  ok('OPTIONS', new Set(O.fourOf).size === 15, 'fifteen fours');
}

/* ---------------- MEMO + BACK ---------------- */
const sheets = { p1: sheetOf(0), p2: sheetOf(1) };
if (want('MEMO') || want('BACK')) {
  const SCm = require('../chomp/score.js').create(API, {});
  const SCn = require('../chomp/score.js').create(API, { memo: false });
  const only = { la: [0, 9], lb: [3, 14] };
  const a = SCm.table(sheets, { only }), b = SCn.table(sheets, { only });
  let n = 0, maxd = 0;
  for (let i = 0; i < 90; i++) for (let j = 0; j < 90; j++) if (!Number.isNaN(b.A[i][j])) { n++; maxd = Math.max(maxd, Math.abs(a.A[i][j] - b.A[i][j])); }
  if (want('MEMO')) {
    ok('MEMO', n === 4 * 36, 'scored ' + n + ' cells, expected 144');
    ok('MEMO', maxd === 0, 'memoised cells differ from the engine by ' + maxd);
    ok('MEMO', SCm.COUNTERS.dmgMemoHits > 0 && SCn.COUNTERS.dmgMemoHits === 0, 'memo counters: ' + SCm.COUNTERS.dmgMemoHits + ' / ' + SCn.COUNTERS.dmgMemoHits);
  }
  if (want('BACK')) {
    /* the full battle for sampled cells, through the same PORYGON2 pipeline (porygon2/leaf.js encode) */
    const T = require('../arena/teams.js');
    const PA = require('../miltank/prior_adapter.js').create(API, null);
    const F = require('../porygon2/features.js').create(M);
    const NET = require('../porygon2/infer.js').load();
    const body = (sd, s) => { const x = T.buildBody(M, sheets[sd][s]); x._solverSheet = s; return x; };
    let worst = 0, cellsChecked = 0;
    for (let i = 0; i < 90; i++) for (let j = 0; j < 90; j++) {
      if (Number.isNaN(a.A[i][j]) || (i * 7 + j) % 5) continue;
      const S = API.newBattle(O.OPTIONS[i].order.map(s => body('p1', s)), O.OPTIONS[j].order.map(s => body('p2', s)), { rng: API.makeRng(1) });
      for (const sf of [S.sfA, S.sfB]) for (const m of sf.team) if (!S.actA.includes(m) && !S.actB.includes(m)) m._wasOut = true;
      const v = NET.value(F.encode(F.fromEngine(PA, S, sheets)));
      worst = Math.max(worst, Math.abs(v - a.A[i][j])); cellsChecked++;
    }
    ok('BACK', cellsChecked >= 20, 'checked only ' + cellsChecked + ' cells');
    ok('BACK', worst < 1e-12, 'a cell differs from its full battle by ' + worst);
    /* the bring matters: inside one lead-pair block, the back pairs do not all tie */
    let spread = 0;
    for (const la of only.la) for (const lb of only.lb) {
      const vals = [];
      O.OPTIONS.forEach((op, i) => { if (O.leadPairOf[i] !== la) return; O.OPTIONS.forEach((oq, j) => { if (O.leadPairOf[j] === lb) vals.push(a.A[i][j]); }); });
      spread = Math.max(spread, Math.max(...vals) - Math.min(...vals));
    }
    ok('BACK', spread > 1e-4, 'the back two never move a cell (spread ' + spread + '): the table cannot see the bring');
  }
}

/* ---------------- SOLVE ---------------- */
let CH = null, R = null;
if (want('SOLVE') || want('ARMS') || want('REFINE')) {
  CH = require('../chomp/chomp.js').create({ API });
  R = CH.solve({ mine: sheets.p1, theirs: sheets.p2 }, { keepTable: true });
}
if (want('SOLVE')) {
  const A = R.table;
  ok('SOLVE', R.counters.cells === 8100 && A.every(r => r.every(v => v > 0 && v < 1)), 'cells ' + R.counters.cells + ' / a value outside (0,1)');
  const sx = R.mix.reduce((s, v) => s + v, 0), sy = R.oppMix.reduce((s, v) => s + v, 0);
  ok('SOLVE', Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9 && R.mix.every(v => v >= 0), 'mix does not sum to 1: ' + sx + ' / ' + sy);
  const vs = A.map(r => r.reduce((s, v, j) => s + v * R.oppMix[j], 0));
  const colv = A[0].map((_, j) => A.reduce((s, r, i) => s + r[j] * R.mix[i], 0));
  const v = R.value;
  ok('SOLVE', Math.max(...vs) <= v + 1e-9, 'an option beats v* against their mix by ' + (Math.max(...vs) - v));
  ok('SOLVE', Math.min(...colv) >= v - 1e-9, 'their best reply holds my mix under v* by ' + (v - Math.min(...colv)));
  ok('SOLVE', R.support.every(s => Math.abs(vs[s.i] - v) < 1e-9), 'a support option does not earn v*');
  ok('SOLVE', R.exploit.mix < 1e-9 && R.exploit.greedy.value >= -1e-12 && R.exploit.uniform >= -1e-12, 'exploitability ' + JSON.stringify(R.exploit));
  ok('SOLVE', R.support.length >= 1 && R.support.every(s => /\//.test(s.label)), 'support labels');
  ok('SOLVE', R.counters.lpPivots > 0 && R.counters.dmgMemoHits > 0, 'counters ' + JSON.stringify(R.counters));
}

/* ---------------- REFINE ---------------- */
if (want('REFINE')) {
  const RF = require('../chomp/refine.js').create(API);
  const o = { rows: 2, cols: 2, playouts: 2, depth: 1, rounds: 1, seed: 3 };
  const r1 = RF.refine(sheets, R.table, o), r2 = RF.refine(sheets, R.table, o);
  ok('REFINE', r1.playouts > 0 && r1.cells > 0 && RF.R.COUNTERS.leafPory2 > 0, 'refinement played ' + r1.playouts + ' playouts, pory2 leaves ' + RF.R.COUNTERS.leafPory2);
  let same = true; for (let i = 0; i < 90; i++) for (let j = 0; j < 90; j++) if (r1.A2[i][j] !== r2.A2[i][j]) same = false;
  ok('REFINE', same, 'the same seed gave a different refined table');
  let moved = 0; for (const k of r1.samples.keys()) { const i = Math.floor(k / 90), j = k % 90; if (r1.A2[i][j] !== R.table[i][j]) moved++; }
  ok('REFINE', moved > 0, 'no refined cell moved');
}

/* ---------------- ARMS ---------------- */
if (want('ARMS')) {
  const PV = require('../chomp/arms.js').create({ API });
  const G = { id: 'test', sheets, brought: { p1: [3, 1, 0, 5], p2: [0, 1, 2, 3] } };
  const cnt = new Array(90).fill(0);
  for (let s = 0; s < 9000; s++) cnt[PV.choose('random', G, 'p1', 1000 + s).info.option]++;
  ok('ARMS', cnt.every(c => c > 50 && c < 160), 'random arm is not uniform over 90: min ' + Math.min(...cnt) + ' max ' + Math.max(...cnt));
  ok('ARMS', PV.choose('human', G, 'p1', 1).order.join() === '3,1,0,5', 'human arm');
  /* chomp arm: sampled with the mix in a stubbed cache */
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'chomp-arm-'));
  fs.mkdirSync(path.join(dir, 'tables'));
  const mix = new Array(90).fill(0); mix[7] = 0.7; mix[40] = 0.3;
  fs.writeFileSync(path.join(dir, 'tables', 'shard-0-of-1.jsonl'), JSON.stringify({ key: 'test|p1|p', result: { mix, value: 0.5, win_vsMix: new Array(90).fill(0.5) } }) + '\n');
  const PV2 = require('../chomp/arms.js').create({ API, cacheDir: dir });
  const c2 = {}; for (let s = 0; s < 2000; s++) { const i = PV2.choose('chomp', G, 'p1', 50 + s).info.option; c2[i] = (c2[i] || 0) + 1; }
  ok('ARMS', Object.keys(c2).sort().join() === '40,7' && Math.abs(c2[7] / 2000 - 0.7) < 0.04, 'chomp arm does not follow its mix: ' + JSON.stringify(c2));
  ok('ARMS', PV2.COUNTERS.chompCached === 2000 && PV2.COUNTERS.chompInline === 0, 'chomp arm counters ' + JSON.stringify(PV2.COUNTERS));
  fs.rmSync(dir, { recursive: true, force: true });
}

/* ---------------- ROTOM ---------------- */
if (want('ROTOM')) {
  const RQ = require('../rotom/request.js');
  const P = require('../rotom/policy.js').create({ API, PA: null, R: null, tables: null });
  /* CONSTRUCTED: the recorded request lists the team in sheet order, which would let an unmapped position pass.
   * The server may list it in any order, so the same request with the party reversed is the fixture. */
  const REQ = JSON.parse(JSON.stringify(PFX.req)); REQ.side.pokemon.reverse();
  const d = { req: REQ, sheets: PFX.sheets, me: PFX.me, budgetMs: 600000, coin: M.rngStreams({ seed: 9 }).any };
  const r = P.previewChomp(d);
  const mySheet = PFX.sheets[PFX.me];
  const pos = r.order.map(x => RQ.posOfSheet(REQ, mySheet, x - 1));
  const choice = RQ.previewChoice(pos);
  ok('ROTOM', RQ.isLegal(REQ, choice), 'CHOMP preview choice not legal: ' + choice);
  const names = pos.map(p => String(REQ.side.pokemon[p - 1].ident).replace(/^p[12]:\s*/, ''));
  ok('ROTOM', names.join() === r.order.map(x => mySheet[x - 1].nick).join(), 'request positions do not hold the chosen members: ' + names + ' vs ' + r.order.map(x => mySheet[x - 1].nick));
  ok('ROTOM', P.COUNTERS.chompSolves === 1 && r.info.chomp && r.info.cells === 8100, 'chomp counter / info ' + JSON.stringify(r.info));
  ok('ROTOM', process.env.ROTOM_BREAK === 'posmap' || mySheet.some((row, s) => RQ.posOfSheet(REQ, mySheet, s) !== s + 1), 'the fixture request lists the team in sheet order, so the mapping is untested');
  let threw = null; try { P.previewChomp(Object.assign({}, d, { budgetMs: 1 })); } catch (e) { threw = e; }
  ok('ROTOM', threw && /over budget/.test(threw.message), 'an exhausted budget did not throw: ' + (threw && threw.message));
}

/* ---------------- RED ---------------- */
if (!NO_RED && !ONLY) {
  for (const [env, clause] of [[{ CHOMP_BREAK: 'memokey' }, 'MEMO'], [{ CHOMP_BREAK: 'back' }, 'BACK'], [{ SLOWKING_BREAK: 'lpdual' }, 'SOLVE'], [{ ROTOM_BREAK: 'posmap' }, 'ROTOM']]) {
    const r = cp.spawnSync(process.execPath, [__filename, '--no-red', '--only=' + clause], { env: Object.assign({}, process.env, env), encoding: 'utf8', timeout: 900000 });
    const red = r.status === 1 && new RegExp('FAIL \\[' + clause + '\\]').test(r.stdout);
    ok('RED', red, JSON.stringify(env) + ' did not turn ' + clause + ' red (exit ' + r.status + ')\n' + (r.stdout || '').slice(-600) + (r.stderr || '').slice(-400));
    console.log('  red check ' + JSON.stringify(env) + ' -> ' + (red ? 'RED as required' : 'NOT RED'));
  }
}

console.log((fails ? 'RED' : 'GREEN') + ' test-chomp: ' + (checks - fails) + '/' + checks + (fails ? '  failing: ' + [...failed].join(', ') : '') + (ENGINE.id ? '  (release ' + ENGINE.id + ')' : '  (live tree)'));
process.exit(fails ? 1 : 0);
