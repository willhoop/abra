#!/usr/bin/env node
/* tests/test-middle-draw-scope.js — THE MIDDLE ARM'S DICE BELONG TO ONE GAME
 * ==================================================================================================
 * DOES THE SAME STAGED GAME, PLAYED TWICE IN A ROW, PLAY OUT THE SAME WAY?
 *
 * It did not, and the reason is the whole content of this file.
 *
 * The middle arm's die is an ADDRESS, not a sequence (ROADMAP #262):
 *
 *     value = FNV1a(seed | turn | category | move id | target slot | nth) -> [0,1)
 *
 * `nth` is the repeat index — which draw this is at an address already used this game — and it is a
 * FIELD OF THE HASH, so it decides the VALUE and not merely the bookkeeping. Both engines must
 * therefore start every game with an empty repeat map or they are not rolling the same die.
 *
 * medicham2 does: `midEventDice()` clears `MID_NTH` and `MID_LOG` and is called once per game out of
 * `ARM.mediRng()`. The authority's two equivalents — `MID_NTH` in the driver and `MID_CTX_SEEN.sd` —
 * were cleared by the VOID CHECK instead, which runs once per PAIR, after BOTH the stones-removed
 * control game and the measured one. So every address the control game touched was left sitting at
 * nth=1,2,3..., the measured game's authority draws continued from there, and medicham2 started at 0.
 *
 * WHAT IT COST, MEASURED on 260 games (release 978ca8fe72c9, census and team pool pinned):
 *
 *     846 of 878 unshared addresses differed in `nth` AND IN NOTHING ELSE
 *     void (instrument desync)          147 -> 17
 *     games whose shared addresses agree  4 -> 134
 *
 * That is the same shape as ROADMAP #220 and it is bigger: #220 mis-addressed the authority's draws
 * that were made outside three `BattleActions` methods, this mis-addressed EVERY authority draw in
 * every game that had a control game in front of it, which is every measured game in the run.
 *
 * THE ASSERTION IS AN OUTCOME, NOT A CLASSIFICATION. A deterministic instrument, handed the same
 * fixture twice, must produce the same trace. Nothing here reads a rate, and nothing here decides
 * whether either engine plays Pokemon correctly — that is tests/test-mechanics.js's question.
 *
 * THE DELIBERATE BREAK IS REACHABLE: `--mid-carry-nth` restores the leak. This file re-runs ITSELF
 * with that flag and FAILS IF THE BROKEN ARM PASSES, because a control that cannot fail proves
 * nothing.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

/* the differential sizes its steering pool from `--games` AT REQUIRE TIME; this file plays staged
 * games and needs no pool, so keep it small and say so rather than inheriting a 1,200-team read. */
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const BROKEN_ARM = process.argv.includes('--mid-carry-nth');

const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const mon = (species, moves) => ({ species, item: '', ability: '', moves });

/* ---- THE FIXTURE --------------------------------------------------------------------------------
 * EVERY MOVE HERE WAS DERIVED, NOT RECALLED. `Dex.forFormat('gen9championsvgc2026regmb')`, the
 * species' own learnset, filtered to `!isNonstandard && category !== 'Status' && accuracy < 100 &&
 * secondaries.length`:
 *     incineroar  heatwave/acc90/sec10       garchomp  rockslide/acc90/sec30
 * Both are SPREAD moves, which is what makes the fixture stage a repeat: one click draws `acc` at two
 * different target slots and `dmg`+`crit` at each, so the `nth` index moves within a turn as well as
 * across the two games. A single-target 100-accuracy move would draw almost nothing and this file
 * would be green on an empty sample. */
const A = [mon('incineroar', ['Heat Wave', 'Protect']), mon('milotic', ['Recover', 'Protect']),
           mon('clefable', ['Protect']), mon('snorlax', ['Protect'])];
