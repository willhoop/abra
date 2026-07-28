/* bring_bias.js — does the length-conditioning in `require_full_bring` actually move the numbers?
 *
 *   node engine/bring_bias.js        ->  data/bring-bias.json
 *
 * THE PROBLEM, raised by the 2026-07-28 thesis defence and quantified there
 * ------------------------------------------------------------------------
 * `require_full_bring` keeps only games where both players' four brought Pokemon were all revealed.
 * That conditions on the game lasting long enough to reveal them. Measured on the open-sheet corpus,
 * isolating that rule from every other:
 *
 *     kept     2,860 games, mean 8.09 turns
 *     dropped  1,005 games, mean 5.13 turns      (26.0% of otherwise-clean games)
 *     the two bring distributions differ by a total variation distance of 5.8%
 *
 * and the shift is directional -- Staraptor, Whimsicott and Grimmsnarl are over-represented among
 * the DISCARDED short games; Garchomp, Basculegion and Incineroar under-represented. Fast offence
 * wins fast, fast games get discarded, so the retained sample under-counts the archetype that ends
 * games quickest.
 *
 * TWO DIFFERENT BIASES, AND THEY ARE OFTEN CONFUSED
 * ------------------------------------------------
 * `engine/bring_priors.js` already documents a WITHIN-game bias: a Pokemon selected but never sent
 * out is invisible, so p_bring is biased down for mons that appear late. `require_full_bring` FIXES
 * that one -- by keeping only fully-revealed games it guarantees nothing is hidden.
 *
 * In doing so it creates a BETWEEN-game bias: the retained set is no longer a random sample of
 * games, it is a sample of long ones. The config documents this in prose and never quantifies it,
 * and no downstream bring statistic corrects for it.
 *
 * THE CORRECTION
 * --------------
 * Post-stratification on turn count. Retained games are weighted so their length distribution
 * matches the length distribution of ALL otherwise-clean games. A retained game of a length that is
 * rare among retained games but common overall gets more weight, and vice versa.
 *
 * This is the standard fix and it is honest about what it cannot do: it corrects the length skew,
 * not the revelation problem inside the discarded games. Those games genuinely do not record what
 * was brought, and no weighting recovers information that was never written down. What
 * post-stratification buys is that the retained games speak for the whole population's LENGTH mix
 * rather than only for the long tail of it.
 *
 * WHAT THIS FILE DECIDES
 * ----------------------
 * Whether the correction is worth applying. If naive and corrected bring rates agree to within
 * noise, the defence's objection is real but immaterial and that should be stated once, with a
 * number, and dropped. If they disagree, every bring statistic in the project needs reweighting.
 * Either answer is useful; asserting the first without measuring is not.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require('./quality.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'bring-bias.json');
const STORE = path.join(ROOT, 'data', 'games.ots.jsonl');

const cfg = Q.config();
const all = Q.loadGames({ path: STORE, clean: false });
const bots = Q.behaviouralBots(all, cfg);

/* Games clean on every rule EXCEPT the one under test, so the comparison isolates it. */
const pool = all.filter(g => Q.reasons(g, cfg, bots).filter(r => r !== 'partial_bring').length === 0);
const kept = pool.filter(g => !Q.reasons(g, cfg, bots).includes('partial_bring'));

const turns = g => (g.turns || []).length;
/* Bucketed rather than exact turn counts: exact lengths in the tail have one or two games and their
 * weights would explode. Buckets keep every weight finite and interpretable. */
const bucket = t => (t <= 4 ? '<=4' : t <= 6 ? '5-6' : t <= 8 ? '7-8' : t <= 11 ? '9-11' : t <= 15 ? '12-15' : '16+');

const dist = games => {
  const c = {}; for (const g of games) { const b = bucket(turns(g)); c[b] = (c[b] || 0) + 1; }
  const n = games.length; const o = {}; for (const k in c) o[k] = c[k] / n; return o;
};
const pop = dist(pool), ret = dist(kept);

/* w(bucket) = P(bucket | whole pool) / P(bucket | retained). A retained game in an under-represented
 * length bucket speaks for more of the population than one in an over-represented bucket. */
const W = {};
for (const b in pop) W[b] = ret[b] > 0 ? pop[b] / ret[b] : 0;

