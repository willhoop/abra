/* solver/rotom/adaptive.js — ROTOM's ADAPTIVE per-decision time budget under the VGC clock (2026-09-27,
 * docs/_reports/2026-09-27-adaptive-clock.md).
 *
 * THE CLOCK IS THE RULE (solver/rotom/clock.js readRule — pokemon-showdown-mc data/rulesets.ts `vgctimer`): a 420 s bank
 * plus 90 s grace, nothing added per turn, 55 s per turn, 90 s on the first request. The server charges it in 5 s ticks
 * (server/room-battle.ts TICK_TIME) that restart at every request.
 *
 * A FIXED BUDGET SPENDS THE SAME ON EVERY DECISION. This spends little where the answer is already clear and more
 * where it is not, around a TARGET per searched decision:
 *
 *   hard  = min(cap, target · stretch, target + credit)        the most this decision may spend (MILTANK's budgetMs)
 *   soft  = min(hard, target)                                  where a decision that is neither clear nor close stops
 *   cap   = min(turnLeft − margin, slack, 2 · slack / E)        THE SAFETY LINE, from the bank the server reports
 *   slack = bank − reserve − perDecisionS · E_hi               what may be spent and still finish the game on the prior
 *   credit = credit0 + Σ (target − spent) over this game's searched decisions
 *
 * E is the store-derived expected number of requests left from this turn (solver/rotom/tables.json, mean), E_hi its
 * 90th percentile. A decision may take at most two fair shares of the slack and never all of it while E > 2, so the
 * slack shrinks geometrically and cannot go below zero by planning; what is left under the slack — `reserve` plus
 * `perDecisionS` for every request still expected at the 90th percentile — pays for the prior's answers when the
 * slack is gone (the caller drops to the prior under `minSearchMs`) and for the overrun of a decision past its budget
 * (MILTANK's deadline holds it to budget + 0.5 s). The average spent per searched decision in a game is at most
 * target + credit0/n by construction, and below target whenever the clear stop fires.
 *
 * THE STOP RULE (`stopper`, handed to MILTANK as o.onPass; checked after every complete pass of the cell fill):
 *   after pass P ≥ minPasses, solve the mean table (SLOWKING, a short capped RM+), take the column mix y and the
 *   top row b of the row mix x, and for every other row i the per-pass paired difference against y:
 *       d_i(q) = Σ_j y_j (v_bj(q) − v_ij(q))       (common random numbers: pass q plays every cell on one world)
 *   CLEAR  when every d_i has mean − clearZ·se > 0 (b beats every other candidate against their mix, beyond noise)
 *          → stop, once `minMs` has passed;
 *   CLOSE  when some d_i has mean < closeZ·se (a candidate within noise of the top)
 *          → keep searching to `hard`;
 *   else   stop at `soft`.
 *   A FORCED SWITCH plans on target · switchFrac. A single legal joint never reaches the search (search.js `forced`).
 *
 * THE DEADLINE STAYS. `hard` is MILTANK's budgetMs, and search.js still stops the fill at budget − reserve and
 * abandons a playout past it. Everything this module does is to END A FILL EARLIER than that, never later.
 *
 * COUNTED, NEVER SILENT: every plan and every stop reason goes into COUNTERS and into the decision's `info.adapt`.
 *
 * DELIBERATE BREAKS (env ROTOM_CLOCK_BREAK):
 *   nocap     the safety line is ignored (hard = target + credit, uncapped by the bank or the turn) — the simulated
 *             slow game in solver/tests/test-adaptive-clock.js must run out of bank;
 *   nostop    the clear stop never fires — the obvious-decision clause of that test must go red.
 */
