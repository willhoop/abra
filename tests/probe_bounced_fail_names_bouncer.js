#!/usr/bin/env node
/* tests/probe_bounced_fail_names_bouncer.js — A BOUNCED STATUS MOVE THAT FAILS WRITES ITS `-fail` ON THE BOUNCER.
 * 2026-09-24 (abra/regmc 0.88.0). Reg M-C narration group M (`…bo3-2684711995`, turn 6): a Whimsicott's Encore
 * bounced by a Hatterene's Magic Bounce fails, and
 *     showdown  |-fail|p1a: Hatterene
 *     medicham  |-fail|p2a: Whimsicott
 *
 *   node tests/probe_bounced_fail_names_bouncer.js                                   # Reg M-B, green
 *   node tests/probe_bounced_fail_names_bouncer.js --regulation regmc                # Reg M-C, green
 *   MEDI_BOUNCED_FAIL_NAMES_CLICKER=1 node tests/probe_bounced_fail_names_bouncer.js [--regulation regmc]   # RED
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (both checkouts; read whole; the Champions mods override none of it) =====
 *
 *   data/abilities.ts magicbounce.onTryHit: `const newMove = this.dex.getActiveMove(move.id); newMove.hasBounced = true;
 *       newMove.pranksterBoosted = false; this.actions.useMove(newMove, target, { target: source }); return null;`
 *     -> the BOUNCER uses the move, at the clicker.
 *   data/moves.ts encore.condition.onStart: `let move = target.lastMove; if (!move ...) return false; ...
 *       if (... move.flags['failencore'] ...) return false;` -- the clicker's last move IS Encore (`failencore`).
 *   sim/battle-actions.ts runMoveEffects: `if (!didAnything && didAnything !== 0 ...) { ... this.battle.add('-fail',
 *       source); this.battle.attrLastMove('[still]'); }` -- `source` is the user of the move, which is the bouncer.
 *
 * ================= THE ARMS (both engines play the same scripted turn; SHOWDOWN IS THE ANSWER) ============
 *
 *   BOUNCE    the Encore is aimed at a Magic Bounce body, bounces, and fails on the clicker: `-fail|<bouncer>`.
 *   CONTROL   the same board with the target on a non-reflecting ability (knob-cleared): the Encore lands on a
 *             body with no last move and fails there, `-fail|<clicker>`. So the line CAN name either body, and
 *             the ability is what moves it.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_bounced_fail_names_bouncer',
  ['MEDI_BOUNCED_FAIL_NAMES_CLICKER'], { anyRegulation: true });
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct } = K;

/* THE CAST, DERIVED. The bouncer: a legal non-mega species whose ability list includes Magic Bounce and that also
 * carries another ability (the control), idling with a self-targeting move. The clicker: a quiet Encore learner. */
const IDLES = ['calmmind', 'nastyplot', 'swordsdance', 'agility', 'irondefense', 'bulkup'];
const idleOf = s => IDLES.map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)) || null;
const BOUNCERS = SPEC.filter(s => abil(s).includes('magicbounce') && abil(s).length > 1 && idleOf(s));
/* the clicker is clearly FASTER than the bouncer, so in the control it moves before the target has any last move
 * and the Encore fails on the target's side of the board -- which is the line the control needs */
const CLICKERS = SPEC.filter(s => quiet(s) && learns(s, 'encore') && idleOf(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     Magic Bounce holders with a second ability and an idle move: ' + BOUNCERS.map(s => s.id + ' ' + JSON.stringify(abil(s))).join('; '));
console.log('     quiet Encore learners: ' + CLICKERS.length);
const KEEP = /^\|(move|-fail|-start|-activate)\|/;
let BN = null, CT = null;
outer: for (const b of BOUNCERS) {
  const other = abil(b).find(a => a !== 'magicbounce');
  for (const c of CLICKERS.filter(x => x.baseStats.spe >= b.baseStats.spe + 30)) {
    const used = new Set([b.baseSpecies, b.id, c.baseSpecies, c.id]);
    const fills = pickDistinct(SPEC.filter(s => quiet(s) && idleOf(s)).sort((x, y) => bulk(y) - bulk(x)), used, 4);
    if (fills.length < 4) continue;
    const g = s => idleOf(s).name, idle = s => ({ m: idleOf(s).id });
    const A = ab => [mon(b, '', [g(b)], D.abilities.get(ab).name), mon(fills[0], '', [g(fills[0])]),
                     mon(fills[1], '', [g(fills[1])]), mon(fills[2], '', [g(fills[2])])];
    const B = [mon(c, '', ['Encore', g(c)]), mon(fills[3], '', [g(fills[3])]), mon(fills[2], '', [g(fills[2])]),
               mon(fills[1], '', [g(fills[1])])];
    /* the clicker aims Encore at p1a (the bouncer); everybody else idles */
    const script = [{ p1: [idle(b), idle(fills[0])], p2: [{ m: 'encore', t: 0 }, idle(fills[3])] }];
    const r1 = K.play('bounce', A('magicbounce'), B, script, KEEP, () => ({}));
    if (!r1.staged) { console.log('   (skip ' + b.id + '/' + c.id + ': ' + r1.why + ')'); continue; }
    const r2 = K.play('control', A(other), B, script, KEEP, () => ({}));
    if (!r2.staged) { console.log('   (skip control ' + b.id + '/' + c.id + ': ' + r2.why + ')'); continue; }
    r1.cast = c.id + ' --encore--> ' + b.id + ' (Magic Bounce)'; r2.cast = c.id + ' --encore--> ' + b.id + ' (' + other + ')';
    r1.names = { bouncer: b.name, clicker: c.name };
    BN = r1; CT = r2; break outer;
  }
}
const RUNS = [['BOUNCE', BN], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const failOn = R => R.sdK.filter(l => /^\|-fail\|/.test(l));
const lc = s => K.canon(s);
ok(/\[from\]ability:magicbounce/.test(BN.sdK.join(' ')), 'BOUNCE — the authority bounced the Encore (`[from] ability: Magic Bounce`)');
ok(failOn(BN).length === 1 && failOn(BN)[0].includes(lc(BN.names.bouncer)),
   'BOUNCE — the authority writes ONE `-fail`, on the BOUNCER', failOn(BN).join(' '));
ok(failOn(CT).length === 1 && failOn(CT)[0].includes(lc(BN.names.clicker)),
   'CONTROL — without the bounce the authority\'s `-fail` names the CLICKER (so the line can name either)', failOn(CT).join(' '));

K.compareArms(RUNS, /^\|-fail\|/, '-fail');
K.finish();
