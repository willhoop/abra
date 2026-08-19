/* test-end-state.js — THE GATE ON THE END-STATE MEASUREMENT, not on the engines it measures.
 *
 *   SHOWDOWN_PATH=... node tests/test-end-state.js
 *
 * WHAT IS BEING MEASURED AND WHY IT NEEDED A NEW STOP RULE. Will, 2026-08-12: *"how much is just
 * medicham being semantic"* — of the games whose PROTOCOL parted, how many end with the two engines
 * holding the SAME board, and how many genuinely played a different battle. Until this pass the driver
 * stopped at the first mismatched LINE (protocol mode) or the first mismatched BOARD (`--state`), so
 * the end of a diverged game was never reached and nobody could answer.
 *
 * `--end-state` is the third stop rule: run to the turn cap or to the end of the battle WHATEVER
 * either comparator has already found, and compare the LAST board both engines produced.
 *
 * WHAT IS RED HERE IS NEVER "THE ENGINES DISAGREE". A divergence is a finding and the driver reports
 * it. This file goes red only when the INSTRUMENT is wrong, in the four ways it can be:
 *
 *   PART 1  the verdict function itself — every branch, including the two that must NOT be folded
 *           into "agreed": a game that threw, and a game where ONE engine ended the battle and the
 *           other did not. A silent drop there would flatter the semantic rate, which is the whole
 *           number being reported.
 *   PART 2  the stop rule actually changed. A game whose protocol parted on turn 1 must still be
 *           playing on turn 2, or `--end-state` is `--state` wearing a new name and every "the boards
 *           agreed at the end" is really "the boards agreed at the point we stopped looking".
 *   PART 3  a PLANTED difference that is never undone must be caught AT THE END and LOCALISED, with
 *           the SAME PAIR AND SEED run clean as an explicit control. A comparator that has not been
 *           shown catching a planted end-state bug is not a comparator (168 red demonstrations in
 *           this repo, 0 failures, five probes found this week resting on the defect they watched).
 *   PART 4  the cross-tab is over the SHAPE module, not a second copy of it.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

/* THE DRIVER READS ITS FLAGS OFF argv, so the end-state path has to be armed before it is loaded —
 * exactly as tests/test-state-differential.js arms `--state`. Asserted immediately after the require,
 * because a run with the flag unread would pass every assertion below on an empty measurement. */
process.argv.push('--end-state');
/* ---- THE FIXTURE IS PINNED, AND NOT PINNING IT MADE THIS FILE RED FOR A DAY -------------------
 *
 * `docs/ENGINE.md` recorded PART 3 failing with *"the planted item difference did not reach the end
 * state — verdict SAME-END-STATE"* and attributed it to staleness in the pass that wrote this file,
 * after restoring both `medicham2-browser.js` and `game_differential.js` to their HEAD bytes and
 * reproducing it. That control was sound and it held the wrong variable still.
 *
 * MEASURED 2026-08-12, same frozen release `6155acc0fb26`, one flag apart:
 *   live team pool    control DIFFERENT-END-STATE, planted SAME-END-STATE  -> 2 FAILURES
 *   --team-store data/team-pool-frozen                                     -> ALL GREEN
 *
 * `engine/diff_swarm.js` reads the pool LIVE from a file OPS appends to, so `pairsFor` returns a
 * different first pair as the store grows and PART 3 plants its item into a different battle every
 * day. The plant itself is legitimately undoable — an item can be knocked off or eaten — so a fixture
 * that drifts will eventually land on a game that undoes it, and the failure then reads as a broken
 * comparator. It is the same hazard `--team-store` was built for after one instrument reported 1,556,
 * 1,213 and 983 games on three runs.
 *
 * A CALLER MAY STILL OVERRIDE IT. Passing `--team-store` on the command line wins, so this pins the
 * default rather than removing the knob. */
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const SHAPE = require(D('engine', 'divergence_shape.js'));

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

if (!G.END_STATE) fail('the driver did not read --end-state — nothing below measures anything');
else pass('the driver is in end-state mode');
if (!G.STATE_ON) fail('--end-state did not turn the BOARD comparison on; there is nothing to compare');
else pass('--end-state implies --state, so boards are read at every boundary');

