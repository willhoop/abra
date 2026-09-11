#!/usr/bin/env node
/* tests/probe_pivot_shield_before_ability.js — NARRATION BATCH R, CLUSTER 6
 * ==================================================================================================
 * THE SHIELD ANSWERS BEFORE THE ABILITY, AND LONG BEFORE THE PRANKSTER IMMUNITY.
 *
 * `trySpreadMoveHit` is STEP-MAJOR, and the step list decides which refusal gets to speak
 * (sim/battle-actions.ts):
 *
 *     step 1  hitStepTryHitEvent     runEvent('TryHit')          <- Protect AND Good as Gold
 *     step 2  hitStepTypeImmunity
 *     step 3  hitStepTryImmunity     <- the Dark-is-immune-to-Prankster refusal
 *
 * Inside step 1 the handlers for ONE target are collected in a fixed order — status, VOLATILES,
 * ABILITY, item (`findEventHandlers`, sim/battle.ts) — and Protect is a volatile while Good as Gold
 * is an ability. So on a Protecting target the authority writes `|-activate|TARGET|move: Protect`
 * and the ability never speaks. The Prankster refusal is not even in the same step.
 *
 * THIS ENGINE ASKED IN THE OPPOSITE ORDER, and only on the PIVOT road: the `kind==='switch'` branch
 * ran `tryHitRefusal` (Good as Gold, the Prankster block, the absorbers) and only THEN the shield.
 * Three NARRATION-ONLY causes on release `0c5a4da9c512`, all of them Parting Shot:
 *
 *     |-activate|p1a|protect <> |-immune|p1a                            the Prankster refusal
 *     |-activate|p2a|protect <> |-immune|p2a|[from]goodasgold            the ability
 *     |-activate|p1b|protect <> |-immune|p1b|[from]goodasgold            the ability
 *
 * THE ARMS
 *   GAG-SHIELDED     a Good as Gold body PROTECTS and eats the pivot. Protect must speak.
 *   PRANK-SHIELDED   a Prankster user throws the pivot at a PROTECTING Dark body. Protect must speak,
 *                    because the Dark refusal is two steps later.
 *   GAG-BARE         THE CONTROL. The same Good as Gold body, NOT protecting: the ability speaks in
 *                    both engines, under either setting of the knob.
 *   PRANK-BARE       THE CONTROL. The same Dark body, NOT protecting: the bare `-immune` in both.
 *
 * The two BARE arms are what stop the fix reading as "Protect always wins" — they are the same
 * boards with one knob turned, and the knob is whether the target clicked its shield.
 *
 * RED-FIRST KNOB: `MEDI_PIVOT_ABILITY_BEFORE_SHIELD=1` puts the pivot road back to asking the ability
 * first, i.e. the engine exactly as it stood before batch R. Under it the two SHIELDED arms go RED
 * and the two BARE arms stay green, and any run carrying it also carries
 * `MEDFAILS.pivotAbilityBeforeShieldRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_pivot_shield_before_ability.js
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
const KNOB = process.env.MEDI_PIVOT_ABILITY_BEFORE_SHIELD === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_pivot_shield_before_ability.js — the shield speaks before the ability');
console.log('  MEDI_PIVOT_ABILITY_BEFORE_SHIELD=' + (KNOB ? '1  (PRE-FIX ENGINE: the ability answers first)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY. CR stripped at the read — the checkout is CRLF and a carriage return is a
 *    JavaScript line terminator, so a multi-line anchor silently matches nothing.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const ACTIONS = read('/sim/battle-actions.ts');
const BATTLE = read('/sim/battle.ts');
const ABS = read('/data/abilities.ts');
const MOVES = read('/data/moves.ts');

console.log(NL + '0. THE AUTHORITY');
/* THE STEP ORDER, read off the list itself rather than off the method definitions. */
const STEPS = /const moveSteps[\s\S]{0,140}?\[([\s\S]{0,900}?)\n\t\t\];/.exec(ACTIONS);
const stepList = STEPS ? (STEPS[1].match(/this\.(\w+)/g) || []).map(x => x.slice(5)) : [];
console.log('     the step list, in order: ' + stepList.join(' -> '));
ok(stepList.indexOf('hitStepTryHitEvent') >= 0
   && stepList.indexOf('hitStepTryImmunity') > stepList.indexOf('hitStepTryHitEvent'),
   '`hitStepTryHitEvent` runs BEFORE `hitStepTryImmunity`, so a shield answers before the Prankster refusal',
   'TryHit at ' + stepList.indexOf('hitStepTryHitEvent') + ', TryImmunity at ' + stepList.indexOf('hitStepTryImmunity'));
