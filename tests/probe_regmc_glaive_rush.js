#!/usr/bin/env node
/* tests/probe_regmc_glaive_rush.js — A MOVE THAT LEAVES ITS USER EXPOSED (GLAIVE RUSH), UNDER REG M-C. 2026-09-22 (abra/regmc 0.26.0).
 *
 *   node tests/probe_regmc_glaive_rush.js --regulation regmc                               # green, exit 0
 *   MEDI_SELF_EXPOSED_INERT=1 node tests/probe_regmc_glaive_rush.js --regulation regmc     # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts glaiverush :6647-6678 (the Champions mod names it only in learnsets):
 *       self: { volatileStatus: 'glaiverush' },
 *       condition: { noCopy: true,
 *         onStart(pokemon) { this.add('-singlemove', pokemon, 'Glaive Rush', '[silent]'); },
 *         onAccuracy() { return true; },
 *         onSourceModifyDamage() { return this.chainModify(2); },
 *         onBeforeMovePriority: 100,
 *         onBeforeMove(pokemon) { pokemon.removeVolatile('glaiverush'); } },
 *   sim/battle-actions.ts:1317-1335 `selfDrops`: the `self` block is applied once per target the move actually hit.
 *   The move is found by its TAG (`exposesUser`, derived by engine/tag_dex.js from the condition's handlers), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   EXPOSED   turn 1: the user (faster) lands the move; a SLOWER foe then hits the user -- the hit is doubled, and the
 *             volatile stands at the turn boundary. Turn 2: the user moves first (the volatile ends before its move),
 *             then the same foe hits it again -- not doubled.
 *   CONTROL   the same script with the user's plain contact move in place of the exposing move: never doubled.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_glaive_rush', ['MEDI_SELF_EXPOSED_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, quiet, plain, sure, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const EXP = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).exposesUser);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     moves tagged exposesUser: ' + (EXP.map(m => m + ' ' + JSON.stringify(TAGS.moves[m].params.exposesUser)).join('; ') || '(none)'));
/* the population is read off the DEX as well, so a tag file that lost the tag is a red line and not an empty cast */
const DEXEXP = D.moves.all().filter(m => K.legal(m) && m.self && m.self.volatileStatus && m.condition && m.condition.onSourceModifyDamage);
console.log('     legal moves whose self volatile raises the damage its user takes (dex): ' + DEXEXP.map(m => m.id).join(', '));
ok(DEXEXP.length > 0 && DEXEXP.every(m => EXP.includes(m.id)), 'every such move carries the exposesUser tag', 'dex ' + DEXEXP.map(m => m.id) + ' vs tag ' + EXP);
const MV = DEXEXP.find(m => sure(m) && m.target === 'normal' && !m.multihit && !m.priority);
if (!MV) { console.log('  NOT STAGED — no legal single-target exposing move'); K.finish(); }

const KEEP = /^\|(-damage|faint|-miss)\|/;
const counters = () => ({ doubled: K.M.MEDSEEN.selfExposedDoubled || 0, ended: K.M.MEDSEEN.selfExposedEndedBeforeMove || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const USERS = SPEC.filter(s => quiet(s) && learns(s, MV.id) && learns(s, 'protect')).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
console.log('     ' + MV.id + ' users (fastest first): ' + show(USERS));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));

let EX = null, CT = null;
for (const u of USERS) {
  const used = new Set([u.baseSpecies, u.id]);
  /* the target takes the move neutrally or resisted and is bulky; the slow hitter is well under the user's base Speed */
  const tgt = FILL.find(s => !used.has(s.baseSpecies) && D.getImmunity(MV.type, s) && D.getEffectiveness(MV.type, s) < 0);
  if (!tgt) continue; used.add(tgt.baseSpecies);
  const slow = FILL.filter(s => !used.has(s.baseSpecies) && s.baseStats.spe + 30 < u.baseStats.spe);
  let hitter = null, hHit = null;
  for (const s of slow) { const h = K.hitFor(s, u); if (h) { hitter = s; hHit = h; break; } }
  if (!hitter) continue; used.add(hitter.baseSpecies);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
  if (fills.length < 4) continue;
  const uHit = K.hitFor(u, tgt, m => !!m.flags.contact);
  if (!uHit) continue;
  const A = [mon(u, '', [MV.name, uHit.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect'])];
  const B = [mon(tgt, '', ['Protect']), mon(hitter, '', [hHit.name, 'Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
  const script = first => [
    { p1: [{ m: first, t: 0 }, P.protect], p2: [P.protect, { m: hHit.id, t: 0 }] },
    { p1: [{ m: uHit.id, t: 0 }, P.protect], p2: [P.protect, { m: hHit.id, t: 0 }] },
  ];
  /* p2a protects on BOTH turns in the script above, which would block the move and the self effect: it must be HIT.
   * So the target clicks nothing that protects: it is given a plain hit into p1b's Protect instead. */
  const tHit = K.hitFor(tgt, fills[0]);
  if (!tHit) continue;
  B[0] = mon(tgt, '', [tHit.name, 'Protect']);
  const sc = first => script(first).map(t => ({ p1: t.p1, p2: [{ m: tHit.id, t: 1 }, t.p2[1]] }));
  const e = play('exposed', A, B, sc(MV.id));
  if (!e.staged) { console.log('   (skip ' + u.id + ': ' + e.why + ')'); continue; }
  const c = play('control', A, B, sc(uHit.id));
  if (!c.staged) { console.log('   (skip ' + u.id + ' control: ' + c.why + ')'); continue; }
  e.cast = u.id + ' --' + MV.id + '--> ' + tgt.id + ';  ' + hitter.id + ' --' + hHit.id + '--> ' + u.id;
  c.cast = u.id + ' --' + uHit.id + '--> ' + tgt.id + ';  ' + hitter.id + ' --' + hHit.id + '--> ' + u.id;
  EX = e; CT = c; break;
}
const RUNS = [['EXPOSED', EX], ['CONTROL', CT]];
K.printArms(RUNS);

/* the damage the user took, per turn, on the authority: [turn1, turn2] */
const taken = R => { const out = []; let hp = null, t = 0; for (const l of R.sd) { if (/^\|turn\|/.test(l)) t++;
  const m = /^\|-damage\|p1a: [^|]+\|(\d+)\/(\d+)/.exec(l); if (m) { const now = +m[1], max = +m[2]; out.push({ t, dmg: (hp == null ? max : hp) - now }); hp = now; } } return out; };
console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const te = taken(EX), tc = taken(CT);
console.log('     user damage taken, EXPOSED ' + JSON.stringify(te) + '   CONTROL ' + JSON.stringify(tc));
ok(te.length === 2 && tc.length === 2, 'the user is hit exactly once on each turn in both arms');
ok(te.length === 2 && tc.length === 2 && te[0].dmg >= 2 * tc[0].dmg - 2 && te[1].dmg <= tc[1].dmg + 2 && te[0].dmg > te[1].dmg,
  'EXPOSED — the turn-1 hit is doubled against CONTROL; the turn-2 hit (after the user moved first) is not');

K.compareArms(RUNS, /^\|(-damage|faint)\|/, '-damage / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(EX.counters.doubled >= 1 && EX.counters.ended >= 1 && CT.counters.doubled === 0, 'the engine\'s receipts: doubled and ended in EXPOSED, never in CONTROL',
    JSON.stringify([EX.counters, CT.counters]));
}
K.finish();
