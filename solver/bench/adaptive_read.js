/* solver/bench/adaptive_read.js — read a FINISHED adaptive-clock SPRT (solver/machamp/sprt.js, X = an `adaptive` spec) once,
 * at its bound: the pre-registered time condition and clock rule for BOTH sides, which sprt_read.js reads for X only.
 *
 *   node solver/bench/adaptive_read.js --sprt <result.json> [--out <read.json>]
 *
 * Over the COUNTED games (pair index <= stop_pair_index, no errored game — the set sprt.js counted; all games if the run
 * hit the cap): per side the mean wall ms per SEARCHED decision (Σ ms over searched decisions is not on the line, so this is
 * Σ ms of every decision / number of searched decisions — forced and single-legal decisions take ~0 ms and are included
 * in the numerator, which favours neither side because both bots meet the same forced states in a pair's two seatings
 * only approximately; the per-decision mean over ALL decisions is printed beside it), the heaviest decision, the bank used
 * per game (Σ decision ms) mean / p95 / max, and TIMEOUTS: a decision over 55 s or a game over 420 s (the rule's Timer
 * Starting, the 90 s grace NOT counted). X's adaptive stop reasons are summed from the lines.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../arena/env.js');   // the Reg M-C checkout, so readRule reads the ruleTable rather than the fallback constants
const CLOCK = require('../rotom/clock.js');

const file = flag('--sprt');
const R = JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = file.replace(/\.json$/, '') + '.shards';
const lines = [];
for (const f of fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) if (l) lines.push(JSON.parse(l));
const cut = R.stop_pair_index == null ? Infinity : R.stop_pair_index;
const byPair = new Map(); for (const l of lines) { const a = byPair.get(l.pi) || []; a.push(l); byPair.set(l.pi, a); }
const counted = [];
for (const [pi, a] of byPair) if (pi <= cut && a.length === 2 && !a.some(l => l.err)) counted.push(...a);
const rule = CLOCK.readRule();
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
function side(k) {
  const ms = counted.map(l => l['ms_' + k]), srch = counted.map(l => l['searched_' + k] || 0);
  const all = ms.flat(), games = ms.map(a => a.reduce((s, x) => s + x, 0));
  const nS = srch.reduce((s, x) => s + x, 0);
  return { games: counted.length, decisions: all.length, searched: nS,
    ms_per_searched: nS ? +(all.reduce((s, x) => s + x, 0) / nS).toFixed(1) : null,
    ms_per_decision: all.length ? +(all.reduce((s, x) => s + x, 0) / all.length).toFixed(1) : null,
    max_decision_ms: all.length ? Math.max(...all) : null,
    bank_used_s: { mean: +(games.reduce((s, x) => s + x, 0) / games.length / 1000).toFixed(1), p95: +(q(games, 0.95) / 1000).toFixed(1), max: +(Math.max(...games) / 1000).toFixed(1) },
    timeouts: { decisions_over_turn: all.filter(x => x > rule.maxPerTurn * 1000).length, games_over_bank: games.filter(x => x > rule.starting * 1000).length } };
}
const stops = {}; for (const l of counted) for (const [k, v] of Object.entries(l.adapt_x || {})) stops[k] = (stops[k] || 0) + v;
const X = side('x'), Y = side('y');
const out = { sprt: path.relative(path.join(__dirname, '..', '..'), file).replace(/\\/g, '/'), verdict: R.verdict, stop_pair_index: R.stop_pair_index, result: R.result,
  counted_games: counted.length, rule: { starting: rule.starting, grace: rule.grace, maxPerTurn: rule.maxPerTurn, source: rule.source },
  x: Object.assign(X, { adaptive_stops: stops }), y: Y,
  time_condition: { rule: 'X ms per searched decision <= Y', x: X.ms_per_searched, y: Y.ms_per_searched, holds: X.ms_per_searched <= Y.ms_per_searched },
  clock_safe: { x_timeouts: X.timeouts.decisions_over_turn + X.timeouts.games_over_bank, holds: X.timeouts.decisions_over_turn + X.timeouts.games_over_bank === 0 } };
console.log(JSON.stringify(out, null, 1));
if (flag('--out')) fs.writeFileSync(flag('--out'), JSON.stringify(out, null, 1));
