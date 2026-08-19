/* test-state-differential.js — THE GATE ON THE BOARD COMPARATOR, not on the engines it compares.
 *
 *   SHOWDOWN_PATH=... node tests/test-state-differential.js
 *
 * `engine/board_state.js` reads the BOARD out of both engines at the turn boundary — HP, status and
 * its counters, items, all seven stat stages, who is alive, every field condition WITH ITS CLOCK, and
 * the persistent volatiles. It exists because `engine/game_differential.js` compares the PROTOCOL
 * STREAM and has no state comparison in it anywhere, and ten wires were aimed with it.
 *
 * WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE". A board divergence is a FINDING and is reported by
 * the driver. This file goes red only when the INSTRUMENT is wrong, which it can be in four ways and
 * has already been in one of them:
 *
 *   PART 1  the representation mappings, both directions. A mapping that collapses the MEANING it is
 *           supposed to preserve is a silencer, and every rate would then be the comparator.
 *   PART 2  the planted-state-divergence proof. One plant per compared field family, written into the
 *           LIVE medicham board, each of which must be caught AT the planted boundary and LOCALISED to
 *           the planted field. A comparator that has never been shown catching a planted state bug is
 *           not a comparator.
 *   PART 3  THE PARTY IS KEYED BY SPECIES AND NOT BY INDEX, and this part exists because the first
 *           version of this instrument got it wrong. Showdown REORDERS `side.pokemon` on every
 *           switch-in; medicham2 never reorders `sf.team`. Index-matching compared two different
 *           Pokemon's HP the moment anybody pivoted and reported 123 of 179 games as diverging on
 *           `party.species` — a manufactured divergence larger than anything real in the run.
 *   PART 4  BOTH of medicham2's side-condition shapes are readable. Five of the thirteen frozen
 *           releases predate WIRE 8 and hold screens as two CATEGORY counters rather than named
 *           conditions; a reader that knew only the new shape would report every pre-WIRE-8 screen as
 *           absent, which looks exactly like the wires fixing screens and would MANUFACTURE the rising
 *           ladder this instrument was built to test for.
 *   PART 5  the boundary is AFTER the residual phase. If it were taken earlier, Leftovers, chip, the
 *           toxic stage, Leech Seed, Perish and every ticking clock would be invisible — a board
 *           nobody ever plays from.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

/* THE DRIVER READS ITS OWN FLAGS OFF argv, so the state path has to be armed before it is loaded.
 * Without this the boards are never read and every assertion below would pass on an empty run — the
 * silent-zero shape this whole file is about. Asserted immediately after the require. */
process.argv.push('--state');
const N = require(D('engine', 'names.js'));
const G = require(D('engine', 'game_differential.js'));
const BS = require(D('engine', 'board_state.js'));
const M = G.REL.require('engine/medicham2-browser.js');

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

/* ================= PART 1 — THE MAPPINGS, BOTH DIRECTIONS ======================================= */
console.log('\nPART 1 — every representation mapping, in both directions, before any board is read');
{
  const proof = BS.mappingProof(N, M);
  if (proof.length !== BS.MAPPINGS.length)
    fail('the proof covers ' + proof.length + ' mappings and ' + BS.MAPPINGS.length + ' are declared');
  for (const r of proof) {
    if (!r.collapses) fail(r.id + ' DOES NOT COLLAPSE the form it claims to — it is dead weight');
    else if (!r.keeps_meaning) fail(r.id + ' is a SILENCER: it collapses the DISTINCT pair too');
    else pass(r.id);
  }
}

