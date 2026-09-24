/* solver/arena/arena.js — the offline arena: bot X vs bot Y for N games inside MEDICHAM, Reg M-C.
 *
 *   tools\lownode.cmd solver\arena\arena.js --x miltank --y prior --games 100 [--budget 1000] [--seed 1]
 *        [--depth 2] [--k1 8] [--k2 8] [--cap 60] [--workers N] [--human <games.jsonl>] [--out <summary.json>]
 *
 * PRE-GATE. MEDICHAM's Reg M-C gate is NOT open. Every number this prints is a SHAKEDOWN of the
 * harness, not a result about any bot, and the artifact says so in its first field.
 *
 * DESIGN.
 *  - Teams: REAL Reg M-C open sheets and the humans' own brought four and leads (solver/arena/teams.js).
 *  - PAIRED SEATING: each team pair is played twice with the bots swapped between the two sheets, on the
 *    SAME battle seed. Each bot plays each team once, so a lopsided team pair cannot decide the match.
 *    `--games` is therefore rounded up to an even number; it is part of the sample definition.
 *  - A game ends on a wipe (`isTerminal`), or at `--cap` turns, where the engine's HP rule
 *    (`horizonScore`) decides it and the game is COUNTED as capped.
 *  - Per-decision time is measured around every `choose` call, for both bots.
 *  - `--workers N` (N >= 1) fills MILTANK's cells in N worker processes (solver/miltank/pool.js); 0 = in-process.
 *    The worker count is part of the sample definition: at a fixed clock it buys more playouts per decision.
 *  - Win rate: W, D, L and score = (W + D/2)/N with a Wilson 95% interval; plus the paired view — team
 *    pairs X took both games of, split, or lost both.
 *  - Everything that fired is counted (the API's, the prior adapter's, the rollout's and MILTANK's
 *    counters) and a zero where a capability should have fired is printed as a WARNING.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ENV = require('./env.js');
/* DELIBERATE BREAK (env ARENA_BREAK=seat): bot x always sits on side A — the paired seating is gone.
 * solver/tests/test-arena.js must go red under it. */
const BREAK = process.env.ARENA_BREAK || '';

const ROOT = path.join(__dirname, '..', '..');
const API = require(path.join(ROOT, 'engine', 'medicham_api.js'));
const M = API.M;
const T = require('./teams.js');
const { makeBots } = require('./bots.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../prior/infer.js').load());
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}
function stats(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: q(0.5), p95: q(0.95), max: s[s.length - 1] };
}
const sha = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { return null; } };

