// RAW-STORE-OK: byte-for-byte compression of the store. A filter here would corrupt the archive.
/* compress-stores.js — write the compressed shards that git actually tracks.
 *
 *   node build/compress-stores.js                    # shard any parsed store row git does not have
 *   node build/compress-stores.js --check            # exit 1 if the shards lag a store OR lost an id HEAD~1 tracked; changes nothing
 *   node build/compress-stores.js --verify-parsed    # reassemble to a temp dir, sha256 vs the store
 *   node build/compress-stores.js --restore-parsed   # rebuild the plain parsed stores from shards
 *   node build/compress-stores.js --raw              # append this run's NEW raw logs as a dated shard
 *   node build/compress-stores.js --restore-raw      # rebuild the plain raw archives from their shards
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
 * THAT BOUGHT FOURTEEN MONTHS AND THEN RAN OUT — 2026-09-06.
 * ----------------------------------------------------------
 * One .gz per store is a MONOLITH. Measured 2026-09-06:
 *
 *     data/games.ladder.jsonl.gz   54,323,899 B, growing 1.12 MB/day
 *
 * which crosses the same HARD 100 MB single-file limit around 2026-10-17 and takes the ingest Action
 * down with it — the identical failure, one layer up, on a deadline. THAT LIMIT IS THE WHOLE
 * ARGUMENT. It is a per-file wall with a date on it, and no amount of compression moves it again.
 *
 * A SECOND ARGUMENT WAS DRAFTED HERE AND IS RETRACTED, BECAUSE IT WAS TYPED RATHER THAN MEASURED.
 * It said: gzip has no append, so the blob is rewritten whole every six hours and the pack gains a
 * fresh ~54 MB object four times a day. The first clause is true and the conclusion is false.
 * Measured over the actual history on 2026-09-06:
 *
 *     data/games.ladder.jsonl.gz   59 distinct blobs   2,650.8 MB raw ->  91.5 MB packed
 *     data/games.bo3.jsonl.gz      59 distinct blobs   1,192.9 MB raw ->  43.0 MB packed
 *     data/games.ots.jsonl.gz       2 distinct blobs       6.8 MB raw ->   3.4 MB packed
 *
 * ~1.55 MB of pack per ladder version, not 54 MB. Git deltas these well precisely BECAUSE the store
 * is append-only: two gzip runs over the same settings share a long identical deflate prefix, so
 * consecutive blobs differ mostly at the tail. The three still hold 137.9 MB of a 524.28 MiB pack —
 * 26% — and untracking them recovers NONE of it, because history cannot be vacuumed. Shards are
 * cheaper per run (~0.35 MB against ~2.28 MB, ~6.5x) and that is a nice-to-have. The wall is the
 * reason.
 *
 * So the parsed stores move to the SAME SHAPE the raw logs have used since 2026-09-04: one small
 * write-once gzip per ingest run, named for the moment it was cut, under data/parsed/<store>/. Git
 * stores each exactly once and never rewrites it. No shard can approach the limit — SHARD_BYTES caps
 * a shard at 32 MB of source, ~4.5 MB compressed, and the cap is on the SOURCE bytes rather than on
 * a row count so that a store whose rows get fatter cannot drift back toward the wall.
 *
 * NOTHING THAT READS THE STORE CHANGES. Every reader in this repository reads the plain `.jsonl`;
 * the compressed form has only ever been git transport. The store is neither re-filtered nor
 * re-pulled — `--restore-parsed` writes exactly the bytes that were sharded.
 *
 * THE CUTOVER WAS CHECKED BEFORE ANYTHING WAS UNTRACKED, and `--verify-parsed` is that check, kept
 * so it can be re-run rather than remembered: reassemble the shards into a temp directory and
 * sha256 the result against the live store. Byte-identical or it exits 1. Measured 2026-09-06 on all
 * three stores — ladder 383,723,981 B / 76,833 rows, bo3 227,347,410 B / 25,522 rows, ots
 * 31,928,037 B / 4,167 rows (CRLF throughout, which is exactly why the shard path works on Buffers
 * and never re-encodes a line).
 *
 * THE STALENESS CHECK IS THE POINT. A tracked archive that silently lags the store it claims to
 * mirror is the project's recurring defect — something absent while appearing present — and here it
 * would mean a fresh clone reproducing numbers from games that have since been superseded. `--check`
 * is what CI and the pre-commit path should call; it reports rather than repairs. It compares ROW
 * COUNTS, not mtimes: "newer than its source" is no evidence at all (CLAUDE.md), and it was mtimes
 * that let a void artifact mark itself `ok`.
 *
 * THE RETIRED MONOLITHS. data/games.*.jsonl.gz are no longer written and no longer tracked. Any copy
 * left on disk is a snapshot of 2026-09-06 that nothing maintains, so `--check` names it rather than
 * letting it sit there looking current. A fresh clone materialises the stores with
 * `node build/compress-stores.js --restore-parsed`.
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
const RAW_DIR = path.join(D, 'raw');
/* THE NEXT-REGULATION RAW LOGS, WHOSE STORE NAMES DO NOT EXIST UNTIL SHOWDOWN SHIPS THE FORMAT.
 * engine/next_regulation_ingest.js writes data/games.<formatid>.jsonl and, through the same
 * durable-ingest.js rule, data/games.<formatid>.raw-logs.jsonl. Those raw logs are gitignored like
 * the others and until 2026-09-09 nothing sharded them, so every log CI collected for a new
 * regulation lived on one runner for one job and was gone — the exact hole the raw shards were built
 * to close, open again for the one corpus that cannot be re-fetched later. DERIVED FROM DISK, never
 * typed: a plain archive under data/, or a shard directory already under data/raw/ (a fresh runner
 * has the shards and not the plain file). The shape is the collector's own file name. */
