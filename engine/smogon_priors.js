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
 * The spreads also confirm two mechanics against an independent source. The SP budget is 66, as
 * docs/ARCHITECTURE.md records — 97% of real spreads spend all of it. And SP is capped at 32 PER
 * STAT, which is why 92% of spreads touch 32 somewhere and why Jolly:32/0/0/0/0/32 sums to only 64:
 * a two-stat spread cannot spend more, however much budget is left. The parser asserts both
 * (total <= 66, every stat <= 32) and reports violations rather than silently accepting a file
 * whose format has changed.
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

/* CHECKS AND COUNTERS — the richest block in the file, and we were throwing it away.
 *
 * Smogon publishes, per species, what actually beats it, measured server-side over every game
 * played. The format is two lines per entry:
 *
 *     | Torkoal 61.576 (64.17±0.65)            |
 *     |     (36.5% KOed / 27.7% switched out)
 *
 * score      Smogon's check/counter number (higher = better check)
 * winRate    percentage with a 95% interval, ALREADY carrying its own uncertainty
 * koPct      how often the matchup ends with the subject KOed
 * switchPct  how often it ends with the subject switching out
 *
 * This is exactly what GURU and COUNTERPLAY were trying to derive from ~1,700 clean replays, where
 * nothing reached significance. Smogon computes it from hundreds of thousands of games — Garchomp's
 * raw count alone is 736,366 — and hands over the interval with it.
 */
