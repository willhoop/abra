/* bench_speed.js — HOW FAST CAN WE PLAY MEDICHAM? A throughput measurement, and nothing else.
 *
 * Will, 2026-08-28: a speed test on MEDICHAM — how quickly we can play games on it, for the rollout
 * engine. This file answers ONLY that. It makes no claim about whether MEDICHAM is CORRECT, and a
 * number out of it must never be read as one: the simulator is under quarantine for accuracy and a
 * fast wrong engine is still wrong.
 *
 *   node engine/bench_speed.js --release <id> --team-store data/team-pool-frozen --reps 3
 *   node engine/bench_speed.js ... --workers 1,2,4,6,8      # process scaling
 *   node engine/bench_speed.js --worker <playouts> --release <id>   # one child, prints JSON
 *
 * ================= WHY THE UNITS ARE WHAT THEY ARE ===============================================
 *
 * A rollout engine does not buy "games". It buys TURNS, because a playout is truncated at a horizon
 * rather than played to a result. So every figure here is reported per TURN as well as per game, and
 * every per-game figure names its turn cap. A per-game number with no cap attached is not a number.
 *
 * THE PATH THAT IS ACTUALLY PAID FOR. `engine/miltank.js` is the rollout engine, and what it calls is
 * `rollout_leaf.rolloutWinProb(board, side, {n, explore, foePolicy, maxTurns})` — DEFAULTS at
 * miltank.js:484 are n=200, explore=1.0, foePolicy='uniform', turns=the derived census cap. Inside,
 * each of the n samples pays `buildSide` twice (FRESH bodies every sample, deliberately — MEDICHAM
 * mutates what it is handed) and then `runPlayout`. So three arms, and the differences between them
 * are the interesting quantities:
 *
 *   LEAF     rolloutWinProb            = n x (2 x buildSide + runPlayout) + wilson
 *   PLAYOUT  runPlayout on prebuilt S  = the simulation alone
 *   GAME     runPlayout at a long cap  = a whole battle to a winner
 *
 * LEAF minus PLAYOUT is the per-sample seeding overhead, which is a FIXED cost per playout and does
 * not shrink with the horizon — so it is the cost that decides whether a short-horizon rollout is
 * worth doing at all. It is reported on its own line.
 *
 * ================= WHAT IS PINNED ================================================================
 *
 * `--release` freezes the 26 SOURCE files (CLAUDE.md: a measurement is a photograph). `--team-store`
 * pins the OTHER half of the sample — `engine/diff_swarm.js:loadTeams` reads data/games.bo3.jsonl and
 * data/games.ots.jsonl LIVE and OPS appends to them hourly, so an unpinned run is not repeatable.
 *
 * A release does NOT pin wall-clock. Reported as FASTEST-OF-N with the spread, because a contended
 * run understates throughput and the fastest leg is the honest floor for a planning number.
 */
'use strict';
const T_PROC = process.hrtime.bigint();          /* first line that runs; everything below is loaded */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const REL_ID = arg('--release', null);
const TEAM_STORE = arg('--team-store', null);
const REPS = Math.max(1, +arg('--reps', 3));
const LEAF_N = Math.max(1, +arg('--leaf-n', 200));
const BOARDS = Math.max(1, +arg('--boards', 24));
const GAME_PAIRS = Math.max(1, +arg('--pairs', 60));
const WORKER = arg('--worker', null);            /* child mode: run N playouts, print JSON, exit */
const WORKERS = String(arg('--workers', '')).split(',').map(Number).filter(n => n > 0);
const CAPS = String(arg('--caps', '6,10,14,20,60')).split(',').map(Number).filter(n => n > 0);
/* The leaf is the expensive arm (n samples per call), so it gets its own, shorter cap list. */
const LEAF_CAPS = String(arg('--leaf-caps', '')).split(',').map(Number).filter(n => n > 0);
const OUT = arg('--out', null);
const ms = (a, b) => Number(b - a) / 1e6;

/* ---- LOAD, TIMED IN PIECES. The whole point of separating fixed from marginal cost is that a
 * rollout engine amortises this over thousands of playouts, so folding it into a per-game figure
 * makes the figure useless for budgeting. Each phase is timed on its own. */
const LOAD = {};
let t = process.hrtime.bigint();
const REL = require('./engine_release.js').open(REL_ID);
LOAD.release_open = ms(t, process.hrtime.bigint());

