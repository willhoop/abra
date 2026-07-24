/* build_engine_data.js — generate data/engine-data.js FROM the canonical engine.
 *
 * Why this file exists
 * --------------------
 * data/engine-data.js is what the browser (site + rollout engine) uses for species, moves and the
 * type chart. It was maintained as its own artifact, and it stored only DERIVED values: each
 * species' level-50 stat line, with no base stats. That is a quiet but serious design fault:
 *
 *   - Derived-only data cannot be recomputed. When the canonical engine learned real mega base
 *     stats, the browser engine could not follow, because it had nothing to recompute FROM. It
 *     could only copy a number that was already wrong.
 *   - Two artifacts describing the same knowledge drift. "Every piece of knowledge must have a
 *     single, unambiguous, authoritative representation within a system" (Hunt & Thomas, The
 *     Pragmatic Programmer). Where several representations are unavoidable, DRY's own answer is
 *     that one is definitive and the rest are GENERATED.
 *
 * So this generator makes engine-data.js a build output of CHOMP/engine/champ-model.js, and it now
 * carries BOTH the base stats (source) and the level-50 line (convenience), so any consumer can
 * recompute rather than copy.
 *
 *   node build/build_engine_data.js
 * Overwrites data/engine-data.js. Never hand-edit that file.
 */
'use strict';
const fs = require('fs'), path = require('path');
const M = require(path.join(__dirname, '..', '..', 'CHOMP', 'engine', 'champ-model.js'));
const OUT = path.join(__dirname, '..', 'data', 'engine-data.js');

// keep whatever move/item/ability priors the previous file carried - those are ABRA's, not the
// engine's - but rebuild everything the engine owns.
let prior = {};
try {
  const t = fs.readFileSync(OUT, 'utf8');
  prior = JSON.parse(t.match(/const MC = (\{[\s\S]*?\});/)[1]);
} catch (e) { /* first run */ }

const mons = {};
for (const [key, m] of Object.entries(M.MONS)) {
  const old = (prior.mons || {})[key] || {};
  mons[key] = {
    t: m.t,
    bs: m.bs,                       // BASE stats — the source, so consumers can recompute
    st: old.st || null,             // level-50 line as previously stored (ABRA's assumed spread)
    mv: old.mv || [],
    item: old.item || null,
    ab: old.ab || null,
  };
  // if there was no stored line, derive a neutral one so nothing breaks
  if (!mons[key].st) {
    const S = b => Math.floor(Math.floor((2 * b + 31) * 50 / 100) + 5);
    mons[key].st = { hp: Math.floor((2 * m.bs.hp + 31) * 50 / 100) + 60, at: S(m.bs.atk),
                     df: S(m.bs.def), sa: S(m.bs.spa), sd: S(m.bs.spd), sp: S(m.bs.spe) };
  }
}

const MC = {
  mons,
  moves: prior.moves || {},
  C: M.C,
  priors: prior.priors || {},
};

const header = `/* engine-data.js — GENERATED. Do not hand-edit.
 * Source of truth: CHOMP/engine/champ-model.js (MONS, C) via ABRA/build/build_engine_data.js
 * Generated: ${new Date().toISOString().slice(0, 10)}
 * Carries BOTH base stats (bs) and the level-50 line (st): consumers must be able to RECOMPUTE,
 * not merely copy, or they cannot follow a change such as a mega forme swap. */
`;
fs.writeFileSync(OUT, header + '(function(root){\nconst MC = ' + JSON.stringify(MC) +
  ';\nroot.MC = MC;\n})(typeof window !== "undefined" ? window : globalThis);\n');

console.log(`build_engine_data — ${Object.keys(mons).length} species written`);
console.log(`  base stats present: ${Object.values(mons).filter(m => m.bs).length}`);
console.log(`  moves: ${Object.keys(MC.moves).length} | type chart: ${Object.keys(MC.C).length}`);
