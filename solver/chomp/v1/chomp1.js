/* solver/chomp/v1/chomp1.js — CHOMP v1, the team-preview solver. Both open sheets in; a mixed strategy over the 90
 * bring/lead options out. The interface is v0's (solver/chomp/chomp.js), so ROTOM's --preview hook and the arena read
 * either one.
 *
 *   const CH = require('./solver/chomp/v1/chomp1.js').create({ API } | { release })
 *   const r  = CH.solve({ mine, theirs }[, { deadline, series: { oppLast } }])
 *   const op = CH.sample(r, u)
 *
 * WHAT IT DOES.
 *   1. SCORE. The v1 cell scorer (solver/chomp/v1/scorer.js): P(I win | my option, their option, both sheets), learned
 *      from simulated outcomes (targeted DODUO-greedy preview samples and gen5 self-play) and human games.
 *   2. SOLVE. SLOWKING's exact LP (solver/slowking/matrix.js solveLP): my mix x, their mix y, the value v*.
 *   3. BO3 (games 2 and 3 only, when series.oppLast is given). Humans repeat their four at a rate that depends on
 *      whether they won the last game (solver/out/meta/bo3.json, read at run time — never typed here). The opponent
 *      model q puts s4[r] on their last four (their last lead pair with prob sl[r], sl = min(1, same_lead/same_four),
 *      the other lead pairs of that four uniformly) and 1 - s4[r] on their equilibrium mix restricted to the other
 *      fours. My mix = (1 - lambda) x + lambda BR(q), lambda = 0.5 (pre-registered). The receipt says what it did.
 *      If the last four is only partly revealed, "their last four" is every four that contains what was seen.
 *
 * Result fields: options, mix, oppMix, value, win[i] {vsMix, vsUniform, worst}, support, greedy, maximin, exploit,
 * bo3 (null in game 1), counters, ms, engine, model.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const O = require('../options.js');
const SK = require('../../slowking/matrix.js');
const BO3_FILE = path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'meta', 'bo3.json');
const LAMBDA = 0.5;
/* DELIBERATE BREAK (env CHOMP1_BREAK=bo3): the previous result is ignored (always 'lost'). test-chomp1.js BO3 must go red. */
const BREAK = (typeof process !== 'undefined' && process.env && process.env.CHOMP1_BREAK) || '';

function bo3Rates(file) {
  const b = JSON.parse(fs.readFileSync(file || BO3_FILE, 'utf8')).summary.by_previous_result;
  return { same_four: { won: b.same_four.won, lost: b.same_four.lost }, same_lead_pair: { won: b.same_lead_pair.won, lost: b.same_lead_pair.lost } };
}

/* the opponent model after a previous game: prev = { brought:[their sheet idx], leads:[their sheet idx], won } */
function oppModel(prev, y, rates) {
  const r = BREAK === 'bo3' ? 'lost' : prev.won ? 'won' : 'lost';
  const s4 = rates.same_four[r], sl = Math.min(1, rates.same_lead_pair[r] / rates.same_four[r]);
  const seen = (prev.brought || []).filter(i => i >= 0 && i < 6);
  const leads = (prev.leads || []).filter(i => seen.includes(i) || seen.length < 4);
  const q = new Float64Array(O.N);
  const same = O.OPTIONS.map(op => seen.every(i => op.order.includes(i)));
  const nSameFours = new Set(O.OPTIONS.map((op, i) => same[i] ? O.fourOf[i] : null).filter(Boolean)).size;
  if (!nSameFours) return null;
  /* s4: on the fours that contain everything seen; inside each four the old lead pair gets sl */
  const lk = leads.length === 2 ? leads.slice().sort().join('') : null;
  for (let i = 0; i < O.N; i++) {
    if (!same[i]) continue;
    const isLead = lk && O.OPTIONS[i].leads.slice().sort().join('') === lk;
    const hasLead = lk && lk.split('').every(c => O.OPTIONS[i].order.includes(+c));
    q[i] = s4 / nSameFours * (hasLead ? (isLead ? sl : (1 - sl) / 5) : 1 / 6);
  }
  let rest = 0; for (let i = 0; i < O.N; i++) if (!same[i]) rest += y[i];
  for (let i = 0; i < O.N; i++) if (!same[i]) q[i] = rest > 1e-12 ? (1 - s4) * y[i] / rest : (1 - s4) / (O.N - same.filter(Boolean).length);
  let z = 0; for (const v of q) z += v; for (let i = 0; i < O.N; i++) q[i] /= z;
  return { q, s4, sl, result: r, seen, leads, fours: nSameFours };
}

