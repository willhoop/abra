#!/usr/bin/env node
/* tests/probe_regmc_steel_beam_protect.js — A MOVE WHOSE OWN `onMoveFail` CHARGES ITS USER (STEEL BEAM) PAYS WHEN A
 * PROTECT STOPS IT, UNDER REG M-C. 2026-09-22 (abra/regmc 0.49.0).
 *
 *   node tests/probe_regmc_steel_beam_protect.js --regulation regmc                                # green, exit 0
 *   MEDI_FAIL_RECOIL_SHIELD_FREE=1 node tests/probe_regmc_steel_beam_protect.js --regulation regmc   # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts steelbeam :17876-17892 (the Champions mod does not name it):
 *       mindBlownRecoil: true,
 *       onMoveFail(target, source, move) { if (move.multihit) return;
 *           this.damage(Math.round(source.maxhp / 2), source, source, this.dex.conditions.get('Steel Beam')); }
 *   sim/battle-actions.ts useMoveInner :509-533: `if (!targets.length) { ... return false; }` (no charge), then
 *   `moveResult = this.trySpreadMoveHit(...)`; `if (!moveResult) { ... singleEvent('MoveFail', ...) }`. A target every
 *   one of whose Protects answered leaves `moveResult` falsy, so the user is charged half its maximum HP. The move is
 *   found by its TAG (`recoil {of: 'maxhp', paidOnFail: true}`), and the tag is checked against the dex below.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   SHIELD    turn 1 the user's Steel Beam into a foe that Protects: the user pays half its maximum HP.
 *   HIT       the same foe idles and is hit: the ordinary recoil (already paid before this fix).
 *   CONTROL   the SHIELD arm with the user's plain move in place of Steel Beam: nothing is paid.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_steel_beam_protect', ['MEDI_FAIL_RECOIL_SHIELD_FREE']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const TAGGED = Object.keys(TAGS.moves).filter(m => { const r = (TAGS.moves[m].params || {}).recoil; return r && r.of === 'maxhp' && r.paidOnFail; });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     recoil {of: maxhp, paidOnFail}: ' + (TAGGED.join(', ') || '(none)'));
const DEXM = D.moves.all().filter(m => K.legal(m) && m.category !== 'Status' && m.onMoveFail && /\bdamage\(/.test(String(m.onMoveFail))
  && (m.mindBlownRecoil || m.chloroblastRecoil));
console.log('     legal damaging moves with a max-HP recoil AND a damaging onMoveFail (dex): ' + DEXM.map(m => m.id).join(', '));
ok(DEXM.length > 0 && DEXM.length === TAGGED.length && DEXM.every(m => TAGGED.includes(m.id)),
  'the tag and the dex name the same moves', 'dex ' + DEXM.map(m => m.id) + ' vs tag ' + TAGGED);
const MV = DEXM[0];
if (!MV) K.finish();
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const USERS = FILL.filter(s => learns(s, MV.id));
console.log('     users (quiet, learn ' + MV.id + ' and Protect): ' + show(USERS));
const KEEP = /^\|(-damage|-activate|-singleturn|-fail|-miss)\|/;
const OWN = /^\|(-damage|-activate)\|/;
const counters = () => ({ paid: K.M.MEDSEEN.failRecoilPaidOnShield || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let SH = null, HI = null, CT = null;
outer: for (const u of USERS) {
  /* the foe takes Steel Beam neutrally or resisted and survives it, and learns Protect */
  for (const foe of FILL.filter(s => s.baseSpecies !== u.baseSpecies && D.getImmunity(MV.type, s) && D.getEffectiveness(MV.type, s) < 0).slice(0, 12)) {
    const ctl = K.hitFor(u, foe, m => m.id !== MV.id);
    const fi = K.idle(foe);
    if (!ctl || !fi) continue;
    const used = new Set([u.baseSpecies, u.id, foe.baseSpecies, foe.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
    if (fills.length < 3) continue;
    const A = mv1 => [mon(u, '', [mv1, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const B = [mon(foe, '', ['Protect', fi.name]), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const t = (id, foeClick) => ({ p1: [{ m: id, t: 0 }, P.protect], p2: [foeClick, P.protect] });
    const r = play('shield', A(MV.name), B, [t(MV.id, P.protect)]);
    if (!r.staged) { console.log('   (skip ' + u.id + '/' + foe.id + ': ' + r.why + ')'); continue; }
    const h = play('hit', A(MV.name), B, [t(MV.id, { m: fi.id })]);
    const c = play('control', A(ctl.name), B, [t(ctl.id, P.protect)]);
    if (!h.staged || !c.staged) { console.log('   (skip ' + u.id + '/' + foe.id + ': ' + [h, c].filter(x => !x.staged).map(x => x.why).join('; ') + ')'); continue; }
    r.cast = u.id + ' --' + MV.id + '--> ' + foe.id + ' (Protect)';
    h.cast = u.id + ' --' + MV.id + '--> ' + foe.id + ' (' + fi.id + ')';
    c.cast = u.id + ' --' + ctl.id + '--> ' + foe.id + ' (Protect)';
    SH = r; HI = h; CT = c; break outer;
  }
}
const RUNS = [['SHIELD', SH], ['HIT', HI], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const selfCharge = R => R.sdK.filter(l => new RegExp('^\\|-damage\\|p1a[^|]*\\|[^|]*\\|\\[from\\]' + MV.id + '$').test(l)).length;
const shielded = R => R.sdK.some(l => /^\|-activate\|p2a[^|]*\|move:protect$/.test(l));
ok(shielded(SH) && selfCharge(SH) === 1, 'SHIELD — the Protect answers and the user is charged once, [from] ' + MV.id);
ok(!shielded(HI) && selfCharge(HI) === 1, 'HIT — the foe is hit and the user pays its ordinary recoil');
ok(shielded(CT) && selfCharge(CT) === 0, 'CONTROL — a plain move into the Protect charges nothing');

K.compareArms(RUNS, OWN, '-damage / -activate');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(SH.counters.paid === 1 && HI.counters.paid === 0 && CT.counters.paid === 0,
    'the engine\'s receipt: one shield-exit charge in SHIELD, none in HIT or CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
