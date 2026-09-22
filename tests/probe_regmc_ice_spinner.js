#!/usr/bin/env node
/* tests/probe_regmc_ice_spinner.js — A DAMAGING MOVE THAT REMOVES THE TERRAIN AFTER IT HITS (ICE SPINNER), UNDER REG M-C.
 * 2026-09-22 (abra/regmc 0.45.0).
 *
 *   node tests/probe_regmc_ice_spinner.js --regulation regmc                               # green, exit 0
 *   MEDI_AFTERHIT_TERRAIN_INERT=1 node tests/probe_regmc_ice_spinner.js --regulation regmc   # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts icespinner :9417-9437 (the Champions mod names it only in learnsets):
 *       onAfterHit(target, source) { this.field.clearTerrain(); }
 *       onAfterSubDamage(damage, target, source) { if (source.hp) this.field.clearTerrain(); }
 *   sim/battle-actions.ts :1120-1127 raises `AfterHit` after `DamagingHit` and only `if (moveData.onAfterHit && pokemon.hp)`;
 *   sim/field.ts clearTerrain :159-167 is a no-op with no terrain, else the terrain's FieldEnd writes
 *   `-fieldend|move: <Terrain>`. The Reg M-B checkout carries the identical handler pair. The move is found by its TAG
 *   (`clearsTerrainAfterHit`), and the tag is checked against the dex below.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   CLEAR     turn 1 the user's partner sets a terrain; turn 2 the user's Ice Spinner hits a foe: the terrain ends.
 *   SUB       the same, the foe behind a Substitute made on turn 1: the terrain still ends (onAfterSubDamage).
 *   NONE      Ice Spinner with no terrain up: nothing ends.
 *   CONTROL   the CLEAR arm with the user's plain move in place of Ice Spinner: the terrain stays.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_ice_spinner', ['MEDI_AFTERHIT_TERRAIN_INERT']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const TAGGED = Object.keys(TAGS.moves).filter(m => (TAGS.moves[m].params || {}).clearsTerrainAfterHit);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     clearsTerrainAfterHit: ' + (TAGGED.join(', ') || '(none)'));
const DEXM = D.moves.all().filter(m => K.legal(m) && m.category !== 'Status' && /clearTerrain\(\)/.test(String(m.onAfterHit || '')));
console.log('     legal damaging moves whose onAfterHit clears the terrain (dex): ' + DEXM.map(m => m.id).join(', '));
ok(DEXM.length > 0 && DEXM.length === TAGGED.length && DEXM.every(m => TAGGED.includes(m.id)),
  'the tag and the dex name the same moves', 'dex ' + DEXM.map(m => m.id) + ' vs tag ' + TAGGED);
const MV = DEXM[0];
if (!MV) K.finish();
/* the terrain: a legal status move that sets one (the first by id; any terrain is cleared alike) */
const TMOVE = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.terrain && m.target === 'all')
  .sort((a, b) => a.id < b.id ? -1 : 1);
console.log('     terrain-setting status moves: ' + TMOVE.map(m => m.id).join(', '));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const USERS = FILL.filter(s => learns(s, MV.id));
console.log('     users (quiet, learn ' + MV.id + ' and Protect): ' + show(USERS));
const KEEP = /^\|(-fieldstart|-fieldend|-start|-activate|-end|-damage)\|/;
/* the lines compared are the ENDS: the terrain move's own `-fieldstart` carries `[of] <setter>` here and not on the
 * authority -- a spelling the driver's alignment already folds (each arm's first protocol divergence reads none), and not
 * this mechanic's; the start is still asserted on the authority in section 3 and on the boards. */
