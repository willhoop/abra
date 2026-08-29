/* CARD C1 — A PIVOT IS A MOVE, AND THE DRAW SITE REFUSED IT BY ACTION KIND.
 *
 *   node tests/probe_pivot_redirect.js
 *   MEDI_PIVOT_SKIPS_REDIRECT=1 node tests/probe_pivot_redirect.js     (the red demonstration)
 *
 * THE DEFECT, out of `docs/_reports/2026-08-29-empirical-divergence-cards.md` card C1, 7 games:
 *     |move|p1b: Maushold|followme        |-singleturn|p1b: Maushold|move: followme
 *     |move|p2a: Incineroar|partingshot|p1a: Beedrill
 *     SHOWDOWN : |-unboost|p1b: Maushold|atk|1      <- the redirector took it
 *     MEDICHAM : |-unboost|p1a: Beedrill|atk|1      <- we hit the named target
 *
 * THE CARD'S OWN HYPOTHESIS — "our redirect check is gated on the move being damaging" — IS WRONG,
 * and it was worth an hour to find that out rather than to act on it. ROADMAP #362 already drew
 * single-target STATUS moves, and `tests/test-mechanics.js` has had a green Will-O-Wisp probe for it
 * since. What refused Parting Shot is `playerAction`'s ACTION KIND: a `pivotStatus` move is
 * `{kind:'switch', mv, target}` and the non-attack draw site excluded `kind==='switch'` BY NAME.
 *
 * THE AUTHORITY MAKES NO SUCH SPLIT. `Pokemon#getMoveTargets` (sim/pokemon.ts:829) runs the
 * `RedirectTarget` event in its `default:` case for every single-target move, whatever the user does
 * to itself afterwards, and Follow Me's handler (data/moves.ts, `onFoeRedirectTarget`) gates on
 * `this.validTarget(follower, source, move.target)` and nothing about category or self-switch.
 * Champions overrides none of the four files involved — checked, not recalled.
 *
 * WHAT THIS FILE ASSERTS THAT THE CENSUS ROWS DO NOT. The census rows are the ratchet; this is the
 * knob. `MEDI_PIVOT_SKIPS_REDIRECT=1` puts the excluded kind back and must make the FIRST block red
 * while leaving every other block identical — including Noble Roar, which drops the same two stats on
 * the same board and is not a pivot. Identical arms across that knob would mean the fixture is
 * measuring its own staging rather than the mechanic, which is how this repository has been wrong
 * about a redirect probe before.
 *
 * AND IT PRINTS THE MEMBERSHIP AND THE DEFECT'S OWN COUNTER, because a derived set over-matches on
 * its first try and a silent default looks exactly like a working feature.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_PIVOT_SKIPS_REDIRECT === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = 'none'; return b; };
const rng5 = () => 0.5;
const board = (a, b, c, d) => { const me = bare(a), ally = bare(b), f1 = bare(c), f2 = bare(d);
  return { me, ally, f1, f2, S: M.battleInit([me, ally], [f1, f2], { seeded: true }) }; };

console.log('\n  CARD C1 — Parting Shot and the redirectors'
  + (OFF ? '   [MEDI_PIVOT_SKIPS_REDIRECT=1]' : ''));

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS WIRED TO IT ------------------------------------ */
const pivots = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('pivotStatus') >= 0)
  .map(k => k + ' (target=' + (((TAGS.moves[k].params || {}).targetClass || {}).target || '?')
    + ', ' + TAGS.moves[k].uses + ' uses)');
const redirectors = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('redirects') >= 0);
const rods = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].tags || []).indexOf('redirectsType') >= 0);
const tracks = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].tags || []).indexOf('ignoresRedirection') >= 0);
console.log('\n  DERIVED — moves carrying `pivotStatus` (the kind the draw site refused): '
  + (pivots.join(', ') || 'NONE'));
console.log('  DERIVED — moves carrying `redirects`: ' + (redirectors.join(', ') || 'NONE'));
console.log('  DERIVED — abilities carrying `redirectsType`: ' + (rods.join(', ') || 'NONE'));
console.log('  DERIVED — abilities carrying `ignoresRedirection`: ' + (tracks.join(', ') || 'NONE') + '\n');

/* ---- THE FIXTURE ------------------------------------------------------------------------------- */
/* Garchomp is aimed at in foe slot A; Maushold in slot B puts up the redirector. Both can be dropped,
 * so the only thing that separates the arms is which of them is standing in the way. Every reading is
 * the pair of boost stages on BOTH bodies, so "the drop vanished" and "the drop moved" cannot be
 * confused — the failure this file exists to catch is a distribution, not a total. */
const shot = (moveId, redirect, userSp, ability) => {
  const { me, ally, f1, f2, S } = board(userSp || 'incineroar', 'clefable', 'garchomp', 'maushold');
  if (ability) me.ability = ability;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }],
             [f2, redirect ? M.playerAction(f2, redirect, null, S.field) : { kind: 'pass' }]]));
  return [f1.boosts.at, f1.boosts.sa, f2.boosts.at, f2.boosts.sa];
};

