/* next_regulation_ingest.js — COLLECT THE NEXT REGULATION FROM DAY ONE, WITH NO CODE EDIT.
 *
 * WHAT THIS IS FOR
 * ----------------
 * Showdown's public replay pool is a ROLLING window — the ingest workflow's own comment measures it
 * at ~1,250 per format, filling in ~18 h at peak on the ladder. Anything that ages out between
 * pulls is GONE; no later pull can reach it. So the first day or two of a new regulation is not
 * recoverable later, and "we will point the collector at it when it lands" is a decision that
 * silently costs the opening of the metagame.
 *
 * This runs every six hours from now. Today it collects nothing and SAYS SO. On the day the format
 * appears on the Showdown server, it starts collecting on the next scheduled run, with nobody
 * editing anything.
 *
 * WHAT DECIDES WHICH FORMAT
 * -------------------------
 * engine/next_regulation.js, which derives the format set from the live server's format list and
 * the local dex at run time and compares it against data/regulations.json. NO FORMAT ID IS TYPED
 * ANYWHERE IN THIS PAIR OF FILES. A format id invented ahead of time would be a guess wearing the
 * authority of a constant, and the way this project fails is that a guess and a fact look the same
 * once they are on disk.
 *
 * ONE STORE PER FORMAT ID, NEVER POOLED
 * -------------------------------------
 *     data/games.<formatid>.jsonl        e.g. data/games.<the new format's id>.jsonl
 *
 * The file name IS the format id, so a store cannot be ambiguous about what is in it and two
 * regulations cannot share a file. That is the same separation games.ladder.jsonl and
 * games.bo3.jsonl already have and for the same reason: bo1 and bo3 are different information
 * regimes and pooling them would change every behavioural statistic silently.
 *
 * The rows are written by engine/durable-ingest.js — the same extractor, unchanged — and the raw
 * logs are archived beside each store, so STORE RAW / ANALYSE ON TOP holds and any new field is a
 * re-parse rather than a re-fetch.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It never touches data/games.ladder.jsonl, data/games.bo3.jsonl or data/games.ots.jsonl, and it
 * never edits data/regulations.json. Flipping `active` re-points the LADDER collector, which is the
 * one edit that could stop the existing corpus growing; it prints the block to paste and leaves the
 * decision to a person.
 *
 *   node engine/next_regulation_ingest.js               detect, collect what is new, write the artifact
 *   node engine/next_regulation_ingest.js --dry-run     detect and report; fetch nothing
 *   node engine/next_regulation_ingest.js --format <id> collect ONE named format (the rehearsal path)
 *   node engine/next_regulation_ingest.js --reconcile   no network: merge each store with its .gz,
 *                                                       dedupe by id, rewrite both
 *   node engine/next_regulation_ingest.js --no-net      detect from the local dex only
 *   node engine/next_regulation_ingest.js --force-write restamp the artifact even if nothing moved
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, 'data', ...p);
const OUT = D('next-regulation.json');
const NR = require('./next_regulation.js');

const PAGES = process.env.PAGES || '25';
const CONC  = process.env.CONC  || '20';

/* Counted, printed, and written to the artifact. A capability that cannot prove it ran is assumed
 * broken (CLAUDE.md, 2026-07-28), and this one will spend two weeks doing nothing on purpose —
 * which is exactly the state that is indistinguishable from being dead. */
const PROBLEMS = [];
const failedTo = (what, e) => { const m = what + ': ' + ((e && e.message) || String(e)); PROBLEMS.push(m); console.log('  ::error::' + m); };

const storeFor = id => D('games.' + id + '.jsonl');

function countLines(p) {
  if (!fs.existsSync(p)) return 0;
  const buf = fs.readFileSync(p);
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return buf.length && buf[buf.length - 1] !== 10 ? n + 1 : n;
}

/* ---- RECONCILE — the append-and-dedupe the ingest workflow already uses on the ladder ------------
 *
 * The workflow's push-retry loop does `git reset --hard origin/main`, which restores origin's
 * COMPRESSED store and leaves the ignored plain file alone. Recompressing the plain file at that
 * point would publish OUR copy over origin's and lose whatever another run pushed in between. So
 * the two are merged the way the ladder is merged: origin's rows first, ours appended, first
 * occurrence of each id wins. Idempotent, and the result cannot be smaller than either input.
 *
 * `merge=union` is NOT how this is done and must never be — it replays the appended block and
 * duplicated the store four times (.gitattributes, CHANGELOG 3.1.2).
 *
 * FIRST OCCURRENCE WINS, WHICH MEANS THE .gz's COPY OF A ROW BEATS OURS. That matches what
 * engine/dedupe_store.py already does to the ladder, and it is right for a push race. It is WRONG
 * after a `MODE=reparse`, which rewrites row CONTENT under unchanged ids: reconciling straight
 * afterwards silently restores the pre-reparse rows from the .gz. Observed here on 2026-08-31.
 * Delete the .gz first, then reparse, then reconcile. */
