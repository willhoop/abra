/* solver/tournaments/store.js — the TOURNAMENT STORE: every published team from every open-team-list event of a regulation.
 *
 *   data/tournaments/<regulation>/events.jsonl            APPEND-ONLY. One row per event, written once, after every team
 *                                                         of that event was fetched. Its `key` (start date + city) is the
 *                                                         identity: an event already here is never ingested again, from
 *                                                         either site — THE IDEMPOTENCY RULE.
 *   data/tournaments/<regulation>/teams/<key>.jsonl.gz    WRITE-ONCE. One row per team: placing, player, the parsed sets,
 *                                                         and the RAW source bytes (the paste JSON or the team-list HTML
 *                                                         fragment) — store raw, analyse on top: a new question is a
 *                                                         re-parse of `raw`, never a re-fetch.
 *   data/tournaments/<regulation>/validation.json         DERIVED (validate.js): the format's TeamValidator on every team,
 *                                                         stamped with the checkout. Regenerable; illegal teams are kept
 *                                                         in the store and FLAGGED here, never dropped.
 *   data/tournaments/<regulation>/summary.json            DERIVED (summary.js): teams, events, tiers, archetypes, spread
 *                                                         coverage — the block status.js / orient.js can print.
 *   data/tournaments/index.json                           every event page the discovery has CLASSIFIED (source, id, date,
 *                                                         regulation label), across regulations, so a page is read once.
 *
 * GROWTH BUDGET (measured on the seed, see docs/_reports/2026-10-01-tournament-rotation.md): a 160-team regional is one
 * shard of roughly 0.2 MB gzipped. Shards never grow. Even 40 events a regulation stays under 10 MB in total, and no
 * single file approaches the 100 MB wall.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

function dirs(regulation, root) {
  const base = path.join(root || path.join(ROOT, 'data', 'tournaments'), regulation);
  return { root: root || path.join(ROOT, 'data', 'tournaments'), base, events: path.join(base, 'events.jsonl'), teams: path.join(base, 'teams'),
           validation: path.join(base, 'validation.json'), summary: path.join(base, 'summary.json'),
           index: path.join(root || path.join(ROOT, 'data', 'tournaments'), 'index.json') };
}
function readJsonl(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)) : []; }
function events(regulation, root) { return readJsonl(dirs(regulation, root).events); }
function hasEvent(regulation, key, root) { return events(regulation, root).some(e => e.key === key); }

function shardPath(regulation, key, root) { return path.join(dirs(regulation, root).teams, key + '.jsonl.gz'); }
function readShard(file) { return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); }
/* every team of the regulation, each with its event row attached as `ev` (not stored; a join). The set NAMES are
 * folded to plain ASCII on read (a paste can say "Naïve"; the dex's id of that is "nave", which names nothing). The shard
 * keeps the published spelling, in `sets` and in `raw`; only this read view is folded. */
const fold = s => typeof s === 'string' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
function foldSet(s) { return Object.assign({}, s, { species: fold(s.species), item: fold(s.item), ability: fold(s.ability), nature: fold(s.nature), moves: (s.moves || []).map(fold) }); }
function teams(regulation, root) {
  const D = dirs(regulation, root), out = [];
  for (const e of events(regulation, root)) {
    const f = path.join(D.base, e.shard);
    for (const t of readShard(f)) out.push(Object.assign(t, { sets: (t.sets || []).map(foldSet), ev: e }));
  }
  return out;
}

/* write one event: the shard first (write-once: refuses to overwrite), then the events row (append). The pair is the
 * commit point: a crash between them leaves a shard with no row, which the next run overwrites — never a row with no
 * shard. */
function writeEvent(regulation, ev, teamRows, root) {
  const D = dirs(regulation, root);
  if (hasEvent(regulation, ev.key, root)) throw new Error('store: event ' + ev.key + ' is already stored (append-only; ingest is idempotent)');
  fs.mkdirSync(D.teams, { recursive: true });
  const f = shardPath(regulation, ev.key, root);
  const body = teamRows.map(t => JSON.stringify(t)).join('\n') + '\n';
  const gz = zlib.gzipSync(Buffer.from(body, 'utf8'), { level: 9 });
  fs.writeFileSync(f, gz);
  const row = Object.assign({}, ev, { shard: path.relative(D.base, f).split(path.sep).join('/'), shard_sha256: sha(gz), shard_bytes: gz.length, teams: teamRows.length });
  fs.appendFileSync(D.events, JSON.stringify(row) + '\n');
  return row;
}

/* the classification index: { pages: { '<site>:<id>': { url, start, name, regulation_label, classified } } } */
function readIndex(root) { const f = dirs('x', root).index; return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { pages: {} }; }
function writeIndex(ix, root) {
  const f = dirs('x', root).index;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const sorted = { _note: ix._note || 'Every tournament event page the discovery (solver/tournaments/ingest.js) has classified, so a page is read once. A past event\'s regulation does not change.', pages: {} };
  for (const k of Object.keys(ix.pages).sort()) sorted.pages[k] = ix.pages[k];
  fs.writeFileSync(f, JSON.stringify(sorted, null, 1) + '\n');
}

module.exports = { ROOT, dirs, events, hasEvent, teams, readShard, shardPath, writeEvent, readIndex, writeIndex, readJsonl, sha };
