/* test-bracket-regain.js — CAN A PRIORITY BRACKET COME BACK MID-TURN, OR ONLY GO AWAY?
 *
 *   SHOWDOWN_PATH=... node tests/test-bracket-regain.js
 *
 * WHY THIS FILE EXISTS AT ALL, given that ROADMAP #311 already landed the re-derivation.
 * -------------------------------------------------------------------------------------
 * Will, 2026-08-21: *"can Talonflame REGAIN Gale Wings mid-turn if it heals back to full HP — and
 * does our engine do the regain direction, not just the loss?"*
 *
 * Everything already in the tree answers the LOSS direction and nothing answers the GAIN:
 *
 *   tests/test-mechanics.js:10970   Gale Wings at full HP vs Gale Wings at 60% — a TURN-TOP reading.
 *   tests/test-mechanics.js:547     Gale Wings on a Flying STATUS move — also turn-top.
 *   tests/probe_bracket_counters.js `bracketRederiveMoved` over self-play, which has observed
 *                                   `talonflame 1->0` (chipped, bracket lost) and `banette-mega 0->1`
 *                                   (a forme change), and has NEVER observed a Talonflame 0->1.
 *
 * The engine's own code is stateless in both directions and the authority's is too, so the gain
 * "obviously" works. THAT IS AN ARGUMENT, NOT A RECEIPT. CLAUDE.md: a capability that cannot prove it
 * ran is assumed broken — the mega that only fired from the left slot and the joint layer that fell
 * back on 100% of turns both looked obviously fine in source.
 *
 * THE AUTHORITY, READ RATHER THAN RECALLED
 * ----------------------------------------
 * `data/mods/champions/abilities.ts` contains NO `galewings` entry (grepped, whole file — the
 * standing rule is to read the entire mod block before concluding it overrode nothing), so Champions
 * inherits mainline `data/abilities.ts`:
 *
 *     onModifyPriority(priority, pokemon, target, move) {
 *       if (move?.type === 'Flying' && pokemon.hp === pokemon.maxhp) return priority + 1;
 *     }
 *
 * A live `hp === maxhp` test on every firing of the event, with no latch anywhere. And
 * `sim/battle.ts:2919-2920` re-runs ModifyPriority over EVERY queued action before each post-action
 * `queue.sort()`. So the authority's answer is structurally yes. This file does not take that on
 * faith either: Showdown plays the same script and ITS OWN `|move|` ORDER is the expectation.
 *
 * THE BOARD, AND THE ORDERING TRAP THAT MAKES IT A TEST INSTEAD OF A FORMALITY
 * ---------------------------------------------------------------------------
 * The heal must land BEFORE the re-sort that re-derives the Flying move's bracket. A fixture whose
 * heal resolves after the last re-sort that could matter makes BOTH engines agree by producing no
 * regain at all — green, and asking nothing (docs/LESSONS.md). So the heal is action 0 of the turn
 * and the Flying move is in the tail that `_resortTail` re-sorts behind it, and the receipt for that
 * is asserted below (`healBeforeMove`) rather than inferred from the fact that the order changed.
 *
 *   p1a  Roserade    Choice Scarf, Natural Cure   speed 213     clicks the HEAL
 *   p2a  Jolteon     Volt Absorb                  speed 182     clicks Eerie Impulse at Roserade
 *   p1b  TALONFLAME  Life Orb, Gale Wings         speed 168     clicks the FLYING move
 *   p2b  Snorlax     Immunity                     speed  72     clicks Charm at Roserade
 *
 * TALONFLAME IS SLOWER THAN JOLTEON AND FASTER THAN NOTHING THAT MATTERS. That is the whole design:
 * on turn 2 Talonflame can only move ahead of Jolteon on the BRACKET, never on Speed, and Roserade
 * is the only body above both so the heal is always action 0. The speeds are not typed — the driver's
 * `speedCensus` prints each engine's reading and this file FAILS on any disagreement, so if the
 * paragraph above is wrong it shows up as a printed desync rather than as a green.
 *
 * TURN 1 SETS THE CHIP AND IS EXACT. Talonflame clicks FACADE (Normal, so Gale Wings cannot apply and
 * the body stays in bracket 0 behind Roserade) and pays the Life Orb toll: `floor(maxhp/10)`, 153 ->
 * 138. Turn 2's Life Dew restores `floor(maxhp/4)` = 38, capped by `heal()` — so Talonflame lands on
 * EXACTLY 153/153 by arithmetic rather than by a damage roll. Nothing in this fixture depends on a
 * die: no move here rolls below 100 accuracy, nobody has a contact-reactive ability, and the only two
 * HP movements are the fixed Orb toll and the fixed heal.
 *
 * WHY THIS CAST, DERIVED FROM `Dex.forFormat('gen9championsvgc2026regmb')` AND NOT CHOSEN
 * ---------------------------------------------------------------------------------------
 *   TALONFLAME is the ONLY legal carrier of Gale Wings in Reg M-B — a filtered walk of
 *     `D.species.all()` over `abilities` returns exactly one row. There is no second body to try.
 *   THE HEAL had to be ALLY-REACHING and legal: a filtered walk of `D.moves.all()` for `flags.heal`
 *     leaves exactly TWO that can reach a partner — Heal Pulse (`target: 'any'`) and LIFE DEW
 *     (`target: 'allies'`, `heal: [1,4]`). Life Dew is used because `target: 'allies'` needs no aim,
 *     which game_differential.js:2460 records as the difference between a FIRED row and a
 *     DID-NOT-FIRE row for exactly this pair of moves.
 *   THE HEALER had to LEARN it AND outrun Talonflame. Walking every legal species' learnset for
 *     `lifedew` gives 12 rows, the fastest of which is ROSERADE at base 90 — below Talonflame's 126.
 *     No Prankster body learns either heal, so the bracket cannot be borrowed. Choice Scarf (legal
 *     here; Specs/Band are not) closes it: 142 x 1.5 = 213 > 168. Roserade is Choice-locked into one
 *     move for both turns, which is why each arm clicks the SAME move twice.
 *   THE FOES are inert on purpose. Jolteon/Volt Absorb and Snorlax/Immunity react to nothing on this
 *     board, and Eerie Impulse and Charm are priority 0, accuracy 100, and touch neither Speed nor HP.
 *
 *   AND THE FIRST DRAFT'S SECOND FOE WAS FURFROU, WHICH IS WHY THE ABILITY LINE ABOVE IS EXPLICIT.
 *   Furfrou/Fur Coat produced `p2.party.furfrou.hp medicham 90 showdown 120` — medicham2 dealing
 *   exactly double, because `data/abra-tags.js` gives `furcoat` only `breakable` and no defence
 *   multiplier. That divergence appeared in ALL THREE arms including the control, so it could not
 *   have flipped this verdict; it is a REAL and SEPARATE engine defect, it is filed rather than fixed
 *   here, and the cast was changed so that `stateDiv === null` can be asserted instead of excused.
 *
 * THE KNOB, TWICE, BECAUSE ONE ARM PROVES NOTHING
 * -----------------------------------------------
 * Three arms on ONE board with ONE bit changed each:
 *
 *   A  Gale Wings + Life Dew   the regain           expect Talonflame SECOND on turn 2
 *   B  Gale Wings + Charm      the HEAL removed     expect Talonflame THIRD  (behind Jolteon)
 *   C  Flame Body + Life Dew   the ABILITY removed  expect Talonflame THIRD  (behind Jolteon)
 *
 * A must differ from BOTH. `A === B` means the heal is not reaching the bracket; `A === C` means the
 * reorder is something other than Gale Wings and the arm is measuring itself. Identical results
 * across a varied knob mean the knob is UNWIRED, never that it does not matter (CLAUDE.md).
 *
 * WHAT IS ASSERTED, IN ORDER OF WHAT A FAILURE WOULD MEAN
 * ------------------------------------------------------
 *   fixture   both turns played, no scripted click fell off the request, speeds agree — a fixture
 *             failure is a claim about the FIXTURE and is reported as one, never as a pass.
 *   state     `stateDiv === null` in every arm. MEDICHAM's bar is STATE, not protocol.
 *   authority Showdown's own turn-2 order in arm A puts Talonflame second.
 *   agreement medicham2's order equals Showdown's, turn by turn, in every arm.
 *   knob      arm A's turn-2 order differs from arm B's and from arm C's.
 *   receipt   the heal line precedes Talonflame's move line, and lands it on EXACTLY maxhp.
 *   counter   `MEDSEEN.bracketRederiveMoved` records EXACTLY ONE `talonflame 0->1` in arm A and stays
 *             0 in B/C. This is the one `probe_bracket_counters.js` prints and cannot assert, because
 *             whether a bracket moves in self-play depends on what the chooser happened to click.
 *
 * SHOWN RED BEFORE IT WAS TRUSTED, AND THE BREAK TAUGHT SOMETHING
 * ---------------------------------------------------------------
 * Deleting `_it._pri=_now;` from `_resortTail` — the single line that IS ROADMAP #311's fix — turned
 * this file red with:
 *
 *     A T2: ORDERS DIFFER — showdown [Roserade -> Talonflame -> Jolteon -> Snorlax]
 *                           medicham [Roserade -> Jolteon -> Talonflame -> Snorlax]
 *
 * AND THE COUNTER WENT UP RATHER THAN DOWN: `bracketRederiveMoved` read 2 instead of 1, because the
 * increment sits BEFORE the write, so it counts a bracket being NOTICED and not a bracket being
 * APPLIED — with the write gone, the same change is re-noticed at every later re-sort. A counter
 * assertion of `>= 1` would have stayed GREEN on a completely broken engine. That is why the count is
 * asserted EXACTLY, and it is the reason the order comparison against the authority is the primary
 * clause and the counter is the corroborating one, never the other way round. The engine was restored
 * byte-identical afterwards.
 *
 * THE ENGINE UNDER TEST IS THE LIVE TREE, frozen into a THROWAWAY store under the OS temp dir by
 * `tests/_live_release.js`. `data/releases/` and `data/engine-release.json` are NOT touched, which is
 * what lets this run on every engine edit without repointing a release another division is measuring
 * against. `engine/game_differential.js` is required as a LIBRARY here; nothing in this file plays a
 * corpus or writes an artifact.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* THE DRIVER STOPS AT THE FIRST DIVERGENT LINE UNLESS TOLD OTHERWISE, and the whole diagnosis here is
 * turn 2. Set in the file rather than left to the command line so it cannot be invoked in the state
 * that reports a fixture failure instead of a result. (Same reason as probe_mega_priority.js.) */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