/* ================= PART 1 — EVERY BRANCH OF THE VERDICT ========================================= */
console.log('\nPART 1 — the verdict function, every branch, on fabricated rows');
{
  const V = G.endStateVerdict;
  if (typeof V !== 'function') fail('the driver exports no endStateVerdict — the measurement does not exist');
  else {
    const cases = [
      ['a game that threw is its own answer, never an agreement',
       { err: 'p1 choice rejected', divTurn: 1, endedMedi: false, endedSd: false,
         finalBoard: { turn: 3, identical: true, diffs: [] } }, 'THREW'],
      ['both engines still playing at the cap, boards equal',
       { divTurn: 1, endedMedi: false, endedSd: false, finalBoard: { turn: 12, identical: true, diffs: [] } },
       'SAME-END-STATE'],
      ['both engines still playing at the cap, boards differ',
       { divTurn: 1, endedMedi: false, endedSd: false,
         finalBoard: { turn: 12, identical: false, diffs: [{ path: 'p1.active[0].hp' }] } },
       'DIFFERENT-END-STATE'],
      ['both engines ended the battle together, boards equal',
       { divTurn: 2, endedMedi: true, endedSd: true, finalBoard: { turn: 7, identical: true, diffs: [] } },
       'SAME-END-STATE'],
      ['ONLY medicham2 thinks the battle is over — this is not an agreement',
       { divTurn: 2, endedMedi: true, endedSd: false, finalBoard: { turn: 7, identical: true, diffs: [] } },
       'ENDED-APART'],
      ['ONLY showdown thinks the battle is over — this is not an agreement either',
       { divTurn: 2, endedMedi: false, endedSd: true, finalBoard: { turn: 7, identical: true, diffs: [] } },
       'ENDED-APART'],
      ['no board was ever compared — a third answer, never counted as agreement',
       { divTurn: 0, endedMedi: false, endedSd: false, finalBoard: null }, 'NO-COMPARABLE-BOARD'],
    ];
    for (const [what, row, want] of cases) {
      const got = V(row);
      if (got === want) pass(what + '  -> ' + got);
      else fail(what + '  -> got ' + got + ', want ' + want);
    }
    /* THE ONE THAT WOULD FLATTER THE NUMBER. `ENDED-APART` with identical boards is the case a
     * careless classifier folds into SAME-END-STATE, and it is the opposite of cosmetic: one engine
     * has stopped the battle and the other has not. Asserted separately so it cannot regress quietly. */
    const sneaky = V({ divTurn: 1, endedMedi: true, endedSd: false,
                       finalBoard: { turn: 4, identical: true, diffs: [] } });
    if (sneaky === 'SAME-END-STATE') fail('a game ONE engine ended was reported as the same end state');
    else pass('an identical board does not launder a battle only one engine ended');
  }
}

