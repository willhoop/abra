/* merge_mega_into_engine.js - put the mega formes into data/engine-data.js so the damage engine
 * stops treating a mega as its base form.
 *
 * The gap this closes: Charizard-Mega-Y appears in ~906 sets in our store and the engine dex had
 * ONE mega forme in it. Every damage calculation involving a mega used the base species' stats,
 * typing and ability - silently wrong, on some of the most common Pokemon in the format.
 *
 * Source of the mega data: data/mega-dex-official.json, built from Showdown's own pokedex.json.
 *
 * On abilities, stated plainly: replay logs CANNOT tell us a mega's ability. Mega evolution emits
 * only `|detailschange|` and `|-mega|`; no ability line follows. An earlier harvest appeared to find
 * conflicts (garchompmega "Speed Boost", dragonitemega "Intimidate") but those were attribution
 * noise on 1-6 observations, plus three real cases of Trace copying an opponent's ability. So the
 * official dex is used for abilities, and the harvest is kept only as a discovery tool for which
 * formes exist in this format.
 *
 * Level-50 stats use the same convention as the existing entries (see build_mega_dex.js) - an
 * approximation of a competitive spread, not the opponent's real EVs, which closed sheets hide.
 *
 *   node engine/merge_mega_into_engine.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);

const src = fs.readFileSync(D('engine-data.js'), 'utf8');
const m = src.match(/const MC = (\{[\s\S]*?\});/);
if (!m) { console.error('could not find the MC object in engine-data.js'); process.exit(1); }
const MC = JSON.parse(m[1]);
const mega = JSON.parse(fs.readFileSync(D('mega-dex-official.json'), 'utf8'));

const before = Object.keys(MC.mons).length;
let added = 0, updated = 0, skipped = 0;
for (const [key, f] of Object.entries(mega.forms)) {
  if (!f.in_our_store) { skipped++; continue; }        // only carry what actually shows up
  const entry = {
    t: f.types,
    st: f.lvl50,
    mv: (MC.mons[key] && MC.mons[key].mv) || [],
    item: f.required_item || (MC.mons[key] && MC.mons[key].item) || null,
    ab: f.ability,
    base: f.base_species ? f.base_species.toLowerCase().replace(/[^a-z0-9]/g, '') : null,
    mega: /mega|primal/i.test(f.forme || '') || undefined,
  };
  if (MC.mons[key]) { MC.mons[key] = Object.assign({}, MC.mons[key], entry); updated++; }
  else { MC.mons[key] = entry; added++; }
}

const out = src.replace(/const MC = \{[\s\S]*?\};/, 'const MC = ' + JSON.stringify(MC) + ';');
fs.writeFileSync(D('engine-data.js'), out);

const megasNow = Object.keys(MC.mons).filter(k => MC.mons[k].mega).length;
console.log(`merge_mega_into_engine - dex ${before} -> ${Object.keys(MC.mons).length} species`);
console.log(`  added ${added}, updated ${updated}, skipped ${skipped} (not in our store)`);
console.log(`  mega formes now in the engine dex: ${megasNow}`);
for (const k of ['charizardmegay', 'raichumegax', 'raichumegay', 'glimmoramega']) {
  const e = MC.mons[k];
  if (e) console.log(`     ${k.padEnd(16)} ${String(e.t.join('/')).padEnd(14)} ${String(e.ab).padEnd(16)} spe ${e.st.sp}`);
}