/* THE SAME MODULE OBJECT THE DRIVER IS PLAYING, not a second load of the same bytes — node's require
 * cache is what makes `MEDSEEN` here the counters the game actually wrote. No `need` list: adding one
 * would strand every release cut before today for every caller of this file, for nothing. */
const MEDI = G.REL.require('engine/medicham2-browser.js');

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

const sideA = ability => stage([
  ['roserade',  'Choice Scarf', 'Natural Cure', ['Life Dew', 'Charm']],
  ['talonflame', 'Life Orb',    ability,        ['Aerial Ace', 'Facade']],
]).concat(BENCH('milotic', 'clefable'));
const sideB = () => stage([
  ['jolteon', '', 'Volt Absorb', ['Eerie Impulse']],
  ['snorlax', '', 'Immunity',    ['Charm']],
]).concat(BENCH('milotic', 'garchomp'));

/* TURN 1 chips by exactly one Life Orb toll (Facade is Normal, so the bracket cannot move on it).
 * TURN 2 is the measurement. The healer clicks the SAME move both turns because it is Choice-locked. */
const script = healerMove => ([
  { p1: [{ m: healerMove, t: 0 }, { m: 'facade',    t: 1 }],
    p2: [{ m: 'eerieimpulse', t: 0 }, { m: 'charm', t: 0 }] },
  { p1: [{ m: healerMove, t: 0 }, { m: 'aerialace', t: 1 }],
    p2: [{ m: 'eerieimpulse', t: 0 }, { m: 'charm', t: 0 }] },
]);

