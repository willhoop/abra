#!/usr/bin/env node
/* tests/test-middle-stall-address.js — ROADMAP #220
 * ==================================================================================================
 * DO THE TWO ENGINES ADDRESS THE CONSECUTIVE-PROTECT DIE TO THE SAME EVENT?
 *
 * WHY THIS FILE EXISTS, AND WHY `tests/test-middle-identity.js` COULD NOT ANSWER IT.
 *
 * The `-fail` vs `-singleturn|protect` family is the LARGEST single family in the whole-game
 * differential — re-measured 2026-08-18 at **240 of 703 diverging games**, 94,313 corpus clicks, the
 * most-played move in the format. ROADMAP #220 was closed once on a wrong explanation, reopened, and
 * two further explanations were killed by measurement: the stall counter's coupling to the scalar pin
 * (#222 — the authority pins to refuse at the same corner, so both engines refuse and AGREE), and the
 * counter's VALUE and reset rules (measured condition by condition, ours matches on all three).
 *
 * THE CONTROL THAT NAMES THE CAUSE IS THE ARM. Measured over a complete population — every diverging
 * game in both pinned arms, 185/185 and 203/203 — the family is **ZERO in `top-tie-first` and ZERO in
 * `bottom-tie-first`, and 240 in `middle`.** A pin does not change `willAct()`, which is deterministic
 * bookkeeping over the turn queue; a mechanic defect in the shield gate would show at every corner. A
 * disagreement that exists ONLY where the die is a real draw is a disagreement about the DIE.
 *
 * AND THE DIE IS AN ADDRESS. `engine/game_differential.js`'s middle arm gives both engines
 *
 *     value = FNV1a(seed | turn | category | move id | target slot | nth) -> [0,1)
 *
 * so a shared event yields a shared value and nothing is consumed. That rests on ONE claim: the two
 * sides must compute the SAME STRING. medicham2 builds `<seed>|<turn>|any|protect|<slot>|0` for the
 * stall check (staged in test-middle-identity §1b). The authority's builder reads its five fields off
 * `MID_BATTLE`, which `midWrapShowdown` sets INSIDE three `BattleActions` methods — `hitStepAccuracy`,
 * `secondaries`, `getDamage` — and nowhere else. `protect.onPrepareHit` runs in `useMoveInner`, above
 * all three, so the stall draw was made with **no battle in scope** and addressed `<seed>|0|any|-|-|n`
 * — a global sequence wearing an address, which can never equal what medicham2 computed.
 *
 * WHAT THAT COSTS, ARITHMETICALLY. Two independent coins on a 1/3 event disagree 4/9 of the time. And
 * because OUR side is a pure hash, our answer at one (turn, slot) is the same in every game: turn 2
 * gives 0.3033 at p1a and 0.3099 at p2b (both < 1/3, so we always succeed) against 0.8716 at p1b and
 * 0.3782 at p2a (both fail). The measured family splits 129 p1a / 92 p2b in the we-allow direction and
 * 4 p1b / 4 p2a in the we-refuse direction. The fingerprint is the mechanism, not a coincidence.
 *
 * SO THIS FILE READS THE STRINGS. `test-middle-identity.js` measures a RATE, from its own hook, over
 * whatever draws real games happen to make — and it explicitly refuses `any*` a floor because that
 * bucket is too small and too fixture-dependent (25 authority draws over 900 games). A rate over 25
 * events cannot say "the Protect die is unwired". One staged turn, two strings, can.
 *
 * WHAT IT CANNOT SEE: whether either engine plays Protect CORRECTLY. It compares the NAME of the
 * event, exactly as its sibling does. The mechanic itself is tests/test-mechanics.js's.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* the differential sizes its steering pool from `--games` AT REQUIRE TIME; this file plays staged
 * games and needs no pool, so keep it small and say so rather than inheriting a 1,200-team read. */
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const mon = (species, moves) => ({ species, item: '', ability: '', moves });

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * ONE body clicks Protect on two consecutive turns and the other three do not, for two reasons that
 * are both load-bearing:
 *
 *   the SECOND Protect is the only one that draws a die at all. The first has no `stall` volatile, so
 *   the authority's `runEvent('StallMove')` finds no handler and returns true without rolling, and
 *   medicham2 short-circuits at `_ctr <= 1`. A one-turn fixture stages nothing.
 *
 *   the shield must NOT hold the last action of the turn, or `willAct()` refuses it and the `&&`
 *   short-circuits ABOVE the roll — the draw never happens and this file would report a missing
 *   address as if the wiring were broken. Protect is +4 and Swords Dance is +0, so the shield is
 *   first in the queue with three actions behind it.
 */
const A = [mon('incineroar', ['Protect', 'Swords Dance']), mon('milotic', ['Recover', 'Protect']),
           mon('clefable', ['Protect']), mon('snorlax', ['Protect'])];
const B = [mon('garchomp', ['Swords Dance', 'Protect']), mon('corviknight', ['Iron Defense', 'Protect']),
           mon('toxapex', ['Protect']), mon('weavile', ['Swords Dance', 'Protect'])];
