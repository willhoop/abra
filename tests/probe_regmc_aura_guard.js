#!/usr/bin/env node
/* tests/probe_regmc_aura_guard.js — A CONTACT-ONLY DAMAGE CUT (AURA GUARD), UNDER REG M-C. 2026-09-22 (abra/regmc 0.25.0).
 *
 *   node tests/probe_regmc_aura_guard.js --regulation regmc                                   # green, exit 0
 *   MEDI_DAMAGE_REDUCE_CONTACT_UNKNOWN=1 node tests/probe_regmc_aura_guard.js --regulation regmc   # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   The ability is found by its TAG, never by name: an ability whose `damageReduce` param says `onlyWhen: 'contact'`
 *   (engine/tag_dex.js, from its handler). In the M-C checkout the one member is read and printed below, with its
 *   handler, which is an `onSourceModifyDamage` that halves when `move.flags['contact']` is set -- the ACTIVE move's flag,
 *   so an attacker whose ability deletes the flag in `onModifyMove` is not halved. The ability is `breakable`, so a
 *   Mold Breaker attacker ignores it.
 *   The only legal carrier is a mega forme; the holder megas on turn 1 behind Protect.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   CONTACT     turn 2: a plain contact hit into the mega holder -- halved.
 *   NONCONTACT  turn 2: a plain non-contact hit -- not halved.
 *   BREAKER     turn 2: a Mold Breaker attacker's plain contact hit -- not halved.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_aura_guard', ['MEDI_DAMAGE_REDUCE_CONTACT_UNKNOWN']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, plain, sure, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

/* 1. THE ABILITY AND ITS CARRIER, DERIVED */
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const CUT = Object.keys(TAGS.abilities).filter(a => { const p = (TAGS.abilities[a].params || {}).damageReduce; return p && p.onlyWhen === 'contact'; });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     abilities whose damageReduce is contact-only: ' + CUT.join(', '));
for (const a of CUT) { const A = D.abilities.get(a); console.log('       ' + a + ' onSourceModifyDamage: ' + String(A.onSourceModifyDamage || '(none)').replace(/\s+/g, ' ').slice(0, 200)); }
if (!CUT.length) { console.log('  NOT STAGED — no contact-only damage cut in the tag file'); process.exit(1); }
const STONES = D.items.all().filter(it => K.legal(it) && it.megaStone);
let holder = null, stone = null, megaName = null;
for (const it of STONES) for (const [base, mega] of Object.entries(it.megaStone)) {
  const M = D.species.get(mega), B = D.species.get(base);
  if (!holder && M.exists && CUT.includes(D.abilities.get(M.abilities['0']).id) && K.legal(B) && learns(B, 'protect')) { holder = B; stone = it; megaName = M.name; }
}
if (!holder) { console.log('  NOT STAGED — no legal base species megas into a carrier'); process.exit(1); }
console.log('     holder: ' + holder.id + ' + ' + stone.name + ' -> ' + megaName);
const breakers = SPEC.filter(s => abil(s).includes('moldbreaker') && learns(s, 'protect'));
console.log('     Mold Breaker carriers: ' + show(breakers));

const ATT = SPEC.filter(s => quiet(s) && learns(s, 'protect') && s.baseSpecies !== holder.baseSpecies);
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && s.baseSpecies !== holder.baseSpecies).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-damage|faint|-mega|-resisted|-supereffective)\|/;
const counters = () => ({ unknown: K.M.MEDFAILS.damageReduceUnknown || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
/* a plain single-arrival sure move the attacker learns into the holder, neutral or resisted, with or without contact */
const hitInto = (att, contact) => D.moves.all().filter(m => plain(m) && !m.multihit && sure(m) && learns(att, m.id)
  && !!m.flags.contact === contact && D.getImmunity(m.type, holder) && D.getEffectiveness(m.type, holder) <= 0)
  .sort((a, b) => b.basePower - a.basePower)[0] || null;
const baseAb = abil(holder)[0];

function arm(tag, att, mv, attAb) {
  const used = new Set([holder.baseSpecies, att.baseSpecies]);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
  if (fills.length < 5) return { staged: false, why: 'not enough fillers' };
  const hHit = K.hitFor(holder, fills[2]);
  if (!hHit) return { staged: false, why: holder.id + ' has no plain hit into ' + fills[2].id };
  const A = [mon(holder, stone.name, ['Protect', hHit.name], baseAb), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[4], '', ['Protect'])];
  const B = [mon(att, '', [mv.name, 'Protect'], attAb), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect'])];
  const R = play(tag, A, B, [
    { p1: [{ m: 'protect', mega: true }, P.protect], p2: [P.protect, P.protect] },
    { p1: [{ m: hHit.id, t: 1 }, P.protect], p2: [{ m: mv.id, t: 0 }, P.protect] },
  ]);
  if (R.staged) R.cast = holder.id + ' (' + megaName + ') <- ' + att.id + (attAb ? ' [' + attAb + ']' : '') + ' ' + mv.id;
  return R;
}
const pick = (pool, contact, ab) => { for (const att of pool) { const mv = hitInto(att, contact); if (!mv) continue;
  const R = arm(contact ? 'contact' : 'noncontact', att, mv, ab); if (R.staged && R.sdK.some(l => /^\|-mega\|p1a:/.test(l)) && R.sdK.some(l => /^\|-damage\|p1a:/.test(l))) return R; } return null; };
const CT = pick(ATT, true, null);
const NC = pick(ATT, false, null);
const BR = pick(breakers, true, 'moldbreaker');
const RUNS = [['CONTACT', CT], ['NONCONTACT', NC], ['BREAKER', BR]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
for (const [tag, R] of RUNS) ok(R.sdK.filter(l => /^\|-mega\|p1a:/.test(l)).length === 1 && R.sdK.filter(l => /^\|-damage\|p1a:/.test(l)).length === 1,
  tag + ' — the holder megas on turn 1 and takes exactly one hit on turn 2');

K.compareArms(RUNS, /^\|(-damage|faint)\|/, '-damage / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(RUNS.every(([, R]) => R.counters.unknown === 0), 'no damage cut was refused as an unknown condition (MEDFAILS.damageReduceUnknown)',
    JSON.stringify(RUNS.map(([, R]) => R.counters)));
}
K.finish();
