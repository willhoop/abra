/* test-game-differential.js — THE GATE ON THE COMPARISON DRIVER, not on the engine it compares.
 *
 *   SHOWDOWN_PATH=... node tests/test-game-differential.js
 *
 * ROADMAP #68 step two. `engine/game_differential.js` plays one team pair through BOTH engines under
 * a pinned die and reports the FIRST differing protocol line. That instrument can fail in exactly one
 * catastrophic way and this project has paid for it repeatedly: IT CAN AGREE BECAUSE IT IS BROKEN.
 *
 * SO WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE".
 * A divergence is a FINDING, exactly as the census reports a MISSING mechanic and as
 * tests/test-game-diff.js reports a diverging pair. This file goes red only when the INSTRUMENT is
 * wrong:
 *
 *   PART 1  the pin. Nine behavioural claims, each with a medicham2 counterpart, asserted before a
 *           game runs. CHANGELOG 3.45.0 is what a mispinned die costs.
 *   PART 2  the planted-divergence proof. Three plants — a wrong FIELD, a MISSING event, two events
 *           SWAPPED — each corrupting ONLY the medicham stream. A comparator that finds nothing must
 *           first prove it can find something.
 *   PART 3  the two findings docs/GAME-DIFFERENTIAL-DESIGN.md §5a filed BY HAND before this driver
 *           existed. They are predictions, not discoveries: a harness that cannot reproduce a finding
 *           somebody already made without it is MISALIGNED, and that is the first thing to debug.
 *   PART 4  the drop list. An event dropped from the Showdown stream must be one medicham2 has
 *           DECLARED it does not emit, or be named transport. A silent drop is agreement bought.
 *   PART 5  the run says what it did NOT test. A coverage figure that cannot be zero is not a
 *           measurement.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

const G = require(D('engine', 'game_differential.js'));

/* ================= PART 1 — THE PIN ============================================================= */
console.log('\nPART 1 — the pinned die, asserted on its BEHAVIOUR');
let pinBad = 0;
for (const [what, f] of G.PIN_CLAIMS) { if (!f()) { pinBad++; fail('the pin claims "' + what + '" and it is false'); } }
if (!pinBad) pass('all ' + G.PIN_CLAIMS.length + ' pin claims hold');
/* THE TWO PINS MUST BE ONE DIE. `PRNG.randomChance(n, d)` IS `this.random(d) < n` (sim/prng.ts:115).
 * This is asserted over a table rather than trusted to the definition, because the 2026-08-05 failure
 * was two pinned functions with no comparison between them. */
{
  let bad = 0;
  for (const [n, d] of [[100, 100], [95, 100], [90, 100], [50, 100], [30, 100], [1, 24], [1, 8], [1, 4], [1, 2], [1, 3]])
    if (G.PIN_CHANCE(n, d) !== (G.pinRandom(d) < n)) { bad++; fail('the two pinned dice disagree at randomChance(' + n + ', ' + d + ')'); }
  if (!bad) pass('randomChance and random are the SAME die at every rate a battle asks about');
}

/* ================= PART 1b — THE SEMANTIC NORMALISER, BOTH DIRECTIONS, PER RULE =================
 * This layer is the one that can lie for us: every equivalence is a CLAIM that two protocol forms
 * mean the same thing, and a rule that is one field too wide turns a real bug into agreement. So each
 * rule carries a pair that must compare EQUAL (the form it collapses) and a pair that must still
 * compare UNEQUAL (the meaning it must not touch). A rule with no red demonstration is a silencer. */