async function run(o) {
  const N = Math.ceil((o.games || 100) / 2) * 2;
  const L = T.loadGames({ file: o.human, n: N / 2, seed: o.seed, M });
  if (L.refused) throw new Error(L.refused);
  if (L.games.length < N / 2) throw new Error('only ' + L.games.length + ' buildable team pairs');
  const pool = o.workers > 0 && (o.x === 'miltank' || o.y === 'miltank') ? await require('../miltank/pool.js').create({ workers: o.workers }) : null;
  const B = makeBots(API, { prior: PA, miltank: MT });
  const mk = (name, seed) => name === 'random' ? B.random(seed) : name === 'prior' ? B.prior()
    : name === 'miltank' ? B.miltank(seed, { budgetMs: o.budget, depth: o.depth, k1: o.k1, k2: o.k2, pool }) : null;
  const X = mk(o.x, o.seed * 1000 + 1), Y = mk(o.y, o.seed * 1000 + 2);
  if (!X || !Y) throw new Error('unknown bot');
  const times = { X: [], Y: [] }, rec = [];
  const infos = { X: [], Y: [] };   // MILTANK's per-decision info (cells, playouts, gap), searched decisions only
  const res = { W: 0, D: 0, L: 0, capped: 0, errors: 0 };
  const pairs = { both: 0, split: 0, lost: 0 };
  const t0 = Date.now();
  for (let gi = 0; gi < N; gi++) {
    const G = L.games[gi >> 1];
    const xIsA = BREAK === 'seat' ? true : (gi & 1) === 0;
    const bA = xIsA ? X : Y, bB = xIsA ? Y : X;
    const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
    const seed = o.seed * 100000 + (gi >> 1);
    const rng = API.makeRng(seed);
    let S = API.newBattle(a.team, b.team, { rng });
    const ctx = PA.newGame(G);
    let err = null;
    try {
      while (!API.isTerminal(S) && S.turn < o.cap) {
        let t = Date.now(); const cA = await bA.choose(S, 'A', ctx); const dA = Date.now() - t;
        t = Date.now(); const cB = await bB.choose(S, 'B', ctx); const dB = Date.now() - t;
        (xIsA ? times.X : times.Y).push(dA); (xIsA ? times.Y : times.X).push(dB);
        if (cA.info && cA.info.playouts != null) (xIsA ? infos.X : infos.Y).push(cA.info);
        if (cB.info && cB.info.playouts != null) (xIsA ? infos.Y : infos.X).push(cB.info);
        PA.record(ctx, S, cA.joint, cB.joint);
        API.stepInPlace(S, cA.joint, cB.joint, rng);
      }
    } catch (e) { err = String(e && e.message || e).slice(0, 300); }
    let vA, capped = false;
    if (err) { res.errors++; }
    else if (API.isTerminal(S)) vA = API.winner(S);
    else { vA = API.horizonScore(S); capped = true; res.capped++; }
    const vX = err ? null : (xIsA ? vA : 1 - vA);
    if (vX === 1) res.W++; else if (vX === 0) res.L++; else if (vX === 0.5) res.D++;
    rec.push({ gi, id: G.id, xSide: xIsA ? 'A' : 'B', seed, turns: S.turn, vX, capped, err });
    if (gi & 1) {
      const p = rec[gi - 1].vX, q = rec[gi].vX;
      if (p != null && q != null) { const s = p + q; if (s === 2) pairs.both++; else if (s === 0) pairs.lost++; else pairs.split++; }
    }
    if ((gi + 1) % 10 === 0 || gi === N - 1) {
      const n = res.W + res.D + res.L;
      console.log(`  ${gi + 1}/${N}  ${o.x} W${res.W} D${res.D} L${res.L}  score ${(n ? (res.W + res.D / 2) / n : 0).toFixed(3)}  capped ${res.capped} errors ${res.errors}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  if (pool) pool.close();
  const n = res.W + res.D + res.L;
  const score = n ? (res.W + res.D / 2) / n : null;
  const ci = wilson(res.W + res.D / 2, n);
  let head = null; try { head = cp.execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) {}
  let manifest = null; try { manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(L.file), 'manifest.json'), 'utf8')).generated; } catch (e) {}
  const warn = [];
  if (o.x === 'miltank' || o.y === 'miltank') {
    for (const k of ['playouts', 'cells']) if (!MT.COUNTERS[k]) warn.push('MILTANK ' + k + ' = 0');
    if (!R.COUNTERS.worlds && !(pool && pool.counters.worlds)) warn.push('rollout worlds = 0');
    if (pool && !pool.counters.playouts) warn.push('pool workers played 0 playouts');
    if (!MT.COUNTERS.reservedSwitch) warn.push('reserved switch slots = 0');
  }
  if (o.x === 'prior' || o.y === 'prior' || o.x === 'miltank' || o.y === 'miltank') if (!PA.COUNTERS.optionsMatched) warn.push('prior matched no option');
  return {
    status: 'PRE-GATE — MEDICHAM Reg M-C gate not open; a harness shakedown, not a result',
    x: o.x, y: o.y, games: N, played: n,
    result: { ...res, score_x: score, ci95_x: ci },
    paired: { team_pairs: N / 2, ...pairs },
    decision_ms: { [o.x + ' (x)']: stats(times.X), [o.y + ' (y)']: stats(times.Y) },
    search: Object.fromEntries([['x', infos.X], ['y', infos.Y]].filter(([, a]) => a.length).map(([k, a]) => [k, {
      decisions: a.length, cells: stats(a.map(i => i.m * i.n)), playouts: stats(a.map(i => i.playouts)), passes: stats(a.map(i => i.passes)),
      unfilled_share: +(a.reduce((s, i) => s + i.unfilled, 0) / a.reduce((s, i) => s + i.m * i.n, 0)).toFixed(4),
      slowking_gap: { mean: +(a.reduce((s, i) => s + i.gap, 0) / a.length).toExponential(2), max: +Math.max(...a.map(i => i.gap)).toExponential(2) },
      mix_support: stats(a.map(i => i.support)) }])),
    flags: { games: N, seed: o.seed, budget_ms: o.budget, depth: o.depth, k1: o.k1, k2: o.k2, cap: o.cap, reserve_switch: 2, workers: o.workers || 0 },
    sample: { human_file: L.file, manifest_generated: manifest, scanned: L.scanned, eligible: L.eligible, skipped: L.skipped, stride: L.stride,
              ids_sha256: crypto.createHash('sha256').update(L.games.map(g => g.id).join('\n')).digest('hex').slice(0, 16) },
    provenance: { head, regulation: ENV.regulation, checkout: ENV.checkout, engine: sha(path.join(ROOT, 'engine', 'medicham2-browser.js')),
                  api: sha(path.join(ROOT, 'engine', 'medicham_api.js')), engine_data: sha(path.join(ROOT, 'data', 'engine-data-regmc.js')),
                  prior_model: sha(path.join(ROOT, 'solver', 'prior', 'model', 'prior-v0.json')), node: process.version,
                  note: 'live tree, not a frozen engine release: PRE-GATE shakedown only' },
    counters: { api: API.COUNTERS, prior: PA.COUNTERS, rollout: R.COUNTERS, rollout_workers: pool ? pool.counters : null, miltank: MT.COUNTERS },
    warnings: warn,
    wall_s: Math.round((Date.now() - t0) / 1000),
    per_game: rec,
  };
}

if (require.main === module) {
  const o = { x: flag('--x', 'miltank'), y: flag('--y', 'prior'), games: +flag('--games', 100), seed: +flag('--seed', 1),
              budget: +flag('--budget', 1000), depth: +flag('--depth', 2), k1: +flag('--k1', 8), k2: +flag('--k2', 8),
              cap: +flag('--cap', 60), workers: +flag('--workers', 0), human: flag('--human', undefined) };
  const out = flag('--out', path.join(ROOT, 'solver', 'out', 'arena', `${o.x}-vs-${o.y}-g${o.games}-s${o.seed}.json`));
  console.log('ARENA (PRE-GATE shakedown) ' + o.x + ' vs ' + o.y + '  ' + JSON.stringify(o));
  run(o).then(r => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r, null, 1));
  const { per_game, ...head } = r;
  console.log(JSON.stringify(head, null, 1));
  console.log('wrote ' + out);
  process.exit(r.result.errors ? 1 : 0);
  }, e => { console.error(e); process.exit(1); });
}

module.exports = { run, wilson, BROKEN: BREAK || null };
