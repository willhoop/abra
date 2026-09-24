#!/usr/bin/env node
/* tests/probe_gravity_called_move.js — GRAVITY REFUSES A GRAVITY-FLAGGED MOVE THAT ANOTHER MOVE CALLED. 2026-09-24.
 *
 *   node tests/probe_gravity_called_move.js                          Reg M-B (SHOWDOWN_PATH = the M-B checkout)
 *   node tests/probe_gravity_called_move.js --regulation regmc       Reg M-C
 *   ... --medi <path>                                                the pre-fix engine bytes (the RED proof)
 *   MEDI_GRAVITY_CALLED_MOVE_PLAYS=1                                 restores the called-move defect (must exit 1)
 *   MEDI_GRAVITY_CLICKED_MOVE_PLAYS=1                                restores the chosen-move defect (must exit 1)
 *
 * ================= THE AUTHORITY (data/moves.ts gravity.condition; identical in both checkouts, no Champions override) ====
 *
 *     onBeforeMovePriority: 6,
 *     onBeforeMove(pokemon, target, move) {
 *       if (move.flags['gravity'] && !move.isZ) { this.add('cant', pokemon, 'move: Gravity', move); return false; } },
 *     onModifyMove(move, pokemon, target) {
 *       if (move.flags['gravity'] && !move.isZ) { this.add('cant', pokemon, 'move: Gravity', move); return false; } },
 *
 *   `BeforeMove` runs only in `runMove`, i.e. for the move the body CHOSE. A move another move CALLS goes through
 *   `useMove` -> `useMoveInner` (sim/battle-actions.ts, identical in both checkouts), which skips BeforeMove and runs
 *   `runEvent('ModifyMove', ...)`; a `false` there returns before the `|move|` line. So the called move is refused by
 *   the `onModifyMove` half, with the same `|cant|<body>|move: Gravity|<move>` line.
 *
 * ================= WHICH CALLERS ARE LEGAL (derived below and printed) ===============================================
 *
 *   The format's move callers are the moves whose handler calls `this.actions.useMove(`. Metronome, Assist, Me First,
 *   Mirror Move and Nature Power are `isNonstandard: 'Past'` in both regulations; SLEEP TALK and COPYCAT are legal. A
 *   Sleep Talk can draw High Jump Kick, Flying Press or Magnet Rise (Fly and Bounce carry `charge`, which it skips).
 *   A Copycat copies `battle.lastMove`, and in Gen 9 a called move that Gravity refused IS that last move.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ============================
 *
 *   SLEEPTALK  turn 1 the foe Yawns the caller and its partner sets Gravity; turn 3 the (now sleeping) caller clicks
 *              Sleep Talk, whose only candidate is the gravity-flagged move -> `cant ... move: Gravity`.
 *   COPYCAT    the same, and a slower Copycat user clicks Copycat after the Sleep Talk -> it copies the refused move
 *              and Gravity refuses it again.
 *   CONTROL    the SLEEPTALK arm with no Gravity click: the called move lands (the knob is not dead in the authority).
 *   DIRECT     the onBeforeMove half: a body slower than the Gravity user clicks a gravity-flagged move that turn.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_gravity_called_move', ['MEDI_GRAVITY_CALLED_MOVE_PLAYS', 'MEDI_GRAVITY_CLICKED_MOVE_PLAYS'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, idle, legal } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const learnable = m => SPEC.some(s => learns(s, m.id));
const CALLERS = D.moves.all().filter(m => m.exists && Object.values(m).some(v => typeof v === 'function' && /actions\.useMove\(/.test(String(v))));
console.log('     move callers in the dex: ' + CALLERS.map(m => m.id + (legal(m) && learnable(m) ? ' LEGAL' : ' (not in the regulation)')).join(', '));
const GRAV = D.moves.all().filter(m => legal(m) && learnable(m) && m.flags.gravity);
console.log('     gravity-flagged moves in the regulation: ' + GRAV.map(m => m.id + (m.flags.charge ? ' (charge: Sleep Talk skips it)' : '')).join(', '));
if (!legal(D.moves.get('sleeptalk')) || !legal(D.moves.get('copycat'))) { console.log('  NOT RUN — Sleep Talk or Copycat is not legal in ' + K.CS.FORMAT); process.exit(2); }

const spe = s => s.baseStats.spe;
const QUIET = s => quiet(s) && idle(s);
/* the caller: Sleep Talk + one damaging gravity-flagged move and NOTHING else, so Sleep Talk's draw has one candidate */
const CALLED = GRAV.filter(m => !m.flags.charge && m.category !== 'Status' && m.target === 'normal');
const USERS = [];
/* the caller clicks only Sleep Talk, so it needs a quiet ability and no idle click */
for (const m of CALLED) for (const s of SPEC) if (quiet(s) && learns(s, 'sleeptalk') && learns(s, m.id)) USERS.push({ s, m });
USERS.sort((a, b) => bulk(b.s) - bulk(a.s));
const YAWN = SPEC.filter(s => QUIET(s) && learns(s, 'yawn')).sort((a, b) => bulk(b) - bulk(a));
const GRAVS = SPEC.filter(s => QUIET(s) && learns(s, 'gravity')).sort((a, b) => bulk(b) - bulk(a));
const COPY = SPEC.filter(s => QUIET(s) && learns(s, 'copycat')).sort((a, b) => spe(a) - spe(b));
console.log('     Sleep Talk + gravity move: ' + USERS.slice(0, 6).map(x => x.s.id + '/' + x.m.id).join(', ')
  + '   yawn: ' + show(YAWN) + '   gravity: ' + show(GRAVS) + '   copycat (slowest first): ' + show(COPY));

