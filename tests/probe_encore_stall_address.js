#!/usr/bin/env node
/* tests/probe_encore_stall_address.js — M7 / ROADMAP #543, THE ENCORE'd PROTECT AND THE `stall` DIE
 * ==================================================================================================
 * DO THE TWO ENGINES DRAW THE CONSECUTIVE-PROTECT DIE AT THE SAME ADDRESS WHEN ENCORE REWROTE THE
 * ACTION?
 *
 * #543 lists two candidate causes and says to suspect the address before the logic. IT IS THE
 * ADDRESS, and the reading below is the measurement rather than the argument.
 *
 * THE AUTHORITY, RE-OPENED. `runMove` writes the active move ONCE, and it writes it AFTER every
 * rewrite of the action:
 *
 *     sim/battle-actions.ts:217   pokemon.activeMoveActions++;
 *     sim/battle-actions.ts:227   const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
 *     sim/battle-actions.ts:230     baseMove = this.dex.getActiveMove(changedMove);
 *     sim/battle-actions.ts:233     target = this.battle.getRandomTarget(pokemon, baseMove);
 *     sim/battle-actions.ts:244   this.battle.setActiveMove(move, pokemon, target);
 *
 * and the die itself is `data/conditions.ts` `stall.onStallMove` -> `randomChance(1, counter)`, raised
 * from `protect.onPrepareHit`'s `this.runEvent('StallMove', pokemon)` inside `useMoveInner` — i.e.
 * AFTER `setActiveMove`. So the authority's address for that draw names the move ENCORE FORCED.
 * §0 greps `/data/mods/champions/` on every run: Champions overrides Protect's PP and nothing else
 * about it, carries no `stall` condition row, and does not override `runMove`.
 *
 * THE MEASUREMENT, taken before any byte moved. One staged turn, both address logs side by side:
 *
 *     authority   20260813|2|any|protect|p20|0     the stall die, named for the FORCED move
 *     this engine 20260813|2|any|crunch|p10|0      the same die, a different address
 *
 * Two addresses that cannot match are two INDEPENDENT dice. `medicham2-browser.js` stamped
 * `MID_MOVE`/`MID_TGT` at the TOP of the action — above Encore's override — and restamped them only
 * at the `|move|` announcement, which is BELOW `_shieldGate`. The control, the identical board with
 * no Encore in it, shared 5 of 5 addresses before the fix as well as after.
 *
 * THIS IS NOT #463 AND DOES NOT REOPEN IT. #463 decides WHEN a held counter is SPENT and is closed;
 * a spend cannot produce a disagreement about a roll, and #543 says so. Nothing in this pass touches
 * `_stallExpire` or any of the four eager clears.
 *
 * THE FOUR ARMS.
 *   1. encore-forces-the-second-protect   the defect. Every `any` address this engine draws on the
 *                                         parting turn must be one the authority also drew.
 *   2. plain-second-protect (CONTROL)     the same board, the same counter, no Encore. The addresses
 *                                         already agreed here and must go on agreeing — so a red arm
 *                                         1 accuses the OVERRIDE and not the stall die in general.
 *   3. encore-forces-an-attack            the same override with NO shield under it — Encore forces
 *                                         Body Slam. It is a second positive arm, not a control: the
 *                                         address moves here too, so it goes red under the knob as
 *                                         well. What it adds is that the restamp is about the ADDRESS
 *                                         and not about shields.
 *   4. encore-second-protect-that-parts   THE BOARD CONSEQUENCE. The same shape as arm 1 with three
 *                                         padding turns in front of it, which changes the turn field
 *                                         of the address and therefore the pair of numbers the two
 *                                         engines draw. Under the knob this one PARTS THE BOARD —
 *                                         `p2.party.snorlax.hp` 188 for us against 235, and `status`
 *                                         `par` against `""`, because the Encored shield held for the
 *                                         authority and failed for us. Arm 1's board does NOT part on
 *                                         its own seed and that is said out loud rather than hidden:
 *                                         two independent dice agree about two thirds of the time, so
 *                                         the ADDRESS is the claim and the board is the consequence.
 *
 * RED-FIRST KNOB: `MEDI_MID_ADDR_PRE_OVERRIDE=1` restores the single early write. Under it arms 1, 3
 * and 4 go RED — 1 and 3 on the address, 4 on the address AND the board — and arm 2, the one board
 * with no override on it, stays green. Any run carrying it also carries a non-zero
 * `MEDFAILS.midAddrPreOverrideRestored`.
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

const KNOB = process.env.MEDI_MID_ADDR_PRE_OVERRIDE === '1';
console.log('\ntests/probe_encore_stall_address.js — M7 / #543 the Encore\'d Protect and the stall die');
console.log('  MEDI_MID_ADDR_PRE_OVERRIDE=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE AUTHORITY AND THE MEMBERSHIP, DERIVED ON EVERY RUN --------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;
const MODDIR = process.env.SHOWDOWN_PATH + '/data/mods/champions/';

console.log('\n0. WHAT THIS REGULATION ACTUALLY CONTAINS');
/* Every move that adds the `stall` volatile — derived from the handler text, because #195's closet
 * is about the ABILITY of the same name and the two share nothing but a spelling. */
