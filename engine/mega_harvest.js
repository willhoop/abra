/* mega_harvest.js - build the Champions mega table FROM REPLAY LOGS.
 *
 * Why this cannot be written by hand:
 * Pokemon Champions invents megas that do not exist in mainline (Glimmora-Mega, Raichu-Mega-X/Y,
 * Staraptor-Mega...). There is no canonical reference to copy, and guessing would be inventing
 * data. So we read what the game itself says.
 *
 * What a log gives us, verbatim:
 *     |detailschange|p1b: Glimmora|Glimmora-Mega, L50, M     <- the exact form
 *     |-mega|p1b: Glimmora|Glimmora|Glimmoranite             <- base + the stone used
 *     |-ability|p1a: Archaludon|Stamina|boost                <- an ability announcing itself
 *     |-weather|RainDance|[from] ability: Drizzle|[of] p1b: Pelipper
 *     |-fieldstart|move: Electric Terrain|[from] ability: Electric Surge|[of] p1a: Raichu-Mega-X
 *
 * Every mega form has exactly ONE ability, so once a form is observed with an ability even once,
 * that mapping is settled. We still count observations and report them, so a wrong or ambiguous
 * mapping is visible rather than assumed.
 *
 *   node engine/mega_harvest.js [pages]
 * Writes data/mega-dex.json.
 */
'use strict';
const fs = require('fs'), path = require('path');
const D = p => path.join(__dirname, '..', 'data', p);
const PAGES = +(process.argv[2] || 12);
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const forms = {};          // formKey -> {form, base, stone, abilities:{}, seen, types:null}
function touch(k, form) {
  return forms[k] || (forms[k] = { form, base: null, stone: null, abilities: {}, seen: 0 });
}

async function getJSON(u) { const r = await fetch(u); return r.ok ? r.json() : null; }
async function getText(u) { const r = await fetch(u); return r.ok ? r.text() : null; }

async function main() {
  const ids = new Set();
  for (let p = 1; p <= PAGES; p++) {
    const list = await getJSON(`https://replay.pokemonshowdown.com/search.json?format=gen9championsvgc2026regmb&page=${p}`);
    if (!list || !list.length) break;
    list.forEach(r => ids.add(r.id));
  }
  console.log(`mega_harvest - scanning ${ids.size} replays for mega evolutions...`);

  let done = 0, withMega = 0;
  const idList = [...ids];
  const CONC = 20;
  let i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < idList.length) {
      const id = idList[i++];
      const log = await getText(`https://replay.pokemonshowdown.com/${id}.log`);
      done++;
      if (!log) continue;
      const slotForm = {};          // 'p1a' -> current form key
      let any = false;
      for (const l of log.split('\n')) {
        let m;
        if ((m = l.match(/^\|detailschange\|(p[12][ab]): ([^|]*)\|([^,|]+)/))) {
          const k = norm(m[3]);
          const f = touch(k, m[3].trim());
          f.seen++; slotForm[m[1]] = k; any = true;
        } else if ((m = l.match(/^\|-mega\|(p[12][ab]): ([^|]*)\|([^|]+)\|([^|]+)/))) {
          const k = slotForm[m[1]];
          if (k) { forms[k].base = forms[k].base || norm(m[3]); forms[k].stone = forms[k].stone || m[4].trim(); }
        } else if ((m = l.match(/^\|-ability\|(p[12][ab]): ([^|]*)\|([^|]+)/))) {
          const k = slotForm[m[1]];
          if (k) { const a = m[3].trim(); forms[k].abilities[a] = (forms[k].abilities[a] || 0) + 1; }
        } else if ((m = l.match(/^\|-weather\|[^|]+\|\[from\] ability: ([^|]+)\|\[of\] (p[12][ab])/))) {
          const k = slotForm[m[2]];
          if (k) { const a = m[1].trim(); forms[k].abilities[a] = (forms[k].abilities[a] || 0) + 1; }
        } else if ((m = l.match(/^\|-fieldstart\|move: [^|]+\|\[from\] ability: ([^|]+)\|\[of\] (p[12][ab])/))) {
          const k = slotForm[m[2]];
          if (k) { const a = m[1].trim(); forms[k].abilities[a] = (forms[k].abilities[a] || 0) + 1; }
        } else if ((m = l.match(/^\|(?:switch|drag|replace)\|(p[12][ab]): ([^|]*)\|([^,|]+)/))) {
          const k = norm(m[3]);
          if (/mega/.test(k)) { touch(k, m[3].trim()); slotForm[m[1]] = k; }
          else delete slotForm[m[1]];       // reverted to a non-mega
        }
      }
      if (any) withMega++;
      if (done % 200 === 0) console.log(`   ${done}/${idList.length} replays, ${Object.keys(forms).length} forms so far`);
    }
  }));

  const out = {};
  for (const [k, f] of Object.entries(forms)) {
    const ranked = Object.entries(f.abilities).sort((a, b) => b[1] - a[1]);
    out[k] = {
      form: f.form, base: f.base, stone: f.stone, megas_seen: f.seen,
      ability: ranked.length ? ranked[0][0] : null,
      ability_obs: ranked.length ? ranked[0][1] : 0,
      // if more than one ability was ever seen on this form something is wrong - surface it
      other_abilities_seen: ranked.slice(1).map(([a, c]) => ({ ability: a, n: c })),
    };
  }
  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    replays_scanned: done, replays_with_a_mega: withMega,
    note: ('Harvested from replay logs, not from a canonical dex - Champions invents megas that do '
         + 'not exist in mainline. Each mega form has exactly one ability, so a single clean '
         + 'observation settles it; observation counts are kept so a gap or a conflict is visible. '
         + 'A null ability means the form was seen but never announced its ability in these logs.'),
    forms: out,
  };
  fs.writeFileSync(D('mega-dex.json'), JSON.stringify(payload, null, 1));

  const rows = Object.entries(out).sort((a, b) => b[1].megas_seen - a[1].megas_seen);
  console.log(`\nfound ${rows.length} mega forms across ${done} replays (${withMega} had a mega)`);
  for (const [k, v] of rows.slice(0, 30)) {
    console.log(`   ${k.padEnd(20)} ${(v.ability || '(unknown)').padEnd(18)} obs=${String(v.ability_obs).padEnd(4)} megas=${String(v.megas_seen).padEnd(4)} stone=${v.stone || '?'}`
      + (v.other_abilities_seen.length ? `  CONFLICT: ${JSON.stringify(v.other_abilities_seen)}` : ''));
  }
  const unknown = rows.filter(([, v]) => !v.ability).length;
  console.log(`\n   forms with an ability resolved: ${rows.length - unknown}/${rows.length}`);
}
main();
