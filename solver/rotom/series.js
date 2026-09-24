/* solver/rotom/series.js — what a best-of-3 teaches ROTOM, carried from game 1 into games 2 and 3.
 *
 * The rating updates once per SERIES (room-battle-bestof.ts: the sub-battles are unrated, the set is rated), and the
 * opponent's sheet cannot change inside one (GURU bo3.json: `sheet_changed_within_series` = 0). What moves between
 * games is what they BROUGHT and LED — and humans repeat it at rates the store measured (tables.json bo3: same four
 * 61.0% after a win, 29.7% after a loss). Per game this records, from the public log:
 *   - their leads and every sheet row they revealed (their bring, as far as it was seen), and mine;
 *   - who won the game.
 * It is used three ways: (1) team preview's opponent model (policy.js previewSearch), (2) XATU's bring belief, which
 * has `series_same / series_won / series_lost` features and is fed this series' earlier games as its memory, and
 * (3) the decision log, so a series can be audited afterwards.
 *
 * PERSISTED to <out>/series/<client>/<bestof id>.json on every change, and re-read at start-up, so a process that is killed
 * and restarted by the watchdog mid-series still knows what game 1 showed.
 */
'use strict';
const fs = require('fs');
const path = require('path');

class SeriesBook {
  constructor(dir) { this.dir = dir; this.map = new Map(); fs.mkdirSync(dir, { recursive: true }); }
  file(id) { return path.join(this.dir, id.replace(/[^a-z0-9-]/gi, '_') + '.json'); }
  get(id) {
    if (!id) return null;
    if (this.map.has(id)) return this.map.get(id);
    let s = null;
    try { s = JSON.parse(fs.readFileSync(this.file(id), 'utf8')); s.reloaded = (s.reloaded || 0) + 1; } catch (e) { s = null; }
    if (!s) s = { id, games: [], started: new Date().toISOString(), result: null };
    this.map.set(id, s);
    return s;
  }
  /* written to a temp file and renamed, so a reader (or a restart) never sees half a file */
  save(s) { try { const f = this.file(s.id); fs.writeFileSync(f + '.tmp', JSON.stringify(s, null, 1)); fs.renameSync(f + '.tmp', f); } catch (e) { /* the log says it; never fatal */ } }
  /* a game finished (or was observed finishing): record it once per room */
  recordGame(id, g) {
    const s = this.get(id);
    if (!s) return;
    const i = s.games.findIndex(x => x.room === g.room);
    if (i >= 0) s.games[i] = Object.assign(s.games[i], g); else s.games.push(g);
    s.games.sort((a, b) => a.gnum - b.gnum);
    this.save(s);
  }
  /* the opponent's most recent finished game in this series, before game `gnum` */
  oppLast(id, gnum, me) {
    const s = this.get(id);
    if (!s) return null;
    const prev = s.games.filter(g => g.gnum < gnum && g.winner !== undefined).pop();
    if (!prev) return null;
    const opp = me === 'p1' ? 'p2' : 'p1';
    return { brought: prev.brought[opp], leads: prev.leads[opp], won: prev.winner === opp, gnum: prev.gnum };
  }
  /* XATU's BringMemory records for this series' earlier games (solver/xatu/bring.js `add`) */
  memoryRecords(id, gnum, sheetKeys, players) {
    const s = this.get(id);
    if (!s) return [];
    return s.games.filter(g => g.gnum < gnum && g.winner !== undefined && g.leads && g.leads.p1 && g.leads.p2 && g.leads.p1.length === 2 && g.leads.p2.length === 2)
      .map(g => ({ sheets: sheetKeys, leads: g.leads, final: g.brought, series: id, players, winner: g.winner, gnum: g.gnum }));
  }
}

module.exports = { SeriesBook };
