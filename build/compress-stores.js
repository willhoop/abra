// RAW-STORE-OK: byte-for-byte compression of the store. A filter here would corrupt the archive.
/* compress-stores.js — write the .gz that git actually tracks.
 *
 *   node build/compress-stores.js                # compress any store whose .gz is stale
 *   node build/compress-stores.js --check        # exit 1 if a .gz is stale, change nothing
 *   node build/compress-stores.js --raw          # append this run's NEW raw logs as a dated shard
 *   node build/compress-stores.js --restore-raw  # rebuild the plain raw archives from their shards
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
/* The RAW PROTOCOL LOGS behind those stores. These are the SOURCE OF TRUTH — the parsed store is a
 * derived view that can be thrown away and rebuilt offline — and until now they were gitignored and
 * existed on one laptop.
 *
 * DERIVED FROM STORES, NOT TYPED BESIDE IT. A second hand-maintained list of three is the shape
 * this project has paid for twice (the ban list of four, the fourteen handoffs): it agrees with
 * STORES today and goes stale the day a fourth store is added, silently, because nothing would
 * compare them. The naming rule is not a coincidence to be re-stated — it is engine/durable-ingest.js's
 * own `const RAW = STORE.replace(/\.jsonl$/,'') + '.raw-logs.jsonl'`, applied here to the same list. */
const RAW_STORES = STORES.map(s => s.replace(/\.jsonl$/, '') + '.raw-logs.jsonl');
const RAW_DIR = path.join(D, 'raw');
const CHECK = process.argv.includes('--check');
const SYNC  = process.argv.includes('--sync');
const RAW        = process.argv.includes('--raw');
const RESTORERAW = process.argv.includes('--restore-raw');

const mb = b => (b / 1048576).toFixed(1) + ' MB';
/* Counted on the buffer rather than by splitting a 288 MB string into an array of 64,000. */
const countLines = buf => {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return buf.length && buf[buf.length - 1] !== 10 ? n + 1 : n;
};

/* ================================================================================================
 * `--raw` / `--restore-raw` — THE RAW LOG ARCHIVE BECOMES DURABLE, AS WRITE-ONCE DATED SHARDS
 * ================================================================================================
 *
 * THE INVARIANT THIS SERVES. The raw protocol log is the ONLY source of truth; the parsed store is
 * a derived view that can be thrown away and rebuilt offline (MODE=reparse). That is only worth
 * anything if the logs SURVIVE. They did not: `**\/*.raw-logs.jsonl` is gitignored, so the archive
 * existed on one laptop, and Showdown's replay pool is a ROLLING ~1,250 per format — a log that is
 * lost cannot be re-fetched by anyone, ever.
 *
 * WHY SHARDS AND NOT ONE .gz — THE ARITHMETIC, NOT A PREFERENCE.
 *   - gzip on raw protocol logs runs ~14% (they compress better than the parsed store's ~12%).
 *   - The ladder + bo3 plain archives are ~585 MB today, so ONE tracked .gz is ~80 MB against
 *     GitHub's HARD 100 MB per-file limit — weeks away from the exact wall that forced the parsed
 *     stores into .gz in the first place (acf7124, 2026-07-28).
 *   - Worse, gzip has no append: a single .gz is REWRITTEN WHOLE every run. At a six-hourly cadence
 *     that is a fresh ~80 MB blob in the pack every time — hundreds of MB of pack growth a day, and
 *     git history is not something you can vacuum afterwards.
 *
 * So: one small gzip per ingest run, named for the moment it was cut, in data/raw/<store>/. Each is
 * a few hundred KB. Git stores each exactly once and never rewrites it.
 *
 * A SHARD IS NEVER REWRITTEN AND NEVER DELETED. NO COMPACTION. Compaction is what would make this
 * dangerous — it turns an append-only history into a mutable one, and it is precisely the
 * `merge=union` shape of mistake this repository has already paid for. A name collision inside one
 * minute gets a new suffix rather than an overwrite.
 *
 * `--restore-raw` is the mirror of the workflow's "Restore the plain stores from the tracked .gz"
 * step: shards, in filename order (which is chronological by construction), back to the plain path.
 * It UNIONS with whatever plain file is already there, first occurrence wins, exactly like --sync —
 * so on a fresh runner it is a plain concatenation, and on a laptop holding rows no shard has seen
 * yet it cannot lose them. Idempotent either way.
 */
