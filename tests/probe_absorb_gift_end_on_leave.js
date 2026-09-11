#!/usr/bin/env node
/* tests/probe_absorb_gift_end_on_leave.js — NARRATION BATCH R, CLUSTER 5
 * ==================================================================================================
 * A VOLATILE AN ABILITY GAVE ITSELF ENDS WHEN THE BODY LEAVES THE FIELD, AND IT SAYS SO.
 *
 * THE AUTHORITY, three lines, re-read this run in §0:
 *
 *   flashfire.onEnd(pokemon)          `pokemon.removeVolatile('flashfire')`        data/abilities.ts
 *   flashfire.condition.onEnd(target) `this.add('-end', target, 'ability: Flash Fire', '[silent]')`
 *   sim/battle-actions.ts             `this.battle.singleEvent('End', oldActive.getAbility(), ...)`
 *                                     at the comment "will definitely switch out at this point",
 *                                     ABOVE the replacement's `|switch|`
 *
 * So a Flash Fire body that has absorbed a Fire move writes `|-end|pXY|ability: Flash Fire|[silent]`
 * on the way out, above the incoming `|switch|`.
 *
 * AND ON THE FAINT ROAD IT WRITES NOTHING, WHICH IS THE OPPOSITE OF WHAT THIS FILE FIRST ASSUMED.
 * `faintMessages` DOES fire the corpse's ability End (sim/battle.ts, below `this.add('faint', ...)`),
 * so the argument for a second call site looked airtight. It is refused one level down:
 *
 *     removeVolatile(status) {
 *       if (!this.hp) return false;                                  sim/pokemon.ts:2040-2041
 *
 * the same shape as `cureStatus`'s own first line. The FAINT arm below was written expecting a line,
 * was RED on the AUTHORITY, and is kept as a NEGATIVE — it is now the arm that stops this fix being
 * applied to both roads because both roads "obviously" run the same event.
 *
 * WHAT THIS ENGINE DID. `abRewrite` already paid this line for the OTHER End moment (an ability
 * overwritten mid-battle, 2026-08-29) and said so in its own comment: *"the switch-out road already
 * empties `_vol` wholesale"*. It does — SILENTLY. Two NARRATION-ONLY causes on release
 * `0c5a4da9c512`:
 *
 *     |-end|p1a|flashfire <> |switch|p1a|garchomp,l50|H/H
 *     |-end|p2a|flashfire <> |switch|p2a|gengarmega,l50|H/H
 *
 * The FAINT road is not in the pinned pool at all, and it turns out there is nothing there to fix.
 *
 * THE ARMS
 *   SWITCH      the carrier absorbs a Fire move, then pivots. The `-end` must sit ABOVE the `|switch|`.
 *   FAINT       THE SECOND NEGATIVE. The carrier absorbs a Fire move and is then KILLED. The
 *               authority writes NOTHING, because `removeVolatile` refuses a body at 0 HP — so this
 *               engine must stay silent there too, under either setting of the knob.
 *   NEVER-FED   THE OVER-MATCH NEGATIVE. The same carrier pivots having absorbed NOTHING. No volatile
 *               exists, so no line is written by either engine under either setting of the knob. A fix
 *               that emitted on the ability rather than on the volatile would fail here.
 *
 * Each arm also asserts the `|-start|...|ability: Flash Fire|` that GRANTS the volatile appears in
 * both streams, so a run in which the absorb never happened cannot pass by writing nothing.
 *
 * RED-FIRST KNOB: `MEDI_NO_ABSORB_GIFT_END_ON_LEAVE=1` takes the line back off the switch road, i.e.
 * the engine exactly as it stood before batch R. Under it SWITCH goes RED, FAINT and NEVER-FED stay
 * green, and any run carrying it also carries `MEDFAILS.absorbGiftEndOnLeaveRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_absorb_gift_end_on_leave.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_NO_ABSORB_GIFT_END_ON_LEAVE === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_absorb_gift_end_on_leave.js — the absorbed gift ends when the body leaves');
console.log('  MEDI_NO_ABSORB_GIFT_END_ON_LEAVE=' + (KNOB ? '1  (PRE-FIX ENGINE: both leaving roads are silent)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY. CR stripped at the read — this checkout is CRLF and a carriage return is a
 *    JavaScript line terminator, so a multi-line anchor silently matches nothing.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const ABS = read('/data/abilities.ts');
const ACTIONS = read('/sim/battle-actions.ts');
const BATTLE = read('/sim/battle.ts');
const POKEMON = read('/sim/pokemon.ts');
const CH_AB = read('/data/mods/champions/abilities.ts');

console.log(NL + '0. THE AUTHORITY');
const FF = /\n\tflashfire: \{\n([\s\S]*?)\n\t\},\n/.exec(ABS);
ok(!!FF && /onEnd\(pokemon\) \{\s*\n\s*pokemon\.removeVolatile\('flashfire'\);/.test(FF[1]),
   'the ABILITY\u2019s `onEnd` removes the volatile it granted',
   FF ? (FF[1].match(/onEnd\(pokemon\)[\s\S]{0,90}/) || ['not found'])[0] : 'flashfire block not found');
ok(!!FF && /onEnd\(target\) \{\s*\n\s*this\.add\('-end', target, 'ability: Flash Fire', '\[silent\]'\);/.test(FF[1]),
   'the CONDITION\u2019s `onEnd` writes `|-end|TARGET|ability: Flash Fire|[silent]`',
   FF ? (FF[1].match(/onEnd\(target\) \{[\s\S]{0,120}/) || ['not found'])[0] : 'flashfire block not found');
ok(/this\.battle\.singleEvent\('End', oldActive\.getAbility\(\), oldActive\.abilityState, oldActive\);/.test(ACTIONS),
   'the SWITCH road fires the outgoing body\u2019s ability End (sim/battle-actions.ts)');
ok(/this\.add\('faint', pokemon\);[\s\S]{0,320}?this\.singleEvent\('End', pokemon\.getAbility\(\), pokemon\.abilityState, pokemon\);/.test(BATTLE),
   'the FAINT road fires the ability End too, BELOW `this.add(\'faint\', pokemon)` (sim/battle.ts) '
   + '\u2014 which is why the faint arm below looked like a second call site');
const RV = /\n\tremoveVolatile\(status: string \| Effect\) \{\n([\s\S]*?)\n\t\}/.exec(POKEMON);
ok(!!RV && /^\t\tif \(!this\.hp\) return false;/m.test(RV[1]),
   'and `removeVolatile` REFUSES a body at 0 HP on its first line, so the corpse\u2019s End writes '
   + 'nothing \u2014 the same shape as `cureStatus`. THE FAINT ROAD IS A NEGATIVE, NOT A SECOND FIX.',
   RV ? RV[1].split('\n').slice(0, 3).join('\n') : 'removeVolatile block not found');
ok(!/^\tflashfire:/m.test(CH_AB),
   'Champions does not override `flashfire`, so mainline IS its authority');

/* ==================================================================================================
 * 1. THE CAST — the tag's MEMBERSHIP printed before it is trusted
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega);
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const ENDERS = Object.keys(TAGS.abilities || {}).filter(k => {
  const p = TAGS.abilities[k].params && TAGS.abilities[k].params.typeImmunity;
  return p && p.gain && p.gain.volatileBoost && p.gain.volatileBoost.endsWithAbility;
});
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
console.log('     abilities whose absorbed gift `endsWithAbility` : ' + (ENDERS.join(', ') || '(none)'));
if (!ENDERS.length) { console.log('  NOT STAGED — the tag has no member.'); process.exit(1); }
const AB = ENDERS[0];
const GAIN = TAGS.abilities[AB].params.typeImmunity;
const FEED_TYPE = GAIN.type;
const CARRIERS = SPEC.filter(s => Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === AB));
console.log('     legal carriers of ' + D.abilities.get(AB).name + '                    : '
  + CARRIERS.map(s => s.name).join(', '));
if (!CARRIERS.length) { console.log('  NOT STAGED — no legal carrier.'); process.exit(1); }
const CARRIER = CARRIERS[0];
/* THE FEEDER: a body that can throw a move of the absorbed TYPE at it, and a KILLER for the faint
 * road that is NOT of that type (a Fire move into Flash Fire is absorbed, so it can never kill). */
