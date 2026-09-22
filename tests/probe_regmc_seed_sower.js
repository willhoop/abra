#!/usr/bin/env node
/* tests/probe_regmc_seed_sower.js — AN ABILITY THAT SETS A TERRAIN WHEN ITS HOLDER IS HIT (SEED SOWER), UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.43.0).
 *
 *   node tests/probe_regmc_seed_sower.js --regulation regmc                            # green, exit 0
 *   MEDI_PUNISH_TERRAIN_INERT=1 node tests/probe_regmc_seed_sower.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/abilities.ts seedsower :4119-4127 (the Champions mod does not name it):
 *       onDamagingHit(damage, target, source, move) { this.field.setTerrain('grassyterrain'); }
 *   `Field#setTerrain` (sim/field.ts) takes the event's target (the holder) as its source and the ability as its effect,
 *   refuses a terrain that already stands, runs the terrain's durationCallback (the holder's Terrain Extender), writes
 *   `-fieldstart|move: Grassy Terrain|[from] ability: Seed Sower|[of] HOLDER`, and ends with `TerrainChange`, which
 *   spends a matching seed (the partner's). The ability is found by its TAG (`punishesAttacker.setsTerrain`).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   HIT       the holder takes a plain hit: the terrain starts, and the holder's partner spends its seed.
 *   UP        the same hit on the second turn, the terrain already up from the first: nothing restarts.
 *   CONTROL   the HIT arm with the holder on its other ability: nothing.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_seed_sower', ['MEDI_PUNISH_TERRAIN_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const ABS = Object.keys(TAGS.abilities).filter(a => ((TAGS.abilities[a].params || {}).punishesAttacker || {}).setsTerrain);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     punishesAttacker.setsTerrain: ' + (ABS.map(a => a + ' ' + TAGS.abilities[a].params.punishesAttacker.setsTerrain).join('; ') || '(none)'));
const CARRIED = new Set(SPEC.flatMap(s => abil(s)));
const DEXA = D.abilities.all().filter(a => K.legal(a) && CARRIED.has(a.id) && /setTerrain\(/.test(String(a.onDamagingHit || '')));
console.log('     carried abilities whose onDamagingHit sets a terrain (dex): ' + DEXA.map(a => a.id).join(', '));
ok(DEXA.length > 0 && DEXA.every(a => ABS.includes(a.id)), 'every such ability carries punishesAttacker.setsTerrain', 'dex ' + DEXA.map(a => a.id) + ' vs tag ' + ABS);
const AB = DEXA[0] && DEXA[0].id;
if (!AB) K.finish();
const TERR = (String(D.abilities.get(AB).onDamagingHit).match(/setTerrain\(\s*["'](\w+)["']/) || [])[1];
/* the seed that this terrain spends, off the tag file's `consumedOnTerrain` */
const SEED = Object.keys(TAGS.items).find(i => ((TAGS.items[i].params || {}).consumedOnTerrain || {}).terrain === TERR && K.legal(D.items.get(i)));
console.log('     terrain: ' + TERR + '   its seed: ' + SEED);
const HOLDERS = SPEC.filter(s => abil(s).includes(AB) && learns(s, 'protect') && abil(s).some(a => a !== AB));
console.log('     holders: ' + show(HOLDERS));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
/* a repeatable click that touches no HP and no field: a self-targeted stat-boosting status move (a second Focus Energy
 * writes `-fail` on the authority only, the kit's own note, so the kit's idle list is the fallback) */
const idleOf = s => D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.heal
  && !m.stallingMove && !m.selfSwitch && !m.volatileStatus && !m.onHit && !m.onTry && !m.sideCondition && !m.weather && !m.terrain
  && !m.pseudoWeather && learns(s, m.id)).sort((a, b) => Object.keys(a.boosts).length - Object.keys(b.boosts).length)[0] || K.idle(s);
const KEEP = /^\|(-fieldstart|-fieldend|-enditem|-boost|-damage)\|/;
const OWN = /^\|(-fieldstart|-fieldend|-enditem|-boost)\|/;
const counters = () => ({ set: K.M.MEDSEEN.punishTerrainSet || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let HT = null, UPA = null, CT = null;
outer: for (const h of HOLDERS) {
  const other = abil(h).find(a => a !== AB && !K.LOUD.has(a)) || abil(h).find(a => a !== AB);
  for (const att of FILL.filter(s => s.baseSpecies !== h.baseSpecies).slice(0, 20)) {
    const hm = K.hitFor(att, h);
    if (!hm) continue;
    const used = new Set([h.baseSpecies, h.id, att.baseSpecies, att.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (fills.length < 4) continue;
    const hi = idleOf(h);
    if (!hi) { console.log('   (skip ' + h.id + ': no idle click)'); continue outer; }
    const B = ab => [mon(h, '', [hi.name, 'Protect'], ab), mon(fills[0], SEED ? D.items.get(SEED).name : '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const A = [mon(att, '', [hm.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
    const t1 = { p1: [{ m: hm.id, t: 0 }, P.protect], p2: [{ m: hi.id }, P.protect] };
    const t2 = { p1: [{ m: hm.id, t: 0 }, P.protect], p2: [{ m: hi.id }, P.protect] };
    const r = play('hit', A, B(AB), [t1]);
    if (!r.staged) { console.log('   (skip ' + h.id + ' <- ' + att.id + ': ' + r.why + ')'); continue; }
    const u = play('up', A, B(AB), [t1, t2]);
    const c = play('control', A, B(other), [t1]);
    if (!u.staged || !c.staged) continue;
    r.cast = att.id + ' --' + hm.id + '--> ' + h.id + ' (' + AB + '), partner ' + fills[0].id + ' @ ' + SEED;
    u.cast = 'the same, twice';
    c.cast = att.id + ' --' + hm.id + '--> ' + h.id + ' (' + other + ')';
    HT = r; UPA = u; CT = c; break outer;
  }
}
const RUNS = [['HIT', HT], ['UP', UPA], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const starts = R => R.sdK.filter(l => /^\|-fieldstart\|/.test(l) && new RegExp('\\[from\\]ability:' + AB).test(l)).length;
ok(starts(HT) === 1 && (!SEED || HT.sdK.some(l => /^\|-enditem\|p2b:/.test(l))), 'HIT — the terrain starts off the ability, and the partner spends its seed');
ok(starts(UPA) === 1, 'UP — a second hit into the standing terrain starts nothing');
ok(starts(CT) === 0, 'CONTROL — on another ability, no terrain');

K.compareArms(RUNS, OWN, '-fieldstart / -fieldend / -enditem / -boost');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(HT.counters.set === 1 && UPA.counters.set === 1 && CT.counters.set === 0, 'the engine\'s receipts: one terrain set in HIT and in UP, none in CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + R.counters.set)));
}
K.finish();
