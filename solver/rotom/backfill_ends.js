/* solver/rotom/backfill_ends.js — derive HOW every game and series of a finished ladder run ended (solver/rotom/endings.js)
 * from the files the run left behind, for runs recorded before rotom.js wrote the fields itself (abra/regmc 1.15.0).
 *
 *   node solver/rotom/backfill_ends.js <run dir> [<run dir> ...] [--force]
 *
 * READS (never modifies): <run>/ladder-series-<name>.jsonl, <run>/series/<name>/*.json (the series book: each game's room,
 * gnum, side and winner), <run>/games/<name>/<room>.log (our own copy of each game's protocol lines).
 * WRITES, next to them, two NEW files (refused if present, unless --force):
 *   <run>/ladder-series-<name>.ends.jsonl   each original row, unchanged, plus end_reason, end_game, end_turn, at_preview,
 *                                            games_won, games_lost, any_forfeit_opp, walkaway, end_by, end_raw, games_end[],
 *                                            and `ends_backfilled` (the rule and the files it read)
 *   <run>/games-ends-<name>.jsonl           one line per game log: room, series, gnum, k, and the endings.js gameEnd fields
 * A game whose log is missing is `end_reason: null` with `log_missing: true`, never guessed. A series with no row (orphaned)
 * still gets its games written; it has no series line because it has no result.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('./endings.js');

const readJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

function deriveRun(dir) {
  const files = fs.readdirSync(dir);
  const out = { dir, clients: {} };
  for (const f of files.filter(f => /^ladder-series-.*\.jsonl$/.test(f) && !/\.ends\.jsonl$/.test(f))) {
    const name = f.slice('ladder-series-'.length, -'.jsonl'.length);
    const rows = readJsonl(path.join(dir, f));
    const bookDir = path.join(dir, 'series', name), logDir = path.join(dir, 'games', name);
    const books = new Map();
    if (fs.existsSync(bookDir)) for (const b of fs.readdirSync(bookDir).filter(x => x.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(bookDir, b), 'utf8')); books.set(s.id, s); }
    const kOf = new Map(rows.map(r => [r.series, r.k]));
    const games = [];
    const gameFor = (bookId, g) => {
      const lf = path.join(logDir, g.room + '.log');
      const base = { series: bookId, k: kOf.has(bookId) ? kOf.get(bookId) : (books.get(bookId) && books.get(bookId).ladder ? books.get(bookId).ladder.k : null), gnum: g.gnum, room: g.room,
                     mine: g.winner == null ? null : g.winner === g.me };
      if (!fs.existsSync(lf)) return Object.assign(base, { end_reason: null, log_missing: true });
      const ge = E.gameEnd(fs.readFileSync(lf, 'utf8').split('\n'), name);
      return Object.assign(base, { end_reason: ge.end_reason, end_by: ge.end_by, end_turn: ge.end_turn, at_preview: ge.at_preview, end_raw: ge.end_raw,
                                   log_winner_mine: ge.mine, log: path.relative(dir, lf).split(path.sep).join('/') });
    };
    for (const [id, s] of books) for (const g of (s.games || [])) games.push(gameFor(id, g));
    /* a game log the book never recorded (a series orphaned before its record): kept, with no series */
    const seen = new Set(games.map(g => g.room));
    if (fs.existsSync(logDir)) for (const lf of fs.readdirSync(logDir).filter(x => x.endsWith('.log'))) {
      const room = lf.slice(0, -4); if (seen.has(room)) continue;
      const ge = E.gameEnd(fs.readFileSync(path.join(logDir, lf), 'utf8').split('\n'), name);
      games.push({ series: null, k: null, gnum: null, room, mine: ge.mine, end_reason: ge.end_reason, end_by: ge.end_by, end_turn: ge.end_turn, at_preview: ge.at_preview, end_raw: ge.end_raw,
                   log_winner_mine: ge.mine, log: 'games/' + name + '/' + lf, not_in_series_book: true });
    }
    const ends = rows.map(r => {
      const G = games.filter(g => g.series === r.series);
      const se = E.seriesEnd(G, r.result, name, {});
      return Object.assign({}, r, { end_reason: se.end_reason, end_game: se.end_game, end_turn: se.end_turn, at_preview: se.at_preview, games_won: se.games_won, games_lost: se.games_lost,
        any_forfeit_opp: se.any_forfeit_opp, walkaway: se.walkaway, end_by: se.end_by, end_raw: se.end_raw,
        games_end: G.sort((a, b) => a.gnum - b.gnum).map(g => ({ gnum: g.gnum, room: g.room, mine: g.mine, end_reason: g.end_reason, end_turn: g.end_turn != null ? g.end_turn : null, at_preview: g.at_preview != null ? g.at_preview : null })),
        ends_backfilled: { by: 'solver/rotom/backfill_ends.js', rule: 'endings.js gameEnd over games/' + name + '/<room>.log; seriesEnd over the series book games and the row result (no series-room lines were kept, so end_by of a walkaway is null)' } });
    });
    out.clients[name] = { rows: ends, games, rowFile: path.join(dir, 'ladder-series-' + name + '.ends.jsonl'), gameFile: path.join(dir, 'games-ends-' + name + '.jsonl') };
  }
  return out;
}

function writeRun(dir, force) {
  const D = deriveRun(dir); const wrote = [];
  for (const c of Object.values(D.clients)) for (const [f, arr] of [[c.rowFile, c.rows], [c.gameFile, c.games]]) {
    if (fs.existsSync(f) && !force) throw new Error(f + ' exists: refusing to overwrite it (--force to re-derive)');
    fs.writeFileSync(f + '.tmp', arr.map(x => JSON.stringify(x)).join('\n') + '\n'); fs.renameSync(f + '.tmp', f); wrote.push(f);
  }
  return { D, wrote };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const dirs = argv.filter(a => !a.startsWith('--'));
  if (!dirs.length) { console.error('usage: node solver/rotom/backfill_ends.js <run dir> [...] [--force]'); process.exit(2); }
  for (const d of dirs) {
    const { D, wrote } = writeRun(path.resolve(d), argv.includes('--force'));
    for (const [n, c] of Object.entries(D.clients)) {
      const gr = c.games.reduce((m, g) => (m[g.end_reason] = (m[g.end_reason] || 0) + 1, m), {});
      const sr = c.rows.reduce((m, r) => (m[r.end_reason] = (m[r.end_reason] || 0) + 1, m), {});
      console.log(path.basename(d) + ' ' + n + ': ' + c.rows.length + ' series ' + JSON.stringify(sr) + ' · ' + c.games.length + ' games ' + JSON.stringify(gr));
    }
    for (const f of wrote) console.log('  wrote ' + f);
  }
}
module.exports = { deriveRun, writeRun };
