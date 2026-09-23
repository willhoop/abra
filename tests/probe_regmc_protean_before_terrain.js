#!/usr/bin/env node
/* tests/probe_regmc_protean_before_terrain.js — PROTEAN CONVERTS ITS USER BEFORE PSYCHIC TERRAIN REFUSES THE PRIORITY MOVE.
 * 2026-09-22 (abra/regmc 0.56.0).
 *
 *   node tests/probe_regmc_protean_before_terrain.js --regulation regmc                                     # green, exit 0
 *   MEDI_TERRAIN_BAR_BEFORE_PREPAREHIT=1 node tests/probe_regmc_protean_before_terrain.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   sim/battle-actions.ts trySpreadMoveHit :549-612 (no Champions override: the mod's scripts.ts overrides spreadMoveHit,
 *       hitStepMoveHitLoop and others, not this): `singleEvent('Try')`, then `singleEvent('PrepareHit')` and
 *       `runEvent('PrepareHit')` (:590-592), and only THEN the step list, whose step 1 is `hitStepTryHitEvent`.
 *   data/abilities.ts protean :3497-3507 (the Champions mod does not name it): `onPrepareHit` sets the user's type to
 *       the move's and writes `-start|<user>|typechange|<Type>|[from] ability: Protean`.
 *   data/moves.ts psychicterrain.condition.onTryHit :14114-14128: a `TryHit` handler -- step 1, below PrepareHit.
 *   So a Protean body's priority move into a grounded body under Psychic Terrain converts the user and is then refused.
 *
 *   The pinned 1950 card (`omit-spread …bo3-2681855173` t1): `|move|p2a: Greninja|Water Shuriken|p1a: Indeedee`,
 *   `|-start|p2a: Greninja|typechange|Water|[from] ability: Protean`, `|-activate|p1a: Indeedee|move: Psychic Terrain`;
 *   this engine refused first and never converted, so Greninja kept Water/Dark.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   TERRAIN   turn 1 the Protean body switches in and our partner raises Psychic Terrain; turn 2 the Protean body's priority move into a grounded foe:
 *             the user converts, then the terrain refuses.
 *   OPEN      turn 1 our partner protects instead: the same move converts and lands (the control).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_protean_before_terrain', ['MEDI_TERRAIN_BAR_BEFORE_PREPAREHIT']);
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P, legal, sure } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const CONVERT = D.abilities.all().filter(a => legal(a) && /typechange/.test(String(a.onPrepareHit || ''))).map(a => a.id);
console.log('     PrepareHit type-changers: ' + CONVERT.join(', '));
const PRIO = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.priority > 0 && m.target === 'normal' && sure(m)
  && !m.onTry && !m.onTryHit && !m.breaksProtect && !m.selfSwitch).sort((a, b) => a.basePower - b.basePower);
const USERS = SPEC.filter(s => K.abil(s).some(a => CONVERT.includes(a)) && learns(s, 'protect'));
console.log('     carriers: ' + show(USERS));
const grounded = s => !s.types.includes('Flying');
const SELFUP = ['irondefense', 'amnesia', 'calmmind', 'bulkup', 'swordsdance', 'nastyplot', 'growth', 'workup', 'agility', 'cottonguard', 'acidarmor'];
const idle = s => K.idle(s) || SELFUP.map(x => D.moves.get(x)).find(m => legal(m) && learns(s, m.id)) || null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const SETTERS = FILL.filter(s => learns(s, 'psychicterrain') && grounded(s));
const KEEP = /^\|(-start|-activate|-damage|-fieldstart)\|/;
const OWN = /^\|(-start|-activate|-damage)\|/;
const counters = () => ({ conv: K.M.MEDSEEN.proteanConverted || 0, early: K.M.MEDSEEN.proteanBeforeTerrainBar || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let TE = null, OP = null;
outer: for (const u of USERS) {
  const ab = K.abil(u).find(a => CONVERT.includes(a));
  for (const pm of PRIO.filter(m => learns(u, m.id) && !u.types.every(t => t === m.type))) {
    for (const set of SETTERS.filter(s => s.baseSpecies !== u.baseSpecies).slice(0, 4))
      for (const foe of FILL.filter(s => grounded(s) && ![u.baseSpecies, set.baseSpecies].includes(s.baseSpecies)
        && D.getImmunity(pm.type, s) && D.getEffectiveness(pm.type, s) <= 0).slice(0, 6)) {
        const used = new Set([u.baseSpecies, u.id, set.baseSpecies, set.id, foe.baseSpecies, foe.id]);
        const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
        if (fills.length < 3) continue;
        /* the Protean body starts on the bench and walks in on turn 1, so its first move of the stint is turn 2's (a
         * Protect of its own on turn 1 would spend the once-per-switch-in conversion) */
        const A = [mon(fills[0], '', ['Protect']), mon(set, '', ['Psychic Terrain', 'Protect']), mon(u, '', [pm.name, 'Protect'], ab), mon(fills[1], '', ['Protect'])];
        const fi = idle(foe);
        if (!fi) continue;
        const B = [mon(foe, '', ['Protect', fi.name]), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
        /* the foe idles on both turns (a Protect of its own would refuse the move in both arms) */
        const t1 = setClick => ({ p1: [{ sw: u.id }, setClick], p2: [{ m: fi.id }, P.protect] });
        const t2 = { p1: [{ m: pm.id, t: 0 }, P.protect], p2: [{ m: fi.id }, P.protect] };
        const r = play('terrain', A, B, [t1({ m: 'psychicterrain' }), t2]);
        if (!r.staged) { console.log('   (skip ' + [u.id, pm.id, foe.id].join('/') + ': ' + r.why + ')'); continue; }
        const c = play('open', A, B, [t1(P.protect), t2]);
        if (!c.staged) { console.log('   (skip open ' + c.why + ')'); continue; }
        r.cast = set.id + ' Psychic Terrain t1; t2 ' + u.id + ' (' + ab + ') --' + pm.id + ' (' + pm.type + ')--> ' + foe.id;
        c.cast = 'the same, ' + set.id + ' clicking Protect on t1';
        TE = r; OP = c; break outer;
      }
  }
}
const RUNS = [['TERRAIN', TE], ['OPEN', OP]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const tc = R => R.sdK.findIndex(l => /^\|-start\|p1a[^|]*\|typechange\|/.test(l));
const act = R => R.sdK.findIndex(l => /^\|-activate\|p2a[^|]*\|move:psychicterrain$/.test(l));
ok(tc(TE) >= 0 && act(TE) > tc(TE), 'TERRAIN — the user converts, and the terrain refuses the move after it');
ok(tc(OP) >= 0 && act(OP) < 0, 'OPEN — the user converts and nothing refuses');

K.compareArms(RUNS, OWN, '-start / -activate / -damage');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(TE.counters.early === 1 && OP.counters.early === 0 && TE.counters.conv === 1 && OP.counters.conv === 1,
    'the engine\'s receipt: one conversion per arm, the TERRAIN one made ahead of the terrain\'s refusal',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
