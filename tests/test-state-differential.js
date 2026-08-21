/* test-state-differential.js — THE GATE ON THE TWO INSTRUMENT MODULES MEASURE OWNS.
 *
 *   SHOWDOWN_PATH=... node tests/test-state-differential.js [--pairs N]
 *
 * `engine/board_state.js` reads the BOARD out of both engines at the turn boundary — HP, status and
 * its counters, items, all seven stat stages, who is alive, every field condition WITH ITS CLOCK, and
 * the persistent volatiles. `engine/divergence_shape.js` decides what two disagreeing protocol lines
 * disagree ABOUT. Neither is an engine: they decide what a differential run SAYS, which is why both
 * sit outside the frozen engine release and why one file gates them.
 *
 * WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE". A board divergence is a FINDING and is reported by
 * the driver. This file goes red only when an INSTRUMENT is wrong, which it can be in seven ways and has
 * already been in two of them:
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
 *   PART 6  `divergence_shape.js` shapes the causes the differential actually writes. Its whole
 *           contract is that UNPARSED means "this file could not tell" and never a sixth kind of
 *           disagreement — and for a day it was 26 of 145 parted games, because the class name was
 *           stripped with a regex that could not pass a colon.
 *   PART 7  the post-faint group is held in every place a body is compared, or in none of them. It was
 *           held on the bench and not on the active slot or in the PP map, and that asymmetry put 8 of
 *           91 different-end-board games into the instrument's own headline. It runs last because it
 *           is the newest, and the numbering above is stable so that one run's report can be read
 *           against another's.
 *
 * ================= WHY PARTS 2 AND 3 WERE REWRITTEN ON 2026-08-20 ================================
 *
 * This file was RED with SEVEN failures, and not one of them was the comparator.
 *
 * SIX were PART 2 reporting NOT APPLIED on the six BENCH plants. The proof plants at the LAST BOARD
 * THE CLEAN ARM AGREED AT, which on a pair that agrees all the way is the final boundary — a board
 * where neither side has a living body on the bench. `benchedLivingEither` then finds nobody, the
 * plant honestly reports NOT APPLIED, and in that one line it is indistinguishable from a comparator
 * that looked and saw nothing. Will has taught this twice: **a COULD-NOT-STAGE verdict is a claim
 * about the fixture, never about the mechanic.** `tests/probe_bench_plants.js` proved the point by
 * running the same proof over eight pairs — 41 of 42 plants caught, at the planted boundary and
 * localised, every time they were APPLIED. So PART 2 now runs pairs until every plant has been applied
 * somewhere, exactly as that probe does, and it separates the two sentences instead of merging them.
 *
 * THE SEVENTH WAS A REAL FINDING WEARING THE WRONG ASSERTION. PART 3 failed with
 * `p1.party.aggronmega.ability   medicham wanderingspirit / showdown filter` and called it "the party
 * is being matched by index again". It is not an index bug — the path is keyed by SPECIES, which is
 * the very thing the part exists to check — it is the Trace-family ability divergence the end-state
 * run found on 2026-08-19, on a body both engines call alive. The assertion OVER-MATCHED: "a board
 * that differs only in the party" catches every real party divergence as well as the index hazard.
 *
 * SO THE ASSERTION IS NOW THE HAZARD ITSELF, EXACTLY. Showdown's reordering is applied a SECOND time,
 * deliberately, to a copy of its own side — and the comparator must return the identical diff set. An
 * index-keyed reader answers differently under a permutation; a species-keyed one cannot. That is
 * exact rather than inferential, it needs no board that agrees elsewhere, and it CANNOT fire on an
 * engine defect, because both arms of the comparison carry the same defect. The party divergences it
 * used to fail on are printed as FINDINGS with the leaf named — they are ENGINE's, they are open, and
 * repairing this assertion must not repair them into silence.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? +process.argv[i + 1] : d; };
const PAIRS = Math.max(1, argOf('--pairs', 6));

/* THE DRIVER READS ITS OWN FLAGS OFF argv, so the state path has to be armed before it is loaded.
 * Without this the boards are never read and every assertion below would pass on an empty run — the
 * silent-zero shape this whole file is about. Asserted immediately after the require. */