t = process.hrtime.bigint();
REL.require('data/engine-data.js');
LOAD.engine_data = ms(t, process.hrtime.bigint());

t = process.hrtime.bigint();
const MEDI = REL.require('engine/medicham2-browser.js',
  { need: ['battleInit', 'battleTurn', 'battleOver', 'battleResult', 'buildMon', 'playerAction'] });
LOAD.medicham = ms(t, process.hrtime.bigint());

t = process.hrtime.bigint();
const B = REL.require('engine/board.js', { need: ['Board'] });
LOAD.board = ms(t, process.hrtime.bigint());

t = process.hrtime.bigint();
const RL = REL.require('engine/rollout_leaf.js', { need: ['rolloutWinProb', 'runPlayout', 'census'] });
LOAD.rollout_leaf = ms(t, process.hrtime.bigint());

t = process.hrtime.bigint();
const CS = REL.require('engine/champions_sim.js');
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
dex.species.get('garchomp');                     /* force the lazy tables, so the cost lands here */
LOAD.dex = ms(t, process.hrtime.bigint());

/* ---- THE CENSUS IS NOT A FROZEN SOURCE, AND UNDER A RELEASE IT SILENTLY DISAPPEARS.
 *
 * `rollout_leaf.census()` reads data/rollout-switch-census.json through its own `__dirname/..`, so a
 * copy loaded out of data/releases/<id>/engine/ looks for it in data/releases/<id>/data/ and does not
 * find it. Its documented fallback is switchRate 0 and horizon 0 — **the playout then CANNOT SWITCH**,
 * which is a different playout from the one MILTANK ships and is also a cheaper one. The smoke run hit
 * exactly that and printed a horizon of 0.
 *
 * That is `engine_release.js requireClosure`'s declared gap, stated in its own header: it walks static
 * `require()` edges and cannot see a file opened with `fs.readFileSync`. So the census is read HERE,
 * from the live tree, stamped by content digest, and passed EXPLICITLY into every call — which is what
 * `rolloutWinProb(opts.switchRate)` and `runPlayout(switchRate)` both already take as arguments. */
const CENSUS = (() => {
  const p = D('data', 'rollout-switch-census.json');
  const raw = fs.readFileSync(p, 'utf8');
  const j = JSON.parse(raw);
  const pc = j.pooled && j.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch;
  return { switchRate: (typeof pc === 'number' && pc > 0) ? pc / 100 : 0,
           maxTurns: (j.derived_cap && j.derived_cap.max_turns) || 0,
           generated: j.generated || null,
           digest: require('crypto').createHash('sha256').update(raw).digest('hex').slice(0, 12),
           read_from: 'data/rollout-switch-census.json (LIVE — it is not one of the release SOURCES)' };
})();
LOAD.total_to_engine_ready = ms(T_PROC, process.hrtime.bigint());

/* mulberry32 — the generator rollout_leaf threads through its own playouts. Copied for the same
 * reason backtest_winrate.js copies it: rollout_leaf does not export it, and it is four lines of
 * arithmetic with no semantics of its own. */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- THE TEAMS. `buildPair` is game_differential's and is the repo's ONE converter from a stored
 * sheet to a MEDICHAM body; writing a second one here is the failure CLAUDE.md names by name.
 * Requiring that module is expensive and reads the store, so it is timed separately and EXCLUDED
 * from every per-game figure — it is harness cost, not engine cost. */
let GD = null, TEAMS = null;
function loadTeams() {
  let t0 = process.hrtime.bigint();
  const SWARM = require('./diff_swarm.js');
  TEAMS = SWARM.loadTeams(TEAM_STORE ? { storeDir: TEAM_STORE } : null);
  LOAD.team_pool = ms(t0, process.hrtime.bigint());
  t0 = process.hrtime.bigint();
  GD = require('./game_differential.js');
  LOAD.game_differential_require = ms(t0, process.hrtime.bigint());
}

const BUILD_FAIL = { pair: 0, board: 0 };
function bodies(sheet) {
  try {
    const p = GD.buildPair(sheet, { max: 4 });
    if (!p || p.filter(x => x && x.medi).length < 4) { BUILD_FAIL.pair++; return null; }
    return p.filter(x => x && x.medi);
  } catch (e) { BUILD_FAIL.pair++; return null; }
}

