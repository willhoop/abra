/* build_mega_dex.js - build the mega/forme dex from Showdown's OWN data file.
 *
 * Source of truth: https://play.pokemonshowdown.com/data/pokedex.json
 * That is the data the Showdown server itself uses to run this format, so it is authoritative for
 * types, abilities, base stats and the required stone. Champions invents megas that do not exist in
 * mainline (Raichu-Mega-X/Y, Glimmora-Mega, Meganium-Mega...), so a canonical Pokedex or memory is
 * NOT a valid source - this file is.
 *
 * Cross-check: engine/mega_harvest.js independently reads abilities out of real replay logs. Where
 * both have an opinion they must agree; disagreements are printed loudly rather than silently
 * resolved. (Log harvesting can never resolve silent abilities like No Guard, which is exactly why
 * the official file matters - Raichu-Mega-Y is No Guard, and that is why Zap Cannon is on ~590
 * Raichu sets.)
 *
 * Level-50 stat convention: the existing entries in data/engine-data.js are stored as computed
 * level-50 stats using a standard competitive spread (252 EVs in the main attacking stat and in
 * Speed, boosting nature on the attacker, 31 IVs). Verified against the stored Venusaur entry.
 * The same convention is applied here so mega entries are directly comparable - it is an
 * APPROXIMATION of a real set, recorded in the output so nobody mistakes it for exact.
 *
 *   node engine/build_mega_dex.js
 * Writes data/mega-dex-official.json
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const L = 50, IV = 31;
const stat = (b, ev, nat) => Math.floor((Math.floor((2 * b + IV + Math.floor(ev / 4)) * L / 100) + 5) * nat);
const hpStat = b => Math.floor((2 * b + IV) * L / 100) + L + 10;

function levelFifty(bs) {
  // 252 into the better attacking stat and into Speed, boosting nature on that attacker.
  const physical = bs.atk >= bs.spa;
  return {
    hp: hpStat(bs.hp),
    at: stat(bs.atk, physical ? 252 : 0, physical ? 1.1 : 1.0),
    df: stat(bs.def, 0, 1.0),
    sa: stat(bs.spa, physical ? 0 : 252, physical ? 1.0 : 1.1),
    sd: stat(bs.spd, 0, 1.0),
    sp: stat(bs.spe, 252, 1.0),
  };
}

async function main() {
  const dex = await (await fetch('https://play.pokemonshowdown.com/data/pokedex.json')).json();

  // which formes actually turn up in our store - we only need those, plus every mega
  const seen = new Set();
  try {
    for (const line of fs.readFileSync(D('games.ladder.jsonl'), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let g; try { g = JSON.parse(line); } catch { continue; }
      for (const s of ['p1', 'p2']) (g.six?.[s] || []).forEach(m => seen.add(m));
      Object.keys(g.sets || {}).forEach(m => seen.add(m));
    }
  } catch { /* store optional */ }

  const out = {};
  for (const [key, e] of Object.entries(dex)) {
    const isMega = e.forme && /mega|primal/i.test(e.forme);
    if (!isMega && !seen.has(key)) continue;
    if (!e.baseStats) continue;
    out[key] = {
      name: e.name || key,
      base_species: e.baseSpecies || e.name || key,
      forme: e.forme || null,
      types: e.types || [],
      ability: (e.abilities && e.abilities['0']) || null,
      all_abilities: e.abilities || {},
      required_item: e.requiredItem || null,
      base_stats: e.baseStats,
      lvl50: levelFifty(e.baseStats),
      in_our_store: seen.has(key),
    };
  }

  // cross-check against what the replay logs said
  let agree = 0, conflict = [];
  try {
    const h = JSON.parse(fs.readFileSync(D('mega-dex.json'), 'utf8'));
    for (const [k, v] of Object.entries(h.forms || {})) {
      if (!v.ability || !out[k] || !out[k].ability) continue;
      if (norm(v.ability) === norm(out[k].ability)) agree++;
      else conflict.push({ form: k, from_logs: v.ability, from_showdown: out[k].ability, obs: v.ability_obs });
    }
  } catch { /* harvest optional */ }

  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'https://play.pokemonshowdown.com/data/pokedex.json (the data the Showdown server runs this format on)',
    stat_convention: ('lvl50 = level 50, 31 IVs, 252 EVs in the better attacking stat and in Speed, '
      + 'boosting nature on that attacker. This APPROXIMATES a real set - it is not the opponent\'s '
      + 'actual spread, which closed sheets never reveal.'),
    cross_check: { agreed_with_replay_logs: agree, conflicts: conflict },
    n_forms: Object.keys(out).length,
    forms: out,
  };
  fs.writeFileSync(D('mega-dex-official.json'), JSON.stringify(payload, null, 1));

  const megas = Object.entries(out).filter(([, v]) => /mega|primal/i.test(v.forme || ''));
  const inStore = megas.filter(([, v]) => v.in_our_store);
  console.log(`build_mega_dex - ${Object.keys(out).length} formes written, ${megas.length} are megas`);
  console.log(`  megas that appear in our store: ${inStore.length}`);
  console.log(`  ability cross-check vs replay logs: ${agree} agree, ${conflict.length} conflict`);
  conflict.forEach(c => console.log(`     CONFLICT ${c.form}: logs=${c.from_logs} showdown=${c.from_showdown} (obs ${c.obs})`));
  console.log('  sample:');
  for (const [k, v] of inStore.slice(0, 8)) {
    console.log(`     ${k.padEnd(18)} ${String(v.types.join('/')).padEnd(14)} ${String(v.ability).padEnd(16)} `
      + `spe ${String(v.lvl50.sp).padEnd(4)} stone ${v.required_item || '-'}`);
  }
}
main();
