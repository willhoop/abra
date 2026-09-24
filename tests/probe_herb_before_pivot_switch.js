#!/usr/bin/env node
/* tests/probe_herb_before_pivot_switch.js — WHITE HERB AGAINST A PIVOT'S SWITCH: WHERE THE REGULATION'S OWN ITEM PUTS
 * IT. 2026-09-24 (abra/regmc 0.88.0).
 *
 *   node tests/probe_herb_before_pivot_switch.js --regulation regmc                 # green: herb ABOVE the `|switch|`
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_herb_before_pivot_switch.js      # green: herb BELOW the `|switch|`
 *   MEDI_HERB_IMMEDIATE_AFTER_PIVOT=1 ...   the Reg M-C herb waits for the entrant again (the pre-fix engine): exit 1
 *   ... --medi <path>                       compile THOSE engine bytes under the release (the RED proof)
 *
 * ================= THE AUTHORITY (read whole, both checkouts) =====================================================
 *
 *   Reg M-B checkout data/mods/champions/items.ts:1023-1037 OVERRIDES whiteherb.onAnyAfterMove to QUEUE the restore:
 *       this.queue.insertChoice({ choice: 'event', event: 'WhiteHerb', order: 99, // before switches ... })
 *     so a pivot's `|switch|` (written at once) comes first and the herb is spent before the entrant's runSwitch (101).
 *   Reg M-C checkout data/mods/champions/items.ts carries NO whiteherb entry, so data/items.ts:7658-7705 stands:
 *       onAnyAfterMove() { onStart.call(this, this.effectState.target) }   -- the restore happens INSIDE `runMove`'s
 *     `AfterMove` (sim/battle-actions.ts, `runEvent('AfterMove', ...)`), before `runAction` answers the pivot's
 *     `switchFlag` with the switch request (sim/battle.ts). So in Reg M-C the herb is spent ABOVE the `|switch|`.
 *   The difference is DERIVED, not named: tag_dex writes `restoresStats.afterMoveImmediate` only for the non-queued shape.
 *   Pool: Reg M-C pinned pool, `...2682994376` t2 (Parting Shot into a White Herb holder): showdown spends the herb
 *   before the Parting Shot switch, medicham after it.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ===========================
 *
 *   HERB     Parting Shot into a White Herb holder; the pivot's replacement has a quiet ability.
 *   CONTROL  the same with no herb: nothing to spend, both engines agree before and after the fix.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_herb_before_pivot_switch', ['MEDI_HERB_IMMEDIATE_AFTER_PIVOT'], { anyRegulation: true });
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P, idle } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const HERB = Object.keys(TAGS.items).find(i => (TAGS.items[i].tags || []).includes('restoresStats') && K.legal(D.items.get(i)));
const IMM = !!(HERB && TAGS.items[HERB].params.restoresStats.afterMoveImmediate);
/* a single-target status pivot whose hit lowers the target (its drop is written by `onHit`, so the probe asks the move
 * text's own shape: selfSwitch, Status, one target, an onHit) -- the fixture below then REQUIRES an `-unboost` on it */
const PIVOT = D.moves.all().filter(m => K.legal(m) && m.selfSwitch === true && m.category === 'Status' && m.target === 'normal'
  && typeof m.onHit === 'function');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     herb: ' + HERB + '   afterMoveImmediate: ' + IMM + '   status pivots that drop the target: ' + PIVOT.map(m => m.id).join(', '));
if (!HERB || !PIVOT.length) { console.log('  NOT STAGED — a member is missing'); process.exit(1); }
const pv = PIVOT[0];
const boostQuiet = s => { const a = quiet(s); if (!a) return null; const A = D.abilities.get(a);
  return (A.onTryBoost || A.onChangeBoost || A.onAfterBoost || A.onAfterEachBoost || A.onFoeAfterBoost) ? null : a; };
const FILL = SPEC.filter(s => boostQuiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const USER = SPEC.filter(s => boostQuiet(s) && learns(s, 'protect') && learns(s, pv.id));
console.log('     ' + pv.id + ' users: ' + show(USER));
const KEEP = /^\|(-enditem|-clearnegativeboost|switch|-unboost|-ability)\|/;
const counters = () => ({ early: K.M.MEDSEEN.herbBeforePivotSwitch || 0, entry: K.M.MEDSEEN.pivotHerbBeforeEntry || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let HB = null, CT = null;
for (const u of USER) {
  const used = new Set([u.baseSpecies]);
  const f = pickDistinct(FILL, used, 5);
  if (f.length < 5) continue;
  const holder = f[0];
  const A = [mon(u, '', [pv.name, 'Protect'], boostQuiet(u)), mon(f[1], '', ['Protect'], boostQuiet(f[1])),
             mon(f[2], '', ['Protect'], boostQuiet(f[2])), mon(f[4], '', ['Protect'], boostQuiet(f[4]))];
  const B = it => [mon(holder, it, [idle(holder).name, 'Protect'], boostQuiet(holder)), mon(f[3], '', ['Protect'], boostQuiet(f[3])),
                   mon(f[4], '', ['Protect'], boostQuiet(f[4])), mon(f[2], '', ['Protect'], boostQuiet(f[2]))];
  const script = [{ p1: [{ m: pv.id, t: 0 }, P.protect], p2: [{ m: idle(holder).id }, P.protect] }];
  const h = play('herb', A, B(D.items.get(HERB).name), script);
  if (!h.staged) { console.log('   (skip ' + u.id + ': ' + h.why + ')'); continue; }
  if (!h.sdK.some(l => /^\|-unboost\|p2a:/.test(l)) || !h.sdK.some(l => /^\|-enditem\|p2a:/.test(l))
      || !h.sdK.some((l, i) => i > 3 && /^\|switch\|p1a:/.test(l))) continue;
  const c = play('control', A, B(''), script);
  if (!c.staged) continue;
  h.cast = u.id + ' --' + pv.id + '--> ' + holder.id + ' @ ' + HERB + '; ' + f[2].id + ' comes in';
  c.cast = u.id + ' --' + pv.id + '--> ' + holder.id + ' (no item)';
  HB = h; CT = c; break;
}
const RUNS = [['HERB', HB], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const idx = (R, re) => R.sdK.findIndex((l, i) => i > 3 && re.test(l));
const eH = idx(HB, /^\|-enditem\|p2a:/), sH = idx(HB, /^\|switch\|p1a:/);
if (IMM) ok(eH >= 0 && sH > eH, 'HERB — ' + K.CS.FORMAT + ': the herb is spent ABOVE the pivot\'s |switch| (no queued restore)');
else ok(sH >= 0 && eH > sH, 'HERB — ' + K.CS.FORMAT + ': the herb is spent BELOW the pivot\'s |switch| (the mod\'s queued restore)');
ok(idx(CT, /^\|-enditem\|/) < 0 && idx(CT, /^\|switch\|p1a:/) >= 0, 'CONTROL — no herb, and the pivot still switches');

K.compareArms(RUNS, KEEP, '-enditem / -clearnegativeboost / switch / -unboost / -ability');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(IMM ? (HB.counters.early === 1 && HB.counters.entry === 0) : (HB.counters.early === 0 && HB.counters.entry === 1),
    'HERB — the engine\'s own receipt: spent ' + (IMM ? 'before the switch' : 'at the entry'), JSON.stringify(HB.counters));
  ok(CT.counters.early === 0 && CT.counters.entry === 0, 'CONTROL — nothing spent', JSON.stringify(CT.counters));
}
K.finish();
