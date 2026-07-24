/* build_species_abilities.js - what ability can each species actually have?
 *
 * The problem this solves: role tagging reads abilities out of replay logs, but a log only names an
 * ability when it ANNOUNCES itself. Drizzle and Intimidate announce; Swift Swim, No Guard and
 * Adaptability never say a word. So ability-based roles were systematically under-observed - which
 * is why the "rain abuser with no rain setter" check returned nothing at all, despite Swift Swim
 * being common. It was not that no team had the defect; it was that we could not see Swift Swim.
 *
 * The fix: take the ability list from Showdown's own pokedex.json (the data the server runs the
 * format on). Two confidence levels, kept separate and never blurred:
 *   CERTAIN  - the species has exactly one possible ability, so seeing the species IS seeing the
 *              ability. No observation needed, no guessing.
 *   POSSIBLE - the species has several; the log still has to tell us which one this set runs.
 *
 * That distinction matters for closed sheets: a certain ability is public information the moment the
 * team is previewed, a possible one is a belief.
 *
 *   node engine/build_species_abilities.js
 * Writes data/species-abilities.json
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);

async function main() {
  const dex = await (await fetch('https://play.pokemonshowdown.com/data/pokedex.json')).json();

  // restrict to what this format actually uses
  const seen = new Set();
  for (const line of fs.readFileSync(D('games.ladder.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let g; try { g = JSON.parse(line); } catch { continue; }
    for (const s of ['p1', 'p2']) (g.six?.[s] || []).forEach(m => seen.add(m));
    Object.keys(g.sets || {}).forEach(m => seen.add(m));
  }

  const out = {};
  let certain = 0, multi = 0, missing = 0;
  for (const sp of seen) {
    const e = dex[sp];
    if (!e || !e.abilities) { missing++; continue; }
    const list = [...new Set(Object.values(e.abilities))];
    out[sp] = { abilities: list, certain: list.length === 1 ? list[0] : null };
    if (list.length === 1) certain++; else multi++;
  }

  fs.writeFileSync(D('species-abilities.json'), JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    source: 'https://play.pokemonshowdown.com/data/pokedex.json',
    note: ('"certain" = the species has exactly ONE possible ability, so it is known from team '
      + 'preview alone with no observation. Otherwise the log must reveal which one is running. '
      + 'Silent abilities (Swift Swim, No Guard, Adaptability) never announce themselves, so without '
      + 'this file they were invisible to role tagging.'),
    n_species: Object.keys(out).length, n_certain: certain, n_multi_ability: multi,
    n_not_in_dex: missing,
    species: out,
  }, null, 1));

  console.log(`build_species_abilities - ${Object.keys(out).length} species in our store`);
  console.log(`  ability known for certain from preview: ${certain}`);
  console.log(`  needs the log to disambiguate:          ${multi}`);
  console.log(`  not found in the dex:                   ${missing}`);
  for (const k of ['basculegion', 'pelipper', 'torkoal', 'raichumegay', 'charizardmegay']) {
    if (out[k]) console.log(`     ${k.padEnd(16)} ${out[k].certain ? 'CERTAIN ' + out[k].certain : 'one of ' + JSON.stringify(out[k].abilities)}`);
  }
}
main();
