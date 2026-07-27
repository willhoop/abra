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
/* PATHS ARE RELATIVE TO THIS FILE. They were absolute (`C:/Users/willj/Projects/Pokemon/ABRA/` plus a
 * hardcoded SHOWDOWN_PATH default), which makes an audit script unrunnable anywhere but one machine. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const Q = require(path.join(ROOT, 'engine', 'quality.js'));
const SP = require(path.join(ROOT, 'engine', 'set_priors.js'));

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
/* NO SILENT FALLBACK TO AN EMPTY CORPUS. This read `Q.loadGames ? Q.loadGames('ots') : []`, so if the
 * clean loader were ever renamed away this audit would report 0 human sets, 0 generated sets and
 * "difference +0.0 points" — a clean bill of health computed from nothing, in the one script whose job
 * is to catch the sampler being wrong. Absent data is a crash, not a result. */
if (typeof Q.loadGames !== 'function') {
  throw new Error('engine/quality.js no longer exports loadGames(); this audit refuses to run on an ' +
    'unfiltered or empty corpus (Garbodor rule)');
}

/* THE CORPUS IS NAMED BY PATH, NOT BY A WORD.
 *
 * This read `Q.loadGames('ots')`. loadGames takes an OPTIONS OBJECT, so the string had no `.path` and
 * readStore fell back to its default — data/games.ladder.jsonl, the CLOSED-sheet ladder. The audit
 * printed "clean open-sheet games 2,245" and computed its headline from 1,392 sets, because only 116
 * of those 2,245 clean ladder games (5.2%) happen to carry a sheet at all. The premise printed at the
 * top of this file — "no revelation bias" — was false for 95% of the sample.
 *
 * The real open-sheet corpora, measured 2026-07-27:
 *   data/games.bo3.jsonl   2,160 games, 99.5% sheeted, 25,763 full sets — OUR scrape; the Bo3 ruleset
 *                          carries Force Open Team Sheets, so sheets are not optional.
 *   data/games.ots.jsonl   4,167 games,  100% sheeted, 49,843 full sets — external archive, a
 *                          different collection and a different metagame (engine/corpus_shift.js).
 *   data/games.ladder.jsonl 17,075 games, 1.2% sheeted — plain "Open Team Sheets" is OPTIONAL and both
 *                          players must agree, which is why it is almost never on.
 *
 * All three are reported SEPARATELY rather than pooled. Pooling a forced-sheet ladder with an external
 * archive would hide a corpus-dependent answer inside one average, and whether the conclusion survives
 * a change of corpus is the actual question. */
const CORPORA = [
  ['bo3    (ours, sheets forced)', path.join(ROOT, 'data', 'games.bo3.jsonl')],
  ['ots    (external archive)', path.join(ROOT, 'data', 'games.ots.jsonl')],
  ['ladder (sheets optional)', path.join(ROOT, 'data', 'games.ladder.jsonl')],
];

/* Wilson interval, so "is this gap real" is answerable rather than eyeballed. Two independent
 * proportions, so the difference gets the sum of variances. */
function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.959964, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [100 * (c - h), 100 * (c + h)];
}
function diffCI(k1, n1, k2, n2) {
  if (!n1 || !n2) return [NaN, NaN];
  const p1 = k1 / n1, p2 = k2 / n2, z = 1.959964;
  const se = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  return [100 * ((p2 - p1) - z * se), 100 * ((p2 - p1) + z * se)];
}

function collect(storePath) {
  if (!fs.existsSync(storePath)) return null;
  const games = Q.loadGames({ path: storePath });
  const human = [], pool = new Map();
  let sheeted = 0;
  for (const g of games) {
    let any = false;
    for (const side of ['p1', 'p2']) {
      for (const st of (g.sheets && g.sheets[side]) || []) {
        if (!st || !Array.isArray(st.moves) || st.moves.length < 4) continue;
        human.push(st.moves);
        pool.set(st.species, (pool.get(st.species) || 0) + 1);
        any = true;
      }
    }
    if (any) sheeted++;
  }
  return { games, human, pool, sheeted };
}