/* ================= PART 2 — THE STOP RULE ACTUALLY MOVED ======================================== */
console.log('\nPART 2 — a game whose protocol parts on turn 1 must keep playing');
const PAIRS = G.pairsFor('baseline');
if (!PAIRS.length) fail('no baseline pairs could be built — nothing below ran');
let usedPair = null, endRow = null;
for (const pr of PAIRS.slice(0, 12)) {
  const r = G.playGame(pr.a, pr.b, 'baseline', 'endstate/' + pr.tag.slice(0, 24));
  if (r.err) continue;
  if (r.div && r.divTurn != null && r.divTurn <= 1) { usedPair = pr; endRow = r; break; }
}
if (!endRow) {
  note('no pair in the first 12 parted at or before turn 1 without throwing — PART 2 could not be');
  note('staged, which is a claim about the FIXTURE and not about the stop rule.');
  fail('PART 2 COULD NOT BE STAGED — see the note above; it is not a pass');
} else {
  note(usedPair.tag);
  note('protocol parted at turn ' + endRow.divTurn + ', the game ran ' + endRow.turns + ' turn(s), '
       + endRow.boundaries + ' board(s) compared, end reason: ' + endRow.endReason);
  if (endRow.turns <= endRow.divTurn)
    fail('the game stopped at its protocol divergence — --end-state is --state wearing a new name');
  else pass('the game played on past the mismatched line (turn ' + endRow.divTurn + ' -> ' + endRow.turns + ')');
  if (!endRow.finalBoard) fail('no finalBoard was recorded, so there is no end state to compare');
  else pass('a final board was recorded at boundary ' + endRow.finalBoard.turn
            + ', identical=' + endRow.finalBoard.identical);
  if (typeof endRow.endedMedi !== 'boolean' || typeof endRow.endedSd !== 'boolean')
    fail('the two engines\' own "is the battle over" answers were not recorded — the third answer '
         + '(one side ended early) cannot be told from an agreement');
  else pass('both engines\' end-of-battle flags recorded (medi=' + endRow.endedMedi + ', sd=' + endRow.endedSd + ')');
}
/* ================= PART 3 — A PLANT THAT IS NEVER UNDONE, AGAINST A CLEAN CONTROL =============== */
console.log('\nPART 3 — a planted board difference must survive to the end, and the control must not have it');
if (!PAIRS.length) fail('no pairs — PART 3 did not run');
else {
  /* THE ITEM IS THE PLANT, deliberately: an HP plant can be erased by a faint and a boost by a Haze,
   * and a plant the game can legally undo would make a false GREEN look like a false RED. An item slot
   * that is emptied and never refilled stays different for the rest of the battle.
   *
   * ---- THE FIXTURE IS CONSTRUCTED NOW, NOT FOUND — 2026-08-18 ----------------------------------
   *
   * This took `usedPair || PAIRS[0]` — PART 2's pair, chosen for parting EARLY and for nothing else.
   * On 2026-08-18 it reported two failures that were both that fixture:
   *
   *     FAIL  caught but NOT LOCALISED to the item that was planted: p1.party.primarina.hp, ...
   *     FAIL  THE CONTROL ALREADY DIFFERS ON AN ITEM — this pair cannot prove the plant was caught
   *
   * The clauses were right to refuse. What the file could not do is act on its own advice ("Choose
   * another fixture"), because it never chose one. A COULD-NOT-STAGE VERDICT IS A CLAIM ABOUT THE
   * FIXTURE AND NEVER ABOUT THE MECHANIC, and the answer is to BUILD the fixture.
   *
   * TWO SCREENS, AND THE SECOND ONE IS THE INTERESTING ONE:
   *
   *   1. the CONTROL must not already part on an item leaf, or the catch below is the game and not
   *      the plant. (The clause that asserts this is unchanged; this only stops handing it a pair it
   *      is bound to refuse.)
   *
   *   2. THE PLANTED BODY MUST STILL BE COMPARABLE AT THE LAST BOUNDARY — AND THAT NOW MEANS SOMETHING
   *      WEAKER THAN "STILL ON THE FIELD", WHICH IS THE POINT.
   *
   *      THIS SCREEN USED TO SAY the planted body left the field and a BENCHED body's item is not a
   *      compared leaf, because partyMap held hp/maxhp/fainted only — and it rejected FOUR candidate
   *      pairs on that sentence. It was true when written and STOPPED BEING TRUE on 2026-08-18, when
   *      `partyMap` was widened to carry item, status, status_counter, types and boosts on a benched
   *      body: measured first by `tests/probe_bench_leaves.js` over 2,029 benched bodies, with each
   *      new leaf carrying its own plant in `STATE_PLANTS`. A screen that keeps discarding valid
   *      fixtures on a RETIRED blind spot is this repository's most expensive recurring failure (the
   *      fourteen stale handoffs, the ban list of four) arriving inside a green test.
   *
   *      WHAT STILL DISQUALIFIES A PAIR IS A CORPSE, NOT A BENCH. `board_state.js` deliberately HOLDS
   *      the post-faint leaves — the authority runs `clearVolatile` on a faint (`sim/battle.ts:2560`)
   *      and blanks the status when the body is replaced (`sim/battle-actions.ts:126`) while medicham2
   *      keeps all of it — so an item planted onto a body that then FAINTS is compared by nothing, and
   *      such a pair is rejected WITH THAT REASON PRINTED. A pair whose body is alive, on the field or
   *      on the bench, and whose diff is still missing is a REAL comparator failure and fails.
   *
   * NEITHER SCREEN CAN WEAKEN THE PROOF: both only discard pairs on which the assertions below could
   * not mean anything, and every rejection is named. If the whole window is rejected that is a loud
   * failure naming the window, not a pass. */
  const plantAt = 1;
  const SCAN = 24;
  const CANDIDATES = [usedPair].concat(PAIRS).filter(Boolean).slice(0, SCAN + 1);
  const rejected = [];
  let pr = null, clean = null, planted = null, applied = false, stillActiveAtEnd = null;

  for (const cand of CANDIDATES) {
    const tag = String(cand.tag || '').slice(0, 26);
    const c = G.playGame(cand.a, cand.b, 'baseline', 'endstate/control');
    if (c.err) { rejected.push(tag + ' — the CONTROL threw'); continue; }
    const cp = (c.finalBoard && c.finalBoard.diffs || []).map(d => d.path || '');
    const dirty = cp.filter(p => p.indexOf('.item') >= 0);
    if (dirty.length) { rejected.push(tag + ' — control already parts on ' + dirty.join(',')); continue; }

    /* `statePlant` is the one hook handed the LIVE medicham board at every boundary. It plants once
     * and then only READS, so "is the planted body still standing" is answered by the engine rather
     * than inferred from the report. */
    let body = null, appliedHere = false, lastSeenActive = false, lastSeenComparable = false;
    const p = G.playGame(cand.a, cand.b, 'baseline', 'endstate/planted', {
      statePlant: (S, b, turnIdx) => {
        if (turnIdx === plantAt && !appliedHere) {
          const m = (S.actA || []).find(x => x && !x.fainted && x.curHP > 0);
          if (!m) return;
          m.item = m.item ? '' : 'leftovers';
          body = m; appliedHere = true; lastSeenActive = true; lastSeenComparable = true;
          return;
        }
        if (appliedHere && body) {
          lastSeenActive = (S.actA || []).indexOf(body) >= 0 && !body.fainted;
          /* THE ITEM LEAF IS COMPARED ON THE FIELD AND ON A LIVING BENCH, AND HELD ON A CORPSE. Two
           * separate facts, tracked separately, because collapsing them is what let the old screen
           * discard four good fixtures. */
          lastSeenComparable = !body.fainted;
        }
      } });
    if (p.err) { rejected.push(tag + ' — the PLANTED game threw'); continue; }
    if (!appliedHere) { rejected.push(tag + ' — no living body on side A at boundary ' + plantAt); continue; }
    if (!lastSeenComparable) {
      rejected.push(tag + ' — the planted body FAINTED, and board_state.js HOLDS the post-faint '
                        + 'leaves (the authority clears them on a faint and medicham2 does not), so '
                        + 'its item is compared by nothing. A benched but LIVING body is now fine.');
      continue;
    }
    pr = cand; clean = c; planted = p; applied = true; stillActiveAtEnd = lastSeenActive;
    break;
  }

  if (rejected.length) {
    note('control screen rejected ' + rejected.length + ' pair(s):');
    for (const r of rejected.slice(0, 6)) note('    ' + r);
  }
  if (!applied) {
    fail('NO USABLE FIXTURE IN THE SCANNED WINDOW (' + CANDIDATES.length + ' pairs) — see the '
       + 'rejections above. A comparator that finds nothing has proved nothing, and this is a claim '
       + 'about the fixture window rather than about the comparator. It is not a pass.');
  } else {
    note('fixture ' + String(pr.tag || '').slice(0, 44));
    const cv = G.endStateVerdict(clean), pv = G.endStateVerdict(planted);
    note('control  ' + cv + '   (' + clean.turns + ' turns, ' + clean.boundaries + ' boards, '
         + clean.endReason + ')');
    note('planted  ' + pv + '   (' + planted.turns + ' turns, ' + planted.boundaries + ' boards, '
         + planted.endReason + ')   planted body still on the field at the last boundary: '
         + stillActiveAtEnd);
    const paths = (planted.finalBoard && planted.finalBoard.diffs || []).map(d => d.path || '');
    const cpaths = (clean.finalBoard && clean.finalBoard.diffs || []).map(d => d.path || '');
    if (pv !== 'DIFFERENT-END-STATE')
      fail('the planted item difference did not reach the end state — verdict ' + pv);
    else pass('the plant is caught AT THE END: ' + pv);
    if (!paths.some(p => p.indexOf('.item') >= 0))
      fail('caught but NOT LOCALISED to the item that was planted: ' + paths.slice(0, 6).join(', '));
    else pass('localised to the planted field (' + paths.filter(p => p.indexOf('.item') >= 0)[0] + ')');
    /* THE CONTROL, CLEARED EXPLICITLY. Without this the plant proves nothing: the same pair might have
     * parted on an item all by itself, and the "catch" would be the game. */
    if (cpaths.some(p => p.indexOf('.item') >= 0))
      fail('THE CONTROL ALREADY DIFFERS ON AN ITEM — this pair cannot prove the plant was caught. '
         + 'Choose another fixture: ' + cpaths.filter(p => p.indexOf('.item') >= 0).join(', '));
    else pass('the control game does not differ on any item leaf, so the catch is the plant');
  }
}