ok(/move\.pranksterBoosted && pokemon\.hasAbility\('prankster'\)/.test(ACTIONS)
   && /this\.battle\.add\('-immune', target\);/.test(ACTIONS),
   'the Dark-is-immune-to-Prankster refusal lives in `hitStepTryImmunity` and writes a BARE `-immune`');
/* AND INSIDE THE ONE EVENT: volatiles are collected before abilities. */
const FEH = /findEventHandlers\(target: Pokemon[\s\S]*?\n\t\}/.exec(BATTLE) || /findPokemonEventHandlers\([\s\S]*?\n\t\}/.exec(BATTLE);
const POKEHANDLERS = /findPokemonEventHandlers\(pokemon: Pokemon[\s\S]*?\n\t\}/.exec(BATTLE);
const order = POKEHANDLERS ? (POKEHANDLERS[0].match(/pokemon\.(getStatus|volatiles|getAbility|getItem)\b/g) || [])
  .map(x => x.replace('pokemon.', '')) : [];
ok(order.indexOf('volatiles') >= 0 && order.indexOf('getAbility') > order.indexOf('volatiles'),
   'a VOLATILE\u2019s handler is collected before the ABILITY\u2019s, so Protect speaks before Good as Gold',
   order.join(' -> '));
const PROT = /\n\tprotect: \{\n([\s\S]*?)\n\t\},\n/.exec(MOVES);
ok(!!PROT || /'-activate', target, 'move: Protect'/.test(MOVES),
   'the shield condition writes `|-activate|TARGET|move: Protect|`');
const GAG = /\n\tgoodasgold: \{\n([\s\S]*?)\n\t\},\n/.exec(ABS);
ok(!!GAG && /onTryHit\(target, source, move\)/.test(GAG[1]),
   'Good as Gold refuses through `onTryHit`, i.e. the SAME event Protect answers in',
   GAG ? (GAG[1].match(/onTryHit[\s\S]{0,120}/) || ['not found'])[0] : 'goodasgold block not found');

/* ==================================================================================================
 * 1. THE CAST — derived, membership printed
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega);
const learnsetOf = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const learns = (sp, mv) => !!learnsetOf(sp)[mv];
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const GAGS = Object.keys(TAGS.abilities || {}).filter(k => ((TAGS.abilities[k].tags) || []).includes('refusesStatusMoves'));

/* THE PIVOT: a STATUS move that switches its user out and targets one adjacent foe. Parting Shot is
 * the only one in this format, and that is derived rather than named. */
const PIVOTS = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.selfSwitch
  && m.target === 'normal' && m.flags && m.flags.protect);
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
console.log('     single-target STATUS pivots blockable by a shield : '
  + (PIVOTS.map(m => m.name).join(', ') || '(none)'));
console.log('     `refusesStatusMoves` carriers in data/tags.json    : ' + (GAGS.join(', ') || '(none)'));
if (!PIVOTS.length || !GAGS.length) { console.log('  NOT STAGED — a role has no member.'); process.exit(1); }
const PIVOT = PIVOTS[0];
const GAG_AB = GAGS[0];
const GAG_BODIES = SPEC.filter(s => Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === GAG_AB));
const PRANK_USERS = SPEC.filter(s => learns(s.name, PIVOT.id)
  && Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === 'prankster'));
const PLAIN_USERS = SPEC.filter(s => learns(s.name, PIVOT.id)
  && !Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === 'prankster'));
