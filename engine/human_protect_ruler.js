/* human_protect_ruler.js — HOW OFTEN DO REAL PLAYERS CLICK A PROTECT-FAMILY MOVE, ON THE FROZEN POOL?
 *
 * THE RULER, NOT A MODEL. Store-derived, no simulator anywhere in the path: it reads the frozen
 * open-sheet store and `data/tags.json`, counts move clicks, and writes the share. Nothing here is
 * fitted and nothing here is downstream of MEDICHAM, so the figure it publishes is quotable while the
 * quarantine is closed.
 *
 * WHY IT EXISTS (2026-09-19). The published "humans did 14.757%" (CHANGELOG 5.258.0; the white paper,
 * the technical docs, MODELS and the MEASURE ledger) was measured on 2026-09-05 by a scoring script
 * that was not kept, so no artifact in data/ carried it. `engine/docs_scan.js` then attributed it to
 * the ONE artifact whose digits matched — MAG's `weights[55]`, 0.14757 — and charged four documents
 * with republishing a withheld MAG figure. The figure never came from MAG. It came from the store,
 * and this file is that measurement kept, so the documents can cite what they actually read.
 *
 * THE PREDICATE IS THE ONE THE PUBLISHED FIGURE USED, NOT THE QUALITY FILTER. The 2026-09-05 ruler
 * (docs/_reports/2026-09-05-protect-amplification.md §1) dropped bots and forfeits and nothing else:
 * 13,214 games in file -> 8,388 kept -> 190,954 clicks -> 28,179 protect-family. This file reproduces
 * those four counts to the digit or it refuses to write (`--check` exits 1). Swapping in
 * `engine/quality.js` would publish a DIFFERENT number under the old one's name, which is the defect
 * this repository keeps paying for.
 *
 * THE FAMILY IS DERIVED, NEVER TYPED: every move `data/tags.json` tags `shieldsUser`.
 *
 * A CLICK is a `t: 'm'` event in a stored turn — a move that reached the board. Mega evolution,
 * switches and faints are not clicks.
 *
 *   node engine/human_protect_ruler.js            print, and write data/human-protect-ruler.json
 *   node engine/human_protect_ruler.js --check    print and compare to the published counts; no write
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const STORE = 'data/team-pool-frozen/games.bo3.jsonl';
const TAGS_FILE = 'data/tags.json';
const OUT = 'data/human-protect-ruler.json';
/* THE PUBLISHED COUNTS THIS RULER MUST REPRODUCE — docs/_reports/2026-09-05-red-endpoints-and-protect-
 * prior.md, "The human ruler reproduces exactly". A pin, not a tuning target: a mismatch means the
 * store or the family moved, and the old figure is no longer this ruler's to publish. */
const PUBLISHED = { games_in_file: 13214, games_kept: 8388, clicks: 190954, family_clicks: 28179 };

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function measure() {
  const tags = JSON.parse(fs.readFileSync(D(TAGS_FILE), 'utf8'));
  const family = Object.entries(tags.moves || {})
    .filter(([, v]) => (v.tags || []).includes('shieldsUser')).map(([k]) => k).sort();
  if (!family.length) throw new Error(TAGS_FILE + ' tags no move `shieldsUser`; the family cannot be derived');
  const fam = new Set(family);
  const lines = fs.readFileSync(D(STORE), 'utf8').split('\n').filter(Boolean);
  let kept = 0, clicks = 0, famClicks = 0, bots = 0, forfeits = 0;
  for (const line of lines) {
    const g = JSON.parse(line);
    const bot = !!((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot));
    if (bot) bots++;
    if (g.forfeit) forfeits++;
    if (bot || g.forfeit) continue;
    kept++;
    for (const t of g.turns || []) for (const e of t.ev || []) {
      if (e.t !== 'm') continue;
      clicks++;
      if (fam.has(norm(e.mv))) famClicks++;
    }
  }
  return { family, games_in_file: lines.length, games_dropped_bot: bots, games_dropped_forfeit: forfeits,
           games_kept: kept, clicks, family_clicks: famClicks,
           family_share: famClicks / clicks, family_share_pct: Number((100 * famClicks / clicks).toFixed(3)) };
}

if (require.main === module) {
  const r = measure();
  const drift = Object.keys(PUBLISHED).filter(k => r[k] !== PUBLISHED[k]);
  console.log('\n  HUMAN PROTECT-FAMILY RULER — ' + STORE + ', bots and forfeits dropped');
  console.log('    family (tags.json shieldsUser): ' + r.family.join(', '));
  console.log('    ' + r.games_in_file + ' games in file -> ' + r.games_kept + ' kept -> ' + r.clicks
    + ' clicks -> ' + r.family_clicks + ' protect-family = ' + r.family_share_pct + '%');
  if (drift.length) {
    console.log('    DOES NOT REPRODUCE the published ruler on: ' + drift.map(k => k + ' ' + r[k] + ' (published '
      + PUBLISHED[k] + ')').join(', ') + '. Refusing to write: the old figure is not this run\'s to publish.');
    process.exit(1);
  }
  console.log('    reproduces the published 2026-09-05 counts to the digit');
  if (process.argv.includes('--check')) process.exit(0);
  const RS = require('./run_stamp.js');
  fs.writeFileSync(D(OUT), JSON.stringify({
    what: 'The share of real human move clicks that are a protect-family move, on the frozen open-sheet '
        + 'pool. The ruler the empirical driver is compared against; store-derived, no simulator in the path.',
    generated: new Date().toISOString(),
    by: 'engine/human_protect_ruler.js',
    store: STORE,
    predicate: 'bots and forfeits dropped, nothing else — the predicate of the published 2026-09-05 ruler '
             + '(docs/_reports/2026-09-05-protect-amplification.md §1), deliberately NOT engine/quality.js',
    raw_store_ok: 'reads the FROZEN pool with the 2026-09-05 ruler\'s own predicate (bots and forfeits '
                + 'dropped) so the published figure is reproduced rather than replaced; the quality filter '
                + 'would publish a different number under this one\'s name',
    sampled: 'the frozen pool data/team-pool-frozen (2026-08-12), not the live corpus — a pinned population, '
           + 'so corpus drift against the live store is not staleness',
    click: "a stored turn event with t === 'm' — a move that reached the board",
    /* THE POPULATION, UNDER THE KEY engine/provenance.js READS AS ONE. Without it provenance printed
     * "records no game count — nobody can check what it was built from". */
    n_games: r.games_kept,
    ...r,
    reproduces: PUBLISHED,
    source_digests: RS.sourceDigests(['engine/human_protect_ruler.js', STORE, TAGS_FILE]),
  }, null, 2) + '\n');
  console.log('    wrote ' + OUT + '\n');
}

module.exports = { measure, PUBLISHED };
