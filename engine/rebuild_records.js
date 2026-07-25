/* rebuild_records.js — regenerate store records from the raw protocol logs.
 *
 * WHY THIS EXISTS
 * ---------------
 * The records and the raw logs are not independent data: the log is the source, and the record is a
 * PARSE of it. So whenever the parser is fixed, every record produced by the old parser is stale, and
 * the fix is not "re-run the expensive thing that produced the games" — the games are fine — it is
 * "re-parse the logs we already have".
 *
 * The case that prompted it: the first 200,004-game self-play corpus contained 5 records where
 * `brought` was not a subset of `six`. All five were Ditto teams. A transformed Ditto switching in is
 * logged as
 *
 *     |switch|p2a: Ditto|Sneasler, L50|131/131
 *
 * — nickname Ditto, species Sneasler — and the extractor took the species verbatim, putting the
 * OPPONENT'S Pokemon into this side's brought list. Regenerating 200k games would have cost 69
 * minutes of simulation; re-parsing the logs costs a couple of minutes and is exact, because
 * extract() is deterministic and the log is unchanged.
 *
 * The two files stay in step by ID, not by position: records are keyed and matched, and anything
 * present in one file and missing from the other is reported rather than silently dropped.
 *
 *   node engine/rebuild_records.js data/games.selfplay.jsonl        # writes alongside, then swaps
 *   node engine/rebuild_records.js data/games.selfplay.jsonl --check  # report only, change nothing
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { extract } = require('./durable-ingest.js');

const ROOT = path.join(__dirname, '..');
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const STORE = path.resolve(process.argv[2] || path.join(ROOT, 'data', 'games.selfplay.jsonl'));
const RAW = STORE.replace(/\.jsonl$/, '') + '.raw-logs.jsonl';
const CHECK = process.argv.includes('--check');

if (!fs.existsSync(STORE) || !fs.existsSync(RAW)) {
  console.error(`need both ${path.relative(ROOT, STORE)} and ${path.relative(ROOT, RAW)}`);
  process.exit(1);
}

/* Chunked line reader — these files run to gigabytes and V8 caps a single string at ~512MB. */
function eachLine(file, fn) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let carry = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      const lines = (carry + buf.toString('utf8', 0, n)).split('\n');
      carry = lines.pop();
      for (const l of lines) fn(l);
    }
    if (carry) fn(carry);
  } finally { fs.closeSync(fd); }
}

function violations(g) {
  let v = 0;
  for (const s of ['p1', 'p2']) {
    const six = new Set(((g.six || {})[s] || []).map(norm));
    const br = ((g.brought || {})[s] || []).map(norm);
    v += br.filter((x) => !six.has(x)).length;
    const ld = ((g.lead || {})[s] || []).map(norm);
    v += ld.filter((x) => !br.includes(x)).length;
  }
  return v;
}

/* Pass 1: keep only the metadata the record carries but the log does not (provenance). */
const meta = new Map();
let nStore = 0, badBefore = 0;
eachLine(STORE, (line) => {
  const t = line.trim(); if (!t) return;
  let g; try { g = JSON.parse(t); } catch { return; }
  nStore++;
  if (violations(g)) badBefore++;
  meta.set(g.id, { source: g.source, selfplay: g.selfplay, format: g.format });
});
console.error(`store: ${nStore.toLocaleString()} records, ${badBefore} with invariant violations`);

if (CHECK) {
  console.error(badBefore ? 'run without --check to rebuild' : 'nothing to do');
  process.exit(badBefore ? 1 : 0);
}

const TMP = STORE + '.rebuilt';
try { fs.unlinkSync(TMP); } catch (e) { /* fresh */ }

let nRaw = 0, written = 0, badAfter = 0, missingMeta = 0, failed = 0;
const BATCH = 200;
const buf = [];
eachLine(RAW, (line) => {
  const t = line.trim(); if (!t) return;
  let r; try { r = JSON.parse(t); } catch { return; }
  nRaw++;
  let g;
  try { g = extract(r.id, r.uploadtime, r.log); } catch (e) { failed++; return; }
  if (!g) { failed++; return; }
  const m = meta.get(r.id);
  if (m) { Object.assign(g, m); } else { missingMeta++; }
  if (violations(g)) badAfter++;
  buf.push(JSON.stringify(g) + '\n');
  written++;
  if (buf.length >= BATCH) { fs.appendFileSync(TMP, buf.join('')); buf.length = 0; }
});
if (buf.length) fs.appendFileSync(TMP, buf.join(''));

console.error(`raw logs: ${nRaw.toLocaleString()} | rebuilt ${written.toLocaleString()} records`);
console.error(`  violations before: ${badBefore}   after: ${badAfter}`);
if (missingMeta) console.error(`  WARNING: ${missingMeta} logs had no matching record (provenance not carried over)`);
if (failed) console.error(`  WARNING: ${failed} logs failed to parse`);

if (written !== nStore) {
  console.error(`REFUSING to swap: rebuilt ${written} but the store had ${nStore}. Left at ${path.relative(ROOT, TMP)}`);
  process.exit(1);
}
if (badAfter > badBefore) {
  console.error(`REFUSING to swap: the rebuild made it WORSE (${badBefore} -> ${badAfter}). Left at ${path.relative(ROOT, TMP)}`);
  process.exit(1);
}
fs.renameSync(TMP, STORE);
console.error(`swapped in -> ${path.relative(ROOT, STORE)}`);
