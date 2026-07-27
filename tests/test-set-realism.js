/* test-set-realism.js — generated sets must not carry same-type attacking moves far more often than
 * human sets do.
 *
 * WHY THIS EXISTS. `set_priors.fillSet` filled unrevealed move slots by drawing from P(move|species)
 * independently. Independence cannot represent a SLOT: Dire Claw and Gunk Shot are both perfectly
 * normal Sneasler moves that compete for one place on the set, so marginal sampling paired them at
 * roughly P(a)P(b) and the bot brought a Sneasler holding both. Only ~1.38 of 4 moves are revealed per
 * set on the ladder, so whatever fills the other 2.6 dominates every result computed on generated
 * teams — which is ADR-001's lesson recurring in a subtler form.
 *
 * Measured on 2026-07-27 with engine/stab_audit.js, before and after drawing whole observed open-sheet
 * sets instead:
 *
 *            two-or-more same-type attacking moves
 *            human      generated (before)   generated (after)
 *   bo3      23.0%      32.9%  (+9.9)        27.4%  (+4.3)
 *   ots      23.6%      33.0%  (+9.4)        27.4%  (+3.7)
 *
 * THE THRESHOLD. 6.0 points. That is deliberately between the two: the pre-fix sampler fails this test
 * and the current one passes with headroom. A test that only just passes today tells you nothing
 * tomorrow, and a test tuned to the exact current value fails on noise.
 *
 * The residual +4.3 is NOT claimed as fixed. Species with fewer than 8 observed complete sets still
 * fall through to the marginal paths, and a partially-revealed set still mixes an observed draw with
 * what was already on it. Section 6 of docs/ARCHITECTURE-REVIEW-2026-07-27.md records it as open.
 *
 * GARBODOR: clean games only, and the corpus is named by PATH. This measurement previously read
 * `loadGames('ots')` — a string, where an options object was required — and silently measured the
 * closed-sheet ladder store, where 95% of games carry no sheet at all.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('SET REALISM — generated sets vs published human sets\n');

const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const Q = require(D('engine', 'quality.js'));
const SP = require(D('engine', 'set_priors.js'));

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* The largest number of ATTACKING moves sharing one type. Status moves are excluded: two Water status
 * moves are not a coverage mistake, and counting them would dilute the thing being measured. */
function worstDup(moves) {
  const c = {};
  let worst = 0;
  for (const mv of moves) {
    const m = dex.moves.get(mv);
    if (!m || !m.exists || m.category === 'Status') continue;
    c[m.type] = (c[m.type] || 0) + 1;
    if (c[m.type] > worst) worst = c[m.type];
  }
  return worst;
}
function rate(sets) {
  let n = 0, dup = 0;
  for (const mv of sets) { if (!mv || mv.length < 4) continue; n++; if (worstDup(mv) >= 2) dup++; }
  return { n, dup, pct: 100 * dup / Math.max(1, n) };
}
/* Interval on a difference of two independent proportions, so "the gap is real" and "the gap is within
 * tolerance" are separate questions and both get answered. */
function diffCI(k1, n1, k2, n2) {
  const p1 = k1 / n1, p2 = k2 / n2, z = 1.959964;
  const se = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  return [100 * ((p2 - p1) - z * se), 100 * ((p2 - p1) + z * se)];
}

/* The observed-set store is the fix. If it empties — a renamed loader, a moved corpus, a filter that
 * rejects everything — the sampler silently reverts to marginals and every number above regresses with
 * nothing failing. That is the exact shape of defect this file exists for, so it is asserted directly. */
/* Reported, not thrown. Run against the pre-fix set_priors.js this line raised
 * "SP.observedSets is not a function" and took the whole file down with a stack trace, so the gap
 * assertion below never ran. A test that crashes tells you something broke; a test that FAILS tells
 * you what. Both exit non-zero, and only one of them is readable at 3am. */
