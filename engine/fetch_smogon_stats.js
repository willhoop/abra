/* fetch_smogon_stats.js — archive Smogon's official monthly usage statistics for our formats.
 *
 * WHY THIS EXISTS. ABRA's ladder collection began 2026-07-22. Reg M-B started mid-June, so five
 * weeks of the regulation are missing and are NOT recoverable: Showdown's replay search exposes only
 * a recent window, and although an old replay still resolves by id, the ids are not discoverable —
 * an archived sample of 324 Reg M-B games spans 1.9M sequential ids because Showdown numbers across
 * every format at once. Data not captured at the time is gone.
 *
 * Smogon, however, has been computing statistics over the WHOLE ladder the entire time and publishes
 * them monthly. That is the one source that covers the gap, and it is far larger than anything we
 * could scrape: a single species in the June Reg M-B file carries a raw count of 860,069.
 *
 * WHAT THE MOVESET FILES GIVE US THAT THE STORE CANNOT
 *   - P(move is ON THE SET). Our behaviour-clone measures P(move | action), which is a different
 *     quantity: a move clicked rarely may still sit on most sets. The moveset percentages sum to
 *     ~400% precisely because every Pokemon carries four moves. That is the object set_priors.js
 *     should have been sampling from all along.
 *   - Items and abilities. Our closed-sheet store has no item on 69.7% of sets and no ability on
 *     75.5%.
 *   - SPREADS. champions_sim.js currently gives every Pokemon a flat 11/11/11/11/11/11 SP spread,
 *     documented as "spread evenly when unknown". Real spreads look like Bold:32/0/14/0/20/0. Every
 *     damage figure computed on the flat assumption is wrong.
 *   - Rating cutoffs (0 / 1500 / 1630 / 1760), so high-ladder statistics are available without us
 *     having to detect bots at all.
 *
 * LIMIT, STATED: these are AGGREGATE. They describe the population, never an individual game, and
 * they cannot be joined to a replay. Use them for priors, not for analysis of games.
 *
 *   node engine/fetch_smogon_stats.js              # the most recent published month
 *   node engine/fetch_smogon_stats.js 2026-06      # a specific month
 *   node engine/fetch_smogon_stats.js --backfill 6 # the last 6 months
 */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'smogon-stats');
const BASE = 'https://www.smogon.com/stats';
const CUTOFFS = [0, 1500, 1630, 1760];

/* Formats come from data/regulations.json where possible, so a regulation change is a config edit
 * rather than a code edit — the same rule durable-ingest.js follows. */
function formats() {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regulations.json'), 'utf8'));
    const a = r.regulations[r.active] || {};
    const out = [a.showdownFormat, a.bo3Format].filter(Boolean);
    if (out.length) return out;
  } catch (e) { /* fall through */ }
  return ['gen9championsvgc2026regmb', 'gen9championsvgc2026regmbbo3'];
}

const get = (url) => new Promise((resolve) => {
  const req = https.get(url, { headers: { 'user-agent': 'ABRA-stats-archiver' } }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return resolve({ ok: false, code: res.statusCode }); }
    let d = ''; res.setEncoding('utf8');
    res.on('data', c => d += c);
    res.on('end', () => resolve({ ok: true, body: d }));
  });
  req.on('error', () => resolve({ ok: false, code: 0 }));
  req.setTimeout(30000, () => { req.destroy(); resolve({ ok: false, code: 0 }); });
});

const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

async function fetchMonth(month) {
  let wrote = 0, missing = 0;
  for (const fmt of formats()) {
    for (const cut of CUTOFFS) {
      for (const kind of ['usage', 'moveset']) {
        // usage lives at the month root; moveset in a subdirectory
        const url = kind === 'usage'
          ? `${BASE}/${month}/${fmt}-${cut}.txt`
          : `${BASE}/${month}/moveset/${fmt}-${cut}.txt`;
        const dir = path.join(OUT, month, kind);
        const file = path.join(dir, `${fmt}-${cut}.txt`);
        if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;   // idempotent
        const r = await get(url);
        if (!r.ok) { missing++; continue; }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, r.body);
        wrote++;
        process.stderr.write(`  ${month}/${kind}/${fmt}-${cut}.txt  ${(r.body.length / 1024).toFixed(0)} KB\n`);
      }
    }
  }
  return { wrote, missing };
}

async function main() {
  const args = process.argv.slice(2);
  let months = [];
  const bi = args.indexOf('--backfill');
  if (bi >= 0) {
    const n = parseInt(args[bi + 1] || '6', 10);
    for (let i = 1; i <= n; i++) months.push(monthsAgo(i));
  } else if (args[0] && /^\d{4}-\d{2}$/.test(args[0])) {
    months = [args[0]];
  } else {
    /* Smogon publishes in the first days of the following month, so "current" means last month.
     * Try the month before that too — early in a month the newest may not have landed yet. */
    months = [monthsAgo(1), monthsAgo(2)];
  }

  let total = 0;
  for (const m of months) {
    process.stderr.write(`${m}:\n`);
    const { wrote, missing } = await fetchMonth(m);
    total += wrote;
    if (!wrote) process.stderr.write(`  nothing new (${missing} not published or already held)\n`);
  }
  process.stderr.write(`\ndone: ${total} file(s) archived under data/smogon-stats/\n`);
  /* Never fail the job when a month is simply not out yet — this runs unattended and must not page
   * anyone. The ingest workflow learned this the hard way (see .github/workflows/ingest.yml). */
}

module.exports = { fetchMonth, formats };
if (require.main === module) main();
