/* solver/tests/throttle_model.js — a FAITHFUL model of Showdown's per-user message throttle, for ROTOM's tests.
 *
 * Ported line for line from pokemon-showdown-mc server/users.ts (read 2026-09-26, not recalled):
 *   THROTTLE_DELAY = 600, THROTTLE_BUFFER_LIMIT = 6                                     (users.ts:33, :36)
 *   User#chat(message, room, connection)                                                (users.ts:1429-1467)
 *     - `/cmd userdetails …` and `>> …` are exempt from the queue (and Config.nothrottle turns it off: --no-security)
 *     - a queue already running and holding >= THROTTLE_BUFFER_LIMIT - 1 (= 5) messages: the message is DROPPED and the
 *       sender's connection gets `|raw|<strong class="message-throttle-notice">Your message was not sent because you've
 *       been typing too quickly.</strong>` in the message's room (lobby messages: no room prefix)
 *     - a running queue with room: the message is queued
 *     - no queue, but under THROTTLE_DELAY since the last processed message: a queue is started for the remainder
 *     - otherwise it is processed now and lastChatMessage = now
 *   User#processChatQueue()                                                             (users.ts:1484-1516)
 *     - one message per THROTTLE_DELAY, lastChatMessage reset at each
 *   Users.socketReceive splits a websocket message on `|` into ROOMID|MESSAGE and calls chat() per line (users.ts:1700-1740).
 *
 * The clock and the timers are injected, so a unit test can run it on simulated time and a scripted server on real time.
 */
'use strict';
const THROTTLE_DELAY = 600;
const THROTTLE_BUFFER_LIMIT = 6;
const NOTICE = '|raw|<strong class="message-throttle-notice">Your message was not sent because you\'ve been typing too quickly.</strong>';

class ThrottledUser {
  /* o = { now, setTimeout, parse(message, roomid), notice(roomid), delay?, bufferLimit?, nothrottle? } */
  constructor(o) {
    this.o = o;
    this.delay = o.delay || THROTTLE_DELAY;
    this.limit = o.bufferLimit || THROTTLE_BUFFER_LIMIT;
    this.lastChatMessage = 0;
    this.chatQueue = null;
    this.chatQueueTimeout = null;
    this.log = [];   // { t, roomid, message, fate: 'processed' | 'queued' | 'dropped' }
  }
  /* one websocket frame `ROOMID|MESSAGE` (the multi-line split of users.ts:1735-1740 included) */
  receive(frame) {
    const i = frame.indexOf('|'); if (i < 0) return;
    const roomid = frame.slice(0, i), msg = frame.slice(i + 1);
    const lines = msg.split('\n'); if (!lines[lines.length - 1]) lines.pop();
    for (const line of lines) if (this.chat(line, roomid) === false) break;
  }
  chat(message, roomid) {
    const now = this.o.now();
    if (message.startsWith('/cmd userdetails') || message.startsWith('>> ') || this.o.nothrottle) {
      this.log.push({ t: now, roomid, message, fate: 'processed', exempt: true });
      this.o.parse(message, roomid);
      if (this.o.nothrottle) return undefined;
      return false;
    }
    if (this.chatQueueTimeout) {
      if (!this.chatQueue) this.chatQueue = [];
      if (this.chatQueue.length >= this.limit - 1) {
        this.log.push({ t: now, roomid, message, fate: 'dropped' });
        this.o.notice(roomid);
        return false;
      }
      this.chatQueue.push([message, roomid]);
      this.log.push({ t: now, roomid, message, fate: 'queued' });
    } else if (now < this.lastChatMessage + this.delay) {
      this.chatQueue = [[message, roomid]];
      this.log.push({ t: now, roomid, message, fate: 'queued' });
      this.startChatQueue(this.delay - (now - this.lastChatMessage));
    } else {
      this.lastChatMessage = now;
      this.log.push({ t: now, roomid, message, fate: 'processed' });
      this.o.parse(message, roomid);
    }
    return undefined;
  }
  startChatQueue(delay) {
    this.chatQueueTimeout = this.o.setTimeout(() => this.processChatQueue(), delay);
  }
  processChatQueue() {
    this.chatQueueTimeout = null;
    if (!this.chatQueue) return;
    const el = this.chatQueue.shift();
    if (!el) { this.chatQueue = null; return; }
    const [message, roomid] = el;
    this.lastChatMessage = this.o.now();
    this.log.push({ t: this.lastChatMessage, roomid, message, fate: 'processed', from_queue: true });
    this.o.parse(message, roomid);
    if (this.chatQueue.length) this.chatQueueTimeout = this.o.setTimeout(() => this.processChatQueue(), this.delay);
    else this.chatQueue = null;
  }
  dropped() { return this.log.filter(x => x.fate === 'dropped'); }
}

/* a tiny discrete-event clock for unit tests: now(), setTimeout(), run(untilMs) */
function simClock() {
  let t = 0, seq = 0; const q = [];
  const api = {
    now: () => t,
    setTimeout: (f, ms) => { const e = { at: t + Math.max(0, ms || 0), f, id: ++seq, dead: false }; q.push(e); return e; },
    clearTimeout: e => { if (e) e.dead = true; },
    at: (ms, f) => api.setTimeout(f, ms - t),
    run: (until) => {
      for (;;) {
        q.sort((a, b) => a.at - b.at || a.id - b.id);
        const e = q.find(x => !x.dead);
        if (!e || e.at > until) { t = Math.max(t, until); return; }
        q.splice(q.indexOf(e), 1); t = e.at; e.f();
      }
    },
  };
  return api;
}

module.exports = { ThrottledUser, simClock, NOTICE, THROTTLE_DELAY, THROTTLE_BUFFER_LIMIT };