/* FRESH BODIES EVERY PLAYOUT, AND THE FIRST VERSION OF THIS FILE GOT IT WRONG — which is worth
 * leaving written down, because the wrong version produced a NUMBER rather than an error.
 *
 * MEDICHAM mutates the mons it is handed: HP, status, boosts, the bench arrays. Reusing the same
 * bodies makes playout 2 start from wherever playout 1 ended, so the second playout begins on a
 * wiped side and `battleOver` is true immediately. The smoke run reported `mean turns 3.00` with a
 * median of ZERO and a perfectly plausible games/sec — 183/sec, which is simply the cost of
 * discovering the battle is already over. `rollout_leaf.rolloutWinProb` has a comment about exactly
 * this at its playout loop and it is right.
 *
 * `game_differential.freshBodies(pair)` is the repo's rebuild and is what the differential itself
 * uses between games; it is timed SEPARATELY below so the build cost is never folded into ms/turn. */
function freshBodies(pair) { return GD.freshBodies(pair).filter(Boolean); }
function freshState(A, Bt, cap) {
  const S = MEDI.battleInit(A, Bt, {});
  S.maxTurns = cap;
  S._explore = 1.0;
  return S;
}

/* ---- BOARDS for the LEAF arm. Same construction as backtest_winrate.js:mkBoard — party, declared
 * sheet, two actives a side. The sheet matters: `dmgMon` values a body on its DECLARED moves when it
 * has them and on the dataset average when it does not, and those are different amounts of work. */
function mkBoard(sa, sb) {
  const bd = new B.Board();
  const na = sa.slice(0, 4).map(p => p.species), nb = sb.slice(0, 4).map(p => p.species);
  if (na.length < 4 || nb.length < 4) return null;
  bd.setParty('p1', na); bd.setParty('p2', nb);
  for (const p of sa.slice(0, 4)) bd.setSheet('p1', p.species,
    { nature: p.nature || '', item: p.item || '', ability: p.ability || '', moves: p.moves || [] });
  for (const p of sb.slice(0, 4)) bd.setSheet('p2', p.species,
    { nature: p.nature || '', item: p.item || '', ability: p.ability || '', moves: p.moves || [] });
  bd.switchIn('p1', 'a', na[0]); bd.switchIn('p1', 'b', na[1]);
  bd.switchIn('p2', 'a', nb[0]); bd.switchIn('p2', 'b', nb[1]);
  return bd;
}

/* ================= WORKER MODE ==================================================================
 * One child, one arm: N playouts at a fixed cap, on ONE built pair, so the child does no store I/O
 * and the parent is measuring simulation throughput rather than N copies of a 41-second pool build.
 * Prints one JSON line. */
function runWorker(n, cap) {
  loadTeams();
  const pairs = pickPairs(4);
  if (!pairs.length) { console.log(JSON.stringify({ error: 'no buildable pair' })); return; }
  /* WARM THE CHILD BEFORE TIMING IT, AND THE FIRST VERSION OF THIS FILE DID NOT — which made the
   * whole scaling table wrong in one direction.
   *
   * Measured in the parent: the first timed cap runs its first four reps at 2.89 / 1.78 / 1.67 /
   * 1.58 ms per turn and then drops to 0.51 — a 5.6x V8 tier-up that takes roughly 4,000 playouts
   * (~40,000 turns) to complete. A cold child asked for 4,000 playouts therefore spends most of them
   * in the slow regime and reports about 108/sec against a warm 175/sec, and EVERY worker count is
   * depressed by the same effect. That is not "N workers contend"; it is "N workers are cold". */
  const WARM = Math.max(1, +arg('--worker-warm', 4000));
  armPlayout(pairs, cap, Math.max(1, Math.round(WARM / pairs.length)));
  const r = armPlayout(pairs, cap, Math.max(1, Math.round(n / pairs.length)));
  console.log(JSON.stringify({ playouts: r.playouts, turns: r.turns, ms: r.ms, cap, warmed: WARM,
                               playouts_per_sec: r.playouts_per_sec,
                               sim_playouts_per_sec: r.sim_playouts_per_sec,
                               sim_ms_per_turn: r.sim_ms_per_turn,
                               turns_per_sec: r.turns_per_sec }));
}

