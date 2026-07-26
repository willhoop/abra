/* reprocess.js — rebuild a game store from the raw logs we already have.
 *
 *   node engine/reprocess.js data/games.ladder.jsonl
 *   node engine/reprocess.js data/games.bo3.jsonl
 *   node engine/reprocess.js --all
 *
 * WHY KEEPING THE RAW LOGS PAID FOR ITSELF
 * ----------------------------------------
 * The parsed store is a DERIVED artifact. Every time the parser learns something new — mega
 * evolution, abilities on the mega forme, and now absolute HP with healing — every game recorded
 * before that day is missing it, and re-downloading is not an option: replays age out of Showdown's
 * server, so the archive is the only copy that will ever exist.
 *
 * Because the project stores `<store>.raw-logs.jsonl` beside every store, the fix is a reparse
 * rather than a re-scrape. That is the whole argument for "store raw, analyse on top", and this is
 * the file that cashes it in.
 *
 * WHY IT MATTERED THIS TIME
 * -------------------------
 * The ingest recorded damage as a DELTA and never emitted a healing event at all, so anything
 * replaying a game rebuilt health by subtraction and could only ever drift below the truth. That was
 * measured, not suspected: MAGNEMITE's "guaranteed kill" was followed by an actual death 56.5% of
 * the time, because it was aiming at Pokemon it believed were nearly dead and were not.
 *
 * SAFETY. The new store is written beside the old one and swapped in only after it parses and
 * contains at least as many games. A reparse that silently produced fewer games than the archive
 * holds would destroy history that cannot be re-fetched.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { extract } = require('./durable-ingest.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const targets = ALL
  ? ['data/games.ladder.jsonl', 'data/games.bo3.jsonl']
  : args.filter(a => !a.startsWith('--'));

if (!targets.length) { console.error('usage: node engine/reprocess.js <store.jsonl> | --all'); process.exit(1); }

(async () => {
  let failedAny = false;
  for (const rel of targets) {
    const store = path.join(ROOT, rel);
    const raw = store.replace(/\.jsonl$/, '.raw-logs.jsonl');
    if (!fs.existsSync(raw)) { console.error(`${rel}: no raw logs beside it — cannot reparse`); failedAny = true; continue; }

    const before = fs.existsSync(store)
      ? fs.readFileSync(store, 'utf8').split('\n').filter(Boolean).length : 0;

    const tmp = store + '.rebuilding';
    const out = fs.createWriteStream(tmp);
    let read = 0, wrote = 0, unparsed = 0, noGame = 0;

    const rl = readline.createInterface({ input: fs.createReadStream(raw), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      read++;
      let r; try { r = JSON.parse(line); } catch (e) { unparsed++; continue; }
      let g; try { g = extract(r.id, r.uploadtime, r.log); } catch (e) { unparsed++; continue; }
      if (!g) { noGame++; continue; }
      out.write(JSON.stringify(g) + '\n');
      wrote++;
      if (wrote % 2000 === 0) process.stderr.write(`  ${rel}: ${wrote.toLocaleString()} rebuilt\r`);
    }
    await new Promise(res => out.end(res));

    /* MERGE, DO NOT REPLACE — and this is not caution for its own sake, it is a measured condition.
     * The ladder store holds 16,247 games and the raw archive covers 12,803 of them: 3,444 games
     * were collected before raw-log archiving existed, and their replays have long since aged off
     * Showdown's server. A straight swap would delete them permanently, which is why the first
     * version of this file refused to run at all rather than proceed.
     *
     * So a rebuilt game REPLACES its old record by id, and a game with no raw log is kept exactly as
     * it was. Those keep the old delta-only HP, which is a real and unfixable gap in the older half
     * of the corpus rather than something to paper over — it is reported below by count. */
    const rebuilt = new Map();
    for (const line of fs.readFileSync(tmp, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let g; try { g = JSON.parse(line); } catch (e) { continue; }
      if (g && g.id) rebuilt.set(g.id, line);
    }
    const merged = [];
    let replaced = 0, kept = 0;
    if (before) {
      for (const line of fs.readFileSync(store, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let g; try { g = JSON.parse(line); } catch (e) { merged.push(line); continue; }
        const fresh = g && g.id && rebuilt.get(g.id);
        if (fresh) { merged.push(fresh); rebuilt.delete(g.id); replaced++; }
        else { merged.push(line); kept++; }
      }
    }
    for (const line of rebuilt.values()) merged.push(line);       // rebuilt games the store never had

    if (merged.length < before) {
      console.error(`\n${rel}: REFUSING TO SWAP — merge produced ${merged.length.toLocaleString()} from ` +
                    `${before.toLocaleString()}. Old store kept; rebuild left at ${path.basename(tmp)}`);
      failedAny = true;
      continue;
    }
    fs.writeFileSync(store, merged.join('\n') + '\n');
    fs.unlinkSync(tmp);
    console.log(`${rel}: ${read.toLocaleString()} raw logs -> ${wrote.toLocaleString()} reparsed | ` +
                `${replaced.toLocaleString()} records refreshed, ${kept.toLocaleString()} kept as-is ` +
                `(no raw log survives for these), ${merged.length.toLocaleString()} total`);
  }
  process.exit(failedAny ? 1 : 0);
})();