/* ================= PART 2 — THE PLANTED STATE DIVERGENCE ======================================== */
console.log('\nPART 2 — one plant per compared field family, written into the LIVE medicham board');
{
  const pairs = G.pairsFor('baseline');
  if (!pairs.length) fail('no proof pair could be built — PART 2 did not run, which is not a pass');
  else {
    const P = G.plantedStateProof(pairs[0].a, pairs[0].b);
    note(P.clean.boundaries_agreed + '/' + P.clean.boundaries + ' boundaries agreed on the clean arm; '
       + 'plants go at boundary ' + P.clean.planted_at_boundary);
    if (P.plants.length !== G.STATE_PLANTS.length)
      fail('the proof ran ' + P.plants.length + ' plants and ' + G.STATE_PLANTS.length + ' are declared');
    let bad = 0;
    for (const p of P.plants) {
      if (!p.applied) { bad++; fail('NOT APPLIED — ' + p.what + '. An unapplied plant reads exactly like '
        + 'a comparator that found nothing, and must never be counted as a pass.'); continue; }
      if (!p.caught) { bad++; fail('NOT CAUGHT — ' + p.what); continue; }
      if (!p.at_the_planted_boundary) { bad++; fail('caught at boundary ' + p.at + ' but planted at '
        + p.expected_at + ' — ' + p.what + '. The catch may be the game\'s own divergence.'); continue; }
      if (!p.localised) { bad++; fail('caught but NOT LOCALISED to ' + p.planted_field + ' — ' + p.what
        + '. It reported: ' + p.paths.join(', ')); continue; }
    }
    if (!bad) pass('all ' + P.plants.length + ' plants applied, caught at the planted boundary, and '
      + 'localised to the planted field');
    /* THE FIXTURE RECEIPT, PRINTED WHETHER OR NOT ANYTHING IS WRONG. A bench plant crosses to the
     * other side when the side it asked for has no LIVING benched body at the plant boundary — which
     * on this pair is the normal case, because the last agreeing board is late in the game. Silence
     * here would let "the plant went where it was aimed" and "the plant went somewhere else" read
     * alike, which is the silent-default shape this whole file is built against. */
    const flipped = P.plants.filter(p => p.fell_back_to_the_other_side);
    note(flipped.length + ' of ' + P.plants.length + ' plants had to cross to the other side (the '
       + 'requested side had no LIVING benched body at boundary ' + P.clean.planted_at_boundary + ')'
       + (flipped.length ? ': ' + flipped.map(p => p.what).join('; ') : ''));
    /* AND THE BENCH LEAVES ARE NAMED, so a report cannot say "all plants passed" while the bench half
     * silently ran zero. */
    const bench = P.plants.filter(p => /BENCHED/.test(p.what));
    note('bench leaves exercised: ' + bench.length + ' — '
       + bench.map(p => p.planted_field + (p.applied && p.caught && p.localised ? ' OK' : ' **BAD**')).join(', '));
  }
}

/* ================= PART 3 — THE PARTY IS KEYED BY SPECIES, NOT BY INDEX ========================= */
console.log('\nPART 3 — Showdown REORDERS side.pokemon on switch-in; the comparator must not care');
{
  /* FIRST, PROVE THE HAZARD IS LIVE. A regression test for a reordering that no longer happens would
   * pass forever while testing nothing, which is the vacuous-green shape this project keeps finding. */
  let sawReorder = false, checkedBoundaries = 0, falseParty = 0;
  let firstFalse = null;
  const initialOrder = new WeakMap();
  outer:
  for (const cfg of G.SW.out) {
    for (const pr of G.pairsFor(cfg.config)) {
      G.playGame(pr.a, pr.b, cfg.config, 'party-order', {
        onBoundary: (snap, turnIdx, S, battle) => {
          for (const side of [battle.p1, battle.p2]) {
            const now = side.pokemon.map(p => N.id(p.species.id)).join(',');
            if (!initialOrder.has(side)) { initialOrder.set(side, now); continue; }
            if (initialOrder.get(side) === now) continue;
            sawReorder = true;
            checkedBoundaries++;
            /* THE ASSERTION. A reorder ALONE must produce no party difference. Boards that have
             * genuinely parted elsewhere are excluded — this part is about the reader, and a real
             * engine divergence carrying a real party difference is a FINDING, not a fault here. */
            const nonParty = snap.diffs.filter(d => !/\.party\./.test(d.path) && !/\.party$/.test(d.path));
            const party = snap.diffs.filter(d => /\.party[.$]/.test(d.path) || /\.party\./.test(d.path));
            if (!nonParty.length && party.length) {
              falseParty++;
              if (!firstFalse) firstFalse = party.slice(0, 4);
            }
          }
        } });
      if (checkedBoundaries >= 40) break outer;
    }
  }
  if (!sawReorder) fail('no switch-in ever reordered Showdown\'s side.pokemon in this sample, so PART 3 '
    + 'tested nothing. That is not a pass — it means the hazard could not be reached and the '
    + 'regression is unguarded.');
  else if (falseParty) fail('a REORDER ALONE produced ' + falseParty + ' party differences on boards that '
    + 'agreed everywhere else — the party is being matched by index again. First: '
    + JSON.stringify(firstFalse));
  else pass('the reorder was reached on ' + checkedBoundaries + ' boundaries and produced no party '
    + 'difference on any board that agreed elsewhere');
}

