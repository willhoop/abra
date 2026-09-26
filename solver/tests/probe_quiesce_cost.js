/* solver/tests/probe_quiesce_cost.js — WHAT QUIESCENCE COSTS AT A FIXED CLOCK (2026-09-27,
 * docs/_reports/2026-09-27-protect-repeat-fix.md).
 *
 *   node solver/tests/probe_quiesce_cost.js [--release eaa5becc54eb] [--positions 30] [--budget 1000] [--seed 11]
 *
 * A MEASUREMENT: prints and exits 0. Positions: TEST pairs walked by the human clone, every 3rd turn. At each, gen5's
 * search (k 4x4, depth 0, PORYGON2 gen5 leaf) decides twice at the same wall-clock budget, off then on
 * (quiesce 'all' + flatEps + reserveNoRepeat), interleaved so machine load hits both alike. Reported: mean playouts
 * per decision, mean passes, unfilled cells and the prior fallbacks, per arm.
 */
'use strict';
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const NPOS = +flag('--positions', 30);
const BUDGET = +flag('--budget', 1000);
const SEED = +flag('--seed', 11);
const path = require('path');
const fs = require('fs');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const ROOT = path.join(__dirname, '..', '..');
const G5spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8'));
const G5 = AGm.load(G5spec);
const CL = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
const P = require('../mew/pairs.js').load({ teamStore: 'data/team-pool-frozen-regmc' });
const SEARCH = require('../miltank/search.js');
const arms = { off: {}, on: { quiesce: 'all', flatEps: 0.001, reserveNoRepeat: true } };
const T0 = Object.fromEntries(Object.keys(arms).map(k => [k, { n: 0, playouts: 0, passes: 0, unfilled: 0, fallback: 0, flat: 0, ms: 0 }]));
let n = 0;
for (let g = 0; n < NPOS && g < P.test.length; g++) {
  const G = P.test[(g * 11 + SEED) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  const rng = API.makeRng(SEED * 1000 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA0.newGame(G);
  const bA = CL.bot(1), bB = CL.bot(2);
  for (let t = 0; t < 12 && !API.isTerminal(S) && n < NPOS; t++) {
    if (t % 3 === 1 && API.legalActions(S, 'A').joint.length > 1) {
      n++;
      for (const [k, extra] of (n % 2 ? Object.entries(arms) : Object.entries(arms).reverse())) {
        const MT = SEARCH.create(API, { prior: G5.PA, rollout: AGm.R });
        const r = MT.decide(S, 'A', ctx, Object.assign({ budgetMs: BUDGET, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2', leafModel: path.join(ROOT, G5spec.pory2), coin: M.rngStreams({ seed: n }).any }, extra));
        const X = T0[k], i = r.info || {};
        X.n++; X.playouts += i.playouts || 0; X.passes += i.passes || 0; X.unfilled += i.unfilled || 0; X.ms += i.ms || 0;
        if (i.fallback) X.fallback++; if (i.flat) X.flat++;
      }
    }
    const jA = bA.choose(S, 'A', ctx).joint, jB = bB.choose(S, 'B', ctx).joint;
    PA0.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
console.log(`  ${n} positions, ${BUDGET} ms a decision, true battle (no XATU worlds), one process`);
for (const [k, X] of Object.entries(T0)) console.log(`  ${k.padEnd(4)} playouts/decision ${(X.playouts / X.n).toFixed(1)}  passes ${(X.passes / X.n).toFixed(2)}  unfilled cells ${(X.unfilled / X.n).toFixed(2)}  prior fallbacks ${X.fallback}  flat ${X.flat}  ms ${(X.ms / X.n).toFixed(0)}`);
