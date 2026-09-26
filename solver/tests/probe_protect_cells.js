/* solver/tests/probe_protect_cells.js — INSIDE THE CELLS: WHY DOES A REPEAT-PROTECT ROW WIN MIX MASS?
 * (2026-09-27, docs/_reports/2026-09-27-protect-repeat-fix.md)
 *
 *   node solver/tests/probe_protect_cells.js [--release eaa5becc54eb] [--positions 40] [--passes 96] [--seed 7] [--json out.json]
 *
 * A MEASUREMENT: prints and exits 0. The positions are probe_protect_passes.js's (TEST pairs walked by the human clone,
 * a side-A body carrying the consecutive-Protect counter with its Protect legal), and the search is gen5's (k 4x4,
 * depth 0, PORYGON2 gen5 leaf). At every position whose candidate rows hold a repeat, the table is filled HERE, by an
 * instrumented copy of MILTANK's pass (the same world draw, the same CRN seed per pass, the same lean playout), so each
 * repeat-row playout also reports whether the stall die let the Protect up. Per position:
 *   se      the per-cell standard error of the mean (the noise candidate)
 *   succ    the share of repeat-row playouts whose Protect went up, beside the engine's own 1/3^n (the die candidate)
 *   mass    the row-mix mass on repeat rows of the solved table, as MILTANK would solve it
 *   fail    the mass when every repeat-row cell is scored on its FAILED playouts only: the repeat's value comes from
 *           the success branch, and how much it is worth there is what the leaf believes (the depth-0 candidate)
 *   horizon the success-branch value decomposed: how much of it is a body the leaf counts alive that the SAME column,
 *           one turn later, would have knocked out anyway (the horizon candidate), read by playing the success branch
 *           one more turn with both sides repeating their joint
 *   dup     how many of the 4 rows are repeat rows (the row-sharing candidate)
 */
'use strict';
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const NPOS = +flag('--positions', 40);
const PASSES = +flag('--passes', 96);
const SEED = +flag('--seed', 7);
const JSON_OUT = flag('--json', null);
const path = require('path');
const fs = require('fs');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const FAM = require('../arena/protect_stats.js').family();
const SK = require('../slowking/matrix.js');
const C = require('../miltank/cells.js');
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const R = AGm.R;
const ROOT = path.join(__dirname, '..', '..');
const G5 = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8')));
const CL = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
const P = require('../mew/pairs.js').load({ teamStore: 'data/team-pool-frozen-regmc' });
const live = m => !!(m && !m.fainted && m.curHP > 0);
const leafCtx = { mode: 'pory2', sheets: null, model: path.join(ROOT, G5.spec.pory2) };

function solveMass(A, isRepRow) {
  const s = SK.solveRM(A, { iters: 4000, tol: 1e-4 });
  return { mass: s.x.reduce((a, v, i) => a + (isRepRow[i] ? v : 0), 0), x: Array.from(s.x), y: Array.from(s.y), value: s.value };
}

function instrumentedPlay(Wp, jA, jB, seed, k, idx, twice) {
  const S = R.copy(Wp);
  API.makeLean(S);
  return API.leanRun(() => {
    const rng = R.dice(seed);
    const before = S.sfA.team[idx].tookProtectTurns | 0;
    API.stepInPlace(S, jA, jB, rng);
    const b = S.sfA.team[idx];
    const up = (b.tookProtectTurns | 0) > before;
    const v = R.leaf(S, leafCtx);
    let v2 = null, alive1 = live(b), alive2 = null;
    if (twice && up && !API.isTerminal(S)) {
      /* one more turn: the opponent repeats its column's joint (retargeted by the engine if needed), we repeat our non-protect slot and
       * our protected body attacks with its first legal non-family move — "what the column does to the protector one turn later" */
      try {
        const la = API.legalActions(S, 'A'), lb = API.legalActions(S, 'B');
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const pickB = lb.joint.find(j => same(j, jB)) || lb.joint[0];
        const pickA = la.joint.find(j => j[k] && j[k].kind === 'move' && !FAM.has(j[k].move)) || la.joint[0];
        API.stepInPlace(S, pickA, pickB, rng);
        v2 = R.leaf(S, leafCtx); alive2 = live(S.sfA.team[idx]);
      } catch (e) { v2 = null; }
    }
    return { v, up, alive1, v2, alive2 };
  });
}

