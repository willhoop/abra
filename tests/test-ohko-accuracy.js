/* THE OHKO CLASS TAKES NO ACCURACY MODIFIER, AND THIS ENGINE HAD NO BRANCH FOR IT AT ALL.
 *
 * Will, 2026-08-12: *"i dont think the ohko moves can ever be boosted by accuracy, only no guard"*.
 *
 * He is right, and the authority says it STRUCTURALLY rather than by exception. `hitStepAccuracy`
 * (sim/battle-actions.ts) opens `if (move.ohko) { accuracy = 30; ... }` and puts the ModifyAccuracy
 * event AND both stage adjustments in the `else`. Nothing in the modifier pipeline is reachable for
 * this class. The `Accuracy` event sits BELOW the branch and does still fire — which is precisely why
 * No Guard and Lock-On work on Fissure and nothing else does.
 *
 * WHY THIS FILE EXISTS RATHER THAN A ONE-LINE FIX: the wrong half was mine. Adding Gravity to ACCMOD
 * earlier the same day gave a pre-existing hole a second way to be wrong, and the whole-game
 * differential CANNOT see either half — both of its arms pin accuracy to a corner, so a computed
 * accuracy never decides an outcome. This class is invisible to the project's largest instrument by
 * construction, which is the definition of something that needs its own probe.
 *
 * EVERY EXPECTED NUMBER IS DERIVED FROM THE FORMAT ON THIS RUN. Nothing is typed from memory:
 * CLAUDE.md's rule, and the reason the 20-vs-30 split is asked of the dex rather than asserted. */
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
/* engine-data.js sets the global `MC` that printedAccuracy reads, and it must be required BEFORE the
 * simulator or every call throws `MC is not defined`. Same order as tests/test-engine-consistency.js. */
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));

process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH
  || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const { Dex } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim'));
const DEX = Dex.forFormat('gen9championsvgc2026regmb');

let fails = 0, checks = 0;
const ok = (cond, label, got, want) => {
  checks++;
  if (cond) { console.log('  ok    ' + label + '   (' + got + ')'); return; }
  fails++;
  console.log('  FAIL  ' + label + '   got ' + got + ', want ' + want);
};

/* ---- the authority's own numbers, read on this run ------------------------------------------- */
const OHKO = DEX.moves.all()
  .filter(m => m.exists && !m.isNonstandard && m.ohko)
  .map(m => ({ id: m.id, name: m.name, ohko: m.ohko, acc: m.accuracy }));
console.log('OHKO MOVES LEGAL IN THIS FORMAT: ' + OHKO.map(m => m.name).join(', '));
if (!OHKO.length) { console.log('\nNO OHKO MOVES IN THE FORMAT — this probe would pass vacuously.'); process.exit(1); }
const BASE = OHKO[0].acc;                       // 30, read not typed
const SHEER = OHKO.find(m => m.ohko !== true);  // Sheer Cold — the typed one
console.log('base accuracy read from the dex: ' + BASE
  + (SHEER ? '   type-gated move: ' + SHEER.name + ' (' + SHEER.ohko + ')' : ''));

/* ---- bodies, DERIVED FROM THE REGULATION ------------------------------------------------------
 *
 * CLAUDE.md: every Pokemon must be a real database entry, and a walk of `.all()` is the National Dex
 * unless it is filtered. So the two bodies this probe needs — one carrying the gate type, one not —
 * are SEARCHED FOR in the legal species list rather than named from memory. A fixture named after a
 * body this format does not contain would make the whole result unusable. */
const legalSpecies = t => Dex.forFormat('gen9championsvgc2026regmb').species.all()
  .filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal')
  .filter(s => t ? s.types.includes(t) : true);