let CHOSEN = null;
for (const [label, storePath] of CORPORA) {
  const c = collect(storePath);
  if (!c) { console.log(`${label}  MISSING`); continue; }
  /* Generated sets weighted to the SAME species mix, so the comparison is like-for-like. One draw per
   * observed sheet rather than one per four: the generated side was a quarter the size of the human
   * side, which put the whole interval on the smaller sample for no reason. */
  const gen = [];
  let seed = 12345;
  for (const [sp, count] of c.pool) {
    for (let i = 0; i < count; i++) {
      try {
        const f = SP.fillSet(sp, {}, seed++);
        if (f && Array.isArray(f.moves)) gen.push(f.moves.slice(0, 4));
      } catch (e) { /* species has no prior */ }
    }
  }
  const H = rate(c.human), G = rate(gen);
  const hCI = wilson(H.dup, H.n), gCI = wilson(G.dup, G.n), dCI = diffCI(H.dup, H.n, G.dup, G.n);
  console.log(`\n=== ${label} ===`);
  console.log(`  clean games ${c.games.length.toLocaleString()}  |  carrying a full sheet ${c.sheeted.toLocaleString()} ` +
    `(${(100 * c.sheeted / Math.max(1, c.games.length)).toFixed(1)}%)  |  species ${c.pool.size}`);
  console.log(`  HUMAN      ${String(H.n).padStart(6)} sets   ${H.pct.toFixed(1).padStart(5)}%  95% CI [${hCI[0].toFixed(1)}, ${hCI[1].toFixed(1)}]`);
  console.log(`  GENERATED  ${String(G.n).padStart(6)} sets   ${G.pct.toFixed(1).padStart(5)}%  95% CI [${gCI[0].toFixed(1)}, ${gCI[1].toFixed(1)}]`);
  const real = dCI[0] > 0 || dCI[1] < 0;
  console.log(`  difference ${(G.pct - H.pct >= 0 ? '+' : '')}${(G.pct - H.pct).toFixed(1)} points  ` +
    `95% CI [${dCI[0].toFixed(1)}, ${dCI[1].toFixed(1)}]  -> ${real ? 'clears zero' : 'CONTAINS ZERO: not distinguishable from noise'}`);
  if (!CHOSEN && c.sheeted > 100) CHOSEN = { label, ...c, gen };
}

if (!CHOSEN) throw new Error('no corpus had more than 100 sheeted games — nothing to audit');
console.log(`\nPER-SPECIES BREAKDOWN uses ${CHOSEN.label}, the largest forced-sheet corpus available.`);
const games = CHOSEN.games, human = CHOSEN.human, pool = CHOSEN.pool, gen = CHOSEN.gen;
let seed = 999983;

/* Which species the sampler mangles worst — the actionable list. Each row carries the interval on its
 * own gap, because a per-species row is a much smaller sample than the headline and several of these
 * were quoted as findings ("Incineroar 0.0% -> 22.5%") without one. */
const per = [];
const bySpecies = new Map();
for (const g of games) for (const side of ['p1', 'p2'])
  for (const st of (g.sheets && g.sheets[side]) || []) {
    if (!st || !Array.isArray(st.moves) || st.moves.length < 4) continue;
    if (!bySpecies.has(st.species)) bySpecies.set(st.species, []);
    bySpecies.get(st.species).push(st.moves);
  }
for (const [sp, count] of pool) {
  if (count < 40) continue;
  const hs = bySpecies.get(sp) || [], gs = [];
  /* Match the generated sample size to the observed one. 200 draws against 40 observations put a tight
   * interval on the model and a loose one on the truth, then reported the gap as if both were solid. */
  const target = Math.max(200, hs.length);
  for (let i = 0; i < target; i++) {
    try { const f = SP.fillSet(sp, {}, seed++); if (f && f.moves) gs.push(f.moves.slice(0, 4)); } catch (e) {}
  }
  const a = rate(hs), b = rate(gs);
  if (a.n >= 20 && b.n >= 20) {
    const d = diffCI(a.dup, a.n, b.dup, b.n);
    per.push([sp, a.pct, b.pct, b.pct - a.pct, a.n, d]);
  }
}
per.sort((x, y) => y[3] - x[3]);
console.log(`\nWORST OFFENDERS (species with 40+ observed sheets)`);
console.log(`  species              human   generated      gap   95% CI on the gap    real?`);
for (const [sp, h, g2, d, n, ci] of per.slice(0, 14)) {
  const real = ci[0] > 0 || ci[1] < 0;
  console.log(`  ${sp.padEnd(20)} ${h.toFixed(1).padStart(5)}%   ${g2.toFixed(1).padStart(6)}%   ${(d >= 0 ? '+' : '')}${d.toFixed(1).padStart(6)}   ` +
    `[${ci[0].toFixed(1).padStart(6)}, ${ci[1].toFixed(1).padStart(6)}]   ${real ? 'yes' : 'NO — noise'}   (n=${n})`);
}
const realRows = per.filter(r => r[5][0] > 0 || r[5][1] < 0).length;
console.log(`\n  ${realRows} of ${per.length} per-species gaps clear zero. The rest are sample size.`);