const B = [mon('garchomp', ['Rock Slide', 'Protect']), mon('corviknight', ['Iron Defense', 'Protect']),
           mon('toxapex', ['Protect']), mon('weavile', ['Protect'])];   /* buildPair keeps FOUR bodies or returns null */
const SCRIPT = [
  { p1: [{ m: 'heatwave' }, { m: 'recover' }], p2: [{ m: 'rockslide' }, { m: 'irondefense' }] },
  { p1: [{ m: 'heatwave' }, { m: 'recover' }], p2: [{ m: 'rockslide' }, { m: 'irondefense' }] },
];

const MIDDLE = GD.ARM_BY_ID.get('middle');

console.log('\ntests/test-middle-draw-scope.js — the middle arm\'s dice belong to ONE game');
console.log('  release ' + GD.REL.id + '   arm ' + (MIDDLE && MIDDLE.id)
  + (BROKEN_ARM ? '   *** --mid-carry-nth: THE LEAK IS RESTORED, this arm is EXPECTED to fail ***' : ''));

if (!MIDDLE) { console.log('  FAIL  the `middle` arm is gone from game_differential — refusing to guess'); process.exit(1); }

const a1 = GD.buildPair(A), b1 = GD.buildPair(B);
if (!a1 || !b1) { console.log('  FAIL  buildPair returned null — the fixture never ran, which is not a pass'); process.exit(1); }

/* GAME ONE. Fresh bodies per game, because a body carried over would differ in HP and the second game
 * would not be the same game for a reason that has nothing to do with the dice. */
GD.midResetAddresses();
const r1 = GD.playGame(a1, b1, 'directed', 'draw-scope', { script: SCRIPT, arm: MIDDLE });
const ad1 = GD.midAddresses();

/* GAME TWO — identical inputs. Under the fix this is the same game; under the leak the authority's
 * repeat map still holds game one's counts and every address it re-uses lands one higher. */
const a2 = GD.buildPair(A), b2 = GD.buildPair(B);
GD.midResetAddresses();
const r2 = GD.playGame(a2, b2, 'directed', 'draw-scope', { script: SCRIPT, arm: MIDDLE });
const ad2 = GD.midAddresses();

console.log('\n1. THE FIXTURE ACTUALLY RAN, AND IT ACTUALLY ROLLED');
ok(!r1.err && !r2.err, 'neither staged game threw', (r1.err || '') + ' ' + (r2.err || ''));
/* NOT `turns === SCRIPT.length`. In protocol mode the game stops at the FIRST divergent line, and
 * this fixture parts inside turn one — as most games in this swarm do. One completed turn with real
 * outcome draws in it is what this file needs; demanding two would make the clause a statement about
 * how well the engine agrees, which is a different instrument's question. */
ok(r1.turns >= 1, 'game one completed at least one turn  (' + r1.turns + ' of ' + SCRIPT.length + ' scripted)',
   'a game that ends before turn one stages nothing');
const OUT = /\|(acc|crit|dmg|sec)\|/;
const sd1 = ad1.sd.filter(s => OUT.test(s)), me1 = ad1.me.filter(s => OUT.test(s));
ok(sd1.length > 0 && me1.length > 0,
   'both engines drew outcome dice in game one  (authority ' + sd1.length + ', medicham2 ' + me1.length + ')',
   'a run with no outcome draws cannot show a repeat-index leak and would pass this file vacuously');
/* THE POSITIVE CONTROL FOR CLAUSE 2: the second game must ASK THE SAME QUESTIONS. If the two runs
 * drew different numbers of dice for reasons of their own, an equal address log would be a
 * coincidence and an unequal one would not name the leak. */
ok(ad1.sd.length === ad2.sd.length,
   'both games made the same NUMBER of authority draws  (' + ad1.sd.length + ' / ' + ad2.sd.length + ')',
   'the two runs are not the same game, so nothing below is about the repeat index');
const repeats = sd1.filter(s => !/\|0$/.test(s)).length;
console.log('        (game one made ' + repeats + ' authority draw(s) at nth>0 within the game itself)');

