#!/usr/bin/env node
/* tests/probe_regmc_revive_residual_inactive.js — A BODY REVIVAL BLESSING BRINGS BACK INTO AN ACTIVE SLOT, WAITING FOR ITS
 * INSTASWITCH BEHIND THE RESIDUAL, IS NOT ACTIVE: THE RESIDUAL HEALS IT NOTHING. 2026-09-22 (abra/regmc 0.59.0).
 *
 *   node tests/probe_regmc_revive_residual_inactive.js --regulation regmc                                   # green, exit 0
 *   MEDI_REVIVE_PENDING_TAKES_RESIDUAL=1 node tests/probe_regmc_revive_residual_inactive.js --regulation regmc # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   sim/battle.ts :2781-2798 (`case 'revivalblessing'`): the target's `fainted` is cleared and its HP set, and an
 *       `instaswitch` is APPENDED behind the residual when no move is left to come -- but nothing sets `isActive`, which
 *       `faintMessages` cleared (:2566) and only `switchIn` sets again (sim/battle-actions.ts :135).
 *   sim/battle.ts fieldEvent :484-566 finds the body (it stands in `side.active`), and Grassy Terrain's `onResidual`
 *       (data/moves.ts :7711-7716, not in the Champions mod) calls `this.heal(...)` -- whose `if (!target.isActive) return
 *       false;` (sim/battle.ts :2274) refuses it silently. `spreadDamage` (:2109) and `boost` (:2030) carry the same test.
 *
 *   The pinned 1950 card (`pair-speedctrl …bo3-2684749333` t8): Pawmot revives Rillaboom into the empty p1a slot as the
 *   turn's last action; the authority writes no Grassy Terrain heal for it (87/175 at the switch), this engine healed it
 *   (97/175).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   LAST      a Prankster partner's Memento faints it and the reviver's move brings it back after every foe has moved,
 *             under a foe's Grassy Surge: it waits through the residual and takes no Grassy heal.
 *   NOW       the same with a slower foe still to move: it switches straight in, is active at the residual, and is healed
 *             (the control that the heal reaches a revived body at all).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_revive_residual_inactive', ['MEDI_REVIVE_PENDING_TAKES_RESIDUAL']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const REV = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).revivesFainted);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
const MV = D.moves.get(REV[0] || '');
if (!REV.length || !K.legal(MV)) { ok(false, 'a legal move carries revivesFainted'); K.finish(); }
const USERS = SPEC.filter(s => learns(s, MV.id) && learns(s, 'protect'));
const KOM = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.selfdestruct && m.target === 'normal');
const PRANK = D.abilities.all().filter(a => K.legal(a) && a.onModifyPriority && /category === ['"]Status['"]/.test(String(a.onModifyPriority))).map(a => a.id);
const grounded = s => !s.types.includes('Flying') && !abil(s).includes('levitate');
const FAINTERS = SPEC.filter(s => KOM.some(m => learns(s, m.id)) && abil(s).some(a => PRANK.includes(a)) && learns(s, 'protect') && grounded(s));
const SURGE = D.abilities.all().filter(a => K.legal(a) && /setTerrain\(['"]grassyterrain['"]\)/.test(String(a.onStart || ''))).map(a => a.id);
const SURGERS = SPEC.filter(s => abil(s).some(a => SURGE.includes(a)) && learns(s, 'protect'));
const SCARF = D.items.all().find(i => K.legal(i) && i.onModifySpe && /chainModify\(1\.5\)/.test(String(i.onModifySpe)));
console.log('     ' + MV.id + ' users: ' + show(USERS) + '   fainters (grounded, Prankster): ' + show(FAINTERS)
  + '   Grassy Surge: ' + show(SURGERS) + '   speed item: ' + (SCARF ? SCARF.id : '(none)'));
const spe = s => s.baseStats.spe;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && K.idle(s) && !s.types.includes('Dark')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(switch|-heal|faint|move|upkeep)\|?/;
const OWN = /^\|(switch|-heal|faint|upkeep)\|?/;
const counters = () => ({ insta: K.M.MEDSEEN.reviveInstaswitch || 0, skipped: K.M.MEDSEEN.residualSkippedRevivePending || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let LS = null, NW = null;
outer: for (const u of USERS) for (const f of FAINTERS) for (const g of SURGERS) {
  const km = KOM.find(m => learns(f, m.id));
  const pr = abil(f).find(a => PRANK.includes(a));
  const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id, g.baseSpecies, g.id]);
  if (new Set([u.baseSpecies, f.baseSpecies, g.baseSpecies]).size < 3) continue;
  const slow = FILL.filter(s => !used.has(s.baseSpecies) && spe(s) + 25 <= spe(u));
  const fast = SCARF ? FILL.filter(s => !used.has(s.baseSpecies) && spe(s) * 1.5 >= spe(u) + 40) : [];
  if (!slow.length || !fast.length) continue;
  const us2 = new Set([...used, slow[0].baseSpecies, fast[0].baseSpecies]);
  const bn = pickDistinct(FILL.filter(s => !us2.has(s.baseSpecies)), us2, 4);
  if (bn.length < 4 || slow[0].baseSpecies === fast[0].baseSpecies) continue;
  const gab = abil(g).find(a => SURGE.includes(a));
  const A = [mon(u, '', [MV.name, 'Protect'], quiet(u) || undefined), mon(f, '', [km.name, 'Protect'], pr), mon(bn[0], '', ['Protect']), mon(bn[1], '', ['Protect'])];
  const foes = (x, it0) => [mon(x, it0 || '', [K.idle(x).name, 'Protect']), mon(g, '', ['Protect'], gab), mon(bn[2], '', ['Protect']), mon(bn[3], '', ['Protect'])];
  /* one turn: the Memento faints our partner, the reviver brings it back; foe slot b (the surge carrier) protects */
  const turn = x => [{ p1: [{ m: MV.id }, { m: km.id, t: 0 }], p2: [{ m: K.idle(x).id }, P.protect] }];
  const l = play('last', A, foes(fast[0], SCARF.name), turn(fast[0]));
  if (!l.staged) { console.log('   (skip ' + [u.id, f.id, g.id].join('/') + ' last: ' + l.why + ')'); continue; }
  const n = play('now', A, foes(slow[0]), turn(slow[0]));
  if (!n.staged) { console.log('   (skip now ' + n.why + ')'); continue; }
  l.cast = g.id + ' (' + gab + ') up; ' + f.id + ' ' + km.id + ' then ' + u.id + ' ' + MV.id + ' last (foe ' + fast[0].id + ' @ ' + SCARF.id + ' moved first)';
  n.cast = 'the same with a slower foe ' + slow[0].id + ' still to move';
  l.fid = n.fid = K.canon(f.name.split('-')[0]);
  LS = l; NW = n; break outer;
}
const RUNS = [['LAST', LS], ['NOW', NW]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const iSw = R => R.sdK.findIndex((l, i) => new RegExp('^\\|switch\\|p1[ab]:' + R.fid).test(l) && R.sdK.slice(0, i).some(x => /\[from\]move:revivalblessing/.test(x)));
const grassyOn = R => R.sdK.filter(l => new RegExp('^\\|-heal\\|p1[ab]:' + R.fid + '\\|[^|]*\\|\\[from\\]grassyterrain').test(l)).length;
const iUp = R => R.sdK.findIndex(l => /^\|upkeep/.test(l));
ok(iSw(LS) > iUp(LS) && grassyOn(LS) === 0, 'LAST — it switches in after the residual and the terrain healed it nothing');
ok(iSw(NW) >= 0 && iSw(NW) < iUp(NW) && grassyOn(NW) === 1, 'NOW — it switches straight in and the residual heals it');

K.compareArms(RUNS, OWN, 'switch / -heal / faint / upkeep');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(LS.counters.skipped >= 1 && NW.counters.skipped === 0, 'the engine\'s receipt: the pending body passed over by the residual in LAST, never in NOW',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
