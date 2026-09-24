#!/usr/bin/env node
/* tests/probe_regmc_white_herb_speed_order.js — TWO WHITE HERBS OWED IN ONE PASS ARE SPENT FASTEST HOLDER FIRST, UNDER
 * REG M-C. 2026-09-24 (ENGINE, narration to zero, cause A).
 *
 *   node tests/probe_regmc_white_herb_speed_order.js --regulation regmc                             # green, exit 0
 *   MEDI_HERB_SIDE_ORDER=1 node tests/probe_regmc_white_herb_speed_order.js --regulation regmc      # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout pokemon-showdown-mc f10d679; read whole) ==========
 *
 *   data/items.ts whiteherb :7658-7710 -- `onAnySwitchInPriority: -2, onAnySwitchIn`, `onAnyAfterMega`, `onAnyAfterMove`
 *   and `onResidual` all call the item's `onStart`, which spends the item when a stage is negative. There is no
 *   `onUpdate`. Every one of those is ONE HANDLER PER ACTIVE HOLDER in a list the event speed-sorts:
 *     - SwitchIn: `fieldEvent` (sim/battle.ts :484-507) concatenates `onAnySwitchIn` for every active body and
 *       `speedSort(handlers)`; `resolvePriority` (:1001-1013) gives each `speed = pokemon.speed - rank/(2*activePerHalf)`,
 *       the rank being `runSwitch`'s `speedOrder` (sim/battle-actions.ts :175-184).
 *     - AfterMove / AfterMega: `runEvent` collects the `onAny` handlers and `speedSort`s them (:794); `speed =
 *       pokemon.speed` (:1003).
 *   So when two holders are owed a clear in one pass, the FASTER holder's `-enditem` is written first, whichever side
 *   it is on. Field case: Reg M-C lattice 1600, baseline `…2681884715 vs …2681855448` turn 0 -- two Incineroar leads
 *   with Intimidate and White Herb, the authority spent p2b's (Adamant) before p1b's (Brave); this engine walked
 *   `[...actA, ...actB]`.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   LEAD       both sides lead an Intimidate body and a White Herb body; p2's holder is the FASTER. Each herb clears
 *              the foe's Intimidate drop at the lead SwitchIn pass.
 *   AFTERMOVE  no Intimidate. p1a's spread move drops a stat on both p2 bodies, both holding a White Herb, p2b the
 *              FASTER. The herbs clear at the AfterMove door.
 *   CONTROL    LEAD with the speeds swapped: p1's holder is the faster, so side order and speed order agree. It shows
 *              the comparison can agree -- the arms differ in exactly the speed order.
 * The item is found by its TAG (`restoresStats`), the droppers by theirs (`onSwitchInDrop`), never by name.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_white_herb_speed_order', ['MEDI_HERB_SIDE_ORDER']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, sure, bulk, mon, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const withTag = (k, t) => Object.keys(TAGS[k]).filter(x => (TAGS[k][x].tags || []).includes(t));
const HERB = withTag('items', 'restoresStats').find(i => K.legal(D.items.get(i)));
const INTIM = withTag('abilities', 'onSwitchInDrop');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     herb: ' + HERB + '   switch-in droppers: ' + INTIM.join(', '));
if (!HERB || !INTIM.length) { ok(false, 'a legal restoresStats item and an onSwitchInDrop ability exist'); K.finish(); }
const HERBN = D.items.get(HERB).name;
/* a holder whose ability does not react to a stat change */
const boostQuiet = s => { const a = quiet(s); if (!a) return null; const A = D.abilities.get(a);
  return (A.onTryBoost || A.onChangeBoost || A.onAfterBoost || A.onAfterEachBoost || A.onFoeAfterBoost) ? null : a; };
const spe = s => s.baseStats.spe;
/* a spread damaging move that drops a NON-Speed stat on every target it hits, always, and does nothing else */
const spreadDrop = s => D.moves.all().filter(m => K.legal(m) && learns(s, m.id) && m.category !== 'Status' && m.target === 'allAdjacentFoes'
  && sure(m) && m.secondary && m.secondary.chance === 100 && m.secondary.boosts && !m.secondary.boosts.spe
  && Object.values(m.secondary.boosts).every(v => v < 0) && !m.priority && !m.self && !m.flags.charge && !m.basePowerCallback)
  .sort((a, b) => a.basePower - b.basePower)[0] || null;
const HOLD = SPEC.filter(s => boostQuiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const INTS = SPEC.filter(s => abil(s).some(a => INTIM.includes(a)) && learns(s, 'protect'));
const KEEP = /^\|(switch|-ability|-unboost|-enditem|-clearnegativeboost|move|-damage)\|/;
const OWN = /^\|(-enditem|-clearnegativeboost)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ restored: K.M.MEDSEEN.statsRestoredByItem || 0,
  speedOrdered: K.M.MEDSEEN.herbSpeedOrdered || 0 }));
const distinct = xs => new Set(xs.map(s => s.baseSpecies)).size === xs.length;

