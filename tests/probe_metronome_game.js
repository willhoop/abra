/* WIRE 158 — THE METRONOME LADDER IN A PLAYED GAME, AGAINST THE AUTHORITY, SIX TURNS DEEP.
 *
 *   SHOWDOWN_PATH=... node tests/probe_metronome_game.js
 *   SHOWDOWN_PATH=... node tests/probe_metronome_game.js --broken     (the red demonstration)
 *
 * `tests/probe_metronome_ladder.js` proves the CONSUMER by setting `_metroN` by hand. That is half
 * the mechanic and the easy half: it says nothing about whether the turn loop ever advances the
 * counter on its own, which is the part `data/roster.items.json` was actually failing on. This file
 * plays a real six-turn game in both engines and compares the boards leaf for leaf.
 *
 * IT RUNS THE LIVE TREE'S BYTES OVER THE FROZEN RELEASE, WHICH IS WHY IT DOES NOT NEED A NEW RELEASE
 * CUT. `SB.harness(src)` compiles the source it is handed under the SNAPSHOT'S OWN FILENAME — the
 * mechanism the mutation arms already use — so passing the working copy of `medicham2-browser.js`
 * measures the edit that is on disk right now, against a release nobody has to move. The red arm
 * passes the SAME bytes with the knob armed, so the two arms differ in exactly one environment
 * variable and nothing else.
 *
 * WHY SIX TURNS AND NOT TWO. The existing roster fixture reaches rung 1 and parts by 3 HP. A ladder
 * that is right at rung 1 and wrong at rung 4 would pass that fixture and every gate that reads it.
 * Six consecutive clicks of one move walk rungs 0,1,2,3,4,5 and land on the cap, so the whole
 * declared table is exercised inside one comparison against Showdown.
 *
 * THE FIXTURE IS CHOSEN SO THAT ONLY THE LADDER MOVES.
 *   - Aerial Ace is `accuracy: true`, has no secondary and is not multi-hit, so no die is consulted
 *     for it in either engine and the arm's pin cannot decide the answer.
 *   - Aggron is Steel/Rock, x0.25 into Flying, with 180 base Defence — it survives all six hits, so
 *     the ladder is never truncated by a faint. A fixture whose target dies at rung 3 would report
 *     agreement about rungs 4 and 5 that nobody measured.
 *   - The target clicks METAL SOUND, which lowers Special Defence. The move under test is PHYSICAL,
 *     so the target's click cannot move the number being compared — and it is not a Protect, which
 *     would break the consecutive-use chain and is the one click this fixture must not make.
 *   - Corviknight's slot-0 ability is Pressure, not Mirror Armor, so nothing is reflected back.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
/* THE KNOB IS ARMED BEFORE ANY ENGINE MODULE IS LOADED. `NO_METRONOME_LADDER` is a module-level
 * `const` read once at compile time, so setting the variable after the require would arm a copy
 * nobody runs — a red arm that silently played the green engine and reported agreement. */
const BROKEN = process.argv.includes('--broken');
if (BROKEN) process.env.MEDI_NO_METRONOME_LADDER = '1';
const SB = require(D('tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

const LIVE = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));
const TURNS = 6;
const script = [];
for (let i = 0; i < TURNS; i++)
  script.push({ p1: [{ m: 'aerialace', t: 0 }, { m: 'protect' }],
                p2: [{ m: 'metalsound', t: 0 }, { m: 'protect' }] });

const SC = {
  id: 'metronome-ladder-six-turns',
  kind: 'item', shape: 'damage',
  what: 'Corviknight holds Metronome and clicks Aerial Ace at Aggron on six consecutive turns, so the '
      + 'consecutive-use counter walks rungs 0,1,2,3,4,5 and then sits on the cap.',
  negative: 'turn 1 IS the negative and it is inside the same game: rung 0 is the identity step '
          + '4096/4096, so the first hit must be byte-identical to a Corviknight holding nothing. An '
          + 'engine that boosted from the first use parts at boundary 1 rather than at boundary 2.',
  A: [mon('corviknight', 'metronome', 'Pressure', ['Aerial Ace', 'Protect']),
      mon('aggron', '', 'Sturdy', ['Protect'])].concat(FILL('milotic', 'garchomp')),
  B: [mon('aggron', '', 'Sturdy', ['Metal Sound', 'Protect']),
      mon('corviknight', '', 'Pressure', ['Protect'])].concat(FILL('snorlax', 'weavile')),
  script,
};

console.log('\n  WIRE 158 — the Metronome ladder, played against the authority'
  + (BROKEN ? '   [--broken: MEDI_NO_METRONOME_LADDER=1]' : ''));
console.log('  ' + SC.what + '\n');

const r = SB.runOne(SC, LIVE);
console.log('  verdict from the staged-board driver: ' + r.verdict + (r.why ? '\n          ' + r.why : ''));
const boards = r.boards || [];
for (const b of boards) {
  const d = (b.diffs || []).filter(x => x);
  console.log('    boundary ' + b.turn + '   ' + b.compared + ' leaves compared   '
    + (d.length ? d.length + ' DIFF(S): '
                  + d.slice(0, 4).map(x => (x.body || '?') + ' ' + x.field + '  showdown ' + x.sd
                                          + ' / ours ' + x.us).join(';  ')
                : 'identical'));
}

const MEDI = require(D('engine', 'medicham2-browser.js'));
console.log('\n  counters from THIS process\'s live module (the driver runs its own copy, so these are '
  + 'a sanity read and not the verdict):');

const allDiffs = boards.reduce((n, b) => n + (b.diffs || []).filter(x => x).length, 0);

if (BROKEN) {
  ok(allDiffs > 0,
     'THE RED DEMONSTRATION FIRES — with the ladder switched off the boards PART from the authority',
     allDiffs + ' diff(s) across ' + boards.length + ' boundaries. A zero here would mean the fixture '
     + 'never staged the mechanic, not that the engine is right.');
} else {
  ok(r.verdict !== 'THREW' && r.verdict !== 'NOT-STAGED' && r.verdict !== 'SHORT',
     'the game actually ran all ' + TURNS + ' turns', 'verdict ' + r.verdict
     + '   boundaries ' + boards.length + ' (expected ' + (TURNS + 1) + ')');
  ok(boards.length === TURNS + 1,
     'every boundary was taken — a game that ends early cannot disagree',
     boards.length + ' of ' + (TURNS + 1));
  ok(boards.every(b => b.compared > 0),
     'every boundary compared real leaves — a zero-leaf boundary agrees vacuously',
     boards.map(b => b.compared).join(', '));
  ok(allDiffs === 0,
     'THE BOARDS AGREE WITH SHOWDOWN AT EVERY RUNG OF THE LADDER',
     allDiffs + ' diff(s)');
}

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
