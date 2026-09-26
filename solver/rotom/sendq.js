/* solver/rotom/sendq.js — ROTOM's outgoing message queue: paced to the server's throttle, battle choices first.
 *
 * WHY (aa2, 2026-09-26; docs/_reports/2026-09-26-orphaned-series-k16.md, docs/_reports/2026-09-26-rotom-throttle-fix.md).
 * Showdown processes one message per 600 ms per user and queues five more; anything beyond that is DROPPED with a
 * `message-throttle-notice` in the message's room (pokemon-showdown-mc server/users.ts:33-36, :1429-1467; modelled in
 * solver/tests/throttle_model.js). rotom.js used to write every message the moment it was made, and the burst at the
 * start of a series (`/savereplay`, `/leave`, `/crq`, `/utm`, `/search`, `/join` x3, `/timer on` x2) ended in the two
 * messages that matter: the battle's `/timer on` and the team-preview `/choose`. 14 of 17 game-1 previews in aa2 were
 * dropped that way and played with the server's default team while the decision log said `sent: true`.
 *
 * THE RULE HERE: MIRROR THE SERVER'S QUEUE. For every frame written, the time the server will process it is predicted
 * the way users.ts does it — at once if a gap has passed since the last one, else one gap after the last — with the gap
 * `gapMs` (default 650: the server's 600 plus a margin). A frame is written only while the predicted server backlog is
 * at most `ahead` (default 0), so the server's own queue never holds more than one of ours, four short of its drop
 * line. `ahead` is 0 and not higher because a frame already written can no longer be overtaken: with `ahead` 2 the k=16
 * preview `/choose` reached the server 2.8 s after it was made instead of 1.6 s (solver/tests/test-rotom-throttle.js
 * part A). Frames wait in OUR queue, where a choice can jump them.
 * Three priority classes, FIFO inside a class: 0 = a battle choice (`/choose`, `/undo`, `/confirmready`), the battle
 * timer (`/timer`) and the login (`/trn`); 1 = room traffic (`/join`, `/leave`, `/savereplay`, anything addressed to a
 * room); 2 = the lobby (`/utm`, `/search`, `/crq`, …). A lower-class frame that has waited `agingMs` (4 s) may go ONCE
 * between two class-0 frames, so nothing starves and a choice is never held behind more than one of them. Nothing is
 * ever silently discarded: a frame still queued when the socket closes is counted (`cleared`), and the reconnect path
 * re-answers the open request.
 *
 * send() returns true when the frame is QUEUED on an open socket — not when the server applied it. Whether the server
 * applied a choice is a separate question, answered from the server's own later lines (solver/rotom/applied.js).
 */
'use strict';

const CHOICE = /^\/(choose|undo|confirmready|trn|timer)\b/;
const ROOMCMD = /^\/(join|leave|timer|savereplay|part|j)\b/;
function classify(frame) {
  const i = frame.indexOf('|');
  const room = i < 0 ? '' : frame.slice(0, i), msg = i < 0 ? frame : frame.slice(i + 1);
  if (CHOICE.test(msg)) return 0;
  if (room || ROOMCMD.test(msg)) return 1;
  return 2;
}