/* ================= PART 4 — ONE SHAPE FUNCTION, NOT TWO ========================================= */
console.log('\nPART 4 — the cross-tab reads the shape out of engine/divergence_shape.js');
{
  if (typeof G.shapeOfCause !== 'function') fail('the driver does not expose the shape it cross-tabs by');
  else {
    const probes = [
      ['|-damage|p1a: Ceruledge|50/100 <> |-damage|p2a: Ceruledge|50/100', 'ORDERING'],
      ['|-damage|p1a: Ceruledge|50/100 <> |-heal|p1a: Ceruledge|60/100', 'RULE'],
      ['|-damage|p1a: Ceruledge|50/100 <> |-damage|p1a: Ceruledge|60/100', 'FIELD'],
      ['not a protocol line at all', 'UNPARSED'],
    ];
    let ok = true;
    for (const [c, want] of probes) {
      const a = G.shapeOfCause(c).shape, b = SHAPE.shapeOf(c).shape;
      if (a !== b || a !== want) { ok = false; fail('shape disagreement on "' + c + '": driver ' + a + ', module ' + b + ', want ' + want); }
    }
    if (ok) pass('the driver and engine/divergence_shape.js return the same shape on every probe');
  }
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — the end-state instrument is not trustworthy'
                             : 'ALL GREEN — the end-state measurement measures what it says it does'));
process.exit(failures ? 1 : 0);