process.argv.push('--state');
const N = require(D('engine', 'names.js'));
const G = require(D('engine', 'game_differential.js'));
const BS = require(D('engine', 'board_state.js'));
const SHAPE = require(D('engine', 'divergence_shape.js'));
const M = G.REL.require('engine/medicham2-browser.js');

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);
/* A FINDING IS NOT A FAILURE OF THIS FILE, AND IT IS NOT SILENCE EITHER. It is printed with the leaf
 * and the two values, so an engine defect this instrument can see is on the record of every run. */
const finding = (m) => console.log('  FIND  ' + m);

/* The driver's own freeze, built from its own exported primitives rather than a second copy of the
 * policy: a proof or a diagnostic must not leave coverage credit behind, because credit STEERS which
 * games the later parts play. */
const frozen = (fn) => { const s = G.driverSnap(); try { return fn(); } finally { G.driverRestore(s); } };

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

/* ================= PART 2 — THE PLANTED STATE DIVERGENCE, OVER ENOUGH PAIRS ===================== */
console.log('\nPART 2 — one plant per compared field family, written into the LIVE medicham board');
{
  /* PAIRS FROM SEVERAL CONFIGURATIONS, not several from one, for the reason probe_bench_plants.js
   * gives: the plant boundary is a property of how long a pair AGREES, and one configuration's pairs
   * agree for similar reasons — so a bench that is all corpses at that boundary repeats. */
  const work = [];
  for (const cfg of G.SW.out) {
    const q = G.pairsFor(cfg.config);
    for (let i = 0; i < 2 && i < q.length; i++) work.push({ cfg: cfg.config, pr: q[i] });
    if (work.length >= PAIRS) break;
  }
  if (!work.length) fail('no proof pair could be built — PART 2 did not run, which is not a pass');
  else {
    const per = new Map();
    for (const [what] of G.STATE_PLANTS) per.set(what, { what, applied: 0, proven: 0, unproven: [] });
    let ranPairs = 0, shortRun = false;
    for (const w of work.slice(0, PAIRS)) {
      G.driverReset();
      const P = frozen(() => G.plantedStateProof(w.pr.a, w.pr.b));
      ranPairs++;
      if (P.plants.length !== G.STATE_PLANTS.length) {
        fail('the proof ran ' + P.plants.length + ' plants and ' + G.STATE_PLANTS.length
           + ' are declared — ' + (P.plants[0] ? P.plants[0].what : '?'));
        shortRun = true;
        break;
      }
      note(w.cfg + ': ' + P.clean.boundaries_agreed + '/' + P.clean.boundaries + ' boundaries agreed on '
         + 'the clean arm, plants go at boundary ' + P.clean.planted_at_boundary + '; '
         + P.plants.filter(p => p.applied).length + '/' + P.plants.length + ' applied');
      for (const p of P.plants) {
        const e = per.get(p.what); if (!e) continue;
        if (!p.applied) continue;
        e.applied++;
        if (p.caught && p.at_the_planted_boundary && p.localised) e.proven++;
        else e.unproven.push({ pair: w, plant: p, boundary: P.clean.planted_at_boundary });
      }
    }

    /* ---- THE TWO SENTENCES, SEPARATED BY MEASUREMENT AND NOT BY ASSUMPTION --------------------
     * A plant that was applied and not caught is EITHER a leaf the comparator cannot see — a hole,
     * and the whole reason this proof exists — OR a mutation that changed nothing, in which case
     * `applied` is a false receipt from the plant and there was never anything to catch. The proof
     * cannot tell them apart, because it sets `applied` from whether the callback returned truthy.
     * So this asks the BOARD: run that one plant again, read medicham's board either side of the
     * mutation, and see whether it MOVED. Exact, and it costs one game per unproven instance. */
    const mutateOf = new Map(G.STATE_PLANTS.map(([what, wantPath, mutate]) => [what, mutate]));
    /* AND "THE BOARD MOVED" IS NOT THE QUESTION — "THE BOARD MOVED WHERE THE COMPARATOR LOOKS" IS.
     * `board_state.js` holds the post-faint group on a body both engines call dead, deliberately and
     * with a receipt, because the authority's `clearVolatile` on a faint is housekeeping rather than a
     * rule. Several plants write straight into `S.actA[0]` without asking whether anybody is standing
     * there, and at a late plant boundary that slot is often a corpse. Such a plant IS a no-op as far
     * as this instrument is concerned, and calling it a hole would be the first version of this
     * diagnostic reporting the comparator for obeying its own rule — the probe-wrong-before-the-engine
     * failure docs/LESSONS.md §5 is about. So the two boards are compared THROUGH `BS.compare` with the
     * second stamped as the other engine, which applies exactly the cross-engine rule a real pair gets. */
    const seenByComparator = (before, after) =>
      BS.compare(before, Object.assign({}, after, { engine: 'showdown' }), { compared: 0 }).length > 0;
    const diagnose = (u, what) => {
      const mutate = mutateOf.get(what);
      if (!mutate) return 'NO-SUCH-PLANT';
      let verdict = 'NEVER-REACHED';
      G.driverReset();
      frozen(() => G.playGame(u.pair.pr.a, u.pair.pr.b, u.pair.cfg, 'noop/' + what.slice(0, 12), {
        statePlant: (S2, b2, turnIdx) => {
          if (turnIdx !== u.boundary) return;
          const before = BS.readMedi(S2, G.BS_CTX);
          const applied = mutate(S2);
          const after = BS.readMedi(S2, G.BS_CTX);
          verdict = !applied ? 'NOT-APPLIED'
                  : (JSON.stringify(before) === JSON.stringify(after) ? 'NO-OP'
                  : (seenByComparator(before, after) ? 'MOVED' : 'HELD'));
        } }));
      return verdict;
    };

    let holes = 0, never = 0;
    const held = [], noop = [];
    if (!shortRun) for (const e of per.values()) {
      if (e.applied === 0) {
        never++;
        fail('NEVER APPLIED on any of ' + ranPairs + ' pairs — ' + e.what + '. A leaf nobody has seen '
           + 'the comparator catch anything on is UNPROVEN, which is not a pass. Raise --pairs, or the '
           + 'fixture cannot reach it at all.');
        continue;
      }
      for (const u of e.unproven) {
        const v = diagnose(u, e.what);
        if (v === 'MOVED') {
          holes++;
          fail('A HOLE — ' + e.what + ' MOVED medicham\'s board at boundary ' + u.boundary + ' on the '
             + u.pair.cfg + ' pair, in a leaf the comparator DOES compare, and it was not caught there '
             + '[caught=' + u.plant.caught + ' at=' + u.plant.at + ' localised=' + u.plant.localised
             + ' reported=' + (u.plant.paths || []).slice(0, 3).join(',') + ']');
        } else if (v === 'HELD') held.push({ what: e.what, at: u.pair.cfg + '@' + u.boundary });
        else noop.push({ what: e.what, at: u.pair.cfg + '@' + u.boundary, v });
      }
      if (e.applied && !e.proven) {
        fail('NEVER PROVEN — ' + e.what + ' was applied ' + e.applied + ' time(s) over ' + ranPairs
           + ' pairs and was never once caught at the planted boundary AND localised to its own leaf.');
      }
    }
    /* THE FIXTURE'S TWO SHAPES, REPORTED AS TWO LINES AND NOT AS TWENTY-THREE. They are one cause
     * each; printing one line per instance is how a report teaches people to skip its own output, and
     * this file already fails that way once (seven red lines that were two facts). */
    if (held.length) {
      const where = [...new Set(held.map(h => h.at))].join(', ');
      finding('THE FIXTURE, NOT THE COMPARATOR — ' + held.length + ' plant instance(s) across '
        + new Set(held.map(h => h.what)).size + ' plants landed on a body BOTH engines call DEAD, inside '
        + 'the post-faint group board_state.js deliberately holds, so there was nothing to catch. The '
        + 'plants write into `S.actA[0]`/`S.actB[1]` without asking whether anybody is standing there, '
        + 'and a late plant boundary usually has a corpse in a slot. ENGINE\'s file '
        + '(engine/game_differential.js STATE_PLANTS): FILED, not patched from here.');
      note('  where: ' + where + '   e.g. ' + held.slice(0, 3).map(h => h.what).join('; '));
    }
    for (const h of noop)
      finding('THE FIXTURE, NOT THE COMPARATOR — ' + h.what + ' reported APPLIED at ' + h.at + ' and '
        + 'changed NOTHING on the board (' + h.v + '). `applied` in engine/game_differential.js means '
        + '"the callback returned truthy", not "the board moved". ENGINE\'s file: FILED, not patched here.');
    if (!shortRun && !holes && !never) pass('all ' + per.size + ' plants applied on at least one of '
      + ranPairs + ' pairs, and every plant that actually moved a COMPARED leaf was caught at the '
      + 'planted boundary and localised to its own leaf'
      + (held.length || noop.length ? '  (' + (held.length + noop.length) + ' instance(s) had nothing to '
        + 'catch — named above)' : ''));
    /* AND THE BENCH LEAVES ARE NAMED, so a report cannot say "all plants passed" while the bench half
     * silently ran zero — the half that was NOT APPLIED on every pair until this rewrite. */
    const bench = [...per.values()].filter(e => /BENCHED/.test(e.what));
    note('bench leaves exercised: ' + bench.length + ' — '
       + bench.map(e => e.applied + '/' + e.proven + (e.proven ? ' OK' : ' **BAD**')).join(', ')
       + '   (applied/proven over ' + ranPairs + ' pairs)');
  }
}

