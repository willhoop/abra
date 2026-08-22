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
const SYNC  = process.argv.includes('--sync');

const mb = b => (b / 1048576).toFixed(1) + ' MB';
/* Counted on the buffer rather than by splitting a 288 MB string into an array of 64,000. */
const countLines = buf => {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return buf.length && buf[buf.length - 1] !== 10 ? n + 1 : n;
};

/* ---- `--sync` — PULL ORIGIN'S GAMES DOWN INTO THE LOCAL STORE -----------------------------------
 *
 * The repaired ingest Action appends on GitHub every six hours; the local plain .jsonl only grows
 * when someone runs the ingest here. So the two diverge in BOTH directions, and neither is a superset
 * of the other. This merges them the same way the Action's reconcile loop does, and for the same
 * reason: take both sides, concatenate, keep the FIRST occurrence of each id.
 *
 * IT IS AN APPEND, NEVER A REPLACE. A plain "restore from .gz" would discard local games origin has
 * not seen — the exact loss this file now refuses to commit — so the local store is a source here,
 * not a casualty. Dedupe by id is idempotent, so running it twice is a no-op, and the result cannot
 * be smaller than either input. */
if (SYNC) {
  let grew = 0;
  for (const name of STORES) {
    const src = path.join(D, name), gz = src + '.gz';
    if (!fs.existsSync(gz)) { console.log(`  ${name.padEnd(20)} no .gz — nothing to sync from`); continue; }
    const fromGz = zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8').split('\n');
    const local  = fs.existsSync(src) ? fs.readFileSync(src, 'utf8').split('\n') : [];
    const seen = new Set(); const out = [];
    for (const line of [...fromGz, ...local]) {          // origin first, so its copy wins a tie
      if (!line.trim()) continue;
      const m = line.match(/"id":"([^"]+)"/);
      const key = m ? m[1] : line;
      if (seen.has(key)) continue;
      seen.add(key); out.push(line);
    }
    const before = local.filter(l => l.trim()).length;
    fs.writeFileSync(src, out.join('\n') + '\n');
    /* The .gz must not now look stale relative to the file it just fed, or --check would demand a
     * recompress that has nothing to add. Only safe because `out` is a superset of both sides. */
    fs.utimesSync(gz, new Date(), new Date());
    grew += out.length - before;
    console.log(`  ${name.padEnd(20)} ${before} -> ${out.length}  (+${out.length - before} from origin)`);
  }
  console.log(`\nsynced: ${grew} game(s) pulled down from the tracked archive.`);
  process.exit(0);
}
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

  /* THE LOCAL SHRINK GUARD — 2026-08-21. The ingest Action already refuses to commit a store that
   * lost records, twice. This is the same claim on the LOCAL path, and without it the repaired
   * collector creates a brand-new way to lose data: the Action now appends on GitHub every six
   * hours, so origin's .gz routinely holds MORE games than a laptop's plain .jsonl, which only
   * grows when someone runs the ingest here. Recompressing from the older local file and committing
   * would silently overwrite the newer archive.
   *
   * MEASURED THE DAY THIS WAS WRITTEN: the first green Action run took the ladder store 64,021 ->
   * 64,491 while the local plain file sat at 64,021. A plain `node build/compress-stores.js; git
   * commit` at that moment would have thrown away 470 games and reported success.
   *
   * These stores are append-only and deduped by id, so record count is monotonic BY CONSTRUCTION.
   * A .gz holding more lines than its source is therefore never a legitimate state — it is proof
   * the local file is behind. Refuse, and say exactly how to reconcile. */
  if (fs.existsSync(gz)) {
    const gzLines = countLines(zlib.gunzipSync(fs.readFileSync(gz)));
    const srcLines = countLines(raw);
    if (gzLines > srcLines) {
      console.error(`\n  ${name.padEnd(20)} REFUSING TO COMPRESS — the tracked .gz holds MORE records `
        + `than the local store: ${gzLines} vs ${srcLines}.`);
      console.error(`  Writing it would discard ${gzLines - srcLines} game(s) that are already on origin.`);
      console.error(`  These stores are append-only and deduped by id, so this is never a legitimate`);
      console.error(`  update — the local file is BEHIND. Reconcile first:\n`);
      console.error(`      node build/compress-stores.js --sync    # merge origin's .gz into the local store\n`);
      process.exit(1);
    }
  }
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