const stamp = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
};
const idOf = line => { const m = line.match(/"id":"([^"]+)"/); return m ? m[1] : line; };
const shardDirFor = rawName => path.join(RAW_DIR, rawName.replace(/\.raw-logs\.jsonl$/, ''));
const shardsIn = dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.gz')).sort() : []);
/* Read the ids already sharded. Line-wise regex rather than JSON.parse: a raw log row carries the
 * whole protocol text, and parsing 400 MB of it to read one field is minutes of nothing. */
function shardedIds(dir) {
  const ids = new Set();
  for (const f of shardsIn(dir)) {
    for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n')) {
      if (line.trim()) ids.add(idOf(line));
    }
  }
  return ids;
}

if (RAW) {
  let wroteAny = 0;
  for (const name of RAW_STORES) {
    const src = path.join(D, name), dir = shardDirFor(name);
    if (!fs.existsSync(src)) { console.log(`  ${name.padEnd(34)} no plain archive here — nothing to shard`); continue; }
    const have = shardedIds(dir);
    const fresh = [];
    for (const line of fs.readFileSync(src, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const id = idOf(line);
      if (have.has(id)) continue;
      have.add(id);                       // also dedupes WITHIN this run's new rows
      fresh.push(line);
    }
    if (!fresh.length) { console.log(`  ${name.padEnd(34)} up to date (${have.size} logs across ${shardsIn(dir).length} shard(s))`); continue; }
    fs.mkdirSync(dir, { recursive: true });
    /* NEVER OVERWRITE — two runs inside one minute must produce two shards, not one — and the
     * sequence number is ALWAYS present and zero-padded so that FILENAME ORDER IS CHRONOLOGICAL
     * ORDER, which is the only thing --restore-raw uses to replay them. A bare `<stamp>.jsonl.gz`
     * plus a `<stamp>-2.jsonl.gz` collision suffix sorts the SECOND shard first ('-' 0x2D sorts
     * before '.' 0x2E), silently replaying an append-only archive out of order. */
    const s = stamp(); let n = 0, out;
    do { out = path.join(dir, `${s}-${String(n++).padStart(2, '0')}.jsonl.gz`); } while (fs.existsSync(out));
    const body = Buffer.from(fresh.join('\n') + '\n', 'utf8');
    fs.writeFileSync(out, zlib.gzipSync(body, { level: 9 }));
    const g = fs.statSync(out).size;
    wroteAny++;
    console.log(`  ${name.padEnd(34)} +${fresh.length} log(s) -> ${path.relative(D, out)}  ${mb(body.length)} -> ${mb(g)} (${(100 * g / body.length).toFixed(1)}%)`);
  }
  console.log(`\n${wroteAny} raw shard(s) written. Shards are write-once: never rewritten, never compacted.`);
  process.exit(0);
}

if (RESTORERAW) {
  for (const name of RAW_STORES) {
    const dst = path.join(D, name), dir = shardDirFor(name);
    const files = shardsIn(dir);
    if (!files.length) { console.log(`  ${name.padEnd(34)} no shards under ${path.relative(D, dir)} — nothing to restore`); continue; }
    const seen = new Set(); const out = [];
    const take = line => { if (!line.trim()) return; const id = idOf(line); if (seen.has(id)) return; seen.add(id); out.push(line); };
    for (const f of files) for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n')) take(line);
    const before = out.length;
    /* Union with any local plain archive rather than clobbering it — the same reason --sync is an
     * append: a laptop can hold logs no shard has seen, and a restore must never be a deletion. */
    if (fs.existsSync(dst)) for (const line of fs.readFileSync(dst, 'utf8').split('\n')) take(line);
    fs.writeFileSync(dst, out.join('\n') + '\n');
    console.log(`  ${name.padEnd(34)} ${files.length} shard(s) -> ${before} log(s)`
      + (out.length > before ? ` + ${out.length - before} local-only` : '') + `  = ${out.length}`);
  }
  console.log('\nraw archives restored from their shards.');
  process.exit(0);
}

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
