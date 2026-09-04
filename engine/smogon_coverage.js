/* smogon_coverage.js — stamp an archived Smogon month as a COMPARISON SET, and say how far our own
 * store is from the ladder Smogon measured.
 *
 * WHAT THIS IS NOT. It is not a second fetcher and not a second parser. engine/fetch_smogon_stats.js
 * archives the files and engine/smogon_priors.js parses the moveset blocks; both are required here
 * rather than reimplemented, because two implementations of one question is a failure this repo has
 * already paid for (see engine/mc_key.js on the four hand-rolled species lookups, two of them wrong).
 *
 * WHAT IS ACTUALLY NEW HERE, and why it needed a file:
 *
 *   1. NOBODY PARSED THE USAGE TABLE. smogon_priors.js reads data/smogon-stats/<month>/moveset/ and
 *      nothing else. The usage/ files — which fetch_smogon_stats.js has been downloading since it was
 *      written — carry the ranked table, the raw and "real" counts, and the only Total battles line
 *      in the whole dump. That number is the sample size of every figure Smogon publishes and it was
 *      not being read.
 *
 *   2. NOBODY CHECKED THE DUMP FOR LEGALITY. A file named for our format is not evidence that it
 *      holds our format. Every species is resolved through Dex.forFormat('<active format>') and
 *      filtered with `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`; anything that fails is
 *      REPORTED, never dropped. A quiet drop would hide the two things worth knowing — that the dump
 *      is not the format we think, or that our legality filter is wrong.
 *
 *   3. NOBODY COMPARED SMOGON'S SPECIES TO OUR OWN. Smogon computes over the whole ladder; we hold a
 *      sample of uploaded replays. "How many species does Smogon see that we never have" is the one
 *      number that says whether our sample is representative, and it had no instrument.
 *
 * THE JOIN IS NOT A STRING COMPARE, AND GETTING IT WRONG WOULD INVENT A FINDING.
 * durable-ingest.js collapses every mega and primal forme to its base species in `six`/`brought`/
 * `lead`, because team preview only ever shows the base (see its baseForme()). Smogon lists
 * Charizard-Mega-Y as its own row. So a naive join against `six` alone reports EVERY mega in the
 * format as "our store has never seen it" — a fabricated result about 26% of this format's usage.
 * The store's `sets` map does keep the battle forme, so the seen-set is the UNION of `six` and the
 * keys of `sets`, and the two halves are reported separately so the caller can see which one carried
 * a species.
 *
 * THE FILE IS VERIFIED BY ITS CONTENT, NOT ITS NAME. Champions runs a 66-point SP budget capped at 32
 * per stat; mainline Gen 9 runs 508 EVs capped at 252. So the spread block is a fingerprint: a
 * mainline file dropped at this path would blow the budget on essentially every row. The max spread
 * total and max single stat are recorded in the artifact for exactly that reason.
 *
 * LIMIT, STATED PLAINLY: this is a PRIOR. CLAUDE.md ranks usage sources below the Showdown calculator
 * and HoopaDex learnsets. It is AGGREGATE — it describes a population, never a game, and cannot be
 * joined to a replay. It is written to its own dated artifact and merged into nothing.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/smogon_coverage.js
 *   SHOWDOWN_PATH=... node engine/smogon_coverage.js --month 2026-08
 *   ... --no-store        # skip the 600 MB store scan (coverage fields omitted, not faked)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const STATS = D('data', 'smogon-stats');
const BASE_URL = 'https://www.smogon.com/stats';
const CUTOFFS = [0, 1500, 1630, 1760];
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const { parseMoveset } = require('./smogon_priors.js');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

/* Formats come from data/regulations.json, the same door fetch_smogon_stats.js uses, so a regulation
 * change is a config edit rather than a code edit. */
function formats() {
  const r = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
  const a = r.regulations[r.active] || {};
  const out = { bo1: a.showdownFormat, bo3: a.bo3Format };
  if (!out.bo1) throw new Error('data/regulations.json declares no showdownFormat for the active regulation');
  return out;
}

function latestMonth() {
  const months = fs.readdirSync(STATS).filter(d => /^\d{4}-\d{2}$/.test(d)).sort();
  for (let i = months.length - 1; i >= 0; i--) {
    if (fs.existsSync(path.join(STATS, months[i], 'moveset'))) return months[i];
  }
  throw new Error('no archived month with a moveset directory; run engine/fetch_smogon_stats.js first');
}

/* THE USAGE TABLE. Rows look like:
 *   | 1    | Kingambit          | 27.08899% | 687654 | 27.089% | 297382 | 25.633% |
 * `Usage %` is the CUTOFF-WEIGHTED figure and is the only column that moves between the four files.
 * Raw and Real are identical across all four, which is the arithmetic proof that a cutoff is a
 * WEIGHTING and not a subset — all four cover the same battles. */
const ROW = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|/;

