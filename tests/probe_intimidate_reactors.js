#!/usr/bin/env node
/* tests/probe_intimidate_reactors.js — THE ABILITIES THAT ANSWER INTIMIDATE, EACH REGULATION'S OWN WAY. 2026-09-23
 * (ENGINE pass 9, abra/regmc 0.74.0 onward).
 *
 *   node tests/probe_intimidate_reactors.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_intimidate_reactors.js
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (read whole, both checkouts; the Champions mods name none of these) ===============
 *
 *   data/abilities.ts guarddog: `onTryBoost(boost, target, source, effect) { if (effect.name === 'Intimidate' && boost.atk)
 *       { delete boost.atk; this.boost({ atk: 1 }, target, target, null, false, true); } }` -- the drop is refused and
 *       ANSWERED: sim/battle.ts boost() writes `-ability|<holder>|Guard Dog|boost` then `-boost|<holder>|atk|1`.
 *   data/abilities.ts rattled: `onAfterBoost(boost, target, source, effect) { if (effect?.name === 'Intimidate' &&
 *       boost.atk) { this.boost({ spe: 1 }); } }` -- the drop LANDS, then Speed rises (`-ability ... Rattled|boost`).
 *   data/abilities.ts innerfocus / oblivious / owntempo / scrappy (and hypercutter, bigpecks): the refusal line is
 *       `this.add('-fail', target, 'unboost', <LABEL>, '[from] ability: <Name>', `[of] ${target}`)`, and <LABEL> is
 *       'Attack' / 'Defense' in the Reg M-B checkout and the stat id 'atk' / 'def' in the Reg M-C one.
 *
 * ================= THE ARMS (both engines play the same scripted turn 0; SHOWDOWN IS THE ANSWER) ==================
 *
 *   One Intimidate lead opposite each carrier; the carrier's CONTROL arm is the same species on its other ability.
 *   An ability with no legal carrier in the selected regulation is reported NOT LEGAL HERE and not staged.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_intimidate_reactors',
  ['MEDI_GUARD_DOG_REFUSES_ONLY', 'MEDI_RATTLED_IGNORES_INTIMIDATE'], { anyRegulation: true });
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const REACT = ['guarddog', 'rattled'];   /* 0.74.0, 0.75.0 */
const INTIM = SPEC.filter(s => abil(s).includes('intimidate') && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
console.log('     Intimidate leads: ' + show(INTIM));
const KEEP = /^\|(-ability|-fail|-boost|-unboost|-activate)\|/;
const play = (tag, A, B) => K.play(tag, A, B, [{ p1: [P.protect, P.protect], p2: [P.protect, P.protect] }], KEEP, () => ({}));

const RUNS = [], CAST = {};
for (const ab of REACT) {
  const carriers = SPEC.filter(s => abil(s).includes(ab) && abil(s).length > 1 && learns(s, 'protect'));
  if (!carriers.length) { console.log('     ' + ab + ': NOT LEGAL HERE (no carrier with a second ability) -- not staged'); continue; }
  let got = null;
  for (const c of carriers) for (const it of INTIM) {
    if (it.baseSpecies === c.baseSpecies) continue;
    const used = new Set([c.baseSpecies, c.id, it.baseSpecies, it.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
    if (fills.length < 5) continue;
    const other = abil(c).find(a => a !== ab && !K.LOUD.has(a)) || abil(c).find(a => a !== ab);
    const A = ab2 => [mon(c, '', ['Protect'], ab2), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const B = [mon(it, '', ['Protect'], 'intimidate'), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const R = play(ab, A(ab), B), C = play(ab + '-ctl', A(other), B);
    if (!R.staged || !C.staged) { console.log('   (skip ' + ab + ' ' + c.id + '/' + it.id + ': ' + (R.why || C.why) + ')'); continue; }
    R.cast = it.id + ' (Intimidate) opposite ' + c.id + ' (' + ab + ')'; C.cast = 'the same, ' + c.id + ' on ' + other;
    R.cname = C.cname = K.canon(c.name.split('-')[0]);
    got = [R, C]; break;
  }
  if (!got) { console.log('     ' + ab + ': NO CAST FOUND'); process.exit(1); }
  CAST[ab] = got; RUNS.push([ab.toUpperCase(), got[0]], [ab.toUpperCase() + '-CTL', got[1]]);
}
if (!RUNS.length) { console.log('  NOT RUN — none of ' + REACT.join(', ') + ' has a legal carrier in ' + K.CS.FORMAT); process.exit(2); }
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const lines = (R, re) => R.sdK.filter(l => re.test(l) && l.includes('p1a:' + R.cname));
for (const ab of Object.keys(CAST)) {
  const [R, C] = CAST[ab];
  const drop = x => lines(x, /^\|-unboost\|p1a:[^|]*\|atk\|/).length;
  if (ab === 'guarddog') ok(drop(R) === 0 && lines(R, /^\|-boost\|p1a:[^|]*\|atk\|1/).length === 1 && lines(R, /^\|-ability\|p1a:[^|]*\|guarddog\|boost/).length === 1
    && drop(C) === 1, 'GUARDDOG — the drop is refused and answered with +1 Attack under a -ability line; the control drops');
  else if (ab === 'rattled') ok(drop(R) === 1 && lines(R, /^\|-boost\|p1a:[^|]*\|spe\|1/).length === 1 && lines(C, /^\|-boost\|/).length === 0,
    'RATTLED — the drop lands and Speed rises; the control only drops');
  else ok(drop(R) === 0 && lines(R, /^\|-fail\|p1a:[^|]*\|unboost\|/).length === 1 && drop(C) === 1,
    ab.toUpperCase() + ' — the drop is refused with one -fail line; the control drops');
}

K.compareArms(RUNS, /^\|(-ability|-fail|-boost|-unboost)\|/, '-ability / -fail / -boost / -unboost');
K.finish();