const NEXT_REG_RAW = (() => {
  const s = new Set();
  try { for (const f of fs.readdirSync(D)) if (/^games\.gen9champions[a-z0-9]+\.raw-logs\.jsonl$/.test(f)) s.add(f); } catch (e) { /* no data dir */ }
  try { for (const f of fs.readdirSync(RAW_DIR)) if (/^games\.gen9champions[a-z0-9]+$/.test(f)) s.add(f + '.raw-logs.jsonl'); } catch (e) { /* no shards yet */ }
  return [...s].sort();
})();
const RAW_STORES = STORES.map(s => s.replace(/\.jsonl$/, '') + '.raw-logs.jsonl').concat(NEXT_REG_RAW);
const PARSED_DIR = path.join(D, 'parsed');
const CHECK = process.argv.includes('--check');
const SYNC  = process.argv.includes('--sync');
const RAW        = process.argv.includes('--raw');
const RESTORERAW = process.argv.includes('--restore-raw');
const RESTOREPARSED = process.argv.includes('--restore-parsed');
const VERIFYPARSED  = process.argv.includes('--verify-parsed');

const mb = b => (b / 1048576).toFixed(1) + ' MB';
/* Counted on the buffer rather than by splitting a 288 MB string into an array of 64,000. */
const countLines = buf => {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return buf.length && buf[buf.length - 1] !== 10 ? n + 1 : n;
};

/* ---- THE SHARD PATH WORKS ON BUFFERS, AND THAT IS NOT FASTIDIOUSNESS ---------------------------
 *
 * `--sync` and `--restore-raw` above split a utf8 STRING on '\n' and re-join it. That survives only
 * because a round trip through utf8 happens to be lossless for the bytes those files hold. The
 * parsed stores are the one place in this repository where a byte has to come back EXACTLY as it
 * went in, because the cutover claim is a sha256 equality, so nothing here decodes a line at all.
 *
 * MEASURED 2026-09-06, and it is not hypothetical: data/games.ots.jsonl is CRLF on all 4,167 of its
 * rows while ladder and bo3 are LF on all 102,355 of theirs. A line here therefore INCLUDES its own
 * terminator — whatever that terminator is — so reassembly is a concatenation and cannot invent,
 * drop or translate one. `\r` is content, not formatting.
 *
 * The id is ASCII (`gen9...-1234567890`), so it is read through latin1, which is a 1:1 byte->char
 * map that cannot throw and cannot replace a byte with U+FFFD. utf8 can do both. */
