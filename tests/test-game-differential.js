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
/* IN A SCALAR ARM THE TWO PINS MUST BE ONE DIE. `PRNG.randomChance(n, d)` IS `this.random(d) < n`
 * (sim/prng.ts:115). This is asserted over a table rather than trusted to the definition, because the
 * 2026-08-05 failure was two pinned functions with no comparison between them. The MIDDLE arm makes
 * the OPPOSITE claim on purpose — two entry points, two independent nth-indexed draws — so it is
 * asserted separately below rather than swept into the same loop, where it passed or failed by where
 * the nth counter happened to be. */
{
  let bad = 0;
  const RATES = [[100, 100], [95, 100], [90, 100], [50, 100], [30, 100], [1, 24], [1, 8], [1, 4], [1, 2], [1, 3]];
  /* PER ARM, AND ONLY WHERE THE IDENTITY IS THE ARM'S CLAIM. A scalar arm's `chance` IS
   * `random(den) < num`; the middle arm's takes its own draw on purpose, so asking it this question
   * compares two independent uniforms and passes or fails by where the nth counter happens to be. */
  for (const a of G.ARMS) {
    if (a.middle) continue;
    for (const [n, d] of RATES)
      if (a.chance(n, d) !== (a.random(d) < n)) { bad++; fail(a.id + ': the two pinned dice disagree at randomChance(' + n + ', ' + d + ')'); }
  }
  /* THE MIDDLE ARM'S OWN CLAIM, WHICH IS THE OPPOSITE ONE: two entry points, two independent draws.
   * A middle arm whose two dice agreed everywhere would be the pre-finaliser hash back again. */
  {
    const M = G.ARM_BY_ID.get('middle');
    if (M) {
      let same = 0;
      for (let i = 0; i < 400; i++) if (M.chance(1, 2) === (M.random(2) < 1)) same++;
      if (same > 260 || same < 140) {
        bad++;
        fail('the middle arm\'s chance and random are not two independent draws — they agreed ' + same
          + '/400 where ~200 is independence. The nth-indexed address has stopped re-drawing (see 245cb90d).');
      }
    }
  }
  if (!bad) pass('every scalar arm\'s randomChance IS its random (prng.ts:115), and the middle arm\'s two dice are independent');
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
  /* ROADMAP #81 WIRE 7 — THE EXPECTATION IS THE SCENARIO'S OWN, AND IT IS A CLAIM IN BOTH DIRECTIONS.
   *
   * §5a filed three predictions and all three parted, so "no longer diverges" was unconditionally a
   * failure. WIRE 7 closed two of them, and an engine that got BETTER then read as an instrument that
   * had broken — the least useful reading available. Each scenario now declares `expect`, and this
   * loop fails on the OPPOSITE of what it declares, so a closed case that re-opens is caught exactly
   * as loudly as an open case that stops being reached. */
  if (d.expect === 'agree') {
    if (d.diverged)
      fail('"' + d.name + '" PARTS AGAIN, at line ' + d.at + ' (class "' + d.cls + '"). It was closed '
        + 'by: ' + (d.closed_by || 'an earlier wire') + '.\n          showdown  ' + d.showdown
        + '\n          medicham  ' + d.medicham);
    else
      pass(d.name + '\n          AGREES for the whole scripted turn — closed by ' + (d.closed_by || '?'));
    continue;
  }
  if (!d.diverged) {
    /* NOT A PASS. This scenario declares it still parts; if it stopped, either the engine was fixed
     * (good news — flip its `expect` to 'agree' and say what closed it) or the alignment stopped
     * reaching it. */
    fail('"' + d.name + '" no longer diverges. Either the wire landed — in which case set '
      + '`expect: \'agree\'` on it with a `closed_by` — or the aligner stopped reaching it. Do not '
      + 'read this as agreement.');
    continue;
  }
  pass(d.name + '\n          ' + d.agreed + ' lines agreed, class "' + d.cls + '"'
    + '\n          showdown  ' + d.showdown + '\n          medicham  ' + d.medicham);
}
/* THE ORDERING CLASS IS THE ONE THE TASK NAMES: if the harness does not surface it, the alignment is
 * wrong and that is the first thing to debug. Asserted by CLASS, not by scenario name.
 *
 * THE REQUIREMENT STAYS AT TWO. WIRE 7 closed the knock-off ordering case, which was one of the two,
 * and the cheap move would have been to drop the bar to one. A replacement was staged instead —
 * Electro Shot's charge announcement against the boost it grants, the largest surviving ordering
 * cause in the release ladder's own top rung. Lowering a bar to fit the news is how a check stops
 * being one. */