const OWN = /^\|-fieldend\|/;
const counters = () => ({ cleared: K.M.MEDSEEN.terrainClearedAfterHit || 0, none: K.M.MEDSEEN.terrainClearAfterHitNoTerrain || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let CL = null, SU = null, NO = null, CT = null;
outer: for (const u of USERS) {
  for (const setter of FILL.filter(s => s.baseSpecies !== u.baseSpecies)) {
    const tm = TMOVE.find(m => learns(setter, m.id));
    if (!tm) continue;
    /* the foe must take Ice Spinner neutrally or resisted and survive two hits; it must learn Substitute for the SUB arm */
    for (const foe of FILL.filter(s => ![u.baseSpecies, setter.baseSpecies].includes(s.baseSpecies)
        && D.getImmunity(MV.type, s) && D.getEffectiveness(MV.type, s) <= 0 && learns(s, 'substitute')).slice(0, 12)) {
      const ctl = K.hitFor(u, foe, m => m.id !== MV.id);
      if (!ctl) continue;
      const used = new Set([u.baseSpecies, u.id, setter.baseSpecies, setter.id, foe.baseSpecies, foe.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
      if (fills.length < 3) continue;
      const A = mv1 => [mon(u, '', [mv1, 'Protect']), mon(setter, '', [tm.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const set = { p1: [P.protect, { m: tm.id }], p2: [P.protect, P.protect] };
      const setSub = { p1: [P.protect, { m: tm.id }], p2: [{ m: 'substitute' }, P.protect] };
      /* turn 2: the foe must stand to be hit, so it clicks a repeatable idle move (a second Protect would fail on a
       * die), and its partner protects. Turn 1: the foe protects, or makes its Substitute in the SUB arm. */
      const fi = K.idle(foe);
      if (!fi) continue;
      const B2 = [mon(foe, '', ['Substitute', 'Protect', fi.name]), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const t2 = id => ({ p1: [{ m: id, t: 0 }, P.protect], p2: [{ m: fi.id }, P.protect] });
      const t1n = { p1: [P.protect, P.protect], p2: [P.protect, P.protect] };
      const r = play('clear', A(MV.name), B2, [set, t2(MV.id)]);
      if (!r.staged) { console.log('   (skip ' + u.id + '/' + setter.id + '/' + foe.id + ': ' + r.why + ')'); continue; }
      const s = play('sub', A(MV.name), B2, [setSub, t2(MV.id)]);
      const n = play('none', A(MV.name), B2, [t1n, t2(MV.id)]);
      const c = play('control', A(ctl.name), B2, [set, t2(ctl.id)]);
      if (!s.staged || !n.staged || !c.staged) { console.log('   (skip ' + u.id + '/' + foe.id + ': ' + [s, n, c].filter(x => !x.staged).map(x => x.why).join('; ') + ')'); continue; }
      r.cast = setter.id + ' ' + tm.id + ' (t1), then ' + u.id + ' --' + MV.id + '--> ' + foe.id;
      s.cast = 'the same, ' + foe.id + ' behind a Substitute made on t1';
      n.cast = u.id + ' --' + MV.id + '--> ' + foe.id + ', no terrain';
      c.cast = setter.id + ' ' + tm.id + ' (t1), then ' + u.id + ' --' + ctl.id + '--> ' + foe.id;
      CL = r; SU = s; NO = n; CT = c; break outer;
    }
  }
}
const RUNS = [['CLEAR', CL], ['SUB', SU], ['NONE', NO], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const ends = R => R.sdK.filter(l => /^\|-fieldend\|/.test(l)).length;
const starts = R => R.sdK.filter(l => /^\|-fieldstart\|/.test(l)).length;
const subUp = R => R.sd.some(l => /^\|-start\|[^|]*\|Substitute/.test(l));
ok(starts(CL) === 1 && ends(CL) === 1, 'CLEAR — the terrain starts on turn 1 and ends on the hit');
ok(starts(SU) === 1 && ends(SU) === 1 && subUp(SU), 'SUB — the Substitute stands, and the terrain still ends');
ok(starts(NO) === 0 && ends(NO) === 0, 'NONE — no terrain, nothing ends');
ok(starts(CT) === 1 && ends(CT) === 0, 'CONTROL — a plain hit leaves the terrain');

K.compareArms(RUNS, OWN, '-fieldend');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(CL.counters.cleared === 1 && SU.counters.cleared === 1 && NO.counters.cleared === 0 && NO.counters.none === 1 && CT.counters.cleared === 0,
    'the engine\'s receipts: one clear in CLEAR and SUB, a no-terrain answer in NONE, nothing in CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