const rows_out = [];
let n = 0, offered = 0;
for (let g = 0; n < NPOS && g < P.test.length * 3; g++) {
  const G = P.test[(g * 13 + SEED) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(SEED * 1000 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA0.newGame(G);
  leafCtx.sheets = ctx.G.sheets;
  const bA = CL.bot(1), bB = CL.bot(2);
  for (let t = 0; t < 14 && !API.isTerminal(S) && n < NPOS; t++) {
    const k = S.actA.findIndex(m => live(m) && m.tookProtectTurns >= 1);
    if (k >= 0) {
      const la = API.legalActions(S, 'A');
      const rep = la.slots[k].options.some(o => o.kind === 'move' && FAM.has(o.move));
      if (rep) {
        n++;
        const isRep = j => j[k] && j[k].kind === 'move' && FAM.has(j[k].move);
        const MT = require('../miltank/search.js').create(API, { prior: G5.PA, rollout: R });
        const coin = M.rngStreams({ seed: 99 + n }).any;
        const r = MT.decide(S, 'A', ctx, { budgetMs: 600000, maxPasses: 1, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2', leafModel: leafCtx.model, coin, record: true });
        if (r.info && r.info.rec && r.info.rec.rows.some(isRep)) {
          offered++;
          const rows = r.info.rec.rows, cols = r.info.rec.cols, m = rows.length, nn = cols.length;
          const idx = S.sfA.team.indexOf(S.actA[k]);
          const counter = S.actA[k].tookProtectTurns;
          const isRepRow = rows.map(isRep);
          const belief = { sheet: ctx.G.sheets.p2, revealed: G5.PA.revealed(S, 'B') };
          const baseSeed = 12345 + n * 7;
          const vals = Array.from({ length: m }, () => Array.from({ length: nn }, () => []));
          const valsFail = Array.from({ length: m }, () => Array.from({ length: nn }, () => []));
          const valsUp = Array.from({ length: m }, () => Array.from({ length: nn }, () => []));
          let ups = 0, tries = 0, upAliveDeadNext = 0, upAlive = 0, dUpNext = [], upGain = [];
          for (let p = 0; p < PASSES; p++) {
            const seed = baseSeed + p * C.STRIDE;
            const wcoin = M.rngStreams({ seed: seed + 1 }).any;
            const W = R.prepare(R.sampleWorld(S, 'B', belief, wcoin));
            for (let i = 0; i < m; i++) for (let j = 0; j < nn; j++) {
              const o = instrumentedPlay(W, rows[i], cols[j], seed, k, idx, isRepRow[i]);
              vals[i][j].push(o.v);
              if (isRepRow[i]) {
                tries++; if (o.up) { ups++; valsUp[i][j].push(o.v); if (o.alive1) { upAlive++; if (o.alive2 === false) upAliveDeadNext++; } if (o.v2 != null) dUpNext.push(o.v2 - o.v); }
                else valsFail[i][j].push(o.v);
              }
            }
          }
          const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
          const A = vals.map(r => r.map(mean));
          const se = vals.map(r => r.map(xs => { const mu = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1) / xs.length); }));
          const Afail = A.map((r, i) => r.map((v, j) => (isRepRow[i] ? (valsFail[i][j].length ? mean(valsFail[i][j]) : v) : v)));
          /* the success branch forced (as if the counter were 0): the value of a sure Protect */
          const Aup = A.map((r, i) => r.map((v, j) => (isRepRow[i] ? (valsUp[i][j].length ? mean(valsUp[i][j]) : v) : v)));
          const sol = solveMass(A, isRepRow), solF = solveMass(Afail, isRepRow), solU = solveMass(Aup, isRepRow);
          /* half the passes vs the other half: does the mix move? (noise) */
          const half = h => vals.map(r => r.map(xs => mean(xs.filter((_, q) => q % 2 === h))));
          const s0 = solveMass(half(0), isRepRow), s1 = solveMass(half(1), isRepRow);
          const allSe = se.flat(); allSe.sort((a, b) => a - b);
          /* per-row value vs the solved column mix, and the gap best repeat − best other */
          const Ay = A.map(r => r.reduce((a, v, j) => a + v * sol.y[j], 0));
          let br = -1, bo = -1; Ay.forEach((v, i) => { if (isRepRow[i]) br = Math.max(br, v); else bo = Math.max(bo, v); });
          const out = { n, game: g, turn: t, slot: k, counter, expect_up: 1 / Math.pow(3, counter), dup: isRepRow.filter(Boolean).length,
            rows: rows.map(j => j.map(o => o && (o.kind === 'move' ? o.move + (o.target != null ? '@' + o.target : '') + (o.mega ? '+M' : '') : o.kind === 'switch' ? 'sw' + o.to : o.kind))),
            cols: cols.map(j => j.map(o => o && (o.kind === 'move' ? o.move + (o.target != null ? '@' + o.target : '') : o.kind === 'switch' ? 'sw' + o.to : o.kind))),
            succ: +(ups / tries).toFixed(3), se_median: +allSe[allSe.length >> 1].toFixed(4), se_max: +allSe[allSe.length - 1].toFixed(4),
            mass: +sol.mass.toFixed(3), mass_half0: +s0.mass.toFixed(3), mass_half1: +s1.mass.toFixed(3), mass_failonly: +solF.mass.toFixed(3), mass_sureprotect: +solU.mass.toFixed(3),
            gap: +(br - bo).toFixed(4), value: +sol.value.toFixed(4), x: sol.x.map(v => +v.toFixed(3)), y: sol.y.map(v => +v.toFixed(3)),
            A: A.map(r => r.map(v => +v.toFixed(4))), Aup: Aup.map(r => r.map(v => +v.toFixed(4))), Afail: Afail.map(r => r.map(v => +v.toFixed(4))),
            up_alive: upAlive, up_alive_dead_next: upAliveDeadNext, up_next_dv_mean: dUpNext.length ? +mean(dUpNext).toFixed(4) : null };
          rows_out.push(out);
          console.log(`  pos ${n} g${g} t${t} slot ${k} counter ${counter}: dup ${out.dup}/4, succ ${out.succ} (engine ${out.expect_up.toFixed(3)}), se med ${out.se_median} max ${out.se_max}, mass ${out.mass} (halves ${out.mass_half0}/${out.mass_half1}), fail-only ${out.mass_failonly}, sure-protect ${out.mass_sureprotect}, gap ${out.gap}, up&alive ${upAlive} -> dead next ${upAliveDeadNext}, dv next ${out.up_next_dv_mean}`);
        }
      }
    }
    const jA = bA.choose(S, 'A', ctx).joint, jB = bB.choose(S, 'B', ctx).joint;
    PA0.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
const avg = k => rows_out.reduce((a, r) => a + r[k], 0) / Math.max(1, rows_out.length);
console.log(`\n  positions ${n}; repeat offered in ${offered}; passes ${PASSES}`);
for (const k of ['succ', 'expect_up', 'se_median', 'se_max', 'mass', 'mass_half0', 'mass_half1', 'mass_failonly', 'mass_sureprotect', 'dup']) console.log(`  mean ${k.padEnd(18)} ${avg(k).toFixed(4)}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ release: ENGINE.stamp.engine_release || REL, passes: PASSES, positions: n, offered, rows: rows_out }, null, 1));