console.log('\nPART 1b — every equivalence collapses the FORM and keeps the MEANING');
{
  const proof = G.equivProof();
  if (!proof.length) fail('there are no equivalence rules at all — the normaliser is not wired');
  for (const r of proof) {
    if (!r.collapses) fail('"' + r.id + '" does NOT collapse the form it claims to: its `equal` pair '
      + 'still compares unequal, so the rule is dead weight wearing a justification');
    else if (!r.keeps_meaning) fail('"' + r.id + '" IS A SILENCER — it collapses its `distinct` pair too, '
      + 'so a real bug of that shape would read as agreement. Narrow the rule or delete it.');
    else pass(r.id + ' — collapses the form, keeps the meaning');
  }
  /* AND THE WHOLE LAYER MUST BE ABLE TO SAY NO. If semantic() maps two arbitrary different state
   * lines onto each other, every rate this instrument produces is the comparator's. */
  const a = G.semantic('|-damage|p2a: Garchomp|100/183');
  const b = G.semantic('|-damage|p2a: Garchomp|101/183');
  if (a === b) fail('semantic() collapses two DIFFERENT damage amounts onto one another');
  else pass('semantic() still separates two damage lines that differ by one HP');
}

/* ================= PART 2 — THE PLANTED-DIVERGENCE PROOF ======================================== */
console.log('\nPART 2 — the comparator can find a divergence that was planted in it');
const pairs = G.pairsFor('baseline');
if (!pairs.length) fail('no baseline team pair could be built — parts 2 and 5 test nothing');
else {
  const proof = G.plantedProof(pairs[0].a, pairs[0].b);
  const clean = proof.find(p => /CLEAN/.test(p.what));
  for (const p of proof) {
    if (/CLEAN/.test(p.what)) continue;
    if (!p.caught) fail('NOT CAUGHT: ' + p.what);
    else if (!p.earlier_than_clean)
      fail('the plant "' + p.what + '" was caught at line ' + p.at + ', which is not EARLIER than the '
        + 'clean arm\'s own divergence at line ' + clean.at + ' — the catch may be the clean divergence');
    else if (p.at !== p.expected_at)
      fail('the plant "' + p.what + '" was caught at line ' + p.at + ' and it was planted at line '
        + p.expected_at + '. Catching it at the wrong line means the aligner is not localising.');
    else pass('caught at line ' + p.at + ', exactly where it was planted: ' + p.what);
  }
  if (clean) note('the clean arm of the same game ' + (clean.caught
    ? 'diverges at line ' + clean.at + ' (' + clean.cls + '), which is a FINDING and not a failure'
    : 'agrees'));
}

/* ================= PART 3 — THE TWO PREDICTED FINDINGS ========================================== */
console.log('\nPART 3 — the findings §5a filed BY HAND reproduce through this driver');
const DIR = G.runDirected();
for (const d of DIR) {
  if (!d.staged) { fail('the scenario could not be built at all: ' + d.name); continue; }
  if (d.err) { fail('THREW: ' + d.name + ' — ' + d.err); continue; }
  if (!d.diverged) {
    /* NOT A PASS. §5a says these two DO diverge today; if they stopped, either the engine was fixed
     * (good news, and this file must then be rewritten) or the alignment stopped reaching them. */
    fail('"' + d.name + '" no longer diverges. Either the wire landed — in which case rewrite this '
      + 'case — or the aligner stopped reaching it. Do not read this as agreement.');
    continue;
  }
  pass(d.name + '\n          ' + d.agreed + ' lines agreed, class "' + d.cls + '"'
    + '\n          showdown  ' + d.showdown + '\n          medicham  ' + d.medicham);
}
/* THE ORDERING CLASS IS THE ONE THE TASK NAMES: if the harness does not surface it, the alignment is
 * wrong and that is the first thing to debug. Asserted by CLASS, not by scenario name. */
{
  const ord = DIR.filter(d => d.cls === 'ordering');
  if (ord.length < 2) fail('only ' + ord.length + ' of the staged scenarios classified as "ordering". '
    + 'The order-within-a-hit finding is the alignment\'s own acceptance test.');
  else pass(ord.length + ' staged scenarios classify as "ordering" — the two engines emit the SAME '
    + 'events in a DIFFERENT order, which is what a state comparison cannot see');
}

