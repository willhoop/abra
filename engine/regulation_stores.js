/* regulation_stores.js — WHICH HUMAN GAMES A STEERING INPUT IS COUNTED FROM, per regulation.
 * 2026-09-21 (MEASURE, abra/regmc 0.19.0).
 *
 * THE HOLE THIS CLOSES. The empirical driver and the gate's coverage clause read four tables that are
 * facts about HUMAN play: `click-counts.json`, `sheet-usage.json`, `move-priors.json` and
 * `rollout-switch-census.json`. Every one of their builders named Reg M-B's stores by literal
 * (`games.ladder.jsonl`, `games.bo3.jsonl`, and their raw logs), whatever regulation was selected. The
 * artifact seam in engine/regulation.js moved where each table was WRITTEN, so a Reg M-C run would have
 * written Reg M-B's human behaviour into a file named `-regmc` and exited 0.
 *
 * THE ANSWER FOR A NON-OWNER REGULATION IS ITS FROZEN POOL, not its live store. The pool
 * (`data/team-pool-frozen-<id>/`, cut by engine/cut_regmc_pool.js) IS the regulation's store with its
 * scope and quality rule already applied — open sheets only, and the dated Eject Button conjunction —
 * and it is pinned by digest. Counting steering inputs over the same games the differential draws its
 * teams from means the two cannot describe different populations, and a re-derivation an hour later
 * reads the same bytes. The pool's own FROZEN.md states the predicate; nothing here restates it.
 *
 * REG M-B IS UNTOUCHED BY CONSTRUCTION. `pool()` returns null for the artifact owner and every caller
 * keeps its own Reg M-B store list, byte for byte. This module does not decide Reg M-B's population.
 *
 * AN ABSENT STORE REFUSES. The pool's .jsonl files are untracked (a local measurement pin, like Reg
 * M-B's), so a fresh checkout or a worktree does not have them. `tag_dex` once turned exactly that
 * absence into a zero-usage artifact. Here a missing file, a size that disagrees with the receipt or a
 * digest that disagrees with the receipt THROWS, by name, before a single line is counted.
 *
 * The raw logs (`data/raw/games.<format>/*.jsonl.gz`, tracked shards written by the next-regulation
 * collector) are read only for the ids the pool kept, so a raw-log census and a parsed-store census
 * count the same games. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const crypto = require('crypto');
const REGN = require('./regulation.js');

const ROOT = path.join(__dirname, '..');
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

/* The pool file each raw-log directory belongs to. The pool names its halves by what
 * diff_swarm.loadTeams opens (`games.bo3.jsonl`, `games.ots.jsonl`); the collector names its raw
 * directories by format id (engine/next_regulation_ingest.js). The bo3 format is the open-sheet ladder;
 * the bo1 format's open-sheet subset is the `ots` half. Both ids are READ from data/regulations.json. */
const HALVES = () => [
  { key: 'bo3', pool: 'games.bo3.jsonl', format: REGN.BO3_FORMAT, note: 'bo3 ladder — open sheets by construction' },
  { key: 'ots', pool: 'games.ots.jsonl', format: REGN.FORMAT, note: 'bo1 ladder — its open-sheet subset only' },
];

function sha256File(abs) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 22);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

function refuse(msg) {
  throw new Error('regulation_stores: REFUSING -- ' + msg + '\n  A steering input counted over a missing or '
    + 'different store would publish another population as ' + REGN.ID + '\'s, and would exit 0.');
}

/** The frozen pool the selected regulation's steering inputs are counted from, verified against its
 *  receipt. null under the artifact owner (Reg M-B), whose callers keep their own store lists.
 *  opts.verify=false skips the sha256 (the size check still runs); every builder leaves it on. */
