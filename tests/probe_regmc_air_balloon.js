#!/usr/bin/env node
/* tests/probe_regmc_air_balloon.js — AIR BALLOON, UNDER REG M-C. 2026-09-21 (abra/regmc 0.20.0).
 *
 *   node tests/probe_regmc_air_balloon.js --regulation regmc                               # green, exit 0
 *   MEDI_AIR_BALLOON_SILENT=1   node tests/probe_regmc_air_balloon.js --regulation regmc   # RED, exit 1
 *   MEDI_AIR_BALLOON_UNPOPPED=1 node tests/probe_regmc_air_balloon.js --regulation regmc   # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts airballoon :185-212 (the Champions mod does not name it)
 *       onStart(target) { if (!target.ignoringItem() && !this.field.getPseudoWeather('gravity')) this.add('-item', target, 'Air Balloon'); }
 *       onDamagingHit(damage, target, source, move) {
 *         this.add('-enditem', target, 'Air Balloon'); target.item = ''; this.clearEffectState(target.itemState);
 *         this.runEvent('AfterUseItem', target, null, null, this.dex.items.get('airballoon'));
 *       },
 *   sim/pokemon.ts:2148-2160 `isGrounded` -- `return item !== 'airballoon'`, its last clause; sim/pokemon.ts:2237-2267
 *   `runImmunity` answers a Ground move with a bare `-immune`.
 *   sim/battle.ts:1018-1030 -- an item's `onStart` runs as its `onSwitchIn`, so it speaks on entry.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   LEAD      a grounded balloon holder leads: `-item` on entry. Turn 1 a Ground move is refused (`-immune`); turn 2 a
 *             non-Ground hit lands and pops it (`-enditem`); turn 3 the same Ground move LANDS.
 *   SWITCH    the holder starts on the bench and switches in on turn 2: `-item` at that entry.
 *   VOLLEY    a two-arrival move into the holder: popped by the first arrival, once.
 *   CONTROL   the same LEAD script with no item: no `-item`, and the Ground move lands on turn 1.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_air_balloon', ['MEDI_AIR_BALLOON_SILENT', 'MEDI_AIR_BALLOON_UNPOPPED']);
const { D, ok, SPEC, learns, abil, quiet, plain, hitFor, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED */
const grounded = s => !(s.types || []).includes('Flying') && !abil(s).includes('levitate');
const HOLD = SPEC.filter(s => quiet(s) && grounded(s) && learns(s, 'protect') && D.getImmunity('Ground', s))
  .sort((a, b) => bulk(b) - bulk(a));
