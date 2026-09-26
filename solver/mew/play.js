/* ABRA-HEAP: 1536
 * solver/mew/play.js — ONE worker process of MEW (self-play) or of a MACHAMP gate match. Long-lived: it loads
 * the frozen engine once and plays its whole shard.
 *
 *   node solver/mew/play.js --mode selfplay --release <id> --league <league.json> --games N --seed S
 *                           --shard i --shards n --out <shard.jsonl.gz> [--cap 50] [--human <games.jsonl> | --team-store <dir>]
 *   node solver/mew/play.js --mode match    --release <id> --x <spec.json> --y <spec.json> --pairs N --pair-seed S
 *                           --seed S --shard i --shards n --out <shard.jsonl> [--cap 50] [--human <games.jsonl>]
 *
 * Normally started by solver/mew/run.js (self-play) or solver/machamp/gate.js (a match), which fork the shards
 * and merge what they write. Each shard also writes <out>.summary.json when it finishes.
 *
 * THE ENGINE IS A FROZEN RELEASE (solver/arena/engine.js). --release is REQUIRED: self-play data and gate
 * results are keyed by the release they were played on (solver/PLAN.md §6), and every record carries its id.
 *
 * SELF-PLAY. Game g of the run (g = shard, shard + n, …) draws a TRAIN team pair (solver/mew/pairs.js) and an
 * opponent from the league by a seeded coin: `current` plays `current`, `previous` or the human `clone` with
 * the league's weights. The current agent alternates seats. Each game record holds the sheets, the brought
 * fours, the whole public history (the prior adapter's per-turn public state and both joints — enough to
 * re-featurise every position and every decision later, through the same encoders the nets use), and one
 * row per SEARCHED decision: the side, its brought_seen view, the root value v (for the deciding side), the
 * row mix x and column mix y, each row's DODUO cell (a, b) and candidate keys, and the search counters.
 * Forced decisions and the human clone's argmax are not training targets and are not recorded as decisions. A search
 * FALLBACK (too empty to solve, or the search threw) is recorded in the game's `fallbacks` list with the joint played.
 *
 * MATCH. The pairs are `--pairs` TEST team pairs (both players held out of every net's training data), picked
 * by a seeded stride. Each pair is played twice on the SAME battle seed with the bots swapped (the arena's
 * paired seating), so each bot plays each sheet once.
 *
 * INFORMATION (--info honest | omniscient; 2026-09-26, docs/_reports/2026-09-26-gen5-honest-and-ladder-prep.md).
 *   honest      THE DEFAULT FOR A MATCH, and so for every strength claim (sprt.js, gate.js). The true battle has hidden
 *               spreads: every body on both sides carries a Stat Point spread drawn per team pair from XATU's self-play
 *               generator (solver/xatu/worlds.js truthSpreads, seeded by the battle seed, so both seatings of a pair
 *               play the same truth) under its sheet's nature. Each decision is taken on a PUBLIC VIEW of that battle
 *               (honestView below): the decider's own side exact; the opponent's unrevealed back line replaced by
 *               XATU's MAP back pair, every opponent body at zero SP under its nature, a revealed body's HP laid from
 *               the percentage the Champions client shows. A MILTANK bot's worlds then draw the back pair from XATU's
 *               posterior and every opponent spread from XATU's spread belief (solver/xatu/worlds.js — the SAME
 *               module ROTOM's miltank-gen5 policy uses). The chosen joint is played on the TRUE battle.
 *   omniscient  the pre-2026-09-26 arena, kept as a LABELLED option: no spreads exist (every body the table's flat
 *               line), and the searcher is handed the true battle (its worlds still redraw the unrevealed back line,
 *               uniformly). Self-play's default, because the MACHAMP loop's recipes were pre-registered on it.
 * The mode is on every match line (`info`) and in the shard summary; the honest counters are in `honest`.
 *
 * A GAME ENDS on a wipe (`isTerminal`) or at --cap turns, where the engine's HP rule (`horizonScore`) decides it
 * and the game is counted as capped. An error ends the game, is counted, and the game scores nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode already set it */ }
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
require('../arena/env.js');
const REL_ID = flag('--release', null);
if (!REL_ID) { console.error('mew/play: --release is required (self-play and gates play a FROZEN engine)'); process.exit(2); }
const ENGINE = require('../arena/engine.js').load(REL_ID);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const PAIRS = require('./pairs.js');
const AG = require('./agent.js').create(API, { buildBody: T.buildBody });
const PA0 = require('../miltank/prior_adapter.js').create(API, null);   // the game's history recorder (model-free)

