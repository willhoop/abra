#!/usr/bin/env node
/* tests/probe_regmc_flinch_residual_list.js — A FLINCH IS STILL A VOLATILE AT THE RESIDUAL, AND ITS PLACE IN THE
 * AUTHORITY'S HANDLER LIST DECIDES A SPEED TIE. UNDER REG M-C. 2026-09-24 (ENGINE, narration to zero, cause B).
 *
 *   node tests/probe_regmc_flinch_residual_list.js --regulation regmc                                 # green, exit 0
 *   MEDI_FLINCH_GONE_AT_RESIDUAL=1 node tests/probe_regmc_flinch_residual_list.js --regulation regmc  # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout pokemon-showdown-mc f10d679; read whole) ==========
 *
 *   data/conditions.ts flinch: `duration: 1`, `onBeforeMovePriority: 8`, `onBeforeMove` writes `cant` and returns false.
 *   Nothing removes the volatile when it spends the turn; it expires in the residual. `fieldEvent('Residual')`
 *   (sim/battle.ts :484-524) collects a handler with a `duration` under `getKey = 'duration'`, so the flinch stands IN the
 *   list `speedSort` (:429-460, a selection sort) orders -- ahead of its holder's item and field handlers, at order
 *   4294967296. A selection sort's swaps move a tied pair differently depending on what stands between them, and the
 *   differential pins the shuffle to the identity. Read off the authority's own list (a preload hook on
 *   `fieldEvent('Residual')`), Reg M-C lattice 1600, omit-weather `…2684772479 vs …2684878616` t1, the two Rillaboom
 *   at 137:
 *       BEFORE  grassyterrain(field,27) flinch@p1a gt@p1a(137) protect@p1b stall@p1b gt@p1b(324) gt@p2a(137) gt@p2b(178)
 *       AFTER   gt@p1b gt@p2b gt@p1a gt@p2a ...        -> p1a heals first
 *   This engine cleared `_flinch` when the flinch spent the turn and again at the end of the action loop, both above
 *   the residual list's build, so its list held no flinch and the same sort put p2a first.
 *
 * ================= THE ARMS (both engines play the same scripted turn; SHOWDOWN IS THE ANSWER) ====
 *
 *   The field case's species is not legal in this dex, so the shape is rebuilt from what is: a tied pair T (the same
 *   species and set on both sides, a Leftovers each, order 5 / subOrder 4) and two faster bodies carrying an order-5
 *   ABILITY residual (Shed Skin / Hydration / Healer: nothing to cure, so no line and no die), p2b the fastest.
 *   FLINCH   p2a Fake Outs p1a; p1b and p1a hit p2a, p2b hits p1a. p1a flinches. Both tied bodies are hurt.
 *   CONTROL  the same, but p2a's Fake Out goes to p1b: the flinch stands on p1b's handlers instead. The authority heals
 *            the tied pair in the OTHER order, so where the flinch stands moves the answer -- the comparison can see it.
 * The residual handlers are found by their order in the format's own dex, never by name.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_flinch_residual_list', ['MEDI_FLINCH_GONE_AT_RESIDUAL']);
const { D, ok, SPEC, learns, abil, quiet, mon, hitFor } = K;

const HEAL = D.items.all().filter(i => K.legal(i) && i.onResidualOrder === 5 && !/Poison/.test(String(i.onResidual)));
const RAB = D.abilities.all().filter(a => K.legal(a) && a.onResidualOrder === 5).map(a => a.id);
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     order-5 heal items: ' + HEAL.map(i => i.id).join(', ') + '   order-5 abilities: ' + RAB.join(', '));
if (!HEAL.length || !RAB.length) { ok(false, 'a legal order-5 residual heal item and a legal order-5 residual ability exist'); K.finish(); }
const spe = s => s.baseStats.spe;
const KEEP = /^\|(-heal|cant|move|-damage|upkeep)\|/;
const OWN = /^\|-heal\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ flinchHeld: K.M.MEDSEEN.flinchHeldToResidual || 0 }));
const TS = SPEC.filter(s => learns(s, 'fakeout') && quiet(s)).sort((a, b) => spe(a) - spe(b));
const FS = SPEC.filter(s => abil(s).some(a => RAB.includes(a)));

let FL = null, CT = null;
outer: for (const t of TS) {
  const hotter = FS.filter(s => s.baseSpecies !== t.baseSpecies && spe(s) > spe(t)).sort((a, b) => spe(b) - spe(a));
  for (const f2 of hotter) for (const f1 of hotter.filter(s => s.baseSpecies !== f2.baseSpecies && spe(s) < spe(f2))) {
    const hTT = hitFor(t, t), h1 = hitFor(f1, t), h2 = hitFor(f2, t);
    if (!hTT || !h1 || !h2) continue;
    const ra = s => abil(s).find(a => RAB.includes(a));
    const fill = SPEC.filter(s => quiet(s) && ![t, f1, f2].some(x => x.baseSpecies === s.baseSpecies)).slice(0, 2);
    const it = HEAL[0].name;
    const A = [mon(t, it, [hTT.name, 'Fake Out']), mon(f1, '', [h1.name], ra(f1)), mon(fill[0], '', [K.idle(fill[0]) ? K.idle(fill[0]).name : 'Protect']), mon(fill[1], '', ['Protect'])];
    const B = [mon(t, it, [hTT.name, 'Fake Out']), mon(f2, '', [h2.name], ra(f2)), mon(fill[1], '', ['Protect']), mon(fill[0], '', ['Protect'])];
    const sc = fo => [{ p1: [{ m: hTT.id, t: 0 }, { m: h1.id, t: 0 }], p2: [{ m: 'fakeout', t: fo }, { m: h2.id, t: 0 }] }];
    const f = play('flinch', A, B, sc(0));
    if (!f.staged) { console.log('   (skip ' + t.id + '/' + f1.id + '/' + f2.id + ': ' + f.why + ')'); continue; }
    if (!f.sdK.some(l => /^\|cant\|p1a:.*flinch/.test(l)) || f.sdK.filter(l => OWN.test(l)).length !== 2) {
      console.log('   (skip ' + t.id + '/' + f1.id + '/' + f2.id + ': the fixture did not flinch p1a and heal both)'); continue; }
    const c = play('control', A, B, sc(1));
    if (!c.staged || c.sdK.filter(l => OWN.test(l)).length !== 2) { console.log('   (skip control ' + t.id + ')'); continue; }
    const cast = t.id + ' @ ' + it + ' x2 (base spe ' + spe(t) + '), p1b ' + f1.id + ' [' + ra(f1) + '] (' + spe(f1) + '), p2b ' + f2.id + ' [' + ra(f2) + '] (' + spe(f2) + ')';
    f.cast = cast + ' -- p2a Fake Outs p1a'; c.cast = cast + ' -- p2a Fake Outs p1b';
    FL = f; CT = c; break outer;
  }
}
const RUNS = [['FLINCH', FL], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const heals = R => R.sdK.filter(l => OWN.test(l)).map(l => l.split('|')[2].slice(0, 3)).join(',');
ok(FL.sdK.some(l => /^\|cant\|p1a:.*flinch/.test(l)) && CT.sdK.some(l => /^\|cant\|p1b:.*flinch/.test(l)), 'FLINCH — p1a flinches; CONTROL — p1b flinches');
ok(heals(FL) === 'p1a,p2a', 'FLINCH — the authority heals p1a first (the flinch stands ahead of p1a\'s heal in its list)', heals(FL));
ok(heals(CT) === 'p2a,p1a', 'CONTROL — the authority heals p2a first: the flinch\'s place alone moves the tied pair', heals(CT));

K.compareArms(RUNS, OWN, '-heal');
console.log('\n5. THE COUNTER');
ok(K.KNOBS.length ? true : (FL.counters.flinchHeld > 0 && CT.counters.flinchHeld > 0), 'MEDSEEN.flinchHeldToResidual rose in both arms (a spent flinch still stood in the list)',
  'flinch ' + FL.counters.flinchHeld + '  control ' + CT.counters.flinchHeld);
K.finish();
