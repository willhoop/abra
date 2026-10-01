// RAW-STORE-OK: this REBUILDS a parsed store from its raw logs, so it reads and rewrites every row, dirty or not.
/* reparse_store.js — re-derive a parsed .jsonl.gz store from its raw-log shards with the CURRENT extractor.
 * 2026-10-01 (MEASURE, abra/regmc 1.52.0).
 *
 * WHY A NEW FILE. The parsed store is a derived view of the raw logs (STORE RAW, ANALYSE ON TOP), so a parser
 * fix is a re-parse, never a re-pull. The three existing rebuild paths cannot do it for a Reg M-C store:
 * `MODE=reparse node engine/durable-ingest.js` and engine/reprocess.js read ONE plain `<store>.raw-logs.jsonl`
 * (for Reg M-C that file stopped growing on 2026-09-09; the logs since are dated shards under
 * data/raw/games.<format>/), and all three slurp whole files into memory. This one streams.
 *
 *   node engine/reparse_store.js --store <data>/data/games.<fmt>.jsonl.gz --raw <data>/data/raw/games.<fmt> \
 *        [--raw-plain <data>/data/games.<fmt>.raw-logs.jsonl] [--write]
 *
 * Without --write it changes nothing and reports what a re-parse WOULD change: rows read, rows whose bytes
 * differ, and which top-level fields moved. With --write it writes `<store>.reparsed` (a .jsonl.gz) BESIDE the
 * store and never touches the store itself; swapping it in is a separate, visible step (docs/MEASURE.md, OWED).
 *
 * WHAT IT GUARANTEES, because a rebuild that loses a row loses a game that may never be re-fetchable:
 *   - the output has exactly the store's ids, in the store's order (checked, by id, before it exits 0);
 *   - a row with no raw log is carried over byte for byte and counted, never dropped;
 *   - a row the current extractor would refuse (fewer than four in either preview: durable-ingest.js's own
 *     row filter) is carried over byte for byte and counted;
 *   - the first occurrence of an id in the raw logs wins, the store's rule.
 * MEMORY: ids and byte offsets only. Pass 1 reads the store's ids; pass 2 streams the raw logs, writes each
 * re-parsed row to a temp file and keeps its offset; pass 3 streams the store again and emits each row in order.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const readline = require('readline');
const { extract } = require('./durable-ingest.js');

const argv = process.argv.slice(2);
const flag = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STORE = flag('--store'), RAW = flag('--raw'), RAWPLAIN = flag('--raw-plain'), WRITE = argv.includes('--write');
if (!STORE || !RAW || !/\.jsonl\.gz$/.test(STORE)) {
  console.error('usage: node engine/reparse_store.js --store <games.X.jsonl.gz> --raw <raw shard dir> [--raw-plain <file>] [--write]');
  process.exit(2);
}
for (const f of [STORE, RAW]) if (!fs.existsSync(f)) { console.error('reparse_store: REFUSING -- no ' + f); process.exit(2); }

async function* lines(f) {
  const s = fs.createReadStream(f);
  const rl = readline.createInterface({ input: /\.gz$/.test(f) ? s.pipe(zlib.createGunzip()) : s, crlfDelay: Infinity });
  for await (const l of rl) yield l;
}
const idOf = l => (/^\{"id":"([^"]+)"/.exec(l) || [])[1] || null;

(async () => {
  // pass 1: the store's ids
  const want = new Set(); let rows = 0, dupInStore = 0;
  for await (const l of lines(STORE)) { if (!l) continue; rows++; const id = idOf(l); if (!id) { console.error('reparse_store: REFUSING -- a store row has no leading id (row ' + rows + ')'); process.exit(1); } if (want.has(id)) dupInStore++; want.add(id); }
  // pass 2: re-parse every stored id that has a raw log
  const raws = fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl.gz')).sort().map(f => path.join(RAW, f));
  if (RAWPLAIN && fs.existsSync(RAWPLAIN)) raws.push(RAWPLAIN);
  const tmp = path.join(os.tmpdir(), 'reparse-' + process.pid + '-' + path.basename(STORE) + '.tmp');   // never beside the store: a dry run writes nothing there
  const fd = fs.openSync(tmp, 'w');
  const at = new Map(); let pos = 0, refused = 0;
  for (const f of raws) for await (const l of lines(f)) {
    if (!l) continue;
    const m = /"id":"([^"]+)"/.exec(l); if (!m || !want.has(m[1]) || at.has(m[1])) continue;
    const r = JSON.parse(l);
    const rec = extract(r.id, r.uploadtime, r.log);
    if (rec.six.p1.length < 4 || rec.six.p2.length < 4) { refused++; at.set(r.id, null); continue; }
    const b = Buffer.from(JSON.stringify(rec) + '\n', 'utf8');
    fs.writeSync(fd, b); at.set(r.id, [pos, b.length]); pos += b.length;
  }
  fs.closeSync(fd);
  // pass 3: the store's order, each row replaced by its re-parse where there is one
  const rfd = fs.openSync(tmp, 'r');
  const out = WRITE ? zlib.createGzip({ level: 9 }) : null;
  const outFile = STORE + '.reparsed';
  const sink = out ? out.pipe(fs.createWriteStream(outFile)) : null;
  const emitted = new Set(); let n = 0, changed = 0, carriedNoLog = 0, carriedRefused = 0; const fields = {};
  for await (const l of lines(STORE)) {
    if (!l) continue;
    const id = idOf(l); if (emitted.has(id)) continue;      // a duplicate id in the store: first occurrence wins
    emitted.add(id); n++;
    let row = l;
    const loc = at.get(id);
    if (loc === undefined) carriedNoLog++;
    else if (loc === null) carriedRefused++;
    else {
      const b = Buffer.alloc(loc[1]); fs.readSync(rfd, b, 0, loc[1], loc[0]);
      row = b.toString('utf8').replace(/\n$/, '');
      if (row !== l) {
        changed++;
        const o = JSON.parse(l), x = JSON.parse(row);
        for (const k of new Set([...Object.keys(o), ...Object.keys(x)])) if (JSON.stringify(o[k]) !== JSON.stringify(x[k])) fields[k] = (fields[k] || 0) + 1;
      }
    }
    if (out && !out.write(row + '\n')) await new Promise(r => out.once('drain', r));
  }
  fs.closeSync(rfd); fs.unlinkSync(tmp);
  if (out) { out.end(); await new Promise((res, rej) => { sink.on('finish', res); sink.on('error', rej); }); }
  const lost = [...want].filter(id => !emitted.has(id)).length;
  const report = { store: STORE.replace(/\\/g, '/'), rows_read: rows, unique_ids: want.size, duplicate_ids_in_store: dupInStore, raw_files: raws.length,
    rows_emitted: n, rows_changed: changed, fields_changed: fields, carried_no_raw_log: carriedNoLog, carried_extractor_refused: carriedRefused,
    lost_ids: lost, wrote: WRITE ? outFile.replace(/\\/g, '/') : null };
  console.log(JSON.stringify(report, null, 1));
  if (lost || n !== want.size) { console.error('reparse_store: FAILED -- ' + lost + ' id(s) would be lost'); if (WRITE) fs.unlinkSync(outFile); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