const OB = typeof SP.observedSets === 'function' ? SP.observedSets() : null;
ok(OB !== null, 'engine/set_priors.js exports observedSets() — the open-sheet joint distribution');
const totalObserved = OB ? Object.keys(OB).reduce((a, k) => a + OB[k].length, 0) : 0;
ok(totalObserved >= 20000,
  `the observed open-sheet set store is populated (${totalObserved.toLocaleString()} complete sets, ` +
  `${OB ? Object.keys(OB).length : 0} species)`);

const STORE = D('data', 'games.bo3.jsonl');
if (!fs.existsSync(STORE)) {
  console.log('  ----  data/games.bo3.jsonl is absent; cannot measure. Not a pass.');
  console.log(`\nSET REALISM TESTS: ${P} passed, ${F} failed, 1 could not run`);
  process.exit(2);
}

const games = Q.loadGames({ path: STORE });
const human = [], pool = new Map();
for (const g of games) for (const side of ['p1', 'p2'])
  for (const st of (g.sheets && g.sheets[side]) || []) {
    if (!st || !Array.isArray(st.moves) || st.moves.length < 4) continue;
    human.push(st.moves);
    pool.set(st.species, (pool.get(st.species) || 0) + 1);
  }
ok(human.length >= 5000, `human ground truth is a real sample (${human.length.toLocaleString()} published sets)`);

/* Generated sets weighted to the SAME species mix, one draw per observed sheet. An unmatched mix would
 * compare the sampler's Kingambit habits against the metagame's Incineroar habits. */
const gen = [];
let seed = 12345;
for (const [sp, count] of pool) {
  for (let i = 0; i < count; i++) {
    try { const f = SP.fillSet(sp, {}, seed++); if (f && Array.isArray(f.moves)) gen.push(f.moves.slice(0, 4)); }
    catch (e) { /* species has no prior */ }
  }
}

const H = rate(human), G = rate(gen);
const ci = diffCI(H.dup, H.n, G.dup, G.n);
const gap = G.pct - H.pct;
console.log(`\n  human      ${H.n.toLocaleString().padStart(7)} sets   ${H.pct.toFixed(1)}%`);
console.log(`  generated  ${G.n.toLocaleString().padStart(7)} sets   ${G.pct.toFixed(1)}%`);
console.log(`  gap        ${gap >= 0 ? '+' : ''}${gap.toFixed(1)} points   95% CI [${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]\n`);

const LIMIT = 6.0;
ok(gap <= LIMIT,
  `the same-type-attack gap is within ${LIMIT} points (measured ${gap >= 0 ? '+' : ''}${gap.toFixed(1)}, ` +
  `pre-fix was +9.9)`);

/* DIRECTION, NOT JUST MAGNITUDE. The sampler over-produces doubles; it must not be "fixed" into
 * under-producing them, which would be a different wrong answer with a smaller absolute gap. */
ok(gap >= -LIMIT,
  `the sampler has not overshot into under-producing them (measured ${gap >= 0 ? '+' : ''}${gap.toFixed(1)})`);

/* The named case that started this. Sneasler's Dire Claw and Gunk Shot are both Poison and both real;
 * a set holding both is the defect, not merely unlikely. */
let sneaslerBoth = 0, sneaslerN = 0;
for (let i = 0; i < 300; i++) {
  try {
    const f = SP.fillSet('Sneasler', {}, 90000 + i);
    if (!f || !Array.isArray(f.moves)) continue;
    sneaslerN++;
    const m = f.moves.map(norm);
    if (m.includes('direclaw') && m.includes('gunkshot')) sneaslerBoth++;
  } catch (e) { /* no prior */ }
}
if (sneaslerN >= 100) {
  const pct = 100 * sneaslerBoth / sneaslerN;
  ok(pct <= 5, `Sneasler is rarely handed both Dire Claw and Gunk Shot (${pct.toFixed(1)}% of ${sneaslerN} draws)`);
} else {
  console.log(`  ----  only ${sneaslerN} Sneasler draws available; the named case could not be checked`);
}

console.log(`\nSET REALISM TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
