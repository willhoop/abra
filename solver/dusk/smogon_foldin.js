/* solver/dusk/smogon_foldin.js — the Smogon hook for DUSK: how much of the endgame's hidden spread mass Smogon's monthly
 * Reg M-C moveset file pins down, for the species that actually reach endgames.
 *
 *   ABRA_REGULATION=regmc node engine/fetch_smogon_stats.js 2026-09      # first: archive the month (OPS-style fetch)
 *   node solver/dusk/smogon_foldin.js [--summary solver/dusk/endgames-summary.json] [--file <moveset txt>]
 *
 * WHY. At an endgame the sets are open but each opposing body's Stat Points are not, and ROTOM's belief still carried a
 * median of thousands of spread worlds at E2 entry (solver/dusk/DESIGN.md §1.4). DUSK solves per CLASS of worlds (the
 * speed order and the KO thresholds the spreads decide), so the useful question about a spread prior is how concentrated
 * it is for the endgame species: if the top few spreads hold most of the mass, a handful of world classes carry the value.
 *
 * WHAT IT READS. The endgame species ranking (the bo3 E2 "endgames containing" list) from the tracked summary, and the
 * newest Reg M-C moveset file through solver/rotom/spreads.js (`findObserved` / `parseMoveset`, the hook ROTOM already
 * uses; nothing is re-parsed here). With no file it prints NOT PUBLISHED and the fetch command and exits 0: a month that
 * is not out yet is not a failure.
 *
 * WRITES solver/out/dusk/smogon-foldin.json: per species, listed or not, spreads listed, the top spread's share, the top-5
 * share, and the distinct Speed investments among the top 5 (each is a candidate speed-order class).
 */
'use strict';
const fs = require('fs'), path = require('path');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
if (!process.env.SHOWDOWN_PATH) { const sib = path.join(MAIN, '..', 'pokemon-showdown-mc'); if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib; }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPO = path.join(__dirname, '..', '..');
const SP = require('../rotom/spreads.js');
const X = require('../human/dex.js');

const summary = JSON.parse(fs.readFileSync(path.resolve(REPO, arg('--summary', 'solver/dusk/endgames-summary.json')), 'utf8'));
const ranking = summary.meta.bo3.state.E2.species_top15_endgames_containing;
const file = arg('--file', null) || SP.findObserved(path.join(MAIN, 'data', 'smogon-stats')) || SP.findObserved();
if (!file) {
  console.log('NOT PUBLISHED: no Reg M-C moveset file for ' + X.FORMAT + ' under data/smogon-stats/. Fetch it with:\n  ABRA_REGULATION=regmc node engine/fetch_smogon_stats.js 2026-09');
  process.exit(0);
}
const obs = SP.loadObserved(file);
const rows = ranking.map(([species, n, share]) => {
  const id = X.D.species.get(species).id;
  const base = X.D.species.get(species).baseSpecies ? X.toID(X.D.species.get(species).baseSpecies) : id;
  const list = obs.bySpecies[id] || obs.bySpecies[base] || null;
  if (!list) return { species, endgames_containing: n, share, listed: false };
  const top = list.slice().sort((a, b) => b.pct - a.pct);
  const top5 = top.slice(0, 5);
  return { species, endgames_containing: n, share, listed: true, spreads_listed: top.length, top1_pct: top[0] ? top[0].pct : null,
    top5_pct: +top5.reduce((a, s) => a + s.pct, 0).toFixed(2), top5_distinct_speed_investments: [...new Set(top5.map(s => s.evs.spe))].length };
});
const out = { what: 'DUSK Smogon fold-in: spread concentration for the endgame species', generated: new Date().toISOString(), file: obs.file, sha256: obs.sha256, rows };
const of = path.join(REPO, 'solver', 'out', 'dusk', 'smogon-foldin.json');
fs.mkdirSync(path.dirname(of), { recursive: true });
fs.writeFileSync(of, JSON.stringify(out, null, 1));
console.log('wrote ' + of + ' from ' + obs.file + ': ' + rows.filter(r => r.listed).length + ' of ' + rows.length + ' endgame species listed');