/* p_bring(s) = P(s is in `brought` | s is on the six), naive and post-stratified. */
function bringRates(weighted) {
  const num = {}, den = {};
  for (const g of kept) {
    const w = weighted ? (W[bucket(turns(g))] || 0) : 1;
    if (!w) continue;
    for (const side of ['p1', 'p2']) {
      const six = (g.six || {})[side] || [];
      const brought = new Set((g.brought || {})[side] || []);
      for (const sp of six) {
        den[sp] = (den[sp] || 0) + w;
        if (brought.has(sp)) num[sp] = (num[sp] || 0) + w;
      }
    }
  }
  const out = {};
  for (const sp in den) if (den[sp] >= 30) out[sp] = (num[sp] || 0) / den[sp];
  return { rates: out, den };
}

const A = bringRates(false), B = bringRates(true);
const species = Object.keys(A.rates).filter(s => s in B.rates);
const rows = species.map(s => ({
  species: s, n: Math.round(A.den[s]),
  naive: A.rates[s], corrected: B.rates[s], shift: B.rates[s] - A.rates[s],
})).sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));

const meanAbs = rows.reduce((a, r) => a + Math.abs(r.shift), 0) / rows.length;
const maxAbs = rows.length ? Math.abs(rows[0].shift) : 0;

console.log('BRING BIAS — does correcting the length skew move the numbers?\n');
console.log(`  pool (clean but for this rule)  ${pool.length.toLocaleString()} games`);
console.log(`  retained by require_full_bring  ${kept.length.toLocaleString()} (${(100 * kept.length / pool.length).toFixed(1)}%)\n`);
console.log('  length bucket   whole pool   retained   weight');
for (const b of ['<=4', '5-6', '7-8', '9-11', '12-15', '16+']) {
  if (!(b in pop)) continue;
  console.log(`  ${b.padEnd(13)} ${(100 * pop[b]).toFixed(1).padStart(9)}%  ${(100 * (ret[b] || 0)).toFixed(1).padStart(8)}%  ${(W[b] || 0).toFixed(3).padStart(7)}`);
}
console.log(`\n  ${rows.length} species with >= 30 appearances\n`);
console.log('  LARGEST SHIFTS in p_bring after post-stratification');
console.log('  species              n     naive   corrected     shift');
for (const r of rows.slice(0, 12)) {
  console.log(`  ${r.species.padEnd(18)} ${String(r.n).padStart(5)}   ${(100 * r.naive).toFixed(1).padStart(5)}%     ${(100 * r.corrected).toFixed(1).padStart(5)}%   ${(r.shift >= 0 ? '+' : '') + (100 * r.shift).toFixed(2).padStart(6)}`);
}
console.log('');
console.log(`  mean |shift|  ${(100 * meanAbs).toFixed(3)} points`);
console.log(`  max  |shift|  ${(100 * maxAbs).toFixed(3)} points`);
console.log('');
/* IS THE SHIFT BIGGER THAN THE NOISE IN THE SHIFT?
 *
 * A bare shift is not evidence. The largest ones land on species with 34-84 appearances, where one
 * standard error on a rate near 0.5 is already 5-9 points. A first version of this file declared
 * MATERIAL because the biggest raw shift exceeded one percentage point -- which is the exact error
 * this project keeps making, and which the thesis defence exists to catch.
 *
 * The naive and corrected estimates are computed on the SAME games with different weights, so they
 * are strongly correlated and an independent-samples standard error would badly overstate the
 * uncertainty. So the shift is bootstrapped directly: resample games, recompute BOTH estimates on
 * that resample, take the distribution of their difference. The correlation is handled exactly,
 * because both sides move together on every resample. */
function bootShift(B) {
  const acc = {};
  for (const s of species) acc[s] = [];
  for (let b = 0; b < B; b++) {
    const num0 = {}, den0 = {}, num1 = {}, den1 = {};
    for (let i = 0; i < kept.length; i++) {
      const g = kept[(Math.random() * kept.length) | 0];
      const w = W[bucket(turns(g))] || 0;
      for (const side of ['p1', 'p2']) {
        const six = (g.six || {})[side] || [];
        const br = new Set((g.brought || {})[side] || []);
        for (const sp of six) {
          den0[sp] = (den0[sp] || 0) + 1; if (br.has(sp)) num0[sp] = (num0[sp] || 0) + 1;
          den1[sp] = (den1[sp] || 0) + w; if (br.has(sp)) num1[sp] = (num1[sp] || 0) + w;
        }
      }
    }
    for (const sp of species) {
      if ((den0[sp] || 0) < 20 || (den1[sp] || 0) <= 0) continue;
      acc[sp].push((num1[sp] || 0) / den1[sp] - (num0[sp] || 0) / den0[sp]);
    }
  }
  const out = {};
  for (const sp of species) {
    const v = acc[sp];
    if (v.length < 30) continue;
    const m = v.reduce((a, x) => a + x, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1));
    out[sp] = { sd, z: sd > 0 ? Math.abs(m) / sd : 0 };
  }
  return out;
}
const BS = bootShift(150);
for (const r of rows) { const b = BS[r.species]; r.shift_se = b ? b.sd : null; r.z = b ? b.z : null; }
const withZ = rows.filter(r => r.z != null);
const rawSig = withZ.filter(r => r.z >= 2).length;

