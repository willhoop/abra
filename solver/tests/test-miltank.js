/* solver/tests/test-miltank.js — MILTANK v1's parts, on positions from REAL Reg M-C open sheets.
 *
 *   node solver/tests/test-miltank.js [--no-red] [--games 12]     exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *
 * Positions: the humans' own teams and brings (solver/arena/teams.js), played forward by uniform legal
 * joints; every position below is one the API itself produced. Clauses:
 *   SUPPORT  every option the playout policy may pick (rollout.slotSupport) is an option `legalActions`
 *            offers for that slot — the playout policy never plays an illegal click.
 *   SWAP     swapping each unrevealed opponent bench body for a FRESH copy of its own sheet row leaves
 *            the battle digest unchanged (the swap stamps exactly what battleInit stamps), and a sampled
 *            world leaves every revealed body as it was and draws only unrevealed sheet rows, distinct.
 *   CRN      a playout is a function of its seed: the same (world, joints, seed) gives the same value.
 *   ALIGN    the prior adapter asks about the right bodies: each live active slot's prior decision is
 *            for the sheet row of the body actually in that slot — after switches, which REORDER the
 *            engine's party (the first version of the adapter got this wrong and nothing failed).
 *   SEARCH   decide() returns a joint `legalActions` offers, leaves S untouched (digest), fires its
 *            counters (playouts, worlds, reserved switch slots), and reports a SLOWKING gap <= 1e-3.
 *   NOLEAK   the decision does not depend on the opponent's HIDDEN back line: with the unrevealed bench
 *            replaced by other unrevealed sheet rows, the same seed gives the same joint and value.
 *
 * RED, unless --no-red: re-runs itself under each deliberate break and REQUIRES the named clause to fail:
 *   MILTANK_BREAK=support -> SUPPORT, swapstamp -> SWAP, crn -> CRN, peek -> NOLEAK;
 *   PRIOR_ADAPTER_BREAK=teamindex -> ALIGN.
 */
'use strict';
require('../arena/env.js');
const cp = require('child_process');
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const GAMES = +((i => (i >= 0 ? argv[i + 1] : 0))(argv.indexOf('--games')) || 10);

const API = require('../../engine/medicham_api.js');
const M = API.M;
const T = require('../arena/teams.js');
const F = require('../prior/features.js');
const prior = require('../prior/infer.js').load();
const PA = require('../miltank/prior_adapter.js').create(API, prior);
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); if (fails <= 25) console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = why => { console.log('CANNOT ANSWER: ' + why); process.exit(2); };

const L = T.loadGames({ n: GAMES, seed: 7, M });
if (L.refused) cannot(L.refused);
if (L.games.length < Math.min(4, GAMES)) cannot('too few buildable games');
const live = m => !!(m && !m.fainted && m.curHP > 0);
const sameOpt = (a, b) => a.kind === b.kind && (a.kind === 'switch' ? a.to === b.to
  : a.kind === 'pass' || (a.move === b.move && (a.target == null ? null : a.target) === (b.target == null ? null : b.target) && !!a.mega === !!b.mega && !!a.forced === !!b.forced));
const jointKey = j => j.map(o => o.choice || JSON.stringify(o)).join(' / ');

/* ---------- collect positions ---------- */
const positions = [];
for (let gi = 0; gi < L.games.length; gi++) {
  const G = L.games[gi];
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  const rng = API.makeRng(100 + gi);
  let S = API.newBattle(a.team, b.team, { rng });
  const ctx = PA.newGame(G);
  const coin = M.rngStreams({ seed: 200 + gi }).any;
  while (!API.isTerminal(S) && S.turn < 40) {
    positions.push({ G, S: API.clone(S), ctx: { G, hist: ctx.hist.slice() } });
    const jA = API.legalActions(S, 'A').joint, jB = API.legalActions(S, 'B').joint;
    const x = jA[Math.floor(coin() * jA.length)], y = jB[Math.floor(coin() * jB.length)];
    PA.record(ctx, S, x, y);
    API.stepInPlace(S, x, y, rng);
  }
}
console.log('test-miltank: ' + positions.length + ' positions from ' + L.games.length + ' real Reg M-C team pairs');

