/* solver/arena/arena.js — the offline arena: bot X vs bot Y for N games inside MEDICHAM, Reg M-C.
 *
 *   tools\lownode.cmd solver\arena\arena.js --x miltank --y prior --games 100 [--budget 1000] [--seed 1]
 *        [--depth 2] [--k1 8] [--k2 8] [--cap 60] [--workers N] [--human <games.jsonl>] [--out <summary.json>]
 *        [--leaf-x heuristic|pory2] [--leaf-y ...] [--depth-x N] [--depth-y N]   per-bot MILTANK leaf and playout depth
 *        (default: env MILTANK_LEAF, else the heuristic; and --depth).
 *        [--release <id>]   play on a FROZEN engine release (engine/engine_release.js); stamped into the artifact
 *
 * BOTS. <league spec .json> (a MACHAMP generation via solver/mew/agent.js, e.g. solver/machamp/league/gen5.json) | random | prior (human prior v0, greedy) | doduo (MAG v1 + DODUO v1 joint, greedy) | mag (MAG v1
 * alone, the two slots factorised, greedy) | miltank (MILTANK v1 at --budget ms per decision).
 *
 * A RESULT NEEDS --release. Without it the arena reads the LIVE engine, which another division may be
 * rewriting mid-run, and the artifact says "live tree — a shakedown, not a result" in its first field.
 * With it every engine byte, in this process and in every pool worker, comes from data/releases/<id>/
 * (solver/arena/engine.js), and REL.stamp() — the release id and every source digest — is in the artifact.
 * solver/tests/test-arena-release.js fails if a release-bound run opens a live engine or data byte.
 * Whether the gate is open on that release is engine/quarantine.js's to say, never this file's.
 *
 * THE SHEET POOL. The human dataset (solver/out/human/games.jsonl) is hashed whole into sample.pool_sha256,
 * with the ids of the team pairs played in sample.ids_sha256, so two artifacts can be shown to share a pool.
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
 * solver/tests/test-arena.js must go red under it.
 * DELIBERATE BREAK (env ARENA_BREAK=nevermega): both bots have every mega request stripped
 * (solver/arena/mega_rate.js neverMega). solver/tests/test-mega-rate.js must go red under it. */
const BREAK = process.env.ARENA_BREAK || '';

const ROOT = path.join(__dirname, '..', '..');
const ENGINE = require('./engine.js').load(flag('--release', null));
const API = ENGINE.API;
const M = API.M;
const T = require('./teams.js');
const { makeBots } = require('./bots.js');
const MR = require('./mega_rate.js');
const PA = require('../miltank/prior_adapter.js').create(API, require('../prior/infer.js').load());
const R = require('../miltank/rollout.js').create(API, { buildBody: T.buildBody });
const MT = require('../miltank/search.js').create(API, { prior: PA, rollout: R });
/* The MAG v1 + DODUO v1 bots each get their own prior adapter over solver/mag/infer.js (loaded only when
 * asked for). DODUO is the joint coordinator's argmax; MAG is MAG alone, its two slots independent — the
 * same model file read through its factorised cells (infer.js `top(k, 'mag')`). */
let _MAGD = null;
const MAGD = () => (_MAGD || (_MAGD = require('../mag/infer.js').load()));
const PA_DODUO = () => require('../miltank/prior_adapter.js').create(API, MAGD());
const PA_MAG = () => require('../miltank/prior_adapter.js').create(API, { predict(row, t, p) {
  const r = MAGD().predict(row, t, p);
  return r ? Object.assign({}, r, { cells: r.top(Infinity, 'mag') }) : r;
} });

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
/* an engine file from wherever this run's engine came from: the release snapshot, or the live tree */
const ENG = rel => ENGINE.REL ? path.join(ENGINE.REL.dir, rel) : path.join(ROOT, rel);
const POOLS = new Map();
const POOL_SHA = f => { if (!POOLS.has(f)) { const h = crypto.createHash('sha256'); const fd = fs.openSync(f, 'r'), b = Buffer.alloc(1 << 22); let n;
  while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); fs.closeSync(fd); POOLS.set(f, h.digest('hex').slice(0, 16)); } return POOLS.get(f); };
const sha = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { return null; } };

