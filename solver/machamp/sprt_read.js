/* solver/machamp/sprt_read.js — read a FINISHED SPRT (solver/machamp/sprt.js) once, at its bound: the verdict plus the
 * clock, the search counters and the mega timing that the SPRT result itself does not carry.
 *
 *   node solver/machamp/sprt_read.js --sprt <result.json> --out <read.json>
 *
 * Reads <result>.shards/shard-*.jsonl (solver/mew/play.js --mode match lines). COUNTED games are pairs with index <=
 * stop_pair_index and no errored game — the same set sprt.js counted. Clock and mega figures are over counted games.
 * The search counters (`ctr` on each line) are cumulative per worker, so they are read from each worker's LAST line and
 * cover every game that worker played, including the few played past the stop; they are labelled so.
 *
 * CLOCK RULE (solver/results/2026-09-26-champ-vs-doduo/preregistration.json): no X decision over 55 s (VGC Timer Max Per
 * Turn) and no game whose summed X decision time exceeds 420 s (Timer Starting), read from solver/rotom/clock.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const { wilson } = require('./gate.js');

function read(resultFile) {
  const R = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const dir = resultFile.replace(/\.json$/, '') + '.shards';
  const files = fs.readdirSync(dir).filter(f => /^shard-\d+\.jsonl$/.test(f)).map(f => path.join(dir, f));
  const lines = [], lastCtr = [];
  for (const f of files) {
    const ls = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    lines.push(...ls);
    const last = ls.filter(l => l.ctr).pop();
    if (last) lastCtr.push(last.ctr);
  }
  const cut = R.stop_pair_index != null ? R.stop_pair_index : Infinity;
  const byPair = new Map();
  for (const l of lines) { const a = byPair.get(l.pi) || []; a.push(l); byPair.set(l.pi, a); }
  const counted = [];
  for (const [pi, a] of byPair) if (pi <= cut && a.length === 2 && !a.some(g => g.vX == null)) counted.push(...a);
  const q = (xs, f) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : null; };
  const msX = counted.flatMap(g => g.ms_x || []), msY = counted.flatMap(g => g.ms_y || []);
  const gameSumX = counted.map(g => (g.ms_x || []).reduce((a, b) => a + b, 0));
  const RULE = require('../rotom/clock.js').readRule ? require('../rotom/clock.js').readRule() : { maxPerTurn: 55, starting: 420, source: 'fallback' };
  const pairs = { both: 0, split: 0, lost: 0 };
  for (const [pi, a] of byPair) if (pi <= cut && a.length === 2 && !a.some(g => g.vX == null)) { const s = a[0].vX + a[1].vX; if (s === 2) pairs.both++; else if (s === 0) pairs.lost++; else pairs.split++; }
  const W = counted.filter(g => g.vX === 1).length, L = counted.filter(g => g.vX === 0).length, D = counted.length - W - L;
  const ctr = lastCtr.reduce((a, c) => { for (const [k, v] of Object.entries(c)) a[k] = (a[k] || 0) + (typeof v === 'number' ? v : 0); return a; }, {});
  const MT = require('../arena/mega_timing.js');
  return {
    what: 'SPRT read at the bound (solver/machamp/sprt_read.js)', sprt_file: resultFile, verdict: R.verdict, llr_at_stop: R.llr_at_stop, bounds: R.bounds,
    preregistered: R.preregistered, x: R.x, y: R.y, engine_release: R.engine_release, release_stamp: R.release_stamp, pool: R.pool, flags: R.flags,
    started: R.started, finished: R.finished, wall_s: R.wall_s,
    counted: { games: counted.length, W, D, L, score_x: counted.length ? (W + D / 2) / counted.length : null, ci95_x: wilson(W + D / 2, counted.length),
               ci_caption: 'Wilson 95% at a data-dependent stopping time: conditional on the stop, slightly optimistic', pairs,
               agrees_with_sprt: counted.length === R.games_used && W === R.result.W },
    clock: { rule: { maxPerTurn_s: RULE.maxPerTurn, starting_s: RULE.starting, grace_s: RULE.grace, source: RULE.source },
             x_ms: { decisions: msX.length, mean: msX.length ? +(msX.reduce((a, b) => a + b, 0) / msX.length).toFixed(1) : null, p50: q(msX, 0.5), p95: q(msX, 0.95), p99: q(msX, 0.99), max: msX.length ? Math.max(...msX) : null },
             y_ms: { decisions: msY.length, mean: msY.length ? +(msY.reduce((a, b) => a + b, 0) / msY.length).toFixed(1) : null, p95: q(msY, 0.95), max: msY.length ? Math.max(...msY) : null },
             x_game_sum_s: { mean: gameSumX.length ? +(gameSumX.reduce((a, b) => a + b, 0) / gameSumX.length / 1000).toFixed(1) : null, p95: q(gameSumX, 0.95) / 1000, max: Math.max(...gameSumX) / 1000 },
             breaches: { decisions_over_maxPerTurn: msX.filter(v => v > RULE.maxPerTurn * 1000).length, games_over_starting_bank: gameSumX.filter(v => v > RULE.starting * 1000).length } },
    search_counters_all_played: Object.assign(ctr, {
      caption: 'cumulative over every game the workers played (incl. games past the stop); both bots in the worker share the agent counters, the greedy bot contributes no searched decision',
      prior_fallback_share: ctr.searched ? +(ctr.fallback_decisions / ctr.searched).toFixed(4) : null,
      playouts_per_searched: ctr.searched ? +(ctr.playouts / ctr.searched).toFixed(1) : null,
      unfilled_share: ctr.cells ? +(ctr.unfilled / ctr.cells).toFixed(4) : null }),
    mega_timing: { x: MT.summarize(counted.map(g => g.mega && g.mega.x).filter(Boolean)), y: MT.summarize(counted.map(g => g.mega && g.mega.y).filter(Boolean)) },
  };
}

if (require.main === module) {
  require('../arena/env.js');
  const r = read(path.resolve(flag('--sprt')));
  if (flag('--out')) fs.writeFileSync(flag('--out'), JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ verdict: r.verdict, counted: r.counted, clock: r.clock, fallback: r.search_counters_all_played.prior_fallback_share,
    playouts: r.search_counters_all_played.playouts_per_searched, agent_fallbacks: r.search_counters_all_played.fallbacks,
    mega_x: { megas: r.mega_timing.x.megas, delayed_share: r.mega_timing.x.delayed_share, ci: r.mega_timing.x.delayed_ci95 },
    mega_y: { megas: r.mega_timing.y.megas, delayed_share: r.mega_timing.y.delayed_share, ci: r.mega_timing.y.delayed_ci95 } }, null, 1));
}
module.exports = { read };
