#!/usr/bin/env node
/* tests/probe_ability_zero_boost_line.js — NARRATION BATCH R, CLUSTER 3
 * ==================================================================================================
 * AN ABILITY'S STAT CHANGE THAT THE CAP SWALLOWS IS STILL ANNOUNCED, AT MAGNITUDE ZERO.
 *
 * THE AUTHORITY, `Battle#boost`'s zero branch — re-read this run in §0, never recalled:
 *
 *     if (boostBy) { ... }
 *     else if (effect?.effectType === 'Ability') {
 *       if (isSecondary || isSelf) this.add(msg, target, boostName, boostBy);
 *     } else if (!isSecondary && !isSelf) {
 *       this.add(msg, target, boostName, boostBy);
 *     }                                                            sim/battle.ts, `boost()`
 *
 * and the two lines above it that decide which word is used:
 *
 *     if (boost[boostName]! < 0 || target.boosts[boostName] === -6) { msg = '-unboost'; ... }
 *
 * `effect` is NOT the argument the handler passed. `boost()` opens with `effect ||= this.effect`, so a
 * handler that passes `null` — which both retaliators do — still lands in the ABILITY branch, because
 * `this.effect` during the handler IS the ability.
 *
 * ROADMAP #289 already built the emitter (`TR.bst`'s `zero` argument) and made it OPT-IN PER CALL
 * SITE, deliberately: "a blanket `emit whenever d === 0` would invent lines" in the branches that stay
 * silent. Two ability sites had never opted in, and they are FIVE of the NARRATION-ONLY causes on
 * release `0c5a4da9c512`:
 *
 *     |-boost|p2b|atk|0 <> |move|p2b|ragefist                  Defiant, at +6
 *     |-boost|p1b|atk|0 <> |upkeep                             Defiant, at +6
 *     |-boost|p2a|atk|0 <> |move|p1a|calmmind                  Defiant, at +6
 *     |-boost|p2a|atk|0 <> |switch|p1a|metagross,l50|H/H       Defiant, at +6
 *     |-unboost|p1b|spe|0 <> |faint|p2a                        Gooey, at -6
 *
 *   `retaliateWhenLowered`  Defiant/Competitive: `this.boost({atk: 2}, target, target, null, false, true)`
 *                           — isSelf, so the ABILITY branch announces.
 *   the punisher boost      Gooey: `this.boost({spe: -1}, source, target, null, true)`
 *                           — isSecondary, so the ABILITY branch announces.
 *
 * THE ARMS
 *   DEFIANT-AT-CAP    a Defiant body sat at +6 Attack takes a two-stat drop. The authority writes
 *                     TWO zero lines on that turn: one for the capped setup click (a MOVE primary,
 *                     which this engine already emitted) and one for the second retaliation (the
 *                     ABILITY, which it did not). Comparing the WHOLE boost-line list, not a count.
 *   GOOEY-AT-FLOOR    a contact attacker driven to -6 Speed takes one more contact hit. The authority
 *                     writes ONE zero line — Gooey's, an ABILITY call that passes `isSecondary`.
 *   NOT-AT-CAP        THE KNOB-CLEARED CONTROL. The same Parting Shot into the same Defiant body from
 *                     a NEUTRAL stage: every boost lands, no zero line exists in either engine, and
 *                     the knob does not move it.
 *   MOVE-SECONDARY-AT-CAP
 *                     THE OVER-MATCH NEGATIVE. A body at +6 Attack clicks a move whose SECONDARY
 *                     raises its own Attack. That call is `isSecondary` with a MOVE effect, so BOTH
 *                     zero branches refuse it and the authority writes NOTHING — under either
 *                     setting of the knob. Without this arm, "emit every zero" would pass.
 *
 * RED-FIRST KNOB: `MEDI_NO_ABILITY_ZERO_BOOST=1` puts the two sites back to suppressing their zeroes,
 * i.e. the engine exactly as it stood before batch R. Under it DEFIANT-AT-CAP and GOOEY-AT-FLOOR go
 * RED and NOT-AT-CAP stays green, and any run carrying it also carries
 * `MEDFAILS.abilityZeroBoostRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_ability_zero_boost_line.js
 *   MEDI_NO_ABILITY_ZERO_BOOST=1 SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_ability_zero_boost_line.js
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
const KNOB = process.env.MEDI_NO_ABILITY_ZERO_BOOST === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_ability_zero_boost_line.js — an ability boost the cap swallows still announces');
console.log('  MEDI_NO_ABILITY_ZERO_BOOST=' + (KNOB ? '1  (PRE-FIX ENGINE: the two ability sites stay silent)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY. The CR is stripped at the read: this checkout is CRLF and a carriage return is a
 *    JavaScript line terminator, so a multi-line anchor silently matches nothing.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const BATTLE = read('/sim/battle.ts');
const ABS = read('/data/abilities.ts');
const CH_AB = read('/data/mods/champions/abilities.ts');

console.log(NL + '0. THE AUTHORITY');
const BOOST = /\n\tboost\(\n([\s\S]*?)\n\t\}\n/.exec(BATTLE);
ok(!!BOOST && /effect \|\|= this\.effect;/.test(BOOST[1]),
   '`Battle#boost` REPLACES a null `effect` with `this.effect`, so a handler that passes null still '
   + 'reaches the Ability branch',
   BOOST ? (BOOST[1].match(/effect \|\|= this\.effect;/) || [''])[0] : 'boost() not found');
ok(!!BOOST && /\} else if \(effect\?\.effectType === 'Ability'\) \{\s*\n\s*if \(isSecondary \|\| isSelf\) this\.add\(msg, target, boostName, boostBy\);/.test(BOOST[1]),
   'the ZERO branch announces for an Ability effect when the call is a secondary OR a self',
   BOOST ? (BOOST[1].match(/\} else if \(effect\?\.effectType === 'Ability'\)[\s\S]{0,180}/) || ['not found'])[0] : 'boost() not found');
ok(!!BOOST && /msg = '-unboost';/.test(BOOST[1])
   && /if \(boost\[boostName\]! < 0 \|\| target\.boosts\[boostName\] === -6\)/.test(BOOST[1]),
   'the WORD is `-unboost` when the request was negative OR the body already sits at -6',
   BOOST ? (BOOST[1].match(/if \(boost\[boostName\]! < 0[\s\S]{0,90}/) || ['not found'])[0] : 'boost() not found');

/* WHICH HANDLERS, AND WHICH FLAGS THEY PASS — parsed out of the ability blocks, not typed. */
const handlerCall = (ab) => {
  const L = ABS.split('\n'); let cur = null;
  for (let i = 0; i < L.length; i++) {
    const h = /^\t([a-z0-9]+): \{/.exec(L[i]); if (h) cur = h[1];
    if (cur === ab && /this\.boost\(/.test(L[i])) return { line: i + 1, raw: L[i].trim() };
  }
  return null;
};
const DEFC = handlerCall('defiant'), COMPC = handlerCall('competitive'), GOOC = handlerCall('gooey');
for (const [name, c, want] of [['defiant', DEFC, 'null, false, true'], ['competitive', COMPC, 'null, false, true'],
                               ['gooey', GOOC, 'null, true']]) {
  ok(!!c && c.raw.indexOf(want) >= 0,
     '`' + name + '` calls `this.boost(..., ' + want + ')` — ' + (want.indexOf('false, true') >= 0 ? 'isSelf' : 'isSecondary')
     + ', which is exactly what the zero branch asks for',
     c ? 'data/abilities.ts:' + c.line + '  ' + c.raw : 'no this.boost call found');
  ok(!new RegExp('^\\t' + name + ':', 'm').test(CH_AB),
     'Champions does not override `' + name + '`, so mainline IS its authority');
}

/* ==================================================================================================
 * 1. THE CAST — derived, and the MEMBERSHIP of each tag PRINTED before it is trusted
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega);
const carriersOf = id => SPEC.filter(s => Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === id));
const learnsetOf = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const learns = (sp, mv) => !!learnsetOf(sp)[mv];
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const tagged = t => Object.keys(TAGS.abilities || {}).filter(k => ((TAGS.abilities[k].tags) || []).includes(t));

console.log(NL + '1. THE CAST, DERIVED THIS RUN');
console.log('     `boostsWhenLowered` carriers in data/tags.json : ' + tagged('boostsWhenLowered').join(', '));
console.log('     legal Defiant carriers                          : ' + carriersOf('defiant').map(s => s.name).join(', '));
console.log('     legal Gooey carriers                            : ' + carriersOf('gooey').map(s => s.name).join(', '));
const PS_USERS = SPEC.filter(s => learns(s.name, 'partingshot'));
console.log('     legal Parting Shot users                        : ' + PS_USERS.map(s => s.name).join(', '));
/* THE FLOOR TAKES SIX HITS TO REACH, so the attacker has to survive six of the Gooey body's own
 * clicks and the Gooey body has to survive six of the attacker's. Candidates are the WEAKEST contact
 * attackers in the format, ranked by attack x base power; the arm below takes the first one the
 * AUTHORITY stages. Multi-hit and sub-100 moves are excluded: a volley would reach the floor faster
 * than the script counts and a miss would leave it unreached with nothing saying so. */
const CONTACT = [];
for (const s of SPEC) {
  if (s.baseStats.atk > 70) continue;
  const mv = Object.keys(learnsetOf(s.name)).map(id => D.moves.get(id))
    .filter(m => legal(m) && m.category === 'Physical' && m.flags.contact && m.target === 'normal'
      && m.basePower > 0 && m.basePower <= 40 && (m.accuracy === true || m.accuracy >= 100) && !m.multihit)
    .sort((a, b) => a.basePower - b.basePower)[0];
  if (mv) CONTACT.push({ s, mv });
}
CONTACT.sort((a, b) => a.s.baseStats.atk * a.mv.basePower - b.s.baseStats.atk * b.mv.basePower);
console.log('     weakest legal contact attackers                 : '
  + CONTACT.slice(0, 5).map(c => c.s.name + ' atk' + c.s.baseStats.atk + ' ' + c.mv.name + '/' + c.mv.basePower).join(', '));
/* AND THE SILENT BRANCH'S OWN CARRIER: a body that can reach +6 Attack and then click a move whose
 * SECONDARY raises its own Attack. That call is isSecondary and the effect is a MOVE, so BOTH zero
 * branches refuse it and the authority writes nothing. */
const SELFSEC = D.moves.all().filter(m => legal(m) && m.target === 'normal'
  && (m.secondaries || []).some(x => x.self && x.self.boosts && x.self.boosts.atk));
const SELFSEC_USERS = SELFSEC.map(m => ({ m, users: SPEC.filter(s => learns(s.name, m.id) && learns(s.name, 'swordsdance')) }))
  .filter(x => x.users.length);
console.log('     moves whose SECONDARY raises the user Attack    : '
  + SELFSEC.map(m => m.name).join(', ') + '   staged by: '
  + (SELFSEC_USERS.length ? SELFSEC_USERS[0].m.name + ' off ' + SELFSEC_USERS[0].users[0].name : '(nobody)'));
const DEF_SETUP = carriersOf('defiant').filter(s => learns(s.name, 'swordsdance'));
console.log('     Defiant carriers that also learn Swords Dance   : ' + DEF_SETUP.map(s => s.name).join(', '));
if (!DEF_SETUP.length || !PS_USERS.length || !carriersOf('gooey').length || !CONTACT.length
    || !SELFSEC_USERS.length) {
  console.log('  NOT STAGED — a role has no legal filler.'); process.exit(1);
}
/* `-boost ... 0` only exists at a cap, so the setup click has to be able to REACH the cap. Swords
 * Dance is +2 and the cap is +6, so three clicks. The retaliator is picked as the first carrier that
 * learns it, and the Parting Shot user as the first legal one. */
const DEFIANT = DEF_SETUP[0];
const SHOUTER = PS_USERS[0];
const GOOEY = carriersOf('gooey')[0];
const SILENT_MOVE = SELFSEC_USERS[0].m, SILENT_USER = SELFSEC_USERS[0].users[0];

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const bench = (...n) => n.map(s => mon(s, '', '', ['Protect']));
const isBoost = l => /^\|-(un)?boost\|/.test(String(l));
const isZero = l => isBoost(l) && /\|0$/.test(String(l));

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_ability_zero_boost_line :: ' + tag, { script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).length });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  /* THE COMPARISON IS ON THE LOWERCASED LINE, because Showdown writes `p2a: Kingambit` and this
   * engine writes the same identifier — but the two streams differ in casing elsewhere and the
   * differential's own reducer lowercases before it compares. Nothing else is normalised. */
  const norm = l => String(l).toLowerCase();
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  return { staged: true, boards, sd, me,
           sdB: sd.filter(isBoost).map(norm), meB: me.filter(isBoost).map(norm),
           sdZ: sd.filter(isZero), meZ: me.filter(isZero),
           boardDiffs: boards.reduce((n, x) => n + x.diffs, 0),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const SHOUT_SIDE = [mon(SHOUTER.name, '', '', ['Parting Shot', 'Protect']),
                    mon('clefable', '', 'Unaware', ['Protect'])].concat(bench('toxapex', 'corviknight'));
const DEF_SIDE = [mon(DEFIANT.name, '', 'Defiant', ['Swords Dance', 'Protect']),
                  mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
const setupTurn = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] };
const shoutTurn = { p1: [{ m: 'partingshot', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] };
const CAP = play('defiant-at-cap', SHOUT_SIDE, DEF_SIDE, [setupTurn, setupTurn, setupTurn, shoutTurn]);
const FLAT = play('defiant-not-at-cap', SHOUT_SIDE, DEF_SIDE, [shoutTurn]);

/* SIX HITS TO THE FLOOR; THE SEVENTH IS THE ZERO. The Gooey body clicks at the ATTACKER'S ALLY so
 * nothing it does can end the arm early. The first candidate the AUTHORITY stages is taken and every
 * earlier one is refused BY NAME. */
let GOO = null, GOO_WHO = null; const gooTried = [];
for (const c of CONTACT.slice(0, 6)) {
  const HIT_SIDE = [mon(c.s.name, '', '', [c.mv.name, 'Protect']),
                    mon('clefable', '', 'Unaware', ['Protect'])].concat(bench('toxapex', 'corviknight'));
  const GOO_SIDE = [mon(GOOEY.name, '', 'Gooey', ['Dragon Pulse']),
                    mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
  const t = { p1: [{ m: c.mv.id, t: 0 }, { m: 'protect' }], p2: [{ m: 'dragonpulse', t: 1 }, { m: 'protect' }] };
  const R = play('gooey-at-floor:' + c.s.name, HIT_SIDE, GOO_SIDE, [t, t, t, t, t, t, t]);
  if (!R.staged) { gooTried.push(c.s.name + '/' + c.mv.name + ' (' + R.why + ')'); continue; }
  if (R.sdZ.length !== 1) { gooTried.push(c.s.name + '/' + c.mv.name + ' (the authority wrote '
    + R.sdZ.length + ' zero lines, not 1)'); continue; }
  GOO = R; GOO_WHO = c; break;
}
if (!GOO) { console.log('  NOT STAGED (GOOEY-AT-FLOOR) - every candidate was refused:');
            for (const t of gooTried) console.log('      refused: ' + t); process.exit(1); }

/* THE SILENT BRANCH. The same setup shape as DEFIANT-AT-CAP, but the clamped raise is a MOVE
 * SECONDARY rather than an ability, so the authority writes NOTHING and so must this engine, under
 * EITHER setting of the knob. This is what stops the fix being read as "emit every zero". */
const SILENT_SIDE = [mon(SILENT_USER.name, '', '', ['Swords Dance', SILENT_MOVE.name]),
                     mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
const INERT_SIDE = [mon('clefable', '', 'Unaware', ['Protect']),
                    mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(bench('toxapex', 'corviknight'));
const sdTurn = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] };
const secTurn = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: SILENT_MOVE.id, t: 1 }, { m: 'protect' }] };
const SILENT = play('move-secondary-at-cap', INERT_SIDE, SILENT_SIDE, [sdTurn, sdTurn, sdTurn, secTurn]);

console.log(NL + '2. THE ARMS');
for (const [tag, R] of [['DEFIANT-AT-CAP', CAP], ['GOOEY-AT-FLOOR', GOO], ['NOT-AT-CAP', FLAT],
                        ['MOVE-SECONDARY-AT-CAP', SILENT]]) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); process.exit(1); }
  console.log('  === ' + tag + ' ===');
  console.log('    showdown  zero-magnitude lines x' + R.sdZ.length + '   ' + JSON.stringify(R.sdZ));
  console.log('    medicham2 zero-magnitude lines x' + R.meZ.length + '   ' + JSON.stringify(R.meZ));
  console.log('    boost lines: showdown ' + R.sdB.length + ', medicham2 ' + R.meB.length);
  console.log('    boards: ' + R.boardDiffs + ' diff(s) across ' + R.boards.length + ' boundaries');
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
/* THE ARMS ARE NOT VACUOUS: the cap and the floor were actually reached, which is what the authority
 * writing a zero line proves. Asserted on SHOWDOWN, because Showdown is the expectation. */
