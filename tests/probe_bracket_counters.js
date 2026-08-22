/* probe_bracket_counters.js — ROADMAP #311. IS THE BRACKET RE-DERIVATION ON THE PATH IN REAL PLAY?
 *
 *   node tests/probe_bracket_counters.js [games]
 *
 * `tests/probe_mega_priority.js` proves the mechanic is CORRECT on three staged boards. It cannot
 * prove it is REACHED, because a staged board is a board somebody built to reach it. This repository's
 * standing rule is that a capability which cannot prove it ran is assumed broken — the mega that only
 * fired from the left slot, the joint layer that fell back on 100% of turns, the sheet nobody read.
 *
 * So this plays ordinary self-play games through the LIVE engine, with the engine's own chooser
 * picking the clicks, and reads the counters `_resortTail` writes:
 *
 *   bracketRederived      brackets recomputed at a re-sort. ZERO means the fix is off the path.
 *   bracketRederiveMoved  ...of which the value actually CHANGED. This is the one that separates a
 *                         working fix from a no-op; a re-derivation that always agrees with the
 *                         turn-top freeze is indistinguishable from never re-deriving at all.
 *   bracketHeldFrozen     brackets left frozen because the re-sort trigger refused — the head of the
 *                         queue is a bare switch, which is where the AUTHORITY does not re-derive
 *                         either (ROADMAP #240). Counted so "we agreed by not firing" is visible.
 *
 * THE BAR IS `bracketRederived > 0`, AND THE FIRST DRAFT SET IT WRONG — worth recording, because the
 * mistake is the one this repository keeps paying for. It also asserted `bracketHeldFrozen > 0`, and
 * over 80 games that reads ZERO: so does #240's own `queueResortHeldNotAMove`, because the engine's
 * chooser never produced a turn with two bare switches at the head of the queue. That is a fact about
 * THIS CAST AND THIS CHOOSER, not about the branch, and asserting it turned a fixture property into a
 * red gate nobody could act on. A COULD-NOT-REACH verdict is a claim about the fixture.
 *
 * So the refusing path is PRINTED beside `queueResortHeldNotAMove` — the two must move together by
 * construction, which makes the pair a check on itself — with a zero stated to mean "no turn in this
 * run had a bare switch at the head of the queue", never "the branch is absent". `bracketRederiveMoved`
 * is printed and not asserted for the same reason: whether a bracket MOVES depends on whether these
 * games happened to contain a mid-turn ability change or a Gale Wings body taking a hit. The staged
 * probe is what asserts the movement, on boards built to contain it.
 *
 * THE ROSTER IS THE ENGINE'S OWN. Bodies come from `MEDI.buildMon` over species read out of the
 * engine's dataset — no sheet, no pool, no store — so this file is single-process, needs no release
 * and cannot tear an artifact another division is writing.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
/* THE DATASET, LOADED BEFORE THE ENGINE. `buildMon` resolves through `globalThis.MC.mons`; without
 * this line every body silently fails to build and the run reports a cast of zero — which is what the
 * first draft of this file did, and it is the reason the cast size is asserted below rather than
 * assumed. */
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));

const GAMES = Math.max(1, +(process.argv[2] || 60));

/* Species chosen for what they put on the field, not by taste: a Gale Wings body and the three legal
 * megas whose evolution changes a priority ability are exactly the bodies whose bracket can move
 * mid-turn, and the rest are ordinary. Every one is checked against the engine's own dataset before
 * use, so a name this build cannot make is skipped loudly instead of silently building nothing. */
const WANT = ['talonflame', 'banette', 'sableye', 'meowstic', 'whimsicott', 'incineroar',
              'garchomp', 'corviknight', 'milotic', 'clefable', 'snorlax', 'dragapult'];
const CAST = [];
for (const nm of WANT) { try { if (MEDI.buildMon(nm, {})) CAST.push(nm); } catch (e) { /* skip */ } }
if (CAST.length < 8) {
  console.log('NOT RUN — the engine could build only ' + CAST.length + ' of ' + WANT.length
    + ' cast members. This is a fixture failure, not a pass.');
  process.exit(2);
}
console.log('cast built: ' + CAST.length + ' of ' + WANT.length
  + (CAST.length === WANT.length ? '' : '   MISSING: ' + WANT.filter(x => !CAST.includes(x)).join(', ')));

const before = Object.assign({}, MEDI.MEDSEEN);
let played = 0, threw = 0, firstErr = '';
for (let g = 0; g < GAMES; g++) {
  const pick = (o) => { const t = []; for (let i = 0; i < 4; i++) t.push(CAST[(g * 5 + o * 3 + i * 7) % CAST.length]); return t; };
  try {
    const A = pick(0).map(n => MEDI.buildMon(n, {})).filter(Boolean);
    const B = pick(1).map(n => MEDI.buildMon(n, {})).filter(Boolean);
    if (A.length < 2 || B.length < 2) continue;
    /* A DETERMINISTIC STREAM PER GAME, so this reading is reproducible and a future change to it is
     * visible rather than attributable to luck. */
    let s = (g + 1) * 2654435761 % 2147483647;
    MEDI.battle(A, B, { rng: () => (s = (s * 48271) % 2147483647) / 2147483647 });
    played++;
  } catch (e) { threw++; if (!firstErr) firstErr = String(e.message).slice(0, 120); }
}

const S = MEDI.MEDSEEN;
const d = k => (S[k] || 0) - (before[k] || 0);
console.log('\ngames played ' + played + ' of ' + GAMES + (threw ? '   THREW ' + threw + ': ' + firstErr : ''));
console.log('  queueResorted            ' + d('queueResorted'));
console.log('  queueResortChangedOrder  ' + d('queueResortChangedOrder'));
console.log('  queueResortHeldNotAMove  ' + d('queueResortHeldNotAMove'));
console.log('  bracketRederived         ' + d('bracketRederived'));
console.log('  bracketRederiveMoved     ' + d('bracketRederiveMoved')
  + (S.bracketRederiveMovedFirst ? '     first: ' + S.bracketRederiveMovedFirst : ''));
console.log('  bracketHeldFrozen        ' + d('bracketHeldFrozen')
  + (d('bracketHeldFrozen') === 0
    ? '     (zero because queueResortHeldNotAMove is ' + d('queueResortHeldNotAMove')
      + ' — no turn in this run had a bare switch at the head of the queue. NOT "the branch is absent".)'
    : ''));
console.log('  megaEvolved              ' + d('megaEvolved'));

const bad = [];
if (played === 0) bad.push('no game played — this is a fixture failure and not a result');
if (d('bracketRederived') === 0) bad.push('bracketRederived is ZERO — the re-derivation is OFF THE PATH');
/* THE TWO REFUSAL COUNTERS ARE ONE EVENT SEEN TWICE, so they must agree. This is not the bar; it is
 * the check that the bar is being read off a live instrument. */
if ((d('bracketHeldFrozen') === 0) !== (d('queueResortHeldNotAMove') === 0)) {
  bad.push('bracketHeldFrozen and queueResortHeldNotAMove disagree about whether the trigger ever '
    + 'refused — they are written on the same branch and cannot');
}
console.log(bad.length ? '\nFAILED\n  ' + bad.join('\n  ') : '\nthe re-derivation is on the path');
process.exit(bad.length ? 1 : 0);
