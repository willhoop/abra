#!/usr/bin/env node
/* tests/probe_volley_first_hit_shield.js — A MULTI-HIT VOLLEY INTO A FIRST-HIT SHIELD (MULTISCALE, DISGUISE), IN A BATTLE AND
 * IN THE PRICE. 2026-09-23 (ENGINE pass 9, abra/regmc 0.72.0).
 *
 *   node tests/probe_volley_first_hit_shield.js --regulation regmc                        # Reg M-C
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_volley_first_hit_shield.js             # Reg M-B
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (read whole, both checkouts) ====================================
 *
 *   data/abilities.ts multiscale (Reg M-B :2750-2761, Reg M-C :2760-2771; the Champions mod names it in neither):
 *       onSourceModifyDamage(damage, source, target, move) { if (target.hp >= target.maxhp) return this.chainModify(0.5); }
 *     so only an arrival that meets the body at FULL HP is halved -- arrival 2 of a volley meets it below full.
 *   data/abilities.ts disguise (Reg M-B :960-1006, Reg M-C :970-1016): `onDamage` zeroes the first move hit and sets
 *     `busted`; `onUpdate` (raised between arrivals, data/mods/champions/scripts.ts hitStepMoveHitLoop) changes the forme
 *     to Mimikyu-Busted and charges baseMaxhp/8; `onEffectiveness` returns 0 (neutral) only while the species is
 *     `mimikyu`. So in MAINLINE the arrivals after the bust take their REAL type matchup.
 *   data/mods/champions/abilities.ts disguise -- REG M-B ONLY (:14-33; the Reg M-C mod has no disguise entry):
 *       onEffectiveness(...) { if (move.hit === 1) delete this.effectState.neutral; if (this.effectState.neutral) return 0; ...
 *                              this.effectState.neutral = true; return 0; }
 *     so in Reg M-B the neutral matchup is held for the WHOLE volley.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   SCALE     a multi-hit volley into a full-HP Multiscale body.
 *   SCALE-CTL the same volley into the same species carrying its other ability (no shield).
 *   PRICE     `dmgRange` for each arm's volley against the damage the authority's arrivals dealt (the engine-diff row).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_volley_first_hit_shield',
  ['MEDI_VOLLEY_SHIELD_EVERY_ARRIVAL'], { anyRegulation: true });
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
/* a plain single-target volley (a fixed count first, then the 2-5 family), no secondary, no power callback, no smart target */
const VOL = D.moves.all().filter(m => K.legal(m) && m.category !== 'Status' && m.target === 'normal' && m.multihit
  && !m.secondary && !m.secondaries && !m.onHit && !m.basePowerCallback && !m.priority && m.basePower > 0 && !m.smartTarget)
  .sort((a, b) => (typeof b.multihit === 'number') - (typeof a.multihit === 'number'));
console.log('     volleys: ' + VOL.map(m => m.id + ' x' + m.multihit + ' ' + m.type).join(', '));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const SCALE = SPEC.filter(s => abil(s).includes('multiscale') && abil(s).length > 1);
console.log('     multiscale bodies (with a second ability for the control): ' + show(SCALE));
const KEEP = /^\|(-damage|-activate|detailschange|-hitcount|faint|-resisted|-supereffective|-crit)\|/;
const OWN = /^\|(-damage|faint)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({}));

