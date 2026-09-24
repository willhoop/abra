/* solver/arena/bots.js — the three arena bots. Each is `{ name, choose(S, side, ctx) -> joint }` and
 * must not mutate S (MILTANK clones; `legalActions` restores; the prior adapter only reads).
 *
 *   random    uniform over `legalActions(S, side).joint` — the "random legal" baseline of SOLVER-PLAN §5
 *   prior     the human prior v0's most likely LEGAL joint (argmax; greedy, no search)
 *   miltank   MILTANK v1 (solver/miltank/search.js) at a per-decision time budget
 *
 * Each bot's coin is its own seeded stream (the engine's `rngStreams`), so a game replays exactly.
 */
'use strict';

function makeBots(API, deps) {
  const PA = deps.prior, MT = deps.miltank;
  const coinOf = seed => API.M.rngStreams({ seed }).any;

  function random(seed) {
    const coin = coinOf(seed);
    return { name: 'random', choose(S, side) { const j = API.legalActions(S, side).joint; return { joint: j[Math.floor(coin() * j.length)] }; } };
  }
  function prior() {
    return { name: 'prior', choose(S, side, ctx) {
      const la = API.legalActions(S, side);
      if (la.joint.length === 1) return { joint: la.joint[0] };
      const s = PA.scoreJoints(ctx, S, side, side, la);
      let b = 0; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
      return { joint: la.joint[b], info: { p: s[b] } };
    } };
  }
  function miltank(seed, o) {
    const coin = coinOf(seed);
    /* with o.pool the cells are filled by worker processes and choose() returns a promise (the arena awaits it) */
    return { name: 'miltank', choose(S, side, ctx) { const q = Object.assign({ coin }, o); return q.pool ? MT.decideAsync(S, side, ctx, q) : MT.decide(S, side, ctx, q); } };
  }
  return { random, prior, miltank };
}

module.exports = { makeBots };
