#!/usr/bin/env node
/* tests/probe_choicelock_cleared.js — M4, THE CHOICE LOCK THAT IS NEVER CLEARED
 * ==================================================================================================
 * DOES THE `choicelock` VOLATILE GO WHEN THE AUTHORITY SAYS IT GOES?
 *
 * THE AUTHORITY, `data/conditions.ts:349-353`, read in full. Champions carries NO `choicelock` row —
 * §0 greps `data/mods/champions/conditions.ts` on every run rather than trusting this sentence:
 *
 *     onDisableMove(pokemon) {
 *       if (!pokemon.getItem().isChoice || !pokemon.hasMove(this.effectState.move)) {
 *         pokemon.removeVolatile('choicelock');
 *         return;
 *       }
 *       if (pokemon.ignoringItem() || pokemon.volatiles['dynamax']) return;
 *       for (const moveSlot of pokemon.moveSlots) { ... disableMove ... }
 *     }
 *
 * `DisableMove` is raised from `Pokemon#getMoveRequestData`, so this runs once per body EVERY TIME A
 * MOVE REQUEST IS BUILT — the foot of every turn. Two removal conditions, and this engine had neither
 * on that schedule: the item test lived in `lockStillBinds` (lazy, runs when something asks the menu)
 * and the `hasMove` test destroyed nothing at all, it only hid the lock from `lockMenuMove`.
 *
 * ONLY CHOICE SCARF IS LEGAL HERE. Band and Specs are `isNonstandard: 'Past'` in Champions, so this is
 * ONE item — asserted in §0 off the format rather than remembered.
 *
 * THE THREE BOARDS. Verdicts come from `engine/board_state.js` against the authority's own board;
 * nothing here declares an expected value.
 *
 *   1. scarf-knocked-off      the item goes. `!getItem().isChoice` -> the volatile goes with it.
 *   2. scarf-locked-into-transform   Transform rewrites `moveSlots`, so `hasMove('transform')` is
 *                             false at the next request and the volatile goes. This is the clause
 *                             that destroyed nothing before this pass, and it is game 9 of the 77.
 *   3. scarf-keeps-its-lock   THE CONTROL. Item held, move still carried: the lock must STAND, and
 *                             must name the SAME move on both engines. Without it a probe that
 *                             cleared every lock unconditionally would pass 1 and 2 and be worse than
 *                             the bug.
 *
 * RED-FIRST KNOB: `MEDI_NO_CHOICELOCK_REQUEST_SWEEP=1` restores the lazy-only engine. Under it 1 and
 * 2 go RED and 3 stays green.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_NO_CHOICELOCK_REQUEST_SWEEP === '1';
console.log('\ntests/probe_choicelock_cleared.js — M4 the choice lock is not cleared');
console.log('  MEDI_NO_CHOICELOCK_REQUEST_SWEEP=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE ITEM SET AND THE AUTHORITY, BOTH DERIVED ------------------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;
const CHOICE = D.items.all().filter(i => i.isChoice).map(i => ({ id: i.id, legal: legal(i) }));
console.log('\n0. EVERY `isChoice` ITEM IN THE DEX, AND WHETHER THIS REGULATION ALLOWS IT');
for (const c of CHOICE) console.log('     ' + (c.legal ? 'LEGAL  ' : 'banned ') + c.id);
const legalChoice = CHOICE.filter(c => c.legal).map(c => c.id);
ok(legalChoice.length === 1 && legalChoice[0] === 'choicescarf',
   'exactly one Choice item is legal here, and it is the one this fixture holds',
   'legal: ' + (legalChoice.join(', ') || '(none)'));
const CH = fs.readFileSync(process.env.SHOWDOWN_PATH + '/data/mods/champions/conditions.ts', 'utf8');
ok(!/choicelock/.test(CH),
   'Champions does not override the `choicelock` condition, so `data/conditions.ts` IS the authority',
   /choicelock/.test(CH) ? 'the mod DOES carry a choicelock row — read it, not mainline' : null);
/* AND THE MOVE THAT REWRITES `moveSlots` IS DERIVED, because scenario 2 rests on it. */
const TRF = D.moves.all().filter(m => legal(m) && /transform/.test(m.id));
ok(TRF.length === 1 && TRF[0].id === 'transform',
   'Transform is legal here — it is what makes `!pokemon.hasMove(...)` reachable',
   'matched: ' + TRF.map(m => m.id).join(', '));

