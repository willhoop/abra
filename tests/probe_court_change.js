#!/usr/bin/env node
/* tests/probe_court_change.js — COURT CHANGE SWAPS THE LISTED SIDE CONDITIONS BETWEEN THE SIDES. 2026-09-23
 * (ENGINE pass 10, abra/regmc 0.82.0).
 *
 *   node tests/probe_court_change.js --regulation regmc
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *   MEDI_COURT_CHANGE_UNMODELLED=1     restores the old terminal pass (must exit 1)
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_court_change.js   -> NOT-IN-REGULATION, asserted (exit 0; 1 if any
 *                                                                      of the three out-of-regulation checks fails)
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

/* ================= IS THE MOVE IN THIS REGULATION AT ALL? (2026-09-24, abra/regmc 0.86.2) ======================
 *
 * Until 0.86.2 a regulation with no quiet-ability learner exited 2 "NOT RUN", and pass 10 booked that as
 * COULD-NOT-STAGE against the gate. Under Reg M-B that was never a fixture gap: Court Change is
 * `isNonstandard: 'Past'` there, no legal species learns it (0 of the format's legal species; the only
 * learner in the whole dex is Cinderace, itself `Past`), and engine/legal_scope.js answers NOT-LEGAL.
 * A move the regulation cannot put on a sheet is NOT-IN-REGULATION, which the gate does not count
 * (engine/quarantine.js rosterStage: "OUT OF SCOPE ... not counted at all").
 *
 * So the out-of-regulation arm is ASSERTED, not assumed, three ways -- and each can go red:
 *   (a) the one scope implementation says out (NOT-LEGAL under Reg M-B: the format does not list the move);
 *   (b) the format's own dex marks the move nonstandard and no legal species learns it;
 *   (c) the TeamValidator refuses a legal body carrying it as an EXISTENCE problem, and accepts the SAME body
 *       without it (the control, cleared explicitly: the refusal must be about Court Change and nothing else).
 * In a regulation where the move IS in scope, a missing learner is a real failure (exit 1), never exit 2. */
const SCOPE = require('../engine/legal_scope.js').derive();
const V = SCOPE.verdict('move', 'courtchange');
console.log('\n0. SCOPE (' + K.CS.FORMAT + ') — engine/legal_scope.js: ' + (V.inScope ? 'IN' : 'OUT') + ' ' + V.code + ' — ' + V.why);
if (!V.inScope) {
  const LEARNERS = SPEC.filter(s => learns(s, 'courtchange'));
  const mv = D.moves.get('courtchange');
  console.log('  NOT-IN-REGULATION — Court Change: isNonstandard=' + JSON.stringify(mv.isNonstandard)
    + ', legal learners ' + LEARNERS.length + ' of ' + SPEC.length + ' legal species');
  /* NOT-LEGAL is legal_scope's own answer for an entity the format does not list at all (`verdict`'s fallback);
   * the three OUT_CODES are for a legal entity nothing can reach. Either is out of the regulation. */
  ok(V.code === 'NOT-LEGAL' || require('../engine/legal_scope.js').OUT_CODES.includes(V.code),
    'legal_scope files Court Change out of scope (' + V.code + ')');
  ok(!!mv.isNonstandard && LEARNERS.length === 0, 'the format marks the move nonstandard and no legal species learns it',
    LEARNERS.length ? show(LEARNERS) : null);
  const body = SPEC.filter(s => learns(s, 'protect')).find(s => K.CS.checkLegal({ species: s.id, ability: s.abilities[0], moves: ['Protect'] }).legal);
  const ctl = body ? K.CS.checkLegal({ species: body.id, ability: body.abilities[0], moves: ['Protect'] }) : null;
  const arm = body ? K.CS.checkLegal({ species: body.id, ability: body.abilities[0], moves: ['Protect', 'Court Change'] }) : null;
  ok(!!ctl && ctl.legal && !ctl.unavailable, 'CONTROL — ' + (body ? body.id : '(no body)') + ' with Protect alone is accepted by the validator',
    ctl && !ctl.legal ? ctl.problems.join(' | ') : null);
  ok(!!arm && !arm.legal && !arm.unavailable && arm.banned.some(p => /court change/i.test(p)),
    'ARM — the same body with Court Change is refused as an EXISTENCE problem naming the move', arm ? arm.problems.join(' | ') : null);
  K.finish();
}

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const QUIET = s => quiet(s) && learns(s, 'protect') && idle(s);
const USER = SPEC.filter(s => learns(s, 'courtchange') && QUIET(s)).sort((a, b) => bulk(b) - bulk(a));
if (!USER.length) { ok(false, 'Court Change is IN scope here, yet no legal learner with a quiet ability was found — construct one; this is not NOT-IN-REGULATION'); K.finish(); }
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
