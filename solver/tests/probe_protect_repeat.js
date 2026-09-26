/* solver/tests/probe_protect_repeat.js — DOES THE SEARCH'S ENGINE CHARGE FOR A SECOND PROTECT? (2026-09-26)
 *
 *   node solver/tests/probe_protect_repeat.js [--release eaa5becc54eb] [--n 600]
 *
 * A MEASUREMENT, NOT A GATE: it prints and exits 0 (2 if it could not stage a board). It answers candidate (a) of
 * docs/_reports/2026-09-26-protect-overuse.md: does MEDICHAM, on the frozen release the search plays, apply the
 * consecutive-use failure chance of the `stall` volatile, in a FULL battle and in the LEAN mode every MILTANK playout
 * runs under — and what does a position that has LOST the counter (ROTOM's world before 2026-09-26) predict instead.
 *
 * The rule is read from the checkout, never typed: data/conditions.ts `stall` (printed below from the format's own
 * condition: counter 3 at onStart, ×3 at onRestart, `randomChance(1, counter)` at onStallMove, `duration: 2`).
 *
 * THE BOARD IS DERIVED. The first test pair of data/team-pool-frozen-regmc whose side-A lead in slot 0 carries a
 * `stallingMove` and whose side-B leads both carry a move that is not one. Turn 1: A slot 0 clicks that move, every
 * other slot clicks its first legal non-stalling option. Turn 2: the same clicks. Per seed the battle is new; the
 * measured quantity is turn 2's success (the body's counter `tookProtectTurns` above 0 after the turn), over the
 * turns where turn 1's shield went up. Three arms:
 *   full          a full battle, turn 2 as played;
 *   lean          the same battle made lean before turn 2 (API.makeLean — exactly what rollout.js does to a playout copy);
 *   counter-lost  the full battle with `tookProtectTurns` zeroed before turn 2: the position a world builder that does
 *                 not carry the counter hands the search.
 * Expect full ≈ lean ≈ 1/3 and counter-lost ≈ 1.
 */
'use strict';
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');
const N = +flag('--n', 600);
const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const X = require('../human/dex.js');
const PAIRS = require('../mew/pairs.js');

const stalling = id => { const m = X.D.moves.get(id); return !!(m && m.exists && m.stallingMove); };
const st = X.D.conditions.get('stall');
console.log('  stall (from the format): duration', st.duration, ' counterMax', st.counterMax);
console.log('   ', String(st.onStallMove).replace(/\s+/g, ' ').slice(0, 200));

const P = PAIRS.load({ teamStore: 'data/team-pool-frozen-regmc' });
function firstPlain(la, k) { return la.slots[k].options.find(o => o.kind === 'move' && !o.mega && !stalling(o.move)); }
let G = null, shieldId = null;
for (const g of P.test) {
  const a = T.buildTeam(M, g, 'p1'), b = T.buildTeam(M, g, 'p2');
  if (!a || !b) continue;
  const S = API.newBattle(a.team, b.team, { rng: API.makeRng(1) });
  const la = API.legalActions(S, 'A'), lb = API.legalActions(S, 'B');
  const sh = la.slots[0].options.find(o => o.kind === 'move' && !o.mega && stalling(o.move));
  if (sh && firstPlain(la, 1) && firstPlain(lb, 0) && firstPlain(lb, 1)) { G = g; shieldId = sh.move; break; }
}
if (!G) { console.log('  COULD NOT STAGE: no test pair with a stalling move on A slot 0 — a claim about the fixture'); process.exit(2); }
console.log('  board: pair', G.id, ' A slot 0 =', G.sheets.p1[G.brought.p1[0]].species, 'clicking', shieldId);

function joints(S) {
  const la = API.legalActions(S, 'A'), lb = API.legalActions(S, 'B');
  const a0 = la.slots[0].options.find(o => o.kind === 'move' && !o.mega && o.move === shieldId);
  return { jA: [a0, firstPlain(la, 1)], jB: [firstPlain(lb, 0), firstPlain(lb, 1)] };
}
const arms = { full: [0, 0], lean: [0, 0], 'counter-lost': [0, 0] };
let t1up = 0, t1n = 0;
for (let seed = 1; seed <= N; seed++) {
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  const rng = API.makeRng(seed);
  const S = API.newBattle(a.team, b.team, { rng });
  const j1 = joints(S);
  if (!j1.jA[0]) continue;
  API.stepInPlace(S, j1.jA, j1.jB, rng);
  t1n++;
  const me = S.actA[0];
  if (!(me && !me.fainted && me.tookProtectTurns > 0)) continue;
  t1up++;
  for (const arm of Object.keys(arms)) {
    const W = API.clone(S);
    if (arm === 'lean') API.makeLean(W);
    if (arm === 'counter-lost') for (const m of [...W.actA, ...W.actB]) if (m) { m.tookProtectTurns = 0; m._stallFresh = false; }
    const j2 = joints(W);
    if (!j2.jA[0]) continue;
    const r2 = API.makeRng(seed * 7919 + 13);
    API.stepInPlace(W, j2.jA, j2.jB, r2);
    const m2 = W.actA[0];
    arms[arm][1]++;
    if (m2 && m2.tookProtectTurns > 0) arms[arm][0]++;
  }
}
console.log('  turn 1: shield up on', t1up, 'of', t1n);
for (const [k, [s, n]] of Object.entries(arms)) console.log('  turn 2 ' + k.padEnd(13) + ' success', s, '/', n, '=', n ? (s / n).toFixed(3) : 'n/a');