function parseUsage(text) {
  const battles = (text.match(/Total battles:\s*(\d+)/) || [])[1];
  const avgWeight = (text.match(/Avg\. weight\/team:\s*([\d.]+)/) || [])[1];
  if (battles === undefined) throw new Error('usage file has no "Total battles" line — not a Smogon usage table');
  const rows = [];
  for (const line of text.split('\n')) {
    const m = line.match(ROW);
    if (!m) continue;
    rows.push({
      rank: Number(m[1]), name: m[2].trim(), key: norm(m[2]),
      usagePct: parseFloat(m[3]), raw: Number(m[4]), rawPct: parseFloat(m[5]),
      real: Number(m[6]), realPct: parseFloat(m[7]),
    });
  }
  if (!rows.length) throw new Error('usage file parsed to zero rows — the table format has changed');
  return { totalBattles: Number(battles), avgWeightPerTeam: Number(avgWeight), rows };
}

/* LEGALITY. Dex.forFormat is NOT a legality filter — species.all() walks the National Dex wearing the
 * format's name — so every lookup is filtered explicitly. Absent SHOWDOWN_PATH this returns null and
 * the artifact records that the check DID NOT RUN, rather than recording zero illegal species, which
 * would read as a pass. */
function legalityChecker(formatId) {
  if (!process.env.SHOWDOWN_PATH) return null;
  const { Dex } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim'));
  const D2 = Dex.forFormat(formatId);
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const legalCount = D2.species.all().filter(legal).length;
  return {
    legalSpeciesInFormat: legalCount,
    judge(name) {
      const sp = D2.species.get(name);
      if (!sp || !sp.exists) return { verdict: 'NOT-IN-DEX', isNonstandard: null, tier: null };
      return {
        verdict: legal(sp) ? 'LEGAL' : 'ILLEGAL',
        isNonstandard: sp.isNonstandard || null,
        tier: sp.tier || null,
        resolved: sp.name,
        baseSpecies: sp.baseSpecies || null,
      };
    },
  };
}

/* OUR OWN STORE. Read-only, streaming. The mtime is captured before and after: an append from the
 * live ingest during the scan makes the count a torn read, and a torn read here is not an error but a
 * plausible wrong answer, so it is reported rather than swallowed. */
async function storeSpecies(files) {
  const six = new Set(), sets = new Set();
  const perFile = {};
  let games = 0, badLines = 0, moved = false;
  for (const rel of files) {
    const p = D(rel);
    if (!fs.existsSync(p)) { perFile[rel] = { present: false }; continue; }
    const before = fs.statSync(p).mtimeMs;
    let g = 0, bad = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(p, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let o;
      try { o = JSON.parse(line); }
      catch (e) { bad++; continue; }   // counted and surfaced in the artifact, never silently skipped
      g++;
      for (const side of ['p1', 'p2']) for (const s of ((o.six || {})[side] || [])) six.add(s);
      for (const k of Object.keys(o.sets || {})) sets.add(k);
    }
    const st = fs.statSync(p);
    const mv = st.mtimeMs !== before;
    if (mv) moved = true;
    perFile[rel] = { present: true, games: g, badLines: bad, sizeBytes: st.size, mtime: new Date(st.mtimeMs).toISOString(), mtimeMovedDuringScan: mv };
    games += g; badLines += bad;
  }
  return { six: [...six].sort(), sets: [...sets].sort(), games, badLines, perFile, tornRead: moved };
}

