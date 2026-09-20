/* probe_roster_inert_legality.js — HOW MANY BODIES THE ROSTER BUILDS CANNOT EXIST IN A REAL GAME,
 * AND WHY. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_roster_inert_legality.js
 *   SHOWDOWN_PATH=... node tests/probe_roster_inert_legality.js --stage abilities
 *   SHOWDOWN_PATH=... node tests/probe_roster_inert_legality.js --why        (the per-reason tally)
 *
 * WHY IT IS NOT MEASURED BY RUNNING THE ROSTER. `engine/game_differential.js`'s `buildPair` already
 * puts every fixture body to the validator and prints `N distinct set(s) checked, M illegal` — but
 * only while a stage PLAYS, which is minutes per stage and rewrites the stage artifact. The number is
 * a property of the bodies `tests/roster.js` BUILDS, so it is asked of the builder directly: `assign`
 * for the stage, `withLegalInert` for the control-click substitution, `fixture_legality.checkSet` —
 * the same function the static sweep and `buildPair` both use, so the three cannot disagree about
 * what is legal.
 *
 * IT REPORTS, IT DOES NOT GATE, and that is deliberate: the roster's fixtures are not validatable
 * teams by construction (`scaffold` multiplies HP to reach a boundary) and a baselined DELIBERATE
 * isolation pairing is legitimate. What this counts is the ONE class the baseline does not cover —
 * a body carrying a control click its species cannot learn. `--strict` exits 1 on any of those, which
 * is how it was shown red before the substitution rule was widened.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const HAS = n => process.argv.includes(n);
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const R = require(D('tests', 'roster.js'));
const FL = require(D('engine', 'fixture_legality.js'));
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const STAGES = ARG('--stage') ? [ARG('--stage')] : ['items', 'abilities', 'moves'];
const KIND = { items: 'item', abilities: 'ability', moves: 'move' };

/* THE CONTROL CLICKS, WHATEVER THEY ARE TODAY. Printed rather than named: the substitution rule
 * derives its candidates and a reader that spelled one by hand would go stale the day it changed. */
console.log('\nROSTER FIXTURE LEGALITY — asked of the builder, no game played.');
console.log('  primary control click   ' + R.INERT);
console.log('  sleep-gated substitutes ' + (R.INERT_SUBS.map(m => m.id).join(', ') || '(none)'));

let grandIllegal = 0, grandChecked = 0, grandControl = 0;
for (const stage of STAGES) {
  const kind = KIND[stage];
  if (!kind) { console.log('  no such stage: ' + stage); process.exit(2); }
  const { entries } = R.assign(kind);
  const seen = new Map();
  let illegal = 0, control = 0;
  const why = {}, blame = {};
  for (const e of entries) {
    if (!e.scenario) continue;
    const { sc } = R.withLegalInert(e.scenario);
    const choice = R.inertChoice(e.scenario);
    for (const m of sc.A.concat(sc.B)) {
      if (!m || !m.species) continue;
      const s = { species: String(m.species), item: String(m.item || ''), ability: String(m.ability || ''),
                  moves: (m.moves || []).map(String), gender: '' };
      const k = [id(s.species), id(s.item), id(s.ability), s.moves.map(id).sort().join('+')].join('|');
      if (seen.has(k)) continue;
      let v;
      try { v = FL.checkSet(s); }
      catch (err) { v = { legal: false, problems: ['VALIDATOR THREW: ' + String((err && err.message) || err).split('\n')[0]] }; }
      seen.set(k, v.legal);
      if (v.legal) continue;
      illegal++;
      for (const pr of v.problems) {
        why[pr] = (why[pr] || 0) + 1;
        /* the class this probe is about: a body handed a control click its species cannot know */
        if (/can't learn/.test(pr) && [R.INERT].concat(R.INERT_SUBS.map(x => x.id))
              .some(cid => id(pr).includes(id(cid)))) {
          control++;
          blame[choice.why] = (blame[choice.why] || 0) + 1;
        }
      }
    }
  }
  console.log('\n  ' + stage.toUpperCase() + '  ' + seen.size + ' distinct set(s), ' + illegal
    + ' illegal, ' + control + ' of them a CONTROL CLICK the species cannot learn');
  if (HAS('--why')) for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 25))
    console.log('      ' + String(n).padStart(4) + '  ' + k);
  console.log('      WHY THE SUBSTITUTION DID NOT HAPPEN, per illegal control-click body:');
  for (const [k, n] of Object.entries(blame).sort((a, b) => b[1] - a[1]))
    console.log('      ' + String(n).padStart(4) + '  ' + k);
  grandChecked += seen.size; grandIllegal += illegal; grandControl += control;
}

console.log('\n  TOTAL  ' + grandChecked + ' distinct set(s), ' + grandIllegal + ' illegal, '
  + grandControl + ' of them a control click the species cannot learn');
if (HAS('--strict') && grandControl) {
  console.log('  FAIL — a fixture body carries a control click its species cannot know.');
  process.exit(1);
}
process.exit(0);
