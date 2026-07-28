// RAW-STORE-OK: byte-for-byte compression of the store. A filter here would corrupt the archive.
/* compress-stores.js — write the .gz that git actually tracks.
 *
 *   node build/compress-stores.js          # compress any store whose .gz is stale
 *   node build/compress-stores.js --check  # exit 1 if a .gz is stale, change nothing
 *
 * WHY THIS EXISTS
 * ---------------
 * data/games.ladder.jsonl reached 84.6 MB against GitHub's HARD per-file limit of 100 MB. At the
 * hourly collector's ~100 games/hour that was ~3,788 games — about 38 hours — from the point where
 * EVERY push fails, including the ingest Action's own commit. The failure mode is nasty because it
 * arrives without warning and takes the automation down with it.
 *
 * gzip is the measure the repository already applies to raw logs in build/archive-regulation.js, for
 * exactly this reason. Measured on 2026-07-28:
 *
 *     games.ladder.jsonl   84.6 MB -> 10.1 MB   (12%)
 *     games.ots.jsonl      30.4 MB ->  3.2 MB   (11%)
 *     games.bo3.jsonl      22.6 MB ->  2.1 MB   (9%)
 *
 * So git tracks `<store>.jsonl.gz`; .gitignore excludes the plain `.jsonl`. The plain file remains
 * what the collector appends to and what every local run reads, so nothing about the working setup
 * changes — it is simply no longer the thing git carries.
 *
 * THE STALENESS CHECK IS THE POINT. A .gz that silently lags the store it claims to mirror is the
 * project's recurring defect — something absent while appearing present — and here it would mean a
 * fresh clone reproducing numbers from games that have since been superseded. `--check` is what CI
 * and the pre-commit path should call; it reports rather than repairs.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const D = path.join(__dirname, '..', 'data');
const STORES = ['games.ladder.jsonl', 'games.ots.jsonl', 'games.bo3.jsonl'];
const CHECK = process.argv.includes('--check');

const mb = b => (b / 1048576).toFixed(1) + ' MB';
let stale = 0, wrote = 0, missing = 0;

for (const name of STORES) {
  const src = path.join(D, name), gz = src + '.gz';
  if (!fs.existsSync(src)) {
    /* No plain file is the normal state of a fresh clone, not an error — the .gz is the tracked
     * artefact and quality.js reads it directly. Only report if BOTH are absent. */
    if (!fs.existsSync(gz)) { console.log(`  ${name.padEnd(20)} ABSENT (neither .jsonl nor .jsonl.gz)`); missing++; }
    else console.log(`  ${name.padEnd(20)} .gz only — fresh clone, nothing to do`);
    continue;
  }
  const sStat = fs.statSync(src);
  const fresh = fs.existsSync(gz) && fs.statSync(gz).mtimeMs >= sStat.mtimeMs;
  if (fresh) { console.log(`  ${name.padEnd(20)} up to date (${mb(fs.statSync(gz).size)})`); continue; }
  stale++;
  if (CHECK) { console.log(`  ${name.padEnd(20)} STALE — .gz is older than the store`); continue; }
  const raw = fs.readFileSync(src);
  fs.writeFileSync(gz, zlib.gzipSync(raw, { level: 9 }));
  wrote++;
  const g = fs.statSync(gz).size;
  console.log(`  ${name.padEnd(20)} ${mb(raw.length)} -> ${mb(g)}  (${(100 * g / raw.length).toFixed(0)}%)`);
}

if (missing) { console.error(`\n${missing} store(s) absent entirely.`); process.exit(1); }
if (CHECK && stale) {
  console.error(`\n${stale} compressed store(s) are STALE. Run: node build/compress-stores.js`);
  process.exit(1);
}
console.log(CHECK ? '\nall compressed stores are current.' : `\n${wrote} store(s) recompressed.`);