const DARK_BODIES = SPEC.filter(s => s.types.includes('Dark') && learns(s.name, 'protect'));
console.log('     legal ' + D.abilities.get(GAG_AB).name + ' carriers                       : '
  + (GAG_BODIES.map(s => s.name).join(', ') || '(none)'));
console.log('     legal Prankster users of ' + PIVOT.name + '            : '
  + (PRANK_USERS.map(s => s.name).join(', ') || '(none)'));
console.log('     legal non-Prankster users of ' + PIVOT.name + '        : '
  + (PLAIN_USERS.slice(0, 6).map(s => s.name).join(', ') || '(none)'));
console.log('     legal DARK bodies that learn Protect              : ' + DARK_BODIES.length
  + '   e.g. ' + DARK_BODIES.slice(0, 4).map(s => s.name).join(', '));
if (!GAG_BODIES.length || !PRANK_USERS.length || !PLAIN_USERS.length || !DARK_BODIES.length) {
  console.log('  NOT STAGED — a role has no legal filler.'); process.exit(1);
}
/* The Dark body must NOT itself carry the gag ability, or the two arms would be one arm. */
const DARK = DARK_BODIES.filter(s => !Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === GAG_AB))[0];
const GAG_BODY = GAG_BODIES[0], PRANK = PRANK_USERS[0], PLAIN = PLAIN_USERS[0];

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const bench = (...n) => n.map(s => mon(s, '', '', ['Protect']));
const isProt = l => /^\|-activate\|/.test(String(l)) && /move: Protect/i.test(String(l));
const isImm = l => /^\|-immune\|/.test(String(l));

