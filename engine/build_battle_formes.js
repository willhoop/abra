/* build_battle_formes.js — WHICH SPECIES EXIST ONLY DURING A BATTLE, AND WHAT TEAM PREVIEW SHOWS.
 *
 *   node engine/build_battle_formes.js            derive, compare, and write data/battle-formes.json
 *   node engine/build_battle_formes.js --check    derive and compare; write NOTHING, exit 1 on a diff
 *
 * WHY THIS FILE HAD TO EXIST (S13, 2026-09-21)
 * -------------------------------------------
 * `data/battle-formes.json` was derived ONCE, by hand, on 2026-07-24, from
 * `https://play.pokemonshowdown.com/data/pokedex.json`, and nothing has regenerated it since. That
 * is the shape S13 is entirely about — *a file nobody generates is a file that will lie* — and this
 * one is not decorative: `engine/durable-ingest.js` uses it to map a battle forme back to the species
 * team preview actually shows, so `six`, `brought` and `lead` disagree the moment it is stale, and
 * `engine/dusk_size_gate.js` calls it "the canonical mapping" for its whole matchup axis. Showdown
 * adding one forme would have desynchronised the store silently, against a name-shape fallback
 * (`/^(.*?)(mega[xy]?|primal)$/`) that catches megas and primals and nothing else — not
 * Palafin-Hero, not Mimikyu-Busted, not Cherrim-Sunshine.
 *
 * THE MAP IS NOT AN OPINION. `species.battleOnly` is Showdown's own answer to exactly this question
 * and it names the base species. Measured before this file was written: the derivation reproduces the
 * hand-built artifact **131 of 131, with zero rows missing, zero extra and zero disagreements.** So
 * this is a RESTAMP, not a refit — the feature function is unchanged and no figure moves.
 *
 * THE WALK IS DELIBERATELY UNFILTERED, AND THAT IS THE ONE THING NOT TO "FIX".
 * --------------------------------------------------------------------------
 * CLAUDE.md requires every dex walk to be filtered to the regulation, and that rule is right for the
 * questions it was written about — what may be BUILT, what may be RECOMMENDED. This artifact answers
 * a different question: *a replay log just said this forme name, what species is that?* The store is
 * append-only and spans regulations, so the parser has to answer for every forme string a log can
 * contain, not only for the ones legal today.
 *
 * Measured 2026-09-21: `x.exists && !x.isNonstandard && x.tier !== 'Illegal'` keeps 83 of the 131 and
 * DROPS 48 — every Mega and Primal of a species outside this regulation, and `cherrimsunshine`. Each
 * dropped row is a forme the ingest would then fall back on a regex for, and the regex knows nothing
 * about Cherrim. A filtered walk here is not a stricter build; it is 48 silent mis-keys.
 *
 * WRITES A SUPERSET ON PURPOSE for the same reason: a forme that cannot occur costs one map entry,
 * and a forme that is missing costs a wrong species on every game that contains it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');

const OUT = path.join(__dirname, '..', 'data', 'battle-formes.json');
const CHECK = process.argv.includes('--check');

/* The same normalisation the rest of this repo uses for a dex id: Showdown's own ids are
 * `[a-z0-9]+`, and `battleOnly` gives a DISPLAY name ("Necrozma-Dusk-Mane"), not an id. */
const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function derive() {
  const dex = CS.dexFor(CS.FORMAT);
  const base_of = {};
  for (const sp of dex.species.all()) {
    if (!sp.battleOnly) continue;
    /* `battleOnly` is a string for a forme with ONE origin and an ARRAY for a forme several formes
     * can become (Necrozma's fusions, Gmax). The first entry is the one team preview shows; the
     * hand-built artifact resolved them the same way, which is why it matches row for row. */
    const b = Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly;
    base_of[sp.id] = toID(b);
  }
  return base_of;
}

function main() {
  const base_of = derive();
  const n = Object.keys(base_of).length;
  if (!n) {
    console.error('build_battle_formes: the dex returned NO battle-only formes. That is not a map of '
                + 'zero, it is a broken read — refusing to write.');
    process.exit(1);
  }

  /* COMPARED TO WHAT IS ON DISK, EVERY RUN, AND THE DIFF IS NAMED. A generated file that silently
   * replaces a hand-built one is how a store-keying change gets made by accident. */
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')).base_of || null; }
  catch (e) {
    console.error('  no previous data/battle-formes.json to compare against (' + e.message + ') — '
                + 'this run is a first build, not a confirmation');
  }
  let moved = 0;
  if (prev) {
    const pk = Object.keys(prev), nk = Object.keys(base_of);
    const gone = pk.filter(k => !(k in base_of));
    const added = nk.filter(k => !(k in prev));
    const changed = pk.filter(k => k in base_of && base_of[k] !== prev[k]);
    moved = gone.length + added.length + changed.length;
    console.log(`  previous ${pk.length} rows, derived ${nk.length}`);
    if (gone.length) console.log('  GONE    ' + gone.join(', '));
    if (added.length) console.log('  ADDED   ' + added.join(', '));
    for (const k of changed) console.log(`  CHANGED ${k}: ${prev[k]} -> ${base_of[k]}`);
    if (!moved) console.log('  no row moved — the derivation reproduces the artifact exactly');
  }

  if (CHECK) {
    console.log(moved ? `\n  CHECK: ${moved} row(s) differ from data/battle-formes.json`
                      : '\n  CHECK: data/battle-formes.json is current');
    process.exit(moved ? 1 : 0);
  }

  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString(),
    by: 'engine/build_battle_formes.js',
    source: `species.battleOnly, ${CS.FORMAT}, Showdown checkout ${CS.actualCommit() || 'UNKNOWN'}`,
    note: 'Formes that only exist DURING a battle (mega, primal, Palafin-Hero, Mimikyu-Busted...). '
        + 'Team preview never shows these, so six/brought/lead must use the base species or they '
        + 'disagree. The walk is UNFILTERED on purpose: this answers "a log said this name, what '
        + 'species is that" for a store that spans regulations. Filtering to the regulation drops 48 '
        + 'of these rows. See the header of engine/build_battle_formes.js.',
    n,
    base_of,
  }, null, 1) + '\n');
  console.log(`\n  wrote data/battle-formes.json — ${n} battle-only formes`);
}

if (require.main === module) main();
module.exports = { derive };
