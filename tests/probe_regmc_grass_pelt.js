#!/usr/bin/env node
/* tests/probe_regmc_grass_pelt.js — A DEFENCE MULTIPLIER GATED ON A TERRAIN (GRASS PELT), UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.46.0).
 *
 *   node tests/probe_regmc_grass_pelt.js --regulation regmc                               # green, exit 0
 *   MEDI_TERRAIN_STATMULT_INERT=1 node tests/probe_regmc_grass_pelt.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts grasspelt :1697-1706 (the Champions mod does not name it):
 *       onModifyDefPriority: 6,
 *       onModifyDef(pokemon) { if (this.field.isTerrain('grassyterrain')) return this.chainModify(1.5); }
 *   `isTerrain` with no target asks the field alone (sim/field.ts effectiveTerrain; no legal `onTryTerrain`). The
 *   ability is breakable. It is found here by its TAG (`condStatMult`, `when: 'terrain'`), checked against the dex.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   PELT      turn 1 the attacker's partner sets the terrain; turn 2 a physical hit into the holder.
 *   BARE      the same hit, no terrain.
 *   SPECIAL   the PELT arm with a special hit (Defence only, so no multiplier).
 *   CONTROL   the PELT arm with the holder on its other ability.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_grass_pelt', ['MEDI_TERRAIN_STATMULT_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const TAGGED = Object.keys(TAGS.abilities).filter(a => ((TAGS.abilities[a].params || {}).condStatMult || {}).when === 'terrain');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     condStatMult when:terrain: ' + (TAGGED.map(a => a + ' ' + JSON.stringify(TAGS.abilities[a].params.condStatMult)).join('; ') || '(none)'));
const CARRIED = new Set(SPEC.flatMap(s => abil(s)));
const DEXA = D.abilities.all().filter(a => K.legal(a) && CARRIED.has(a.id)
  && /isTerrain\(/.test(String(a.onModifyDef || '') + String(a.onModifySpD || '')));
console.log('     carried abilities whose onModifyDef/SpD asks a terrain (dex): ' + DEXA.map(a => a.id).join(', '));
ok(DEXA.length > 0 && DEXA.length === TAGGED.length && DEXA.every(a => TAGGED.includes(a.id)),
  'the tag and the dex name the same abilities', 'dex ' + DEXA.map(a => a.id) + ' vs tag ' + TAGGED);
const AB = DEXA[0] && DEXA[0].id;
if (!AB) K.finish();
const P0 = TAGS.abilities[AB].params.condStatMult;
const TERR = P0.terrain;
const TMOVE = D.moves.all().find(m => K.legal(m) && m.category === 'Status' && m.terrain === TERR);
console.log('     terrain ' + TERR + ', set by ' + (TMOVE && TMOVE.id) + ';  stat ' + P0.stat + ' x' + P0.mult);
const HOLDERS = SPEC.filter(s => abil(s).includes(AB) && learns(s, 'protect'));
console.log('     holders: ' + show(HOLDERS));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-fieldstart|-fieldend|-damage|-heal)\|/;
const OWN = /^\|-damage\|/;
const counters = () => ({ paid: K.M.MEDSEEN.terrainStatMultPaid || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const phys = m => m.category === 'Physical' && m.type !== 'Grass';
const spec = m => m.category === 'Special' && m.type !== 'Grass';

let PE = null, BA = null, SP = null, CT = null;
outer: for (const h of HOLDERS) {
  const other = abil(h).find(a => a !== AB);
  if (!other) continue;
  for (const setter of FILL.filter(s => s.baseSpecies !== h.baseSpecies && TMOVE && learns(s, TMOVE.id))) {
    for (const att of FILL.filter(s => ![h.baseSpecies, setter.baseSpecies].includes(s.baseSpecies)).slice(0, 30)) {
      const pm = K.hitFor(att, h, phys), sm = K.hitFor(att, h, spec);
      if (!pm || !sm) continue;
      const used = new Set([h.baseSpecies, h.id, setter.baseSpecies, setter.id, att.baseSpecies, att.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
      if (fills.length < 3) continue;
      /* the holder's turn-2 click: the kit's idle list, else a self-targeted boost that touches neither defence */
      const hi = K.idle(h) || D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
        && !m.boosts.def && !m.boosts.spd && !m.heal && !m.onHit && !m.onTry && !m.volatileStatus && learns(h, m.id))
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null;
      if (!hi) continue;
      const A = mv => [mon(att, '', [mv, 'Protect']), mon(setter, '', [TMOVE.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const B = ab => [mon(h, '', [hi.name, 'Protect'], ab), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const t1 = { p1: [P.protect, { m: TMOVE.id }], p2: [P.protect, P.protect] };
      const t1n = { p1: [P.protect, P.protect], p2: [P.protect, P.protect] };
      const t2 = id => ({ p1: [{ m: id, t: 0 }, P.protect], p2: [{ m: hi.id }, P.protect] });
      const r = play('pelt', A(pm.name), B(AB), [t1, t2(pm.id)]);
      if (!r.staged) { console.log('   (skip ' + h.id + '/' + att.id + ': ' + r.why + ')'); continue; }
      const b = play('bare', A(pm.name), B(AB), [t1n, t2(pm.id)]);
      const s = play('special', A(sm.name), B(AB), [t1, t2(sm.id)]);
      const c = play('control', A(pm.name), B(other), [t1, t2(pm.id)]);
      if (!b.staged || !s.staged || !c.staged) continue;
      r.cast = setter.id + ' ' + TMOVE.id + ' (t1), then ' + att.id + ' --' + pm.id + '--> ' + h.id + ' (' + AB + ')';
      b.cast = att.id + ' --' + pm.id + '--> ' + h.id + ', no terrain';
      s.cast = 'the PELT arm with ' + sm.id + ' (special)';
      c.cast = 'the PELT arm, ' + h.id + ' on ' + other;
      PE = r; BA = b; SP = s; CT = c; break outer;
    }
  }
}
const RUNS = [['PELT', PE], ['BARE', BA], ['SPECIAL', SP], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
/* the first -damage line that names the holder (p2a) off full HP, as an HP number */
const hit = R => { const l = R.sd.find(x => /^\|-damage\|p2a: /.test(x) && !/\[from\]/.test(x)); return l ? +l.split('|')[3].split('/')[0] : null; };
const hp = { PELT: hit(PE), BARE: hit(BA), CONTROL: hit(CT) };
console.log('     holder HP after the hit: ' + JSON.stringify(hp));
ok(hp.PELT != null && hp.BARE != null && hp.PELT > hp.BARE, 'PELT — in the terrain the holder keeps MORE HP than with no terrain');
ok(hp.CONTROL != null && hp.PELT > hp.CONTROL, 'CONTROL — on its other ability, in the same terrain, it keeps less');

K.compareArms(RUNS, OWN, '-damage');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(PE.counters.paid >= 1 && BA.counters.paid === 0 && SP.counters.paid === 0 && CT.counters.paid === 0,
    'the engine\'s receipts: the multiplier paid in PELT, and not in BARE, SPECIAL or CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + R.counters.paid)));
}
K.finish();