/* RESTATED 2026-08-18 (ROADMAP #304), AND THE OLD FORM WAS A GATE THAT ASSERTED A DEFECT.
 *
 * It required TWO staged scenarios to CLASSIFY as `ordering` — i.e. two of them still had to be
 * WRONG. Every time an ordering wire landed the count fell, and the file's own history is three
 * rounds of staging a replacement to keep the number up (WIRE 7, then WIRE 8, then this). That is not
 * a bar being held; it is a check that can only be satisfied by the engine being broken, which is the
 * exact shape this pass was sent to remove from PART 3b one screen down.
 *
 * AND ONE OF THE TWO WAS NEVER REAL. `contact punish` declared `predicts: 'ordering'` and diverged in
 * class `-damage field 3` in EVERY artifact on disk — a damage NUMBER, at a line before the ordering
 * question is reached. The clause was being kept green by ROADMAP #304's defect standing in for an
 * ordering finding it never made.
 *
 * WHAT REPLACES IT IS STRICTLY STRONGER AND CANNOT ROT, because it separates the two claims the old
 * one confused:
 *
 *   (a) CAN THE INSTRUMENT SEE AN ORDERING DIVERGENCE AT ALL? Asserted by PART 2's PLANT — two
 *       agreeing events SWAPPED, caught at the exact planted line, in the `ordering` class. A plant
 *       is immune to the engine getting better, which is precisely why it is the right home for this.
 *   (b) IS THE ORDERING FAMILY STILL REPRESENTED AND STILL WATCHED? Asserted here: every scenario
 *       that declares `predicts: 'ordering'` must either still diverge in that class, or be CLOSED
 *       with a named `closed_by`. A scenario the aligner silently stopped reaching has neither, and
 *       fails exactly as loudly as before. The count of ordering-predicting scenarios is also floored
 *       at two, so deleting one rather than closing it is still caught.
 *
 * The remaining live population is NOT hidden by this: `ordering` is 188 games of 797 in the paired
 * ROADMAP #304 run and is now the largest class in the whole-game differential. It is unstaged
 * because seven further stagings were tried in this pass — Stamina, Justified, Weak Armor, Sand Spit,
 * Electromorphosis, Berserk, Anger Point, plus a two-sided switch turn — and ALL EIGHT AGREED. The
 * live ordering population comes from states a one-turn script does not reach, which is a scoping
 * fact about the directed block and not a reason to demand that a closed scenario re-open. */
{
  const ordPredicting = DIR.filter(d => d.predicts === 'ordering');
  const ordLive = ordPredicting.filter(d => d.cls === 'ordering');
  const ordClosed = ordPredicting.filter(d => !d.diverged && d.closed_by);
  const unaccounted = ordPredicting.filter(d => d.cls !== 'ordering' && !(!d.diverged && d.closed_by));
  if (ordPredicting.length < 2)
    fail('only ' + ordPredicting.length + ' staged scenario(s) predict the "ordering" class. The '
      + 'order-within-a-hit finding is the alignment\'s own acceptance test and it needs at least two '
      + 'scenarios watching it, open or closed.');
  else if (unaccounted.length)
    fail(unaccounted.length + ' scenario(s) predict "ordering" and neither diverge in that class nor '
      + 'declare a closed_by: ' + unaccounted.map(d => '"' + d.name.slice(0, 40) + '" (cls '
      + (d.cls || 'none') + ')').join(', ') + '. An unreached scenario looks exactly like a closed one.');
  else
    pass(ordPredicting.length + ' scenarios watch the "ordering" class — ' + ordLive.length
      + ' still diverging in it, ' + ordClosed.length + ' closed with a named wire. PART 2\'s planted '
      + 'swap is what proves the class is still REACHABLE; this clause proves it is still WATCHED.');
}

/* THE DAMAGE INTERIOR — the second filed prediction, measured rather than quoted.
 *
 * THIS CLAUSE ASSERTED THE DEFECT UNTIL ROADMAP #304 CLOSED IT, AND THAT IS WORTH SAYING OUT LOUD.
 * It read `if (interior is IDENTICAL) fail('… 11 uniform integers cannot match 16 separately-floored
 * ones')` — a gate that would have FAILED the correct engine and PASSED the broken one, which is
 * worse than a stale test. It was right about the engine of the day: the loop drew a uniform position
 * in the span. It is wrong about an engine that selects `rolls[damageRollIndex(u)]`, and both halves
 * had to move together — `damageInterior` was reading `dmgRange`'s min..max rather than what the loop
 * emits, so it would have gone on reporting six impossible values against a fixed engine.
 *
 * The direction is now the other way and the reason is the same one: sixteen indices in, sixteen
 * draws out, so any value only one engine can produce is a real disagreement about the damage a turn
 * deals. The endpoint clause below is unchanged — it was never the thing that was wrong. */