/* Distinct team pairs off the pinned pool, taken by a deterministic stride so a rerun repeats. The
 * PAIR is kept (not just the bodies) because `freshBodies` needs each body's `spec` to rebuild it. */
function pickPairs(k) {
  const out = [];
  const step = Math.max(1, Math.floor(TEAMS.length / (k * 2 + 4)));
  for (let i = 0; out.length < k && i + step < TEAMS.length; i += step * 2) {
    const sa = TEAMS[i].team, sb = TEAMS[i + step].team;
    const A = bodies(sa), Bt = bodies(sb);
    if (!A || !Bt) continue;
    out.push({ A, B: Bt, sa, sb, ia: i, ib: i + step });
  }
  return out;
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}
function dist(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)).toFixed(2),
           min: s[0], p25: pct(s, 25), p50: pct(s, 50), p75: pct(s, 75), p90: pct(s, 90),
           p99: pct(s, 99), max: s[s.length - 1] };
}

/* ================= ARM: PLAYOUT / GAME =========================================================
 * ONE code path for both, differing only in the horizon, because they ARE one code path: a "whole
 * game" is a playout whose cap does not bind. Reporting them as two functions would invite the
 * reader to think the engine does something different at depth, which it does not. */
function armPlayout(pairs, cap, playoutsPerPair) {
  let buildNs = 0n, playNs = 0n;
  let turns = 0, played = 0, truncated = 0, decided = 0;
  const turnDist = [];
  const t0 = process.hrtime.bigint();
  for (const p of pairs) {
    for (let i = 0; i < playoutsPerPair; i++) {
      let a = process.hrtime.bigint();
      const A = freshBodies(p.A), Bt = freshBodies(p.B);
      buildNs += process.hrtime.bigint() - a;
      a = process.hrtime.bigint();
      const S = freshState(A, Bt, cap);
      RL.runPlayout(S, mulberry(p.ia * 7919 + i * 104729 + 13), 1.0, 'uniform', null, CENSUS.switchRate);
      playNs += process.hrtime.bigint() - a;
      const tn = S.turn || 0;
      turns += tn; played++; turnDist.push(tn);
      if (tn >= cap) truncated++; else decided++;
    }
  }
  const el = ms(t0, process.hrtime.bigint());
  const build = Number(buildNs) / 1e6, play = Number(playNs) / 1e6;
  return { cap, playouts: played, turns, ms: +el.toFixed(2),
           /* SIMULATION ONLY — battleInit plus the turn loop, with body construction taken out.
            * This is the marginal cost a deeper horizon buys more of. */
           sim_ms: +play.toFixed(2),
           sim_playouts_per_sec: +(played / (play / 1000)).toFixed(1),
           sim_ms_per_playout: +(play / played).toFixed(4),
           sim_turns_per_sec: +(turns / (play / 1000)).toFixed(0),
           sim_ms_per_turn: +(play / Math.max(1, turns)).toFixed(4),
           /* BODY CONSTRUCTION — `freshBodies`, paid once per playout and FLAT in the horizon. */
           build_ms: +build.toFixed(2), build_ms_per_playout: +(build / played).toFixed(4),
           /* BOTH TOGETHER — what a caller that must rebuild its bodies each time actually pays. */
           playouts_per_sec: +(played / (el / 1000)).toFixed(1),
           ms_per_playout: +(el / played).toFixed(4),
           turns_per_sec: +(turns / (el / 1000)).toFixed(0),
           ms_per_turn: +(el / Math.max(1, turns)).toFixed(4),
           truncated_pct: +(100 * truncated / played).toFixed(1),
           reached_a_result_pct: +(100 * decided / played).toFixed(1),
           turn_distribution: dist(turnDist) };
}

/* ================= ARM: LEAF ===================================================================
 * The call MILTANK actually makes. n samples, each paying buildSide twice. */