function play(tag, user, userAb, target, targetAb, shield) {
  const A = [mon(user.name, '', userAb || '', [PIVOT.name, 'Protect']),
             mon('clefable', '', 'Unaware', ['Protect'])].concat(bench('toxapex', 'corviknight'));
  const B = [mon(target.name, '', targetAb || '', ['Protect', 'Bulk Up']),
             mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
  /* The target clicks its shield (or not) on the SAME turn the pivot goes in. That single knob is
   * what separates each REAL arm from its own control. */
  const script = [{ p1: [{ m: PIVOT.id, t: 0 }, { m: 'protect' }],
                    p2: [{ m: shield ? 'protect' : 'bulkup' }, { m: 'protect' }] }];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_pivot_shield_before_ability :: ' + tag, { script,
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
  /* ONLY the lines AFTER the pivot's own `|move|`, so the shield's own `-singleturn` and any earlier
   * refusal cannot be counted as this one. */
  /* THE TWO STREAMS SPELL THE MOVE DIFFERENTLY -- Showdown writes `Parting Shot` and this engine
   * writes `partingshot` -- so the anchor is matched on the SQUASHED line. The first draft matched
   * only Showdown's spelling, read an EMPTY medicham2 list on every arm, and that looks exactly
   * like an engine that says nothing at all rather than like a broken fixture. */
  const squash = l => String(l).toLowerCase().replace(/[^a-z0-9|:]/g, '');
  const anchor = squash('|move|p1a:' + user.name.split('-')[0] + '|' + PIVOT.name);
  const after = lines => { const i = lines.findIndex(l => squash(l).indexOf(anchor) === 0);
    return i < 0 ? null : lines.slice(i + 1, i + 4); };
  const sdA = after(sd), meA = after(me);
  if (!sdA || !meA) return { staged: false, why: 'the pivot own `|move|` line was not found in the '
    + (!sdA ? 'showdown' : 'medicham2') + ' stream - the click never happened' };
  return { staged: true, boards, sd, me, sdA, meA,
           sdSaid: sdA.filter(l => isProt(l) || isImm(l)), meSaid: meA.filter(l => isProt(l) || isImm(l)),
           boardDiffs: boards.reduce((n, x) => n + x.diffs, 0),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const GAG_NAME = D.abilities.get(GAG_AB).name;
const GAG_SH = play('gag-shielded', PLAIN, '', GAG_BODY, GAG_NAME, true);
const GAG_BA = play('gag-bare', PLAIN, '', GAG_BODY, GAG_NAME, false);
const PRK_SH = play('prank-shielded', PRANK, 'Prankster', DARK, '', true);
const PRK_BA = play('prank-bare', PRANK, 'Prankster', DARK, '', false);

console.log(NL + '2. THE ARMS  (' + PIVOT.name + ')');
for (const [tag, R] of [['GAG-SHIELDED', GAG_SH], ['PRANK-SHIELDED', PRK_SH],
                        ['GAG-BARE', GAG_BA], ['PRANK-BARE', PRK_BA]]) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); process.exit(1); }
  console.log('  === ' + tag + ' ===');
  console.log('    showdown  ' + JSON.stringify(R.sdSaid));
  console.log('    medicham2 ' + JSON.stringify(R.meSaid));
  console.log('    boards: ' + R.boardDiffs + ' diff(s) across ' + R.boards.length + ' boundaries');
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
ok(GAG_SH.sdSaid.length === 1 && isProt(GAG_SH.sdSaid[0]),
   'GAG-SHIELDED — the AUTHORITY answers with the SHIELD, not with the ability',
   JSON.stringify(GAG_SH.sdSaid));
ok(PRK_SH.sdSaid.length === 1 && isProt(PRK_SH.sdSaid[0]),
   'PRANK-SHIELDED — the AUTHORITY answers with the SHIELD, because the Prankster refusal is two '
   + 'steps later in the list',
   JSON.stringify(PRK_SH.sdSaid));
ok(GAG_BA.sdSaid.length === 1 && isImm(GAG_BA.sdSaid[0]) && /good as gold/i.test(GAG_BA.sdSaid[0]),
   'GAG-BARE — with no shield the AUTHORITY names the ability, so the arms really are one knob apart',
   JSON.stringify(GAG_BA.sdSaid));
ok(PRK_BA.sdSaid.length === 1 && isImm(PRK_BA.sdSaid[0]) && !/ability/i.test(PRK_BA.sdSaid[0]),
   'PRANK-BARE — with no shield the AUTHORITY writes the BARE `-immune`, with no attribution',
   JSON.stringify(PRK_BA.sdSaid));

const same = (R) => R.sdSaid.length === R.meSaid.length
  && R.sdSaid.every((l, i) => String(l).toLowerCase().replace(/[^a-z0-9|:]/g, '')
                            === String(R.meSaid[i]).toLowerCase().replace(/[^a-z0-9|:]/g, ''));
for (const [tag, R, shielded] of [['GAG-SHIELDED', GAG_SH, true], ['PRANK-SHIELDED', PRK_SH, true],
                                  ['GAG-BARE', GAG_BA, false], ['PRANK-BARE', PRK_BA, false]]) {
  const expect = !KNOB || !shielded;
  ok(expect ? same(R) : !same(R),
     tag + ' — medicham2 says the same thing as the authority'
     + (expect ? '' : '   [expected to DIFFER: the knob is armed]'),
     same(R) ? null : 'showdown  ' + JSON.stringify(R.sdSaid) + '\nmedicham2 ' + JSON.stringify(R.meSaid));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical', R.boardDiffs + ' diff(s)');
}

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M && M.MEDSEEN, F = M && M.MEDFAILS;
console.log('     pivotShieldBeforeAbility ' + (S ? S.pivotShieldBeforeAbility : '?')
  + '   pivotAbilityBeforeShieldRestored ' + (F ? F.pivotAbilityBeforeShieldRestored : '?'));
ok(!!S && (KNOB ? S.pivotShieldBeforeAbility === 0 : S.pivotShieldBeforeAbility >= 2),
   KNOB ? 'the hoisted shield never fired (the knob is armed)'
        : 'the hoisted shield answered in BOTH shielded arms',
   'pivotShieldBeforeAbility = ' + (S ? S.pivotShieldBeforeAbility : '?'));
ok(!!F && (KNOB ? F.pivotAbilityBeforeShieldRestored === 1 : !F.pivotAbilityBeforeShieldRestored),
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'pivotAbilityBeforeShieldRestored = ' + (F ? F.pivotAbilityBeforeShieldRestored : '?'));

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
