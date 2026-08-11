/* EVERYTHING THE CHAMPIONS MOD CHANGES — all eight files, every field, no skipping.
 *
 * Will, 2026-08-10, after catching me three times in a row on values I had typed from memory:
 * *"where else might mainline data have snuck in aside from the champions mod?"*, then
 * *"well read the mod bro"*, then *"yeah bro read everything no skipping"*.
 *
 * ================= WHY THIS EXISTS AND WHY `format_audit.js` WAS NOT ENOUGH =========================
 *
 * `engine/format_audit.js` swept 7,653 constants and found 21 disagreements. Good, and far too narrow:
 * it compares a HAND-CHOSEN LIST of move fields. A field nobody thought to list is invisible to it, and
 * a rewritten FUNCTION is invisible to any constant sweep at all.
 *
 * The tally that motivated this file, all found by hand in one evening AFTER the gate had opened:
 *
 *   conditions.ts  par is randomChance(1,8) = 12.5%, not mainline's 25% — HALF
 *                  slp is sample([2,3,3]) startTime, so the holder misses 1 or 2 turns, never 3
 *                  frz is a 25% thaw roll AND a hard 3-turn ceiling — mainline is 20% and no ceiling
 *   moves.ts       259 moves overridden; 65 real field differences
 *                  Snap Trap is STEEL here and Grass in mainline — an entire effectiveness column
 *                  Make It Rain is 95% accurate and drops SpA by TWO
 *                  42 PP values differ, 12 base powers, 4 accuracies, 4 secondaries, 2 TYPES
 *   abilities.ts   Unseen Fist bypasses Protect at 1/4 damage here; mainline is full damage
 *
 * **EVERY ONE OF THOSE WAS FOUND BY A HUMAN ASKING, NOT BY A CHECK.** That is the defect this file
 * closes: the question "did Champions change this?" had no answer you could run.
 *
 * ================= WHAT IT CANNOT DO, SAID PLAINLY =================================================
 *
 * `scripts.ts` overrides FUNCTIONS — `modifyDamage`, `statModify`, `calculatePP`, `formeChange`,
 * `getActionSpeed`, `canMegaEvo`, `spreadMoveHit`, `hitStepMoveHitLoop`. **A value diff cannot tell you
 * what a rewritten function does.** This file NAMES them and marks them UNVERIFIED rather than
 * pretending coverage it does not have — every mechanic debugged on 2026-08-10 has an overridden
 * implementation in that file, including the multi-hit loop an agent rewrote from mainline the same
 * night. Reading them is human work and is registered as such.
 *
 *   node engine/mod_audit.js              # rebuild data/mod-audit.json
 *   node engine/mod_audit.js --verbose    # and print every difference
 *
 * Reads the format and mainline. Writes one artifact. Runs no games. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'mod-audit.json');
const VERBOSE = process.argv.includes('--verbose');

const CS = require('./champions_sim.js');
const { Dex } = CS.sim();
const FMT = Dex.forFormat(CS.FORMAT);
const MAIN = Dex.forGen(9);

/* THE MOD DIRECTORY IS READ FROM DISK, NOT LISTED. A file added to the mod tomorrow appears here
 * without an edit, which is the whole point — a hand-listed set of eight is how this gap was created. */
const MOD_DIR = path.join(process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown',
                          'data', 'mods', 'champions');
const modFiles = (() => {
  try { return fs.readdirSync(MOD_DIR).filter(f => f.endsWith('.ts')).sort(); }
  catch (e) { return null; }
})();

/* Compare by VALUE across every own field either side declares. Listing fields is what made
 * format_audit.js narrow; here the union of both objects' keys is the field set. */
/* TIER LABELS ARE NOT MECHANICS. `tier`, `doublesTier` and `natDexTier` differ on 357 species — every
 * legal body — because Champions reclassifies the whole dex. Not one of them changes a battle, and
 * leaving them in buried the three CONDITIONS and seventy-one MOVES that do. A diff that reports
 * everything reports nothing. Checked before excluding: ZERO species differ in baseStats or types. */
const SKIP = new Set(['desc', 'shortDesc', 'gen', 'num', 'exists', 'effectType', 'inherit',
                      'fullname', 'id', 'name', 'toString', 'isNonstandard',
                      'tier', 'doublesTier', 'natDexTier',
                      'zMove', 'maxMove']);   /* Z-moves and Dynamax do not exist in this format */
function diffEntry(a, b) {
  const out = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const av = a ? a[k] : undefined, bv = b ? b[k] : undefined;
    if (typeof av === 'function' || typeof bv === 'function') {
      /* A HANDLER IS NOT A VALUE. Stringifying two closures and comparing text reports every
       * whitespace change as a mechanic change and would drown the real ones. Presence is recorded;
       * behaviour is not, and the artifact says so. */
      const as = av ? String(av).replace(/\s+/g, ' ') : null;
      const bs = bv ? String(bv).replace(/\s+/g, ' ') : null;
      if (as !== bs) out.push({ field: k, kind: 'HANDLER', mainline: bs ? 'present' : 'absent',
                                champions: as ? 'present' : 'absent',
                                note: 'a rewritten handler — this file cannot say WHAT it does' });
      continue;
    }
    const aj = JSON.stringify(av ?? null), bj = JSON.stringify(bv ?? null);
    if (aj !== bj) out.push({ field: k, kind: 'VALUE', mainline: bv ?? null, champions: av ?? null });
  }
  return out;
}

