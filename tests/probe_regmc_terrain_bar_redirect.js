#!/usr/bin/env node
/* tests/probe_regmc_terrain_bar_redirect.js — PSYCHIC TERRAIN ASKS THE BODY A PRIORITY MOVE WAS REDIRECTED TO, NOT THE BODY
 * IT WAS AIMED AT, UNDER REG M-C. 2026-09-22 (abra/regmc 0.51.0).
 *
 *   node tests/probe_regmc_terrain_bar_redirect.js --regulation regmc                                      # green, exit 0
 *   MEDI_TERRAIN_BAR_PRE_REDIRECT=1 node tests/probe_regmc_terrain_bar_redirect.js --regulation regmc        # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts psychicterrain.condition.onTryHit :14114-14128 (not named by the Champions mod):
 *       if (effect && (effect.priority <= 0.1 || effect.target === 'self')) return;
 *       if (target.isSemiInvulnerable() || target.isAlly(source)) return;
 *       if (!target.isGrounded()) { ... return; }
 *       this.add('-activate', target, 'move: Psychic Terrain'); return null;
 *   It is a `TryHit` handler, raised by `hitStepTryHitEvent` on the move's TARGETS -- the list `getMoveTargets` built,
 *   after `RedirectTarget` (Follow Me) moved the aim. So a priority move aimed at an airborne body and drawn onto a
 *   grounded Follow Me user is refused, and one aimed at the airborne body with nothing drawing it lands.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   DRAWN     turn 1 Psychic Terrain goes up; turn 2 a grounded foe uses Follow Me and our priority move is aimed at its
 *             airborne partner: the move is drawn onto the Follow Me user and the terrain refuses it.
 *   AIMED     the same with the Follow Me user protecting: the priority move lands on the airborne body (the control).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_terrain_bar_redirect', ['MEDI_TERRAIN_BAR_PRE_REDIRECT']);
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P, legal, sure } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const PRIO = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.priority > 0 && m.target === 'normal' && sure(m)
  && !m.secondary && !m.secondaries && !m.self && !m.recoil && !m.drain && !m.onTry && !m.onTryHit && !m.onHit && !m.onAfterHit
  && !m.basePowerCallback && !m.onBasePower && !m.onModifyMove && !m.multihit && !m.breaksProtect).sort((a, b) => a.basePower - b.basePower);
console.log('     plain priority moves: ' + PRIO.map(m => m.id + ' +' + m.priority).join(', '));
const grounded = s => !s.types.includes('Flying');
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const DRAWERS = FILL.filter(s => learns(s, 'followme') && grounded(s));
const SETTERS = FILL.filter(s => learns(s, 'psychicterrain') && grounded(s));
const FLYERS = FILL.filter(s => !grounded(s) && K.idle(s));
console.log('     Follow Me users (quiet, grounded): ' + show(DRAWERS));
console.log('     Psychic Terrain setters: ' + show(SETTERS));
console.log('     airborne (Flying) bodies: ' + show(FLYERS));
const KEEP = /^\|(-activate|-damage|-singleturn|-fieldstart)\|/;
const OWN = /^\|(-activate|-damage)\|/;
const counters = () => ({ refused: K.M.MEDSEEN.priorityRefusedByTerrain || 0, post: K.M.MEDSEEN.terrainBarAskedRedirected || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let DR = null, AI = null;
outer: for (const dr of DRAWERS) for (const fl of FLYERS.filter(s => s.baseSpecies !== dr.baseSpecies).slice(0, 8))
  for (const set of SETTERS.filter(s => ![dr.baseSpecies, fl.baseSpecies].includes(s.baseSpecies)).slice(0, 4))
    for (const att of FILL.filter(s => ![dr.baseSpecies, fl.baseSpecies, set.baseSpecies].includes(s.baseSpecies)).slice(0, 40)) {
      const pm = PRIO.find(m => learns(att, m.id) && [dr, fl].every(t => D.getImmunity(m.type, t) && D.getEffectiveness(m.type, t) <= 0));
      if (!pm) continue;
      const used = new Set([dr.baseSpecies, dr.id, fl.baseSpecies, fl.id, set.baseSpecies, set.id, att.baseSpecies, att.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
      if (fills.length < 3) continue;
      const fi = K.idle(fl);
      const A = [mon(att, '', [pm.name, 'Protect']), mon(set, '', ['Psychic Terrain', 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const B = [mon(dr, '', ['Follow Me', 'Protect']), mon(fl, '', ['Protect', fi.name]), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect'])];
      const t1 = { p1: [P.protect, { m: 'psychicterrain' }], p2: [P.protect, P.protect] };
      const t2 = drawClick => ({ p1: [{ m: pm.id, t: 1 }, P.protect], p2: [drawClick, { m: fi.id }] });
      const r = play('drawn', A, B, [t1, t2({ m: 'followme' })]);
      if (!r.staged) { console.log('   (skip ' + [att.id, dr.id, fl.id].join('/') + ': ' + r.why + ')'); continue; }
      const c = play('aimed', A, B, [t1, t2(P.protect)]);
      if (!c.staged) { console.log('   (skip aimed ' + c.why + ')'); continue; }
      r.cast = set.id + ' Psychic Terrain t1; t2 ' + dr.id + ' Follow Me, ' + att.id + ' --' + pm.id + '--> ' + fl.id + ' (Flying)';
      c.cast = 'the same, ' + dr.id + ' clicking Protect';
      r.names = { dr: K.canon(dr.name.split('-')[0]), fl: K.canon(fl.name.split('-')[0]) };
      DR = r; AI = c; break outer;
    }
const RUNS = [['DRAWN', DR], ['AIMED', AI]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const act = R => R.sdK.filter(l => /^\|-activate\|p2a[^|]*\|move:psychicterrain$/.test(l)).length;
const hitFl = R => R.sdK.some(l => /^\|-damage\|p2b/.test(l));
const hitDr = R => R.sdK.some(l => /^\|-damage\|p2a/.test(l));
ok(act(DR) === 1 && !hitFl(DR) && !hitDr(DR), 'DRAWN — the move is drawn onto the grounded Follow Me user and the terrain refuses it');
ok(act(AI) === 0 && hitFl(AI), 'AIMED — with nothing drawing it the move lands on the airborne body');

K.compareArms(RUNS, OWN, '-activate / -damage');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(DR.counters.refused === 1 && AI.counters.refused === 0 && DR.counters.post >= 1,
    'the terrain refused once in DRAWN (asked of the redirected body) and never in AIMED', JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