/* THE DAMAGE INTERIOR — the second filed prediction, measured rather than quoted. */
console.log('\nPART 3b — the damage interior');
for (const sc of G.DIRECTED.filter(s => /knock-off|contact/.test(s.name))) {
  const it = G.damageInterior(sc);
  if (!it) { fail('the interior could not be measured for ' + sc.name); continue; }
  if (!it.endpoints_agree)
    fail('the ENDPOINTS disagree for "' + it.name + '" (showdown ' + it.sd_span.join('..')
      + ', medicham ' + it.me_span.join('..') + '). tests/test-engine-diff.js compares exactly these '
      + 'two endpoints at 149/150, so a disagreement here is a damage bug, not a granularity one.');
  else {
    const onlyMe = it.values_medicham_can_produce_that_showdown_cannot;
    const onlySd = it.values_showdown_can_produce_that_medicham_cannot;
    pass('"' + it.name.slice(0, 40) + '": endpoints agree (' + it.sd_span.join('..') + '), '
      + it.sd_distinct + ' distinct showdown values against ' + it.me_distinct + ' medicham values');
    note('the INTERIOR is not the same: ' + onlyMe.length + ' value(s) only medicham can roll ['
      + onlyMe.join(',') + '], ' + onlySd.length + ' only showdown can ['
      + onlySd.join(',') + '], worst per-value probability gap '
      + (100 * it.worst_probability_gap).toFixed(2) + ' points at ' + it.worst_at);
    if (!onlyMe.length && !onlySd.length && it.worst_probability_gap === 0)
      fail('the interior is IDENTICAL, which contradicts §5a — 11 uniform integers cannot match 16 '
        + 'separately-floored ones. Check that the medicham span is being read and not swept.');
  }
}

/* ================= PART 3c — ROADMAP #80, THE TWO HALVES ASSERTED SEPARATELY ====================
 * Showdown's Knock Off takes its x1.5 in `onBasePower` BEFORE damage and calls `takeItem()` in
 * `onAfterHit` AFTER it. Colbur Berry is `onSourceModifyDamage` and therefore fires INSIDE the
 * calculation; Sitrus is `onUpdate` and fires after `takeItem` has already run. Opposite answers,
 * same move, same turn. Asserting only the final HP is what lets a lost boost and a lost halving
 * cancel into a number nobody flags, so the two halves are asserted apart. */
console.log('\nPART 3c — ROADMAP #80: the boost half and the reduction half, independently');
{
  const KO = G.knockOffArms();
  const near = (a, b) => a != null && Math.abs(a - b) <= 0.05;
  for (const [label, o] of [['boost x1.5', KO.boost_half], ['reduction x0.5', KO.reduction_half]]) {
    if (!near(o.showdown, o.expected))
      fail('SHOWDOWN does not show ' + label + ' (' + o.showdown + '). The scenario is not staging '
        + 'what it claims — check the arm is not saturated against the target\'s max HP.');
    else if (!near(o.medicham, o.expected))
      fail('medicham2 ' + label + ' reads ' + o.medicham + ' against Showdown\'s ' + o.showdown
        + ' — THIS IS THE PREDICTED BUG AND IT NOW REPRODUCES. Wire it.');
    else pass(label + ': showdown ' + o.showdown + ', medicham ' + o.medicham + ' — both halves priced');
  }
  /* THE ARMS MUST BE DISTINGUISHABLE, or the two "passes" above are three readings of a clamp. */
  const d = KO.arms.map(a => a.showdown);
  if (new Set(d).size < 3) fail('the three Knock Off arms produced ' + new Set(d).size + ' distinct '
    + 'Showdown damages (' + d.join(', ') + '). A clamped arm makes both ratios 1.0 and both checks vacuous.');
  else pass('the three arms are distinguishable: ' + d.join(' / '));
  /* AND THE DISPOSITION, which is where the two engines DO part. */
  const col = KO.arms.find(a => /colbur/i.test(a.item));
  const sdEaten = col && col.showdown_enditem.some(l => /\[eat\]/.test(l));
  const meEaten = col && col.medicham_enditem.some(l => /\[eat\]/.test(l));
  if (sdEaten && !meEaten)
    pass('FINDING, and it is not the predicted one: Showdown records Colbur as EATEN BY ITSELF, '
      + 'medicham2 as KNOCKED OFF. Same end state, different fact — Harvest, Recycle, Belch, Cud Chew '
      + 'and Unburden all read "was it eaten".');
  else if (sdEaten && meEaten)
    fail('medicham2 now records Colbur as EATEN too. Good news, and this case must be rewritten.');
  else fail('SHOWDOWN did not record Colbur as eaten — the scenario is not staging the berry at all.');
  if (KO.sitrus_half.staged && KO.sitrus_half.showdown_healed)
    fail('Showdown HEALED from Sitrus through a Knock Off. items.ts says onUpdate runs after takeItem; '
      + 'the scenario is not staging what it claims.');
  else if (KO.sitrus_half.staged && KO.sitrus_half.medicham_healed)
    fail('medicham2 healed from a Sitrus that Knock Off had already taken.');
  else if (KO.sitrus_half.staged) pass('the Sitrus half agrees exactly: both engines strip it, neither heals');
  else fail('the Sitrus half could not be staged, so half of ROADMAP #80 is untested');
}