function reconcile(store) {
  /* Defence in depth after the bug recorded in ownStores(): handed a .gz, everything below reads a
   * binary as text and writes it back as text, which is a silent archive loss rather than an error. */
  if (/\.gz$/.test(store)) {
    failedTo('reconcile ' + path.basename(store), 'given a .gz path; reconcile takes the PLAIN store');
    return { store: path.basename(store), rows: 0, before: 0, wrote: false, reason: 'gz path refused' };
  }
  const gz = store + '.gz';
  const rows = [];
  const seen = new Set();
  let fromGz = 0, fromPlain = 0;
  const take = (line, which) => {
    if (!line.trim()) return;
    const m = line.match(/"id":"([^"]+)"/);
    const key = m ? m[1] : line;
    if (seen.has(key)) return;
    seen.add(key); rows.push(line);
    if (which === 'gz') fromGz++; else fromPlain++;
  };
  if (fs.existsSync(gz)) {
    try { for (const l of zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8').split('\n')) take(l, 'gz'); }
    catch (e) { failedTo('read ' + path.basename(gz) + ' while reconciling', e); }
  }
  const before = countLines(store);
  if (fs.existsSync(store)) {
    try { for (const l of fs.readFileSync(store, 'utf8').split('\n')) take(l, 'plain'); }
    catch (e) { failedTo('read ' + path.basename(store) + ' while reconciling', e); }
  }
  if (!rows.length) return { store: path.basename(store), rows: 0, before, wrote: false, reason: 'nothing to write' };
  /* A STORE THAT SHRANK IS A BUG, NEVER AN UPDATE — the ingest workflow's own words. The merge is a
   * union of both sides so this is impossible by construction; it is asserted anyway, because the
   * one failure this pipeline cannot undo is publishing a smaller store over a bigger one. */
  if (rows.length < before) {
    failedTo('reconcile ' + path.basename(store), `would SHRINK ${before} -> ${rows.length}; refusing to write`);
    return { store: path.basename(store), rows: before, before, wrote: false, reason: 'shrink refused' };
  }
  try {
    fs.writeFileSync(store, rows.join('\n') + '\n');
    fs.writeFileSync(gz, zlib.gzipSync(fs.readFileSync(store), { level: 9 }));
  } catch (e) {
    failedTo('write ' + path.basename(store) + ' and its .gz', e);
    return { store: path.basename(store), rows: rows.length, before, wrote: false, reason: 'write failed' };
  }
  return { store: path.basename(store), rows: rows.length, before, from_gz: fromGz, from_plain: fromPlain, wrote: true };
}

/* Every store this collector owns — derived from what is on disk, so `--reconcile` works without a
 * network round trip and without knowing which format landed. */
function ownStores() {
  const known = new Set();
  try {
    const r = JSON.parse(fs.readFileSync(D('regulations.json'), 'utf8'));
    for (const reg of Object.values(r.regulations || {})) {
      if (reg.showdownFormat) known.add(NR.toID(reg.showdownFormat));
      if (reg.bo3Format) known.add(NR.toID(reg.bo3Format));
    }
  } catch (e) { failedTo('read data/regulations.json to exclude the tracked stores', e); }
  let files = [];
  try { files = fs.readdirSync(D()); } catch (e) { failedTo('list data/', e); return []; }
  const out = [];
  const seen = new Set();
  for (const f of files) {
    /* THE .gz COUNTS, AND SCANNING ONLY THE PLAIN FILE WAS A REAL HOLE.
     * The plain .jsonl is gitignored; git carries the .gz. So on a CI runner — and on any fresh
     * clone — the ONLY thing on disk is `games.<id>.jsonl.gz`, and a scan for `.jsonl` found
     * nothing and reported "nothing to reconcile", cheerfully, with a whole store sitting beside
     * it uncompressed. Reproduced 2026-08-31 by deleting the plain file: 51 rows became
     * "0 next-regulation store(s) on disk". */
    const m = /^games\.([a-z0-9]+)\.jsonl(\.gz)?$/.exec(f);
    if (!m) continue;
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const t = NR.parseFormatId(m[1]);
    if (!t) continue;                       // games.ladder / games.bo3 / games.ots never match the shape
    if (known.has(t.id)) continue;          // the tracked stores already carry the active regulation
    /* THE PLAIN PATH, ALWAYS — never the .gz that may have been what matched.
     * Pushing the matched filename handed reconcile() a path ending in .gz, which then read a
     * GZIP BINARY as text (194 "rows" out of a 51-row store), appended a second .gz to the name,
     * and wrote the compressed file back out as plain text. It destroyed the archive it was
     * supposed to protect, and the next run said "incorrect header check". Caught 2026-08-31 on
     * the rehearsal store; the store was restored from a copy. */
    out.push(storeFor(t.id));
  }
  return out;
}

/* ---- COLLECT ------------------------------------------------------------------------------------
 * durable-ingest.js is spawned rather than reimplemented. It owns the store schema, the extractor,
 * the dedupe-by-id and the raw-log archive, and a second implementation of any of that is the
 * FACTS ARE GLOBAL rule broken. */
function collect(id) {
  const store = storeFor(id);
  const before = countLines(store);
  const env = Object.assign({}, process.env, { FORMATS: id, PAGES, CONC });
  /* spawnSync, not execFileSync: durable-ingest.js reports on STDERR ("appended N games. store now
   * ..."), and execFileSync returns STDOUT. Reading the wrong stream gave an empty progress line on
   * a run that had just collected 51 games — a silent blank where the collector's own account of
   * itself is supposed to be. */
  const r = spawnSync(process.execPath,
    [path.join(ROOT, 'engine', 'durable-ingest.js'), store],
    { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) failedTo('run durable-ingest.js for ' + id, r.error);
  else if (r.status !== 0) failedTo('run durable-ingest.js for ' + id, 'exit ' + r.status + '; ' + String(r.stderr || '').trim().split('\n').slice(-1)[0]);
  const after = countLines(store);
  const line = String(r.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0]
    || 'durable-ingest.js printed nothing on stderr';
  return { format: id, store: path.basename(store), before, after, appended: after - before, ingest_said: line };
}

/* ---- main --------------------------------------------------------------------------------------- */

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const reconcileOnly = argv.includes('--reconcile');
  const fi = argv.indexOf('--format');
  const forced = fi >= 0 ? NR.toID(argv[fi + 1] || '') : null;

  console.log('NEXT-REGULATION INGEST');
  console.log('');

  if (reconcileOnly) {
    const stores = ownStores();
    console.log(`  reconcile only — ${stores.length} next-regulation store(s) on disk`);
    const rec = stores.map(reconcile);
    for (const r of rec) console.log(`    ${r.store.padEnd(40)} ${r.before} -> ${r.rows}${r.wrote ? '' : '  NOT WRITTEN (' + r.reason + ')'}`);
    if (!stores.length) console.log('    nothing to reconcile — no next-regulation store exists yet');
    return;
  }

  const det = await NR.detect({ net: !argv.includes('--no-net') });
  NR.report(det);
  console.log('');

  let targets;
  if (forced) {
    /* THE REHEARSAL PATH. Pointing this at a format that already exists is how the machinery gets
     * proved end to end while the real target does not exist. It is deliberately explicit and
     * deliberately not reachable from the schedule: an override that could fire on its own would be
     * a second, unaudited answer to "which format are we collecting". */
    const row = det.formats.find(r => r.id === forced) || NR.parseFormatId(forced);
    if (!row) { failedTo('resolve --format ' + forced, 'not a Champions VGC regulation format id'); targets = []; }
    else {
      console.log(`  --format ${forced}: REHEARSAL. This is an override, not the scheduled behaviour.`);
      console.log(`    classification would be: ${row.classification || 'unknown to the detector'}`);
      targets = [forced];
    }
  } else {
    targets = det.candidates.map(r => r.id);
  }

  const result = {
    generated: new Date().toISOString(),
    mode: forced ? 'rehearsal' : (dry ? 'dry-run' : 'scheduled'),
    detection: det,
    counters: Object.assign({}, det.counters, {
      formats_collected: 0,
      games_appended: 0,
      stores_written: 0
    }),
    collected: [],
    reconciled: [],
    problems: []
  };

  if (!targets.length) {
    /* THE ABSENT PATH, WHICH IS THE ONE THAT RUNS FOR THE NEXT TWO WEEKS. It must be unmistakable
     * and it must not look like a crash or like success. */
    console.log('  COLLECTED NOTHING, AND THAT IS THE CORRECT ANSWER TODAY.');
    console.log(`    formats detected           ${det.counters.vgc_regulation_formats_detected}`);
    console.log(`    candidates (later than ${det.active_format || '?'})  ${det.counters.candidates}`);
    console.log('    games appended             0');
    console.log('  There is no format to collect from. Nothing was fetched and no store was created.');
  } else if (dry) {
    console.log('  --dry-run: would collect ' + targets.join(', ') + ' — fetching nothing.');
  } else {
    for (const id of targets) {
      /* RESTORE BEFORE FETCHING. On a CI runner the plain .jsonl is gitignored and absent while the
       * .gz from the last run is in the checkout. durable-ingest.js builds its already-have set from
       * the PLAIN file, so without this it would re-fetch the entire pool every run — and, worse,
       * a later step that recompressed the fresh plain file would publish a store holding only this
       * run. That is the failure the ingest workflow's own restore step was added to stop. */
      const pre = reconcile(storeFor(id));
      if (pre.rows) console.log(`  restored data/games.${id}.jsonl from its .gz: ${pre.rows} rows`);
      console.log(`  collecting ${id} -> data/games.${id}.jsonl`);
      const c = collect(id);
      result.collected.push(c);
      result.counters.formats_collected++;
      result.counters.games_appended += Math.max(0, c.appended);
      console.log(`    ${c.before} -> ${c.after}  (+${c.appended})   ${c.ingest_said}`);
      if (c.appended === 0) {
        /* NOT AN ERROR AND NOT NOTHING. On day one a live format can genuinely have no public
         * replays yet; on day three it means the collector is talking to the wrong id. Both need to
         * be visible, so the zero is stated rather than skipped over. */
        console.log('    ::warning::0 games appended. Legitimate on the first hours of a new format;');
        console.log('    ::warning::after that it means the format id is wrong or the pool is empty.');
      }
    }
    for (const id of targets) {
      const r = reconcile(storeFor(id));
      result.reconciled.push(r);
      if (r.wrote) result.counters.stores_written++;
      console.log(`  store ${r.store}: ${r.rows} rows, .gz ${r.wrote ? 'rewritten' : 'NOT written (' + r.reason + ')'}`);
    }
  }

  result.problems = PROBLEMS.concat(det.problems || []);
  result.counters.problems = result.problems.length;

  console.log('');
  console.log('  COUNTERS ' + JSON.stringify(result.counters));
  /* `--no-write` exists so a test can drive this without stamping an artifact that then claims a
   * collection run happened. A dry run's counters are not a collection's counters. */
  if (argv.includes('--no-write')) { console.log('  --no-write: data/next-regulation.json untouched'); return; }

  /* THE ARTIFACT IS REWRITTEN ONLY WHEN THE ANSWER MOVES, and that is a decision about the ingest
   * workflow rather than about this file. The job commits whatever `add_artifacts` stages and exits
   * early when nothing is staged ("no new games this run"). A file carrying a fresh timestamp every
   * run would stage on every run, so a six-hourly job that collected nothing would still produce
   * four commits a day — churning every mtime engine/provenance.js reads, to record that nothing
   * happened. The SIGNATURE below is the detection itself with the volatile parts removed. */
  /* CONTENT DIGESTS, NOT AN mtime. engine/provenance.js RATCHETS the count of artifacts that rest on
   * mtime alone — it may fall and may never rise — and it can prove an mtime lies: exploitability.json
   * was 153 seconds NEWER than a weights file it had never read, and mtime cleared it. This artifact's
   * inputs are the two scripts that decide what it says plus the config they compare against, so those
   * are what it digests. A new next-regulation artifact that shipped unstamped would have grown the
   * ratchet by one; instead it is stamped and the ratchet is unmoved. */
  result.by = 'engine/next_regulation_ingest.js';
  try {
    result.source_digests = require('./run_stamp.js').sourceDigests(
      ['engine/next_regulation_ingest.js', 'engine/next_regulation.js', 'engine/durable-ingest.js', 'data/regulations.json']);
  } catch (e) { failedTo('digest this run\'s sources with engine/run_stamp.js', e); }
  result.note = 'Rewritten only when the detection changes. engine/next_regulation_ingest.js runs '
    + 'every six hours; an old `generated` means the answer has not moved, NOT that the check stopped. '
    + 'The run log is the record that it ran.';
  const sig = JSON.stringify({
    formats: det.formats.map(r => [r.id, r.classification, r.seen_in.join('+')]),
    candidates: det.counters.candidates,
    unknown: det.counters.unknown,
    lagging: det.counters.collectable_not_simulatable,
    collected: result.counters.formats_collected,
    problems: result.counters.problems
  });
  result.signature = sig;
  let prev = null;
  if (fs.existsSync(OUT)) {
    try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); }
    catch (e) { failedTo('read the previous data/next-regulation.json (it will be replaced)', e); }
  }
  const restamp = argv.includes('--force-write');
  if (prev && prev.signature === sig && !result.counters.games_appended && !restamp) {
    console.log(`  detection UNCHANGED since ${prev.generated} — data/next-regulation.json left alone`);
    console.log('  (--force-write to restamp it anyway)');
    return;
  }
  try {
    fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
    console.log('  wrote data/next-regulation.json' + (prev ? '  (the answer moved)' : '  (first run)'));
  } catch (e) { failedTo('write data/next-regulation.json', e); }
}

if (require.main === module) main();
module.exports = { reconcile, ownStores, storeFor, collect };