const SCRIPT = [
  { p1: [{ m: 'protect' }, { m: 'recover' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
  { p1: [{ m: 'protect' }, { m: 'recover' }], p2: [{ m: 'swordsdance' }, { m: 'irondefense' }] },
];

const MIDDLE = GD.ARM_BY_ID.get('middle');

console.log('\ntests/test-middle-stall-address.js — ROADMAP #220');
console.log('  release ' + GD.REL.id + '   arm ' + (MIDDLE && MIDDLE.id));

if (!MIDDLE) { console.log('  FAIL  the `middle` arm is gone from game_differential — refusing to guess'); process.exit(1); }

const a = GD.buildPair(A), b = GD.buildPair(B);
if (!a || !b) { console.log('  FAIL  buildPair returned null — the fixture never ran, which is not a pass'); process.exit(1); }

GD.midResetAddresses();
const r = GD.playGame(a, b, 'directed', 'r220-stall-address', { script: SCRIPT, arm: MIDDLE });
const addr = GD.midAddresses();

console.log('\n1. THE FIXTURE ACTUALLY RAN');
ok(!r.err, 'the staged game did not throw', r.err || null);
ok(r.turns === SCRIPT.length, 'both scripted turns were played',
   'turns played ' + r.turns + ' of ' + SCRIPT.length
   + ' — a game that ends early stages nothing and looks exactly like one that agreed');

/* THE ENGINE SIDE FIRST. If medicham2 never reached its stall check the comparison below would be
 * vacuously red and would blame the authority for this file's fixture. */
const meStall = addr.me.filter(s => /\|any\|protect\|/.test(s));
console.log('\n2. MEDICHAM2 REACHED THE CONSECUTIVE-PROTECT DIE');
ok(meStall.length > 0, 'medicham2 addressed at least one draw to `protect` and a real slot',
   meStall.length ? meStall.join('\n') : 'no `|any|protect|` address — the second Protect never rolled, '
   + 'so this fixture is not staging the mechanic and nothing below means anything');

console.log('\n3. THE AUTHORITY ADDRESSED THE SAME EVENT — the claim the whole arm rests on');
const sdStall = addr.sd.filter(s => /\|any\|protect\|/.test(s));
const shared = meStall.filter(s => addr.sd.includes(s));
ok(sdStall.length > 0, 'the authority addressed a draw to `protect` and a real slot',
   sdStall.length ? sdStall.join('\n')
   : 'NONE. Every authority draw made outside hitStepAccuracy / secondaries / getDamage is built with '
   + 'no battle in scope, so it reads turn 0, move `-`, target `-`:\n'
   + addr.sd.slice(0, 8).join('\n'));
ok(shared.length > 0, 'the two engines built the SAME address for the same draw',
   shared.length ? shared.join('\n')
   : 'medicham2 ' + (meStall[0] || '(none)') + '\nauthority  ' + (sdStall[0] || '(none)')
   + '\nA die addressed differently on the two sides is not a shared die. It is two independent '
   + 'coins, and on a 1/3 roll two independent coins disagree 4/9 of the time.');

console.log('\n4. NO DRAW IS ADDRESSED WITHOUT A BATTLE IN SCOPE');
ok(addr.no_battle === 0, 'every authority draw had the battle in scope',
   addr.no_battle + ' of ' + addr.sd.length + ' draws were addressed `<seed>|0|any|-|-|<nth>` — that is '
   + 'a global sequence, not an address, and it cannot match anything medicham2 computes');

/* ==================================================================================================
 * 5. THE CONTROL THAT KILLS THE OTHER CANDIDATE — `willAct()`
 *
 * ROADMAP #220's remaining live hypothesis was the `willAct()` guard's exact MEMBERSHIP: ours counts a
 * `kind:'pass'` action as "something will act", the authority scans for `move`/`switch`/`instaswitch`/
 * `shift` (sim/battle-queue.ts:310). It is worth killing POSITIVELY rather than by the absence of a
 * divergence, because "no divergence appeared" is also what an unexercised gate looks like — this
 * repository's signature failure, arriving as a control nobody cleared.
 *
 * `protect.onPrepareHit` is `!!this.queue.willAct() && this.runEvent('StallMove', pokemon)`, and the
 * `&&` is a short-circuit. **On a body's FIRST Protect there is no `stall` volatile, so the second term
 * draws nothing on either side: `willAct()` is then the ONLY thing that can refuse the shield, and it
 * is pure bookkeeping with no die in it at all.** So the fixture below is dice-free by construction and
 * its verdict cannot be laundered by any pin.
 *
 * Snorlax (base Speed 30) is the slowest of the four bodies and every body clicks Protect, so Snorlax
 * holds the LAST action of turn 1 and its shield must be refused. Turn 2 is where the consequence
 * lands: a refused shield never reaches `onHit`, so `stall` is never added and Snorlax's turn-2 Protect
 * is a free 100% — while an engine that wrongly allowed turn 1 carries a counter into turn 2 and has to
 * roll for it. Close Combat is 100-accuracy, has no secondary and is 2x on a Normal type, so a shield
 * that does not hold is 4 stat-lines of difference rather than a subtle one.
 *
 * NOTHING HERE DECLARES AN EXPECTED VALUE. `tests/staged_board.js` plays the identical script in both
 * engines and reads `engine/board_state.js` out of both at every turn boundary; Showdown is the
 * expectation. Reused rather than reimplemented — a second copy of that driver would be a second thing
 * to keep true. */
console.log('\n5. THE `willAct()` CONTROL — a dice-free refusal, staged, both engines');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const WILLACT = {
  id: 'r220-willact-last-action',
  kind: 'move', shape: 'shield gate',
  census: 'ROADMAP #220 — the `willAct()` half of protect.onPrepareHit',
  what: 'all four bodies click Protect on turn 1; Snorlax (Speed 30) is slowest, so it holds the last '
      + 'action of the turn and `!!this.queue.willAct()` must refuse its shield with no die drawn.',
  negative: 'turn 2 — Snorlax clicks Protect again into Close Combat. A turn-1 refusal leaves no '
          + '`stall` volatile, so turn 2 is a free 100%; an engine that wrongly allowed turn 1 carries '
          + 'a counter and rolls for it. The three bodies that DID shield on turn 1 stop shielding on '
          + 'turn 2, so no consecutive-Protect die is drawn anywhere in this fixture.',
  A: [{ species: 'incineroar', item: '', ability: '', moves: ['Protect', 'Close Combat'] },
      { species: 'milotic', item: '', ability: '', moves: ['Protect', 'Recover'] },
      { species: 'clefable', item: '', ability: '', moves: ['Protect'] },
      { species: 'weavile', item: '', ability: '', moves: ['Protect'] }],
  B: [{ species: 'garchomp', item: '', ability: '', moves: ['Protect', 'Swords Dance'] },
      { species: 'snorlax', item: '', ability: '', moves: ['Protect'] },
      { species: 'toxapex', item: '', ability: '', moves: ['Protect'] },
      { species: 'corviknight', item: '', ability: '', moves: ['Protect'] }],
  script: [
    { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    { p1: [{ m: 'closecombat', t: 1 }, { m: 'recover' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
  ],
};
const wa = SB.runOne(WILLACT);
/* THE CONTROL IS CLEARED EXPLICITLY, BECAUSE "THE BOARDS MATCH" IS ALSO WHAT TWO ENGINES THAT BOTH
 * SKIP THE GATE LOOK LIKE. The authority's own stream is read for the refusal: `|move|p2b: Snorlax|
 * Protect||[still]` + `|-fail|p2b: Snorlax` on turn 1. Without this the fixture would pass on an
 * engine with no shield gate at all, which is precisely the shape CLAUDE.md's wiring rule exists for. */
/* AND IT IS READ OFF STAGED_BOARD'S OWN MODULE INSTANCE, NOT THIS FILE'S. `staged_board.harness()`
 * deletes `game_differential` from the require cache and re-requires it so a patched engine can be
 * loaded under it, so `GD` here and the module that just played the fixture are two different objects
 * with two different `_lastSdLog` buffers. Reading this file's returned the log of the fixture in §1
 * — a stale stream that answers the question confidently and about the wrong game. */
const sdLog = SB.harness().lastSdLog().map(String);
const t2 = sdLog.findIndex(l => /^\|turn\|2/.test(l));
const turn1 = t2 > 0 ? sdLog.slice(0, t2) : sdLog;
const snorlaxRefused = turn1.some(l => /^\|-fail\|p2b: Snorlax/.test(l));
const snorlaxShielded = turn1.some(l => /^\|-singleturn\|p2b: Snorlax\|Protect/.test(l));
ok(snorlaxRefused && !snorlaxShielded,
   'the AUTHORITY refused the last-acting shield on turn 1 — the gate is exercised, not absent',
   turn1.filter(l => /Snorlax|-fail|-singleturn/.test(l)).join('\n')
   || 'no Snorlax lines in turn 1 at all');
ok(wa.verdict === 'IDENTICAL' || wa.verdict === 'DIFFERS',
   'the willAct fixture STAGED (not NOT-STAGED / THREW / SHORT)',
   'verdict ' + wa.verdict + (wa.why ? ' — ' + wa.why : ''));
ok(wa.verdict === 'IDENTICAL',
   'the two engines hold the SAME board at every boundary of the willAct fixture',
   wa.verdict === 'IDENTICAL'
     ? (wa.compared || 0) + ' leaves compared across ' + (wa.boards || []).length + ' boundaries — so the '
       + 'shield gate is exercised and the two engines agree about it. `willAct()` is NOT the cause of '
       + 'the -fail/-singleturn family.'
     : 'boards part at: ' + (wa.boards || []).flatMap(b => (b.unexplained || []).map(d => b.turn + ':' + d.field)).join(', '));

console.log('\n' + (bad ? 'RED — ' + bad + ' claim(s) failed' : 'GREEN — every claim held') + '\n');
process.exit(bad ? 1 : 0);