function* linesOf(buf) {
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 10) continue;
    yield buf.subarray(start, i + 1);        // INCLUDES the '\n', and the '\r' before it if present
    start = i + 1;
  }
  /* A trailing fragment is a store caught mid-append. Yield it as-is rather than completing it: the
   * callers refuse such a file outright, and silently adding a terminator is how a "byte-identical"
   * claim becomes a lie. */
  if (start < buf.length) yield buf.subarray(start);
}
const idOfBuf = line => {
  const m = line.toString('latin1').match(/"id":"([^"]+)"/);
  return m ? m[1] : line.toString('latin1');
};
const isBlank = line => {
  for (let i = 0; i < line.length; i++) if (line[i] !== 10 && line[i] !== 13 && line[i] !== 32 && line[i] !== 9) return false;
  return true;
};
const sha256 = buf => require('crypto').createHash('sha256').update(buf).digest('hex');

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
const shardBytesOnDisk = dir => shardsIn(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
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

/* ================================================================================================
 * THE PARSED STORES BECOME SHARDS TOO — 2026-09-06
 * ================================================================================================
 *
 * Same shape as the raw shards directly above, same reasons, one extra obligation: the raw archive
 * only has to be a SET, whereas the parsed store has to come back BYTE-FOR-BYTE, because that is
 * what makes the cutover checkable rather than believed. See --verify-parsed.
 *
 * A SHARD IS NEVER REWRITTEN AND NEVER DELETED. NO COMPACTION. Identical rule to the raw shards,
 * and for the identical reason: compaction turns an append-only history into a mutable one.
 */
const SHARD_BYTES = 32 * 1024 * 1024;   // of SOURCE, so a fatter row cannot walk the shard toward 100 MB
const parsedDirFor = store => path.join(PARSED_DIR, store.replace(/\.jsonl$/, ''));

/* Every row id already inside the shards, and the row count behind it. One pass, so a caller that
 * wants both does not gunzip 54 MB twice. */
function shardedRows(dir) {
  const ids = new Set();
  let rows = 0, bytes = 0;
  for (const f of shardsIn(dir)) {
    const body = zlib.gunzipSync(fs.readFileSync(path.join(dir, f)));
    bytes += body.length;
    for (const line of linesOf(body)) {
      if (isBlank(line)) continue;
      ids.add(idOfBuf(line));
      rows++;
    }
  }
  return { ids, rows, bytes, shards: shardsIn(dir).length };
}

/* THE CHECK THAT WOULD HAVE CAUGHT 2026-09-06. The cutover (18432bcb) sharded a LOCAL plain file
 * that was two weeks behind origin, and --verify-parsed proved the shards byte-identical TO THAT
 * FILE — so 11,110 ladder and 4,752 bo3 games that d2a418a5 tracked left the tracked store with
 * every check green. The comparison nobody made was tracked-now against tracked-before. This reads
 * the ids git TRACKED one commit ago — both forms, the shards and the retired monolith, so a cutover
 * between forms is inside the claim — and never the local file, because the local file was the thing
 * that was wrong. It THROWS rather than skips when HEAD~1 cannot be read (a shallow clone), because
 * a check that quietly passes on missing history is the shape of failure it exists to catch.
 *
 * COST. `--check` used to count newlines instead of building the id set, on a 2026-09-06 measurement
 * of 58 s for shardedRows(). Re-measured 2026-09-09 on the same code: 2.2 s ladder, 1.4 s bo3, and
 * `git show` of all 45 tracked blobs 2.2 s — so the whole --check is ~10 s, and it now builds the id
 * set it needs. */
function trackedIds(rev, store) {
  const cp = require('child_process');
  const ROOT = path.join(__dirname, '..');
  const git = args => {
    const r = cp.spawnSync('git', args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (no ${rev}? shallow clone?): ${String(r.stderr).trim()}`);
    return r.stdout;
  };
  const shardDir = path.relative(ROOT, parsedDirFor(store)).split(path.sep).join('/');
  const paths = git(['ls-tree', '-r', '--full-tree', '--name-only', rev, '--', shardDir, `data/${store}.gz`])
    .toString('utf8').split('\n').filter(Boolean);
  const ids = new Set();
  for (const p of paths) for (const line of linesOf(zlib.gunzipSync(git(['show', `${rev}:${p}`])))) if (!isBlank(line)) ids.add(idOfBuf(line));
  return ids;
}

/* Reassemble a store from its shards into `dst`.
 *
 * `unionPlain` is the same claim --sync and --restore-raw make and it is load-bearing: a laptop can
 * hold games origin has not seen, so a restore must never be a deletion. It is OFF for --verify-parsed,
 * because the question there is whether the SHARDS ALONE reproduce the store — unioning the store
 * back in would make the check pass by construction, which is the "a green test asking nothing"
 * shape this repository has a rule about. */
function reassembleParsed(store, dst, unionPlain) {
  const dir = parsedDirFor(store);
  const files = shardsIn(dir);
  if (!files.length) return null;
  const seen = new Set();
  const tmp = dst + '.reassembling';
  const fd = fs.openSync(tmp, 'w');
  let rows = 0, dupes = 0, localOnly = 0;
  const emit = line => {
    if (isBlank(line)) return;
    const id = idOfBuf(line);
    if (seen.has(id)) { dupes++; return; }
    seen.add(id);
    fs.writeSync(fd, line);
    rows++;
  };
  for (const f of files) for (const line of linesOf(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))) emit(line);
  if (unionPlain && fs.existsSync(path.join(D, store))) {
    const before = rows;
    for (const line of linesOf(fs.readFileSync(path.join(D, store)))) emit(line);
    localOnly = rows - before;
  }
  fs.closeSync(fd);
  fs.renameSync(tmp, dst);
  return { rows, dupes, localOnly, shards: files.length };
}

if (VERIFYPARSED) {
  /* THE CUTOVER CHECK. Nothing may be untracked until this is green on every store. */
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'abra-parsed-verify-'));
  let bad = 0, checked = 0;
  for (const store of STORES) {
    const live = path.join(D, store);
    if (!fs.existsSync(live)) { console.log(`  ${store.padEnd(20)} no plain store here — nothing to verify against`); continue; }
    const r = reassembleParsed(store, path.join(tmpDir, store), false);
    if (!r) { console.error(`  ${store.padEnd(20)} NO SHARDS — the store is not carried by git at all`); bad++; continue; }
    checked++;
    const a = fs.readFileSync(live), b = fs.readFileSync(path.join(tmpDir, store));
    const ha = sha256(a), hb = sha256(b);
    if (ha === hb) {
      console.log(`  ${store.padEnd(20)} IDENTICAL  ${r.shards} shard(s) -> ${r.rows} rows, ${a.length} B, sha256 ${ha.slice(0, 16)}`);
    } else {
      bad++;
      console.error(`  ${store.padEnd(20)} DIFFERS — store ${a.length} B sha ${ha.slice(0, 16)}, `
        + `reassembly ${b.length} B sha ${hb.slice(0, 16)} (${r.shards} shard(s), ${r.rows} rows, ${r.dupes} duplicate id(s))`);
    }
    fs.unlinkSync(path.join(tmpDir, store));
  }
  fs.rmdirSync(tmpDir);
  if (!checked) { console.error('\nNOTHING WAS VERIFIED — this is not a pass.'); process.exit(1); }
  if (bad) { console.error(`\n${bad} store(s) do NOT reassemble byte-identically. DO NOT UNTRACK ANYTHING.`); process.exit(1); }
  console.log(`\n${checked} store(s) reassemble byte-identically from their shards.`);
  process.exit(0);
}

/* `--sync` IS THE SAME OPERATION AND IS KEPT AS ITS NAME.
 *
 * It meant: pull origin's games down into the local store. The Action appends on GitHub every six
 * hours and the local plain .jsonl only grows when someone runs the ingest here, so the two diverge
 * in BOTH directions and neither is a superset. It read the monolithic .gz; the shards are now what
 * origin carries, and the union-by-id it did is exactly what reassembleParsed(..., true) does —
 * origin's rows first, local-only rows appended, first occurrence wins, idempotent, and the result
 * cannot be smaller than either side. One implementation, not two. */
if (RESTOREPARSED || SYNC) {
  for (const store of STORES) {
    const dst = path.join(D, store);
    const r = reassembleParsed(store, dst, true);
    if (!r) { console.log(`  ${store.padEnd(20)} no shards under ${path.relative(D, parsedDirFor(store))} — nothing to restore`); continue; }
    console.log(`  ${store.padEnd(20)} ${r.shards} shard(s) -> ${r.rows} rows`
      + (r.localOnly ? ` (incl. ${r.localOnly} local-only)` : '')
      + `  ${mb(fs.statSync(dst).size)}`);
  }
  console.log('\nparsed stores restored from their shards.');
  process.exit(0);
}

/* ---- THE DEFAULT RUN: SHARD WHATEVER GIT DOES NOT ALREADY HAVE ---------------------------------
 *
 * This used to rewrite `<store>.jsonl.gz` whole. It no longer writes that file at all; see the
 * header. The invariants it carried are kept, not dropped:
 *   - the SHRINK GUARD (2026-08-21) still refuses when the tracked side holds more records than the
 *     local store, because that means the local file is BEHIND and writing would publish a loss;
 *   - `--check` still reports rather than repairs, and now compares ROW COUNTS instead of mtimes. */
let stale = 0, wrote = 0, missing = 0, retired = 0, lost = 0;

for (const name of STORES) {
  const src = path.join(D, name), gz = src + '.gz', dir = parsedDirFor(name);
  const label = name.padEnd(20);

  /* A retired monolith left on disk is the "silently lagging archive" this file's header is about:
   * engine/quality.js still falls back to `<store>.jsonl.gz` when the plain store is missing, so a
   * stale copy would be served as though it were the corpus. Nothing here deletes it — say it. */
  if (fs.existsSync(gz)) retired++;

  if (!fs.existsSync(src)) {
    if (shardsIn(dir).length) {
      console.log(`  ${label} shards only — fresh clone. Run: node build/compress-stores.js --restore-parsed`);
    } else { console.log(`  ${label} ABSENT (no .jsonl and no shards under ${path.relative(D, dir)})`); missing++; }
    continue;
  }

  const raw = fs.readFileSync(src);
  /* A store caught mid-append is not something to snapshot. Refusing is the whole reason
   * `linesOf` does not quietly complete a trailing fragment. */
  if (raw.length && raw[raw.length - 1] !== 10) {
    console.error(`\n  ${label} REFUSING — the store does not end in a newline, so it is being `
      + `written right now. Re-run when the collector has finished.`);
    process.exit(1);
  }
  const srcLines = countLines(raw);
  const have = shardedRows(dir);

  /* THE SHRINK GUARD — 2026-08-21, carried over verbatim in intent. The Action appends on GitHub
   * every six hours, so the tracked side routinely holds MORE games than a laptop's plain .jsonl,
   * which only grows when someone runs the ingest here. These stores are append-only and deduped by
   * id, so record count is monotonic BY CONSTRUCTION: shards holding more rows than the source is
   * never a legitimate state, it is proof the local file is BEHIND.
   *
   * MEASURED THE DAY THAT GUARD WAS WRITTEN: the first green Action run took the ladder store
   * 64,021 -> 64,491 while the local plain file sat at 64,021. Publishing from the older local file
   * at that moment would have thrown away 470 games and reported success. */
  if (have.rows > srcLines) {
    console.error(`\n  ${label} REFUSING TO SHARD — the tracked shards hold MORE records than the `
      + `local store: ${have.rows} vs ${srcLines}.`);
    console.error(`  These stores are append-only and deduped by id, so this is never a legitimate`);
    console.error(`  update — the local file is BEHIND. Reconcile first:\n`);
    console.error(`      node build/compress-stores.js --restore-parsed   # union the shards into the local store\n`);
    process.exit(1);
  }

  /* `--check` stops here. Two questions, both answered against what is TRACKED: did the tracked
   * store lose an id since the last commit (trackedIds), and does every store row have a shard. */
  if (CHECK) {
    const prev = trackedIds('HEAD~1', name);
    let gone = 0;
    for (const id of prev) if (!have.ids.has(id)) gone++;
    if (gone) {
      lost++;
      console.error(`  ${label} LOST ${gone} id(s) that HEAD~1 tracked (${prev.size} then, ${have.ids.size} in the shards now). `
        + `Do not commit — this is the 2026-09-06 shape; recover from history, never from the local file.`);
    } else {
      console.log(`  ${label} carries every id HEAD~1 tracked (${prev.size})`);
    }
    if (have.rows === srcLines) { console.log(`  ${label} up to date (${have.rows} rows across ${have.shards} shard(s), ${mb(shardBytesOnDisk(dir))})`); continue; }
    stale++;
    console.log(`  ${label} STALE — ${srcLines - have.rows} row(s) of the store are in no shard`);
    continue;
  }

  const fresh = [];
  let freshBytes = 0;
  for (const line of linesOf(raw)) {
    if (isBlank(line)) continue;
    const id = idOfBuf(line);
    if (have.ids.has(id)) continue;
    have.ids.add(id);                     // also dedupes WITHIN this run's new rows
    fresh.push(line);
    freshBytes += line.length;
  }

  if (!fresh.length) { console.log(`  ${label} up to date (${have.rows} rows across ${have.shards} shard(s), ${mb(shardBytesOnDisk(dir))})`); continue; }
  stale++;

  fs.mkdirSync(dir, { recursive: true });
  /* NEVER OVERWRITE, and ALWAYS zero-pad the sequence, for the reason spelled out on the raw shards:
   * a bare `<stamp>.jsonl.gz` beside a `<stamp>-2.jsonl.gz` sorts the SECOND shard first ('-' 0x2D
   * before '.' 0x2E) and would replay an append-only archive out of order. Filename order IS
   * chronological order and it is the only thing --restore-parsed uses. */
  const s = stamp();
  let n = 0, out;
  const nextPath = () => { do { out = path.join(dir, `${s}-${String(n++).padStart(2, '0')}.jsonl.gz`); } while (fs.existsSync(out)); return out; };
  let chunk = [], chunkBytes = 0, written = 0;
  const flush = () => {
    if (!chunk.length) return;
    const body = Buffer.concat(chunk);
    const p = nextPath();
    fs.writeFileSync(p, zlib.gzipSync(body, { level: 9 }));
    console.log(`  ${label} ${chunk.length} row(s) -> ${path.relative(D, p)}  ${mb(body.length)} -> ${mb(fs.statSync(p).size)}`);
    written += chunk.length; chunk = []; chunkBytes = 0;
  };
  for (const line of fresh) {
    chunk.push(line); chunkBytes += line.length;
    if (chunkBytes >= SHARD_BYTES) flush();
  }
  flush();
  wrote++;
  console.log(`  ${label} +${written} row(s) sharded (${freshBytes === 0 ? 0 : mb(freshBytes)} of source)`);
}

/* SAID BEFORE ANY EXIT, not after the happy path. A stale-shard run is exactly when someone is
 * looking at this output, and it is also exactly when a leftover monolith is most likely to be
 * mistaken for the current archive. */
if (retired) {
  console.log(`\n${retired} retired monolithic .gz still on disk (untracked 2026-09-06, nothing updates them).`);
  console.log('They are NOT deleted here. engine/quality.js falls back to one when the plain store is');
  console.log('missing, so remove them by hand once the plain stores are materialised.');
}
if (missing) { console.error(`\n${missing} store(s) absent entirely.`); process.exit(1); }
if (CHECK && lost) {
  console.error(`\n${lost} store(s) LOST ids that HEAD~1 tracked. Nothing may be committed until they are back.`);
  process.exit(1);
}
if (CHECK && stale) {
  console.error(`\n${stale} store(s) have rows in no shard. Run: node build/compress-stores.js`);
  process.exit(1);
}
console.log(CHECK ? '\nevery store row is carried by a shard.' : `\n${wrote} store(s) sharded.`);
