/* smogon_priors.js — parse Smogon's official monthly moveset files into usable priors.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three things ABRA was guessing are measured here, over the whole ladder rather than over the
 * replays that happened to be uploaded:
 *
 *   1. SPREADS. champions_sim.js gave every Pokemon a flat 11/11/11/11/11/11 SP spread, documented
 *      as "spread evenly when unknown". Real Garchomp runs Jolly 2/32/0/0/0/32 on 42% of sets.
 *      Since stat = base + SP + 20, that is Attack 182 against our 161 — a 13% understatement on the
 *      format's most-used attacker, in EVERY damage figure the project has produced.
 *   2. P(move is ON the set). data/move-priors.json measures P(move | action), which is a different
 *      quantity — a move clicked rarely can still sit on most sets. Smogon's move percentages sum to
 *      ~400% precisely because every Pokemon carries four moves.
 *   3. ITEMS and ABILITIES, where our closed-sheet store has 69.7% and 75.5% unknown.
 *
 * Every spread in the file sums to exactly 66, which is independent confirmation of the SP budget
 * recorded in docs/ARCHITECTURE.md. The parser asserts it and reports violations rather than
 * silently accepting a file whose format has changed.
 *
 * CUTOFFS ARE WEIGHTINGS, NOT SUBSETS. All four files for a month report the same total battles
 * (1,163,315 for 2026-06 Reg M-B); the cutoff changes how heavily high-rated games are weighted, it
 * does not filter players. So "1760" means "weighted toward strong play", never "only strong
 * players". Default is 1630, Smogon's conventional "real meta" cutoff.
 *
 * LIMIT: aggregate. Describes the population, never a game, and cannot be joined to a replay.
 *
 *   node engine/smogon_priors.js                 # build data/smogon-priors.json from the newest month
 *   node engine/smogon_priors.js --month 2026-06 --cutoff 1630
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const STATS = D('data', 'smogon-stats');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

/* Latest month we hold that actually has a moveset directory. */
function latestMonth() {
  if (!fs.existsSync(STATS)) return null;
  const months = fs.readdirSync(STATS).filter(d => /^\d{4}-\d{2}$/.test(d)).sort();
  for (let i = months.length - 1; i >= 0; i--) {
    if (fs.existsSync(path.join(STATS, months[i], 'moveset'))) return months[i];
  }
  return null;
}

function activeFormat() {
  try {
    const r = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
    const a = r.regulations[r.active] || {};
    if (a.showdownFormat) return a.showdownFormat;
  } catch (e) { /* fall through */ }
  return 'gen9championsvgc2026regmb';
}

/* Percentage rows look like:  | Kasib Berry 31.726%                    | */
function pctRows(section) {
  const out = [];
  for (const line of (section || '').split('\n')) {
    const m = line.match(/^\|\s+(.+?)\s+([\d.]+)%\s*\|/);
    if (m && m[1] !== 'Other') out.push({ name: m[1].trim(), pct: parseFloat(m[2]) });
  }
  return out;
}

function parseMoveset(text) {
  const species = {};
  const violations = [];
  /* Blocks are delimited by the +---+ rules; a species block starts with its name then Raw count. */
  const chunks = text.split(/\+-{10,}\+/);
  for (let i = 0; i < chunks.length; i++) {
    const head = chunks[i];
    const nameM = head.match(/^\s*\|\s*([^|]+?)\s*\|\s*$/m);
    if (!nameM) continue;
    const name = nameM[1].trim();
    if (!name || /^(Abilities|Items|Spreads|Moves|Teammates|Checks and Counters)$/.test(name)) continue;
    const body = chunks.slice(i, i + 14).join('\n');
    const raw = Number((body.match(/Raw count:\s*(\d+)/) || [])[1] || 0);
    if (!raw) continue;

    const grab = (label, next) => {
      const re = new RegExp('\\|\\s*' + label + '\\s*\\|([\\s\\S]*?)(?=\\|\\s*(?:' + next + ')\\s*\\||$)');
      const m = body.match(re);
      return m ? pctRows(m[1]) : [];
    };
    const abilities = grab('Abilities', 'Items|Spreads|Moves|Teammates|Checks and Counters');
    const items     = grab('Items', 'Spreads|Moves|Teammates|Checks and Counters');
    const spreadsR  = grab('Spreads', 'Moves|Teammates|Checks and Counters');
    const moves     = grab('Moves', 'Teammates|Checks and Counters');
    const teammates = grab('Teammates', 'Checks and Counters');

    /* A spread is "Nature:hp/atk/def/spa/spd/spe" and MUST sum to the SP budget of 66. */
    const spreads = [];
    for (const s of spreadsR) {
      const m = s.name.match(/^(\w+):([\d/]+)$/);
      if (!m) continue;
      const sp = m[2].split('/').map(Number);
      if (sp.length !== 6 || sp.some(x => !Number.isFinite(x))) continue;
      const sum = sp.reduce((a, b) => a + b, 0);
      if (sum !== 66) violations.push(`${name} ${s.name} sums to ${sum}`);
      spreads.push({ nature: m[1], sp, pct: s.pct });
    }

    species[norm(name)] = {
      name, raw,
      abilities: abilities.map(a => ({ ability: a.name, pct: a.pct })),
      items: items.map(a => ({ item: a.name, pct: a.pct })),
      spreads,
      moves: moves.map(a => ({ move: a.name, pct: a.pct })),
      teammates: teammates.slice(0, 10).map(a => ({ species: norm(a.name), pct: a.pct })),
    };
  }
  return { species, violations };
}

function build() {
  const month = arg('month', latestMonth());
  const cutoff = arg('cutoff', '1630');
  const fmt = arg('format', activeFormat());
  if (!month) { console.error('no archived stats found; run engine/fetch_smogon_stats.js first'); process.exit(1); }
  const file = path.join(STATS, month, 'moveset', `${fmt}-${cutoff}.txt`);
  if (!fs.existsSync(file)) { console.error(`missing ${path.relative(ROOT, file)}`); process.exit(1); }

  const { species, violations } = parseMoveset(fs.readFileSync(file, 'utf8'));
  const n = Object.keys(species).length;
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    source: `smogon ${month} ${fmt}-${cutoff}`,
    note: 'AGGREGATE population statistics. Describes the ladder, never an individual game. Cutoffs are WEIGHTINGS, not subsets: all cutoffs for a month cover the same battles.',
    sp_budget: 66,
    month, cutoff: Number(cutoff), format: fmt,
    species_count: n,
    species,
  };
  fs.writeFileSync(D('data', 'smogon-priors.json'), JSON.stringify(out));
  console.log(`wrote data/smogon-priors.json — ${n} species from ${month} ${fmt}-${cutoff}`);
  if (violations.length) {
    console.error(`WARNING: ${violations.length} spread(s) did not sum to the SP budget of 66:`);
    for (const v of violations.slice(0, 5)) console.error('  ' + v);
    console.error('  The file format may have changed, or the budget is not 66 this regulation.');
  } else {
    console.log(`all spreads sum to 66 — SP budget confirmed against the official statistics`);
  }
}

let _p = null;
function priors() {
  if (_p) return _p;
  try { _p = JSON.parse(fs.readFileSync(D('data', 'smogon-priors.json'), 'utf8')); }
  catch (e) { _p = { species: {} }; }
  return _p;
}
function forSpecies(sp) { return priors().species[norm(sp)] || null; }

module.exports = { parseMoveset, priors, forSpecies, build };
if (require.main === module) build();