/* ---------- SUPPORT ---------- */
{
  let opts = 0, switchesSeen = 0;
  for (const P of positions) for (const sd of ['A', 'B']) {
    const la = API.legalActions(P.S, sd);
    const C = API.clone(P.S);
    la.slots.forEach((s, k) => {
      for (const o of R.slotSupport(C, sd, k)) {
        opts++; if (o.kind === 'switch') switchesSeen++;
        ok('SUPPORT', s.options.some(x => sameOpt(x, o)), 'turn ' + P.S.turn + ' side ' + sd + ' slot ' + k + ' policy option not legal: ' + JSON.stringify(o));
      }
    });
  }
  ok('SUPPORT', opts > 500 && switchesSeen > 0, 'support sample too thin: ' + opts + ' options, ' + switchesSeen + ' switches');
  console.log('  SUPPORT: ' + opts + ' policy options checked against legalActions');
}

/* ---------- SWAP ---------- */
{
  let swaps = 0, worlds = 0;
  for (const P of positions) for (const sd of ['A', 'B']) {
    const rev = PA.revealed(P.S, sd);
    const sf = sd === 'A' ? P.S.sfA : P.S.sfB;
    const hidden = sf.team.map((m, k) => k).filter(k => !rev.has(k));
    if (!hidden.length) continue;
    const W = API.clone(P.S);
    const sfW = sd === 'A' ? W.sfA : W.sfB;
    for (const k of hidden) { const s = sfW.team[k]._solverSheet; R.swapBody(W, sd, k, R.body(P.G.sheets[sd === 'A' ? 'p1' : 'p2'][s], s)); swaps++; }
    ok('SWAP', API.digest(W) === API.digest(P.S), 'identity swap changed the digest at turn ' + P.S.turn + ' side ' + sd);
    /* a sampled world */
    const coin = M.rngStreams({ seed: 999 + P.S.turn }).any;
    const Wd = R.sampleWorld(P.S, sd, { sheet: P.G.sheets[sd === 'A' ? 'p1' : 'p2'], revealed: rev }, coin);
    worlds++;
    const sfD = sd === 'A' ? Wd.sfA : Wd.sfB;
    const revRows = new Set([...rev].map(k => sf.team[k]._solverSheet));
    const drawn = hidden.map(k => sfD.team[k]._solverSheet);
    ok('SWAP', drawn.every(s => !revRows.has(s)) && new Set(drawn).size === drawn.length, 'world drew a revealed or repeated row ' + drawn);
    for (const k of rev) ok('SWAP', JSON.stringify(Object.keys(sfD.team[k])) === JSON.stringify(Object.keys(sf.team[k])) && sfD.team[k].curHP === sf.team[k].curHP && sfD.team[k].name === sf.team[k].name, 'world changed revealed body ' + k);
    for (const k of hidden) ok('SWAP', sfD.team[k]._sf === sfD && (sd === 'A' ? Wd.benchA : Wd.benchB).includes(sfD.team[k]), 'swapped body not wired into its side');
  }
  ok('SWAP', swaps > 20 && worlds > 10, 'too few swaps to answer: ' + swaps);
  console.log('  SWAP: ' + swaps + ' identity swaps, ' + worlds + ' sampled worlds');
}

/* ---------- CRN ---------- */
{
  let n = 0, differ = 0;
  for (const P of positions.filter((_, i) => i % 3 === 0)) {
    const la = API.legalActions(P.S, 'A'), lb = API.legalActions(P.S, 'B');
    const jA = la.joint[0], jB = lb.joint[lb.joint.length - 1];
    const v1 = R.playout(P.S, jA, jB, 4242, 2), v2 = R.playout(P.S, jA, jB, 4242, 2);
    ok('CRN', v1 === v2, 'same seed, different value: ' + v1 + ' vs ' + v2 + ' at turn ' + P.S.turn);
    const v3 = R.playout(P.S, jA, jB, 777, 2);
    if (v3 !== v1) differ++;
    n++;
  }
  ok('CRN', differ > 0, 'no two seeds ever differ in ' + n + ' positions — the dice are not reaching the playout');
  console.log('  CRN: ' + n + ' positions, ' + differ + ' where another seed changed the value');
}

/* ---------- ALIGN ---------- */
{
  let slots = 0;
  for (const P of positions) for (const sd of ['A', 'B']) {
    const d = F.decide(PA.row(P.ctx, P.S, sd), P.ctx.hist.length, sd === 'A' ? 'p1' : 'p2', prior.freq);
    const act = sd === 'A' ? P.S.actA : P.S.actB;
    for (let k = 0; k < 2; k++) {
      if (!live(act[k])) continue;
      slots++;
      ok('ALIGN', d.slots[k] && d.slots[k].mon === act[k]._solverSheet, 'turn ' + P.S.turn + ' side ' + sd + ' slot ' + k + ': prior asked about row ' + (d.slots[k] && d.slots[k].mon) + ', body in slot is row ' + act[k]._solverSheet);
    }
  }
  console.log('  ALIGN: ' + slots + ' active slots');
}

