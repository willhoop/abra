#!/usr/bin/env node
/* tests/probe_regmc_eject_entry_address.js — AN EJECT-DOOR ENTRANT'S DICE CARRY NO MOVE (EMERGENCY EXIT, EJECT BUTTON),
 * UNDER REG M-C. 2026-09-22 (abra/regmc 0.48.0).
 *
 *   node tests/probe_regmc_eject_entry_address.js --regulation regmc                               # green, exit 0
 *   MEDI_EJECT_ENTRY_MOVE_ADDR=1 node tests/probe_regmc_eject_entry_address.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/abilities.ts emergencyexit :22-29 and data/mods/champions/items.ts ejectbutton :266-281 both end
 *   in `target.switchFlag = true`. sim/battle.ts :2877-2911 (`runAction`'s tail) answers a raised switchFlag with
 *   `makeRequest('switch')` once the move's action is over, so the entrant walks in on a NEW `switch` action, after
 *   `clearActiveMove`. The middle arm addresses a die by `seed|turn|cat|move|target|nth` with the move read off
 *   `battle.activeMove` (engine/game_differential.js `midDraw`), so an entrant's Trace pick is `…|any|-|-|0` there.
 *   `data/abilities.ts` trace :5118-5151: the pick is `this.sample(possibleTargets)`, one die.
 *
 * ================= THE ARMS (middle arm: real, seeded, address-shared dice) =======================
 *
 *   EE        a foe's hit takes the Emergency Exit holder across half; a Trace holder walks in and picks a foe.
 *   EB        a foe's hit sets off the holder's Eject Button; the same Trace holder walks in.
 *   PIVOT     the CONTROL: the Trace holder walks in behind its partner's U-turn-class pivot (`pivotFrom`, already
 *             right since 2026-09-20). It must stay green on both engines -- it proves the shared helper did not move it.
 *
 * Asserted: every `any` die of the entry turn is drawn at the SAME address on both engines, both ways, and the boards
 * agree. The address is the decisive check: with two candidates, two different addresses still agree on the pick half
 * the time, so a board-only probe could pass on a coin.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_eject_entry_address', ['MEDI_EJECT_ENTRY_MOVE_ADDR']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P, G } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const withTag = (kind, t) => Object.keys(TAGS[kind]).filter(x => (TAGS[kind][x].tags || []).includes(t));
const TRACE = withTag('abilities', 'copiesFoeAbility')[0], EE = withTag('abilities', 'switchesOutAtHalf')[0];
const EB = withTag('items', 'ejectsHolderOnHit')[0];
const PIVOTS = Object.keys(TAGS.moves).filter(m => { const x = D.moves.get(m); return K.legal(x) && x.selfSwitch === true
  && x.category !== 'Status' && !x.secondary && !x.secondaries && x.target === 'normal'; });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     copiesFoeAbility ' + TRACE + '   switchesOutAtHalf ' + EE + '   ejectsHolderOnHit ' + EB + '   pivots ' + PIVOTS.join(', '));
ok(!!TRACE && !!EE && !!EB && PIVOTS.length > 0, 'each door and the copier exist');
if (!TRACE || !EE || !EB) K.finish();
const TRACERS = SPEC.filter(s => abil(s).includes(TRACE) && learns(s, 'protect'));
const EEH = SPEC.filter(s => abil(s).includes(EE) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const byId = (a, b) => (a.id < b.id ? -1 : 1);
const idleOf = s => K.idle(s) || D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
  && !m.heal && !m.onHit && !m.onTry && !m.volatileStatus && learns(s, m.id)).sort(byId)[0] || null;
console.log('     Trace holders ' + show(TRACERS) + ';  ' + EE + ' holders ' + show(EEH));

const KEEP = /^\|(switch|-activate|-ability|-enditem|-damage)\|/;
const counters = () => ({ cleared: K.M.MEDSEEN.ejectEntryAddrCleared || 0, pivot: K.M.MEDSEEN.pivotEntryAddrCleared || 0 });
/* one arm, played on the MIDDLE arm with both engines' address logs read around it */
function playAddr(tag, A, B, script) {
  if (G.midResetAddresses) G.midResetAddresses();
  const r = K.play(tag, A, B, script, KEEP, counters, 'middle');
  if (!r.staged) return r;
  const ad = G.midAddresses();
  const t1 = xs => xs.filter(x => /\|1\|any\|/.test(String(x))).map(String);
  r.sdAny = t1(ad.sd); r.meAny = t1(ad.me);
  return r;
}
const entered = (R, who) => R.sd.some(l => new RegExp('^\\|switch\\|p1a: ' + who + '\\b', 'i').test(l));
const traced = R => R.sd.some(l => /^\|-ability\|p1a: [^|]*\|[^|]*\|Trace\|/.test(l));