/* ==================================================================================================
 * THE THREE BOARDS
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

const SCEN = [
  { id: 'scarf-knocked-off-drops-the-lock',
    kind: 'item', shape: 'choicelock removed with the item',
    census: 'item/choiceLock — data/conditions.ts:350 `!pokemon.getItem().isChoice`',
    what: 'Weavile holds a Choice Scarf and clicks Ice Shard on turn 1, which arms the lock. On turn '
        + '2 Incineroar Knocks the Scarf off. `onDisableMove` runs when the turn-3 request is built '
        + 'and `getItem().isChoice` is now false, so the authority carries NO lock into turn 3.',
    negative: 'turn 1 is the negative and it is on the same board — the lock must be ARMED there, or '
            + 'this scenario passes on an engine that never locks anything.',
    A: [mon('incineroar', '', 'Intimidate', ['Knock Off', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'toxapex')),
    B: [mon('weavile', 'choicescarf', 'Pressure', ['Ice Shard', 'Swords Dance', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('garchomp', 'corviknight')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'iceshard', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'knockoff', t: 0 }, { m: 'protect' }], p2: [{ m: 'iceshard', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'iceshard', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'scarf-locked-into-transform-drops-the-lock',
    kind: 'item', shape: 'choicelock removed because the MOVE has gone',
    census: 'item/choiceLock — data/conditions.ts:350 `!pokemon.hasMove(this.effectState.move)`',
    what: 'Ditto holds a Choice Scarf and clicks Transform, which locks it into `transform` AND '
        + 'replaces its `moveSlots` with the target\'s. At the next request `hasMove(\'transform\')` '
        + 'is false, so the authority removes the volatile. This engine kept it — the body was then '
        + 'bound to a move it does not carry, which is game 9 of the board-material 77.',
    negative: 'scenario 3 below is this one\'s negative: the same item, the same arming click, and a '
            + 'move the body still HAS, where the lock must survive.',
    A: [mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'toxapex')),
    B: [mon('ditto', 'choicescarf', 'Limber', ['Transform']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('weavile', 'corviknight')),
    script: [
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'transform', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ] },

  { id: 'scarf-keeps-its-lock',
    kind: 'item', shape: 'THE CONTROL — the lock must STAND and must name the same move',
    census: 'item/choiceLock — the standing case',
    what: 'THE CONTROL. Weavile holds its Scarf all game and keeps clicking Ice Shard. Nothing '
        + 'removes the item and the move is still in its slots, so `onDisableMove` falls through to '
        + 'the disable loop and the volatile STANDS on both engines, naming `iceshard`.',
    negative: 'this scenario IS the negative for the two above. An engine that cleared the lock on '
            + 'every request would pass both of them and fail here, and a comparator that could not '
            + 'see the leaf at all would pass all three — which is why the leaf is asserted non-empty '
            + 'in §2 as well as compared.',
    A: [mon('incineroar', '', 'Intimidate', ['Swords Dance', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('milotic', 'toxapex')),
    B: [mon('weavile', 'choicescarf', 'Pressure', ['Ice Shard', 'Swords Dance', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('garchomp', 'corviknight')),
    script: [
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'iceshard', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'iceshard', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'swordsdance' }, { m: 'protect' }], p2: [{ m: 'iceshard', t: 0 }, { m: 'protect' }] },
    ] },
];

console.log('\n1. THE THREE BOARDS, PLAYED AGAINST THE AUTHORITY');
for (const sc of SCEN) {
  const r = SB.runOne(sc);
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us)
                  + ' / authority ' + JSON.stringify(d.sd)).join('\n')).filter(Boolean).join('\n'));
  const gov = sc.id === 'scarf-keeps-its-lock' ? false : KNOB;
  ok(r.verdict === 'IDENTICAL', sc.id + '  -> ' + r.verdict
     + (gov ? '   [expected RED: the knob is armed]' : ''), detail);
  console.log('          leaves compared ' + (r.compared == null ? '(not staged)' : r.compared));
}

/* ==================================================================================================
 * 2. THE CONTROL IS NOT VACUOUS — the leaf has to be NON-EMPTY somewhere, or all three agreed on ''
 * ==================================================================================================
 * "Both engines report no lock" is exactly what two engines with no choice lock at all look like.
 * This replays the control and reads the authority's OWN `volatiles.choicelock.move` off its battle
 * object, so the assertion is over the authority's state and not over anything this file computed. */