/* ---------- SEARCH + NOLEAK ---------- */
{
  const sample = positions.filter((_, i) => i % 5 === 0).slice(0, 14);
  let leakChecks = 0;
  const before = { playouts: MT.COUNTERS.playouts, worlds: R.COUNTERS.worlds, rs: MT.COUNTERS.reservedSwitch };
  for (const P of sample) {
    const dg = API.digest(P.S);
    const coinSeed = 31337 + P.S.turn;
    const d = MT.decide(P.S, 'A', P.ctx, { budgetMs: 1e9, maxPasses: 1, k1: 5, k2: 5, depth: 1, coin: M.rngStreams({ seed: coinSeed }).any });
    ok('SEARCH', API.digest(P.S) === dg, 'decide mutated S');
    const legal = API.legalActions(P.S, 'A').joint.map(jointKey);
    ok('SEARCH', legal.includes(jointKey(d.joint)), 'decide returned a joint legalActions does not offer: ' + jointKey(d.joint));
    if (d.info.forced) continue;
    ok('SEARCH', d.info.unfilled === 0 && d.info.gap <= 1e-3, 'unfilled ' + d.info.unfilled + ' gap ' + d.info.gap);
    /* NOLEAK: rebuild B's hidden back line from OTHER unrevealed rows where the sheet allows it */
    const rev = PA.revealed(P.S, 'B');
    const hidden = P.S.sfB.team.map((m, k) => k).filter(k => !rev.has(k));
    const used = new Set(P.S.sfB.team.map(m => m._solverSheet));
    const spare = P.G.sheets.p2.map((r, s) => s).filter(s => !used.has(s) && T.buildBody(M, P.G.sheets.p2[s]));
    if (!hidden.length || !spare.length) continue;
    const S2 = API.clone(P.S);
    hidden.forEach((k, i) => { if (i < spare.length) R.swapBody(S2, 'B', k, R.body(P.G.sheets.p2[spare[i]], spare[i])); });
    ok('NOLEAK', API.digest(S2) !== API.digest(P.S), 'the replaced back line did not change the battle');
    const d2 = MT.decide(S2, 'A', P.ctx, { budgetMs: 1e9, maxPasses: 1, k1: 5, k2: 5, depth: 1, coin: M.rngStreams({ seed: coinSeed }).any });
    ok('NOLEAK', jointKey(d2.joint) === jointKey(d.joint) && d2.info.value === d.info.value,
       'decision moved with the hidden back line at turn ' + P.S.turn + ': value ' + d.info.value + ' -> ' + d2.info.value);
    leakChecks++;
  }
  ok('SEARCH', MT.COUNTERS.playouts > before.playouts && R.COUNTERS.worlds > before.worlds && MT.COUNTERS.reservedSwitch > before.rs,
     'a search capability never fired: ' + JSON.stringify(MT.COUNTERS));
  ok('NOLEAK', leakChecks >= 3, 'too few positions to answer NOLEAK: ' + leakChecks);
  console.log('  SEARCH: ' + sample.length + ' decisions; NOLEAK: ' + leakChecks + ' hidden-line swaps');
}

const brk = R.BROKEN || PA.BROKEN;
console.log('test-miltank: ' + (checks - fails) + '/' + checks + ' checks' + (brk ? '  [BREAK ' + brk + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));

if (!NO_RED && !brk) {
  const need = [['MILTANK_BREAK', 'support', 'SUPPORT'], ['MILTANK_BREAK', 'swapstamp', 'SWAP'], ['MILTANK_BREAK', 'crn', 'CRN'],
                ['MILTANK_BREAK', 'peek', 'NOLEAK'], ['PRIOR_ADAPTER_BREAK', 'teamindex', 'ALIGN']];
  let blind = 0;
  for (const [envk, v, clause] of need) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--games', String(GAMES)], { env: Object.assign({}, process.env, { [envk]: v }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-miltank:') && l.includes('failed clauses')) || '';
    const seen = new RegExp('failed clauses: .*\\b' + clause + '\\b').test(line) && res.status === 1;
    console.log('  RED ' + envk + '=' + v + ' -> ' + clause + ': ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)  ' + line));
    if (!seen) blind++;
  }
  if (blind) { console.log('BLIND: ' + blind + ' clause(s) did not see their break'); process.exit(3); }
}
process.exit(fails ? 1 : 0);
