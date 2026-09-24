#!/usr/bin/env node
/* tests/probe_regmc_revive_leppa_order.js — A REVIVER'S LEPPA BERRY IS EATEN BEFORE THE REVIVE, UNDER REG M-C.
 * 2026-09-24 (ENGINE, abra/regmc narration, "the last two causes").
 *
 *   node tests/probe_regmc_revive_leppa_order.js --regulation regmc                            # green, exit 0
 *   MEDI_REVIVE_HEAL_INLINE=1 node tests/probe_regmc_revive_leppa_order.js --regulation regmc  # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts revivalblessing :15110-15136 -- `pp: 1, noPPBoosts: true`, `slotCondition`, `selfSwitch: true`. The MOVE
 *   revives nobody: it raises a switch request. sim/battle.ts runAction's tail after the move (:2860-2913):
 *       if (this.gen >= 5 && action.choice !== 'start') { this.eachEvent('Update'); ... }     <- Leppa's onUpdate
 *       ...
 *       for (const playerSwitch of switches) if (playerSwitch) { this.makeRequest('switch'); return true; }
 *   and only the ANSWER, a `revivalblessing` action (order 6, sim/battle-queue.ts :180), runs the revive (:2781-2798):
 *       ... sethp(maxhp / 2); this.add('-heal', target, target.getHealth, '[from] move: Revival Blessing');
 *   The move's one PP is spent before it runs, so a held Leppa Berry (`onUpdate`: a move slot at 0 PP, data/items.ts
 *   leppaberry; the Champions mod does not override it) is eaten in that Update pass -- ABOVE the `-heal`:
 *       |-enditem|p2a: Pawmot|Leppa Berry|[eat]
 *       |-activate|p2a: Pawmot|item: Leppa Berry|Revival Blessing|[consumed]
 *       |-heal|p2: Rillaboom|87/175|[from] move: Revival Blessing
 *   Field case: Reg M-C lattice 1200, release 78fb4a85b1a0, baseline `…2680802524 vs …2680902499`
 *   (data/verification/gd-regmc-merged-dump.json). The engine wrote the `-heal` first.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   BENCH     turn 1 a Prankster Memento faints the partner and a bench body refills; turn 2 the Leppa holder revives it
 *             to the bench.
 *   NOW       the partner Mementos and the Leppa holder revives it the same turn, a slower foe still to move: the revived
 *             body switches straight back in.
 *   LAST      the same with every foe already moved: it switches in after the residual.
 * The move is found by its TAG (`revivesFainted`), the berry by its TAG (`restoresPP`), never by name.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_revive_leppa_order', ['MEDI_REVIVE_HEAL_INLINE']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const REV = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).revivesFainted);
const BERRY = Object.keys(TAGS.items).filter(i => ((TAGS.items[i].params || {}).restoresPP || {}).eatsWhenASlotEmpties);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     revivesFainted: ' + REV.join(', ') + '   restoresPP (eats on an empty slot): ' + BERRY.join(', '));
const MV = D.moves.get(REV[0] || '');
const IT = D.items.get(BERRY[0] || '');
if (!REV.length || !K.legal(MV) || !BERRY.length || !K.legal(IT)) { ok(false, 'a legal move carries revivesFainted and a legal item restoresPP'); K.finish(); }
console.log('     ' + MV.id + ' pp ' + MV.pp + (MV.noPPBoosts ? ' (no PP boosts)' : '') + ' -- one use empties the slot');
const USERS = SPEC.filter(s => learns(s, MV.id) && learns(s, 'protect'));
const KOM = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.selfdestruct && m.target === 'normal');
const PRANK = D.abilities.all().filter(a => K.legal(a) && a.onModifyPriority && /category === ['"]Status['"]/.test(String(a.onModifyPriority))).map(a => a.id);
const FAINTERS = SPEC.filter(s => KOM.some(m => learns(s, m.id)) && abil(s).some(a => PRANK.includes(a)) && learns(s, 'protect'));
console.log('     users: ' + show(USERS) + '   fainting move(s): ' + KOM.map(m => m.id) + '   fainters: ' + show(FAINTERS));
const spe = s => s.baseStats.spe;
const SCARF = D.items.all().find(i => K.legal(i) && i.onModifySpe && /chainModify\(1\.5\)/.test(String(i.onModifySpe)));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && K.idle(s) && !s.types.includes('Dark')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(switch|-heal|faint|move|upkeep|turn|-enditem|-activate)\|?/;
const OWN = /^\|(switch|-heal|faint|move|upkeep|-enditem)\|?|^\|-activate\|[^|]*\|item:/;
const counters = () => ({ revived: K.M.MEDSEEN.reviveRevived || 0, deferred: K.M.MEDSEEN.reviveAppliedAfterUpdate || 0,
  unmodelled: K.M.MEDFAILS.reviveUnmodelled || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let BN = null, NW = null, LS = null;
outer: for (const u of USERS) for (const f of FAINTERS) {
  const km = KOM.find(m => learns(f, m.id));
  const pr = abil(f).find(a => PRANK.includes(a));
  const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id]);
  const slow = FILL.filter(s => !used.has(s.baseSpecies) && spe(s) + 25 <= spe(u));
  const fast = SCARF ? FILL.filter(s => !used.has(s.baseSpecies) && spe(s) * 1.5 >= spe(u) + 40) : [];
  if (slow.length < 2 || fast.length < 1) continue;
  const benchPool = FILL.filter(s => !used.has(s.baseSpecies));
  const pickFoes = pool => { const us = new Set(used); return pickDistinct(pool, us, 2); };
  const sl = pickFoes(slow), fs2 = pickFoes(fast.concat(slow)).slice(0, 1).concat(pickFoes(slow.filter(s => s.baseSpecies !== fast[0].baseSpecies)).slice(1, 2));
  const us2 = new Set([...used, ...sl.map(s => s.baseSpecies), ...fs2.map(s => s.baseSpecies)]);
  const bn = pickDistinct(benchPool, us2, 4);
  if (sl.length < 2 || fs2.length < 2 || bn.length < 4 || fs2[0] !== fast[0]) continue;
  const A = [mon(u, IT.name, [MV.name, 'Protect'], quiet(u) || undefined), mon(f, '', [km.name, 'Protect'], pr), mon(bn[0], '', ['Protect']), mon(bn[1], '', ['Protect'])];
  const foeTeam = (pair, it0) => [mon(pair[0], it0 || '', [K.idle(pair[0]).name, 'Protect']), mon(pair[1], '', [K.idle(pair[1]).name, 'Protect']),
    mon(bn[2], '', ['Protect']), mon(bn[3], '', ['Protect'])];
  const idleBoth = pair => [{ m: K.idle(pair[0]).id }, { m: K.idle(pair[1]).id }];
  const b = play('bench', A, foeTeam(sl), [
    { p1: [P.protect, { m: km.id, t: 0 }], p2: idleBoth(sl) },
    { p1: [{ m: MV.id }, P.protect], p2: [P.protect, P.protect] }]);
  if (!b.staged) { console.log('   (skip ' + u.id + '/' + f.id + ' bench: ' + b.why + ')'); continue; }
  const n = play('now', A, foeTeam(sl), [{ p1: [{ m: MV.id }, { m: km.id, t: 0 }], p2: idleBoth(sl) }]);
  const l = play('last', A, foeTeam(fs2, SCARF.name), [{ p1: [{ m: MV.id }, { m: km.id, t: 0 }], p2: [{ m: K.idle(fs2[0]).id }, P.protect] }]);
  if (!n.staged || !l.staged) { console.log('   (skip ' + u.id + '/' + f.id + ': ' + (n.why || l.why) + ')'); continue; }
  b.cast = f.id + ' (' + pr + ') ' + km.id + ' turn 1, ' + u.id + ' @ ' + IT.id + ' ' + MV.id + ' turn 2';
  n.cast = f.id + ' ' + km.id + ' then ' + u.id + ' @ ' + IT.id + ' ' + MV.id + ', slower foes ' + sl.map(s => s.id) + ' still to move';
  l.cast = f.id + ' ' + km.id + ' then ' + u.id + ' @ ' + IT.id + ' ' + MV.id + ' last, a faster foe @ ' + SCARF.id;
  b.fid = n.fid = l.fid = f.id;
  BN = b; NW = n; LS = l; break outer;
}
const RUNS = [['BENCH', BN], ['NOW', NW], ['LAST', LS]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const idx = (R, re) => R.sdK.findIndex(l => re.test(l));
for (const [tag, R] of RUNS) {
  const iE = idx(R, /^\|-enditem\|p1a:[^|]*\|leppaberry\|\[eat\]/), iA = idx(R, /^\|-activate\|p1a:[^|]*\|item:leppaberry\|revivalblessing/);
  const iH = idx(R, /^\|-heal\|p1:[^|]*\|[^|]*\|\[from\]move:revivalblessing/);
  ok(iE >= 0 && iA === iE + 1 && iH === iA + 1, tag + ' — the berry is eaten, then the revive heals: `-enditem`, `-activate`, `-heal`',
    R.sdK.slice(Math.max(0, iE - 1), iH + 2).join('  '));
}

K.compareArms(RUNS, OWN, 'switch / -heal / faint / move / upkeep / -enditem / item -activate');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  const c = RUNS.map(([, R]) => R.counters);
  ok(c.every(x => x.revived === 1 && x.deferred === 1 && x.unmodelled === 0),
    'the engine\'s receipts: one revive per arm, each applied after the Update pass, none unmodelled', JSON.stringify(c));
}
K.finish();
