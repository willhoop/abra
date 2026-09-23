#!/usr/bin/env node
/* tests/probe_court_change.js — COURT CHANGE SWAPS THE LISTED SIDE CONDITIONS BETWEEN THE SIDES. 2026-09-23
 * (ENGINE pass 10, abra/regmc 0.82.0).
 *
 *   node tests/probe_court_change.js --regulation regmc
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *   MEDI_COURT_CHANGE_UNMODELLED=1     restores the old terminal pass (must exit 1)
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_court_change.js   -> NOT RUN (exit 2): no legal learner in Reg M-B
 *
 * ================= THE AUTHORITY (M-C checkout data/moves.ts courtchange :3032-3098; no Champions override) ======
 *
 *   onHitField walks its literal `sideConditions` list, lifts every listed condition off the user's side and off the
 *   foe's, hands each side the other's STATE (turns and layers intact), then `if (!success) return false;` and
 *   `this.add('-swapsideconditions'); this.add('-activate', source, 'move: Court Change');`.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ========================
 *
 *   SWAP: turn 1 the foe raises Reflect and the user's partner raises Tailwind; turn 2 the user clicks Court Change;
 *         then five quiet turns, so both clocks run out ON THE SIDE THEY WERE MOVED TO.
 *   BARE: the same user clicks Court Change on turn 1 with nothing up -- the move fails.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_court_change', ['MEDI_COURT_CHANGE_UNMODELLED'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P, idle } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const QUIET = s => quiet(s) && learns(s, 'protect') && idle(s);
const USER = SPEC.filter(s => learns(s, 'courtchange') && QUIET(s)).sort((a, b) => bulk(b) - bulk(a));
if (!USER.length) { console.log('  NOT RUN — no legal Court Change learner with a quiet ability in ' + K.CS.FORMAT); process.exit(2); }
const REF = SPEC.filter(s => learns(s, 'reflect') && QUIET(s)).sort((a, b) => bulk(b) - bulk(a));
const TW = SPEC.filter(s => learns(s, 'tailwind') && QUIET(s)).sort((a, b) => bulk(b) - bulk(a));
const FILL = SPEC.filter(QUIET).sort((a, b) => bulk(b) - bulk(a));
console.log('     users: ' + show(USER) + '   reflect: ' + show(REF) + '   tailwind: ' + show(TW));

const KEEP = /^\|(-swapsideconditions|-activate|-sidestart|-sideend|-fail|move)\|?/;
const q = s => ({ m: idle(s).id });
let SW = null, BA = null;
outer:
for (const u of USER) for (const r of REF) for (const t of TW) {
  const used = new Set();
  const cast = pickDistinct([u, t, r], used, 3);
  if (cast.length < 3 || cast[0] !== u || cast[1] !== t || cast[2] !== r) continue;
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
  if (fills.length < 3) continue;
  const A = [mon(u, '', ['Court Change', 'Protect', idle(u).name]), mon(t, '', ['Tailwind', 'Protect', idle(t).name]),
    mon(fills[0], '', ['Protect', idle(fills[0]).name]), mon(fills[2], '', ['Protect'])];
  const B = [mon(r, '', ['Reflect', 'Protect', idle(r).name]), mon(fills[1], '', ['Protect', idle(fills[1]).name]),
    mon(fills[0], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const quietTurn = { p1: [q(u), q(t)], p2: [q(r), q(fills[1])] };
  const sw = K.play('swap', A, B, [{ p1: [P.protect, { m: 'tailwind' }], p2: [{ m: 'reflect' }, P.protect] },
    { p1: [{ m: 'courtchange' }, q(t)], p2: [q(r), q(fills[1])] }, quietTurn, quietTurn, quietTurn, quietTurn, quietTurn], KEEP);
  const ba = K.play('bare', A, B, [{ p1: [{ m: 'courtchange' }, q(t)], p2: [q(r), q(fills[1])] }], KEEP);
  if (!sw.staged || !ba.staged) { console.log('   (skip ' + u.id + '/' + r.id + '/' + t.id + ': ' + (sw.why || ba.why) + ')'); continue; }
  sw.cast = u.id + ' Court Change; ' + r.id + ' Reflect (foe side), ' + t.id + ' Tailwind (own side)';
  ba.cast = u.id + ' Court Change on a bare field';
  SW = sw; BA = ba; break outer;
}
if (!SW) { console.log('  NO CAST FOUND'); process.exit(1); }
K.printArms([['SWAP', SW], ['BARE', BA]]);

console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const has = (x, re) => x.sdK.some(l => re.test(l));
ok(has(SW, /^\|-activate\|p1a:[^|]*\|move:courtchange$/),
  'SWAP — the authority announces the swap (its `-swapsideconditions` line is declared notEmitted and dropped by the driver)');
ok(has(SW, /^\|-sideend\|p1:[^|]*\|(move:)?reflect/) && !has(SW, /^\|-sideend\|p2:[^|]*\|(move:)?reflect/),
  'SWAP — the foe\'s Reflect ends on the USER\'s side', SW.sdK.filter(l => /sideend/.test(l)).join('  '));
ok(has(SW, /^\|-sideend\|p2:[^|]*\|(move:)?tailwind/) && !has(SW, /^\|-sideend\|p1:[^|]*\|(move:)?tailwind/),
  'SWAP — the user\'s Tailwind ends on the FOE\'s side', SW.sdK.filter(l => /sideend/.test(l)).join('  '));
ok(has(BA, /^\|-fail\|p1a:/) && !has(BA, /^\|-activate\|p1a:[^|]*\|move:courtchange$/), 'BARE — nothing to swap: the move fails');

/* the side line names the side as `p2: <player>` on the authority and `p2: ` here, and Reflect's `move: ` prefix is the
 * engine's DECLARED residue (see `TR.sstart`); the driver folds both, so the comparison below does the same and
 * nothing else */
for (const R of [SW, BA]) for (const k of ['sdK', 'meK']) R[k] = R[k].map(l => l.replace(/^\|(-side(?:start|end))\|(p[12]):[^|]*\|(?:move:)?/, '|$1|$2:|'));
K.compareArms([['SWAP', SW], ['BARE', BA]], /^\|(-swapsideconditions|-activate|-sidestart|-sideend|-fail)\|?/,
  '-swapsideconditions / -activate / -sidestart / -sideend / -fail');
K.finish();