const MODE = flag('--mode', 'selfplay');
const INFO = flag('--info', MODE === 'match' ? 'honest' : 'omniscient');
if (!['honest', 'omniscient'].includes(INFO)) { console.error('mew/play: --info must be honest or omniscient'); process.exit(2); }
/* DELIBERATE BREAK (env MACHAMP_BREAK=seat): in a match, X sits on side A in both games of a pair — the paired
 * seating is gone. solver/tests/test-machamp.js GATE must go red.
 * DELIBERATE BREAK (env MACHAMP_BREAK=fallback): a search fallback is not recorded (the pre-2026-09-25 behaviour).
 * solver/tests/test-machamp.js FALLBACK must go red. */
const BREAK = process.env.MACHAMP_BREAK || '';
const SHARD = +flag('--shard', 0), SHARDS = +flag('--shards', 1);
const SEED = +flag('--seed', 1), CAP = +flag('--cap', 50);
const OUT = flag('--out', null);
const readJ = f => JSON.parse(fs.readFileSync(f, 'utf8'));

const hash32 = (a, b) => { let h = (a * 2654435761 ^ b * 2246822519) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return h >>> 0; };
const decStats = [];
/* THE MEGA COUNTER per agent name, on the sides that could mega (solver/arena/mega_rate.js); in the shard summary */
const MR = require('../arena/mega_rate.js');
/* THE PROTECT COUNTER per game and side (solver/arena/protect_stats.js; docs/_reports/2026-09-26-protect-overuse.md) */
const PS = require('../arena/protect_stats.js').create(API);
const MEGA = {};
/* THE CLICK RATES per side per game (solver/arena/click_rates.js, 2026-09-26): Protect repeats and damaging clicks into an
 * immune body, read on the true battle before each step; on every match row as clicks.x / clicks.y */
const CR = require('../arena/click_rates.js').create(API);
const megaT = name => (MEGA[name] || (MEGA[name] = MR.tally()));
const t0 = Date.now();
/* running search counters, snapshotted onto every match line: a SPRT kills its workers at the bound and a killed
 * worker writes no summary, so the counters must already be on disk (solver/machamp/sprt.js reads the last line) */
const RUN = { searched: 0, playouts: 0, cells: 0, unfilled: 0, zero_playouts: 0, fallback_decisions: 0 };

/* ---- HONEST INFORMATION (see the header): solver/xatu/worlds.js arenaGame / arenaView ---- */
const XW = AG.XW;
const HON = XW.HON;