async function run(o) {
  const N = Math.ceil((o.games || 100) / 2) * 2;
  const L = T.loadGames({ file: o.human, n: N / 2, seed: o.seed, M });
  if (L.refused) throw new Error(L.refused);
  if (L.games.length < N / 2) throw new Error('only ' + L.games.length + ' buildable team pairs');
  const pool = o.workers > 0 && (o.x === 'miltank' || o.y === 'miltank') ? await require('../miltank/pool.js').create({ workers: o.workers }) : null;
  const B = makeBots(API, { prior: PA, miltank: MT });
  const mk = (name, seed, extra) => name === 'random' ? B.random(seed) : name === 'prior' ? B.prior()
    : name === 'doduo' ? B.greedy('doduo', PA_DODUO()) : name === 'mag' ? B.greedy('mag', PA_MAG())
    : name === 'miltank' ? B.miltank(seed, Object.assign({ budgetMs: o.budget, depth: o.depth, k1: o.k1, k2: o.k2, pool }, extra))
    : /\.json$/.test(name) ? leagueBot(name, seed) : null;
  /* A LEAGUE AGENT (a MACHAMP generation, e.g. solver/machamp/league/gen5.json) through solver/mew/agent.js — the
   * self-play champion as an arena bot. Its search fallbacks are counted in AG.COUNTERS and reported below. */
  let AG = null;
  function leagueBot(file, seed) {
    AG = AG || require('../mew/agent.js').create(API, { buildBody: T.buildBody, rollout: R });
    const spec = JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8'));
    return AG.load(spec).bot(seed);
  }
  const opt = (v, d) => (v == null || v === '' || Number.isNaN(v) ? d : v);
  const armX = { leaf: o.leafX || undefined, depth: opt(o.depthX, o.depth) }, armY = { leaf: o.leafY || undefined, depth: opt(o.depthY, o.depth) };
  let X = mk(o.x, o.seed * 1000 + 1, armX), Y = mk(o.y, o.seed * 1000 + 2, armY);
  if (!X || !Y) throw new Error('unknown bot');
  if (BREAK === 'nevermega') { X = MR.neverMega(X); Y = MR.neverMega(Y); }
  const megaT = { X: MR.tally(), Y: MR.tally() };   // THE MEGA COUNTER, per bot, on the sides that could mega
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
    const mg = MR.game(API, xIsA ? { A: megaT.X, B: megaT.Y } : { A: megaT.Y, B: megaT.X });
    let err = null;
    try {
      while (!API.isTerminal(S) && S.turn < o.cap) {
        let t = Date.now(); const cA = await bA.choose(S, 'A', ctx); const dA = Date.now() - t;
        t = Date.now(); const cB = await bB.choose(S, 'B', ctx); const dB = Date.now() - t;
        (xIsA ? times.X : times.Y).push(dA); (xIsA ? times.Y : times.X).push(dB);
        if (cA.info && cA.info.playouts != null) (xIsA ? infos.X : infos.Y).push(cA.info);
        if (cB.info && cB.info.playouts != null) (xIsA ? infos.Y : infos.X).push(cB.info);
        PA.record(ctx, S, cA.joint, cB.joint);
        mg.decide(S, 'A', cA.joint); mg.decide(S, 'B', cB.joint);
        API.stepInPlace(S, cA.joint, cB.joint, rng);
        mg.stepped(S);
      }
    } catch (e) { err = String(e && e.message || e).slice(0, 300); }
    mg.end();
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
    const wantPory = [armX.leaf, armY.leaf, process.env.MILTANK_LEAF].includes('pory2');
    const poryLeaves = R.COUNTERS.leafPory2 + ((pool && pool.counters.leafPory2) || 0);
    if (wantPory && !poryLeaves) warn.push('PORYGON2 leaf asked for and served 0 evaluations');
  }
  if (o.x === 'prior' || o.y === 'prior' || o.x === 'miltank' || o.y === 'miltank') if (!PA.COUNTERS.optionsMatched) warn.push('prior matched no option');
  for (const [k, b] of [['x', X], ['y', Y]]) if (b.PA && !b.PA.COUNTERS.optionsMatched) warn.push(b.name + ' (' + k + ') matched no option');
  const mega = { x: MR.summary(megaT.X), y: MR.summary(megaT.Y), human_rate: MR.HUMAN_RATE, floor: MR.floor(), margin: MR.MARGIN,
                 rule: 'a bot is far below the human rate when the upper end of its Wilson 95% interval on capable sides is under floor (solver/arena/mega_rate.js)' };
  for (const k of ['x', 'y']) {
    const m = mega[k];
    if (m.capable && !m.megas) warn.push('MEGA: ' + o[k] + ' (' + k + ') megaed on 0 of ' + m.capable + ' capable sides');
    else if (m.capable && m.ci95[1] < mega.floor) warn.push('MEGA: ' + o[k] + ' (' + k + ') megaed on ' + m.megas + '/' + m.capable + ' capable sides, CI upper ' + m.ci95[1] + ' < floor ' + mega.floor);
  }
  if (AG && AG.COUNTERS.fallbacks) warn.push('league agent search FELL BACK to its prior ' + AG.COUNTERS.fallbacks + ' times');
  return {
    status: ENGINE.id ? 'frozen engine release ' + ENGINE.id + ' (gate state: engine/quarantine.js)' : 'LIVE TREE — not a frozen release; a harness shakedown, not a result',
    ...ENGINE.stamp,
    x: o.x, y: o.y, games: N, played: n,
    result: { ...res, score_x: score, ci95_x: ci },
    paired: { team_pairs: N / 2, ...pairs },
    decision_ms: { [o.x + ' (x)']: stats(times.X), [o.y + ' (y)']: stats(times.Y) },
    search: Object.fromEntries([['x', infos.X], ['y', infos.Y]].filter(([, a]) => a.length).map(([k, a]) => [k, {
      decisions: a.length, cells: stats(a.map(i => i.m * i.n)), playouts: stats(a.map(i => i.playouts)), passes: stats(a.map(i => i.passes)),
      unfilled_share: +(a.reduce((s, i) => s + i.unfilled, 0) / a.reduce((s, i) => s + i.m * i.n, 0)).toFixed(4),
      slowking_gap: { mean: +(a.reduce((s, i) => s + i.gap, 0) / a.length).toExponential(2), max: +Math.max(...a.map(i => i.gap)).toExponential(2) },
      mix_support: stats(a.map(i => i.support)) }])),
    flags: { release: ENGINE.id, x: o.x, y: o.y, games: N, seed: o.seed, budget_ms: o.budget, depth: o.depth, k1: o.k1, k2: o.k2, cap: o.cap, reserve_switch: 2, workers: o.workers || 0,
             leaf_x: armX.leaf || process.env.MILTANK_LEAF || 'heuristic', leaf_y: armY.leaf || process.env.MILTANK_LEAF || 'heuristic', depth_x: armX.depth, depth_y: armY.depth },
    sample: { human_file: L.file, pool_sha256: POOL_SHA(L.file), manifest_generated: manifest, scanned: L.scanned, eligible: L.eligible, skipped: L.skipped, stride: L.stride,
              ids_sha256: crypto.createHash('sha256').update(L.games.map(g => g.id).join('\n')).digest('hex').slice(0, 16) },
    provenance: { head, regulation: ENV.regulation, checkout: ENV.checkout, engine_dir: ENGINE.REL ? ENGINE.REL.dir : 'live',
                  engine: sha(ENG('engine/medicham2-browser.js')), api: sha(ENG('engine/medicham_api.js')), engine_data: sha(ENG('data/engine-data-regmc.js')),
                  prior_model: sha(path.join(ROOT, 'solver', 'prior', 'model', 'prior-v0.json')), node: process.version,
                  porygon2_model: sha(path.join(ROOT, 'solver', 'porygon2', 'model', 'porygon2-v0.json')),
                  mag_model: sha(path.join(ROOT, 'solver', 'mag', 'model', 'mag-v1.json')), doduo_model: sha(path.join(ROOT, 'solver', 'mag', 'model', 'doduo-v1.json')),
                  argv: process.argv.slice(2), env: { MILTANK_LEAF: process.env.MILTANK_LEAF || null, SOLVER_RELEASE: process.env.SOLVER_RELEASE || null } },
    mega,
    counters: { league_agent: AG ? AG.COUNTERS : null, api: API.COUNTERS, prior: PA.COUNTERS, greedy_x: X.PA ? X.PA.COUNTERS : null, greedy_y: Y.PA ? Y.PA.COUNTERS : null, rollout: R.COUNTERS, rollout_workers: pool ? pool.counters : null, miltank: MT.COUNTERS },
    warnings: warn,
    wall_s: Math.round((Date.now() - t0) / 1000),
    per_game: rec,
  };
}

if (require.main === module) {
  const o = { x: flag('--x', 'miltank'), y: flag('--y', 'prior'), games: +flag('--games', 100), seed: +flag('--seed', 1),
              budget: +flag('--budget', 1000), depth: +flag('--depth', 2), k1: +flag('--k1', 8), k2: +flag('--k2', 8),
              cap: +flag('--cap', 60), workers: +flag('--workers', 0), human: flag('--human', undefined), release: ENGINE.id,
              leafX: flag('--leaf-x', ''), leafY: flag('--leaf-y', ''), depthX: flag('--depth-x', null) == null ? null : +flag('--depth-x'), depthY: flag('--depth-y', null) == null ? null : +flag('--depth-y') };
  const out = flag('--out', path.join(ROOT, 'solver', 'out', 'arena', `${o.x}-vs-${o.y}-g${o.games}-s${o.seed}.json`));
  console.log('ARENA ' + (ENGINE.id ? 'release ' + ENGINE.id : '(LIVE TREE shakedown)') + ' ' + o.x + ' vs ' + o.y + '  ' + JSON.stringify(o));
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
