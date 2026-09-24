/* solver/tests/test-xatu-bring.js — pins XATU's back-two belief (solver/xatu/bring.js).
 * Exits non-zero on any failure.   node solver/tests/test-xatu-bring.js
 * Synthetic sheets use opaque species ids (s0, s1, ...): nothing here is a Pokemon fact. */
'use strict';
const { BringMemory, BringModel, condition, fit, pairsOf, FEATURES } = require('../xatu/bring.js');
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };
let seed = 99; const R = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// 1. condition(): a pair containing every seen member keeps positive mass; every other pair is zero
{
  const cands = pairsOf([2, 3, 4, 5]).map(pair => ({ pair, p: 1 / 6 }));
  ok(cands.length === 6, 'four unseen give six pairs');
  for (const seen of [[], [3], [2, 5]]) {
    const { dist, empty } = condition(cands, seen);
    ok(!empty, 'not empty for consistent reveals ' + seen);
    const z = dist.reduce((a, d) => a + d.p, 0);
    ok(Math.abs(z - 1) < 1e-12, 'renormalised');
    for (const d of dist) ok((d.p > 0) === seen.every(i => d.pair.includes(i)), `pair ${d.pair} mass matches consistency with ${seen}`);
  }
  ok(condition(cands, [2, 3, 4]).empty, 'three back members is impossible and reported as empty');
}

// 2. the softmax prior never gives a pair zero mass, even with extreme weights
{
  const m = new BringModel({ w: { team: 50, pop: -40 }, theta: { s0: 30, s1: -30 } });
  const sh = [0, 1, 2, 3, 4, 5].map(i => ({ sp: 's' + i, item: 'i' + i }));
  const cands = pairsOf([0, 1, 2, 3]).map(pair => ({ pair, phi: Object.fromEntries(FEATURES.map(f => [f, R() * 4 - 2])) }));
  const pr = m.prior(sh, cands);
  ok(pr.every(d => d.p > 0), 'every pair positive under an extreme model');
  ok(Math.abs(pr.reduce((a, d) => a + d.p, 0) - 1) < 1e-12, 'prior sums to one');
}

// 3. the fit recovers a planted model: species propensities that drive the back pair
{
  const NS = 12;
  const truth = Array.from({ length: NS }, (_, i) => (i % 4) - 1.5);      // planted theta
  const items = [];
  for (let g = 0; g < 3000; g++) {
    const sp = []; while (sp.length < 6) { const s = Math.floor(R() * NS); if (!sp.includes(s)) sp.push(s); }
    const sh = sp.map(s => ({ sp: 's' + s, item: '' }));
    const cands = pairsOf([2, 3, 4, 5]).map(pair => ({ pair, phi: Object.fromEntries(FEATURES.map(f => [f, 0])) }));
    const sc = cands.map(c => truth[sp[c.pair[0]]] + truth[sp[c.pair[1]]]);
    const z = sc.reduce((a, v) => a + Math.exp(v), 0);
    let u = R() * z, k = 0; for (; k < 5; k++) { u -= Math.exp(sc[k]); if (u <= 0) break; }
    // half the games reveal only one back member (coarsened)
    const back = cands[k].pair;
    const revealed = R() < 0.5 ? back : [back[0]];
    items.push({ sh, cands, consistent: new Set(cands.map((c, i) => (revealed.every(b => c.pair.includes(b)) ? i : -1)).filter(i => i >= 0)) });
  }
  const { model } = fit(items, { iters: 400, lr: 0.05, l2: 0.1 });
  // compare centred thetas
  const est = truth.map((_, i) => model.theta['s' + i] || 0);
  const mE = est.reduce((a, b) => a + b, 0) / NS, mT = truth.reduce((a, b) => a + b, 0) / NS;
  const err = Math.max(...est.map((e, i) => Math.abs((e - mE) - (truth[i] - mT))));
  ok(err < 0.35, `planted species propensities recovered (max abs error ${err.toFixed(3)})`);
}

// 4. BringMemory is ONLINE: a game's features do not see the game itself, and do see earlier games
{
  const mem = new BringMemory();
  const sheet = [0, 1, 2, 3, 4, 5].map(i => ({ sp: 's' + i, item: 'i' + i }));
  const opp = [6, 7, 8, 9, 10, 11].map(i => ({ sp: 's' + i, item: 'i' + i }));
  const rec = { sheets: { p1: sheet, p2: opp }, leads: { p1: [0, 1], p2: [0, 1] }, final: { p1: [0, 1, 2, 3], p2: [0, 1, 4, 5] },
    winner: 'p1', series: 'S', gnum: 1, players: { p1: 'a', p2: 'b' } };
  const before = mem.features(rec, 'p1', [0, 1]);
  ok(before.every(c => c.phi.team_seen === 0 && c.phi.teamlead_seen === 0 && c.phi.series_same === 0), 'no memory before the game is added');
  mem.addGame(rec);
  const rec2 = { ...rec, gnum: 2 };
  const after = mem.features(rec2, 'p1', [0, 1]);
  const p23 = after.find(c => c.pair.includes(2) && c.pair.includes(3));
  const p45 = after.find(c => c.pair.includes(4) && c.pair.includes(5));
  ok(p23.phi.team_seen === 1 && p23.phi.teamlead > p45.phi.teamlead, 'same team + same leads: the earlier back pair is favoured');
  ok(p23.phi.series_same === 1 && p45.phi.series_same === 0, 'series carry-over marks the earlier back pair');
  const rec3 = { ...rec, gnum: 1, series: 'T' };
  ok(mem.features(rec3, 'p1', [0, 1]).every(c => c.phi.series_same === 0), 'a different series carries nothing');
}

console.log(`test-xatu-bring: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