function checkRows(section) {
  const out = [];
  const lines = (section || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\|\s+([A-Za-z][A-Za-z0-9'.\- ]*?)\s+([\d.]+)\s+\(([\d.]+)±([\d.]+)\)/);
    if (!m) continue;
    const next = lines[i + 1] || '';
    const k = next.match(/\(([\d.]+)%\s*KOed\s*\/\s*([\d.]+)%\s*switched out\)/);
    out.push({
      species: norm(m[1]),
      name: m[1].trim(),
      score: parseFloat(m[2]),
      winRate: parseFloat(m[3]),
      ci95: parseFloat(m[4]),
      koPct: k ? parseFloat(k[1]) : null,
      switchPct: k ? parseFloat(k[2]) : null,
    });
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
    /* Reject the metadata rows. Without this a block whose first bar-line happened to be
     * "Raw count: 239061" became a SPECIES, which is how a 300-species format produced 566 entries
     * and why some "species" carried impossible spreads. */
    if (!name) continue;
    if (/^(Abilities|Items|Spreads|Moves|Teammates|Checks and Counters)$/.test(name)) continue;
    if (/^(Raw count|Avg\. weight|Viability Ceiling)\b/.test(name)) continue;
    if (/^[\d.%\s]+$/.test(name)) continue;
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

    /* A spread is "Nature:hp/atk/def/spa/spd/spe".
     *
     * THE INVARIANT IS NOT "sums to 66". An early version asserted that and flagged 100 spreads,
     * including Jolly:32/0/0/0/0/32 which sums to 64. Those are not malformed — they reveal the
     * mechanic: SP is capped at 32 PER STAT, so a two-stat spread cannot exceed 64 no matter how
     * much budget remains. The real invariants are: total <= 66 (the budget), and every stat <= 32
     * (the per-stat cap). Both are asserted, and unspent budget is recorded rather than treated as
     * an error, because "how much budget do real sets leave on the table" is itself a finding. */
    const spreads = [];
    for (const s of spreadsR) {
      const m = s.name.match(/^(\w+):([\d/]+)$/);
      if (!m) continue;
      const sp = m[2].split('/').map(Number);
      if (sp.length !== 6 || sp.some(x => !Number.isFinite(x))) continue;
      const sum = sp.reduce((a, b) => a + b, 0);
      if (sum > 66) violations.push(`${name} ${s.name} sums to ${sum} (> budget 66)`);
      const over = sp.filter(x => x > 32);
      if (over.length) violations.push(`${name} ${s.name} has a stat above the 32 cap`);
      spreads.push({ nature: m[1], sp, pct: s.pct, total: sum, unspent: 66 - sum });
    }

    /* Checks and Counters is the LAST block, so it runs to the end of the species body. */
    const ccm = body.match(/\|\s*Checks and Counters\s*\|([\s\S]*)$/);
    const checks = ccm ? checkRows(ccm[1]) : [];
    const viability = Number((body.match(/Viability Ceiling:\s*(\d+)/) || [])[1] || 0) || null;

    species[norm(name)] = {
      name, raw, viability,
      abilities: abilities.map(a => ({ ability: a.name, pct: a.pct })),
      items: items.map(a => ({ item: a.name, pct: a.pct })),
      spreads,
      moves: moves.map(a => ({ move: a.name, pct: a.pct })),
      /* Teammates were truncated to 10. Kept in full: partner frequency over hundreds of thousands
       * of games is a far better archetype signal than clustering 1,933 observed teams. */
      teammates: teammates.map(a => ({ species: norm(a.name), pct: a.pct })),
      checks,
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
    console.log(`all spreads respect the budget (<=66) and the per-stat cap (<=32) — confirmed against official statistics`);
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

/* MEGA EVOLUTION, STRAIGHT FROM SMOGON — the authoritative source we already download.
 *
 * Smogon lists a mega forme as its OWN species entry ("Charizard-Mega-Y", "Swampert-Mega"), whose
 * item list is the stone at ~100%. So the real question — how often does this species carry a
 * stone — falls out of the two raw counts:
 *
 *     rate = raw(Species-Mega) / ( raw(Species) + raw(Species-Mega) )
 *
 * Measured on 2026-06 at the 1500 cutoff: Charizard 99%, Swampert 96%, Metagross 92%,
 * Staraptor 84%, Aerodactyl 42%. Those come from hundreds of thousands of games counted
 * server-side over every team played.
 *
 * This replaces inferring the rate from our own replays, which is both thin and BIASED: we learn a
 * Pokemon held a stone mainly because it mega-evolved and the protocol announced it (16,631 |-mega|
 * lines against 1,282 |-item| lines in 10,740 games), while a Pokemon holding Leftovers may never
 * reveal anything at all. That systematically overstates stones among observed items — our replay
 * estimate put Charizard at 88% where the true figure is 99%.
 *
 * Returns null when the species has no mega in this format, which is most of them. */
function megaInfo(sp) {
  const P = priors().species;
  const base = norm(sp);
  let formes = Object.keys(P).filter(k => k === base + 'mega' || k === base + 'megax' || k === base + 'megay');

  /* SMOGON DROPS THE FORME SUFFIX WHEN IT NAMES A MEGA, AND THAT BROKE A TOP-USAGE POKEMON.
   *
   * Floette-Eternal is the base; Smogon calls its mega simply "Floette-Mega". So the direct lookup
   * builds `floetteeternalmega`, which does not exist, and Floette-Eternal — 239,898 raw usage,
   * among the most-played in the format — silently received no mega stone at all.
   *
   * Fall back to a stem match: find a mega whose stem is a PREFIX of the species we were asked
   * about. The guard matters as much as the match — only accept when Smogon has NO base entry for
   * that stem, because if it does, the mega belongs to that base and not to our forme. Without it,
   * a query for Slowbro-Galar would wrongly attach Slowbronite, which Slowbro-Galar cannot use. */
  if (!formes.length) {
    const cands = Object.keys(P).filter(k => /mega[xy]?$/.test(k));
    formes = cands.filter(k => {
      const stem = k.replace(/mega[xy]?$/, '');
      return stem && stem !== base && base.startsWith(stem) && !P[stem];
    });
  }
  if (!formes.length) return null;
  const baseRaw = (P[base] || {}).raw || 0;
  let megaRaw = 0;
  const options = [];
  for (const f of formes) {
    const r = P[f].raw || 0;
    megaRaw += r;
    const stone = (P[f].items && P[f].items[0]) ? P[f].items[0].item : null;
    if (stone) options.push({ forme: f, stone, raw: r });
  }
  const total = baseRaw + megaRaw;
  if (!total || !options.length) return null;
  options.sort((a, b) => b.raw - a.raw);
  return { rate: megaRaw / total, options, baseRaw, megaRaw };
}

module.exports = { parseMoveset, priors, forSpecies, build, megaInfo };
if (require.main === module) build();