/* BENJAMINI-HOCHBERG, because 84 species is a family of 84 tests and a raw count at |z| >= 2 is how
 * counters.py once manufactured five findings from noise. Expected false positives at alpha = 0.05
 * across 84 tests is about 4.2, so a raw count of 12 is NOT 12 real effects. The project applies BH
 * in counters.py and build_lab.js; applying it here too is consistency, not extra credit. */
const normP = z => {                      // two-sided p from |z|, Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return Math.max(1e-12, Math.min(1, 2 * p));
};
const bh = withZ.map(r => ({ r, p: normP(r.z) })).sort((a, b) => a.p - b.p);
const m = bh.length;
let kMax = -1;
for (let i = 0; i < m; i++) if (bh[i].p <= ((i + 1) / m) * 0.05) kMax = i;
const survivors = new Set(bh.slice(0, kMax + 1).map(x => x.r.species));
for (const r of withZ) r.bh_survived = survivors.has(r.species);
const sigCount = survivors.size;

console.log('  SHIFT AGAINST ITS OWN BOOTSTRAP ERROR (both estimates recomputed on each resample)');
console.log('  species              shift    boot SE     |z|');
for (const r of withZ.slice(0, 8)) {
  console.log('  ' + r.species.padEnd(18) + ' '
    + ((r.shift >= 0 ? '+' : '') + (100 * r.shift).toFixed(2)).padStart(7)
    + '   ' + (100 * r.shift_se).toFixed(2).padStart(7)
    + '   ' + r.z.toFixed(2).padStart(5));
}
console.log('');
console.log('  raw |z| >= 2:                        ' + rawSig + ' of ' + withZ.length
  + '   (about ' + (0.05 * withZ.length).toFixed(1) + ' expected by chance)');
console.log('  surviving Benjamini-Hochberg at 0.05: ' + sigCount);
console.log('');
if (sigCount === 0) {
  console.log('  VERDICT: NOT MATERIAL. No species shifts by more than twice the bootstrap error of');
  console.log('  its own shift. The raw shifts look large because they land on low-n species, where');
  console.log('  reweighting amplifies noise. The objection is real in principle and moves nothing');
  console.log('  in practice: state it once, with this number, and do not reweight.');
} else {
  console.log('  VERDICT: MATERIAL for ' + sigCount + ' species, whose bring rates on the retained');
  console.log('  sample describe the long-game population rather than the whole one by more than');
  console.log('  the uncertainty of the correction itself.');
}

fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/bring_bias.js',
  what: 'Post-stratification on turn count, correcting the length skew that require_full_bring '
      + 'induces, and a bootstrap test of whether the correction changes any bring rate by more '
      + 'than the uncertainty of the correction itself.',
  pool_games: pool.length, retained_games: kept.length,
  retained_share: +(kept.length / pool.length).toFixed(4),
  length_distribution: { whole_pool: pop, retained: ret, weights: W },
  mean_abs_shift_points: +(100 * meanAbs).toFixed(4),
  max_abs_shift_points: +(100 * maxAbs).toFixed(4),
  species_tested: withZ.length,
  species_raw_z_over_2: rawSig,
  species_surviving_bh: sigCount,
  expected_false_positives: +(0.05 * withZ.length).toFixed(1),
  material_by_bootstrap: sigCount > 0,
  shifts: withZ.slice(0, 40).map(r => ({
    species: r.species, n: r.n,
    naive: +r.naive.toFixed(4), corrected: +r.corrected.toFixed(4),
    shift: +r.shift.toFixed(4), shift_se: +r.shift_se.toFixed(4), z: +r.z.toFixed(2),
    bh_survived: !!r.bh_survived })),
  limit: 'Corrects the length skew only. Games discarded by this rule genuinely do not record what '
       + 'was brought, and no weighting recovers information never written down.',
}, null, 1));
console.log('');
console.log('wrote ' + path.relative(ROOT, OUT));
