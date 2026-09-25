/* solver/rotom/replay.js — save a Showdown replay of every game ROTOM plays, and never let that block a game.
 *
 * THE COMMAND AND THE ANSWER ARE READ FROM THE SERVER SOURCE (pokemon-showdown-mc f10d679), not remembered:
 *   - `/savereplay` (alias `/uploadreplay`), sent IN the battle room: server/chat-commands/core.ts:1149-1158.
 *     No argument: `forpunishment` / `silent` suppress the reply, so we never pass one.
 *   - It runs `room.uploadReplay(user, connection)`: server/rooms.ts:2034-2136. The replay id is the room id
 *     without `battle-` (rooms.ts getReplayData, :2138-2143; a `…pw` room drops its password segment).
 *   - SUCCESS is a popup on OUR connection only (users.ts:299-301 `|popup|` + message, newlines -> `||`):
 *         |popup||html|<p>Your replay has been uploaded! It's available at:</p><p> <a class="no-panel-intercept"
 *         href="https://<Config.routes.replays>/<fullid>" target="_blank">…</a> <copytext …>Copy</copytext>
 *     where fullid is the id, `<serverid>-<id>` off the main server, and `<id>-<password>pw` for a hidden room
 *     (replays.ts add(), :94-127).
 *   - FAILURE: `|popup|Your replay could not be saved: <e>` (rooms.ts:2102, the Replays-database path), or
 *     `|popup|This server's request IP <ip> is not a registered server.` (:2125-2127, the login-server path), or
 *     a `|error|` in the room (core.ts:1152, not a battle room). A popup carries NO room id, so a success is
 *     matched to its game by the replay id inside the URL, and a failure to the oldest save in flight.
 *   - Nothing else answers: a lost or throttled command is simply silence, hence the per-attempt timeout.
 *
 * THE SAVER NEVER THROWS INTO THE CLIENT AND NEVER HOLDS A GAME. Each save is its own little state machine:
 * send -> wait for the popup (timeoutMs) -> on failure or silence retry after backoff[i] -> give up after
 * `attempts`. `done(result)` is called exactly once per room with { status: 'saved'|'failed'|'skipped', url,
 * id, attempts, ms, error, popup }. The caller finalises the game record from it; the next game is a different
 * room and never waits on this one.
 */
'use strict';

const BATTLE = 'battle-';

/** the replay id the server will use for a battle room (rooms.ts getReplayData) */
function replayIdOf(room) {
  room = String(room || '');
  if (!room.endsWith('pw')) return room.slice(BATTLE.length);
  const end = room.length - 2, lastHyphen = room.lastIndexOf('-', end);
  return room.slice(BATTLE.length, lastHyphen);
}

/** parse a |popup| line's payload (everything after `|popup|`). -> { kind: 'saved', url, id } | { kind: 'failed', error } | null */
function parsePopup(payload) {
  const s = String(payload || '');
  if (/Your replay has been uploaded/i.test(s)) {
    const m = /href="([^"]+)"/.exec(s) || /(https?:\/\/\S+?)(?=["<\s]|$)/.exec(s);
    if (!m) return { kind: 'failed', error: 'upload popup without a URL' };
    const url = m[1];
    const id = url.replace(/[?#].*$/, '').split('/').filter(Boolean).pop();
    return { kind: 'saved', url, id };
  }
  if (/replay could not be saved|is not a registered server/i.test(s)) return { kind: 'failed', error: s.replace(/<[^>]+>/g, '').slice(0, 300) };
  return null;
}