ok(CAP.sdZ.length === 2,
   'DEFIANT-AT-CAP — the AUTHORITY writes TWO zero lines: the capped setup click (a MOVE primary) '
   + 'and the second retaliation (the ABILITY). One of each branch, on one turn.',
   JSON.stringify(CAP.sdZ));
ok(GOO.sdZ.length === 1,
   'GOOEY-AT-FLOOR — the AUTHORITY writes exactly ONE zero line, on the SEVENTH hit: the six '
   + 'that walked the stage down to -6 all carry magnitude 1 and only the seventh is clamped. A '
   + 'count above one would mean the floor was reached earlier than the script thinks.',
   JSON.stringify(GOO.sdZ));
ok(FLAT.sdZ.length === 0 && FLAT.meZ.length === 0,
   'NOT-AT-CAP — no zero line exists in EITHER engine when nothing is clamped',
   'showdown ' + JSON.stringify(FLAT.sdZ) + '  medicham2 ' + JSON.stringify(FLAT.meZ));

const want = (R, n) => KNOB ? R.meZ.length === n - 1 : R.meZ.length === n;
ok(want(CAP, 2), 'DEFIANT-AT-CAP — medicham2 writes ' + (KNOB ? 'ONE, the move half only (the knob is armed)' : 'BOTH'),
   JSON.stringify(CAP.meZ));