/* Split on the `|turn|` marker rather than by a slice count: a slice silently mis-attributes the
 * moment anything adds or drops a line. */
const ACT = /^\|(move|switch)\|/;
const byTurn = arr => {
  const out = [[]];
  for (const raw of arr.map(String)) {
    if (/^\|turn\|/.test(raw)) { out.push([]); continue; }
    if (ACT.test(raw)) out[out.length - 1].push(raw.split('|')[2].replace(/\s+/g, ' ').trim());
  }
  return out.slice(1);
};
/* The RAW turn-2 block, kept whole, because the heal receipt is about the ORDER OF LINES and the
 * reduction above throws away everything that is not a move. */
const rawTurn = (arr, n) => {
  const out = []; let t = 0;
  for (const raw of arr.map(String)) {
    if (/^\|turn\|/.test(raw)) { t++; continue; }
    if (t === n) out.push(raw);
  }
  return out;
};
const shortOf = row => row.replace(/^p[12][ab]: /, '');

const ARMS = [
  { id: 'A', name: 'A — Gale Wings + Life Dew  (the regain)',            ability: 'Gale Wings', heal: 'lifedew',
    expectSecond: true,  expectMoved: 1 },
  { id: 'B', name: 'B — Gale Wings + Charm     (knob: the HEAL removed)', ability: 'Gale Wings', heal: 'charm',
    expectSecond: false, expectMoved: 0 },
  { id: 'C', name: 'C — Flame Body + Life Dew  (knob: the ABILITY removed)', ability: 'Flame Body', heal: 'lifedew',
    expectSecond: false, expectMoved: 0 },
];

