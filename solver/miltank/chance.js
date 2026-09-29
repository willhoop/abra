/* solver/miltank/chance.js — WEIGHTED CHANCE FOR ONE TURN: every die of a stepped turn enumerated by its probability,
 * instead of one seeded roll per playout (Will's idea, 2026-09-29; docs/_reports/2026-09-29-weighted-chance-search.md).
 *
 *   const CH = require('./solver/miltank/chance.js').create(API);
 *   CH.enumerate(W, jA, jB, { dmg, rep, massEps, maxEvals, delta, seed, abortAt }) -> { buckets:[{ S, w }], stats }
 *       W: a prepared world (rollout.prepare) or a battle. Every bucket is a DISTINCT board (API.digest) one turn on,
 *       w its probability; the w sum to 1. S is a lean battle, the playout's own copy.
 *
 * NO PROBABILITY IS RESTATED HERE. Every die of a turn reaches the engine through ONE door: `battleTurn(S, rng, …)` runs
 * `rngStreams(rng)` and a struct that already carries `any` is passed straight through (engine/medicham2-browser.js,
 * rngStreams). So the enumerator hands the step a SCRIPTED struct: draw n returns the n-th value of a prefix, and every
 * draw past the prefix returns one canonical value. The engine keeps every threshold (accuracy, crit rate, the damage
 * roll, a secondary's chance, the consecutive-Protect die, the speed-tie die); this file only chooses u.
 *
 * WHAT THE SOLVER CANNOT READ IS THE THRESHOLD, so it FINDS it. For the next undecided draw, the turn is played with that
 * draw at u and the rest canonical, and the resulting board digest is the class of u. The classes are found by bisection
 * on [0, 1) from probes at 0, 1/2 and 1: two points giving one board are taken to bound one class (a die's outcome is a
 * step function of u: hit/miss, crit/no-crit, the damage roll), and a boundary is narrowed to `delta` then SNAPPED to
 * the simplest rational inside it (1/24, 9/10, k/16 come back exact). Each class is then played at a u DRAWN INSIDE IT
 * (a seeded coin) and recursed into, so a later draw is enumerated given this one. A node lighter than `massEps` is not
 * split further: its remaining dice are drawn, and its mass is COUNTED (`truncatedMass`).
 *
 * WHY A DRAWN u AND NOT THE MIDPOINT: the classes are found with the later dice at the canonical value, and that is only
 * safe when a class really fixes the board. It does not when two dice act TOGETHER: two low damage rolls that jointly
 * leave a body standing, while either one beside a middle roll knocks it out. The first version played each class at its
 * midpoint and truncated to the canonical point; it enumerated a measured 12.7% survival as 0 and was off by up to 15 SE
 * (docs/_reports/2026-09-29-weighted-chance-search.md §3). Drawing u inside each class makes the whole thing STRATIFIED
 * SAMPLING with the strata cut at the engine's own thresholds: unbiased whatever the classing, and exact (zero variance)
 * wherever a stratum is pure. `rep: 'mid'` restores the midpoint (biased; kept only as the measured alternative).
 *
 * DAMAGE DRAWS (o.dmg). 'exact' (the default): a damage draw is classed by board like every other die, so each distinct
 * roll is its own stratum — the expensive part. 'coarse': classed by consequence (who is down, HP in quarters), fewer
 * strata. 'sample': not branched, one drawn roll. All three are unbiased under the drawn u; they differ in cost and in
 * how much of the damage roll's variance they remove.
 *
 * COUNTERS (a capability that cannot prove it ran is assumed broken): turns, evals, nodes, leaves, buckets, snapped,
 * unsnapped (a boundary with no simple rational: its midpoint is used), truncatedNodes / truncatedMass, capped (maxEvals
 * reached: every open node truncated), streamMismatch (a replayed prefix drew a different stream — the step is not a
 * function of its dice; must read 0), runaway (a turn drew more than MAX_DRAWS dice — a rejection loop meeting the
 * canonical value; the turn is refused, not guessed).
 *
 * SPEED TIES are never branched: one drawn u (counted sampledTie; see explore). The tie die's value is kept on the battle and
 * its outcome is a comparison with another die, so it has no threshold to find.
 *
 * COUNTER repMismatch (and repMismatchBy, per stream): a class played at its drawn u gave a board other than the class's
 * own — the draw was not a step function there. The estimate stays unbiased; the count says how often. Must stay small.
 *
 * DELIBERATE BREAK (env MILTANK_BREAK=chance): every bucket weighs the same. solver/tests/test-miltank-chance.js must go red.
 */