/* LEAD / CONTROL: two intimidators and two holders whose base speeds are well apart; `fast` goes to the side named */
function leadCast() {
  for (const i1 of INTS) for (const i2 of INTS) {
    if (i1.baseSpecies === i2.baseSpecies) continue;
    const hs = HOLD.filter(h => h.baseSpecies !== i1.baseSpecies && h.baseSpecies !== i2.baseSpecies);
    for (const slow of hs) {
      const fast = hs.find(h => h.baseSpecies !== slow.baseSpecies && spe(h) >= spe(slow) + 30);
      if (!fast) continue;
      const fill = SPEC.filter(s => quiet(s) && learns(s, 'protect') && distinct([i1, i2, slow, fast, s]));
      if (fill.length < 2) continue;
      return { i1, i2, slow, fast, f1: fill[0], f2: fill[1] };
    }
  }
  return null;
}
function leadArm(tag, c, fastOnP2) {
  const h1 = fastOnP2 ? c.slow : c.fast, h2 = fastOnP2 ? c.fast : c.slow;
  const ia = s => abil(s).find(a => INTIM.includes(a));
  const A = [mon(c.i1, '', ['Protect'], ia(c.i1)), mon(h1, HERBN, ['Protect'], boostQuiet(h1)), mon(c.f1, '', ['Protect']), mon(c.f2, '', ['Protect'])];
  const B = [mon(c.i2, '', ['Protect'], ia(c.i2)), mon(h2, HERBN, ['Protect'], boostQuiet(h2)), mon(c.f2, '', ['Protect']), mon(c.f1, '', ['Protect'])];
  const R = play(tag, A, B, [{ p1: [P.protect, P.protect], p2: [P.protect, P.protect] }]);
  if (R.staged) R.cast = c.i1.id + ' [' + ia(c.i1) + '] + ' + h1.id + ' @ ' + HERBN + ' (base spe ' + spe(h1) + ')  vs  '
    + c.i2.id + ' [' + ia(c.i2) + '] + ' + h2.id + ' @ ' + HERBN + ' (base spe ' + spe(h2) + ')';
  return R;
}
const LC = leadCast();
if (!LC) { ok(false, 'NOT STAGED — no lead cast'); K.finish(); }
const LEAD = leadArm('lead', LC, true);
const CONTROL = leadArm('control', LC, false);

/* AFTERMOVE: the p2 bodies must be HIT, so they click an idle move rather than Protect */
let AM = null;
for (const u of SPEC.filter(s => quiet(s) && learns(s, 'protect') && spreadDrop(s))) {
  const mv = spreadDrop(u);
  const hs = HOLD.filter(h => h.baseSpecies !== u.baseSpecies && D.getImmunity(mv.type, h) && D.getEffectiveness(mv.type, h) <= 0 && K.idle(h));
  let done = false;
  for (const slow of hs) {
    const fast = hs.find(h => h.baseSpecies !== slow.baseSpecies && spe(h) >= spe(slow) + 30);
    if (!fast) continue;
    const fill = SPEC.filter(s => quiet(s) && learns(s, 'protect') && distinct([u, slow, fast, s]));
    if (fill.length < 3) continue;
    const A = [mon(u, '', [mv.name, 'Protect']), mon(fill[0], '', ['Protect']), mon(fill[2], '', ['Protect']), mon(fill[1], '', ['Protect'])];
    const B = [mon(slow, HERBN, [K.idle(slow).name, 'Protect'], boostQuiet(slow)), mon(fast, HERBN, [K.idle(fast).name, 'Protect'], boostQuiet(fast)),
      mon(fill[1], '', ['Protect']), mon(fill[2], '', ['Protect'])];
    const R = play('aftermove', A, B, [{ p1: [{ m: mv.id }, P.protect], p2: [{ m: K.idle(slow).id }, { m: K.idle(fast).id }] }]);
    if (!R.staged) { console.log('   (skip ' + u.id + '/' + slow.id + ': ' + R.why + ')'); continue; }
    if (R.sdK.filter(l => /^\|-enditem\|p2/.test(l)).length !== 2) continue;
    R.cast = u.id + ' --' + mv.id + '--> ' + slow.id + ' @ ' + HERBN + ' (p2a, base spe ' + spe(slow) + ') + ' + fast.id + ' @ ' + HERBN + ' (p2b, base spe ' + spe(fast) + ')';
    AM = R; done = true; break;
  }
  if (done) break;
}

const RUNS = [['LEAD', LEAD], ['AFTERMOVE', AM], ['CONTROL', CONTROL]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const herbs = R => R.sdK.filter(l => /^\|-enditem\|/.test(l)).map(l => l.split('|')[2].slice(0, 3));
ok(herbs(LEAD).join(',') === 'p2b,p1b', 'LEAD — two herbs are spent and the authority spends p2b (the faster holder) first', herbs(LEAD).join(','));
ok(herbs(AM).join(',') === 'p2b,p2a', 'AFTERMOVE — two herbs are spent and the authority spends p2b (the faster holder) first', herbs(AM).join(','));
ok(herbs(CONTROL).join(',') === 'p1b,p2b', 'CONTROL — speeds swapped: the authority spends p1b first (side order and speed order agree)', herbs(CONTROL).join(','));

K.compareArms(RUNS, OWN, '-enditem / -clearnegativeboost');
console.log('\n5. THE COUNTER');
ok(K.KNOBS.length ? true : (LEAD.counters.speedOrdered > 0 && AM.counters.speedOrdered > 0),
  'MEDSEEN.herbSpeedOrdered rose in LEAD and AFTERMOVE (two holders ordered by speed)',
  'lead ' + LEAD.counters.speedOrdered + '  aftermove ' + AM.counters.speedOrdered);
K.finish();
