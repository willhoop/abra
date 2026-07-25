/* test-site-engine.js — the site's embedded damage engine must agree with the canonical one.
 *
 * WHY THIS EXISTS
 * ---------------
 * docs/ARCHITECTURE.md fault 1.1 names three implementations of the same rules: CHOMP's
 * champ-model.js, engine/medicham2-browser.js, and a third copy embedded in web/index.html. The cost
 * was realised once already — when the canonical engine learned real mega base stats the rollout
 * engine was left behind and the two disagreed by 30% on Charizard-Mega-Y's Special Attack, with
 * nothing failing.
 *
 * S2 says duplication that cannot be removed must be OBSERVABLE, and CHOMP/tests/test-engine-contract.js
 * covers the first two implementations. It has never covered the third — the one a user actually
 * interacts with. As of 2026-07-25 the site ran a rules engine that nothing verified.
 *
 * The site's copy is a hand-written IIFE assigned to MEDI2. It is not generated from anything, so it
 * can drift silently and there is no build step that would notice. Until it is replaced by a
 * generated artifact (S1), this test is the tripwire.
 *
 *   node tests/test-site-engine.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

/* --- the shared type chart, identical to the one validate_damage.js supplies -------------------- */
const TC = {
  Normal:{Rock:.5,Ghost:0,Steel:.5},
  Fire:{Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},
  Water:{Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},
  Electric:{Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},
  Grass:{Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},
  Ice:{Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},
  Fighting:{Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2,Fairy:.5},
  Poison:{Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Fairy:2},
  Ground:{Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},
  Flying:{Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},
  Psychic:{Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},
  Bug:{Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5,Fairy:.5},
  Rock:{Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},
  Ghost:{Normal:0,Psychic:2,Ghost:2,Dark:.5},
  Dragon:{Dragon:2,Steel:.5,Fairy:0},
  Dark:{Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Fairy:.5},
  Steel:{Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5,Fairy:2},
  Fairy:{Fire:.5,Fighting:2,Poison:.5,Dragon:2,Dark:2,Steel:.5},
};
const mcEff = (atk, defTypes) => {
  let m = 1;
  for (const d of (defTypes || [])) { const e = TC[atk] && TC[atk][d]; m *= (e === undefined ? 1 : e); }
  return m;
};

/* --- extract MEDI2 from the site ---------------------------------------------------------------- */
const html = fs.readFileSync(D('web', 'index.html'), 'utf8');
const start = html.indexOf('const MEDI2=(function(){');
ok(start > 0, 'found the embedded MEDI2 engine in web/index.html');
if (start < 0) { console.log(`\nSITE ENGINE TESTS: ${P} passed, ${F} failed`); process.exit(1); }

/* Walk to the IIFE's own close so a later `})();` in the file cannot truncate it. */
let depth = 0, end = -1;
for (let i = html.indexOf('{', start); i < html.length; i++) {
  const c = html[i];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = html.indexOf(';', i); break; } }
}
ok(end > start, 'located the end of the MEDI2 block');
const src = html.slice(start, end + 1);

/* --- run both engines on the same inputs -------------------------------------------------------- */
globalThis.mcEff = mcEff;
globalThis.MC = { mons: {}, moves: {} };
const CANON = require(D('engine', 'medicham2-browser.js'));

const sandbox = { MC: globalThis.MC, mcEff, Math, JSON, console, Object, Array, Number, String };
let SITE = null;
try {
  vm.createContext(sandbox);
  vm.runInContext(src + '\nglobalThis.__MEDI2=MEDI2;', sandbox, { timeout: 5000 });
  SITE = sandbox.__MEDI2 || sandbox.MEDI2;
} catch (e) {
  ok(false, `MEDI2 evaluates standalone: ${e.message}`);
}
ok(SITE && typeof SITE.dmgRange === 'function', 'the site copy exposes dmgRange');
if (!SITE || typeof SITE.dmgRange !== 'function') { console.log(`\nSITE ENGINE TESTS: ${P} passed, ${F} failed`); process.exit(1); }

/* Scenarios chosen to exercise the parts that have drifted before: STAB, immunity, resistance,
 * super-effective, spread reduction, and a boosted attacker. Stats are supplied directly so this
 * measures the FORMULA, exactly as validate_damage.js does. */
const T = (types) => types;
const att = (atk, types, extra = {}) => Object.assign(
  { st: { at: atk, sa: atk }, boosts: { at: 0, sa: 0 }, item: '', ability: '', types: T(types), status: null }, extra);
const def = (d, hp, types, extra = {}) => Object.assign(
  { st: { df: d, sd: d, hp }, boosts: { df: 0, sd: 0 }, item: '', ability: '', types: T(types), curHP: hp }, extra);

const CASES = [
  ['neutral physical',      att(180, ['Dragon','Ground']), def(120, 175, ['Fire','Dark']),   { bp: 100, c: 'P', t: 'Ground' }, {}, false],
  ['super-effective',       att(180, ['Ground']),          def(120, 175, ['Steel']),          { bp: 100, c: 'P', t: 'Ground' }, {}, false],
  ['resisted',              att(180, ['Fire']),            def(120, 175, ['Water']),          { bp: 100, c: 'S', t: 'Fire'  }, {}, false],
  ['immune (Ground/Flying)',att(180, ['Ground']),          def(120, 175, ['Flying']),         { bp: 100, c: 'P', t: 'Ground' }, {}, false],
  ['STAB special',          att(170, ['Fairy']),           def(115, 165, ['Dragon']),         { bp: 95,  c: 'S', t: 'Fairy' }, {}, false],
  ['spread halves',         att(180, ['Rock']),            def(120, 175, ['Flying']),         { bp: 75,  c: 'P', t: 'Rock'  }, {}, true ],
  ['rain boosts water',     att(170, ['Water']),           def(120, 175, ['Fire']),           { bp: 110, c: 'S', t: 'Water' }, { weather: 'rain' }, false],
  ['sun cuts water',        att(170, ['Water']),           def(120, 175, ['Fire']),           { bp: 110, c: 'S', t: 'Water' }, { weather: 'sun'  }, false],
];

let worst = 0, compared = 0;
for (const [name, A, Dd, mv, field, spread] of CASES) {
  let a, b;
  try { a = CANON.dmgRange(A, Dd, mv, field, spread); } catch (e) { ok(false, `${name}: canonical threw ${e.message}`); continue; }
  try { b = SITE.dmgRange(A, Dd, mv, field, spread); }  catch (e) { ok(false, `${name}: site copy threw ${e.message}`); continue; }
  compared++;
  const dmin = Math.abs((a.min || 0) - (b.min || 0));
  const dmax = Math.abs((a.max || 0) - (b.max || 0));
  const scale = Math.max(1, a.max || 1);
  const err = 100 * Math.max(dmin, dmax) / scale;
  worst = Math.max(worst, err);
  ok(err < 1, `${name}: canonical ${a.min}-${a.max} vs site ${b.min}-${b.max} (${err.toFixed(1)}% apart)`);
}
ok(compared === CASES.length, `all ${CASES.length} scenarios ran in both engines (${compared} did)`);
console.log(`\n  worst divergence: ${worst.toFixed(2)}%`);
console.log(`\nSITE ENGINE TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
