/* probe_fail_and_silent.js — ROADMAP #241 PART (3). THE AUTHORITY ANNOUNCES A FAILURE AND THIS
 * ENGINE SAYS NOTHING.
 *
 *   SHOWDOWN_PATH=... node tests/probe_fail_and_silent.js
 *
 * ================= WHERE THESE FIXTURES CAME FROM, AND WHY THEY ARE NOT GUESSES =================
 *
 * The row is instrumented by `engine/gate_fail_and_silent.js`, which COUNTS the class in
 * `data/game-differential.json` and cannot say what is in it. Reading the causes out of that
 * artifact, every one is a BARE `|-fail|pXy: Body` with no move name — the authority attributes a
 * generic failure to the MOVER and blanks the move line with `[still]`, so the artifact records who
 * failed and never what they clicked.
 *
 * WHAT IS READABLE IS THE CAST, and it is not a random sample of the format:
 *
 *     Whimsicott x6   Ninetales x4   Raichu x3   Sableye x2
 *     Torkoal   Maushold   Delphox   Dragapult   Talonflame
 *
 * and eleven of the twenty-one sit immediately before `|upkeep|` or `|-weather|…|[upkeep]`. Torkoal
 * is Drought, Ninetales-Alola is Snow Warning, Whimsicott and Sableye are the format's Prankster
 * carriers — a cast of bodies that SET A FIELD, failing at the end of a turn. So the hypothesis is
 * a field-setting move clicked into the field it already made, and these arms are that hypothesis
 * asked one field at a time.
 *
 * ================= HOW IT IS JUDGED =============================================================
 *
 * NOTHING IS TYPED. Both engines play the identical script under the differential's own pin and the
 * two protocol streams are compared line for line; the pass is that they do not part. Every arm
 * carries its POSITIVE — the same click into a field that is NOT already up, which must succeed on
 * both engines — because an arm that only ever clicks into an occupied field is passed by an engine
 * that has broken the move outright.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }

const G = require(D('engine', 'game_differential.js'));
const NL = String.fromCharCode(10);
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...names) => names.map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }));

/* The partner and both foes click Protect throughout: nothing else may touch the field, so the only
 * thing that can part the two streams is the clicked field move itself. */
const FOES = stage([['garchomp', '', 'Rough Skin', ['Protect']],
                    ['corviknight', '', 'Pressure', ['Protect']]]).concat(BENCH('snorlax', 'toxapex'));
const P2 = { p2: [{ m: 'protect' }, { m: 'protect' }] };
const turn = (a, b) => Object.assign({ p1: [a, b || { m: 'protect' }] }, P2);

const CASES = [
  /* THE ABILITY PUTS THE FIELD UP BEFORE A SINGLE CLICK, so turn 1 is already the negative. The
   * POSITIVE is the same species with the weather ability off: the identical click into an empty
   * sky, which must SUCCEED on both engines. */
  { name: 'Sunny Day into the sun Drought already made',
    lead: ['torkoal', '', 'Drought', ['Sunny Day', 'Protect']],
    ctrl: ['torkoal', '', 'White Smoke', ['Sunny Day', 'Protect']],
    script: [turn({ m: 'sunnyday' }), turn({ m: 'protect' })] },

  { name: 'Snowscape into the snow Snow Warning already made',
    lead: ['ninetalesalola', '', 'Snow Warning', ['Snowscape', 'Protect']],
    ctrl: ['ninetalesalola', '', 'Snow Cloak', ['Snowscape', 'Protect']],
    script: [turn({ m: 'snowscape' }), turn({ m: 'protect' })] },

  /* NO ABILITY SETS A TAILWIND, so the negative has to be built out of two turns: the first click
   * succeeds and the second is the one under test. The control arm clicks it ONCE and then passes,
   * so the two arms differ in exactly the repeat. */
  { name: 'a second Tailwind while the first is still up',
    lead: ['whimsicott', '', 'Prankster', ['Tailwind', 'Protect']],
    ctrl: ['whimsicott', '', 'Prankster', ['Tailwind', 'Protect']],
    script: [turn({ m: 'tailwind' }), turn({ m: 'tailwind' }), turn({ m: 'protect' })],
    ctrlScript: [turn({ m: 'tailwind' }), turn({ m: 'protect' }), turn({ m: 'protect' })] },

  { name: 'a second Light Screen while the first is still up',
    lead: ['sableye', '', 'Prankster', ['Light Screen', 'Protect']],
    ctrl: ['sableye', '', 'Prankster', ['Light Screen', 'Protect']],
    script: [turn({ m: 'lightscreen' }), turn({ m: 'lightscreen' }), turn({ m: 'protect' })],
    ctrlScript: [turn({ m: 'lightscreen' }), turn({ m: 'protect' }), turn({ m: 'protect' })] },

  { name: 'a second Safeguard while the first is still up',
    lead: ['whimsicott', '', 'Prankster', ['Safeguard', 'Protect']],
    ctrl: ['whimsicott', '', 'Prankster', ['Safeguard', 'Protect']],
    script: [turn({ m: 'safeguard' }), turn({ m: 'safeguard' }), turn({ m: 'protect' })],
    ctrlScript: [turn({ m: 'safeguard' }), turn({ m: 'protect' }), turn({ m: 'protect' })] },

  { name: 'a second Substitute while the first is still standing',
    lead: ['snorlax', '', 'Thick Fat', ['Substitute', 'Protect']],
    ctrl: ['snorlax', '', 'Thick Fat', ['Substitute', 'Protect']],
    script: [turn({ m: 'substitute' }), turn({ m: 'substitute' }), turn({ m: 'protect' })],
    ctrlScript: [turn({ m: 'substitute' }), turn({ m: 'protect' }), turn({ m: 'protect' })] },
];