'use strict';
const v8 = require('v8');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.MILTANK_BREAK) || '';
const MAX_DRAWS = 4000;
const ONE = 1 - Math.pow(2, -40);

/* the simplest rational (smallest denominator) in [a, b], by the Stern-Brocot descent; null past maxQ */
function simplest(a, b, maxQ) {
  if (a <= 0) return [0, 1];
  let pl = 0, ql = 1, pr = 1, qr = 0;   // 0/1 and 1/0
  for (let it = 0; it < 10000; it++) {
    const pm = pl + pr, qm = ql + qr;
    if (qm > maxQ) return null;
    const x = pm / qm;
    if (x < a) {
      /* step right as far as the mediant stays below a */
      let k = 1; while (true) { const p2 = pl + (k + 1) * pr, q2 = ql + (k + 1) * qr; if (q2 > maxQ || p2 / q2 >= a) break; k++; }
      pl += k * pr; ql += k * qr;
    } else if (x > b) {
      let k = 1; while (true) { const p2 = (k + 1) * pl + pr, q2 = (k + 1) * ql + qr; if (q2 > maxQ || p2 / q2 <= b) break; k++; }
      pr += k * pl; qr += k * ql;
    } else return [pm, qm];
  }
  return null;
}

function create(API) {
  const M = API.M;
  const STREAMS = ['any'].concat(M.RNG_STREAMS);
  const COUNTERS = { turns: 0, evals: 0, nodes: 0, leaves: 0, buckets: 0, snapped: 0, unsnapped: 0, truncatedNodes: 0, truncatedMass: 0,
                     capped: 0, streamMismatch: 0, runaway: 0, repMismatch: 0, repMismatchBy: {}, ms: 0 };

  function scripted(prefix, streams, canon, log) {
    let n = 0;
    const o = { split: true, seed: 0 };
    for (const k of STREAMS) o[k] = () => {
      const i = n++;
      if (i >= MAX_DRAWS) { COUNTERS.runaway++; throw new Error('chance: a turn drew more than ' + MAX_DRAWS + ' dice'); }
      log.push(k);
      if (i < prefix.length) { if (streams[i] && streams[i] !== k) COUNTERS.streamMismatch++; return prefix[i]; }
      return typeof canon === 'function' ? canon() : canon;
    };
    return o;
  }

  /* one stepped turn on a scripted die: a fresh lean copy of the world */
  function run(buf, jA, jB, prefix, streams, canon) {
    const S = v8.deserialize(buf);
    API.makeLean(S);
    const log = [];
    const rng = scripted(prefix, streams, canon, log);
    API.stepInPlace(S, jA, jB, rng);   // a lean battle enters the engine's lean binding itself (medicham_api stepInPlace)
    COUNTERS.evals++;
    return { S, log, key: API.digest(S) };
  }

  /* board consequence: per body of both teams, down or its HP in quarters */
  const live = m => !!(m && !m.fainted && m.curHP > 0);
  function coarseKey(S) {
    let k = '';
    for (const t of [S.sfA.team, S.sfB.team]) { for (const m of t) k += live(m) ? String(Math.min(3, Math.floor(4 * m.curHP / m.st.hp))) : 'x'; k += '|'; }
    return k;
  }

  function enumerate(W, jA, jB, o) {
    o = o || {};
    const t0 = Date.now();
    const massEps = o.massEps == null ? 1e-2 : o.massEps;
    const maxEvals = o.maxEvals || 4000;
    const delta = o.delta || Math.pow(2, -10);
    const maxQ = o.maxQ || 200;
    const canon = o.canon == null ? 0.5 : o.canon;
    /* THE STRATIFYING COIN: a class plays at a u drawn uniformly INSIDE it, and a truncated node's remaining dice are drawn
     * too, so the estimate is unbiased whatever the classing (stratified sampling, one sample per stratum); it is exact
     * wherever a class really fixes the board. o.rep === 'mid' plays every class at its midpoint instead (biased; kept as
     * the measured alternative). Seeded: the same (world, joints, seed) gives the same buckets. */
    const coin = M.rngStreams({ seed: o.seed == null ? 1 : o.seed }).any;
    const repMid = o.rep === 'mid';
    const buf = W && W.prepared ? W.buf : v8.serialize(API.clone(W));
    const st = { evals: 0, nodes: 0, leaves: 0, snapped: 0, unsnapped: 0, truncatedNodes: 0, truncatedMass: 0, capped: false, draws: 0, maxDepth: 0, sampledDmg: 0, sampledTie: 0, repMismatch: 0 };
    const e0 = COUNTERS.evals;
    const leaves = [];
    const ev = (prefix, streams, tail) => {
      if (o.abortAt && Date.now() >= o.abortAt) throw Object.assign(new Error('chance: abortAt'), { abort: true });
      return run(buf, jA, jB, prefix, streams, tail || canon);
    };
    const over = () => COUNTERS.evals - e0 >= maxEvals;

    /* the classes of draw i given the prefix: [{ lo, hi, rep }] covering [0, 1) */
    function partition(prefix, streams) {
      /* a DAMAGE draw under o.dmg === 'coarse' is classed by board CONSEQUENCE, not by board: which bodies are down and
       * each body's HP in quarters. Its roll classes merge, and each merged class plays at its midpoint roll. */
      const coarse = o.dmg === 'coarse' && streams[streams.length - 1] === 'dmg';
      const at = u => { const r = ev(prefix.concat([u]), streams); if (coarse) r.ckey = coarseKey(r.S); return r; };
      const K = r => (coarse ? r.ckey : r.key);
      const cuts = [];   // [{ a, b, left, right }] a boundary somewhere in (a, b]
      const pts = [[0, at(0)], [0.5, at(0.5)], [ONE, at(ONE)]];
      function seg(a, fa, b, fb) {
        if (K(fa) === K(fb)) return;
        if (b - a <= delta || over()) { cuts.push({ a, b, left: fa, right: fb }); return; }
        const m = (a + b) / 2, fm = at(m);
        seg(a, fa, m, fm); seg(m, fm, b, fb);
      }
      seg(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      seg(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      /* boundaries -> intervals; a boundary is snapped to the simplest rational in its bracket */
      const xs = [0];
      for (const c of cuts) {
        const q = simplest(c.a, c.b, maxQ);
        if (q) { st.snapped++; COUNTERS.snapped++; xs.push(q[0] / q[1]); }
        else { st.unsnapped++; COUNTERS.unsnapped++; xs.push((c.a + c.b) / 2); }
      }
      xs.push(1);
      /* the class of each interval is the board found at its bracketing probes; adjacent intervals with one board merge */
      const cls = [];
      for (let k = 0; k + 1 < xs.length; k++) {
        const lo = xs[k], hi = xs[k + 1];
        if (hi <= lo) continue;
        const key = k === 0 ? K(pts[0][1]) : K(cuts[k - 1].right);
        const last = cls[cls.length - 1];
        if (last && last.key === key) { last.hi = hi; continue; }
        cls.push({ lo, hi, key });
      }
      /* each class plays at a u drawn inside it (or its midpoint under rep 'mid'); a board other than the class's own at
       * that u means the draw was not a step function there (counted repMismatch; the estimate stays unbiased) */
      for (const c of cls) {
        c.u = repMid ? (c.lo + c.hi) / 2 : c.lo + coin() * (c.hi - c.lo);
        c.r = at(c.u);
        if (!coarse && K(c.r) !== c.key) { COUNTERS.repMismatch++; st.repMismatch++; const sk = streams[streams.length - 1]; COUNTERS.repMismatchBy[sk] = (COUNTERS.repMismatchBy[sk] || 0) + 1; if (process.env.CHANCE_DEBUG === 'rep' && COUNTERS.repMismatch <= 5) console.log('    repMismatch ' + sk + ' class [' + c.lo + ',' + c.hi + ') u ' + c.u + ' classes ' + cls.length); }
      }
      return cls;
    }

    function explore(prefix, streams, w, r) {
      st.nodes++; COUNTERS.nodes++;
      if (prefix.length > st.maxDepth) st.maxDepth = prefix.length;
      if (r.log.length <= prefix.length) { leaves.push({ S: r.S, key: r.key, w }); return; }
      if (w < massEps || over()) {
        /* TRUNCATED: not split further. Its remaining dice are DRAWN (the stratifying coin), not set to the canonical value,
         * so a light node is one unbiased sample rather than a biased point; rep 'mid' keeps the canonical point */
        if (over()) st.capped = true;
        st.truncatedNodes++; st.truncatedMass += w;
        const t = repMid ? r : ev(prefix, streams, () => coin());
        leaves.push({ S: t.S, key: t.key, w });
        return;
      }
      const s2 = streams.concat([r.log[prefix.length]]);
      /* NOT BRANCHED — one stratum, [0, 1), played at a drawn u:
       *   a damage draw under o.dmg === 'sample';
       *   EVERY speed-tie draw. The tie die's raw value stays on the battle after the turn (the sort memoises it on the
       *   entry it ordered), so every u is a different board and bisection would split [0, 1) down to `delta`: measured,
       *   one 33-draw turn went to 1,008 classes on a single tie draw and 1,745 buckets. Its outcome is also decided by
       *   comparing it with ANOTHER draw, so no fixed threshold exists to find. Sampled, it stays unbiased. */
      const sk = s2[s2.length - 1];
      if ((o.dmg === 'sample' && sk === 'dmg') || sk === 'tie') {
        if (sk === 'tie') st.sampledTie++; else st.sampledDmg++;
        const u = repMid ? canon : coin();
        explore(prefix.concat([u]), s2, w, repMid ? r : ev(prefix.concat([u]), s2));
        return;
      }
      const cls = partition(prefix, s2);
      for (const c of cls) explore(prefix.concat([c.u]), s2, w * (c.hi - c.lo), c.r);
    }

    const root = ev([], []);
    st.draws = root.log.length;
    explore([], [], 1, root);
    /* bucket by board: identical boards reached by different dice are one outcome */
    const byKey = new Map();
    for (const l of leaves) { const b = byKey.get(l.key); if (b) b.w += l.w; else byKey.set(l.key, { S: l.S, w: l.w }); }
    let buckets = [...byKey.values()];
    if (BREAK === 'chance') buckets = buckets.map(b => ({ S: b.S, w: 1 / buckets.length }));   // DELIBERATE BREAK
    st.evals = COUNTERS.evals - e0; st.leaves = leaves.length; st.buckets = buckets.length; st.ms = Date.now() - t0;
    COUNTERS.turns++; COUNTERS.leaves += leaves.length; COUNTERS.buckets += buckets.length;
    COUNTERS.truncatedNodes += st.truncatedNodes; COUNTERS.truncatedMass += st.truncatedMass; if (st.capped) COUNTERS.capped++;
    COUNTERS.ms += st.ms;
    return { buckets, stats: st };
  }

  return { COUNTERS, enumerate, coarseKey, BROKEN: BREAK === 'chance' ? 'chance' : null };
}

module.exports = { create, simplest };