async function main() {
  const month = arg('month', latestMonth());
  const fmts = formats();
  const skipStore = process.argv.includes('--no-store');
  const now = new Date().toISOString();

  const store = skipStore ? null : await storeSpecies(['data/games.ladder.jsonl', 'data/games.bo3.jsonl']);
  const seen = store ? new Set([...store.six, ...store.sets]) : null;

  const out = {
    generated: now,
    month,
    kind: 'COMPARISON SET — a PRIOR, not truth.',
    note: 'AGGREGATE population statistics from Smogon. Describes the ladder, never an individual game, '
        + 'and cannot be joined to a replay. Cutoffs are WEIGHTINGS, not subsets: all four cutoffs for a '
        + 'month cover the same battles, which is why Raw and Real are identical across them and only '
        + 'Usage % moves. Merged into nothing; data/meta-usage.json and data/smogon-priors.json are '
        + 'untouched by this script.',
    ranking: 'CLAUDE.md ranks usage sources below the Showdown damage calculator and HoopaDex learnsets.',
    populations: {},
    store: store && {
      games: store.games, badLines: store.badLines, tornRead: store.tornRead,
      distinctSixSpecies: store.six.length, distinctSetSpecies: store.sets.length,
      distinctUnion: seen.size, perFile: store.perFile,
      join: 'durable-ingest.js collapses mega/primal formes to the base species in `six`; `sets` keeps '
          + 'the battle forme. The seen-set is the UNION, or every mega would falsely read as unseen.',
    },
  };

  for (const [label, fmt] of Object.entries(fmts)) {
    if (!fmt) continue;
    const chk = legalityChecker(fmt);
    const pop = {
      format: fmt,
      legalityCheck: chk ? { ran: true, legalSpeciesInFormat: chk.legalSpeciesInFormat }
                         : { ran: false, why: 'SHOWDOWN_PATH is not set. This is NOT a pass — no species was checked.' },
      cutoffs: {},
    };

    for (const cut of CUTOFFS) {
      const uPath = path.join(STATS, month, 'usage', `${fmt}-${cut}.txt`);
      const mPath = path.join(STATS, month, 'moveset', `${fmt}-${cut}.txt`);
      if (!fs.existsSync(uPath)) { pop.cutoffs[cut] = { present: false }; continue; }

      const uText = fs.readFileSync(uPath, 'utf8');
      const usage = parseUsage(uText);
      const mExists = fs.existsSync(mPath);
      const mv = mExists ? parseMoveset(fs.readFileSync(mPath, 'utf8')) : { species: {}, violations: [] };

      /* The SP fingerprint: Champions is a 66-point budget capped at 32 per stat. A mainline Gen 9
       * file at this path would show totals near 508 and stats of 252. */
      let maxTotal = 0, maxStat = 0, nSpreads = 0;
      for (const s of Object.values(mv.species)) {
        for (const sp of s.spreads) {
          nSpreads++;
          if (sp.total > maxTotal) maxTotal = sp.total;
          for (const v of sp.sp) if (v > maxStat) maxStat = v;
        }
      }

      const illegal = [], notInDex = [];
      if (chk) {
        for (const r of usage.rows) {
          const j = chk.judge(r.name);
          if (j.verdict === 'ILLEGAL') illegal.push({ name: r.name, rank: r.rank, usagePct: r.usagePct, isNonstandard: j.isNonstandard, tier: j.tier });
          else if (j.verdict === 'NOT-IN-DEX') notInDex.push({ name: r.name, rank: r.rank, usagePct: r.usagePct });
        }
      }

      let coverage = null;
      if (seen) {
        const unseen = usage.rows.filter(r => !seen.has(r.key));
        coverage = {
          smogonSpecies: usage.rows.length,
          unseenInOurStore: unseen.length,
          unseenUsagePctSum: Number(unseen.reduce((a, r) => a + r.usagePct, 0).toFixed(4)),
          unseenTop: unseen.slice(0, 25).map(r => ({ name: r.name, rank: r.rank, usagePct: r.usagePct, raw: r.raw })),
        };
      }

      pop.cutoffs[cut] = {
        present: true,
        provenance: {
          usageUrl: `${BASE_URL}/${month}/${fmt}-${cut}.txt.gz`,
          movesetUrl: `${BASE_URL}/${month}/moveset/${fmt}-${cut}.txt.gz`,
          archivedAt: fs.statSync(uPath).mtime.toISOString(),
          stampedAt: now,
          usageBytes: fs.statSync(uPath).size,
          movesetBytes: mExists ? fs.statSync(mPath).size : 0,
        },
        totalBattles: usage.totalBattles,
        avgWeightPerTeam: usage.avgWeightPerTeam,
        speciesInUsageTable: usage.rows.length,
        speciesInMovesetFile: Object.keys(mv.species).length,
        spFingerprint: { spreads: nSpreads, maxSpreadTotal: maxTotal, maxSingleStat: maxStat, budget: 66, perStatCap: 32, budgetViolations: mv.violations.length },
        illegalSpecies: illegal,
        speciesNotInDex: notInDex,
        coverageVsOurStore: coverage,
        top20: usage.rows.slice(0, 20).map(r => ({ rank: r.rank, name: r.name, usagePct: r.usagePct, raw: r.raw })),
      };
    }
    out.populations[label] = pop;
  }

  const outPath = D('data', `smogon-coverage-${month}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`wrote data/smogon-coverage-${month}.json`);
  for (const [label, pop] of Object.entries(out.populations)) {
    for (const [cut, c] of Object.entries(pop.cutoffs)) {
      if (!c.present) { console.log(`  ${label} ${pop.format}-${cut}: NOT ARCHIVED`); continue; }
      const cov = c.coverageVsOurStore;
      console.log(`  ${label} ${pop.format}-${cut}: battles=${c.totalBattles} species=${c.speciesInUsageTable} `
        + `illegal=${c.illegalSpecies.length} notInDex=${c.speciesNotInDex.length} `
        + `maxSpread=${c.spFingerprint.maxSpreadTotal}/${c.spFingerprint.maxSingleStat} `
        + (cov ? `unseenHere=${cov.unseenInOurStore}` : 'unseenHere=NOT MEASURED'));
    }
  }
}

if (require.main === module) main().then(() => process.exit(0), e => { console.error('FAILED: ' + e.stack); process.exit(1); });
module.exports = { parseUsage, storeSpecies };