function stage(tag, def, defAb, pick) {
  for (const mv of VOL.filter(m => pick(m, def))) {
    const users = SPEC.filter(s => quiet(s) && learns(s, mv.id) && learns(s, 'protect') && s.id !== def.id).sort((a, b) => bulk(b) - bulk(a));
    if (process.env.VOL_DEBUG) console.log('   ' + tag + ' ' + mv.id + ' users ' + show(users));
    for (const u of users.slice(0, 6)) {
      const used = new Set([u.baseSpecies, u.id, def.baseSpecies, def.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
      if (fills.length < 4) continue;
      /* the defender's click touches nothing on its own side: an idle click, else its weakest plain hit into the user */
      const di = K.idle(def) || K.hitFor(def, u); if (!di) continue;
      const dClick = K.idle(def) ? { m: di.id } : { m: di.id, t: 0 };
      const A = [mon(u, '', [mv.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[3], '', ['Protect'])];
      const B = [mon(def, '', [di.name, 'Protect'], defAb), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const R = play(tag, A, B, [{ p1: [{ m: mv.id, t: 0 }, P.protect], p2: [dClick, P.protect] }]);
      if (!R.staged) { console.log('   (skip ' + tag + ' ' + u.id + '/' + mv.id + ': ' + R.why + ')'); continue; }
      const hits = R.sdK.filter(l => /^\|-damage\|p2a:/.test(l) && !/\[from\]/.test(l)).length;
      if (R.sdK.some(l => /^\|faint\|p2a:/.test(l))) { if (process.env.VOL_DEBUG) console.log('   (ko ' + tag + ' ' + u.id + '/' + mv.id + ')'); continue; }          /* a body the volley KOs hides the later arrivals */
      R.cast = u.id + ' ' + mv.id + ' x' + mv.multihit + ' -> ' + def.id + ' (' + defAb + ')';
      R.u = u; R.mv = mv; R.def = def; R.defAb = defAb; R.A = A; R.B = B; R.hits = hits;
      return R;
    }
  }
  return null;
}
const RUNS = [];
let S = null, SC = null;
for (const d of SCALE) {
  S = stage('scale', d, 'multiscale', (m, def) => D.getImmunity(m.type, def) && D.getEffectiveness(m.type, def) <= 0);
  if (!S) continue;
  const other = abil(d).find(a => a !== 'multiscale');
  SC = stage('scale-ctl', d, other, m => m.id === S.mv.id);
  break;
}
if (S) RUNS.push(['SCALE', S]); if (SC) RUNS.push(['SCALE-CTL', SC]);
const DG = null;
if (!S || !SC) { console.log('  NOT STAGED: ' + ['SCALE', 'SCALE-CTL'].filter((t, i) => ![S, SC][i]).join(', ')); process.exit(1); }
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const dmgs = R => R.sdK.filter(l => /^\|-damage\|p2a:/.test(l) && !/\[from\]/.test(l)).map(l => +(/\|(\d+)\//.exec(l) || [])[1]);
const hp0 = R => { const x = /\|\d+\/(\d+)/.exec(R.sdK.find(l => /^\|-damage\|p2a:/.test(l)) || ''); return x ? +x[1] : null; };
/* each MOVE arrival's own delta: every p2a -damage line moves the running HP, and only the bare ones (no [from]) are arrivals,
 * so Disguise's baseMaxhp/8 chip ([from] pokemon: Mimikyu-Busted) is carried in the running HP and never booked to the move */
const steps = R => { let prev = hp0(R); const out = [];
  for (const l of R.sdK.filter(x => /^\|-damage\|p2a:/.test(x))) { const h = +(/\|(\d+)\//.exec(l) || [])[1]; if (!/\[from\]/.test(l)) out.push(prev - h); prev = h; }
  return out; };
if (S && SC) {
  const s = steps(S), c = steps(SC);
  console.log('     SCALE arrivals ' + JSON.stringify(s) + '   SCALE-CTL arrivals ' + JSON.stringify(c));
  ok(s.length >= 2 && s.length === c.length && s[0] < c[0] && s.slice(1).every((x, i) => x === c[i + 1]),
    'SCALE — only the FIRST arrival is halved; the later ones match the unshielded control');
}
if (DG) console.log('     DISGUISE lines ' + DG.sdK.join('  '));

K.compareArms(RUNS, OWN, '-damage / faint');

console.log('\n5. THE PRICE (dmgRange, the engine-diff row) AGAINST THE BATTLE');
/* The price is asked with the BATTLE'S OWN BODIES (G.buildPair + G.freshBodies, the builder the arm played) for the arrival count the
 * authority dealt. The bottom arm plays the lowest damage roll AND lands every crit (engine/game_differential.js
 * CORNER_BOTTOM), so the price is asked as a crit and its LOW end is the number to match. */
const M = K.M;
const MCg = globalThis.MC || (typeof window !== 'undefined' && window.MC);
for (const [tag, R] of RUNS) {
  const pa = K.G.buildPair(R.A), pb = K.G.buildPair(R.B); const a = pa && K.G.freshBodies(pa), b = pb && K.G.freshBodies(pb);
  if (!a || !b || !MCg) { ok(false, tag + ' — the price bodies build', !MCg ? 'no MC table' : 'buildPair dropped a body'); continue; }
  const st = steps(R), total = st.reduce((t, x) => t + x, 0);
  let lo = null, err = null;
  try { const r = M.dmgRange(a[0], b[0], MCg.moves[R.mv.id], { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, sgA: {}, sgB: {} }, false, true, { hits: st.length });
        lo = r && r.min; }
  catch (e) { err = e.message + (process.env.VOL_DEBUG ? ' ' + e.stack : ''); }
  ok(lo === total, tag + ' — dmgRange for ' + st.length + ' arrivals, low end ' + lo + ', equals the authority\'s volley ' + total
    + ' ' + JSON.stringify(st), err);
}
K.finish();
