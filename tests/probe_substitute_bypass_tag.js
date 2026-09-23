#!/usr/bin/env node
/* tests/probe_substitute_bypass_tag.js — A `bypasssub` MOVE REACHES THE BODY BEHIND A SUBSTITUTE, READ OFF THE TAG.
 * 2026-09-23 (ENGINE pass 10, abra/regmc 0.80.0).
 *
 *   node tests/probe_substitute_bypass_tag.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_substitute_bypass_tag.js
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *   MEDI_SUBPASS_HANDLIST=1             restores the hand-typed 51-id literal (must exit 1 under Reg M-C)
 *
 * ================= THE AUTHORITY (read whole, both checkouts) ==================================================
 *
 *   data/conditions.ts substitute `onTryPrimaryHit`: `if (target === source || move.flags['bypasssub'] || move.infiltrates)
 *   return;` -- the doll is skipped outright and the hit lands on the body. The Champions mods do not override it.
 *   Overdrive carries `bypasssub` in the Reg M-C checkout and is `Past` in Reg M-B. Nothing else in this repo carried the
 *   flag: medicham2 held a 51-id literal, so under Reg M-C every doll ate Overdrive.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ========================
 *
 *   Turn 1: the target raises a Substitute, everybody else Protects. Turn 2: the attacker fires the BYPASS move (the
 *   legal `bypasssub` damaging move it learns; Overdrive in Reg M-C, a sound move in Reg M-B) at the doll-holder.
 *   CONTROL: the same turn with a plain damaging move that does NOT carry `bypasssub` -- the doll must take that one, so
 *   the fixture can show the difference (asserted on the authority).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_substitute_bypass_tag', ['MEDI_SUBPASS_HANDLIST'], { anyRegulation: true });
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P, legal, idle } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
/* every legal damaging bypasssub move, preferring one the old literal did not hold (the reason this probe exists) */
const OLD = new Set(['round', 'snore', 'bugbuzz', 'uproar', 'snarl', 'alluringvoice', 'psychicnoise', 'hypervoice', 'eeriespell',
  'boomburst', 'sparklingaria', 'clangingscales', 'torchsong']);
const BYP = D.moves.all().filter(m => legal(m) && m.flags.bypasssub && m.category !== 'Status' && !m.selfSwitch
  && !m.flags.charge && !m.self && !m.multihit && !m.sleepUsable && !m.onTry).sort((a, b) => (OLD.has(a.id) - OLD.has(b.id)) || (a.basePower - b.basePower));
console.log('     damaging bypasssub moves: ' + BYP.map(m => m.id + (OLD.has(m.id) ? '' : ' (NOT in the old literal)')).join(', '));
const HOLD = SPEC.filter(s => quiet(s) && learns(s, 'substitute') && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));

let R = null, C = null, cast = null;
outer:
for (const mv of BYP) {
  const atts = SPEC.filter(s => learns(s, mv.id) && learns(s, 'protect') && quiet(s));
  for (const at of atts) for (const h of HOLD) {
    if (h.baseSpecies === at.baseSpecies) continue;
    if (!D.getImmunity(mv.type, h) || D.getEffectiveness(mv.type, h) > 0) continue;
    /* the control: a damaging move without `bypasssub`, 100% accurate, one arrival, no self effect or callback */
    const ctl = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && !m.flags.bypasssub && K.sure(m) && !m.multihit
      && !m.flags.charge && !m.flags.recharge && !m.selfSwitch && !m.recoil && !m.drain && !m.self && !m.priority && !m.ohko
      && !m.selfdestruct && !m.basePowerCallback && !m.damageCallback && !m.onTry && !m.onTryHit && !m.onModifyType && m.basePower >= 20
      && (m.target === 'normal' || m.target === 'allAdjacentFoes')
      && learns(at, m.id) && D.getImmunity(m.type, h) && D.getEffectiveness(m.type, h) <= 0).sort((a, b) => a.basePower - b.basePower)[0];
    if (!ctl) continue;
    const used = new Set([at.baseSpecies, at.id, h.baseSpecies, h.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
    if (fills.length < 5) continue;
    const atAb = quiet(at);
    const A = [mon(at, '', ['Protect', mv.name, ctl.name], atAb), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const B = [mon(h, '', ['Substitute', 'Protect', idle(h).name]), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const t1 = { p1: [P.protect, P.protect], p2: [{ m: 'substitute' }, P.protect] };
    const KEEP = /^\|(-activate|-damage|-start|-end|move)\|/;
    const r = K.play('bypass', A, B, [t1, { p1: [{ m: mv.id, t: 0 }, P.protect], p2: [{ m: idle(h).id }, P.protect] }], KEEP);
    const c = K.play('control', A, B, [t1, { p1: [{ m: ctl.id, t: 0 }, P.protect], p2: [{ m: idle(h).id }, P.protect] }], KEEP);
    if (!r.staged || !c.staged) { console.log('   (skip ' + at.id + '/' + h.id + ': ' + (r.why || c.why) + ')'); continue; }
    R = r; C = c; cast = { mv, ctl, at, h, atAb };
    R.cast = at.id + ' (' + atAb + ') ' + mv.id + ' into ' + h.id + ' behind a Substitute';
    C.cast = 'the same, ' + ctl.id + ' (no bypasssub)';
    R.hname = C.hname = K.canon(h.name.split('-')[0]);
    break outer;
  }
}
if (!R) { console.log('  NO CAST FOUND'); process.exit(1); }
K.printArms([['BYPASS', R], ['CONTROL', C]]);

console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const onHolder = (x, re) => x.sdK.filter(l => re.test(l) && l.includes('p2a:' + R.hname));
ok(onHolder(C, /^\|-activate\|p2a:[^|]*\|(move:)?substitute\|\[damage\]/).length === 1,
  'CONTROL — the doll takes the plain hit (' + cast.ctl.id + ')', C.sdK.join('  '));
const after = (x, mvid) => { const nm = K.canon(D.moves.get(mvid).name); const i = x.sdK.findIndex(l => l.startsWith('|move|p1a:') && l.includes('|' + nm + '|')); return i < 0 ? [] : x.sdK.slice(i); };
ok(after(C, cast.ctl.id).some(l => /^\|-activate\|p2a:[^|]*\|(move:)?substitute\|\[damage\]/.test(l)), 'CONTROL — the doll line follows the control move');
ok(after(R, cast.mv.id).length > 0 && !after(R, cast.mv.id)[0].includes('[still]')
  && !after(R, cast.mv.id).some(l => /^\|-activate\|p2a:[^|]*\|(move:)?substitute\|\[damage\]/.test(l))
  && after(R, cast.mv.id).some(l => l.startsWith('|-damage|p2a:' + R.hname)),
  'BYPASS — ' + cast.mv.id + ' skips the doll and damages the body', R.sdK.join('  '));

K.compareArms([['BYPASS', R], ['CONTROL', C]], /^\|(-activate|-damage|-end)\|/, '-activate / -damage / -end');
K.finish();