const FEED_MOVES = D.moves.all().filter(m => legal(m) && m.type === FEED_TYPE && m.category !== 'Status'
  && m.target === 'normal' && (m.accuracy === true || m.accuracy >= 100) && !m.flags.charge && !m.flags.recharge);
const feeders = SPEC.map(s => {
  const L = (D.species.getLearnsetData(s.id) || {}).learnset || {};
  const mv = FEED_MOVES.filter(m => L[m.id]).sort((a, b) => a.basePower - b.basePower)[0];
  return mv ? { s, mv } : null;
}).filter(Boolean);
console.log('     bodies that can FEED it a ' + FEED_TYPE + ' move             : ' + feeders.length
  + '   e.g. ' + feeders.slice(0, 3).map(f => f.s.name + '/' + f.mv.name).join(', '));
if (!feeders.length) { console.log('  NOT STAGED — nothing can feed the ability.'); process.exit(1); }

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const bench = (...n) => n.map(s => mon(s, '', '', ['Protect']));
const AB_NAME = D.abilities.get(AB).name;
const isEnd = l => /^\|-end\|/.test(String(l)) && new RegExp(AB.replace(/[^a-z0-9]/g, ''), 'i')
  .test(String(l).toLowerCase().replace(/[^a-z0-9|:]/g, ''));