function armLeaf(boards, cap, n) {
  const t0 = process.hrtime.bigint();
  let calls = 0, samples = 0, turns = 0, nulls = 0, trunc = 0;
  const meanTurns = [];
  boards.forEach((bd, i) => {
    const r = RL.rolloutWinProb(bd, 'p1', { n, dex, seed: i * 7919 + 13, explore: 1.0,
                                            foePolicy: 'uniform', maxTurns: cap,
                                            switchRate: CENSUS.switchRate });
    calls++;
    if (!r) { nulls++; return; }
    samples += r.n; turns += (r.meanTurns || 0) * r.n; trunc += r.truncated || 0;
    meanTurns.push(+r.meanTurns.toFixed(2));
  });
  const el = ms(t0, process.hrtime.bigint());
  return { cap, n_per_call: n, leaf_calls: calls, unbuildable_boards: nulls,
           playouts: samples, turns: Math.round(turns), ms: +el.toFixed(2),
           ms_per_leaf_call: +(el / Math.max(1, calls - nulls)).toFixed(2),
           leaf_calls_per_sec: +((calls - nulls) / (el / 1000)).toFixed(2),
           ms_per_playout: +(el / Math.max(1, samples)).toFixed(4),
           playouts_per_sec: +(samples / (el / 1000)).toFixed(1),
           ms_per_turn: +(el / Math.max(1, turns)).toFixed(4),
           mean_turns_per_playout: +(turns / Math.max(1, samples)).toFixed(2),
           truncated: trunc, truncated_pct: +(100 * trunc / Math.max(1, samples)).toFixed(1),
           mean_turns_per_call: meanTurns };
}

/* ================= MAIN ========================================================================= */
if (WORKER) { runWorker(+WORKER, +arg('--cap', String(CENSUS.maxTurns || 14))); return; }

console.log('');
console.log('MEDICHAM SPEED — throughput only. NO claim is made here about accuracy.');
console.log('');
console.log('  release        ' + REL.id + (REL_ID ? '' : '   (pointer default)'));
console.log('  team store     ' + (TEAM_STORE || 'LIVE — OPS appends to it; this run is NOT repeatable'));
console.log('  node           ' + process.version + '   ' + require('os').cpus().length + ' cores, '
  + (require('os').totalmem() / 1e9).toFixed(1) + ' GB, ' + (require('os').freemem() / 1e9).toFixed(1) + ' GB free');
console.log('  census horizon ' + CENSUS.maxTurns + ' turns, switch rate ' + CENSUS.switchRate
  + '   (data/rollout-switch-census.json, ' + CENSUS.generated + ')');
console.log('');

/* BARE PROCESS START, so "fixed cost" can be split into what node costs and what WE cost. Measured
 * by spawning, not guessed: the parent's own T_PROC starts after node has already booted. */
{
  const { spawnSync } = require('child_process');
  const legs = [];
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint();
    spawnSync(process.execPath, ['-e', '0'], { cwd: ROOT });
    legs.push(ms(t0, process.hrtime.bigint()));
  }
  LOAD.bare_node_start = +Math.min.apply(null, legs).toFixed(1);
}

loadTeams();
console.log('  pinned pool: ' + TEAMS.length.toLocaleString() + ' distinct teams');

const pairs = pickPairs(GAME_PAIRS);
const boards = [];
{
  const step = Math.max(1, Math.floor(TEAMS.length / (BOARDS * 2 + 4)));
  for (let i = 0; boards.length < BOARDS && i + step < TEAMS.length; i += step * 2) {
    const bd = mkBoard(TEAMS[i].team, TEAMS[i + step].team);
    if (bd) boards.push(bd); else BUILD_FAIL.board++;
  }
}
console.log('');
console.log('  FIXED COST — paid once per process, amortised over every playout after it');
console.log('');
for (const k of ['bare_node_start', 'release_open', 'engine_data', 'medicham', 'board',
                 'rollout_leaf', 'dex', 'total_to_engine_ready', 'team_pool',
                 'game_differential_require'])
  if (LOAD[k] !== undefined) console.log('    ' + k.padEnd(28) + LOAD[k].toFixed(0).padStart(8) + ' ms');
console.log('');
console.log('  built ' + pairs.length + ' team pairs and ' + boards.length + ' boards'
  + '   (pair build failures ' + BUILD_FAIL.pair + ', board ' + BUILD_FAIL.board + ')');
console.log('');

