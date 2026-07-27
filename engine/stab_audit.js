/* Do generated sets carry more same-type attacking moves than human sets do?
 *
 * set_priors samples each move independently from P(move | species). Independence IS the question:
 * real sets are negatively correlated within a role. Gunk Shot is a perfectly normal Sneasler move
 * and so is Dire Claw, but they compete for one slot and so almost never co-occur. A sampler drawing
 * marginals cannot represent that, and will pair them at roughly P(a)*P(b).
 *
 * Ground truth is the OPEN TEAM SHEET, which publishes all four moves — no revelation bias at all.
 * Clean games only (Garbodor rule: quality.isClean, never the raw store). */
const fs = require('fs');
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const R = 'C:/Users/willj/Projects/Pokemon/ABRA/';
const CS = require(R + 'engine/champions_sim.js');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const Q = require(R + 'engine/quality.js');
const SP = require(R + 'engine/set_priors.js');

/* worst = the largest number of ATTACKING moves sharing one type in a set */
const worstDup = moves => {
  const c = {};
  let worst = 0;
  for (const mv of moves) {
    const m = dex.moves.get(mv);
    if (!m || !m.exists || m.category === 'Status') continue;
    c[m.type] = (c[m.type] || 0) + 1;
    if (c[m.type] > worst) worst = c[m.type];
  }
  return worst;
};
const rate = sets => {
  let n = 0, dup = 0, trip = 0;
  for (const mv of sets) {
    if (!mv || mv.length < 4) continue;
    n++;
    const w = worstDup(mv);
    if (w >= 2) dup++;
    if (w >= 3) trip++;
  }
  return { n, dup, trip, pct: 100 * dup / Math.max(1, n), tpct: 100 * trip / Math.max(1, n) };
};

/* ---- human sets from open sheets, clean games only ------------------------------------------ */
const games = Q.loadGames ? Q.loadGames('ots') : [];
const human = [];
const pool = new Map();
for (const g of games) {
  for (const side of ['p1', 'p2']) {
    for (const st of (g.sheets && g.sheets[side]) || []) {
      if (!st || !Array.isArray(st.moves)) continue;
      human.push(st.moves);
      pool.set(st.species, (pool.get(st.species) || 0) + 1);
    }
  }
}

/* ---- generated sets, weighted to the SAME species mix so the comparison is like-for-like ----- */
const gen = [];
let seed = 12345;
for (const [sp, count] of pool) {
  const draws = Math.max(1, Math.round(count / 4));
  for (let i = 0; i < draws; i++) {
    try {
      const f = SP.fillSet(sp, {}, seed++);
      if (f && Array.isArray(f.moves)) gen.push(f.moves.slice(0, 4));
    } catch (e) { /* species has no prior */ }
  }
}

const H = rate(human), G = rate(gen);
console.log(`clean open-sheet games      ${games.length.toLocaleString()}`);
console.log(`distinct species            ${pool.size}`);
console.log(`\n                            two+ same-type attacks    three+`);
console.log(`HUMAN      ${String(H.n).padStart(7)} sets       ${H.pct.toFixed(1).padStart(5)}%              ${H.tpct.toFixed(1)}%`);
console.log(`GENERATED  ${String(G.n).padStart(7)} sets       ${G.pct.toFixed(1).padStart(5)}%              ${G.tpct.toFixed(1)}%`);
console.log(`\ndifference                  ${(G.pct - H.pct >= 0 ? '+' : '')}${(G.pct - H.pct).toFixed(1)} points`);

/* which species the sampler mangles worst — the actionable list */
const per = [];
for (const [sp, count] of pool) {
  if (count < 40) continue;
  const hs = [], gs = [];
  for (const g of games) for (const side of ['p1', 'p2'])
    for (const st of (g.sheets && g.sheets[side]) || [])
      if (st.species === sp && Array.isArray(st.moves) && st.moves.length >= 4) hs.push(st.moves);
  let sd = seed;
  for (let i = 0; i < 200; i++) {
    try { const f = SP.fillSet(sp, {}, sd++); if (f && f.moves) gs.push(f.moves.slice(0, 4)); } catch (e) {}
  }
  const a = rate(hs), b = rate(gs);
  if (a.n >= 20 && b.n >= 20) per.push([sp, a.pct, b.pct, b.pct - a.pct, a.n]);
}
per.sort((x, y) => y[3] - x[3]);
console.log(`\nWORST OFFENDERS (species with 40+ observed sheets)`);
console.log(`  species              human   generated   gap`);
for (const [sp, h, g2, d] of per.slice(0, 12))
  console.log(`  ${sp.padEnd(20)} ${h.toFixed(1).padStart(5)}%   ${g2.toFixed(1).padStart(6)}%   ${(d >= 0 ? '+' : '')}${d.toFixed(1)}`);
