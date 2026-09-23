#!/usr/bin/env node
/* tests/probe_regmc_revive.js — REVIVAL BLESSING REVIVES A FAINTED ALLY, UNDER REG M-C. 2026-09-22 (abra/regmc 0.41.0).
 *
 *   node tests/probe_regmc_revive.js --regulation regmc                               # green, exit 0
 *   MEDI_REVIVE_UNMODELLED=1 node tests/probe_regmc_revive.js --regulation regmc      # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts revivalblessing :15110-15136: `slotCondition: 'revivalblessing'`, `selfSwitch: true` -- the switch
 *   request names a FAINTED party member (sim/side.ts :930-975; the answer is a `revivalblessing` action, order 6,
 *   sim/battle-queue.ts :180). sim/battle.ts :2781-2798 runs it:
 *       pokemonLeft++;
 *       if (target.position < side.active.length) queue.addChoice({choice: 'instaswitch', pokemon: target, target});
 *       fainted = false; faintQueued = false; subFainted = false; status = ''; hp = 1; sethp(maxhp / 2);
 *       add('-heal', target, target.getHealth, '[from] move: Revival Blessing');
 *   `addChoice` APPENDS (sim/battle-queue.ts :307-313), after the turn's residual. The queue is re-sorted at the end of
 *   runAction only when the next action is a move (sim/battle.ts :2916-2923), so the instaswitch (order 3) runs AT ONCE
 *   when a move is still to come this turn, and AFTER THE RESIDUAL when none is. `sethp` truncates (sim/pokemon.ts
 *   :1655-1667). A mega stays a mega through its faint under Champions (data/mods/champions/scripts.ts :55-57).
 *   The move is found by its TAG (`revivesFainted`), the faint by the dex (`selfdestruct` on a targeted status move).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   BENCH     turn 1 a Prankster Memento faints the user's partner and a bench body refills the slot; turn 2 the move
 *             revives it to the bench at half, and nobody switches.
 *   NOW       the partner Mementos and the move revives it in the SAME turn, with a slower foe still to move: the
 *             revived body switches straight back in, before that foe.
 *   LAST      the same with every foe already moved: it switches in after the residual.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_revive', ['MEDI_REVIVE_UNMODELLED']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const REV = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).revivesFainted);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     revivesFainted: ' + REV.map(m => m + ' ' + JSON.stringify(TAGS.moves[m].params.revivesFainted)).join('; '));
const MV = D.moves.get(REV[0] || '');
if (!REV.length || !K.legal(MV)) { ok(false, 'a legal move carries revivesFainted'); K.finish(); }
const USERS = SPEC.filter(s => learns(s, MV.id) && learns(s, 'protect'));
/* the faint: a targeted status move whose user faints when it lands (the dex's `selfdestruct`) */
const KOM = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.selfdestruct && m.target === 'normal');
/* its user must move BEFORE the reviver in the same turn: Prankster, read off the dex (a +1 on a status move) */
const PRANK = D.abilities.all().filter(a => K.legal(a) && a.onModifyPriority && /category === ['"]Status['"]/.test(String(a.onModifyPriority))).map(a => a.id);
const FAINTERS = SPEC.filter(s => KOM.some(m => learns(s, m.id)) && abil(s).some(a => PRANK.includes(a)) && learns(s, 'protect'));
console.log('     users: ' + show(USERS) + '   fainting move(s): ' + KOM.map(m => m.id) + '   priority-for-status: ' + PRANK
  + '   fainters: ' + show(FAINTERS));
const spe = s => s.baseStats.spe;
/* LAST needs one foe that outruns the reviver: the legal item that multiplies Speed by 1.5, read off the dex */
const SCARF = D.items.all().find(i => K.legal(i) && i.onModifySpe && /chainModify\(1\.5\)/.test(String(i.onModifySpe)));
console.log('     speed item: ' + (SCARF ? SCARF.id : '(none)'));
/* each foe clicks its idle move ONCE (a second Focus Energy writes `-fail` on the authority only, the kit's own note) and
 * Protect otherwise, never twice running */
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && K.idle(s) && !s.types.includes('Dark')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(switch|-heal|faint|move|upkeep|turn)\|?/;
const OWN = /^\|(switch|-heal|faint|move|upkeep)\|?/;
const counters = () => ({ revived: K.M.MEDSEEN.reviveRevived || 0, insta: K.M.MEDSEEN.reviveInstaswitch || 0,
  unmodelled: K.M.MEDFAILS.reviveUnmodelled || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let BN = null, NW = null, LS = null, AG = null;
const sdIdx = (R, re) => R.sdK.findIndex(l => re.test(l));
outer: for (const u of USERS) for (const f of FAINTERS) {
  const km = KOM.find(m => learns(f, m.id));
  const pr = abil(f).find(a => PRANK.includes(a));
  const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id]);
  const slow = FILL.filter(s => !used.has(s.baseSpecies) && spe(s) + 25 <= spe(u));
  const fast = SCARF ? FILL.filter(s => !used.has(s.baseSpecies) && spe(s) * 1.5 >= spe(u) + 40) : [];
  console.log('     ' + u.id + '/' + f.id + ': ' + slow.length + ' slower foes, ' + fast.length + ' faster (' + show(fast) + ')');
  if (slow.length < 2 || fast.length < 1) continue;
  const benchPool = FILL.filter(s => !used.has(s.baseSpecies));
  const pickFoes = pool => { const us = new Set(used); return pickDistinct(pool, us, 2); };
  const sl = pickFoes(slow), fs2 = pickFoes(fast.concat(slow)).slice(0, 1).concat(pickFoes(slow.filter(s => s.baseSpecies !== fast[0].baseSpecies)).slice(1, 2));
  const us2 = new Set([...used, ...sl.map(s => s.baseSpecies), ...fs2.map(s => s.baseSpecies)]);
  const bn = pickDistinct(benchPool, us2, 4);
  if (sl.length < 2 || fs2.length < 2 || bn.length < 4 || fs2[0] !== fast[0]) continue;
  const A = [mon(u, '', [MV.name, 'Protect'], quiet(u) || undefined), mon(f, '', [km.name, 'Protect'], pr), mon(bn[0], '', ['Protect']), mon(bn[1], '', ['Protect'])];
  const foeTeam = (pair, it0) => [mon(pair[0], it0 || '', [K.idle(pair[0]).name, 'Protect']), mon(pair[1], '', [K.idle(pair[1]).name, 'Protect']),
    mon(bn[2], '', ['Protect']), mon(bn[3], '', ['Protect'])];
  const idleBoth = pair => [{ m: K.idle(pair[0]).id }, { m: K.idle(pair[1]).id }];
  const b = play('bench', A, foeTeam(sl), [
    { p1: [P.protect, { m: km.id, t: 0 }], p2: idleBoth(sl) },
    { p1: [{ m: MV.id }, P.protect], p2: [P.protect, P.protect] }]);
  if (!b.staged) { console.log('   (skip ' + u.id + '/' + f.id + ' bench: ' + b.why + ')'); continue; }
  /* NOW and LAST are one turn: the revive and the instaswitch are that turn's whole question */
  const n = play('now', A, foeTeam(sl), [{ p1: [{ m: MV.id }, { m: km.id, t: 0 }], p2: idleBoth(sl) }]);
  /* LAST: the Memento target is FASTER than the reviver and its partner stands behind Protect (+4), so nothing moves after */
  const l = play('last', A, foeTeam(fs2, SCARF.name), [{ p1: [{ m: MV.id }, { m: km.id, t: 0 }], p2: [{ m: K.idle(fs2[0]).id }, P.protect] }]);
  /* 2026-09-23 (ENGINE pass 10, abra/regmc 0.85.0) -- AGAIN: the NOW turn, then the revived body Mementos a second time and
   * falls again. The authority writes a `|faint|` for EACH death; the engine's once-per-body trace latch swallowed the
   * second (Reg M-C narration group D). */
  const g = play('again', A, foeTeam(sl), [{ p1: [{ m: MV.id }, { m: km.id, t: 0 }], p2: idleBoth(sl) },
    { p1: [P.protect, { m: km.id, t: 0 }], p2: [{ m: K.idle(sl[0]).id }, P.protect] }]);
  if (!n.staged || !l.staged || !g.staged) { console.log('   (skip ' + u.id + '/' + f.id + ': ' + (n.why || l.why || g.why) + ')'); continue; }
  g.cast = n.cast + '; turn 2 the revived body falls again';
  b.cast = f.id + ' (' + pr + ') ' + km.id + ' turn 1, ' + bn[0].id + ' refills, ' + u.id + ' ' + MV.id + ' turn 2, foes ' + sl.map(s => s.id);
  n.cast = f.id + ' ' + km.id + ' then ' + u.id + ' ' + MV.id + ', slower foes ' + sl.map(s => s.id + '(' + spe(s) + ')') + ' still to move';
  l.cast = f.id + ' ' + km.id + ' then ' + u.id + ' ' + MV.id + ' last, a faster foe @ ' + SCARF.id + ' (+ a Protect) ' + fs2.map(s => s.id + '(' + spe(s) + ')');
  b.fid = n.fid = l.fid = g.fid = f.id;
  g.cast = f.id + ' ' + km.id + ' then ' + u.id + ' ' + MV.id + '; turn 2 the revived ' + f.id + ' ' + km.id + 's again';
  BN = b; NW = n; LS = l; AG = g; break outer;
}
const RUNS = [['BENCH', BN], ['NOW', NW], ['LAST', LS], ['AGAIN', AG]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const heal = R => sdIdx(R, /^\|-heal\|p1:[^|]*\|[^|]*\|\[from\]move:revivalblessing/);
const swF = (R, from) => R.sdK.findIndex((l, i) => i > from && new RegExp('^\\|switch\\|p1[ab]:' + R.fid).test(l));
ok(heal(BN) >= 0 && swF(BN, heal(BN)) < 0, 'BENCH — revived at half on the bench, and nobody switches in');
const nH = heal(NW), nS = swF(NW, nH);
ok(nH >= 0 && nS > nH && NW.sdK.slice(nS).some(l => /^\|move\|p2/.test(l)) && !NW.sdK.slice(nH, nS).some(l => /^\|(move|upkeep)\|?/.test(l)),
  'NOW — revived, and switched straight back in before the slower foe moves');
const lH = heal(LS), lS = swF(LS, lH);
ok(lH >= 0 && lS > lH && LS.sdK.slice(lH, lS).some(l => /^\|upkeep/.test(l)), 'LAST — revived, and switched in after the residual');
ok(AG.sdK.filter(l => /^\|faint\|p1[ab]:/.test(l) && l.endsWith(':' + AG.fid)).length === 2, 'AGAIN — the authority writes a second `|faint|` for the revived body');

K.compareArms(RUNS, OWN, 'switch / -heal / faint / move / upkeep');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  const c = RUNS.map(([, R]) => R.counters);
  ok(c.every(x => x.revived === 1 && x.unmodelled === 0) && c[0].insta === 0 && c[1].insta === 1 && c[2].insta === 1 && c[3].insta === 1,
    'the engine\'s receipts: one revive per arm, the two active-slot arms switched in, none unmodelled', JSON.stringify(c));
}
K.finish();