const isStart = l => /^\|-start\|/.test(String(l)) && /flash ?fire/i.test(String(l));

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_absorb_gift_end_on_leave :: ' + tag, { script,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).length });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* WHERE the line sits, not only that it exists: the switch road puts it ABOVE the incoming
   * `|switch|` and the faint road BELOW the `|faint|`, and a line in the wrong place is a divergence
   * the count would miss. */
  /* RELATIVE TO THE ANCHOR THAT BRACKETS IT, NEVER TO THE FIRST ONE IN THE GAME. The first draft
   * compared against `lines.findIndex(/^\|switch\|/)`, which is the LEAD switch on turn 0 -- so a
   * correctly-placed line reported 'below' and the assertion would have been red on a right answer. */
  const place = (lines, anchorRe) => {
    const i = lines.findIndex(isEnd);
    if (i < 0) return null;
    const after = lines.slice(i + 1).some(l => anchorRe.test(String(l)));
    const before = lines.slice(0, i).some(l => anchorRe.test(String(l)));
    return after ? 'above' : (before ? 'below' : null);
  };
  return { staged: true, boards, sd, me,
           sdEnd: sd.filter(isEnd), meEnd: me.filter(isEnd),
           sdStart: sd.filter(isStart), meStart: me.filter(isStart),
           sdPlace: place(sd, /^\|switch\|/) , mePlace: place(me, /^\|switch\|/),
           sdPlaceF: place(sd, /^\|faint\|/), mePlaceF: place(me, /^\|faint\|/),
           boardDiffs: boards.reduce((n, x) => n + x.diffs, 0),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const FEED = feeders.filter(f => f.s.name !== CARRIER.name)[0];
/* THE KILLER IS SEARCHED, NOT NAMED. The faint arm needs the carrier dead in ONE click on turn 2:
 * a multi-turn kill cannot be scripted, because the turn the body dies is the turn the script
 * starts asking a replacement for a move it does not have -- which surfaces as THREW and reads
 * like a broken mechanic. Candidates are high-attack legal bodies holding an always-hitting move
 * that is super-effective on the carrier; the first one the AUTHORITY actually KOs with is taken
 * and every earlier one is refused BY NAME. */
const mult = (t, types) => { let m = 1;
  for (const ty of types) { if (D.getImmunity(t, ty) === false) return 0; m *= Math.pow(2, D.getEffectiveness(t, ty)); }
  return m; };
const KILL_MOVES = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal'
  && m.basePower >= 90 && (m.accuracy === true || m.accuracy >= 100) && !m.flags.charge && !m.flags.recharge
  && m.type !== FEED_TYPE && mult(m.type, CARRIER.types) >= 2)
  .sort((a, b) => b.basePower - a.basePower);
const KILLERS = [];
for (const mv of KILL_MOVES) {
  for (const sp of SPEC) {
    const L = (D.species.getLearnsetData(sp.id) || {}).learnset || {};
    if (!L[mv.id]) continue;
    if (Math.max(sp.baseStats.atk, sp.baseStats.spa) < 120) continue;
    KILLERS.push({ sp, mv });
  }
}
KILLERS.sort((a, b) => Math.max(b.sp.baseStats.atk, b.sp.baseStats.spa) * b.mv.basePower
                     - Math.max(a.sp.baseStats.atk, a.sp.baseStats.spa) * a.mv.basePower);
