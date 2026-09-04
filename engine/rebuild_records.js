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
 * THE ARCHIVE IS A STRICT SUPERSET OF THE STORE. IT IS NOT AN EQUAL-SIZED TWIN.
 * -----------------------------------------------------------------------------------------------
 * `durable-ingest.js`'s archiveThenStore() writes the log of EVERY fetched game and then applies
 * `rec.six.p1.length<4||rec.six.p2.length<4` when deciding a ROW. So a game the current parser
 * cannot read has a log and no record, permanently and on purpose — the log is the source of truth
 * and a future parser may read it.
 *
 * Two things in this file were written when archive==store was true and were wrong the moment it
 * stopped being:
 *
 *  1. NO COMPLETENESS FILTER. Rebuilding wrote a record for every archived log, so the rebuilt
 *     store would gain rows the ingest deliberately refuses — corrupting it with half-parsed games.
 *     MODE=reparse in durable-ingest.js applies the filter; so does this, now, and it must stay the
 *     SAME predicate (see `complete()` below).
 *  2. THE GUARD COUNTED. `written !== nStore` was an exact test only while every log produced a
 *     row. Under a superset it refuses forever, and — worse — it refuses HARDEST in the exact case
 *     this tool exists for: a parser fix that finally reads a game the old parser rejected RAISES
 *     `written`, and the count guard reads that success as a fault.
 *
 * WHAT THE GUARD IS ACTUALLY DEFENDING is LOSS: no game may leave the store because of a rebuild.
 * That is a question about IDs, not about totals — a count can balance while one id is dropped and
 * another gained — so it is now asked by id, which is strictly stronger than the count it replaces.
 * A GAIN is reported loudly and allowed, because a recovered game is the point.
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

/* THE COMPLETENESS RULE, COPIED FROM ITS ONE OWNER — durable-ingest.js's archiveThenStore() and its
 * MODE=reparse both spell it `rec.six.p1.length<4||rec.six.p2.length<4`. A record that fails it is a
 * game the ingest refuses to store, so a rebuild that emitted one would put a row in the store that
 * no ingest ever would. This is a DUPLICATED FACT and it is duplicated only because durable-ingest
 * does not export it; if the rule ever moves, it must move in both places. */
function complete(rec) {
  return !!rec && !!rec.six && (rec.six.p1 || []).length >= 4 && (rec.six.p2 || []).length >= 4;
}

/* Pass 1: keep only the metadata the record carries but the log does not (provenance). */
const meta = new Map();
const storeIds = new Set();
let nStore = 0, badBefore = 0;
eachLine(STORE, (line) => {
  const t = line.trim(); if (!t) return;
  let g; try { g = JSON.parse(t); } catch { return; }
  nStore++;
  storeIds.add(g.id);
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

let nRaw = 0, written = 0, badAfter = 0, missingMeta = 0, failed = 0, incomplete = 0, dupLogs = 0;
const rebuiltIds = new Set();
const BATCH = 200;
const buf = [];
eachLine(RAW, (line) => {
  const t = line.trim(); if (!t) return;
  let r; try { r = JSON.parse(t); } catch { return; }
  nRaw++;
  /* DEDUPE BY ID, FIRST OCCURRENCE WINS — the same rule the ingest's reparse uses. An unreadable
   * game is never in the store, so every ingest re-fetches and re-archives its log; the day a
   * parser learns to read it, an un-deduped rebuild would emit one row per archived copy. */
  if (rebuiltIds.has(r.id)) { dupLogs++; return; }
  let g;
  try { g = extract(r.id, r.uploadtime, r.log); } catch (e) { failed++; return; }
  if (!g) { failed++; return; }
  /* The ingest would not have stored this game, so neither may the rebuild. NOT silent: counted and
   * printed below, and cross-checked against the store's own ids by the loss guard. */
  if (!complete(g)) { incomplete++; return; }
  const m = meta.get(r.id);
  if (m) { Object.assign(g, m); } else { missingMeta++; }
  if (violations(g)) badAfter++;
  buf.push(JSON.stringify(g) + '\n');
  written++;
  rebuiltIds.add(r.id);
  if (buf.length >= BATCH) { fs.appendFileSync(TMP, buf.join('')); buf.length = 0; }
});
if (buf.length) fs.appendFileSync(TMP, buf.join(''));

/* THE TWO DIRECTIONS, NAMED SEPARATELY — a net count hides both. */
const dropped = [...storeIds].filter((id) => !rebuiltIds.has(id));
const recovered = [...rebuiltIds].filter((id) => !storeIds.has(id));

console.error(`raw logs: ${nRaw.toLocaleString()} | rebuilt ${written.toLocaleString()} records ` +
              `(store had ${nStore.toLocaleString()}; archive is a superset by design)`);
console.error(`  violations before: ${badBefore}   after: ${badAfter}`);
console.error(`  archived logs the parser still cannot store (six < 4): ${incomplete.toLocaleString()}`);
if (dupLogs) console.error(`  skipped ${dupLogs.toLocaleString()} duplicate archived log(s) (same id seen earlier)`);
if (recovered.length) console.error(`  RECOVERED: ${recovered.length.toLocaleString()} game(s) the old parser could not read now produce a record` +
                                    ` (e.g. ${recovered.slice(0, 3).join(', ')})`);
if (missingMeta) console.error(`  WARNING: ${missingMeta} log(s) had no matching store record — source/selfplay provenance is unavailable for those rows`);
if (failed) console.error(`  WARNING: ${failed} logs failed to parse`);

/* THE GUARD, ASKED BY ID. A rebuild may GAIN games (that is what a parser fix does) and may never
 * LOSE one. Counting could not tell those apart, and could balance a drop against a gain. */
if (dropped.length) {
  console.error(`REFUSING to swap: ${dropped.length} game(s) in the store would be LOST by this rebuild ` +
                `(no archived log, or the log no longer parses): ${dropped.slice(0, 5).join(', ')}` +
                `${dropped.length > 5 ? ', ...' : ''}. Left at ${path.relative(ROOT, TMP)}`);
  console.error(`  run MODE=backfill node engine/durable-ingest.js first if the archive is incomplete.`);
  process.exit(1);
}
if (badAfter > badBefore) {
  console.error(`REFUSING to swap: the rebuild made it WORSE (${badBefore} -> ${badAfter}). Left at ${path.relative(ROOT, TMP)}`);
  process.exit(1);
}
fs.renameSync(TMP, STORE);
console.error(`swapped in -> ${path.relative(ROOT, STORE)}`);