class ReplaySaver {
  /**
   * @param o.send(room, text)  -> boolean  send one line (false = the socket is down; counted as a failed attempt)
   * @param o.attempts          total sends before giving up (default 4)
   * @param o.timeoutMs         wait for the popup per attempt (default 20000)
   * @param o.backoffMs         wait before attempt i+1 (default [2000, 5000, 10000])
   * @param o.log(type, obj)    event sink (never throws)
   */
  constructor(o) {
    this.send = o.send;
    this.attempts = o.attempts || 4;
    this.timeoutMs = o.timeoutMs || 20000;
    this.backoffMs = o.backoffMs || [2000, 5000, 10000];
    this.log = o.log || (() => {});
    this.setTimeout = o.setTimeout || setTimeout;
    this.clearTimeout = o.clearTimeout || clearTimeout;
    this.now = o.now || Date.now;
    this.pending = new Map();   // room -> job
    this.COUNTERS = { started: 0, sent: 0, saved: 0, failed: 0, skipped: 0, retries: 0, timeouts: 0, failurePopups: 0, unmatchedPopups: 0 };
  }
  /** start saving `room`; `done(result)` fires once. `needJoin()` says whether to /join first (after a reconnect). */
  save(room, done, opts) {
    opts = opts || {};
    if (this.pending.has(room)) return;
    const job = { room, id: replayIdOf(room), done, t0: this.now(), tries: 0, timer: null, errors: [], needJoin: !!opts.needJoin };
    this.pending.set(room, job);
    this.COUNTERS.started++;
    this._attempt(job);
  }
  skip(room, reason, done) { this.COUNTERS.skipped++; try { done({ status: 'skipped', url: null, id: replayIdOf(room), attempts: 0, ms: 0, error: reason }); } catch (e) { this.log('replay_done_error', { room, err: String(e.message) }); } }
  _attempt(job) {
    if (!this.pending.has(job.room)) return;
    job.tries++;
    if (job.tries > 1) this.COUNTERS.retries++;
    let ok = false;
    try {
      if (job.needJoin) { this.send('', '|/join ' + job.room); job.needJoin = false; }
      ok = this.send(job.room, job.room + '|/savereplay');
    } catch (e) { job.errors.push('send threw: ' + e.message); }
    if (ok) this.COUNTERS.sent++;
    else job.errors.push('socket down at attempt ' + job.tries);
    this.log('replay_attempt', { room: job.room, attempt: job.tries, sent: ok });
    job.timer = this.setTimeout(() => { if (ok) { this.COUNTERS.timeouts++; job.errors.push('no answer in ' + this.timeoutMs + ' ms'); } this._retryOrFail(job); }, ok ? this.timeoutMs : 0);
  }
  _retryOrFail(job) {
    if (!this.pending.has(job.room)) return;
    this.clearTimeout(job.timer);
    if (job.tries >= this.attempts) return this._finish(job, { status: 'failed', url: null, error: job.errors.slice(-3).join(' | ') });
    const wait = this.backoffMs[Math.min(job.tries - 1, this.backoffMs.length - 1)];
    job.timer = this.setTimeout(() => this._attempt(job), wait);
  }
  _finish(job, r) {
    this.pending.delete(job.room);
    this.clearTimeout(job.timer);
    const out = Object.assign({ id: job.id, attempts: job.tries, ms: this.now() - job.t0 }, r);
    if (out.status === 'saved') this.COUNTERS.saved++; else this.COUNTERS.failed++;
    this.log('replay_' + out.status, { room: job.room, url: out.url, attempts: out.attempts, error: out.error || null });
    try { job.done(out); } catch (e) { this.log('replay_done_error', { room: job.room, err: String(e.message) }); }
  }
  /** a |popup| payload arrived on the global room. Returns true when it was a replay answer. */
  onPopup(payload) {
    const p = parsePopup(payload);
    if (!p) return false;
    if (p.kind === 'saved') {
      for (const job of this.pending.values()) if (p.id && p.id.includes(job.id)) { this._finish(job, { status: 'saved', url: p.url, replayId: p.id, popup: String(payload).slice(0, 400) }); return true; }
      this.COUNTERS.unmatchedPopups++;
      this.log('replay_popup_unmatched', { url: p.url });
      return true;
    }
    this.COUNTERS.failurePopups++;
    const oldest = [...this.pending.values()].sort((a, b) => a.t0 - b.t0)[0];
    if (oldest) { oldest.errors.push(p.error); this._retryOrFail(oldest); }
    return true;
  }
  /** a |error| in a battle room we are saving (e.g. "You can only save replays for battles") */
  onRoomError(room, txt) {
    const job = this.pending.get(room);
    if (!job) return false;
    job.errors.push(String(txt).slice(0, 200));
    this._retryOrFail(job);
    return true;
  }
  /** the socket came back: every save in flight re-joins its room before its next attempt */
  onReconnect() { for (const job of this.pending.values()) job.needJoin = true; }
  inFlight() { return this.pending.size; }
}

/** the rating line the ladder writes into the deciding game's room (ladders-local.ts:263, ladders-remote.ts:93):
 *  |raw|NAME's rating: 1500 &rarr; <strong>1520</strong><br />(...)  -> { name, before, after } */
function parseRatingLine(line) {
  const m = /^\|raw\|(.+?)'s rating: (\d+)\s*&rarr;\s*<strong>(\d+)<\/strong>/.exec(String(line || ''));
  return m ? { name: m[1], before: +m[2], after: +m[3] } : null;
}

module.exports = { ReplaySaver, parsePopup, replayIdOf, parseRatingLine };