console.log('\n2. THE AUTHORITY ACTUALLY HELD A LOCK ON THE CONTROL BOARD');
const G = SB.harness();
const CTRL = SCEN[SCEN.length - 1];
const a = G.buildPair(CTRL.A), b = G.buildPair(CTRL.B);
let sdLock = null;
const cr = G.playGame(a, b, 'directed', 'm4-choicelock-control', {
  script: CTRL.script,
  onBoundary: (snap) => {
    /* `board_state`'s own authority-side reader is what the comparator uses; reading the same leaf
     * here keeps this file from growing a second reader of the same fact. */
    try { const s = snap.sd.sides.p2.active[0]; if (s && s.vol && s.vol.choicelock) sdLock = s.vol.choicelock; }
    catch (e) { console.log('          (could not read the authority leaf: ' + e.message + ')'); }
  } });
ok(!cr.err, 'the control replay did not throw', cr.err || null);
ok(sdLock === 'iceshard', 'the authority\'s own board carries `choicelock = iceshard` on the control',
   'read ' + JSON.stringify(sdLock) + ' — if this is empty the leaf is never populated and every '
   + '"IDENTICAL" above is two engines agreeing about nothing');

/* ==================================================================================================
 * 3. THE ENGINE'S OWN RECEIPTS
 * ================================================================================================== */
console.log('\n3. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M.MEDSEEN, F = M.MEDFAILS;
if (S && F) {
  console.log('     choiceLockClearedAtRequest ' + S.choiceLockClearedAtRequest
    + ' (' + (S.choiceLockClearedAtRequestFirst || '-') + ')'
    + '   choiceLockDroppedNoMove ' + S.choiceLockDroppedNoMove
    + ' (' + (S.choiceLockDroppedNoMoveFirst || '-') + ')');
  console.log('     choiceLockDroppedWithItem ' + S.choiceLockDroppedWithItem
    + '   choiceLockSuspendedWhileIgnored ' + S.choiceLockSuspendedWhileIgnored
    + '   choiceLockSweepSuppressed ' + F.choiceLockSweepSuppressed);
  ok(KNOB ? F.choiceLockSweepSuppressed === 1 : F.choiceLockSweepSuppressed === 0,
     'the restore knob reports its own state',
     'choiceLockSweepSuppressed=' + F.choiceLockSweepSuppressed);
  ok(KNOB || S.choiceLockClearedAtRequest > 0,
     'the sweep actually destroyed a lock at a request boundary',
     'choiceLockClearedAtRequest=' + S.choiceLockClearedAtRequest + ' — a zero with a Knocked-Off '
     + 'Scarf staged means the sweep is not on the turn path');
  ok(KNOB || S.choiceLockDroppedNoMove > 0,
     'the `hasMove` clause fired — it destroyed NOTHING before this pass',
     'choiceLockDroppedNoMove=' + S.choiceLockDroppedNoMove);
} else {
  ok(false, 'MEDSEEN / MEDFAILS are readable off the frozen engine', 'the release does not export them');
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
