/* probe_bench_plants.js — IS "NOT APPLIED" A CLAIM ABOUT THE COMPARATOR OR ABOUT THE FIXTURE?
 *
 * WHY THIS EXISTS. Every `--state` run of `engine/game_differential.js` prints its planted-state
 * proof and then, on 2026-08-19, this:
 *
 *     NOT APPLIED  party.  an ITEM on a BENCHED body that is not held        (and five more)
 *     THE STATE COMPARATOR FAILED ITS OWN PROOF — every state number below is worthless.
 *
 * The proof plants at the LAST BOARD THE CLEAN ARM AGREED AT, which on a pair that agrees all the way
 * is the final boundary — late, by construction, and often a board where NEITHER side has a living
 * body on the bench. `benchedLivingEither` then finds nobody and the plant reports NOT APPLIED, which
 * is the honest answer and is indistinguishable, in that one line, from a comparator that looked and
 * saw nothing.
 *
 * THE TWO SENTENCES ARE DIFFERENT AND ONLY ONE OF THEM IS ABOUT THE ENGINE (Will has taught this
 * twice: a COULD-NOT-STAGE verdict is a claim about the FIXTURE, never about the mechanic). So this
 * probe runs the SAME `plantedStateProof` over MANY pairs and asks one question per plant:
 *
 *     when it WAS applied, was it always CAUGHT, at the planted boundary, and LOCALISED?
 *
 * A plant that is applied somewhere and caught every time is proven. A plant that is applied and NOT
 * caught is a hole in the board comparison and is named. A plant never applied anywhere is still
 * UNPROVEN and is named as that — not as a pass.
 *
 * THE CONTROL IS THE CLEAN ARM OF EVERY PAIR: the same game with nothing planted, which must reach
 * the plant boundary with the boards agreeing. It is printed per pair.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const PAIRS = +arg('--pairs', 8);
const OUT = arg('--out', 'data/verification/bench-plants.json');

for (const [k, v] of [['--arm', 'middle'], ['--turns', '12'], ['--release', '94a84744346d'],
                      ['--team-store', 'data/team-pool-frozen'], ['--games', '120']]) {
  if (!process.argv.includes(k)) process.argv.push(k, v);
}
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
const G = require(D('engine', 'game_differential.js'));

/* PAIRS FROM SEVERAL CONFIGURATIONS, not several pairs from one, because the plant boundary is a
 * property of how long the pair agrees and one configuration's pairs agree for similar reasons. */
const work = [];
for (const cfg of G.SW.out) {
  const q = G.pairsFor(cfg.config);
  for (let i = 0; i < 2 && i < q.length; i++) work.push({ cfg: cfg.config, pr: q[i] });
  if (work.length >= PAIRS) break;
}
console.log('BENCH PLANTS — ' + Math.min(PAIRS, work.length) + ' pair(s), '
  + G.STATE_PLANTS.length + ' plants each, engine release ' + G.REL.id);

const perPlant = new Map();
for (const [what] of G.STATE_PLANTS) perPlant.set(what, { what, applied: 0, caught: 0, at_boundary: 0, localised: 0, pairs: 0 });
const pairRows = [];
for (const w of work.slice(0, PAIRS)) {
  G.driverReset();
  const P = G.plantedStateProof(w.pr.a, w.pr.b);
  const c = P.clean;
  console.log('\n  ' + w.cfg + '   clean arm: ' + c.boundaries_agreed + '/' + c.boundaries
    + ' boundaries agreed, first board divergence ' + (c.first_state_divergence_at_turn == null ? 'NONE' : 'turn ' + c.first_state_divergence_at_turn)
    + ', plants go at boundary ' + c.planted_at_boundary);
  const bad = [];
  for (const p of P.plants) {
    const e = perPlant.get(p.what); if (!e) continue;
    e.pairs++;
    if (p.applied) e.applied++;
    if (p.applied && p.caught) e.caught++;
    if (p.applied && p.caught && p.at_the_planted_boundary) e.at_boundary++;
    if (p.applied && p.caught && p.at_the_planted_boundary && p.localised) e.localised++;
    if (p.applied && !(p.caught && p.at_the_planted_boundary && p.localised)) bad.push(p);
  }
  const applied = P.plants.filter(p => p.applied).length;
  console.log('    ' + applied + '/' + P.plants.length + ' plants applied on this pair; '
    + (bad.length ? bad.length + ' APPLIED AND NOT CAUGHT+LOCALISED' : 'every applied plant caught, at the boundary, localised'));
  for (const p of bad) console.log('      APPLIED, NOT PROVEN: ' + p.what + '  [caught=' + p.caught
    + ' at=' + p.at + ' expected=' + p.expected_at + ' localised=' + p.localised + ' reported=' + (p.paths || []).slice(0, 3).join(',') + ']');
  pairRows.push({ config: w.cfg, clean: c, applied, plants: P.plants.length,
                  unproven: bad.map(p => p.what) });
}

console.log('\nPER PLANT, OVER ' + Math.min(PAIRS, work.length) + ' PAIR(S)   applied / caught / at-boundary / localised');
let holes = 0, never = 0;
for (const e of perPlant.values()) {
  const proven = e.applied > 0 && e.localised === e.applied;
  if (e.applied === 0) never++;
  else if (!proven) holes++;
  console.log('  ' + (e.applied === 0 ? 'NEVER APPLIED — UNPROVEN'
             : proven ? 'PROVEN                  ' : 'A HOLE                  ')
    + '  ' + (e.applied + '/' + e.caught + '/' + e.at_boundary + '/' + e.localised).padEnd(12) + e.what);
}
console.log('\n  ' + holes + ' plant(s) applied and not caught — each is a leaf the board comparison does not see.');
console.log('  ' + never + ' plant(s) never applied on any pair — UNPROVEN, which is not a pass.');

fs.writeFileSync(D(OUT), JSON.stringify({
  what: 'THE PLANTED-STATE PROOF OVER MANY PAIRS. Separates "the fixture could not place it" from '
      + '"the comparator did not see it" — the differential prints one run and cannot.',
  generated: new Date().toISOString(), engine_release: G.REL.id,
  pairs: pairRows, per_plant: [...perPlant.values()],
  holes, never_applied: never,
}, null, 1));
console.log('\n  -> ' + D(OUT));