const RESULT = { generated: new Date().toISOString(), by: 'engine/bench_speed.js',
  what: 'THROUGHPUT ONLY. How fast MEDICHAM plays, for rollout budgeting. Makes no accuracy claim; '
      + 'the simulator is under quarantine for correctness and this file does not lift it.',
  engine_release: REL.id, team_store_pinned_to: TEAM_STORE || null,
  node: process.version, cores: require('os').cpus().length,
  priority: has('--normal-priority') ? 'NORMAL' : 'as launched (BelowNormal if via tools/lownode.cmd)',
  census: CENSUS, reps: REPS, load_ms: LOAD, team_pool_teams: TEAMS.length,
  pairs_built: pairs.length, boards_built: boards.length, build_failures: BUILD_FAIL,
  leaf_config: { n: LEAF_N, explore: 1.0, foePolicy: 'uniform',
                 source: 'engine/miltank.js DEFAULTS (n=200, explore=1.0, foePolicy=uniform, turns=census)' },
  arms: {} };

function best(rows, key) {
  const v = rows.map(r => r[key]).filter(x => typeof x === 'number');
  const s = v.slice().sort((a, b) => a - b);
  return { fastest: s[s.length - 1], slowest: s[0], spread_pct: s[0] ? +(100 * (s[s.length - 1] - s[0]) / s[0]).toFixed(1) : null, all: v };
}
function bestLow(rows, key) {
  const v = rows.map(r => r[key]).filter(x => typeof x === 'number');
  const s = v.slice().sort((a, b) => a - b);
  return { fastest: s[0], slowest: s[s.length - 1], spread_pct: s[0] ? +(100 * (s[s.length - 1] - s[0]) / s[0]).toFixed(1) : null, all: v };
}

/* ---- WARM-UP, DISCARDED. V8 tiers a hot function up over the first few hundred calls, so the
 * FIRST arm to run is measured cold and every later arm inherits its optimisation. The smoke run
 * showed exactly that and it inverted a result: cap 60 came out FASTER per playout than cap 14
 * (6.94 ms vs 9.57 ms) purely because it ran second, and the leaf-minus-playout overhead came out
 * NEGATIVE. A benchmark whose arm order changes its sign is measuring the JIT. */
{
  const t0 = process.hrtime.bigint();
  const wp = pairs.slice(0, Math.min(4, pairs.length));
  for (let r = 0; r < 3; r++) armPlayout(wp, 20, 12);
  if (boards.length) armLeaf(boards.slice(0, Math.min(3, boards.length)), 20, Math.min(40, LEAF_N));
  RESULT.warmup_ms = +ms(t0, process.hrtime.bigint()).toFixed(0);
  console.log('  warm-up (discarded): ' + RESULT.warmup_ms + ' ms');
  console.log('');
}

/* ---- PLAYOUT / GAME across the caps, REPS times each. */
console.log('  PLAYOUT ARM — runPlayout, explore=1.0, uniform, ' + pairs.length + ' pairs\n');
console.log('    cap'.padEnd(8) + 'playouts'.padStart(10) + 'sim games/s'.padStart(13)
  + 'sim ms/game'.padStart(13) + 'sim ms/turn'.padStart(13) + 'build ms'.padStart(10)
  + '+build g/s'.padStart(12) + 'mean turns'.padStart(12) + 'trunc%'.padStart(9));
const PER_PAIR = Math.max(1, +arg('--per-pair', 20));
for (const cap of CAPS) {
  const rows = [];
  for (let r = 0; r < REPS; r++) rows.push(armPlayout(pairs, cap, PER_PAIR));
  const f = rows.reduce((a, b) => (b.sim_playouts_per_sec > a.sim_playouts_per_sec ? b : a));
  RESULT.arms['playout_cap_' + cap] = { fastest_of: REPS, fastest: f, reps: rows,
    sim_playouts_per_sec_spread: best(rows, 'sim_playouts_per_sec'),
    sim_ms_per_turn_spread: bestLow(rows, 'sim_ms_per_turn') };
  console.log('    ' + String(cap).padEnd(6) + String(f.playouts).padStart(10)
    + String(f.sim_playouts_per_sec).padStart(13) + f.sim_ms_per_playout.toFixed(3).padStart(13)
    + f.sim_ms_per_turn.toFixed(4).padStart(13) + f.build_ms_per_playout.toFixed(3).padStart(10)
    + String(f.playouts_per_sec).padStart(12)
    + f.turn_distribution.mean.toFixed(2).padStart(12) + (f.truncated_pct + '%').padStart(9));
}
console.log('');
{
  const deep = RESULT.arms['playout_cap_' + CAPS[CAPS.length - 1]];
  console.log('    turn distribution at cap ' + deep.fastest.cap + ': '
    + JSON.stringify(deep.fastest.turn_distribution));
  console.log('');
}