console.log('     one-shot killers of ' + CARRIER.name + ' to try              : '
  + (KILLERS.slice(0, 4).map(k => k.sp.name + '/' + k.mv.name).join(', ') || '(none)'));
if (!KILLERS.length) { console.log('  NOT STAGED - nothing can one-shot the carrier.'); process.exit(1); }
/* THE CARRIER MAY NOT SHIELD ON THE FEED TURN. Its first draft idled on Protect and the Fire move
 * never reached it -- zero `-start` in BOTH engines, which reads exactly like an unwired ability
 * and is really a fixture that never staged anything. It idles on its own weakest attack, aimed at
 * the FEEDER'S ALLY so nothing it does can end an arm early. */
const CARRY_IDLE = (() => {
  const L = (D.species.getLearnsetData(D.species.get(CARRIER.name).id) || {}).learnset || {};
  return Object.keys(L).map(id => D.moves.get(id))
    .filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal' && m.basePower > 0
      && (m.accuracy === true || m.accuracy >= 100) && !m.flags.charge && !m.flags.recharge)
    .sort((a, b) => a.basePower - b.basePower)[0];
})();
if (!CARRY_IDLE) { console.log('  NOT STAGED - the carrier knows no idle attack.'); process.exit(1); }
console.log('     the carrier idles on                            : ' + CARRY_IDLE.name);
const CARRY_SIDE = [mon(CARRIER.name, '', AB_NAME, [CARRY_IDLE.name, 'Protect']),
                    mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
const feedSide = kill => [mon(FEED.s.name, '', '', [FEED.mv.name, 'Protect']),
                          mon(kill.sp.name, '', '', [kill.mv.name, 'Protect'])].concat(bench('toxapex', 'corviknight'));
const FEED_SIDE = feedSide(KILLERS[0]);
const feedTurn = { p1: [{ m: FEED.mv.id, t: 0 }, { m: 'protect' }], p2: [{ m: CARRY_IDLE.id, t: 1 }, { m: 'protect' }] };
const idleTurn = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: CARRY_IDLE.id, t: 1 }, { m: 'protect' }] };
const pivotTurn = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ sw: 'milotic' }, { m: 'protect' }] };
const killTurn = k => ({ p1: [{ m: 'protect' }, { m: k.mv.id, t: 0 }],
                         p2: [{ m: CARRY_IDLE.id, t: 1 }, { m: 'protect' }] });

const SWITCH = play('switch', FEED_SIDE, CARRY_SIDE, [feedTurn, pivotTurn]);
const NEVER = play('never-fed', FEED_SIDE, CARRY_SIDE, [idleTurn, pivotTurn]);
let FAINT = null, KILLER = null; const killTried = [];
for (const k of KILLERS.slice(0, 6)) {
  const R = play('faint:' + k.sp.name, feedSide(k), CARRY_SIDE, [feedTurn, killTurn(k)]);
  if (!R.staged) { killTried.push(k.sp.name + '/' + k.mv.name + ' (' + R.why + ')'); continue; }
  if (!R.sd.some(l => new RegExp('^\\|faint\\|p2a: ' + CARRIER.name.split('-')[0]).test(String(l)))) {
    killTried.push(k.sp.name + '/' + k.mv.name + ' (the authority did not KO the carrier)'); continue; }
  FAINT = R; KILLER = k; break;
}
if (!FAINT) { console.log('  NOT STAGED (FAINT) - every killer was refused:');
              for (const t of killTried) console.log('      refused: ' + t); process.exit(1); }
console.log('     FAINT staged with ' + KILLER.sp.name + '/' + KILLER.mv.name
  + (killTried.length ? '   (refused first: ' + killTried.join('; ') + ')' : ''));

console.log(NL + '2. THE ARMS  (' + CARRIER.name + ' @ ' + AB_NAME + ' fed ' + FEED.mv.name
  + ' by ' + FEED.s.name + ')');
