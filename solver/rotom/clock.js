/* solver/rotom/clock.js — ROTOM's decision budget, from the server's own clock.
 *
 * THE RULE IS READ, NOT TYPED. The bo3 format carries 'VGC Timer' (pokemon-showdown-mc/config/formats.ts, the
 * Reg M-C (Bo3) entry), whose rule (data/rulesets.ts, `vgctimer`) is: Timer Starting = 420, Timer Grace = 90,
 * Timer Add Per Turn = 0, Timer Max Per Turn = 55, Timer Max First Turn = 90, Timeout Auto Choose, DC Timer Bank.
 * `readRule()` reads those numbers out of the checkout's ruleTable at start-up, so a rule change reaches ROTOM
 * without an edit here; the fallback constants below are used ONLY if the checkout cannot be read, and the
 * clock says which source it used.
 *
 * WHAT THE SERVER SAYS. On every request with the timer on the player receives
 *     |inactive|Time left: <turn> sec this turn | <total> sec total[ | <grace> sec grace]
 * (server/room-battle.ts RoomBattleTimer.nextRequest). The server then ticks every 5 s (TICK_TIME = 5 in the Reg M-C
 * checkout; this said 10 s until 2026-09-27), the tick restarting at each request. `turn` is what this
 * request may spend; `total + grace` is the whole bank (secondsLeft), which every prompt — moves, preview,
 * replacements, mid-turn switches — draws down with no increment.
 *
 * THE BUDGET (SOLVER-PLAN §4):  min(turnLeftNow − margin, (bankNow − reserve) / E[remaining requests | turn]),
 * capped at maxMs. E[…] is the store-derived table in solver/rotom/tables.json (build_assets.js), never typed.
 * When the budget falls under `minSearchMs` the caller must fall back to the prior policy — the search is not
 * allowed to be the thing that runs the clock out. With the timer OFF (no |inactive| line) the clock is still
 * enforced from the rule: a request gets maxPerTurn (maxFirstTurn at preview) and the bank is tracked locally
 * from our own spend, so a timer-off test cannot hide a slow decision.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FALLBACK_RULE = { starting: 420, grace: 90, addPerTurn: 0, maxPerTurn: 55, maxFirstTurn: 90, source: 'fallback constants (checkout unreadable)' };

function readRule(format) {
  try {
    const X = require('../human/dex.js');
    const { Dex } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
    const f = Dex.formats.get(format || X.FORMAT, true);
    const rt = Dex.formats.getRuleTable(f);
    const t = rt.timer && rt.timer[0];
    if (!t || t.starting == null) return FALLBACK_RULE;
    return { starting: t.starting, grace: t.grace, addPerTurn: t.addPerTurn || 0, maxPerTurn: t.maxPerTurn, maxFirstTurn: t.maxFirstTurn || t.maxPerTurn,
             timeoutAutoChoose: !!t.timeoutAutoChoose, dcTimerBank: !!t.dcTimerBank, source: 'ruleTable of ' + f.id + ' (' + (t.name || 'timer rule') + ')' };
  } catch (e) { return FALLBACK_RULE; }
}

function loadTable(file) {
  const p = file || path.join(__dirname, 'tables.json');
  const J = JSON.parse(fs.readFileSync(p, 'utf8'));
  const by = J.clock.byTurn, last = J.clock.last_turn;
  return { sha: require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16),
           eRem: (turn) => { const t = Math.max(1, Math.min(last, turn | 0)); return (by[t] || by[last]).mean; },
           /* the 90th percentile of the same count: the adaptive clock's per-request reserve (solver/rotom/adaptive.js) */
           eRemHi: (turn) => { const t = Math.max(1, Math.min(last, turn | 0)); const r = by[t] || by[last]; return r.p90 == null ? r.mean : r.p90; } };
}

/* |inactive|Time left: 55 sec this turn | 420 sec total | 90 sec grace */
function parseInactive(line) {
  const m = /^\|inactive\|Time left: (\d+) sec this turn \| (-?\d+) sec total(?: \| (\d+) sec grace)?/.exec(line);
  if (!m) return null;
  return { turnLeft: +m[1], total: +m[2], grace: m[3] ? +m[3] : 0 };
}