const KEEP = /^\|(cant|move|-damage|-fail|-fieldstart|-start|-status|-miss|-activate)\|?/;
const q = s => ({ m: idle(s).id });
let ST = null, CC = null, CO = null;
outer:
for (const u of USERS) for (const y of YAWN) for (const g of GRAVS) for (const c of COPY) {
  if (spe(c) >= spe(u.s)) continue;                    /* the Copycat must move after the Sleep Talk */
  const used = new Set();
  const cast = pickDistinct([u.s, c, y, g], used, 4);
  if (cast.length < 4 || cast[0] !== u.s || cast[1] !== c || cast[2] !== y || cast[3] !== g) continue;
  const fills = pickDistinct(SPEC.filter(s => QUIET(s) && !used.has(s.baseSpecies)).sort((a, b) => bulk(b) - bulk(a)), used, 2);
  if (fills.length < 2) continue;
  const A = [mon(u.s, '', ['Sleep Talk', u.m.name]), mon(c, '', ['Copycat', idle(c).name]), mon(fills[0], '', [idle(fills[0]).name]), mon(fills[1], '', [idle(fills[1]).name])];
  const B = [mon(y, '', ['Yawn', idle(y).name]), mon(g, '', ['Gravity', idle(g).name]), mon(fills[0], '', [idle(fills[0]).name]), mon(fills[1], '', [idle(fills[1]).name])];
  const B0 = [mon(y, '', ['Yawn', idle(y).name]), mon(g, '', [idle(g).name]), mon(fills[0], '', [idle(fills[0]).name]), mon(fills[1], '', [idle(fills[1]).name])];
  const t1 = grav => ({ p1: [{ m: 'sleeptalk' }, q(c)], p2: [{ m: 'yawn', at: 'p1a' }, grav ? { m: 'gravity' } : q(g)] });
  const t2 = { p1: [{ m: 'sleeptalk' }, q(c)], p2: [q(y), q(g)] };
  const t3 = copy => ({ p1: [{ m: 'sleeptalk' }, copy ? { m: 'copycat' } : q(c)], p2: [q(y), q(g)] });
  const st = K.play('sleeptalk', A, B, [t1(true), t2, t3(false)], KEEP);
  const cc = K.play('copycat', A, B, [t1(true), t2, t3(true)], KEEP);
  const co = K.play('control', A, B0, [t1(false), t2, t3(false)], KEEP);
  if (!st.staged || !cc.staged || !co.staged) { console.log('   (skip ' + u.s.id + '/' + c.id + '/' + y.id + '/' + g.id + ': ' + (st.why || cc.why || co.why) + ')'); continue; }
  st.cast = u.s.id + ' Sleep Talk -> ' + u.m.id + '; ' + y.id + ' Yawn, ' + g.id + ' Gravity';
  cc.cast = st.cast + '; ' + c.id + ' Copycat after it';
  co.cast = st.cast.replace(', ' + g.id + ' Gravity', ', no Gravity');
  ST = st; CC = cc; CO = co; ST.move = u.m; ST.user = u.s; CC.copier = c; break outer;
}
if (!ST) { console.log('  NO CAST FOUND'); process.exit(1); }
/* DIRECT: the chosen-move half (onBeforeMove), same line. A body slower than the Gravity user clicks a gravity-flagged
 * move the turn Gravity goes up. Staged apart from the three arms above so their cast is unchanged. */
