#!/usr/bin/env node
/* tests/test-middle-damage-roll.js — THE SHARED DAMAGE DIE WAS READ BACKWARDS ON ONE SIDE
 * ==================================================================================================
 * DOES THE MIDDLE ARM HAND SHOWDOWN THE DAMAGE INDEX ITS OWN PINNED ARMS SAY IT SHOULD?
 *
 * The two engines express the damage roll in opposite directions:
 *
 *   Showdown   `random(16)` is an INDEX i, and `randomizer` is `tr(tr(d*(100-i))/100)`
 *              — so i=0 is the MAXIMUM and i=15 the MINIMUM.
 *   medicham2  `dmg = d.min + floor(u * (d.max - d.min + 1))`  (medicham2-browser.js:18336)
 *              — a POSITION in its own span, INCREASING in u.
 *
 * `game_differential.js`'s PINNED arms already encode that correspondence, and they are the authority
 * this file reads it from rather than typing it:
 *
 *     top-tie-first      corner: CORNER_TOP     (medicham2's maximum)   damageIndex: 0   (Showdown's maximum)
 *     bottom-tie-first   corner: CORNER_BOTTOM  (medicham2's minimum)   damageIndex: 15  (Showdown's minimum)
 *
 * THE MIDDLE ARM DID NOT. It handed Showdown `Math.floor(u * 16)` — at u~1, index 15, the MINIMUM,
 * from the same draw that gives medicham2 its MAXIMUM. A shared die read backwards on one side is an
 * ANTI-CORRELATED die, which is worse than two independent ones.
 *
 * WHAT IT COST, MEASURED (release 978ca8fe72c9, 969 games, all three arms in one run):
 *
 *     -damage field 3   226 of 491 diverging games in `middle`   <- the largest class in the run
 *                         2 of 155 in `top-tie-first`
 *                         0 of 183 in `bottom-tie-first`
 *
 * A damage defect in the ENGINE cannot hide from both corners. `tests/test-engine-diff.js` reports 0
 * of 6000 at each corner and is structurally blind to this, because a corner is exactly where the two
 * conventions coincide.
 *
 * WHAT THIS FILE CANNOT SEE: whether the interior damage VALUES are right once the index is. They are
 * not identical — medicham2 draws a position in an integer span and Showdown floors each of 16
 * indices separately, so on one staged hit medicham2 can produce 20 distinct values where Showdown
 * produces 14 (`damage_interior` in the artifact). That is a separate, smaller, real defect and it is
 * on the ENGINE hand list, not fixed here and not hidden by this fix.
 *
 * THE DELIBERATE BREAK IS REACHABLE: `--mid-damage-uninverted`. This file re-runs ITSELF with it and
 * FAILS IF THE BROKEN ARM PASSES.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
const BROKEN_ARM = process.argv.includes('--mid-damage-uninverted');

const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

console.log('\ntests/test-middle-damage-roll.js — the shared damage die, read the same way on both sides');
console.log('  release ' + GD.REL.id
  + (BROKEN_ARM ? '   *** --mid-damage-uninverted: THE BACKWARDS INDEX IS RESTORED, this arm is EXPECTED to fail ***' : ''));

const SIDES = GD.DAMAGE_ROLL_SIDES;
const armsById = GD.ARM_BY_ID;
const top = [...armsById.values()].find(a => a.corner === GD.CORNER_TOP);
const bot = [...armsById.values()].find(a => a.corner === GD.CORNER_BOTTOM && !a.middle);
const MIDDLE = armsById.get('middle');

console.log('\n1. THE PINNED ARMS STILL DECLARE THE CORRESPONDENCE THIS FILE READS');
ok(!!top && !!bot && !!MIDDLE, 'a CORNER_TOP arm, a CORNER_BOTTOM arm and the middle arm all exist',
   'without both corners there is nothing to derive the mapping FROM, and a number typed here would '
   + 'be exactly the "value from memory" this repo bans');
if (!top || !bot || !MIDDLE) { console.log('\n  refusing to guess'); process.exit(1); }
ok(top.damageIndex === 0 && bot.damageIndex === SIDES - 1,
   'the declarations are unchanged  (top corner -> index ' + top.damageIndex
   + ', bottom corner -> index ' + bot.damageIndex + ')',
   'if these move, the mapping below must be re-derived rather than kept');

console.log('\n2. THE MIDDLE ARM MAPS medicham2\'s ROLL POSITION ONTO THE SAME INDEX');
const f = GD.midDamageIndex;
ok(f(GD.CORNER_TOP) === top.damageIndex,
   'medicham2 at its MAXIMUM (u=' + GD.CORNER_TOP.toFixed(9) + ') pairs with Showdown index '
   + top.damageIndex + '  (got ' + f(GD.CORNER_TOP) + ')',
   f(GD.CORNER_TOP) === top.damageIndex ? null
   : 'The middle arm gives medicham2 its MAXIMUM damage and Showdown index ' + f(GD.CORNER_TOP)
   + ', which is its ' + (f(GD.CORNER_TOP) === SIDES - 1 ? 'MINIMUM' : 'index ' + f(GD.CORNER_TOP))
   + '. The two engines are reading the same die in opposite directions.');
ok(f(GD.CORNER_BOTTOM) === bot.damageIndex,
   'medicham2 at its MINIMUM (u=0) pairs with Showdown index ' + bot.damageIndex
   + '  (got ' + f(GD.CORNER_BOTTOM) + ')');

let mono = true, seen = new Set();
for (let i = 0; i < SIDES; i++) { const u = (i + 0.5) / SIDES; const v = f(u); seen.add(v);
  if (i && v > f((i - 0.5) / SIDES)) mono = false; }
ok(mono, 'the mapping is monotone the way the corners require (u up -> index down)');
ok(seen.size === SIDES, 'every one of the ' + SIDES + ' indices is reachable  (' + seen.size + ' distinct)',
   'a mapping that cannot produce an index cannot produce the damage value behind it');

/* ==================================================================================================
 * 3. AND IT FIRES ON A REAL HIT. A fix that never runs looks exactly like a fix that works — this
 * project's founding lesson — so the counter is read off a staged game rather than assumed.
 * ============================================================================================== */