/* ================= PART 3 — THE PARTY IS KEYED BY SPECIES, NOT BY INDEX ========================= */
console.log('\nPART 3 — Showdown REORDERS side.pokemon on switch-in; the comparator must not care');
{
  /* FIRST, PROVE THE HAZARD IS LIVE. A regression test for a reordering that no longer happens would
   * pass forever while testing nothing, which is the vacuous-green shape this project keeps finding. */
  let sawReorder = false, permuted = 0, disagreed = 0, firstDisagreement = null;
  let controlChecked = 0, controlBad = 0, firstControlBad = null;
  const partyFindings = new Map();
  const initialOrder = new WeakMap();

  /* THE PERMUTATION. A SHALLOW COPY of the side with `pokemon` reversed — never a mutation of the live
   * battle, which would corrupt the game the driver is still playing. `readShowdown` reads exactly
   * three properties off a side (`sideConditions`, `pokemon`, `active`), so the copy is complete; if
   * it ever reads a fourth, the CONTROL below fails rather than this silently testing nothing. */
  const flip = (side) => ({ sideConditions: side.sideConditions,
                            pokemon: (side.pokemon || []).slice().reverse(),
                            active: side.active });
  const shape = (rows) => JSON.stringify(rows.map(d => [d.path, d.medicham, d.showdown])
                                             .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

  outer:
  for (const cfg of G.SW.out) {
    for (const pr of G.pairsFor(cfg.config)) {
      G.playGame(pr.a, pr.b, cfg.config, 'party-order', {
        onBoundary: (snap, turnIdx, S, battle) => {
          /* THE QUALIFYING BOUNDARY IS ONE WHERE A REORDER HAS ACTUALLY HAPPENED, and the cap counts
           * only those. A sticky "we saw one earlier" flag would let the cap fill up with the first
           * forty boundaries of the first two games — the assertion would still be exact, but the
           * sample it runs on would be a fraction as deep, and the FINDINGS below would be a claim
           * about two games rather than about the swarm. */
          let reordered = false;
          for (const side of [battle.p1, battle.p2]) {
            const now = (side.pokemon || []).map(p => N.id(p.species.id)).join(',');
            if (!initialOrder.has(side)) { initialOrder.set(side, now); continue; }
            if (initialOrder.get(side) !== now) { reordered = true; sawReorder = true; }
          }
          if (!reordered) return;
          if ((battle.p1.pokemon || []).length < 2 || (battle.p2.pokemon || []).length < 2) return;

          /* THE CONTROL — re-read the SAME battle through the same reader and the same ctx. If this
           * does not reproduce the driver's own diff set, the assertion below is comparing two things
           * this file built rather than the instrument the run uses, and it says so. */
          const sd1 = BS.readShowdown(battle, G.BS_CTX);
          const d1 = BS.compare(snap.medi, sd1, { compared: 0 });
          controlChecked++;
          if (shape(d1) !== shape(snap.diffs)) {
            controlBad++;
            if (!firstControlBad) firstControlBad = { mine: d1.map(x => x.path).slice(0, 6),
                                                      driver: snap.diffs.map(x => x.path).slice(0, 6) };
          }

          /* THE ASSERTION — the identical board with Showdown's party in a different order. */
          const sd2 = BS.readShowdown({ field: battle.field, p1: flip(battle.p1), p2: flip(battle.p2) },
                                      G.BS_CTX);
          const d2 = BS.compare(snap.medi, sd2, { compared: 0 });
          permuted++;
          if (shape(d1) !== shape(d2)) {
            disagreed++;
            if (!firstDisagreement) firstDisagreement = { before: d1.map(x => x.path).slice(0, 6),
                                                          after: d2.map(x => x.path).slice(0, 6) };
          }

          /* AND WHAT THE OLD ASSERTION WAS ACTUALLY CATCHING, kept as a FINDING. It failed on
           * `p1.party.aggronmega.ability   medicham wanderingspirit / showdown filter` — a real engine
           * divergence on a benched body that both engines call ALIVE, the family the end-state run of
           * 2026-08-19 named (Trace copying a different ability in the two engines).
           *
           * EVERY PARTY-LEAF DIVERGENCE IS COLLECTED, NOT ONLY THE ONES ON AN OTHERWISE-AGREEING BOARD.
           * The old condition — "the board differs ONLY inside the party" — is what made it look like an
           * indexing artefact, and it is also LUCK: the same defect on a board that has parted anywhere
           * else would print nothing. `only_party` is kept as a flag on the row, because a board that
           * has parted elsewhere is weaker evidence, not absent evidence. */
          const onlyParty = !snap.diffs.some(d => !/\.party\./.test(d.path));
          for (const d of snap.diffs) {
            if (!/\.party\./.test(d.path)) continue;
            const leaf = d.path.replace(/^p[12]\.party\.[^.]+\./, '');
            const k = d.path + ' :: ' + d.medicham + ' / ' + d.showdown;
            if (!partyFindings.has(k)) partyFindings.set(k, { n: 0, path: d.path, leaf, only_party: false,
                                                             m: d.medicham, s: d.showdown });
            const row = partyFindings.get(k);
            row.n++;
            if (onlyParty) row.only_party = true;
          }
        } });
      if (permuted >= 40) break outer;
    }
  }

  if (!sawReorder) fail('no switch-in ever reordered Showdown\'s side.pokemon in this sample, so PART 3 '
    + 'tested nothing. That is not a pass — it means the hazard could not be reached and the '
    + 'regression is unguarded.');
  else if (!permuted) fail('the reorder was reached but no boundary had two bodies on both sides to '
    + 'permute, so the assertion never ran. That is not a pass.');
  else if (controlBad) fail('the CONTROL failed on ' + controlBad + ' of ' + controlChecked
    + ' boundaries: re-reading the same battle through board_state.js did not reproduce the driver\'s '
    + 'own diff set, so this part is not testing the instrument the run uses. First: '
    + JSON.stringify(firstControlBad));
  else if (disagreed) fail('PERMUTING Showdown\'s side.pokemon changed the comparison on ' + disagreed
    + ' of ' + permuted + ' boundaries — the party is being matched by index again. First: '
    + JSON.stringify(firstDisagreement));
  else pass('Showdown\'s party was permuted on ' + permuted + ' boundaries and the comparator returned '
    + 'the identical diff set every time, so the match is by species and not by index'
    + '  (control: ' + controlChecked + ' boundaries reproduced the driver\'s own diffs)');

  /* THE FINDINGS, WHICH ARE ENGINE'S AND ARE NOT THIS FILE'S VERDICT. Printed with the leaf and both
   * values, because the seventh failure this part used to report was one of these wearing an index
   * bug's name, and repairing the assertion must not repair the defect underneath it into silence. */
  const rows = [...partyFindings.values()].sort((a, b) => b.n - a.n);
  const strong = rows.filter(f => f.only_party);
  const byLeaf = {};
  for (const f of rows) byLeaf[f.leaf] = (byLeaf[f.leaf] || 0) + 1;
  note('divergences on a BENCHED body over ' + permuted + ' reordered boundaries: ' + rows.length
     + ' distinct leaf/value rows' + (rows.length ? '  [' + Object.entries(byLeaf).sort((a, b) => b[1] - a[1])
       .map(([k, v]) => k + ' ' + v).join(', ') + ']' : '') + '; ' + strong.length + ' of them on a board '
     + 'that agrees everywhere else. They belong to ENGINE — this part is not their gate.');
  /* ONLY THE STRONG ONES ARE PRINTED IN FULL. A benched HP or status difference on a board that has
   * already parted elsewhere is a CONSEQUENCE of that divergence, and printing eight of them every run
   * is how a report teaches people to skip its own output. The one the old assertion tripped on was of
   * the strong kind — the board agreed everywhere else — so nothing that mattered is being quietened. */
  for (const f of strong.slice(0, 8))
    finding(f.path + '   medicham ' + JSON.stringify(f.m) + ' / showdown ' + JSON.stringify(f.s)
          + '   (' + f.n + ' boundary/ies, on a board that agrees EVERYWHERE else — this is the shape '
          + 'the old assertion mistook for an indexing bug)');
  if (!rows.length)
    note('none at all in this sample. That is a fact about this sample and not a claim that the family '
       + 'is fixed: the population is measured by the end-state run, not here.');
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

/* ================= PART 6 — THE SHAPE MODULE SHAPES WHAT THE DIFFERENTIAL WRITES ================ */
console.log('\nPART 6 — engine/divergence_shape.js, on the cause strings classify() actually builds');
{
  for (const r of SHAPE.selfProof()) {
    if (r.ok) pass(r.want.padEnd(9) + r.what);
    else fail('shaped ' + JSON.stringify(r.cause) + ' as ' + r.got + ' (key ' + JSON.stringify(r.key)
            + ') and it is ' + r.want + ' — ' + r.what);
  }
  /* AND THE CONTRACT ITSELF, ON THE LIVE ARTIFACT RATHER THAN ON A FIXTURE. UNPARSED means "this file
   * could not tell", so every UNPARSED cause must genuinely not be two protocol lines. One that IS a
   * pair is this module failing while looking like a category — 26 of 145 parted games on 2026-08-19,
   * quoted as the most dangerous of the five shapes. */
  let art = null;
  try { art = require(D('data', 'game-differential.json')); } catch (e) { art = null; }
  if (!art || !Array.isArray(art.classes)) {
    note('data/game-differential.json is absent or has no classes — the live half of PART 6 did not '
       + 'run. That is not a pass for it; the fixtures above still ran.');
  } else {
    /* AND THIS MUST NOT ASK `stripClass` WHETHER `stripClass` WORKED. The first version of this check
     * did — it read the cause through the module's own stripper and then asked whether the result was
     * two lines — and it PASSED on a deliberate break that reverted the stripper, reporting "27 of 166
     * causes, all genuinely unshapeable" while 26 of them were pairs. A circular check is worse than
     * no check: it is a green light wired to the thing it is inspecting. The independent reader is the
     * cause from its FIRST PIPE onward, which is where a protocol line starts and where no class name
     * classify() writes can reach. */
    const fromFirstPipe = (s) => { const i = String(s).indexOf('|'); return i < 0 ? null : String(s).slice(i); };
    const bad = [];
    let unparsed = 0, total = 0;
    for (const c of art.classes) for (const k of (c.causes || [])) {
      total++;
      if (SHAPE.shapeOf(k.cause).shape !== 'UNPARSED') continue;
      unparsed++;
      const body = fromFirstPipe(k.cause);
      if (!body) continue;
      const half = body.split(' <> ');
      if (half.length === 2 && SHAPE.LINE(half[0]) && SHAPE.LINE(half[1])) bad.push(k.cause);
    }
    if (bad.length) fail(bad.length + ' cause(s) in data/game-differential.json are shaped UNPARSED and '
      + 'ARE two protocol lines — the bucket is this module\'s own gap being read as a class. First: '
      + JSON.stringify(bad[0]));
    else pass('every UNPARSED cause in data/game-differential.json really is not a pair of protocol '
      + 'lines  (' + unparsed + ' of ' + total + ' causes, artifact release '
      + (art.engine_release || '?') + ')');
  }
}

/* ================= PART 7 — THE POST-FAINT GROUP IS HELD IN EVERY PLACE, OR IN NONE ============= */
console.log('\nPART 7 — a corpse is held on the bench, on the active slot and in the PP map alike');
{
  /* WHY THIS EXISTS. Until 2026-08-20 `compare()` held the post-faint group on the BENCH and compared
   * it on the ACTIVE slot and in the PP map, so a body both engines call dead kept its boosts, its
   * volatiles and its spent PP on one side of the comparison and lost them on the other. It cost 8 of
   * the 91 different-end-board games in the 797-game end-state run — 8.8% of the headline, contributed
   * by the reader. Nothing could have caught it, because a hold is invisible in a diff count.
   *
   * SO IT IS ASSERTED ON SYNTHETIC BOARDS, EXACTLY, IN MILLISECONDS. Four claims, and the last two
   * matter as much as the first two: a hold that is too WIDE silences a real divergence, and a rule
   * scoped to cross-engine pairs must not quietly start applying to `tests/roster.js`. */
  const body = (o) => Object.assign({ species: 'x', hp: 0, maxhp: 100, fainted: false, status: '',
    status_counter: 0, item: '', types: 'fire', ability: 'blaze', boosts: { atk: 0 }, vol: { taunt: 0 } }, o);
  const bench = (o) => Object.assign({ hp: 0, maxhp: 100, fainted: false, status: '', types: 'fire',
    item: '', status_counter: 0, boosts: { atk: 0 }, ability: 'blaze' }, o);
  const side = (act, party, pp) => ({ screens: { physical: 0, special: 0 }, tailwind: 0,
    hazards: {}, party, active: act, pp });
  /* `dead` decides whether both bodies are corpses; `v` is the value written into EVERY post-faint
   * leaf on one side, so one board differs from the other in the whole group at once. */
  const boardOf = (engine, dead, v) => ({ engine, field: { weather: '' }, sides: {
    p1: side([body({ fainted: dead, boosts: { atk: v }, vol: { taunt: v }, item: v ? 'sitrusberry' : '',
                     ability: v ? 'levitate' : 'blaze', status_counter: v }), null],
             { y: bench({ fainted: dead, boosts: { atk: v }, item: v ? 'leftovers' : '',
                          ability: v ? 'levitate' : 'blaze', status_counter: v }) },
             [{ protect: v }, null]),
    p2: side([null, null], {}, [null, null]) } });
  const run = (a, b) => { const st = { compared: 0 }; const d = a && b ? BS.compare(a, b, st) : []; return { d, st }; };

  const dead = run(boardOf('medicham2', true, 2), boardOf('showdown', true, 0));
  if (dead.d.length) fail('a corpse still parts the board on ' + JSON.stringify(dead.d.map(x => x.path))
    + ' — the post-faint group is not held in every place a body is compared');
  else if (!(dead.st.party_post_faint_skipped > 0 && dead.st.active_post_faint_skipped > 0
             && dead.st.pp_post_faint_skipped > 0))
    fail('the hold fired without a receipt: ' + JSON.stringify(dead.st) + '. "Not asked" and "agreed" '
       + 'are different sentences and only one of them is honest.');
  else pass('bench, active slot and PP map all hold the post-faint group on a body both engines call '
    + 'dead, and all three counters say so  ' + JSON.stringify({
        party: dead.st.party_post_faint_skipped, active: dead.st.active_post_faint_skipped,
        pp: dead.st.pp_post_faint_skipped }));

  const alive = run(boardOf('medicham2', false, 2), boardOf('showdown', false, 0));
  const wantAlive = ['p1.party.y.boosts.atk', 'p1.party.y.item', 'p1.party.y.ability',
                     'p1.party.y.status_counter', 'p1.active[0].boosts.atk', 'p1.active[0].item',
                     'p1.active[0].ability', 'p1.active[0].status_counter', 'p1.active[0].vol.taunt',
                     'p1.pp[0].protect'];
  const missed = wantAlive.filter(p => !alive.d.some(d => d.path === p));
  if (missed.length) fail('the hold is TOO WIDE — these leaves differ on a LIVING body and were not '
    + 'reported: ' + JSON.stringify(missed));
  else pass('every post-faint leaf is still compared on a body both engines call alive (' + alive.d.length
    + ' differences, all ' + wantAlive.length + ' expected paths present)');

  /* THE UNDER-SKIP GUARD. `species`, `maxhp` and `types` are deliberately NOT in the group, because
   * Showdown regresses a fainted mega's forme and medicham2 does not — that is a FINDING and must not
   * be swallowed by a rule aimed at boosts and PP. */
  const regressed = JSON.parse(JSON.stringify(boardOf('showdown', true, 0)));
  regressed.sides.p1.active[0].species = 'xbase';
  regressed.sides.p1.active[0].maxhp = 90;
  regressed.sides.p1.active[0].types = 'rock/steel';
  const forme = run(boardOf('medicham2', true, 2), regressed);
  const got = forme.d.map(x => x.path).sort();
  if (JSON.stringify(got) !== JSON.stringify(['p1.active[0].maxhp', 'p1.active[0].species', 'p1.active[0].types']))
    fail('a fainted body that changed FORME reported ' + JSON.stringify(got) + ' — species, maxhp and '
       + 'types must stay compared on a corpse, and nothing else may appear beside them');
  else pass('a corpse that regresses forme still parts the board on species, maxhp and types — the one '
    + 'thing about a dead body a later board can still be wrong about');

  const same = run(boardOf('medicham2', true, 2), boardOf('medicham2', true, 0));
  if (!same.d.some(d => d.path === 'p1.active[0].boosts.atk'))
    fail('a SAME-ENGINE pair had its active slot held. The rule is about two engines keeping house '
       + 'differently; tests/roster.js and the differential\'s turn-to-turn credit compare one engine '
       + 'with itself and a held leaf is signal they do not get.');
  else if (!(same.st.post_faint_not_held_same_engine > 0))
    fail('a same-engine pair was not held and did not say so — the population the rule deliberately '
       + 'does not cover must be a number, not an assumption.');
  else pass('a same-engine pair is compared in full on the active slot, and the leaves that a '
    + 'cross-engine pair would have held are counted (' + same.st.post_faint_not_held_same_engine + ')');
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — an instrument is not trustworthy'
  : 'ALL PARTS PASS — the board comparator and the shape module can be believed'));
process.exit(failures ? 1 : 0);