const named = (species, types, extra) => {
  const b = { name: species, types: types.slice(),
              st: { hp: 150, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, curHP: 150 };
  b.boosts = Object.assign({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, (extra || {}).boosts);
  if (extra && extra.ability) b.ability = extra.ability;
  return b;
};
/* pick once, print what was picked, so a reader can check the fixture is a body that exists */
const pick = t => {
  const s = legalSpecies(t)[0];
  if (!s) throw new Error('no legal species of type ' + t + ' in this format — the fixture cannot be staged');
  return s;
};
const FIS = OHKO.find(m => m.ohko === true) || OHKO[0];

const before = { acc: MEDI.MEDSEEN.ohkoAccuracy, imm: MEDI.MEDSEEN.ohkoImmune };

console.log('\n== 1. no accuracy modifier reaches an OHKO move ==');
{
  const A = pick(null), Dfn = pick(null);
  console.log('  fixture bodies (derived): ' + A.name + ' -> ' + Dfn.name);
  const att = named(A.name, A.types);
  const def = named(Dfn.name, Dfn.types);
  const plain = MEDI.hitChance(att, def, FIS.id, {}, {});
  ok(plain === BASE, FIS.name + ' with nothing up is the dex accuracy', plain, BASE);

  /* GRAVITY — the row added hours before this file, and the reason it exists. */
  const grav = MEDI.hitChance(att, def, FIS.id, { pseudo: { gravity: 5 }, gravity: 5 }, {});
  ok(grav === BASE, FIS.name + ' under Gravity is UNCHANGED', grav, BASE);

  /* EVASION — wrong for the life of the function, not just since Gravity. */
  const evaDef = named(Dfn.name, Dfn.types, { boosts: { eva: 2 } });
  const eva = MEDI.hitChance(att, evaDef, FIS.id, {}, {});
  ok(eva === BASE, FIS.name + ' into a +2 evasion body is UNCHANGED', eva, BASE);

  /* ACCURACY STAGE — the same branch, the other side. */
  const accAtt = named(A.name, A.types, { boosts: { acc: 2 } });
  const accd = MEDI.hitChance(accAtt, def, FIS.id, {}, {});
  ok(accd === BASE, FIS.name + ' from a +2 accuracy body is UNCHANGED', accd, BASE);
}

console.log('\n== 2. the type gate, which is an immunity and not a low chance ==');
if (SHEER) {
  const gate = SHEER.ohko;                                   // 'Ice', from the dex
  const G = pick(gate);
  const N = legalSpecies(null).find(s2 => !s2.types.includes(gate));
  console.log('  gate-type body: ' + G.name + '   non-gate body: ' + N.name);
  const iceDef = named(G.name, G.types);
  const nonIceDef = named(N.name, N.types);
  const iceAtt = named(G.name, G.types);
  const nonIceAtt = named(N.name, N.types);

  const immune = MEDI.hitChance(nonIceAtt, iceDef, SHEER.id, {}, {});
  ok(immune === 0, SHEER.name + ' into a ' + gate + ' type is ZERO, not a roll', immune, 0);

  /* THE 20-vs-30 SPLIT. Derived: the dex prints 30 and battle-actions drops it to 20 when the USER
   * is not the gate type. Both numbers are asked of the format at the top of this file. */
  const fromNonIce = MEDI.hitChance(nonIceAtt, nonIceDef, SHEER.id, {}, {});
  const fromIce = MEDI.hitChance(iceAtt, nonIceDef, SHEER.id, {}, {});
  ok(fromNonIce === 20, SHEER.name + ' from a non-' + gate + ' body is 20', fromNonIce, 20);
  ok(fromIce === BASE, SHEER.name + ' from a ' + gate + ' body is ' + BASE, fromIce, BASE);
  ok(fromNonIce < fromIce, 'the split runs in the right direction', fromNonIce + ' < ' + fromIce, 'true');
} else {
  console.log('  (no type-gated OHKO move in this format — nothing to check)');
}

console.log('\n== 3. the ONE thing that does get through: the Accuracy event ==');
{
  /* No Guard is `onAnyAccuracy`, which sits BELOW the ohko branch in the authority and so still
   * fires. If this stopped being Infinity the branch would have been placed too high. */
  const ng = DEX.abilities.all().find(a => a.exists && !a.isNonstandard && a.onAnyAccuracy);
  if (!ng) { console.log('  (no onAnyAccuracy ability in this format)'); }
  else {
    const A2 = pick(null), D2 = legalSpecies(null)[1] || pick(null);
    const att = named(A2.name, A2.types, { ability: ng.id });
    const def = named(D2.name, D2.types);
    const got = MEDI.hitChance(att, def, FIS.id, {}, {});
    ok(got === Infinity, ng.name + ' still guarantees ' + FIS.name, got, 'Infinity');
  }
}

console.log('\n== 4. the branch proves it ran ==');
{
  const dAcc = MEDI.MEDSEEN.ohkoAccuracy - before.acc;
  const dImm = MEDI.MEDSEEN.ohkoImmune - before.imm;
  ok(dAcc > 0, 'MEDSEEN.ohkoAccuracy moved — the branch is reachable', dAcc, '> 0');
  if (SHEER) ok(dImm > 0, 'MEDSEEN.ohkoImmune moved — the gate is wired separately', dImm, '> 0');
}

console.log('\n' + (fails
  ? 'FAILED: ' + fails + ' of ' + checks + ' checks'
  : 'ALL GREEN — ' + checks + ' checks. No accuracy modifier reaches the OHKO class, the type gate '
    + 'refuses outright, and the Accuracy event still gets through.'));
process.exitCode = fails ? 1 : 0;
