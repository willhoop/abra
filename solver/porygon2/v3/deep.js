/* solver/porygon2/v3/deep.js — the REFERENCE the v3 evaluation set labels against: MILTANK's root, with every cell filled
 * by playing the game to its END, and no value net anywhere in it.
 *
 *   const D = require('./solver/porygon2/v3/deep.js').create(API, { PA, R, MT });
 *   D.candidates(S, side, ctx, k1, k2, reserveSwitch)  -> { rows, cols } | { forced: true }   (MILTANK's own ranking)
 *   D.world(S, side, ctx, r, salt)                      -> the r-th honest world (the opponent's unrevealed back redrawn)
 *   D.deepCell(W, side, mine, theirs, r, salt, ctx, cap)    -> { v, turns, capped }   v = side A's result (1 / 0 / 0.5)
 *   D.successor(W, side, mine, theirs, r, salt)             -> the board after the cell's one stepped turn
 *   D.netCell(W, side, mine, theirs, r, salt, leaf, sheets) -> P(side A wins) after that turn (MILTANK depth 0)
 *   (mine = the deciding side's row joint, theirs = the column joint; the engine order is restored inside)
 *
 * WHY NOT MILTANK AT A LARGE PASS BUDGET. MILTANK's cells end in a value net (gen5's, in every arm). A reference that
 * ends in gen5's net would score gen5's net as agreeing with itself. So the root is MILTANK's — the same candidate rows
 * and columns (`legalActions`, gen5's DODUO ranking, one reserved switch row, the mega reservation, MT.rank), the same
 * honest worlds (rollout.js sampleWorld: the opponent's unrevealed back redrawn uniformly over its unrevealed sheet
 * rows), the same common random numbers — and each cell is the result of the game PLAYED TO THE END from it, by gen5's
 * DODUO prior on both sides (each side's argmax legal joint, from its own view). No net reads the position anywhere.
 * The cost of that choice is stated, not hidden: the reference is "what happens when two copies of gen5's prior play it
 * out", a fixed, human-imitating continuation policy, not the game-theoretic value.
 *
 * COMMON RANDOM NUMBERS. Playout r of EVERY cell of a position uses world r and dice seed r, so a difference between two
 * cells is the action, not the dice; and the net's cell r is the SAME successor board the deep playout r continues from
 * (one stepped turn on the same world and the same dice), so the net is asked exactly the question the reference answers.
 * A playout that reaches `cap` turns without a wipe is scored by the engine's horizon rule (API.winner) and COUNTED.
 */
'use strict';
/* DELIBERATE BREAK (env P2V3_DEEP_BREAK=orient): a side-B cell is stepped (mine, theirs), the bug the first run hit;
 * solver/tests/test-porygon2-v3-evalset.js must go red */
const BREAK = (typeof process !== 'undefined' && process.env && process.env.P2V3_DEEP_BREAK) || '';
const crypto = require('crypto');
const h32 = s => crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0);