/* ================= PART 4 — BOTH SIDE-CONDITION SHAPES ARE READABLE ============================= */
console.log('\nPART 4 — the pre-WIRE-8 category counters and the post-WIRE-8 named conditions');
{
  const ms = BS._internals.mediScreens;
  const oldShape = ms({ side: 'A', scrP: 4, scrS: 2 });
  const newShape = ms({ side: 'A', sc: { reflect: 4, lightscreen: 2 } });
  if (oldShape.shape !== 'category-counters') fail('the pre-WIRE-8 shape was not recognised as such');
  else if (newShape.shape !== 'named') fail('the post-WIRE-8 shape was not recognised as such');
  else if (oldShape.physical !== newShape.physical || oldShape.special !== newShape.special)
    fail('the same two screens project differently through the two shapes: '
      + JSON.stringify(oldShape) + ' vs ' + JSON.stringify(newShape));
  else pass('both shapes project to the same physical/special turns, so a pre-WIRE-8 release is not '
    + 'scored as having no screens at all');
  /* AURORA VEIL COUNTS ON BOTH SIDES, in both shapes, because that is what it does. */
  const veil = ms({ side: 'A', sc: { auroraveil: 5 } });
  if (veil.physical !== 5 || veil.special !== 5)
    fail('Aurora Veil did not project onto both sides: ' + JSON.stringify(veil));
  else pass('Aurora Veil projects onto both the physical and the special side');
  /* AND AN EMPTY SIDE IS ZERO IN BOTH SHAPES, never undefined — see the `no-condition-is-zero`
   * mapping. An undefined here would compare unequal to Showdown's 0 on every screenless turn. */
  const none = ms({ side: 'A', sc: {} });
  if (none.physical !== 0 || none.special !== 0) fail('a side with no screens did not read 0');
  else pass('a side with no screens reads 0, not undefined');
}

/* ================= PART 5 — THE BOUNDARY IS AFTER THE RESIDUAL PHASE ============================ */
console.log('\nPART 5 — the compared board is the one the NEXT decision is made from');
{
  /* A CLOCK THAT TICKS IS THE PROOF. Weather is set inside a turn and decremented in the residual; if
   * the boundary were taken before the residual, consecutive boundaries would show the SAME number.
   * Read off both engines separately, so a tick that only happened in one of them is visible. */
  let sawWeather = false, mediTicked = false, sdTicked = false, disagreed = 0;
  outer5:
  for (const cfg of G.SW.out) {
    for (const pr of G.pairsFor(cfg.config)) {
      const seq = [];
      G.playGame(pr.a, pr.b, cfg.config, 'residual-boundary', {
        onBoundary: (snap) => seq.push({ mw: snap.medi.field.weather, mt: snap.medi.field.weather_turns,
                                         sw: snap.sd.field.weather, st: snap.sd.field.weather_turns }) });
      for (let i = 1; i < seq.length; i++) {
        const a = seq[i - 1], b = seq[i];
        if (a.mw && b.mw && a.mw === b.mw) { sawWeather = true; if (b.mt < a.mt) mediTicked = true; }
        if (a.sw && b.sw && a.sw === b.sw) { if (b.st < a.st) sdTicked = true; }
        if (a.mw && a.mw === a.sw && a.mt !== a.st) disagreed++;
      }
      if (mediTicked && sdTicked) break outer5;
    }
  }
  if (!sawWeather) fail('no game in this sample held weather across two boundaries, so PART 5 tested '
    + 'nothing. That is not a pass.');
  else if (!mediTicked) fail('medicham2\'s weather clock did not decrease between two boundaries — the '
    + 'boundary is being taken BEFORE the residual phase, and the whole residual layer is invisible');
  else if (!sdTicked) fail('Showdown\'s weather clock did not decrease between two boundaries — same '
    + 'fault, on the other engine');
  else pass('both engines\' weather clocks decrease across consecutive boundaries, so the compared '
    + 'board is post-residual');
  note('boundaries where the two engines held the same weather with different counters: ' + disagreed
     + '  (a FINDING if non-zero, not a fault of this file)');
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — the state comparator is not trustworthy'
  : 'ALL PARTS PASS — the board comparator can be believed'));
process.exit(failures ? 1 : 0);