async function playGame(G, botA, botB, seed, recordFor) {
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) return { unbuildable: true };
  if (INFO === 'honest') {   // the TRUE spreads, the same for both seatings of a pair (seeded by the battle seed)
    const truth = XW.truthSpreads(G.sheets, seed);
    for (const [p, t] of [['p1', a], ['p2', b]]) for (const m of t.team) { XW.applySpread(m, truth[p][m._solverSheet], G.sheets[p][m._solverSheet]); HON.truth_bodies++; }
  }
  const rng = API.makeRng(seed);
  const S = API.newBattle(a.team, b.team, { rng });
  const H = INFO === 'honest' ? XW.arenaGame(G, S, PA0) : null;
  const ctx = PA0.newGame(G);
  const mg = MR.game(API, { A: megaT(botA.name), B: megaT(botB.name) }, { trace: MODE === 'match' });   // match: the mega TIMING timeline per game (mega_timing.js)
  const decisions = [], fallbacks = [];
  const pg = PS.game();
  let err = null;
  const ms = { A: [], B: [] };
  const clicks = { A: CR.tally(), B: CR.tally() };
  try {
    while (!API.isTerminal(S) && S.turn < CAP) {
      const ch = {};
      for (const [side, bot] of [['A', botA], ['B', botB]]) {
        const t = Date.now();
        const hv = H ? XW.arenaView(H, G, S, side, PA0) : null;
        const SV = hv ? hv.V : S;
        ch[side] = await bot.choose(SV, side, ctx, hv ? hv.hb : undefined);
        ms[side].push(Date.now() - t);
        const info = ch[side].info || {};
        if (info.playouts != null) { decStats.push({ playouts: info.playouts, cells: info.m * info.n, unfilled: info.unfilled, ms: info.ms });
          RUN.searched++; RUN.playouts += info.playouts; RUN.cells += info.m * info.n; RUN.unfilled += info.unfilled || 0; if (!info.playouts) RUN.zero_playouts++; }
        if (info.fallback) { RUN.fallback_decisions++; RUN['fallback_' + info.fallback] = (RUN['fallback_' + info.fallback] || 0) + 1; }   // MILTANK's too-empty-to-solve prior fallback (search.js), per kind
        if (recordFor && recordFor[side] && info.rec) {
          const rec = info.rec;
          const jc = bot.PA.jointCells(ctx, SV, side, side, rec.rows);
          const bs = PA0.row(ctx, SV, side).game.brought_seen;
          decisions.push({ t: ctx.hist.length, side, bs, v: info.value, x: rec.x.map(z => +z.toFixed(5)), y: rec.y ? rec.y.map(z => +z.toFixed(5)) : null,
            cells: jc ? jc.cells : null, keys: jc ? jc.keys : null, n: jc ? jc.n : null, m: info.m, nc: info.n, playouts: info.playouts,
            unfilled: info.unfilled, pick: info.pick, ms: info.ms, agent: bot.name,
            A: rec.A.map(r => r.map(z => +z.toFixed(4))) });
        } else if (recordFor && recordFor[side] && info.fallback && !info.forced && BREAK !== 'fallback') {
          /* THE SEARCH FELL BACK (the table was too empty to solve, or the search threw) and played the ranking prior's
           * top legal joint. Until 2026-09-25 these decisions were not recorded at all, so the training data held no
           * trace of the positions where the search was starved. They go in a SEPARATE list (`fallbacks`), so every
           * consumer of `decisions` (x·A·y = v, the root value) is untouched; build_doduo.js reads both. The target is
           * the joint actually played, on its DODUO cell. */
          const jc = bot.PA.jointCells(ctx, SV, side, side, [ch[side].joint]);
          const bs = PA0.row(ctx, SV, side).game.brought_seen;
          fallbacks.push({ t: ctx.hist.length, side, bs, fb: info.fallback === true ? 'threw' : String(info.fallback), x: [1],
            cells: jc ? jc.cells : null, keys: jc ? jc.keys : null, n: jc ? jc.n : null, m: 1, nc: info.n || 1,
            playouts: info.playouts == null ? null : info.playouts, unfilled: 0, ms: info.ms == null ? null : info.ms, agent: bot.name });
        }
      }
      CR.add(clicks.A, S, 'A', ch.A.joint); CR.add(clicks.B, S, 'B', ch.B.joint);
      PA0.record(ctx, S, ch.A.joint, ch.B.joint);
      mg.decide(S, 'A', ch.A.joint); mg.decide(S, 'B', ch.B.joint);
      pg.before(S, ch.A.joint, ch.B.joint);
      API.stepInPlace(S, ch.A.joint, ch.B.joint, rng);
      pg.after(S);
      mg.stepped(S);
    }
  } catch (e) { err = String(e && e.stack || e).slice(0, 400); }
  mg.end();
  let vA = null, capped = false;
  if (!err) { if (API.isTerminal(S)) vA = API.winner(S); else { vA = API.horizonScore(S); capped = true; } }
  return { vA, capped, err, turns: S.turn, hist: ctx.hist, decisions, fallbacks, ms, mega: mg.detail(), clicks, protect: pg.out() };
}