for (const [tag, R] of [['SWITCH', SWITCH], ['FAINT', FAINT], ['NEVER-FED', NEVER]]) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); process.exit(1); }
  console.log('  === ' + tag + ' ===');
  console.log('    showdown  -start x' + R.sdStart.length + '  -end x' + R.sdEnd.length + '   ' + JSON.stringify(R.sdEnd));
  console.log('    medicham2 -start x' + R.meStart.length + '  -end x' + R.meEnd.length + '   ' + JSON.stringify(R.meEnd));
  console.log('    placement vs |switch|: showdown ' + R.sdPlace + ', medicham2 ' + R.mePlace
    + '   vs |faint|: showdown ' + R.sdPlaceF + ', medicham2 ' + R.mePlaceF);
  console.log('    boards: ' + R.boardDiffs + ' diff(s) across ' + R.boards.length + ' boundaries');
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
/* NOT VACUOUS: the gift was actually granted in both engines. */
for (const [tag, R] of [['SWITCH', SWITCH], ['FAINT', FAINT]]) {
  ok(R.sdStart.length === 1 && R.meStart.length === 1,
     tag + ' — BOTH engines wrote the `-start` that GRANTS the volatile, so the arm asks a real question',
     'showdown ' + JSON.stringify(R.sdStart) + '  medicham2 ' + JSON.stringify(R.meStart));
}
ok(SWITCH.sdEnd.length === 1 && SWITCH.sdPlace === 'above',
   'SWITCH — the AUTHORITY writes the `-end` once, ABOVE the incoming `|switch|`',
   JSON.stringify(SWITCH.sdEnd) + '  placement ' + SWITCH.sdPlace);
ok(FAINT.sdEnd.length === 0,
   'FAINT \u2014 the AUTHORITY writes NOTHING for a corpse, because `removeVolatile` refuses a body at '
   + '0 HP. This arm was written expecting a line and was RED on the authority; it is kept as the '
   + 'negative that stops the fix being applied to both roads.',
   JSON.stringify(FAINT.sdEnd));
ok(NEVER.sdEnd.length === 0 && NEVER.meEnd.length === 0 && NEVER.sdStart.length === 0,
   'NEVER-FED — no gift, so NO line in either engine under either setting of the knob. A fix keyed on '
   + 'the ABILITY rather than on the VOLATILE would fail here.',
   'showdown ' + JSON.stringify(NEVER.sdEnd) + '  medicham2 ' + JSON.stringify(NEVER.meEnd));

ok(KNOB ? SWITCH.meEnd.length === 0 : (SWITCH.meEnd.length === 1 && SWITCH.mePlace === 'above'),
   'SWITCH — medicham2 writes ' + (KNOB ? 'NONE (the knob is armed)' : 'the same one, in the same place'),
   JSON.stringify(SWITCH.meEnd) + '  placement ' + SWITCH.mePlace);
ok(FAINT.meEnd.length === 0,
   'FAINT \u2014 medicham2 writes nothing either, under EITHER setting of the knob',
   JSON.stringify(FAINT.meEnd));
for (const [tag, R] of [['SWITCH', SWITCH], ['FAINT', FAINT], ['NEVER-FED', NEVER]]) {
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical', R.boardDiffs + ' diff(s)');
}

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M && M.MEDSEEN, F = M && M.MEDFAILS;
console.log('     absorbGiftVolatileEnded ' + (S ? S.absorbGiftVolatileEnded : '?')
  + '   absorbGiftEndedOnSwitch ' + (S ? S.absorbGiftEndedOnSwitch : '?')
  + '   absorbGiftEndOnLeaveRestored ' + (F ? F.absorbGiftEndOnLeaveRestored : '?'));
ok(!!S && (KNOB ? S.absorbGiftEndedOnSwitch === 0 : S.absorbGiftEndedOnSwitch >= 1),
   KNOB ? 'the switch road stayed silent (the knob is armed)' : 'the switch road paid the line',
   'absorbGiftEndedOnSwitch = ' + (S ? S.absorbGiftEndedOnSwitch : '?'));

ok(!!F && (KNOB ? F.absorbGiftEndOnLeaveRestored === 1 : !F.absorbGiftEndOnLeaveRestored),
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'absorbGiftEndOnLeaveRestored = ' + (F ? F.absorbGiftEndOnLeaveRestored : '?'));

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