/* ---- LEAF, the path miltank pays for. */
console.log('  LEAF ARM — rolloutWinProb n=' + LEAF_N + ', explore=1.0, uniform, ' + boards.length + ' boards\n');
console.log('    cap'.padEnd(8) + 'leaf/sec'.padStart(10) + 'ms/leaf'.padStart(11)
  + 'playouts/s'.padStart(12) + 'ms/playout'.padStart(12) + 'ms/turn'.padStart(10) + 'mean turns'.padStart(12));
for (const cap of (LEAF_CAPS.length ? LEAF_CAPS : CAPS)) {
  const rows = [];
  for (let r = 0; r < REPS; r++) rows.push(armLeaf(boards, cap, LEAF_N));
  const f = rows.reduce((a, b) => (b.playouts_per_sec > a.playouts_per_sec ? b : a));
  RESULT.arms['leaf_cap_' + cap] = { fastest_of: REPS, fastest: f, reps: rows,
    playouts_per_sec_spread: best(rows, 'playouts_per_sec'),
    ms_per_leaf_call_spread: bestLow(rows, 'ms_per_leaf_call') };
  console.log('    ' + String(cap).padEnd(6) + String(f.leaf_calls_per_sec).padStart(10)
    + f.ms_per_leaf_call.toFixed(1).padStart(11) + String(f.playouts_per_sec).padStart(12)
    + f.ms_per_playout.toFixed(4).padStart(12) + f.ms_per_turn.toFixed(4).padStart(10)
    + f.mean_turns_per_playout.toFixed(2).padStart(12));
}
console.log('');

/* ---- SEEDING OVERHEAD: leaf minus playout, per playout, at the shipped cap. */
{
  const cap = CENSUS.maxTurns && CAPS.includes(CENSUS.maxTurns) ? CENSUS.maxTurns : CAPS[Math.floor(CAPS.length / 2)];
  const L = RESULT.arms['leaf_cap_' + cap], P = RESULT.arms['playout_cap_' + cap];
  if (L && P) {
    const over = L.fastest.ms_per_playout - P.fastest.sim_ms_per_playout;
    RESULT.seeding_overhead = { cap, ms_per_playout_leaf: L.fastest.ms_per_playout,
      ms_per_playout_bare: P.fastest.sim_ms_per_playout, ms_per_playout_seeding: +over.toFixed(4),
      pct_of_leaf: +(100 * over / L.fastest.ms_per_playout).toFixed(1),
      what: 'buildSide x2 + field/side-state seeding, paid once per SAMPLE. Fixed in the horizon: it '
          + 'does not shrink when the cap does, so it dominates a short rollout.' };
    console.log('  SEEDING OVERHEAD at cap ' + cap + ': ' + over.toFixed(4) + ' ms per playout, '
      + RESULT.seeding_overhead.pct_of_leaf + '% of the leaf');
    console.log('');
  }
}

/* ---- PROCESS SCALING and the extrapolation, in one async block: children are awaited, and a
 * CommonJS module that must also work under a top-level `return` cannot use top-level await. The
 * arms are run in SERIES on purpose — two arms running at once measure each other. */