ok(want(GOO, 1), 'GOOEY-AT-FLOOR — medicham2 writes ' + (KNOB ? 'NONE (the knob is armed)' : 'the one'),
   JSON.stringify(GOO.meZ));

ok(SILENT.sdZ.length === 0 && SILENT.meZ.length === 0,
   'MOVE-SECONDARY-AT-CAP — a clamped raise arriving as a MOVE SECONDARY announces NOTHING in either '
   + 'engine, under either setting of the knob. BOTH zero branches refuse it: the effect is not an '
   + 'Ability, and `!isSecondary` is false. This is the arm that stops the fix reading as "emit every zero".',
   'showdown ' + JSON.stringify(SILENT.sdZ) + '  medicham2 ' + JSON.stringify(SILENT.meZ));

/* THE OUTCOME TEST: the whole boost-line list, in order, not a count of zeroes. A count can be right
 * with the lines in the wrong place or on the wrong body. */
for (const [tag, R] of [['DEFIANT-AT-CAP', CAP], ['GOOEY-AT-FLOOR', GOO], ['NOT-AT-CAP', FLAT],
                        ['MOVE-SECONDARY-AT-CAP', SILENT]]) {
  const same = R.sdB.length === R.meB.length && R.sdB.every((l, i) => l === R.meB[i]);
  const expectSame = !KNOB || tag === 'NOT-AT-CAP' || tag === 'MOVE-SECONDARY-AT-CAP';
  ok(expectSame ? same : !same,
     tag + ' — every `-boost`/`-unboost` line matches the authority, in order'
     + (expectSame ? '' : '   [expected to DIFFER: the knob is armed]'),
     same ? null : 'showdown  ' + JSON.stringify(R.sdB) + '\nmedicham2 ' + JSON.stringify(R.meB));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical', R.boardDiffs + ' diff(s)');
}

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M && M.MEDSEEN, F = M && M.MEDFAILS;
console.log('     boostZeroAnnounced ' + (S ? S.boostZeroAnnounced : '?')
  + '   abilityZeroBoostAnnounced ' + (S ? S.abilityZeroBoostAnnounced : '?')
  + '   boostZeroSuppressed ' + (F ? F.boostZeroSuppressed : '?')
  + '   boostZeroNotAtCap ' + (F ? F.boostZeroNotAtCap : '?')
  + '   abilityZeroBoostRestored ' + (F ? F.abilityZeroBoostRestored : '?'));
ok(!!S && (KNOB ? S.abilityZeroBoostAnnounced === 0 : S.abilityZeroBoostAnnounced >= 2),
   KNOB ? 'the two ability sites announced NOTHING (the knob is armed)'
        : 'BOTH ability sites announced a zero — one for the retaliator, one for the punisher',
   'abilityZeroBoostAnnounced = ' + (S ? S.abilityZeroBoostAnnounced : '?'));
ok(!!F && (KNOB ? F.abilityZeroBoostRestored === 1 : !F.abilityZeroBoostRestored),
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'abilityZeroBoostRestored = ' + (F ? F.abilityZeroBoostRestored : '?'));

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
