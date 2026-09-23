#!/usr/bin/env node
/* tests/probe_residual_interleave_tie.js — AT ONE RESIDUAL ORDER, TWO SPEED-TIED BODIES RUN HANDLER-MAJOR.
 * 2026-09-23 (ENGINE pass 10, abra/regmc 0.86.0).
 *
 *   node tests/probe_residual_interleave_tie.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_residual_interleave_tie.js
 *   MEDI_RESIDUAL_BODY_MAJOR=1   restores the body-major walk (must exit 1)
 *
 * THE AUTHORITY: `fieldEvent('Residual')` collects every handler and sorts ONCE by `comparePriority` -- order, priority,
 * speed, subOrder (sim/battle.ts). Grassy Terrain's per-body heal and Leftovers share an order and differ in subOrder, so
 * two bodies TIED on Speed run both heals before either Leftovers. The same species on both sides with the same spread is
 * the tie; Leftovers on one of them is the second handler.
 * ARMS: HEAL (a Grassy Terrain setter beside one of the pair; both of the pair trade a plain hit each turn, three turns).
 * The authority must show heal, heal, Leftovers at least once; both engines are compared line for line.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_residual_interleave_tie', ['MEDI_RESIDUAL_BODY_MAJOR'], { anyRegulation: true });
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, legal, hitFor } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const LEFT = D.items.all().find(i => legal(i) && /heal\(pokemon\.baseMaxhp \/ 16\)/.test(String(i.onResidual || '')));
const GT = D.moves.get('grassyterrain');
if (!LEFT || !legal(GT)) { console.log('  NOT RUN — no legal Leftovers-shaped item or Grassy Terrain'); process.exit(2); }
const grounded = s => !s.types.includes('Flying') && !Object.values(s.abilities).includes('Levitate');
const PAIR = SPEC.filter(s => quiet(s) && grounded(s) && learns(s, 'protect') && bulk(s) >= 250).sort((a, b) => bulk(b) - bulk(a));
const SETTER = SPEC.filter(s => quiet(s) && learns(s, 'grassyterrain') && learns(s, 'protect'));
console.log('     item ' + LEFT.id + '; terrain setters: ' + SETTER.slice(0, 4).map(s => s.id).join(', '));
let R = null;
outer: for (const x of PAIR) {
  const hit = hitFor(x, x); if (!hit) continue;
  for (const st of SETTER) {
    if (st.baseSpecies === x.baseSpecies) continue;
    const used = new Set([x.baseSpecies, x.id, st.baseSpecies, st.id]);
    const f = pickDistinct(SPEC.filter(s => quiet(s) && learns(s, 'protect') && !used.has(s.baseSpecies)), used, 3);
    if (f.length < 3) continue;
    const A = [mon(x, LEFT.name, [hit.name, 'Protect']), mon(st, '', ['Grassy Terrain', 'Protect']), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect'])];
    const B = [mon(x, '', [hit.name, 'Protect']), mon(f[2], '', ['Protect']), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect'])];
    const t = (p1b) => ({ p1: [{ m: hit.id, t: 0 }, p1b], p2: [{ m: hit.id, t: 0 }, P.protect] });
    const r = K.play('heal', A, B, [t({ m: 'grassyterrain' }), t(P.protect), t({ m: 'grassyterrain' })], /^\|(-heal|-damage|move|upkeep)\|?/);
    if (!r.staged) { console.log('   (skip ' + x.id + '/' + st.id + ': ' + r.why + ')'); continue; }
    r.cast = x.id + ' @ ' + LEFT.id + ' opposite a bare ' + x.id + ', ' + hit.id + ' each turn, ' + st.id + ' raising Grassy Terrain';
    R = r; break outer;
  }
}
if (!R) { console.log('  NO CAST FOUND'); process.exit(1); }
K.printArms([['HEAL', R]]);
console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const heals = R.sdK.filter(l => /^\|-heal\|/.test(l));
let inter = false;
for (let i = 0; i + 2 < heals.length; i++)
  if (/grassyterrain/.test(heals[i]) && /grassyterrain/.test(heals[i + 1]) && /item:leftovers/.test(heals[i + 2])
      && heals[i].split('|')[2].slice(0, 2) !== heals[i + 1].split('|')[2].slice(0, 2)) inter = true;
ok(inter, 'HEAL — the authority runs both Grassy heals of the tied pair before the Leftovers, at least once', heals.join('  '));
K.compareArms([['HEAL', R]], /^\|-heal\|/, '-heal');
K.finish();