const STALLERS = D.moves.all().filter(m => legal(m)
  && /addVolatile\(['"]stall['"]\)|stallingMove/.test(JSON.stringify(m, (k, v) =>
       typeof v === 'function' ? String(v) : v)));
console.log('     legal moves that touch the `stall` volatile: '
  + STALLERS.map(m => m.id).sort().join(', '));
ok(STALLERS.some(m => m.id === 'protect'),
   'Protect is one of them — the die this probe stages is a live mechanic in this format',
   STALLERS.length ? null : 'nothing matched; every arm below is vacuous');
ok(legal(D.moves.get('encore')), 'Encore is legal here', null);

const MODCOND = fs.readFileSync(MODDIR + 'conditions.ts', 'utf8');
ok(!/\bstall\b/.test(MODCOND),
   'Champions carries no `stall` condition row — data/conditions.ts is the die\'s authority',
   /\bstall\b/.test(MODCOND) ? 'the mod DOES override it — read that block instead' : null);
const MODSCRIPTS = fs.readFileSync(MODDIR + 'scripts.ts', 'utf8');
ok(!/runMove\s*\(|setActiveMove/.test(MODSCRIPTS),
   'Champions does not override runMove — battle-actions.ts:227-244 is the order that matters',
   /runMove\s*\(|setActiveMove/.test(MODSCRIPTS) ? 'the mod DOES override it' : null);
/* And that the mod's Protect row changes the PP and not the gate, since the gate is the claim. */
const MODMOVES = fs.readFileSync(MODDIR + 'moves.ts', 'utf8');
const PROW = /(^|\n)\tprotect:\s*\{([\s\S]*?)\n\t\},/.exec(MODMOVES);
console.log('     Champions\' own protect row: ' + (PROW ? PROW[2].trim().replace(/\s+/g, ' ') : '(none)'));
ok(!PROW || !/onPrepareHit|StallMove/.test(PROW[2]),
   'Champions does not rewrite Protect\'s onPrepareHit gate',
   PROW && /onPrepareHit|StallMove/.test(PROW[2]) ? 'IT DOES — the gate above is not the rule here' : null);

/* ==================================================================================================
 * THE THREE BOARDS — one team pair, so the only thing that varies is the clicks
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* Whimsicott's Prankster puts Encore at +1, so it lands BEFORE the victim's own 0-priority click and
 * the override actually fires this turn. Showdown keeps the ORIGINAL move's priority bracket
 * (`baseMove.priority = priority`, battle-actions.ts:231), so the forced Protect still resolves in
 * the bracket the Crunch was sorted into — which is what makes the second Protect reachable at all. */
const SIDE_A = () => [mon('whimsicott', '', 'Prankster', ['Encore', 'Protect']),
                      mon('milotic', '', 'Marvel Scale', ['Protect', 'Body Slam'])]
                     .concat(FILL('toxapex', 'corviknight'));
const SIDE_B = () => [mon('snorlax', '', 'Thick Fat', ['Protect', 'Crunch', 'Body Slam']),
                      mon('garchomp', '', 'Rough Skin', ['Protect'])]
                     .concat(FILL('weavile', 'incineroar'));

const ARMS = [
  { id: 'encore-forces-the-second-protect',
    governed: true,
    what: 'Snorlax Protects on turn 1, which arms `stall` at counter 3 without drawing a die '
        + '(`randomChance(1, 1)` is not taken). On turn 2 a Prankster Whimsicott Encores it and '
        + 'Snorlax clicks Crunch, which `OverrideAction` rewrites into Protect — so the shield the '
        + 'die decides is one the player never clicked, and the authority addresses that die for the '
        + 'FORCED move.',
    script: [
      { p1: [{ m: 'protect' }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'encore', t: 0 }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'crunch', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'plain-second-protect',
    governed: false,
    what: 'THE CONTROL FOR THE ADDRESS. Identical bodies, identical counter, and Snorlax clicks '
        + 'Protect itself on turn 2 with no Encore anywhere. Nothing rewrites the action, so the '
        + 'top-of-action address was already the right one — this arm shared every address before '
        + 'the fix as well as after, and a red here would mean the restamp broke the ordinary road.',
    script: [
      { p1: [{ m: 'protect' }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ] },

  { id: 'encore-forces-an-attack',
    governed: true,
    what: 'THE SECOND CONTROL. The same Encore, the same override, but the move it forces is BODY '
        + 'SLAM rather than Protect — so the address still moves and no shield die is drawn at all. '
        + 'The boards must be identical. Without it a green arm 1 could be a restamp that works only '
        + 'because it happens to silence a shield.',
    script: [
      { p1: [{ m: 'protect' }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'encore', t: 0 }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'crunch', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'encore-second-protect-that-parts',
    governed: true,
    what: 'THE BOARD CONSEQUENCE. Arm 1 with three padding turns in front, so the address carries '
        + 'turn 5 instead of turn 2 and the two engines draw a DIFFERENT pair of numbers for the '
        + 'same event. Under the restore knob this one parts the board — `p2.party.snorlax.hp` 188 '
        + 'for us against 235 and `status` `par` against `""` — because the Encored shield held for '
        + 'the authority and failed for us. It is the same defect as arm 1; what differs is only '
        + 'whether the two independent coins happened to land the same way.',
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'encore', t: 0 }, { m: 'bodyslam', t: 0 }], p2: [{ m: 'crunch', t: 0 }, { m: 'protect' }] },
    ] },
];

/* ==================================================================================================
 * 1. THE ADDRESSES, READ OFF THE DRIVER'S OWN LOGS
 * ==================================================================================================
 * `midAddresses()` returns THIS RUN'S two logs: `sd` is the differential's record of every draw the
 * authority took, `me` is the engine's own `midEventLog()`. Nothing here recomputes an address — the
 * whole point of #543 is that a probe holding its own copy of the address rule would agree with
 * itself. The `any` category is the one `stall` maps into (`MID_ADDR_CAT`), because Showdown's draw
 * happens inside `stall.onStallMove`, which is none of acc / crit / sec / dmg.
 * ================================================================================================== */
const G = SB.harness();
console.log('\n1. THE `any` ADDRESSES EACH ENGINE DREW, AND WHETHER THEY ARE THE SAME EVENTS');
const RESULT = {};
for (const arm of ARMS) {
  G.midResetAddresses();
  const a = G.buildPair(SIDE_A()), b = G.buildPair(SIDE_B());
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'm7-' + arm.id, { script: arm.script,
    onBoundary: (snap, t) => { boards.push({ t, diffs: (snap.diffs || []).slice() });
                               snap.identical = true; snap.diffs = []; } });
  const ad = G.midAddresses();
  const pick = xs => xs.filter(x => /\|any\|/.test(x));
  const sd = pick(ad.sd), me = pick(ad.me);
  const sdSet = new Set(sd);
  const unshared = me.filter(x => !sdSet.has(x));
  RESULT[arm.id] = { sd, me, unshared, boards, err: r.err, turns: r.turns };

  console.log('\n  [' + arm.id + ']' + (arm.governed && KNOB ? '   [expected RED: the knob is armed]' : ''));
  console.log('    ' + arm.what.replace(/(.{92}\s)/g, '$1\n    '));
  ok(!r.err && r.turns === arm.script.length,
     'the arm played its whole script',
     r.err ? r.err : (r.turns !== arm.script.length ? 'played ' + r.turns + ' of ' + arm.script.length : null));
  console.log('    authority `any` draws: ' + sd.length + '   engine `any` draws: ' + me.length);
  for (const x of sd) console.log('      sd  ' + x);
  for (const x of me) console.log('      me  ' + (sdSet.has(x) ? '   ' : '>> ') + x);
  ok(me.length > 0 && sd.length > 0,
     'both engines actually drew an `any` die on this board — the arm is not vacuous',
     'sd=' + sd.length + ' me=' + me.length + ' (a zero means no stall roll was reached and this arm '
     + 'proves nothing whichever way it goes)');
  ok(unshared.length === 0,
     'every `any` die this engine drew is one the authority also drew, at the same address',
     unshared.length ? 'UNSHARED (this engine only):\n' + unshared.join('\n') : null);
  const parted = boards.filter(x => x.diffs.length);
  ok(parted.length === 0, 'the two boards never parted',
     parted.length ? parted.map(p => 'turn ' + p.t + '  ' + JSON.stringify(p.diffs.slice(0, 4))).join('\n') : null);
}

/* ==================================================================================================
 * 2. THE ARM AND ITS CONTROL DIFFER IN THE RIGHT PLACE
 * ==================================================================================================
 * "Every address is shared" is also what a run that drew NO die looks like, and "the boards agree" is
 * what two engines that both refuse every shield look like. The discriminator is that arm 1 and arm 2
 * reach the SAME stall die from two different roads, so the address string that names it must be
 * IDENTICAL in the two arms — the authority does not know which road the move came down. */
console.log('\n2. THE ENCORE ROAD AND THE PLAIN ROAD NAME THE SAME EVENT');
const enc = RESULT['encore-forces-the-second-protect'], pln = RESULT['plain-second-protect'];
const stallish = xs => xs.filter(x => /\|any\|protect\|p20\|/.test(x));
console.log('     encore arm, victim-slot stall addresses: ' + JSON.stringify(stallish(enc.me)));
console.log('     plain  arm, victim-slot stall addresses: ' + JSON.stringify(stallish(pln.me)));
ok(stallish(pln.me).length > 0,
   'the CONTROL really does draw a victim-slot stall die — the pattern this arm keys on is real',
   'if this is empty the comparison below is between two empty sets');
ok(!KNOB ? stallish(enc.me).length > 0 : true,
   'the ENCORE arm draws that same victim-slot stall die once the address is restamped',
   'encore arm drew ' + JSON.stringify(stallish(enc.me)));

/* ==================================================================================================
 * 3. THE ENGINE'S OWN RECEIPTS
 * ================================================================================================== */
console.log('\n3. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M.MEDSEEN, F = M.MEDFAILS;
if (S && F) {
  console.log('     midAddrMovedAtOverride ' + S.midAddrMovedAtOverride
    + ' (' + (S.midAddrMovedAtOverrideFirst || '-') + ')');
  console.log('     midAddrMovedAtAnnounce ' + S.midAddrMovedAtAnnounce
    + '   encoreOverrodeAtExecution ' + S.encoreOverrodeAtExecution
    + '   midAddrPreOverrideRestored ' + F.midAddrPreOverrideRestored);
  ok(KNOB ? F.midAddrPreOverrideRestored === 1 : F.midAddrPreOverrideRestored === 0,
     'the restore knob reports its own state',
     'midAddrPreOverrideRestored=' + F.midAddrPreOverrideRestored);
  ok(S.encoreOverrodeAtExecution > 0,
     'Encore actually overrode an action — the staging reached the mechanic',
     'encoreOverrodeAtExecution=' + S.encoreOverrodeAtExecution);
  ok(KNOB || S.midAddrMovedAtOverride > 0,
     'the restamp actually MOVED an address — it is load-bearing, not a redundant write',
     'midAddrMovedAtOverride=' + S.midAddrMovedAtOverride
     + ' — a zero means the second write never changes anything and this fix is inert');
} else {
  ok(false, 'MEDSEEN / MEDFAILS are readable off the frozen engine', 'the release does not export them');
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
