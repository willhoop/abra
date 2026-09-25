/* solver/rotom/watchdog.js — the SUPERVISOR's hang watchdog (run_ladder.js). No human restarts the ladder bot, so a
 * client that stops making progress must be restarted by the supervisor, through the same resume path it already uses
 * after a crash (the client re-reads its run state, ladder state and series book, logs in and searches on).
 *
 * PROGRESS is read from the client's own files, never from its word: a line appended to <out>/events-<name>.jsonl of a
 * PROGRESS type (a search, a series or game starting or ending, a record, a probe of a silent series), a decision in
 * <out>/decisions-<name>.jsonl, or a fresh guard answer in <out>/ladder-state-<name>.json — an idle, searching or
 * guard-paused loop re-asks the guard every GUARD_TTL (60 s) and writes the answer there, so a healthy loop always moves
 * one of the three. The aa1 hang (docs/_reports/2026-09-25-rotom-series-hang.md) moved none of them for 20 minutes.
 *
 * A GAME IS OPEN when a battle room has a `battle_join` and no `game_end` and it saw a join or a decision within
 * gameOpenMs. The watchdog NEVER restarts a client with an open game: that game would be left to the server's timer.
 * A live game under the timer produces a decision every turn, so a real open game cannot look silent for long.
 *
 * hangVerdict() is pure and unit-tested (solver/tests/test-rotom-ladder.js WATCHDOG); create() tails the files
 * incrementally (a byte offset per file), so a long run is not re-read every poll.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HANG_MS = 10 * 60000;
const GAME_OPEN_MS = 30 * 60000;
const PROGRESS = new Set(['login', 'ladder_search', 'ladder_searching', 'ladder_cancel', 'ladder_matched', 'ladder_series_start', 'series_join', 'battle_join',
  'game_end', 'confirmready', 'series_end', 'rating_line', 'ladder_series_row', 'game_record', 'replay_saved', 'series_probe_sent', 'series_probe',
  'series_orphan', 'ladder_series_orphan', 'series_rename', 'guard_pause', 'guard_clear', 'resend', 'rejoin']);

/* s = { now, since, lastProgress, openGames: [room...] } -> { restart, idleMs, why } */
function hangVerdict(s, cfg) {
  const c = Object.assign({ hangMs: HANG_MS }, cfg || {});
  if (!c.hangMs) return { restart: false, why: 'watchdog off' };
  const idleMs = s.now - Math.max(s.lastProgress || 0, s.since || 0);
  if (idleMs < c.hangMs) return { restart: false, idleMs, why: 'progress ' + Math.round(idleMs / 1000) + ' s ago' };
  if ((s.openGames || []).length) return { restart: false, idleMs, why: 'no progress for ' + Math.round(idleMs / 1000) + ' s, but a game is open (' + s.openGames[0] + '): never restarted mid-game' };
  return { restart: true, idleMs, why: 'no search, decision or game message for ' + Math.round(idleMs / 1000) + ' s and no game open' };
}

function create(outDir, name, cfg) {
  const c = Object.assign({ hangMs: HANG_MS, gameOpenMs: GAME_OPEN_MS }, cfg || {});
  const id = toID(name);
  const files = { events: path.join(outDir, 'events-' + id + '.jsonl'), decisions: path.join(outDir, 'decisions-' + id + '.jsonl'), ladder: path.join(outDir, 'ladder-state-' + id + '.json') };
  const off = { events: 0, decisions: 0 }, part = { events: '', decisions: '' };
  const battles = new Map();   // room -> { lastAt, ended }
  let lastProgress = 0, since = Date.now();
  function tail(k, onLine) {
    let st; try { st = fs.statSync(files[k]); } catch (e) { return; }
    if (st.size < off[k]) { off[k] = 0; part[k] = ''; }   // rewritten: start over
    if (st.size === off[k]) return;
    const fd = fs.openSync(files[k], 'r');
    try { const buf = Buffer.alloc(st.size - off[k]); fs.readSync(fd, buf, 0, buf.length, off[k]); off[k] = st.size; part[k] += buf.toString('utf8'); }
    finally { fs.closeSync(fd); }
    const lines = part[k].split('\n'); part[k] = lines.pop();
    for (const l of lines) { if (!l.trim()) continue; let o; try { o = JSON.parse(l); } catch (e) { continue; } onLine(o); }
  }
  function poll(now) {
    now = now || Date.now();
    tail('events', o => {
      const t = +o.t || 0;
      if (PROGRESS.has(o.type)) lastProgress = Math.max(lastProgress, t);
      if (o.type === 'battle_join' && o.room) { const b = battles.get(o.room) || { lastAt: 0, ended: false }; b.lastAt = Math.max(b.lastAt, t); b.ended = false; battles.set(o.room, b); }
      if ((o.type === 'game_end' || o.type === 'battle_room_gone') && o.room) { const b = battles.get(o.room) || { lastAt: t }; b.ended = true; battles.set(o.room, b); }
    });
    tail('decisions', o => {
      const t = +o.t || 0; lastProgress = Math.max(lastProgress, t);
      if (o.room && battles.has(o.room)) battles.get(o.room).lastAt = Math.max(battles.get(o.room).lastAt, t);
    });
    try { const L = JSON.parse(fs.readFileSync(files.ladder, 'utf8')); const g = L.guard && L.guard.last && Date.parse(L.guard.last.at); if (g) lastProgress = Math.max(lastProgress, g); } catch (e) { /* not yet written */ }
    const openGames = [...battles].filter(([, b]) => !b.ended && now - b.lastAt < c.gameOpenMs).map(([r]) => r);
    return Object.assign(hangVerdict({ now, since, lastProgress, openGames }, c), { lastProgress, openGames });
  }
  /* a (re)started client: the hang clock starts over from its launch (it spends seconds loading before it can move) */
  function restarted(now) { since = now || Date.now(); }
  return { poll, restarted, files };
}

module.exports = { create, hangVerdict, PROGRESS, HANG_MS, GAME_OPEN_MS };