let DI = null;
{
  const CLICK = [];
  for (const g of GRAVS) for (const m of GRAV) for (const s of SPEC)
    if (quiet(s) && learns(s, m.id) && spe(s) < spe(g) && s.baseSpecies !== g.baseSpecies) CLICK.push({ s, m, g });
  CLICK.sort((a, b) => spe(a.s) - spe(b.s));
  for (const d of CLICK) {
    const used = new Set();
    if (pickDistinct([d.s, d.g], used, 2).length < 2) continue;
    const fills = pickDistinct(SPEC.filter(s => QUIET(s) && !used.has(s.baseSpecies)).sort((a, b) => bulk(b) - bulk(a)), used, 3);
    if (fills.length < 3) continue;
    const A = [mon(d.s, '', [d.m.name]), mon(fills[0], '', [idle(fills[0]).name]), mon(fills[1], '', [idle(fills[1]).name]), mon(fills[2], '', [idle(fills[2]).name])];
    const B = [mon(fills[1], '', [idle(fills[1]).name]), mon(d.g, '', ['Gravity']), mon(fills[0], '', [idle(fills[0]).name]), mon(fills[2], '', [idle(fills[2]).name])];
    const click = d.m.target === 'self' ? { m: d.m.id } : { m: d.m.id, at: 'p2a' };
    const r = K.play('direct', A, B, [{ p1: [click, q(fills[0])], p2: [q(fills[1]), { m: 'gravity' }] }], KEEP);
    if (!r.staged) { console.log('   (skip direct ' + d.s.id + '/' + d.m.id + ': ' + r.why + ')'); continue; }
    r.cast = d.s.id + ' clicks ' + d.m.id + ' after ' + d.g.id + ' Gravity'; r.move = d.m; DI = r; break;
  }
}
K.printArms([['SLEEPTALK', ST], ['COPYCAT', CC], ['CONTROL', CO], ['DIRECT', DI]]);

console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const mv = K.canon(ST.move.name), has = (x, re) => x.sdK.some(l => re.test(l));
const cantRe = new RegExp('^\\|cant\\|p1a:[^|]*\\|move:gravity\\|' + mv + '$');
ok(has(ST, /^\|move\|p1a:[^|]*\|sleeptalk/) && has(ST, cantRe), 'SLEEPTALK — the sleeping caller clicks Sleep Talk and Gravity refuses the called ' + ST.move.name);
ok(!ST.sdK.some(l => new RegExp('^\\|move\\|p1a:[^|]*\\|' + mv).test(l)), 'SLEEPTALK — the called move never reaches its `|move|` line');
ok(has(CC, new RegExp('^\\|move\\|p1b:[^|]*\\|copycat')) && has(CC, new RegExp('^\\|cant\\|p1b:[^|]*\\|move:gravity\\|' + mv + '$')),
  'COPYCAT — Copycat copies the refused ' + ST.move.name + ' and Gravity refuses it again');
ok(has(CO, new RegExp('^\\|move\\|p1a:[^|]*\\|' + mv)) && !CO.sdK.some(l => /^\|cant\|[^|]*\|move:gravity/.test(l)),
  'CONTROL — with no Gravity up the called ' + ST.move.name + ' lands (the knob is live in the authority)');

ok(has(DI, new RegExp('^\\|cant\\|p1a:[^|]*\\|move:gravity\\|' + K.canon(DI.move.name) + '$')),
  'DIRECT — the chosen ' + DI.move.name + ' is refused by Gravity\'s onBeforeMove half');

/* The authority's called-move `|move|` line carries `[from] move: Sleep Talk` and this engine's does not; the driver
 * declares that narration difference (its first-divergence field is NONE on the CONTROL arm), so it is folded here. */
for (const R of [ST, CC, CO, DI]) for (const k of ['sdK', 'meK']) R[k] = R[k].map(l => /^\|move\|/.test(l) ? l.replace(/\|\[from\][^|]*$/, '') : l);
K.compareArms([['SLEEPTALK', ST], ['COPYCAT', CC], ['CONTROL', CO], ['DIRECT', DI]], /^\|(cant|move|-damage|-fail)\|?/, 'cant / move / -damage / -fail');
K.finish();