/* the foes: two distinct copyable abilities, both quiet, so the copied one is visible on the board and does nothing */
const foePairs = [];
for (const f1 of FILL.slice(0, 40)) for (const f2 of FILL.slice(0, 40)) {
  if (f1.baseSpecies === f2.baseSpecies || quiet(f1) === quiet(f2)) continue;
  if (!idleOf(f1) || !idleOf(f2)) continue;
  foePairs.push([f1, f2]); if (foePairs.length > 12) break;
}

let EEA = null, EBA = null, PVA = null;
const tr = TRACERS[0];
search: for (const [f1, f2] of foePairs) {
  const used0 = new Set([tr.baseSpecies, tr.id, f1.baseSpecies, f1.id, f2.baseSpecies, f2.id]);
  const fi1 = idleOf(f1), fi2 = idleOf(f2);
  const trIdle = idleOf(tr);
  if (!trIdle) break;
  /* ---- EE: the holder must be taken from above half to at or below half by ONE of f1's plain hits, on the authority */
  for (const h of EEH.filter(s => !used0.has(s.baseSpecies))) {
    const hi = idleOf(h); if (!hi) continue;
    const partner = FILL.find(s => ![h.baseSpecies, ...used0].includes(s.baseSpecies) && idleOf(s));
    if (!partner) continue;
    const bench = FILL.find(s => ![h.baseSpecies, partner.baseSpecies, ...used0].includes(s.baseSpecies));
    if (!bench) continue;
    const hits = D.moves.all().filter(m => K.plain(m) && !m.multihit && K.sure(m) && learns(f1, m.id)
      && D.getImmunity(m.type, h)).sort((a, b) => b.basePower - a.basePower);
    for (const hm of hits.slice(0, 8)) {
      const A = [mon(h, '', [hi.name, 'Protect'], EE), mon(partner, '', ['Protect']), mon(tr, '', [trIdle.name, 'Protect'], TRACE), mon(bench, '', ['Protect'])];
      const B = [mon(f1, '', [hm.name, fi1.name, 'Protect']), mon(f2, '', [fi2.name, 'Protect']), mon(bench, '', ['Protect']), mon(partner, '', ['Protect'])];
      const r = playAddr('ee', A, B, [{ p1: [{ m: hi.id }, P.protect], p2: [{ m: hm.id, t: 0 }, { m: fi2.id }] }]);
      if (!r.staged) continue;
      if (!r.sd.some(l => /\|-activate\|p1a: [^|]*\|ability: Emergency Exit/.test(l)) || !entered(r, tr.name) || !traced(r)) continue;
      r.cast = f1.id + ' --' + hm.id + '--> ' + h.id + ' (' + EE + '), ' + tr.id + ' (' + TRACE + ') walks in; foes ' + quiet(f1) + ' / ' + quiet(f2);
      EEA = { r, f1, f2, fi1, fi2, hm, partner, bench };
      break;
    }
    if (EEA) break;
  }
  if (!EEA) continue;
  /* ---- EB: any damaging hit into an Eject Button holder; the same foes, the same move */
  {
    const { hm, partner, bench } = EEA;
    const h = FILL.find(s => ![partner.baseSpecies, bench.baseSpecies, ...used0].includes(s.baseSpecies) && idleOf(s) && D.getImmunity(hm.type, s));
    if (h) {
      const hi = idleOf(h);
      const A = [mon(h, D.items.get(EB).name, [hi.name, 'Protect']), mon(partner, '', ['Protect']), mon(tr, '', [trIdle.name, 'Protect'], TRACE), mon(bench, '', ['Protect'])];
      const B = [mon(f1, '', [hm.name, fi1.name, 'Protect']), mon(f2, '', [fi2.name, 'Protect']), mon(bench, '', ['Protect']), mon(partner, '', ['Protect'])];
      const r = playAddr('eb', A, B, [{ p1: [{ m: hi.id }, P.protect], p2: [{ m: hm.id, t: 0 }, { m: fi2.id }] }]);
      if (r.staged && entered(r, tr.name) && traced(r)) { r.cast = f1.id + ' --' + hm.id + '--> ' + h.id + ' @ ' + EB + ', ' + tr.id + ' walks in'; EBA = { r }; }
    }
  }
  /* ---- PIVOT (control): a partner-less pivot user in slot a, the Trace holder walks in behind it */
  {
    const { partner, bench } = EEA;
    const pv = FILL.map(s => ({ s, m: PIVOTS.find(m => learns(s, m) && D.getImmunity(D.moves.get(m).type, f1)) }))
      .find(x => x.m && ![partner.baseSpecies, bench.baseSpecies, ...used0].includes(x.s.baseSpecies));
    if (pv) {
      const A = [mon(pv.s, '', [D.moves.get(pv.m).name, 'Protect']), mon(partner, '', ['Protect']), mon(tr, '', [trIdle.name, 'Protect'], TRACE), mon(bench, '', ['Protect'])];
      const B = [mon(f1, '', [fi1.name, 'Protect']), mon(f2, '', [fi2.name, 'Protect']), mon(bench, '', ['Protect']), mon(partner, '', ['Protect'])];
      const r = playAddr('pivot', A, B, [{ p1: [{ m: pv.m, t: 0 }, P.protect], p2: [{ m: fi1.id }, { m: fi2.id }] }]);
      if (r.staged && entered(r, tr.name) && traced(r)) { r.cast = pv.s.id + ' ' + pv.m + ', ' + tr.id + ' walks in'; PVA = { r }; }
    }
  }
  if (EBA && PVA) break search;
  EEA = null; EBA = null; PVA = null;
}
const RUNS = [['EE', EEA && EEA.r], ['EB', EBA && EBA.r], ['PIVOT', PVA && PVA.r]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
for (const [t, R] of RUNS) ok(entered(R, tr.name) && traced(R), t + ' — the Trace holder walked in and copied a foe');
ok(RUNS.every(([, R]) => R.sdAny.length > 0), 'every arm drew at least one `any` die on turn 1 on the authority (the arm is not vacuous)');

console.log('\n4. THE ADDRESSES AND THE BOARDS');
for (const [t, R] of RUNS) {
  const sdS = new Set(R.sdAny), meS = new Set(R.meAny);
  const meOnly = R.meAny.filter(x => !sdS.has(x)), sdOnly = R.sdAny.filter(x => !meS.has(x));
  for (const x of R.sdAny) console.log('      ' + t + ' sd ' + (meS.has(x) ? '   ' : '<< ') + x);
  for (const x of R.meAny) console.log('      ' + t + ' me ' + (sdS.has(x) ? '   ' : '>> ') + x);
  ok(!meOnly.length && !sdOnly.length, t + ' — every turn-1 `any` die is drawn at the same address on both engines, both ways',
    (meOnly.length ? 'medicham only: ' + meOnly.join(' ') : '') + (sdOnly.length ? '  authority only: ' + sdOnly.join(' ') : '') || null);
  ok(R.boardDiffs === 0, t + ' — the BOARDS stay identical', R.boardDiffs ? R.boardDetail : null);
}
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(EEA.r.counters.cleared >= 1 && EBA.r.counters.cleared >= 1 && PVA.r.counters.cleared === 0 && PVA.r.counters.pivot >= 1,
    'the engine\'s receipts: the eject door cleared a stale address in EE and EB; the pivot road cleared its own',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