console.log('\n2. THE SAME GAME, PLAYED TWICE, IS THE SAME GAME — the authority side');
const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
const firstDiff = (x, y) => { for (let i = 0; i < Math.max(x.length, y.length); i++)
  if (x[i] !== y[i]) return 'first difference at draw ' + i + ':\n  game 1  ' + x[i] + '\n  game 2  ' + y[i];
  return ''; };
ok(same(ad1.sd, ad2.sd), 'the authority computed the SAME addresses in both games',
   same(ad1.sd, ad2.sd) ? null
   : firstDiff(ad1.sd, ad2.sd) + '\nThe repeat index survived the game boundary. `nth` is hashed, so '
   + 'these are DIFFERENT VALUES for the same event — the authority is rolling dice medicham2 never '
   + 'addresses, all game.');

console.log('\n3. THE CONTROL — medicham2 already resets per game, so the asymmetry is the authority\'s');
ok(same(ad1.me, ad2.me), 'medicham2 computed the SAME addresses in both games',
   same(ad1.me, ad2.me) ? null : firstDiff(ad1.me, ad2.me)
   + '\nIf THIS is red the fault is in midEventDice, not in the driver, and clause 2 above means '
   + 'nothing until it is fixed.');

console.log('\n4. AND THE OUTCOME IS THE SAME OUTCOME');
ok(r1.turns === r2.turns, 'both games lasted the same number of turns  (' + r1.turns + ' / ' + r2.turns + ')');
ok(!!r1.div === !!r2.div && (!r1.div || r1.div.index === r2.div.index),
   'both games diverged at the same place  (' + (r1.div ? 'line ' + r1.div.index : 'no divergence')
   + ' / ' + (r2.div ? 'line ' + r2.div.index : 'no divergence') + ')',
   'the same fixture reaching two different verdicts is the instrument moving under the measurement');
ok(same(r1.mediTrace || [], r2.mediTrace || []),
   'both games produced an identical medicham2 trace  (' + (r1.mediTrace || []).length + ' lines)',
   same(r1.mediTrace || [], r2.mediTrace || []) ? null : firstDiff(r1.mediTrace || [], r2.mediTrace || []));

console.log('\n5. NO DRAW IS ADDRESSED WITHOUT A BATTLE IN SCOPE  (ROADMAP #220, kept as a ratchet)');
ok(ad2.no_battle === 0, 'every authority draw had the battle in scope',
   ad2.no_battle + ' draws were addressed `<seed>|0|any|-|-|<nth>` — a global sequence, not an address');

/* ==================================================================================================
 * 6. THE DELIBERATE BREAK. Everything above is green on the current tree; a green test says nothing
 * until the broken arm is shown to be red. `--mid-carry-nth` restores the pre-2026-08-18 behaviour in
 * `playGame` and nothing else, and this child is REQUIRED to fail.
 * ================================================================================================ */
if (!BROKEN_ARM) {
  console.log('\n6. THE BROKEN ARM MUST BREAK  (re-running this file with --mid-carry-nth)');
  const child = spawnSync(process.execPath, [__filename, '--mid-carry-nth'],
    { encoding: 'utf8', env: process.env, cwd: ROOT });
  const out = String(child.stdout || '') + String(child.stderr || '');
  const failedClauses = (out.match(/^  FAIL/gm) || []).length;
  ok(child.status !== 0 && failedClauses > 0,
     'with the leak restored, this file FAILS  (' + failedClauses + ' clause(s) red, exit ' + child.status + ')',
     child.status === 0 ? 'THE DELIBERATE BREAK DID NOT BREAK. Either --mid-carry-nth no longer '
       + 'restores the leak, or the fixture stopped repeating an address — either way every green '
       + 'line above is unproven.\n' + out.split('\n').slice(-25).join('\n') : null);
}

console.log('');
if (bad) { console.log('  ' + bad + ' clause(s) RED'); process.exit(1); }
console.log('  all clauses green');