class Clock {
  constructor(o) {
    o = o || {};
    this.rule = o.rule || readRule(o.format);
    this.table = o.table || loadTable(o.tableFile);
    this.margin = o.marginS == null ? 8 : o.marginS;        // the 5 s tick + the round trip + our own scheduling
    this.reserve = o.reserveS == null ? 30 : o.reserveS;    // never plan to spend the last 30 s of bank
    this.maxMs = o.maxMs == null ? Infinity : o.maxMs;       // an operator cap (tests); the rule is the binding one
    this.minSearchMs = o.minSearchMs == null ? 400 : o.minSearchMs;
    this.reset();
  }
  /* a new battle: the bank is full again */
  reset() {
    this.last = null;           // { turnLeft, bank, at } from the latest |inactive| Time-left line
    this.localBank = this.rule.starting + this.rule.grace;
    this.timerSeen = false;
  }
  onInactive(line, now, myName) {
    const x = parseInactive(line);
    if (!x) return myName ? this.onTick(line, now, myName) : false;
    this.timerSeen = true;
    this.last = { turnLeft: x.turnLeft, bank: x.total + x.grace, at: now == null ? Date.now() : now };
    return true;
  }
  /* the room-wide lines that also carry MY turn time: the tick ("<name> has N seconds left.") and a rejoin
   * ("<name> reconnected and has N seconds left.") — after a restart this is the only clock the client can see */
  onTick(line, now, myName) {
    const m = /^\|inactive\|(.+?) (?:reconnected and has|has) (\d+) seconds left(?: this turn)?\.?$/.exec(line);
    if (!m || m[1].toLowerCase().replace(/[^a-z0-9]/g, '') !== String(myName).toLowerCase().replace(/[^a-z0-9]/g, '')) return false;
    const at = now == null ? Date.now() : now;
    const bank = this.last ? this.last.bank - (at - this.last.at) / 1000 : this.localBank;
    this.last = { turnLeft: +m[2], bank, at, from: 'tick' };
    this.timerSeen = true;
    return true;
  }
  /* what this request may spend. `receivedAt` = when the request arrived; `kind` = 'preview' | 'move' | 'switch'. */
  budget(o) {
    const now = o.now == null ? Date.now() : o.now;
    const recv = o.receivedAt == null ? now : o.receivedAt;
    let turnLeft, bank, from;
    /* a Time-left line that arrived for THIS request (at or after it, or within 2 s before it: the server sends it right after) */
    if (this.last && this.last.at >= recv - 2000) {
      turnLeft = this.last.turnLeft - (now - this.last.at) / 1000;
      bank = this.last.bank - (now - this.last.at) / 1000;
      from = 'server';
    } else {
      const cap = o.kind === 'preview' ? this.rule.maxFirstTurn : this.rule.maxPerTurn;
      bank = this.localBank - (now - recv) / 1000;
      turnLeft = Math.min(cap, this.localBank) - (now - recv) / 1000;
      from = 'rule';
    }
    const eRem = o.kind === 'preview' ? this.table.eRem(1) + 1 : this.table.eRem(o.turn || 1);
    const byTurn = turnLeft - this.margin;
    const byBank = (bank - this.reserve) / Math.max(1, eRem);
    let s = Math.min(byTurn, byBank);
    const ms = Math.max(0, Math.min(this.maxMs, Math.floor(s * 1000)));
    return { ms, lowBank: ms < this.minSearchMs, turnLeft: +turnLeft.toFixed(1), bank: +bank.toFixed(1), eRem, byTurn: +byTurn.toFixed(2), byBank: +byBank.toFixed(2), from };
  }
  /* our own spend, for the timer-off case (the server's line replaces it whenever one arrives) */
  spent(ms) { this.localBank -= ms / 1000; }
}

module.exports = { Clock, parseInactive, readRule, loadTable, FALLBACK_RULE };