const mon = (species, moves) => ({ species, item: '', ability: '', moves });
/* DERIVED, NOT RECALLED: `Dex.forFormat('gen9championsvgc2026regmb')` + the species' own learnset.
 * Heat Wave (acc 90, sec 10) and Rock Slide (acc 90, sec 30) are both damaging and both spread, so
 * the fixture reaches `getDamage` several times in one turn. */
const A = [mon('incineroar', ['Heat Wave', 'Protect']), mon('milotic', ['Recover', 'Protect']),
           mon('clefable', ['Protect']), mon('snorlax', ['Protect'])];
const B = [mon('garchomp', ['Rock Slide', 'Protect']), mon('corviknight', ['Iron Defense', 'Protect']),
           mon('toxapex', ['Protect']), mon('weavile', ['Protect'])];
const SCRIPT = [{ p1: [{ m: 'heatwave' }, { m: 'recover' }], p2: [{ m: 'rockslide' }, { m: 'irondefense' }] }];

console.log('\n3. THE INVERSION ACTUALLY RUNS ON A REAL DAMAGE ROLL');
const a = GD.buildPair(A), b = GD.buildPair(B);
if (!a || !b) { console.log('  FAIL  buildPair returned null — the fixture never ran, which is not a pass'); process.exit(1); }
const before = GD.midDamageFlips();
const r = GD.playGame(a, b, 'directed', 'damage-roll', { script: SCRIPT, arm: MIDDLE });
const fired = GD.midDamageFlips() - before;
ok(!r.err, 'the staged game did not throw', r.err || null);
ok(fired > 0, 'the damage-index inversion fired  (' + fired + ' draw(s))',
   'ZERO. Either the wrapper stopped setting MID_CAT around getDamage, or no damage roll was reached '
   + '— and a branch that never runs cannot be what fixed anything.');

/* ================================================================================================ */
if (!BROKEN_ARM) {
  console.log('\n4. THE BROKEN ARM MUST BREAK  (re-running this file with --mid-damage-uninverted)');
  const child = spawnSync(process.execPath, [__filename, '--mid-damage-uninverted'],
    { encoding: 'utf8', env: process.env, cwd: ROOT });
  const out = String(child.stdout || '') + String(child.stderr || '');
  const failed = (out.match(/^  FAIL/gm) || []).length;
  ok(child.status !== 0 && failed > 0,
     'with the backwards index restored, this file FAILS  (' + failed + ' clause(s) red, exit ' + child.status + ')',
     child.status === 0 ? 'THE DELIBERATE BREAK DID NOT BREAK — every green line above is unproven.\n'
       + out.split('\n').slice(-20).join('\n') : null);
}

console.log('');
if (bad) { console.log('  ' + bad + ' clause(s) RED'); process.exit(1); }
console.log('  all clauses green');