(async () => {
  if (WORKERS.length) {
    const cap = CENSUS.maxTurns || 14;
    const PLAYOUTS = Math.max(1, +arg('--worker-playouts', 4000));
    const { spawn } = require('child_process');
    const runN = (w) => new Promise((resolve) => {
      const t0 = process.hrtime.bigint();
      let left = w; const rs = [];
      for (let i = 0; i < w; i++) {
        const a = ['--worker', String(PLAYOUTS), '--cap', String(cap), '--release', REL.id];
        if (TEAM_STORE) a.push('--team-store', TEAM_STORE);
        const c = spawn(process.execPath, [__filename].concat(a), { cwd: ROOT });
        let buf = '';
        c.stdout.on('data', d => { buf += d; });
        c.on('close', () => {
          try { rs.push(JSON.parse(buf.trim().split('\n').pop())); } catch (e) { rs.push({ error: String(buf).slice(-200) }); }
          if (--left === 0) resolve({ wall_ms: ms(t0, process.hrtime.bigint()), rs, workers: w });
        });
      }
    });
    console.log('  PROCESS SCALING — ' + PLAYOUTS + ' playouts per child, cap ' + cap
      + ' (each child pays its own ~' + LOAD.total_to_engine_ready.toFixed(0) + ' ms load; wall includes it)\n');
    /* THE HEADLINE IS THE EXCLUDING-STARTUP AGGREGATE, and saying which is which matters. A rollout
     * worker pool is started once and kept, so its per-second rate is the children's own inner rate;
     * the wall-clock figure beside it still carries the ~4 s each child spends loading, and is what a
     * one-shot fork-per-decision design would actually get. Both are printed. */
    console.log('    workers'.padEnd(11) + 'wall ms'.padStart(10) + 'warm p/sec'.padStart(13)
      + 'per worker'.padStart(13) + 'efficiency'.padStart(12) + 'incl startup'.padStart(15));
    RESULT.arms.scaling = [];
    let base = null;
    for (const w of WORKERS) {
      const legs = [];
      for (let r = 0; r < Math.min(REPS, 2); r++) legs.push(await runN(w));
      const f = legs.reduce((a, b) => (b.wall_ms < a.wall_ms ? b : a));
      const okPlayouts = f.rs.reduce((a, x) => a + (x.playouts || 0), 0);
      const inner = f.rs.reduce((a, x) => a + (x.playouts_per_sec || 0), 0);
      const agg = okPlayouts / (f.wall_ms / 1000);
      if (base === null) base = inner;
      const row = { workers: w, wall_ms: +f.wall_ms.toFixed(0), playouts: okPlayouts,
        aggregate_playouts_per_sec_including_startup: +agg.toFixed(1),
        aggregate_playouts_per_sec_excluding_startup: +inner.toFixed(1),
        per_worker_playouts_per_sec: +(inner / w).toFixed(1),
        scaling_efficiency_vs_1: +(inner / (base * w)).toFixed(3),
        errors: f.rs.filter(x => x.error).length, legs };
      RESULT.arms.scaling.push(row);
      console.log('    ' + String(w).padEnd(9) + String(row.wall_ms).padStart(10)
        + String(row.aggregate_playouts_per_sec_excluding_startup).padStart(13)
        + String(row.per_worker_playouts_per_sec).padStart(13)
        + (row.scaling_efficiency_vs_1.toFixed(2) + 'x').padStart(12)
        + String(row.aggregate_playouts_per_sec_including_startup).padStart(15));
    }
    console.log('');
  }

  /* ---- WHAT IT BUYS. The extrapolation a rollout budget is actually written against. */
  const shippedCap = CENSUS.maxTurns || 14;
  const L = RESULT.arms['leaf_cap_' + shippedCap] || RESULT.arms['leaf_cap_' + CAPS[0]];
  if (L) {
    const pps = L.fastest.playouts_per_sec;
    const budgets = [1000, 3000, 5000, 15000, 20000];
    RESULT.thinking_budget = budgets.map(b => ({
      budget_ms: b, playouts: Math.round(pps * b / 1000),
      leaf_calls_at_n200: +(pps * b / 1000 / 200).toFixed(1),
      cap: shippedCap, single_process: true }));
    console.log('  WHAT A THINKING BUDGET BUYS — single process, cap ' + shippedCap
      + ', leaf n=' + LEAF_N + '\n');
    console.log('    budget'.padEnd(12) + 'playouts'.padStart(12) + 'leaf calls at n=200'.padStart(22));
    for (const r of RESULT.thinking_budget)
      console.log('    ' + (r.budget_ms + ' ms').padEnd(12) + String(r.playouts).padStart(12)
        + String(r.leaf_calls_at_n200).padStart(22));
    console.log('');
    console.log('    miltank.js DEFAULTS budgetMs=20000, n=200 -> '
      + RESULT.thinking_budget[RESULT.thinking_budget.length - 1].leaf_calls_at_n200
      + ' leaf calls per decision on one core.');
    console.log('');
  }

  const outPath = OUT ? path.resolve(ROOT, OUT) : D('data', 'medicham-speed.json');
  fs.writeFileSync(outPath, JSON.stringify(RESULT, null, 2) + '\n');
  console.log('  wrote ' + path.relative(ROOT, outPath) + '  ('
    + fs.statSync(outPath).size.toLocaleString() + ' bytes)');
  console.log('');
})();