function pool(opts) {
  if (!REGN.ARTIFACT_TAG) return null;
  const o = opts || {};
  const dirRel = REGN.artifactFor(REGN.POOL_DIR);
  const dir = path.join(ROOT, dirRel);
  const receiptPath = path.join(dir, 'pool-receipt.json');
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')); }
  catch (e) { refuse(REGN.ID + ' has no readable pool receipt at ' + rel(receiptPath) + ' (' + e.message.split('\n')[0] + ').'); }
  if (receipt.format && receipt.format !== REGN.FORMAT) {
    refuse('the pool at ' + dirRel + ' was cut for ' + receipt.format + ' and this run selected ' + REGN.FORMAT + '.');
  }
  const files = [];
  for (const h of HALVES()) {
    const want = (receipt.files || {})[h.pool];
    if (!want || !want.sha256) refuse(rel(receiptPath) + ' names no ' + h.pool + '.');
    const abs = path.join(dir, h.pool);
    if (!fs.existsSync(abs)) {
      refuse(rel(abs) + ' is absent. The pool .jsonl files are untracked; in a worktree hard-link them from\n'
        + '  the main tree (read-only). An absent pool must never count as a pool of zero games.');
    }
    const size = fs.statSync(abs).size;
    if (want.bytes != null && size !== want.bytes) {
      refuse(rel(abs) + ' is ' + size + ' bytes and its receipt says ' + want.bytes + '.');
    }
    let sha = null;
    if (o.verify !== false) {
      sha = sha256File(abs);
      if (sha !== want.sha256) refuse(rel(abs) + ' has sha256 ' + sha.slice(0, 12) + ' and its receipt says ' + want.sha256.slice(0, 12) + '.');
    }
    files.push(Object.assign({}, h, { abs, file: rel(abs), lines: want.lines, sha256: want.sha256, verified: sha !== null }));
  }
  return {
    regulation: REGN.ID,
    format: REGN.FORMAT,
    dir: dirRel,
    receipt: rel(receiptPath),
    pool_digest: receipt.pool_digest || null,
    predicate: receipt.predicate || null,
    files,
    scope: 'the frozen ' + REGN.ID + ' pool (' + dirRel + ', pool digest ' + String(receipt.pool_digest || '').slice(0, 12)
         + '): the regulation\'s own stores with the pool\'s scope and quality rule already applied — '
         + 'see its FROZEN.md for the predicate. No further filter is applied here.',
  };
}

/** The raw-log shards for one half of the pool: data/raw/games.<format>/*.jsonl.gz, sorted. Refuses on none. */
function rawShards(half) {
  const dir = path.join(ROOT, 'data', 'raw', 'games.' + half.format);
  let names = [];
  try { names = fs.readdirSync(dir).filter(f => /\.jsonl\.gz$/.test(f)).sort(); }
  catch (e) { refuse('no raw-log directory ' + rel(dir) + ' (' + e.code + ').'); }
  if (!names.length) refuse(rel(dir) + ' holds no .jsonl.gz shard.');
  return { dir: rel(dir), files: names.map(n => path.join(dir, n)) };
}

/** Stream every line of a set of .jsonl / .jsonl.gz files, in order. */
async function eachLine(files, onLine) {
  for (const f of files) {
    const src = fs.createReadStream(f);
    const input = /\.gz$/.test(f) ? src.pipe(zlib.createGunzip()) : src;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const line of rl) onLine(line, f);
  }
}

/** The same, as an async iterable, for a caller that already loops with `for await`. */
async function* lines(files) {
  for (const f of files) {
    const src = fs.createReadStream(f);
    const input = /\.gz$/.test(f) ? src.pipe(zlib.createGunzip()) : src;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const line of rl) yield line;
  }
}

/** The set of game ids one pool half kept. */
async function idsOf(file) {
  const ids = new Set();
  await eachLine([file.abs], (line) => {
    if (!line.trim()) return;
    /* The pool was verified against its receipt, so an unparsable line is a real fault, not ragged input:
     * a join that skipped it would silently drop that game's raw log from every census built on it. */
    let g;
    try { g = JSON.parse(line); }
    catch (e) { throw new Error('regulation_stores: unparsable line in ' + file.file + ' -- ' + e.message); }
    if (g && g.id) ids.add(g.id);
  });
  return ids;
}

module.exports = { pool, rawShards, eachLine, lines, idsOf, sha256File, HALVES };