function create(API, deps) {
  const M = API.M, PA = deps.PA, R = deps.R, MT = deps.MT;
  const LEAN = deps.lean !== false;
  const COUNTERS = { candidates: 0, forced: 0, leanPlayouts: 0, deepPlayouts: 0, deepTurns: 0, deepCapped: 0, deepErrors: 0, netCells: 0, policyCalls: 0, policyUnmatched: 0 };

  function candidates(S, side, ctx, k1, k2, rs) {
    const opp = side === 'A' ? 'B' : 'A';
    const laMe = API.legalActions(S, side), laOp = API.legalActions(S, opp);
    if (laMe.joint.length === 1) { COUNTERS.forced++; return { forced: true }; }
    const sMe = PA.scoreJoints(ctx, S, side, side, laMe), sOp = PA.scoreJoints(ctx, S, opp, side, laOp);
    const megaMe = laMe.joint.some(j => j.some(x => x && x.mega)), megaOp = laOp.joint.some(j => j.some(x => x && x.mega));
    const rowsI = MT.rank(Array.from(sMe), laMe.joint, k1, rs, megaMe, null);
    const colsI = MT.rank(Array.from(sOp), laOp.joint, k2, rs, megaOp, null);
    COUNTERS.candidates++;
    return { rows: rowsI.map(i => laMe.joint[i]), cols: colsI.map(i => laOp.joint[i]), priorRow: rowsI.map(i => sMe[i]), nLegal: [laMe.joint.length, laOp.joint.length] };
  }

  const worldSeed = (salt, r) => h32('w:' + salt + ':' + r);
  const diceSeed = (salt, r) => h32('d:' + salt + ':' + r) % 1e9;
  function world(S, side, ctx, r, salt) {
    const opp = side === 'A' ? 'B' : 'A';
    const belief = { sheet: ctx.G.sheets[opp === 'A' ? 'p1' : 'p2'], revealed: PA.revealed(S, opp) };
    return R.sampleWorld(S, opp, belief, M.rngStreams({ seed: worldSeed(salt, r) }).any);
  }

  /* THE POLICY'S MENU. Inside a playout the joints come from rollout.js slotSupport (the engine's own menu functions, no
   * counter snapshot; pinned a subset of legalActions by solver/tests/test-miltank.js), never two megas or two switches to
   * one body: legalActions costs ~5 ms a side because it restores every process counter, which a throwaway copy does not
   * need (measured 2026-10-01: 10.6 of 36 ms per playout turn). The ROOT candidates still come from legalActions. */
  function menu(S, sd) {
    const own = sd === 'A' ? S.actA : S.actB;
    const sups = own.map((_, k) => R.slotSupport(S, sd, k));
    if (sups.length === 1) return { slots: sups, joint: sups[0].map(o => [o]) };
    const joint = [];
    for (const a of sups[0]) for (const b of sups[1]) {
      if (a.mega && b.mega) continue;
      if (a.kind === 'switch' && b.kind === 'switch' && a.to === b.to) continue;
      joint.push([a, b]);
    }
    if (!joint.length) joint.push([sups[0][0], { kind: 'pass' }]);
    return { slots: sups, joint };
  }
  function greedy(S, sd, ctx) {
    const la = menu(S, sd);
    if (la.joint.length === 1) return la.joint[0];
    COUNTERS.policyCalls++;
    const s = PA.scoreJoints(ctx, S, sd, sd, la);
    let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
    if (!(s[b] > 1e-12)) COUNTERS.policyUnmatched++;
    return la.joint[b];
  }

  /* THE CELL'S TWO JOINTS IN ENGINE ORDER. A cell is (my row, their column) for the deciding side `side`; the engine steps
   * (side A's joint, side B's joint), so a side-B decision swaps them (solver/miltank/cells.js does the same). Stepping
   * them unswapped was caught on the first run (2026-10-01): side-B positions threw "switch to team[k] which cannot come
   * in", because B's switch was handed to A's slots. solver/tests/test-porygon2-v3-evalset.js pins the orientation. */
  const orient = (side, mine, theirs) => (side === 'A' || BREAK === 'orient' ? [mine, theirs] : [theirs, mine]);   // BREAK: the original bug

  /* one deep playout: copy W, step the cell on dice r, then both sides play gen5's prior argmax to the end (or `cap` turns) */
  function deepCell(W, side, mine, theirs, r, salt, ctx, cap) {
    const S = API.clone(W);
    const rng = M.rngStreams({ seed: diceSeed(salt, r) });
    const c = { G: ctx.G, hist: ctx.hist.slice() };
    const [a, b] = orient(side, mine, theirs);
    PA.record(c, S, a, b);
    API.stepInPlace(S, a, b, rng);                 // the SAME full step netCell takes: the successor the nets are asked about
    let t = 0;
    /* the continuation runs LEAN (the engine's lean binding: the same boards, no protocol; solver/tests/test-lean-mode.js) */
    if (LEAN && !API.isTerminal(S)) { API.makeLean(S); COUNTERS.leanPlayouts++; }
    const go = () => {
      while (!API.isTerminal(S) && t < cap) {
        const jA = greedy(S, 'A', c), jB = greedy(S, 'B', c);
        PA.record(c, S, jA, jB);
        API.stepInPlace(S, jA, jB, rng);
        t++;
      }
    };
    if (S._lean) API.leanRun(go); else go();
    COUNTERS.deepPlayouts++; COUNTERS.deepTurns += t;
    const capped = !API.isTerminal(S);
    if (capped) COUNTERS.deepCapped++;
    return { v: capped ? horizon(S) : API.winner(S), turns: t, capped };
  }
  /* a playout that hit the cap: the engine's own horizon score */
  function horizon(S) {
    if (typeof API.horizonScore === 'function') { const h = API.horizonScore(S); if (Number.isFinite(h)) return h; }
    return 0.5;
  }

  /* the successor board of cell (a, b) on world W and dice r: the board deepCell's playout r continues from */
  function successor(W, side, mine, theirs, r, salt) {
    const S = API.clone(W);
    const [a, b] = orient(side, mine, theirs);
    API.stepInPlace(S, a, b, M.rngStreams({ seed: diceSeed(salt, r) }));
    return S;
  }
  function netCell(W, side, mine, theirs, r, salt, leaf, sheets) {
    const S = successor(W, side, mine, theirs, r, salt);
    COUNTERS.netCells++;
    return API.isTerminal(S) ? API.winner(S) : leaf.value(S, sheets);
  }

  return { COUNTERS, candidates, world, deepCell, netCell, successor, worldSeed, diceSeed };
}

module.exports = { create, h32 };