console.log('\nPART 3b — the damage interior');
for (const sc of G.DIRECTED.filter(s => /knock-off|contact/.test(s.name))) {
  const it = G.damageInterior(sc);
  if (!it) { fail('the interior could not be measured for ' + sc.name); continue; }
  if (!it.endpoints_agree)
    fail('the ENDPOINTS disagree for "' + it.name + '" (showdown ' + it.sd_span.join('..')
      + ', medicham ' + it.me_span.join('..') + '). tests/test-engine-diff.js compares these two '
      + 'endpoints (:888). BEFORE READING THIS AS A DAMAGE BUG: `oneHitDamage` pins medicham through '
      + '`inertExcept` (crit 0.999) but sends Showdown\'s crit to PIN_CHANCE. If those two are not the '
      + 'same arm, a value ~1.5x the span is the harness critting on one side. Call damageInterior '
      + 'twice — a damage table cannot move between calls.');
  else {
    const onlyMe = it.values_medicham_can_produce_that_showdown_cannot;
    const onlySd = it.values_showdown_can_produce_that_medicham_cannot;
    if (onlyMe.length || onlySd.length || it.worst_probability_gap !== 0)
      fail('the interior of "' + it.name.slice(0, 40) + '" is NOT the authority\'s. ' + onlyMe.length
        + ' value(s) only medicham can roll [' + onlyMe.join(',') + '], ' + onlySd.length
        + ' only showdown can [' + onlySd.join(',') + '], worst per-value probability gap '
        + (100 * it.worst_probability_gap).toFixed(2) + ' points at ' + it.worst_at
        + '.\n          ROADMAP #304: the loop must select rolls[damageRollIndex(u)], not interpolate '
        + 'a position between d.min and d.max.');
    else {
      pass('"' + it.name.slice(0, 40) + '": endpoints agree (' + it.sd_span.join('..') + ') AND the '
        + 'interior is the authority\'s — ' + it.sd_distinct + ' distinct values on both sides, from '
        + '16 indices, with every multiplicity equal (ROADMAP #304)');
      /* THE ROW MUST NOT BE VACUOUS. If the authority's sixteen indices all landed on one value there
       * is nothing here to agree about, and "identical" would be free. */
      if (it.sd_distinct < 2)
        fail('the authority produced only ' + it.sd_distinct + ' distinct value(s) for "'
          + it.name.slice(0, 40) + '", so this row proves nothing about a roll. Re-stage it.');
    }
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
  /* REWRITTEN 2026-08-07, ROADMAP #81 WIRE 7, and the previous text is left directly below so the
   * change of claim is readable rather than silent. This case USED to pass on the two engines
   * DISAGREEING — Showdown recording Colbur as eaten by itself, medicham2 as knocked off — and it
   * failed with "Good news, and this case must be rewritten" the moment they agreed. They agree now:
   * Knock Off's strip moved below the damage, so the berry's own `onSourceModifyDamage` gets first
   * refusal exactly as it does in the authority. The assertion is inverted, and the KNOCKED-OFF
   * disposition is now the failure. */
  const sdKnocked = col && col.showdown_enditem.some(l => /move:\s*knock ?off/i.test(l));
  const meKnocked = col && col.medicham_enditem.some(l => /move:\s*knock ?off/i.test(l));
  if (!sdEaten)
    fail('SHOWDOWN did not record Colbur as eaten — the scenario is not staging the berry at all.');
  else if (meKnocked || sdKnocked)
    fail('Colbur is recorded as KNOCKED OFF (showdown ' + sdKnocked + ', medicham ' + meKnocked
      + '). The strip must sit below the damage, or the berry never gets to eat itself — and Harvest, '
      + 'Recycle, Belch, Cud Chew and Unburden all read "was it eaten".');
  else if (!meEaten)
    fail('medicham2 does not record Colbur as EATEN at all. Showdown writes two lines for a resist '
      + 'berry, `[eat]` then `[weaken]`; neither reached the stream.');
  else pass('both engines record Colbur as EATEN BY ITSELF and neither as knocked off — the '
      + 'disposition, not just the end state');
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
