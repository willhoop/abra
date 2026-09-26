/* solver/tests/probe_protect_passes.js — WITH THE COUNTER CARRIED, WHY DOES THE SEARCH STILL RE-CLICK PROTECT?
 * (2026-09-26, docs/_reports/2026-09-26-protect-overuse.md, candidates (c) and (e))
 *
 *   node solver/tests/probe_protect_passes.js [--release eaa5becc54eb] [--positions 40] [--caps 2,8,48] [--seed 7]
 *        [--variants base,heuristic,k2x8,k1x8] [--vpasses 48]
 *
 * A MEASUREMENT: prints and exits 0. Positions are drawn from TEST team pairs walked by DODUO-greedy on both sides
 * (cheap, and the human clone's positions); a position qualifies when a side-A active body carries the consecutive-
 * Protect counter (`tookProtectTurns` >= 1, so a repeat succeeds with 1/3 or less) and may click its protect-family
 * move. At each qualifying position gen5's search (solver/machamp/league/gen5.json: gen5 DODUO ranking, PORYGON2 gen5
 * leaf, k 4x4, depth 0) is run to a FIXED number of passes (no clock) for every cap, on the true battle (the counter is
 * exact there). Reported per cap: the mean row-mix mass on rows where that body repeats its Protect, and how often the
 * sampled move repeats it; beside them the ranking prior's (DODUO's) own mass on those rows.
 *
 * Reading: mass that FALLS as the passes rise is sampling noise (a Protect row's value is a coin with CRN — the same
 * stall die in every cell of a pass — so a row that won its one or two coins looks best: the winner's curse), and the
 * cure is budget or a branched die. Mass that STAYS at a high cap is what the leaf and the opponent columns believe
 * the repeat is worth — candidates (c) and (e).
 *
 * VARIANTS (--variants, each at --vpasses passes on the same positions; a position is counted for a variant only when
 * that variant's candidate rows hold a repeat, so the mass is CONDITIONAL on the search being offered one):
 *   base       as above;
 *   heuristic  the count-HP heuristic leaf instead of PORYGON2 (does the value net reward the stall? candidate c);
 *   k2x8       eight opponent columns instead of four (is the opponent model too narrow/aggressive? candidate e);
 *   k1x8       eight candidate rows instead of four (is the repeat chosen for its partner's action, bundled in a
 *              short candidate list? candidate d, the ranking).
 */