function create(o) {
  o = o || {};
  let API = o.API, ENGINE = null;
  if (!API) { ENGINE = require('../../arena/engine.js').load(o.release || null); API = ENGINE.API; }
  const SC = require('./scorer.js').create(API, { model: o.model, source: o.source });
  const COUNTERS = { solves: 0, lpPivots: 0, failures: 0, bo3Adjusted: 0 };
  let RATES = null;
  const rates = () => (RATES || (RATES = o.bo3Rates || bo3Rates(o.bo3File)));

  function solve(sh, so) {
    so = so || {};
    const t0 = Date.now();
    if (!sh || !Array.isArray(sh.mine) || !Array.isArray(sh.theirs)) throw new Error('chomp1: solve({ mine, theirs }) needs both open sheets');
    let tab;
    try { tab = SC.table({ p1: sh.mine, p2: sh.theirs }, { deadline: so.deadline }); } catch (e) { COUNTERS.failures++; throw e; }
    const A = tab.A, N = O.N;
    const sol = SK.solveLP(A);
    COUNTERS.solves++; COUNTERS.lpPivots += sol.pivots;
    const rowVs = y => A.map(r => { let s = 0; for (let j = 0; j < N; j++) s += r[j] * y[j]; return s; });
    const colMin = x => { let m = Infinity; for (let j = 0; j < N; j++) { let s = 0; for (let i = 0; i < N; i++) s += x[i] * A[i][j]; if (s < m) m = s; } return m; };
    const uni = new Array(N).fill(1 / N);
    const vsMix = rowVs(sol.y), vsUni = rowVs(uni), worst = A.map(r => Math.min(...r));
    let g = 0; for (let i = 1; i < N; i++) if (vsUni[i] > vsUni[g]) g = i;
    let mm = 0; for (let i = 1; i < N; i++) if (worst[i] > worst[mm]) mm = i;
    let mix = Array.from(sol.x);
    let bo3 = null;
    const prev = so.series && so.series.oppLast;
    if (prev && prev.brought && prev.brought.length) {
      const M = oppModel(prev, sol.y, rates());
      if (M) {
        const vq = rowVs(M.q);
        let br = 0; for (let i = 1; i < N; i++) if (vq[i] > vq[br]) br = i;
        const adj = mix.map((p, i) => (1 - LAMBDA) * p + (i === br ? LAMBDA : 0));
        const dot = (x, v) => x.reduce((s, p, i) => s + p * v[i], 0);
        bo3 = { lambda: LAMBDA, result: M.result, s4: M.s4, sl: M.sl, fours: M.fours, br, br_label: O.label(O.OPTIONS[br], sh.mine),
                v_eq_vs_q: dot(mix, vq), v_adj_vs_q: dot(adj, vq), v_br_vs_q: vq[br], exploit_adj: sol.value - colMin(adj) };
        mix = adj;
        COUNTERS.bo3Adjusted++;
      }
    }
    const options = O.OPTIONS.map((op, i) => ({ i, order: op.order.slice(), leads: op.leads.slice(), back: op.back.slice(), label: O.label(op, sh.mine) }));
    const win = options.map((_, i) => ({ vsMix: vsMix[i], vsUniform: vsUni[i], worst: worst[i] }));
    const support = mix.map((p, i) => ({ i, p })).filter(s => s.p > 1e-9).sort((a, b) => b.p - a.p)
      .map(s => ({ i: s.i, p: s.p, label: options[s.i].label, order: options[s.i].order, vsMix: vsMix[s.i] }));
    return {
      options, mix, eqMix: Array.from(sol.x), oppMix: Array.from(sol.y), value: sol.value, win, support,
      greedy: { i: g, label: options[g].label, vsUniform: vsUni[g] }, maximin: { i: mm, label: options[mm].label, worst: worst[mm] },
      exploit: { mix: +(sol.value - colMin(sol.x)).toExponential(3), lp_gap: +sol.gap.toExponential(3), greedy: sol.value - worst[g], maximin: sol.value - worst[mm], uniform: sol.value - colMin(uni) },
      spread: { cell_min: Math.min(...worst), cell_max: Math.max(...A.map(r => Math.max(...r))), row_vsUniform_range: Math.max(...vsUni) - Math.min(...vsUni) },
      bo3, table: so.keepTable ? A : undefined,
      counters: { cells: N * N, lpPivots: sol.pivots, oov: SC.COUNTERS.oov },
      score_ms: tab.ms, ms: Date.now() - t0, engine: ENGINE ? (ENGINE.id || 'live tree') : 'caller API', model: path.basename(SC.file), source: tab.source,
    };
  }
  function sample(r, u) { return r.options[SK.sample(r.mix, u)]; }
  return { solve, sample, COUNTERS, scorer: SC, API, engine: ENGINE };
}

module.exports = { create, oppModel, bo3Rates, LAMBDA };