/* ---- 1. THE DRAW ------------------------------------------------------------------------------- */
const psOff = shot('partingshot', null), psOn = shot('partingshot', 'followme');
ok(String(psOff) === '-1,-1,0,0', 'with no redirector up, Parting Shot drops the body it named',
  '[aimed at, aimed sa, partner at, partner sa] = [' + psOff + ']');
ok(String(psOn) === '0,0,-1,-1', 'with Follow Me up, BOTH drops move onto the redirector',
  '[' + psOn + ']  — expected [0,0,-1,-1]. The drops must MOVE, not vanish and not stay.'
  + (OFF ? '  This is the arm the knob reds.' : ''));

/* ---- 2. THE CONTROL THE KNOB MAY NOT MOVE ------------------------------------------------------ */
/* Noble Roar is the same two drops on the same board with the same Follow Me up, and it is not a
 * pivot — so it was drawn before this fix and must be drawn under the knob too. If it ever agrees
 * with the Parting Shot arm on the broken engine, the fixture is measuring the staging. */
const nrOn = shot('nobleroar', 'followme');
ok(String(nrOn) === '0,0,-1,-1', 'Noble Roar — the same drops, not a pivot — is drawn on both arms',
  '[' + nrOn + ']  — this reading must be IDENTICAL with and without the knob');

/* ---- 3. THE REFUSALS, WHICH AN OVER-FIRING FIX WOULD BREAK -------------------------------------- */
/* Stalwart writes `move.tracksTarget` in `onModifyMove`, and `getMoveTargets` runs the redirect event
 * only `if (... && !move.tracksTarget)`. Stamina is Archaludon's other legal ability, so the control
 * is the same body on the same legal sheet with only the clause removed. */
const stOff = shot('partingshot', 'followme', 'archaludon', 'stamina');
const stOn = shot('partingshot', 'followme', 'archaludon', 'stalwart');
ok(String(stOff) === '0,0,-1,-1' && String(stOn) === '-1,-1,0,0',
  'Stalwart turns the draw OFF for a pivot exactly as it does for anything else',
  'Stamina user [' + stOff + ']  Stalwart user [' + stOn + ']  — equal arms mean the gate is unread');

/* Rage Powder asks `source.runStatusImmunity('powder')` before it returns its body; Follow Me asks
 * nothing. Meganium is Grass, Incineroar is not, and both use Parting Shot. */
const pwOff = shot('partingshot', 'ragepowder', 'incineroar');
const pwOn = shot('partingshot', 'ragepowder', 'meganium');
ok(String(pwOff) === '0,0,-1,-1' && String(pwOn) === '-1,-1,0,0',
  'Rage Powder does not draw a Grass-type pivot user, and Follow Me is not a powder',
  'Incineroar user [' + pwOff + ']  Meganium user [' + pwOn + ']');

/* Chilly Reception is the OTHER `pivotStatus` move and it is `target:'all'`, which never reaches the
 * redirect event in the authority either. Its weather must land with a Follow Me up and without. */
const chilly = (useFM) => {
  const { me, ally, f1, f2, S } = board('incineroar', 'clefable', 'garchomp', 'maushold');
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'chillyreception', null, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }],
             [f2, useFM ? M.playerAction(f2, 'followme', null, S.field) : { kind: 'pass' }]]));
  return S.field.weather || 'none';
};
const cOff = chilly(false), cOn = chilly(true);
ok(cOff === 'snow' && cOn === 'snow',
  'the other pivotStatus move — Chilly Reception, target `all` — is untouched by a redirector',
  'no Follow Me: ' + cOff + '   Follow Me up: ' + cOn);

/* ---- 4. THE COUNTERS, BECAUSE A CAPABILITY THAT CANNOT PROVE IT RAN IS ASSUMED BROKEN ----------- */
const seen = M.seen || {}, fails = M.fails || {};
console.log('\n  MEDSEEN.redirectedPivotStatus      ' + (seen.redirectedPivotStatus || 0));
console.log('  MEDSEEN.redirectedNonAttack        ' + (seen.redirectedNonAttack || 0));
console.log('  MEDFAILS.pivotSkipsRedirectRestored ' + (fails.pivotSkipsRedirectRestored || 0));
if (OFF) {
  ok((fails.pivotSkipsRedirectRestored || 0) > 0,
    'under the knob the defect counter is non-zero — the knob is wired to the site',
    'pivotSkipsRedirectRestored = ' + (fails.pivotSkipsRedirectRestored || 0));
  ok((seen.redirectedPivotStatus || 0) === 0,
    'and no pivot was drawn under the knob',
    'redirectedPivotStatus = ' + (seen.redirectedPivotStatus || 0));
} else {
  ok((seen.redirectedPivotStatus || 0) > 0,
    'the new branch proves it ran — a zero here is an unwired fix, not a quiet board',
    'redirectedPivotStatus = ' + (seen.redirectedPivotStatus || 0));
  ok((fails.pivotSkipsRedirectRestored || 0) === 0,
    'and the shipping engine carries no deliberate break',
    'pivotSkipsRedirectRestored = ' + (fails.pivotSkipsRedirectRestored || 0));
}

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed')
  + (OFF ? '   (under the knob, blocks 1 and the counter block are EXPECTED to fail)' : '') + '\n');
process.exit(OFF ? 0 : (bad ? 1 : 0));