async function selfplay() {
  const L = readJ(flag('--league'));
  const N = +flag('--games', 100);
  const P = PAIRS.load({ file: flag('--human', undefined), teamStore: flag('--team-store', undefined) });
  const pool = P.train;
  const agents = {};
  for (const k of ['current', 'previous', 'clone']) if (L[k]) agents[k] = AG.load(L[k]);
  const w = Object.assign({ current: 0.6, previous: 0.2, clone: 0.2 }, L.weights || {});
  if (!agents.previous) { w.current += w.previous; w.previous = 0; }
  const wsum = w.current + w.previous + w.clone;
  const counts = { games: 0, errors: 0, capped: 0, unbuildable: 0, decisions: 0, fallback_decisions: 0, decisions_unmapped_rows: 0, rows: 0, opp: { current: 0, previous: 0, clone: 0 }, current_score: { current: [0, 0], previous: [0, 0], clone: [0, 0] } };
  if (OUT) fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (OUT && fs.existsSync(OUT)) fs.unlinkSync(OUT);   // this shard's own output from an earlier attempt of the same run
  for (let g = SHARD; g < N; g += SHARDS) {
    const h = hash32(SEED, g);
    let G = pool[h % pool.length];
    const u = (hash32(SEED + 17, g) / 4294967296) * wsum;
    const oppKey = u < w.current ? 'current' : u < w.current + w.previous ? 'previous' : 'clone';
    const curA = (g & 1) === 0;
    const cur = agents.current.bot(SEED * 7919 + g * 2 + 1, { record: true });
    const opp = agents[oppKey].bot(SEED * 7919 + g * 2 + 2, { record: true });
    const [bA, bB] = curA ? [cur, opp] : [opp, cur];
    const recordFor = { A: bA.kind === 'miltank', B: bB.kind === 'miltank' };
    let r = await playGame(G, bA, bB, SEED * 1000003 + g, recordFor);
    for (let tries = 1; r.unbuildable && tries < 20; tries++) { counts.unbuildable++; G = pool[hash32(SEED + tries, g) % pool.length]; r = await playGame(G, bA, bB, SEED * 1000003 + g, recordFor); }
    counts.games++; counts.opp[oppKey]++;
    if (r.err) counts.errors++;
    if (r.capped) counts.capped++;
    counts.decisions += r.decisions.length; counts.fallback_decisions += r.fallbacks.length;
    for (const d of r.decisions) { counts.rows += d.m; if (d.cells) counts.decisions_unmapped_rows += d.cells.filter(c => !c).length; }
    if (r.vA != null) { const vCur = curA ? r.vA : 1 - r.vA; counts.current_score[oppKey][0] += vCur; counts.current_score[oppKey][1]++; }
    const rec = { g, id: G.id, release: ENGINE.id, run_seed: SEED, battle_seed: SEED * 1000003 + g, agents: { A: bA.name, B: bB.name }, opp: oppKey, cur_side: curA ? 'A' : 'B',
      sheets: G.sheets, brought: G.brought, vA: r.vA, capped: r.capped, err: r.err, turns: r.turns, hist: r.hist, decisions: r.decisions, fallbacks: r.fallbacks };
    if (OUT) fs.appendFileSync(OUT, zlib.gzipSync(JSON.stringify(rec) + '\n'));
    if (counts.games % 10 === 0) console.log(`  [shard ${SHARD}] ${counts.games} games  ${counts.decisions} decisions  errors ${counts.errors}  fallbacks ${AG.COUNTERS.fallbacks}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  return { counts, agents: Object.fromEntries(Object.entries(agents).map(([k, a]) => [k, { name: a.name, spec: a.spec, digests: a.digests }])), weights: w,
           pool: { pool_source: P.kind === 'team-store' ? { kind: 'team-store', file: P.file, file_sha256: P.file_sha256, pool_digest: P.pool_digest } : { kind: 'human-dataset', file: P.file }, file: P.file, train_pairs: pool.length, counts: P.counts } };
}

async function match() {
  const X = AG.load(readJ(flag('--x'))), Y = AG.load(readJ(flag('--y')));
  const NP = +flag('--pairs', 100), PS = +flag('--pair-seed', 1);
  const P = PAIRS.load({ file: flag('--human', undefined), teamStore: flag('--team-store', undefined) });
  /* --cycle: more pairs than the test split holds — pair index pi plays test pair pi mod the split size, each time on
   * its own battle seed (the SPRT's paired-seed budget; solver/machamp/sprt.js) */
  const CYCLE = argv.includes('--cycle');
  const base = PAIRS.pick(P.test, CYCLE ? P.test.length : NP, PS);
  const list = CYCLE ? Array.from({ length: NP }, (_, i) => base[i % base.length]) : base;
  const per = [];
  const counts = { games: 0, errors: 0, capped: 0, unbuildable: 0 };
  for (let pi = SHARD; pi < list.length; pi += SHARDS) {
    const G = list[pi];
    const seed = SEED * 100000 + pi;
    for (const xIsA of (BREAK === 'seat' ? [true, true] : [true, false])) {
      const bx = X.bot(SEED * 7919 + pi * 4 + (xIsA ? 1 : 3)), by = Y.bot(SEED * 7919 + pi * 4 + (xIsA ? 2 : 4));
      const r = await playGame(G, xIsA ? bx : by, xIsA ? by : bx, seed, null);
      if (r.unbuildable) { counts.unbuildable++; per.push({ pi, id: G.id, xSide: xIsA ? 'A' : 'B', unbuildable: true }); continue; }
      counts.games++; if (r.err) counts.errors++; if (r.capped) counts.capped++;
      const vX = r.err ? null : (xIsA ? r.vA : 1 - r.vA);
      per.push({ pi, id: G.id, xSide: xIsA ? 'A' : 'B', seed, info: INFO, vX, turns: r.turns, capped: r.capped, err: r.err,
                 ms_x: r.ms[xIsA ? 'A' : 'B'], ms_y: r.ms[xIsA ? 'B' : 'A'],
                 mega: r.mega ? { x: r.mega[xIsA ? 'A' : 'B'], y: r.mega[xIsA ? 'B' : 'A'] } : null,
                 clicks: r.clicks ? { x: r.clicks[xIsA ? 'A' : 'B'], y: r.clicks[xIsA ? 'B' : 'A'] } : null,
                 protect: r.protect ? { x: r.protect[xIsA ? 'A' : 'B'], y: r.protect[xIsA ? 'B' : 'A'] } : null,
                 ctr: Object.assign({ fallbacks: AG.COUNTERS.fallbacks, decisions: AG.COUNTERS.decisions, forced: AG.COUNTERS.forced, honest: AG.COUNTERS.honest || 0, stall_dropped: AG.COUNTERS.stallDropped || 0, quiet_held: AG.R.COUNTERS.quietHeld || 0, quiesced: AG.R.COUNTERS.quiesced || 0, gates: JSON.parse(JSON.stringify(AG.COUNTERS.gates || {})) }, RUN,
                   INFO === 'honest' ? { hon_views: HON.views, hon_back_xatu: HON.back_xatu, hon_back_error: HON.back_error, xw: Object.assign({}, XW.COUNTERS) } : {}) });
    }
    if (OUT) fs.writeFileSync(OUT, per.map(p => JSON.stringify(p)).join('\n') + '\n');
    console.log(`  [shard ${SHARD}] pair ${pi}  games ${counts.games}  errors ${counts.errors}  fallbacks ${AG.COUNTERS.fallbacks}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  return { counts, per, x: { name: X.name, spec: X.spec, digests: X.digests }, y: { name: Y.name, spec: Y.spec, digests: Y.digests },
           pool: { pool_source: P.kind === 'team-store' ? { kind: 'team-store', file: P.file, file_sha256: P.file_sha256, pool_digest: P.pool_digest } : { kind: 'human-dataset', file: P.file }, file: P.file, test_pairs: P.test.length, picked: list.length, ids_sha256: P.ids_sha256(list), counts: P.counts } };
}

(async () => {
  const r = MODE === 'match' ? await match() : await selfplay();
  const summary = { mode: MODE, info: INFO, honest: INFO === 'honest' ? Object.assign({}, HON, { worlds: XW.COUNTERS }) : null, break: BREAK || null, shard: SHARD, shards: SHARDS, seed: SEED, cap: CAP, engine_release: ENGINE.id, release_stamp: ENGINE.stamp, argv, wall_s: (Date.now() - t0) / 1000,
    agent_counters: AG.COUNTERS, rollout: AG.R.COUNTERS, api: API.COUNTERS,
    mega: { by_agent: Object.fromEntries(Object.entries(MEGA).map(([k, t]) => [k, MR.summary(t)])), human_rate: MR.HUMAN_RATE, floor: MR.floor() },
    search: decStats.length ? { decisions: decStats.length, playouts_mean: decStats.reduce((s, d) => s + d.playouts, 0) / decStats.length,
      playouts_p50: decStats.map(d => d.playouts).sort((a, b) => a - b)[decStats.length >> 1],
      unfilled_share: decStats.reduce((s, d) => s + d.unfilled, 0) / Math.max(1, decStats.reduce((s, d) => s + d.cells, 0)),
      ms_mean: decStats.reduce((s, d) => s + d.ms, 0) / decStats.length } : null, ...r };
  if (OUT) fs.writeFileSync(OUT + '.summary.json', JSON.stringify(summary, null, 1));
  console.log(`  [shard ${SHARD}] done: ${JSON.stringify(r.counts)}  fallbacks ${AG.COUNTERS.fallbacks}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
