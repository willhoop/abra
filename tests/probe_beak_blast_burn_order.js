#!/usr/bin/env node
/* tests/probe_beak_blast_burn_order.js — BEAK BLAST'S BURN LANDS IN THE `Hit` EVENT, ABOVE THE ATTACKER'S OWN SECONDARY.
 * 2026-09-24 (ENGINE, abra/regmc narration group N, "burn against sleep").
 *
 *   node tests/probe_beak_blast_burn_order.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_beak_blast_burn_order.js
 *   MEDI_BEAK_BLAST_BURN_AT_DAMAGING_HIT=1   restores the burn in the DamagingHit pass (must exit 1 in both)
 *
 * ================= THE AUTHORITY, READ WHOLE-BLOCK =============================================================
 *
 *   beakblast (data/moves.ts:1119-1146, byte-identical in both checkouts; the Champions mod, moves.ts:47-51 in both,
 *   overrides only basePower and pp):
 *       condition.onHit(target, source, move) {
 *         if (this.checkMoveMakesContact(move, source, target)) source.trySetStatus('brn', target);
 *       }
 *   A volatile's `onHit` is raised by `runEvent('Hit', target, source, move)` inside `runMoveEffects`
 *   (sim/battle-actions.ts:1283, step 3 of `spreadMoveHit`), ABOVE `selfDrops` (step 4, :1096) and `secondaries`
 *   (step 5, :1099), and far above `runEvent('DamagingHit')`. So the attacker is burned BEFORE its own move's
 *   secondary status lands on the Beak Blast user.
 *
 *   The field case (Reg M-C, `…2683663169`, turn 2): Sneasler's Dire Claw into a charging Toucannon. The authority
 *   writes `|-status|p2b: Sneasler|brn` then `|-status|p1a: Toucannon|slp`; the engine wrote them the other way round.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ==========================
 *
 *   STATUS  the foe hits the charging Beak Blast user with a contact move whose secondary inflicts a non-burn status
 *           (derived: the surest such move the cast can learn). Two `-status` lines; their order is the question.
 *   PLAIN   the same foe hits it with a contact move that carries no secondary: only the burn. The control -- it
 *           agreed before the fix and must still agree.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_beak_blast_burn_order', ['MEDI_BEAK_BLAST_BURN_AT_DAMAGING_HIT'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, legal, plain, idle } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const USER = SPEC.filter(s => quiet(s) && learns(s, 'beakblast') && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
if (!USER.length) { console.log('  NOT RUN — no quiet Beak Blast learner in ' + K.CS.FORMAT); process.exit(2); }
/* a contact move whose ONLY secondary is a non-burn status on the target, and nothing else unusual */
const statusSec = m => {
  const s = m.secondary || (m.secondaries && m.secondaries.length === 1 ? m.secondaries[0] : null);
  return s && s.status && s.status !== 'brn' && !s.self && !s.volatileStatus && !s.boosts ? s : null;
};
const STATUS_MOVES = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.flags.contact && m.target === 'normal'
  && statusSec(m) && !m.priority && !m.multihit && !m.onHit && !m.onAfterHit && !m.self && !m.recoil && !m.drain
  && (m.accuracy === true || m.accuracy === 100))
  .sort((a, b) => statusSec(b).chance - statusSec(a).chance || a.basePower - b.basePower);
console.log('     users: ' + USER.map(s => s.id).join(', ') + '   status contact moves: '
  + STATUS_MOVES.map(m => m.id + '(' + statusSec(m).status + ' ' + statusSec(m).chance + '%)').join(', '));
const IMMUNE = { par: ['Electric'], psn: ['Poison', 'Steel'], tox: ['Poison', 'Steel'], frz: ['Ice'], slp: [] };
const FOE = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));

const KEEP = /^\|(move|-status|-damage|-singleturn|faint)\|/;
const SEEN = () => { const S = (K.M && K.M.MEDSEEN) || {}; return { beakBurnAtHitEvent: S.beakBurnAtHitEvent | 0 }; };
function arm(tag, pickMove) {
  for (const u of USER) for (const f of FOE) {
    if (f.baseSpecies === u.baseSpecies || f.types.includes('Fire')) continue;   // a Fire foe cannot be burned
    const mv = pickMove(f, u); if (!mv) continue;
    const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id]);
    const fl = pickDistinct(FOE.filter(s => !used.has(s.baseSpecies)), used, 3);
    if (fl.length < 3) continue;
    const A = [mon(u, '', ['Beak Blast', 'Protect']), mon(fl[0], '', ['Protect']), mon(fl[2], '', ['Protect']), mon(fl[1], '', ['Protect'])];
    const B = [mon(f, '', [mv.name, 'Protect']), mon(fl[1], '', ['Protect', idle(fl[1]).name]), mon(fl[0], '', ['Protect']), mon(fl[2], '', ['Protect'])];
    const R = K.play(tag, A, B, [{ p1: [{ m: 'beakblast', t: 0 }, P.protect], p2: [{ m: mv.id, t: 0 }, { m: idle(fl[1]).id }] }], KEEP, SEEN);
    if (!R.staged) { console.log('   (skip ' + tag + ' ' + u.id + '/' + f.id + ': ' + R.why + ')'); continue; }
    R.cast = f.id + ' ' + mv.id + ' into ' + u.id + '\'s Beak Blast charge';
    return R;
  }
  return null;
}
const lands = (m, tgt) => D.getImmunity(m.type, tgt) && !(IMMUNE[statusSec(m) ? statusSec(m).status : ''] || []).some(t => tgt.types.includes(t));
const ST = arm('STATUS', (f, u) => STATUS_MOVES.find(m => learns(f, m.id) && lands(m, u)) || null);
const PL = arm('PLAIN', (f, u) => D.moves.all().filter(m => plain(m) && m.flags.contact && !m.multihit && (m.accuracy === true || m.accuracy === 100)
  && learns(f, m.id) && D.getImmunity(m.type, u)).sort((a, b) => a.basePower - b.basePower)[0] || null);
if (!ST || !PL) { console.log('  NOT RUN — an arm did not stage (' + (!ST ? 'STATUS' : 'PLAIN') + ')'); process.exit(2); }
K.printArms([['STATUS', ST], ['PLAIN', PL]]);

console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const iBrn = ST.sdK.findIndex(l => /^\|-status\|p2a:[^|]*\|brn/.test(l));
const iOwn = ST.sdK.findIndex(l => /^\|-status\|p1a:/.test(l));
ok(iBrn >= 0 && iOwn >= 0, 'STATUS — the authority burns the attacker AND lands the attacker\'s own secondary', 'brn at ' + iBrn + ', secondary at ' + iOwn);
ok(iBrn >= 0 && iOwn >= 0 && iBrn < iOwn, 'STATUS — the burn (the Hit event) is written ABOVE the secondary', ST.sdK.filter(l => /-status/.test(l)).join('  '));
ok(PL.sdK.some(l => /^\|-status\|p2a:[^|]*\|brn/.test(l)), 'PLAIN — a bare contact hit is burned');

K.compareArms([['STATUS', ST], ['PLAIN', PL]], /^\|(-status|-damage)\|/, '-status / -damage');
const atHit = !process.env.MEDI_BEAK_BLAST_BURN_AT_DAMAGING_HIT;
ok((ST.counters.beakBurnAtHitEvent >= 1) === atHit, 'STATUS — the burn was paid at the Hit event: ' + (atHit ? 'yes' : 'no (knob)'), JSON.stringify(ST.counters));
K.finish();
