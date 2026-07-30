/* team_heterogeneity.js — is a null result actually ZERO, or is it a win on some teams and a loss
 * on others that averages to zero?
 *
 *   SHOWDOWN_PATH=... node engine/team_heterogeneity.js data/games.h2h-featsw.jsonl
 *
 * WHY THIS EXISTS
 * ---------------
 * VGC-Bench (arXiv 2506.10326) measures policy performance COLLAPSING as the team pool grows: agents
 * trained on 3 teams score 21% in-distribution, on 10 teams 17%, on 30 teams 8%. ABRA's pool is
 * 4,885 teams. If a single fixed policy cannot be good across that many teams, then a change which
 * helps on some and hurts on others reads as a clean null in the aggregate — and the aggregate is
 * the only thing this project has ever looked at.
 *
 * WHAT THIS IS NOT. It is tempting to say the nulls are "drowned in team variance", and that is
 * WRONG: paired_h2h already removes team bias by construction. A matchup one side wins regardless of
 * policy produces a SPLIT, and splits are discarded rather than averaged in. Team diversity costs
 * SAMPLE SIZE, not validity. So the honest question is not "is the estimate biased" — it is not —
 * but "is there one effect here at all, or many effects with different signs".
 *
 * THE TEST. Under the null that every team shares one true win rate p, the per-team decisive wins
 * are binomial and the spread of per-team rates is fully predicted by the counts. Real heterogeneity
 * shows up as OVERDISPERSION: more spread than binomial allows. Pearson's chi-square over teams
 * measures exactly that, and with many teams it is approximately normal with mean df and sd
 * sqrt(2·df), which gives a z for "more spread than chance".
 *
 * A team here is a SIX, keyed by its sorted species list, and each pair contributes its two sides.
 * Teams with fewer than MIN decisive pairs are pooled out rather than left to add noise as singletons.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const file = process.argv[2] || 'data/games.h2h-featsw.jsonl';
const MIN = +(process.env.MIN_PAIRS || 8);

/* Same pairing rules as paired_h2h: one seed is one pair, both halves must be the same matchup
 * played from opposite sides, and the winner is read off winnerArm rather than the policy name. */
const bySeed = new Map();
(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l.trim()) continue;
    let g; try { g = JSON.parse(l); } catch (e) { continue; }
    const sp = g && g.selfplay;
    if (!sp) continue;
    const k = String(sp.seed);
    if (!bySeed.has(k)) bySeed.set(k, []);
    bySeed.get(k).push({
      six1: (g.six && g.six.p1) || [], six2: (g.six && g.six.p2) || [],
      arm: sp.winnerArm, swapped: sp.swapped,
    });
  }
  main();
})();

function main() {
  /* team key -> {n decisive pairs, w decisive pairs the NEW arm took} */
  const T = new Map();
  let pairs = 0, decisive = 0, bothNew = 0;
  const bump = (key, won) => {
    if (!key) return;
    const r = T.get(key) || { n: 0, w: 0 };
    r.n++; if (won) r.w++;
    T.set(key, r);
  };
  for (const [, gs] of bySeed) {
    if (gs.length !== 2) continue;
    const kA = gs[0].six1.slice().sort().join('|'), kB = gs[0].six2.slice().sort().join('|');
    const kA2 = gs[1].six1.slice().sort().join('|'), kB2 = gs[1].six2.slice().sort().join('|');
    /* same matchup, opposite sides — otherwise the pair is a fiction */
    if (!((kA === kA2 && kB === kB2) || (kA === kB2 && kB === kA2))) continue;
    if (gs[0].swapped === gs[1].swapped) continue;
    const w = gs.map(x => (x.arm === 1 ? 1 : 0));
    const s = w[0] + w[1];
    pairs++;
    if (s === 1) continue;                       // split: the team decided it
    decisive++;
    const won = s === 2;
    if (won) bothNew++;
    /* a decisive pair is evidence about BOTH sixes that were on the table */
    bump(kA, won); bump(kB, won);
  }

  const rows = [...T.entries()].map(([k, r]) => ({ k, ...r })).filter(r => r.n >= MIN);
  const N = rows.reduce((a, r) => a + r.n, 0);
  const W = rows.reduce((a, r) => a + r.w, 0);
  const p = N ? W / N : 0;

  /* Pearson chi-square for one shared p across teams. */
  let chi = 0;
  for (const r of rows) {
    const e = r.n * p, v = r.n * p * (1 - p);
    if (v > 0) chi += (r.w - e) * (r.w - e) / v;
  }
  const df = Math.max(1, rows.length - 1);
  const z = (chi - df) / Math.sqrt(2 * df);
  /* Overdispersion ratio: 1.0 means the spread is exactly what chance predicts. */
  const ratio = chi / df;

  const pct = x => (100 * x).toFixed(1) + '%';
  console.log(`\nTEAM HETEROGENEITY — ${path.basename(file)}\n`);
  console.log(`  complete pairs                ${pairs.toLocaleString()}`);
  console.log(`  decisive pairs                ${decisive.toLocaleString()}  (${pct(decisive / Math.max(1, pairs))} of pairs)`);
  console.log(`  overall, NEW took             ${pct(decisive ? bothNew / decisive : 0)}`);
  console.log(`  teams with >= ${MIN} decisive pairs  ${rows.length.toLocaleString()}  (${N.toLocaleString()} team-observations)`);
  console.log(`\n  IS THERE ONE EFFECT, OR MANY WITH DIFFERENT SIGNS?`);
  console.log(`  chi-square ${chi.toFixed(0)} on ${df} df   overdispersion ${ratio.toFixed(3)}   z = ${z.toFixed(1)}`);
  if (z > 3) {
    console.log(`  -> MORE SPREAD THAN CHANCE. The teams do not share one win rate: this change helps`);
    console.log(`     on some teams and hurts on others, and the aggregate hides it.`);
  } else if (z < -3) {
    console.log(`  -> LESS spread than chance, which usually means the pairing is not independent.`);
  } else {
    console.log(`  -> consistent with ONE shared win rate across teams. The null is a real null:`);
    console.log(`     there is no hidden subgroup where this change is winning.`);
  }

  rows.sort((a, b) => (b.w / b.n) - (a.w / a.n));
  const show = (r) => `${pct(r.w / r.n).padStart(6)}  n=${String(r.n).padStart(4)}  ${r.k.replace(/\|/g, ', ').slice(0, 76)}`;
  console.log(`\n  best five teams for the NEW arm`);
  for (const r of rows.slice(0, 5)) console.log('    ' + show(r));
  console.log(`  worst five`);
  for (const r of rows.slice(-5)) console.log('    ' + show(r));
  console.log('');
}