/* ---- THE STATE UNDER THE ANNOUNCEMENT, AND WHY THERE IS NO ARM FOR IT HERE ----------------------
 * Nine of the eleven silent failures in a 592-game differential are ENCORE, and Encore's
 * `condition.onStart` opens `let move = target.lastMove; if (!move) return false`
 * (data/mods/champions/moves.ts:291). So `lastMove` IS the gate, and the two engines were measured
 * disagreeing about it — 22 readings across 10 of 592 games, EVERY ONE the same direction: the
 * authority holds NONE and this engine holds a move (Baton Pass x4, Focus Blast x3, Electro Ball
 * x3, Rage Powder, Dire Claw, Thunderbolt, Solar Beam, Protect, Electro Shot, Parting Shot).
 *
 * THAT CORRECTS THE LEAD THE 2026-08-12 RETRACTION LEFT, which guessed the opposite direction —
 * *"`_lastMove` being null here where Showdown's `lastMove` is set"*. It is the other way, and the
 * consequence is that this engine APPLIES Encores the authority REFUSES. Announcing the refusal
 * first would have made this engine say `-fail` for a refusal it does not make, which is why that
 * retraction was right to pull the line even though its diagnosis was not.
 *
 * NO ARM IS STAGED FOR IT because the door has not been found. `switchOut` already clears
 * `_lastMove`; clearing it at `bringIn` as well — the door a pivot, a drag and a faint replacement
 * all use — was tried and moved the count by NOTHING on a 700-game run, so it was reverted rather
 * than shipped unmeasured. The live instrument is `lastMoveRows`, printed by every
 * `engine/game_differential.js` run; whoever takes this next starts from that number.
 */

let bad = 0, ran = 0;
const play = (leadRow, script, tag) => {
  const A = stage([leadRow, ['clefable', '', 'Unaware', ['Protect']]]).concat(BENCH('milotic', 'incineroar'));
  const a = G.buildPair(A), b = G.buildPair(FOES);
  if (!a || !b) return { staged: false, tag };
  const r = G.playGame(a, b, 'directed', 'probe_fail_and_silent :: ' + tag, { script });
  return { staged: true, tag, r, want: script.length };
};

for (const c of CASES) {
  const neg = play(c.lead, c.script, c.name + ' [negative]');
  const pos = play(c.ctrl, c.ctrlScript || c.script, c.name + ' [positive control]');
  if (!neg.staged || !pos.staged) { console.log('NOT-STAGED  ' + c.name); bad++; continue; }
  if (neg.r.err || pos.r.err) {
    console.log('THREW       ' + c.name + '  ' + (neg.r.err || pos.r.err)); bad++; continue;
  }
  ran++;
  /* SHORT IS NOT A PASS. A scripted game that stopped early stopped testing, and in protocol mode
   * it stops AT the divergence — so a short run with no `div` would be the silent-zero shape. */
  const short = (x) => x.r.turns < x.want && !x.r.div;
  const parts = [neg, pos].filter(x => x.r.div);
  const shorts = [neg, pos].filter(short);
  if (parts.length || shorts.length) bad++;
  console.log(NL + (parts.length ? 'STREAMS PART ' : shorts.length ? 'SHORT        ' : 'AGREES       ')
    + '   ' + c.name);
  for (const x of [neg, pos]) {
    const d = x.r.div;
    console.log('   ' + (x.tag.indexOf('[negative]') >= 0 ? 'negative' : 'positive') + '  '
      + x.r.turns + '/' + x.want + ' turns  ' + (d ? 'PARTED at line ' + d.index : 'agreed'));
    if (d) {
      console.log('        showdown  ' + d.sdRaw);
      console.log('        medicham  ' + d.meRaw);
    }
  }
}
console.log(NL + ran + ' staged, ' + bad + ' parted (or not staged)');
process.exit(bad ? 1 : 0);
