/* solver/machamp/n7/policy.js — the N7 net's POLICY HEAD in a MILTANK search, and the self-play policy TARGET. One file for
 * both, so the cells, log-probabilities and class bits a target is recorded on are the ones the head is served on.
 *
 *   const POL = require('./solver/machamp/n7/policy.js');
 *   POL.cellsOf(prior, PA, ctx, S, side, viewer)
 *       -> null | { d, cells: [[a, b]], lp: Float64Array, bits: Uint16Array, index: Map('a,b' -> k) }
 *          every VALID joint cell of the DODUO decision (prior.predict: solver/mag/infer.js), its log-probability and its
 *          class bits (solver/gary/situation.js classBits) — GARY's cell list (solver/gary/cells.js), on the search's prior
 *   POL.target(prior, PA, ctx, S, side, rows, x)
 *       -> null | { K, lp, bits, t: { k: mass }, mapped, unmapped_mass }   the search's root row mix x (over `rows`, API
 *          joints) laid on the valid cells: a row's mass goes to its DODUO cell (PA.jointCells, the match scoreJoints uses);
 *          a row with no cell (a forced or passing slot, or an unmatched option) loses its mass, COUNTED in unmapped_mass;
 *          the mapped mass is renormalised. null when nothing maps.
 *   const W = POL.create(API, { net, prior, ratings })      net = an N7 model file with a policy block
 *   W.wrap(PA) -> PA'    PA'.scoreJoints tilts PA.scoreJoints by the head (solver/machamp/n7/net.js): for each legal joint n
 *                        on cell (a, b):  mass_n  ∝  exp( exp(beta) * log base_n + theta . bits(a, b) ),
 *                        base_n = PA.scoreJoints's mass (DODUO's cell mass), (beta, theta) = the head on the DECIDING chair's
 *                        hidden (side, not viewer: the head predicts that side's search). A joint with no cell keeps
 *                        exp(beta) * log base_n and no bits. Every other PA method passes through unchanged.
 *   W.COUNTERS           calls, tilted joints, untilted (no cell) joints, encode/forward ms — the capability counter
 *
 * The board the head reads is the root S the search was handed (the decider's public view under honest information), through
 * the student's own encoder (solver/porygon2/v2/features.js fromEngine -> encode) at the leaf's ratings [1600, 1600]
 * (solver/porygon2/v3/leaf.js): the input the net was trained on (solver/mew/play.js --n7 records exactly this encode).
 *
 * THE BASE PRIOR IS PINNED. The head was fitted on one DODUO's log-probabilities; served over another it would tilt numbers it
 * never saw. create() refuses unless the agent's prior files hash to the policy block's base_prior.
 *
 * DELIBERATE BREAKS (env N7_POLICY_BREAK): `off` returns the base scores untouched while still counting a call (the capability
 * that cannot prove it ran) — test-n7-loop.js POLICY must go red; `bits` drops the class bits from the target.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const SIT = require('../../gary/situation.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.N7_POLICY_BREAK) || '';
const SIDE = { A: 'p1', B: 'p2' };

function cellsOf(prior, PA, ctx, S, side, viewer) {
  const r = prior.predict(PA.row(ctx, S, viewer), ctx.hist.length, SIDE[side]);
  if (!r) return null;
  const d = r.decision, K = r.cells.length;
  const cells = new Array(K), lp = new Float64Array(K), bits = new Uint16Array(K), index = new Map();
  r.cells.forEach((c, k) => {
    cells[k] = [c.a, c.b]; lp[k] = Math.log(Math.max(c.p, 1e-300)); bits[k] = BREAK === 'bits' ? 0 : SIT.classBits(d, c.a, c.b);
    index.set(c.a + ',' + c.b, k);
  });
  return { d, cells, lp, bits, index };
}

function target(prior, PA, ctx, S, side, rows, x) {
  const C = cellsOf(prior, PA, ctx, S, side, side);
  if (!C || C.cells.length < 2) return null;
  const jc = PA.jointCells(ctx, S, side, side, rows);
  if (!jc) return null;
  const t = {};
  let mapped = 0, lost = 0;
  rows.forEach((_, i) => {
    const c = jc.cells[i], m = x[i] || 0;
    const k = c ? C.index.get(c[0] + ',' + c[1]) : undefined;
    if (k === undefined) { lost += m; return; }
    t[k] = (t[k] || 0) + m; mapped += m;
  });
  if (!(mapped > 0)) return null;
  for (const k of Object.keys(t)) t[k] = +(t[k] / mapped).toFixed(6);
  return { K: C.cells.length, lp: Array.from(C.lp, v => +v.toFixed(5)), bits: Array.from(C.bits), t, mapped: Object.keys(t).length, unmapped_mass: +lost.toFixed(6) };
}

const shaFile = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function create(API, opts) {
  opts = opts || {};
  if (!opts.net) throw new Error('n7/policy: a net file is required');
  const NET = require('./net.js').load(opts.net);
  if (!NET.hasPolicy) throw new Error('n7/policy: ' + opts.net + ' carries no policy head');
  if (NET.policy.class_names.join() !== SIT.CLASS_NAMES.join()) throw new Error('n7/policy: the head was fitted on different class bits than solver/gary/situation.js');
  const prior = opts.prior;
  if (!prior) throw new Error('n7/policy: the base prior (solver/mag/infer.js load) is required');
  if (opts.priorFiles) {
    const bp = NET.policy.base_prior || {};
    const got = { mag: shaFile(opts.priorFiles.mag), doduo: shaFile(opts.priorFiles.doduo) };
    if (bp.mag !== got.mag || bp.doduo !== got.doduo) throw new Error('n7/policy: the head tilts a different DODUO than this agent plays (base_prior ' + JSON.stringify(bp) + ', agent ' + JSON.stringify(got) + ')');
  } else throw new Error('n7/policy: priorFiles { mag, doduo } are required (the base prior is pinned)');
  const F = require('../../porygon2/v2/features.js').create(API);
  if (F.BROKEN) throw new Error('n7/policy: refusing to play with PORY2V2_FEAT_BREAK=' + F.BROKEN);
  const ratings = opts.ratings || [1600, 1600];
  const COUNTERS = { calls: 0, tilted: 0, untilted: 0, broken_passthrough: 0, ms: 0, net: opts.net.split(/[\\/]/).pop() };

  function wrap(PA) {
    function scoreJoints(ctx, S, side, viewer, la) {
      const base = PA.scoreJoints(ctx, S, side, viewer, la);
      COUNTERS.calls++;
      if (BREAK === 'off') { COUNTERS.broken_passthrough++; return base; }
      const t0 = Date.now();
      const X = F.encode(F.fromEngine(S, ctx.G.sheets), { p1: ratings[0], p2: ratings[1] });
      const f = NET.forward(X);
      const e = NET.tilt(side === 'A' ? f.hidA : f.hidB);
      const scale = Math.exp(e[0]);
      const C = cellsOf(prior, PA, ctx, S, side, viewer);
      const jc = C ? PA.jointCells(ctx, S, side, viewer, la.joint) : null;
      const s = new Float64Array(base.length);
      let mx = -Infinity;
      for (let n = 0; n < base.length; n++) {
        let v = scale * Math.log(Math.max(base[n], 1e-300));
        const c = jc && jc.cells[n];
        const k = c ? C.index.get(c[0] + ',' + c[1]) : undefined;
        if (k !== undefined) { const b = C.bits[k]; for (let q = 0; q < NET.NB; q++) if (b & (1 << q)) v += e[1 + q]; COUNTERS.tilted++; } else COUNTERS.untilted++;
        s[n] = v; if (v > mx) mx = v;
      }
      let z = 0; for (let n = 0; n < s.length; n++) { s[n] = Math.exp(s[n] - mx); z += s[n]; }
      for (let n = 0; n < s.length; n++) s[n] /= z;
      COUNTERS.ms += Date.now() - t0;
      return s;
    }
    return Object.assign({}, PA, { scoreJoints, n7Policy: COUNTERS });
  }
  return { wrap, COUNTERS, net: NET };
}

module.exports = { create, cellsOf, target, BREAK };