'use strict';
const SK = require('../slowking/matrix.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.ROTOM_CLOCK_BREAK) || '';

const DEFAULTS = {
  targetMs: 5000,       // the mean a searched decision is planned around
  stretch: 2,           // a close decision may take up to stretch · target
  credit0Ms: null,      // the per-game allowance a close decision may borrow before any saving; null = target
  minMs: 750,           // no clear stop before this much of the decision has passed
  minPasses: 4,         // ... nor before this many complete passes (the se needs them)
  clearZ: 2,
  closeZ: 1,
  switchFrac: 0.5,      // a forced switch plans on this share of the target
  marginS: 8,           // the turn cap's margin: a tick, the round trip, our own scheduling
  reserveS: 30,         // never plan to spend the last 30 s of the bank
  perDecisionS: 1,      // and keep 1 s per request still expected (90th pct) for the prior's answers and overruns
  minSearchMs: 400,     // under this the caller plays the prior
};

function create(opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  delete o.counters;
  if (o.credit0Ms == null) o.credit0Ms = o.targetMs;
  const COUNTERS = (opts && opts.counters) || { plans: 0, low_bank: 0, capped_by_clock: 0, capped_by_credit: 0, stops: { clear: 0, soft: 0, hard: 0, none: 0 },
                     decisions_searched: 0, spent_ms: 0, games: 0 };
  let credit = o.credit0Ms;

  function newGame() { credit = o.credit0Ms; COUNTERS.games++; }

  /* the cap from the bank and the turn. bankS and turnLeftS are what the server (or the rule) says is left NOW. */
  function capMs(c) {
    const E = Math.max(1, c.eRem || 1), Ehi = Math.max(E, c.eRemHi || E);
    const slack = c.bankS - o.reserveS - o.perDecisionS * Ehi;
    const byBank = Math.min(slack, E > 2 ? 2 * slack / E : slack);
    const byTurn = c.turnLeftS - o.marginS;
    return Math.max(0, Math.floor(1000 * Math.min(byBank, byTurn)));
  }

  /* plan one decision. c = { kind: 'move'|'switch'|'preview', bankS, turnLeftS, eRem, eRemHi } */
  function plan(c) {
    COUNTERS.plans++;
    const tgt = c.kind === 'switch' ? o.targetMs * o.switchFrac : o.targetMs;
    const cap = BREAK === 'nocap' ? Infinity : capMs(c);
    const byCredit = tgt + Math.max(0, credit);
    let hard = Math.min(tgt * o.stretch, byCredit, cap);
    if (hard === cap && cap < Math.min(tgt * o.stretch, byCredit)) COUNTERS.capped_by_clock++;
    else if (byCredit < tgt * o.stretch) COUNTERS.capped_by_credit++;
    hard = Math.floor(hard);
    const soft = Math.min(hard, tgt);
    const lowBank = hard < o.minSearchMs;
    if (lowBank) COUNTERS.low_bank++;
    return { hardMs: hard, softMs: Math.floor(soft), capMs: cap === Infinity ? null : cap, creditMs: Math.round(credit), lowBank, kind: c.kind };
  }

  /* the early stop for one decision: MILTANK's o.onPass. `rec` collects what it saw (put in the decision's info). */
  function stopper(p, rec) {
    rec = rec || {};
    rec.stop = 'none'; rec.checks = 0;
    return function onPass(vs, job, t0) {
      const now = Date.now(), el = now - t0, P = vs.length;
      const m = job.rows.length, n = job.cols.length;
      /* the fill ends at the SOFT line (less MILTANK's reserve for the solve) unless the table is close */
      const passMs = el / Math.max(1, P);
      const softEnd = p.softMs - reserveOf(p.softMs);
      if (P < o.minPasses || m < 2) {                 // too few passes to judge: a fixed budget's stop, at the soft line
        if (el + passMs > softEnd) { rec.stop = 'soft'; return true; }
        return false;
      }
      rec.checks++;
      const s = assess(vs, m, n, { clear: o.clearZ, close: o.closeZ });
      rec.state = s.state; rec.passes = P;
      if (s.state === 'clear' && el >= o.minMs && BREAK !== 'nostop') { rec.stop = 'clear'; return true; }
      if (s.state !== 'close' && el + passMs > softEnd) { rec.stop = 'soft'; return true; }
      return false;
    };
  }

  /* after the decision: what it spent (wall ms from the request) and whether it searched */
  function spent(ms, searched, rec) {
    if (!searched) return;
    COUNTERS.decisions_searched++; COUNTERS.spent_ms += ms;
    credit += (rec && rec.kind === 'switch' ? o.targetMs * o.switchFrac : o.targetMs) - ms;
    if (rec && rec.stop) COUNTERS.stops[rec.stop] = (COUNTERS.stops[rec.stop] || 0) + 1;
  }

  return { plan, stopper, spent, newGame, capMs, COUNTERS, opts: o, get credit() { return credit; } };
}

/* MILTANK's own reserve for the solve and the pick (search.js reserveMsOf), so a soft stop leaves the same room */
function reserveOf(ms) { return Math.max(20, Math.min(300, Math.round(ms * 0.06))); }

/* the table's state after P complete passes: 'clear' | 'close' | 'open'. vs[q][i·n+j] = the value of cell (i,j) in pass q. */
function assess(vs, m, n, z) {
  z = z || { clear: DEFAULTS.clearZ, close: DEFAULTS.closeZ };
  const P = vs.length;
  const A = Array.from({ length: m }, () => new Array(n).fill(0)), C = Array.from({ length: m }, () => new Array(n).fill(0));
  for (const v of vs) for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { const x = v[i * n + j]; if (x === x) { A[i][j] += x; C[i][j]++; } }
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) A[i][j] = C[i][j] ? A[i][j] / C[i][j] : NaN;
  let tot = 0, k = 0; for (const r of A) for (const x of r) if (x === x) { tot += x; k++; }
  const fill = k ? tot / k : 0.5;
  for (const r of A) for (let j = 0; j < n; j++) if (r[j] !== r[j]) r[j] = fill;
  const sol = SK.solveRM(A, { iters: 400, tol: 1e-3 });
  const x = sol.x, y = sol.y;
  let b = 0; for (let i = 1; i < m; i++) if (x[i] > x[b]) b = i;
  let minT = Infinity, allClear = true;
  for (let i = 0; i < m; i++) {
    if (i === b) continue;
    let s = 0, s2 = 0, q0 = 0;
    for (const v of vs) {
      let d = 0, ok = true;
      for (let j = 0; j < n; j++) { const a = v[b * n + j], c = v[i * n + j]; if (a !== a || c !== c) { ok = false; break; } d += y[j] * (a - c); }
      if (!ok) continue;
      s += d; s2 += d * d; q0++;
    }
    if (q0 < 2) { allClear = false; minT = Math.min(minT, 0); continue; }
    const mean = s / q0, sd = Math.sqrt(Math.max(0, (s2 - q0 * mean * mean) / (q0 - 1))), se = sd / Math.sqrt(q0);
    /* identical rows (every pass the same difference): nothing more to learn; a positive one is clear, a zero one a tie */
    const t = se > 1e-12 ? mean / se : (mean > 1e-12 ? Infinity : (mean < -1e-12 ? -Infinity : Infinity));
    if (!(mean - z.clear * se > 0) && !(se <= 1e-12 && mean >= -1e-12)) allClear = false;
    minT = Math.min(minT, t);
  }
  const state = allClear ? 'clear' : (minT < z.close ? 'close' : 'open');
  return { state, top: b, x: Array.from(x), y: Array.from(y), minT, passes: P };
}

module.exports = { create, assess, DEFAULTS, BREAK: BREAK || null };
