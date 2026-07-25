/* ingest_ots.js — import the archived OPEN TEAM SHEET corpus into its own bucket.
 *
 * WHY. ABRA's ladder collection began 2026-07-22. Reg M-B started in mid-June, so roughly five weeks
 * of the regulation's history are missing and CANNOT BE RECOVERED from Showdown: the replay search
 * API only exposes a recent window, and while an individual June replay still resolves by id, those
 * ids are not discoverable — the 324 archived games span 1.9M sequential ids because Showdown
 * numbers across every format at once, a 1-in-5,900 hit rate. The only way to have June data is to
 * have been collecting in June, or to take it from someone who was.
 *
 * cameronangliss/vgc-battle-logs (MIT) was collected 2026-06-17..20 and contains the raw logs, so no
 * refetch is needed.
 *
 * THIS IS A SEPARATE BUCKET AND MUST STAY ONE. These games are OPEN TEAM SHEET: the full set is
 * declared before turn one. That is a different information regime from ABRA's closed-sheet Bo1
 * ladder, and — the point that matters more — a different INCENTIVE regime. In closed-sheet Bo1 a
 * surprise tech slot has value precisely because it is hidden; under OTS that value is zero, so
 * players build for raw matchup strength instead. OTS sets are therefore systematically different
 * from closed-sheet sets, in a predictable direction (fewer tech slots), not merely more visible.
 *
 * They are also a MONTH EARLIER, about a week into the regulation, when a metagame moves fastest.
 * Any comparison against the July ladder store confounds sheets-open with meta-drift and there is no
 * overlap in time to separate them.
 *
 * So: usable for engine work, set composition, and as the only historical coverage that exists.
 * NOT usable as ground truth for closed-sheet set reconstruction, and never to be pooled with
 * data/games.ladder.jsonl.
 *
 *   node engine/ingest_ots.js <logs_gen9championsvgc2026regmb.json> [more.json ...]
 *     --out data/games.ots.jsonl
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { extract } = require('./durable-ingest.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const LADDER = D('data', 'games.ladder.jsonl');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const OUT = path.resolve(arg('out', D('data', 'games.ots.jsonl')));
if (path.resolve(OUT) === path.resolve(LADDER)) {
  console.error('REFUSING: --out is the closed-sheet ladder store. OTS games must not be pooled with it.');
  process.exit(1);
}

const files = process.argv.slice(2).filter(a => a.endsWith('.json') && !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node engine/ingest_ots.js <logs_*.json> [...] [--out data/games.ots.jsonl]');
  process.exit(2);
}

const have = new Set();
if (fs.existsSync(OUT)) {
  for (const l of fs.readFileSync(OUT, 'utf8').split('\n')) {
    const t = l.trim(); if (!t) continue;
    try { have.add(JSON.parse(t).id); } catch {}
  }
}

const out = fs.createWriteStream(OUT, { flags: 'a' });
let added = 0, skipped = 0, bad = 0, noOts = 0;
const dates = [];

for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`missing: ${f}`); continue; }
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.error(`unparseable: ${f}`); continue; }

  const fmt = path.basename(f).replace(/^logs_/, '').replace(/\.json$/, '');
  let n = 0;
  for (const [id, v] of Object.entries(j)) {
    if (have.has(id)) { skipped++; continue; }
    const uploadtime = Array.isArray(v) ? Number(v[0]) : null;
    const log = Array.isArray(v) ? v[1] : null;
    if (!log || !uploadtime) { bad++; continue; }
    /* Confirm it really is open team sheet rather than trusting the dataset card. |showteam|
     * declares the full set; without it the record does not belong in this bucket. */
    if (!/\|showteam\|/.test(log)) { noOts++; continue; }

    let rec;
    try { rec = extract(id, uploadtime, log); } catch (e) { bad++; continue; }
    if (!rec || (rec.six.p1 || []).length < 4 || (rec.six.p2 || []).length < 4) { bad++; continue; }

    rec.source = 'ots-archive';
    rec.ots = {
      dataset: 'cameronangliss/vgc-battle-logs',
      license: 'MIT',
      format: fmt,
      note: 'OPEN TEAM SHEET. Different information AND incentive regime from the closed-sheet ladder store. Do not pool.',
    };
    out.write(JSON.stringify(rec) + '\n');
    dates.push(uploadtime);
    added++; n++;
  }
  console.error(`  ${path.basename(f)}: ${n} imported`);
}

out.end(() => {
  dates.sort((a, b) => a - b);
  const d = x => new Date(x * 1000).toISOString().slice(0, 10);
  console.error(`\nOTS import: ${added} games -> ${path.relative(ROOT, OUT)}`);
  if (dates.length) console.error(`  date range: ${d(dates[0])} .. ${d(dates[dates.length - 1])}`);
  console.error(`  ${skipped} already present, ${bad} unusable, ${noOts} lacked |showteam| and were rejected`);
});