'use strict';
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const NPOS = +flag('--positions', 40);
const CAPS = String(flag('--caps', '2,8,48')).split(',').map(Number);
const SEED = +flag('--seed', 7);
const VARIANTS = String(flag('--variants', '')).split(',').filter(Boolean);
const VP = +flag('--vpasses', 48);
const VOPT = { base: {}, heuristic: { leaf: 'heuristic' }, k2x8: { k2: 8 }, k1x8: { k1: 8 } };
const path = require('path');
const fs = require('fs');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const FAM = require('../arena/protect_stats.js').family();
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const ROOT = path.join(__dirname, '..', '..');
const G5 = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/gen5.json'), 'utf8')));
const CL = AGm.load(JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8')));
const PA0 = require('../miltank/prior_adapter.js').create(API, null);
const P = require('../mew/pairs.js').load({ teamStore: 'data/team-pool-frozen-regmc' });
const live = m => !!(m && !m.fainted && m.curHP > 0);

const out = Object.fromEntries(CAPS.map(c => [c, { mass: 0, picked: 0 }]));
const vout = Object.fromEntries(VARIANTS.map(v => [v, { offered: 0, mass: 0, picked: 0 }]));
let prior = 0, n = 0, candHas = 0;
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
      const rep = la.slots[k].options.some(o => o.kind === 'move' && FAM.has(o.move));
      if (rep) {
        const body = S.actA[k];
        const isRep = j => j[k] && j[k].kind === 'move' && FAM.has(j[k].move);
        const s = G5.PA.scoreJoints(ctx, S, 'A', 'A', la);
        let tot = 0, rp = 0; la.joint.forEach((j, i) => { tot += s[i]; if (isRep(j)) rp += s[i]; });
        prior += tot ? rp / tot : 0;
        let had = false;
        for (const c of CAPS) {
          const MT = require('../miltank/search.js').create(API, { prior: G5.PA, rollout: AGm.R });
          const coin = M.rngStreams({ seed: 99 + n }).any;
          const r = MT.decide(S, 'A', ctx, { budgetMs: 600000, maxPasses: c, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2',
            leafModel: path.join(ROOT, G5.spec.pory2), coin, record: true });
          if (!r.info || !r.info.rec) continue;
          const rows = r.info.rec.rows;
          if (rows.some(isRep)) had = true;
          out[c].mass += rows.reduce((acc, j, i) => acc + (isRep(j) ? r.info.rec.x[i] : 0), 0);
          if (isRep(r.joint)) out[c].picked++;
        }
        if (had) candHas++;
        for (const v of VARIANTS) {
          const MT = require('../miltank/search.js').create(API, { prior: G5.PA, rollout: AGm.R });
          const coin = M.rngStreams({ seed: 99 + n }).any;
          const o = Object.assign({ budgetMs: 600000, maxPasses: VP, k1: 4, k2: 4, depth: 0, reserveSwitch: 1, leaf: 'pory2',
            leafModel: path.join(ROOT, G5.spec.pory2), coin, record: true }, VOPT[v]);
          if (o.leaf === 'heuristic') delete o.leafModel;
          const r = MT.decide(S, 'A', ctx, o);
          if (!r.info || !r.info.rec || !r.info.rec.rows.some(isRep)) continue;
          vout[v].offered++;
          /* the row values against the solved opponent mix: the best repeat row minus the best other row */
          const rec = r.info.rec, Ay = rec.A.map(row => row.reduce((a, x, j) => a + x * (rec.y ? rec.y[j] : 1 / row.length), 0));
          let br = -1, bo = -1; rec.rows.forEach((j, i) => { if (isRep(j)) br = Math.max(br, Ay[i]); else bo = Math.max(bo, Ay[i]); });
          if (bo >= 0) (vout[v].gaps = vout[v].gaps || []).push(+(br - bo).toFixed(4));
          vout[v].mass += r.info.rec.rows.reduce((acc, j, i) => acc + (isRep(j) ? r.info.rec.x[i] : 0), 0);
          if (isRep(r.joint)) vout[v].picked++;
        }
        n++;
        if (body.tookProtectTurns < 1) throw new Error('probe mutated the battle');
      }
    }
    const jA = bA.choose(S, 'A', ctx).joint, jB = bB.choose(S, 'B', ctx).joint;
    PA0.record(ctx, S, jA, jB);
    API.stepInPlace(S, jA, jB, rng);
  }
}
console.log(`  positions ${n} (a side-A body with the counter >= 1 and its Protect legal); repeat row among the candidates in ${candHas}`);
console.log(`  DODUO (ranking prior) mean mass on repeat joints: ${(prior / n).toFixed(3)}`);
for (const c of CAPS) console.log(`  passes ${String(c).padStart(3)}: mean mix mass on repeat rows ${(out[c].mass / n).toFixed(3)}, sampled a repeat ${out[c].picked}/${n} = ${(out[c].picked / n).toFixed(3)}`);
for (const v of VARIANTS) console.log(`  variant ${v.padEnd(9)} @${VP} passes: repeat offered at ${vout[v].offered}/${n}; mix mass on repeat rows WHEN offered ${(vout[v].mass / Math.max(1, vout[v].offered)).toFixed(3)}, sampled ${vout[v].picked}/${vout[v].offered}`);
for (const v of VARIANTS) if (vout[v].gaps) { const g = vout[v].gaps.slice().sort((a, b) => a - b); console.log(`  variant ${v.padEnd(9)} value gap (best repeat row − best other row, vs the solved column mix): n ${g.length}, median ${g[g.length >> 1]}, min ${g[0]}, max ${g[g.length - 1]}, all ${JSON.stringify(g)}`); }