class SendQueue {
  /* o = { gapMs, ahead, agingMs, write(frame), isOpen(), now?, setTimeout?, clearTimeout?, onWire?(entry) } */
  constructor(o) {
    this.o = o;
    this.gap = o.gapMs == null ? 650 : o.gapMs;
    this.ahead = o.ahead == null ? 0 : o.ahead;
    this.aging = o.agingMs == null ? 4000 : o.agingMs;
    this.now = o.now || Date.now;
    this.st = o.setTimeout || setTimeout;
    this.ct = o.clearTimeout || clearTimeout;
    this.q = [[], [], []];
    this.lastP = -Infinity;   // predicted time the server processes the last frame we wrote
    this.proc = [];           // predicted process times still in the future = the server's backlog of ours
    this.lastCls = null;
    this.timer = null;
    this.recent = [];   // the last frames written: { frame, room, msg, cls, at, queuedAt }
    this.stats = { queued: 0, written: 0, cleared: 0, max_depth: 0, max_server_backlog: 0, aged: 0, by_class: [0, 0, 0],
                   wait_ms: [{ n: 0, sum: 0, max: 0 }, { n: 0, sum: 0, max: 0 }, { n: 0, sum: 0, max: 0 }], gap_ms: this.gap, ahead: this.ahead };
  }
  depth() { return this.q[0].length + this.q[1].length + this.q[2].length; }
  send(frame) {
    if (!this.o.isOpen()) return false;
    const cls = classify(frame);
    this.q[cls].push({ frame, cls, queuedAt: this.now() });
    this.stats.queued++; this.stats.by_class[cls]++;
    const d = this.depth(); if (d > this.stats.max_depth) this.stats.max_depth = d;
    this.pump();
    return true;
  }
  /* put a frame at the FRONT of its class (a resend after a throttle notice) */
  sendFirst(frame) {
    if (!this.o.isOpen()) return false;
    const cls = classify(frame);
    this.q[cls].unshift({ frame, cls, queuedAt: this.now(), resend: true });
    this.stats.queued++; this.stats.by_class[cls]++;
    this.pump();
    return true;
  }
  pump() {
    if (this.timer) return;
    while (this.depth()) {
      const t = this.now();
      while (this.proc.length && this.proc[0] <= t) this.proc.shift();
      if (this.proc.length > this.ahead) { this.timer = this.st(() => { this.timer = null; this.pump(); }, Math.max(1, this.proc[0] - t + 1)); return; }
      if (!this.flushOne()) return;
    }
  }
  flushOne() {
    const t = this.now();
    /* choices first; a lower-class frame that has waited agingMs goes once between two choices (never two in a row) */
    const agedCls = [1, 2].find(c => this.q[c].length && t - this.q[c][0].queuedAt >= this.aging);
    let e = null;
    if (agedCls && (this.lastCls === 0 || !this.q[0].length)) { e = this.q[agedCls].shift(); this.stats.aged++; }
    else e = this.q[0].shift() || this.q[1].shift() || this.q[2].shift();
    if (!e) return false;
    if (!this.o.isOpen()) { this.stats.cleared++; this.clear(); return false; }
    try { this.o.write(e.frame); } catch (err) { this.stats.write_errors = (this.stats.write_errors || 0) + 1; }
    const p = Math.max(t, this.lastP + this.gap);
    this.lastP = p; if (p > t) this.proc.push(p);
    if (this.proc.length > this.stats.max_server_backlog) this.stats.max_server_backlog = this.proc.length;
    this.lastCls = e.cls;
    this.stats.written++;
    const w = this.stats.wait_ms[e.cls], ms = t - e.queuedAt;
    w.n++; w.sum += ms; if (ms > w.max) w.max = ms;
    const i = e.frame.indexOf('|');
    const rec = { frame: e.frame, room: i < 0 ? '' : e.frame.slice(0, i), msg: i < 0 ? e.frame : e.frame.slice(i + 1), cls: e.cls, at: t, queuedAt: e.queuedAt, resend: !!e.resend };
    this.recent.push(rec); if (this.recent.length > 64) this.recent.shift();
    if (this.o.onWire) this.o.onWire(rec);
    return true;
  }
  /* the socket closed: nothing queued can reach the server any more. Counted, never silent. */
  clear() {
    const n = this.depth();
    this.q = [[], [], []];
    if (this.timer) { this.ct(this.timer); this.timer = null; }
    this.stats.cleared += n;
    this.proc = []; this.lastP = -Infinity;   // a new connection is a new user session on the server
    return n;
  }
  /* frames written to `room` within `ms` (newest last) */
  recentTo(room, ms) { const t = this.now(); return this.recent.filter(r => r.room === room && t - r.at <= ms); }
  summary() {
    const s = Object.assign({}, this.stats, { depth: this.depth() });
    s.wait_ms = s.wait_ms.map(w => ({ n: w.n, mean: w.n ? Math.round(w.sum / w.n) : null, max: w.max }));
    return s;
  }
}

module.exports = { SendQueue, classify };