const ATT = SPEC.filter(s => quiet(s) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
/* a single-target Ground move: any accuracy (the immunity is answered at step 2, above the accuracy check) */
const groundHit = (att) => D.moves.all().filter(m => K.legal(m) && learns(att, m.id) && m.type === 'Ground' && m.category !== 'Status'
  && m.target === 'normal' && !m.flags.charge && !m.priority && !m.selfSwitch && !m.multihit && (m.accuracy === true || m.accuracy >= 90)
  && !m.onModifyMove && !m.basePowerCallback).sort((a, b) => a.basePower - b.basePower)[0] || null;
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     grounded holders (bulk first): ' + show(HOLD));
for (const [t, xs] of [['HOLD', HOLD], ['ATT', ATT], ['FILL', FILL]])
  if (!xs.length) { console.log('  NOT STAGED — no legal ' + t); process.exit(1); }
if (!K.legal(D.items.get('airballoon'))) { console.log('  NOT STAGED — airballoon is not legal in ' + K.CS.FORMAT); process.exit(1); }

const counters = () => ({ announced: K.M.MEDSEEN.balloonAnnounced || 0, popped: K.M.MEDSEEN.balloonPopped || 0,
  approx: K.M.MEDFAILS.balloonAnnounceOrderApprox || 0 });
const KEEP = /^\|(-item|-enditem|-immune|-damage|faint)\|/;
const OWN = /^\|(-item|-enditem|-immune|-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const lines = (R, re) => R.sdK.filter(l => re.test(l));

/* 2. THE ARMS */
const used = new Set();
let holder = null, att = null, gHit = null, nHit = null;
for (const h of HOLD) {
  /* the holder's own click is its weakest plain hit back at the attacker: repeatable, and it never touches the holder */
  const a2 = ATT.find(s => s.baseSpecies !== h.baseSpecies && groundHit(s) && hitFor(s, h, m => m.type !== 'Ground')
    && D.getEffectiveness('Ground', h) <= 0 && hitFor(h, s));
  if (a2) { holder = h; att = a2; gHit = groundHit(a2); nHit = hitFor(a2, h, m => m.type !== 'Ground'); break; }
}
if (!holder) { console.log('  NOT STAGED — no holder/attacker pair with a Ground move and a plain non-Ground hit'); process.exit(1); }
for (const s of [holder, att]) { used.add(s.baseSpecies); used.add(s.id); }
const fills = pickDistinct(FILL, used, 5);
const hIdle = hitFor(holder, att);
console.log('     holder ' + holder.id + ' (' + quiet(holder) + ')   attacker ' + att.id + ': Ground ' + gHit.id + ', other ' + nHit.id);

function leadArm(tag, item) {
  const A = [mon(holder, item, ['Protect', hIdle.name]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(att, '', [gHit.name, nHit.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const t = mv => ({ p1: [{ m: hIdle.id, t: 0 }, P.protect], p2: [{ m: mv, t: 0 }, P.protect] });
  return play(tag, A, B, [t(gHit.id), t(nHit.id), t(gHit.id)]);
}
function switchArm() {
  const A = [mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(holder, 'airballoon', ['Protect', hIdle.name]), mon(fills[2], '', ['Protect'])];
  const B = [mon(att, '', [gHit.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  return play('switch', A, B, [{ p1: [P.protect, P.protect], p2: [P.protect, P.protect] },
                               { p1: [{ sw: holder.id }, P.protect], p2: [P.protect, P.protect] }]);
}
function volleyArm() {
  for (const s of ATT) {
    if (used.has(s.baseSpecies)) continue;
    const h2 = D.moves.all().filter(m => plain(m) && m.multihit === 2 && (m.accuracy === true || m.accuracy >= 90) && learns(s, m.id)
      && m.type !== 'Ground' && D.getImmunity(m.type, holder) && D.getEffectiveness(m.type, holder) <= 0)[0];
    if (!h2) continue;
    const hIdle2 = hitFor(holder, s); if (!hIdle2) continue;
    const A = [mon(holder, 'airballoon', ['Protect', hIdle2.name]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const B = [mon(s, '', [h2.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const R = play('volley', A, B, [{ p1: [{ m: hIdle2.id, t: 0 }, P.protect], p2: [{ m: h2.id, t: 0 }, P.protect] }]);
    R.cast = holder.id + ' <- ' + s.id + ' (' + h2.id + ')';
    if (R.staged && lines(R, /^\|-damage\|p1a:/).length === 2) return R;
  }
  return null;
}
const LD = leadArm('lead', 'airballoon'), CT = leadArm('control', ''), SW = switchArm(), VL = volleyArm();
const RUNS = [['LEAD', LD], ['CONTROL', CT], ['SWITCH', SW], ['VOLLEY', VL]];
K.printArms(RUNS);

/* 3. THE AUTHORITY EXERCISED WHAT EACH ARM IS FOR */
console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
{
  const it = lines(LD, /^\|-item\|p1a:/), im = lines(LD, /^\|-immune\|p1a:/), en = lines(LD, /^\|-enditem\|p1a:/), dm = lines(LD, /^\|-damage\|p1a:/);
  ok(it.length === 1 && im.length === 1 && en.length === 1 && dm.length === 2,
     'LEAD — announced on entry, Ground refused once, popped by the other hit, then the Ground move lands', JSON.stringify({ it, im, en, dm }));
}
ok(lines(CT, /^\|-item\||^\|-enditem\||^\|-immune\|/).length === 0 && lines(CT, /^\|-damage\|p1a:/).length === 3,
   'CONTROL — no item: nothing announced, every hit lands', JSON.stringify(lines(CT, /./)));
ok(lines(SW, /^\|-item\|p1a:/).length === 1, 'SWITCH — announced at the mid-game entry', JSON.stringify(lines(SW, /^\|-item\|/)));
ok(lines(VL, /^\|-enditem\|p1a:/).length === 1, 'VOLLEY — popped once by a two-arrival move', JSON.stringify(lines(VL, /^\|-enditem\||^\|-damage\|p1a/)));

K.compareArms(RUNS, OWN, '-item / -enditem / -immune / -damage / faint');

if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(LD.counters.announced === 1 && LD.counters.popped === 1, 'LEAD announced once and popped once', JSON.stringify(LD.counters));
  ok(CT.counters.announced === 0 && CT.counters.popped === 0, 'CONTROL touched nothing', JSON.stringify(CT.counters));
  ok(RUNS.every(([, R]) => R.counters.approx === 0), 'no announcement fell back to an approximate slot');
}
K.finish();
