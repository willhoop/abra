/* test-mod-conformance.js — DOES OUR RULEBOOK CARRY THE CHAMPIONS VALUE, OR MAINLINE'S?
 *
 * Will, 2026-08-11: "OKAY LETS USE EVERYTHING FROM THE SHOWDOWN SOURCE. SMOGON IS GONNA BE THE LAW
 * HERE", and then "SO HOW DO WE MAKE SURE WE HAVE ALL THE CHAMPIONS UPDATED STUFF FOR MOVES AND
 * ABILTIES AND SUCH".
 *
 * ================= WHY THIS EXISTS =================
 * `engine/mod_audit.js` answers "did Champions change this?" — 71 moves, 7 abilities, 1 item,
 * 3 conditions. It does NOT answer "did the change reach OUR files?", and nothing did.
 *
 * `data/move-effects.js` is GENERATED, and its header names its source: CHOMP/data/move-effects.json,
 * built by CHOMP/build/build_move_effects.js. That generator contains ZERO references to
 * `forFormat`, `mods/champions` or the Champions dex — it reads Showdown's MAINLINE moves.json.
 * Its own header claims the values come "straight from Showdown's moves.json - the same server data
 * that runs the format". THAT SENTENCE IS FALSE: moves.json is mainline; the format runs the mod.
 * The DRY argument in that header is right and it picked the wrong single source.
 *
 * ================= WHY IT DOES NOT COMPARE A LIST OF FIELDS =================
 * The first version of this check (written by hand, 2026-08-11) compared basePower, accuracy,
 * secondary, type, category and target. It found 24 wrong moves and MISSED: 42 PP differences,
 * 5 flag changes (Crush Claw / Dragon Claw / Shadow Claw / Dire Claw became slicing, Dragon Cheer
 * became sound) and Salt Cure's HALVED residual — because a rewritten function is invisible to any
 * constant sweep.
 *
 * `mod_audit.js`'s own header had already written that warning down:
 *     "it compares a HAND-CHOSEN LIST of move fields. A field nobody thought to list is invisible
 *      to it, and a rewritten FUNCTION is invisible to any constant sweep at all."
 * That sentence was read on the same night the same mistake was made.
 *
 * So this file CHOOSES NOTHING. It asks the two dexes which fields differ, and checks those.
 * A field nobody thought of cannot be missed, because nobody is doing the thinking.
 *
 * ================= WHAT A FAILURE MEANS =================
 * RED here does NOT mean the engine plays wrongly. `data/tags.json` is derived from the format and
 * the engine PREFERS it — `rng()*100 >= (_fmt != null ? _fmt : _generic)`. The rulebook is the
 * FALLBACK. So a drifted rulebook value is live only where no tag guards it. That surface is
 * printed below, because it is the number that actually matters and it is not the headline one. */

const path = require('path');
const ROOT = path.join(__dirname, '..');
const SD = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';

require(path.join(ROOT, 'data', 'move-effects.js'));
const OURS = global.MOVE_EFFECTS || {};

const { Dex } = require(SD + '/dist/sim');
const CH = Dex.forFormat('gen9championsvgc2026regmb');
const MAIN = Dex.forGen(9);
const legal = (x) => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* Fields our rulebook actually models, and how they are spelled there. Anything Champions changed
 * that is NOT in this map is reported as UNMODELLED — a hole we carry knowingly rather than a
 * silent pass. Listing what we MODEL is safe; listing what we COMPARE was not. */
const MODELLED = {
  basePower: 'bp', accuracy: 'accuracy', type: 'type', category: 'category',
  target: 'target', priority: 'priority', critRatio: 'critRatio',
};

const norm = (v) => JSON.stringify(v === undefined ? null : v);

function chances(sec) {
  if (!sec) return [];
  const a = Array.isArray(sec) ? sec : [sec];
  return a.map(s => (s && typeof s.chance === 'number') ? s.chance : null)
          .filter(c => c !== null).sort((x, y) => x - y);
}

const drift = [];      /* Champions changed it, we model it, and we have the WRONG value */
const unmodelled = {}; /* Champions changed it and our rulebook has no opinion at all */
let compared = 0, changedMoves = 0;

for (const c of CH.moves.all()) {
  if (!legal(c)) continue;
  const m = MAIN.moves.get(c.id);
  if (!m || !m.exists) continue;
  compared++;

  /* ASK THE DEXES which fields differ, rather than naming any. */
  const fields = new Set([...Object.keys(c), ...Object.keys(m)]);
  const changed = [];
  for (const f of fields) {
    if (f === 'desc' || f === 'shortDesc' || f === 'gen' || f === 'exists') continue;
    const a = c[f], b = m[f];
    if (typeof a === 'function' || typeof b === 'function') {
      if (String(a) !== String(b)) changed.push(f);
      continue;
    }
    if (norm(a) !== norm(b)) changed.push(f);
  }
  if (!changed.length) continue;
  changedMoves++;

  const ours = OURS[c.id];
  /* `secondary` and `secondaries` are two spellings of one fact and both appear in `changed`,
   * which reported Dire Claw twice on the first run. Collapse them to a single comparison. */
  let didSecondary = false;
  for (const f of changed) {
    if (f === 'secondary' || f === 'secondaries') {
      if (!ours || didSecondary) continue;
      didSecondary = true;
      const want = chances(c.secondaries || c.secondary);
      const got = chances(ours.secondary);
      if (JSON.stringify(want) !== JSON.stringify(got)) {
        drift.push({ name: c.name, field: 'secondary chance', ours: JSON.stringify(got), champions: JSON.stringify(want) });
      }
      continue;
    }
    const key = MODELLED[f];
    if (!key) { (unmodelled[f] = unmodelled[f] || []).push(c.name); continue; }
    if (!ours || ours[key] === undefined) { (unmodelled[f] = unmodelled[f] || []).push(c.name); continue; }
    const want = f === 'accuracy' ? c.accuracy : c[f];
    if (String(ours[key]) !== String(want)) {
      drift.push({ name: c.name, field: f, ours: String(ours[key]), champions: String(want) });
    }
  }
}

console.log('MOD CONFORMANCE — our rulebook against the Champions mod');
console.log('  ' + compared + ' legal moves compared; Champions changes ' + changedMoves + ' of them\n');

if (drift.length) {
  console.log('  FAIL  ' + drift.length + ' value(s) in data/move-effects.js are MAINLINE, not Champions:');
  for (const d of drift.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log('          ' + d.name.padEnd(18) + d.field.padEnd(18) + 'ours ' + d.ours + '  ->  champions ' + d.champions);
  }
} else {
  console.log('  ok    every modelled field carries the Champions value');
}

const uk = Object.keys(unmodelled).sort((a, b) => unmodelled[b].length - unmodelled[a].length);
if (uk.length) {
  console.log('\n  UNMODELLED — Champions changed these and our rulebook has no opinion.');
  console.log('  Not a failure by itself; it is the surface where a change CANNOT reach us:');
  for (const f of uk) {
    const names = unmodelled[f];
    console.log('        ' + String(names.length).padStart(3) + '  ' + f.padEnd(16) +
      names.slice(0, 6).join(', ') + (names.length > 6 ? ', …' : ''));
  }
}

console.log('\n  The engine prefers data/tags.json (format-derived) over this rulebook, so a drifted');
console.log('  value is LIVE only where no tag guards it. Read that exposure from million_run.js');
console.log('  --declaration-only, not from the count above.');

console.log('\nMOD CONFORMANCE: ' + (drift.length ? 'FAILED' : 'passed'));
process.exit(drift.length ? 1 : 0);
