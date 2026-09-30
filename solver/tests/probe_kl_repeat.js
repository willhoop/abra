/* solver/tests/probe_kl_repeat.js — THE OFFERED-REPEAT-PROTECT POSITIONS (the 1.23.0 probe set) UNDER THE HUMAN-REGULARISED
 * SOLVE: the mix mass on rows that repeat a Protect, at each lambda. (2026-09-30, docs/_reports/2026-09-30-human-regularised-search.md)
 *
 *   node solver/tests/probe_kl_repeat.js [--release eaa5becc54eb] [--positions 40] [--passes 48] [--seed 7]
 *        [--grid 0,0.001,0.003,0.01,0.03,0.1,0.3,inf] [--team-store <main checkout>/data/team-pool-frozen-regmc] [--out <json>]
 *
 * A MEASUREMENT: prints and exits 0. The positions are solver/tests/probe_protect_passes.js's, walked the same way (TEST
 * pairs of the frozen pool, index (g*13 + seed) mod n, both sides the human clone, rng seed*1000 + g, up to 14 turns): a
 * position qualifies when a side-A active body carries the consecutive-Protect counter (`tookProtectTurns` >= 1) and
 * may click a protect-family move. At each, gen5's search (k 4x4, depth 0, one reserved switch row, PORYGON2 gen5 leaf)
 * fills `--passes` passes on coin 99 + n — probe_protect_passes.js's `base` variant, whose 48-pass reading was 0.611 on 13
 * offered positions (docs/_reports/2026-09-27-protect-repeat-fix.md) — and records the root once. The lambda grid is
 * solved OFFLINE on that one table per position (0 = the plain solve, inf = the anchor). Reported per lambda, over the
 * positions whose rows hold a repeat: the mean row-mix mass on repeat rows, the argmax a repeat, and DODUO's own
 * (the anchor's) mass on those rows for reference.
 */
'use strict';
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const NPOS = +flag('--positions', 40);
const PASSES = +flag('--passes', 48);
const SEED = +flag('--seed', 7);
const GRID = String(flag('--grid', '0,0.001,0.003,0.01,0.03,0.1,0.3,inf')).split(',').map(s => (s === 'inf' ? Infinity : +s));
const STORE = flag('--team-store', 'C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc');
const OUTF = flag('--out', null);
const path = require('path');
const fs = require('fs');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const FAM = require('../arena/protect_stats.js').family();
const SK = require('../slowking/matrix.js');
const SEARCH = require('../miltank/search.js');
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const ROOT = path.join(__dirname, '..', '..');
const G5 = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8')));
const CL = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
const P = require('../mew/pairs.js').load({ teamStore: STORE });
const live = m => !!(m && !m.fainted && m.curHP > 0);
const key = o => (!o ? '-' : o.kind === 'switch' ? 'sw' + o.to : o.kind === 'move' ? o.move + (o.target != null ? '@' + o.target : '') + (o.mega ? '+M' : '') : o.kind);

const positions = [];
let n = 0;
for (let g = 0; n < NPOS && g < P.test.length * 3; g++) {
  const G = P.test[(g * 13 + SEED) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(SEED * 1000 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA0.newGame(G);
  const bA = CL.bot(1), bB = CL.bot(2);
  for (let t = 0; t < 14 && !API.isTerminal(S) && n < NPOS; t++) {
    const k = S.actA.findIndex(m => live(m) && m.tookProtectTurns >= 1);
    if (k >= 0) {
      const la = API.legalActions(S, 'A');
      if (la.slots[k].options.some(o => o.kind === 'move' && FAM.has(o.move))) {
        const isRep = j => !!(j[k] && j[k].kind === 'move' && FAM.has(j[k].move));
        const MT = SEARCH.create(API, { prior: G5.PA, rollout: AGm.R });
        const r = MT.decide(S, 'A', ctx, { budgetMs: 600000, maxPasses: PASSES, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2',
          leafModel: path.join(ROOT, G5.spec.pory2), coin: M.rngStreams({ seed: 99 + n }).any, record: true });
        if (r.info && r.info.rec) {
          const rec = r.info.rec;
          positions.push({ n, pair: G.id, turn: S.turn, slot: k, body: S.actA[k].name, counter: S.actA[k].tookProtectTurns, rows: rec.rows.map(j => j.map(key).join(' | ')), rep: rec.rows.map(isRep),
            cols: rec.cols.map(j => j.map(key).join(' | ')), A: rec.A, tauRow: rec.tauRow, tauCol: rec.tauCol, x_live: rec.x, value: r.info.value });
        }
        n++;
        if (S.actA[k].tookProtectTurns < 1) throw new Error('probe mutated the battle');
      }
    }
    const jA = bA.choose(S, 'A', ctx).joint, jB = bB.choose(S, 'B', ctx).joint;
    PA0.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
const offered = positions.filter(p => p.rep.some(Boolean));
console.log(`  positions ${n}; a repeat row among the candidates in ${offered.length}; ${PASSES} passes, gen5 k 4x4 depth 0`);
const res = { release: ENGINE.stamp && ENGINE.stamp.engine_release, positions: n, offered: offered.length, passes: PASSES, seed: SEED, team_store: STORE, grid: GRID.map(v => (v === Infinity ? 'inf' : v)), byLambda: {}, detail: [] };
const perPos = offered.map(p => ({ n: p.n, body: p.body, counter: p.counter, rows: p.rows, rep: p.rep, value: +(+p.value).toFixed(4), mass: {} }));
for (const lam of GRID) {
  let mass = 0, am = 0;
  offered.forEach((p, i) => {
    const m = p.rows.length, nn = p.cols.length;
    const tr = SEARCH.anchorOf(p.tauRow) || new Array(m).fill(1 / m), tc = SEARCH.anchorOf(p.tauCol) || new Array(nn).fill(1 / nn);
    const x = lam === 0 ? SK.solveRM(p.A, { iters: 4000, tol: 1e-4 }).x : lam === Infinity ? tr : SK.solveKL(p.A, { tauRow: tr, tauCol: tc, lambda: lam, iters: 4000, tol: 1e-5 }).x;
    const q = x.reduce((s, v, k) => s + (p.rep[k] ? v : 0), 0);
    let a = 0; for (let k = 1; k < m; k++) if (x[k] > x[a]) a = k;
    mass += q; if (p.rep[a]) am++;
    perPos[i].mass[lam === Infinity ? 'inf' : lam] = +q.toFixed(3);
  });
  const L = lam === Infinity ? 'inf' : lam;
  res.byLambda[L] = { repeat_mass_when_offered: +(mass / Math.max(1, offered.length)).toFixed(3), argmax_repeat: am, of: offered.length };
  console.log(`  lambda ${String(L).padEnd(6)} mean mix mass on repeat rows (offered) ${(mass / Math.max(1, offered.length)).toFixed(3)}   argmax a repeat ${am}/${offered.length}`);
}
const liveMass = offered.reduce((s, p) => s + p.x_live.reduce((q, v, k) => q + (p.rep[k] ? v : 0), 0), 0) / Math.max(1, offered.length);
res.live_solve_repeat_mass = +liveMass.toFixed(3);
console.log(`  (the search's own solve on the same tables, lambda 0 as it ran: ${liveMass.toFixed(3)})`);
res.detail = perPos;
if (OUTF) { fs.mkdirSync(path.dirname(path.resolve(OUTF)), { recursive: true }); fs.writeFileSync(OUTF, JSON.stringify(res, null, 1)); console.log('  wrote ' + OUTF); }
