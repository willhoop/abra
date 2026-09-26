/* solver/tests/probe_doduo_arena_protect.js — DODUO'S REPEAT-PROTECT PULL ON ITS OWN ARENA POSITIONS, AND WHETHER ITS
 * FEATURES CARRY THE CONSECUTIVE-PROTECT COUNTER (2026-09-27, docs/_reports/2026-09-27-protect-repeat-fix.md).
 *
 *   node solver/tests/probe_doduo_arena_protect.js [--release eaa5becc54eb] [--games 120] [--seed 5] [--model v1|gen5]
 *
 * A MEASUREMENT: prints and exits 0. DODUO-greedy (the human clone: DODUO's argmax legal joint) plays itself on TEST team
 * pairs (both players held out of DODUO's training). At every slot-decision whose body may click a protect-family move,
 * DODUO's own feature vector is read (solver/prior/features.js via the prior adapter) and set beside the ENGINE's counter
 * (`tookProtectTurns`, what the stall roll reads):
 *   agree       stall_repeat (the body's last move was a stallingMove) against counter >= 1
 *   mass        DODUO's slot marginal on the protect family, split by the engine counter
 *   argmax      how often DODUO's argmax joint clicks the family there
 *   held        how many of those clicks held (the engine's own roll)
 * The protect family is derived (solver/arena/protect_stats.js), never listed.
 */
'use strict';
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const NG = +flag('--games', 120);
const SEED = +flag('--seed', 5);
const MODEL = flag('--model', 'v1');
const path = require('path');
const fs = require('fs');
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const FAM = require('../arena/protect_stats.js').family();
const F0 = require('../prior/features.js');
const CI = Object.fromEntries(F0.CAND_NAMES.map((n, i) => [n, i]));
const AGm = require('../mew/agent.js').create(API, { buildBody: T.buildBody });
const ROOT = path.join(__dirname, '..', '..');
const spec = MODEL === 'gen5' ? { name: 'g5greedy', kind: 'greedy', mag: 'solver/machamp/models/gen5/mag-gen5.json', doduo: 'solver/machamp/models/gen5/doduo-gen5.json' }
  : JSON.parse(fs.readFileSync(path.join(ROOT, 'solver/machamp/league/human-clone.json'), 'utf8'));
const CL = AGm.load(spec);
const PA = CL.PA;
const P = require('../mew/pairs.js').load({ teamStore: 'data/team-pool-frozen-regmc' });
const live = m => !!(m && !m.fainted && m.curHP > 0);
const tab = () => ({ n: 0, mass: 0, argmax: 0, held: 0, sr1: 0 });
const T0 = { counter0: tab(), counter1: tab(), counter2: tab() };
const agree = { sr1_c1: 0, sr1_c0: 0, sr0_c1: 0, sr0_c0: 0 };
let games = 0, dec = 0;
for (let g = 0; games < NG && g < P.test.length * 4; g++) {
  const G = P.test[(g * 7 + SEED) % P.test.length];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) continue;
  games++;
  const rng = API.makeRng(SEED * 100003 + g);
  const S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA.newGame(G);
  const bA = CL.bot(1), bB = CL.bot(2);
  for (let t = 0; t < 30 && !API.isTerminal(S); t++) {
    const picks = {};
    for (const side of ['A', 'B']) {
      const la = API.legalActions(S, side);
      const r = (side === 'A' ? bA : bB).choose(S, side, ctx);
      picks[side] = r.joint;
      if (la.joint.length < 2) continue;
      const s = PA.scoreJoints(ctx, S, side, side, la);
      const tot = s.reduce((x, y) => x + y, 0) || 1;
      const pr = CL.prior.predict(PA.row(ctx, S, side), ctx.hist.length, side === 'A' ? 'p1' : 'p2');
      const act = side === 'A' ? S.actA : S.actB;
      for (let k = 0; k < 2; k++) {
        const m = act[k];
        if (!live(m) || !la.slots[k] || !la.slots[k].options.some(o => o.kind === 'move' && FAM.has(o.move))) continue;
        const c = m.tookProtectTurns | 0;
        const key = c === 0 ? 'counter0' : c === 1 ? 'counter1' : 'counter2';
        const slotD = pr && pr.decision && pr.decision.slots[k];
        const sr = slotD ? slotD.cands.some(cd => cd.f[CI.stall_repeat] === 1) : false;
        agree[(sr ? 'sr1' : 'sr0') + '_' + (c > 0 ? 'c1' : 'c0')]++;
        let mass = 0; la.joint.forEach((j, i) => { if (j[k] && j[k].kind === 'move' && FAM.has(j[k].move)) mass += s[i]; });
        const X = T0[key]; X.n++; X.mass += mass / tot; if (sr) X.sr1++;
        const pk = r.joint[k];
        if (pk && pk.kind === 'move' && FAM.has(pk.move)) { X.argmax++; X._pend = X._pend || []; X._pend.push(m); }
        dec++;
      }
    }
    PA.record(ctx, S, picks.A, picks.B);
    const pend = []; for (const X of Object.values(T0)) { if (X._pend) { for (const m of X._pend) pend.push([X, m]); X._pend = null; } }
    API.stepInPlace(S, picks.A, picks.B, rng);
    for (const [X, m] of pend) if ((m.tookProtectTurns | 0) > 0) X.held++;
  }
}
console.log(`  DODUO ${MODEL} greedy vs itself, ${games} TEST-pair games, ${dec} slot-decisions with a protect-family move offered`);
console.log(`  feature vs engine counter: stall_repeat=1 & counter>=1 ${agree.sr1_c1}; stall_repeat=1 & counter=0 ${agree.sr1_c0}; stall_repeat=0 & counter>=1 ${agree.sr0_c1}; stall_repeat=0 & counter=0 ${agree.sr0_c0}`);
for (const [k, X] of Object.entries(T0)) if (X.n) console.log(`  ${k.padEnd(9)} n ${String(X.n).padStart(5)}  stall_repeat fired ${X.sr1}  DODUO mass on family ${(X.mass / X.n).toFixed(3)}  argmax clicks it ${X.argmax} = ${(X.argmax / X.n).toFixed(3)}  of those held ${X.held}`);