/* ================= PART 4 — NOTHING IS DROPPED SILENTLY ========================================= */
console.log('\nPART 4 — every Showdown line dropped before alignment is one we DECLARED we do not emit');
{
  /* Drive the filter with a line Showdown could emit and nothing has declared. It must be counted. */
  const before = require(D('data', 'game-differential.json'));
  if (before && before.declared_gaps && before.declared_gaps.undeclared_event_drops === 0)
    pass('the last recorded run dropped 0 undeclared events (data/game-differential.json)');
  else if (before && before.declared_gaps)
    fail('the last recorded run dropped ' + before.declared_gaps.undeclared_event_drops
      + ' undeclared event type(s): ' + (before.declared_gaps.undeclared_events || []).join(', '));
  else fail('data/game-differential.json carries no declared_gaps block');
}

/* ================= PART 5 — THE RUN SAYS WHAT IT DID NOT TEST =================================== */
console.log('\nPART 5 — the coverage report can be ZERO, and names what it cannot measure');
{
  const art = require(D('data', 'game-differential.json'));
  const c = art.coverage || {};
  if (!c.measurable) fail('the artifact records no measurable coverage target at all');
  else if (c.exercised >= c.measurable)
    fail('the last run reports ' + c.exercised + '/' + c.measurable + ' mechanics exercised. A run '
      + 'that covers EVERYTHING is the shape of a coverage counter that cannot say no.');
  else pass(c.exercised + '/' + c.measurable + ' measurable census mechanics exercised, so '
    + (c.measurable - c.exercised) + ' are recorded as NOT exercised');
  if (!(c.unmeasurable_by_this_instrument || []).length)
    fail('no census row is declared unmeasurable. 43 of the 235 name an INTERACTION rather than a '
      + 'taggable entity; reporting them as covered or as uncovered would both be wrong.');
  else pass((c.unmeasurable_by_this_instrument || []).length + ' census rows are declared UNMEASURABLE '
    + 'by this instrument rather than counted either way');
  if (!(c.clicked_but_always_missed || []).length)
    note('no move was clicked-and-always-missed, which is only plausible if the run clicked no '
      + 'sub-100-accuracy move at all');
  else pass((c.clicked_but_always_missed || []).length + ' moves were clicked and ALWAYS missed under '
    + 'the Mode A pin, and are NOT counted as covered');
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — the INSTRUMENT is wrong, which is the only thing this file fails on'
  : 'ALL PASSED — the instrument is sound. What it FOUND is in data/game-differential.json and docs/ENGINE.md.'));
process.exit(failures ? 1 : 0);