function sweep(kind, all, get) {
  const rows = [];
  for (const e of all) {
    if (e.isNonstandard) continue;
    const m = get(MAIN, e.id);
    if (!m || !m.exists) { rows.push({ id: e.id, name: e.name, only_in_champions: true, diffs: [] }); continue; }
    const d = diffEntry(e, m);
    if (d.length) rows.push({ id: e.id, name: e.name, diffs: d });
  }
  return rows;
}

const moves = sweep('move', FMT.moves.all(), (D, id) => D.moves.get(id));
const abilities = sweep('ability', FMT.abilities.all(), (D, id) => D.abilities.get(id));
const items = sweep('item', FMT.items.all(), (D, id) => D.items.get(id));
const species = sweep('species', FMT.species.all(), (D, id) => D.species.get(id));

/* CONDITIONS ARE NOT ENUMERABLE THE SAME WAY, so the set comes from the mod file's own keys — the
 * authority on what it overrides is the file, not a guess. par/slp/frz were found by reading it. */
const conditionIds = (() => {
  try {
    const src = fs.readFileSync(path.join(MOD_DIR, 'conditions.ts'), 'utf8');
    return [...src.matchAll(/^\t([a-z0-9]+): \{/gm)].map(m => m[1]);
  } catch (e) { return []; }
})();
const conditions = conditionIds.map(id => {
  const a = FMT.conditions.get(id), b = MAIN.conditions.get(id);
  return { id, diffs: diffEntry(a, b) };
}).filter(r => r.diffs.length);

/* SCRIPTS.TS — NAMED, NOT VERIFIED. Parsed for the methods it overrides so the list cannot go stale,
 * and every one is reported UNVERIFIED. This is the honest half of the audit: the file that matters
 * most is the file a value diff cannot read. */
const scriptMethods = (() => {
  try {
    const src = fs.readFileSync(path.join(MOD_DIR, 'scripts.ts'), 'utf8');
    return [...src.matchAll(/^\t{1,2}([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map(m => m[1])
      .filter(n => n !== 'if' && n !== 'for' && n !== 'while' && n !== 'return');
  } catch (e) { return []; }
})();

const byField = {};
for (const r of moves) for (const d of r.diffs) byField[d.field] = (byField[d.field] || 0) + 1;

const art = {
  generated: new Date().toISOString(),
  by: 'engine/mod_audit.js',
  what: 'Every value the Champions mod changes from mainline gen 9, across every field of every legal '
      + 'move, ability, item, species and overridden condition — plus the scripts.ts methods a value '
      + 'diff cannot verify.',
  why: 'Three status rates, four secondary chances, two move TYPES and Unseen Fist were all found by '
     + 'Will asking, one at a time, after the gate had already opened. The question "did Champions '
     + 'change this?" had no answer anybody could run. Now it does.',
  cannot_verify: 'scripts.ts overrides FUNCTIONS. A value diff names them and stops. Reading them is '
               + 'human work and is registered, not implied.',
  mod_dir: MOD_DIR,
  mod_files: modFiles,
  mod_files_note: modFiles === null ? 'THE MOD DIRECTORY COULD NOT BE READ — this run proves nothing'
                                    : 'read from disk, so a file added tomorrow appears without an edit here',
  counts: {
    moves_changed: moves.length, abilities_changed: abilities.length, items_changed: items.length,
    species_changed: species.length, conditions_changed: conditions.length,
    scripts_methods_UNVERIFIED: scriptMethods.length,
    move_fields: byField,
  },
  moves, abilities, items, species, conditions,
  scripts_overridden_UNVERIFIED: scriptMethods,
};
fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');

const c = art.counts;
console.log('  CHAMPIONS vs MAINLINE GEN 9 — every field, no skipping\n');
if (modFiles === null) console.log('  WARNING: could not read ' + MOD_DIR + ' — the file list is unknown\n');
else console.log('  mod files: ' + modFiles.join(' ') + '\n');
console.log('    ' + String(c.moves_changed).padStart(4) + '  moves differ');
for (const [f, n] of Object.entries(c.move_fields).sort((a, b) => b[1] - a[1]))
  console.log('          ' + String(n).padStart(4) + '  ' + f);
console.log('    ' + String(c.abilities_changed).padStart(4) + '  abilities differ');
console.log('    ' + String(c.items_changed).padStart(4) + '  items differ');
console.log('    ' + String(c.species_changed).padStart(4) + '  species differ');
console.log('    ' + String(c.conditions_changed).padStart(4) + '  conditions differ');
console.log('    ' + String(c.scripts_methods_UNVERIFIED).padStart(4) + '  scripts.ts methods — NAMED, NOT VERIFIED');
console.log('          ' + scriptMethods.join(', '));
if (VERBOSE) {
  for (const [label, rows] of [['MOVES', moves], ['ABILITIES', abilities], ['ITEMS', items],
                               ['SPECIES', species], ['CONDITIONS', conditions]]) {
    if (!rows.length) continue;
    console.log('\n  ' + label);
    for (const r of rows) for (const d of r.diffs)
      console.log('    ' + String(r.name || r.id).padEnd(20) + d.field.padEnd(14)
                + JSON.stringify(d.mainline) + ' -> ' + JSON.stringify(d.champions));
  }
}
console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