const bad = [];
const t2 = {};
console.log('\n  ENGINE UNDER TEST: THE LIVE TREE, frozen into a throwaway store (data/releases untouched)'
  + '\n  release id ' + G.REL.id + '\n');

for (const arm of ARMS) {
  console.log('================================================================');
  console.log(arm.name);
  const a = G.buildPair(sideA(arm.ability)), b = G.buildPair(sideB());
  if (!a || !b) { console.log('  FIXTURE FAILED — buildPair refused a sheet'); bad.push(arm.id + ': buildPair refused'); continue; }

  G.resetScriptCounters();
  MEDI.MEDSEEN.bracketRederiveMovedFirst = '';
  const before = Object.assign({}, MEDI.MEDSEEN);
  const r = G.playGame(a, b, 'directed', 'test-bracket-regain :: ' + arm.name,
    { script: script(arm.heal), speedCensus: true });
  const d = k => (MEDI.MEDSEEN[k] || 0) - (before[k] || 0);
  if (r.err) { console.log('  FIXTURE FAILED — THREW ' + r.err); bad.push(arm.id + ': threw ' + r.err); continue; }

  /* ---- THE FIXTURE MUST PROVE IT RAN BEFORE ANY OF ITS NUMBERS MEAN ANYTHING ------------------ */
  const sc = G.scriptCounters();
  if (sc.moveNotOnRequest) {
    console.log('  FIXTURE FAILED — ' + sc.moveNotOnRequest + ' scripted click(s) were not on the request: '
      + sc.firstMissing + '  (a click that falls off the request becomes a PASS on both engines, so the'
      + ' boards agree while nothing is tested)');
    bad.push(arm.id + ': script did not run'); continue;
  }
  if (r.turns < 2) { console.log('  FIXTURE FAILED — both turns did not play (' + r.turns + ')'); bad.push(arm.id + ': turns ' + r.turns); continue; }
  if (r.speedDesync || (r.speedRows || []).length) {
    console.log('  FIXTURE FAILED — the two engines disagree about the SPEEDS they sorted on, so a'
      + ' bracket finding here would be a Speed finding wearing its clothes: ' + JSON.stringify((r.speedRows || []).slice(0, 4)));
    bad.push(arm.id + ': speed desync'); continue;
  }
  const spd = (r.speedCensus || []).filter(x => x.when === 0)
    .map(x => x.body + ' ' + x.showdown).join('   ');
  console.log('  speeds as both engines read them:  ' + spd);

  /* ---- STATE. MEDICHAM'S BAR IS THE BOARD, NOT THE COMMENTARY --------------------------------- */
  if (r.stateDiv) {
    console.log('  BOARDS DIVERGED — ' + JSON.stringify(r.stateDiv).slice(0, 300));
    bad.push(arm.id + ': stateDiv ' + JSON.stringify(r.stateDiv).slice(0, 160));
  }

  const sd = byTurn(G.sdStream(G.lastSdLog())), me = byTurn(r.mediTrace);
  for (let t = 0; t < 2; t++) {
    console.log('   T' + (t + 1) + '  SHOWDOWN  ' + (sd[t] || []).map(shortOf).join(' -> '));
    console.log('       MEDICHAM  ' + (me[t] || []).map(shortOf).join(' -> '));
  }

  /* ---- THE TWO ENGINES MUST NAME THE SAME ORDER, TURN BY TURN --------------------------------- */
  for (let t = 0; t < 2; t++) {
    const x = (sd[t] || []).map(shortOf), y = (me[t] || []).map(shortOf);
    if (x.length !== y.length || x.some((v, i) => v !== y[i])) {
      bad.push(arm.id + ' T' + (t + 1) + ': ORDERS DIFFER — showdown [' + x.join(' -> ') + '] medicham [' + y.join(' -> ') + ']');
    }
  }
  t2[arm.id] = { sd: (sd[1] || []).map(shortOf), me: (me[1] || []).map(shortOf) };

  /* ---- WHERE TALONFLAME LANDED ON TURN 2, ASKED OF THE AUTHORITY FIRST ------------------------ */
  const idxSd = (sd[1] || []).map(shortOf).indexOf('Talonflame');
  const idxJo = (sd[1] || []).map(shortOf).indexOf('Jolteon');
  const secondSd = idxSd === 1 && idxJo > idxSd;
  console.log('  turn 2: Showdown puts Talonflame at index ' + idxSd + ' and Jolteon at ' + idxJo
    + '   ->  ' + (secondSd ? 'AHEAD of a faster body: the +1 bracket is back' : 'behind Jolteon: no regain'));
  if (secondSd !== arm.expectSecond) {
    bad.push(arm.id + ': THE AUTHORITY DISAGREES WITH THIS FILE\'S EXPECTATION — Talonflame at index '
      + idxSd + ', Jolteon at ' + idxJo + '. Either the fixture stopped staging what it says it stages,'
      + ' or Showdown does not do what the header claims. Read the stream above before touching the engine.');
  }

  /* ---- THE HEAL RECEIPT: it landed BEFORE the move, and it landed on EXACTLY full ------------- */
  if (arm.heal === 'lifedew') {
    const raw = rawTurn(G.sdStream(G.lastSdLog()), 2);
    const healAt = raw.findIndex(l => /^\|-heal\|p1b: Talonflame\|/.test(l));
    const moveAt = raw.findIndex(l => /^\|move\|p1b: Talonflame\|/.test(l));
    const hp = healAt >= 0 ? String(raw[healAt]).split('|')[3] : '';
    const m = /^(\d+)\/(\d+)$/.exec(hp || '');
    const exact = !!m && m[1] === m[2];
    console.log('  heal receipt: `' + (healAt >= 0 ? raw[healAt] : 'NO HEAL LINE') + '`'
      + '   heal at line ' + healAt + ', Talonflame\'s move at line ' + moveAt);
    if (healAt < 0) bad.push(arm.id + ': no heal ever landed on Talonflame — the fixture healed nothing');
    else if (!exact) bad.push(arm.id + ': the heal did not land on EXACTLY full HP (' + hp + '), so this'
      + ' board no longer tests `hp === maxhp`');
    else if (!(moveAt > healAt)) bad.push(arm.id + ': THE ORDERING TRAP — the heal resolved at or after'
      + ' Talonflame\'s move (' + healAt + ' vs ' + moveAt + '), so no re-sort could have seen it and both'
      + ' engines would agree by producing no regain at all');
  }

  /* ---- THE COUNTER, WHICH IS THE HALF SELF-PLAY CANNOT ASSERT --------------------------------- */
  const moved = d('bracketRederiveMoved'), first = MEDI.MEDSEEN.bracketRederiveMovedFirst;
  console.log('  bracketRederived ' + d('bracketRederived') + '   bracketRederiveMoved ' + moved
    + (first ? '   first: ' + first : ''));
  if (d('bracketRederived') === 0) bad.push(arm.id + ': bracketRederived is ZERO — the re-derivation never ran');
  /* AN EXACT COUNT, NOT `>= 1`, AND THE DELIBERATE BREAK IS WHY. `bracketRederiveMoved` is
   * incremented BEFORE `_it._pri=_now`, so it counts a bracket being NOTICED, not a bracket being
   * APPLIED. Deleting the write leaves the counter reading 2 in this arm — the same change re-detected
   * at every later re-sort — while the order is wrong. A `>= 1` bar goes GREEN on that break. Turn 2
   * re-sorts three times here and a correctly applied change can only be new once. */
  if (arm.expectMoved && moved !== arm.expectMoved) {
    bad.push(arm.id + ': bracketRederiveMoved is ' + moved + ', expected exactly ' + arm.expectMoved
      + (moved > arm.expectMoved
        ? ' — a re-derivation that keeps re-NOTICING the same change is one that never WROTE it back'
        : ' — medicham2 never recorded a bracket changing, so whatever moved the order was not the'
          + ' re-derivation'));
  }
  if (arm.expectMoved && !/talonflame 0->1/i.test(first)) {
    bad.push(arm.id + ': the first bracket movement was "' + first + '", not `talonflame 0->1` — the'
      + ' GAIN direction is what this file is about and something else moved instead');
  }
  if (!arm.expectMoved && moved !== 0) {
    bad.push(arm.id + ': a bracket MOVED in a control arm (' + moved + ', first "' + first + '") — the'
      + ' control is not controlling');
  }
  console.log('');
}

