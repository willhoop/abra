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

/* THE TWO FILES DO NOT AGREE ON HOW TO SPELL A KEY, and this script used the source's spelling
 * directly. mega-dex-official.json keys `venusaurmega`; engine-data.js keys `venusaur-mega`. NONE of
 * the 67 forms this script writes matched — 0 exact, 48 matching only after normalising — so every
 * `MC.mons[key]` lookup below missed. The branch meant to UPDATE an existing entry could only ever
 * ADD a parallel one under the other spelling, and once a later regeneration rewrote the MC table
 * wholesale the real entries were left as the table had them: `ab: null`, `mv: []`, `item: null` on
 * all 57 megas.
 *
 * That is 21.1% of this format's usage carrying no ability at all — no Contrary on Staraptor-Mega
 * (the most-used mega here at 428,748), no Drought on Charizard-Mega-Y, no Swift Swim on
 * Swampert-Mega, no Huge Power on Mawile-Mega, no Electric Surge on Raichu-Mega-X.
 *
 * Found by engine/artifact_audit.js, which exists because Will asked how this was not caught
 * (2026-07-30). The answer: nothing in this project compared a derived artifact against the source
 * it was derived from, so a build step could be silently undone and every consumer kept reading the
 * null.
 *
 * Resolved by NORMALISING BOTH SIDES and preferring an entry that already exists, so this script can
 * never again create a second entry for a Pokemon the table already has. A form with no existing
 * entry falls back to the ARTIFACT's convention (display name, lowercased, runs of non-alphanumerics
 * collapsed to one hyphen) rather than to the source's. */
const nrm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byNorm = new Map(Object.keys(MC.mons).map(k => [nrm(k), k]));
const artifactKey = (srcKey, f) => byNorm.get(nrm(srcKey)) ||
  (f.name || srcKey).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let added = 0, updated = 0, skipped = 0;
for (const [srcKey, f] of Object.entries(mega.forms)) {
  const key = artifactKey(srcKey, f);
  /* "Only carry what actually shows up" — but an entry the table ALREADY HAS shows up by definition,
   * whatever this source's stale `in_our_store` flag says. Eight formes were being skipped while
   * sitting in engine-data.js with a null ability, Heracross-Mega among them at 7,072 usage. The
   * guard is meant to stop the dex growing, not to stop an existing entry being completed. */
  if (!f.in_our_store && !MC.mons[key]) { skipped++; continue; }
  /* ONLY touch mega/primal formes — the original rule, and it is RIGHT about updates: the existing
   * non-mega entries were built elsewhere and are what the damage validation runs against, so
   * rewriting their stats with this file's approximate spread would be an unrequested behaviour
   * change. That caution is preserved exactly below: a non-mega forme may be ADDED, never UPDATED.
   *
   * WHY ADDING THEM IS NOT OPTIONAL, measured 2026-08-02. A forme with no row at all makes dmgMon
   * return null, and then EVERY damage-derived feature reads zero for that Pokemon — no kill odds,
   * no threat, no risk. Over 60 self-play games that was 3.62% of all candidate scorings, and the
   * offenders are Gourgeist-Super (25), Aegislash-Blade and Palafin-Hero. These are not obscure:
   * Aegislash-Blade is Aegislash's ATTACKING forme, 140 Atk against Shield's 50, so the bot was
   * blind to it in exactly the state that matters.
   *
   * The cosmetic-forme fallback in engine/mc_key.js deliberately refuses to substitute the base when
   * the stats differ — correctly, since Shield's body is not Blade's — so the fallback cannot fix
   * this and a real row is the only answer.
   *
   * THE PREDICATE IS NARROW ON PURPOSE: in our store, no existing entry, and a body that actually
   * differs from the base. A forme whose stats and types match its base needs no row, because the
   * fallback already handles it exactly. */
  const isMega = /mega|primal/i.test(f.forme || '');
  const baseKey = byNorm.get(nrm(f.base_species || ''));
  const baseRow = baseKey && MC.mons[baseKey];
  const bodyDiffers = !!(baseRow && f.base_stats &&
    JSON.stringify(baseRow.bs) !== JSON.stringify(f.base_stats));
  const addableForme = !isMega && !MC.mons[key] && f.in_our_store && bodyDiffers;
  if (!isMega && !addableForme) { skipped++; continue; }
  const entry = {
    t: f.types,
    /* BASE STATS, and their absence was a real bug shipped on 2026-07-30. This object wrote `st`
     * (the level-50 line) and not `bs`. The 48 formes that already existed kept their `bs` through
     * the Object.assign below, but the 19 this script ADDED had none at all -- and
     * medicham2-browser.js's buildMon opens with `if(!m||!m.bs) return null`, so those 19 could not
     * be built by the damage engine AT ALL. The same shape as the hole this script exists to close,
     * reintroduced by the fix for it, and caught only when CHOMP's dex refresh counted 289 where
     * ABRA reported 308.
     *
     * It is also why engine/artifact_audit.js now checks `bs`: the cohort check covered ab, mv,
     * item, t, st and wt, so the one field the repair forgot was the one field nothing looked at. */
    bs: f.base_stats,
    st: f.lvl50,
    /* MOVES COME FROM THE BASE SPECIES when the mega has none of its own, because mega evolution
     * changes stats, typing and ability — it does NOT change the moveset. Every mega was built with
     * `mv: []` and the consequence was not cosmetic: buildMon returns a Pokemon with no moves, so
     * incomingThreat's inner loop finds no attack, scores `best = 0`, and reports the mega as
     * threatening NOTHING. switchSurvives1/2 read "survives" against all 75 of them and
     * switchDiesFirst could never fire — on 26.0% of this format's usage, in the same switch logic
     * this session had just finished fixing.
     *
     * Resolved through the SAME normalising lookup as the key itself, so a base species spelled
     * differently in the two files still resolves. */
    mv: (MC.mons[key] && MC.mons[key].mv || []).length ? MC.mons[key].mv
      : ((MC.mons[byNorm.get(nrm(f.base_species))] || {}).mv || []),
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
