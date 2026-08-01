/* derive_sets.js — the real set distribution per species, from the open-sheet games.
 *
 * WHY THIS EXISTS (Will, 2026-07-31: "when i played the tower last the moves on the mons were all
 * fucked up", and "no one uses thrash on chomp idk where u got that")
 * ----------------------------------------------------------------------------------------------
 * He was right on both counts. data/engine-data.js carries ONE set per species, and it is not from
 * this format. build/build_engine_data.js populates those fields as:
 *
 *     mv:   old.mv   || [],        <- the PREVIOUS copy of engine-data.js
 *     item: old.item || null,      <- ditto
 *     ab:   old.ab   || null,      <- ditto
 *     st:   old.st   || null,      <- ditto
 *
 * They are inherited, never derived, so whatever was there first propagates forever. Measured:
 *
 *   engine-data Garchomp   outrage / earthquake / thrash / protect
 *   4,742 real sheets      DragonClaw 93%, Earthquake 81%, Protect 80%, RockSlide 78%
 *                          — Outrage and Thrash are not in the top EIGHT, and the file is missing
 *                            the two most-used moves on the most-used species in the format.
 *   abilities              133 of 205 checkable species carry an ability that neither the base nor
 *                          the mega forme can have (e.g. Gengar "pressure", Venusaur "simple").
 *
 * That table is what the Battle Tower builds mons from, what medicham2 rolls out, and what DITTO
 * hands its referee. All three have been playing fictional Pokemon.
 *
 * WHY JOINT SETS AND NOT MOVE FREQUENCIES (Will's point, and it is the important one):
 *
 *   "think of the gunk shot and dire claw usage. very few sneasler actually have both so even if
 *    both are common, its usually one or the other"
 *
 * Exactly so, and it is why Smogon-style usage stats cannot fix this. They publish MARGINALS — each
 * move's own percentage — and the top four marginals are a set nobody runs. Measured here:
 *
 *   Garchomp   top-4 by marginal is the true set only 43.7% of the time; 114 distinct sets played
 *   Sneasler   41.8%;                                                     69 distinct sets played
 *
 * Open team sheets give the JOINT set — the four moves together with the real item, ability and
 * nature. Nothing else does. In a format where the sheet is public before turn one, guessing is a
 * choice, not a constraint.
 *
 * WHAT THIS WRITES. data/species-sets.json: for every species, its observed sets with counts, so a
 * consumer can take the most common one OR sample the distribution. Both matter — the Tower wants a
 * representative mon, DITTO's gauntlet wants opponents drawn the way the meta actually plays.
 *
 *   node engine/derive_sets.js            -> data/species-sets.json
 *   node engine/derive_sets.js --top 3    also print the top sets per species for eyeballing
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const Q = require('./quality.js');

const SHOW = (() => { const i = process.argv.indexOf('--top'); return i > 0 ? parseInt(process.argv[i + 1], 10) || 3 : 0; })();

/* OPEN-SHEET CORPORA ONLY. games.ladder.jsonl is 1.3% sheeted; including it would add noise from a
 * mostly closed-sheet store for no gain. Both files go through quality.js: the clean-data rule
 * applies here more than almost anywhere, because a bot's single repeated team would otherwise look
 * like a dominant set. */
const SOURCES = ['games.bo3.jsonl', 'games.ots.jsonl'];

const cfg = Q.config();
const bots = Q.behaviouralBots(Q.readStore());

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const per = new Map();          // species -> Map(setKey -> {n, set})
let sheets = 0, games = 0, skipped = 0;

for (const f of SOURCES) {
  const p = D('data', f);
  if (!fs.existsSync(p)) { console.error(`  ${f}: absent`); continue; }
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let g; try { g = JSON.parse(line); } catch (e) { continue; }
    if (!g.openSheet || !g.sheets) { skipped++; continue; }
    if (Q.reasons(g, cfg, bots).length) { skipped++; continue; }
    games++;
    for (const side of ['p1', 'p2']) {
      for (const e of (g.sheets[side] || [])) {
        if (!e || !e.species) continue;
        sheets++;
        const sp = norm(e.species);
        /* THE KEY IS THE WHOLE SET, which is the entire point: two Incineroars that differ only in
         * nature are different Pokemon for every purpose this project has. */
        const moves = (e.moves || []).map(m => norm(m)).filter(Boolean).sort();
        const key = [norm(e.item), norm(e.ability), norm(e.nature), moves.join(',')].join('|');
        if (!per.has(sp)) per.set(sp, new Map());
        const m = per.get(sp);
        const hit = m.get(key);
        if (hit) { hit.n++; continue; }
        m.set(key, {
          n: 1,
          item: e.item || null,
          ability: e.ability || null,
          nature: e.nature || null,
          moves: (e.moves || []).slice(),
          evs: e.evs || e.sp || null,
        });
      }
    }
  }
}

const out = { generated: new Date().toISOString().slice(0, 10), by: 'engine/derive_sets.js',
  what: 'observed JOINT sets per species from the open-sheet corpora, with counts',
  why: 'engine-data.js inherited one fictional set per species; Smogon-style marginals invent sets '
     + 'nobody runs (Garchomp top-4-by-marginal is the real set only 43.7% of the time). Open sheets '
     + 'give the joint set directly.',
  sources: SOURCES, games, sheet_entries: sheets, filter: 'engine/quality.js clean',
  species: {} };

const rows = [];
for (const [sp, m] of per) {
  const sets = [...m.values()].sort((a, b) => b.n - a.n);
  const n = sets.reduce((a, s) => a + s.n, 0);
  out.species[sp] = {
    n, distinct_sets: sets.length,
    top_share: +(sets[0].n / n).toFixed(3),
    sets: sets.map(s => ({ n: s.n, share: +(s.n / n).toFixed(4), item: s.item, ability: s.ability,
                           nature: s.nature, moves: s.moves, evs: s.evs })),
  };
  rows.push({ sp, n, d: sets.length, top: sets[0].n / n });
}

fs.writeFileSync(D('data', 'species-sets.json'), JSON.stringify(out, null, 1));

rows.sort((a, b) => b.n - a.n);
console.log('DERIVED SET DISTRIBUTIONS — the real thing, not a guess\n');
console.log(`  games read            ${games.toLocaleString()}  (${skipped.toLocaleString()} skipped: unsheeted or unclean)`);
console.log(`  sheet entries         ${sheets.toLocaleString()}`);
console.log(`  species with sets     ${rows.length}`);
for (const t of [100, 50, 20, 10]) console.log(`    with >= ${String(t).padStart(3)} sightings  ${rows.filter(r => r.n >= t).length}`);
const deep = rows.filter(r => r.n >= 10).reduce((a, r) => a + r.n, 0);
console.log(`  species with >=10 cover ${(100 * deep / Math.max(1, sheets)).toFixed(1)}% of all slots played`);

if (SHOW) {
  console.log('\n  top species, and how concentrated their sets are:');
  for (const r of rows.slice(0, 12)) {
    console.log(`\n    ${r.sp}   ${r.n} sheets, ${r.d} distinct sets`);
    for (const s of out.species[r.sp].sets.slice(0, SHOW)) {
      console.log(`      ${String(Math.round(100 * s.share)).padStart(3)}%  ${(s.moves || []).join(' / ')}`);
      console.log(`            @${s.item || '?'}  ${s.ability || '?'}  ${s.nature || '?'}`);
    }
  }
}
console.log('\n  -> data/species-sets.json');