/* ---- THE KNOB. A must differ from BOTH controls, or it is measuring itself --------------------- */
console.log('================================================================');
console.log('THE KNOB — turn 2, the same board, one bit changed:');
for (const k of ['A', 'B', 'C']) console.log('   ' + k + '  ' + (t2[k] ? t2[k].sd.join(' -> ') : 'NOT STAGED'));
const same = (x, y) => x && y && x.length === y.length && x.every((v, i) => v === y[i]);
if (t2.A && t2.B && same(t2.A.sd, t2.B.sd)) {
  bad.push('KNOB UNWIRED — arm A and arm B produce the SAME turn-2 order, so removing the HEAL changed'
    + ' nothing. Identical results across a varied knob mean the knob is unwired, not that it does not matter.');
}
if (t2.A && t2.C && same(t2.A.sd, t2.C.sd)) {
  bad.push('KNOB UNWIRED — arm A and arm C produce the SAME turn-2 order, so removing GALE WINGS changed'
    + ' nothing and the reorder in arm A is something else.');
}

if (bad.length) {
  console.log('\nFAILED\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('\n3 passed, 0 failed');
console.log('THE BRACKET COMES BACK. A Talonflame healed to exactly full HP mid-turn regains Gale Wings'
  + '\nin time for its own queued Flying move, on the authority AND in medicham2, and medicham2 records'
  + '\nthe gain as `talonflame 0->1`.');
process.exit(0);
